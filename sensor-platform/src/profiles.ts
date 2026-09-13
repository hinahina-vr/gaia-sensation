import { AuthenticatedUser, requireCsrf } from "./auth";
import { ApiError, json, readBytes, readJson } from "./http";
import { validateProfileDraft } from "./validation";

const MAX_AVATAR_BYTES = 1024 * 1024;
const MAX_AVATAR_EDGE = 512;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

type ProfileRow = {
  publicId: string;
  displayName: string;
  hasAvatar: number;
  avatarUpdatedAt: string | null;
  xUrl: string | null;
  githubUrl: string | null;
  instagramUrl: string | null;
};

export const getProfile = async (env: Env, user: AuthenticatedUser): Promise<Response> => {
  const profile = await profileRow(env, user.id);
  return json({ profile: serializeProfile(profile) });
};

export const updateProfile = async (request: Request, env: Env, user: AuthenticatedUser): Promise<Response> => {
  await requireCsrf(request, user);
  const draft = validateProfileDraft(await readJson(request, 4096));
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE users SET display_name = ?1, x_url = ?2, github_url = ?3, instagram_url = ?4, updated_at = ?5
     WHERE id = ?6`,
  ).bind(draft.displayName, draft.xUrl, draft.githubUrl, draft.instagramUrl, now, user.id).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile was not found.");
  return getProfile(env, user);
};

export const uploadAvatar = async (request: Request, env: Env, user: AuthenticatedUser): Promise<Response> => {
  await requireCsrf(request, user);
  const type = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "image/png") throw new ApiError(415, "UNSUPPORTED_AVATAR_TYPE", "Avatar must be a PNG image.");
  const sanitized = sanitizePng(await readBytes(request, MAX_AVATAR_BYTES));
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE users SET avatar_png = ?1, avatar_updated_at = ?2, updated_at = ?2 WHERE id = ?3",
  ).bind(sanitized, now, user.id).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile was not found.");
  return getProfile(env, user);
};

export const deleteAvatar = async (request: Request, env: Env, user: AuthenticatedUser): Promise<Response> => {
  await requireCsrf(request, user);
  await env.DB.prepare(
    "UPDATE users SET avatar_png = NULL, avatar_updated_at = NULL, updated_at = ?1 WHERE id = ?2",
  ).bind(new Date().toISOString(), user.id).run();
  return new Response(null, { status: 204 });
};

export const getPublicAvatar = async (env: Env, publicId: string): Promise<Response> => {
  const profile = await env.DB.prepare(
    "SELECT avatar_png AS avatarPng, avatar_updated_at AS avatarUpdatedAt FROM users WHERE public_id = ?1",
  ).bind(publicId).first<{ avatarPng: number[] | ArrayBuffer | Uint8Array | null; avatarUpdatedAt: string | null }>();
  if (!profile?.avatarPng) throw new ApiError(404, "AVATAR_NOT_FOUND", "Avatar was not found.");
  const avatar = avatarBytes(profile.avatarPng);
  const headers = new Headers();
  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "no-store");
  if (profile.avatarUpdatedAt) headers.set("Last-Modified", new Date(profile.avatarUpdatedAt).toUTCString());
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(avatar, { headers });
};

const profileRow = async (env: Env, userId: string): Promise<ProfileRow> => {
  const profile = await env.DB.prepare(
    `SELECT public_id AS publicId, display_name AS displayName,
       CASE WHEN avatar_png IS NULL THEN 0 ELSE 1 END AS hasAvatar,
       avatar_updated_at AS avatarUpdatedAt, x_url AS xUrl, github_url AS githubUrl,
       instagram_url AS instagramUrl
     FROM users WHERE id = ?1`,
  ).bind(userId).first<ProfileRow>();
  if (!profile?.publicId) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile was not found.");
  return profile;
};

const serializeProfile = (profile: ProfileRow) => ({
  publicId: profile.publicId,
  displayName: profile.displayName,
  avatarUrl: profile.hasAvatar === 1
    ? `/api/public/v1/profiles/${encodeURIComponent(profile.publicId)}/avatar?v=${encodeURIComponent(profile.avatarUpdatedAt ?? "1")}&privacy=2`
    : null,
  xUrl: profile.xUrl,
  githubUrl: profile.githubUrl,
  instagramUrl: profile.instagramUrl,
});

const avatarBytes = (value: number[] | ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (Array.isArray(value)) return Uint8Array.from(value).buffer;
  if (value instanceof Uint8Array) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  return value;
};

const sanitizePng = (source: Uint8Array): Uint8Array => {
  if (source.byteLength < 33 || !PNG_SIGNATURE.every((value, index) => source[index] === value)) {
    throw new ApiError(400, "INVALID_AVATAR", "Avatar is not a valid PNG image.");
  }
  const kept: Uint8Array[] = [source.slice(0, 8)];
  let offset = 8;
  let sawHeader = false;
  let sawData = false;
  let sawEnd = false;
  while (offset + 12 <= source.byteLength && !sawEnd) {
    const length = readUint32(source, offset);
    const end = offset + 12 + length;
    if (length > MAX_AVATAR_BYTES || end > source.byteLength) throw new ApiError(400, "INVALID_AVATAR", "PNG chunks are invalid.");
    const type = new TextDecoder().decode(source.slice(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/u.test(type)) throw new ApiError(400, "INVALID_AVATAR", "PNG chunks are invalid.");
    const chunk = source.slice(offset, end);
    if (type === "IHDR") {
      if (sawHeader || offset !== 8 || length !== 13) throw new ApiError(400, "INVALID_AVATAR", "PNG header is invalid.");
      const width = readUint32(source, offset + 8);
      const height = readUint32(source, offset + 12);
      const bitDepth = source[offset + 16] ?? -1;
      const colorType = source[offset + 17] ?? -1;
      const interlace = source[offset + 20] ?? -1;
      if (width < 1 || height < 1 || width > MAX_AVATAR_EDGE || height > MAX_AVATAR_EDGE || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
        throw new ApiError(400, "INVALID_AVATAR", `Avatar must be a non-interlaced RGB/RGBA PNG up to ${MAX_AVATAR_EDGE}px.`);
      }
      kept.push(chunk);
      sawHeader = true;
    } else if (type === "IDAT") {
      if (!sawHeader || sawEnd) throw new ApiError(400, "INVALID_AVATAR", "PNG image data is invalid.");
      kept.push(chunk);
      sawData = true;
    } else if (type === "IEND") {
      if (!sawHeader || !sawData || length !== 0) throw new ApiError(400, "INVALID_AVATAR", "PNG ending is invalid.");
      kept.push(chunk);
      sawEnd = true;
    } else if ((type.charCodeAt(0) & 32) === 0 || type === "acTL" || type === "fcTL" || type === "fdAT") {
      throw new ApiError(400, "INVALID_AVATAR", "Animated or unsupported PNG images are not accepted.");
    }
    offset = end;
  }
  if (!sawEnd || offset !== source.byteLength) throw new ApiError(400, "INVALID_AVATAR", "PNG ending is invalid.");
  const total = kept.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let outputOffset = 0;
  for (const chunk of kept) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.byteLength;
  }
  return output;
};

const readUint32 = (source: Uint8Array, offset: number): number =>
  (((source[offset] ?? 0) * 0x1000000) + ((source[offset + 1] ?? 0) << 16) + ((source[offset + 2] ?? 0) << 8) + (source[offset + 3] ?? 0)) >>> 0;
