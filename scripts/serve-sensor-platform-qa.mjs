import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "./lib/browser-security-qa.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 4397);
let pairingIssued = false;
let deviceCreated = false;
let latestPolls = 0;
let avatarUploaded = false;
let sessionKind = null;
let lastPairingDraft = null;
let lastDeviceDraft = null;
const favoriteSensors = new Set();
const likedSensors = new Set();
const initialProfile = () => ({
  publicId: "usr_browserqa",
  displayName: "青猫センサー",
  avatarUrl: "/api/public/v1/profiles/usr_browserqa/avatar?v=qa",
  // Preview identities do not imply real social accounts. Leave these unset
  // until the owner supplies their actual public profile URLs.
  xUrl: null,
  githubUrl: null,
  instagramUrl: null,
});
let profile = initialProfile();
const avatarPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X4u1WQAAAABJRU5ErkJggg==", "base64");
const initialDevice = () => ({
  deviceId: "dev_browser_qa",
  publicId: "sensor_browserqa",
  name: "ベランダ環境センサー",
  countryCode: "JP",
  countryName: "日本",
  subdivisionCode: "JP-13",
  subdivisionName: "東京都",
  municipalityCode: "131130",
  municipalityName: "渋谷区",
  admin1Code: "JP-13",
  localityName: "渋谷区",
  state: "OFFLINE",
  lastSeenAt: null,
  createdAt: "2026-08-12T00:00:00.000Z",
  isPublic: true,
  publicLatitude: 35.7,
  publicLongitude: 139.7,
  measurementKeys: ["temperature", "humidity", "pm25", "water_temperature", "ph", "turbidity"],
});
let device = initialDevice();
const requests = [];

const server = http.createServer(async (request, response) => {
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  requests.push({
    method: request.method,
    path: url.pathname,
    at: new Date().toISOString(),
    authorizationPresent: Boolean(request.headers.authorization),
    apiKeyPresent: Boolean(request.headers["x-api-key"] || request.headers["x-goog-api-key"]),
  });
  try {
    if (url.pathname === "/__qa/report") return sendJson(response, 200, { requests, latestPolls, avatarUploaded, lastPairingDraft, lastDeviceDraft, profile });
    if (url.pathname === "/__qa/reset" && request.method === "POST") {
      requests.length = 0;
      pairingIssued = false;
      deviceCreated = false;
      latestPolls = 0;
      avatarUploaded = false;
      sessionKind = null;
      lastPairingDraft = null;
      lastDeviceDraft = null;
      favoriteSensors.clear();
      likedSensors.clear();
      profile = initialProfile();
      device = initialDevice();
      return sendJson(response, 200, { ok: true });
    }
    if (url.pathname.startsWith("/api/")) return handleApi(request, response, url);
    const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const resolved = path.resolve(root, `.${relative}`);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return sendJson(response, 403, { error: "forbidden" });
    const stat = await fs.stat(resolved).catch(() => null);
    const file = stat?.isDirectory() ? path.join(resolved, "index.html") : resolved;
    const body = await fs.readFile(file);
    response.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" });
    response.end(body);
  } catch (error) {
    console.error("qa-server", error instanceof Error ? error.message : "unknown");
    sendJson(response, 404, { error: "not found" });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`sensor qa http://127.0.0.1:${port}`));

async function handleApi(request, response, url) {
  const referer = request.headers.referer || "";
  if (referer.includes("error=1")) return sendJson(response, 500, { error: { code: "QA_ERROR", message: "QA用の通信エラーです。" } });
  if (url.pathname === "/api/public/v1/sensors" && request.method === "GET") {
    return sendJson(response, 200, qaPublicSensorPayload());
  }
  if (url.pathname === "/api/public/v1/measurement-types" && request.method === "GET") {
    return sendJson(response, 200, qaMeasurementCatalog());
  }
  if (url.pathname === "/api/public/v1/profiles/usr_browserqa/avatar" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    return response.end(avatarPng);
  }
  if (url.pathname === "/api/web/v1/session") {
    const accountKind = referer.includes("authenticated=1") ? "google" : sessionKind;
    if (!accountKind) return sendJson(response, 401, { error: { code: "AUTHENTICATION_REQUIRED", message: "Login is required." } });
    return sendJson(response, 200, {
      user: {
        id: accountKind === "trial" ? "user_trial_qa" : "user_browser_qa",
        displayName: accountKind === "trial" ? "おためし参加者 7A9C" : "GAIA参加者 B2D4",
        accountKind,
      },
      expiresAt: "2026-08-13T00:00:00.000Z",
    });
  }
  if (url.pathname === "/api/auth/trial" && request.method === "POST") {
    sessionKind = "trial";
    return sendJson(response, 201, {
      user: { id: "user_trial_qa", displayName: "おためし参加者 7A9C", accountKind: "trial" },
      expiresAt: "2026-08-13T00:00:00.000Z",
    }, {
      "Set-Cookie": [
        "__Host-gaia_sensor_session=qa; Path=/; HttpOnly; Secure; SameSite=Lax",
        "__Host-gaia_sensor_csrf=qa; Path=/; Secure; SameSite=Strict",
      ],
    });
  }
  if ((url.pathname === "/api/web/v1/logout" && request.method === "POST") || (url.pathname === "/api/web/v1/account" && request.method === "DELETE")) {
    const accountDeleted = sessionKind === "trial" || request.method === "DELETE";
    sessionKind = null;
    pairingIssued = false;
    deviceCreated = false;
    return sendJson(response, 200, { ok: true, accountDeleted }, {
      "Set-Cookie": [
        "__Host-gaia_sensor_session=; Path=/; HttpOnly; Secure; Max-Age=0",
        "__Host-gaia_sensor_csrf=; Path=/; Secure; Max-Age=0",
      ],
    });
  }
  if (url.pathname === "/api/web/v1/countries") {
    return sendJson(response, 200, { countries: [{ code: "JP", nameEn: "Japan", nameLocal: "日本" }, { code: "US", nameEn: "United States", nameLocal: "アメリカ合衆国" }] });
  }
  if (url.pathname === "/api/web/v1/regions" && request.method === "GET") {
    const countryCode = url.searchParams.get("countryCode");
    const subdivisionCode = url.searchParams.get("subdivisionCode");
    const subdivisions = countryCode === "JP"
      ? [{ code: "JP-13", name: "東京都" }, { code: "JP-14", name: "神奈川県" }, { code: "JP-47", name: "沖縄県" }]
      : countryCode === "US" ? [{ code: "US-CA", name: "California" }] : [];
    const municipalities = subdivisionCode === "JP-13"
      ? [{ code: "131130", name: "渋谷区" }]
      : subdivisionCode === "JP-14" ? [{ code: "142085", name: "逗子市" }] : [];
    return sendJson(response, 200, { version: "qa", subdivisions, municipalities });
  }
  if (url.pathname === "/api/web/v1/social" && request.method === "GET") {
    const accountKind = referer.includes("authenticated=1") ? "google" : sessionKind;
    if (!accountKind) return sendJson(response, 401, { error: { code: "AUTHENTICATION_REQUIRED", message: "Login is required." } });
    const sensorIds = new Set([...favoriteSensors, ...likedSensors]);
    return sendJson(response, 200, {
      sensors: [...sensorIds].map((sensorId) => ({
        sensorId,
        favorite: favoriteSensors.has(sensorId),
        liked: likedSensors.has(sensorId),
      })),
    });
  }
  const socialMatch = url.pathname.match(/^\/api\/web\/v1\/sensors\/(sensor_[a-z0-9_]+)\/(favorite|like)$/u);
  if (socialMatch && (request.method === "PUT" || request.method === "DELETE")) {
    const accountKind = referer.includes("authenticated=1") ? "google" : sessionKind;
    if (!accountKind) return sendJson(response, 401, { error: { code: "AUTHENTICATION_REQUIRED", message: "Login is required." } });
    const [, sensorId, relationship] = socialMatch;
    const target = relationship === "favorite" ? favoriteSensors : likedSensors;
    if (request.method === "PUT") target.add(sensorId);
    else target.delete(sensorId);
    return sendJson(response, 200, {
      social: {
        sensorId,
        favorite: favoriteSensors.has(sensorId),
        liked: likedSensors.has(sensorId),
        likeCount: likedSensors.has(sensorId) ? 1 : 0,
      },
    });
  }
  if (url.pathname === "/api/web/v1/region-location" && request.method === "GET") {
    const subdivisionCode = url.searchParams.get("subdivisionCode");
    const municipalityCode = url.searchParams.get("municipalityCode");
    const locations = {
      "131130": { latitude: 35.7, longitude: 139.7 },
      "142085": { latitude: 35.3, longitude: 139.6 },
    };
    const prefecturalLocations = {
      "JP-13": { latitude: 35.68944, longitude: 139.69167 },
      "JP-14": { latitude: 35.44778, longitude: 139.6425 },
      "JP-47": { latitude: 26.2124, longitude: 127.6809 },
    };
    const location = municipalityCode ? locations[municipalityCode] : prefecturalLocations[subdivisionCode];
    if (!location) return sendJson(response, 404, { error: { code: "REGION_LOCATION_UNAVAILABLE", message: "Region location is unavailable." } });
    return sendJson(response, 200, { location: { ...location, precision: municipalityCode ? "MUNICIPAL_MAIN_OFFICE" : "PREFECTURAL_GOVERNMENT_OFFICE" } });
  }
  if (url.pathname === "/api/web/v1/profile" && request.method === "GET") return sendJson(response, 200, { profile });
  if (url.pathname === "/api/web/v1/profile" && request.method === "PATCH") {
    const body = await readJson(request);
    profile = { ...profile, ...body };
    return sendJson(response, 200, { profile });
  }
  if (url.pathname === "/api/web/v1/profile/avatar" && request.method === "PUT") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    avatarUploaded = Buffer.concat(chunks).length > 0;
    profile = { ...profile, avatarUrl: `/api/public/v1/profiles/usr_browserqa/avatar?v=${Date.now()}` };
    return sendJson(response, 200, { profile });
  }
  if (url.pathname === "/api/web/v1/profile/avatar" && request.method === "DELETE") {
    avatarUploaded = false;
    profile = { ...profile, avatarUrl: null };
    response.writeHead(204);
    return response.end();
  }
  if (url.pathname === "/api/web/v1/devices/pairing" && request.method === "POST") {
    lastPairingDraft = await readJson(request);
    pairingIssued = true;
    return sendJson(response, 201, { pairingCode: "H7K2-PQ9M", expiresAt: new Date(Date.now() + 600000).toISOString() });
  }
  if (url.pathname === "/api/web/v1/devices" && request.method === "GET") {
    if (pairingIssued && !deviceCreated) deviceCreated = true;
    return sendJson(response, 200, { devices: deviceCreated ? [device] : [] });
  }
  const match = url.pathname.match(/^\/api\/web\/v1\/devices\/([^/]+)(\/latest|\/telemetry)?$/u);
  if (!match || match[1] !== device.deviceId) return sendJson(response, 404, { error: { code: "DEVICE_NOT_FOUND", message: "Device was not found." } });
  if (match[2] === "/latest") {
    latestPolls += 1;
    device = { ...device, state: "ONLINE", lastSeenAt: new Date().toISOString() };
    return sendJson(response, 200, { device, latest: telemetry(4) });
  }
  if (match[2] === "/telemetry") return sendJson(response, 200, { telemetry: [telemetry(4), telemetry(3), telemetry(2)] });
  if (request.method === "PATCH") {
    const body = await readJson(request);
    lastDeviceDraft = body;
    const subdivisionNames = { "JP-13": "東京都", "JP-14": "神奈川県", "JP-47": "沖縄県", "US-CA": "California" };
    const municipalityNames = { "131130": "渋谷区", "142085": "逗子市" };
    device = {
      ...device,
      ...body,
      countryName: body.countryCode === "JP" ? "日本" : "アメリカ合衆国",
      subdivisionName: subdivisionNames[body.subdivisionCode] || null,
      municipalityName: municipalityNames[body.municipalityCode] || null,
      admin1Code: body.subdivisionCode || body.admin1Code,
      localityName: municipalityNames[body.municipalityCode] || body.localityName,
    };
    return sendJson(response, 200, { device });
  }
  if (request.method === "DELETE") {
    deviceCreated = false;
    pairingIssued = false;
    response.writeHead(204);
    return response.end();
  }
  return sendJson(response, 405, { error: { code: "METHOD", message: "Method not allowed." } });
}

function telemetry(seq) {
  return { seq, observedAt: new Date(Date.now() - (4 - seq) * 10000).toISOString(), receivedAt: new Date().toISOString(), data: { temperature: 24 + seq / 10, humidity: 58.2, pm25: 9.1, water_temperature: 18.4, ph: 7.18, turbidity: 2.7 } };
}
function qaMeasurementCatalog() {
  const categories = [
    { id: "atmosphere", labelJa: "大気・空気質", labelEn: "AIR", descriptionJa: "気温、湿度、粒子、ガス、気圧を観測します。" },
    { id: "water", labelJa: "水・水質", labelEn: "WATER", descriptionJa: "水温、pH、濁度、溶存酸素、水位、流量などを観測します。" },
    { id: "soil", labelJa: "土壌・植物", labelEn: "SOIL / PLANT", descriptionJa: "土の温湿度、EC、pHを観測します。" },
  ];
  const entry = (key, category, labelJa, labelEn, unit, digits, interfaces, exampleSensors) => ({ key, category, labelJa, labelEn, unit, digits, minimum: -1000000, maximum: 1000000, interfaces, exampleSensors });
  return {
    version: 1,
    maximumMeasurementsPerPacket: 16,
    categories,
    measurements: [
      entry("temperature", "atmosphere", "気温", "Air temperature", "°C", 1, ["I2C"], ["BME280"]),
      entry("humidity", "atmosphere", "相対湿度", "Relative humidity", "%RH", 1, ["I2C"], ["SHT31"]),
      entry("pm25", "atmosphere", "PM2.5", "PM2.5", "µg/m³", 1, ["UART"], ["PMS5003"]),
      entry("water_temperature", "water", "水温", "Water temperature", "°C", 1, ["1-Wire"], ["防水DS18B20"]),
      entry("ph", "water", "pH", "pH", "pH", 2, ["ADC"], ["pH電極＋インターフェース"]),
      entry("turbidity", "water", "濁度", "Turbidity", "NTU", 1, ["ADC"], ["光学式濁度センサー"]),
      entry("soil_moisture", "soil", "土壌含水率", "Soil moisture", "%", 1, ["ADC"], ["静電容量式土壌水分センサー"]),
    ],
    disclaimerJa: "QA用マスターです。実機では電圧・防水・校正・絶縁を確認してください。",
  };
}
function qaPublicSensorPayload() {
  const observations = Array.from({ length: 12 }, (_, index) => ({ data: {
    temperature: Number((24.7 + Math.sin(index * .72) * 1.2).toFixed(1)),
    humidity: Number((57.8 + Math.cos(index * .58) * 4.1).toFixed(1)),
    pm25: Number((8.4 + Math.sin(index * .41 + .7) * 1.7).toFixed(1)),
  } }));
  const demo = (id, sensorName, displayName, avatarUrl, latitude, longitude, countryCode, subdivisionCode, subdivisionName, demoLocationLabel) => ({
    id, sensorName, state: "OFFLINE", isDemo: true, demoLocationLabel, likeCount: likedSensors.has(id) ? 1 : 0,
    location: { latitude, longitude, precision: "PUBLIC_REFERENCE_POINT" },
    region: { countryCode, subdivisionCode, subdivisionName },
    observations: [], observationCount: 0, observationSpanSeconds: 0,
    owner: { displayName, avatarUrl, xUrl: null, githubUrl: null, instagramUrl: null },
  });
  return {
    generatedAt: new Date().toISOString(),
    stats: { observationPackets: 245, payloadBytes: 17_860 },
    sensors: [{
      id: "sensor_browserqa", sensorName: "ベランダ環境センサー", state: "ONLINE", isDemo: false, demoLocationLabel: null, likeCount: likedSensors.has("sensor_browserqa") ? 1 : 0,
      location: { latitude: device.publicLatitude, longitude: device.publicLongitude, precision: "PUBLIC_REFERENCE_POINT" },
      region: { countryCode: device.countryCode, subdivisionCode: device.subdivisionCode, subdivisionName: device.subdivisionName, municipalityCode: device.municipalityCode, municipalityName: device.municipalityName },
      observations, observationCount: 245, observationSpanSeconds: 72_000,
      measurementKeys: device.measurementKeys,
      owner: { displayName: profile.displayName, avatarUrl: profile.avatarUrl, xUrl: profile.xUrl, githubUrl: profile.githubUrl, instagramUrl: profile.instagramUrl },
    },
    demo("sensor_demo_bluecat", "青猫センサー", "青猫", "/assets/visuals-07/slack-symbol-blue-apple-v1.svg", 35.7, 139.8, "JP", "JP-13", "東京都", "秋葉原"),
    demo("sensor_demo_mizu", "みずセンサー", "みず", "/assets/visuals-07/slack-avatar-mizuha-v2.webp", 43, 140.8, "JP", "JP-01", "北海道", "余市町"),
    demo("sensor_demo_saku", "sakuセンサー", "saku", "/assets/visuals-07/slack-avatar-sakuya-flower-v3.webp", 22.5, 114.1, "CN", "CN-GD", "広東省", "深セン"),
    demo("sensor_demo_ame", "あめセンサー", "あめ", "/assets/visuals-07/slack-avatar-amane-v2.webp", 34.9, 135.7, "JP", "JP-27", "大阪府", "島本町"),
    ],
  };
}
function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}
async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".yaml": "text/yaml; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".sh": "text/plain; charset=utf-8" })[extension] || "application/octet-stream";
}
