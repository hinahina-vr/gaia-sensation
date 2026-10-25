import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/map-21-30-polish-20261021/interactions');
fs.mkdirSync(output, { recursive: true });
const source = JSON.parse(fs.readFileSync('data/estat-prefecture-series.json', 'utf8'));
const report = { status: 'running', checks: [], errors: [], environment: 'Local installed Chrome; bundled source data; external requests blocked; touch is emulated.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const open = async (width, unavailable = false) => {
  const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : 844 }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**/*', route => route.abort());
  if (unavailable) await context.route('**/data/estat-prefecture-series.json*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await context.addInitScript(() => {
    sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
    localStorage.setItem('gaia-senseware-bgm-muted', 'true');
  });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${base}/world.html#world-21`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true'
    && document.querySelector('.gaia-estat-readout')?.dataset.estatPeriod
    && !document.querySelector('#japan-layer').dataset.estatLoading);
  await page.evaluate(() => { GaiaModeEntryGuide.close('map', { restoreFocus: false }); GaiaMapPlayback.stop(); });
  return context;
};
const settle = () => page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
try {
  for (const width of [1920, 390]) {
    const context = await open(width);
    const action = async (name, selector) => {
      if (width < 900) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.locator('#map-mobile-sheet').getByRole('button', { name, exact: true }).click();
      } else await page.locator(selector).click();
    };
    for (const number of [21, 22, 24, 28, 30]) {
      await page.evaluate(async number => { await GaiaEstatExhibits.select(number - 21); GaiaMapPlayback.stop(); GaiaEstatExhibits.selectPrefecture(12); }, number);
      await settle();
      await action('データの出典', '[data-estat-source-action]');
      await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
      const sourceInfo = await page.evaluate(() => GaiaEstatExhibits.getSourceInfo());
      const panel = await page.locator('#japan-data-panel').textContent();
      assert(panel.includes(sourceInfo.datasets[0].title));
      assert(await page.locator('#japan-data-panel a').evaluateAll((links, url) => links.some(a => a.href === url), sourceInfo.datasets[0].url));
      await page.locator('#japan-data-close').click();
      await action('統計分析', '[data-estat-analysis]');
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().open && GaiaStatisticsLab.getState().analysisReady);
      const analysis = await page.evaluate(() => ({ state: GaiaStatisticsLab.getState(), result: GaiaStatisticsLab.run('summary'), dataset: GaiaEstatExhibits.getStatisticsDataset() }));
      assert.equal(analysis.state.datasetId, analysis.dataset.id);
      assert.equal(analysis.result.stats.n, analysis.dataset.rows.length);
      const expectedMean = analysis.dataset.rows.reduce((sum, row) => sum + row.value, 0) / analysis.dataset.rows.length;
      assert(Math.abs(analysis.result.stats.mean - expectedMean) < 1e-8);
      if (number === 28) await page.screenshot({ path: path.join(output, `${width}-28-analysis.png`) });
      await page.locator('#gaia-statistics-close').click();
      await page.waitForFunction(() => !GaiaStatisticsLab.getState().open);
      report.checks.push({ width, number, sourceUrl: sourceInfo.datasets[0].url, analysisRows: analysis.result.stats.n });
    }
    for (const [key, pref, year] of [['migration', 46, '1954'], ['housing', 46, '1951'], ['relativeHumidity', 23, '2025'], ['precipitation', 8, '2022'], ['rainyDays', 8, '2022']]) {
      assert.equal(source[key][year][pref], null);
      const missing = await page.evaluate(async ({ key, pref, year }) => {
        await GaiaEstatExhibits.select(GaiaEstatExhibits.definitions.findIndex(e => e.key === key));
        GaiaEstatExhibits.selectPrefecture(pref);
        const input = document.querySelector('[data-estat-month]');
        const periods = GaiaEstatExhibits.getStatisticsDataset().coverageStart;
        GaiaEstatExhibits.setPeriod(Number(year) - Number(periods));
        const readout = document.querySelector('.gaia-estat-readout');
        return { value: readout.querySelector('[data-estat-value]').textContent,
          quality: readout.dataset.estatValueQuality, note: readout.querySelector('[data-estat-mobile-history-note]').textContent,
          rows: GaiaEstatExhibits.getStatisticsDataset().rows.map(r => r.id), period: input.getAttribute('aria-valuetext') };
      }, { key, pref, year });
      assert.equal(missing.value, '欠測');
      assert.equal(missing.quality, 'missing');
      assert.match(missing.note, /未収録|欠測/);
      assert.equal(missing.period, `${year}年`);
      assert(!missing.rows.includes(year));
      report.checks.push({ width, key, pref: pref + 1, year, missing });
    }
    // Enter through the real picker so the shared next/back controller owns
    // the current route as well as the provider's displayed data.
    await page.evaluate(() => GaiaMapCategories.buttons().find(b => b.textContent.trim() === '30').click());
    await page.waitForFunction(() => GaiaMapStableNavigation.getState().requested === 30 && GaiaEstatExhibits.getState().activeIndex === 9);
    await page.evaluate(() => { GaiaMapPlayback.stop(); GaiaEstatExhibits.selectPrefecture(12); });
    await settle();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => GaiaMapPlayback.start());
    await page.waitForFunction(() => GaiaEstatExhibits.getState().period !== '2016');
    const playing = await page.evaluate(() => GaiaEstatExhibits.getState());
    assert(playing.playbackEnabled);
    await page.evaluate(() => GaiaMapPlayback.stop());
    report.checks.push({ width, autoplayAdvanced: playing });
    await page.locator('[data-map-stable-step="1"]').click();
    await page.waitForFunction(() => Number(document.querySelector('#japan-mode-number').textContent) === 31);
    await page.locator('[data-map-stable-step="-1"]').click();
    await page.waitForFunction(() => Number(document.querySelector('#japan-mode-number').textContent) === 30 && GaiaEstatExhibits.getState().activeIndex === 9);
    assert.equal(await page.evaluate(() => GaiaEstatExhibits.getState().period), '2016');
    report.checks.push({ width, next31AndBack30: true });
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log(`PASS ${width}: sources, analyses, missing values, autoplay, 30/31 navigation`);
  }
  const context = await open(390, true);
  const unavailable = await page.evaluate(() => ({ value: document.querySelector('[data-estat-value]').textContent,
    note: document.querySelector('[data-estat-quality]').textContent,
    disabled: document.querySelector('[data-estat-analysis]').disabled,
    rows: GaiaEstatExhibits.getStatisticsDataset().rows.length }));
  assert.equal(unavailable.value, '欠測');
  assert.equal(unavailable.rows, 0);
  assert(unavailable.disabled);
  assert.match(unavailable.note, /読み込みに失敗/);
  report.checks.push({ unavailable });
  await context.close();
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
