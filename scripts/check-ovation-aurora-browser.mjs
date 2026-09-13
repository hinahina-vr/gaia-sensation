import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] =
  process.argv.slice(2);
if (!moduleRoot || !executablePath) {
  throw new Error("Playwright module root and browser executable are required");
}
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/ovation-aurora-browser");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const checks = [];

try {
  for (const expectedSource of ["live", "snapshot"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    if (expectedSource === "snapshot") {
      await page.route("https://services.swpc.noaa.gov/**", (route) => route.abort());
    }

    await page.goto(new URL("/?mode=1#earth", baseUrl).href, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(() => {
      document.body.classList.remove("gaia-opening-active", "opening-active", "intro-open");
      for (const selector of ["#gaia-opening", "#intro-layer", "#novel-layer", "#true-end-layer"]) {
        const layer = document.querySelector(selector);
        if (!layer) continue;
        layer.hidden = true;
        layer.inert = true;
        layer.setAttribute("aria-hidden", "true");
      }
      window.dispatchEvent(new CustomEvent("gaia:opening-complete"));
    });
    await page.waitForFunction((source) => {
      const overlay = document.querySelector("#japan-overlay");
      return overlay?.dataset.auroraForecast === "ready"
        && overlay.dataset.auroraForecastSource === source
        && Number(overlay.dataset.auroraForecastPointCount) >= 80
        && Number(overlay.dataset.auroraForecastMaximum) > 0
        && /^\d{4}-\d{2}-\d{2}T/u.test(overlay.dataset.auroraForecastTime || "");
    }, expectedSource, { timeout: 20_000 });

    const state = await page.locator("#japan-overlay").evaluate((overlay) => ({
      status: overlay.dataset.auroraForecast,
      source: overlay.dataset.auroraForecastSource,
      pointCount: Number(overlay.dataset.auroraForecastPointCount),
      maximum: Number(overlay.dataset.auroraForecastMaximum),
      forecastTime: overlay.dataset.auroraForecastTime,
    }));
    assert.equal(state.source, expectedSource);
    checks.push(state);
    if (expectedSource === "live") {
      await page.locator("#japan-data-button").evaluate((button) => button.click());
      await page.waitForFunction(() =>
        document.querySelector("#japan-layer")?.classList.contains("japan-data-open"),
      );
      const firstSource = await page.locator(".data-ledger-card h3").first().textContent();
      assert.match(firstSource || "", /オーロラ/u);
    }
    await page.screenshot({
      path: path.join(outputDir, `${expectedSource}.png`),
      animations: "disabled",
    });
    await context.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.join(outputDir, "report.json"),
  `${JSON.stringify({ status: "passed", checks }, null, 2)}\n`,
  "utf8",
);
console.log("OVATION aurora browser check passed: live + bundled fallback");
