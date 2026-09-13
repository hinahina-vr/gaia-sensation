import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { METHOD_GROUPS } from "../statistics-methods.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistical-categories");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      localStorage.setItem("gaia-statistics-saved-views:v1", JSON.stringify([{
        id: "legacy-logistic", name: "31地点の平均降水量 · 13 ロジスティック回帰", datasetId: "rainfall",
        methodId: "logistic", lectureId: "13", includeDerived: false, recordQuery: "", savedAt: "2026-09-01T00:00:00Z",
      }]));
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=statistical-categories#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaStatisticsLab);
    await page.evaluate(() => globalThis.GaiaStatisticsLab.open({ datasetId: "rainfall" }));
    const settle = () => page.waitForFunction(() => ["解析済み", "条件不足"].includes(document.querySelector("#gaia-statistics-status").textContent));
    await settle();
    await page.locator("#gaia-statistics-menu-toggle").click();
    const categories = page.locator("#gaia-statistics-lectures");
    assert.deepEqual(await categories.locator("option").allTextContents(), METHOD_GROUPS.map(group => group.name));
    const checks = [];
    for (const group of METHOD_GROUPS) {
      await categories.selectOption(group.id);
      await settle();
      assert.deepEqual(await page.locator("#gaia-statistics-methods button").evaluateAll(nodes => nodes.map(node => node.dataset.method)), group.methods.map(method => method[0]));
      for (const [id] of group.methods) {
        const button = page.locator(`#gaia-statistics-methods [data-method="${id}"]`);
        const unavailable = await button.getAttribute("aria-disabled") === "true";
        const previousMethod = await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().methodId);
        if (unavailable) {
          // aria-disabled retains keyboard/touch access to the reason, not analysis activation.
          await button.evaluate(node => node.click());
          assert(await button.getAttribute("data-unavailable-reason"));
          await page.keyboard.press("Escape");
        } else await button.click();
        await settle();
        const state = await page.evaluate(() => globalThis.GaiaStatisticsLab.getState());
        assert.equal(state.lectureId, group.id);
        assert.equal(state.methodId, unavailable ? previousMethod : id);
        assert.equal(state.datasetId, "rainfall");
        if (!unavailable) assert.equal(await page.locator("#gaia-statistics-method-number").textContent(), group.name);
        assert.equal(await button.getAttribute("aria-pressed"), String(state.methodId === id));
        await button.scrollIntoViewIfNeeded();
        const bounds = await button.evaluate(node => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x, right: rect.right, y: rect.y, bottom: rect.bottom, height: rect.height,
            textFits: node.scrollWidth <= node.clientWidth + 1,
            hit: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
          };
        });
        assert(bounds.height >= 44 && bounds.textFits && bounds.hit && bounds.x >= 0 && bounds.right <= width,
          `${width}/${id}: method inaccessible or clipped: ${JSON.stringify(bounds)}`);
        const nextLabels = await page.locator(".gaia-statistics-next-button").allTextContents();
        assert(nextLabels.every(label => !/^→\s*\d{2}\s/u.test(label)), "Old lecture numbering is visible in related actions");
        checks.push({ category: group.id, method: id, available: !unavailable });
      }
    }
    // Native keyboard selection still changes the category and its default method.
    await categories.focus();
    await categories.press("Home");
    await categories.press("ArrowDown");
    await settle();
    assert.equal(await categories.inputValue(), "probability");
    assert.equal((await page.evaluate(() => globalThis.GaiaStatisticsLab.getState())).methodId, "moments");

    // Restore a view saved with the old lecture ID; method identity controls the new category.
    // This compatibility surface is intentionally hidden in the current workspace.
    assert.equal(await page.locator(".gaia-statistics-saved-panel").isVisible(), false);
    await page.locator("#gaia-statistics-saved-view").evaluate(node => {
      node.value = "legacy-logistic";
      node.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator("#gaia-statistics-view-apply").evaluate(node => node.click());
    await settle();
    const restored = await page.evaluate(() => globalThis.GaiaStatisticsLab.getState());
    assert.equal(restored.methodId, "logistic");
    assert.equal(restored.lectureId, "regression");
    assert.equal(restored.datasetId, "rainfall");
    await page.locator("#gaia-statistics-view-save").evaluate(node => node.click());
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gaia-statistics-saved-views:v1"))[0]);
    assert.equal(saved.methodId, "logistic");
    assert.doesNotMatch(saved.name, / · (?:\d{2}|regression) /u);

    // An old 06 action must still open interval estimation, not the first method in its broader group.
    await categories.selectOption("testing");
    await settle();
    await page.locator("#gaia-statistics-menu-close").click();
    await page.locator('[data-stat-view="insights"]').click();
    const intervalAction = page.locator(".gaia-statistics-next-button").filter({ hasText: "信頼区間" }).first();
    assert.match(await intervalAction.textContent(), /^→ 信頼区間/u);
    await intervalAction.click();
    await settle();
    const navigated = await page.evaluate(() => globalThis.GaiaStatisticsLab.getState());
    assert.equal(navigated.lectureId, "estimation");
    assert.equal(navigated.methodId, "interval");
    await page.locator('[data-stat-view="chart"]').click();
    await page.locator("#gaia-statistics-menu-toggle").click();
    await categories.selectOption("regression");
    await settle();
    await categories.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${width}-categories.jpg`), type: "jpeg", quality: 90 });
    report.checks.push({ width, methods: checks, savedView: "legacy restored without renumbering methods", nextAction: navigated.methodId, keyboard: "passed" });
    console.log(`PASS ${width}px: seven categories, 25 methods with availability guards, keyboard, legacy saved view and related analysis links`);
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
