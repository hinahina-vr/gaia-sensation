import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument = "artifacts/ending-logo", baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument);
fs.mkdirSync(outputDir, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const profiles = [
  { width: 1440, height: 900, realtime: true },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 390, height: 844, reduced: true },
  { width: 1440, height: 900, reduced: true },
];

async function boot(page, reduced) {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => GaiaNovel.open());
  await page.evaluate((reduced) => {
    const progress = {
      ...GaiaNovel.getState(), storyVersion: GAIA_NOVEL_STORY.storyVersion,
      stepId: "welcome_chat_095", clear: false, archivesUnlocked: false,
      audio: { muted: true, volume: 0 },
    };
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 270, reducedMotion: reduced }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, reduced);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector(".novel-staff-roll"));
  await page.waitForFunction(() => {
    const logo = document.querySelector(".novel-staff-roll-title-logo");
    return logo?.complete && logo.naturalWidth > 0;
  });
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
}

const scan = (page) => page.evaluate(() => {
  const shell = document.querySelector(".novel-staff-roll");
  const stage = shell.querySelector(".novel-staff-roll-stage");
  const title = shell.querySelector(".novel-staff-roll-title");
  const logo = title.querySelector("img");
  const rect = logo.getBoundingClientRect();
  const bounds = stage.getBoundingClientRect();
  const style = getComputedStyle(title);
  const track = shell.querySelector(".novel-staff-roll-track");
  const credit = track.querySelector(".novel-staff-roll-credit");
  const viewport = shell.querySelector(".novel-staff-roll-viewport");
  return {
    phase: shell.dataset.phase,
    opacity: Number(style.opacity),
    blur: Number(style.filter.match(/blur\(([\d.]+)px\)/u)?.[1] || 0),
    transform: style.transform,
    animation: style.animationName,
    time: title.getAnimations()[0]?.currentTime ?? null,
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    centerDeltaX: Math.abs(rect.x + rect.width / 2 - bounds.x - bounds.width / 2),
    centerDeltaY: Math.abs(rect.y + rect.height / 2 - bounds.y - bounds.height / 2),
    inTrack: track.contains(title),
    logoCount: shell.querySelectorAll(".novel-staff-roll-title-logo").length,
    accessibleTitle: title.querySelector("h2")?.textContent,
    logoSource: logo.getAttribute("src"),
    trackY: track.getBoundingClientRect().y,
    creditTop: credit.getBoundingClientRect().top,
    creditCount: track.querySelectorAll(".novel-staff-roll-credit").length,
    finaleHidden: shell.querySelector(".novel-staff-roll-finale").hidden,
    manualScroll: getComputedStyle(viewport).overflowY === "auto" && viewport.scrollHeight > viewport.clientHeight,
    trackAnimation: getComputedStyle(track).animationName,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  };
});

async function seek(page, time) {
  await page.evaluate((time) => {
    for (const animation of document.querySelector(".novel-staff-roll").getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = time;
    }
  }, time);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const profile of profiles) {
    const label = `${profile.width}${profile.reduced ? "-reduced" : ""}`;
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      reducedMotion: profile.reduced ? "reduce" : "no-preference",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(`${label}: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") report.errors.push(`${label}: ${message.text()}`); });
    page.on("response", (response) => { if (response.status() === 404) report.errors.push(`${label}: 404 ${response.url()}`); });
    await boot(page, Boolean(profile.reduced));
    const initial = await scan(page);
    assert.equal(initial.logoCount, 1);
    assert.equal(initial.creditCount, 8);
    assert.equal(initial.accessibleTitle, "惑星の放課後 — GAIA SENSATION");
    assert.equal(initial.logoSource, "./assets/brand/brand-logo-light-surface.png");
    const samples = [];
    const result = { profile, initial, samples, passed: false };
    report.scans.push(result);
    if (profile.reduced) {
      assert.equal(initial.animation, "none");
      assert.equal(initial.trackAnimation, "none");
      assert.equal(initial.opacity, 1);
      assert.equal(initial.blur, 0);
      assert.equal(initial.inTrack, true);
      assert.equal(initial.manualScroll, true);
      assert.equal(initial.finaleHidden, false);
      await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
    } else {
      assert.equal(initial.inTrack, false, "Title must not inherit the credit roll's transform");
      assert.equal(initial.animation, "novel-staff-roll-title-focus");
      if (profile.realtime) {
        // Observe the actual CSS timeline before seeking any animation.
        const observationDeadline = Date.now() + 15_000;
        while ((samples.at(-1)?.time ?? 0) < 11_190 && Date.now() < observationDeadline) {
          samples.push(await scan(page));
          await page.waitForTimeout(250);
        }
        assert(samples.some((frame) => frame.opacity > 0.1 && frame.opacity < 0.9 && frame.blur > 1));
        assert(samples.some((frame) => frame.opacity >= 0.99 && frame.blur <= 0.1));
        assert.equal(samples.at(-1).opacity, 0);
        assert.equal(samples.at(-1).phase, "rolling");
        // Seeking backwards across a CSS delay emits reverse animation events.
        // Start a fresh sequence for the ordered, deterministic frame samples.
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.querySelector(".novel-staff-roll-title-logo")?.complete);
        await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
      }
      for (const [name, time] of [["start", 3200], ["soft", 4800], ["clear", 7200], ["hold", 8800], ["fade", 10400], ["credits", 14000]]) {
        await seek(page, time);
        const frame = await scan(page);
        frame.sample = name;
        samples.push(frame);
        if (name === "start") { assert.equal(frame.opacity, 0); assert.equal(frame.blur, 18); }
        if (name === "soft") { assert(frame.opacity > 0.1 && frame.opacity < 0.9); assert(frame.blur > 1); }
        if (["clear", "hold"].includes(name)) { assert.equal(frame.opacity, 1); assert.equal(frame.blur, 0); }
        if (name === "fade") assert(frame.opacity > 0 && frame.opacity < 1);
        if (name === "credits") { assert.equal(frame.opacity, 0); assert(frame.creditTop < profile.height); }
        if (["soft", "clear", "credits"].includes(name)) await page.screenshot({ path: path.join(outputDir, `${label}-${name}.png`) });
      }
      for (const frame of samples) {
        assert(frame.centerDeltaX < 1 && frame.centerDeltaY < 1, `${label}: off-center ${JSON.stringify(frame)}`);
        assert(Math.abs(frame.x - initial.x) < 1 && Math.abs(frame.y - initial.y) < 1, `${label}: logo moved`);
        assert.equal(frame.transform, "none");
        assert.equal(frame.overflow, 0);
        assert(frame.x >= 0 && frame.x + frame.width <= profile.width);
      }
      // Native animation completion must still reach the existing final action.
      await page.locator(".novel-staff-roll-track").evaluate((track) => {
        track.getAnimations().find((animation) => animation.animationName === "novel-staff-roll-rise").finish();
      });
      await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "complete", null, { timeout: 8000 });
      assert.equal((await scan(page)).finaleHidden, false);
      // Restart and leave during the soft reveal; no old title may survive exit.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelector(".novel-staff-roll-title"));
      await seek(page, 4800);
      assert.equal((await scan(page)).logoCount, 1);
    }
    await page.locator(".novel-staff-roll-data-skip").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "true");
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.hidden);
    assert.equal(await page.locator(".novel-staff-roll").isVisible(), false);
    result.passed = true;
    await context.close();
    console.log(`Ending logo passed: ${label}`);
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
