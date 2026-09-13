import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/earthquake-readout-style");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 3840, height: 2088 },
    { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference", deviceScaleFactor: viewport.width < 600 ? 2 : 1 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.__readout = {};
      const fill = CanvasRenderingContext2D.prototype.fill;
      CanvasRenderingContext2D.prototype.fill = function (...args) {
        if (this.canvas.id === "japan-overlay" && this.fillStyle === "rgba(5, 17, 25, 0.96)") {
          window.__readout.surface = { color: this.fillStyle, shadowBlur: this.shadowBlur, shadowColor: this.shadowColor };
        }
        return fill.apply(this, args);
      };
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        const data = this.canvas.dataset;
        if (this.canvas.id === "japan-overlay" && Number(data.earthquakeActiveCalloutAlpha) > .99) {
          const kind = text === data.earthquakeActiveLabelPrimary ? "primary"
            : text === data.earthquakeActiveLabelSecondary ? "secondary"
              : String(text).startsWith("震源 ") ? "detail" : null;
          if (kind) {
            const metrics = this.measureText(text);
            window.__readout[kind] = { text, font: this.font, color: this.fillStyle, x, y,
              width: metrics.width, maxWidth, compression: Math.min(1, maxWidth / metrics.width) };
          }
        }
        return maxWidth === undefined ? fillText.call(this, text, x, y) : fillText.call(this, text, x, y, maxWidth);
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width: viewport.width, message: error.message }));
    await page.clock.install();
    await page.goto(`${base}/?preview=earthquake-readout-style#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapObservationAdapter.selectMode(5);
    });
    await page.waitForFunction(() => window.__readout.primary && window.__readout.secondary && window.__readout.detail);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 30));
    const scan = await page.evaluate(() => {
      const overlay = document.querySelector("#japan-overlay"), d = overlay.dataset, bounds = overlay.getBoundingClientRect();
      return { ...window.__readout, markerStyle: d.earthquakeMarkerStyle, markerColor: d.earthquakeMarkerColor,
        timeZone: d.earthquakeActiveLabelTimeZone, card: {
          x: bounds.x + Number(d.selectionLabelLeftPx), y: bounds.y + Number(d.selectionLabelTopPx),
          width: Number(d.selectionLabelWidthPx), height: Number(d.selectionLabelHeightPx),
        } };
    });
    assert.match(scan.primary.font, /(?:Mincho|明朝|Serif)/u, "Date uses the map's Mincho stack");
    for (const kind of ["primary", "secondary", "detail"]) {
      assert.doesNotMatch(scan[kind].font, /(?:bold|[56789]00|Consolas)/u, `${kind}: no heavy console typography`);
      assert.ok(scan[kind].compression > .6, `${kind}: text remains legible`);
    }
    assert.equal(scan.primary.color, "rgba(232, 243, 242, 0.98)");
    assert.equal(scan.surface.color, "rgba(5, 17, 25, 0.96)");
    assert.equal(scan.surface.shadowBlur, 0);
    assert.equal(scan.markerStyle, "red-heavy-cross");
    assert.equal(scan.markerColor, "rgb(255,43,51)");
    assert.equal(scan.timeZone, "Asia/Tokyo");
    assert.ok(scan.secondary.y > scan.primary.y && scan.detail.y > scan.secondary.y);
    const { card } = scan;
    assert.ok(card.x >= 0 && card.x + card.width <= viewport.width);
    assert.ok(card.y >= 0 && card.y + card.height <= viewport.height);
    await page.screenshot({ path: path.join(output, `${viewport.width}-full.jpg`), type: "jpeg", quality: 92 });
    const x = Math.max(0, card.x - 65), y = Math.max(0, card.y - 20);
    await page.screenshot({ path: path.join(output, `${viewport.width}-callout.png`), clip: {
      x, y, width: Math.min(viewport.width - x, card.width + 85), height: Math.min(viewport.height - y, card.height + 40),
    } });
    report.checks.push({ viewport, ...scan });
    console.log(`PASS ${viewport.width}: quiet navy surface, Mincho date, regular detail, red epicenter retained`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
