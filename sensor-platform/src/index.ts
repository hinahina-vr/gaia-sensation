import { finishGoogleLogin, getAuthenticatedUser, logout, OIDC_FLOW_COOKIE, sessionResponse, startGoogleLogin, startTrialSession } from "./auth";
import {
  acceptTelemetry,
  createPairing,
  getDevice,
  getHistory,
  getLatest,
  listCountries,
  listDevices,
  listPublicSensors,
  pairDevice,
  revokeDevice,
  updateDevice,
} from "./devices";
import { ApiError, clearCookie, errorResponse, json } from "./http";
import { listMeasurementTypes } from "./measurements";
import { deleteAvatar, getProfile, getPublicAvatar, updateProfile, uploadAvatar } from "./profiles";
import { listRegions, locateRegion } from "./regions";
import { listSensorRelationships, setSensorRelationship } from "./social";
import { deleteOwnAccount } from "./account";
import { assertSensorOperationAllowed } from "./operation-mode";

const DEVICE_PATTERN = /^\/api\/web\/v1\/devices\/(dev_[a-z0-9]+)$/u;
const LATEST_PATTERN = /^\/api\/web\/v1\/devices\/(dev_[a-z0-9]+)\/latest$/u;
const HISTORY_PATTERN = /^\/api\/web\/v1\/devices\/(dev_[a-z0-9]+)\/telemetry$/u;
const TELEMETRY_PATTERN = /^\/api\/v1\/devices\/(dev_[a-z0-9]+)\/telemetry$/u;
const PUBLIC_AVATAR_PATTERN = /^\/api\/public\/v1\/profiles\/(usr_[a-z0-9]+)\/avatar$/u;
const SENSOR_RELATIONSHIP_PATTERN = /^\/api\/web\/v1\/sensors\/(sensor_[a-z0-9_]+)\/(favorite|like)$/u;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
  },
} satisfies ExportedHandler<Env>;

const route = async (request: Request, env: Env, url: URL): Promise<Response> => {
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
      request.method === "PUT",
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
};

const assertTransport = (url: URL, env: Env): void => {
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(env.ENVIRONMENT === "local" && local)) {
    throw new ApiError(400, "HTTPS_REQUIRED", "HTTPS is required.");
  }
};

const preflight = (request: Request, env: Env): Response => {
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
      Vary: "Origin",
    },
  });
};

const secureResponse = (response: Response, request: Request, env: Env, requestId: string): Response => {
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
};
