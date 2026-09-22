import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readStartupBaseline } from './lib/startup-baseline.mjs';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const baseline = process.env.GAIA_COMPARE_BASELINE || 'artifacts/performance-improvement/baseline';
// The exact pre-change worktree snapshot is preferred; Git is a reproducible
// fallback on a fresh checkout (the preceding loader-only refactor was visual-neutral).
const baselineFiles = new Map(['index.html', 'app.js', 'opening.js', 'gaia-i18n.js', 'gaia-mode-loader.js', 'character-mode.js'].map(file => {
  const saved = path.join(baseline, file);
  return [file, fs.existsSync(saved) ? fs.readFileSync(saved) : Buffer.from(readStartupBaseline(file))];
}));
const output = 'artifacts/performance-improvement/compatibility';
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', checks: [], errors: [],
  scope: 'Installed Chrome, local assets, external APIs blocked. Sound canvas is compared with deterministic randomness/reduced motion. GPU readiness gate is synthetic; actual map startup/playback is verified after release. Not a production or physical-device test.' };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  for (const width of [1440, 390]) {
    const versions = [];
    for (const version of ['before', 'after']) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
      await context.route('https://**', route => route.abort());
      if (version === 'before') await context.route(base + '/**', route => {
        const pathname = new URL(route.request().url()).pathname;
        const file = pathname === '/' ? 'index.html' : pathname.slice(1);
        return baselineFiles.has(file)
          ? route.fulfill({ body: baselineFiles.get(file), contentType: file.endsWith('.html') ? 'text/html' : 'application/javascript' })
          : route.fallback();
      });
      await context.addInitScript(() => { Math.random = () => .42; });
      page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('#gaia-boot')?.hidden && Number(document.querySelector('#gaia-opening-sound-atmosphere')?.dataset.frames) > 0);
      const captures = [];
      for (const viewport of [{ width, height: width === 390 ? 844 : 900 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(180);
        captures.push(await page.evaluate(() => {
          const canvas = document.querySelector('#gaia-opening-sound-atmosphere');
          const modal = document.querySelector('#gaia-opening-sound-modal');
          const ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1100000 / (modal.clientWidth * modal.clientHeight)));
          if (canvas.width !== Math.max(1, Math.floor(modal.clientWidth * ratio)) || canvas.height !== Math.max(1, Math.floor(modal.clientHeight * ratio))) throw Error('Atmosphere dimensions changed');
          return { width: canvas.width, height: canvas.height, particles: canvas.dataset.particles,
            pixels: canvas.toDataURL(), controls: [...modal.querySelectorAll('button,h2')].map(element => {
              const box = element.getBoundingClientRect(), style = getComputedStyle(element);
              return { text: element.textContent.trim(), box: [box.x, box.y, box.width, box.height], font: style.font, color: style.color };
            }) };
        }));
        await page.screenshot({ path: `${output}/${width}-${version}-${viewport.width}-sound.png`, animations: 'disabled' });
      }
      versions.push(captures);
      await context.close();
    }
    assert.deepEqual(versions[1], versions[0], `${width}: initial and rotated sound controls/canvas must be identical`);
    report.checks.push({ width, soundPixelsAndGeometry: 'identical', rotatedViewport: '844x390' });
    console.log('PASS identical sound canvas/controls and resize', width);

    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.route('https://**', route => route.abort());
    await context.addInitScript(() => {
      globalThis.__holdGaiaShader = true;
      const native = WebGL2RenderingContext.prototype.getProgramParameter;
      WebGL2RenderingContext.prototype.getProgramParameter = function(program, parameter) {
        if (parameter === 0x91B1 && globalThis.__holdGaiaShader) {
          globalThis.__usedShaderGate = true;
          return false;
        }
        return native.call(this, program, parameter);
      };
    });
    page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(base + '/#top');
    await page.waitForFunction(() => document.documentElement.dataset.gaiaEntryReady === 'true' && globalThis.GaiaModeLoader.isLoaded('entry'));
    assert.equal(await page.evaluate(() => __usedShaderGate), true);
    assert.notEqual(await page.evaluate(() => document.documentElement.dataset.gaiaAppReady), 'true');
    await page.evaluate(() => GaiaIntroEntryGuide.close({ restoreFocus: false }));
    const map = page.locator('.intro-path-card[data-intro-path="map"]');
    await map.click();
    assert.equal(await map.getAttribute('aria-busy'), 'true');
    assert.equal(await page.evaluate(() => GaiaModeLoader.isLoaded('exploration')), false);
    await page.evaluate(() => { globalThis.__holdGaiaShader = false; });
    await page.waitForFunction(() => GaiaModeLoader.isLoaded('exploration'));
    await page.locator('[data-feature-start]').click();
    await page.waitForFunction(() => GaiaMapPlayback.getState().ready);
    await page.waitForFunction(() => GaiaMapPlayback.getState().playing);
    await page.screenshot({ path: `${output}/${width}-map-after-gpu-ready.png` });
    report.checks.push({ width, entryUsableDuringCompile: true, mapWaitsForRenderer: true, playbackAfterEntry: true });
    // Return from a story-only boot: the entry runtime has not been loaded yet.
    await page.goto(base + '/?qa=story-return#story');
    await page.waitForFunction(() => globalThis.GaiaNovel && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
    assert.equal(await page.evaluate(() => GaiaModeLoader.isLoaded('entry')), false);
    await page.locator('#novel-home-button').click();
    await page.waitForFunction(() => document.documentElement.dataset.gaiaEntryReady === 'true' && !document.querySelector('#intro-layer')?.hidden);
    assert.equal(await page.evaluate(() => __usedShaderGate), true);
    assert.notEqual(await page.evaluate(() => document.documentElement.dataset.gaiaAppReady), 'true');
    assert.equal(await page.evaluate(() => document.body.classList.contains('novel-open')), false);
    await page.evaluate(() => { globalThis.__holdGaiaShader = false; });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true');
    report.checks.push({ width, storyOnlyBootReturnToEntry: true, storyExitVia: 'native home button' });
    await context.close();
    console.log('PASS entry/map independent readiness', width);
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
