import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/current-land-foreground");
const widths = (process.argv[4] || "1440,3840,390").split(",").map(Number);
const report = { status: "running", checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width < 720 ? 844 : 900 }, hasTouch: width < 720 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.projectLandProbe = (lon, lat) => {
        const canvas = document.querySelector("#japan-overlay"), r = canvas.getBoundingClientRect();
        const scale = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * Number(canvas.dataset.earthZoom);
        return { x: (r.width - 360 * scale) / 2 + Number(canvas.dataset.earthOffsetX) + ((lon - Number(canvas.dataset.earthCenterLongitude) + 540) % 360) * scale,
          y: (r.height - 180 * scale) / 2 + Number(canvas.dataset.earthOffsetY) + (90 - lat) * scale };
      };
      window.readLandProbe = () => {
        const c = document.querySelector("#japan-overlay"), r = c.getBoundingClientRect(), style = getComputedStyle(c);
        const sample = (lon, lat) => {
          const { x, y } = projectLandProbe(lon, lat);
          if (x < 0 || y < 0 || x >= r.width || y >= r.height) return null;
          return [...c.getContext("2d").getImageData(Math.floor(x * c.width / r.width), Math.floor(y * c.height / r.height), 1, 1).data];
        };
        return { surface: c.dataset.referenceLandSurface, palette: c.dataset.referenceWorldPalette,
          land: [[137.75,36.15], [143,43.4], [130.8,32.6]].map(([lon, lat]) => sample(lon, lat)).filter(Boolean),
          sea: sample(144.1,32.4), overlayZ: Number(style.zIndex), opacity: style.opacity, blend: style.mixBlendMode,
          overlayPointerEvents: style.pointerEvents, currentZ: Number(getComputedStyle(document.querySelector("#gaia-canvas")).zIndex),
          markerCount: Number(c.dataset.currentPoiMarkerCount), zoom: Number(c.dataset.earthZoom) };
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=current-land-foreground#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }); });
    const select = async n => {
      await page.evaluate(n => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(b => b.textContent.trim() === String(n).padStart(2,"0")).click(), n);
      await page.waitForFunction(n => document.querySelector("#japan-mode-number").textContent === String(n).padStart(2,"0"), n);
      await page.waitForTimeout(1600);
    };
    await select(2);
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: 138, lat: 36, zoom: innerWidth < 720 ? 4.25 : 4.45, durationMs: 100 }));
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.referenceLandSurface === "opaque-current-land" && Number(document.querySelector("#japan-overlay").dataset.currentPoiMarkerCount) > 0);
    await page.waitForTimeout(1000);
    const checkLand = evidence => {
      assert.equal(evidence.surface, "opaque-current-land");
      assert(evidence.land.length >= 2, "Test multiple Japanese islands");
      for (const pixel of evidence.land) assert.equal(pixel[3], 255, "Land must fully hide the underlying current field");
      if (evidence.sea) assert(evidence.sea[3] < 220, "Keep the sea transparent to the current field");
      assert(evidence.overlayZ > evidence.currentZ);
      assert.equal(evidence.opacity, "1"); assert.equal(evidence.blend, "normal");
      assert.equal(evidence.overlayPointerEvents, "none");
      assert(evidence.markerCount > 0);
    };
    const first = await page.evaluate(() => readLandProbe()); checkLand(first);
    await page.screenshot({ path: path.join(output, `${width}-02.jpg`), type: "jpeg", quality: 88 });
    const candidates = await page.evaluate(async () => {
      const rows = (await GaiaMapObservationAdapter.waitSignalsReady()).modes.find(m => m.id === "blue-circulation").signals.currents;
      return rows.map(row => projectLandProbe(row.lon, row.lat)).filter(p => p.x > innerWidth * .3 && p.x < innerWidth * .8 && p.y > innerHeight * .3 && p.y < innerHeight * .6).slice(0, 12);
    });
    let poiOpened = false;
    for (const p of candidates) {
      if (width < 720) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(120);
      if (await page.locator("#japan-poi-card").isVisible()) { poiOpened = true; break; }
    }
    assert(poiOpened, "Current POIs remain clickable above the map");
    await page.evaluate(() => GaiaMapObservationAdapter.closePoi());
    await page.locator("#gaia-map-zoom-in").click();
    await page.waitForTimeout(800);
    const zoomed = await page.evaluate(() => readLandProbe()); checkLand(zoomed);
    assert(zoomed.zoom > first.zoom);
    await page.mouse.move(width * .5, width < 720 ? 420 : 400);
    await page.mouse.down(); await page.mouse.move(width * .5 + 35, width < 720 ? 440 : 420, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(300);
    checkLand(await page.evaluate(() => readLandProbe()));
    await select(1);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-reference-land-surface"), "translucent");
    await select(17);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-reference-world-palette"), "warm-sage");
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-reference-land-surface"), "translucent");
    await select(2);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-reference-land-surface"), "opaque-current-land");
    report.checks.push({ width, first, zoomed, poiOpened, cacheRoundTrip: true });
    console.log(`PASS ${width}px: opaque Japan above currents, sea visible, POI picking, zoom/pan, map-switch cache`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
