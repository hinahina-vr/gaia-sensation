import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/country-emissions-history");
fs.mkdirSync(output, { recursive: true });
const rows = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8")).modes.find(mode => mode.id === "anthropocene-scar").signals.emissions;
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const boot = async context => {
  await context.addInitScript(() => {
    sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
  });
  await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
  const tab = await context.newPage();
  tab.on("pageerror", error => report.errors.push(error.message));
  await tab.goto(`${base}/?mode=10&preview=country-emissions#world`, { waitUntil: "domcontentloaded" });
  await tab.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length === 30);
  await tab.evaluate(async () => {
    await GaiaMapObservationAdapter.waitSignalsReady();
    GaiaMapDemo.stop();
    GaiaModeEntryGuide.close("map", { restoreFocus: false });
    GaiaMapObservationAdapter.selectMode(4);
  });
  await tab.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
  return tab;
};
const clickCountry = async (iso3, year, touch = false) => {
  const row = rows.find(row => row.iso3 === iso3 && row.year === year);
  const years = [...new Set(rows.map(row => row.year))].sort((a, b) => a - b);
  await page.evaluate(({ row, position }) => {
    GaiaMapObservationAdapter.closePoi();
    GaiaMapObservationAdapter.setSignalTime(position);
    GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 1.8, targetX: .5, targetY: .43, durationMs: 0 });
  }, { row, position: (years.indexOf(year) + .5) / years.length * 100 });
  await page.waitForFunction(year => {
    const overlay = document.querySelector("#japan-overlay");
    return overlay.dataset.emissionsSelectedYear === String(year)
      && Number(overlay.dataset.emissionsCountryFillCount) > 0
      && overlay.dataset.plotRevealWaitsForSeparator === "false"
      && performance.now() >= Number(overlay.dataset.plotRevealFirstVisibleAt || 0);
  }, year);
  const point = await page.evaluate(row => {
    const overlay = document.querySelector("#japan-overlay"), rect = document.querySelector("#japan-map").getBoundingClientRect();
    const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(overlay.dataset.earthZoom);
    const wrap = ((row.lon - Number(overlay.dataset.earthCenterLongitude) + 540) % 360) - 180;
    return { x: rect.left + rect.width / 2 + Number(overlay.dataset.earthOffsetX) + wrap * scale,
      y: rect.top + rect.height / 2 + Number(overlay.dataset.earthOffsetY) - row.lat * scale };
  }, row);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(iso3 => !document.querySelector("#japan-poi-card").hidden && document.querySelector("#japan-poi-history").dataset.country === iso3, iso3);
  return point;
};
try {
  const viewports = process.argv[4] ? process.argv[4].split(",").map(pair => pair.split("x").map(Number)) : [[1440, 900], [390, 844], [320, 680], [844, 390]];
  for (const [width, height] of viewports) {
    const touch = width < 901;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, reducedMotion: width === 1440 ? "no-preference" : "reduce" });
    let release, requested = false;
    const gate = new Promise(resolve => { release = resolve; });
    await context.route("**/country-emissions-history.js*", async route => { requested = true; await gate; await route.continue(); });
    page = await boot(context);
    assert.equal(requested, false, "Chart module should be loaded only after opening a country");
    await clickCountry("AUS", 2013, touch);
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.selectionLabelVisible === "false");
    assert.equal(await page.locator("#japan-poi-history").getAttribute("data-state"), "loading");
    assert.equal(await page.locator("#japan-poi-type .japan-poi-name").textContent(), "オーストラリア");
    assert.match(await page.locator("#japan-poi-meta").textContent(), /2013年.*399.1 Mt CO₂/u);
    assert.equal(await page.locator("#japan-poi-preview").getAttribute("aria-hidden"), "true");
    assert(await page.locator("#japan-poi-source").isVisible());
    // Replace the selection while the first asynchronous import is unresolved.
    await page.locator("#japan-poi-close").click();
    assert.equal(await page.locator("#japan-poi-history").getAttribute("hidden"), "");
    await clickCountry("JPN", 1945, touch);
    release();
    await page.waitForFunction(() => document.querySelector("#japan-poi-history").dataset.state === "ready");
    assert.equal(await page.locator(".country-emissions-line").getAttribute("data-series-country"), "JPN", "Old async country must not overwrite the new selection");

    for (const [iso3, year] of [["AUS", 2013], ["CHN", 2023], ["JPN", 1945]]) {
      await clickCountry(iso3, year, touch);
      await page.waitForFunction(iso3 => document.querySelector("#japan-poi-history").dataset.state === "ready"
        && document.querySelector(".country-emissions-line")?.dataset.seriesCountry === iso3, iso3);
      const scan = await page.locator("#japan-poi-card").evaluate(card => {
        const marker = card.querySelector(".country-emissions-selected");
        const chart = card.querySelector(".country-emissions-chart");
        const history = card.querySelector("#japan-poi-history");
        const close = card.querySelector("#japan-poi-close").getBoundingClientRect();
        return { title: card.querySelector(".japan-poi-name").textContent, year: Number(marker.dataset.year), value: Number(marker.dataset.value),
          closeHit: Boolean(document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2)?.closest("#japan-poi-close")),
          card: card.getBoundingClientRect().toJSON(), chart: chart.getBoundingClientRect().toJSON(), busy: history.getAttribute("aria-busy"),
          overflow: card.scrollWidth - card.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth,
          values: [...card.querySelectorAll("tbody tr")].map(row => [Number(row.querySelector("th").textContent), Number(row.querySelector("td").dataset.value)]),
          chartLabel: chart.getAttribute("aria-label"), source: card.querySelector("#japan-poi-source").href };
      });
      const sourceRows = rows.filter(row => row.iso3 === iso3).sort((a, b) => a.year - b.year);
      assert.equal(scan.year, year);
      assert.equal(scan.value, sourceRows.find(row => row.year === year).emissionsMtCo2);
      assert.deepEqual(scan.values, sourceRows.map(row => [row.year, row.emissionsMtCo2]));
      assert.equal(scan.overflow, 0); assert.equal(scan.pageOverflow, 0); assert.equal(scan.busy, "false");
      assert.equal(scan.closeHit, true, "Close button must be above the map instruments");
      assert(scan.card.x >= 0 && scan.card.right <= width && scan.card.y >= 0 && scan.card.bottom <= height);
      assert(scan.chart.x >= scan.card.x && scan.chart.right <= scan.card.right);
      assert.match(scan.source, /doi.org\/10.5281\/zenodo.13981696/u);
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.selectionLabelVisible === "false");
      report.checks.push({ width, height, iso3, ...scan });
      if (iso3 === "AUS") {
        await page.screenshot({ path: path.join(output, `${width}-screen.jpg`), type: "jpeg", quality: 88 });
        await page.locator("#japan-poi-card").screenshot({ path: path.join(output, `${width}-card.png`) });
        await page.locator(".country-emissions-values summary").click();
        assert(await page.locator(".country-emissions-values tbody").isVisible());
        await page.locator(".country-emissions-values summary").click();
      }
    }
    await page.keyboard.press("Escape");
    assert(await page.locator("#japan-poi-card").isHidden());
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.selectionLabelVisible === "true");
    await page.evaluate(() => GaiaMapObservationAdapter.selectMode(0));
    assert(await page.locator("#japan-poi-history").isHidden());
    assert.equal(await page.locator(".country-emissions-chart").count(), 0);
    console.log(`PASS ${width}×${height}: async card, race guard, three country histories, source values, no duplicate bubble, layout and cleanup`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.route("**/country-emissions-history.js*", route => route.abort());
  page = await boot(context);
  await clickCountry("AUS", 2013);
  await page.waitForFunction(() => document.querySelector("#japan-poi-history").dataset.state === "error");
  assert.match(await page.locator("#japan-poi-meta").textContent(), /399.1 Mt CO₂/u);
  assert(await page.locator("#japan-poi-source").isVisible());
  await page.locator("#japan-poi-close").click();
  assert(await page.locator("#japan-poi-card").isHidden());
  await context.close();
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log("PASS module-load failure: selected-year values and source stay usable, close works");
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 88 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
