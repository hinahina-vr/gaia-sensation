import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
const before = process.argv.includes('--before');
const desktopOnly = process.argv.includes('--desktop-only');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/story-white-prologue-2026-09-09/${before ? 'before' : desktopOnly ? 'desktop-final' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, base, checks: [], errors: [], sha256: {} };
report.environment = 'Installed Chrome; real media decoding and procedural Web Audio output tapped into analysers/MediaRecorder. Desktop and touch emulation, not physical-device or subjective listening verification.';
const expectedLines = ['白い光の向こうで、海が揺れていた。', '潮の匂いを含んだ風と、', '遠くの誰かの笑い声。', '今日は、見るだけで帰るつもりだった。', '人混みも、', '知らない誰かと話すのも、得意じゃない。', 'それでも、ここまで来た。', 'たぶん、最初の選択は、それだけだった。'];
for (const file of ['opening.js', 'opening.css', 'opening-audio.js', 'ui-sound.js', 'novel-mode.js', 'story-prologue.js', 'story-prologue-plume.js', 'index.html', 'gaia-mode-loader.js']) {
  if (fs.existsSync(file)) report.sha256[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
async function boot(width = 1440, height = 900, reducedMotion = 'no-preference', sound = true, intercept = null) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, hasTouch: width < 900, isMobile: width < 900 });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**', r => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
  if (intercept) await intercept(context);
  await context.addInitScript(() => {
    // Passive parallel taps: keep every original connection and real device
    // clock. No fake audio, autoplay switches, or substituted sound assets.
    window.__audioTaps = [];
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connect.call(this, destination, ...args);
      if (destination === this.context.destination) {
        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
        const stream = this.context.createMediaStreamDestination();
        connect.call(this, analyser); connect.call(analyser, stream);
        const recorder = new MediaRecorder(stream.stream, { mimeType: 'audio/webm' });
        const chunks = []; recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start(250);
        __audioTaps.push({ analyser, recorder, chunks, context: this.context, node: this.constructor.name });
      }
      return result;
    };
  });
  if (before) {
    for (const file of ['opening.js', 'opening-audio.js', 'ui-sound.js', 'opening.css', 'novel-mode.js']) {
      const body = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
      report.sha256[file] = createHash('sha256').update(body).digest('hex');
      await context.route(`**/${file}?*`, r => r.fulfill({ status: 200, contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript', body }));
    }
  }
  await context.addInitScript(() => { sessionStorage.setItem('gaia:title-return-resume', '1'); });
  page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const button = page.locator('#gaia-opening-route-story');
  await button.waitFor({ state: 'visible', timeout: 30000 });
  // Trusted activation of the existing title sound control, never autoplay bypass.
  if (sound) {
    await page.locator('#gaia-audio-toggle').click();
    await page.locator('#gaia-audio-toggle').click();
    await page.waitForFunction(() => GaiaOpeningAudio.getPlaybackState().outputVolume > .0999);
    await page.evaluate(() => GaiaOpeningAudio.enableAnalysis());
  }
  return { context, button };
}
async function sampleEntry() {
  await page.evaluate(() => {
    window.__samples = []; window.__entryAt = performance.now();
    window.__whiteTransition = null;
    document.addEventListener('transitionend', event => {
      if (event.target.id === 'gaia-story-prologue' && event.propertyName === 'opacity' && !event.target.classList.contains('is-clearing')) {
        __whiteTransition = {time:performance.now() - __entryAt, duration:event.elapsedTime * 1000};
      }
    });
    document.addEventListener('click', event => {
      if (event.target.closest('#gaia-opening-route-story')) {
        // Measure the real activation, excluding Playwright's actionability wait.
        window.__entryAt = performance.now(); window.__samples = [];
      }
    }, {once:true, capture:true});
    window.__sampleTimer = setInterval(() => {
      const veil = document.querySelector('#gaia-story-prologue');
      const novel = document.querySelector('#novel-layer');
      const pcm = __audioTaps.map(({ analyser, node, context }) => {
        const values = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(values);
        return { node, context: context.state, rms: Math.sqrt(values.reduce((sum, x) => sum + x*x, 0) / values.length), peak: values.reduce((max, x) => Math.max(max, Math.abs(x)), 0) };
      });
      __samples.push({ time: performance.now() - __entryAt, ...GaiaOpeningAudio.getPlaybackState(), prologue: window.GaiaStoryPrologue?.getState(), phase: veil?.dataset.phase || null, white: veil ? Number(getComputedStyle(veil).opacity) : null, novelVisible: novel ? !novel.hidden && Number(getComputedStyle(novel).opacity) > .98 : false, background: novel ? getComputedStyle(novel).backgroundImage : null, step: novel?.dataset.stepId, revealCount: document.querySelector('#novel-text')?.dataset.revealCount, pcm });
    }, 40);
  });
}
async function recordAudio(label) {
  const recordings = await page.evaluate(async () => {
    clearInterval(__sampleTimer);
    return Promise.all(__audioTaps.map(async ({ recorder, chunks, node }, index) => {
      if (recorder.state !== 'inactive') await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
      const buffer = new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer());
      let binary = ''; for (const byte of buffer) binary += String.fromCharCode(byte);
      return { index, node, base64: btoa(binary) };
    }));
  });
  for (const recording of recordings) fs.writeFileSync(path.join(output, `${label}-audio-${recording.index}-${recording.node}.webm`), Buffer.from(recording.base64, 'base64'));
}
async function assertLanding() {
  await page.waitForFunction(() => !document.querySelector('#gaia-story-prologue') && document.querySelector('#novel-layer')?.dataset.stepType === 'narration', null, { timeout: 30000 });
  assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'), 'festival_concept_001');
  assert((await page.locator('#novel-text').getAttribute('aria-label')).startsWith('海沿いの展示場の入口で、一度立ち止まった'));
  assert.equal(new URL(page.url()).hash, '#story');
  assert.deepEqual(await page.evaluate(() => __securityViolations), []);
}
async function assertCopy(label) {
  const layout = await page.locator('#gaia-story-prologue').evaluate(dialog => ({
    rect: dialog.getBoundingClientRect().toJSON(), scrollWidth: dialog.scrollWidth, clientWidth: dialog.clientWidth,
    background: getComputedStyle(dialog).backgroundColor,
    textAlign: getComputedStyle(dialog.querySelector('.gaia-story-prologue-copy')).textAlign,
    plume: window.GaiaStoryPrologue.getState().plume,
    paragraphs: [...dialog.querySelectorAll('.gaia-story-prologue-copy p')].map(p => ({ text: p.textContent, rect: p.getBoundingClientRect().toJSON(), opacity: Number(getComputedStyle(p).opacity), color: getComputedStyle(p).color })),
    controls: [...dialog.querySelectorAll('button')].map(b => b.getBoundingClientRect().toJSON()),
  }));
  assert.deepEqual(layout.paragraphs.map(p => p.text), expectedLines);
  assert.equal(layout.background, 'rgb(255, 255, 255)');
  assert.equal(layout.textAlign, 'center');
  assert.equal(layout.plume?.renderer, 'webgl', `${label}: real WebGL plume is missing`);
  assert(layout.plume.width * layout.plume.height <= 360000, `${label}: plume exceeded its pixel budget`);
  assert(layout.scrollWidth <= layout.clientWidth + 1, `${label}: horizontal overflow`);
  for (const p of layout.paragraphs) {
    assert(p.rect.top >= 0 && p.rect.bottom < layout.controls[0].top, `${label}: text clipped/covered`);
    assert(p.rect.left >= 0 && p.rect.right <= layout.clientWidth, `${label}: text outside viewport`);
  }
  for (const c of layout.controls) assert(c.height >= 44 && c.width >= 44);
  return layout;
}
try {
  const { context, button } = await boot();
  await sampleEntry();
  await button.click();
  await page.waitForTimeout(before ? 4500 : 1500);
  if (before) {
    const samples = await page.evaluate(() => __samples);
    report.entrySamples = samples;
    const falling = samples.filter(s => s.track === 'opening' && s.outputVolume < .09 && s.outputVolume > .01);
    const tail90to10ms = falling.at(-1).time - falling[0].time;
    assert(tail90to10ms < 350, `Old track switch should reproduce the short tail: ${tail90to10ms}`);
    report.checks.push({ name: 'reported short fade reproduced', tail90to10ms, samples });
    assert.equal(await page.locator('#gaia-story-prologue').count(), 0);
    await page.screenshot({ path: path.join(output, 'no-prologue.png') });
  } else {
    await page.screenshot({ path: path.join(output, 'whiteout-desktop.png') });
    await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => localStorage.getItem('gaiaSensewareNovel:progress')), null, 'Do not create/advance a save during the prologue');
    await page.waitForTimeout(9500);
    const layout = await assertCopy('desktop');
    await page.screenshot({ path: path.join(output, 'prologue-desktop.png') });
    await assertLanding();
    await page.screenshot({ path: path.join(output, 'first-line-desktop.png') });
    await page.waitForTimeout(2200);
    const samples = await page.evaluate(() => __samples);
    report.entrySamples = samples;
    const covering = samples.filter(s => s.phase === 'covering');
    const fadeStart = covering[0].time;
    assert(fadeStart < 200, `Sound preparation blocked the click/first paint for ${fadeStart}ms`);
    const at = ms => covering.find(s => s.time - fadeStart >= ms);
    assert(at(400).outputVolume > .06, 'Title audio must retain a long tail');
    assert(at(1500).outputVolume > .001 && at(1500).outputVolume < .035);
    const whiteTransition = await page.evaluate(() => __whiteTransition);
    assert(whiteTransition, 'White fade must complete its real opacity transition');
    const whiteAt = whiteTransition.time;
    assert(whiteAt >= 1200 && whiteAt <= 1500, `whiteout duration ${whiteAt}`);
    const reading = samples.filter(s => ['reading', 'breathing'].includes(s.phase));
    assert(reading.every(s => s.outputVolume < .0001 && s.pcm.slice(0,-1).every(p => p.rms < .0001)), 'Title BGM and UI must remain quiet while the surf plays');
    assert(covering.some(s => s.time - fadeStart < 1500 && s.prologue?.waveFade > .1 && s.pcm.at(-1)?.rms > .0001), 'Real wave PCM must fade in during the opening, not wait for the first story scene');
    assert(at(400).prologue.waveFade < at(1500).prologue.waveFade, 'Wave fade must rise gradually');
    assert(reading.some(s => s.pcm.at(-1)?.rms > .0005), 'Waves must remain audible while reading');
    const plumeFrames = reading.map(s => s.prologue?.plume?.frames).filter(Number.isFinite);
    assert(plumeFrames.at(-1) > plumeFrames[0] + 20, 'WebGL plume must actually animate');
    const unveiling = samples.filter(s => s.phase === 'unveiling');
    assert(unveiling.length > 10 && unveiling.every(s => s.novelVisible && s.background.includes('url(') && !Number(s.revealCount)), 'Paint the entrance before unveiling; do not type underneath it');
    assert(samples.some(s => s.pcm.at(-1)?.rms > .00001 && !s.phase), 'Distant voices must still reach the first scene');
    assert(samples.filter(s => !s.phase && s.prologue?.ambience).every(s => s.prologue.surfGain === 0), 'Surf must end with the white curtain, independently of the distant voices');
    assert(samples.every(s => s.pcm.every(p => p.peak < 1)), 'No clipping');
    assert.equal(await page.evaluate(() => GaiaStoryPrologue.getState().plume), null, 'Plume must be disposed after landing');
    report.checks.push({ name: 'full desktop entry / title fade 2.1s / waves fade 3s from opening / real PCM / WebGL / centered copy / no premature text', whiteAt, layout, samples, state: await page.evaluate(() => GaiaNovel.getState()) });
    await recordAudio('full-desktop');
    // Existing storage routes, through real controls, after the new entry.
    await page.locator('#novel-save-button').click();
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gaiaSensewareNovel:manual-saves'))[0]);
    assert.equal(saved.progress.stepId, 'festival_concept_001');
    await page.locator('#novel-save-close').click();
    await page.locator('#novel-text').click();
    await page.locator('#novel-load-button').click();
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => GaiaNovel.getState().stepId), saved.progress.stepId);
    await page.goto(`${base}/story`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaNovel && document.querySelector('#novel-layer')?.dataset.stepId === 'festival_concept_001');
    assert.equal(await page.locator('#gaia-story-prologue').count(), 0, 'Direct/resumed story must not replay title prologue');
    report.checks.push({ name: 'native SAVE / LOAD / direct reload resume without prologue', saved });
  }
  await context.close();
  if (!before && !desktopOnly) {
    for (const [width, height, motion] of [[390,844,'no-preference'], [320,568,'reduce'], [280,653,'no-preference'], [568,320,'no-preference'], [844,390,'no-preference'], [3840,2160,'no-preference']]) {
      const sound = width === 390;
      const { context, button } = await boot(width, height, motion, sound);
      if (width === 390) await button.tap();
      else await button.press('Enter');
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      const layout = await assertCopy(`${width}x${height}`);
      assert.equal(layout.plume.motion, motion === 'reduce' ? 'static' : 'running');
      // Keep one complete mobile reading; exercise skipping on the rest.
      if (width === 390) {
        await page.waitForTimeout(9500);
        await page.screenshot({ path: path.join(output, `prologue-${width}x${height}.png`) });
      } else {
        await page.locator('#gaia-story-prologue button').first().focus();
        await page.keyboard.press('Enter');
      }
      await assertLanding();
      assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().muted), !sound);
      assert.equal(await page.evaluate(() => GaiaStoryPrologue.getState().ambience), sound);
      if (sound) {
        if (!await page.locator('#gaia-audio-dock').evaluate(el => el.classList.contains('is-expanded'))) await page.locator('#gaia-audio-toggle').tap();
        await page.locator('#gaia-audio-toggle').tap();
        await page.waitForTimeout(450);
        assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().muted), true);
        assert.equal(await page.evaluate(() => GaiaStoryPrologue.getState().ambienceGain), 0);
      }
      await page.screenshot({ path: path.join(output, `landing-${width}x${height}.png`) });
      report.checks.push({ name: `layout / ${sound ? 'touch + sound on + native mute' : 'keyboard + silent'} / ${width === 390 ? 'full reading' : 'skip'} ${width}x${height} ${motion}`, layout });
      await context.close();
    }
    {
      const { context, button } = await boot();
      await button.click();
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await page.locator('#gaia-story-prologue button').first().click();
      await page.locator('#gaia-story-prologue[data-phase="unveiling"]').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#gaia-story-prologue').waitFor({ state: 'detached' });
      assert.equal(await page.locator('#novel-layer').isVisible(), false);
      assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().duckGain), 1);
      assert.equal(await page.evaluate(() => localStorage.getItem('gaiaSensewareNovel:progress')), null);
      await button.click();
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await page.locator('#gaia-story-prologue button').first().click();
      await assertLanding();
      report.checks.push({ name: 'Escape during unveiling / partial novel rollback / no premature save / re-entry' });
      await context.close();
    }
    {
      const { context, button } = await boot();
      await button.click();
      await page.waitForTimeout(600); await page.keyboard.press('Escape');
      await page.locator('#gaia-story-prologue').waitFor({ state: 'detached' });
      assert.equal(await button.isEnabled(), true);
      assert.equal(await page.locator('#gaia-opening-final-menu').evaluate(el => el.inert), false);
      assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().duckGain), 1);
      assert.equal(await page.evaluate(() => localStorage.getItem('gaiaSensewareNovel:progress')), null);
      await button.click();
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await page.locator('#gaia-story-prologue button').first().click();
      await assertLanding();
      report.checks.push({ name: 'Escape cancel before white / gain restore / retry to first line' });
      await context.close();
    }
    {
      let fail = true;
      const { context, button } = await boot(1440, 900, 'no-preference', false, async context => {
        await context.route('**/novel-mode.js?*', r => fail ? r.abort('failed') : r.continue());
      });
      await button.click();
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await page.locator('#gaia-story-prologue button').first().click();
      await page.locator('#gaia-story-entry-error').waitFor();
      assert.equal(await button.isEnabled(), true);
      fail = false;
      await button.click();
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await page.locator('#gaia-story-prologue button').first().click();
      await assertLanding();
      report.checks.push({ name: 'network script failure / readable error / same-page native retry' });
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, output }));
}
