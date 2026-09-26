import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/map-chapter-typography-2026-09-26');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', environment: 'Installed headless Chrome; 1920x1080 CSS pixels, DPR 2, normal motion, local CSP; external APIs blocked, not production.',
  hashes: Object.fromEntries(['map-unified-dock.css', 'map-ui-grid-polish.css', 'gaia-mode-loader.js', 'index.html'].map(file =>
    [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**', route => route.abort());
  for (const number of ['05', '06', '15']) {
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/?ui=chapter-type-20260926-2#world-${number}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
    await page.waitForFunction(number => document.querySelector('#japan-title')?.dataset.exhibitNumber === number
      && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
    await page.evaluate(() => document.fonts.ready);
    const chapter = page.locator(number === '05' ? '.gaia-planet-chapter' : number === '06' ? '.map-command-dock > .map-mode-bank' : '.gaia-live-deck-chapter');
    const metrics = await chapter.evaluate(node => {
      const origin = node.getBoundingClientRect();
      return [...node.querySelectorAll('.map-category-eyebrow,[data-planet-number],[data-planet-title],[data-map-dock-number],[data-map-dock-title],[data-live-deck-number],[data-live-deck-title]')].map(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        const text = range.getBoundingClientRect(), box = element.getBoundingClientRect(), style = getComputedStyle(element);
        const relative = r => [r.x - origin.x, r.y - origin.y, r.height];
        return { text: element.textContent.trim(), font: [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight], box: relative(box), textRange: relative(text) };
      });
    });
    assert.equal(metrics.length, 3);
    if (number !== '05') {
      const reference = report.checks[0].metrics;
      metrics.forEach((item, index) => {
        assert.deepEqual(item.font, reference[index].font);
        for (const property of ['box', 'textRange']) item[property].forEach((value, axis) =>
          assert(Math.abs(value - reference[index][property][axis]) < .1, `${number}: ${property}/${index}/${axis} must match 05`));
      });
    }
    const assetUrl = await page.locator('link[href*="/map-unified-dock.css?"]').getAttribute('href');
    assert(assetUrl.includes('type-confirm-2'), 'The refreshed entry must load the new stylesheet URL');
    await chapter.screenshot({ path: path.join(output, `after-${number}.png`) });
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ number, metrics, assetUrl });
    await page.close();
    console.log(`PASS ${number}: font, line box and text range`);
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'after.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
