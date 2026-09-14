var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/crypto.ts
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var sha256Hex = /* @__PURE__ */ __name(async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}, "sha256Hex");
var hmacHex = /* @__PURE__ */ __name(async (secret, value) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}, "hmacHex");
var timingSafeHexEqual = /* @__PURE__ */ __name(async (left, right) => {
  const leftBytes = hexToBytes(left.padEnd(64, "0").slice(0, 64));
  const rightBytes = hexToBytes(right.padEnd(64, "0").slice(0, 64));
  const comparisonKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("gaia-senseware-fixed-length-comparison-v1"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign("HMAC", comparisonKey, leftBytes);
  const equal = await crypto.subtle.verify("HMAC", comparisonKey, signature, rightBytes);
  return equal && left.length === 64 && right.length === 64;
}, "timingSafeHexEqual");
var randomToken = /* @__PURE__ */ __name((prefix = "") => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}${base64UrlEncode(bytes)}`;
}, "randomToken");
var PAIRING_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
var randomPairingCode = /* @__PURE__ */ __name(() => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const characters = Array.from(bytes, (byte) => PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length]);
  return `${characters.slice(0, 4).join("")}-${characters.slice(4).join("")}`;
}, "randomPairingCode");
var pkceChallenge = /* @__PURE__ */ __name(async (verifier) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}, "pkceChallenge");
var encryptFlowValue = /* @__PURE__ */ __name(async (value, secret) => {
  const key = await deriveAesKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}, "encryptFlowValue");
var decryptFlowValue = /* @__PURE__ */ __name(async (packed, secret) => {
  const [ivPart, ciphertextPart] = packed.split(".");
  if (!ivPart || !ciphertextPart) return null;
  try {
    const key = await deriveAesKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlDecode(ivPart) },
      key,
      base64UrlDecode(ciphertextPart)
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}, "decryptFlowValue");
var base64UrlEncode = /* @__PURE__ */ __name((bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}, "base64UrlEncode");
var base64UrlDecode = /* @__PURE__ */ __name((value) => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}, "base64UrlDecode");
var deriveAesKey = /* @__PURE__ */ __name(async (secret) => {
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(`gaia-oidc-flow:${secret}`));
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}, "deriveAesKey");
var bytesToHex = /* @__PURE__ */ __name((bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""), "bytesToHex");
var hexToBytes = /* @__PURE__ */ __name((hex) => {
  const pairs = hex.match(/.{2}/gu) ?? [];
  const bytes = new Uint8Array(pairs.length);
  pairs.forEach((pair, index) => {
    bytes[index] = Number.parseInt(pair, 16);
  });
  return bytes;
}, "hexToBytes");

// src/http.ts
var ApiError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
  static {
    __name(this, "ApiError");
  }
};
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}, "json");
var errorResponse = /* @__PURE__ */ __name((error, headers = {}) => json({ error: { code: error.code, message: error.message } }, error.status, headers), "errorResponse");
var readJson = /* @__PURE__ */ __name(async (request, maximumBytes) => {
  const type = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isFinite(length) || length < 0 || length > maximumBytes) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Request body must not exceed ${maximumBytes} bytes.`);
    }
  }
  if (!request.body) throw new ApiError(400, "INVALID_JSON", "A JSON request body is required.");
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Request body must not exceed ${maximumBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
}, "readJson");
var readBytes = /* @__PURE__ */ __name(async (request, maximumBytes) => {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null && (!Number.isFinite(Number(declaredLength)) || Number(declaredLength) < 1 || Number(declaredLength) > maximumBytes)) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Request body must not exceed ${maximumBytes} bytes.`);
  }
  if (!request.body) throw new ApiError(400, "EMPTY_BODY", "A request body is required.");
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Request body must not exceed ${maximumBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total < 1) throw new ApiError(400, "EMPTY_BODY", "A request body is required.");
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}, "readBytes");
var isRecord = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null && !Array.isArray(value), "isRecord");
var requireExactKeys = /* @__PURE__ */ __name((value, allowed) => {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new ApiError(400, "UNKNOWN_FIELD", `Unknown field: ${unknown}.`);
}, "requireExactKeys");
var requireString = /* @__PURE__ */ __name((value, field, minimum, maximum) => {
  if (typeof value !== "string") throw new ApiError(400, "INVALID_FIELD", `${field} must be a string.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new ApiError(400, "INVALID_FIELD", `${field} must be between ${minimum} and ${maximum} characters.`);
  }
  return normalized;
}, "requireString");
var optionalString = /* @__PURE__ */ __name((value, field, maximum) => {
  if (value === void 0 || value === null || value === "") return null;
  return requireString(value, field, 1, maximum);
}, "optionalString");
var parseCookies = /* @__PURE__ */ __name((request) => {
  const result = /* @__PURE__ */ new Map();
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    try {
      result.set(key, decodeURIComponent(raw));
    } catch {
    }
  }
  return result;
}, "parseCookies");
var sessionCookie = /* @__PURE__ */ __name((value, maximumAge) => [
  `__Host-gaia_sensor_session=${encodeURIComponent(value)}`,
  "Path=/",
  "HttpOnly",
  "Secure",
  "SameSite=Lax",
  `Max-Age=${maximumAge}`
].filter(Boolean).join("; "), "sessionCookie");
var csrfCookie = /* @__PURE__ */ __name((value, maximumAge) => [
  `__Host-gaia_sensor_csrf=${encodeURIComponent(value)}`,
  "Path=/",
  "Secure",
  "SameSite=Strict",
  `Max-Age=${maximumAge}`
].filter(Boolean).join("; "), "csrfCookie");
var flowCookie = /* @__PURE__ */ __name((value, maximumAge) => [
  `__Host-gaia_sensor_oidc=${encodeURIComponent(value)}`,
  "Path=/",
  "HttpOnly",
  "Secure",
  "SameSite=Lax",
  `Max-Age=${maximumAge}`
].join("; "), "flowCookie");
var clearCookie = /* @__PURE__ */ __name((name, httpOnly) => [
  `${name}=`,
  "Path=/",
  httpOnly ? "HttpOnly" : "",
  "Secure",
  "SameSite=Lax",
  "Max-Age=0"
].filter(Boolean).join("; "), "clearCookie");

// src/auth.ts
var SESSION_COOKIE = "__Host-gaia_sensor_session";
var CSRF_COOKIE = "__Host-gaia_sensor_csrf";
var OIDC_FLOW_COOKIE = "__Host-gaia_sensor_oidc";
var GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
var GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
var FLOW_TTL_SECONDS = 600;
var startGoogleLogin = /* @__PURE__ */ __name(async (request, env) => {
  requireAuthConfiguration(env);
  const requestUrl = new URL(request.url);
  const returnPath = normalizeReturnPath(requestUrl.searchParams.get("returnTo"));
  const state = randomToken("st_");
  const nonce = randomToken("no_");
  const verifier = randomToken("pkce_");
  const now = /* @__PURE__ */ new Date();
  const trialUserId = await currentTrialUserId(request, env.DB, now.toISOString());
  const trialBinding = trialUserId ? await encryptFlowValue(trialUserId, env.SESSION_SECRET) : "";
  const browserBinding = `${randomToken("oidc_")}~${trialBinding}`;
  const expiresAt = new Date(now.getTime() + FLOW_TTL_SECONDS * 1e3).toISOString();
  await env.DB.prepare(
    `INSERT INTO oauth_flows
      (id, state_hash, nonce_hash, browser_binding_hash, verifier_ciphertext, return_path, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(
    crypto.randomUUID(),
    await sha256Hex(state),
    await sha256Hex(nonce),
    await sha256Hex(browserBinding),
    await encryptFlowValue(verifier, env.SESSION_SECRET),
    returnPath,
    expiresAt,
    now.toISOString()
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
    prompt: "select_account"
  }).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": flowCookie(browserBinding, FLOW_TTL_SECONDS) }
  });
}, "startGoogleLogin");
var finishGoogleLogin = /* @__PURE__ */ __name(async (request, env) => {
  requireAuthConfiguration(env);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code || state.length > 512 || code.length > 4096) {
    throw new ApiError(400, "INVALID_OIDC_CALLBACK", "Google login callback is incomplete.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stateHash = await sha256Hex(state);
  const candidate = await env.DB.prepare(
    `SELECT id, nonce_hash, browser_binding_hash, verifier_ciphertext, return_path
     FROM oauth_flows WHERE state_hash = ?1 AND consumed_at IS NULL AND expires_at > ?2`
  ).bind(stateHash, now).first();
  const browserBinding = parseCookies(request).get(OIDC_FLOW_COOKIE) ?? "";
  const browserBindingHash = await sha256Hex(browserBinding);
  if (!candidate || !browserBinding || !await timingSafeHexEqual(browserBindingHash, candidate.browser_binding_hash)) {
    throw new ApiError(400, "INVALID_OIDC_STATE", "Google login state is invalid, expired, or belongs to another browser.");
  }
  const flow = await env.DB.prepare(
    `UPDATE oauth_flows SET consumed_at = ?1
     WHERE id = ?2 AND state_hash = ?3 AND browser_binding_hash = ?4
       AND consumed_at IS NULL AND expires_at > ?1
     RETURNING id, nonce_hash, browser_binding_hash, verifier_ciphertext, return_path`
  ).bind(now, candidate.id, stateHash, browserBindingHash).first();
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
      code_verifier: verifier
    })
  });
  if (!tokenResponse.ok) throw new ApiError(401, "OIDC_TOKEN_EXCHANGE_FAILED", "Google login could not be completed.");
  const tokenBody = await tokenResponse.json();
  const idToken = isGoogleTokenResponse(tokenBody) ? tokenBody.id_token : void 0;
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
}, "finishGoogleLogin");
var getAuthenticatedUser = /* @__PURE__ */ __name(async (request, env) => {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token || token.length > 256) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Login is required.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.user_id, u.display_name, u.account_kind, s.csrf_hash, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2`
  ).bind(await sha256Hex(token), now).first();
  if (!row) throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please log in again.");
  return {
    id: row.user_id,
    displayName: row.display_name,
    accountKind: row.account_kind,
    sessionId: row.session_id,
    csrfHash: row.csrf_hash,
    expiresAt: row.expires_at
  };
}, "getAuthenticatedUser");
var requireCsrf = /* @__PURE__ */ __name(async (request, user) => {
  const cookieToken = parseCookies(request).get(CSRF_COOKIE) ?? "";
  const headerToken = request.headers.get("X-CSRF-Token") ?? "";
  if (!cookieToken || !headerToken || cookieToken.length > 256 || headerToken.length > 256) {
    throw new ApiError(403, "CSRF_VALIDATION_FAILED", "CSRF validation failed.");
  }
  const [cookieHash, headerHash] = await Promise.all([sha256Hex(cookieToken), sha256Hex(headerToken)]);
  if (!await timingSafeHexEqual(cookieHash, headerHash) || !await timingSafeHexEqual(cookieHash, user.csrfHash)) {
    throw new ApiError(403, "CSRF_VALIDATION_FAILED", "CSRF validation failed.");
  }
}, "requireCsrf");
var sessionResponse = /* @__PURE__ */ __name(async (request, env) => {
  const user = await getAuthenticatedUser(request, env);
  const rotatedToken = randomToken("gs_");
  const now = /* @__PURE__ */ new Date();
  const rotated = await env.DB.prepare(
    `UPDATE sessions SET token_hash = ?1, last_seen_at = ?2
     WHERE id = ?3 AND user_id = ?4 AND revoked_at IS NULL AND expires_at > ?2`
  ).bind(await sha256Hex(rotatedToken), now.toISOString(), user.sessionId, user.id).run();
  if (rotated.meta.changes !== 1) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Session is no longer active.");
  const remainingSeconds = Math.max(1, Math.floor((Date.parse(user.expiresAt) - now.getTime()) / 1e3));
  const headers = new Headers({ "Set-Cookie": sessionCookie(rotatedToken, remainingSeconds) });
  return json({ user: { id: user.id, displayName: user.displayName, accountKind: user.accountKind }, expiresAt: user.expiresAt }, 200, headers);
}, "sessionResponse");
var startTrialSession = /* @__PURE__ */ __name(async (request, env) => {
  if (request.headers.get("Origin") !== env.WEB_ORIGIN) {
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(
    `DELETE FROM users
     WHERE account_kind = 'trial'
       AND NOT EXISTS (
         SELECT 1 FROM sessions
         WHERE sessions.user_id = users.id
           AND sessions.revoked_at IS NULL
           AND sessions.expires_at > ?1
       )`
  ).bind(now).run();
  const userId = crypto.randomUUID();
  const publicId = createPublicId();
  const displayName = anonymousDisplayName("\u304A\u305F\u3081\u3057\u53C2\u52A0\u8005", publicId);
  await env.DB.prepare(
    `INSERT INTO users (id, public_id, display_name, account_kind, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'trial', ?4, ?4)`
  ).bind(userId, publicId, displayName, now).run();
  const session = await createSession(env, userId, now);
  const headers = new Headers();
  headers.append("Set-Cookie", sessionCookie(session.token, session.ttl));
  headers.append("Set-Cookie", csrfCookie(session.csrfToken, session.ttl));
  return json({
    user: { id: userId, displayName, accountKind: "trial" },
    expiresAt: session.expiresAt
  }, 201, headers);
}, "startTrialSession");
var logout = /* @__PURE__ */ __name(async (request, env) => {
  const user = await getAuthenticatedUser(request, env);
  await requireCsrf(request, user);
  if (user.accountKind === "trial") {
    await env.DB.prepare("DELETE FROM users WHERE id = ?1 AND account_kind = 'trial'").bind(user.id).run();
  } else {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE id = ?2 AND user_id = ?3").bind((/* @__PURE__ */ new Date()).toISOString(), user.sessionId, user.id).run();
  }
  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE, true));
  headers.append("Set-Cookie", clearCookie(CSRF_COOKIE, false));
  return json({ ok: true, accountDeleted: user.accountKind === "trial" }, 200, headers);
}, "logout");
var createSession = /* @__PURE__ */ __name(async (env, userId, now) => {
  const ttl = boundedInteger(env.SESSION_TTL_SECONDS, 900, 86400, 28800);
  const token = randomToken("gs_");
  const csrfToken = randomToken("csrf_");
  const expiresAt = new Date(Date.parse(now) + ttl * 1e3).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, csrf_hash, expires_at, created_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`
  ).bind(
    crypto.randomUUID(),
    await sha256Hex(token),
    userId,
    await sha256Hex(csrfToken),
    expiresAt,
    now
  ).run();
  return { token, csrfToken, ttl, expiresAt };
}, "createSession");
var upsertGoogleUser = /* @__PURE__ */ __name(async (db, identity, now, trialUserId) => {
  const existing = await db.prepare(
    "SELECT user_id FROM user_identities WHERE provider = 'google' AND provider_subject = ?1"
  ).bind(identity.sub).first();
  if (existing) {
    if (trialUserId && trialUserId !== existing.user_id) {
      await mergeTrialUserIntoGoogle(db, trialUserId, existing.user_id, identity.sub, now);
      return existing.user_id;
    }
    await db.batch([
      db.prepare("UPDATE users SET updated_at = ?1 WHERE id = ?2").bind(now, existing.user_id),
      db.prepare(
        "UPDATE user_identities SET email = NULL, email_verified = 0, updated_at = ?1 WHERE provider = 'google' AND provider_subject = ?2"
      ).bind(now, identity.sub)
    ]);
    return existing.user_id;
  }
  if (trialUserId) {
    const trial = await db.prepare(
      "SELECT id FROM users WHERE id = ?1 AND account_kind = 'trial'"
    ).bind(trialUserId).first();
    if (trial) {
      try {
        await db.batch([
          db.prepare("UPDATE users SET account_kind = 'google', updated_at = ?1 WHERE id = ?2 AND account_kind = 'trial'").bind(now, trialUserId),
          db.prepare(
            `INSERT INTO user_identities
              (id, user_id, provider, provider_subject, email, email_verified, created_at, updated_at)
             VALUES (?1, ?2, 'google', ?3, NULL, 0, ?4, ?4)`
          ).bind(crypto.randomUUID(), trialUserId, identity.sub, now),
          db.prepare("UPDATE sessions SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL").bind(now, trialUserId)
        ]);
        return trialUserId;
      } catch {
        const winner = await db.prepare(
          "SELECT user_id FROM user_identities WHERE provider = 'google' AND provider_subject = ?1"
        ).bind(identity.sub).first();
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
      db.prepare("INSERT INTO users (id, public_id, display_name, account_kind, created_at, updated_at) VALUES (?1, ?2, ?3, 'google', ?4, ?4)").bind(userId, publicId, anonymousDisplayName("GAIA\u53C2\u52A0\u8005", publicId), now),
      db.prepare(
        `INSERT INTO user_identities
          (id, user_id, provider, provider_subject, email, email_verified, created_at, updated_at)
         VALUES (?1, ?2, 'google', ?3, NULL, 0, ?4, ?4)`
      ).bind(crypto.randomUUID(), userId, identity.sub, now)
    ]);
    return userId;
  } catch {
    const winner = await db.prepare(
      "SELECT user_id FROM user_identities WHERE provider = 'google' AND provider_subject = ?1"
    ).bind(identity.sub).first();
    if (winner) return winner.user_id;
    throw new ApiError(500, "IDENTITY_SAVE_FAILED", "Google identity could not be saved.");
  }
}, "upsertGoogleUser");
var mergeTrialUserIntoGoogle = /* @__PURE__ */ __name(async (db, trialUserId, googleUserId, providerSubject, now) => {
  const trial = await db.prepare(
    "SELECT id FROM users WHERE id = ?1 AND account_kind = 'trial'"
  ).bind(trialUserId).first();
  if (!trial) {
    await db.prepare("UPDATE users SET updated_at = ?1 WHERE id = ?2").bind(now, googleUserId).run();
    return;
  }
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO sensor_relationships (user_id, device_id, kind, created_at)
       SELECT ?1, device_id, kind, created_at FROM sensor_relationships WHERE user_id = ?2`
    ).bind(googleUserId, trialUserId),
    db.prepare("DELETE FROM sensor_relationships WHERE user_id = ?1").bind(trialUserId),
    db.prepare("UPDATE devices SET owner_user_id = ?1, updated_at = ?2 WHERE owner_user_id = ?3").bind(googleUserId, now, trialUserId),
    db.prepare("UPDATE device_pairing_codes SET user_id = ?1 WHERE user_id = ?2").bind(googleUserId, trialUserId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(trialUserId),
    db.prepare("DELETE FROM users WHERE id = ?1 AND account_kind = 'trial'").bind(trialUserId),
    db.prepare("UPDATE users SET updated_at = ?1 WHERE id = ?2").bind(now, googleUserId),
    db.prepare(
      "UPDATE user_identities SET email = NULL, email_verified = 0, updated_at = ?1 WHERE provider = 'google' AND provider_subject = ?2"
    ).bind(now, providerSubject)
  ]);
}, "mergeTrialUserIntoGoogle");
var currentTrialUserId = /* @__PURE__ */ __name(async (request, db, now) => {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token || token.length > 256) return null;
  const row = await db.prepare(
    `SELECT s.user_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2 AND u.account_kind = 'trial'`
  ).bind(await sha256Hex(token), now).first();
  return row?.user_id ?? null;
}, "currentTrialUserId");
var verifyGoogleIdToken = /* @__PURE__ */ __name(async (token, audience, nonceHash) => {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new ApiError(401, "INVALID_ID_TOKEN", "ID token is malformed.");
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (!isObject(header) || header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new ApiError(401, "INVALID_ID_TOKEN", "ID token header is invalid.");
  }
  const keysResponse = await fetch(GOOGLE_JWKS_ENDPOINT, { headers: { Accept: "application/json" } });
  if (!keysResponse.ok) throw new ApiError(503, "OIDC_KEYS_UNAVAILABLE", "Google signing keys are unavailable.");
  const keysBody = await keysResponse.json();
  const keys = isObject(keysBody) && Array.isArray(keysBody.keys) ? keysBody.keys : [];
  const jwk = keys.find(
    (candidate) => isObject(candidate) && candidate.kid === header.kid && candidate.alg === "RS256" && candidate.use === "sig"
  );
  if (!jwk) throw new ApiError(401, "INVALID_ID_TOKEN", "ID token signing key was not found.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, base64UrlDecode(parts[2]), signed);
  if (!verified || !isObject(claims)) throw new ApiError(401, "INVALID_ID_TOKEN", "ID token signature is invalid.");
  const nowSeconds = Math.floor(Date.now() / 1e3);
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new ApiError(401, "INVALID_ID_TOKEN_ISSUER", "ID token issuer is invalid.");
  if (claims.aud !== audience) throw new ApiError(401, "INVALID_ID_TOKEN_AUDIENCE", "ID token audience is invalid.");
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) throw new ApiError(401, "EXPIRED_ID_TOKEN", "ID token has expired.");
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + 120) throw new ApiError(401, "INVALID_ID_TOKEN_TIME", "ID token issue time is invalid.");
  if (typeof claims.nonce !== "string" || !await timingSafeHexEqual(await sha256Hex(claims.nonce), nonceHash)) {
    throw new ApiError(401, "INVALID_ID_TOKEN_NONCE", "ID token nonce is invalid.");
  }
  if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 255) throw new ApiError(401, "INVALID_ID_TOKEN_SUBJECT", "ID token subject is invalid.");
  return { sub: claims.sub };
}, "verifyGoogleIdToken");
var decodeJwtPart = /* @__PURE__ */ __name((part) => {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
  } catch {
    return null;
  }
}, "decodeJwtPart");
var isObject = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null && !Array.isArray(value), "isObject");
var isGoogleTokenResponse = /* @__PURE__ */ __name((value) => isObject(value), "isGoogleTokenResponse");
var createPublicId = /* @__PURE__ */ __name(() => `usr_${randomToken().replace(/[^A-Za-z0-9]/gu, "").slice(0, 24).toLowerCase()}`, "createPublicId");
var anonymousDisplayName = /* @__PURE__ */ __name((prefix, publicId) => `${prefix} ${publicId.slice(-4).toUpperCase()}`, "anonymousDisplayName");
var normalizeReturnPath = /* @__PURE__ */ __name((value) => value === "/sensors/" ? value : "/sensors/", "normalizeReturnPath");
var redirectUri = /* @__PURE__ */ __name((env) => new URL("/api/auth/google/callback", env.PUBLIC_ORIGIN).toString(), "redirectUri");
var boundedInteger = /* @__PURE__ */ __name((value, minimum, maximum, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}, "boundedInteger");
var requireAuthConfiguration = /* @__PURE__ */ __name((env) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    throw new ApiError(503, "OIDC_NOT_CONFIGURED", "Google OIDC credentials are not configured.");
  }
}, "requireAuthConfiguration");

// src/measurements.ts
var MEASUREMENT_CATEGORIES = Object.freeze([
  { id: "atmosphere", labelJa: "\u5927\u6C17\u30FB\u7A7A\u6C17\u8CEA", labelEn: "AIR", descriptionJa: "\u6C17\u6E29\u3001\u6E7F\u5EA6\u3001\u7C92\u5B50\u3001\u30AC\u30B9\u3001\u6C17\u5727\u3092\u89B3\u6E2C\u3057\u307E\u3059\u3002" },
  { id: "weather", labelJa: "\u6C17\u8C61\u30FB\u5149\u30FB\u97F3", labelEn: "WEATHER / LIGHT / SOUND", descriptionJa: "\u96E8\u3001\u98A8\u3001\u65E5\u5C04\u3001\u7D2B\u5916\u7DDA\u3001\u7167\u5EA6\u3001\u9A12\u97F3\u3092\u89B3\u6E2C\u3057\u307E\u3059\u3002" },
  { id: "water", labelJa: "\u6C34\u30FB\u6C34\u8CEA", labelEn: "WATER", descriptionJa: "\u6C34\u6E29\u3001pH\u3001\u6FC1\u5EA6\u3001\u6EB6\u5B58\u9178\u7D20\u3001\u6C34\u4F4D\u3001\u6D41\u91CF\u306A\u3069\u3092\u89B3\u6E2C\u3057\u307E\u3059\u3002" },
  { id: "soil", labelJa: "\u571F\u58CC\u30FB\u690D\u7269", labelEn: "SOIL / PLANT", descriptionJa: "\u571F\u306E\u6E29\u6E7F\u5EA6\u3001EC\u3001pH\u3001\u8449\u9762\u306E\u6FE1\u308C\u3092\u89B3\u6E2C\u3057\u307E\u3059\u3002" },
  { id: "motion", labelJa: "\u52D5\u304D\u30FB\u8DDD\u96E2\u30FB\u78C1\u6C17", labelEn: "MOTION / POSITION", descriptionJa: "\u52A0\u901F\u5EA6\u3001\u89D2\u901F\u5EA6\u3001\u78C1\u5834\u3001\u632F\u52D5\u3001\u8DDD\u96E2\u3001\u901A\u904E\u6570\u3092\u89B3\u6E2C\u3057\u307E\u3059\u3002" },
  { id: "energy", labelJa: "\u96FB\u6C17\u30FB\u88C5\u7F6E\u72B6\u614B", labelEn: "ENERGY / DEVICE", descriptionJa: "\u96FB\u5727\u3001\u96FB\u6D41\u3001\u96FB\u529B\u3001\u96FB\u6C60\u6B8B\u91CF\u3001\u7121\u7DDA\u5F37\u5EA6\u3092\u89B3\u6E2C\u3057\u307E\u3059\u3002" },
  { id: "radiation", labelJa: "\u653E\u5C04\u7DDA\u30FB\u96FB\u78C1\u74B0\u5883", labelEn: "RADIATION / EM", descriptionJa: "\u7DDA\u91CF\u7387\u3001\u96FB\u754C\u3001\u96FB\u6CE2\u30CE\u30A4\u30BA\u306A\u3069\u3092\u89B3\u6E2C\u3057\u307E\u3059\u3002" }
]);
var measurement = /* @__PURE__ */ __name((key, category, labelJa, labelEn, unit, digits, minimum, maximum, interfaces, exampleSensors, noteJa) => ({ key, category, labelJa, labelEn, unit, digits, minimum, maximum, interfaces, exampleSensors, ...noteJa ? { noteJa } : {} }), "measurement");
var MEASUREMENT_CATALOG = Object.freeze([
  measurement("temperature", "atmosphere", "\u6C17\u6E29", "Air temperature", "\xB0C", 1, -80, 100, ["I2C", "1-Wire", "UART"], ["BME280", "SHT31/SHT4x", "DS18B20"]),
  measurement("humidity", "atmosphere", "\u76F8\u5BFE\u6E7F\u5EA6", "Relative humidity", "%RH", 1, 0, 100, ["I2C", "UART"], ["BME280", "SHT31/SHT4x", "AHT20"]),
  measurement("pressure", "atmosphere", "\u6C17\u5727", "Atmospheric pressure", "hPa", 1, 300, 1200, ["I2C", "SPI"], ["BMP280", "BME280", "BMP390"]),
  measurement("pm1", "atmosphere", "PM1.0", "PM1.0", "\xB5g/m\xB3", 1, 0, 5e3, ["UART", "I2C"], ["PMS5003/PMSA003", "SPS30"]),
  measurement("pm25", "atmosphere", "PM2.5", "PM2.5", "\xB5g/m\xB3", 1, 0, 5e3, ["UART", "I2C"], ["PMS5003/PMSA003", "SPS30"]),
  measurement("pm10", "atmosphere", "PM10", "PM10", "\xB5g/m\xB3", 1, 0, 5e3, ["UART", "I2C"], ["PMS5003/PMSA003", "SPS30"]),
  measurement("co2", "atmosphere", "CO\u2082\u6FC3\u5EA6", "Carbon dioxide", "ppm", 0, 0, 1e5, ["I2C", "UART", "PWM"], ["SCD30/SCD4x", "MH-Z19B"]),
  measurement("tvoc", "atmosphere", "\u7DCFVOC", "Total VOC", "ppb", 0, 0, 1e5, ["I2C"], ["SGP30/SGP40", "BME680/BME688"]),
  measurement("voc", "atmosphere", "VOC", "Volatile organic compounds", "ppb", 0, 0, 1e5, ["I2C", "ADC"], ["SGP40", "BME688", "\u30AC\u30B9\u30BB\u30F3\u30B5\u30FC\uFF0B\u4FE1\u53F7\u8ABF\u6574\u56DE\u8DEF"]),
  measurement("nox", "atmosphere", "NOx\u6307\u6A19", "NOx index", "index", 1, 0, 1e5, ["I2C"], ["SGP41"]),
  measurement("no2", "atmosphere", "\u4E8C\u9178\u5316\u7A92\u7D20", "Nitrogen dioxide", "ppb", 1, 0, 2e4, ["ADC", "UART"], ["\u96FB\u6C17\u5316\u5B66\u5F0FNO\u2082\u30BB\u30F3\u30B5\u30FC\uFF0BAFE"]),
  measurement("co", "atmosphere", "\u4E00\u9178\u5316\u70AD\u7D20", "Carbon monoxide", "ppm", 2, 0, 1e4, ["ADC", "UART"], ["\u96FB\u6C17\u5316\u5B66\u5F0FCO\u30BB\u30F3\u30B5\u30FC\uFF0BAFE"]),
  measurement("o3", "atmosphere", "\u30AA\u30BE\u30F3", "Ozone", "ppb", 1, 0, 2e4, ["ADC", "UART"], ["\u96FB\u6C17\u5316\u5B66\u5F0FO\u2083\u30BB\u30F3\u30B5\u30FC\uFF0BAFE"]),
  measurement("so2", "atmosphere", "\u4E8C\u9178\u5316\u786B\u9EC4", "Sulfur dioxide", "ppb", 1, 0, 2e4, ["ADC", "UART"], ["\u96FB\u6C17\u5316\u5B66\u5F0FSO\u2082\u30BB\u30F3\u30B5\u30FC\uFF0BAFE"]),
  measurement("nh3", "atmosphere", "\u30A2\u30F3\u30E2\u30CB\u30A2", "Ammonia", "ppm", 2, 0, 1e4, ["ADC", "UART"], ["\u96FB\u6C17\u5316\u5B66\u5F0FNH\u2083\u30BB\u30F3\u30B5\u30FC\uFF0BAFE"]),
  measurement("h2s", "atmosphere", "\u786B\u5316\u6C34\u7D20", "Hydrogen sulfide", "ppm", 2, 0, 1e4, ["ADC", "UART"], ["\u96FB\u6C17\u5316\u5B66\u5F0FH\u2082S\u30BB\u30F3\u30B5\u30FC\uFF0BAFE"]),
  measurement("formaldehyde", "atmosphere", "\u30DB\u30EB\u30E0\u30A2\u30EB\u30C7\u30D2\u30C9", "Formaldehyde", "mg/m\xB3", 3, 0, 100, ["UART", "ADC"], ["HCHO\u30BB\u30F3\u30B5\u30FC\u30E2\u30B8\u30E5\u30FC\u30EB"]),
  measurement("rainfall", "weather", "\u7A4D\u7B97\u96E8\u91CF", "Accumulated rainfall", "mm", 1, 0, 1e5, ["Pulse", "GPIO"], ["\u8EE2\u5012\u307E\u3059\u578B\u96E8\u91CF\u8A08"]),
  measurement("rainfall_rate", "weather", "\u964D\u96E8\u5F37\u5EA6", "Rainfall rate", "mm/h", 1, 0, 2e3, ["Pulse", "GPIO"], ["\u8EE2\u5012\u307E\u3059\u578B\u96E8\u91CF\u8A08"]),
  measurement("wind_speed", "weather", "\u98A8\u901F", "Wind speed", "m/s", 1, 0, 150, ["Pulse", "ADC", "RS-485"], ["\u30AB\u30C3\u30D7\u5F0F\u98A8\u901F\u8A08", "\u8D85\u97F3\u6CE2\u98A8\u901F\u8A08"]),
  measurement("wind_direction", "weather", "\u98A8\u5411", "Wind direction", "\xB0", 0, 0, 360, ["ADC", "I2C", "RS-485"], ["\u98A8\u5411\u30D9\u30FC\u30F3", "\u8D85\u97F3\u6CE2\u98A8\u5411\u98A8\u901F\u8A08"]),
  measurement("illuminance", "weather", "\u7167\u5EA6", "Illuminance", "lx", 0, 0, 1e6, ["I2C", "ADC"], ["BH1750", "VEML7700", "TSL2591"]),
  measurement("uv_index", "weather", "UV\u6307\u6570", "UV index", "index", 1, 0, 30, ["I2C", "ADC"], ["VEML6075", "LTR390"]),
  measurement("solar_irradiance", "weather", "\u65E5\u5C04\u91CF", "Solar irradiance", "W/m\xB2", 1, 0, 2500, ["ADC", "RS-485"], ["\u65E5\u5C04\u8A08\uFF0B\u4FE1\u53F7\u5909\u63DB\u5668"]),
  measurement("noise_db", "weather", "\u9A12\u97F3\u30EC\u30D9\u30EB", "Sound pressure level", "dB", 1, 0, 180, ["I2S", "ADC"], ["I2S MEMS\u30DE\u30A4\u30AF", "\u9A12\u97F3\u8A08\u30E2\u30B8\u30E5\u30FC\u30EB"], "\u6821\u6B63\u3057\u306A\u3044\u5024\u306F\u6CD5\u5B9A\u9A12\u97F3\u6E2C\u5B9A\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002"),
  measurement("lightning_distance", "weather", "\u96F7\u63A8\u5B9A\u8DDD\u96E2", "Lightning distance", "km", 0, 0, 1e3, ["SPI", "I2C"], ["AS3935"]),
  measurement("water_temperature", "water", "\u6C34\u6E29", "Water temperature", "\xB0C", 1, -20, 120, ["1-Wire", "I2C", "RS-485"], ["\u9632\u6C34DS18B20", "PT100/PT1000\uFF0B\u5909\u63DB\u5668"]),
  measurement("ph", "water", "pH", "pH", "pH", 2, 0, 14, ["ADC", "I2C", "UART", "RS-485"], ["pH\u96FB\u6975\uFF0B\u7D76\u7E01\u5BFE\u5FDC\u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9"]),
  measurement("conductivity", "water", "\u96FB\u6C17\u4F1D\u5C0E\u7387", "Electrical conductivity", "\xB5S/cm", 0, 0, 2e5, ["I2C", "UART", "RS-485", "ADC"], ["EC\u30D7\u30ED\u30FC\u30D6\uFF0B\u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9"]),
  measurement("tds", "water", "\u6EB6\u89E3\u6027\u7269\u8CEA\u6FC3\u5EA6", "Total dissolved solids", "ppm", 0, 0, 1e5, ["ADC", "UART", "RS-485"], ["TDS\u30D7\u30ED\u30FC\u30D6\uFF0B\u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9"]),
  measurement("turbidity", "water", "\u6FC1\u5EA6", "Turbidity", "NTU", 1, 0, 1e4, ["ADC", "UART", "RS-485"], ["\u5149\u5B66\u5F0F\u6FC1\u5EA6\u30BB\u30F3\u30B5\u30FC"]),
  measurement("dissolved_oxygen", "water", "\u6EB6\u5B58\u9178\u7D20", "Dissolved oxygen", "mg/L", 2, 0, 100, ["I2C", "UART", "RS-485", "ADC"], ["DO\u30D7\u30ED\u30FC\u30D6\uFF0B\u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9"]),
  measurement("orp", "water", "\u9178\u5316\u9084\u5143\u96FB\u4F4D", "Oxidation-reduction potential", "mV", 0, -2e3, 2e3, ["ADC", "I2C", "UART"], ["ORP\u96FB\u6975\uFF0B\u9AD8\u30A4\u30F3\u30D4\u30FC\u30C0\u30F3\u30B9AFE"]),
  measurement("salinity", "water", "\u5869\u5206", "Salinity", "PSU", 2, 0, 100, ["UART", "RS-485", "I2C"], ["\u5869\u5206\u30FBEC\u30D7\u30ED\u30FC\u30D6"]),
  measurement("water_level", "water", "\u6C34\u4F4D", "Water level", "cm", 1, -1e4, 1e5, ["ADC", "I2C", "UART", "RS-485"], ["\u5727\u529B\u5F0F\u6C34\u4F4D\u8A08", "\u8D85\u97F3\u6CE2\u8DDD\u96E2\u8A08", "\u30D5\u30ED\u30FC\u30C8"]),
  measurement("groundwater_level", "water", "\u5730\u4E0B\u6C34\u4F4D", "Groundwater level", "m", 2, -1e4, 1e4, ["ADC", "RS-485"], ["\u6295\u8FBC\u5F0F\u6C34\u4F4D\u8A08"]),
  measurement("flow_rate", "water", "\u6D41\u91CF", "Flow rate", "L/min", 2, 0, 1e5, ["Pulse", "UART", "RS-485"], ["\u30DB\u30FC\u30EB\u5F0F\u6D41\u91CF\u30BB\u30F3\u30B5\u30FC", "\u96FB\u78C1\u6D41\u91CF\u8A08"]),
  measurement("water_pressure", "water", "\u6C34\u5727", "Water pressure", "kPa", 1, -100, 1e5, ["ADC", "I2C", "RS-485"], ["\u5727\u529B\u30C8\u30E9\u30F3\u30B9\u30C7\u30E5\u30FC\u30B5\u30FC"]),
  measurement("nitrate", "water", "\u785D\u9178\u614B\u7A92\u7D20", "Nitrate", "mg/L", 2, 0, 1e4, ["UART", "RS-485", "I2C"], ["\u30A4\u30AA\u30F3\u9078\u629E\u96FB\u6975\uFF0B\u8A08\u6E2C\u56DE\u8DEF"]),
  measurement("ammonium", "water", "\u30A2\u30F3\u30E2\u30CB\u30A6\u30E0", "Ammonium", "mg/L", 2, 0, 1e4, ["UART", "RS-485", "I2C"], ["\u30A4\u30AA\u30F3\u9078\u629E\u96FB\u6975\uFF0B\u8A08\u6E2C\u56DE\u8DEF"]),
  measurement("soil_temperature", "soil", "\u5730\u6E29", "Soil temperature", "\xB0C", 1, -50, 100, ["1-Wire", "I2C", "RS-485"], ["\u9632\u6C34DS18B20", "\u571F\u58CC\u6E29\u5EA6\u30D7\u30ED\u30FC\u30D6"]),
  measurement("soil_moisture", "soil", "\u571F\u58CC\u542B\u6C34\u7387", "Soil moisture", "%", 1, 0, 100, ["ADC", "I2C", "RS-485"], ["\u9759\u96FB\u5BB9\u91CF\u5F0F\u571F\u58CC\u6C34\u5206\u30BB\u30F3\u30B5\u30FC"]),
  measurement("soil_ec", "soil", "\u571F\u58CCEC", "Soil electrical conductivity", "\xB5S/cm", 0, 0, 2e5, ["RS-485", "UART", "ADC"], ["\u571F\u58CCEC\u30D7\u30ED\u30FC\u30D6"]),
  measurement("soil_ph", "soil", "\u571F\u58CCpH", "Soil pH", "pH", 2, 0, 14, ["RS-485", "UART", "ADC"], ["\u571F\u58CCpH\u30D7\u30ED\u30FC\u30D6"]),
  measurement("leaf_wetness", "soil", "\u8449\u9762\u6FE1\u308C", "Leaf wetness", "%", 1, 0, 100, ["ADC", "I2C"], ["\u8449\u9762\u6FE1\u308C\u30BB\u30F3\u30B5\u30FC"]),
  measurement("acceleration_x", "motion", "X\u8EF8\u52A0\u901F\u5EA6", "X acceleration", "m/s\xB2", 2, -1e3, 1e3, ["I2C", "SPI"], ["MPU6050", "LIS3DH", "ICM-20948"]),
  measurement("acceleration_y", "motion", "Y\u8EF8\u52A0\u901F\u5EA6", "Y acceleration", "m/s\xB2", 2, -1e3, 1e3, ["I2C", "SPI"], ["MPU6050", "LIS3DH", "ICM-20948"]),
  measurement("acceleration_z", "motion", "Z\u8EF8\u52A0\u901F\u5EA6", "Z acceleration", "m/s\xB2", 2, -1e3, 1e3, ["I2C", "SPI"], ["MPU6050", "LIS3DH", "ICM-20948"]),
  measurement("gyro_x", "motion", "X\u8EF8\u89D2\u901F\u5EA6", "X angular velocity", "\xB0/s", 1, -2e4, 2e4, ["I2C", "SPI"], ["MPU6050", "ICM-20948"]),
  measurement("gyro_y", "motion", "Y\u8EF8\u89D2\u901F\u5EA6", "Y angular velocity", "\xB0/s", 1, -2e4, 2e4, ["I2C", "SPI"], ["MPU6050", "ICM-20948"]),
  measurement("gyro_z", "motion", "Z\u8EF8\u89D2\u901F\u5EA6", "Z angular velocity", "\xB0/s", 1, -2e4, 2e4, ["I2C", "SPI"], ["MPU6050", "ICM-20948"]),
  measurement("magnetic_x", "motion", "X\u8EF8\u78C1\u675F\u5BC6\u5EA6", "X magnetic flux density", "\xB5T", 2, -5e4, 5e4, ["I2C", "SPI"], ["LIS3MDL", "MMC5603", "ICM-20948"]),
  measurement("magnetic_y", "motion", "Y\u8EF8\u78C1\u675F\u5BC6\u5EA6", "Y magnetic flux density", "\xB5T", 2, -5e4, 5e4, ["I2C", "SPI"], ["LIS3MDL", "MMC5603", "ICM-20948"]),
  measurement("magnetic_z", "motion", "Z\u8EF8\u78C1\u675F\u5BC6\u5EA6", "Z magnetic flux density", "\xB5T", 2, -5e4, 5e4, ["I2C", "SPI"], ["LIS3MDL", "MMC5603", "ICM-20948"]),
  measurement("geomagnetic", "motion", "\u5730\u78C1\u6C17\u5909\u52D5", "Geomagnetic variation", "\xB5T", 2, -5e4, 5e4, ["I2C", "SPI"], ["LIS3MDL", "MMC5603"]),
  measurement("distance", "motion", "\u8DDD\u96E2", "Distance", "cm", 1, 0, 1e6, ["GPIO", "I2C", "UART"], ["HC-SR04\uFF083.3V\u30EC\u30D9\u30EB\u5909\u63DB\u5FC5\u9808\uFF09", "VL53L0X/VL53L1X"]),
  measurement("vibration_rms", "motion", "\u632F\u52D5RMS", "Vibration RMS", "m/s\xB2", 3, 0, 1e3, ["I2C", "SPI", "ADC"], ["\u52A0\u901F\u5EA6\u30BB\u30F3\u30B5\u30FC"]),
  measurement("occupancy", "motion", "\u5728\u5BA4\u30FB\u691C\u77E5\u72B6\u614B", "Occupancy", "0/1", 0, 0, 1, ["GPIO", "UART"], ["PIR", "mmWave\u30EC\u30FC\u30C0\u30FC"]),
  measurement("pulse_count", "motion", "\u30D1\u30EB\u30B9\u6570", "Pulse count", "count", 0, 0, 1e9, ["Pulse", "GPIO"], ["\u63A5\u70B9\u5165\u529B", "\u56DE\u8EE2\u30FB\u901A\u904E\u30AB\u30A6\u30F3\u30BF\u30FC"]),
  measurement("voltage", "energy", "\u96FB\u5727", "Voltage", "V", 3, -1e5, 1e5, ["I2C", "ADC", "UART", "RS-485"], ["INA219/INA226", "\u7D76\u7E01\u8A08\u6E2C\u30E2\u30B8\u30E5\u30FC\u30EB"]),
  measurement("current", "energy", "\u96FB\u6D41", "Current", "A", 3, -1e5, 1e5, ["I2C", "ADC", "UART", "RS-485"], ["INA219/INA226", "\u30DB\u30FC\u30EB\u96FB\u6D41\u30BB\u30F3\u30B5\u30FC"]),
  measurement("power", "energy", "\u96FB\u529B", "Power", "W", 2, -1e6, 1e6, ["I2C", "UART", "RS-485"], ["INA219/INA226", "\u96FB\u529B\u8A08\u30E2\u30B8\u30E5\u30FC\u30EB"]),
  measurement("energy", "energy", "\u7A4D\u7B97\u96FB\u529B\u91CF", "Energy", "Wh", 1, 0, 1e12, ["UART", "RS-485"], ["\u96FB\u529B\u91CF\u8A08\u30E2\u30B8\u30E5\u30FC\u30EB"], "\u5546\u7528\u96FB\u6E90\u306E\u8A08\u6E2C\u306F\u611F\u96FB\u30FB\u706B\u707D\u9632\u6B62\u306E\u305F\u3081\u6709\u8CC7\u683C\u8005\u3068\u7D76\u7E01\u6E08\u307F\u88FD\u54C1\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002"),
  measurement("battery_voltage", "energy", "\u96FB\u6C60\u96FB\u5727", "Battery voltage", "V", 3, 0, 1e3, ["ADC", "I2C"], ["\u5206\u5727\u56DE\u8DEF", "\u71C3\u6599\u8A08IC"]),
  measurement("battery_percent", "energy", "\u96FB\u6C60\u6B8B\u91CF", "Battery charge", "%", 0, 0, 100, ["I2C", "ADC"], ["MAX17048/MAX1704x", "\u71C3\u6599\u8A08IC"]),
  measurement("rssi", "energy", "Wi-Fi\u53D7\u4FE1\u5F37\u5EA6", "Wi-Fi RSSI", "dBm", 0, -127, 0, ["ESP32 internal"], ["WiFi.RSSI()"]),
  measurement("radiation_dose_rate", "radiation", "\u653E\u5C04\u7DDA\u91CF\u7387", "Radiation dose rate", "\xB5Sv/h", 3, 0, 1e6, ["Pulse", "UART"], ["\u30AC\u30A4\u30AC\u30FC\u8A08\u6570\u7BA1\uFF0B\u9AD8\u96FB\u5727\u30E2\u30B8\u30E5\u30FC\u30EB"], "\u9AD8\u96FB\u5727\u56DE\u8DEF\u3068\u6821\u6B63\u304C\u5FC5\u8981\u3067\u3059\u3002\u5B89\u5168\u76E3\u8996\u30FB\u7DDA\u91CF\u7BA1\u7406\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002"),
  measurement("electric_field", "radiation", "\u96FB\u754C\u5F37\u5EA6", "Electric field strength", "kV/m", 3, -1e6, 1e6, ["ADC", "UART", "RS-485"], ["\u96FB\u754C\u30BB\u30F3\u30B5\u30FC\uFF0B\u7D76\u7E01\u30A4\u30F3\u30BF\u30FC\u30D5\u30A7\u30FC\u30B9"]),
  measurement("radio_noise", "radiation", "\u96FB\u6CE2\u30CE\u30A4\u30BA", "Radio noise", "dBm", 1, -200, 100, ["SPI", "UART", "I2C"], ["RF\u691C\u6CE2\u5668", "\u53D7\u4FE1\u30E2\u30B8\u30E5\u30FC\u30EB"])
]);
var measurementCatalogByKey = new Map(
  MEASUREMENT_CATALOG.map((definition) => [definition.key, definition])
);
var getMeasurementDefinition = /* @__PURE__ */ __name((key) => measurementCatalogByKey.get(key) ?? null, "getMeasurementDefinition");
var listMeasurementTypes = /* @__PURE__ */ __name(() => json({
  version: 1,
  maximumMeasurementsPerPacket: 16,
  categories: MEASUREMENT_CATEGORIES,
  measurements: MEASUREMENT_CATALOG,
  disclaimerJa: "\u63B2\u8F09\u30E2\u30B8\u30E5\u30FC\u30EB\u306F\u63A5\u7D9A\u4F8B\u3067\u3059\u3002ESP32-WROOM-32\u3068\u306E\u500B\u5225\u52D5\u4F5C\u3001\u7CBE\u5EA6\u3001\u9632\u6C34\u3001\u96FB\u5727\u3001\u7D76\u7E01\u3001\u6821\u6B63\u3092\u4FDD\u8A3C\u3059\u308B\u3082\u306E\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002ADC\u30FB5V\u30FBRS-485\u30FB\u5546\u7528\u96FB\u6E90\u30FB\u85AC\u6DB2\u30D7\u30ED\u30FC\u30D6\u306F\u9069\u5207\u306A\u5909\u63DB\u30FB\u7D76\u7E01\u56DE\u8DEF\u304C\u5FC5\u8981\u3067\u3059\u3002"
}), "listMeasurementTypes");

// src/region-code-data.ts
var REGION_DATA_VERSION = "cldr-48.2.0+jlis-2026-08-14";
var SUBDIVISION_RECORDS = [
  ["AD-02", "AD", "Canillo"],
  ["AD-03", "AD", "Encamp"],
  ["AD-04", "AD", "La Massana"],
  ["AD-05", "AD", "Ordino"],
  ["AD-06", "AD", "Sant Juli\xE0 de L\xF2ria"],
  ["AD-07", "AD", "Andorra la Vella"],
  ["AD-08", "AD", "Escaldes-Engordany"],
  ["AE-AJ", "AE", "Ajman"],
  ["AE-AZ", "AE", "Abu Dhabi"],
  ["AE-DU", "AE", "Dubai"],
  ["AE-FU", "AE", "Fujairah"],
  ["AE-RK", "AE", "Ras al-Khaimah"],
  ["AE-SH", "AE", "Sharjah"],
  ["AE-UQ", "AE", "Umm al-Quwain"],
  ["AF-BAL", "AF", "Balkh"],
  ["AF-BAM", "AF", "Bamyan"],
  ["AF-BDG", "AF", "Badghis"],
  ["AF-BDS", "AF", "Badakhshan"],
  ["AF-BGL", "AF", "Baghlan"],
  ["AF-DAY", "AF", "Daykundi"],
  ["AF-FRA", "AF", "Farah"],
  ["AF-FYB", "AF", "Faryab"],
  ["AF-GHA", "AF", "Ghazni"],
  ["AF-GHO", "AF", "Gh\u014Dr"],
  ["AF-HEL", "AF", "Helmand"],
  ["AF-HER", "AF", "Herat"],
  ["AF-JOW", "AF", "Jowzjan"],
  ["AF-KAB", "AF", "Kabul"],
  ["AF-KAN", "AF", "Kandahar"],
  ["AF-KAP", "AF", "Kapisa"],
  ["AF-KDZ", "AF", "Kunduz"],
  ["AF-KHO", "AF", "Khost"],
  ["AF-KNR", "AF", "Kunar"],
  ["AF-LAG", "AF", "Laghman"],
  ["AF-LOG", "AF", "Logar"],
  ["AF-NAN", "AF", "Nangarhar"],
  ["AF-NIM", "AF", "Nimruz"],
  ["AF-NUR", "AF", "Nuristan"],
  ["AF-PAN", "AF", "Panjshir"],
  ["AF-PAR", "AF", "Parwan"],
  ["AF-PIA", "AF", "Paktia"],
  ["AF-PKA", "AF", "Paktika"],
  ["AF-SAM", "AF", "Samangan"],
  ["AF-SAR", "AF", "Sar-e Pol"],
  ["AF-TAK", "AF", "Takhar"],
  ["AF-URU", "AF", "Urozgan"],
  ["AF-WAR", "AF", "Maidan Wardak"],
  ["AF-ZAB", "AF", "Zabul"],
  ["AG-03", "AG", "Saint George"],
  ["AG-04", "AG", "Saint John"],
  ["AG-05", "AG", "Saint Mary"],
  ["AG-06", "AG", "Saint Paul"],
  ["AG-07", "AG", "Saint Peter"],
  ["AG-08", "AG", "Saint Philip"],
  ["AG-10", "AG", "Barbuda"],
  ["AG-11", "AG", "Redonda"],
  ["AL-01", "AL", "Berat County"],
  ["AL-02", "AL", "Durr\xEBs County"],
  ["AL-03", "AL", "Elbasan County"],
  ["AL-04", "AL", "Fier County"],
  ["AL-05", "AL", "Gjirokast\xEBr County"],
  ["AL-06", "AL", "Kor\xE7\xEB County"],
  ["AL-07", "AL", "Kuk\xEBs County"],
  ["AL-08", "AL", "Lezh\xEB County"],
  ["AL-09", "AL", "Dib\xEBr County"],
  ["AL-10", "AL", "Shkod\xEBr County"],
  ["AL-11", "AL", "Tirana County"],
  ["AL-12", "AL", "Vlor\xEB County"],
  ["AM-AG", "AM", "Aragatsotn"],
  ["AM-AR", "AM", "Ararat"],
  ["AM-AV", "AM", "Armavir"],
  ["AM-ER", "AM", "Yerevan"],
  ["AM-GR", "AM", "Gegharkunik"],
  ["AM-KT", "AM", "Kotayk"],
  ["AM-LO", "AM", "Lori"],
  ["AM-SH", "AM", "Shirak"],
  ["AM-SU", "AM", "Syunik"],
  ["AM-TV", "AM", "Tavush"],
  ["AM-VD", "AM", "Vayots Dzor"],
  ["AO-BGO", "AO", "Bengo"],
  ["AO-BGU", "AO", "Benguela"],
  ["AO-BIE", "AO", "Bi\xE9"],
  ["AO-CAB", "AO", "Cabinda"],
  ["AO-CCU", "AO", "Cuando Cubango"],
  ["AO-CNN", "AO", "Cunene"],
  ["AO-CNO", "AO", "Cuanza Norte"],
  ["AO-CUS", "AO", "Cuanza Sul"],
  ["AO-HUA", "AO", "Huambo"],
  ["AO-HUI", "AO", "Hu\xEDla"],
  ["AO-LNO", "AO", "Lunda Norte"],
  ["AO-LSU", "AO", "Lunda Sul"],
  ["AO-LUA", "AO", "Luanda"],
  ["AO-MAL", "AO", "Malanje"],
  ["AO-MOX", "AO", "Moxico"],
  ["AO-NAM", "AO", "Namibe"],
  ["AO-UIG", "AO", "U\xEDge"],
  ["AO-ZAI", "AO", "Zaire"],
  ["AR-A", "AR", "Salta"],
  ["AR-B", "AR", "Buenos Aires Province"],
  ["AR-C", "AR", "Buenos Aires"],
  ["AR-D", "AR", "San Luis"],
  ["AR-E", "AR", "Entre R\xEDos"],
  ["AR-F", "AR", "La Rioja"],
  ["AR-G", "AR", "Santiago del Estero"],
  ["AR-H", "AR", "Chaco"],
  ["AR-J", "AR", "San Juan"],
  ["AR-K", "AR", "Catamarca"],
  ["AR-L", "AR", "La Pampa"],
  ["AR-M", "AR", "Mendoza"],
  ["AR-N", "AR", "Misiones"],
  ["AR-P", "AR", "Formosa"],
  ["AR-Q", "AR", "Neuqu\xE9n"],
  ["AR-R", "AR", "R\xEDo Negro"],
  ["AR-S", "AR", "Santa Fe"],
  ["AR-T", "AR", "Tucum\xE1n"],
  ["AR-U", "AR", "Chubut"],
  ["AR-V", "AR", "Tierra del Fuego"],
  ["AR-W", "AR", "Corrientes"],
  ["AR-X", "AR", "C\xF3rdoba"],
  ["AR-Y", "AR", "Jujuy"],
  ["AR-Z", "AR", "Santa Cruz"],
  ["AT-1", "AT", "Burgenland"],
  ["AT-2", "AT", "Carinthia"],
  ["AT-3", "AT", "Lower Austria"],
  ["AT-4", "AT", "Upper Austria"],
  ["AT-5", "AT", "Salzburg"],
  ["AT-6", "AT", "Styria"],
  ["AT-7", "AT", "Tyrol"],
  ["AT-8", "AT", "Vorarlberg"],
  ["AT-9", "AT", "Vienna"],
  ["AU-ACT", "AU", "Australian Capital Territory"],
  ["AU-NSW", "AU", "New South Wales"],
  ["AU-NT", "AU", "Northern Territory"],
  ["AU-QLD", "AU", "Queensland"],
  ["AU-SA", "AU", "South Australia"],
  ["AU-TAS", "AU", "Tasmania"],
  ["AU-VIC", "AU", "Victoria"],
  ["AU-WA", "AU", "Western Australia"],
  ["AZ-ABS", "AZ", "Absheron"],
  ["AZ-AGA", "AZ", "Agstafa"],
  ["AZ-AGC", "AZ", "Aghjabadi"],
  ["AZ-AGM", "AZ", "Agdam"],
  ["AZ-AGS", "AZ", "Agdash"],
  ["AZ-AGU", "AZ", "Agsu"],
  ["AZ-AST", "AZ", "Astara"],
  ["AZ-BA", "AZ", "Baku"],
  ["AZ-BAB", "AZ", "Babek"],
  ["AZ-BAL", "AZ", "Balakan"],
  ["AZ-BAR", "AZ", "Barda"],
  ["AZ-BEY", "AZ", "Beylagan"],
  ["AZ-BIL", "AZ", "Bilasuvar"],
  ["AZ-CAB", "AZ", "Jabrayil"],
  ["AZ-CAL", "AZ", "Jalilabad"],
  ["AZ-CUL", "AZ", "Julfa"],
  ["AZ-DAS", "AZ", "Dashkasan"],
  ["AZ-FUZ", "AZ", "Fizuli"],
  ["AZ-GA", "AZ", "Ganja"],
  ["AZ-GAD", "AZ", "Gadabay"],
  ["AZ-GOR", "AZ", "Goranboy"],
  ["AZ-GOY", "AZ", "Goychay"],
  ["AZ-GYG", "AZ", "Goygol"],
  ["AZ-HAC", "AZ", "Hajigabul"],
  ["AZ-IMI", "AZ", "Imishli"],
  ["AZ-ISM", "AZ", "Ismailli"],
  ["AZ-KAL", "AZ", "Kalbajar"],
  ["AZ-KAN", "AZ", "Kangarli"],
  ["AZ-KUR", "AZ", "Kurdamir"],
  ["AZ-LA", "AZ", "Lankaran"],
  ["AZ-LAC", "AZ", "Lachin"],
  ["AZ-LAN", "AZ", "Lankaran District"],
  ["AZ-LER", "AZ", "Lerik"],
  ["AZ-MAS", "AZ", "Masally"],
  ["AZ-MI", "AZ", "Mingachevir"],
  ["AZ-NA", "AZ", "Naftalan"],
  ["AZ-NEF", "AZ", "Neftchala"],
  ["AZ-NV", "AZ", "Nakhchivan"],
  ["AZ-NX", "AZ", "Nakhchivan AR"],
  ["AZ-OGU", "AZ", "Oghuz"],
  ["AZ-ORD", "AZ", "Ordubad"],
  ["AZ-QAB", "AZ", "Qabala"],
  ["AZ-QAX", "AZ", "Qakh"],
  ["AZ-QAZ", "AZ", "Qazakh"],
  ["AZ-QBA", "AZ", "Quba"],
  ["AZ-QBI", "AZ", "Qubadli"],
  ["AZ-QOB", "AZ", "Gobustan"],
  ["AZ-QUS", "AZ", "Qusar"],
  ["AZ-SA", "AZ", "Shaki"],
  ["AZ-SAB", "AZ", "Sabirabad"],
  ["AZ-SAD", "AZ", "Sadarak"],
  ["AZ-SAH", "AZ", "Shahbuz"],
  ["AZ-SAK", "AZ", "Shaki District"],
  ["AZ-SAL", "AZ", "Salyan"],
  ["AZ-SAR", "AZ", "Sharur"],
  ["AZ-SAT", "AZ", "Saatly"],
  ["AZ-SBN", "AZ", "Shabran"],
  ["AZ-SIY", "AZ", "Siazan"],
  ["AZ-SKR", "AZ", "Shamkir"],
  ["AZ-SM", "AZ", "Sumqayit"],
  ["AZ-SMI", "AZ", "Shamakhi"],
  ["AZ-SMX", "AZ", "Samukh"],
  ["AZ-SR", "AZ", "Shirvan"],
  ["AZ-SUS", "AZ", "Shusha"],
  ["AZ-TAR", "AZ", "Tartar"],
  ["AZ-TOV", "AZ", "Tovuz"],
  ["AZ-UCA", "AZ", "Ujar"],
  ["AZ-XA", "AZ", "Stepanakert"],
  ["AZ-XAC", "AZ", "Khachmaz"],
  ["AZ-XCI", "AZ", "Khojali"],
  ["AZ-XIZ", "AZ", "Khizi"],
  ["AZ-XVD", "AZ", "Khojavend"],
  ["AZ-YAR", "AZ", "Yardymli"],
  ["AZ-YE", "AZ", "Yevlakh"],
  ["AZ-YEV", "AZ", "Yevlakh District"],
  ["AZ-ZAN", "AZ", "Zangilan"],
  ["AZ-ZAQ", "AZ", "Zaqatala"],
  ["AZ-ZAR", "AZ", "Zardab"],
  ["BA-BIH", "BA", "Federation of Bosnia and Herzegovina"],
  ["BA-BRC", "BA", "Br\u010Dko District"],
  ["BA-SRP", "BA", "Republika Srpska"],
  ["BB-01", "BB", "Christ Church"],
  ["BB-02", "BB", "Saint Andrew"],
  ["BB-03", "BB", "Saint George"],
  ["BB-04", "BB", "Saint James"],
  ["BB-05", "BB", "Saint John"],
  ["BB-06", "BB", "Saint Joseph"],
  ["BB-07", "BB", "Saint Lucy"],
  ["BB-08", "BB", "Saint Michael"],
  ["BB-09", "BB", "Saint Peter"],
  ["BB-10", "BB", "Saint Philip"],
  ["BB-11", "BB", "Saint Thomas"],
  ["BD-01", "BD", "Bandarban"],
  ["BD-02", "BD", "Barguna"],
  ["BD-03", "BD", "Bogra"],
  ["BD-04", "BD", "Brahmanbaria"],
  ["BD-05", "BD", "Bagerhat"],
  ["BD-06", "BD", "Barisal Division"],
  ["BD-07", "BD", "Bhola"],
  ["BD-08", "BD", "Comilla"],
  ["BD-09", "BD", "Chandpur"],
  ["BD-10", "BD", "Chittagong"],
  ["BD-11", "BD", "Cox\u2019s Bazar"],
  ["BD-12", "BD", "Chuadanga"],
  ["BD-13", "BD", "Dhaka"],
  ["BD-14", "BD", "Dinajpur"],
  ["BD-15", "BD", "Faridpur"],
  ["BD-16", "BD", "Feni"],
  ["BD-17", "BD", "Gopalganj"],
  ["BD-18", "BD", "Gazipur"],
  ["BD-19", "BD", "Gaibandha"],
  ["BD-20", "BD", "Habiganj"],
  ["BD-21", "BD", "Jamalpur"],
  ["BD-22", "BD", "Jessore"],
  ["BD-23", "BD", "Jhenaidah"],
  ["BD-24", "BD", "Joypurhat"],
  ["BD-25", "BD", "Jhalokati"],
  ["BD-26", "BD", "Kishoreganj"],
  ["BD-27", "BD", "Khulna"],
  ["BD-28", "BD", "Kurigram"],
  ["BD-29", "BD", "Khagrachari"],
  ["BD-30", "BD", "Kushtia"],
  ["BD-31", "BD", "Lakshmipur"],
  ["BD-32", "BD", "Lalmonirhat"],
  ["BD-33", "BD", "Manikganj"],
  ["BD-34", "BD", "Mymensingh"],
  ["BD-35", "BD", "Munshiganj"],
  ["BD-36", "BD", "Madaripur"],
  ["BD-37", "BD", "Magura"],
  ["BD-38", "BD", "Maulvi Bazar"],
  ["BD-39", "BD", "Meherpur"],
  ["BD-40", "BD", "Narayanganj"],
  ["BD-41", "BD", "Netrokona"],
  ["BD-42", "BD", "Narsingdi"],
  ["BD-43", "BD", "Narail"],
  ["BD-44", "BD", "Natore"],
  ["BD-45", "BD", "Nawabganj"],
  ["BD-46", "BD", "Nilphamari"],
  ["BD-47", "BD", "Noakhali"],
  ["BD-48", "BD", "Naogaon"],
  ["BD-49", "BD", "Pabna"],
  ["BD-50", "BD", "Pirojpur"],
  ["BD-51", "BD", "Patuakhali"],
  ["BD-52", "BD", "Panchagarh"],
  ["BD-53", "BD", "Rajbari"],
  ["BD-54", "BD", "Rajshahi"],
  ["BD-55", "BD", "Rangpur"],
  ["BD-56", "BD", "Rangamati Hill"],
  ["BD-57", "BD", "Sherpur"],
  ["BD-58", "BD", "Satkhira"],
  ["BD-59", "BD", "Sirajganj"],
  ["BD-60", "BD", "Sylhet"],
  ["BD-61", "BD", "Sunamganj"],
  ["BD-62", "BD", "Shariatpur"],
  ["BD-63", "BD", "Tangail"],
  ["BD-64", "BD", "Thakurgaon"],
  ["BD-A", "BD", "Barisal"],
  ["BD-B", "BD", "Chittagong Division"],
  ["BD-C", "BD", "Dhaka Division"],
  ["BD-D", "BD", "Khulna Division"],
  ["BD-E", "BD", "Rajshahi Division"],
  ["BD-F", "BD", "Rangpur Division"],
  ["BD-G", "BD", "Sylhet Division"],
  ["BD-H", "BD", "Mymensingh Division"],
  ["BE-BRU", "BE", "Brussels"],
  ["BE-VAN", "BE", "Antwerp"],
  ["BE-VBR", "BE", "Flemish Brabant"],
  ["BE-VLG", "BE", "Flanders"],
  ["BE-VLI", "BE", "Limburg"],
  ["BE-VOV", "BE", "East Flanders"],
  ["BE-VWV", "BE", "West Flanders"],
  ["BE-WAL", "BE", "Wallonia"],
  ["BE-WBR", "BE", "Walloon Brabant"],
  ["BE-WHT", "BE", "Hainaut"],
  ["BE-WLG", "BE", "Li\xE8ge"],
  ["BE-WLX", "BE", "Luxembourg"],
  ["BE-WNA", "BE", "Namur"],
  ["BF-01", "BF", "Boucle du Mouhoun"],
  ["BF-02", "BF", "Cascades"],
  ["BF-03", "BF", "Centre"],
  ["BF-04", "BF", "Centre-Est"],
  ["BF-05", "BF", "Centre-Nord"],
  ["BF-06", "BF", "Centre-Ouest"],
  ["BF-07", "BF", "Centre-Sud"],
  ["BF-08", "BF", "Est"],
  ["BF-09", "BF", "Hauts-Bassins"],
  ["BF-10", "BF", "Nord"],
  ["BF-11", "BF", "Plateau-Central"],
  ["BF-12", "BF", "Sahel"],
  ["BF-13", "BF", "Sud-Ouest"],
  ["BF-BAL", "BF", "Bal\xE9"],
  ["BF-BAM", "BF", "Bam"],
  ["BF-BAN", "BF", "Banwa"],
  ["BF-BAZ", "BF", "Baz\xE8ga"],
  ["BF-BGR", "BF", "Bougouriba"],
  ["BF-BLG", "BF", "Boulgou"],
  ["BF-BLK", "BF", "Boulkiemd\xE9"],
  ["BF-COM", "BF", "Como\xE9"],
  ["BF-GAN", "BF", "Ganzourgou"],
  ["BF-GNA", "BF", "Gnagna"],
  ["BF-GOU", "BF", "Gourma"],
  ["BF-HOU", "BF", "Houet"],
  ["BF-IOB", "BF", "Ioba"],
  ["BF-KAD", "BF", "Kadiogo"],
  ["BF-KEN", "BF", "K\xE9n\xE9dougou"],
  ["BF-KMD", "BF", "Komondjari"],
  ["BF-KMP", "BF", "Kompienga"],
  ["BF-KOP", "BF", "Koulp\xE9logo"],
  ["BF-KOS", "BF", "Kossi"],
  ["BF-KOT", "BF", "Kouritenga"],
  ["BF-KOW", "BF", "Kourw\xE9ogo"],
  ["BF-LER", "BF", "L\xE9raba"],
  ["BF-LOR", "BF", "Loroum"],
  ["BF-MOU", "BF", "Mouhoun"],
  ["BF-NAM", "BF", "Namentenga"],
  ["BF-NAO", "BF", "Nahouri"],
  ["BF-NAY", "BF", "Nayala"],
  ["BF-NOU", "BF", "Noumbiel"],
  ["BF-OUB", "BF", "Oubritenga"],
  ["BF-OUD", "BF", "Oudalan"],
  ["BF-PAS", "BF", "Passor\xE9"],
  ["BF-PON", "BF", "Poni"],
  ["BF-SEN", "BF", "S\xE9no"],
  ["BF-SIS", "BF", "Sissili"],
  ["BF-SMT", "BF", "Sanmatenga"],
  ["BF-SNG", "BF", "Sangui\xE9"],
  ["BF-SOM", "BF", "Soum"],
  ["BF-SOR", "BF", "Sourou"],
  ["BF-TAP", "BF", "Tapoa"],
  ["BF-TUI", "BF", "Tuy"],
  ["BF-YAG", "BF", "Yagha"],
  ["BF-YAT", "BF", "Yatenga"],
  ["BF-ZIR", "BF", "Ziro"],
  ["BF-ZON", "BF", "Zondoma"],
  ["BF-ZOU", "BF", "Zoundw\xE9ogo"],
  ["BG-01", "BG", "Blagoevgrad"],
  ["BG-02", "BG", "Burgas"],
  ["BG-03", "BG", "Varna"],
  ["BG-04", "BG", "Veliko Tarnovo"],
  ["BG-05", "BG", "Vidin"],
  ["BG-06", "BG", "Vratsa"],
  ["BG-07", "BG", "Gabrovo"],
  ["BG-08", "BG", "Dobrich"],
  ["BG-09", "BG", "Kardzhali"],
  ["BG-10", "BG", "Kyustendil"],
  ["BG-11", "BG", "Lovech"],
  ["BG-12", "BG", "Montana"],
  ["BG-13", "BG", "Pazardzhik"],
  ["BG-14", "BG", "Pernik"],
  ["BG-15", "BG", "Pleven"],
  ["BG-16", "BG", "Plovdiv"],
  ["BG-17", "BG", "Razgrad"],
  ["BG-18", "BG", "Ruse"],
  ["BG-19", "BG", "Silistra"],
  ["BG-20", "BG", "Sliven"],
  ["BG-21", "BG", "Smolyan"],
  ["BG-22", "BG", "Sofia"],
  ["BG-23", "BG", "Sofia District"],
  ["BG-24", "BG", "Stara Zagora"],
  ["BG-25", "BG", "Targovishte"],
  ["BG-26", "BG", "Haskovo"],
  ["BG-27", "BG", "Shumen"],
  ["BG-28", "BG", "Yambol"],
  ["BH-13", "BH", "Capital"],
  ["BH-14", "BH", "Southern"],
  ["BH-15", "BH", "Muharraq"],
  ["BH-17", "BH", "Northern"],
  ["BI-BB", "BI", "Bubanza"],
  ["BI-BL", "BI", "Bujumbura Rural"],
  ["BI-BM", "BI", "Bujumbura"],
  ["BI-BR", "BI", "Bururi"],
  ["BI-CA", "BI", "Cankuzo"],
  ["BI-CI", "BI", "Cibitoke"],
  ["BI-GI", "BI", "Gitega"],
  ["BI-KI", "BI", "Kirundo"],
  ["BI-KR", "BI", "Karuzi"],
  ["BI-KY", "BI", "Kayanza"],
  ["BI-MA", "BI", "Makamba"],
  ["BI-MU", "BI", "Muramvya"],
  ["BI-MW", "BI", "Mwaro"],
  ["BI-MY", "BI", "Muyinga"],
  ["BI-NG", "BI", "Ngozi"],
  ["BI-RM", "BI", "Rumonge"],
  ["BI-RT", "BI", "Rutana"],
  ["BI-RY", "BI", "Ruyigi"],
  ["BJ-AK", "BJ", "Atakora"],
  ["BJ-AL", "BJ", "Alibori"],
  ["BJ-AQ", "BJ", "Atlantique"],
  ["BJ-BO", "BJ", "Borgou"],
  ["BJ-CO", "BJ", "Collines"],
  ["BJ-DO", "BJ", "Donga"],
  ["BJ-KO", "BJ", "Kouffo"],
  ["BJ-LI", "BJ", "Littoral"],
  ["BJ-MO", "BJ", "Mono"],
  ["BJ-OU", "BJ", "Ou\xE9m\xE9"],
  ["BJ-PL", "BJ", "Plateau"],
  ["BJ-ZO", "BJ", "Zou"],
  ["BN-BE", "BN", "Belait"],
  ["BN-BM", "BN", "Brunei-Muara"],
  ["BN-TE", "BN", "Temburong"],
  ["BN-TU", "BN", "Tutong"],
  ["BO-B", "BO", "Beni"],
  ["BO-C", "BO", "Cochabamba"],
  ["BO-H", "BO", "Chuquisaca"],
  ["BO-L", "BO", "La Paz"],
  ["BO-N", "BO", "Pando"],
  ["BO-O", "BO", "Oruro"],
  ["BO-P", "BO", "Potos\xED"],
  ["BO-S", "BO", "Santa Cruz"],
  ["BO-T", "BO", "Tarija"],
  ["BQ-BO", "BQ", "Bonaire"],
  ["BQ-SA", "BQ", "Saba"],
  ["BQ-SE", "BQ", "Sint Eustatius"],
  ["BR-AC", "BR", "Acre"],
  ["BR-AL", "BR", "Alagoas"],
  ["BR-AM", "BR", "Amazonas"],
  ["BR-AP", "BR", "Amap\xE1"],
  ["BR-BA", "BR", "Bahia"],
  ["BR-CE", "BR", "Cear\xE1"],
  ["BR-DF", "BR", "Federal District"],
  ["BR-ES", "BR", "Esp\xEDrito Santo"],
  ["BR-GO", "BR", "Goi\xE1s"],
  ["BR-MA", "BR", "Maranh\xE3o"],
  ["BR-MG", "BR", "Minas Gerais"],
  ["BR-MS", "BR", "Mato Grosso do Sul"],
  ["BR-MT", "BR", "Mato Grosso"],
  ["BR-PA", "BR", "Par\xE1"],
  ["BR-PB", "BR", "Para\xEDba"],
  ["BR-PE", "BR", "Pernambuco"],
  ["BR-PI", "BR", "Piau\xED"],
  ["BR-PR", "BR", "Paran\xE1"],
  ["BR-RJ", "BR", "Rio de Janeiro"],
  ["BR-RN", "BR", "Rio Grande do Norte"],
  ["BR-RO", "BR", "Rond\xF4nia"],
  ["BR-RR", "BR", "Roraima"],
  ["BR-RS", "BR", "Rio Grande do Sul"],
  ["BR-SC", "BR", "Santa Catarina"],
  ["BR-SE", "BR", "Sergipe"],
  ["BR-SP", "BR", "S\xE3o Paulo"],
  ["BR-TO", "BR", "Tocantins"],
  ["BS-AK", "BS", "Acklins"],
  ["BS-BI", "BS", "Bimini"],
  ["BS-BP", "BS", "Black Point"],
  ["BS-BY", "BS", "Berry Islands"],
  ["BS-CE", "BS", "Central Eleuthera"],
  ["BS-CI", "BS", "Cat Island"],
  ["BS-CK", "BS", "Crooked Island"],
  ["BS-CO", "BS", "Central Abaco"],
  ["BS-CS", "BS", "Central Andros"],
  ["BS-EG", "BS", "East Grand Bahama"],
  ["BS-EX", "BS", "Exuma"],
  ["BS-FP", "BS", "Freeport"],
  ["BS-GC", "BS", "Grand Cay"],
  ["BS-HI", "BS", "Harbour Island"],
  ["BS-HT", "BS", "Hope Town"],
  ["BS-IN", "BS", "Inagua"],
  ["BS-LI", "BS", "Long Island"],
  ["BS-MC", "BS", "Mangrove Cay"],
  ["BS-MG", "BS", "Mayaguana"],
  ["BS-MI", "BS", "Moore\u2019s Island"],
  ["BS-NE", "BS", "North Eleuthera"],
  ["BS-NO", "BS", "North Abaco"],
  ["BS-NP", "BS", "New Providence"],
  ["BS-NS", "BS", "North Andros"],
  ["BS-RC", "BS", "Rum Cay"],
  ["BS-RI", "BS", "Ragged Island"],
  ["BS-SA", "BS", "South Andros"],
  ["BS-SE", "BS", "South Eleuthera"],
  ["BS-SO", "BS", "South Abaco"],
  ["BS-SS", "BS", "San Salvador"],
  ["BS-SW", "BS", "Spanish Wells"],
  ["BS-WG", "BS", "West Grand Bahama"],
  ["BT-11", "BT", "Paro"],
  ["BT-12", "BT", "Chukha"],
  ["BT-13", "BT", "Haa"],
  ["BT-14", "BT", "Samtse"],
  ["BT-15", "BT", "Thimphu"],
  ["BT-21", "BT", "Tsirang"],
  ["BT-22", "BT", "Dagana"],
  ["BT-23", "BT", "Punakha"],
  ["BT-24", "BT", "Wangdue Phodrang"],
  ["BT-31", "BT", "Sarpang"],
  ["BT-32", "BT", "Trongsa"],
  ["BT-33", "BT", "Bumthang"],
  ["BT-34", "BT", "Zhemgang"],
  ["BT-41", "BT", "Trashigang"],
  ["BT-42", "BT", "Mongar"],
  ["BT-43", "BT", "Pemagatshel"],
  ["BT-44", "BT", "Lhuntse"],
  ["BT-45", "BT", "Samdrup Jongkhar"],
  ["BT-GA", "BT", "Gasa"],
  ["BT-TY", "BT", "Trashiyangtse"],
  ["BW-CE", "BW", "Central"],
  ["BW-CH", "BW", "Chobe"],
  ["BW-FR", "BW", "Francistown"],
  ["BW-GA", "BW", "Gaborone"],
  ["BW-GH", "BW", "Ghanzi"],
  ["BW-JW", "BW", "Jwaneng"],
  ["BW-KG", "BW", "Kgalagadi"],
  ["BW-KL", "BW", "Kgatleng"],
  ["BW-KW", "BW", "Kweneng"],
  ["BW-LO", "BW", "Lobatse"],
  ["BW-NE", "BW", "North East"],
  ["BW-NW", "BW", "North West"],
  ["BW-SE", "BW", "South East"],
  ["BW-SO", "BW", "Southern"],
  ["BW-SP", "BW", "Selibe Phikwe"],
  ["BW-ST", "BW", "Sowa Town"],
  ["BY-BR", "BY", "Brest"],
  ["BY-HM", "BY", "Minsk"],
  ["BY-HO", "BY", "Homel"],
  ["BY-HR", "BY", "Hrodna"],
  ["BY-MA", "BY", "Magileu"],
  ["BY-MI", "BY", "Minsk Region"],
  ["BY-VI", "BY", "Vitebsk"],
  ["BZ-BZ", "BZ", "Belize"],
  ["BZ-CY", "BZ", "Cayo"],
  ["BZ-CZL", "BZ", "Corozal"],
  ["BZ-OW", "BZ", "Orange Walk"],
  ["BZ-SC", "BZ", "Stann Creek"],
  ["BZ-TOL", "BZ", "Toledo"],
  ["CA-AB", "CA", "Alberta"],
  ["CA-BC", "CA", "British Columbia"],
  ["CA-MB", "CA", "Manitoba"],
  ["CA-NB", "CA", "New Brunswick"],
  ["CA-NL", "CA", "Newfoundland and Labrador"],
  ["CA-NS", "CA", "Nova Scotia"],
  ["CA-NT", "CA", "Northwest Territories"],
  ["CA-NU", "CA", "Nunavut"],
  ["CA-ON", "CA", "Ontario"],
  ["CA-PE", "CA", "Prince Edward Island"],
  ["CA-QC", "CA", "Quebec"],
  ["CA-SK", "CA", "Saskatchewan"],
  ["CA-YT", "CA", "Yukon"],
  ["CD-BC", "CD", "Bas-Congo"],
  ["CD-BU", "CD", "Bas-U\xE9l\xE9"],
  ["CD-EQ", "CD", "\xC9quateur"],
  ["CD-HK", "CD", "Haut-Katanga"],
  ["CD-HL", "CD", "Haut-Lomami"],
  ["CD-HU", "CD", "Haut-U\xE9l\xE9"],
  ["CD-IT", "CD", "Ituri"],
  ["CD-KC", "CD", "Kasa\xEF Central"],
  ["CD-KE", "CD", "Kasa\xEF-Oriental"],
  ["CD-KG", "CD", "Kwango"],
  ["CD-KL", "CD", "Kwilu"],
  ["CD-KN", "CD", "Kinshasa"],
  ["CD-KS", "CD", "Kasa\xEF"],
  ["CD-LO", "CD", "Lomami"],
  ["CD-LU", "CD", "Lualaba"],
  ["CD-MA", "CD", "Maniema"],
  ["CD-MN", "CD", "Mai-Ndombe"],
  ["CD-MO", "CD", "Mongala"],
  ["CD-NK", "CD", "North Kivu"],
  ["CD-NU", "CD", "Nord-Ubangi"],
  ["CD-SA", "CD", "Sankuru"],
  ["CD-SK", "CD", "South Kivu"],
  ["CD-SU", "CD", "Sud-Ubangi"],
  ["CD-TA", "CD", "Tanganyika"],
  ["CD-TO", "CD", "Tshopo"],
  ["CD-TU", "CD", "Tshuapa"],
  ["CF-AC", "CF", "Ouham"],
  ["CF-BB", "CF", "Bamingui-Bangoran"],
  ["CF-BGF", "CF", "Bangui"],
  ["CF-BK", "CF", "Basse-Kotto"],
  ["CF-HK", "CF", "Haute-Kotto"],
  ["CF-HM", "CF", "Haut-Mbomou"],
  ["CF-HS", "CF", "Mamb\xE9r\xE9-Kad\xE9\xEF"],
  ["CF-KB", "CF", "Nana-Gr\xE9bizi"],
  ["CF-KG", "CF", "K\xE9mo"],
  ["CF-LB", "CF", "Lobaye"],
  ["CF-MB", "CF", "Mbomou"],
  ["CF-MP", "CF", "Ombella-M\u2019Poko"],
  ["CF-NM", "CF", "Nana-Mamb\xE9r\xE9"],
  ["CF-OP", "CF", "Ouham-Pend\xE9"],
  ["CF-SE", "CF", "Sangha-Mba\xE9r\xE9"],
  ["CF-UK", "CF", "Ouaka"],
  ["CF-VK", "CF", "Vakaga"],
  ["CG-11", "CG", "Bouenza"],
  ["CG-12", "CG", "Pool"],
  ["CG-13", "CG", "Sangha"],
  ["CG-14", "CG", "Plateaux"],
  ["CG-15", "CG", "Cuvette-Ouest"],
  ["CG-16", "CG", "Pointe-Noire"],
  ["CG-2", "CG", "L\xE9koumou"],
  ["CG-5", "CG", "Kouilou"],
  ["CG-7", "CG", "Likouala"],
  ["CG-8", "CG", "Cuvette"],
  ["CG-9", "CG", "Niari"],
  ["CG-BZV", "CG", "Brazzaville"],
  ["CH-AG", "CH", "Aargau"],
  ["CH-AI", "CH", "Appenzell Innerrhoden"],
  ["CH-AR", "CH", "Appenzell Ausserrhoden"],
  ["CH-BE", "CH", "Bern"],
  ["CH-BL", "CH", "Basel-Landschaft"],
  ["CH-BS", "CH", "Basel-Stadt"],
  ["CH-FR", "CH", "Fribourg"],
  ["CH-GE", "CH", "Geneva"],
  ["CH-GL", "CH", "Glarus"],
  ["CH-GR", "CH", "Graub\xFCnden"],
  ["CH-JU", "CH", "Jura"],
  ["CH-LU", "CH", "Lucerne"],
  ["CH-NE", "CH", "Neuch\xE2tel"],
  ["CH-NW", "CH", "Nidwalden"],
  ["CH-OW", "CH", "Obwalden"],
  ["CH-SG", "CH", "St. Gallen"],
  ["CH-SH", "CH", "Schaffhausen"],
  ["CH-SO", "CH", "Solothurn"],
  ["CH-SZ", "CH", "Schwyz"],
  ["CH-TG", "CH", "Thurgau"],
  ["CH-TI", "CH", "Ticino"],
  ["CH-UR", "CH", "Uri"],
  ["CH-VD", "CH", "Vaud"],
  ["CH-VS", "CH", "Valais"],
  ["CH-ZG", "CH", "Zug"],
  ["CH-ZH", "CH", "Z\xFCrich"],
  ["CI-AB", "CI", "Abidjan"],
  ["CI-BS", "CI", "Bas-Sassandra\xB2"],
  ["CI-CM", "CI", "Como\xE9"],
  ["CI-DN", "CI", "Dengu\xE9l\xE9\xB2"],
  ["CI-GD", "CI", "G\xF4h-Djiboua"],
  ["CI-LC", "CI", "Lacs\xB2"],
  ["CI-LG", "CI", "Lagunes\xB2"],
  ["CI-MG", "CI", "Montagnes"],
  ["CI-SM", "CI", "Sassandra-Marahou\xE9"],
  ["CI-SV", "CI", "Savanes"],
  ["CI-VB", "CI", "Vall\xE9e du Bandama\xB2"],
  ["CI-WR", "CI", "Woroba"],
  ["CI-YM", "CI", "Yamoussoukro"],
  ["CI-ZZ", "CI", "Zanzan\xB2"],
  ["CL-AI", "CL", "Ays\xE9n"],
  ["CL-AN", "CL", "Antofagasta"],
  ["CL-AP", "CL", "Arica y Parinacota"],
  ["CL-AR", "CL", "Araucan\xEDa"],
  ["CL-AT", "CL", "Atacama"],
  ["CL-BI", "CL", "B\xEDo B\xEDo"],
  ["CL-CO", "CL", "Coquimbo"],
  ["CL-LI", "CL", "Libertador General Bernardo O\u2019Higgins"],
  ["CL-LL", "CL", "Los Lagos"],
  ["CL-LR", "CL", "Los R\xEDos"],
  ["CL-MA", "CL", "Magallanes Region"],
  ["CL-ML", "CL", "Maule"],
  ["CL-NB", "CL", "\xD1uble"],
  ["CL-RM", "CL", "Santiago Metropolitan"],
  ["CL-TA", "CL", "Tarapac\xE1"],
  ["CL-VS", "CL", "Valpara\xEDso"],
  ["CM-AD", "CM", "Adamawa"],
  ["CM-CE", "CM", "Centre"],
  ["CM-EN", "CM", "Far North"],
  ["CM-ES", "CM", "East"],
  ["CM-LT", "CM", "Littoral"],
  ["CM-NO", "CM", "North"],
  ["CM-NW", "CM", "Northwest"],
  ["CM-OU", "CM", "West"],
  ["CM-SU", "CM", "South"],
  ["CM-SW", "CM", "Southwest"],
  ["CN-AH", "CN", "Anhui"],
  ["CN-BJ", "CN", "Beijing"],
  ["CN-CQ", "CN", "Chongqing"],
  ["CN-FJ", "CN", "Fujian"],
  ["CN-GD", "CN", "Guangdong"],
  ["CN-GS", "CN", "Gansu"],
  ["CN-GX", "CN", "Guangxi"],
  ["CN-GZ", "CN", "Guizhou"],
  ["CN-HA", "CN", "Henan"],
  ["CN-HB", "CN", "Hubei"],
  ["CN-HE", "CN", "Hebei"],
  ["CN-HI", "CN", "Hainan"],
  ["CN-HK", "CN", "Hong Kong SAR China"],
  ["CN-HL", "CN", "Heilongjiang"],
  ["CN-HN", "CN", "Hunan"],
  ["CN-JL", "CN", "Jilin"],
  ["CN-JS", "CN", "Jiangsu"],
  ["CN-JX", "CN", "Jiangxi"],
  ["CN-LN", "CN", "Liaoning"],
  ["CN-MO", "CN", "Macao SAR China"],
  ["CN-NM", "CN", "Inner Mongolia"],
  ["CN-NX", "CN", "Ningxia"],
  ["CN-QH", "CN", "Qinghai"],
  ["CN-SC", "CN", "Sichuan"],
  ["CN-SD", "CN", "Shandong"],
  ["CN-SH", "CN", "Shanghai"],
  ["CN-SN", "CN", "Shaanxi"],
  ["CN-SX", "CN", "Shanxi"],
  ["CN-TJ", "CN", "Tianjin"],
  ["CN-TW", "CN", "Taiwan"],
  ["CN-XJ", "CN", "Xinjiang"],
  ["CN-XZ", "CN", "Tibet"],
  ["CN-YN", "CN", "Yunnan"],
  ["CN-ZJ", "CN", "Zhejiang"],
  ["CO-AMA", "CO", "Amazonas"],
  ["CO-ANT", "CO", "Antioquia"],
  ["CO-ARA", "CO", "Arauca"],
  ["CO-ATL", "CO", "Atl\xE1ntico"],
  ["CO-BOL", "CO", "Bol\xEDvar"],
  ["CO-BOY", "CO", "Boyac\xE1"],
  ["CO-CAL", "CO", "Caldas"],
  ["CO-CAQ", "CO", "Caquet\xE1"],
  ["CO-CAS", "CO", "Casanare"],
  ["CO-CAU", "CO", "Cauca"],
  ["CO-CES", "CO", "Cesar"],
  ["CO-CHO", "CO", "Choc\xF3"],
  ["CO-COR", "CO", "C\xF3rdoba"],
  ["CO-CUN", "CO", "Cundinamarca"],
  ["CO-DC", "CO", "Capital District"],
  ["CO-GUA", "CO", "Guain\xEDa"],
  ["CO-GUV", "CO", "Guaviare"],
  ["CO-HUI", "CO", "Huila"],
  ["CO-LAG", "CO", "La Guajira"],
  ["CO-MAG", "CO", "Magdalena"],
  ["CO-MET", "CO", "Meta"],
  ["CO-NAR", "CO", "Nari\xF1o"],
  ["CO-NSA", "CO", "Norte de Santander"],
  ["CO-PUT", "CO", "Putumayo"],
  ["CO-QUI", "CO", "Quind\xEDo"],
  ["CO-RIS", "CO", "Risaralda"],
  ["CO-SAN", "CO", "Santander"],
  ["CO-SAP", "CO", "San Andr\xE9s & Providencia"],
  ["CO-SUC", "CO", "Sucre"],
  ["CO-TOL", "CO", "Tolima"],
  ["CO-VAC", "CO", "Valle del Cauca"],
  ["CO-VAU", "CO", "Vaup\xE9s"],
  ["CO-VID", "CO", "Vichada"],
  ["CR-A", "CR", "Alajuela"],
  ["CR-C", "CR", "Cartago"],
  ["CR-G", "CR", "Guanacaste"],
  ["CR-H", "CR", "Heredia"],
  ["CR-L", "CR", "Lim\xF3n"],
  ["CR-P", "CR", "Puntarenas"],
  ["CR-SJ", "CR", "San Jos\xE9"],
  ["CU-01", "CU", "Pinar del R\xEDo"],
  ["CU-03", "CU", "Havana"],
  ["CU-04", "CU", "Matanzas"],
  ["CU-05", "CU", "Villa Clara"],
  ["CU-06", "CU", "Cienfuegos"],
  ["CU-07", "CU", "Sancti Sp\xEDritus"],
  ["CU-08", "CU", "Ciego de \xC1vila"],
  ["CU-09", "CU", "Camag\xFCey"],
  ["CU-10", "CU", "Las Tunas"],
  ["CU-11", "CU", "Holgu\xEDn"],
  ["CU-12", "CU", "Granma"],
  ["CU-13", "CU", "Santiago de Cuba"],
  ["CU-14", "CU", "Guant\xE1namo"],
  ["CU-15", "CU", "Artemisa"],
  ["CU-16", "CU", "Mayabeque"],
  ["CU-99", "CU", "Isla de la Juventud"],
  ["CV-B", "CV", "Barlavento Islands"],
  ["CV-BR", "CV", "Brava"],
  ["CV-BV", "CV", "Boa Vista"],
  ["CV-CA", "CV", "Santa Catarina"],
  ["CV-CF", "CV", "Santa Catarina do Fogo"],
  ["CV-CR", "CV", "Santa Cruz"],
  ["CV-MA", "CV", "Maio"],
  ["CV-MO", "CV", "Mosteiros"],
  ["CV-PA", "CV", "Paul"],
  ["CV-PN", "CV", "Porto Novo"],
  ["CV-PR", "CV", "Praia"],
  ["CV-RB", "CV", "Ribeira Brava"],
  ["CV-RG", "CV", "Ribeira Grande"],
  ["CV-RS", "CV", "Ribeira Grande de Santiago"],
  ["CV-S", "CV", "Sotavento Islands"],
  ["CV-SD", "CV", "S\xE3o Domingos"],
  ["CV-SF", "CV", "S\xE3o Filipe"],
  ["CV-SL", "CV", "Sal"],
  ["CV-SM", "CV", "S\xE3o Miguel"],
  ["CV-SO", "CV", "S\xE3o Louren\xE7o dos \xD3rg\xE3os"],
  ["CV-SS", "CV", "S\xE3o Salvador do Mundo"],
  ["CV-SV", "CV", "S\xE3o Vicente"],
  ["CV-TA", "CV", "Tarrafal"],
  ["CV-TS", "CV", "Tarrafal de S\xE3o Nicolau"],
  ["CY-01", "CY", "Nicosia"],
  ["CY-02", "CY", "Limassol"],
  ["CY-03", "CY", "Larnaca"],
  ["CY-04", "CY", "Famagusta"],
  ["CY-05", "CY", "Paphos"],
  ["CY-06", "CY", "Kyrenia"],
  ["CZ-10", "CZ", "Prague, Hlavn\xED me\u0161to"],
  ["CZ-20", "CZ", "St\u0159edo\u010Desk\xFD"],
  ["CZ-201", "CZ", "Bene\u0161ov"],
  ["CZ-202", "CZ", "Beroun"],
  ["CZ-203", "CZ", "Kladno"],
  ["CZ-204", "CZ", "Kol\xEDn"],
  ["CZ-205", "CZ", "Kutn\xE1 Hora"],
  ["CZ-206", "CZ", "M\u011Bln\xEDk"],
  ["CZ-207", "CZ", "Mlad\xE1 Boleslav"],
  ["CZ-208", "CZ", "Nymburk"],
  ["CZ-209", "CZ", "Prague-East"],
  ["CZ-20A", "CZ", "Prague-West"],
  ["CZ-20B", "CZ", "P\u0159\xEDbram"],
  ["CZ-20C", "CZ", "Rakovn\xEDk"],
  ["CZ-31", "CZ", "Jiho\u010Desk\xFD"],
  ["CZ-311", "CZ", "\u010Cesk\xE9 Bud\u011Bjovice"],
  ["CZ-312", "CZ", "\u010Cesk\xFD Krumlov"],
  ["CZ-313", "CZ", "Jind\u0159ich\u016Fv Hradec"],
  ["CZ-314", "CZ", "P\xEDsek"],
  ["CZ-315", "CZ", "Prachatice"],
  ["CZ-316", "CZ", "Strakonice"],
  ["CZ-317", "CZ", "T\xE1bor"],
  ["CZ-32", "CZ", "Plze\u0148sk\xFD"],
  ["CZ-321", "CZ", "Doma\u017Elice"],
  ["CZ-322", "CZ", "Klatovy"],
  ["CZ-323", "CZ", "Plze\u0148"],
  ["CZ-324", "CZ", "Plze\u0148-South"],
  ["CZ-325", "CZ", "Plze\u0148-North"],
  ["CZ-326", "CZ", "Rokycany"],
  ["CZ-327", "CZ", "Tachov"],
  ["CZ-41", "CZ", "Karlovarsk\xFD"],
  ["CZ-411", "CZ", "Cheb"],
  ["CZ-412", "CZ", "Karlovy Vary"],
  ["CZ-413", "CZ", "Sokolov"],
  ["CZ-42", "CZ", "\xDAsteck\xFD"],
  ["CZ-421", "CZ", "D\u011B\u010D\xEDn"],
  ["CZ-422", "CZ", "Chomutov"],
  ["CZ-423", "CZ", "Litom\u011B\u0159ice"],
  ["CZ-424", "CZ", "Louny"],
  ["CZ-425", "CZ", "Most"],
  ["CZ-426", "CZ", "Teplice"],
  ["CZ-427", "CZ", "\xDAst\xED nad Labem"],
  ["CZ-51", "CZ", "Libereck\xFD"],
  ["CZ-511", "CZ", "\u010Cesk\xE1 L\xEDpa"],
  ["CZ-512", "CZ", "Jablonec nad Nisou"],
  ["CZ-513", "CZ", "Liberec"],
  ["CZ-514", "CZ", "Semily"],
  ["CZ-52", "CZ", "Kr\xE1lov\xE9hradeck\xFD"],
  ["CZ-521", "CZ", "Hradec Kr\xE1lov\xE9"],
  ["CZ-522", "CZ", "Ji\u010D\xEDn"],
  ["CZ-523", "CZ", "N\xE1chod"],
  ["CZ-524", "CZ", "Rychnov nad Kn\u011B\u017Enou"],
  ["CZ-525", "CZ", "Trutnov"],
  ["CZ-53", "CZ", "Pardubick\xFD"],
  ["CZ-531", "CZ", "Chrudim"],
  ["CZ-532", "CZ", "Pardubice"],
  ["CZ-533", "CZ", "Svitavy"],
  ["CZ-534", "CZ", "\xDAst\xED nad Orlic\xED"],
  ["CZ-63", "CZ", "Vyso\u010Dina"],
  ["CZ-631", "CZ", "Havl\xED\u010Dk\u016Fv Brod"],
  ["CZ-632", "CZ", "Jihlava"],
  ["CZ-633", "CZ", "Pelh\u0159imov"],
  ["CZ-634", "CZ", "T\u0159eb\xED\u010D"],
  ["CZ-635", "CZ", "\u017D\u010F\xE1r nad S\xE1zavou"],
  ["CZ-64", "CZ", "Jihomoravsk\xFD"],
  ["CZ-641", "CZ", "Blansko"],
  ["CZ-642", "CZ", "Brno-m\u011Bsto"],
  ["CZ-643", "CZ", "Brno-venkov"],
  ["CZ-644", "CZ", "B\u0159eclav"],
  ["CZ-645", "CZ", "Hodon\xEDn"],
  ["CZ-646", "CZ", "Vy\u0161kov"],
  ["CZ-647", "CZ", "Znojmo"],
  ["CZ-71", "CZ", "Olomouck\xFD"],
  ["CZ-711", "CZ", "Jesen\xEDk"],
  ["CZ-712", "CZ", "Olomouc"],
  ["CZ-713", "CZ", "Prost\u011Bjov"],
  ["CZ-714", "CZ", "P\u0159erov"],
  ["CZ-715", "CZ", "\u0160umperk"],
  ["CZ-72", "CZ", "Zl\xEDnsk\xFD"],
  ["CZ-721", "CZ", "Krom\u011B\u0159\xED\u017E"],
  ["CZ-722", "CZ", "Uhersk\xE9 Hradi\u0161t\u011B"],
  ["CZ-723", "CZ", "Vset\xEDn"],
  ["CZ-724", "CZ", "Zl\xEDn"],
  ["CZ-80", "CZ", "Moravskoslezsk\xFD"],
  ["CZ-801", "CZ", "Brunt\xE1l"],
  ["CZ-802", "CZ", "Fr\xFDdek-M\xEDstek"],
  ["CZ-803", "CZ", "Karvin\xE1"],
  ["CZ-804", "CZ", "Nov\xFD Ji\u010D\xEDn"],
  ["CZ-805", "CZ", "Opava"],
  ["CZ-806", "CZ", "Ostrava"],
  ["DE-BB", "DE", "Brandenburg"],
  ["DE-BE", "DE", "Berlin"],
  ["DE-BW", "DE", "Baden-W\xFCrttemberg"],
  ["DE-BY", "DE", "Bavaria"],
  ["DE-HB", "DE", "Bremen"],
  ["DE-HE", "DE", "Hesse"],
  ["DE-HH", "DE", "Hamburg"],
  ["DE-MV", "DE", "Mecklenburg-Vorpommern"],
  ["DE-NI", "DE", "Lower Saxony"],
  ["DE-NW", "DE", "North Rhine-Westphalia"],
  ["DE-RP", "DE", "Rhineland-Palatinate"],
  ["DE-SH", "DE", "Schleswig-Holstein"],
  ["DE-SL", "DE", "Saarland"],
  ["DE-SN", "DE", "Saxony"],
  ["DE-ST", "DE", "Saxony-Anhalt"],
  ["DE-TH", "DE", "Thuringia"],
  ["DJ-AR", "DJ", "Arta"],
  ["DJ-AS", "DJ", "Ali Sabieh"],
  ["DJ-DI", "DJ", "Dikhil"],
  ["DJ-DJ", "DJ", "Djibouti"],
  ["DJ-OB", "DJ", "Obock"],
  ["DJ-TA", "DJ", "Tadjourah"],
  ["DK-81", "DK", "Northern Denmark"],
  ["DK-82", "DK", "Central Denmark"],
  ["DK-83", "DK", "Southern Denmark"],
  ["DK-84", "DK", "Capital Region"],
  ["DK-85", "DK", "Zealand"],
  ["DM-02", "DM", "Saint Andrew"],
  ["DM-03", "DM", "Saint David"],
  ["DM-04", "DM", "Saint George"],
  ["DM-05", "DM", "Saint John"],
  ["DM-06", "DM", "Saint Joseph"],
  ["DM-07", "DM", "Saint Luke"],
  ["DM-08", "DM", "Saint Mark"],
  ["DM-09", "DM", "Saint Patrick"],
  ["DM-10", "DM", "Saint Paul"],
  ["DM-11", "DM", "Saint Peter"],
  ["DO-01", "DO", "Distrito Nacional"],
  ["DO-02", "DO", "Azua"],
  ["DO-03", "DO", "Baoruco"],
  ["DO-04", "DO", "Barahona"],
  ["DO-05", "DO", "Dajab\xF3n"],
  ["DO-06", "DO", "Duarte"],
  ["DO-07", "DO", "El\xEDas Pi\xF1a"],
  ["DO-08", "DO", "El Seibo"],
  ["DO-09", "DO", "Espaillat"],
  ["DO-10", "DO", "Independencia"],
  ["DO-11", "DO", "La Altagracia"],
  ["DO-12", "DO", "La Romana"],
  ["DO-13", "DO", "La Vega"],
  ["DO-14", "DO", "Mar\xEDa Trinidad S\xE1nchez"],
  ["DO-15", "DO", "Monte Cristi"],
  ["DO-16", "DO", "Pedernales"],
  ["DO-17", "DO", "Peravia"],
  ["DO-18", "DO", "Puerto Plata"],
  ["DO-19", "DO", "Hermanas Mirabal"],
  ["DO-20", "DO", "Saman\xE1"],
  ["DO-21", "DO", "San Crist\xF3bal"],
  ["DO-22", "DO", "San Juan"],
  ["DO-23", "DO", "San Pedro de Macor\xEDs"],
  ["DO-24", "DO", "S\xE1nchez Ram\xEDrez"],
  ["DO-25", "DO", "Santiago"],
  ["DO-26", "DO", "Santiago Rodr\xEDguez"],
  ["DO-27", "DO", "Valverde"],
  ["DO-28", "DO", "Monse\xF1or Nouel"],
  ["DO-29", "DO", "Monte Plata"],
  ["DO-30", "DO", "Hato Mayor"],
  ["DO-31", "DO", "San Jos\xE9 de Ocoa"],
  ["DO-32", "DO", "Santo Domingo"],
  ["DO-33", "DO", "Cibao Nordeste"],
  ["DO-34", "DO", "Cibao Noroeste"],
  ["DO-35", "DO", "Cibao Norte"],
  ["DO-36", "DO", "Cibao Sur"],
  ["DO-37", "DO", "El Valle"],
  ["DO-38", "DO", "Enriquillo"],
  ["DO-39", "DO", "Hig\xFCamo"],
  ["DO-40", "DO", "Ozama"],
  ["DO-41", "DO", "Valdesia"],
  ["DO-42", "DO", "Yuma"],
  ["DZ-01", "DZ", "Adrar"],
  ["DZ-02", "DZ", "Chlef"],
  ["DZ-03", "DZ", "Laghouat"],
  ["DZ-04", "DZ", "Oum El Bouaghi"],
  ["DZ-05", "DZ", "Batna"],
  ["DZ-06", "DZ", "B\xE9ja\xEFa"],
  ["DZ-07", "DZ", "Biskra"],
  ["DZ-08", "DZ", "B\xE9char"],
  ["DZ-09", "DZ", "Blida"],
  ["DZ-10", "DZ", "Bouira"],
  ["DZ-11", "DZ", "Tamanghasset"],
  ["DZ-12", "DZ", "T\xE9bessa"],
  ["DZ-13", "DZ", "Tlemcen"],
  ["DZ-14", "DZ", "Tiaret"],
  ["DZ-15", "DZ", "Tizi Ouzou"],
  ["DZ-16", "DZ", "Algiers"],
  ["DZ-17", "DZ", "Djelfa"],
  ["DZ-18", "DZ", "Jijel"],
  ["DZ-19", "DZ", "S\xE9tif"],
  ["DZ-20", "DZ", "Sa\xEFda"],
  ["DZ-21", "DZ", "Skikda"],
  ["DZ-22", "DZ", "Sidi Bel Abb\xE8s"],
  ["DZ-23", "DZ", "Annaba"],
  ["DZ-24", "DZ", "Guelma"],
  ["DZ-25", "DZ", "Constantine"],
  ["DZ-26", "DZ", "M\xE9d\xE9a"],
  ["DZ-27", "DZ", "Mostaganem"],
  ["DZ-28", "DZ", "M\u2019Sila"],
  ["DZ-29", "DZ", "Mascara"],
  ["DZ-30", "DZ", "Ouargla"],
  ["DZ-31", "DZ", "Oran"],
  ["DZ-32", "DZ", "El Bayadh"],
  ["DZ-33", "DZ", "Illizi"],
  ["DZ-34", "DZ", "Bordj Bou Arr\xE9ridj"],
  ["DZ-35", "DZ", "Boumerd\xE8s"],
  ["DZ-36", "DZ", "El Tarf"],
  ["DZ-37", "DZ", "Tindouf"],
  ["DZ-38", "DZ", "Tissemsilt"],
  ["DZ-39", "DZ", "El Oued"],
  ["DZ-40", "DZ", "Khenchela"],
  ["DZ-41", "DZ", "Souk Ahras"],
  ["DZ-42", "DZ", "Tipasa"],
  ["DZ-43", "DZ", "Mila"],
  ["DZ-44", "DZ", "A\xEFn Defla"],
  ["DZ-45", "DZ", "Naama"],
  ["DZ-46", "DZ", "A\xEFn T\xE9mouchent"],
  ["DZ-47", "DZ", "Gharda\xEFa"],
  ["DZ-48", "DZ", "Relizane"],
  ["DZ-49", "DZ", "Timimoun"],
  ["DZ-50", "DZ", "Bordj Badji Mokhtar"],
  ["DZ-51", "DZ", "Ouled Djellal"],
  ["DZ-52", "DZ", "B\xE9ni Abb\xE8s"],
  ["DZ-53", "DZ", "In Salah"],
  ["DZ-54", "DZ", "In Guezzam"],
  ["DZ-55", "DZ", "Touggourt"],
  ["DZ-56", "DZ", "Djanet"],
  ["DZ-57", "DZ", "El Meghaier"],
  ["DZ-58", "DZ", "El Meniaa"],
  ["EC-A", "EC", "Azuay"],
  ["EC-B", "EC", "Bol\xEDvar"],
  ["EC-C", "EC", "Carchi"],
  ["EC-D", "EC", "Orellana"],
  ["EC-E", "EC", "Esmeraldas"],
  ["EC-F", "EC", "Ca\xF1ar"],
  ["EC-G", "EC", "Guayas"],
  ["EC-H", "EC", "Chimborazo"],
  ["EC-I", "EC", "Imbabura"],
  ["EC-L", "EC", "Loja"],
  ["EC-M", "EC", "Manab\xED"],
  ["EC-N", "EC", "Napo"],
  ["EC-O", "EC", "El Oro"],
  ["EC-P", "EC", "Pichincha"],
  ["EC-R", "EC", "Los R\xEDos"],
  ["EC-S", "EC", "Morona-Santiago"],
  ["EC-SD", "EC", "Santo Domingo de los Ts\xE1chilas"],
  ["EC-SE", "EC", "Santa Elena"],
  ["EC-T", "EC", "Tungurahua"],
  ["EC-U", "EC", "Sucumb\xEDos"],
  ["EC-W", "EC", "Gal\xE1pagos"],
  ["EC-X", "EC", "Cotopaxi"],
  ["EC-Y", "EC", "Pastaza"],
  ["EC-Z", "EC", "Zamora-Chinchipe"],
  ["EE-130", "EE", "Alutaguse"],
  ["EE-141", "EE", "Anija"],
  ["EE-142", "EE", "Antsla"],
  ["EE-171", "EE", "Elva"],
  ["EE-184", "EE", "Haapsalu"],
  ["EE-191", "EE", "Haljala"],
  ["EE-198", "EE", "Harku"],
  ["EE-205", "EE", "Hiiumaa"],
  ["EE-214", "EE", "H\xE4\xE4demeeste"],
  ["EE-245", "EE", "J\xF5el\xE4htme"],
  ["EE-247", "EE", "J\xF5geva"],
  ["EE-251", "EE", "J\xF5hvi"],
  ["EE-255", "EE", "J\xE4rva"],
  ["EE-272", "EE", "Kadrina"],
  ["EE-283", "EE", "Kambja"],
  ["EE-284", "EE", "Kanepi"],
  ["EE-291", "EE", "Kastre"],
  ["EE-293", "EE", "Kehtna"],
  ["EE-296", "EE", "Keila"],
  ["EE-303", "EE", "Kihnu"],
  ["EE-305", "EE", "Kiili"],
  ["EE-317", "EE", "Kohila"],
  ["EE-321", "EE", "Kohtla-J\xE4rve"],
  ["EE-338", "EE", "Kose"],
  ["EE-353", "EE", "Kuusalu"],
  ["EE-37", "EE", "Harju"],
  ["EE-39", "EE", "Hiiu"],
  ["EE-424", "EE", "Loksa"],
  ["EE-430", "EE", "L\xE4\xE4neranna"],
  ["EE-431", "EE", "L\xE4\xE4ne-Harju"],
  ["EE-432", "EE", "Luunja"],
  ["EE-441", "EE", "L\xE4\xE4ne-Nigula"],
  ["EE-442", "EE", "L\xFCganuse"],
  ["EE-446", "EE", "Maardu"],
  ["EE-45", "EE", "Ida-Virumaa"],
  ["EE-478", "EE", "Muhu"],
  ["EE-480", "EE", "Mulgi"],
  ["EE-486", "EE", "Mustvee"],
  ["EE-50", "EE", "J\xF5gevamaa"],
  ["EE-503", "EE", "M\xE4rjamaa"],
  ["EE-511", "EE", "Narva"],
  ["EE-514", "EE", "Narva-J\xF5esuu"],
  ["EE-52", "EE", "J\xE4rvamaa"],
  ["EE-528", "EE", "N\xF5o"],
  ["EE-557", "EE", "Otep\xE4\xE4"],
  ["EE-56", "EE", "L\xE4\xE4nemaa"],
  ["EE-567", "EE", "Paide"],
  ["EE-586", "EE", "Peipsi\xE4\xE4re"],
  ["EE-60", "EE", "L\xE4\xE4ne-Virumaa"],
  ["EE-615", "EE", "P\xF5hja-Sakala"],
  ["EE-618", "EE", "P\xF5ltsamaa"],
  ["EE-622", "EE", "P\xF5lva"],
  ["EE-624", "EE", "P\xE4rnu"],
  ["EE-638", "EE", "P\xF5hja-P\xE4rnumaa"],
  ["EE-64", "EE", "P\xF5lvamaa"],
  ["EE-651", "EE", "Raasiku"],
  ["EE-653", "EE", "Rae"],
  ["EE-661", "EE", "Rakvere"],
  ["EE-663", "EE", "Rakvere\xB2"],
  ["EE-668", "EE", "Rapla"],
  ["EE-68", "EE", "P\xE4rnumaa"],
  ["EE-689", "EE", "Ruhnu"],
  ["EE-698", "EE", "R\xF5uge"],
  ["EE-708", "EE", "R\xE4pina"],
  ["EE-71", "EE", "Raplamaa"],
  ["EE-712", "EE", "Saarde"],
  ["EE-714", "EE", "Saaremaa"],
  ["EE-719", "EE", "Saku"],
  ["EE-726", "EE", "Saue"],
  ["EE-732", "EE", "Setomaa"],
  ["EE-735", "EE", "Sillam\xE4e"],
  ["EE-74", "EE", "Saare"],
  ["EE-784", "EE", "Tallinn"],
  ["EE-79", "EE", "Tartumaa"],
  ["EE-792", "EE", "Tapa"],
  ["EE-793", "EE", "Tartu"],
  ["EE-796", "EE", "Tartu\xB2"],
  ["EE-803", "EE", "Toila"],
  ["EE-809", "EE", "Tori"],
  ["EE-81", "EE", "Valgamaa"],
  ["EE-824", "EE", "T\xF5rva"],
  ["EE-834", "EE", "T\xFCri"],
  ["EE-84", "EE", "Viljandi"],
  ["EE-855", "EE", "Valga"],
  ["EE-87", "EE", "V\xF5rumaa"],
  ["EE-890", "EE", "Viimsi"],
  ["EE-897", "EE", "Viljandi\xB2"],
  ["EE-899", "EE", "Viljandi\xB3"],
  ["EE-901", "EE", "Vinni"],
  ["EE-903", "EE", "Viru-Nigula"],
  ["EE-907", "EE", "Vormsi"],
  ["EE-917", "EE", "V\xF5ru\xB2"],
  ["EE-919", "EE", "V\xF5ru"],
  ["EE-928", "EE", "V\xE4ike-Maarja"],
  ["EG-ALX", "EG", "Alexandria"],
  ["EG-ASN", "EG", "Aswan"],
  ["EG-AST", "EG", "Asyut"],
  ["EG-BA", "EG", "Red Sea"],
  ["EG-BH", "EG", "Beheira"],
  ["EG-BNS", "EG", "Beni Suef"],
  ["EG-C", "EG", "Cairo"],
  ["EG-DK", "EG", "Dakahlia"],
  ["EG-DT", "EG", "Damietta"],
  ["EG-FYM", "EG", "Faiyum"],
  ["EG-GH", "EG", "Gharbia"],
  ["EG-GZ", "EG", "Giza"],
  ["EG-IS", "EG", "Ismailia"],
  ["EG-JS", "EG", "South Sinai"],
  ["EG-KB", "EG", "Qalyubia"],
  ["EG-KFS", "EG", "Kafr el-Sheikh"],
  ["EG-KN", "EG", "Qena"],
  ["EG-LX", "EG", "Luxor"],
  ["EG-MN", "EG", "Minya"],
  ["EG-MNF", "EG", "Monufia"],
  ["EG-MT", "EG", "Matrouh"],
  ["EG-PTS", "EG", "Port Said"],
  ["EG-SHG", "EG", "Sohag"],
  ["EG-SHR", "EG", "Al Sharqia"],
  ["EG-SIN", "EG", "North Sinai"],
  ["EG-SUZ", "EG", "Suez"],
  ["EG-WAD", "EG", "New Valley"],
  ["ER-AN", "ER", "Anseba"],
  ["ER-DK", "ER", "Southern Red Sea"],
  ["ER-DU", "ER", "Debub"],
  ["ER-GB", "ER", "Gash-Barka"],
  ["ER-MA", "ER", "Maekel"],
  ["ER-SK", "ER", "Northern Red Sea"],
  ["ES-A", "ES", "Alicante"],
  ["ES-AB", "ES", "Albacete"],
  ["ES-AL", "ES", "Almer\xEDa"],
  ["ES-AN", "ES", "Andalusia"],
  ["ES-AR", "ES", "Aragon"],
  ["ES-AS", "ES", "Asturias"],
  ["ES-AV", "ES", "\xC1vila"],
  ["ES-B", "ES", "Barcelona"],
  ["ES-BA", "ES", "Badajoz"],
  ["ES-BI", "ES", "Biscay"],
  ["ES-BU", "ES", "Burgos"],
  ["ES-C", "ES", "A Coru\xF1a"],
  ["ES-CA", "ES", "C\xE1diz"],
  ["ES-CB", "ES", "Cantabria"],
  ["ES-CC", "ES", "C\xE1ceres"],
  ["ES-CE", "ES", "Ceuta"],
  ["ES-CL", "ES", "Castile and Le\xF3n"],
  ["ES-CM", "ES", "Castile-La Mancha"],
  ["ES-CN", "ES", "Canary Islands"],
  ["ES-CO", "ES", "C\xF3rdoba"],
  ["ES-CR", "ES", "Ciudad Real"],
  ["ES-CS", "ES", "Castell\xF3n"],
  ["ES-CT", "ES", "Catalonia"],
  ["ES-CU", "ES", "Cuenca"],
  ["ES-EX", "ES", "Extremadura"],
  ["ES-GA", "ES", "Galicia"],
  ["ES-GC", "ES", "Las Palmas"],
  ["ES-GI", "ES", "Girona"],
  ["ES-GR", "ES", "Granada"],
  ["ES-GU", "ES", "Guadalajara"],
  ["ES-H", "ES", "Huelva"],
  ["ES-HU", "ES", "Huesca"],
  ["ES-IB", "ES", "Balearic Islands"],
  ["ES-J", "ES", "Ja\xE9n"],
  ["ES-L", "ES", "Lleida"],
  ["ES-LE", "ES", "Le\xF3n"],
  ["ES-LO", "ES", "La Rioja Province"],
  ["ES-LU", "ES", "Lugo"],
  ["ES-M", "ES", "Madrid Province"],
  ["ES-MA", "ES", "M\xE1laga"],
  ["ES-MC", "ES", "Murcia Region"],
  ["ES-MD", "ES", "Madrid Autonomous Community"],
  ["ES-ML", "ES", "Melilla"],
  ["ES-MU", "ES", "Murcia"],
  ["ES-NA", "ES", "Navarra"],
  ["ES-NC", "ES", "Navarra Chartered Community"],
  ["ES-O", "ES", "Asturias Province"],
  ["ES-OR", "ES", "Ourense"],
  ["ES-P", "ES", "Palencia"],
  ["ES-PM", "ES", "Balears Province"],
  ["ES-PO", "ES", "Pontevedra"],
  ["ES-PV", "ES", "Basque Country"],
  ["ES-RI", "ES", "La Rioja"],
  ["ES-S", "ES", "Cantabria Province"],
  ["ES-SA", "ES", "Salamanca"],
  ["ES-SE", "ES", "Seville"],
  ["ES-SG", "ES", "Segovia"],
  ["ES-SO", "ES", "Soria"],
  ["ES-SS", "ES", "Gipuzkoa"],
  ["ES-T", "ES", "Tarragona"],
  ["ES-TE", "ES", "Teruel"],
  ["ES-TF", "ES", "Santa Cruz de Tenerife"],
  ["ES-TO", "ES", "Toledo"],
  ["ES-V", "ES", "Valencia"],
  ["ES-VA", "ES", "Valladolid"],
  ["ES-VC", "ES", "Valencian Community"],
  ["ES-VI", "ES", "\xC1lava"],
  ["ES-Z", "ES", "Zaragoza"],
  ["ES-ZA", "ES", "Zamora"],
  ["ET-AA", "ET", "Addis Ababa"],
  ["ET-AF", "ET", "Afar"],
  ["ET-AM", "ET", "Amhara"],
  ["ET-BE", "ET", "Benishangul-Gumuz"],
  ["ET-DD", "ET", "Dire Dawa"],
  ["ET-GA", "ET", "Gambela"],
  ["ET-HA", "ET", "Harari"],
  ["ET-OR", "ET", "Oromia"],
  ["ET-SI", "ET", "Sidama"],
  ["ET-SN", "ET", "Southern Nations, Nationalities, and Peoples"],
  ["ET-SO", "ET", "Somali"],
  ["ET-SW", "ET", "Southwest Ethiopia Peoples"],
  ["ET-TI", "ET", "Tigray"],
  ["FI-01", "FI", "\xC5land"],
  ["FI-02", "FI", "South Karelia"],
  ["FI-03", "FI", "Southern Ostrobothnia"],
  ["FI-04", "FI", "Southern Savonia"],
  ["FI-05", "FI", "Kainuu"],
  ["FI-06", "FI", "Tavastia Proper"],
  ["FI-07", "FI", "Central Ostrobothnia"],
  ["FI-08", "FI", "Central Finland"],
  ["FI-09", "FI", "Kymenlaakso"],
  ["FI-10", "FI", "Lapland"],
  ["FI-11", "FI", "Pirkanmaa"],
  ["FI-12", "FI", "Ostrobothnia"],
  ["FI-13", "FI", "North Karelia"],
  ["FI-14", "FI", "Northern Ostrobothnia"],
  ["FI-15", "FI", "Northern Savonia"],
  ["FI-16", "FI", "P\xE4ij\xE4nne Tavastia"],
  ["FI-17", "FI", "Satakunta"],
  ["FI-18", "FI", "Uusimaa"],
  ["FI-19", "FI", "Southwest Finland"],
  ["FJ-01", "FJ", "Ba"],
  ["FJ-02", "FJ", "Bua"],
  ["FJ-03", "FJ", "Cakaudrove"],
  ["FJ-04", "FJ", "Kadavu"],
  ["FJ-05", "FJ", "Lau"],
  ["FJ-06", "FJ", "Lomaiviti"],
  ["FJ-07", "FJ", "Macuata"],
  ["FJ-08", "FJ", "Nadroga-Navosa"],
  ["FJ-09", "FJ", "Naitasiri"],
  ["FJ-10", "FJ", "Namosi"],
  ["FJ-11", "FJ", "Ra"],
  ["FJ-12", "FJ", "Rewa"],
  ["FJ-13", "FJ", "Serua"],
  ["FJ-14", "FJ", "Tailevu"],
  ["FJ-C", "FJ", "Central"],
  ["FJ-E", "FJ", "Eastern"],
  ["FJ-N", "FJ", "Northern"],
  ["FJ-R", "FJ", "Rotuma"],
  ["FJ-W", "FJ", "Western"],
  ["FM-KSA", "FM", "Kosrae"],
  ["FM-PNI", "FM", "Pohnpei"],
  ["FM-TRK", "FM", "Chuuk"],
  ["FM-YAP", "FM", "Yap"],
  ["FR-01", "FR", "Ain"],
  ["FR-02", "FR", "Aisne"],
  ["FR-03", "FR", "Allier"],
  ["FR-04", "FR", "Alpes-de-Haute-Provence"],
  ["FR-05", "FR", "Hautes-Alpes"],
  ["FR-06", "FR", "Alpes-Maritimes"],
  ["FR-07", "FR", "Ard\xE8che"],
  ["FR-08", "FR", "Ardennes"],
  ["FR-09", "FR", "Ari\xE8ge"],
  ["FR-10", "FR", "Aube"],
  ["FR-11", "FR", "Aude"],
  ["FR-12", "FR", "Aveyron"],
  ["FR-13", "FR", "Bouches-du-Rh\xF4ne"],
  ["FR-14", "FR", "Calvados"],
  ["FR-15", "FR", "Cantal"],
  ["FR-16", "FR", "Charente"],
  ["FR-17", "FR", "Charente-Maritime"],
  ["FR-18", "FR", "Cher"],
  ["FR-19", "FR", "Corr\xE8ze"],
  ["FR-20R", "FR", "Corse"],
  ["FR-21", "FR", "C\xF4te-d\u2019Or"],
  ["FR-22", "FR", "C\xF4tes-d\u2019Armor"],
  ["FR-23", "FR", "Creuse"],
  ["FR-24", "FR", "Dordogne"],
  ["FR-25", "FR", "Doubs"],
  ["FR-26", "FR", "Dr\xF4me"],
  ["FR-27", "FR", "Eure"],
  ["FR-28", "FR", "Eure-et-Loir"],
  ["FR-29", "FR", "Finist\xE8re"],
  ["FR-2A", "FR", "Corse-du-Sud"],
  ["FR-2B", "FR", "Haute-Corse"],
  ["FR-30", "FR", "Gard"],
  ["FR-31", "FR", "Haute-Garonne"],
  ["FR-32", "FR", "Gers"],
  ["FR-33", "FR", "Gironde"],
  ["FR-34", "FR", "H\xE9rault"],
  ["FR-35", "FR", "Ille-et-Vilaine"],
  ["FR-36", "FR", "Indre"],
  ["FR-37", "FR", "Indre-et-Loire"],
  ["FR-38", "FR", "Is\xE8re"],
  ["FR-39", "FR", "Jura"],
  ["FR-40", "FR", "Landes"],
  ["FR-41", "FR", "Loir-et-Cher"],
  ["FR-42", "FR", "Loire"],
  ["FR-43", "FR", "Haute-Loire"],
  ["FR-44", "FR", "Loire-Atlantique"],
  ["FR-45", "FR", "Loiret"],
  ["FR-46", "FR", "Lot"],
  ["FR-47", "FR", "Lot-et-Garonne"],
  ["FR-48", "FR", "Loz\xE8re"],
  ["FR-49", "FR", "Maine-et-Loire"],
  ["FR-50", "FR", "Manche"],
  ["FR-51", "FR", "Marne"],
  ["FR-52", "FR", "Haute-Marne"],
  ["FR-53", "FR", "Mayenne"],
  ["FR-54", "FR", "Meurthe-et-Moselle"],
  ["FR-55", "FR", "Meuse"],
  ["FR-56", "FR", "Morbihan"],
  ["FR-57", "FR", "Moselle"],
  ["FR-58", "FR", "Ni\xE8vre"],
  ["FR-59", "FR", "Nord"],
  ["FR-60", "FR", "Oise"],
  ["FR-61", "FR", "Orne"],
  ["FR-62", "FR", "Pas-de-Calais"],
  ["FR-63", "FR", "Puy-de-D\xF4me"],
  ["FR-64", "FR", "Pyr\xE9n\xE9es-Atlantiques"],
  ["FR-65", "FR", "Hautes-Pyr\xE9n\xE9es"],
  ["FR-66", "FR", "Pyr\xE9n\xE9es-Orientales"],
  ["FR-67", "FR", "Bas-Rhin"],
  ["FR-68", "FR", "Haut-Rhin"],
  ["FR-69", "FR", "Rh\xF4ne"],
  ["FR-69M", "FR", "M\xE9tropole de Lyon"],
  ["FR-6AE", "FR", "Alsace"],
  ["FR-70", "FR", "Haute-Sa\xF4ne"],
  ["FR-71", "FR", "Sa\xF4ne-et-Loire"],
  ["FR-72", "FR", "Sarthe"],
  ["FR-73", "FR", "Savoie"],
  ["FR-74", "FR", "Haute-Savoie"],
  ["FR-75C", "FR", "Paris"],
  ["FR-76", "FR", "Seine-Maritime"],
  ["FR-77", "FR", "Seine-et-Marne"],
  ["FR-78", "FR", "Yvelines"],
  ["FR-79", "FR", "Deux-S\xE8vres"],
  ["FR-80", "FR", "Somme"],
  ["FR-81", "FR", "Tarn"],
  ["FR-82", "FR", "Tarn-et-Garonne"],
  ["FR-83", "FR", "Var"],
  ["FR-84", "FR", "Vaucluse"],
  ["FR-85", "FR", "Vend\xE9e"],
  ["FR-86", "FR", "Vienne"],
  ["FR-87", "FR", "Haute-Vienne"],
  ["FR-88", "FR", "Vosges"],
  ["FR-89", "FR", "Yonne"],
  ["FR-90", "FR", "Territoire de Belfort"],
  ["FR-91", "FR", "Essonne"],
  ["FR-92", "FR", "Hauts-de-Seine"],
  ["FR-93", "FR", "Seine-Saint-Denis"],
  ["FR-94", "FR", "Val-de-Marne"],
  ["FR-95", "FR", "Val-d\u2019Oise"],
  ["FR-971", "FR", "Guadeloupe"],
  ["FR-972", "FR", "Martinique"],
  ["FR-973", "FR", "Guyane (fran\xE7aise)"],
  ["FR-974", "FR", "La R\xE9union"],
  ["FR-976", "FR", "Mayotte"],
  ["FR-ARA", "FR", "Auvergne-Rh\xF4ne-Alpes"],
  ["FR-BFC", "FR", "Burgundy-Franche-Comt\xE9"],
  ["FR-BL", "FR", "St. Barth\xE9lemy"],
  ["FR-BRE", "FR", "Brittany"],
  ["FR-CP", "FR", "Clipperton Island"],
  ["FR-CVL", "FR", "Centre-Val de Loire"],
  ["FR-GES", "FR", "Grand-Est"],
  ["FR-HDF", "FR", "Hauts-de-France"],
  ["FR-IDF", "FR", "\xCEle-de-France\xB2"],
  ["FR-MF", "FR", "St. Martin"],
  ["FR-NAQ", "FR", "Nouvelle-Aquitaine"],
  ["FR-NC", "FR", "New Caledonia"],
  ["FR-NOR", "FR", "Normandie"],
  ["FR-OCC", "FR", "Occitanie"],
  ["FR-PAC", "FR", "Provence-Alpes-C\xF4te-d\u2019Azur"],
  ["FR-PDL", "FR", "Pays-de-la-Loire"],
  ["FR-PF", "FR", "French Polynesia"],
  ["FR-PM", "FR", "St. Pierre & Miquelon"],
  ["FR-TF", "FR", "French Southern Territories"],
  ["FR-WF", "FR", "Wallis & Futuna"],
  ["GA-1", "GA", "Estuaire"],
  ["GA-2", "GA", "Haut-Ogoou\xE9"],
  ["GA-3", "GA", "Moyen-Ogoou\xE9"],
  ["GA-4", "GA", "Ngouni\xE9"],
  ["GA-5", "GA", "Nyanga"],
  ["GA-6", "GA", "Ogoou\xE9-Ivindo"],
  ["GA-7", "GA", "Ogoou\xE9-Lolo"],
  ["GA-8", "GA", "Ogoou\xE9-Maritime"],
  ["GA-9", "GA", "Woleu-Ntem"],
  ["GB-ABC", "GB", "Armagh, Banbridge and Craigavon"],
  ["GB-ABD", "GB", "Aberdeenshire"],
  ["GB-ABE", "GB", "Aberdeen"],
  ["GB-AGB", "GB", "Argyll and Bute"],
  ["GB-AGY", "GB", "Anglesey"],
  ["GB-AND", "GB", "Ards and North Down"],
  ["GB-ANN", "GB", "Antrim and Newtownabbey"],
  ["GB-ANS", "GB", "Angus"],
  ["GB-BAS", "GB", "Bath and North East Somerset"],
  ["GB-BBD", "GB", "Blackburn with Darwen"],
  ["GB-BCP", "GB", "Bournemouth, Christchurch and Poole"],
  ["GB-BDF", "GB", "Bedford"],
  ["GB-BDG", "GB", "Barking and Dagenham"],
  ["GB-BEN", "GB", "Brent"],
  ["GB-BEX", "GB", "Bexley"],
  ["GB-BFS", "GB", "Belfast"],
  ["GB-BGE", "GB", "Bridgend"],
  ["GB-BGW", "GB", "Blaenau Gwent"],
  ["GB-BIR", "GB", "Birmingham"],
  ["GB-BKM", "GB", "Buckinghamshire"],
  ["GB-BNE", "GB", "Barnet"],
  ["GB-BNH", "GB", "Brighton and Hove"],
  ["GB-BNS", "GB", "Barnsley"],
  ["GB-BOL", "GB", "Bolton"],
  ["GB-BPL", "GB", "Blackpool"],
  ["GB-BRC", "GB", "Bracknell Forest"],
  ["GB-BRD", "GB", "Bradford"],
  ["GB-BRY", "GB", "Bromley"],
  ["GB-BST", "GB", "Bristol"],
  ["GB-BUR", "GB", "Bury"],
  ["GB-CAM", "GB", "Cambridgeshire"],
  ["GB-CAY", "GB", "Caerphilly"],
  ["GB-CBF", "GB", "Central Bedfordshire"],
  ["GB-CCG", "GB", "Causeway Coast and Glens"],
  ["GB-CGN", "GB", "Ceredigion"],
  ["GB-CHE", "GB", "Cheshire East"],
  ["GB-CHW", "GB", "Cheshire West and Chester"],
  ["GB-CLD", "GB", "Calderdale"],
  ["GB-CLK", "GB", "Clackmannanshire"],
  ["GB-CMA", "GB", "Cumbria"],
  ["GB-CMD", "GB", "Camden"],
  ["GB-CMN", "GB", "Carmarthenshire"],
  ["GB-CON", "GB", "Cornwall"],
  ["GB-COV", "GB", "Coventry"],
  ["GB-CRF", "GB", "Cardiff"],
  ["GB-CRY", "GB", "Croydon"],
  ["GB-CWY", "GB", "Conwy"],
  ["GB-DAL", "GB", "Darlington"],
  ["GB-DBY", "GB", "Derbyshire"],
  ["GB-DEN", "GB", "Denbighshire"],
  ["GB-DER", "GB", "Derby"],
  ["GB-DEV", "GB", "Devon"],
  ["GB-DGY", "GB", "Dumfries and Galloway"],
  ["GB-DNC", "GB", "Doncaster"],
  ["GB-DND", "GB", "Dundee"],
  ["GB-DOR", "GB", "Dorset"],
  ["GB-DRS", "GB", "Derry and Strabane"],
  ["GB-DUD", "GB", "Dudley"],
  ["GB-DUR", "GB", "Durham"],
  ["GB-EAL", "GB", "Ealing"],
  ["GB-EAY", "GB", "East Ayrshire"],
  ["GB-EDH", "GB", "Edinburgh"],
  ["GB-EDU", "GB", "East Dunbartonshire"],
  ["GB-ELN", "GB", "East Lothian"],
  ["GB-ELS", "GB", "Outer Hebrides"],
  ["GB-ENF", "GB", "Enfield"],
  ["GB-ENG", "GB", "England"],
  ["GB-ERW", "GB", "East Renfrewshire"],
  ["GB-ERY", "GB", "East Riding of Yorkshire"],
  ["GB-ESS", "GB", "Essex"],
  ["GB-ESX", "GB", "East Sussex"],
  ["GB-FAL", "GB", "Falkirk"],
  ["GB-FIF", "GB", "Fife"],
  ["GB-FLN", "GB", "Flintshire"],
  ["GB-FMO", "GB", "Fermanagh and Omagh"],
  ["GB-GAT", "GB", "Gateshead"],
  ["GB-GLG", "GB", "Glasgow"],
  ["GB-GLS", "GB", "Gloucestershire"],
  ["GB-GRE", "GB", "Greenwich"],
  ["GB-GWN", "GB", "Gwynedd"],
  ["GB-HAL", "GB", "Halton"],
  ["GB-HAM", "GB", "Hampshire"],
  ["GB-HAV", "GB", "Havering"],
  ["GB-HCK", "GB", "Hackney"],
  ["GB-HEF", "GB", "Herefordshire"],
  ["GB-HIL", "GB", "Hillingdon"],
  ["GB-HLD", "GB", "Highland"],
  ["GB-HMF", "GB", "Hammersmith and Fulham"],
  ["GB-HNS", "GB", "Hounslow"],
  ["GB-HPL", "GB", "Hartlepool"],
  ["GB-HRT", "GB", "Hertfordshire"],
  ["GB-HRW", "GB", "Harrow"],
  ["GB-HRY", "GB", "Haringey"],
  ["GB-IOS", "GB", "Isles of Scilly"],
  ["GB-IOW", "GB", "Isle of Wight"],
  ["GB-ISL", "GB", "Islington"],
  ["GB-IVC", "GB", "Inverclyde"],
  ["GB-KEC", "GB", "Kensington and Chelsea"],
  ["GB-KEN", "GB", "Kent"],
  ["GB-KHL", "GB", "Kingston upon Hull"],
  ["GB-KIR", "GB", "Kirklees"],
  ["GB-KTT", "GB", "Kingston upon Thames"],
  ["GB-KWL", "GB", "Knowsley"],
  ["GB-LAN", "GB", "Lancashire"],
  ["GB-LBC", "GB", "Lisburn and Castlereagh"],
  ["GB-LBH", "GB", "Lambeth"],
  ["GB-LCE", "GB", "Leicester"],
  ["GB-LDS", "GB", "Leeds"],
  ["GB-LEC", "GB", "Leicestershire"],
  ["GB-LEW", "GB", "Lewisham"],
  ["GB-LIN", "GB", "Lincolnshire"],
  ["GB-LIV", "GB", "Liverpool"],
  ["GB-LND", "GB", "London"],
  ["GB-LUT", "GB", "Luton"],
  ["GB-MAN", "GB", "Manchester"],
  ["GB-MDB", "GB", "Middlesbrough"],
  ["GB-MDW", "GB", "Medway"],
  ["GB-MEA", "GB", "Mid and East Antrim"],
  ["GB-MIK", "GB", "Milton Keynes"],
  ["GB-MLN", "GB", "Midlothian"],
  ["GB-MON", "GB", "Monmouthshire"],
  ["GB-MRT", "GB", "Merton"],
  ["GB-MRY", "GB", "Moray"],
  ["GB-MTY", "GB", "Merthyr Tydfil"],
  ["GB-MUL", "GB", "Mid Ulster"],
  ["GB-NAY", "GB", "North Ayrshire"],
  ["GB-NBL", "GB", "Northumberland"],
  ["GB-NEL", "GB", "North East Lincolnshire"],
  ["GB-NET", "GB", "Newcastle upon Tyne"],
  ["GB-NFK", "GB", "Norfolk"],
  ["GB-NGM", "GB", "Nottingham"],
  ["GB-NIR", "GB", "Northern Ireland"],
  ["GB-NLK", "GB", "North Lanarkshire"],
  ["GB-NLN", "GB", "North Lincolnshire"],
  ["GB-NMD", "GB", "Newry, Mourne and Down"],
  ["GB-NNH", "GB", "North Northamptonshire"],
  ["GB-NSM", "GB", "North Somerset"],
  ["GB-NTL", "GB", "Neath Port Talbot"],
  ["GB-NTT", "GB", "Nottinghamshire"],
  ["GB-NTY", "GB", "North Tyneside"],
  ["GB-NWM", "GB", "Newham"],
  ["GB-NWP", "GB", "Newport"],
  ["GB-NYK", "GB", "North Yorkshire"],
  ["GB-OLD", "GB", "Oldham"],
  ["GB-ORK", "GB", "Orkney Islands"],
  ["GB-OXF", "GB", "Oxfordshire"],
  ["GB-PEM", "GB", "Pembrokeshire"],
  ["GB-PKN", "GB", "Perth and Kinross"],
  ["GB-PLY", "GB", "Plymouth"],
  ["GB-POR", "GB", "Portsmouth"],
  ["GB-POW", "GB", "Powys"],
  ["GB-PTE", "GB", "Peter"],
  ["GB-RCC", "GB", "Redcar and Cleveland"],
  ["GB-RCH", "GB", "Rochdale"],
  ["GB-RCT", "GB", "Rhondda Cynon Taf"],
  ["GB-RDB", "GB", "Redbridge"],
  ["GB-RDG", "GB", "Reading"],
  ["GB-RFW", "GB", "Renfrewshire"],
  ["GB-RIC", "GB", "Richmond upon Thames"],
  ["GB-ROT", "GB", "Rotherham"],
  ["GB-RUT", "GB", "Rutland"],
  ["GB-SAW", "GB", "Sandwell"],
  ["GB-SAY", "GB", "South Ayrshire"],
  ["GB-SCB", "GB", "Scottish Borders"],
  ["GB-SCT", "GB", "Scotland"],
  ["GB-SFK", "GB", "Suffolk"],
  ["GB-SFT", "GB", "Sefton"],
  ["GB-SGC", "GB", "South Gloucestershire"],
  ["GB-SHF", "GB", "Sheffield"],
  ["GB-SHN", "GB", "Saint Helens"],
  ["GB-SHR", "GB", "Shropshire"],
  ["GB-SKP", "GB", "Stockport"],
  ["GB-SLF", "GB", "Salford"],
  ["GB-SLG", "GB", "Slough"],
  ["GB-SLK", "GB", "South Lanarkshire"],
  ["GB-SND", "GB", "Sunderland"],
  ["GB-SOL", "GB", "Solihull"],
  ["GB-SOM", "GB", "Somerset"],
  ["GB-SOS", "GB", "Southend-on-Sea"],
  ["GB-SRY", "GB", "Surrey"],
  ["GB-STE", "GB", "Stoke-on-Trent"],
  ["GB-STG", "GB", "Stirling"],
  ["GB-STH", "GB", "Southampton"],
  ["GB-STN", "GB", "Sutton"],
  ["GB-STS", "GB", "Staffordshire"],
  ["GB-STT", "GB", "Stockton-on-Tees"],
  ["GB-STY", "GB", "South Tyneside"],
  ["GB-SWA", "GB", "Swansea"],
  ["GB-SWD", "GB", "Swindon"],
  ["GB-SWK", "GB", "Southwark"],
  ["GB-TAM", "GB", "Tameside"],
  ["GB-TFW", "GB", "Telford and Wrekin"],
  ["GB-THR", "GB", "Thurrock"],
  ["GB-TOB", "GB", "Torbay"],
  ["GB-TOF", "GB", "Torfaen"],
  ["GB-TRF", "GB", "Trafford"],
  ["GB-TWH", "GB", "Tower Hamlets"],
  ["GB-VGL", "GB", "Vale of Glamorgan"],
  ["GB-WAR", "GB", "Warwickshire"],
  ["GB-WBK", "GB", "West Berkshire"],
  ["GB-WDU", "GB", "West Dunbartonshire"],
  ["GB-WFT", "GB", "Waltham Forest"],
  ["GB-WGN", "GB", "Wigan"],
  ["GB-WIL", "GB", "Wiltshire"],
  ["GB-WKF", "GB", "Wakefield"],
  ["GB-WLL", "GB", "Walsall"],
  ["GB-WLN", "GB", "West Lothian"],
  ["GB-WLS", "GB", "Wales"],
  ["GB-WLV", "GB", "Wolverhampton"],
  ["GB-WND", "GB", "Wandsworth"],
  ["GB-WNH", "GB", "West Northamptonshire"],
  ["GB-WNM", "GB", "Windsor and Maidenhead"],
  ["GB-WOK", "GB", "Wokingham"],
  ["GB-WOR", "GB", "Worcestershire"],
  ["GB-WRL", "GB", "Wirral"],
  ["GB-WRT", "GB", "Warrington"],
  ["GB-WRX", "GB", "Wrexham"],
  ["GB-WSM", "GB", "Westminster"],
  ["GB-WSX", "GB", "West Sussex"],
  ["GB-YOR", "GB", "York"],
  ["GB-ZET", "GB", "Shetland"],
  ["GD-01", "GD", "Saint Andrew"],
  ["GD-02", "GD", "Saint David"],
  ["GD-03", "GD", "Saint George"],
  ["GD-04", "GD", "Saint John"],
  ["GD-05", "GD", "Saint Mark"],
  ["GD-06", "GD", "Saint Patrick"],
  ["GD-10", "GD", "Carriacou and Petite Martinique"],
  ["GE-AB", "GE", "Abkhazia"],
  ["GE-AJ", "GE", "Adjara"],
  ["GE-GU", "GE", "Guria"],
  ["GE-IM", "GE", "Imereti"],
  ["GE-KA", "GE", "Kakheti"],
  ["GE-KK", "GE", "Kvemo Kartli"],
  ["GE-MM", "GE", "Mtskheta-Mtianeti"],
  ["GE-RL", "GE", "Racha-Lechkhumi and Kvemo Svaneti"],
  ["GE-SJ", "GE", "Samtskhe-Javakheti"],
  ["GE-SK", "GE", "Shida Kartli"],
  ["GE-SZ", "GE", "Samegrelo-Zemo Svaneti"],
  ["GE-TB", "GE", "Tbilisi"],
  ["GH-AA", "GH", "Greater Accra"],
  ["GH-AF", "GH", "Ahafo"],
  ["GH-AH", "GH", "Ashanti"],
  ["GH-BE", "GH", "Bono East"],
  ["GH-BO", "GH", "Bono"],
  ["GH-CP", "GH", "Central"],
  ["GH-EP", "GH", "Eastern"],
  ["GH-NE", "GH", "North East"],
  ["GH-NP", "GH", "Northern"],
  ["GH-OT", "GH", "Oti"],
  ["GH-SV", "GH", "Savannah"],
  ["GH-TV", "GH", "Volta"],
  ["GH-UE", "GH", "Upper East"],
  ["GH-UW", "GH", "Upper West"],
  ["GH-WN", "GH", "Western North"],
  ["GH-WP", "GH", "Western"],
  ["GL-AV", "GL", "Avannaata Kommunia"],
  ["GL-KU", "GL", "Kujalleq"],
  ["GL-QE", "GL", "Qeqqata"],
  ["GL-QT", "GL", "Kommune Qeqertalik"],
  ["GL-SM", "GL", "Sermersooq"],
  ["GM-B", "GM", "Banjul"],
  ["GM-L", "GM", "Lower River Division"],
  ["GM-M", "GM", "Central River Division"],
  ["GM-N", "GM", "North Bank Division"],
  ["GM-U", "GM", "Upper River Division"],
  ["GM-W", "GM", "West Coast Division"],
  ["GN-B", "GN", "Bok\xE9 Region"],
  ["GN-BE", "GN", "Beyla"],
  ["GN-BF", "GN", "Boffa"],
  ["GN-BK", "GN", "Bok\xE9"],
  ["GN-C", "GN", "Conakry"],
  ["GN-CO", "GN", "Coyah"],
  ["GN-D", "GN", "Kindia Region"],
  ["GN-DB", "GN", "Dabola"],
  ["GN-DI", "GN", "Dinguiraye"],
  ["GN-DL", "GN", "Dalaba"],
  ["GN-DU", "GN", "Dubr\xE9ka"],
  ["GN-F", "GN", "Faranah Region"],
  ["GN-FA", "GN", "Faranah"],
  ["GN-FO", "GN", "For\xE9cariah"],
  ["GN-FR", "GN", "Fria"],
  ["GN-GA", "GN", "Gaoual"],
  ["GN-GU", "GN", "Gu\xE9ck\xE9dou"],
  ["GN-K", "GN", "Kankan Region"],
  ["GN-KA", "GN", "Kankan"],
  ["GN-KB", "GN", "Koubia"],
  ["GN-KD", "GN", "Kindia"],
  ["GN-KE", "GN", "K\xE9rouan\xE9"],
  ["GN-KN", "GN", "Koundara"],
  ["GN-KO", "GN", "Kouroussa"],
  ["GN-KS", "GN", "Kissidougou"],
  ["GN-L", "GN", "Lab\xE9 Region"],
  ["GN-LA", "GN", "Lab\xE9"],
  ["GN-LE", "GN", "L\xE9louma"],
  ["GN-LO", "GN", "Lola"],
  ["GN-M", "GN", "Mamou Region"],
  ["GN-MC", "GN", "Macenta"],
  ["GN-MD", "GN", "Mandiana"],
  ["GN-ML", "GN", "Mali"],
  ["GN-MM", "GN", "Mamou"],
  ["GN-N", "GN", "Nz\xE9r\xE9kor\xE9 Region"],
  ["GN-NZ", "GN", "Nz\xE9r\xE9kor\xE9"],
  ["GN-PI", "GN", "Pita"],
  ["GN-SI", "GN", "Siguiri"],
  ["GN-TE", "GN", "T\xE9lim\xE9l\xE9"],
  ["GN-TO", "GN", "Tougu\xE9"],
  ["GN-YO", "GN", "Yomou"],
  ["GQ-AN", "GQ", "Annob\xF3n"],
  ["GQ-BN", "GQ", "Bioko Norte"],
  ["GQ-BS", "GQ", "Bioko Sur"],
  ["GQ-C", "GQ", "R\xEDo Muni"],
  ["GQ-CS", "GQ", "Centro Sur"],
  ["GQ-DJ", "GQ", "Djibloho"],
  ["GQ-I", "GQ", "Insular"],
  ["GQ-KN", "GQ", "Ki\xE9-Ntem"],
  ["GQ-LI", "GQ", "Litoral"],
  ["GQ-WN", "GQ", "Wele-Nzas"],
  ["GR-69", "GR", "Mount Athos"],
  ["GR-A", "GR", "East Macedonia and Thrace"],
  ["GR-B", "GR", "Central Macedonia"],
  ["GR-C", "GR", "West Macedonia"],
  ["GR-D", "GR", "Epirus"],
  ["GR-E", "GR", "Thessaly"],
  ["GR-F", "GR", "Ionian Islands"],
  ["GR-G", "GR", "West Greece"],
  ["GR-H", "GR", "Central Greece"],
  ["GR-I", "GR", "Attica"],
  ["GR-J", "GR", "Peloponnese"],
  ["GR-K", "GR", "North Aegean"],
  ["GR-L", "GR", "South Aegean"],
  ["GR-M", "GR", "Crete"],
  ["GT-01", "GT", "Guatemala"],
  ["GT-02", "GT", "El Progreso"],
  ["GT-03", "GT", "Sacatep\xE9quez"],
  ["GT-04", "GT", "Chimaltenango"],
  ["GT-05", "GT", "Escuintla"],
  ["GT-06", "GT", "Santa Rosa"],
  ["GT-07", "GT", "Solol\xE1"],
  ["GT-08", "GT", "Totonicap\xE1n"],
  ["GT-09", "GT", "Quetzaltenango"],
  ["GT-10", "GT", "Suchitep\xE9quez"],
  ["GT-11", "GT", "Retalhuleu"],
  ["GT-12", "GT", "San Marcos"],
  ["GT-13", "GT", "Huehuetenango"],
  ["GT-14", "GT", "Quich\xE9"],
  ["GT-15", "GT", "Baja Verapaz"],
  ["GT-16", "GT", "Alta Verapaz"],
  ["GT-17", "GT", "Pet\xE9n"],
  ["GT-18", "GT", "Izabal"],
  ["GT-19", "GT", "Zacapa"],
  ["GT-20", "GT", "Chiquimula"],
  ["GT-21", "GT", "Jalapa"],
  ["GT-22", "GT", "Jutiapa"],
  ["GW-BA", "GW", "Bafat\xE1"],
  ["GW-BL", "GW", "Bolama"],
  ["GW-BM", "GW", "Biombo"],
  ["GW-BS", "GW", "Bissau"],
  ["GW-CA", "GW", "Cacheu"],
  ["GW-GA", "GW", "Gab\xFA"],
  ["GW-L", "GW", "Leste"],
  ["GW-N", "GW", "Norte"],
  ["GW-OI", "GW", "Oio"],
  ["GW-QU", "GW", "Quinara"],
  ["GW-S", "GW", "Sul"],
  ["GW-TO", "GW", "Tombali"],
  ["GY-BA", "GY", "Barima-Waini"],
  ["GY-CU", "GY", "Cuyuni-Mazaruni"],
  ["GY-DE", "GY", "Demerara-Mahaica"],
  ["GY-EB", "GY", "East Berbice-Corentyne"],
  ["GY-ES", "GY", "Essequibo Islands-West Demerara"],
  ["GY-MA", "GY", "Mahaica-Berbice"],
  ["GY-PM", "GY", "Pomeroon-Supenaam"],
  ["GY-PT", "GY", "Potaro-Siparuni"],
  ["GY-UD", "GY", "Upper Demerara-Berbice"],
  ["GY-UT", "GY", "Upper Takutu-Upper Essequibo"],
  ["HN-AT", "HN", "Atl\xE1ntida"],
  ["HN-CH", "HN", "Choluteca"],
  ["HN-CL", "HN", "Col\xF3n"],
  ["HN-CM", "HN", "Comayagua"],
  ["HN-CP", "HN", "Cop\xE1n"],
  ["HN-CR", "HN", "Cort\xE9s"],
  ["HN-EP", "HN", "El Para\xEDso"],
  ["HN-FM", "HN", "Francisco Moraz\xE1n"],
  ["HN-GD", "HN", "Gracias a Dios"],
  ["HN-IB", "HN", "Bay Islands"],
  ["HN-IN", "HN", "Intibuc\xE1"],
  ["HN-LE", "HN", "Lempira"],
  ["HN-LP", "HN", "La Paz"],
  ["HN-OC", "HN", "Ocotepeque"],
  ["HN-OL", "HN", "Olancho"],
  ["HN-SB", "HN", "Santa B\xE1rbara"],
  ["HN-VA", "HN", "Valle"],
  ["HN-YO", "HN", "Yoro"],
  ["HR-01", "HR", "Zagreb County"],
  ["HR-02", "HR", "Krapina-Zagorje"],
  ["HR-03", "HR", "Sisak-Moslavina"],
  ["HR-04", "HR", "Karlovac"],
  ["HR-05", "HR", "Vara\u017Edin"],
  ["HR-06", "HR", "Koprivnica-Kri\u017Eevci"],
  ["HR-07", "HR", "Bjelovar-Bilogora"],
  ["HR-08", "HR", "Primorje-Gorski Kotar"],
  ["HR-09", "HR", "Lika-Senj"],
  ["HR-10", "HR", "Virovitica-Podravina"],
  ["HR-11", "HR", "Po\u017Eega-Slavonia"],
  ["HR-12", "HR", "Brod-Posavina"],
  ["HR-13", "HR", "Zadar"],
  ["HR-14", "HR", "Osijek-Baranja"],
  ["HR-15", "HR", "\u0160ibenik-Knin"],
  ["HR-16", "HR", "Vukovar-Syrmia"],
  ["HR-17", "HR", "Split-Dalmatia"],
  ["HR-18", "HR", "Istria"],
  ["HR-19", "HR", "Dubrovnik-Neretva"],
  ["HR-20", "HR", "Me\u0111imurje"],
  ["HR-21", "HR", "Zagreb"],
  ["HT-AR", "HT", "Artibonite"],
  ["HT-CE", "HT", "Centre"],
  ["HT-GA", "HT", "Grand\u2019Anse"],
  ["HT-ND", "HT", "Nord"],
  ["HT-NE", "HT", "Nord-Est"],
  ["HT-NI", "HT", "Nippes"],
  ["HT-NO", "HT", "Nord-Ouest"],
  ["HT-OU", "HT", "Ouest"],
  ["HT-SD", "HT", "Sud"],
  ["HT-SE", "HT", "Sud-Est"],
  ["HU-BA", "HU", "Baranya"],
  ["HU-BC", "HU", "B\xE9k\xE9scsaba"],
  ["HU-BE", "HU", "B\xE9k\xE9s"],
  ["HU-BK", "HU", "B\xE1cs-Kiskun"],
  ["HU-BU", "HU", "Budapest"],
  ["HU-BZ", "HU", "Borsod-Aba\xFAj-Zempl\xE9n"],
  ["HU-CS", "HU", "Csongr\xE1d"],
  ["HU-DE", "HU", "Debrecen"],
  ["HU-DU", "HU", "Duna\xFAjv\xE1ros"],
  ["HU-EG", "HU", "Eger"],
  ["HU-ER", "HU", "\xC9rd"],
  ["HU-FE", "HU", "Fej\xE9r"],
  ["HU-GS", "HU", "Gy\u0151r-Moson-Sopron"],
  ["HU-GY", "HU", "Gy\u0151r"],
  ["HU-HB", "HU", "Hajd\xFA-Bihar"],
  ["HU-HE", "HU", "Heves"],
  ["HU-HV", "HU", "H\xF3dmez\u0151v\xE1s\xE1rhely"],
  ["HU-JN", "HU", "J\xE1sz-Nagykun-Szolnok"],
  ["HU-KE", "HU", "Kom\xE1rom-Esztergom"],
  ["HU-KM", "HU", "Kecskem\xE9t"],
  ["HU-KV", "HU", "Kaposv\xE1r"],
  ["HU-MI", "HU", "Miskolc"],
  ["HU-NK", "HU", "Nagykanizsa"],
  ["HU-NO", "HU", "N\xF3gr\xE1d"],
  ["HU-NY", "HU", "Ny\xEDregyh\xE1za"],
  ["HU-PE", "HU", "Pest"],
  ["HU-PS", "HU", "P\xE9cs"],
  ["HU-SD", "HU", "Szeged"],
  ["HU-SF", "HU", "Sz\xE9kesfeh\xE9rv\xE1r"],
  ["HU-SH", "HU", "Szombathely"],
  ["HU-SK", "HU", "Szolnok"],
  ["HU-SN", "HU", "Sopron"],
  ["HU-SO", "HU", "Somogy"],
  ["HU-SS", "HU", "Szeksz\xE1rd"],
  ["HU-ST", "HU", "Salg\xF3tarj\xE1n"],
  ["HU-SZ", "HU", "Szabolcs-Szatm\xE1r-Bereg"],
  ["HU-TB", "HU", "Tatab\xE1nya"],
  ["HU-TO", "HU", "Tolna"],
  ["HU-VA", "HU", "Vas"],
  ["HU-VE", "HU", "Veszpr\xE9m County"],
  ["HU-VM", "HU", "Veszpr\xE9m"],
  ["HU-ZA", "HU", "Zala"],
  ["HU-ZE", "HU", "Zalaegerszeg"],
  ["ID-AC", "ID", "Aceh"],
  ["ID-BA", "ID", "Bali"],
  ["ID-BB", "ID", "Bangka\u2013Belitung Islands"],
  ["ID-BE", "ID", "Bengkulu"],
  ["ID-BT", "ID", "Banten"],
  ["ID-GO", "ID", "Gorontalo"],
  ["ID-JA", "ID", "Jambi"],
  ["ID-JB", "ID", "West Java"],
  ["ID-JI", "ID", "East Java"],
  ["ID-JK", "ID", "Jakarta"],
  ["ID-JT", "ID", "Central Java"],
  ["ID-JW", "ID", "Java"],
  ["ID-KA", "ID", "Kalimantan"],
  ["ID-KB", "ID", "West Kalimantan"],
  ["ID-KI", "ID", "East Kalimantan"],
  ["ID-KR", "ID", "Riau Islands"],
  ["ID-KS", "ID", "South Kalimantan"],
  ["ID-KT", "ID", "Central Kalimantan"],
  ["ID-KU", "ID", "North Kalimantan"],
  ["ID-LA", "ID", "Lampung"],
  ["ID-MA", "ID", "Maluku"],
  ["ID-ML", "ID", "Maluku Islands"],
  ["ID-MU", "ID", "North Maluku"],
  ["ID-NB", "ID", "West Nusa Tenggara"],
  ["ID-NT", "ID", "East Nusa Tenggara"],
  ["ID-NU", "ID", "Lesser Sunda Islands"],
  ["ID-PA", "ID", "Papua"],
  ["ID-PB", "ID", "West Papua"],
  ["ID-PD", "ID", "Papua Barat Daya"],
  ["ID-PE", "ID", "Papua Pengunungan"],
  ["ID-PP", "ID", "Papua Islands"],
  ["ID-PS", "ID", "Papua Selatan"],
  ["ID-PT", "ID", "Papua Tengah"],
  ["ID-RI", "ID", "Riau"],
  ["ID-SA", "ID", "North Sulawesi"],
  ["ID-SB", "ID", "West Sumatra"],
  ["ID-SG", "ID", "Southeast Sulawesi"],
  ["ID-SL", "ID", "Sulawesi"],
  ["ID-SM", "ID", "Sumatra"],
  ["ID-SN", "ID", "South Sulawesi"],
  ["ID-SR", "ID", "West Sulawesi"],
  ["ID-SS", "ID", "South Sumatra"],
  ["ID-ST", "ID", "Central Sulawesi"],
  ["ID-SU", "ID", "North Sumatra"],
  ["ID-YO", "ID", "Yogyakarta"],
  ["IE-C", "IE", "Connacht"],
  ["IE-CE", "IE", "Clare"],
  ["IE-CN", "IE", "Cavan"],
  ["IE-CO", "IE", "Cork"],
  ["IE-CW", "IE", "Carlow"],
  ["IE-D", "IE", "Dublin"],
  ["IE-DL", "IE", "Donegal"],
  ["IE-G", "IE", "Galway"],
  ["IE-KE", "IE", "Kildare"],
  ["IE-KK", "IE", "Kilkenny"],
  ["IE-KY", "IE", "Kerry"],
  ["IE-L", "IE", "Leinster"],
  ["IE-LD", "IE", "Longford"],
  ["IE-LH", "IE", "Louth"],
  ["IE-LK", "IE", "Limerick"],
  ["IE-LM", "IE", "Leitrim"],
  ["IE-LS", "IE", "Laois"],
  ["IE-M", "IE", "Munster"],
  ["IE-MH", "IE", "Meath"],
  ["IE-MN", "IE", "Monaghan"],
  ["IE-MO", "IE", "Mayo"],
  ["IE-OY", "IE", "Offaly"],
  ["IE-RN", "IE", "Roscommon"],
  ["IE-SO", "IE", "Sligo"],
  ["IE-TA", "IE", "Tipperary"],
  ["IE-U", "IE", "Ulster"],
  ["IE-WD", "IE", "Waterford"],
  ["IE-WH", "IE", "Westmeath"],
  ["IE-WW", "IE", "Wicklow"],
  ["IE-WX", "IE", "Wexford"],
  ["IL-D", "IL", "Southern District"],
  ["IL-HA", "IL", "Haifa District"],
  ["IL-JM", "IL", "Jerusalem"],
  ["IL-M", "IL", "Central District"],
  ["IL-TA", "IL", "Tel Aviv District"],
  ["IL-Z", "IL", "Northern District"],
  ["IN-AN", "IN", "Andaman and Nicobar Islands"],
  ["IN-AP", "IN", "Andhra Pradesh"],
  ["IN-AR", "IN", "Arunachal Pradesh"],
  ["IN-AS", "IN", "Assam"],
  ["IN-BR", "IN", "Bihar"],
  ["IN-CG", "IN", "Chhatt\u012Bsgarh"],
  ["IN-CH", "IN", "Chandigarh"],
  ["IN-DH", "IN", "D\u0101dra and Nagar Haveli and Dam\u0101n and Diu"],
  ["IN-DL", "IN", "Delhi"],
  ["IN-GA", "IN", "Goa"],
  ["IN-GJ", "IN", "Gujarat"],
  ["IN-HP", "IN", "Himachal Pradesh"],
  ["IN-HR", "IN", "Haryana"],
  ["IN-JH", "IN", "Jharkhand"],
  ["IN-JK", "IN", "Jammu and Kashmir"],
  ["IN-KA", "IN", "Karnataka"],
  ["IN-KL", "IN", "Kerala"],
  ["IN-LA", "IN", "Ladakh"],
  ["IN-LD", "IN", "Lakshadweep"],
  ["IN-MH", "IN", "Maharashtra"],
  ["IN-ML", "IN", "Meghalaya"],
  ["IN-MN", "IN", "Manipur"],
  ["IN-MP", "IN", "Madhya Pradesh"],
  ["IN-MZ", "IN", "Mizoram"],
  ["IN-NL", "IN", "Nagaland"],
  ["IN-OD", "IN", "Odisha"],
  ["IN-PB", "IN", "Punjab"],
  ["IN-PY", "IN", "Puducherry"],
  ["IN-RJ", "IN", "Rajasthan"],
  ["IN-SK", "IN", "Sikkim"],
  ["IN-TN", "IN", "Tamil Nadu"],
  ["IN-TR", "IN", "Tripura"],
  ["IN-TS", "IN", "Telang\u0101na"],
  ["IN-UK", "IN", "Uttar\u0101khand"],
  ["IN-UP", "IN", "Uttar Pradesh"],
  ["IN-WB", "IN", "West Bengal"],
  ["IQ-AN", "IQ", "Al Anbar"],
  ["IQ-AR", "IQ", "Erbil"],
  ["IQ-BA", "IQ", "Basra"],
  ["IQ-BB", "IQ", "Babylon"],
  ["IQ-BG", "IQ", "Baghdad"],
  ["IQ-DA", "IQ", "Dohuk"],
  ["IQ-DI", "IQ", "Diyala"],
  ["IQ-DQ", "IQ", "Dhi Qar"],
  ["IQ-KA", "IQ", "Karbala"],
  ["IQ-KI", "IQ", "Kirkuk"],
  ["IQ-KR", "IQ", "Kurdistan"],
  ["IQ-MA", "IQ", "Maysan"],
  ["IQ-MU", "IQ", "Al Muthanna"],
  ["IQ-NA", "IQ", "Najaf"],
  ["IQ-NI", "IQ", "Nineveh"],
  ["IQ-QA", "IQ", "Al-Q\u0101disiyyah"],
  ["IQ-SD", "IQ", "Saladin"],
  ["IQ-SU", "IQ", "Sulaymaniyah"],
  ["IQ-WA", "IQ", "Wasit"],
  ["IR-00", "IR", "Markaz\u012B"],
  ["IR-01", "IR", "East Azerbaijan"],
  ["IR-02", "IR", "West Azarbaijan"],
  ["IR-03", "IR", "Ardabil"],
  ["IR-04", "IR", "Isfahan"],
  ["IR-05", "IR", "Ilam"],
  ["IR-06", "IR", "Bushehr"],
  ["IR-07", "IR", "Tehran"],
  ["IR-08", "IR", "Chaharmahal and Bakhtiari"],
  ["IR-09", "IR", "Khor\u0101s\u0101n-e Ra\u1E95av\u012B"],
  ["IR-10", "IR", "Khuzestan"],
  ["IR-11", "IR", "Zanjan"],
  ["IR-12", "IR", "Semnan"],
  ["IR-13", "IR", "Sistan and Baluchestan"],
  ["IR-14", "IR", "Fars"],
  ["IR-15", "IR", "Kerman"],
  ["IR-16", "IR", "Kurdistan"],
  ["IR-17", "IR", "Kermanshah"],
  ["IR-18", "IR", "Kohgiluyeh and Boyer-Ahmad"],
  ["IR-19", "IR", "Gilan"],
  ["IR-20", "IR", "Lorestan"],
  ["IR-21", "IR", "Mazandaran"],
  ["IR-22", "IR", "Markazi"],
  ["IR-23", "IR", "Hormozgan"],
  ["IR-24", "IR", "Hamadan"],
  ["IR-25", "IR", "Yazd"],
  ["IR-26", "IR", "Qom"],
  ["IR-27", "IR", "Golestan"],
  ["IR-28", "IR", "Qazvin"],
  ["IR-29", "IR", "South Khorasan"],
  ["IR-30", "IR", "Razavi Khorasan"],
  ["IS-1", "IS", "Capital"],
  ["IS-2", "IS", "Southern Peninsula"],
  ["IS-3", "IS", "Western"],
  ["IS-4", "IS", "Westfjords"],
  ["IS-5", "IS", "Northwestern"],
  ["IS-6", "IS", "Northeastern"],
  ["IS-7", "IS", "Eastern"],
  ["IS-8", "IS", "Southern"],
  ["IS-AKN", "IS", "Akraneskaupsta\xF0ur"],
  ["IS-AKU", "IS", "Akureyrarb\xE6r"],
  ["IS-ARN", "IS", "\xC1rneshreppur"],
  ["IS-ASA", "IS", "\xC1sahreppur"],
  ["IS-BLA", "IS", "Bl\xE1sk\xF3gabygg\xF0"],
  ["IS-BOG", "IS", "Borgarbygg\xF0"],
  ["IS-BOL", "IS", "Bolungarv\xEDkurkaupsta\xF0ur"],
  ["IS-DAB", "IS", "Dalabygg\xF0"],
  ["IS-DAV", "IS", "Dalv\xEDkurbygg\xF0"],
  ["IS-EOM", "IS", "Eyja- og Miklaholtshreppur"],
  ["IS-EYF", "IS", "Eyjafjar\xF0arsveit"],
  ["IS-FJD", "IS", "Fjar\xF0abygg\xF0"],
  ["IS-FJL", "IS", "Fjallabygg\xF0"],
  ["IS-FLA", "IS", "Fl\xF3ahreppur"],
  ["IS-FLR", "IS", "Flj\xF3tsdalshreppur"],
  ["IS-GAR", "IS", "Gar\xF0ab\xE6r"],
  ["IS-GOG", "IS", "Gr\xEDmsnes- og Grafningshreppur"],
  ["IS-GRN", "IS", "Grindav\xEDkurb\xE6r"],
  ["IS-GRU", "IS", "Grundarfjar\xF0arb\xE6r"],
  ["IS-GRY", "IS", "Gr\xFDtubakkahreppur"],
  ["IS-HAF", "IS", "Hafnarfjar\xF0arkaupsta\xF0ur"],
  ["IS-HRG", "IS", "H\xF6rg\xE1rsveit"],
  ["IS-HRU", "IS", "Hrunamannahreppur"],
  ["IS-HUG", "IS", "H\xFAnabygg\xF0"],
  ["IS-HUV", "IS", "H\xFAna\xFEing vestra"],
  ["IS-HVA", "IS", "Hvalfjar\xF0arsveit"],
  ["IS-HVE", "IS", "Hverager\xF0isb\xE6r"],
  ["IS-ISA", "IS", "\xCDsafjar\xF0arb\xE6r"],
  ["IS-KAL", "IS", "Kaldrananeshreppur"],
  ["IS-KJO", "IS", "Kj\xF3sarhreppur"],
  ["IS-KOP", "IS", "K\xF3pavogsb\xE6r"],
  ["IS-LAN", "IS", "Langanesbygg\xF0"],
  ["IS-MOS", "IS", "Mosfellsb\xE6r"],
  ["IS-MUL", "IS", "M\xFAla\xFEing"],
  ["IS-MYR", "IS", "M\xFDrdalshreppur"],
  ["IS-NOR", "IS", "Nor\xF0ur\xFEing"],
  ["IS-RGE", "IS", "Rang\xE1r\xFEing eystra"],
  ["IS-RGY", "IS", "Rang\xE1r\xFEing ytra"],
  ["IS-RHH", "IS", "Reykh\xF3lahreppur"],
  ["IS-RKN", "IS", "Reykjanesb\xE6r"],
  ["IS-RKV", "IS", "Reykjav\xEDkurborg"],
  ["IS-SBT", "IS", "Svalbar\xF0sstrandarhreppur"],
  ["IS-SDN", "IS", "Su\xF0urnesjab\xE6r"],
  ["IS-SDV", "IS", "S\xFA\xF0av\xEDkurhreppur"],
  ["IS-SEL", "IS", "Seltjarnarnesb\xE6r"],
  ["IS-SFA", "IS", "Sveitarf\xE9lagi\xF0 \xC1rborg"],
  ["IS-SHF", "IS", "Sveitarf\xE9lagi\xF0 Hornafj\xF6r\xF0ur"],
  ["IS-SKF", "IS", "Skaft\xE1rhreppur"],
  ["IS-SKG", "IS", "Skagabygg\xF0"],
  ["IS-SKO", "IS", "Skorradalshreppur"],
  ["IS-SKR", "IS", "Skagafj\xF6r\xF0ur"],
  ["IS-SNF", "IS", "Sn\xE6fellsb\xE6r"],
  ["IS-SOG", "IS", "Skei\xF0a- og Gn\xFApverjahreppur"],
  ["IS-SOL", "IS", "Sveitarf\xE9lagi\xF0 \xD6lfus"],
  ["IS-SSS", "IS", "Sveitarf\xE9lagi\xF0 Skagastr\xF6nd"],
  ["IS-STR", "IS", "Strandabygg\xF0"],
  ["IS-STY", "IS", "Stykkish\xF3lmsb\xE6r"],
  ["IS-SVG", "IS", "Sveitarf\xE9lagi\xF0 Vogar"],
  ["IS-TAL", "IS", "T\xE1lknafjar\xF0arhreppur"],
  ["IS-THG", "IS", "\xDEingeyjarsveit"],
  ["IS-TJO", "IS", "Tj\xF6rneshreppur"],
  ["IS-VEM", "IS", "Vestmannaeyjab\xE6r"],
  ["IS-VER", "IS", "Vesturbygg\xF0"],
  ["IS-VOP", "IS", "Vopnafjar\xF0arhreppur"],
  ["IT-21", "IT", "Piedmont"],
  ["IT-23", "IT", "Aosta Valley"],
  ["IT-25", "IT", "Lombardy"],
  ["IT-32", "IT", "Trentino-South Tyrol"],
  ["IT-34", "IT", "Veneto"],
  ["IT-36", "IT", "Friuli\u2013Venezia Giulia"],
  ["IT-42", "IT", "Liguria"],
  ["IT-45", "IT", "Emilia-Romagna"],
  ["IT-52", "IT", "Tuscany"],
  ["IT-55", "IT", "Umbria"],
  ["IT-57", "IT", "Marche"],
  ["IT-62", "IT", "Lazio"],
  ["IT-65", "IT", "Abruzzo"],
  ["IT-67", "IT", "Molise"],
  ["IT-72", "IT", "Campania"],
  ["IT-75", "IT", "Apulia"],
  ["IT-77", "IT", "Basilicata"],
  ["IT-78", "IT", "Calabria"],
  ["IT-82", "IT", "Sicily"],
  ["IT-88", "IT", "Sardinia"],
  ["IT-AG", "IT", "Agrigento"],
  ["IT-AL", "IT", "Alessandria"],
  ["IT-AN", "IT", "Ancona"],
  ["IT-AP", "IT", "Ascoli Piceno"],
  ["IT-AQ", "IT", "L\u2019Aquila"],
  ["IT-AR", "IT", "Arezzo"],
  ["IT-AT", "IT", "Asti"],
  ["IT-AV", "IT", "Avellino"],
  ["IT-BA", "IT", "Bari"],
  ["IT-BG", "IT", "Bergamo"],
  ["IT-BI", "IT", "Biella"],
  ["IT-BL", "IT", "Belluno"],
  ["IT-BN", "IT", "Benevento"],
  ["IT-BO", "IT", "Bologna"],
  ["IT-BR", "IT", "Brindisi"],
  ["IT-BS", "IT", "Brescia"],
  ["IT-BT", "IT", "Barletta-Andria-Trani"],
  ["IT-BZ", "IT", "South Tyrol"],
  ["IT-CA", "IT", "Cagliari"],
  ["IT-CB", "IT", "Campobasso"],
  ["IT-CE", "IT", "Caserta"],
  ["IT-CH", "IT", "Chieti"],
  ["IT-CL", "IT", "Caltanissetta"],
  ["IT-CN", "IT", "Cuneo"],
  ["IT-CO", "IT", "Como"],
  ["IT-CR", "IT", "Cremona"],
  ["IT-CS", "IT", "Cosenza"],
  ["IT-CT", "IT", "Catania"],
  ["IT-CZ", "IT", "Catanzaro"],
  ["IT-EN", "IT", "Enna"],
  ["IT-FC", "IT", "Forl\xEC-Cesena"],
  ["IT-FE", "IT", "Ferrara"],
  ["IT-FG", "IT", "Foggia"],
  ["IT-FI", "IT", "Florence"],
  ["IT-FM", "IT", "Fermo"],
  ["IT-FR", "IT", "Frosinone"],
  ["IT-GE", "IT", "Genoa"],
  ["IT-GO", "IT", "Gorizia"],
  ["IT-GR", "IT", "Grosseto"],
  ["IT-IM", "IT", "Imperia"],
  ["IT-IS", "IT", "Isernia"],
  ["IT-KR", "IT", "Crotone"],
  ["IT-LC", "IT", "Lecco"],
  ["IT-LE", "IT", "Lecce"],
  ["IT-LI", "IT", "Livorno"],
  ["IT-LO", "IT", "Lodi"],
  ["IT-LT", "IT", "Latina"],
  ["IT-LU", "IT", "Lucca"],
  ["IT-MB", "IT", "Monza and Brianza"],
  ["IT-MC", "IT", "Macerata"],
  ["IT-ME", "IT", "Messina"],
  ["IT-MI", "IT", "Milan"],
  ["IT-MN", "IT", "Mantua"],
  ["IT-MO", "IT", "Modena"],
  ["IT-MS", "IT", "Massa and Carrara"],
  ["IT-MT", "IT", "Matera"],
  ["IT-NA", "IT", "Naples"],
  ["IT-NO", "IT", "Novara"],
  ["IT-NU", "IT", "Nuoro"],
  ["IT-OR", "IT", "Oristano"],
  ["IT-PA", "IT", "Palermo"],
  ["IT-PC", "IT", "Piacenza"],
  ["IT-PD", "IT", "Padua"],
  ["IT-PE", "IT", "Pescara"],
  ["IT-PG", "IT", "Perugia"],
  ["IT-PI", "IT", "Pisa"],
  ["IT-PN", "IT", "Pordenone"],
  ["IT-PO", "IT", "Prato"],
  ["IT-PR", "IT", "Parma"],
  ["IT-PT", "IT", "Pistoia"],
  ["IT-PU", "IT", "Pesaro and Urbino"],
  ["IT-PV", "IT", "Pavia"],
  ["IT-PZ", "IT", "Potenza"],
  ["IT-RA", "IT", "Ravenna"],
  ["IT-RC", "IT", "Reggio Calabria"],
  ["IT-RE", "IT", "Reggio Emilia"],
  ["IT-RG", "IT", "Ragusa"],
  ["IT-RI", "IT", "Rieti"],
  ["IT-RM", "IT", "Rome"],
  ["IT-RN", "IT", "Rimini"],
  ["IT-RO", "IT", "Rovigo"],
  ["IT-SA", "IT", "Salerno"],
  ["IT-SI", "IT", "Siena"],
  ["IT-SO", "IT", "Sondrio"],
  ["IT-SP", "IT", "La Spezia"],
  ["IT-SR", "IT", "Syracuse"],
  ["IT-SS", "IT", "Sassari"],
  ["IT-SU", "IT", "Sud Sardegna"],
  ["IT-SV", "IT", "Savona"],
  ["IT-TA", "IT", "Taranto"],
  ["IT-TE", "IT", "Teramo"],
  ["IT-TN", "IT", "Trentino"],
  ["IT-TO", "IT", "Turin"],
  ["IT-TP", "IT", "Trapani"],
  ["IT-TR", "IT", "Terni"],
  ["IT-TS", "IT", "Trieste"],
  ["IT-TV", "IT", "Treviso"],
  ["IT-UD", "IT", "Udine"],
  ["IT-VA", "IT", "Varese"],
  ["IT-VB", "IT", "Verbano-Cusio-Ossola"],
  ["IT-VC", "IT", "Vercelli"],
  ["IT-VE", "IT", "Venice"],
  ["IT-VI", "IT", "Vicenza"],
  ["IT-VR", "IT", "Verona"],
  ["IT-VT", "IT", "Viterbo"],
  ["IT-VV", "IT", "Vibo Valentia"],
  ["JM-01", "JM", "Kingston"],
  ["JM-02", "JM", "Saint Andrew"],
  ["JM-03", "JM", "Saint Thomas"],
  ["JM-04", "JM", "Portland"],
  ["JM-05", "JM", "Saint Mary"],
  ["JM-06", "JM", "Saint Ann"],
  ["JM-07", "JM", "Trelawny"],
  ["JM-08", "JM", "Saint James"],
  ["JM-09", "JM", "Hanover"],
  ["JM-10", "JM", "Westmoreland"],
  ["JM-11", "JM", "Saint Elizabeth"],
  ["JM-12", "JM", "Manchester"],
  ["JM-13", "JM", "Clarendon"],
  ["JM-14", "JM", "Saint Catherine"],
  ["JO-AJ", "JO", "Ajloun"],
  ["JO-AM", "JO", "Amman"],
  ["JO-AQ", "JO", "Aqaba"],
  ["JO-AT", "JO", "Tafilah"],
  ["JO-AZ", "JO", "Zarqa"],
  ["JO-BA", "JO", "Balqa"],
  ["JO-IR", "JO", "Irbid"],
  ["JO-JA", "JO", "Jerash"],
  ["JO-KA", "JO", "Karak"],
  ["JO-MA", "JO", "Mafraq"],
  ["JO-MD", "JO", "Madaba"],
  ["JO-MN", "JO", "Ma\u2019an"],
  ["JP-01", "JP", "\u5317\u6D77\u9053"],
  ["JP-02", "JP", "\u9752\u68EE\u770C"],
  ["JP-03", "JP", "\u5CA9\u624B\u770C"],
  ["JP-04", "JP", "\u5BAE\u57CE\u770C"],
  ["JP-05", "JP", "\u79CB\u7530\u770C"],
  ["JP-06", "JP", "\u5C71\u5F62\u770C"],
  ["JP-07", "JP", "\u798F\u5CF6\u770C"],
  ["JP-08", "JP", "\u8328\u57CE\u770C"],
  ["JP-09", "JP", "\u6803\u6728\u770C"],
  ["JP-10", "JP", "\u7FA4\u99AC\u770C"],
  ["JP-11", "JP", "\u57FC\u7389\u770C"],
  ["JP-12", "JP", "\u5343\u8449\u770C"],
  ["JP-13", "JP", "\u6771\u4EAC\u90FD"],
  ["JP-14", "JP", "\u795E\u5948\u5DDD\u770C"],
  ["JP-15", "JP", "\u65B0\u6F5F\u770C"],
  ["JP-16", "JP", "\u5BCC\u5C71\u770C"],
  ["JP-17", "JP", "\u77F3\u5DDD\u770C"],
  ["JP-18", "JP", "\u798F\u4E95\u770C"],
  ["JP-19", "JP", "\u5C71\u68A8\u770C"],
  ["JP-20", "JP", "\u9577\u91CE\u770C"],
  ["JP-21", "JP", "\u5C90\u961C\u770C"],
  ["JP-22", "JP", "\u9759\u5CA1\u770C"],
  ["JP-23", "JP", "\u611B\u77E5\u770C"],
  ["JP-24", "JP", "\u4E09\u91CD\u770C"],
  ["JP-25", "JP", "\u6ECB\u8CC0\u770C"],
  ["JP-26", "JP", "\u4EAC\u90FD\u5E9C"],
  ["JP-27", "JP", "\u5927\u962A\u5E9C"],
  ["JP-28", "JP", "\u5175\u5EAB\u770C"],
  ["JP-29", "JP", "\u5948\u826F\u770C"],
  ["JP-30", "JP", "\u548C\u6B4C\u5C71\u770C"],
  ["JP-31", "JP", "\u9CE5\u53D6\u770C"],
  ["JP-32", "JP", "\u5CF6\u6839\u770C"],
  ["JP-33", "JP", "\u5CA1\u5C71\u770C"],
  ["JP-34", "JP", "\u5E83\u5CF6\u770C"],
  ["JP-35", "JP", "\u5C71\u53E3\u770C"],
  ["JP-36", "JP", "\u5FB3\u5CF6\u770C"],
  ["JP-37", "JP", "\u9999\u5DDD\u770C"],
  ["JP-38", "JP", "\u611B\u5A9B\u770C"],
  ["JP-39", "JP", "\u9AD8\u77E5\u770C"],
  ["JP-40", "JP", "\u798F\u5CA1\u770C"],
  ["JP-41", "JP", "\u4F50\u8CC0\u770C"],
  ["JP-42", "JP", "\u9577\u5D0E\u770C"],
  ["JP-43", "JP", "\u718A\u672C\u770C"],
  ["JP-44", "JP", "\u5927\u5206\u770C"],
  ["JP-45", "JP", "\u5BAE\u5D0E\u770C"],
  ["JP-46", "JP", "\u9E7F\u5150\u5CF6\u770C"],
  ["JP-47", "JP", "\u6C96\u7E04\u770C"],
  ["KE-01", "KE", "Baringo"],
  ["KE-02", "KE", "Bomet"],
  ["KE-03", "KE", "Bungoma"],
  ["KE-04", "KE", "Busia"],
  ["KE-05", "KE", "Elgeyo-Marakwet"],
  ["KE-06", "KE", "Embu"],
  ["KE-07", "KE", "Garissa"],
  ["KE-08", "KE", "Homa Bay"],
  ["KE-09", "KE", "Isiolo"],
  ["KE-10", "KE", "Kajiado"],
  ["KE-11", "KE", "Kakamega"],
  ["KE-12", "KE", "Kericho"],
  ["KE-13", "KE", "Kiambu"],
  ["KE-14", "KE", "Kilifi"],
  ["KE-15", "KE", "Kirinyaga"],
  ["KE-16", "KE", "Kisii"],
  ["KE-17", "KE", "Kisumu"],
  ["KE-18", "KE", "Kitui"],
  ["KE-19", "KE", "Kwale"],
  ["KE-20", "KE", "Laikipia"],
  ["KE-21", "KE", "Lamu"],
  ["KE-22", "KE", "Machakos"],
  ["KE-23", "KE", "Makueni"],
  ["KE-24", "KE", "Mandera"],
  ["KE-25", "KE", "Marsabit"],
  ["KE-26", "KE", "Meru"],
  ["KE-27", "KE", "Migori"],
  ["KE-28", "KE", "Mombasa"],
  ["KE-29", "KE", "Murang\u2019a"],
  ["KE-30", "KE", "Nairobi County"],
  ["KE-31", "KE", "Nakuru"],
  ["KE-32", "KE", "Nandi"],
  ["KE-33", "KE", "Narok"],
  ["KE-34", "KE", "Nyamira"],
  ["KE-35", "KE", "Nyandarua"],
  ["KE-36", "KE", "Nyeri"],
  ["KE-37", "KE", "Samburu"],
  ["KE-38", "KE", "Siaya"],
  ["KE-39", "KE", "Taita-Taveta"],
  ["KE-40", "KE", "Tana River"],
  ["KE-41", "KE", "Tharaka-Nithi"],
  ["KE-42", "KE", "Trans Nzoia"],
  ["KE-43", "KE", "Turkana"],
  ["KE-44", "KE", "Uasin Gishu"],
  ["KE-45", "KE", "Vihiga"],
  ["KE-46", "KE", "Wajir"],
  ["KE-47", "KE", "West Pokot"],
  ["KG-B", "KG", "Batken"],
  ["KG-C", "KG", "Chuy"],
  ["KG-GB", "KG", "Bishkek"],
  ["KG-GO", "KG", "Osh"],
  ["KG-J", "KG", "Jalal-Abad"],
  ["KG-N", "KG", "Naryn"],
  ["KG-O", "KG", "Osh Region"],
  ["KG-T", "KG", "Talas"],
  ["KG-Y", "KG", "Issyk-Kul"],
  ["KH-1", "KH", "Banteay Meanchey"],
  ["KH-10", "KH", "Krati\xE9"],
  ["KH-11", "KH", "Mondulkiri"],
  ["KH-12", "KH", "Phnom Penh"],
  ["KH-13", "KH", "Preah Vihear"],
  ["KH-14", "KH", "Prey Veng"],
  ["KH-15", "KH", "Pursat"],
  ["KH-16", "KH", "Ratanakiri"],
  ["KH-17", "KH", "Siem Reap"],
  ["KH-18", "KH", "Sihanoukville"],
  ["KH-19", "KH", "Stung Treng"],
  ["KH-2", "KH", "Battambang"],
  ["KH-20", "KH", "Svay Rieng"],
  ["KH-21", "KH", "Tak\xE9o"],
  ["KH-22", "KH", "Oddar Meanchey"],
  ["KH-23", "KH", "Kep"],
  ["KH-24", "KH", "Pailin"],
  ["KH-25", "KH", "Tbong Khmum"],
  ["KH-3", "KH", "Kampong Cham"],
  ["KH-4", "KH", "Kampong Chhnang"],
  ["KH-5", "KH", "Kampong Speu"],
  ["KH-6", "KH", "Kampong Thom"],
  ["KH-7", "KH", "Kampot"],
  ["KH-8", "KH", "Kandal"],
  ["KH-9", "KH", "Koh Kong"],
  ["KI-G", "KI", "Gilbert Islands"],
  ["KI-L", "KI", "Line Islands"],
  ["KI-P", "KI", "Phoenix Islands"],
  ["KM-A", "KM", "Anjouan"],
  ["KM-G", "KM", "Grande Comore"],
  ["KM-M", "KM", "Moh\xE9li"],
  ["KN-01", "KN", "Christ Church Nichola Town"],
  ["KN-02", "KN", "Saint Anne Sandy Point"],
  ["KN-03", "KN", "Saint George Basseterre"],
  ["KN-04", "KN", "Saint George Gingerland"],
  ["KN-05", "KN", "Saint James Windward"],
  ["KN-06", "KN", "Saint John Capisterre"],
  ["KN-07", "KN", "Saint John Figtree"],
  ["KN-08", "KN", "Saint Mary Cayon"],
  ["KN-09", "KN", "Saint Paul Capisterre"],
  ["KN-10", "KN", "Saint Paul Charlestown"],
  ["KN-11", "KN", "Saint Peter Basseterre"],
  ["KN-12", "KN", "Saint Thomas Lowland"],
  ["KN-13", "KN", "Saint Thomas Middle Island"],
  ["KN-15", "KN", "Trinity Palmetto Point"],
  ["KN-K", "KN", "Saint Kitts"],
  ["KN-N", "KN", "Nevis"],
  ["KP-01", "KP", "Pyongyang"],
  ["KP-02", "KP", "South Pyongan"],
  ["KP-03", "KP", "North Pyongan"],
  ["KP-04", "KP", "Chagang"],
  ["KP-05", "KP", "South Hwanghae"],
  ["KP-06", "KP", "North Hwanghae"],
  ["KP-07", "KP", "Kangwon"],
  ["KP-08", "KP", "South Hamgyong"],
  ["KP-09", "KP", "North Hamgyong"],
  ["KP-10", "KP", "Ryanggang"],
  ["KP-13", "KP", "Rason"],
  ["KP-14", "KP", "Nampho"],
  ["KP-15", "KP", "Kaeseong"],
  ["KR-11", "KR", "Seoul"],
  ["KR-26", "KR", "Busan"],
  ["KR-27", "KR", "Daegu"],
  ["KR-28", "KR", "Incheon"],
  ["KR-29", "KR", "Gwangju City"],
  ["KR-30", "KR", "Daejeon"],
  ["KR-31", "KR", "Ulsan"],
  ["KR-41", "KR", "Gyeonggi"],
  ["KR-42", "KR", "Gangwon"],
  ["KR-43", "KR", "North Chungcheong"],
  ["KR-44", "KR", "South Chungcheong"],
  ["KR-45", "KR", "North Jeolla"],
  ["KR-46", "KR", "South Jeolla"],
  ["KR-47", "KR", "North Gyeongsang"],
  ["KR-48", "KR", "South Gyeongsang"],
  ["KR-49", "KR", "Jeju"],
  ["KR-50", "KR", "Sejong"],
  ["KW-AH", "KW", "Al Ahmadi"],
  ["KW-FA", "KW", "Al Farwaniyah"],
  ["KW-HA", "KW", "Hawalli"],
  ["KW-JA", "KW", "Al Jahra"],
  ["KW-KU", "KW", "Al Asimah"],
  ["KW-MU", "KW", "Mubarak Al-Kabeer"],
  ["KZ-10", "KZ", "Abay oblysy"],
  ["KZ-11", "KZ", "Aqmola oblysy"],
  ["KZ-15", "KZ", "Aqt\xF6be oblysy"],
  ["KZ-19", "KZ", "Almaty oblysy"],
  ["KZ-23", "KZ", "Atyra\u016B oblysy"],
  ["KZ-27", "KZ", "Batys Qazaqstan oblysy"],
  ["KZ-31", "KZ", "Zhambyl oblysy"],
  ["KZ-33", "KZ", "Zhetis\u016B oblysy"],
  ["KZ-35", "KZ", "Qaraghandy oblysy"],
  ["KZ-39", "KZ", "Qostanay oblysy"],
  ["KZ-43", "KZ", "Qyzylorda oblysy"],
  ["KZ-47", "KZ", "Mangghysta\u016B oblysy"],
  ["KZ-55", "KZ", "Pavlodar oblysy"],
  ["KZ-59", "KZ", "Solt\xFCstik Qazaqstan oblysy"],
  ["KZ-61", "KZ", "T\xFCrkistan oblysy"],
  ["KZ-62", "KZ", "Ulyta\u016B oblysy"],
  ["KZ-63", "KZ", "Shyghys Qazaqstan oblysy"],
  ["KZ-71", "KZ", "Astana"],
  ["KZ-75", "KZ", "Almaty"],
  ["KZ-79", "KZ", "Shymkent"],
  ["LA-AT", "LA", "Attapeu"],
  ["LA-BK", "LA", "Bokeo"],
  ["LA-BL", "LA", "Bolikhamsai"],
  ["LA-CH", "LA", "Champasak"],
  ["LA-HO", "LA", "Houaphanh"],
  ["LA-KH", "LA", "Khammouane"],
  ["LA-LM", "LA", "Luang Namtha"],
  ["LA-LP", "LA", "Luang Prabang"],
  ["LA-OU", "LA", "Oudomxay"],
  ["LA-PH", "LA", "Phongsaly"],
  ["LA-SL", "LA", "Salavan"],
  ["LA-SV", "LA", "Savannakhet"],
  ["LA-VI", "LA", "Vientiane Province"],
  ["LA-VT", "LA", "Vientiane"],
  ["LA-XA", "LA", "Sainyabuli"],
  ["LA-XE", "LA", "Sekong"],
  ["LA-XI", "LA", "Xiangkhouang"],
  ["LA-XS", "LA", "Xaisomboun"],
  ["LB-AK", "LB", "Akkar"],
  ["LB-AS", "LB", "North"],
  ["LB-BA", "LB", "Beirut"],
  ["LB-BH", "LB", "Baalbek-Hermel"],
  ["LB-BI", "LB", "Beqaa"],
  ["LB-JA", "LB", "South"],
  ["LB-JL", "LB", "Mount Lebanon"],
  ["LB-NA", "LB", "Nabatieh"],
  ["LC-01", "LC", "Anse la Raye"],
  ["LC-02", "LC", "Castries"],
  ["LC-03", "LC", "Choiseul"],
  ["LC-05", "LC", "Dennery"],
  ["LC-06", "LC", "Gros Islet"],
  ["LC-07", "LC", "Laborie"],
  ["LC-08", "LC", "Micoud"],
  ["LC-10", "LC", "Soufri\xE8re"],
  ["LC-11", "LC", "Vieux Fort"],
  ["LC-12", "LC", "Canaries"],
  ["LI-01", "LI", "Balzers"],
  ["LI-02", "LI", "Eschen"],
  ["LI-03", "LI", "Gamprin"],
  ["LI-04", "LI", "Mauren"],
  ["LI-05", "LI", "Planken"],
  ["LI-06", "LI", "Ruggell"],
  ["LI-07", "LI", "Schaan"],
  ["LI-08", "LI", "Schellenberg"],
  ["LI-09", "LI", "Triesen"],
  ["LI-10", "LI", "Triesenberg"],
  ["LI-11", "LI", "Vaduz"],
  ["LK-1", "LK", "Western"],
  ["LK-11", "LK", "Colombo"],
  ["LK-12", "LK", "Gampaha"],
  ["LK-13", "LK", "Kalutara"],
  ["LK-2", "LK", "Central"],
  ["LK-21", "LK", "Kandy"],
  ["LK-22", "LK", "Matale"],
  ["LK-23", "LK", "Nuwara Eliya"],
  ["LK-3", "LK", "Southern"],
  ["LK-31", "LK", "Galle"],
  ["LK-32", "LK", "Matara"],
  ["LK-33", "LK", "Hambantota"],
  ["LK-4", "LK", "Northern"],
  ["LK-41", "LK", "Jaffna"],
  ["LK-42", "LK", "Kilinochchi"],
  ["LK-43", "LK", "Mannar"],
  ["LK-44", "LK", "Vavuniya"],
  ["LK-45", "LK", "Mullaitivu"],
  ["LK-5", "LK", "Eastern"],
  ["LK-51", "LK", "Batticaloa"],
  ["LK-52", "LK", "Ampara"],
  ["LK-53", "LK", "Trincomalee"],
  ["LK-6", "LK", "North Western"],
  ["LK-61", "LK", "Kurunegala"],
  ["LK-62", "LK", "Puttalam"],
  ["LK-7", "LK", "North Central"],
  ["LK-71", "LK", "Anuradhapura"],
  ["LK-72", "LK", "Polonnaruwa"],
  ["LK-8", "LK", "Uva"],
  ["LK-81", "LK", "Badulla"],
  ["LK-82", "LK", "Moneragala"],
  ["LK-9", "LK", "Sabaragamuwa"],
  ["LK-91", "LK", "Ratnapura"],
  ["LK-92", "LK", "Kegalle"],
  ["LR-BG", "LR", "Bong"],
  ["LR-BM", "LR", "Bomi"],
  ["LR-CM", "LR", "Grand Cape Mount"],
  ["LR-GB", "LR", "Grand Bassa"],
  ["LR-GG", "LR", "Grand Gedeh"],
  ["LR-GK", "LR", "Grand Kru"],
  ["LR-GP", "LR", "Gbarpolu"],
  ["LR-LO", "LR", "Lofa"],
  ["LR-MG", "LR", "Margibi"],
  ["LR-MO", "LR", "Montserrado"],
  ["LR-MY", "LR", "Maryland"],
  ["LR-NI", "LR", "Nimba"],
  ["LR-RG", "LR", "River Gee"],
  ["LR-RI", "LR", "Rivercess"],
  ["LR-SI", "LR", "Sinoe"],
  ["LS-A", "LS", "Maseru"],
  ["LS-B", "LS", "Butha-Buthe"],
  ["LS-C", "LS", "Leribe"],
  ["LS-D", "LS", "Berea"],
  ["LS-E", "LS", "Mafeteng"],
  ["LS-F", "LS", "Mohale\u2019s Hoek"],
  ["LS-G", "LS", "Quthing"],
  ["LS-H", "LS", "Qacha\u2019s Nek"],
  ["LS-J", "LS", "Mokhotlong"],
  ["LS-K", "LS", "Thaba-Tseka"],
  ["LT-01", "LT", "Akmen\u0117"],
  ["LT-02", "LT", "Alytus Municipality"],
  ["LT-03", "LT", "Alytus"],
  ["LT-04", "LT", "Anyk\u0161\u010Diai"],
  ["LT-05", "LT", "Bir\u0161tonas"],
  ["LT-06", "LT", "Bir\u017Eai"],
  ["LT-07", "LT", "Druskininkai"],
  ["LT-08", "LT", "Elektr\u0117nai"],
  ["LT-09", "LT", "Ignalina"],
  ["LT-10", "LT", "Jonava"],
  ["LT-11", "LT", "Joni\u0161kis"],
  ["LT-12", "LT", "Jurbarkas"],
  ["LT-13", "LT", "Kai\u0161iadorys"],
  ["LT-14", "LT", "Kalvarija"],
  ["LT-15", "LT", "Kauno Municipality"],
  ["LT-16", "LT", "Kaunas"],
  ["LT-17", "LT", "Kazl\u0173 R\u016Bda"],
  ["LT-18", "LT", "K\u0117dainiai"],
  ["LT-19", "LT", "Kelm\u0117"],
  ["LT-20", "LT", "Klaip\u0117dos Municipality"],
  ["LT-21", "LT", "Klaip\u0117da"],
  ["LT-22", "LT", "Kretinga"],
  ["LT-23", "LT", "Kupi\u0161kis"],
  ["LT-24", "LT", "Lazdijai"],
  ["LT-25", "LT", "Marijampol\u0117"],
  ["LT-26", "LT", "Ma\u017Eeikiai"],
  ["LT-27", "LT", "Mol\u0117tai"],
  ["LT-28", "LT", "Neringa"],
  ["LT-29", "LT", "Pag\u0117giai"],
  ["LT-30", "LT", "Pakruojis"],
  ["LT-31", "LT", "Palanga"],
  ["LT-32", "LT", "Panev\u0117\u017Eio Municipality"],
  ["LT-33", "LT", "Panev\u0117\u017Eys"],
  ["LT-34", "LT", "Pasvalys"],
  ["LT-35", "LT", "Plung\u0117"],
  ["LT-36", "LT", "Prienai"],
  ["LT-37", "LT", "Radvili\u0161kis"],
  ["LT-38", "LT", "Raseiniai"],
  ["LT-39", "LT", "Rietavas"],
  ["LT-40", "LT", "Roki\u0161kis"],
  ["LT-41", "LT", "\u0160akiai"],
  ["LT-42", "LT", "\u0160al\u010Dininkai"],
  ["LT-43", "LT", "\u0160iauli\u0173 Municipality"],
  ["LT-44", "LT", "\u0160iauliai"],
  ["LT-45", "LT", "\u0160ilal\u0117"],
  ["LT-46", "LT", "\u0160ilut\u0117"],
  ["LT-47", "LT", "\u0160irvintos"],
  ["LT-48", "LT", "Skuodas"],
  ["LT-49", "LT", "\u0160ven\u010Dionys"],
  ["LT-50", "LT", "Taurag\u0117"],
  ["LT-51", "LT", "Tel\u0161iai"],
  ["LT-52", "LT", "Trakai"],
  ["LT-53", "LT", "Ukmerg\u0117"],
  ["LT-54", "LT", "Utena"],
  ["LT-55", "LT", "Var\u0117na"],
  ["LT-56", "LT", "Vilkavi\u0161kis"],
  ["LT-57", "LT", "Vilniaus Municipality"],
  ["LT-58", "LT", "Vilnius"],
  ["LT-59", "LT", "Visaginas"],
  ["LT-60", "LT", "Zarasai"],
  ["LT-AL", "LT", "Alytus County"],
  ["LT-KL", "LT", "Klaip\u0117da County"],
  ["LT-KU", "LT", "Kaunas County"],
  ["LT-MR", "LT", "Marijampol\u0117 County"],
  ["LT-PN", "LT", "Panev\u0117\u017Eys County"],
  ["LT-SA", "LT", "\u0160iauliai County"],
  ["LT-TA", "LT", "Taurag\u0117 County"],
  ["LT-TE", "LT", "Tel\u0161iai County"],
  ["LT-UT", "LT", "Utena County"],
  ["LT-VL", "LT", "Vilnius County"],
  ["LU-CA", "LU", "Capellen"],
  ["LU-CL", "LU", "Clervaux"],
  ["LU-DI", "LU", "Diekirch"],
  ["LU-EC", "LU", "Echternach"],
  ["LU-ES", "LU", "Esch-sur-Alzette"],
  ["LU-GR", "LU", "Grevenmacher"],
  ["LU-LU", "LU", "Luxembourg"],
  ["LU-ME", "LU", "Mersch"],
  ["LU-RD", "LU", "Redange"],
  ["LU-RM", "LU", "Remich"],
  ["LU-VD", "LU", "Vianden"],
  ["LU-WI", "LU", "Wiltz"],
  ["LV-002", "LV", "Aizkraukle"],
  ["LV-007", "LV", "Al\u016Bksne"],
  ["LV-011", "LV", "\u0100da\u017Ei"],
  ["LV-015", "LV", "Balvi"],
  ["LV-016", "LV", "Bauska"],
  ["LV-022", "LV", "C\u0113sis"],
  ["LV-026", "LV", "Dobele"],
  ["LV-033", "LV", "Gulbene"],
  ["LV-041", "LV", "Jelgava Municipality"],
  ["LV-042", "LV", "J\u0113kabpils Municipality"],
  ["LV-047", "LV", "Kr\u0101slava"],
  ["LV-050", "LV", "Kuld\u012Bga"],
  ["LV-052", "LV", "\u0136ekava"],
  ["LV-054", "LV", "Limba\u017Ei"],
  ["LV-056", "LV", "L\u012Bv\u0101ni"],
  ["LV-058", "LV", "Ludza"],
  ["LV-059", "LV", "Madona"],
  ["LV-062", "LV", "M\u0101rupe"],
  ["LV-067", "LV", "Ogre"],
  ["LV-068", "LV", "Olaine"],
  ["LV-073", "LV", "Prei\u013Ci"],
  ["LV-077", "LV", "R\u0113zekne Municipality"],
  ["LV-080", "LV", "Ropa\u017Ei"],
  ["LV-087", "LV", "Salaspils"],
  ["LV-088", "LV", "Saldus"],
  ["LV-089", "LV", "Saulkrasti"],
  ["LV-091", "LV", "Sigulda"],
  ["LV-094", "LV", "Smiltene"],
  ["LV-097", "LV", "Talsi"],
  ["LV-099", "LV", "Tukums"],
  ["LV-101", "LV", "Valka"],
  ["LV-102", "LV", "Varak\u013C\u0101ni"],
  ["LV-106", "LV", "Ventspils Municipality"],
  ["LV-111", "LV", "Aug\u0161daugavas novads"],
  ["LV-112", "LV", "Dienvidkurzemes Novads"],
  ["LV-113", "LV", "Valmieras Novads"],
  ["LV-DGV", "LV", "Daugavpils"],
  ["LV-JEL", "LV", "Jelgava"],
  ["LV-JUR", "LV", "J\u016Brmala"],
  ["LV-LPX", "LV", "Liep\u0101ja"],
  ["LV-REZ", "LV", "R\u0113zekne"],
  ["LV-RIX", "LV", "Riga"],
  ["LV-VEN", "LV", "Ventspils"],
  ["LY-BA", "LY", "Benghazi"],
  ["LY-BU", "LY", "Butnan"],
  ["LY-DR", "LY", "Derna"],
  ["LY-GT", "LY", "Ghat"],
  ["LY-JA", "LY", "Jabal al Akhdar"],
  ["LY-JG", "LY", "Jabal al Gharbi"],
  ["LY-JI", "LY", "Jafara"],
  ["LY-JU", "LY", "Jufra"],
  ["LY-KF", "LY", "Kufra"],
  ["LY-MB", "LY", "Murqub"],
  ["LY-MI", "LY", "Misrata"],
  ["LY-MJ", "LY", "Marj"],
  ["LY-MQ", "LY", "Murzuq"],
  ["LY-NL", "LY", "Nalut"],
  ["LY-NQ", "LY", "Nuqat al Khams"],
  ["LY-SB", "LY", "Sabha"],
  ["LY-SR", "LY", "Sirte"],
  ["LY-TB", "LY", "Tripoli"],
  ["LY-WA", "LY", "Al Wahat"],
  ["LY-WD", "LY", "Wadi al Hayaa"],
  ["LY-WS", "LY", "Wadi al Shatii"],
  ["LY-ZA", "LY", "Zawiya"],
  ["MA-01", "MA", "Tangier-T\xE9touan"],
  ["MA-02", "MA", "Gharb-Chrarda-B\xE9ni Hssen"],
  ["MA-03", "MA", "Taza-Al Hoceima-Taounate"],
  ["MA-04", "MA", "Oriental"],
  ["MA-05", "MA", "F\xE8s-Boulemane"],
  ["MA-06", "MA", "Mekn\xE8s-Tafilalet"],
  ["MA-07", "MA", "Rabat-Sal\xE9-Zemmour-Zaer"],
  ["MA-08", "MA", "Grand Casablanca"],
  ["MA-09", "MA", "Chaouia-Ouardigha"],
  ["MA-10", "MA", "Doukkala-Abda"],
  ["MA-11", "MA", "Marrakesh-Tensift-El Haouz"],
  ["MA-12", "MA", "Tadla-Azilal"],
  ["MA-AGD", "MA", "Agadir-Ida Ou Tanane"],
  ["MA-AOU", "MA", "Aousserd"],
  ["MA-ASZ", "MA", "Assa-Zag"],
  ["MA-AZI", "MA", "Azilal"],
  ["MA-BEM", "MA", "B\xE9ni-Mellal"],
  ["MA-BER", "MA", "Berkane"],
  ["MA-BES", "MA", "Ben Slimane"],
  ["MA-BOD", "MA", "Boujdour"],
  ["MA-BOM", "MA", "Boulemane"],
  ["MA-BRR", "MA", "Berrechid"],
  ["MA-CAS", "MA", "Casablanca"],
  ["MA-CHE", "MA", "Chefchaouen"],
  ["MA-CHI", "MA", "Chichaoua"],
  ["MA-CHT", "MA", "Chtouka A\xEFt Baha"],
  ["MA-DRI", "MA", "Driouch"],
  ["MA-ERR", "MA", "Errachidia"],
  ["MA-ESI", "MA", "Essaouira"],
  ["MA-ESM", "MA", "Es Semara"],
  ["MA-FAH", "MA", "Fahs-Beni Makada"],
  ["MA-FES", "MA", "F\xE8s-Dar-Dbibegh"],
  ["MA-FIG", "MA", "Figuig"],
  ["MA-FQH", "MA", "Fquih Ben Salah"],
  ["MA-GUE", "MA", "Guelmim"],
  ["MA-GUF", "MA", "Guercif"],
  ["MA-HAJ", "MA", "El Hajeb"],
  ["MA-HAO", "MA", "Al Haouz"],
  ["MA-HOC", "MA", "Al Hoce\xEFma"],
  ["MA-IFR", "MA", "Ifrane"],
  ["MA-INE", "MA", "Inezgane-A\xEFt Melloul"],
  ["MA-JDI", "MA", "El Jadida"],
  ["MA-JRA", "MA", "Jerada"],
  ["MA-KEN", "MA", "K\xE9nitra"],
  ["MA-KES", "MA", "Kelaat Sraghna"],
  ["MA-KHE", "MA", "Khemisset"],
  ["MA-KHN", "MA", "Kh\xE9nifra"],
  ["MA-KHO", "MA", "Khouribga"],
  ["MA-LAA", "MA", "La\xE2youne"],
  ["MA-LAR", "MA", "Larache"],
  ["MA-MAR", "MA", "Marrakech"],
  ["MA-MDF", "MA", "M\u2019diq-Fnideq"],
  ["MA-MED", "MA", "M\xE9diouna"],
  ["MA-MEK", "MA", "Mekn\xE8s"],
  ["MA-MID", "MA", "Midelt"],
  ["MA-MOH", "MA", "Mohammedia"],
  ["MA-MOU", "MA", "Moulay Yacoub"],
  ["MA-NAD", "MA", "Nador"],
  ["MA-NOU", "MA", "Nouaceur"],
  ["MA-OUA", "MA", "Ouarzazate"],
  ["MA-OUD", "MA", "Oued Ed-Dahab"],
  ["MA-OUJ", "MA", "Oujda-Angad"],
  ["MA-OUZ", "MA", "Ouezzane"],
  ["MA-RAB", "MA", "Rabat"],
  ["MA-REH", "MA", "Rehamna"],
  ["MA-SAF", "MA", "Safi"],
  ["MA-SAL", "MA", "Sal\xE9"],
  ["MA-SEF", "MA", "Sefrou"],
  ["MA-SET", "MA", "Settat"],
  ["MA-SIB", "MA", "Sidi Bennour"],
  ["MA-SIF", "MA", "Sidi Ifni"],
  ["MA-SIK", "MA", "Sidi Kacem"],
  ["MA-SIL", "MA", "Sidi Slimane"],
  ["MA-SKH", "MA", "Skhirat-T\xE9mara"],
  ["MA-TAF", "MA", "Tarfaya (EH-partial)"],
  ["MA-TAI", "MA", "Taourirt"],
  ["MA-TAO", "MA", "Taounate"],
  ["MA-TAR", "MA", "Taroudant"],
  ["MA-TAT", "MA", "Tata"],
  ["MA-TAZ", "MA", "Taza"],
  ["MA-TET", "MA", "T\xE9touan"],
  ["MA-TIN", "MA", "Tinghir"],
  ["MA-TIZ", "MA", "Tiznit"],
  ["MA-TNG", "MA", "Tangier-Assilah"],
  ["MA-TNT", "MA", "Tan-Tan"],
  ["MA-YUS", "MA", "Youssoufia"],
  ["MA-ZAG", "MA", "Zagora"],
  ["MC-CL", "MC", "La Colle"],
  ["MC-CO", "MC", "La Condamine"],
  ["MC-FO", "MC", "Fontvieille"],
  ["MC-GA", "MC", "La Gare"],
  ["MC-JE", "MC", "Jardin Exotique de Monaco"],
  ["MC-LA", "MC", "Larvotto"],
  ["MC-MA", "MC", "Malbousquet"],
  ["MC-MC", "MC", "Monte Carlo"],
  ["MC-MG", "MC", "Moneghetti"],
  ["MC-MO", "MC", "Monaco-Ville"],
  ["MC-MU", "MC", "Moulins"],
  ["MC-PH", "MC", "Port Hercules"],
  ["MC-SD", "MC", "Sainte-D\xE9vote Chapel"],
  ["MC-SO", "MC", "La Source"],
  ["MC-SP", "MC", "Sp\xE9lugues"],
  ["MC-SR", "MC", "Saint Roman"],
  ["MC-VR", "MC", "Vallon de la Rousse"],
  ["MD-AN", "MD", "Anenii Noi"],
  ["MD-BA", "MD", "B\u0103l\u0163i"],
  ["MD-BD", "MD", "Bender"],
  ["MD-BR", "MD", "Briceni"],
  ["MD-BS", "MD", "Basarabeasca"],
  ["MD-CA", "MD", "Cahul"],
  ["MD-CL", "MD", "C\u0103l\u0103ra\u0219i"],
  ["MD-CM", "MD", "Cimi\u0219lia"],
  ["MD-CR", "MD", "Criuleni"],
  ["MD-CS", "MD", "C\u0103u\u0219eni"],
  ["MD-CT", "MD", "Cantemir"],
  ["MD-CU", "MD", "Chi\u0219in\u0103u"],
  ["MD-DO", "MD", "Dondu\u0219eni"],
  ["MD-DR", "MD", "Drochia"],
  ["MD-DU", "MD", "Dub\u0103sari"],
  ["MD-ED", "MD", "Edine\u021B"],
  ["MD-FA", "MD", "F\u0103le\u0219ti"],
  ["MD-FL", "MD", "Flore\u0219ti"],
  ["MD-GA", "MD", "Gagauzia"],
  ["MD-GL", "MD", "Glodeni"],
  ["MD-HI", "MD", "H\xEEnce\u0219ti"],
  ["MD-IA", "MD", "Ialoveni"],
  ["MD-LE", "MD", "Leova"],
  ["MD-NI", "MD", "Nisporeni"],
  ["MD-OC", "MD", "Ocni\u0163a"],
  ["MD-OR", "MD", "Orhei"],
  ["MD-RE", "MD", "Rezina"],
  ["MD-RI", "MD", "R\xEE\u0219cani"],
  ["MD-SD", "MD", "\u0218old\u0103ne\u0219ti"],
  ["MD-SI", "MD", "S\xEEngerei"],
  ["MD-SN", "MD", "Transnistria"],
  ["MD-SO", "MD", "Soroca"],
  ["MD-ST", "MD", "Str\u0103\u0219eni"],
  ["MD-SV", "MD", "\u015Etefan Vod\u0103"],
  ["MD-TA", "MD", "Taraclia"],
  ["MD-TE", "MD", "Telene\u0219ti"],
  ["MD-UN", "MD", "Ungheni"],
  ["ME-01", "ME", "Andrijevica"],
  ["ME-02", "ME", "Bar"],
  ["ME-03", "ME", "Berane"],
  ["ME-04", "ME", "Bijelo Polje"],
  ["ME-05", "ME", "Budva"],
  ["ME-06", "ME", "Cetinje"],
  ["ME-07", "ME", "Danilovgrad"],
  ["ME-08", "ME", "Herceg Novi"],
  ["ME-09", "ME", "Kola\u0161in"],
  ["ME-10", "ME", "Kotor"],
  ["ME-11", "ME", "Mojkovac"],
  ["ME-12", "ME", "Nik\u0161i\u0107"],
  ["ME-13", "ME", "Plav"],
  ["ME-14", "ME", "Pljevlja"],
  ["ME-15", "ME", "Plu\u017Eine"],
  ["ME-16", "ME", "Podgorica"],
  ["ME-17", "ME", "Ro\u017Eaje"],
  ["ME-18", "ME", "\u0160avnik"],
  ["ME-19", "ME", "Tivat"],
  ["ME-20", "ME", "Ulcinj"],
  ["ME-21", "ME", "\u017Dabljak"],
  ["ME-22", "ME", "Gusinje"],
  ["ME-23", "ME", "Petnjica"],
  ["ME-24", "ME", "Tuzi"],
  ["ME-25", "ME", "Zeta"],
  ["MG-A", "MG", "Toamasina"],
  ["MG-D", "MG", "Antsiranana"],
  ["MG-F", "MG", "Fianarantsoa"],
  ["MG-M", "MG", "Mahajanga"],
  ["MG-T", "MG", "Antananarivo"],
  ["MG-U", "MG", "Toliara"],
  ["MH-ALK", "MH", "Ailuk Atoll"],
  ["MH-ALL", "MH", "Ailinglaplap Atoll"],
  ["MH-ARN", "MH", "Arno"],
  ["MH-AUR", "MH", "Aur Atoll"],
  ["MH-EBO", "MH", "Ebon Atoll"],
  ["MH-ENI", "MH", "Enewetak Atoll"],
  ["MH-JAB", "MH", "Jabat Island"],
  ["MH-JAL", "MH", "Jaluit Atoll"],
  ["MH-KIL", "MH", "Kili Island"],
  ["MH-KWA", "MH", "Kwajalein"],
  ["MH-L", "MH", "Ralik Chain"],
  ["MH-LAE", "MH", "Lae Atoll"],
  ["MH-LIB", "MH", "Lib Island"],
  ["MH-LIK", "MH", "Likiep Atoll"],
  ["MH-MAJ", "MH", "Majuro"],
  ["MH-MAL", "MH", "Maloelap Atoll"],
  ["MH-MEJ", "MH", "Mejit Island"],
  ["MH-MIL", "MH", "Mili Atoll"],
  ["MH-NMK", "MH", "Namdrik Atoll"],
  ["MH-NMU", "MH", "Namu Atoll"],
  ["MH-RON", "MH", "Rongelap Atoll"],
  ["MH-T", "MH", "Ratak Chain"],
  ["MH-UJA", "MH", "Ujae Atoll"],
  ["MH-UTI", "MH", "Utirik Atoll"],
  ["MH-WTH", "MH", "Wotho Atoll"],
  ["MH-WTJ", "MH", "Wotje Atoll"],
  ["MK-101", "MK", "Veles"],
  ["MK-102", "MK", "Gradsko"],
  ["MK-103", "MK", "Demir Kapija"],
  ["MK-104", "MK", "Kavadarci"],
  ["MK-105", "MK", "Lozovo"],
  ["MK-106", "MK", "Negotino"],
  ["MK-107", "MK", "Rosoman"],
  ["MK-108", "MK", "Sveti Nikole"],
  ["MK-109", "MK", "\u010Ca\u0161ka"],
  ["MK-201", "MK", "Berovo"],
  ["MK-202", "MK", "Vinica"],
  ["MK-203", "MK", "Del\u010Devo"],
  ["MK-204", "MK", "Zrnovci"],
  ["MK-205", "MK", "Karbinci"],
  ["MK-206", "MK", "Ko\u010Dani"],
  ["MK-207", "MK", "Makedonska Kamenica"],
  ["MK-208", "MK", "Peh\u010Devo"],
  ["MK-209", "MK", "Probi\u0161tip"],
  ["MK-210", "MK", "\u010Ce\u0161inovo-Oble\u0161evo"],
  ["MK-211", "MK", "\u0160tip"],
  ["MK-301", "MK", "Vev\u010Dani"],
  ["MK-303", "MK", "Debar"],
  ["MK-304", "MK", "Debrca"],
  ["MK-307", "MK", "Ki\u010Devo"],
  ["MK-308", "MK", "Makedonski Brod"],
  ["MK-310", "MK", "Ohrid"],
  ["MK-311", "MK", "Plasnica"],
  ["MK-312", "MK", "Struga"],
  ["MK-313", "MK", "Centar \u017Dupa"],
  ["MK-401", "MK", "Bogdanci"],
  ["MK-402", "MK", "Bosilovo"],
  ["MK-403", "MK", "Valandovo"],
  ["MK-404", "MK", "Vasilevo"],
  ["MK-405", "MK", "Gevgelija"],
  ["MK-406", "MK", "Dojran"],
  ["MK-407", "MK", "Kon\u010De"],
  ["MK-408", "MK", "Novo Selo"],
  ["MK-409", "MK", "Radovi\u0161"],
  ["MK-410", "MK", "Strumica"],
  ["MK-501", "MK", "Bitola"],
  ["MK-502", "MK", "Demir Hisar"],
  ["MK-503", "MK", "Dolneni"],
  ["MK-504", "MK", "Krivoga\u0161tani"],
  ["MK-505", "MK", "Kru\u0161evo"],
  ["MK-506", "MK", "Mogila"],
  ["MK-507", "MK", "Novaci"],
  ["MK-508", "MK", "Prilep"],
  ["MK-509", "MK", "Resen"],
  ["MK-601", "MK", "Bogovinje"],
  ["MK-602", "MK", "Brvenica"],
  ["MK-603", "MK", "Vrap\u010Di\u0161te"],
  ["MK-604", "MK", "Gostivar"],
  ["MK-605", "MK", "\u017Delino"],
  ["MK-606", "MK", "Jegunovce"],
  ["MK-607", "MK", "Mavrovo i Rostu\u0161e"],
  ["MK-608", "MK", "Tearce"],
  ["MK-609", "MK", "Tetovo"],
  ["MK-701", "MK", "Kratovo"],
  ["MK-702", "MK", "Kriva Palanka"],
  ["MK-703", "MK", "Kumanovo"],
  ["MK-704", "MK", "Lipkovo"],
  ["MK-705", "MK", "Rankovce"],
  ["MK-706", "MK", "Staro Nagori\u010Dane"],
  ["MK-801", "MK", "Aerodrom \u2020"],
  ["MK-802", "MK", "Ara\u010Dinovo"],
  ["MK-803", "MK", "Butel \u2020"],
  ["MK-804", "MK", "Gazi Baba \u2020"],
  ["MK-805", "MK", "Gjor\u010De Petrov \u2020"],
  ["MK-806", "MK", "Zelenikovo"],
  ["MK-807", "MK", "Ilinden"],
  ["MK-808", "MK", "Karpo\u0161 \u2020"],
  ["MK-809", "MK", "Kisela Voda \u2020"],
  ["MK-810", "MK", "Petrovec"],
  ["MK-811", "MK", "Saraj \u2020"],
  ["MK-812", "MK", "Sopi\u0161te"],
  ["MK-813", "MK", "Studeni\u010Dani"],
  ["MK-814", "MK", "Centar \u2020"],
  ["MK-815", "MK", "\u010Cair \u2020"],
  ["MK-816", "MK", "\u010Cu\u010Der-Sandevo"],
  ["MK-817", "MK", "\u0160uto Orizari \u2020"],
  ["ML-1", "ML", "Kayes"],
  ["ML-10", "ML", "Taoud\xE9nit"],
  ["ML-2", "ML", "Koulikoro"],
  ["ML-3", "ML", "Sikasso"],
  ["ML-4", "ML", "S\xE9gou"],
  ["ML-5", "ML", "Mopti"],
  ["ML-6", "ML", "Tombouctou"],
  ["ML-7", "ML", "Gao"],
  ["ML-8", "ML", "Kidal"],
  ["ML-9", "ML", "M\xE9naka"],
  ["ML-BKO", "ML", "Bamako"],
  ["MM-01", "MM", "Sagaing"],
  ["MM-02", "MM", "Bago"],
  ["MM-03", "MM", "Magway"],
  ["MM-04", "MM", "Mandalay"],
  ["MM-05", "MM", "Tanintharyi"],
  ["MM-06", "MM", "Yangon"],
  ["MM-07", "MM", "Ayeyarwady"],
  ["MM-11", "MM", "Kachin"],
  ["MM-12", "MM", "Kayah"],
  ["MM-13", "MM", "Kayin"],
  ["MM-14", "MM", "Chin"],
  ["MM-15", "MM", "Mon"],
  ["MM-16", "MM", "Rakhine"],
  ["MM-17", "MM", "Shan"],
  ["MM-18", "MM", "Naypyidaw"],
  ["MN-035", "MN", "Orkhon"],
  ["MN-037", "MN", "Darkhan-Uul"],
  ["MN-039", "MN", "Khentii"],
  ["MN-041", "MN", "Kh\xF6vsg\xF6l"],
  ["MN-043", "MN", "Khovd"],
  ["MN-046", "MN", "Uvs"],
  ["MN-047", "MN", "T\xF6v"],
  ["MN-049", "MN", "Selenge"],
  ["MN-051", "MN", "S\xFCkhbaatar"],
  ["MN-053", "MN", "\xD6mn\xF6govi"],
  ["MN-055", "MN", "\xD6v\xF6rkhangai"],
  ["MN-057", "MN", "Zavkhan"],
  ["MN-059", "MN", "Dundgovi"],
  ["MN-061", "MN", "Dornod"],
  ["MN-063", "MN", "Dornogovi"],
  ["MN-064", "MN", "Govis\xFCmber"],
  ["MN-065", "MN", "Govi-Altai"],
  ["MN-067", "MN", "Bulgan"],
  ["MN-069", "MN", "Bayankhongor"],
  ["MN-071", "MN", "Bayan-\xD6lgii"],
  ["MN-073", "MN", "Arkhangai"],
  ["MN-1", "MN", "Ulaanbaatar"],
  ["MR-01", "MR", "Hodh Ech Chargui"],
  ["MR-02", "MR", "Hodh El Gharbi"],
  ["MR-03", "MR", "Assaba"],
  ["MR-04", "MR", "Gorgol"],
  ["MR-05", "MR", "Brakna"],
  ["MR-06", "MR", "Trarza"],
  ["MR-07", "MR", "Adrar"],
  ["MR-08", "MR", "Dakhlet Nouadhibou"],
  ["MR-09", "MR", "Tagant"],
  ["MR-10", "MR", "Guidimaka"],
  ["MR-11", "MR", "Tiris Zemmour"],
  ["MR-12", "MR", "Inchiri"],
  ["MR-13", "MR", "Nouakchott Ouest"],
  ["MR-14", "MR", "Nouakchott Nord"],
  ["MR-15", "MR", "Nouakchott Sud"],
  ["MT-01", "MT", "Attard"],
  ["MT-02", "MT", "Balzan"],
  ["MT-03", "MT", "Birgu"],
  ["MT-04", "MT", "Birkirkara"],
  ["MT-05", "MT", "Bir\u017Cebbu\u0121a"],
  ["MT-06", "MT", "Cospicua"],
  ["MT-07", "MT", "Dingli"],
  ["MT-08", "MT", "Fgura"],
  ["MT-09", "MT", "Floriana"],
  ["MT-10", "MT", "Fontana"],
  ["MT-11", "MT", "Gudja"],
  ["MT-12", "MT", "G\u017Cira"],
  ["MT-13", "MT", "G\u0127ajnsielem"],
  ["MT-14", "MT", "G\u0127arb"],
  ["MT-15", "MT", "G\u0127arg\u0127ur"],
  ["MT-16", "MT", "G\u0127asri"],
  ["MT-17", "MT", "G\u0127axaq"],
  ["MT-18", "MT", "\u0126amrun"],
  ["MT-19", "MT", "Iklin"],
  ["MT-20", "MT", "Senglea"],
  ["MT-21", "MT", "Kalkara"],
  ["MT-22", "MT", "Ker\u010Bem"],
  ["MT-23", "MT", "Kirkop"],
  ["MT-24", "MT", "Lija"],
  ["MT-25", "MT", "Luqa"],
  ["MT-26", "MT", "Marsa"],
  ["MT-27", "MT", "Marsaskala"],
  ["MT-28", "MT", "Marsaxlokk"],
  ["MT-29", "MT", "Mdina"],
  ["MT-30", "MT", "Mellie\u0127a"],
  ["MT-31", "MT", "M\u0121arr"],
  ["MT-32", "MT", "Mosta"],
  ["MT-33", "MT", "Mqabba"],
  ["MT-34", "MT", "Msida"],
  ["MT-35", "MT", "Imtarfa"],
  ["MT-36", "MT", "Munxar"],
  ["MT-37", "MT", "Nadur"],
  ["MT-38", "MT", "Naxxar"],
  ["MT-39", "MT", "Paola"],
  ["MT-40", "MT", "Pembroke"],
  ["MT-41", "MT", "Piet\xE0"],
  ["MT-42", "MT", "Qala"],
  ["MT-43", "MT", "Qormi"],
  ["MT-44", "MT", "Qrendi"],
  ["MT-45", "MT", "Victoria"],
  ["MT-46", "MT", "Rabat"],
  ["MT-47", "MT", "Safi"],
  ["MT-48", "MT", "St. Julian\u2019s"],
  ["MT-49", "MT", "San \u0120wann"],
  ["MT-50", "MT", "Saint Lawrence"],
  ["MT-51", "MT", "St. Paul\u2019s Bay"],
  ["MT-52", "MT", "Sannat"],
  ["MT-53", "MT", "Santa Lu\u010Bija"],
  ["MT-54", "MT", "Santa Venera"],
  ["MT-55", "MT", "Si\u0121\u0121iewi"],
  ["MT-56", "MT", "Sliema"],
  ["MT-57", "MT", "Swieqi"],
  ["MT-58", "MT", "Ta\u2019 Xbiex"],
  ["MT-59", "MT", "Tarxien"],
  ["MT-60", "MT", "Valletta"],
  ["MT-61", "MT", "Xag\u0127ra"],
  ["MT-62", "MT", "Xewkija"],
  ["MT-63", "MT", "Xg\u0127ajra"],
  ["MT-64", "MT", "\u017Babbar"],
  ["MT-65", "MT", "\u017Bebbu\u0121 Gozo"],
  ["MT-66", "MT", "\u017Bebbu\u0121"],
  ["MT-67", "MT", "\u017Bejtun"],
  ["MT-68", "MT", "\u017Burrieq"],
  ["MU-AG", "MU", "Agal\xE9ga"],
  ["MU-BL", "MU", "Rivi\xE8re Noire"],
  ["MU-CC", "MU", "Cargados Carajos"],
  ["MU-FL", "MU", "Flacq"],
  ["MU-GP", "MU", "Grand Port"],
  ["MU-MO", "MU", "Moka"],
  ["MU-PA", "MU", "Pamplemousses"],
  ["MU-PL", "MU", "Port Louis District"],
  ["MU-PW", "MU", "Plaines Wilhems"],
  ["MU-RO", "MU", "Rodrigues"],
  ["MU-RR", "MU", "Rivi\xE8re du Rempart"],
  ["MU-SA", "MU", "Savanne"],
  ["MV-00", "MV", "Alif Dhaal"],
  ["MV-01", "MV", "Addu"],
  ["MV-02", "MV", "Alif Alif"],
  ["MV-03", "MV", "Lhaviyani"],
  ["MV-04", "MV", "Vaavu"],
  ["MV-05", "MV", "Laamu"],
  ["MV-07", "MV", "Haa Alif"],
  ["MV-08", "MV", "Thaa"],
  ["MV-12", "MV", "Meemu"],
  ["MV-13", "MV", "Raa"],
  ["MV-14", "MV", "Faafu"],
  ["MV-17", "MV", "Dhaalu"],
  ["MV-20", "MV", "Baa"],
  ["MV-23", "MV", "Haa Dhaalu"],
  ["MV-24", "MV", "Shaviyani"],
  ["MV-25", "MV", "Noonu"],
  ["MV-26", "MV", "Kaafu"],
  ["MV-27", "MV", "Gaafu Alif"],
  ["MV-28", "MV", "Gaafu Dhaalu"],
  ["MV-29", "MV", "Gnaviyani"],
  ["MV-MLE", "MV", "Mal\xE9"],
  ["MW-BA", "MW", "Balaka"],
  ["MW-BL", "MW", "Blantyre"],
  ["MW-C", "MW", "Central"],
  ["MW-CK", "MW", "Chikwawa"],
  ["MW-CR", "MW", "Chiradzulu"],
  ["MW-CT", "MW", "Chitipa"],
  ["MW-DE", "MW", "Dedza"],
  ["MW-DO", "MW", "Dowa"],
  ["MW-KR", "MW", "Karonga"],
  ["MW-KS", "MW", "Kasungu"],
  ["MW-LI", "MW", "Lilongwe"],
  ["MW-LK", "MW", "Likoma"],
  ["MW-MC", "MW", "Mchinji"],
  ["MW-MG", "MW", "Mangochi"],
  ["MW-MH", "MW", "Machinga"],
  ["MW-MU", "MW", "Mulanje"],
  ["MW-MW", "MW", "Mwanza"],
  ["MW-MZ", "MW", "Mzimba"],
  ["MW-N", "MW", "Northern"],
  ["MW-NB", "MW", "Nkhata Bay"],
  ["MW-NE", "MW", "Neno"],
  ["MW-NI", "MW", "Ntchisi"],
  ["MW-NK", "MW", "Nkhotakota"],
  ["MW-NS", "MW", "Nsanje"],
  ["MW-NU", "MW", "Ntcheu"],
  ["MW-PH", "MW", "Phalombe"],
  ["MW-RU", "MW", "Rumphi"],
  ["MW-S", "MW", "Southern"],
  ["MW-SA", "MW", "Salima"],
  ["MW-TH", "MW", "Thyolo"],
  ["MW-ZO", "MW", "Zomba"],
  ["MX-AGU", "MX", "Aguascalientes"],
  ["MX-BCN", "MX", "Baja California"],
  ["MX-BCS", "MX", "Baja California Sur"],
  ["MX-CAM", "MX", "Campeche"],
  ["MX-CHH", "MX", "Chihuahua"],
  ["MX-CHP", "MX", "Chiapas"],
  ["MX-CMX", "MX", "Ciudad de Mexico"],
  ["MX-COA", "MX", "Coahuila"],
  ["MX-COL", "MX", "Colima"],
  ["MX-DUR", "MX", "Durango"],
  ["MX-GRO", "MX", "Guerrero"],
  ["MX-GUA", "MX", "Guanajuato"],
  ["MX-HID", "MX", "Hidalgo"],
  ["MX-JAL", "MX", "Jalisco"],
  ["MX-MEX", "MX", "Mexico State"],
  ["MX-MIC", "MX", "Michoac\xE1n"],
  ["MX-MOR", "MX", "Morelos"],
  ["MX-NAY", "MX", "Nayarit"],
  ["MX-NLE", "MX", "Nuevo Le\xF3n"],
  ["MX-OAX", "MX", "Oaxaca"],
  ["MX-PUE", "MX", "Puebla"],
  ["MX-QUE", "MX", "Quer\xE9taro"],
  ["MX-ROO", "MX", "Quintana Roo"],
  ["MX-SIN", "MX", "Sinaloa"],
  ["MX-SLP", "MX", "San Luis Potos\xED"],
  ["MX-SON", "MX", "Sonora"],
  ["MX-TAB", "MX", "Tabasco"],
  ["MX-TAM", "MX", "Tamaulipas"],
  ["MX-TLA", "MX", "Tlaxcala"],
  ["MX-VER", "MX", "Veracruz"],
  ["MX-YUC", "MX", "Yucat\xE1n"],
  ["MX-ZAC", "MX", "Zacatecas"],
  ["MY-01", "MY", "Johor"],
  ["MY-02", "MY", "Kedah"],
  ["MY-03", "MY", "Kelantan"],
  ["MY-04", "MY", "Malacca"],
  ["MY-05", "MY", "Negeri Sembilan"],
  ["MY-06", "MY", "Pahang"],
  ["MY-07", "MY", "Penang"],
  ["MY-08", "MY", "Perak"],
  ["MY-09", "MY", "Perlis"],
  ["MY-10", "MY", "Selangor"],
  ["MY-11", "MY", "Terengganu"],
  ["MY-12", "MY", "Sabah"],
  ["MY-13", "MY", "Sarawak"],
  ["MY-14", "MY", "Kuala Lumpur"],
  ["MY-15", "MY", "Labuan"],
  ["MY-16", "MY", "Putrajaya"],
  ["MZ-A", "MZ", "Niassa"],
  ["MZ-B", "MZ", "Manica"],
  ["MZ-G", "MZ", "Gaza"],
  ["MZ-I", "MZ", "Inhambane"],
  ["MZ-L", "MZ", "Maputo Province"],
  ["MZ-MPM", "MZ", "Maputo"],
  ["MZ-N", "MZ", "Nampula"],
  ["MZ-P", "MZ", "Cabo Delgado"],
  ["MZ-Q", "MZ", "Zambezia"],
  ["MZ-S", "MZ", "Sofala"],
  ["MZ-T", "MZ", "Tete"],
  ["NA-CA", "NA", "Zambezi"],
  ["NA-ER", "NA", "Erongo"],
  ["NA-HA", "NA", "Hardap"],
  ["NA-KA", "NA", "Karas"],
  ["NA-KE", "NA", "Kavango East"],
  ["NA-KH", "NA", "Khomas"],
  ["NA-KU", "NA", "Kunene"],
  ["NA-KW", "NA", "Kavango West"],
  ["NA-OD", "NA", "Otjozondjupa"],
  ["NA-OH", "NA", "Omaheke"],
  ["NA-ON", "NA", "Oshana"],
  ["NA-OS", "NA", "Omusati"],
  ["NA-OT", "NA", "Oshikoto"],
  ["NA-OW", "NA", "Ohangwena"],
  ["NE-1", "NE", "Agadez"],
  ["NE-2", "NE", "Diffa"],
  ["NE-3", "NE", "Dosso"],
  ["NE-4", "NE", "Maradi"],
  ["NE-5", "NE", "Tahoua"],
  ["NE-6", "NE", "Tillab\xE9ri"],
  ["NE-7", "NE", "Zinder"],
  ["NE-8", "NE", "Niamey"],
  ["NG-AB", "NG", "Abia"],
  ["NG-AD", "NG", "Adamawa"],
  ["NG-AK", "NG", "Akwa Ibom"],
  ["NG-AN", "NG", "Anambra"],
  ["NG-BA", "NG", "Bauchi"],
  ["NG-BE", "NG", "Benue"],
  ["NG-BO", "NG", "Borno"],
  ["NG-BY", "NG", "Bayelsa"],
  ["NG-CR", "NG", "Cross River"],
  ["NG-DE", "NG", "Delta"],
  ["NG-EB", "NG", "Ebonyi"],
  ["NG-ED", "NG", "Edo"],
  ["NG-EK", "NG", "Ekiti"],
  ["NG-EN", "NG", "Enugu"],
  ["NG-FC", "NG", "Federal Capital Territory"],
  ["NG-GO", "NG", "Gombe"],
  ["NG-IM", "NG", "Imo"],
  ["NG-JI", "NG", "Jigawa"],
  ["NG-KD", "NG", "Kaduna"],
  ["NG-KE", "NG", "Kebbi"],
  ["NG-KN", "NG", "Kano"],
  ["NG-KO", "NG", "Kogi"],
  ["NG-KT", "NG", "Katsina"],
  ["NG-KW", "NG", "Kwara"],
  ["NG-LA", "NG", "Lagos"],
  ["NG-NA", "NG", "Nasarawa"],
  ["NG-NI", "NG", "Niger"],
  ["NG-OG", "NG", "Ogun"],
  ["NG-ON", "NG", "Ondo"],
  ["NG-OS", "NG", "Osun"],
  ["NG-OY", "NG", "Oyo"],
  ["NG-PL", "NG", "Plateau"],
  ["NG-RI", "NG", "Rivers"],
  ["NG-SO", "NG", "Sokoto"],
  ["NG-TA", "NG", "Taraba"],
  ["NG-YO", "NG", "Yobe"],
  ["NG-ZA", "NG", "Zamfara"],
  ["NI-AN", "NI", "Atl\xE1ntico Norte"],
  ["NI-AS", "NI", "Atl\xE1ntico Sur"],
  ["NI-BO", "NI", "Boaco"],
  ["NI-CA", "NI", "Carazo"],
  ["NI-CI", "NI", "Chinandega"],
  ["NI-CO", "NI", "Chontales"],
  ["NI-ES", "NI", "Estel\xED"],
  ["NI-GR", "NI", "Granada"],
  ["NI-JI", "NI", "Jinotega"],
  ["NI-LE", "NI", "Le\xF3n"],
  ["NI-MD", "NI", "Madriz"],
  ["NI-MN", "NI", "Managua"],
  ["NI-MS", "NI", "Masaya"],
  ["NI-MT", "NI", "Matagalpa"],
  ["NI-NS", "NI", "Nueva Segovia"],
  ["NI-RI", "NI", "Rivas"],
  ["NI-SJ", "NI", "R\xEDo San Juan"],
  ["NL-AW", "NL", "Aruba"],
  ["NL-BQ1", "NL", "Bonaire"],
  ["NL-BQ2", "NL", "Saba"],
  ["NL-BQ3", "NL", "Sint Eustatius"],
  ["NL-CW", "NL", "Cura\xE7ao"],
  ["NL-DR", "NL", "Drenthe"],
  ["NL-FL", "NL", "Flevoland"],
  ["NL-FR", "NL", "Friesland"],
  ["NL-GE", "NL", "Gelderland"],
  ["NL-GR", "NL", "Groningen"],
  ["NL-LI", "NL", "Limburg"],
  ["NL-NB", "NL", "North Brabant"],
  ["NL-NH", "NL", "North Holland"],
  ["NL-OV", "NL", "Overijssel"],
  ["NL-SX", "NL", "Sint Maarten"],
  ["NL-UT", "NL", "Utrecht"],
  ["NL-ZE", "NL", "Zeeland"],
  ["NL-ZH", "NL", "South Holland"],
  ["NO-03", "NO", "Oslo"],
  ["NO-11", "NO", "Rogaland"],
  ["NO-15", "NO", "M\xF8re og Romsdal"],
  ["NO-18", "NO", "Nordland"],
  ["NO-21", "NO", "Svalbard"],
  ["NO-22", "NO", "Jan Mayen"],
  ["NO-30", "NO", "Viken"],
  ["NO-34", "NO", "Innlandet"],
  ["NO-38", "NO", "Vestfold og Telemark"],
  ["NO-42", "NO", "Agder"],
  ["NO-46", "NO", "Vestland"],
  ["NO-50", "NO", "Tr\xF8ndelag"],
  ["NO-54", "NO", "Tromssan ja Finmarkun"],
  ["NP-P1", "NP", "Province 1"],
  ["NP-P2", "NP", "Province 2"],
  ["NP-P3", "NP", "Province 3"],
  ["NP-P4", "NP", "Gandaki\xB2"],
  ["NP-P5", "NP", "Province 5"],
  ["NP-P6", "NP", "Karnali\xB2"],
  ["NP-P7", "NP", "Province 7"],
  ["NR-01", "NR", "Aiwo"],
  ["NR-02", "NR", "Anabar"],
  ["NR-03", "NR", "Anetan"],
  ["NR-04", "NR", "Anibare"],
  ["NR-05", "NR", "Baiti"],
  ["NR-06", "NR", "Boe"],
  ["NR-07", "NR", "Buada"],
  ["NR-08", "NR", "Denigomodu"],
  ["NR-09", "NR", "Ewa"],
  ["NR-10", "NR", "Ijuw"],
  ["NR-11", "NR", "Meneng"],
  ["NR-12", "NR", "Nibok"],
  ["NR-13", "NR", "Uaboe"],
  ["NR-14", "NR", "Yaren"],
  ["NZ-AUK", "NZ", "Auckland"],
  ["NZ-BOP", "NZ", "Bay of Plenty"],
  ["NZ-CAN", "NZ", "Canterbury"],
  ["NZ-CIT", "NZ", "Chatham Islands"],
  ["NZ-GIS", "NZ", "Gisborne"],
  ["NZ-HKB", "NZ", "Hawke\u2019s Bay"],
  ["NZ-MBH", "NZ", "Marl"],
  ["NZ-MWT", "NZ", "Manawatu-Wanganui"],
  ["NZ-NSN", "NZ", "Nelson"],
  ["NZ-NTL", "NZ", "Northland"],
  ["NZ-OTA", "NZ", "Otago"],
  ["NZ-STL", "NZ", "Southland"],
  ["NZ-TAS", "NZ", "Tasman"],
  ["NZ-TKI", "NZ", "Taranaki"],
  ["NZ-WGN", "NZ", "Wellington"],
  ["NZ-WKO", "NZ", "Waikato"],
  ["NZ-WTC", "NZ", "West Coast"],
  ["OM-BJ", "OM", "Janub al Batinah"],
  ["OM-BS", "OM", "Shamal al Batinah"],
  ["OM-BU", "OM", "Al Buraimi"],
  ["OM-DA", "OM", "Ad Dakhiliyah"],
  ["OM-MA", "OM", "Muscat"],
  ["OM-MU", "OM", "Musandam"],
  ["OM-SJ", "OM", "Janub ash Sharqiyah"],
  ["OM-SS", "OM", "Shamal ash Sharqiyah"],
  ["OM-WU", "OM", "Al Wusta"],
  ["OM-ZA", "OM", "Ad Dhahirah"],
  ["OM-ZU", "OM", "Dhofar"],
  ["PA-1", "PA", "Bocas del Toro"],
  ["PA-10", "PA", "West Panam\xE1"],
  ["PA-2", "PA", "Cocl\xE9"],
  ["PA-3", "PA", "Col\xF3n"],
  ["PA-4", "PA", "Chiriqu\xED"],
  ["PA-5", "PA", "Dari\xE9n"],
  ["PA-6", "PA", "Herrera"],
  ["PA-7", "PA", "Los Santos"],
  ["PA-8", "PA", "Panam\xE1"],
  ["PA-9", "PA", "Veraguas"],
  ["PA-EM", "PA", "Ember\xE1"],
  ["PA-KY", "PA", "Guna Yala"],
  ["PA-NB", "PA", "Ng\xF6be-Bugl\xE9"],
  ["PA-NT", "PA", "Naso Tj\xEBr Di"],
  ["PE-AMA", "PE", "Amazonas"],
  ["PE-ANC", "PE", "Ancash"],
  ["PE-APU", "PE", "Apur\xEDmac"],
  ["PE-ARE", "PE", "Arequipa"],
  ["PE-AYA", "PE", "Ayacucho"],
  ["PE-CAJ", "PE", "Cajamarca"],
  ["PE-CAL", "PE", "El Callao"],
  ["PE-CUS", "PE", "Cusco"],
  ["PE-HUC", "PE", "Hu\xE1nuco"],
  ["PE-HUV", "PE", "Huancavelica"],
  ["PE-ICA", "PE", "Ica"],
  ["PE-JUN", "PE", "Jun\xEDn"],
  ["PE-LAL", "PE", "La Libertad"],
  ["PE-LAM", "PE", "Lambayeque"],
  ["PE-LIM", "PE", "Lima Region"],
  ["PE-LMA", "PE", "Lima"],
  ["PE-LOR", "PE", "Loreto"],
  ["PE-MDD", "PE", "Madre de Dios"],
  ["PE-MOQ", "PE", "Moquegua"],
  ["PE-PAS", "PE", "Pasco"],
  ["PE-PIU", "PE", "Piura"],
  ["PE-PUN", "PE", "Puno"],
  ["PE-SAM", "PE", "San Mart\xEDn"],
  ["PE-TAC", "PE", "Tacna"],
  ["PE-TUM", "PE", "Tumbes"],
  ["PE-UCA", "PE", "Ucayali"],
  ["PG-CPK", "PG", "Chimbu"],
  ["PG-CPM", "PG", "Central"],
  ["PG-EBR", "PG", "East New Britain"],
  ["PG-EHG", "PG", "Eastern Highlands"],
  ["PG-EPW", "PG", "Enga"],
  ["PG-ESW", "PG", "East Sepik"],
  ["PG-GPK", "PG", "Gulf"],
  ["PG-HLA", "PG", "Hela"],
  ["PG-JWK", "PG", "Jiwaka"],
  ["PG-MBA", "PG", "Milne Bay"],
  ["PG-MPL", "PG", "Morobe"],
  ["PG-MPM", "PG", "Madang"],
  ["PG-MRL", "PG", "Manus"],
  ["PG-NCD", "PG", "Port Moresby"],
  ["PG-NIK", "PG", "New Ireland"],
  ["PG-NPP", "PG", "Oro"],
  ["PG-NSB", "PG", "Bougainville"],
  ["PG-SAN", "PG", "Sandaun"],
  ["PG-SHM", "PG", "Southern Highlands"],
  ["PG-WBK", "PG", "West New Britain"],
  ["PG-WHM", "PG", "Western Highlands"],
  ["PG-WPD", "PG", "Western"],
  ["PH-00", "PH", "Metro Manila"],
  ["PH-01", "PH", "Ilocos"],
  ["PH-02", "PH", "Cagayan Valley"],
  ["PH-03", "PH", "Central Luzon"],
  ["PH-05", "PH", "Bicol"],
  ["PH-06", "PH", "Western Visayas"],
  ["PH-07", "PH", "Central Visayas"],
  ["PH-08", "PH", "Eastern Visayas"],
  ["PH-09", "PH", "Zamboanga Peninsula"],
  ["PH-10", "PH", "Northern Mindanao"],
  ["PH-11", "PH", "Davao"],
  ["PH-12", "PH", "Soccsksargen"],
  ["PH-13", "PH", "Caraga"],
  ["PH-14", "PH", "Muslim Mindanao"],
  ["PH-15", "PH", "Cordillera Administrative"],
  ["PH-40", "PH", "Calabarzon"],
  ["PH-41", "PH", "Mimaropa"],
  ["PH-ABR", "PH", "Abra"],
  ["PH-AGN", "PH", "Agusan del Norte"],
  ["PH-AGS", "PH", "Agusan del Sur"],
  ["PH-AKL", "PH", "Aklan"],
  ["PH-ALB", "PH", "Albay"],
  ["PH-ANT", "PH", "Antique"],
  ["PH-APA", "PH", "Apayao"],
  ["PH-AUR", "PH", "Aurora"],
  ["PH-BAN", "PH", "Bataan"],
  ["PH-BAS", "PH", "Basilan"],
  ["PH-BEN", "PH", "Benguet"],
  ["PH-BIL", "PH", "Biliran"],
  ["PH-BOH", "PH", "Bohol"],
  ["PH-BTG", "PH", "Batangas"],
  ["PH-BTN", "PH", "Batanes"],
  ["PH-BUK", "PH", "Bukidnon"],
  ["PH-BUL", "PH", "Bulacan"],
  ["PH-CAG", "PH", "Cagayan"],
  ["PH-CAM", "PH", "Camiguin"],
  ["PH-CAN", "PH", "Camarines Norte"],
  ["PH-CAP", "PH", "Capiz"],
  ["PH-CAS", "PH", "Camarines Sur"],
  ["PH-CAT", "PH", "Catanduanes"],
  ["PH-CAV", "PH", "Cavite"],
  ["PH-CEB", "PH", "Cebu"],
  ["PH-COM", "PH", "Compostela Valley"],
  ["PH-DAO", "PH", "Davao Oriental"],
  ["PH-DAS", "PH", "Davao del Sur"],
  ["PH-DAV", "PH", "Davao del Norte"],
  ["PH-DIN", "PH", "Dinagat Islands"],
  ["PH-DVO", "PH", "Davao Occidental"],
  ["PH-EAS", "PH", "Eastern Samar"],
  ["PH-GUI", "PH", "Guimaras"],
  ["PH-IFU", "PH", "Ifugao"],
  ["PH-ILI", "PH", "Iloilo"],
  ["PH-ILN", "PH", "Ilocos Norte"],
  ["PH-ILS", "PH", "Ilocos Sur"],
  ["PH-ISA", "PH", "Isabela"],
  ["PH-KAL", "PH", "Kalinga"],
  ["PH-LAG", "PH", "Laguna"],
  ["PH-LAN", "PH", "Lanao del Norte"],
  ["PH-LAS", "PH", "Lanao del Sur"],
  ["PH-LEY", "PH", "Leyte"],
  ["PH-LUN", "PH", "La Union"],
  ["PH-MAD", "PH", "Marinduque"],
  ["PH-MAS", "PH", "Masbate"],
  ["PH-MDC", "PH", "Occidental Mindoro"],
  ["PH-MDR", "PH", "Oriental Mindoro"],
  ["PH-MGN", "PH", "Maguindanao del Norte"],
  ["PH-MGS", "PH", "Maguindanao del Sur"],
  ["PH-MOU", "PH", "Mountain"],
  ["PH-MSC", "PH", "Misamis Occidental"],
  ["PH-MSR", "PH", "Misamis Oriental"],
  ["PH-NCO", "PH", "Cotabato"],
  ["PH-NEC", "PH", "Negros Occidental"],
  ["PH-NER", "PH", "Negros Oriental"],
  ["PH-NSA", "PH", "Northern Samar"],
  ["PH-NUE", "PH", "Nueva Ecija"],
  ["PH-NUV", "PH", "Nueva Vizcaya"],
  ["PH-PAM", "PH", "Pampanga"],
  ["PH-PAN", "PH", "Pangasinan"],
  ["PH-PLW", "PH", "Palawan"],
  ["PH-QUE", "PH", "Quezon"],
  ["PH-QUI", "PH", "Quirino"],
  ["PH-RIZ", "PH", "Rizal"],
  ["PH-ROM", "PH", "Romblon"],
  ["PH-SAR", "PH", "Sarangani"],
  ["PH-SCO", "PH", "South Cotabato"],
  ["PH-SIG", "PH", "Siquijor"],
  ["PH-SLE", "PH", "Southern Leyte"],
  ["PH-SLU", "PH", "Sulu"],
  ["PH-SOR", "PH", "Sorsogon"],
  ["PH-SUK", "PH", "Sultan Kudarat"],
  ["PH-SUN", "PH", "Surigao del Norte"],
  ["PH-SUR", "PH", "Surigao del Sur"],
  ["PH-TAR", "PH", "Tarlac"],
  ["PH-TAW", "PH", "Tawi-Tawi"],
  ["PH-WSA", "PH", "Samar"],
  ["PH-ZAN", "PH", "Zamboanga del Norte"],
  ["PH-ZAS", "PH", "Zamboanga del Sur"],
  ["PH-ZMB", "PH", "Zambales"],
  ["PH-ZSI", "PH", "Zamboanga Sibugay"],
  ["PK-BA", "PK", "Balochistan"],
  ["PK-GB", "PK", "Gilgit-Baltistan"],
  ["PK-IS", "PK", "Islamabad"],
  ["PK-JK", "PK", "Azad Kashmir"],
  ["PK-KP", "PK", "Khyber Pakhtunkhwa"],
  ["PK-PB", "PK", "Punjab"],
  ["PK-SD", "PK", "Sindh"],
  ["PL-02", "PL", "Lower Silesia"],
  ["PL-04", "PL", "Kuyavia-Pomerania"],
  ["PL-06", "PL", "Lublin"],
  ["PL-08", "PL", "Lubusz"],
  ["PL-10", "PL", "\u0141\xF3d\u017A"],
  ["PL-12", "PL", "Lesser Poland"],
  ["PL-14", "PL", "Mazovia"],
  ["PL-16", "PL", "Opole"],
  ["PL-18", "PL", "Subcarpathia"],
  ["PL-20", "PL", "Podlachia"],
  ["PL-22", "PL", "Pomerania"],
  ["PL-24", "PL", "Silesia"],
  ["PL-26", "PL", "Holy Cross"],
  ["PL-28", "PL", "Warmia-Masuria"],
  ["PL-30", "PL", "Greater Poland"],
  ["PL-32", "PL", "West Pomerania"],
  ["PS-BTH", "PS", "Bethlehem"],
  ["PS-DEB", "PS", "Deir al-Balah"],
  ["PS-GZA", "PS", "Gaza"],
  ["PS-HBN", "PS", "Hebron"],
  ["PS-JEM", "PS", "Jerusalem"],
  ["PS-JEN", "PS", "Jenin"],
  ["PS-JRH", "PS", "Jericho"],
  ["PS-KYS", "PS", "Khan Yunis"],
  ["PS-NBS", "PS", "Nablus"],
  ["PS-NGZ", "PS", "North Gaza"],
  ["PS-QQA", "PS", "Qalqilya"],
  ["PS-RBH", "PS", "Ramallah and al-Bireh"],
  ["PS-RFH", "PS", "Rafah"],
  ["PS-SLT", "PS", "Salfit"],
  ["PS-TBS", "PS", "Tubas"],
  ["PS-TKM", "PS", "Tulkarm"],
  ["PT-01", "PT", "Aveiro"],
  ["PT-02", "PT", "Beja"],
  ["PT-03", "PT", "Braga"],
  ["PT-04", "PT", "Bragan\xE7a"],
  ["PT-05", "PT", "Castelo Branco"],
  ["PT-06", "PT", "Coimbra"],
  ["PT-07", "PT", "\xC9vora"],
  ["PT-08", "PT", "Faro"],
  ["PT-09", "PT", "Guarda"],
  ["PT-10", "PT", "Leiria"],
  ["PT-11", "PT", "Lisbon"],
  ["PT-12", "PT", "Portalegre"],
  ["PT-13", "PT", "Porto"],
  ["PT-14", "PT", "Santar\xE9m"],
  ["PT-15", "PT", "Set\xFAbal"],
  ["PT-16", "PT", "Viana do Castelo"],
  ["PT-17", "PT", "Vila Real"],
  ["PT-18", "PT", "Viseu"],
  ["PT-20", "PT", "Azores"],
  ["PT-30", "PT", "Madeira"],
  ["PW-002", "PW", "Aimeliik"],
  ["PW-004", "PW", "Airai"],
  ["PW-010", "PW", "Angaur"],
  ["PW-050", "PW", "Hatohobei"],
  ["PW-100", "PW", "Kayangel"],
  ["PW-150", "PW", "Koror"],
  ["PW-212", "PW", "Melekeok"],
  ["PW-214", "PW", "Ngaraard"],
  ["PW-218", "PW", "Ngarchelong"],
  ["PW-222", "PW", "Ngardmau"],
  ["PW-224", "PW", "Ngatpang"],
  ["PW-226", "PW", "Ngchesar"],
  ["PW-227", "PW", "Ngeremlengui"],
  ["PW-228", "PW", "Ngiwal"],
  ["PW-350", "PW", "Peleliu"],
  ["PW-370", "PW", "Sonsorol"],
  ["PY-1", "PY", "Concepci\xF3n"],
  ["PY-10", "PY", "Alto Paran\xE1"],
  ["PY-11", "PY", "Central"],
  ["PY-12", "PY", "\xD1eembuc\xFA"],
  ["PY-13", "PY", "Amambay"],
  ["PY-14", "PY", "Canindey\xFA"],
  ["PY-15", "PY", "Presidente Hayes"],
  ["PY-16", "PY", "Alto Paraguay"],
  ["PY-19", "PY", "Boquer\xF3n"],
  ["PY-2", "PY", "San Pedro"],
  ["PY-3", "PY", "Cordillera"],
  ["PY-4", "PY", "Guair\xE1"],
  ["PY-5", "PY", "Caaguaz\xFA"],
  ["PY-6", "PY", "Caazap\xE1"],
  ["PY-7", "PY", "Itap\xFAa"],
  ["PY-8", "PY", "Misiones"],
  ["PY-9", "PY", "Paraguar\xED"],
  ["PY-ASU", "PY", "Asunci\xF3n"],
  ["QA-DA", "QA", "Doha"],
  ["QA-KH", "QA", "Al Khor"],
  ["QA-MS", "QA", "Madinat ash Shamal"],
  ["QA-RA", "QA", "Al Rayyan"],
  ["QA-SH", "QA", "Ash Sh\u012B\u1E29\u0101n\u012Byah"],
  ["QA-US", "QA", "Umm Salal"],
  ["QA-WA", "QA", "Al Wakrah"],
  ["QA-ZA", "QA", "Al Daayen"],
  ["RO-AB", "RO", "Alba"],
  ["RO-AG", "RO", "Arge\u0219"],
  ["RO-AR", "RO", "Arad"],
  ["RO-B", "RO", "Bucharest"],
  ["RO-BC", "RO", "Bac\u0103u"],
  ["RO-BH", "RO", "Bihor"],
  ["RO-BN", "RO", "Bistri\u0163a-N\u0103s\u0103ud"],
  ["RO-BR", "RO", "Br\u0103ila"],
  ["RO-BT", "RO", "Boto\u015Fani"],
  ["RO-BV", "RO", "Bra\u015Fov"],
  ["RO-BZ", "RO", "Buz\u0103u"],
  ["RO-CJ", "RO", "Cluj"],
  ["RO-CL", "RO", "C\u0103l\u0103ra\u0219i"],
  ["RO-CS", "RO", "Cara\u0219-Severin"],
  ["RO-CT", "RO", "Constan\u021Ba"],
  ["RO-CV", "RO", "Covasna"],
  ["RO-DB", "RO", "D\xE2mbovi\u021Ba"],
  ["RO-DJ", "RO", "Dolj"],
  ["RO-GJ", "RO", "Gorj"],
  ["RO-GL", "RO", "Gala\u021Bi"],
  ["RO-GR", "RO", "Giurgiu"],
  ["RO-HD", "RO", "Hunedoara"],
  ["RO-HR", "RO", "Harghita"],
  ["RO-IF", "RO", "Ilfov"],
  ["RO-IL", "RO", "Ialomi\u021Ba"],
  ["RO-IS", "RO", "Ia\u0219i"],
  ["RO-MH", "RO", "Mehedin\u021Bi"],
  ["RO-MM", "RO", "Maramure\u015F"],
  ["RO-MS", "RO", "Mure\u015F"],
  ["RO-NT", "RO", "Neam\u0163"],
  ["RO-OT", "RO", "Olt"],
  ["RO-PH", "RO", "Prahova"],
  ["RO-SB", "RO", "Sibiu"],
  ["RO-SJ", "RO", "S\u0103laj"],
  ["RO-SM", "RO", "Satu Mare"],
  ["RO-SV", "RO", "Suceava"],
  ["RO-TL", "RO", "Tulcea"],
  ["RO-TM", "RO", "Timi\u0219"],
  ["RO-TR", "RO", "Teleorman"],
  ["RO-VL", "RO", "V\xE2lcea"],
  ["RO-VN", "RO", "Vrancea"],
  ["RO-VS", "RO", "Vaslui"],
  ["RS-00", "RS", "Beograd"],
  ["RS-01", "RS", "North Ba\u010Dka"],
  ["RS-02", "RS", "Central Banat"],
  ["RS-03", "RS", "North Banat"],
  ["RS-04", "RS", "South Banat"],
  ["RS-05", "RS", "West Ba\u010Dka"],
  ["RS-06", "RS", "South Ba\u010Dka"],
  ["RS-07", "RS", "Srem"],
  ["RS-08", "RS", "Ma\u010Dva"],
  ["RS-09", "RS", "Kolubara"],
  ["RS-10", "RS", "Podunavlje"],
  ["RS-11", "RS", "Brani\u010Devo"],
  ["RS-12", "RS", "\u0160umadija"],
  ["RS-13", "RS", "Pomoravlje"],
  ["RS-14", "RS", "Bor"],
  ["RS-15", "RS", "Zaje\u010Dar"],
  ["RS-16", "RS", "Zlatibor"],
  ["RS-17", "RS", "Moravica"],
  ["RS-18", "RS", "Ra\u0161ka"],
  ["RS-19", "RS", "Rasina"],
  ["RS-20", "RS", "Ni\u0161ava"],
  ["RS-21", "RS", "Toplica"],
  ["RS-22", "RS", "Pirot"],
  ["RS-23", "RS", "Jablanica"],
  ["RS-24", "RS", "P\u010Dinja"],
  ["RS-25", "RS", "Kosovo"],
  ["RS-26", "RS", "Pe\u0107"],
  ["RS-27", "RS", "Prizren"],
  ["RS-28", "RS", "Kosovska Mitrovica"],
  ["RS-29", "RS", "Kosovo-Pomoravlje"],
  ["RS-KM", "RS", "Kosovo-Metohija"],
  ["RS-VO", "RS", "Vojvodina"],
  ["RU-AD", "RU", "Adygea"],
  ["RU-AL", "RU", "Altai"],
  ["RU-ALT", "RU", "Altai Krai"],
  ["RU-AMU", "RU", "Amur"],
  ["RU-ARK", "RU", "Arkhangelsk"],
  ["RU-AST", "RU", "Astrakhan"],
  ["RU-BA", "RU", "Bashkortostan"],
  ["RU-BEL", "RU", "Belgorod"],
  ["RU-BRY", "RU", "Bryansk"],
  ["RU-BU", "RU", "Buryat"],
  ["RU-CE", "RU", "Chechen"],
  ["RU-CHE", "RU", "Chelyabinsk"],
  ["RU-CHU", "RU", "Chukotka Okrug"],
  ["RU-CU", "RU", "Chuvash"],
  ["RU-DA", "RU", "Dagestan"],
  ["RU-IN", "RU", "Ingushetia"],
  ["RU-IRK", "RU", "Irkutsk"],
  ["RU-IVA", "RU", "Ivanovo"],
  ["RU-KAM", "RU", "Kamchatka Krai"],
  ["RU-KB", "RU", "Kabardino-Balkar"],
  ["RU-KC", "RU", "Karachay-Cherkess"],
  ["RU-KDA", "RU", "Krasnodar Krai"],
  ["RU-KEM", "RU", "Kemerovo"],
  ["RU-KGD", "RU", "Kaliningrad"],
  ["RU-KGN", "RU", "Kurgan"],
  ["RU-KHA", "RU", "Khabarovsk Krai"],
  ["RU-KHM", "RU", "Khanty-Mansi"],
  ["RU-KIR", "RU", "Kirov"],
  ["RU-KK", "RU", "Khakassia"],
  ["RU-KL", "RU", "Kalmykia"],
  ["RU-KLU", "RU", "Kaluga"],
  ["RU-KO", "RU", "Komi"],
  ["RU-KOS", "RU", "Kostroma"],
  ["RU-KR", "RU", "Karelia"],
  ["RU-KRS", "RU", "Kursk"],
  ["RU-KYA", "RU", "Krasnoyarsk Krai"],
  ["RU-LEN", "RU", "Leningrad"],
  ["RU-LIP", "RU", "Lipetsk"],
  ["RU-MAG", "RU", "Magadan"],
  ["RU-ME", "RU", "Mari El"],
  ["RU-MO", "RU", "Mordovia"],
  ["RU-MOS", "RU", "Moscow Province"],
  ["RU-MOW", "RU", "Moscow"],
  ["RU-MUR", "RU", "Murmansk"],
  ["RU-NEN", "RU", "Nenets"],
  ["RU-NGR", "RU", "Novgorod"],
  ["RU-NIZ", "RU", "Nizhny Novgorod"],
  ["RU-NVS", "RU", "Novosibirsk"],
  ["RU-OMS", "RU", "Omsk"],
  ["RU-ORE", "RU", "Orenburg"],
  ["RU-ORL", "RU", "Oryol"],
  ["RU-PER", "RU", "Perm Krai"],
  ["RU-PNZ", "RU", "Penza"],
  ["RU-PRI", "RU", "Primorsky Krai"],
  ["RU-PSK", "RU", "Pskov"],
  ["RU-ROS", "RU", "Rostov"],
  ["RU-RYA", "RU", "Ryazan"],
  ["RU-SA", "RU", "Sakha"],
  ["RU-SAK", "RU", "Sakhalin"],
  ["RU-SAM", "RU", "Samara"],
  ["RU-SAR", "RU", "Saratov"],
  ["RU-SE", "RU", "North Ossetia-Alania"],
  ["RU-SMO", "RU", "Smolensk"],
  ["RU-SPE", "RU", "Saint Petersburg"],
  ["RU-STA", "RU", "Stavropol Krai"],
  ["RU-SVE", "RU", "Sverdlovsk"],
  ["RU-TA", "RU", "Tatarstan"],
  ["RU-TAM", "RU", "Tambov"],
  ["RU-TOM", "RU", "Tomsk"],
  ["RU-TUL", "RU", "Tula"],
  ["RU-TVE", "RU", "Tver"],
  ["RU-TY", "RU", "Tuva"],
  ["RU-TYU", "RU", "Tyumen"],
  ["RU-UD", "RU", "Udmurt"],
  ["RU-ULY", "RU", "Ulyanovsk"],
  ["RU-VGG", "RU", "Volgograd"],
  ["RU-VLA", "RU", "Vladimir"],
  ["RU-VLG", "RU", "Vologda"],
  ["RU-VOR", "RU", "Voronezh"],
  ["RU-YAN", "RU", "Yamalo-Nenets Okrug"],
  ["RU-YAR", "RU", "Yaroslavl"],
  ["RU-YEV", "RU", "Jewish"],
  ["RU-ZAB", "RU", "Zabaykalsky Krai"],
  ["RW-01", "RW", "Kigali"],
  ["RW-02", "RW", "Eastern"],
  ["RW-03", "RW", "Northern"],
  ["RW-04", "RW", "Western"],
  ["RW-05", "RW", "Southern"],
  ["SA-01", "SA", "Riyadh"],
  ["SA-02", "SA", "Makkah"],
  ["SA-03", "SA", "Al Madinah"],
  ["SA-04", "SA", "Eastern"],
  ["SA-05", "SA", "Al-Qassim"],
  ["SA-06", "SA", "Ha\u2019il"],
  ["SA-07", "SA", "Tabuk"],
  ["SA-08", "SA", "Northern Borders"],
  ["SA-09", "SA", "Jizan"],
  ["SA-10", "SA", "Najran"],
  ["SA-11", "SA", "Al Bahah"],
  ["SA-12", "SA", "Al Jawf"],
  ["SA-14", "SA", "Asir"],
  ["SB-CE", "SB", "Central"],
  ["SB-CH", "SB", "Choiseul"],
  ["SB-CT", "SB", "Honiara"],
  ["SB-GU", "SB", "Guadalcanal"],
  ["SB-IS", "SB", "Isabel"],
  ["SB-MK", "SB", "Makira-Ulawa"],
  ["SB-ML", "SB", "Malaita"],
  ["SB-RB", "SB", "Rennell and Bellona"],
  ["SB-TE", "SB", "Temotu"],
  ["SB-WE", "SB", "Western"],
  ["SC-01", "SC", "Anse aux Pins"],
  ["SC-02", "SC", "Anse Boileau"],
  ["SC-03", "SC", "Anse Etoile"],
  ["SC-04", "SC", "Au Cap"],
  ["SC-05", "SC", "Anse Royale"],
  ["SC-06", "SC", "Baie Lazare"],
  ["SC-07", "SC", "Baie Sainte Anne"],
  ["SC-08", "SC", "Beau Vallon"],
  ["SC-09", "SC", "Bel Air"],
  ["SC-10", "SC", "Bel Ombre"],
  ["SC-11", "SC", "Cascade"],
  ["SC-12", "SC", "Glacis"],
  ["SC-13", "SC", "Grand\u2019Anse Mah\xE9"],
  ["SC-14", "SC", "Grand\u2019Anse Praslin"],
  ["SC-15", "SC", "La Digue"],
  ["SC-16", "SC", "La Rivi\xE8re Anglaise"],
  ["SC-17", "SC", "Mont Buxton"],
  ["SC-18", "SC", "Mont Fleuri"],
  ["SC-19", "SC", "Plaisance"],
  ["SC-20", "SC", "Pointe La Rue"],
  ["SC-21", "SC", "Port Glaud"],
  ["SC-22", "SC", "Saint Louis"],
  ["SC-23", "SC", "Takamaka"],
  ["SC-24", "SC", "Les Mamelles"],
  ["SC-25", "SC", "Roche Caiman"],
  ["SC-26", "SC", "Ile Perseverance I"],
  ["SC-27", "SC", "Ile Perseverance II"],
  ["SD-DC", "SD", "Central Darfur"],
  ["SD-DE", "SD", "East Darfur"],
  ["SD-DN", "SD", "North Darfur"],
  ["SD-DS", "SD", "South Darfur"],
  ["SD-DW", "SD", "West Darfur"],
  ["SD-GD", "SD", "Al Qadarif"],
  ["SD-GK", "SD", "West Kurdufan"],
  ["SD-GZ", "SD", "Al Jazirah"],
  ["SD-KA", "SD", "Kassala"],
  ["SD-KH", "SD", "Khartoum"],
  ["SD-KN", "SD", "North Kurdufan"],
  ["SD-KS", "SD", "South Kurdufan"],
  ["SD-NB", "SD", "Blue Nile"],
  ["SD-NO", "SD", "Northern"],
  ["SD-NR", "SD", "River Nile"],
  ["SD-NW", "SD", "White Nile"],
  ["SD-RS", "SD", "Red Sea"],
  ["SD-SI", "SD", "Sennar"],
  ["SE-AB", "SE", "Stockholm"],
  ["SE-AC", "SE", "V\xE4sterbotten"],
  ["SE-BD", "SE", "Norrbotten"],
  ["SE-C", "SE", "Uppsala"],
  ["SE-D", "SE", "S\xF6dermanland"],
  ["SE-E", "SE", "\xD6sterg\xF6tland"],
  ["SE-F", "SE", "J\xF6nk\xF6ping"],
  ["SE-G", "SE", "Kronoberg"],
  ["SE-H", "SE", "Kalmar"],
  ["SE-I", "SE", "Gotland"],
  ["SE-K", "SE", "Blekinge"],
  ["SE-M", "SE", "Sk\xE5ne"],
  ["SE-N", "SE", "Halland"],
  ["SE-O", "SE", "V\xE4stra G\xF6taland"],
  ["SE-S", "SE", "V\xE4rmland"],
  ["SE-T", "SE", "\xD6rebro"],
  ["SE-U", "SE", "V\xE4stmanland"],
  ["SE-W", "SE", "Dalarna"],
  ["SE-X", "SE", "G\xE4vleborg"],
  ["SE-Y", "SE", "V\xE4sternorrland"],
  ["SE-Z", "SE", "J\xE4mtland"],
  ["SG-01", "SG", "Central Singapore"],
  ["SG-02", "SG", "North East"],
  ["SG-03", "SG", "North West"],
  ["SG-04", "SG", "South East"],
  ["SG-05", "SG", "South West"],
  ["SH-AC", "SH", "Ascension Island"],
  ["SH-HL", "SH", "Saint Helena"],
  ["SH-TA", "SH", "Tristan da Cunha"],
  ["SI-001", "SI", "Ajdov\u0161\u010Dina"],
  ["SI-002", "SI", "Beltinci"],
  ["SI-003", "SI", "Bled"],
  ["SI-004", "SI", "Bohinj"],
  ["SI-005", "SI", "Borovnica"],
  ["SI-006", "SI", "Bovec"],
  ["SI-007", "SI", "Brda"],
  ["SI-008", "SI", "Brezovica"],
  ["SI-009", "SI", "Bre\u017Eice"],
  ["SI-010", "SI", "Ti\u0161ina"],
  ["SI-011", "SI", "Celje"],
  ["SI-012", "SI", "Cerklje na Gorenjskem"],
  ["SI-013", "SI", "Cerknica"],
  ["SI-014", "SI", "Cerkno"],
  ["SI-015", "SI", "\u010Cren\u0161ovci"],
  ["SI-016", "SI", "\u010Crna na Koro\u0161kem"],
  ["SI-017", "SI", "\u010Crnomelj"],
  ["SI-018", "SI", "Destrnik"],
  ["SI-019", "SI", "Diva\u010Da"],
  ["SI-020", "SI", "Dobrepolje"],
  ["SI-021", "SI", "Dobrova\u2013Polhov Gradec"],
  ["SI-022", "SI", "Dol pri Ljubljani"],
  ["SI-023", "SI", "Dom\u017Eale"],
  ["SI-024", "SI", "Dornava"],
  ["SI-025", "SI", "Dravograd"],
  ["SI-026", "SI", "Duplek"],
  ["SI-027", "SI", "Gorenja Vas\u2013Poljane"],
  ["SI-028", "SI", "Gori\u0161nica"],
  ["SI-029", "SI", "Gornja Radgona"],
  ["SI-030", "SI", "Gornji Grad"],
  ["SI-031", "SI", "Gornji Petrovci"],
  ["SI-032", "SI", "Grosuplje"],
  ["SI-033", "SI", "\u0160alovci"],
  ["SI-034", "SI", "Hrastnik"],
  ["SI-035", "SI", "Hrpelje\u2013Kozina"],
  ["SI-036", "SI", "Idrija"],
  ["SI-037", "SI", "Ig"],
  ["SI-038", "SI", "Ilirska Bistrica"],
  ["SI-039", "SI", "Ivan\u010Dna Gorica"],
  ["SI-040", "SI", "Izola"],
  ["SI-041", "SI", "Jesenice"],
  ["SI-042", "SI", "Jur\u0161inci"],
  ["SI-043", "SI", "Kamnik"],
  ["SI-044", "SI", "Kanal"],
  ["SI-045", "SI", "Kidri\u010Devo"],
  ["SI-046", "SI", "Kobarid"],
  ["SI-047", "SI", "Kobilje"],
  ["SI-048", "SI", "Ko\u010Devje"],
  ["SI-049", "SI", "Komen"],
  ["SI-050", "SI", "Koper"],
  ["SI-051", "SI", "Kozje"],
  ["SI-052", "SI", "Kranj"],
  ["SI-053", "SI", "Kranjska Gora"],
  ["SI-054", "SI", "Kr\u0161ko"],
  ["SI-055", "SI", "Kungota"],
  ["SI-056", "SI", "Kuzma"],
  ["SI-057", "SI", "La\u0161ko"],
  ["SI-058", "SI", "Lenart"],
  ["SI-059", "SI", "Lendava"],
  ["SI-060", "SI", "Litija"],
  ["SI-061", "SI", "Ljubljana"],
  ["SI-062", "SI", "Ljubno"],
  ["SI-063", "SI", "Ljutomer"],
  ["SI-064", "SI", "Logatec"],
  ["SI-065", "SI", "Lo\u0161ka Dolina"],
  ["SI-066", "SI", "Lo\u0161ki Potok"],
  ["SI-067", "SI", "Lu\u010De"],
  ["SI-068", "SI", "Lukovica"],
  ["SI-069", "SI", "Maj\u0161perk"],
  ["SI-070", "SI", "Maribor"],
  ["SI-071", "SI", "Medvode"],
  ["SI-072", "SI", "Menge\u0161"],
  ["SI-073", "SI", "Metlika"],
  ["SI-074", "SI", "Me\u017Eica"],
  ["SI-075", "SI", "Miren\u2013Kostanjevica"],
  ["SI-076", "SI", "Mislinja"],
  ["SI-077", "SI", "Morav\u010De"],
  ["SI-078", "SI", "Moravske Toplice"],
  ["SI-079", "SI", "Mozirje"],
  ["SI-080", "SI", "Murska Sobota"],
  ["SI-081", "SI", "Muta"],
  ["SI-082", "SI", "Naklo"],
  ["SI-083", "SI", "Nazarje"],
  ["SI-084", "SI", "Nova Gorica"],
  ["SI-085", "SI", "Novo Mesto"],
  ["SI-086", "SI", "Odranci"],
  ["SI-087", "SI", "Ormo\u017E"],
  ["SI-088", "SI", "Osilnica"],
  ["SI-089", "SI", "Pesnica"],
  ["SI-090", "SI", "Piran"],
  ["SI-091", "SI", "Pivka"],
  ["SI-092", "SI", "Pod\u010Detrtek"],
  ["SI-093", "SI", "Podvelka"],
  ["SI-094", "SI", "Postojna"],
  ["SI-095", "SI", "Preddvor"],
  ["SI-096", "SI", "Ptuj"],
  ["SI-097", "SI", "Puconci"],
  ["SI-098", "SI", "Ra\u010De\u2013Fram"],
  ["SI-099", "SI", "Rade\u010De"],
  ["SI-100", "SI", "Radenci"],
  ["SI-101", "SI", "Radlje ob Dravi"],
  ["SI-102", "SI", "Radovljica"],
  ["SI-103", "SI", "Ravne na Koro\u0161kem"],
  ["SI-104", "SI", "Ribnica"],
  ["SI-105", "SI", "Roga\u0161ovci"],
  ["SI-106", "SI", "Roga\u0161ka Slatina"],
  ["SI-107", "SI", "Rogatec"],
  ["SI-108", "SI", "Ru\u0161e"],
  ["SI-109", "SI", "Semi\u010D"],
  ["SI-110", "SI", "Sevnica"],
  ["SI-111", "SI", "Se\u017Eana"],
  ["SI-112", "SI", "Slovenj Gradec"],
  ["SI-113", "SI", "Slovenska Bistrica"],
  ["SI-114", "SI", "Slovenske Konjice"],
  ["SI-115", "SI", "Star\u0161e"],
  ["SI-116", "SI", "Sveti Jurij"],
  ["SI-117", "SI", "\u0160en\u010Dur"],
  ["SI-118", "SI", "\u0160entilj"],
  ["SI-119", "SI", "\u0160entjernej"],
  ["SI-120", "SI", "\u0160entjur"],
  ["SI-121", "SI", "\u0160kocjan"],
  ["SI-122", "SI", "\u0160kofja Loka"],
  ["SI-123", "SI", "\u0160kofljica"],
  ["SI-124", "SI", "\u0160marje pri Jel\u0161ah"],
  ["SI-125", "SI", "\u0160martno ob Paki"],
  ["SI-126", "SI", "\u0160o\u0161tanj"],
  ["SI-127", "SI", "\u0160tore"],
  ["SI-128", "SI", "Tolmin"],
  ["SI-129", "SI", "Trbovlje"],
  ["SI-130", "SI", "Trebnje"],
  ["SI-131", "SI", "Tr\u017Ei\u010D"],
  ["SI-132", "SI", "Turni\u0161\u010De"],
  ["SI-133", "SI", "Velenje"],
  ["SI-134", "SI", "Velike La\u0161\u010De"],
  ["SI-135", "SI", "Videm"],
  ["SI-136", "SI", "Vipava"],
  ["SI-137", "SI", "Vitanje"],
  ["SI-138", "SI", "Vodice"],
  ["SI-139", "SI", "Vojnik"],
  ["SI-140", "SI", "Vrhnika"],
  ["SI-141", "SI", "Vuzenica"],
  ["SI-142", "SI", "Zagorje ob Savi"],
  ["SI-143", "SI", "Zavr\u010D"],
  ["SI-144", "SI", "Zre\u010De"],
  ["SI-146", "SI", "\u017Delezniki"],
  ["SI-147", "SI", "\u017Diri"],
  ["SI-148", "SI", "Benedikt"],
  ["SI-149", "SI", "Bistrica ob Sotli"],
  ["SI-150", "SI", "Bloke"],
  ["SI-151", "SI", "Braslov\u010De"],
  ["SI-152", "SI", "Cankova"],
  ["SI-153", "SI", "Cerkvenjak"],
  ["SI-154", "SI", "Dobje"],
  ["SI-155", "SI", "Dobrna"],
  ["SI-156", "SI", "Dobrovnik"],
  ["SI-157", "SI", "Dolenjske Toplice"],
  ["SI-158", "SI", "Grad"],
  ["SI-159", "SI", "Hajdina"],
  ["SI-160", "SI", "Ho\u010De\u2013Slivnica"],
  ["SI-161", "SI", "Hodo\u0161"],
  ["SI-162", "SI", "Horjul"],
  ["SI-163", "SI", "Jezersko"],
  ["SI-164", "SI", "Komenda"],
  ["SI-165", "SI", "Kostel"],
  ["SI-166", "SI", "Kri\u017Eevci"],
  ["SI-167", "SI", "Lovrenc na Pohorju"],
  ["SI-168", "SI", "Markovci"],
  ["SI-169", "SI", "Miklav\u017E na Dravskem Polju"],
  ["SI-170", "SI", "Mirna Pe\u010D"],
  ["SI-171", "SI", "Oplotnica"],
  ["SI-172", "SI", "Podlehnik"],
  ["SI-173", "SI", "Polzela"],
  ["SI-174", "SI", "Prebold"],
  ["SI-175", "SI", "Prevalje"],
  ["SI-176", "SI", "Razkri\u017Eje"],
  ["SI-177", "SI", "Ribnica na Pohorju"],
  ["SI-178", "SI", "Selnica ob Dravi"],
  ["SI-179", "SI", "Sodra\u017Eica"],
  ["SI-180", "SI", "Sol\u010Dava"],
  ["SI-181", "SI", "Sveta Ana"],
  ["SI-182", "SI", "Sveti Andra\u017E v Slovenskih Goricah"],
  ["SI-183", "SI", "\u0160empeter\u2013Vrtojba"],
  ["SI-184", "SI", "Tabor"],
  ["SI-185", "SI", "Trnovska Vas"],
  ["SI-186", "SI", "Trzin"],
  ["SI-187", "SI", "Velika Polana"],
  ["SI-188", "SI", "Ver\u017Eej"],
  ["SI-189", "SI", "Vransko"],
  ["SI-190", "SI", "\u017Dalec"],
  ["SI-191", "SI", "\u017Detale"],
  ["SI-192", "SI", "\u017Dirovnica"],
  ["SI-193", "SI", "\u017Du\u017Eemberk"],
  ["SI-194", "SI", "\u0160martno pri Litiji"],
  ["SI-195", "SI", "Apa\u010De"],
  ["SI-196", "SI", "Cirkulane"],
  ["SI-197", "SI", "Kostanjevica na Krki"],
  ["SI-198", "SI", "Makole"],
  ["SI-199", "SI", "Mokronog\u2013Trebelno"],
  ["SI-200", "SI", "Polj\u010Dane"],
  ["SI-201", "SI", "Ren\u010De\u2013Vogrsko"],
  ["SI-202", "SI", "Sredi\u0161\u010De ob Dravi"],
  ["SI-203", "SI", "Stra\u017Ea"],
  ["SI-204", "SI", "Sveta Trojica v Slovenskih Goricah"],
  ["SI-205", "SI", "Sveti Toma\u017E"],
  ["SI-206", "SI", "\u0160marje\u0161ke Toplice"],
  ["SI-207", "SI", "Gorje"],
  ["SI-208", "SI", "Log\u2013Dragomer"],
  ["SI-209", "SI", "Re\u010Dica ob Savinji"],
  ["SI-210", "SI", "Sveti Jurij v Slovenskih Goricah"],
  ["SI-211", "SI", "\u0160entrupert"],
  ["SI-212", "SI", "Mirna"],
  ["SI-213", "SI", "Ankaran"],
  ["SK-BC", "SK", "Bansk\xE1 Bystrica"],
  ["SK-BL", "SK", "Bratislava"],
  ["SK-KI", "SK", "Ko\u0161ice"],
  ["SK-NI", "SK", "Nitra"],
  ["SK-PV", "SK", "Pre\u0161ov"],
  ["SK-TA", "SK", "Trnava"],
  ["SK-TC", "SK", "Tren\u010D\xEDn"],
  ["SK-ZI", "SK", "\u017Dilina"],
  ["SL-E", "SL", "Eastern"],
  ["SL-N", "SL", "Northern"],
  ["SL-NW", "SL", "North Western"],
  ["SL-S", "SL", "Southern"],
  ["SL-W", "SL", "Western Area"],
  ["SM-01", "SM", "Acquaviva"],
  ["SM-02", "SM", "Chiesanuova"],
  ["SM-03", "SM", "Domagnano"],
  ["SM-04", "SM", "Faetano"],
  ["SM-05", "SM", "Fiorentino"],
  ["SM-06", "SM", "Borgo Maggiore"],
  ["SM-07", "SM", "San Marino"],
  ["SM-08", "SM", "Montegiardino"],
  ["SM-09", "SM", "Serravalle"],
  ["SN-DB", "SN", "Diourbel"],
  ["SN-DK", "SN", "Dakar"],
  ["SN-FK", "SN", "Fatick"],
  ["SN-KA", "SN", "Kaffrine"],
  ["SN-KD", "SN", "Kolda"],
  ["SN-KE", "SN", "K\xE9dougou"],
  ["SN-KL", "SN", "Kaolack"],
  ["SN-LG", "SN", "Louga"],
  ["SN-MT", "SN", "Matam"],
  ["SN-SE", "SN", "S\xE9dhiou"],
  ["SN-SL", "SN", "Saint-Louis"],
  ["SN-TC", "SN", "Tambacounda"],
  ["SN-TH", "SN", "Thi\xE8s"],
  ["SN-ZG", "SN", "Ziguinchor"],
  ["SO-AW", "SO", "Awdal"],
  ["SO-BK", "SO", "Bakool"],
  ["SO-BN", "SO", "Banaadir"],
  ["SO-BR", "SO", "Bari"],
  ["SO-BY", "SO", "Bay, Somalia"],
  ["SO-GA", "SO", "Galguduud"],
  ["SO-GE", "SO", "Gedo"],
  ["SO-HI", "SO", "Hiran"],
  ["SO-JD", "SO", "Middle Juba"],
  ["SO-JH", "SO", "Lower Juba"],
  ["SO-MU", "SO", "Mudug"],
  ["SO-NU", "SO", "Nugal"],
  ["SO-SA", "SO", "Sanaag"],
  ["SO-SD", "SO", "Middle Shebelle"],
  ["SO-SH", "SO", "Lower Shebelle"],
  ["SO-SO", "SO", "Sool"],
  ["SO-TO", "SO", "Togdheer"],
  ["SO-WO", "SO", "Woqooyi Galbeed"],
  ["SR-BR", "SR", "Brokopondo"],
  ["SR-CM", "SR", "Commewijne"],
  ["SR-CR", "SR", "Coronie"],
  ["SR-MA", "SR", "Marowijne"],
  ["SR-NI", "SR", "Nickerie"],
  ["SR-PM", "SR", "Paramaribo"],
  ["SR-PR", "SR", "Para"],
  ["SR-SA", "SR", "Saramacca"],
  ["SR-SI", "SR", "Sipaliwini"],
  ["SR-WA", "SR", "Wanica"],
  ["SS-BN", "SS", "Northern Bahr el Ghazal"],
  ["SS-BW", "SS", "Western Bahr el Ghazal"],
  ["SS-EC", "SS", "Central Equatoria"],
  ["SS-EE", "SS", "Eastern Equatoria"],
  ["SS-EW", "SS", "Western Equatoria"],
  ["SS-JG", "SS", "Jonglei"],
  ["SS-LK", "SS", "Lakes"],
  ["SS-NU", "SS", "Upper Nile"],
  ["SS-UY", "SS", "Unity"],
  ["SS-WR", "SS", "Warrap"],
  ["ST-01", "ST", "\xC1gua Grande"],
  ["ST-02", "ST", "Cantagalo"],
  ["ST-03", "ST", "Cau\xE9"],
  ["ST-04", "ST", "Lemb\xE1"],
  ["ST-05", "ST", "Lobata"],
  ["ST-06", "ST", "M\xE9-Z\xF3chi"],
  ["ST-P", "ST", "Pr\xEDncipe"],
  ["SV-AH", "SV", "Ahuachap\xE1n"],
  ["SV-CA", "SV", "Caba\xF1as"],
  ["SV-CH", "SV", "Chalatenango"],
  ["SV-CU", "SV", "Cuscatl\xE1n"],
  ["SV-LI", "SV", "La Libertad"],
  ["SV-MO", "SV", "Moraz\xE1n"],
  ["SV-PA", "SV", "La Paz"],
  ["SV-SA", "SV", "Santa Ana"],
  ["SV-SM", "SV", "San Miguel"],
  ["SV-SO", "SV", "Sonsonate"],
  ["SV-SS", "SV", "San Salvador"],
  ["SV-SV", "SV", "San Vicente"],
  ["SV-UN", "SV", "La Uni\xF3n"],
  ["SV-US", "SV", "Usulut\xE1n"],
  ["SY-DI", "SY", "Damascus"],
  ["SY-DR", "SY", "Daraa"],
  ["SY-DY", "SY", "Deir ez-Zor"],
  ["SY-HA", "SY", "Al-Hasakah"],
  ["SY-HI", "SY", "Homs"],
  ["SY-HL", "SY", "Aleppo"],
  ["SY-HM", "SY", "Hama"],
  ["SY-ID", "SY", "Idlib"],
  ["SY-LA", "SY", "Latakia"],
  ["SY-QU", "SY", "Quneitra"],
  ["SY-RA", "SY", "Ar-Raqqah"],
  ["SY-RD", "SY", "Rif Dimashq"],
  ["SY-SU", "SY", "As-Suwayda"],
  ["SY-TA", "SY", "Tartus"],
  ["SZ-HH", "SZ", "Hhohho"],
  ["SZ-LU", "SZ", "Lubombo"],
  ["SZ-MA", "SZ", "Manzini"],
  ["SZ-SH", "SZ", "Shiselweni"],
  ["TD-BA", "TD", "Batha"],
  ["TD-BG", "TD", "Bahr el Gazel"],
  ["TD-BO", "TD", "Borkou"],
  ["TD-CB", "TD", "Chari-Baguirmi"],
  ["TD-EE", "TD", "Ennedi-Est"],
  ["TD-EO", "TD", "Ennedi-Ouest"],
  ["TD-GR", "TD", "Gu\xE9ra"],
  ["TD-HL", "TD", "Hadjer-Lamis"],
  ["TD-KA", "TD", "Kanem"],
  ["TD-LC", "TD", "Lac"],
  ["TD-LO", "TD", "Logone Occidental"],
  ["TD-LR", "TD", "Logone Oriental"],
  ["TD-MA", "TD", "Mandoul"],
  ["TD-MC", "TD", "Moyen-Chari"],
  ["TD-ME", "TD", "Mayo-Kebbi Est"],
  ["TD-MO", "TD", "Mayo-Kebbi Ouest"],
  ["TD-ND", "TD", "N\u2019Djamena"],
  ["TD-OD", "TD", "Ouadda\xEF"],
  ["TD-SA", "TD", "Salamat"],
  ["TD-SI", "TD", "Sila"],
  ["TD-TA", "TD", "Tandjil\xE9"],
  ["TD-TI", "TD", "Tibesti"],
  ["TD-WF", "TD", "Wadi Fira"],
  ["TG-C", "TG", "Centrale"],
  ["TG-K", "TG", "Kara"],
  ["TG-M", "TG", "Maritime"],
  ["TG-P", "TG", "Plateaux"],
  ["TG-S", "TG", "Savanes"],
  ["TH-10", "TH", "Bangkok"],
  ["TH-11", "TH", "Samut Prakan"],
  ["TH-12", "TH", "Nonthaburi"],
  ["TH-13", "TH", "Pathum Thani"],
  ["TH-14", "TH", "Phra Nakhon Si Ayutthaya"],
  ["TH-15", "TH", "Ang Thong"],
  ["TH-16", "TH", "Lopburi"],
  ["TH-17", "TH", "Sing Buri"],
  ["TH-18", "TH", "Chai Nat"],
  ["TH-19", "TH", "Saraburi"],
  ["TH-20", "TH", "Chon Buri"],
  ["TH-21", "TH", "Rayong"],
  ["TH-22", "TH", "Chanthaburi"],
  ["TH-23", "TH", "Trat"],
  ["TH-24", "TH", "Chachoengsao"],
  ["TH-25", "TH", "Prachin Buri"],
  ["TH-26", "TH", "Nakhon Nayok"],
  ["TH-27", "TH", "Sa Kaeo"],
  ["TH-30", "TH", "Nakhon Ratchasima"],
  ["TH-31", "TH", "Buri Ram"],
  ["TH-32", "TH", "Surin"],
  ["TH-33", "TH", "Si Sa Ket"],
  ["TH-34", "TH", "Ubon Ratchathani"],
  ["TH-35", "TH", "Yasothon"],
  ["TH-36", "TH", "Chaiyaphum"],
  ["TH-37", "TH", "Amnat Charoen"],
  ["TH-38", "TH", "Bueng Kan"],
  ["TH-39", "TH", "Nong Bua Lam Phu"],
  ["TH-40", "TH", "Khon Kaen"],
  ["TH-41", "TH", "Udon Thani"],
  ["TH-42", "TH", "Loei"],
  ["TH-43", "TH", "Nong Khai"],
  ["TH-44", "TH", "Maha Sarakham"],
  ["TH-45", "TH", "Roi Et"],
  ["TH-46", "TH", "Kalasin"],
  ["TH-47", "TH", "Sakon Nakhon"],
  ["TH-48", "TH", "Nakhon Phanom"],
  ["TH-49", "TH", "Mukdahan"],
  ["TH-50", "TH", "Chiang Mai"],
  ["TH-51", "TH", "Lamphun"],
  ["TH-52", "TH", "Lampang"],
  ["TH-53", "TH", "Uttaradit"],
  ["TH-54", "TH", "Phrae"],
  ["TH-55", "TH", "Nan"],
  ["TH-56", "TH", "Phayao"],
  ["TH-57", "TH", "Chiang Rai"],
  ["TH-58", "TH", "Mae Hong Son"],
  ["TH-60", "TH", "Nakhon Sawan"],
  ["TH-61", "TH", "Uthai Thani"],
  ["TH-62", "TH", "Kamphaeng Phet"],
  ["TH-63", "TH", "Tak"],
  ["TH-64", "TH", "Sukhothai"],
  ["TH-65", "TH", "Phitsanulok"],
  ["TH-66", "TH", "Phichit"],
  ["TH-67", "TH", "Phetchabun"],
  ["TH-70", "TH", "Ratchaburi"],
  ["TH-71", "TH", "Kanchanaburi"],
  ["TH-72", "TH", "Suphanburi"],
  ["TH-73", "TH", "Nakhon Pathom"],
  ["TH-74", "TH", "Samut Sakhon"],
  ["TH-75", "TH", "Samut Songkhram"],
  ["TH-76", "TH", "Phetchaburi"],
  ["TH-77", "TH", "Prachuap Khiri Khan"],
  ["TH-80", "TH", "Nakhon Si Thammarat"],
  ["TH-81", "TH", "Krabi"],
  ["TH-82", "TH", "Phang Nga"],
  ["TH-83", "TH", "Phuket"],
  ["TH-84", "TH", "Surat Thani"],
  ["TH-85", "TH", "Ranong"],
  ["TH-86", "TH", "Chumphon"],
  ["TH-90", "TH", "Songkhla"],
  ["TH-91", "TH", "Satun"],
  ["TH-92", "TH", "Trang"],
  ["TH-93", "TH", "Phatthalung"],
  ["TH-94", "TH", "Pattani"],
  ["TH-95", "TH", "Yala"],
  ["TH-96", "TH", "Narathiwat"],
  ["TH-S", "TH", "Pattaya"],
  ["TJ-DU", "TJ", "Dushanbe"],
  ["TJ-GB", "TJ", "Gorno-Badakhshan"],
  ["TJ-KT", "TJ", "Khatlon"],
  ["TJ-RA", "TJ", "Nohiyahoi Tobei Jumhur\xED"],
  ["TJ-SU", "TJ", "Sughd"],
  ["TL-AL", "TL", "Aileu"],
  ["TL-AN", "TL", "Ainaro"],
  ["TL-BA", "TL", "Baucau"],
  ["TL-BO", "TL", "Bobonaro"],
  ["TL-CO", "TL", "Cova Lima"],
  ["TL-DI", "TL", "Dili"],
  ["TL-ER", "TL", "Ermera"],
  ["TL-LA", "TL", "Laut\xE9m"],
  ["TL-LI", "TL", "Liqui\xE7\xE1"],
  ["TL-MF", "TL", "Manufahi"],
  ["TL-MT", "TL", "Manatuto"],
  ["TL-OE", "TL", "Oecusse"],
  ["TL-VI", "TL", "Viqueque"],
  ["TM-A", "TM", "Ahal"],
  ["TM-B", "TM", "Balkan"],
  ["TM-D", "TM", "Da\u015Foguz"],
  ["TM-L", "TM", "Lebap"],
  ["TM-M", "TM", "Mary"],
  ["TM-S", "TM", "A\u015Fgabat"],
  ["TN-11", "TN", "Tunis"],
  ["TN-12", "TN", "Ariana"],
  ["TN-13", "TN", "Ben Arous"],
  ["TN-14", "TN", "Manouba"],
  ["TN-21", "TN", "Nabeul"],
  ["TN-22", "TN", "Zaghouan"],
  ["TN-23", "TN", "Bizerte"],
  ["TN-31", "TN", "B\xE9ja"],
  ["TN-32", "TN", "Jendouba"],
  ["TN-33", "TN", "Kef"],
  ["TN-34", "TN", "Siliana"],
  ["TN-41", "TN", "Kairouan"],
  ["TN-42", "TN", "Kasserine"],
  ["TN-43", "TN", "Sidi Bouzid"],
  ["TN-51", "TN", "Sousse"],
  ["TN-52", "TN", "Monastir"],
  ["TN-53", "TN", "Mahdia"],
  ["TN-61", "TN", "Sfax"],
  ["TN-71", "TN", "Gafsa"],
  ["TN-72", "TN", "Tozeur"],
  ["TN-73", "TN", "Kebili"],
  ["TN-81", "TN", "Gab\xE8s"],
  ["TN-82", "TN", "Medenine"],
  ["TN-83", "TN", "Tataouine"],
  ["TO-01", "TO", "\u02BBEua"],
  ["TO-02", "TO", "Ha\u02BBapai"],
  ["TO-03", "TO", "Niuas"],
  ["TO-04", "TO", "Tongatapu"],
  ["TO-05", "TO", "Vava\u02BBu"],
  ["TR-01", "TR", "Adana"],
  ["TR-02", "TR", "Ad\u0131yaman"],
  ["TR-03", "TR", "Afyonkarahisar"],
  ["TR-04", "TR", "A\u011Fr\u0131"],
  ["TR-05", "TR", "Amasya"],
  ["TR-06", "TR", "Ankara"],
  ["TR-07", "TR", "Antalya"],
  ["TR-08", "TR", "Artvin"],
  ["TR-09", "TR", "Ayd\u0131n"],
  ["TR-10", "TR", "Bal\u0131kesir"],
  ["TR-11", "TR", "Bilecik"],
  ["TR-12", "TR", "Bing\xF6l"],
  ["TR-13", "TR", "Bitlis"],
  ["TR-14", "TR", "Bolu"],
  ["TR-15", "TR", "Burdur"],
  ["TR-16", "TR", "Bursa"],
  ["TR-17", "TR", "\xC7anakkale"],
  ["TR-18", "TR", "\xC7ank\u0131r\u0131"],
  ["TR-19", "TR", "\xC7orum"],
  ["TR-20", "TR", "Denizli"],
  ["TR-21", "TR", "Diyarbak\u0131r"],
  ["TR-22", "TR", "Edirne"],
  ["TR-23", "TR", "Elaz\u0131\u011F"],
  ["TR-24", "TR", "Erzincan"],
  ["TR-25", "TR", "Erzurum"],
  ["TR-26", "TR", "Eski\u015Fehir"],
  ["TR-27", "TR", "Gaziantep"],
  ["TR-28", "TR", "Giresun"],
  ["TR-29", "TR", "G\xFCm\xFC\u015Fhane"],
  ["TR-30", "TR", "Hakk\xE2ri"],
  ["TR-31", "TR", "Hatay"],
  ["TR-32", "TR", "Isparta"],
  ["TR-33", "TR", "Mersin"],
  ["TR-34", "TR", "Istanbul"],
  ["TR-35", "TR", "Izmir"],
  ["TR-36", "TR", "Kars"],
  ["TR-37", "TR", "Kastamonu"],
  ["TR-38", "TR", "Kayseri"],
  ["TR-39", "TR", "K\u0131rklareli"],
  ["TR-40", "TR", "K\u0131r\u015Fehir"],
  ["TR-41", "TR", "Kocaeli"],
  ["TR-42", "TR", "Konya"],
  ["TR-43", "TR", "K\xFCtahya"],
  ["TR-44", "TR", "Malatya"],
  ["TR-45", "TR", "Manisa"],
  ["TR-46", "TR", "Kahramanmara\u015F"],
  ["TR-47", "TR", "Mardin"],
  ["TR-48", "TR", "Mu\u011Fla"],
  ["TR-49", "TR", "Mu\u015F"],
  ["TR-50", "TR", "Nev\u015Fehir"],
  ["TR-51", "TR", "Ni\u011Fde"],
  ["TR-52", "TR", "Ordu"],
  ["TR-53", "TR", "Rize"],
  ["TR-54", "TR", "Sakarya"],
  ["TR-55", "TR", "Samsun"],
  ["TR-56", "TR", "Siirt"],
  ["TR-57", "TR", "Sinop"],
  ["TR-58", "TR", "Sivas"],
  ["TR-59", "TR", "Tekirda\u011F"],
  ["TR-60", "TR", "Tokat"],
  ["TR-61", "TR", "Trabzon"],
  ["TR-62", "TR", "Tunceli"],
  ["TR-63", "TR", "\u015Eanl\u0131urfa"],
  ["TR-64", "TR", "U\u015Fak"],
  ["TR-65", "TR", "Van"],
  ["TR-66", "TR", "Yozgat"],
  ["TR-67", "TR", "Zonguldak"],
  ["TR-68", "TR", "Aksaray"],
  ["TR-69", "TR", "Bayburt"],
  ["TR-70", "TR", "Karaman"],
  ["TR-71", "TR", "K\u0131r\u0131kkale"],
  ["TR-72", "TR", "Batman"],
  ["TR-73", "TR", "\u015E\u0131rnak"],
  ["TR-74", "TR", "Bart\u0131n"],
  ["TR-75", "TR", "Ardahan"],
  ["TR-76", "TR", "I\u011Fd\u0131r"],
  ["TR-77", "TR", "Yalova"],
  ["TR-78", "TR", "Karab\xFCk"],
  ["TR-79", "TR", "Kilis"],
  ["TR-80", "TR", "Osmaniye"],
  ["TR-81", "TR", "D\xFCzce"],
  ["TT-ARI", "TT", "Arima"],
  ["TT-CHA", "TT", "Chaguanas"],
  ["TT-CTT", "TT", "Couva-Tabaquite-Talparo"],
  ["TT-DMN", "TT", "Diego Martin"],
  ["TT-MRC", "TT", "Mayaro-Rio Claro"],
  ["TT-PED", "TT", "Penal-Debe"],
  ["TT-POS", "TT", "Port of Spain"],
  ["TT-PRT", "TT", "Princes Town"],
  ["TT-PTF", "TT", "Point Fortin"],
  ["TT-SFO", "TT", "San Fernando"],
  ["TT-SGE", "TT", "Sangre Grande"],
  ["TT-SIP", "TT", "Siparia"],
  ["TT-SJL", "TT", "San Juan-Laventille"],
  ["TT-TOB", "TT", "Tobago"],
  ["TT-TUP", "TT", "Tunapuna-Piarco"],
  ["TV-FUN", "TV", "Funafuti"],
  ["TV-NIT", "TV", "Niutao"],
  ["TV-NKF", "TV", "Nukufetau"],
  ["TV-NKL", "TV", "Nukulaelae"],
  ["TV-NMA", "TV", "Nanumea"],
  ["TV-NMG", "TV", "Nanumanga"],
  ["TV-NUI", "TV", "Nui"],
  ["TV-VAI", "TV", "Vaitupu"],
  ["TW-CHA", "TW", "Changhua"],
  ["TW-CYI", "TW", "Chiayi County"],
  ["TW-CYQ", "TW", "Chiayi"],
  ["TW-HSQ", "TW", "Hsinchu County"],
  ["TW-HSZ", "TW", "Hsinchu"],
  ["TW-HUA", "TW", "Hualien"],
  ["TW-ILA", "TW", "Yilan"],
  ["TW-KEE", "TW", "Keelung"],
  ["TW-KHH", "TW", "Kaohsiung"],
  ["TW-KIN", "TW", "Kinmen"],
  ["TW-LIE", "TW", "Lienchiang"],
  ["TW-MIA", "TW", "Miaoli"],
  ["TW-NAN", "TW", "Nantou"],
  ["TW-NWT", "TW", "New Taipei"],
  ["TW-PEN", "TW", "Penghu"],
  ["TW-PIF", "TW", "Pingtung"],
  ["TW-TAO", "TW", "Taoyuan"],
  ["TW-TNN", "TW", "Tainan"],
  ["TW-TPE", "TW", "Taipei"],
  ["TW-TTT", "TW", "Taitung"],
  ["TW-TXG", "TW", "Taichung"],
  ["TW-YUN", "TW", "Yunlin"],
  ["TZ-01", "TZ", "Arusha"],
  ["TZ-02", "TZ", "Dar es Salaam"],
  ["TZ-03", "TZ", "Dodoma"],
  ["TZ-04", "TZ", "Iringa"],
  ["TZ-05", "TZ", "Kagera"],
  ["TZ-06", "TZ", "North Pemba"],
  ["TZ-07", "TZ", "Zanzibar North"],
  ["TZ-08", "TZ", "Kigoma"],
  ["TZ-09", "TZ", "Kilimanjaro"],
  ["TZ-10", "TZ", "South Pemba"],
  ["TZ-11", "TZ", "Zanzibar Central/South"],
  ["TZ-12", "TZ", "Lindi"],
  ["TZ-13", "TZ", "Mara"],
  ["TZ-14", "TZ", "Mbeya"],
  ["TZ-15", "TZ", "Zanzibar Urban/West"],
  ["TZ-16", "TZ", "Morogoro"],
  ["TZ-17", "TZ", "Mtwara"],
  ["TZ-18", "TZ", "Mwanza"],
  ["TZ-19", "TZ", "Pwani"],
  ["TZ-20", "TZ", "Rukwa"],
  ["TZ-21", "TZ", "Ruvuma"],
  ["TZ-22", "TZ", "Shinyanga"],
  ["TZ-23", "TZ", "Singida"],
  ["TZ-24", "TZ", "Tabora"],
  ["TZ-25", "TZ", "Tanga"],
  ["TZ-26", "TZ", "Manyara"],
  ["TZ-27", "TZ", "Geita"],
  ["TZ-28", "TZ", "Katavi"],
  ["TZ-29", "TZ", "Njombe"],
  ["TZ-30", "TZ", "Simiyu"],
  ["TZ-31", "TZ", "Songwe"],
  ["UA-05", "UA", "Vinnychchyna"],
  ["UA-07", "UA", "Volyn"],
  ["UA-09", "UA", "Luhanshchyna"],
  ["UA-12", "UA", "Dnipropetrovshchyna"],
  ["UA-14", "UA", "Donechchyna"],
  ["UA-18", "UA", "Zhytomyrshchyna"],
  ["UA-21", "UA", "Zakarpattia"],
  ["UA-23", "UA", "Zaporizhzhya"],
  ["UA-26", "UA", "Prykarpattia"],
  ["UA-30", "UA", "Kyiv"],
  ["UA-32", "UA", "Kyivshchyna"],
  ["UA-35", "UA", "Kirovohradschyna"],
  ["UA-40", "UA", "Sevastopol"],
  ["UA-43", "UA", "Crimea"],
  ["UA-46", "UA", "Lvivshchyna"],
  ["UA-48", "UA", "Mykolayivschyna"],
  ["UA-51", "UA", "Odeshchyna"],
  ["UA-53", "UA", "Poltavshchyna"],
  ["UA-56", "UA", "Rivnenshchyna"],
  ["UA-59", "UA", "Sumshchyna"],
  ["UA-61", "UA", "Ternopilshchyna"],
  ["UA-63", "UA", "Kharkivshchyna"],
  ["UA-65", "UA", "Khersonshchyna"],
  ["UA-68", "UA", "Khmelnychchyna"],
  ["UA-71", "UA", "Cherkashchyna"],
  ["UA-74", "UA", "Chernihivshchyna"],
  ["UA-77", "UA", "Chernivtsi Oblast"],
  ["UG-101", "UG", "Kalangala"],
  ["UG-102", "UG", "Kampala"],
  ["UG-103", "UG", "Kiboga"],
  ["UG-104", "UG", "Luwero"],
  ["UG-105", "UG", "Masaka"],
  ["UG-106", "UG", "Mpigi"],
  ["UG-107", "UG", "Mubende"],
  ["UG-108", "UG", "Mukono"],
  ["UG-109", "UG", "Nakasongola"],
  ["UG-110", "UG", "Rakai"],
  ["UG-111", "UG", "Sembabule"],
  ["UG-112", "UG", "Kayunga"],
  ["UG-113", "UG", "Wakiso"],
  ["UG-114", "UG", "Lyantonde"],
  ["UG-115", "UG", "Mityana"],
  ["UG-116", "UG", "Nakaseke"],
  ["UG-117", "UG", "Buikwe"],
  ["UG-118", "UG", "Bukomansibi"],
  ["UG-119", "UG", "Butambala"],
  ["UG-120", "UG", "Buvuma"],
  ["UG-121", "UG", "Gomba"],
  ["UG-122", "UG", "Kalungu"],
  ["UG-123", "UG", "Kyankwanzi"],
  ["UG-124", "UG", "Lwengo"],
  ["UG-125", "UG", "Kyotera"],
  ["UG-126", "UG", "Kasanda"],
  ["UG-201", "UG", "Bugiri"],
  ["UG-202", "UG", "Busia"],
  ["UG-203", "UG", "Iganga"],
  ["UG-204", "UG", "Jinja"],
  ["UG-205", "UG", "Kamuli"],
  ["UG-206", "UG", "Kapchorwa"],
  ["UG-207", "UG", "Katakwi"],
  ["UG-208", "UG", "Kumi"],
  ["UG-209", "UG", "Mbale"],
  ["UG-210", "UG", "Pallisa"],
  ["UG-211", "UG", "Soroti"],
  ["UG-212", "UG", "Tororo"],
  ["UG-213", "UG", "Kaberamaido"],
  ["UG-214", "UG", "Mayuge"],
  ["UG-215", "UG", "Sironko"],
  ["UG-216", "UG", "Amuria"],
  ["UG-217", "UG", "Budaka"],
  ["UG-218", "UG", "Bududa"],
  ["UG-219", "UG", "Bukedea"],
  ["UG-220", "UG", "Bukwa"],
  ["UG-221", "UG", "Butaleja"],
  ["UG-222", "UG", "Kaliro"],
  ["UG-223", "UG", "Manafwa"],
  ["UG-224", "UG", "Namutumba"],
  ["UG-225", "UG", "Bulambuli"],
  ["UG-226", "UG", "Buyende"],
  ["UG-227", "UG", "Kibuku"],
  ["UG-228", "UG", "Kween"],
  ["UG-229", "UG", "Luuka"],
  ["UG-230", "UG", "Namayingo"],
  ["UG-231", "UG", "Ngora"],
  ["UG-232", "UG", "Serere"],
  ["UG-233", "UG", "Butebo"],
  ["UG-234", "UG", "Namisindwa"],
  ["UG-235", "UG", "Bugweri"],
  ["UG-236", "UG", "Kapelebyong"],
  ["UG-237", "UG", "Kalaki"],
  ["UG-301", "UG", "Adjumani"],
  ["UG-302", "UG", "Apac"],
  ["UG-303", "UG", "Arua"],
  ["UG-304", "UG", "Gulu"],
  ["UG-305", "UG", "Kitgum"],
  ["UG-306", "UG", "Kotido"],
  ["UG-307", "UG", "Lira"],
  ["UG-308", "UG", "Moroto"],
  ["UG-309", "UG", "Moyo"],
  ["UG-310", "UG", "Nebbi"],
  ["UG-311", "UG", "Nakapiripirit"],
  ["UG-312", "UG", "Pader"],
  ["UG-313", "UG", "Yumbe"],
  ["UG-314", "UG", "Abim"],
  ["UG-315", "UG", "Amolatar"],
  ["UG-316", "UG", "Amuru"],
  ["UG-317", "UG", "Dokolo"],
  ["UG-318", "UG", "Kaabong"],
  ["UG-319", "UG", "Koboko"],
  ["UG-320", "UG", "Maracha"],
  ["UG-321", "UG", "Oyam"],
  ["UG-322", "UG", "Agago"],
  ["UG-323", "UG", "Alebtong"],
  ["UG-324", "UG", "Amudat"],
  ["UG-325", "UG", "Kole"],
  ["UG-326", "UG", "Lamwo"],
  ["UG-327", "UG", "Napak"],
  ["UG-328", "UG", "Nwoya"],
  ["UG-329", "UG", "Otuke"],
  ["UG-330", "UG", "Zombo\xB2"],
  ["UG-331", "UG", "Zombo"],
  ["UG-332", "UG", "Pakwach"],
  ["UG-333", "UG", "Kwania"],
  ["UG-334", "UG", "Nabilatuk"],
  ["UG-335", "UG", "Karenga"],
  ["UG-336", "UG", "Madi-Okollo"],
  ["UG-337", "UG", "Obongi"],
  ["UG-401", "UG", "Bundibugyo"],
  ["UG-402", "UG", "Bushenyi"],
  ["UG-403", "UG", "Hoima"],
  ["UG-404", "UG", "Kabale"],
  ["UG-405", "UG", "Kabarole"],
  ["UG-406", "UG", "Kasese"],
  ["UG-407", "UG", "Kibaale"],
  ["UG-408", "UG", "Kisoro"],
  ["UG-409", "UG", "Masindi"],
  ["UG-410", "UG", "Mbarara"],
  ["UG-411", "UG", "Ntungamo"],
  ["UG-412", "UG", "Rukungiri"],
  ["UG-413", "UG", "Kamwenge"],
  ["UG-414", "UG", "Kanungu"],
  ["UG-415", "UG", "Kyenjojo"],
  ["UG-416", "UG", "Buliisa"],
  ["UG-417", "UG", "Ibanda"],
  ["UG-418", "UG", "Isingiro"],
  ["UG-419", "UG", "Kiruhura"],
  ["UG-420", "UG", "Buhweju"],
  ["UG-421", "UG", "Kiryandongo"],
  ["UG-422", "UG", "Kyegegwa"],
  ["UG-423", "UG", "Mitooma"],
  ["UG-424", "UG", "Ntoroko"],
  ["UG-425", "UG", "Rubirizi"],
  ["UG-426", "UG", "Sheema"],
  ["UG-427", "UG", "Kagadi"],
  ["UG-428", "UG", "Kakumiro"],
  ["UG-429", "UG", "Rubanda"],
  ["UG-430", "UG", "Bunyangabu"],
  ["UG-431", "UG", "Rukiga"],
  ["UG-432", "UG", "Kikuube"],
  ["UG-433", "UG", "Kazo"],
  ["UG-434", "UG", "Kitagwenda"],
  ["UG-435", "UG", "Rwampara"],
  ["UG-C", "UG", "Central"],
  ["UG-E", "UG", "Eastern"],
  ["UG-N", "UG", "Northern"],
  ["UG-W", "UG", "Western"],
  ["UM-67", "UM", "Johnston Atoll"],
  ["UM-71", "UM", "Midway Atoll"],
  ["UM-76", "UM", "Navassa Island"],
  ["UM-79", "UM", "Wake Island"],
  ["UM-81", "UM", "Baker Island"],
  ["UM-84", "UM", "Howland Island"],
  ["UM-86", "UM", "Jarvis Island"],
  ["UM-89", "UM", "Kingman Reef"],
  ["UM-95", "UM", "Palmyra Atoll"],
  ["US-AK", "US", "Alaska"],
  ["US-AL", "US", "Alabama"],
  ["US-AR", "US", "Arkansas"],
  ["US-AS", "US", "American Samoa"],
  ["US-AZ", "US", "Arizona"],
  ["US-CA", "US", "California"],
  ["US-CO", "US", "Colorado"],
  ["US-CT", "US", "Connecticut"],
  ["US-DC", "US", "Washington DC"],
  ["US-DE", "US", "Delaware"],
  ["US-FL", "US", "Florida"],
  ["US-GA", "US", "Georgia"],
  ["US-GU", "US", "Guam"],
  ["US-HI", "US", "Hawaii"],
  ["US-IA", "US", "Iowa"],
  ["US-ID", "US", "Idaho"],
  ["US-IL", "US", "Illinois"],
  ["US-IN", "US", "Indiana"],
  ["US-KS", "US", "Kansas"],
  ["US-KY", "US", "Kentucky"],
  ["US-LA", "US", "Louisiana"],
  ["US-MA", "US", "Massachusetts"],
  ["US-MD", "US", "Maryland"],
  ["US-ME", "US", "Maine"],
  ["US-MI", "US", "Michigan"],
  ["US-MN", "US", "Minnesota"],
  ["US-MO", "US", "Missouri"],
  ["US-MP", "US", "Northern Mariana Islands"],
  ["US-MS", "US", "Mississippi"],
  ["US-MT", "US", "Montana"],
  ["US-NC", "US", "North Carolina"],
  ["US-ND", "US", "North Dakota"],
  ["US-NE", "US", "Nebraska"],
  ["US-NH", "US", "New Hampshire"],
  ["US-NJ", "US", "New Jersey"],
  ["US-NM", "US", "New Mexico"],
  ["US-NV", "US", "Nevada"],
  ["US-NY", "US", "New York"],
  ["US-OH", "US", "Ohio"],
  ["US-OK", "US", "Oklahoma"],
  ["US-OR", "US", "Oregon"],
  ["US-PA", "US", "Pennsylvania"],
  ["US-PR", "US", "Puerto Rico"],
  ["US-RI", "US", "Rhode Island"],
  ["US-SC", "US", "South Carolina"],
  ["US-SD", "US", "South Dakota"],
  ["US-TN", "US", "Tennessee"],
  ["US-TX", "US", "Texas"],
  ["US-UM", "US", "U.S. Outlying Islands"],
  ["US-UT", "US", "Utah"],
  ["US-VA", "US", "Virginia"],
  ["US-VI", "US", "U.S. Virgin Islands"],
  ["US-VT", "US", "Vermont"],
  ["US-WA", "US", "Washington"],
  ["US-WI", "US", "Wisconsin"],
  ["US-WV", "US", "West Virginia"],
  ["US-WY", "US", "Wyoming"],
  ["UY-AR", "UY", "Artigas"],
  ["UY-CA", "UY", "Canelones"],
  ["UY-CL", "UY", "Cerro Largo"],
  ["UY-CO", "UY", "Colonia"],
  ["UY-DU", "UY", "Durazno"],
  ["UY-FD", "UY", "Florida"],
  ["UY-FS", "UY", "Flores"],
  ["UY-LA", "UY", "Lavalleja"],
  ["UY-MA", "UY", "Maldonado"],
  ["UY-MO", "UY", "Montevideo"],
  ["UY-PA", "UY", "Paysand\xFA"],
  ["UY-RN", "UY", "R\xEDo Negro"],
  ["UY-RO", "UY", "Rocha"],
  ["UY-RV", "UY", "Rivera"],
  ["UY-SA", "UY", "Salto"],
  ["UY-SJ", "UY", "San Jos\xE9"],
  ["UY-SO", "UY", "Soriano"],
  ["UY-TA", "UY", "Tacuaremb\xF3"],
  ["UY-TT", "UY", "Treinta y Tres"],
  ["UZ-AN", "UZ", "Andijan"],
  ["UZ-BU", "UZ", "Bukhara"],
  ["UZ-FA", "UZ", "Fergana"],
  ["UZ-JI", "UZ", "Jizzakh"],
  ["UZ-NG", "UZ", "Namangan"],
  ["UZ-NW", "UZ", "Navoiy"],
  ["UZ-QA", "UZ", "Qashqadaryo"],
  ["UZ-QR", "UZ", "Karakalpakstan"],
  ["UZ-SA", "UZ", "Samarqand"],
  ["UZ-SI", "UZ", "Sirdaryo"],
  ["UZ-SU", "UZ", "Surxondaryo"],
  ["UZ-TK", "UZ", "Tashkent"],
  ["UZ-TO", "UZ", "Tashkent Province"],
  ["UZ-XO", "UZ", "Xorazm"],
  ["VC-01", "VC", "Charlotte"],
  ["VC-02", "VC", "Saint Andrew"],
  ["VC-03", "VC", "Saint David"],
  ["VC-04", "VC", "Saint George"],
  ["VC-05", "VC", "Saint Patrick"],
  ["VC-06", "VC", "Grenadines"],
  ["VE-A", "VE", "Capital"],
  ["VE-B", "VE", "Anzo\xE1tegui"],
  ["VE-C", "VE", "Apure"],
  ["VE-D", "VE", "Aragua"],
  ["VE-E", "VE", "Barinas"],
  ["VE-F", "VE", "Bol\xEDvar"],
  ["VE-G", "VE", "Carabobo"],
  ["VE-H", "VE", "Cojedes"],
  ["VE-I", "VE", "Falc\xF3n"],
  ["VE-J", "VE", "Gu\xE1rico"],
  ["VE-K", "VE", "Lara"],
  ["VE-L", "VE", "M\xE9rida"],
  ["VE-M", "VE", "Miranda"],
  ["VE-N", "VE", "Monagas"],
  ["VE-O", "VE", "Nueva Esparta"],
  ["VE-P", "VE", "Portuguesa"],
  ["VE-R", "VE", "Sucre"],
  ["VE-S", "VE", "T\xE1chira"],
  ["VE-T", "VE", "Trujillo"],
  ["VE-U", "VE", "Yaracuy"],
  ["VE-V", "VE", "Zulia"],
  ["VE-W", "VE", "Federal Dependencies"],
  ["VE-X", "VE", "Vargas"],
  ["VE-Y", "VE", "Delta Amacuro"],
  ["VE-Z", "VE", "Amazonas"],
  ["VN-01", "VN", "Lai Ch\xE2u"],
  ["VN-02", "VN", "L\xE0o Cai"],
  ["VN-03", "VN", "H\xE0 Giang"],
  ["VN-04", "VN", "Cao B\u1EB1ng"],
  ["VN-05", "VN", "S\u01A1n La"],
  ["VN-06", "VN", "Y\xEAn B\xE1i"],
  ["VN-07", "VN", "Tuy\xEAn Quang"],
  ["VN-09", "VN", "L\u1EA1ng S\u01A1n"],
  ["VN-13", "VN", "Qu\u1EA3ng Ninh"],
  ["VN-14", "VN", "H\xF2a B\xECnh"],
  ["VN-18", "VN", "Ninh B\xECnh"],
  ["VN-20", "VN", "Th\xE1i B\xECnh"],
  ["VN-21", "VN", "Thanh H\xF3a"],
  ["VN-22", "VN", "Ngh\u1EC7 An"],
  ["VN-23", "VN", "H\xE0 T\u0129nh"],
  ["VN-24", "VN", "Qu\u1EA3ng B\xECnh"],
  ["VN-25", "VN", "Qu\u1EA3ng Tr\u1ECB"],
  ["VN-26", "VN", "Th\u1EEBa Thi\xEAn\u2013Hu\u1EBF"],
  ["VN-27", "VN", "Qu\u1EA3ng Nam"],
  ["VN-28", "VN", "Kon Tum"],
  ["VN-29", "VN", "Qu\u1EA3ng Ng\xE3i"],
  ["VN-30", "VN", "Gia Lai"],
  ["VN-31", "VN", "B\xECnh \u0110\u1ECBnh"],
  ["VN-32", "VN", "Ph\xFA Y\xEAn"],
  ["VN-33", "VN", "\u0110\u1EAFk L\u1EAFk"],
  ["VN-34", "VN", "Kh\xE1nh H\xF2a"],
  ["VN-35", "VN", "L\xE2m \u0110\u1ED3ng"],
  ["VN-36", "VN", "Ninh Thu\u1EADn"],
  ["VN-37", "VN", "T\xE2y Ninh"],
  ["VN-39", "VN", "\u0110\u1ED3ng Nai"],
  ["VN-40", "VN", "B\xECnh Thu\u1EADn"],
  ["VN-41", "VN", "Long An"],
  ["VN-43", "VN", "B\xE0 R\u1ECBa\u2013V\u0169ng T\xE0u"],
  ["VN-44", "VN", "An Giang"],
  ["VN-45", "VN", "\u0110\u1ED3ng Th\xE1p"],
  ["VN-46", "VN", "Ti\u1EC1n Giang"],
  ["VN-47", "VN", "Ki\xEAn Giang"],
  ["VN-49", "VN", "V\u0129nh Long"],
  ["VN-50", "VN", "B\u1EBFn Tre"],
  ["VN-51", "VN", "Tr\xE0 Vinh"],
  ["VN-52", "VN", "S\xF3c Tr\u0103ng"],
  ["VN-53", "VN", "B\u1EAFc K\u1EA1n"],
  ["VN-54", "VN", "B\u1EAFc Giang"],
  ["VN-55", "VN", "B\u1EA1c Li\xEAu"],
  ["VN-56", "VN", "B\u1EAFc Ninh"],
  ["VN-57", "VN", "B\xECnh D\u01B0\u01A1ng"],
  ["VN-58", "VN", "B\xECnh Ph\u01B0\u1EDBc"],
  ["VN-59", "VN", "C\xE0 Mau"],
  ["VN-61", "VN", "H\u1EA3i D\u01B0\u01A1ng"],
  ["VN-63", "VN", "H\xE0 Nam"],
  ["VN-66", "VN", "H\u01B0ng Y\xEAn"],
  ["VN-67", "VN", "Nam \u0110\u1ECBnh"],
  ["VN-68", "VN", "Ph\xFA Th\u1ECD"],
  ["VN-69", "VN", "Th\xE1i Nguy\xEAn"],
  ["VN-70", "VN", "V\u0129nh Ph\xFAc"],
  ["VN-71", "VN", "\u0110i\u1EC7n Bi\xEAn"],
  ["VN-72", "VN", "\u0110\u1EAFk N\xF4ng"],
  ["VN-73", "VN", "H\u1EADu Giang"],
  ["VN-CT", "VN", "Can Tho"],
  ["VN-DN", "VN", "Da Nang"],
  ["VN-HN", "VN", "Hanoi"],
  ["VN-HP", "VN", "Haiphong"],
  ["VN-SG", "VN", "Ho Chi Minh City"],
  ["VU-MAP", "VU", "Malampa"],
  ["VU-PAM", "VU", "Penama"],
  ["VU-SAM", "VU", "Sanma"],
  ["VU-SEE", "VU", "Shefa"],
  ["VU-TAE", "VU", "Tafea"],
  ["VU-TOB", "VU", "Torba"],
  ["WF-AL", "WF", "Alo"],
  ["WF-SG", "WF", "Sigave"],
  ["WF-UV", "WF", "Uvea"],
  ["WS-AA", "WS", "A\u2019ana"],
  ["WS-AL", "WS", "Aiga-i-le-Tai"],
  ["WS-AT", "WS", "Atua"],
  ["WS-FA", "WS", "Fa\u2019asaleleaga"],
  ["WS-GE", "WS", "Gaga\u2019emauga"],
  ["WS-GI", "WS", "Gaga\u2019ifomauga"],
  ["WS-PA", "WS", "Palauli"],
  ["WS-SA", "WS", "Satupa\u2019itea"],
  ["WS-TU", "WS", "Tuamasaga"],
  ["WS-VF", "WS", "Va\u2019a-o-Fonoti"],
  ["WS-VS", "WS", "Vaisigano"],
  ["YE-AB", "YE", "Abyan"],
  ["YE-AD", "YE", "\u2019Adan"],
  ["YE-AM", "YE", "Amran"],
  ["YE-BA", "YE", "Al Bayda"],
  ["YE-DA", "YE", "Dhale"],
  ["YE-DH", "YE", "Dhamar"],
  ["YE-HD", "YE", "Hadramaut"],
  ["YE-HJ", "YE", "Hajjah"],
  ["YE-HU", "YE", "Al Hudaydah"],
  ["YE-IB", "YE", "Ibb"],
  ["YE-JA", "YE", "Al Jawf"],
  ["YE-LA", "YE", "Lahij"],
  ["YE-MA", "YE", "Ma\u2019rib"],
  ["YE-MR", "YE", "Al Mahrah"],
  ["YE-MW", "YE", "Al Mahwit"],
  ["YE-RA", "YE", "Raymah"],
  ["YE-SA", "YE", "Amanat Al Asimah"],
  ["YE-SD", "YE", "Sa\u2019dah"],
  ["YE-SH", "YE", "Shabwah"],
  ["YE-SN", "YE", "Sana\u2019a"],
  ["YE-SU", "YE", "Arkhabil Suqutra"],
  ["YE-TA", "YE", "Taiz"],
  ["ZA-EC", "ZA", "Eastern Cape"],
  ["ZA-FS", "ZA", "Free State"],
  ["ZA-GP", "ZA", "Gauteng"],
  ["ZA-KZN", "ZA", "KwaZulu-Natal"],
  ["ZA-LP", "ZA", "Limpopo"],
  ["ZA-MP", "ZA", "Mpumalanga"],
  ["ZA-NC", "ZA", "Northern Cape"],
  ["ZA-NW", "ZA", "North West"],
  ["ZA-WC", "ZA", "Western Cape"],
  ["ZM-01", "ZM", "Western"],
  ["ZM-02", "ZM", "Central"],
  ["ZM-03", "ZM", "Eastern"],
  ["ZM-04", "ZM", "Luapula"],
  ["ZM-05", "ZM", "Northern"],
  ["ZM-06", "ZM", "North-Western"],
  ["ZM-07", "ZM", "Southern"],
  ["ZM-08", "ZM", "Copperbelt"],
  ["ZM-09", "ZM", "Lusaka"],
  ["ZM-10", "ZM", "Muchinga"],
  ["ZW-BU", "ZW", "Bulawayo"],
  ["ZW-HA", "ZW", "Harare"],
  ["ZW-MA", "ZW", "Manicaland"],
  ["ZW-MC", "ZW", "Mashonaland Central"],
  ["ZW-ME", "ZW", "Mashonaland East"],
  ["ZW-MI", "ZW", "Midlands"],
  ["ZW-MN", "ZW", "Matabeleland North"],
  ["ZW-MS", "ZW", "Matabeleland South"],
  ["ZW-MV", "ZW", "Masvingo"],
  ["ZW-MW", "ZW", "Mashonaland West"]
];
var JAPAN_MUNICIPALITY_RECORDS = [
  ["011002", "JP-01", "\u672D\u5E4C\u5E02"],
  ["011011", "JP-01", "\u672D\u5E4C\u5E02\u4E2D\u592E\u533A"],
  ["011029", "JP-01", "\u672D\u5E4C\u5E02\u5317\u533A"],
  ["011037", "JP-01", "\u672D\u5E4C\u5E02\u6771\u533A"],
  ["011045", "JP-01", "\u672D\u5E4C\u5E02\u767D\u77F3\u533A"],
  ["011053", "JP-01", "\u672D\u5E4C\u5E02\u8C4A\u5E73\u533A"],
  ["011061", "JP-01", "\u672D\u5E4C\u5E02\u5357\u533A"],
  ["011070", "JP-01", "\u672D\u5E4C\u5E02\u897F\u533A"],
  ["011088", "JP-01", "\u672D\u5E4C\u5E02\u539A\u5225\u533A"],
  ["011096", "JP-01", "\u672D\u5E4C\u5E02\u624B\u7A32\u533A"],
  ["011100", "JP-01", "\u672D\u5E4C\u5E02\u6E05\u7530\u533A"],
  ["012025", "JP-01", "\u51FD\u9928\u5E02"],
  ["012033", "JP-01", "\u5C0F\u6A3D\u5E02"],
  ["012041", "JP-01", "\u65ED\u5DDD\u5E02"],
  ["012050", "JP-01", "\u5BA4\u862D\u5E02"],
  ["012068", "JP-01", "\u91E7\u8DEF\u5E02"],
  ["012076", "JP-01", "\u5E2F\u5E83\u5E02"],
  ["012084", "JP-01", "\u5317\u898B\u5E02"],
  ["012092", "JP-01", "\u5915\u5F35\u5E02"],
  ["012106", "JP-01", "\u5CA9\u898B\u6CA2\u5E02"],
  ["012114", "JP-01", "\u7DB2\u8D70\u5E02"],
  ["012122", "JP-01", "\u7559\u840C\u5E02"],
  ["012131", "JP-01", "\u82EB\u5C0F\u7267\u5E02"],
  ["012149", "JP-01", "\u7A1A\u5185\u5E02"],
  ["012157", "JP-01", "\u7F8E\u5504\u5E02"],
  ["012165", "JP-01", "\u82A6\u5225\u5E02"],
  ["012173", "JP-01", "\u6C5F\u5225\u5E02"],
  ["012181", "JP-01", "\u8D64\u5E73\u5E02"],
  ["012190", "JP-01", "\u7D0B\u5225\u5E02"],
  ["012203", "JP-01", "\u58EB\u5225\u5E02"],
  ["012211", "JP-01", "\u540D\u5BC4\u5E02"],
  ["012220", "JP-01", "\u4E09\u7B20\u5E02"],
  ["012238", "JP-01", "\u6839\u5BA4\u5E02"],
  ["012246", "JP-01", "\u5343\u6B73\u5E02"],
  ["012254", "JP-01", "\u6EDD\u5DDD\u5E02"],
  ["012262", "JP-01", "\u7802\u5DDD\u5E02"],
  ["012271", "JP-01", "\u6B4C\u5FD7\u5185\u5E02"],
  ["012289", "JP-01", "\u6DF1\u5DDD\u5E02"],
  ["012297", "JP-01", "\u5BCC\u826F\u91CE\u5E02"],
  ["012301", "JP-01", "\u767B\u5225\u5E02"],
  ["012319", "JP-01", "\u6075\u5EAD\u5E02"],
  ["012335", "JP-01", "\u4F0A\u9054\u5E02"],
  ["012343", "JP-01", "\u5317\u5E83\u5CF6\u5E02"],
  ["012351", "JP-01", "\u77F3\u72E9\u5E02"],
  ["012360", "JP-01", "\u5317\u6597\u5E02"],
  ["013030", "JP-01", "\u5F53\u5225\u753A"],
  ["013048", "JP-01", "\u65B0\u7BE0\u6D25\u6751"],
  ["013315", "JP-01", "\u677E\u524D\u753A"],
  ["013323", "JP-01", "\u798F\u5CF6\u753A"],
  ["013331", "JP-01", "\u77E5\u5185\u753A"],
  ["013340", "JP-01", "\u6728\u53E4\u5185\u753A"],
  ["013374", "JP-01", "\u4E03\u98EF\u753A"],
  ["013439", "JP-01", "\u9E7F\u90E8\u753A"],
  ["013455", "JP-01", "\u68EE\u753A"],
  ["013463", "JP-01", "\u516B\u96F2\u753A"],
  ["013471", "JP-01", "\u9577\u4E07\u90E8\u753A"],
  ["013617", "JP-01", "\u6C5F\u5DEE\u753A"],
  ["013625", "JP-01", "\u4E0A\u30CE\u56FD\u753A"],
  ["013633", "JP-01", "\u539A\u6CA2\u90E8\u753A"],
  ["013641", "JP-01", "\u4E59\u90E8\u753A"],
  ["013676", "JP-01", "\u5965\u5C3B\u753A"],
  ["013706", "JP-01", "\u4ECA\u91D1\u753A"],
  ["013714", "JP-01", "\u305B\u305F\u306A\u753A"],
  ["013919", "JP-01", "\u5CF6\u7267\u6751"],
  ["013927", "JP-01", "\u5BFF\u90FD\u753A"],
  ["013935", "JP-01", "\u9ED2\u677E\u5185\u753A"],
  ["013943", "JP-01", "\u862D\u8D8A\u753A"],
  ["013951", "JP-01", "\u30CB\u30BB\u30B3\u753A"],
  ["013960", "JP-01", "\u771F\u72E9\u6751"],
  ["013978", "JP-01", "\u7559\u5BFF\u90FD\u6751"],
  ["013986", "JP-01", "\u559C\u8302\u5225\u753A"],
  ["013994", "JP-01", "\u4EAC\u6975\u753A"],
  ["014001", "JP-01", "\u5036\u77E5\u5B89\u753A"],
  ["014010", "JP-01", "\u5171\u548C\u753A"],
  ["014028", "JP-01", "\u5CA9\u5185\u753A"],
  ["014036", "JP-01", "\u6CCA\u6751"],
  ["014044", "JP-01", "\u795E\u6075\u5185\u6751"],
  ["014052", "JP-01", "\u7A4D\u4E39\u753A"],
  ["014061", "JP-01", "\u53E4\u5E73\u753A"],
  ["014079", "JP-01", "\u4EC1\u6728\u753A"],
  ["014087", "JP-01", "\u4F59\u5E02\u753A"],
  ["014095", "JP-01", "\u8D64\u4E95\u5DDD\u6751"],
  ["014231", "JP-01", "\u5357\u5E4C\u753A"],
  ["014249", "JP-01", "\u5948\u4E95\u6C5F\u753A"],
  ["014257", "JP-01", "\u4E0A\u7802\u5DDD\u753A"],
  ["014273", "JP-01", "\u7531\u4EC1\u753A"],
  ["014281", "JP-01", "\u9577\u6CBC\u753A"],
  ["014290", "JP-01", "\u6817\u5C71\u753A"],
  ["014303", "JP-01", "\u6708\u5F62\u753A"],
  ["014311", "JP-01", "\u6D66\u81FC\u753A"],
  ["014320", "JP-01", "\u65B0\u5341\u6D25\u5DDD\u753A"],
  ["014338", "JP-01", "\u59B9\u80CC\u725B\u753A"],
  ["014346", "JP-01", "\u79E9\u7236\u5225\u753A"],
  ["014362", "JP-01", "\u96E8\u7ADC\u753A"],
  ["014371", "JP-01", "\u5317\u7ADC\u753A"],
  ["014389", "JP-01", "\u6CBC\u7530\u753A"],
  ["014524", "JP-01", "\u9DF9\u6816\u753A"],
  ["014532", "JP-01", "\u6771\u795E\u697D\u753A"],
  ["014541", "JP-01", "\u5F53\u9EBB\u753A"],
  ["014559", "JP-01", "\u6BD4\u5E03\u753A"],
  ["014567", "JP-01", "\u611B\u5225\u753A"],
  ["014575", "JP-01", "\u4E0A\u5DDD\u753A"],
  ["014583", "JP-01", "\u6771\u5DDD\u753A"],
  ["014591", "JP-01", "\u7F8E\u745B\u753A"],
  ["014605", "JP-01", "\u4E0A\u5BCC\u826F\u91CE\u753A"],
  ["014613", "JP-01", "\u4E2D\u5BCC\u826F\u91CE\u753A"],
  ["014621", "JP-01", "\u5357\u5BCC\u826F\u91CE\u753A"],
  ["014630", "JP-01", "\u5360\u51A0\u6751"],
  ["014648", "JP-01", "\u548C\u5BD2\u753A"],
  ["014656", "JP-01", "\u5263\u6DF5\u753A"],
  ["014681", "JP-01", "\u4E0B\u5DDD\u753A"],
  ["014699", "JP-01", "\u7F8E\u6DF1\u753A"],
  ["014702", "JP-01", "\u97F3\u5A01\u5B50\u5E9C\u6751"],
  ["014711", "JP-01", "\u4E2D\u5DDD\u753A"],
  ["014729", "JP-01", "\u5E4C\u52A0\u5185\u753A"],
  ["014818", "JP-01", "\u5897\u6BDB\u753A"],
  ["014826", "JP-01", "\u5C0F\u5E73\u753A"],
  ["014834", "JP-01", "\u82EB\u524D\u753A"],
  ["014842", "JP-01", "\u7FBD\u5E4C\u753A"],
  ["014851", "JP-01", "\u521D\u5C71\u5225\u6751"],
  ["014869", "JP-01", "\u9060\u5225\u753A"],
  ["014877", "JP-01", "\u5929\u5869\u753A"],
  ["015113", "JP-01", "\u733F\u6255\u6751"],
  ["015121", "JP-01", "\u6D5C\u9813\u5225\u753A"],
  ["015130", "JP-01", "\u4E2D\u9813\u5225\u753A"],
  ["015148", "JP-01", "\u679D\u5E78\u753A"],
  ["015164", "JP-01", "\u8C4A\u5BCC\u753A"],
  ["015172", "JP-01", "\u793C\u6587\u753A"],
  ["015181", "JP-01", "\u5229\u5C3B\u753A"],
  ["015199", "JP-01", "\u5229\u5C3B\u5BCC\u58EB\u753A"],
  ["015202", "JP-01", "\u5E4C\u5EF6\u753A"],
  ["015431", "JP-01", "\u7F8E\u5E4C\u753A"],
  ["015440", "JP-01", "\u6D25\u5225\u753A"],
  ["015458", "JP-01", "\u659C\u91CC\u753A"],
  ["015466", "JP-01", "\u6E05\u91CC\u753A"],
  ["015474", "JP-01", "\u5C0F\u6E05\u6C34\u753A"],
  ["015491", "JP-01", "\u8A13\u5B50\u5E9C\u753A"],
  ["015504", "JP-01", "\u7F6E\u6238\u753A"],
  ["015521", "JP-01", "\u4F50\u5442\u9593\u753A"],
  ["015555", "JP-01", "\u9060\u8EFD\u753A"],
  ["015598", "JP-01", "\u6E67\u5225\u753A"],
  ["015601", "JP-01", "\u6EDD\u4E0A\u753A"],
  ["015610", "JP-01", "\u8208\u90E8\u753A"],
  ["015628", "JP-01", "\u897F\u8208\u90E8\u6751"],
  ["015636", "JP-01", "\u96C4\u6B66\u753A"],
  ["015644", "JP-01", "\u5927\u7A7A\u753A"],
  ["015717", "JP-01", "\u8C4A\u6D66\u753A"],
  ["015750", "JP-01", "\u58EE\u77A5\u753A"],
  ["015784", "JP-01", "\u767D\u8001\u753A"],
  ["015814", "JP-01", "\u539A\u771F\u753A"],
  ["015849", "JP-01", "\u6D1E\u723A\u6E56\u753A"],
  ["015857", "JP-01", "\u5B89\u5E73\u753A"],
  ["015865", "JP-01", "\u3080\u304B\u308F\u753A"],
  ["016012", "JP-01", "\u65E5\u9AD8\u753A"],
  ["016021", "JP-01", "\u5E73\u53D6\u753A"],
  ["016047", "JP-01", "\u65B0\u51A0\u753A"],
  ["016071", "JP-01", "\u6D66\u6CB3\u753A"],
  ["016080", "JP-01", "\u69D8\u4F3C\u753A"],
  ["016098", "JP-01", "\u3048\u308A\u3082\u753A"],
  ["016101", "JP-01", "\u65B0\u3072\u3060\u304B\u753A"],
  ["016314", "JP-01", "\u97F3\u66F4\u753A"],
  ["016322", "JP-01", "\u58EB\u5E4C\u753A"],
  ["016331", "JP-01", "\u4E0A\u58EB\u5E4C\u753A"],
  ["016349", "JP-01", "\u9E7F\u8FFD\u753A"],
  ["016357", "JP-01", "\u65B0\u5F97\u753A"],
  ["016365", "JP-01", "\u6E05\u6C34\u753A"],
  ["016373", "JP-01", "\u82BD\u5BA4\u753A"],
  ["016381", "JP-01", "\u4E2D\u672D\u5185\u6751"],
  ["016390", "JP-01", "\u66F4\u5225\u6751"],
  ["016411", "JP-01", "\u5927\u6A39\u753A"],
  ["016420", "JP-01", "\u5E83\u5C3E\u753A"],
  ["016438", "JP-01", "\u5E55\u5225\u753A"],
  ["016446", "JP-01", "\u6C60\u7530\u753A"],
  ["016454", "JP-01", "\u8C4A\u9803\u753A"],
  ["016462", "JP-01", "\u672C\u5225\u753A"],
  ["016471", "JP-01", "\u8DB3\u5BC4\u753A"],
  ["016489", "JP-01", "\u9678\u5225\u753A"],
  ["016497", "JP-01", "\u6D66\u5E4C\u753A"],
  ["016616", "JP-01", "\u91E7\u8DEF\u753A"],
  ["016624", "JP-01", "\u539A\u5CB8\u753A"],
  ["016632", "JP-01", "\u6D5C\u4E2D\u753A"],
  ["016641", "JP-01", "\u6A19\u8336\u753A"],
  ["016659", "JP-01", "\u5F1F\u5B50\u5C48\u753A"],
  ["016675", "JP-01", "\u9DB4\u5C45\u6751"],
  ["016683", "JP-01", "\u767D\u7CE0\u753A"],
  ["016918", "JP-01", "\u5225\u6D77\u753A"],
  ["016926", "JP-01", "\u4E2D\u6A19\u6D25\u753A"],
  ["016934", "JP-01", "\u6A19\u6D25\u753A"],
  ["016942", "JP-01", "\u7F85\u81FC\u753A"],
  ["022012", "JP-02", "\u9752\u68EE\u5E02"],
  ["022021", "JP-02", "\u5F18\u524D\u5E02"],
  ["022039", "JP-02", "\u516B\u6238\u5E02"],
  ["022047", "JP-02", "\u9ED2\u77F3\u5E02"],
  ["022055", "JP-02", "\u4E94\u6240\u5DDD\u539F\u5E02"],
  ["022063", "JP-02", "\u5341\u548C\u7530\u5E02"],
  ["022071", "JP-02", "\u4E09\u6CA2\u5E02"],
  ["022080", "JP-02", "\u3080\u3064\u5E02"],
  ["022098", "JP-02", "\u3064\u304C\u308B\u5E02"],
  ["022101", "JP-02", "\u5E73\u5DDD\u5E02"],
  ["023019", "JP-02", "\u5E73\u5185\u753A"],
  ["023035", "JP-02", "\u4ECA\u5225\u753A"],
  ["023043", "JP-02", "\u84EC\u7530\u6751"],
  ["023078", "JP-02", "\u5916\u30F6\u6D5C\u753A"],
  ["023213", "JP-02", "\u9C3A\u30F6\u6CA2\u753A"],
  ["023230", "JP-02", "\u6DF1\u6D66\u753A"],
  ["023434", "JP-02", "\u897F\u76EE\u5C4B\u6751"],
  ["023612", "JP-02", "\u85E4\u5D0E\u753A"],
  ["023621", "JP-02", "\u5927\u9C10\u753A"],
  ["023671", "JP-02", "\u7530\u820E\u9928\u6751"],
  ["023817", "JP-02", "\u677F\u67F3\u753A"],
  ["023841", "JP-02", "\u9DB4\u7530\u753A"],
  ["023876", "JP-02", "\u4E2D\u6CCA\u753A"],
  ["024015", "JP-02", "\u91CE\u8FBA\u5730\u753A"],
  ["024023", "JP-02", "\u4E03\u6238\u753A"],
  ["024058", "JP-02", "\u516D\u6238\u753A"],
  ["024066", "JP-02", "\u6A2A\u6D5C\u753A"],
  ["024082", "JP-02", "\u6771\u5317\u753A"],
  ["024112", "JP-02", "\u516D\u30F6\u6240\u6751"],
  ["024121", "JP-02", "\u304A\u3044\u3089\u305B\u753A"],
  ["024236", "JP-02", "\u5927\u9593\u753A"],
  ["024244", "JP-02", "\u6771\u901A\u6751"],
  ["024252", "JP-02", "\u98A8\u9593\u6D66\u6751"],
  ["024261", "JP-02", "\u4F50\u4E95\u6751"],
  ["024414", "JP-02", "\u4E09\u6238\u753A"],
  ["024422", "JP-02", "\u4E94\u6238\u753A"],
  ["024431", "JP-02", "\u7530\u5B50\u753A"],
  ["024457", "JP-02", "\u5357\u90E8\u753A"],
  ["024465", "JP-02", "\u968E\u4E0A\u753A"],
  ["024503", "JP-02", "\u65B0\u90F7\u6751"],
  ["032018", "JP-03", "\u76DB\u5CA1\u5E02"],
  ["032026", "JP-03", "\u5BAE\u53E4\u5E02"],
  ["032034", "JP-03", "\u5927\u8239\u6E21\u5E02"],
  ["032051", "JP-03", "\u82B1\u5DFB\u5E02"],
  ["032069", "JP-03", "\u5317\u4E0A\u5E02"],
  ["032077", "JP-03", "\u4E45\u6148\u5E02"],
  ["032085", "JP-03", "\u9060\u91CE\u5E02"],
  ["032093", "JP-03", "\u4E00\u95A2\u5E02"],
  ["032107", "JP-03", "\u9678\u524D\u9AD8\u7530\u5E02"],
  ["032115", "JP-03", "\u91DC\u77F3\u5E02"],
  ["032131", "JP-03", "\u4E8C\u6238\u5E02"],
  ["032140", "JP-03", "\u516B\u5E61\u5E73\u5E02"],
  ["032158", "JP-03", "\u5965\u5DDE\u5E02"],
  ["032166", "JP-03", "\u6EDD\u6CA2\u5E02"],
  ["033014", "JP-03", "\u96EB\u77F3\u753A"],
  ["033022", "JP-03", "\u845B\u5DFB\u753A"],
  ["033031", "JP-03", "\u5CA9\u624B\u753A"],
  ["033219", "JP-03", "\u7D2B\u6CE2\u753A"],
  ["033227", "JP-03", "\u77E2\u5DFE\u753A"],
  ["033669", "JP-03", "\u897F\u548C\u8CC0\u753A"],
  ["033812", "JP-03", "\u91D1\u30B1\u5D0E\u753A"],
  ["034029", "JP-03", "\u5E73\u6CC9\u753A"],
  ["034410", "JP-03", "\u4F4F\u7530\u753A"],
  ["034614", "JP-03", "\u5927\u69CC\u753A"],
  ["034827", "JP-03", "\u5C71\u7530\u753A"],
  ["034835", "JP-03", "\u5CA9\u6CC9\u753A"],
  ["034843", "JP-03", "\u7530\u91CE\u7551\u6751"],
  ["034851", "JP-03", "\u666E\u4EE3\u6751"],
  ["035017", "JP-03", "\u8EFD\u7C73\u753A"],
  ["035033", "JP-03", "\u91CE\u7530\u6751"],
  ["035068", "JP-03", "\u4E5D\u6238\u6751"],
  ["035076", "JP-03", "\u6D0B\u91CE\u753A"],
  ["035246", "JP-03", "\u4E00\u6238\u753A"],
  ["041009", "JP-04", "\u4ED9\u53F0\u5E02"],
  ["041017", "JP-04", "\u4ED9\u53F0\u5E02\u9752\u8449\u533A"],
  ["041025", "JP-04", "\u4ED9\u53F0\u5E02\u5BAE\u57CE\u91CE\u533A"],
  ["041033", "JP-04", "\u4ED9\u53F0\u5E02\u82E5\u6797\u533A"],
  ["041041", "JP-04", "\u4ED9\u53F0\u5E02\u592A\u767D\u533A"],
  ["041050", "JP-04", "\u4ED9\u53F0\u5E02\u6CC9\u533A"],
  ["042021", "JP-04", "\u77F3\u5DFB\u5E02"],
  ["042030", "JP-04", "\u5869\u7AC8\u5E02"],
  ["042056", "JP-04", "\u6C17\u4ED9\u6CBC\u5E02"],
  ["042064", "JP-04", "\u767D\u77F3\u5E02"],
  ["042072", "JP-04", "\u540D\u53D6\u5E02"],
  ["042081", "JP-04", "\u89D2\u7530\u5E02"],
  ["042099", "JP-04", "\u591A\u8CC0\u57CE\u5E02"],
  ["042111", "JP-04", "\u5CA9\u6CBC\u5E02"],
  ["042129", "JP-04", "\u767B\u7C73\u5E02"],
  ["042137", "JP-04", "\u6817\u539F\u5E02"],
  ["042145", "JP-04", "\u6771\u677E\u5CF6\u5E02"],
  ["042153", "JP-04", "\u5927\u5D0E\u5E02"],
  ["042161", "JP-04", "\u5BCC\u8C37\u5E02"],
  ["043010", "JP-04", "\u8535\u738B\u753A"],
  ["043028", "JP-04", "\u4E03\u30B1\u5BBF\u753A"],
  ["043214", "JP-04", "\u5927\u6CB3\u539F\u753A"],
  ["043222", "JP-04", "\u6751\u7530\u753A"],
  ["043231", "JP-04", "\u67F4\u7530\u753A"],
  ["043249", "JP-04", "\u5DDD\u5D0E\u753A"],
  ["043419", "JP-04", "\u4E38\u68EE\u753A"],
  ["043613", "JP-04", "\u4E98\u7406\u753A"],
  ["043621", "JP-04", "\u5C71\u5143\u753A"],
  ["044016", "JP-04", "\u677E\u5CF6\u753A"],
  ["044041", "JP-04", "\u4E03\u30F6\u6D5C\u753A"],
  ["044067", "JP-04", "\u5229\u5E9C\u753A"],
  ["044211", "JP-04", "\u5927\u548C\u753A"],
  ["044229", "JP-04", "\u5927\u90F7\u753A"],
  ["044245", "JP-04", "\u5927\u8861\u6751"],
  ["044440", "JP-04", "\u8272\u9EBB\u753A"],
  ["044458", "JP-04", "\u52A0\u7F8E\u753A"],
  ["045012", "JP-04", "\u6D8C\u8C37\u753A"],
  ["045055", "JP-04", "\u7F8E\u91CC\u753A"],
  ["045811", "JP-04", "\u5973\u5DDD\u753A"],
  ["046060", "JP-04", "\u5357\u4E09\u9678\u753A"],
  ["052019", "JP-05", "\u79CB\u7530\u5E02"],
  ["052027", "JP-05", "\u80FD\u4EE3\u5E02"],
  ["052035", "JP-05", "\u6A2A\u624B\u5E02"],
  ["052043", "JP-05", "\u5927\u9928\u5E02"],
  ["052060", "JP-05", "\u7537\u9E7F\u5E02"],
  ["052078", "JP-05", "\u6E6F\u6CA2\u5E02"],
  ["052094", "JP-05", "\u9E7F\u89D2\u5E02"],
  ["052108", "JP-05", "\u7531\u5229\u672C\u8358\u5E02"],
  ["052116", "JP-05", "\u6F5F\u4E0A\u5E02"],
  ["052124", "JP-05", "\u5927\u4ED9\u5E02"],
  ["052132", "JP-05", "\u5317\u79CB\u7530\u5E02"],
  ["052141", "JP-05", "\u306B\u304B\u307B\u5E02"],
  ["052159", "JP-05", "\u4ED9\u5317\u5E02"],
  ["053031", "JP-05", "\u5C0F\u5742\u753A"],
  ["053279", "JP-05", "\u4E0A\u5C0F\u963F\u4EC1\u6751"],
  ["053465", "JP-05", "\u85E4\u91CC\u753A"],
  ["053481", "JP-05", "\u4E09\u7A2E\u753A"],
  ["053490", "JP-05", "\u516B\u5CF0\u753A"],
  ["053619", "JP-05", "\u4E94\u57CE\u76EE\u753A"],
  ["053635", "JP-05", "\u516B\u90CE\u6F5F\u753A"],
  ["053660", "JP-05", "\u4E95\u5DDD\u753A"],
  ["053686", "JP-05", "\u5927\u6F5F\u6751"],
  ["054348", "JP-05", "\u7F8E\u90F7\u753A"],
  ["054631", "JP-05", "\u7FBD\u5F8C\u753A"],
  ["054640", "JP-05", "\u6771\u6210\u702C\u6751"],
  ["062014", "JP-06", "\u5C71\u5F62\u5E02"],
  ["062022", "JP-06", "\u7C73\u6CA2\u5E02"],
  ["062031", "JP-06", "\u9DB4\u5CA1\u5E02"],
  ["062049", "JP-06", "\u9152\u7530\u5E02"],
  ["062057", "JP-06", "\u65B0\u5E84\u5E02"],
  ["062065", "JP-06", "\u5BD2\u6CB3\u6C5F\u5E02"],
  ["062073", "JP-06", "\u4E0A\u5C71\u5E02"],
  ["062081", "JP-06", "\u6751\u5C71\u5E02"],
  ["062090", "JP-06", "\u9577\u4E95\u5E02"],
  ["062103", "JP-06", "\u5929\u7AE5\u5E02"],
  ["062111", "JP-06", "\u6771\u6839\u5E02"],
  ["062120", "JP-06", "\u5C3E\u82B1\u6CA2\u5E02"],
  ["062138", "JP-06", "\u5357\u967D\u5E02"],
  ["063011", "JP-06", "\u5C71\u8FBA\u753A"],
  ["063029", "JP-06", "\u4E2D\u5C71\u753A"],
  ["063215", "JP-06", "\u6CB3\u5317\u753A"],
  ["063223", "JP-06", "\u897F\u5DDD\u753A"],
  ["063231", "JP-06", "\u671D\u65E5\u753A"],
  ["063240", "JP-06", "\u5927\u6C5F\u753A"],
  ["063410", "JP-06", "\u5927\u77F3\u7530\u753A"],
  ["063614", "JP-06", "\u91D1\u5C71\u753A"],
  ["063622", "JP-06", "\u6700\u4E0A\u753A"],
  ["063631", "JP-06", "\u821F\u5F62\u753A"],
  ["063649", "JP-06", "\u771F\u5BA4\u5DDD\u753A"],
  ["063657", "JP-06", "\u5927\u8535\u6751"],
  ["063665", "JP-06", "\u9BAD\u5DDD\u6751"],
  ["063673", "JP-06", "\u6238\u6CA2\u6751"],
  ["063819", "JP-06", "\u9AD8\u7560\u753A"],
  ["063827", "JP-06", "\u5DDD\u897F\u753A"],
  ["064017", "JP-06", "\u5C0F\u56FD\u753A"],
  ["064025", "JP-06", "\u767D\u9DF9\u753A"],
  ["064033", "JP-06", "\u98EF\u8C4A\u753A"],
  ["064262", "JP-06", "\u4E09\u5DDD\u753A"],
  ["064289", "JP-06", "\u5E84\u5185\u753A"],
  ["064611", "JP-06", "\u904A\u4F50\u753A"],
  ["072010", "JP-07", "\u798F\u5CF6\u5E02"],
  ["072028", "JP-07", "\u4F1A\u6D25\u82E5\u677E\u5E02"],
  ["072036", "JP-07", "\u90E1\u5C71\u5E02"],
  ["072044", "JP-07", "\u3044\u308F\u304D\u5E02"],
  ["072052", "JP-07", "\u767D\u6CB3\u5E02"],
  ["072079", "JP-07", "\u9808\u8CC0\u5DDD\u5E02"],
  ["072087", "JP-07", "\u559C\u591A\u65B9\u5E02"],
  ["072095", "JP-07", "\u76F8\u99AC\u5E02"],
  ["072109", "JP-07", "\u4E8C\u672C\u677E\u5E02"],
  ["072117", "JP-07", "\u7530\u6751\u5E02"],
  ["072125", "JP-07", "\u5357\u76F8\u99AC\u5E02"],
  ["072133", "JP-07", "\u4F0A\u9054\u5E02"],
  ["072141", "JP-07", "\u672C\u5BAE\u5E02"],
  ["073016", "JP-07", "\u6851\u6298\u753A"],
  ["073032", "JP-07", "\u56FD\u898B\u753A"],
  ["073083", "JP-07", "\u5DDD\u4FE3\u753A"],
  ["073229", "JP-07", "\u5927\u7389\u6751"],
  ["073423", "JP-07", "\u93E1\u77F3\u753A"],
  ["073440", "JP-07", "\u5929\u6804\u6751"],
  ["073628", "JP-07", "\u4E0B\u90F7\u753A"],
  ["073644", "JP-07", "\u6A9C\u679D\u5C90\u6751"],
  ["073679", "JP-07", "\u53EA\u898B\u753A"],
  ["073687", "JP-07", "\u5357\u4F1A\u6D25\u753A"],
  ["074021", "JP-07", "\u5317\u5869\u539F\u6751"],
  ["074055", "JP-07", "\u897F\u4F1A\u6D25\u753A"],
  ["074071", "JP-07", "\u78D0\u68AF\u753A"],
  ["074080", "JP-07", "\u732A\u82D7\u4EE3\u753A"],
  ["074217", "JP-07", "\u4F1A\u6D25\u5742\u4E0B\u753A"],
  ["074225", "JP-07", "\u6E6F\u5DDD\u6751"],
  ["074233", "JP-07", "\u67F3\u6D25\u753A"],
  ["074446", "JP-07", "\u4E09\u5CF6\u753A"],
  ["074454", "JP-07", "\u91D1\u5C71\u753A"],
  ["074462", "JP-07", "\u662D\u548C\u6751"],
  ["074471", "JP-07", "\u4F1A\u6D25\u7F8E\u91CC\u753A"],
  ["074616", "JP-07", "\u897F\u90F7\u6751"],
  ["074641", "JP-07", "\u6CC9\u5D0E\u6751"],
  ["074659", "JP-07", "\u4E2D\u5CF6\u6751"],
  ["074667", "JP-07", "\u77E2\u5439\u753A"],
  ["074811", "JP-07", "\u68DA\u5009\u753A"],
  ["074829", "JP-07", "\u77E2\u796D\u753A"],
  ["074837", "JP-07", "\u5859\u753A"],
  ["074845", "JP-07", "\u9BAB\u5DDD\u6751"],
  ["075019", "JP-07", "\u77F3\u5DDD\u753A"],
  ["075027", "JP-07", "\u7389\u5DDD\u6751"],
  ["075035", "JP-07", "\u5E73\u7530\u6751"],
  ["075043", "JP-07", "\u6D45\u5DDD\u753A"],
  ["075051", "JP-07", "\u53E4\u6BBF\u753A"],
  ["075213", "JP-07", "\u4E09\u6625\u753A"],
  ["075221", "JP-07", "\u5C0F\u91CE\u753A"],
  ["075418", "JP-07", "\u5E83\u91CE\u753A"],
  ["075426", "JP-07", "\u6962\u8449\u753A"],
  ["075434", "JP-07", "\u5BCC\u5CA1\u753A"],
  ["075442", "JP-07", "\u5DDD\u5185\u6751"],
  ["075451", "JP-07", "\u5927\u718A\u753A"],
  ["075469", "JP-07", "\u53CC\u8449\u753A"],
  ["075477", "JP-07", "\u6D6A\u6C5F\u753A"],
  ["075485", "JP-07", "\u845B\u5C3E\u6751"],
  ["075612", "JP-07", "\u65B0\u5730\u753A"],
  ["075647", "JP-07", "\u98EF\u8218\u6751"],
  ["082015", "JP-08", "\u6C34\u6238\u5E02"],
  ["082023", "JP-08", "\u65E5\u7ACB\u5E02"],
  ["082031", "JP-08", "\u571F\u6D66\u5E02"],
  ["082040", "JP-08", "\u53E4\u6CB3\u5E02"],
  ["082058", "JP-08", "\u77F3\u5CA1\u5E02"],
  ["082074", "JP-08", "\u7D50\u57CE\u5E02"],
  ["082082", "JP-08", "\u9F8D\u30B1\u5D0E\u5E02"],
  ["082104", "JP-08", "\u4E0B\u59BB\u5E02"],
  ["082112", "JP-08", "\u5E38\u7DCF\u5E02"],
  ["082121", "JP-08", "\u5E38\u9678\u592A\u7530\u5E02"],
  ["082147", "JP-08", "\u9AD8\u8429\u5E02"],
  ["082155", "JP-08", "\u5317\u8328\u57CE\u5E02"],
  ["082163", "JP-08", "\u7B20\u9593\u5E02"],
  ["082171", "JP-08", "\u53D6\u624B\u5E02"],
  ["082198", "JP-08", "\u725B\u4E45\u5E02"],
  ["082201", "JP-08", "\u3064\u304F\u3070\u5E02"],
  ["082210", "JP-08", "\u3072\u305F\u3061\u306A\u304B\u5E02"],
  ["082228", "JP-08", "\u9E7F\u5D8B\u5E02"],
  ["082236", "JP-08", "\u6F6E\u6765\u5E02"],
  ["082244", "JP-08", "\u5B88\u8C37\u5E02"],
  ["082252", "JP-08", "\u5E38\u9678\u5927\u5BAE\u5E02"],
  ["082261", "JP-08", "\u90A3\u73C2\u5E02"],
  ["082279", "JP-08", "\u7B51\u897F\u5E02"],
  ["082287", "JP-08", "\u5742\u6771\u5E02"],
  ["082295", "JP-08", "\u7A32\u6577\u5E02"],
  ["082309", "JP-08", "\u304B\u3059\u307F\u304C\u3046\u3089\u5E02"],
  ["082317", "JP-08", "\u685C\u5DDD\u5E02"],
  ["082325", "JP-08", "\u795E\u6816\u5E02"],
  ["082333", "JP-08", "\u884C\u65B9\u5E02"],
  ["082341", "JP-08", "\u927E\u7530\u5E02"],
  ["082350", "JP-08", "\u3064\u304F\u3070\u307F\u3089\u3044\u5E02"],
  ["082368", "JP-08", "\u5C0F\u7F8E\u7389\u5E02"],
  ["083020", "JP-08", "\u8328\u57CE\u753A"],
  ["083097", "JP-08", "\u5927\u6D17\u753A"],
  ["083101", "JP-08", "\u57CE\u91CC\u753A"],
  ["083411", "JP-08", "\u6771\u6D77\u6751"],
  ["083640", "JP-08", "\u5927\u5B50\u753A"],
  ["084425", "JP-08", "\u7F8E\u6D66\u6751"],
  ["084433", "JP-08", "\u963F\u898B\u753A"],
  ["084476", "JP-08", "\u6CB3\u5185\u753A"],
  ["085219", "JP-08", "\u516B\u5343\u4EE3\u753A"],
  ["085421", "JP-08", "\u4E94\u971E\u753A"],
  ["085464", "JP-08", "\u5883\u753A"],
  ["085642", "JP-08", "\u5229\u6839\u753A"],
  ["092011", "JP-09", "\u5B87\u90FD\u5BAE\u5E02"],
  ["092029", "JP-09", "\u8DB3\u5229\u5E02"],
  ["092037", "JP-09", "\u6803\u6728\u5E02"],
  ["092045", "JP-09", "\u4F50\u91CE\u5E02"],
  ["092053", "JP-09", "\u9E7F\u6CBC\u5E02"],
  ["092061", "JP-09", "\u65E5\u5149\u5E02"],
  ["092088", "JP-09", "\u5C0F\u5C71\u5E02"],
  ["092096", "JP-09", "\u771F\u5CA1\u5E02"],
  ["092100", "JP-09", "\u5927\u7530\u539F\u5E02"],
  ["092118", "JP-09", "\u77E2\u677F\u5E02"],
  ["092134", "JP-09", "\u90A3\u9808\u5869\u539F\u5E02"],
  ["092142", "JP-09", "\u3055\u304F\u3089\u5E02"],
  ["092151", "JP-09", "\u90A3\u9808\u70CF\u5C71\u5E02"],
  ["092169", "JP-09", "\u4E0B\u91CE\u5E02"],
  ["093017", "JP-09", "\u4E0A\u4E09\u5DDD\u753A"],
  ["093424", "JP-09", "\u76CA\u5B50\u753A"],
  ["093432", "JP-09", "\u8302\u6728\u753A"],
  ["093441", "JP-09", "\u5E02\u8C9D\u753A"],
  ["093459", "JP-09", "\u82B3\u8CC0\u753A"],
  ["093611", "JP-09", "\u58EC\u751F\u753A"],
  ["093645", "JP-09", "\u91CE\u6728\u753A"],
  ["093840", "JP-09", "\u5869\u8C37\u753A"],
  ["093866", "JP-09", "\u9AD8\u6839\u6CA2\u753A"],
  ["094072", "JP-09", "\u90A3\u9808\u753A"],
  ["094111", "JP-09", "\u90A3\u73C2\u5DDD\u753A"],
  ["102016", "JP-10", "\u524D\u6A4B\u5E02"],
  ["102024", "JP-10", "\u9AD8\u5D0E\u5E02"],
  ["102032", "JP-10", "\u6850\u751F\u5E02"],
  ["102041", "JP-10", "\u4F0A\u52E2\u5D0E\u5E02"],
  ["102059", "JP-10", "\u592A\u7530\u5E02"],
  ["102067", "JP-10", "\u6CBC\u7530\u5E02"],
  ["102075", "JP-10", "\u9928\u6797\u5E02"],
  ["102083", "JP-10", "\u6E0B\u5DDD\u5E02"],
  ["102091", "JP-10", "\u85E4\u5CA1\u5E02"],
  ["102105", "JP-10", "\u5BCC\u5CA1\u5E02"],
  ["102113", "JP-10", "\u5B89\u4E2D\u5E02"],
  ["102121", "JP-10", "\u307F\u3069\u308A\u5E02"],
  ["103446", "JP-10", "\u699B\u6771\u6751"],
  ["103454", "JP-10", "\u5409\u5CA1\u753A"],
  ["103667", "JP-10", "\u4E0A\u91CE\u6751"],
  ["103675", "JP-10", "\u795E\u6D41\u753A"],
  ["103829", "JP-10", "\u4E0B\u4EC1\u7530\u753A"],
  ["103837", "JP-10", "\u5357\u7267\u6751"],
  ["103845", "JP-10", "\u7518\u697D\u753A"],
  ["104213", "JP-10", "\u4E2D\u4E4B\u6761\u753A"],
  ["104248", "JP-10", "\u9577\u91CE\u539F\u753A"],
  ["104256", "JP-10", "\u5B2C\u604B\u6751"],
  ["104264", "JP-10", "\u8349\u6D25\u753A"],
  ["104281", "JP-10", "\u9AD8\u5C71\u6751"],
  ["104299", "JP-10", "\u6771\u543E\u59BB\u753A"],
  ["104434", "JP-10", "\u7247\u54C1\u6751"],
  ["104442", "JP-10", "\u5DDD\u5834\u6751"],
  ["104485", "JP-10", "\u662D\u548C\u6751"],
  ["104493", "JP-10", "\u307F\u306A\u304B\u307F\u753A"],
  ["104647", "JP-10", "\u7389\u6751\u753A"],
  ["105210", "JP-10", "\u677F\u5009\u753A"],
  ["105228", "JP-10", "\u660E\u548C\u753A"],
  ["105236", "JP-10", "\u5343\u4EE3\u7530\u753A"],
  ["105244", "JP-10", "\u5927\u6CC9\u753A"],
  ["105252", "JP-10", "\u9091\u697D\u753A"],
  ["111007", "JP-11", "\u3055\u3044\u305F\u307E\u5E02"],
  ["111015", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u897F\u533A"],
  ["111023", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u5317\u533A"],
  ["111031", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u5927\u5BAE\u533A"],
  ["111040", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u898B\u6CBC\u533A"],
  ["111058", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u4E2D\u592E\u533A"],
  ["111066", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u685C\u533A"],
  ["111074", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u6D66\u548C\u533A"],
  ["111082", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u5357\u533A"],
  ["111091", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u7DD1\u533A"],
  ["111104", "JP-11", "\u3055\u3044\u305F\u307E\u5E02\u5CA9\u69FB\u533A"],
  ["112011", "JP-11", "\u5DDD\u8D8A\u5E02"],
  ["112020", "JP-11", "\u718A\u8C37\u5E02"],
  ["112038", "JP-11", "\u5DDD\u53E3\u5E02"],
  ["112062", "JP-11", "\u884C\u7530\u5E02"],
  ["112071", "JP-11", "\u79E9\u7236\u5E02"],
  ["112089", "JP-11", "\u6240\u6CA2\u5E02"],
  ["112097", "JP-11", "\u98EF\u80FD\u5E02"],
  ["112101", "JP-11", "\u52A0\u9808\u5E02"],
  ["112119", "JP-11", "\u672C\u5E84\u5E02"],
  ["112127", "JP-11", "\u6771\u677E\u5C71\u5E02"],
  ["112143", "JP-11", "\u6625\u65E5\u90E8\u5E02"],
  ["112151", "JP-11", "\u72ED\u5C71\u5E02"],
  ["112160", "JP-11", "\u7FBD\u751F\u5E02"],
  ["112178", "JP-11", "\u9D3B\u5DE3\u5E02"],
  ["112186", "JP-11", "\u6DF1\u8C37\u5E02"],
  ["112194", "JP-11", "\u4E0A\u5C3E\u5E02"],
  ["112216", "JP-11", "\u8349\u52A0\u5E02"],
  ["112224", "JP-11", "\u8D8A\u8C37\u5E02"],
  ["112232", "JP-11", "\u8568\u5E02"],
  ["112241", "JP-11", "\u6238\u7530\u5E02"],
  ["112259", "JP-11", "\u5165\u9593\u5E02"],
  ["112275", "JP-11", "\u671D\u971E\u5E02"],
  ["112283", "JP-11", "\u5FD7\u6728\u5E02"],
  ["112291", "JP-11", "\u548C\u5149\u5E02"],
  ["112305", "JP-11", "\u65B0\u5EA7\u5E02"],
  ["112313", "JP-11", "\u6876\u5DDD\u5E02"],
  ["112321", "JP-11", "\u4E45\u559C\u5E02"],
  ["112330", "JP-11", "\u5317\u672C\u5E02"],
  ["112348", "JP-11", "\u516B\u6F6E\u5E02"],
  ["112356", "JP-11", "\u5BCC\u58EB\u898B\u5E02"],
  ["112372", "JP-11", "\u4E09\u90F7\u5E02"],
  ["112381", "JP-11", "\u84EE\u7530\u5E02"],
  ["112399", "JP-11", "\u5742\u6238\u5E02"],
  ["112402", "JP-11", "\u5E78\u624B\u5E02"],
  ["112411", "JP-11", "\u9DB4\u30F6\u5CF6\u5E02"],
  ["112429", "JP-11", "\u65E5\u9AD8\u5E02"],
  ["112437", "JP-11", "\u5409\u5DDD\u5E02"],
  ["112453", "JP-11", "\u3075\u3058\u307F\u91CE\u5E02"],
  ["112461", "JP-11", "\u767D\u5CA1\u5E02"],
  ["113018", "JP-11", "\u4F0A\u5948\u753A"],
  ["113247", "JP-11", "\u4E09\u82B3\u753A"],
  ["113263", "JP-11", "\u6BDB\u5442\u5C71\u753A"],
  ["113271", "JP-11", "\u8D8A\u751F\u753A"],
  ["113417", "JP-11", "\u6ED1\u5DDD\u753A"],
  ["113425", "JP-11", "\u5D50\u5C71\u753A"],
  ["113433", "JP-11", "\u5C0F\u5DDD\u753A"],
  ["113468", "JP-11", "\u5DDD\u5CF6\u753A"],
  ["113476", "JP-11", "\u5409\u898B\u753A"],
  ["113484", "JP-11", "\u9CE9\u5C71\u753A"],
  ["113492", "JP-11", "\u3068\u304D\u304C\u308F\u753A"],
  ["113611", "JP-11", "\u6A2A\u702C\u753A"],
  ["113620", "JP-11", "\u7686\u91CE\u753A"],
  ["113638", "JP-11", "\u9577\u701E\u753A"],
  ["113654", "JP-11", "\u5C0F\u9E7F\u91CE\u753A"],
  ["113697", "JP-11", "\u6771\u79E9\u7236\u6751"],
  ["113816", "JP-11", "\u7F8E\u91CC\u753A"],
  ["113832", "JP-11", "\u795E\u5DDD\u753A"],
  ["113859", "JP-11", "\u4E0A\u91CC\u753A"],
  ["114081", "JP-11", "\u5BC4\u5C45\u753A"],
  ["114421", "JP-11", "\u5BAE\u4EE3\u753A"],
  ["114642", "JP-11", "\u6749\u6238\u753A"],
  ["114651", "JP-11", "\u677E\u4F0F\u753A"],
  ["121002", "JP-12", "\u5343\u8449\u5E02"],
  ["121011", "JP-12", "\u5343\u8449\u5E02\u4E2D\u592E\u533A"],
  ["121029", "JP-12", "\u5343\u8449\u5E02\u82B1\u898B\u5DDD\u533A"],
  ["121037", "JP-12", "\u5343\u8449\u5E02\u7A32\u6BDB\u533A"],
  ["121045", "JP-12", "\u5343\u8449\u5E02\u82E5\u8449\u533A"],
  ["121053", "JP-12", "\u5343\u8449\u5E02\u7DD1\u533A"],
  ["121061", "JP-12", "\u5343\u8449\u5E02\u7F8E\u6D5C\u533A"],
  ["122025", "JP-12", "\u929A\u5B50\u5E02"],
  ["122033", "JP-12", "\u5E02\u5DDD\u5E02"],
  ["122041", "JP-12", "\u8239\u6A4B\u5E02"],
  ["122050", "JP-12", "\u9928\u5C71\u5E02"],
  ["122068", "JP-12", "\u6728\u66F4\u6D25\u5E02"],
  ["122076", "JP-12", "\u677E\u6238\u5E02"],
  ["122084", "JP-12", "\u91CE\u7530\u5E02"],
  ["122106", "JP-12", "\u8302\u539F\u5E02"],
  ["122114", "JP-12", "\u6210\u7530\u5E02"],
  ["122122", "JP-12", "\u4F50\u5009\u5E02"],
  ["122131", "JP-12", "\u6771\u91D1\u5E02"],
  ["122157", "JP-12", "\u65ED\u5E02"],
  ["122165", "JP-12", "\u7FD2\u5FD7\u91CE\u5E02"],
  ["122173", "JP-12", "\u67CF\u5E02"],
  ["122181", "JP-12", "\u52DD\u6D66\u5E02"],
  ["122190", "JP-12", "\u5E02\u539F\u5E02"],
  ["122203", "JP-12", "\u6D41\u5C71\u5E02"],
  ["122211", "JP-12", "\u516B\u5343\u4EE3\u5E02"],
  ["122220", "JP-12", "\u6211\u5B6B\u5B50\u5E02"],
  ["122238", "JP-12", "\u9D28\u5DDD\u5E02"],
  ["122246", "JP-12", "\u938C\u30B1\u8C37\u5E02"],
  ["122254", "JP-12", "\u541B\u6D25\u5E02"],
  ["122262", "JP-12", "\u5BCC\u6D25\u5E02"],
  ["122271", "JP-12", "\u6D66\u5B89\u5E02"],
  ["122289", "JP-12", "\u56DB\u8857\u9053\u5E02"],
  ["122297", "JP-12", "\u8896\u30B1\u6D66\u5E02"],
  ["122301", "JP-12", "\u516B\u8857\u5E02"],
  ["122319", "JP-12", "\u5370\u897F\u5E02"],
  ["122327", "JP-12", "\u767D\u4E95\u5E02"],
  ["122335", "JP-12", "\u5BCC\u91CC\u5E02"],
  ["122343", "JP-12", "\u5357\u623F\u7DCF\u5E02"],
  ["122351", "JP-12", "\u531D\u7473\u5E02"],
  ["122360", "JP-12", "\u9999\u53D6\u5E02"],
  ["122378", "JP-12", "\u5C71\u6B66\u5E02"],
  ["122386", "JP-12", "\u3044\u3059\u307F\u5E02"],
  ["122394", "JP-12", "\u5927\u7DB2\u767D\u91CC\u5E02"],
  ["123226", "JP-12", "\u9152\u3005\u4E95\u753A"],
  ["123293", "JP-12", "\u6804\u753A"],
  ["123421", "JP-12", "\u795E\u5D0E\u753A"],
  ["123471", "JP-12", "\u591A\u53E4\u753A"],
  ["123498", "JP-12", "\u6771\u5E84\u753A"],
  ["124036", "JP-12", "\u4E5D\u5341\u4E5D\u91CC\u753A"],
  ["124095", "JP-12", "\u829D\u5C71\u753A"],
  ["124109", "JP-12", "\u6A2A\u829D\u5149\u753A"],
  ["124214", "JP-12", "\u4E00\u5BAE\u753A"],
  ["124222", "JP-12", "\u7766\u6CA2\u753A"],
  ["124231", "JP-12", "\u9577\u751F\u6751"],
  ["124249", "JP-12", "\u767D\u5B50\u753A"],
  ["124265", "JP-12", "\u9577\u67C4\u753A"],
  ["124273", "JP-12", "\u9577\u5357\u753A"],
  ["124419", "JP-12", "\u5927\u591A\u559C\u753A"],
  ["124435", "JP-12", "\u5FA1\u5BBF\u753A"],
  ["124630", "JP-12", "\u92F8\u5357\u753A"],
  ["131016", "JP-13", "\u5343\u4EE3\u7530\u533A"],
  ["131024", "JP-13", "\u4E2D\u592E\u533A"],
  ["131032", "JP-13", "\u6E2F\u533A"],
  ["131041", "JP-13", "\u65B0\u5BBF\u533A"],
  ["131059", "JP-13", "\u6587\u4EAC\u533A"],
  ["131067", "JP-13", "\u53F0\u6771\u533A"],
  ["131075", "JP-13", "\u58A8\u7530\u533A"],
  ["131083", "JP-13", "\u6C5F\u6771\u533A"],
  ["131091", "JP-13", "\u54C1\u5DDD\u533A"],
  ["131105", "JP-13", "\u76EE\u9ED2\u533A"],
  ["131113", "JP-13", "\u5927\u7530\u533A"],
  ["131121", "JP-13", "\u4E16\u7530\u8C37\u533A"],
  ["131130", "JP-13", "\u6E0B\u8C37\u533A"],
  ["131148", "JP-13", "\u4E2D\u91CE\u533A"],
  ["131156", "JP-13", "\u6749\u4E26\u533A"],
  ["131164", "JP-13", "\u8C4A\u5CF6\u533A"],
  ["131172", "JP-13", "\u5317\u533A"],
  ["131181", "JP-13", "\u8352\u5DDD\u533A"],
  ["131199", "JP-13", "\u677F\u6A4B\u533A"],
  ["131202", "JP-13", "\u7DF4\u99AC\u533A"],
  ["131211", "JP-13", "\u8DB3\u7ACB\u533A"],
  ["131229", "JP-13", "\u845B\u98FE\u533A"],
  ["131237", "JP-13", "\u6C5F\u6238\u5DDD\u533A"],
  ["132012", "JP-13", "\u516B\u738B\u5B50\u5E02"],
  ["132021", "JP-13", "\u7ACB\u5DDD\u5E02"],
  ["132039", "JP-13", "\u6B66\u8535\u91CE\u5E02"],
  ["132047", "JP-13", "\u4E09\u9DF9\u5E02"],
  ["132055", "JP-13", "\u9752\u6885\u5E02"],
  ["132063", "JP-13", "\u5E9C\u4E2D\u5E02"],
  ["132071", "JP-13", "\u662D\u5CF6\u5E02"],
  ["132080", "JP-13", "\u8ABF\u5E03\u5E02"],
  ["132098", "JP-13", "\u753A\u7530\u5E02"],
  ["132101", "JP-13", "\u5C0F\u91D1\u4E95\u5E02"],
  ["132110", "JP-13", "\u5C0F\u5E73\u5E02"],
  ["132128", "JP-13", "\u65E5\u91CE\u5E02"],
  ["132136", "JP-13", "\u6771\u6751\u5C71\u5E02"],
  ["132144", "JP-13", "\u56FD\u5206\u5BFA\u5E02"],
  ["132152", "JP-13", "\u56FD\u7ACB\u5E02"],
  ["132187", "JP-13", "\u798F\u751F\u5E02"],
  ["132195", "JP-13", "\u72DB\u6C5F\u5E02"],
  ["132209", "JP-13", "\u6771\u5927\u548C\u5E02"],
  ["132217", "JP-13", "\u6E05\u702C\u5E02"],
  ["132225", "JP-13", "\u6771\u4E45\u7559\u7C73\u5E02"],
  ["132233", "JP-13", "\u6B66\u8535\u6751\u5C71\u5E02"],
  ["132241", "JP-13", "\u591A\u6469\u5E02"],
  ["132250", "JP-13", "\u7A32\u57CE\u5E02"],
  ["132276", "JP-13", "\u7FBD\u6751\u5E02"],
  ["132284", "JP-13", "\u3042\u304D\u308B\u91CE\u5E02"],
  ["132292", "JP-13", "\u897F\u6771\u4EAC\u5E02"],
  ["133035", "JP-13", "\u745E\u7A42\u753A"],
  ["133051", "JP-13", "\u65E5\u306E\u51FA\u753A"],
  ["133078", "JP-13", "\u6A9C\u539F\u6751"],
  ["133086", "JP-13", "\u5965\u591A\u6469\u753A"],
  ["133612", "JP-13", "\u5927\u5CF6\u753A"],
  ["133621", "JP-13", "\u5229\u5CF6\u6751"],
  ["133639", "JP-13", "\u65B0\u5CF6\u6751"],
  ["133647", "JP-13", "\u795E\u6D25\u5CF6\u6751"],
  ["133817", "JP-13", "\u4E09\u5B85\u6751"],
  ["133825", "JP-13", "\u5FA1\u8535\u5CF6\u6751"],
  ["134015", "JP-13", "\u516B\u4E08\u753A"],
  ["134023", "JP-13", "\u9752\u30F6\u5CF6\u6751"],
  ["134210", "JP-13", "\u5C0F\u7B20\u539F\u6751"],
  ["141003", "JP-14", "\u6A2A\u6D5C\u5E02"],
  ["141011", "JP-14", "\u6A2A\u6D5C\u5E02\u9DB4\u898B\u533A"],
  ["141020", "JP-14", "\u6A2A\u6D5C\u5E02\u795E\u5948\u5DDD\u533A"],
  ["141038", "JP-14", "\u6A2A\u6D5C\u5E02\u897F\u533A"],
  ["141046", "JP-14", "\u6A2A\u6D5C\u5E02\u4E2D\u533A"],
  ["141054", "JP-14", "\u6A2A\u6D5C\u5E02\u5357\u533A"],
  ["141062", "JP-14", "\u6A2A\u6D5C\u5E02\u4FDD\u571F\u30B1\u8C37\u533A"],
  ["141071", "JP-14", "\u6A2A\u6D5C\u5E02\u78EF\u5B50\u533A"],
  ["141089", "JP-14", "\u6A2A\u6D5C\u5E02\u91D1\u6CA2\u533A"],
  ["141097", "JP-14", "\u6A2A\u6D5C\u5E02\u6E2F\u5317\u533A"],
  ["141101", "JP-14", "\u6A2A\u6D5C\u5E02\u6238\u585A\u533A"],
  ["141119", "JP-14", "\u6A2A\u6D5C\u5E02\u6E2F\u5357\u533A"],
  ["141127", "JP-14", "\u6A2A\u6D5C\u5E02\u65ED\u533A"],
  ["141135", "JP-14", "\u6A2A\u6D5C\u5E02\u7DD1\u533A"],
  ["141143", "JP-14", "\u6A2A\u6D5C\u5E02\u702C\u8C37\u533A"],
  ["141151", "JP-14", "\u6A2A\u6D5C\u5E02\u6804\u533A"],
  ["141160", "JP-14", "\u6A2A\u6D5C\u5E02\u6CC9\u533A"],
  ["141178", "JP-14", "\u6A2A\u6D5C\u5E02\u9752\u8449\u533A"],
  ["141186", "JP-14", "\u6A2A\u6D5C\u5E02\u90FD\u7B51\u533A"],
  ["141305", "JP-14", "\u5DDD\u5D0E\u5E02"],
  ["141313", "JP-14", "\u5DDD\u5D0E\u5E02\u5DDD\u5D0E\u533A"],
  ["141321", "JP-14", "\u5DDD\u5D0E\u5E02\u5E78\u533A"],
  ["141330", "JP-14", "\u5DDD\u5D0E\u5E02\u4E2D\u539F\u533A"],
  ["141348", "JP-14", "\u5DDD\u5D0E\u5E02\u9AD8\u6D25\u533A"],
  ["141356", "JP-14", "\u5DDD\u5D0E\u5E02\u591A\u6469\u533A"],
  ["141364", "JP-14", "\u5DDD\u5D0E\u5E02\u5BAE\u524D\u533A"],
  ["141372", "JP-14", "\u5DDD\u5D0E\u5E02\u9EBB\u751F\u533A"],
  ["141500", "JP-14", "\u76F8\u6A21\u539F\u5E02"],
  ["141518", "JP-14", "\u76F8\u6A21\u539F\u5E02\u7DD1\u533A"],
  ["141526", "JP-14", "\u76F8\u6A21\u539F\u5E02\u4E2D\u592E\u533A"],
  ["141534", "JP-14", "\u76F8\u6A21\u539F\u5E02\u5357\u533A"],
  ["142018", "JP-14", "\u6A2A\u9808\u8CC0\u5E02"],
  ["142034", "JP-14", "\u5E73\u585A\u5E02"],
  ["142042", "JP-14", "\u938C\u5009\u5E02"],
  ["142051", "JP-14", "\u85E4\u6CA2\u5E02"],
  ["142069", "JP-14", "\u5C0F\u7530\u539F\u5E02"],
  ["142077", "JP-14", "\u8305\u30F6\u5D0E\u5E02"],
  ["142085", "JP-14", "\u9017\u5B50\u5E02"],
  ["142107", "JP-14", "\u4E09\u6D66\u5E02"],
  ["142115", "JP-14", "\u79E6\u91CE\u5E02"],
  ["142123", "JP-14", "\u539A\u6728\u5E02"],
  ["142131", "JP-14", "\u5927\u548C\u5E02"],
  ["142140", "JP-14", "\u4F0A\u52E2\u539F\u5E02"],
  ["142158", "JP-14", "\u6D77\u8001\u540D\u5E02"],
  ["142166", "JP-14", "\u5EA7\u9593\u5E02"],
  ["142174", "JP-14", "\u5357\u8DB3\u67C4\u5E02"],
  ["142182", "JP-14", "\u7DBE\u702C\u5E02"],
  ["143014", "JP-14", "\u8449\u5C71\u753A"],
  ["143219", "JP-14", "\u5BD2\u5DDD\u753A"],
  ["143413", "JP-14", "\u5927\u78EF\u753A"],
  ["143421", "JP-14", "\u4E8C\u5BAE\u753A"],
  ["143618", "JP-14", "\u4E2D\u4E95\u753A"],
  ["143626", "JP-14", "\u5927\u4E95\u753A"],
  ["143634", "JP-14", "\u677E\u7530\u753A"],
  ["143642", "JP-14", "\u5C71\u5317\u753A"],
  ["143669", "JP-14", "\u958B\u6210\u753A"],
  ["143821", "JP-14", "\u7BB1\u6839\u753A"],
  ["143839", "JP-14", "\u771F\u9DB4\u753A"],
  ["143847", "JP-14", "\u6E6F\u6CB3\u539F\u753A"],
  ["144011", "JP-14", "\u611B\u5DDD\u753A"],
  ["144029", "JP-14", "\u6E05\u5DDD\u6751"],
  ["151009", "JP-15", "\u65B0\u6F5F\u5E02"],
  ["151017", "JP-15", "\u65B0\u6F5F\u5E02\u5317\u533A"],
  ["151025", "JP-15", "\u65B0\u6F5F\u5E02\u6771\u533A"],
  ["151033", "JP-15", "\u65B0\u6F5F\u5E02\u4E2D\u592E\u533A"],
  ["151041", "JP-15", "\u65B0\u6F5F\u5E02\u6C5F\u5357\u533A"],
  ["151050", "JP-15", "\u65B0\u6F5F\u5E02\u79CB\u8449\u533A"],
  ["151068", "JP-15", "\u65B0\u6F5F\u5E02\u5357\u533A"],
  ["151076", "JP-15", "\u65B0\u6F5F\u5E02\u897F\u533A"],
  ["151084", "JP-15", "\u65B0\u6F5F\u5E02\u897F\u84B2\u533A"],
  ["152021", "JP-15", "\u9577\u5CA1\u5E02"],
  ["152048", "JP-15", "\u4E09\u6761\u5E02"],
  ["152056", "JP-15", "\u67CF\u5D0E\u5E02"],
  ["152064", "JP-15", "\u65B0\u767A\u7530\u5E02"],
  ["152081", "JP-15", "\u5C0F\u5343\u8C37\u5E02"],
  ["152099", "JP-15", "\u52A0\u8302\u5E02"],
  ["152102", "JP-15", "\u5341\u65E5\u753A\u5E02"],
  ["152111", "JP-15", "\u898B\u9644\u5E02"],
  ["152129", "JP-15", "\u6751\u4E0A\u5E02"],
  ["152137", "JP-15", "\u71D5\u5E02"],
  ["152161", "JP-15", "\u7CF8\u9B5A\u5DDD\u5E02"],
  ["152170", "JP-15", "\u5999\u9AD8\u5E02"],
  ["152188", "JP-15", "\u4E94\u6CC9\u5E02"],
  ["152226", "JP-15", "\u4E0A\u8D8A\u5E02"],
  ["152234", "JP-15", "\u963F\u8CC0\u91CE\u5E02"],
  ["152242", "JP-15", "\u4F50\u6E21\u5E02"],
  ["152251", "JP-15", "\u9B5A\u6CBC\u5E02"],
  ["152269", "JP-15", "\u5357\u9B5A\u6CBC\u5E02"],
  ["152277", "JP-15", "\u80CE\u5185\u5E02"],
  ["153079", "JP-15", "\u8056\u7C60\u753A"],
  ["153427", "JP-15", "\u5F25\u5F66\u6751"],
  ["153613", "JP-15", "\u7530\u4E0A\u753A"],
  ["153851", "JP-15", "\u963F\u8CC0\u753A"],
  ["154059", "JP-15", "\u51FA\u96F2\u5D0E\u753A"],
  ["154610", "JP-15", "\u6E6F\u6CA2\u753A"],
  ["154822", "JP-15", "\u6D25\u5357\u753A"],
  ["155047", "JP-15", "\u5208\u7FBD\u6751"],
  ["155811", "JP-15", "\u95A2\u5DDD\u6751"],
  ["155861", "JP-15", "\u7C9F\u5CF6\u6D66\u6751"],
  ["162019", "JP-16", "\u5BCC\u5C71\u5E02"],
  ["162027", "JP-16", "\u9AD8\u5CA1\u5E02"],
  ["162043", "JP-16", "\u9B5A\u6D25\u5E02"],
  ["162051", "JP-16", "\u6C37\u898B\u5E02"],
  ["162060", "JP-16", "\u6ED1\u5DDD\u5E02"],
  ["162078", "JP-16", "\u9ED2\u90E8\u5E02"],
  ["162086", "JP-16", "\u783A\u6CE2\u5E02"],
  ["162094", "JP-16", "\u5C0F\u77E2\u90E8\u5E02"],
  ["162108", "JP-16", "\u5357\u783A\u5E02"],
  ["162116", "JP-16", "\u5C04\u6C34\u5E02"],
  ["163210", "JP-16", "\u821F\u6A4B\u6751"],
  ["163228", "JP-16", "\u4E0A\u5E02\u753A"],
  ["163236", "JP-16", "\u7ACB\u5C71\u753A"],
  ["163422", "JP-16", "\u5165\u5584\u753A"],
  ["163431", "JP-16", "\u671D\u65E5\u753A"],
  ["172014", "JP-17", "\u91D1\u6CA2\u5E02"],
  ["172022", "JP-17", "\u4E03\u5C3E\u5E02"],
  ["172031", "JP-17", "\u5C0F\u677E\u5E02"],
  ["172049", "JP-17", "\u8F2A\u5CF6\u5E02"],
  ["172057", "JP-17", "\u73E0\u6D32\u5E02"],
  ["172065", "JP-17", "\u52A0\u8CC0\u5E02"],
  ["172073", "JP-17", "\u7FBD\u548B\u5E02"],
  ["172090", "JP-17", "\u304B\u307B\u304F\u5E02"],
  ["172103", "JP-17", "\u767D\u5C71\u5E02"],
  ["172111", "JP-17", "\u80FD\u7F8E\u5E02"],
  ["172120", "JP-17", "\u91CE\u3005\u5E02\u5E02"],
  ["173240", "JP-17", "\u5DDD\u5317\u753A"],
  ["173614", "JP-17", "\u6D25\u5E61\u753A"],
  ["173657", "JP-17", "\u5185\u7058\u753A"],
  ["173843", "JP-17", "\u5FD7\u8CC0\u753A"],
  ["173860", "JP-17", "\u5B9D\u9054\u5FD7\u6C34\u753A"],
  ["174076", "JP-17", "\u4E2D\u80FD\u767B\u753A"],
  ["174611", "JP-17", "\u7A74\u6C34\u753A"],
  ["174637", "JP-17", "\u80FD\u767B\u753A"],
  ["182010", "JP-18", "\u798F\u4E95\u5E02"],
  ["182028", "JP-18", "\u6566\u8CC0\u5E02"],
  ["182044", "JP-18", "\u5C0F\u6D5C\u5E02"],
  ["182052", "JP-18", "\u5927\u91CE\u5E02"],
  ["182061", "JP-18", "\u52DD\u5C71\u5E02"],
  ["182079", "JP-18", "\u9BD6\u6C5F\u5E02"],
  ["182087", "JP-18", "\u3042\u308F\u3089\u5E02"],
  ["182095", "JP-18", "\u8D8A\u524D\u5E02"],
  ["182109", "JP-18", "\u5742\u4E95\u5E02"],
  ["183229", "JP-18", "\u6C38\u5E73\u5BFA\u753A"],
  ["183822", "JP-18", "\u6C60\u7530\u753A"],
  ["184047", "JP-18", "\u5357\u8D8A\u524D\u753A"],
  ["184233", "JP-18", "\u8D8A\u524D\u753A"],
  ["184420", "JP-18", "\u7F8E\u6D5C\u753A"],
  ["184811", "JP-18", "\u9AD8\u6D5C\u753A"],
  ["184837", "JP-18", "\u304A\u304A\u3044\u753A"],
  ["185019", "JP-18", "\u82E5\u72ED\u753A"],
  ["192015", "JP-19", "\u7532\u5E9C\u5E02"],
  ["192023", "JP-19", "\u5BCC\u58EB\u5409\u7530\u5E02"],
  ["192040", "JP-19", "\u90FD\u7559\u5E02"],
  ["192058", "JP-19", "\u5C71\u68A8\u5E02"],
  ["192066", "JP-19", "\u5927\u6708\u5E02"],
  ["192074", "JP-19", "\u97EE\u5D0E\u5E02"],
  ["192082", "JP-19", "\u5357\u30A2\u30EB\u30D7\u30B9\u5E02"],
  ["192091", "JP-19", "\u5317\u675C\u5E02"],
  ["192104", "JP-19", "\u7532\u6590\u5E02"],
  ["192112", "JP-19", "\u7B1B\u5439\u5E02"],
  ["192121", "JP-19", "\u4E0A\u91CE\u539F\u5E02"],
  ["192139", "JP-19", "\u7532\u5DDE\u5E02"],
  ["192147", "JP-19", "\u4E2D\u592E\u5E02"],
  ["193461", "JP-19", "\u5E02\u5DDD\u4E09\u90F7\u753A"],
  ["193640", "JP-19", "\u65E9\u5DDD\u753A"],
  ["193658", "JP-19", "\u8EAB\u5EF6\u753A"],
  ["193666", "JP-19", "\u5357\u90E8\u753A"],
  ["193682", "JP-19", "\u5BCC\u58EB\u5DDD\u753A"],
  ["193844", "JP-19", "\u662D\u548C\u753A"],
  ["194221", "JP-19", "\u9053\u5FD7\u6751"],
  ["194239", "JP-19", "\u897F\u6842\u753A"],
  ["194247", "JP-19", "\u5FCD\u91CE\u6751"],
  ["194255", "JP-19", "\u5C71\u4E2D\u6E56\u6751"],
  ["194298", "JP-19", "\u9CF4\u6CA2\u6751"],
  ["194301", "JP-19", "\u5BCC\u58EB\u6CB3\u53E3\u6E56\u753A"],
  ["194425", "JP-19", "\u5C0F\u83C5\u6751"],
  ["194433", "JP-19", "\u4E39\u6CE2\u5C71\u6751"],
  ["202011", "JP-20", "\u9577\u91CE\u5E02"],
  ["202029", "JP-20", "\u677E\u672C\u5E02"],
  ["202037", "JP-20", "\u4E0A\u7530\u5E02"],
  ["202045", "JP-20", "\u5CA1\u8C37\u5E02"],
  ["202053", "JP-20", "\u98EF\u7530\u5E02"],
  ["202061", "JP-20", "\u8ACF\u8A2A\u5E02"],
  ["202070", "JP-20", "\u9808\u5742\u5E02"],
  ["202088", "JP-20", "\u5C0F\u8AF8\u5E02"],
  ["202096", "JP-20", "\u4F0A\u90A3\u5E02"],
  ["202100", "JP-20", "\u99D2\u30F6\u6839\u5E02"],
  ["202118", "JP-20", "\u4E2D\u91CE\u5E02"],
  ["202126", "JP-20", "\u5927\u753A\u5E02"],
  ["202134", "JP-20", "\u98EF\u5C71\u5E02"],
  ["202142", "JP-20", "\u8305\u91CE\u5E02"],
  ["202151", "JP-20", "\u5869\u5C3B\u5E02"],
  ["202177", "JP-20", "\u4F50\u4E45\u5E02"],
  ["202185", "JP-20", "\u5343\u66F2\u5E02"],
  ["202193", "JP-20", "\u6771\u5FA1\u5E02"],
  ["202207", "JP-20", "\u5B89\u66C7\u91CE\u5E02"],
  ["203033", "JP-20", "\u5C0F\u6D77\u753A"],
  ["203041", "JP-20", "\u5DDD\u4E0A\u6751"],
  ["203050", "JP-20", "\u5357\u7267\u6751"],
  ["203068", "JP-20", "\u5357\u76F8\u6728\u6751"],
  ["203076", "JP-20", "\u5317\u76F8\u6728\u6751"],
  ["203092", "JP-20", "\u4F50\u4E45\u7A42\u753A"],
  ["203211", "JP-20", "\u8EFD\u4E95\u6CA2\u753A"],
  ["203238", "JP-20", "\u5FA1\u4EE3\u7530\u753A"],
  ["203246", "JP-20", "\u7ACB\u79D1\u753A"],
  ["203491", "JP-20", "\u9752\u6728\u6751"],
  ["203505", "JP-20", "\u9577\u548C\u753A"],
  ["203611", "JP-20", "\u4E0B\u8ACF\u8A2A\u753A"],
  ["203629", "JP-20", "\u5BCC\u58EB\u898B\u753A"],
  ["203637", "JP-20", "\u539F\u6751"],
  ["203823", "JP-20", "\u8FB0\u91CE\u753A"],
  ["203831", "JP-20", "\u7B95\u8F2A\u753A"],
  ["203840", "JP-20", "\u98EF\u5CF6\u753A"],
  ["203858", "JP-20", "\u5357\u7B95\u8F2A\u6751"],
  ["203866", "JP-20", "\u4E2D\u5DDD\u6751"],
  ["203882", "JP-20", "\u5BAE\u7530\u6751"],
  ["204021", "JP-20", "\u677E\u5DDD\u753A"],
  ["204030", "JP-20", "\u9AD8\u68EE\u753A"],
  ["204048", "JP-20", "\u963F\u5357\u753A"],
  ["204072", "JP-20", "\u963F\u667A\u6751"],
  ["204099", "JP-20", "\u5E73\u8C37\u6751"],
  ["204102", "JP-20", "\u6839\u7FBD\u6751"],
  ["204111", "JP-20", "\u4E0B\u689D\u6751"],
  ["204129", "JP-20", "\u58F2\u6728\u6751"],
  ["204137", "JP-20", "\u5929\u9F8D\u6751"],
  ["204145", "JP-20", "\u6CF0\u961C\u6751"],
  ["204153", "JP-20", "\u55AC\u6728\u6751"],
  ["204161", "JP-20", "\u8C4A\u4E18\u6751"],
  ["204170", "JP-20", "\u5927\u9E7F\u6751"],
  ["204226", "JP-20", "\u4E0A\u677E\u753A"],
  ["204234", "JP-20", "\u5357\u6728\u66FD\u753A"],
  ["204251", "JP-20", "\u6728\u7956\u6751"],
  ["204293", "JP-20", "\u738B\u6EDD\u6751"],
  ["204307", "JP-20", "\u5927\u6851\u6751"],
  ["204323", "JP-20", "\u6728\u66FD\u753A"],
  ["204463", "JP-20", "\u9EBB\u7E3E\u6751"],
  ["204480", "JP-20", "\u751F\u5742\u6751"],
  ["204501", "JP-20", "\u5C71\u5F62\u6751"],
  ["204510", "JP-20", "\u671D\u65E5\u6751"],
  ["204528", "JP-20", "\u7B51\u5317\u6751"],
  ["204811", "JP-20", "\u6C60\u7530\u753A"],
  ["204820", "JP-20", "\u677E\u5DDD\u6751"],
  ["204854", "JP-20", "\u767D\u99AC\u6751"],
  ["204862", "JP-20", "\u5C0F\u8C37\u6751"],
  ["205214", "JP-20", "\u5742\u57CE\u753A"],
  ["205419", "JP-20", "\u5C0F\u5E03\u65BD\u753A"],
  ["205435", "JP-20", "\u9AD8\u5C71\u6751"],
  ["205613", "JP-20", "\u5C71\u30CE\u5185\u753A"],
  ["205621", "JP-20", "\u6728\u5CF6\u5E73\u6751"],
  ["205630", "JP-20", "\u91CE\u6CA2\u6E29\u6CC9\u6751"],
  ["205834", "JP-20", "\u4FE1\u6FC3\u753A"],
  ["205885", "JP-20", "\u5C0F\u5DDD\u6751"],
  ["205907", "JP-20", "\u98EF\u7DB1\u753A"],
  ["206024", "JP-20", "\u6804\u6751"],
  ["212016", "JP-21", "\u5C90\u961C\u5E02"],
  ["212024", "JP-21", "\u5927\u57A3\u5E02"],
  ["212032", "JP-21", "\u9AD8\u5C71\u5E02"],
  ["212041", "JP-21", "\u591A\u6CBB\u898B\u5E02"],
  ["212059", "JP-21", "\u95A2\u5E02"],
  ["212067", "JP-21", "\u4E2D\u6D25\u5DDD\u5E02"],
  ["212075", "JP-21", "\u7F8E\u6FC3\u5E02"],
  ["212083", "JP-21", "\u745E\u6D6A\u5E02"],
  ["212091", "JP-21", "\u7FBD\u5CF6\u5E02"],
  ["212105", "JP-21", "\u6075\u90A3\u5E02"],
  ["212113", "JP-21", "\u7F8E\u6FC3\u52A0\u8302\u5E02"],
  ["212121", "JP-21", "\u571F\u5C90\u5E02"],
  ["212130", "JP-21", "\u5404\u52D9\u539F\u5E02"],
  ["212148", "JP-21", "\u53EF\u5150\u5E02"],
  ["212156", "JP-21", "\u5C71\u770C\u5E02"],
  ["212164", "JP-21", "\u745E\u7A42\u5E02"],
  ["212172", "JP-21", "\u98DB\u9A28\u5E02"],
  ["212181", "JP-21", "\u672C\u5DE3\u5E02"],
  ["212199", "JP-21", "\u90E1\u4E0A\u5E02"],
  ["212202", "JP-21", "\u4E0B\u5442\u5E02"],
  ["212211", "JP-21", "\u6D77\u6D25\u5E02"],
  ["213021", "JP-21", "\u5C90\u5357\u753A"],
  ["213039", "JP-21", "\u7B20\u677E\u753A"],
  ["213411", "JP-21", "\u990A\u8001\u753A"],
  ["213616", "JP-21", "\u5782\u4E95\u753A"],
  ["213624", "JP-21", "\u95A2\u30B1\u539F\u753A"],
  ["213811", "JP-21", "\u795E\u6238\u753A"],
  ["213829", "JP-21", "\u8F2A\u4E4B\u5185\u753A"],
  ["213837", "JP-21", "\u5B89\u516B\u753A"],
  ["214019", "JP-21", "\u63D6\u6590\u5DDD\u753A"],
  ["214035", "JP-21", "\u5927\u91CE\u753A"],
  ["214043", "JP-21", "\u6C60\u7530\u753A"],
  ["214213", "JP-21", "\u5317\u65B9\u753A"],
  ["215015", "JP-21", "\u5742\u795D\u753A"],
  ["215023", "JP-21", "\u5BCC\u52A0\u753A"],
  ["215031", "JP-21", "\u5DDD\u8FBA\u753A"],
  ["215040", "JP-21", "\u4E03\u5B97\u753A"],
  ["215058", "JP-21", "\u516B\u767E\u6D25\u753A"],
  ["215066", "JP-21", "\u767D\u5DDD\u753A"],
  ["215074", "JP-21", "\u6771\u767D\u5DDD\u6751"],
  ["215210", "JP-21", "\u5FA1\u5D69\u753A"],
  ["216046", "JP-21", "\u767D\u5DDD\u6751"],
  ["221007", "JP-22", "\u9759\u5CA1\u5E02"],
  ["221015", "JP-22", "\u9759\u5CA1\u5E02\u8475\u533A"],
  ["221023", "JP-22", "\u9759\u5CA1\u5E02\u99FF\u6CB3\u533A"],
  ["221031", "JP-22", "\u9759\u5CA1\u5E02\u6E05\u6C34\u533A"],
  ["221309", "JP-22", "\u6D5C\u677E\u5E02"],
  ["221384", "JP-22", "\u6D5C\u677E\u5E02\u4E2D\u592E\u533A"],
  ["221392", "JP-22", "\u6D5C\u677E\u5E02\u6D5C\u540D\u533A"],
  ["221406", "JP-22", "\u6D5C\u677E\u5E02\u5929\u7ADC\u533A"],
  ["222038", "JP-22", "\u6CBC\u6D25\u5E02"],
  ["222054", "JP-22", "\u71B1\u6D77\u5E02"],
  ["222062", "JP-22", "\u4E09\u5CF6\u5E02"],
  ["222071", "JP-22", "\u5BCC\u58EB\u5BAE\u5E02"],
  ["222089", "JP-22", "\u4F0A\u6771\u5E02"],
  ["222097", "JP-22", "\u5CF6\u7530\u5E02"],
  ["222101", "JP-22", "\u5BCC\u58EB\u5E02"],
  ["222119", "JP-22", "\u78D0\u7530\u5E02"],
  ["222127", "JP-22", "\u713C\u6D25\u5E02"],
  ["222135", "JP-22", "\u639B\u5DDD\u5E02"],
  ["222143", "JP-22", "\u85E4\u679D\u5E02"],
  ["222151", "JP-22", "\u5FA1\u6BBF\u5834\u5E02"],
  ["222160", "JP-22", "\u888B\u4E95\u5E02"],
  ["222194", "JP-22", "\u4E0B\u7530\u5E02"],
  ["222208", "JP-22", "\u88FE\u91CE\u5E02"],
  ["222216", "JP-22", "\u6E56\u897F\u5E02"],
  ["222224", "JP-22", "\u4F0A\u8C46\u5E02"],
  ["222232", "JP-22", "\u5FA1\u524D\u5D0E\u5E02"],
  ["222241", "JP-22", "\u83CA\u5DDD\u5E02"],
  ["222259", "JP-22", "\u4F0A\u8C46\u306E\u56FD\u5E02"],
  ["222267", "JP-22", "\u7267\u4E4B\u539F\u5E02"],
  ["223018", "JP-22", "\u6771\u4F0A\u8C46\u753A"],
  ["223026", "JP-22", "\u6CB3\u6D25\u753A"],
  ["223042", "JP-22", "\u5357\u4F0A\u8C46\u753A"],
  ["223051", "JP-22", "\u677E\u5D0E\u753A"],
  ["223069", "JP-22", "\u897F\u4F0A\u8C46\u753A"],
  ["223255", "JP-22", "\u51FD\u5357\u753A"],
  ["223417", "JP-22", "\u6E05\u6C34\u753A"],
  ["223425", "JP-22", "\u9577\u6CC9\u753A"],
  ["223441", "JP-22", "\u5C0F\u5C71\u753A"],
  ["224243", "JP-22", "\u5409\u7530\u753A"],
  ["224294", "JP-22", "\u5DDD\u6839\u672C\u753A"],
  ["224618", "JP-22", "\u68EE\u753A"],
  ["231002", "JP-23", "\u540D\u53E4\u5C4B\u5E02"],
  ["231011", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u5343\u7A2E\u533A"],
  ["231029", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u6771\u533A"],
  ["231037", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u5317\u533A"],
  ["231045", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u897F\u533A"],
  ["231053", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u4E2D\u6751\u533A"],
  ["231061", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u4E2D\u533A"],
  ["231070", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u662D\u548C\u533A"],
  ["231088", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u745E\u7A42\u533A"],
  ["231096", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u71B1\u7530\u533A"],
  ["231100", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u4E2D\u5DDD\u533A"],
  ["231118", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u6E2F\u533A"],
  ["231126", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u5357\u533A"],
  ["231134", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u5B88\u5C71\u533A"],
  ["231142", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u7DD1\u533A"],
  ["231151", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u540D\u6771\u533A"],
  ["231169", "JP-23", "\u540D\u53E4\u5C4B\u5E02\u5929\u767D\u533A"],
  ["232017", "JP-23", "\u8C4A\u6A4B\u5E02"],
  ["232025", "JP-23", "\u5CA1\u5D0E\u5E02"],
  ["232033", "JP-23", "\u4E00\u5BAE\u5E02"],
  ["232041", "JP-23", "\u702C\u6238\u5E02"],
  ["232050", "JP-23", "\u534A\u7530\u5E02"],
  ["232068", "JP-23", "\u6625\u65E5\u4E95\u5E02"],
  ["232076", "JP-23", "\u8C4A\u5DDD\u5E02"],
  ["232084", "JP-23", "\u6D25\u5CF6\u5E02"],
  ["232092", "JP-23", "\u78A7\u5357\u5E02"],
  ["232106", "JP-23", "\u5208\u8C37\u5E02"],
  ["232114", "JP-23", "\u8C4A\u7530\u5E02"],
  ["232122", "JP-23", "\u5B89\u57CE\u5E02"],
  ["232131", "JP-23", "\u897F\u5C3E\u5E02"],
  ["232149", "JP-23", "\u84B2\u90E1\u5E02"],
  ["232157", "JP-23", "\u72AC\u5C71\u5E02"],
  ["232165", "JP-23", "\u5E38\u6ED1\u5E02"],
  ["232173", "JP-23", "\u6C5F\u5357\u5E02"],
  ["232190", "JP-23", "\u5C0F\u7267\u5E02"],
  ["232203", "JP-23", "\u7A32\u6CA2\u5E02"],
  ["232211", "JP-23", "\u65B0\u57CE\u5E02"],
  ["232220", "JP-23", "\u6771\u6D77\u5E02"],
  ["232238", "JP-23", "\u5927\u5E9C\u5E02"],
  ["232246", "JP-23", "\u77E5\u591A\u5E02"],
  ["232254", "JP-23", "\u77E5\u7ACB\u5E02"],
  ["232262", "JP-23", "\u5C3E\u5F35\u65ED\u5E02"],
  ["232271", "JP-23", "\u9AD8\u6D5C\u5E02"],
  ["232289", "JP-23", "\u5CA9\u5009\u5E02"],
  ["232297", "JP-23", "\u8C4A\u660E\u5E02"],
  ["232301", "JP-23", "\u65E5\u9032\u5E02"],
  ["232319", "JP-23", "\u7530\u539F\u5E02"],
  ["232327", "JP-23", "\u611B\u897F\u5E02"],
  ["232335", "JP-23", "\u6E05\u9808\u5E02"],
  ["232343", "JP-23", "\u5317\u540D\u53E4\u5C4B\u5E02"],
  ["232351", "JP-23", "\u5F25\u5BCC\u5E02"],
  ["232360", "JP-23", "\u307F\u3088\u3057\u5E02"],
  ["232378", "JP-23", "\u3042\u307E\u5E02"],
  ["232386", "JP-23", "\u9577\u4E45\u624B\u5E02"],
  ["233021", "JP-23", "\u6771\u90F7\u753A"],
  ["233421", "JP-23", "\u8C4A\u5C71\u753A"],
  ["233617", "JP-23", "\u5927\u53E3\u753A"],
  ["233625", "JP-23", "\u6276\u6851\u753A"],
  ["234249", "JP-23", "\u5927\u6CBB\u753A"],
  ["234257", "JP-23", "\u87F9\u6C5F\u753A"],
  ["234273", "JP-23", "\u98DB\u5CF6\u6751"],
  ["234419", "JP-23", "\u963F\u4E45\u6BD4\u753A"],
  ["234427", "JP-23", "\u6771\u6D66\u753A"],
  ["234451", "JP-23", "\u5357\u77E5\u591A\u753A"],
  ["234460", "JP-23", "\u7F8E\u6D5C\u753A"],
  ["234478", "JP-23", "\u6B66\u8C4A\u753A"],
  ["235016", "JP-23", "\u5E78\u7530\u753A"],
  ["235610", "JP-23", "\u8A2D\u697D\u753A"],
  ["235628", "JP-23", "\u6771\u6804\u753A"],
  ["235636", "JP-23", "\u8C4A\u6839\u6751"],
  ["242012", "JP-24", "\u6D25\u5E02"],
  ["242021", "JP-24", "\u56DB\u65E5\u5E02\u5E02"],
  ["242039", "JP-24", "\u4F0A\u52E2\u5E02"],
  ["242047", "JP-24", "\u677E\u962A\u5E02"],
  ["242055", "JP-24", "\u6851\u540D\u5E02"],
  ["242071", "JP-24", "\u9234\u9E7F\u5E02"],
  ["242080", "JP-24", "\u540D\u5F35\u5E02"],
  ["242098", "JP-24", "\u5C3E\u9DF2\u5E02"],
  ["242101", "JP-24", "\u4E80\u5C71\u5E02"],
  ["242110", "JP-24", "\u9CE5\u7FBD\u5E02"],
  ["242128", "JP-24", "\u718A\u91CE\u5E02"],
  ["242144", "JP-24", "\u3044\u306A\u3079\u5E02"],
  ["242152", "JP-24", "\u5FD7\u6469\u5E02"],
  ["242161", "JP-24", "\u4F0A\u8CC0\u5E02"],
  ["243035", "JP-24", "\u6728\u66FD\u5CAC\u753A"],
  ["243248", "JP-24", "\u6771\u54E1\u753A"],
  ["243418", "JP-24", "\u83F0\u91CE\u753A"],
  ["243434", "JP-24", "\u671D\u65E5\u753A"],
  ["243442", "JP-24", "\u5DDD\u8D8A\u753A"],
  ["244414", "JP-24", "\u591A\u6C17\u753A"],
  ["244422", "JP-24", "\u660E\u548C\u753A"],
  ["244431", "JP-24", "\u5927\u53F0\u753A"],
  ["244619", "JP-24", "\u7389\u57CE\u753A"],
  ["244708", "JP-24", "\u5EA6\u4F1A\u753A"],
  ["244716", "JP-24", "\u5927\u7D00\u753A"],
  ["244724", "JP-24", "\u5357\u4F0A\u52E2\u753A"],
  ["245437", "JP-24", "\u7D00\u5317\u753A"],
  ["245615", "JP-24", "\u5FA1\u6D5C\u753A"],
  ["245623", "JP-24", "\u7D00\u5B9D\u753A"],
  ["252018", "JP-25", "\u5927\u6D25\u5E02"],
  ["252026", "JP-25", "\u5F66\u6839\u5E02"],
  ["252034", "JP-25", "\u9577\u6D5C\u5E02"],
  ["252042", "JP-25", "\u8FD1\u6C5F\u516B\u5E61\u5E02"],
  ["252069", "JP-25", "\u8349\u6D25\u5E02"],
  ["252077", "JP-25", "\u5B88\u5C71\u5E02"],
  ["252085", "JP-25", "\u6817\u6771\u5E02"],
  ["252093", "JP-25", "\u7532\u8CC0\u5E02"],
  ["252107", "JP-25", "\u91CE\u6D32\u5E02"],
  ["252115", "JP-25", "\u6E56\u5357\u5E02"],
  ["252123", "JP-25", "\u9AD8\u5CF6\u5E02"],
  ["252131", "JP-25", "\u6771\u8FD1\u6C5F\u5E02"],
  ["252140", "JP-25", "\u7C73\u539F\u5E02"],
  ["253839", "JP-25", "\u65E5\u91CE\u753A"],
  ["253847", "JP-25", "\u7ADC\u738B\u753A"],
  ["254258", "JP-25", "\u611B\u8358\u753A"],
  ["254410", "JP-25", "\u8C4A\u90F7\u753A"],
  ["254428", "JP-25", "\u7532\u826F\u753A"],
  ["254436", "JP-25", "\u591A\u8CC0\u753A"],
  ["261009", "JP-26", "\u4EAC\u90FD\u5E02"],
  ["261017", "JP-26", "\u4EAC\u90FD\u5E02\u5317\u533A"],
  ["261025", "JP-26", "\u4EAC\u90FD\u5E02\u4E0A\u4EAC\u533A"],
  ["261033", "JP-26", "\u4EAC\u90FD\u5E02\u5DE6\u4EAC\u533A"],
  ["261041", "JP-26", "\u4EAC\u90FD\u5E02\u4E2D\u4EAC\u533A"],
  ["261050", "JP-26", "\u4EAC\u90FD\u5E02\u6771\u5C71\u533A"],
  ["261068", "JP-26", "\u4EAC\u90FD\u5E02\u4E0B\u4EAC\u533A"],
  ["261076", "JP-26", "\u4EAC\u90FD\u5E02\u5357\u533A"],
  ["261084", "JP-26", "\u4EAC\u90FD\u5E02\u53F3\u4EAC\u533A"],
  ["261092", "JP-26", "\u4EAC\u90FD\u5E02\u4F0F\u898B\u533A"],
  ["261106", "JP-26", "\u4EAC\u90FD\u5E02\u5C71\u79D1\u533A"],
  ["261114", "JP-26", "\u4EAC\u90FD\u5E02\u897F\u4EAC\u533A"],
  ["262013", "JP-26", "\u798F\u77E5\u5C71\u5E02"],
  ["262021", "JP-26", "\u821E\u9DB4\u5E02"],
  ["262030", "JP-26", "\u7DBE\u90E8\u5E02"],
  ["262048", "JP-26", "\u5B87\u6CBB\u5E02"],
  ["262056", "JP-26", "\u5BAE\u6D25\u5E02"],
  ["262064", "JP-26", "\u4E80\u5CA1\u5E02"],
  ["262072", "JP-26", "\u57CE\u967D\u5E02"],
  ["262081", "JP-26", "\u5411\u65E5\u5E02"],
  ["262099", "JP-26", "\u9577\u5CA1\u4EAC\u5E02"],
  ["262102", "JP-26", "\u516B\u5E61\u5E02"],
  ["262111", "JP-26", "\u4EAC\u7530\u8FBA\u5E02"],
  ["262129", "JP-26", "\u4EAC\u4E39\u5F8C\u5E02"],
  ["262137", "JP-26", "\u5357\u4E39\u5E02"],
  ["262145", "JP-26", "\u6728\u6D25\u5DDD\u5E02"],
  ["263036", "JP-26", "\u5927\u5C71\u5D0E\u753A"],
  ["263222", "JP-26", "\u4E45\u5FA1\u5C71\u753A"],
  ["263435", "JP-26", "\u4E95\u624B\u753A"],
  ["263443", "JP-26", "\u5B87\u6CBB\u7530\u539F\u753A"],
  ["263648", "JP-26", "\u7B20\u7F6E\u753A"],
  ["263656", "JP-26", "\u548C\u675F\u753A"],
  ["263664", "JP-26", "\u7CBE\u83EF\u753A"],
  ["263672", "JP-26", "\u5357\u5C71\u57CE\u6751"],
  ["264075", "JP-26", "\u4EAC\u4E39\u6CE2\u753A"],
  ["264636", "JP-26", "\u4F0A\u6839\u753A"],
  ["264652", "JP-26", "\u4E0E\u8B1D\u91CE\u753A"],
  ["271004", "JP-27", "\u5927\u962A\u5E02"],
  ["271021", "JP-27", "\u5927\u962A\u5E02\u90FD\u5CF6\u533A"],
  ["271039", "JP-27", "\u5927\u962A\u5E02\u798F\u5CF6\u533A"],
  ["271047", "JP-27", "\u5927\u962A\u5E02\u6B64\u82B1\u533A"],
  ["271063", "JP-27", "\u5927\u962A\u5E02\u897F\u533A"],
  ["271071", "JP-27", "\u5927\u962A\u5E02\u6E2F\u533A"],
  ["271080", "JP-27", "\u5927\u962A\u5E02\u5927\u6B63\u533A"],
  ["271098", "JP-27", "\u5927\u962A\u5E02\u5929\u738B\u5BFA\u533A"],
  ["271110", "JP-27", "\u5927\u962A\u5E02\u6D6A\u901F\u533A"],
  ["271136", "JP-27", "\u5927\u962A\u5E02\u897F\u6DC0\u5DDD\u533A"],
  ["271144", "JP-27", "\u5927\u962A\u5E02\u6771\u6DC0\u5DDD\u533A"],
  ["271152", "JP-27", "\u5927\u962A\u5E02\u6771\u6210\u533A"],
  ["271161", "JP-27", "\u5927\u962A\u5E02\u751F\u91CE\u533A"],
  ["271179", "JP-27", "\u5927\u962A\u5E02\u65ED\u533A"],
  ["271187", "JP-27", "\u5927\u962A\u5E02\u57CE\u6771\u533A"],
  ["271195", "JP-27", "\u5927\u962A\u5E02\u963F\u500D\u91CE\u533A"],
  ["271209", "JP-27", "\u5927\u962A\u5E02\u4F4F\u5409\u533A"],
  ["271217", "JP-27", "\u5927\u962A\u5E02\u6771\u4F4F\u5409\u533A"],
  ["271225", "JP-27", "\u5927\u962A\u5E02\u897F\u6210\u533A"],
  ["271233", "JP-27", "\u5927\u962A\u5E02\u6DC0\u5DDD\u533A"],
  ["271241", "JP-27", "\u5927\u962A\u5E02\u9DB4\u898B\u533A"],
  ["271250", "JP-27", "\u5927\u962A\u5E02\u4F4F\u4E4B\u6C5F\u533A"],
  ["271268", "JP-27", "\u5927\u962A\u5E02\u5E73\u91CE\u533A"],
  ["271276", "JP-27", "\u5927\u962A\u5E02\u5317\u533A"],
  ["271284", "JP-27", "\u5927\u962A\u5E02\u4E2D\u592E\u533A"],
  ["271403", "JP-27", "\u583A\u5E02"],
  ["271411", "JP-27", "\u583A\u5E02\u583A\u533A"],
  ["271420", "JP-27", "\u583A\u5E02\u4E2D\u533A"],
  ["271438", "JP-27", "\u583A\u5E02\u6771\u533A"],
  ["271446", "JP-27", "\u583A\u5E02\u897F\u533A"],
  ["271454", "JP-27", "\u583A\u5E02\u5357\u533A"],
  ["271462", "JP-27", "\u583A\u5E02\u5317\u533A"],
  ["271471", "JP-27", "\u583A\u5E02\u7F8E\u539F\u533A"],
  ["272027", "JP-27", "\u5CB8\u548C\u7530\u5E02"],
  ["272035", "JP-27", "\u8C4A\u4E2D\u5E02"],
  ["272043", "JP-27", "\u6C60\u7530\u5E02"],
  ["272051", "JP-27", "\u5439\u7530\u5E02"],
  ["272060", "JP-27", "\u6CC9\u5927\u6D25\u5E02"],
  ["272078", "JP-27", "\u9AD8\u69FB\u5E02"],
  ["272086", "JP-27", "\u8C9D\u585A\u5E02"],
  ["272094", "JP-27", "\u5B88\u53E3\u5E02"],
  ["272108", "JP-27", "\u679A\u65B9\u5E02"],
  ["272116", "JP-27", "\u8328\u6728\u5E02"],
  ["272124", "JP-27", "\u516B\u5C3E\u5E02"],
  ["272132", "JP-27", "\u6CC9\u4F50\u91CE\u5E02"],
  ["272141", "JP-27", "\u5BCC\u7530\u6797\u5E02"],
  ["272159", "JP-27", "\u5BDD\u5C4B\u5DDD\u5E02"],
  ["272167", "JP-27", "\u6CB3\u5185\u9577\u91CE\u5E02"],
  ["272175", "JP-27", "\u677E\u539F\u5E02"],
  ["272183", "JP-27", "\u5927\u6771\u5E02"],
  ["272191", "JP-27", "\u548C\u6CC9\u5E02"],
  ["272205", "JP-27", "\u7B95\u9762\u5E02"],
  ["272213", "JP-27", "\u67CF\u539F\u5E02"],
  ["272221", "JP-27", "\u7FBD\u66F3\u91CE\u5E02"],
  ["272230", "JP-27", "\u9580\u771F\u5E02"],
  ["272248", "JP-27", "\u6442\u6D25\u5E02"],
  ["272256", "JP-27", "\u9AD8\u77F3\u5E02"],
  ["272264", "JP-27", "\u85E4\u4E95\u5BFA\u5E02"],
  ["272272", "JP-27", "\u6771\u5927\u962A\u5E02"],
  ["272281", "JP-27", "\u6CC9\u5357\u5E02"],
  ["272299", "JP-27", "\u56DB\u689D\u7577\u5E02"],
  ["272302", "JP-27", "\u4EA4\u91CE\u5E02"],
  ["272311", "JP-27", "\u5927\u962A\u72ED\u5C71\u5E02"],
  ["272329", "JP-27", "\u962A\u5357\u5E02"],
  ["273015", "JP-27", "\u5CF6\u672C\u753A"],
  ["273210", "JP-27", "\u8C4A\u80FD\u753A"],
  ["273228", "JP-27", "\u80FD\u52E2\u753A"],
  ["273414", "JP-27", "\u5FE0\u5CA1\u753A"],
  ["273619", "JP-27", "\u718A\u53D6\u753A"],
  ["273627", "JP-27", "\u7530\u5C3B\u753A"],
  ["273660", "JP-27", "\u5CAC\u753A"],
  ["273813", "JP-27", "\u592A\u5B50\u753A"],
  ["273821", "JP-27", "\u6CB3\u5357\u753A"],
  ["273830", "JP-27", "\u5343\u65E9\u8D64\u962A\u6751"],
  ["281000", "JP-28", "\u795E\u6238\u5E02"],
  ["281018", "JP-28", "\u795E\u6238\u5E02\u6771\u7058\u533A"],
  ["281026", "JP-28", "\u795E\u6238\u5E02\u7058\u533A"],
  ["281051", "JP-28", "\u795E\u6238\u5E02\u5175\u5EAB\u533A"],
  ["281069", "JP-28", "\u795E\u6238\u5E02\u9577\u7530\u533A"],
  ["281077", "JP-28", "\u795E\u6238\u5E02\u9808\u78E8\u533A"],
  ["281085", "JP-28", "\u795E\u6238\u5E02\u5782\u6C34\u533A"],
  ["281093", "JP-28", "\u795E\u6238\u5E02\u5317\u533A"],
  ["281107", "JP-28", "\u795E\u6238\u5E02\u4E2D\u592E\u533A"],
  ["281115", "JP-28", "\u795E\u6238\u5E02\u897F\u533A"],
  ["282014", "JP-28", "\u59EB\u8DEF\u5E02"],
  ["282022", "JP-28", "\u5C3C\u5D0E\u5E02"],
  ["282031", "JP-28", "\u660E\u77F3\u5E02"],
  ["282049", "JP-28", "\u897F\u5BAE\u5E02"],
  ["282057", "JP-28", "\u6D32\u672C\u5E02"],
  ["282065", "JP-28", "\u82A6\u5C4B\u5E02"],
  ["282073", "JP-28", "\u4F0A\u4E39\u5E02"],
  ["282081", "JP-28", "\u76F8\u751F\u5E02"],
  ["282090", "JP-28", "\u8C4A\u5CA1\u5E02"],
  ["282103", "JP-28", "\u52A0\u53E4\u5DDD\u5E02"],
  ["282120", "JP-28", "\u8D64\u7A42\u5E02"],
  ["282138", "JP-28", "\u897F\u8107\u5E02"],
  ["282146", "JP-28", "\u5B9D\u585A\u5E02"],
  ["282154", "JP-28", "\u4E09\u6728\u5E02"],
  ["282162", "JP-28", "\u9AD8\u7802\u5E02"],
  ["282171", "JP-28", "\u5DDD\u897F\u5E02"],
  ["282189", "JP-28", "\u5C0F\u91CE\u5E02"],
  ["282197", "JP-28", "\u4E09\u7530\u5E02"],
  ["282201", "JP-28", "\u52A0\u897F\u5E02"],
  ["282219", "JP-28", "\u4E39\u6CE2\u7BE0\u5C71\u5E02"],
  ["282227", "JP-28", "\u990A\u7236\u5E02"],
  ["282235", "JP-28", "\u4E39\u6CE2\u5E02"],
  ["282243", "JP-28", "\u5357\u3042\u308F\u3058\u5E02"],
  ["282251", "JP-28", "\u671D\u6765\u5E02"],
  ["282260", "JP-28", "\u6DE1\u8DEF\u5E02"],
  ["282278", "JP-28", "\u5B8D\u7C9F\u5E02"],
  ["282286", "JP-28", "\u52A0\u6771\u5E02"],
  ["282294", "JP-28", "\u305F\u3064\u306E\u5E02"],
  ["283011", "JP-28", "\u732A\u540D\u5DDD\u753A"],
  ["283657", "JP-28", "\u591A\u53EF\u753A"],
  ["283819", "JP-28", "\u7A32\u7F8E\u753A"],
  ["283827", "JP-28", "\u64AD\u78E8\u753A"],
  ["284424", "JP-28", "\u5E02\u5DDD\u753A"],
  ["284432", "JP-28", "\u798F\u5D0E\u753A"],
  ["284467", "JP-28", "\u795E\u6CB3\u753A"],
  ["284645", "JP-28", "\u592A\u5B50\u753A"],
  ["284815", "JP-28", "\u4E0A\u90E1\u753A"],
  ["285013", "JP-28", "\u4F50\u7528\u753A"],
  ["285854", "JP-28", "\u9999\u7F8E\u753A"],
  ["285862", "JP-28", "\u65B0\u6E29\u6CC9\u753A"],
  ["292010", "JP-29", "\u5948\u826F\u5E02"],
  ["292028", "JP-29", "\u5927\u548C\u9AD8\u7530\u5E02"],
  ["292036", "JP-29", "\u5927\u548C\u90E1\u5C71\u5E02"],
  ["292044", "JP-29", "\u5929\u7406\u5E02"],
  ["292052", "JP-29", "\u6A7F\u539F\u5E02"],
  ["292061", "JP-29", "\u685C\u4E95\u5E02"],
  ["292079", "JP-29", "\u4E94\u689D\u5E02"],
  ["292087", "JP-29", "\u5FA1\u6240\u5E02"],
  ["292095", "JP-29", "\u751F\u99D2\u5E02"],
  ["292109", "JP-29", "\u9999\u829D\u5E02"],
  ["292117", "JP-29", "\u845B\u57CE\u5E02"],
  ["292125", "JP-29", "\u5B87\u9640\u5E02"],
  ["293229", "JP-29", "\u5C71\u6DFB\u6751"],
  ["293423", "JP-29", "\u5E73\u7FA4\u753A"],
  ["293431", "JP-29", "\u4E09\u90F7\u753A"],
  ["293440", "JP-29", "\u6591\u9CE9\u753A"],
  ["293458", "JP-29", "\u5B89\u5835\u753A"],
  ["293610", "JP-29", "\u5DDD\u897F\u753A"],
  ["293628", "JP-29", "\u4E09\u5B85\u753A"],
  ["293636", "JP-29", "\u7530\u539F\u672C\u753A"],
  ["293857", "JP-29", "\u66FD\u723E\u6751"],
  ["293865", "JP-29", "\u5FA1\u6756\u6751"],
  ["294012", "JP-29", "\u9AD8\u53D6\u753A"],
  ["294021", "JP-29", "\u660E\u65E5\u9999\u6751"],
  ["294241", "JP-29", "\u4E0A\u7267\u753A"],
  ["294250", "JP-29", "\u738B\u5BFA\u753A"],
  ["294268", "JP-29", "\u5E83\u9675\u753A"],
  ["294276", "JP-29", "\u6CB3\u5408\u753A"],
  ["294411", "JP-29", "\u5409\u91CE\u753A"],
  ["294420", "JP-29", "\u5927\u6DC0\u753A"],
  ["294438", "JP-29", "\u4E0B\u5E02\u753A"],
  ["294446", "JP-29", "\u9ED2\u6EDD\u6751"],
  ["294462", "JP-29", "\u5929\u5DDD\u6751"],
  ["294471", "JP-29", "\u91CE\u8FEB\u5DDD\u6751"],
  ["294497", "JP-29", "\u5341\u6D25\u5DDD\u6751"],
  ["294501", "JP-29", "\u4E0B\u5317\u5C71\u6751"],
  ["294519", "JP-29", "\u4E0A\u5317\u5C71\u6751"],
  ["294527", "JP-29", "\u5DDD\u4E0A\u6751"],
  ["294535", "JP-29", "\u6771\u5409\u91CE\u6751"],
  ["302015", "JP-30", "\u548C\u6B4C\u5C71\u5E02"],
  ["302023", "JP-30", "\u6D77\u5357\u5E02"],
  ["302031", "JP-30", "\u6A4B\u672C\u5E02"],
  ["302040", "JP-30", "\u6709\u7530\u5E02"],
  ["302058", "JP-30", "\u5FA1\u574A\u5E02"],
  ["302066", "JP-30", "\u7530\u8FBA\u5E02"],
  ["302074", "JP-30", "\u65B0\u5BAE\u5E02"],
  ["302082", "JP-30", "\u7D00\u306E\u5DDD\u5E02"],
  ["302091", "JP-30", "\u5CA9\u51FA\u5E02"],
  ["303046", "JP-30", "\u7D00\u7F8E\u91CE\u753A"],
  ["303411", "JP-30", "\u304B\u3064\u3089\u304E\u753A"],
  ["303437", "JP-30", "\u4E5D\u5EA6\u5C71\u753A"],
  ["303445", "JP-30", "\u9AD8\u91CE\u753A"],
  ["303615", "JP-30", "\u6E6F\u6D45\u753A"],
  ["303623", "JP-30", "\u5E83\u5DDD\u753A"],
  ["303666", "JP-30", "\u6709\u7530\u5DDD\u753A"],
  ["303810", "JP-30", "\u7F8E\u6D5C\u753A"],
  ["303828", "JP-30", "\u65E5\u9AD8\u753A"],
  ["303836", "JP-30", "\u7531\u826F\u753A"],
  ["303909", "JP-30", "\u5370\u5357\u753A"],
  ["303917", "JP-30", "\u307F\u306A\u3079\u753A"],
  ["303925", "JP-30", "\u65E5\u9AD8\u5DDD\u753A"],
  ["304018", "JP-30", "\u767D\u6D5C\u753A"],
  ["304042", "JP-30", "\u4E0A\u5BCC\u7530\u753A"],
  ["304069", "JP-30", "\u3059\u3055\u307F\u753A"],
  ["304212", "JP-30", "\u90A3\u667A\u52DD\u6D66\u753A"],
  ["304221", "JP-30", "\u592A\u5730\u753A"],
  ["304247", "JP-30", "\u53E4\u5EA7\u5DDD\u753A"],
  ["304271", "JP-30", "\u5317\u5C71\u6751"],
  ["304280", "JP-30", "\u4E32\u672C\u753A"],
  ["312011", "JP-31", "\u9CE5\u53D6\u5E02"],
  ["312029", "JP-31", "\u7C73\u5B50\u5E02"],
  ["312037", "JP-31", "\u5009\u5409\u5E02"],
  ["312045", "JP-31", "\u5883\u6E2F\u5E02"],
  ["313025", "JP-31", "\u5CA9\u7F8E\u753A"],
  ["313254", "JP-31", "\u82E5\u685C\u753A"],
  ["313289", "JP-31", "\u667A\u982D\u753A"],
  ["313297", "JP-31", "\u516B\u982D\u753A"],
  ["313645", "JP-31", "\u4E09\u671D\u753A"],
  ["313700", "JP-31", "\u6E6F\u68A8\u6D5C\u753A"],
  ["313718", "JP-31", "\u7434\u6D66\u753A"],
  ["313726", "JP-31", "\u5317\u6804\u753A"],
  ["313840", "JP-31", "\u65E5\u5409\u6D25\u6751"],
  ["313866", "JP-31", "\u5927\u5C71\u753A"],
  ["313891", "JP-31", "\u5357\u90E8\u753A"],
  ["313904", "JP-31", "\u4F2F\u8006\u753A"],
  ["314013", "JP-31", "\u65E5\u5357\u753A"],
  ["314021", "JP-31", "\u65E5\u91CE\u753A"],
  ["314030", "JP-31", "\u6C5F\u5E9C\u753A"],
  ["322016", "JP-32", "\u677E\u6C5F\u5E02"],
  ["322024", "JP-32", "\u6D5C\u7530\u5E02"],
  ["322032", "JP-32", "\u51FA\u96F2\u5E02"],
  ["322041", "JP-32", "\u76CA\u7530\u5E02"],
  ["322059", "JP-32", "\u5927\u7530\u5E02"],
  ["322067", "JP-32", "\u5B89\u6765\u5E02"],
  ["322075", "JP-32", "\u6C5F\u6D25\u5E02"],
  ["322091", "JP-32", "\u96F2\u5357\u5E02"],
  ["323438", "JP-32", "\u5965\u51FA\u96F2\u753A"],
  ["323861", "JP-32", "\u98EF\u5357\u753A"],
  ["324418", "JP-32", "\u5DDD\u672C\u753A"],
  ["324485", "JP-32", "\u7F8E\u90F7\u753A"],
  ["324493", "JP-32", "\u9091\u5357\u753A"],
  ["325015", "JP-32", "\u6D25\u548C\u91CE\u753A"],
  ["325058", "JP-32", "\u5409\u8CC0\u753A"],
  ["325252", "JP-32", "\u6D77\u58EB\u753A"],
  ["325261", "JP-32", "\u897F\u30CE\u5CF6\u753A"],
  ["325279", "JP-32", "\u77E5\u592B\u6751"],
  ["325287", "JP-32", "\u96A0\u5C90\u306E\u5CF6\u753A"],
  ["331007", "JP-33", "\u5CA1\u5C71\u5E02"],
  ["331015", "JP-33", "\u5CA1\u5C71\u5E02\u5317\u533A"],
  ["331023", "JP-33", "\u5CA1\u5C71\u5E02\u4E2D\u533A"],
  ["331031", "JP-33", "\u5CA1\u5C71\u5E02\u6771\u533A"],
  ["331040", "JP-33", "\u5CA1\u5C71\u5E02\u5357\u533A"],
  ["332020", "JP-33", "\u5009\u6577\u5E02"],
  ["332038", "JP-33", "\u6D25\u5C71\u5E02"],
  ["332046", "JP-33", "\u7389\u91CE\u5E02"],
  ["332054", "JP-33", "\u7B20\u5CA1\u5E02"],
  ["332071", "JP-33", "\u4E95\u539F\u5E02"],
  ["332089", "JP-33", "\u7DCF\u793E\u5E02"],
  ["332097", "JP-33", "\u9AD8\u6881\u5E02"],
  ["332101", "JP-33", "\u65B0\u898B\u5E02"],
  ["332119", "JP-33", "\u5099\u524D\u5E02"],
  ["332127", "JP-33", "\u702C\u6238\u5185\u5E02"],
  ["332135", "JP-33", "\u8D64\u78D0\u5E02"],
  ["332143", "JP-33", "\u771F\u5EAD\u5E02"],
  ["332151", "JP-33", "\u7F8E\u4F5C\u5E02"],
  ["332160", "JP-33", "\u6D45\u53E3\u5E02"],
  ["333468", "JP-33", "\u548C\u6C17\u753A"],
  ["334235", "JP-33", "\u65E9\u5CF6\u753A"],
  ["334456", "JP-33", "\u91CC\u5E84\u753A"],
  ["334618", "JP-33", "\u77E2\u639B\u753A"],
  ["335860", "JP-33", "\u65B0\u5E84\u6751"],
  ["336068", "JP-33", "\u93E1\u91CE\u753A"],
  ["336220", "JP-33", "\u52DD\u592E\u753A"],
  ["336238", "JP-33", "\u5948\u7FA9\u753A"],
  ["336432", "JP-33", "\u897F\u7C9F\u5009\u6751"],
  ["336637", "JP-33", "\u4E45\u7C73\u5357\u753A"],
  ["336661", "JP-33", "\u7F8E\u54B2\u753A"],
  ["336815", "JP-33", "\u5409\u5099\u4E2D\u592E\u753A"],
  ["341002", "JP-34", "\u5E83\u5CF6\u5E02"],
  ["341011", "JP-34", "\u5E83\u5CF6\u5E02\u4E2D\u533A"],
  ["341029", "JP-34", "\u5E83\u5CF6\u5E02\u6771\u533A"],
  ["341037", "JP-34", "\u5E83\u5CF6\u5E02\u5357\u533A"],
  ["341045", "JP-34", "\u5E83\u5CF6\u5E02\u897F\u533A"],
  ["341053", "JP-34", "\u5E83\u5CF6\u5E02\u5B89\u4F50\u5357\u533A"],
  ["341061", "JP-34", "\u5E83\u5CF6\u5E02\u5B89\u4F50\u5317\u533A"],
  ["341070", "JP-34", "\u5E83\u5CF6\u5E02\u5B89\u82B8\u533A"],
  ["341088", "JP-34", "\u5E83\u5CF6\u5E02\u4F50\u4F2F\u533A"],
  ["342025", "JP-34", "\u5449\u5E02"],
  ["342033", "JP-34", "\u7AF9\u539F\u5E02"],
  ["342041", "JP-34", "\u4E09\u539F\u5E02"],
  ["342050", "JP-34", "\u5C3E\u9053\u5E02"],
  ["342076", "JP-34", "\u798F\u5C71\u5E02"],
  ["342084", "JP-34", "\u5E9C\u4E2D\u5E02"],
  ["342092", "JP-34", "\u4E09\u6B21\u5E02"],
  ["342106", "JP-34", "\u5E84\u539F\u5E02"],
  ["342114", "JP-34", "\u5927\u7AF9\u5E02"],
  ["342122", "JP-34", "\u6771\u5E83\u5CF6\u5E02"],
  ["342131", "JP-34", "\u5EFF\u65E5\u5E02\u5E02"],
  ["342149", "JP-34", "\u5B89\u82B8\u9AD8\u7530\u5E02"],
  ["342157", "JP-34", "\u6C5F\u7530\u5CF6\u5E02"],
  ["343021", "JP-34", "\u5E9C\u4E2D\u753A"],
  ["343048", "JP-34", "\u6D77\u7530\u753A"],
  ["343072", "JP-34", "\u718A\u91CE\u753A"],
  ["343099", "JP-34", "\u5742\u753A"],
  ["343684", "JP-34", "\u5B89\u82B8\u592A\u7530\u753A"],
  ["343692", "JP-34", "\u5317\u5E83\u5CF6\u753A"],
  ["344311", "JP-34", "\u5927\u5D0E\u4E0A\u5CF6\u753A"],
  ["344621", "JP-34", "\u4E16\u7F85\u753A"],
  ["345458", "JP-34", "\u795E\u77F3\u9AD8\u539F\u753A"],
  ["352012", "JP-35", "\u4E0B\u95A2\u5E02"],
  ["352021", "JP-35", "\u5B87\u90E8\u5E02"],
  ["352039", "JP-35", "\u5C71\u53E3\u5E02"],
  ["352047", "JP-35", "\u8429\u5E02"],
  ["352063", "JP-35", "\u9632\u5E9C\u5E02"],
  ["352071", "JP-35", "\u4E0B\u677E\u5E02"],
  ["352080", "JP-35", "\u5CA9\u56FD\u5E02"],
  ["352101", "JP-35", "\u5149\u5E02"],
  ["352110", "JP-35", "\u9577\u9580\u5E02"],
  ["352128", "JP-35", "\u67F3\u4E95\u5E02"],
  ["352136", "JP-35", "\u7F8E\u7962\u5E02"],
  ["352152", "JP-35", "\u5468\u5357\u5E02"],
  ["352161", "JP-35", "\u5C71\u967D\u5C0F\u91CE\u7530\u5E02"],
  ["353051", "JP-35", "\u5468\u9632\u5927\u5CF6\u753A"],
  ["353213", "JP-35", "\u548C\u6728\u753A"],
  ["353418", "JP-35", "\u4E0A\u95A2\u753A"],
  ["353434", "JP-35", "\u7530\u5E03\u65BD\u753A"],
  ["353442", "JP-35", "\u5E73\u751F\u753A"],
  ["355020", "JP-35", "\u963F\u6B66\u753A"],
  ["362018", "JP-36", "\u5FB3\u5CF6\u5E02"],
  ["362026", "JP-36", "\u9CF4\u9580\u5E02"],
  ["362034", "JP-36", "\u5C0F\u677E\u5CF6\u5E02"],
  ["362042", "JP-36", "\u963F\u5357\u5E02"],
  ["362051", "JP-36", "\u5409\u91CE\u5DDD\u5E02"],
  ["362069", "JP-36", "\u963F\u6CE2\u5E02"],
  ["362077", "JP-36", "\u7F8E\u99AC\u5E02"],
  ["362085", "JP-36", "\u4E09\u597D\u5E02"],
  ["363014", "JP-36", "\u52DD\u6D66\u753A"],
  ["363022", "JP-36", "\u4E0A\u52DD\u753A"],
  ["363219", "JP-36", "\u4F50\u90A3\u6CB3\u5185\u6751"],
  ["363413", "JP-36", "\u77F3\u4E95\u753A"],
  ["363421", "JP-36", "\u795E\u5C71\u753A"],
  ["363685", "JP-36", "\u90A3\u8CC0\u753A"],
  ["363839", "JP-36", "\u725F\u5C90\u753A"],
  ["363871", "JP-36", "\u7F8E\u6CE2\u753A"],
  ["363880", "JP-36", "\u6D77\u967D\u753A"],
  ["364011", "JP-36", "\u677E\u8302\u753A"],
  ["364029", "JP-36", "\u5317\u5CF6\u753A"],
  ["364037", "JP-36", "\u85CD\u4F4F\u753A"],
  ["364045", "JP-36", "\u677F\u91CE\u753A"],
  ["364053", "JP-36", "\u4E0A\u677F\u753A"],
  ["364681", "JP-36", "\u3064\u308B\u304E\u753A"],
  ["364894", "JP-36", "\u6771\u307F\u3088\u3057\u753A"],
  ["372013", "JP-37", "\u9AD8\u677E\u5E02"],
  ["372021", "JP-37", "\u4E38\u4E80\u5E02"],
  ["372030", "JP-37", "\u5742\u51FA\u5E02"],
  ["372048", "JP-37", "\u5584\u901A\u5BFA\u5E02"],
  ["372056", "JP-37", "\u89B3\u97F3\u5BFA\u5E02"],
  ["372064", "JP-37", "\u3055\u306C\u304D\u5E02"],
  ["372072", "JP-37", "\u6771\u304B\u304C\u308F\u5E02"],
  ["372081", "JP-37", "\u4E09\u8C4A\u5E02"],
  ["373222", "JP-37", "\u571F\u5E84\u753A"],
  ["373249", "JP-37", "\u5C0F\u8C46\u5CF6\u753A"],
  ["373419", "JP-37", "\u4E09\u6728\u753A"],
  ["373648", "JP-37", "\u76F4\u5CF6\u753A"],
  ["373869", "JP-37", "\u5B87\u591A\u6D25\u753A"],
  ["373877", "JP-37", "\u7DBE\u5DDD\u753A"],
  ["374032", "JP-37", "\u7434\u5E73\u753A"],
  ["374041", "JP-37", "\u591A\u5EA6\u6D25\u753A"],
  ["374067", "JP-37", "\u307E\u3093\u306E\u3046\u753A"],
  ["382019", "JP-38", "\u677E\u5C71\u5E02"],
  ["382027", "JP-38", "\u4ECA\u6CBB\u5E02"],
  ["382035", "JP-38", "\u5B87\u548C\u5CF6\u5E02"],
  ["382043", "JP-38", "\u516B\u5E61\u6D5C\u5E02"],
  ["382051", "JP-38", "\u65B0\u5C45\u6D5C\u5E02"],
  ["382060", "JP-38", "\u897F\u6761\u5E02"],
  ["382078", "JP-38", "\u5927\u6D32\u5E02"],
  ["382108", "JP-38", "\u4F0A\u4E88\u5E02"],
  ["382132", "JP-38", "\u56DB\u56FD\u4E2D\u592E\u5E02"],
  ["382141", "JP-38", "\u897F\u4E88\u5E02"],
  ["382159", "JP-38", "\u6771\u6E29\u5E02"],
  ["383562", "JP-38", "\u4E0A\u5CF6\u753A"],
  ["383864", "JP-38", "\u4E45\u4E07\u9AD8\u539F\u753A"],
  ["384011", "JP-38", "\u677E\u524D\u753A"],
  ["384020", "JP-38", "\u7825\u90E8\u753A"],
  ["384224", "JP-38", "\u5185\u5B50\u753A"],
  ["384429", "JP-38", "\u4F0A\u65B9\u753A"],
  ["384844", "JP-38", "\u677E\u91CE\u753A"],
  ["384887", "JP-38", "\u9B3C\u5317\u753A"],
  ["385069", "JP-38", "\u611B\u5357\u753A"],
  ["392014", "JP-39", "\u9AD8\u77E5\u5E02"],
  ["392022", "JP-39", "\u5BA4\u6238\u5E02"],
  ["392031", "JP-39", "\u5B89\u82B8\u5E02"],
  ["392049", "JP-39", "\u5357\u56FD\u5E02"],
  ["392057", "JP-39", "\u571F\u4F50\u5E02"],
  ["392065", "JP-39", "\u9808\u5D0E\u5E02"],
  ["392081", "JP-39", "\u5BBF\u6BDB\u5E02"],
  ["392090", "JP-39", "\u571F\u4F50\u6E05\u6C34\u5E02"],
  ["392103", "JP-39", "\u56DB\u4E07\u5341\u5E02"],
  ["392111", "JP-39", "\u9999\u5357\u5E02"],
  ["392120", "JP-39", "\u9999\u7F8E\u5E02"],
  ["393011", "JP-39", "\u6771\u6D0B\u753A"],
  ["393029", "JP-39", "\u5948\u534A\u5229\u753A"],
  ["393037", "JP-39", "\u7530\u91CE\u753A"],
  ["393045", "JP-39", "\u5B89\u7530\u753A"],
  ["393053", "JP-39", "\u5317\u5DDD\u6751"],
  ["393061", "JP-39", "\u99AC\u8DEF\u6751"],
  ["393070", "JP-39", "\u82B8\u897F\u6751"],
  ["393410", "JP-39", "\u672C\u5C71\u753A"],
  ["393444", "JP-39", "\u5927\u8C4A\u753A"],
  ["393631", "JP-39", "\u571F\u4F50\u753A"],
  ["393649", "JP-39", "\u5927\u5DDD\u6751"],
  ["393860", "JP-39", "\u3044\u306E\u753A"],
  ["393878", "JP-39", "\u4EC1\u6DC0\u5DDD\u753A"],
  ["394017", "JP-39", "\u4E2D\u571F\u4F50\u753A"],
  ["394025", "JP-39", "\u4F50\u5DDD\u753A"],
  ["394033", "JP-39", "\u8D8A\u77E5\u753A"],
  ["394050", "JP-39", "\u68BC\u539F\u753A"],
  ["394106", "JP-39", "\u65E5\u9AD8\u6751"],
  ["394114", "JP-39", "\u6D25\u91CE\u753A"],
  ["394122", "JP-39", "\u56DB\u4E07\u5341\u753A"],
  ["394246", "JP-39", "\u5927\u6708\u753A"],
  ["394271", "JP-39", "\u4E09\u539F\u6751"],
  ["394289", "JP-39", "\u9ED2\u6F6E\u753A"],
  ["401005", "JP-40", "\u5317\u4E5D\u5DDE\u5E02"],
  ["401013", "JP-40", "\u5317\u4E5D\u5DDE\u5E02\u9580\u53F8\u533A"],
  ["401030", "JP-40", "\u5317\u4E5D\u5DDE\u5E02\u82E5\u677E\u533A"],
  ["401056", "JP-40", "\u5317\u4E5D\u5DDE\u5E02\u6238\u7551\u533A"],
  ["401064", "JP-40", "\u5317\u4E5D\u5DDE\u5E02\u5C0F\u5009\u5317\u533A"],
  ["401072", "JP-40", "\u5317\u4E5D\u5DDE\u5E02\u5C0F\u5009\u5357\u533A"],
  ["401081", "JP-40", "\u5317\u4E5D\u5DDE\u5E02\u516B\u5E61\u6771\u533A"],
  ["401099", "JP-40", "\u5317\u4E5D\u5DDE\u5E02\u516B\u5E61\u897F\u533A"],
  ["401307", "JP-40", "\u798F\u5CA1\u5E02"],
  ["401315", "JP-40", "\u798F\u5CA1\u5E02\u6771\u533A"],
  ["401323", "JP-40", "\u798F\u5CA1\u5E02\u535A\u591A\u533A"],
  ["401331", "JP-40", "\u798F\u5CA1\u5E02\u4E2D\u592E\u533A"],
  ["401340", "JP-40", "\u798F\u5CA1\u5E02\u5357\u533A"],
  ["401358", "JP-40", "\u798F\u5CA1\u5E02\u897F\u533A"],
  ["401366", "JP-40", "\u798F\u5CA1\u5E02\u57CE\u5357\u533A"],
  ["401374", "JP-40", "\u798F\u5CA1\u5E02\u65E9\u826F\u533A"],
  ["402028", "JP-40", "\u5927\u725F\u7530\u5E02"],
  ["402036", "JP-40", "\u4E45\u7559\u7C73\u5E02"],
  ["402044", "JP-40", "\u76F4\u65B9\u5E02"],
  ["402052", "JP-40", "\u98EF\u585A\u5E02"],
  ["402061", "JP-40", "\u7530\u5DDD\u5E02"],
  ["402079", "JP-40", "\u67F3\u5DDD\u5E02"],
  ["402109", "JP-40", "\u516B\u5973\u5E02"],
  ["402117", "JP-40", "\u7B51\u5F8C\u5E02"],
  ["402125", "JP-40", "\u5927\u5DDD\u5E02"],
  ["402133", "JP-40", "\u884C\u6A4B\u5E02"],
  ["402141", "JP-40", "\u8C4A\u524D\u5E02"],
  ["402150", "JP-40", "\u4E2D\u9593\u5E02"],
  ["402168", "JP-40", "\u5C0F\u90E1\u5E02"],
  ["402176", "JP-40", "\u7B51\u7D2B\u91CE\u5E02"],
  ["402184", "JP-40", "\u6625\u65E5\u5E02"],
  ["402192", "JP-40", "\u5927\u91CE\u57CE\u5E02"],
  ["402206", "JP-40", "\u5B97\u50CF\u5E02"],
  ["402214", "JP-40", "\u592A\u5BB0\u5E9C\u5E02"],
  ["402231", "JP-40", "\u53E4\u8CC0\u5E02"],
  ["402249", "JP-40", "\u798F\u6D25\u5E02"],
  ["402257", "JP-40", "\u3046\u304D\u306F\u5E02"],
  ["402265", "JP-40", "\u5BAE\u82E5\u5E02"],
  ["402273", "JP-40", "\u5609\u9EBB\u5E02"],
  ["402281", "JP-40", "\u671D\u5009\u5E02"],
  ["402290", "JP-40", "\u307F\u3084\u307E\u5E02"],
  ["402303", "JP-40", "\u7CF8\u5CF6\u5E02"],
  ["402311", "JP-40", "\u90A3\u73C2\u5DDD\u5E02"],
  ["403415", "JP-40", "\u5B87\u7F8E\u753A"],
  ["403423", "JP-40", "\u7BE0\u6817\u753A"],
  ["403431", "JP-40", "\u5FD7\u514D\u753A"],
  ["403440", "JP-40", "\u9808\u6075\u753A"],
  ["403458", "JP-40", "\u65B0\u5BAE\u753A"],
  ["403482", "JP-40", "\u4E45\u5C71\u753A"],
  ["403491", "JP-40", "\u7C95\u5C4B\u753A"],
  ["403814", "JP-40", "\u82A6\u5C4B\u753A"],
  ["403822", "JP-40", "\u6C34\u5DFB\u753A"],
  ["403831", "JP-40", "\u5CA1\u57A3\u753A"],
  ["403849", "JP-40", "\u9060\u8CC0\u753A"],
  ["404012", "JP-40", "\u5C0F\u7AF9\u753A"],
  ["404021", "JP-40", "\u978D\u624B\u753A"],
  ["404217", "JP-40", "\u6842\u5DDD\u753A"],
  ["404471", "JP-40", "\u7B51\u524D\u753A"],
  ["404489", "JP-40", "\u6771\u5CF0\u6751"],
  ["405035", "JP-40", "\u5927\u5200\u6D17\u753A"],
  ["405221", "JP-40", "\u5927\u6728\u753A"],
  ["405442", "JP-40", "\u5E83\u5DDD\u753A"],
  ["406015", "JP-40", "\u9999\u6625\u753A"],
  ["406023", "JP-40", "\u6DFB\u7530\u753A"],
  ["406040", "JP-40", "\u7CF8\u7530\u753A"],
  ["406058", "JP-40", "\u5DDD\u5D0E\u753A"],
  ["406082", "JP-40", "\u5927\u4EFB\u753A"],
  ["406091", "JP-40", "\u8D64\u6751"],
  ["406104", "JP-40", "\u798F\u667A\u753A"],
  ["406210", "JP-40", "\u82C5\u7530\u753A"],
  ["406252", "JP-40", "\u307F\u3084\u3053\u753A"],
  ["406422", "JP-40", "\u5409\u5BCC\u753A"],
  ["406465", "JP-40", "\u4E0A\u6BDB\u753A"],
  ["406473", "JP-40", "\u7BC9\u4E0A\u753A"],
  ["412015", "JP-41", "\u4F50\u8CC0\u5E02"],
  ["412023", "JP-41", "\u5510\u6D25\u5E02"],
  ["412031", "JP-41", "\u9CE5\u6816\u5E02"],
  ["412040", "JP-41", "\u591A\u4E45\u5E02"],
  ["412058", "JP-41", "\u4F0A\u4E07\u91CC\u5E02"],
  ["412066", "JP-41", "\u6B66\u96C4\u5E02"],
  ["412074", "JP-41", "\u9E7F\u5CF6\u5E02"],
  ["412082", "JP-41", "\u5C0F\u57CE\u5E02"],
  ["412091", "JP-41", "\u5B09\u91CE\u5E02"],
  ["412104", "JP-41", "\u795E\u57FC\u5E02"],
  ["413275", "JP-41", "\u5409\u91CE\u30F6\u91CC\u753A"],
  ["413411", "JP-41", "\u57FA\u5C71\u753A"],
  ["413453", "JP-41", "\u4E0A\u5CF0\u753A"],
  ["413461", "JP-41", "\u307F\u3084\u304D\u753A"],
  ["413879", "JP-41", "\u7384\u6D77\u753A"],
  ["414018", "JP-41", "\u6709\u7530\u753A"],
  ["414239", "JP-41", "\u5927\u753A\u753A"],
  ["414247", "JP-41", "\u6C5F\u5317\u753A"],
  ["414255", "JP-41", "\u767D\u77F3\u753A"],
  ["414417", "JP-41", "\u592A\u826F\u753A"],
  ["422011", "JP-42", "\u9577\u5D0E\u5E02"],
  ["422029", "JP-42", "\u4F50\u4E16\u4FDD\u5E02"],
  ["422037", "JP-42", "\u5CF6\u539F\u5E02"],
  ["422045", "JP-42", "\u8AEB\u65E9\u5E02"],
  ["422053", "JP-42", "\u5927\u6751\u5E02"],
  ["422070", "JP-42", "\u5E73\u6238\u5E02"],
  ["422088", "JP-42", "\u677E\u6D66\u5E02"],
  ["422096", "JP-42", "\u5BFE\u99AC\u5E02"],
  ["422100", "JP-42", "\u58F1\u5C90\u5E02"],
  ["422118", "JP-42", "\u4E94\u5CF6\u5E02"],
  ["422126", "JP-42", "\u897F\u6D77\u5E02"],
  ["422134", "JP-42", "\u96F2\u4ED9\u5E02"],
  ["422142", "JP-42", "\u5357\u5CF6\u539F\u5E02"],
  ["423076", "JP-42", "\u9577\u4E0E\u753A"],
  ["423084", "JP-42", "\u6642\u6D25\u753A"],
  ["423211", "JP-42", "\u6771\u5F7C\u6775\u753A"],
  ["423220", "JP-42", "\u5DDD\u68DA\u753A"],
  ["423238", "JP-42", "\u6CE2\u4F50\u898B\u753A"],
  ["423831", "JP-42", "\u5C0F\u5024\u8CC0\u753A"],
  ["423912", "JP-42", "\u4F50\u3005\u753A"],
  ["424111", "JP-42", "\u65B0\u4E0A\u4E94\u5CF6\u753A"],
  ["431001", "JP-43", "\u718A\u672C\u5E02"],
  ["431010", "JP-43", "\u718A\u672C\u5E02\u4E2D\u592E\u533A"],
  ["431028", "JP-43", "\u718A\u672C\u5E02\u6771\u533A"],
  ["431036", "JP-43", "\u718A\u672C\u5E02\u897F\u533A"],
  ["431044", "JP-43", "\u718A\u672C\u5E02\u5357\u533A"],
  ["431052", "JP-43", "\u718A\u672C\u5E02\u5317\u533A"],
  ["432024", "JP-43", "\u516B\u4EE3\u5E02"],
  ["432032", "JP-43", "\u4EBA\u5409\u5E02"],
  ["432041", "JP-43", "\u8352\u5C3E\u5E02"],
  ["432059", "JP-43", "\u6C34\u4FE3\u5E02"],
  ["432067", "JP-43", "\u7389\u540D\u5E02"],
  ["432083", "JP-43", "\u5C71\u9E7F\u5E02"],
  ["432105", "JP-43", "\u83CA\u6C60\u5E02"],
  ["432113", "JP-43", "\u5B87\u571F\u5E02"],
  ["432121", "JP-43", "\u4E0A\u5929\u8349\u5E02"],
  ["432130", "JP-43", "\u5B87\u57CE\u5E02"],
  ["432148", "JP-43", "\u963F\u8607\u5E02"],
  ["432156", "JP-43", "\u5929\u8349\u5E02"],
  ["432164", "JP-43", "\u5408\u5FD7\u5E02"],
  ["433489", "JP-43", "\u7F8E\u91CC\u753A"],
  ["433641", "JP-43", "\u7389\u6771\u753A"],
  ["433675", "JP-43", "\u5357\u95A2\u753A"],
  ["433683", "JP-43", "\u9577\u6D32\u753A"],
  ["433691", "JP-43", "\u548C\u6C34\u753A"],
  ["434035", "JP-43", "\u5927\u6D25\u753A"],
  ["434043", "JP-43", "\u83CA\u967D\u753A"],
  ["434230", "JP-43", "\u5357\u5C0F\u56FD\u753A"],
  ["434248", "JP-43", "\u5C0F\u56FD\u753A"],
  ["434256", "JP-43", "\u7523\u5C71\u6751"],
  ["434281", "JP-43", "\u9AD8\u68EE\u753A"],
  ["434329", "JP-43", "\u897F\u539F\u6751"],
  ["434337", "JP-43", "\u5357\u963F\u8607\u6751"],
  ["434418", "JP-43", "\u5FA1\u8239\u753A"],
  ["434426", "JP-43", "\u5609\u5CF6\u753A"],
  ["434434", "JP-43", "\u76CA\u57CE\u753A"],
  ["434442", "JP-43", "\u7532\u4F50\u753A"],
  ["434477", "JP-43", "\u5C71\u90FD\u753A"],
  ["434680", "JP-43", "\u6C37\u5DDD\u753A"],
  ["434825", "JP-43", "\u82A6\u5317\u753A"],
  ["434841", "JP-43", "\u6D25\u5948\u6728\u753A"],
  ["435015", "JP-43", "\u9326\u753A"],
  ["435058", "JP-43", "\u591A\u826F\u6728\u753A"],
  ["435066", "JP-43", "\u6E6F\u524D\u753A"],
  ["435074", "JP-43", "\u6C34\u4E0A\u6751"],
  ["435104", "JP-43", "\u76F8\u826F\u6751"],
  ["435112", "JP-43", "\u4E94\u6728\u6751"],
  ["435121", "JP-43", "\u5C71\u6C5F\u6751"],
  ["435139", "JP-43", "\u7403\u78E8\u6751"],
  ["435147", "JP-43", "\u3042\u3055\u304E\u308A\u753A"],
  ["435317", "JP-43", "\u82D3\u5317\u753A"],
  ["442011", "JP-44", "\u5927\u5206\u5E02"],
  ["442020", "JP-44", "\u5225\u5E9C\u5E02"],
  ["442038", "JP-44", "\u4E2D\u6D25\u5E02"],
  ["442046", "JP-44", "\u65E5\u7530\u5E02"],
  ["442054", "JP-44", "\u4F50\u4F2F\u5E02"],
  ["442062", "JP-44", "\u81FC\u6775\u5E02"],
  ["442071", "JP-44", "\u6D25\u4E45\u898B\u5E02"],
  ["442089", "JP-44", "\u7AF9\u7530\u5E02"],
  ["442097", "JP-44", "\u8C4A\u5F8C\u9AD8\u7530\u5E02"],
  ["442101", "JP-44", "\u6775\u7BC9\u5E02"],
  ["442119", "JP-44", "\u5B87\u4F50\u5E02"],
  ["442127", "JP-44", "\u8C4A\u5F8C\u5927\u91CE\u5E02"],
  ["442135", "JP-44", "\u7531\u5E03\u5E02"],
  ["442143", "JP-44", "\u56FD\u6771\u5E02"],
  ["443221", "JP-44", "\u59EB\u5CF6\u6751"],
  ["443417", "JP-44", "\u65E5\u51FA\u753A"],
  ["444618", "JP-44", "\u4E5D\u91CD\u753A"],
  ["444626", "JP-44", "\u7396\u73E0\u753A"],
  ["452017", "JP-45", "\u5BAE\u5D0E\u5E02"],
  ["452025", "JP-45", "\u90FD\u57CE\u5E02"],
  ["452033", "JP-45", "\u5EF6\u5CA1\u5E02"],
  ["452041", "JP-45", "\u65E5\u5357\u5E02"],
  ["452050", "JP-45", "\u5C0F\u6797\u5E02"],
  ["452068", "JP-45", "\u65E5\u5411\u5E02"],
  ["452076", "JP-45", "\u4E32\u9593\u5E02"],
  ["452084", "JP-45", "\u897F\u90FD\u5E02"],
  ["452092", "JP-45", "\u3048\u3073\u306E\u5E02"],
  ["453412", "JP-45", "\u4E09\u80A1\u753A"],
  ["453617", "JP-45", "\u9AD8\u539F\u753A"],
  ["453820", "JP-45", "\u56FD\u5BCC\u753A"],
  ["453838", "JP-45", "\u7DBE\u753A"],
  ["454010", "JP-45", "\u9AD8\u934B\u753A"],
  ["454028", "JP-45", "\u65B0\u5BCC\u753A"],
  ["454036", "JP-45", "\u897F\u7C73\u826F\u6751"],
  ["454044", "JP-45", "\u6728\u57CE\u753A"],
  ["454052", "JP-45", "\u5DDD\u5357\u753A"],
  ["454061", "JP-45", "\u90FD\u8FB2\u753A"],
  ["454214", "JP-45", "\u9580\u5DDD\u753A"],
  ["454290", "JP-45", "\u8AF8\u585A\u6751"],
  ["454303", "JP-45", "\u690E\u8449\u6751"],
  ["454311", "JP-45", "\u7F8E\u90F7\u753A"],
  ["454419", "JP-45", "\u9AD8\u5343\u7A42\u753A"],
  ["454427", "JP-45", "\u65E5\u4E4B\u5F71\u753A"],
  ["454435", "JP-45", "\u4E94\u30F6\u702C\u753A"],
  ["462012", "JP-46", "\u9E7F\u5150\u5CF6\u5E02"],
  ["462039", "JP-46", "\u9E7F\u5C4B\u5E02"],
  ["462047", "JP-46", "\u6795\u5D0E\u5E02"],
  ["462063", "JP-46", "\u963F\u4E45\u6839\u5E02"],
  ["462080", "JP-46", "\u51FA\u6C34\u5E02"],
  ["462101", "JP-46", "\u6307\u5BBF\u5E02"],
  ["462136", "JP-46", "\u897F\u4E4B\u8868\u5E02"],
  ["462144", "JP-46", "\u5782\u6C34\u5E02"],
  ["462152", "JP-46", "\u85A9\u6469\u5DDD\u5185\u5E02"],
  ["462161", "JP-46", "\u65E5\u7F6E\u5E02"],
  ["462179", "JP-46", "\u66FD\u65BC\u5E02"],
  ["462187", "JP-46", "\u9727\u5CF6\u5E02"],
  ["462195", "JP-46", "\u3044\u3061\u304D\u4E32\u6728\u91CE\u5E02"],
  ["462209", "JP-46", "\u5357\u3055\u3064\u307E\u5E02"],
  ["462217", "JP-46", "\u5FD7\u5E03\u5FD7\u5E02"],
  ["462225", "JP-46", "\u5944\u7F8E\u5E02"],
  ["462233", "JP-46", "\u5357\u4E5D\u5DDE\u5E02"],
  ["462241", "JP-46", "\u4F0A\u4F50\u5E02"],
  ["462250", "JP-46", "\u59F6\u826F\u5E02"],
  ["463035", "JP-46", "\u4E09\u5CF6\u6751"],
  ["463043", "JP-46", "\u5341\u5CF6\u6751"],
  ["463922", "JP-46", "\u3055\u3064\u307E\u753A"],
  ["464040", "JP-46", "\u9577\u5CF6\u753A"],
  ["464520", "JP-46", "\u6E67\u6C34\u753A"],
  ["464686", "JP-46", "\u5927\u5D0E\u753A"],
  ["464821", "JP-46", "\u6771\u4E32\u826F\u753A"],
  ["464902", "JP-46", "\u9326\u6C5F\u753A"],
  ["464911", "JP-46", "\u5357\u5927\u9685\u753A"],
  ["464929", "JP-46", "\u809D\u4ED8\u753A"],
  ["465011", "JP-46", "\u4E2D\u7A2E\u5B50\u753A"],
  ["465020", "JP-46", "\u5357\u7A2E\u5B50\u753A"],
  ["465054", "JP-46", "\u5C4B\u4E45\u5CF6\u753A"],
  ["465232", "JP-46", "\u5927\u548C\u6751"],
  ["465241", "JP-46", "\u5B87\u691C\u6751"],
  ["465259", "JP-46", "\u702C\u6238\u5185\u753A"],
  ["465275", "JP-46", "\u9F8D\u90F7\u753A"],
  ["465291", "JP-46", "\u559C\u754C\u753A"],
  ["465305", "JP-46", "\u5FB3\u4E4B\u5CF6\u753A"],
  ["465313", "JP-46", "\u5929\u57CE\u753A"],
  ["465321", "JP-46", "\u4F0A\u4ED9\u753A"],
  ["465330", "JP-46", "\u548C\u6CCA\u753A"],
  ["465348", "JP-46", "\u77E5\u540D\u753A"],
  ["465356", "JP-46", "\u4E0E\u8AD6\u753A"],
  ["472018", "JP-47", "\u90A3\u8987\u5E02"],
  ["472051", "JP-47", "\u5B9C\u91CE\u6E7E\u5E02"],
  ["472077", "JP-47", "\u77F3\u57A3\u5E02"],
  ["472085", "JP-47", "\u6D66\u6DFB\u5E02"],
  ["472093", "JP-47", "\u540D\u8B77\u5E02"],
  ["472107", "JP-47", "\u7CF8\u6E80\u5E02"],
  ["472115", "JP-47", "\u6C96\u7E04\u5E02"],
  ["472123", "JP-47", "\u8C4A\u898B\u57CE\u5E02"],
  ["472131", "JP-47", "\u3046\u308B\u307E\u5E02"],
  ["472140", "JP-47", "\u5BAE\u53E4\u5CF6\u5E02"],
  ["472158", "JP-47", "\u5357\u57CE\u5E02"],
  ["473014", "JP-47", "\u56FD\u982D\u6751"],
  ["473022", "JP-47", "\u5927\u5B9C\u5473\u6751"],
  ["473031", "JP-47", "\u6771\u6751"],
  ["473065", "JP-47", "\u4ECA\u5E30\u4EC1\u6751"],
  ["473081", "JP-47", "\u672C\u90E8\u753A"],
  ["473111", "JP-47", "\u6069\u7D0D\u6751"],
  ["473138", "JP-47", "\u5B9C\u91CE\u5EA7\u6751"],
  ["473146", "JP-47", "\u91D1\u6B66\u753A"],
  ["473154", "JP-47", "\u4F0A\u6C5F\u6751"],
  ["473243", "JP-47", "\u8AAD\u8C37\u6751"],
  ["473251", "JP-47", "\u5609\u624B\u7D0D\u753A"],
  ["473260", "JP-47", "\u5317\u8C37\u753A"],
  ["473278", "JP-47", "\u5317\u4E2D\u57CE\u6751"],
  ["473286", "JP-47", "\u4E2D\u57CE\u6751"],
  ["473294", "JP-47", "\u897F\u539F\u753A"],
  ["473481", "JP-47", "\u4E0E\u90A3\u539F\u753A"],
  ["473502", "JP-47", "\u5357\u98A8\u539F\u753A"],
  ["473537", "JP-47", "\u6E21\u5609\u6577\u6751"],
  ["473545", "JP-47", "\u5EA7\u9593\u5473\u6751"],
  ["473553", "JP-47", "\u7C9F\u56FD\u6751"],
  ["473561", "JP-47", "\u6E21\u540D\u559C\u6751"],
  ["473570", "JP-47", "\u5357\u5927\u6771\u6751"],
  ["473588", "JP-47", "\u5317\u5927\u6771\u6751"],
  ["473596", "JP-47", "\u4F0A\u5E73\u5C4B\u6751"],
  ["473600", "JP-47", "\u4F0A\u662F\u540D\u6751"],
  ["473618", "JP-47", "\u4E45\u7C73\u5CF6\u753A"],
  ["473626", "JP-47", "\u516B\u91CD\u702C\u753A"],
  ["473758", "JP-47", "\u591A\u826F\u9593\u6751"],
  ["473812", "JP-47", "\u7AF9\u5BCC\u753A"],
  ["473821", "JP-47", "\u4E0E\u90A3\u56FD\u753A"]
];

// src/regions.ts
var subdivisionsByCountry = /* @__PURE__ */ new Map();
var subdivisionsByCode = /* @__PURE__ */ new Map();
for (const [code, countryCode, name] of SUBDIVISION_RECORDS) {
  const option = { code, name };
  subdivisionsByCode.set(code, option);
  const countryOptions = subdivisionsByCountry.get(countryCode) ?? [];
  countryOptions.push(option);
  subdivisionsByCountry.set(countryCode, countryOptions);
}
var municipalitiesBySubdivision = /* @__PURE__ */ new Map();
var municipalitiesByCode = /* @__PURE__ */ new Map();
for (const [code, subdivisionCode, name] of JAPAN_MUNICIPALITY_RECORDS) {
  const option = { code, name };
  municipalitiesByCode.set(code, { ...option, subdivisionCode });
  const subdivisionOptions = municipalitiesBySubdivision.get(subdivisionCode) ?? [];
  subdivisionOptions.push(option);
  municipalitiesBySubdivision.set(subdivisionCode, subdivisionOptions);
}
var listRegions = /* @__PURE__ */ __name((url) => {
  const countryCode = (url.searchParams.get("countryCode") ?? "").normalize("NFKC").toUpperCase();
  const subdivisionCode = (url.searchParams.get("subdivisionCode") ?? "").normalize("NFKC").toUpperCase();
  if (!/^[A-Z]{2}$/u.test(countryCode)) {
    throw new ApiError(400, "INVALID_COUNTRY", "countryCode must be ISO 3166-1 alpha-2.");
  }
  if (subdivisionCode && !/^[A-Z]{2}-[A-Z0-9]{1,3}$/u.test(subdivisionCode)) {
    throw new ApiError(400, "INVALID_SUBDIVISION", "subdivisionCode must be a complete ISO 3166-2 code.");
  }
  if (subdivisionCode && !subdivisionCode.startsWith(`${countryCode}-`)) {
    throw new ApiError(400, "REGION_FIELD_CONFLICT", "subdivisionCode does not belong to countryCode.");
  }
  const subdivisions = subdivisionsByCountry.get(countryCode) ?? [];
  const municipalities = countryCode === "JP" && subdivisionCode ? municipalitiesBySubdivision.get(subdivisionCode) ?? [] : [];
  return json({ version: REGION_DATA_VERSION, subdivisions, municipalities });
}, "listRegions");
var locateRegion = /* @__PURE__ */ __name(async (url, env) => {
  const countryCode = (url.searchParams.get("countryCode") ?? "").normalize("NFKC").toUpperCase();
  const subdivisionCode = (url.searchParams.get("subdivisionCode") ?? "").normalize("NFKC").toUpperCase();
  const municipalityCode = (url.searchParams.get("municipalityCode") ?? "").normalize("NFKC");
  return json({ location: await resolveRegionOfficeLocation(env, countryCode, subdivisionCode, municipalityCode || null) });
}, "locateRegion");
var resolveRegionOfficeLocation = /* @__PURE__ */ __name(async (env, countryCode, subdivisionCode, municipalityCode) => {
  if (countryCode !== "JP") throw new ApiError(400, "UNSUPPORTED_REGION_LOCATION", "Region plotting currently supports Japan.");
  const subdivision = subdivisionsByCode.get(subdivisionCode);
  if (!subdivision || !subdivisionCode.startsWith("JP-")) {
    throw new ApiError(400, "INVALID_SUBDIVISION", "A current Japanese subdivisionCode is required.");
  }
  const municipality = municipalityCode ? municipalitiesByCode.get(municipalityCode) : null;
  if (municipalityCode && (!municipality || municipality.subdivisionCode !== subdivisionCode)) {
    throw new ApiError(400, "INVALID_MUNICIPALITY", "municipalityCode must belong to subdivisionCode.");
  }
  const regionKey = municipalityCode ? `JP:MUNICIPALITY:${municipalityCode}` : `JP:PREFECTURE:${subdivisionCode}`;
  const cached = await env.DB.prepare(
    "SELECT latitude, longitude, precision FROM region_office_locations WHERE region_key = ?1"
  ).bind(regionKey).first();
  if (cached) return cached;
  const precision = municipalityCode ? "MUNICIPAL_MAIN_OFFICE" : "PREFECTURAL_GOVERNMENT_OFFICE";
  const queries = municipality ? municipalityOfficeQueries(subdivision.name, municipality.name) : [`${subdivision.name}\u5E81\u672C\u5E81\u820E`, `${subdivision.name}\u5E81`];
  const coordinates = await locateGovernmentOffice(queries);
  if (!coordinates) throw new ApiError(502, "REGION_LOCATION_UNAVAILABLE", "The selected government office location was not found.");
  const location = { ...coordinates, precision };
  await env.DB.prepare(
    `INSERT INTO region_office_locations
       (region_key, country_code, subdivision_code, municipality_code, latitude, longitude, precision, source, updated_at)
     VALUES (?1, 'JP', ?2, ?3, ?4, ?5, ?6, 'GSI_ADDRESS_SEARCH', ?7)
     ON CONFLICT(region_key) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude,
       precision = excluded.precision, updated_at = excluded.updated_at`
  ).bind(regionKey, subdivisionCode, municipalityCode, location.latitude, location.longitude, precision, (/* @__PURE__ */ new Date()).toISOString()).run();
  return location;
}, "resolveRegionOfficeLocation");
var municipalityOfficeQueries = /* @__PURE__ */ __name((subdivisionName, municipalityName) => {
  const officeName = /[町村]$/u.test(municipalityName) ? "\u5F79\u5834" : "\u5F79\u6240";
  return [
    `${subdivisionName}${municipalityName}${officeName}\u672C\u5E81\u820E`,
    `${subdivisionName}${municipalityName}${officeName}`
  ];
}, "municipalityOfficeQueries");
var locateGovernmentOffice = /* @__PURE__ */ __name(async (queries) => {
  for (const query of queries) {
    const upstream = new URL("https://msearch.gsi.go.jp/address-search/AddressSearch");
    upstream.searchParams.set("q", query);
    let response;
    try {
      response = await fetch(upstream, { headers: { Accept: "application/json" } });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const declaredLength = Number(response.headers.get("Content-Length") ?? 0);
    if (declaredLength > 64 * 1024) continue;
    const payload = await response.json().catch(() => null);
    const coordinates = readCoordinates(payload);
    if (coordinates) return coordinates;
  }
  return null;
}, "locateGovernmentOffice");
var readCoordinates = /* @__PURE__ */ __name((payload) => {
  if (!Array.isArray(payload)) return null;
  for (const feature of payload) {
    if (typeof feature !== "object" || feature === null) continue;
    const geometry = feature.geometry;
    if (typeof geometry !== "object" || geometry === null) continue;
    const coordinates = geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 20 && latitude <= 48 && longitude >= 122 && longitude <= 154) {
      return { latitude, longitude };
    }
  }
  return null;
}, "readCoordinates");
var getSubdivision = /* @__PURE__ */ __name((code) => subdivisionsByCode.get(code) ?? null, "getSubdivision");
var getMunicipality = /* @__PURE__ */ __name((code) => municipalitiesByCode.get(code) ?? null, "getMunicipality");
var hasValidMunicipalityCheckDigit = /* @__PURE__ */ __name((code) => {
  if (!/^\d{6}$/u.test(code)) return false;
  const digits = [...code].map(Number);
  const weighted = digits.slice(0, 5).reduce((sum, digit, index) => sum + digit * (6 - index), 0);
  return digits[5] === (11 - weighted % 11) % 10;
}, "hasValidMunicipalityCheckDigit");

// src/validation.ts
var validatePairRequest = /* @__PURE__ */ __name((value) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["pairingCode"]);
  const pairingCode = requireString(value.pairingCode, "pairingCode", 9, 9).toUpperCase();
  if (!/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/u.test(pairingCode)) {
    throw new ApiError(400, "INVALID_PAIRING_CODE", "Pairing code format is invalid.");
  }
  return { pairingCode };
}, "validatePairRequest");
var validateDeviceDraft = /* @__PURE__ */ __name((value) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["name", "countryCode", "subdivisionCode", "municipalityCode", "admin1Code", "localityName", "isPublic", "publicLatitude", "publicLongitude", "measurementKeys"]);
  const name = requireString(value.name, "name", 1, 80);
  const countryCode = requireString(value.countryCode, "countryCode", 2, 2).normalize("NFKC").toUpperCase();
  if (!/^[A-Z]{2}$/u.test(countryCode)) throw new ApiError(400, "INVALID_COUNTRY", "countryCode must be ISO 3166-1 alpha-2.");
  let subdivisionCode = optionalString(value.subdivisionCode, "subdivisionCode", 6)?.normalize("NFKC").toUpperCase() ?? null;
  const municipalityCode = optionalString(value.municipalityCode, "municipalityCode", 6)?.normalize("NFKC") ?? null;
  const legacyAdmin1Code = optionalString(value.admin1Code, "admin1Code", 32);
  const legacyLocalityName = optionalString(value.localityName, "localityName", 80);
  if (subdivisionCode) {
    if (!/^[A-Z]{2}-[A-Z0-9]{1,3}$/u.test(subdivisionCode) || !getSubdivision(subdivisionCode)) {
      throw new ApiError(400, "INVALID_SUBDIVISION", "subdivisionCode must be a current complete ISO 3166-2 code.");
    }
    if (!subdivisionCode.startsWith(`${countryCode}-`)) {
      throw new ApiError(400, "REGION_FIELD_CONFLICT", "subdivisionCode does not belong to countryCode.");
    }
  }
  const municipality = municipalityCode ? getMunicipality(municipalityCode) : null;
  if (municipalityCode) {
    if (countryCode !== "JP") {
      throw new ApiError(400, "INVALID_MUNICIPALITY", "municipalityCode is available only when countryCode is JP.");
    }
    if (!hasValidMunicipalityCheckDigit(municipalityCode) || !municipality) {
      throw new ApiError(400, "INVALID_MUNICIPALITY", "municipalityCode must be a current six-digit Japanese local public body code with a valid check digit.");
    }
    if (subdivisionCode && municipality.subdivisionCode !== subdivisionCode) {
      throw new ApiError(400, "REGION_FIELD_CONFLICT", "municipalityCode does not belong to subdivisionCode.");
    }
    subdivisionCode ??= municipality.subdivisionCode;
  }
  if (subdivisionCode && legacyAdmin1Code && legacyAdmin1Code.normalize("NFKC").toUpperCase() !== subdivisionCode) {
    throw new ApiError(400, "REGION_FIELD_CONFLICT", "admin1Code conflicts with subdivisionCode.");
  }
  if (municipality && legacyLocalityName && legacyLocalityName !== municipality.name) {
    throw new ApiError(400, "REGION_FIELD_CONFLICT", "localityName conflicts with municipalityCode.");
  }
  if (value.isPublic !== true) {
    throw new ApiError(400, "PUBLIC_SENSOR_REQUIRED", "GAIA SENSEWARE sensors must be published with an approximate location.");
  }
  const isPublic = true;
  const publicLatitude = coordinate(value.publicLatitude, "publicLatitude", -90, 90);
  const publicLongitude = coordinate(value.publicLongitude, "publicLongitude", -180, 180);
  if (publicLatitude === null || publicLongitude === null) {
    throw new ApiError(400, "PUBLIC_LOCATION_REQUIRED", "Select an approximate public map location.");
  }
  return {
    name,
    countryCode,
    subdivisionCode,
    municipalityCode,
    admin1Code: subdivisionCode ?? legacyAdmin1Code,
    localityName: municipality?.name ?? legacyLocalityName,
    isPublic,
    publicLatitude,
    publicLongitude,
    measurementKeys: validateMeasurementKeys(value.measurementKeys)
  };
}, "validateDeviceDraft");
var validateMeasurementKeys = /* @__PURE__ */ __name((value) => {
  if (value === void 0 || value === null) return null;
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) {
    throw new ApiError(400, "INVALID_MEASUREMENT_KEYS", "measurementKeys must contain between 1 and 16 catalog keys.");
  }
  const keys = [];
  for (const candidate of value) {
    if (typeof candidate !== "string" || !getMeasurementDefinition(candidate)) {
      throw new ApiError(400, "INVALID_MEASUREMENT_KEY", `Unsupported measurement key: ${String(candidate)}.`);
    }
    if (!keys.includes(candidate)) keys.push(candidate);
  }
  return keys;
}, "validateMeasurementKeys");
var validateProfileDraft = /* @__PURE__ */ __name((value) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["displayName", "xUrl", "githubUrl", "instagramUrl"]);
  return {
    displayName: requireString(value.displayName, "displayName", 1, 60),
    xUrl: socialUrl(value.xUrl, "xUrl", ["x.com"]),
    githubUrl: socialUrl(value.githubUrl, "githubUrl", ["github.com"]),
    instagramUrl: socialUrl(value.instagramUrl, "instagramUrl", ["instagram.com"])
  };
}, "validateProfileDraft");
var coordinate = /* @__PURE__ */ __name((value, field, minimum, maximum) => {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ApiError(400, "INVALID_PUBLIC_LOCATION", `${field} is outside the accepted range.`);
  }
  return Math.round(value * 1e5) / 1e5;
}, "coordinate");
var socialUrl = /* @__PURE__ */ __name((value, field, hosts) => {
  const raw = optionalString(value, field, 240);
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ApiError(400, "INVALID_SOCIAL_URL", `${field} must be a valid HTTPS profile URL.`);
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./u, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (parsed.protocol !== "https:" || !hosts.includes(host) || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash || segments.length !== 1 || !/^[A-Za-z0-9_.-]{1,80}$/u.test(segments[0] ?? "")) {
    throw new ApiError(400, "INVALID_SOCIAL_URL", `${field} must be an HTTPS account profile URL.`);
  }
  return `https://${host}/${segments[0]}`;
}, "socialUrl");
var validateTelemetry = /* @__PURE__ */ __name((value) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["seq", "observedAt", "data"]);
  if (!Number.isSafeInteger(value.seq) || value.seq < 0) {
    throw new ApiError(400, "INVALID_SEQUENCE", "seq must be a non-negative safe integer.");
  }
  let observedAt = null;
  if (value.observedAt !== void 0 && value.observedAt !== null) {
    observedAt = requireString(value.observedAt, "observedAt", 20, 35);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(observedAt)) {
      throw new ApiError(400, "INVALID_TIMESTAMP", "observedAt must be an RFC 3339 UTC timestamp.");
    }
    const timestamp = Date.parse(observedAt);
    if (!Number.isFinite(timestamp)) {
      throw new ApiError(400, "INVALID_TIMESTAMP", "observedAt must be an RFC 3339 UTC timestamp.");
    }
    const skew = Math.abs(Date.now() - timestamp);
    if (skew > 31 * 24 * 60 * 60 * 1e3) {
      throw new ApiError(400, "INVALID_TIMESTAMP", "observedAt must be within 31 days of receipt.");
    }
  }
  if (!isRecord(value.data)) throw new ApiError(400, "INVALID_SENSOR_DATA", "data must be an object.");
  const entries = Object.entries(value.data);
  if (entries.length < 1 || entries.length > 16) {
    throw new ApiError(400, "INVALID_SENSOR_DATA", "data must contain between 1 and 16 measurements.");
  }
  const data = {};
  for (const [key, measurement2] of entries) {
    if (!/^[a-z][a-z0-9_]{0,31}$/u.test(key)) throw new ApiError(400, "INVALID_SENSOR_KEY", `Invalid sensor key: ${key}.`);
    if (typeof measurement2 !== "number" || !Number.isFinite(measurement2)) {
      throw new ApiError(400, "INVALID_SENSOR_VALUE", `${key} must be a finite number.`);
    }
    const definition = getMeasurementDefinition(key);
    if (!definition) {
      throw new ApiError(400, "UNSUPPORTED_SENSOR_KEY", `${key} is not registered in the GAIA measurement catalog.`);
    }
    if (measurement2 < definition.minimum || measurement2 > definition.maximum) {
      throw new ApiError(400, "SENSOR_VALUE_OUT_OF_RANGE", `${key} is outside the accepted catalog range.`);
    }
    data[key] = measurement2;
  }
  return { seq: value.seq, observedAt: observedAt === null ? null : new Date(observedAt).toISOString(), data };
}, "validateTelemetry");

// src/devices.ts
var campusChatAvatarUrls = Object.freeze({
  "campus-chat-bluecat": "/assets/visuals-07/slack-symbol-blue-apple-v1.svg",
  "campus-chat-mizu": "/assets/visuals-07/slack-avatar-mizuha-v2.webp",
  "campus-chat-saku": "/assets/visuals-07/slack-avatar-sakuya-flower-v3.webp",
  "campus-chat-ame": "/assets/visuals-07/slack-avatar-amane-v2.webp"
});
var listCountries = /* @__PURE__ */ __name(async (env) => {
  const result = await env.DB.prepare(
    "SELECT code, name_en AS nameEn, name_local AS nameLocal FROM countries WHERE enabled = 1 ORDER BY COALESCE(name_local, name_en)"
  ).all();
  return json({ countries: result.results });
}, "listCountries");
var createPairing = /* @__PURE__ */ __name(async (request, env, user) => {
  await requireCsrf(request, user);
  const draft = validateDeviceDraft(await readJson(request, 4096));
  const country = await env.DB.prepare("SELECT code FROM countries WHERE code = ?1 AND enabled = 1").bind(draft.countryCode).first();
  if (!country) throw new ApiError(400, "INVALID_COUNTRY", "Selected country is not enabled.");
  const code = randomPairingCode();
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1e3).toISOString();
  await env.DB.prepare(
    `INSERT INTO device_pairing_codes
      (id, code_hash, user_id, device_name, country_code, subdivision_code, municipality_code,
       admin1_code, locality_name, public_latitude, public_longitude, is_public, measurement_keys_json, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
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
    now.toISOString()
  ).run();
  return json({ pairingCode: code, expiresAt }, 201);
}, "createPairing");
var pairDevice = /* @__PURE__ */ __name(async (request, env) => {
  const { pairingCode } = validatePairRequest(await readJson(request, 2048));
  const codeHash = await hmacHex(env.PAIRING_CODE_PEPPER, pairingCode);
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
         public_latitude, public_longitude, is_public, measurement_keys_json`
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
       WHERE code_hash = ?6 AND used_at = ?5 AND consumed_by_device_id = ?1`
    ).bind(databaseId, `sensor_${randomIdentifier(16)}`, deviceId, tokenHash, now, codeHash)
  ]);
  const consumedRows = results[0]?.results;
  const inserted = results[1]?.meta.changes ?? 0;
  if (!consumedRows?.[0] || inserted !== 1) {
    throw new ApiError(409, "PAIRING_CODE_UNAVAILABLE", "Pairing code is invalid, expired, or already used.");
  }
  return json({ deviceId, deviceToken: rawToken, tokenType: "Bearer" }, 201);
}, "pairDevice");
var acceptTelemetry = /* @__PURE__ */ __name(async (request, env, deviceId) => {
  const authorization = request.headers.get("Authorization") ?? "";
  const tokenMatch = /^Bearer ([A-Za-z0-9_-]{40,128})$/u.exec(authorization);
  if (!tokenMatch?.[1]) throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Device authentication failed.");
  const device = await env.DB.prepare(
    "SELECT token_hash, status, measurement_keys_json AS measurementKeysJson FROM devices WHERE device_id = ?1 AND deleted_at IS NULL"
  ).bind(deviceId).first();
  const providedHash = await hmacHex(env.DEVICE_TOKEN_PEPPER, tokenMatch[1]);
  if (!device || device.status !== "ACTIVE" || !await timingSafeHexEqual(providedHash, device.token_hash)) {
    throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Device authentication failed.");
  }
  const telemetry = validateTelemetry(await readJson(request, 12 * 1024));
  const nowDate = /* @__PURE__ */ new Date();
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
        RETURNING device_id`
    ).bind(telemetry.seq, payloadHash, now, measurementKeysJson, deviceId, rateLimitCutoff),
    env.DB.prepare(
      `INSERT INTO telemetry
        (id, device_id, seq, observed_at, received_at, payload_hash, payload_json, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?5
       FROM devices
       WHERE device_id = ?2 AND last_seq = ?3 AND last_payload_hash = ?6
         AND status = 'ACTIVE' AND deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM telemetry WHERE device_id = ?2 AND seq = ?3)
       RETURNING id`
    ).bind(crypto.randomUUID(), deviceId, telemetry.seq, telemetry.observedAt, now, payloadHash, payload)
  ]);
  const claimed = (results[0]?.results?.length ?? 0) === 1;
  const created = (results[1]?.results?.length ?? 0) === 1;
  if (claimed && created) return json({ accepted: true, duplicate: false, receivedAt: now }, 202);
  if (claimed !== created) throw new ApiError(409, "SEQUENCE_RACE", "Telemetry sequence could not be committed.");
  const existing = await env.DB.prepare(
    "SELECT payload_hash AS payloadHash, received_at AS receivedAt FROM telemetry WHERE device_id = ?1 AND seq = ?2"
  ).bind(deviceId, telemetry.seq).first();
  if (existing) {
    if (!await timingSafeHexEqual(payloadHash, existing.payloadHash)) {
      throw new ApiError(409, "SEQUENCE_CONFLICT", "This seq was already used with different telemetry content.");
    }
    return json({ accepted: true, duplicate: true, receivedAt: existing.receivedAt }, 200);
  }
  const current = await env.DB.prepare(
    `SELECT last_seq AS lastSeq, last_seen_at AS lastSeenAt, status
     FROM devices WHERE device_id = ?1 AND deleted_at IS NULL`
  ).bind(deviceId).first();
  if (!current || current.status !== "ACTIVE") throw new ApiError(401, "INVALID_DEVICE_TOKEN", "Device authentication failed.");
  if (current.lastSeq !== null && telemetry.seq <= current.lastSeq) {
    throw new ApiError(409, "STALE_SEQUENCE", "seq is lower than the device's latest accepted sequence.");
  }
  const retryAfterSeconds = telemetryRetryAfterSeconds(current.lastSeenAt, nowDate.getTime());
  if (retryAfterSeconds !== null) {
    return json(
      { error: { code: "TELEMETRY_RATE_LIMITED", message: "A device may submit at most one new telemetry record per 60 seconds." } },
      429,
      { "Retry-After": String(retryAfterSeconds) }
    );
  }
  throw new ApiError(409, "SEQUENCE_RACE", "Telemetry sequence could not be committed.");
}, "acceptTelemetry");
var telemetryRetryAfterSeconds = /* @__PURE__ */ __name((lastSeenAt, nowMs) => {
  if (!lastSeenAt) return null;
  const lastSeenMs = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenMs)) return null;
  const remainingMs = lastSeenMs + TELEMETRY_MIN_INTERVAL_MS - nowMs;
  return remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 1e3)) : null;
}, "telemetryRetryAfterSeconds");
var TELEMETRY_MIN_INTERVAL_MS = 6e4;
var listDevices = /* @__PURE__ */ __name(async (env, user) => {
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
     ORDER BY d.created_at DESC`
  ).bind(`-${threshold} seconds`, user.id).all();
  return json({ devices: result.results.map(serializeDevice) });
}, "listDevices");
var getDevice = /* @__PURE__ */ __name(async (env, user, deviceId) => {
  const device = await ownedDevice(env, user.id, deviceId);
  return json({ device: serializeDevice(device) });
}, "getDevice");
var getLatest = /* @__PURE__ */ __name(async (env, user, deviceId) => {
  const device = await ownedDevice(env, user.id, deviceId);
  const latest = await env.DB.prepare(
    `SELECT seq, observed_at AS observedAt, received_at AS receivedAt, payload_json AS payloadJson
     FROM telemetry WHERE device_id = ?1 ORDER BY received_at DESC, seq DESC LIMIT 1`
  ).bind(deviceId).first();
  return json({ device: serializeDevice(device), latest: latest ? serializeTelemetry(latest) : null });
}, "getLatest");
var getHistory = /* @__PURE__ */ __name(async (env, user, deviceId, url) => {
  await ownedDevice(env, user.id, deviceId);
  const limit = parseLimit(url.searchParams.get("limit"));
  const from = parseDateQuery(url.searchParams.get("from"), "from");
  const to = parseDateQuery(url.searchParams.get("to"), "to");
  if (from && to && from > to) throw new ApiError(400, "INVALID_TIME_RANGE", "from must not be after to.");
  const conditions = ["device_id = ?1"];
  const bindings = [deviceId];
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
     ORDER BY received_at DESC, seq DESC LIMIT ?${bindings.length}`
  ).bind(...bindings).all();
  return json({ deviceId, telemetry: result.results.map(serializeTelemetry) });
}, "getHistory");
var updateDevice = /* @__PURE__ */ __name(async (request, env, user, deviceId) => {
  await requireCsrf(request, user);
  const draft = validateDeviceDraft(await readJson(request, 4096));
  const country = await env.DB.prepare("SELECT code FROM countries WHERE code = ?1 AND enabled = 1").bind(draft.countryCode).first();
  if (!country) throw new ApiError(400, "INVALID_COUNTRY", "Selected country is not enabled.");
  const result = await env.DB.prepare(
    `UPDATE devices SET name = ?1, country_code = ?2, subdivision_code = ?3, municipality_code = ?4,
       admin1_code = ?5, locality_name = ?6, is_public = ?7, public_latitude = ?8, public_longitude = ?9,
       measurement_keys_json = COALESCE(?10, measurement_keys_json),
       location_precision = CASE WHEN ?4 IS NOT NULL OR ?6 IS NOT NULL THEN 'LOCALITY'
         WHEN ?3 IS NOT NULL OR ?5 IS NOT NULL THEN 'ADMIN1' ELSE 'COUNTRY' END,
       updated_at = ?11
     WHERE device_id = ?12 AND owner_user_id = ?13 AND status = 'ACTIVE' AND deleted_at IS NULL`
  ).bind(
    draft.name,
    draft.countryCode,
    draft.subdivisionCode,
    draft.municipalityCode,
    draft.admin1Code,
    draft.localityName,
    1,
    draft.publicLatitude,
    draft.publicLongitude,
    draft.measurementKeys === null ? null : JSON.stringify(draft.measurementKeys),
    (/* @__PURE__ */ new Date()).toISOString(),
    deviceId,
    user.id
  ).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "DEVICE_NOT_FOUND", "Device was not found.");
  return getDevice(env, user, deviceId);
}, "updateDevice");
var revokeDevice = /* @__PURE__ */ __name(async (request, env, user, deviceId) => {
  await requireCsrf(request, user);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await env.DB.prepare(
    `UPDATE devices SET status = 'REVOKED', deleted_at = ?1, updated_at = ?1
     WHERE device_id = ?2 AND owner_user_id = ?3 AND status = 'ACTIVE' AND deleted_at IS NULL`
  ).bind(now, deviceId, user.id).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "DEVICE_NOT_FOUND", "Device was not found.");
  return new Response(null, { status: 204 });
}, "revokeDevice");
var ownedDevice = /* @__PURE__ */ __name(async (env, userId, deviceId) => {
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
     WHERE d.device_id = ?2 AND d.owner_user_id = ?3 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL`
  ).bind(`-${threshold} seconds`, deviceId, userId).first();
  if (!device) throw new ApiError(404, "DEVICE_NOT_FOUND", "Device was not found.");
  return device;
}, "ownedDevice");
var listPublicSensors = /* @__PURE__ */ __name(async (env) => {
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
       ORDER BY d.created_at DESC LIMIT 500`
    ).bind(`-${threshold} seconds`),
    env.DB.prepare(
      `SELECT COALESCE(SUM(rollup.observation_count), 0) AS observationPackets,
         COALESCE(SUM(rollup.payload_bytes), 0) AS payloadBytes
       FROM devices d
       LEFT JOIN device_telemetry_rollups rollup ON rollup.device_id = d.device_id
       WHERE d.is_public = 1 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL
         AND d.public_latitude IS NOT NULL AND d.public_longitude IS NOT NULL`
    )
  ]);
  const sensorRows = sensorResult?.results ?? [];
  const networkStats = networkStatsResult?.results?.[0] ?? { observationPackets: 0, payloadBytes: 0 };
  return json({
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    stats: {
      observationPackets: Number(networkStats.observationPackets) || 0,
      payloadBytes: Number(networkStats.payloadBytes) || 0
    },
    sensors: sensorRows.map((row) => ({
      id: row.id,
      sensorName: row.sensorName,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        precision: "PUBLIC_REFERENCE_POINT"
      },
      region: {
        countryCode: row.countryCode,
        subdivisionCode: row.subdivisionCode,
        subdivisionName: row.subdivisionCode ? getSubdivision(row.subdivisionCode)?.name ?? null : null,
        municipalityCode: row.municipalityCode,
        municipalityName: row.municipalityCode ? getMunicipality(row.municipalityCode)?.name ?? null : null
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
        avatarUrl: row.avatarKey && campusChatAvatarUrls[row.avatarKey] ? campusChatAvatarUrls[row.avatarKey] : row.hasAvatar === 1 ? `/api/public/v1/profiles/${encodeURIComponent(row.ownerPublicId)}/avatar?v=${encodeURIComponent(row.avatarUpdatedAt ?? "1")}&privacy=2` : null,
        xUrl: row.xUrl,
        githubUrl: row.githubUrl,
        instagramUrl: row.instagramUrl
      }
    }))
  });
}, "listPublicSensors");
var parsePublicObservations = /* @__PURE__ */ __name((payloadJson) => {
  try {
    const parsed = JSON.parse(payloadJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 12).flatMap((payload) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
      const measurements = Object.entries(payload).filter((entry) => typeof entry[1] === "number" && Number.isFinite(entry[1]));
      return measurements.length ? [{ data: Object.fromEntries(measurements) }] : [];
    });
  } catch {
    return [];
  }
}, "parsePublicObservations");
var serializeTelemetry = /* @__PURE__ */ __name((row) => ({
  seq: row.seq,
  observedAt: row.observedAt,
  receivedAt: row.receivedAt,
  data: JSON.parse(row.payloadJson)
}), "serializeTelemetry");
var serializeDevice = /* @__PURE__ */ __name((device) => ({
  ...Object.fromEntries(Object.entries(device).filter(([key]) => key !== "measurementKeysJson")),
  measurementKeys: parseMeasurementKeysJson(device.measurementKeysJson),
  subdivisionName: device.subdivisionCode ? getSubdivision(device.subdivisionCode)?.name ?? null : null,
  municipalityName: device.municipalityCode ? getMunicipality(device.municipalityCode)?.name ?? null : null,
  isPublic: device.isPublic === 1
}), "serializeDevice");
var parseMeasurementKeysJson = /* @__PURE__ */ __name((value) => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}, "parseMeasurementKeysJson");
var mergeMeasurementKeys = /* @__PURE__ */ __name((stored, observed) => [.../* @__PURE__ */ new Set([...parseMeasurementKeysJson(stored), ...observed])].slice(0, 16), "mergeMeasurementKeys");
var parseLimit = /* @__PURE__ */ __name((value) => {
  if (value === null) return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new ApiError(400, "INVALID_LIMIT", "limit must be between 1 and 500.");
  return limit;
}, "parseLimit");
var parseDateQuery = /* @__PURE__ */ __name((value, name) => {
  if (value === null || value === "") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ApiError(400, "INVALID_TIME_RANGE", `${name} must be an ISO 8601 timestamp.`);
  return new Date(parsed).toISOString();
}, "parseDateQuery");
var onlineThreshold = /* @__PURE__ */ __name((env) => {
  const parsed = Number(env.ONLINE_THRESHOLD_SECONDS);
  return Number.isInteger(parsed) && parsed >= 5 && parsed <= 3600 ? parsed : 30;
}, "onlineThreshold");
var randomIdentifier = /* @__PURE__ */ __name((length) => {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}, "randomIdentifier");

// src/profiles.ts
var MAX_AVATAR_BYTES = 1024 * 1024;
var MAX_AVATAR_EDGE = 512;
var PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
var getProfile = /* @__PURE__ */ __name(async (env, user) => {
  const profile = await profileRow(env, user.id);
  return json({ profile: serializeProfile(profile) });
}, "getProfile");
var updateProfile = /* @__PURE__ */ __name(async (request, env, user) => {
  await requireCsrf(request, user);
  const draft = validateProfileDraft(await readJson(request, 4096));
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await env.DB.prepare(
    `UPDATE users SET display_name = ?1, x_url = ?2, github_url = ?3, instagram_url = ?4, updated_at = ?5
     WHERE id = ?6`
  ).bind(draft.displayName, draft.xUrl, draft.githubUrl, draft.instagramUrl, now, user.id).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile was not found.");
  return getProfile(env, user);
}, "updateProfile");
var uploadAvatar = /* @__PURE__ */ __name(async (request, env, user) => {
  await requireCsrf(request, user);
  const type = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "image/png") throw new ApiError(415, "UNSUPPORTED_AVATAR_TYPE", "Avatar must be a PNG image.");
  const sanitized = sanitizePng(await readBytes(request, MAX_AVATAR_BYTES));
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await env.DB.prepare(
    "UPDATE users SET avatar_png = ?1, avatar_updated_at = ?2, updated_at = ?2 WHERE id = ?3"
  ).bind(sanitized, now, user.id).run();
  if (result.meta.changes !== 1) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile was not found.");
  return getProfile(env, user);
}, "uploadAvatar");
var deleteAvatar = /* @__PURE__ */ __name(async (request, env, user) => {
  await requireCsrf(request, user);
  await env.DB.prepare(
    "UPDATE users SET avatar_png = NULL, avatar_updated_at = NULL, updated_at = ?1 WHERE id = ?2"
  ).bind((/* @__PURE__ */ new Date()).toISOString(), user.id).run();
  return new Response(null, { status: 204 });
}, "deleteAvatar");
var getPublicAvatar = /* @__PURE__ */ __name(async (env, publicId) => {
  const profile = await env.DB.prepare(
    "SELECT avatar_png AS avatarPng, avatar_updated_at AS avatarUpdatedAt FROM users WHERE public_id = ?1"
  ).bind(publicId).first();
  if (!profile?.avatarPng) throw new ApiError(404, "AVATAR_NOT_FOUND", "Avatar was not found.");
  const avatar = avatarBytes(profile.avatarPng);
  const headers = new Headers();
  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "no-store");
  if (profile.avatarUpdatedAt) headers.set("Last-Modified", new Date(profile.avatarUpdatedAt).toUTCString());
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(avatar, { headers });
}, "getPublicAvatar");
var profileRow = /* @__PURE__ */ __name(async (env, userId) => {
  const profile = await env.DB.prepare(
    `SELECT public_id AS publicId, display_name AS displayName,
       CASE WHEN avatar_png IS NULL THEN 0 ELSE 1 END AS hasAvatar,
       avatar_updated_at AS avatarUpdatedAt, x_url AS xUrl, github_url AS githubUrl,
       instagram_url AS instagramUrl
     FROM users WHERE id = ?1`
  ).bind(userId).first();
  if (!profile?.publicId) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile was not found.");
  return profile;
}, "profileRow");
var serializeProfile = /* @__PURE__ */ __name((profile) => ({
  publicId: profile.publicId,
  displayName: profile.displayName,
  avatarUrl: profile.hasAvatar === 1 ? `/api/public/v1/profiles/${encodeURIComponent(profile.publicId)}/avatar?v=${encodeURIComponent(profile.avatarUpdatedAt ?? "1")}&privacy=2` : null,
  xUrl: profile.xUrl,
  githubUrl: profile.githubUrl,
  instagramUrl: profile.instagramUrl
}), "serializeProfile");
var avatarBytes = /* @__PURE__ */ __name((value) => {
  if (Array.isArray(value)) return Uint8Array.from(value).buffer;
  if (value instanceof Uint8Array) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return value;
}, "avatarBytes");
var sanitizePng = /* @__PURE__ */ __name((source) => {
  if (source.byteLength < 33 || !PNG_SIGNATURE.every((value, index) => source[index] === value)) {
    throw new ApiError(400, "INVALID_AVATAR", "Avatar is not a valid PNG image.");
  }
  const kept = [source.slice(0, 8)];
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
}, "sanitizePng");
var readUint32 = /* @__PURE__ */ __name((source, offset) => (source[offset] ?? 0) * 16777216 + ((source[offset + 1] ?? 0) << 16) + ((source[offset + 2] ?? 0) << 8) + (source[offset + 3] ?? 0) >>> 0, "readUint32");

// src/social.ts
var listSensorRelationships = /* @__PURE__ */ __name(async (env, user) => {
  const result = await env.DB.prepare(
    `SELECT d.public_id AS sensorId,
       MAX(CASE WHEN r.kind = 'FAVORITE' THEN 1 ELSE 0 END) AS favorite,
       MAX(CASE WHEN r.kind = 'LIKE' THEN 1 ELSE 0 END) AS liked
     FROM sensor_relationships r
     JOIN devices d ON d.id = r.device_id
     WHERE r.user_id = ?1 AND d.is_public = 1 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL
     GROUP BY d.public_id
     ORDER BY MAX(r.created_at) DESC`
  ).bind(user.id).all();
  return json({
    sensors: result.results.map((row) => ({
      sensorId: row.sensorId,
      favorite: row.favorite === 1,
      liked: row.liked === 1
    }))
  });
}, "listSensorRelationships");
var setSensorRelationship = /* @__PURE__ */ __name(async (request, env, user, sensorId, kind, enabled) => {
  await requireCsrf(request, user);
  const sensor = await env.DB.prepare(
    `SELECT id FROM devices
     WHERE public_id = ?1 AND is_public = 1 AND status = 'ACTIVE' AND deleted_at IS NULL`
  ).bind(sensorId).first();
  if (!sensor) throw new ApiError(404, "PUBLIC_SENSOR_NOT_FOUND", "Public sensor was not found.");
  if (enabled) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO sensor_relationships (user_id, device_id, kind, created_at)
       VALUES (?1, ?2, ?3, ?4)`
    ).bind(user.id, sensor.id, kind, (/* @__PURE__ */ new Date()).toISOString()).run();
  } else {
    await env.DB.prepare(
      "DELETE FROM sensor_relationships WHERE user_id = ?1 AND device_id = ?2 AND kind = ?3"
    ).bind(user.id, sensor.id, kind).run();
  }
  return json({ social: await sensorSocial(env, user.id, sensorId) });
}, "setSensorRelationship");
var sensorSocial = /* @__PURE__ */ __name(async (env, userId, sensorId) => {
  const row = await env.DB.prepare(
    `SELECT d.public_id AS sensorId,
       EXISTS(
         SELECT 1 FROM sensor_relationships
         WHERE user_id = ?1 AND device_id = d.id AND kind = 'FAVORITE'
       ) AS favorite,
       EXISTS(
         SELECT 1 FROM sensor_relationships
         WHERE user_id = ?1 AND device_id = d.id AND kind = 'LIKE'
       ) AS liked,
       COALESCE(social.like_count, 0) AS likeCount
     FROM devices d
     LEFT JOIN device_social_rollups social ON social.device_id = d.id
     WHERE d.public_id = ?2 AND d.is_public = 1 AND d.status = 'ACTIVE' AND d.deleted_at IS NULL`
  ).bind(userId, sensorId).first();
  if (!row) throw new ApiError(404, "PUBLIC_SENSOR_NOT_FOUND", "Public sensor was not found.");
  return {
    sensorId: row.sensorId,
    favorite: row.favorite === 1,
    liked: row.liked === 1,
    likeCount: Number(row.likeCount) || 0
  };
}, "sensorSocial");

// src/account.ts
async function deleteOwnAccount(request, env, user) {
  await requireCsrf(request, user);
  if (request.headers.get("Origin") !== env.WEB_ORIGIN) throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.");
  const body = await readJson(request, 256);
  if (!isRecord(body)) throw new ApiError(400, "INVALID_CONFIRMATION", "Account deletion requires explicit confirmation.");
  requireExactKeys(body, ["confirmation"]);
  if (body.confirmation !== "DELETE_MY_ACCOUNT") throw new ApiError(400, "INVALID_CONFIRMATION", "Account deletion requires explicit confirmation.");
  const deleted = await env.DB.prepare(
    `DELETE FROM users WHERE id = ?1 AND EXISTS (
       SELECT 1 FROM sessions WHERE id = ?2 AND user_id = ?1
       AND revoked_at IS NULL AND expires_at > ?3
     ) RETURNING id`
  ).bind(user.id, user.sessionId, (/* @__PURE__ */ new Date()).toISOString()).first();
  if (!deleted) throw new ApiError(401, "SESSION_EXPIRED", "Please sign in again before deleting your account.");
  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie("__Host-gaia_sensor_session", true));
  headers.append("Set-Cookie", clearCookie("__Host-gaia_sensor_csrf", false));
  headers.append("Set-Cookie", clearCookie("__Host-gaia_sensor_oidc", true));
  return json({ ok: true, accountDeleted: true }, 200, headers);
}
__name(deleteOwnAccount, "deleteOwnAccount");

// src/operation-mode.ts
function assertSensorOperationAllowed(request, configuredMode) {
  const mode = configuredMode || "normal";
  if (mode === "normal") return;
  const path = new URL(request.url).pathname;
  if (path === "/api/health" && request.method === "GET") return;
  if (path === "/api/web/v1/logout" && request.method === "POST") return;
  if (path === "/api/web/v1/account" && request.method === "DELETE") return;
  if (mode === "read-only" && ["GET", "HEAD"].includes(request.method) && !path.startsWith("/api/auth/")) return;
  throw new ApiError(503, "SENSOR_MAINTENANCE", "\u30BB\u30F3\u30B5\u30FC\u6A5F\u80FD\u306F\u30E1\u30F3\u30C6\u30CA\u30F3\u30B9\u4E2D\u3067\u3059\u3002\u65B0\u898F\u767B\u9332\u30FB\u5909\u66F4\u30FB\u89B3\u6E2C\u5024\u306E\u9001\u4FE1\u3092\u4E00\u6642\u505C\u6B62\u3057\u3066\u3044\u307E\u3059\u3002");
}
__name(assertSensorOperationAllowed, "assertSensorOperationAllowed");

// src/index.ts
var DEVICE_PATTERN = /^\/api\/web\/v1\/devices\/(dev_[a-z0-9]+)$/u;
var LATEST_PATTERN = /^\/api\/web\/v1\/devices\/(dev_[a-z0-9]+)\/latest$/u;
var HISTORY_PATTERN = /^\/api\/web\/v1\/devices\/(dev_[a-z0-9]+)\/telemetry$/u;
var TELEMETRY_PATTERN = /^\/api\/v1\/devices\/(dev_[a-z0-9]+)\/telemetry$/u;
var PUBLIC_AVATAR_PATTERN = /^\/api\/public\/v1\/profiles\/(usr_[a-z0-9]+)\/avatar$/u;
var SENSOR_RELATIONSHIP_PATTERN = /^\/api\/web\/v1\/sensors\/(sensor_[a-z0-9_]+)\/(favorite|like)$/u;
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();
    try {
      assertTransport(url, env);
      if (request.method === "OPTIONS") return preflight(request, env);
      assertSensorOperationAllowed(request, env.SENSOR_API_MODE);
      const response = await route(request, env, url);
      return secureResponse(response, request, env, requestId);
    } catch (error) {
      if (error instanceof ApiError) {
        const response = errorResponse(error);
        if (url.pathname === "/api/auth/google/callback") response.headers.append("Set-Cookie", clearCookie(OIDC_FLOW_COOKIE, true));
        return secureResponse(response, request, env, requestId);
      }
      console.error(JSON.stringify({ level: "error", event: "request_failed", requestId, method: request.method, path: url.pathname }));
      return secureResponse(errorResponse(new ApiError(500, "INTERNAL_ERROR", "The request could not be completed.")), request, env, requestId);
    }
  }
};
var route = /* @__PURE__ */ __name(async (request, env, url) => {
  if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true, service: "gaia-senseware-sensor-platform" });
  if (request.method === "GET" && url.pathname === "/api/auth/google/start") return startGoogleLogin(request, env);
  if (request.method === "GET" && url.pathname === "/api/auth/google/callback") return finishGoogleLogin(request, env);
  if (request.method === "POST" && url.pathname === "/api/auth/trial") return startTrialSession(request, env);
  if (request.method === "GET" && url.pathname === "/api/web/v1/session") return sessionResponse(request, env);
  if (request.method === "POST" && url.pathname === "/api/web/v1/logout") return logout(request, env);
  if (request.method === "POST" && url.pathname === "/api/v1/device/pair") return pairDevice(request, env);
  if (request.method === "GET" && url.pathname === "/api/public/v1/sensors") return listPublicSensors(env);
  if (request.method === "GET" && url.pathname === "/api/public/v1/measurement-types") return listMeasurementTypes();
  const publicAvatarMatch = PUBLIC_AVATAR_PATTERN.exec(url.pathname);
  if (request.method === "GET" && publicAvatarMatch?.[1]) return getPublicAvatar(env, publicAvatarMatch[1]);
  const telemetryMatch = TELEMETRY_PATTERN.exec(url.pathname);
  if (request.method === "POST" && telemetryMatch?.[1]) return acceptTelemetry(request, env, telemetryMatch[1]);
  if (request.method === "GET" && url.pathname === "/api/web/v1/countries") {
    await getAuthenticatedUser(request, env);
    return listCountries(env);
  }
  const user = await getAuthenticatedUser(request, env);
  if (request.method === "DELETE" && url.pathname === "/api/web/v1/account") return deleteOwnAccount(request, env, user);
  if (request.method === "GET" && url.pathname === "/api/web/v1/regions") return listRegions(url);
  if (request.method === "GET" && url.pathname === "/api/web/v1/region-location") return locateRegion(url, env);
  if (request.method === "GET" && url.pathname === "/api/web/v1/profile") return getProfile(env, user);
  if (request.method === "PATCH" && url.pathname === "/api/web/v1/profile") return updateProfile(request, env, user);
  if (request.method === "PUT" && url.pathname === "/api/web/v1/profile/avatar") return uploadAvatar(request, env, user);
  if (request.method === "DELETE" && url.pathname === "/api/web/v1/profile/avatar") return deleteAvatar(request, env, user);
  if (request.method === "GET" && url.pathname === "/api/web/v1/devices") return listDevices(env, user);
  if (request.method === "POST" && url.pathname === "/api/web/v1/devices/pairing") return createPairing(request, env, user);
  if (request.method === "GET" && url.pathname === "/api/web/v1/social") return listSensorRelationships(env, user);
  const relationshipMatch = SENSOR_RELATIONSHIP_PATTERN.exec(url.pathname);
  if ((request.method === "PUT" || request.method === "DELETE") && relationshipMatch?.[1] && relationshipMatch[2]) {
    return setSensorRelationship(
      request,
      env,
      user,
      relationshipMatch[1],
      relationshipMatch[2] === "favorite" ? "FAVORITE" : "LIKE",
      request.method === "PUT"
    );
  }
  const latestMatch = LATEST_PATTERN.exec(url.pathname);
  if (request.method === "GET" && latestMatch?.[1]) return getLatest(env, user, latestMatch[1]);
  const historyMatch = HISTORY_PATTERN.exec(url.pathname);
  if (request.method === "GET" && historyMatch?.[1]) return getHistory(env, user, historyMatch[1], url);
  const deviceMatch = DEVICE_PATTERN.exec(url.pathname);
  if (deviceMatch?.[1]) {
    if (request.method === "GET") return getDevice(env, user, deviceMatch[1]);
    if (request.method === "PATCH") return updateDevice(request, env, user, deviceMatch[1]);
    if (request.method === "DELETE") return revokeDevice(request, env, user, deviceMatch[1]);
  }
  throw new ApiError(404, "NOT_FOUND", "Endpoint was not found.");
}, "route");
var assertTransport = /* @__PURE__ */ __name((url, env) => {
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(env.ENVIRONMENT === "local" && local)) {
    throw new ApiError(400, "HTTPS_REQUIRED", "HTTPS is required.");
  }
}, "assertTransport");
var preflight = /* @__PURE__ */ __name((request, env) => {
  const origin = request.headers.get("Origin");
  if (origin !== env.WEB_ORIGIN) throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.");
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
      "Access-Control-Max-Age": "600",
      Vary: "Origin"
    }
  });
}, "preflight");
var secureResponse = /* @__PURE__ */ __name((response, request, env, requestId) => {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  if (response.status === 503) headers.set("Retry-After", "300");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=(), bluetooth=()");
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  const origin = request.headers.get("Origin");
  if (origin === env.WEB_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.append("Vary", "Origin");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}, "secureResponse");

// src/prefecture-field.ts
var PREFECTURE_PROVIDERS = {
  weather: {
    url: "https://api.open-meteo.com/v1/forecast",
    ttl: 3e5,
    variables: { weatherWindSpeed: "wind_speed_10m", weatherTemperature: "temperature_2m", weatherPrecipitation: "precipitation", cloudCover: "cloud_cover" }
  },
  air: {
    url: "https://air-quality-api.open-meteo.com/v1/air-quality",
    ttl: 36e5,
    variables: { forecastCo2: "carbon_dioxide", pm25: "pm2_5" }
  }
};
var version = "japan-prefecture-models-v2-hourly";
var numberOrNull = /* @__PURE__ */ __name((value) => typeof value === "number" && Number.isFinite(value) ? value : null, "numberOrNull");
var emptyPrefectureField = /* @__PURE__ */ __name((provider, cities, reason) => ({
  schemaVersion: 1,
  source: "unavailable",
  generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
  points: cities.map((city) => ({
    ...city,
    observedAt: null,
    measurements: Object.fromEntries(Object.keys(PREFECTURE_PROVIDERS[provider].variables).map((key) => [key, null]))
  })),
  provenance: { sourceUrl: PREFECTURE_PROVIDERS[provider].url, licenseUrl: "https://open-meteo.com/en/pricing", transformVersion: version },
  fallbackReason: reason
}), "emptyPrefectureField");
var fetchPrefectureField = /* @__PURE__ */ __name(async (provider, cities) => {
  const definition = PREFECTURE_PROVIDERS[provider];
  const url = new URL(definition.url);
  url.search = new URLSearchParams({
    latitude: cities.map((city) => city.lat).join(","),
    longitude: cities.map((city) => city.lon).join(","),
    current: Object.values(definition.variables).join(","),
    hourly: Object.values(definition.variables).join(","),
    past_days: "1",
    timezone: "GMT",
    forecast_days: "1",
    ...provider === "weather" ? { wind_speed_unit: "ms" } : {}
  }).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1e4);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Open-Meteo ${provider} ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Open-Meteo body missing");
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1e6) {
        await reader.cancel();
        throw new Error("Open-Meteo body too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const locations = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(locations) || locations.length !== cities.length) throw new Error(`Open-Meteo ${provider} location count mismatch`);
    const field = emptyPrefectureField(provider, cities, "");
    field.source = "open-meteo";
    delete field.fallbackReason;
    field.provenance.sourceUrl = url.href;
    field.points = cities.map((city, index) => {
      const current = locations[index]?.current;
      const rawTime = current?.time;
      const time = typeof rawTime === "string" ? Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/u.test(rawTime) ? rawTime : `${rawTime}Z`) : NaN;
      const observedAt = Number.isFinite(time) ? new Date(time).toISOString() : null;
      return { ...city, observedAt, measurements: Object.fromEntries(Object.entries(definition.variables).map(([key, variable]) => [key, observedAt ? numberOrNull(current?.[variable]) : null])) };
    });
    const latestHour = Math.floor(Date.now() / 36e5) * 36e5;
    const normalizeTime = /* @__PURE__ */ __name((raw) => {
      if (typeof raw !== "string") return null;
      const time = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/u.test(raw) ? raw : `${raw}Z`);
      return Number.isFinite(time) && time <= latestHour && time >= latestHour - 23 * 36e5 ? new Date(time).toISOString() : null;
    }, "normalizeTime");
    const timesByCity = locations.map((location) => {
      const times2 = location?.hourly?.time;
      return new Map((Array.isArray(times2) ? times2.slice(0, 48) : []).map((time, index) => [normalizeTime(time), index]));
    });
    const times = [...new Set(timesByCity.flatMap((index) => [...index.keys()].filter((time) => time !== null)))].sort();
    field.history = times.map((observedAt) => ({ observedAt, points: cities.map((city, index) => {
      const sampleIndex = timesByCity[index]?.get(observedAt);
      return { ...city, observedAt, measurements: Object.fromEntries(Object.entries(definition.variables).map(([key, variable]) => {
        const values = locations[index]?.hourly?.[variable];
        return [key, sampleIndex !== void 0 && Array.isArray(values) ? numberOrNull(values[sampleIndex]) : null];
      })) };
    }) }));
    if (!field.points.some((point) => Object.values(point.measurements).some((value) => value !== null))) throw new Error(`Open-Meteo ${provider} values missing`);
    return field;
  } finally {
    clearTimeout(timeout);
  }
}, "fetchPrefectureField");
var cachedPrefectureField = /* @__PURE__ */ __name(async (provider, cities, enabled, ctx) => {
  const cacheKey = new Request(`https://gaia-live-cache.invalid/${version}/${provider}`);
  const cache = caches.default;
  let cached;
  try {
    cached = await (await cache.match(cacheKey))?.json();
  } catch {
  }
  if (cached && Date.now() - Date.parse(cached.generatedAt) < PREFECTURE_PROVIDERS[provider].ttl) return cached;
  try {
    if (!enabled) throw new Error("LIVE_SENSEWARE_ENABLED is not true");
    const field = await fetchPrefectureField(provider, cities);
    ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(field), { headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=604800"
    } })).catch(() => {
    }));
    return field;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "National model unavailable";
    return cached ? { ...cached, source: "stale-cache", fallbackReason: reason } : emptyPrefectureField(provider, cities, reason);
  }
}, "cachedPrefectureField");

// src/live-senseware.ts
var HAWAII_BBOX = [-156.2, 18.8, -154.7, 20.3];
var HAWAII_CENTER = { lat: 19.55, lon: -155.45 };
var CITY_LOCATIONS = Object.freeze({
  sapporo: Object.freeze({ id: "sapporo", name: "\u5317\u6D77\u9053\u30FB\u672D\u5E4C", lat: 43.0618, lon: 141.3545 }),
  aomori: Object.freeze({ id: "aomori", name: "\u9752\u68EE\u770C\u30FB\u9752\u68EE", lat: 40.8244, lon: 140.74 }),
  morioka: Object.freeze({ id: "morioka", name: "\u5CA9\u624B\u770C\u30FB\u76DB\u5CA1", lat: 39.7036, lon: 141.1527 }),
  sendai: Object.freeze({ id: "sendai", name: "\u5BAE\u57CE\u770C\u30FB\u4ED9\u53F0", lat: 38.2682, lon: 140.8694 }),
  akita: Object.freeze({ id: "akita", name: "\u79CB\u7530\u770C\u30FB\u79CB\u7530", lat: 39.7186, lon: 140.1024 }),
  yamagata: Object.freeze({ id: "yamagata", name: "\u5C71\u5F62\u770C\u30FB\u5C71\u5F62", lat: 38.2404, lon: 140.3633 }),
  fukushima: Object.freeze({ id: "fukushima", name: "\u798F\u5CF6\u770C\u30FB\u798F\u5CF6", lat: 37.7503, lon: 140.4676 }),
  mito: Object.freeze({ id: "mito", name: "\u8328\u57CE\u770C\u30FB\u6C34\u6238", lat: 36.3418, lon: 140.4468 }),
  utsunomiya: Object.freeze({ id: "utsunomiya", name: "\u6803\u6728\u770C\u30FB\u5B87\u90FD\u5BAE", lat: 36.5658, lon: 139.8836 }),
  maebashi: Object.freeze({ id: "maebashi", name: "\u7FA4\u99AC\u770C\u30FB\u524D\u6A4B", lat: 36.3911, lon: 139.0608 }),
  saitama: Object.freeze({ id: "saitama", name: "\u57FC\u7389\u770C\u30FB\u3055\u3044\u305F\u307E", lat: 35.8569, lon: 139.6489 }),
  chiba: Object.freeze({ id: "chiba", name: "\u5343\u8449\u770C\u30FB\u5343\u8449", lat: 35.6074, lon: 140.1065 }),
  tokyo: Object.freeze({ id: "tokyo", name: "\u6771\u4EAC\u90FD\u30FB\u6771\u4EAC", lat: 35.6762, lon: 139.6503 }),
  yokohama: Object.freeze({ id: "yokohama", name: "\u795E\u5948\u5DDD\u770C\u30FB\u6A2A\u6D5C", lat: 35.4437, lon: 139.638 }),
  niigata: Object.freeze({ id: "niigata", name: "\u65B0\u6F5F\u770C\u30FB\u65B0\u6F5F", lat: 37.9026, lon: 139.0232 }),
  toyama: Object.freeze({ id: "toyama", name: "\u5BCC\u5C71\u770C\u30FB\u5BCC\u5C71", lat: 36.6953, lon: 137.2113 }),
  kanazawa: Object.freeze({ id: "kanazawa", name: "\u77F3\u5DDD\u770C\u30FB\u91D1\u6CA2", lat: 36.5613, lon: 136.6562 }),
  fukui: Object.freeze({ id: "fukui", name: "\u798F\u4E95\u770C\u30FB\u798F\u4E95", lat: 36.0652, lon: 136.2216 }),
  kofu: Object.freeze({ id: "kofu", name: "\u5C71\u68A8\u770C\u30FB\u7532\u5E9C", lat: 35.6642, lon: 138.5684 }),
  nagano: Object.freeze({ id: "nagano", name: "\u9577\u91CE\u770C\u30FB\u9577\u91CE", lat: 36.6513, lon: 138.181 }),
  gifu: Object.freeze({ id: "gifu", name: "\u5C90\u961C\u770C\u30FB\u5C90\u961C", lat: 35.4233, lon: 136.7606 }),
  shizuoka: Object.freeze({ id: "shizuoka", name: "\u9759\u5CA1\u770C\u30FB\u9759\u5CA1", lat: 34.9756, lon: 138.3828 }),
  nagoya: Object.freeze({ id: "nagoya", name: "\u611B\u77E5\u770C\u30FB\u540D\u53E4\u5C4B", lat: 35.1815, lon: 136.9066 }),
  tsu: Object.freeze({ id: "tsu", name: "\u4E09\u91CD\u770C\u30FB\u6D25", lat: 34.7303, lon: 136.5086 }),
  otsu: Object.freeze({ id: "otsu", name: "\u6ECB\u8CC0\u770C\u30FB\u5927\u6D25", lat: 35.0179, lon: 135.8546 }),
  kyoto: Object.freeze({ id: "kyoto", name: "\u4EAC\u90FD\u5E9C\u30FB\u4EAC\u90FD", lat: 35.0116, lon: 135.7681 }),
  osaka: Object.freeze({ id: "osaka", name: "\u5927\u962A\u5E9C\u30FB\u5927\u962A", lat: 34.6937, lon: 135.5023 }),
  kobe: Object.freeze({ id: "kobe", name: "\u5175\u5EAB\u770C\u30FB\u795E\u6238", lat: 34.6901, lon: 135.1955 }),
  nara: Object.freeze({ id: "nara", name: "\u5948\u826F\u770C\u30FB\u5948\u826F", lat: 34.6851, lon: 135.8048 }),
  wakayama: Object.freeze({ id: "wakayama", name: "\u548C\u6B4C\u5C71\u770C\u30FB\u548C\u6B4C\u5C71", lat: 34.226, lon: 135.1675 }),
  tottori: Object.freeze({ id: "tottori", name: "\u9CE5\u53D6\u770C\u30FB\u9CE5\u53D6", lat: 35.5011, lon: 134.2351 }),
  matsue: Object.freeze({ id: "matsue", name: "\u5CF6\u6839\u770C\u30FB\u677E\u6C5F", lat: 35.4681, lon: 133.0484 }),
  okayama: Object.freeze({ id: "okayama", name: "\u5CA1\u5C71\u770C\u30FB\u5CA1\u5C71", lat: 34.6618, lon: 133.9344 }),
  hiroshima: Object.freeze({ id: "hiroshima", name: "\u5E83\u5CF6\u770C\u30FB\u5E83\u5CF6", lat: 34.3853, lon: 132.4553 }),
  yamaguchi: Object.freeze({ id: "yamaguchi", name: "\u5C71\u53E3\u770C\u30FB\u5C71\u53E3", lat: 34.1859, lon: 131.4714 }),
  tokushima: Object.freeze({ id: "tokushima", name: "\u5FB3\u5CF6\u770C\u30FB\u5FB3\u5CF6", lat: 34.0703, lon: 134.5548 }),
  takamatsu: Object.freeze({ id: "takamatsu", name: "\u9999\u5DDD\u770C\u30FB\u9AD8\u677E", lat: 34.3428, lon: 134.0466 }),
  matsuyama: Object.freeze({ id: "matsuyama", name: "\u611B\u5A9B\u770C\u30FB\u677E\u5C71", lat: 33.8392, lon: 132.7657 }),
  kochi: Object.freeze({ id: "kochi", name: "\u9AD8\u77E5\u770C\u30FB\u9AD8\u77E5", lat: 33.5597, lon: 133.5311 }),
  fukuoka: Object.freeze({ id: "fukuoka", name: "\u798F\u5CA1\u770C\u30FB\u798F\u5CA1", lat: 33.5904, lon: 130.4017 }),
  saga: Object.freeze({ id: "saga", name: "\u4F50\u8CC0\u770C\u30FB\u4F50\u8CC0", lat: 33.2635, lon: 130.3009 }),
  nagasaki: Object.freeze({ id: "nagasaki", name: "\u9577\u5D0E\u770C\u30FB\u9577\u5D0E", lat: 32.7503, lon: 129.8777 }),
  kumamoto: Object.freeze({ id: "kumamoto", name: "\u718A\u672C\u770C\u30FB\u718A\u672C", lat: 32.8031, lon: 130.7079 }),
  oita: Object.freeze({ id: "oita", name: "\u5927\u5206\u770C\u30FB\u5927\u5206", lat: 33.2382, lon: 131.6126 }),
  miyazaki: Object.freeze({ id: "miyazaki", name: "\u5BAE\u5D0E\u770C\u30FB\u5BAE\u5D0E", lat: 31.9077, lon: 131.4202 }),
  kagoshima: Object.freeze({ id: "kagoshima", name: "\u9E7F\u5150\u5CF6\u770C\u30FB\u9E7F\u5150\u5CF6", lat: 31.5966, lon: 130.5571 }),
  naha: Object.freeze({ id: "naha", name: "\u6C96\u7E04\u770C\u30FB\u90A3\u8987", lat: 26.2124, lon: 127.6809 })
});
var DEFAULT_CITY = CITY_LOCATIONS.sapporo;
var cityBbox = /* @__PURE__ */ __name((city) => [city.lon - 0.3, city.lat - 0.25, city.lon + 0.3, city.lat + 0.25], "cityBbox");
var resolveObservationCity = /* @__PURE__ */ __name((value) => CITY_LOCATIONS[value] || DEFAULT_CITY, "resolveObservationCity");
var TRANSFORM_VERSION = "live-senseware-v5-japan-wind-field";
var STREAM_LIFETIME_MS = 10 * 60 * 1e3;
var STREAM_REFRESH_MS = 5 * 60 * 1e3;
var HEARTBEAT_MS = 15e3;
var FIRMS_SOURCE_URL = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv";
var FIRMS_SOURCE_PAGE = "https://firms.modaps.eosdis.nasa.gov/active_fire/";
var FIRMS_CACHE_KEY = "nasa-firms-modis-global-24h-v1";
var FIRMS_TTL_MS = 15 * 60 * 1e3;
var FIRMS_MAX_SOURCE_BYTES = 4e6;
var FIRMS_MAX_POINTS = 1600;
var FIRMS_CONFIDENCE_MIN = 60;
var FIRMS_SPATIAL_BIN_DEGREES = 2.5;
var FIRMS_TIME_BIN_MINUTES = 60;
var jsonHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff"
});
var fetchWithTimeout = /* @__PURE__ */ __name(async (input, init = {}, timeoutMs = 12e3) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("upstream-timeout"), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}, "fetchWithTimeout");
var sourceHeaders = /* @__PURE__ */ __name((response) => ({
  upstreamEtag: response.headers.get("ETag") || void 0,
  upstreamLastModified: response.headers.get("Last-Modified") || void 0
}), "sourceHeaders");
var conditionalHeaders = /* @__PURE__ */ __name((cached) => {
  const headers = new Headers({ Accept: "application/json,text/plain;q=0.9,*/*;q=0.5" });
  if (cached?.upstreamEtag) headers.set("If-None-Match", cached.upstreamEtag);
  if (cached?.upstreamLastModified) headers.set("If-Modified-Since", cached.upstreamLastModified);
  return headers;
}, "conditionalHeaders");
var cacheRequest = /* @__PURE__ */ __name((key) => new Request(`https://gaia-live-cache.invalid/${encodeURIComponent(key)}`), "cacheRequest");
var liveCache = /* @__PURE__ */ __name(() => caches.default, "liveCache");
var readCacheJson = /* @__PURE__ */ __name(async (key) => {
  const response = await liveCache().match(cacheRequest(key));
  if (!response) return void 0;
  try {
    return await response.json();
  } catch {
    return void 0;
  }
}, "readCacheJson");
var writeCacheJson = /* @__PURE__ */ __name(async (key, payload) => {
  const response = new Response(JSON.stringify(payload), {
    headers: { "Cache-Control": "public, max-age=604800", "Content-Type": "application/json" }
  });
  await liveCache().put(cacheRequest(key), response);
}, "writeCacheJson");
var readCached = /* @__PURE__ */ __name((key) => readCacheJson(key), "readCached");
var writeCached = /* @__PURE__ */ __name((key, cached) => writeCacheJson(key, cached), "writeCached");
var firmsPointScore = /* @__PURE__ */ __name((point) => Math.log1p(point.frp) * (0.55 + point.confidence / 200) + (point.daynight === "N" ? 0.04 : 0), "firmsPointScore");
var firmsAcquiredAt = /* @__PURE__ */ __name((date, time) => {
  const digits = String(time || "").padStart(4, "0");
  const value = `${date}T${digits.slice(0, 2)}:${digits.slice(2)}:00Z`;
  return Number.isFinite(Date.parse(value)) ? value : "";
}, "firmsAcquiredAt");
var compactFirmsCsv = /* @__PURE__ */ __name((csv) => {
  const lines = csv.trim().split(/\r?\n/u);
  const header = lines.shift()?.split(",") || [];
  const columns = new Map(header.map((name, index) => [name.trim(), index]));
  const indexOf = /* @__PURE__ */ __name((name) => {
    const index = columns.get(name);
    if (index === void 0) throw new Error(`FIRMS column missing: ${name}`);
    return index;
  }, "indexOf");
  const latitudeIndex = indexOf("latitude");
  const longitudeIndex = indexOf("longitude");
  const brightnessIndex = indexOf("brightness");
  const dateIndex = indexOf("acq_date");
  const timeIndex = indexOf("acq_time");
  const satelliteIndex = indexOf("satellite");
  const confidenceIndex = indexOf("confidence");
  const frpIndex = indexOf("frp");
  const daynightIndex = indexOf("daynight");
  const bins = /* @__PURE__ */ new Map();
  let detected = 0;
  for (const line of lines) {
    if (!line) continue;
    const cells = line.split(",");
    const lat = Number(cells[latitudeIndex]);
    const lon = Number(cells[longitudeIndex]);
    const brightness = Number(cells[brightnessIndex]);
    const frp = Number(cells[frpIndex]);
    const confidence = Number(cells[confidenceIndex]);
    const acquiredAt = firmsAcquiredAt(cells[dateIndex] || "", cells[timeIndex] || "");
    const daynight = cells[daynightIndex] === "N" ? "N" : "D";
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) || !Number.isFinite(brightness) || !(frp >= 0) || confidence < FIRMS_CONFIDENCE_MIN || !acquiredAt) continue;
    detected += 1;
    const point = {
      id: `${cells[satelliteIndex] || "M"}:${acquiredAt}:${lat.toFixed(5)}:${lon.toFixed(5)}`,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      brightness: Number(brightness.toFixed(2)),
      frp: Number(frp.toFixed(2)),
      confidence: Math.round(confidence),
      daynight,
      acquiredAt,
      satellite: cells[satelliteIndex] || "MODIS"
    };
    const minutes = Math.floor(Date.parse(acquiredAt) / 6e4 / FIRMS_TIME_BIN_MINUTES);
    const key = `${Math.floor((lon + 180) / FIRMS_SPATIAL_BIN_DEGREES)}:${Math.floor((lat + 90) / FIRMS_SPATIAL_BIN_DEGREES)}:${minutes}`;
    const previous = bins.get(key);
    if (!previous || firmsPointScore(point) > firmsPointScore(previous)) bins.set(key, point);
  }
  const points = [...bins.values()].sort((left, right) => firmsPointScore(right) - firmsPointScore(left)).slice(0, FIRMS_MAX_POINTS).sort((left, right) => left.acquiredAt.localeCompare(right.acquiredAt) || left.id.localeCompare(right.id));
  if (!points.length) throw new Error("FIRMS feed contains no usable detections");
  return {
    points,
    summary: {
      detected,
      displayed: points.length,
      maxFrp: Number(Math.max(...points.map((point) => point.frp)).toFixed(2)),
      totalFrp: Number(points.reduce((sum, point) => sum + point.frp, 0).toFixed(2)),
      nightShare: Number((points.filter((point) => point.daynight === "N").length / points.length).toFixed(4)),
      highConfidenceShare: Number((points.filter((point) => point.confidence >= 80).length / points.length).toFixed(4)),
      start: points[0]?.acquiredAt || "",
      end: points.at(-1)?.acquiredAt || ""
    }
  };
}, "compactFirmsCsv");
var freshFirmsSnapshot = /* @__PURE__ */ __name(async (cached) => {
  const headers = conditionalHeaders(cached);
  headers.set("Accept", "text/csv");
  const response = await fetchWithTimeout(FIRMS_SOURCE_URL, { headers }, 15e3);
  if (response.status === 304 && cached) {
    return { ...cached, retrievedAt: (/* @__PURE__ */ new Date()).toISOString(), snapshot: { ...cached.snapshot, source: "nasa-firms-modis", fallbackReason: void 0 } };
  }
  if (!response.ok) throw new Error(`NASA FIRMS ${response.status}`);
  const contentLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > FIRMS_MAX_SOURCE_BYTES) {
    throw new Error(`NASA FIRMS response exceeds ${FIRMS_MAX_SOURCE_BYTES} bytes`);
  }
  const csv = await response.text();
  if (new TextEncoder().encode(csv).byteLength > FIRMS_MAX_SOURCE_BYTES) {
    throw new Error(`NASA FIRMS response exceeds ${FIRMS_MAX_SOURCE_BYTES} bytes`);
  }
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const compacted = compactFirmsCsv(csv);
  return {
    snapshot: {
      schemaVersion: 1,
      source: "nasa-firms-modis",
      generatedAt,
      ...compacted,
      provenance: {
        provider: "NASA LANCE FIRMS",
        dataset: "MODIS Collection 6.1 NRT Global 24h",
        sourceUrl: FIRMS_SOURCE_URL,
        sourcePage: FIRMS_SOURCE_PAGE,
        resolution: "1 km nominal",
        transformVersion: "firms-global-fire-v1",
        filters: {
          confidenceMin: FIRMS_CONFIDENCE_MIN,
          spatialBinDegrees: FIRMS_SPATIAL_BIN_DEGREES,
          timeBinMinutes: FIRMS_TIME_BIN_MINUTES,
          maxPoints: FIRMS_MAX_POINTS,
          method: "highest FRP-weighted confidence detection per space-time bin"
        }
      }
    },
    retrievedAt: generatedAt,
    upstreamEtag: response.headers.get("ETag") || void 0,
    upstreamLastModified: response.headers.get("Last-Modified") || void 0
  };
}, "freshFirmsSnapshot");
var eventAge = /* @__PURE__ */ __name((event) => Date.now() - Date.parse(event.retrievedAt), "eventAge");
var withStaleStatus = /* @__PURE__ */ __name((cached, reason) => ({
  ...cached.event,
  status: "stale",
  fallbackReason: reason
}), "withStaleStatus");
var loadCachedProvider = /* @__PURE__ */ __name(async (definition, ctx) => {
  const cached = await readCached(definition.cacheKey);
  if (cached && eventAge(cached.event) < definition.ttlMs) return cached.event;
  try {
    const fresh = await definition.load(conditionalHeaders(cached));
    ctx.waitUntil(writeCached(definition.cacheKey, fresh));
    return fresh.event;
  } catch (error) {
    if (cached && error instanceof Error && /(?:304|not-modified)/iu.test(error.message)) {
      const refreshed = { ...cached, event: { ...cached.event, retrievedAt: (/* @__PURE__ */ new Date()).toISOString() } };
      ctx.waitUntil(writeCached(definition.cacheKey, refreshed));
      return refreshed.event;
    }
    if (cached) return withStaleStatus(cached, error instanceof Error ? error.message : "upstream-failure");
    throw error;
  }
}, "loadCachedProvider");
var degrees = /* @__PURE__ */ __name((value) => value * Math.PI / 180, "degrees");
var distanceKm = /* @__PURE__ */ __name((lat, lon) => {
  const deltaLat = degrees(lat - HAWAII_CENTER.lat);
  const deltaLon = degrees(lon - HAWAII_CENTER.lon);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(degrees(HAWAII_CENTER.lat)) * Math.cos(degrees(lat)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}, "distanceKm");
var loadNdbc = /* @__PURE__ */ __name(async (headers) => {
  const sourceUrl = "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt";
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("not-modified-without-refresh");
  if (!response.ok) throw new Error(`NDBC ${response.status}`);
  const candidates = (await response.text()).split(/\r?\n/u).slice(2).map((line) => line.trim().split(/\s+/u)).map((columns) => {
    const lat = Number(columns[1]);
    const lon = Number(columns[2]);
    const wind = Number(columns[9]);
    const temperature = Number(columns[16]);
    const observedAt = `${columns[3]}-${columns[4]}-${columns[5]}T${columns[6]}:${columns[7]}:00Z`;
    return { station: columns[0] || "unknown", lat, lon, wind, temperature, observedAt };
  }).filter((row2) => Number.isFinite(row2.lat) && Number.isFinite(row2.lon) && (Number.isFinite(row2.wind) || Number.isFinite(row2.temperature))).sort((left, right) => distanceKm(left.lat, left.lon) - distanceKm(right.lat, right.lon));
  const row = candidates[0];
  if (!row) throw new Error("NDBC valid station missing");
  const retrievedAt = (/* @__PURE__ */ new Date()).toISOString();
  const status = Date.now() - Date.parse(row.observedAt) <= 3 * 60 * 60 * 1e3 ? "near-real-time" : "stale";
  return {
    event: {
      schemaVersion: 1,
      eventId: `noaa:ndbc:${row.station}:${row.observedAt}`,
      provider: "noaa",
      datasetId: `NDBC latest observations / ${row.station}`,
      status,
      observedAt: row.observedAt,
      retrievedAt,
      location: { label: `NDBC ${row.station} (${Math.round(distanceKm(row.lat, row.lon))} km from bbox center)`, lat: row.lat, lon: row.lon, bbox: HAWAII_BBOX },
      measurements: [
        { key: "windSpeed", value: Number.isFinite(row.wind) ? row.wind : null, unit: "m/s", quality: Number.isFinite(row.wind) ? "valid" : "missing", sourceKind: "SOURCE" },
        { key: "airTemperature", value: Number.isFinite(row.temperature) ? row.temperature : null, unit: "degree C", quality: Number.isFinite(row.temperature) ? "valid" : "missing", sourceKind: "SOURCE" }
      ],
      provenance: { sourceUrl, licenseUrl: "https://www.noaa.gov/information-technology/open-data-dissemination", transformVersion: TRANSFORM_VERSION }
    },
    ...sourceHeaders(response)
  };
}, "loadNdbc");
var loadCo2 = /* @__PURE__ */ __name(async (headers) => {
  const sourceUrl = "https://erddap.gml.noaa.gov/erddap/tabledap/greenhouse_gases_co2_insitu_hourly_averages_surface.csv?time,site_code,latitude,longitude,value&site_code=%22MLO%22&orderByMax(%22time%22)";
  headers.set("Accept", "text/csv");
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("NOAA GML 304 not-modified");
  if (!response.ok) throw new Error(`NOAA GML ${response.status}`);
  const rows = (await response.text()).trim().split(/\r?\n/u);
  const values = rows.at(-1)?.split(",");
  const observedAt = values?.[0] || "";
  const lat = Number(values?.[2]);
  const lon = Number(values?.[3]);
  const co2 = Number(values?.[4]);
  if (!observedAt || !Number.isFinite(co2)) throw new Error("NOAA GML malformed value");
  return {
    event: {
      schemaVersion: 1,
      eventId: `noaa:gml-mlo-co2:${observedAt}`,
      provider: "noaa",
      datasetId: "NOAA GML Mauna Loa hourly CO2",
      status: "latest-published",
      observedAt,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString(),
      location: { label: "Mauna Loa Observatory", lat, lon, bbox: HAWAII_BBOX },
      measurements: [{ key: "co2", value: co2, unit: "micromol mol-1", quality: "valid", sourceKind: "SOURCE" }],
      provenance: { sourceUrl, licenseUrl: "https://gml.noaa.gov/ccgg/about/co2_measurements.html", transformVersion: TRANSFORM_VERSION }
    },
    ...sourceHeaders(response)
  };
}, "loadCo2");
var openMeteoObservedAt = /* @__PURE__ */ __name((value) => {
  if (!value) throw new Error("Open-Meteo current time missing");
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/u.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error("Open-Meteo current time malformed");
  return date.toISOString();
}, "openMeteoObservedAt");
var numericOrNull = /* @__PURE__ */ __name((value) => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}, "numericOrNull");
var loadOpenMeteoWeather = /* @__PURE__ */ __name(async (headers, city) => {
  const sourceUrl = new URL("https://api.open-meteo.com/v1/forecast");
  sourceUrl.search = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: "temperature_2m,precipitation,cloud_cover,wind_speed_10m",
    wind_speed_unit: "ms",
    timezone: "GMT",
    forecast_days: "1"
  }).toString();
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("Open-Meteo weather 304 not-modified");
  if (!response.ok) throw new Error(`Open-Meteo weather ${response.status}`);
  const current = (await response.json()).current;
  if (!current) throw new Error("Open-Meteo weather current missing");
  const observedAt = openMeteoObservedAt(current.time);
  const wind = numericOrNull(current.wind_speed_10m);
  const temperature = numericOrNull(current.temperature_2m);
  const precipitation = numericOrNull(current.precipitation);
  const cloudCover = numericOrNull(current.cloud_cover);
  if ([wind, temperature, precipitation, cloudCover].every((value) => value === null)) throw new Error("Open-Meteo weather values missing");
  return {
    event: {
      schemaVersion: 1,
      eventId: `open-meteo:${city.id}-weather:${observedAt}`,
      provider: "open-meteo",
      datasetId: `Open-Meteo Best Match / ${city.name} current weather`,
      status: "near-real-time",
      observedAt,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString(),
      location: { label: `Open-Meteo / ${city.name}`, lat: city.lat, lon: city.lon, bbox: cityBbox(city) },
      measurements: [
        { key: "weatherWindSpeed", value: wind, unit: "m/s", quality: wind === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "weatherTemperature", value: temperature, unit: "\u2103", quality: temperature === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "weatherPrecipitation", value: precipitation, unit: "mm", quality: precipitation === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "cloudCover", value: cloudCover, unit: "%", quality: cloudCover === null ? "missing" : "estimated", sourceKind: "MODEL" }
      ],
      provenance: { sourceUrl: sourceUrl.href, licenseUrl: "https://open-meteo.com/en/pricing", transformVersion: TRANSFORM_VERSION }
    },
    ...sourceHeaders(response)
  };
}, "loadOpenMeteoWeather");
var liveWindField = /* @__PURE__ */ __name(async (env, ctx) => {
  const field = await cachedPrefectureField("weather", Object.values(CITY_LOCATIONS), env.LIVE_SENSEWARE_ENABLED === "true", ctx);
  return { ...field, points: field.points.map((point) => ({
    ...point,
    windSpeed: point.measurements.weatherWindSpeed ?? null,
    quality: point.measurements.weatherWindSpeed == null ? "missing" : "estimated"
  })) };
}, "liveWindField");
var loadOpenMeteoAir = /* @__PURE__ */ __name(async (headers, city) => {
  const sourceUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  sourceUrl.search = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: "carbon_dioxide,pm2_5",
    timezone: "GMT",
    forecast_days: "1"
  }).toString();
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("Open-Meteo air quality 304 not-modified");
  if (!response.ok) throw new Error(`Open-Meteo air quality ${response.status}`);
  const current = (await response.json()).current;
  if (!current) throw new Error("Open-Meteo air quality current missing");
  const observedAt = openMeteoObservedAt(current.time);
  const co2 = numericOrNull(current.carbon_dioxide);
  const pm25 = numericOrNull(current.pm2_5);
  if (co2 === null && pm25 === null) throw new Error("Open-Meteo air quality values missing");
  return {
    event: {
      schemaVersion: 1,
      eventId: `open-meteo:${city.id}-cams:${observedAt}`,
      provider: "open-meteo",
      datasetId: "Open-Meteo / CAMS global atmosphere forecast",
      status: "latest-published",
      observedAt,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString(),
      location: { label: `CAMS\u30E2\u30C7\u30EB / ${city.name}\u683C\u5B50`, lat: city.lat, lon: city.lon, bbox: cityBbox(city) },
      measurements: [
        { key: "forecastCo2", value: co2, unit: "ppm", quality: co2 === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "pm25", value: pm25, unit: "\xB5g/m\xB3", quality: pm25 === null ? "missing" : "estimated", sourceKind: "MODEL" }
      ],
      provenance: { sourceUrl: sourceUrl.href, licenseUrl: "https://open-meteo.com/en/pricing", transformVersion: TRANSFORM_VERSION }
    },
    ...sourceHeaders(response)
  };
}, "loadOpenMeteoAir");
var loadJaxa = /* @__PURE__ */ __name(async (_headers) => {
  throw new Error("JAXA live decoder is not included in the contest release; using saved snapshot");
}, "loadJaxa");
var loadEsa = /* @__PURE__ */ __name(async (env) => {
  if (!env.CDSE_CLIENT_ID || !env.CDSE_CLIENT_SECRET) throw new Error("ESA credentials unavailable");
  const tokenResponse = await fetchWithTimeout("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.CDSE_CLIENT_ID,
      client_secret: env.CDSE_CLIENT_SECRET
    })
  });
  if (!tokenResponse.ok) throw new Error(`ESA OAuth ${tokenResponse.status}`);
  const token = await tokenResponse.json();
  if (!token.access_token) throw new Error("ESA OAuth token missing");
  const to = /* @__PURE__ */ new Date();
  const from = new Date(to.getTime() - 72 * 60 * 60 * 1e3);
  const sourceUrl = "https://sh.dataspace.copernicus.eu/api/v1/statistics";
  const statisticsResponse = await fetchWithTimeout(sourceUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: { bbox: HAWAII_BBOX, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
        data: [{ type: "sentinel-5p-l2", dataFilter: { timeRange: { from: from.toISOString(), to: to.toISOString() }, timeliness: "NRTI" } }]
      },
      aggregation: {
        timeRange: { from: from.toISOString(), to: to.toISOString() },
        aggregationInterval: { of: "P1D" },
        resolution: { x: 0.02, y: 0.02 },
        evalscript: '//VERSION=3\nfunction setup(){return {input:[{bands:["NO2","dataMask"]}],output:[{id:"data",bands:1,sampleType:"FLOAT32"}]};}\nfunction evaluatePixel(s){return {data:[s.dataMask ? s.NO2 : NaN]};}'
      },
      calculations: { default: {} }
    })
  }, 2e4);
  if (!statisticsResponse.ok) throw new Error(`ESA statistics ${statisticsResponse.status}`);
  const payload = await statisticsResponse.json();
  const latest = payload.data?.filter((entry) => Number.isFinite(entry.outputs?.data?.bands?.B0?.stats?.mean)).at(-1);
  const mean = latest?.outputs?.data?.bands?.B0?.stats?.mean;
  const observedAt = latest?.interval?.from;
  if (typeof mean !== "number" || !Number.isFinite(mean) || !observedAt) throw new Error("ESA NO2 valid mean missing");
  return {
    event: {
      schemaVersion: 1,
      eventId: `esa:sentinel-5p-no2:${observedAt}`,
      provider: "esa",
      datasetId: "Sentinel-5P L2 NO2 NRTI",
      status: "near-real-time",
      observedAt,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString(),
      location: { label: "Hawaii fixed bbox quality-masked mean", ...HAWAII_CENTER, bbox: HAWAII_BBOX },
      measurements: [{ key: "no2", value: mean, unit: "mol/m2", quality: "estimated", sourceKind: "SOURCE" }],
      provenance: { sourceUrl, licenseUrl: "https://dataspace.copernicus.eu/terms-and-conditions", transformVersion: TRANSFORM_VERSION }
    }
  };
}, "loadEsa");
var eventIdentity = /* @__PURE__ */ __name((event) => {
  if (event.provider === "open-meteo") return `${event.provider}:${event.datasetId.includes("CAMS") ? "air" : "weather"}`;
  return `${event.provider}:${event.datasetId.includes("CO2") ? "co2" : "main"}`;
}, "eventIdentity");
var fallbackSnapshot = /* @__PURE__ */ __name(async (request, env, reason) => {
  const fallbackUrl = new URL("/data/live-observation-fallback-v1.json", request.url);
  const response = await env.ASSETS.fetch(new Request(fallbackUrl, { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Versioned live snapshot ${response.status}`);
  const payload = await response.json();
  return { schemaVersion: 1, source: "snapshot", generatedAt: payload.generatedAt, bbox: payload.bbox, events: payload.events, fallbackReason: reason };
}, "fallbackSnapshot");
var fallbackFirmsSnapshot = /* @__PURE__ */ __name(async (request, env, reason) => {
  const fallbackUrl = new URL("/data/firms-active-fire-snapshot.json", request.url);
  const response = await env.ASSETS.fetch(new Request(fallbackUrl, { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Versioned FIRMS snapshot ${response.status}`);
  const payload = await response.json();
  return { ...payload, source: "snapshot", fallbackReason: reason };
}, "fallbackFirmsSnapshot");
var liveFirmsSnapshot = /* @__PURE__ */ __name(async (request, env, ctx) => {
  const cached = await readCacheJson(FIRMS_CACHE_KEY);
  const cacheAge = cached ? Date.now() - Date.parse(cached.retrievedAt) : Number.POSITIVE_INFINITY;
  if (cached && cacheAge < FIRMS_TTL_MS) return cached.snapshot;
  if (env.LIVE_SENSEWARE_ENABLED !== "true") {
    if (cached) return { ...cached.snapshot, source: "stale-cache", fallbackReason: "LIVE_SENSEWARE_ENABLED is not true" };
    return fallbackFirmsSnapshot(request, env, "LIVE_SENSEWARE_ENABLED is not true");
  }
  try {
    const fresh = await freshFirmsSnapshot(cached);
    ctx.waitUntil(writeCacheJson(FIRMS_CACHE_KEY, fresh));
    return fresh.snapshot;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "NASA FIRMS upstream failure";
    if (cached) return { ...cached.snapshot, source: "stale-cache", fallbackReason: reason };
    return fallbackFirmsSnapshot(request, env, reason);
  }
}, "liveFirmsSnapshot");
var liveSnapshot = /* @__PURE__ */ __name(async (request, env, ctx) => {
  const city = resolveObservationCity(new URL(request.url).searchParams.get("city"));
  if (env.LIVE_SENSEWARE_ENABLED !== "true") return fallbackSnapshot(request, env, "LIVE_SENSEWARE_ENABLED is not true");
  const definitions = [
    { cacheKey: "noaa-ndbc", ttlMs: 5 * 60 * 1e3, load: loadNdbc },
    { cacheKey: "noaa-co2", ttlMs: 60 * 60 * 1e3, load: loadCo2 },
    { cacheKey: `open-meteo-${city.id}-weather-v1`, ttlMs: 30 * 60 * 1e3, load: /* @__PURE__ */ __name((headers) => loadOpenMeteoWeather(headers, city), "load") },
    { cacheKey: `open-meteo-${city.id}-air-v1`, ttlMs: 3 * 60 * 60 * 1e3, load: /* @__PURE__ */ __name((headers) => loadOpenMeteoAir(headers, city), "load") }
  ];
  if (env.LIVE_SENSEWARE_JAXA_ENABLED === "true") {
    definitions.push({ cacheKey: "jaxa-gsmap", ttlMs: 6 * 60 * 60 * 1e3, load: loadJaxa });
  }
  if (env.LIVE_SENSEWARE_ESA_ENABLED === "true" && env.CDSE_CLIENT_ID && env.CDSE_CLIENT_SECRET) {
    definitions.push({ cacheKey: "esa-no2", ttlMs: 30 * 60 * 1e3, load: /* @__PURE__ */ __name(() => loadEsa(env), "load") });
  }
  const settled = await Promise.allSettled(definitions.map((definition) => loadCachedProvider(definition, ctx)));
  const events = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const errors = settled.flatMap((result) => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "provider failure"] : []);
  if (!events.length) return fallbackSnapshot(request, env, errors.join("; "));
  const fallback = await fallbackSnapshot(request, env, "Some providers use saved snapshots");
  const available = new Set(events.map(eventIdentity));
  const disabledReasons = /* @__PURE__ */ new Map([
    ["jaxa:main", env.LIVE_SENSEWARE_JAXA_ENABLED === "true" ? "JAXA upstream unavailable" : "JAXA live disabled for free-plan CPU safety"],
    ["esa:main", env.LIVE_SENSEWARE_ESA_ENABLED !== "true" ? "ESA live disabled" : !env.CDSE_CLIENT_ID || !env.CDSE_CLIENT_SECRET ? "ESA credentials unavailable" : "ESA upstream unavailable"],
    ["open-meteo:weather", "Open-Meteo weather upstream unavailable"],
    ["open-meteo:air", "Open-Meteo CAMS upstream unavailable"]
  ]);
  for (const event of fallback.events) {
    const identity = eventIdentity(event);
    if (!available.has(identity)) {
      events.push({ ...event, fallbackReason: disabledReasons.get(identity) || errors.join("; ") || "provider snapshot fallback" });
    }
  }
  return { schemaVersion: 1, source: "live", generatedAt: (/* @__PURE__ */ new Date()).toISOString(), bbox: cityBbox(city), events, errors: errors.length ? errors : void 0 };
}, "liveSnapshot");
var sseLine = /* @__PURE__ */ __name((event, data, id) => `${id ? `id: ${id}
` : ""}event: ${event}
data: ${JSON.stringify(data)}

`, "sseLine");
var streamResponse = /* @__PURE__ */ __name((request, env, ctx) => {
  const encoder2 = new TextEncoder();
  let heartbeat = 0;
  let refresh = 0;
  let lifetime = 0;
  let closed = false;
  let refreshInFlight = false;
  const stream = new ReadableStream({
    start(controller) {
      const close = /* @__PURE__ */ __name(() => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(refresh);
        clearTimeout(lifetime);
        try {
          controller.close();
        } catch {
        }
      }, "close");
      const emitSnapshot = /* @__PURE__ */ __name(async () => {
        if (closed || refreshInFlight) return;
        refreshInFlight = true;
        try {
          const snapshot = await liveSnapshot(request, env, ctx);
          if (closed) return;
          const lastEventId = request.headers.get("Last-Event-ID") || new URL(request.url).searchParams.get("lastEventId") || "";
          const snapshotId = `snapshot:${snapshot.generatedAt || (/* @__PURE__ */ new Date()).toISOString()}`;
          controller.enqueue(encoder2.encode(sseLine("snapshot", { ...snapshot, resumedAfter: lastEventId || void 0 }, snapshotId)));
          for (const event of snapshot.events) controller.enqueue(encoder2.encode(sseLine("provider", event, event.eventId)));
          controller.enqueue(encoder2.encode(sseLine("status", { state: "streaming", source: snapshot.source, refreshSeconds: STREAM_REFRESH_MS / 1e3 }, `status:${Date.now()}`)));
        } catch (error) {
          if (!closed) controller.error(error);
          close();
        } finally {
          refreshInFlight = false;
        }
      }, "emitSnapshot");
      request.signal.addEventListener("abort", close, { once: true });
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder2.encode(`: heartbeat ${(/* @__PURE__ */ new Date()).toISOString()}

`));
      }, HEARTBEAT_MS);
      refresh = setInterval(() => void emitSnapshot(), STREAM_REFRESH_MS);
      lifetime = setTimeout(() => {
        controller.enqueue(encoder2.encode(sseLine("status", { state: "complete", reconnect: true })));
        close();
      }, STREAM_LIFETIME_MS);
      void emitSnapshot();
    },
    cancel() {
      closed = true;
      clearInterval(heartbeat);
      clearInterval(refresh);
      clearTimeout(lifetime);
    }
  });
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff"
    }
  });
}, "streamResponse");
var handleLiveSenseware = /* @__PURE__ */ __name(async (request, env, ctx) => {
  const url = new URL(request.url);
  if (!["/api/live/v1/snapshot", "/api/live/v1/stream", "/api/live/v1/wind-field", "/api/live/v1/prefecture-field", "/api/live/v1/firms"].includes(url.pathname)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  if (url.pathname.endsWith("/stream")) return request.method === "HEAD" ? new Response(null, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } }) : streamResponse(request, env, ctx);
  if (url.pathname.endsWith("/firms")) {
    const snapshot2 = await liveFirmsSnapshot(request, env, ctx);
    return new Response(request.method === "HEAD" ? null : JSON.stringify(snapshot2), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=60, stale-while-revalidate=840" }
    });
  }
  if (url.pathname.endsWith("/wind-field")) {
    const field = await liveWindField(env, ctx);
    return new Response(request.method === "HEAD" ? null : JSON.stringify(field), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=60, stale-while-revalidate=240" }
    });
  }
  if (url.pathname.endsWith("/prefecture-field")) {
    const [weather, air] = await Promise.all(["weather", "air"].map((provider) => cachedPrefectureField(provider, Object.values(CITY_LOCATIONS), env.LIVE_SENSEWARE_ENABLED === "true", ctx)));
    return new Response(request.method === "HEAD" ? null : JSON.stringify({ schemaVersion: 1, scope: "japan-prefectures", targetCount: 47, weather, air }), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=60, stale-while-revalidate=240" }
    });
  }
  const snapshot = await liveSnapshot(request, env, ctx);
  const body = request.method === "HEAD" ? null : JSON.stringify(snapshot);
  return new Response(body, { headers: jsonHeaders });
}, "handleLiveSenseware");

// src/browser-security.ts
var browserSecurityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://www.googletagmanager.com 'sha256-+ZQDoHaXrz8V1qxlvZEpqOBm5NZCTBuCIf7k4/IDk6E=' 'sha256-1sy8cwicTQBlN+rYdtmqHj0d/TWf7K1BqCG38jZeie4=' 'sha256-B4C6BBw3l9KLjSXm/NzlzOc4hnxQQvA7ko353/bkGH4=' 'sha256-F1IIZC/LuTrFzA9PCY3LvwEHQYtscw7GW09lFRNdovc=' 'sha256-MF/Bd4SD9ZQcQgGTMRWTnGqeGEcKWNwffcT01H3qnVQ=' 'sha256-ykGiYkjTtdnim9u9MAQ4z0ivSBsKFPdO6993y/aQKaU='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

// src/pages-entry.ts
var NON_PUBLIC_FILES = new Set([
  "/.codex-write-probe",
  "/.gitattributes",
  "/.gitignore",
  "/AGENTS.md",
  "/CHARACTER-DESIGN.md",
  "/package.json",
  "/README.md",
  "/wrangler.jsonc"
].map((path) => path.toLowerCase()));
var NON_PUBLIC_PREFIXES = [
  "/.github/",
  "/.tmp/",
  "/.tmp-character-copy/",
  "/.wrangler/",
  "/artifacts/",
  "/contest-limited/",
  "/docs/",
  "/node_modules/",
  "/output/",
  "/scripts/",
  "/sensor-platform/",
  "/smartcity-sensor-starter-kit/",
  "/story/",
  "/tests/",
  "/tmp/"
];
var PUBLIC_CHARACTER_BIBLE_PATHS = /* @__PURE__ */ new Set([
  "/artifacts/gx-setting-bible/01-three-ecologies-character-master.png",
  "/artifacts/gx-setting-bible/02-first-meeting-zushi-coast.png",
  "/artifacts/gx-setting-bible/03-gaia-senseware-installation.png",
  "/artifacts/gx-setting-bible/04-life-earth-coevolution.png",
  "/artifacts/gx-setting-bible/05-anthropocene-planetary-force.png",
  "/artifacts/gx-setting-bible/06-ai-earth-coevolution.png",
  "/artifacts/gx-setting-bible/07-three-ecologies-world.png",
  "/artifacts/gx-setting-bible/08-old-os-to-gx.png",
  "/artifacts/gx-setting-bible/09-next-stage-civilization.png",
  "/artifacts/gx-setting-bible/10-final-keyvisual.png"
]);
var isNonPublicPath = /* @__PURE__ */ __name((pathname) => {
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
  }
  const normalizedPath = decodedPath.toLowerCase();
  if (PUBLIC_CHARACTER_BIBLE_PATHS.has(normalizedPath)) return false;
  return NON_PUBLIC_FILES.has(normalizedPath) || NON_PUBLIC_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}, "isNonPublicPath");
var nonPublicResponse = /* @__PURE__ */ __name(() => new Response("Not Found", {
  status: 404,
  headers: {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  }
}), "nonPublicResponse");
var handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isNonPublicPath(url.pathname)) return nonPublicResponse();
    const liveResponse = await handleLiveSenseware(request, env, ctx);
    if (liveResponse) return liveResponse;
    if (url.pathname.startsWith("/api/")) return index_default.fetch(request, env);
    const assetResponse = await env.ASSETS.fetch(request);
    if (!/^\/assets\/audio\/.+\.(?:mp3|wav)$/u.test(url.pathname) || !assetResponse.ok) return assetResponse;
    const headers = new Headers(assetResponse.headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    const range = request.headers.get("Range")?.match(/^bytes=(\d*)-(\d*)$/u);
    if (!range || assetResponse.status === 206 || request.method === "HEAD") {
      return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    }
    const bytes = await assetResponse.arrayBuffer();
    const suffixLength = range[1] ? 0 : Number(range[2]);
    const start = range[1] ? Number(range[1]) : Math.max(0, bytes.byteLength - suffixLength);
    const end = range[2] && range[1] ? Math.min(Number(range[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= bytes.byteLength) {
      headers.set("Content-Range", `bytes */${bytes.byteLength}`);
      headers.set("Content-Length", "0");
      return new Response(null, { status: 416, headers });
    }
    const chunk = bytes.slice(start, end + 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${bytes.byteLength}`);
    headers.set("Content-Length", String(chunk.byteLength));
    return new Response(chunk, { status: 206, headers });
  }
};
var pages_entry_default = {
  async fetch(request, env, ctx) {
    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(browserSecurityHeaders)) {
      if (name === "Referrer-Policy" && headers.get(name) === "no-referrer") continue;
      headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
export {
  pages_entry_default as default
};
