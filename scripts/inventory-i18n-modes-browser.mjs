import fs from 'node:fs';
import { chromium } from 'playwright-core';

const mode = process.argv[2] || 'maps';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const rows = new Map();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.route('https://**', route => route.abort());
  await context.route('**/api/live/v1/firms*', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
  const page = await context.newPage();
  page.on('pageerror', error => console.error(error.message));
  await page.goto(`http://127.0.0.1:4492/${mode === 'maps' ? '#world-08' : '#story'}`);
  await page.waitForFunction(() => !!globalThis.GaiaI18n);
  const scan = async label => {
    const entries = await page.evaluate(() => {
      GaiaI18n.set('ja');
      const entries = new Map();
      const add = (source, where) => {
        if (typeof source !== 'string') return;
        source = source.trim();
        if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(source)) entries.set(source, where);
      };
      const excluded = 'script,style,noscript,pre,code,textarea,input,[translate="no"],[contenteditable],[data-gaia-language],#novel-text,.true-end-message';
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walk.nextNode(); node; node = walk.nextNode()) if (!node.parentElement?.closest(excluded)) add(node.data, node.parentElement?.id || node.parentElement?.className);
      for (const node of document.querySelectorAll('[aria-label],[title],[placeholder],[data-label],[data-map-symbol],[data-map-detail]')) {
        if (node.closest('script,style,noscript,pre,code,[translate="no"],[contenteditable],[data-gaia-language]')) continue;
        for (const attr of ['aria-label','title','placeholder','data-label','data-map-symbol','data-map-detail']) add(node.getAttribute(attr), `${node.id || node.className}@${attr}`);
      }
      const visited = new WeakSet();
      const visit = (value, path) => {
        if (typeof value === 'string') add(value, path);
        if (!value || typeof value !== 'object' || visited.has(value)) return;
        visited.add(value);
        for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
      };
      visit(globalThis.GaiaAppContent, 'GaiaAppContent');
      visit(globalThis.GaiaSpaceScenes, 'GaiaSpaceScenes');
      GaiaI18n.set('en', { persist: false, notify: false });
      const missing = [...entries].filter(([source]) => GaiaI18n.t(source) === source);
      GaiaI18n.set('ja', { persist: false, notify: false });
      return missing;
    });
    for (const [source, where] of entries) {
      if (!rows.has(source)) rows.set(source, { source, selectors: [] });
      rows.get(source).selectors.push(`${label}:${where}`);
    }
    console.log(label, rows.size);
  };
  if (mode === 'maps') {
    for (let number = 1; number <= 71; number++) {
      await page.evaluate(n => { location.hash = `#world-${String(n).padStart(2, '0')}`; }, number);
      await page.waitForFunction(n => Number(document.querySelector('#japan-mode-number')?.textContent) === n && globalThis.GaiaMapPlayback?.getState().ready && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number, { timeout: 45000 });
      await page.evaluate(() => GaiaMapPlayback.stop());
      await scan(`map-${number}`);
    }
  } else {
    await page.waitForFunction(() => !!globalThis.GaiaNovel);
    await page.evaluate(() => GaiaNovel.open(null, { autoStartFresh: true }));
    await page.waitForTimeout(2500);
    await scan('story');
    for (const other of ['gx', 'space', 'character', 'sound']) {
      await page.evaluate(mode => GaiaModeLoader.load(mode), other);
      await scan(other);
    }
  }
  fs.mkdirSync('artifacts/i18n', { recursive: true });
  fs.writeFileSync(`artifacts/i18n/${mode}-untranslated.json`, JSON.stringify([...rows.values()], null, 2));
} finally { await browser.close(); }
