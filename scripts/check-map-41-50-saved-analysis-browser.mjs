import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const sourceExhibit = process.env.GAIA_SAVED_EXHIBIT || '49';
const otherExhibit = process.env.GAIA_SAVED_OTHER_EXHIBIT || '44';
const output = path.resolve(process.env.GAIA_SAVED_OUTPUT || 'artifacts/map-41-50-polish-20261022/saved-analysis');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', checks: [], errors: [], environment: 'Local installed Chrome, desktop; actual same-context document reload and localStorage; external requests blocked.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
await enforceBrowserSecurity(context, base);
await context.route('https://**/*', route => route.abort());
await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
const ready = async () => {
  await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().dataState === 'ready');
  await page.evaluate(() => { GaiaModeEntryGuide.close('map', { restoreFocus: false }); GaiaMapPlayback.stop(); });
  await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
};
const analyze = async () => {
  const point = await page.evaluate(() => GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === 'measured'));
  await page.locator('[data-cod-prefecture]').selectOption(point.prefCode);
  await page.locator('[data-cod-station]').selectOption(point.id);
  await page.waitForFunction(() => Boolean(GaiaMarineCod.getStatisticsDataset()));
  await page.locator('[data-cod-analysis]').click();
  await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().open);
};
try {
  await page.goto(`${base}/world.html#world-${sourceExhibit}`, { waitUntil: 'domcontentloaded' });
  await ready(); await analyze();
  const original = await page.evaluate(() => ({ dataset: GaiaMarineCod.getStatisticsDataset(), summary: GaiaStatisticsLab.run('summary') }));
  await page.locator('#gaia-statistics-menu-toggle').click();
  await page.locator('.gaia-statistics-data-options summary').click();
  await page.locator('#gaia-statistics-view-save').click();
  const savedId = await page.locator('#gaia-statistics-saved-view').inputValue();
  assert(savedId);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gaia-statistics-saved-views:v1')));
  assert(JSON.stringify(saved).includes(original.dataset.id));
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'reload');
  // Open a different metric, then restore the saved source ID/history.
  await page.evaluate(number => GaiaMapCategories.buttons().find(b => b.textContent.trim() === number).click(), otherExhibit);
  await page.waitForFunction(number => GaiaMarineCod.definition.number === number && GaiaMarineCod.getState().dataState === 'ready', otherExhibit);
  await ready(); await analyze();
  assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), 1);
  await page.locator('#gaia-statistics-menu-toggle').click();
  await page.locator('.gaia-statistics-data-options summary').click();
  await page.locator('#gaia-statistics-record-filter').fill('2023');
  await page.locator('#gaia-statistics-saved-view').selectOption(savedId);
  await page.locator('#gaia-statistics-view-apply').click();
  await page.waitForFunction(id => GaiaStatisticsLab.getState().datasetId === id && GaiaStatisticsLab.getState().analysisReady && document.querySelector('#gaia-statistics-record-filter').value === '', original.dataset.id);
  const restored = await page.evaluate(() => GaiaStatisticsLab.run('summary'));
  assert.equal(restored.stats.n, original.summary.stats.n);
  assert.equal(restored.stats.mean, original.summary.stats.mean);
  assert.equal(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count'), String(original.dataset.rows.length));
  await page.locator('#gaia-statistics-menu-close').click();
  const removedExports = await page.evaluate(() => ({
    controls: document.querySelectorAll('#gaia-statistics-export-csv, #gaia-statistics-export-json, #gaia-statistics-export-png, #gaia-statistics-lab [download]').length,
    methods: ['createExportReport', 'exportCsv', 'exportJson', 'exportPng'].filter(name => typeof GaiaStatisticsLab[name] === 'function'),
  }));
  assert.equal(removedExports.controls, 0); assert.deepEqual(removedExports.methods, []);
  await page.screenshot({ path: path.join(output, `restored-${sourceExhibit}.png`) });
  assert.deepEqual(report.errors, []); assert.deepEqual(await page.evaluate(() => __securityViolations), []);
  report.checks.push({ savedId, datasetId: original.dataset.id, rows: restored.stats.n, mean: restored.stats.mean, reloadedAndRestoredFromDifferentExhibit: true, exportRemainsDisabled: true });
  report.status = 'passed'; console.log(JSON.stringify(report));
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error;
} finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
