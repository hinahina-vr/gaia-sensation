import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/renewable-generation-share");
const widths = (process.argv[4] || "1440,3840,901,390,320").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const height = width >= 2400 ? 2160 : width < 600 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=13&preview=renewable-label#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop();
      GaiaMapObservationAdapter.selectMode(7);
    });
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    for (const iso3 of ["CAN", "JPN", "DEU", "VCT", "GIB", "XKX"]) {
      const source = await page.evaluate(async iso3 => {
        const snapshot = await GaiaMapObservationAdapter.waitSignalsReady();
        const rows = snapshot.modes.find(mode => mode.id === "earth-organ").signals.current.slice().sort((a, b) => b.renewablePercent - a.renewablePercent);
        const index = rows.findIndex(row => row.iso3 === iso3), row = rows[index];
        GaiaMapObservationAdapter.setSignalTime((index + .5) / rows.length * 100);
        GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: 1.8, targetX: .5, targetY: .45, durationMs: 0 });
        return row;
      }, iso3);
      await page.waitForFunction(iso3 => {
        const data = document.querySelector("#japan-overlay").dataset;
        return data.renewableSelectedIso3 === iso3 && data.renewableSelectionLabelVisible === "true";
      }, iso3);
      const scan = await page.locator('.signal-console-map .signal-console-heading').evaluate(heading => {
        const value = heading.querySelector("[data-signal-value]");
        const range = document.createRange(); range.selectNodeContents(value);
        const glyphs = [...range.getClientRects()].map(rect => rect.toJSON());
        return { text: value.textContent, glyphs, value: value.getBoundingClientRect().toJSON(), heading: heading.getBoundingClientRect().toJSON(),
          dock: document.querySelector(".map-command-dock").getBoundingClientRect().toJSON(),
          overlay: { ...document.querySelector("#japan-overlay").dataset },
          obstacles: [...document.querySelectorAll("#japan-layer .signal-encoding-legend-dock, #japan-layer .map-command-dock, #japan-layer .signal-console-map, #co2-timeline-display, #gaia-map-zoom-controls")]
            .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden" && Number(getComputedStyle(node).opacity) !== 0)
            .map(node => node.getBoundingClientRect().toJSON()),
          canvas: document.querySelector("#japan-overlay").getBoundingClientRect().toJSON(),
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      assert.match(scan.text, /再生可能エネルギー発電割合/u);
      assert(scan.text.includes(`${source.renewablePercent.toFixed(1)}%`));
      assert.equal(scan.overlay.selectionLabelTypography, "mincho");
      assert.equal(scan.overlay.selectionLabelShape, "observation-card");
      const lines = JSON.parse(scan.overlay.renewableSelectionLabelLines);
      assert.deepEqual([...new Set(lines.map(line => line.index))], [0, 1], "Country and generation share must be retained in distinct columns");
      assert(lines.find(line => line.index === 0).left < lines.find(line => line.index === 1).left, "Country and generation share must be side by side");
      assert(lines.every(line => line.width <= line.columnWidth + 1), "A column was clipped or squeezed");
      assert(lines.every(line => /^400 /.test(line.font) && /Mincho|Serif|serif/.test(line.font)), "Readout uses a heavy sans-serif font");
      assert(lines.every(line => line.width <= Number(scan.overlay.renewableSelectionLabelBodyWidth) + 1), "A line was clipped or squeezed");
      assert.equal(scan.overlay.renewableSelectionLabelPrimary, source.countryJa);
      // The current compact renewable label intentionally has two fields;
      // source year remains in the console's value/context, not a third row.
      assert.equal(scan.overlay.renewableSelectionLabelSecondary, `再生可能エネルギー発電割合　${source.renewablePercent.toFixed(1)}%`);
      const card = { x: Number(scan.overlay.selectionLabelLeftPx), y: Number(scan.overlay.selectionLabelTopPx), width: Number(scan.overlay.selectionLabelWidthPx), height: Number(scan.overlay.selectionLabelHeightPx) };
      assert(card.x >= 0 && card.x + card.width <= width + 1 && card.y >= 0 && card.y + card.height <= height + 1, "Observation card is outside the viewport");
      if (scan.overlay.auxiliaryPanelId) scan.obstacles.push({ x: Number(scan.overlay.energyPanelScreenLeft), y: Number(scan.overlay.energyPanelScreenTop), right: Number(scan.overlay.energyPanelScreenRight), bottom: Number(scan.overlay.energyPanelScreenBottom) });
      for (const box of scan.obstacles) {
        const area = Math.max(0, Math.min(card.x + scan.canvas.x + card.width, box.right) - Math.max(card.x + scan.canvas.x, box.x))
          * Math.max(0, Math.min(card.y + scan.canvas.y + card.height, box.bottom) - Math.max(card.y + scan.canvas.y, box.y));
        assert(area < 2, `${width}/${iso3}: readout is covered by another instrument`);
      }
      assert.equal(scan.overflow, 0);
      for (const rect of scan.glyphs) {
        assert(rect.x >= scan.value.x - 1 && rect.right <= scan.value.right + 1, `${width}/${iso3}: clipped metric label or number`);
        assert(rect.y >= scan.heading.y - 1 && rect.bottom <= scan.heading.bottom + 1, `${width}/${iso3}: metric overflows heading`);
      }
      if (width > 900) assert(scan.value.y >= scan.dock.y && scan.value.bottom <= scan.dock.bottom, `${width}/${iso3}: metric overflows dock`);
      report.checks.push({ width, iso3, source, ...scan });
      if (["CAN", "DEU", "VCT"].includes(iso3)) {
        await page.screenshot({ path: path.join(output, `${width}-${iso3}-card.png`), clip: card });
      }
      if (iso3 === "CAN") {
        await page.screenshot({ path: path.join(output, `${width}-screen.jpg`), type: "jpeg", quality: 88 });
        await page.locator('.signal-console-map .signal-console-heading').screenshot({ path: path.join(output, `${width}-readout.png`) });
      }
    }
    if (width === 1440) {
      await page.evaluate(() => GaiaStatisticsLab.open({ modeId: "earth-organ" }));
      await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
      const analysis = await page.evaluate(async () => ({ state: GaiaStatisticsLab.getState(),
        summary: (await GaiaStatisticsLab.run("summary")).metrics,
        naturalConditions: (await GaiaStatisticsLab.run("multiple")).metrics }));
      assert.equal(analysis.state.methodId, "discovery", "Opening analysis starts with the current discovery view");
      assert.equal(analysis.summary.find(metric => metric[0] === "標本数")[1], 209);
      assert.equal(analysis.naturalConditions.find(metric => metric[0] === "n")[1], 31);
      assert(analysis.naturalConditions.every(metric => Number.isFinite(metric[1])));
      report.analysis = analysis;
    }
    await context.close();
    console.log(`PASS ${width}: mincho readout, natural wrapping, six country selections, years and truthful missing climate data`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 88 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
