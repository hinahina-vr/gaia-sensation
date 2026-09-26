import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const before = process.argv.includes('--before-fixed-height');
const languagesOnly = process.argv.includes('--languages');
const output = path.resolve(`artifacts/wind-data-intro-2026-09-26/${before ? 'fixed-height-before' : languagesOnly ? 'concise-copy-languages' : 'concise-copy'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['app.js', 'map-ui-grid-polish.css', 'index.html', 'gaia-mode-loader.js', 'locales/ui-entry.bundle.js', 'src/exploration/map-data-intro-catalog.js'];
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', environment: 'Installed Chrome; local CSP; emulated desktop/mobile. Mock weather responses and blocked APIs; not production or physical devices.',
  hashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const cases = before ? [[390,844,true,false]] : languagesOnly
    ? [[320,568,true,false,'en'], [390,844,true,false,'zh-CN']]
    : [[1440,900,false,false], [390,844,true,false], [844,390,false,false], [320,568,true,true]];
  for (const [width, height, sample, reduced, language = 'ja'] of cases) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.addInitScript(language => localStorage.setItem('gaia:language:v1', language), language);
    await context.route('https://**', route => route.abort());
    if (sample) await context.route('https://api.open-meteo.com/**', async route => {
      if (width === 390) await new Promise(resolve => setTimeout(resolve, 4500));
      return route.fulfill({ status: 503, body: 'Fixture: weather unavailable' });
    });
    if (!sample) await context.route('https://api.open-meteo.com/**', route => {
      const count = new URL(route.request().url()).searchParams.get('latitude').split(',').length;
      const rows = Array.from({ length: count }, () => ({ current: { time: new Date().toISOString().slice(0,16), wind_speed_10m: 5.9, wind_direction_10m: 85, surface_pressure: 987, cloud_cover: 63, shortwave_radiation: 200 } }));
      return route.fulfill({ json: count === 1 ? rows[0] : rows });
    });
    await context.addInitScript(() => {
      window.__introFrames = [];
      const capture = () => {
        const intro = document.querySelector('#map-data-intro');
        const layer = document.querySelector('#japan-layer');
        const separator = document.querySelector('#map-title-transition');
        const band = separator && getComputedStyle(separator, '::before');
        if (intro && layer) window.__introFrames.push({ time: performance.now(), visible: !intro.hidden,
          opacity: Number(getComputedStyle(intro).opacity), title: layer.classList.contains('is-map-title-transitioning'),
          bandOpacity: Number(band.opacity) * Number(getComputedStyle(separator).opacity),
          bandTransform: band.transform, bandVisibility: getComputedStyle(separator).visibility,
          bandHeight: parseFloat(band.height),
          frame: Number(document.querySelector('#gaia-planet-signals-canvas')?.dataset.planetFrame || 0) });
        if (performance.now() < 30000) requestAnimationFrame(capture);
      };
      requestAnimationFrame(capture);
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#world-01`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
    await page.waitForFunction(() => {
      const intro = document.querySelector('#map-data-intro');
      return intro && !intro.hidden && Number(getComputedStyle(intro).opacity) > .98;
    });
    await page.waitForFunction(() => Boolean(globalThis.GaiaPlanetSignals?.getState?.().sourceState));
    const scan = await page.locator('#map-data-intro').evaluate(node => ({
      text: node.textContent, pointerEvents: getComputedStyle(node).pointerEvents,
      boxes: [...node.querySelectorAll('p,small')].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect().toJSON()),
      overflow: document.documentElement.scrollWidth - innerWidth,
      titleRunning: document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),
      source: globalThis.GaiaPlanetSignals.getState().sourceState,
      playbackPaused: globalThis.GaiaMapPlayback.getState().paused,
      bandHeight: parseFloat(getComputedStyle(document.querySelector('#map-title-transition'), '::before').height),
      bandCenter: (() => { const r = document.querySelector('#map-title-transition').getBoundingClientRect(); return r.y + r.height / 2; })(),
    }));
    assert.equal(scan.pointerEvents, 'none');
    assert.equal(scan.titleRunning, false);
    assert.equal(scan.playbackPaused, false);
    assert.equal(scan.overflow, 0);
    assert.match(scan.text, /地上10m|10 metres|10米/);
    assert.match(scan.text, /気象予測モデルのデータをもとに|weather prediction models|气象预测模型/);
    assert.equal(scan.source, sample ? 'SAVED VALUES' : 'LIVE');
    if (sample) assert.match(scan.text, /演出用の参考値を表示しています|Showing illustrative sample values|当前显示演示参考值/);
    assert.doesNotMatch(scan.text, /ではありません|\bnot\b|并非/);
    for (const box of scan.boxes) assert(box.x >= 0 && box.right <= width + 1 && box.y >= 0 && box.bottom <= height + 1, `${width}: copy must fit viewport`);
    const heights = await page.evaluate(() => window.__introFrames.filter(f => f.title || f.visible).map(f => f.bandHeight));
    const heightRange = Math.max(...heights) - Math.min(...heights);
    if (before) assert(heightRange > 10, 'Reproduce the band growing between title and explanation');
    else {
      assert(heightRange < .1, `${width}: band height changed by ${heightRange}px`);
      for (const box of scan.boxes) assert(box.y >= scan.bandCenter - scan.bandHeight / 2 - 1 && box.bottom <= scan.bandCenter + scan.bandHeight / 2 + 1,
        `${width}: text must fit the original band height (${scan.bandHeight}px): ${JSON.stringify(box)}`);
    }
    if (width === 320) assert(scan.boxes.every(box => box.x >= 60), 'Narrow copy must clear the left zoom rail');
    await page.screenshot({ path: path.join(output, `${width}-intro.png`) });
    if (width === 1440) {
      await page.locator('#map-data-intro').waitFor({ state: 'hidden' });
      const frames = await page.evaluate(() => window.__introFrames);
      assert(frames.some(f => f.title && !f.visible), 'Title must precede data intro');
      assert(!frames.some(f => f.title && f.visible), 'Title and data intro must not overlap');
      const shown = frames.filter(f => f.visible);
      const firstIntro = frames.findIndex(f => f.visible);
      const boundary = frames.slice(Math.max(0, firstIntro - 24), firstIntro + 40);
      assert(boundary.length > 30);
      for (const frame of boundary) {
        assert.equal(frame.bandVisibility, 'visible', 'Same title band must remain visible across handoff');
        assert(frame.bandOpacity >= .99, 'Band must not fade out and reappear between title and explanation');
        const matrix = frame.bandTransform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number);
        assert(matrix && Math.abs(matrix[0] - 1) < .001 && Math.abs(matrix[4]) < .001, 'Band must not slide away across handoff');
      }
      fs.writeFileSync(path.join(output, 'handoff-frames.json'), JSON.stringify(boundary, null, 2));
      assert(shown.some(f => f.opacity > .05 && f.opacity < .9), 'Actual fade-in/out frames');
      assert(shown.at(-1).frame > shown[0].frame, 'Map continues rendering during the explanation');
      assert(shown.at(-1).time - shown[0].time >= 6500, 'Reading hold must remain long enough');
      // Reselect via actual menu to exercise repeat entry and pointer-through.
      const select = async number => {
        await page.locator('[data-map-menu-toggle]').click();
        await page.locator('.map-mode-bank .map-mode-button').filter({ hasText: new RegExp(`^${number}$`) }).click();
      };
      await select('02');
      await page.waitForTimeout(3400);
      assert.equal(await page.locator('#map-data-intro').getAttribute('data-exhibit-number'), '02', 'Earthquake introduction must replace wind copy');
      assert(!/地上10m/.test(await page.locator('#map-data-intro').textContent()));
      await select('01');
      await page.waitForFunction(() => !document.querySelector('#map-data-intro').hidden);
      await page.locator('.gaia-map-action--source:visible').click();
      await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
      assert(await page.locator('#map-data-intro').isHidden(), 'Input dismisses without swallowing the click');
      await page.locator('#japan-data-close').click();
      // Cancellation before the title ends must not leak wind copy into 02.
      await select('02');
      await select('01');
      await select('02');
      await page.waitForTimeout(3600);
      assert.equal(await page.locator('#map-data-intro').getAttribute('data-exhibit-number'), '02', 'Rapid switching must not leak wind copy');
      report.checks.push({ label: 'sequence, repeat, source action, rapid switching', frames: shown.length });
    } else {
      await page.locator('[data-mobile-sheet="tools"]').tap();
      await page.locator('#map-mobile-sheet').waitFor({ state: 'visible' });
      assert(await page.locator('#map-data-intro').isHidden());
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ width, height, sample, reduced, language, heightRange, ...scan });
    console.log(`PASS ${width}x${height}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length }));
