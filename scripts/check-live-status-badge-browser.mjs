import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/live-status-badge-2026-09-09/${before ? "before" : "after"}`);
const sizes = process.env.BADGE_SIZES?.split(",").map(size => size.split("x").map(Number))
  || (before ? [[1920,1080],[3840,2160]] : [[3840,2160],[1920,1080],[1440,900],[1024,768],[901,768],[768,1024],[390,844],[320,568],[844,390]]);
const files = ["src/exploration/live-exhibits.js", "src/exploration/index.js", "realtime-exhibits.css", "gaia-mode-loader.js", "index.html"];
const tested = Object.fromEntries(files.map(file => [file, before && [files[0], files[2]].includes(file)
  ? execFileSync("git", ["show", `HEAD:${file}`]) : fs.readFileSync(file)]));
const report = { status: "running", environment: "Local Chrome; bundled missing/saved observations and synthetic badge states, not live provider or physical-device testing",
  before, baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(tested[file]).digest("hex")])), checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const scan = async () => page.locator(".gaia-live-exhibit-readout").evaluate(dock => {
  const badge = dock.querySelector(".gaia-broadcast-badge"), b = badge.getBoundingClientRect(), d = dock.getBoundingClientRect();
  const overlaps = rect => rect.width > 0 && rect.height > 0 && b.left < rect.right && b.right > rect.left && b.top < rect.bottom && b.bottom > rect.top;
  const obstacles = [...dock.querySelectorAll("button, .gaia-live-place-heading > span, .gaia-live-deck-question > *, .map-category-eyebrow")]
    .filter(node => node !== badge && overlaps(node.getBoundingClientRect())).map(node => node.textContent.trim());
  const range = document.createRange(); range.selectNodeContents(badge);
  const glyphs = range.getBoundingClientRect();
  const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  return { text: badge.textContent, state: badge.dataset.broadcastState, badge: b.toJSON(), dock: d.toJSON(), obstacles,
    inHeading: badge.parentElement.classList.contains("gaia-live-place-heading"), count: dock.querySelectorAll(".gaia-broadcast-badge").length,
    hit: hit === badge || badge.contains(hit), textFits: glyphs.left >= b.left && glyphs.right <= b.right + 1,
    inViewport: b.width > 0 && b.height > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
    inDock: b.left >= d.left && b.right <= d.right && b.top >= d.top && b.bottom <= d.bottom,
    overflow: document.documentElement.scrollWidth - innerWidth };
});
const check = (result, label) => {
  assert.equal(result.count, 1, `${label}: duplicate badge`);
  assert.equal(result.overflow, 0, `${label}: horizontal page overflow`);
  if (before) { assert(result.obstacles.some(text => text.includes("統計分析")), `${label}: reported button overlap must reproduce`); return; }
  assert(result.inHeading && result.inViewport && result.inDock && result.hit && result.textFits, `${label}: badge must be visible and contained ${JSON.stringify(result)}`);
  assert.deepEqual(result.obstacles, [], `${label}: overlapping badge`);
};
try {
  for (const [width,height] of sizes) {
    const context = await browser.newContext({ viewport: { width,height }, reducedMotion: "reduce", hasTouch: width <= 900 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    if (before) for (const file of [files[0], files[2]]) await context.route(`${base}/${file}*`, route => route.fulfill({ body: tested[file], contentType: file.endsWith("css") ? "text/css" : "text/javascript" }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?exhibit=15#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaLiveExhibits && globalThis.GaiaMapDemo && document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(async () => {
      GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapCategories.buttons().find(button => Number(button.textContent) === 15).click();
      GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveExhibits.selectObservationPoint("sapporo");
      await document.fonts.ready;
    });
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.locator('.gaia-live-exhibit-readout .gaia-broadcast-badge[data-broadcast-state="error"]').waitFor();
    await page.mouse.move(0,0); await page.evaluate(() => document.activeElement?.blur());
    const dock = page.locator(".gaia-live-exhibit-readout");
    for (const number of (before ? [15] : [15,16,17,18,19,20])) {
      if (number !== 15) {
        await page.evaluate(number => { GaiaMapCategories.buttons().find(button => Number(button.textContent) === number).click(); GaiaLiveExhibits.pausePoiAutoplay(); }, number);
        await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      }
      const result = await scan(); check(result, `${width}/${number}`);
      report.checks.push({ width,height,number,...result });
      if (number === 15) {
        await page.screenshot({ path: path.join(output, `${width}-full.png`) });
        await dock.screenshot({ path: path.join(output, `${width}-dock.png`) });
      }
    }
    if (!before) {
      // Exercise the real status painter with every label, including the widest.
      for (const [sourceState,age] of [["FETCHING",0],["LIVE",0],["LIVE",25],["SAVED SNAPSHOT",0],["SAVED VALUES",0],["ERROR",0]]) {
        await page.evaluate(async ({ sourceState,age }) => {
          const { updateBroadcastBadge } = await import("./src/exploration/realtime-exhibit-status.js?v=gaia-map-polish-1-live-red-1-footer-credit-1");
          updateBroadcastBadge(document.querySelector(".gaia-live-exhibit-readout .gaia-broadcast-badge"), { sourceState, observedAt: new Date(Date.now() - age * 3600_000).toISOString() });
        }, { sourceState,age });
        const result = await scan(); check(result, `${width}/${sourceState}/${age}`);
        report.checks.push({ width,height,sourceState,age,...result });
        if (age) await dock.screenshot({ path: path.join(output, `${width}-delayed.png`) });
      }
      // A real place selection repaints the moved badge and retains one instance.
      await dock.locator(".gaia-live-place-selector").click();
      await page.locator(".gaia-place-picker").waitFor();
      await page.keyboard.press("Escape");
      await page.evaluate(() => { GaiaLiveExhibits.selectObservationPoint("tokyo"); });
      await page.locator('.gaia-live-exhibit-readout .gaia-broadcast-badge[data-broadcast-state="saved"]').waitFor();
      check(await scan(), `${width}/saved-place`);
      if (width > 900) {
        await dock.locator(".gaia-map-action--source").click();
        await page.waitForFunction(() => document.querySelector("#japan-layer").classList.contains("japan-data-open"));
        await page.locator("#japan-data-close").click();
        await dock.locator('[data-live-deck-step="-1"]').click();
        await page.waitForFunction(() => document.querySelector("[data-live-deck-number]").textContent === "19");
        check(await scan(), `${width}/previous-exhibit`);
      } else {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.locator(".map-mobile-tool-grid").waitFor();
        await page.keyboard.press("Escape");
      }
      await page.evaluate(() => GaiaMapCategories.buttons().find(button => Number(button.textContent) === 6).click());
      assert.equal(await dock.locator(".gaia-broadcast-badge").isVisible(), false, "Moved badge must hide outside live maps");
      report.checks.push({ width,height,placePicker: true,savedPlaceRefresh: true,actions: true,hiddenAfterExit: true });
    }
    await context.close(); console.log(`PASS ${width}x${height}`);
  }
  assert.deepEqual(report.errors, []); report.status = before ? "reproduced" : "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output,"failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output,"report.json"), JSON.stringify(report,null,2));
  await browser.close();
}
