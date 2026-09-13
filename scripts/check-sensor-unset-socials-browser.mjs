import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const output = path.resolve(process.argv[3] || 'artifacts/sensor-unset-socials');
const record = process.argv.includes('--record');
const report = { status: 'running', base, record, cases: [], errors: [], files: {} };
fs.mkdirSync(output, { recursive: true });
for (const file of ['scripts/serve-sensor-platform-qa.mjs', 'sensors/sensor-platform.js', 'sensors/index.html']) report.files[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const [width, height] of (record ? [[1440, 900]] : [[1440, 900], [390, 844], [320, 568], [844, 390]])) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, reducedMotion: 'reduce' });
    await context.addInitScript(() => sessionStorage.setItem('gaia:mode-entry-guide:sensor:v3', 'seen'));
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    const openMap = async () => {
      await page.goto(`${base}/sensors/?authenticated=1#map/sensor=sensor_browserqa`, { waitUntil: 'domcontentloaded' });
      await page.locator('.sensor-owner-profile-trigger').click();
      await page.locator('#public-owner-profile').waitFor();
    };
    await openMap();
    const state = await page.evaluate(() => ({
      owner: document.querySelector('#public-owner-profile-name').textContent,
      inlineLinks: [...document.querySelectorAll('#public-sensor-detail .sensor-map-socials a')].map(a => a.href),
      profileLinks: [...document.querySelectorAll('#public-owner-profile-links a')].map(a => a.href),
      text: document.querySelector('#public-owner-profile-links').textContent,
      overflow: document.querySelector('#public-owner-profile').scrollWidth - document.querySelector('#public-owner-profile').clientWidth,
    }));
    report.cases.push({ width, height, state });
    await page.locator('#public-owner-profile').screenshot({ path: path.join(output, `${width}-profile.png`) });
    if (!record) {
      assert.deepEqual(state.inlineLinks, []);
      assert.deepEqual(state.profileLinks, []);
      assert.match(state.text, /SNSリンクは登録されていません/u);
      assert(state.overflow <= 1);
      await page.locator('.sensor-public-profile-back').click();
      await page.locator('#public-owner-profile').waitFor({ state: 'hidden' });
      assert(await page.locator('.sensor-owner-profile-trigger').evaluate(el => el === document.activeElement));
      await page.goto(`${base}/sensors/?authenticated=1#profile`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-view="profile"]').waitFor();
      for (const field of ['xUrl', 'githubUrl', 'instagramUrl']) assert.equal(await page.locator(`#profile-form [name="${field}"]`).inputValue(), '');
      await page.locator('#profile-form button[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('#sensor-status')?.textContent === 'プロフィールを保存しました。');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-view="profile"]').waitFor();
      for (const field of ['xUrl', 'githubUrl', 'instagramUrl']) assert.equal(await page.locator(`#profile-form [name="${field}"]`).inputValue(), '');
      await openMap();
      assert.equal(await page.locator('#public-owner-profile-links a').count(), 0);
      assert.match(await page.locator('#public-owner-profile-links').textContent(), /SNSリンクは登録されていません/u);
    }
    await context.close();
    console.log(`${width}x${height}: ${record ? 'recorded' : 'passed'}`);
  }
  assert.equal(report.errors.length, 0);
  report.status = record ? 'recorded' : 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
