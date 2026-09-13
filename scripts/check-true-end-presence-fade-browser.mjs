import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const before = process.argv.includes("--before");
const lifecycleOnly = process.argv.includes("--lifecycle-only");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve("artifacts/true-end-presence-2026-09-09/" + (before ? "before" : lifecycleOnly ? "after-lifecycle" : "after"));
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", before, checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
async function boot(context) {
  page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.addInitScript(() => {
    globalThis.GAIA_BUILD_PROFILE = "debug";
    const progress = { storyVersion: 13, stepId: "welcome_chat_094", reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null, metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "presence-qa" };
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
    const uniformNames = new WeakMap(), uniforms = new WeakMap();
    const proto = WebGLRenderingContext.prototype;
    const getUniformLocation = proto.getUniformLocation, uniform1f = proto.uniform1f, drawArrays = proto.drawArrays;
    globalThis.__presenceFrames = [];
    globalThis.__presenceCaptures = [];
    globalThis.__capturePresence = false;
    proto.getUniformLocation = function(program, name) {
      const location = getUniformLocation.call(this, program, name);
      if (location) uniformNames.set(location, name);
      return location;
    };
    proto.uniform1f = function(location, value) {
      let values = uniforms.get(this);
      if (!values) uniforms.set(this, values = {});
      values[uniformNames.get(location)] = value;
      return uniform1f.call(this, location, value);
    };
    proto.drawArrays = function(...args) {
      const result = drawArrays.apply(this, args);
      if (this.canvas.classList.contains("true-end-universe")) {
        const values = uniforms.get(this) || {};
        const pixels = new Uint8Array(8 * 8 * 4);
        this.readPixels(Math.floor(this.canvas.width / 2), Math.floor(this.canvas.height / 2), 8, 8, this.RGBA, this.UNSIGNED_BYTE, pixels);
        const smooth = (edge0, edge1, v) => { const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t); };
        const mix = values.u_speaker_mix;
        globalThis.__presenceFrames.push({ at: performance.now(), from: values.u_speaker_from, to: values.u_speaker_to, mix, fromGain: values.u_speaker_from_gain * (1 - smooth(0, 0.58, mix)), toGain: smooth(0.42, 1, mix), signal: values.u_signal, pixels: [...pixels], step: document.querySelector(".true-end-shell")?.dataset.step });
        const bucket = Math.floor(mix * 4);
        if (__capturePresence && !__presenceCaptures.some(item => item.bucket === bucket)) {
          __presenceCaptures.push({ bucket, mix, png: this.canvas.toDataURL("image/png") });
        }
        if (__presenceFrames.length > 2000) __presenceFrames.shift();
      }
      return result;
    };
  });
  await page.goto(base + "/?preview=presence-fade-qa#story", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
  await page.evaluate(() => {
    const original = GaiaTrueEndWebGL;
    globalThis.GaiaTrueEndWebGL = Object.freeze({ ...original, create(options) {
      const runtime = original.create(options);
      globalThis.__presenceRuntime = runtime;
      return runtime;
    } });
  });
  await page.locator("#novel-jump-button").click();
  await page.locator('.novel-jump-item[data-scene-id="true-end"]').click();
  await page.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.step === "beyond_01_001" && !document.querySelector(".true-end-shell")?.classList.contains("is-scene-separating"));
  await page.waitForFunction(() => document.querySelector(".true-end-universe")?.dataset.webglPresenceState === "steady");
  assert.equal(await page.locator(".true-end-universe").getAttribute("data-webgl-state"), "active");
}
async function goTo(id) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (await page.locator(".true-end-shell").getAttribute("data-step") === id) {
      await page.evaluate(() => {
        const s = document.querySelector(".true-end-shell"), dialogue = document.querySelector(".true-end-dialogue");
        for (let i = 0; i < 12; i++) {
          if (s.classList.contains("is-revealing")) dialogue.click();
          const [at, count] = s.dataset.messagePage.split("/").map(Number);
          if (at >= count) break;
          dialogue.click();
        }
      });
      return;
    }
    await page.locator(".true-end-dialogue").evaluate(node => node.click());
    await page.waitForTimeout(110);
  }
  throw new Error("Could not reach " + id);
}
async function transition({ width, fromId, toId, stall = 0, label, same = false }) {
  await goTo(fromId);
  await page.waitForFunction(() => document.querySelector(".true-end-universe")?.dataset.webglPresenceState === "steady");
  await page.screenshot({ path: path.join(output, width + "-" + label + "-start.png") });
  const start = await page.evaluate(stall => {
    __presenceFrames.length = 0;
    __presenceCaptures.length = 0;
    __capturePresence = true;
    const began = performance.now();
    document.querySelector(".true-end-dialogue").click();
    // Repeated input during a speaker transition must not skip the fade/line.
    if (document.querySelector(".true-end-universe").dataset.webglPresenceState === "fading") {
      for (let i = 0; i < 4; i++) document.querySelector(".true-end-dialogue").click();
    }
    // Reproduce a long foreground frame at the exact dialogue transition.
    if (stall) { const until = performance.now() + stall; while (performance.now() < until) {} }
    return began;
  }, stall);
  await page.waitForFunction(id => document.querySelector(".true-end-shell")?.dataset.step === id, toId, { timeout: 12000 });
  await page.screenshot({ path: path.join(output, width + "-" + label + "-end.png") });
  const frames = await page.evaluate(start => __presenceFrames.filter(f => f.at >= start), start);
  const captures = await page.evaluate(() => { __capturePresence = false; return __presenceCaptures; });
  for (const shot of captures) fs.writeFileSync(path.join(output, width + "-" + label + "-gl-" + shot.bucket + ".png"), Buffer.from(shot.png.split(",")[1], "base64"));
  const fading = frames.filter(f => f.fromGain > 0.001 && f.fromGain < 0.999);
  const first = frames[0];
  const pixelColors = new Set(frames.map(f => f.pixels.join(",")));
  const result = { width, label, fromId, toId, stall, firstGain: first?.fromGain, intermediateFrames: fading.length, distinctPixelSamples: pixelColors.size, frames };
  report.checks.push(result);
  console.log(JSON.stringify({ ...result, frames: frames.length }));
  if (same) assert(frames.every(f => f.mix >= 0.9999), label + ": same speaker blinked");
  else if (before && stall) assert(fading.length <= 1 && (first?.fromGain ?? 0) < 0.05, "Expected the reported one-frame disappearance to reproduce");
  else {
    assert(fading.length >= 3, label + ": outgoing character skipped its fade");
    assert(first.fromGain > 0.9, label + ": outgoing character vanished on the first rendered frame");
    assert(pixelColors.size >= 4, label + ": actual WebGL output did not animate");
    if (!before) assert(frames.filter(f => f.mix < 0.9999).every(f => f.step === fromId), label + ": next dialogue committed during fade");
    const completed = await page.locator(".true-end-universe").getAttribute("data-webgl-presence-completed-at");
    if (!before) assert(Number(completed) >= frames.find(f => f.mix >= 0.9999).at - 1, label + ": dialogue completed before rendered fade");
  }
}
async function lifecycle(width) {
  const sharing = await page.evaluate(async () => {
    const runtime = __presenceRuntime;
    await runtime.setPresence("lou", { immediate: true });
    const first = runtime.setPresence("mizuha", { signal: "repeat-1" });
    const repeated = runtime.setPresence("mizuha", { signal: "repeat-2" });
    let resolved = false;
    first.then(() => { resolved = true; });
    await new Promise(resolve => setTimeout(resolve, 80));
    const resolvedEarly = resolved;
    await Promise.all([first, repeated]);
    return { shared: first === repeated, resolvedEarly };
  });
  assert(sharing.shared && !sharing.resolvedEarly, "Repeated presence did not wait for the same rendered fade");
  const visibility = await page.evaluate(async () => {
    const pending = __presenceRuntime.setPresence("amane");
    let finished = false;
    pending.then(() => { finished = true; });
    await new Promise(resolve => setTimeout(resolve, 80));
    const descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    const frameCount = __presenceFrames.length;
    await new Promise(resolve => setTimeout(resolve, 650));
    const hiddenResult = { finished, frameDelta: __presenceFrames.length - frameCount };
    if (descriptor) Object.defineProperty(document, "hidden", descriptor);
    else delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
    await pending;
    return hiddenResult;
  });
  assert(!visibility.finished && visibility.frameDelta === 0, "Hidden state consumed the fade without drawing");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(async () => {
    const canvas = document.querySelector(".true-end-universe");
    const frame = Number(canvas.dataset.webglFrame);
    const result = await __presenceRuntime.setPresence("visitor");
    return { result, frames: Number(canvas.dataset.webglFrame) - frame, mix: Number(canvas.dataset.webglPresenceMix) };
  });
  assert(!reduced.result.changed && !reduced.result.cancelled && reduced.frames >= 1 && reduced.mix === 1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".true-end-universe").getAttribute("data-webgl-presence-mix"), "1.0000", "Motion preference toggle replayed an old fade");
  const lossSupported = await page.evaluate(() => {
    const gl = document.querySelector(".true-end-universe").getContext("webgl");
    globalThis.__lossExtension = gl.getExtension("WEBGL_lose_context");
    if (!__lossExtension) return false;
    globalThis.__lossResult = null;
    __presenceRuntime.setPresence("sakuya").then(result => { __lossResult = result; });
    __lossExtension.loseContext();
    return true;
  });
  assert(lossSupported, "Context loss testing extension is unavailable");
  await page.waitForFunction(() => document.querySelector(".true-end-universe")?.dataset.webglState === "lost" && __lossResult);
  assert((await page.evaluate(() => __lossResult)).cancelled, "Lost WebGL left the dialogue waiting");
  assert((await page.evaluate(() => __presenceRuntime.setPresence("lou"))).cancelled);
  await page.evaluate(() => __lossExtension.restoreContext());
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".true-end-universe");
    const indices = { narrator: 0, system: 1, lou: 2, mizuha: 3, amane: 4, sakuya: 5, visitor: 6 };
    const rendered = __presenceFrames.at(-1);
    return canvas?.dataset.webglState === "active" && canvas.dataset.webglPresenceCompletedAt && rendered?.mix === 1 && rendered.to === indices[canvas.dataset.webglSpeaker];
  }, null, { timeout: 10000 });
  await page.screenshot({ path: path.join(output, width + "-context-restored.png") });
  const restored = await page.evaluate(() => {
    const shell = document.querySelector(".true-end-shell"), canvas = document.querySelector(".true-end-universe");
    return { speakerMatches: shell.dataset.speaker === canvas.dataset.webglSpeaker, frame: Number(canvas.dataset.webglFrame), fallback: canvas.classList.contains("is-fallback") };
  });
  assert(restored.speakerMatches && restored.frame > 0 && !restored.fallback);
  const destroyed = await page.evaluate(async () => {
    const canvas = document.querySelector(".true-end-universe");
    const pending = __presenceRuntime.setPresence("mizuha");
    __presenceRuntime.destroy();
    const result = await pending, frame = Number(canvas.dataset.webglFrame);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { result, frameDelta: Number(canvas.dataset.webglFrame) - frame };
  });
  assert(destroyed.result.cancelled && destroyed.frameDelta === 0);
  report.checks.push({ width, label: "lifecycle", sharing, simulatedVisibility: visibility, reduced, contextRestored: restored, destroyed });
  console.log("PASS " + width + "px: repeated request, simulated hidden/resume, reduced motion, real WebGL context loss/restore and destroy");
}
async function section(width) {
  const fromStep = await page.locator(".true-end-shell").getAttribute("data-step");
  await page.evaluate(() => {
    const shell = document.querySelector(".true-end-shell");
    globalThis.__sectionFrames = [];
    const sample = () => {
      const canvas = document.querySelector(".true-end-universe");
      __sectionFrames.push({ phase: shell.dataset.sectionTransitionPhase, step: shell.dataset.step, mix: Number(canvas.dataset.webglPresenceMix), state: canvas.dataset.webglPresenceState });
      if (shell.dataset.sectionTransitionPhase !== "idle" || __sectionFrames.length === 1) requestAnimationFrame(sample);
    };
    document.querySelector(".true-end-skip-button").click();
    requestAnimationFrame(sample);
  });
  await page.waitForFunction(() => {
    const shell = document.querySelector(".true-end-shell");
    return shell?.dataset.scene === "electronic-civilization" && shell.dataset.sectionTransitionPhase === "idle";
  }, null, { timeout: 15000 });
  const result = await page.evaluate(() => {
    const shell = document.querySelector(".true-end-shell");
    return { frames: __sectionFrames, completed: Number(shell.dataset.sectionTransitionCompletedAt), committed: Number(shell.dataset.messageCommittedAt), step: shell.dataset.step };
  });
  assert(result.frames.some(f => f.phase === "ready" && f.mix === 1 && f.state === "steady"));
  assert(result.frames.some(f => f.phase === "reveal"));
  assert(result.frames.filter(f => f.phase !== "idle").every(f => f.step === fromStep), "Section dialogue changed under the curtain");
  assert(result.committed >= result.completed);
  await page.screenshot({ path: path.join(output, width + "-section-ready.png") });
  report.checks.push({ width, label: "section", ...result });
  console.log("PASS " + width + "px: section blackout, presence prepared before reveal and dialogue committed after reveal");
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: "no-preference" });
    if (width < 600) await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 2 });
      Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 2 });
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await boot(context);
    if (lifecycleOnly) {
      await lifecycle(width);
      await context.close();
      continue;
    }
    await transition({ width, fromId: "beyond_01_001", toId: "beyond_01_002", label: "aiva-normal" });
    if (!before) await transition({ width, fromId: "beyond_01_002", toId: "beyond_01_003", label: "same-narrator", same: true });
    await transition({ width, fromId: "beyond_01_004", toId: "beyond_01_005", stall: 650, label: "lou-stalled" });
    if (!before) {
      await transition({ width, fromId: "beyond_01_005", toId: "beyond_01_add_016", label: "amane-normal" });
      await transition({ width, fromId: "beyond_01_007", toId: "beyond_01_008", label: "mizuha-normal" });
      await transition({ width, fromId: "beyond_01_add_021", toId: "beyond_01_add_022", label: "sakuya-normal" });
      await transition({ width, fromId: "beyond_01_add_023", toId: "beyond_01_add_024", label: "visitor-normal" });
      await transition({ width, fromId: "beyond_01_add_025", toId: "beyond_01_add_026", label: "narrator-normal" });
      await section(width);
      await lifecycle(width);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? "reproduced" : "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
