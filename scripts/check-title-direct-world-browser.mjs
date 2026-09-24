import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/title-direct-world-2026-09-25', before ? 'before' : 'after');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktree: 'uncommitted changes', before,
  environment: 'Installed Chrome, local HTTP with production CSP; desktop/touch emulation. External network blocked; saved data, not live-feed or production verification.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
async function press(page, selector, mobile, keyboard = false) {
  if (keyboard) { await page.locator(selector).focus(); await page.keyboard.press('Enter'); }
  else if (mobile) await page.locator(selector).tap();
  else await page.locator(selector).click();
}
async function title(page, mobile) {
  await page.goto(`${base}/?routeGuide=0`, { waitUntil: 'domcontentloaded' });
  await press(page, '#gaia-opening-sound-off', mobile);
  await press(page, '#gaia-opening-skip', mobile);
  await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu').classList.contains('is-visible'));
  await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
}
async function mapReady(page) {
  await page.waitForFunction(() => document.querySelector('#japan-layer')?.getAttribute('aria-hidden') === 'false'
    && document.documentElement.dataset.gaiaAppReady === 'true', null, { timeout: 60000 });
  await page.locator('#gaia-opening').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#japan-mode-number')?.textContent === '01');
}
try {
  for (const width of [1440, 390]) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile });
    await context.route(/^https?:\/\//, route => new URL(route.request().url()).origin === base ? route.fallback() : route.abort());
    await enforceBrowserSecurity(context, base);
    await context.addInitScript(() => {
      window.__introOpened = false;
      window.__mapHashes = [];
      addEventListener('hashchange', () => window.__mapHashes.push(location.hash));
      addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          if (document.querySelector('#intro-layer')?.getAttribute('aria-hidden') === 'false') window.__introOpened = true;
        }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
      });
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await title(page, mobile);
    await page.locator('#gaia-opening-route-other').screenshot({ path: path.join(output, `button-${width}.png`) });
    await press(page, '#gaia-opening-route-other', mobile);
    if (before) {
      await page.waitForFunction(() => location.hash === '#top' && document.querySelector('#intro-layer')?.getAttribute('aria-hidden') === 'false');
      report.checks.push({ width, reproduced: 'Data button goes to #top and opens intermediate menu' });
    } else {
      await mapReady(page);
      const state = await page.evaluate(() => ({ hash: location.hash, hashes: __mapHashes, introOpened: __introOpened,
        introHidden: document.querySelector('#intro-layer').getAttribute('aria-hidden'), title: document.querySelector('#japan-mode-title').textContent,
        soundtrack: GaiaOpeningAudio.getState().track, storyLoaded: GaiaModeLoader.isLoaded('story') }));
      assert(state.hashes.includes('#world'), 'Use the actual #world route');
      assert.match(state.hash, /^#world(?:-01)?$/);
      assert.equal(state.introOpened, false, 'Do not flash or open the intermediate menu');
      assert.equal(state.introHidden, 'true');
      assert.equal(state.title, '風がつなぐ世界');
      assert.equal(state.soundtrack, 'moonreopen');
      assert.equal(state.storyLoaded, false);
      report.checks.push({ width, input: mobile ? 'touch' : 'mouse', ...state });
      await page.locator('[data-feature-start]').click();
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#intro-layer').getAttribute('aria-hidden'), 'true');
      // Reloading the destination must keep the same map entry.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await mapReady(page);
      assert.equal(await page.locator('#intro-layer').getAttribute('aria-hidden'), 'true');
      report.checks.push({ width, reload: 'map retained' });
      // Keep the other modes reachable via Back, and exercise a warm title entry.
      await press(page, '#japan-close', mobile);
      await page.locator('#intro-path-stage').waitFor({ state: 'visible' });
      if (await page.locator('#intro-entry-guide').isVisible()) await page.keyboard.press('Escape');
      await press(page, '#intro-title-return', mobile);
      await page.locator('#gaia-opening-route-other').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.body.classList.contains('gaia-title-returning'));
      await page.evaluate(() => { window.__introOpened = false; });
      await press(page, '#gaia-opening-route-other', mobile, !mobile);
      await mapReady(page);
      assert.equal(await page.evaluate(() => __introOpened), false);
      report.checks.push({ width, warmReturn: mobile ? 'tap opens map directly again' : 'Enter opens map directly again' });
    }
    await page.screenshot({ path: path.join(output, `destination-${width}.png`) });
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  report.hashes = Object.fromEntries(['opening.js', 'index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
