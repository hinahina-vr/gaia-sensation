import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import "./check-co2-timeline-speed.mjs";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/co2-timeline-3x");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440,390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "no-preference" });
    page.on("pageerror", error=>report.errors.push(error.message));
    await page.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await page.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await page.goto(`${base}/?preview=co2-timeline-3x#world`, {waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async()=> {
      await GaiaMapObservationAdapter.waitSignalsReady();
      globalThis.GaiaModeEntryGuide?.close("map", {restoreFocus:false});
      GaiaMapObservationAdapter.selectMode(0);
    });
    await page.waitForFunction(()=>document.querySelector("#japan-mode-number")?.textContent === "06" && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const sample = () => page.evaluate(() => ({ time: performance.now(), position: Number(document.querySelector("#japan-layer [data-signal-time]").value), year: document.querySelector("#co2-timeline-year")?.textContent, overflow: document.documentElement.scrollWidth-innerWidth }));
    const before = await sample();
    await page.waitForTimeout(4000);
    const after = await sample();
    const percentPerSecond = ((after.position-before.position+100)%100)/((after.time-before.time)/1000);
    assert(Math.abs(percentPerSecond-5) < .35, `${width}: expected 5% per second, got ${percentPerSecond}`);
    assert(after.overflow <= 1);
    assert.match(after.year, /^\d{4}年/u);
    assert.notEqual(after.year, before.year, "The displayed year follows automatic playback");
    assert(await page.locator(".map-dock-year").isVisible(), "Current year remains visible on desktop and mobile");
    // Seeking remains manual and pauses autoplay for the existing grace period.
    const slider = page.locator("#japan-layer [data-signal-time]").first();
    await slider.evaluate(node=>{node.value="50";node.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.waitForTimeout(500);
    assert.equal(Number(await slider.inputValue()), 50);
    await page.screenshot({path:path.join(output,`${width}.png`)});
    report.checks.push({width,before,after,percentPerSecond,estimatedLoopSeconds:100/percentPerSecond,manualPause:true});
    console.log(`PASS ${width}px: ${percentPerSecond.toFixed(2)}%/s, ${(100/percentPerSecond).toFixed(2)}s per loop; manual seek preserved`);
    await page.close();
  }
  assert.deepEqual(report.errors, []); report.status="passed";
} catch(error) { report.status="failed"; report.failure=error.stack; throw error; }
finally { fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2)); await browser.close(); }
