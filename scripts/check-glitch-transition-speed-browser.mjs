import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import "../novel-story-data.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/glitch-transition-speed");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const [width, reduced] of [[1440, false], [390, false], [390, true]]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.addInitScript(({ version, reduced }) => {
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({
        storyVersion: version, stepId: "welcome_chat_095", reachedSceneIds: ["welcome_chat"], viewed: {},
        metCharacters: { mizuha: true, amane: true, sakuya: true }, evesRoute: [], observationOrder: "LOCAL_FIRST",
        editorialChoice: null, reflectionIds: [], resultTone: null, demoInterest: "太古の海", audio: { muted: true, volume: 0 },
        readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "glitch-speed-qa",
      }));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: reduced }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    }, { version: globalThis.GAIA_NOVEL_STORY.storyVersion, reduced });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, reduced, message: error.message }));
    await page.goto(`${base}/?preview=glitch-speed#story`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-staff-roll"));
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
    await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const trace = globalThis.__glitchSpeedTrace = { phases: [], delays: [], switchStartedAt: null };
      const nativeSetTimeout = window.setTimeout;
      window.setTimeout = function (callback, delay, ...args) {
        if (["holdBeforeTrueEnd", "switchToTrueEnd", "holdFullBackground", "completeTrueEndEntry"].includes(callback?.name)) {
          trace.delays.push({ name: callback.name, delay });
        }
        if (callback?.name === "switchToTrueEnd") return nativeSetTimeout.call(this, (...parameters) => {
          trace.switchStartedAt = performance.now(); callback(...parameters);
        }, delay, ...args);
        return nativeSetTimeout.call(this, callback, delay, ...args);
      };
      const observer = new MutationObserver(() => {
        const phase = layer.dataset.trueEndTransitionPhase;
        if (phase && trace.phases.at(-1)?.phase !== phase) trace.phases.push({ phase, time: performance.now() });
        if (phase === "complete") {
          observer.disconnect(); window.setTimeout = nativeSetTimeout;
        }
      });
      observer.observe(layer, { attributes: true, attributeFilter: ["data-true-end-transition-phase"] });
      // Exercise the real final-action handler without replaying the full credit roll.
      document.querySelector(".novel-staff-roll-finale button").click();
    });
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.trueEndTransitionPhase === "complete", null, { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector(".true-end-message")?.textContent.length > 0);
    const trace = await page.evaluate(() => ({ ...globalThis.__glitchSpeedTrace,
      veils: document.querySelectorAll(".novel-staff-roll-transition-veil").length,
      trueEnd: document.querySelector("#novel-layer").classList.contains("is-true-end"),
    }));
    assert.equal(trace.veils, 0);
    assert.equal(trace.trueEnd, true);
    if (!reduced) {
      const time = phase => trace.phases.find(entry => entry.phase === phase)?.time;
      const cover = time("holding") - time("covering");
      const hold = trace.switchStartedAt - time("holding");
      const reveal = time("background") - time("revealing");
      const background = time("complete") - time("background");
      const choreography = cover + hold + reveal + background;
      assert(cover >= 190 && cover < 350, `Cover timing: ${cover}`);
      assert(hold >= 230 && hold < 400, `Hold timing: ${hold}`);
      assert(reveal >= 875 && reveal < 1100, `Reveal timing: ${reveal}`);
      assert(background >= 95 && background < 250, `Background timing: ${background}`);
      assert(choreography >= 1430 && choreography < 1850, `Expected 1485ms, got ${choreography}`);
      trace.durations = { cover, hold, reveal, background, choreography };
    } else {
      assert(!trace.phases.some(entry => ["holding", "background"].includes(entry.phase)), "Reduced motion must bypass the animated waits");
    }
    report.checks.push({ width, reduced, ...trace });
    console.log(`PASS ${width}/${reduced ? "reduced motion" : "normal"}: real transition ${trace.durations?.choreography.toFixed(1) || "bypassed"}ms, destination ready and veil removed`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
