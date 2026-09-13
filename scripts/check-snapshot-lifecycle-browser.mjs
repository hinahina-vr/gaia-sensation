import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4487';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/release-prtr-20260909/snapshot-lifecycle');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', base, conditions: 'Installed Chrome desktop/touch emulation. Delayed original runtime JSON, injected persisted/non-persisted pagehide events, explicit HTTP 503 fault. No production data writes.', cases: [] };
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1280, 390]) for (const scenario of ['dispose', 'bfcache', 'http-error']) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width === 390, hasTouch: width === 390 });
    const page = await context.newPage();
    const result = { width, scenario, consoleErrors: [], pageErrors: [], signalErrors: 0, status: 'running' };
    report.cases.push(result);
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    page.on('pageerror', error => result.pageErrors.push(error.message));
    await page.addInitScript(() => { globalThis.__snapshotSignalErrors = 0; addEventListener('gaia:signals-error', () => globalThis.__snapshotSignalErrors++); });
    await context.route(`${base}/data/runtime/**`, async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (scenario === 'http-error') await route.fulfill({ status: 503, body: 'deliberate test failure' });
      else await route.continue();
    });
    const requestStarted = page.waitForRequest(request => request.url().includes('/data/runtime/'));
    await page.goto(`${base}/?exhibit=6#world`, { waitUntil: 'domcontentloaded' });
    await requestStarted;
    if (scenario !== 'http-error') await page.evaluate(persisted => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted })), scenario === 'bfcache');
    if (scenario === 'bfcache') await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter?.getState().signalReady, null, { timeout: 20000 });
    else if (scenario === 'http-error') await page.waitForFunction(() => globalThis.__snapshotSignalErrors > 0, null, { timeout: 10000 });
    else await page.waitForTimeout(1800);
    result.signalErrors = await page.evaluate(() => globalThis.__snapshotSignalErrors);
    assert.deepEqual(result.pageErrors, []);
    if (scenario === 'http-error') {
      assert(result.consoleErrors.some(message => message.includes('503')), 'Actual HTTP errors remain reported');
      assert(result.signalErrors > 0, 'Actual failures still notify the UI');
    } else {
      assert.deepEqual(result.consoleErrors, [], 'Owner teardown/BFCache are not data failures');
      assert.equal(result.signalErrors, 0, 'Owner teardown must not repaint the old page with a failure');
    }
    result.status = 'pass'; console.log(`PASS ${width}: ${scenario}`);
    await context.close();
  }
  report.status = 'pass';
} catch (error) { report.status = 'fail'; report.failure = error.stack; throw error; }
finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
