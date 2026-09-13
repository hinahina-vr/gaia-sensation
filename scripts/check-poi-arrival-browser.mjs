import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createPoiArrival, POI_ARRIVAL_LIFETIME_MS } from "../src/exploration/poi-arrival.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const widths = (process.argv[3] || "1440,3840,390").split(",").map(Number);
const output = path.resolve(process.argv[4] || `artifacts/planet-arrival/${widths.join("-")}`);
const reduced = process.argv.includes("--reduced");
const fallback = process.argv.includes("--fallback");
const kinds = process.argv.find(arg => arg.startsWith("--kinds="))?.slice(8).split(",");
fs.mkdirSync(output, { recursive: true });
const grid = Array.from({ length: 240 }, (_, index) => ({
  lat: Math.asin(-1 + 2 * (index + .5) / 240) * 180 / Math.PI,
  lon: ((index * 137.50776405003785 + 180) % 360) - 180,
}));
const copy = JSON.stringify(grid);
const birth = createPoiArrival(grid, 100);
assert.equal(JSON.stringify(grid), copy);
assert.equal(birth.phase(100), "waiting");
assert.equal(birth.opacity(birth.order[0], 999), 0);
assert.equal(birth.opacity(birth.order[0], 1220), 1);
assert.equal(new Set(birth.bornAt).size, grid.length);
assert(birth.settlesAt <= 100 + 900 + 5400 + POI_ARRIVAL_LIFETIME_MS);
assert.equal(birth.phase(birth.settlesAt), "settled");
assert.equal(createPoiArrival(grid, 100, true).opacity(239, 100), 1);
const quakePoints = grid.slice(60, 180);
const stamp = Date.now();
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width === 390 ? 844 : 900 },
      hasTouch: width < 720, reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.addInitScript(fallback => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      if (fallback) {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          return this.id === "gaia-planet-atmosphere-canvas" && type === "webgl2" ? null : getContext.call(this, type, ...args);
        };
      }
    }, fallback);
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const weather = route => route.fulfill({ json: new URL(route.request().url()).searchParams.get("latitude").split(",").map(() => ({
      current: { time: "2026-09-05T05:30", wind_speed_10m: 7.2, wind_direction_10m: 124,
        surface_pressure: 1014, cloud_cover: 50, shortwave_radiation: 512, pm2_5: 13.4, aerosol_optical_depth: .27 },
    })) });
    await context.route("https://api.open-meteo.com/**", weather);
    await context.route("https://air-quality-api.open-meteo.com/**", weather);
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      metadata: { generated: stamp }, features: quakePoints.map((p, index) => ({ id: `arrival-quake-${index}`,
        geometry: { coordinates: [p.lon, p.lat, 12] }, properties: { time: stamp - (120 - index) * 60000, mag: 5.3, place: `TEST REGION ${index}` } })),
    } }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=planet-arrival#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !!globalThis.GaiaPlanetSignals);
    await page.waitForTimeout(1000);
    for (const [index, kind] of ["wind", "air", "quake", "cloud"].entries()) {
      if (kinds && !kinds.includes(kind)) continue;
      const points = kind === "quake" ? quakePoints : grid;
      await page.evaluate(index => {
        globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
        document.querySelectorAll("[data-planet-exhibit].map-mode-button")[index].click();
      }, index);
      await page.waitForFunction(() => document.querySelector(".gaia-planet-signals-readout").dataset.loading !== "true");
      if (width < 720) await page.evaluate(() => globalThis.GaiaMapObservationAdapter.focusEarthLocation({ lon: 138, lat: 0, zoom: 1, durationMs: 0 }));
      const canvas = page.locator("#gaia-planet-signals-canvas");
      if (await canvas.getAttribute("data-planet-arrival-phase") === "waiting") {
        assert.equal(await page.evaluate(() => globalThis.GaiaPlanetSignals.findPoiAt(innerWidth / 2, innerHeight / 2, "touch")), null);
      }
      const candidate = await page.waitForFunction(({ points, reduced }) => {
        const canvas = document.querySelector("#gaia-planet-signals-canvas");
        const r = document.querySelector("#japan-map").getBoundingClientRect();
        const d = document.querySelector("#japan-overlay").dataset;
        const scale = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * (Number(d.earthZoom) || 1);
        const indices = reduced ? points.map((_, i) => i) : (canvas.dataset.planetArrivalIndices || "").split(",").filter(Boolean).map(Number);
        for (const index of indices) {
          const p = points[index];
          const x = r.left + (r.width - 360 * scale) / 2 + +d.earthOffsetX + ((p.lon - Number(d.earthCenterLongitude) + 540) % 360) * scale;
          const y = r.top + (r.height - 180 * scale) / 2 + +d.earthOffsetY + (90 - p.lat) * scale;
          const el = document.elementFromPoint(x, y);
          if (!(el?.tagName === "CANVAS" || el?.id === "japan-map") || y < 150 || y > innerHeight - 220) continue;
          if (globalThis.GaiaPlanetSignals.findPoiAt(x, y, "touch")?.index === index) return { index, x, y };
        }
        return false;
      }, { points, reduced }, { timeout: 12000 });
      const p = await candidate.jsonValue();
      await page.waitForTimeout(300);
      const active = await canvas.evaluate(el => ({ ...el.dataset, pixels: el.width * el.height, events: getComputedStyle(el).pointerEvents }));
      assert.equal(active.planetArrivalEffect, kind);
      assert.equal(active.planetArrivalStyle, kind === "quake" ? "seismic-ripples" : "scattered-light-bloom");
      assert.equal(active.planetArrivalPhase, reduced ? "reduced" : "entering");
      if (reduced) assert.equal(active.planetArrivalActive, "0");
      else assert(Number(active.planetArrivalActive) > 0 && Number(active.planetArrivalActive) <= Number(active.planetArrivalLimit));
      if (fallback) assert.equal(active.planetEngine, "canvas2d-particle-field");
      assert(active.pixels <= 1503000 && active.events === "none");
      await page.screenshot({ path: path.join(output, `${width}-${27 + index}-entry.png`) });
      if (width < 720) await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
      await page.locator("#japan-poi-card").waitFor({ state: "visible" });
      const meta = await page.locator("#japan-poi-meta").textContent();
      assert.match(meta, [/7\.2 m\/s/, /13\.4 µg\/m³/, /M5\.3/, /512 W\/m²/][index]);
      assert.match(meta, /JST/);
      await page.locator("#japan-poi-close").click();
      await page.waitForFunction(reduced => document.querySelector("#gaia-planet-signals-canvas").dataset.planetArrivalPhase === (reduced ? "reduced" : "settled"), reduced, { timeout: 10000 });
      assert.equal(await canvas.getAttribute("data-planet-arrival-active"), "0");
      assert.equal(Number(await canvas.getAttribute("data-planet-arrival-visible")), points.length);
      await page.screenshot({ path: path.join(output, `${width}-${27 + index}-settled.png`) });
      await page.evaluate(() => globalThis.GaiaMapObservationAdapter.zoomEarthBy(1.05));
      await page.waitForTimeout(180);
      assert.equal(await canvas.getAttribute("data-planet-arrival-active"), "0", "Pan/zoom must not replay settled arrivals");
      report.checks.push({ width, kind, reduced, fallback, active, meta });
      console.log(`PASS ${width} ${kind}: one-shot entrance, point picking, settle and zoom`);
    }
    await page.locator("#japan-mode-list .map-mode-button").first().evaluate(el => el.click());
    const canvas = page.locator("#gaia-planet-signals-canvas");
    const frame = await canvas.getAttribute("data-planet-frame");
    await page.waitForTimeout(150);
    assert.equal(await canvas.getAttribute("data-planet-frame"), frame);
    assert.equal(await canvas.getAttribute("data-planet-arrival-phase"), "idle");
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
