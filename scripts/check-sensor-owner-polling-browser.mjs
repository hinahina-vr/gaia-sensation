import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/sensor-owner-polling");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const report = { status: "running", samples: {}, consoleErrors: [], pageErrors: [], responses404: [] };
const countRequests = (qa, suffix) => qa.requests
  .filter(({ method, path: requestPath }) => method === "GET" && requestPath.endsWith(suffix)).length;
const readCounts = async () => {
  const qa = await (await fetch(new URL("/__qa/report", baseUrl))).json();
  return {
    latest: countRequests(qa, "/latest"),
    history: countRequests(qa, "/telemetry"),
  };
};

try {
  await fetch(new URL("/__qa/reset", baseUrl), { method: "POST" });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    globalThis.__gaiaQaVisibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => globalThis.__gaiaQaVisibility,
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => globalThis.__gaiaQaVisibility !== "visible",
    });
    const nativeSetInterval = globalThis.setInterval.bind(globalThis);
    globalThis.setInterval = (callback, delay, ...args) => nativeSetInterval(
      callback,
      delay === 30_000 ? 80 : delay,
      ...args,
    );
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(response.url());
  });

  await page.goto(new URL("/sensors/?authenticated=1#device=dev_browser_qa", baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await page.locator("[data-view='detail']").waitFor({ state: "visible" });
  await page.waitForTimeout(280);
  report.samples.visible = await readCounts();
  assert(report.samples.visible.latest >= 3, "visible detail did not poll the latest endpoint");
  assert.equal(report.samples.visible.history, 1, "automatic polling reloaded owner history");

  await page.evaluate(() => {
    globalThis.__gaiaQaVisibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(120);
  report.samples.hiddenStart = await readCounts();
  await page.waitForTimeout(280);
  report.samples.hiddenEnd = await readCounts();
  assert.deepEqual(report.samples.hiddenEnd, report.samples.hiddenStart, "hidden detail continued polling");

  await page.evaluate(() => {
    globalThis.__gaiaQaVisibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(280);
  report.samples.resumed = await readCounts();
  assert(report.samples.resumed.latest > report.samples.hiddenEnd.latest, "visible detail did not resume latest polling");
  assert.equal(report.samples.resumed.history, 1, "visibility resume reloaded owner history");

  await page.locator("#refresh-detail").click();
  await page.waitForFunction(() => document.querySelector("#sensor-status")?.textContent.includes("最新の測定値へ更新しました"));
  report.samples.manual = await readCounts();
  assert.equal(report.samples.manual.history, 2, "manual refresh did not reload owner history once");
  assert(report.samples.manual.latest > report.samples.resumed.latest, "manual refresh did not reload the latest value");

  await page.screenshot({ path: path.join(outputDir, "owner-detail.png"), fullPage: true });
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

console.log(JSON.stringify({ status: report.status, samples: report.samples, outputDir }, null, 2));
