import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const entry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(entry).href);
const outputDir = path.resolve(outputArgument || "artifacts/opening-shooting-star-browser");
fs.mkdirSync(outputDir, { recursive: true });
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const scanViewport = async (viewport) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() => {
    localStorage.setItem("gaia:opening-route-guide:v3", "seen");
    globalThis.__gaiaShootingStarEvents = [];
    document.addEventListener("gaia:shooting-star", (event) => {
      globalThis.__gaiaShootingStarEvents.push({ at: performance.now(), ...event.detail });
    }, true);
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
  });

  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.locator("#gaia-opening-sound-off").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("#gaia-opening-sound-off").click();
  await page.locator("#gaia-opening-skip").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("#gaia-opening-skip").click();
  await page.locator("#gaia-opening-route-story").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => globalThis.__gaiaShootingStarEvents.length >= 1, null, { timeout: 8_000 });
  const first = await page.evaluate(() => globalThis.__gaiaShootingStarEvents[0]);
  assert(first.startX >= viewport.width * 0.23, `${viewport.name}: shooting star started too close to the left edge`);
  assert(first.startX <= viewport.width * 0.49, `${viewport.name}: shooting star entered the character-side half of the screen`);
  assert(first.startY <= viewport.height * 0.2, `${viewport.name}: shooting star did not start near the top edge`);
  assert(first.dx < 0 && first.dy > 0, `${viewport.name}: shooting star did not travel down and left`);
  assert(first.startX + first.dx < first.startX, `${viewport.name}: shooting star trajectory escaped toward the character side`);
  assert(first.duration >= 1200 && first.duration <= 1500, `${viewport.name}: shooting star duration is outside the calmer range`);
  assert(first.travel <= 320, `${viewport.name}: a large display enlarged the shooting star`);
  assert(first.travel <= viewport.width * 0.22, `${viewport.name}: a mobile minimum enlarged the shooting star`);
  assert(first.travel <= viewport.height * 0.3, `${viewport.name}: shooting star crosses too much of the sky`);
  const speed = first.travel / (first.duration / 1000);
  const previousTravel = Math.max(240, Math.min(viewport.width * 0.42, viewport.height * 0.86));
  assert(speed < (previousTravel / 1.18) * 0.65, `${viewport.name}: shooting star did not become slower`);
  assert(first.startX + first.dx >= 0, `${viewport.name}: shooting star disappears through the left screen edge`);
  assert(first.perspective >= 0.035 && first.perspective <= 0.065, `${viewport.name}: shooting star perspective model is outside its calibrated range`);
  assert(first.gravity >= first.travel * 0.022 && first.gravity <= first.travel * 0.035, `${viewport.name}: shooting star atmospheric drop is outside its calibrated range`);
  assert(first.trailFraction >= 0.12 && first.trailFraction <= 0.16, `${viewport.name}: shooting star trail persistence is outside its restrained range`);
  assert(first.travel * first.trailFraction <= 42.001, `${viewport.name}: shooting star tail is too long`);
  assert(first.coreWidth >= 0.38 && first.coreWidth <= 0.58, `${viewport.name}: shooting star core is too heavy`);
  assert(first.peakAlpha >= 0.42 && first.peakAlpha <= 0.54, `${viewport.name}: shooting star opacity is outside its restrained range`);

  await page.waitForTimeout(320);
  const canvasPng = await page.locator("#gaia-opening-particles").evaluate((canvas) => canvas.toDataURL("image/png"));
  fs.writeFileSync(
    path.join(outputDir, `${viewport.name}-canvas.png`),
    Buffer.from(canvasPng.replace(/^data:image\/png;base64,/u, ""), "base64"),
  );
  await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`) });
  await page.waitForFunction(() => globalThis.__gaiaShootingStarEvents.length >= 2, null, { timeout: 13_000 });
  const events = await page.evaluate(() => globalThis.__gaiaShootingStarEvents.slice(0, 2));
  const interval = events[1].at - events[0].at;
  assert(interval >= 8_900 && interval <= 11_100, `${viewport.name}: shooting star interval was ${interval}ms`);
  report.scans.push({ viewport, first, interval, speed, maxTrailPx: first.travel * first.trailFraction });
  await context.close();
};

try {
  for (const viewport of [
    { name: "pc-1440", width: 1440, height: 900 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "pc-4k", width: 3840, height: 2160 },
  ]) await scanViewport(viewport);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Opening shooting-star browser check passed: ${report.scans.length} viewports`);
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
