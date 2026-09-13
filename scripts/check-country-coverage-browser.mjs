import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/country-coverage-browser");
fs.mkdirSync(output, { recursive: true });
const snapshot = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8"));
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }].filter(viewport => !process.argv[4] || process.argv[4].split(",").map(Number).includes(viewport.width))) {
    const mobile = viewport.width < 600;
    const context = await browser.newContext({ viewport, hasTouch: mobile, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${viewport.width}: ${error.message}`));
    await page.goto(`${base}/?mode=10&preview=country-coverage#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapDemo);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
    for (const [number, index, id, key] of [
      [7, 1, "blue-circulation", "climate"], [8, 2, "forest-cloud-engine", "precipitation"],
      [9, 3, "nothing-is-waste", "countryWaste"], [10, 4, "anthropocene-scar", "emissions"],
      [12, 6, "three-ecologies", "pairedCountries"],
    ]) {
      const mode = snapshot.modes.find(mode => mode.id === id), rows = mode.signals[key];
      await page.evaluate(index => { GaiaMapObservationAdapter.closePoi(); GaiaMapObservationAdapter.selectMode(index); GaiaMapDemo.stop(); }, index);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning") && document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
      const actual = await page.evaluate(async ({ id, key }) => (await GaiaMapObservationAdapter.waitSignalsReady()).modes.find(mode => mode.id === id).signals[key].length, { id, key });
      assert.equal(actual, rows.length);
      if (number === 7) {
        assert(rows.length >= 230);
        const wind = rows.find(row => row.iso3 === "DEU"); assert(wind.windSpeedMs > 0);
      } else if (number === 8) {
        await page.evaluate(({ row, index, count }) => {
          GaiaMapObservationAdapter.setSignalTime((index + .5) / count * 100);
          GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 3.5, targetX: .5, targetY: .4, durationMs: 0 });
        }, { row: rows.find(row => row.iso3 === "DEU"), index: rows.findIndex(row => row.iso3 === "DEU"), count: rows.length });
        await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.selectionLabelPrimary?.includes("ドイツ"));
        assert((await page.locator("#japan-overlay").getAttribute("data-selection-label-secondary")).includes(rows.find(row => row.iso3 === "DEU").precipitationMmDay.toFixed(2)));
      } else if (number === 9) {
        const selected = rows.findIndex(row => row.iso3 === "DEU");
        await page.evaluate(({ selected, row }) => {
          const input = document.querySelector("#japan-layer [data-signal-time]");
          input.value = String(selected); input.dispatchEvent(new Event("input", { bubbles: true }));
          GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 3.5, targetX: .5, targetY: .4, durationMs: 0 });
        }, { selected, row: rows[selected] });
        await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.selectionLabelPrimary?.includes("ドイツ"));
        const max = await page.locator("#japan-layer [data-signal-time]").first().getAttribute("max"); assert.equal(Number(max), rows.length - 1);
      } else if (number === 10) {
        const years = [...new Set(rows.map(row => row.year))].sort((a, b) => a - b);
        for (const year of [1955, 2023]) {
          await page.evaluate(position => GaiaMapObservationAdapter.setSignalTime(position), (years.indexOf(year) + .5) / years.length * 100);
          await page.waitForFunction(year => document.querySelector("#japan-overlay").dataset.emissionsSelectedYear === String(year), year);
          const count = Number(await page.locator("#japan-overlay").getAttribute("data-emissions-country-fill-count"));
          assert(count >= (year === 1955 ? 175 : 200), `${year}: only ${count} polygons painted`);
          report.checks.push({ width: viewport.width, number, year, paintedCountries: count });
          if (year === 2023) await page.screenshot({ path: path.join(output, `${viewport.width}-10-world.png`) });
        }
        const row = rows.find(row => row.iso3 === "DEU" && row.year === 2023);
        await page.evaluate(row => GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 4, targetX: .5, targetY: .4, durationMs: 0 }), row);
        const point = await page.evaluate(row => {
          const overlay = document.querySelector("#japan-overlay"), rect = document.querySelector("#japan-map").getBoundingClientRect();
          const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(overlay.dataset.earthZoom);
          return { x: rect.left + rect.width / 2 + Number(overlay.dataset.earthOffsetX) + (((row.lon - Number(overlay.dataset.earthCenterLongitude) + 540) % 360) - 180) * scale,
            y: rect.top + rect.height / 2 + Number(overlay.dataset.earthOffsetY) - row.lat * scale };
        }, row);
        if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
        await page.waitForFunction(() => document.querySelector("#japan-poi-history").dataset.country === "DEU" && document.querySelector("#japan-poi-history").dataset.state === "ready");
        const displayed = await page.locator(".country-emissions-values tbody tr").evaluateAll(nodes => nodes.map(node => [Number(node.querySelector("th").textContent), Number(node.querySelector("td").dataset.value)]));
        assert.deepEqual(displayed, rows.filter(row => row.iso3 === "DEU").map(row => [row.year, row.emissionsMtCo2]));
      } else {
        if (mobile) await page.locator(".map-mobile-ecology-summary button").click();
        const panel = page.locator("#ecologies-exhibit");
        await panel.locator(".eco-country").selectOption("DEU");
        await page.waitForFunction(() => document.querySelector("#ecologies-exhibit").dataset.selected === "DEU");
        assert.equal(await panel.locator(".eco-country option").count(), rows.length);
        await panel.locator('[data-eco-view="pattern"]').click();
        assert.equal(await panel.locator(".eco-scatter-point").count(), rows.length);
        const bounds = await panel.evaluate(node => ({ overflow: node.scrollWidth - node.clientWidth, ...node.getBoundingClientRect().toJSON() }));
        assert(bounds.overflow <= 1); assert(bounds.left >= 0 && bounds.right <= viewport.width);
        assert(Number(await page.locator("#japan-overlay").getAttribute("data-ecologies-country-display-ms")) >= 3000);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await page.screenshot({ path: path.join(output, `${viewport.width}-${String(number).padStart(2, "0")}.png`) });
      report.checks.push({ width: viewport.width, number, sourceRows: actual });
      console.log(`PASS ${viewport.width} MAP ${number}: ${actual} rows and focused readout`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
