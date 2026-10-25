import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const stage = process.env.GAIA_FLICKER_STAGE || 'after';
const output = path.resolve(`artifacts/fire-flicker-20261021/${stage}`);
fs.mkdirSync(output, { recursive: true });
const source = JSON.parse(fs.readFileSync('data/firms-active-fire-snapshot.json', 'utf8'));
const points = [[123, 0, 100], [153, 0, 80], [138, 27, 60]].map(([lon, lat, frp], index) => ({
  ...source.points[index], id: `flicker-${index}`, lon, lat, frp, confidence: 96, daynight: 'D',
}));
const fixture = { ...source, points, summary: { ...source.summary, displayed: 3, detected: 3, maxFrp: 100 } };
const report = { baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  stage, environment: 'Local Chrome; synthetic FIRMS fixture; mobile emulation; no external network.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height, reduced] of [[1920, 1080, false], [390, 844, false], [390, 844, true]]) {
    if (process.env.GAIA_FLICKER_WIDTH && width !== Number(process.env.GAIA_FLICKER_WIDTH)) continue;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 720,
      reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**/*', route => route.abort());
    await context.route('**/firms-active-fire-snapshot.json', route => route.fulfill({ json: fixture }));
    await context.addInitScript(() => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      sessionStorage.setItem('gaia:mode-entry-guide:map:v3', 'seen');
      const original = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        original.apply(this, args);
        if (!globalThis.__firePixelRequest || this.canvas.id !== 'gaia-firms-canvas' || args[0] !== this.POINTS) return;
        const program = this.getParameter(this.CURRENT_PROGRAM);
        if (this.getUniformLocation(program, 'u_progress') === null) return;
        const rect = this.canvas.getBoundingClientRect(), ratio = this.canvas.width / rect.width;
        const samples = globalThis.__firePixelRequest.map(point => {
          const size = Math.round(36 * ratio), pixels = new Uint8Array(size * size * 4);
          this.readPixels(Math.round((point.x - rect.left - 18) * ratio),
            Math.round(this.canvas.height - (point.y - rect.top + 18) * ratio), size, size,
            this.RGBA, this.UNSIGNED_BYTE, pixels);
          let energy = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 30 && pixels[i] > pixels[i + 2] * 1.4) energy += pixels[i];
          return energy;
        });
        globalThis.__firePixelResult = { samples, glError: this.getError() };
        globalThis.__firePixelRequest = null;
      };
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/world.html#world-04`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaFirmsExhibit?.getState().active
      && Number(document.querySelector('#gaia-firms-canvas')?.dataset.firmsFrame) > 2);
    await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
      && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro')
      && Number(document.querySelector('#gaia-firms-canvas').dataset.firmsIntroQuiet) === 0);
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: 138, lat: 0, zoom: 1, durationMs: 0 }));
    await page.waitForTimeout(1000);
    const locations = await page.evaluate(points => {
      const r = document.querySelector('#japan-map').getBoundingClientRect(), d = document.querySelector('#japan-overlay').dataset;
      const scale = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * Number(d.earthZoom || 1);
      return points.map(p => ({ x: r.left + (r.width - scale * 360) / 2 + Number(d.earthOffsetX || 0) + ((p.lon - 150 + 540) % 360) * scale,
        y: r.top + (r.height - scale * 180) / 2 + Number(d.earthOffsetY || 0) + (90 - p.lat) * scale }));
    }, points);
    const capture = async () => {
      await page.evaluate(locations => { globalThis.__firePixelResult = null; globalThis.__firePixelRequest = locations; }, locations);
      await page.waitForFunction(() => globalThis.__firePixelResult);
      const result = await page.evaluate(() => globalThis.__firePixelResult);
      assert.equal(result.glError, 0);
      assert(result.samples.every(n => n > 0), `Every probe must contain an actual rendered fire: ${JSON.stringify({ result, locations })}`);
      return result.samples;
    };
    const temporal = [];
    for (let i = 0; i < 24; i++) {
      // All points are fully revealed during this holding interval. Only
      // decorative motion changes, not the observation time or visibility.
      await page.evaluate(seconds => GaiaFirmsExhibit.seekCruise(seconds / 36.9), 26.1 + i * .1);
      temporal.push(await capture());
    }
    const variation = points.map((_, i) => {
      const values = temporal.map(row => row[i]);
      return (Math.max(...values) - Math.min(...values)) / Math.max(...values);
    });
    await page.mouse.move(1, height - 1);
    const beforeHover = await capture();
    await page.screenshot({ path: path.join(output, `${width}-${reduced ? 'reduced' : 'normal'}-quiet.png`) });
    if (width >= 720) {
      await page.mouse.move(locations[0].x, locations[0].y);
      await page.waitForFunction(() => document.querySelector('#gaia-firms-canvas').dataset.firmsPoiFocusState === 'hovered');
    }
    const hover = await capture();
    const hoverChange = width >= 720 ? Math.abs(hover[1] - beforeHover[1]) / beforeHover[1] : null;
    await page.screenshot({ path: path.join(output, `${width}-${reduced ? 'reduced' : 'normal'}-hover.png`) });
    for (let i = 0; width >= 720 && i < 4; i++) {
      await page.mouse.move(1, height - 1);
      await page.mouse.move(locations[0].x, locations[0].y);
    }
    if (width < 720) await page.touchscreen.tap(locations[0].x, locations[0].y);
    else await page.mouse.click(locations[0].x, locations[0].y);
    await page.locator('#japan-poi-card').waitFor({ state: 'visible' });
    assert.match(await page.locator('#japan-poi-meta').textContent(), /100\.0 MW/);
    await page.waitForFunction(() => document.querySelector('#gaia-firms-canvas').dataset.firmsSelectedPoint === '0');
    const selected = await capture();
    await page.screenshot({ path: path.join(output, `${width}-${reduced ? 'reduced' : 'normal'}-selected.png`) });
    await page.locator('#japan-poi-close').click();
    await page.mouse.move(1, height - 1);
    let ignitionHover = null;
    if (stage !== 'before' && width >= 720 && !reduced) {
      await page.evaluate(() => GaiaFirmsExhibit.seekCruise(2 / 36.9));
      await page.waitForFunction(() => Number(document.querySelector('#gaia-firms-canvas').dataset.firmsActiveColumns) > 0);
      const before = Number(await page.locator('#gaia-firms-canvas').getAttribute('data-firms-active-columns'));
      await page.mouse.move(locations[0].x, locations[0].y);
      await page.waitForFunction(() => document.querySelector('#gaia-firms-canvas').dataset.firmsPoiFocusState === 'hovered');
      await page.waitForTimeout(150);
      const after = Number(await page.locator('#gaia-firms-canvas').getAttribute('data-firms-active-columns'));
      assert.equal(after, before, 'Hover must not abruptly remove all active ignition columns');
      ignitionHover = { before, after };
      await page.mouse.move(1, height - 1);
    }
    await page.evaluate(() => { GaiaFirmsExhibit.seekCruise(.4); GaiaFirmsExhibit.setPlayback(true); });
    const progress = await page.locator('#gaia-firms-canvas').getAttribute('data-firms-playback-progress');
    await page.waitForFunction(old => document.querySelector('#gaia-firms-canvas').dataset.firmsPlaybackProgress !== old, progress);
    await page.evaluate(() => GaiaFirmsExhibit.deactivate());
    const frame = await page.locator('#gaia-firms-canvas').getAttribute('data-firms-frame');
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#gaia-firms-canvas').getAttribute('data-firms-frame'), frame);
    const item = { width, height, reduced, variation, hoverChange, ignitionHover, temporal, beforeHover, hover, selected };
    report.checks.push(item);
    console.log(JSON.stringify({ width, reduced, variation, hoverChange }));
    if (stage !== 'before') {
      assert(variation.every(n => n < .01), `Settled fire luminance must remain stable: ${variation}`);
      assert(hoverChange < .01, `Hover must not dim unrelated observations: ${hoverChange}`);
      assert(Math.abs(selected[1] - beforeHover[1]) / beforeHover[1] < .01, 'Selection must not flash the rest of the map');
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.map(({ width, reduced, variation, hoverChange }) => ({ width, reduced, variation, hoverChange })), errors: report.errors, failure: report.failure, output }));
}
