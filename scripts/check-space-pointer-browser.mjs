import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4186"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/space-pointer-browser");
fs.mkdirSync(outputDir, { recursive: true });

const source = fs.readFileSync(path.resolve("space-mode.js"), "utf8");
const styles = fs.readFileSync(path.resolve("space-mode.css"), "utf8");
assert.match(styles, /\.space-canvas\s*\{[^}]*cursor:\s*default;/u, "space canvas must use the standard cursor");
assert(!source.includes("drawCursor"), "custom canvas cursor must stay removed");
assert(!source.includes("pointerGlow"), "passive pointer glow must stay removed");
assert(!source.includes("pointerRadius"), "passive pointer force must stay removed");

const report = {
  status: "running",
  baseUrl,
  cursor: "",
  passivePointerRingCount: -1,
  clickInteractionPreserved: false,
  layouts: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await enforceBrowserSecurity(context, baseUrl);
  await context.addInitScript(() => {
    window.__spaceArcCalls = [];
    const nativeArc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function patchedArc(x, y, radius, start, end, counterclockwise) {
      if (this.canvas?.id === "space-canvas") {
        window.__spaceArcCalls.push({ x, y, radius });
        if (window.__spaceArcCalls.length > 3000) window.__spaceArcCalls.splice(0, 1000);
      }
      return nativeArc.call(this, x, y, radius, start, end, counterclockwise);
    };
  });

  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(response.url()); });

  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof globalThis.GaiaModeLoader?.load === "function");
  await page.evaluate(async () => {
    await globalThis.GaiaModeLoader.load("space");
    const opening = document.querySelector("#gaia-opening");
    if (opening) {
      opening.hidden = true;
      opening.inert = true;
      opening.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("gaia-opening-active");
    globalThis.GaiaSpace.open(0);
  });
  await page.waitForFunction(() => document.body.classList.contains("space-mode-open") && !document.querySelector("#space-layer")?.hidden);
  await page.addStyleTag({ content: "#gaia-opening { display: none !important; }" });
  const canvas = page.locator("#space-canvas");
  await canvas.waitFor({ state: "visible" });
  const box = await canvas.boundingBox();
  assert(box, "space canvas has no layout box");

  const readLayout = (name) => page.evaluate((layoutName) => {
    const rectangle = (node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      name: layoutName,
      viewport: { width: innerWidth, height: innerHeight },
      close: rectangle(document.querySelector("#space-close")),
      header: rectangle(document.querySelector(".space-header")),
    };
  }, name);
  const desktopLayout = await readLayout("desktop");
  assert(desktopLayout.close.left <= 22, `desktop close is not left aligned: ${desktopLayout.close.left}`);
  assert(desktopLayout.close.top <= 22, `desktop close is not top aligned: ${desktopLayout.close.top}`);
  assert(desktopLayout.close.right < desktopLayout.viewport.width / 2, "desktop close stayed on the right");
  assert(desktopLayout.header.top >= desktopLayout.close.bottom + 12, "desktop header overlaps the close button");
  report.layouts.push(desktopLayout);

  report.cursor = await canvas.evaluate((node) => getComputedStyle(node).cursor);
  assert.equal(report.cursor, "default", "space canvas changed the OS cursor");

  await page.evaluate(() => { window.__spaceArcCalls.length = 0; });
  const pointer = {
    x: Math.round(box.x + box.width * 0.53),
    y: Math.round(box.y + box.height * 0.47),
  };
  await page.mouse.move(pointer.x, pointer.y);
  await page.waitForTimeout(300);
  report.passivePointerRingCount = await page.evaluate(({ pointer: screenPoint, box: canvasBox }) => {
    const localX = screenPoint.x - canvasBox.x;
    const localY = screenPoint.y - canvasBox.y;
    return window.__spaceArcCalls.filter((call) => (
      Math.hypot(call.x - localX, call.y - localY) < 3
      && call.radius >= 4
      && call.radius <= 40
    )).length;
  }, { pointer, box });
  assert.equal(report.passivePointerRingCount, 0, "passive mouse movement still draws a custom cursor ring");

  await page.screenshot({ path: path.join(outputDir, "space-standard-cursor.png"), animations: "disabled" });
  await canvas.evaluate((node, point) => {
    Object.defineProperty(node, "setPointerCapture", { configurable: true, value: () => {} });
    node.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      pointerId: 71,
      pointerType: "mouse",
      button: 0,
    }));
  }, pointer);
  report.clickInteractionPreserved = await page.locator("#space-layer").evaluate((node) => node.classList.contains("has-interacted"));
  assert.equal(report.clickInteractionPreserved, true, "space canvas click interaction was removed");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(160);
  const mobileLayout = await readLayout("mobile");
  assert(mobileLayout.close.left <= 16, `mobile close is not left aligned: ${mobileLayout.close.left}`);
  assert(mobileLayout.close.top <= 16, `mobile close is not top aligned: ${mobileLayout.close.top}`);
  assert(mobileLayout.close.right < mobileLayout.viewport.width / 2, "mobile close stayed on the right");
  assert(mobileLayout.header.top >= mobileLayout.close.bottom + 8, "mobile header overlaps the close button");
  assert(mobileLayout.close.right <= mobileLayout.viewport.width, "mobile close overflows the viewport");
  report.layouts.push(mobileLayout);
  await page.screenshot({ path: path.join(outputDir, "space-back-top-left-mobile.png"), animations: "disabled" });

  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(160);
  const narrowMobileLayout = await readLayout("mobile-320");
  assert(narrowMobileLayout.close.left <= 16, `mobile-320 close is not left aligned: ${narrowMobileLayout.close.left}`);
  assert(narrowMobileLayout.close.top <= 16, `mobile-320 close is not top aligned: ${narrowMobileLayout.close.top}`);
  assert(narrowMobileLayout.close.right < narrowMobileLayout.viewport.width / 2, "mobile-320 close stayed on the right");
  assert(narrowMobileLayout.header.top >= narrowMobileLayout.close.bottom + 8, "mobile-320 header overlaps the close button");
  assert(narrowMobileLayout.close.right <= narrowMobileLayout.viewport.width, "mobile-320 close overflows the viewport");
  report.layouts.push(narrowMobileLayout);

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await context.close();
} finally {
  await browser.close();
}
