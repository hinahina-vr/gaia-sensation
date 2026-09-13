import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/selected-title-ending-2026-09-10/sound');
fs.mkdirSync(output, {recursive: true});
const report = {status: 'running', checks: [], errors: [], sha256: createHash('sha256').update(fs.readFileSync('sound-mode.js')).digest('hex'),
  scope: 'Local Chrome, production CSP, real image decoding and native track selection, seeded heard-track history. This checks artwork, not real listening or unlock qualification.'};
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({viewport: {width, height: width === 1440 ? 900 : 844}, reducedMotion: 'reduce', hasTouch: width < 900, isMobile: width < 900});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      localStorage.setItem('gaia-senseware-heard-tracks:v1', JSON.stringify({version: 1, tracks: ['ending']}));
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(base + '/#sound', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.querySelector('#sound-layer')?.classList.contains('is-open') && document.querySelector('#gaia-boot')?.hidden);
    const button = page.locator('[data-sound-track="ending"]');
    if (width < 900) await button.tap(); else await button.click();
    await page.waitForFunction(() => document.querySelector('.sound-cover-art img')?.src.includes('01-turning-in-the-sunset.webp'));
    const cover = page.locator('.sound-cover-art img');
    await cover.evaluate(image => image.decode());
    assert.equal(await cover.evaluate(image => image.naturalWidth), 1672);
    assert(await cover.isVisible());
    await cover.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({path: path.join(output, `${width}-ending-cover.png`)});
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    report.checks.push({width, src: await cover.getAttribute('src'), check: 'Native ending track selection uses the selected artwork'});
    await context.close();
    console.log(`PASS ${width}: selected ending cover`);
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
