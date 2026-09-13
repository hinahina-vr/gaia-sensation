import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity, securityHeaders } from './lib/browser-security-qa.mjs';

const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const output = path.resolve(`artifacts/concept-home-link-${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const html = fs.readFileSync(before ? 'artifacts/concept-home-link-before/index.html' : 'concept/index.html', 'utf8');
const report = { status: 'running', before, testedAt: new Date().toISOString(), environment: 'Local Chrome desktop/mobile emulation with CSP; external APIs isolated, not physical-device or production QA', hashes: { 'concept/index.html': createHash('sha256').update(html).digest('hex') }, checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const snap = name => page.screenshot({ path: path.join(output, `${name}.png`) });
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await enforceBrowserSecurity(context, base);
    await context.route(`${base}/api/**`, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"status":"offline","observations":[]}' }));
    if (before) await context.route(`${base}/concept/`, route => route.fulfill({ body: html, headers: securityHeaders, contentType: 'text/html; charset=utf-8' }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/concept/#learning`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.dataset.enhanced === 'true');
    const logo = page.locator('.site-signature');
    await snap(`${width}-concept`);
    if (before) {
      await logo.click();
      await page.waitForURL(`${base}/concept/#top`);
      assert.equal(await page.locator('#page-title').innerText(), '惑星の放課後について');
      report.checks.push({ width, reproduced: 'The logo stays inside the concept page and scrolls to #top' });
    } else {
      assert.equal(await logo.getAttribute('href'), '../');
      assert.equal(await logo.getAttribute('aria-label'), 'サイトのトップページへ');
      const geometry = await logo.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { width: rect.width, height: rect.height, hit: el === hit || el.contains(hit) };
      });
      assert(geometry.hit && geometry.width > 0 && geometry.height > 0, `The existing logo must receive native pointer/touch input: ${JSON.stringify(geometry)}`);
      if (mobile) await logo.tap();
      else { await logo.focus(); await page.keyboard.press('Enter'); }
      await page.waitForURL(`${base}/`);
      await page.locator('#gaia-opening-sound-off').waitFor({ state: 'visible' });
      assert.equal(await page.title(), '惑星の放課後 — GAIA SENSATION');
      await snap(`${width}-fresh-home`);
      await page.locator('#gaia-opening-sound-off').click();
      await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
      await page.waitForTimeout(800);
      if (await page.locator('#gaia-opening-route-guide').isVisible()) await page.keyboard.press('Escape');
      await page.locator('#gaia-opening-concept').click();
      await page.waitForURL(`${base}/concept/`);
      await page.locator('.site-header a[href="#learning"]').click();
      await page.waitForURL(`${base}/concept/#learning`);
      await page.locator('.site-signature').click();
      await page.waitForURL(`${base}/`);
      await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
      await page.waitForTimeout(800);
      assert.equal(await page.locator('#gaia-opening-sound-modal').isVisible(), false, 'A real round trip resumes the existing title menu without replaying sound setup');
      assert.equal(await page.locator('#gaia-opening-route-story').isVisible(), true);
      await snap(`${width}-returned-title`);
      // Page-local navigation remains page-local, including the footer return.
      await page.goto(`${base}/concept/#position`, { waitUntil: 'networkidle' });
      await page.locator('.return-to-world a[href="#top"]').click();
      await page.waitForURL(`${base}/concept/#top`);
      await page.waitForFunction(() => document.querySelector('.site-header')?.dataset.theme === 'light');
      assert.equal(await page.locator('.site-header').getAttribute('data-theme'), 'light');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      report.checks.push({ width, geometry, nativeActivation: mobile ? 'tap' : 'Enter', freshHome: true, actualRoundTripToTitle: true, pageLocalNavigationPreserved: true });
    }
    await snap(`${width}-result`);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  if (page && !page.isClosed()) await snap('failure').catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
