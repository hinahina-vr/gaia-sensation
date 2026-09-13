import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/map-stat-shortcut-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, {recursive: true});
const files = ['index.html', 'statistics-lab.js', 'gaia-mode-loader.js', 'map-mobile-shell.js'];
const hashes = () => Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report = {status: 'running', before, hashes: hashes(), checks: [], errors: [], missing: [],
  scope: 'Installed Chrome, localhost and production CSP; repository data, external APIs blocked and FIRMS snapshot fixture. Desktop/mobile emulation, not physical devices or production.'};
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
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    await page.goto(`${base}/?exhibit=6#world`, {waitUntil: 'domcontentloaded'});
    await page.locator('[data-feature-start]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({state: 'hidden'});
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 71);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); });
    const select = async number => {
      await page.evaluate(number => GaiaMapCategories.buttons()[number - 1].click(), number);
      await page.waitForFunction(number => Number(document.querySelector('#japan-mode-number').textContent) === number
        && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
    };
    const shortcut = page.locator('#gaia-statistics-button-mobile, .gaia-statistics-quick');
    await select(6);
    const scan = {width, height, count: await shortcut.count(), visible: await shortcut.isVisible()};
    await page.screenshot({path: path.join(output, `${width}-map.png`)});
    if (before) {
      assert.equal(scan.count, 1);
      if (width === 1440) assert(scan.visible, 'Reproduce the unstyled STAT shortcut before statistics is loaded');
      report.checks.push(scan);
      await context.close();
      continue;
    }
    assert.equal(scan.count, 0, 'Remove the duplicate button from the DOM, not merely its label');
    for (const number of [6, 21]) {
      await select(number);
      const action = name => mobile
        ? page.locator('#map-mobile-sheet').getByRole('button', {name, exact: true})
        : page.locator('.map-dock-action:visible, .gaia-map-actions > .gaia-map-action:visible').filter({hasText: name});
      const tools = async () => { if (mobile) await page.locator('[data-mobile-sheet="tools"]').tap(); };
      await tools();
      await action('データの出典').click();
      await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
      assert((await page.locator('#japan-data-panel').innerText()).length > 80);
      await page.locator('#japan-data-close').click();
      await page.locator('#japan-data-panel').waitFor({state: 'hidden'});
      await tools();
      const analysis = action('統計分析');
      if (!mobile) { await analysis.focus(); await analysis.press('Enter'); }
      else await analysis.tap();
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady
        && Number(document.querySelector('#gaia-statistics-canvas').dataset.pointCount) > 0);
      await page.locator('#gaia-statistics-lab[aria-hidden="false"]').waitFor();
      await page.screenshot({path: path.join(output, `${width}-${number}-analysis.png`)});
      const points = Number(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count'));
      await page.locator('#gaia-statistics-close').click();
      await page.locator('#gaia-statistics-lab').waitFor({state: 'hidden'});
      assert.equal(await shortcut.count(), 0, 'Lazy loading statistics must not restore the retired shortcut');
      assert.equal(Number(await page.locator('#japan-mode-number').textContent()), number);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      report.checks.push({width, number, points, shortcutCount: 0, source: 'opened and closed', analysis: mobile ? 'tap' : 'keyboard Enter'});
    }
    await page.screenshot({path: path.join(output, `${width}-after-analysis.png`)});
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log(`PASS ${width}: removed shortcut, source and real analysis through the retained desktop/mobile entries`);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(hashes(), report.hashes);
  report.status = before ? 'recorded' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
