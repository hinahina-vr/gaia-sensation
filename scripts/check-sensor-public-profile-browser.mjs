import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const output = path.resolve("artifacts/sensor-public-profile");
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-sensor-platform-qa.mjs", "4498"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const report = { status: "running", checks: [], errors: [] };
let browser;
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
  for (const [width, height] of [[1440,900], [390,844], [320,568], [844,390]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900 });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:sensor:v3", "seen"));
    await page.goto("http://127.0.0.1:4498/sensors/?authenticated=1#map", { waitUntil: "domcontentloaded" });
    await page.locator('.sensor-map-marker[data-sensor-id="sensor_browserqa"]').dispatchEvent("click");
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("sensor", { restoreFocus: false }));
    const trigger = page.locator(".sensor-owner-profile-trigger");
    const dialog = page.locator("#public-owner-profile");
    const open = async () => {
      await trigger.click();
      await dialog.waitFor({ state: "visible" });
      await page.waitForTimeout(280);
    };
    await open();
    assert.equal(await page.locator("#public-owner-profile-name").textContent(), "青猫センサー");
    assert.equal(await page.locator("#public-owner-profile-sensor").textContent(), "ベランダ環境センサー");
    assert.match(await page.locator("#public-owner-profile-region").textContent(), /東京都.*渋谷区/u);
    assert.match(await page.locator("#public-owner-profile-note").textContent(), /実際の設置場所とは異なる/u);
    assert.equal(await page.locator("#public-owner-profile-links a").count(), 0);
    assert.match(await page.locator("#public-owner-profile-links").textContent(), /SNSリンクは登録されていません/u);
    const layout = await dialog.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, scroll: node.scrollHeight - node.clientHeight, overflowX: node.scrollWidth - node.clientWidth, radius: getComputedStyle(node).borderRadius, controls: [...node.querySelectorAll("button,a")].map(item => ({ width: item.getBoundingClientRect().width, height: item.getBoundingClientRect().height })) };
    });
    assert(layout.width <= Math.min(560, width) && layout.top >= 0 && layout.bottom <= height);
    assert(layout.overflowX <= 1);
    if (height >= 568) assert(layout.scroll <= 1, `Normal profile should fit without scrolling: ${JSON.stringify(layout)}`);
    assert(layout.controls.every(rect => rect.width >= 44 && rect.height >= 44));
    await dialog.screenshot({ path: path.join(output, `${width}-profile.png`) });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert(await trigger.evaluate(button => button === document.activeElement));
    await open();
    await page.locator(".sensor-public-profile-back").click();
    await dialog.waitFor({ state: "hidden" });
    assert(await trigger.evaluate(button => button === document.activeElement));
    await open();
    await dialog.locator(".sensor-dialog-close").click();
    await dialog.waitFor({ state: "hidden" });
    await page.locator('.sensor-map-marker[data-sensor-id="sensor_demo_ame"]').dispatchEvent("click");
    await open();
    assert.match(await page.locator("#public-owner-profile-note").textContent(), /展示用ダミーセンサー/u);
    assert.match(await page.locator("#public-owner-profile-links").textContent(), /SNSリンクは登録されていません/u);
    assert.equal(await dialog.getAttribute("data-demo"), "true");
    await dialog.screenshot({ path: path.join(output, `${width}-demo.png`) });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open();
    await dialog.locator(".sensor-dialog-close").click();
    assert.equal(await dialog.isVisible(), false);
    report.checks.push({ width, height, layout, links: "unset for preview owner and demo", dismiss: "escape / back / close / reduced-motion", demo: "disclosed; empty links" });
    await context.close();
    console.log(`PASS ${width}×${height}: profile, links, demo, dismissal and focus return`);
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
