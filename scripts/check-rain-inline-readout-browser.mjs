import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/rain-observation-readout");
fs.mkdirSync(output, { recursive: true });
const rows = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8"))
  .modes.find(mode => mode.id === "forest-cloud-engine").signals.precipitation;
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 3840, height: 2160 },
    { width: 390, height: 844 }, { width: 320, height: 740 },
    { width: 280, height: 653 }, { width: 568, height: 320 },
    { width: 390, height: 844, reduced: true },
  ].filter(viewport => !process.argv[4] || process.argv[4].split(",").map(Number).includes(viewport.width))) {
    const label = `${viewport.width}${viewport.reduced ? "-reduced" : ""}`;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: viewport.reduced ? "reduce" : "no-preference",
      deviceScaleFactor: viewport.width < 600 ? 2 : 1,
    });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");

    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${label}: ${error.message}`));
    await page.goto(`${base}/?preview=rain-inline-readout#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
      GaiaMapDemo.stop();
      [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => button.textContent.trim() === "08").click();
    });
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.forestRevealState === "complete");
    await page.evaluate(() => document.fonts.ready);
    for (const [index, row] of rows.entries()) {
      if (process.argv[5] && !process.argv[5].split(",").includes(row.id)) continue;
      const started = await page.evaluate(({ index, row, count }) => {
        GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 2,
          targetX: index % 3 === 0 ? .2 : index % 3 === 1 ? .8 : .5,
          targetY: index % 2 ? .2 : .55, durationMs: 120, label: "rain-readout-test" });
        GaiaMapObservationAdapter.setSignalTime(((index + .5) / count) * 100);
        return performance.now();
      }, { index, row, count: rows.length });
      await page.waitForFunction(value => {
        const data = document.querySelector("#japan-overlay").dataset;
        return data.selectionLabelSecondary === `降水量　${value} mm/日` && data.viewAnimation === "idle";
      }, row.precipitationMmDay.toFixed(2));
      const scan = await page.evaluate(() => {
        const overlay = document.querySelector("#japan-overlay");
        const data = overlay.dataset;
        const map = overlay.getBoundingClientRect();
        const left = Number(data.selectionLabelLeftPx) + map.left;
        const top = Number(data.selectionLabelTopPx) + map.top;
        const right = left + Number(data.selectionLabelWidthPx);
        const bottom = top + Number(data.selectionLabelHeightPx);
        const overlaps = [...document.querySelectorAll(
          "#japan-layer button, .japan-heading, .signal-console-map, .map-command-dock, .map-mode-bank, #map-reading-guide, .signal-encoding-legend-dock, #gaia-map-zoom-controls, #co2-timeline-display, #gaia-audio-toggle",
        )].filter(element => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return bounds.width > 2 && bounds.height > 2 && style.visibility !== "hidden" && Number(style.opacity) > 0
            && left < bounds.right && right > bounds.left && top < bounds.bottom && bottom > bounds.top;
        }).map(element => element.id || element.className);
        return { lines: JSON.parse(data.selectionLabelLines), secondary: data.selectionLabelSecondary, bodyWidth: Number(data.selectionLabelBodyWidth), shadow: data.selectionLabelShadowBlur, shape: data.selectionLabelShape,
          name: data.selectionLabelFullName, displayName: data.selectionLabelDisplayName,
          left: Number(data.selectionLabelLeftPx), top: Number(data.selectionLabelTopPx),
          width: Number(data.selectionLabelWidthPx), height: Number(data.selectionLabelHeightPx),
          placement: data.selectionLabelPlacement, rain: data.forestRainBrazil, overlaps };
      });
      assert.equal(scan.shape, "observation-card");
      assert.deepEqual([...new Set(scan.lines.map(line => line.index))], [0, 1, 2]);
      assert.equal(scan.secondary, `降水量　${row.precipitationMmDay.toFixed(2)} mm/日`);
      assert.equal(scan.lines.filter(line => line.index === 1).map(line => line.text).join("").replace(/\s/gu, ""), `降水量${row.precipitationMmDay.toFixed(2)}mm/日`);
      assert(scan.lines.filter(line => line.index === 2).map(line => line.text).join("").replace(/\s/gu, "").includes("NASAPOWER"));
      assert.equal(scan.rain, "5.33 mm/日");
      assert(scan.left >= 11.9 && scan.left + scan.width <= viewport.width - 11.9, `${label}/${row.id}: card exceeds viewport`);
      assert(scan.top >= 11.9 && scan.top + scan.height <= viewport.height - 11.9);
      for (const item of scan.lines) {
        assert.match(item.font, /^400 .*?(Mincho|Serif|serif)/u);
        assert(item.width <= scan.bodyWidth + 1, "Do not compress glyphs");
        assert(item.width <= item.columnWidth + 1, "Keep each field inside its own column");
      }
      assert.equal(scan.shadow, "0", "Readout must not have neon text glow");
      assert.equal(scan.displayName, scan.name, "Site names must be complete");
      report.checks.push({ viewport: label, id: row.id, ...scan });
      if (scan.overlaps.length) await page.screenshot({ path: path.join(output, "failure.png") });
      assert.deepEqual(scan.overlaps, [], `${label}/${row.id}: readout is hidden by controls`);
      if (["cuba", "brazil", "japan"].includes(row.id)) {
        await page.screenshot({ path: path.join(output, `${label}-${row.id}.jpg`), type: "jpeg", quality: 90 });
        await page.screenshot({ path: path.join(output, `${label}-${row.id}-detail.png`),
          clip: { x: Math.max(0, scan.left - 10), y: Math.max(0, scan.top - 10),
            width: Math.min(viewport.width - Math.max(0, scan.left - 10), scan.width + 20), height: scan.height + 20 } });
      }
    }
    // A non-card exhibit must clear the previous observation's diagnostics.
    await page.evaluate(() => GaiaMapObservationAdapter.selectMode(1));
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning")
      && document.querySelector("#japan-overlay").dataset.selectionLabelVisible === "false");
    console.log(`PASS ${label}: ${process.argv[5] || "all 31 sites"}, three Mincho blocks, no glow, full names/values/source`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
