import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve("artifacts/realtime-analysis-disabled");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { checks: [], errors: [] };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", hasTouch: width < 900 });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=realtime-analysis-disabled#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab && globalThis.GaiaMapDemo && globalThis.GaiaMapObservationAdapter && globalThis.GaiaLiveExhibits && GaiaMapCategories.buttons().length === 30);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      window.analysisOpenCalls = 0;
      const lab = GaiaStatisticsLab;
      window.GaiaStatisticsLab = { ...lab, open: args => { window.analysisOpenCalls++; return lab.open(args); } };
      await document.fonts.ready;
    });
    const numbers = await page.evaluate(() => GaiaMapCategories.buttons().map(button => Number(button.textContent))
      .filter(number => GaiaMapCategories.getProfile(number)?.time === "realtime"));
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20]);
    for (const number of numbers) {
      await page.evaluate(number => { GaiaMapCategories.buttons()[number - 1].click(); GaiaLiveExhibits.pausePoiAutoplay(); }, number);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      if (width < 900) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        const button = page.locator(".map-mobile-tool-grid").getByRole("button", { name: "統計分析", exact: true });
        assert.equal(await button.isDisabled(), true);
        const reason = page.locator("#map-mobile-analysis-unavailable-reason");
        assert.equal(await reason.isVisible(), true);
        assert.match(await reason.textContent(), /リアルタイム表示では統計分析を利用できません/);
        assert.equal(await page.locator("#map-mobile-sheet").evaluate(node => node.scrollWidth - node.clientWidth), 0);
        assert((await page.locator(".map-mobile-tool-grid").getByRole("button", { name: "データの出典", exact: true }).boundingBox()).height <= 60);
        if ([1, 17].includes(number)) await page.locator("#map-mobile-sheet").screenshot({ path: path.join(output, `${width}-${number}.png`) });
        await page.locator("[data-mobile-sheet-close]").click();
      } else {
        const button = page.locator(".gaia-map-action--analysis:visible");
        assert.equal(await button.isDisabled(), true);
        await button.hover();
        const tip = page.locator("#map-analysis-unavailable-tooltip");
        assert.equal(await tip.isVisible(), true);
        assert.match(await tip.textContent(), /リアルタイム表示では統計分析を利用できません/);
        const bounds = await tip.boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 900);
        const box = await button.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await button.focus(); await button.press("Enter"); await button.press("Space");
        await button.evaluate(node => node.click());
        assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().open), false);
        if ([1, 17].includes(number)) await page.screenshot({ path: path.join(output, `${width}-${number}.png`) });
        await page.keyboard.press("Escape");
        assert.equal(await tip.isVisible(), false);
        await button.evaluate(node => node.blur());
        await page.mouse.move(0, 0);
      }
      assert.equal(await page.evaluate(() => window.analysisOpenCalls), 0);
      report.checks.push({ width, number, disabled: true, reason: true });
    }
    // Annual prefecture data keeps its existing usable analysis entry point.
    await page.evaluate(() => { GaiaMapCategories.buttons()[20].click(); GaiaLiveExhibits.pausePoiAutoplay(); });
    if (width < 900) {
      await page.locator('[data-mobile-sheet="tools"]').click();
      const button = page.locator(".map-mobile-tool-grid").getByRole("button", { name: "統計分析", exact: true });
      assert.equal(await button.isEnabled(), true);
      assert.equal(await page.locator("#map-mobile-analysis-unavailable-reason").count(), 0);
      await button.click();
    } else await page.locator(".gaia-map-action--analysis:visible").click();
    await page.waitForFunction(() => GaiaStatisticsLab.getState().open && GaiaStatisticsLab.getState().analysisReady);
    report.checks.push({ width, number: 21, historicalAnalysisPreserved: true });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(`Realtime analysis policy: ${report.checks.length} desktop/mobile checks passed.`);
