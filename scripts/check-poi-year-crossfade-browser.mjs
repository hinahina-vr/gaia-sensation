import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { readAnnualPart } from './lib/annual-snapshot.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/poi-year-crossfade-2026-09-26');
fs.mkdirSync(output, { recursive: true });
const files = ['src/exploration/poi-year-crossfade.js', 'src/exploration/marine-cod-exhibit.js', 'src/exploration/index.js', 'gaia-mode-loader.js', 'index.html'];
const report = { status: 'running', sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktree: 'uncommitted changes',
  scope: 'Installed headless Chrome; actual local annual files, desktop and emulated mobile. External HTTPS blocked. Injected request failures/latency are simulations. Not physical mobile or production.',
  hashes: Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), checks: [], timings: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
report.browser = browser.version();
let page;
const state = () => page.evaluate(() => GaiaMarineCod.getState());
const ready = () => page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().dataState === 'ready'
  && document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'complete'
  && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
  && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro')
  && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
const settled = () => page.waitForFunction(() => !GaiaMarineCod.getState().yearFade.active);
async function playback() {
  if (page.viewportSize().width < 900) {
    await page.locator('[data-mobile-sheet="tools"]').tap();
    await page.locator('[data-mobile-transport="gaia-map-playback-toggle"]').tap();
  } else await page.locator('#gaia-map-playback-toggle').click();
}
async function slider(year) {
  await page.locator('[data-cod-year]:visible').last().fill(String(year));
  await page.waitForFunction(year => GaiaMarineCod.getState().year === year && GaiaMarineCod.getState().dataState === 'ready', year);
}
async function probe() {
  await page.evaluate(() => {
    if (window.__fadeProbe) __fadeProbe.stop = true;
    const probe = window.__fadeProbe = { stop: false, frames: [] };
    let frame;
    const sample = () => {
      const canvas = document.querySelector('#gaia-marine-cod-canvas'), next = canvas.dataset.codFrame;
      if (frame !== next) {
        const s = GaiaMarineCod.getState();
        probe.frames.push({ at: performance.now(), year: s.year, ...s.yearFade, drawMs: Number(canvas.dataset.codDrawMs), count: s.count }); frame = next;
      }
      if (!probe.stop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
async function collect(label) {
  const frames = await page.evaluate(() => { __fadeProbe.stop = true; return __fadeProbe.frames; });
  const stats = samples => {
    const ms = samples.map(s => s.drawMs).sort((a, b) => a - b);
    const gaps = samples.slice(1).flatMap((s, i) => s.year === samples[i].year ? [s.at - samples[i].at] : []).sort((a, b) => a - b);
    return { samples: ms.length, meanDrawMs: ms.reduce((a, b) => a + b, 0) / ms.length, p95DrawMs: ms[Math.floor(ms.length * .95)],
      medianFrameGapMs: gaps[Math.floor(gaps.length / 2)], p95FrameGapMs: gaps[Math.floor(gaps.length * .95)] };
  };
  report.timings.push({ label, normal: stats(frames.filter(f => !f.active)), fading: stats(frames.filter(f => f.active)), frames });
  return frames;
}
async function checkActualData(year) {
  const actual = await page.evaluate(() => ({ file: GaiaMarineCod.definition.dataFile, points: GaiaMarineCod.getCruisePoints() }));
  const manifest = JSON.parse(fs.readFileSync(`data/${actual.file}`));
  const period = manifest.periods.find(p => p.year === year);
  assert.deepEqual(actual.points, (period.file ? readAnnualPart(period.file) : period).stations, 'Fade must never interpolate or mutate measurements');
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 },
      isMobile: width < 900, hasTouch: width < 900, deviceScaleFactor: width < 900 ? 3 : 1, reducedMotion: 'no-preference' });
    await enforceBrowserSecurity(context, base); await context.route('https://**', r => r.abort());
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/#world-49`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().dataState === 'ready');
    await page.evaluate(() => GaiaMapPlayback.stop()); await ready();
    assert.equal((await state()).year, 2016);
    assert.equal((await state()).yearFade.active, false, 'Entry still uses the existing arrival, not year fade');
    await page.screenshot({ path: path.join(output, `${width}-49-before.png`) });
    await probe(); await page.waitForTimeout(1000);
    await slider(2017);
    await page.waitForFunction(() => { const s = GaiaMarineCod.getState().yearFade; return s.active && s.progress > .2; });
    await page.screenshot({ path: path.join(output, `${width}-49-mid-fade.png`) });
    await settled();
    await page.screenshot({ path: path.join(output, `${width}-49-after.png`) });
    for (const year of [2018, 2019, 2020]) { await slider(year); await settled(); }
    await page.waitForTimeout(600);
    const frames = await collect(`${width}/49`);
    const fading = frames.filter(f => f.active && f.progress > 0 && f.progress < 1);
    assert(fading.length >= 8 && new Set(fading.map(f => f.progress)).size >= 3, 'Multiple actual intermediate draw frames');
    assert(fading.every(f => f.snapshotPixels > 0 && f.snapshotPixels < 1605000), 'Only one resolution-capped snapshot');
    assert.equal((await state()).yearFade.snapshotPixels, 0);
    await checkActualData(2020);
    report.checks.push(`${width}/49: real slider fades through intermediate frames, releases raster and preserves exact annual records`);

    // Actual shared play button must advance and continue playing through fade.
    await playback();
    await page.waitForFunction(() => GaiaMarineCod.getState().year === 2021 && GaiaMarineCod.getState().yearFade.active, null, { timeout: 12000 });
    assert.equal((await state()).playing, true); await settled();
    await playback();
    report.checks.push(`${width}/49: autoplay continues through annual crossfade`);

    // Several overlapping annual fetches may finish out of order.
    await page.route('**/annual/japan-air-ox/1989.json.gz?*', async r => { await new Promise(resolve => setTimeout(resolve, 350)); await r.continue(); });
    await page.evaluate(async () => { await Promise.all([GaiaMarineCod.setYear(1989), GaiaMarineCod.setYear(1990), GaiaMarineCod.setYear(1991)]); });
    await settled(); assert.equal((await state()).year, 1991); await checkActualData(1991);
    await page.route('**/annual/japan-air-ox/2001.json.gz?*', r => r.abort());
    await page.evaluate(() => GaiaMarineCod.setYear(2001));
    assert.equal((await state()).year, 1991); assert.equal((await state()).yearFade.snapshotPixels, 0);
    await page.unroute('**/annual/japan-air-ox/2001.json.gz?*');
    await slider(2001); await settled();
    report.checks.push(`${width}/49: latest request wins; failed load retains old year and retry fades normally`);

    await page.evaluate(() => GaiaMarineCod.setYear(2002));
    await page.waitForFunction(() => GaiaMarineCod.getState().yearFade.active);
    // Real viewport resize invalidates raster coordinates, not the new data.
    await page.setViewportSize({ width: width - 10, height: width < 900 ? 844 : 900 });
    await settled(); assert.equal((await state()).yearFade.snapshotPixels, 0);
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    await page.waitForTimeout(200);
    await page.evaluate(() => GaiaMarineCod.setYear(2003));
    await page.waitForFunction(() => GaiaMarineCod.getState().yearFade.active);
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: 136, lat: 35, zoom: 5, durationMs: 300, label: 'crossfade-qa-pan' }));
    await settled(); assert.equal((await state()).yearFade.snapshotPixels, 0);
    report.checks.push(`${width}/49: viewport change and camera movement cancel old-position raster`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await slider(2004); assert.equal((await state()).yearFade.active, false);
    await page.waitForTimeout(100);
    await page.evaluate(() => GaiaMarineCod.setYear(2004)); assert.equal((await state()).yearFade.active, false);
    report.checks.push(`${width}/49: reduced motion and same-year request do not fade`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    for (const number of (width === 1440 ? [31, 65, 69] : [65])) {
      await page.evaluate(number => GaiaMapCategories.buttons()[number - 1].click(), number);
      await page.waitForFunction(number => Number(GaiaMarineCod.definition.number) === number && GaiaMarineCod.getState().dataState === 'ready', number);
      await page.evaluate(() => GaiaMapPlayback.stop()); await ready();
      const initial = (await state()).year;
      assert.equal((await state()).yearFade.active, false, 'No previous exhibit raster during arrival');
      await probe(); await page.waitForTimeout(800);
      for (const year of [initial + 1, initial + 2, initial + 1]) { await slider(year); await settled(); }
      await page.waitForTimeout(500); const samples = await collect(`${width}/${number}`);
      assert(samples.filter(f => f.active && f.progress > 0).length >= 4);
      await checkActualData(initial + 1);
      await page.screenshot({ path: path.join(output, `${width}-${number}-complete.png`) });
      report.checks.push(`${width}/${number}: year fade, unchanged arrival, exact records; ${samples.at(-1).count} points`);
    }
    await page.evaluate(() => GaiaMarineCod.setYear(GaiaMarineCod.getState().year + 1));
    await page.waitForFunction(() => GaiaMarineCod.getState().yearFade.active);
    await page.evaluate(() => GaiaMapCategories.buttons()[48].click());
    assert.equal((await state()).yearFade.snapshotPixels, 0, 'Changing exhibition immediately releases outgoing raster');
    await ready();
    await page.evaluate(() => GaiaMarineCod.setYear(2017));
    await page.waitForFunction(() => GaiaMarineCod.getState().yearFade.active);
    await page.evaluate(() => { location.hash = ''; });
    await page.waitForFunction(() => GaiaMarineCod.getState().yearFade.snapshotPixels === 0);
    report.checks.push(`${width}: switching exhibit and leaving map release snapshot`);
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
  }
  // Pixel-level compositing: opaque red + blue must make opaque purple,
  // including co-located points; application performance probes above do not read pixels.
  const context = await browser.newContext(); page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const pixels = await page.evaluate(async () => {
    const { createPoiYearCrossfade } = await import('./src/exploration/poi-year-crossfade.js?v=annual-crossfade-20260926');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d'), fade = createPoiYearCrossfade();
    const fill = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); };
    fill('red'); fade.capture(canvas, 'view'); fill('blue'); fade.paint(ctx, 'view', 100);
    const first = [...ctx.getImageData(0, 0, 1, 1).data];
    fill('blue'); fade.paint(ctx, 'view', 300); const middle = [...ctx.getImageData(0, 0, 1, 1).data];
    fade.capture(canvas, 'view'); fill('green'); fade.paint(ctx, 'view', 350);
    const restart = [...ctx.getImageData(0, 0, 1, 1).data];
    fill('green'); fade.paint(ctx, 'view', 750); const last = [...ctx.getImageData(0, 0, 1, 1).data];
    return { first, middle, restart, last, state: fade.getState() };
  });
  assert.deepEqual(pixels.first, [255, 0, 0, 255]);
  assert(pixels.middle[0] >= 127 && pixels.middle[2] >= 127 && pixels.middle[3] === 255);
  assert.deepEqual(pixels.restart, pixels.middle, 'Rapid restart begins at the displayed pixels, with no flash');
  assert.deepEqual(pixels.last, [0, 128, 0, 255]); assert.equal(pixels.state.snapshotPixels, 0);
  report.pixels = pixels; report.checks.push('Chrome raster pixels: whole-layer blend has no alpha dip; rapid restart is continuous');
  await context.close(); assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
console.log(JSON.stringify({ status: report.status, checks: report.checks, timings: report.timings.map(({ frames, ...summary }) => summary) }, null, 2));
