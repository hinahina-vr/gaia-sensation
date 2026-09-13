import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/map-overlay-layout-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900, maxInset: 36 },
  { name: "pc-1920", width: 1920, height: 1044, maxInset: 40 },
  { name: "mobile-390", width: 390, height: 844, maxInset: 28 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const boxInsideViewport = (box, viewport, label) => {
  assert(box, `${label}: missing box`);
  assert(box.left >= 0 && box.right <= viewport.width, `${label}: clipped horizontally`);
  assert(box.top >= 0 && box.top < viewport.height, `${label}: outside viewport`);
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    await page.goto(new URL("/?mode=1#earth", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
    await page.waitForFunction(() => document.querySelectorAll("#mode-list .mode-button").length === 9);
    await page.evaluate(() => {
      document.body.classList.remove("gaia-opening-active", "opening-active", "intro-open");
      window.dispatchEvent(new CustomEvent("gaia:opening-complete"));
      if (globalThis.GaiaSceneTransition) {
        globalThis.GaiaSceneTransition.run = async (swapScene) => {
          await swapScene();
          return true;
        };
      }
      for (const selector of ["#gaia-opening", "#intro-layer", "#novel-layer", "#true-end-layer"]) {
        const layer = document.querySelector(selector);
        if (!layer) continue;
        layer.hidden = true;
        layer.inert = true;
        layer.setAttribute("aria-hidden", "true");
      }
      document.querySelector(".experience")?.classList.remove("intro-open");
    });
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.evaluate(() => new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent("gaia:japan-open"));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const transition = document.querySelector("#scene-transition");
        if (transition instanceof HTMLCanvasElement) transition.hidden = true;
        document.body.classList.remove("scene-transitioning");
        resolve();
      }));
    }));
    await page.waitForFunction(() => document.querySelector("#scene-transition")?.hidden
      && !document.body.classList.contains("scene-transitioning"));
    await page.waitForTimeout(160);

    for (let index = 0; index < 8; index += 1) {
      await page.evaluate((modeIndex) => document.querySelectorAll("#japan-mode-list .map-mode-button")[modeIndex]?.click(), index);
      await page.waitForFunction(
        (modeNumber) => document.querySelector("#japan-mode-number")?.textContent?.trim() === modeNumber,
        String(index + 1).padStart(2, "0"),
      );
      await page.waitForTimeout(120);
      if (index === 0) {
        await page.waitForFunction(() => {
          const overlay = document.querySelector("#japan-overlay");
          return overlay?.dataset.auroraForecast === "ready"
            && Number(overlay.dataset.auroraForecastPointCount) >= 80
            && Number(overlay.dataset.auroraForecastMaximum) > 0;
        }, null, { timeout: 15_000 });
      } else if (index === 2) {
        await page.waitForFunction(() => {
          const overlay = document.querySelector("#japan-overlay");
          return overlay?.dataset.forestMask === "ready"
            && overlay.dataset.forestRainCircleRange
            && overlay.dataset.forestRainBrazil;
        });
      } else if (index === 6) {
        await page.waitForFunction(() => {
          const overlay = document.querySelector("#japan-overlay");
          return overlay?.dataset.ecologiesPlot === "paired-country-scatter"
            && overlay.dataset.ecologiesPairCount
            && overlay.dataset.ecologiesCorrelation;
        });
      } else if (index === 7) {
        await page.waitForFunction(() => {
          const overlay = document.querySelector("#japan-overlay");
          return overlay?.dataset.countryGeometryState === "ready"
            && Number(overlay.dataset.renewableCountryFillCount) === 208;
        });
      }

      await page.waitForFunction((desktop) => {
        const title = document.querySelector("[data-signal-encoding-legend-title]");
        const legend = document.querySelector("[data-signal-encoding-legend]");
        return Boolean(title && legend) && (!desktop || (
          title.getClientRects().length > 0 && legend.getClientRects().length > 0
        ));
      }, viewport.name.startsWith("pc"));

      await page.waitForFunction((desktop) => {
        const bank = document.querySelector("#japan-layer > .map-mode-bank")?.getBoundingClientRect();
        const signal = document.querySelector("#japan-layer > .signal-console-map")?.getBoundingClientRect();
        if (!bank || !signal) return false;
        return desktop ? signal.top >= bank.bottom + 8 : bank.top >= signal.bottom + 8;
      }, viewport.name.startsWith("pc"));

      const scan = await page.evaluate(() => {
        const box = (node) => node?.getBoundingClientRect().toJSON() || null;
        const visible = (node) => node && getComputedStyle(node).display !== "none"
          && getComputedStyle(node).visibility !== "hidden"
          && getComputedStyle(node).opacity !== "0";
        const back = document.querySelector("#japan-close");
        const heading = document.querySelector("#japan-layer > .japan-heading");
        const bank = document.querySelector("#japan-layer > .map-mode-bank");
        const signal = document.querySelector("#japan-layer > .signal-console-map");
        const openData = document.querySelector("#japan-data-button");
        const audio = document.querySelector("#gaia-audio-dock");
        const legendDock = document.querySelector("#japan-layer .signal-encoding-legend-dock");
        const readingGuide = document.querySelector("#map-reading-guide");
        const backRect = back?.getBoundingClientRect();
        const hit = backRect
          ? document.elementFromPoint(backRect.left + backRect.width / 2, backRect.top + backRect.height / 2)
          : null;
        const hitButton = (node) => {
          const rect = node?.getBoundingClientRect();
          if (!rect) return "";
          return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
            ?.closest?.("button")?.id || document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
              ?.closest?.("button")?.className || "";
        };
        const mapRect = document.querySelector("#japan-map")?.getBoundingClientRect();
        const overlay = document.querySelector("#japan-overlay");
        const zoom = Number(overlay?.dataset.earthZoom) || 1;
        const offsetX = Number(overlay?.dataset.earthOffsetX) || 0;
        const offsetY = Number(overlay?.dataset.earthOffsetY) || 0;
        const baseScale = mapRect ? (mapRect.width >= 901 ? mapRect.width / 360 : Math.max(mapRect.width / 360, mapRect.height / 180)) : 0;
        const scale = baseScale * zoom;
        const wrapLongitude = (longitude) => ((longitude - Number(overlay.dataset.earthCenterLongitude) + 540) % 360) - 180;
        const europe = mapRect ? {
          x: mapRect.left + (mapRect.width - 360 * scale) / 2 + offsetX
            + (wrapLongitude(10) + 180) * scale,
          y: mapRect.top + (mapRect.height - 180 * scale) / 2 + offsetY + (90 - 50) * scale,
        } : null;
        const europeHit = europe && europe.x >= 0 && europe.x < innerWidth && europe.y >= 0 && europe.y < innerHeight
          ? document.elementFromPoint(europe.x, europe.y)
          : null;
        return {
          modeNumber: document.querySelector("#japan-mode-number")?.textContent?.trim() || "",
          desktopGrid: document.body.classList.contains("map-grid-desktop"),
          back: box(back),
          heading: box(heading),
          bank: box(bank),
          signal: box(signal),
          openData: box(openData),
          audio: box(audio),
          legendDock: box(legendDock),
          readingGuide: box(readingGuide),
          liveReceiptCount: document.querySelectorAll("[data-gaia-live-receipt], .gaia-live-receipt").length,
          openDataHit: hitButton(openData),
          openDataCopy: openData?.textContent?.replace(/\s+/gu, " ").trim() || "",
          storyButtonCount: document.querySelectorAll("#japan-layer .japan-story-button").length,
          instructionCount: document.querySelectorAll("#japan-layer .japan-instruction").length,
          legendVisible: visible(legendDock),
          legendInSignalPanel: legendDock?.parentElement === signal,
          readingGuideRadius: readingGuide ? getComputedStyle(readingGuide).borderRadius : "",
          europe,
          europeBlocker: europeHit?.closest?.(".map-grid-polish, .japan-data-button")?.className || "",
          scaleCount: document.querySelectorAll("#japan-layer > .map-scope-switch").length,
          forestRainCircleRange: document.querySelector("#japan-overlay")?.dataset.forestRainCircleRange || "",
          forestRainBrazil: document.querySelector("#japan-overlay")?.dataset.forestRainBrazil || "",
          ecologiesPlot: document.querySelector("#japan-overlay")?.dataset.ecologiesPlot || "",
          ecologiesPairCount: document.querySelector("#japan-overlay")?.dataset.ecologiesPairCount || "",
          ecologiesCorrelation: document.querySelector("#japan-overlay")?.dataset.ecologiesCorrelation || "",
          renewableCountryFillCount: document.querySelector("#japan-overlay")?.dataset.renewableCountryFillCount || "",
          renewableFillScale: document.querySelector("#japan-overlay")?.dataset.renewableFillScale || "",
          energyConnectionRemoved: document.querySelector("#japan-overlay")?.dataset.energyConnectionRemoved || "",
          energyPanel: overlay?.dataset.energyPanelScreenLeft
            ? {
              left: Number(overlay.dataset.energyPanelScreenLeft),
              top: Number(overlay.dataset.energyPanelScreenTop),
              right: Number(overlay.dataset.energyPanelScreenRight),
              bottom: Number(overlay.dataset.energyPanelScreenBottom),
            }
            : null,
          energyPanelLegendClearance: overlay?.dataset.energyPanelLegendClearance || "",
          auxiliaryPanelId: overlay?.dataset.auxiliaryPanelId || "",
          auxiliaryPanel: overlay?.dataset.auxiliaryPanelScreenLeft
            ? {
              left: Number(overlay.dataset.auxiliaryPanelScreenLeft),
              top: Number(overlay.dataset.auxiliaryPanelScreenTop),
              right: Number(overlay.dataset.auxiliaryPanelScreenRight),
              bottom: Number(overlay.dataset.auxiliaryPanelScreenBottom),
            }
            : null,
          auxiliaryPanelLegendClearance: overlay?.dataset.auxiliaryPanelLegendClearance || "",
          auroraForecast: overlay?.dataset.auroraForecast || "",
          auroraForecastSource: overlay?.dataset.auroraForecastSource || "",
          auroraForecastPointCount: overlay?.dataset.auroraForecastPointCount || "",
          auroraForecastMaximum: overlay?.dataset.auroraForecastMaximum || "",
          auroraForecastTime: overlay?.dataset.auroraForecastTime || "",
          backVisible: visible(back),
          backHitId: hit?.closest?.("button")?.id || "",
          overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      const reportScan = { viewport: viewport.name, ...scan, passed: false };
      report.scans.push(reportScan);

      assert.equal(scan.backVisible, true, `${viewport.name}/${scan.modeNumber}: back button is hidden`);
      assert.equal(scan.backHitId, "japan-close", `${viewport.name}/${scan.modeNumber}: back button is obstructed`);
      assert(scan.back.left >= 0 && scan.back.left <= viewport.maxInset, `${viewport.name}/${scan.modeNumber}: back is not at left edge`);
      assert(scan.back.top >= 0 && scan.back.top <= viewport.maxInset, `${viewport.name}/${scan.modeNumber}: back is not at top edge`);
      assert(scan.back.width >= 44 && scan.back.height >= 44, `${viewport.name}/${scan.modeNumber}: back hit area is too small`);
      assert.equal(scan.scaleCount, 0, `${viewport.name}/${scan.modeNumber}: redundant map scale block remains`);
      assert.equal(scan.storyButtonCount, 0, `${viewport.name}/${scan.modeNumber}: retired STORY action remains`);
      assert.equal(scan.instructionCount, 0, `${viewport.name}/${scan.modeNumber}: retired map instruction block remains`);
      assert.match(scan.openDataCopy, /データの出典を表示する/u, `${viewport.name}/${scan.modeNumber}: source action is unclear`);
      assert.equal(
        scan.readingGuideRadius,
        viewport.name.startsWith("pc") ? "5px" : "9px",
        `${viewport.name}/${scan.modeNumber}: reading guide corners are not rounded`,
      );
      assert.equal(scan.liveReceiptCount, 0, `${viewport.name}/${scan.modeNumber}: retired LIVE receipt remains`);
      for (const [name, panelBox] of Object.entries({ heading: scan.heading, bank: scan.bank, signal: scan.signal })) {
        boxInsideViewport(panelBox, scan.viewport, `${viewport.name}/${scan.modeNumber}/${name}`);
      }
      if (viewport.name.startsWith("pc")) {
        assert.equal(scan.desktopGrid, true, `${viewport.name}/${scan.modeNumber}: desktop map grid is inactive`);
        boxInsideViewport(scan.openData, scan.viewport, `${viewport.name}/${scan.modeNumber}/open-data`);
        assert(scan.heading.top <= viewport.maxInset, `${viewport.name}/${scan.modeNumber}: title is not fixed to the top row`);
        assert(scan.heading.left >= scan.back.right + 10, `${viewport.name}/${scan.modeNumber}: title overlaps back action`);
        assert(scan.legendVisible, `${viewport.name}/${scan.modeNumber}: legend is hidden`);
        assert(scan.heading.right <= scan.legendDock.left - 8, `${viewport.name}/${scan.modeNumber}: title overlaps legend`);
        assert(scan.legendDock.right <= scan.audio.left - 8, `${viewport.name}/${scan.modeNumber}: legend is not left of volume`);
        assert(scan.signal.top >= scan.bank.bottom + 8, `${viewport.name}/${scan.modeNumber}: lower bank overlaps signal panel`);
        assert(scan.openData.top >= scan.signal.bottom + 8, `${viewport.name}/${scan.modeNumber}: OPEN DATA is outside the lower rail`);
        assert.equal(scan.openDataHit, "japan-data-button", `${viewport.name}/${scan.modeNumber}: OPEN DATA action is obstructed`);
        assert(scan.openData.bottom <= scan.viewport.height, `${viewport.name}/${scan.modeNumber}: lower rail is clipped`);
        assert(scan.bank.top > scan.europe.y + 24, `${viewport.name}/${scan.modeNumber}: lower rail still covers Europe vertically`);
        assert.equal(scan.europeBlocker, "", `${viewport.name}/${scan.modeNumber}: Europe is obscured by ${scan.europeBlocker}`);
      } else {
        assert.equal(scan.legendInSignalPanel, true, `${viewport.name}/${scan.modeNumber}: compact legend left the mobile data panel`);
        for (const [name, panelBox] of Object.entries({ heading: scan.heading, bank: scan.bank, signal: scan.signal })) {
          assert(panelBox.top >= scan.back.bottom + 10, `${viewport.name}/${scan.modeNumber}/${name}: panel was not lowered below back`);
        }
        assert(scan.signal.top >= scan.heading.bottom + 8, `${viewport.name}/${scan.modeNumber}: signal panel overlaps heading`);
        assert(scan.bank.top >= scan.signal.bottom + 8, `${viewport.name}/${scan.modeNumber}: bank overlaps signal panel`);
      }
      assert.equal(scan.overflowX, 0, `${viewport.name}/${scan.modeNumber}: horizontal overflow`);
      assert.equal(scan.overflowY, 0, `${viewport.name}/${scan.modeNumber}: vertical overflow`);
      if (scan.auxiliaryPanel) {
        const auxiliaryLegendOverlaps = scan.auxiliaryPanel.left < scan.legendDock.right
          && scan.auxiliaryPanel.right > scan.legendDock.left
          && scan.auxiliaryPanel.top < scan.legendDock.bottom
          && scan.auxiliaryPanel.bottom > scan.legendDock.top;
        assert.equal(
          auxiliaryLegendOverlaps,
          false,
          `${viewport.name}/${scan.modeNumber}: map legend overlaps ${scan.auxiliaryPanelId}`,
        );
      }
      if (index === 0) {
        assert.equal(scan.auroraForecast, "ready", `${viewport.name}/01: OVATION aurora layer is not ready`);
        assert.match(scan.auroraForecastSource, /^(live|snapshot)$/u, `${viewport.name}/01: OVATION source state is unclear`);
        assert(Number(scan.auroraForecastPointCount) >= 80, `${viewport.name}/01: OVATION grid is empty`);
        assert(Number(scan.auroraForecastMaximum) > 0, `${viewport.name}/01: OVATION intensity is empty`);
        assert.match(scan.auroraForecastTime, /^\d{4}-\d{2}-\d{2}T/u, `${viewport.name}/01: OVATION forecast time is missing`);
        await page.locator("#japan-data-button").evaluate((button) => button.click());
        await page.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("japan-data-open"));
        const sourceLayering = await page.evaluate(() => {
          const legend = document.querySelector("#map-signal-encoding-legend-dock");
          const panel = document.querySelector("#japan-data-panel");
          const style = getComputedStyle(legend);
          return {
            legendVisibility: style.visibility,
            legendOpacity: Number(style.opacity),
            legendPointerEvents: style.pointerEvents,
            panelVisible: panel?.getAttribute("aria-hidden") === "false",
          };
        });
        assert.deepEqual(sourceLayering, {
          legendVisibility: "hidden",
          legendOpacity: 0,
          legendPointerEvents: "none",
          panelVisible: true,
        }, `${viewport.name}: legend remains above the data source panel`);
        const sourceList = await page.locator("#japan-data-panel").evaluate((panel) => ({
          title: panel.querySelector(".japan-data-header h2")?.textContent || "",
          cardCount: panel.querySelectorAll(".data-ledger-card").length,
          sourceLinkCount: panel.querySelectorAll(".data-ledger-card .data-source-links a").length,
          sourceTitles: [...panel.querySelectorAll(".data-ledger-card h3")].map((node) => node.textContent?.trim() || ""),
          verboseBlockCount: panel.querySelectorAll(".data-kind-legend, .statistics-disclosure, .data-specs, .data-preview, .japan-data-calculation, .japan-data-caution").length,
        }));
        assert.equal(sourceList.title, "データの出典", `${viewport.name}: source panel title is verbose`);
        assert.ok(sourceList.cardCount > 0 && sourceList.sourceLinkCount >= sourceList.cardCount, `${viewport.name}: compact source list is incomplete`);
        assert(sourceList.sourceTitles.some((title) => title.includes("オーロラ")), `${viewport.name}: NOAA OVATION source is missing`);
        assert.equal(sourceList.verboseBlockCount, 0, `${viewport.name}: verbose source explanations remain`);
        await page.locator("#japan-data-panel").screenshot({
          path: path.join(outputDir, `${viewport.name}-data-sources.png`),
          animations: "disabled",
        });
        await page.locator("#japan-data-close").evaluate((button) => button.click());
        await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("japan-data-open"));
      }
      if (index === 2) {
        assert.equal(scan.forestRainCircleRange, "10-54px radius", `${viewport.name}/03: rain-circle scale is stale`);
        assert.equal(scan.forestRainBrazil, "5.33 mm/日", `${viewport.name}/03: Brazil rain point is missing`);
      } else if (index === 6) {
        assert.equal(scan.ecologiesPlot, "paired-country-scatter", `${viewport.name}/07: paired scatter plot is missing`);
        assert.equal(scan.ecologiesPairCount, "31", `${viewport.name}/07: paired-country count is stale`);
        assert(Number(scan.ecologiesCorrelation) > 0.2 && Number(scan.ecologiesCorrelation) < 0.3, `${viewport.name}/07: correlation is missing`);
        assert.equal(scan.auxiliaryPanelId, "three-ecologies-scatter", `${viewport.name}/07: scatter panel collision target is missing`);
      } else if (index === 7) {
        assert.equal(scan.renewableCountryFillCount, "208", `${viewport.name}/08: country fills are missing`);
        assert.equal(scan.renewableFillScale, "country-blue-0-100", `${viewport.name}/08: color scale is stale`);
        assert.equal(scan.energyConnectionRemoved, "true", `${viewport.name}/08: old connection interaction remains`);
        assert.equal(scan.auxiliaryPanelId, "earth-organ-scale", `${viewport.name}/08: energy panel collision target is missing`);
        assert(scan.energyPanel, `${viewport.name}/08: renewable comparison panel geometry is missing`);
        const energyLegendOverlaps = scan.energyPanel.left < scan.legendDock.right
          && scan.energyPanel.right > scan.legendDock.left
          && scan.energyPanel.top < scan.legendDock.bottom
          && scan.energyPanel.bottom > scan.legendDock.top;
        assert.equal(energyLegendOverlaps, false, `${viewport.name}/08: map legend overlaps renewable comparison panel`);
      }
      reportScan.passed = true;

      if (index === 0 || index === 2 || index === 3 || index === 6 || index === 7) {
        await page.screenshot({
          path: path.join(outputDir, `${viewport.name}-${scan.modeNumber}.png`),
          animations: "disabled",
        });
      }
    }
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join("\n")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join("\n")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`Map overlay layout browser check passed: ${report.scans.length} mode/viewports`);
