import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
const before = process.argv.includes('--before'), base = 'http://127.0.0.1:4492';
const widths = (process.argv.find(a => a.startsWith('--widths='))?.split('=')[1] || '3840,1440,901,390').split(',').map(Number);
const numbers = (process.argv.find(a => a.startsWith('--numbers='))?.split('=')[1] || '7,6,8,9,10,11,12,13,14').split(',').map(Number);
const out = path.resolve(`artifacts/map-metric-room-20260912/${before ? 'before' : 'after'}${process.env.GAIA_QA_SUFFIX || ''}`); fs.mkdirSync(out, { recursive: true });
const report = { status: 'running', checks: [], issues: [], errors: [], scope: 'Real local Chrome with original bundled data, external services blocked; touch emulation is not a physical phone.', sha256: Object.fromEntries(['app.js', 'map-unified-dock.css'].map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')])) };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); let page;
try {
  for (const width of widths) {
    const mobile = width <= 900, height = width >= 2400 ? 2160 : 900;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base); await context.route('https://**', r => r.abort()); page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(base + '/?exhibit=07#world', { waitUntil: 'domcontentloaded' }); await page.locator('[data-feature-start]').click(); await page.evaluate(() => GaiaMapDemo.stop());
    for (const n of numbers) {
      await page.evaluate(n => GaiaMapCategories.buttons()[n - 1].click(), n);
      await page.waitForFunction(n => Number(document.querySelector('#japan-mode-number').textContent) === n && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), n);
      const slider = page.locator('.signal-console-map [data-signal-time]');
      if (await slider.isVisible() && await slider.isEnabled()) { await slider.focus(); await slider.press('End'); await slider.press('Home'); }
      for (const position of before ? ['Home'] : ['Home', 'End']) {
      if (await slider.isVisible() && await slider.isEnabled()) await slider.press(position);
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
      const layout = await page.locator('.signal-console-map').evaluate(console => {
        const node = console.querySelector('.signal-console-heading'), value = node.querySelector('[data-signal-value]'), primary = node.querySelector('.signal-value-primary'), details = node.querySelector('.signal-value-details');
        const describe = n => { if (!n) return null; const r = n.getBoundingClientRect(), s = getComputedStyle(n); return { text: n.textContent, rect: r.toJSON(), fontSize: parseFloat(s.fontSize), lineHeight: s.lineHeight, visible: n.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.height > 0, overflowX: n.scrollWidth - n.clientWidth, overflowY: n.scrollHeight - n.clientHeight }; };
        const textRects = [], walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) { const t = walker.currentNode; if (!t.textContent.trim() || !t.parentElement.checkVisibility({ visibilityProperty: true })) continue; const r = document.createRange(); r.selectNodeContents(t); for (const b of r.getClientRects()) if (b.width && b.height) textRects.push({ text: t.textContent, ...b.toJSON() }); }
        return { console: describe(console), heading: describe(node), label: describe(node.querySelector('[data-signal-act]')), value: describe(value), primary: describe(primary), details: describe(details), textRects, dock: describe(console.closest('.map-command-dock')), pageOverflow: document.documentElement.scrollWidth - innerWidth };
      });
      const failures = [], h = layout.heading.rect;
      if (layout.heading.visible) {
        const c = layout.console.rect;
        if (h.left < c.left - 1 || h.right > c.right + 1 || h.top < c.top - 1 || h.bottom > c.bottom + 1) failures.push('heading outside console border');
      }
      if (layout.heading.visible) for (const r of layout.textRects) if (r.left < h.left - 1 || r.right > h.right + 1 || r.top < h.top - 1 || r.bottom > h.bottom + 1) failures.push(`text outside heading: ${r.text}`);
      if (layout.value.visible && (layout.value.overflowX > 1 || layout.value.overflowY > 1)) failures.push(`value clipped/overflowing x=${layout.value.overflowX} y=${layout.value.overflowY}`);
      if (layout.pageOverflow > 1) failures.push('page overflows');
      if (!mobile && n === 7 && layout.primary && layout.details?.visible) {
        const p = layout.primary.rect, d = layout.details.rect;
        if (!(d.left >= p.right + 8 && Math.abs((d.top + d.bottom - p.top - p.bottom) / 2) < 8)) failures.push('Ocean count must sit beside the value, not underneath');
      }
      report.checks.push({ width, n, position, ...layout }); if (failures.length) report.issues.push({ width, n, position, failures });
      if (layout.console.visible && (n === 7 || failures.length || width === 3840)) {
        const suffix = position === 'End' ? '-end' : '';
        await page.locator('.signal-console-map').screenshot({ path: path.join(out, `${width}-${n}${suffix}-console.png`) });
        await page.screenshot({ path: path.join(out, `${width}-${n}${suffix}-screen.png`) });
      }
      if (!before && !mobile && await slider.isVisible()) assert(await slider.evaluate(n => { if (n.disabled) return true; const r = n.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === n; }), `${width}/${n}: slider is reachable`);
      }
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []); await context.close(); console.log(`CHECK ${width}: ${report.issues.filter(r => r.width === width).length} affected cards`);
  }
  assert.deepEqual(report.errors, []); if (!before) assert.deepEqual(report.issues, []); report.status = before ? 'recorded' : 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; throw e; }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
