import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { FOOD_EXHIBITS, foodValue, foodFormat } from '../src/exploration/food-catalog.js';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/map-remaining-headings-2026-09-26/food-controls');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', environment: 'Installed headless Chrome; local CSP and real local snapshots. External APIs blocked; not production.',
  hashes: Object.fromEntries(['map-unified-dock.css', 'responsive-audit-fixes.css', 'gaia-mode-loader.js', 'index.html', ...FOOD_EXHIBITS.map(d => `data/${d.dataFile}`)]
    .map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of [1440, 1366, 1100]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    for (const def of FOOD_EXHIBITS) {
      page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.goto(`${base}/#world-${def.number}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForFunction(() => globalThis.GaiaFoodExhibits?.getState().dataState === 'ready'
        && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
      const source = JSON.parse(fs.readFileSync(`data/${def.dataFile}`, 'utf8'));
      for (const series of [source.series[0], source.series.at(-1)]) {
        await page.locator('[data-food-series]').selectOption(series.id);
        // Selecting a real country also stops the shared automatic demo.
        await page.locator('[data-food-country]').selectOption('392');
        const slider = page.locator('[data-food-year]');
        await slider.focus();
        for (const key of ['Home', 'End']) {
          await slider.press(key);
          const period = key === 'Home' ? series.periods[0] : series.periods.at(-1);
          const state = await page.evaluate(() => GaiaFoodExhibits.getState());
          assert.equal(state.seriesId, series.id);
          assert.equal(state.selectedId, '392');
          assert.equal(state.periodKey, period.key);
          const value = foodValue(def.id, period.rows.find(row => row[0] === '392'));
          assert.equal(await page.locator('[data-food-value]').textContent(), `${foodFormat(value)}${Number.isFinite(value) ? ' %' : ''}`);
        }
      }
      let dataset = await page.evaluate(() => GaiaFoodExhibits.getStatisticsDataset());
      if (!dataset?.rows.length) {
        assert(await page.locator('[data-food-analysis]').isDisabled(), 'Missing country records keep analysis disabled');
        const series = source.series.at(-1);
        const row = series.periods.at(-1).rows.find(row => Number.isFinite(foodValue(def.id, row)));
        assert(row, 'A country with actual observations exists');
        await page.locator('[data-food-country]').selectOption(row[0]);
        dataset = await page.evaluate(() => GaiaFoodExhibits.getStatisticsDataset());
      }
      assert(dataset.rows.length > 1, 'Analysis uses real observations');
      for (const name of ['series', 'country', 'year', 'source', 'analysis']) {
        const reachable = await page.locator(`[data-food-${name}]`).evaluate(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight
            && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
        assert(reachable, `${width}/${def.number}: ${name} stays visible and reachable`);
      }
      await page.locator('[data-food-source]').click();
      await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
      assert((await page.locator('#japan-data-panel').innerText()).includes('FAO'));
      await page.locator('#japan-data-close').click();
      await page.locator('#japan-data-panel').waitFor({ state: 'hidden' });
      await page.evaluate(() => Promise.all(document.querySelector('#japan-data-panel').getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
      await page.locator('[data-food-analysis]').click();
      await page.waitForFunction(id => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().datasetId === id, dataset.id);
      assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')), dataset.rows.length);
      assert(Number(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count')) > 0);
      await page.screenshot({ path: path.join(output, `${width}-${def.number}-analysis.png`) });
      await page.locator('#gaia-statistics-close').click();
      await page.locator('#gaia-statistics-lab').waitFor({ state: 'hidden' });
      const chapter = page.locator('.gaia-food-chapter .gaia-featured-selector-toggle');
      await chapter.click();
      await page.waitForFunction(() => document.querySelector('.map-dock-bank-popover')?.dataset.anchor === 'bottom');
      assert.equal(await chapter.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
      report.checks.push({ width, number: def.number, datasetId: dataset.id, rows: dataset.rows.length,
        verified: ['two series', 'country selection', 'first/last period via keyboard', 'original snapshot values', 'control hit targets', 'source open/close', 'statistics chart and rows', 'bottom menu'] });
      console.log(`PASS ${width}/${def.number} food controls`);
      await page.close();
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${report.checks.length} food control journeys`);
