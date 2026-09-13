import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/character-expression-direct-2026-09-10/${before ? 'before' : only ? only : 'after'}`);
fs.mkdirSync(output, {recursive: true});
const report = {status: 'running', base, before, checks: [], errors: [], missing: [], sha256: {},
  environment: 'Installed Chrome and real same-origin PNGs, blocked external APIs; isolated seeded story position then native clicks/taps. Viewport/touch emulation, not physical devices. HTTPS headers are unmodified.'};
for (const f of ['novel-mode.js', 'novel-mode.css', 'index.html', 'gaia-mode-loader.js']) report.sha256[f] = createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
let page;
let releaseHeldPortrait = () => {};
const scenarios = [
  {name: 'pc', width: 1440, height: 900},
  {name: 'mobile', width: 390, height: 844},
  ...before ? [] : [
    {name: 'small', width: 320, height: 568},
    {name: 'landscape', width: 844, height: 390},
    {name: 'reduced', width: 390, height: 844, reduced: true},
    {name: 'slow', width: 1440, height: 900, delayed: true},
    {name: 'slow-cancel', width: 1440, height: 900, delayed: true, cancel: true},
  ],
].filter(s => !only || s.name === only);

const scan = () => page.evaluate(() => {
  const layer = document.querySelector('#novel-layer');
  const cast = document.querySelector('#novel-cast');
  const figure = document.querySelector('#novel-character-sora');
  const current = figure.querySelector('.novel-character-portrait:not(.novel-character-portrait--previous)');
  const previous = figure.querySelector('.novel-character-portrait--previous');
  return {step: layer.dataset.stepId, expression: figure.dataset.expression,
    figureOpacity: Number(getComputedStyle(figure).opacity), castOpacity: Number(getComputedStyle(cast).opacity),
    image: getComputedStyle(current).backgroundImage, opacity: Number(getComputedStyle(current).opacity),
    animation: getComputedStyle(current).animationName,
    previousImage: previous ? getComputedStyle(previous).backgroundImage : 'none',
    previousOpacity: previous ? Number(getComputedStyle(previous).opacity) : 0,
    changing: figure.classList.contains('is-changing')};
});

try {
  for (const scenario of scenarios) {
    const mobile = scenario.width < 900;
    const context = await browser.newContext({viewport: {width: scenario.width, height: scenario.height},
      hasTouch: mobile, isMobile: mobile, reducedMotion: scenario.reduced ? 'reduce' : 'no-preference'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    let delayedRequests = 0;
    const heldPortrait = scenario.cancel ? new Promise(resolve => { releaseHeldPortrait = resolve; }) : null;
    if (scenario.delayed) await context.route('**/amane-soft-07-v3.png', async route => {
      delayedRequests++;
      if (heldPortrait) await heldPortrait;
      else await new Promise(resolve => setTimeout(resolve, 1800));
      await route.continue();
    });
    await context.addInitScript(({reduced}) => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({messageSpeedPercent: 400, reducedMotion: reduced}));
      window.__expressionFrames = [];
      const observe = () => {
        const layer = document.querySelector('#novel-layer');
        if (layer?.dataset.stepId === 'festival_concept_057') {
          const figure = document.querySelector('#novel-character-sora');
          const current = figure?.querySelector('.novel-character-portrait:not(.novel-character-portrait--previous)');
          const previous = figure?.querySelector('.novel-character-portrait--previous');
          if (current && window.__expressionFrames.length < 180) window.__expressionFrames.push({
            t: performance.now(), expression: figure.dataset.expression, figureOpacity: Number(getComputedStyle(figure).opacity),
            image: getComputedStyle(current).backgroundImage, opacity: Number(getComputedStyle(current).opacity),
            previousOpacity: previous ? Number(getComputedStyle(previous).opacity) : 0,
            animation: getComputedStyle(current).animationName,
            portraitResponseEnd: performance.getEntriesByType('resource').find(entry => entry.name.endsWith('/amane-soft-07-v3.png'))?.responseEnd || 0,
          });
        }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    }, {reduced: Boolean(scenario.reduced)});
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push({name: scenario.name, message: e.message}));
    page.on('response', r => {if (r.status() === 404) report.missing.push(r.url());});
    const activate = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    const waitStep = id => page.waitForFunction(id => {
      const layer = document.querySelector('#novel-layer');
      return layer?.dataset.stepId === id && layer.dataset.entryTransition === 'visible' && !layer.classList.contains('is-background-transitioning');
    }, id);
    await page.goto(base + '/story', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.GaiaNovel && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
    await page.evaluate(() => {
      const state = GaiaNovel.getState();
      Object.assign(state, {stepId: 'festival_concept_new_025', clear: false, readStepIds: [],
        metCharacters: {amane: true, mizuha: true, sakuya: true}});
      localStorage.setItem(GaiaNovel.storageKey, JSON.stringify(state));
    });
    await page.reload({waitUntil: 'domcontentloaded'});
    await waitStep('festival_concept_new_025');
    await page.locator('#gaia-boot').waitFor({state: 'hidden'});
    if (scenario.cancel) {
      await activate('#novel-save-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await activate('#novel-save-close');
    }
    // Finish the narration, then reach the exact line in the user's screenshot.
    for (let count = 0; count < (scenario.cancel ? 3 : 10); count++) {
      if ((await scan()).step === 'festival_concept_057') break;
      await activate('#novel-dialogue');
      if ((await scan()).step === 'festival_concept_057') break;
      await page.waitForTimeout(110);
    }
    if (scenario.cancel) {
      assert.equal((await scan()).step, 'festival_concept_new_025', 'Keep the current line while the incoming portrait is pending');
      await activate('#novel-load-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await waitStep('festival_concept_new_025');
      releaseHeldPortrait();
      await page.waitForTimeout(800);
      assert.equal((await scan()).step, 'festival_concept_new_025', 'Late image completion cannot advance the loaded save, even at the same source step');
      report.checks.push({name: scenario.name, phase: 'native load cancels pending advance; late response cannot change the loaded position'});
      for (let count = 0; count < 10 && (await scan()).step !== 'festival_concept_057'; count++) {
        await activate('#novel-dialogue');
        await page.waitForTimeout(100);
      }
    }
    await waitStep('festival_concept_057');
    const early = await scan();
    await page.screenshot({path: path.join(output, `${scenario.name}-first.png`)});
    await page.waitForTimeout(120);
    await page.screenshot({path: path.join(output, `${scenario.name}-entering.png`)});
    await page.waitForTimeout(scenario.delayed ? 2100 : 650);
    const settled = await scan();
    const frames = await page.evaluate(() => __expressionFrames);
    assert(frames.length >= 8, `${scenario.name}: capture actual rendering frames`);
    if (before) {
      assert(frames.some(f => f.figureOpacity > .05 && f.previousOpacity > .1 && f.opacity < .95), 'Reproduce the outgoing calm expression appearing before the selected soft expression');
      assert(early.previousImage.includes('amane-calm-07-v3.png'));
      assert.equal(early.animation, 'novel-expression-current-in');
    } else {
      assert(frames.every(f => f.expression === 'soft' && f.image.includes('amane-soft-07-v3.png')));
      assert(frames.every(f => f.previousOpacity === 0 && f.opacity === 1 && f.animation === 'none'), 'No outgoing portrait or expression crossfade on any frame');
      assert(frames.every(f => f.portraitResponseEnd > 0), 'The incoming PNG has arrived before presenting its line');
      assert.equal(settled.changing, false);
      if (scenario.delayed) assert(delayedRequests > 0, 'Actually delay the incoming expression PNG');
    }
    await page.screenshot({path: path.join(output, `${scenario.name}-settled.png`)});
    report.checks.push({name: scenario.name, phase: before ? 'reported glitch reproduced' : 'reported transition fixed', early, settled, frames, delayedRequests});
    if (!before) {
      // Save/load the expression through the actual controls, not a renderer call.
      await activate('#novel-save-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      if ((await page.locator('.novel-save-slot[data-slot-index="0"] .novel-save-primary').textContent()).includes('もう一度')) {
        await activate('.novel-save-slot[data-slot-index="0"]');
      }
      await activate('#novel-save-close');
      await activate('#novel-load-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await waitStep('festival_concept_057');
      assert.equal((await scan()).expression, 'soft');
      assert.equal((await scan()).previousOpacity, 0);
      for (let count = 0; count < 24; count++) {
        if ((await scan()).step === 'festival_concept_060') break;
        await activate('#novel-dialogue');
        await page.waitForTimeout(100);
      }
      await waitStep('festival_concept_060');
      const calm = await scan();
      assert.equal(calm.expression, 'calm');
      assert(calm.image.includes('amane-calm-07-v3.png'));
      assert.equal(calm.previousOpacity, 0);
      assert.equal(calm.animation, 'none');
      report.checks.push({name: scenario.name, phase: 'native save/load and following speaker/expression return', calm});
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    console.log(`PASS ${scenario.name}: ${before ? 'old-expression flash reproduced' : 'selected expression first, save/load, following dialogue'}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed'; report.failure = e.stack; process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  console.error(e);
} finally {
  releaseHeldPortrait();
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
