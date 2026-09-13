import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/title-brand-browser");
fs.mkdirSync(outputDir, { recursive: true });

const TITLE_COPY = "惑星の放課後 — GAIA SENSATION";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900, background: "/assets/visuals-07/novel-title-keyvisual-v3.png" },
  { name: "mobile-390", width: 390, height: 844, background: "/assets/visuals-07/novel-title-keyvisual-mobile-v1.png" },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const primeUnlockedTitle = (context) => context.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("gaia-senseware-bgm-volume", "0");
  localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", new Date().toISOString());
});

const decodeImage = (page, source) => page.evaluate(async (imageSource) => {
  const image = new Image();
  image.src = imageSource;
  if (!image.complete) {
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
    });
  }
  await image.decode?.();
}, source);

const assertRenderedRect = (value, label) => {
  assert.ok(value && value.width > 0 && value.height > 0, `${label} has no rendered area`);
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "no-preference",
    });
    await primeUnlockedTitle(context);
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.locator("#novel-title-screen").waitFor({ state: "visible" });
    await page.locator("#gaia-boot").waitFor({ state: "hidden" });
    await decodeImage(page, viewport.background);
    await page.evaluate(() => document.fonts.ready);

    const scan = await page.evaluate(() => {
      const screen = document.querySelector("#novel-title-screen");
      const title = document.querySelector("#novel-title");
      const logo = title?.querySelector("img");
      const actions = document.querySelector(".novel-title-actions");
      const rect = (node) => {
        const value = node?.getBoundingClientRect();
        return value ? { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height } : null;
      };
      return {
        documentTitle: document.title,
        storyTitle: globalThis.GAIA_NOVEL_STORY?.title || "",
        storySubtitle: globalThis.GAIA_NOVEL_STORY?.subtitle || "",
        logoAlt: logo?.getAttribute("alt") || "",
        logoDisplay: logo ? getComputedStyle(logo).display : "",
        logoComplete: logo instanceof HTMLImageElement ? logo.complete : false,
        logoNaturalWidth: logo instanceof HTMLImageElement ? logo.naturalWidth : 0,
        logoCurrentSrc: logo instanceof HTMLImageElement ? logo.currentSrc : "",
        screen: rect(screen),
        logo: rect(logo),
        actions: rect(actions),
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
        viewport: { width: innerWidth, height: innerHeight },
      };
    });

    assert.equal(scan.documentTitle, TITLE_COPY, `${viewport.name}: browser title`);
    assert.equal(scan.storyTitle, "惑星の放課後", `${viewport.name}: story title metadata`);
    assert.equal(scan.storySubtitle, "GAIA SENSATION", `${viewport.name}: story subtitle metadata`);
    assert.equal(scan.logoAlt, TITLE_COPY, `${viewport.name}: logo alternative text`);
    assert.equal(scan.logoDisplay, "block", `${viewport.name}: logo is not a block`);
    assert.equal(scan.logoComplete, true, `${viewport.name}: logo did not finish loading`);
    assert.match(scan.logoCurrentSrc, /brand-logo-dark-surface-(?:590|1180)\.webp$/u, `${viewport.name}: unexpected logo source`);
    assertRenderedRect(scan.screen, `${viewport.name}: title screen`);
    assertRenderedRect(scan.logo, `${viewport.name}: logo`);
    assertRenderedRect(scan.actions, `${viewport.name}: title controls`);
    assert.ok(scan.logoNaturalWidth >= scan.logo.width - 1, `${viewport.name}: logo source is undersized for its rendered width`);
    assert.ok(scan.logo.left >= scan.screen.left && scan.logo.right <= scan.screen.right, `${viewport.name}: logo is clipped horizontally`);
    assert.ok(scan.logo.top >= scan.screen.top && scan.logo.bottom <= scan.actions.top, `${viewport.name}: logo overlaps title controls`);
    assert.ok(scan.screen.left >= 0 && scan.screen.right <= scan.viewport.width, `${viewport.name}: title lockup is clipped horizontally`);
    assert.ok(scan.actions.bottom <= scan.viewport.height, `${viewport.name}: title actions are clipped vertically`);
    assert.equal(scan.overflowX, 0, `${viewport.name}: horizontal overflow`);
    assert.equal(scan.overflowY, 0, `${viewport.name}: vertical overflow`);

    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`) });
    report.scans.push({ viewport: viewport.name, ...scan, passed: true });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Title brand browser check passed: ${report.scans.length} viewports`);
