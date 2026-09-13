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
const outputDir = path.resolve(outputArgument || "artifacts/primary-hash-routes-browser");
fs.mkdirSync(outputDir, { recursive: true });

const routes = [
  { hash: "#top", selector: "#intro-layer", className: "intro-open", classOwner: ".experience" },
  { hash: "#world", selector: "#japan-layer", bodyClass: null, close: "#japan-close" },
  { hash: "#character", selector: "#character-book-layer", className: "character-mode-open", classOwner: "body", close: "#character-book-close" },
  { hash: "#sound", selector: "#sound-layer", className: "sound-mode-open", classOwner: "body", close: "#sound-close" },
];
const requestedHash = process.env.GAIA_HASH_ROUTE || "";
const selectedRoutes = requestedHash ? routes.filter(({ hash }) => hash === requestedHash) : routes;
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-320", width: 320, height: 568, mobile: true },
];
if (requestedHash && selectedRoutes.length === 0 && requestedHash !== "#esp32") {
  throw new Error(`Unknown GAIA_HASH_ROUTE: ${requestedHash}`);
}
const report = { status: "running", routes: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const route of selectedRoutes) {
    for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, hasTouch: Boolean(viewport.mobile), isMobile: Boolean(viewport.mobile) });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.pageErrors.push(`${route.hash}/${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${route.hash}/${viewport.name}: ${response.url()}`);
    });
    await page.goto(new URL(`/${route.hash}`, baseUrl).href, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator(route.selector).waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector("#gaia-opening")?.hidden === true);
    assert.equal(new URL(page.url()).hash, route.hash, `${route.hash}: canonical hash changed during direct load`);
    if (route.className) {
      assert.equal(await page.evaluate(({ className, classOwner }) => document.querySelector(classOwner)?.classList.contains(className), route), true, `${route.hash}: mode class is missing`);
    }
    if (route.hash === "#top") {
      const storyAction = await page.locator(".intro-story-return[data-primary-action='true']").evaluate((button) => ({
        label: button.querySelector("strong")?.textContent.trim(),
        ariaLabel: button.getAttribute("aria-label"),
        arrowCount: button.querySelectorAll("b").length,
      }));
      assert.deepEqual(storyAction, { label: "物語をはじめる", ariaLabel: "物語をはじめる", arrowCount: 0 });
    }
    await page.screenshot({ path: path.join(outputDir, `${route.hash.slice(1)}-${viewport.name}.png`) });
    if (route.close) {
      await page.locator(route.close).click();
      await page.locator(route.selector).waitFor({ state: "hidden", timeout: 8_000 });
      await page.locator("#intro-layer").waitFor({ state: "visible", timeout: 8_000 });
      assert.equal(new URL(page.url()).hash, "#top", `${route.hash}: back control did not return to #top`);
    }
    report.routes.push({ ...route, viewport: viewport.name, url: page.url(), passed: true });
    await context.close();
    }
  }

  if (!requestedHash || requestedHash === "#esp32") {
  for (const viewport of viewports) {
  const sensorContext = await browser.newContext({ viewport, hasTouch: Boolean(viewport.mobile), isMobile: Boolean(viewport.mobile) });
  const sensorPage = await sensorContext.newPage();
  sensorPage.on("pageerror", (error) => report.pageErrors.push(`#esp32/${viewport.name}: ${error.message}`));
  await sensorPage.goto(new URL("/#esp32", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await sensorPage.waitForFunction(() => /\/sensors\/$/u.test(window.location.pathname) && window.location.hash === "#esp32");
  assert.match(await sensorPage.title(), /GAIA SENSEWARE/u);
  await sensorPage.locator(".sensor-topbar").waitFor({ state: "visible", timeout: 10_000 });
  await sensorPage.screenshot({ path: path.join(outputDir, `esp32-${viewport.name}.png`) });
  report.routes.push({ hash: "#esp32", viewport: viewport.name, url: sensorPage.url(), passed: true });
  await sensorContext.close();
  }
  }

  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`Primary hash route browser check passed: ${report.routes.length} routes`);
