import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/map-guide-demo");
fs.mkdirSync(output, { recursive: true });
const report = { profiles: [], errors: [] };
const profiles = [[1440, 900], [390, 844], [320, 568], [768, 1024], [844, 390], [3840, 2088]]
  .filter(([width]) => !process.env.GAIA_DEMO_WIDTHS || process.env.GAIA_DEMO_WIDTHS.split(',').map(Number).includes(width));
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const [width, height] of profiles) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, reducedMotion: width === 320 ? "reduce" : "no-preference" });
    // Even the current seen flag must not suppress the every-entry map welcome.
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8") }));
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [] } }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.clock.install();
    await page.goto(`${base}/?preview=map-guide-default-demo#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaModeEntryGuide?.getState().phase === "features");
    await page.locator("[data-feature-guide]").click();
    await page.waitForFunction(() => document.querySelectorAll(".is-gaia-mode-guide-target").length === 1);
    await page.waitForTimeout(650);
    const state = () => page.evaluate(() => ({ demo: GaiaMapDemo.getState(), guide: GaiaModeEntryGuide.getState(), number: document.querySelector("#japan-mode-number").textContent.trim() }));
    const initial = await state();
    assert.equal(initial.number, "01");
    assert.equal(initial.demo.active, true);
    assert.equal(initial.demo.paused, true);
    assert.equal(await page.locator("[data-mode-guide-total]").textContent(), "7");
    await page.clock.fastForward(80_000);
    assert.equal((await state()).number, "01", "The first exhibit must not change during onboarding");
    assert.equal((await state()).demo.remainingMs, initial.demo.remainingMs);
    const profile = { width, height, steps: [], lifecycle: [] };
    report.profiles.push(profile);
    for (let index = 0; index < 7; index++) {
      await page.waitForTimeout(450);
      const layout = await page.evaluate(() => {
        const card = document.querySelector(".gaia-mode-entry-guide-card");
        const target = document.querySelector(".is-gaia-mode-guide-target");
        const c = card.getBoundingClientRect(), t = target.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(c.right, t.right) - Math.max(c.left, t.left)) * Math.max(0, Math.min(c.bottom, t.bottom) - Math.max(c.top, t.top));
        return {
          title: document.querySelector("[data-mode-guide-title]").textContent,
          target: target.id || target.className, card: c.toJSON(), targetRect: t.toJSON(), overlap,
          inViewport: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight,
          targetVisible: t.width > 0 && t.height > 0 && t.right > 0 && t.left < innerWidth && t.bottom > 0 && t.top < innerHeight,
          reachable: [...card.querySelectorAll("button:not(:disabled)")].every(button => {
            const b = button.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
            return button === hit || button.contains(hit);
          }),
          focusedInGuide: document.querySelector(".gaia-mode-entry-guide").contains(document.activeElement),
        };
      });
      profile.steps.push(layout);
      assert(layout.inViewport && layout.targetVisible && layout.reachable && layout.focusedInGuide, JSON.stringify(layout));
      assert.equal(layout.overlap, 0, `${width} ${index}: guide covers its own target`);
      if (index === 0) assert(layout.targetRect.x < width / 2 && layout.targetRect.y > height / 2, "Guide must begin at bottom left");
      if (index === 6) assert.equal(layout.title, "デモモードで、地球を巡る");
      await page.screenshot({ path: path.join(output, `${width}x${height}-step-${index + 1}.png`) });
      if (index === 1) {
        await page.locator("[data-mode-guide-back]").click();
        assert.equal((await state()).guide.index, 0);
        await page.locator("[data-mode-guide-next]").click();
        assert.equal((await state()).guide.index, 1);
      }
      await page.locator("[data-mode-guide-next]").click();
      assert.equal((await state()).demo.active, true, "Guide input must preserve demo on");
    }
    assert.equal((await state()).guide.active, false);
    assert.equal((await state()).demo.paused, false);
    profile.lifecycle.push("default-on, seven-step-guide, back/next, pause/resume");
    const beforeAdvance = (await state()).demo.remainingMs;
    await page.clock.fastForward(beforeAdvance + 1);
    await page.clock.runFor(900);
    assert.equal((await state()).number, "02");
    assert.equal((await state()).guide.active, false, "Internal exhibition advance must not reopen the entry welcome");
    // Replaying a guide pauses an already-running demo without switching it off.
    assert.equal(await page.evaluate(() => GaiaModeEntryGuide.open("map", { force: true, guideOnly: true })), true);
    await page.clock.runFor(450);
    assert.equal((await state()).demo.paused, true);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-mode-guide-skip")), true);
    await page.keyboard.press("Escape");
    assert.equal((await state()).guide.active, false);
    assert.equal((await state()).demo.active, true);
    assert.equal((await state()).demo.paused, false);
    await page.clock.runFor(400);
    await page.mouse.click(width / 2, Math.min(height / 2, 300));
    assert.equal((await state()).demo.active, false);
    const stoppedNumber = (await state()).number;
    await page.clock.fastForward(75_000);
    assert.equal((await state()).number, stoppedNumber);
    assert.equal(await page.evaluate(() => GaiaModeEntryGuide.open("map", { force: true, guideOnly: true })), true);
    await page.clock.runFor(400);
    await page.locator("[data-mode-guide-skip]").click();
    assert.equal((await state()).demo.active, false, "Replayed guide must preserve manual off");
    profile.lifecycle.push("replay-pauses, keyboard-focus, escape-resumes, map-touch-stops, manual-off-preserved");
    await page.clock.runFor(400);
    await page.locator("#japan-close").click();
    await page.clock.runFor(800);
    assert.equal((await state()).demo.active, false);
    await page.evaluate(() => { location.hash = "#world"; });
    await page.waitForFunction(() => GaiaMapDemo.getState().active);
    await page.clock.runFor(900);
    assert.equal((await state()).guide.active, true, "Returning to the map shows the welcome again");
    assert.equal((await state()).guide.phase, "title");
    assert.equal((await state()).demo.paused, true);
    await page.clock.runFor(3400);
    assert.equal((await state()).guide.phase, "features");
    await page.locator("[data-feature-start]").click();
    assert.equal((await state()).demo.paused, false);
    // Story maps remain manually directed; neither default demo nor the map
    // onboarding is allowed to interrupt a narrative scene.
    await page.evaluate(() => {
      document.querySelector("#japan-layer").dataset.storyMode = "test-story";
      dispatchEvent(new CustomEvent("gaia:japan-open"));
    });
    await page.clock.runFor(1000);
    assert.equal((await state()).demo.active, false);
    assert.equal(await page.evaluate(() => GaiaModeEntryGuide.open("map", { force: true })), false);
    profile.lifecycle.push("reentry-default-on, welcome-repeats, internal-exhibit-does-not-repeat, story-excluded");
    await context.close();
    console.log(`${width}x${height}: seven guide steps and demo lifecycle passed`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
