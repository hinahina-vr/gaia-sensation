import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const menusOnly = process.argv.includes('--menus-only');
const base = process.env.GAIA_BASE_URL;
const output = path.resolve('artifacts/polish-20261015', before ? 'before' : 'after');
fs.mkdirSync(output, { recursive: true });
const report = { sha: execFileSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'with uncommitted changes', scope: 'Installed Chrome; local saved data; mobile emulation, not physical phones. GPU completion delay is fault injection, not a performance measurement.', cases: [], errors: [], consoleErrors: [], failedLocalRequests: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
report.browser = browser.version();
let page;
const ready = async () => {
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true');
  await page.evaluate(() => GaiaMapPlayback.stop());
  await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
};
try {
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [320, 568]]) {
    if (menusOnly && width !== 1440) continue;
    if (process.env.GAIA_POLISH_WIDTH && width !== Number(process.env.GAIA_POLISH_WIDTH)) continue;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, locale: 'ja-JP' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', r => r.abort());
    if (before) for (const file of ['app.js', 'map-ui-grid-polish.js', 'map-exhibit-categories.css', 'responsive-audit-fixes.css', 'src/exploration/climate-history-exhibits.js']) {
      const body = execFileSync('git', ['show', `4964037a8e806b5f346a5198c437f1decae61313:${file}`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
      await context.route(`**/${file}?*`, r => r.fulfill({ body, contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript' }));
    }
    page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
    page.on('requestfailed', r => { if (r.url().startsWith(base)) report.failedLocalRequests.push({ url: r.url(), error: r.failure()?.errorText }); });
    const result = { width, height }; report.cases.push(result);
    if (width === 1440) {
      await page.goto(`${base}/world/#world-06`, { waitUntil: 'domcontentloaded' }); await ready();
      await page.locator('[data-map-menu-toggle]').click();
      const tab = page.locator('.map-mode-bank [role="tab"][data-map-scope="japan"]');
      await tab.waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      result.menuHit = await tab.evaluate(el => { const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { reachable: el === top || el.contains(top), blocker: top?.outerHTML.slice(0, 350) }; });
      await page.screenshot({ path: path.join(output, `${width}-menu.png`) });
      if (!before) {
        assert(result.menuHit.reachable, 'Japan tab must not be covered by the metric legend');
        assert.equal(await page.locator('#map-signal-encoding-legend-dock').isVisible(), false, 'No ghost legend behind translucent menu');
        await page.locator('.map-metric-drag-handle').waitFor({ state: 'hidden' });
        await page.keyboard.press('Escape');
        await page.locator('#map-signal-encoding-legend-dock').waitFor({ state: 'visible' });
        await page.locator('.map-metric-drag-handle').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-map-menu-toggle]').evaluate(el => document.activeElement === el), true);
        await page.locator('.map-dock-bank-trigger').click();
        assert.equal(await page.locator('.map-dock-bank-popover').getAttribute('data-anchor'), 'bottom');
        await tab.click();
        await page.keyboard.press('Escape');
        await page.locator('[data-map-menu-toggle]').click();
        await tab.click();
        await page.locator('.map-mode-bank .map-mode-button').filter({ hasText: /^49$/ }).click();
        await page.waitForFunction(() => Number(document.querySelector('#japan-mode-number').textContent) === 49);
      }
      if (menusOnly) { await context.close(); continue; }
      // Count concurrent base-program compilation while completion is held back.
      // Staggered requests cross task boundaries (unlike a synchronous click loop).
      await page.goto(`${base}/world/#world-01`, { waitUntil: 'domcontentloaded' }); await ready();
      await page.evaluate(() => {
        const proto = WebGL2RenderingContext.prototype, original = proto.getProgramParameter, link = proto.linkProgram, remove = proto.deleteProgram;
        const running = new Map();
        globalThis.__compileProbe = { max: 0, started: 0, failNext: false, hold: true };
        proto.linkProgram = function(p) { const value = link.call(this, p); if (this.canvas.id === 'gaia-canvas') { running.set(p, performance.now()); __compileProbe.started++; __compileProbe.max = Math.max(__compileProbe.max, running.size); } return value; };
        proto.deleteProgram = function(p) { running.delete(p); return remove.call(this, p); };
        proto.getProgramParameter = function(p, key) {
          if (this.canvas.id === 'gaia-canvas' && key === 0x91B1 && running.has(p)) {
            if (__compileProbe.hold) return false;
            if (performance.now() - running.get(p) < 1200) return false;
            const value = original.call(this, p, key); if (value) running.delete(p); return value;
          }
          if (this.canvas.id === 'gaia-canvas' && key === this.LINK_STATUS && __compileProbe.failNext) { __compileProbe.failNext = false; return false; }
          return original.call(this, p, key);
        };
      });
      for (const index of [2, 5, 7, 8]) { await page.evaluate(i => GaiaMapObservationAdapter.selectMode(i), index); await page.waitForTimeout(100); }
      await page.evaluate(() => { __compileProbe.hold = false; });
      await page.waitForFunction(() => document.querySelector('#gaia-canvas').dataset.baseShaderState === 'ready' && document.querySelector('#gaia-canvas').dataset.baseShaderModes.split(',').includes('8'));
      result.compilation = await page.evaluate(() => ({ ...__compileProbe }));
      if (!before) { assert.equal(result.compilation.max, 1); assert(result.compilation.started <= 2, 'Intermediate requests should be coalesced'); }
      await page.evaluate(() => { __compileProbe.failNext = true; GaiaMapObservationAdapter.selectMode(4); });
      await page.waitForFunction(() => document.querySelector('#gaia-canvas').dataset.baseShaderState === 'error');
      await page.evaluate(() => GaiaMapObservationAdapter.selectMode(4));
      await page.waitForTimeout(2500);
      result.reselectAfterFailure = await page.locator('#gaia-canvas').getAttribute('data-base-shader-state');
      if (!before) { assert.equal(result.reselectAfterFailure, 'ready'); assert.equal(await page.locator('#error-panel').isVisible(), false); }
    }
    for (const number of [72, 73]) {
      await page.goto(`${base}/world/#world-${number}`, { waitUntil: 'domcontentloaded' }); await ready();
      await page.waitForFunction(() => GaiaClimateHistory?.getState().dataState === 'ready' && Number(document.querySelector('#gaia-climate-canvas').dataset.climateVisibleCount) > 0);
      await page.waitForFunction(() => document.querySelector('#japan-overlay').dataset.titleSeparatorState === 'complete');
      await ready();
      if (await page.locator('#map-responsive-data').isVisible()) {
        const drawer = page.locator('#map-responsive-data'); if (!(await drawer.evaluate(el => el.open))) await drawer.locator(':scope > summary').click();
        if (!before) {
          const drawerTop = await drawer.evaluate(el => el.getBoundingClientRect().top);
          const navBottom = await page.locator('#map-stable-navigation').evaluate(el => el.getBoundingClientRect().bottom);
          assert(drawerTop >= navBottom + 8, 'Expanded observation data must not cover navigation');
          await page.locator('[data-climate-overview]').scrollIntoViewIfNeeded();
          await page.locator('[data-climate-overview]').click();
          await drawer.locator(':scope > summary').click();
          assert.equal(await drawer.evaluate(el => el.open), false, 'Close remains reachable after scrolling');
          await drawer.locator(':scope > summary').click();
        }
      }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(output, `${width}-${height}-${number}.png`) });
      const bounds = await page.locator('.gaia-climate-readout').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, scroll: el.scrollWidth, width: el.clientWidth }; });
      result[number] = { bounds };
      assert(bounds.x >= 0 && bounds.right <= width + 1 && bounds.width + 1 >= bounds.scroll, 'Readout must fit');
      if (number === 72 && width === 1440) {
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        await page.route('**/cyclones/1982.json?*', async r => { await gate; await r.fallback(); });
        const old = await page.locator('[data-climate-detail]').textContent();
        await page.locator('[data-climate-year]').fill('1982');
        result.loading = await page.evaluate(() => ({ busy: document.querySelector('.gaia-climate-readout').getAttribute('aria-busy'), detail: document.querySelector('[data-climate-detail]').textContent, selected: document.querySelector('[data-climate-selected]').textContent, period: document.querySelector('[data-climate-period]').textContent }));
        release();
        if (!before) { assert.equal(result.loading.busy, 'true'); assert.notEqual(result.loading.detail, old, 'Previous-year details must not accompany a new year'); }
        await page.waitForFunction(() => GaiaClimateHistory.getState().dataState === 'ready');
        await page.evaluate(() => GaiaMapPlayback.start());
        await page.locator('[data-climate-basin]').selectOption('WP');
        result.playingAfterManualChoice = await page.evaluate(() => GaiaClimateHistory.getState().playing);
        if (!before) assert.equal(result.playingAfterManualChoice, false);
      }
    }
    console.log(`Polish ${width}x${height} complete`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; if (page && !page.isClosed()) { await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); report.state = await page.evaluate(() => ({ ready: document.documentElement.dataset.gaiaAppReady, error: document.querySelector('#error-panel')?.textContent, classes: document.querySelector('#japan-layer')?.className })).catch(() => null); } throw error; }
finally { fs.writeFileSync(path.join(output, menusOnly ? 'report-menus.json' : process.env.GAIA_POLISH_WIDTH ? `report-${process.env.GAIA_POLISH_WIDTH}.json` : 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
