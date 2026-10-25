import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const stage = process.env.GAIA_POLISH_STAGE || 'after';
const before = stage.startsWith('before');
const output = path.resolve(`artifacts/map-21-30-polish-20261021/${stage}`);
fs.mkdirSync(output, { recursive: true });
const source = JSON.parse(fs.readFileSync('data/estat-prefecture-series.json', 'utf8'));
const report = { status: 'running', stage, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: 'uncommitted changes', checks: [], errors: [], environment: 'Local Chrome; bundled annual data; external requests blocked; mobile is emulated.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of (process.env.GAIA_POLISH_WIDTHS || '1920,768,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : width === 320 ? 568 : 844 }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**/*', route => route.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/world.html#world-21`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true' && globalThis.GaiaEstatExhibits);
    await page.evaluate(() => GaiaModeEntryGuide.close('map', { restoreFocus: false }));
    for (let number = 21; number <= 30; number++) {
      await page.evaluate(() => document.activeElement?.blur());
      await page.mouse.move(1, 1);
      await page.evaluate(async number => { await GaiaEstatExhibits.select(number - 21); GaiaMapPlayback.stop(); GaiaEstatExhibits.selectPrefecture(12); }, number);
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
      await page.waitForTimeout(1000);
      const read = () => page.evaluate(() => {
        const p = GaiaEstatExhibits, s = p.getState(), e = p.definitions[s.activeIndex];
        const legend = document.querySelector('.gaia-estat-heat-legend:not(.map-mobile-reading-copy)');
        return { number: e.number, key: e.key, period: s.period, playing: s.playbackEnabled, selected: s.selectedIndex,
          value: legend.dataset.metricValue, valueText: document.querySelector('[data-estat-value]').textContent,
          periodText: document.querySelector('[data-estat-period]').textContent,
          basis: legend.querySelector('[data-estat-reading-basis]')?.textContent,
          mapReading: legend.querySelector('[data-estat-reading-map]')?.textContent,
          coverage: legend.querySelector('[data-estat-history-note]').textContent,
          caption: document.querySelector('[data-estat-caption]').textContent,
          comparison: document.querySelector('.gaia-estat-comparison').textContent,
          scale: legend.dataset.metricScale, progress: legend.dataset.metricProgress,
          viewportOverflow: document.documentElement.scrollWidth - innerWidth,
          shapes: document.querySelector('#gaia-estat-canvas').dataset.estatHeatmapShapeCount,
          selectedOutline: document.querySelector('#gaia-estat-canvas').dataset.estatSelectionOutline,
          analysisDisabled: document.querySelector('[data-estat-analysis]').disabled };
      });
      const initial = await read();
      assert.equal(initial.period, '2016');
      assert.equal(initial.value, String(source[initial.key]['2016'][12]));
      assert.equal(initial.shapes, '47');
      assert.equal(initial.viewportOverflow, 0);
      assert.equal(initial.scale, number === 22 ? 'log' : 'linear');
      if (!before && [22, 23].includes(number)) {
        const label = await page.locator('.gaia-estat-marker[aria-current="true"] > span').evaluate(el => {
          const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, overflow: el.scrollWidth - el.clientWidth };
        });
        assert(label.left >= 0 && label.right <= width, `Point label stays inside ${width}: ${JSON.stringify(label)}`);
        assert.equal(label.overflow, 0);
      }
      await page.screenshot({ path: path.join(output, `${width}-${number}-overview.png`) });
      if (!before) {
        assert(initial.basis && initial.mapReading);
        assert.equal(initial.selectedOutline, '13');
        assert.doesNotMatch(initial.caption, /ではありません|示しません|含みません/);
        if (width < 900) {
          await page.locator('[data-mobile-sheet="reading"]').click();
          await page.locator('#map-mobile-sheet .gaia-estat-reading-basis').waitFor({ state: 'visible' });
          const sheet = await page.locator('#map-mobile-sheet').evaluate(el => ({ overflow: el.scrollWidth - el.clientWidth, text: el.textContent }));
          assert.equal(sheet.overflow, 0);
          assert(sheet.text.includes(initial.basis));
          await page.screenshot({ path: path.join(output, `${width}-${number}-reading.png`) });
          await page.locator('[data-mobile-sheet-close]').click();
        }
        const drawer = page.locator('#map-responsive-data');
        if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') === null) await drawer.locator(':scope > summary').click();
        const slider = page.locator('[data-estat-month]');
        for (const [key, year] of [['Home', source.periodsBySeries[initial.key][0]], ['End', source.periodsBySeries[initial.key].at(-1)]]) {
          await slider.focus(); await slider.press(key);
          await page.waitForFunction(year => GaiaEstatExhibits.getState().period === year, year);
          const current = await read();
          assert.equal(current.value, String(source[initial.key][year][12]));
          assert.equal(current.playing, false);
          assert.equal(current.selected, 12);
          assert.equal(await slider.getAttribute('aria-valuetext'), `${year}年`);
        }
        if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') !== null) await drawer.locator(':scope > summary').click();
        const poi = page.locator(`${[22,23].includes(number) ? '.gaia-estat-marker' : '.gaia-estat-prefecture-region'}[data-estat-prefecture="01"]`);
        await poi.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => GaiaEstatExhibits.getState().selectedIndex === 0);
        const chosen = await read();
        assert.equal(chosen.value, String(source[initial.key][chosen.period][0]));
        assert.equal(chosen.analysisDisabled, false);
        const data = await page.evaluate(() => GaiaEstatExhibits.getStatisticsDataset());
        const expected = source.periodsBySeries[initial.key].map(y => source[initial.key][y][0]).filter(Number.isFinite);
        assert.deepEqual(data.rows.map(r => r.value), expected);
        report.checks.push({ width, number, initial, chosen, analysisRowsMatch: true });
      } else report.checks.push({ width, number, initial });
    }
    if (!before && width === 1920) for (const language of ['en', 'zh-CN']) {
      await page.evaluate(language => GaiaI18n.set(language), language);
      await page.waitForTimeout(200);
      const translations = await page.evaluate(() => GaiaEstatExhibits.definitions.flatMap(e =>
        [e.caption, e.guide, e.readingBasis, e.visualMap].map(text => ({ source: text, translated: GaiaI18n.t(text) }))));
      for (const row of translations) assert.notEqual(row.translated, row.source);
      const text = await page.locator('.gaia-estat-heat-legend').textContent();
      assert(!(/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(text), `${language}: annual reading translated: ${text}`);
      if (language === 'en') assert(!(/\p{Script=Han}/u).test(text), `English annual reading translated: ${text}`);
      await page.screenshot({ path: path.join(output, `${width}-30-${language}.png`) });
      report.checks.push({ width, language, translatedFields: translations.length, legend: text });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log(`PASS ${width}: 21–30 (${stage})`);
  }
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
