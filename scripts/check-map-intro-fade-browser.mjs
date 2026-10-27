import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const lifecycle = process.argv.includes('--lifecycle');
const matrix = lifecycle || process.argv.includes('--matrix');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/map-intro-fade-20261022/${before ? 'before' : lifecycle ? 'lifecycle' : matrix ? 'matrix' : 'verified'}`);
fs.mkdirSync(output, { recursive: true });
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: 'uncommitted changes',
  environment: 'Installed Chrome, local CSP, external APIs blocked; mobile emulation, not physical devices or production.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let activePage;
try {
  const cases = lifecycle ? [[1440, false, true], [390, false, true]] : matrix ? [[1440, false, true], [390, false, true], [320, true, true]]
    : [[1440, false, false], [1440, false, true]];
  for (const [width, reduced, tap] of cases) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 900 },
      hasTouch: width < 900, isMobile: width < 900, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      window.__introFrames = [];
      const capture = () => {
        const intro = document.querySelector('#map-data-intro'), band = document.querySelector('#map-title-transition');
        if (intro && band) window.__introFrames.push({ time: performance.now(), visible: !intro.hidden,
          number: intro.dataset.exhibitNumber, opacity: Number(getComputedStyle(intro).opacity), band: Number(getComputedStyle(band).opacity),
          height: parseFloat(getComputedStyle(band, '::before').height),
          playing: globalThis.GaiaMapPlayback?.getState().playing, paused: globalThis.GaiaMapPlayback?.getState().paused,
          plot: document.querySelector('#japan-overlay')?.dataset.plotRevealState });
        requestAnimationFrame(capture);
      }; requestAnimationFrame(capture);
    });
    const page = await context.newPage();
    activePage = page;
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/world.html#world-21`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaModeEntryGuide);
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 100, null, { timeout: 60000 });
    await page.evaluate(() => GaiaModeEntryGuide.close('map', { restoreFocus: false }));
    await page.waitForFunction(() => !document.querySelector('#map-data-intro')?.hidden, null, { timeout: 60000 });
    if (matrix) {
      // Only shorten the unchanged title for the exhaustive navigation sweep.
      // Text hold/fade, input events, provider rendering and transport are real.
      await page.evaluate(() => setInterval(() => document.querySelector('#map-title-transition')?.getAnimations({ subtree: true })
        .filter(a => a.animationName?.startsWith('map-title')).forEach(a => { a.playbackRate = 30; }), 20));
      const numbers = lifecycle ? [22] : width === 1440 ? Array.from({ length: 100 }, (_, i) => i + 1) : [1, 4, 15, 21, 31, 51, 60, 70, 72, 73, 74, 75, 76, 77, 78, 79, 80];
      for (const number of numbers) {
        await page.evaluate(number => {
          window.__introFrames = [];
          GaiaMapCategories.buttons().find(b => Number(b.textContent.trim()) === number).click();
        }, number);
        await page.waitForFunction(number => {
          const intro = document.querySelector('#map-data-intro');
          return intro && !intro.hidden && Number(intro.dataset.exhibitNumber) === number;
        }, number, { timeout: 60000 });
        await page.waitForTimeout(110);
        const scan = await page.evaluate(() => {
          const layer = document.querySelector('#japan-layer'), cod = document.querySelector('#gaia-marine-cod-canvas');
          return { playback: GaiaMapPlayback.getState(), cod: cod?.dataset.codArrivalState,
            codVisible: cod?.dataset.codArrivalVisibleCount,
            theme: globalThis.GaiaMapThemeBackground?.getState(),
            fields: [...layer.querySelectorAll('#gaia-planet-signals-canvas, #gaia-firms-canvas, #gaia-climate-canvas, #gaia-marine-cod-canvas, #gaia-food-canvas, .gaia-estat-canvas, .gaia-estat-webgl, .gaia-live-prefecture-regions, .gaia-lake-view')]
              .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => el.id || el.getAttribute('class')),
            overflow: document.documentElement.scrollWidth - innerWidth };
        });
        assert.equal(scan.playback.playing, false, `${number}: gated playback`);
        assert.deepEqual(scan.fields, [], `${number}: data drawing waits, including cached/late frames`);
        assert.equal(scan.theme?.active || false, false, `${number}: background waits`);
        if (number >= 31 && number <= 69 && scan.cod) assert.equal(scan.cod, 'waiting', `${number}: POIs wait`);
        if (number === 21) {
          await page.waitForTimeout(280);
          await page.screenshot({ path: path.join(output, `${width}-21-reading.png`) });
        }
        const x = Math.round(width * .55), y = width === 320 ? 285 : 450;
        if (width < 900) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await page.waitForFunction(() => document.querySelector('#map-data-intro').hidden);
        const frames = (await page.evaluate(() => window.__introFrames)).filter(f => f.visible && Number(f.number) === number);
        assert(frames.length >= 3, `${number}: rendered frames captured`);
        assert(frames.at(-1).opacity < .01 && frames.at(-1).band < .01, `${number}: complete fade before removal`);
        assert(!frames.some(f => f.playing), `${number}: no early playback`);
        assert(frames.some(f => f.band > .05 && f.band < .9), `${number}: intermediate fade frames`);
        assert(Math.max(...frames.map(f => f.height)) - Math.min(...frames.map(f => f.height)) < .1, `${number}: unchanged band height`);
        await page.waitForFunction(() => { const s = GaiaMapPlayback.getState(); return !s.supported || !s.ready || s.playing; });
        const playback = await page.evaluate(() => GaiaMapPlayback.getState());
        report.checks.push({ width, reduced, number, frameCount: frames.length, last: frames.at(-1), during: scan, after: playback });
        if (number === 21) {
          await page.waitForTimeout(700);
          await page.screenshot({ path: path.join(output, `${width}-21-started.png`) });
        }
        console.log(`PASS ${width}/${number}: fade then playback`);
      }
      // Rapid switches during an exit must not let the cancelled exit release
      // the new title or hide its explanation.
      await page.evaluate(() => GaiaMapCategories.buttons().find(b => Number(b.textContent.trim()) === 21).click());
      await page.waitForFunction(() => !document.querySelector('#map-data-intro').hidden);
      if (width < 900) await page.touchscreen.tap(width * .55, 285); else await page.mouse.click(800, 450);
      await page.evaluate(() => GaiaMapCategories.buttons().find(b => Number(b.textContent.trim()) === 22).click());
      await page.waitForFunction(() => !document.querySelector('#map-data-intro').hidden && document.querySelector('#map-data-intro').dataset.exhibitNumber === '22');
      await page.waitForTimeout(600);
      assert.equal(await page.locator('#map-data-intro').isVisible(), true);
      assert.equal(await page.evaluate(() => GaiaMapPlayback.getState().playing), false);
      report.checks.push({ width, label: 'cancelled exit cannot release the replacement intro' });
      if (lifecycle) {
        // A control click still works while the band fades; closing the map
        // cancels pending callbacks rather than starting a hidden exhibit.
        await page.locator('#japan-close').click();
        await page.waitForTimeout(700);
        assert(await page.locator('#map-data-intro').isHidden());
        assert.equal(await page.evaluate(() => document.querySelector('#japan-layer')?.classList.contains('is-map-data-intro') || false), false);
        assert.equal(await page.evaluate(() => globalThis.GaiaMapPlayback?.getState().playing || false), false);
        report.checks.push({ width, label: 'close during fade cancels without hidden playback' });
      }
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
      await context.close();
      continue;
    }
    await page.waitForFunction(() => { const n = document.querySelector('#map-data-intro'); return n && !n.hidden && Number(getComputedStyle(n).opacity) > .98; });
    if (tap) await page.mouse.click(850, 490);
    await page.waitForFunction(() => document.querySelector('#map-data-intro').hidden);
    const frames = await page.evaluate(() => window.__introFrames);
    const shown = frames.filter(f => f.visible);
    const result = { tap, durationMs: shown.at(-1).time - shown[0].time, last: shown.at(-1),
      playingDuringIntro: shown.some(f => f.playing), frames };
    report.checks.push(result);
    if (!before) {
      if (!tap) assert(result.durationMs > 2900 && result.durationMs < 3500, 'Natural duration is two thirds of 4667ms');
      assert(result.last.opacity < .01 && result.last.band < .01, 'Text AND band reach transparent before removal');
      assert(!result.playingDuringIntro, 'Playback waits for completed fade');
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = before ? 'reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  if (activePage && !activePage.isClosed()) {
    report.failureState = await activePage.evaluate(() => ({ title: document.querySelector('#japan-title')?.outerHTML,
      layer: document.querySelector('#japan-layer')?.className, intro: document.querySelector('#map-data-intro')?.outerHTML,
      guide: globalThis.GaiaModeEntryGuide?.getState(), playback: globalThis.GaiaMapPlayback?.getState() })).catch(() => null);
    await activePage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
}
finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, output }, null, 2));
