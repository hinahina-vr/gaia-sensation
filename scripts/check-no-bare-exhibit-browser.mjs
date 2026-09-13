import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4417"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) {
  throw new Error("Playwright module root and browser executable are required");
}

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/no-bare-exhibit-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true, reduced: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
      reducedMotion: viewport.reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      localStorage.setItem("gaia-senseware-opening-seen", "1");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    const goto = async (hash) => {
      await page.goto(new URL(`/?preview=no-bare-${Date.now()}${hash}`, baseUrl).href, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
      await page.waitForFunction(() => !document.documentElement.classList.contains("gaia-booting"));
    };
    const readSurface = () => page.evaluate(() => {
      const visible = (element) => {
        if (!element || element.hidden || element.closest("[hidden]")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0
          && rect.width > 0
          && rect.height > 0;
      };
      const introLayer = document.querySelector("#intro-layer");
      const introStyle = introLayer ? getComputedStyle(introLayer) : null;
      const introRect = introLayer?.getBoundingClientRect();
      const intro = visible(introLayer);
      const map = visible(document.querySelector("#japan-layer"));
      const source = document.querySelector(".experience")?.classList.contains("source-open") || false;
      const concept = document.querySelector(".experience")?.classList.contains("concept-open") || false;
      const novel = document.body.classList.contains("novel-open");
      const space = document.body.classList.contains("space-open");
      const opening = visible(document.querySelector("#gaia-opening"));
      const storyDetour = Boolean(document.querySelector(".experience")?.dataset.storyMode);
      return {
        intro,
        map,
        source,
        concept,
        novel,
        space,
        opening,
        storyDetour,
        bare: !intro && !map && !source && !concept && !novel && !space && !opening && !storyDetour,
        introDebug: {
          bodyClassName: document.body.className,
          experienceClassName: document.querySelector(".experience")?.className,
          experienceVisibility: document.querySelector(".experience")
            ? getComputedStyle(document.querySelector(".experience")).visibility
            : undefined,
          hidden: introLayer?.hidden,
          ariaHidden: introLayer?.getAttribute("aria-hidden"),
          className: introLayer?.className,
          display: introStyle?.display,
          visibility: introStyle?.visibility,
          opacity: introStyle?.opacity,
          width: introRect?.width,
          height: introRect?.height,
        },
      };
    });
    const assertIntro = async (label) => {
      await page.waitForFunction(() => {
        const layer = document.querySelector("#intro-layer");
        return layer && !layer.hidden && layer.getAttribute("aria-hidden") === "false";
      });
      await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning"));
      const surface = await readSurface();
      assert.equal(
        surface.intro,
        true,
        `${viewport.name}/${label}: GAIA SENSEWARE menu is not visible: ${JSON.stringify(surface.introDebug)}`,
      );
      assert.equal(surface.bare, false, `${viewport.name}/${label}: bare BREATHING EARTH screen was exposed`);
      report.scans.push({ viewport: viewport.name, label, surface });
    };

    await goto("#earth");
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.locator("#japan-close").click();
    await assertIntro("map-close-button");

    await goto("#earth");
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.keyboard.press("Escape");
    await assertIntro("map-escape");

    await page.keyboard.press("Escape");
    await assertIntro("intro-escape");

    await goto("#source");
    await page.locator("#source-close").click();
    await assertIntro("source-close");

    await goto("#concept");
    await page.locator("#concept-close").click();
    await assertIntro("concept-close");

    await goto("#earth");
    await page.evaluate(() => { window.location.hash = ""; });
    await assertIntro("empty-hash");
    await page.screenshot({
      path: path.join(outputDir, `${viewport.name}-gaia-senseware-return.png`),
      fullPage: false,
      animations: "disabled",
    });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, [], "console errors were emitted");
  assert.deepEqual(report.pageErrors, [], "page errors were emitted");
  assert.deepEqual(report.responses404, [], "404 responses were observed");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error?.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
