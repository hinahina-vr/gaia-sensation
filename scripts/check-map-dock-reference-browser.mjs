import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const root = path.resolve('artifacts/map-dock-reference-2026-09-26');
const output = path.join(root, before ? 'before' : 'after');
fs.mkdirSync(output, { recursive: true });
const baseline = !before && fs.existsSync(path.join(root, 'before/report.json'))
  ? JSON.parse(fs.readFileSync(path.join(root, 'before/report.json'))) : null;
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', environment: 'Installed headless Chrome, local CSP, external APIs blocked; desktop/mobile emulation, not production or physical devices.',
  hashes: Object.fromEntries(['map-ui-grid-polish.css', 'map-unified-dock.css', 'gaia-mode-loader.js', 'index.html'].map(file =>
    [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
if (process.argv.includes('--resume')) {
  const previous = JSON.parse(fs.readFileSync(path.join(output, 'report.json')));
  assert.equal(previous.commit, report.commit);
  assert.deepEqual(previous.hashes, report.hashes, 'Only resume evidence for identical application assets');
  assert.deepEqual(previous.errors, []);
  fs.copyFileSync(path.join(output, 'report.json'), path.join(output, 'resume-baseline.json'));
  report.checks = previous.checks;
  report.resumedChecks = previous.checks.length;
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height, numbers] of [[1440, 900, before ? [5, 6, 15, 16] : [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]],
    [3840, 2160, [5, 6, 15]], [1366, 900, [5, 6, 15]], [1100, 900, before ? [5, 6, 15] : [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]], [390, 844, [5, 6, 15]]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: width < 900, hasTouch: width < 900 });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    for (const n of numbers) {
      if (report.checks.some(c => c.width === width && +c.number === n)) continue;
      // Compare direct entries independently; a hash-only goto would retain
      // the previous provider's focus, open controls and scroll restoration.
      page = await context.newPage();
      page.on('pageerror', e => report.errors.push(e.message));
      const number = String(n).padStart(2, '0');
      await page.goto(`${base}/#world-${number}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForFunction(number => document.querySelector('#japan-title')?.dataset.exhibitNumber === number
        && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
      await page.evaluate(() => document.fonts.ready);
      const dockSelector = n === 5 ? '.gaia-planet-signals-readout' : n < 15 ? '.map-command-dock' : '.gaia-live-exhibit-readout';
      const titleSelector = n === 5 ? '.gaia-featured-selector-toggle' : n < 15 ? '.map-dock-bank-trigger' : '.gaia-live-deck-selector-toggle';
      const scan = await page.locator(dockSelector).evaluate((dock, n) => {
        const rect = e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100); };
        const type = e => { const s = getComputedStyle(e); return { size: s.fontSize, line: s.lineHeight, weight: s.fontWeight, family: s.fontFamily }; };
        const category = dock.querySelector('.map-category-eyebrow');
        const number = dock.querySelector(n === 5 ? '[data-planet-number]' : n < 15 ? '[data-map-dock-number]' : '[data-live-deck-number]');
        const title = dock.querySelector(n === 5 ? '[data-planet-title]' : n < 15 ? '[data-map-dock-title]' : '[data-live-deck-title]');
        const style = getComputedStyle(dock);
        return { material: { background: style.backgroundImage, shadow: style.boxShadow, blur: style.backdropFilter, padding: style.padding },
          boxes: [dock, category, number, title].map(rect), type: [category, number, title].map(type),
          decoration: [dock, ...dock.querySelectorAll(':scope > .map-grid-polish')].flatMap(e => ['::before', '::after'].map(p => getComputedStyle(e, p).content)),
          title: title.textContent.trim(), overflow: document.documentElement.scrollWidth - innerWidth };
      }, n);
      assert.equal(scan.overflow, 0);
      if (!before && width > 900 && n >= 6 && n <= 15) {
        const reference = report.checks.find(c => c.width === width && c.number === '05');
        assert.deepEqual(scan.type, reference.type, `${width}/${number}: same typography as 05`);
        assert.deepEqual(scan.material, reference.material, `${width}/${number}: same panel material as 05`);
        for (const [index, label] of [[1, 'category'], [2, 'number'], [3, 'title']]) {
          // Text width depends on the exhibit; starting position and row height do not.
          for (const component of [0, 1, 3]) assert(Math.abs(scan.boxes[index][component] - reference.boxes[index][component]) < 1.1,
            `${width}/${number}: ${label} alignment ${JSON.stringify(scan.boxes[index])} vs ${JSON.stringify(reference.boxes[index])}`);
        }
        assert(scan.decoration.every(content => content === 'none'), `${width}/${number}: no inset cards or ornamental overlay`);
      }
      const original = baseline?.checks.find(c => c.width === width && c.number === number);
      if (original && (n === 5 || width < 900)) {
        const { boxes: oldBoxes, width: _width, height: _height, number: _number, ...oldStyle } = original;
        const { boxes, ...style } = scan;
        assert.deepEqual(style, oldStyle, 'Reference, adjacent and mobile styles unchanged');
        if (width > 900) assert.deepEqual(boxes, oldBoxes);
        else {
          // The live-status text grows while an API falls back to saved data.
          // Compare the unchanged mobile bottom anchor, not that transient height.
          assert.deepEqual(boxes.slice(1), oldBoxes.slice(1));
          assert.equal(boxes[0][0], oldBoxes[0][0]);
          assert.equal(boxes[0][2], oldBoxes[0][2]);
          assert(Math.abs(boxes[0][1] + boxes[0][3] - oldBoxes[0][1] - oldBoxes[0][3]) < .1);
        }
      }
      if ([5, 6, 15].includes(n)) await page.screenshot({ path: path.join(output, `${width}-${number}.png`),
        ...(width > 900 ? { clip: { x: 0, y: height - 185, width, height: 185 } } : {}) });
      if (!before && width > 900) {
        const trigger = page.locator(dockSelector).locator(titleSelector);
        await trigger.click();
        await page.waitForFunction(() => document.querySelector('.map-dock-bank-popover')?.dataset.anchor === 'bottom');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        const source = page.locator(dockSelector).locator('.map-dock-action--source, .gaia-map-action--source');
        assert(await source.locator('svg').isVisible());
        await source.click();
        await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
        await page.locator('#japan-data-close').click();
        await page.locator('#japan-data-panel').evaluate(async panel => {
          await Promise.allSettled(panel.getAnimations().map(animation => animation.finished));
        });
        if (n === 6 || n === 15) {
          const timeline = page.locator(n === 6 ? '.signal-console-map [data-signal-time]' : '#gaia-live-time');
          await timeline.focus();
          await timeline.press('Home');
          const start = await timeline.inputValue();
          await timeline.press('End');
          assert.notEqual(await timeline.inputValue(), start, 'The visible timeline remains operable');
          await timeline.press('Home');
        }
        if (n === 15) {
          const place = page.locator('[data-live-deck-location]');
          const originalPlace = await place.textContent();
          await page.locator('[data-live-poi-step="1"]').click();
          await page.waitForFunction(label => document.querySelector('[data-live-deck-location]').textContent !== label, originalPlace);
        }
        if (n === 6) {
          await page.locator('.map-dock-action--statistics').click();
          await page.locator('#gaia-statistics-lab[aria-hidden="false"]').waitFor();
          await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
          assert(Number(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count')) > 0);
          await page.locator('#gaia-statistics-close').click();
        }
      }
      report.checks.push({ width, height, number, ...scan });
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
      await page.close();
      console.log(`PASS ${width}/${number}`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${report.checks.length} reference-design checks`);
