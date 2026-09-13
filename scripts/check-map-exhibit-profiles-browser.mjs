import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/map-exhibit-profiles");
const widths = (process.argv[4] || "1440,390,320").split(",").map(Number);
const context = { document: { querySelector: () => null, addEventListener() {} }, matchMedia: () => ({ matches: true, addEventListener() {} }) };
vm.runInNewContext(fs.readFileSync("map-exhibit-categories.js", "utf8"), context);
const exhibitCount = context.GaiaMapCategories.exhibitCount;
const expected = Array.from({ length: exhibitCount }, (_, index) => {
  const number = index + 1;
  const scope = number <= 14 || number >= 70 ? "world" : "japan";
  const time = [1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20].includes(number) ? "realtime"
    : number === 7 ? "simulation" : [8, 9, 12, 13, 65, 66, 67].includes(number) ? "comparison" : "series";
  return { number, scope, time };
});
for (const item of expected) {
  const profile = context.GaiaMapCategories.getProfile(item.number);
  assert.equal(profile.scope, item.scope); assert.equal(profile.time, item.time);
  assert(Object.isFrozen(profile));
}
assert.equal(context.GaiaMapCategories.getProfile(0), null);
assert.equal(context.GaiaMapCategories.getProfile(exhibitCount + 1), null);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const mobile = width <= 900;
    const ctx = await browser.newContext({ viewport: { width, height: width >= 2400 ? 2088 : mobile ? 844 : 900 }, reducedMotion: "reduce", hasTouch: mobile });
    await ctx.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await ctx.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await ctx.newPage(); page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?mode=15&preview=map-exhibit-profiles#world`, { waitUntil: "domcontentloaded" });
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    await page.locator('[data-feature-start]').click();
    await page.waitForFunction(count => globalThis.GaiaMapCategories?.buttons().length === count && globalThis.GaiaMapDemo, exhibitCount);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapCategories.buttons()[14].click(); GaiaLiveExhibits.pausePoiAutoplay();
    });
    await page.waitForFunction(count => document.querySelectorAll('.map-mode-button[data-map-scope]').length === count
      && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), exhibitCount);
    const source = await page.evaluate(() => GaiaMapCategories.buttons().map(button => ({
      number: Number(button.textContent), scope: button.dataset.mapScope, time: button.dataset.mapTime,
      description: document.getElementById(`map-profile-${button.dataset.mapScope}-${button.dataset.mapTime}`)?.textContent,
      describedBy: button.getAttribute("aria-describedby"), addedText: [...button.children].map(child => child.textContent),
    })));
    assert.deepEqual(source.map(({ number, scope, time }) => ({ number, scope, time })), expected);
    for (const button of source) {
      assert(button.addedText.every(text => text === ""), "Decoration cannot change the numeric routing text");
      assert(button.describedBy.includes(`map-profile-${button.scope}-${button.time}`));
      assert(button.description.includes(button.scope === "world" ? "世界展示" : "日本展示"));
    }
    const open = async () => {
      if (mobile) await page.locator('[data-mobile-sheet="exhibits"]').click();
      else {
        const extension = page.locator('[data-map-bank-toggle]:visible').first();
        await (await extension.count() ? extension : page.locator(".map-dock-bank-trigger")).click();
      }
    };
    await open();
    const menu = page.locator(mobile ? "#map-mobile-sheet" : ".map-dock-bank-popover");
    await menu.waitFor({ state: "visible" });
    const entries = [];
    for (const scope of ["world", "japan"]) {
    await menu.locator(`[role="tab"][data-map-scope="${scope}"]`).click();
    const scopedEntries = await page.locator(mobile ? "#map-mobile-sheet [data-mobile-exhibit]:visible" : ".map-category-group .map-mode-button:visible").evaluateAll((buttons, mobile) => buttons.map(button => {
      const profile = GaiaMapCategories.getProfile(mobile ? button.dataset.mobileExhibit : button.textContent);
      const style = getComputedStyle(button, "::before"), rect = button.getBoundingClientRect();
      const tile = GaiaMapCategories.getTile(mobile ? button.dataset.mobileExhibit : button.textContent);
      const measure = document.createElement("canvas").getContext("2d");
      measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return { number: Number(mobile ? button.dataset.mobileExhibit : button.textContent), scope: button.dataset.mapScope, time: button.dataset.mapTime,
        visibleLabels: style.content === JSON.stringify(tile.symbol) && button.dataset.mapDetail === tile.detail,
        live: Boolean(button.querySelector('.map-tile-live')), expectedLive: profile.time === 'realtime', height: rect.height,
        clipped: measure.measureText(tile.symbol).width > rect.width - 6,
      };
    }), mobile);
    entries.push(...scopedEntries);
    await menu.screenshot({ path: path.join(output, `${width}-${scope}-menu.png`) });
    }
    assert.equal(entries.length, exhibitCount);
    for (const entry of entries) { assert(entry.visibleLabels && !entry.clipped && entry.height >= 44, JSON.stringify(entry)); assert.equal(entry.live, entry.expectedLive); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert((await menu.locator(".map-picker-profile-guide").textContent()).includes("保存値"));
    await page.mouse.move(width - 1, 1);
    await menu.screenshot({ path: path.join(output, `${width}-menu.png`) });
    for (const number of process.env.PROFILE_NUMBERS?.split(',').map(Number) || [24, 2, 17, 9, 7, 21, 31, 32, 37, 38, 43, 44, 54, 55, 64, 70, 71]) {
      const scope = expected.find(item => item.number === number).scope;
      await menu.locator(`[role="tab"][data-map-scope="${scope}"]`).click();
      const button = mobile ? page.locator(`[data-mobile-exhibit="${number}"]`)
        : page.locator(".map-category-group .map-mode-button").filter({ hasText: new RegExp(`^${String(number).padStart(2, "0")}$`) });
      await button.click();
      await page.waitForFunction(number => Number(document.querySelector("#japan-mode-number").textContent) === number
        && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), number);
      await open(); await menu.waitFor({ state: "visible" });
    }
    if (mobile) await page.keyboard.press("Escape");
    else await page.locator('[data-map-bank-toggle]:visible').first().click();
    report.checks.push({ width, entries });
    console.log(`PASS ${width}: all ${exhibitCount} quantity labels/LIVE badges fit, accessible profiles and numeric routing intact`);
    await ctx.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close();
}
