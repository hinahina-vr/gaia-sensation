import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const before = process.argv.includes('--before');
const out = `artifacts/sound-constellation-morph-20260913/${before ? 'before' : 'after'}`;
fs.mkdirSync(out, { recursive: true });
const source = before ? execFileSync('git', ['show', 'HEAD:sound-constellation.js'], { encoding: 'utf8' }) : fs.readFileSync('sound-constellation.js', 'utf8');
const report = { status: 'running', rendererSha256: createHash('sha256').update(source).digest('hex'), scope: before ? 'Replay the HEAD constellation renderer in the current local app; not an old full deployment.' : 'Local Chrome, real RAF/canvas/video and native focus/keyboard/pointer. No audio output or physical-device claim.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 2048, height: 1114 } });
  await context.route('https://**', r => r.abort());
  if (before) await context.route('**/sound-constellation.js*', r => r.fulfill({ contentType: 'text/javascript', body: source }));
  await context.addInitScript(() => {
    sessionStorage.setItem('gaia:title-return-resume', '1');
    localStorage.setItem('gaia-senseware-bgm-volume', '0');
    // Observe actual sprite draws; the native implementation still performs them.
    window.__morphSprites = new WeakMap();
    const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, draw = proto.drawImage;
    proto.clearRect = function (...args) { if (this.canvas.classList.contains('sound-track-morph-canvas')) __morphSprites.set(this.canvas, []); return clear.apply(this, args); };
    proto.drawImage = function (image, ...args) {
      if (this.canvas.classList.contains('sound-track-morph-canvas') && image.width === 48 && image.height === 48 && args.length === 4) {
        const [x, y, w, h] = args, t = this.getTransform();
        __morphSprites.get(this.canvas)?.push({ x: (x + w / 2) * t.a + t.e, y: (y + h / 2) * t.d + t.f, alpha: this.globalAlpha });
      }
      return draw.call(this, image, ...args);
    };
  });
  page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#sound');
  await page.locator('#sound-layer.is-open').waitFor(); await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
  await page.waitForTimeout(600);
  await page.locator('.sound-track-panel').screenshot({ path: `${out}/idle-constellations.png` });
  const sequence = await page.evaluate(async () => {
    const button = document.querySelector('[data-sound-track="windowlight"]');
    const copy = button.querySelector('.sound-track-copy').getBoundingClientRect();
    const center = { x: (copy.left + copy.right) / 2, y: (copy.top + copy.bottom) / 2 };
    const sources = [...button.querySelectorAll('.sound-constellation-star')].map(el => {
      const p = new DOMPoint().matrixTransform(el.getScreenCTM());
      return { x: p.x - center.x, y: p.y - center.y };
    });
    button.focus();
    const canvas = button.querySelector('canvas'), stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1800000 });
    const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
    const stopped = new Promise(resolve => { recorder.onstop = resolve; }); recorder.start();
    const targets = [45, 280, 650, 1050, 1300, 1510, 2200, 3400], frames = [], started = performance.now();
    await new Promise(resolve => {
      const observe = () => {
        const elapsed = performance.now() - started;
        if (elapsed >= targets[frames.length]) {
          const sprites = (__morphSprites.get(canvas) || []).filter(p => p.alpha > .02).map(p => ({
            x: p.x / canvas.width * parseFloat(canvas.style.width) - parseFloat(canvas.style.width) / 2,
            y: p.y / canvas.height * parseFloat(canvas.style.height) - parseFloat(canvas.style.height) / 2,
          }));
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          frames.push({ elapsed, ...canvas.dataset, sprites, pixels: pixels.filter((v, i) => i % 4 === 3 && v > 25).length, image: canvas.toDataURL() });
        }
        if (frames.length === targets.length) resolve(); else requestAnimationFrame(observe);
      }; requestAnimationFrame(observe);
    });
    recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
    return { sources, frames, video: Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())) };
  });
  fs.writeFileSync(`${out}/constellation-to-title.webm`, Buffer.from(sequence.video));
  for (const [i, frame] of sequence.frames.entries()) fs.writeFileSync(`${out}/phase-${i}.png`, Buffer.from(frame.image.split(',')[1], 'base64'));
  report.frames = sequence.frames.map(({ image, sprites, ...frame }) => ({ ...frame, sprites }));
  const [first, , middle, , nodes, trace, , final] = sequence.frames;
  if (!before) {
    assert.equal(first.morphPhase, 'constellation-to-letter-nodes');
    assert.equal(Number(first.linePhase), 0);
    assert.equal(Number(first.sourceStars), sequence.sources.length);
    const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    const originError = Math.max(...sequence.sources.map(s => Math.min(...first.sprites.map(p => distance(s, p)))));
    assert(originError < 4, `Original SVG stars must survive the handoff: ${originError}px`);
    assert.equal(Number(middle.linePhase), 0, 'Do not draw letters during the star flight');
    assert(Number(middle.morphProgress) > .4 && Number(middle.morphProgress) < .7);
    assert.equal(nodes.morphPhase, 'letter-nodes'); assert.equal(Number(nodes.linePhase), 0);
    assert.equal(trace.morphPhase, 'tracing'); assert.equal(trace.cometVisible, 'true');
    assert.equal(final.morphPhase, 'settled'); assert.equal(Number(final.connectionProgress), 1);
    assert(sequence.frames.every(f => f.pixels > 10), 'No blank frame during the sampled transition');
    const spread = list => Math.max(...list.map(p => p.x)) - Math.min(...list.map(p => p.x));
    assert(spread(middle.sprites) > spread(first.sprites) + 25, 'Stars physically fan out');
    report.checks.push({ originalStarCount: sequence.sources.length, originError, continuousFlight: true, traceAfterLanding: true });
    for (const track of ['moonbook', 'snowafter', 'trueend']) {
      await page.locator(`[data-sound-track="${track}"]`).focus();
      await page.locator(`[data-sound-track="${track}"].is-morph-settled`).waitFor();
    }
    const moon = page.locator('[data-sound-track="moonbook"]');
    await moon.click();
    await page.waitForFunction(() => GaiaOpeningAudio.getPlaybackState().track === 'moonbook' && GaiaOpeningAudio.getPlaybackState().playing);
    await moon.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.is-morph-focus').count(), 1);
    // Changing language during the flight must not leave a second animation,
    // lose the selected audio track, or skip the localized title's final ink.
    await page.evaluate(() => GaiaI18n.set('zh-CN'));
    await page.locator('.is-morph-focus.is-morph-settled').waitFor();
    assert.equal(await page.locator('.is-morph-focus').count(), 1);
    assert.equal(await page.evaluate(() => GaiaOpeningAudio.getPlaybackState().track), 'moonbook');
    await page.evaluate(() => GaiaI18n.set('ja'));
    await page.mouse.move(10, 10); await page.locator('#sound-close').focus();
    await page.locator('[data-sound-track="windowlight"]').hover();
    await page.waitForFunction(() => document.querySelector('[data-sound-track="windowlight"]').classList.contains('is-morph-focus'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await moon.focus(); await page.waitForFunction(() => document.querySelector('[data-sound-track="moonbook"] canvas').dataset.morphPhase === 'settled');
    const frame = await moon.locator('canvas').getAttribute('data-frame'); await page.waitForTimeout(250);
    assert.equal(await moon.locator('canvas').getAttribute('data-frame'), frame);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.sound-track-morph-canvas:visible').count(), 0, 'Keep compact mobile layout');
    await page.locator('[data-sound-track="trueend"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/mobile.png` });
    report.checks.push({ keyboard: true, hover: true, reducedMotion: true, mobileUnchanged: true, nativeTrackSelection: true, languageSwitchDuringFlight: true });
  }
  const sheet = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await sheet.setContent('<body style="margin:0;padding:20px;background:#05121e;color:#bdded6;font:14px serif"><main></main></body>');
  await sheet.evaluate(frames => {
    for (const frame of frames) {
      const row = document.createElement('div'); row.style.cssText = 'height:92px;display:flex;align-items:center;gap:30px;border-bottom:1px solid #24414a';
      const label = document.createElement('span'); label.style.width = '80px'; label.textContent = (frame.elapsed / 1000).toFixed(2) + 's';
      const image = new Image(); image.src = frame.image; image.style.cssText = 'max-width:940px;max-height:84px;object-fit:contain';
      row.append(label, image); document.querySelector('main').append(row);
    }
  }, sequence.frames);
  await sheet.screenshot({ path: `${out}/sequence.png` });
  assert.deepEqual(report.errors, []); report.status = before ? 'reference-reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure }));
}
