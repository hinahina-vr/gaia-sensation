import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/map-51-60-polish-20261022/${process.env.GAIA_INTERACTION_STAGE || 'interactions'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: 'uncommitted changes', checks: [], errors: [], environment: 'Local installed Chrome. External requests blocked. Mobile/touch emulated, not physical devices. Controlled HTTP503.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const legend = () => page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy)');
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
  if (fail) await context.route('**/annual/japan-water-tp/2016.json.gz*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
  page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${base}/world.html#world-60`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(fail => globalThis.GaiaMarineCod?.getState().dataState === (fail ? 'error' : 'ready'), fail);
  await page.evaluate(() => { GaiaModeEntryGuide.close('map', { restoreFocus: false }); GaiaMapPlayback.stop(); });
  return context;
};
const details = async width => {
  if (width < 900) await page.locator('[data-mobile-sheet="reading"]').click();
  const container = width < 900 ? page.locator('#map-mobile-sheet') : legend();
  const disclosure = container.locator('.gaia-observation-details');
  if (await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
  return container;
};
const closeDetails = async width => { if (width < 900) await page.locator('[data-mobile-sheet-close]').click(); };
const action = async (width, name, selector) => {
  if (width < 900) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.locator('#map-mobile-sheet').getByRole('button', { name, exact: true }).click(); }
  else await page.locator(selector).click();
};
try {
  for (const width of (process.env.GAIA_INTERACTION_WIDTHS || '1920,390').split(',').map(Number)) {
    const context = await open(width);
    for (let number = 51; number <= 60; number++) {
      await choose(number);
      const drawer = page.locator('#map-responsive-data');
      if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') === null) await drawer.locator(':scope > summary').click();
      const target = await page.evaluate(() => GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === 'measured'));
      await page.locator('[data-cod-prefecture]').selectOption(target.prefCode);
      await page.locator('[data-cod-station]').selectOption(target.id);
      await page.waitForFunction(() => Boolean(GaiaMarineCod.getStatisticsDataset()));
      if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') !== null) await drawer.locator(':scope > summary').click();
      const container = await details(width);
      const record = container.locator('.gaia-observation-source-record');
      const values = await record.locator('dd').allTextContents();
      assert.equal(values[0], target.water);
      if (number <= 54) {
        assert.equal(values[2], target.measurement.coverageText);
        assert.match(values[1], number === 54 ? /日平均値から集計/ : /全時間帯/);
        if (number === 54) {
          assert.equal((await record.locator('dt').allTextContents())[2], '有効測定日数の記録');
          assert.match(values[2], /有効測定日数/);
        }
      } else {
        assert.equal(values[1], target.sourceId);
        assert.equal(values[2], target.measurement.text + ' mg/L');
      }
      assert.equal(await legend().getAttribute('data-metric-value'), String(target.measurement.value));
      assert.equal(await container.evaluate(el => el.scrollWidth - el.clientWidth), 0);
      await page.screenshot({ path: path.join(output, width + '-' + number + '-reading.png') });
      await closeDetails(width);
      await action(width, 'データの出典', '[data-cod-source]');
      await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
      const source = await page.evaluate(() => GaiaMarineCod.getSourceInfo().datasets[0]);
      assert((await page.locator('#japan-data-panel').textContent()).includes(source.title));
      assert(await page.locator('#japan-data-panel a').evaluateAll((links, url) => links.some(a => a.href === url), source.url));
      await page.locator('#japan-data-close').click();
      await action(width, '統計分析', '[data-cod-analysis]');
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().open);
      const stats = await page.evaluate(() => ({ state: GaiaStatisticsLab.getState(), summary: GaiaStatisticsLab.run('summary'), dataset: GaiaMarineCod.getStatisticsDataset() }));
      assert.equal(stats.state.datasetId, stats.dataset.id);
      assert.equal(stats.summary.stats.n, stats.dataset.rows.length);
      assert(Math.abs(stats.summary.stats.mean - stats.dataset.rows.reduce((sum, r) => sum + r.value, 0) / stats.dataset.rows.length) < 1e-8);
      await page.locator('#gaia-statistics-close').click();
      report.checks.push({ width, number, nativeSelection: target.id, sourceId: target.sourceId, sourceUrl: source.url, analysisRows: stats.dataset.rows.length });
    }
    // Actual source qualifiers/missing values stay text, never invented numeric zeros.
    for (const [number, quality] of [[55, 'qualified'], [56, 'missing'], [57, 'qualified'], [58, 'qualified'], [59, 'missing'], [60, 'qualified']]) {
      await choose(number);
      const target = await page.evaluate(quality => {
        const p = GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === quality);
        GaiaMarineCod.selectStation(p.id, { focus: false }); return p;
      }, quality);
      const container = await details(width);
      const values = await container.locator('.gaia-observation-source-record dd').allTextContents();
      assert.equal(await legend().getAttribute('data-metric-value'), '');
      assert.equal(values[1], target.sourceId);
      assert.equal(values[2], target.measurement.text + (quality === 'missing' ? '' : ' mg/L'));
      await closeDetails(width);
      report.checks.push({ width, number, quality, raw: target.measurement.text, sourceId: target.sourceId });
    }
    // Unknown station class is preserved; valid days never become hours.
    for (const number of [53, 54]) {
      await choose(number);
      const target = await page.evaluate(() => {
        const p = GaiaMarineCod.getCruisePoints().find(p => p.stationType === '9');
        GaiaMarineCod.selectStation(p.id, { focus: false }); return p;
      });
      const container = await details(width);
      assert((await container.innerText()).includes(target.water));
      await closeDetails(width);
    }
    // Sparse history and discontinuous source years remain intact.
    for (const number of [59, 60]) {
      await choose(number); await page.evaluate(() => GaiaMarineCod.setYear(1984));
      assert.equal(await page.locator('#gaia-marine-cod-canvas').getAttribute('data-cod-point-count'), '10');
    }
    await choose(56);
    await page.evaluate(() => GaiaMarineCod.setYear(1977));
    assert(!await page.evaluate(() => GaiaMarineCod.definition.years.includes(1978)));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => GaiaMapPlayback.start());
    await page.waitForFunction(() => GaiaMarineCod.getState().year === 2009 && GaiaMarineCod.getState().dataState === 'ready');
    await page.evaluate(() => GaiaMapPlayback.stop()); await page.emulateMedia({ reducedMotion: 'reduce' });
    report.checks.push({ width, sparse1984TNandTP: 10, realYearGap1977To2009: true });
    // Actual map click/tap on a projected station, rather than a synthetic selection.
    await choose(58);
    await page.waitForFunction(() => document.querySelector('#gaia-marine-cod-canvas')?.dataset.codArrivalState === 'complete'
      && Number(document.querySelector('#gaia-marine-cod-canvas')?.dataset.codVisibleCount) > 0);
    const hit = await page.evaluate(async () => {
      const { earthBaseScale, earthLongitudeToMapX } = await import('/src/exploration/world-projection.js?v=gaia-japan-center-1');
      const rect = GaiaMapObservationAdapter.getViewportRect(), d = document.querySelector('#japan-overlay').dataset;
      const scale = earthBaseScale(rect) * Math.max(1, Number(d.earthZoom) || 1);
      for (const p of GaiaMarineCod.getCruisePoints()) {
        const x = rect.left + (rect.width - 360 * scale) / 2 + Number(d.earthOffsetX || 0) + earthLongitudeToMapX(p.lon) * scale;
        const y = rect.top + (rect.height - 180 * scale) / 2 + Number(d.earthOffsetY || 0) + (90 - p.lat) * scale;
        const target = GaiaMarineCod.findPoiAt(x, y, innerWidth < 900 ? 'touch' : 'mouse');
        if (target && document.elementFromPoint(x, y)?.closest('#japan-map')) return { x, y, id: target.record.id };
      }
    });
    assert(hit);
    if (width < 900) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction(id => GaiaMarineCod.getState().selectedId === id, hit.id);
    report.checks.push({ width, actualMapSelection: hit.id });
    await choose(50);
    for (let number = 51; number <= 61; number++) {
      await page.locator('[data-map-stable-step="1"]').click();
      await page.waitForFunction(number => Number(GaiaMarineCod.definition.number) === number && GaiaMarineCod.getState().dataState === 'ready', number);
      assert.equal(await legend().locator('[data-annual-reading]').getAttribute('hidden'), null);
      assert(await legend().locator('[data-annual-source-record]').getAttribute('hidden') !== null);
    }
    await page.locator('[data-map-stable-step="-1"]').click();
    await page.waitForFunction(() => GaiaMarineCod.definition.number === '60' && GaiaMarineCod.getState().dataState === 'ready');
    await settle(); await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => GaiaMapPlayback.start()); await page.waitForFunction(() => GaiaMarineCod.getState().year === 2017);
    await page.evaluate(() => GaiaMapPlayback.stop()); await page.emulateMedia({ reducedMotion: 'reduce' });
    report.checks.push({ width, next50To61AndBack60: true, autoplay2016To2017: true });
    await choose(32); assert.equal(await legend().locator('[data-annual-range]').getAttribute('hidden'), null);
    for (const n of [61, 69]) { await choose(n); assert.equal(await legend().locator('[data-annual-reading]').getAttribute('hidden'), null); }
    if (width === 1920) for (const language of ['en', 'zh-CN']) {
      await page.evaluate(language => GaiaI18n.set(language), language);
      for (const number of [54, 60]) {
        await choose(number);
        await page.evaluate(() => GaiaMarineCod.selectStation(GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === 'measured').id, { focus: false }));
        const container = await details(width); await page.waitForTimeout(150);
        // Local source water-body proper names remain as supplied.
        const text = await container.locator('.gaia-observation-reading').evaluate(el => {
          const copy = el.cloneNode(true); copy.querySelector('.gaia-observation-source-record')?.remove(); return copy.textContent;
        });
        assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text), text);
        if (language === 'en') assert(!/\p{Script=Han}/u.test(text), text);
        const labels = (await container.locator('.gaia-observation-source-record dt').allTextContents()).join(' ');
        assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(labels), labels);
        assert.equal(await container.evaluate(el => el.scrollWidth - el.clientWidth), 0);
        await page.screenshot({ path: path.join(output, width + '-' + number + '-' + language + '.png') });
      }
      const fields = await page.evaluate(() => GaiaMarineCod.definitions.filter(d => +d.number >= 51 && +d.number <= 60).flatMap(d => ['caption','explanation','visualMap','guide','readingBasis'].map(k => [d[k], GaiaI18n.t(d[k])])))
      fields.forEach(([a, b]) => assert.notEqual(a, b)); report.checks.push({ language, translatedFields: fields.length });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close(); console.log('PASS ' + width + ': all51–60 native actions, source context, real edge records, navigation and autoplay');
  }
  const context = await open(390, true);
  assert(await page.locator('[data-cod-controls]').getAttribute('disabled') !== null);
  for (const selector of ['[data-cod-year]', '[data-cod-station]', '[data-cod-analysis]']) assert(await page.locator(selector).isDisabled());
  assert.match(await page.locator('[data-cod-status]').textContent(), /読込に失敗/);
  report.checks.push({ controlled503: true, controlsDisabled: true });
  await context.close(); assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error;
} finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
