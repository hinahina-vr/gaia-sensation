import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { OBSERVATION_CITIES } from "../src/exploration/observation-cities.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-observation-ui");
const widths = process.argv[4]?.split(",").map(Number) || [1440, 3840, 1100, 768, 390, 320];
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const metrics = [
  [10, "weatherWindSpeed", 4.8, "m/s", 0, 15], [11, "forecastCo2", 423.1, "ppm", 280, 650],
  [12, "weatherPrecipitation", 0, "mm", 0, 30], [13, "weatherTemperature", -5, "℃", -20, 45],
  [14, "cloudCover", 40, "%", 0, 100], [15, "pm25", 11.2, "µg/m³", 0, 150],
];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const geometry = node => {
  const r = node.getBoundingClientRect();
  return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};
try {
  for (const width of widths) {
    const height = width >= 2400 ? 2160 : width <= 900 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width <= 900 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
    });
    await context.route("**/api/live/v1/snapshot?*", route => {
      const id = new URL(route.request().url()).searchParams.get("city");
      const city = OBSERVATION_CITIES.find(city => city.id === id) || OBSERVATION_CITIES[0];
      return route.fulfill({ json: { events: id === "naha" ? [] : [{
        eventId: `qa-${city.id}`, provider: "open-meteo", datasetId: "QA model values", status: "latest-published",
        observedAt: "2026-09-06T04:45:00Z", retrievedAt: "2026-09-06T04:46:00Z",
        location: { label: `Open-Meteo / ${city.prefecture}・${city.city}`, lat: city.lat, lon: city.lon },
        measurements: metrics.map(([, key, value, unit]) => ({ key, value, unit, sourceKind: "MODEL", quality: "estimated" })),
      }] } });
    });
    await context.route("**/api/live/v1/wind-field", route => route.fulfill({ json: { points: [] } }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?live=1&preview=live-observation-ui#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    const select = async number => {
      await page.evaluate(number => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => button.textContent.trim() === String(number).padStart(2, "0")).click(), number);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    };
    const legendStyle = selector => page.locator(selector).evaluate(node => {
      const s = getComputedStyle(node);
      return { height: s.height, borderRadius: s.borderRadius, background: s.backgroundImage,
        trackHeight: getComputedStyle(node.querySelector(".gaia-metric-legend-track")).height };
    });
    await select(16);
    const reference = await legendStyle(".gaia-estat-heat-legend");
    assert.equal(await page.locator(".gaia-estat-place > p").textContent(), "都道府県");
    await select(10);
    await page.waitForFunction(() => GaiaLiveData.getState().requestState === "ready");
    assert.equal(await page.locator(".gaia-live-city-picker").count(), 0, "Retired upper-left picker remains");
    assert.equal(await page.locator(".gaia-live-prefecture-picker select").count(), 0);
    await page.locator(".gaia-live-place-selector").click();
    assert.equal(await page.locator("#gaia-observation-place-picker [data-place-city]").count(), 47);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("[data-live-poi-step]").count(), 2, "Duplicate city arrows remain");
    assert.equal(await page.locator(".gaia-live-prefecture-picker > p").textContent(), "都道府県");
    const picker = page.locator(".gaia-live-place-selector");
    await picker.click();
    await page.locator('[data-place-city="osaka"]').click();
    await page.waitForFunction(() => GaiaLiveData.getState().city === "osaka" && GaiaLiveData.getState().requestState === "ready");
    for (const [number, key, value, unit, minimum, maximum] of metrics) {
      await select(number);
      assert.equal(await page.locator("[data-live-deck-location]").textContent(), "大阪府（大阪市）");
      assert.equal(await page.locator("[data-live-city-caption]").count(), 0);
      assert.deepEqual(await legendStyle(".gaia-live-metric-legend"), reference, `${width}/${number}: inconsistent instrument style`);
      const scan = await page.locator(".gaia-live-metric-legend").evaluate(node => ({
        value: Number(node.dataset.metricValue), minimum: Number(node.dataset.metricMinimum), maximum: Number(node.dataset.metricMaximum),
        progress: Number(node.dataset.metricProgress), scope: node.querySelector("[data-metric-scope]").textContent,
        current: node.querySelector("[data-metric-current]").textContent, period: node.querySelector("[data-metric-period]").textContent,
        markerHidden: node.querySelector("[data-metric-marker]").hidden,
      }));
      assert.equal(scan.value, value); assert.equal(scan.minimum, minimum); assert.equal(scan.maximum, maximum);
      assert(Math.abs(scan.progress - (value - minimum) / (maximum - minimum)) < .00001);
      assert.equal(scan.markerHidden, false); assert.equal(scan.scope, "大阪府（大阪市）");
      assert.equal(scan.period, "13:45 JST"); assert.equal(scan.current, `${value} ${unit}`);
      assert.equal(await page.locator(".japan-credits .gaia-live-data-credit").count(), 1);
      assert.equal(await page.locator(".gaia-live-prefecture-picker .gaia-live-data-credit").count(), 0);
      assert.equal(await page.locator("[data-live-cams-credit]").isVisible(), [11, 15].includes(number));
      const boxes = await page.evaluate(() => {
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const picker = document.querySelector(".gaia-live-prefecture-picker");
        const control = picker.querySelector(".gaia-live-place-selector");
        const cr = control.getBoundingClientRect();
        const credit = document.querySelector(".gaia-live-weather-credit");
        const names = [picker.querySelector("strong"), picker.querySelector("small")].map(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          const glyphs = range.getBoundingClientRect(), box = node.getBoundingClientRect();
          return { fits: glyphs.right <= box.right + 1, text: node.textContent };
        });
        return { picker: rect(picker), legend: rect(document.querySelector(".gaia-live-metric-legend")),
          credit: rect(credit), dock: rect(document.querySelector(".gaia-live-exhibit-readout")),
          pickerHit: control.contains(document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2)),
          hitElement: document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2)?.outerHTML.slice(0, 240),
          controlBox: rect(control), controlPointer: getComputedStyle(control).pointerEvents,
          creditFits: credit.scrollWidth <= credit.clientWidth + 1, names };
      });
      report.checks.push({ width, number, key, scan, boxes });
      assert(boxes.pickerHit, `${width}/${number}: bottom selector cannot be used: ${JSON.stringify(boxes)}`);
      for (const [label, box] of Object.entries(boxes).filter(([, box]) => box && typeof box.x === "number")) {
        assert(box.x >= -1 && box.y >= -1 && box.right <= width + 1 && box.bottom <= height + 1, `${width}/${number}/${label}: ${JSON.stringify(box)}`);
      }
      assert(boxes.credit.bottom <= boxes.dock.y - 1, "Credits must sit above the lower dock");
      assert(boxes.picker.y >= boxes.dock.y && boxes.picker.bottom <= boxes.dock.bottom, "Selector escaped the lower UI");
      assert(boxes.creditFits && boxes.names.every(name => name.fits), `${width}/${number}: truncated place or source text`);
      if ([10, 15].includes(number)) await page.screenshot({ path: path.join(output, `${width}-${number}.jpg`), type: "jpeg", quality: 88 });
    }
    await picker.focus();
    assert.equal(await picker.evaluate(node => getComputedStyle(node).outlineStyle), "solid");
    await picker.click();
    await page.locator('[data-place-city="naha"]').click();
    await page.waitForFunction(() => GaiaLiveData.getState().city === "naha" && GaiaLiveData.getState().requestState === "unavailable");
    assert.equal(await page.locator(".gaia-live-metric-legend [data-metric-current]").textContent(), "未取得");
    assert.equal(await page.locator(".gaia-live-metric-legend [data-metric-marker]").getAttribute("hidden"), "");
    assert(await page.locator(".gaia-live-data-credit").isVisible());
    await page.locator('[data-live-poi-step="1"]').click();
    await page.waitForFunction(() => GaiaLiveData.getState().city === "sapporo" && GaiaLiveData.getState().requestState === "ready");
    assert.equal(await picker.getAttribute("data-city"), "sapporo");
    await page.locator('[data-live-poi-step="-1"]').click();
    await page.waitForFunction(() => GaiaLiveData.getState().city === "naha");
    assert.equal(await picker.getAttribute("data-city"), "naha");
    await select(16);
    assert.equal(await page.locator(".gaia-live-weather-credit").isVisible(), false);
    assert.equal(await page.locator(".gaia-live-metric-legend").isVisible(), false);
    assert.equal(await page.locator(".gaia-live-prefecture-picker").isVisible(), false);
    assert(await page.locator(".gaia-estat-heat-legend").isVisible());
    await page.screenshot({ path: path.join(output, `${width}-16.jpg`), type: "jpeg", quality: 88 });
    console.log(`PASS ${width}: six shared instruments, bottom prefecture picker, edge credits, zero/negative/missing values, wraparound and clean exit`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 88 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
