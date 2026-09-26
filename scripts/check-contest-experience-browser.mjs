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

const startBaseExposureProbe = (page) => page.evaluate(() => {
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
      && Number.parseFloat(style.opacity || "1") > 0.01;
    if (visible) {
      samples.push({
        reason,
        at: performance.now(),
        body: document.body.className,
        experience: document.querySelector(".experience")?.className || "",
      });
    }
  };
  const observer = new MutationObserver(() => inspect("mutation"));
  observer.observe(document.body, { attributes: true, childList: true, subtree: true });
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
      observer.disconnect();
      return [...samples];
    },
  };
});
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
  await startBaseExposureProbe(guideEntryPage);
  await guideEntryPage.locator("#gaia-opening-route-other").click();
  await guideEntryPage.waitForFunction(() => globalThis.GaiaIntroEntryGuide?.getState?.().active === true, null, { timeout: 30_000 });
  await guideEntryPage.waitForTimeout(500);
  const forbiddenBaseExposure = await stopBaseExposureProbe(guideEntryPage);
  assert.deepEqual(forbiddenBaseExposure, [], "Breathing Earth base must never enter the paint tree during the opening-to-data-guide handoff");
  assert.equal(await guideEntryPage.locator("[data-intro-guide]").count(), 4);
  assert.equal(await guideEntryPage.evaluate(() => location.hash), "#top");
  await guideEntryPage.screenshot({ path: path.join(outputDir, "opening-data-entry-guide.png"), animations: "disabled" });
  await guideEntryPage.evaluate(() => globalThis.GaiaIntroEntryGuide.close());
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
  await spaceEntryPage.locator("#gaia-opening-route-other").click();
  await spaceEntryPage.waitForFunction(() => document.querySelector("#intro-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 30_000 });
  await spaceEntryPage.waitForFunction(() => globalThis.GaiaIntroEntryGuide?.getState?.().active === true, null, { timeout: 30_000 });
  await spaceEntryPage.evaluate(() => globalThis.GaiaIntroEntryGuide.close({ restoreFocus: false }));
  await spaceEntryPage.waitForTimeout(500);
  await spaceEntryPage.locator("[data-intro-path='map']").click();
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
  await directPage.evaluate(() => { location.hash = "#japan"; });
  await directPage.waitForFunction(() => location.hash === "#japan");
  await directPage.goBack({ waitUntil: "domcontentloaded" });
  assert.equal(await directPage.evaluate(() => location.hash), "#earth");
  await directPage.goForward({ waitUntil: "domcontentloaded" });
  assert.equal(await directPage.evaluate(() => location.hash), "#japan");
  await directPage.reload({ waitUntil: "domcontentloaded" });
  await directPage.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter), null, { timeout: 30_000 });
  await completeMapEntry(directPage);
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
  const liveExhibitContracts = new Map([
    ["15", { id: "wind-field", key: "weatherWindSpeed", title: "街を通る風", caption: /^Open-Meteoの47都道府県代表都市の風速モデル値を、同じ色尺度で比べます。光の線の色と太さが速さを表し、線の向きは風向ではありません。$/u, anchor: /Open-Meteo/u }],
    ["16", { id: "carbon-pulse", key: "forecastCo2", title: "街の空気にある炭素", caption: /^CAMSの東京に対応する格子のCO₂濃度予測です。光の輪は濃度を表す演出で、東京の排出量、室内濃度、個人が吸った量を示しません。$/u, anchor: /CAMSモデル/u }],
    ["17", { id: "rain-chorus", key: "weatherPrecipitation", title: "雨と暮らす街", caption: /^Open-Meteoの東京の降水量モデル値を、雨粒と波紋で表します。値の対象時刻と単位を確かめてください。雨の筋や波紋は浸水域や洪水の予測ではありません。$/u, anchor: /Open-Meteo/u }],
    ["18", { id: "temperature-field", key: "weatherTemperature", title: "街の暑さ、街の寒さ", caption: /^Open-Meteoの東京の地上2m気温のモデル値を、色と揺らぎで表します。室内温度、体感温度、個人の熱中症リスクを示す値ではありません。$/u, anchor: /Open-Meteo/u }],
    ["19", { id: "cloud-drift", key: "cloudCover", title: "今日の空の覆い", caption: /^Open-Meteoの東京の総雲量を、空を覆う割合（0〜100%）として読みます。雲の重なりは演出で、衛星画像や日射量そのものではありません。$/u, anchor: /Open-Meteo/u }],
    ["20", { id: "pm25-haze", key: "pm25", title: "吸い込む空気", caption: /^CAMSの東京に対応する格子のPM2.5濃度予測です。霞は値に応じた演出で、実測の煙、汚染源、個人の曝露量や健康被害を示しません。$/u, anchor: /CAMSモデル/u }],
  ]);
  let liveExhibitIndex = 0;
  for (const [number, contract] of liveExhibitContracts) {
    if (liveExhibitIndex === 0) {
      await directPage.locator(".map-dock-bank-trigger:visible, [data-map-bank-toggle]:visible").first().click();
      await directPage.locator('.map-mode-bank [role="tab"][data-map-scope="japan"]').click();
      await directPage.locator(`.map-mode-bank [data-live-exhibit]`, { hasText: number }).click();
    } else {
      await directPage.locator(".gaia-live-deck-chapter [data-live-deck-step='1']").click();
    }
    await directPage.waitForFunction((expected) => document.querySelector("#japan-mode-number")?.textContent === expected, number);
    await directPage.evaluate(() => { GaiaLiveExhibits.selectObservationPoint("tokyo"); GaiaLiveExhibits.pausePoiAutoplay(); });
    await directPage.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity === "tokyo"
      && document.querySelector("#japan-layer")?.dataset.livePoiTransition === "settled");
    assert.equal(await directPage.locator("#gaia-live-exhibit-canvas").isVisible(), true, `${number}: live exhibit canvas hidden`);
    assert.equal(await directPage.locator(".gaia-live-exhibit-readout").isVisible(), true, `${number}: live exhibit readout hidden`);
    assert.equal(await directPage.locator("#japan-mode-number").textContent(), number, `${number}: bank heading mismatch`);
    const question = await directPage.evaluate((id) => GaiaLiveExhibits.definitions.find(definition => definition.id === id).question, contract.id);
    assert.equal(await directPage.locator("#japan-title").textContent(), contract.title, `${number}: main heading mismatch`);
    assert.equal(await directPage.locator("[data-live-deck-question]").textContent(), question, `${number}: observation question mismatch`);
    assert.equal(await directPage.locator("[data-live-deck-question]").isVisible(), true, `${number}: observation question hidden`);
    assert.match(await directPage.locator("[data-live-exhibit-caption]").textContent(), contract.caption, `${number}: explanatory contract changed`);
    assert.equal(await directPage.locator(".gaia-live-deck-wave, [data-live-wave-bar]").count(), 0, `${number}: retired decorative waveform returned`);
    assert.equal(await directPage.locator("[data-live-exhibit-feed-state]").isVisible(), true, `${number}: live/snapshot state is not visible`);
    assert.match(await directPage.locator("[data-live-exhibit-feed-state]").textContent(), /最新モデル値|公開観測値|保存データを再現中|データを更新中/u, `${number}: live/snapshot state is ambiguous`);
    assert.match(await directPage.locator("[data-live-exhibit-feed-time]").textContent(), /(?:JST|観測時刻なし)$/u, `${number}: data time or missing-time state is ambiguous`);
    assert.match(await directPage.locator("[data-live-exhibit-feed-copy]").textContent(), /自動更新|5分ごと|保存済み(?:観測|モデル)|キャッシュ/u, `${number}: live or saved-data behavior is not explained`);
    assert.equal(await directPage.locator(".gaia-live-exhibit-touch-hint").count(), 0, `${number}: retired touch hint returned`);
    assert.equal(await directPage.locator(".gaia-live-exhibit-path li").count(), 3, `${number}: observation-to-light path must have three stages`);
    for (const selector of ["[data-live-exhibit-input]", "[data-live-exhibit-location]", "[data-live-exhibit-visual-map]"]) {
      assert((await directPage.locator(selector).textContent()).trim().length >= 12, `${number}: ${selector} explanation is missing`);
    }
    assert.equal(await directPage.locator(".gaia-live-exhibit-anchor").isVisible(), true, `${number}: geographic observation anchor hidden`);
    assert.match(await directPage.locator("[data-live-anchor-label]").textContent(), /東京/u, `${number}: selected observation city mismatch`);
    assert.equal(await directPage.locator(".gaia-live-exhibit-readout [data-live-sound-toggle]").count(), 0, `${number}: retired generated sound control is still present`);
    assert.equal(await directPage.locator(".gaia-live-exhibit-readout").getByText(/展示音|BPM/u).count(), 0, `${number}: retired generated sound copy is still present`);
    const standardOverlayStyle = await directPage.locator("#japan-overlay").evaluate((overlay) => ({
      opacity: getComputedStyle(overlay).opacity,
      visibility: getComputedStyle(overlay).visibility,
      liveBackdrop: overlay.dataset.liveBackdrop,
    }));
    assert(Number(standardOverlayStyle.opacity) >= 0.58, `${number}: reference world map is too faint`);
    assert.equal(standardOverlayStyle.visibility, "visible", `${number}: reference world map is hidden`);
    assert.equal(standardOverlayStyle.liveBackdrop, "reference-map-only", `${number}: live backdrop leaked a standard exhibit layer`);
    await directPage.waitForFunction((expectedMode) => (
      document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === String(expectedMode)
    ), liveExhibitIndex);
    const liveGeography = await directPage.locator("#gaia-live-exhibit-canvas").evaluate((canvas) => ({
      anchorLongitude: Number(canvas.dataset.anchorLongitude),
      anchorLatitude: Number(canvas.dataset.anchorLatitude),
      anchorX: Number(canvas.dataset.anchorNormalizedX),
      anchorY: Number(canvas.dataset.anchorNormalizedY),
      signalStrength: Number(canvas.dataset.signalStrength),
      signalKey: canvas.dataset.signalKey,
      lightTouchIntegration: canvas.dataset.lightTouchIntegration,
    }));
    assert(liveGeography.anchorLongitude >= 122 && liveGeography.anchorLongitude <= 154, `${number}: observation longitude left Japan`);
    assert(liveGeography.anchorLatitude >= 20 && liveGeography.anchorLatitude <= 46, `${number}: observation latitude left Japan`);
    assert(liveGeography.anchorX >= 0 && liveGeography.anchorX <= 1 && liveGeography.anchorY >= 0 && liveGeography.anchorY <= 1, `${number}: Tokyo anchor is outside the visible map`);
    assert(liveGeography.signalStrength >= 0 && liveGeography.signalStrength <= 1, `${number}: normalized signal strength is invalid`);
    assert.equal(liveGeography.signalKey, contract.key, `${number}: visual field is not bound to its measurement key`);
    assert.equal(liveGeography.lightTouchIntegration, "abstract-light-touch");
    if (number === "15") {
      const openData = directPage.locator("[data-live-deck-source]");
      assert.equal(await openData.isVisible(), true, "10: live SOURCE action is not visible");
      await openData.click();
      await directPage.waitForFunction(() => document.querySelector("#japan-data-panel")?.getAttribute("aria-hidden") === "false");
      assert.match(await directPage.locator("#data-ledger-mode-title").textContent(), /^15 街を通る風/u, "15: live source panel shows a standard exhibit ledger");
      assert.match(await directPage.locator("#data-ledger-updated").textContent(), /(?:JST|取得日時：—)$/u, "10: source retrieval time or missing-time state is ambiguous");
      assert.match(await directPage.locator("#data-ledger-sources").textContent(), /Open-Meteo/u, "10: source provider is absent from the ledger");
      assert.match(
        await directPage.locator("#data-ledger-sources a").first().getAttribute("href"),
        /(?:open-meteo\.com|live-observation-fallback-v1\.json)/u,
        "10: active API or saved-snapshot source link is missing",
      );
      await directPage.locator("#japan-data-close").click();
    }
    assert.equal(await directPage.locator("[data-live-light-touch]").count(), 0, `${number}: retired light-touch button remains`);
    assert.deepEqual(await directPage.locator(".gaia-live-deck-actions strong").allTextContents(), ["データの出典", "統計分析"]);
    assert.equal(await directPage.evaluate(() => typeof globalThis.GaiaProceduralAudio), "undefined", `${number}: retired generated sound runtime was loaded`);
    assert.equal(await directPage.evaluate(() => globalThis.GaiaOpeningAudio.getState().mixGain), 1, `${number}: map BGM was altered by the retired exhibit sound path`);
    await directPage.screenshot({ path: path.join(outputDir, `live-exhibit-${number}.png`), animations: "disabled" });
    const beforeSurfaceTouch = Number(await directPage.locator("#gaia-live-exhibit-canvas").getAttribute("data-light-touch-count") || 0);
    await directPage.waitForTimeout(120);
    const liveMapPoint = await directPage.evaluate(() => {
      const map = document.querySelector("#japan-map");
      if (!(map instanceof HTMLElement)) return null;
      for (let y = 18; y < innerHeight - 18; y += 18) {
        for (let x = 18; x < innerWidth - 18; x += 18) {
          const target = document.elementFromPoint(x, y);
          if (target === map || map.contains(target)) return { x, y };
        }
      }
      return null;
    });
    assert(liveMapPoint, `${number}: live map has no unobstructed hit target`);
    await directPage.mouse.click(liveMapPoint.x, liveMapPoint.y);
    await directPage.waitForFunction((previousTouchCount) => Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.lightTouchCount || 0) > previousTouchCount, beforeSurfaceTouch);
    assert.equal(await directPage.locator("#japan-poi-card").isVisible(), false, `${number}: light touch leaked into the underlying map POI interaction`);
    const lightTouchesAfterMap = Number(await directPage.locator("#gaia-live-exhibit-canvas").getAttribute("data-light-touch-count") || 0);
    report.entry.liveVisual ??= [];
    report.entry.liveVisual.push({
      number,
      beforeSurfaceTouch,
      lightTouchesAfterMap,
      longitude: liveGeography.anchorLongitude,
      latitude: liveGeography.anchorLatitude,
      signalStrength: liveGeography.signalStrength,
    });
    await directPage.screenshot({ path: path.join(outputDir, `live-exhibit-${number}-touch.png`), animations: "disabled" });
    liveExhibitIndex += 1;
  }
  const liveCanvas = await directPage.evaluate(() => {
    const canvas = document.querySelector("#gaia-live-exhibit-canvas");
    globalThis.GaiaLiveExhibits.redraw();
    const gl = canvas.getContext("webgl");
    const sampleWidth = Math.min(128, canvas.width);
    const sampleHeight = Math.min(128, canvas.height);
    const sample = new Uint8Array(sampleWidth * sampleHeight * 4);
    gl.finish();
    gl.readPixels(
      Math.max(0, Math.floor((canvas.width - sampleWidth) / 2)),
      Math.max(0, Math.floor((canvas.height - sampleHeight) / 2)),
      sampleWidth,
      sampleHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sample,
    );
    return {
      width: canvas.width,
      height: canvas.height,
      engine: canvas.dataset.renderEngine,
      visualLanguage: canvas.dataset.visualLanguage,
      webglState: canvas.dataset.webglState,
      frame: Number(canvas.dataset.webglFrame),
      painted: sample.some((value, index) => index % 4 === 3 && value > 8),
      error: gl.getError(),
    };
  });
  assert(liveCanvas.width > 0 && liveCanvas.height > 0 && liveCanvas.painted, "live exhibit canvas was not painted");
  assert.equal(liveCanvas.engine, "webgl-aiva-field");
  assert.equal(liveCanvas.visualLanguage, "continuous-signal-field");
  assert.equal(liveCanvas.webglState, "active");
  assert(liveCanvas.frame > 0, "live WebGL field did not advance");
  assert.equal(liveCanvas.error, 0, "live WebGL field reported an error");
  assert.equal(await directPage.locator("[data-live-deck-source]").isVisible(), true, "live exhibit lost the visible SOURCE action");
  await directPage.locator(".gaia-live-deck-selector-toggle").click();
  await directPage.locator('.map-mode-bank [role="tab"][data-map-scope="world"]').click();
  await directPage.locator('.map-mode-bank [data-map-standard-index="0"]').click();
  await directPage.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit"));
  assert.equal(await directPage.locator("#gaia-live-exhibit-canvas").isVisible(), false, "standard exhibit did not close live canvas");
  assert.equal(await directPage.evaluate(() => typeof globalThis.GaiaProceduralAudio), "undefined", "retired generated sound runtime loaded after leaving live exhibits");
  assert.equal(await directPage.evaluate(() => globalThis.GaiaOpeningAudio.getState().mixGain), 1, "BGM ducking stayed active after leaving live exhibits");
  report.entry.liveExhibits = "passed";
  report.entry.history = "passed";
  await directContext.close();

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

  const live4kContext = await browser.newContext({ viewport: { width: 3840, height: 1960 } });
  const live4kPage = await live4kContext.newPage();
  await live4kPage.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"));
  monitor(live4kPage, "live-4k");
  await live4kPage.goto(new URL("/#japan", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await completeMapEntry(live4kPage);
  await live4kPage.waitForFunction(() => document.querySelectorAll(".map-mode-bank [data-live-exhibit]").length === 6, null, { timeout: 30_000 });
  await live4kPage.locator(".map-dock-bank-trigger:visible, [data-map-bank-toggle]:visible").first().click();
  await live4kPage.locator('.map-mode-bank [role="tab"][data-map-scope="japan"]').click();
  await live4kPage.locator('.map-mode-bank [data-live-exhibit="wind-field"]').click();
  await live4kPage.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === "0");
  await live4kPage.evaluate(() => { GaiaLiveExhibits.selectObservationPoint("tokyo"); GaiaLiveExhibits.pausePoiAutoplay(); });
  await live4kPage.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity === "tokyo"
    && document.querySelector("#japan-layer")?.dataset.livePoiTransition === "settled");
  const live4kVisualContract = await live4kPage.evaluate(() => {
    const fontSize = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const readout = document.querySelector(".gaia-live-exhibit-readout").getBoundingClientRect();
    const heading = document.querySelector(".japan-heading");
    const headingRect = heading.getBoundingClientRect();
    const hiddenDetails = [...document.querySelectorAll(".gaia-live-exhibit-a11y")].map((node) => node.getBoundingClientRect());
    return {
      readout: { left: readout.left, right: readout.right, top: readout.top, bottom: readout.bottom, width: readout.width, height: readout.height },
      titleOnlyHeader: {
        width: headingRect.width,
        height: headingRect.height,
        fontSize: fontSize("#japan-title"),
        titleFits: document.querySelector("#japan-title").scrollWidth <= document.querySelector("#japan-title").clientWidth,
        kickerHidden: getComputedStyle(heading.querySelector(".japan-kicker")).display === "none",
        descriptionHidden: heading.querySelector("#japan-description").getBoundingClientRect().width <= 1,
        dataButtonVisible: [...heading.querySelectorAll(".japan-data-button")].some((node) => node.getBoundingClientRect().width > 1),
      },
      titleFont: fontSize(".gaia-live-exhibit-primary h3"),
      valueFont: fontSize(".gaia-live-exhibit-primary > strong"),
      stageCueFont: fontSize(".gaia-live-exhibit-path li > em"),
      actionFont: fontSize(".gaia-live-exhibit-actions button"),
      bankButtonFont: fontSize(".map-mode-button"),
      standardBankButtonFont: fontSize(".map-mode-button:not([data-live-exhibit])"),
      anchorFont: fontSize(".gaia-live-exhibit-anchor strong"),
      symbolWidth: document.querySelector(".gaia-live-stage-symbol").getBoundingClientRect().width,
      symbolCount: document.querySelectorAll(".gaia-live-stage-symbol svg").length,
      hiddenDetails: hiddenDetails.every((rect) => rect.width <= 1 && rect.height <= 1),
      visibleParagraphCards: [...document.querySelectorAll(".gaia-live-exhibit-path p")].some((node) => node.getBoundingClientRect().width > 1),
      stageLabels: [...document.querySelectorAll(".gaia-live-exhibit-path li > b")].map((node) => node.textContent.trim()),
      stageCues: [...document.querySelectorAll(".gaia-live-exhibit-path li > em")].map((node) => node.textContent.trim()),
      explanationVisible: document.querySelector(".gaia-live-exhibit-explanation").getBoundingClientRect().height > 40,
      explanationFont: fontSize(".gaia-live-exhibit-summary"),
      sourceActionVisible: document.querySelector("[data-live-deck-source]").getBoundingClientRect().width > 1,
      feedState: document.querySelector("[data-live-exhibit-feed-state]").textContent.trim(),
    };
  });
  assert(live4kVisualContract.readout.left >= 0 && live4kVisualContract.readout.right <= 3840 && live4kVisualContract.readout.bottom <= 1960, "4K live panel overflows the viewport");
  assert(live4kVisualContract.readout.width >= 3648 && live4kVisualContract.readout.height >= 100 && live4kVisualContract.readout.height <= 128, `4K compact question deck dimensions changed: ${live4kVisualContract.readout.width}×${live4kVisualContract.readout.height}`);
  assert(live4kVisualContract.titleOnlyHeader.width >= 200 && live4kVisualContract.titleOnlyHeader.width <= 960 && live4kVisualContract.titleOnlyHeader.titleFits, "4K content-sized heading must fit its title without a fixed blank panel");
  assert(live4kVisualContract.titleOnlyHeader.height >= 44 && live4kVisualContract.titleOnlyHeader.height <= 72, "4K heading retains a readable single-row layout");
  assert(live4kVisualContract.titleOnlyHeader.fontSize >= 30 && live4kVisualContract.titleOnlyHeader.fontSize <= 32, "4K live heading does not use the standard map title size");
  assert.equal(live4kVisualContract.titleOnlyHeader.kickerHidden, true, "live heading still displays its kicker");
  assert.equal(live4kVisualContract.titleOnlyHeader.descriptionHidden, true, "live heading still displays explanatory prose");
  assert.equal(live4kVisualContract.titleOnlyHeader.dataButtonVisible, false, "legacy heading OPEN DATA action remains visible");
  assert.equal(live4kVisualContract.sourceActionVisible, true, "live deck does not expose SOURCE");
  assert(live4kVisualContract.titleFont >= 30 && live4kVisualContract.titleFont <= 32, `4K live title size changed: ${live4kVisualContract.titleFont}px`);
  assert(live4kVisualContract.valueFont >= 46 && live4kVisualContract.valueFont <= 50, `4K live value size changed: ${live4kVisualContract.valueFont}px`);
  assert(live4kVisualContract.stageCueFont >= 10 && live4kVisualContract.stageCueFont <= 12, `4K stage cue is not compact: ${live4kVisualContract.stageCueFont}px`);
  assert(live4kVisualContract.actionFont >= 11 && live4kVisualContract.actionFont <= 13, `4K action is not compact: ${live4kVisualContract.actionFont}px`);
  assert.equal(live4kVisualContract.bankButtonFont, live4kVisualContract.standardBankButtonFont, "live exhibit bank controls no longer match exhibits 01–09");
  assert(live4kVisualContract.anchorFont >= 17, `4K map anchor remains too small: ${live4kVisualContract.anchorFont}px`);
  assert.equal(live4kVisualContract.symbolWidth, 0, "hidden transformation details occupy the 4K live deck");
  assert.equal(live4kVisualContract.symbolCount, 3, "visual transformation semantics are incomplete");
  assert.equal(live4kVisualContract.explanationVisible, false, "legacy explanation panel remains visible in the 4K live deck");
  assert.match(live4kVisualContract.feedState, /最新モデル値|公開観測値|保存データを再現中|データを更新中/u, "4K live/snapshot state is ambiguous");
  assert.equal(live4kVisualContract.hiddenDetails, true, "long explanations must remain assistive-only");
  assert.equal(live4kVisualContract.visibleParagraphCards, false, "paragraph explanation cards remain visible");
  assert.deepEqual(live4kVisualContract.stageLabels, ["観測", "地図", "光"]);
  assert(live4kVisualContract.stageCues.every((value) => value.length >= 2), "visual transformation cues are incomplete");
  const live4kScreenshot = path.join(outputDir, "live-exhibit-15-4k.png");
  await live4kPage.screenshot({ path: live4kScreenshot, animations: "disabled" });
  report.entry.liveExhibit4k = { screenshot: live4kScreenshot, ...live4kVisualContract };
  await live4kContext.close();

  const liveMobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const liveMobilePage = await liveMobileContext.newPage();
  await liveMobilePage.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"));
  monitor(liveMobilePage, "live-mobile");
  await liveMobilePage.goto(new URL("/#japan", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await completeMapEntry(liveMobilePage);
  await liveMobilePage.waitForFunction(() => document.querySelectorAll(".map-mode-bank [data-live-exhibit]").length === 6, null, { timeout: 30_000 });
  await liveMobilePage.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("is-mobile-map-shell"));
  await liveMobilePage.locator('[data-mobile-sheet="exhibits"]').click();
  assert.equal(await liveMobilePage.locator("#map-mobile-sheet [data-mobile-exhibit]").count(), expectedExhibitCount);
  await liveMobilePage.locator('#map-mobile-sheet [role="tab"][data-map-scope="japan"]').click();
  await liveMobilePage.locator('#map-mobile-sheet [data-mobile-exhibit="15"]').click();
  await liveMobilePage.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === "0");
  const mobileReadout = await liveMobilePage.locator(".gaia-live-exhibit-readout").boundingBox();
  const mobileVisualContract = await liveMobilePage.evaluate(() => {
    const titleRect = document.querySelector(".japan-heading h2").getBoundingClientRect();
    const descriptionRect = document.querySelector("#japan-description").getBoundingClientRect();
    const headingRect = document.querySelector(".japan-heading").getBoundingClientRect();
    return {
      titleContained: titleRect.left >= 0 && titleRect.right <= innerWidth,
      descriptionHidden: descriptionRect.width <= 1 && descriptionRect.height <= 1,
      englishTitleHidden: getComputedStyle(document.querySelector("[data-live-exhibit-title-en]")).display === "none",
      compactHeader: headingRect.height <= 130,
      bankCollapsed: !document.querySelector("#map-mobile-sheet").open,
      toolbar: [...document.querySelectorAll("#map-mobile-toolbar button")].map(node => ({ text: node.textContent.trim(), height: node.getBoundingClientRect().height })),
      detailsToggleVisible: document.querySelector('[data-mobile-sheet="reading"]').getBoundingClientRect().height >= 44,
      detailsExpanded: document.querySelector('[data-mobile-sheet="reading"]').getAttribute("aria-expanded") === "true",
      explanationHidden: document.querySelector(".gaia-live-exhibit-explanation").getBoundingClientRect().height <= 1,
      valueFont: Number.parseFloat(getComputedStyle(document.querySelector(".gaia-live-exhibit-primary > strong")).fontSize),
    };
  });
  assert(mobileReadout && mobileReadout.x >= 0 && mobileReadout.x + mobileReadout.width <= 390, "mobile live readout overflows horizontally");
  assert(mobileReadout.y >= 80 && mobileReadout.y + mobileReadout.height <= 844, "mobile live readout does not preserve a visible map area");
  assert(mobileReadout.height <= 210, `mobile observation dock is not compact: ${mobileReadout.height}px`);
  assert.equal(mobileVisualContract.titleContained, true, "mobile exhibit title clips outside its readout");
  assert.equal(mobileVisualContract.descriptionHidden, true, "mobile live exhibit still displays instructional prose");
  assert.equal(mobileVisualContract.englishTitleHidden, true, "mobile exhibit title retains a space-consuming English subtitle");
  assert.equal(mobileVisualContract.compactHeader, true, "mobile live header still reserves space for hidden text controls");
  assert.equal(mobileVisualContract.bankCollapsed, true, "mobile exhibit bank does not collapse after selection");
  assert.equal(mobileVisualContract.detailsToggleVisible, true, "mobile exhibit details control is not touchable");
  assert.equal(mobileVisualContract.detailsExpanded, false, "mobile exhibit details must start collapsed");
  assert.equal(mobileVisualContract.explanationHidden, true, "mobile exhibit explanation still hides the map when collapsed");
  assert(mobileVisualContract.valueFont >= 20, "mobile live value is too small");
  assert.deepEqual(mobileVisualContract.toolbar.map(button => button.text), ["前へ", "展示一覧", "読み方・凡例", "操作", "次へ"]);
  assert(mobileVisualContract.toolbar.every(button => button.height >= 44), "mobile toolbar controls are not touchable");
  const liveMobileScreenshot = path.join(outputDir, "live-exhibit-15-mobile.png");
  await liveMobilePage.screenshot({ path: liveMobileScreenshot, animations: "disabled" });
  await liveMobilePage.locator('[data-mobile-sheet="reading"]').click();
  await liveMobilePage.waitForFunction(() => document.querySelector("#map-mobile-sheet")?.open && document.querySelector("#map-mobile-sheet")?.dataset.panel === "reading");
  const mobileExpandedContract = await liveMobilePage.evaluate(() => ({
    explanationVisible: document.querySelector("#map-mobile-sheet .map-mobile-sheet-body").getBoundingClientRect().height > 70,
    explanationFont: Number.parseFloat(getComputedStyle(document.querySelector("#map-mobile-sheet .map-mobile-sheet-body")).fontSize),
    readingText: document.querySelector("#map-mobile-sheet .map-mobile-sheet-body").textContent,
    legacyToggleHidden: document.querySelector("#gaia-live-mobile-toggle").getBoundingClientRect().height === 0,
  }));
  assert(mobileExpandedContract.explanationVisible && mobileExpandedContract.explanationFont >= 13, "mobile exhibit explanation is missing or too small when expanded");
  assert.match(mobileExpandedContract.readingText, /このパネルを開いた時点/u, "reading panel must identify its snapshot timing");
  assert.match(mobileExpandedContract.readingText, /単位|m\/s|風速/u, "reading panel lost the observation legend");
  assert.equal(mobileExpandedContract.legacyToggleHidden, true, "legacy details toggle duplicates the shared reading action");
  const liveMobileExpandedScreenshot = path.join(outputDir, "live-exhibit-15-mobile-expanded.png");
  await liveMobilePage.screenshot({ path: liveMobileExpandedScreenshot, animations: "disabled" });
  await liveMobilePage.keyboard.press("Escape");
  assert.equal(await liveMobilePage.locator("#map-mobile-sheet").evaluate(node => node.open), false);
  assert.equal(await liveMobilePage.locator('[data-mobile-sheet="reading"]').evaluate(node => node === document.activeElement), true);
  report.entry.liveExhibitMobile = {
    screenshot: liveMobileScreenshot,
    expandedScreenshot: liveMobileExpandedScreenshot,
    ...mobileVisualContract,
    ...mobileExpandedContract,
  };
  await liveMobileContext.close();

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
  report.status = "failed";
  report.failure = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
  qaServer?.closeAllConnections?.();
  await new Promise((resolve) => qaServer ? qaServer.close(resolve) : resolve());
}
