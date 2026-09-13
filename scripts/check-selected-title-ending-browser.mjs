import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const quick = process.argv.includes('--quick');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/selected-title-ending-2026-09-10/${only ? `focused-${only}` : quick ? 'preview' : 'after'}`);
fs.mkdirSync(output, {recursive: true});
const titleArt = 'assets/title-candidates-20260909/01-starlit-observatory.webp';
const endingArt = 'assets/ending-candidates-20260909/01-turning-in-the-sunset.webp';
const report = {status: 'running', base, checks: [], errors: [], missing: [], sha256: {},
  environment: 'Installed Chrome, real same-origin media, blocked external APIs. Native UI with a seeded ending save in isolated browser storage; emulated screen/touch, not physical devices. HTTPS headers are unmodified.'};
for (const file of ['opening.css', 'novel-background-cues.js', 'novel-mode.css', 'character-mode.js', 'sound-mode.js', 'gaia-mode-loader.js', 'index.html', titleArt, endingArt]) {
  report.sha256[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
let page;
const waitStory = id => page.waitForFunction(id => {
  const layer = document.querySelector('#novel-layer');
  return layer?.dataset.stepId === id && layer.dataset.entryTransition === 'visible' && !layer.classList.contains('is-background-transitioning');
}, id, {timeout: 30000});
const decode = file => page.evaluate(async file => {
  const image = new Image(); image.src = '/' + file; await image.decode();
  return {width: image.naturalWidth, height: image.naturalHeight};
}, file);
const scanTitle = () => page.evaluate(() => {
  const photo = document.querySelector('.gaia-vn-final-photo'), style = getComputedStyle(photo);
  return {background: style.backgroundImage, position: style.backgroundPosition, size: style.backgroundSize,
    quality: document.documentElement.dataset.gaiaArtworkQuality,
    logo: document.querySelector('.gaia-vn-work-logo').getBoundingClientRect().toJSON(),
    overflow: document.documentElement.scrollWidth - innerWidth,
    actions: [...document.querySelectorAll('#gaia-opening-final-menu .gaia-opening-route')].map(button => {
      const rect = button.getBoundingClientRect();
      return {id: button.id, rect: rect.toJSON(), disabled: button.disabled,
        hit: button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))};
    })};
});
const scanEnding = () => page.evaluate(() => {
  const layer = document.querySelector('#novel-layer'), style = getComputedStyle(layer);
  return {step: layer.dataset.stepId, cue: layer.dataset.backgroundCue, background: style.backgroundImage,
    position: style.backgroundPosition, size: style.backgroundSize, rect: layer.getBoundingClientRect().toJSON(),
    text: document.querySelector('#novel-text')?.getAttribute('aria-label'),
    dialogue: document.querySelector('#novel-dialogue').getBoundingClientRect().toJSON(),
    overflow: document.documentElement.scrollWidth - innerWidth};
});
try {
  const viewports = (quick ? [[1440, 900], [390, 844]] : [[1440, 900], [3840, 2160], [2560, 1080], [390, 844], [320, 568], [844, 390], [568, 320]]).filter(([width]) => !only || String(width) === only);
  assert(viewports.length > 0);
  for (const [width, height] of viewports) {
    const mobile = width <= 900;
    const context = await browser.newContext({viewport: {width, height}, reducedMotion: 'reduce', hasTouch: mobile, isMobile: mobile});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({messageSpeedPercent: 400, reducedMotion: true}));
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({width, message: error.message}));
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    const activate = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await activate('#gaia-opening-sound-off');
    // Reduced motion lands on the menu without the opening-film Skip action.
    await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    await page.waitForFunction(() => [...document.querySelectorAll('#gaia-opening-final-menu .gaia-opening-route')].every(button => {
      const rect = button.getBoundingClientRect();
      return !button.disabled && !button.closest('[inert]') && button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }));
    assert.deepEqual(await decode(titleArt), {width: 1672, height: 941});
    await page.evaluate(() => document.fonts.ready);
    // The real mobile introduction opens after the menu; close it with Escape.
    if (mobile) {
      await page.locator('#gaia-opening-route-guide.is-visible').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#gaia-opening-route-guide').waitFor({state: 'hidden'});
    }
    await page.waitForTimeout(1000);
    const title = await scanTitle();
    assert(title.background.includes(titleArt));
    assert.equal(title.overflow, 0);
    assert(title.logo.top >= 0 && title.logo.bottom <= height, 'The complete title logo stays inside the viewport');
    assert(title.actions.length >= 2);
    for (const action of title.actions) {
      assert(action.hit && !action.disabled && action.rect.width >= 44 && action.rect.height >= 44, JSON.stringify(action));
      assert(action.rect.left >= 0 && action.rect.right <= width && action.rect.top >= 0 && action.rect.bottom <= height);
    }
    await page.screenshot({path: path.join(output, `${width}-title.png`), animations: 'disabled'});
    report.checks.push({width, phase: 'fresh title', title});
    if ([1440, 390].includes(width)) {
      await activate('#gaia-opening-route-story');
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      const enter = page.locator('#gaia-story-prologue button').first();
      if (mobile) await enter.tap(); else await enter.click();
      await waitStory('festival_concept_001');
      report.checks.push({width, phase: 'native title→prologue→first scene'});
    } else await page.evaluate(() => GaiaModeLoader.load('story'));
    // Seed only the starting location, then use real save/load and progression.
    await page.evaluate(() => {
      const state = GaiaNovel.getState();
      Object.assign(state, {stepId: 'welcome_chat_new_025', clear: false, archivesUnlocked: false, readStepIds: ['welcome_chat_094'], reachedSceneIds: ['welcome_chat']});
      localStorage.setItem(GaiaNovel.storageKey, JSON.stringify(state));
    });
    await page.goto(base + '/story', {waitUntil: 'domcontentloaded'});
    await waitStory('welcome_chat_new_025');
    await page.locator('#gaia-boot').waitFor({state: 'hidden'});
    assert.deepEqual(await decode(endingArt), {width: 1672, height: 941});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const ending = await scanEnding();
    assert(ending.background.includes(endingArt));
    assert.equal(ending.overflow, 0);
    if (width <= 960 && width > height) assert(ending.dialogue.top >= height * .46, 'Landscape ending leaves both faces above the dialogue');
    await page.screenshot({path: path.join(output, `${width}-ending.png`)});
    report.checks.push({width, phase: 'ending scene', ending});
    if (!quick) {
      await activate('#novel-save-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gaiaSensewareNovel:manual-saves'))[0].progress.stepId), 'welcome_chat_new_025');
      await activate('#novel-save-close');
      await activate('#novel-load-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await waitStory('welcome_chat_new_025');
      assert((await scanEnding()).background.includes(endingArt));
      // The in-story CG button was intentionally removed. Keep its registry
      // consistent, and exercise the active character archive below.
      assert.equal(await page.evaluate(() => GAIA_NOVEL_BACKGROUND_CUES.gallery.find(e => e.id === 'exhibition-finale').assetPath), endingArt);
      report.checks.push({width, phase: 'native save/load; legacy CG registry consistency'});
    }
    // Advance through the actual last lines, including multi-page narration.
    for (let count = 0; count < 18; count++) {
      if (await page.locator('.novel-staff-roll').count()) break;
      await page.waitForFunction(() => !document.querySelector('#novel-layer').classList.contains('is-background-transitioning'));
      await activate('#novel-dialogue');
      await page.waitForTimeout(160);
    }
    await page.locator('.novel-staff-roll').waitFor({state: 'visible'});
    assert((await page.locator('.novel-staff-roll-stage').evaluate(e => getComputedStyle(e).backgroundImage)).includes(endingArt));
    await page.screenshot({path: path.join(output, `${width}-credits.png`)});
    await activate('.novel-staff-roll-data-skip');
    await page.locator('#intro-layer').waitFor({state: 'visible'});
    await page.evaluate(() => GaiaIntroEntryGuide?.close?.({restoreFocus: false}));
    await activate('#intro-title-return');
    await page.waitForFunction(() => !document.querySelector('#gaia-title-return-transition') && document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    assert((await scanTitle()).background.includes(titleArt));
    report.checks.push({width, phase: 'last lines→credits→data→title with selected artwork'});
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    if (width === 1440 && !quick) {
      for (const file of [titleArt, endingArt, titleArt.replace('.webp', '.png'), endingArt.replace('.webp', '.png')]) {
        const response = await page.request.get(base + '/' + file);
        assert.equal(response.status(), 200);
        const bytes = await response.body();
        assert.deepEqual(bytes, fs.readFileSync(file));
        fs.writeFileSync(path.join(output, path.basename(file)), bytes);
      }
      report.checks.push({width, phase: 'HTTP artwork downloads byte-identical to source files'});
    }
    if (!quick) {
      await page.goto(base + '/#character', {waitUntil: 'domcontentloaded'});
      await page.locator('#character-book-layer').waitFor({state: 'visible'});
      const cg = page.locator('[data-character-cg-id="exhibition-finale"]');
      await cg.scrollIntoViewIfNeeded();
      if (mobile) await cg.tap(); else await cg.click();
      await page.locator('#character-book-cg-viewer').waitFor({state: 'visible'});
      await page.locator('#character-book-cg-viewer-image').evaluate(image => image.decode());
      assert((await page.locator('#character-book-cg-viewer-image').getAttribute('src')).includes(endingArt));
      await page.screenshot({path: path.join(output, `${width}-gallery.png`)});
      report.checks.push({width, phase: 'native character archive ending CG viewer'});
    }
    await context.close();
    console.log(`PASS ${width}: selected title / ending / credits / return${quick ? ' preview' : ' and save/load/gallery'}`);
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
