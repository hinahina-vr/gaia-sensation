import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { OBSERVATION_CITIES } from "../src/exploration/observation-cities.js";
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { createHash } from 'node:crypto';

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/observation-place-picker");
const widths = (process.argv[4] || "1440,390,320").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
report.hashes=Object.fromEntries(['app.js','app-content.js','src/exploration/live-exhibits.js','src/exploration/live-prefecture-map.js','src/exploration/observation-place-picker.js','realtime-exhibits.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const settled = city => page.waitForFunction(city => document.querySelector('.gaia-live-prefecture-region[aria-current="true"]')?.dataset.city === city
  && document.querySelector("#japan-layer").dataset.livePoiTransition === "settled", city);
const viewportCheck = async () => {
  // setViewportSize returns before the resize/visualViewport handlers settle.
  await page.waitForFunction(() => {
    const box = document.querySelector("#gaia-observation-place-picker").getBoundingClientRect();
    return box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
  }, null, { timeout: 3000 });
  const result = await page.locator("#gaia-observation-place-picker").evaluate(dialog => {
    const rect = dialog.getBoundingClientRect(), results = dialog.querySelector(".gaia-place-picker-results");
    return { rect: rect.toJSON(), width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth,
      listWidth: results.clientWidth, listScrollWidth: results.scrollWidth,
      clippedNames: [...dialog.querySelectorAll(".gaia-place-picker-name strong")].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent),
      smallTargets: [...dialog.querySelectorAll("[data-place-city]")].filter(node => node.getBoundingClientRect().height < 44).length };
  });
  assert(result.rect.left >= 0 && result.rect.top >= 0 && result.rect.right <= result.width + 1 && result.rect.bottom <= result.height + 1, JSON.stringify(result));
  assert.equal(result.overflow, 0); assert(result.listScrollWidth <= result.listWidth + 1);
  assert.deepEqual(result.clippedNames, []); assert.equal(result.smallTargets, 0);
  return result;
};
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 360 ? 640 : width <= 720 ? 844 : 900 }, hasTouch: width <= 720,
      reducedMotion: width === 1440 ? "no-preference" : "reduce" });
    await enforceBrowserSecurity(context,base);await context.route('https://**',route=>route.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?exhibit=15&preview=observation-place-picker#world`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-feature-start]').click();
    await page.waitForFunction(() => globalThis.GaiaLiveExhibits && globalThis.GaiaMapCategories?.buttons().length === 71 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapCategories.buttons()[14].click(); GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveExhibits.selectObservationPoint("tokyo");
    });
    await settled("tokyo");
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const trigger = page.locator(".gaia-live-place-selector"), dialog = page.locator("#gaia-observation-place-picker"), search = dialog.locator("input");
    const open = async () => { await trigger.click(); assert(await dialog.isVisible()); assert.equal(await trigger.getAttribute("aria-expanded"), "true"); };
    assert.equal(await page.locator(".gaia-live-prefecture-picker select").count(), 0);
    await open();
    assert.equal(await dialog.locator("[data-place-city]").count(), 47);
    assert.equal(await dialog.locator('[data-place-city="tokyo"]').getAttribute("aria-current"), "true");
    assert.equal(await dialog.locator("input").evaluate(node => document.activeElement === node), false, "Opening should not summon the mobile keyboard");
    const bounds = await viewportCheck();
    await dialog.screenshot({ path: path.join(output, `${width}-picker.png`) });
    await page.screenshot({ path: path.join(output, `${width}-screen.jpg`), type: "jpeg", quality: 88 });
    const regions = await dialog.locator('[data-place-region]:not([data-place-region="all"])').evaluateAll(nodes => nodes.map(node => node.dataset.placeRegion));
    const found = [];
    for (const region of regions) {
      await dialog.locator(`[data-place-region="${region}"]`).click();
      found.push(...await dialog.locator("[data-place-city]").evaluateAll(nodes => nodes.map(node => node.dataset.placeCity)));
    }
    assert.deepEqual(found, OBSERVATION_CITIES.map(city => city.id), "All 47 prefectures occur once across seven regions");
    for (const [query, expected] of [["兵庫", "kobe"], ["神戸市", "kobe"], ["兵庫県（神戸市）", "kobe"], ["４３", "kumamoto"], ["ＴＯＫＹＯ", "tokyo"]]) {
      await search.fill(query);
      assert.equal(await dialog.locator("[data-place-city]").count(), 1);
      assert.equal(await dialog.locator("[data-place-city]").getAttribute("data-place-city"), expected);
      assert.equal((await page.locator("#japan-mode-number").textContent()).trim(), "15", "Typing must not trigger MAP shortcuts");
    }
    await search.fill("該当なし"); assert.equal(await dialog.locator("[data-place-city]").count(), 0);
    assert(await dialog.locator(".gaia-place-picker-empty").isVisible());
    await dialog.locator("[data-place-clear]").click(); assert.equal(await dialog.locator("[data-place-city]").count(), 47);
    await search.fill("熊本");
    await search.press("Enter"); await settled("kumamoto");
    assert.equal(await dialog.isVisible(), false); assert.equal(await trigger.getAttribute("data-city"), "kumamoto");
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    await open();
    await page.keyboard.press("End");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.placeCity), "naha");
    await page.keyboard.press("Home");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.placeCity), "sapporo");
    await dialog.locator("[data-place-close]").focus(); await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.placeCity), "naha");
    await page.keyboard.press("Tab");
    assert.equal(await dialog.locator("[data-place-close]").evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Escape"); assert.equal(await dialog.isVisible(), false);
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator("#japan-layer").getAttribute("aria-hidden"), "false");
    await open(); await page.mouse.click(2, 2); assert.equal(await dialog.isVisible(), false);
    if (width === 390) {
      await open();
      await page.setViewportSize({ width: 844, height: 390 });
      await viewportCheck();
      await page.setViewportSize({ width: 390, height: 520 });
      await viewportCheck();
      await search.fill("神戸");
      assert.equal(await dialog.locator("[data-place-city]").count(), 1);
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 390, height: 844 });
    }
    for (const number of [15, 16, 17, 18, 19, 20]) {
      await page.evaluate(number => { GaiaMapCategories.buttons()[number - 1].click(); GaiaLiveExhibits.pausePoiAutoplay(); }, number);
      await open(); await dialog.locator('[data-place-city="naha"]').click(); await settled("naha");
      await page.locator('[data-live-poi-step="1"]').click(); await settled("sapporo");
      assert.equal(await trigger.getAttribute("data-city"), "sapporo");
    }
    await open(); await page.evaluate(() => GaiaMapCategories.buttons()[20].click());
    await page.waitForFunction(() => document.querySelector("#japan-layer").classList.contains("is-estat-exhibit"));
    assert.equal(await dialog.isVisible(), false, "Changing exhibits must not leave a modal blocking the map");
    if (width === 1440) {
      await page.evaluate(() => { GaiaMapCategories.buttons()[14].click(); GaiaLiveExhibits.selectObservationPoint("tokyo"); });
      await settled("tokyo"); await page.evaluate(() => GaiaLiveExhibits.resumePoiAutoplay());
      await open();
      await page.waitForTimeout(7600); await settled("tokyo");
      assert.equal(await page.locator("#japan-layer").getAttribute("data-live-poi-autoplay"), "paused");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#japan-layer").getAttribute("data-live-poi-autoplay"), "running");
      await page.evaluate(() => GaiaLiveExhibits.pausePoiAutoplay());
    }
    report.checks.push({ width, bounds, prefectures: found.length, regions: regions.length, search: true, keyboard: true, allSixExhibits: true });
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    console.log(`PASS ${width}: 47 places, regional/search selection, compact bounds, keyboard, backdrop, six exhibits and clean exit`);
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
