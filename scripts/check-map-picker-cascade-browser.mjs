import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const out = 'artifacts/map-picker-depth-20260913'; fs.mkdirSync(out, { recursive: true });
const report = { status: 'running', scope: 'Local installed Chrome: native menu, scope tabs and keyboard; actual Web Animations and computed visual states. Viewport emulation; saved data, not live-provider or production validation.', checks: [], errors: [] };
report.hashes = Object.fromEntries(['map-exhibit-categories.js', 'map-ui-grid-polish.js', 'map-stable-navigation.js', 'map-mobile-shell.js', 'gaia-mode-loader.js', 'index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390 });
    await context.route('https://**', r => r.abort());
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto('http://127.0.0.1:4492/#world-08');
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 71 && Number(document.querySelector('#japan-mode-number')?.textContent) === 8 && document.querySelector('[data-map-menu-toggle]')?.disabled === false);
    const menu = page.locator('[data-map-menu-toggle]');
    const selector = width > 900 ? '#map-dock-bank-popover' : '#map-mobile-sheet';
    const picker = page.locator(selector), tab = scope => picker.locator(`[role="tab"][data-map-scope="${scope}"]`);
    const waitMotion = () => page.waitForFunction(selector => [...document.querySelector(selector).querySelectorAll('button')].some(b => b.getAnimations().some(a => a.id === 'map-picker-reveal')), selector);
    const countMotion = () => page.evaluate(() => document.getAnimations().filter(a => a.id === 'map-picker-reveal').length);
    const sample = async (name, scope, expected) => {
      await waitMotion();
      const timing = await picker.evaluate(root => [...root.querySelectorAll('button')].flatMap(button => button.getAnimations().filter(a => a.id === 'map-picker-reveal').map(a => ({ number: button.dataset.mobileExhibit || button.textContent.trim(), delay: a.effect.getTiming().delay, duration: a.effect.getTiming().duration, frames: a.effect.getKeyframes() }))));
      assert(timing.length >= expected);
      assert(new Set(timing.map(t => t.delay)).size > 5, 'Individual stagger, not one panel fade');
      assert(Math.abs(Math.max(...timing.map(t => t.delay + t.duration)) - 1200) < 1, 'Full cascade takes 1.2 seconds');
      assert(timing.every(t => t.frames.some(f => f.transform.includes('-320px')) && t.frames.some(f => f.transform.includes('48px'))), 'True negative-to-positive Z travel');
      assert(timing.every(t => t.frames.some(f => f.boxShadow.includes('34px'))), 'Each button has a bright arrival flash');
      const states = await picker.evaluate(async root => {
        const samples = [], started = performance.now();
        for (const at of [0, 120, 280, 440, 680, 1300]) {
          await new Promise(resolve => setTimeout(resolve, Math.max(0, at - (performance.now() - started))));
          samples.push({ age: performance.now() - started, tiles: [...root.querySelectorAll('.map-scope-panel:not([hidden]) .map-periodic-tile')].map(el => {
            const style = getComputedStyle(el), r = el.getBoundingClientRect();
            return { opacity: Number(style.opacity), transform: style.transform, boxShadow: style.boxShadow, borderColor: style.borderColor, width: r.width, height: r.height };
          }) });
        }
        return samples;
      });
      assert(states.slice(0, 3).some(s => s.tiles.some(t => t.opacity < .85)), 'Actual opacity changes');
      assert(states.slice(0, 4).some(s => new Set(s.tiles.map(t => t.opacity.toFixed(2))).size > 2), 'Visible stagger across tiles');
      assert(states.some(s => s.tiles.some(t => t.transform.startsWith('matrix3d('))), 'Actual browser-rendered perspective');
      assert(states.some(s => s.tiles.some(t => t.boxShadow.split('rgb').length >= 4)), 'Actual luminous multi-layer halo');
      assert(states.at(-1).tiles.every(t => t.opacity === 1 && t.width >= 44 && t.height >= 44));
      assert.equal(states.at(-1).tiles.length, expected);
      assert.equal(await countMotion(), 0, 'No continuing animation after entrance');
      assert.equal(await tab(scope).getAttribute('aria-selected'), 'true');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow <= 1);
      await picker.screenshot({ path: `${out}/${width}-${name}.png` });
      report.checks.push({ width, name, scope, tiles: expected, timings: timing.map(({ frames, ...t }) => t), states, horizontalOverflow: overflow });
    };
    if (width > 900) {
      await menu.hover();
      assert.equal(await menu.evaluate(el => document.activeElement === el), false, 'Hover does not steal keyboard focus');
    } else await menu.tap();
    await sample('open', 'world', 16);
    if (width > 900) { await menu.click(); assert.equal(await countMotion(), 0, 'Click after hover neither closes nor replays'); }
    await tab('japan').click(); await sample('japan', 'japan', 55);
    await tab('world').click(); await sample('world-return', 'world', 16);
    await tab('world').click(); assert.equal(await countMotion(), 0, 'Same scope does not restart');
    // Use native tab keys for rapid switches while the tiles are still moving.
    await tab('world').press('ArrowRight'); await waitMotion();
    await tab('japan').press('ArrowLeft'); await waitMotion();
    assert.equal(await picker.locator('[data-map-scope="japan"][role="tabpanel"]').getAttribute('hidden'), '');
    assert.equal(await picker.locator('[data-map-scope="japan"][role="tabpanel"]').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.id === 'map-picker-reveal').length), 0);
    await page.keyboard.press('Escape'); await picker.waitFor({ state: 'hidden' }); assert.equal(await countMotion(), 0);
    if (width > 900) {
      assert.equal(await menu.evaluate(el => document.activeElement === el), true, 'Escape restores focus without reopening');
      await menu.press('Shift+Tab'); await page.keyboard.press('Tab'); await waitMotion();
      assert.equal(await menu.evaluate(el => document.activeElement === el), true, 'Native Tab focus opens without moving focus');
      await menu.press('ArrowDown');
      assert.equal(await tab('world').evaluate(el => document.activeElement === el), true, 'Arrow key enters picker tabs');
    } else await menu.tap();
    await waitMotion();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.getAnimations().every(a => a.id !== 'map-picker-reveal'));
    await tab('japan').click(); assert.equal(await countMotion(), 0);
    assert(await picker.locator('.map-scope-panel:not([hidden]) .map-periodic-tile').evaluateAll(tiles => tiles.every(t => getComputedStyle(t).opacity === '1')));
    await page.keyboard.press('Escape'); await picker.waitFor({ state: 'hidden' });
    await menu.click(); assert.equal(await countMotion(), 0);
    await tab('japan').click();
    const target = width > 900 ? picker.locator('.map-mode-button').filter({ hasText: /^15$/ }) : picker.locator('[data-mobile-exhibit="15"]');
    await target.click();
    await page.waitForFunction(() => Number(document.querySelector('#japan-mode-number').textContent) === 15);
    await picker.waitFor({ state: 'hidden' });
    assert.equal(new URL(page.url()).hash, '#world-15');
    report.checks.push({ width, hoverAndKeyboardOpen: width > 900, touchOpen: width <= 900, rapidSwitch: true, closeCancels: true, reopenReplays: true, reducedMotionImmediate: true, routing: 15 });
    // Native screenshots while the actual animation runs (no paused timeline).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    if (width > 900) await menu.hover(); else await menu.tap();
    await waitMotion();
    for (const scope of ['world', 'japan']) {
      await page.waitForTimeout(1300); await tab(scope).click(); await waitMotion(); await page.mouse.move(1, 1);
      for (const [index, delay] of [120, 160, 220].entries()) {
        await page.waitForTimeout(delay);
        await picker.screenshot({ path: `${out}/${width}-${scope}-motion-${index}.png`, animations: 'allow' });
      }
    }
    await page.keyboard.press('Escape');
    if (width > 900) {
      await menu.hover(); await picker.waitFor({ state: 'visible' });
      await page.mouse.click(2, 300); await picker.waitFor({ state: 'hidden' });
      assert.equal(await countMotion(), 0, 'Outside click cancels entrance');
      await page.evaluate(() => GaiaMapDemo.start());
      await menu.hover(); await picker.waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => GaiaMapDemo.getState().active), false, 'Hover yields automatic touring to the visitor');
      await page.keyboard.press('Escape'); await picker.waitFor({ state: 'hidden' });
      report.checks.push({ width, outsideClickCloses: true, hoverStopsDemo: true });
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) {
  report.status = 'failed'; report.failure = e.stack; process.exitCode = 1;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure }));
}
