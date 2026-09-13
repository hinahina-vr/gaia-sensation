import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { JAPAN_POLLUTION_EXHIBITS } from "../src/exploration/japan-pollution-catalog.js";
import { JAPAN_SENSOR_OPEN_EXHIBITS } from "../src/exploration/japan-sensor-open-catalog.js";
import { concentrationDomain } from "../src/shared/observation-numbers.js";
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4479";
const output = path.resolve("artifacts/japan-pollution-2026-09-09/final-details");
fs.mkdirSync(output, { recursive: true });
const files = ["src/exploration/marine-cod-exhibit.js", "src/exploration/japan-pollution-catalog.js", "src/shared/observation-numbers.js", "statistics-lab.js", "marine-cod-exhibit.css", "index.html", "gaia-mode-loader.js", "map-exhibit-categories.js", "src/exploration/index.js"];
const report = { status: "running", environment: "Local installed Chrome. Source JSONs unmodified, all external network blocked. Desktop/touch emulation, not production or physical devices. Recheck final unit/date labels and persistence, following the full four-viewport test.",
  sha256: Object.fromEntries(files.map(f => [f, createHash("sha256").update(fs.readFileSync(f)).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://**", route => route.abort());
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    const boot = async (number, reload = false) => {
      if (reload) await page.reload({ waitUntil: "domcontentloaded" });
      else await page.goto(`${base}/?exhibit=${number}#world`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().count > 0 && globalThis.GaiaMapDemo && globalThis.GaiaMapCategories?.buttons().length === GaiaMapCategories.exhibitCount);
      await page.evaluate(() => GaiaMapDemo.stop());
    };
    await boot(44);
    const pick = async exhibit => {
      await page.evaluate(id => GaiaMarineCod.select(id), exhibit.id);
      await page.waitForFunction(id => GaiaMarineCod.getState().id === id && GaiaMarineCod.getState().count > 0 && !document.querySelector("[data-cod-controls]").disabled, exhibit.id);
      const data = JSON.parse(fs.readFileSync(`data/${exhibit.dataFile}`, "utf8"));
      const row = data.periods.at(-1).stations.find(r => r.measurement.quality === "measured");
      await page.locator("[data-cod-prefecture]").selectOption(row.prefCode);
      await page.locator("[data-cod-station]").selectOption(row.id);
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
      return { data, row };
    };
    const action = async name => {
      if (width < 900) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.getByRole("button", { name: name === "source" ? "データの出典" : "統計分析", exact: true }).last().click();
      } else await page.locator(`[data-cod-${name}]`).click();
    };
    const readyAnalysis = async id => {
      await page.waitForFunction(id => GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().datasetId === id
        && document.querySelector("#gaia-statistics-canvas").dataset.analysisDataset === id, id);
    };
    for (const exhibit of [...JAPAN_POLLUTION_EXHIBITS, JAPAN_SENSOR_OPEN_EXHIBITS[0], JAPAN_SENSOR_OPEN_EXHIBITS[6]]) {
      const { data, row } = await pick(exhibit);
      await action("source");
      const panel = page.locator("#japan-data-panel"); await panel.waitFor({ state: "visible" });
      const text = await panel.innerText();
      for (const date of data.sourceRetrievalDates || [data.retrievedOn]) assert(text.includes(date));
      assert(text.includes(`${data.periods[0].year}〜${data.periods.at(-1).year}`));
      await page.locator("#japan-data-close").click();
      await action("analysis");
      const id = `${exhibit.id}-${row.id}`;
      await readyAnalysis(id);
      const chart = page.locator("#gaia-statistics-canvas");
      if (exhibit.sensorRegistrationKey === null) {
        assert.equal(await chart.getAttribute("data-axis-y"), `${exhibit.metricLabel} (${exhibit.unit})`);
        const current = await page.evaluate(() => GaiaMarineCod.getStatisticsDataset());
        assert.deepEqual((await chart.getAttribute("data-domain-y")).split(",").map(Number), concentrationDomain(current.rows.map(r => r.value)));
      } else assert.equal(await chart.getAttribute("data-axis-y"), exhibit.metricLabel);
      if ([44, 54, 64].includes(Number(exhibit.number))) await page.screenshot({ path: path.join(output, `${width}-${exhibit.number}-analysis.png`) });
      if (exhibit.number === "44") {
        await page.locator("#gaia-statistics-menu-toggle").click();
        await page.locator(".gaia-statistics-data-options summary").click();
        await page.locator("#gaia-statistics-view-save").click();
        const savedId = await page.locator("#gaia-statistics-saved-view").inputValue();
        await boot(44, true); // same browser context, explicit full document recreation
        assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation")[0].type), "reload");
        await pick(exhibit); await action("analysis"); await readyAnalysis(id);
        assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), 1);
        await page.locator("#gaia-statistics-menu-toggle").click();
        await page.locator(".gaia-statistics-data-options summary").click();
        await page.locator("#gaia-statistics-record-filter").fill("2023");
        await page.locator("#gaia-statistics-saved-view").selectOption(savedId);
        await page.locator("#gaia-statistics-view-apply").click();
        await page.waitForTimeout(250);
        assert.equal(await page.locator("#gaia-statistics-record-filter").inputValue(), "");
        assert.equal(await chart.getAttribute("data-point-count"), "5");
        await page.locator("#gaia-statistics-menu-close").click();
        report.checks.push({ width, persistence: "SO2 conditions survive reload and restore 5 source years", status: "passed" });
      }
      await page.locator("#gaia-statistics-close").click();
      assert.equal(await page.locator(".experience").evaluate(n => n.scrollLeft), 0);
      report.checks.push({ width, exhibit: exhibit.number, sourceDates: data.sourceRetrievalDates || [data.retrievedOn], status: "passed" });
      console.log(`PASS ${width}/${exhibit.number}: final dates, graph units, concentrations and return`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
