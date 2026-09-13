import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { FOOD_EXHIBITS, foodValue, foodFormat } from '../src/exploration/food-catalog.js';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/fao-food-2026-09-09/browser');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', base, note: 'Installed Chrome, local snapshots, desktop/touch emulation (not physical phones). Same-origin files are unmocked. External services blocked.', checks: [], errors: [], sha256: {} };
for (const file of ['src/exploration/food-exhibits.js', 'src/exploration/food-catalog.js', 'src/exploration/food-drawing.js', 'food-exhibits.css', 'app.js', 'map-mobile-shell.js', 'map-exhibit-categories.js', 'statistics-lab.js', 'statistics-discovery.js', ...FOOD_EXHIBITS.map(d => `data/${d.dataFile}`)]) report.sha256[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const idle = async () => {
  await page.waitForFunction(() => globalThis.GaiaFoodExhibits?.getState().dataState === 'ready' && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running' && document.querySelector('#gaia-food-canvas').dataset.foodArrivalState === 'complete');
};
const dismissWelcome = async () => {
  await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
  await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({ state:'hidden' });
};
const select = async number => {
  await page.evaluate(n => GaiaMapCategories.buttons().find(b => b.textContent.trim() === n).click(), number); await idle();
};
const action = async (kind, mobile) => {
  if (mobile) {
    await page.locator('[data-mobile-sheet="tools"]').click();
    await page.getByRole('button', { name: kind === 'source' ? 'データの出典' : '統計分析', exact: true }).last().click();
  } else await page.locator(`[data-food-${kind}]`).click();
};
try {
  const viewports = process.env.FOOD_VIEWPORTS?.split(',').map(s => s.split('x').map(Number)) || [[1440, 900], [390, 844], [320, 568], [844, 390], [3840, 2160]];
  for (const [width, height] of viewports) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: process.env.FOOD_REDUCED === '1' ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/?exhibit=70#world`, { waitUntil: 'domcontentloaded' });
    await dismissWelcome();
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 71 && globalThis.GaiaMapDemo);
    await page.evaluate(() => GaiaMapDemo.stop()); await idle();
    let savedFoodView, savedFoodDataset;
    for (const def of FOOD_EXHIBITS) {
      await select(def.number);
      const source = JSON.parse(fs.readFileSync(`data/${def.dataFile}`));
      assert.equal(await page.locator('#japan-mode-title').textContent(), def.shortTitle);
      assert.equal(await page.locator('#gaia-food-canvas').getAttribute('data-food-animation'), def.animation);
      if (width <= 380) {
        const lines = await page.locator('#japan-title').evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].length; });
        assert.equal(lines, 1, `${width}/${def.number}: narrow heading has no orphaned final character`);
      }
      await page.screenshot({ path: path.join(output, `${width}-${def.number}-overview.png`) });
      for (const series of source.series) {
        await page.locator('[data-food-series]').selectOption(series.id);
        const period = series.periods.at(-1);
        await page.locator('[data-food-year]').fill(String(series.periods.length - 1));
        await page.locator('[data-food-year]').dispatchEvent('input');
        const row = period.rows.find(row => (def.id === 'food-security' && series.id === '21035' ? foodValue(def.id, row) < 0 : foodValue(def.id, row) > 100) && source.countries.find(c => c.id === row[0] && Number.isFinite(c.lon)));
        assert(row, 'A real extreme-value record exists');
        await page.locator('[data-food-country]').selectOption(row[0]); await idle();
        assert.equal(await page.locator('[data-food-value]').textContent(), `${foodFormat(foodValue(def.id, row))} %`);
        assert.equal((await page.evaluate(() => GaiaFoodExhibits.getState())).selectedId, row[0]);
        const dataset = await page.evaluate(() => GaiaFoodExhibits.getStatisticsDataset());
        const expected = series.periods.flatMap(p => { const value = foodValue(def.id, p.rows.find(r => r[0] === row[0])); return Number.isFinite(value) ? [{ period: p.key, value }] : []; });
        assert.deepEqual(dataset.rows.map(r => ({ period: r.period, value: r.value })), expected);
        await page.locator('[data-food-year]').fill('0'); await page.locator('[data-food-year]').dispatchEvent('input');
        assert.equal((await page.evaluate(() => GaiaFoodExhibits.getState())).periodKey, series.periods[0].key);
        assert.equal((await page.evaluate(() => GaiaFoodExhibits.getState())).selectedId, row[0]);
        report.checks.push(`${width}x${height}: exhibit ${def.number}, ${series.id}, original values/periods/missing/history`);
      }
      // Earliest 1960 contains Japan only; test motion in a measured year.
      await page.locator('[data-food-year]').fill(String(source.series.at(-1).periods.length - 1));
      await page.locator('[data-food-year]').dispatchEvent('input'); await idle();
      await page.screenshot({ path: path.join(output, `${width}-${def.number}-selected.png`) });
      const bounds = await page.locator('.gaia-food-readout').boundingBox();
      assert(bounds.x >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= height + 1, 'Readout fits screen');
      const a = await page.locator('#gaia-food-canvas').evaluate(el => el.toDataURL()); await page.waitForTimeout(450);
      const b = await page.locator('#gaia-food-canvas').evaluate(el => el.toDataURL());
      if (process.env.FOOD_REDUCED === '1') assert.equal(a, b, 'Reduced-motion canvas is static'); else assert.notEqual(a, b, 'Real rendered animation changes pixels');
      // Actual map hit at the same national representative coordinate.
      const chosen = source.countries.find(c => c.id === '004');
      await page.locator('[data-food-country]').selectOption(chosen.id); await idle();
      const xy = await page.evaluate(c => {
        const r = document.querySelector('#japan-map').getBoundingClientRect(), d = document.querySelector('#japan-overlay').dataset;
        const scale = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * Number(d.earthZoom);
        return { x: r.left + (r.width - 360 * scale) / 2 + Number(d.earthOffsetX) + ((c.lon - 150 + 540) % 360) * scale,
          y: r.top + (r.height - 180 * scale) / 2 + Number(d.earthOffsetY) + (90 - c.lat) * scale };
      }, chosen);
      assert.equal(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, xy), 'japan-map', 'Country marker is not hidden by controls');
      if (mobile) await page.touchscreen.tap(xy.x, xy.y); else await page.mouse.click(xy.x, xy.y);
      assert.equal((await page.evaluate(() => GaiaFoodExhibits.getState())).selectedId, chosen.id);
      for (const control of ['series', 'country', 'year', 'play', 'overview']) {
        const reachable = await page.locator(`[data-food-${control}]`).evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
        assert(reachable, `${width}/${def.number}: ${control} reachable`);
      }
      if ([1440, 390].includes(width)) {
        const dataset = await page.evaluate(() => GaiaFoodExhibits.getStatisticsDataset());
        await action('source', mobile); await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
        assert((await page.locator('#japan-data-panel').innerText()).includes(def.signalLabel));
        await page.locator('#japan-data-close').click();
        await action('analysis', mobile);
        await page.waitForFunction(id => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().datasetId === id, dataset.id);
        assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')), dataset.rows.length);
        for (const selector of ['.gaia-food-readout', '.gaia-food-legend']) assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).visibility), 'hidden', 'Food controls do not show through the analysis surface');
        assert((await page.locator('#gaia-statistics-lab').innerText()).includes('FAO'));
        if (def.number === '70') assert((await page.locator('#gaia-statistics-kpi-quality').innerText()).includes('算出'));
        await page.screenshot({ path: path.join(output, `${width}-${def.number}-analysis.png`) });
        await page.locator('#gaia-statistics-menu-toggle').click();
        const options = page.locator('.gaia-statistics-data-options');
        if (await options.getAttribute('open') === null) await options.locator('summary').click();
        await page.locator('#gaia-statistics-view-save').click();
        const saved = await page.locator('#gaia-statistics-saved-view').inputValue();
        if (def.number === '70') { savedFoodView = saved; savedFoodDataset = dataset; }
        await page.locator('#gaia-statistics-record-filter').fill('no-match-food-qa');
        await page.locator('#gaia-statistics-saved-view').selectOption(saved); await page.locator('#gaia-statistics-view-apply').click();
        assert.equal(await page.locator('#gaia-statistics-record-filter').inputValue(), '');
        await page.locator('#gaia-statistics-menu-close').click(); await page.locator('#gaia-statistics-close').click();
        await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});
        report.checks.push(`${width}/${def.number}: actual source panel, analysis, derived/source distinction, save/restore`);
      }
      if (def.number === '70') {
        await page.locator('[data-food-country]').selectOption('392');
        const period = source.series.at(-1).periods.at(-1);
        assert.equal(await page.locator('[data-food-value]').textContent(), `${foodFormat(foodValue(def.id, period.rows.find(r => r[0] === '392')))} %`);
        assert((await page.locator('[data-food-quality]').textContent()).includes('農水省'));
        assert(!(await page.locator('[data-food-analysis]').isDisabled()));
      }
      if (mobile) {
        await page.locator('[data-mobile-sheet="reading"]').click();
        assert((await page.locator('#map-mobile-sheet').innerText()).includes('FAO'));
        await page.locator('[data-mobile-sheet-close]').click();
      }
    }
    if (savedFoodView && width === 1440) {
      await page.reload({ waitUntil: 'domcontentloaded' }); await dismissWelcome(); await idle(); await page.evaluate(() => GaiaMapDemo.stop());
      await select('71'); await page.locator('[data-food-country]').selectOption('004'); await idle(); await action('analysis', mobile);
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady);
      await page.locator('#gaia-statistics-menu-toggle').click();
      const options = page.locator('.gaia-statistics-data-options'); if (await options.getAttribute('open') === null) await options.locator('summary').click();
      await page.locator('#gaia-statistics-saved-view').selectOption(savedFoodView); await page.locator('#gaia-statistics-view-apply').click();
      await page.waitForFunction(id => GaiaStatisticsLab.getState().datasetId === id && GaiaStatisticsLab.getState().analysisReady, savedFoodDataset.id);
      assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')), savedFoodDataset.rows.length);
      await page.locator('#gaia-statistics-menu-close').click(); await page.locator('#gaia-statistics-close').click();
      report.checks.push('1440: saved food analysis reloaded from fresh page and restored original values');
    }
    // Cross-provider navigation, including old annual and base renderers.
    for (const number of ['31', '06', '70', '71']) {
      await page.evaluate(n => GaiaMapCategories.buttons().find(b => Number(b.textContent) === Number(n)).click(), number);
      await page.waitForFunction(n => document.querySelector('#japan-mode-number').textContent.trim() === n, number);
      if (Number(number) < 70) assert.equal((await page.evaluate(() => GaiaFoodExhibits.getState())).active, false); else await idle();
    }
    assert.equal(report.errors.length, 0, report.errors.join('\n'));
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log(`PASS ${width}x${height} / both food exhibits`);
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, output }));
}
