import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistics-discovery/exhibits");
fs.mkdirSync(output, { recursive: true });
const catalog = JSON.parse(fs.readFileSync("docs/design/map-editorial-20260907/copy.json", "utf8")).exhibits;
const report = { status: "running", checks: [], errors: [], note: "Repository snapshots for base/FIRMS/e-Stat/live; deterministic varied API fixtures for global weather/air/quake UI paths. Fixture findings are QA examples, not current observations." };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) await context.route(`https://${host}/**`, route => {
      const latitudes = new URL(route.request().url()).searchParams.get("latitude")?.split(",") || ["35"];
      const samples = latitudes.map((lat, i) => ({ current: {
        time: "2026-09-07T06:00", wind_speed_10m: 1 + i % 15, wind_direction_10m: i * 31 % 360,
        surface_pressure: 1004 + i % 9, cloud_cover: 50 + i % 6,
        shortwave_radiation: 100 + i % 13 * 70, pm2_5: 4 + i % 18 * 2,
        aerosol_optical_depth: .02 + (17 - i % 18) * .02,
        temperature_2m: 29.8, precipitation: 0, relative_humidity_2m: 68,
      } }));
      return route.fulfill({ json: samples.length === 1 ? samples[0] : samples });
    });
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      type: "FeatureCollection", metadata: { generated: Date.now() }, features: Array.from({ length: 12 }, (_, i) => ({
        type: "Feature", id: `qa-quake-${i}`, geometry: { type: "Point", coordinates: [130 + i, 30 + i, i * 20 + 5] },
        properties: { mag: 4 + i % 3 / 10, place: `QA震源${i}`, time: Date.now() - i * 3600000 },
      })),
    } }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && message.text().includes("Statistics Lab analysis failed")) report.errors.push(message.text()); });
    await page.goto(`${base}/?preview=discovery-qa#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); });
    for (const exhibit of catalog) {
      await page.evaluate(number => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => button.textContent.trim() === number).click(), exhibit.number);
      await page.waitForFunction(number => document.querySelector("#japan-mode-number").textContent === number, exhibit.number);
      const n = Number(exhibit.number);
      if (n >= 15 && n <= 20) await page.evaluate(async () => {
        GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveExhibits.selectObservationPoint("tokyo"); await GaiaLiveData.selectCity("tokyo");
      });
      const actionSelector = n >= 2 && n <= 5 ? "[data-planet-analysis]" : n === 6 ? "[data-firms-analysis]"
        : n >= 15 && n <= 20 ? "[data-live-deck-analysis]" : n >= 21 ? "[data-estat-analysis]" : "#gaia-statistics-button";
      await page.waitForFunction(selector => { const button = document.querySelector(selector); return button && !button.disabled; }, actionSelector);
      if (await page.locator(actionSelector).getAttribute("aria-disabled") === "true") {
        // Live-only displays intentionally do not expose statistical analysis.
        await page.locator(actionSelector).evaluate(button => button.click());
        assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().open), false);
        report.checks.push({ width, number: exhibit.number, analysisDisabled: true });
        console.log(`PASS ${width}/${exhibit.number}: live-only analysis remains disabled`);
        continue;
      }
      // Invoke the real exhibit's button, including the legacy proxy target.
      await page.locator(actionSelector).evaluate(button => button.click());
      await page.waitForFunction(() => GaiaStatisticsLab.getState().open && GaiaStatisticsLab.getState().analysisReady);
      const check = await page.evaluate(async () => {
        const state = GaiaStatisticsLab.getState(); const result = await GaiaStatisticsLab.run(state.methodId);
        const insight = result.dataInsight; const findings = document.querySelector("#gaia-statistics-findings");
        return { state, kind: result.kind, domain: insight.domain, primaryId: insight.primaryId, headline: insight.headline, scope: insight.scope,
          primary: { ...insight.candidates[0], chart: undefined }, lenses: insight.candidates.map(candidate => candidate.id),
          selectedTab: document.querySelector('[data-stat-view][aria-selected="true"]').dataset.statView,
          overflow: findings.scrollWidth - findings.clientWidth, text: findings.textContent,
          fontSize: getComputedStyle(findings.querySelector('[data-kind="meaning"] p')).fontSize,
          firstFinding: findings.querySelector('[data-kind]')?.dataset.kind,
          chartFirstRecord: result.chart.rows?.[0]?.id || null, chartCount: result.chart.rows?.length || null,
        };
      });
      assert.equal(check.state.methodId, "discovery", exhibit.number);
      assert.equal(check.selectedTab, "chart", "Every exhibit analysis starts with its graph");
      await page.locator(".gaia-statistics-companion").click();
      assert.equal(await page.locator('[data-stat-view="findings"]').getAttribute("aria-selected"), "true");
      assert(check.overflow <= 1, `${width}/${exhibit.number}: text overflow`);
      assert(parseFloat(check.fontSize) >= 16, "Findings must use readable body text");
      assert.equal(check.firstFinding, "observation");
      assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), false, "No duplicate reading in the sidebar");
      assert.doesNotMatch(await page.locator("#gaia-statistics-findings").innerText(), /課題の候補|この違いが、なぜ問題/);
      assert(check.primary.signal && check.primary.meaning && check.primary.question && check.primary.test);
      assert.doesNotMatch(check.text, /NaN|undefined|Infinity/);
      if (n === 7) { assert.equal(check.state.datasetId, "ocean-currents"); assert.equal(check.primaryId, "opposing-currents"); }
      if (n >= 16 && n <= 20) assert.equal(check.primary.status, "needs-comparison");
      const recordButton = page.locator('#gaia-statistics-findings [data-kind="observation"] button').first();
      if (await recordButton.count()) {
        await recordButton.click();
        const selected = await page.evaluate(() => GaiaStatisticsLab.getState().selectedRecordId);
        assert(check.primary.recordIds.includes(selected), `${exhibit.number}: direct record link`);
        await page.locator('[data-stat-view="findings"]').click();
      }
      await page.locator('[data-stat-view="chart"]').click();
      await page.waitForFunction(count => {
        const canvas = document.querySelector("#gaia-statistics-canvas");
        const rect = canvas.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(canvas).visibility === "visible" && canvas.dataset.chartReady === "true" && (!count || Number(canvas.dataset.pointCount) === count);
      }, check.chartCount);
      const graph = await page.locator("#gaia-statistics-canvas").evaluate(canvas => ({ x: canvas.dataset.axisX, y: canvas.dataset.axisY, domain: `${canvas.dataset.domainX},${canvas.dataset.domainY}` }));
      assert.doesNotMatch(graph.domain, /NaN|undefined|Infinity/);
      if (check.chartFirstRecord) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.locator("#gaia-statistics-canvas").focus(); await page.keyboard.press("Home");
        const keyboardState = await page.evaluate(() => ({ active: document.activeElement.id, selectedView: document.querySelector('[data-stat-view][aria-selected="true"]').dataset.statView,
          inert: Boolean(document.querySelector("#gaia-statistics-canvas").closest("[inert]")), tooltip: document.querySelector(".gaia-statistics-chart-tooltip")?.dataset.recordId }));
        if (keyboardState.tooltip !== check.chartFirstRecord) console.log("KEYBOARD", exhibit.number, keyboardState, "expected", check.chartFirstRecord);
        await page.waitForFunction(id => document.querySelector(".gaia-statistics-chart-tooltip")?.dataset.recordId === id, check.chartFirstRecord);
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().selectedRecordId), check.chartFirstRecord, `${exhibit.number}: graph sort must retain record identity`);
      }
      await page.locator('[data-stat-view="findings"]').click();
      check.graph = graph;
      if ([1, 2, 3, 4, 5, 6, 7, 14, 16, 21, 24, 29, 30].includes(n)) await page.screenshot({ path: path.join(output, `${width}-${exhibit.number}.png`) });
      report.checks.push({ width, number: exhibit.number, title: exhibit.title, ...check });
      console.log(`PASS ${width}/${exhibit.number} ${check.primaryId}: ${check.headline}`);
      await page.locator("#gaia-statistics-close").click();
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  const desktop = report.checks.filter(row => row.width === 1440 && !row.analysisDisabled);
  assert(new Set(desktop.map(row => row.primaryId)).size >= 8, "Insufficient actual feature diversity among the non-live exhibits");
  report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
