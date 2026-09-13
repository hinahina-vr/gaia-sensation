import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/poi-pin");
const fires = JSON.parse(fs.readFileSync("data/firms-active-fire-snapshot.json", "utf8"));
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const errors = [];
let page;
const focusPoint = async row => {
  await page.evaluate(row => GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 5, targetX: .5, targetY: .38, durationMs: 120 }), row);
  await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
  await page.waitForTimeout(100);
  return page.evaluate(row => {
    const data = document.querySelector("#japan-overlay").dataset;
    const rect = document.querySelector("#japan-map").getBoundingClientRect();
    const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(data.earthZoom);
    return { x: rect.left + rect.width / 2 + Number(data.earthOffsetX) + (((row.lon - Number(data.earthCenterLongitude) + 540) % 360) - 180) * scale,
      y: rect.top + rect.height / 2 + Number(data.earthOffsetY) - row.lat * scale };
  }, row);
};
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 600 });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/firms*", route => route.fulfill({ json: fires }));
    page = await context.newPage();
    page.on("pageerror", error => errors.push(`${width}: ${error.message}`));
    await page.clock.install();
    await page.goto(`${base}/?mode=13&preview=poi-pin#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaMapDemo && globalThis.GaiaFirmsExhibit);
    const japan = await page.evaluate(async () => {
      const data = await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop();
      GaiaMapObservationAdapter.selectMode(7);
      return data.modes.find(mode => mode.id === "earth-organ").signals.current.find(row => row.iso3 === "JPN");
    });
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
    const point = await focusPoint(japan);
    if (width < 600) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.renewableSelectedIso3 === "JPN" && GaiaMapObservationAdapter.getState().timelineManuallyPaused);
    await page.locator("#japan-poi-card").waitFor({ state: "visible" });
    const pinned = await page.evaluate(() => GaiaMapObservationAdapter.getState());
    await page.clock.fastForward(30000);
    assert.equal((await page.evaluate(() => GaiaMapObservationAdapter.getState())).signalTimePosition, pinned.signalTimePosition);
    await page.locator("#japan-poi-close").click();
    await page.clock.fastForward(30000);
    assert.equal((await page.evaluate(() => GaiaMapObservationAdapter.getState())).signalTimePosition, pinned.signalTimePosition, "Closing the POI card must not restart the timeline");
    await page.screenshot({ path: path.join(output, `${width}-renewable-pinned.png`) });

    await page.evaluate(async () => { await GaiaFirmsExhibit.select(); GaiaMapDemo.stop(); });
    await page.waitForFunction(() => Number(document.querySelector("#gaia-firms-canvas").dataset.firmsPointCount) > 0);
    await page.clock.fastForward(12000);
    const firePoint = await focusPoint(fires.points[0]);
    const hit = await page.evaluate(p => GaiaFirmsExhibit.findPoiAt(p.x, p.y, "mouse"), firePoint);
    assert(hit, "Fixture must be a visible FIRMS POI");
    if (width < 600) await page.touchscreen.tap(firePoint.x, firePoint.y); else await page.mouse.click(firePoint.x, firePoint.y);
    await page.waitForFunction(() => !GaiaFirmsExhibit.getState().playbackEnabled);
    const readFire = () => page.locator("#gaia-firms-canvas").evaluate(node => ({ progress: node.dataset.firmsPlaybackProgress, extinguish: node.dataset.firmsExtinguishProgress }));
    const frozenFire = await readFire();
    await page.clock.fastForward(30000);
    assert.deepEqual(await readFire(), frozenFire, "FIRMS reveal and expiry must both remain fixed");
    await page.locator("#japan-poi-close").click();
    await page.locator("[data-firms-progress]").focus(); await page.locator("[data-firms-progress]").press("ArrowRight");
    await page.waitForTimeout(150);
    const scrubbedFire = await readFire();
    await page.clock.fastForward(30000);
    assert.deepEqual(await readFire(), scrubbedFire);
    assert.equal((await page.evaluate(() => GaiaFirmsExhibit.getState())).playbackEnabled, false);

    await page.evaluate(() => GaiaLiveExhibits.select(0));
    await page.locator(".gaia-live-place-selector").click();
    await page.locator('[data-place-city="tokyo"]').click();
    await page.waitForFunction(() => document.querySelector('[data-live-city-marker="tokyo"]').getAttribute("aria-current") === "true");
    await page.clock.fastForward(30000);
    assert.equal(await page.locator("#japan-layer").getAttribute("data-live-poi-autoplay"), "paused", "Closing the picker after selection must not resume the old timer");
    assert.equal(await page.locator('[data-live-city-marker="tokyo"]').getAttribute("aria-current"), "true");
    console.log(`PASS ${width}: real renewable POI click/close stays pinned, FIRMS POI reveal/expiry frozen and slider manual, live picker stays manual`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} catch (error) {
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally { await browser.close(); }
