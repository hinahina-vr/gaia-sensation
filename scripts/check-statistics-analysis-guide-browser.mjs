import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistics-analysis-guide");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=analysis-guide#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab && globalThis.GaiaMapDemo && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaStatisticsLab.open({ datasetId: "rainfall" });
    });
    const ready = method => page.waitForFunction(method => GaiaStatisticsLab.getState().analysisReady
      && (!method || GaiaStatisticsLab.getState().methodId === method), method);
    await ready();
    assert.equal(await page.locator("#gaia-statistics-lectures option").count(), 7);
    assert.equal(await page.locator('#gaia-statistics-lectures option[value="workflow"]').textContent(), "分析の進め方");
    await page.locator("#gaia-statistics-menu-toggle").click();
    await page.locator('[data-analysis-group="workflow"]').click();
    assert.equal(await page.locator('[data-analysis-group="workflow"] small').textContent(), "分析の進め方");
    const guide = page.locator('[data-method="exercise"]');
    assert.equal(await guide.locator("strong").textContent(), "分析の流れを確認する");
    assert.match(await guide.textContent(), /問いから次の分析まで、6項目を確認。/u);
    const bounds = await guide.evaluate(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, height: box.height, overflow: node.scrollWidth - node.clientWidth };
    });
    assert(bounds.left >= 0 && bounds.right <= width && bounds.height >= 44 && bounds.overflow <= 1);
    await guide.screenshot({ path: path.join(output, `${width}-guide-card.png`) });
    await guide.click(); await ready("exercise");
    assert.equal(await page.locator("#gaia-statistics-method-number").textContent(), "分析の進め方");
    assert.equal(await page.locator("#gaia-statistics-method-title").textContent(), "分析の流れを確認する");
    assert.match(await page.locator("#gaia-statistics-method-copy").textContent(), /問い・出典・図・推定・限界・次の分析/u);
    assert.match(await page.locator('.gaia-statistics-insight[data-kind="meaning"]').textContent(), /分析の進め方：①問いを定める/u);
    assert.doesNotMatch(await page.locator("#gaia-statistics-lab").textContent(), /総合演習/u);
    // A generated next-action link must use the new copy and retain its target.
    await page.locator("#gaia-statistics-menu-toggle").click();
    await page.locator('[data-analysis-group="bayesian"]').click();
    await page.locator('[data-method="bayes"]').click(); await ready("bayes");
    await page.locator('[data-stat-view="insights"]').click();
    const next = page.locator(".gaia-statistics-next-button").filter({ hasText: "分析の進め方" });
    assert.equal(await next.count(), 1);
    await next.click(); await ready("exercise");
    assert.equal(await page.locator("#gaia-statistics-method-title").textContent(), "分析の流れを確認する");
    assert.doesNotMatch(await page.locator("#gaia-statistics-lab").textContent(), /総合演習/u);
    report.checks.push({ width, category: "分析の進め方", method: "分析の流れを確認する", nextAction: true, bounds });
    console.log(`PASS ${width}: renamed category, menu, result guide and next-action routing`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
