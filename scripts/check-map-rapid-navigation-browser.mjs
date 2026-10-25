import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const stage = process.env.GAIA_NAV_STAGE || 'after';
const finalNumber = Number(process.env.GAIA_NAV_LAST || 25);
const output = path.resolve(`artifacts/map-rapid-navigation-20261020/${stage}`);
fs.mkdirSync(output, { recursive: true });
const report = { stage, checks: [], errors: [], environment: 'Local installed Chrome; external requests blocked; mobile is emulated.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of (process.env.GAIA_NAV_WIDTHS || '1920,390').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 }, hasTouch: width === 390, isMobile: width === 390 });
    await context.addInitScript(() => localStorage.setItem('gaia-senseware-bgm-muted', 'true'));
    await context.route('https://**/*', route => route.abort());
    // Expose the first-use gap on a slower connection deterministically.
    await context.route('**/data/estat-prefecture-series.json*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1800));
      await route.continue();
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-01`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true' && globalThis.GaiaMapStableNavigation);
    await page.evaluate(() => {
      window.navigationTrace = [];
      const snapshot = () => navigationTrace.push({
        at: Math.round(performance.now()), number: document.querySelector('#japan-mode-number').textContent,
        hash: location.hash, requested: GaiaMapStableNavigation.getState().requested,
        current: GaiaMapCategories.buttons().filter(b => b.getAttribute('aria-current') === 'true').map(b => b.textContent.trim()),
      });
      new MutationObserver(snapshot).observe(document.querySelector('#japan-mode-number'), { childList: true, characterData: true, subtree: true });
    });
    const next = page.locator('[data-map-stable-step="1"]');
    for (let number = 2; number <= finalNumber; number++) {
      if (width === 390) await next.tap(); else await next.click();
      await page.waitForTimeout(Number(process.env.GAIA_NAV_INTERVAL || 80));
      const state = await page.evaluate(() => ({ requested: GaiaMapStableNavigation.getState().requested, hash: location.hash,
        number: document.querySelector('#japan-mode-number').textContent }));
      report.checks.push({ width, expectedRequest: number, ...state });
      assert.equal(state.requested, number, `request after next: ${number}`);
      assert.equal(Number(state.number), number, `heading during load: ${number}`);
      if (number === 21) {
        // Leave before the delayed data arrives, then exercise A -> B -> A.
        for (const [direction, expected] of [[-1,20],[1,21],[1,22],[-1,21]]) {
          const button = page.locator(`[data-map-stable-step="${direction}"]`);
          if (width === 390) await button.tap(); else await button.click();
          const actual = await page.locator('#japan-mode-number').textContent();
          assert.equal(Number(actual), expected);
          report.checks.push({ width, duringLoadDirection: direction, expected, actual });
        }
      }
    }
    await page.waitForTimeout(3500);
    const final = await page.evaluate(() => ({ number: document.querySelector('#japan-mode-number').textContent,
      hash: location.hash, trace: navigationTrace, current: GaiaMapCategories.buttons().filter(b => b.getAttribute('aria-current') === 'true').map(b => b.textContent.trim()) }));
    report.checks.push({ width, final });
    await page.screenshot({ path: path.join(output, `${width}-final.png`) });
    assert.equal(Number(final.number), finalNumber, 'Last requested exhibit must own the view after late loads');
    assert.deepEqual(final.current, [String(finalNumber)]);
    assert(!final.trace.some(row => row.requested >= 21 && Number(row.number) < 21), 'No stale base exhibit during statistics load');
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  report.trace = await page?.evaluate(() => window.navigationTrace).catch(() => null);
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, trace: report.trace }));
}
