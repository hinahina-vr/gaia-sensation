import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/route-guide-motion");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let currentPage;
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 3840, height: 2160 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width === 390 });
    const page = await context.newPage();
    currentPage = page;
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    await page.goto(`${base}/?preview=route-guide-motion`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.activeElement?.id === "gaia-opening-sound-on");
    await page.locator("#gaia-opening-sound-off").click();
    await page.locator("#gaia-opening-skip").click();
    const presented = () => page.waitForFunction(() => document.querySelector("#gaia-opening-route-guide")?.classList.contains("is-presented"));
    await presented();

    // Seek the real CSS animation: the restored pointer shares the surface's
    // entrance, while the text follows without changing the layout box.
    const inspectEntrance = async (step) => {
      const fresh = await page.evaluate(() => {
        const guide = document.querySelector("#gaia-opening-route-guide");
        const animation = guide.querySelector(".gaia-opening-route-guide-surface").getAnimations().find(item => item.animationName === "opening-guide-surface");
        const result = Boolean(animation && animation !== globalThis.__previousGuideAnimation);
        globalThis.__previousGuideAnimation = animation;
        return result;
      });
      assert(fresh, `${viewport.width}: step ${step} reused an old entrance`);
      const phases = [];
      for (const time of [0, 190, 450, 1100]) {
        const phase = await page.evaluate((time) => {
          const guide = document.querySelector("#gaia-opening-route-guide");
          const bubble = guide.querySelector(".gaia-opening-route-guide-bubble");
          const surface = guide.querySelector(".gaia-opening-route-guide-surface");
          for (const animation of guide.getAnimations({ subtree: true })) {
            if (!animation.animationName?.startsWith("opening-guide-")) continue;
            animation.pause();
            animation.currentTime = time;
          }
          const copy = guide.querySelector("[data-route-guide-copy]");
          return {
            time,
            surface: Number(getComputedStyle(surface).opacity),
            copy: Number(getComputedStyle(copy).opacity),
            hintCount: guide.querySelectorAll(".gaia-opening-route-guide-hint, [data-route-guide-hint-action]").length,
            threadContent: getComputedStyle(bubble, "::before").content,
            tailContent: getComputedStyle(surface, "::before").content,
            tailTransform: getComputedStyle(surface, "::before").transform,
            filter: getComputedStyle(surface).filter,
            wrapperRect: bubble.getBoundingClientRect().toJSON(),
            count: guide.querySelectorAll("[data-route-guide-step], .gaia-opening-route-guide-index").length,
            text: copy.textContent,
          };
        }, time);
        assert.equal(phase.count, 0);
        assert.equal(phase.hintCount, 0);
        phases.push(phase);
        if ((step === 1 && [190, 450, 1100].includes(time)) || (step === 2 && time === 1100)) {
          const rect = phase.wrapperRect;
          await page.screenshot({ path: path.join(output, `${viewport.width}-step-${step}-${time}.png`),
            clip: { x: Math.max(0, rect.x - 8), y: Math.max(0, rect.y - 20), width: Math.min(viewport.width - Math.max(0, rect.x - 8), rect.width + 16), height: Math.min(viewport.height - Math.max(0, rect.y - 20), rect.height + 40) } });
        }
      }
      assert.equal(phases[0].surface, 0);
      assert.equal(phases[0].copy, 0);
      assert(phases[1].surface > 0 && phases[1].surface < 1);
      for (const phase of phases) {
        assert.equal(phase.threadContent, "none", "The thin connector line returned");
        assert.equal(phase.tailContent, '""', "The speech-bubble pointer disappeared");
        assert.equal(phase.tailTransform, phases[0].tailTransform, "The entrance animation rotated the pointer");
      }
      assert.equal(phases[1].copy, 0, "Copy must follow the bubble reveal");
      assert(phases[2].copy > 0 && phases[2].copy < 1);
      assert.equal(phases[3].surface, 1);
      assert.equal(phases[3].copy, 1);
      assert.equal(phases[3].filter, "blur(0px)");
      for (const phase of phases) assert.deepEqual(phase.wrapperRect, phases[0].wrapperRect, "Entrance changed the positioner's layout box");
      return phases;
    };

    const first = await inspectEntrance(1);
    await page.keyboard.press("Space");
    await presented();
    assert.equal(await page.locator("#gaia-opening-route-guide").getAttribute("data-step"), "2");
    const second = await inspectEntrance(2);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "gaia-opening-route-story");

    // Open/close within one frame, then reopen before the old closing timer.
    // None of the superseded callbacks may resurrect or hide the current guide.
    await page.evaluate(() => {
      const guide = document.querySelector("#gaia-opening-route-guide");
      const replay = document.querySelector("#gaia-opening-route-guide-replay");
      replay.click();
      guide.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await page.waitForTimeout(280);
    assert(await page.locator("#gaia-opening-route-guide").evaluate(node => node.hidden && node.inert && !node.classList.contains("is-visible")));
    await page.evaluate(() => {
      const guide = document.querySelector("#gaia-opening-route-guide");
      const replay = document.querySelector("#gaia-opening-route-guide-replay");
      replay.click();
      guide.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      replay.click();
      guide.click();
    });
    await presented();
    await page.waitForTimeout(300);
    const rapid = await page.locator("#gaia-opening-route-guide").evaluate(node => ({ hidden: node.hidden, inert: node.inert, visible: node.classList.contains("is-visible"), step: node.dataset.step }));
    assert.equal(rapid.hidden, false);
    assert.equal(rapid.inert, false);
    assert.equal(rapid.visible, true);
    assert.equal(rapid.step, "2", "An immediate click after replay was lost or used a stale step");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await page.locator(".gaia-opening-route-guide-surface").evaluate(node => ({ animation: getComputedStyle(node).animationName, opacity: getComputedStyle(node).opacity, filter: getComputedStyle(node).filter }));
    assert.equal(reduced.animation, "none");
    assert.equal(reduced.opacity, "1");
    assert.equal(reduced.filter, "none");
    await page.setViewportSize({ width: viewport.width === 390 ? 844 : 390, height: viewport.width === 390 ? 390 : 844 });
    await page.waitForTimeout(100);
    const resized = await page.locator(".gaia-opening-route-guide-bubble").evaluate(node => {
      const rect = node.getBoundingClientRect();
      const target = document.querySelector(".is-route-guide-target").getBoundingClientRect();
      return { contained: rect.left >= 11 && rect.right <= innerWidth - 11 && rect.top >= 11 && rect.bottom <= innerHeight - 11, aligned: Math.abs(rect.left + parseFloat(node.style.getPropertyValue("--route-guide-arrow-left")) - target.left - target.width / 2) <= 1 };
    });
    assert(resized.contained && resized.aligned);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    assert(await page.locator("#gaia-opening-route-guide").evaluate(node => node.hidden && node.inert));
    report.scans.push({ viewport, first, second, rapid, reduced, resized });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log(`Route guide staggered entrance and lifecycle passed: ${report.scans.length} viewports`);
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
