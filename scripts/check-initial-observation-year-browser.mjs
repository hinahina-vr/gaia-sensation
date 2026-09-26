import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { foodValue, foodFormat } from '../src/exploration/food-catalog.js';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const paintOnly = process.argv.includes('--paint-only');
const output = path.resolve(`artifacts/map-initial-year-2016-2026-09-26/${paintOnly ? 'paint' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(`data/${file}`, 'utf8'));
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', environment: 'Installed headless Chrome, desktop and emulated mobile; local CSP and actual snapshots. External HTTPS blocked. Not production.',
  hashes: Object.fromEntries(['app.js', 'src/exploration/initial-observation-year.js', 'src/exploration/marine-cod-exhibit.js',
    'src/exploration/food-exhibits.js', 'src/exploration/estat-exhibits.js', 'src/exploration/index.js', 'gaia-mode-loader.js', 'index.html']
    .map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const kindFor = n => n >= 70 ? 'food' : n >= 31 ? 'marine' : n >= 21 ? 'estat' : 'core';
const selectorFor = kind => ({ food: '[data-food-year]', marine: '[data-cod-year]', estat: '[data-estat-month]', core: '[data-signal-time]' })[kind];
const stateFor = kind => page.evaluate(kind => ({
  food: globalThis.GaiaFoodExhibits, marine: globalThis.GaiaMarineCod,
  estat: globalThis.GaiaEstatExhibits, core: globalThis.GaiaMapObservationAdapter,
})[kind].getState(), kind);
const periodFor = (kind, state) => kind === 'food' ? state.periodKey : kind === 'marine' ? String(state.year) : state.period;
async function ready(number) {
  await page.waitForFunction(({ number, kind }) => {
    if (Number(globalThis.GaiaMapPlayback?.getState().number) !== number) return false;
    if (kind === 'food') return globalThis.GaiaFoodExhibits?.getState().dataState === 'ready';
    if (kind === 'marine') return globalThis.GaiaMarineCod?.getState().dataState === 'ready';
    if (kind === 'estat') return globalThis.GaiaEstatExhibits?.getState().period === '2016';
    return globalThis.GaiaMapObservationAdapter?.getState().signalReady;
  }, { number, kind: kindFor(number) }, { timeout: 60000 });
}
try {
  const cases = (paintOnly ? [31, 70, 71] : [6, 10, 11, 14, 21, 24, 31, 38, 54, 63, 65, 68, 69, 70, 71]).map(number => ({ number, width: 1440 }));
  cases.push(...[31, 70, 71].map(number => ({ number, width: 390 })));
  for (const { number, width } of cases) {
    const kind = kindFor(number), context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, reducedMotion: kind === 'core' ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#world-${String(number).padStart(2, '0')}`, { waitUntil: 'domcontentloaded' });
    await ready(number);
    const first = await stateFor(kind), expected = number === 65 ? '2018' : number === 71 ? '2015-2017' : '2016';
    const initialSlider = page.locator(selectorFor(kind)).last();
    const slider = page.locator(`${selectorFor(kind)}:visible`).last();
    if (kind !== 'core') assert.equal(periodFor(kind, first), expected, `${width}/${number}: initial data year`);
    if (kind === 'core') {
      assert(Math.abs(Number(await initialSlider.inputValue()) - first.signalTimePosition) < .006, 'Slider matches the actual core timeline');
      if (number === 6) assert(Math.abs(1958 + 92 * first.signalTimePosition / 100 - 2016) < .1);
    } else if (kind === 'marine') {
      assert.equal(await initialSlider.inputValue(), expected);
      const { dataFile, sample, count } = await page.evaluate(() => ({ dataFile: GaiaMarineCod.definition.dataFile,
        sample: GaiaMarineCod.getCruisePoints()[0], count: GaiaMarineCod.getCruisePoints().length }));
      const source = read(dataFile), period = source.periods.find(p => p.year === Number(expected));
      const bytes = period.file && fs.readFileSync(`data/${period.file}`);
      const annual = bytes ? JSON.parse((period.file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()) : period;
      assert.equal(count, annual.stations.length, 'POI count uses the requested annual file');
      assert.deepEqual(sample, annual.stations[0], 'Real POI coordinates and measurements match the annual source');
    } else if (kind === 'food') {
      const source = read(number === 70 ? 'fao-food-balances.json' : 'fao-food-security.json');
      const series = source.series.find(s => s.id === first.seriesId), index = series.periods.findIndex(p => p.key === expected);
      assert.equal(Number(await initialSlider.inputValue()), index);
      const row = series.periods[index].rows.find(r => r[0] === first.selectedId), value = foodValue(first.id, row);
      await page.waitForFunction(text => document.querySelector('[data-food-value]').textContent === text,
        `${foodFormat(value)}${Number.isFinite(value) ? ' %' : ''}`);
    } else {
      assert.equal(Number(await initialSlider.inputValue()), first.periodIndex);
      assert.equal((await page.locator('b[data-estat-period]').textContent()).includes('2016'), true);
    }
    const auto = !paintOnly && [21, 31, 70, 71].includes(number);
    if (!auto) await page.evaluate(() => GaiaMapPlayback.stop());
    await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    if (kind === 'core' && number !== 6) {
      const key = { 10: 'emissionsSelectedYear', 11: 'earthquakeYear', 14: 'populationSelectedYear' }[number];
      await page.waitForFunction(key => document.querySelector('#japan-overlay').dataset[key] === '2016', key);
    }
    if (paintOnly) {
      await page.waitForFunction(({ kind, expected }) => {
        const d = document.querySelector(kind === 'marine' ? '#gaia-marine-cod-canvas' : '#gaia-food-canvas').dataset;
        return kind === 'marine' ? d.codPeriodYear === expected && d.codArrivalState === 'complete' && Number(d.codVisibleCount) > 0
          : d.foodFillPeriodKey === expected && d.foodArrivalState === 'complete' && Number(d.foodFilledCountryCount) > 0;
      }, { kind, expected });
    }
    await page.screenshot({ path: path.join(output, `${width}-${number}-initial.png`) });
    const check = { width, number, first, initialSlider: await slider.inputValue() };
    if (paintOnly) check.painted = await page.evaluate(kind => ({ ...document.querySelector(kind === 'marine' ? '#gaia-marine-cod-canvas' : '#gaia-food-canvas').dataset }), kind);
    if (auto) {
      const nextPeriod = number === 71 ? '2016-2018' : '2017';
      await page.waitForFunction(({ kind, expected }) => {
        const state = ({ food: globalThis.GaiaFoodExhibits, marine: globalThis.GaiaMarineCod, estat: globalThis.GaiaEstatExhibits })[kind].getState();
        return String(state.periodKey ?? state.year ?? state.period) !== expected;
      }, { kind, expected }, { timeout: 30000, polling: 50 });
      check.next = await stateFor(kind);
      assert.equal(periodFor(kind, check.next), nextPeriod, 'First actual automatic advance goes forward, never oldest');
      await page.evaluate(() => GaiaMapPlayback.stop());
      await slider.focus(); await slider.press('ArrowRight');
      const manualPeriod = number === 71 ? '2017-2019' : '2018';
      await page.waitForFunction(({ kind, expected }) => {
        const state = ({ food: globalThis.GaiaFoodExhibits, marine: globalThis.GaiaMarineCod, estat: globalThis.GaiaEstatExhibits })[kind].getState();
        return String(state.periodKey ?? state.year ?? state.period) === expected;
      }, { kind, expected: manualPeriod });
      check.manual = await stateFor(kind);
      await page.screenshot({ path: path.join(output, `${width}-${number}-manual.png`) });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    report.checks.push(check); console.log(`PASS ${width}/${number}: initial ${expected}${auto ? ', automatic next year, manual slider' : ''}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${report.checks.length} initial-year browser cases`);
