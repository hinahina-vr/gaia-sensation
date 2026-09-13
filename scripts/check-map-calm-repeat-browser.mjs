import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/map-calm-repeat-2026-09-10/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, base, checks: [], errors: [], sha256: {}, environment: 'Local installed Chrome, real DOM/image decode, desktop/touch emulation and production CSP. Saved NOAA/FIRMS and empty USGS responses; not live-provider or physical-device verification.' };
for (const file of ['mode-entry-guide.js', 'mode-feature-intro.css', 'app.js', 'gaia-mode-loader.js', 'index.html']) report.sha256[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
async function readWelcome(label, check = true) {
  await page.locator('#gaia-mode-entry-guide[data-phase="title"]').waitFor();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.gaia-mode-entry-title')).opacity) > .95);
  const title = await page.locator('.gaia-mode-entry-title').evaluate(el => ({ text: el.querySelector('h2').textContent, shadow: getComputedStyle(el.querySelector('h2')).textShadow, decoration: getComputedStyle(el, '::before').content, background: getComputedStyle(el.parentElement).backgroundColor, rect: el.getBoundingClientRect().toJSON() }));
  await page.screenshot({ path: path.join(output, `${label}-title.png`) });
  await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-feature-intro')).opacity === '1');
  await page.locator('.has-feature-art img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  const features = await page.locator('.gaia-feature-intro').evaluate(el => ({
    text: el.innerText, rect: el.getBoundingClientRect().toJSON(),
    images: [...el.querySelectorAll('.has-feature-art img')].map(img => {
      const box = img.getBoundingClientRect(); const frame = img.parentElement.getBoundingClientRect();
      const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
      return { src: img.getAttribute('src'), width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit, frame: frame.toJSON(), box: box.toJSON(), layoutWidth: img.clientWidth, layoutHeight: img.clientHeight, frameWidth: img.parentElement.clientWidth, frameHeight: img.parentElement.clientHeight, containEmptyX: box.width - img.naturalWidth * scale, containEmptyY: box.height - img.naturalHeight * scale };
    }),
  }));
  await page.screenshot({ path: path.join(output, `${label}-features.png`) });
  assert.equal(title.text, '世界を観測する');
  assert(features.text.includes('さあ、地球のふしぎを見つけにいこう！'));
  assert.equal(features.images.length, 3);
  if (!before && check) {
    assert.equal(title.shadow, 'none');
    assert.equal(title.decoration, 'none');
    assert(!features.text.includes('初回のご案内'));
    for (const img of features.images) {
      assert(img.src.includes('-v2'), 'New Imagegen artwork must be used');
      assert.equal(img.fit, 'cover', 'Full-bleed images must not letterbox');
      assert.equal(img.layoutWidth, img.frameWidth);
      assert.equal(img.layoutHeight, img.frameHeight);
      assert(Math.abs(img.frameWidth / img.frameHeight - 2) < .025, 'Frame preserves the full 2:1 composition');
      assert(img.box.width >= img.frame.width - 1 && img.box.height >= img.frame.height - 1, 'Hover zoom never exposes a gap');
    }
    const {width, height} = page.viewportSize();
    assert(features.rect.left >= 0 && features.rect.top >= 0 && features.rect.right <= width + 1 && features.rect.bottom <= height + 1);
    const actions = await page.locator('.gaia-feature-footer button').evaluateAll(buttons => buttons.map(button => { const r = button.getBoundingClientRect(); return { hit: button.contains(document.elementFromPoint(r.x+r.width/2, r.y+r.height/2)), height: r.height }; }));
    assert(actions.every(button => button.hit && button.height >= 44), 'Start and guide actions remain visible and reachable');
    if (width <= 900 && label.endsWith('-first')) {
      for (let i = 0; i < 3; i++) {
        await page.locator('.gaia-feature-visual').nth(i).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${label}-card-${i+1}.png`) });
      }
    }
  }
  assert.equal(await page.evaluate(() => GaiaMapDemo.getState().paused), true, 'Demo pauses throughout introduction');
  if (label.endsWith('exhibit-deeplink')) assert.equal((await page.locator('#japan-mode-number').textContent()).trim(), '66', 'Welcome preserves the requested exhibition');
  await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => GaiaMapDemo.getState().paused), false);
  assert.deepEqual(await page.evaluate(() => __securityViolations), []);
  report.checks.push({ label, title, features });
}
try {
  const sizes = before ? [[1440,900]] : [[1440,900], [3840,2160], [1024,768], [390,844], [320,568], [844,390]];
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, isMobile: width <= 900, reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://services.swpc.noaa.gov/**', r => r.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    await context.route('https://earthquake.usgs.gov/**', r => r.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
    await context.route('**/api/live/v1/firms', r => r.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    await context.addInitScript(() => { sessionStorage.setItem('gaia:intro-entry-guide:v1', 'seen'); });
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/#world`, { waitUntil: 'domcontentloaded' });
    await readWelcome(`${width}-first`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (before) {
      await page.waitForTimeout(3500);
      assert.equal(await page.locator('#gaia-mode-entry-guide').isVisible(), false, 'Reproduce: welcome is missing on the second visit');
      await page.screenshot({ path: path.join(output, 'second-visit-missing.png') });
      report.checks.push({ label: 'second visit missing reproduced' });
    } else {
      await readWelcome(`${width}-reload`);
      if (width === 1440 || width === 390) {
        await page.locator('#japan-close').click();
        await page.locator('[data-intro-path="map"]').waitFor({ state: 'visible' });
        await page.locator('[data-intro-path="map"]').click();
        await readWelcome(`${width}-reentry`);
        await page.goto(`${base}/?exhibit=66#world`, { waitUntil: 'domcontentloaded' });
        await readWelcome(`${width}-exhibit-deeplink`);
      }
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch(error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, output }));
}
