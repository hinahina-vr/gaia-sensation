import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/map-heading-chevrons-2026-09-10/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, {recursive: true});
const report = {status: 'running', before, checks: [], errors: [], sha256: {},
  environment: 'Installed Chrome with production CSP and local datasets; saved NOAA/FIRMS, empty USGS, isolated weather API failures. Emulated viewports/touch, not physical devices or production.'};
for (const file of ['map-heading-navigation.js', 'map-heading-navigation.css', 'gaia-mode-loader.js', 'index.html']) {
  report.sha256[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
let page;
const settled = number => page.waitForFunction(n => Number(document.querySelector('#japan-mode-number').textContent) === n
  && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
const select = async number => {
  await page.evaluate(n => GaiaMapCategories.buttons().find(b => Number(b.textContent) === n).click(), number);
  await settled(number);
};
const scan = () => page.evaluate(() => {
  const title = document.querySelector('#japan-title');
  const box = e => e.getBoundingClientRect().toJSON();
  return {title: title.textContent, titleBox: box(title), overflow: document.documentElement.scrollWidth - innerWidth,
    titleOverflow: title.scrollWidth - title.clientWidth, arrows: [...document.querySelectorAll('.map-heading-step')].map(e => {
      const rect = box(e), icon = e.querySelector('svg'), shape = icon?.querySelector('path');
      return {text: e.textContent, label: e.getAttribute('aria-label'), rect, disabled: e.disabled,
        hit: e.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
        icon: icon ? {rect: box(icon), hidden: icon.getAttribute('aria-hidden'), focusable: icon.getAttribute('focusable'),
          shape: shape.getAttribute('d'), stroke: getComputedStyle(icon).stroke, strokeWidth: getComputedStyle(icon).strokeWidth} : null};
    })};
});
const check = async (width, height, number) => {
  const result = await scan();
  assert.equal(result.arrows.length, 2);
  assert.equal(result.overflow, 0);
  assert(result.titleOverflow <= 1, 'Title must not clip');
  const [previous, next] = result.arrows;
  assert(previous.rect.right <= result.titleBox.left && next.rect.left >= result.titleBox.right, 'Arrows flank title');
  for (const [i, arrow] of result.arrows.entries()) {
    assert(arrow.hit && !arrow.disabled && arrow.rect.width >= 44 && arrow.rect.height >= 44, 'Reachable 44px hit area');
    assert(arrow.rect.left >= 0 && arrow.rect.right <= width && arrow.rect.top >= 0 && arrow.rect.bottom <= height, 'Onscreen controls');
    assert.equal(arrow.label, i ? '次の演出へ' : '前の演出へ');
    if (before) assert.equal(arrow.text, i ? '＞' : '＜');
    else {
      assert.equal(arrow.text, '', 'No font-dependent fullwidth glyph');
      assert(arrow.icon && arrow.icon.rect.width === 24 && arrow.icon.rect.height === 24);
      assert.equal(arrow.icon.hidden, 'true');
      assert.equal(arrow.icon.focusable, 'false');
      assert.equal(arrow.icon.shape, i ? 'M9 5l6 7-6 7' : 'M15 5l-6 7 6 7');
      assert.equal(arrow.icon.strokeWidth, '2.25px');
      assert.notEqual(arrow.icon.stroke, 'none');
    }
  }
  report.checks.push({width, height, number, result});
};
try {
  for (const [width, height] of before ? [[1440, 900]] : [[1440, 900], [3840, 2160], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    const mobile = width <= 900;
    const context = await browser.newContext({viewport: {width, height}, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://services.swpc.noaa.gov/**', r => r.fulfill({path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json'}));
    await context.route('https://earthquake.usgs.gov/**', r => r.fulfill({json: {type: 'FeatureCollection', features: []}}));
    await context.route('**/api/live/v1/firms', r => r.fulfill({path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json'}));
    for (const host of ['api.open-meteo.com', 'air-quality-api.open-meteo.com']) await context.route(`https://${host}/**`, r => r.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({width, message: error.message}));
    await page.goto(`${base}/?exhibit=66#world`, {waitUntil: 'domcontentloaded'});
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    await page.locator('[data-feature-start]').click();
    await page.evaluate(() => GaiaMapDemo.stop());
    await page.waitForFunction(() => GaiaMapCategories.buttons().length === 71);
    await settled(66);
    await page.evaluate(() => document.fonts.ready);
    await check(width, height, 66);
    await page.locator('.japan-heading').screenshot({path: path.join(output, `${width}-66-heading.png`)});
    await page.screenshot({path: path.join(output, `${width}-66.png`)});
    if (!before) {
      const previous = page.locator('[data-map-heading-step="-1"]');
      const next = page.locator('[data-map-heading-step="1"]');
      const activate = async (button, number) => {
        if (mobile) await button.tap(); else await button.click();
        await settled(number);
        await check(width, height, number);
      };
      await activate(next, 67);
      await activate(previous, 66);
      if (!mobile) {
        await page.keyboard.press('Tab');
        await next.focus();
        assert(await next.evaluate(e => e.matches(':focus-visible') && getComputedStyle(e).outlineStyle !== 'none'));
        await page.locator('.japan-heading').screenshot({path: path.join(output, `${width}-66-focus.png`)});
        await next.press('Enter'); await settled(67);
        await next.press('Space'); await settled(68);
        assert(await next.evaluate(e => e === document.activeElement));
      }
      for (const number of [64, 71, 1, 4, 6, 15, 21]) {
        await select(number);
        await check(width, height, number);
      }
      await select(71);
      await activate(next, 1);
      await activate(previous, 71);
      report.checks.push({width, check: 'Native previous/next and 71↔01 wrap; desktop Enter/Space and focus retained'});
      if (width === 1440) {
        await page.emulateMedia({forcedColors: 'active'});
        const result = await scan();
        assert(result.arrows.every(a => a.icon.stroke !== 'none'), 'Visible system-color arrows');
        await page.locator('.japan-heading').screenshot({path: path.join(output, '1440-forced-colors.png')});
      }
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log(`PASS ${width}: ${before ? 'fullwidth glyph baseline' : 'chevrons, title geometry and navigation'}`);
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
