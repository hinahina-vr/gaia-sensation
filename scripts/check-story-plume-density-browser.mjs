import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const root = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/story-plume-density-20260910');
const output = path.join(root, before ? 'before' : process.env.GAIA_DENSITY_STAGE || 'after');
fs.mkdirSync(output, {recursive: true});
const baseline = before ? null : JSON.parse(fs.readFileSync(path.join(root, 'before/report.json'), 'utf8'));
const report = {status: 'running', before, base, hashes: {}, checks: [], errors: [], environment: 'Installed Chrome, native title → story entry, actual WebGL pixels at the existing reduced-motion time (7s), production CSP. Desktop/touch viewport emulation, not physical phones or production.'};
for (const file of ['story-prologue-plume.js', 'story-prologue.js', 'opening.css', 'index.html']) {
  report.hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (before) fs.copyFileSync(file, path.join(output, path.basename(file)));
}
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    const context = await browser.newContext({viewport: {width, height}, isMobile: width < 900, hasTouch: width < 900, reducedMotion: 'reduce'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(() => sessionStorage.setItem('gaia:title-return-resume', '1'));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => {if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);});
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    const activate = selector => width < 900 ? page.locator(selector).tap() : page.locator(selector).click();
    await activate('#gaia-opening-route-story');
    await page.waitForFunction(() => {
      const lines = [...document.querySelectorAll('.gaia-story-prologue-copy p')];
      return lines.length === 8 && lines.every(line => Number(getComputedStyle(line).opacity) === 1);
    });
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      const dialog = document.querySelector('#gaia-story-prologue');
      const canvas = dialog.querySelector('.gaia-story-prologue-plume');
      const gl = canvas.getContext('webgl');
      if (!gl || GaiaStoryPrologue.getState().plume.renderer !== 'webgl') throw new Error('Actual WebGL required');
      // The reduced-motion renderer uses its normal fixed time. Redraw and read
      // synchronously, before the non-preserved drawing buffer is cleared.
      dispatchEvent(new Event('resize'));
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let edgeDarkness = 0, edgeChroma = 0, edgeCount = 0, centerDarkness = 0, centerCount = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (pixels[i + 3] !== 255) throw new Error('Read a cleared or transparent drawing buffer');
        const darkness = 255 - (.2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]);
        const nx = x / canvas.width, ny = y / canvas.height;
        if (nx < .2 || nx > .8 || ny < .18) {
          edgeDarkness += darkness; edgeChroma += Math.max(...pixels.subarray(i, i + 3)) - Math.min(...pixels.subarray(i, i + 3)); edgeCount++;
        }
        if (nx > .35 && nx < .65 && ny > .3 && ny < .75) {centerDarkness += darkness; centerCount++;}
      }
      const linear = channel => {const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;};
      const luminance = rgb => rgb.map(linear).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const bounds = canvas.getBoundingClientRect();
      let minimumTextContrast = Infinity;
      let lowestContrastText = null;
      const textRects = [];
      for (const paragraph of dialog.querySelectorAll('.gaia-story-prologue-copy p, .gaia-story-prologue-controls button')) {
        const foreground = getComputedStyle(paragraph).color.match(/[\d.]+/g).slice(0, 3).map(Number);
        const foregroundLuminance = luminance(foreground);
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) for (let at = 0; at < node.length; at++) {
          if (/\s/u.test(node.data[at])) continue;
          const range = document.createRange(); range.setStart(node, at); range.setEnd(node, at + 1);
          const rect = range.getBoundingClientRect();
          if (paragraph.tagName === 'P') textRects.push({left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom});
          for (const [cx, cy] of [[rect.left, rect.top], [rect.right, rect.bottom], [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2]]) {
            const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((cx - bounds.left) / bounds.width * canvas.width)));
            const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((bounds.bottom - cy) / bounds.height * canvas.height)));
            const i = (y * canvas.width + x) * 4;
            const background = luminance([...pixels.subarray(i, i + 3)]);
            const contrast = (background + .05) / (foregroundLuminance + .05);
            if (contrast < minimumTextContrast) {minimumTextContrast = contrast; lowestContrastText = {text: paragraph.textContent, foreground};}
          }
        }
      }
      return {edgeDarkness: edgeDarkness / edgeCount, edgeChroma: edgeChroma / edgeCount, centerDarkness: centerDarkness / centerCount, minimumTextContrast, lowestContrastText, textRects, controlsTop: dialog.querySelector('.gaia-story-prologue-controls').getBoundingClientRect().top, textAlign: getComputedStyle(dialog.querySelector('.gaia-story-prologue-copy')).textAlign, glError: gl.getError(), state: GaiaStoryPrologue.getState().plume};
    });
    const check = {width, height, metrics, nativeSkipAndLanding: false};
    report.checks.push(check);
    assert.equal(metrics.glError, 0);
    assert.equal(metrics.state.motion, 'static');
    assert(metrics.state.width * metrics.state.height <= 360000);
    assert.equal(metrics.textAlign, 'center');
    assert(metrics.textRects.every(rect => rect.left >= -1 && rect.right <= width + 1 && rect.top >= 0 && rect.bottom < metrics.controlsTop), 'Text stays on-screen and clear of native controls');
    if (!before) {
      const previous = baseline.checks.find(check => check.width === width && check.height === height).metrics;
      metrics.densityRatio = metrics.edgeDarkness / previous.edgeDarkness;
      assert(metrics.densityRatio >= 1.6, 'Sea mist must be visibly denser than the recorded original');
      assert(metrics.edgeChroma >= previous.edgeChroma * 1.4, 'Sea color must become stronger, not merely gray');
      assert(metrics.minimumTextContrast >= 4.5, `Keep every sampled letter readable against the actual plume: ${metrics.minimumTextContrast}`);
      assert(metrics.centerDarkness < 12, 'Preserve the bright central reading area');
    }
    await page.screenshot({path: path.join(output, `${width}x${height}-reading.png`)});
    await activate('#gaia-story-prologue button:first-of-type');
    await page.waitForFunction(() => !document.querySelector('#gaia-story-prologue') && document.querySelector('#novel-layer')?.dataset.stepId === 'festival_concept_001');
    assert.equal(await page.evaluate(() => GaiaStoryPrologue.getState().plume), null);
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    check.nativeSkipAndLanding = true;
    console.log(JSON.stringify({width, height, edgeDarkness: metrics.edgeDarkness, densityRatio: metrics.densityRatio, minimumTextContrast: metrics.minimumTextContrast}));
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({path: path.join(output, 'failure.png')}).catch(() => {}); throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
