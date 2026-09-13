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
const outputDir = path.resolve(outputArgument || "artifacts/intro-scrollbar-browser");
fs.mkdirSync(outputDir, { recursive: true });

const allViewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const viewports = process.env.GAIA_VIEWPORT
  ? allViewports.filter(({ name }) => name === process.env.GAIA_VIEWPORT)
  : allViewports;
if (viewports.length === 0) throw new Error(`Unknown GAIA_VIEWPORT: ${process.env.GAIA_VIEWPORT}`);
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const openFreeExploration = async (page) => {
  await page.addInitScript(() => {
    globalThis.__qaVisible = (element) => {
      if (!element || element.hidden || element.closest("[hidden]")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
  });
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-sound-modal")));
  await page.locator("#gaia-opening-sound-off").click();
  await page.waitForFunction(() => !__qaVisible(document.querySelector("#gaia-opening-sound-modal")));
  await page.waitForFunction(() => !document.querySelector("#gaia-opening")?.classList.contains("is-preloading"), null, { timeout: 10_000 });
  await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-skip")));
  await page.locator("#gaia-opening-skip").click();
  await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-route-other")));
  await page.locator("#gaia-opening-route-other").click();
  await page.waitForFunction(() => __qaVisible(document.querySelector("#intro-path-stage")), null, { timeout: 10_000 });
  await page.waitForFunction(() => document.querySelector("#gaia-opening")?.hidden === true, null, { timeout: 10_000 });
};

const scan = (page) => page.evaluate(() => {
  const layer = document.querySelector("#intro-layer");
  const style = getComputedStyle(layer);
  const rect = layer.getBoundingClientRect();
  const titleRect = document.querySelector("#intro-title-return")?.getBoundingClientRect();
  const audioRect = document.querySelector("#gaia-audio-dock")?.getBoundingClientRect();
  return {
    overflowY: style.overflowY,
    scrollbarWidth: style.scrollbarWidth,
    scrollbarColor: style.scrollbarColor,
    scrollbarGutter: style.scrollbarGutter,
    reservedWidth: layer.offsetWidth - layer.clientWidth,
    scrollTop: layer.scrollTop,
    scrollMax: layer.scrollHeight - layer.clientHeight,
    rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
    overflowX: Math.max(0, layer.scrollWidth - layer.clientWidth),
    documentOverflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    titleTop: titleRect?.top,
    audioTop: audioRect?.top,
    titleLeft: titleRect?.left,
    audioRightGap: audioRect ? innerWidth - audioRect.right : null,
  };
});

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await openFreeExploration(page);
    const initial = await scan(page);
    assert.equal(initial.overflowY, "scroll", `${viewport.name}: vertical scrollbar is not persistent`);
    assert.equal(initial.scrollbarWidth, "auto", `${viewport.name}: scrollbar is still hidden or reduced to an overlay`);
    assert.match(initial.scrollbarColor, /rgba?\(/u, `${viewport.name}: scrollbar has no visible color`);
    assert.match(initial.scrollbarGutter, /stable/u, `${viewport.name}: scrollbar gutter is not reserved`);
    assert(initial.reservedWidth >= 10, `${viewport.name}: scrollbar has no visible reserved width (${initial.reservedWidth})`);
    assert(initial.scrollMax > viewport.height, `${viewport.name}: free exploration is not scrollable`);
    assert.equal(initial.overflowX, 0);
    assert.equal(initial.documentOverflowX, 0);
    assert(Math.abs(initial.titleTop - initial.audioTop) <= 1, `${viewport.name}: title return and audio control are not vertically aligned`);
    assert(Math.abs(initial.titleLeft - initial.audioRightGap) <= 1, `${viewport.name}: audio control does not mirror the title return edge inset`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-top.png`) });

    await page.locator("#intro-layer").hover({ position: { x: 40, y: Math.min(500, viewport.height - 80) } });
    await page.mouse.wheel(0, Math.round(viewport.height * 0.8));
    await page.waitForFunction(() => document.querySelector("#intro-layer")?.scrollTop > 80);
    const scrolled = await scan(page);
    assert(scrolled.scrollTop > initial.scrollTop + 80, `${viewport.name}: wheel/touchpad scrolling did not move the page`);
    assert(scrolled.scrollTop < scrolled.scrollMax, `${viewport.name}: scrollbar skipped directly to the end`);
    assert.equal(scrolled.overflowX, 0);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-scrolled.png`) });

    const legacyShell = await page.evaluate(() => ({
      status: Boolean(document.querySelector(".status")),
      guide: Boolean(document.querySelector(".guide")),
      caption: Boolean(document.querySelector(".mode-caption")),
      navigation: Boolean(document.querySelector(".mode-nav")),
      actions: Boolean(document.querySelector(".actions")),
    }));
    assert.deepEqual(legacyShell, {
      status: false,
      guide: false,
      caption: false,
      navigation: false,
      actions: false,
    }, `${viewport.name}: removed legacy exploration shell still exists`);

    await page.locator("#intro-title-return").click();
    await page.waitForFunction(() => __qaVisible(document.querySelector("#gaia-opening-final-menu")));
    await page.waitForFunction(() => document.querySelector("#intro-layer")?.hidden === true);
    const returnedToTitle = await page.evaluate(() => ({
      openingVisible: __qaVisible(document.querySelector("#gaia-opening")),
      finalMenuVisible: __qaVisible(document.querySelector("#gaia-opening-final-menu")),
      introVisible: __qaVisible(document.querySelector("#intro-layer")),
      runtimeBridgeVisible: __qaVisible(document.querySelector("#exploration-runtime-bridge")),
    }));
    assert.deepEqual(returnedToTitle, {
      openingVisible: true,
      finalMenuVisible: true,
      introVisible: false,
      runtimeBridgeVisible: false,
    }, `${viewport.name}: title return exposed an obsolete or intermediate screen`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-returned-title.png`) });

    report.scans.push({ viewport: viewport.name, initial, scrolled, legacyShell, returnedToTitle, passed: true });
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

console.log(`Intro scrollbar browser check passed: ${report.scans.length} viewports`);
