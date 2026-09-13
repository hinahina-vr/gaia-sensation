import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4417"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/mobile-exhibit-space");
fs.mkdirSync(outputDir, { recursive: true });
const allowIssues = process.env.GAIA_ALLOW_MOBILE_ISSUES === "1";

const viewports = [
  { name: "portrait-360x800", width: 360, height: 800 },
  { name: "portrait-390x844", width: 390, height: 844 },
  { name: "portrait-430x932", width: 430, height: 932 },
  { name: "landscape-844x390", width: 844, height: 390 },
];
const requestedViewports = new Set(String(process.env.GAIA_MOBILE_EXHIBIT_VIEWPORTS || "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean));
const selectedViewports = requestedViewports.size
  ? viewports.filter(({ name }) => requestedViewports.has(name))
  : viewports;
if (!selectedViewports.length) throw new Error("No requested mobile exhibit viewport matched");

const report = {
  status: "running",
  baseUrl,
  scans: [],
  issues: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--disable-background-networking"],
});

const addDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!text.includes("status of 401")) report.consoleErrors.push(`${label}: ${text}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
};

const boot = async (viewport) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  await context.addInitScript(() => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
    localStorage.setItem("gaiaSensewareTourSeen:v1", "true");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(60_000);
  addDiagnostics(page, viewport.name);
  await page.goto(new URL("/?mode=1", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof globalThis.GaiaModeLoader?.load === "function");
  await page.evaluate(() => globalThis.GaiaModeLoader.load("exploration"));
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
  await page.waitForFunction(() => document.querySelectorAll("#japan-mode-list .map-mode-button").length === 15);
  await page.evaluate(() => {
    for (const selector of ["#gaia-opening", "#intro-layer", "#novel-layer", "#true-end-layer"]) {
      const layer = document.querySelector(selector);
      if (!layer) continue;
      layer.hidden = true;
      layer.inert = true;
      layer.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("gaia-opening-active", "opening-active", "intro-open");
    document.querySelector(".experience")?.classList.remove("intro-open");
  });
  if (await page.locator("#japan-layer").getAttribute("aria-hidden") !== "false") {
    await page.locator("#japan-button").click({ force: true });
  }
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
  await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning"));
  await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent("gaia:opening-complete")));
  await page.waitForTimeout(220);
  return { context, page };
};

const expandBank = async (page) => {
  const toggle = page.locator("#map-mobile-bank-toggle");
  if (await toggle.count() && await toggle.getAttribute("aria-expanded") !== "true") {
    if (!await toggle.isVisible()) {
      const debug = await toggle.evaluate((node) => ({
        innerWidth,
        innerHeight,
        mediaWidth: matchMedia("(max-width: 720px)").matches,
        mediaCoarse: matchMedia("(pointer: coarse)").matches,
        display: getComputedStyle(node).display,
        visibility: getComputedStyle(node).visibility,
        opacity: getComputedStyle(node).opacity,
        rect: node.getBoundingClientRect().toJSON(),
        bank: node.closest(".map-mode-bank")?.getBoundingClientRect().toJSON(),
        bankStyle: node.closest(".map-mode-bank") ? {
          display: getComputedStyle(node.closest(".map-mode-bank")).display,
          visibility: getComputedStyle(node.closest(".map-mode-bank")).visibility,
          opacity: getComputedStyle(node.closest(".map-mode-bank")).opacity,
        } : null,
        stylesheets: [...document.styleSheets].map((sheet) => sheet.href).filter(Boolean),
      }));
      throw new Error(`Mobile bank toggle is not visible: ${JSON.stringify(debug)}`);
    }
    await toggle.click();
  }
};

const selectExhibit = async (page, index) => {
  await expandBank(page);
  const list = "#japan-mode-list";
  const button = index >= 9
    ? page.locator(`${list} .map-mode-button[data-live-exhibit]`).nth(index - 9)
    : page.locator(`${list} .map-mode-button:not([data-live-exhibit])`).nth(index);
  await button.evaluate((element) => element.click());
  try {
    await page.waitForFunction(() => (document.querySelector(".map-mode-bank")?.dataset.mapSurface || "map") === "map");
  } catch (error) {
    const debug = await page.evaluate(({ selector, itemIndex }) => ({
      activeSurface: document.querySelector(".map-mode-bank")?.dataset.mapSurface || "map",
      experienceClasses: document.querySelector(".experience")?.className || "",
      layerClasses: document.querySelector("#japan-layer")?.className || "",
      layerHidden: document.querySelector("#japan-layer")?.getAttribute("aria-hidden") || "",
      selectedButton: document.querySelectorAll(`${selector} .map-mode-button`)[itemIndex]?.outerHTML || "",
    }), { selector: list, itemIndex: index });
    throw new Error(`Exhibit surface did not switch: ${JSON.stringify(debug)}`, { cause: error });
  }
  const expected = String(index + 1).padStart(2, "0");
  if (index >= 9) {
    await page.waitForFunction((number) => document.querySelector(".japan-layer")?.classList.contains("is-live-exhibit")
      && document.querySelector("#japan-mode-number")?.textContent?.trim() === number, expected);
    await page.waitForFunction(() => document.querySelector(".gaia-live-exhibit-readout")?.getClientRects().length > 0);
  } else {
    await page.waitForFunction((number) => document.querySelector("#japan-mode-number")?.textContent?.trim() === number
      && document.querySelector(".map-mode-bank")?.dataset.lightIntegration === "mode-matched"
      && document.querySelector("#gaia-canvas")?.dataset.integratedMapMode === number, expected);
    if (index === 0) {
      await page.waitForFunction(() => !document.querySelector(".signal-console-map [data-signal-value]")?.textContent?.includes("LOADING"));
    }
  }
  await page.waitForTimeout(120);
};

const inspect = (page) => page.evaluate(() => {
  const visible = (node) => {
    if (!node || node.hidden || node.closest("[hidden]")) return false;
    const closedDetails = node.closest("details:not([open])");
    if (closedDetails && !node.matches("summary") && !node.closest("summary")) return false;
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.02
      && box.width > 1 && box.height > 1;
  };
  const box = (selector) => {
    const node = document.querySelector(selector);
    return visible(node) ? node.getBoundingClientRect().toJSON() : null;
  };
  const controls = [...document.querySelectorAll("#japan-layer button, #japan-layer summary, #gaia-audio-toggle")]
    .filter(visible)
    .map((node) => {
      let ancestor = node.parentElement;
      let scrollReachable = false;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        if (["auto", "scroll"].includes(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) {
          const clip = ancestor.getBoundingClientRect();
          scrollReachable = clip.top >= -1 && clip.bottom <= innerHeight + 1;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      return {
        id: node.id || "",
        label: node.getAttribute("aria-label") || node.textContent?.trim().replace(/\s+/gu, " ").slice(0, 60) || node.tagName,
        rect: node.getBoundingClientRect().toJSON(),
        scrollReachable,
      };
    });
  const sampleXs = [0.12, 0.27, 0.42, 0.58, 0.73, 0.88];
  const sampleYs = [0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88];
  const samples = [];
  for (const xr of sampleXs) {
    for (const yr of sampleYs) {
      const x = Math.round(innerWidth * xr);
      const y = Math.round(innerHeight * yr);
      const target = document.elementFromPoint(x, y);
      const surface = Boolean(target?.closest?.("#japan-map, #gaia-canvas, #gaia-live-exhibit-canvas"));
      samples.push({ x, y, surface, target: target?.id || target?.className || target?.tagName || "" });
    }
  }
  const toggle = document.querySelector("#map-mobile-bank-toggle");
  const liveToggle = document.querySelector("#gaia-live-mobile-toggle");
  return {
    viewport: { width: innerWidth, height: innerHeight },
    surface: document.querySelector(".map-mode-bank")?.dataset.mapSurface || "",
    mode: document.querySelector("#japan-mode-number")?.textContent?.trim() || "",
    isLive: document.querySelector(".japan-layer")?.classList.contains("is-live-exhibit") || false,
    hasIntegratedLight: document.querySelector(".japan-layer")?.classList.contains("has-integrated-map-light") || false,
    bankExpanded: toggle ? toggle.getAttribute("aria-expanded") === "true" : true,
    infoExpanded: document.querySelector("#map-mobile-heading-toggle")?.getAttribute("aria-expanded") === "true",
    liveExpanded: liveToggle?.getAttribute("aria-expanded") === "true",
    guideOpen: document.querySelector("#map-reading-guide")?.open || false,
    retiredReceiptCount: document.querySelectorAll(".gaia-live-receipt, [data-gaia-live-receipt]").length,
    usableSamples: samples.filter((sample) => sample.surface).length,
    totalSamples: samples.length,
    usableRatio: samples.filter((sample) => sample.surface).length / samples.length,
    blockedSamples: samples.filter((sample) => !sample.surface),
    rects: {
      heading: box(".japan-heading"),
      signal: box(".signal-console-map"),
      guide: box("#map-reading-guide"),
      bank: box(".map-mode-bank"),
      readout: box(".gaia-live-exhibit-readout"),
      map: box("#japan-map"),
    },
    controls,
  };
});

const review = (viewport, label, scan) => {
  const minimumRatio = viewport.width > viewport.height ? 0.42 : 0.55;
  if (scan.usableRatio < minimumRatio) report.issues.push({ viewport: viewport.name, label, code: "insufficient-exhibit-space", minimumRatio, scan });
  if (scan.bankExpanded) report.issues.push({ viewport: viewport.name, label, code: "bank-not-collapsed", scan });
  if (scan.guideOpen) report.issues.push({ viewport: viewport.name, label, code: "guide-open-by-default", scan });
  if (scan.retiredReceiptCount) report.issues.push({ viewport: viewport.name, label, code: "retired-live-receipt-remains", scan });
  if (scan.isLive && !scan.liveExpanded && scan.rects.readout?.height > 210) {
    report.issues.push({ viewport: viewport.name, label, code: "live-readout-too-tall", scan });
  }
  const escaped = scan.controls.filter(({ rect, scrollReachable }) => !scrollReachable
    && (rect.left < -1 || rect.top < -1 || rect.right > viewport.width + 1 || rect.bottom > viewport.height + 1));
  if (escaped.length) report.issues.push({ viewport: viewport.name, label, code: "control-outside-viewport", escaped });
  const undersized = scan.controls.filter(({ id, rect }) => ![""].includes(id) && (rect.width < 43 || rect.height < 43));
  if (undersized.length) report.issues.push({ viewport: viewport.name, label, code: "undersized-touch-target", undersized });
};

const reviewDrawer = (viewport, label, scan, { require = [] } = {}) => {
  const escaped = scan.controls.filter(({ rect, scrollReachable }) => !scrollReachable
    && (rect.left < -1 || rect.top < -1 || rect.right > viewport.width + 1 || rect.bottom > viewport.height + 1));
  if (escaped.length) report.issues.push({ viewport: viewport.name, label, code: "drawer-control-outside-viewport", escaped });
  const undersized = scan.controls.filter(({ rect }) => rect.width < 43 || rect.height < 43);
  if (undersized.length) report.issues.push({ viewport: viewport.name, label, code: "drawer-touch-target", undersized });
  for (const selector of require) {
    const rect = scan.rects[selector];
    if (!rect) report.issues.push({ viewport: viewport.name, label, code: "drawer-content-missing", selector, scan });
  }
};

const captureDrawer = async (page, viewport, label, open, close, options = {}) => {
  await open();
  await page.waitForTimeout(80);
  const scan = await inspect(page);
  reviewDrawer(viewport, label, scan, options);
  report.scans.push({ viewport: viewport.name, label, drawer: true, ...scan });
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${label}.png`), animations: "disabled" });
  await close();
  await page.waitForTimeout(60);
};

try {
  for (const viewport of selectedViewports) {
    const { context, page } = await boot(viewport);
    for (let index = 0; index < 15; index += 1) {
      await selectExhibit(page, index);
      const label = `map-${String(index + 1).padStart(2, "0")}`;
      const scan = await inspect(page);
      review(viewport, label, scan);
      report.scans.push({ viewport: viewport.name, label, ...scan });
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${label}.png`), animations: "disabled" });
      if (index === 0) {
        await captureDrawer(
          page,
          viewport,
          "drawer-exhibit-info",
          () => page.locator("#map-mobile-heading-toggle").click(),
          () => page.locator("#map-mobile-heading-toggle").click(),
          { require: ["heading"] },
        );
        await captureDrawer(
          page,
          viewport,
          "drawer-exhibit-bank",
          () => page.locator("#map-mobile-bank-toggle").click(),
          () => page.locator("#map-mobile-bank-toggle").click(),
          { require: ["bank"] },
        );
        await captureDrawer(
          page,
          viewport,
          "drawer-reading-guide",
          () => page.locator("#map-reading-guide > summary").click(),
          () => page.locator("#map-reading-guide > summary").click(),
          { require: ["guide"] },
        );
        if (await page.locator("#map-mobile-legend-toggle").isVisible()) {
          await captureDrawer(
            page,
            viewport,
            "drawer-map-legend",
            () => page.locator("#map-mobile-legend-toggle").click(),
            () => page.locator("#map-mobile-legend-toggle").click(),
          );
        }
      }
      if (index === 8) {
        await captureDrawer(
          page,
          viewport,
          "drawer-live-exhibit-details",
          () => page.locator("#gaia-live-mobile-toggle").click(),
          () => page.locator("#gaia-live-mobile-toggle").click(),
          { require: ["readout"] },
        );
      }
    }
    await context.close();
  }
  report.status = report.issues.length || report.consoleErrors.length || report.pageErrors.length || report.responses404.length ? "issues" : "passed";
  if (!allowIssues) {
    assert.equal(report.issues.length, 0, `${report.issues.length} mobile exhibit layout issues`);
    assert.equal(report.consoleErrors.length, 0, "console errors detected");
    assert.equal(report.pageErrors.length, 0, "page errors detected");
    assert.equal(report.responses404.length, 0, "404 responses detected");
  }
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(JSON.stringify({
  status: report.status,
  scans: report.scans.length,
  issues: report.issues.length,
  consoleErrors: report.consoleErrors.length,
  pageErrors: report.pageErrors.length,
  responses404: report.responses404.length,
  outputDir,
}, null, 2));
