import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4417", runLabel = "baseline"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and Chrome executable are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "E:/CodexData/temp/gaia-mobile-exhibit-audit", runLabel);
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "phone-360x800", width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: "phone-390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "phone-430x932", width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: "landscape-844x390", width: 844, height: 390, isMobile: true, hasTouch: true },
];
const requestedViewports = new Set(String(process.env.GAIA_MOBILE_AUDIT_VIEWPORTS || "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean));
const selectedViewports = requestedViewports.size
  ? viewports.filter(({ name }) => requestedViewports.has(name))
  : viewports;
if (!selectedViewports.length) throw new Error("No requested audit viewport matched");

const report = {
  status: "running",
  runLabel,
  baseUrl,
  outputDir,
  consoleErrors: [],
  pageErrors: [],
  unhandledRejections: [],
  responses404: [],
  selectionFallbacks: [],
  scans: [],
};

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
});

const attachDiagnostics = async (page, label) => {
  await page.addInitScript(() => {
    globalThis.__gaiaAuditUnhandledRejections = [];
    addEventListener("unhandledrejection", (event) => {
      globalThis.__gaiaAuditUnhandledRejections.push(String(event.reason?.stack || event.reason || "unknown rejection"));
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.stack || error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
};

const boot = async (viewport) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await attachDiagnostics(page, viewport.name);
  await page.goto(new URL("/#japan", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll("#japan-mode-list .map-mode-button").length === 15, null, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true", null, { timeout: 30_000 });
  return { context, page };
};

const ensureBankExpanded = async (page) => {
  const toggle = page.locator("#map-mobile-bank-toggle, [data-mobile-map-bank-toggle]").first();
  if (await toggle.count() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
};

const selectMapMode = async (page, index) => {
  await ensureBankExpanded(page);
  const button = page.locator("#japan-mode-list .map-mode-button").nth(index);
  const number = String(index + 1).padStart(2, "0");
  await button.click({ force: true });
  try {
    await page.waitForFunction(
      (expected) => document.querySelector("#japan-mode-number")?.textContent?.trim() === expected,
      number,
      { timeout: 1_200 },
    );
  } catch {
    report.selectionFallbacks.push(`map-${number}`);
    await button.evaluate((element) => element.click());
    await page.waitForFunction(
      (expected) => document.querySelector("#japan-mode-number")?.textContent?.trim() === expected,
      number,
      { timeout: 15_000 },
    );
  }
  if (index >= 9) {
    await page.waitForFunction(
      (expected) => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === String(expected),
      index - 9,
      { timeout: 15_000 },
    );
  } else {
    await page.waitForFunction((expected) => document.querySelector("#gaia-live-exhibit-canvas")?.hidden !== false
      && document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light")
      && document.querySelector("#gaia-canvas")?.dataset.integratedMapMode === expected, number, { timeout: 15_000 });
  }
  await page.waitForTimeout(180);
  return number;
};

const measureLayout = async (page, surface, number) => page.evaluate(({ activeSurface, activeNumber }) => {
  const viewport = { width: innerWidth, height: innerHeight };
  const selectors = [
    ".japan-map-actions",
    ".japan-heading",
    ".japan-observation",
    ".map-reading-guide",
    ".signal-console-map",
    ".signal-encoding-legend-dock",
    ".map-mode-bank",
    ".japan-layer-switch",
    ".japan-poi-card",
    ".japan-credits",
    ".gaia-live-exhibit-readout",
  ];
  const toRect = (rect) => ({
    x: Math.round(rect.x * 10) / 10,
    y: Math.round(rect.y * 10) / 10,
    width: Math.round(rect.width * 10) / 10,
    height: Math.round(rect.height * 10) / 10,
    right: Math.round(rect.right * 10) / 10,
    bottom: Math.round(rect.bottom * 10) / 10,
  });
  const isVisible = (element) => {
    if (!(element instanceof HTMLElement) || element.hidden) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.02 && rect.width > 1 && rect.height > 1;
  };
  const panels = selectors.flatMap((selector) => {
    const element = document.querySelector(`#japan-layer > ${selector}`) || document.querySelector(`#japan-layer ${selector}`);
    if (!isVisible(element)) return [];
    const rect = element.getBoundingClientRect();
    return [{ selector, rect: toRect(rect), pointerEvents: getComputedStyle(element).pointerEvents }];
  });
  const intersect = (a, b) => {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
    return Math.round(width * height);
  };
  const overlaps = [];
  for (let left = 0; left < panels.length; left += 1) {
    for (let right = left + 1; right < panels.length; right += 1) {
      const area = intersect(panels[left].rect, panels[right].rect);
      if (area > 36) overlaps.push({ a: panels[left].selector, b: panels[right].selector, area });
    }
  }
  const tapTargets = [...document.querySelectorAll("#japan-layer button, #japan-layer summary, #japan-layer input[type='range']")]
    .filter(isVisible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        target: element.id ? `#${element.id}` : element.classList.length ? `.${[...element.classList].join(".")}` : element.tagName.toLowerCase(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
  const undersizedTapTargets = tapTargets.filter(({ width, height }) => width < 44 || height < 44);
  const operationSurface = activeSurface === "light" ? document.querySelector("#gaia-canvas") : document.querySelector("#japan-map");
  const surfaceRect = operationSurface?.getBoundingClientRect();
  const samples = [];
  if (surfaceRect) {
    const left = Math.max(0, surfaceRect.left, innerWidth * 0.08);
    const right = Math.min(innerWidth, surfaceRect.right, innerWidth * 0.92);
    const top = Math.max(0, surfaceRect.top, innerHeight * 0.12);
    const bottom = Math.min(innerHeight, surfaceRect.bottom, innerHeight * 0.88);
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const x = left + (right - left) * ((column + 0.5) / 9);
        const y = top + (bottom - top) * ((row + 0.5) / 9);
        const hit = document.elementFromPoint(x, y);
        const surfaceHit = activeSurface === "light"
          ? hit === operationSurface || hit?.id === "gaia-canvas" || hit?.closest?.("#japan-map")
          : hit === operationSurface || operationSurface.contains(hit);
        samples.push({ x: Math.round(x), y: Math.round(y), surfaceHit, hit: hit?.id ? `#${hit.id}` : hit?.classList?.length ? `.${[...hit.classList].join(".")}` : hit?.tagName?.toLowerCase() || "none" });
      }
    }
  }
  const unobstructed = samples.filter((sample) => sample.surfaceHit).length;
  const centerHit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const operationSurfaceRect = surfaceRect ? toRect(surfaceRect) : null;
  const readout = document.querySelector(".gaia-live-exhibit-readout");
  const bank = document.querySelector(".map-mode-bank");
  return {
    surface: activeSurface,
    number: activeNumber,
    viewport,
    panels,
    overlaps,
    tapTargets,
    undersizedTapTargets,
    operationSurfaceRect,
    unobstructedSamples: unobstructed,
    totalSamples: samples.length,
    unobstructedRatio: samples.length ? Math.round((unobstructed / samples.length) * 1000) / 1000 : 0,
    centerHit: centerHit?.id ? `#${centerHit.id}` : centerHit?.classList?.length ? `.${[...centerHit.classList].join(".")}` : centerHit?.tagName?.toLowerCase() || "none",
    bankExpanded: bank?.querySelector("#map-mobile-bank-toggle, [data-mobile-map-bank-toggle]")?.getAttribute("aria-expanded") ?? "legacy",
    guideOpen: document.querySelector("#map-reading-guide")?.open ?? false,
    liveReadoutExpanded: readout?.querySelector("#gaia-live-mobile-toggle, [data-mobile-live-readout-toggle]")?.getAttribute("aria-expanded") ?? "legacy",
  };
}, { activeSurface: surface, activeNumber: number });

try {
  for (const viewport of selectedViewports) {
    const { context, page } = await boot(viewport);
    assert.equal(
      await page.locator(".gaia-live-receipt, [data-gaia-live-receipt]").count(),
      0,
      `${viewport.name}: retired LIVE receipt remains`,
    );
    const scan = { viewport, map: [], optionalUi: [], liveInteractions: [] };
    for (let index = 0; index < 15; index += 1) {
      const number = await selectMapMode(page, index);
      const metrics = await measureLayout(page, "map", number);
      const screenshot = path.join(outputDir, `${viewport.name}-map-${number}.png`);
      await page.screenshot({ path: screenshot, animations: "disabled" });
      scan.map.push({ screenshot, ...metrics });
      if (index >= 9) {
        const canvas = page.locator("#gaia-live-exhibit-canvas");
        assert.equal(await page.locator("[data-live-light-touch]").count(), 0, "Retired light-touch button remains");
        assert.deepEqual(await page.locator(".gaia-live-deck-actions strong").allTextContents(), ["データの出典", "統計分析"]);
        const beforeSurfaceTouch = Number(await canvas.getAttribute("data-light-touch-count") || 0);
        const openSurfacePoint = await page.evaluate(() => {
          const map = document.querySelector("#japan-map");
          if (!(map instanceof HTMLElement)) return null;
          for (let y = 80; y < innerHeight - 80; y += 18) {
            for (let x = 18; x < innerWidth - 18; x += 18) {
              const target = document.elementFromPoint(x, y);
              if (target === map || target?.closest?.("#japan-map")) return { x, y };
            }
          }
          return null;
        });
        assert(openSurfacePoint, `${viewport.name} map-${number}: no real pointer target remains on the live surface`);
        await page.mouse.click(openSurfacePoint.x, openSurfacePoint.y);
        await page.waitForFunction(
          (previous) => Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.lightTouchCount || 0) > previous,
          beforeSurfaceTouch,
        );
        if (index === 8) {
          assert.equal(await page.locator(".gaia-live-exhibit-readout [data-live-sound-toggle]").count(), 0);
          assert.equal(await page.evaluate(() => typeof globalThis.GaiaProceduralAudio), "undefined");
        }
        scan.liveInteractions.push({
          number,
          surfaceTouchCount: Number(await canvas.getAttribute("data-light-touch-count") || 0),
          surfacePoint: openSurfacePoint,
          generatedSound: "removed",
        });
      }
      if (index === 0) {
        const headingToggle = page.locator("#map-mobile-heading-toggle");
        await headingToggle.click();
        await page.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("is-mobile-heading-expanded"));
        assert.equal(await headingToggle.getAttribute("aria-expanded"), "true");
        assert.equal(await page.locator("#japan-description").isVisible(), true);
        assert.equal(await page.locator("#japan-data-button").isVisible(), true);
        const headingScreenshot = path.join(outputDir, `${viewport.name}-optional-heading-open.png`);
        await page.screenshot({ path: headingScreenshot, animations: "disabled" });
        scan.optionalUi.push({ control: "heading", screenshot: headingScreenshot });
        await headingToggle.click();
        await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-mobile-heading-expanded"));

        const guide = page.locator("#map-reading-guide");
        await guide.locator("summary").click();
        await page.waitForFunction(() => document.querySelector("#map-reading-guide")?.open === true);
        assert.equal(await guide.locator(".map-reading-guide-body").isVisible(), true);
        const guideScreenshot = path.join(outputDir, `${viewport.name}-optional-guide-open.png`);
        await page.screenshot({ path: guideScreenshot, animations: "disabled" });
        scan.optionalUi.push({ control: "guide", screenshot: guideScreenshot });
        await guide.locator("summary").click();
        await page.waitForFunction(() => document.querySelector("#map-reading-guide")?.open === false);

        const bankToggle = page.locator("#map-mobile-bank-toggle");
        await bankToggle.click();
        await page.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("is-mobile-bank-expanded"));
        const visibleMapButtons = page.locator("#japan-mode-list .map-mode-button:visible");
        assert.equal(await visibleMapButtons.count(), 15);
        const bankScreenshot = path.join(outputDir, `${viewport.name}-optional-bank-open.png`);
        await page.screenshot({ path: bankScreenshot, animations: "disabled" });
        scan.optionalUi.push({ control: "bank", screenshot: bankScreenshot });
        await visibleMapButtons.first().click();
        await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-mobile-bank-expanded"));
        assert.equal(await bankToggle.getAttribute("aria-expanded"), "false");
      }
      if (index === 2 && await page.locator("#map-mobile-legend-toggle").isVisible()) {
        const legendToggle = page.locator("#map-mobile-legend-toggle");
        await legendToggle.click();
        await page.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("is-mobile-legend-expanded"));
        assert.equal(await page.locator("#map-signal-encoding-legend-dock").isVisible(), true);
        const legendScreenshot = path.join(outputDir, `${viewport.name}-optional-legend-open.png`);
        await page.screenshot({ path: legendScreenshot, animations: "disabled" });
        scan.optionalUi.push({ control: "legend", screenshot: legendScreenshot });
        await legendToggle.click();
        await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-mobile-legend-expanded"));
      }
      if (index === 8) {
        const liveToggle = page.locator("#gaia-live-mobile-toggle");
        await liveToggle.click();
        await page.waitForFunction(() => document.querySelector(".gaia-live-exhibit-readout")?.classList.contains("is-mobile-expanded"));
        assert.equal(await page.locator(".gaia-live-exhibit-explanation").isVisible(), true);
        assert.equal(await page.locator(".gaia-live-exhibit-path").isVisible(), true);
        const liveScreenshot = path.join(outputDir, `${viewport.name}-optional-live-details-open.png`);
        await page.screenshot({ path: liveScreenshot, animations: "disabled" });
        scan.optionalUi.push({ control: "live-details", screenshot: liveScreenshot });
        await liveToggle.click();
        await page.waitForFunction(() => !document.querySelector(".gaia-live-exhibit-readout")?.classList.contains("is-mobile-expanded"));
      }
    }
    report.unhandledRejections.push(...(await page.evaluate(() => globalThis.__gaiaAuditUnhandledRejections || [])).map((message) => `${viewport.name}: ${message}`));
    report.scans.push(scan);
    await context.close();
    console.log(`AUDITED ${viewport.name}: 15 map exhibits with integrated light on 01—09`);
  }
  assert.equal(report.scans.length, selectedViewports.length);
  assert(report.scans.every((scan) => scan.map.length === 15));
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack || error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

if (report.consoleErrors.length || report.pageErrors.length || report.unhandledRejections.length || report.responses404.length) {
  report.status = "failed-diagnostics";
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}

console.log(JSON.stringify({
  status: report.status,
  outputDir,
  scans: report.scans.length,
  consoleErrors: report.consoleErrors.length,
  pageErrors: report.pageErrors.length,
  unhandledRejections: report.unhandledRejections.length,
  responses404: report.responses404.length,
  selectionFallbacks: report.selectionFallbacks.length,
}, null, 2));
