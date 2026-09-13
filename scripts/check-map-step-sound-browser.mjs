import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/map-step-sound-2026-09-09/${before ? "before" : "after"}`);
const testedUiSound = before ? execFileSync("git", ["show", "HEAD:ui-sound.js"]) : fs.readFileSync("ui-sound.js");
const report = { status: "running", environment: "Local Chrome, real Web Audio oscillators/output analyser; not a mocked AudioContext or physical speaker test",
  before, baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: Object.fromEntries(["ui-sound.js","index.html"].map(file => [file,createHash("sha256").update(file === "ui-sound.js" ? testedUiSound : fs.readFileSync(file)).digest("hex")])), checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width,height] of before ? [[1920,1080]] : [[1920,1080],[390,844]]) {
    const context = await browser.newContext({ viewport: { width,height }, hasTouch: width <= 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.soundTrace = [];
      window.clickTrace = [];
      window.uiAudioAnalysers = [];
      const createOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function(...args) {
        const oscillator = createOscillator.apply(this,args);
        const stack = new Error().stack;
        if (!stack.includes("ui-sound.js")) return oscillator;
        const cue = stack.match(/play(Hover|Confirm|Back)/)?.[1] || "Unknown";
        const start = oscillator.start;
        oscillator.start = function(...startArgs) {
          soundTrace.push({ cue, at: performance.now(), scheduledAt: startArgs[0] });
          return start.apply(this,startArgs);
        };
        return oscillator;
      };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function(destination,...args) {
        const result = connect.call(this,destination,...args);
        if (destination === this.context.destination && new Error().stack.includes("ui-sound.js")) {
          const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
          connect.call(this,analyser); uiAudioAnalysers.push(analyser);
        }
        return result;
      };
      document.addEventListener("click", event => {
        const button = event.target.closest?.("button");
        if (button) clickTrace.push({ trusted: event.isTrusted, label: button.getAttribute("aria-label"), text: button.textContent.trim(), at: performance.now() });
      }, true);
      window.resetSoundTrace = () => { soundTrace.length = 0; clickTrace.length = 0; window.uiAudioPeak = 0; };
      const sample = () => {
        for (const analyser of uiAudioAnalysers) {
          const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
          window.uiAudioPeak = Math.max(window.uiAudioPeak || 0, ...samples.map(Math.abs));
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    if (before) await context.route(`${base}/ui-sound.js*`, route => route.fulfill({ body: testedUiSound, contentType: "text/javascript" }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?exhibit=28#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaEstatExhibits && globalThis.GaiaMapDemo && document.documentElement.dataset.gaiaAppReady === "true");
    const select = async number => {
      await page.evaluate(number => {
        GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
        GaiaMapCategories.buttons().find(button => Number(button.textContent) === number).click();
        GaiaLiveExhibits.pausePoiAutoplay();
      },number);
      await page.waitForFunction(number => document.querySelector("#japan-mode-number").textContent.trim() === String(number).padStart(2,"0")
        && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), number);
    };
    await select(28);
    await page.evaluate(() => { GaiaOpeningAudio.setVolume(.2); GaiaOpeningAudio.setMuted(false); GaiaOpeningAudio.setMixGain(0); });
    const readTrace = async () => page.evaluate(() => ({ tones: soundTrace.slice(), clicks: clickTrace.slice(), peak: uiAudioPeak }));
    const activate = async (label,selector,expected,method = "click") => {
      const button = page.locator(selector);
      if (method === "click") await button.hover();
      if (method === "Enter" || method === "Space") await button.focus();
      await page.waitForTimeout(380); // Reproduce a pointer click after dwelling on the arrow.
      await page.evaluate(() => resetSoundTrace());
      if (method === "tap") await button.tap();
      else if (method === "Enter" || method === "Space") await button.press(method);
      else await button.click();
      await page.waitForTimeout(280);
      const result = await readTrace();
      const confirms = result.tones.filter(tone => tone.cue === "Confirm").length / 2;
      const hoverCues = result.tones.filter(tone => tone.cue === "Hover").length / 2;
      report.checks.push({ width,label,method,confirms,hoverCues,...result });
      assert.equal(Number(await page.locator("#japan-mode-number").textContent()),expected, `${label}: exhibit advances once`);
      if (before) assert(confirms >= 2, "Reproduce repeated confirm cues from one real arrow click");
      else { assert.equal(confirms,1, `${label}: one confirm cue`); assert.equal(hoverCues,0,`${label}: no extra focus/touch-hover cue on activation`); }
      assert(result.peak > 0.0001, `${label}: real UI audio output must be non-silent`);
    };
    if (width > 900) {
      await activate("reported MAP 28 next", '[data-estat-step="1"]',29);
      await page.locator(".gaia-estat-readout").screenshot({ path: path.join(output,`${width}-dock.png`) });
    }
    if (!before) {
      if (width > 900) {
        await activate("statistics previous", '[data-estat-step="-1"]',28);
        await activate("statistics Enter", '[data-estat-step="1"]',29,"Enter");
        await activate("statistics Space", '[data-estat-step="-1"]',28,"Space");
        for (const [number,selector] of [[1,'[data-firms-step="1"]'],[5,'.map-heading-step[data-map-heading-step="1"]'],[6,'[data-map-dock-mode-step="1"]'],[15,'[data-live-deck-step="1"]']]) {
          await select(number); await activate(`MAP ${number} next`,selector,number+1);
        }
      } else {
        await activate("mobile heading next", '.map-heading-step[data-map-heading-step="1"]',29,"tap");
        await activate("mobile toolbar previous", '[data-mobile-exhibit-step="-1"]',28,"tap");
      }
      // Fast intentional activations are separate actions, never time-debounced.
      await select(27);
      const arrow = page.locator(width > 900 ? '[data-estat-step="1"]' : '[data-mobile-exhibit-step="1"]');
      await arrow.hover(); await page.waitForTimeout(380); await page.evaluate(() => resetSoundTrace());
      await arrow.click(); await arrow.click();
      await page.waitForTimeout(280);
      const rapid = await readTrace();
      assert.equal(rapid.tones.filter(tone => tone.cue === "Confirm").length,4,"Two genuine rapid clicks keep two cues");
      assert.equal(Number(await page.locator("#japan-mode-number").textContent()),29);
      report.checks.push({ width,label:"two rapid activations",...rapid });
      if (width > 900) {
        await page.mouse.move(0,0); await page.waitForTimeout(100); await page.evaluate(() => resetSoundTrace());
        await arrow.hover(); await page.waitForTimeout(150);
        const hover = await readTrace();
        assert.equal(hover.tones.filter(tone => tone.cue === "Hover").length,2,"A real hover still plays once");
        assert.equal(hover.tones.filter(tone => tone.cue === "Confirm").length,0);
        report.checks.push({ width,label:"real pointer hover retained",...hover });
      }
      await page.evaluate(() => resetSoundTrace());
      await page.evaluate(() => GaiaMapCategories.buttons().find(button => Number(button.textContent) === 28).click());
      await page.waitForTimeout(280);
      assert.deepEqual((await readTrace()).tones,[],"Internal exhibit selection is silent");
      report.checks.push({ width,label:"programmatic selection silent" });
      await page.evaluate(() => GaiaOpeningAudio.setMuted(true));
      await page.waitForTimeout(280); await page.evaluate(() => resetSoundTrace());
      await arrow.click(); await page.waitForTimeout(250);
      assert.deepEqual((await readTrace()).tones,[],"Mute suppresses UI tones");
      report.checks.push({ width,label:"muted arrow",silent:true });
      await page.evaluate(() => GaiaOpeningAudio.setMuted(false));
      const back = page.locator("#japan-close");
      await back.hover(); await page.waitForTimeout(380); await page.evaluate(() => resetSoundTrace());
      await back.click(); await page.waitForTimeout(250);
      const backTrace = await readTrace();
      assert.equal(backTrace.tones.filter(tone => tone.cue === "Back").length,2,"Back retains its single distinct cue");
      assert.equal(backTrace.tones.filter(tone => tone.cue === "Confirm").length,0);
      report.checks.push({ width,label:"Back cue retained",...backTrace });
    }
    await context.close(); console.log(`PASS ${width}x${height}`);
  }
  assert.deepEqual(report.errors,[]); report.status = before ? "reproduced" : "passed";
} catch(error) {
  report.status = "failed"; report.failure = error.stack;
  if(page && !page.isClosed()) await page.screenshot({path:path.join(output,"failure.png")});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2));
  await browser.close();
}
