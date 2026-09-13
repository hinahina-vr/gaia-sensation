import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { readAnnualPart } from './lib/annual-snapshot.mjs';
const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/record-dock-compact-2026-09-09/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const source = JSON.parse(fs.readFileSync('data/japan-prtr-2022.json'));
const zero = (source.schemaVersion === 2 ? readAnnualPart(source.periods.at(-1).file) : source.periods.at(-1)).stations.find(s => s.metrics.transfer.value === 0 && s.substances.length === 2 && s.industry === '燃料小売業');
const report = { status: 'running', before, base, environment: 'Installed Chrome with security headers, original local snapshots, desktop/touch emulation, not physical devices.', checks: [], errors: [], sha256: {} };
for (const file of ['marine-cod-exhibit.css', 'gaia-mode-loader.js', 'index.html']) report.sha256[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height] of (process.env.COMPACT_VIEWPORTS || '1440x900,2560x1440,3840x2160,1024x768,390x844,320x568').split(',').map(s => s.split('x').map(Number))) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base); await context.route('https://**', r => r.abort());
    await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/?exhibit=66#world`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-feature-start]').click();
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMarineCod?.getState().dataState === 'ready' && document.querySelector('[data-cod-station]'));
    await page.evaluate(() => GaiaMapDemo.stop());
    const idle = () => page.waitForFunction(() => GaiaMarineCod.getState().dataState === 'ready' && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'complete');
    for (const number of ['66', '67']) {
      await page.evaluate(n => GaiaMapCategories.buttons().find(b => b.textContent.trim() === n).click(), number); await idle();
      await page.locator('[data-cod-prefecture]').selectOption(zero.prefCode); await page.locator('[data-cod-station]').selectOption(zero.id); await idle();
      assert.equal(await page.locator('[data-cod-value]').textContent(), '0 kg/年度');
      assert((await page.locator('[data-cod-secondary]').textContent()).includes('2届出物質（kg単位） / 燃料小売業'));
      const metrics = await page.evaluate(() => {
        const selectors = { dock: '.gaia-marine-cod-readout', chapter: '.gaia-marine-cod-chapter', title: '.gaia-marine-cod-chapter strong', primary: '.gaia-cod-primary', label: '.gaia-cod-value-label', value: '[data-cod-value]', secondary: '[data-cod-secondary]', records: '[data-cod-records]' };
        return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
          const el = document.querySelector(selector), r = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
          return [key, { ...r.toJSON(), fontSize: getComputedStyle(el).fontSize, lines: [...range.getClientRects()].length, visible: getComputedStyle(el).display !== 'none' }];
        }));
      });
      await page.screenshot({ path: path.join(output, `${width}-${number}.png`) });
      if (!mobile) await page.locator('.gaia-marine-cod-readout').screenshot({ path: path.join(output, `${width}-${number}-dock.png`) });
      if (!before) {
        assert(metrics.dock.left >= -1 && metrics.dock.right <= width + 1 && metrics.dock.bottom <= height + 1);
        if (!mobile) {
          assert.equal(metrics.title.lines, 1, 'Full title fits on one line');
          assert(metrics.dock.height <= (width < 1400 ? 164 : 112), `Compact dock height: ${metrics.dock.height}`);
          assert(metrics.title.right < metrics.chapter.right, 'Full title stays within its column');
          assert(Math.abs(metrics.label.y - metrics.value.y) < 22, 'Metric and value share row one');
          assert(Math.abs(metrics.secondary.y - metrics.records.y) < 22, 'Qualifier and details share row two');
          assert(metrics.value.right <= metrics.primary.right && metrics.records.right <= metrics.primary.right, 'Value and details fit');
        }
        for (const selector of ['[data-cod-prefecture]', '[data-cod-station]', '[data-cod-records]', '[data-cod-overview]']) {
          assert(await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), `${width}/${number}: ${selector} reachable`);
        }
        await page.locator('[data-cod-records]').click(); await page.locator('#gaia-record-detail').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-record-list] li').count(), 2); await page.locator('[data-record-close]').click();
        if (!mobile) {
          await page.locator('.gaia-marine-cod-chapter [data-map-bank-toggle]').click(); await page.locator('.map-dock-bank-popover').waitFor({ state: 'visible' });
          await page.locator('.gaia-marine-cod-chapter [data-map-bank-toggle]').click();
          await page.locator('[data-cod-source]').click();
          await page.waitForFunction(() => { const panel = document.querySelector('#japan-data-panel'); return panel.getBoundingClientRect().right <= innerWidth + 1 && panel.getAnimations().every(a => a.playState !== 'running'); });
          const obscured = await page.locator('.gaia-marine-cod-legend').evaluate(el => getComputedStyle(el).visibility !== 'hidden');
          await page.screenshot({ path: path.join(output, `${width}-${number}-source${obscured ? '-overlap' : ''}.png`) });
          assert(!obscured, 'The legend does not obscure the source panel');
          assert(await page.locator('#japan-data-panel a').first().evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'Source link is reachable');
          await page.locator('#japan-data-close').click();
          assert.equal(await page.locator('.gaia-marine-cod-readout').evaluate(el => getComputedStyle(el).visibility), 'visible');
        }
      }
      report.checks.push({ width, height, number, metrics });
    }
    if (!before && width === 1440) {
      for (const number of ['31', '70']) {
        await page.evaluate(n => GaiaMapCategories.buttons().find(b => b.textContent.trim() === n).click(), number);
        await page.waitForFunction(n => document.querySelector('#japan-mode-number').textContent.trim() === n && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
        if (number === '31') {
          await idle(); assert.equal(await page.locator('.gaia-marine-cod-readout').evaluate(el => el.classList.contains('is-record-exhibit')), false);
          assert.equal(Math.round((await page.locator('.gaia-marine-cod-readout').boundingBox()).height), 104, 'Other annual observations retain their height');
        } else {
          await page.waitForFunction(() => GaiaFoodExhibits.getState().dataState === 'ready');
          assert(await page.locator('.gaia-marine-cod-readout').isHidden()); assert(await page.locator('.gaia-food-readout').isVisible());
        }
      }
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close(); console.log(`PASS ${width}x${height} ${before ? 'baseline' : 'compact'}`);
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, output })); }
