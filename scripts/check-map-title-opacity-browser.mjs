import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/map-title-opacity-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['mode-feature-intro.css', 'mode-entry-guide.js', 'gaia-mode-loader.js', 'index.html', 'sensors/index.html'];
const report = { status: 'running', before, checks: [], errors: [], missing: [], hashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), scope: 'Installed Chrome and production CSP on local assets, native title/guide transitions, responsive/touch emulation. External APIs blocked or supplied repository snapshots; not production or physical devices.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height, reduced = false] of before ? [[1440,900]] : [[1440,900], [3573,1621], [390,844], [844,390], [320,568,true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.route('**/api/live/v1/firms', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    await page.goto(base + '/#world', { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-mode-entry-guide[data-mode="map"][data-phase="title"].is-title-visible').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-mode-entry-title')).opacity === '1');
    const title = await page.evaluate(() => {
      const layer = document.querySelector('#gaia-mode-entry-guide'), title = layer.querySelector('.gaia-mode-entry-title'), button = layer.querySelector('[data-entry-title-skip]');
      const rect = node => node.getBoundingClientRect().toJSON();
      const text = title.querySelector('h2');
      const r = button.getBoundingClientRect();
      return { background: getComputedStyle(layer).backgroundColor, layerOpacity: getComputedStyle(layer).opacity, titleOpacity: getComputedStyle(title).opacity, textOpacity: getComputedStyle(text).opacity, textColor: getComputedStyle(text).color, buttonOpacity: getComputedStyle(button).opacity, blur: getComputedStyle(layer).backdropFilter, text: text.textContent, title: rect(title), heading: rect(text), button: rect(button), hit: button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert.match(title.background, /^rgba\(10, 20, 30, /);
    const alpha = Number(title.background.match(/[\d.]+/g).at(-1));
    if (before) assert(Math.abs(alpha - 245 / 255) < .002); else assert.equal(alpha, .8);
    assert.equal(title.layerOpacity, '1'); assert.equal(title.titleOpacity, '1'); assert.equal(title.textOpacity, '1'); assert.equal(title.buttonOpacity, '1');
    assert.equal(title.textColor, 'rgb(231, 235, 237)'); assert.equal(title.text, '世界を観測する'); assert.equal(title.blur, 'blur(12px)');
    assert(title.hit); assert.equal(title.overflow, 0);
    for (const rect of [title.heading, title.button]) assert(rect.x >= 0 && rect.right <= width + 1 && rect.y >= 0 && rect.bottom <= height + 1);
    await page.screenshot({ path: path.join(output, `${width}-title.png`) });
    report.checks.push({ width, height, reduced, phase: 'title', ...title });
    if (!before) {
      if ([1440,3573].includes(width)) {
        // Retain the automatic title-to-features timing on desktop.
        await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
      } else {
        await page.locator('[data-entry-title-skip]').tap();
        await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
      }
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-feature-intro')).opacity === '1');
      const features = await page.locator('.gaia-feature-intro').evaluate(node => ({ opacity: getComputedStyle(node).opacity, paintOpacity: getComputedStyle(node, '::after').opacity, layerBackground: getComputedStyle(node.parentElement).backgroundColor }));
      assert.equal(features.opacity, '1'); assert.equal(features.paintOpacity, '0.8'); assert.match(features.layerBackground, /^rgba\(4, 14, 35, /);
      assert(Math.abs(Number(features.layerBackground.match(/[\d.]+/g).at(-1)) - 156 / 255) < .002);
      await page.screenshot({ path: path.join(output, `${width}-features-unchanged.png`) });
      await page.locator('[data-feature-start]').click();
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => GaiaModeEntryGuide.getState().active), false);
      report.checks.push({ width, height, reduced, phase: 'features and close', ...features });
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close(); console.log(`PASS ${width}x${height}`);
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []);
  report.status = before ? 'baseline captured' : 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify({ status: report.status, checks: report.checks.length }));
