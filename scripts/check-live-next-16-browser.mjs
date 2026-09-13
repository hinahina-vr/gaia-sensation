import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import "./check-exhibit-catalog.mjs";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-next-16");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], catalogs: [], navigation: [], errors: [] };
const ovation = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 720 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: ovation }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: {
          time: "2026-09-05T00:00", wind_speed_10m: 5, wind_direction_10m: 80,
          surface_pressure: 1005, cloud_cover: 58, shortwave_radiation: 194,
          pm2_5: 9.9, aerosol_optical_depth: .18,
        } }));
        return route.fulfill({ json: count === 1 ? rows[0] : rows });
      });
    }
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=live-next-16#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    const catalogs = await page.evaluate(async () => {
      const files = ["live-exhibits.js", "estat-exhibits.js", "observation-cities.js", "live-exhibit-catalog.js", "estat-exhibit-catalog.js"];
      const modules = Object.fromEntries(files.map(file => [file, performance.getEntriesByType("resource").filter(entry => new URL(entry.name).pathname.endsWith(`/${file}`)).map(entry => entry.name)]));
      const live = await import(modules["live-exhibit-catalog.js"][0]);
      const estat = await import(modules["estat-exhibit-catalog.js"][0]);
      const cities = await import(modules["observation-cities.js"][0]);
      const legacy = await import(modules["live-exhibits.js"][0]);
      return {
        loads: Object.fromEntries(Object.entries(modules).map(([name, urls]) => [name, urls.length])),
        liveShared: GaiaLiveExhibits.definitions === live.LIVE_EXHIBITS,
        estatShared: GaiaEstatExhibits.definitions === estat.ESTAT_EXHIBITS,
        citiesShared: GaiaLiveExhibits.observationPoints === cities.OBSERVATION_CITIES && legacy.OBSERVATION_CITIES === cities.OBSERVATION_CITIES,
        liveReadouts: document.querySelectorAll(".gaia-live-exhibit-readout").length,
        estatReadouts: document.querySelectorAll(".gaia-estat-readout").length,
      };
    });
    report.catalogs.push({ width, ...catalogs });
    assert(Object.values(catalogs.loads).every(count => count === 1), "Duplicate module request");
    assert(catalogs.liveShared && catalogs.estatShared && catalogs.citiesShared, "Runtime did not reuse the canonical catalog");
    assert.equal(catalogs.liveReadouts, 1);
    assert.equal(catalogs.estatReadouts, 1);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    const expectMode = async (number) => {
      await page.waitForFunction(number => document.querySelector("#japan-mode-number")?.textContent === number, number);
      await page.waitForTimeout(200);
      const state = await page.evaluate(() => ({
        selected: [...document.querySelectorAll('.map-mode-bank .map-mode-button[aria-current="true"]')].map(button => button.textContent.trim()),
        top: document.querySelector("#japan-title").textContent,
        dock: document.querySelector("#japan-mode-title").textContent,
        live: document.querySelector("#japan-layer").classList.contains("is-live-exhibit"),
        estat: document.querySelector("#japan-layer").classList.contains("is-estat-exhibit"),
      }));
      report.checks.push({ width, number, ...state });
      assert.deepEqual(state.selected, [number]);
      assert.equal(state.top, state.dock);
      assert.equal(state.live, Number(number) >= 10 && Number(number) <= 15);
      assert.equal(state.estat, Number(number) >= 16 && Number(number) <= 25);
    };
    const select = async number => {
      await page.evaluate(number => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => button.textContent.trim() === number).click(), number);
      await expectMode(number);
    };
    const step = async (selector, number) => {
      const button = page.locator(selector);
      if (width < 720 && !(await button.isVisible())) {
        // Mobile replaces the desktop-only live chapter arrows with the map bank.
        const toggle = page.locator("#map-mobile-bank-toggle");
        if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.tap();
        await page.locator(".map-mode-bank .map-mode-button").filter({ hasText: new RegExp(`^${number}$`, "u") }).tap();
      } else if (width < 720) await button.tap();
      else await button.click();
      await expectMode(number);
    };
    await select("14");
    await step('[data-live-deck-step="1"]', "15");
    assert.match(await page.locator('[data-live-deck-step="1"]').getAttribute("aria-label"), /16.*人の潮目/u);
    await step('[data-live-deck-step="1"]', "16");
    await page.screenshot({ path: path.join(output, `${width}-15-to-16.png`) });
    await step('[data-estat-step="-1"]', "15");
    await step('[data-live-deck-step="-1"]', "14");
    await select("10");
    const expectCity = async id => {
      await page.waitForFunction(id => document.querySelector("#gaia-live-exhibit-canvas").dataset.observationCity === id
        && document.querySelector("#japan-layer").dataset.livePoiTransition === "settled", id);
      assert.equal(await page.locator(".gaia-live-place-selector").getAttribute("data-city"), id);
    };
    const chooseCity = async id => {
      await page.evaluate(id => { GaiaLiveExhibits.selectObservationPoint(id); GaiaLiveExhibits.pausePoiAutoplay(); }, id);
      await expectCity(id);
    };
    await chooseCity("naha");
    assert.match(await page.locator('.gaia-live-exhibit-readout [data-live-poi-step="1"]').getAttribute("aria-label"), /01 北海道/u);
    await page.locator('.gaia-live-prefecture-picker [data-live-poi-step="1"]').click();
    await expectCity("sapporo");
    assert.match(await page.locator('.gaia-live-exhibit-readout [data-live-poi-step="-1"]').getAttribute("aria-label"), /47 沖縄県/u);
    await page.locator('.gaia-live-prefecture-picker [data-live-poi-step="-1"]').click();
    await expectCity("naha");
    await page.evaluate(() => GaiaLiveExhibits.resumePoiAutoplay());
    await expectCity("sapporo");
    await page.evaluate(() => GaiaLiveExhibits.pausePoiAutoplay());
    report.navigation.push({ width, forward: "naha -> sapporo", backward: "sapporo -> naha", automatic: "naha -> sapporo" });
    await page.screenshot({ path: path.join(output, `${width}-city-relay.png`) });
    await step('[data-live-deck-step="-1"]', "09");
    // Re-enter from another bank to catch stale aria-current selection.
    await select("25");
    await select("15");
    await step('[data-live-deck-step="1"]', "16");
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, output }));
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
