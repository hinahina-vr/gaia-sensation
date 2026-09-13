import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const entry = fs.existsSync(path.join(moduleRoot, "index.mjs")) ? path.join(moduleRoot, "index.mjs") : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(entry).href);
const outputDir = path.resolve(outputArgument || "artifacts/observation-notebook-browser");
const mapOnly = process.argv.includes("--map-only");
fs.mkdirSync(outputDir, { recursive: true });
const report = { status: "running", checks: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(response.url()); });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("gaia:notebook-browser-qa-initialized") === "true") return;
    localStorage.clear();
    sessionStorage.setItem("gaia:notebook-browser-qa-initialized", "true");
  });

  await page.goto(new URL("/#tour", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => globalThis.GaiaGuidedTour?.getState?.().active && globalThis.GaiaObservationNotebook && globalThis.GaiaMapObservationAdapter, null, { timeout: 30_000 });
  await page.evaluate(() => GaiaGuidedTour.exit({ keepView: true }));
  await page.evaluate(async () => {
    await GaiaMapObservationAdapter.waitSignalsReady();
    GaiaMapObservationAdapter.openMap();
    GaiaMapObservationAdapter.selectMode(0);
    GaiaMapObservationAdapter.setSignalTime(72);
  });
  await page.waitForSelector(".gaia-observation-capture--map", { state: "visible", timeout: 20_000 });
  const inspectMapActions = () => page.evaluate(() => {
    const back = document.querySelector("#japan-close");
    const save = document.querySelector(".gaia-observation-capture--map");
    const actions = document.querySelector(".japan-map-actions");
    const backRect = back?.getBoundingClientRect();
    const saveRect = save?.getBoundingClientRect();
    return {
      title: document.querySelector("#japan-title")?.textContent?.trim() || "",
      parentMatches: save?.parentElement === actions && back?.parentElement === actions,
      back: backRect?.toJSON() || null,
      save: saveRect?.toJSON() || null,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  const assertMapActions = (scan, label) => {
    assert.equal(scan.parentMatches, true, `${label}: back and save do not share one operation row`);
    assert(scan.back && scan.save, `${label}: map actions are missing`);
    assert(
      Math.abs(scan.back.top - scan.save.top) <= 2,
      `${label}: map actions are not vertically aligned (${JSON.stringify({ back: scan.back, save: scan.save })})`,
    );
    assert(scan.save.left >= scan.back.right + 4 && scan.save.left <= scan.back.right + 14, `${label}: save is not directly right of back`);
    assert(scan.save.width < 160, `${label}: save action is not compact`);
    assert(scan.save.right <= scan.viewport.width && scan.save.bottom <= scan.viewport.height, `${label}: save action leaves the viewport`);
  };

  const desktopActions = await inspectMapActions();
  assert.equal(desktopActions.title, "地球の一呼吸");
  assertMapActions(desktopActions, "desktop");
  await page.screenshot({ path: path.join(outputDir, "map-actions-desktop.png"), animations: "disabled" });
  await page.evaluate(() => GaiaMapObservationAdapter.selectMode(3));
  await page.waitForFunction(() => document.querySelector("#japan-title")?.textContent?.trim() === "再資源化率を比べる");
  assert.equal(await page.locator("#japan-mode-title").textContent(), "再資源化率を比べる");
  const liveTitles = [["10", "風脈"], ["11", "炭素の呼吸"], ["12", "雨の記憶"], ["13", "大気の痕跡"]];
  for (const [number, title] of liveTitles) {
    await page.locator("#japan-mode-list [data-live-exhibit]", { hasText: number }).click();
    await page.waitForFunction((expected) => document.querySelector("#japan-title")?.textContent?.trim() === expected, title);
  }
  assert.equal(await page.locator(".gaia-observation-capture--map").isVisible(), false, "live exhibit must not expose a mismatched standard snapshot action");
  await page.locator("#japan-mode-list .map-mode-button:not([data-live-exhibit])").first().click();
  await page.waitForFunction(() => document.querySelector("#japan-title")?.textContent?.trim() === "地球の一呼吸");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const mobileActions = await inspectMapActions();
  assert.equal(mobileActions.title, "地球の一呼吸");
  assertMapActions(mobileActions, "mobile");
  await page.screenshot({ path: path.join(outputDir, "map-actions-mobile.png"), animations: "disabled" });
  report.checks.push("map exhibit heading and compact action row");
  await page.locator(".gaia-observation-capture--map").click();
  await page.waitForFunction(() => GaiaObservationCore.list().length === 1);
  const mapRecord = await page.evaluate(() => GaiaObservationCore.list()[0]);
  assert.equal(mapRecord.source, "map");
  assert.equal(mapRecord.compareKey, "map:breathing-earth");
  assert(mapRecord.metrics.some((metric) => metric.key === "co2_ppm"));
  report.checks.push("map capture");

  await page.waitForSelector(".gaia-observation-drawer:not([hidden])");
  assert.equal(await page.locator(".gaia-observation-launcher").isVisible(), false, "global notebook launcher must stay hidden");
  assert.equal(await page.locator(".gaia-observation-card[data-source='map']").count(), 1);
  await page.screenshot({ path: path.join(outputDir, "map-notebook.png"), animations: "disabled" });

  if (!mapOnly) {
  await page.goto(new URL("/sensors/?authenticated=1#device=dev_browser_qa", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("[data-view='detail']:not([hidden])", { timeout: 30_000 });
  await page.waitForSelector("#history-list .gaia-observation-capture", { timeout: 20_000 });
  const saveButtons = page.locator("#history-list .gaia-observation-capture");
  assert((await saveButtons.count()) >= 2);
  await saveButtons.nth(0).click();
  await saveButtons.nth(1).click();
  await page.waitForFunction(() => GaiaObservationCore.list().filter((record) => record.source === "sensor").length === 2);
  const privacy = await page.evaluate(() => {
    const records = GaiaObservationCore.list().filter((record) => record.source === "sensor");
    const shared = records.map((record) => GaiaObservationCore.shareRecord(record));
    return {
      count: records.length,
      hasDeviceId: JSON.stringify(shared).includes("dev_browser_qa"),
      hasOwner: JSON.stringify(shared).includes("owner"),
      hasLocation: JSON.stringify(shared).includes("publicLatitude"),
    };
  });
  assert.deepEqual(privacy, { count: 2, hasDeviceId: false, hasOwner: false, hasLocation: false });
  report.checks.push("sensor capture and privacy stripping");

  await page.locator("[data-observation-open]").click();
  const sensorChecks = page.locator(".gaia-observation-card[data-source='sensor'] input[type='checkbox']");
  await sensorChecks.nth(0).check();
  await sensorChecks.nth(1).check();
  const compareButton = page.locator("[data-observation-compare-action]");
  assert.equal(await compareButton.isEnabled(), true);
  await compareButton.click();
  await page.waitForSelector("[data-observation-compare]:not([hidden])");
  assert((await page.locator(".gaia-observation-comparison-grid p").count()) >= 1);
  report.checks.push("compatible sensor comparison");

  const mapCheck = page.locator(".gaia-observation-card[data-source='map'] input[type='checkbox']");
  await sensorChecks.nth(1).uncheck();
  await mapCheck.check();
  assert.equal(await compareButton.isEnabled(), false, "map and sensor must not compare");
  report.checks.push("map-sensor comparison rejected");

  const shareUrl = await page.evaluate(() => {
    const records = GaiaObservationCore.list().filter((record) => record.source === "sensor").slice(0, 2);
    return GaiaObservationNotebook.buildShareUrl(records);
  });
  assert.match(shareUrl, /#observation=[A-Za-z0-9_-]+$/u);
  await page.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("[data-observation-shared]:not([hidden])", { timeout: 20_000 });
  assert.equal(await page.locator("[data-observation-shared] .gaia-observation-card").count(), 2);
  assert.equal(await page.locator("[data-observation-shared] .gaia-observation-card input[type='checkbox']").count(), 0);
  await page.locator("[data-observation-shared] > button").click();
  await page.waitForFunction(() => GaiaObservationCore.list().length >= 3);
  report.checks.push("URL share decode and explicit import");
  await page.screenshot({ path: path.join(outputDir, "shared-import.png"), animations: "disabled" });

  await page.goto(new URL("/#observation=%%%", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".gaia-observation-drawer:not([hidden])", { timeout: 20_000 });
  assert.match(await page.locator(".gaia-observation-status").textContent(), /不正|読み取れ|形式/u);
  report.checks.push("malformed URL rejected");
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
