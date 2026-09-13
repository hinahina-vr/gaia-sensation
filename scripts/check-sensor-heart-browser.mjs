import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const output = path.resolve("artifacts/sensor-standard-heart");
fs.mkdirSync(output, { recursive: true });
// Own an isolated mock server: never toggle likes in the user's active session.
const server = spawn(process.execPath, ["scripts/serve-sensor-platform-qa.mjs", "4498"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let browser;
const report = { status: "running", checks: [], errors: [] };
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Mock server startup timed out")), 10000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Mock server exited: ${code}`)); });
    server.stdout.on("data", data => {
      if (data.toString().includes("sensor qa http://127.0.0.1:4498")) { clearTimeout(timeout); resolve(); }
    });
  });
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, hasTouch: width < 720 });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    const social = page.waitForResponse(response => response.url().endsWith("/api/web/v1/social") && response.ok());
    await page.goto("http://127.0.0.1:4498/sensors/?authenticated=1#map", { waitUntil: "domcontentloaded" });
    await social;
    await page.locator('.sensor-map-marker[data-sensor-id="sensor_browserqa"]').dispatchEvent("click");
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("sensor", { restoreFocus: false }));
    const like = page.locator("#public-sensor-detail .sensor-like-trigger");
    await like.waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    const icon = like.locator("svg");
    const geometry = await icon.evaluate(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, path: svg.querySelector("path").getAttribute("d") }));
    assert.equal(geometry.width, 22);
    assert.equal(geometry.height, 22);
    assert.equal(await icon.getAttribute("aria-hidden"), "true");
    assert.equal(await like.getAttribute("aria-pressed"), "false");
    assert.equal(await icon.evaluate(svg => getComputedStyle(svg).fill), "none");
    await like.screenshot({ path: path.join(output, `${width}-outline.png`) });
    if (width < 720) await like.tap(); else await like.click();
    await page.waitForFunction(() => document.querySelector(".sensor-like-trigger").getAttribute("aria-pressed") === "true");
    assert.notEqual(await icon.evaluate(svg => getComputedStyle(svg).fill), "none");
    assert.match(await like.getAttribute("aria-label"), /応援を取り消す/u);
    assert.equal(await icon.locator("path").getAttribute("d"), geometry.path);
    await like.screenshot({ path: path.join(output, `${width}-filled.png`) });
    await like.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector(".sensor-like-trigger").getAttribute("aria-pressed") === "false");
    assert.equal(await icon.evaluate(svg => getComputedStyle(svg).fill), "none");
    assert.equal(await icon.locator("path").getAttribute("d"), geometry.path);
    const box = await like.boundingBox();
    assert(box.width >= 44 && box.height >= 44);
    report.checks.push({ width, icon: geometry, toggle: "outline → filled → outline", target: box });
    await context.close();
    console.log(`PASS ${width}: standard SVG heart, mouse/touch toggle and keyboard undo`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  server.kill();
}
