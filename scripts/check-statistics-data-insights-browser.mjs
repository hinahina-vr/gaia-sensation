import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { METHOD_LOOKUP } from "../statistics-methods.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistics-data-insights");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const [width, height] of [[1440, 900], [3840, 2160], [1366, 768], [390, 844], [320, 568]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && message.text().includes("Statistics Lab analysis failed")) report.errors.push(message.text()); });
    await page.goto(`${base}/?preview=data-insights#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaStatisticsLab);
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); });
    const settle = () => page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady).catch(async error => {
      report.diagnostic = await page.evaluate(() => ({ state: GaiaStatisticsLab.getState(), status: document.querySelector("#gaia-statistics-status").textContent, context: document.querySelector("#gaia-statistics-context").textContent }));
      throw error;
    });
    const open = async datasetId => { await page.evaluate(datasetId => GaiaStatisticsLab.open({ datasetId }), datasetId); await settle(); };
    const select = async methodId => {
      await page.evaluate(({ methodId, group }) => {
        const select = document.querySelector("#gaia-statistics-lectures");
        select.value = group; select.dispatchEvent(new Event("change"));
        document.querySelector(`#gaia-statistics-methods [data-method="${methodId}"]`).click();
      }, { methodId, group: METHOD_LOOKUP.get(methodId).group.id });
      await settle();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().methodId), methodId);
    };
    if (width === 1440) {
      for (const methodId of METHOD_LOOKUP.keys()) {
        const datasetId = methodId === "paired" ? "jma-co2" : methodId === "discrete" ? "earthquakes"
          : ["categorical", "fisher"].includes(methodId) ? "forest-urban"
          : ["multiple", "anova", "logistic"].includes(methodId) ? "renewables" : "co2-trend";
        await open(datasetId); await select(methodId);
        const scan = await page.evaluate(async () => {
          const state = GaiaStatisticsLab.getState();
          const result = await GaiaStatisticsLab.run(state.methodId);
          return { methodId: state.methodId, datasetId: state.datasetId, kind: result.kind, insight: result.dataInsight,
            headline: document.querySelector("#gaia-statistics-takeaway-title").textContent,
            findings: document.querySelector("#gaia-statistics-findings").textContent,
            technicalCards: document.querySelectorAll("#gaia-statistics-insights .gaia-statistics-insight").length };
        });
        assert.notEqual(scan.kind, "not-applicable", methodId);
        assert.equal(scan.headline, scan.insight.headline, methodId);
        assert(scan.findings.includes(scan.headline));
        assert.equal(scan.technicalCards, 4);
        assert.doesNotMatch(JSON.stringify(scan.insight), /NaN|undefined|Infinity/);
        assert.doesNotMatch(scan.headline, /r=|R²|R-hat|回帰係数|p値/);
        if (methodId === "paired") {
          assert.equal(scan.insight.primaryId, "shared-rise");
          assert.doesNotMatch(scan.headline, /綾里の綾里/);
          assert.match(scan.insight.scope, /対象 27行/);
        }
        report.checks.push(scan); console.log(`PASS ${methodId}: ${scan.headline}`);
      }
      // Every dataset/method combination must retain honest guard text.
      const grid = await page.evaluate(async () => {
        const { DATA_INSIGHT_METHODS } = await import("/statistics-data-insights.js");
        const checks = [];
        for (const id of ["co2-trend", "jma-co2", "wind-climate", "rainfall", "waste", "forest-urban", "earthquakes", "culture", "pollination", "renewables", "population", "emissions-urban"]) {
          for (const method of DATA_INSIGHT_METHODS.filter(id => id !== "mcmc")) {
            const result = await GaiaStatisticsLab.run(method, id);
            checks.push({ id, method, kind: result.kind, insight: result.dataInsight });
          }
        }
        return checks;
      });
      for (const check of grid) assert.doesNotMatch(JSON.stringify(check.insight), /NaN|undefined|Infinity/, `${check.id}/${check.method}`);
      report.grid = grid;
      // Search and provenance controls recalculate the same data-level copy.
      await open("co2-trend"); await select("summary");
      await page.evaluate(() => {
        const input = document.querySelector("#gaia-statistics-record-filter"); input.value = "2020"; input.dispatchEvent(new Event("search"));
      });
      await settle();
      let filtered = await page.locator('#gaia-statistics-findings [data-kind="observation"]').textContent();
      assert.match(filtered, /2020-/); assert.doesNotMatch(filtered, /2016-/);
      await page.evaluate(() => {
        const input = document.querySelector("#gaia-statistics-record-filter"); input.value = "no-such-record"; input.dispatchEvent(new Event("search"));
      });
      await settle(); assert.match(await page.locator("#gaia-statistics-takeaway-title").textContent(), /答えは出せません/);
      await open("earthquakes");
      await page.evaluate(() => { const input = document.querySelector("#gaia-statistics-derived"); input.checked = true; input.dispatchEvent(new Event("change")); });
      await select("continuous"); assert.match(await page.locator("#gaia-statistics-findings").textContent(), /中央値.*日/);
      await open("waste"); await select("summary");
      const sourceHeadline = await page.locator("#gaia-statistics-takeaway-title").textContent();
      await page.evaluate(() => { const input = document.querySelector("#gaia-statistics-derived"); input.checked = true; input.dispatchEvent(new Event("change")); });
      // The current waste snapshot contains only SOURCE rows. Toggling the
      // option must not invent exclusions; the comparison fixture tests IMPUTED rows.
      await settle();
      assert.equal(await page.locator("#gaia-statistics-takeaway-title").textContent(), sourceHeadline);
      report.checks.push({ sourceHeadline, withImputed: await page.locator("#gaia-statistics-takeaway-title").textContent() });
      await page.evaluate(() => GaiaStatisticsLab.open({ dataset: {
        id: "external-null-test", title: "欠測を含む外部時系列", unit: "℃", xLabel: "年", yLabel: "平均気温", defaultMethod: "summary",
        rows: [-2, 0, null, "", false, 3].map((value, i) => ({ id: String(i), label: `${2020 + i}`, x: 2020 + i, y: value, value })),
      } }));
      await settle();
      assert.match(await page.locator("#gaia-statistics-findings").textContent(), /対象 3行/);
      assert.match(await page.locator("#gaia-statistics-takeaway-title").textContent(), /比較に必要な記録が足りません/);
    }
    await open("co2-trend"); await select("regression");
    await page.locator('[data-stat-view="chart"]').click();
    await page.evaluate(() => document.querySelector(".gaia-statistics-shell").scrollTop = 0);
    const geometry = await page.evaluate(() => {
      const shell = document.querySelector(".gaia-statistics-shell"), rect = node => node.getBoundingClientRect().toJSON();
      return { width: innerWidth, overflow: shell.scrollWidth - shell.clientWidth,
        tabs: [...document.querySelectorAll("[data-stat-view]")].map(rect), shell: rect(shell),
        headline: rect(document.querySelector("#gaia-statistics-takeaway-title")),
        evidence: rect(document.querySelector("#gaia-statistics-takeaway-evidence")) };
    });
    assert(geometry.overflow <= 1, `${width}: horizontal overflow`);
    assert(geometry.headline.bottom < geometry.evidence.top, "Insight headline must precede the numerical evidence");
    for (const tab of geometry.tabs) { assert(tab.left >= geometry.shell.left); assert(tab.right <= geometry.shell.right); assert(tab.height >= 44); }
    await page.screenshot({ path: path.join(output, `chart-${width}.png`) });
    for (const view of ["findings", "values", "records", "insights"]) {
      await page.locator(`[data-stat-view="${view}"]`).click();
      assert.equal(await page.locator(`[data-stat-view="${view}"]`).getAttribute("aria-selected"), "true");
      assert.equal(await page.locator(`#stat-panel-${view}`).evaluate(el => el.open), true);
      if (view === "findings") {
        assert.match(await page.locator("#gaia-statistics-findings").textContent(), /ここから分かること/);
        assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), false, "No duplicate summary in the reading view at any width");
        await page.screenshot({ path: path.join(output, `findings-${width}.png`) });
        await page.locator("#gaia-statistics-findings > button").click();
        assert.equal(await page.locator("#stat-view-values").getAttribute("aria-selected"), "true");
      }
    }
    await page.locator('[data-stat-view="chart"]').click();
    await page.locator('[data-stat-view="chart"]').focus(); await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#stat-view-findings").getAttribute("aria-selected"), "true");
    await page.locator("#stat-panel-findings .gaia-statistics-panel-back").click();
    await page.waitForFunction(() => document.activeElement.id === "gaia-statistics-canvas");
    if (width === 320 || width === 1440) {
      await open("renewables"); await select("logistic");
      await page.locator("#stat-view-findings").click();
      const wrapping = await page.locator("#gaia-statistics-findings").evaluate(el => ({ overflow: el.scrollWidth - el.clientWidth, height: el.querySelector("h4").getBoundingClientRect().height }));
      assert(wrapping.overflow <= 1); assert(wrapping.height > 0);
      await page.screenshot({ path: path.join(output, `long-insight-${width}.png`) });
    }
    report.checks.push(geometry); await context.close(); console.log(`PASS layout/tabs ${width}x${height}`);
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
