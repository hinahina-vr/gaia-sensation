import fs from 'node:fs';
import { chromium } from 'playwright-core';
const input = process.argv[2] || 'artifacts/i18n/maps-untranslated.json';
const output = process.argv[3] || 'artifacts/i18n/maps-pending.json';
const url = process.argv[4] || 'http://127.0.0.1:4492/';
const entries = JSON.parse(fs.readFileSync(input, 'utf8'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(() => !!globalThis.GaiaLanguagePreference);
  const translated = await page.evaluate(entries => {
    GaiaI18n.set('en');
    const english = entries.map(({source}) => GaiaI18n.t(source));
    GaiaI18n.set('zh-CN');
    return entries.map((entry, i) => ({ ...entry, en: english[i], 'zh-CN': GaiaI18n.t(entry.source) }));
  }, entries);
  const pending = translated.filter(row => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(row.en) || /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(row['zh-CN']));
  fs.writeFileSync(output, JSON.stringify(pending, null, 2));
  console.log(JSON.stringify({ input: entries.length, pending: pending.length, output }));
} finally { await browser.close(); }
