import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/map-scope-groups-2026-09-10/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, checks: [], errors: [], sha256: {}, environment: 'Installed Chrome, local real data and production CSP; saved NOAA/FIRMS and empty USGS responses. Emulated viewports, not physical devices or live-provider checks.' };
for (const f of ['map-exhibit-categories.js', 'map-exhibit-categories.css', 'map-mobile-shell.js', 'map-mobile-shell.css', 'map-ui-grid-polish.js', 'gaia-mode-loader.js', 'index.html']) report.sha256[f] = createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height] of before ? [[1440,900],[390,844]] : [[1440,900],[390,844],[320,568],[844,390],[3840,2160]]) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://services.swpc.noaa.gov/**', r => r.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    await context.route('https://earthquake.usgs.gov/**', r => r.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
    await context.route('**/api/live/v1/firms', r => r.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/?exhibit=66#world`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    await page.locator('[data-feature-start]').click();
    await page.evaluate(() => GaiaMapDemo.stop());
    const idle = number => page.waitForFunction(n => Number(document.querySelector('#japan-mode-number').textContent) === n && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), number);
    await idle(66);
    await page.waitForFunction(() => GaiaMapCategories.buttons().length === 71);
    const open = async () => {
      if (mobile) await page.locator('[data-mobile-sheet="exhibits"]').click();
      else {
        const extension = page.locator('[data-map-bank-toggle]:visible').first();
        await (await extension.count() ? extension : page.locator('.map-dock-bank-trigger')).click();
      }
    };
    const menu = page.locator(mobile ? '#map-mobile-sheet' : '.map-dock-bank-popover');
    const allButtons = mobile ? '[data-mobile-exhibit]' : '.map-category-group .map-mode-button';
    await open(); await menu.waitFor({ state: 'visible' });
    const numbers = await page.evaluate(() => GaiaMapCategories.buttons().map(b => Number(b.textContent)));
    assert.deepEqual(numbers, Array.from({ length: 71 }, (_, i) => i + 1));
    if (before) {
      assert.equal(await menu.locator('[role="tab"]').count(), 0);
      assert.equal(await menu.locator(allButtons).count(), 71);
      await menu.screenshot({ path: path.join(output, `${width}-mixed-themes.png`) });
      report.checks.push({ width, check: 'Baseline: all 71 entries present, no world/Japan primary grouping' });
      await context.close(); continue;
    }
    const tab = scope => menu.locator(`[role="tab"][data-map-scope="${scope}"]`);
    assert.equal(await tab('japan').getAttribute('aria-selected'), 'true');
    for (const scope of ['world','japan']) {
      await tab(scope).click();
      const expected = numbers.filter(n => scope === 'world' ? n <= 14 || n >= 70 : n >= 15 && n <= 69);
      const visible = await menu.locator(`${allButtons}:visible`).evaluateAll((bs, mobile) => bs.map(b => Number(mobile ? b.dataset.mobileExhibit : b.textContent)).sort((a,b) => a-b), mobile);
      assert.deepEqual(visible, expected);
      assert((await tab(scope).innerText()).includes(String(expected.length)));
      const panel = menu.locator(`[role="tabpanel"][data-map-scope="${scope}"]`);
      assert.equal(await panel.getAttribute('aria-labelledby'), await tab(scope).getAttribute('id'));
      const hierarchy = await panel.locator(mobile ? '.map-mobile-category' : '.map-category-group').evaluateAll((sections, mobile) => sections.map(s => ({ label: s.querySelector('h3, .map-mode-group-label').textContent, numbers: [...s.querySelectorAll(mobile ? '[data-mobile-exhibit]' : '.map-mode-button')].map(b => Number(mobile ? b.dataset.mobileExhibit : b.textContent)) })), mobile);
      assert.deepEqual(hierarchy.flatMap(s => s.numbers).sort((a,b) => a-b), expected);
      assert(hierarchy.every(s => s.numbers.length > 0));
      const climate = hierarchy.find(s => s.label.includes('気候と炭素'));
      assert.deepEqual(climate.numbers, scope === 'world' ? [6] : [16,24,25,26]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      const sizes = await menu.locator('[role="tab"]').evaluateAll(bs => bs.map(b => { const r=b.getBoundingClientRect(); return { width:r.width, height:r.height, clipped:b.scrollWidth > b.clientWidth + 1 }; }));
      assert(sizes.every(s => s.width >= 44 && s.height >= 44 && !s.clipped));
      await menu.screenshot({ path: path.join(output, `${width}-${scope}.png`) });
      report.checks.push({ width, scope, check: 'scope counts, single ownership, nested themes, visible layout', hierarchy, sizes });
    }
    await tab('japan').press('Home');
    assert.equal(await tab('world').getAttribute('aria-selected'), 'true');
    assert(await tab('world').evaluate(b => b === document.activeElement));
    await tab('world').press('ArrowRight');
    assert.equal(await tab('japan').getAttribute('aria-selected'), 'true');
    await tab('japan').press('ArrowRight');
    assert.equal(await tab('world').getAttribute('aria-selected'), 'true');
    report.checks.push({ width, check: 'Keyboard tab Home/ArrowRight/wrap and focus' });
    // Native click path across all renderer families and the split themes.
    for (const number of width === 1440 || width === 390 ? [6,16,24,7,17,31,66,69,70,71,14] : [70,66]) {
      const scope = number <= 14 || number >= 70 ? 'world' : 'japan';
      await tab(scope).click();
      const target = mobile ? menu.locator(`[data-mobile-exhibit="${number}"]`) : menu.locator('.map-mode-button').filter({ hasText: new RegExp(`^${String(number).padStart(2,'0')}$`) });
      await target.click(); await idle(number);
      await open(); await menu.waitFor({ state: 'visible' });
      assert.equal(await tab(scope).getAttribute('aria-selected'), 'true');
      assert.equal(await menu.locator(`${allButtons}[aria-current="true"]:visible`).count(), 1);
    }
    // Close and reopen without choosing an exhibit: return to the current scope.
    const current = Number(await page.locator('#japan-mode-number').textContent());
    const currentScope = current <= 14 || current >= 70 ? 'world' : 'japan';
    await tab(currentScope === 'world' ? 'japan' : 'world').click();
    await page.keyboard.press('Escape');
    await open();
    assert.equal(await tab(currentScope).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape');
    const next = mobile ? page.locator('[data-mobile-exhibit-step="1"]') : page.locator('[data-map-heading-step="1"]');
    await next.click(); await idle(current + 1);
    await open();
    const nextScope = current + 1 <= 14 || current + 1 >= 70 ? 'world' : 'japan';
    assert.equal(await tab(nextScope).getAttribute('aria-selected'), 'true');
    report.checks.push({ width, check: 'Native selection, provider switching, reopen follows current, next retains numeric route' });
    if (mobile) {
      await tab('world').click();
      await menu.locator('[role="tabpanel"]:visible .map-mobile-category-nav').getByRole('button', { name: '大地の活動', exact: true }).click();
      assert((await page.locator(':focus').textContent()).includes('大地の活動'));
      const title = await page.locator(':focus').boundingBox(), tabs = await menu.locator('[role="tablist"]').boundingBox();
      assert(title.y >= tabs.y + tabs.height - 1, 'Sticky scope tabs must not cover the focused theme');
      await menu.screenshot({ path: path.join(output, `${width}-theme-jump.png`) });
      report.checks.push({ width, check: 'Theme shortcut scroll/focus with sticky primary tabs' });
    }
    await context.close();
    console.log(`PASS ${width}x${height}: ${before ? 'baseline' : 'scope hierarchy and navigation'}`);
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2)); await browser.close();
}
