import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const quick = process.argv.includes('--quick');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const root = path.resolve('artifacts/map-remaining-headings-2026-09-26');
const output = path.join(root, before ? 'before' : quick ? 'quick' : 'after');
fs.mkdirSync(output, { recursive: true });
const baseline = !before && fs.existsSync(path.join(root, 'before/report.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'before/report.json'))) : null;
const samples = process.argv.includes('--focus-food') ? [5, 69, 70, 71] : [5, 6, 15, 16, 21, 24, 31, 63, 69, 70, 71];
const cases = [[1440, 900, before || quick ? samples : [5, 6, 15, ...Array.from({ length: 56 }, (_, i) => i + 16)]],
  [1100, 900, samples], [1366, 900, samples], [3840, 2160, samples], [390, 844, [16, 21, 31, 70, 71]]];
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktree: 'uncommitted changes',
  environment: 'Installed headless Chrome, local CSP, external APIs blocked. Desktop and mobile emulation, not production.',
  hashes: Object.fromEntries(['map-unified-dock.css', 'responsive-audit-fixes.css', 'gaia-mode-loader.js', 'index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const selectors = n => n === 5 ? ['.gaia-planet-signals-readout', '.gaia-planet-chapter', '.gaia-featured-selector-toggle', '[data-planet-number]', '[data-planet-title]']
  : n < 15 ? ['.map-command-dock', '.map-mode-bank', '.map-dock-bank-trigger', '[data-map-dock-number]', '[data-map-dock-title]']
  : n <= 20 ? ['.gaia-live-exhibit-readout', '.gaia-live-deck-chapter', '.gaia-live-deck-selector-toggle', '[data-live-deck-number]', '[data-live-deck-title]']
  : n <= 30 ? ['.gaia-estat-readout', '.gaia-estat-chapter', '.gaia-estat-selector-toggle', '[data-estat-number]', '[data-estat-title]']
  : n <= 69 ? ['.gaia-marine-cod-readout', '.gaia-marine-cod-chapter', '.gaia-featured-selector-toggle', '.gaia-featured-selector-toggle > b', '.gaia-featured-selector-toggle > strong']
  : ['.gaia-food-readout', '.gaia-food-chapter', '.gaia-featured-selector-toggle', '[data-food-number]', '[data-food-title]'];
try {
  for (const [width, height, numbers] of cases) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: width < 900, hasTouch: width < 900 });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    for (const n of numbers) {
      page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      const number = String(n).padStart(2, '0');
      await page.goto(`${base}/#world-${number}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForFunction(({ number, settle }) => document.querySelector('#japan-title')?.dataset.exhibitNumber === number
        && (!settle || !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')), { number, settle: samples.includes(n) || width < 900 });
      await page.evaluate(() => document.fonts.ready);
      const [dockSelector, chapterSelector, triggerSelector, numberSelector, titleSelector] = selectors(n);
      const scan = await page.locator(dockSelector).evaluate((dock, selectors) => {
        const chapter = dock.querySelector(selectors[1]);
        const rect = e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
        const elements = [chapter.querySelector('.map-category-eyebrow'), chapter.querySelector(selectors[3]), chapter.querySelector(selectors[4])];
        const style = getComputedStyle(dock);
        return { box: rect(dock), chapter: rect(chapter), material: [style.backgroundImage, style.boxShadow, style.backdropFilter, style.padding, style.borderRadius],
          text: elements.map(e => { const s = getComputedStyle(e), range = document.createRange(); range.selectNodeContents(e); const r = range.getBoundingClientRect();
            return { text: e.textContent.trim(), font: [s.fontFamily, s.fontSize, s.fontWeight, s.lineHeight], box: rect(e), range: [r.x, r.y, r.height], display: s.display }; }),
          overflow: document.documentElement.scrollWidth - innerWidth };
      }, selectors(n));
      if (!before && width > 900) {
        const reference = n === 5 ? scan : report.checks.find(c => c.width === width && c.number === '05');
        scan.text.forEach((item, index) => {
          assert.deepEqual(item.font, reference.text[index].font, `${width}/${number}: typography`);
          [0, 1, 2].forEach(axis => assert(Math.abs(item.range[axis] - reference.text[index].range[axis]) < 1.1,
            `${width}/${number}: text ${index} alignment ${JSON.stringify(item.range)} vs ${JSON.stringify(reference.text[index].range)}`));
          assert(item.box[0] + item.box[2] <= scan.chapter[0] + scan.chapter[2] + 1, `${width}/${number}: full title fits its chapter`);
        });
        assert.equal(scan.overflow, 0);
        if (n >= 70) assert.deepEqual(scan.material, reference.material, `${width}/${number}: shared panel design`);
      }
      if (!before && width > 900 && n >= 70) {
        const readingFits = await page.locator('.gaia-food-primary').evaluate(node => {
          const bounds = node.getBoundingClientRect();
          return [...node.children].every(child => {
            const r = child.getBoundingClientRect();
            return r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1;
          });
        });
        assert(readingFits, `${width}/${number}: long qualifiers cannot push the caption or value outside the reading`);
      }
      const original = baseline?.checks.find(c => c.width === width && c.number === number);
      if (original && width < 900) {
        assert.deepEqual(scan.material, original.material, 'Mobile design unchanged');
        assert.deepEqual(scan.text, original.text, 'Mobile heading unchanged');
      }
      if (samples.includes(n) || width < 900) await page.screenshot({ path: path.join(output, `${width}-${number}.png`),
        ...(width > 900 ? { clip: { x: 0, y: height - 190, width, height: 190 } } : {}) });
      if (!before && width > 900 && samples.includes(n)) {
        const trigger = page.locator(dockSelector).locator(triggerSelector);
        await trigger.click();
        await page.waitForFunction(() => document.querySelector('.map-dock-bank-popover')?.dataset.anchor === 'bottom');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
      }
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
      report.checks.push({ width, height, number, ...scan });
      console.log(`PASS ${width}/${number}`);
      await page.close();
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${report.checks.length} exhibit heading checks`);
