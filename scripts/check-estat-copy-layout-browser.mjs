import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", output = "artifacts/estat-copy-layout", widthsArgument = "3840,2560,1920,1600,1501,1500,1440,390", mode = "check"] = process.argv.slice(2);
const widths = widthsArgument.split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 2400 ? 1440 : width <= 720 ? 844 : 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?mode=30#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaEstatExhibits && globalThis.GaiaMapDemo && document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop();
    });
    await page.waitForTimeout(600);
    for (const number of mode === "record" ? [30] : [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]) {
      await page.evaluate(async number => {
        await GaiaEstatExhibits.select(number - 21);
        GaiaEstatExhibits.selectPrefecture(12);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, number);
      const result = await page.evaluate(() => {
        const readout = document.querySelector(".gaia-estat-readout"), copy = readout.querySelector(".gaia-estat-copy");
        const rect = node => node.getBoundingClientRect().toJSON();
        const visible = copy.getClientRects().length > 0 && getComputedStyle(copy).display !== "none";
        const texts = visible ? [...copy.querySelectorAll("p, small")].filter(node => !node.hidden).map(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          return { text: node.textContent, rect: rect(node), textRect: range.getBoundingClientRect().toJSON(), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, clamp: getComputedStyle(node).webkitLineClamp, whiteSpace: getComputedStyle(node).whiteSpace };
        }) : [];
        return { visible, readout: rect(readout), copy: rect(copy), texts,
          sections: [...readout.children].filter(node => node !== copy && getComputedStyle(node).display !== "none").map(node => rect(node)),
          timeline: rect(readout.querySelector("[data-estat-month]")),
          controls: [...readout.querySelectorAll("[data-estat-step], [data-estat-source-action], [data-estat-analysis]")].map(node => ({ rect: rect(node), visible: node.getClientRects().length > 0,
            textWidth: node.querySelector("strong")?.scrollWidth || 0, labelWidth: node.querySelector("strong")?.clientWidth || 0 })),
          overflowX: document.documentElement.scrollWidth - innerWidth };
      });
      report.checks.push({ width, number, ...result });
      if (mode !== "record") {
        assert(result.readout.bottom <= (width >= 2400 ? 1440 : width <= 720 ? 844 : 900) + 1);
        assert(result.overflowX <= 1, `${width}/${number}: page must not overflow horizontally`);
        if (width > 1500) {
          assert(result.visible, `${width}/${number}: explanation must be visible`);
          for (const item of result.texts) {
            assert.equal(item.clamp, "none", `${width}/${number}: explanation must not be line-clamped`);
            assert.equal(item.whiteSpace, "normal");
            assert(item.scrollHeight <= item.clientHeight + 1 && item.scrollWidth <= item.clientWidth + 1, `${width}/${number}: explanation must not be clipped`);
            assert(item.textRect.top >= result.readout.top - 1 && item.textRect.bottom <= result.copy.bottom + 1, `${width}/${number}: text must stay inside the dock`);
          }
          assert(result.controls.every(control => !control.visible || control.rect.top >= result.copy.bottom - 1), `${width}/${number}: copy must not overlap controls`);
          assert(result.controls.every(control => !control.visible || control.textWidth <= control.labelWidth + 1), `${width}/${number}: source/analysis labels must not be clipped`);
          result.sections.forEach((section, index) => {
            if (index) assert(section.left >= result.sections[index - 1].right - 1, `${width}/${number}: control columns must not overlap`);
          });
          assert(result.timeline.top >= result.copy.bottom && result.timeline.bottom <= result.readout.bottom, `${width}/${number}: the year slider must remain below the explanation and inside the viewport`);
        }
      }
      if (number === 30) await page.screenshot({ path: path.join(output, `${width}-rainy-days.png`) });
    }
    if (width <= 900 && mode !== "record") {
      await page.locator('[data-mobile-sheet="reading"]').click();
      await page.waitForTimeout(100);
      const reading = page.locator("#map-mobile-sheet");
      assert((await reading.textContent()).includes("実測海流や人の移動経路ではありません。"));
      assert((await reading.textContent()).includes("雨の頻度"));
      await page.screenshot({ path: path.join(output, `${width}-reading.png`) });
    }
    console.log(`PASS ${width}: ${mode === "record" ? "baseline captured" : "all ten explanations fit; controls remain reachable"}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = mode === "record" ? "recorded" : "passed";
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
