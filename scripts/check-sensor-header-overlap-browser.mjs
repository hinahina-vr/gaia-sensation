import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_SENSOR_QA_BASE || 'http://127.0.0.1:4507';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local fixture server only');
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/sensor-header-overlap-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['sensors/index.html', 'sensors/sensor-platform.js', 'sensors/sensor-audio.js', 'sensors/sensor-platform.css', 'sensors/sensor-map-ui.css', 'sensors/sensor-header.css'].filter(file => fs.existsSync(file));
const report = { status: 'running', before, checks: [], errors: [], missing: [], hashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), scope: 'Installed Chrome under production CSP, real local DOM and controls with simulated sensor/account API fixtures. No real account writes or hardware. Mobile/touch emulation, not physical devices.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const scanHeader = async () => {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => {
    if (document.documentElement.dataset.sensorView !== 'map') return true;
    const map = document.querySelector('#map'), rect = map.getBoundingClientRect();
    return rect.height > 0 && Math.abs(rect.top - parseFloat(getComputedStyle(map).top)) < 1;
  });
  return page.evaluate(() => {
  const nodes = [...document.querySelectorAll('.sensor-topbar nav a, #sensor-logout, .sensor-home-back, .gaia-mode-entry-guide-replay, #gaia-audio-toggle, #gaia-audio-volume-panel')].filter(node => node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
  const items = nodes.map(node => {
    const r = node.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(node);
    return { label: node.getAttribute('aria-label') || node.textContent.trim(), rect: r.toJSON(), hit: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), textRects: [...range.getClientRects()].map(rect => rect.toJSON()) };
  });
  const overlaps = [];
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const p = items[a].rect, q = items[b].rect;
    const area = Math.max(0, Math.min(p.right,q.right)-Math.max(p.left,q.left)) * Math.max(0, Math.min(p.bottom,q.bottom)-Math.max(p.top,q.top));
    if (area > 1) overlaps.push({ a: items[a].label, b: items[b].label, area });
  }
  const topbar = document.querySelector('.sensor-topbar').getBoundingClientRect().toJSON();
  const telemetry = document.querySelector('.sensor-global-sync').getBoundingClientRect().toJSON();
  const map = document.querySelector('#map').getBoundingClientRect().toJSON();
  return { view: document.documentElement.dataset.sensorView, items, overlaps, topbar, telemetry, map, overflow: document.documentElement.scrollWidth - innerWidth };
  });
};
const verify = (scan, width, height) => {
  assert.deepEqual(scan.overlaps, []);
  assert(scan.items.every(item => item.hit), 'A control was obstructed');
  assert.equal(scan.overflow, 0);
  for (const item of scan.items) {
    assert(item.rect.x >= -1 && item.rect.right <= width + 1 && item.rect.y >= -1 && item.rect.bottom <= height + 1, `Control outside viewport: ${item.label}`);
    assert(item.rect.top >= scan.topbar.top - 1 && item.rect.bottom <= scan.topbar.bottom + 1, `Control escaped header: ${item.label}; ${JSON.stringify({ item: item.rect, topbar: scan.topbar, view: scan.view })}`);
  }
  if (scan.view === 'map') {
    assert(Math.abs(scan.telemetry.top - scan.topbar.bottom) <= 1, 'Telemetry must follow the header');
    assert(Math.abs(scan.map.top - scan.telemetry.bottom) <= 1, 'Map must follow telemetry');
  }
};
try {
  const specs = process.env.GAIA_HEADER_SIZES?.split(',').map(value => value.split('x').map(Number)) || (before ? [[1440, 900], [832, 900], [390, 844]] : [[1920,1080], [1440,900], [1401,900], [1400,900], [1024,768], [832,900], [761,900], [760,900], [390,844], [320,568], [844,390]]);
  for (const [width, height] of specs) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.request.post(base + '/__qa/reset');
    await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:sensor:v3', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    for (const view of before ? ['login', 'map'] : ['login', 'map', 'devices', 'profile', 'guide', 'terms']) {
      const authenticated = ['devices', 'profile'].includes(view);
      await page.goto(`${base}/sensors/${authenticated ? '?authenticated=1' : ''}#${view}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(view => document.documentElement.dataset.sensorView === view, view);
      await page.locator('[data-gaia-mode-guide-replay="sensor"]').waitFor();
      await page.waitForTimeout(400);
      const scan = await scanHeader();
      report.checks.push({ width, height, phase: 'collapsed', ...scan });
      await page.screenshot({ path: path.join(output, `${width}x${height}-${view}-header.png`), clip: { x: 0, y: 0, width, height: Math.min(height, scan.topbar.height + 40) } });
      if (!before) {
        verify(scan, width, height);
        const activate = selector => width < 900 ? page.locator(selector).tap() : page.locator(selector).click({ delay: 90 });
        await activate('#gaia-audio-toggle');
        await page.waitForTimeout(480);
        const expanded = await scanHeader(); verify(expanded, width, height);
        report.checks.push({ width, height, phase: 'volume expanded', ...expanded });
        assert.equal(await page.locator('#gaia-audio-volume-panel').getAttribute('aria-hidden'), 'false');
        if (['login','map'].includes(view)) await page.screenshot({ path: path.join(output, `${width}x${height}-${view}-volume.png`), clip: { x: 0, y: 0, width, height: Math.min(height, expanded.topbar.height + 40) } });
        if (view === 'login' && [1440,390].includes(width)) {
          await page.locator('#gaia-audio-volume').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
          await page.waitForFunction(() => document.querySelector('#gaia-audio-volume-value').textContent === '1%');
          assert.equal(await page.locator('#gaia-audio-volume').inputValue(), '1');
        }
        if (['login', 'map', 'devices'].includes(view) && [1440,390].includes(width)) {
          // Opening another control must succeed on the first click even when
          // dismissing the volume strip changes the header's geometry.
          await activate('[data-gaia-mode-guide-replay="sensor"]');
          await page.locator('#gaia-mode-entry-guide.is-feature-ready').waitFor({ timeout: 3000 });
          assert.equal(await page.locator('#gaia-audio-toggle').getAttribute('aria-expanded'), 'false');
          await activate('[data-feature-start]');
          await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('[data-gaia-mode-guide-replay="sensor"]').evaluate(button => button === document.activeElement), true);
        } else await page.keyboard.press('Escape');
        await page.waitForTimeout(480);
        const collapsed = await scanHeader(); verify(collapsed, width, height);
        assert.equal(collapsed.topbar.height, scan.topbar.height, 'Closing volume restores header height');
        assert.equal(await page.locator('#gaia-audio-toggle').getAttribute('aria-expanded'), 'false');
        if (view === 'map') {
          const tools = await page.locator('#public-map-search-open, #public-map-directory-toggle, #public-map-zoom-in, #public-map-zoom-out, #public-map-reset, #refresh-map').evaluateAll(nodes => nodes.map(node => {
            const rect = node.getBoundingClientRect();
            return { id: node.id, rect: rect.toJSON(), hit: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
          }));
          assert(tools.every(tool => tool.hit && tool.rect.bottom <= height), `Map tools clipped after header layout: ${JSON.stringify(tools)}`);
        }
        // Follow actual nav links, including the formerly obscured connection guide.
        await activate('.sensor-topbar [data-nav="guide"]');
        await page.waitForFunction(() => document.documentElement.dataset.sensorView === 'guide');
        verify(await scanHeader(), width, height);
        await activate('.sensor-topbar [data-nav="map"]');
        await page.waitForFunction(() => document.documentElement.dataset.sensorView === 'map');
        verify(await scanHeader(), width, height);
        if (view === 'login' && [1440,390].includes(width)) {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator('[data-gaia-mode-guide-replay="sensor"]').waitFor();
          await page.waitForTimeout(350);
          assert.equal(await page.locator('#gaia-audio-volume').inputValue(), '1', 'Volume remains saved after reload');
          verify(await scanHeader(), width, height);
        }
      }
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    }
    const requests = (await (await context.request.get(base + '/__qa/report')).json()).requests;
    assert.equal(requests.filter(request => request.method !== 'GET' && request.path.startsWith('/api/')).length, 0, 'Header QA must not mutate sensor/account data');
    console.log(`PASS ${width}x${height}`);
    await context.close();
  }
  if (before) assert(report.checks.some(check => check.overlaps.some(overlap => /センサーガイド/.test(overlap.a + overlap.b))), 'Reported guide/nav overlap must reproduce');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []);
  report.status = before ? 'reproduced' : 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, overlaps: report.checks.filter(check => check.overlaps.length).map(check => ({ width: check.width, view: check.view, overlaps: check.overlaps })) }));
