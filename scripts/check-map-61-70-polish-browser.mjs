import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const stage = process.env.GAIA_POLISH_STAGE || 'after';
const output = path.resolve(`artifacts/map-61-70-polish-20261022/${stage}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: 'uncommitted changes', checks: [], errors: [], environment: 'Local installed Chrome; external requests blocked. Mobile/touch emulation, not physical devices.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const settle = () => page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
const choose = async number => {
  await page.evaluate(n => GaiaMapCategories.buttons().find(b => Number(b.textContent.trim()) === n).click(), number);
  await page.waitForFunction(n => n < 70 ? +GaiaMarineCod.definition.number === n && GaiaMarineCod.getState().dataState === 'ready' : GaiaFoodExhibits.getState().active && GaiaFoodExhibits.getState().dataState === 'ready', number);
  await page.evaluate(() => GaiaMapPlayback.stop()); await settle();
};
const drawer = async open => {
  const node = page.locator('#map-responsive-data');
  if (await node.isVisible() && (await node.getAttribute('open') !== null) !== open) await node.locator(':scope > summary').click();
};
const details = async (width, food = false) => {
  if (width < 900) await page.locator('[data-mobile-sheet="reading"]').click();
  const root = width < 900 ? page.locator('#map-mobile-sheet') : page.locator(food ? '.gaia-food-legend:not(.map-mobile-reading-copy)' : '.gaia-marine-cod-legend:not(.map-mobile-reading-copy)');
  const disclosure = root.locator(food ? '.gaia-food-details' : '.gaia-observation-details');
  if (await disclosure.count() && await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
  return root;
};
const closeDetails = async width => { if (width < 900) await page.locator('[data-mobile-sheet-close]').click(); };
const action = async (width, name, selector) => {
  if (width < 900) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.locator('#map-mobile-sheet').getByRole('button', { name, exact: true }).click(); }
  else await page.locator(selector).click();
};
try {
  for (const width of (process.env.GAIA_POLISH_WIDTHS || '1920,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: Number(process.env.GAIA_POLISH_HEIGHT) || (width >= 900 ? 1080 : 844) }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**/*', route => route.abort());
    await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/world.html#world-61`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().dataState === 'ready');
    await page.evaluate(() => { GaiaModeEntryGuide.close('map', { restoreFocus: false }); GaiaMapPlayback.stop(); }); await settle();
    for (const number of (process.env.GAIA_POLISH_NUMBERS || '61,62,63,64,65,66,67,68,69,70').split(',').map(Number)) {
      await choose(number);
      await page.screenshot({ path: path.join(output, `${width}-${number}-overview.png`) });
      if (stage === 'before') { report.checks.push({ width, number, loaded: true }); continue; }
      let target, measurement;
      if (number < 70) {
        target = await page.evaluate(() => GaiaMarineCod.getCruisePoints().find(p => (p.metrics?.[GaiaMarineCod.definition.measurementKey] || p.measurement)?.value > 0));
        assert(target, `measured point ${number}`);
        measurement = target.metrics?.[number === 65 ? 'air' : number === 66 ? 'water' : 'transfer'] || target.measurement;
        if (width < 900) await drawer(true);
        await page.locator('[data-cod-prefecture]').selectOption(target.prefCode);
        await page.locator('[data-cod-station]').selectOption(target.id);
        await page.waitForFunction(() => Boolean(GaiaMarineCod.getStatisticsDataset()));
        if (width < 900) await drawer(false);
      }
      const root = await details(width, number === 70);
      assert.equal(await root.evaluate(el => el.scrollWidth - el.clientWidth), 0, `${width}/${number} horizontal overflow`);
      if (width >= 900) {
        const bounds = await root.evaluate(el => {
          const box = el.getBoundingClientRect(), dock = document.querySelector('#japan-layer.is-food-exhibit .gaia-food-readout, #japan-layer.is-marine-cod-exhibit .gaia-marine-cod-readout').getBoundingClientRect();
          const credit = document.querySelector('#japan-layer > .japan-credits')?.getBoundingClientRect();
          return { bottom: box.bottom, dockTop: dock.top, creditTop: credit?.height ? credit.top : dock.top, height: innerHeight };
        });
        assert(bounds.bottom <= Math.min(bounds.dockTop, bounds.creditTop, bounds.height), JSON.stringify({ width, number, bounds }));
      }
      if (number < 70) {
        assert(await root.locator('.gaia-observation-reading').isVisible());
        const values = await root.locator('.gaia-observation-source-record dd').allTextContents();
        if (number <= 64) assert.deepEqual(values, [target.water, target.sourceId, target.measurement.text + ' mg/L']);
        else if (number <= 67) assert.deepEqual(values, [target.sourceId, target.industry, String(target.substances.length)]);
        else assert.deepEqual(values, [target.water, target.surveyIds.join(' / '), String(target.taxa.length)]);
        assert.equal(await page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy)').getAttribute('data-metric-value'), String(measurement.value));
      } else assert.equal(await root.locator('.gaia-food-source-record dd').count(), 5);
      await page.screenshot({ path: path.join(output, `${width}-${number}-reading.png`) });
      if (width >= 900) {
        await root.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await page.screenshot({ path: path.join(output, `${width}-${number}-reading-bottom.png`) });
        await root.evaluate(el => { el.scrollTop = 0; });
      }
      await closeDetails(width);
      const food = number === 70;
      await action(width, 'データの出典', food ? '[data-food-source]' : '[data-cod-source]');
      await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
      const source = await page.evaluate(food => (food ? GaiaFoodExhibits : GaiaMarineCod).getSourceInfo().datasets[0], food);
      assert(await page.locator('#japan-data-panel a').evaluateAll((links, url) => links.some(a => a.href === url), source.url));
      await page.locator('#japan-data-close').click();
      await action(width, '統計分析', food ? '[data-food-analysis]' : '[data-cod-analysis]');
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().open);
      const stats = await page.evaluate(food => ({ state: GaiaStatisticsLab.getState(), summary: GaiaStatisticsLab.run('summary'), data: (food ? GaiaFoodExhibits : GaiaMarineCod).getStatisticsDataset() }), food);
      assert.equal(stats.state.datasetId, stats.data.id);
      assert.equal(stats.summary.stats.n, stats.data.rows.length);
      assert(Math.abs(stats.summary.stats.mean - stats.data.rows.reduce((sum, r) => sum + r.value, 0) / stats.data.rows.length) < 1e-8);
      await page.locator('#gaia-statistics-close').click();
      report.checks.push({ width, number, selection: target?.id, sourceUrl: source.url, analysisRows: stats.data.rows.length });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close(); console.log(`PASS ${width}: ${stage} exhibits 61–70`);
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw e; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
