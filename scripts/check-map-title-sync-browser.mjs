import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [baseUrl = "http://127.0.0.1:4173", outputArgument = "artifacts/map-title-sync"] = process.argv.slice(2);
const output = path.resolve(outputArgument);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const ovation = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 3840, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 1800 : 900 }, reducedMotion: width === 1440 ? "no-preference" : "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ contentType: "application/json", body: ovation }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, (route) => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: {
          time: "2026-09-05T00:00", wind_speed_10m: 5, wind_direction_10m: 80,
          surface_pressure: 1005, cloud_cover: 58, shortwave_radiation: 194,
          pm2_5: 9.9, aerosol_optical_depth: .18,
        } }));
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(count === 1 ? rows[0] : rows) });
      });
    }
    await context.route("https://earthquake.usgs.gov/**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({
      type: "FeatureCollection", metadata: { generated: Date.now() }, features: [{ type: "Feature", id: "title-test", geometry: { type: "Point", coordinates: [140, 36, 10] }, properties: { mag: 3, time: Date.now(), place: "TEST" } }],
    }) }));
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(`${baseUrl}/?preview=title-sync#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    const select = async (number) => {
      await page.evaluate((number) => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find((button) => button.textContent.trim() === number).click(), number);
      await page.waitForFunction((number) => document.querySelector("#japan-mode-number").textContent === number, number);
      await page.waitForTimeout(180);
      const scan = await page.evaluate(() => ({
        width: innerWidth,
        number: document.querySelector("#japan-mode-number").textContent,
        bankTitle: document.querySelector("#japan-mode-title").textContent,
        dockTitle: document.querySelector("[data-map-dock-title]").textContent,
        topTitle: document.querySelector("#japan-title").textContent,
        topNumber: document.querySelector("#japan-title").dataset.exhibitNumber,
        topLabel: document.querySelector("#japan-title").getAttribute("aria-label"),
        selected: [...document.querySelectorAll('.map-mode-bank .map-mode-button[aria-current="true"]')].map((button) => button.textContent.trim()),
      }));
      report.scans.push(scan);
      assert.equal(scan.topTitle, scan.bankTitle, `${number}: top title must match the selected exhibit`);
      assert.equal(scan.dockTitle, scan.bankTitle);
      assert.equal(scan.topNumber, number);
      assert.equal(scan.topLabel, `${number} ${scan.bankTitle}`);
      assert.deepEqual(scan.selected, [number], "Exactly the selected exhibit must be current");
    };
    await select("06");
    // The same underlying mode is still active while an extension exhibit is shown.
    await select("26");
    await select("06");
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    assert.equal(await page.locator("#japan-title").textContent(), "積み重なるCO₂", "Title stays correct after the transition settles");
    await page.screenshot({ path: path.join(output, `${width}-26-to-06.png`) });
    for (const number of ["27", "28", "29", "30", "16", "25", "10", "15"]) {
      await select(number);
      await select("06");
    }
    await select("02");
    await select("26");
    await select("02");
    await select("26");
    await select("03");
    await select("03");
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log(JSON.stringify({ status: report.status, scans: report.scans.length, output }));
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
