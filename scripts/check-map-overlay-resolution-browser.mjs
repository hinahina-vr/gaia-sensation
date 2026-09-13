import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4325"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/map-overlay-resolution");
fs.mkdirSync(outputDir, { recursive: true });

const profiles = [
  {
    name: "pc-native",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    memory: 16,
    cores: 12,
    saveData: false,
    expectedTier: "native",
    expectedRatio: 2,
  },
  {
    name: "mobile-native",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    memory: 8,
    cores: 8,
    saveData: false,
    expectedTier: "native",
    expectedRatio: 3,
  },
  {
    name: "mobile-balanced",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    memory: 6,
    cores: 6,
    saveData: false,
    expectedTier: "balanced",
    expectedRatio: 2,
  },
  {
    name: "mobile-compact",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    memory: 4,
    cores: 4,
    saveData: true,
    expectedTier: "compact",
    expectedRatio: 1,
  },
];

const report = {
  status: "running",
  baseUrl,
  profiles: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: Boolean(profile.isMobile),
      hasTouch: Boolean(profile.hasTouch),
      reducedMotion: "reduce",
      colorScheme: "dark",
    });
    await context.addInitScript(({ memory, cores, saveData }) => {
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => memory });
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => cores });
      const connection = navigator.connection || {};
      Object.defineProperty(connection, "saveData", { configurable: true, get: () => saveData });
      if (!navigator.connection) {
        Object.defineProperty(navigator, "connection", { configurable: true, get: () => connection });
      }
    }, profile);

    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${profile.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${profile.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${profile.name}: ${response.url()}`);
    });

    await page.goto(new URL("/?mode=1", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => typeof window.GaiaModeLoader?.load === "function");
    await page.evaluate(() => window.GaiaModeLoader.load("exploration"));
    await page.waitForFunction(() => window.GaiaAppContent?.modes?.length === 9);
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(() => {
      document.body.classList.remove("gaia-opening-active");
      for (const selector of ["#gaia-opening", "#intro-layer", "#novel-layer", "#true-end-layer"]) {
        const layer = document.querySelector(selector);
        if (!layer) continue;
        layer.hidden = true;
        layer.inert = true;
        layer.setAttribute("aria-hidden", "true");
      }
      document.querySelector(".experience")?.classList.remove("intro-open");
    });
    await page.locator("#japan-button").click({ force: true });
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.waitForFunction(() => document.querySelector("#scene-transition")?.hidden
      && !document.body.classList.contains("scene-transitioning"));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("gaia:opening-complete")));
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.renderPixelRatio) >= 1);
    await page.locator("#japan-mode-list .map-mode-button").nth(3).click({ force: true });
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.recyclingEncoding === "country-choropleth");

    const observed = await page.evaluate(() => {
      const canvas = document.querySelector("#japan-overlay");
      const rect = canvas.getBoundingClientRect();
      return {
        tier: canvas.dataset.renderQuality,
        ratio: Number(canvas.dataset.renderPixelRatio),
        deviceRatio: Number(canvas.dataset.devicePixelRatio),
        bitmapWidth: canvas.width,
        bitmapHeight: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        coarsePointer: matchMedia("(pointer: coarse)").matches,
        memory: navigator.deviceMemory,
        cores: navigator.hardwareConcurrency,
        saveData: navigator.connection?.saveData === true,
      };
    });

    assert.equal(observed.tier, profile.expectedTier, `${profile.name}: unexpected quality tier`);
    assert(Math.abs(observed.ratio - profile.expectedRatio) <= 0.02, `${profile.name}: unexpected canvas ratio ${observed.ratio}`);
    assert(observed.ratio >= 1, `${profile.name}: canvas must never be enlarged from below CSS resolution`);
    assert(Math.abs(observed.deviceRatio - profile.deviceScaleFactor) <= 0.01, `${profile.name}: device DPR mismatch`);
    assert(Math.abs(observed.bitmapWidth / observed.cssWidth - observed.ratio) <= 0.02, `${profile.name}: bitmap width mismatch`);
    assert(Math.abs(observed.bitmapHeight / observed.cssHeight - observed.ratio) <= 0.02, `${profile.name}: bitmap height mismatch`);

    const screenshot = path.join(outputDir, `${profile.name}.png`);
    await page.screenshot({ path: screenshot, animations: "disabled" });
    report.profiles.push({ name: profile.name, expectedTier: profile.expectedTier, observed, screenshot });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`map overlay resolution passed: ${report.profiles.length} device profiles`);
} finally {
  await browser.close();
}
