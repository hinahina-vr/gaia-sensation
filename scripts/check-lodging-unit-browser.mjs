import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/lodging-unit");
const series = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8"));
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [3840, 1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width > 900 ? 900 : 844 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=lodging-unit#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && Boolean(globalThis.GaiaEstatExhibits));
    await page.evaluate(() => GaiaEstatExhibits.select(1));
    await page.evaluate(() => document.fonts.ready);
    const samples = [];
    for (const month of [1, 4]) for (const prefecture of [0, 12]) {
      await page.evaluate(({ month, prefecture }) => {
        GaiaEstatExhibits.setMonth(month);
        GaiaEstatExhibits.selectPrefecture(prefecture);
      }, { month, prefecture });
      const current = series.lodging[series.periodsBySeries.lodging[month]][prefecture];
      const previous = series.lodging[series.periodsBySeries.lodging[0]][prefecture];
      const delta = current - previous;
      await page.waitForFunction(expected => document.querySelector("[data-estat-value]").textContent === expected, current.toLocaleString("ja-JP"));
      assert.equal(await page.locator("[data-estat-unit]").textContent(), "人");
      assert.equal(await page.locator("[data-estat-value-label]").textContent(), "年間延べ宿泊者数（従業者10人以上）");
      assert.equal(await page.locator("[data-estat-delta]").textContent(), `${delta > 0 ? "+" : ""}${delta.toLocaleString("ja-JP")} 人`);
      for (const attr of ["current", "minimum", "maximum"]) {
        assert.match(await page.locator(`.gaia-estat-heat-legend [data-metric-${attr}]`).textContent(), / 人$/);
      }
      assert.equal(await page.evaluate(() => GaiaEstatExhibits.getStatisticsDataset().unit), "人");
      assert.equal(await page.locator(".gaia-estat-readout, .gaia-estat-heat-legend").evaluateAll(nodes => nodes.some(node => node.textContent.includes("人泊"))), false);
      const fits = await page.locator("[data-estat-unit]").evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return [...range.getClientRects()].length === 1 && node.scrollWidth <= node.clientWidth + 1;
      });
      assert(fits, `${width}: wrapped unit`);
      samples.push({ month, prefecture, current, delta });
    }
    await page.screenshot({ path: path.join(output, `${width}-lodging.jpg`), type: "jpeg", quality: 88 });
    report.checks.push({ width, samples });
    await context.close();
    console.log(`PASS ${width}: primary, comparison, legend and analysis units; original values retained`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
