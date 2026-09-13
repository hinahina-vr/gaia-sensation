import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve(process.argv[3] || "artifacts/recycling-expansion/workflow");
fs.mkdirSync(output, { recursive: true });
const data = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8"));
const rows = data.modes.find(mode => mode.id === "nothing-is-waste").signals.countryWaste;
const report = { status: "running", checks: [], errors: [], scope: "Local Chrome, real app and bundled public snapshot; NOAA aurora unrelated live endpoint is fixture-isolated.",
  sha256: Object.fromEntries(["app.js", "app-content.js", "statistics-lab.js", "statistics-datasets.js", "statistics-game.css", "src/data/recycling-provenance.js", "data/gaia-signals.json"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const ready = async () => {
  await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaStatisticsLab);
  await page.evaluate(async () => {
    await GaiaMapObservationAdapter.waitSignalsReady();
    GaiaModeEntryGuide.close("map", { restoreFocus: false });
    GaiaMapDemo.stop(); GaiaMapObservationAdapter.selectMode(3);
  });
  await page.waitForFunction(() => {
    const map = document.querySelector("#japan-overlay").dataset;
    return map.recyclingCountryCount === "145" && map.recyclingCountryFillCount === "144"
      && map.countryGeometryState === "ready" && map.plotRevealState === "complete";
  });
};
const select = async code => {
  const index = rows.findIndex(row => row.iso3 === code);
  await page.evaluate(index => {
    GaiaMapObservationAdapter.closePoi();
    const input = document.querySelector("#japan-layer [data-signal-time]");
    input.value = String(index); input.dispatchEvent(new Event("input", { bubbles: true }));
  }, index);
  await page.waitForFunction(code => document.querySelector("#japan-overlay").dataset.recyclingSelectedIso3 === code, code);
  return rows[index];
};
const settled = () => page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady && document.querySelector("#gaia-statistics-status").textContent !== "計算中");
try {
  for (const width of process.argv[4] ? process.argv[4].split(",").map(Number) : [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, reducedMotion: "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    const analyzeFromMap = async () => {
      if (width > 900) await page.locator(".map-dock-action--statistics").click();
      else {
        await page.locator('[data-mobile-sheet="tools"]').tap();
        await page.locator("#map-mobile-sheet").getByRole("button", { name: "統計分析", exact: true }).tap();
      }
    };
    const openDataOptions = async () => {
      if (await page.locator("#gaia-statistics-menu-toggle").getAttribute("aria-expanded") !== "true") await page.locator("#gaia-statistics-menu-toggle").click();
      if (await page.locator(".gaia-statistics-data-options").getAttribute("open") === null) await page.locator(".gaia-statistics-data-options > summary").click();
    };
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?mode=09&preview=recycling-expansion#world`, { waitUntil: "domcontentloaded" });
    await ready();
    for (const code of ["RUS", "IDN", "MYS", "ARM", "MAR", "CHI", "JPN", "AZE"]) {
      const row = await select(code);
      const capture = await page.evaluate(() => GaiaMapObservationAdapter.captureObservation());
      assert.deepEqual(capture.provenance, { classification: "SOURCE", datasetIds: [row.datasetId || "un-sdg"] });
      assert(capture.context.some(item => item.label === "データ区分" && item.value.includes(String(row.year))));
      if (row.datasetId) {
        assert(capture.context.some(item => item.label === "定義" && item.value.includes("回収")));
        assert(capture.context.some(item => item.label === "対象・算定" && item.value === row.sourceScope));
      }
    }
    // Open Russia by clicking inside its country polygon, not via a test-only POI hook.
    await select("RUS");
    await page.evaluate(() => GaiaMapObservationAdapter.focusEarthLocation({ lon: 100, lat: 60, zoom: 3.5, targetX: .5, targetY: .38, durationMs: 0 }));
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay").dataset.earthZoom) === 3.5);
    await select("JPN");
    const point = await page.evaluate(() => {
      const o = document.querySelector("#japan-overlay"), r = document.querySelector("#japan-map").getBoundingClientRect();
      const s = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * Number(o.dataset.earthZoom);
      return { x: r.left + r.width / 2 + Number(o.dataset.earthOffsetX) + (((100 - Number(o.dataset.earthCenterLongitude) + 540) % 360) - 180) * s, y: r.top + r.height / 2 + Number(o.dataset.earthOffsetY) - 60 * s };
    });
    assert.equal(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.id, point), "japan-map", `Russia tap must hit the map: ${JSON.stringify(point)}`);
    if (width < 600) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.locator("#japan-poi-card").waitFor({ state: "visible" });
    const meta = await page.locator("#japan-poi-meta").textContent();
    assert.match(meta, /世界銀行公表値.*回収.*測定年不明/);
    assert.equal(await page.locator("#japan-poi-source").getAttribute("href"), rows.find(row => row.iso3 === "RUS").url);
    await page.screenshot({ path: path.join(output, `${width}-russia-source.png`) });
    const card = await page.locator("#japan-poi-card").boundingBox();
    assert(card.x >= -1 && card.x + card.width <= width + 1);
    await page.evaluate(() => GaiaMapObservationAdapter.closePoi());
    await select("ARM");
    // The shipped UI has no notebook action. Validate the capture API above,
    // and exercise the actual user-facing save feature: analysis saved views.
    if (width > 900) await page.locator(".map-dock-action--source").click();
    else {
      await page.locator('[data-mobile-sheet="tools"]').tap();
      await page.locator("#map-mobile-sheet").getByRole("button", { name: "データの出典", exact: true }).tap();
    }
    await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
    assert.match(await page.locator("#japan-data-panel").textContent(), /What a Waste 3.0/);
    assert(await page.locator('#japan-data-panel a[href*="what-a-waste-global-database"]').count());
    await page.locator("#japan-data-close").click();
    await analyzeFromMap(); await settled();
    const analysis = await page.evaluate(async () => ({ state: GaiaStatisticsLab.getState(), result: await GaiaStatisticsLab.run("summary"),
      used: Number(document.querySelector("#gaia-statistics-kpis").dataset.usedRows), text: document.querySelector("#gaia-statistics-lab").textContent }));
    assert.equal(analysis.state.datasetId, "waste"); assert.equal(analysis.used, 145);
    assert.deepEqual(analysis.result.stats.values.toSorted((a,b) => a-b), rows.map(row => row.recyclePercent).toSorted((a,b) => a-b));
    assert.match(analysis.text, /世界銀行.*分母.*世界平均/s);
    assert.match(analysis.text, /公表値のみ/);
    await page.screenshot({ path: path.join(output, `${width}-statistics.png`) });
    await page.locator('[data-stat-view="findings"]').click();
    const limits = page.locator('#gaia-statistics-findings > [data-kind="limit"]');
    await limits.scrollIntoViewIfNeeded();
    assert.match(await limits.innerText(), /国連.*世界銀行.*分母.*世界平均/s);
    await page.screenshot({ path: path.join(output, `${width}-comparison-limit.png`) });
    await page.locator('[data-stat-view="records"]').click();
    await openDataOptions();
    for (const [query, count] of [["世界銀行公表値", 54], ["国連公表値", 91]]) {
      await page.locator("#gaia-statistics-record-filter").fill(query);
      await page.waitForFunction(count => Number(document.querySelector("#gaia-statistics-kpis").dataset.usedRows) === count, count);
      await settled();
    }
    await page.locator("#gaia-statistics-record-filter").fill("ARM");
    await settled();
    await page.waitForFunction(() => document.querySelector("#gaia-statistics-kpis").dataset.usedRows === "1");
    assert.match(await page.locator("#gaia-statistics-records-body").textContent(), /世界銀行公表値.*プラスチックのみ/s);
    await page.locator("#gaia-statistics-view-save").click();
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), 1);
    await page.locator("#gaia-statistics-menu-close").click();
    await page.locator(".gaia-statistics-records-scroll").evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
    await page.locator("#gaia-statistics-records-body tr").scrollIntoViewIfNeeded();
    const recordLayout = await page.locator("#gaia-statistics-records-body tr").evaluate(node => ({
      width: node.clientWidth, height: node.clientHeight,
      notes: node.querySelector("td:last-child").getBoundingClientRect().width,
      overflow: node.scrollWidth - node.clientWidth,
    }));
    assert(recordLayout.notes >= (width < 600 ? 200 : 300), `Source notes cannot collapse into one-character columns: ${JSON.stringify(recordLayout)}`);
    assert(recordLayout.height < 430, `Source notes must fit readable rows: ${JSON.stringify(recordLayout)}`);
    if (width < 600) {
      const headings = await page.locator('.gaia-statistics-records thead th:nth-child(-n+3)').evaluateAll(nodes => nodes.map(node => ({width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height})));
      assert(headings.every(node => node.width >= 65 && node.height < 75), `Readable column headings: ${JSON.stringify(headings)}`);
    }
    await page.locator(".gaia-statistics-records-scroll").evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, `${width}-record-scope.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.reload({ waitUntil: "domcontentloaded" }); await ready();
    await analyzeFromMap(); await settled();
    await openDataOptions();
    const view = await page.locator("#gaia-statistics-saved-view option").nth(1).getAttribute("value");
    await page.locator("#gaia-statistics-saved-view").selectOption(view);
    await page.locator("#gaia-statistics-view-apply").click(); await settled();
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().recordQuery), "ARM");
    assert.equal(await page.locator("#gaia-statistics-kpis").getAttribute("data-used-rows"), "1");
    report.checks.push({ width, countries: 145, selected: ["RUS", "IDN", "MYS", "ARM", "MAR", "CHI", "JPN", "AZE"], worldBankPolygonSource: true, sourceLedger: true, statisticsExact: true, captureApi: true, savedViewReload: true });
    console.log(`PASS ${width}: WB polygon/source, source scopes, all 145 analysis values, source ledger, capture API and filtered-view save/reload`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); throw error;
} finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
