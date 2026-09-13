import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173";
const outputDir = path.resolve(process.argv[3] || "artifacts/map-boundaries");
const viewport = {
  width: Number(process.argv[4]) || 1440,
  height: Number(process.argv[5]) || 900,
};
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({ viewport });
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(new URL("/?mode=1#world", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.GaiaModeLoader?.load === "function");
  await page.evaluate(() => window.GaiaModeLoader.load("exploration"));
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
  await page.evaluate(() => {
    document.body.classList.remove("gaia-opening-active");
    for (const selector of ["#gaia-opening", "#intro-layer", "#novel-layer", "#true-end-layer"]) {
      const layer = document.querySelector(selector);
      if (!layer) continue;
      layer.hidden = true;
      layer.inert = true;
      layer.setAttribute("aria-hidden", "true");
    }
    document.querySelector(".experience")?.classList.remove("intro-open");
    if (document.querySelector("#japan-layer")?.getAttribute("aria-hidden") !== "false") {
      document.querySelector("#japan-button")?.click();
    }
  });
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
  await page.waitForFunction(() => {
    const overlay = document.querySelector("#japan-overlay");
    return overlay?.dataset.worldBoundaryLayer === "country"
      && Number(overlay.dataset.worldBoundaryRingCount) >= 400
      && Number(overlay.dataset.prefectureBoundaryArcCount) >= 1000;
  });

  const world = await page.locator("#japan-overlay").evaluate((overlay) => ({ ...overlay.dataset }));
  assert.equal(world.worldBoundaryLayer, "country");
  assert.equal(world.prefectureBoundaryLayer, "hidden-global");
  assert.equal(world.referenceWorldCache, "ready");
  assert.ok(Number(world.referenceWorldRenderScale) > 0 && Number(world.referenceWorldRenderScale) <= 1);
  if (viewport.width > 2048 || viewport.height > 2048) {
    assert.ok(Number(world.referenceWorldRenderScale) < 1, "large viewport did not use the bounded map cache");
  }
  await page.screenshot({ path: path.join(outputDir, "world-country-borders.png") });

  await page.locator("#japan-mode-list .map-mode-button").nth(1).evaluate((button) => button.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector("#japan-overlay");
    return overlay?.dataset.viewTarget === "japan"
      && overlay.dataset.viewAnimation === "idle"
      && Number(overlay.dataset.earthZoom) >= 2.65
      && overlay.dataset.prefectureBoundaryLayer === "prefecture";
  });
  const japan = await page.locator("#japan-overlay").evaluate((overlay) => ({ ...overlay.dataset }));
  assert.equal(japan.worldBoundaryLayer, "country");
  assert.equal(japan.prefectureBoundaryLayer, "prefecture");
  assert.ok(Number(japan.prefectureBoundaryArcCount) >= 1000);
  await page.screenshot({ path: path.join(outputDir, "japan-prefecture-borders.png") });

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(" | ")}`);
  console.log(JSON.stringify({ status: "passed", world, japan, outputDir }, null, 2));
} finally {
  await browser.close();
}
