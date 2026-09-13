import { ApiError } from "./http";

// Operator-controlled non-secret setting. Never accepted from a request header,
// query, public user profile, or a participant-facing endpoint.
export function assertSensorOperationAllowed(request: Request, configuredMode: string | undefined): void {
  const mode = configuredMode || "normal";
  if (mode === "normal") return;
  const path = new URL(request.url).pathname;
  if (path === "/api/health" && request.method === "GET") return;
  if (path === "/api/web/v1/logout" && request.method === "POST") return;
  if (path === "/api/web/v1/account" && request.method === "DELETE") return;
  if (mode === "read-only" && ["GET", "HEAD"].includes(request.method) && !path.startsWith("/api/auth/")) return;
  // Unknown values fail closed, rather than silently re-enabling submissions.
  throw new ApiError(503, "SENSOR_MAINTENANCE", "センサー機能はメンテナンス中です。新規登録・変更・観測値の送信を一時停止しています。");
}
