import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const before = process.argv.includes('--before');
const out = `artifacts/wind-strength-color-20260913/${before ? 'before' : 'after'}`;
fs.mkdirSync(out, { recursive: true });
const report = { status: 'running', scope: 'Local Chrome WebGL2 pixels with controlled wind fixtures, then actual exhibit 02 using saved fallback observations. No live-provider or production claim.', samples: [], screens: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  page = await browser.newPage({ viewport: { width: 720, height: 360 } });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.route('https://**', r => r.abort());
  await page.route('**/wind-color-check', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#091c27"></body></html>' }));
  await page.goto('http://127.0.0.1:4492/wind-color-check');
  await page.evaluate(async () => {
    const { createAtmosphereRenderer } = await import('/src/exploration/atmosphere-webgl.js');
    const canvas = document.body.appendChild(document.createElement('canvas'));
    window.windRenderer = createAtmosphereRenderer(canvas);
    if (!windRenderer) throw Error('WebGL2 unavailable');
  });
  for (const [kind, speed, opposing] of [['wind', 0], ['wind', 2], ['wind', 8], ['wind', 18], ['wind', 35], ['wind', 18, true], ['air', 8], ['cloud', 8]]) {
    await page.evaluate(({ kind, speed, opposing }) => {
      const point = { lon: 0, lat: 0, cloud: 65, radiation: 700, windSpeed: speed, windDirection: 270, pressure: 1000, pm25: 30, aerosol: .5 };
      window.windRenderer.setData(kind, { observedAt: `${kind}-${speed}-${!!opposing}`, sourceState: 'SAVED VALUES', points: opposing ? [point, { ...point, windDirection: 90 }] : [point] });
    }, { kind, speed, opposing });
    await page.waitForFunction(kind => document.querySelector('canvas').dataset.fieldState === 'ready' && (kind !== 'cloud' || document.querySelector('canvas').dataset.cloudTextureState === 'ready'), kind);
    const sample = await page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
      const view = { rect: { width: 720, height: 360 }, originX: 0, originY: 0, scale: 2 };
      const read = (timestamp, reduced) => {
        window.windRenderer.render(timestamp, view, reduced);
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let count = 0, hash = 0, maxAlpha = 0;
        const rgb = [0, 0, 0];
        for (let i = 0; i < pixels.length; i += 4) {
          hash = (Math.imul(hash, 31) + pixels[i + 3]) | 0;
          maxAlpha = Math.max(maxAlpha, pixels[i + 3]);
          if (pixels[i + 3] > 5) { count++; for (let c = 0; c < 3; c++) rgb[c] += pixels[i + c]; }
        }
        return { rgb: rgb.map(v => v / Math.max(1, count)), count, hash, maxAlpha, error: gl.getError() };
      };
      const now = performance.now() + 1200;
      const first = read(now, false), second = read(now + 900, false);
      const still = read(now + 1000, true), stable = read(now + 2000, true);
      return { ...still, moving: first.hash !== second.hash, reducedStable: still.hash === stable.hash };
    });
    report.samples.push({ kind, speed, opposing: !!opposing, ...sample });
    assert.equal(sample.error, 0); assert(sample.count > 40); assert(sample.reducedStable);
    if (kind === 'wind') {
      assert(sample.moving); assert(sample.maxAlpha <= 179, 'Existing opacity cap');
      if (!before && speed <= 2) assert(sample.rgb[2] > sample.rgb[0] + 60, 'Calm wind is cool teal');
      if (!before && speed === 8) assert(sample.rgb[0] > sample.rgb[2] + 80 && sample.rgb[1] > sample.rgb[2] + 60, 'Moderate wind is soft gold');
      if (!before && speed >= 18) assert(sample.rgb[0] > sample.rgb[1] + 80 && sample.rgb[0] > sample.rgb[2] + 100, 'Strong wind is coral, including opposing directions');
    }
    if ([2, 8, 18].includes(speed) && kind === 'wind' && !opposing) await page.screenshot({ path: `${out}/field-${speed}.png` });
  }
  await page.close();
  if (!before) {
    // Baseline evidence is optional for a fresh checkout; palette and GPU tests
    // remain runnable without the locally captured pre-change artifacts.
    const baselinePath = 'artifacts/wind-strength-color-20260913/before/report.json';
    report.nonWindBaselineCompared = fs.existsSync(baselinePath);
    if (report.nonWindBaselineCompared) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      for (const sample of report.samples) {
        const prior = baseline.samples.find(p => p.kind === sample.kind && p.speed === sample.speed && p.opposing === sample.opposing);
        if (sample.kind !== 'wind') assert.deepEqual(sample.rgb, prior.rgb, `${sample.kind} palette is unchanged`);
      }
    }
    for (const width of [1440, 390]) {
      page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', e => report.errors.push(e.message));
      await page.route('https://**', r => r.abort());
      await page.goto('http://127.0.0.1:4492/#world-02');
      await page.waitForFunction(() => document.querySelector('#gaia-planet-atmosphere-canvas')?.dataset.fieldState === 'ready');
      await page.evaluate(() => GaiaModeEntryGuide?.close('map', { restoreFocus: false }));
      const canvas = page.locator('#gaia-planet-atmosphere-canvas');
      await page.waitForTimeout(1800);
      assert(await canvas.isVisible());
      const first = await canvas.screenshot(); await page.waitForTimeout(900);
      assert(!first.equals(await canvas.screenshot()), 'Exhibit wind animates');
      await page.screenshot({ path: `${out}/${width}-world-02.png` });
      const initialContexts = await canvas.count();
      for (const n of [3, 5, 2]) {
        await page.evaluate(n => { location.hash = '#world-0' + n; }, n);
        await page.waitForFunction(n => document.querySelector('#gaia-planet-atmosphere-canvas')?.dataset.atmosphereMode === ({ 2: 'wind', 3: 'air', 5: 'cloud' })[n] && document.querySelector('#gaia-planet-atmosphere-canvas').dataset.fieldState === 'ready', n);
      }
      assert.equal(await canvas.count(), initialContexts, 'Mode changes do not add canvases');
      report.screens.push({ width, windVisible: true, animated: true, modeRoundTrip: [2, 3, 5, 2] });
      await page.close();
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'baseline-captured' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report));
}
