import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-place-chevron");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { status: "running", checks: [], errors: [] };
let page;
const plainChevron = async (button, expected) => {
  const result = await button.evaluate(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return { text: element.textContent, border: style.borderWidth, radius: style.borderRadius,
      background: style.backgroundColor, shadow: style.boxShadow, outline: style.outlineStyle,
      font: style.fontFamily, size: style.fontSize, width: rect.width, height: rect.height };
  });
  assert.equal(result.text, expected);
  assert.equal(result.border, "0px"); assert.equal(result.radius, "0px");
  assert.equal(result.background, "rgba(0, 0, 0, 0)"); assert.equal(result.shadow, "none");
  assert.equal(result.outline, "none"); assert.equal(result.size, "28px");
  assert(result.height >= 44);
  return result;
};
const citySettled = city => page.waitForFunction(city => document.querySelector("#gaia-live-exhibit-canvas").dataset.observationCity === city
  && document.querySelector("#japan-layer").dataset.livePoiTransition === "settled", city);
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "reduce", hasTouch: width === 390 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?mode=15&preview=live-place-chevron#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
    });
    for (const number of [15, 16, 17, 18, 19, 20]) {
      await page.evaluate(number => { GaiaMapCategories.buttons()[number - 1].click(); GaiaLiveExhibits.pausePoiAutoplay(); }, number);
      await page.waitForFunction(number => document.querySelector("#japan-mode-number").textContent.trim() === String(number), number);
      const previous = page.locator('[data-live-poi-step="-1"]'), next = page.locator('[data-live-poi-step="1"]');
      assert.equal(await page.locator(".gaia-live-place-selector > i").count(), 0);
      assert.equal((await page.locator(".gaia-live-place-selector").textContent()).includes("⌄"), false);
      const buttons = [await plainChevron(previous, "‹"), await plainChevron(next, "›")];
      if (width === 390) for (const button of buttons) assert(button.width >= 44);
      await next.hover(); await plainChevron(next, "›");
      await next.focus(); await plainChevron(next, "›");
      report.checks.push({ width, number, buttons });
    }
    const picker = page.locator(".gaia-live-place-selector");
    const choose = async city => {
      await picker.click();
      await page.locator(`[data-place-city="${city}"]`).click();
      await citySettled(city);
    };
    await choose("sapporo");
    await page.locator('[data-live-poi-step="1"]').click(); await citySettled("aomori");
    await page.locator('[data-live-poi-step="-1"]').press("Enter"); await citySettled("sapporo");
    await choose("tokyo");
    await page.mouse.move(width / 2, 200);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.locator(".gaia-live-deck-location-control").screenshot({ path: path.join(output, `${width}-controls.png`) });
    await page.screenshot({ path: path.join(output, `${width}-screen.jpg`), type: "jpeg", quality: 85 });
    console.log(`PASS ${width}: all six exhibits use plain chevrons, no triangle/frame in normal/hover/focus; click, keyboard and dropdown work`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
