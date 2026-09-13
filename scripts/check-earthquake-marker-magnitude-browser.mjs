import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/earthquake-marker-magnitude");
const requested = process.argv[4]?.split(",");
const events = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8")).modes
  .find(mode => mode.id === "rhythm-of-disaster").signals.globalEvents;
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 3840, height: 2160 },
    { width: 390, height: 844 }, { width: 320, height: 740 }, { width: 320, height: 740, reduced: true },
  ]) {
    const profile = `${viewport.width}${viewport.reduced ? "-reduced" : ""}`;
    if (requested && !requested.includes(profile)) continue;
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.width < 600 ? 2 : 1, reducedMotion: viewport.reduced ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.__magnitudeDraws = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        if (this.canvas.id === "japan-overlay" && /^M\d\.\d$/u.test(text)
          && this.textAlign === "center" && this.textBaseline === "top") {
          const rect = this.canvas.getBoundingClientRect(), transform = this.getTransform(), metrics = this.measureText(text);
          const sx = rect.width / this.canvas.width, sy = rect.height / this.canvas.height;
          window.__magnitudeDraws.push({ text, time: performance.now(),
            x: rect.x + (transform.a * x + transform.e) * sx,
            top: rect.y + (transform.d * (y - metrics.actualBoundingBoxAscent) + transform.f) * sy,
            bottom: rect.y + (transform.d * (y + metrics.actualBoundingBoxDescent) + transform.f) * sy,
            width: metrics.width * transform.a * sx, font: this.font, alpha: this.globalAlpha,
            calloutAlpha: Number(this.canvas.dataset.earthquakeActiveCalloutAlpha),
            year: this.canvas.dataset.earthquakeYear });
          if (window.__magnitudeDraws.length > 300) window.__magnitudeDraws.shift();
        }
        return maxWidth === undefined ? fillText.call(this, text, x, y) : fillText.call(this, text, x, y, maxWidth);
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${viewport.width}: ${error.message}`));
    await page.goto(`${base}/?preview=earthquake-marker-magnitude#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
      document.querySelector('.map-mode-bank [data-map-standard-index="5"]').click();
    });
    await page.waitForFunction(reduced => window.__magnitudeDraws.some(draw => draw.year === "2000" && draw.alpha > .7
      && (reduced || draw.calloutAlpha < .01)), Boolean(viewport.reduced));
    if (viewport.reduced) {
      // Reduced motion intentionally presents all markers without a flyover or
      // active-event callout; verify that existing behavior, not an animation.
      await page.locator("#japan-layer [data-signal-time]").first().evaluate(input => {
        input.value = String(((4 + .1) / 27) * 100); input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const d = document.querySelector("#japan-overlay").dataset;
        return d.earthquakeYear === "2004" && d.earthquakeCameraState === "reduced-motion-global"
          && Number(d.earthquakeMagnitudeLabelCount) === 3;
      });
      const staticLabels = await page.evaluate(() => window.__magnitudeDraws.filter(draw => draw.year === "2004" && performance.now() - draw.time < 250));
      for (const event of events.filter(event => event.occurredAt.startsWith("2004"))) {
        assert(staticLabels.some(label => label.text === `M${event.magnitude.toFixed(1)}` && label.alpha > .99));
      }
      report.checks.push({ width: viewport.width, stage: "reduced-motion-global", labels: staticLabels });
      await page.screenshot({ path: path.join(output, `${profile}-overview.jpg`), type: "jpeg", quality: 90 });
      const exitedAt = await page.evaluate(() => {
        document.querySelector('.map-mode-bank [data-map-standard-index="0"]').click(); return performance.now();
      });
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(exitedAt => window.__magnitudeDraws.some(draw => draw.time > exitedAt + 50), exitedAt), false);
      assert.equal(await page.locator("#japan-overlay").getAttribute("data-earthquake-magnitude-label-count"), null);
      console.log(`PASS ${profile}: three persistent static M values without flyover, clean mode exit`);
      await context.close();
      continue;
    }
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay").dataset.earthquakeActiveCalloutAlpha) > .99);
    const scan = await page.evaluate(() => {
      const overlay = document.querySelector("#japan-overlay"), d = overlay.dataset, rect = overlay.getBoundingClientRect();
      return { labelMode: d.earthquakeActiveMagnitudeLabel, markerStyle: d.earthquakeMarkerStyle,
        count: Number(d.earthquakeMagnitudeLabelCount), occurredAt: d.earthquakeCameraEventOccurredAt,
        x: Number(d.earthquakeCameraEventScreenX) + rect.x, y: Number(d.earthquakeCameraEventScreenY) + rect.y,
        labels: window.__magnitudeDraws.filter(draw => performance.now() - draw.time < 200),
        beforeCallout: window.__magnitudeDraws.some(draw => draw.alpha > .7 && draw.calloutAlpha < .01),
        card: { x: Number(d.selectionLabelLeftPx) + rect.x, y: Number(d.selectionLabelTopPx) + rect.y,
          width: Number(d.selectionLabelWidthPx), height: Number(d.selectionLabelHeightPx) } };
    });
    const expected = `M${events.find(event => event.occurredAt === scan.occurredAt).magnitude.toFixed(1)}`;
    const label = scan.labels.findLast(label => label.text === expected && Math.abs(label.x - scan.x) < 1 && label.alpha > .99);
    assert(label, `${viewport.width}: actual canvas M value missing beneath active cross`);
    if (!viewport.reduced) assert(scan.beforeCallout, "M value must appear with the cross, before the detail card");
    assert(label.calloutAlpha > .99, "M value must remain while the card is visible");
    assert.equal(scan.labelMode, "below-marker"); assert.equal(scan.markerStyle, "red-heavy-cross");
    assert(scan.count > 0);
    assert(label.top > scan.y + 12 && label.bottom < scan.y + 55,
      `Magnitude bounds beneath cross: ${JSON.stringify({ label, markerX: scan.x, markerY: scan.y })}`);
    assert(label.x - label.width / 2 > 0 && label.x + label.width / 2 < viewport.width && label.bottom < viewport.height);
    const overlapsCard = label.x - label.width / 2 < scan.card.x + scan.card.width && label.x + label.width / 2 > scan.card.x
      && label.top < scan.card.y + scan.card.height && label.bottom > scan.card.y;
    assert.equal(overlapsCard, false, "Magnitude must not overlap the detail card body");
    report.checks.push({ width: viewport.width, stage: "before-and-with-callout", expected, label, ...scan });
    await page.screenshot({ path: path.join(output, `${viewport.width}-active.png`),
      clip: { x: Math.max(0, scan.x - 75), y: Math.max(0, scan.y - 55), width: 150, height: 125 } });
    await page.screenshot({ path: path.join(output, `${viewport.width}-full.jpg`), type: "jpeg", quality: 90 });
    // A short three-event year exercises persistent old markers and overview.
    await page.locator("#japan-layer [data-signal-time]").first().evaluate(input => {
      input.value = String(((4 + .1) / 27) * 100); input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const d = document.querySelector("#japan-overlay").dataset;
      return d.earthquakeYear === "2004" && Number(d.earthquakeCameraEventIndex) === 2
        && Number(d.earthquakeActiveCalloutAlpha) > .99;
    });
    const strongest = await page.evaluate(() => {
      const overlay = document.querySelector("#japan-overlay"), d = overlay.dataset, rect = overlay.getBoundingClientRect();
      return { label: window.__magnitudeDraws.findLast(draw => draw.text === "M9.1" && performance.now() - draw.time < 250 && draw.alpha > .99),
        card: { x: Number(d.selectionLabelLeftPx) + rect.x, y: Number(d.selectionLabelTopPx) + rect.y,
          width: Number(d.selectionLabelWidthPx), height: Number(d.selectionLabelHeightPx) } };
    });
    assert(strongest.label, "The largest cross also needs its M9.1 label");
    assert(!(strongest.label.x - strongest.label.width / 2 < strongest.card.x + strongest.card.width
      && strongest.label.x + strongest.label.width / 2 > strongest.card.x
      && strongest.label.top < strongest.card.y + strongest.card.height && strongest.label.bottom > strongest.card.y),
    "Largest-magnitude label overlaps the card body");
    report.checks.push({ width: viewport.width, stage: "strongest-marker", ...strongest });
    await page.waitForFunction(() => {
      const d = document.querySelector("#japan-overlay").dataset;
      return d.earthquakeYear === "2004" && d.earthquakeCameraState === "global-overview"
        && Number(d.earthZoom) <= 1.01 && Number(d.earthquakeMagnitudeLabelCount) === 3;
    }, null, { timeout: 30000 });
    const overview = await page.evaluate(() => ({
      labels: window.__magnitudeDraws.filter(draw => draw.year === "2004" && performance.now() - draw.time < 250),
      count: Number(document.querySelector("#japan-overlay").dataset.earthquakeMagnitudeLabelCount),
    }));
    for (const event of events.filter(event => event.occurredAt.startsWith("2004"))) {
      assert(overview.labels.some(label => label.text === `M${event.magnitude.toFixed(1)}` && label.alpha > .99), "Old markers keep their true magnitude in the overview");
    }
    assert.equal(overview.count, 3);
    report.checks.push({ width: viewport.width, stage: "2004-overview", ...overview });
    await page.screenshot({ path: path.join(output, `${viewport.width}-overview.jpg`), type: "jpeg", quality: 85 });
    const exitedAt = await page.evaluate(() => {
      document.querySelector('.map-mode-bank [data-map-standard-index="0"]').click(); return performance.now();
    });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(exitedAt => window.__magnitudeDraws.some(draw => draw.time > exitedAt + 50), exitedAt), false);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-earthquake-magnitude-label-count"), null);
    console.log(`PASS ${viewport.width}: actual M text below cross, before/with callout, all three overview markers, clean mode exit`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 90 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
