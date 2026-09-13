import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { approvedDescriptions } from './sound-description-fixture.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/sound-descriptions-20260912/after');
fs.mkdirSync(output, { recursive: true });
const hashes = Object.fromEntries(['sound-mode.js', 'sound-mode.css', 'opening-audio.js', 'gaia-mode-loader.js', 'index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report = { status: 'running', hashes, checks: [], errors: [], missing: [], scope: 'Installed Chrome with local production CSP, fresh isolated storage, real native track selections and audio clock. Desktop/touch emulation, not physical devices or subjective listening. External APIs blocked.' };
const titles = ['Planet Forecast - Hope', 'Planet Forecast — Windowlight', 'Planet Forecast — Calm', 'Planet Forecast — First Light', '折り目の向こうの風', '雪火の観測信号', '雪火、軌道の外へ', '月明かりの観測ノート', 'GAIA SENSEWARE', '青硝子の潮汐', 'AfterSchool, AfterGlow', 'Sensory Horizon'];
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, isMobile: width < 600 });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    const activate = selector => width < 600 ? page.locator(selector).tap() : page.locator(selector).click();
    const ready = async () => {
      await page.locator('#sound-layer.is-open').waitFor();
      await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
    };
    const waitTrack = key => page.waitForFunction(key => {
      const card = document.querySelector('.sound-now-playing[aria-live]');
      const image = card?.querySelector('img');
      const audio = GaiaOpeningAudio.getPlaybackState();
      return card?.dataset.track === key && card.getAttribute('aria-busy') === 'false'
        && !card.classList.contains('is-track-changing') && image?.complete && image.naturalWidth > 0
        && audio.track === key && audio.playing && !audio.muted && audio.currentTime > .15 && audio.duration > 5;
    }, key);
    await page.goto(base + '/#sound', { waitUntil: 'domcontentloaded' });
    await ready();
    const catalog = await page.locator('[data-sound-track]').evaluateAll(nodes => nodes.map(node => ({ key: node.dataset.soundTrack, title: node.querySelector('strong').textContent, disabled: node.disabled })));
    assert.deepEqual(catalog.map(track => track.key), Object.keys(approvedDescriptions));
    assert.deepEqual(catalog.map(track => track.title), titles);
    assert(catalog.every(track => !track.disabled));
    let reservedHeight;
    for (const [index, [key, description]] of Object.entries(approvedDescriptions).entries()) {
      await activate(`[data-sound-track="${key}"]`);
      await waitTrack(key);
      assert.equal(await page.locator('#sound-mode-description').textContent(), description);
      assert.equal(await page.locator('#sound-track-title').textContent(), titles[index]);
      assert.match(await page.locator('#sound-track-number').textContent(), new RegExp(`^TRACK ${String(index + 1).padStart(2, '0')} /`));
      await page.locator('.sound-now-playing[aria-live]').scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => {
        const card = document.querySelector('.sound-now-playing[aria-live]');
        const copy = card.querySelector('#sound-mode-description');
        const rect = node => node.getBoundingClientRect().toJSON();
        const range = document.createRange(); range.selectNodeContents(copy);
        return { card: rect(card), description: rect(copy), text: [...range.getClientRects()].map(rect => rect.toJSON()), transport: rect(document.querySelector('.sound-transport')), overflow: card.scrollWidth - card.clientWidth, opacity: getComputedStyle(copy).opacity, ids: document.querySelectorAll('#sound-mode-description').length };
      });
      assert.equal(layout.ids, 1); assert.equal(layout.opacity, '1'); assert(layout.overflow <= 1);
      assert(layout.transport.top >= layout.card.bottom - 1, 'Player controls must not cover the description');
      for (const rect of layout.text) assert(rect.left >= layout.card.left - 1 && rect.right <= layout.card.right + 1 && rect.top >= layout.card.top - 1 && rect.bottom <= layout.card.bottom + 1, `${width}/${key}: clipped description`);
      reservedHeight ??= layout.card.height;
      assert(Math.abs(layout.card.height - reservedHeight) <= 1, 'Track selection must keep player height stable');
      await page.locator('.sound-now-playing[aria-live]').screenshot({ path: path.join(output, `${width}-${String(index + 1).padStart(2, '0')}-${key}.png`) });
      report.checks.push({ width, key, description, layout, playback: await page.evaluate(() => GaiaOpeningAudio.getPlaybackState()) });
    }
    await activate('#sound-play');
    await page.waitForFunction(() => GaiaOpeningAudio.getPlaybackState().muted);
    await activate('#sound-play');
    await page.waitForFunction(() => !GaiaOpeningAudio.getPlaybackState().muted);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
    await activate('[data-sound-track="story"]'); await waitTrack('story');
    assert.equal(await page.locator('#sound-mode-description').textContent(), approvedDescriptions.story);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ width, phase: 'native mute/resume and page reload/reselection', passed: true });
    await context.close(); console.log(`PASS ${width}: all 12 descriptions, native playback, layout and reload`);
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
