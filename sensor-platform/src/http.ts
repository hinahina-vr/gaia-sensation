export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const json = (body: unknown, status = 200, headers: HeadersInit = {}): Response => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
};

export const errorResponse = (error: ApiError, headers: HeadersInit = {}): Response =>
  json({ error: { code: error.code, message: error.message } }, error.status, headers);

export const readJson = async (request: Request, maximumBytes: number): Promise<unknown> => {
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
  const chunks: Uint8Array[] = [];
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
};

export const readBytes = async (request: Request, maximumBytes: number): Promise<Uint8Array> => {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null && (!Number.isFinite(Number(declaredLength)) || Number(declaredLength) < 1 || Number(declaredLength) > maximumBytes)) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Request body must not exceed ${maximumBytes} bytes.`);
  }
  if (!request.body) throw new ApiError(400, "EMPTY_BODY", "A request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
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
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const requireExactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
): void => {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new ApiError(400, "UNKNOWN_FIELD", `Unknown field: ${unknown}.`);
};

export const requireString = (value: unknown, field: string, minimum: number, maximum: number): string => {
  if (typeof value !== "string") throw new ApiError(400, "INVALID_FIELD", `${field} must be a string.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new ApiError(400, "INVALID_FIELD", `${field} must be between ${minimum} and ${maximum} characters.`);
  }
  return normalized;
};

export const optionalString = (value: unknown, field: string, maximum: number): string | null => {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, 1, maximum);
};

export const parseCookies = (request: Request): Map<string, string> => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    try {
      result.set(key, decodeURIComponent(raw));
    } catch {
      // Ignore malformed cookies rather than reflecting their values.
    }
  }
  return result;
};

export const sessionCookie = (value: string, maximumAge: number): string =>
  [
    `__Host-gaia_sensor_session=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maximumAge}`,
  ].filter(Boolean).join("; ");

export const csrfCookie = (value: string, maximumAge: number): string =>
  [
    `__Host-gaia_sensor_csrf=${encodeURIComponent(value)}`,
    "Path=/",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${maximumAge}`,
  ].filter(Boolean).join("; ");

export const flowCookie = (value: string, maximumAge: number): string =>
  [
    `__Host-gaia_sensor_oidc=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maximumAge}`,
  ].join("; ");

export const clearCookie = (name: string, httpOnly: boolean): string =>
  [
    `${name}=`,
    "Path=/",
    httpOnly ? "HttpOnly" : "",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].filter(Boolean).join("; ");
