import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const [base = "http://127.0.0.1:4447", outputArgument = "artifacts/media-publication"] = process.argv.slice(2);
const output = path.resolve(root, outputArgument);
fs.mkdirSync(output, { recursive: true });
const removed = "assets/data/jaxa-fnf-riau.png";
const ledger = JSON.parse(fs.readFileSync(path.join(root, "docs/media-rights-ledger.json"), "utf8"));
assert(!Object.hasOwn(ledger, "accountPlanDisclosure"));
assert(ledger.assets.every(asset => !Object.hasOwn(asset, "accountPlan") && !Object.hasOwn(asset, "generationDateUnknownReason") && !Object.hasOwn(asset, "rightsReviewStatus")));
assert(!ledger.assets.some(asset => asset.path === removed));
assert(!fs.existsSync(path.join(root, removed)));
const byPath = new Map(ledger.assets.map(asset => [asset.path, asset]));
for (const file of ["assets/characters/amane-calm-07-v3.png", "assets/characters/aoneko-silhouette-imagegen-v3.png", "assets/characters/aoneko-silhouette-imagegen-v4.png", "assets/concept/brochure-ornament-earth-v1.webp"]) {
  assert.equal(byPath.get(file)?.generationService, "OpenAI Imagegen");
}
assert.equal(byPath.get("assets/audio/satellite-forecast-hope.mp3")?.generationService, "Suno AI");
assert.equal(byPath.get("assets/audio/gaia-map-ambient-harp-felt-piano.wav")?.generationService, "In-repository procedural synthesis (Node.js)");
assert.match(byPath.get("assets/maps/nasa-blue-marble-clouds-2048.jpg")?.generationService, /^NASA /);

const report = { status: "running", base, browser: "", scope: "Local static HTTP and desktop Chrome at two viewport sizes; external network blocked; no production deployment or physical phone test.", assets: ledger.assets.length, http: [], screens: [], pageErrors: [], missingLocalAssets: [], removedAssetRequests: [] };
for (const [file, expectedStatus] of [[removed, 404], ["assets/data/modis-land-cover-2023.png", 200], ["assets/data/viirs-night-lights-2016.png", 200], ["data/runtime/breathing-earth.c7d73667464f6504.json", 200]]) {
  const response = await fetch(new URL(file, base));
  const bytes = (await response.arrayBuffer()).byteLength;
  assert.equal(response.status, expectedStatus, file);
  if (expectedStatus === 200) assert(bytes > 0, file);
  report.http.push({ file, status: response.status, bytes });
}

const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
report.browser = browser.version();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, locale: "ja-JP" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on("pageerror", error => report.pageErrors.push(`${width}: ${error.message}`));
    page.on("request", request => { if (request.url().includes(removed)) report.removedAssetRequests.push(request.url()); });
    page.on("response", response => { if (response.status() === 404 && new URL(response.url()).origin === new URL(base).origin) report.missingLocalAssets.push(response.url()); });
    await page.goto(`${base}/?mode=2#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop();
    });
    for (const [index, title] of [[0, "積み重なるCO₂"], [2, "森と水のつながり"]]) {
      await page.locator(`.map-mode-bank [data-map-standard-index="${index}"]`).evaluate(button => button.click());
      await page.waitForFunction(title => document.querySelector("#japan-mode-title")?.textContent === title, title);
      await page.waitForFunction(index => index === 0 ? Boolean(document.querySelector("#japan-overlay")?.dataset.gosatProjectionKey) : Boolean(document.querySelector("#japan-overlay")?.dataset.forestMask), index);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      await page.waitForTimeout(2200);
      assert(await page.locator("#japan-overlay").isVisible());
      const state = await page.evaluate(() => ({ title: document.querySelector("#japan-mode-title").textContent, overlay: { ...document.querySelector("#japan-overlay").dataset }, map: GaiaMapObservationAdapter.getState() }));
      await page.screenshot({ path: path.join(output, `${width}-${index}.png`) });
      report.screens.push({ width, index, state });
    }
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.missingLocalAssets, []);
  assert.deepEqual(report.removedAssetRequests, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, assets: report.assets, httpChecks: report.http.length, browserScreens: report.screens.length, pageErrors: report.pageErrors.length, missingLocalAssets: report.missingLocalAssets.length, removedAssetRequests: report.removedAssetRequests.length }));
