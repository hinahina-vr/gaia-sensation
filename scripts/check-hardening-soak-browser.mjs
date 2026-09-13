import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/hardening/soak");
const minutes = Math.max(1, Number(process.env.GAIA_SOAK_MINUTES || 30));
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--enable-precise-memory-info"] });
const report = { status: "running", startedAt: new Date().toISOString(), minutes, errors: [], viewports: [] };
try {
  const contexts = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    const sample = { width, runtimeRequests: [], samples: [], switches: 0 };
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/data/runtime/")) sample.runtimeRequests.push(request.url()); });
    await page.goto(`${base}/?mode=21#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapDemo && globalThis.GaiaStatisticsLab);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
    await page.evaluate(() => GaiaStatisticsLab.open({ datasetId: "rainfall" }));
    await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
    await page.evaluate(() => GaiaStatisticsLab.close());
    const cdp = await context.newCDPSession(page); await cdp.send("Performance.enable");
    contexts.push({ context, page, cdp, sample }); report.viewports.push(sample);
  }
  const started = Date.now();
  let cycle = 0;
  while (Date.now() - started < minutes * 60_000) {
    for (const { page, cdp, sample } of contexts) {
      await page.evaluate(async cycle => {
        await GaiaEstatExhibits.select(cycle % 10);
        GaiaEstatExhibits.selectPrefecture(cycle % 47);
        GaiaStatisticsLab.open({ datasetId: "rainfall" });
        const result = await GaiaStatisticsLab.run("summary", "rainfall");
        if (!result) throw new Error("statistics result missing");
        GaiaStatisticsLab.close();
      }, cycle);
      sample.switches++;
      if (cycle % 12 === 0) {
        await cdp.send("HeapProfiler.collectGarbage");
        const values = await cdp.send("Performance.getMetrics");
        sample.samples.push({ seconds: Math.round((Date.now() - started) / 1000), ...Object.fromEntries(values.metrics.filter(item => ["JSHeapUsedSize", "Nodes", "JSEventListeners", "Documents"].includes(item.name)).map(item => [item.name, item.value])) });
        fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
      }
    }
    cycle++;
    await new Promise(resolve => setTimeout(resolve, 10_000));
  }
  for (const { page, sample, context } of contexts) {
    assert.equal(sample.runtimeRequests.length, 11, "Shared snapshot must not refetch during view changes");
    const first = sample.samples[Math.min(2, sample.samples.length - 1)], last = sample.samples.at(-1);
    sample.retainedGrowthBytes = last.JSHeapUsedSize - first.JSHeapUsedSize;
    assert(sample.retainedGrowthBytes < 30_000_000, "Excess retained heap growth after warm-up");
    assert(last.Nodes - first.Nodes < 2500, "Repeated views retained DOM nodes");
    await page.screenshot({ path: path.join(output, `${sample.width}-end.png`) });
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
