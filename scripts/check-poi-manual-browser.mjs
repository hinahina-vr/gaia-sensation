import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { earthLongitudeToMapX } from "../src/exploration/world-projection.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/poi-manual");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const estatState = () => page.evaluate(() => GaiaEstatExhibits.getState());
const fastForward = async () => { await page.clock.fastForward(30000); await page.waitForTimeout(120); };
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const mobile = viewport.width < 600;
    const context = await browser.newContext({ viewport, hasTouch: mobile, reducedMotion: "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${viewport.width}: ${error.message}`));
    await page.clock.install();
    await page.goto(`${base}/?mode=21&preview=poi-manual#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaEstatExhibits && globalThis.GaiaMapDemo && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop();
      await GaiaEstatExhibits.select(0);
    });
    const initial = await estatState();
    assert(initial.playbackEnabled, "New exhibit should still autoplay before interaction");
    await page.clock.fastForward(4100);
    await page.waitForFunction(initial => {
      const state = GaiaEstatExhibits.getState();
      return state.selectedIndex !== initial.selectedIndex && state.periodIndex !== initial.periodIndex;
    }, initial);
    assert.equal(await page.locator(".gaia-estat-prefecture-region").count(), 47);
    assert.equal(await page.locator("#japan-layer").getAttribute("data-estat-poi-display"), "prefecture-regions");
    assert(await page.locator(".gaia-estat-markers").isHidden(), "Migration must not display dot markers");
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: 143.3, lat: 44, zoom: 8, targetX: .5, targetY: .45, durationMs: 120 }));
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
    await page.waitForTimeout(120);
    const point = await page.locator(".gaia-estat-prefecture-regions > g").evaluate((group, x) => {
      const p = new DOMPoint(x, 90 - 44).matrixTransform(group.getScreenCTM());
      return { x: p.x, y: p.y, target: document.elementFromPoint(p.x, p.y)?.getAttribute("data-estat-prefecture") };
    }, earthLongitudeToMapX(143.3));
    assert.equal(point.target, "01", "Hokkaido interior must hit its polygon, away from Sapporo's old point");
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => GaiaEstatExhibits.getState().selectedIndex === 0 && !GaiaEstatExhibits.getState().playbackEnabled);
    const pinned = await estatState();
    await fastForward();
    assert.deepEqual(await estatState(), pinned, "POI and year must stay pinned beyond all old autoplay delays");
    const slider = page.locator("[data-estat-month]");
    await slider.focus(); await slider.press("ArrowRight");
    const scrubbed = await estatState();
    assert.equal(scrubbed.selectedIndex, 0);
    assert.equal(scrubbed.periodIndex, pinned.periodIndex + 1);
    await page.mouse.move(2, 2);
    await fastForward();
    assert.deepEqual(await estatState(), scrubbed, "Manual slider must not restart location or year playback");
    const label = page.locator(".gaia-estat-prefecture-tooltip");
    assert(await label.isVisible());
    assert((await label.textContent()).includes(scrubbed.period));
    assert((await label.textContent()).includes("北海道"));
    assert.equal(await page.locator(".gaia-estat-readout").getAttribute("data-estat-observation-station"), "", "Population data must not become weather-station data");
    await page.screenshot({ path: path.join(output, `${viewport.width}-migration.png`) });
    // Explicitly restarting the demo is the only automatic restart in this visit.
    await page.evaluate(() => GaiaMapDemo.start());
    assert((await estatState()).playbackEnabled);
    await page.evaluate(() => { GaiaMapDemo.stop(); GaiaEstatExhibits.pausePlayback(); });
    report.checks.push({ width: viewport.width, migration: "47 polygons, no dots, pointer pin, manual year, 30s hold, explicit resume" });

    for (let index = 1; index < 10; index++) {
      await page.evaluate(async index => { await GaiaEstatExhibits.select(index); }, index);
      const poi = index < 3 ? page.locator(".gaia-estat-marker").nth(12) : page.locator('.gaia-estat-prefecture-region[data-estat-prefecture="13"]');
      await poi.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
      // Keyboard activation follows the same button handlers on desktop and touch layouts.
      await poi.focus(); await poi.press("Enter");
      await page.waitForFunction(() => GaiaEstatExhibits.getState().selectedIndex === 12);
      const selected = await estatState();
      assert.equal(selected.selectedIndex, 12, `MAP ${21 + index}: keyboard did not select Tokyo`);
      assert.equal(selected.playbackEnabled, false);
      await slider.focus(); await slider.press("ArrowRight");
      const before = await estatState();
      await fastForward();
      assert.deepEqual(await estatState(), before, `MAP ${21 + index}: manual choice drifted`);
    }
    report.checks.push({ width: viewport.width, otherEstat: "22–30 POI and slider pin" });

    await page.evaluate(() => GaiaEstatExhibits.deactivate());
    for (let index = 0; index < 9; index++) {
      await page.evaluate(index => GaiaMapObservationAdapter.selectMode(index), index);
      if (index === 6) {
        if (mobile) await page.locator(".map-mobile-ecology-summary button").click();
        await page.locator(".eco-country").waitFor({ state: "visible" });
        await page.locator(".eco-country").selectOption("JPN");
        if (mobile) await page.keyboard.press("Escape");
      } else {
        const range = page.locator("#japan-layer [data-signal-time]").first();
        await range.waitFor({ state: "visible" });
        await range.focus(); await range.press("ArrowRight");
      }
      const before = await page.evaluate(() => GaiaMapObservationAdapter.getState());
      assert(before.timelineManuallyPaused && before.timelineHeld, `Standard mode ${index}: not held`);
      await fastForward();
      assert.equal((await page.evaluate(() => GaiaMapObservationAdapter.getState())).signalTimePosition, before.signalTimePosition, `Standard mode ${index}: slider drifted`);
    }
    report.checks.push({ width: viewport.width, standard: "06–14 manual slider hold" });

    // The live deck used to resume 12 seconds after manual POI selection.
    await page.evaluate(() => GaiaLiveExhibits.select(0));
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
    await page.locator('[data-live-city-marker="tokyo"]').waitFor({ state: "visible" });
    await page.locator('[data-live-city-marker="tokyo"]').focus();
    await page.locator('[data-live-city-marker="tokyo"]').press("Enter");
    await page.waitForFunction(() => document.querySelector('[data-live-city-marker="tokyo"]').getAttribute("aria-current") === "true");
    await fastForward();
    assert.equal(await page.locator("#japan-layer").getAttribute("data-live-poi-autoplay"), "paused");
    assert.equal(await page.locator('[data-live-city-marker="tokyo"]').getAttribute("aria-current"), "true");
    report.checks.push({ width: viewport.width, live: "manual Tokyo selection stays pinned beyond 12s" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    console.log(`PASS ${viewport.width}: migration polygon click/no dots; all 10 prefecture exhibits; 9 standard sliders; live manual pin`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
