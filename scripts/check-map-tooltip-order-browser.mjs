import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4492';
const output = path.resolve(process.argv[3] || 'artifacts/map-tooltip-order');
const probe = process.argv.includes('--probe');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', checks: [], errors: [], externalData: 'Network blocked; saved data/fallbacks, not live-feed verification' };
report.hashes = Object.fromEntries(['app.js', 'app-content.js', 'map-exhibit-categories.js', 'gaia-mode-loader.js', 'index.html',
  ...['index', 'firms-exhibit', 'planet-signals-exhibit', 'map-cruise', 'map-playback', 'map-demo', 'map-theme-background', 'map-theme-catalog'].map(name => `src/exploration/${name}.js`),
].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const tile = (page, number) => page.locator('.map-mode-bank .map-mode-button').filter({ hasText: new RegExp(`^${String(number).padStart(2, '0')}$`) });
const settled = page => page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
const expected = [
  { number: '01', id: 'global-wind-pressure', symbol: '風速', title: '風がつなぐ世界', subtitle: '熱や水を運ぶ風が、遠くの空と暮らしをつなぐ' },
  { number: '02', id: 'usgs-earthquake-ripples', symbol: '地震', title: '揺れる星に暮らす', subtitle: '足もとの変動を知り、揺れに備える暮らしを考える' },
  { number: '03', id: 'global-aerosol-light', symbol: 'PM2.5', title: '見えない空気の行方' },
  { number: '04', id: 'nasa-firms-active-fire', symbol: '火災', title: '火と暮らしの境界', subtitle: '生きもののすみかと暮らしを脅かす火を、観測から考える' },
  { number: '05', id: 'global-cloud-radiance', symbol: '雲量', title: '雲と光の分け前' },
];
async function checkSelected(page, number, width) {
  const wanted = expected[number - 1];
  await page.waitForFunction(n => document.querySelector('#japan-mode-number').textContent === n, wanted.number);
  await settled(page);
  const state = await page.evaluate(() => {
    const fire = GaiaFirmsExhibit.getState().active;
    const provider = fire ? GaiaFirmsExhibit : GaiaPlanetSignals;
    const source = provider.getSourceInfo();
    return { number: document.querySelector('#japan-mode-number').textContent,
      title: document.querySelector('#japan-mode-title').textContent,
      id: source?.datasets[0].id, sourceNumber: source?.number,
      subtitle: GaiaAppContent.MAP_TITLE_SUBTITLES[source?.number],
      playback: GaiaMapPlayback.getState(), hash: location.hash };
  });
  assert.equal(state.title, wanted.title);
  assert.equal(state.id, wanted.id);
  assert.equal(state.sourceNumber, wanted.number);
  if (wanted.subtitle) assert.equal(state.subtitle, wanted.subtitle);
  assert.equal(state.hash, `#world-${wanted.number}`);
  assert.equal(state.playback.supported, number === 4);
  report.checks.push({ name: 'selected-exhibit', width, ...state });
}
async function createPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900 });
  await context.addInitScript(() => {
    sessionStorage.setItem('gaia:mode-entry-guide:map:v3', 'seen');
    localStorage.setItem('gaia-senseware-bgm-muted', 'true');
  });
  await context.route(/^https?:\/\//, route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${base}/#world`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 71 && globalThis.GaiaMapCruise
    && document.documentElement.dataset.gaiaAppReady === 'true' && document.querySelector('#japan-layer').getAttribute('aria-hidden') === 'false');
  await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
  await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
  await settled(page);
  return { page, context };
}
async function sample(page, milliseconds) {
  return page.evaluate(ms => new Promise(resolve => {
    const rows = [], start = performance.now();
    const tick = () => {
      const tooltip = document.querySelector('#map-mode-preview'), rect = tooltip.getBoundingClientRect();
      rows.push({ at: performance.now() - start, number: tooltip.querySelector('span').textContent.split(' /')[0],
        x: rect.x, y: rect.y, opacity: Number(getComputedStyle(tooltip).opacity), open: tooltip.classList.contains('is-open') });
      if (performance.now() - start < ms) requestAnimationFrame(tick); else resolve(rows);
    };
    requestAnimationFrame(tick);
  }), milliseconds);
}
try {
  const { page, context } = await createPage(1440, 1100);
  await page.locator('[data-map-menu-toggle]').click();
  await page.locator('#map-picker-japan-tab').click();
  await page.waitForTimeout(850);
  await tile(page, 63).scrollIntoViewIfNeeded();
  // Rapid pointer changes used to let the previous anchor's 260 ms timer move
  // the new tooltip back to the old button.
  await tile(page, 63).hover();
  await page.waitForTimeout(80);
  await tile(page, 64).hover();
  const rapid = await sample(page, 500);
  report.checks.push({ name: 'rapid-pointer', samples: rapid });
  // A keyboard-focused tile and pointer-over events on other tiles must use
  // the same intent priority, including crossings into the live/detail child.
  await page.keyboard.press('Tab');
  await tile(page, 63).focus();
  await page.waitForTimeout(300);
  await tile(page, 64).hover();
  const mixed = await sample(page, 350);
  report.checks.push({ name: 'keyboard-and-pointer', samples: mixed });
  await page.screenshot({ path: path.join(output, 'desktop-tooltip.png') });
  if (!probe) {
    const stable = rapid.filter(row => row.at > 80);
    assert.equal(new Set(stable.map(row => Math.round(row.x))).size, 1, 'Old hover timers moved the current tooltip');
    assert.equal(new Set(stable.map(row => Math.round(row.y))).size, 1, 'Tooltip moved vertically after settling');
    assert(stable.every(row => row.number === '64' && row.open && row.opacity > .99));
    assert(mixed.every(row => row.number === '63' && row.open && row.opacity > .99), 'Keyboard and pointer handlers disagree on preview intent');
    await tile(page, 64).focus();
    await page.waitForTimeout(80);
    await tile(page, 63).focus();
    const focusSamples = await sample(page, 500);
    const focusSettled = focusSamples.filter(row => row.at > 80);
    assert(focusSettled.every(row => row.number === '63' && row.open && row.opacity > .99));
    assert.equal(new Set(focusSettled.map(row => `${Math.round(row.x)},${Math.round(row.y)}`)).size, 1);
    report.checks.push({ name: 'rapid-keyboard-focus', samples: focusSamples });
    await page.locator('#japan-close').focus();
    await page.mouse.move(0, 950);
    await page.waitForTimeout(300);
    assert((await sample(page, 300)).every(row => !row.open && row.opacity === 0), 'Preview returned after leaving the picker');
    await page.locator('[data-map-menu-toggle]').click();
    await page.locator('#map-picker-world-tab').click();
    await page.waitForTimeout(850);
    const world = await page.locator('.map-category-group[data-map-scope="world"][data-map-category="planet"] .map-mode-button').evaluateAll(buttons => buttons.map(button => ({
      number: button.textContent.trim(), symbol: button.dataset.mapSymbol,
      id: button.dataset.planetExhibit || button.dataset.firmsExhibit,
    })));
    assert.deepEqual(world, expected.map(({ number, symbol, id }) => ({ number, symbol, id })));
    await page.screenshot({ path: path.join(output, 'desktop-world-order.png') });
    await tile(page, 1).click();
    await checkSelected(page, 1, 1440);
    for (const n of [2, 3, 4, 5]) {
      await page.locator('[data-map-stable-step="1"]').click();
      await checkSelected(page, n, 1440);
    }
    await page.locator('[data-map-stable-step="-1"]').click();
    await checkSelected(page, 4, 1440);
    await page.screenshot({ path: path.join(output, 'desktop-fire-04.png') });
    // Direct hash navigation must agree with buttons; renderer IDs stay stable.
    for (const n of [1, 2, 4]) {
      await page.evaluate(n => { location.hash = `world-${String(n).padStart(2, '0')}`; }, n);
      await checkSelected(page, n, 1440);
    }
  }
  await context.close();
  if (!probe) {
    const { page: mobile, context: mobileContext } = await createPage(390, 844);
    await checkSelected(mobile, 1, 390);
    await mobile.locator('[data-map-menu-toggle]').click();
    await mobile.waitForTimeout(1000);
    const mobileOrder = await mobile.locator('[data-mobile-exhibit]').evaluateAll(buttons => buttons.slice(0, 5).map(button => ({
      number: button.dataset.mobileExhibit, symbol: button.dataset.mapSymbol, description: button.getAttribute('aria-description'),
    })));
    assert.deepEqual(mobileOrder.map(({ number, symbol }) => ({ number: Number(number), symbol })), expected.map(({ number, symbol }) => ({ number: Number(number), symbol })));
    for (const n of [1, 2, 4]) assert(mobileOrder[n - 1].description.includes(expected[n - 1].subtitle));
    await mobile.screenshot({ path: path.join(output, 'mobile-world-order.png') });
    await mobile.locator('[data-mobile-exhibit="2"]').click();
    await checkSelected(mobile, 2, 390);
    await mobile.locator('[data-map-stable-step="1"]').click();
    await checkSelected(mobile, 3, 390);
    await mobile.locator('[data-map-stable-step="1"]').click();
    await checkSelected(mobile, 4, 390);
    await mobile.screenshot({ path: path.join(output, 'mobile-fire-04.png') });
    await mobileContext.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = probe ? 'reproduction-recorded' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
