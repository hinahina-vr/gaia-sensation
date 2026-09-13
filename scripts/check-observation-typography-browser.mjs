import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const widths = (process.argv[3] || "1440,390,320,3840").split(",").map(Number);
const output = path.resolve("artifacts/observation-typography");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const height = width >= 2400 ? 2160 : width === 320 ? 568 : width < 900 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, error: error.message }));
    await page.goto(`${base}/?mode=8&preview=observation-typography#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length === 30);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); await document.fonts.ready; GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
    for (const number of [6, 7, 8, 9, 10, 11, 12, 14]) {
      if (number === 11 || number === 12) {
        // The quake's camera callout intentionally skips motion under reduce.
        await page.emulateMedia({ reducedMotion: number === 11 ? "no-preference" : "reduce" });
        await page.goto(`${base}/?mode=${number}&preview=observation-typography#world`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length === 30);
        await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); await document.fonts.ready; GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
      }
      await page.evaluate(number => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => Number(button.textContent) === number).click(), number);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      if ([8, 9, 10, 14].includes(number)) {
        await page.evaluate(async number => {
          GaiaMapObservationAdapter.closePoi();
          GaiaMapObservationAdapter.setSignalTime(0);
          const snapshot = await GaiaMapObservationAdapter.waitSignalsReady();
          const row = number === 8 ? snapshot.modes.find(mode => mode.id === "forest-cloud-engine").signals.precipitation[0]
            : number === 9 ? snapshot.modes.find(mode => mode.id === "nothing-is-waste").signals.countryWaste[0] : { lon: 138, lat: 36 };
          GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 1.5, targetX: .5, targetY: .45, durationMs: 0 });
        }, number);
      }
      if (number === 11) await page.evaluate(() => GaiaMapObservationAdapter.setSignalTime(4.1 / 27 * 100));
      if ([8, 9, 10, 11, 14].includes(number)) await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.selectionLabelVisible === "true", null, { timeout: 25000 });
      else await page.waitForTimeout(250);
      const scan = await page.evaluate(() => {
        const canvas = document.querySelector("#japan-overlay"), box = canvas.getBoundingClientRect();
        const obstacles = [...document.querySelectorAll("#japan-layer .signal-encoding-legend-dock, #japan-layer .map-command-dock, #japan-layer .signal-console-map, #co2-timeline-display, #gaia-map-zoom-controls")]
          .filter(node => node.checkVisibility() && getComputedStyle(node).visibility !== "hidden" && Number(getComputedStyle(node).opacity) > 0).map(node => ({ name: node.className, ...node.getBoundingClientRect().toJSON() }));
        const fields = [...document.querySelectorAll("#japan-layer .ecologies-exhibit h2, #japan-layer .eco-country-card strong, #japan-layer .signal-console-map [data-signal-value], #co2-timeline-display strong")]
          .filter(node => node.checkVisibility()).map(node => ({ text: node.textContent, font: getComputedStyle(node).fontFamily, weight: getComputedStyle(node).fontWeight }));
        return { data: { ...canvas.dataset }, box: box.toJSON(), obstacles, fields, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      report.checks.push({ width, number, ...scan });
      assert.equal(scan.overflow, 0, `${width}/${number}: horizontal overflow`);
      for (const field of scan.fields) { assert.match(field.font, /Mincho|Serif|serif/u); assert.equal(field.weight, "400"); }
      if ([8, 9, 10, 11, 14].includes(number)) {
        const data = scan.data;
        assert.equal(data.selectionLabelShape, "observation-card");
        assert.equal(data.selectionLabelTypography, "mincho");
        assert.equal(data.selectionLabelShadowBlur, "0");
        const lines = JSON.parse(data.selectionLabelLines);
        assert.deepEqual([...new Set(lines.map(line => line.index))], [0, 1, 2]);
        assert(lines.every(line => /^400 /.test(line.font) && /Mincho|Serif|serif/.test(line.font)));
        assert(lines.every(line => line.width <= Number(data.selectionLabelBodyWidth) + 1), `${width}/${number}: compressed or clipped line`);
        assert(lines.every(line => line.width <= line.columnWidth + 1), `${width}/${number}: clipped inline field`);
        assert(lines.find(line => line.index === 0).left < lines.find(line => line.index === 1).left);
        assert.equal(data.selectionLabelBackgroundAlpha, "0.8");
        assert(data.selectionLabelDetail && data.selectionLabelDetail !== "—");
        const card = { x: Number(data.selectionLabelLeftPx) + scan.box.x, y: Number(data.selectionLabelTopPx) + scan.box.y, width: Number(data.selectionLabelWidthPx), height: Number(data.selectionLabelHeightPx) };
        assert(card.x >= 0 && card.y >= 0 && card.x + card.width <= width + 1 && card.y + card.height <= height + 1, `${width}/${number}: card outside viewport`);
        if (data.auxiliaryPanelId) scan.obstacles.push({ name: "canvas-metric", x: Number(data.auxiliaryPanelScreenLeft), y: Number(data.auxiliaryPanelScreenTop), right: Number(data.auxiliaryPanelScreenRight), bottom: Number(data.auxiliaryPanelScreenBottom) });
        for (const box of scan.obstacles) {
          const overlap = Math.max(0, Math.min(card.x + card.width, box.right) - Math.max(card.x, box.x)) * Math.max(0, Math.min(card.y + card.height, box.bottom) - Math.max(card.y, box.y));
          assert(overlap < 2, `${width}/${number}: card overlaps ${box.name}`);
        }
        await page.screenshot({ path: path.join(output, `${width}-${number}-card.png`), clip: card });
      }
      if ([8, 9, 11, 12, 14].includes(number)) await page.screenshot({ path: path.join(output, `${width}-${number}.jpg`), type: "jpeg", quality: 85 });
      console.log(`PASS ${width}/${number}: Mincho observation hierarchy, readable values, clear controls`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" }).catch(() => {});
  throw error;
} finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
