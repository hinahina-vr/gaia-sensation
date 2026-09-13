import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const entry = fs.existsSync(path.join(moduleRoot, "index.mjs")) ? path.join(moduleRoot, "index.mjs") : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(entry).href);
const outputDir = path.resolve(outputArgument || "artifacts/opening-preload-browser");
fs.mkdirSync(outputDir, { recursive: true });
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of [
    { name: "pc-high-1440", width: 1440, height: 900, deviceMemory: 8, hardwareConcurrency: 8 },
    { name: "mobile-high-390", width: 390, height: 844, deviceMemory: 8, hardwareConcurrency: 8 },
    { name: "mobile-low-390", width: 390, height: 844, deviceMemory: 2, hardwareConcurrency: 2, compact: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "no-preference" });
    await enforceBrowserSecurity(context, baseUrl);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(({ deviceMemory, hardwareConcurrency }) => {
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => deviceMemory });
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => hardwareConcurrency });
    }, viewport);
    const page = await context.newPage();
    const requests = [];
    let requestPhase = "boot";
    await page.exposeFunction("__gaiaTestBootHandoff", () => { requestPhase = "sound-choice"; });
    await page.addInitScript(() => {
      window.addEventListener("gaia:boot-handoff", () => void window.__gaiaTestBootHandoff?.(), { once: true });
    });
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    page.on("request", (request) => requests.push({ url: request.url(), phase: requestPhase }));
    await page.route("**/opening.css*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.route("**/opening-mizu-01*.webp", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await page.goto(new URL("/", baseUrl).href, { waitUntil: "commit" });
    await page.locator("#gaia-boot").waitFor({ state: "visible" });
    assert.equal(await page.locator(".gaia-boot__planet").count(), 0, `${viewport.name}: removed boot planet returned`);
    await page.waitForFunction(() => {
      const logo = document.querySelector(".gaia-boot__logo");
      return logo instanceof HTMLImageElement && logo.complete && logo.naturalWidth > 0;
    });
    const bootLogo = await page.evaluate(() => {
      const logo = document.querySelector(".gaia-boot__logo");
      const rect = logo.getBoundingClientRect();
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 86;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(logo, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const alphas = [];
      for (let index = 3; index < pixels.length; index += 4) alphas.push(pixels[index]);
      return {
        src: logo.getAttribute("src"),
        alt: logo.alt,
        naturalWidth: logo.naturalWidth,
        naturalHeight: logo.naturalHeight,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        cornerAlpha: pixels[3],
        maximumAlpha: Math.max(...alphas),
        transparentPixels: alphas.filter((alpha) => alpha === 0).length,
        partialPixels: alphas.filter((alpha) => alpha > 0 && alpha < 255).length,
      };
    });
    assert.equal(bootLogo.src, "./assets/brand/brand-logo-dark-surface-590.webp", `${viewport.name}: boot did not select the optimized dark-surface logo`);
    assert.equal(bootLogo.alt, "惑星の放課後 — GAIA SENSATION", `${viewport.name}: boot logo alternative text changed`);
    assert.deepEqual([bootLogo.naturalWidth, bootLogo.naturalHeight], [590, 197], `${viewport.name}: optimized boot logo source dimensions changed`);
    assert.equal(bootLogo.cornerAlpha, 0, `${viewport.name}: boot logo background is not transparent`);
    assert(bootLogo.maximumAlpha >= 240 && bootLogo.transparentPixels > 1_000 && bootLogo.partialPixels > 1_000, `${viewport.name}: boot logo lost its solid strokes or soft alpha edges`);
    assert(bootLogo.rect.left >= 0 && bootLogo.rect.top >= 0 && bootLogo.rect.right <= viewport.width + 1 && bootLogo.rect.bottom <= viewport.height + 1, `${viewport.name}: boot logo escaped the viewport`);
    assert.equal(await page.locator("#gaia-opening-sound-modal").isVisible(), false, `${viewport.name}: sound setup appeared before critical styles`);
    assert.equal(await page.locator("#gaia-opening-preload").isVisible(), false, `${viewport.name}: opening preload replaced the lightweight boot view`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-boot.png`) });
    await page.locator("#gaia-opening-sound-modal").waitFor({ state: "visible" });
    await page.locator("#gaia-boot").waitFor({ state: "hidden" });
    if (requestPhase === "boot") requestPhase = "sound-choice";
    assert.equal(await page.evaluate(() => document.body.classList.contains("gaia-opening-active")), true, `${viewport.name}: opening cover state was lost`);
    for (const selector of [".status", ".guide", ".mode-caption", ".mode-nav", ".actions"]) {
      assert.equal(await page.locator(`.experience > ${selector}`).isVisible(), false, `${viewport.name}: ${selector} leaked through the opening`);
    }
    assert.equal(await page.locator("#gaia-opening-preload").isVisible(), false, `${viewport.name}: preload appeared before sound setup`);
    assert.equal(await page.evaluate(() => document.querySelector("#gaia-opening")?.classList.contains("is-active")), false, `${viewport.name}: opening started before sound setup`);
    const deferredDuringBoot = requests.filter(({ phase, url }) => phase === "boot" && /\/(?:assets\/audio|opening-(?:mizu|ame)-01|opening-(?:mizuha|amane)-keyvisual|open-data-archive-bg|gateway-keyvisual|mode-space-v2|sound-archive-bg|novel-title-keyvisual|novel-bg-festival-five-plane-projection)/u.test(url));
    assert.deepEqual(deferredDuringBoot, [], `${viewport.name}: later media started during the lightweight boot view`);
    assert(requests.some(({ phase, url }) => phase === "boot" && /\/assets\/brand\/brand-logo-dark-surface-(?:590|1180)\.webp$/u.test(url)), `${viewport.name}: optimized dark-surface logo was not requested during boot`);
    assert.equal(requests.some(({ url }) => url.endsWith("/assets/brand/brand-logo-light-surface.png")), false, `${viewport.name}: light-surface logo was unnecessarily requested on the dark boot`);
    await page.waitForTimeout(650);
    assert.equal(requests.some(({ phase, url }) => phase === "sound-choice" && /opening-(?:mizu|ame)-01/u.test(url)), false, `${viewport.name}: character art started before sound confirmation`);
    assert.equal(requests.some(({ url }) => /\/assets\/audio\//u.test(url)), false, `${viewport.name}: audio started before consent`);
    requestPhase = "after-choice";
    await page.locator("#gaia-opening-sound-off").click();
    await page.locator("#gaia-opening-sound-modal").waitFor({ state: "hidden" });
    await page.locator("#gaia-opening-preload").waitFor({ state: "visible" });
    assert.equal(await page.locator(".experience > .mode-caption").isVisible(), false, `${viewport.name}: observation copy appeared during opening preload`);
    assert.equal(await page.locator(".experience > .guide").isVisible(), false, `${viewport.name}: observation guide appeared during opening preload`);
    const scan = await page.evaluate(() => {
      const preload = document.querySelector("#gaia-opening-preload");
      const meter = document.querySelector(".gaia-preload-meter");
      const status = document.querySelector("#gaia-preload-status");
      const percent = document.querySelector("#gaia-preload-percent");
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      return {
        preloadVisible: visible(preload),
        preloadMarkCount: document.querySelectorAll(".gaia-preload-mark").length,
        percentVisible: visible(percent),
        meterVisible: visible(meter),
        statusVisible: visible(status),
        statusText: status.textContent.trim(),
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      };
    });
    assert.equal(scan.preloadVisible, true);
    assert.equal(scan.preloadMarkCount, 0);
    assert.equal(scan.percentVisible, true);
    assert.equal(scan.meterVisible, true);
    assert.equal(scan.statusVisible, true);
    assert.match(scan.statusText, /オープニング/u);
    assert.equal(scan.overflowX, 0);
    assert.equal(scan.overflowY, 0);
    const timing = await page.evaluate(() => {
      const mark = (name) => performance.getEntriesByName(name, "mark").at(-1)?.startTime ?? -1;
      return {
        click: mark("gaia:sound-choice-click"),
        feedback: mark("gaia:sound-choice-feedback-painted"),
        preload: mark("gaia:opening-preload-start"),
      };
    });
    assert(timing.click >= 0 && timing.feedback >= timing.click, `${viewport.name}: sound choice paint marks are missing`);
    assert(timing.feedback - timing.click < 100, `${viewport.name}: sound choice feedback took ${timing.feedback - timing.click}ms`);
    assert(timing.preload >= timing.feedback, `${viewport.name}: opening preload started before feedback paint`);
    const artwork = await page.evaluate(() => ({
      quality: document.documentElement.dataset.gaiaArtworkQuality,
      mizuha: getComputedStyle(document.querySelector("#gaia-opening")).getPropertyValue("--opening-mizuha-image"),
    }));
    assert.equal(artwork.quality, viewport.compact ? "compact" : "full", `${viewport.name}: capability tier changed`);
    assert.match(artwork.mizuha, viewport.compact ? /opening-mizu-01-834\.webp/u : /opening-mizu-01\.webp/u, `${viewport.name}: wrong adopted art tier`);
    for (const id of ['mizu', 'ame']) {
      assert(requests.some(({ phase, url }) => phase === 'after-choice' && url.endsWith(`opening-${id}-01${viewport.compact ? '-834' : ''}.webp`)), `${viewport.name}: adopted ${id} art never started`);
    }
    // The prologue is also the existing first-screen backdrop (budgeted separately).
    assert(requests.some(({ url }) => url.endsWith(`opening-prologue-01${viewport.compact ? '-834' : ''}.webp`)));
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    assert.equal(requests.some(({ url }) => /\/assets\/audio\//u.test(url)), false, `${viewport.name}: muted opening fetched audio`);
    await page.evaluate(() => {
      const opening = document.querySelector("#gaia-opening");
      const preload = document.querySelector("#gaia-opening-preload");
      opening.classList.remove("is-preloaded");
      preload.hidden = false;
    });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`) });
    report.scans.push({ viewport: viewport.name, requests, timing, ...scan, passed: true });
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

console.log("opening preload browser check passed");
