import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", output = "artifacts/statistics-readable-comparison"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [], note: "Deterministic UI test data, not current weather observations." };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1920, 1440, 1024, 390, 320]) {
    const height = width < 500 ? width === 320 ? 568 : 844 : 1080;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width < 500 });
    await context.addInitScript(() => { localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      await GaiaStatisticsLab.open({ dataset: {
        id: "qa-readable-wind", title: "動作確認用データ — 気圧と風速（実際の天気ではありません）",
        unit: "m/s", xLabel: "地表気圧", yLabel: "風速", valueLabel: "風速", defaultMethod: "discovery",
        insightContext: { domain: "wind", measurementKind: "MODEL" },
        rows: [0.27, 19.94, 4, 8, 2, 6, 999].map((value, i) => ({
          id: `qa-${i}`, label: ["北緯11.8° 東経1.1°", "南緯50.4° 東経112.7°"][i] || `確認用地点${i}`,
          pressure: [987.5, 987.5, 1003, 1018, 1020, 1040, 987.5][i],
          x: [987.5, 987.5, 1003, 1018, 1020, 1040, 987.5][i], y: value, value, provenance: i === 6 ? "IMPUTED" : "SOURCE",
        })),
      } });
      await document.fonts.ready;
    });
    await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
    assert.equal(await page.locator('[data-stat-view="chart"]').getAttribute("aria-selected"), "true");
    await page.locator(".gaia-statistics-companion").click();
    const findings = page.locator("#gaia-statistics-findings");
    const table = findings.locator(".gaia-statistics-comparison");
    assert.equal(await table.count(), 1);
    assert.match(await findings.locator(":scope > h4").textContent(), /風速に19.67m\/sの差/);
    assert.deepEqual(await table.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(cell => cell.textContent))), [["987.5", "987.5"], ["0.27", "19.94"]]);
    assert.match(await table.locator("thead").textContent(), /地点A.*北緯11.8° 東経1.1°.*地点B.*南緯50.4° 東経112.7°/);
    assert.match(await findings.innerText(), /他の条件まで同じという意味ではありません/);
    assert.match(await findings.innerText(), /モデル値を含む記録/);
    assert.doesNotMatch(await findings.innerText(), /課題の候補|この問いが生まれた|なぜ問題|NaN|Infinity|undefined/);
    assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), false);
    const bounds = await findings.evaluate(element => ({ overflow: element.scrollWidth - element.clientWidth, width: element.clientWidth, first: element.querySelector("[data-kind]").dataset.kind }));
    assert.equal(bounds.first, "observation"); assert(bounds.overflow <= 1);
    assert((await page.locator(".gaia-statistics-shell").evaluate(element => element.scrollWidth - element.clientWidth)) <= 1);
    await page.screenshot({ path: path.join(output, `${width}-comparison.png`) });
    await table.screenshot({ path: path.join(output, `${width}-table.png`) });
    for (const [label, id] of [["地点A", "qa-0"], ["地点B", "qa-1"]]) {
      await findings.getByRole("button", { name: new RegExp(`^${label}・`) }).click();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().selectedRecordId), id);
      assert.equal(await page.locator('[data-stat-view="records"]').getAttribute("aria-selected"), "true");
      await page.locator('[data-stat-view="findings"]').click();
    }
    await page.locator('[data-stat-view="chart"]').click();
    assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), true);
    await page.locator('[data-stat-view="chart"]').focus(); await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator('[data-stat-view="findings"]').getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), false);
    await findings.locator(":scope > button").click();
    assert.equal(await page.locator('[data-stat-view="values"]').getAttribute("aria-selected"), "true");
    await page.evaluate(() => { const input = document.querySelector("#gaia-statistics-derived"); input.checked = true; input.dispatchEvent(new Event("change")); });
    await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
    assert.match(await findings.textContent(), /補完値1行.*除外/);
    assert.deepEqual(await table.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].map(cell => cell.textContent))), [["987.5", "987.5"], ["0.27", "19.94"]]);
    // Recalculation must clear the pair when no comparison remains.
    await page.evaluate(() => { const input = document.querySelector("#gaia-statistics-record-filter"); input.value = "北緯11.8"; input.dispatchEvent(new Event("search")); });
    await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
    await page.locator('[data-stat-view="findings"]').click();
    assert.equal(await table.count(), 0);
    assert.match(await findings.locator(":scope > h4").textContent(), /1件の記録だけでは/);
    await page.locator("#gaia-statistics-close").click();
    report.checks.push({ width, height, ...bounds });
    await context.close(); console.log(`PASS ${width}: numbers, units, pairing, one reading, record links, tabs and filter reset`);
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.error = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
