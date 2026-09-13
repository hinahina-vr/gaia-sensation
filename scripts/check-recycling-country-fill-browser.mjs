import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/recycling-country-fill");
const snapshot = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8"));
const rows = snapshot.modes.find(mode => mode.id === "nothing-is-waste").signals.countryWaste;
const geography = JSON.parse(fs.readFileSync("data/natural-earth-50m-countries.geojson", "utf8"));
const mapCodes = new Set(geography.features.map(({ properties: p }) =>
  [p.ADM0_A3, p.ISO_A3, p.SOV_A3, p.BRK_A3, p.WB_A3].find(code => /^[A-Z]{3}$/.test(code))));
const expectedFills = rows.filter(row => mapCodes.has(row.mapIso3 || row.iso3)).length;
assert(rows.length >= 90);
assert(rows.every(row => row.valueStatus === "SOURCE" && Number.isFinite(row.recyclePercent)));
assert(!rows.some(row => row.iso3 === "MYS" && (!row.datasetId || row.datasetId === "un-sdg")), "Out-of-range UN source value must remain excluded");
const app = fs.readFileSync("app.js", "utf8");
assert.match(app, /drawPercentageCountryChoropleth\(ctx, rect, rows, selected\?\.iso3, now, "recyclePercent", false\)/u);
assert.match(app, /drawPercentageCountryChoropleth\(ctx, rect, rows, selectedIso3, now, "renewablePercent"\)/u);
assert.doesNotMatch(app, /fixed-diameter-pie|drawFixedDiameterPie|緑の扇形|破線円/u);

fs.mkdirSync(output, { recursive: true });
const report = { status: "running", countries: rows.length, expectedFills, checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const readMap = () => page.locator("#japan-overlay").evaluate(node => ({ ...node.dataset }));
const selectCountry = async iso3 => {
  const index = rows.findIndex(row => row.iso3 === iso3);
  assert(index >= 0, `Missing fixture ${iso3}`);
  await page.evaluate(index => {
    GaiaMapObservationAdapter.closePoi();
    const input = document.querySelector("#japan-layer [data-signal-time]");
    input.value = String(index); input.dispatchEvent(new Event("input", { bubbles: true }));
  }, index);
  await page.waitForFunction(iso3 => document.querySelector("#japan-overlay").dataset.recyclingSelectedIso3 === iso3, iso3);
  const actual = await readMap();
  assert.equal(Number(actual.recyclingSelectedRate), Number(rows[index].recyclePercent.toFixed(1)));
  assert.equal(actual.recyclingSelectedStatus, "official");
  const accessible = await page.locator("#japan-layer [data-signal-time]").first().getAttribute("aria-valuetext");
  assert(accessible.includes(`${rows[index].year}年`));
  assert(accessible.includes(rows[index].datasetId === "worldbank-waw3-recycling" ? "世界銀行公表値" : "国連公表値"));
  return rows[index];
};

try {
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 3840, height: 2088 },
  ]) {
    const mobile = viewport.width < 600;
    const context = await browser.newContext({ viewport, hasTouch: mobile, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${viewport.width}: ${error.message}`));
    await page.goto(`${base}/?mode=09&preview=recycling-country-fill#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapDemo);
    const actualRows = await page.evaluate(async () => {
      const data = await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop(); GaiaMapObservationAdapter.selectMode(3);
      return data.modes.find(mode => mode.id === "nothing-is-waste").signals.countryWaste;
    });
    assert.deepEqual(actualRows, rows, "Browser must load the expanded source-only dataset");
    await page.waitForFunction(expected => {
      const node = document.querySelector("#japan-overlay");
      return node?.dataset.recyclingEncoding === "country-choropleth"
        && Number(node.dataset.recyclingCountryFillCount) === expected
        && node.dataset.plotRevealState === "complete";
    }, expectedFills);
    const initial = await readMap();
    assert.equal(initial.recyclingPieCount, "0");
    assert.equal(Number(initial.recyclingCountryCount), rows.length);
    assert.equal(Number(initial.recyclingOfficialCount), rows.length);
    assert.equal(initial.recyclingImputedCount, "0");
    assert.equal(initial.recyclingFillScale, "country-blue-0-100");
    assert.equal(await page.locator("#japan-layer [data-signal-time]").first().getAttribute("max"), String(rows.length - 1));
    const legend = await page.locator("[data-signal-encoding-legend]").textContent();
    assert.match(legend, /国土の青.*無着色.*黄色.*濃い青.*0%/us);
    const swatch = await page.locator('[data-encoding-mark="heatmap"]').evaluate(node => getComputedStyle(node).backgroundImage);
    assert(swatch.includes("linear-gradient") && !swatch.includes("conic-gradient"));
    for (const iso3 of ["DEU", "FRA", "JPN", "AZE", "RUS", "IDN", "MYS", "CHI", rows.at(-1).iso3]) await selectCountry(iso3);
    assert.equal(rows.find(row => row.iso3 === "AZE").recyclePercent, 0, "True zero fixture changed");
    const brazil = await selectCountry("BRA");
    if (!mobile) await page.screenshot({ path: path.join(output, `${viewport.width}-world.png`) });

    // Click well inside Brazil, away from its representative point: test polygon hit detection.
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: -62, lat: -7, zoom: 3.5, targetX: .5, targetY: .38, durationMs: 0 }));
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.selectionLabelPrimary === "ブラジル");
    const point = await page.evaluate(() => {
      const overlay = document.querySelector("#japan-overlay"), rect = document.querySelector("#japan-map").getBoundingClientRect();
      const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(overlay.dataset.earthZoom);
      return { x: rect.left + rect.width / 2 + Number(overlay.dataset.earthOffsetX) + (((-62 - Number(overlay.dataset.earthCenterLongitude) + 540) % 360) - 180) * scale,
        y: rect.top + rect.height / 2 + Number(overlay.dataset.earthOffsetY) + 7 * scale };
    });
    await selectCountry("FRA");
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.recyclingSelectedIso3 === "BRA");
    await page.locator("#japan-poi-card").waitFor({ state: "visible" });
    const detail = await page.locator("#japan-poi-meta").textContent();
    assert(detail.includes(`${brazil.recyclePercent.toFixed(1)}%`));
    assert(detail.includes(String(brazil.year)));
    assert.match(await page.locator("#japan-poi-source").getAttribute("href"), /^https:\/\/unstats\.un\.org\//u);
    await page.evaluate(() => GaiaMapObservationAdapter.closePoi());
    if (mobile) await page.screenshot({ path: path.join(output, `${viewport.width}-country.png`) });
    const label = await readMap();
    assert(Number(label.selectionLabelLeftPx) >= 0);
    assert(Number(label.selectionLabelLeftPx) + Number(label.selectionLabelWidthPx) <= viewport.width + 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    // Shared drawing code must preserve MAP 13's existing country count and colour scale.
    await page.evaluate(() => { GaiaMapObservationAdapter.selectMode(7); GaiaMapDemo.stop(); });
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.renewableCountryFillCount >= 200);
    assert.equal((await readMap()).renewableFillScale, "country-blue-0-100");
    report.checks.push({ width: viewport.width, countries: rows.length, filled: Number(initial.recyclingCountryFillCount), polygonClick: "BRA", zeroCountry: "AZE", map13: "passed" });
    console.log(`PASS ${viewport.width}: ${rows.length} source countries, ${expectedFills} fills, no pies, zero/missing, polygon click, report year/source, MAP 13 regression`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
