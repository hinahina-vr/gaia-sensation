import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4485';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/annual-title-poi-2026-09-09/edge-cases');
fs.mkdirSync(output, { recursive: true });
const files = ['src/exploration/annual-poi-arrival.js', 'src/exploration/marine-cod-exhibit.js', 'marine-cod-exhibit.css', 'map-chapter-navigation.css', 'gaia-mode-loader.js', 'src/exploration/index.js', 'index.html'];
const report = { status: 'running', environment: 'Local Chrome and actual bundled source data; one real request delayed 4500ms (not replaced); external requests blocked. No production or physical-device claims.',
  sha256: Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
  await context.route('https://**', r => r.abort());
  await context.route('**/data/japan-weather-temperature.json*', async r => { await new Promise(resolve => setTimeout(resolve, 4500)); await r.continue(); });
  page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  const select = number => page.evaluate(number => GaiaMapCategories.buttons().find(b => Number(b.textContent) === number).click(), number);
  const settled = () => page.waitForFunction(() => document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'complete');
  const state = () => page.evaluate(() => ({ ...GaiaMarineCod.getState(), ...document.querySelector('#gaia-marine-cod-canvas').dataset,
    separator: document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), at: performance.now(),
    separatorEnd: Number(document.querySelector('#japan-overlay').dataset.titleSeparatorCompletedAt) }));
  const project = row => page.evaluate(row => {
    const r = document.querySelector('#japan-map').getBoundingClientRect(), d = document.querySelector('#japan-overlay').dataset;
    const scale = r.width / 360 * Number(d.earthZoom);
    return { x: r.left + (r.width - 360 * scale) / 2 + Number(d.earthOffsetX) + ((row.lon - 150 + 540) % 360) * scale,
      y: r.top + (r.height - 180 * scale) / 2 + Number(d.earthOffsetY) + (90 - row.lat) * scale };
  }, row);
  await page.goto(base + '/?exhibit=31#world', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMarineCod?.getState().count > 0);
  await page.evaluate(() => GaiaMapDemo.stop()); await settled();

  await select(38);
  await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
  const pending = await state();
  assert.equal(pending.count, 0, 'Delayed actual source is still pending after separator');
  assert.equal(pending.codArrivalState, 'waiting');
  assert.equal(Number(pending.codArrivalVisibleCount), 0);
  await page.waitForFunction(() => Number(document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalVisibleCount) > 0);
  const entering = await state();
  assert.equal(entering.codArrivalState, 'running');
  assert(entering.codArrivalStartedAt > pending.separatorEnd, 'Late data still gets a fresh animation');
  const data = JSON.parse(fs.readFileSync('data/japan-weather-temperature.json', 'utf8'));
  const row = data.periods.at(-1).stations.at(-1), point = await project(row);
  const hiddenHit = await page.evaluate(({x,y}) => GaiaMarineCod.findPoiAt(x,y,'mouse'), point);
  assert.equal(hiddenHit, null, 'Unrevealed last station is not hit-testable');
  assert(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.id === 'japan-map', point));
  await page.mouse.click(point.x, point.y);
  assert.equal((await state()).selectedId, '', 'Real click on unrevealed station does not select it');
  await settled();
  const completed = await state();
  assert(completed.at - Number(entering.codArrivalStartedAt) >= 2000, 'Late source gets its full stagger');
  await page.mouse.click(point.x, point.y);
  assert.equal((await state()).selectedId, row.id, 'Same click selects the station after arrival');
  await page.screenshot({ path: path.join(output, 'late-source-selected.png') });
  await page.waitForFunction(() => document.querySelector('#japan-overlay').dataset.viewAnimation === 'idle');
  const year = page.locator('[data-cod-year]'); await year.focus(); await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(160);
  const yearChanged = await state();
  assert.equal(yearChanged.year, data.periods.at(-2).year);
  assert.equal(yearChanged.codArrivalStartedAt, completed.codArrivalStartedAt, 'Changing year does not replay arrival');
  assert.equal(yearChanged.codArrivalState, 'complete');
  report.checks.push({ check: 'late real source, hidden/arrived pointer, no year replay', pending, entering, completed, yearChanged, station: row.id });

  await select(31);
  await page.waitForFunction(() => document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'running' && Number(document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalVisibleCount) > 0);
  const interrupted = await state();
  await select(44); await page.waitForTimeout(200); await select(38);
  const switched = await state();
  assert.equal(switched.codArrivalState, 'waiting');
  assert.equal(Number(switched.codArrivalVisibleCount), 0);
  assert(switched.separator);
  assert(Number(switched.codArrivalGeneration) > Number(interrupted.codArrivalGeneration));
  await settled(); await page.waitForTimeout(300);
  const final = await state();
  assert.equal(final.id, 'japan-weather-temperature');
  assert.equal(final.count, 38);
  assert.equal(Number(final.codArrivalVisibleCount), 38);
  assert(Number(final.codArrivalStartedAt) > Number(interrupted.codArrivalStartedAt));
  await page.screenshot({ path: path.join(output, 'rapid-reselection-complete.png') });
  report.checks.push({ check: '31 interrupted while arriving, 44 superseded during separator, 38 fresh complete', interrupted, switched, final });
  assert.deepEqual(report.errors, []); report.status = 'passed';
  console.log('PASS late original data, hidden/arrived real pointer, no year replay, rapid reselection and fresh arrival');
} catch (e) { report.status = 'failed'; report.failure = e.stack; if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw e; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
