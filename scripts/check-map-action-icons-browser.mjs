import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const before = process.argv.includes('--before');
const mobileOnly = process.argv.includes('--mobile-only');
const output = path.resolve('artifacts/map-action-icons-2026-09-26', before ? 'before' : mobileOnly ? 'mobile' : 'after');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktree: 'uncommitted changes',
  environment: 'Installed Chrome with local CSP; desktop and touch emulation, external data blocked, not live/production verification.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const actionSelector = '.map-dock-action:visible, .gaia-map-actions > .gaia-map-action:visible';
async function scan(label, screenshot = true) {
  await page.waitForTimeout(150);
  const icons = await page.locator(actionSelector).evaluateAll(buttons => buttons.map(button => {
    const svg = button.querySelector('i svg');
    const box = svg?.getBoundingClientRect();
    return { label: button.textContent.trim(), svg: Boolean(svg), shapes: svg?.querySelectorAll('path,rect,circle').length || 0,
      width: box?.width || 0, height: box?.height || 0, stroke: svg ? getComputedStyle(svg).stroke : null,
      fills: svg ? [...svg.querySelectorAll('[fill^="url("]')].map(shape => {
        const id = shape.getAttribute('fill').slice(5, -1);
        return { id, exists: Boolean(svg.querySelector(`#${CSS.escape(id)}`)), unique: document.querySelectorAll(`#${CSS.escape(id)}`).length === 1 };
      }) : [], button: button.getBoundingClientRect().toJSON() };
  }));
  assert.equal(icons.length, 2, `${label}: visible source and analysis actions`);
  report.checks.push({ label, icons });
  console.log(`${label}: ${icons.filter(icon => icon.svg).length}/${icons.length} icons`);
  if (screenshot) {
    const bounds = icons.map(icon => icon.button);
    const x = Math.max(0, Math.min(...bounds.map(box => box.x)) - 8);
    const y = Math.max(0, Math.min(...bounds.map(box => box.y)) - 8);
    await page.screenshot({ path: path.join(output, `${label}.png`), clip: { x, y,
      width: Math.min(page.viewportSize().width, Math.max(...bounds.map(box => box.right)) + 8) - x,
      height: Math.min(page.viewportSize().height, Math.max(...bounds.map(box => box.bottom)) + 8) - y } });
  }
  if (!before) for (const icon of icons) {
    assert(icon.svg && icon.shapes > 0 && icon.width >= 24 && icon.height >= 24, `${label}: missing/empty icon: ${JSON.stringify(icon)}`);
    assert.notEqual(icon.stroke, 'none');
    assert(icon.fills.every(fill => fill.exists && fill.unique), `${label}: broken or duplicated gradient IDs`);
  }
  return icons;
}
async function ready(showGuide = true) {
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true'
    && globalThis.GaiaMapCategories?.buttons().length === 71
    && document.querySelector('#japan-layer')?.getAttribute('aria-hidden') === 'false');
  await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
  if (showGuide) await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
}
try {
  for (const [route, width, delay] of mobileOnly ? [] : [['title', 1440, 0], ['direct', 3840, 0], ['direct-slow-dock', 1440, 1800]]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2160 : 900 } });
    await context.route('https://**', route => route.abort());
    await enforceBrowserSecurity(context, base);
    if (delay) await context.route('**/map-ui-grid-polish.js?*', async route => {
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.fallback();
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/${route === 'title' ? '?routeGuide=0' : '#world'}`, { waitUntil: 'domcontentloaded' });
    if (route === 'title') {
      await page.locator('#gaia-opening-sound-off').click();
      await page.locator('#gaia-opening-skip').click();
      await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu').classList.contains('is-visible'));
      await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
      await page.locator('#gaia-opening-route-other').click();
      await page.locator('#gaia-opening').waitFor({ state: 'hidden' });
    }
    await ready();
    await scan(`${route}-${width}-01`);
    if (!before) {
      for (const number of [4, 6, 15, 21, 31, 70, 1]) {
        // Select through the actual menu button, not a direct exhibit API.
        await page.locator('[data-map-menu-toggle]').click();
        const tile = page.locator('.map-mode-bank .map-mode-button').filter({ hasText: new RegExp(`^${String(number).padStart(2, '0')}$`) });
        // Select the scope first when moving to the Japan catalogue.
        const scope = number >= 15 && number < 70 ? 'japan' : 'world';
        const scopeTab = page.locator(`.map-mode-bank [role="tab"][data-map-scope="${scope}"]`);
        await scopeTab.focus();
        await scopeTab.press('Enter');
        await tile.click();
        await page.waitForFunction(n => Number(document.querySelector('#japan-mode-number').textContent) === n
          && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
        await scan(`${route}-${width}-${number}`, number === 6 || number === 70);
      }
      await page.locator('.gaia-map-action--source:visible').click();
      await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
      await page.locator('#japan-data-close').click();
      await page.locator('.gaia-map-action--analysis:visible').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.gaia-map-action--analysis:visible').getAttribute('aria-disabled'), 'true');
      assert.equal(await page.locator('#gaia-statistics-lab').isVisible(), false);
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  if (!before) for (const number of [1, 6]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.route('https://**', route => route.abort());
    await enforceBrowserSecurity(context, base);
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#world-${String(number).padStart(2, '0')}`, { waitUntil: 'domcontentloaded' });
    await ready(false);
    await page.locator('[data-mobile-sheet="tools"]').tap();
    const tools = page.locator('#map-mobile-sheet');
    const source = tools.getByRole('button', { name: 'データの出典', exact: true });
    const analysis = tools.getByRole('button', { name: '統計分析', exact: true });
    for (const button of [source, analysis]) {
      assert(await button.locator('svg').isVisible());
      assert((await button.locator('svg').boundingBox()).width >= 24);
    }
    await page.screenshot({ path: path.join(output, `mobile-${number}-tools.png`) });
    await source.tap();
    await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
    await page.locator('#japan-data-close').tap();
    await page.locator('[data-mobile-sheet="tools"]').tap();
    if (number === 1) assert(await analysis.isDisabled() || await analysis.getAttribute('aria-disabled') === 'true');
    else {
      await analysis.tap();
      await page.locator('#gaia-statistics-lab[aria-hidden="false"]').waitFor();
      await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
      assert(Number(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count')) > 0);
      await page.locator('#gaia-statistics-close').tap();
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ label: `mobile-${number}`, icons: 'source and analysis visible', source: 'opened', analysis: number === 1 ? 'unavailable preserved' : 'real chart opened' });
    console.log(`mobile-${number}: icons and actions passed`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  report.hashes = Object.fromEntries(['src/exploration/map-exhibit-actions.js', 'map-ui-grid-polish.js', 'gaia-mode-loader.js', 'index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, report: path.join(output, 'report.json') }));
