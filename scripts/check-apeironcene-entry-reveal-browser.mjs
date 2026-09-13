import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs")) ? path.join(moduleRoot, "index.mjs") : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/apeironcene-entry-reveal");
const ovationSnapshot = fs.readFileSync(path.resolve("data/ovation-aurora-snapshot.json"), "utf8");
fs.mkdirSync(outputDir, { recursive: true });
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844, mobile: true },
  { name: "small-mobile", width: 320, height: 568, mobile: true },
  { name: "reduced-motion", width: 1440, height: 1000, reduced: true },
];
const report = { status: "running", scans: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath });
const selector = ".intro-story-return[data-primary-action='true']";
const readButton = (page) => page.locator(selector).evaluate((button) => {
  const css = getComputedStyle(button);
  const rect = button.getBoundingClientRect();
  const copy = button.querySelector(".intro-story-title").getBoundingClientRect();
  const kicker = button.querySelector(".intro-story-kicker").getBoundingClientRect();
  return {
    title: button.querySelector("strong").textContent.trim(),
    destination: button.dataset.storyDestination,
    awakening: button.classList.contains("is-apeironcene-awakening"),
    filter: css.filter, transform: css.transform,
    width: rect.width, height: rect.height,
    visibleRatio: Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(0, rect.top)) / rect.height,
    borderRadius: css.borderRadius,
    backgroundImage: css.backgroundImage,
    originalSingleLineLayout: kicker.right <= copy.left && Math.abs(kicker.y + kicker.height / 2 - copy.y - copy.height / 2) < 1,
    addedOrnaments: button.querySelectorAll(".intro-story-emblem, .intro-story-arrow, .intro-story-orbit, strong small").length,
    transitionDisplay: getComputedStyle(button.querySelector(".intro-story-transition")).display,
    transitionPointerEvents: getComputedStyle(button.querySelector(".intro-story-transition")).pointerEvents,
    splashCount: button.querySelectorAll(".intro-entry-splash").length,
    transientAnimations: button.querySelector(".intro-story-transition").getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length,
    copyContained: copy.left >= rect.left && copy.right <= rect.right,
    gridDelta: Math.abs(rect.width - document.querySelector("#intro-path-grid").getBoundingClientRect().width),
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    particleCount: button.querySelectorAll(".intro-apeironcene-particle").length,
    infiniteAnimations: button.getAnimations({ subtree: true }).filter((animation) => animation.effect.getTiming().iterations === Infinity && animation.playState === "running").length,
    timing: { ...globalThis.__entryQa },
  };
});
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile), isMobile: Boolean(viewport.mobile),
      reducedMotion: viewport.reduced ? "reduce" : "no-preference",
    });
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: ovationSnapshot }));
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify({ storyVersion: 13, stepId: "festival_concept_001", clear: true, archivesUnlocked: true }));
      globalThis.__entryQa = { starts: 0, reveals: 0, startAt: 0, revealedAt: 0 };
      addEventListener("gaia:apeironcene-entry-reveal-start", () => {
        __entryQa.starts++; __entryQa.startAt = performance.now();
      });
      addEventListener("gaia:apeironcene-entry-revealed", () => {
        __entryQa.reveals++; __entryQa.revealedAt = performance.now();
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(viewport.name + ": " + error.message));
    page.on("console", (message) => { if (message.type() === "error") report.errors.push(viewport.name + ": " + message.text()); });
    await page.goto(new URL("/?preview=entry-starlight-splash#earth", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !document.documentElement.classList.contains("gaia-booting"));
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    // Hold the entry definitely offscreen, independent of the menu's arrival
    // animation or the restored button's shorter height.
    const offscreenGuard = viewport.name === "small-mobile"
      ? await page.addStyleTag({ content: ".intro-story-return { transform: translateY(150vh) !important; }" })
      : null;
    await page.locator("#japan-close").click();
    await page.waitForFunction(() => document.querySelector("#intro-layer")?.getAttribute("aria-hidden") === "false");
    const button = page.locator(selector);
    const initial = await readButton(page);
    if (!viewport.reduced) assert.equal(initial.title, "物語をはじめる");
    // On a short mobile display, an unseen entry must not complete below the fold.
    if (offscreenGuard) {
      await page.waitForTimeout(1500);
      assert.equal((await readButton(page)).timing.starts, 0);
      await offscreenGuard.evaluate((style) => style.remove());
    }
    await button.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outputDir, viewport.name + "-before.png") });
    if (!viewport.reduced) {
      await page.waitForFunction(() => document.querySelector(".intro-story-return").classList.contains("is-apeironcene-awakening"));
      // Duplicate notifications may occur while other modes persist progress.
      await page.evaluate(() => {
        dispatchEvent(new CustomEvent("gaia:story-progression-change"));
        dispatchEvent(new CustomEvent("gaia:story-progression-change"));
      });
      await page.waitForTimeout(500);
      const motionStart = await button.locator("animateMotion").first().evaluate((motion) => motion.parentElement.getCTM().e);
      const bloom = await button.evaluate((b) => {
        const svg = b.querySelector(".intro-story-transition");
        return {
          opacity: Number(getComputedStyle(svg.querySelector(".intro-entry-bloom")).opacity),
          overflow: getComputedStyle(b).overflow,
          widthDelta: Math.abs(svg.viewBox.baseVal.width - b.clientWidth),
          oneShotOnly: svg.getAnimations({ subtree: true }).every((animation) => animation.effect.getTiming().iterations === 1),
          hitTarget: b.contains(document.elementFromPoint(b.getBoundingClientRect().x + 25, b.getBoundingClientRect().y + 20)),
        };
      });
      assert(bloom.opacity > .5, "A visible light bloom must accompany the transformation");
      assert.equal(bloom.overflow, "visible", "The splash must escape the button's top and bottom edges");
      assert(bloom.widthDelta < 1, "Render the stars at the actual button size, not stretched on mobile");
      assert.equal(bloom.oneShotOnly, true, "No new infinite animation may be introduced");
      assert.equal(bloom.hitTarget, true, "The light overlay must not intercept the button");
      await page.screenshot({ path: path.join(outputDir, viewport.name + "-stars.png") });
      await page.waitForTimeout(400);
      const motionEnd = await button.locator("animateMotion").first().evaluate((motion) => motion.parentElement.getCTM().e);
      assert(motionEnd > motionStart + 20, "The shooting star must actually move left to right");
      await page.screenshot({ path: path.join(outputDir, viewport.name + "-writing.png") });
      const during = await readButton(page);
      assert.equal(during.transform, "none");
      assert.equal(during.filter, "none");
      assert.equal(during.overflow, 0, "The splash must not cause horizontal scrolling");
      assert.equal(during.splashCount, 76);
      assert.equal(during.transitionPointerEvents, "none");
      assert(Math.abs(during.height - initial.height) < 1, "Entry height must remain stable");
    }
    await page.waitForFunction(() => {
      const b = document.querySelector(".intro-story-return");
      return b.classList.contains("is-apeironcene") && !b.classList.contains("is-apeironcene-awakening");
    });
    await page.waitForTimeout(300);
    const final = await readButton(page);
    assert.equal(final.title, "星々の放課後 ～APEIRONCENE～");
    assert.equal(final.destination, "apeironcene");
    assert.equal(final.transform, "none");
    assert.equal(final.filter, "none");
    assert.equal(final.particleCount, 120);
    assert.equal(final.addedOrnaments, 0);
    assert.equal(final.borderRadius, "8px");
    assert(final.backgroundImage.includes("36, 29, 82"), "Restore the previous purple/cyan surface");
    assert.equal(final.transitionDisplay, "none", "The new effect must leave no permanent trails");
    assert.equal(final.transientAnimations, 0, "All transformation work must stop after settling");
    if (!viewport.mobile) assert.equal(final.originalSingleLineLayout, true);
    assert.equal(final.height, viewport.mobile ? 58 : 60);
    assert.equal(final.overflow, 0);
    assert.equal(final.copyContained, true);
    assert(final.gridDelta <= 1);
    assert(Math.abs(final.height - initial.height) < 1);
    assert.equal(final.timing.starts, 1);
    assert.equal(final.timing.reveals, 1);
    assert.equal(final.infiniteAnimations, viewport.reduced ? 0 : 243);
    if (!viewport.reduced) assert(final.timing.revealedAt - final.timing.startAt >= 850);
    await page.screenshot({ path: path.join(outputDir, viewport.name + "-after.png") });
    await button.screenshot({ path: path.join(outputDir, viewport.name + "-button.png") });
    await button.focus();
    assert.equal(await button.evaluate((b) => getComputedStyle(b).outlineStyle), "solid");
    const focused = await readButton(page);
    assert.equal(focused.transform, "none");
    // Changing the actual destination cancels an in-flight animation completely.
    if (viewport.name === "desktop") {
      const setComplete = (complete) => page.evaluate((value) => {
        if (value) localStorage.setItem("gaiaSensewareTrueEnd:complete:v1", "1");
        else localStorage.removeItem("gaiaSensewareTrueEnd:complete:v1");
        dispatchEvent(new CustomEvent("gaia:story-progression-change"));
      }, complete);
      await setComplete(true);
      assert.equal((await readButton(page)).destination, "story");
      await setComplete(false);
      await page.waitForFunction(() => document.querySelector(".intro-story-return").classList.contains("is-apeironcene-awakening"));
      await setComplete(true);
      await page.waitForTimeout(2500);
      const cancelled = await readButton(page);
      assert.equal(cancelled.destination, "story");
      assert.equal(cancelled.awakening, false);
      assert.equal(cancelled.infiniteAnimations, 0);
      assert.equal(cancelled.transientAnimations, 0);
      assert.equal(cancelled.timing.reveals, 1);
      await setComplete(false);
      await page.waitForFunction(() => document.querySelector(".intro-story-return").classList.contains("is-apeironcene"));
      await page.waitForTimeout(2200);
      const repeated = await readButton(page);
      assert.equal(repeated.timing.reveals, 2);
      await page.evaluate(() => dispatchEvent(new CustomEvent("gaia:story-progression-change")));
      assert.equal((await readButton(page)).timing.reveals, 2);
      // Leaving the menu cancels pending work; returning reveals only once.
      await setComplete(true);
      await setComplete(false);
      await page.locator("[data-intro-path='map']").click();
      await page.waitForFunction(() => document.querySelector("#intro-layer").getAttribute("aria-hidden") === "true");
      await page.waitForTimeout(2600);
      assert.equal((await readButton(page)).awakening, false);
      assert.equal((await readButton(page)).infiniteAnimations, 0);
      const revealsWhileAway = (await readButton(page)).timing.reveals;
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      await page.locator("#japan-close").click();
      await button.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const b = document.querySelector(".intro-story-return");
        return b.classList.contains("is-apeironcene") && !b.classList.contains("is-apeironcene-awakening");
      });
      assert.equal((await readButton(page)).timing.reveals, revealsWhileAway + 1);
    }
    report.scans.push({ viewport: viewport.name, initial, final, passed: true });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = "failed";
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
