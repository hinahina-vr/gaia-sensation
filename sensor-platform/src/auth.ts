import {
  base64UrlDecode,
  decryptFlowValue,
  encryptFlowValue,
  pkceChallenge,
  randomToken,
  sha256Hex,
  timingSafeHexEqual,
} from "./crypto";
import { ApiError, clearCookie, csrfCookie, flowCookie, json, parseCookies, sessionCookie } from "./http";

const SESSION_COOKIE = "__Host-gaia_sensor_session";
const CSRF_COOKIE = "__Host-gaia_sensor_csrf";
export const OIDC_FLOW_COOKIE = "__Host-gaia_sensor_oidc";
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const FLOW_TTL_SECONDS = 600;

type SessionRow = {
  session_id: string;
  user_id: string;
  display_name: string;
  account_kind: AccountKind;
  csrf_hash: string;
  expires_at: string;
};

type OAuthFlowRow = {
  id: string;
  nonce_hash: string;
  browser_binding_hash: string;
  verifier_ciphertext: string;
  return_path: string;
};

type AccountKind = "google" | "trial";
type GoogleIdentity = { sub: string };

type GoogleTokenResponse = { id_token?: unknown };
type JsonWebKeySet = { keys?: unknown };
type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  accountKind: AccountKind;
  sessionId: string;
  csrfHash: string;
  expiresAt: string;
};

export const startGoogleLogin = async (request: Request, env: Env): Promise<Response> => {
  requireAuthConfiguration(env);
  const requestUrl = new URL(request.url);
  const returnPath = normalizeReturnPath(requestUrl.searchParams.get("returnTo"));
  const state = randomToken("st_");
  const nonce = randomToken("no_");
  const verifier = randomToken("pkce_");
  const now = new Date();
  const trialUserId = await currentTrialUserId(request, env.DB, now.toISOString());
  const trialBinding = trialUserId ? await encryptFlowValue(trialUserId, env.SESSION_SECRET) : "";
  const browserBinding = `${randomToken("oidc_")}~${trialBinding}`;
  const expiresAt = new Date(now.getTime() + FLOW_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO oauth_flows
      (id, state_hash, nonce_hash, browser_binding_hash, verifier_ciphertext, return_path, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(
    crypto.randomUUID(),
    await sha256Hex(state),
    await sha256Hex(nonce),
    await sha256Hex(browserBinding),
    await encryptFlowValue(verifier, env.SESSION_SECRET),
    returnPath,
    expiresAt,
    now.toISOString(),
  ).run();

  const authorize = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorize.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(env),
    response_type: "code",
    scope: "openid",
    state,
    nonce,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  }).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": flowCookie(browserBinding, FLOW_TTL_SECONDS) },
  });
};

export const finishGoogleLogin = async (request: Request, env: Env): Promise<Response> => {
  requireAuthConfiguration(env);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code || state.length > 512 || code.length > 4096) {
    throw new ApiError(400, "INVALID_OIDC_CALLBACK", "Google login callback is incomplete.");
  }
  const now = new Date().toISOString();
  const stateHash = await sha256Hex(state);
  const candidate = await env.DB.prepare(
    `SELECT id, nonce_hash, browser_binding_hash, verifier_ciphertext, return_path
     FROM oauth_flows WHERE state_hash = ?1 AND consumed_at IS NULL AND expires_at > ?2`,
  ).bind(stateHash, now).first<OAuthFlowRow>();
  const browserBinding = parseCookies(request).get(OIDC_FLOW_COOKIE) ?? "";
  const browserBindingHash = await sha256Hex(browserBinding);
  if (!candidate || !browserBinding || !(await timingSafeHexEqual(browserBindingHash, candidate.browser_binding_hash))) {
    throw new ApiError(400, "INVALID_OIDC_STATE", "Google login state is invalid, expired, or belongs to another browser.");
  }
  const flow = await env.DB.prepare(
    `UPDATE oauth_flows SET consumed_at = ?1
     WHERE id = ?2 AND state_hash = ?3 AND browser_binding_hash = ?4
       AND consumed_at IS NULL AND expires_at > ?1
     RETURNING id, nonce_hash, browser_binding_hash, verifier_ciphertext, return_path`,
  ).bind(now, candidate.id, stateHash, browserBindingHash).first<OAuthFlowRow>();
  if (!flow) throw new ApiError(400, "INVALID_OIDC_STATE", "Google login state has already been used.");
  const verifier = await decryptFlowValue(flow.verifier_ciphertext, env.SESSION_SECRET);
  if (!verifier) throw new ApiError(400, "INVALID_OIDC_FLOW", "Google login flow could not be verified.");
  const trialBinding = browserBinding.slice(browserBinding.indexOf("~") + 1);
  const trialUserId = trialBinding ? await decryptFlowValue(trialBinding, env.SESSION_SECRET) : null;

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(env),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok) throw new ApiError(401, "OIDC_TOKEN_EXCHANGE_FAILED", "Google login could not be completed.");
  const tokenBody: unknown = await tokenResponse.json();
  const idToken = isGoogleTokenResponse(tokenBody) ? tokenBody.id_token : undefined;
  if (typeof idToken !== "string" || idToken.length > 16384) {
    throw new ApiError(401, "INVALID_ID_TOKEN", "Google did not return a valid ID token.");
  }
  const identity = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID, flow.nonce_hash);
  const userId = await upsertGoogleUser(env.DB, identity, now, trialUserId);
  const session = await createSession(env, userId, now);
  const headers = new Headers({ Location: new URL(flow.return_path, env.PUBLIC_ORIGIN).toString() });
  headers.append("Set-Cookie", sessionCookie(session.token, session.ttl));
  headers.append("Set-Cookie", csrfCookie(session.csrfToken, session.ttl));
  headers.append("Set-Cookie", clearCookie(OIDC_FLOW_COOKIE, true));
  return new Response(null, { status: 302, headers });
};

export const getAuthenticatedUser = async (request: Request, env: Env): Promise<AuthenticatedUser> => {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token || token.length > 256) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Login is required.");
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.user_id, u.display_name, u.account_kind, s.csrf_hash, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2`,
  ).bind(await sha256Hex(token), now).first<SessionRow>();
  if (!row) throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please log in again.");
  return {
    id: row.user_id,
    displayName: row.display_name,
    accountKind: row.account_kind,
    sessionId: row.session_id,
    csrfHash: row.csrf_hash,
    expiresAt: row.expires_at,
  };
};

export const requireCsrf = async (request: Request, user: AuthenticatedUser): Promise<void> => {
  const cookieToken = parseCookies(request).get(CSRF_COOKIE) ?? "";
  const headerToken = request.headers.get("X-CSRF-Token") ?? "";
  if (!cookieToken || !headerToken || cookieToken.length > 256 || headerToken.length > 256) {
    throw new ApiError(403, "CSRF_VALIDATION_FAILED", "CSRF validation failed.");
  }
  const [cookieHash, headerHash] = await Promise.all([sha256Hex(cookieToken), sha256Hex(headerToken)]);
  if (!(await timingSafeHexEqual(cookieHash, headerHash)) || !(await timingSafeHexEqual(cookieHash, user.csrfHash))) {
    throw new ApiError(403, "CSRF_VALIDATION_FAILED", "CSRF validation failed.");
  }
};

export const sessionResponse = async (request: Request, env: Env): Promise<Response> => {
  const user = await getAuthenticatedUser(request, env);
  const rotatedToken = randomToken("gs_");
  const now = new Date();
  const rotated = await env.DB.prepare(
    `UPDATE sessions SET token_hash = ?1, last_seen_at = ?2
     WHERE id = ?3 AND user_id = ?4 AND revoked_at IS NULL AND expires_at > ?2`,
  ).bind(await sha256Hex(rotatedToken), now.toISOString(), user.sessionId, user.id).run();
  if (rotated.meta.changes !== 1) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Session is no longer active.");
  const remainingSeconds = Math.max(1, Math.floor((Date.parse(user.expiresAt) - now.getTime()) / 1000));
  const headers = new Headers({ "Set-Cookie": sessionCookie(rotatedToken, remainingSeconds) });
  return json({ user: { id: user.id, displayName: user.displayName, accountKind: user.accountKind }, expiresAt: user.expiresAt }, 200, headers);
};

export const startTrialSession = async (request: Request, env: Env): Promise<Response> => {
  if (request.headers.get("Origin") !== env.WEB_ORIGIN) {
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.");
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `DELETE FROM users
     WHERE account_kind = 'trial'
       AND NOT EXISTS (
         SELECT 1 FROM sessions
         WHERE sessions.user_id = users.id
           AND sessions.revoked_at IS NULL
           AND sessions.expires_at > ?1
       )`,
  ).bind(now).run();

  const userId = crypto.randomUUID();
  const publicId = createPublicId();
  const displayName = anonymousDisplayName("おためし参加者", publicId);
  await env.DB.prepare(
    `INSERT INTO users (id, public_id, display_name, account_kind, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'trial', ?4, ?4)`,
  ).bind(userId, publicId, displayName, now).run();
  const session = await createSession(env, userId, now);
  const headers = new Headers();
  headers.append("Set-Cookie", sessionCookie(session.token, session.ttl));
  headers.append("Set-Cookie", csrfCookie(session.csrfToken, session.ttl));
  return json({
    user: { id: userId, displayName, accountKind: "trial" },
    expiresAt: session.expiresAt,
  }, 201, headers);
};

export const logout = async (request: Request, env: Env): Promise<Response> => {
  const user = await getAuthenticatedUser(request, env);
  await requireCsrf(request, user);
  if (user.accountKind === "trial") {
    await env.DB.prepare("DELETE FROM users WHERE id = ?1 AND account_kind = 'trial'").bind(user.id).run();
  } else {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE id = ?2 AND user_id = ?3")
      .bind(new Date().toISOString(), user.sessionId, user.id).run();
  }
  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE, true));
  headers.append("Set-Cookie", clearCookie(CSRF_COOKIE, false));
  return json({ ok: true, accountDeleted: user.accountKind === "trial" }, 200, headers);
};

const createSession = async (env: Env, userId: string, now: string): Promise<{ token: string; csrfToken: string; ttl: number; expiresAt: string }> => {
  const ttl = boundedInteger(env.SESSION_TTL_SECONDS, 900, 86_400, 28_800);
  const token = randomToken("gs_");
  const csrfToken = randomToken("csrf_");
  const expiresAt = new Date(Date.parse(now) + ttl * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, csrf_hash, expires_at, created_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  ).bind(
    crypto.randomUUID(),
    await sha256Hex(token),
    userId,
    await sha256Hex(csrfToken),
    expiresAt,
    now,
  ).run();
  return { token, csrfToken, ttl, expiresAt };
};

const upsertGoogleUser = async (
  db: D1Database,
  identity: GoogleIdentity,
  now: string,
  trialUserId: string | null,
): Promise<string> => {
  const existing = await db.prepare(
    "SELECT user_id FROM user_identities WHERE provider = 'google' AND provider_subject = ?1",
  ).bind(identity.sub).first<{ user_id: string }>();
  if (existing) {
    if (trialUserId && trialUserId !== existing.user_id) {
      await mergeTrialUserIntoGoogle(db, trialUserId, existing.user_id, identity.sub, now);
      return existing.user_id;
    }
    await db.batch([
      db.prepare("UPDATE users SET updated_at = ?1 WHERE id = ?2")
        .bind(now, existing.user_id),
      db.prepare(
        "UPDATE user_identities SET email = NULL, email_verified = 0, updated_at = ?1 WHERE provider = 'google' AND provider_subject = ?2",
      ).bind(now, identity.sub),
    ]);
    return existing.user_id;
  }
  if (trialUserId) {
    const trial = await db.prepare(
      "SELECT id FROM users WHERE id = ?1 AND account_kind = 'trial'",
    ).bind(trialUserId).first<{ id: string }>();
    if (trial) {
      try {
        await db.batch([
          db.prepare("UPDATE users SET account_kind = 'google', updated_at = ?1 WHERE id = ?2 AND account_kind = 'trial'")
            .bind(now, trialUserId),
          db.prepare(
            `INSERT INTO user_identities
              (id, user_id, provider, provider_subject, email, email_verified, created_at, updated_at)
             VALUES (?1, ?2, 'google', ?3, NULL, 0, ?4, ?4)`,
          ).bind(crypto.randomUUID(), trialUserId, identity.sub, now),
          db.prepare("UPDATE sessions SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL")
            .bind(now, trialUserId),
        ]);
        return trialUserId;
      } catch {
        const winner = await db.prepare(
          "SELECT user_id FROM user_identities WHERE provider = 'google' AND provider_subject = ?1",
        ).bind(identity.sub).first<{ user_id: string }>();
        if (winner) {
          await mergeTrialUserIntoGoogle(db, trialUserId, winner.user_id, identity.sub, now);
          return winner.user_id;
        }
        throw new ApiError(500, "IDENTITY_SAVE_FAILED", "Google identity could not be saved.");
      }
    }
  }
  const userId = crypto.randomUUID();
  const publicId = createPublicId();
  try {
    await db.batch([
      db.prepare("INSERT INTO users (id, public_id, display_name, account_kind, created_at, updated_at) VALUES (?1, ?2, ?3, 'google', ?4, ?4)")
        .bind(userId, publicId, anonymousDisplayName("GAIA参加者", publicId), now),
      db.prepare(
        `INSERT INTO user_identities
          (id, user_id, provider, provider_subject, email, email_verified, created_at, updated_at)
         VALUES (?1, ?2, 'google', ?3, NULL, 0, ?4, ?4)`,
      ).bind(crypto.randomUUID(), userId, identity.sub, now),
    ]);
    return userId;
  } catch {
    const winner = await db.prepare(
      "SELECT user_id FROM user_identities WHERE provider = 'google' AND provider_subject = ?1",
    ).bind(identity.sub).first<{ user_id: string }>();
    if (winner) return winner.user_id;
    throw new ApiError(500, "IDENTITY_SAVE_FAILED", "Google identity could not be saved.");
  }
};

const mergeTrialUserIntoGoogle = async (
  db: D1Database,
  trialUserId: string,
  googleUserId: string,
  providerSubject: string,
  now: string,
): Promise<void> => {
  const trial = await db.prepare(
    "SELECT id FROM users WHERE id = ?1 AND account_kind = 'trial'",
  ).bind(trialUserId).first<{ id: string }>();
  if (!trial) {
    await db.prepare("UPDATE users SET updated_at = ?1 WHERE id = ?2").bind(now, googleUserId).run();
    return;
  }
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO sensor_relationships (user_id, device_id, kind, created_at)
       SELECT ?1, device_id, kind, created_at FROM sensor_relationships WHERE user_id = ?2`,
    ).bind(googleUserId, trialUserId),
    db.prepare("DELETE FROM sensor_relationships WHERE user_id = ?1").bind(trialUserId),
    db.prepare("UPDATE devices SET owner_user_id = ?1, updated_at = ?2 WHERE owner_user_id = ?3")
      .bind(googleUserId, now, trialUserId),
    db.prepare("UPDATE device_pairing_codes SET user_id = ?1 WHERE user_id = ?2")
      .bind(googleUserId, trialUserId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(trialUserId),
    db.prepare("DELETE FROM users WHERE id = ?1 AND account_kind = 'trial'").bind(trialUserId),
    db.prepare("UPDATE users SET updated_at = ?1 WHERE id = ?2").bind(now, googleUserId),
    db.prepare(
      "UPDATE user_identities SET email = NULL, email_verified = 0, updated_at = ?1 WHERE provider = 'google' AND provider_subject = ?2",
    ).bind(now, providerSubject),
  ]);
};

const currentTrialUserId = async (request: Request, db: D1Database, now: string): Promise<string | null> => {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token || token.length > 256) return null;
  const row = await db.prepare(
    `SELECT s.user_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2 AND u.account_kind = 'trial'`,
  ).bind(await sha256Hex(token), now).first<{ user_id: string }>();
  return row?.user_id ?? null;
};

const verifyGoogleIdToken = async (token: string, audience: string, nonceHash: string): Promise<GoogleIdentity> => {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new ApiError(401, "INVALID_ID_TOKEN", "ID token is malformed.");
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (!isObject(header) || header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new ApiError(401, "INVALID_ID_TOKEN", "ID token header is invalid.");
  }
  const keysResponse = await fetch(GOOGLE_JWKS_ENDPOINT, { headers: { Accept: "application/json" } });
  if (!keysResponse.ok) throw new ApiError(503, "OIDC_KEYS_UNAVAILABLE", "Google signing keys are unavailable.");
  const keysBody: unknown = await keysResponse.json();
  const keys = isObject(keysBody) && Array.isArray((keysBody as JsonWebKeySet).keys)
    ? (keysBody as { keys: unknown[] }).keys
    : [];
  const jwk = keys.find((candidate): candidate is GoogleJwk =>
    isObject(candidate) && candidate.kid === header.kid && candidate.alg === "RS256" && candidate.use === "sig",
  );
  if (!jwk) throw new ApiError(401, "INVALID_ID_TOKEN", "ID token signing key was not found.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, base64UrlDecode(parts[2]), signed);
  if (!verified || !isObject(claims)) throw new ApiError(401, "INVALID_ID_TOKEN", "ID token signature is invalid.");
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new ApiError(401, "INVALID_ID_TOKEN_ISSUER", "ID token issuer is invalid.");
  if (claims.aud !== audience) throw new ApiError(401, "INVALID_ID_TOKEN_AUDIENCE", "ID token audience is invalid.");
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) throw new ApiError(401, "EXPIRED_ID_TOKEN", "ID token has expired.");
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + 120) throw new ApiError(401, "INVALID_ID_TOKEN_TIME", "ID token issue time is invalid.");
  if (typeof claims.nonce !== "string" || !(await timingSafeHexEqual(await sha256Hex(claims.nonce), nonceHash))) {
    throw new ApiError(401, "INVALID_ID_TOKEN_NONCE", "ID token nonce is invalid.");
  }
  if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 255) throw new ApiError(401, "INVALID_ID_TOKEN_SUBJECT", "ID token subject is invalid.");
  return { sub: claims.sub };
};

const decodeJwtPart = (part: string): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
  } catch {
    return null;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isGoogleTokenResponse = (value: unknown): value is GoogleTokenResponse => isObject(value);
const createPublicId = (): string => `usr_${randomToken().replace(/[^A-Za-z0-9]/gu, "").slice(0, 24).toLowerCase()}`;
const anonymousDisplayName = (prefix: string, publicId: string): string => `${prefix} ${publicId.slice(-4).toUpperCase()}`;
const normalizeReturnPath = (value: string | null): string => value === "/sensors/" ? value : "/sensors/";
const redirectUri = (env: Env): string => new URL("/api/auth/google/callback", env.PUBLIC_ORIGIN).toString();
const boundedInteger = (value: string, minimum: number, maximum: number, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

const requireAuthConfiguration = (env: Env): void => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    throw new ApiError(503, "OIDC_NOT_CONFIGURED", "Google OIDC credentials are not configured.");
  }
};
