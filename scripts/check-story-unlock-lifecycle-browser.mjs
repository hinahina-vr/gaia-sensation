import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/story-unlock-state-2026-09-10/lifecycle');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const keys = { progress: 'gaiaSensewareNovel:progress', pending: 'gaiaSensewareTrueEnd:pending:v1',
  complete: 'gaiaSensewareTrueEnd:complete:v1', reached: 'gaiaSensewareTrueEnd:reached:v1',
  manual: 'gaiaSensewareNovel:manual-saves', gallery: 'gaiaSensewareNovel:cg-gallery:v1' };
const cta = '.intro-story-return[data-primary-action="true"]';
const report = { status: 'running', base, checks: [], errors: [], violations: [], hashes: {},
  environment: 'Installed Chrome, local real files and production CSP; blocked external APIs. Isolated save fixtures then native clicks/taps. Emulated PC/mobile, not physical devices or user storage. End-to-end finishing starts from a last-narration fixture, not a full read of every chapter.' };
fs.mkdirSync(output, { recursive: true });
for (const file of ['app.js', 'novel-mode.js', 'true-end-mode.js', 'gaia-mode-loader.js', 'index.html']) {
  report.hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
let activate;
const scan = () => page.evaluate(({ keys, cta }) => ({
  destination: document.querySelector(cta)?.dataset.storyDestination,
  runtime: globalThis.GaiaNovel?.getState?.(), completion: globalThis.GaiaNovel?.getCompletionState?.(),
  stored: Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, localStorage.getItem(key)])),
  events: globalThis.__completionEvents,
}), { keys, cta });
const waitStory = () => page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible'
  && document.querySelector('#novel-text')?.dataset.revealState === 'complete'
  && document.querySelector('#novel-chapter-card')?.hidden !== false);
const waitIntro = async destination => {
  await page.locator('#intro-layer[aria-hidden="false"]').waitFor();
  if (await page.locator('#intro-entry-guide').isVisible()) await page.keyboard.press('Escape');
  await page.locator(cta).scrollIntoViewIfNeeded();
  await page.waitForFunction(({ cta, destination }) => document.querySelector(cta)?.dataset.storyDestination === destination, { cta, destination });
};
const openContext = async (name, width, height, profile) => {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, isMobile: width < 900,
    reducedMotion: 'reduce', acceptDownloads: true });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(() => {
    localStorage.setItem('gaia-senseware-bgm-muted', 'true');
    localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    globalThis.__completionEvents = 0;
    addEventListener('gaia:true-end-complete', () => globalThis.__completionEvents++);
  });
  if (profile) await context.addInitScript(value => { globalThis.GAIA_BUILD_PROFILE = value; }, profile);
  page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.errors.push({ name, message: error.message }));
  activate = selector => width < 900 ? page.locator(selector).tap() : page.locator(selector).click();
  return context;
};
const closeContext = async context => {
  report.violations.push(...await page.evaluate(() => window.__securityViolations || []));
  await context.close();
};
const finishTrueEnd = async () => {
  await page.locator('.true-end-shell').waitFor();
  const sceneCount = await page.evaluate(() => GAIA_TRUE_END_STORY.scenes.length);
  for (let index = 0; index < sceneCount; index++) {
    await page.waitForFunction(() => !document.querySelector('.true-end-shell')?.classList.contains('is-scene-separating')
      && document.querySelector('.true-end-scene-card')?.dataset.phase === 'idle');
    await activate('.true-end-skip-button');
    if (index < sceneCount - 1) await page.waitForFunction(previous => document.querySelector('.true-end-shell')?.dataset.scene !== previous,
      await page.evaluate(i => GAIA_TRUE_END_STORY.scenes[i].id, index));
  }
  await page.waitForFunction(() => document.querySelector('.true-end-finale')?.hidden === false && !document.querySelector('.true-end-finale')?.inert);
};
try {
  if (!only || only === 'matrix') {
    const candidate = { storyVersion: 13, stepId: 'festival_concept_006', clear: false, archivesUnlocked: false };
    const cases = [
      { name: 'pending-without-save', progress: null, pending: 'old', destination: 'story', clear: false },
      { name: 'unfinished-old-pending', progress: candidate, pending: 'old', destination: 'story', clear: false },
      { name: 'legacy-clear-old-pending', progress: { ...candidate, storyVersion: 12, clear: true }, pending: 'old', destination: 'story', clear: false },
      { name: 'string-false-old-pending', progress: { ...candidate, clear: 'false' }, pending: 'old', destination: 'story', clear: false },
      { name: 'malformed-save', raw: '{invalid', pending: 'old', destination: 'story', clear: false },
      { name: 'completed-no-marker', progress: { ...candidate, clear: true }, destination: 'apeironcene', clear: true },
      { name: 'both-endings-completed', progress: { ...candidate, clear: true, trueEndComplete: true }, complete: 'old', destination: 'story', clear: true },
      { name: 'new-ending-after-historic-completion', progress: { ...candidate, clear: true }, pending: 'new', complete: 'old', destination: 'apeironcene', clear: true },
    ];
    for (const fixture of cases) {
      const context = await openContext('matrix-' + fixture.name, 1440, 900);
      await context.addInitScript(({ fixture, keys }) => {
        if (fixture.progress || fixture.raw) localStorage.setItem(keys.progress, fixture.raw || JSON.stringify(fixture.progress));
        if (fixture.pending) localStorage.setItem(keys.pending, fixture.pending);
        if (fixture.complete) localStorage.setItem(keys.complete, fixture.complete);
      }, { fixture, keys });
      await page.goto(base + '/#top', { waitUntil: 'domcontentloaded' });
      await waitIntro(fixture.destination);
      const cold = await scan();
      assert.equal(cold.runtime, undefined, 'Cold entry is verified before story runtime is loaded');
      await page.evaluate(() => GaiaModeLoader.load('story'));
      const loaded = await scan();
      assert.equal(loaded.completion.mainEndingComplete, fixture.clear);
      report.checks.push({ check: 'cold and lazy-loaded completion agree: ' + fixture.name, cold, loaded });
      await closeContext(context);
      console.log('PASS matrix ' + fixture.name);
    }
  }
  for (const [name, width, height] of [['pc', 1440, 900], ['mobile', 390, 844]].filter(v => !only || only === v[0])) {
    const context = await openContext(name, width, height);
    await page.goto(base + '/story', { waitUntil: 'domcontentloaded' });
    await waitStory();
    assert.equal(await page.evaluate(() => GaiaNovel.buildProfile), 'release');
    assert.equal(await page.locator('button.novel-jump-item[data-scene-id="true-end"]').count(), 0);
    // Actual early SAVE; never delete this record during restart/clear reconciliation.
    await activate('#novel-save-button');
    await activate('.novel-save-slot[data-slot-index="0"]');
    await activate('#novel-save-close');
    const early = await scan();
    assert.equal(JSON.parse(early.stored.manual)[0].progress.clear, false);
    assert.equal(early.runtime.clear, false);
    // A normal auto-save immediately before credits, not a clear flag or debug jump.
    await page.evaluate(keys => {
      const progress = GaiaNovel.getState();
      Object.assign(progress, { stepId: 'welcome_chat_094', clear: false, archivesUnlocked: false,
        trueEndComplete: false, sessionId: 'legitimate-final-narration' });
      localStorage.setItem(keys.progress, JSON.stringify(progress));
    }, keys);
    await page.goto(base + '/story', { waitUntil: 'domcontentloaded' });
    await waitStory();
    assert.equal((await scan()).runtime.clear, false);
    for (let i = 0; i < 8 && !await page.locator('.novel-staff-roll-data-skip').isVisible(); i++) {
      await activate('#novel-dialogue');
      await page.waitForTimeout(450);
    }
    await page.locator('.novel-staff-roll-data-skip').waitFor();
    const credits = await scan();
    assert.equal(credits.runtime.clear, true);
    assert(credits.stored.pending);
    await activate('.novel-staff-roll-data-skip');
    await waitIntro('apeironcene');
    await page.screenshot({ path: path.join(output, name + '-legitimate-unlock.png') });
    await activate(cta);
    await page.locator('.true-end-shell').waitFor();
    const launched = await scan();
    assert.equal(launched.runtime.sessionId, 'legitimate-final-narration');
    assert.equal(launched.runtime.stepId, 'welcome_chat_095');
    await finishTrueEnd();
    const completed = await scan();
    assert(completed.stored.complete);
    assert(completed.stored.reached);
    assert.equal(completed.stored.pending, null);
    assert.equal(completed.runtime.trueEndComplete, true);
    assert.equal(completed.events, 1);
    assert.deepEqual(JSON.parse(completed.stored.manual), JSON.parse(early.stored.manual));
    await page.screenshot({ path: path.join(output, name + '-legitimate-finale.png') });
    await activate('.true-end-finale button');
    await waitIntro('story');
    report.checks.push({ name, check: 'native final narration → credits → unlocked CTA → APEIRONCENE finale → main-story entry; early save preserved', credits, launched, completed });
    // Earlier SAVE/LOAD must remove a stale post-credits marker, retaining history and gallery.
    await activate(cta);
    await waitStory();
    await page.evaluate(keys => localStorage.setItem(keys.pending, 'stale-before-early-load'), keys);
    const galleryBeforeLoad = (await scan()).stored.gallery;
    await activate('#novel-load-button');
    await activate('.novel-save-slot[data-slot-index="0"]');
    await waitStory();
    const loaded = await scan();
    assert.equal(loaded.runtime.clear, false);
    assert.equal(loaded.runtime.stepId, JSON.parse(early.stored.manual)[0].progress.stepId);
    assert.equal(loaded.stored.pending, null);
    assert.equal(loaded.stored.complete, completed.stored.complete);
    assert.equal(loaded.stored.gallery, galleryBeforeLoad);
    assert.deepEqual(JSON.parse(loaded.stored.manual), JSON.parse(early.stored.manual));
    // Export from the real LOG download control after a save/load cycle.
    await activate('#novel-log-button');
    const downloaded = page.waitForEvent('download');
    await activate('#novel-log-script-export');
    const download = await downloaded;
    const downloadPath = path.join(output, name + '-' + download.suggestedFilename());
    await download.saveAs(downloadPath);
    assert(fs.readFileSync(downloadPath, 'utf8').includes('惑星の放課後'));
    await page.keyboard.press('Escape');
    await activate('#novel-home-button');
    await waitIntro('story');
    await page.screenshot({ path: path.join(output, name + '-early-load-main-story.png') });
    report.checks.push({ name, check: 'native SAVE/LOAD and LOG export; unfinished entry, manual slots, gallery and historic completion preserved', loaded, download: path.basename(downloadPath) });
    await closeContext(context);

    // Separate genuinely unfinished storage for developer chapter previews.
    const debugContext = await openContext(name + '-debug', width, height, 'debug');
    await page.goto(base + '/story', { waitUntil: 'domcontentloaded' });
    await waitStory();
    const debugBaseline = await scan();
    await activate('#novel-jump-button');
    await activate('button.novel-jump-item[data-scene-id="ending"]');
    await page.locator('.novel-staff-roll-data-skip').waitFor();
    const previewCredits = await scan();
    assert.equal(previewCredits.runtime.clear, false);
    assert.equal(previewCredits.stored.progress, debugBaseline.stored.progress);
    assert.equal(previewCredits.stored.pending, null);
    await activate('.novel-staff-roll-data-skip');
    await waitIntro('story');
    await activate(cta);
    await waitStory();
    const previewBaseline = await scan();
    await activate('#novel-jump-button');
    await activate('button.novel-jump-item[data-scene-id="true-end"]');
    await finishTrueEnd();
    const previewFinale = await scan();
    assert.equal(previewFinale.runtime.clear, false);
    assert.equal(previewFinale.completion.mainEndingComplete, false);
    assert.equal(previewFinale.stored.progress, previewBaseline.stored.progress);
    for (const marker of ['pending', 'complete', 'reached']) assert.equal(previewFinale.stored[marker], null);
    assert.equal(previewFinale.events, 0);
    await activate('.true-end-finale button');
    await waitIntro('story');
    await page.screenshot({ path: path.join(output, name + '-preview-stays-locked.png') });
    report.checks.push({ name, check: 'native ending and APEIRONCENE chapter previews do not clear, persist completion, or unlock CTA', previewCredits, previewFinale });
    await closeContext(debugContext);
    console.log('PASS lifecycle ' + name);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.violations, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  report.lastState = await scan().catch(() => null);
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
