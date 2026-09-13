import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/earthquake-progress");
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync("app.js", "utf8");
const slice = (start, end) => {
  assert(source.includes(start) && source.includes(end));
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
};
const mode = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8")).modes.find(mode => mode.id === "rhythm-of-disaster");
// Exercise the real clock/selection code, not a separately reimplemented formula.
const harness = vm.runInNewContext(`
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let signalTimePosition = 0, co2TimelineStartedAt = 0, co2TimelinePausedUntil = 0;
  let co2TimelineLastStep = -1, co2TimelineHeld = false;
  let active = mode;
  const reducedMotion = false, japanIsOpen = true, storyModeDetour = null;
  const CO2_TIMELINE_MANUAL_PAUSE_MS = 8000;
  const mapPlotRevealGeneration = 1;
  const earthquakeYearTransition = { generation: 1, currentYear: "", phase: "enter", changedAt: 0 };
  const earthquakePlaybackScheduleCache = new WeakMap();
  const getActiveSignalMode = () => active;
  const getActiveTimelineDuration = () => getGlobalEarthquakePlaybackSchedule(mode.signals.globalEvents).durationMs;
  const updateSignalInterface = () => {};
  ${slice("  const GLOBAL_EARTHQUAKE_MIN_MAGNITUDE =", "  const GLOBAL_EARTHQUAKE_YEAR_COUNT =")}
  const GLOBAL_EARTHQUAKE_YEAR_COUNT = 27;
  ${slice("  const getEarthquakeStaggerDuration =", "  const getEarthquakeEnterReveals =")}
  ${slice("  const getTimelineElapsedForPosition =", "  const destroyStoryMapAivaBackdrop =")}
  ${slice("  const updateCo2TimelineAnimation =", "  const DATA_TRANSFORMS =")}
  ({
    schedule: getGlobalEarthquakePlaybackSchedule(mode.signals.globalEvents),
    tick(now) { updateCo2TimelineAnimation(now); return getGlobalEarthquakePlaybackEntry(mode, signalTimePosition).entry.year; },
    seek(index, now, elapsed = null) {
      const entry = getGlobalEarthquakePlaybackSchedule(mode.signals.globalEvents).entries[index];
      signalTimePosition = (index + .5) / 27 * 100;
      earthquakeYearTransition.currentYear = elapsed === null ? "" : entry.year;
      earthquakeYearTransition.changedAt = now - (elapsed || 0) + (index ? 320 : 1600);
      resumeTimelineAfterManualSeek(now);
      return { startedAt: co2TimelineStartedAt, pausedUntil: co2TimelinePausedUntil };
    },
    otherSeek(now) { active = { id: "breathing-earth" }; resumeTimelineAfterManualSeek(now); return co2TimelinePausedUntil; }
  });
`, { mode });
const schedule = JSON.parse(JSON.stringify(harness.schedule));
assert.equal(schedule.entries.length, 27);
for (const entry of schedule.entries) {
  assert.equal(harness.tick(entry.startMs + 1), entry.year, `entry into ${entry.year}`);
  assert.equal(harness.tick(entry.endMs - 1), entry.year, `end of ${entry.year}`);
}
assert.equal(harness.tick(schedule.durationMs + 1), "2000", "last year loops to first");
for (const index of [8, 17]) {
  const entry = schedule.entries[index];
  const now = 1_000_000;
  const seek = harness.seek(index, now);
  assert.equal(seek.pausedUntil, 0, "POI playback must not incur a second manual pause");
  assert.equal(harness.tick(now + entry.durationMs - 1), entry.year);
  assert.equal(harness.tick(now + entry.durationMs + 1), String(Number(entry.year) + 1));
  harness.seek(index, now, entry.durationMs - 250);
  assert.equal(harness.tick(now + 251), String(Number(entry.year) + 1), "same-year seek/closing a card preserves completed progress");
}
assert.equal(harness.otherSeek(100), 8100, "non-earthquake manual pause remains unchanged");
console.log("PASS all 27 year boundaries, loop, manual seek/resume and unchanged non-quake pause");

const report = { status: "running", schedule, checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.progressSamples = [];
      const sample = () => {
        const data = document.querySelector("#japan-overlay")?.dataset;
        if (data?.earthquakeYear) window.progressSamples.push({ at: performance.now(), ...data });
        if (window.progressSamples.length > 5000) window.progressSamples.shift();
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8") }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => route.abort());
    }
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.clock.install();
    await page.goto(`${base}/?preview=earthquake-progress#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !!globalThis.GaiaMapObservationAdapter);
    await page.evaluate(() => globalThis.GaiaMapObservationAdapter.waitSignalsReady());
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.evaluate(() => {
      globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
      globalThis.GaiaMapObservationAdapter.selectMode(5);
    });
    await page.clock.runFor(2200);
    for (const index of [8, 17]) {
      const entry = schedule.entries[index];
      const targetYear = String(Number(entry.year) + 1);
      const startedAt = await page.evaluate(index => {
        window.progressSamples = [];
        const input = document.querySelector("#japan-layer [data-signal-time]");
        input.value = String((index + .5) / 27 * 100);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return performance.now();
      }, index);
      // Fully run 2008's two epicenters; for the longer 2017 sequence advance
      // its clock near the boundary, then render the next year's actual arrival.
      if (index === 17) {
        await page.clock.runFor(500);
        await page.clock.fastForward(entry.durationMs - 1500);
        await page.clock.runFor(4000);
      } else {
        await page.clock.runFor(entry.durationMs + 3000);
      }
      const samples = await page.evaluate(() => window.progressSamples);
      const changed = samples.find(sample => sample.earthquakeYear === targetYear && sample.earthquakeYearTransitionPhase === "enter");
      assert(changed, `${width}: must progress from ${entry.year} to ${targetYear}`);
      assert(changed.at - startedAt < entry.durationMs + 700, `${width}: no repeated year-sized dwell`);
      const entered = samples.find(sample => sample.earthquakeYear === targetYear && Number(sample.earthquakeActiveCalloutAlpha) > .9);
      assert(entered, `${targetYear}: camera, cross and callout must resume`);
      assert.match(entered.earthquakeCameraEventOccurredAt, new RegExp(`^${targetYear}`, "u"));
      const state = await page.locator("#japan-overlay").evaluate(el => ({ ...el.dataset }));
      assert.equal(state.earthquakeYear, targetYear);
      assert.equal(state.earthquakeCameraSuppressed, "false");
      report.checks.push({ width, from: entry.year, to: targetYear, expectedDwell: entry.durationMs, actualDwell: changed.at - startedAt, markerAlpha: entered.earthquakeActiveMarkerAlpha, calloutAlpha: entered.earthquakeActiveCalloutAlpha });
      await page.screenshot({ path: path.join(output, `${width}-${targetYear}-resumed.png`) });
      console.log(`PASS ${width}: ${entry.year} → ${targetYear}`);
    }
    await context.close();
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
