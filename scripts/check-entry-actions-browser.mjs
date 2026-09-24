import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const [base = 'http://127.0.0.1:4478', directory = 'artifacts/entry-actions', filter = ''] = process.argv.slice(2);
const output = path.resolve(directory);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', base, testedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sha256: Object.fromEntries(['index.html', 'gaia-mode-loader.js', 'novel-mode.js', 'scripts/check-entry-actions-browser.mjs'].map(file => [file, createHash('sha256').update(fs.readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex')])), environment: 'Installed Chrome; fresh isolated context per case; desktop and touch emulation; UI clicks/keys only, no mode API calls or storage seeding. Local navigation receives production CSP; the slow-load case deliberately delays the original story script response without replacing its content.', cases: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const specs = [
  { name: 'desktop', width: 1440, height: 900, input: 'mouse' },
  { name: 'mobile', width: 390, height: 844, input: 'touch' },
];
let active;
async function run(name, spec, test) {
  if (filter && !new RegExp(filter).test(name)) return;
  const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, hasTouch: spec.input === 'touch', isMobile: spec.input === 'touch', reducedMotion: 'no-preference', acceptDownloads: true });
  if (!base.startsWith('https:')) await enforceBrowserSecurity(context, base);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  active = { name: `${spec.name}-${name}`, input: spec.input, status: 'running', actions: [], errors: [], failedAssets: [] };
  const result = active;
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base) && /\.(js|css|json|webp|png|svg)(\?|$)/.test(response.url())) result.failedAssets.push({ url: response.url(), status: response.status() }); });
  try {
    await test(page, spec);
    assert.deepEqual(result.errors, [], 'Uncaught JavaScript errors');
    assert.deepEqual(result.failedAssets, [], 'Failed application assets');
    if (!base.startsWith('https:')) assert.deepEqual(await page.evaluate(() => window.__securityViolations || []), [], 'CSP violations');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.failure = error.stack;
    result.state = await page.evaluate(() => ({ url: location.href, storyLoaded: globalThis.GaiaModeLoader?.isLoaded('story'), storyApi: typeof globalThis.GaiaNovel, visibleDialogs: [...document.querySelectorAll('[role="dialog"],dialog')].filter(el => el.checkVisibility()).map(el => ({ id: el.id, class: el.className })) })).catch(() => null);
  } finally {
    await page.screenshot({ path: path.join(output, `${result.name}.png`) }).catch(() => {});
    report.cases.push(result);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${result.status.toUpperCase()} ${result.name}${result.failure ? `: ${result.failure.split('\n')[0]}` : ''}`);
    await context.close();
  }
}

async function press(page, selector, spec, key) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  if (key) { await target.focus(); await page.keyboard.press(key); }
  else if (spec.input === 'touch') await target.tap();
  else await target.click();
  active.actions.push({ selector, input: key || spec.input });
}
async function dismissIntroGuide(page) {
  if (await page.locator('#intro-entry-guide').isVisible()) {
    await page.keyboard.press('Escape');
    await page.locator('#intro-entry-guide').waitFor({ state: 'hidden' });
    active.actions.push({ selector: '#intro-entry-guide', input: 'Escape' });
  }
}
async function intro(page) {
  await page.goto(`${base}/#top`, { waitUntil: 'domcontentloaded' });
  await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
  await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
  await dismissIntroGuide(page);
  assert.equal(await page.evaluate(() => GaiaModeLoader.isLoaded('story')), false, 'Cold entry must not preload story');
}
async function title(page, spec) {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await press(page, '#gaia-opening-sound-off', spec);
  await page.locator('#gaia-opening-skip').waitFor({ state: 'visible', timeout: 45000 });
  await press(page, '#gaia-opening-skip', spec);
  await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
  await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
  await page.waitForTimeout(750);
  if (await page.locator('#gaia-opening-route-guide').isVisible()) await page.keyboard.press('Escape');
}
async function storyReady(page) {
  await page.waitForFunction(() => {
    const layer = document.querySelector('#novel-layer');
    return layer?.checkVisibility() && document.body.classList.contains('novel-open') && document.querySelector('#novel-text')?.textContent.trim().length > 20;
  }, null, { timeout: 25000 });
  await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
  await page.waitForFunction(() => document.querySelector('#novel-text')?.dataset.revealState === 'complete');
  const state = await page.evaluate(() => ({ loaded: GaiaModeLoader.isLoaded('story'), stepId: document.querySelector('#novel-layer').dataset.stepId, text: document.querySelector('#novel-text').textContent, introHidden: !document.querySelector('#intro-layer')?.checkVisibility() }));
  assert(state.loaded && state.introHidden, 'Story must be visible in front, not under the intro');
  const first = await page.evaluate(() => GAIA_NOVEL_STORY.scenes[0].steps[0]);
  assert.equal(state.stepId, first.id);
  assert(state.text.length > 20 && first.text.startsWith(state.text), 'The first dialogue page must match the current story (mobile paginates it)');
  active.story = state;
}
async function footerStory(page, spec, key) {
  await press(page, '#intro-architecture-jump', spec);
  await press(page, '[data-novel-open]', spec, key);
  await storyReady(page);
}

try {
  for (const spec of specs) {
    await run('cold-footer-story', spec, async page => { await intro(page); await footerStory(page, spec); });
    await run('title-data-footer-story', spec, async page => {
      await title(page, spec);
      await press(page, '#gaia-opening-route-other', spec);
      await page.waitForFunction(() => document.querySelector('#japan-layer')?.getAttribute('aria-hidden') === 'false');
      await press(page, '[data-feature-start]', spec);
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      await press(page, '#japan-close', spec);
      await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
      await page.waitForTimeout(2600); await dismissIntroGuide(page);
      assert.equal(await page.evaluate(() => GaiaModeLoader.isLoaded('story')), false);
      await footerStory(page, spec);
    });
    await run('cold-primary-story', spec, async page => { await intro(page); await press(page, '[data-intro-path="novel"]', spec); await storyReady(page); });
    await run('title-story', spec, async page => { await title(page, spec); await press(page, '#gaia-opening-route-story', spec); await storyReady(page); });
    await run('warm-footer-story', spec, async page => {
      await intro(page); await press(page, '[data-intro-path="novel"]', spec); await storyReady(page);
      await press(page, '#novel-home-button', spec);
      await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
      await footerStory(page, spec);
    });
    const storyControls = async (page, entry) => {
      await intro(page);
      if (entry === 'footer') await footerStory(page, spec);
      else { await press(page, '[data-intro-path="novel"]', spec); await storyReady(page); }
      await press(page, '#novel-config-button', spec);
      await page.locator('#novel-config-panel').waitFor({ state: 'visible' });
      await page.locator('#novel-message-speed').focus(); await page.keyboard.press('End');
      assert.equal(await page.locator('#novel-message-speed').inputValue(), '400');
      await press(page, '#novel-reduced-motion', spec);
      assert.equal(await page.locator('#novel-reduced-motion').isChecked(), true);
      await press(page, '#novel-config-reset', spec);
      assert.equal(await page.locator('#novel-message-speed').inputValue(), '270');
      assert.equal(await page.locator('#novel-reduced-motion').isChecked(), false);
      await press(page, '#novel-config-close', spec);
      await page.locator('#novel-config-panel').waitFor({ state: 'hidden' });
      await press(page, '#novel-save-button', spec);
      await page.locator('#novel-save-slots .novel-save-primary').first().click();
      active.actions.push({ selector: '#novel-save-slots .novel-save-primary:first', input: 'click' });
      const savedStep = await page.locator('#novel-layer').getAttribute('data-step-id');
      await press(page, '#novel-save-close', spec);
      for (let advance = 0; advance < 8 && await page.locator('#novel-layer').getAttribute('data-step-id') === savedStep; advance++) {
        await press(page, '#novel-dialogue', spec);
        await page.waitForFunction(() => document.querySelector('#novel-text')?.dataset.revealState === 'complete');
        await page.waitForTimeout(180);
      }
      await page.waitForFunction(id => document.querySelector('#novel-layer').dataset.stepId !== id, savedStep);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
      await press(page, '#novel-load-button', spec);
      await page.locator('#novel-save-slots .novel-save-primary').first().click();
      await page.waitForFunction(id => document.querySelector('#novel-layer').dataset.stepId === id, savedStep);
      for (const id of ['#novel-auto-button', '#novel-fast-forward-button']) {
        await press(page, id, spec); assert.equal(await page.locator(id).getAttribute('aria-pressed'), 'true');
        await press(page, id, spec); assert.equal(await page.locator(id).getAttribute('aria-pressed'), 'false');
      }
      await press(page, '#novel-jump-button', spec);
      await page.locator('#novel-jump-panel').waitFor({ state: 'visible' });
      await press(page, '#novel-jump-close', spec);
      await page.locator('#novel-jump-panel').waitFor({ state: 'hidden' });
      await press(page, '#novel-log-button', spec);
      await page.locator('#novel-log-panel').waitFor({ state: 'visible' });
      const comment = `entry-action-regression-${spec.name}`;
      await page.locator('#novel-log-panel textarea').first().fill(comment);
      await page.locator('#novel-log-panel textarea').first().press('Tab');
      active.downloads = [];
      for (const selector of ['#novel-log-export', '#novel-log-script-export']) {
        const pending = page.waitForEvent('download');
        await press(page, selector, spec);
        const download = await pending;
        const file = path.join(output, `${spec.name}-${download.suggestedFilename()}`);
        await download.saveAs(file);
        assert.equal(await download.failure(), null);
        const content = fs.readFileSync(file, 'utf8');
        if (selector === '#novel-log-export') assert(content.includes(comment), 'Comment export must contain the text entered through the UI');
        if (selector === '#novel-log-script-export') {
          const ids = await page.evaluate(() => GAIA_NOVEL_STORY.scenes.flatMap(scene => scene.steps.map(step => step.id)));
          assert(ids.every(id => content.includes(`\`${id}\``)), 'Full script export is missing story steps');
        }
        active.downloads.push({ file, characters: content.length });
      }
      await press(page, '#novel-log-close', spec);
      await page.locator('#novel-log-panel').waitFor({ state: 'hidden' });
      await press(page, '#novel-home-button', spec);
      await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
      active.savedStep = savedStep;
    };
    await run('story-controls-save-load-export', spec, page => storyControls(page, 'primary'));
    await run('footer-story-save-load-export', spec, page => storyControls(page, 'footer'));
    await run('slow-footer-story-repeat', spec, async page => {
      let releaseScript;
      const scriptGate = new Promise(resolve => { releaseScript = resolve; });
      let scriptRequests = 0;
      await page.route('**/novel-mode.js?*', async route => {
        scriptRequests++;
        await scriptGate;
        await route.continue();
      });
      await page.addInitScript(() => {
        globalThis.__footerStoryOpenCount = 0;
        window.addEventListener('gaia:novel-open', () => { globalThis.__footerStoryOpenCount++; });
      });
      try {
        await intro(page);
        await press(page, '#intro-architecture-jump', spec);
        await press(page, '[data-novel-open]', spec);
        await page.waitForTimeout(1500);
        assert(scriptRequests > 0, 'The initial footer action must request the story script');
        const button = page.locator('[data-novel-open]');
        assert.equal(await button.getAttribute('aria-busy'), 'true');
        assert.equal(await button.getAttribute('data-gaia-lazy-pending'), 'true');
        assert.equal(await page.evaluate(() => globalThis.__footerStoryOpenCount), 0);
        for (let click = 0; click < 3; click++) await press(page, '[data-novel-open]', spec);
        releaseScript();
        await storyReady(page);
        assert.equal(await button.getAttribute('aria-busy'), null);
        assert.equal(await button.getAttribute('data-gaia-lazy-pending'), null);
        assert.equal(await page.locator('script[data-gaia-lazy-asset="script"][src*="/novel-mode.js"]').count(), 1);
        assert.equal(await page.evaluate(() => globalThis.__footerStoryOpenCount), 1, 'Repeated pending clicks must open the story exactly once');
        await press(page, '#novel-home-button', spec);
        await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
        await footerStory(page, spec);
        assert.equal(await page.evaluate(() => globalThis.__footerStoryOpenCount), 2, 'Loaded footer entry must still open exactly once');
        active.slowLoad = { minimumDelayMs: 1500, pendingClicks: 4, scriptRequests, openEvents: 2, actualResponseContent: true };
      } finally {
        releaseScript();
      }
    });
    for (const surface of [
      { name: 'map', trigger: '[data-intro-path="map"]', layer: '#japan-layer', close: '#japan-close' },
      { name: 'character', trigger: '#intro-character-jump', layer: '#character-book-layer', close: '#character-book-close' },
      { name: 'sound', trigger: '#intro-layer [data-sound-gallery-open]', layer: '#sound-layer', close: '#sound-close' },
      { name: 'gx', trigger: '#intro-gx-feature', layer: '#gx-layer', close: '#gx-modal-skip' },
    ]) await run(`cold-${surface.name}-return`, spec, async page => {
      await intro(page); await press(page, surface.trigger, spec);
      await page.locator(surface.layer).waitFor({ state: 'visible' });
      await page.waitForTimeout(1700);
      // The map now presents a title before the feature panel. Follow that
      // visible sequence instead of trying to click the map underneath it.
      if (surface.name === 'map') await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor({ state: 'visible' });
      if (await page.locator('#gaia-mode-entry-guide [data-feature-close]').isVisible()) await press(page, '#gaia-mode-entry-guide [data-feature-close]', spec);
      else if (await page.locator('#gaia-mode-entry-guide [data-mode-guide-skip]').isVisible()) await press(page, '#gaia-mode-entry-guide [data-mode-guide-skip]', spec);
      await press(page, surface.close, spec);
      await page.locator(surface.layer).waitFor({ state: 'hidden' });
      if (surface.name === 'map') await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
    });
    await run('cold-sensor-return', spec, async page => {
      await intro(page); await press(page, '[data-sensor-platform-link]', spec);
      await page.waitForURL(`${base}/sensors/#map`);
      await page.locator('.sensor-topbar').waitFor({ state: 'visible' });
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
    });
    await run('intro-guide-all-steps', spec, async page => {
      await intro(page); await press(page, '#intro-entry-guide-replay', spec);
      await page.locator('#intro-entry-guide').waitFor({ state: 'visible' });
      for (const expected of ['map', 'sensor', 'character', 'sound']) {
        await page.waitForFunction(expected => GaiaIntroEntryGuide.getState().target === expected, expected);
        await page.locator('[data-intro-entry-guide-preview]').evaluate(image => image.decode());
        await press(page, '#intro-entry-guide', spec, spec.input === 'mouse' ? 'Enter' : undefined);
      }
      await page.locator('#intro-entry-guide').waitFor({ state: 'hidden' });
      await press(page, '#intro-entry-guide-replay', spec);
      await page.locator('#intro-entry-guide').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.locator('#intro-entry-guide').waitFor({ state: 'hidden' });
    });
    await run('data-scroll-chapters-return', spec, async page => {
      await intro(page); await press(page, '#intro-lp-scroll', spec);
      await page.waitForFunction(() => document.querySelector('#intro-layer').scrollTop > 100);
      await press(page, '#intro-architecture-jump', spec);
      for (const id of ['air', 'flow', 'human', 'space']) {
        await press(page, `.data-journey-index a[href="#data-chapter-${id}"]`, spec);
        await page.waitForFunction(id => Math.abs(document.querySelector(`#data-chapter-${id}`).getBoundingClientRect().top) < 150, id);
      }
      await press(page, '#intro-architecture-back', spec);
      await page.waitForFunction(() => document.querySelector('#intro-layer').scrollTop < 2);
      await press(page, '#intro-title-return', spec);
      await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
      await page.locator('#intro-layer').waitFor({ state: 'hidden' });
    });
  }
  await run('cold-footer-story-enter', specs[0], async page => { await intro(page); await footerStory(page, specs[0], 'Enter'); });
  await run('cold-footer-story-space', specs[0], async page => { await intro(page); await footerStory(page, specs[0], 'Space'); });
} finally {
  report.status = report.cases.some(item => item.status === 'failed') ? 'failed' : 'passed';
  report.summary = { passed: report.cases.filter(item => item.status === 'passed').length, failed: report.cases.filter(item => item.status === 'failed').length };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ status: report.status, ...report.summary, report: path.join(output, 'report.json') }));
  if (report.status !== 'passed') process.exitCode = 1;
}
