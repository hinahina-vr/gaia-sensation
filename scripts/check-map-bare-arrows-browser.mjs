import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/map-bare-arrows");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const controls = [[1, "data-map-dock-mode-step"], [10, "data-live-deck-step"], [16, "data-estat-step"], [26, "data-firms-step"], [27, "data-planet-step"]];
try {
  for (const width of [1440, 3840, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width === 390 ? 844 : 900 }, reducedMotion: "reduce", hasTouch: width === 390 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=bare-arrows#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaPlanetSignals && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    const settle = () => page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    for (const [number, attribute] of controls) {
      await page.evaluate(number => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => button.textContent.trim() === String(number).padStart(2, "0")).click(), number);
      await settle();
      for (const direction of [-1, 1]) {
        const button = page.locator(`[${attribute}="${direction}"]`);
        if (!await button.isVisible()) continue; // Mobile standard/live modes use the compact picker.
        let originalRect;
        for (const state of ["idle", "hover", "focus"]) {
          if (state === "idle") { await page.locator("#japan-close").focus(); await page.mouse.move(width / 2, 20); }
          if (state === "hover") await button.hover();
          if (state === "focus") { await page.keyboard.press("Tab"); await button.focus(); }
          await page.waitForTimeout(200);
          const scan = await button.evaluate(button => {
            const style = getComputedStyle(button), rect = button.getBoundingClientRect();
            return { text: button.textContent, background: style.backgroundColor, image: style.backgroundImage,
              border: style.borderTopWidth, radius: style.borderRadius, shadow: style.boxShadow,
              outline: style.outlineWidth, decoration: style.textDecorationLine,
              x: rect.x, y: rect.y, width: rect.width, height: rect.height,
              hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button };
          });
          assert.equal(scan.text, direction < 0 ? "‹" : "›");
          assert.equal(scan.background, "rgba(0, 0, 0, 0)", `${width}/${number}/${state}: round background remains`);
          assert.equal(scan.image, "none"); assert.equal(scan.border, "0px"); assert.equal(scan.radius, "0px");
          assert.equal(scan.shadow, "none"); assert.equal(scan.outline, "0px"); assert(scan.hit);
          if (state === "focus") assert.equal(scan.decoration, "underline");
          const rect = [scan.x, scan.y, scan.width, scan.height];
          if (originalRect) assert.deepEqual(rect, originalRect, "Interaction state moved/resized the click target");
          originalRect = rect;
          if (width > 900) { assert.equal(scan.width, 44); assert.equal(scan.height, 48); }
          report.checks.push({ width, number, direction, state, scan });
        }
      }
      if (number === 27) {
        await page.locator("#japan-close").focus(); await page.mouse.move(width / 2, 20);
        await page.screenshot({ path: path.join(output, `${width}-arrows.jpg`), type: "jpeg", quality: 88 });
        await page.locator(`[${attribute}="1"]`).click();
        await page.waitForFunction(() => document.querySelector("#japan-mode-number").textContent === "28");
        await settle();
        await page.locator(`[${attribute}="-1"]`).focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.querySelector("#japan-mode-number").textContent === "27");
      }
    }
    console.log(`PASS ${width}: bare left/right chevrons, idle/hover/focus, unchanged targets and next/previous navigation`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
