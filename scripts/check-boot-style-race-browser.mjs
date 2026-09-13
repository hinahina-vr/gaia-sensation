import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const output = path.resolve('artifacts/boot-style-race');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, environment: 'Local Chrome; delayed local CSS response, real page bootstrap', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    // Let the preload finish before the parser-blocked inline initializer can
    // attach its listener. This is the ordering seen on the sensor return link.
    await page.route('**/navigation-controls.css?*', async route => {
      const response = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.fulfill({ response });
    });
    await page.goto(`${base}/#top`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.__gaiaInitialViewReady === true);
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => {
      const style = document.querySelector('[data-gaia-critical-style]');
      return { ready: globalThis.__gaiaInitialViewReady, rel: style.rel, loaded: style.dataset.gaiaLoaded, sheet: Boolean(style.sheet), bootHidden: document.querySelector('#gaia-boot').hidden, booting: document.documentElement.classList.contains('gaia-booting') };
    });
    report.checks.push({ width, ...state });
    await page.screenshot({ path: path.join(output, `${before ? 'before' : 'after'}-${width}.png`) });
    if (before) {
      assert.equal(state.rel, 'preload');
      assert.equal(state.bootHidden, false, 'Reproduce the loaded-preload race');
    } else {
      assert.equal(state.rel, 'stylesheet');
      assert.equal(state.loaded, 'true');
      assert.equal(state.sheet, true);
      assert.equal(state.bootHidden, true);
      assert.equal(state.booting, false);
      await page.locator('#intro-title-return').waitFor({ state: 'visible' });
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, `${before ? 'before' : 'after'}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
