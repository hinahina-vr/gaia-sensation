import { type AuthenticatedUser, requireCsrf } from "./auth";
import { ApiError, clearCookie, isRecord, json, readJson, requireExactKeys } from "./http";

export async function deleteOwnAccount(request: Request, env: Env, user: AuthenticatedUser): Promise<Response> {
  await requireCsrf(request, user);
  if (request.headers.get("Origin") !== env.WEB_ORIGIN) throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.");
  const body = await readJson(request, 256);
  if (!isRecord(body)) throw new ApiError(400, "INVALID_CONFIRMATION", "Account deletion requires explicit confirmation.");
  requireExactKeys(body, ["confirmation"]);
  if (body.confirmation !== "DELETE_MY_ACCOUNT") throw new ApiError(400, "INVALID_CONFIRMATION", "Account deletion requires explicit confirmation.");
  // No client-supplied user ID. Recheck the session in the deletion statement
  // so an intervening logout/expiry cannot authorize a destructive operation.
  // Existing foreign keys cascade atomically to identities, sessions, devices,
  // telemetry, pairing codes, avatars, relationships and exact rollups.
  const deleted = await env.DB.prepare(
    `DELETE FROM users WHERE id = ?1 AND EXISTS (
       SELECT 1 FROM sessions WHERE id = ?2 AND user_id = ?1
       AND revoked_at IS NULL AND expires_at > ?3
     ) RETURNING id`,
  ).bind(user.id, user.sessionId, new Date().toISOString()).first<{ id: string }>();
  if (!deleted) throw new ApiError(401, "SESSION_EXPIRED", "Please sign in again before deleting your account.");
  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie("__Host-gaia_sensor_session", true));
  headers.append("Set-Cookie", clearCookie("__Host-gaia_sensor_csrf", false));
  headers.append("Set-Cookie", clearCookie("__Host-gaia_sensor_oidc", true));
  return json({ ok: true, accountDeleted: true }, 200, headers);
}
