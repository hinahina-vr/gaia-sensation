import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-loading");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const fixture = (city, wind) => ({ source: "live", events: [{
  eventId: `qa-${city}-${wind}`, provider: "open-meteo", datasetId: "QA current weather and atmosphere", status: "latest-published",
  observedAt: "2026-09-05T01:00:00Z", retrievedAt: "2026-09-05T01:01:00Z",
  location: city === "tokyo" ? { label: "Open-Meteo / 東京", lat: 35.6762, lon: 139.6503 }
    : { label: "Open-Meteo / 札幌", lat: 43.0618, lon: 141.3545 },
  provenance: { sourceUrl: "https://open-meteo.com/en/docs" },
  measurements: [
    ["weatherWindSpeed", wind, "m/s"], ["forecastCo2", 423.1, "ppm"], ["weatherPrecipitation", 0, "mm"],
    ["weatherTemperature", 21.6, "℃"], ["cloudCover", 63, "%"], ["pm25", 12.3, "µg/m³"],
  ].map(([key, value, unit]) => ({ key, value, unit, quality: "estimated", sourceKind: "MODEL" })),
}] });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.qaStreams = [];
      globalThis.EventSource = class {
        constructor(url) { this.url = String(url); this.callbacks = {}; globalThis.qaStreams.push(this); }
        addEventListener(type, callback) { this.callbacks[type] = callback; }
        close() { this.closed = true; }
        emit(type, data) { this.callbacks[type]?.({ data: JSON.stringify(data), lastEventId: "qa" }); }
      };
    });
    const requests = [];
    await context.route("**/api/live/v1/snapshot?*", route => { requests.push(route); });
    await context.route("**/api/live/v1/wind-field", route => route.fulfill({ json: { source: "qa", points: [] } }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    const respond = async (city, wind, status = 200) => {
      const deadline = Date.now() + 5000;
      while (!requests.some(route => new URL(route.request().url()).searchParams.get("city") === city)) {
        assert(Date.now() < deadline, `No request for ${city}`);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const index = requests.findIndex(route => new URL(route.request().url()).searchParams.get("city") === city);
      await requests.splice(index, 1)[0].fulfill({ status, json: status === 200 ? fixture(city, wind) : {} });
    };
    const select = async number => {
      await page.evaluate(number => {
        [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
          .find(button => button.textContent.trim() === String(number).padStart(2, "0")).click();
        globalThis.GaiaLiveExhibits.pausePoiAutoplay();
      }, number);
      await page.waitForFunction(number => document.querySelector("#japan-mode-number").textContent === String(number).padStart(2, "0"), number);
    };
    const selectCity = async city => {
      await page.locator(".gaia-live-place-selector").click();
      await page.locator(`[data-place-city="${city}"]`).click();
      await page.waitForFunction(city => globalThis.GaiaLiveData.getCity() === city, city);
      await page.evaluate(() => globalThis.GaiaLiveExhibits.pausePoiAutoplay());
    };
    const state = () => page.evaluate(() => ({
      city: globalThis.GaiaLiveData.getCity(), requestState: globalThis.GaiaLiveData.getState().requestState,
      value: document.querySelector("[data-live-exhibit-value]").textContent,
      kicker: document.querySelector("[data-live-exhibit-kicker]").textContent,
      feed: document.querySelector("[data-live-exhibit-feed-state]").textContent,
      time: document.querySelector("[data-live-exhibit-feed-time]").textContent,
      location: document.querySelector("[data-live-deck-location]").textContent,
      analysisDisabled: document.querySelector("[data-live-deck-analysis]").disabled,
    }));
    const settle = async (city, requestState = "ready") => page.waitForFunction(({ city, requestState }) => {
      const live = globalThis.GaiaLiveData.getState();
      return live.city === city && live.requestState === requestState;
    }, { city, requestState });
    await page.goto(`${base}/?live=1&preview=live-loading#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await select(10);
    const cold = await state();
    assert.equal(cold.city, "sapporo");
    assert.equal(cold.value, "取得中");
    assert.match(cold.kicker, /LOADING/);
    assert(cold.analysisDisabled);
    await page.evaluate(() => {
      globalThis.qaValueTrace = [];
      const read = () => globalThis.qaValueTrace.push(document.querySelector("[data-live-exhibit-value]").textContent);
      new MutationObserver(read).observe(document.querySelector(".gaia-live-exhibit-readout"), { childList: true, subtree: true, characterData: true });
      read();
    });
    await page.screenshot({ path: path.join(output, `${width}-loading.jpg`), type: "jpeg", quality: 85 });
    await respond("sapporo", 7.2);
    await settle("sapporo");
    for (let number = 10; number <= 15; number++) {
      await select(number);
      const display = await state();
      assert.equal(display.city, "sapporo");
      assert(!["取得中", "欠測", "—", ""].includes(display.value), `MAP${number} cleared an already loaded metric`);
      assert(!display.analysisDisabled);
    }
    await select(10);
    await selectCity("tokyo");
    assert.equal((await state()).value, "取得中", "Uncached Tokyo inherited Sapporo");
    await respond("tokyo", 3.2);
    await settle("tokyo");
    assert.equal((await state()).value, "3.2 m/s");
    const tokyoTime = (await state()).time;
    await select(9);
    await select(10);
    const reentry = await state();
    assert.equal(reentry.city, "tokyo", "Exhibit reentry reset to Sapporo");
    assert.equal(reentry.value, "3.2 m/s");
    await select(16);
    await select(10);
    assert.equal((await state()).value, "3.2 m/s", "eStat return cleared data");
    await selectCity("sapporo");
    const cached = await state();
    assert.equal(cached.value, "7.2 m/s");
    assert.match(cached.kicker, /UPDATING/);
    assert.equal(cached.location, "北海道（札幌市）");
    await page.screenshot({ path: path.join(output, `${width}-cached-updating.jpg`), type: "jpeg", quality: 85 });
    await respond("sapporo", 8.4);
    await settle("sapporo");
    // Deliver callbacks from a closed Sapporo stream while Tokyo is selected.
    await selectCity("tokyo");
    await page.evaluate(data => {
      qaStreams[0].emit("provider", data.events[0]);
      qaStreams[0].emit("snapshot", data);
    }, fixture("sapporo", 999));
    assert.equal((await state()).value, "3.2 m/s");
    await respond("tokyo", 3.9);
    await settle("tokyo");
    await page.evaluate(() => { void globalThis.GaiaLiveData.refresh(); });
    assert.equal((await state()).value, "3.9 m/s");
    await respond("tokyo", 0, 503);
    await settle("tokyo", "unavailable");
    const retained = await state();
    assert.equal(retained.value, "3.9 m/s");
    assert.equal(retained.time, tokyoTime);
    assert.match(retained.kicker, /CACHED/);
    await page.locator("[data-live-deck-source]").click();
    await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
    assert.match(await page.locator("#data-ledger-state").textContent(), /CACHED/);
    assert.match(await page.locator("[data-live-exhibit-feed-copy]").textContent(), /前回取得値/);
    await page.locator("#japan-data-close").click();
    await page.locator("[data-live-deck-analysis]").click();
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab.getState().analysisReady);
    assert.match(await page.locator("#gaia-statistics-context").textContent(), /10 .*風脈/);
    await page.locator("#gaia-statistics-close").click();
    // Deliberately reverse response order after a rapid city switch.
    await selectCity("sapporo");
    await selectCity("tokyo");
    await respond("tokyo", 4.1);
    await settle("tokyo");
    await respond("sapporo", 99);
    await page.waitForTimeout(100);
    assert.equal((await state()).value, "4.1 m/s");
    await selectCity("sendai");
    assert.equal((await state()).value, "取得中");
    await respond("sendai", 0, 503);
    await settle("sendai", "unavailable");
    const unavailable = await state();
    assert.equal(unavailable.value, "—");
    assert.match(unavailable.feed, /未収録/);
    assert(unavailable.analysisDisabled);
    const trace = await page.evaluate(() => qaValueTrace);
    assert(!trace.includes("欠測"), "The missing-data flash returned");
    assert(!trace.includes(""), "The value flashed blank");
    report.checks.push({ width, cold, reentry, cached, retained, unavailable, renderedSamples: trace.length, responseRaces: "passed", oldStream: "ignored" });

    // The real static preview has only Tokyo model data, never relabel it as another city.
    await page.goto(`${base}/?preview=live-loading-static#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await select(10);
    await settle("sapporo", "unavailable");
    assert.equal((await state()).value, "—");
    await selectCity("tokyo");
    await settle("tokyo");
    assert.equal((await state()).value, "3.2 m/s");
    await select(9);
    await select(10);
    assert.equal((await state()).value, "3.2 m/s");
    await page.screenshot({ path: path.join(output, `${width}-static-return.jpg`), type: "jpeg", quality: 85 });
    console.log(`PASS ${width}px: loading/retained values, MAP10–15 switching, reentry, request races, unavailable data, source/analysis and real static preview`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
