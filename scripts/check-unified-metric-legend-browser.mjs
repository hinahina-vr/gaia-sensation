import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { metricLegendProgress } from "../src/exploration/metric-legend.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/unified-metric-legend");
fs.mkdirSync(output, { recursive: true });
assert.equal(metricLegendProgress(0, 0, 100), 0);
assert.equal(metricLegendProgress(null, 0, 100), null);
assert.equal(metricLegendProgress(NaN, 0, 100), null);
assert.equal(metricLegendProgress(5, 5, 5), null);
assert.equal(metricLegendProgress(-10, -20, 20), .25);
const series = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8"));
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  const widths = process.argv[4] ? process.argv[4].split(",").map(Number) : [3840, 1440, 768, 390, 320];
  for (const width of widths) {
    const height = width === 3840 ? 2088 : width > 900 ? 900 : 844;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: width === 320 ? "reduce" : "no-preference" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    let failWeather = false;
    await context.route("https://api.open-meteo.com/**", route => {
      if (failWeather) return route.fulfill({ status: 503, body: "QA unavailable" });
      const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(Array.from({ length: count }, (_, index) => ({ current: {
        time: "2026-09-06T00:30", wind_speed_10m: index % 2 ? 8 : 0, wind_direction_10m: 90, surface_pressure: 1010,
        cloud_cover: index % 2 ? 80 : 0, shortwave_radiation: index % 2 ? 450 : 0,
      } }))) });
    });
    await context.route("https://air-quality-api.open-meteo.com/**", route => {
      const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(Array.from({ length: count }, (_, index) => ({ current: { time: "2026-09-06T00:30", pm2_5: index % 2 ? 30 : 0, aerosol_optical_depth: .2 } }))) });
    });
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({
      metadata: { generated: Date.parse("2026-09-06T00:30:00Z") },
      features: [2, 4, 6].map((magnitude, index) => ({ id: `qa-${index}`, geometry: { coordinates: [135 + index, 35, 10] }, properties: { mag: magnitude, place: `QA ${index}`, time: Date.parse("2026-09-06T00:00:00Z") + index * 1000 } })),
    }) }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=unified-metric-legend#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && Boolean(globalThis.GaiaPlanetSignals));
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    const select = number => page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).click(), number);
    const settled = () => page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const readCanvas = () => page.locator("#japan-overlay").evaluate(node => ({
      id: node.dataset.quantitativeLegendId, current: node.dataset.quantitativeLegendCurrent,
      progress: Number(node.dataset.quantitativeLegendProgress), title: node.dataset.quantitativeLegendTitle,
      left: Number(node.dataset.auxiliaryPanelScreenLeft), top: Number(node.dataset.auxiliaryPanelScreenTop),
      width: Number(node.dataset.auxiliaryPanelScreenRight) - Number(node.dataset.auxiliaryPanelScreenLeft),
      height: Number(node.dataset.auxiliaryPanelScreenBottom) - Number(node.dataset.auxiliaryPanelScreenTop),
    }));
    await select(1);
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.quantitativeLegendId === "co2-concentration");
    await settled();
    const reference = await readCanvas();
    assert.equal(reference.height, 102);
    await page.screenshot({ path: path.join(output, `${width}-01-reference.png`), clip: { x: reference.left, y: reference.top, width: reference.width, height: reference.height } });
    await select(8);
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.quantitativeLegendId === "renewable-electricity");
    await settled();
    const energy = await readCanvas();
    assert.equal(energy.width, reference.width); assert.equal(energy.height, reference.height);
    assert.match(energy.current, /^202\d\s+[\d.]+%$/u);
    assert(energy.progress >= 0 && energy.progress <= 1);
    await page.screenshot({ path: path.join(output, `${width}-08-renewable.png`), clip: { x: energy.left, y: energy.top, width: energy.width, height: energy.height } });

    const readDom = locator => locator.evaluate(node => {
      const box = node.getBoundingClientRect();
      const rect = query => { const e = node.querySelector(query); const r = e.getBoundingClientRect(); return { x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height }; };
      const textBoxes = [...node.querySelectorAll(".gaia-metric-legend-heading > *, .gaia-metric-legend-current > *, .gaia-metric-legend-range > *")].filter(e => e.textContent).map(e => {
        const range = document.createRange(); range.selectNodeContents(e); const r = range.getBoundingClientRect();
        return { text: e.textContent, left: r.left, right: r.right, lines: range.getClientRects().length, clientWidth: e.clientWidth, scrollWidth: e.scrollWidth };
      });
      return { ...node.dataset, width: box.width, height: box.height, left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        radius: getComputedStyle(node).borderTopLeftRadius, gradient: getComputedStyle(node.querySelector(".gaia-metric-legend-track")).backgroundImage,
        track: rect(".gaia-metric-legend-track"), marker: rect("[data-metric-marker]"), markerHidden: node.querySelector("[data-metric-marker]").hidden,
        current: node.querySelector("[data-metric-current]").textContent, period: node.querySelector("[data-metric-period]").textContent,
        scope: node.querySelector("[data-metric-scope]").textContent, textBoxes,
      };
    });
    const checkFormat = reading => {
      assert(Math.abs(reading.width - reference.width) <= 1 && reading.height === 102, JSON.stringify(reading));
      assert.equal(reading.radius, "12px"); assert.equal(reading.track.height, 6);
      assert(Math.abs(reading.track.y - 65) <= 1);
      assert(reading.left >= 0 && reading.right <= width && reading.top >= 0 && reading.bottom <= height);
      for (const box of reading.textBoxes) assert(box.lines === 1 && box.left >= reading.left && box.right <= reading.right + 1 && box.scrollWidth <= box.clientWidth + 1, JSON.stringify(box));
      if (!reading.markerHidden) {
        const actual = (reading.marker.x + reading.marker.width / 2 - reading.track.x) / reading.track.width;
        assert(Math.abs(actual - Number(reading.metricProgress)) < .005, "Marker did not match the rendered data value");
      }
    };
    const estat = [];
    for (let index = 0; index < 10; index += 1) {
      await page.evaluate(async index => {
        await GaiaEstatExhibits.select(index);
        const last = Number(document.querySelector(".gaia-estat-readout").dataset.estatPeriodCount) - 1;
        GaiaEstatExhibits.setPeriod(last); GaiaEstatExhibits.selectPrefecture(12);
      }, index);
      await settled();
      await page.evaluate(() => document.fonts.ready);
      const card = page.locator(".gaia-estat-heat-legend");
      const reading = await readDom(card);
      const state = await page.evaluate(() => ({ state: GaiaEstatExhibits.getState(), key: document.querySelector(".gaia-estat-readout").dataset.estatExhibit }));
      const expected = series[state.key][state.state.period][state.state.selectedIndex];
      assert.equal(Number(reading.metricValue), expected);
      assert.equal(reading.period, state.state.period.replace("-", "/"));
      assert.equal(reading.scope, index >= 3 && index <= 5 ? "東京" : "東京都");
      checkFormat(reading);
      await card.screenshot({ path: path.join(output, `${width}-${16 + index}-estat.png`) });
      estat.push({ number: 16 + index, current: reading.current, progress: reading.metricProgress, width: reading.width });
    }
    const planet = [];
    for (const [index, expected, label] of [[0, 4, "風速"], [1, 15, "PM2.5"], [2, 6, "マグニチュード"], [3, 40, "雲量"]]) {
      await page.evaluate(index => GaiaPlanetSignals.select(index), index);
      await settled();
      const card = page.locator(".gaia-planet-signals-legend .gaia-metric-legend");
      const reading = await readDom(card); checkFormat(reading);
      assert.equal(Number(reading.metricValue), expected); assert.equal(reading.period, "09/06 09:30");
      assert.equal(await card.locator("[data-metric-title]").textContent(), label);
      assert.equal(await page.locator(".gaia-metric-legend-details").getAttribute("open"), null);
      assert.equal(await page.locator("[data-planet-reference-notice]").isVisible(), index === 3, "Cloud image notice leaked into a different exhibit");
      await page.locator(".gaia-planet-signals-legend").screenshot({ path: path.join(output, `${width}-${27 + index}-planet.png`) });
      planet.push({ number: 27 + index, value: reading.metricValue, scope: reading.scope });
    }
    assert.equal(await page.locator("[data-planet-reference-notice]").isVisible(), true);
    assert.match(await page.locator("[data-planet-reference-notice]").textContent(), /過去の参考画像/u);
    await page.locator(".gaia-metric-legend-details summary").click();
    assert.equal(await page.locator("[data-planet-data-time]").textContent(), "2026/09/06 09:30 JST");
    assert.match(await page.locator("[data-cloud-image-credit]").getAttribute("href"), /visibleearth\.nasa\.gov/u);
    assert.equal(await page.locator("[data-cloud-image-credit]").isVisible(), true);
    assert.match(await page.locator("[data-cloud-image-credit]").textContent(), /現在の雲分布ではありません/u);
    assert.match(await page.locator("[data-planet-scope-note]").textContent(), /モデル値.*全球の面積加重平均ではありません/u);
    await page.screenshot({ path: path.join(output, `${width}-30-details.jpg`), type: "jpeg", quality: 90 });

    // An absent selected observation must never become zero or leave a stale pin.
    await page.evaluate(async () => {
      const { updateMetricLegend } = await import("./src/exploration/metric-legend.js?v=gaia-unified-metric-legend-1");
      updateMetricLegend(document.querySelector(".gaia-planet-signals-legend .gaia-metric-legend"), { title: "QA", current: "欠測", value: null, minimum: 0, maximum: 100 });
    });
    assert.equal(await page.locator(".gaia-planet-signals-legend [data-metric-marker]").isVisible(), false);
    await page.evaluate(() => { sessionStorage.removeItem("gaia-planet-signals-v3:atmosphere"); });
    failWeather = true;
    await page.evaluate(() => GaiaPlanetSignals.select(3));
    assert.match(await page.locator(".gaia-planet-signals-legend [data-metric-scope]").textContent(), /演出用サンプル/u);
    assert.match(await page.locator("[data-planet-detail-summary]").textContent(), /演出用サンプル/u);
    await select(1);
    assert.equal(await page.locator(".gaia-planet-signals-legend").isVisible(), false);
    assert.equal(await page.locator(".gaia-estat-heat-legend").isVisible(), false);
    report.checks.push({ width, reference, energy, estat, planet, missingValue: "no pin", sampleValues: "labelled", details: "accessible", cleanup: true });
    await context.close();
    console.log(`PASS ${width}: reference + renewable + all 10 prefecture and 4 planet legends, exact values/markers, consistent format, provenance and missing-data guards`);
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.errors.push(error.stack || String(error)); process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
