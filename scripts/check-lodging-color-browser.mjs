import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { metricLegendProgress } from "../src/exploration/metric-legend.js";

// One transform for the map and needle, including zero and missing guards.
assert.equal(metricLegendProgress(0, 0, 100, "log"), 0);
assert.equal(metricLegendProgress(100, 0, 100, "log"), 1);
assert.equal(metricLegendProgress(9, 0, 99, "log"), .5);
assert.equal(metricLegendProgress(-1, 0, 99, "log"), null);
assert.equal(metricLegendProgress(null, 0, 99, "log"), null);
assert.equal(metricLegendProgress(5, 5, 5, "log"), null);
assert.equal(metricLegendProgress(-10, -20, 20), .25);
const data = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8"));
const all = Object.values(data.lodging).flat().filter(Number.isFinite);
const min = Math.min(...all), max = Math.max(...all);
const latestYear = data.periodsBySeries.lodging.at(-1);
const latest = data.lodging[latestYear].map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
const median = latest[23].value;
assert(metricLegendProgress(median, min, max, "log") > .35);
assert(metricLegendProgress(median, min, max) < .06);
const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/lodging-color");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { checks: [], errors: [], median: { value: median, previousProgress: metricLegendProgress(median, min, max), newProgress: metricLegendProgress(median, min, max, "log") } };
try {
  for (const width of [3840, 1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : 900 }, reducedMotion: "reduce", hasTouch: width < 900 });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=lodging-color#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaEstatExhibits && globalThis.GaiaMapDemo && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      await GaiaEstatExhibits.select(1); await document.fonts.ready;
    });
    const samples = [];
    for (const yearIndex of [0, data.periodsBySeries.lodging.length - 1]) {
      for (const prefecture of [31, latest[23].index, 12]) {
        await page.evaluate(({ yearIndex, prefecture }) => { GaiaEstatExhibits.setPeriod(yearIndex); GaiaEstatExhibits.selectPrefecture(prefecture); }, { yearIndex, prefecture });
        const value = data.lodging[data.periodsBySeries.lodging[yearIndex]][prefecture];
        const expected = metricLegendProgress(value, min, max, "log");
        await page.waitForFunction(expected => {
          const canvas = document.querySelector(".gaia-estat-canvas");
          return canvas && Math.abs(Number(canvas.dataset.estatHeatmapSelectedRatio) - expected) < .00001;
        }, expected);
        const reading = await page.locator(".gaia-estat-heat-legend").evaluate(node => ({
          ...node.dataset, text: node.textContent,
          gradient: getComputedStyle(node.querySelector(".gaia-metric-legend-track")).backgroundImage,
          color: document.querySelector(".gaia-estat-canvas").dataset.estatHeatmapSelectedColor,
          period: node.querySelector("[data-metric-period]").textContent,
          marker: parseFloat(node.querySelector("[data-metric-marker]").style.left) / 100,
          overflow: node.scrollWidth - node.clientWidth,
        }));
        assert.equal(Number(reading.metricValue), value);
        assert.equal(reading.metricScale, "log");
        assert.equal(Number(reading.metricMinimum), min); assert.equal(Number(reading.metricMaximum), max);
        assert(Math.abs(Number(reading.metricProgress) - expected) < 1e-9);
        assert(Math.abs(reading.marker - expected) < 1e-6, "CSS percentage serialization must preserve the marker within a fraction of a pixel");
        assert.match(reading.text, /色：対数目盛/);
        assert.match(reading.gradient, /76, 56, 153/); assert.match(reading.gradient, /39, 182, 184/); assert.match(reading.gradient, /255, 230, 136/);
        if (width > 900) assert(reading.overflow <= 1);
        samples.push({ year: reading.period, prefecture, value, progress: expected, color: reading.color });
      }
    }
    await page.evaluate(() => GaiaEstatExhibits.selectPrefecture(31));
    await page.waitForFunction(() => document.querySelector(".gaia-estat-heat-legend [data-metric-scope]").textContent.includes("島根"));
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    if (width > 900) {
      await page.locator(".gaia-estat-heat-legend").screenshot({ path: path.join(output, `${width}-legend.png`) });
      await page.screenshot({ path: path.join(output, `${width}-map.png`) });
    } else {
      await page.locator('[data-mobile-sheet="reading"]').click();
      const copy = page.locator("#map-mobile-sheet .gaia-estat-heat-legend");
      assert.equal(await copy.isVisible(), true); assert.match(await copy.textContent(), /対数目盛/);
      assert.equal(await page.locator("#map-mobile-sheet").evaluate(node => node.scrollWidth - node.clientWidth), 0);
      await page.locator("#map-mobile-sheet").screenshot({ path: path.join(output, `${width}-legend.png`) });
      await page.locator("[data-mobile-sheet-close]").click();
    }
    // Other exhibits keep their linear scale and period, with no lingering note.
    await page.evaluate(() => GaiaEstatExhibits.select(2));
    const actualLegend = page.locator(".gaia-estat-heat-legend:not(.map-mobile-reading-copy)");
    assert.equal(await actualLegend.getAttribute("data-metric-scale"), "linear");
    assert.equal(await actualLegend.locator("[data-metric-scale-note]").textContent(), "");
    assert.notEqual(await actualLegend.locator("[data-metric-period]").textContent(), "");
    report.checks.push({ width, samples, sharedAllYearBounds: true, housingUnchanged: true });
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(`Lodging colour scale passed at ${report.checks.length} widths; map and legend share the log scale, source counts unchanged.`);
