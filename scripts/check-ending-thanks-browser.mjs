import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument = "artifacts/ending-thanks", baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument);
fs.mkdirSync(outputDir, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath });
const profiles = [
  { width: 1440, height: 900 }, { width: 3840, height: 2160 },
  { width: 390, height: 844 }, { width: 320, height: 568 },
  { width: 390, height: 844, reduced: true },
];
const scan = (page) => page.evaluate(() => {
  const shell = document.querySelector(".novel-staff-roll");
  const mark = shell.querySelector(".novel-staff-roll-closing-mark");
  const caption = shell.querySelector(".novel-staff-roll-closing-action > small");
  const action = shell.querySelector(".novel-staff-roll-finale");
  const rect = mark.getBoundingClientRect();
  return {
    phase: shell.dataset.phase,
    text: mark.textContent,
    width: rect.width, x: rect.x,
    markOpacity: Number(getComputedStyle(mark).opacity),
    markAnimation: getComputedStyle(mark).animationName,
    captionOpacity: Number(getComputedStyle(caption).opacity),
    actionVisible: !action.hidden,
    actionText: action.textContent,
    actionHeight: action.getBoundingClientRect().height,
    words: [...mark.children].map((word) => {
      const style = getComputedStyle(word);
      const bounds = word.getBoundingClientRect();
      return { text: word.textContent, opacity: Number(style.opacity), blur: Number(style.filter.match(/blur\(([\d.]+)px\)/u)?.[1] || 0), delay: style.animationDelay, finishAt: word.getAnimations()[0]?.effect.getComputedTiming().endTime ?? 0, x: bounds.x, y: bounds.y };
    }),
    lineHeight: getComputedStyle(shell.querySelector(".novel-staff-roll-closing-action"), "::before").height,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  };
});
try {
  for (const profile of profiles) {
    const label = `${profile.width}${profile.reduced ? "-reduced" : ""}`;
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, reducedMotion: profile.reduced ? "reduce" : "no-preference" });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(`${label}: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") report.errors.push(`${label}: ${message.text()}`); });
    page.on("response", (response) => { if (response.status() === 404) report.errors.push(`${label}: 404 ${response.url()}`); });
    await page.goto(new URL("/story", baseUrl).href);
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => GaiaNovel.open());
    await page.evaluate((reduced) => {
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({ ...GaiaNovel.getState(), stepId: "welcome_chat_095", clear: false }));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ reducedMotion: reduced }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    }, Boolean(profile.reduced));
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll") && document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
    await page.evaluate(() => document.fonts.ready);
    if (!profile.reduced) {
      await page.evaluate(() => {
        const shell = document.querySelector(".novel-staff-roll");
        const roll = shell.querySelector(".novel-staff-roll-track").getAnimations()[0];
        for (const animation of shell.getAnimations({ subtree: true })) if (animation !== roll) animation.finish();
        roll.finish();
      });
      await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "end-hold");
    }
    const result = { profile, initial: await scan(page), frames: [], passed: false };
    report.scans.push(result);
    assert.equal(result.initial.text, "Thank you for playing");
    assert.deepEqual(result.initial.words.map((word) => word.text), ["Thank", "you", "for", "playing"]);
    if (profile.reduced) {
      assert.equal(result.initial.phase, "complete");
      assert.equal(result.initial.actionVisible, true);
      assert.equal(result.initial.captionOpacity, 1);
    } else {
      assert.equal(result.initial.markOpacity, 0);
      assert.equal(result.initial.actionVisible, false);
      await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "thank-you");
      const started = Date.now();
      let capturedEntrance = false;
      let capturedHold = false;
      while (Date.now() - started < 6000) {
        const frame = { time: Date.now() - started, ...await scan(page) };
        result.frames.push(frame);
        assert.equal(frame.overflow, 0);
        assert(frame.x >= -1 && frame.x + frame.width <= profile.width + 1, `${label}: thank-you overflows its viewport`);
        if (frame.phase === "thank-you") {
          assert.equal(frame.lineHeight, "1px");
          assert.equal(frame.actionVisible, false);
          for (let index = 1; index < frame.words.length; index++) assert(frame.words[index - 1].opacity + 0.01 >= frame.words[index].opacity, "Word reveal order changed");
          const previous = result.frames.at(-2);
          if (previous?.phase === "thank-you") frame.words.forEach((word, index) => {
            assert(word.opacity + 0.01 >= previous.words[index].opacity, "Word flashed instead of fading in");
            assert(word.blur <= previous.words[index].blur + 0.01, "Word became blurry again during arrival");
            assert(Math.abs(word.x - previous.words[index].x) < 1, "Word jittered sideways");
          });
        }
        if (!capturedEntrance && frame.time >= 550 && frame.phase === "thank-you") {
          capturedEntrance = true;
          await page.screenshot({ path: path.join(outputDir, `${label}-arrival.png`) });
        }
        if (!capturedHold && frame.time >= 1900 && frame.phase === "thank-you") {
          capturedHold = true;
          await page.screenshot({ path: path.join(outputDir, `${label}-hold.png`) });
          if (profile.width === 1440) report.preview = await page.evaluate(() => ({
            closing: document.querySelector(".novel-staff-roll-closing").outerHTML,
            background: getComputedStyle(document.querySelector(".novel-staff-roll-stage")).backgroundImage,
          }));
        }
        if (frame.phase === "complete") break;
        await page.waitForTimeout(80);
      }
      assert(result.frames.some((frame) => frame.phase === "thank-you" && frame.words[0].opacity > frame.words[3].opacity + 0.2), "No stagger was visible");
      const settled = result.frames.filter((frame) => frame.phase === "thank-you" && frame.words.every((word) => word.opacity === 1 && word.blur === 0));
      assert(settled.length > 0, "The phrase never settled");
      // Large PNG captures can leave gaps between Node-side samples. Use the
      // native CSS end time, not the first sample after a screenshot finishes.
      const revealEnd = Math.max(...settled[0].words.map((word) => word.finishAt));
      assert.equal(revealEnd, 1680);
      assert(settled.at(-1).time - revealEnd >= 2200, "The fully readable phrase did not hold long enough");
      const final = result.frames.at(-1);
      assert.equal(final.phase, "complete");
      assert(final.time >= 4750, "Final action arrived too early");
      assert.equal(final.actionText, "世界の続きを紡ぐ");
      assert(final.actionHeight >= 44);
      await page.waitForTimeout(520);
    }
    await page.screenshot({ path: path.join(outputDir, `${label}-button.png`) });
    await page.locator(".novel-staff-roll-data-skip").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.hidden);
    result.passed = true;
    await context.close();
    console.log(`Ending thanks passed: ${label}`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
