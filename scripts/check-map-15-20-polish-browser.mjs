import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const stage = process.env.GAIA_POLISH_STAGE || 'after';
const before = stage.startsWith('before');
const output = path.resolve(`artifacts/map-15-20-polish-20261020/${stage}`);
fs.mkdirSync(output, { recursive: true });
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: 'uncommitted changes', stage, checks: [], errors: [],
  environment: 'Local installed Chrome with production CSP, repository weather/air snapshots; external requests blocked. Mobile emulation, not physical devices or live-provider verification.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of (process.env.GAIA_POLISH_WIDTHS || '1920,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : width === 320 ? 568 : 844 },
      hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, process.env.GAIA_BASE_URL);
    await context.route('https://**/*', route => route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${process.env.GAIA_BASE_URL}/world#world-15`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true');
    await page.waitForFunction(() => GaiaLiveData.getPrefectureField().requestState !== 'loading');
    for (let number = 15; number <= 20; number++) {
      await page.evaluate(number => GaiaMapCategories.buttons().find(b => b.dataset.liveExhibit === GaiaLiveExhibits.definitions[number - 15].id).click(), number);
      await page.waitForFunction(number => Number(document.querySelector('#japan-mode-number').textContent) === number, number);
      await page.evaluate(() => { GaiaMapPlayback.stop(); GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveData.selectTime(null); });
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
        && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro')
        && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
      await page.locator('[data-live-prefecture="13"]').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => GaiaLiveData.getCity() === 'tokyo');
      const tooltip = await page.locator('.gaia-live-region-tooltip').evaluate(el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          overflow: el.scrollWidth - el.clientWidth, text: el.textContent };
      });
      assert(tooltip.left >= 0 && tooltip.right <= width && tooltip.top >= 0);
      assert.equal(tooltip.overflow, 0);
      await page.mouse.move(1, 1);
      await page.locator('[data-live-prefecture="13"]').evaluate(el => el.blur());
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(output, `${width}-${number}-overview.png`) });
      const scan = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        value: document.querySelector('[data-live-exhibit-value]').textContent,
        time: document.querySelector('[data-live-period]').textContent,
        regions: document.querySelectorAll('.gaia-live-prefecture-region').length,
        selected: [...document.querySelectorAll('.gaia-live-prefecture-region[aria-current="true"]')].map(e => e.dataset.city),
        context: document.querySelector('[data-live-reading-context]')?.textContent,
      }));
      assert.equal(scan.overflow, 0);
      assert.equal(scan.regions, 47);
      assert.deepEqual(scan.selected, ['tokyo']);
      if (!before) {
        assert.match(scan.context, /モデル|予測/);
        assert.equal(await page.locator('.gaia-live-selection-outline:not(.gaia-live-selection-back)').getAttribute('d'),
          await page.locator('[data-live-prefecture="13"]').getAttribute('d'));
        assert.equal(await page.locator('.gaia-live-selection-outline:not(.gaia-live-selection-back)').getAttribute('pointer-events'), 'none');
      }
      // Use the actual range control (inside the mobile detail drawer).
      if (width < 900) {
        const drawer = page.locator('#map-responsive-data');
        if (await drawer.isVisible() && await drawer.getAttribute('open') === null) await drawer.locator(':scope > summary').click();
      }
      const slider = page.locator('#gaia-live-time');
      await slider.focus();
      await slider.press('Home');
      await page.waitForFunction(() => Boolean(GaiaLiveData.getSelectedTime()));
      const first = await slider.getAttribute('aria-valuetext');
      const values = await page.evaluate(() => {
        const key = GaiaLiveExhibits.definitions[Number(document.querySelector('#japan-mode-number').textContent) - 15].key;
        const field = GaiaLiveData.getPrefectureField()[['forecastCo2', 'pm25'].includes(key) ? 'air' : 'weather'];
        return [...document.querySelectorAll('.gaia-live-prefecture-region')].map(e => ({
          actual: e.dataset.value, expected: field.points.find(p => p.id === e.dataset.city)?.measurements[key],
        }));
      });
      for (const row of values) assert.equal(row.actual, Number.isFinite(row.expected) ? String(row.expected) : 'missing');
      await slider.press('End');
      await page.waitForFunction(() => GaiaLiveData.getSelectedTime() === null);
      assert.match(await slider.getAttribute('aria-valuetext'), /最新/);
      if (!before) {
        assert(!(await page.locator('[data-live-deck-analysis]').isDisabled()), 'Representative-location comparison is available');
        if (width < 900) {
          const drawer = page.locator('#map-responsive-data');
          if (await drawer.isVisible() && await drawer.getAttribute('open') !== null) await drawer.locator(':scope > summary').click();
          await page.getByRole('button', { name: '読み方・凡例', exact: true }).click();
          await page.locator('#map-mobile-sheet .gaia-live-reading-context').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#map-mobile-sheet .gaia-live-metric-legend').evaluate(el => el.scrollWidth - el.clientWidth), 0);
          await page.screenshot({ path: path.join(output, `${width}-${number}-reading.png`) });
          await page.locator('[data-mobile-sheet-close]').click();
        }
      }
      report.checks.push({ width, number, ...scan, tooltip, first, all47HistoricalValuesMatch: true });
    }
    if (!before && width === 1920) for (const language of ['en', 'zh-CN']) {
      await page.evaluate(language => GaiaI18n.set(language), language);
      await page.waitForTimeout(150);
      const translations = await page.evaluate(() => GaiaLiveExhibits.definitions.flatMap(e =>
        [e.readingBasis, e.caption, e.refreshCopy].map(text => ({ source: text, translated: GaiaI18n.t(text) }))));
      for (const row of translations) assert.notEqual(row.translated, row.source);
      const text = await page.locator('.gaia-live-metric-legend').textContent();
      assert(!(/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(text), `${language}: live reading translated`);
      if (language === 'en') assert(!(/\p{Script=Han}/u).test(text), 'English live reading translated');
      await page.screenshot({ path: path.join(output, `${width}-20-${language}.png`) });
      report.checks.push({ width, language, translatedFields: translations.length, legend: text });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log(`PASS ${width}: 15–20`);
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
