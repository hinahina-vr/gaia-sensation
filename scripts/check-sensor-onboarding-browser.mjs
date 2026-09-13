import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const baseline = process.argv.includes('--baseline');
const output = path.resolve(process.env.GAIA_SENSOR_ONBOARDING_OUTPUT || 'artifacts/sensor-onboarding');
fs.mkdirSync(output, { recursive: true });
const source = stripTypeScriptTypes(fs.readFileSync('sensor-platform/src/measurements.ts', 'utf8')).replace(/^import .*;\s*/mu, '').replace(/\bexport /gu, '');
const catalogue = vm.runInNewContext(`${source}\nlistMeasurementTypes()`, { json: value => value });
const server = spawn(process.execPath, ['scripts/serve-sensor-platform-qa.mjs', '4499'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const report = { mode: baseline ? 'baseline' : 'regression', api: 'local mock; real catalogue', physicalEsp32: 'not tested', checks: [], errors: [] };
report.artifact = {
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source: baseline ? 'HEAD HTML and JavaScript routed read-only to the browser' : 'working tree',
  sha256: baseline ? null : Object.fromEntries(['sensors/index.html', 'sensors/sensor-platform.js', 'sensors/sensor-onboarding.js', 'sensors/sensor-onboarding.css'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
};
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('QA server timeout')), 10000);
    server.once('error', reject);
    server.stdout.on('data', data => { if (data.toString().includes('sensor qa')) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  if (process.argv.includes('--read-public')) {
    const publicPage = await browser.newPage();
    try {
      await publicPage.goto('https://gaia-senseware.pages.dev/sensors/#guide', { waitUntil: 'domcontentloaded' });
      report.publicGuide = await publicPage.locator('[data-view="guide"]').textContent();
    } catch (error) { report.publicRead = error.message.split('\n')[0]; }
    await publicPage.close();
  }
  for (const [width, height] of [[1440,900], [1024,768], [390,844], [320,568]]) {
    await fetch('http://127.0.0.1:4499/__qa/reset', { method: 'POST' });
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    if (!baseline) await page.clock.install();
    if (baseline) {
      const originalHtml = execFileSync('git', ['show', 'HEAD:sensors/index.html'], { encoding: 'utf8' });
      const originalJs = execFileSync('git', ['show', 'HEAD:sensors/sensor-platform.js'], { encoding: 'utf8' });
      await page.route('**/sensors/?*', route => route.fulfill({ contentType: 'text/html', body: originalHtml }));
      await page.route('**/sensors/sensor-platform.js?*', route => route.fulfill({ contentType: 'text/javascript', body: originalJs }));
    }
    page.on('pageerror', error => report.errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem('gaia:mode-entry-guide:sensor:v3', 'seen'));
    await page.route('**/api/public/v1/measurement-types', route => route.fulfill({ json: catalogue }));
    await page.goto('http://127.0.0.1:4499/sensors/?authenticated=1#devices', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-view="devices"]').waitFor({ state: 'visible' });
    await page.locator('#show-add:visible, [data-action="show-add"]:visible').first().click();
    await page.locator('[data-view="add"]').waitFor({ state: 'visible' });
    await snapshot(page, `${baseline ? 'before' : 'after'}-${width}-register.png`);
    const layout = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      height: document.querySelector('[data-view="add"]').getBoundingClientRect().height,
      openCategories: document.querySelectorAll('[data-measurement-picker="add"] [data-measurement-category][open]').length,
      countryTop: document.querySelector('#device-form select[name="countryCode"]').getBoundingClientRect().top,
    }));
    assert.equal(layout.overflowX, false);
    report.checks.push({ width, layout });
    if (!baseline) await checkFlow(page, width);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack; process.exitCode = 1;
} finally {
  await browser?.close(); server.kill();
  fs.writeFileSync(path.join(output, `${report.mode}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, mode: report.mode, checks: report.checks.map(({ width, layout, flow }) => ({ width, layout, flow })), errors: report.errors, failure: report.error }, null, 2));
}

async function checkFlow(page, width) {
  const picker = page.locator('[data-measurement-picker="add"]');
  const form = page.locator('#device-form');
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  const checkConnection = async () => { await page.locator('#pairing-complete').click(); await page.waitForFunction(() => !document.querySelector('#pairing-complete').disabled); };
  let posts = [];
  let ownerDevices = [];
  let listFails = false;
  const fakeCode = 'TEST-CODE';
  await page.route('**/api/web/v1/devices', route => route.fulfill({ status: listFails ? 503 : 200, json: listFails ? { error: { message: 'QA service unavailable' } } : { devices: ownerDevices } }));
  await page.route('**/api/web/v1/devices/pairing', route => {
    posts.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { pairingCode: fakeCode, expiresAt: new Date(Date.now() + 600000).toISOString() } });
  });
  assert.equal(await picker.locator('[data-measurement-category][open]').count(), 0);
  assert.equal(await picker.locator('.sensor-selected-measurements button').count(), 3);
  await form.locator('[name="name"]').fill(`QA観測点 ${width}`);
  await picker.locator('.sensor-measurement-editor > summary').click();
  await picker.getByRole('button', { name: '水質', exact: true }).click();
  assert.deepEqual(await picker.locator('input[name="measurementKeys"]:checked').evaluateAll(inputs => inputs.map(input => input.value)), ['water_temperature', 'ph', 'turbidity']);
  const search = picker.getByRole('searchbox');
  await search.fill('ＤＳ１８Ｂ２０');
  assert(await picker.locator('.sensor-measurement-option:visible').count() > 0);
  await search.fill('does-not-exist-qa');
  assert.equal(await picker.locator('.sensor-measurement-option:visible').count(), 0);
  await search.fill('');
  assert.equal(await picker.locator('[data-measurement-category][open]').count(), 0);
  await picker.locator('[data-measurement-category]').first().locator('summary').click();
  for (let i = 0; i < 13; i++) await picker.locator('input[name="measurementKeys"]:visible:enabled:not(:checked)').first().check();
  assert.equal(await picker.locator('input[name="measurementKeys"]:checked').count(), 16);
  assert.equal(await picker.locator('input[name="measurementKeys"]:enabled:not(:checked)').count(), 0);
  await picker.getByRole('button', { name: '水質', exact: true }).click();
  await picker.locator('.sensor-measurement-editor > summary').click();
  await noOverflow();

  await form.locator('[name="countryCode"]').selectOption('JP');
  await form.locator('[name="subdivisionCode"]').selectOption('JP-13');
  await form.locator('[name="municipalityCode"]').selectOption('131130');
  await page.waitForFunction(() => document.querySelector('#device-form [name="publicLatitude"]').value !== '0');
  await form.locator('[data-location-picker]').click({ position: { x: 60, y: 60 } });
  const latitude = await form.locator('[name="publicLatitude"]').inputValue();
  await form.locator('[name="acceptTerms"]').check();
  await form.locator('button[type="submit"]').click();
  assert.equal(posts.length, 0, 'Preparation confirmation is required before issuing a code');
  await form.locator('[name="firmwareReady"]').check();
  // Zero selections must not create a pairing request.
  while (await picker.locator('.sensor-selected-measurements button').count()) await picker.locator('.sensor-selected-measurements button').first().click();
  await form.locator('button[type="submit"]').click();
  assert.equal(posts.length, 0);
  await picker.locator('.sensor-measurement-editor > summary').click();
  await picker.getByRole('button', { name: '水質', exact: true }).click();
  await picker.locator('.sensor-measurement-editor > summary').click();

  // Return to preparation, use the actual clipboard, and retain the draft.
  await page.locator('[data-action="prepare"]').click();
  assert.equal(await page.locator('html').getAttribute('data-sensor-view'), 'devices');
  await page.waitForFunction(() => document.querySelector('#sensor-prepare-help').open);
  await page.locator('[data-copy-setup="prepare"]').click();
  const prepare = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/gu, '\n');
  for (const part of ['github.com/hinahina-vr/gaia-senseware', 'README.md', 'COMポート', 'SHA-256', 'USBへアクセスできない', '全フラッシュ']) assert(prepare.includes(part), part);
  await page.locator('#sensor-existing-help > summary').click();
  await page.locator('[data-copy-setup="existing"]').click();
  const existing = await page.evaluate(() => navigator.clipboard.readText());
  assert(existing.includes('診断だけ'));
  assert(existing.includes('端末削除・再登録・BOOT長押し・再書き込み・認証情報の消去はしない'));
  assert.equal(posts.length, 0, 'Existing-device guidance cannot register or reset a device');
  await snapshot(page, `${width}-devices-help.png`);
  await page.locator('#sensor-prepare-help > summary').click();
  await page.locator('#sensor-existing-help > summary').click();
  await snapshot(page, `${width}-devices.png`);
  report.checks.at(-1).hub = await page.evaluate(() => ({ view: document.documentElement.dataset.sensorView, styles: [...document.styleSheets].map(sheet => ({ href: sheet.href, disabled: sheet.disabled, rules: sheet.cssRules.length })), button: getComputedStyle(document.querySelector('#show-add')).display, hub: getComputedStyle(document.querySelector('.sensor-hub-choices')).display }));
  await page.locator('#show-add').click();
  assert.equal(await form.locator('[name="name"]').inputValue(), `QA観測点 ${width}`);
  assert.equal(await form.locator('[name="publicLatitude"]').inputValue(), latitude);
  assert.equal(await form.locator('[name="municipalityCode"]').inputValue(), '131130');
  assert.equal(await form.locator('[name="firmwareReady"]').isChecked(), true);
  await form.locator('button[type="submit"]').click();
  await page.locator('#sensor-pairing-panel').waitFor({ state: 'visible' });
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].measurementKeys, ['water_temperature', 'ph', 'turbidity']);
  assert.equal(posts[0].municipalityCode, '131130');
  assert.equal(posts[0].publicLatitude, Number(latitude));
  assert.equal(posts[0].isPublic, true);
  assert.equal(await page.locator('html').getAttribute('data-sensor-view'), 'devices');
  assert.equal(new URL(page.url()).hash, '#devices');
  assert.equal(await page.locator('#sensor-pairing-panel').evaluate(node => node.closest('[data-view]')?.dataset.view), 'devices');
  assert.equal(await page.locator('#device-list article').count(), 0, 'Issuing a code does not create a device');
  await page.locator('#copy-pairing').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fakeCode);
  await page.locator('[data-copy-setup="connect"]').click();
  const connect = await page.evaluate(() => navigator.clipboard.readText());
  assert(connect.includes('GAIA_USB_PROVISION'));
  assert(connect.includes('115200'));
  assert(!connect.includes(fakeCode), 'Reusable prompt must not include a pairing secret');
  await checkConnection();
  assert.match(await page.locator('#pairing-connection-status').textContent(), /まだこの名前/u);
  await page.locator('#show-add').click();
  assert.equal(await page.locator('html').getAttribute('data-sensor-view'), 'devices');
  assert.equal(posts.length, 1, 'Pending code prevents accidental duplicate registration');
  await page.locator('.sensor-topbar [data-nav="guide"]').click();
  await page.locator('#guide .sensor-guide-finish [data-nav="devices"]').click();
  assert.equal(await page.locator('#pairing-code').textContent(), fakeCode, 'Guide round trip retains code');
  assert.equal(await page.evaluate(code => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(code), fakeCode), false, 'Pairing secrets must not be persisted in browser storage');
  await noOverflow();
  await snapshot(page, `${width}-pairing.png`);
  listFails = true;
  await checkConnection();
  assert.match(await page.locator('#pairing-connection-status').textContent(), /取得できません/u);
  assert.equal(await page.locator('#pairing-code').textContent(), fakeCode);
  listFails = false;
  ownerDevices = [{ deviceId: 'dev_browser_qa', name: `QA観測点 ${width}`, countryCode: 'JP', state: 'ONLINE', lastSeenAt: new Date().toISOString(), measurementKeys: ['water_temperature','ph','turbidity'] }];
  await checkConnection();
  assert.match(await page.locator('#pairing-connection-status').textContent(), /一覧を更新しました/u);
  await page.locator('#device-list article button').click();
  await page.locator('[data-view="detail"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#detail-state').textContent(), 'ONLINE');
  // Shared compact picker still supports editing and saving existing devices.
  const edit = page.locator('#location-form');
  await edit.locator('.sensor-measurement-editor > summary').click();
  await edit.getByRole('button', { name: '気温・湿度', exact: true }).click();
  await edit.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#sensor-status').textContent.includes('更新'));
  const qa = await (await fetch('http://127.0.0.1:4499/__qa/report')).json();
  assert.deepEqual(qa.lastDeviceDraft.measurementKeys, ['temperature','humidity']);
  await page.locator('.sensor-topbar [data-nav="devices"]').click();
  await page.clock.fastForward(601000);
  assert.match(await page.locator('#pairing-expiry').textContent(), /端末の削除は不要/u);
  assert.equal(await page.locator('#copy-pairing').isDisabled(), true);
  assert.equal(await page.locator('#pairing-code').textContent(), '期限切れ');
  await page.locator('#pairing-retry').click();
  assert.equal(await form.locator('[name="name"]').inputValue(), `QA観測点 ${width}`);
  assert.equal(posts.length, 1, 'Expired retry returns to form, never auto-creates or deletes');
  await page.locator('.sensor-topbar [data-nav="devices"]').click();
  await page.locator('#sensor-existing-help > summary').click();
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('QA clipboard denied'); } }));
  await page.locator('[data-copy-setup="existing"]').click();
  assert((await page.evaluate(() => getSelection().toString())).includes('診断だけ'));
  await noOverflow();
  const finalQa = await (await fetch('http://127.0.0.1:4499/__qa/report')).json();
  assert.equal(finalQa.requests.some(request => request.method === 'DELETE'), false);
  report.checks.at(-1).flow = '1–16 items, presets, search, readiness, location, draft preservation, all prompts + clipboard fallback, inline code, no premature device, no duplicate, guide round trip, poll success/failure, detail edit/save, expiration/retry, no deletion';
}

async function snapshot(page, name) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  if (!baseline) await page.clock.runFor(3000);
  else await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(output, name), fullPage: true });
}
