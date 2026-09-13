import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/story-map-handoff-expression-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, {recursive: true});
const files = ['novel-mode.js', 'novel-story-data.js', 'gaia-mode-loader.js', 'index.html', 'assets/characters/amane-calm-07-v3.png'];
const hashes = () => Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report = {status: 'running', hashes: hashes(), checks: [], errors: [], missing: [],
  scope: 'Installed Chrome, local repository images and production CSP. Isolated seeded progress then native dialogue/save/load input; mobile viewport/touch emulation, not physical devices. External HTTPS blocked.'};
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const scan = () => page.evaluate(() => {
  const figure = document.querySelector('#novel-character-sora');
  const portrait = figure.querySelector('.novel-character-portrait:not(.novel-character-portrait--previous)');
  const previous = figure.querySelector('.novel-character-portrait--previous');
  const textBox = document.querySelector('#novel-text').getBoundingClientRect();
  const scrollContainers = [];
  for (let node = document.querySelector('#novel-text'); node; node = node.parentElement) {
    if (node.scrollLeft || node.scrollTop) scrollContainers.push({id: node.id, className: node.className, x: node.scrollLeft, y: node.scrollTop});
  }
  return {step: document.querySelector('#novel-layer').dataset.stepId, text: document.querySelector('#novel-text').textContent,
    expression: figure.dataset.expression, image: getComputedStyle(portrait).backgroundImage,
    textBox: {x: textBox.x, y: textBox.y, right: textBox.right, bottom: textBox.bottom}, scroll: {x: scrollX, y: scrollY},
    scrollContainers,
    previousOpacity: previous ? Number(getComputedStyle(previous).opacity) : 0};
});
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const mobile = width < 900;
    const context = await browser.newContext({viewport: {width, height}, hasTouch: mobile, isMobile: mobile, reducedMotion: 'no-preference'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(storyVersion => {
      const key = 'gaiaSensewareNovel:progress';
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({storyVersion, stepId: 'map_mode01_013',
        reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null,
        demoInterest: '気候の長期変化', metCharacters: {mizuha: true, amane: true, sakuya: true}, audio: {muted: true, volume: 0},
        readStepIds: [], clear: false, archivesUnlocked: false, sessionId: 'map-handoff-expression-qa'}));
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({messageSpeedPercent: 400, reducedMotion: false}));
    }, GAIA_NOVEL_STORY.storyVersion);
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => {if (response.status() === 404) report.missing.push(response.url());});
    const activate = async selector => {
      // Tap the visible dialogue text, not the oversized dialogue container.
      // Locator auto-scrolling can move its overflow-hidden ancestors in ways a
      // user tapping the visible screen cannot.
      if (selector === '#novel-dialogue') {
        await page.waitForFunction(() => {
          const box = document.querySelector('#novel-text').getBoundingClientRect();
          return Boolean(document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2)?.closest('#novel-dialogue'));
        });
        const point = await page.locator('#novel-text').evaluate(node => {
          const box = node.getBoundingClientRect();
          const x = (box.left + box.right) / 2;
          const y = (box.top + box.bottom) / 2;
          const hit = document.elementFromPoint(x, y);
          return {x, y, hit: Boolean(hit?.closest('#novel-dialogue')), hitId: hit?.id, hitClass: hit?.className};
        });
        assert(point.hit, `Visible dialogue must be available to a real screen tap: ${JSON.stringify({point, scan: await scan()})}`);
        return mobile ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y);
      }
      return mobile ? page.locator(selector).tap() : page.locator(selector).click();
    };
    const waitStep = id => page.waitForFunction(id => document.querySelector('#novel-layer')?.dataset.stepId === id
      && document.querySelector('#novel-layer').dataset.entryTransition === 'visible'
      && document.querySelector('#novel-layer').dataset.runtimeReveal === 'revealed'
      && document.querySelector('#novel-layer').getAttribute('aria-busy') !== 'true'
      && document.querySelector('#novel-text').dataset.revealState === 'complete', id);
    const advanceTo = async id => {
      for (let count = 0; count < 24 && (await scan()).step !== id; count++) {
        await activate('#novel-dialogue'); await page.waitForTimeout(140);
      }
      await waitStep(id);
    };
    await page.goto(`${base}/#story`, {waitUntil: 'domcontentloaded'});
    await waitStep('map_mode01_013');
    await page.locator('#gaia-boot').waitFor({state: 'hidden'});
    await advanceTo('map_mode01_016');
    await page.waitForFunction(() => document.querySelector('#novel-text').textContent.includes('ほいじゃ、次お願い'));
    await page.waitForTimeout(650);
    const handoff = await scan();
    assert(handoff.textBox.x >= 0 && handoff.textBox.y > height * 0.4 && handoff.textBox.right <= width + 1 && handoff.textBox.bottom <= height + 1,
      'The actual dialogue must remain in the lower part of the viewport');
    assert.deepEqual(handoff.scrollContainers, [], 'Native dialogue input must not scroll the stage');
    assert.equal(handoff.expression, before ? 'startled' : 'calm');
    assert(handoff.image.includes(before ? 'amane-startled-07-v3.png' : 'amane-calm-07-v3.png'));
    assert.equal(handoff.previousOpacity, 0);
    const decoded = await page.evaluate(async () => {
      const style = getComputedStyle(document.querySelector('#novel-character-sora .novel-character-portrait:not(.novel-character-portrait--previous)')).backgroundImage;
      const url = style.match(/url\(["']?(.*?)["']?\)/)[1];
      const image = new Image(); image.src = url; await image.decode(); return {width: image.naturalWidth, height: image.naturalHeight};
    });
    assert(decoded.width > 0 && decoded.height > 0);
    await page.screenshot({path: path.join(output, `${width}-handoff.png`)});
    report.checks.push({width, phase: before ? 'reproduced' : 'fixed', ...handoff, decoded});
    if (!before) {
      await activate('#novel-save-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await activate('#novel-save-close');
      await advanceTo('map_mode01_017');
      assert.equal(await page.locator('#novel-character-minamo').getAttribute('data-expression'), 'teasing');
      await advanceTo('map_mode01_018');
      assert.equal((await scan()).expression, 'exasperated');
      await activate('#novel-load-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await waitStep('map_mode01_016');
      // Load updates the step metadata before the presentation is repainted.
      await page.waitForFunction(() => document.querySelector('#novel-text').textContent.includes('ほいじゃ、次お願い')
        && document.querySelector('#novel-character-sora').dataset.expression === 'calm');
      assert.equal((await scan()).expression, 'calm');
      await page.reload({waitUntil: 'domcontentloaded'});
      await waitStep('map_mode01_016');
      await page.locator('#gaia-boot').waitFor({state: 'hidden'});
      await page.waitForTimeout(650);
      const restored = await scan();
      assert(restored.textBox.y > height * 0.4 && restored.textBox.bottom <= height + 1);
      assert.deepEqual(restored.scrollContainers, []);
      assert.equal(restored.expression, 'calm');
      assert(restored.image.includes('amane-calm-07-v3.png'));
      assert.equal(restored.previousOpacity, 0);
      await page.screenshot({path: path.join(output, `${width}-restored.png`)});
      report.checks.push({width, phase: 'following speakers, native save/load and page reload', ...restored});
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close(); console.log('PASS handoff expression', width, before ? 'before' : 'after');
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(hashes(), report.hashes);
  report.status = before ? 'recorded' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({path: path.join(output, 'failure.png')}).catch(() => {}); throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
