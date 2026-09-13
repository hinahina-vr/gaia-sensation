import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/intro-guide-dissolve");
fs.mkdirSync(output, { recursive: true });
const viewports = [
  { width: 1440, height: 900 }, { width: 3840, height: 2160 },
  { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 280, height: 653 },
  { width: 568, height: 320 }, { width: 844, height: 390 }, { width: 1440, height: 900, reduced: true },
].filter(viewport => !process.env.GAIA_VIEWPORT || String(viewport.width) === process.env.GAIA_VIEWPORT);
const report = { status: "running", scans: [], errors: [], missingAssets: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let currentPage;
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
try {
  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}${viewport.reduced ? "-reduced" : ""}`;
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: viewport.reduced ? "reduce" : "no-preference", hasTouch: viewport.width <= 844 });
    const page = await context.newPage();
    currentPage = page;
    page.on("pageerror", error => report.errors.push(`${label}: ${error.message}`));
    page.on("response", response => { if (response.status() === 404) report.missingAssets.push(response.url()); });
    await page.goto(`${base}/?preview=intro-guide-dissolve#top`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaIntroEntryGuide && document.querySelector("#gaia-boot")?.hidden);
    await page.waitForTimeout(1800); // The data landing cards have their own staged entrance.
    await page.evaluate(() => globalThis.GaiaIntroEntryGuide.open());
    const shown = () => page.waitForFunction(() => document.querySelector("#intro-entry-guide")?.classList.contains("is-presented"));
    const steps = [];
    for (let index = 0; index < 4; index++) {
      await shown();
      const motion = await page.evaluate(() => {
        const guide = document.querySelector("#intro-entry-guide");
        const bubble = guide.querySelector(".intro-entry-guide-bubble");
        const surface = bubble.querySelector(".intro-entry-guide-surface");
        const preview = bubble.querySelector("img");
        const copy = bubble.querySelector(".intro-entry-guide-copy");
        const echo = guide.querySelector(".intro-entry-guide-echo");
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const animations = guide.getAnimations({ subtree: true });
        const phases = [];
        for (const time of [0, 360, 800, 1800]) {
          for (const animation of animations) {
            if (!animation.animationName?.startsWith("intro-guide-")) continue;
            animation.pause();
            animation.currentTime = time;
          }
          phases.push({ time, surface: Number(getComputedStyle(surface).opacity), image: Number(getComputedStyle(preview).opacity), copy: Number(getComputedStyle(copy).opacity),
            blur: getComputedStyle(surface).filter, imageClip: getComputedStyle(preview).clipPath,
            echo: echo ? Number(getComputedStyle(echo).opacity) : null, rect: bubble.getBoundingClientRect().toJSON() });
        }
        // Finish only finite effects; no site-wide animation settings are changed.
        for (const animation of animations) if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
        return { reduced, phases, echoCount: guide.querySelectorAll(".intro-entry-guide-echo").length,
          echoText: echo?.querySelector(".intro-entry-guide-copy")?.textContent,
          echoHidden: echo?.getAttribute("aria-hidden"), echoInert: echo?.inert,
          echoPointerEvents: echo && getComputedStyle(echo).pointerEvents,
          visibleText: copy.textContent,
          uniqueCopyId: document.querySelectorAll("#intro-entry-guide-copy").length,
          animation: getComputedStyle(surface).animationName,
          delay: getComputedStyle(surface).animationDelay,
        };
      });
      if (viewport.reduced) {
        assert.equal(motion.animation, "none");
        assert.equal(motion.echoCount, 0);
        assert.equal(motion.phases[0].surface, 1);
      } else {
        assert.equal(motion.animation, "intro-guide-condense");
        assert.equal(motion.phases[0].surface, 0);
        assert.equal(motion.phases[0].copy, 0);
        assert(motion.phases[1].surface > 0 && motion.phases[1].surface < 1);
        assert(motion.phases[2].copy > 0 && motion.phases[2].copy < 1);
        assert.equal(motion.phases[3].surface, 1);
        assert.equal(motion.phases[3].copy, 1);
        if (index > 0) {
          assert.equal(motion.delay, "0.16s");
          assert.equal(motion.echoCount, 1, `${label}: previous preview vanished abruptly`);
          assert.equal(motion.echoText, steps[index - 1].motion.visibleText);
          assert.equal(motion.echoHidden, "true");
          assert.equal(motion.echoInert, true);
          assert.equal(motion.echoPointerEvents, "none");
          assert(motion.phases[1].echo > 0 && motion.phases[1].echo < motion.phases[0].echo);
          assert.equal(motion.phases[3].echo, 0);
        }
      }
      assert.equal(motion.uniqueCopyId, 1);
      for (const phase of motion.phases) assert.deepEqual(phase.rect, motion.phases[0].rect, "Animation moved the measured wrapper");
      const state = await page.evaluate(() => {
        const guide = document.querySelector("#intro-entry-guide");
        const bubble = guide.querySelector(".intro-entry-guide-bubble");
        const preview = bubble.querySelector("img");
        const shade = guide.querySelector(".intro-entry-guide-shade");
        const target = document.querySelector(".is-intro-entry-guide-target");
        return { ...GaiaIntroEntryGuide.getState(), bubble: bubble.getBoundingClientRect().toJSON(), targetRect: target.getBoundingClientRect().toJSON(), shade: shade.getBoundingClientRect().toJSON(),
          source: preview.currentSrc, imageWidth: preview.naturalWidth, imageHeight: preview.naturalHeight, imageFit: getComputedStyle(preview).objectFit,
          clutter: guide.querySelectorAll(".intro-entry-guide-index, .intro-entry-guide-hint, [data-intro-entry-guide-step], [data-intro-entry-guide-action], figcaption").length,
          focused: document.activeElement?.id, description: guide.getAttribute("aria-describedby"),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.equal(state.index, index);
      assert.equal(state.target, ["map", "sensor", "character", "sound"][index]);
      assert.equal(state.focused, "intro-entry-guide");
      assert.equal(state.clutter, 0);
      assert.equal(state.description, "intro-entry-guide-copy");
      assert.match(state.source, /current-guide-20260906/u);
      assert.equal(state.imageWidth, 1440);
      assert.equal(state.imageHeight, 810);
      assert.equal(state.imageFit, "contain");
      assert(state.bubble.left >= 7 && state.bubble.right <= viewport.width - 7, `${label}: guide escaped horizontally`);
      assert(state.bubble.top >= 7 && state.bubble.bottom <= viewport.height - 7, `${label}: guide escaped vertically`);
      assert(overlap(state.bubble, state.targetRect) <= 1, `${label}: guide overlaps its target`);
      assert.equal(state.overflow, false);
      for (const edge of ["left", "top", "width", "height"]) assert(Math.abs(state.targetRect[edge] - state.shade[edge]) <= 1, `${label}: spotlight ${edge} drifted`);
      await page.screenshot({ path: path.join(output, `${label}-${state.target}.png`), animations: "disabled" });
      steps.push({ motion, state });
      if (index < 3) await page.keyboard.press(index === 1 ? "Space" : "Enter");
    }
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "intro-entry-guide");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "intro-entry-guide-replay");
    await page.evaluate(() => {
      GaiaIntroEntryGuide.open();
      GaiaIntroEntryGuide.close();
      GaiaIntroEntryGuide.open();
      const guide = document.querySelector("#intro-entry-guide");
      guide.click(); guide.click();
    });
    await shown();
    assert.equal(await page.evaluate(() => GaiaIntroEntryGuide.getState().index), 2);
    await page.waitForTimeout(700);
    assert(await page.locator("#intro-entry-guide").evaluate(node => !node.hidden && !node.inert));
    assert.equal(await page.locator(".intro-entry-guide-echo").count(), 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".intro-entry-guide-bubble .intro-entry-guide-surface").evaluate(node => getComputedStyle(node).animationName), "none");
    await page.keyboard.press("Enter");
    await shown();
    await page.locator("#intro-entry-guide").click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(700);
    assert(await page.locator("#intro-entry-guide").evaluate(node => node.hidden && node.inert && !node.classList.contains("is-presented")));
    report.scans.push({ viewport, steps });
    console.log(`PASS ${label}: four fresh previews, reveal/crossfade, placement, replay and dismissal`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missingAssets, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
