import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/bidirectional-steps");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440, 3840, 901]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?mode=13&preview=step-wrap#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && document.querySelector("[data-map-dock-year-step]"));
    const sources = await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    await page.evaluate(() => { GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
    const slider = page.locator("#japan-layer [data-signal-time]").first();
    const previous = page.locator('[data-map-dock-year-step="-1"]');
    const next = page.locator('[data-map-dock-year-step="1"]');
    const number = page.locator("[data-map-dock-year]");
    for (const mode of [2, 3, 7]) {
      await page.evaluate(mode => GaiaMapObservationAdapter.selectMode(mode), mode);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      await slider.evaluate(input => { input.value = input.min; input.dispatchEvent(new Event("input", { bubbles: true })); });
      await page.waitForFunction(() => document.querySelector("[data-map-dock-year]").textContent === "01");
      const count = Number(await slider.getAttribute("data-map-step-count"));
      const [id, key] = mode === 7 ? ["earth-organ", "current"] : mode === 2 ? ["forest-cloud-engine", "precipitation"] : ["nothing-is-waste", "countryWaste"];
      assert.equal(count, sources.modes.find(mode => mode.id === id).signals[key].length);
      await previous.click();
      await page.waitForFunction(count => document.querySelector("[data-map-dock-year]").textContent === String(count), count);
      assert.equal(await slider.getAttribute("data-map-step-index"), String(count - 1));
      await next.focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-map-dock-year]").textContent === "01");
      assert.equal(await slider.getAttribute("data-map-step-index"), "0");
      await next.click();
      await page.waitForFunction(() => document.querySelector("[data-map-dock-year]").textContent === "02");
      await previous.click();
      await page.waitForFunction(() => document.querySelector("[data-map-dock-year]").textContent === "01");
      assert.equal(await page.locator("[data-map-dock-year-unit]").textContent(), "STEP");
      assert.deepEqual(await page.locator(".map-dock-timeline-scale span").allTextContents(), Array.from({ length: 7 }, (_, index) => String(Math.round(1 + (count - 1) * index / 6)).padStart(Math.max(2, String(count).length), "0")));
      report.checks.push({ width, mode, count, endpoints: `01 <-> ${count}`, adjacent: "01 <-> 02" });
    }
    const expected = sources.modes.find(mode => mode.id === "earth-organ").signals.current.slice().sort((a, b) => b.renewablePercent - a.renewablePercent);
    const cycles = await page.evaluate(async () => {
      const records = [], input = document.querySelector("#japan-layer [data-signal-time]");
      for (const direction of [-1, 1]) {
        for (let step = 0; step < Number(input.dataset.mapStepCount); step++) {
          document.querySelector(`[data-map-dock-year-step="${direction}"]`).click();
          await new Promise(requestAnimationFrame);
          records.push({ direction, index: Number(input.dataset.mapStepIndex), display: document.querySelector("[data-map-dock-year]").textContent,
            reading: document.querySelector("#japan-layer [data-signal-value]").textContent });
        }
      }
      return records;
    });
    assert.deepEqual(cycles.map(row => row.index), [
      ...Array.from({ length: expected.length }, (_, index) => expected.length - 1 - index),
      ...Array.from({ length: expected.length }, (_, index) => (index + 1) % expected.length),
    ]);
    for (const row of cycles) {
      assert.equal(row.display, String(row.index + 1).padStart(2, "0"));
      assert(row.reading.includes(expected[row.index].renewablePercent.toFixed(1) + "%"), "Displayed value follows the selected step");
    }
    report.checks.push({ width, cycles });
    await previous.click();
    await page.waitForFunction(count => document.querySelector("[data-map-dock-year]").textContent === String(count), expected.length);
    await page.locator(".map-dock-year").screenshot({ path: path.join(output, `${width}-01-left-to-last.png`) });
    await next.click();
    await page.waitForFunction(() => document.querySelector("[data-map-dock-year]").textContent === "01");
    await page.locator(".map-dock-year").screenshot({ path: path.join(output, `${width}-last-right-to-01.png`) });
    // Leaving a STEP exhibit must not reinterpret chronological years as ranks.
    await page.evaluate(() => GaiaMapObservationAdapter.selectMode(0));
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    assert.equal(await slider.getAttribute("data-map-step-count"), null);
    await slider.evaluate(input => { input.value = input.min; input.dispatchEvent(new Event("input", { bubbles: true })); });
    await previous.click();
    assert.equal(await slider.inputValue(), "0");
    await page.waitForFunction(() => document.querySelector("[data-map-dock-year]").textContent === "1958");
    console.log(`PASS ${width}: three STEP exhibits wrap both ways; ${expected.length * 2} energy steps preserve order, values and numbers; year scale unchanged`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 88 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
