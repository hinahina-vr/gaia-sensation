import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { METHOD_GROUPS, METHOD_LOOKUP } from "../statistics-methods.js";
import { ANALYSIS_PURPOSES, ANALYSIS_CARDS, analysisIcon } from "../statistics-menu.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistics-visual-picker");
fs.mkdirSync(output, { recursive: true });
assert.deepEqual(Object.keys(ANALYSIS_PURPOSES), METHOD_GROUPS.map(group => group.id));
assert.deepEqual(Object.keys(ANALYSIS_CARDS), [...METHOD_LOOKUP.keys()]);
assert.equal(new Set([...METHOD_LOOKUP.keys()].map(analysisIcon)).size, 26);
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=visual-analysis#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaStatisticsLab);
    await page.evaluate(() => GaiaStatisticsLab.open({ datasetId: "rainfall" }));
    await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
    const openMenu = async () => {
      if (await page.locator("#gaia-statistics-menu-toggle").getAttribute("aria-expanded") !== "true") await page.locator("#gaia-statistics-menu-toggle").click();
    };
    await openMenu();
    assert.equal(await page.locator("#gaia-statistics-lectures").isVisible(), false);
    assert.equal(await page.locator("[data-analysis-group] svg[aria-hidden='true']").count(), 7);
    for (const group of METHOD_GROUPS) {
      await openMenu();
      const previous = await page.evaluate(() => GaiaStatisticsLab.getState().methodId);
      await page.locator(`[data-analysis-group="${group.id}"]`).click();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().methodId), previous, "Browsing a purpose changed the result");
      assert.equal(await page.locator(`[data-analysis-group="${group.id}"]`).getAttribute("aria-pressed"), "true");
      for (const [id] of group.methods) {
        await openMenu();
        const method = page.locator(`[data-method="${id}"]`);
        await method.scrollIntoViewIfNeeded();
        assert.equal(await method.locator("svg[aria-hidden='true']").count(), 1);
        const bounds = await method.evaluate(node => {
          const r = node.getBoundingClientRect();
          return { x: r.x, right: r.right, height: r.height, overflow: node.scrollWidth - node.clientWidth,
            hit: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
        });
        assert(bounds.x >= 0 && bounds.right <= width && bounds.height >= 44 && bounds.overflow <= 1 && bounds.hit, `${width}/${id}: ${JSON.stringify(bounds)}`);
        const unavailable = await method.getAttribute("aria-disabled") === "true";
        if (unavailable) {
          const before = await page.evaluate(() => GaiaStatisticsLab.getState().methodId);
          // aria-disabled is intentionally focusable so the user can read why.
          await method.focus(); await page.keyboard.press("Enter");
          assert(await page.locator("#gaia-statistics-method-reason").isVisible());
          assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().methodId), before);
          await page.keyboard.press("Escape");
          assert.equal(await page.locator("#gaia-statistics-menu-toggle").getAttribute("aria-expanded"), "true");
        } else {
          await method.click();
          await page.waitForFunction(id => GaiaStatisticsLab.getState().methodId === id && GaiaStatisticsLab.getState().analysisReady, id);
          assert.equal(await page.locator("#gaia-statistics-menu-toggle").getAttribute("aria-expanded"), "false");
          assert.equal(await page.locator('[data-stat-view][aria-selected="true"]').getAttribute("data-stat-view"), id === "discovery" ? "findings" : "chart");
        }
        report.checks.push({ width, method: id, unavailable, ...bounds });
      }
    }
    await openMenu();
    await page.locator('[data-analysis-group="probability"]').click();
    await page.locator("#gaia-statistics-menu-close").focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.analysisGroup), "descriptive");
    await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
    assert.equal(await page.locator('[data-analysis-group="probability"]').getAttribute("aria-pressed"), "true");
    await page.locator("#gaia-statistics-controls").evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, `${width}-menu.png`) });
    await page.locator(".gaia-statistics-data-options > summary").click();
    await page.locator("#gaia-statistics-record-filter").fill("no matching record");
    await page.waitForFunction(() => GaiaStatisticsLab.getState().recordQuery === "no matching record" && GaiaStatisticsLab.getState().analysisReady);
    assert.equal(await page.locator('#gaia-statistics-methods [aria-disabled="true"]').count(), 3);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#gaia-statistics-menu-toggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement.id), "gaia-statistics-menu-toggle");
    console.log(`PASS ${width}px: 7 purposes, 26 graphical methods, selection, availability, filter, keyboard`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
