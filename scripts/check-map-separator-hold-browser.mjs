import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve(`artifacts/map-separator-hold-2026-09-09/tail-${before ? "before" : "after"}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440,390]) for (const reduced of [false,true]) {
    const label = `${width}-${reduced ? "reduced" : "motion"}`;
    const expectedDuration = (reduced ? 2460 : 3500) - (before ? 0 : 500);
    const context = await browser.newContext({ viewport: { width,height: width < 600 ? 844 : 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/firms", route => route.fulfill({ path: "data/firms-active-fire-snapshot.json", contentType: "application/json" }));
    await context.route("https://api.open-meteo.com/**", route => route.fulfill({ json: { current: { time: new Date().toISOString(), wind_speed_10m: 5, wind_direction_10m: 80, surface_pressure: 1005, cloud_cover: 58, shortwave_radiation: 194 } } }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ label, message: error.message }));
    await page.goto(`${base}/?exhibit=6&live=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaLiveExhibits && document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(() => { GaiaMapDemo.stop(); GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }); GaiaMapCategories.buttons().find(button => Number(button.textContent) === 6).click(); });
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(expectedDuration => {
      globalThis.__separatorFrames = [];
      const sample = () => {
        const title = document.querySelector("#map-title-transition-text");
        const layer = document.querySelector("#map-title-transition");
        const data = document.querySelector("#japan-overlay").dataset;
        if (title.textContent === "街を通る風") {
          const root = getComputedStyle(layer), text = getComputedStyle(title);
          const copy = getComputedStyle(layer.querySelector(".map-title-transition-copy"));
          __separatorFrames.push({ elapsed: performance.now() - Number(data.titleSeparatorStartedAt),
            duration: Number(data.titleSeparatorEndsAt) - Number(data.titleSeparatorStartedAt),
            running: document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"),
            root: Number(root.opacity), text: Number(text.opacity), copy: Number(copy.opacity),
            subtitle: Number(getComputedStyle(document.querySelector("#map-title-transition-subtitle")).opacity),
            bandScale: new DOMMatrix(getComputedStyle(layer,"::before").transform).a,
            bandX: new DOMMatrix(getComputedStyle(layer,"::before").transform).e });
          if (__separatorFrames.at(-1).elapsed > expectedDuration + 450) return;
        }
        requestAnimationFrame(sample);
      };
      GaiaMapCategories.buttons().find(button => Number(button.textContent) === 15).click();
      requestAnimationFrame(sample);
    }, expectedDuration);
    const probeTime = reduced ? 1400 : 1900;
    await page.waitForFunction(time => globalThis.__separatorFrames?.at(-1)?.elapsed >= time, probeTime);
    const probe = await page.evaluate(() => __separatorFrames.at(-1));
    assert.equal(probe.running, true, `${label}: separator ended during the reading hold`);
    assert(probe.root > .99 && probe.text > .99 && probe.copy > .99 && probe.subtitle > .99, `${label}: text faded during the reading hold`);
    await page.screenshot({ path: path.join(output,`${label}-extended-hold.png`) });
    await page.waitForFunction(time => __separatorFrames.at(-1).elapsed >= time, expectedDuration + 450);
    const trace = await page.evaluate(() => __separatorFrames);
    const firstReadable = trace.find(frame => frame.root > .99 && frame.text > .99 && frame.subtitle > .99);
    const fade = trace.find(frame => frame.elapsed > 1000 && frame.running && frame.copy < .99);
    const completion = trace.find(frame => !frame.running);
    report.checks.push({ label,probe,firstReadable,fade,completion,trace });
    assert(Math.abs(trace[0].duration - expectedDuration) <= 1);
    assert(firstReadable && firstReadable.elapsed < (reduced ? 350 : 1150), "Entrance unexpectedly slowed down");
    if (!reduced) assert(fade && Math.abs(fade.elapsed - (before ? 3050 : 2200)) < 150, "Text fade did not begin at the expected time");
    assert(completion && completion.elapsed >= expectedDuration && completion.elapsed < expectedDuration + 350, "Separator cleanup is out of sync");
    assert.equal(await page.locator("#map-title-transition").evaluate(node => getComputedStyle(node).opacity), "0");
    console.log(`PASS ${label}: ${expectedDuration}ms, fade ${fade?.elapsed.toFixed(1) || "reduced"}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? "baseline-recorded" : "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output,"report.json"), JSON.stringify(report,null,2));
  await browser.close();
}
