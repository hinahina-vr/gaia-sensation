import fs from 'node:fs';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4492/');
  await page.waitForFunction(() => !!globalThis.GaiaI18n);
  const entries = await page.evaluate(() => {
    GaiaI18n.set('ja');
    const entries = new Map();
    const add = (source, where) => {
      source = source.trim();
      if (!source || !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(source)) return;
      if (!entries.has(source)) entries.set(source, []);
      entries.get(source).push(where);
    };
    const scan = root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement?.closest('script,style,textarea,[translate="no"],[data-gaia-language]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) add(node.data, node.parentElement?.id || node.parentElement?.className || node.parentElement?.tagName);
      for (const node of root.querySelectorAll('[aria-label],[title],[placeholder]')) for (const attr of ['aria-label', 'title', 'placeholder']) if (node.hasAttribute(attr)) add(node.getAttribute(attr), `${node.id || node.tagName}@${attr}`);
    };
    scan(document.body);
    for (const template of document.querySelectorAll('template')) scan(template.content);
    GaiaI18n.set('en');
    return [...entries].filter(([source]) => GaiaI18n.t(source) === source).map(([source, selectors]) => ({ source, selectors }));
  });
  fs.mkdirSync('artifacts/i18n', { recursive: true });
  fs.writeFileSync('artifacts/i18n/ui-untranslated.json', JSON.stringify(entries, null, 2));
  console.log(`Static main-page/template untranslated entries: ${entries.length}`);
} finally { await browser.close(); }
