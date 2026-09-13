import { hmacHex, randomPairingCode, randomToken, sha256Hex, timingSafeHexEqual } from "./crypto";
import { AuthenticatedUser, requireCsrf } from "./auth";
import { ApiError, json, readJson } from "./http";
import { validateDeviceDraft, validatePairRequest, validateTelemetry } from "./validation";
import { getMunicipality, getSubdivision } from "./regions";

const campusChatAvatarUrls: Readonly<Record<string, string>> = Object.freeze({
  "campus-chat-bluecat": "/assets/visuals-07/slack-symbol-blue-apple-v1.svg",
  "campus-chat-mizu": "/assets/visuals-07/slack-avatar-mizuha-v2.webp",
  "campus-chat-saku": "/assets/visuals-07/slack-avatar-sakuya-flower-v3.webp",
  "campus-chat-ame": "/assets/visuals-07/slack-avatar-amane-v2.webp",
});

type PairingRow = {
  id: string;
  user_id: string;
  device_name: string;
  country_code: string;
  subdivision_code: string | null;
  municipality_code: string | null;
  admin1_code: string | null;
  locality_name: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  is_public: number;
};

type DeviceAuthRow = { token_hash: string; status: string; measurementKeysJson: string };
type DeviceTelemetryStateRow = { lastSeq: number | null; lastSeenAt: string | null; status: string };
type TelemetryIdentityRow = { payloadHash: string; receivedAt: string };
type DeviceRow = {
  deviceId: string;
  publicId: string;
  name: string;
  countryCode: string;
  countryName: string;
  subdivisionCode: string | null;
  municipalityCode: string | null;
  admin1Code: string | null;
  localityName: string | null;
  state: string;
  lastSeenAt: string | null;
  createdAt: string;
  isPublic: number;
  publicLatitude: number | null;
  publicLongitude: number | null;
  measurementKeysJson: string;
};

type TelemetryRow = {
  seq: number;
  observedAt: string | null;
  receivedAt: string;
  payloadJson: string;
};

type PublicSensorRow = {
  id: string;
  sensorName: string;
  countryCode: string;
  subdivisionCode: string | null;
  municipalityCode: string | null;
  latitude: number;
  longitude: number;
  state: string;
  isDemo: number;
  demoLocationLabel: string | null;
  ownerPublicId: string;
  ownerDisplayName: string;
  hasAvatar: number;
  avatarKey: string | null;
  avatarUpdatedAt: string | null;
  xUrl: string | null;
  githubUrl: string | null;
  instagramUrl: string | null;
  likeCount: number;
  observationCount: number;
  observationSpanSeconds: number;
  observationsJson: string;
  measurementKeysJson: string;
};

type PublicNetworkStatsRow = { observationPackets: number; payloadBytes: number };

export const listCountries = async (env: Env): Promise<Response> => {
  const result = await env.DB.prepare(
    "SELECT code, name_en AS nameEn, name_local AS nameLocal FROM countries WHERE enabled = 1 ORDER BY COALESCE(name_local, name_en)",
  ).all<{ code: string; nameEn: string; nameLocal: string | null }>();
  return json({ countries: result.results });
};

export const createPairing = async (request: Request, env: Env, user: AuthenticatedUser): Promise<Response> => {
  await requireCsrf(request, user);
  const draft = validateDeviceDraft(await readJson(request, 4096));
  const country = await env.DB.prepare("SELECT code FROM countries WHERE code = ?1 AND enabled = 1")
    .bind(draft.countryCode).first<{ code: string }>();
  if (!country) throw new ApiError(400, "INVALID_COUNTRY", "Selected country is not enabled.");
  const code = randomPairingCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO device_pairing_codes
      (id, code_hash, user_id, device_name, country_code, subdivision_code, municipality_code,
       admin1_code, locality_name, public_latitude, public_longitude, is_public, measurement_keys_json, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
  ).bind(
    crypto.randomUUID(),
    await hmacHex(env.PAIRING_CODE_PEPPER, code),
    user.id,
    draft.name,
    draft.countryCode,
    draft.subdivisionCode,
    draft.municipalityCode,
    draft.admin1Code,
    draft.localityName,
    draft.publicLatitude,
    draft.publicLongitude,
    1,
    JSON.stringify(draft.measurementKeys ?? []),
    expiresAt,
    now.toISOString(),
  ).run();
  return json({ pairingCode: code, expiresAt }, 201);
};

export const pairDevice = async (request: Request, env: Env): Promise<Response> => {
  const { pairingCode } = validatePairRequest(await readJson(request, 2048));
  const codeHash = await hmacHex(env.PAIRING_CODE_PEPPER, pairingCode);
  const now = new Date().toISOString();
  const deviceId = `dev_${randomIdentifier(12)}`;
  const databaseId = crypto.randomUUID();
  const rawToken = randomToken("gdt_");
  const tokenHash = await hmacHex(env.DEVICE_TOKEN_PEPPER, rawToken);
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE device_pairing_codes
       SET used_at = ?1, consumed_by_device_id = ?3
       WHERE code_hash = ?2 AND used_at IS NULL AND expires_at > ?1
       RETURNING id, user_id, device_name, country_code, subdivision_code, municipality_code,
         admin1_code, locality_name,
         public_latitude, public_longitude, is_public, measurement_keys_json`,
    ).bind(now, codeHash, databaseId),
    env.DB.prepare(
      `INSERT INTO devices
        (id, public_id, device_id, owner_user_id, name, token_hash, country_code, subdivision_code,
         municipality_code, admin1_code, locality_name,
         public_latitude, public_longitude, is_public, measurement_keys_json, location_precision, created_at, updated_at)
       SELECT ?1, ?2, ?3, user_id, device_name, ?4, country_code, subdivision_code,
         municipality_code, admin1_code, locality_name,
         public_latitude, public_longitude, 1, measurement_keys_json,
         CASE WHEN municipality_code IS NOT NULL OR locality_name IS NOT NULL THEN 'LOCALITY'
              WHEN subdivision_code IS NOT NULL OR admin1_code IS NOT NULL THEN 'ADMIN1' ELSE 'COUNTRY' END,
         ?5, ?5
       FROM device_pairing_codes
       WHERE code_hash = ?6 AND used_at = ?5 AND consumed_by_device_id = ?1`,
    ).bind(databaseId, `sensor_${randomIdentifier(16)}`, deviceId, tokenHash, now, codeHash),
  ]);
  const consumedRows = results[0]?.results as PairingRow[] | undefined;
  const inserted = results[1]?.meta.changes ?? 0;
  if (!consumedRows?.[0] || inserted !== 1) {
    throw new ApiError(409, "PAIRING_CODE_UNAVAILABLE", "Pairing code is invalid, expired, or already used.");
  }
  return json({ deviceId, deviceToken: rawToken, tokenType: "Bearer" }, 201);
};

export const acceptTelemetry = async (
  request: Request,
  env: Env,
  deviceId: string,
): Promise<Response> => {
  const authorization = request.headers.get("Authorization") ?? "";
  const tokenMatch = /^Bearer ([A-Za-z0-9_-]{40,128})$/u.exec(authorization);
  if (!tokenMatch?.[1]) throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Device authentication failed.");
  const device = await env.DB.prepare(
    "SELECT token_hash, status, measurement_keys_json AS measurementKeysJson FROM devices WHERE device_id = ?1 AND deleted_at IS NULL",
  ).bind(deviceId).first<DeviceAuthRow>();
  const providedHash = await hmacHex(env.DEVICE_TOKEN_PEPPER, tokenMatch[1]);
  if (!device || device.status !== "ACTIVE" || !(await timingSafeHexEqual(providedHash, device.token_hash))) {
    throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Device authentication failed.");
  }
  const telemetry = validateTelemetry(await readJson(request, 12 * 1024));
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const rateLimitCutoff = new Date(nowDate.getTime() - TELEMETRY_MIN_INTERVAL_MS).toISOString();
  const canonicalData = Object.fromEntries(Object.entries(telemetry.data).sort(([left], [right]) => left.localeCompare(right)));
  const measurementKeysJson = JSON.stringify(mergeMeasurementKeys(device.measurementKeysJson, Object.keys(canonicalData)));
  const payload = JSON.stringify(canonicalData);
  const payloadHash = await sha256Hex(JSON.stringify({ observedAt: telemetry.observedAt, data: canonicalData }));
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE devices
       SET last_seq = ?1, last_payload_hash = ?2, last_seen_at = ?3, updated_at = ?3, measurement_keys_json = ?4
       WHERE device_id = ?5 AND status = 'ACTIVE' AND deleted_at IS NULL
         AND (last_seq IS NULL OR ?1 > last_seq)
         AND (last_seen_at IS NULL OR last_seen_at <= ?6)
        RETURNING device_id`,
    ).bind(telemetry.seq, payloadHash, now, measurementKeysJson, deviceId, rateLimitCutoff),
    env.DB.prepare(
      `INSERT INTO telemetry
        (id, device_id, seq, observed_at, received_at, payload_hash, payload_json, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?5
       FROM devices
       WHERE device_id = ?2 AND last_seq = ?3 AND last_payload_hash = ?6
         AND status = 'ACTIVE' AND deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM telemetry WHERE device_id = ?2 AND seq = ?3)
       RETURNING id`,
    ).bind(crypto.randomUUID(), deviceId, telemetry.seq, telemetry.observedAt, now, payloadHash, payload),
  ]);
  // Trigger-maintained rollups contribute to meta.changes, so statement
  // success must be determined from each statement's own RETURNING row.
  const claimed = (results[0]?.results?.length ?? 0) === 1;
  const created = (results[1]?.results?.length ?? 0) === 1;
  if (claimed && created) return json({ accepted: true, duplicate: false, receivedAt: now }, 202);
  if (claimed !== created) throw new ApiError(409, "SEQUENCE_RACE", "Telemetry sequence could not be committed.");

  const existing = await env.DB.prepare(
    "SELECT payload_hash AS payloadHash, received_at AS receivedAt FROM telemetry WHERE device_id = ?1 AND seq = ?2",
  ).bind(deviceId, telemetry.seq).first<TelemetryIdentityRow>();
  if (existing) {
    if (!(await timingSafeHexEqual(payloadHash, existing.payloadHash))) {
      throw new ApiError(409, "SEQUENCE_CONFLICT", "This seq was already used with different telemetry content.");
    }
    // Exact retries stay idempotent without creating a row or extending ONLINE status.
    return json({ accepted: true, duplicate: true, receivedAt: existing.receivedAt }, 200);
  }

  const current = await env.DB.prepare(
    `SELECT last_seq AS lastSeq, last_seen_at AS lastSeenAt, status
     FROM devices WHERE device_id = ?1 AND deleted_at IS NULL`,
  ).bind(deviceId).first<DeviceTelemetryStateRow>();
  if (!current || current.status !== "ACTIVE") throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Device authentication failed.");
  if (current.lastSeq !== null && telemetry.seq <= current.lastSeq) {
    throw new ApiError(409, "STALE_SEQUENCE", "seq is lower than the device's latest accepted sequence.");
  }
  const retryAfterSeconds = telemetryRetryAfterSeconds(current.lastSeenAt, nowDate.getTime());
  if (retryAfterSeconds !== null) {
    return json(
      { error: { code: "TELEMETRY_RATE_LIMITED", message: "A device may submit at most one new telemetry record per 60 seconds." } },
      429,
      { "Retry-After": String(retryAfterSeconds) },
    );
  }
  throw new ApiError(409, "SEQUENCE_RACE", "Telemetry sequence could not be committed.");
};

const telemetryRetryAfterSeconds = (lastSeenAt: string | null, nowMs: number): number | null => {
  if (!lastSeenAt) return null;
  const lastSeenMs = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenMs)) return null;
  const remainingMs = lastSeenMs + TELEMETRY_MIN_INTERVAL_MS - nowMs;
  return remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 1000)) : null;
};

const TELEMETRY_MIN_INTERVAL_MS = 60_000;

export const listDevices = async (env: Env, user: AuthenticatedUser): Promise<Response> => {
  const threshold = onlineThreshold(env);
  const result = await env.DB.prepare(
    `SELECT d.device_id AS deviceId, d.public_id AS publicId, d.name, d.country_code AS countryCode,
       COALESCE(c.name_local, c.name_en) AS countryName,
       d.subdivision_code AS subdivisionCode, d.municipality_code AS municipalityCode,
       d.admin1_code AS admin1Code,
       d.locality_name AS localityName,
       CASE WHEN datetime(d.last_seen_at) >= datetime('now', ?1) THEN 'ONLINE' ELSE 'OFFLINE' END AS state,
       d.last_seen_at AS lastSeenAt, d.created_at AS createdAt, d.is_public AS isPublic,
       d.public_latitude AS publicLatitude, d.public_longitude AS publicLongitude,
       d.measurement_keys_json AS measurementKeysJson
     FROM devices d JOIN countries c ON c.code = d.country_code
     WHERE d.owner_user_id = ?2 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC`,
  ).bind(`-${threshold} seconds`, user.id).all<DeviceRow>();
  return json({ devices: result.results.map(serializeDevice) });
};

export const getDevice = async (env: Env, user: AuthenticatedUser, deviceId: string): Promise<Response> => {
  const device = await ownedDevice(env, user.id, deviceId);
  return json({ device: serializeDevice(device) });
};

export const getLatest = async (env: Env, user: AuthenticatedUser, deviceId: string): Promise<Response> => {
  const device = await ownedDevice(env, user.id, deviceId);
  const latest = await env.DB.prepare(
    `SELECT seq, observed_at AS observedAt, received_at AS receivedAt, payload_json AS payloadJson
     FROM telemetry WHERE device_id = ?1 ORDER BY received_at DESC, seq DESC LIMIT 1`,
  ).bind(deviceId).first<TelemetryRow>();
  return json({ device: serializeDevice(device), latest: latest ? serializeTelemetry(latest) : null });
};

export const getHistory = async (
  env: Env,
  user: AuthenticatedUser,
  deviceId: string,
  url: URL,
): Promise<Response> => {
  await ownedDevice(env, user.id, deviceId);
  const limit = parseLimit(url.searchParams.get("limit"));
  const from = parseDateQuery(url.searchParams.get("from"), "from");
  const to = parseDateQuery(url.searchParams.get("to"), "to");
  if (from && to && from > to) throw new ApiError(400, "INVALID_TIME_RANGE", "from must not be after to.");
  const conditions = ["device_id = ?1"];
  const bindings: Array<string | number> = [deviceId];
  if (from) {
    bindings.push(from);
    conditions.push(`received_at >= ?${bindings.length}`);
  }
  if (to) {
    bindings.push(to);
    conditions.push(`received_at <= ?${bindings.length}`);
  }
  bindings.push(limit);
  const result = await env.DB.prepare(
    `SELECT seq, observed_at AS observedAt, received_at AS receivedAt, payload_json AS payloadJson
     FROM telemetry
     WHERE ${conditions.join(" AND ")}
     ORDER BY received_at DESC, seq DESC LIMIT ?${bindings.length}`,
  ).bind(...bindings).all<TelemetryRow>();
  return json({ deviceId, telemetry: result.results.map(serializeTelemetry) });
};

export const updateDevice = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  deviceId: string,
): Promise<Response> => {
  await requireCsrf(request, user);
  const draft = validateDeviceDraft(await readJson(request, 4096));
  const country = await env.DB.prepare("SELECT code FROM countries WHERE code = ?1 AND enabled = 1")
    .bind(draft.countryCode).first();
  if (!country) throw new ApiError(400, "INVALID_COUNTRY", "Selected country is not enabled.");
  const result = await env.DB.prepare(
    `UPDATE devices SET name = ?1, country_code = ?2, subdivision_code = ?3, municipality_code = ?4,
       admin1_code = ?5, locality_name = ?6, is_public = ?7, public_latitude = ?8, public_longitude = ?9,
       measurement_keys_json = COALESCE(?10, measurement_keys_json),
       location_precision = CASE WHEN ?4 IS NOT NULL OR ?6 IS NOT NULL THEN 'LOCALITY'
         WHEN ?3 IS NOT NULL OR ?5 IS NOT NULL THEN 'ADMIN1' ELSE 'COUNTRY' END,
       updated_at = ?11
     WHERE device_id = ?12 AND owner_user_id = ?13 AND status = 'ACTIVE' AND deleted_at IS NULL`,
  ).bind(
    draft.name, draft.countryCode, draft.subdivisionCode, draft.municipalityCode,
    draft.admin1Code, draft.localityName, 1,
    draft.publicLatitude, draft.publicLongitude,
    draft.measurementKeys === null ? null : JSON.stringify(draft.measurementKeys),
    new Date().toISOString(), deviceId, user.id,
  ).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "DEVICE_NOT_FOUND", "Device was not found.");
  return getDevice(env, user, deviceId);
};

export const revokeDevice = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  deviceId: string,
): Promise<Response> => {
  await requireCsrf(request, user);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE devices SET status = 'REVOKED', deleted_at = ?1, updated_at = ?1
     WHERE device_id = ?2 AND owner_user_id = ?3 AND status = 'ACTIVE' AND deleted_at IS NULL`,
  ).bind(now, deviceId, user.id).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "DEVICE_NOT_FOUND", "Device was not found.");
  return new Response(null, { status: 204 });
};

const ownedDevice = async (env: Env, userId: string, deviceId: string): Promise<DeviceRow> => {
  const threshold = onlineThreshold(env);
  const device = await env.DB.prepare(
    `SELECT d.device_id AS deviceId, d.public_id AS publicId, d.name, d.country_code AS countryCode,
       COALESCE(c.name_local, c.name_en) AS countryName,
       d.subdivision_code AS subdivisionCode, d.municipality_code AS municipalityCode,
       d.admin1_code AS admin1Code,
       d.locality_name AS localityName,
       CASE WHEN datetime(d.last_seen_at) >= datetime('now', ?1) THEN 'ONLINE' ELSE 'OFFLINE' END AS state,
       d.last_seen_at AS lastSeenAt, d.created_at AS createdAt, d.is_public AS isPublic,
       d.public_latitude AS publicLatitude, d.public_longitude AS publicLongitude,
       d.measurement_keys_json AS measurementKeysJson
     FROM devices d JOIN countries c ON c.code = d.country_code
     WHERE d.device_id = ?2 AND d.owner_user_id = ?3 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL`,
  ).bind(`-${threshold} seconds`, deviceId, userId).first<DeviceRow>();
  if (!device) throw new ApiError(404, "DEVICE_NOT_FOUND", "Device was not found.");
  return device;
};

export const listPublicSensors = async (env: Env): Promise<Response> => {
  const threshold = onlineThreshold(env);
  const [sensorResult, networkStatsResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT d.public_id AS id, d.name AS sensorName, d.country_code AS countryCode,
         d.subdivision_code AS subdivisionCode, d.municipality_code AS municipalityCode, d.public_latitude AS latitude,
         d.public_longitude AS longitude,
         CASE WHEN datetime(d.last_seen_at) >= datetime('now', ?1) THEN 'ONLINE' ELSE 'OFFLINE' END AS state,
         d.is_demo AS isDemo, CASE WHEN d.is_demo = 1 THEN d.locality_name ELSE NULL END AS demoLocationLabel,
         u.public_id AS ownerPublicId, u.display_name AS ownerDisplayName,
         CASE WHEN u.avatar_png IS NULL THEN 0 ELSE 1 END AS hasAvatar,
         u.avatar_key AS avatarKey, u.avatar_updated_at AS avatarUpdatedAt,
         u.x_url AS xUrl, u.github_url AS githubUrl, u.instagram_url AS instagramUrl,
         d.measurement_keys_json AS measurementKeysJson,
         COALESCE(social.like_count, 0) AS likeCount,
         COALESCE(rollup.observation_count, 0) AS observationCount,
         CASE WHEN COALESCE(rollup.observation_count, 0) < 2 THEN 0 ELSE CAST(
           MAX(0, (julianday(rollup.last_received_at) - julianday(rollup.first_received_at)) * 86400)
           AS INTEGER) END AS observationSpanSeconds,
         COALESCE(rollup.recent_payloads_json, '[]') AS observationsJson
       FROM devices d
       JOIN users u ON u.id = d.owner_user_id
       LEFT JOIN device_social_rollups social ON social.device_id = d.id
       LEFT JOIN device_telemetry_rollups rollup ON rollup.device_id = d.device_id
       WHERE d.is_public = 1 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL
         AND d.public_latitude IS NOT NULL AND d.public_longitude IS NOT NULL
       ORDER BY d.created_at DESC LIMIT 500`,
    ).bind(`-${threshold} seconds`),
    env.DB.prepare(
      `SELECT COALESCE(SUM(rollup.observation_count), 0) AS observationPackets,
         COALESCE(SUM(rollup.payload_bytes), 0) AS payloadBytes
       FROM devices d
       LEFT JOIN device_telemetry_rollups rollup ON rollup.device_id = d.device_id
       WHERE d.is_public = 1 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL
         AND d.public_latitude IS NOT NULL AND d.public_longitude IS NOT NULL`,
    ),
  ]);
  const sensorRows = (sensorResult?.results ?? []) as PublicSensorRow[];
  const networkStats = (networkStatsResult?.results?.[0] ?? { observationPackets: 0, payloadBytes: 0 }) as PublicNetworkStatsRow;
  return json({
    generatedAt: new Date().toISOString(),
    stats: {
      observationPackets: Number(networkStats.observationPackets) || 0,
      payloadBytes: Number(networkStats.payloadBytes) || 0,
    },
    sensors: sensorRows.map((row) => ({
      id: row.id,
      sensorName: row.sensorName,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        precision: "PUBLIC_REFERENCE_POINT",
      },
      region: {
        countryCode: row.countryCode,
        subdivisionCode: row.subdivisionCode,
        subdivisionName: row.subdivisionCode ? getSubdivision(row.subdivisionCode)?.name ?? null : null,
        municipalityCode: row.municipalityCode,
        municipalityName: row.municipalityCode ? getMunicipality(row.municipalityCode)?.name ?? null : null,
      },
      state: row.state,
      isDemo: row.isDemo === 1,
      demoLocationLabel: row.demoLocationLabel,
      observations: parsePublicObservations(row.observationsJson),
      observationCount: Number(row.observationCount) || 0,
      observationSpanSeconds: Number(row.observationSpanSeconds) || 0,
      measurementKeys: parseMeasurementKeysJson(row.measurementKeysJson),
      likeCount: Number(row.likeCount) || 0,
      owner: {
        displayName: row.ownerDisplayName,
        avatarUrl: row.avatarKey && campusChatAvatarUrls[row.avatarKey]
          ? campusChatAvatarUrls[row.avatarKey]
          : row.hasAvatar === 1
            ? `/api/public/v1/profiles/${encodeURIComponent(row.ownerPublicId)}/avatar?v=${encodeURIComponent(row.avatarUpdatedAt ?? "1")}&privacy=2`
            : null,
        xUrl: row.xUrl,
        githubUrl: row.githubUrl,
        instagramUrl: row.instagramUrl,
      },
    })),
  });
};

const parsePublicObservations = (payloadJson: string): Array<{ data: Record<string, number> }> => {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 12).flatMap((payload) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
      const measurements = Object.entries(payload).filter((entry): entry is [string, number] => (
        typeof entry[1] === "number" && Number.isFinite(entry[1])
      ));
      return measurements.length ? [{ data: Object.fromEntries(measurements) }] : [];
    });
  } catch {
    return [];
  }
};

const serializeTelemetry = (row: TelemetryRow): { seq: number; observedAt: string | null; receivedAt: string; data: unknown } => ({
  seq: row.seq,
  observedAt: row.observedAt,
  receivedAt: row.receivedAt,
  data: JSON.parse(row.payloadJson),
});

const serializeDevice = (device: DeviceRow) => ({
  ...Object.fromEntries(Object.entries(device).filter(([key]) => key !== "measurementKeysJson")),
  measurementKeys: parseMeasurementKeysJson(device.measurementKeysJson),
  subdivisionName: device.subdivisionCode ? getSubdivision(device.subdivisionCode)?.name ?? null : null,
  municipalityName: device.municipalityCode ? getMunicipality(device.municipalityCode)?.name ?? null : null,
  isPublic: device.isPublic === 1,
});

const parseMeasurementKeysJson = (value: string | null): string[] => {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
};

const mergeMeasurementKeys = (stored: string, observed: readonly string[]): string[] => (
  [...new Set([...parseMeasurementKeysJson(stored), ...observed])].slice(0, 16)
);

const parseLimit = (value: string | null): number => {
  if (value === null) return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new ApiError(400, "INVALID_LIMIT", "limit must be between 1 and 500.");
  return limit;
};

const parseDateQuery = (value: string | null, name: string): string | null => {
  if (value === null || value === "") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ApiError(400, "INVALID_TIME_RANGE", `${name} must be an ISO 8601 timestamp.`);
  return new Date(parsed).toISOString();
};

const onlineThreshold = (env: Env): number => {
  const parsed = Number(env.ONLINE_THRESHOLD_SECONDS);
  return Number.isInteger(parsed) && parsed >= 5 && parsed <= 3600 ? parsed : 30;
};

const randomIdentifier = (length: number): string => {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};
