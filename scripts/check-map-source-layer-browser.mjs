import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/map-source-layer-20260912/${before ? 'before' : 'after'}`);
const files = ['data-ledger.css', 'gaia-mode-loader.js', 'index.html'];
const hashes = () => Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
fs.mkdirSync(output, {recursive: true});
const report = {status: 'running', hashes: hashes(), checks: [], errors: [], missing: [],
  scope: 'Installed Chrome, localhost with production CSP. Saved repository data and FIRMS fixture, HTTPS blocked. Mobile is viewport/touch emulation, not a physical device.'};
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for (const [width, height] of [[1440, 900], [901, 768], [390, 844]]) {
    const mobile = width <= 900;
    const context = await browser.newContext({viewport: {width, height}, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.route('**/api/live/v1/firms*', route => route.fulfill({path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json'}));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({width, message: error.message}));
    page.on('response', response => {if (response.status() === 404) report.missing.push(response.url());});
    await page.goto(`${base}/?exhibit=38#world`, {waitUntil: 'domcontentloaded'});
    await page.locator('[data-feature-start]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({state: 'hidden'});
    await page.waitForFunction(() => globalThis.GaiaMapPlayback?.getState().ready);
    await page.evaluate(() => GaiaMapDemo.stop());
    const source = () => mobile ? page.locator('#map-mobile-sheet').getByRole('button', {name: 'データの出典', exact: true})
      : page.locator('.map-dock-action:visible, .gaia-map-actions > .gaia-map-action:visible').filter({hasText: 'データの出典'});
    const open = async () => {
      if (mobile) await page.locator('[data-mobile-sheet="tools"]').tap();
      await source().click();
      await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
      await page.waitForTimeout(450);
    };
    const scan = () => page.evaluate(() => {
      const panel = document.querySelector('#japan-data-panel'), bounds = panel.getBoundingClientRect();
      const blockers = [];
      // Verify the painted/clickable result, not just nominal z-index values.
      for (let y = bounds.top + 18; y < bounds.bottom - 18; y += 61) {
        for (let x = bounds.left + 18; x < bounds.right - 18; x += 61) {
          const top = document.elementFromPoint(x, y);
          if (!panel.contains(top)) blockers.push({x, y, tag: top?.tagName, id: top?.id, className: String(top?.className)});
        }
      }
      const legend = document.querySelector('.gaia-marine-cod-legend');
      return {blockers, panelZ: getComputedStyle(panel).zIndex, legendZ: legend && getComputedStyle(legend).zIndex,
        sourceText: panel.innerText.slice(0, 160), links: panel.querySelectorAll('a[href^="https://"]').length,
        overflow: document.documentElement.scrollWidth - innerWidth};
    });
    for (const number of before ? [38] : [38, 31, 35, 40, 65, 68, 1, 2, 6, 15, 21, 70, 71]) {
      await page.evaluate(number => GaiaMapCategories.buttons()[number - 1].click(), number);
      await page.waitForFunction(number => GaiaMapPlayback.getState().number === number && GaiaMapPlayback.getState().ready
        && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
      if (number === 38) await page.screenshot({path: path.join(output, `${width}-38-map.png`)});
      await open();
      const state = await scan(); report.checks.push({width, number, ...state});
      if ([38, 6, 70].includes(number)) await page.screenshot({path: path.join(output, `${width}-${number}-source.png`)});
      if (!before) {
        assert.deepEqual(state.blockers, [], `${width}/${number}: map UI must stay underneath the source drawer`);
        assert(state.sourceText.includes(String(number).padStart(2, '0')), `${number}: source must belong to the current exhibit`);
        assert(state.links > 0); assert.equal(state.overflow, 0);
        const scroll = page.locator('#japan-data-panel .japan-data-scroll');
        const scrollable = await scroll.evaluate(e => e.scrollHeight > e.clientHeight + 2);
        if (scrollable) {
          const bounds = await scroll.boundingBox();
          await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          await page.mouse.wheel(0, 900); await page.waitForTimeout(250);
          assert(await scroll.evaluate(e => e.scrollTop > 0), 'Source text must receive wheel input');
          assert.deepEqual((await scan()).blockers, []);
        }
      }
      await page.locator('#japan-data-close').click();
      await page.locator('#japan-data-panel').waitFor({state: 'hidden'});
      assert.equal(await page.evaluate(() => GaiaMapPlayback.getState().number), number);
      if (number === 38) {
        const legend = page.locator('.gaia-marine-cod-legend');
        assert(await legend.isVisible());
        assert(await legend.evaluate(e => {const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(50, r.height / 2)));}), 'Legend must become readable again after source close');
        if (!before) {
          await open(); await page.keyboard.press('Escape'); await page.locator('#japan-data-panel').waitFor({state: 'hidden'});
          assert.equal(await page.locator('#japan-layer').getAttribute('aria-hidden'), 'false');
          if (!mobile) {
            await open(); await page.locator('#japan-data-scrim').click({position: {x: 30, y: 300}});
            await page.locator('#japan-data-panel').waitFor({state: 'hidden'});
          }
        }
      }
      console.log('PASS source layer', width, number, state.blockers.length);
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
  }
  if (before) assert(report.checks.some(check => check.width === 1440 && check.blockers.some(item => item.className.includes('gaia-cod'))), 'Reproduce the reported temperature legend covering the source');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(hashes(), report.hashes);
  report.status = before ? 'recorded' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({path: path.join(output, 'failure.png')}).catch(() => {}); throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
