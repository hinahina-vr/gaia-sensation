import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright-core";

const [baseUrl = "http://127.0.0.1:4173", outputArgument = "artifacts/earthquake-arrival"] = process.argv.slice(2);
const output = path.resolve(outputArgument);
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync("app.js", "utf8");
const formatterSource = source.slice(source.indexOf("  const earthquakeDateFormatter ="), source.indexOf("  const formatCoordinateJa ="));
const format = vm.runInNewContext(`${formatterSource}; formatEarthquakeDateJa;`, { Intl, Date });
assert.equal(format("2026-09-05T14:18:00Z"), "2026年9月5日（土）午後11時18分");
assert.equal(format("2026-09-05T15:05:00Z"), "2026年9月6日（日）午前0時05分");
assert.equal(format("invalid"), "日時不明");
const snapshot = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
const report = { status: "running", scans: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const cases = process.argv.includes("--mobile-only") ? [[390, false], [320, false], [390, true]] : [[1440, false], [3840, false], [390, false], [390, true]];
  for (const [width, reduced] of cases) {
    const name = `${width}${reduced ? "-reduced" : ""}`;
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width === 390 ? 844 : 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.quakeSamples = [];
      window.quakeText = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
        if (this.canvas.id === "japan-overlay" && (/年.*[上下]午|年.*午[前後]|^マグニチュード|^震源 |^M\d/u.test(String(text)))) {
          window.quakeText.push({ text, x, y, align: this.textAlign });
          if (window.quakeText.length > 2000) window.quakeText.shift();
        }
        return fillText.call(this, text, x, y, ...rest);
      };
      const sample = () => {
        const data = document.querySelector("#japan-overlay")?.dataset;
        if (data?.earthquakeYear && data.earthquakeYearTransitionPhase) {
          window.quakeSamples.push({ at: performance.now(), ...data });
          if (window.quakeSamples.length > 2000) window.quakeSamples.shift();
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ contentType: "application/json", body: snapshot }));
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(`${baseUrl}/?preview=quake-arrival#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !!globalThis.GaiaMapObservationAdapter);
    await page.evaluate(() => { globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }); globalThis.GaiaMapObservationAdapter.selectMode(5); });
    const scan = { name };
    report.scans.push(scan);
    if (reduced) {
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.earthquakeCameraState === "reduced-motion-global");
      const data = await page.locator("#japan-overlay").evaluate((el) => ({ ...el.dataset }));
      assert.equal(data.earthquakeCameraEventIndex, "-1");
      assert.equal(data.earthquakeVisibleEventCount, data.earthquakeYearEventCount);
      scan.reducedMotion = "global view, no flyover";
    } else {
      await page.waitForFunction(() => {
        const data = document.querySelector("#japan-overlay").dataset;
        return data.earthquakeCameraEventIndex === "0" && Number(data.earthquakeActiveCalloutAlpha) > .95;
      }, null, { timeout: 20000 });
      const data = await page.locator("#japan-overlay").evaluate((el) => ({ ...el.dataset }));
      const samples = await page.evaluate(() => window.quakeSamples.filter((s) => s.earthquakeCameraEventIndex === "0" && s.earthquakeYearTransitionPhase === "enter"));
      const firstMarker = samples.find((s) => Number(s.earthquakeActiveMarkerAlpha) > .01);
      const firstCallout = samples.find((s) => Number(s.earthquakeActiveCalloutAlpha) > .01);
      const arrivedAt = Number(data.earthquakeCameraArrivedAt);
      scan.markerDelay = firstMarker.at - arrivedAt;
      scan.calloutDelay = firstCallout.at - firstMarker.at;
      assert(scan.markerDelay >= 490 && scan.markerDelay < 680, `Marker must wait 0.5s after actual arrival: ${scan.markerDelay}`);
      assert(scan.calloutDelay >= 790 && scan.calloutDelay < 1060, `Callout must wait 0.9s after the cross: ${scan.calloutDelay}`);
      assert(samples.filter((s) => s.at < arrivedAt + 490).every((s) => Number(s.earthquakeActiveMarkerAlpha) === 0 && Number(s.earthquakeActiveCalloutAlpha) === 0));
      const easing = samples.find((s) => s.viewEasing === "ease-out-cubic" && Number(s.viewAnimationProgress) >= .4 && Number(s.viewAnimationProgress) <= .6);
      assert(easing && Number(easing.viewAnimationEasedProgress) > Number(easing.viewAnimationProgress) + .25, "Flyover must decelerate with ease-out");
      scan.date = data.earthquakeActiveLabelPrimary;
      assert.equal(scan.date, format(data.earthquakeCameraEventOccurredAt));
      assert.equal(data.earthquakeActiveLabelTimeZone, "Asia/Tokyo");
      assert.match(data.earthquakeActiveLabelSecondary, /^マグニチュード M\d\.\d/u);
      const text = await page.evaluate(() => window.quakeText);
      const lines = JSON.parse(data.selectionLabelLines);
      const dateText = text.findLast((t) => t.text === lines.find(line => line.index === 0)?.text);
      const magnitudeText = text.findLast((t) => t.text === lines.find(line => line.index === 1)?.text);
      assert(dateText && magnitudeText && magnitudeText.y > dateText.y, "Magnitude must be on the row below the date");
      assert.equal(data.earthquakeActiveMagnitudeLabel, "below-marker");
      scan.label = { dateText, magnitudeText, width: Number(data.selectionLabelWidthPx), height: Number(data.selectionLabelHeightPx) };
      assert(scan.label.width <= width - 24);
      assert.equal(data.selectionLabelShape, "observation-card");
      assert.equal(data.selectionLabelTypography, "mincho");
      const x = Number(data.earthquakeCameraEventScreenX), y = Number(data.earthquakeCameraEventScreenY);
      const left = Number(data.selectionLabelLeftPx), top = Number(data.selectionLabelTopPx);
      assert(!(x >= left && x <= left + scan.label.width && y >= top && y <= top + scan.label.height), "Callout must leave the epicenter cross visible");
      await page.screenshot({ path: path.join(output, `${name}-callout.png`) });
      await page.waitForFunction(() => {
        const data = document.querySelector("#japan-overlay").dataset;
        return data.earthquakeCameraEventIndex === "1" && data.earthquakeEventAlphas.split(",").slice(0, 2).every((alpha) => Number(alpha) === 1)
          && data.earthquakeEventScales.split(",").slice(0, 2).every((scale) => Number(scale) === 1);
      }, null, { timeout: 12000 });
      const outgoing = await page.locator("#japan-overlay").evaluate((el) => el.dataset.earthquakeEventAlphas.split(",").map(Number));
      await page.evaluate(() => { window.quakeSamples = []; globalThis.GaiaMapObservationAdapter.setSignalTime(4.1 / 27 * 100); });
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.earthquakeYear === "2004");
      const fade = await page.evaluate(() => window.quakeSamples.filter((s) => s.earthquakeYearTransitionPhase === "exit"));
      const intermediate = fade.filter((s) => Number(s.earthquakeYearTransitionProgress) > .05 && Number(s.earthquakeYearTransitionProgress) < .95);
      assert(intermediate.length >= 2, "Capture the group fade, not an instant disappearance");
      const visibleIndices = outgoing.flatMap((alpha, index) => alpha > .99 ? [index] : []);
      assert(visibleIndices.length >= 2);
      for (const sample of intermediate) {
        const alphas = sample.earthquakeEventAlphas.split(",").map(Number);
        const scales = sample.earthquakeEventScales.split(",").map(Number);
        assert.equal(sample.earthquakeExitOrder, "simultaneous");
        assert.equal(sample.earthquakeEventExitStaggerMs, "0");
        assert(visibleIndices.every((i) => Math.abs(alphas[i] - alphas[visibleIndices[0]]) < .01), "All outgoing POIs fade together");
        assert(visibleIndices.every((i) => scales[i] === 1), "Fade without shrinking individual POIs");
      }
      scan.fade = intermediate.map((s) => ({ at: s.at, progress: s.earthquakeYearTransitionProgress, alphas: s.earthquakeEventAlphas, scales: s.earthquakeEventScales }));
      // Cancel during the next flyover; its callback must not reveal an old event.
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "running");
      await page.evaluate(() => globalThis.GaiaMapObservationAdapter.selectMode(0));
      await page.waitForTimeout(1000);
      assert.equal(await page.locator("#japan-title").textContent(), "地球の一呼吸");
      assert.equal(await page.locator("#japan-layer").evaluate((el) => el.classList.contains("is-earthquake-mode")), false);
    }
    await context.close();
    console.log(`PASS ${name}`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
