import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4196"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/character-preloader");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, mobile: true },
];
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    let delayedCharacterAssets = 0;
    await page.route(/character-mode\.(?:css|js)/u, async (route) => {
      delayedCharacterAssets += 1;
      await new Promise((resolve) => setTimeout(resolve, 650));
      await route.continue();
    });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof globalThis.GaiaModeLoader?.load === "function");
    await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
    await page.evaluate(() => {
      const opening = document.querySelector("#gaia-opening");
      opening.hidden = true;
      opening.inert = true;
      opening.setAttribute("aria-hidden", "true");
      document.body.classList.remove("gaia-opening-active");
      window.dispatchEvent(new CustomEvent("gaia:opening-complete"));
      document.querySelector("#intro-character-jump")?.click();
    });

    await page.waitForFunction(() => document.querySelector("#gaia-character-preloader")?.classList.contains("is-visible"));
    const loading = await page.evaluate(() => {
      const preloader = document.querySelector("#gaia-character-preloader");
      return {
        hidden: preloader.hidden,
        ariaHidden: preloader.getAttribute("aria-hidden"),
        status: preloader.querySelector("[data-character-preloader-status]")?.textContent.trim(),
        triggerBusy: document.querySelector("#intro-character-jump")?.getAttribute("aria-busy"),
      };
    });
    assert.deepEqual(loading, {
      hidden: false,
      ariaHidden: "false",
      status: "PORTRAIT DATA / CONNECTING",
      triggerBusy: "true",
    });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-loading.png`) });

    await page.waitForFunction(() => {
      const layer = document.querySelector("#character-book-layer");
      const image = document.querySelector("#character-book-image");
      return layer?.classList.contains("is-open")
        && ["ready", "error"].includes(layer.dataset.imageState || "")
        && image?.complete
        && image.naturalWidth > 0;
    }, null, { timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector("#gaia-character-preloader")?.hidden === true);
    const ready = await page.evaluate(() => ({
      preloaderHidden: document.querySelector("#gaia-character-preloader")?.hidden,
      triggerBusy: document.querySelector("#intro-character-jump")?.hasAttribute("aria-busy"),
      characterOpen: document.querySelector("#character-book-layer")?.classList.contains("is-open"),
      imageState: document.querySelector("#character-book-layer")?.dataset.imageState,
    }));
    assert(delayedCharacterAssets >= 2, `${viewport.name}: delayed character assets were not requested`);
    assert.deepEqual(ready, {
      preloaderHidden: true,
      triggerBusy: false,
      characterOpen: true,
      imageState: "ready",
    });
    report.scans.push({ viewport: viewport.name, delayedCharacterAssets, loading, ready });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({ status: report.status, scans: report.scans.length, outputDir }, null, 2));
