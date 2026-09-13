import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity, securityHeaders } from './lib/browser-security-qa.mjs';

const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const output = path.resolve(`artifacts/opening-location-${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const html = fs.readFileSync(before ? 'artifacts/opening-location-before/index.html' : 'index.html', 'utf8');
const report = { status: 'running', before, testedAt: new Date().toISOString(), environment: 'Local Chrome with desktop/mobile emulation and CSP; external services isolated, not physical-device or production QA', hashes: { 'index.html': createHash('sha256').update(html).digest('hex') }, checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, isMobile: width < 600, reducedMotion: 'no-preference' });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await enforceBrowserSecurity(context, base);
    await context.route(`${base}/api/**`, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"status":"offline","observations":[]}' }));
    if (before) await context.route(`${base}/`, route => route.fulfill({ body: html, headers: securityHeaders, contentType: 'text/html; charset=utf-8' }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-opening-sound-off').click();
    await page.locator('#gaia-opening.is-active').waitFor({ state: 'attached' });
    await page.waitForTimeout(2050);
    const label = page.locator('.gaia-vn-season');
    if (before) {
      assert.equal(await label.innerText(), '逗子 / 近未来');
      assert.equal(await label.isVisible(), true);
      assert(Number(await label.evaluate(el => getComputedStyle(el).opacity)) > 0, 'Reproduce visibly painted location label');
    } else {
      assert.equal(await label.count(), 0, 'Remove the element, not just hide the text');
      assert.doesNotMatch(await page.locator('#gaia-opening').textContent(), /逗子 \/ 近未来/u);
    }
    assert.equal(await page.locator('.gaia-vn-prologue-lockup h2').textContent(), '「はじめまして。」');
    if (before) assert.equal(await page.locator('.gaia-vn-project').textContent(), '序章 / 逗子海岸', 'Historical fixture retains the then-unrequested label');
    else assert.equal(await page.locator('.gaia-vn-project').count(), 0, 'The prologue label was also removed by request on 2026-09-12');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: path.join(output, `${width}-prologue.png`) });
    await page.locator('#gaia-opening-skip').click();
    await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    await page.waitForTimeout(900);
    if (await page.locator('#gaia-opening-route-guide').isVisible()) await page.keyboard.press('Escape');
    assert.equal(await page.locator('#gaia-opening-concept').isVisible(), true);
    assert.equal(await page.locator('#gaia-opening-route-story').isVisible(), true);
    await page.screenshot({ path: path.join(output, `${width}-title.png`) });
    if (!before) {
      await page.locator('#gaia-opening-route-story').click();
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await page.locator('#gaia-story-prologue button:first-of-type').click();
      await page.locator('#novel-runtime').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('#novel-text')?.textContent.trim().length > 10);
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ width, height, label: before ? 'reproduced' : 'removed', prologuePreserved: true, skipToTitle: true, storyEntry: !before });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
