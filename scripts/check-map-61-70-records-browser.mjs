import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { foodValue, foodRowSource, foodFlagText, FOOD_EXHIBITS } from '../src/exploration/food-catalog.js';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/map-61-70-polish-20261022/records');
fs.mkdirSync(output, { recursive: true });
const food = JSON.parse(fs.readFileSync('data/fao-food-balances.json'));
const report = { status: 'running', checks: [], errors: [], environment: 'Local installed Chrome, real bundled data; network failures controlled. Desktop and emulated touch, not physical devices or production.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const settle = () => page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
const choose = async n => {
  await page.evaluate(n => GaiaMapCategories.buttons().find(b => +b.textContent.trim() === n).click(), n);
  await page.waitForFunction(n => n < 70 ? +GaiaMarineCod.definition.number === n && GaiaMarineCod.getState().dataState === 'ready' : GaiaFoodExhibits.getState().id === (n === 70 ? 'food-balances' : 'food-security') && GaiaFoodExhibits.getState().dataState === 'ready', n);
  await page.evaluate(() => GaiaMapPlayback.stop()); await settle();
};
const drawer = async open => {
  const el = page.locator('#map-responsive-data');
  if (await el.isVisible() && (await el.getAttribute('open') !== null) !== open) await el.locator(':scope > summary').click();
};
const openDetails = async width => {
  if (width < 900) await page.locator('[data-mobile-sheet="reading"]').click();
  const root = width < 900 ? page.locator('#map-mobile-sheet') : page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy)');
  const disclosure = root.locator('.gaia-observation-details');
  if (await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
  return root;
};
const closeDetails = async width => { if (width < 900) await page.locator('[data-mobile-sheet-close]').click(); };
try {
  for (const width of [1920, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 844 }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base); await context.route('https://**/*', route => route.abort());
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/world.html#world-61`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().dataState === 'ready');
    await page.evaluate(() => { GaiaModeEntryGuide.close('map', { restoreFocus: false }); GaiaMapPlayback.stop(); }); await settle();
    for (const number of [61, 62, 63, 64]) {
      await choose(number);
      const target = await page.evaluate(() => { const p = GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === 'qualified'); GaiaMarineCod.selectStation(p.id, { focus: false }); return p; });
      const root = await openDetails(width);
      assert.equal((await root.locator('.gaia-observation-source-record dd').allTextContents())[2], target.measurement.text + ' mg/L');
      assert.equal(await page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy)').getAttribute('data-metric-value'), '');
      await page.screenshot({ path: path.join(output, `${width}-${number}-qualifier.png`) }); await closeDetails(width);
      report.checks.push({ width, number, qualifier: target.measurement.text, noInventedZero: true });
    }
    await choose(61); await page.evaluate(() => GaiaMarineCod.setYear(1984));
    await page.waitForFunction(() => GaiaMarineCod.getState().dataState === 'ready');
    const counts = await page.evaluate(() => GaiaMarineCod.getCruisePoints().reduce((a,p) => { a[p.measurement.quality] = (a[p.measurement.quality] || 0) + 1; return a; }, {}));
    assert.equal(counts.measured || 0, 0); assert.equal(counts.qualified, 1439);
    report.checks.push({ width, number: 61, year: 1984, counts });
    for (const number of [65, 66, 67, 68, 69]) {
      await choose(number);
      const target = await page.evaluate(() => { const p = GaiaMarineCod.getCruisePoints().find(p => (p.substances?.length || p.taxa?.length) > 2); GaiaMarineCod.selectStation(p.id, { focus: false }); return p; });
      if (width < 900) await drawer(true);
      await page.locator('[data-cod-records]').click();
      const dialog = page.locator('#gaia-record-detail'); await dialog.waitFor({ state: 'visible' });
      const names = await dialog.locator('[data-record-list] [data-source-name]').allTextContents();
      assert.equal(names.length, target.substances?.length || target.taxa.length);
      if (number >= 68) assert.deepEqual(names, target.taxa.map(code => target.taxonNames[code].join(' / ')));
      else assert((await dialog.locator('[data-record-note]').textContent()).includes(`整理番号：${target.sourceId}。`));
      await dialog.locator('[data-record-search]').fill(String(target.substances?.[0][0] || target.taxa[0]));
      assert((await dialog.locator('[data-record-list]').textContent()).includes(names[0]));
      if (number === 67) {
        const raw = target.substances[0];
        const displayed = await dialog.locator('[data-record-list] li').first().locator('p').allTextContents();
        for (let i = 0; i < 2; i++) assert(displayed[i].includes(raw[5 + i] === null ? '記録なし' : raw[5 + i].toLocaleString('ja-JP', { maximumSignificantDigits: 12 }) + ' kg/年度'));
      }
      await page.screenshot({ path: path.join(output, `${width}-${number}-records.png`) });
      await dialog.locator('[data-record-close]').click(); if (width < 900) await drawer(false);
      report.checks.push({ width, number, sourceId: target.sourceId, recordCount: names.length, nativeSearch: true });
    }
    await choose(69); assert(!await page.evaluate(() => GaiaMarineCod.definition.years.includes(1996)));
    await page.evaluate(() => GaiaMarineCod.setYear(1995));
    await page.waitForFunction(() => GaiaMarineCod.getState().dataState === 'ready');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => GaiaMapPlayback.start()); await page.waitForFunction(() => GaiaMarineCod.getState().year === 1997);
    await page.evaluate(() => GaiaMapPlayback.stop()); await page.emulateMedia({ reducedMotion: 'reduce' });
    report.checks.push({ width, number: 69, autoplaySkipsUnrecorded1996: true });
    await choose(70); if (width < 900) await drawer(true);
    for (const s of food.series) {
      await page.locator('[data-food-series]').selectOption(s.id);
      for (const key of ['Home', 'End']) {
        await page.locator('[data-food-year]').focus(); await page.locator('[data-food-year]').press(key);
        const p = key === 'Home' ? s.periods[0] : s.periods.at(-1);
        const r = p.rows.find(r => r[0] === '392');
        await page.locator('[data-food-country]').selectOption('392');
        assert.equal((await page.evaluate(() => GaiaFoodExhibits.getState())).periodKey, p.key);
        const quantities = await page.locator('.gaia-food-source-record dd.gaia-food-source-quantity').evaluateAll(els => els.map(el => [...el.children].map(span => span.textContent)));
        assert.deepEqual(quantities, [1,2,3].map(i => [Number.isFinite(r?.[i]) ? String(r[i]) : '記録なし', foodFlagText(food, 'food-balances', r, r?.[i + 3])]));
        report.checks.push({ width, number: 70, series: s.id, period: p.key, source: foodRowSource('food-balances', r).id, rawQuantitiesMatch: true });
      }
    }
    // Real source examples: above 100%, missing, numeric zero and old/new FAO.
    for (const [label, predicate] of [ ['above100', r => foodValue('food-balances', r) > 100], ['missing', r => r.slice(1,4).includes(null)], ['zero', r => r[1] === 0 && foodValue('food-balances', r) === 0], ['historic', r => foodRowSource('food-balances', r).id === 'FBSH'], ['modern', r => foodRowSource('food-balances', r).id === 'FBS'] ]) {
      let found;
      for (const s of food.series) { for (const p of s.periods) { const r = p.rows.find(predicate); if (r) { found = { s, p, r }; break; } } if (found) break; }
      assert(found, label); const { s, p, r } = found;
      await page.locator('[data-food-series]').selectOption(s.id); await page.evaluate(key => GaiaFoodExhibits.setPeriod(key), p.key); await page.locator('[data-food-country]').selectOption(r[0]);
      const dd = await page.locator('.gaia-food-source-record dd').allTextContents();
      assert(dd[1].includes(foodRowSource('food-balances', r).label));
      assert.equal(await page.locator('.gaia-food-source-quantity span').first().textContent(), Number.isFinite(r[1]) ? String(r[1]) : '記録なし');
      report.checks.push({ width, number: 70, case: label, series: s.id, period: p.key, country: r[0], ratio: foodValue('food-balances', r) });
    }
    if (width < 900) await drawer(false);
    await choose(71);
    assert.equal(await page.locator('[data-food-reading]').getAttribute('hidden'), '');
    assert.equal(await page.locator('[data-food-source-record]').getAttribute('hidden'), '');
    assert.equal(await page.locator('[data-food-source-record] dd').count(), 0);
    report.checks.push({ width, number: 71, newReadingHiddenAndCleared: true });
    if (width === 1920) for (const language of ['en', 'zh-CN']) {
      await page.evaluate(language => GaiaI18n.set(language), language);
      for (const number of [64, 67, 69]) {
        await choose(number);
        const root = await openDetails(width);
        const text = await root.locator('.gaia-observation-reading').evaluate(el => { const copy = el.cloneNode(true); copy.querySelector('.gaia-observation-source-record').remove(); return copy.textContent; });
        assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text), text);
        if (language === 'en') assert(!/\p{Script=Han}/u.test(text), text);
        await page.screenshot({ path: path.join(output, `${width}-${number}-${language}.png`) });
      }
      await choose(70);
      const strings = await page.evaluate(async () => { const m = await import('/src/exploration/record-reading-catalog.js?v=records-reading-20261022'); return Object.values(m.foodBalanceReading).map(v => [v, GaiaI18n.t(v)]); });
      strings.forEach(([a,b]) => assert.notEqual(a,b));
      report.checks.push({ language, translatedRecordsAndFoodGuidance: true });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []); await context.close(); console.log(`PASS ${width}: qualifiers, record search, food quantities, source transitions and i18n`);
  }
  // Failed downloads cannot leave a new reading panel with the previous source quantities.
  for (const n of [64, 70]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await enforceBrowserSecurity(context, base); await context.route('https://**/*', route => route.abort());
    await context.route(n === 64 ? '**/annual/japan-water-nonylphenol/2016.json.gz*' : '**/data/fao-food-balances.json*', route => route.fulfill({ status: 503, body: 'unavailable' }));
    page = await context.newPage();
    await page.goto(`${base}/world.html#world-${n}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(n => (n === 64 ? globalThis.GaiaMarineCod : globalThis.GaiaFoodExhibits)?.getState().dataState === 'error', n);
    assert(await page.locator(n === 64 ? '[data-cod-year]' : '[data-food-year]').isDisabled());
    assert(await page.locator(n === 64 ? '[data-cod-analysis]' : '[data-food-analysis]').isDisabled());
    report.checks.push({ number: n, controlled503: true, controlsDisabled: true }); await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw e; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
