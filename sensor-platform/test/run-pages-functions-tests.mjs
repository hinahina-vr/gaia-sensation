import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import "./check-prefecture-field.mjs";
import ts from "typescript";

const sensorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(sensorRoot, "..");
const nodePath = process.env.GAIA_NODE_PATH || process.execPath;
const wranglerPath = process.env.GAIA_WRANGLER_PATH || path.join(sensorRoot, "node_modules", "wrangler", "bin", "wrangler.js");
if (!fs.existsSync(wranglerPath)) throw new Error(`Wrangler entrypoint was not found: ${wranglerPath}`);
const origin = "http://127.0.0.1:8792";
const persistPath = path.join(root, ".wrangler", `pages-functions-test-${process.pid}`);
const reports = [];

await test("Live Senseware uses free-plan provider gates and five-minute stream refreshes", async () => {
  const source = fs.readFileSync(path.join(sensorRoot, "src", "live-senseware.ts"), "utf8");
  const productionConfig = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  assert.match(source, /STREAM_REFRESH_MS = 5 \* 60 \* 1_000/u);
  assert.match(source, /LIVE_SENSEWARE_JAXA_ENABLED === "true"/u);
  assert.match(source, /JAXA live disabled for free-plan CPU safety/u);
  assert.match(source, /LIVE_SENSEWARE_ESA_ENABLED === "true" && env\.CDSE_CLIENT_ID && env\.CDSE_CLIENT_SECRET/u);
  assert.match(source, /open-meteo-\$\{city\.id\}-weather-v1[\s\S]*30 \* 60 \* 1_000/u);
  assert.match(source, /open-meteo-\$\{city\.id\}-air-v1[\s\S]*3 \* 60 \* 60 \* 1_000/u);
  assert.match(source, /resolveObservationCity\(new URL\(request\.url\)\.searchParams\.get\("city"\)\)/u);
  assert.equal((source.match(/Object\.freeze\(\{ id: "[a-z-]+", name: "[^"]+", lat:/gu) || []).length, 47);
  assert.match(source, /const DEFAULT_CITY = CITY_LOCATIONS\.sapporo/u);
  assert(source.indexOf("sapporo: Object.freeze") < source.indexOf("aomori: Object.freeze"));
  assert(source.indexOf("aomori: Object.freeze") < source.indexOf("naha: Object.freeze"));
  assert.match(source, /current: "temperature_2m,precipitation,cloud_cover,wind_speed_10m"/u);
  const national = fs.readFileSync(path.join(sensorRoot, "src", "prefecture-field.ts"), "utf8");
  assert.match(national, /ttl: 300_000/u);
  assert.match(national, /latitude: cities\.map\(city => city\.lat\)\.join\(","\)/u);
  assert.match(national, /longitude: cities\.map\(city => city\.lon\)\.join\(","\)/u);
  assert.match(national, /weatherWindSpeed: "wind_speed_10m"/u);
  assert.match(source, /\/api\/live\/v1\/prefecture-field/u);
  assert.match(source, /\/api\/live\/v1\/wind-field/u);
  assert.match(source, /FIRMS_SOURCE_URL = "https:\/\/firms\.modaps\.eosdis\.nasa\.gov\/data\/active_fire\/modis-c6\.1\/csv\/MODIS_C6_1_Global_24h\.csv"/u);
  assert.match(source, /FIRMS_MAX_SOURCE_BYTES = 4_000_000/u);
  assert.match(source, /FIRMS_CONFIDENCE_MIN = 60/u);
  assert.match(source, /\/api\/live\/v1\/firms/u);
  assert.match(source, /current: "carbon_dioxide,pm2_5"/u);
  assert.match(source, /refresh = setInterval\(\(\) => void emitSnapshot\(\), STREAM_REFRESH_MS\)/u);
  assert.match(productionConfig, /"LIVE_SENSEWARE_ENABLED": "true"/u);
  assert.match(productionConfig, /"LIVE_SENSEWARE_JAXA_ENABLED": "false"/u);
  assert.match(productionConfig, /"LIVE_SENSEWARE_ESA_ENABLED": "false"/u);
});

const command = (argumentsList) => new Promise((resolve, reject) => {
  const child = spawn(nodePath, [wranglerPath, ...argumentsList], { cwd: root, env: process.env, windowsHide: true });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve(output) : reject(new Error(output)));
});

await test("advanced handler delegates API and calls ASSETS exactly once for non-API", async () => {
  const source = fs.readFileSync(path.join(root, "sensor-platform", "src", "pages-entry.ts"), "utf8")
    .replace(/^import \{ browserSecurityHeaders \}[^\n]+$/mu, fs.readFileSync(path.join(sensorRoot, "src/browser-security.ts"), "utf8").replace("export const", "const"))
    .replace(/^import sensorPlatform[^\n]+$/mu, "const sensorPlatform = globalThis.__gaiaPagesSensorHandler;")
    .replace(/^import \{ handleLiveSenseware \}[^\n]+$/mu, "const handleLiveSenseware = globalThis.__gaiaPagesLiveHandler;")
    .replace(/interface PagesEnv extends Env \{\r?\n  ASSETS: Fetcher;\r?\n\}\r?\n\r?\n/u, "")
    .replace(/\(pathname: string\): boolean/gu, "(pathname)")
    .replace(/\(\): Response/gu, "()")
    .replace(/: Request/gu, "")
    .replace(/: PagesEnv/gu, "")
    .replace(/: ExecutionContext/gu, "")
    .replace(/: Promise<Response>/gu, "")
    .replace(/ satisfies ExportedHandler<PagesEnv>;/u, ";");
  let apiCalls = 0;
  let assetCalls = 0;
  globalThis.__gaiaPagesSensorHandler = { fetch: async () => { apiCalls += 1; return new Response("api"); } };
  globalThis.__gaiaPagesLiveHandler = async () => null;
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const module = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  const env = { ASSETS: { fetch: async () => { assetCalls += 1; return new Response("static"); } } };
  const context = { waitUntil() {}, passThroughOnException() {} };
  assert.equal((await module.default.fetch(new Request("https://example.test/api/health"), env, context)).status, 200);
  assert.equal(apiCalls, 1);
  assert.equal(assetCalls, 0);
  const blocked = await module.default.fetch(new Request("https://example.test/README.md"), env, context);
  assert.equal(blocked.status, 404);
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  assert.equal(assetCalls, 0);
  assert.equal(await (await module.default.fetch(new Request("https://example.test/story"), env, context)).text(), "static");
  assert.equal(apiCalls, 1);
  assert.equal(assetCalls, 1);
  const characterSheet = await module.default.fetch(new Request("https://example.test/artifacts/gx-setting-bible/01-three-ecologies-character-master.png"), env, context);
  assert.equal(await characterSheet.text(), "static");
  assert.equal(assetCalls, 2);
  const privateArtifact = await module.default.fetch(new Request("https://example.test/artifacts/gx-setting-bible/README.md"), env, context);
  assert.equal(privateArtifact.status, 404);
  assert.equal(assetCalls, 2);
  const ranged = await module.default.fetch(new Request("https://example.test/assets/audio/test.mp3", { headers: { Range: "bytes=1-3" } }), env, context);
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get("accept-ranges"), "bytes");
  assert.equal(ranged.headers.get("content-range"), "bytes 1-3/6");
  assert.equal(await ranged.text(), "tat");
  assert.equal(assetCalls, 3);
  const rangedWav = await module.default.fetch(new Request("https://example.test/assets/audio/test.wav", { headers: { Range: "bytes=0-1" } }), env, context);
  assert.equal(rangedWav.status, 206);
  assert.equal(rangedWav.headers.get("accept-ranges"), "bytes");
  assert.equal(rangedWav.headers.get("content-range"), "bytes 0-1/6");
  assert.equal(await rangedWav.text(), "st");
  assert.equal(assetCalls, 4);
  delete globalThis.__gaiaPagesSensorHandler;
  delete globalThis.__gaiaPagesLiveHandler;
});

await command(["d1", "migrations", "apply", "gaia-senseware-sensors", "--local", "--config", "wrangler.jsonc", `--persist-to=${persistPath}`]);

const server = spawn(nodePath, [
  wranglerPath,
  "pages", "dev", ".",
  "--port", "8792",
  "--ip", "127.0.0.1",
  `--persist-to=${persistPath}`,
  "--binding=ENVIRONMENT=local",
  `--binding=PUBLIC_ORIGIN=${origin}`,
  `--binding=WEB_ORIGIN=${origin}`,
  "--binding=LIVE_SENSEWARE_ENABLED=false",
], { cwd: root, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

try {
  await waitForServer();
  await test("API health is a Function response", async () => {
    const response = await fetch(`${origin}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).service, "gaia-senseware-sensor-platform");
    assert.match(response.headers.get("x-request-id") ?? "", /.+/u);
    assert.match(response.headers.get("content-security-policy") ?? "", /object-src 'none'/u);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer", "Pages wrapper must preserve stricter API privacy policy");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
  await test("Live Senseware is an honest versioned snapshot while disabled", async () => {
    const response = await fetch(`${origin}/api/live/v1/snapshot`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.source, "snapshot");
    assert.match(payload.fallbackReason, /LIVE_SENSEWARE_ENABLED/u);
    assert.deepEqual([...new Set(payload.events.map((event) => event.provider))].sort(), ["esa", "jaxa", "noaa", "open-meteo"]);
    assert(payload.events.every((event) => event.status === "snapshot"));
  });
  for (const file of ["assets/audio/satellite-forecast-hope.mp3", "assets/audio/gaia-map-ambient-harp-felt-piano.wav"]) {
    await test(`actual Pages audio Range bytes and CSP: ${path.extname(file)}`, async () => {
      const response = await fetch(`${origin}/${file}`, { headers: { Range: "bytes=0-63" } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get("content-range"), `bytes 0-63/${fs.statSync(path.join(root, file)).size}`);
      assert.match(response.headers.get("content-security-policy") ?? "", /media-src 'self' blob:/u);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(root, file)).subarray(0, 64));
    });
  }
  await test("national analysis route exposes all 47 identities and six metrics without fabricating disabled values", async () => {
    const response = await fetch(`${origin}/api/live/v1/prefecture-field`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.scope, "japan-prefectures");
    assert.equal(payload.targetCount, 47);
    for (const [provider, keys] of [["weather", ["cloudCover", "weatherPrecipitation", "weatherTemperature", "weatherWindSpeed"]], ["air", ["forecastCo2", "pm25"]]]) {
      const field = payload[provider];
      assert.equal(field.source, "unavailable");
      assert.equal(field.points.length, 47);
      assert.equal(new Set(field.points.map(point => point.id)).size, 47);
      assert.deepEqual(Object.keys(field.points[0].measurements).sort(), keys);
      assert(field.points.every(point => Object.values(point.measurements).every(value => value === null)));
    }
    assert.equal((await fetch(`${origin}/api/live/v1/prefecture-field`, { method: "POST" })).status, 405);
    assert.equal(await (await fetch(`${origin}/api/live/v1/prefecture-field`, { method: "HEAD" })).text(), "");
  });
  await test("prefecture wind field stays D1-free and marks all values missing while live providers are disabled", async () => {
    const response = await fetch(`${origin}/api/live/v1/wind-field`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.source, "unavailable");
    assert.equal(payload.points.length, 47);
    assert(payload.points.every((point) => point.windSpeed === null && point.quality === "missing"));
    assert.equal(payload.points[0].id, "sapporo");
    assert.equal(payload.points.at(-1).id, "naha");
    assert.match(payload.fallbackReason, /LIVE_SENSEWARE_ENABLED/u);
  });
  await test("NASA FIRMS endpoint serves the versioned global fire snapshot while live providers are disabled", async () => {
    const response = await fetch(`${origin}/api/live/v1/firms`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /stale-while-revalidate/u);
    const payload = await response.json();
    assert.equal(payload.source, "snapshot");
    assert.match(payload.fallbackReason, /LIVE_SENSEWARE_ENABLED/u);
    assert.match(payload.provenance.provider, /NASA.+FIRMS/u);
    assert(payload.points.length > 100 && payload.points.length <= 1_600);
    assert.equal(payload.summary.displayed, payload.points.length);
    assert(payload.points.every((point) => point.confidence >= 60));
  });
  await test("Live Senseware SSE emits normalized snapshot and provider events", async () => {
    const controller = new AbortController();
    const response = await fetch(`${origin}/api/live/v1/stream`, { signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/u);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("event: status")) {
      const chunk = await Promise.race([
        reader.read(),
        delay(5_000).then(() => { throw new Error("SSE first events timed out"); }),
      ]);
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    controller.abort();
    assert.match(text, /event: snapshot/u);
    assert.match(text, /event: provider/u);
    assert.match(text, /event: status/u);
    assert.match(text, /"schemaVersion":1/u);
  });
  await test("anonymous trial session is available through the Pages Function", async () => {
    const response = await fetch(`${origin}/api/auth/trial`, { method: "POST", headers: { Origin: origin } });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).user.accountKind, "trial");
    const cookies = response.headers.get("set-cookie") ?? "";
    assert.match(cookies, /__Host-gaia_sensor_session=/u);
    assert.match(cookies, /__Host-gaia_sensor_csrf=/u);
  });
  for (const staticPath of ["/story", "/sensors/", "/novel-mode.js", "/sensors/sensor-platform.js", "/artifacts/gx-setting-bible/01-three-ecologies-character-master.png"]) {
    await test(`${staticPath} remains static`, async () => {
      const response = await fetch(`${origin}${staticPath}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.has("x-request-id"), false);
      assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/u);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    });
  }
  for (const nonPublicPath of ["/README.md", "/.tmp-character-copy/report.json", "/docs/CONTEST_2026_SUBMISSION.md", "/scripts/check-contest-experience-browser.mjs", "/artifacts/gx-setting-bible/README.md"]) {
    await test(`${nonPublicPath} is not public`, async () => {
      const response = await fetch(`${origin}${nonPublicPath}`);
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(await response.text(), "Not Found");
    });
  }
  await test("unknown API path still invokes the Function", async () => {
    const response = await fetch(`${origin}/api/not-found`);
    assert.equal(response.status, 401);
    assert.match(response.headers.get("x-request-id") ?? "", /.+/u);
  });
  assert.doesNotMatch(serverOutput, /(?:Uncaught|ERROR|Internal Server Error)/u);
  console.log(JSON.stringify({ status: "passed", scans: reports.length, reports }, null, 2));
} finally {
  server.kill();
}

async function test(name, run) {
  await run();
  reports.push({ name, status: "passed" });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Pages dev did not start.\n${serverOutput}`);
}
