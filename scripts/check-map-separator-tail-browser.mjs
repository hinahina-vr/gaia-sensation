import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_TAIL_OUTPUT || `artifacts/map-separator-tail-2026-09-09/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['app.js', 'map-ui-grid-polish.css', 'gaia-mode-loader.js', 'index.html'];
const report = { status: 'running', before, base, testedAt: new Date().toISOString(),
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  environment: 'Installed Chrome, real-time frame sampling with desktop/mobile emulation; provider data uses fixtures.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of [1440, 390]) for (const reduced of [false, true]) {
    const label = `${width}-${reduced ? 'reduced' : 'motion'}`;
    const duration = (reduced ? 2460 : 3500) - (before ? 0 : 500);
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600,
      reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.addInitScript(() => {
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
    });
    await context.route('https://services.swpc.noaa.gov/**', route => route.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    await context.route('**/api/live/v1/firms', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    await context.route('https://earthquake.usgs.gov/**', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
    await context.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { time: new Date().toISOString(), wind_speed_10m: 5, wind_direction_10m: 80, surface_pressure: 1005, cloud_cover: 58, shortwave_radiation: 194 } } }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ label, message: error.message }));
    await page.goto(`${base}/?exhibit=14&live=1#world`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMapCategories && document.documentElement.dataset.gaiaAppReady === 'true');
    await page.evaluate(() => { GaiaMapDemo.stop(); GaiaModeEntryGuide?.close?.('map', { restoreFocus: false }); GaiaMapCategories.buttons().find(button => Number(button.textContent) === 14).click(); });
    await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && document.querySelector('#gaia-mode-entry-guide').hidden);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      window.__tailFrames = [];
      const sample = () => {
        const layer = document.querySelector('#map-title-transition');
        const data = document.querySelector('#japan-overlay').dataset;
        const running = document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning');
        if (layer.querySelector('#map-title-transition-text').textContent === '街を通る風' && (running || __tailFrames.length)) {
          const root = getComputedStyle(layer), band = getComputedStyle(layer, '::before');
          const animation = layer.getAnimations().find(item => item.animationName === 'map-title-separator-crossfade' || item.animationName === 'map-title-separator-still');
          __tailFrames.push({ elapsed: performance.now() - Number(data.titleSeparatorStartedAt), duration: Number(data.titleSeparatorEndsAt) - Number(data.titleSeparatorStartedAt),
            running, root: Number(root.opacity), bandOpacity: Number(band.opacity), bandX: new DOMMatrix(band.transform).e,
            bandScale: new DOMMatrix(band.transform).a, width: layer.clientWidth, animationTime: animation?.currentTime,
            copy: Number(getComputedStyle(layer.querySelector('.map-title-transition-copy')).opacity),
            text: Number(getComputedStyle(layer.querySelector('#map-title-transition-text')).opacity),
            subtitle: Number(getComputedStyle(layer.querySelector('#map-title-transition-subtitle')).opacity),
            plotProgress: Number(data.plotRevealProgress), state: data.titleSeparatorState });
          if (!running) return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    // The visible heading arrow uses the same control as a user's next-exhibit click.
    await page.locator('[data-map-heading-step="1"]').click();
    await page.waitForFunction(() => __tailFrames.at(-1)?.elapsed >= 1100);
    await page.screenshot({ path: path.join(output, `${label}-hold.png`) });
    await page.waitForFunction(() => __tailFrames.at(-1)?.running === false, null, { timeout: 10000 });
    const trace = await page.evaluate(() => __tailFrames);
    const readable = trace.find(frame => frame.root > .99 && frame.text > .99 && frame.subtitle > .99);
    const fade = trace.find(frame => frame.elapsed > 1000 && frame.running && frame.copy < .99);
    const departure = trace.find(frame => frame.running && frame.bandX > 1);
    const clear = trace.find(frame => frame.running && frame.bandX >= frame.width);
    const last = trace.findLast(frame => frame.running);
    const completion = trace.at(-1);
    const result = { label, duration, readable, fade, departure, clear, last, completion, trace };
    report.checks.push(result);
    assert(Math.abs(trace[0].duration - duration) < 1);
    assert(readable && readable.elapsed < (reduced ? 350 : 1150), 'Entrance became slower');
    assert(completion.elapsed >= duration && completion.elapsed < duration + 350, 'Lifecycle completed early or stalled');
    assert.equal(completion.state, 'complete');
    if (!before) {
      assert(last.root < .03, 'Cleanup cut off a visible fade');
      if (!reduced) {
        assert(Math.abs(fade.elapsed - 2200) < 150);
        assert(clear && clear.elapsed < duration - 90, 'Band did not clear before the final afterglow');
        assert(clear.elapsed - departure.elapsed > 300, 'Band departure is too abrupt');
        assert(trace.filter(frame => frame.running && frame.elapsed > 1000 && frame.root < .9).every(frame => frame.bandX >= frame.width), 'Backdrop faded while the band was still crossing');
        assert(trace.filter(frame => frame.running).every(frame => frame.plotProgress === 0), 'Plots appeared before the separator finished');
      }
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    console.log(`${before ? 'BASELINE' : 'PASS'} ${label}: ${duration}ms; last root=${last.root.toFixed(4)}, last band=${(last.bandX / last.width).toFixed(3)}; clear=${clear?.elapsed.toFixed(1) || 'none'}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'baseline-recorded' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
