import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-poi-anchor");
const widths = (process.argv[4] || "1440,3840,390").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width < 721 ? 844 : 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=fixed-poi#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => {
      globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
      globalThis.GaiaMapDemo.stop();
      document.querySelector('[data-live-exhibit="carbon-pulse"]').click();
      globalThis.GaiaLiveExhibits.pausePoiAutoplay();
    });
    for (const city of ["sapporo", "wakayama", "naha"]) {
      await page.evaluate(city => {
        globalThis.GaiaLiveExhibits.selectObservationPoint(city);
        globalThis.GaiaLiveExhibits.pausePoiAutoplay();
      }, city);
      await page.waitForFunction(city => document.querySelector("#gaia-live-exhibit-canvas").dataset.observationCity === city
        && document.querySelector("#japan-layer").dataset.livePoiTransition === "settled", city);
      // Selection no longer moves the camera. Bring an off-screen/edge point
      // into view explicitly so this test can inspect its rendered CSS core.
      await page.evaluate(cityId => {
        if (!document.querySelector(".gaia-live-exhibit-anchor").hidden) return;
        const city = GaiaLiveExhibits.observationPoints.find(point => point.id === cityId);
        GaiaMapObservationAdapter.focusEarthLocation({ lon: city.lon, lat: city.lat,
          zoom: Number(document.querySelector("#japan-overlay").dataset.earthZoom), targetX: .5, targetY: .4 });
      }, city);
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
      await page.waitForTimeout(100);
      const samples = await page.evaluate(() => {
        const anchor = document.querySelector(".gaia-live-exhibit-anchor");
        const marker = document.querySelector('.gaia-live-city-marker[aria-current="true"]');
        const canvas = document.querySelector("#gaia-live-exhibit-canvas");
        const canvasRect = canvas.getBoundingClientRect();
        const center = element => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        };
        const origin = element => ({
          x: canvasRect.x + Number.parseFloat(element.style.left) / 100 * canvasRect.width,
          y: canvasRect.y + Number.parseFloat(element.style.top) / 100 * canvasRect.height,
        });
        const offset = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
        const result = [];
        for (const phase of ["steady", "arriving", "departing"]) {
          for (const element of [anchor, marker]) {
            element.classList.remove("is-arriving", "is-departing");
            if (phase !== "steady") element.classList.add(`is-${phase}`);
          }
          // Pause the actual CSS animations and sample their whole timeline deterministically.
          const animations = [anchor, marker].flatMap(element => element.getAnimations({ subtree: true }));
          animations.forEach(animation => animation.pause());
          for (const fraction of [0, .05, .18, .34, .58, .8, .999]) {
            animations.forEach(animation => {
              const duration = Number(animation.effect.getTiming().duration);
              if (Number.isFinite(duration)) animation.currentTime = duration * fraction;
            });
            const label = anchor.querySelector("span").getBoundingClientRect();
            const cityLabel = marker.querySelector("span").getBoundingClientRect();
            result.push({ phase, fraction,
              anchorOffset: offset(center(anchor.querySelector("i")), origin(anchor)),
              markerOffset: offset(center(marker.querySelector("i")), origin(marker)),
              labelOffset: label.width ? offset({ x: label.x, y: label.y }, origin(anchor)) : null,
              cityLabelOffset: offset({ x: cityLabel.x, y: cityLabel.y }, origin(marker)),
            });
          }
        }
        for (const element of [anchor, marker]) {
          element.classList.remove("is-arriving", "is-departing");
          element.getAnimations({ subtree: true }).forEach(animation => animation.play());
        }
        return result;
      });
      for (const sample of samples) {
        for (const key of ["anchorOffset", "markerOffset"]) {
          assert(Math.hypot(sample[key].x, sample[key].y) < .5, `${width}/${city}: ${key} left its geographic coordinate: ${JSON.stringify(sample)}`);
        }
        for (const key of ["labelOffset", "cityLabelOffset"]) {
          if (!sample[key]) continue;
          assert(Math.hypot(sample[key].x - samples[0][key].x, sample[key].y - samples[0][key].y) < .5,
            `${width}/${city}: ${key} moved during reveal: ${JSON.stringify(sample)}`);
        }
      }
      report.checks.push({ width, city, samples });
      if (city === "wakayama") await page.screenshot({ path: path.join(output, `${width}-wakayama.jpg`), type: "jpeg", quality: 90 });
    }
    // Pan/zoom still moves the POI with the underlying geographic projection.
    await page.locator("#gaia-map-zoom-in").evaluate(button => button.click());
    await page.waitForTimeout(350);
    const projectionError = await page.evaluate(() => {
      const canvas = document.querySelector("#gaia-live-exhibit-canvas");
      const rect = canvas.getBoundingClientRect();
      const core = document.querySelector(".gaia-live-exhibit-anchor > i").getBoundingClientRect();
      return Math.hypot(core.x + core.width / 2 - rect.x - Number(canvas.dataset.anchorNormalizedX) * rect.width,
        core.y + core.height / 2 - rect.y - Number(canvas.dataset.anchorNormalizedY) * rect.height);
    });
    assert(projectionError < .6, `Zoom detached POI from the map: ${projectionError}`);
    console.log(`PASS ${width}px: POI cores and labels stay anchored throughout entry/exit; zoom remains geographically aligned`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
