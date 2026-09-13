import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", reference = "HEAD", output = "artifacts/refactor-equivalence"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const runtimeFiles = ["gaia-mode-loader.js", "app.js", "statistics-lab.js", "src/exploration/estat-exhibits.js",
  "src/exploration/live-exhibits.js", "src/exploration/firms-exhibit.js", "src/exploration/planet-signals-exhibit.js",
  "src/exploration/country-emissions-history.js"];
const originals = new Map(runtimeFiles.map(file => [`/${file}`, execFileSync("git", ["show", `${reference}:${file}`], { encoding: "utf8", maxBuffer: 5_000_000, windowsHide: true })]));
const report = { reference, status: "running", checks: [], errors: [] };
const currentModes = new Map(JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8")).modes.map(mode => [mode.id, mode.signals]));
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 390]) {
    const snapshots = {};
    for (const version of ["before", "after"]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, locale: "ja-JP" });
      await context.addInitScript(() => {
        sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
        localStorage.setItem("gaia-senseware-bgm-muted", "true");
        const nativeRequest = requestAnimationFrame, nativeCancel = cancelAnimationFrame;
        const nativeNow = performance.now.bind(performance);
        const pending = new Map();
        let nextId = 1, clock = null;
        window.requestAnimationFrame = callback => {
          const id = nextId++;
          const nativeId = clock === null ? nativeRequest(time => { pending.delete(id); callback(time); }) : null;
          pending.set(id, { callback, nativeId });
          return id;
        };
        window.cancelAnimationFrame = id => { const entry = pending.get(id); if (entry?.nativeId != null) nativeCancel(entry.nativeId); pending.delete(id); };
        performance.now = () => clock ?? nativeNow();
        window.__renderClock = {
          freeze() { clock = 100000; for (const entry of pending.values()) if (entry.nativeId != null) nativeCancel(entry.nativeId); },
          tick(delta) { clock += delta; const callbacks = [...pending.values()]; pending.clear(); for (const { callback } of callbacks) callback(clock); },
        };
      });
      await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
      if (version === "before") await context.route(`${base}/**`, route => {
        const original = originals.get(new URL(route.request().url()).pathname);
        return original === undefined ? route.continue() : route.fulfill({ body: original, contentType: "text/javascript" });
      });
      const page = await context.newPage();
      page.on("pageerror", error => report.errors.push(`${version}/${width}: ${error.message}`));
      await page.goto(`${base}/?mode=21#world`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
      await page.evaluate(async () => {
        await GaiaMapObservationAdapter.waitSignalsReady();
        GaiaModeEntryGuide.close("map", { restoreFocus: false });
        GaiaMapDemo.stop();
      });
      await page.waitForTimeout(1800);
      // Compare the public analysis API too: this exercises the refactored
      // yearly aggregation and formatter with today's complete snapshot.
      await page.evaluate(() => GaiaStatisticsLab.open({ datasetId: "earthquakes" }));
      await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
      const analyses = await page.evaluate(async () => {
        const results = [];
        for (const dataset of ["co2-trend", "jma-co2", "ocean-currents", "wind-climate", "rainfall", "waste", "emissions-urban", "earthquakes", "forest-urban", "renewables", "population"]) {
          results.push({ dataset, result: await GaiaStatisticsLab.run("summary", dataset) });
        }
        GaiaStatisticsLab.close();
        return results;
      });
      fs.writeFileSync(path.join(output, `${version}-${width}-analyses.json`), JSON.stringify(analyses, null, 2));
      snapshots[`${version}Analyses`] = analyses;
      await page.evaluate(() => __renderClock.freeze());
      snapshots[version] = [];
      for (let number = 21; number <= 30; number++) {
        const snapshot = await page.evaluate(async number => {
          await GaiaEstatExhibits.select(number - 21);
          __renderClock.tick(1600); __renderClock.tick(16);
          GaiaEstatExhibits.setPeriod(0);
          GaiaEstatExhibits.selectPrefecture(12);
          __renderClock.tick(1000); __renderClock.tick(16);
          const nodes = [...document.querySelectorAll(".gaia-estat-marker, .gaia-estat-prefecture-region")].map(node => ({
            text: node.textContent, label: node.getAttribute("aria-label"), current: node.getAttribute("aria-current"),
            hidden: node.hidden || false, style: node.getAttribute("style"), path: node.getAttribute("d"),
          }));
          const canvas = document.querySelector("#gaia-estat-canvas");
          return { number, state: GaiaEstatExhibits.getState(), nodes,
            dataset: GaiaEstatExhibits.getStatisticsDataset(),
            canvas: { width: canvas.width, height: canvas.height, pixels: canvas.toDataURL(), heatmap: { ...canvas.dataset } },
            regionTransform: document.querySelector(".gaia-estat-prefecture-regions g")?.getAttribute("transform"),
          };
        }, number);
        snapshot.canvas.pixelHash = createHash("sha256").update(snapshot.canvas.pixels).digest("hex");
        delete snapshot.canvas.pixels;
        snapshots[version].push(snapshot);
        if ([21, 22, 24].includes(number)) await page.screenshot({ path: path.join(output, `${version}-${width}-${number}.png`) });
      }
      await context.close();
    }
    fs.writeFileSync(path.join(output, `snapshots-${width}.json`), JSON.stringify(snapshots, null, 2));
    const normalizedBefore = structuredClone(snapshots.beforeAnalyses);
    const countLabels = [
      ["wind-climate", "31地点の風速と気温", `${currentModes.get("blue-circulation").climate.length}地点の風速と気温`],
      ["rainfall", "31地点の平均降水量", `${currentModes.get("forest-cloud-engine").precipitation.length}地点の平均降水量`],
      ["waste", "31か国の再資源化率", `${currentModes.get("nothing-is-waste").countryWaste.length}の国・地域の再資源化率`],
      ["forest-urban", "31か国の森林率と都市化率", `${currentModes.get("three-ecologies").pairedCountries.length}の国・地域の森林率と都市化率`],
    ];
    // The count-label repair is separate from the numeric refactor. Permit
    // only these exact old prefixes in the two known prose fields; no numeric
    // result, data, chart, evidence or other text is removed from comparison.
    for (const [id, oldTitle, newTitle] of countLabels) {
      const insight = normalizedBefore.find(row => row.dataset === id)?.result?.dataInsight;
      for (const field of [insight, insight?.statisticalReading]) if (field?.scope?.startsWith(`${oldTitle} / `)) field.scope = newTitle + field.scope.slice(oldTitle.length);
    }
    assert.deepEqual(snapshots.afterAnalyses, normalizedBefore, `${width}px: statistics differ beyond the documented count-label repair; see saved analysis JSON`);
    report.checks.push(`${width}px: 11 summaries match exactly apart from four corrected dataset count labels (two prose fields each)`);
    for (let index = 0; index < snapshots.before.length; index++) {
      assert.deepEqual(snapshots.after[index], snapshots.before[index], `${width}px / exhibit ${index + 21}: labels, geometry, data, canvas pixels`);
      report.checks.push(`${width}px / ${index + 21}: exact labels, geometry, statistics dataset and 2D canvas pixels`);
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
