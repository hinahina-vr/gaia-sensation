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
const outputDir = path.resolve(outputArgument || "artifacts/opening-route-navigation-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "pc-low-1366x600", width: 1366, height: 600 },
  { name: "mobile-280", width: 280, height: 653, mobile: true },
  { name: "mobile-320", width: 320, height: 568, mobile: true },
  { name: "landscape-568", width: 568, height: 320, mobile: true },
  { name: "landscape-844", width: 844, height: 390, mobile: true },
];
const routes = ["story", "map", "tour"];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const activate = async (locator, mobile) => {
  await locator.scrollIntoViewIfNeeded();
  if (mobile) await locator.tap();
  else await locator.click();
};

const assertActionable = async (page, locator, label) => {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      rect: rect.toJSON(),
      disabled: button.disabled,
      inert: Boolean(button.closest("[inert]")),
      hit: hit === button || Boolean(hit && button.contains(hit)),
    };
  });
  assert.equal(result.disabled, false, `${label}: button is disabled`);
  assert.equal(result.inert, false, `${label}: button is inert`);
  assert(result.rect.width >= 44 && result.rect.height >= 44, `${label}: hit area is too small: ${JSON.stringify(result.rect)}`);
  assert.equal(result.hit, true, `${label}: center point is covered: ${JSON.stringify(result)}`);
  return result;
};

const bootOpening = async (page, viewport) => {
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator("#gaia-opening-sound-off").waitFor({ state: "visible", timeout: 15_000 });
  await activate(page.locator("#gaia-opening-sound-off"), viewport.mobile);
  await page.locator("#gaia-opening-skip").waitFor({ state: "visible", timeout: 15_000 });
  await activate(page.locator("#gaia-opening-skip"), viewport.mobile);
  await page.locator("#gaia-opening-route-story").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => [...document.querySelectorAll("#gaia-opening-final-menu .gaia-opening-route")]
    .every((button) => !button.disabled && button.getClientRects().length > 0));
};

const runStoryRoute = async (page, viewport) => {
  const action = await assertActionable(page, page.locator("#gaia-opening-route-story"), `${viewport.name} story route`);
  await activate(page.locator("#gaia-opening-route-story"), viewport.mobile);
  await page.waitForFunction(() => !document.querySelector('#gaia-story-prologue') && location.hash === '#story' && (
    document.querySelector("#novel-title-screen")?.checkVisibility()
    || Boolean(document.querySelector("#novel-layer")?.dataset.stepId)
  ), null, { timeout: 25_000 });
  assert.equal(new URL(page.url()).hash, "#story", `${viewport.name}: story hash was not selected`);
  const titleVisible = await page.locator("#novel-title-screen").isVisible();
  if (titleVisible) {
    const start = page.locator("#novel-start-button");
    await assertActionable(page, start, `${viewport.name} story start`);
    await activate(start, viewport.mobile);
  }
  await page.waitForFunction(() => Boolean(document.querySelector("#novel-layer")?.dataset.stepId), null, { timeout: 15_000 });
  const stepId = await page.locator("#novel-layer").getAttribute("data-step-id");
  assert(stepId, `${viewport.name}: story did not reach its first step`);
  return { action, titleVisible, stepId, hash: new URL(page.url()).hash };
};

const runMapRoute = async (page, viewport) => {
  const action = await assertActionable(page, page.locator("#gaia-opening-route-other"), `${viewport.name} map route`);
  await activate(page.locator("#gaia-opening-route-other"), viewport.mobile);
  await page.locator("#intro-layer").waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(new URL(page.url()).hash, "#top", `${viewport.name}: exploration hash was not selected`);
  const mapCard = page.locator('[data-intro-path="map"]');
  await assertActionable(page, mapCard, `${viewport.name} intro map card`);
  await activate(mapCard, viewport.mobile);
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll('.map-mode-bank .map-mode-button').length >= 12
    && document.querySelector('.map-mode-bank .map-mode-button[aria-current="true"]'), null, { timeout: 20_000 });
  const mapState = await page.evaluate(() => ({
    hidden: document.querySelector("#japan-layer")?.hidden,
    modeButtons: document.querySelectorAll(".map-mode-bank .map-mode-button").length,
    activeMode: document.querySelector(".map-mode-bank .map-mode-button[aria-current='true']")?.textContent?.trim(),
  }));
  assert.equal(mapState.hidden, false, `${viewport.name}: map remained hidden`);
  assert(mapState.modeButtons >= 12 && mapState.activeMode, `${viewport.name}: map controls did not initialize: ${JSON.stringify(mapState)}`);
  return { action, hash: new URL(page.url()).hash, mapState };
};

const runTourRoute = async (page, viewport) => {
  // The title now has two entrances. The tour remains a supported direct URL,
  // not a removed third title button.
  const action = { source: 'direct-tour-url' };
  await page.goto(new URL('/?qa=direct-tour#tour', baseUrl).href, { waitUntil: 'domcontentloaded' });
  const layer = page.locator("#gaia-guided-tour");
  await layer.waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(new URL(page.url()).hash, "#tour", `${viewport.name}: tour hash was not selected`);
  const visited = [];
  for (let expectedIndex = 0; expectedIndex < 3; expectedIndex += 1) {
    await page.waitForFunction((index) => globalThis.GaiaGuidedTour?.getState?.().index === index, expectedIndex, { timeout: 15_000 });
    visited.push(await page.evaluate(() => globalThis.GaiaGuidedTour.getState().stepId));
    const next = page.locator('[data-tour-action="next"]');
    await assertActionable(page, next, `${viewport.name} tour next ${expectedIndex + 1}`);
    await activate(next, viewport.mobile);
  }
  await page.locator("[data-tour-finish]").waitFor({ state: "visible", timeout: 15_000 });
  const explore = page.locator('[data-tour-destination="explore"]');
  await assertActionable(page, explore, `${viewport.name} tour explore destination`);
  await activate(explore, viewport.mobile);
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false", null, { timeout: 20_000 });
  assert.equal(await layer.isHidden(), true, `${viewport.name}: tour remained open after selecting explore`);
  return { action, visited, destination: "map", mapHidden: await page.locator("#japan-layer").isHidden() };
};

try {
  for (const viewport of viewports.filter(viewport => !process.env.GAIA_ROUTE_VIEWPORTS || process.env.GAIA_ROUTE_VIEWPORTS.split(',').includes(viewport.name))) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: Boolean(viewport.mobile),
        isMobile: Boolean(viewport.mobile),
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
      });
      await context.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("gaia-senseware-bgm-volume", "0");
      });
      const page = await context.newPage();
      const label = `${viewport.name}-${route}`;
      page.on("console", (message) => {
        if (message.type() !== "error" || message.text().includes("ERR_NETWORK_ACCESS_DENIED") || message.text().includes("status of 401")) return;
        report.consoleErrors.push(`${label}: ${message.text()}`);
      });
      page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
      page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
      await bootOpening(page, viewport);
      const result = route === "story"
        ? await runStoryRoute(page, viewport)
        : route === "map"
          ? await runMapRoute(page, viewport)
          : await runTourRoute(page, viewport);
      await page.screenshot({ path: path.join(outputDir, `${label}.png`), fullPage: false, animations: "disabled" });
      report.scans.push({ viewport: viewport.name, route, result, passed: true });
      await context.close();
    }
  }
  assert.deepEqual(report.consoleErrors, [], `console errors: ${JSON.stringify(report.consoleErrors)}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${JSON.stringify(report.pageErrors)}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${JSON.stringify(report.responses404)}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Opening route navigation passed: ${report.scans.length} viewport-route combinations`);
