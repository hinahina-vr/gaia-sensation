import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/poi-japanese");
fs.mkdirSync(output, { recursive: true });
const points = [
  { lat: 12.34, lon: 130.12 }, { lat: -12.34, lon: 130.12 },
  { lat: 12.34, lon: -160.12 }, { lat: -12.34, lon: -160.12 },
].map(point => ({ ...point, label: `${Math.abs(point.lat).toFixed(1)}°${point.lat >= 0 ? "N" : "S"} ${Math.abs(point.lon).toFixed(1)}°${point.lon >= 0 ? "E" : "W"}`,
  windSpeed: 7.2, windDirection: 124, pressure: 1014, cloud: 36, radiation: 512, pm25: 13.4, aerosol: .27 }));
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(points => {
    sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
    for (const loader of ["atmosphere", "air"]) sessionStorage.setItem(`gaia-planet-signals-v3:${loader}`, JSON.stringify({
      cachedAt: Date.now(), data: { observedAt: "2026-09-05T05:30:00Z", points },
    }));
  }, points);
  await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
  await context.route("https://*open-meteo.com/**", route => route.abort());
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(`${base}/?preview=poi-language#world`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !!globalThis.GaiaPlanetSignals);
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  for (const id of ["global-wind-pressure", "global-aerosol-light", "global-cloud-radiance"]) {
    await page.locator(`.map-mode-button[data-planet-exhibit='${id}']`).evaluate(el => el.click());
    await page.waitForFunction(() => document.querySelector("#gaia-planet-signals-canvas").dataset.planetSourceState === "LIVE CACHE"
      && document.querySelector(".gaia-planet-signals-readout").dataset.loading !== "true");
    await page.waitForTimeout(250);
    for (const point of points) {
      const record = await page.evaluate(point => {
        const rect = document.querySelector("#japan-map").getBoundingClientRect();
        const data = document.querySelector("#japan-overlay").dataset;
        const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * (+data.earthZoom || 1);
        const x = rect.left + (rect.width - 360 * scale) / 2 + (+data.earthOffsetX || 0) + ((point.lon - Number(data.earthCenterLongitude) + 540) % 360) * scale;
        const y = rect.top + (rect.height - 180 * scale) / 2 + (+data.earthOffsetY || 0) + (90 - point.lat) * scale;
        return globalThis.GaiaPlanetSignals.findPoiAt(x, y, "mouse")?.record;
      }, point);
      assert(record, `Cached point must be selectable: ${JSON.stringify(point)}`);
      const latitude = point.lat >= 0 ? "北緯" : "南緯";
      const longitude = point.lon >= 0 ? "東経" : "西経";
      assert.equal(record.title, `${latitude}${Math.abs(point.lat).toFixed(1)}° ${longitude}${Math.abs(point.lon).toFixed(1)}°`);
      assert.equal(record.cardDetails.coordinates, `${latitude}${Math.abs(point.lat).toFixed(2)}° / ${longitude}${Math.abs(point.lon).toFixed(2)}°`);
      assert.equal(record.lat, point.lat);
      assert.equal(record.lon, point.lon);
      assert.doesNotMatch(record.meta, /°\s*[NSEW]\b|\bAOD\b/u);
      if (id === "global-aerosol-light") assert.match(record.preview, /PM2.5 13.4 µg\/m³ \/ 光学的厚さ 0.27/u);
      report.checks.push({ id, lat: record.lat, lon: record.lon, title: record.title, preview: record.preview, coordinates: record.cardDetails.coordinates });
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log("PASS: 12 cached POIs across 3 exhibits / 4 hemispheres; numeric coordinates preserved");
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "cache-language-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
