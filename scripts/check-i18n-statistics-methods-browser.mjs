import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { METHOD_LOOKUP } from '../statistics-methods.js';
const out = 'artifacts/i18n/statistics-methods'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { status: 'running', scope: 'Local Chrome: all 26 method selectors, real bundled datasets and calculations, desktop/mobile and EN/ZH. No external AI requests.', checks: [], errors: [] };
report.sha256 = Object.fromEntries(['gaia-i18n.js', 'statistics-lab.js', ...fs.readdirSync('locales').filter(f => f.startsWith('ui-statistics')).map(f => `locales/${f}`)].map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
let page;
try {
  for (const width of [1440, 390]) for (const language of ['en', 'zh-CN']) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390, reducedMotion: 'reduce' });
    await context.route('https://**', route => route.abort());
    await context.addInitScript(language => localStorage.setItem('gaia:language:v1', language), language);
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('net::ERR_FAILED')) console.log('BROWSER:', message.text()); });
    await page.goto('http://127.0.0.1:4492/#world-26');
    await page.waitForFunction(() => window.GaiaMapPlayback?.getState().ready);
    await page.evaluate(async () => { GaiaMapPlayback.stop(); GaiaModeEntryGuide.close('map', { restoreFocus: false }); await GaiaModeLoader.load('statistics'); });
    await page.waitForFunction(() => !!window.GaiaMapObservationAdapter);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); });
    for (const [id, method] of METHOD_LOOKUP) {
      const datasetId = id === 'paired' ? 'jma-co2' : id === 'discrete' ? 'earthquakes' : ['categorical', 'fisher'].includes(id) ? 'forest-urban' : ['multiple', 'anova', 'logistic'].includes(id) ? 'renewables' : 'co2-trend';
      await page.evaluate(async ({ datasetId, group }) => {
        await GaiaStatisticsLab.open({ datasetId });
        const select = document.querySelector('#gaia-statistics-lectures'); select.value = group; select.dispatchEvent(new Event('change'));
      }, { datasetId, group: method.group.id });
      await page.locator('#gaia-statistics-menu-toggle').click();
      await page.locator(`[data-method="${id}"]`).click();
      await page.waitForFunction(id => GaiaStatisticsLab.getState().analysisReady && GaiaStatisticsLab.getState().methodId === id, id);
      const views = [];
      for (const view of ['chart', 'findings', 'values', 'records', 'insights']) {
        await page.locator(`[data-stat-view="${view}"]`).click(); await page.waitForTimeout(100);
        const scan = await page.locator('#gaia-statistics-lab').evaluate(root => ({
          text: root.innerText,
          aria: [...root.querySelectorAll('[aria-label],[title]')].filter(el => el.checkVisibility()).map(el => el.getAttribute('aria-label') || el.title),
          rootOverflow: root.scrollWidth > root.clientWidth + 1,
          rootSizes: { scroll: root.scrollWidth, client: root.clientWidth, overflowX: getComputedStyle(root).overflowX },
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          canvases: [...root.querySelectorAll('canvas')].filter(el => el.checkVisibility()).map(el => ({ width: el.width, height: el.height })),
        }));
        const japanese = language === 'en' ? /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u : /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
        const bad = [scan.text, ...scan.aria].filter(text => japanese.test(text));
        assert.deepEqual(bad, [], `${id}/${language}/${width}/${view}: untranslated UI`);
        report.lastScan = { width, language, id, view, ...scan };
        // The closed settings drawer intentionally sits outside the clipped overlay.
        assert(!scan.pageOverflow && (!scan.rootOverflow || ['hidden', 'clip'].includes(scan.rootSizes.overflowX)), `${id}/${language}/${width}/${view}: horizontal overflow ${JSON.stringify(scan.rootSizes)}`);
        assert(scan.canvases.every(c => c.width > 0 && c.height > 0));
        if (['chart', 'findings'].includes(view)) await page.screenshot({ path: `${out}/${width}-${language}-${id}-${view}.png` });
        views.push({ view, ...scan });
      }
      const unchanged = await page.evaluate(async ({ id, language }) => {
        const state = GaiaStatisticsLab.getState(); const original = await GaiaStatisticsLab.run(id);
        GaiaI18n.set('ja'); const restored = await GaiaStatisticsLab.run(id);
        const next = GaiaStatisticsLab.getState(); GaiaI18n.set(language);
        return { calculation: JSON.stringify(original) === JSON.stringify(restored), dataset: state.datasetId === next.datasetId, method: state.methodId === next.methodId };
      }, { id, language });
      assert(unchanged.calculation && unchanged.dataset && unchanged.method, `${id}: language changed the analysis`);
      report.checks.push({ width, language, id, datasetId, unchanged, views });
      console.log(`${width}/${language}/${id}: passed`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); process.exitCode = 1; }
finally { fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure })); }
