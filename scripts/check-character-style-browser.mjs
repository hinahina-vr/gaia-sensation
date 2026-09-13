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
const outputDir = path.resolve(outputArgument || "artifacts/character-style-browser");
fs.mkdirSync(outputDir, { recursive: true });

const expected = Object.freeze({
  default: "gateway-keyvisual-v2.png",
  space: "mode-space-v2.png",
  sound: "sound-archive-bg-v3.png",
});
const report = { status: "running", baseUrl, captures: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  const context = await browser.newContext({ viewport: { width: 2048, height: 1152 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(response.url()); });
  await page.addInitScript(() => localStorage.setItem("gaia-senseware-bgm-volume", "0"));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.readyState === "complete");
  await page.evaluate(() => {
    document.querySelector("#gaia-opening")?.setAttribute("hidden", "");
    document.body.classList.remove("gaia-opening-active");
    window.dispatchEvent(new CustomEvent("gaia:return-to-intro"));
  });
  await page.locator("#intro-layer").waitFor({ state: "visible" });

  const capture = async (name) => {
    const visual = page.locator(`[data-intro-visual="${name}"]`);
    await visual.waitFor({ state: "visible" });
    await visual.evaluate(async (image) => {
      if (!image.complete) await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
      await image.decode?.();
    });
    const scan = await visual.evaluate((image) => ({
      src: image.currentSrc,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      opacity: getComputedStyle(image).opacity,
    }));
    assert(scan.src.endsWith(expected[name]), `${name}: stale character art ${scan.src}`);
    assert.equal(scan.naturalWidth, 1672, `${name}: image width`);
    assert.equal(scan.naturalHeight, 941, `${name}: image height`);
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), animations: "disabled" });
    report.captures.push({ name, ...scan });
  };

  await capture("default");
  await page.locator('[data-intro-path="space"]').first().click();
  await capture("space");
  await page.locator("#intro-path-back").click();
  await page.locator("#intro-path-stage").waitFor({ state: "visible" });
  await page.locator(".intro-path-card--sound").hover();
  await capture("sound");

  for (const asset of [
    "/assets/visuals-08/opening-mizuha-keyvisual-v1.png",
    "/assets/visuals-08/opening-amane-keyvisual-v1.png",
  ]) {
    const openingResponse = await page.request.get(new URL(asset, baseUrl).href);
    assert.equal(openingResponse.status(), 200, `opening character art is unavailable: ${asset}`);
  }
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  await context.close();
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Character style browser check passed: ${report.captures.length} gateway states`);
