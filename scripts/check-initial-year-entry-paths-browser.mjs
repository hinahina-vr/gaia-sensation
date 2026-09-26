import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = 'artifacts/map-initial-year-2016-2026-09-26/entry-paths';
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', environment: 'Installed headless Chrome, real local snapshots with local CSP; external HTTPS blocked. Emulated mobile, not physical devices or production.', checks: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
async function contextFor(width, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, reducedMotion });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**', r => r.abort());
  return context;
}
async function open(context, url) {
  page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`${base}/${url}`, { waitUntil: 'domcontentloaded' });
}
async function secure(context) {
  assert.deepEqual(await page.evaluate(() => __securityViolations), []);
  await context.close();
}
try {
  let context = await contextFor(1440);
  await open(context, '?time=0#world-06');
  await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter?.getState().signalReady
    && GaiaMapObservationAdapter.getState().mapOpen && Number(globalThis.GaiaMapPlayback?.getState().number) === 6);
  const explicit = await page.evaluate(() => GaiaMapObservationAdapter.getState());
  assert(explicit.signalTimePosition < 10, `Explicit time=0 retains the 1958 start, not default 2016: ${explicit.signalTimePosition}`);
  report.checks.push({ path: 'explicit time=0', state: explicit }); await secure(context);

  context = await contextFor(1440, 'reduce');
  await open(context, '#world-70');
  await page.waitForFunction(() => globalThis.GaiaFoodExhibits?.getState().dataState === 'ready'
    && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
  await page.evaluate(() => GaiaMapPlayback.stop());
  const slider = page.locator('[data-food-year]');
  await slider.focus(); await slider.press('ArrowRight'); await slider.press('ArrowRight');
  assert.equal(await page.evaluate(() => GaiaFoodExhibits.getState().periodKey), '2018');
  // Actual catalog buttons exercise shared navigation, deactivation and restoration.
  for (const number of [71, 70, 31, 32]) {
    await page.evaluate(number => GaiaMapCategories.buttons()[number - 1].click(), number);
    await page.waitForFunction(number => Number(globalThis.GaiaMapPlayback?.getState().number) === number && GaiaMapPlayback.getState().ready
      && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
    await page.evaluate(() => GaiaMapPlayback.stop());
    const state = await page.evaluate(number => number >= 70 ? GaiaFoodExhibits.getState() : GaiaMarineCod.getState(), number);
    if (number === 70) assert.equal(state.periodKey, '2018', 'In-session selection survives leaving and re-entering');
    else if (number === 71) assert.equal(state.periodKey, '2015-2017');
    else assert.equal(state.year, 2016);
    report.checks.push({ path: 'catalog navigation and saved selection', number, state });
    if (number === 31) {
      await page.locator('[data-cod-year]').focus(); await page.locator('[data-cod-year]').press('ArrowRight');
      await page.waitForFunction(() => GaiaMarineCod.getState().year === 2017);
    }
  }
  await secure(context);

  context = await contextFor(1440, 'reduce');
  await open(context, '#world-15');
  await page.waitForFunction(() => Number(globalThis.GaiaMapPlayback?.getState().number) === 15 && GaiaMapPlayback.getState().ready);
  const live = await page.evaluate(() => ({ selected: GaiaLiveData.getSelectedTime(), selectedAttribute: document.querySelector('.gaia-live-exhibit-readout')?.dataset.selectedTime,
    periods: GaiaLiveData.getPeriods(GaiaLiveExhibits.definitions[0].key).filter(time => Date.parse(time) <= Date.now()).sort() }));
  // The existing live transport starts with the first available hour, then plays
  // through the latest. Historical year defaults must not affect that sequence.
  assert.equal(live.selected, live.periods[0]);
  assert.equal(live.selectedAttribute, live.selected);
  assert(Number(live.selected.slice(0, 4)) > 2016);
  report.checks.push({ path: 'live hourly sequence is unchanged', ...live }); await secure(context);

  for (const width of [1440, 390]) {
    context = await contextFor(width);
    await context.addInitScript(storyVersion => {
      const progress = { storyVersion, stepId: 'map_mode01_004', reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null,
        editorialChoice: null, reflectionIds: [], resultTone: null, demoInterest: '気候の長期変化', metCharacters: { mizuha: true, amane: true, sakuya: true },
        audio: { muted: true, volume: .37 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: 'initial-year-qa' };
      localStorage.setItem('gaiaSensewareNovel:progress', JSON.stringify(progress));
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    }, GAIA_NOVEL_STORY.storyVersion);
    await open(context, '#story');
    await page.waitForFunction(() => document.body.classList.contains('novel-mode-detour') && globalThis.GaiaMapPlayback
      && globalThis.GaiaMapObservationAdapter?.getState().signalReady);
    const first = await page.evaluate(() => GaiaMapObservationAdapter.getState());
    assert(first.signalTimePosition < 10, 'Story-owned timeline starts from its explicit 1958 opening');
    await page.waitForTimeout(1800);
    const next = await page.evaluate(() => GaiaMapObservationAdapter.getState());
    assert.equal(next.timelineHeld, false); assert(next.signalTimePosition > first.signalTimePosition);
    assert.equal(await page.locator('#gaia-map-playback-toggle').isVisible(), false);
    await page.screenshot({ path: `${output}/${width}-story.png` });
    await page.locator('#story-map-modal-skip').click();
    await page.waitForFunction(() => GaiaNovel.getState().stepId === 'map_mode01_005' && !document.body.classList.contains('novel-mode-detour'));
    report.checks.push({ path: 'saved story entry, playback and return', width, first, next }); await secure(context);
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(`PASS ${report.checks.length} entry/return/live/story checks`);
