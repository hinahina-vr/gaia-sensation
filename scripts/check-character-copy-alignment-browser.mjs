import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/character-copy-alignment-20260910/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const expected = {
  lead: '四つの瞳に映る、たったひとつの地球。',
  conceptTitle: '放課後の窓辺から。',
  concept: '放課後の静けさの向こうに広がる、地球の気配。『惑星の放課後～GAIA SENSATION～』が生まれた背景と思想を綴りました。',
  scenes: [
    { id: 'first-encounter', title: 'はじめまして', poem: ['海風の抜ける通りで、ふたりと出会った。', '柔らかな秋の光のなか、物語が静かに動き出す。'] },
    { id: 'exhibition-finale', title: '夕暮れの帰り道', poem: ['展示を終えて、夕焼けに染まる海沿いを歩く。', '今日の終わりは、新しい始まり。'] },
  ],
};
const report = { status: 'running', base, before, environment: 'Installed Chrome, isolated contexts, native clicks/taps. Mobile sizes are emulated, not physical phones.', checks: [], errors: [], missing: [], hashes: {} };
for (const file of ['index.html', 'character-mode.css', 'character-mode.js', 'gaia-mode-loader.js']) {
  report.hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  const sizes = before ? [[1440, 900], [390, 844]] : [[1440, 900], [3840, 2160], [980, 1000], [390, 844], [320, 568], [844, 390]];
  for (const [width, height] of sizes) {
    const mobile = width <= 980;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.fallback() : route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) report.missing.push(response.url()); });
    const activate = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(`${base}/#character`, { waitUntil: 'domcontentloaded' });
    await page.locator('#character-book-layer.is-open').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.character-book-selector img')].every(img => img.complete && img.naturalWidth));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    const geometry = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      const texts = ['#character-book-title > span', '#character-book-title > small', '#character-book-description'].map(selector => ({ selector, ...rect(selector) }));
      const circle = rect('.character-book-selector button > span');
      const scroller = document.querySelector('#character-book-scroll');
      return { texts, circle, offsets: texts.map(r => r.left - circle.left), overflow: scroller.scrollWidth - scroller.clientWidth };
    });
    if (before) assert(geometry.offsets.some(offset => Math.abs(offset) > 2), 'Reproduce the different text/portrait left edges');
    else {
      assert(geometry.offsets.every(offset => Math.abs(offset) < 1), JSON.stringify(geometry));
      assert.equal(geometry.overflow, 0);
      assert.equal(await page.locator('#character-book-description').textContent(), expected.lead);
    }
    await page.screenshot({ path: path.join(output, `${width}-hero.png`) });
    if (!before) {
      for (const id of ['amane', 'mizuha', 'sakuya', 'aoneko']) {
        await activate(`[data-character-select="${id}"]`);
        await page.waitForFunction(id => document.querySelector('#character-book-layer').dataset.characterId === id, id);
      }
      for (const scene of expected.scenes) {
        const card = page.locator(`[data-character-cg-id="${scene.id}"]`);
        assert.equal(await card.locator('.character-book-cg-card-copy > strong').textContent(), scene.title);
        assert.deepEqual(await card.locator('.character-book-cg-card-poem > span').allTextContents(), scene.poem);
        await activate(`[data-character-cg-id="${scene.id}"]`);
        await page.locator('#character-book-cg-viewer').waitFor();
        await page.waitForFunction(() => document.querySelector('#character-book-cg-viewer-image').complete && document.querySelector('#character-book-cg-viewer-image').naturalWidth);
        assert.equal(await page.locator('#character-book-cg-viewer-title').textContent(), scene.title);
        assert.deepEqual(await page.locator('#character-book-cg-viewer-poem > span').allTextContents(), scene.poem);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(output, `${width}-${scene.id}.png`) });
        await page.keyboard.press('Escape');
        await page.locator('#character-book-cg-viewer').waitFor({ state: 'hidden' });
      }
      const concept = page.locator('#character-book-concept');
      await concept.scrollIntoViewIfNeeded();
      assert.equal(await concept.locator('h3').textContent(), expected.conceptTitle);
      assert.equal(await concept.locator('p').textContent(), expected.concept);
      await page.screenshot({ path: path.join(output, `${width}-concept.png`) });
      assert.equal(await page.locator('#character-book-concept-link').getAttribute('href'), './concept/');
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    }
    report.checks.push({ width, height, geometry, copyAndGallery: !before });
    console.log(`PASS ${width}x${height}: ${before ? 'reproduced' : 'aligned + revised copy and gallery'}; offsets ${geometry.offsets}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
