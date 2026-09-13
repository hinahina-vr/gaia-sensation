import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/ending-whiteout/exit");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440, 390]) for (const reduced of [false, true]) {
    const label = `${width}-${reduced ? "reduced" : "motion"}`;
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "reduce", hasTouch: width === 390 });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ label, message: error.message }));
    await page.goto(`${base}/?preview=ending-whiteout`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaModeLoader);
    await page.evaluate(() => GaiaModeLoader.load("story"));
    await page.waitForFunction(() => globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY);
    await page.evaluate(() => {
      const state = { ...GaiaNovel.getState(), storyVersion: GAIA_NOVEL_STORY.storyVersion,
        stepId: "welcome_chat_095", reachedSceneIds: ["welcome_chat"], clear: false, archivesUnlocked: false,
        metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0 } };
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(state));
      localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{ progress: state, savedAt: Date.now(), meta: { title: "Whiteout QA", excerpt: state.stepId } }]));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await page.goto(`${base}/story?preview=ending-whiteout`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "complete");
    await page.locator(".novel-staff-roll-finale button").click();
    await page.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.entryPhase === "ready");
    for (let scene = 0; scene < 3; scene++) {
      await page.waitForFunction(() => !document.querySelector(".true-end-shell").classList.contains("is-scene-separating"));
      const before = await page.locator(".true-end-shell").getAttribute("data-scene");
      await page.locator(".true-end-skip-button").click();
      if (scene < 2) await page.waitForFunction(before => document.querySelector(".true-end-shell").dataset.scene !== before, before);
    }
    await page.locator(".true-end-finale:not([hidden])").waitFor({ state: "visible" });
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.evaluate(() => {
      window.__whiteoutTrace = [];
      window.__whiteoutReturns = 0;
      addEventListener("gaia:return-to-intro", () => window.__whiteoutReturns++);
      document.querySelector(".true-end-finale button").addEventListener("click", () => {
        const start = performance.now();
        const sample = () => {
          const veil = document.querySelector(".true-end-exit-veil");
          const intro = document.querySelector("#intro-layer");
          const style = veil && getComputedStyle(veil);
          window.__whiteoutTrace.push({ time: performance.now() - start, phase: veil?.dataset.phase || "complete",
            opacity: style ? Number(style.opacity) : 0, background: style?.backgroundColor,
            before: veil && getComputedStyle(veil, "::before").content,
            after: veil && getComputedStyle(veil, "::after").content,
            introReady: Boolean(intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false"),
            novelVisible: document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "false",
            veils: document.querySelectorAll(".true-end-exit-veil").length });
          if (veil || window.__whiteoutTrace.length < 2) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, { once: true });
    });
    await page.locator(".true-end-finale button").click();
    await page.locator(".true-end-finale button").evaluate(button => button.click());
    assert.equal(await page.locator(".true-end-exit-veil").count(), 1, "Double click created multiple curtains");
    if (!reduced) {
      await page.waitForFunction(() => {
        const veil = document.querySelector(".true-end-exit-veil");
        return veil?.dataset.phase === "covering" && Number(getComputedStyle(veil).opacity) > .35;
      });
      await page.screenshot({ path: path.join(output, `${label}-dissolve.jpg`), type: "jpeg", quality: 85 });
      await page.waitForFunction(() => document.querySelector(".true-end-exit-veil")?.dataset.phase === "white");
      await page.screenshot({ path: path.join(output, `${label}-white.jpg`), type: "jpeg", quality: 85 });
    }
    await page.waitForFunction(() => !document.querySelector(".true-end-exit-veil"), null, { timeout: 15_000 });
    await page.waitForTimeout(50);
    const trace = await page.evaluate(() => window.__whiteoutTrace);
    const covering = trace.filter(frame => frame.phase === "covering");
    const revealing = trace.filter(frame => frame.phase === "revealing");
    assert(covering.length > 3 && revealing.length > 3, `${label}: missing smooth transition frames`);
    assert(covering.some(frame => frame.opacity > .1 && frame.opacity < .9));
    assert(covering.every((frame, i) => !i || frame.opacity >= covering[i - 1].opacity - .001), "Cover flashes instead of rising continuously");
    assert(revealing.every((frame, i) => !i || frame.opacity <= revealing[i - 1].opacity + .001), "Reveal flashes instead of dissolving continuously");
    assert(trace.every(frame => ["covering", "white", "revealing", "complete"].includes(frame.phase)), "An old flash/black phase remains");
    assert(trace.every(frame => !frame.veils || frame.background === "rgb(255, 254, 250)"));
    assert(trace.every(frame => !frame.veils || frame.before === "none" && frame.after === "none"), "Exit still draws interference layers");
    assert(covering.every(frame => frame.novelVisible), "Story disappeared before whiteout completed");
    assert(revealing.every(frame => frame.introReady), "Destination revealed before GAIA was ready");
    assert.equal(await page.evaluate(() => window.__whiteoutReturns), 1, "Exit fired more than once");
    assert.equal(await page.locator("#novel-layer").getAttribute("aria-hidden"), "true");
    assert.match((await page.locator("#intro-title").innerText()).replaceAll(/\s/g, ""), /^GAIASENSEWARE$/);
    assert(await page.locator("#intro-title").isVisible());
    const white = trace.filter(frame => frame.phase === "white");
    if (!reduced) {
      assert(covering.at(-1).time >= 2250, "Whiteout is too fast");
      assert(white.length > 0 && white.every(frame => frame.opacity === 1), "Whiteout never fully covered the screen");
      assert(white.at(-1).time - white[0].time >= 450, "White hold is missing");
    }
    await page.screenshot({ path: path.join(output, `${label}-gaia.jpg`), type: "jpeg", quality: 85 });
    report.checks.push({ label, trace, passed: true });
    console.log(`PASS ${label}: monotonic whiteout, ready-gated GAIA reveal, no flashes, one exit and clean removal`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
