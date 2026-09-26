import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/poi-year-crossfade-2026-09-26');
fs.mkdirSync(output, { recursive: true });
const report = { scope: 'Local installed Chrome; real point hit testing/click and statistics panel. Not production.', checks: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await enforceBrowserSecurity(context, base); await context.route('https://**', r => r.abort());
const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
try {
  await page.goto(`${base}/#world-49`);
  await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().dataState === 'ready');
  await page.evaluate(() => GaiaMapPlayback.stop());
  await page.waitForFunction(() => document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'complete'
    && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
  // Query actual picker during intermediate fade frames, including coordinates
  // of stations that disappear from the new year. Ghost raster is never a POI.
  const result = await page.evaluate(async () => {
    const { earthBaseScale, earthLongitudeToMapX } = await import('./src/exploration/world-projection.js?v=gaia-japan-center-1');
    const previous = GaiaMarineCod.getCruisePoints();
    await GaiaMarineCod.setYear(2017);
    while (!GaiaMarineCod.getState().yearFade.progress) await new Promise(requestAnimationFrame);
    const current = GaiaMarineCod.getCruisePoints(), ids = new Set(current.map(p => p.id));
    const removed = previous.filter(p => !ids.has(p.id));
    const rect = GaiaMapObservationAdapter.getViewportRect(), d = document.querySelector('#japan-overlay').dataset;
    const scale = earthBaseScale(rect) * Math.max(1, Number(d.earthZoom) || 1);
    const originX = (rect.width - 360 * scale) / 2 + (Number(d.earthOffsetX) || 0);
    const originY = (rect.height - 180 * scale) / 2 + (Number(d.earthOffsetY) || 0);
    const checked = [], targets = [];
    for (const point of [...removed, ...current.filter((_, i) => i % 10 === 0)]) {
      const x = rect.left + originX + earthLongitudeToMapX(point.lon) * scale;
      const y = rect.top + originY + (90 - point.lat) * scale;
      const hit = GaiaMarineCod.findPoiAt(x, y, 'mouse');
      if (hit) {
        checked.push({ id: hit.record.id, current: ids.has(hit.record.id), meta: hit.record.meta });
        if (document.elementFromPoint(x, y)?.closest('#japan-map')) targets.push({ x, y, id: hit.record.id });
      }
    }
    return { fade: GaiaMarineCod.getState().yearFade, removed: removed.length, checked, target: targets[0] };
  });
  assert(result.fade.active && result.fade.progress > 0 && result.fade.progress < 1);
  assert(result.removed > 0 && result.checked.length > 30 && result.target);
  assert(result.checked.every(p => p.current && p.meta.includes('2017年度')));
  report.checks.push(`During fade, ${result.checked.length} hits use 2017 records only, including ${result.removed} vanished-station coordinates`);
  await page.mouse.click(result.target.x, result.target.y);
  await page.waitForFunction(id => GaiaMarineCod.getState().selectedId === id, result.target.id);
  await page.waitForFunction(() => !document.querySelector('[data-cod-analysis]').disabled);
  const dataset = await page.evaluate(() => GaiaMarineCod.getStatisticsDataset());
  assert(dataset?.rows.length > 0);
  await page.locator('[data-cod-analysis]').click();
  await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady);
  assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().datasetId), dataset.id);
  await page.screenshot({ path: path.join(output, 'picked-current-year-analysis.png') });
  report.checks.push('Real map click selects current-year station; statistics panel opens with that station dataset');
  report.sample = { fade: result.fade, removed: result.removed, target: result.target, dataset: dataset.id, rows: dataset.rows.length };
  assert.deepEqual(report.errors, []); assert.deepEqual(await page.evaluate(() => __securityViolations), []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'picking.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
