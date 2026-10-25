import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/map-31-40-polish-20261022/interactions');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', checks: [], errors: [], environment: 'Local Chrome; external requests blocked; mobile is touch emulation; controlled HTTP 503 for failure test.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const settle = () => page.waitForFunction(() => GaiaMarineCod.getState().dataState === 'ready' && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
const choose = async number => {
  await page.evaluate(number => GaiaMapCategories.buttons().find(b => Number(b.textContent.trim()) === number).click(), number);
  await page.waitForFunction(number => Number(GaiaMarineCod.definition.number) === number && GaiaMarineCod.getState().dataState === 'ready', number);
  await page.evaluate(() => GaiaMapPlayback.stop()); await settle();
};
const open = async (width, fail = false) => {
  const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 844 }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**/*', route => route.abort());
  if (fail) await context.route('**/annual/japan-marine-ph/2016.json.gz*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
  page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${base}/world.html#world-32`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(fail => globalThis.GaiaMarineCod?.getState().dataState === (fail ? 'error' : 'ready'), fail);
  await page.evaluate(() => { GaiaModeEntryGuide.close('map', { restoreFocus: false }); GaiaMapPlayback.stop(); });
  return context;
};
try {
  for (const width of [1920, 390]) {
    const context = await open(width);
    for (const number of [31, 32, 33, 38, 40]) {
      await choose(number);
      const drawer = page.locator('#map-responsive-data');
      if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') === null) await drawer.locator(':scope > summary').click();
      const target = await page.evaluate(() => GaiaMarineCod.getCruisePoints().find(p => Number.isFinite((p.cod || p.measurement)?.value)));
      await page.locator('[data-cod-prefecture]').selectOption(target.prefCode);
      await page.locator('[data-cod-station]').selectOption(target.id);
      await page.waitForFunction(() => Boolean(GaiaMarineCod.getStatisticsDataset()));
      if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') !== null) await drawer.locator(':scope > summary').click();
      const action = async (name, selector) => {
        if (width < 900) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.locator('#map-mobile-sheet').getByRole('button', { name, exact: true }).click(); }
        else await page.locator(selector).click();
      };
      await action('データの出典', '[data-cod-source]');
      await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
      const source = await page.evaluate(() => GaiaMarineCod.getSourceInfo().datasets[0]);
      assert((await page.locator('#japan-data-panel').textContent()).includes(source.title));
      assert(await page.locator('#japan-data-panel a').evaluateAll((links, url) => links.some(a => a.href === url), source.url));
      await page.locator('#japan-data-close').click();
      await action('統計分析', '[data-cod-analysis]');
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().open);
      const stats = await page.evaluate(() => ({ state: GaiaStatisticsLab.getState(), summary: GaiaStatisticsLab.run('summary'), dataset: GaiaMarineCod.getStatisticsDataset() }));
      assert.equal(stats.state.datasetId, stats.dataset.id);
      assert.equal(stats.summary.stats.n, stats.dataset.rows.length);
      assert(Math.abs(stats.summary.stats.mean - stats.dataset.rows.reduce((sum, r) => sum + r.value, 0) / stats.dataset.rows.length) < 1e-8);
      if (number === 32) await page.screenshot({ path: path.join(output, `${width}-32-analysis.png`) });
      await page.locator('#gaia-statistics-close').click();
      report.checks.push({ width, number, nativeSelect: target.id, sourceUrl: source.url, analysisRows: stats.dataset.rows.length });
    }
    // Real map hit/click, not an API-only selection.
    await choose(32);
    await page.waitForFunction(() => document.querySelector('#gaia-marine-cod-canvas')?.dataset.codArrivalState === 'complete'
      && Number(document.querySelector('#gaia-marine-cod-canvas')?.dataset.codVisibleCount) > 0);
    const hit = await page.evaluate(async () => {
      const { earthBaseScale, earthLongitudeToMapX } = await import('/src/exploration/world-projection.js?v=gaia-japan-center-1');
      const rect = GaiaMapObservationAdapter.getViewportRect(), d = document.querySelector('#japan-overlay').dataset;
      const scale = earthBaseScale(rect) * Math.max(1, Number(d.earthZoom) || 1);
      for (const p of GaiaMarineCod.getCruisePoints()) {
        const x = rect.left + (rect.width - 360 * scale) / 2 + Number(d.earthOffsetX || 0) + earthLongitudeToMapX(p.lon) * scale;
        const y = rect.top + (rect.height - 180 * scale) / 2 + Number(d.earthOffsetY || 0) + (90 - p.lat) * scale;
        const hit = GaiaMarineCod.findPoiAt(x, y, innerWidth < 900 ? 'touch' : 'mouse');
        if (hit && document.elementFromPoint(x, y)?.closest('#japan-map')) return { x, y, id: hit.record.id };
      }
    });
    assert(hit, 'A visible clickable point exists');
    if (width < 900) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction(id => GaiaMarineCod.getState().selectedId === id, hit.id);
    report.checks.push({ width, actualMapSelection: hit.id });
    for (const [number, quality] of [[32, 'missing'], [34, 'qualified']]) {
      await choose(number);
      const missing = await page.evaluate(quality => {
        const point = GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === quality);
        GaiaMarineCod.selectStation(point.id, { focus: false }); return point;
      }, quality);
      assert.equal(await page.locator('.gaia-marine-cod-legend').getAttribute('data-metric-value'), '');
      assert(await page.locator('[data-annual-range-band]').getAttribute('hidden') !== null);
      assert.equal(await page.locator('[data-annual-range-value]').textContent(), '—');
      assert((await page.locator('[data-metric-current]').last().textContent()) !== '0');
      report.checks.push({ width, number, quality, sourceText: missing.measurement.text, noInventedRange: true });
    }
    await choose(31);
    for (let number = 32; number <= 41; number++) {
      await page.locator('[data-map-stable-step="1"]').click();
      await page.waitForFunction(number => Number(GaiaMarineCod.definition.number) === number && GaiaMarineCod.getState().dataState === 'ready', number);
      assert.equal(await page.locator('[data-annual-reading]').getAttribute('hidden') === null, await page.evaluate(() => Boolean(GaiaMarineCod.definition.readingBasis)));
    }
    await page.locator('[data-map-stable-step="-1"]').click();
    await page.waitForFunction(() => GaiaMarineCod.definition.number === '40' && GaiaMarineCod.getState().dataState === 'ready');
    await settle(); await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => GaiaMapPlayback.start());
    await page.waitForFunction(() => GaiaMarineCod.getState().year === 2017);
    await page.evaluate(() => GaiaMapPlayback.stop());
    report.checks.push({ width, next31To41AndBack40: true, autoplay2016To2017: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const number of [61, 69]) { await choose(number); assert.equal(await page.locator('[data-annual-reading]').getAttribute('hidden') === null, await page.evaluate(() => Boolean(GaiaMarineCod.definition.readingBasis))); assert(await page.locator('[data-annual-range]').getAttribute('hidden') !== null); }
    if (width === 1920) for (const language of ['en', 'zh-CN']) {
      await choose(40); await page.evaluate(language => GaiaI18n.set(language), language); await settle(); await page.waitForTimeout(150);
      const translations = await page.evaluate(() => GaiaMarineCod.definitions.filter(d => d.readingBasis).flatMap(d => ['caption', 'explanation', 'visualMap', 'readingBasis', 'guide'].map(k => ({ source: d[k], translated: GaiaI18n.t(d[k]) }))));
      translations.forEach(row => assert.notEqual(row.source, row.translated));
      const reading = await page.locator('.gaia-marine-cod-legend').textContent();
      assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(reading));
      if (language === 'en') assert(!/\p{Script=Han}/u.test(reading));
      await page.screenshot({ path: path.join(output, `1920-40-${language}.png`) });
      await choose(32); await settle();
      const phReading = await page.locator('.gaia-marine-cod-legend').textContent();
      assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(phReading));
      if (language === 'en') assert(!/\p{Script=Han}/u.test(phReading));
      await page.locator('.gaia-observation-details > summary').click();
      assert(await page.locator('.gaia-observation-details').getAttribute('open') !== null);
      assert.equal(await page.locator('.gaia-marine-cod-legend').evaluate(el => el.scrollWidth - el.clientWidth), 0);
      await page.screenshot({ path: path.join(output, `1920-32-${language}.png`) });
      report.checks.push({ language, fields: translations.length });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close(); console.log(`PASS ${width}: selection, source, analysis, quality, navigation, autoplay`);
  }
  const context = await open(390, true);
  assert(await page.locator('[data-cod-controls]').getAttribute('disabled') !== null);
  assert(await page.locator('[data-cod-year]').isDisabled());
  assert(await page.locator('[data-cod-station]').isDisabled());
  assert(await page.locator('[data-cod-analysis]').isDisabled());
  assert.match(await page.locator('[data-cod-status]').textContent(), /読込に失敗/);
  report.checks.push({ controlled503: true, controlsDisabled: true }); await context.close();
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error;
} finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
