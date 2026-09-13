import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/renewable-label-clean");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const errors = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/?mode=13&preview=renewable-label-clean#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapDemo);
    const fixtures = await page.evaluate(async () => {
      const data = await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop(); GaiaMapObservationAdapter.selectMode(7);
      const signals = data.modes.find(mode => mode.id === "earth-organ").signals;
      const rows = [...signals.current].sort((a, b) => b.renewablePercent - a.renewablePercent);
      return [rows.find(row => !signals.potential.some(p => p.iso3 === row.iso3)), rows.find(row => row.iso3 === "JPN")]
        .map(row => ({ ...row, index: rows.findIndex(candidate => candidate.iso3 === row.iso3) }));
    });
    for (const row of fixtures) {
      await page.evaluate(row => {
        GaiaMapObservationAdapter.closePoi();
        const input = document.querySelector("#japan-layer [data-signal-time]");
        input.value = String(row.index); input.dispatchEvent(new Event("input", { bubbles: true }));
        GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 3, targetX: .5, targetY: .38, durationMs: 0 });
      }, row);
      await page.waitForFunction(iso3 => {
        const data = document.querySelector("#japan-overlay").dataset;
        return data.renewableSelectedIso3 === iso3 && data.renewableSelectionLabelVisible === "true" && data.plotRevealState === "complete";
      }, row.iso3);
      const data = await page.locator("#japan-overlay").evaluate(node => ({ ...node.dataset }));
      const lines = JSON.parse(data.renewableSelectionLabelLines);
      assert.equal(data.renewableSelectionLabelDetail, "");
      assert(lines.length >= 2 && lines.every(line => line.index < 2), "Only country and percentage should be drawn");
      assert.doesNotMatch(lines.map(line => line.text).join(""), /年の値|代表点|未収録|日射|風/u);
      assert(data.renewableSelectionLabelSecondary.includes(`${row.renewablePercent.toFixed(1)}%`));
      const accessible = await page.locator("#japan-layer [data-signal-time]").first().getAttribute("aria-valuetext");
      assert(accessible.includes(`${row.year}年`), "Source year must remain available outside the removed label");
      await page.screenshot({ path: path.join(output, `${viewport.width}-${row.iso3}.png`) });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    console.log(`PASS ${viewport.width}: removed annotation for countries with/without climate data, retained country, percentage and accessible year`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
