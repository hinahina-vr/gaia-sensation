import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { OBSERVATION_CITIES } from "../src/exploration/observation-cities.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/prefecture-city-label");
const widths = (process.argv[4] || "1440,3840,1024,901,768,390").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 2400 ? 2088 : width < 600 ? 844 : 900 }, hasTouch: width <= 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=1&preview=prefecture-city-label#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaEstatExhibits && globalThis.GaiaMapCategories?.buttons().length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaEstatExhibits.select(3);
    });
    await page.waitForFunction(() => document.querySelector('.gaia-estat-readout')?.dataset.estatPeriodCount === "71");
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const rows = await page.evaluate(cities => cities.map((city, index) => {
      GaiaEstatExhibits.selectPrefecture(index);
      const readout = document.querySelector('.gaia-estat-readout');
      const place = readout.querySelector('.gaia-estat-place');
      const label = place.querySelector('[data-estat-place]');
      const range = document.createRange();
      range.selectNodeContents(label);
      return { code: city.code, prefecture: city.prefecture, text: label.textContent,
        station: readout.dataset.estatObservationStation,
        visible: getComputedStyle(place).display !== "none",
        cell: place.getBoundingClientRect().toJSON(), glyphs: range.getBoundingClientRect().toJSON(),
        lines: range.getClientRects().length, legacyLines: readout.querySelectorAll('[data-estat-city]').length,
        nextCell: readout.querySelector('.gaia-estat-primary').getBoundingClientRect().toJSON(),
        overflow: document.documentElement.scrollWidth - innerWidth };
    }), OBSERVATION_CITIES);
    for (const row of rows) {
      report.checks.push({ width, ...row });
      const cityName = row.station === "東京" || row.station.endsWith("市") ? row.station : `${row.station}市`;
      assert.equal(row.text, `${row.prefecture}（${cityName}）`);
      assert.equal(row.legacyLines, 0);
      assert.equal(row.overflow, 0);
      assert.equal(row.visible, width > 720);
      if (row.visible) {
        assert.equal(row.lines, 1, `${width}/${row.code}: label wraps`);
        assert(row.glyphs.x >= row.cell.x && row.glyphs.right <= row.cell.right + 1, `${width}/${row.code}: clipped ${JSON.stringify(row)}`);
        assert(row.glyphs.right <= row.nextCell.x + 1, `${width}/${row.code}: label overlaps value`);
      }
    }
    assert.equal(rows[4].text, "秋田県（秋田市）");
    assert.equal(rows[10].text, "埼玉県（熊谷市）");
    assert.equal(rows[12].text, "東京都（東京）");
    assert.equal(rows[45].text, "鹿児島県（鹿児島市）");
    for (const index of [4, 45]) {
      await page.evaluate(index => GaiaEstatExhibits.selectPrefecture(index), index);
      await page.locator('.gaia-estat-readout').screenshot({ path: path.join(output, `${width}-${index}-readout.png`) });
    }
    await page.screenshot({ path: path.join(output, `${width}-screen.jpg`), type: "jpeg", quality: 85 });
    await page.evaluate(() => GaiaEstatExhibits.select(0));
    await page.waitForFunction(() => document.querySelector('.gaia-estat-readout')?.dataset.estatExhibit === "migration");
    await page.locator('.gaia-estat-readout').screenshot({ path: path.join(output, `${width}-migration-readout.png`) });
    console.log(`PASS ${width}: all 47 locations use prefecture (city); one-line desktop/tablet labels and mobile layout intact`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 85 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
