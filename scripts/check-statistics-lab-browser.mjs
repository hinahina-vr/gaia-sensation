import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { METHOD_GROUPS } from "../statistics-methods.js";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";
const actualWaste = JSON.parse(fs.readFileSync(new URL("../data/gaia-signals.json", import.meta.url), "utf8")).modes.find(mode => mode.id === "nothing-is-waste").signals.countryWaste;
const wasteTotal = actualWaste.length;
const wasteSource = actualWaste.filter(row => row.valueStatus === "SOURCE").length;

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs")) ? path.join(moduleRoot, "index.mjs") : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/statistics-lab");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath, args: ["--enable-webgl", "--ignore-gpu-blocklist", "--disable-background-timer-throttling"] });
const report = { externalProviders: "Mocked empty JSON; saved local snapshot is the numeric source under test, not live provider availability", requestFailures: [], consoleErrors: [], pageErrors: [], responses404: [], scans: [] };

const boot = async (viewport) => {
  const context = await browser.newContext({ viewport, colorScheme: "dark", reducedMotion: viewport.mobile ? "reduce" : "no-preference" });
  await enforceBrowserSecurity(context, baseUrl);
  await context.route("https://**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "[]" }));
  await context.addInitScript(() => {
    window.localStorage.removeItem("gaia-statistics-saved-views:v1");
    window.sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
  });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()} ${message.location().url || ""}`); });
  page.on("requestfailed", request => report.requestFailures.push({ viewport: viewport.name, url: request.url(), failure: request.failure()?.errorText }));
  page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
  await page.goto(new URL("/?preview=gaia-statistics-lab-1#world", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.GaiaModeLoader?.load === "function");
  await page.evaluate(() => window.GaiaModeLoader.load("exploration"));
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
  assert.equal(await page.evaluate(() => typeof window.GaiaStatisticsLab), "undefined", "Statistics is not eager-loaded before its first click");
  await page.evaluate(() => window.GaiaMapObservationAdapter.openMap());
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
  await page.evaluate(() => { GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
  await page.evaluate(() => GaiaEstatExhibits.select(0));
  await page.waitForFunction(() => {
    const current = JSON.stringify({ ...document.querySelector("#japan-overlay").dataset });
    window.__qaCameraStable = window.__qaCameraPrevious === current ? (window.__qaCameraStable || 0) + 1 : 0;
    window.__qaCameraPrevious = current;
    return window.__qaCameraStable >= 10;
  }, null, { polling: 100 }); // Snapshot the settled exhibit camera, not an intermediate animation frame.
  return { context, page };
};

try {
  for (const viewport of [
    { name: "pc", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844, mobile: true },
    { name: "mobile-320", width: 320, height: 568, mobile: true },
  ].filter(viewport => !process.argv[6] || process.argv[6].split(",").map(Number).includes(viewport.width))) {
    const { context, page } = await boot(viewport);
    if (viewport.mobile) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.waitForTimeout(650); }
    const mapStateBefore = await page.evaluate(() => ({
      adapter: (({ modeIndex, mapOpen }) => ({ modeIndex, mapOpen }))(window.GaiaMapObservationAdapter.getState()),
      zoom: document.querySelector("#japan-overlay")?.dataset.earthZoom,
      offsetX: document.querySelector("#japan-overlay")?.dataset.earthOffsetX,
      offsetY: document.querySelector("#japan-overlay")?.dataset.earthOffsetY,
    }));
    const trigger = viewport.mobile ? page.locator("#map-mobile-sheet").getByRole("button", { name: "統計分析", exact: true }) : page.locator(".gaia-map-action--analysis:visible, .map-dock-action--statistics:visible, #gaia-statistics-button:visible").first();
    assert.equal(await trigger.isVisible(), true, `${viewport.name}: statistics entry button is not visible on the map`);
    await trigger.click();
    await page.waitForFunction(() => window.GaiaStatisticsLab?.getState().analysisReady === true);
    const downloadSurface = await page.evaluate(() => ({
      controls: document.querySelectorAll("#gaia-statistics-export-csv, #gaia-statistics-export-json, #gaia-statistics-export-png").length,
      downloadAttributes: document.querySelectorAll("#gaia-statistics-lab [download]").length,
      publicMethods: ["createExportReport", "exportCsv", "exportJson", "exportPng"].filter((name) => typeof window.GaiaStatisticsLab?.[name] === "function"),
      notice: document.querySelector(".gaia-statistics-bi-context > small")?.textContent?.trim() || "",
    }));
    assert.deepEqual(downloadSurface.publicMethods, [], `${viewport.name}: removed download methods are still public`);
    assert.equal(downloadSurface.controls, 0, `${viewport.name}: external-data download controls still exist`);
    assert.equal(downloadSurface.downloadAttributes, 0, `${viewport.name}: a download attribute still exists in the statistics lab`);
    assert.equal(downloadSurface.notice, "分析結果は画面内表示のみです", `${viewport.name}: screen-only notice is missing`);
    await page.locator("#gaia-statistics-menu-toggle").click();
    assert.equal(await page.locator("#gaia-statistics-controls").getAttribute("aria-hidden"), "false", `${viewport.name}: analysis menu did not open`);
    await page.locator("#gaia-statistics-menu-close").click();
    assert.equal(await page.locator("#gaia-statistics-controls").getAttribute("aria-hidden"), "true", `${viewport.name}: analysis menu did not close`);
    const setControlValue = async (selector, value, eventType = "change") => { await page.locator(selector).evaluate((element, detail) => {
      element.value = detail.value;
      element.dispatchEvent(new Event(detail.eventType, { bubbles: true }));
    }, { value, eventType });
      if (selector === "#gaia-statistics-lectures" && value === "descriptive") await page.locator('[data-method="summary"]').evaluate(button => button.click());
    };
    const setDatasetForTest = (datasetId) => page.evaluate((id) => window.GaiaStatisticsLab.open({ datasetId: id }), datasetId);
    const fixedFrame = await page.evaluate(() => {
      const geometry = (selector) => {
        const element = document.querySelector(selector);
        return {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
          overflowY: getComputedStyle(element).overflowY,
        };
      };
      return {
        document: { clientHeight: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight, scrollY },
        lab: geometry("#gaia-statistics-lab"),
        shell: geometry(".gaia-statistics-shell"),
        body: geometry(".gaia-statistics-body"),
        stage: geometry(".gaia-statistics-stage"),
        layout: (() => {
          const controlsElement = document.querySelector(".gaia-statistics-controls");
          const controls = controlsElement.getBoundingClientRect();
          const stage = document.querySelector(".gaia-statistics-stage").getBoundingClientRect();
          return { controls: controls.toJSON(), controlsPosition: getComputedStyle(controlsElement).position, stage: stage.toJSON() };
        })(),
      };
    });
    assert.ok(fixedFrame.document.scrollHeight <= fixedFrame.document.clientHeight + 1 && fixedFrame.document.scrollY === 0, `${viewport.name}: background page still scrolls vertically`);
    assert.ok(fixedFrame.lab.scrollHeight <= fixedFrame.lab.clientHeight + 1, `${viewport.name}: modal backdrop still scrolls vertically`);
    if (viewport.name === "pc") {
      assert.ok(fixedFrame.shell.scrollHeight <= fixedFrame.shell.clientHeight + 1 && fixedFrame.shell.scrollTop === 0, "pc: shell still scrolls vertically");
      assert.equal(fixedFrame.body.overflowY, "hidden", "pc: chart-first workspace does not contain overflow");
      assert.equal(fixedFrame.layout.controlsPosition, "fixed", "pc: analysis conditions are not mounted in the settings drawer");
    } else {
      assert.match(fixedFrame.shell.overflowY, /^(?:auto|scroll)$/u, "mobile: the statistics workspace is not independently scrollable");
      assert.equal(fixedFrame.layout.controlsPosition, "fixed", "mobile: analysis conditions are not mounted in the settings drawer");
    }
    await setDatasetForTest("co2-trend");
    await setControlValue("#gaia-statistics-lectures", "descriptive");
    await page.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent !== "計算中"
      && document.querySelector("#gaia-statistics-canvas")?.dataset.axisX === "CO₂ (ppm)");
    const co2Chart = await page.locator("#gaia-statistics-canvas").evaluate((element) => ({
      axisX: element.dataset.axisX,
      axisY: element.dataset.axisY,
      domainX: element.dataset.domainX?.split(",").map(Number),
      pointCount: Number(element.dataset.pointCount),
      selectedDataset: document.querySelector("#gaia-statistics-context")?.textContent || "",
    }));
    assert.equal(co2Chart.axisX, "CO₂ (ppm)", `${viewport.name}: histogram x-axis label is wrong`);
    assert.equal(co2Chart.axisY, "観測数", `${viewport.name}: histogram y-axis label is wrong`);
    assert.equal(co2Chart.pointCount, 120, `${viewport.name}: finite monthly observations were not preserved`);
    assert.ok(co2Chart.domainX[0] > 300, `${viewport.name}: chart domain still includes empty zero-to-data space`);
    assert.match(co2Chart.selectedDataset, /2016-08〜2026-07 \/ 欠測0か月/u, `${viewport.name}: actual observation period is not labeled`);
    const co2BusinessSummary = await page.locator("#gaia-statistics-kpis").evaluate((element) => ({
      usedRows: Number(element.dataset.usedRows),
      totalRows: Number(element.dataset.totalRows),
      sourceRows: Number(element.dataset.sourceRows),
      coverage: Number(element.dataset.coverage),
      quality: element.dataset.quality,
      primary: document.querySelector("#gaia-statistics-kpi-primary")?.textContent || "",
      filter: document.querySelector("#gaia-statistics-filter-summary")?.textContent || "",
    }));
    assert.deepEqual(
      { usedRows: co2BusinessSummary.usedRows, totalRows: co2BusinessSummary.totalRows, sourceRows: co2BusinessSummary.sourceRows, quality: co2BusinessSummary.quality },
      { usedRows: 120, totalRows: 120, sourceRows: 120, quality: "source-only" },
      `${viewport.name}: CO2 KPI row lineage is wrong`,
    );
    assert.equal(co2BusinessSummary.coverage, 1, `${viewport.name}: CO2 coverage KPI is wrong`);
    assert.ok(co2BusinessSummary.primary && co2BusinessSummary.primary !== "—", `${viewport.name}: primary KPI is empty`);
    assert.match(co2BusinessSummary.filter, /観測値のみ.*2016-08–2026-07.*この端末で計算/u, `${viewport.name}: filter lineage is not visible`);
    const takeaway = await page.locator("#gaia-statistics-takeaway").evaluate((element) => ({
      visible: Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
      state: element.dataset.state,
      headline: document.querySelector("#gaia-statistics-takeaway-title")?.textContent?.trim() || "",
      body: document.querySelector("#gaia-statistics-takeaway-body")?.textContent?.trim() || "",
      caveat: document.querySelector("#gaia-statistics-takeaway-caveat")?.textContent?.trim() || "",
      evidenceCount: document.querySelectorAll("#gaia-statistics-takeaway-evidence button").length,
    }));
    assert.equal(takeaway.visible, true, `${viewport.name}: concise insight is hidden from the main result screen`);
    assert.equal(takeaway.state, "ready", `${viewport.name}: concise insight is not ready`);
    assert.ok(takeaway.headline.length > 8 && takeaway.body.length > 16, `${viewport.name}: concise insight is empty`);
    assert.match(takeaway.caveat, /^注意：/u, `${viewport.name}: insight limitation is not visible`);
    assert.ok(takeaway.evidenceCount >= 1 && takeaway.evidenceCount <= 3, `${viewport.name}: concise evidence is not usable`);
    await page.locator("#gaia-statistics-takeaway-evidence button").first().click();
    assert.equal(await page.locator("#stat-panel-findings").isVisible(), true, `${viewport.name}: insight evidence does not open its reading and evidence`);
    await page.locator("#stat-view-chart").click();
    await page.locator(".gaia-statistics-shell").evaluate((element) => { element.scrollTop = 0; });
    assert.equal(await page.locator("#gaia-statistics-records-body tr").count(), 120, `${viewport.name}: accessible CO2 record table is incomplete`);
    assert.equal(await page.locator("#gaia-statistics-record-x-heading").textContent(), "観測月", `${viewport.name}: record table X heading is wrong`);
    assert.equal(await page.locator("#gaia-statistics-record-y-heading").textContent(), "CO₂", `${viewport.name}: record table Y heading is wrong`);
    await page.locator('#gaia-statistics-methods [data-method="summary"]').evaluate((element) => element.click());
    await page.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent !== "計算中");
    await page.waitForTimeout(620);
    const keyboardChart = await page.locator("#gaia-statistics-canvas").evaluate((element) => {
      element.focus();
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const state = {
        index: Number(element.dataset.keyboardIndex),
        describedBy: element.getAttribute("aria-describedby") || "",
        label: element.getAttribute("aria-label") || "",
        tooltipVisible: !document.querySelector(".gaia-statistics-chart-tooltip")?.hidden,
      };
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return state;
    });
    assert.equal(keyboardChart.index, 1, `${viewport.name}: keyboard chart navigation did not advance`);
    assert.match(keyboardChart.describedBy, /gaia-statistics-chart-help.*gaia-statistics-chart-tooltip/u, `${viewport.name}: keyboard tooltip is not described accessibly`);
    assert.match(keyboardChart.label, /120点.*矢印キー/u, `${viewport.name}: canvas does not disclose keyboard navigation`);
    assert.equal(keyboardChart.tooltipVisible, true, `${viewport.name}: keyboard chart tooltip is hidden`);
    await page.waitForFunction(() => document.querySelector(".gaia-statistics-records")?.open
      && document.querySelectorAll("#gaia-statistics-records-body tr[data-selected='true']").length === 1);
    const drilledRecord = await page.locator("#gaia-statistics-records-body tr[data-selected='true']").evaluate((element) => ({
      id: element.dataset.recordId,
      focused: element === document.activeElement,
      label: element.querySelector("th strong")?.textContent || "",
      announcement: document.querySelector("#gaia-statistics-record-drill-status")?.textContent || "",
    }));
    assert.ok(drilledRecord.id && drilledRecord.label, `${viewport.name}: chart drill-through has no record identity`);
    assert.equal(drilledRecord.focused, true, `${viewport.name}: chart drill-through did not move focus to the record`);
    assert.match(drilledRecord.announcement, new RegExp(drilledRecord.label, "u"), `${viewport.name}: chart drill-through is not announced`);
    assert.equal((await page.evaluate(() => window.GaiaStatisticsLab.getState())).selectedRecordId, drilledRecord.id, `${viewport.name}: drilled record state is not traceable`);
    await page.locator(".gaia-statistics-records").evaluate((element) => { element.open = false; });
    await page.locator("#gaia-statistics-visual").screenshot({
      path: path.join(outputDir, `${viewport.name}-co2-chart.png`),
    });
    await setDatasetForTest("rainfall");
    await page.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent !== "計算中");
    assert.equal(await page.locator("#gaia-statistics-lab").getAttribute("aria-hidden"), "false");
    assert.deepEqual(await page.locator("#gaia-statistics-lectures option").allTextContents(), METHOD_GROUPS.map(group => group.name));
    assert.equal(await page.locator(".gaia-statistics-insight").count(), 4);
    assert.match(await page.locator(".gaia-statistics-insight").nth(0).textContent(), /この分析の根拠/u);
    assert.match(await page.locator(".gaia-statistics-insight").nth(1).textContent(), /分析結果の補足/u);
    assert.match(await page.locator(".gaia-statistics-insight").nth(2).textContent(), /ここからは言えないこと/u);
    assert.match(await page.locator(".gaia-statistics-insight").nth(3).textContent(), /次に確かめる/u);
    await page.locator(".gaia-statistics-insights-panel").evaluate((element) => { element.open = true; });
    const chartReturnButton = page.locator(".gaia-statistics-insights-panel > .gaia-statistics-panel-back");
    assert.equal(await chartReturnButton.isVisible(), true, `${viewport.name}: expanded explanation has no visible chart return`);
    await chartReturnButton.click();
    assert.equal(await page.locator(".gaia-statistics-insights-panel").evaluate((element) => element.open), false, `${viewport.name}: chart return did not close the explanation`);
    await page.waitForFunction(() => document.activeElement === document.querySelector("#gaia-statistics-canvas"), null, { timeout: 5000 }).catch(async error => {
      console.error(viewport.name, await page.evaluate(() => ({ active: document.activeElement.outerHTML.slice(0, 300), panels: [...document.querySelectorAll('.gaia-statistics-stage > details')].map(el => [el.className, el.open]), visual: document.querySelector('#gaia-statistics-visual').outerHTML.slice(0, 300) })));
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-focus-failure.png`) });
      throw error;
    });
    const canvas = await page.locator("#gaia-statistics-canvas").evaluate((element) => ({ width: element.width, height: element.height, rect: element.getBoundingClientRect().toJSON() }));
    assert.ok(
      canvas.width > Math.min(300, viewport.width * 0.75) && canvas.height > (viewport.name === "pc" ? 140 : 90),
      `${viewport.name}: canvas is not rendered: ${JSON.stringify(canvas)}`,
    );
    const labVisual = await page.locator("#gaia-statistics-lab").evaluate((element) => {
      const style = getComputedStyle(element);
      const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      const shell = element.querySelector(".gaia-statistics-shell").getBoundingClientRect();
      return { position: style.position, inset: [style.top, style.right, style.bottom, style.left], background: style.backgroundImage, topInside: element.contains(top), shell: shell.toJSON() };
    });
    assert.equal(labVisual.position, "fixed");
    assert.ok(labVisual.topInside, `${viewport.name}: old WebGL can appear above the lab`);
    assert.match(labVisual.background, /(?:linear|radial)-gradient/u);
    assert.ok(labVisual.shell.width < viewport.width && labVisual.shell.height < viewport.height, `${viewport.name}: statistics view is not a map overlay popup`);
    const specialized = await page.evaluate(async () => {
      const anova = await window.GaiaStatisticsLab.run("anova", "renewables");
      const multiple = await window.GaiaStatisticsLab.run("multiple", "renewables");
      const prediction = await window.GaiaStatisticsLab.run("prediction", "renewables");
      const pollination = await window.GaiaStatisticsLab.run("categorical", "pollination");
      return { anova, multiple, prediction, pollination };
    });
    assert.ok(specialized.anova.metrics.some(([label]) => label === "交互作用p"), `${viewport.name}: two-way interaction missing`);
    assert.ok(specialized.multiple.metrics.some(([label]) => label === "調整済みR²"), `${viewport.name}: multiple regression missing`);
    assert.ok(specialized.multiple.metrics.some(([label]) => label === "太陽光 VIF"), `${viewport.name}: multicollinearity metric missing`);
    assert.ok(specialized.prediction.metrics.some(([label]) => label === "95%予測上限"), `${viewport.name}: prediction interval missing`);
    assert.equal(specialized.pollination.kind, "not-applicable");
    assert.match(specialized.pollination.insight.interpretation, /23相互作用.*62標本/u);

    for (const lecture of METHOD_GROUPS) {
      await setControlValue("#gaia-statistics-lectures", lecture.id);
      await page.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent !== "計算中");
      assert.equal(await page.locator(".gaia-statistics-insight").count(), 4, `${viewport.name}: category ${lecture.id} insight cards`);
      const cards = await page.locator(".gaia-statistics-insight").allTextContents();
      cards.forEach((text, index) => assert.ok(text.trim().length > 18, `${viewport.name}: category ${lecture.id}, card ${index + 1} empty`));
      const methodButtons = page.locator("#gaia-statistics-methods button");
      for (let method = 1; method < await methodButtons.count(); method += 1) {
        await methodButtons.nth(method).evaluate((element) => element.click());
        await page.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent !== "計算中");
        assert.equal(await page.locator(".gaia-statistics-insight").count(), 4);
      }
    }

    await setDatasetForTest("waste");
    await setControlValue("#gaia-statistics-lectures", "descriptive");
    await page.waitForFunction(() => document.querySelectorAll("#gaia-statistics-metrics tr").length >= 6
      && document.querySelector("#gaia-statistics-status")?.textContent !== "計算中");
    const readMean = () => page.evaluate(() => [...document.querySelectorAll("#gaia-statistics-metrics tr")]
      .find((row) => row.cells[0]?.textContent === "平均")?.textContent || "");
    const sourceMean = await readMean();
    const sourceWasteKpis = await page.locator("#gaia-statistics-kpis").evaluate((element) => ({
      usedRows: Number(element.dataset.usedRows), totalRows: Number(element.dataset.totalRows), sourceRows: Number(element.dataset.sourceRows), quality: element.dataset.quality,
    }));
    assert.deepEqual(sourceWasteKpis, { usedRows: wasteSource, totalRows: wasteTotal, sourceRows: wasteSource, quality: "source-only" }, `${viewport.name}: source-only waste KPIs are wrong`);
    await page.locator("#gaia-statistics-derived").evaluate((element) => {
      element.checked = true;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent !== "計算中");
    await page.waitForTimeout(80);
    const combinedMean = await readMean();
    const combinedWasteKpis = await page.locator("#gaia-statistics-kpis").evaluate((element) => ({
      usedRows: Number(element.dataset.usedRows), totalRows: Number(element.dataset.totalRows), sourceRows: Number(element.dataset.sourceRows), quality: element.dataset.quality,
    }));
    assert.deepEqual(combinedWasteKpis, { usedRows: wasteTotal, totalRows: wasteTotal, sourceRows: wasteSource, quality: wasteSource === wasteTotal ? "source-only" : "mixed" }, `${viewport.name}: provenance KPIs do not match the current snapshot`);
    assert.equal(await page.locator("#gaia-statistics-records-body tr").count(), wasteTotal, `${viewport.name}: mixed-provenance record table is incomplete`);
    assert.equal(await page.locator('#gaia-statistics-records-body [data-provenance="IMPUTED"]').count(), wasteTotal - wasteSource, `${viewport.name}: imputed rows are not disclosed in the record table`);
    assert.ok(sourceMean && combinedMean, `${viewport.name}: mean metric missing (${sourceMean} / ${combinedMean})`);
    if (wasteSource === wasteTotal) assert.equal(sourceMean, combinedMean, "All-source data must not change when allowing imputed rows");
    else assert.notEqual(sourceMean, combinedMean, `${viewport.name}: provenance toggle did not update metrics`);
    assert.ok(await page.locator(".gaia-statistics-evidence-button").count() >= 3, `${viewport.name}: clickable evidence values missing`);

    await page.locator(".gaia-statistics-records").evaluate((element) => { element.open = true; });
    const labelSort = page.locator('[data-record-sort-action="label"]');
    await labelSort.click();
    assert.equal(await page.locator('th[data-record-sort="label"]').getAttribute("aria-sort"), "ascending", `${viewport.name}: record label sort is not exposed`);
    const ascendingLabels = await page.locator("#gaia-statistics-records-body th strong").allTextContents();
    assert.equal(ascendingLabels.every((label, index) => index === 0 || ascendingLabels[index - 1].localeCompare(label, "ja-JP", { numeric: true, sensitivity: "base" }) <= 0), true, `${viewport.name}: records are not sorted ascending`);
    await labelSort.click();
    assert.equal(await page.locator('th[data-record-sort="label"]').getAttribute("aria-sort"), "descending", `${viewport.name}: descending record label sort is not exposed`);
    const descendingLabels = await page.locator("#gaia-statistics-records-body th strong").allTextContents();
    assert.equal(descendingLabels.every((label, index) => index === 0 || descendingLabels[index - 1].localeCompare(label, "ja-JP", { numeric: true, sensitivity: "base" }) >= 0), true, `${viewport.name}: records are not sorted descending`);

    await setControlValue("#gaia-statistics-record-filter", "Canada", "input");
    await page.waitForFunction(() => Number(document.querySelector("#gaia-statistics-kpis")?.dataset.usedRows) === 1
      && window.GaiaStatisticsLab?.getState().recordQuery === "Canada");
    assert.equal(await page.locator("#gaia-statistics-records-body tr").count(), 1, `${viewport.name}: record query did not filter the audit table`);
    const segmentComparison = await page.locator("#gaia-statistics-segment-compare").evaluate((element) => ({
      status: element.dataset.status,
      delta: Number(element.dataset.delta),
      segmentMean: Number(element.dataset.segmentMean),
      baselineMean: Number(element.dataset.baselineMean),
      text: element.textContent || "",
    }));
    assert.match(segmentComparison.status, /^(?:above|below|same)$/u, `${viewport.name}: numeric segment comparison has no status`);
    assert.ok(Number.isFinite(segmentComparison.delta), `${viewport.name}: segment delta is not finite`);
    assert.ok(Number.isFinite(segmentComparison.segmentMean) && Number.isFinite(segmentComparison.baselineMean), `${viewport.name}: segment means are not traceable`);
    assert.ok(Math.abs(segmentComparison.delta - (segmentComparison.segmentMean - segmentComparison.baselineMean)) < 1e-10, `${viewport.name}: segment delta is inconsistent`);
    assert.match(segmentComparison.text, new RegExp(`表示中平均.*全${wasteTotal}行`, "u"), `${viewport.name}: segment comparison does not disclose its baseline`);
    assert.equal((await page.evaluate(() => window.GaiaStatisticsLab.getState())).recordQuery, "Canada", `${viewport.name}: filtered analysis state omitted the record query`);

    assert.equal(await page.locator(".gaia-statistics-saved-panel").isVisible(), false, `${viewport.name}: saved-view controls should not clutter the primary workspace`);
    await page.locator("#gaia-statistics-view-save").evaluate((element) => element.click());
    assert.equal(await page.locator("#gaia-statistics-saved-view option").count(), 2, `${viewport.name}: saved view was not added`);
    const savedViewId = await page.locator("#gaia-statistics-saved-view").inputValue();
    assert.ok(savedViewId, `${viewport.name}: saved view is not selected after save`);
    const savedStorage = await page.evaluate(() => JSON.parse(localStorage.getItem("gaia-statistics-saved-views:v1") || "[]"));
    assert.equal(savedStorage.length, 1, `${viewport.name}: local saved-view storage is wrong`);
    assert.equal(savedStorage[0].recordQuery, "Canada", `${viewport.name}: saved view omitted the record query`);
    assert.equal(savedStorage[0].recordSortKey, "label", `${viewport.name}: saved view omitted the record sort key`);
    assert.equal(savedStorage[0].recordSortDirection, "descending", `${viewport.name}: saved view omitted the record sort direction`);

    await setDatasetForTest("co2-trend");
    await page.waitForFunction(() => window.GaiaStatisticsLab?.getState().datasetId === "co2-trend"
      && document.querySelector("#gaia-statistics-status")?.textContent !== "計算中");
    await page.locator("#gaia-statistics-saved-view").evaluate((element, value) => {
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, savedViewId);
    await page.locator("#gaia-statistics-view-apply").evaluate((element) => element.click());
    await page.waitForFunction(hasDerived => {
      const state = window.GaiaStatisticsLab?.getState();
      return state?.datasetId === "waste" && state.includeDerived === hasDerived && state.recordQuery === "Canada"
        && Number(document.querySelector("#gaia-statistics-kpis")?.dataset.usedRows) === 1;
    }, wasteSource < wasteTotal);
    const restoredViewState = await page.evaluate(() => window.GaiaStatisticsLab.getState());
    assert.equal(restoredViewState.lectureId, "descriptive", `${viewport.name}: saved category was not restored`);
    assert.equal(restoredViewState.methodId, "summary", `${viewport.name}: saved method was not restored`);
    assert.equal(restoredViewState.recordSortKey, "label", `${viewport.name}: saved sort key was not restored`);
    assert.equal(restoredViewState.recordSortDirection, "descending", `${viewport.name}: saved sort direction was not restored`);
    assert.equal(await page.locator('th[data-record-sort="label"]').getAttribute("aria-sort"), "descending", `${viewport.name}: restored sort is not reflected in the table header`);
    assert.equal(await page.locator("#gaia-statistics-record-filter").inputValue(), "Canada", `${viewport.name}: saved record query is not visible after restore`);

    await page.locator("#gaia-statistics-view-delete").evaluate((element) => element.click());
    assert.equal(await page.locator("#gaia-statistics-saved-view option").count(), 1, `${viewport.name}: deleted view remains in the selector`);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("gaia-statistics-saved-views:v1") || "[]").length), 0, `${viewport.name}: deleted view remains in local storage`);
    await page.locator("#gaia-statistics-filter-clear").evaluate((element) => element.click());
    await page.waitForFunction(total => Number(document.querySelector("#gaia-statistics-kpis")?.dataset.usedRows) === total
      && window.GaiaStatisticsLab?.getState().recordQuery === "", wasteTotal);
    assert.equal(await page.locator("#gaia-statistics-records-body tr").count(), wasteTotal, `${viewport.name}: clearing the record query did not restore all rows`);

    if (viewport.name === "pc") {
      await page.locator(".gaia-statistics-records").evaluate((element) => { element.open = true; });
      const recordGeometry = await page.locator(".gaia-statistics-records-scroll").evaluate((element) => ({
        scrollable: element.scrollHeight > element.clientHeight,
        width: element.getBoundingClientRect().width,
        headerPosition: getComputedStyle(element.querySelector("thead")).position,
      }));
      assert.equal(recordGeometry.scrollable, true, "pc: record audit table is not independently scrollable");
      assert.ok(recordGeometry.width > 600, "pc: record audit table is too narrow");
      assert.equal(recordGeometry.headerPosition, "sticky", "pc: record audit table header is not sticky");
      await page.locator(".gaia-statistics-records").screenshot({ path: path.join(outputDir, "pc-record-audit-table.png") });
      await page.locator(".gaia-statistics-records").evaluate((element) => { element.open = false; });
    }
    await page.locator(".gaia-statistics-stage details").evaluateAll((elements) => elements.forEach((element) => { element.open = false; }));
    await page.locator(".gaia-statistics-shell").evaluate((element) => { element.scrollTop = 0; });
    await page.waitForTimeout(viewport.name === "pc" ? 650 : 40);

    const screenshot = path.join(outputDir, `${viewport.name}-statistics-lab.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.scans.push({ viewport, screenshot, canvas, sourceMean, combinedMean });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#gaia-statistics-lab").getAttribute("aria-hidden"), "true");
    const mapStateAfter = await page.evaluate(() => ({
      adapter: (({ modeIndex, mapOpen }) => ({ modeIndex, mapOpen }))(window.GaiaMapObservationAdapter.getState()),
      zoom: document.querySelector("#japan-overlay")?.dataset.earthZoom,
      offsetX: document.querySelector("#japan-overlay")?.dataset.earthOffsetX,
      offsetY: document.querySelector("#japan-overlay")?.dataset.earthOffsetY,
    }));
    assert.deepEqual(mapStateAfter, mapStateBefore, `${viewport.name}: map state changed while the statistics popup was open`);
    if (viewport.mobile) await page.locator('[data-mobile-sheet="tools"]').click();
    await trigger.click();
    await page.waitForFunction(() => window.GaiaStatisticsLab?.getState().open === true);
    await page.keyboard.press("Escape");
    const returnTarget = viewport.mobile ? page.locator('[data-mobile-sheet="tools"]') : trigger;
    assert.equal(await returnTarget.evaluate((element) => element === document.activeElement), true, `${viewport.name}: keyboard focus did not return to the accessible trigger`);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), [], `${viewport.name}: CSP blocked a legitimate flow`);
    await context.close();
  }
  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join("\n")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join("\n")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(`GAIA Statistics Lab browser checks passed: ${report.scans.length} viewports.`);
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
