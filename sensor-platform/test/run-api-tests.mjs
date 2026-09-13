import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const nodePath = process.env.GAIA_NODE_PATH || process.execPath;
const wranglerPath = process.env.GAIA_WRANGLER_PATH || path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
if (!fs.existsSync(wranglerPath)) throw new Error(`Wrangler entrypoint was not found: ${wranglerPath}`);
const port = process.env.GAIA_SENSOR_TEST_PORT || "8794";
const origin = `http://127.0.0.1:${port}`;
const testStateRoot = process.env.GAIA_SENSOR_TEST_STATE_ROOT || path.join(root, ".wrangler");
fs.mkdirSync(testStateRoot, { recursive: true });
const persistPath = path.join(testStateRoot, `api-test-state-${process.pid}`);
const reports = [];
const testSecrets = {
  GOOGLE_CLIENT_ID: `local-test-${randomBytes(12).toString("hex")}`,
  GOOGLE_CLIENT_SECRET: randomBytes(32).toString("hex"),
  SESSION_SECRET: randomBytes(32).toString("hex"),
  DEVICE_TOKEN_PEPPER: randomBytes(32).toString("hex"),
  PAIRING_CODE_PEPPER: randomBytes(32).toString("hex"),
};

const command = (argumentsList) => new Promise((resolve, reject) => {
  const child = spawn(nodePath, [wranglerPath, ...argumentsList], { cwd: root, env: process.env, windowsHide: true });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve(output) : reject(new Error(output)));
});

await command(["d1", "migrations", "apply", "gaia-senseware-sensors-local", "--local", `--persist-to=${persistPath}`]);
const migrationReapplyOutput = await command(["d1", "migrations", "apply", "gaia-senseware-sensors-local", "--local", `--persist-to=${persistPath}`]);
await command(["d1", "execute", "gaia-senseware-sensors-local", "--local", `--persist-to=${persistPath}`, "--file=test/seed-local.sql"]);

const server = spawn(nodePath, [
  wranglerPath,
  "dev", "--local", "--port", port, `--persist-to=${persistPath}`,
  ...Object.entries(testSecrets).flatMap(([name, value]) => ["--var", `${name}:${value}`]),
  "--var", `PUBLIC_ORIGIN:${origin}`,
  "--var", `WEB_ORIGIN:${origin}`,
], {
  cwd: root,
  env: process.env,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

try {
  await waitForServer();
  await test("health and security headers", async () => {
    const response = await fetch(`${origin}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("permissions-policy") ?? "", /geolocation=\(\)/u);
  });
  await test("public route rejects non-JSON", async () => {
    const response = await fetch(`${origin}/api/v1/device/pair`, { method: "POST", body: "{}" });
    assert.equal(response.status, 415);
  });
  await test("payload size limit", async () => {
    const response = await fetch(`${origin}/api/v1/device/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode: "AAAA-AAAA", padding: "x".repeat(3000) }),
    });
    assert.equal(response.status, 413);
  });
  await test("session required", async () => {
    const response = await fetch(`${origin}/api/web/v1/devices`);
    assert.equal(response.status, 401);
  });
  await test("migrations are sequential and safe to reapply", async () => {
    assert.match(migrationReapplyOutput, /No migrations to apply/u);
    assert.equal(await scalar("SELECT COUNT(*) FROM d1_migrations"), "11");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'account_kind'"), "1");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('devices') WHERE name = 'is_demo'"), "1");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('devices') WHERE name = 'measurement_keys_json'"), "1");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('device_pairing_codes') WHERE name = 'measurement_keys_json'"), "1");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('sensor_relationships') WHERE name IN ('user_id','device_id','kind','created_at')"), "4");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('device_telemetry_rollups')"), "7");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('device_social_rollups')"), "3");
    assert.equal(await scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN ('telemetry_rollup_after_insert','social_rollup_after_like_insert','social_rollup_after_like_delete')"), "3");
    assert.equal(await scalar("SELECT COUNT(*) FROM user_identities WHERE email IS NOT NULL OR email_verified <> 0"), "0");
  });
  await test("OIDC flow cookie binds callback to the starting browser", async () => {
    const start = await fetch(`${origin}/api/auth/google/start`, { redirect: "manual" });
    assert.equal(start.status, 302);
    const cookie = start.headers.get("set-cookie") ?? "";
    assert.match(cookie, /__Host-gaia_sensor_oidc=/u);
    assert.match(cookie, /; Secure;/u);
    assert.match(cookie, /; HttpOnly;/u);
    assert.match(cookie, /; SameSite=Lax/u);
    const location = new URL(start.headers.get("location"));
    assert.equal(location.searchParams.get("scope"), "openid");
    const state = location.searchParams.get("state");
    assert(state);
    const wrongBrowser = await fetch(`${origin}/api/auth/google/callback?state=${encodeURIComponent(state)}&code=not-exchanged`, {
      redirect: "manual",
    });
    assert.equal(wrongBrowser.status, 400);
    assert.equal((await wrongBrowser.json()).error.code, "INVALID_OIDC_STATE");
    assert.match(wrongBrowser.headers.get("set-cookie") ?? "", /__Host-gaia_sensor_oidc=.*Max-Age=0/u);
    const stillUnused = await query("SELECT consumed_at FROM oauth_flows ORDER BY created_at DESC LIMIT 1");
    assert.match(stillUnused, /consumed_at.*null/isu);
  });

  await test("anonymous trial requires same origin, stores no identity, and deletes its data on logout", async () => {
    const blocked = await fetch(`${origin}/api/auth/trial`, { method: "POST", headers: { Origin: "https://attacker.example" } });
    assert.equal(blocked.status, 403);
    const started = await fetch(`${origin}/api/auth/trial`, { method: "POST", headers: { Origin: origin } });
    assert.equal(started.status, 201);
    const startedBody = await started.json();
    assert.equal(startedBody.user.accountKind, "trial");
    assert.match(startedBody.user.displayName, /^おためし参加者 [A-Z0-9]{4}$/u);
    const trialAuth = authFromResponse(started);
    assert.equal(await scalar(`SELECT account_kind FROM users WHERE id = '${startedBody.user.id}'`), "trial");
    assert.equal(await scalar(`SELECT COUNT(*) FROM user_identities WHERE user_id = '${startedBody.user.id}'`), "0");
    assert.equal((await webFetch("/api/web/v1/devices", trialAuth)).status, 200);
    assert.equal((await webFetch("/api/web/v1/devices/pairing", trialAuth, { method: "POST", body: deviceDraft() })).status, 201);
    assert.equal((await webFetch("/api/web/v1/sensors/sensor_demo_bluecat/favorite", trialAuth, { method: "PUT" })).status, 200);
    assert.equal(await scalar(`SELECT COUNT(*) FROM sensor_relationships WHERE user_id = '${startedBody.user.id}'`), "1");
    const noCsrf = await webFetch("/api/web/v1/logout", trialAuth, { method: "POST", includeCsrf: false });
    assert.equal(noCsrf.status, 403);
    const logoutResponse = await webFetch("/api/web/v1/logout", trialAuth, { method: "POST" });
    assert.equal(logoutResponse.status, 200);
    assert.deepEqual(await logoutResponse.json(), { ok: true, accountDeleted: true });
    assert.equal(await scalar(`SELECT COUNT(*) FROM users WHERE id = '${startedBody.user.id}'`), "0");
    assert.equal(await scalar(`SELECT COUNT(*) FROM device_pairing_codes WHERE user_id = '${startedBody.user.id}'`), "0");
    assert.equal(await scalar(`SELECT COUNT(*) FROM sensor_relationships WHERE user_id = '${startedBody.user.id}'`), "0");
    assert.match(logoutResponse.headers.get("set-cookie") ?? "", /__Host-gaia_sensor_session=.*Max-Age=0/u);
  });

  const auth = await createLocalSession("user_test_owner");
  const otherAuth = await createLocalSession("user_test_other");
  await test("public sensor endpoint is available without a session", async () => {
    const response = await fetch(`${origin}/api/public/v1/sensors`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sensors.length, 4);
    assert.match(body.generatedAt, /^\d{4}-\d{2}-\d{2}T/u);
    assert.deepEqual(body.stats, { observationPackets: 0, payloadBytes: 0 });
    assert(body.sensors.every((sensor) => sensor.isDemo === true));
    assert(body.sensors.every((sensor) => Array.isArray(sensor.observations) && sensor.observations.length === 0));
    assert(body.sensors.every((sensor) => sensor.likeCount === 0));
    assert.deepEqual(body.sensors.map((sensor) => sensor.sensorName).sort(), ["sakuセンサー", "あめセンサー", "みずセンサー", "青猫センサー"].sort());
    assert.match(body.sensors.find((sensor) => sensor.sensorName === "青猫センサー").owner.avatarUrl, /slack-symbol-blue-apple-v1\.svg$/u);
    assert.deepEqual(Object.fromEntries(body.sensors.map((sensor) => [sensor.sensorName, [sensor.demoLocationLabel, sensor.location.latitude, sensor.location.longitude]])), {
      "あめセンサー": ["島本町", 34.9, 135.7],
      "sakuセンサー": ["深セン", 22.5, 114.1],
      "みずセンサー": ["余市町", 43, 140.8],
      "青猫センサー": ["秋葉原", 35.7, 139.8],
    });
  });
  await test("public measurement catalog covers air water soil weather motion energy and radiation", async () => {
    const response = await fetch(`${origin}/api/public/v1/measurement-types`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.maximumMeasurementsPerPacket, 16);
    assert(body.measurements.length >= 55);
    for (const category of ["atmosphere", "weather", "water", "soil", "motion", "energy", "radiation"]) {
      assert(body.categories.some((entry) => entry.id === category), category);
    }
    for (const key of ["temperature", "pm25", "water_temperature", "ph", "conductivity", "turbidity", "dissolved_oxygen", "water_level", "soil_moisture", "wind_speed", "voltage", "radiation_dose_rate"]) {
      const definition = body.measurements.find((entry) => entry.key === key);
      assert(definition, key);
      assert.equal(typeof definition.unit, "string");
      assert(definition.interfaces.length > 0);
      assert(definition.exampleSensors.length > 0);
    }
  });
  await test("authenticated participants can favorite and like public sensors with CSRF and idempotent counts", async () => {
    const sensorId = "sensor_demo_bluecat";
    const empty = await webFetch("/api/web/v1/social", auth);
    assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json()).sensors, []);
    const missingCsrf = await webFetch(`/api/web/v1/sensors/${sensorId}/like`, auth, { method: "PUT", includeCsrf: false });
    assert.equal(missingCsrf.status, 403);
    const favorite = await webFetch(`/api/web/v1/sensors/${sensorId}/favorite`, auth, { method: "PUT" });
    assert.equal(favorite.status, 200);
    assert.equal((await favorite.json()).social.favorite, true);
    const firstLike = await webFetch(`/api/web/v1/sensors/${sensorId}/like`, auth, { method: "PUT" });
    assert.deepEqual((await firstLike.json()).social, { sensorId, favorite: true, liked: true, likeCount: 1 });
    assert.equal(await scalar("SELECT like_count FROM device_social_rollups WHERE device_id = 'device_demo_bluecat'"), "1");
    const repeatedLike = await webFetch(`/api/web/v1/sensors/${sensorId}/like`, auth, { method: "PUT" });
    assert.equal((await repeatedLike.json()).social.likeCount, 1);
    const secondLike = await webFetch(`/api/web/v1/sensors/${sensorId}/like`, otherAuth, { method: "PUT" });
    assert.equal((await secondLike.json()).social.likeCount, 2);
    assert.equal(await scalar("SELECT like_count FROM device_social_rollups WHERE device_id = 'device_demo_bluecat'"), "2");
    const publicBody = await (await fetch(`${origin}/api/public/v1/sensors`)).json();
    assert.equal(publicBody.sensors.find((sensor) => sensor.id === sensorId).likeCount, 2);
    const social = await (await webFetch("/api/web/v1/social", auth)).json();
    assert.deepEqual(social.sensors, [{ sensorId, favorite: true, liked: true }]);
    assert.equal((await webFetch(`/api/web/v1/sensors/${sensorId}/like`, auth, { method: "DELETE" })).status, 200);
    assert.equal(await scalar("SELECT like_count FROM device_social_rollups WHERE device_id = 'device_demo_bluecat'"), "1");
    assert.equal((await webFetch(`/api/web/v1/sensors/${sensorId}/favorite`, auth, { method: "DELETE" })).status, 200);
  });
  await test("owner profile stores display name and optional social profile URLs", async () => {
    const update = await webFetch("/api/web/v1/profile", auth, {
      method: "PATCH",
      body: {
        displayName: "青猫センサー",
        xUrl: "https://x.com/bluecat_sensor",
        githubUrl: "https://github.com/bluecat-sensor",
        instagramUrl: "https://instagram.com/bluecat.sensor",
      },
    });
    assert.equal(update.status, 200);
    const profile = (await update.json()).profile;
    assert.equal(profile.publicId, "usr_testowner");
    assert.equal(profile.displayName, "青猫センサー");
    assert.equal(profile.githubUrl, "https://github.com/bluecat-sensor");
    assert.equal(Object.hasOwn(profile, "email"), false);
  });
  await test("social links only accept the intended HTTPS account hosts", async () => {
    const response = await webFetch("/api/web/v1/profile", auth, {
      method: "PATCH",
      body: { displayName: "青猫センサー", xUrl: "https://example.com/tracker", githubUrl: null, instagramUrl: null },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_SOCIAL_URL");
  });
  const avatarPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X4u1WQAAAABJRU5ErkJggg==", "base64");
  await test("avatar upload requires PNG, strips ancillary metadata, and is publicly readable by opaque id", async () => {
    const wrongType = await webFetch("/api/web/v1/profile/avatar", auth, {
      method: "PUT", rawBody: Buffer.from("not an image"), contentType: "image/jpeg",
    });
    assert.equal(wrongType.status, 415);
    const upload = await webFetch("/api/web/v1/profile/avatar", auth, {
      method: "PUT", rawBody: avatarPng, contentType: "image/png",
    });
    assert.equal(upload.status, 200);
    const profile = (await upload.json()).profile;
    assert.match(profile.avatarUrl, /^\/api\/public\/v1\/profiles\/usr_testowner\/avatar\?v=/u);
    const avatar = await fetch(`${origin}${profile.avatarUrl}`);
    assert.equal(avatar.status, 200);
    assert.equal(avatar.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await avatar.arrayBuffer()).subarray(0, 8), avatarPng.subarray(0, 8));
  });
  await test("session credential rotates while preserving expiry and Secure host cookie", async () => {
    const rotationAuth = await createLocalSession("user_test_owner");
    const session = await webFetch("/api/web/v1/session", rotationAuth);
    assert.equal(session.status, 200);
    assert.match(session.headers.get("set-cookie") ?? "", /^__Host-gaia_sensor_session=.*; Path=\/; HttpOnly; Secure; SameSite=Lax/u);
    assert.equal((await webFetch("/api/web/v1/devices", rotationAuth)).status, 401);
  });
  let pairingCode = "";
  await test("CSRF required for pairing creation", async () => {
    const response = await webFetch("/api/web/v1/devices/pairing", auth, { method: "POST", includeCsrf: false, body: deviceDraft() });
    assert.equal(response.status, 403);
  });
  await test("private sensor registration is rejected server-side", async () => {
    const response = await webFetch("/api/web/v1/devices/pairing", auth, {
      method: "POST",
      body: { ...deviceDraft(), isPublic: false },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "PUBLIC_SENSOR_REQUIRED");
  });
  await test("ISO 3166-1 country master has 249 valid unique codes and foreign keys", async () => {
    assert.equal(await scalar("SELECT COUNT(*) FROM countries"), "249");
    assert.equal(await scalar("SELECT COUNT(DISTINCT code) FROM countries"), "249");
    assert.equal(await scalar("SELECT COUNT(*) FROM countries WHERE code NOT GLOB '[A-Z][A-Z]' OR length(code) <> 2"), "0");
    assert.equal(await scalar("SELECT COUNT(*) FROM countries WHERE code IN ('JP','US','DE','BR','AQ')"), "5");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_foreign_key_list('devices') WHERE \"table\" = 'countries'"), "1");
    const invalidCountry = await webFetch("/api/web/v1/devices/pairing", auth, {
      method: "POST",
      body: { ...deviceDraft(), countryCode: "ZZ" },
    });
    assert.equal(invalidCountry.status, 400);
  });
  await test("canonical region registry lists current ISO subdivisions and official Japanese municipalities", async () => {
    const japan = await webFetch("/api/web/v1/regions?countryCode=JP&subdivisionCode=JP-14", auth);
    assert.equal(japan.status, 200);
    const japanBody = await japan.json();
    assert.equal(japanBody.subdivisions.length, 47);
    assert.deepEqual(japanBody.subdivisions.find(({ code }) => code === "JP-14"), { code: "JP-14", name: "神奈川県" });
    assert.deepEqual(japanBody.municipalities.find(({ code }) => code === "142085"), { code: "142085", name: "逗子市" });
    const okinawaOffice = await webFetch("/api/web/v1/region-location?countryCode=JP&subdivisionCode=JP-47", auth);
    assert.equal(okinawaOffice.status, 200);
    assert.deepEqual(await okinawaOffice.json(), {
      location: { latitude: 26.2124, longitude: 127.6809, precision: "PREFECTURAL_GOVERNMENT_OFFICE" },
    });
    const unitedStates = await webFetch("/api/web/v1/regions?countryCode=US", auth);
    assert.equal(unitedStates.status, 200);
    assert((await unitedStates.json()).subdivisions.some(({ code }) => code === "US-CA"));
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('devices') WHERE name IN ('subdivision_code','municipality_code')"), "2");
    assert.equal(await scalar("SELECT COUNT(*) FROM pragma_table_info('device_pairing_codes') WHERE name IN ('subdivision_code','municipality_code')"), "2");
  });
  await test("region validation rejects malformed, conflicting, and bad-check-digit codes", async () => {
    const cases = [
      [{ ...deviceDraft(), subdivisionCode: "JP-ZZ" }, "INVALID_SUBDIVISION"],
      [{ ...deviceDraft(), countryCode: "US", subdivisionCode: "US-CA", municipalityCode: "142085" }, "INVALID_MUNICIPALITY"],
      [{ ...deviceDraft(), municipalityCode: "142086" }, "INVALID_MUNICIPALITY"],
      [{ ...deviceDraft(), countryCode: "US" }, "REGION_FIELD_CONFLICT"],
      [{ ...deviceDraft(), admin1Code: "JP-13" }, "REGION_FIELD_CONFLICT"],
    ];
    for (const [body, code] of cases) {
      const response = await webFetch("/api/web/v1/devices/pairing", auth, { method: "POST", body });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, code);
    }
  });
  await test("legacy location payload remains accepted without canonical fields", async () => {
    const response = await webFetch("/api/web/v1/devices/pairing", auth, { method: "POST", body: legacyDeviceDraft() });
    assert.equal(response.status, 201);
    assert.equal(await scalar("SELECT COUNT(*) FROM device_pairing_codes WHERE subdivision_code IS NULL AND admin1_code = 'JP-14'"), "1");
  });
  await test("Japanese municipality code derives its ISO prefecture when omitted", async () => {
    const response = await webFetch("/api/web/v1/devices/pairing", auth, {
      method: "POST",
      body: { ...deviceDraft(), subdivisionCode: null },
    });
    assert.equal(response.status, 201);
    assert.equal(await scalar("SELECT COUNT(*) FROM device_pairing_codes WHERE subdivision_code = 'JP-14' AND municipality_code = '142085'"), "1");
  });
  await test("owner creates one-time pairing code", async () => {
    const response = await webFetch("/api/web/v1/devices/pairing", auth, { method: "POST", body: deviceDraft() });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.match(body.pairingCode, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/u);
    pairingCode = body.pairingCode;
    const hashProbe = await query(`SELECT code_hash, used_at FROM device_pairing_codes WHERE user_id = 'user_test_owner' ORDER BY created_at DESC LIMIT 1`);
    assert.equal(hashProbe.includes(pairingCode), false);
    assert.match(hashProbe, /[a-f0-9]{64}/u);
    const regionProbe = await query("SELECT subdivision_code, municipality_code, admin1_code, locality_name FROM device_pairing_codes WHERE user_id = 'user_test_owner' ORDER BY created_at DESC LIMIT 1");
    assert.match(regionProbe, /JP-14/su);
    assert.match(regionProbe, /142085/su);
    assert.match(regionProbe, /逗子市/su);
  });

  let deviceId = "";
  let deviceToken = "";
  await test("pairing code concurrent consume is exactly once", async () => {
    const call = () => fetch(`${origin}/api/v1/device/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode }),
    });
    const responses = await Promise.all([call(), call()]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    const success = responses.find((response) => response.status === 201);
    assert(success);
    const body = await success.json();
    deviceId = body.deviceId;
    deviceToken = body.deviceToken;
    assert.match(deviceToken, /^gdt_[A-Za-z0-9_-]{43}$/u);
    const counts = await query(`SELECT COUNT(*) AS device_count FROM devices WHERE owner_user_id = 'user_test_owner'`);
    assert.match(counts, /device_count.*1/su);
    assert.doesNotMatch(await query("SELECT token_hash FROM devices"), new RegExp(deviceToken, "u"));
  });

  await test("device token must match path device", async () => {
    const response = await telemetryFetch("dev_not_the_same", deviceToken, 1);
    assert.equal(response.status, 401);
  });
  await test("telemetry schema rejects unknown and nonfinite representation", async () => {
    const response = await fetch(`${origin}/api/v1/devices/${deviceId}/telemetry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ seq: 1, data: { temperature: 21 }, extra: true }),
    });
    assert.equal(response.status, 400);
    const unknownKey = await fetch(`${origin}/api/v1/devices/${deviceId}/telemetry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ seq: 1, data: { made_up_sensor: 21 } }),
    });
    assert.equal(unknownKey.status, 400);
    assert.equal((await unknownKey.json()).error.code, "UNSUPPORTED_SENSOR_KEY");
    const impossiblePh = await fetch(`${origin}/api/v1/devices/${deviceId}/telemetry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ seq: 1, data: { ph: 22 } }),
    });
    assert.equal(impossiblePh.status, 400);
    assert.equal((await impossiblePh.json()).error.code, "SENSOR_VALUE_OUT_OF_RANGE");
  });
  await test("Arduino seconds-only RFC3339 payload is canonicalized and idempotent", async () => {
    const starterObservedAt = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
    const first = await telemetryFetch(deviceId, deviceToken, 1, starterObservedAt);
    const second = await telemetryFetch(deviceId, deviceToken, 1, starterObservedAt);
    assert.equal(first.status, 202);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).duplicate, true);
    assert.match(await query(`SELECT COUNT(*) AS telemetry_count FROM telemetry WHERE device_id = '${deviceId}'`), /telemetry_count.*1/su);
    assert.equal(await scalar(`SELECT observation_count FROM device_telemetry_rollups WHERE device_id = '${deviceId}'`), "1");
    assert.equal(
      await scalar(`SELECT payload_bytes FROM device_telemetry_rollups WHERE device_id = '${deviceId}'`),
      await scalar(`SELECT SUM(length(payload_json)) FROM telemetry WHERE device_id = '${deviceId}'`),
    );
    assert.equal(await scalar(`SELECT observed_at FROM telemetry WHERE device_id = '${deviceId}' AND seq = 1`), new Date(starterObservedAt).toISOString());
  });
  await test("new telemetry is limited to one stored record per device per minute", async () => {
    const beforeLastSeen = await scalar(`SELECT last_seen_at FROM devices WHERE device_id = '${deviceId}'`);
    const limited = await telemetryFetch(deviceId, deviceToken, 2);
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, "TELEMETRY_RATE_LIMITED");
    assert.match(limited.headers.get("Retry-After") ?? "", /^(?:[1-9]|[1-5][0-9]|60)$/u);
    assert.equal(await scalar(`SELECT last_seq FROM devices WHERE device_id = '${deviceId}'`), "1");
    assert.equal(await scalar(`SELECT COUNT(*) FROM telemetry WHERE device_id = '${deviceId}' AND seq = 2`), "0");
    assert.equal(await scalar(`SELECT last_seen_at FROM devices WHERE device_id = '${deviceId}'`), beforeLastSeen);
  });
  await test("same seq with different payload is rejected", async () => {
    const response = await fetch(`${origin}/api/v1/devices/${deviceId}/telemetry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deviceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ seq: 1, data: { temperature: 99 } }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "SEQUENCE_CONFLICT");
  });
  await test("lower unused seq is stale and does not update last_seen", async () => {
    await openTelemetryWindow(deviceId);
    assert.equal((await telemetryFetch(deviceId, deviceToken, 3)).status, 202);
    const before = await scalar(`SELECT last_seen_at FROM devices WHERE device_id = '${deviceId}'`);
    await delay(20);
    const stale = await telemetryFetch(deviceId, deviceToken, 2);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.code, "STALE_SEQUENCE");
    const after = await scalar(`SELECT last_seen_at FROM devices WHERE device_id = '${deviceId}'`);
    assert.equal(after, before);
  });
  await test("concurrent next sequences only advance monotonically", async () => {
    await openTelemetryWindow(deviceId);
    const responses = await Promise.all([
      telemetryFetch(deviceId, deviceToken, 4),
      telemetryFetch(deviceId, deviceToken, 4),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 202]);
    assert.equal(await scalar(`SELECT last_seq FROM devices WHERE device_id = '${deviceId}'`), "4");
    assert.equal(await scalar(`SELECT COUNT(*) FROM telemetry WHERE device_id = '${deviceId}' AND seq = 4`), "1");
    assert.equal(await scalar(`SELECT observation_count FROM device_telemetry_rollups WHERE device_id = '${deviceId}'`), "3");
    assert.equal(await scalar(`SELECT json_array_length(recent_payloads_json) FROM device_telemetry_rollups WHERE device_id = '${deviceId}'`), "3");
  });
  await test("owner latest/history and other user isolation", async () => {
    const latest = await webFetch(`/api/web/v1/devices/${deviceId}/latest`, auth);
    assert.equal(latest.status, 200);
    const ownerDevice = (await latest.json()).device;
    assert.equal(ownerDevice.subdivisionCode, "JP-14");
    assert.equal(ownerDevice.subdivisionName, "神奈川県");
    assert.equal(ownerDevice.municipalityCode, "142085");
    assert.equal(ownerDevice.municipalityName, "逗子市");
    assert.match(ownerDevice.publicId, /^sensor_/u);
    assert.equal((await webFetch(`/api/web/v1/devices/${deviceId}/telemetry?limit=10`, auth)).status, 200);
    assert.equal((await webFetch(`/api/web/v1/devices/${deviceId}`, otherAuth)).status, 404);
    assert.equal((await webFetch(`/api/web/v1/devices/${deviceId}/latest`, otherAuth)).status, 404);
    assert.equal((await webFetch(`/api/web/v1/devices/${deviceId}/telemetry`, otherAuth)).status, 404);
  });
  await test("ONLINE threshold handles ISO timestamps at 29s and 31s", async () => {
    const online29 = await scalar("SELECT datetime('2026-08-12T08:21:31.000Z') >= datetime('2026-08-12T08:22:00.000Z', '-30 seconds')");
    const offline31 = await scalar("SELECT datetime('2026-08-12T08:21:29.000Z') >= datetime('2026-08-12T08:22:00.000Z', '-30 seconds')");
    assert.equal(online29, "1");
    assert.equal(offline31, "0");
  });
  await test("location update owner-only then logical revoke stops token", async () => {
    const update = await webFetch(`/api/web/v1/devices/${deviceId}`, auth, {
      method: "PATCH",
      body: { ...deviceDraft(), isPublic: true, publicLatitude: 35.294163, publicLongitude: 139.581274 },
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).device.isPublic, true);
    const publicResponse = await fetch(`${origin}/api/public/v1/sensors`);
    assert.equal(publicResponse.status, 200);
    const publicBody = await publicResponse.json();
    assert.equal(publicBody.sensors.length, 5);
    const registeredSensor = publicBody.sensors.find((sensor) => sensor.isDemo === false);
    assert(registeredSensor);
    assert.equal(registeredSensor.location.latitude, 35.29416);
    assert.equal(registeredSensor.location.longitude, 139.58127);
    assert.equal(registeredSensor.location.precision, "PUBLIC_REFERENCE_POINT");
    assert.deepEqual(registeredSensor.region, {
      countryCode: "JP",
      subdivisionCode: "JP-14",
      subdivisionName: "神奈川県",
      municipalityCode: "142085",
      municipalityName: "逗子市",
    });
    assert.equal(registeredSensor.owner.displayName, "青猫センサー");
    assert.equal(registeredSensor.owner.xUrl, "https://x.com/bluecat_sensor");
    assert.equal(Object.hasOwn(registeredSensor, "lastSeenAt"), false);
    assert(registeredSensor.observationCount >= 1);
    assert(registeredSensor.observationSpanSeconds >= 0);
    assert(registeredSensor.observations.length >= 1 && registeredSensor.observations.length <= 12);
    assert.deepEqual(registeredSensor.observations[0].data, {
      humidity: 58.2,
      ph: 7.18,
      pm25: 9.1,
      temperature: 21.4,
      turbidity: 2.7,
      water_temperature: 18.4,
    });
    assert(publicBody.stats.observationPackets >= registeredSensor.observationCount);
    assert(publicBody.stats.payloadBytes > 0);
    const publicJson = JSON.stringify(publicBody);
    assert.doesNotMatch(publicJson, /user_test_owner|@|lastSeenAt|receivedAt|observedAt|localityName/u);
    const forbidden = await webFetch(`/api/web/v1/devices/${deviceId}`, otherAuth, {
      method: "PATCH",
      body: deviceDraft(),
    });
    assert.equal(forbidden.status, 404);
    const revoke = await webFetch(`/api/web/v1/devices/${deviceId}`, auth, { method: "DELETE" });
    assert.equal(revoke.status, 204);
    assert.equal((await telemetryFetch(deviceId, deviceToken, 2)).status, 401);
  });

  await test("account deletion requires own session, same Origin, CSRF and exact explicit confirmation", async () => {
    const endpoint = "/api/web/v1/account";
    assert.equal((await fetch(`${origin}${endpoint}`, { method: "DELETE" })).status, 401);
    for (const options of [
      { includeCsrf: false, body: { confirmation: "DELETE_MY_ACCOUNT" }, status: 403 },
      { origin: "https://other.invalid", body: { confirmation: "DELETE_MY_ACCOUNT" }, status: 403 },
      { origin: "", body: { confirmation: "DELETE_MY_ACCOUNT" }, status: 403 },
      { body: { confirmation: "DELETE" }, status: 400 },
      { body: { confirmation: "DELETE_MY_ACCOUNT", userId: "user_test_other" }, status: 400 },
    ]) {
      const response = await webFetch(endpoint, auth, { method: "DELETE", ...options });
      assert.equal(response.status, options.status);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(await scalar("SELECT COUNT(*) FROM users WHERE id='user_test_owner'"), "1");
    }
  });
  await test("Google-linked owner deletion cascades without deleting other owners and revokes all access", async () => {
    await execute("INSERT INTO user_identities (id,user_id,provider,provider_subject,created_at,updated_at) VALUES ('identity_delete_fixture','user_test_owner','google','synthetic-delete-fixture','2026-09-07T00:00:00Z','2026-09-07T00:00:00Z')");
    const secondAuth = await createLocalSession("user_test_owner");
    const beforeOther = await scalar("SELECT COUNT(*) FROM devices WHERE owner_user_id='user_test_other'");
    const pairing = await webFetch("/api/web/v1/devices/pairing", auth, { method: "POST", body: deviceDraft() });
    assert.equal(pairing.status, 201);
    const pair = await fetch(`${origin}/api/v1/device/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairingCode: (await pairing.json()).pairingCode }) });
    assert.equal(pair.status, 201);
    const paired = await pair.json();
    assert.equal((await telemetryFetch(paired.deviceId, paired.deviceToken, 1)).status, 202);
    const response = await webFetch("/api/web/v1/account", auth, { method: "DELETE", body: { confirmation: "DELETE_MY_ACCOUNT" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accountDeleted, true);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/u);
    for (const table of ["sessions", "user_identities", "device_pairing_codes", "sensor_relationships"]) assert.equal(await scalar(`SELECT COUNT(*) FROM ${table} WHERE user_id='user_test_owner'`), "0", table);
    assert.equal(await scalar("SELECT COUNT(*) FROM devices WHERE owner_user_id='user_test_owner'"), "0");
    for (const table of ["telemetry", "device_telemetry_rollups"]) assert.equal(await scalar(`SELECT COUNT(*) FROM ${table} WHERE device_id='${paired.deviceId}'`), "0", table);
    assert.equal(await scalar("SELECT COUNT(*) FROM users WHERE id='user_test_owner'"), "0");
    assert.equal(await scalar("SELECT COUNT(*) FROM users WHERE id='user_test_other'"), "1");
    assert.equal(await scalar("SELECT COUNT(*) FROM devices WHERE owner_user_id='user_test_other'"), beforeOther);
    assert.equal((await webFetch("/api/web/v1/devices", auth)).status, 401);
    assert.equal((await webFetch("/api/web/v1/devices", secondAuth)).status, 401);
    assert.equal((await telemetryFetch(paired.deviceId, paired.deviceToken, 2)).status, 401);
    assert.equal((await fetch(`${origin}/api/public/v1/profiles/usr_testowner/avatar?v=1`)).status, 404);
    const publicBody = await (await fetch(`${origin}/api/public/v1/sensors`)).text();
    assert(!publicBody.includes(paired.deviceId));
  });
  const leaked = /(Authorization: Bearer|gdt_[A-Za-z0-9_-]{20,}|[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4})/u.test(serverOutput);
  assert.equal(leaked, false, "server output must not contain credentials");
  assert.equal(Object.values(testSecrets).some((secret) => serverOutput.includes(secret)), false, "server output must not contain test secrets");
  console.log(JSON.stringify({ status: "passed", scans: reports.length, reports }, null, 2));
} finally {
  server.kill();
}

async function test(name, run) {
  await run();
  reports.push({ name, status: "passed" });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 360; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Worker did not start.\n${serverOutput}`);
}

function deviceDraft() {
  return {
    name: "ベランダ環境センサー",
    countryCode: "JP",
    subdivisionCode: "JP-14",
    municipalityCode: "142085",
    admin1Code: null,
    localityName: null,
    isPublic: true,
    publicLatitude: 35.3,
    publicLongitude: 139.6,
    measurementKeys: ["temperature", "humidity", "pm25", "water_temperature", "ph", "turbidity"],
  };
}

function legacyDeviceDraft() {
  return {
    name: "旧クライアント",
    countryCode: "JP",
    admin1Code: "JP-14",
    localityName: "逗子市",
    isPublic: true,
    publicLatitude: 35.3,
    publicLongitude: 139.6,
  };
}

async function createLocalSession(userId) {
  const token = `gs_${randomBytes(32).toString("base64url")}`;
  const csrf = `csrf_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const csrfHash = createHash("sha256").update(csrf).digest("hex");
  const id = randomBytes(12).toString("hex");
  const expires = new Date(Date.now() + 3_600_000).toISOString();
  const now = new Date().toISOString();
  await execute(`INSERT INTO sessions (id, token_hash, user_id, csrf_hash, expires_at, created_at, last_seen_at) VALUES ('${id}', '${tokenHash}', '${userId}', '${csrfHash}', '${expires}', '${now}', '${now}')`);
  return { token, csrf, tokenHash, csrfHash };
}

async function webFetch(path, auth, options = {}) {
  const headers = { Cookie: `__Host-gaia_sensor_session=${auth.token}; __Host-gaia_sensor_csrf=${auth.csrf}`, Origin: options.origin ?? origin };
  if (options.includeCsrf !== false && options.method && options.method !== "GET") headers["X-CSRF-Token"] = auth.csrf;
  let body;
  if (options.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  } else if (options.rawBody) {
    headers["Content-Type"] = options.contentType || "application/octet-stream";
    body = options.rawBody;
  }
  return fetch(`${origin}${path}`, { method: options.method ?? "GET", headers, body });
}

function authFromResponse(response) {
  const cookies = response.headers.get("set-cookie") ?? "";
  const token = cookies.match(/__Host-gaia_sensor_session=([^;,]+)/u)?.[1];
  const csrf = cookies.match(/__Host-gaia_sensor_csrf=([^;,]+)/u)?.[1];
  assert(token && csrf, "trial response must set session and CSRF cookies");
  return { token: decodeURIComponent(token), csrf: decodeURIComponent(csrf) };
}

function telemetryFetch(id, token, seq, observedAt) {
  return fetch(`${origin}/api/v1/devices/${id}/telemetry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ seq, ...(observedAt ? { observedAt } : {}), data: { temperature: 21.4, humidity: 58.2, pm25: 9.1, water_temperature: 18.4, ph: 7.18, turbidity: 2.7 } }),
  });
}

async function openTelemetryWindow(id) {
  await execute(`UPDATE devices SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-61 seconds') WHERE device_id = '${id}'`);
}

async function execute(sql) {
  await command(["d1", "execute", "gaia-senseware-sensors-local", "--local", `--persist-to=${persistPath}`, "--command", sql]);
}

async function query(sql) {
  return command(["d1", "execute", "gaia-senseware-sensors-local", "--local", `--persist-to=${persistPath}`, "--command", sql]);
}

async function scalar(sql) {
  const output = await command(["d1", "execute", "gaia-senseware-sensors-local", "--local", `--persist-to=${persistPath}`, "--json", "--command", sql]);
  const parsed = JSON.parse(output);
  const row = parsed[0]?.results?.[0];
  return row ? String(Object.values(row)[0]) : "";
}
