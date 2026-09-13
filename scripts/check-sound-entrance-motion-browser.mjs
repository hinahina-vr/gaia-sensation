import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/sound-entrance-motion");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let currentPage;
try {
  for (const width of [1440, 390, 3840]) {
    const height = width === 3840 ? 2160 : width === 390 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width === 390 });
    await context.addInitScript(() => {
      localStorage.setItem("gaia-senseware-bgm-volume", "0.23");
      globalThis.__soundLongTasks = [];
      new PerformanceObserver(list => {
        globalThis.__soundLongTasks.push(...list.getEntries().map(entry => ({ time: entry.startTime, duration: entry.duration })));
      }).observe({ type: "longtask", buffered: true });
    });
    const page = await context.newPage();
    currentPage = page;
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=sound-entrance-motion`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.activeElement?.id === "gaia-opening-sound-on"
      && document.querySelector("#gaia-opening-sound-atmosphere")?.dataset.state === "running");
    await page.waitForTimeout(600);
    const read = () => page.evaluate(() => {
      const canvas = document.querySelector("#gaia-opening-sound-atmosphere");
      const context = canvas.getContext("2d");
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      let painted = 0;
      for (let i = 3; i < pixels.length; i += 16) {
        if (pixels[i]) painted += 1;
        hash = Math.imul(hash ^ pixels[i], 16777619) >>> 0;
      }
      const rect = document.querySelector(".gaia-opening-sound-dialog").getBoundingClientRect();
      return {
        state: canvas.dataset.state, frames: Number(canvas.dataset.frames), particles: Number(canvas.dataset.particles),
        hash, painted, width: canvas.width, height: canvas.height, pointerEvents: getComputedStyle(canvas).pointerEvents,
        sceneAnimation: getComputedStyle(document.querySelector(".gaia-opening-sound-scene > span")).animationName,
        centered: Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 2 && Math.abs(rect.y + rect.height / 2 - innerHeight / 2) < 2,
        audio: globalThis.GaiaOpeningAudio.getState(), now: performance.now(),
      };
    });
    const first = await read();
    await page.screenshot({ path: path.join(output, `${width}-entrance.jpg`), type: "jpeg", quality: 90 });
    await page.waitForTimeout(1400);
    const later = await read();
    assert.equal(first.state, "running");
    assert(first.painted > 100, "Atmosphere canvas is blank");
    assert.notEqual(first.hash, later.hash, "Particles are a static image");
    assert(later.frames > first.frames + 10, "Atmosphere did not animate");
    assert((later.frames - first.frames) / ((later.now - first.now) / 1000) <= 31, "Atmosphere exceeds its 30 FPS budget");
    assert(first.width * first.height <= 1100000, "Canvas exceeds its pixel budget");
    assert(first.centered);
    assert.equal(first.pointerEvents, "none");
    assert.equal(first.sceneAnimation, "sound-scene-breathe");
    assert.equal(first.audio.muted, true, "Ambient light must not autoplay sound");

    // In-page synthetic visibility change exercises pause/resume without relying
    // on headless Chrome's window-occlusion heuristics.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await read();
    await page.waitForTimeout(250);
    assert.equal((await read()).frames, hidden.frames, "Hidden scene still renders");
    assert.equal(hidden.state, "paused");
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    assert.equal((await read()).state, "running");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector("#gaia-opening-sound-atmosphere").dataset.state === "reduced");
    const reduced = await read();
    await page.waitForTimeout(350);
    const reducedLater = await read();
    assert.equal(reducedLater.hash, reduced.hash, "Reduced-motion scene moves");
    assert.equal(reducedLater.frames, reduced.frames);
    assert.equal(reduced.sceneAnimation, "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => document.querySelector("#gaia-opening-sound-atmosphere").dataset.state === "running");

    // Resizing preserves centering and a bounded drawing surface.
    await page.setViewportSize({ width: width === 390 ? 320 : 1280, height: width === 390 ? 653 : 720 });
    await page.waitForTimeout(160);
    const resized = await read();
    assert(resized.centered);
    assert(resized.width * resized.height <= 1100000);
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);

    const interactionStart = await page.evaluate(() => performance.now());
    const focusMs = await page.evaluate(async () => {
      const samples = [];
      for (const id of ["gaia-opening-sound-off", "gaia-opening-volume", "gaia-opening-sound-on"]) {
        const started = performance.now();
        document.getElementById(id).focus();
        await new Promise(resolve => requestAnimationFrame(resolve));
        samples.push(performance.now() - started);
      }
      return samples;
    });
    const longTasks = await page.evaluate(start => globalThis.__soundLongTasks.filter(entry => entry.time >= start), interactionStart);
    assert(Math.max(...focusMs) < 200, "Ambient motion delayed keyboard focus");
    await page.locator("#gaia-opening-sound-off").click();
    await page.waitForFunction(() => document.querySelector("#gaia-opening-sound-modal").hidden);
    const stopped = await read();
    await page.waitForTimeout(250);
    const stoppedLater = await read();
    assert.equal(stopped.state, "stopped");
    assert.equal(stoppedLater.frames, stopped.frames, "Sound atmosphere survives closing");
    assert.equal(stopped.audio.muted, true);
    report.checks.push({ width, first, later, hidden, reduced, resized, stopped, focusMs, longTasks });
    console.log(`PASS ${width}: real moving pixels, centered layout, visibility/reduced-motion/exit lifecycle`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  await currentPage?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
