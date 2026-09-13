import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4417"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/gallery-viewer-navigation");
fs.mkdirSync(outputDir, { recursive: true });

const galleryIds = [
  "first-encounter",
  "amane-closeup",
  "mizuha-closeup",
  "esp32-collaboration",
  "circle-welcome",
  "exhibition-finale",
];
const unlockedIds = galleryIds.slice(0, 3);
const viewports = [
  { name: "pc-1440", width: 1440, height: 900, mobile: false },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.mobile,
    isMobile: viewport.mobile,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
  });

  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate((ids) => {
    localStorage.setItem("gaiaSensewareNovel:cg-gallery:v1", JSON.stringify({ version: 1, unlocked: ids }));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 100, reducedMotion: false }));
    globalThis.GaiaNovel.open();
  }, unlockedIds);
  await page.locator("#novel-title-gallery-button").click();
  await page.locator("#novel-gallery-panel").waitFor({ state: "visible" });
  await page.locator('.novel-gallery-card[data-gallery-id="first-encounter"]').click();
  const viewer = page.locator("#novel-gallery-viewer");
  await viewer.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#novel-gallery-viewer-image")?.naturalWidth > 0);

  const initial = await page.evaluate(() => {
    const box = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
    const previous = document.querySelector("#novel-gallery-viewer-previous");
    const next = document.querySelector("#novel-gallery-viewer-next");
    return {
      id: document.querySelector("#novel-gallery-viewer").dataset.galleryId,
      count: document.querySelector("#novel-gallery-viewer-count").textContent.trim(),
      previousDisabled: previous.disabled,
      nextDisabled: next.disabled,
      previousLabel: previous.getAttribute("aria-label"),
      nextLabel: next.getAttribute("aria-label"),
      previousRect: box("#novel-gallery-viewer-previous"),
      nextRect: box("#novel-gallery-viewer-next"),
      closeRect: box("#novel-gallery-viewer-close"),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      viewerOverflowX: document.querySelector("#novel-gallery-viewer").scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(initial.id, galleryIds[0]);
  assert.equal(initial.count, "01 / 03");
  assert.equal(initial.previousDisabled, true);
  assert.equal(initial.nextDisabled, false);
  assert.match(initial.previousLabel, /ありません/u);
  assert.match(initial.nextLabel, /手元のあかり/u);
  assert(initial.previousRect.width >= 44 && initial.previousRect.height >= 44);
  assert(initial.nextRect.width >= 44 && initial.nextRect.height >= 44);
  assert.equal(intersects(initial.nextRect, initial.closeRect), false);
  assert.equal(initial.overflowX, false);
  assert.equal(initial.viewerOverflowX, false);

  await page.locator("#novel-gallery-viewer-next").click();
  await page.waitForFunction((id) => document.querySelector("#novel-gallery-viewer")?.dataset.galleryId === id
    && !document.querySelector("#novel-gallery-viewer")?.dataset.transitionState, galleryIds[1]);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction((id) => document.querySelector("#novel-gallery-viewer")?.dataset.galleryId === id
    && !document.querySelector("#novel-gallery-viewer")?.dataset.transitionState, galleryIds[2]);
  assert.equal(await page.locator("#novel-gallery-viewer-next").isDisabled(), true);
  assert.equal(await page.locator("#novel-gallery-viewer-count").textContent(), "03 / 03");
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction((id) => document.querySelector("#novel-gallery-viewer")?.dataset.galleryId === id
    && !document.querySelector("#novel-gallery-viewer")?.dataset.transitionState, galleryIds[1]);

  let swipeId = null;
  if (viewport.mobile) {
    const figure = page.locator("#novel-gallery-viewer-figure");
    const rect = await figure.boundingBox();
    assert(rect);
    const y = rect.y + Math.min(rect.height * 0.35, 220);
    await figure.dispatchEvent("pointerdown", { pointerId: 17, isPrimary: true, button: 0, clientX: rect.x + rect.width * 0.78, clientY: y });
    await figure.dispatchEvent("pointerup", { pointerId: 17, isPrimary: true, button: 0, clientX: rect.x + rect.width * 0.22, clientY: y + 3 });
    await page.waitForFunction((id) => document.querySelector("#novel-gallery-viewer")?.dataset.galleryId === id
      && !document.querySelector("#novel-gallery-viewer")?.dataset.transitionState, galleryIds[2]);
    swipeId = await viewer.getAttribute("data-gallery-id");
  }

  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gallery-viewer-navigation.png`), fullPage: false });
  const closeStartedAt = Date.now();
  await page.locator("#novel-gallery-viewer-close").click();
  const closeStart = await viewer.evaluate((element) => ({
    hidden: element.hidden,
    closing: element.classList.contains("is-closing"),
    transitionState: element.dataset.transitionState,
  }));
  assert.deepEqual(closeStart, { hidden: false, closing: true, transitionState: "closing" });
  await viewer.waitFor({ state: "hidden" });
  const closeDurationMs = Date.now() - closeStartedAt;
  assert(closeDurationMs >= 250, `close transition was only ${closeDurationMs}ms`);
  const restoredFocus = await page.evaluate(() => document.activeElement?.dataset.galleryId || "");
  assert.equal(restoredFocus, galleryIds[0]);

  report.scans.push({ viewport: viewport.name, initial, swipeId, closeStart, closeDurationMs, restoredFocus, passed: true });
  await context.close();
}

await browser.close();
assert.deepEqual(report.consoleErrors, []);
assert.deepEqual(report.pageErrors, []);
assert.deepEqual(report.responses404, []);
report.status = "passed";
fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
