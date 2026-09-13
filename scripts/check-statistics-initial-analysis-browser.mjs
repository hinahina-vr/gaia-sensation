import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistics-initial-analysis");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?preview=statistics-initial-analysis#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab && globalThis.GaiaMapCategories?.buttons().length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
    });
    const settled = () => page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady
      && document.querySelector('#gaia-statistics-status').textContent !== '計算中');
    const checkReady = async label => {
      await settled();
      // Calculation readiness precedes the canvas's scheduled paint.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const scan = await page.evaluate(async () => {
        const state = GaiaStatisticsLab.getState();
        const result = await GaiaStatisticsLab.run(state.methodId);
        return { ...state, kind: result.kind, status: document.querySelector('#gaia-statistics-status').textContent,
          title: document.querySelector('#gaia-statistics-method-title').textContent,
          usedRows: Number(document.querySelector('#gaia-statistics-kpis').dataset.usedRows),
          pointCount: Number(document.querySelector('#gaia-statistics-canvas').dataset.pointCount),
          selectedAvailable: document.querySelector('#gaia-statistics-methods [aria-pressed="true"]')?.getAttribute('aria-disabled'),
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      report.checks.push({ width, label, ...scan });
      assert.equal(scan.status, "解析済み", `${width}/${label}: initial analysis cannot run`);
      assert.notEqual(scan.kind, "not-applicable"); assert(scan.usedRows > 0); assert(scan.pointCount > 0);
      assert.equal(scan.selectedAvailable, "false"); assert.equal(scan.recordQuery, ""); assert.equal(scan.overflow, 0);
      return scan;
    };
    // Actual map buttons, including the exact recycling exhibit in the report.
    for (const number of width > 900 ? [9, 6, 7, 8, 10, 11, 12, 13, 14, 21, 24] : [9, 24]) {
      await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent) === number).click(), number);
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
      const selector = number >= 21 ? '[data-estat-analysis]' : width > 900 ? '.map-dock-action--statistics' : '#gaia-statistics-button-mobile';
      await page.locator(selector).click();
      const scan = await checkReady(`exhibit-${number}`);
      const expectedDatasets = { 6: 'co2-trend', 7: 'wind-climate', 8: 'rainfall', 9: 'waste', 10: 'emissions-urban',
        11: 'earthquakes', 12: 'forest-urban', 13: 'renewables', 14: 'population' };
      if (expectedDatasets[number]) assert.equal(scan.datasetId, expectedDatasets[number], 'Analysis must match the current exhibit, not a snapshot index');
      if (number === 14) {
        const population = await page.evaluate(async () => {
          const snapshot = await GaiaMapObservationAdapter.waitSignalsReady();
          const year = Number(document.querySelector('#japan-overlay').dataset.populationSelectedYear);
          const values = snapshot.modes.find(mode => mode.id === 'population-tide').signals.population.filter(row => row.year === year).map(row => row.population);
          const result = await GaiaStatisticsLab.run('summary');
          return { expected: values.sort((a, b) => a - b), actual: result.stats.values.sort((a, b) => a - b), year,
            context: document.querySelector('#gaia-statistics-context').textContent };
        });
        assert.deepEqual(population.actual, population.expected);
        assert(population.context.includes(`${population.year}年`));
      }
      if (number === 10) {
        const emissions = await page.evaluate(async () => {
          const snapshot = await GaiaMapObservationAdapter.waitSignalsReady();
          const year = Number(document.querySelector('#japan-overlay').dataset.emissionsSelectedYear);
          const values = snapshot.modes.find(mode => mode.id === 'anthropocene-scar').signals.emissions.filter(row => row.year === year).map(row => row.emissionsMtCo2);
          return { expected: values.sort((a, b) => a - b), actual: (await GaiaStatisticsLab.run('summary')).stats.values.sort((a, b) => a - b),
            axis: document.querySelector('#gaia-statistics-canvas').dataset.axisX };
        });
        assert.deepEqual(emissions.actual, emissions.expected);
        assert.match(emissions.axis, /Mt CO₂/u);
      }
      if (number === 9) {
        assert.equal(scan.datasetId, "waste"); assert.equal(scan.methodId, "summary"); assert.equal(scan.usedRows, 17);
        assert.equal(scan.includeDerived, false); assert.equal(scan.title, "再資源化率の分布");
        await page.screenshot({ path: path.join(output, `${width}-waste-initial.jpg`), type: "jpeg", quality: 85 });
      }
      if (number === 24) assert.equal(scan.methodId, "regression", "Preserve valid temperature-history analysis");
      await page.locator('#gaia-statistics-close').click();
    }
    // An unknown or inapplicable suggested method falls back without changing data.
    for (const [preferred, values, expected] of [
      ["regression", [7], "summary"], ["scatter", [5, 5, 5, 5], "summary"],
      ["unknown-method", [1, 4, 7], "summary"], ["regression", [1, 5, 6, 10, 13, 15], "regression"],
    ]) {
      const dataset = { id: "initial-analysis-fixture", modeId: "estat-prefecture", title: "Initial analysis fixture", defaultMethod: preferred,
        unit: "unit", provenance: ["SOURCE"], rows: values.map((value, index) => ({ id: String(index), x: index, y: value, value, provenance: "SOURCE" })) };
      await page.evaluate(dataset => GaiaStatisticsLab.open({ dataset }), dataset);
      assert.equal((await checkReady(`default-${preferred}-${values.length}`)).methodId, expected);
    }
    // Neither an applied filter nor a pending debounce may empty the next entry.
    await page.locator('#gaia-statistics-record-filter').evaluate(node => {
      node.value = 'no-such-record'; node.dispatchEvent(new Event('search', { bubbles: true }));
    });
    await settled();
    assert.equal(await page.locator('#gaia-statistics-status').textContent(), '条件不足');
    await page.evaluate(() => GaiaStatisticsLab.open({ datasetId: 'waste' }));
    assert.equal((await checkReady('reopen-after-empty-filter')).usedRows, 17);
    await page.locator('#gaia-statistics-record-filter').evaluate(node => {
      node.value = 'pending-no-record'; node.dispatchEvent(new Event('input', { bubbles: true }));
      void GaiaStatisticsLab.open({ datasetId: 'waste' });
    });
    await page.waitForTimeout(200);
    assert.equal((await checkReady('reopen-cancels-pending-filter')).usedRows, 17);
    console.log(`PASS ${width}: useful initial analyses, SOURCE-only recycling, valid defaults, insufficient/unknown defaults and stale-filter reset`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.jpg'), type: 'jpeg', quality: 85 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
