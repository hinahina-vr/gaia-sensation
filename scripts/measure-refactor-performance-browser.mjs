import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", label = "current", output = "artifacts/refactor-performance"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const report = { label, samples: [], errors: [] };
const browser = await chromium.launch({
  executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, locale: "ja-JP" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?mode=21#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop();
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    for (const number of [21, 22, 24]) {
      await page.evaluate(number => GaiaMapCategories.buttons()[number - 1].click(), number);
      await page.waitForFunction(number => GaiaEstatExhibits.getState().activeIndex === number - 21, number);
      await page.waitForTimeout(1600);
      await page.evaluate(() => {
        GaiaEstatExhibits.setPeriod(0);
        GaiaEstatExhibits.selectPrefecture(12);
      });
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        const root = document.querySelector("#japan-layer");
        const state = { mutations: 0, markerMutations: 0, markerMutationTypes: {}, frames: 0, frame: 0, running: true, started: performance.now() };
        state.observer = new MutationObserver(records => {
          state.mutations += records.length;
          for (const record of records) {
            if (!(record.target instanceof Element) || !record.target.closest(".gaia-estat-markers, .gaia-estat-prefecture-regions")) continue;
            state.markerMutations++;
            const key = record.attributeName || record.type;
            state.markerMutationTypes[key] = (state.markerMutationTypes[key] || 0) + 1;
          }
        });
        state.observer.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
        const tick = () => { state.frames++; if (state.running) state.frame = requestAnimationFrame(tick); };
        state.frame = requestAnimationFrame(tick);
        globalThis.__refactorProbe = state;
      });
      const start = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(entry => [entry.name, entry.value]));
      await page.waitForTimeout(3000);
      const end = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(entry => [entry.name, entry.value]));
      const measured = await page.evaluate(() => {
        const state = globalThis.__refactorProbe;
        state.running = false; cancelAnimationFrame(state.frame); state.observer.disconnect();
        const durationMs = performance.now() - state.started;
        return { durationMs, fps: state.frames / durationMs * 1000, frames: state.frames, mutations: state.mutations, markerMutations: state.markerMutations, markerMutationTypes: state.markerMutationTypes };
      });
      const metrics = Object.fromEntries(["ScriptDuration", "TaskDuration", "LayoutCount", "RecalcStyleCount", "LayoutDuration", "RecalcStyleDuration"].map(name => [name, end[name] - start[name]]));
      report.samples.push({ width, number, ...measured, metrics });
      await page.screenshot({ path: path.join(output, `${label}-${width}-${number}.png`) });
      console.log(JSON.stringify(report.samples.at(-1)));
    }
    await cdp.detach();
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(path.join(output, `${label}.json`), JSON.stringify(report, null, 2));
  await browser.close();
}
