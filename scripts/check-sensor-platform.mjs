import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const report = [];
const check = (name, run) => { run(); report.push({ name, status: "passed" }); };

const index = read("index.html");
const sensorHtml = read("sensors/index.html");
const sensorJs = read("sensors/sensor-platform.js");
const worker = read("sensor-platform/src/index.ts");
const auth = read("sensor-platform/src/auth.ts");
const devices = read("sensor-platform/src/devices.ts");
const profiles = read("sensor-platform/src/profiles.ts");
const validation = read("sensor-platform/src/validation.ts");
const measurements = read("sensor-platform/src/measurements.ts");
const regions = read("sensor-platform/src/regions.ts");
const regionData = read("sensor-platform/src/region-code-data.ts");
const migration1 = read("sensor-platform/migrations/0001_initial.sql");
const migration2 = read("sensor-platform/migrations/0002_iso_3166_1_alpha2.sql");
const migration3 = read("sensor-platform/migrations/0003_public_sensor_profiles.sql");
const migration4 = read("sensor-platform/migrations/0004_d1_profile_avatars.sql");
const migration5 = read("sensor-platform/migrations/0005_region_codes.sql");
const migration9 = read("sensor-platform/migrations/0009_region_office_locations.sql");
const migration10 = read("sensor-platform/migrations/0010_measurement_catalog.sql");
const migration11 = read("sensor-platform/migrations/0011_read_optimized_rollups.sql");
const wrangler = read("sensor-platform/wrangler.jsonc");
const rootWrangler = read("wrangler.jsonc");
const openapi = read("smartcity-sensor-starter-kit/openapi.yaml");
const curl = read("smartcity-sensor-starter-kit/curl-examples.sh");
const starter = read("smartcity-sensor-starter-kit/esp32-arduino/SmartCitySensorDemo/SmartCitySensorDemo.ino");

check("exhibit grid places sensors immediately after the map", () => {
  const map = index.indexOf('data-intro-path="map"');
  const sensor = index.indexOf("data-sensor-platform-link");
  const character = index.indexOf("data-character-gallery-open");
  assert(map >= 0 && map < sensor && sensor < character);
  assert.match(index.slice(sensor, character), /<strong>みんなのセンサー<\/strong>[\s\S]*<p>あなたの端末をひとつのセンサーに<\/p>/u);
});

check("SPA exposes required views and web operations", () => {
  for (const view of ["map", "login", "loading", "devices", "add", "pairing", "detail", "profile", "guide"]) assert.match(sensorHtml, new RegExp(`data-view="${view}"`, "u"));
  for (const fragment of ["/session", "/countries", "/regions", "/devices/pairing", "/latest", "/telemetry", "/profile", "/profile/avatar", "/public/v1/sensors", 'method: "PUT"', 'method: "PATCH"', 'method: "DELETE"']) assert(sensorJs.includes(fragment), fragment);
  for (const fragment of ["public-sensor-map", "profile-avatar-input", "xUrl", "githubUrl", "instagramUrl", "publicLatitude", "publicLongitude", "subdivisionCode", "municipalityCode"]) assert(sensorHtml.includes(fragment), fragment);
});

check("public profile and map expose only opted-in public POI ownership", () => {
  for (const fragment of ["listPublicSensors", "is_public = 1", "public_latitude", "public_longitude", "ownerDisplayName", "avatarUrl", "xUrl", "githubUrl", "instagramUrl"]) assert(devices.includes(fragment), fragment);
  for (const fragment of ["/api/public/v1/sensors", "PUBLIC_AVATAR_PATTERN", "/api/web/v1/profile", "/api/web/v1/profile/avatar"]) assert(worker.includes(fragment), fragment);
  assert.doesNotMatch(devices.slice(devices.indexOf("export const listPublicSensors")), /email|owner_user_id AS|ownerUserId/iu);
  assert.doesNotMatch(devices.slice(devices.indexOf("export const listPublicSensors")), /lastSeenAt/iu);
  const publicHandler = devices.slice(devices.indexOf("export const listPublicSensors"), devices.indexOf("const serializeTelemetry"));
  assert.match(publicHandler, /subdivisionCode|municipalityCode/u);
  assert.match(validation, /Math\.round\(value \* 100_000\) \/ 100_000/u);
  assert.match(validation, /PUBLIC_LOCATION_REQUIRED/u);
});

check("canonical region codes are generated from pinned registries and validated together", () => {
  for (const fragment of ["SUBDIVISION_RECORDS", "JAPAN_MUNICIPALITY_RECORDS", "REGION_DATA_VERSION"]) assert(regionData.includes(fragment), fragment);
  assert((regionData.match(/^  \["[A-Z]{2}-[A-Z0-9]{1,3}",/gmu) ?? []).length >= 4_500);
  assert((regionData.match(/^  \["\d{6}","JP-/gmu) ?? []).length >= 1_800);
  for (const fragment of ["hasValidMunicipalityCheckDigit", "getSubdivision", "getMunicipality", "INVALID_SUBDIVISION", "INVALID_MUNICIPALITY", "REGION_FIELD_CONFLICT"]) {
    assert(regions.includes(fragment) || validation.includes(fragment), fragment);
  }
  assert.match(worker, /\/api\/web\/v1\/regions/u);
  assert.match(sensorJs, /natural-earth-50m-countries\.geojson/u);
  assert.doesNotMatch(sensorJs, /mapSvg|<svg viewBox/u);
  const publicMapMarkup = sensorHtml.slice(sensorHtml.indexOf("public-sensor-map"), sensorHtml.indexOf("data-view=\"login\""));
  assert.match(publicMapMarkup, /<svg class="sensor-resonance-network"/u);
  assert.doesNotMatch(publicMapMarkup, /<path/iu);
});

check("profile stores sanitized PNG in D1 and accepts canonical optional social URLs", () => {
  for (const fragment of ["avatar_png", "MAX_AVATAR_BYTES", "MAX_AVATAR_EDGE", "PNG_SIGNATURE", "IHDR", "IDAT", "IEND", "Animated or unsupported PNG"]) assert(profiles.includes(fragment), fragment);
  assert.doesNotMatch(profiles, /PROFILE_IMAGES|R2Bucket/u);
  for (const host of ["x.com", "github.com", "instagram.com"]) assert(validation.includes(host), host);
  assert.match(validation, /parsed\.protocol !== "https:"/u);
  assert.match(profiles, /X-Content-Type-Options/u);
});

check("OIDC flow is browser-bound, one-time and secure", () => {
  for (const fragment of ["state", "nonce", "code_challenge", "browser_binding_hash", "consumed_at", "timingSafeHexEqual", "redirectUri(env)", "iss", "aud", "exp", "sub"]) assert(auth.includes(fragment), fragment);
  assert.match(auth, /code_challenge_method: "S256"/u);
  assert.match(read("sensor-platform/src/http.ts"), /__Host-gaia_sensor_oidc[\s\S]*HttpOnly[\s\S]*Secure[\s\S]*SameSite=Lax/u);
  assert.match(auth, /UPDATE sessions SET token_hash/u);
});

check("owner isolation and token pairing controls", () => {
  for (const operation of ["listDevices", "getDevice", "getLatest", "getHistory", "updateDevice", "revokeDevice"]) assert(devices.includes(`export const ${operation}`), operation);
  assert((devices.match(/owner_user_id/g) || []).length >= 6);
  for (const fragment of ["used_at IS NULL", "expires_at >", "consumed_by_device_id", "DEVICE_TOKEN_PEPPER", "PAIRING_CODE_PEPPER", "status = 'ACTIVE'"]) assert(devices.includes(fragment), fragment);
});

check("telemetry is monotonic and idempotent", () => {
  for (const fragment of ["last_seq", "last_payload_hash", "payload_hash", "STALE_SEQUENCE", "SEQUENCE_CONFLICT", "?1 > last_seq", "UNIQUE(device_id, seq)"]) {
    assert(devices.includes(fragment) || migration1.includes(fragment), fragment);
  }
  assert.match(devices, /datetime\(d\.last_seen_at\) >= datetime\('now'/u);
  assert.match(validation, /RFC 3339 UTC timestamp/u);
  assert.match(validation, /new Date\(observedAt\)\.toISOString\(\)/u);
  assert.match(devices, /TELEMETRY_MIN_INTERVAL_MS = 60_000/u);
  assert.match(openapi, /Retry-After:[\s\S]{0,180}maximum: 60/u);
  assert.doesNotMatch(openapi, /maximum: 300|5分に1件|per 5 minutes/u);
});

check("D1 schema has complete ISO alpha-2 master", () => {
  const codes = [...migration2.matchAll(/\('([A-Z]{2})'\)/gu)].map((match) => match[1]);
  assert.equal(codes.length, 249);
  assert.equal(new Set(codes).size, 249);
  for (const representative of ["JP", "US", "DE", "BR", "AQ"]) assert(codes.includes(representative));
  assert.match(migration1, /country_code TEXT NOT NULL REFERENCES countries\(code\)/u);
  assert.match(migration2, /INSERT OR IGNORE/u);
});

check("D1 profile migration preserves opaque public identifiers and opt-in locations", () => {
  for (const fragment of ["public_id", "avatar_key", "avatar_updated_at", "x_url", "github_url", "instagram_url", "public_latitude", "public_longitude", "is_public"]) assert(migration3.includes(fragment), fragment);
  assert.match(migration4, /ALTER TABLE users ADD COLUMN avatar_png BLOB/u);
  assert.match(migration3, /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id/u);
  assert.match(migration3, /CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_public_id/u);
});

check("D1 region migration is additive and preserves legacy location columns", () => {
  for (const table of ["device_pairing_codes", "devices"]) {
    assert.match(migration5, new RegExp(`ALTER TABLE ${table} ADD COLUMN subdivision_code TEXT`, "u"));
    assert.match(migration5, new RegExp(`ALTER TABLE ${table} ADD COLUMN municipality_code TEXT`, "u"));
  }
  for (const legacy of ["admin1_code", "locality_name", "location_precision"]) assert(migration1.includes(legacy), legacy);
  assert.doesNotMatch(migration5, /DROP|RENAME|DELETE/iu);
  assert.match(migration9, /CREATE TABLE IF NOT EXISTS region_office_locations/u);
  assert.doesNotMatch(migration9, /DROP|RENAME|DELETE/iu);
});

check("measurement catalog is the shared API UI and ESP32 contract", () => {
  for (const category of ["atmosphere", "weather", "water", "soil", "motion", "energy", "radiation"]) assert(measurements.includes(`id: "${category}"`), category);
  for (const key of ["temperature", "pm25", "water_temperature", "ph", "conductivity", "turbidity", "dissolved_oxygen", "water_level", "soil_moisture", "wind_speed", "voltage", "radiation_dose_rate"]) assert(measurements.includes(`measurement("${key}"`), key);
  assert.match(worker, /\/api\/public\/v1\/measurement-types/u);
  assert.match(validation, /getMeasurementDefinition/u);
  assert.match(sensorJs, /loadMeasurementCatalog/u);
  assert.match(starter, /addMeasurement\(values, "water_temperature"/u);
  assert.match(migration10, /measurement_keys_json/u);
});

check("frequent public reads use bounded history and write-time rollups", () => {
  for (const fragment of [
    "idx_telemetry_device_received_seq",
    "device_telemetry_rollups",
    "recent_payloads_json",
    "telemetry_rollup_after_insert",
    "device_social_rollups",
    "social_rollup_after_like_insert",
    "social_rollup_after_like_delete",
  ]) assert(migration11.includes(fragment), fragment);
  assert.match(devices, /LEFT JOIN device_telemetry_rollups/u);
  assert.match(devices, /LEFT JOIN device_social_rollups/u);
  assert.match(devices, /rollup\.recent_payloads_json/u);
  const publicReadHandler = devices.slice(devices.indexOf("export const listPublicSensors"), devices.indexOf("const parsePublicObservations"));
  assert.doesNotMatch(publicReadHandler, /FROM telemetry/u);
  assert.doesNotMatch(devices, /ROW_NUMBER\(\)|COUNT\(t\.id\)|SUM\(length\(t\.payload_json\)\)/u);
});

check("owner detail polls only the latest value while visible", () => {
  assert.match(sensorJs, /const detailLatestPollIntervalMs = 30_000;/u);
  assert.doesNotMatch(sensorJs, /const pollIntervalMs = 2_000;/u);
  const polling = sensorJs.slice(sensorJs.indexOf("const startDetailPolling"), sensorJs.indexOf("const startPublicMapPolling"));
  assert.match(polling, /document\.visibilityState !== "visible"/u);
  assert.match(polling, /refreshDetail\(\{ quiet: true, includeHistory: false \}\)/u);
  const visibility = sensorJs.slice(sensorJs.indexOf('document.addEventListener("visibilitychange"'), sensorJs.indexOf("const showStatus"));
  assert.match(visibility, /stopDetailPolling\(\)/u);
  assert.match(visibility, /startDetailPolling\(\)/u);
  const detailRefresh = sensorJs.slice(sensorJs.indexOf("const refreshDetail"), sensorJs.indexOf("const renderDetail"));
  assert.match(detailRefresh, /includeHistory = true/u);
  assert.match(detailRefresh, /includeHistory[\s\S]*telemetry\?limit=48[\s\S]*Promise\.resolve\(null\)/u);
  assert.match(detailRefresh, /else renderLatestDetail\(latest\)/u);
  assert.match(sensorJs, /#refresh-detail"\)\.addEventListener\("click", \(\) => refreshDetail\(\)\)/u);
});

check("wrangler config has D1, generated Env and compatibility without R2", () => {
  for (const config of [wrangler, rootWrangler]) {
    for (const fragment of ['"nodejs_compat"', '"d1_databases"', '"migrations_dir"']) assert(config.includes(fragment), fragment);
    assert.doesNotMatch(config, /r2_buckets|PROFILE_IMAGES/u);
  }
  assert.match(wrangler, /"observability"/u);
  assert.doesNotMatch(rootWrangler, /"observability"/u);
  assert(fs.existsSync(path.join(root, "sensor-platform/src/worker-configuration.d.ts")));
  assert.doesNotMatch(wrangler, /client_secret|token_pepper.*[A-Za-z0-9]{20}/iu);
});

check("OpenAPI 3.1 public contract is structurally complete", () => {
  assert.match(openapi, /^openapi: 3\.1\.0/mu);
  const pathKeys = [...openapi.matchAll(/^  (\/[^:]+):$/gmu)].map((match) => match[1]);
  assert.deepEqual(pathKeys, ["/device/pair", "/devices/{deviceId}/telemetry"]);
  for (const fragment of ["operationId: pairDevice", "operationId: postTelemetry", "deviceBearer", "additionalProperties: false", "'200':", "'201':", "'202':", "'400':", "'401':", "'409':", "'413':", "'415':"]) assert(openapi.includes(fragment), fragment);
  assert.match(openapi, /observedAt: \{ type: \[string, 'null'\], format: date-time/u);
});

check("curl flow safely carries one-time pair response", () => {
  for (const fragment of ["command -v jq", "mktemp -d", "umask 077", "trap", ".deviceId", ".deviceToken", "unset PAIRING_CODE", "--config", "chmod 600"]) assert(curl.includes(fragment), fragment);
  assert.doesNotMatch(curl, /DEVICE_TOKEN="gdt_/u);
});

check("Arduino kit provides setup AP, NVS, root CA and safe retry", () => {
  for (const fragment of ["CITY-SENSOR-", "WebServer", "DNSServer", "WiFi.softAP", "wifiSsid", "wifiPass", "pairCode", "preferences.remove(\"pairCode\")", "client.setCACert(ROOT_CA)", "USE_MOCK_SENSOR", "RETRY_ATTEMPTS", "esp_random()", "%Y-%m-%dT%H:%M:%SZ"]) assert(starter.includes(fragment), fragment);
  assert.doesNotMatch(starter, /setInsecure\s*\(/u);
  assert.doesNotMatch(starter, /Serial\.(?:print|printf).*deviceToken/iu);
});

check("scope excludes out-of-scope technologies and hardcoded secrets", () => {
  const tracked = [worker, auth, devices, profiles, validation, sensorJs, starter, wrangler].join("\n");
  for (const forbidden of [/\bmqtt\b/iu, /\bkafka\b/iu, /\bkubernetes\b/iu, /\bwebbluetooth\b/iu, /setInsecure\s*\(/u]) assert.doesNotMatch(tracked, forbidden);
  assert.doesNotMatch(tracked, /AIza[0-9A-Za-z_-]{20,}/u);
});

console.log(JSON.stringify({ status: "passed", scans: report.length, report }, null, 2));
