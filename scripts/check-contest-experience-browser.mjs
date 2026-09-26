import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";
import { ENTRY_BUDGET_BYTES, assertEntryBudget } from "./lib/contest-entry-budget.mjs";
import { MARINE_COD_EXHIBIT } from "../src/exploration/marine-cod-catalog.js";
import { JAPAN_SENSOR_OPEN_EXHIBITS } from "../src/exploration/japan-sensor-open-catalog.js";
import { JAPAN_POLLUTION_EXHIBITS } from "../src/exploration/japan-pollution-catalog.js";
import { PRTR_BIOLOGY_EXHIBITS } from "../src/exploration/prtr-biology-catalog.js";
import { FOOD_EXHIBITS } from "../src/exploration/food-catalog.js";

const expectedExhibitCount = Math.max(...[MARINE_COD_EXHIBIT, ...JAPAN_SENSOR_OPEN_EXHIBITS, ...JAPAN_POLLUTION_EXHIBITS, ...PRTR_BIOLOGY_EXHIBITS, ...FOOD_EXHIBITS].map(exhibit => Number(exhibit.number)));

const rawArguments = process.argv.slice(2);
const option = (name) => {
  const index = rawArguments.indexOf(name);
  return index >= 0 ? rawArguments[index + 1] : undefined;
};
const legacyArguments = rawArguments[0] && !rawArguments[0].startsWith("--") ? rawArguments : [];
const executablePath = option("--browser") || process.env.GAIA_BROWSER_PATH || legacyArguments[1];
const outputArgument = option("--output") || legacyArguments[2];
const baseUrlArgument = option("--base-url") || legacyArguments[3];
const minimumFrameRate = Number(option("--min-fps") || 55);
if (!executablePath) throw new Error("A real Google Chrome executable is required via --browser or GAIA_BROWSER_PATH");
if (!Number.isFinite(minimumFrameRate) || minimumFrameRate <= 0 || minimumFrameRate > 240) throw new Error("--min-fps must be between 0 and 240");
const outputDir = path.resolve(outputArgument || "artifacts/contest-experience-browser");
fs.mkdirSync(outputDir, { recursive: true });
const report = { status: "running", performance: null, layouts: [], entry: {}, tour: {}, resilience: {}, consoleErrors: [], pageErrors: [], unhandledRejections: [], responses404: [] };
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"], [".png", "image/png"], [".webp", "image/webp"], [".mp3", "audio/mpeg"], [".woff2", "font/woff2"]]);
let qaServer = null;
const startLocalServer = () => new Promise((resolve) => {
  qaServer = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
    const relative = pathname === "/" || pathname === "/story" || pathname === "/story/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.resolve(sourceRoot, relative);
    if (file !== sourceRoot && !file.startsWith(`${sourceRoot}${path.sep}`)) { response.writeHead(403).end(); return; }
    try {
      const body = fs.readFileSync(file);
      response.writeHead(200, { "Content-Type": mime.get(path.extname(file).toLowerCase()) || "application/octet-stream", "Cache-Control": "no-store", "Content-Length": body.length });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
  qaServer.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${qaServer.address().port}`));
});
const baseUrl = baseUrlArgument || await startLocalServer();

// The owner requested the map introduction on every entry, including reloads.
// Complete its real button flow before exercising the underlying map controls.
const completeMapEntry = async page => {
  await page.locator('#gaia-mode-entry-guide[data-mode="map"][data-phase="features"]').waitFor({ timeout: 60_000 });
  await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
  await page.evaluate(() => globalThis.GaiaMapDemo?.stop());
};

// The local QA server can be paused while a separate browser command is being
// scheduled. Wake it before opening a clean browser context so server-process
// scheduling is not counted as page LCP.
const warmupResponse = await fetch(new URL("/", baseUrl));
assert.equal(warmupResponse.ok, true, `QA server warmup ${warmupResponse.status}`);
await warmupResponse.arrayBuffer();

const monitor = (page, name, { allowExpectedAbort = false } = {}) => {
  page.setDefaultTimeout(30_000);
  if (!baseUrlArgument) {
    // Exercise bundled fallback data deterministically; this is not a live API test.
    void page.route(/^https:\/\/(?:api\.open-meteo\.com|services\.swpc\.noaa\.gov)\//, route =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: true, reason: "CI: upstream unavailable; use saved observations" }) }));
    report.networkMode = "Local server; Open-Meteo/NOAA unavailable-response fixtures and real bundled fallbacks";
  }
  page.on("requestfailed", request => {
    report.failedRequests ??= [];
    report.failedRequests.push({ name, url: request.url(), error: request.failure()?.errorText });
  });
  void page.addInitScript(() => {
    addEventListener("unhandledrejection", (event) => {
      const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
      console.error(`__GAIA_UNHANDLED_REJECTION__${reason}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (allowExpectedAbort && message.text().includes("net::ERR_FAILED")) return;
    if (message.text().startsWith("__GAIA_UNHANDLED_REJECTION__")) report.unhandledRejections.push(`${name}: ${message.text()}`);
    report.consoleErrors.push(`${name}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${name}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${name}: ${response.url()}`); });
};

const startBaseExposureProbe = (page, allowIntegratedMap = false) => page.evaluate((allowIntegratedMap) => {
  const samples = [];
  let active = true;
  let frame = 0;
  const inspect = (reason) => {
    if (!active) return;
    const opening = document.querySelector("#gaia-opening");
    const canvas = document.querySelector("#gaia-canvas");
    if (!(opening instanceof HTMLElement) || !(canvas instanceof HTMLElement)) return;
    const openingStyle = getComputedStyle(opening);
    const openingFullyCoversViewport = !opening.hidden
      && openingStyle.display !== "none"
      && openingStyle.visibility !== "hidden"
      && Number.parseFloat(openingStyle.opacity || "1") >= 0.99;
    if (openingFullyCoversViewport) return;
    const style = getComputedStyle(canvas);
    const visible = style.display !== "none"
      && style.visibility !== "hidden"
      && Number.parseFloat(style.opacity || "1") > 0.01
      && canvas.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const integratedMap = allowIntegratedMap
      && document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false"
      && canvas.dataset.integratedMapMode
      && canvas.parentElement?.id === "japan-map";
    if (visible && !integratedMap) {
      samples.push({
        reason,
        at: performance.now(),
        body: document.body.className,
        experience: document.querySelector(".experience")?.className || "",
      });
    }
  };
  // DOM mutation callbacks can observe an intermediate state that is replaced
  // within the same frame. Only sample the state Chrome can actually paint.
  const tick = () => {
    inspect("animation-frame");
    if (active) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  globalThis.__gaiaBaseExposureProbe = {
    samples,
    stop() {
      active = false;
      cancelAnimationFrame(frame);
      return [...samples];
    },
  };
}, allowIntegratedMap);
const stopBaseExposureProbe = (page) => page.evaluate(() => globalThis.__gaiaBaseExposureProbe?.stop?.() || []);

const browser = await chromium.launch({ headless: true, executablePath });
try {
  fs.writeFileSync(path.join(outputDir, "chrome.log"), `executable=${executablePath}\nversion=${await browser.version()}\n`);
  // The first Chromium navigation includes process and renderer startup on
  // some Windows runners. Warm that path before measuring page-load vitals.
  const browserWarmupContext = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const browserWarmupPage = await browserWarmupContext.newPage();
  await browserWarmupPage.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await browserWarmupContext.close();

  const performanceContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const performancePage = await performanceContext.newPage();
  monitor(performancePage, "performance");
  await performancePage.addInitScript(() => {
    localStorage.clear();
    globalThis.__gaiaContestVitals = { lcp: 0, lcpEntry: null, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime < globalThis.__gaiaContestVitals.lcp) continue;
        globalThis.__gaiaContestVitals.lcp = entry.startTime;
        globalThis.__gaiaContestVitals.lcpEntry = {
          startTime: entry.startTime,
          size: entry.size,
          url: entry.url,
          element: entry.element?.id || entry.element?.className || entry.element?.tagName || "unknown",
        };
      }
    })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__gaiaContestVitals.cls += entry.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  await performancePage.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await performancePage.waitForSelector("#gaia-opening-sound-modal.is-visible", { timeout: 20_000 });
  await performancePage.waitForTimeout(800);
  report.performance = await performancePage.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    const navigation = performance.getEntriesByType("navigation")[0];
    const logo = entries.find((entry) => entry.name.includes("brand-logo-dark-surface-590.webp"));
    return {
      encodedBytes: Math.round((navigation?.encodedBodySize || 0) + entries.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0)),
      resources: entries.map((entry) => new URL(entry.name).pathname),
      navigation: navigation ? {
        responseStart: navigation.responseStart,
        responseEnd: navigation.responseEnd,
        domContentLoaded: navigation.domContentLoadedEventEnd,
      } : null,
      logo: logo ? { startTime: logo.startTime, responseStart: logo.responseStart, responseEnd: logo.responseEnd } : null,
      lcp: globalThis.__gaiaContestVitals.lcp,
      lcpEntry: globalThis.__gaiaContestVitals.lcpEntry,
      cls: globalThis.__gaiaContestVitals.cls,
    };
  });
  report.performance.limitBytes = ENTRY_BUDGET_BYTES;
  fs.writeFileSync(path.join(outputDir, "performance.json"), JSON.stringify(report.performance, null, 2));
  assertEntryBudget(report.performance.encodedBytes, "initial payload (encoded body)");
  assert(report.performance.lcp < 2500, `LCP ${report.performance.lcp}ms`);
  assert(report.performance.cls < 0.1, `CLS ${report.performance.cls}`);
  for (const pattern of [/\.mp3$/u, /gaia-signals\.json/u, /space-signals\.json/u, /novel-/u, /guided-tour/u, /observation-notebook/u]) {
    assert.equal(report.performance.resources.some((resource) => pattern.test(resource)), false, `eager request: ${pattern}`);
  }
  await performancePage.screenshot({ path: path.join(outputDir, "initial-pc.png"), animations: "disabled" });
  await performanceContext.close();

  for (const viewport of [
    { name: "portrait-min", width: 280, height: 653 },
    { name: "portrait-short", width: 390, height: 568 },
    { name: "landscape-min", width: 568, height: 320 },
    { name: "landscape", width: 667, height: 375 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    monitor(page, viewport.name);
    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector("#gaia-opening-sound-modal.is-visible", { timeout: 20_000 });
    await page.locator("#gaia-opening-sound-off").scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => {
      const modal = document.querySelector("#gaia-opening-sound-modal");
      const dialog = document.querySelector(".gaia-opening-sound-dialog");
      const description = document.querySelector("#gaia-opening-sound-description");
      const actions = ["#gaia-opening-sound-on", "#gaia-opening-sound-off"].map((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return { selector, width: rect.width, height: rect.height, fontSize: Number.parseFloat(getComputedStyle(element).fontSize), visible: rect.bottom > 0 && rect.top < innerHeight };
      });
      const modalRect = modal.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();
      return {
        modalRect: modalRect.toJSON(), dialogRect: dialogRect.toJSON(),
        overflowX: document.documentElement.scrollWidth - innerWidth,
        dialogScrollable: dialog.scrollHeight > dialog.clientHeight,
        activeId: document.activeElement?.id,
        descriptionFontSize: Number.parseFloat(getComputedStyle(description).fontSize),
        actions,
      };
    });
    assert(layout.dialogRect.left >= -1 && layout.dialogRect.right <= viewport.width + 1, `${viewport.name}: horizontal cutoff`);
    assert(layout.dialogRect.top >= -1 && layout.dialogRect.bottom <= viewport.height + 1, `${viewport.name}: vertical cutoff`);
    assert.equal(layout.overflowX, 0, `${viewport.name}: horizontal overflow`);
    assert(layout.descriptionFontSize >= 8, `${viewport.name}: sound copy unreadable`);
    for (const action of layout.actions) {
      assert(action.width >= 44 && action.height >= 44, `${viewport.name}: ${action.selector} hit target`);
      assert.equal(action.visible, true, `${viewport.name}: ${action.selector} unreachable`);
    }
    report.layouts.push({ ...viewport, ...layout });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`), animations: "disabled" });
    await context.close();
  }

  const storyEntryContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const storyEntryPage = await storyEntryContext.newPage();
  monitor(storyEntryPage, "entry-story");
  await storyEntryPage.route(/novel-mode\.js/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await storyEntryPage.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await storyEntryPage.waitForSelector("#gaia-opening-sound-modal.is-visible", { timeout: 20_000 });
  assert.equal(await storyEntryPage.locator("#gaia-opening-entry-continue, #gaia-opening-tour-start, #gaia-opening-entry-story").count(), 0);
  assert.match(await storyEntryPage.locator("#gaia-opening-sound-title").textContent(), /サウンド設定/u);
  await storyEntryPage.locator("#gaia-opening-sound-off").click();
  await storyEntryPage.locator("#gaia-opening-sound-modal").waitFor({ state: "hidden", timeout: 20_000 });
  await storyEntryPage.locator("#gaia-opening-skip").click();
  await storyEntryPage.waitForSelector("#gaia-opening-final-menu.is-visible", { timeout: 20_000 });
  assert.equal(await storyEntryPage.locator("#gaia-opening-final-menu .gaia-opening-route").count(), 2);
  assert.equal(await storyEntryPage.locator("#gaia-opening-tour-link").count(), 0, "the 30-second guide must not remain on the title screen");
  await storyEntryPage.screenshot({ path: path.join(outputDir, "opening-restored-pc.png"), animations: "disabled" });
  await startBaseExposureProbe(storyEntryPage);
  await storyEntryPage.locator("#gaia-opening-route-story").click();
  await storyEntryPage.waitForTimeout(150);
  assert.notEqual(await storyEntryPage.evaluate(() => location.hash), "#story", "story hash must wait for lazy-loaded story UI");
  await storyEntryPage.waitForFunction(() => location.hash === "#story" && document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 30_000 });
  await storyEntryPage.waitForTimeout(320);
  assert.deepEqual(await stopBaseExposureProbe(storyEntryPage), [], "Breathing Earth base must never enter the paint tree during the opening-to-story handoff");
  await storyEntryPage.screenshot({ path: path.join(outputDir, "story-restored-pc.png"), animations: "disabled" });
  assert.equal(await storyEntryPage.locator(".gaia-observation-launcher").count(), 0, "story route must not mount the notebook launcher");
  report.entry.soundAndStory = "passed";
  await storyEntryContext.close();

  const wideEntryContext = await browser.newContext({ viewport: { width: 2048, height: 839 } });
  const wideEntryPage = await wideEntryContext.newPage();
  monitor(wideEntryPage, "entry-wide-composition");
  await wideEntryPage.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await wideEntryPage.waitForSelector("#gaia-opening-sound-modal.is-visible", { timeout: 20_000 });
  await wideEntryPage.locator("#gaia-opening-sound-off").click();
  await wideEntryPage.locator("#gaia-opening-sound-modal").waitFor({ state: "hidden", timeout: 20_000 });
  await wideEntryPage.locator("#gaia-opening-skip").click();
  await wideEntryPage.waitForSelector("#gaia-opening-final-menu.is-visible", { timeout: 20_000 });
  // Desktop uses a pointer/focus tooltip; only touch layouts auto-open the tour.
  await wideEntryPage.locator("#gaia-opening-route-story").hover();
  await wideEntryPage.waitForSelector(".gaia-opening-route-guide.is-visible .gaia-opening-route-guide-bubble", { timeout: 20_000 });
  // Cards fade for 420 ms after an 80/150 ms stagger, and their parent for
  // 620 ms. Guide visibility alone does not mean those transitions finished.
  await wideEntryPage.waitForFunction(() => {
    const menu = document.querySelector("#gaia-opening-final-menu");
    const cards = [...(menu?.querySelectorAll(".gaia-opening-route") || [])];
    return menu && Number.parseFloat(getComputedStyle(menu).opacity) >= 0.999
      && cards.length === 2
      && cards.every(card => Number.parseFloat(getComputedStyle(card).opacity) >= 0.999);
  }, null, { timeout: 10_000 });
  const readWideGuideAlignment = () => wideEntryPage.evaluate(() => {
    const bubble = document.querySelector(".gaia-opening-route-guide-bubble");
    const target = document.querySelector('.gaia-opening-route[aria-describedby~="gaia-opening-route-guide-copy"]');
    const bubbleRect = bubble.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      arrowX: bubbleRect.left + Number.parseFloat(getComputedStyle(bubble).getPropertyValue("--route-guide-arrow-left")),
      targetCenterX: targetRect.left + targetRect.width / 2,
    };
  });
  const assertWideGuideAlignment = async () => {
    const alignment = await readWideGuideAlignment();
    assert(Math.abs(alignment.arrowX - alignment.targetCenterX) <= 2, "route guide speech-bubble arrow must point to its current target button");
  };
  const wideComposition = await wideEntryPage.evaluate(() => {
    const photo = document.querySelector(".gaia-vn-panel-final .gaia-vn-final-photo");
    const copy = document.querySelector(".gaia-vn-panel-final .gaia-vn-final-copy");
    const menu = document.querySelector("#gaia-opening-final-menu");
    const question = document.querySelector(".gaia-vn-panel-final .gaia-vn-final-choice > strong");
    const guide = document.querySelector(".gaia-opening-route-guide");
    const bubble = guide.querySelector(".gaia-opening-route-guide-bubble");
    const target = document.querySelector('.gaia-opening-route[aria-describedby~="gaia-opening-route-guide-copy"]');
    const cards = [...document.querySelectorAll("#gaia-opening-final-menu .gaia-opening-route")];
    const copyRect = copy.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const questionRect = question.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const style = getComputedStyle(photo);
    const serialize = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
    return {
      backgroundPosition: style.backgroundPosition,
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      copy: { left: copyRect.left, bottom: copyRect.bottom },
      menu: serialize(menuRect),
      question: serialize(questionRect),
      guide: {
        step: guide.dataset.step,
        title: guide.querySelector("[data-route-guide-title]").textContent,
        copy: guide.querySelector("[data-route-guide-copy]").textContent,
        shadeOpacity: Number.parseFloat(getComputedStyle(guide.querySelector(".gaia-opening-route-guide-shade")).opacity),
        shadeDisplay: getComputedStyle(guide.querySelector(".gaia-opening-route-guide-shade")).display,
        bubble: serialize(bubbleRect),
        target: serialize(targetRect),
        targetId: target.id,
        cardOpacities: cards.map((card) => Number.parseFloat(getComputedStyle(card).opacity)),
      },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  assert.equal(wideComposition.backgroundSize, "cover", "wide opening artwork must remain full-bleed");
  assert.match(wideComposition.backgroundImage, /01-starlit-observatory\.webp/u, "wide title uses the owner's selected image");
  assert.equal(wideComposition.backgroundPosition, "50% 0%", "selected wide artwork keeps its approved top-centered framing");
  assert(wideComposition.menu.left >= 0 && wideComposition.menu.right <= wideComposition.viewport.width && wideComposition.menu.bottom <= wideComposition.viewport.height, "wide opening menu must remain inside the viewport");
  const wideMenuCenter = wideComposition.menu.left + wideComposition.menu.width / 2;
  const wideQuestionCenter = wideComposition.question.left + wideComposition.question.width / 2;
  assert(Math.abs(wideQuestionCenter - wideMenuCenter) <= 2, "opening question must be centered to the route buttons");
  const wideQuestionToMenuGap = wideComposition.menu.top - wideComposition.question.bottom;
  assert(wideQuestionToMenuGap >= 0 && wideQuestionToMenuGap <= 64, "opening route cards must follow the centered question with the intended breathing room");
  assert.equal(wideComposition.guide.step, "1");
  assert.equal(wideComposition.guide.targetId, "gaia-opening-route-story");
  assert.equal(wideComposition.guide.title.trim(), "");
  assert.match(wideComposition.guide.copy, /ビジュアルノベル|ストーリー/u);
  assert.equal(wideComposition.guide.shadeDisplay, "none", "desktop tooltip must not darken the background");
  assert(wideComposition.guide.cardOpacities.every((opacity) => opacity >= 0.95), "desktop tooltip keeps both routes visible");
  const guideTargetGap = Math.min(
    Math.abs(wideComposition.guide.bubble.top - wideComposition.guide.target.bottom),
    Math.abs(wideComposition.guide.target.top - wideComposition.guide.bubble.bottom),
  );
  // The restored speech bubble reserves an 18px gutter for its 13px pointer.
  // Its fixed position is rounded to a whole pixel by positionRouteGuideBubble.
  assert(guideTargetGap >= 17 && guideTargetGap <= 21, `route guide keeps its 18px pointer gutter plus up to 2px of hover lift (got ${guideTargetGap}px)`);
  await assertWideGuideAlignment();
  await wideEntryPage.screenshot({ path: path.join(outputDir, "opening-route-guide-story-wide.png"), animations: "disabled" });
  assert.equal(await wideEntryPage.locator("#gaia-opening-route-guide button").count(), 0, "route guide must not contain operation buttons");
  await wideEntryPage.locator("#gaia-opening-route-other").hover();
  await wideEntryPage.waitForFunction(() => document.querySelector(".gaia-opening-route-guide")?.dataset.step === "2");
  await wideEntryPage.waitForTimeout(100);
  assert.equal(await wideEntryPage.locator('.gaia-opening-route[aria-describedby~="gaia-opening-route-guide-copy"]').getAttribute("id"), "gaia-opening-route-other");
  await assertWideGuideAlignment();
  await wideEntryPage.screenshot({ path: path.join(outputDir, "opening-route-guide-data-wide.png"), animations: "disabled" });
  await wideEntryPage.keyboard.press("Escape");
  await wideEntryPage.waitForSelector(".gaia-opening-route-guide", { state: "hidden", timeout: 20_000 });
  await wideEntryPage.screenshot({ path: path.join(outputDir, "opening-restored-wide.png"), animations: "disabled" });
  report.entry.wideComposition = "passed";
  await wideEntryContext.close();

  const mobileEntryContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobileEntryPage = await mobileEntryContext.newPage();
  monitor(mobileEntryPage, "entry-mobile-guide-card");
  await mobileEntryPage.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await mobileEntryPage.waitForSelector("#gaia-opening-sound-modal.is-visible", { timeout: 20_000 });
  await mobileEntryPage.locator("#gaia-opening-sound-off").click();
  await mobileEntryPage.locator("#gaia-opening-sound-modal").waitFor({ state: "hidden", timeout: 20_000 });
  await mobileEntryPage.locator("#gaia-opening-skip").click();
  await mobileEntryPage.waitForSelector("#gaia-opening-final-menu.is-visible", { timeout: 20_000 });
  const mobileGuideCardLayout = await mobileEntryPage.evaluate(() => {
    const grid = document.querySelector("#gaia-opening-final-menu .gaia-opening-route-grid");
    const cards = [...document.querySelectorAll("#gaia-opening-final-menu .gaia-opening-route")];
    const serialize = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      grid: serialize(grid),
      cards: cards.map(serialize),
    };
  });
  assert.equal(mobileGuideCardLayout.cards.length, 2);
  assert(mobileGuideCardLayout.documentWidth <= mobileGuideCardLayout.viewport.width, "mobile opening cards caused horizontal overflow");
  assert(mobileGuideCardLayout.cards.every((card) => (
    card.left >= 0 && card.right <= mobileGuideCardLayout.viewport.width
      && card.top >= 0 && card.bottom <= mobileGuideCardLayout.viewport.height
  )), "mobile opening cards must remain inside the viewport");
  await mobileEntryPage.screenshot({ path: path.join(outputDir, "opening-restored-mobile.png"), animations: "disabled" });
  report.entry.mobileGuideCard = "passed";
  await mobileEntryContext.close();

  const guideEntryContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const guideEntryPage = await guideEntryContext.newPage();
  monitor(guideEntryPage, "entry-guide-card");
  await guideEntryPage.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await guideEntryPage.waitForSelector("#gaia-opening-sound-modal.is-visible", { timeout: 20_000 });
  await guideEntryPage.locator("#gaia-opening-sound-off").click();
  await guideEntryPage.locator("#gaia-opening-sound-modal").waitFor({ state: "hidden", timeout: 20_000 });
  await guideEntryPage.locator("#gaia-opening-skip").click();
  await guideEntryPage.waitForSelector("#gaia-opening-final-menu.is-visible", { timeout: 20_000 });
  await guideEntryPage.locator("#gaia-boot").waitFor({ state: "hidden", timeout: 60_000 });
  await startBaseExposureProbe(guideEntryPage, true);
  await guideEntryPage.locator("#gaia-opening-route-other").click();
  await guideEntryPage.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false"
    && document.querySelector("#japan-mode-number")?.textContent === "01", null, { timeout: 60_000 });
  await guideEntryPage.locator("#gaia-opening").waitFor({ state: "hidden" });
  await guideEntryPage.waitForTimeout(500);
  const forbiddenBaseExposure = await stopBaseExposureProbe(guideEntryPage);
  assert.deepEqual(forbiddenBaseExposure, [], "Breathing Earth base must never enter the paint tree during the opening-to-data-guide handoff");
  assert.equal(await guideEntryPage.locator("#intro-layer").getAttribute("aria-hidden"), "true", "Data entry must not open the retired intermediate menu");
  assert.match(await guideEntryPage.evaluate(() => location.hash), /^#world(?:-01)?$/);
  await guideEntryPage.screenshot({ path: path.join(outputDir, "opening-data-entry-guide.png"), animations: "disabled" });
  await completeMapEntry(guideEntryPage);
  report.entry.noBreathingEarthFlash = "passed";
  report.entry.guideCard = "passed";
  await guideEntryContext.close();

  const spaceEntryContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const spaceEntryPage = await spaceEntryContext.newPage();
  monitor(spaceEntryPage, "entry-space-handoff");
  await spaceEntryPage.route(/space-signals\.json/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await spaceEntryPage.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await spaceEntryPage.waitForSelector("#gaia-opening-sound-modal.is-visible", { timeout: 20_000 });
  await spaceEntryPage.locator("#gaia-opening-sound-off").click();
  await spaceEntryPage.locator("#gaia-opening-sound-modal").waitFor({ state: "hidden", timeout: 20_000 });
  await spaceEntryPage.locator("#gaia-opening-skip").click();
  await spaceEntryPage.waitForSelector("#gaia-opening-final-menu.is-visible", { timeout: 20_000 });
  await spaceEntryPage.locator("#gaia-boot").waitFor({ state: "hidden", timeout: 60_000 });
  await spaceEntryPage.locator("#gaia-opening-route-other").click();
  await completeMapEntry(spaceEntryPage);
  // CO2 is exhibit 06; its abstract renderer still uses internal mode 01.
  // The title now opens the dedicated wind exhibit instead.
  await spaceEntryPage.evaluate(() => { location.hash = "#world-06"; });
  await spaceEntryPage.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false" && !document.body.classList.contains("scene-transitioning"), null, { timeout: 20_000 });
  await spaceEntryPage.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light")
    && document.querySelector("#gaia-canvas")?.dataset.integratedMapMode === "01"
    && getComputedStyle(document.querySelector("#gaia-canvas")).visibility === "visible", null, { timeout: 20_000 });
  await spaceEntryPage.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gaia:space-open-at-mode", { detail: { index: 0 } }));
  });
  await spaceEntryPage.waitForFunction(() => document.body.classList.contains("gaia-space-preparing"), null, { timeout: 30_000 });
  assert.equal(await spaceEntryPage.locator("#gaia-canvas").evaluate((canvas) => getComputedStyle(canvas).visibility), "hidden", "space loading must suppress the abstract WebGL base before awaiting its snapshot");
  await startBaseExposureProbe(spaceEntryPage);
  await spaceEntryPage.waitForFunction(() => document.body.classList.contains("space-mode-open") && document.querySelector("#space-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 30_000 });
  await spaceEntryPage.waitForTimeout(420);
  assert.deepEqual(await stopBaseExposureProbe(spaceEntryPage), [], "Breathing Earth base must never enter the paint tree while the space snapshot is loading");
  assert.equal(await spaceEntryPage.locator("#gaia-canvas").evaluate((canvas) => getComputedStyle(canvas).visibility), "hidden", "space mode must keep the abstract WebGL base suppressed");
  await spaceEntryPage.screenshot({ path: path.join(outputDir, "space-handoff-no-breathing-frame.png"), animations: "disabled" });
  report.entry.noBreathingEarthSpaceFlash = "passed";
  await spaceEntryContext.close();

  const directContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const directPage = await directContext.newPage();
  await directPage.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"));
  monitor(directPage, "entry-direct-routes");
  for (const hash of ["#earth", "#story"]) {
    await directPage.goto(new URL(`/${hash}`, baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await directPage.waitForFunction(() => document.querySelector("#gaia-opening")?.hidden === true, null, { timeout: 20_000 });
    assert.equal(await directPage.locator("#gaia-opening-sound-modal.is-visible").count(), 0, `${hash} must bypass entry`);
  }
  report.entry.directRoutes = "passed";
  await directPage.goto(new URL("/#earth", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await directPage.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter), null, { timeout: 30_000 });
  // Use the canonical route: the legacy #japan alias is normalized to #world-01.
  await directPage.evaluate(() => { location.hash = "#world-01"; });
  await directPage.waitForFunction(() => location.hash === "#world-01"
    && document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
  await directPage.goBack({ waitUntil: "domcontentloaded" });
  assert.equal(await directPage.evaluate(() => location.hash), "#earth");
  await directPage.goForward({ waitUntil: "domcontentloaded" });
  assert.equal(await directPage.evaluate(() => location.hash), "#world-01");
  await directPage.reload({ waitUntil: "domcontentloaded" });
  await directPage.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter), null, { timeout: 30_000 });
  // Numbered exhibit deep links intentionally skip the welcome guide.
  await directPage.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
    && document.querySelector("#japan-mode-number")?.textContent === "01");
  await directPage.evaluate(() => globalThis.GaiaMapDemo?.stop());
  assert.equal(await directPage.locator('#gaia-mode-entry-guide[data-phase="features"]').isVisible(), false);
  assert.equal(await directPage.locator(".gaia-observation-launcher, .gaia-observation-drawer, [data-observation-capture-map]").count(), 0, "retired observation notebook UI was mounted");
  assert.equal(await directPage.evaluate(() => typeof globalThis.GaiaObservationNotebook), "undefined", "retired observation notebook runtime was loaded");
  assert.equal(await directPage.evaluate(() => performance.getEntriesByType("resource").some(({ name }) => /observation-notebook/u.test(name))), false, "retired observation notebook assets were requested");
  assert.equal(await directPage.locator("#japan-layer").count(), 1, "history/reload must not duplicate the exploration UI");
  await directPage.waitForFunction(expected => document.querySelectorAll(".map-mode-bank [data-live-exhibit]").length === 6 && globalThis.GaiaMapCategories?.buttons().length === expected, expectedExhibitCount, { timeout: 15_000 });
  const standardExhibitNumbers = await directPage.evaluate(() => GaiaMapCategories.standardButtons().map(button => button.textContent.trim()));
  assert.deepEqual(standardExhibitNumbers, ["06", "07", "08", "09", "10", "11", "12", "13", "14"]);
  assert.equal(await directPage.getByText(/ミツバチ/u).count(), 0, "retired bee exhibit remains visible");
  const bankScreenshot = path.join(outputDir, "map-bank-without-bee.png");
  await directPage.screenshot({ path: bankScreenshot, fullPage: false });
  report.entry.mapBankScreenshot = bankScreenshot;
  report.entry.history = "passed";
  await directContext.close();

  // Exhibits 15–20 now render actual prefecture boundaries, not the retired
  // particle canvas. Test their visible data binding and real selection flow.
  report.entry.liveExhibits = [];
  for (const spec of [
    { name: "desktop", width: 1280, height: 820 },
    { name: "4k", width: 3840, height: 1960 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const mobile = spec.name === "mobile";
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    monitor(page, `live-${spec.name}`);
    await page.goto(new URL("/#japan", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await completeMapEntry(page);
    if (mobile) {
      await page.locator('[data-map-menu-toggle]').tap();
      await page.locator('#map-mobile-sheet [role="tab"][data-map-scope="japan"]').click();
      await page.locator('#map-mobile-sheet [data-mobile-exhibit="15"]').click();
    } else {
      await page.locator(".map-dock-bank-trigger:visible, [data-map-bank-toggle]:visible").first().click();
      await page.locator('.map-mode-bank [role="tab"][data-map-scope="japan"]').click();
      await page.locator('.map-mode-bank [data-live-exhibit="wind-field"]').click();
    }
    for (let number = 15; number <= 20; number += 1) {
      await page.waitForFunction(n => document.querySelector("#japan-mode-number")?.textContent === String(n), number);
      await page.waitForFunction(() => document.querySelectorAll("[data-live-prefecture]").length === 47);
      await page.locator('[data-live-prefecture="13"]').focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => GaiaLiveData.getCity() === "tokyo"
        && document.querySelector("#japan-layer")?.dataset.livePoiTransition === "settled");
      await page.waitForFunction(() => document.querySelector('.gaia-live-exhibit-readout')?.dataset.requestState !== "loading");
      await page.waitForTimeout(1800); // Measure settled geometry, not the entrance transform.
      const state = await page.evaluate(n => {
        const definition = GaiaLiveExhibits.definitions.find(e => e.number === String(n));
        const regions = [...document.querySelectorAll("[data-live-prefecture]")];
        const rect = document.querySelector(".gaia-live-exhibit-readout").getBoundingClientRect();
        return {
          number: n, definition: { id: definition.id, key: definition.key, question: definition.question },
          exhibit: document.querySelector(".gaia-live-exhibit-readout").dataset.exhibit,
          display: document.querySelector("#japan-layer").dataset.liveMapDisplay,
          visible: document.querySelector(".gaia-live-prefecture-regions").checkVisibility(),
          selected: document.querySelector('[data-live-prefecture="13"]').getAttribute("aria-current"),
          selectedValue: document.querySelector('[data-live-prefecture="13"]').dataset.value,
          measurement: GaiaLiveData.getState().measurements[definition.key]?.value ?? null,
          regionCount: regions.length,
          regions: regions.map(e => ({ code: e.dataset.livePrefecture, value: e.dataset.value, missing: e.dataset.missing, fill: e.getAttribute("fill"), path: e.getAttribute("d").length })),
          question: document.querySelector("[data-live-deck-question]").textContent,
          value: document.querySelector("[data-live-exhibit-value]").textContent,
          caption: document.querySelector("[data-live-exhibit-caption]").textContent,
          location: document.querySelector("[data-live-deck-location]").textContent,
          rect: rect.toJSON(), overflow: document.documentElement.scrollWidth - innerWidth,
        };
      }, number);
      assert.equal(state.display, "prefecture-choropleth");
      assert.equal(state.visible, true);
      assert.equal(state.exhibit, state.definition.id);
      assert.equal(state.selected, "true");
      if (state.measurement !== null) assert.equal(Number(state.selectedValue), state.measurement, "Selected prefecture must use the active measurement");
      assert.equal(state.regionCount, 47);
      assert(state.regions.every(r => r.path > 20 && /^#[0-9a-f]{6}$/i.test(r.fill)
        && (r.missing === "true" ? r.value === "missing" && r.fill === "#344354" : Number.isFinite(Number(r.value)))));
      assert(state.regions.some(r => r.missing === "false"), "Saved data must paint real measurements, not an empty map");
      assert.equal(state.question, state.definition.question);
      assert.match(state.location, /東京/u);
      assert.match(state.caption, /代表都市|CAMS/u);
      assert(state.value.trim().length > 0);
      assert(state.rect.left >= -1 && state.rect.right <= spec.width + 1 && state.rect.top >= 0 && state.rect.bottom <= spec.height + 1, `${spec.name}/${number}: readout outside viewport`);
      assert(state.rect.height <= spec.height * 0.35, `${spec.name}/${number}: readout obscures map`);
      assert(state.overflow <= 1, `${spec.name}/${number}: horizontal overflow`);
      assert.equal(await page.locator("#gaia-live-exhibit-canvas").count(), 0, "Retired particle canvas must not return");
      assert.equal(await page.evaluate(() => typeof globalThis.GaiaProceduralAudio), "undefined");
      assert.equal(await page.evaluate(() => GaiaOpeningAudio.getState().mixGain), 1);
      await page.screenshot({ path: path.join(outputDir, `live-exhibit-${number}-${spec.name}.png`), animations: "disabled" });
      report.entry.liveExhibits.push({ viewport: spec.name, ...state });
      if (number < 20) {
        await page.locator('[data-map-stable-step="1"]').click();
      }
    }
    if (mobile) {
      await page.locator('[data-mobile-sheet="reading"]').click();
      await page.waitForFunction(() => document.querySelector("#map-mobile-sheet")?.open);
      assert((await page.locator("#map-mobile-sheet .map-mobile-sheet-body").innerText()).trim().length > 30);
      await page.screenshot({ path: path.join(outputDir, "live-mobile-reading.png") });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#map-mobile-sheet").evaluate(e => e.open), false);
    } else {
      await page.locator("[data-live-deck-source]").click();
      await page.locator("#japan-data-panel").waitFor({ state: "visible" });
      assert.match(await page.locator("#data-ledger-mode-title").textContent(), /^20 /u);
      assert.match(await page.locator("#data-ledger-sources").textContent(), /Open-Meteo|CAMS/u);
      await page.locator("#japan-data-close").click();
    }
    await context.close();
  }

  // Keep the reported cold footer entry in the normal CI browser gate. Loading
  // /story first would register its handler and hide this regression.
  report.entry.coldFooterStory = {};
  for (const spec of [{ name: "desktop", width: 1440, height: 900, touch: false }, { name: "mobile", width: 390, height: 844, touch: true }]) {
    const footerContext = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, hasTouch: spec.touch, isMobile: spec.touch });
    if (!baseUrl.startsWith("https:")) await enforceBrowserSecurity(footerContext, baseUrl);
    const footerPage = await footerContext.newPage();
    monitor(footerPage, `cold-footer-${spec.name}`);
    try {
      await footerPage.goto(new URL("/#top", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await footerPage.locator("#gaia-boot").waitFor({ state: "hidden" });
      await footerPage.locator("#intro-path-stage").waitFor({ state: "visible" });
      await footerPage.waitForTimeout(900);
      if (await footerPage.locator("#intro-entry-guide").isVisible()) {
        await footerPage.keyboard.press("Escape");
        await footerPage.locator("#intro-entry-guide").waitFor({ state: "hidden" });
      }
      assert.equal(await footerPage.evaluate(() => GaiaModeLoader.isLoaded("story")), false, "Footer entry must start with the story runtime unloaded");
      for (const selector of ["#intro-architecture-jump", "[data-novel-open]"]) {
        const button = footerPage.locator(selector);
        await button.scrollIntoViewIfNeeded();
        if (spec.touch) await button.tap();
        else await button.click();
      }
      await footerPage.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible" && document.querySelector("#novel-text")?.dataset.revealState === "complete", null, { timeout: 30_000 });
      const footerState = await footerPage.evaluate(() => ({
        loaded: GaiaModeLoader.isLoaded("story"),
        visible: document.querySelector("#novel-layer").checkVisibility() && document.body.classList.contains("novel-open"),
        introHidden: !document.querySelector("#intro-layer").checkVisibility(),
        stepId: document.querySelector("#novel-layer").dataset.stepId,
        firstStepId: GAIA_NOVEL_STORY.scenes[0].steps[0].id,
        text: document.querySelector("#novel-text").textContent,
        firstText: GAIA_NOVEL_STORY.scenes[0].steps[0].text,
      }));
      assert(footerState.loaded && footerState.visible && footerState.introHidden, "Footer story must actually replace the data entry screen");
      assert.equal(footerState.stepId, footerState.firstStepId);
      assert(footerState.text.length > 20 && footerState.firstText.startsWith(footerState.text), "Footer entry must show the current first story page");
      assert.deepEqual(await footerPage.evaluate(() => globalThis.__securityViolations || []), []);
      report.entry.coldFooterStory[spec.name] = { status: "passed", ...footerState };
      await footerPage.screenshot({ path: path.join(outputDir, `cold-footer-story-${spec.name}.png`) });
    } finally {
      await footerContext.close();
    }
  }


  const tourContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const tourPage = await tourContext.newPage();
  monitor(tourPage, "tour");
  const tourRequests = [];
  tourPage.on("request", (request) => tourRequests.push(new URL(request.url()).pathname));
  await tourPage.addInitScript(() => {
    localStorage.setItem("gaia-novel-save", "tour-must-not-change");
  });
  await tourPage.goto(new URL("/#tour", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await tourPage.waitForFunction(() => globalThis.GaiaGuidedTour?.getState?.().active === true, null, { timeout: 30_000 });
  await tourPage.waitForFunction(() => {
    const spotlight = document.querySelector(".gaia-tour-target-spotlight");
    const cue = document.querySelector(".gaia-tour-target-cue");
    return spotlight && cue && !spotlight.hidden && !cue.hidden && document.querySelector(".gaia-tour-highlight-target");
  }, null, { timeout: 30_000 });
  await tourPage.waitForFunction(() => document.querySelector("#gaia-guided-tour")?.contains(document.activeElement), null, { timeout: 5_000 });
  const initialTour = await tourPage.evaluate(() => ({ state: GaiaGuidedTour.getState(), hash: location.hash, modalHidden: document.querySelector("#gaia-opening")?.hidden }));
  assert.equal(initialTour.state.totalDuration, 30);
  assert.equal(await tourPage.locator("[data-tour-step-total]").textContent(), "3");
  assert.equal(initialTour.hash, "#tour");
  assert.equal(initialTour.modalHidden, true);
  assert.equal(await tourPage.evaluate(() => document.querySelector("#gaia-guided-tour")?.contains(document.activeElement)), true);
  assert.equal(await tourPage.locator("#gaia-canvas").evaluate((canvas) => getComputedStyle(canvas).visibility), "hidden", "direct #tour entry must suppress the abstract WebGL base");
  assert.equal(await tourPage.evaluate(() => document.body.classList.contains("gaia-route-handoff")), false, "direct #tour handoff shield must release only after the guide owns the viewport");
  assert(tourRequests.some((resource) => /moonlit-source-save\.mp3$/u.test(resource)), "tour must request the SENSEWARE soundtrack");
  for (const pattern of [/satellite-forecast-hope\.mp3$/u, /opening-mizuha/u, /opening-amane/u, /open-data-archive-bg/u, /opening-final-night/u, /space-(?:signals|mode|scenes)/u]) {
    assert.equal(tourRequests.some((resource) => pattern.test(resource)), false, `tour requested opening asset: ${pattern}`);
  }
  const initialOperationGuide = await tourPage.evaluate(() => ({
    title: document.querySelector("[data-tour-title]").textContent.trim(),
    actions: [...document.querySelectorAll("[data-tour-operation-path] li")].map((item) => item.textContent.trim()),
    cue: document.querySelector("[data-tour-target-cue]").textContent.trim(),
    phase: document.querySelector("#gaia-guided-tour").dataset.phase,
    running: document.querySelector("#gaia-guided-tour").dataset.running,
    cardAnimation: getComputedStyle(document.querySelector(".gaia-tour-card")).animationName,
    cardTransition: getComputedStyle(document.querySelector(".gaia-tour-card")).transitionDuration,
    cardCurrentAnimation: getComputedStyle(document.querySelector(".gaia-tour-card"), "::after").animationName,
    instructionAnimation: getComputedStyle(document.querySelector(".gaia-tour-instruction")).animationName,
    targetRingAnimation: getComputedStyle(document.querySelector(".gaia-tour-target-spotlight"), "::before").animationName,
    targetTransition: getComputedStyle(document.querySelector(".gaia-tour-target-spotlight")).transitionDuration,
    cueTransition: getComputedStyle(document.querySelector(".gaia-tour-target-cue")).transitionDuration,
    actionOpacity: [...document.querySelectorAll("[data-tour-operation-path] li")].map((item) => Number.parseFloat(getComputedStyle(item).opacity)),
  }));
  assert.equal(initialOperationGuide.title, "地図を動かし、観測点を選ぶ。", "30-second guide must start with a plain live-map operation");
  assert.deepEqual(initialOperationGuide.actions, ["動かす地図をドラッグ", "近づくホイール／ピンチ", "選ぶ明るい観測点"], "map guide must explain move, zoom, and observation selection in natural Japanese");
  assert(initialOperationGuide.cue.includes("ドラッグ"), "map guide must begin with a concrete drag cue");
  assert(["arriving", "focused", "leaving"].includes(initialOperationGuide.phase), "tour does not expose a gaze-control phase");
  assert.equal(initialOperationGuide.running, "true", "tour animation state is not synchronized with autoplay");
  assert(initialOperationGuide.cardAnimation.includes("gaia-tour-card-focus-in"), "tour card lacks a full fade-in");
  assert(initialOperationGuide.cardTransition.includes("0.52s"), "tour card still jumps abruptly between live targets");
  assert(initialOperationGuide.cardCurrentAnimation.includes("gaia-tour-bubble-current"), "tour bubble lacks an immersive light current");
  assert(initialOperationGuide.instructionAnimation.includes("gaia-tour-content-focus-in"), "tour content is not revealed in reading order");
  assert(initialOperationGuide.targetRingAnimation.includes("gaia-tour-focus-ring"), "live target lacks a repeated attention ring");
  assert(initialOperationGuide.targetTransition.includes("0.58s"), "live target framing still jumps abruptly");
  assert(initialOperationGuide.cueTransition.includes("0.34s"), "target cue lacks a calm fade transition");
  assert(initialOperationGuide.actionOpacity[0] > initialOperationGuide.actionOpacity[1], "operation sequence does not dim future actions");
  await tourPage.locator("[data-tour-action='toggle']").click();
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().running), false);
  const pausedActionStage = await tourPage.locator("#gaia-guided-tour").getAttribute("data-action");
  await tourPage.waitForTimeout(3200);
  assert.equal(await tourPage.locator("#gaia-guided-tour").getAttribute("data-action"), pausedActionStage, "pausing the guide must also pause its operation demonstration");
  const pausedTourIndex = await tourPage.evaluate(() => GaiaGuidedTour.getState().index);
  await tourPage.locator("[data-tour-action='next']").click();
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().index), pausedTourIndex + 1);
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().running), false, "manual navigation must preserve an intentional pause");
  assert.equal(await tourPage.locator("#gaia-guided-tour").getAttribute("data-phase"), "focused", "paused guide must restore fully readable content");
  assert.equal(await tourPage.locator("#gaia-guided-tour").getAttribute("data-running"), "false", "paused visual state is not exposed");
  await tourPage.waitForFunction(() => {
    const spotlight = document.querySelector(".gaia-tour-target-spotlight");
    const target = document.querySelector(".gaia-tour-highlight-target");
    const card = document.querySelector(".gaia-tour-card");
    return spotlight && !spotlight.hidden && target && target.getClientRects().length > 0
      && card?.dataset.positioned === "true" && document.querySelector("#gaia-guided-tour")?.dataset.step === "time";
  }, null, { timeout: 30_000 });
  await tourPage.waitForTimeout(700);
  const mobileTourLayout = await tourPage.evaluate(() => {
    const card = document.querySelector(".gaia-tour-card");
    const copy = document.querySelector(".gaia-tour-copy");
    const instruction = document.querySelector(".gaia-tour-instruction");
    const instructionText = document.querySelector("[data-tour-instruction]");
    const hint = document.querySelector("[data-tour-hint]");
    const result = document.querySelector("[data-tour-result]");
    const gesture = document.querySelector("[data-tour-gesture]");
    const receipt = document.querySelector("[data-tour-receipt]");
    const spotlight = document.querySelector(".gaia-tour-target-spotlight");
    const target = document.querySelector(".gaia-tour-highlight-target");
    const cue = document.querySelector(".gaia-tour-target-cue");
    const controlsPanel = document.querySelector(".gaia-tour-controls");
    const rail = Array.from(document.querySelectorAll(".gaia-tour-step-rail i"));
    const cardRect = card.getBoundingClientRect();
    const cardContentContained = [...card.children]
      .filter((element) => !element.hidden && getComputedStyle(element).display !== "none")
      .every((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= cardRect.left - 1 && bounds.right <= cardRect.right + 1
          && bounds.top >= cardRect.top - 1 && bounds.bottom <= cardRect.bottom + 1;
      });
    const spotlightRect = spotlight.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const controlsRect = controlsPanel.getBoundingClientRect();
    const horizontalGap = Math.max(cardRect.left - targetRect.right, targetRect.left - cardRect.right, 0);
    const verticalGap = Math.max(cardRect.top - targetRect.bottom, targetRect.top - cardRect.bottom, 0);
    const cardTargetOverlap = cardRect.left < targetRect.right && cardRect.right > targetRect.left
      && cardRect.top < targetRect.bottom && cardRect.bottom > targetRect.top;
    const viewportInset = 6;
    const expectedSpotlight = {
      left: Math.max(viewportInset, targetRect.left - 6),
      top: Math.max(viewportInset, targetRect.top - 6),
      right: Math.min(innerWidth - viewportInset, targetRect.right + 6),
      bottom: Math.min(innerHeight - viewportInset, targetRect.bottom + 6),
    };
    const style = getComputedStyle(card);
    const controls = Array.from(document.querySelectorAll(".gaia-tour-controls button")).map((element) => element.getBoundingClientRect().height);
    return {
      cardHeight: card.getBoundingClientRect().height,
      cardClientHeight: card.clientHeight,
      cardScrollHeight: card.scrollHeight,
      cardOverflowY: style.overflowY,
      cardContentContained,
      visibleTextLength: card.innerText.replace(/\s+/gu, "").length,
      copyFont: Number.parseFloat(getComputedStyle(copy).fontSize),
      instructionFont: Number.parseFloat(getComputedStyle(instruction).fontSize),
      primaryActionFont: Number.parseFloat(getComputedStyle(instructionText).fontSize),
      title: document.querySelector("[data-tour-title]").textContent.trim(),
      instructionText: instructionText.textContent.trim(),
      hint: hint.textContent.trim(),
      result: result.textContent.trim(),
      gesture: gesture.textContent.trim(),
      receiptOpen: receipt.open,
      railCount: rail.length,
      operationActions: [...document.querySelectorAll("[data-tour-operation-path] li")].map((item) => item.textContent.trim()),
      currentRailCount: rail.filter((element) => element.dataset.state === "current").length,
      cueText: cue.textContent.trim(),
      cueVisible: !cue.hidden,
      spotlightVisible: !spotlight.hidden,
      spotlightDelta: {
        left: Math.abs(spotlightRect.left - expectedSpotlight.left),
        top: Math.abs(spotlightRect.top - expectedSpotlight.top),
        width: Math.abs(spotlightRect.width - (expectedSpotlight.right - expectedSpotlight.left)),
        height: Math.abs(spotlightRect.height - (expectedSpotlight.bottom - expectedSpotlight.top)),
      },
      borderWidth: Number.parseFloat(style.borderTopWidth),
      cardPlacement: card.dataset.placement,
      cardPosition: style.position,
      cardProximity: Math.hypot(horizontalGap, verticalGap),
      cardTargetOverlap,
      cardInsidePlacement: card.dataset.placement?.startsWith("inside") === true,
      cardContained: cardRect.left >= 9 && cardRect.right <= innerWidth - 9
        && cardRect.top >= 9 && cardRect.bottom <= controlsRect.top - 8,
      cardArrow: getComputedStyle(card, "::before").content,
      controls,
      controlLabels: [...document.querySelectorAll(".gaia-tour-controls button")].map((button) => button.textContent.trim()),
    };
  });
  assert(mobileTourLayout.cardContentContained, "tour card content escapes its visible bubble");
  assert(!["auto", "scroll"].includes(mobileTourLayout.cardOverflowY), `tour card still exposes ${mobileTourLayout.cardOverflowY} overflow`);
  assert(mobileTourLayout.visibleTextLength <= 150, `tour step remains text-heavy: ${mobileTourLayout.visibleTextLength} characters`);
  assert(mobileTourLayout.copyFont >= 14 && mobileTourLayout.instructionFont >= 14, "tour important copy below 14px");
  assert(mobileTourLayout.primaryActionFont >= 16, "tour primary action is not visually dominant");
  assert.equal(mobileTourLayout.title, "年代を動かし、変化をたどる。", "tour time title is not a direct, natural action");
  assert(mobileTourLayout.instructionText.includes("年代スライダー") && mobileTourLayout.instructionText.includes("ゆっくり"), "tour does not provide one calm timeline action");
  assert(mobileTourLayout.hint.includes("左は過去") && mobileTourLayout.result.length >= 12, "tour lacks a plain timeline hint or visible outcome");
  assert.equal(mobileTourLayout.gesture, "⇆", "tour gesture does not match the timeline action");
  assert.equal(mobileTourLayout.receiptOpen, false, "technical receipt must be collapsed by default");
  assert.equal(mobileTourLayout.railCount, 3, "tour progress rail must expose all three Earth-focused steps");
  assert.deepEqual(mobileTourLayout.operationActions, ["触れる年代スライダー", "たどる過去から未来へ", "見比べる色と観測値"], "timeline guide must explain touching, tracing, and comparing the result");
  assert.equal(mobileTourLayout.currentRailCount, 1, "tour progress rail must have one current step");
  assert(mobileTourLayout.cueVisible && mobileTourLayout.cueText.includes("年代スライダー"), "tour target cue is not a direct timeline action");
  assert(mobileTourLayout.spotlightVisible && Object.values(mobileTourLayout.spotlightDelta).every((delta) => delta <= 2), "tour spotlight does not frame the live target");
  assert(mobileTourLayout.borderWidth >= 2, "tour card border is not visible enough");
  assert.equal(mobileTourLayout.cardPosition, "fixed", "tour explanation must follow the live target instead of occupying the layout corner");
  assert(mobileTourLayout.cardContained, "mobile tour bubble is clipped or overlaps the tour controls");
  assert(mobileTourLayout.cardProximity <= 20 || (mobileTourLayout.cardTargetOverlap && mobileTourLayout.cardInsidePlacement), "mobile tour explanation is not adjacent to its live control");
  assert.notEqual(mobileTourLayout.cardArrow, "none", "mobile tour explanation lacks a speech-bubble arrow");
  assert(mobileTourLayout.controls.every((height) => height >= 48), "tour control below 48px");
  assert.deepEqual(mobileTourLayout.controlLabels, ["閉じる", "戻る", "続ける", "次へ"], "tour controls still rely on unexplained symbols");
  await tourPage.locator("[data-tour-action='toggle']").click();
  await tourPage.waitForFunction(() => GaiaGuidedTour.getState().elapsed > 0, null, { timeout: 10_000 });
  await tourPage.waitForFunction(() => document.querySelector("#gaia-guided-tour")?.dataset.action === "2"
    && GaiaMapObservationAdapter.getState().signalTimePosition >= 58, null, { timeout: 5_000 });
  await tourPage.evaluate(() => document.querySelector(".gaia-tour-highlight-target")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().running), true, "exhibit interaction must not pause autoplay");
  assert.equal(await tourPage.locator("[data-tour-result-label]").textContent(), "観測できました", "tour does not acknowledge a successful observation");
  const visibleElapsed = await tourPage.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    return GaiaGuidedTour.getState().elapsed;
  });
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().running), false);
  await tourPage.waitForTimeout(350);
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().elapsed), visibleElapsed);
  await tourPage.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().running), true);
  await tourPage.locator("[data-tour-action='previous']").click();
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().index), 0);
  assert.equal(await tourPage.evaluate(() => localStorage.getItem("gaia-novel-save")), "tour-must-not-change");
  await tourPage.setViewportSize({ width: 667, height: 375 });
  await tourPage.waitForTimeout(750);
  const rotatedLayout = await tourPage.evaluate(() => {
    const cardElement = document.querySelector(".gaia-tour-card");
    const card = cardElement.getBoundingClientRect();
    const controls = document.querySelector(".gaia-tour-controls").getBoundingClientRect();
    const contentContained = [...cardElement.children]
      .filter((element) => !element.hidden && getComputedStyle(element).display !== "none")
      .every((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= card.left - 1 && bounds.right <= card.right + 1
          && bounds.top >= card.top - 1 && bounds.bottom <= card.bottom + 1;
      });
    return {
      card: card.toJSON(),
      controls: controls.toJSON(),
      width: innerWidth,
      height: innerHeight,
      contentContained,
      overflowY: getComputedStyle(cardElement).overflowY,
    };
  });
  report.tour.rotatedLayout = rotatedLayout;
  assert(rotatedLayout.card.left >= 0 && rotatedLayout.card.right <= rotatedLayout.width, "rotated tour card cutoff");
  assert(rotatedLayout.card.bottom <= rotatedLayout.controls.top - 8, "rotated tour card overlaps the controls");
  assert(rotatedLayout.contentContained && !["auto", "scroll"].includes(rotatedLayout.overflowY), "rotated tour card exposes clipped content or a scrollbar");
  assert(rotatedLayout.controls.left >= 0 && rotatedLayout.controls.right <= rotatedLayout.width && rotatedLayout.controls.bottom <= rotatedLayout.height, "rotated tour controls cutoff");
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().active), true, "tour must survive rotation");
  await tourPage.setViewportSize({ width: 390, height: 844 });
  await tourPage.waitForTimeout(40);
  const resizingExposure = await tourPage.evaluate(() => {
    const card = document.querySelector(".gaia-tour-card");
    const bounds = card.getBoundingClientRect();
    return {
      safe: bounds.left >= 0 && bounds.right <= innerWidth,
      opacity: Number.parseFloat(getComputedStyle(card).opacity),
    };
  });
  assert(resizingExposure.safe || resizingExposure.opacity <= .05, "tour card is visibly clipped while returning from rotation");
  await tourPage.waitForTimeout(700);
  await tourPage.screenshot({ path: path.join(outputDir, "tour-mobile.png"), animations: "disabled" });
  await tourPage.locator("[data-tour-action='exit']").focus();
  await tourPage.keyboard.press("Escape");
  if (await tourPage.evaluate(() => GaiaGuidedTour.getState().active)) {
    assert.equal(await tourPage.evaluate(() => GaiaModeEntryGuide?.getState?.().active), false, "Escape must close the nested mode guide first");
    await tourPage.keyboard.press("Escape");
  }
  await tourPage.waitForFunction(() => GaiaGuidedTour.getState().active === false);
  await tourPage.waitForTimeout(80);
  const exitLayout = await tourPage.evaluate(() => {
    const intro = document.querySelector("#intro-layer").getBoundingClientRect();
    return {
      scrollX,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      intro: intro.toJSON(),
      width: innerWidth,
    };
  });
  assert.equal(exitLayout.scrollX, 0, "tour exit retained horizontal scroll");
  assert(exitLayout.overflowX <= 1, `tour exit created ${exitLayout.overflowX}px horizontal overflow`);
  assert(exitLayout.intro.left >= -1 && exitLayout.intro.right <= exitLayout.width + 1, "tour exit intro did not fill the viewport");
  await tourPage.evaluate(() => GaiaGuidedTour.start({ source: "reentry" }));
  assert.equal(await tourPage.evaluate(() => GaiaGuidedTour.getState().active), true);
  await tourPage.evaluate(() => GaiaGuidedTour.exit());
  report.tour.controls = "passed";
  await tourContext.close();

  const clarityContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const clarityPage = await clarityContext.newPage();
  monitor(clarityPage, "tour-clarity");
  await clarityPage.goto(new URL("/#tour", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await clarityPage.waitForFunction(() => globalThis.GaiaGuidedTour?.getState?.().active === true, null, { timeout: 30_000 });
  await clarityPage.locator("[data-tour-action='toggle']").click();
  const claritySteps = [];
  for (let expectedIndex = 0; expectedIndex < 3; expectedIndex += 1) {
    await clarityPage.waitForFunction((value) => GaiaGuidedTour.getState().index === value, expectedIndex);
    await clarityPage.waitForFunction(() => {
      const card = document.querySelector(".gaia-tour-card");
      const target = document.querySelector(".gaia-tour-highlight-target");
      return card?.dataset.positioned === "true" && target?.getClientRects().length > 0;
    }, null, { timeout: 30_000 });
    await clarityPage.waitForTimeout(900);
    await clarityPage.waitForFunction(() => {
      const card = document.querySelector(".gaia-tour-card");
      const target = document.querySelector(".gaia-tour-highlight-target");
      const controls = document.querySelector(".gaia-tour-controls");
      if (!(card instanceof HTMLElement) || !(target instanceof HTMLElement) || !(controls instanceof HTMLElement)) return false;
      const cardRect = card.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const horizontalGap = Math.max(cardRect.left - targetRect.right, targetRect.left - cardRect.right, 0);
      const verticalGap = Math.max(cardRect.top - targetRect.bottom, targetRect.top - cardRect.bottom, 0);
      const overlapsTarget = cardRect.left < targetRect.right && cardRect.right > targetRect.left
        && cardRect.top < targetRect.bottom && cardRect.bottom > targetRect.top;
      const overlapsControls = cardRect.left < controlsRect.right && cardRect.right > controlsRect.left
        && cardRect.top < controlsRect.bottom && cardRect.bottom > controlsRect.top;
      const contained = cardRect.left >= 13 && cardRect.right <= innerWidth - 13
        && cardRect.top >= 13 && cardRect.bottom <= innerHeight - 13 && !overlapsControls;
      const nearTarget = Math.hypot(horizontalGap, verticalGap) <= 20
        || (overlapsTarget && card.dataset.placement?.startsWith("inside") === true);
      // The full-map target can appear before the two-frame positioning task.
      // Its large bounds also overlap the temporary centered fallback, so
      // geometric proximity alone does not mean target positioning is ready.
      const targetPositioned = Boolean(card.dataset.placement && card.dataset.placement !== "standalone");
      return contained && nearTarget && targetPositioned
        && getComputedStyle(card, "::before").display !== "none";
    }, null, { timeout: 4_000, polling: 100 });
    claritySteps.push(await clarityPage.evaluate(() => {
      const card = document.querySelector(".gaia-tour-card");
      const target = document.querySelector(".gaia-tour-highlight-target");
      const controls = document.querySelector(".gaia-tour-controls");
      const title = document.querySelector("[data-tour-title]").textContent.trim();
      const action = document.querySelector("[data-tour-instruction]").textContent.trim();
      const result = document.querySelector("[data-tour-result]").textContent.trim();
      const visibleText = card.innerText.replace(/\s+/gu, "");
      const cardRect = card.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const horizontalGap = Math.max(cardRect.left - targetRect.right, targetRect.left - cardRect.right, 0);
      const verticalGap = Math.max(cardRect.top - targetRect.bottom, targetRect.top - cardRect.bottom, 0);
      const overlapsTarget = cardRect.left < targetRect.right && cardRect.right > targetRect.left
        && cardRect.top < targetRect.bottom && cardRect.bottom > targetRect.top;
      const overlapsControls = cardRect.left < controlsRect.right && cardRect.right > controlsRect.left
        && cardRect.top < controlsRect.bottom && cardRect.bottom > controlsRect.top;
      const contentContained = [...card.children]
        .filter((element) => !element.hidden && getComputedStyle(element).display !== "none")
        .every((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left >= cardRect.left - 1 && bounds.right <= cardRect.right + 1
            && bounds.top >= cardRect.top - 1 && bounds.bottom <= cardRect.bottom + 1;
        });
      return {
        title,
        action,
        result,
        actions: [...document.querySelectorAll("[data-tour-operation-path] li")].map((item) => item.textContent.trim()),
        visibleCharacters: visibleText.length,
        actionFont: Number.parseFloat(getComputedStyle(document.querySelector("[data-tour-instruction]")).fontSize),
        explanationCount: [...card.querySelectorAll(".gaia-tour-copy, .gaia-tour-result, .gaia-tour-fallback:not([hidden])")].filter((node) => node.getBoundingClientRect().height > 1).length,
        jargonVisible: /RAW|DERIVED|SCENARIO|HTML|JavaScript/u.test(card.innerText),
        vagueLanguageVisible: /光を押|光る地点|青いつまみ|元の数字|ボタンを押/u.test(card.innerText),
        placement: card.dataset.placement,
        cardPosition: getComputedStyle(card).position,
        proximity: Math.hypot(horizontalGap, verticalGap),
        overlapsTarget,
        insidePlacement: card.dataset.placement?.startsWith("inside") === true,
        contained: cardRect.left >= 13 && cardRect.right <= innerWidth - 13
          && cardRect.top >= 13 && cardRect.bottom <= innerHeight - 13 && !overlapsControls,
        arrow: getComputedStyle(card, "::before").content,
        arrowDisplay: getComputedStyle(card, "::before").display,
        contentContained,
        overflowY: getComputedStyle(card).overflowY,
        cardRect: cardRect.toJSON(),
        targetRect: targetRect.toJSON(),
      };
    }));
    await clarityPage.screenshot({ path: path.join(outputDir, `tour-clear-step-${expectedIndex + 1}-pc.png`), animations: "disabled" });
    if (expectedIndex < 2) await clarityPage.locator("[data-tour-action='next']").click();
  }
  report.tour.clarity = claritySteps;
  assert.equal(claritySteps.length, 3);
  assert(claritySteps.every((step) => step.title.length <= 18 && step.action.length <= 24 && step.result.length <= 28), "tour does not keep each message to one concise idea");
  assert(claritySteps.every((step) => step.visibleCharacters <= 165), "tour card still requires too much reading");
  assert(claritySteps.every((step) => step.actionFont >= 19), "desktop tour action is not visually dominant");
  assert(claritySteps.every((step) => step.explanationCount <= 3), "tour exposes too many simultaneous explanations");
  assert(claritySteps.every((step) => step.jargonVisible === false), "tour exposes unexplained technical jargon");
  assert(claritySteps.every((step) => step.vagueLanguageVisible === false), "tour still uses vague or unnatural operation language");
  assert(claritySteps.every((step) => step.actions.length === 3), "every tour step must expose a three-part operation path");
  assert(claritySteps.every((step) => step.cardPosition === "fixed" && step.contained), "tour explanation bubble is not safely target-positioned");
  assert(claritySteps.every((step) => step.proximity <= 20 || (step.overlapsTarget && step.insidePlacement)), "tour explanation is detached from a live UI target");
  assert(claritySteps.every((step) => step.arrow !== "none" && step.arrowDisplay !== "none" && step.placement && step.placement !== "standalone"), "tour target bubble lacks an arrow or target placement");
  assert(claritySteps.every((step) => step.contentContained && !["auto", "scroll"].includes(step.overflowY)), "a tour step exposes clipped content or a card scrollbar");
  await clarityPage.screenshot({ path: path.join(outputDir, "tour-clear-step-03-final-pc.png"), animations: "disabled" });
  await clarityPage.evaluate(() => GaiaGuidedTour.exit());
  await clarityContext.close();

  const automaticContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const automaticPage = await automaticContext.newPage();
  monitor(automaticPage, "tour-automatic");
  await automaticPage.goto(new URL("/#tour", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await automaticPage.waitForFunction(() => globalThis.GaiaGuidedTour?.getState?.().active === true, null, { timeout: 30_000 });
  await automaticPage.evaluate(() => {
    const layer = document.querySelector("#gaia-guided-tour");
    globalThis.__gaiaTourGazeFlow = [];
    const record = () => {
      const value = {
        step: layer.dataset.step || "pending",
        phase: layer.dataset.phase || "pending",
        cuePhase: layer.dataset.cuePhase || "pending",
        action: layer.dataset.action || "pending",
        at: performance.now(),
      };
      const previous = globalThis.__gaiaTourGazeFlow.at(-1);
      if (!previous || previous.step !== value.step || previous.phase !== value.phase || previous.cuePhase !== value.cuePhase || previous.action !== value.action) {
        globalThis.__gaiaTourGazeFlow.push(value);
      }
    };
    record();
    globalThis.__gaiaTourGazeObserver = new MutationObserver(record);
    globalThis.__gaiaTourGazeObserver.observe(layer, { attributes: true, attributeFilter: ["data-step", "data-phase", "data-cue-phase", "data-action"] });
  });
  const automaticStartedAt = Date.now();
  await automaticPage.waitForSelector("[data-tour-finish]:not([hidden])", { timeout: 40_000 });
  report.tour.autoDurationMs = Date.now() - automaticStartedAt;
  assert(report.tour.autoDurationMs >= 28_000 && report.tour.autoDurationMs <= 35_000, `automatic tour ${report.tour.autoDurationMs}ms`);
  report.tour.gazeFlow = await automaticPage.evaluate(() => {
    globalThis.__gaiaTourGazeObserver?.disconnect();
    return globalThis.__gaiaTourGazeFlow;
  });
  for (const stepId of ["time", "transform"]) {
    const phases = report.tour.gazeFlow.filter((entry) => entry.step === stepId).map((entry) => entry.phase);
    assert(phases.includes("arriving") && phases.includes("focused") && phases.includes("leaving"), `${stepId} does not fade in, focus, and fade out in sequence`);
  }
  assert.equal(report.tour.gazeFlow.some((entry) => entry.step === "space"), false, "30-second guide must not enter the space mode");
  assert(report.tour.gazeFlow.some((entry) => entry.cuePhase === "leaving"), "target cues never fade out between operations");
  assert(report.tour.gazeFlow.some((entry) => entry.cuePhase === "arriving"), "target cues never fade in between operations");
  assert.equal(await automaticPage.locator("[data-tour-finish] [data-tour-destination]").count(), 3);
  assert.equal(await automaticPage.locator("[data-tour-finish] a[href='./sensors/']").count(), 1);
  await automaticPage.screenshot({ path: path.join(outputDir, "tour-finish.png"), animations: "disabled" });
  await automaticContext.close();

  const webglContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const webglPage = await webglContext.newPage();
  monitor(webglPage, "webgl-fallback");
  await webglPage.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    };
  });
  await webglPage.goto(new URL("/#tour", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await webglPage.waitForFunction(() => globalThis.GaiaGuidedTour?.getState?.().active === true, null, { timeout: 30_000 });
  await webglPage.evaluate((targetIndex) => {
    const next = document.querySelector("[data-tour-action='next']");
    const previous = document.querySelector("[data-tour-action='previous']");
    const toggle = document.querySelector("[data-tour-action='toggle']");
    if (GaiaGuidedTour.getState().running) toggle.click();
    for (let attempt = 0; attempt < 3 && GaiaGuidedTour.getState().index !== targetIndex; attempt += 1) {
      (GaiaGuidedTour.getState().index < targetIndex ? next : previous).click();
    }
  }, 1);
  await webglPage.waitForFunction(() => GaiaGuidedTour.getState().index === 1, null, { timeout: 20_000 });
  await webglPage.waitForSelector("[data-tour-fallback]:not([hidden])", { timeout: 20_000 });
  for (let targetIndex = 2; targetIndex <= 2; targetIndex += 1) {
    await webglPage.locator("[data-tour-action='next']").evaluate((button) => button.click());
    await webglPage.waitForFunction((expectedIndex) => GaiaGuidedTour.getState().index === expectedIndex, targetIndex, { timeout: 20_000 });
  }
  await webglPage.locator("[data-tour-action='next']").evaluate((button) => button.click());
  assert.equal(await webglPage.locator("[data-tour-finish]").isVisible(), true, "WebGL fallback must reach finish");
  assert.equal(await webglPage.locator("[data-tour-finish] [data-tour-destination='source']").isEnabled(), true);
  report.resilience.webglFallback = "passed";
  await webglContext.close();

  const lifecycleContext = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const lifecyclePage = await lifecycleContext.newPage();
  monitor(lifecyclePage, "lifecycle");
  await lifecyclePage.goto(new URL("/#earth", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await lifecyclePage.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter), null, { timeout: 30_000 });
  await lifecyclePage.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
  const lifecycle = await lifecyclePage.evaluate(async () => {
    const initialCanvasCount = document.querySelectorAll("canvas").length;
    const initialSpaceCanvasCount = document.querySelectorAll("#space-canvas").length;
    const initialAudioCount = document.querySelectorAll("audio").length;
    for (let position = 0; position < 10; position += 1) {
      GaiaMapObservationAdapter.openMap();
      GaiaMapObservationAdapter.closeMap();
    }
    await GaiaModeLoader.load("space");
    let spaceCanvas = null;
    let spaceCanvasReused = true;
    for (let position = 0; position < 10; position += 1) {
      await GaiaSpaceTourAdapter.openAtMode(0);
      const currentSpaceCanvas = document.querySelector("#space-canvas");
      if (!spaceCanvas) spaceCanvas = currentSpaceCanvas;
      else if (currentSpaceCanvas !== spaceCanvas) spaceCanvasReused = false;
      GaiaSpaceTourAdapter.close();
    }
    await GaiaModeLoader.load("sound");
    for (let position = 0; position < 10; position += 1) {
      document.querySelector("[data-sound-gallery-open]").click();
      document.querySelector("#sound-close").click();
    }
    await new Promise((resolve) => setTimeout(resolve, 320));
    // Closing sound restores its previous route (which can reopen the map).
    // Explicitly close that restored map before checking renderer teardown.
    GaiaMapObservationAdapter.closeMap();
    return {
      initialCanvasCount,
      finalCanvasCount: document.querySelectorAll("canvas").length,
      initialSpaceCanvasCount,
      finalSpaceCanvasCount: document.querySelectorAll("#space-canvas").length,
      spaceCanvasReused,
      initialAudioCount,
      finalAudioCount: document.querySelectorAll("audio").length,
      soundLayerCount: document.querySelectorAll("#sound-layer").length,
      soundHidden: document.querySelector("#sound-layer").hidden,
      map: GaiaMapObservationAdapter.getState(),
      space: GaiaSpaceTourAdapter.getState(),
    };
  });
  assert.equal(lifecycle.initialSpaceCanvasCount, 0, "space canvas must stay lazy before space loads");
  assert.equal(lifecycle.finalSpaceCanvasCount, 1, "space must create one canvas only");
  assert.equal(lifecycle.spaceCanvasReused, true, "space must reuse its canvas across open and close cycles");
  assert.equal(lifecycle.finalAudioCount, lifecycle.initialAudioCount, "sound mode must reuse the existing audio player");
  assert.equal(lifecycle.soundLayerCount, 1, "sound mode must mount one layer only");
  assert.equal(lifecycle.soundHidden, true);
  assert.equal(lifecycle.map.mapOpen, false);
  assert.equal(lifecycle.space.open, false);
  assert.equal(lifecycle.space.frameActive, false);
  const contextLossTriggered = await lifecyclePage.evaluate(() => {
    const gl = document.querySelector("#gaia-canvas")?.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  if (contextLossTriggered) {
    await lifecyclePage.waitForSelector("#error-panel:not([hidden])", { timeout: 10_000 });
    assert.equal(await lifecyclePage.locator("#error-panel a[href*='#tour']").isVisible(), true, "context loss must retain the guide exit");
    assert.equal(await lifecyclePage.locator("#error-panel a[href*='github.com']").isVisible(), true, "context loss must retain the source exit");
  }
  report.resilience.contextLoss = contextLossTriggered ? "passed" : "extension-unavailable";
  report.resilience.lifecycle = lifecycle;
  const lodResult = await lifecyclePage.evaluate(() => {
    const governor = new globalThis.GaiaFrameBudgetGovernorClass({ autoStart: false, initialLevel: "high", now: () => 20_000 });
    const feed = (duration, periods) => {
      for (let index = 0; index < periods; index += 1) governor.__testFeedWindow(Array.from({ length: 120 }, () => duration));
    };
    feed(19, 2);
    const afterMedium = governor.getProfile().level;
    feed(19, 2);
    const afterLow = governor.getProfile().level;
    feed(23, 3);
    const afterSustainedLow = governor.getProfile().level;
    governor.reportFailure("webgl-unavailable");
    const result = { afterMedium, afterLow, afterSustainedLow, afterFatalFailure: governor.getProfile().level };
    globalThis.GaiaFrameBudgetGovernor.publish("deterministic-test-complete");
    return result;
  });
  assert.deepEqual(lodResult, {
    afterMedium: "medium",
    afterLow: "low",
    afterSustainedLow: "low",
    afterFatalFailure: "static",
  });
  const frameTimes = await lifecyclePage.evaluate(() => new Promise((resolve) => {
    const samples = [];
    let previous = performance.now();
    const tick = (now) => {
      samples.push(now - previous);
      previous = now;
      if (samples.length >= 120) resolve(samples);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const sortedFrameTimes = [...frameTimes].sort((left, right) => left - right);
  const medianFrameMs = sortedFrameTimes[Math.floor(sortedFrameTimes.length / 2)];
  report.resilience.lod = { deterministic: lodResult, medianFps: 1000 / medianFrameMs, minimumFrameRate, activeLevel: await lifecyclePage.evaluate(() => document.documentElement.dataset.gaiaLod) };
  assert(report.resilience.lod.medianFps >= minimumFrameRate, `median frame rate ${report.resilience.lod.medianFps.toFixed(1)}fps below ${minimumFrameRate}fps floor`);
  assert.notEqual(report.resilience.lod.activeLevel, "static", "normal Chrome must not fall back to static rendering");
  await lifecycleContext.close();

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.unhandledRejections, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  for (const [index, context] of browser.contexts().entries()) {
    for (const [pageIndex, page] of context.pages().entries()) {
      await page.screenshot({ path: path.join(outputDir, `failure-${index}-${pageIndex}.png`) }).catch(() => {});
    }
  }
  report.status = "failed";
  report.failure = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
  qaServer?.closeAllConnections?.();
  await new Promise((resolve) => qaServer ? qaServer.close(resolve) : resolve());
}
