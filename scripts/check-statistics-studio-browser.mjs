import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistics-studio");
fs.mkdirSync(output, { recursive: true });
const requestedWidths = process.argv[4]?.split(",").map(Number);
const liveWind = process.argv[5] === "live-wind";
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1920, 1440, 1024, 768, 390, 320].filter(width => !requestedWidths || requestedWidths.includes(width))) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", hasTouch: width <= 980 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=statistics-studio#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab && globalThis.GaiaMapDemo && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async liveWind => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      await document.fonts.ready;
      if (liveWind) {
        GaiaMapCategories.buttons()[14].click();
        GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveExhibits.selectObservationPoint("tokyo");
      } else GaiaStatisticsLab.open({ datasetId: "rainfall" });
    }, liveWind);
    if (liveWind) {
      await page.waitForFunction(() => document.querySelector("[data-live-deck-analysis]")?.disabled === false);
      await page.locator("[data-live-deck-analysis]").click();
    }
    const ready = () => page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
    await ready();
    const shell = page.locator(".gaia-statistics-shell");
    const view = id => page.locator(`[data-stat-view="${id}"]`);
    const checkBounds = async () => {
      const geometry = await shell.evaluate(node => ({
        box: node.getBoundingClientRect().toJSON(), overflow: node.scrollWidth - node.clientWidth,
        tabs: [...node.querySelectorAll("[data-stat-view]")].map(tab => tab.getBoundingClientRect().toJSON()),
        actions: [...node.querySelectorAll(".gaia-statistics-header-actions button")].map(button => button.getBoundingClientRect().toJSON()),
      }));
      assert(geometry.box.left >= 0 && geometry.box.right <= width && geometry.overflow <= 1, `${width}: shell bounds ${JSON.stringify(geometry)}`);
      for (const box of [...geometry.tabs, ...geometry.actions]) assert(box.left >= geometry.box.left && box.right <= geometry.box.right && box.height >= 44, `${width}: control bounds ${JSON.stringify(box)}`);
      return geometry;
    };
    const original = await page.locator("#gaia-statistics-findings").textContent();
    assert.doesNotMatch(original, /NaN|undefined|Infinity/u);
    assert.equal(await view("chart").getAttribute("aria-selected"), "true", "Analysis entry starts on the graph");
    await page.locator(".gaia-statistics-companion").click();
    assert.equal(await view("findings").getAttribute("aria-selected"), "true", "Companions lead to findings");
    await checkBounds();
    await shell.screenshot({ path: path.join(output, `${width}-discovery.png`) });

    // Change the method through the actual drawer, then keep the source data
    // fixed while checking every view and evidence link.
    await page.locator("#gaia-statistics-menu-toggle").click();
    await page.locator('[data-analysis-group="descriptive"]').click();
    await page.locator('[data-method="summary"]').click();
    await ready();
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().methodId), "summary");
    const baseline = await page.locator("#gaia-statistics-metrics").textContent();
    assert(baseline.trim().length > 20);
    for (const id of ["findings", "chart", "values", "records", "insights"]) {
      await view(id).click();
      await shell.evaluate(node => { node.scrollTop = 0; });
      assert.equal(await view(id).getAttribute("aria-selected"), "true");
      await checkBounds();
      if (id !== "chart") assert.equal(await page.locator(`#stat-panel-${id}`).evaluate(node => node.open), true);
      if (id === "findings") {
        const findings = page.locator("#gaia-statistics-findings");
        assert((await findings.evaluate(node => node.scrollWidth - node.clientWidth)) <= 1);
        assert((await findings.locator(":scope > .gaia-statistics-finding").count()) >= 3);
        assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), false, "No duplicate reading at any width");
        if (width <= 980) {
          assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), false);
          assert.equal(await findings.evaluate(node => getComputedStyle(node).position), "static");
          assert((await findings.evaluate(node => node.scrollHeight - node.clientHeight)) <= 1, "Mobile findings must form one readable document");
        }
        await shell.screenshot({ path: path.join(output, `${width}-findings.png`) });
        await findings.locator(":scope > button").click();
        assert.equal(await view("values").getAttribute("aria-selected"), "true");
      }
      if (id === "chart") {
        const metrics = page.locator(".gaia-statistics-takeaway-evidence button");
        // A local wind snapshot has fewer comparable observations and
        // legitimately exposes two evidence cards, not three invented values.
        assert((await metrics.count()) >= 2 && (await metrics.count()) <= 3);
        const cards = await metrics.evaluateAll(nodes => nodes.map(node => ({ height: node.getBoundingClientRect().height, overflow: node.scrollWidth - node.clientWidth, border: getComputedStyle(node).borderRadius })));
        assert(cards.every(card => card.height >= 44 && card.overflow <= 1 && parseInt(card.border, 10) >= 10));
        await shell.screenshot({ path: path.join(output, `${width}-chart.png`) });
      }
      assert.equal(await page.locator("#gaia-statistics-metrics").textContent(), baseline, "View-only action changed calculated values");
    }
    await view("chart").click();
    await view("chart").focus(); await page.keyboard.press("ArrowRight");
    assert.equal(await view("findings").getAttribute("aria-selected"), "true");
    await page.locator("#stat-panel-findings .gaia-statistics-panel-back").click();
    assert.equal(await view("chart").getAttribute("aria-selected"), "true");
    await page.locator("#gaia-statistics-ai-open").click();
    const dialog = page.locator("#gaia-statistics-ai-dialog");
    assert.equal(await dialog.locator("[data-ai-prompt] svg[aria-hidden='true']").count(), 6);
    assert.equal(await dialog.locator("[name='apiKey']").inputValue(), "");
    await page.mouse.move(0, 0);
    await dialog.screenshot({ path: path.join(output, `${width}-ai.png`) });
    await dialog.locator("[data-ai-close]").click();
    assert.equal(await page.locator("#gaia-statistics-metrics").textContent(), baseline);
    await checkBounds();
    await page.locator("#gaia-statistics-close").click();
    assert.equal(await page.locator("#gaia-statistics-lab").isVisible(), false);
    report.checks.push({ width, realDataset: liveWind ? "live-wind" : "rainfall", views: 5, visualQuestionPresets: 6, mobileDocument: width <= 980, unchangedNumbers: true, keyboardTabs: true, drawer: true, aiOpenClose: true });
    console.log(`PASS ${width}: studio layout, five views, unchanged source values, evidence links, keyboard tabs and AI entry`);
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
