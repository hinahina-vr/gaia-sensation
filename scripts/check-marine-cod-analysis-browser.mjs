import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve("artifacts/marine-cod/analysis-final");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", environment: "Local Chrome, bundled MOE values, mobile emulation; unrelated live providers blocked", checks: [], errors: [],
  sha256: Object.fromEntries(["statistics-lab.js", "statistics-discovery.js", "statistics-data-insights.js", "statistics-game.css", "gaia-mode-loader.js", "src/exploration/marine-cod-exhibit.js"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 900 }, reducedMotion: "reduce" });
    await context.route("https://**", route => route.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
        if (this.canvas.id === "gaia-statistics-canvas" && /^202[0-4]$/.test(String(text))) {
          const labels = new Set((this.canvas.dataset.qaDrawnYears || "").split(",").filter(Boolean));
          labels.add(String(text)); this.canvas.dataset.qaDrawnYears = [...labels].sort().join(",");
        }
        return fillText.call(this, text, ...args);
      };
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?exhibit=31#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().count === 2042 && globalThis.GaiaStatisticsLab);
    await page.evaluate(() => GaiaMapDemo.stop());
    await page.locator("[data-cod-prefecture]").selectOption("13");
    await page.locator("[data-cod-station]").selectOption("1360101");
    if (width <= 900) {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.getByRole("button", { name: "統計分析", exact: true }).last().click();
    } else await page.locator("[data-cod-analysis]").click();
    await page.waitForFunction(() => document.querySelector("#gaia-statistics-canvas").dataset.pointCount === "5");
    const chart = page.locator("#gaia-statistics-canvas");
    assert.equal(await chart.getAttribute("data-qa-drawn-years"), "2020,2021,2022,2023,2024", "Actual canvas draw calls paint fiscal-year labels without fractions or thousands separators");
    await chart.focus(); await page.keyboard.press("Home");
    const tooltip = page.locator("#gaia-statistics-chart-tooltip");
    await tooltip.waitFor({ state: "visible" });
    assert.match(await tooltip.innerText(), /2020年度/);
    assert.match(await tooltip.innerText(), /3\.5/);
    await page.keyboard.press("End");
    assert.match(await tooltip.innerText(), /2024年度/);
    assert.match(await tooltip.innerText(), /3\.6/);
    const contrasts = await tooltip.evaluate(node => {
      const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).reduce((sum, value, index) => sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index], 0);
      const background = luminance(getComputedStyle(node).backgroundColor);
      return [...node.children].map(child => { const text = luminance(getComputedStyle(child).color); return (Math.max(text, background) + .05) / (Math.min(text, background) + .05); });
    });
    assert(contrasts.every(value => value >= 4.5), "Actual tooltip text contrasts with the light panel at 4.5:1 or more");
    await page.screenshot({ path: path.join(output, `${width}-chart.png`) });
    report.checks.push({ width, chartPoints: 5, drawnYears: "2020,2021,2022,2023,2024", actualEndpointTooltips: "2020 3.5 mg/L; 2024 3.6 mg/L", tooltipContrasts: contrasts });
    await context.close();
    console.log(`PASS ${width}: 5 actual COD chart points, integer fiscal-year labels, source-value keyboard tooltips`);
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
