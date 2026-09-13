import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright-core";
import { OBSERVATION_CITIES } from "../src/exploration/observation-cities.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/observation-panels");
const widths = (process.argv[3] || "1440,2176,3840,901,768,390,320").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync("src/exploration/firms-exhibit.js", "utf8");
const formatter = source.match(/const formatJst = \(value\) => \{[\s\S]*?\n\};/u)[0];
const formatJst = vm.runInNewContext(`${formatter}; formatJst`, { Date, Intl, Number });
assert.equal(formatJst("2026-09-03T07:37:00Z"), "2026/09/03 16:37");
assert.equal(formatJst("2026-09-03T23:37:00Z"), "2026/09/04 08:37");
assert.equal(formatJst("2026-12-31T15:00:00Z"), "2027/01/01 00:00");
assert.equal(formatJst("invalid"), "—");
assert.doesNotMatch(source, /formatUtc| UTC|（UTC）/u);
const snapshot = JSON.parse(fs.readFileSync("data/firms-active-fire-snapshot.json", "utf8"));
const panelSelector = ".gaia-firms-legend, .gaia-planet-signals-legend, .gaia-live-metric-legend, .gaia-estat-heat-legend";
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const height = width === 3840 ? 2160 : width > 900 ? 900 : width === 320 ? 568 : 844;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", timezoneId: "America/Los_Angeles" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
      const points = [{ lat: 35, lon: 139, label: "Tokyo", windSpeed: 7.2, windDirection: 124, pressure: 1014,
        cloud: 36, radiation: 512, pm25: 13.4, aerosol: .27 }];
      for (const loader of ["atmosphere", "air"]) sessionStorage.setItem(`gaia-planet-signals-v3:${loader}`, JSON.stringify({
        cachedAt: Date.now(), data: { observedAt: "2026-09-03T23:37:00Z", points },
      }));
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/firms", route => route.fulfill({ json: snapshot }));
    await context.route("**/firms-active-fire-snapshot.json", route => route.fulfill({ json: snapshot }));
    await context.route("**/api/live/v1/snapshot?*", route => {
      const id = new URL(route.request().url()).searchParams.get("city");
      const city = OBSERVATION_CITIES.find(city => city.id === id) || OBSERVATION_CITIES[0];
      return route.fulfill({ json: { events: [{
        eventId: `qa-${city.id}`, provider: "open-meteo", datasetId: "QA model values", status: "latest-published",
        observedAt: "2026-09-03T23:37:00Z", retrievedAt: "2026-09-03T23:38:00Z",
        location: { label: `Open-Meteo / ${city.prefecture}・${city.city}`, lat: city.lat, lon: city.lon },
        measurements: [["weatherWindSpeed", 4.8, "m/s"], ["forecastCo2", 423.1, "ppm"], ["weatherPrecipitation", 0, "mm"],
          ["weatherTemperature", -5, "℃"], ["cloudCover", 40, "%"], ["pm25", 11.2, "µg/m³"]]
          .map(([key, value, unit]) => ({ key, value, unit, sourceKind: "MODEL", quality: "estimated" })),
      }] } });
    });
    await context.route("**/api/live/v1/wind-field", route => route.fulfill({ json: { points: [] } }));
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      type: "FeatureCollection", metadata: { generated: Date.parse("2026-09-03T23:37:00Z") }, features: [{
        type: "Feature", id: "qa-quake", geometry: { type: "Point", coordinates: [139, 35, 10] },
        properties: { mag: 5.1, time: Date.parse("2026-09-03T23:37:00Z"), place: "Japan", url: "https://earthquake.usgs.gov/" },
      }],
    } }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?live=1&preview=observation-panels#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaFirmsExhibit && globalThis.GaiaMapObservationAdapter
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      await document.fonts.ready;
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
    });
    const numbers = await page.locator(".map-mode-bank .map-mode-button").evaluateAll((buttons, all) => buttons
      .filter(button => button.matches(all
        ? "[data-firms-exhibit], [data-planet-exhibit], [data-live-exhibit], [data-estat-exhibit]"
        : '[data-firms-exhibit], [data-planet-exhibit="global-wind-pressure"], [data-live-exhibit="wind-field"], [data-estat-exhibit="estat-average-temperature"]'))
      .map(button => Number(button.textContent)), width === 1440);
    if (width === 1440) assert.equal(numbers.length, 21, "Every DOM observation family must be covered");
    else assert.equal(numbers.length, 4, "One representative of every observation family is required");
    for (const number of numbers) {
      await page.evaluate(number => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => Number(button.textContent) === number).click(), number);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      await page.evaluate(() => GaiaLiveExhibits.pausePoiAutoplay());
      await page.waitForTimeout(200);
      const panel = page.locator(panelSelector).filter({ visible: true });
      assert.equal(await panel.count(), 1, `${width}/${number}: expected one visible observation panel`);
      const scan = await panel.evaluate(element => {
        const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const fields = [...element.querySelectorAll("strong, span, small, time, em")].filter(node => node.checkVisibility() && node.getBoundingClientRect().width > 0)
          .map(node => ({ text: node.textContent, ...rect(node), font: getComputedStyle(node).fontFamily, weight: getComputedStyle(node).fontWeight, clipped: node.scrollWidth > node.clientWidth + 1 }));
        const obstacles = [...document.querySelectorAll('.signal-encoding-legend-dock, .gaia-firms-readout, .gaia-planet-signals-readout, .gaia-live-exhibit-readout, .gaia-estat-readout, #gaia-map-zoom-controls, #gaia-audio-toggle, [data-gaia-mode-guide-replay="map"], .japan-heading, .map-mobile-heading-toggle')]
          .filter(node => node.checkVisibility() && getComputedStyle(node).visibility !== "hidden" && Number(getComputedStyle(node).opacity) > 0 && node.getBoundingClientRect().width > 0).map(node => ({ name: node.className, ...rect(node) }));
        const blocks = [...element.querySelectorAll('.gaia-metric-legend-heading, .gaia-metric-legend-current, .gaia-metric-legend-context')].filter(node => node.checkVisibility()).map(rect);
        return { ...rect(element), fields, blocks, obstacles, text: element.innerText };
      });
      report.checks.push({ width, number, scan });
      assert(scan.left >= 0 && scan.right <= width && scan.top >= 0 && scan.bottom <= height, `${width}/${number}: panel outside viewport`);
      assert(width - scan.right <= (width > 900 ? 77 : 9), `${width}/${number}: not in the upper-right column`);
      const encodingLegend = scan.obstacles.find(box => box.name.includes('signal-encoding-legend-dock'));
      assert(scan.top <= Math.max(width > 900 ? 77 : 133, (encodingLegend?.bottom || 0) + 11), `${width}/${number}: not in the upper-right stack`);
      assert(scan.width >= (width > 900 ? 389 : height <= 650 ? Math.min(289, width - 83) : Math.min(329, width - 17)), `${width}/${number}: panel not enlarged`);
      for (const field of scan.fields) {
        assert(field.left >= scan.left && field.right <= scan.right + 1, `${width}/${number}: field outside panel: ${field.text}`);
        assert(!field.clipped, `${width}/${number}: clipped text: ${field.text}`);
        assert.match(field.font, /Mincho|Serif|serif/u, `${width}/${number}: observation font is not Mincho`);
        assert.equal(field.weight, "400", `${width}/${number}: observation font is too heavy`);
      }
      if (scan.blocks.length === 3) assert(scan.blocks[0].bottom <= scan.blocks[1].top && scan.blocks[1].bottom <= scan.blocks[2].top, `${width}/${number}: observation hierarchy is not three separate blocks`);
      for (const other of scan.obstacles) {
        assert(!(scan.left < other.right && scan.right > other.left && scan.top < other.bottom && scan.bottom > other.top), `${width}/${number}: panel overlaps ${other.name}`);
      }
      if (number === 1) {
        assert.equal(await page.locator("[data-firms-latest]").textContent(), `${formatJst(snapshot.summary.end)} JST`);
        const dataset = await page.evaluate(() => GaiaFirmsExhibit.getStatisticsDataset());
        assert.equal(dataset.xLabel, "観測時刻（JST）");
        assert(dataset.rows.every(row => row.label.includes("JST")));
        assert.equal(dataset.rows[0].x, Date.parse(snapshot.points[0].acquiredAt), "Underlying timestamps must not be shifted");
      }
      if (number === 2) assert.match(scan.text, /09\/04 08:37 JST/u);
      if ([1, 2, 15, 16, 24].includes(number)) await page.screenshot({ path: path.join(output, `${width}-${number}.png`) });
      if (await page.locator(".gaia-live-metric-legend").isVisible()) {
        assert.match(scan.text, /08:37 JST/u);
        assert.match(await page.locator("[data-live-exhibit-feed-time]").textContent(), /2026\/09\/04 08:37:00 JST/u);
        if (number === 15) {
          const anchor = page.locator('.gaia-live-exhibit-anchor > span');
          if (await anchor.isVisible()) {
            const box = await anchor.boundingBox();
            const overlap = Math.max(0, Math.min(box.x + box.width, scan.right) - Math.max(box.x, scan.left))
              * Math.max(0, Math.min(box.y + box.height, scan.bottom) - Math.max(box.y, scan.top));
            assert(overlap < 2, `${width}/${number}: animated place label overlaps metric panel`);
            assert(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height);
          }
          await page.locator("[data-live-deck-source]").click();
          await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
          assert.match(await page.locator("#data-ledger-updated").textContent(), /2026\/09\/04 08:38:00 JST/u);
          await page.locator("#japan-data-close").click();
        }
      }
      console.log(`PASS ${width}/${number}: enlarged upper-right panel, contained text and clear controls`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
