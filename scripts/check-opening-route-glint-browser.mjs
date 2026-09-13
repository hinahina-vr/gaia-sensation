import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/opening-route-glint");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
});
const effects = ["opening-route-glint", "opening-route-focus-flash"];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width === 390 });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${baseUrl}/?preview=route-glint-replay`, { waitUntil: "domcontentloaded" });
    await page.locator("#gaia-opening-sound-off").click();
    await page.locator("#gaia-opening-skip").click();
    const guide = page.locator("#gaia-opening-route-guide");
    const story = page.locator("#gaia-opening-route-story");
    const data = page.locator("#gaia-opening-route-other");
    await page.waitForFunction(() => document.querySelector("#gaia-opening-route-guide")?.classList.contains("is-presented"));
    const samples = [];
    const read = locator => locator.evaluate((card, names) => ({
      focused: card.matches(":focus"), hovered: card.matches(":hover"),
      animations: card.getAnimations({ subtree: true }).filter(animation => names.includes(animation.animationName))
        .map(animation => ({ name: animation.animationName, time: animation.currentTime, state: animation.playState })),
      opacity: ["::before", "::after"].map(pseudo => Number(getComputedStyle(card, pseudo).opacity)),
      transform: ["::before", "::after"].map(pseudo => getComputedStyle(card, pseudo).transform),
    }), effects);
    const assertFresh = async (locator, label) => {
      const fresh = await read(locator);
      assert.equal(fresh.animations.length, 2, `${label}: one of the reflection layers is missing`);
      assert(fresh.animations.every(animation => animation.state === "running" && animation.time < 450), `${label}: selection reused a finished reflection (${JSON.stringify(fresh)})`);
      await page.waitForTimeout(130);
      const visible = await read(locator);
      assert(visible.opacity.every(opacity => opacity > 0.1), `${label}: reflection did not become visible`);
      assert.notDeepEqual(visible.transform, fresh.transform, `${label}: the light did not travel across the card`);
      samples.push({ label, fresh, visible });
    };
    const settle = async locator => {
      await page.waitForFunction(({ id, names }) => {
        const card = document.getElementById(id);
        const animations = card.getAnimations({ subtree: true }).filter(animation => names.includes(animation.animationName));
        return animations.length > 0 && animations.every(animation => animation.playState === "finished");
      }, { id: await locator.getAttribute("id"), names: effects });
    };

    // The story entrance completed before the automatic guide selected it.
    await assertFresh(story, "automatic-guide-story");
    await guide.click({ position: { x: 8, y: 8 } });
    await assertFresh(data, "guide-data");
    await page.keyboard.press("Escape");
    await settle(story);
    assert.equal(await story.evaluate(card => card.matches(":focus")), true);

    // Regression: close-guide focus remains on STORY; both hover attempts must
    // still restart the same CSS animations, even though :focus never changes.
    await story.hover();
    await assertFresh(story, "hover-while-focused");
    await settle(story);
    const settled = await read(story);
    assert.deepEqual(settled.opacity, [0, 0], "Reflection did not fade away");
    await page.mouse.move(5, 5);
    await story.hover();
    await assertFresh(story, "repeat-hover-while-focused");
    await settle(story);

    // Keyboard focus must replay independently of an already-active hover.
    await data.focus();
    await settle(data);
    await page.keyboard.press("Shift+Tab");
    await assertFresh(story, "keyboard-focus-while-hovered");
    await settle(story);
    await page.mouse.move(5, 5);
    await page.keyboard.press("Tab");
    await assertFresh(data, "keyboard-data");
    await settle(data);
    await data.hover();
    await assertFresh(data, "hover-data-while-focused");
    await settle(data);

    // Capture the real card at peak reflection; timing is pinned only for this
    // visual evidence, after real-time input/replay checks above have passed.
    await story.focus();
    await story.evaluate((card, names) => {
      for (const animation of card.getAnimations({ subtree: true })) {
        if (!names.includes(animation.animationName)) continue;
        animation.pause();
        animation.currentTime = 220;
      }
    }, effects);
    await story.screenshot({ path: path.join(output, `${viewport.width}-story-glint.png`) });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await data.focus();
    await story.hover();
    const reduced = await story.evaluate(card => ["::before", "::after"].map(pseudo => getComputedStyle(card, pseudo).display));
    assert.deepEqual(reduced, ["none", "none"], "Reduced-motion preference was ignored");
    assert.equal(await page.evaluate(() => document.querySelector(".gaia-opening-route-guide-surface") && getComputedStyle(document.querySelector(".gaia-opening-route-guide-surface")).borderRadius), "15px", "Restored speech bubble changed");
    report.scans.push({ viewport, samples, reduced });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log("Route glint replay passed: guide selection, repeated hover, keyboard focus and reduced motion at 2 widths");
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
