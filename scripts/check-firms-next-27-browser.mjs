import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/firms-next-27");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 3840, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : 900 }, hasTouch: width < 720 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8") }));
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
    await page.goto(`${base}/?preview=firms-next-27#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => globalThis.GaiaMapObservationAdapter.waitSignalsReady());
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await page.waitForTimeout(1700);
    const expectMode = async number => {
      await page.waitForFunction(number => document.querySelector("#japan-mode-number")?.textContent === number, number);
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => ({
        selected: [...document.querySelectorAll('.map-mode-bank .map-mode-button[aria-current="true"]')].map(button => button.textContent.trim()),
        top: document.querySelector("#japan-title").textContent,
        dock: document.querySelector("#japan-mode-title").textContent,
        firms: globalThis.GaiaFirmsExhibit.getState().active,
        estat: document.querySelector("#japan-layer").classList.contains("is-estat-exhibit"),
        planet: document.querySelector("#japan-layer").classList.contains("is-planet-signals-exhibit"),
        firmsCanvas: !document.querySelector("#gaia-firms-canvas").hidden,
        firmsReadout: !document.querySelector(".gaia-firms-readout").hidden,
        planetReadout: !document.querySelector(".gaia-planet-signals-readout").hidden,
      }));
      report.checks.push({ width, number, ...state });
      assert.deepEqual(state.selected, [number]);
      assert.equal(state.top, state.dock);
      assert.equal(state.firms, number === "26");
      assert.equal(state.firmsCanvas, number === "26");
      assert.equal(state.firmsReadout, number === "26");
      assert.equal(state.estat, number === "25");
      assert.equal(state.planet, ["27", "28"].includes(number));
      assert.equal(state.planetReadout, state.planet);
    };
    const step = async (selector, number) => {
      const button = page.locator(selector);
      if (width < 720) await button.tap();
      else await button.click();
      await expectMode(number);
    };
    await page.evaluate(() => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => button.textContent.trim() === "25").click());
    await expectMode("25");
    await step('[data-estat-step="1"]', "26");
    await step('[data-firms-step="1"]', "27");
    await page.screenshot({ path: path.join(output, `${width}-26-to-27.png`) });
    await step('[data-planet-step="1"]', "28");
    await step('[data-planet-step="-1"]', "27");
    await step('[data-planet-step="-1"]', "26");
    assert.match(await page.locator('[data-firms-step="1"]').getAttribute("aria-label"), /27/u);
    await step('[data-firms-step="-1"]', "25");
    // Re-enter once more: no stale heading, canvas, or selection from the previous trip.
    await step('[data-estat-step="1"]', "26");
    await step('[data-firms-step="1"]', "27");
    await context.close();
    console.log(`PASS ${width}: 25 → 26 → 27 → 28 → 27 → 26 → 25 → 26 → 27`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
