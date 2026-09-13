import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
const base = 'http://127.0.0.1:4492', before = process.argv.includes('--before');
const interactions = process.argv.includes('--interactions');
const widths = (process.argv.find(a => a.startsWith('--widths='))?.split('=')[1] || '1440,3840,901').split(',').map(Number);
const requested = process.argv.find(a => a.startsWith('--numbers='))?.split('=')[1].split(',').map(Number);
const out = path.resolve(`artifacts/map-chapter-width-20260912/${before ? 'before' : 'after'}${process.env.GAIA_QA_SUFFIX || ''}`); fs.mkdirSync(out, { recursive: true });
const report = { status: 'running', checks: [], issues: [], errors: [], scope: 'Installed local Chrome, bundled observations; desktop/touch emulation, not production or physical phones.', sha256: Object.fromEntries(['map-chapter-navigation.css', 'marine-cod-exhibit.css', 'food-exhibits.css', 'map-unified-dock.css', 'realtime-exhibits.css'].map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')])) };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); let page;
report.sha256['map-stable-navigation.css'] = createHash('sha256').update(fs.readFileSync('map-stable-navigation.css')).digest('hex');
const selectors = n => n === 1 ? ['.gaia-firms-readout', '.gaia-firms-chapter strong'] : n <= 5 ? ['.gaia-planet-signals-readout', '.gaia-planet-chapter strong'] : n <= 14 ? ['.map-command-dock', '[data-map-dock-title]'] : n <= 20 ? ['.gaia-live-exhibit-readout', '[data-live-deck-title]'] : n <= 30 ? ['.gaia-estat-readout', '.gaia-estat-chapter strong'] : n <= 69 ? ['.gaia-marine-cod-readout', '.gaia-marine-cod-chapter strong'] : ['.gaia-food-readout', '.gaia-food-chapter strong'];
try {
  for (const width of widths) {
    const height = width >= 2400 ? 2160 : 900, mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base); await context.route('https://**', r => r.abort());
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(base + '/?exhibit=68#world', { waitUntil: 'domcontentloaded' }); await page.locator('[data-feature-start]').click();
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 71); await page.evaluate(() => GaiaMapDemo.stop());
    for (const n of requested || [68, ...Array.from({ length: 71 }, (_, i) => i + 1).filter(n => n !== 68)]) {
      await page.evaluate(n => GaiaMapCategories.buttons()[n - 1].click(), n);
      await page.waitForFunction(n => Number(document.querySelector('#japan-mode-number').textContent) === n && (n < 31 || n > 69 || GaiaMarineCod.getState().dataState === 'ready') && (n < 70 || GaiaFoodExhibits.getState().dataState === 'ready'), n);
      if (n === 1) await page.waitForFunction(() => GaiaFirmsExhibit.getState().active && GaiaFirmsExhibit.getState().pointCount > 0);
      if (n >= 2 && n <= 5) await page.waitForFunction(() => GaiaPlanetSignals.getState().active && GaiaPlanetSignals.getState().pointCount > 0 && document.querySelector('.gaia-planet-signals-readout').dataset.loading !== 'true');
      await page.evaluate(() => document.fonts.ready);
      const [dockSelector, titleSelector] = selectors(n);
      const layout = await page.evaluate(({ dockSelector, titleSelector, mobile }) => {
        const dock = document.querySelector(dockSelector), title = document.querySelector(mobile ? '#japan-title' : titleSelector);
        const box = n => n?.getBoundingClientRect().toJSON();
        const range = document.createRange(); range.selectNodeContents(title);
        const style = getComputedStyle(title), lines = new Set([...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => Math.round(r.top))).size;
        const chapter = mobile ? title.parentElement : title.closest('.gaia-marine-cod-chapter,.gaia-estat-chapter,.gaia-firms-chapter,.gaia-planet-chapter,.gaia-live-deck-chapter,.gaia-food-chapter,.map-dock-bank-trigger');
        const visible = n => n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().height > 0 && n.checkVisibility({ visibilityProperty: true });
        const controls = [...dock.querySelectorAll('button,select,input')].filter(visible).map(n => ({ text: (n.getAttribute('aria-label') || n.textContent).slice(0, 50), rect: box(n) }));
        return { title: title.textContent, lines, font: style.font, fontSize: parseFloat(style.fontSize), titleBox: box(title), chapterBox: box(chapter), dockBox: box(dock), titleOverflow: title.scrollWidth - title.clientWidth, dockOverflow: dock.scrollWidth - dock.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, controls, grid: getComputedStyle(dock).gridTemplateColumns, regions: [...dock.children].filter(visible).map(n => ({ className: n.className, rect: box(n), position: getComputedStyle(n).position, gridColumn: getComputedStyle(n).gridColumn, gridRow: getComputedStyle(n).gridRow })) };
      }, { dockSelector, titleSelector, mobile });
      const failures = [];
      if (layout.lines !== 1) failures.push(`title has ${layout.lines} lines`);
      if (layout.titleOverflow > 1) failures.push(`title clipped by ${layout.titleOverflow}px`);
      if (layout.pageOverflow > 1 || layout.dockOverflow > 1) failures.push(`overflow page=${layout.pageOverflow} dock=${layout.dockOverflow}`);
      const r = layout.dockBox;
      for (const c of layout.controls) if (c.rect.left < r.left - 1 || c.rect.right > r.right + 1 || c.rect.top < r.top - 1 || c.rect.bottom > r.bottom + 1) failures.push(`outside dock: ${c.text}`);
      report.checks.push({ width, n, ...layout }); if (failures.length) report.issues.push({ width, n, title: layout.title, failures });
      if (n === 68 || interactions || (failures.length && width === 1440)) {
        await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
        await page.locator(dockSelector).screenshot({ path: path.join(out, `${width}-${n}-dock.png`) });
        if (!mobile) await page.locator(titleSelector).locator('..').screenshot({ path: path.join(out, `${width}-${n}-title.png`) });
      }
      if (interactions && !mobile) {
        const dock = page.locator(dockSelector), toggle = dock.locator('[data-map-bank-toggle], .map-dock-bank-trigger');
        const hit = await dock.locator('button,select,input').evaluateAll(nodes => nodes.filter(n => n.checkVisibility({ visibilityProperty: true }) && n.getBoundingClientRect().width).every(n => { const r = n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }));
        assert(hit, `${width}/${n}: controls are not covered`);
        await toggle.click(); await page.locator('#map-dock-bank-popover').waitFor({ state: 'visible' }); await toggle.click(); await page.locator('#map-dock-bank-popover').waitFor({ state: 'hidden' });
        const range = dock.locator('input[type="range"]').first();
        if (await range.count() && await range.isEnabled()) { await range.focus(); await range.press('Home'); const start = await range.inputValue(); await range.press('End'); assert.notEqual(await range.inputValue(), start, `${n}: time navigation remains usable`); }
        const next = dock.locator('[data-cod-step="1"], [data-firms-step="1"], [data-planet-step="1"], [data-live-deck-step="1"], [data-map-dock-mode-step="1"]');
        if (await next.count()) {
          await next.click(); await page.waitForFunction(expected => Number(document.querySelector('#japan-mode-number').textContent) === expected && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), n + 1);
          const [nextDock] = selectors(n + 1); await page.locator(nextDock).locator('[data-cod-step="-1"], [data-firms-step="-1"], [data-planet-step="-1"], [data-live-deck-step="-1"], [data-map-dock-mode-step="-1"]').click();
          await page.waitForFunction(expected => Number(document.querySelector('#japan-mode-number').textContent) === expected, n);
        }
        report.checks.at(-1).interactions = 'Actual control hit targets, chapter menu open/close, keyboard timeline Home/End, next/previous chapter';
      }
    }
    await context.close(); console.log(`AUDIT ${width}: ${report.issues.filter(x => x.width === width).length} affected titles/docks`);
  }
  assert.deepEqual(report.errors, []); if (!before) assert.deepEqual(report.issues, []); report.status = before ? 'recorded' : 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; throw e; }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
