import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const root = path.resolve('artifacts/map-dock-frame-2026-09-26');
const output = path.join(root, before ? 'before' : 'after');
fs.mkdirSync(output, { recursive: true });
const baselinePath = path.join(root, 'before/report.json');
const baseline = !before && fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath)) : null;
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', environment: 'Installed headless Chrome; local CSP, external APIs blocked. Desktop and mobile emulation, not physical devices or production.',
  hashes: Object.fromEntries(['map-ui-grid-polish.css','gaia-mode-loader.js','index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  geometryBaseline: Boolean(baseline), checks: [], errors: [] };
if (before && process.argv.includes('--resume')) report.checks = JSON.parse(fs.readFileSync(path.join(output,'report.json'))).checks;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width,height,numbers] of [[1440,900,[6,7,8,9,10,11,12,13,14,15,16]], [3840,2160,[6,15]], [390,844,[6,15]]]) {
    const pending = numbers.filter(n => !report.checks.some(c=>c.width===width && +c.number===n));
    if (!pending.length) continue;
    const context = await browser.newContext({ viewport: { width,height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/#world-${String(pending[0]).padStart(2,'0')}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
    for (const n of pending) {
      const number = String(n).padStart(2,'0');
      if (n !== pending[0] && width < 900) {
        await page.goto(`${base}/#world-${number}`, { waitUntil: 'domcontentloaded' });
        await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
      } else if (n !== pending[0]) {
        await page.locator('[data-map-menu-toggle]').click();
        const tab = page.locator(`.map-mode-bank [role="tab"][data-map-scope="${n >= 15 ? 'japan' : 'world'}"]`);
        if (await tab.getAttribute('aria-selected') !== 'true') { await tab.focus(); await tab.press('Enter'); }
        const tile = page.locator('.map-mode-bank .map-mode-button').filter({ hasText: new RegExp(`^${number}$`) });
        await tile.scrollIntoViewIfNeeded(); await tile.focus(); await tile.press('Enter');
      }
      await page.waitForFunction(number => document.querySelector('#japan-title')?.dataset.exhibitNumber === number, number);
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
      // Dismiss the data introduction exactly as a user can, without altering layout.
      await page.locator('#japan-layer').press('Escape');
      await page.waitForTimeout(250);
      const scan = await page.evaluate(n => {
        const dock = document.querySelector(n < 15 ? '.map-command-dock' : '.gaia-live-exhibit-readout');
        const pseudo = getComputedStyle(dock,'::before'), style = getComputedStyle(dock);
        const selectors = n < 15 ? ['.map-dock-bank-trigger','[data-map-dock-title]','[data-map-dock-number]', '.map-dock-action--source','.map-dock-action--statistics']
          : ['.gaia-live-deck-selector-toggle','[data-live-deck-title]','[data-live-deck-number]', '.gaia-map-action--source','.gaia-map-action--statistics'];
        const elements = [dock,...selectors.map(s=>dock.querySelector(s)).filter(Boolean)];
        return { pseudo: { content: pseudo.content, border: pseudo.borderTopWidth, background: pseudo.backgroundImage },
          titleDecoration: n < 15 ? ['::before','::after'].map(p => getComputedStyle(dock.querySelector('.map-mode-bank'),p).content) : [],
          outer: { border: style.borderTopWidth, radius: style.borderTopLeftRadius, background: style.backgroundImage },
          boxes: elements.map(e => { const r=e.getBoundingClientRect(); return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10); }),
          title: document.querySelector('#japan-title').textContent,
          overflow: document.documentElement.scrollWidth-innerWidth };
      }, n);
      if (width > 900 && n < 15) {
        if (before) { assert.equal(scan.pseudo.content, '""'); assert.equal(scan.pseudo.border,'1px'); }
        else {
          assert.equal(scan.pseudo.content, 'none', 'Decorative inner frame must be absent');
          assert.deepEqual(scan.titleDecoration,['none','none'],'Title-cell edge and rectangular fill must also be absent');
        }
      }
      // Follow-up requests align desktop headings through 71 to 05.
      // Preserve the original frame evidence; mobile remains unchanged.
      if (baseline && width < 900) {
        const original = baseline.checks.find(c=>c.width===width && c.number===number);
        assert.deepEqual(scan.boxes, original.boxes, `${width}/${number}: title and action geometry unchanged`);
        assert.deepEqual(scan.outer, original.outer, `${width}/${number}: outer panel unchanged`);
        if (width < 900 || n >= 15) assert.deepEqual(scan.pseudo, original.pseudo, 'Existing live/mobile design unchanged');
      }
      assert.equal(scan.overflow, 0);
      if ([6,15].includes(n)) await page.screenshot({ path: path.join(output, `${width}-${number}.png`) });
      if (width > 900) {
        const trigger = page.locator(n < 15 ? '.map-dock-bank-trigger' : '.gaia-live-deck-selector-toggle');
        await trigger.click();
        await page.waitForFunction(() => document.querySelector('.map-dock-bank-popover')?.dataset.anchor === 'bottom');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
      } else {
        await page.locator('[data-mobile-sheet="tools"]').tap();
        await page.locator('#map-mobile-sheet').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
      }
      report.checks.push({ width,height,number,...scan });
      console.log(`PASS ${width}/${number}`);
    }
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(()=>{});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(`PASS ${report.checks.length} dock-frame checks`);
