import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4487';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/release-prtr-20260909/tour-early-pause');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', base, conditions: 'Actual bundled JSON responses with a deliberate 1500 ms transport delay. No observation values mocked. Installed Chrome, desktop and touch emulation; not physical phones.', cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 820 }, isMobile: width === 390, hasTouch: width === 390 });
    await context.route(`${base}/data/runtime/**`, async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#tour`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaGuidedTour?.getState().active);
    assert.equal(await page.locator('.gaia-tour-highlight-target').count(), 0, 'Pause is tested while the first target is still loading');
    await page.locator('[data-tour-action="toggle"]').click();
    assert.equal(await page.evaluate(() => GaiaGuidedTour.getState().running), false);
    await page.waitForFunction(() => document.querySelector('.gaia-tour-card')?.dataset.positioned === 'true'
      && document.querySelector('.gaia-tour-highlight-target')?.getClientRects().length > 0, null, { timeout: 20000 });
    const paused = await page.evaluate(() => GaiaGuidedTour.getState());
    assert.equal(paused.index, 0); assert.equal(paused.running, false);
    const elapsed = paused.elapsed;
    await page.waitForTimeout(1800);
    assert.equal(await page.evaluate(() => GaiaGuidedTour.getState().elapsed), elapsed, 'Finishing the current target must not restart the paused timeline');
    for (const index of [1, 2]) {
      await page.locator('[data-tour-action="next"]').click();
      await page.waitForFunction(expected => GaiaGuidedTour.getState().index === expected
        && document.querySelector('.gaia-tour-card')?.dataset.positioned === 'true'
        && document.querySelector('.gaia-tour-highlight-target')?.getClientRects().length > 0, index, { timeout: 20000 });
      assert.equal(await page.evaluate(() => GaiaGuidedTour.getState().running), false);
    }
    await page.screenshot({ path: path.join(output, `${width}-paused-target.png`) });
    await page.locator('[data-tour-action="toggle"]').click();
    assert.equal(await page.evaluate(() => GaiaGuidedTour.getState().running), true);
    await page.locator('[data-tour-action="exit"]').click();
    assert.equal(await page.evaluate(() => GaiaGuidedTour.getState().active), false);
    report.cases.push({ width, status: 'pass', earlyPause: 'keeps target preparation, pauses time, manual steps and resume work' });
    console.log(`PASS ${width}: pause during loading, current target, manual steps, resume and exit`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'pass';
} catch (error) {
  report.status = 'fail'; report.failure = error.stack;
  if (page && !page.isClosed()) { report.state = await page.evaluate(() => ({ tour: GaiaGuidedTour?.getState(), target: document.querySelector('.gaia-tour-highlight-target')?.id, positioned: document.querySelector('.gaia-tour-card')?.dataset.positioned })); await page.screenshot({ path: path.join(output, 'failure.png') }); }
  throw error;
} finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
