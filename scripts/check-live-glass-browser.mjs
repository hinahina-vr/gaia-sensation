import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-glass");
const widths = (process.argv[4] || "3840,1920,1440,1024,901,390,320").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const luminance = rgb => rgb.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  .reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0);
const contrast = (text, background) => {
  const rgb = text.match(/[\d.]+/g).map(Number);
  return (luminance(rgb.slice(0, 3)) + .05) / (luminance(background) + .05);
};
let page;
try {
  for (const width of widths) {
    const height = width === 3840 ? 2088 : width > 900 ? 900 : 844;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width <= 900 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=live-glass#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaLiveExhibits && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapCategories.buttons()[15].click(); GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveExhibits.selectObservationPoint("tokyo");
      await document.fonts.ready;
    });
    await page.waitForFunction(() => GaiaLiveData.getState().city === "tokyo" && GaiaLiveData.getState().requestState === "ready"
      && document.querySelector("#japan-layer").dataset.livePoiTransition === "settled");
    const metric = page.locator(".gaia-live-metric-legend");
    const legend = page.locator("#map-signal-encoding-legend-dock");
    const anchor = page.locator(".gaia-live-exhibit-anchor > span");
    const settle = () => page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await settle();
    const scan = async () => page.evaluate(() => {
      const measure = selector => {
        const node = document.querySelector(selector), style = getComputedStyle(node);
        return { box: node.getBoundingClientRect().toJSON(), background: style.backgroundColor, image: style.backgroundImage, blur: style.backdropFilter,
          opacity: style.opacity, overflow: node.scrollWidth - node.clientWidth,
          text: [...node.querySelectorAll("strong, small, span, time, dt")].filter(node => node.getClientRects().length && node.textContent.trim() && !node.children.length)
            .map(node => ({ text: node.textContent, color: getComputedStyle(node).color, opacity: getComputedStyle(node).opacity })) };
      };
      return { legend: measure("#map-signal-encoding-legend-dock"), metric: measure(".gaia-live-metric-legend"), anchor: measure(".gaia-live-exhibit-anchor > span") };
    });
    if (width > 900) {
      // Bring the selected Tokyo observation into a clear map area, using
      // the same projection that positions its real geographic marker.
      await page.evaluate(() => {
        const city = GaiaLiveExhibits.observationPoints.find(point => point.id === "tokyo");
        GaiaMapObservationAdapter.focusEarthLocation({ lon: city.lon, lat: city.lat,
          zoom: Number(document.querySelector("#japan-overlay").dataset.earthZoom), targetX: .42, targetY: .45 });
      });
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
      const check = async state => {
        await page.evaluate(() => GaiaMapLegendDrag.syncObservationPanels());
        const result = await scan();
        const a = result.legend.box, b = result.metric.box;
        assert(Math.abs(a.width - b.width) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.right - b.right) < 1, `${width}/${state}: mismatched column ${JSON.stringify(result)}`);
        assert(b.top >= a.bottom + 9 && b.bottom < height - 90, `${width}/${state}: panels overlap`);
        for (const key of ["legend", "metric", "anchor"]) {
          const panel = result[key];
          assert.equal(panel.blur, "blur(6px)"); assert.equal(panel.opacity, "1");
          assert(panel.overflow <= 1 && panel.box.left >= 0 && panel.box.right <= width);
          if (key !== "legend") assert.equal(panel.background, "rgba(5, 19, 26, 0.82)");
          // White is the brightest possible map background; small labels
          // must retain 4.5:1 contrast even in that conservative condition.
          const worst = key === "legend" ? [19, 40, 53].map(channel => channel * .86 + 255 * .14)
            : [5, 19, 26].map(channel => channel * .82 + 255 * .18);
          for (const item of panel.text) {
            assert.equal(item.opacity, "1");
            assert(contrast(item.color, worst) >= 4.5, `${width}/${key}: low contrast ${JSON.stringify(item)}`);
          }
        }
        return result;
      };
      const normal = await check("normal");
      await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement?.blur());
      await anchor.screenshot({ path: path.join(output, `${width}-observation.png`) });
      const a = normal.legend.box, b = normal.metric.box;
      await page.screenshot({ path: path.join(output, `${width}-legend-column.png`), clip: { x: a.x - 4, y: a.y - 4, width: a.width + 8, height: b.bottom - a.y + 8 } });
      // Audio expansion changes the shared column position, not its alignment.
      await page.locator("#gaia-audio-dock").evaluate(node => node.classList.add("is-expanded"));
      await check("audio-expanded");
      await page.locator("#gaia-audio-dock").evaluate(node => node.classList.remove("is-expanded"));
      for (const number of [15, 17, 18, 19, 20]) {
        await page.evaluate(number => { GaiaMapCategories.buttons()[number - 1].click(); GaiaLiveExhibits.pausePoiAutoplay(); }, number);
        await settle(); await check(`exhibit-${number}`);
      }
      // A non-live observation retains its original material and instrument width.
      await page.evaluate(() => GaiaEstatExhibits.select(0)); await settle();
      assert.equal(await page.locator(".gaia-estat-heat-legend").evaluate(node => getComputedStyle(node).backgroundColor), "rgba(5, 19, 26, 0.95)");
      assert.equal(await legend.evaluate(node => getComputedStyle(node).backdropFilter), "none");
      report.checks.push({ width, normal, alignedAudioExpansion: true, sixLiveExhibits: true, contrastOverWhite: true, nonLiveUnchanged: true });
    } else {
      assert.equal(await metric.isVisible(), false); assert.equal(await legend.isVisible(), false); assert.equal(await anchor.isVisible(), false);
      await page.locator('[data-mobile-sheet="tools"]').click();
      assert((await page.locator(".map-mobile-tool-grid button:visible").count()) >= 2);
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await page.screenshot({ path: path.join(output, `${width}-mobile.png`) });
      report.checks.push({ width, mobileControlsPreserved: true, noNewOverlay: true });
    }
    console.log(`PASS ${width}: subtle glass, opaque readable text, aligned legend column and responsive controls`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
