import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { OBSERVATION_CITIES } from "../src/exploration/observation-cities.js";
import { formatPrefecturePlace } from "../src/exploration/observation-place-label.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/observation-place-inline");
const widths = (process.argv[4] || "1440,3840,1024,901,768,390,320").split(",").map(Number);
const stations = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8")).weatherHistorySource.stations;
const expected = city => `${city.prefecture}（${city.city === "東京" ? city.city : `${city.city}市`}）`;
for (const city of OBSERVATION_CITIES) assert.equal(formatPrefecturePlace(city.prefecture, city.city), expected(city));
assert.equal(formatPrefecturePlace("東京都", "千代田区"), "東京都（千代田区）");
assert.equal(formatPrefecturePlace("北海道", "松前町"), "北海道（松前町）");
assert.equal(formatPrefecturePlace("長野県", "白馬村"), "長野県（白馬村）");
assert.equal(formatPrefecturePlace("栃木県"), "栃木県");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const checkRows = (rows, width) => {
  for (const row of rows) {
    assert.equal(row.text, row.expected, `${width}/${row.surface}`);
    if (!row.visible) continue;
    assert.equal(row.lines, 1, `${width}: wraps ${JSON.stringify(row)}`);
    assert(row.glyphs.left >= row.box.left - 1 && row.glyphs.right <= row.box.right + 1, `${width}: clips ${JSON.stringify(row)}`);
  }
};
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 2400 ? 2088 : width < 360 ? 640 : width < 600 ? 844 : 900 }, hasTouch: width <= 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.measurePlace = (node, expected, surface, container = node.parentElement) => {
        const range = document.createRange(); range.selectNodeContents(node);
        return { surface, text: node.textContent, expected, visible: Boolean(node.getClientRects().length),
          lines: range.getClientRects().length, glyphs: range.getBoundingClientRect().toJSON(), box: container.getBoundingClientRect().toJSON() };
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?mode=15&preview=observation-place-inline#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapCategories.buttons()[14].click(); GaiaLiveExhibits.pausePoiAutoplay(); await document.fonts.ready;
    });
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const rows = [];
    for (const city of OBSERVATION_CITIES) {
      rows.push(...await page.evaluate(({ city, expected }) => {
        GaiaLiveExhibits.selectObservationPoint(city.id);
        return ["[data-live-deck-location]", "[data-live-anchor-label]", ".gaia-live-metric-legend [data-metric-scope]"]
          .map(selector => measurePlace(document.querySelector(selector), expected, selector));
      }, { city, expected: expected(city) }));
    }
    checkRows(rows, width);
    await page.locator(".gaia-live-place-selector").click();
    const pickerRows = await page.locator("[data-place-city]").evaluateAll((buttons, cities) => buttons.map((button, index) =>
      measurePlace(button.querySelector("strong"), cities[index], "picker")), OBSERVATION_CITIES.map(expected));
    checkRows(pickerRows, width);
    await page.locator('[data-place-region="all"]').click();
    await page.locator(".gaia-place-picker-results").evaluate(node => { node.scrollTop = 0; });
    await page.locator(".gaia-place-picker").screenshot({ path: path.join(output, `${width}-picker.png`) });
    await page.keyboard.press("Escape");
    await page.evaluate(() => GaiaLiveExhibits.selectObservationPoint("utsunomiya"));
    await page.waitForFunction(() => document.querySelector("#japan-layer").dataset.livePoiTransition === "settled");
    await page.screenshot({ path: path.join(output, `${width}-screen.jpg`), type: "jpeg", quality: 88 });
    await page.locator(".gaia-live-deck-location-control").screenshot({ path: path.join(output, `${width}-inline.png`) });
    if (width > 900) await page.locator(".gaia-live-exhibit-anchor > span").screenshot({ path: path.join(output, `${width}-anchor.png`) });
    for (const number of [16, 17, 18, 19, 20]) {
      await page.evaluate(number => { GaiaMapCategories.buttons()[number - 1].click(); GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveExhibits.selectObservationPoint("kagoshima"); }, number);
      checkRows(await page.evaluate(() => ["[data-live-deck-location]", "[data-live-anchor-label]", ".gaia-live-metric-legend [data-metric-scope]"]
        .map(selector => measurePlace(document.querySelector(selector), "鹿児島県（鹿児島市）", selector))), width);
    }
    await page.evaluate(async () => { await GaiaEstatExhibits.select(3); });
    await page.waitForFunction(() => document.querySelector(".gaia-estat-readout")?.dataset.estatPeriodCount === "71");
    const statRows = await page.evaluate(stations => stations.flatMap((station, index) => {
      GaiaEstatExhibits.selectPrefecture(index);
      const label = `${station.prefecture}（${station.station === "東京" ? station.station : `${station.station}市`}）`;
      document.querySelector(`.gaia-estat-prefecture-region[data-estat-prefecture="${station.code}"]`).dispatchEvent(new PointerEvent("pointerenter"));
      return ["[data-estat-place]", ".gaia-estat-heat-legend [data-metric-scope]", ".gaia-estat-prefecture-tooltip strong"]
        .map(selector => measurePlace(document.querySelector(selector), label, selector));
    }), stations);
    checkRows(statRows, width);
    await page.evaluate(async () => { await GaiaEstatExhibits.select(0); GaiaEstatExhibits.selectPrefecture(8); });
    assert.equal(await page.locator("[data-estat-place]").textContent(), "栃木県", "Prefecture totals must not imply municipal data");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    report.checks.push({ width, live: rows.length, picker: pickerRows.length, station: statRows.length, allSixLiveExhibits: true });
    console.log(`PASS ${width}: 47 places and stations, one-line labels, picker and all six live exhibits`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
