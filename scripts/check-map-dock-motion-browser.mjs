import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", output = "artifacts/map-dock-motion"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height, reduced] of [[1440, 900, false], [390, 844, false], [320, 568, true], [3840, 2160, false]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference", hasTouch: width < 901 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    // Geometry/motion QA uses saved local observations, not changing live APIs.
    await context.route("**/api/live/v1/**", route => route.fulfill({ status: 503, json: { error: "Use saved snapshots for motion QA" } }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com", "earthquake.usgs.gov"]) {
      await context.route(`https://${host}/**`, route => route.abort());
    }
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("response", response => { if (response.status() === 404 && response.url().startsWith(base)) report.errors.push(`${width}: 404 ${response.url()}`); });
    await page.goto(`${base}/?preview=map-dock-motion#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(() => {
      GaiaMapDemo.stop("motion-qa");
      globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
    });
    const select = number => page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).click(), number);
    const motionState = () => page.evaluate(() => ({ ...document.querySelector("#japan-layer").dataset,
      animations: document.getAnimations().filter(animation => animation.id === "map-dock-enter").length }));
    const settled = () => page.waitForFunction(() => !document.getAnimations().some(animation => animation.id === "map-dock-enter"));
    await select(5);
    await page.waitForFunction(() => document.querySelector("#japan-title").dataset.exhibitNumber === "05");
    await page.waitForTimeout(550);

    const numbers = width === 1440 ? [...Array.from({ length: 25 }, (_, i) => i + 6), 1, 2, 3, 4, 5]
      : width === 3840 ? [6, 5, 21, 15] : [6, 5, 1, 15, 21, 12, 6];
    for (const number of numbers) {
      const before = await motionState();
      await select(number);
      const to = String(number).padStart(2, "0");
      await page.waitForFunction(to => document.querySelector("#japan-layer").dataset.dockMotionTo === to, to);
      const state = await motionState();
      assert.equal(Number(state.dockMotionSequence), Number(before.dockMotionSequence || 0) + 1, `${width}/${number}: one entrance per exhibit`);
      if (reduced) {
        assert.equal(state.dockMotionPhase, "reduced");
        assert.equal(state.animations, 0);
      } else {
        const samples = await page.evaluate(() => {
          const animation = document.getAnimations().find(animation => animation.id === "map-dock-enter");
          if (!animation) return null;
          const panel = animation.effect.target;
          animation.pause();
          const samples = [0, 120, 355, 479].map(time => {
            animation.currentTime = time;
            const style = getComputedStyle(panel);
            return { time, translate: style.translate, opacity: Number(style.opacity), width: panel.getBoundingClientRect().width };
          });
          animation.currentTime = 120;
          return { panel: panel.className, duration: animation.effect.getTiming().duration, samples };
        });
        assert(samples, `${width}/${number}: entrance animation missing`);
        assert.equal(samples.duration, 480);
        const y = sample => Number.parseFloat(sample.translate.split(" ")[1] || "0");
        assert(y(samples.samples[0]) >= 24 && samples.samples[0].opacity === 0);
        assert(y(samples.samples[1]) < y(samples.samples[0]) && samples.samples[1].opacity > .5);
        assert(y(samples.samples[2]) < 0, "Small overshoot should settle softly");
        assert(Math.abs(y(samples.samples[3])) < .1 && samples.samples[3].opacity === 1);
        assert(samples.samples.every(sample => sample.width === samples.samples[0].width), "Motion must not resize/reflow the dock");
        state.motion = samples;
        if (number === 6 && before.dockMotionTo === "05") await page.screenshot({ path: path.join(output, `${width}-05-to-06-entering.png`) });
        await page.evaluate(() => document.getAnimations().find(animation => animation.id === "map-dock-enter")?.finish());
        await settled();
      }
      const geometry = await page.evaluate(() => {
        const selectors = innerWidth > 900
          ? ".map-command-dock, .gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout"
          : ".signal-console-map, .map-mobile-ecology-summary, .gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout";
        return {
          panels: [...document.querySelectorAll(selectors)].filter(element => element.checkVisibility({ checkVisibilityCSS: true })).map(element => ({
            className: element.className, translate: getComputedStyle(element).translate, ...element.getBoundingClientRect().toJSON(),
          })),
          overflow: document.documentElement.scrollWidth - innerWidth,
          menuTranslate: getComputedStyle(document.querySelector("#map-mobile-toolbar")).translate,
        };
      });
      assert.equal(geometry.panels.length, 1, `${width}/${number}: one active lower panel`);
      assert.equal(geometry.overflow, 0);
      assert.equal(geometry.menuTranslate, "none", "Mobile menu must remain anchored");
      for (const panel of geometry.panels) {
        assert.equal(panel.translate, "none", "No fill/transform may remain after completion");
        assert(panel.x >= -1 && panel.right <= width + 1 && panel.bottom <= height + 1);
      }
      if (number === 6 || number === 15) await page.screenshot({ path: path.join(output, `${width}-${number}-settled.png`) });
      report.checks.push({ width, height, reduced, number, state, geometry });
    }

    // Re-selecting the current exhibit, ordinary measurements and time changes
    // are not layout transitions, even when providers dispatch mode events.
    const last = numbers.at(-1);
    const sequence = (await motionState()).dockMotionSequence;
    await select(last);
    await page.evaluate(() => {
      for (const type of ["gaia:live-update", "gaia:japan-mode-change", "gaia:planet-signals-change"]) dispatchEvent(new CustomEvent(type));
      const time = document.querySelector('.signal-console-map [data-signal-time]');
      if (time && !time.disabled && time.checkVisibility()) {
        time.value = String((Number(time.min) + Number(time.max)) / 2);
        time.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.waitForTimeout(160);
    assert.equal((await motionState()).dockMotionSequence, sequence);
    assert.equal((await motionState()).animations, 0);

    if (width === 1440) {
      await select(6);
      await page.waitForFunction(() => document.querySelector("#japan-layer").dataset.dockMotionTo === "06");
      await page.evaluate(() => document.querySelector(".map-dock-bank-trigger").click());
      assert.equal((await motionState()).animations, 0, "Opening a picker settles its animated anchor immediately");
      assert.equal(await page.locator(".map-dock-bank-trigger").getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Escape");
      const next = page.locator(".map-dock-bank-step--next");
      await next.focus();
      await next.press("Enter");
      await page.waitForFunction(() => document.querySelector("#japan-title").dataset.exhibitNumber === "07");
      await settled();
      assert(await next.evaluate(node => node === document.activeElement), "Keyboard focus survives standard dock replacement");
    }

    if (!reduced) {
      // Rapid cross-provider switches cancel the outgoing animation, then a
      // motion preference change and closing the map clean up immediately.
      for (const number of [5, 6, 21, 15].filter(number => number !== last)) {
        await select(number);
        await page.waitForTimeout(45);
        assert((await motionState()).animations <= 1, "No stacked entrance animations");
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(60);
      assert.equal((await motionState()).animations, 0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForTimeout(60);
      await select(6);
      await page.waitForTimeout(40);
      await page.locator("#japan-close").click();
      await page.waitForFunction(() => document.querySelector("#japan-layer").getAttribute("aria-hidden") === "true");
      await page.waitForTimeout(40);
      assert.equal((await motionState()).animations, 0, "Closing map cancels dock animation");
    }
    console.log(`PASS ${width}: ${numbers.length} dock changes, refresh deduplication, cleanup${reduced ? ", reduced motion" : ""}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
