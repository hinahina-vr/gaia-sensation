import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4486';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/performance-high-2026-09-09/regression');
fs.mkdirSync(output, { recursive: true });
const files = ['app.js', 'gaia-mode-loader.js', 'index.html', 'map-legend-drag.js', 'src/data/snapshot-store.js',
  'src/exploration/index.js', 'src/exploration/marine-cod-exhibit.js', 'src/exploration/estat-exhibits.js',
  'src/exploration/firms-exhibit.js', 'src/exploration/map-demo.js', 'src/exploration/map-demo-controller.js'];
const report = { status: 'running', conditions: 'Local real bundled data, HTTPS blocked. Explicit failure/delay cases are fault injection, not live services. Desktop and mobile Chromium, not physical phones.',
  sha256: Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const record = (check, detail = {}) => { report.checks.push({ check, ...detail }); console.log('PASS ' + check); };
const select = n => page.evaluate(n => GaiaMapCategories.buttons().find(b => Number(b.textContent) === n).click(), n);
const annualReady = n => page.waitForFunction(n => Number(globalThis.GaiaMarineCod?.definition.number) === n && GaiaMarineCod.getState().dataState === 'ready', n);
const settle = () => page.waitForFunction(() => document.querySelector('#japan-overlay').dataset.viewAnimation === 'idle' && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
const contextFor = async (width = 1440) => {
  const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'no-preference' });
  await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
  await context.route('https://**', r => r.abort());
  page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('pageerror', e => report.errors.push(e.message));
  return context;
};
try {
  for (const width of [1440, 390]) {
    const context = await contextFor(width), requests = [];
    page.on('request', r => requests.push(new URL(r.url()).pathname));
    await page.goto(base + '/?exhibit=31#world', { waitUntil: 'domcontentloaded' });
    await annualReady(31); await page.waitForFunction(() => globalThis.GaiaMapDemo); await page.evaluate(() => GaiaMapDemo.stop()); await settle();
    const unwanted = requests.filter(s => /\/runtime\/|statistics-.*\.js$|estat-prefecture-series|gaia-estat-choropleth|firms-active-fire-snapshot|analysis-mizu/.test(s));
    assert.deepEqual(unwanted, [], '31 entry does not fetch unrelated mode data or the analysis runtime');
    assert.equal(await page.evaluate(() => typeof globalThis.GaiaStatisticsLab), 'undefined');
    record(width + ': first entry only loads its selected observation provider', { requestCount: requests.length });

    await select(63); await annualReady(63); await settle();
    const source = JSON.parse(fs.readFileSync('data/japan-water-las.json', 'utf8'));
    const rows = source.periods.at(-1).stations;
    assert.equal((await page.evaluate(() => GaiaMarineCod.getState())).count, rows.length);
    assert.equal(await page.locator('[data-cod-station] option').count(), 1);
    const codes = [...new Set(rows.map(r => r.prefCode))].sort();
    for (const code of codes) {
      await page.locator('[data-cod-prefecture]').selectOption(code);
      const ids = await page.locator('[data-cod-station] option').evaluateAll(nodes => nodes.map(n => n.value).filter(Boolean));
      assert.deepEqual(ids, rows.filter(r => r.prefCode === code).map(r => r.id), 'Every original regional ID, including missing data, remains selectable');
    }
    const missing = rows.find(r => r.measurement.value === null);
    await page.locator('[data-cod-prefecture]').selectOption(missing.prefCode);
    await page.locator('[data-cod-station]').selectOption(missing.id);
    assert((await page.locator('[data-cod-value]').innerText()).includes(missing.measurement.text));
    await page.locator('[data-cod-prefecture]').selectOption('all');
    record(width + ': all ' + rows.length + ' map points and ' + codes.length + ' regional menus preserve source IDs and missing readings');

    await select(38); await annualReady(38); await settle();
    await page.evaluate(() => { globalThis.__oldOptions = [...document.querySelector('[data-cod-station]').options]; });
    await page.locator('[data-cod-year]').focus(); await page.keyboard.press('ArrowLeft');
    assert(await page.evaluate(() => __oldOptions.every((n, i) => document.querySelector('[data-cod-station]').options[i] === n)), 'Stable IDs keep the same DOM options across years');
    const temperature = JSON.parse(fs.readFileSync('data/japan-weather-temperature.json', 'utf8'));
    const point = temperature.periods.at(-2).stations.find(r => r.measurement.value !== null);
    await page.locator('[data-cod-station]').selectOption(point.id); await settle();
    assert((await page.locator('[data-cod-value]').innerText()).includes(point.measurement.text));
    if (width < 900) {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.locator('#map-mobile-sheet').getByRole('button', { name: '統計分析', exact: true }).click();
    } else await page.locator('[data-cod-analysis]').click();
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady);
    assert(requests.some(s => s.endsWith('/statistics-lab.js')));
    assert.equal(new Set(requests.filter(s => /\/runtime\/.+\.[a-f\d]{16}\.json$/.test(s))).size, 10);
    const analysis = await page.evaluate(() => GaiaStatisticsLab.getState());
    assert(analysis.datasetId.includes(point.id), 'Analysis receives the actual selected station');
    await page.screenshot({ path: path.join(output, width + '-lazy-analysis.png') });
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().open), false);
    assert.equal((await page.evaluate(() => GaiaMarineCod.getState())).selectedId, point.id);
    record(width + ': stable year options, lazy analysis of original station, complete snapshot for analysis and return', { analysis });

    const viewportChecks = [];
    for (const size of [{ width, height: width < 900 ? 844 : 900 }, { width: width < 900 ? 844 : 1200, height: 650 }]) {
      await page.setViewportSize(size); await page.waitForTimeout(200);
      const rects = await page.evaluate(() => ({ cached: GaiaMapObservationAdapter.getViewportRect().toJSON(), actual: document.querySelector('#japan-map').getBoundingClientRect().toJSON() }));
      for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(rects.cached[key] - rects.actual[key]) < 1, key + ' updates after resize');
      viewportChecks.push(rects);
    }
    record(width + ': cached viewport follows portrait/landscape resize', { viewportChecks });
    await context.close();
  }

  {
    const context = await contextFor(), requests = [];
    page.on('request', r => requests.push(new URL(r.url()).pathname));
    await page.goto(base + '/?exhibit=6#world', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMapObservationAdapter?.getState().signalReady);
    await page.evaluate(() => GaiaMapDemo.stop());
    assert.equal(new Set(requests.filter(s => /\/runtime\/.+\.[a-f\d]{16}\.json$/.test(s))).size, 1, 'Direct default renderer still loads exactly one chunk');
    const modes = await page.evaluate(() => GaiaAppContent.modes.map((m, index) => ({ id: m.dataModeId || m.id, index })));
    for (const mode of modes) {
      await page.evaluate(index => GaiaMapObservationAdapter.selectMode(index), mode.index);
      await page.waitForFunction(() => GaiaMapObservationAdapter.getState().signalReady);
      assert(requests.some(s => s.includes('/' + mode.id + '.')), 'Selected base renderer loads its own source ' + mode.id);
    }
    const actual = await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    const expected = JSON.parse(fs.readFileSync('data/gaia-signals.json', 'utf8'));
    // Rendering memoizes a mean on CO2 frames. Verify all original fields and
    // array ordering without treating that extra derived cache as source data.
    const originalFieldsEqual = (value, source, location = '') => {
      if (Array.isArray(source)) {
        assert.equal(value.length, source.length, location + '.length');
        source.forEach((item, index) => originalFieldsEqual(value[index], item, location + '[' + index + ']'));
      } else if (source && typeof source === 'object') {
        for (const [key, item] of Object.entries(source)) originalFieldsEqual(value[key], item, location + '.' + key);
        for (const key of Object.keys(value)) assert(Object.hasOwn(source, key) || key === 'meanPpm', 'Unexpected non-source field ' + location + '.' + key);
      } else assert.equal(value, source, location);
    };
    originalFieldsEqual(actual.modes.slice().sort((a,b) => a.id.localeCompare(b.id)), expected.modes.slice().sort((a,b) => a.id.localeCompare(b.id)));
    record('Direct 06, all base renderers and complete analysis snapshot preserve every original value');
    await context.close();
  }

  {
    const context = await contextFor();
    // Delay the actual response, not its contents; its 15-second guard stays on.
    await context.route('**/data/japan-marine-ph.json*', async route => { await new Promise(r => setTimeout(r, 10000)); await route.continue().catch(() => {}); });
    await page.goto(base + '/?exhibit=31#world', { waitUntil: 'domcontentloaded' });
    await annualReady(31); await page.waitForFunction(() => globalThis.GaiaMapDemo); await page.evaluate(() => { GaiaMapDemo.stop(); GaiaMapDemo.start(); });
    await page.waitForFunction(() => GaiaMarineCod.definition.number === '32' && GaiaMarineCod.getState().dataState === 'loading');
    const pending = await page.evaluate(() => GaiaMapDemo.getState());
    assert(pending.active && pending.paused); assert(pending.remainingMs > 24900, 'Next chapter gets full countdown before it pauses');
    await page.waitForTimeout(6000);
    assert.equal(await page.evaluate(() => GaiaMarineCod.definition.number), '32');
    await annualReady(32);
    const ready = await page.evaluate(() => GaiaMapDemo.getState());
    assert(ready.active && !ready.paused && ready.remainingMs > 24000);
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => GaiaMarineCod.definition.number), '32', 'Ready data is not immediately skipped');
    await page.mouse.click(700, 400);
    assert.equal(await page.evaluate(() => GaiaMapDemo.getState().active), false, 'Real input still cancels the demo');
    record('Real delayed next-chapter load pauses demo and resumes a full 25 seconds; real input stops it', { pending, ready });
    await context.close();
  }

  {
    const context = await contextFor();
    await context.route('**/data/japan-marine-cod.json*', route => route.abort('failed'));
    await page.goto(base + '/?exhibit=31#world', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMarineCod?.getState().dataState === 'error');
    assert.equal(await page.evaluate(() => GaiaMapDemo.getState().active), false);
    assert(await page.locator('[data-cod-status]').innerText().then(s => s.includes('再試行')));
    await context.unroute('**/data/japan-marine-cod.json*');
    await page.evaluate(() => GaiaMarineCod.select()); await annualReady(31);
    assert.equal(await page.evaluate(() => GaiaMarineCod.getState().count), 2042);
    record('Injected annual request failure stops demo and explicit retry restores actual data');
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
