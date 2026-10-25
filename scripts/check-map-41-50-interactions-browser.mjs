import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/map-41-50-polish-20261022/${process.env.GAIA_INTERACTION_STAGE || 'interactions'}`);
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
  if (fail) await context.route('**/annual/japan-air-ox/2016.json.gz*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
  page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${base}/world.html#world-49`, { waitUntil: 'domcontentloaded' });
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
    for (const number of [41, 43, 44, 47, 49, 50]) {
      await choose(number);
      const drawer = page.locator('#map-responsive-data');
      if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') === null) await drawer.locator(':scope > summary').click();
      const target = await page.evaluate(() => GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === 'measured'));
      await page.locator('[data-cod-prefecture]').selectOption(target.prefCode);
      await page.locator('[data-cod-station]').selectOption(target.id);
      await page.waitForFunction(() => Boolean(GaiaMarineCod.getStatisticsDataset()));
      if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') !== null) await drawer.locator(':scope > summary').click();
      const container = await details(width);
      const sourceRecord = container.locator('.gaia-observation-source-record');
      if (number === 43) {
        assert((await sourceRecord.innerText()).includes(`${target.measurement.sourceText} ${target.measurement.sourceUnit}`));
        assert((await sourceRecord.innerText()).includes(`${target.measurement.text} W/m²`));
        assert(Math.abs(Number(target.measurement.sourceText) * 1e6 / 86400 - target.measurement.value) < 1e-8);
      } else if (number >= 44) {
        const text = await sourceRecord.innerText();
        assert(text.includes(target.water)); assert(text.includes(target.measurement.coverageText));
        assert(text.includes(number === 49 ? '昼間 5〜20時' : '全時間帯'));
        assert.match(await page.locator('[data-cod-status]').textContent(), /大気の年度記録/);
      } else assert(await sourceRecord.getAttribute('hidden') !== null);
      assert.equal(await container.evaluate(el => el.scrollWidth - el.clientWidth), 0);
      await page.screenshot({ path: path.join(output, `${width}-${number}-reading.png`) });
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
      report.checks.push({ width, number, nativeSelection: target.id, sourceUrl: source.url, analysisRows: stats.dataset.rows.length });
    }
    // Preserve real zero, the source's uncommon class 9 and each year's coverage.
    await choose(44);
    for (const mode of ['zero', 'class9']) {
      const target = await page.evaluate(mode => {
        const p = GaiaMarineCod.getCruisePoints().find(p => mode === 'zero' ? p.measurement.value === 0 : p.stationType === '9');
        GaiaMarineCod.selectStation(p.id, { focus: false }); return p;
      }, mode);
      assert.equal(await legend().getAttribute('data-metric-value'), String(target.measurement.value));
      const container = await details(width);
      assert((await container.innerText()).includes(target.water));
      await closeDetails(width); report.checks.push({ width, mode, id: target.id });
    }
    await choose(43);
    for (const [year, id, quality] of [[2016, '47605', 'missing'], [1961, '47595', 'qualified']]) {
      await page.evaluate(async ({year, id}) => { await GaiaMarineCod.setYear(year); GaiaMarineCod.selectStation(id, { focus: false }); }, {year, id});
      const container = await details(width);
      assert.equal(await legend().getAttribute('data-metric-value'), '');
      const values = await container.locator('.gaia-observation-source-record dd').allTextContents();
      assert.equal(values[1], '—');
      if (quality === 'qualified') assert(values[0].includes('12.9 ]'));
      else assert.equal(values[0], '—');
      await closeDetails(width); report.checks.push({ width, solarQuality: quality, year, noInventedValue: true });
    }
    await choose(50); await page.evaluate(() => GaiaMarineCod.setYear(1975));
    assert.equal(await page.locator('#gaia-marine-cod-canvas').getAttribute('data-cod-point-count'), '1');
    assert((await page.locator('[data-cod-count]').textContent()).startsWith('1地点'));
    // Actual map click/tap on a projected visible station.
    await choose(49);
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
    report.checks.push({ width, actualMapSelection: hit.id, oldestNMHC: 1 });
    await choose(41);
    for (let number = 42; number <= 51; number++) {
      await page.locator('[data-map-stable-step="1"]').click();
      await page.waitForFunction(number => Number(GaiaMarineCod.definition.number) === number && GaiaMarineCod.getState().dataState === 'ready', number);
      assert.equal(await legend().locator('[data-annual-reading]').getAttribute('hidden') === null, Boolean(await page.evaluate(() => GaiaMarineCod.definition.readingBasis)));
    }
    await page.locator('[data-map-stable-step="-1"]').click();
    await page.waitForFunction(() => GaiaMarineCod.definition.number === '50' && GaiaMarineCod.getState().dataState === 'ready');
    await settle(); await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => GaiaMapPlayback.start()); await page.waitForFunction(() => GaiaMarineCod.getState().year === 2017);
    await page.evaluate(() => GaiaMapPlayback.stop()); await page.emulateMedia({ reducedMotion: 'reduce' });
    report.checks.push({ width, next41To51AndBack50: true, autoplay2016To2017: true });
    // Shared renderer boundaries: prior water-range still present; later data unchanged.
    await choose(32); assert.equal(await legend().locator('[data-annual-range]').getAttribute('hidden'), null);
    for (const n of [61, 69]) { await choose(n); assert(await legend().locator('[data-annual-reading]').getAttribute('hidden') !== null); }
    if (width === 1920) for (const language of ['en', 'zh-CN']) {
      await page.evaluate(language => GaiaI18n.set(language), language);
      for (const number of [43, 49]) {
        await choose(number);
        await page.evaluate(() => GaiaMarineCod.selectStation(GaiaMarineCod.getCruisePoints().find(p => p.measurement.quality === 'measured').id, { focus: false }));
        const container = await details(width); await page.waitForTimeout(150);
        const text = await container.locator('.gaia-observation-reading').innerText();
        assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text), text);
        if (language === 'en') assert(!/\p{Script=Han}/u.test(text), text);
        assert.equal(await container.evaluate(el => el.scrollWidth - el.clientWidth), 0);
        await page.screenshot({ path: path.join(output, `${width}-${number}-${language}.png`) });
      }
      const fields = await page.evaluate(() => GaiaMarineCod.definitions.filter(d => +d.number >= 41 && +d.number <= 50).flatMap(d => ['caption','explanation','visualMap','guide','readingBasis'].map(k => [d[k], GaiaI18n.t(d[k])])));
      fields.forEach(([a, b]) => assert.notEqual(a, b)); report.checks.push({ language, translatedFields: fields.length });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close(); console.log(`PASS ${width}: source context, actions, edge data, navigation, autoplay`);
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
