import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/story-wave-fade-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = {
  status: 'running', before, checks: [], errors: [],
  scope: 'Installed Chrome, actual title controls, real procedural Web Audio and audio-clock analyser measurements. Passive parallel taps only; no mocked audio or autoplay bypass. Local desktop/touch emulation, not physical devices or subjective speaker listening.',
  hashes: Object.fromEntries(['story-prologue.js', 'opening.css', 'opening-audio.js', 'index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
};
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  for (const width of before ? [1440] : [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, isMobile: width < 900, hasTouch: width < 900 });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', r => r.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem('gaia:title-return-resume', '1');
      localStorage.setItem('gaia-senseware-bgm-volume', '.1');
      localStorage.setItem('gaia-senseware-bgm-muted', 'false');
      window.__surf = { samples: [], startedAt: null, transition: null };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function(destination, ...args) {
        const result = connect.call(this, destination, ...args);
        if (this instanceof BiquadFilterNode && this.type === 'highpass' && this.frequency.value === 65) {
          const tap = node => { const analyser = node.context.createAnalyser(); analyser.fftSize = 1024; connect.call(node, analyser); return analyser; };
          __surf.input = tap(this); __surf.output = tap(destination); __surf.gain = destination;
        }
        return result;
      };
      document.addEventListener('transitionend', event => {
        if (event.target.id === 'gaia-story-prologue' && event.propertyName === 'opacity' && event.target.classList.contains('is-clearing')) {
          __surf.transition = { duration: event.elapsedTime * 1000, at: performance.now() };
        }
      });
      new MutationObserver(() => {
        const dialog = document.querySelector('#gaia-story-prologue.is-clearing');
        if (dialog && __surf.startedAt === null) __surf.startedAt = performance.now();
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
      const rms = analyser => {
        const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      };
      __surf.timer = setInterval(() => {
        if (!__surf.input) return;
        const dialog = document.querySelector('#gaia-story-prologue');
        __surf.samples.push({ at: performance.now(), phase: dialog?.dataset.phase || null, opacity: dialog ? Number(getComputedStyle(dialog).opacity) : null, gain: __surf.gain.gain.value, input: rms(__surf.input), output: rms(__surf.output), audio: GaiaOpeningAudio.getState(), prologue: GaiaStoryPrologue.getState() });
      }, 30);
    });
    page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
    const activate = selector => width < 900 ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-opening-route-story').waitFor();
    await activate('#gaia-audio-toggle'); await activate('#gaia-audio-toggle');
    await page.waitForFunction(() => GaiaOpeningAudio.getPlaybackState().outputVolume > .0999);
    if (width < 900) {
      await page.locator('#gaia-opening-route-guide.is-visible').waitFor();
      await page.keyboard.press('Escape'); await page.locator('#gaia-opening-route-guide').waitFor({ state: 'hidden' });
    }
    await activate('#gaia-opening-route-story');
    await page.waitForFunction(() => window.__surf.input && GaiaStoryPrologue.getState().waveFade === 1);
    if (width < 900) await activate('#gaia-story-prologue button:first-of-type');
    await page.locator('#gaia-story-prologue[data-phase="unveiling"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(output, `${width}-unveiling.png`) });
    await page.locator('#gaia-story-prologue').waitFor({ state: 'detached' });
    await page.waitForTimeout(450);
    const measured = await page.evaluate(() => ({ samples: __surf.samples, startedAt: __surf.startedAt, transition: __surf.transition, step: GaiaNovel.getState().stepId }));
    const reading = measured.samples.filter(sample => ['reading', 'breathing'].includes(sample.phase));
    const fading = measured.samples.filter(sample => sample.phase === 'unveiling' && sample.at >= measured.startedAt);
    const landed = measured.samples.filter(sample => sample.at > measured.startedAt + 1500 && !sample.phase);
    assert.equal(measured.step, 'festival_concept_001');
    assert(reading.some(sample => sample.output > .001), 'Real surf PCM must be present while reading');
    assert(fading.length > 15 && landed.length > 3, 'Record the real outgoing transition and its tail');
    assert(measured.transition && Math.abs(measured.transition.duration - 1400) < 10, 'Keep the existing 1.4-second visual fade');
    if (before) {
      assert(fading.every(sample => Math.abs(sample.gain - .5) < .0001), 'Reproduce surf staying loud through the white fade');
      assert(landed.some(sample => sample.output > .001), 'Reproduce waves continuing after the opening');
    } else {
      assert(reading.every(sample => Math.abs(sample.gain - .25) < .0001), 'Surf is half of the current 0.5 setting');
      const gainAt = elapsed => fading.find(sample => sample.at - measured.startedAt >= elapsed)?.gain;
      assert(gainAt(200) > .15 && gainAt(200) < .25, 'Start lowering the waves with the visual fade');
      assert(gainAt(650) > .07 && gainAt(650) < .16, 'Do not cut the surf abruptly');
      assert(gainAt(1200) < .06, 'Surf must be almost silent near the end');
      for (let i = 1; i < fading.length; i++) assert(fading[i].gain <= fading[i - 1].gain + .0001, 'Fade is monotonic');
      const audible = fading.filter(sample => sample.gain > .01 && sample.input > .001);
      assert(audible.length > 10);
      for (const sample of audible) assert(Math.abs(sample.output / sample.input - sample.gain) < .018, 'Actual surf PCM must follow its outgoing gain');
      assert(landed.every(sample => sample.gain === 0 && sample.output < .000001), 'No residual waves after the opening disappears');
      await page.evaluate(() => GaiaOpeningAudio.setMuted(true)); await page.waitForTimeout(400);
      await page.evaluate(() => GaiaOpeningAudio.setMuted(false)); await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => __surf.gain.gain.value), 0, 'Unmuting after landing must not restart the surf');
      assert.equal(await page.evaluate(() => Number(localStorage.getItem('gaia-senseware-bgm-volume'))), .1, 'Do not change user volume');
    }
    report.checks.push({ width, route: width < 900 ? 'native tap / skip' : 'native click / full reading', ...measured });
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await page.evaluate(() => clearInterval(__surf.timer)); await context.close();
    console.log(`PASS ${width}: ${before ? 'persistent surf reproduced' : 'half gain and synchronized fade with actual PCM'}`);
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
