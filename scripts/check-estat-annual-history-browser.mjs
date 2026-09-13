import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/annual-history/browser");
const data = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8"));
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=annual-history#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaEstatExhibits && globalThis.GaiaStatisticsLab);
    await page.evaluate(() => { GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
    const openAnalysis = async () => {
      if (width < 901) {
        await page.locator("#map-mobile-toolbar").getByRole("button", { name: "操作", exact: true }).click();
        await page.locator("#map-mobile-sheet").getByRole("button", { name: "統計分析", exact: true }).click();
      } else await page.locator("[data-estat-analysis]").click();
    };
    for (const [index, exhibit] of ESTAT_EXHIBITS.entries()) {
      const periods = data.periodsBySeries[exhibit.key];
      await page.evaluate(async index => { GaiaStatisticsLab.close(); await GaiaEstatExhibits.select(index); GaiaEstatExhibits.selectPrefecture(12); }, index);
      for (const slot of [0, Math.floor(periods.length / 2), periods.length - 1]) {
        const evidence = await page.evaluate(slot => {
          GaiaEstatExhibits.setPeriod(slot);
          const readout = document.querySelector(".gaia-estat-readout");
          const slider = readout.querySelector("[data-estat-month]");
          const labels = [...readout.querySelectorAll("[data-estat-months] i span")].filter(node => node.textContent).map(node => {
            const rect = node.getBoundingClientRect(); return { text: node.textContent, x: rect.x, right: rect.right, y: rect.y };
          });
          const r = readout.getBoundingClientRect();
          return { value: readout.querySelector("[data-estat-value]").textContent, period: readout.dataset.estatPeriod,
            frequency: readout.querySelector("[data-estat-frequency]").textContent, source: GaiaEstatExhibits.getSourceInfo().datasets[0].url,
            place: readout.querySelector("[data-estat-place]").textContent, station: readout.dataset.estatObservationStation,
            count: Number(readout.dataset.estatPeriodCount), ticks: readout.querySelectorAll("[data-estat-months] i").length,
            min: slider.min, max: slider.max, aria: slider.getAttribute("aria-label"), labels,
            bounds: { x: r.x, right: r.right, overflow: readout.scrollWidth - readout.clientWidth }, dataset: GaiaEstatExhibits.getStatisticsDataset() };
        }, slot);
        assert.equal(evidence.period, periods[slot]);
        assert.equal(evidence.value, new Intl.NumberFormat("ja-JP", { minimumFractionDigits: exhibit.decimals || 0, maximumFractionDigits: exhibit.decimals || 0 }).format(data[exhibit.key][periods[slot]][12]).replace(/^(?=\d)/u, exhibit.key === "migration" && data.migration[periods[slot]][12] > 0 ? "+" : ""));
        assert.equal(evidence.count, periods.length); assert.equal(evidence.ticks, periods.length);
        assert.equal(evidence.max, String(periods.length - 1)); assert.equal(evidence.min, "0"); assert.equal(evidence.aria, "表示年を選ぶ");
        assert.match(evidence.frequency, /年次/u);
        assert(evidence.bounds.x >= 0 && evidence.bounds.right <= width + 1 && evidence.bounds.overflow < 2, JSON.stringify(evidence.bounds));
        for (let i = 1; i < evidence.labels.length; i++) assert(evidence.labels[i].x >= evidence.labels[i - 1].right - 1, `Overlapping year labels: ${width}/${exhibit.key}: ${JSON.stringify(evidence.labels)}`);
        assert(evidence.labels.every(label => Math.abs(label.y - evidence.labels[0].y) < 4), "Timeline wrapped to another row");
        if (index < 3) { assert.equal(evidence.place, "東京都"); assert.equal(evidence.station, ""); assert.equal(evidence.source, data.annualHistorySources[exhibit.key].sourceUrl); }
        else { assert.equal(evidence.station, "東京"); assert.match(evidence.source, /data\.jma\.go\.jp/u); }
        if (["precipitation", "rainyDays"].includes(exhibit.key)) assert.match(evidence.source, /view=a1$/u);
        if (exhibit.key === "sunshineHours") assert.match(evidence.source, /view=a4$/u);
        assert.equal(evidence.dataset.xKind, "year"); assert.equal(evidence.dataset.rows.length, periods.length);
        assert.deepEqual(evidence.dataset.rows.map(row => row.x), periods.map(Number));
        assert.deepEqual(evidence.dataset.rows.map(row => row.value), periods.map(year => data[exhibit.key][year][12]));
        report.checks.push({ width, key: exhibit.key, period: evidence.period, years: evidence.count, source: evidence.source });
      }
      await openAnalysis();
      await page.waitForFunction(() => GaiaStatisticsLab.getState().open && GaiaStatisticsLab.getState().analysisReady);
      const analysis = await page.evaluate(() => ({ state: GaiaStatisticsLab.getState(), result: GaiaStatisticsLab.run("discovery") }));
      assert.equal(analysis.state.datasetId, `estat-prefecture-${exhibit.key}`);
      assert.equal(analysis.result.stats.n, periods.length);
      assert(!analysis.result.dataInsight.candidates.some(candidate => ["two-sided-migration", "concentration", "near-peers"].includes(candidate.id)), "Years treated as regions");
      assert.equal(analysis.result.chart.xLabel, "年");
      if (exhibit.key === "lodging") assert.match(analysis.result.dataInsight.caveat, /従業者10人以上/u);
      if (exhibit.key === "migration") assert.match(analysis.result.dataInsight.caveat, /日本人/u);
      if (exhibit.key === "sunshineHours") assert.match(analysis.result.dataInsight.caveat, /1986〜1990/u);
      if (["lodging", "precipitation"].includes(exhibit.key)) await page.screenshot({ path: path.join(output, `${width}-${exhibit.key}-analysis.png`) });
      await page.evaluate(() => GaiaStatisticsLab.close());
    }
    for (const [key, pref, year, missing] of [["migration", 46, "1954", 19], ["housing", 46, "1951", 22], ["relativeHumidity", 23, "2025", 1], ["precipitation", 8, "2022", 1], ["rainyDays", 8, "2022", 1]]) {
      const index = ESTAT_EXHIBITS.findIndex(exhibit => exhibit.key === key), slot = data.periodsBySeries[key].indexOf(year);
      const result = await page.evaluate(async ({ index, pref, slot }) => {
        await GaiaEstatExhibits.select(index); GaiaEstatExhibits.selectPrefecture(pref); GaiaEstatExhibits.setPeriod(slot);
        const readout = document.querySelector(".gaia-estat-readout");
        return { value: readout.querySelector("[data-estat-value]").textContent, quality: readout.querySelector("[data-estat-quality]").textContent, dataset: GaiaEstatExhibits.getStatisticsDataset() };
      }, { index, pref, slot });
      assert.equal(result.value, "欠測"); assert.match(result.quality, /置き換えていません/u);
      const note = page.locator(width < 901 ? "[data-estat-mobile-history-note]" : "[data-estat-history-note]");
      assert(await note.isVisible());
      assert.match(await note.textContent(), /置き換えていません/u);
      assert.equal(result.dataset.missingCount, missing);
      assert.equal(result.dataset.rows.length, data.periodsBySeries[key].length - missing);
      assert(!result.dataset.rows.some(row => row.id === year));
      if (pref === 46) assert.equal(result.dataset.periodStart, "1973");
      if (key === "rainyDays") await page.screenshot({ path: path.join(output, `${width}-missing.png`) });
      await openAnalysis();
      await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
      const insight = await page.evaluate(() => GaiaStatisticsLab.run("summary"));
      assert.equal(insight.stats.n, result.dataset.rows.length);
      assert.match(insight.dataInsight.caveat, new RegExp(`欠測${missing}年`));
      await page.evaluate(() => GaiaStatisticsLab.close());
      report.checks.push({ width, key, pref: pref + 1, year, missing });
    }
    await page.evaluate(async () => { await GaiaEstatExhibits.select(2); GaiaEstatExhibits.setPeriod(0); });
    // Keyboard moves by a year; manual selection never restarts automatically.
    const slider = page.locator("[data-estat-month]"); await slider.focus(); await page.keyboard.press("ArrowRight");
    assert.equal(await slider.inputValue(), "1");
    const manualState = await page.evaluate(() => GaiaEstatExhibits.getState());
    assert.equal(manualState.playbackEnabled, false);
    await page.waitForTimeout(5000);
    assert.deepEqual(await page.evaluate(() => GaiaEstatExhibits.getState()), manualState);
    await context.close();
  }
  // An unavailable snapshot stays unavailable, never relabelled monthly values.
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
  await context.route("**/estat-prefecture-series.json*", route => route.fulfill({ status: 503, body: "unavailable" }));
  await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
  page = await context.newPage();
  await page.goto(`${base}/?preview=annual-fallback#world`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelector("[data-estat-analysis]"));
  await page.evaluate(async () => GaiaEstatExhibits.select(0));
  assert.equal(await page.locator("[data-estat-value]").textContent(), "欠測");
  assert.equal(await page.locator("b[data-estat-period]").textContent(), "—");
  assert(await page.locator("[data-estat-analysis]").isDisabled());
  assert.match(await page.locator("[data-estat-quality]").textContent(), /読み込めません/u);
  assert.equal(await page.evaluate(() => GaiaEstatExhibits.getStatisticsDataset().rows.length), 0);
  await context.close();
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, output }));
}
