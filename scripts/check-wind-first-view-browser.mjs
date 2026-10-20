import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const stage = process.env.GAIA_WIND_STAGE || 'after';
const output = path.resolve(`artifacts/wind-first-view-20261020/${stage}`);
fs.mkdirSync(output, { recursive: true });
const report = {
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: 'uncommitted changes', stage,
  environment: 'Local Chrome. Emulated touch; deterministic synthetic Open-Meteo responses, not live observations. Animation phases can differ between captures.',
  checks: [], errors: [],
};
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
});
let page;
try {
  const sizes = [[1920,1080], [390,844], ...(stage === 'before' ? [] : [[320,568,'reduce'], [1440,900,'fallback']])];
  for (const [width, height, variant] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900,
      isMobile: width < 900, reducedMotion: variant === 'reduce' ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('gaia-senseware-bgm-muted', 'true'));
    if (variant === 'fallback') await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === 'webgl2' && this.classList.contains('gaia-planet-atmosphere-canvas')) return null;
        return original.call(this, type, ...args);
      };
    });
    await context.route('https://**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname.includes('open-meteo.com')) {
        const latitudes = (url.searchParams.get('latitude') || '0').split(',').map(Number);
        const longitudes = (url.searchParams.get('longitude') || '0').split(',').map(Number);
        return route.fulfill({ json: latitudes.map((lat, i) => ({ current: {
          time: '2026-10-20T03:00',
          wind_speed_10m: +(3 + 11 * Math.abs(Math.sin(lat * Math.PI / 90)) + 2 * Math.cos(longitudes[i] * Math.PI / 180)).toFixed(1),
          wind_direction_10m: (270 + lat * 1.1 + 360) % 360,
          surface_pressure: 1012, cloud_cover: 42, shortwave_radiation: 320,
          pm2_5: 12, aerosol_optical_depth: .15,
        } })) });
      }
      if (url.hostname === 'earthquake.usgs.gov') return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
      return route.abort();
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ width, message: error.message }));
    await page.goto(`${process.env.GAIA_BASE_URL}/world#world`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    await page.waitForFunction(fallback => fallback
      ? Number(document.querySelector('#gaia-planet-signals-canvas')?.dataset.planetFrame) > 2
      : document.querySelector('.gaia-planet-atmosphere-canvas')?.dataset.fieldState === 'ready', variant === 'fallback');
    await page.evaluate(() => document.fonts.ready);
    const drawsBehindGuide = await page.locator('#gaia-planet-signals-canvas').getAttribute('data-planet-frame');
    await page.locator('[data-feature-start]')[width < 900 ? 'tap' : 'click']();
    await page.waitForFunction(() => document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    await page.waitForTimeout(1200);
    const band = await page.locator('.map-title-transition').evaluate(node => getComputedStyle(node, '::before').height);
    await page.screenshot({ path: path.join(output, `${width}-title.png`) });
    await page.waitForFunction(() => document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('.map-title-transition').evaluate(node => getComputedStyle(node, '::before').height), band);
    await page.screenshot({ path: path.join(output, `${width}-explanation.png`) });
    await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `${width}-overview.png`) });
    const target = await page.evaluate(() => {
      const rect = document.querySelector('#japan-map').getBoundingClientRect();
      const overlay = document.querySelector('#japan-overlay');
      const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180))
        * Number(overlay.dataset.earthZoom || 1);
      const originX = (rect.width - 360 * scale) / 2 + Number(overlay.dataset.earthOffsetX || 0);
      const originY = (rect.height - 180 * scale) / 2 + Number(overlay.dataset.earthOffsetY || 0);
      return GaiaPlanetSignals.getCruisePoints().map((p, index) => ({
        ...p, index,
        x: rect.left + originX + ((p.lon - 150 + 540) % 360) * scale,
        y: rect.top + originY + (90 - p.lat) * scale,
      })).filter(p => p.x > innerWidth * .25 && p.x < innerWidth * .6 && p.y > innerHeight * .3 && p.y < innerHeight * .6)
        .sort((a,b) => Math.abs(a.y - innerHeight * .45) - Math.abs(b.y - innerHeight * .45))[0];
    });
    assert(target, 'A real rendered sample is available to tap');
    if (width < 900) await page.touchscreen.tap(target.x, target.y);
    else await page.mouse.click(target.x, target.y);
    await page.waitForFunction(index => GaiaMapObservationAdapter.getPoiInteraction().selected?.index === index, target.index);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, `${width}-selected.png`) });
    const state = await page.evaluate(() => ({
      canvas: { ...document.querySelector('#gaia-planet-signals-canvas').dataset },
      atmosphere: { ...document.querySelector('.gaia-planet-atmosphere-canvas').dataset },
      card: document.querySelector('#japan-poi-card').innerText,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    }));
    assert.equal(state.horizontalOverflow, 0);
    assert.equal(state.canvas.planetPoiFocusState, 'selected');
    assert(Number(state.canvas.planetFrame) > Number(drawsBehindGuide), 'Wind continues across the entrance');
    if (stage !== 'before') {
      assert.equal(state.canvas.planetWindCue, 'direction');
      assert(Math.abs(Number(state.canvas.planetWindFrom) - target.windDirection) < 1e-9);
      assert(state.card.includes('から') || state.card.includes('from'), 'Wind direction explains the origin');
      const arrow = page.locator('#japan-poi-card .japan-poi-wind-direction');
      await arrow.waitFor({ state: 'visible' });
      const bearing = await arrow.evaluate(node => Number.parseFloat(node.style.getPropertyValue('--wind-to')));
      assert(Math.abs(bearing - target.windDirection - 180) < 1e-9, 'Card arrow uses TO, text uses FROM');
      if (width === 1920) {
        for (const language of ['en','zh-CN','ja']) {
          await page.evaluate(language => GaiaI18n.set(language), language);
          await page.waitForTimeout(150);
          const label = await page.locator('#japan-poi-card .japan-poi-metric-label').allTextContents();
          assert(label.some(text => text.includes(language === 'en' ? 'from W' : language === 'zh-CN' ? '来自西' : '西から')));
        }
      }
      await page.locator('#japan-poi-close').click();
      await page.mouse.move(width - 1, height - 1);
      await page.waitForFunction(() => document.querySelector('#gaia-planet-signals-canvas').dataset.planetWindCue === 'none');
      if (variant !== 'fallback') {
        const resolution = await page.locator('.gaia-planet-atmosphere-canvas').evaluate(node => node.width * node.height);
        assert(resolution <= (width < 720 ? 300000 : 760000) + 2000, 'Existing GPU pixel cap is unchanged');
        if (variant === 'reduce') {
          await page.waitForTimeout(1000);
          const draws = await page.locator('.gaia-planet-atmosphere-canvas').getAttribute('data-draws');
          await page.waitForTimeout(500);
          assert.equal(await page.locator('.gaia-planet-atmosphere-canvas').getAttribute('data-draws'), draws, 'Reduced motion stops identical GPU work after focus fades');
        }
        // Wind-specific presentation must not leak into the shared air/cloud modes.
        for (const mode of ['air','cloud']) {
          await page.evaluate(mode => GaiaPlanetSignals.select(GaiaPlanetSignals.definitions.findIndex(item => item.renderer === mode)), mode);
          await page.waitForFunction(mode => {
            const node = document.querySelector('.gaia-planet-atmosphere-canvas');
            return node.dataset.atmosphereMode === mode && node.dataset.fieldState === 'ready' && !node.hidden;
          }, mode);
          assert.equal(await page.locator('#gaia-planet-signals-canvas').getAttribute('data-planet-wind-cue'), 'none');
          assert.equal(await page.locator('#japan-poi-card').isVisible(), false);
        }
        if (width === 1920) {
          await page.evaluate(() => GaiaPlanetSignals.select(0));
          await page.locator('[data-gaia-mode-guide-replay="map"]').click();
          await page.locator('[data-feature-guide]').click();
          await page.waitForFunction(() => GaiaModeEntryGuide.getState().phase === 'guide');
          let steps = 0;
          while (await page.evaluate(() => GaiaModeEntryGuide.getState().active)) {
            assert(steps++ < 12, 'Guide finishes in a bounded number of steps');
            await page.locator('.gaia-mode-entry-guide-card[data-positioned]').waitFor({ state: 'visible' });
            await page.locator('[data-mode-guide-next]').click();
            await page.waitForTimeout(350);
          }
          assert(steps >= 5, 'The full operation guide was traversed');
          const frames = await page.locator('#gaia-planet-signals-canvas').getAttribute('data-planet-frame');
          await page.waitForTimeout(700);
          assert(Number(await page.locator('#gaia-planet-signals-canvas').getAttribute('data-planet-frame')) > Number(frames), 'Wind continues after the full guide');
          state.guideSteps = steps;
        }
      } else assert.equal(state.canvas.planetEngine, 'canvas2d-particle-field');
    }
    report.checks.push({ width, height, variant: variant || 'normal', band, target, ...state });
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
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, failure: report.failure, output }));
}
