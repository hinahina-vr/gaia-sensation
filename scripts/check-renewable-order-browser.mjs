import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/renewable-descending");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 },
      hasTouch: width < 600, reducedMotion: width < 600 ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=13&preview=renewable-order#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length === 30);
    const source = await page.evaluate(async () => {
      const snapshot = await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapObservationAdapter.selectMode(7);
      return snapshot.modes.find(mode => mode.id === "earth-organ").signals.current;
    });
    const expected = source.slice().sort((a, b) => b.renewablePercent - a.renewablePercent);
    assert(expected.length >= 200);
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
    const sequence = [];
    for (let index = 0; index < expected.length; index++) {
      await page.locator("#japan-layer [data-signal-time]").first().evaluate((input, position) => {
        input.value = String(position);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, index);
      await page.waitForFunction(iso3 => document.querySelector("#japan-overlay").dataset.renewableSelectedIso3 === iso3, expected[index].iso3);
      const actual = await page.evaluate(() => ({
        country: document.querySelector("#japan-overlay").dataset.renewableSelectedCountry,
        iso3: document.querySelector("#japan-overlay").dataset.renewableSelectedIso3,
        percent: document.querySelector("#japan-overlay").dataset.renewableSelectedPercent,
        text: document.querySelector("#japan-layer [data-signal-value]").textContent,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      assert.match(actual.text, /再生可能エネルギー発電割合/u);
      assert(actual.text.includes(actual.percent + "%"));
      assert.equal(actual.overflow, 0);
      sequence.push(actual);
      if (index === 0) {
        await page.evaluate(row => GaiaMapObservationAdapter.focusEarthLocation({ lon: row.lon, lat: row.lat,
          zoom: 1.5, targetX: .5, targetY: .4, durationMs: 0 }), expected[0]);
        await page.screenshot({ path: path.join(output, `${width}-highest.jpg`), type: "jpeg", quality: 88 });
      }
    }
    assert.deepEqual(sequence.map(row => row.percent), expected.map(row => row.renewablePercent.toFixed(1)));
    assert.deepEqual(sequence.map(row => row.iso3), expected.map(row => row.iso3));
    assert.equal(sequence[0].country, expected[0].countryJa);
    const preserved = await page.evaluate(async () => (await GaiaMapObservationAdapter.waitSignalsReady()).modes.find(mode => mode.id === "earth-organ").signals.current);
    assert.deepEqual(preserved, source, "Ranking must not mutate the source data or its order");
    report.checks.push({ width, manual: sequence });
    console.log(`PASS ${width}: all ${expected.length} slider selections descend, endpoints and source values preserved`);

    if (width === 1440) {
      // Check real per-country dwell and last -> first playback without waiting
      // an entire 209-country tour. Manual coverage above checks every country.
      const tailStart = expected.length - 2;
      await page.evaluate(position => GaiaMapObservationAdapter.setSignalTime(position), (tailStart + .05) / expected.length * 100);
      await page.waitForFunction(iso3 => document.querySelector("#japan-overlay").dataset.renewableSelectedIso3 === iso3, expected[tailStart].iso3);
      await page.evaluate(() => {
        const records = [];
        const sample = () => {
          const overlay = document.querySelector("#japan-overlay");
          const country = overlay.dataset.renewableSelectedCountry;
          if (country && records.at(-1)?.country !== country) records.push({ country, iso3: overlay.dataset.renewableSelectedIso3,
            percent: overlay.dataset.renewableSelectedPercent, at: performance.now() });
        };
        globalThis.renewablePlaybackCheck = { records, timer: setInterval(sample, 50) };
        sample();
      });
      await page.waitForFunction(() => renewablePlaybackCheck.records.length >= 5, null, { timeout: 29_000 });
      const playback = await page.evaluate(() => {
        clearInterval(renewablePlaybackCheck.timer);
        return renewablePlaybackCheck.records.slice(0, 5);
      });
      const wrapped = [...expected.slice(-2), ...expected.slice(0, 3)];
      assert.deepEqual(playback.map(row => row.iso3), wrapped.map(row => row.iso3));
      assert.deepEqual(playback.map(row => row.percent), wrapped.map(row => row.renewablePercent.toFixed(1)));
      for (let index = 2; index < playback.length; index++) {
        const dwell = playback[index].at - playback[index - 1].at;
        assert(dwell >= 2100 && dwell < 3100, `Country dwell unexpectedly changed: ${dwell}`);
      }
      report.checks.at(-1).playback = playback;
      console.log("PASS desktop: actual autoplay preserves 2.4-second country dwell and wraps last -> first without skipping");
    }
    await context.close();
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
