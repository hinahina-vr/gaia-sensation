import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
const inventory = process.argv.includes('--inventory');
const out = 'artifacts/i18n/sensor-platform';
fs.mkdirSync(out, { recursive: true });
const source = stripTypeScriptTypes(fs.readFileSync('sensor-platform/src/measurements.ts', 'utf8')).replace(/^import .*;\s*/mu, '').replace(/\bexport /gu, '');
const catalogue = vm.runInNewContext(`${source}\nlistMeasurementTypes()`, { json: value => value });
const server = process.env.GAIA_SENSOR_QA_EXTERNAL ? null : spawn(process.execPath, ['scripts/serve-sensor-platform-qa.mjs', '4528'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const report = { status: 'running', scope: 'Local real UI in Chrome with a local fixture API and the real measurement catalogue. No production account, AI service or physical device access.', checks: [], errors: [] };
const originals = new Map(); let browser, page;
try {
  if (server) await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('QA server timeout')), 10000);
    server.once('error', reject);
    server.stderr.on('data', chunk => report.errors.push(chunk.toString()));
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`QA server exited: ${code}; ${report.errors.join(' ')}`)); });
    server.stdout.on('data', chunk => { if (chunk.toString().includes('sensor qa')) { clearTimeout(timeout); resolve(); } });
  });
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const width of (inventory ? [1440] : [1440, 390])) for (const language of (inventory ? ['en'] : ['en', 'zh-CN'])) {
    await fetch('http://127.0.0.1:4528/__qa/reset', { method: 'POST' });
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    await context.route('https://**', route => route.abort());
    await context.route('**/api/public/v1/measurement-types', route => route.fulfill({ json: catalogue }));
    await context.addInitScript(language => { localStorage.setItem('gaia:language:v1', language); sessionStorage.setItem('gaia:mode-entry-guide:sensor:v3', 'seen'); }, language);
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    const scan = async label => {
      await page.waitForTimeout(180);
      const result = await page.evaluate(({ language, inventory }) => {
        const rows = [];
        if (inventory) GaiaI18n.set('ja');
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement.closest('script,style,code,pre,input,textarea,[translate=no]')) continue;
          if (!inventory && !node.parentElement.checkVisibility()) continue;
          const text = node.data.trim();
          if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text)) rows.push(text);
        }
        if (inventory) GaiaI18n.set(language);
        return { rows: [...new Set(rows)], overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
      }, { language, inventory });
      if (inventory) for (const source of result.rows) { if (!originals.has(source)) originals.set(source, new Set()); originals.get(source).add(label); }
      else {
        assert.equal(result.overflowX, false, `${width}/${language}/${label}: horizontal overflow`);
        const bad = result.rows.filter(s => (language === 'en' ? /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u : /[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(s));
        assert.deepEqual(bad, [], `${width}/${language}/${label}: untranslated UI`);
        await page.screenshot({ path: `${out}/${width}-${language}-${label}.png` });
      }
      report.checks.push({ width, language, label, overflowX: result.overflowX });
    };
    await page.goto('http://127.0.0.1:4528/sensors/#login');
    await page.locator('[data-view=login]').waitFor({ state: 'visible' });
    await scan('login');
    await page.locator('#participation-info-open').click(); await scan('participation');
    await page.locator('#participation-info [data-nav=terms]').click(); await scan('terms');
    await page.locator('.sensor-topbar [data-nav=guide]').click();
    await page.waitForFunction(() => document.querySelectorAll('.sensor-measurement-item').length > 40);
    await scan('connection-guide');
    const catalogSearch = page.locator('#measurement-catalog-search');
    await catalogSearch.fill(language === 'en' ? 'turbidity' : '浊度');
    await scan('measurement-search');
    assert(await page.locator('.sensor-measurement-item:visible').count() > 0, 'Search must find a translated label');
    await catalogSearch.fill('');
    await page.locator('#sensor-guide-copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert(copied.includes('4,194,304 bytes') && copied.includes('SHA-256') && copied.includes('Device Token') && copied.includes('Secure Boot'));
    assert(!(language === 'en' ? /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u : /[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(copied), 'Copied setup request must use selected language');
    await page.goto('http://127.0.0.1:4528/sensors/?authenticated=1#devices');
    await page.locator('[data-view=devices]').waitFor({ state: 'visible' }); await scan('devices');
    await page.locator('#show-add').click(); await scan('register');
    await page.locator('[data-measurement-picker=add] .sensor-measurement-editor > summary').click();
    const pickerSearch = page.locator('[data-measurement-picker=add] input[type=search]');
    await pickerSearch.fill(language === 'en' ? 'turbidity' : '浊度');
    assert(await page.locator('[data-measurement-picker=add] .sensor-measurement-option:visible').count() > 0, 'Registration picker must search translated labels');
    await pickerSearch.fill('');
    await page.locator('[data-measurement-picker=add] .sensor-measurement-editor > summary').click();
    await page.locator('#device-form [name=name]').fill('そのまま残す / Test garden');
    await page.locator('.sensor-topbar [data-nav=profile]').click(); await scan('profile');
    await page.locator('.sensor-account-delete > summary').click();
    const input = page.locator('#sensor-account-delete-form input[name=confirmation]');
    for (const [locale, token] of [['en', 'DELETE'], ['zh-CN', '删除'], ['ja', '削除'], [language, language === 'en' ? 'DELETE' : '删除']]) {
      await page.evaluate(locale => GaiaI18n.set(locale), locale);
      assert.equal(await input.getAttribute('pattern'), token); assert.equal(await input.getAttribute('maxlength'), String(token.length));
      for (const [value, expected] of [['', false], ['X', false], [token, true]]) {
        await input.fill(value); assert.equal(await input.evaluate(el => el.checkValidity()), expected, `${locale}: ${value} validity`);
      }
    }
    await scan('delete-confirmation');
    if (!inventory) {
      const dialogs = [];
      const listener = async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); };
      page.on('dialog', listener);
      await page.locator('#sensor-account-delete-submit').click();
      assert.equal(dialogs.length, 1); assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(dialogs[0]), 'Account confirmation must use selected language');
      page.off('dialog', listener);
    }
    await page.locator('.sensor-topbar [data-nav=devices]').click(); await page.locator('#show-add').click();
    assert.equal(await page.locator('#device-form [name=name]').inputValue(), 'そのまま残す / Test garden', 'Language changes must preserve draft input');
    await page.locator('.sensor-topbar [data-nav=map]').click(); await scan('public-map');
    if (inventory) {
      const translated = await page.evaluate(sources => { GaiaI18n.set('en'); return sources.map(source => ({ source, en: GaiaI18n.t(source) })); }, [...originals.keys()]);
      fs.writeFileSync('artifacts/i18n/sensor-runtime-latest.json', JSON.stringify(translated.filter(row => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(row.en)).map(row => ({ ...row, views: [...originals.get(row.source)] })), null, 2));
    }
    const qa = await (await fetch('http://127.0.0.1:4528/__qa/report')).json();
    assert(!qa.requests.some(request => ['DELETE', 'PUT', 'POST'].includes(request.method)), 'Read-only UI checks must not mutate accounts, sensors or observations');
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); process.exitCode = 1; }
finally { await browser?.close(); server?.kill(); fs.writeFileSync(`${out}/${inventory ? 'inventory' : 'report'}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure })); }
