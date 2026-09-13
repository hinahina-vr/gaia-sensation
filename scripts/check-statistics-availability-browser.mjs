import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/analysis-availability");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { status: "running", checks: [], errors: [] };
const fixture = {
  id: "qa-availability", modeId: "estat-prefecture", title: "QA availability fixture", unit: "unit", defaultMethod: "summary",
  xLabel: "x", yLabel: "y", provenance: ["SOURCE", "IMPUTED"],
  rows: [
    { id: "1", label: "single SOURCE", x: 1, y: 2, value: 2, provenance: "SOURCE" },
    { id: "2", label: "other SOURCE A", x: 2, y: 5, value: 5, provenance: "SOURCE" },
    { id: "3", label: "other SOURCE B", x: 3, y: 3, value: 3, provenance: "SOURCE" },
    { id: "4", label: "other SOURCE C", x: 4, y: 8, value: 8, provenance: "SOURCE" },
    { id: "5", label: "single IMPUTED A", x: 5, y: 6, value: 6, provenance: "IMPUTED" },
    { id: "6", label: "single IMPUTED B", x: 6, y: 9, value: 9, provenance: "IMPUTED" },
  ],
};
let page;
try {
  for (const width of [1440, 390, 320]) {
    const touch = width < 721;
    const context = await browser.newContext({ viewport: { width, height: touch ? 844 : 900 }, hasTouch: touch, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.qaWorkerCount = 0;
      const NativeWorker = Worker;
      globalThis.Worker = class extends NativeWorker {
        constructor(...args) { super(...args); globalThis.qaWorkerCount += 1; }
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=analysis-availability#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaStatisticsLab);
    const settle = () => page.waitForFunction(() => ["解析済み", "条件不足"].includes(document.querySelector("#gaia-statistics-status").textContent));
    const open = async data => {
      await page.evaluate(data => globalThis.GaiaStatisticsLab.open(data), data);
      await settle();
      await page.locator("#gaia-statistics-menu-toggle").click();
    };
    const category = async id => { await page.locator("#gaia-statistics-lectures").selectOption(id); await settle(); };
    const button = id => page.locator(`#gaia-statistics-methods [data-method="${id}"]`);
    const disabled = async (id, expected = true) => assert.equal(await button(id).getAttribute("aria-disabled"), String(expected), `${width}/${id}: availability`);
    const query = async value => {
      await page.locator("#gaia-statistics-record-filter").fill(value);
      await page.waitForFunction(value => globalThis.GaiaStatisticsLab.getState().recordQuery === value, value);
      await settle();
    };
    const derived = async value => {
      await page.locator("#gaia-statistics-derived").evaluate((node, value) => {
        node.checked = value; node.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
      await settle();
    };
    await open({ dataset: fixture });
    await disabled("summary", false);
    await disabled("scatter", false);
    await query("single");
    await disabled("summary", false);
    await disabled("scatter");
    const before = await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().methodId);
    const scatter = button("scatter");
    const reason = await scatter.getAttribute("data-unavailable-reason");
    assert.match(reason, /3組以上/);
    assert.equal(await scatter.getAttribute("aria-description"), reason);
    assert.equal(await scatter.evaluate(node => getComputedStyle(node).cursor), "not-allowed");
    await scatter.scrollIntoViewIfNeeded();
    const box = await scatter.boundingBox();
    if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await scatter.hover();
    const tooltip = page.locator("#gaia-statistics-method-reason");
    await tooltip.waitFor({ state: "visible" });
    assert.equal(await tooltip.textContent(), reason);
    assert.equal(await scatter.getAttribute("aria-describedby"), "gaia-statistics-method-reason");
    const tooltipBox = await tooltip.boundingBox();
    assert(tooltipBox.x >= 0 && tooltipBox.x + tooltipBox.width <= width && tooltipBox.y >= 0 && tooltipBox.y + tooltipBox.height <= (touch ? 844 : 900));
    await page.screenshot({ path: path.join(output, `${width}-unavailable-reason.jpg`), type: "jpeg", quality: 90 });
    if (!touch) {
      await tooltip.hover();
      await page.waitForTimeout(250);
      assert(await tooltip.isVisible(), "Tooltip cannot be hovered to read its reason");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    assert.equal(await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().methodId), before, "Disabled click changed the analysis");
    await page.keyboard.press("Escape");
    assert.equal(await tooltip.isVisible(), false);
    assert.equal(await page.locator("#gaia-statistics-menu-toggle").getAttribute("aria-expanded"), "true", "Escape closed the menu instead of its tooltip");
    await scatter.focus();
    await scatter.press("Enter");
    assert(await tooltip.isVisible());
    assert.equal(await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().methodId), before, "Disabled keyboard activation changed the analysis");
    await page.keyboard.press("Escape");

    await derived(true);
    await disabled("scatter", false);
    assert.equal(await scatter.getAttribute("data-unavailable-reason"), null, "Old unavailable reason survived valid data");
    await scatter.click();
    await settle();
    assert.equal(await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().methodId), "scatter");
    await derived(false);
    await disabled("scatter");
    assert.equal(await page.locator("#gaia-statistics-status").textContent(), "条件不足", "Old valid result survived an invalid filter");
    await button("summary").click();
    await category("regression");
    assert.equal(await page.locator('#gaia-statistics-methods button[aria-disabled="true"]').count(), 5);
    assert.equal(await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().methodId), "summary", "Unavailable category replaced the current result");
    assert(await page.locator(".gaia-statistics-method-status").isVisible());
    await category("estimation");
    await disabled("interval");
    assert.match(await button("interval").getAttribute("data-unavailable-reason"), /2件以上/);
    await category("testing");
    await disabled("paired");
    assert.match(await button("paired").getAttribute("data-unavailable-reason"), /一対一.*2系列/);
    await category("bayesian");
    await disabled("bayes", false);
    await disabled("mcmc", false);
    assert.equal(await page.evaluate(() => qaWorkerCount), 0, "Eligibility checking started an MCMC worker");
    await query("no matching record");
    await disabled("bayes");
    await disabled("mcmc");
    await category("descriptive");
    await disabled("summary");
    assert.match(await button("summary").getAttribute("data-unavailable-reason"), /絞り込み条件に合う観測値がありません/);
    await query("");
    await disabled("scatter", false);

    // Reasons in the middle of a narrow menu must not cover adjacent methods.
    await category("probability");
    await disabled("discrete");
    if (touch) {
      await button("discrete").scrollIntoViewIfNeeded();
      const discreteBox = await button("discrete").boundingBox();
      await page.touchscreen.tap(discreteBox.x + discreteBox.width / 2, discreteBox.y + discreteBox.height / 2);
    }
    else await button("discrete").hover();
    await tooltip.waitFor({ state: "visible" });
    for (const id of ["moments", "discrete", "continuous"]) {
      assert(await button(id).evaluate(node => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), `${width}/${id}: reason covers an adjacent method`);
    }
    if (touch) await button("continuous").tap();
    else await button("continuous").click();
    await settle();
    assert.equal(await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().methodId), "continuous");

    // Replacing the same dataset ID must invalidate the eligibility cache.
    const constant = { ...fixture, rows: fixture.rows.map(row => ({ ...row, x: 1 })) };
    await open({ dataset: constant });
    await disabled("summary", false);
    await disabled("scatter");
    assert.match(await button("scatter").getAttribute("data-unavailable-reason"), /同じ値/);
    await open({ dataset: fixture });
    await disabled("scatter", false);

    await open({ datasetId: "waste" });
    await category("estimation");
    await disabled("difference-ci");
    assert.match(await button("difference-ci").getAttribute("data-unavailable-reason"), /補完・派生値も含める/);
    await derived(true);
    await disabled("difference-ci", false);
    await query("Canada");
    await disabled("difference-ci");
    await query("");
    await disabled("difference-ci", false);
    report.checks.push({ width, reason, tooltipBox, pointer: touch ? "tap" : "hover", keyboard: "passed", filters: "live updates", unavailableCategory: "preserves result", cacheInvalidation: "passed", mcmcPreflightWorkers: 0 });
    console.log(`PASS ${width}px: disabled styling/activation, hover/tap/focus reasons, Escape, filters, derived data, singular input and cache invalidation`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
