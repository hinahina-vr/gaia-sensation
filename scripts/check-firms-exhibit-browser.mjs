import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const browserPath = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = (process.argv[3] || "http://127.0.0.1:4198").replace(/\/$/u, "");
const outputDir = path.resolve(process.argv[4] || "artifacts/firms-active-fire");
const ovationSnapshot = fs.readFileSync(path.resolve("data/ovation-aurora-snapshot.json"), "utf8");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--disable-background-timer-throttling"],
});
const errors = [];
const responses404 = [];

const monitor = (page) => {
  page.on("console", (message) => {
    const text = message.text();
    const unrelatedPreloadCapacityError = /ERR_NO_BUFFER_SPACE/u.test(text) && /assets\/visuals-/u.test(message.location().url || "");
    if (message.type() === "error" && !unrelatedPreloadCapacityError) errors.push(`${text} @ ${message.location().url || "inline"}`);
  });
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("response", (response) => { if (response.status() === 404) responses404.push(response.url()); });
};

const openMap = async (page) => {
  await page.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: ovationSnapshot }));
  await page.goto(`${baseUrl}/#earth`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter && globalThis.GaiaFirmsExhibit), null, { timeout: 30_000 });
  await page.evaluate(() => { location.hash = "#japan"; });
  await page.waitForFunction(() => document.querySelectorAll("#japan-firms-mode-list [data-firms-exhibit]").length === 1, null, { timeout: 20_000 });
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
};

const selectFirms = async (page) => {
  await page.locator("[data-firms-exhibit]").evaluate((element) => element.click());
  await page.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("is-firms-exhibit"));
  await page.waitForFunction(() => Number(document.querySelector("#gaia-firms-canvas")?.dataset.firmsPointCount) > 100, null, { timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector("#gaia-firms-canvas")?.dataset.firmsEngine === "webgl-fire-particles", null, { timeout: 15_000 });
  await page.waitForTimeout(450);
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  await page.waitForFunction(() => document.querySelector("#gaia-mode-entry-guide")?.hidden !== false);
};

const evidence = (page) => page.locator("#gaia-firms-canvas").evaluate((canvas) => ({
  engine: canvas.dataset.firmsEngine,
  points: Number(canvas.dataset.firmsPointCount),
  visible: Number(canvas.dataset.firmsVisibleCount),
  progress: Number(canvas.dataset.firmsPlaybackProgress),
  phase: canvas.dataset.firmsPlaybackPhase,
  sequence: canvas.dataset.firmsSequence,
  projection: canvas.dataset.firmsProjection,
  encoding: canvas.dataset.firmsAttributeEncoding,
  flashCadence: canvas.dataset.firmsFlashCadence,
  motion: canvas.dataset.firmsMotion,
  width: canvas.width,
  height: canvas.height,
}));

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const desktop = await desktopContext.newPage();
  monitor(desktop);
  await openMap(desktop);
  assert.equal(await desktop.locator(".map-mode-bank").getAttribute("aria-label"), "地図の30展示を選ぶ");
  assert.equal(await desktop.locator("#map-mode-bank-kicker").textContent(), "INSTALLATION BANK / MAP 01—30");
  assert.equal(await desktop.locator("#japan-firms-mode-list .map-mode-button").count(), 5);
  await desktop.evaluate(() => {
    const card = document.querySelector("#japan-poi-card");
    card.hidden = false;
    card.setAttribute("aria-hidden", "false");
    document.querySelector("#japan-layer")?.classList.add("japan-poi-open");
  });
  await selectFirms(desktop);
  assert.equal(await desktop.locator("#japan-poi-card").isVisible(), false, "base exhibit POI remained open over FIRMS");
  await desktop.mouse.click(720, 430);
  assert.equal(await desktop.locator("#japan-poi-card").isVisible(), false, "map tap opened an unrelated base exhibit POI over FIRMS");
  const initial = await evidence(desktop);
  await desktop.waitForTimeout(3_000);
  const advancing = await evidence(desktop);
  assert.equal(advancing.engine, "webgl-fire-particles");
  assert(advancing.points > 100 && advancing.points <= 1_600);
  assert.equal(advancing.sequence, "acquisition-time");
  assert.equal(advancing.projection, "japan-pacific-equirectangular-150");
  assert.equal(advancing.encoding, "frp-size-confidence-alpha-daynight-color");
  assert.equal(advancing.flashCadence, "none");
  assert.equal(advancing.motion, "spatial-continuous-non-pulsing");
  assert(advancing.progress > initial.progress, "acquisition-time replay did not advance");
  assert(advancing.visible > initial.visible, "fire detections did not appear sequentially");
  assert.equal(await desktop.locator(".gaia-firms-legend").isVisible(), true);
  assert.equal(await desktop.locator(".gaia-firms-readout").isVisible(), true);
  assert.equal(await desktop.locator("[data-firms-return], .gaia-firms-return").count(), 0, "Redundant return tile must be removed, not merely hidden");
  assert.match(await desktop.locator("[data-firms-latest]").textContent(), /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} JST$/u);
  assert.match(await desktop.locator("[data-firms-age]").textContent(), /^観測から/u);
  assert.equal(await desktop.locator(".gaia-live-city-marker:visible").count(), 0);
  assert.equal(await desktop.locator(".gaia-estat-marker:visible").count(), 0);
  assert.match(await desktop.locator(".gaia-firms-copy").innerText(), /火災の範囲ではなく.+熱異常/u);
  assert.equal(await desktop.locator("[data-firms-source]").getAttribute("aria-controls"), "japan-data-panel");
  assert.match(await desktop.evaluate(() => GaiaFirmsExhibit.getSourceInfo().datasets[0].url), /^https:\/\/firms\.modaps\.eosdis\.nasa\.gov\//u);
  await desktop.locator("[data-firms-progress]").evaluate((input) => {
    input.value = "780";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await desktop.waitForTimeout(400);
  const scrubbed = await evidence(desktop);
  assert.equal(scrubbed.phase, "scrub");
  assert(scrubbed.visible > scrubbed.points * 0.7);
  await desktop.screenshot({ path: path.join(outputDir, "desktop-26-active-fire.png"), fullPage: true });
  await desktop.setViewportSize({ width: 3840, height: 2088 });
  await desktop.waitForTimeout(200);
  const wideLayout = await desktop.locator(".gaia-firms-readout").evaluate((element) => {
    const children = [...element.children];
    const bounds = element.getBoundingClientRect();
    const first = children[0].getBoundingClientRect();
    const last = children.at(-1).getBoundingClientRect();
    return {
      firstIsChapter: children[0].classList.contains("gaia-firms-chapter"),
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      children: children.length,
      noEmptyEnds: Math.abs(first.left - bounds.left) <= 2 && Math.abs(last.right - bounds.right) <= 2,
      noOverflow: element.scrollWidth <= element.clientWidth + 1,
    };
  });
  await desktop.locator(".gaia-firms-readout").screenshot({ path: path.join(outputDir, "4k-26-readout.png") });
  assert.deepEqual(wideLayout, { firstIsChapter: true, columns: 7, children: 7, noEmptyEnds: true, noOverflow: true });
  await desktop.setViewportSize({ width: 1440, height: 900 });
  await desktop.waitForFunction(() => Boolean(globalThis.GaiaStatisticsLab?.open && globalThis.GaiaFirmsExhibit?.getStatisticsDataset));
  await desktop.evaluate(() => {
    const dataset = globalThis.GaiaFirmsExhibit.getStatisticsDataset();
    void globalThis.GaiaStatisticsLab.open({ modeId: dataset.modeId, datasetId: dataset.id, dataset });
  });
  await desktop.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent === "解析済み");
  const analysisDesign = await desktop.evaluate(() => ({
    title: document.querySelector("#gaia-statistics-title")?.textContent || "",
    context: document.querySelector("#gaia-statistics-context")?.textContent || "",
    method: document.querySelector("#gaia-statistics-method-title")?.textContent || "",
    status: document.querySelector("#gaia-statistics-status")?.textContent || "",
    recordCount: document.querySelector("#gaia-statistics-record-count")?.textContent || "",
    kpiDisplay: getComputedStyle(document.querySelector(".gaia-statistics-bi-strip")).display,
    evidenceRadius: getComputedStyle(document.querySelector(".gaia-statistics-takeaway-evidence button")).borderRadius,
    shellRadius: getComputedStyle(document.querySelector(".gaia-statistics-shell")).borderRadius,
    details: [...document.querySelectorAll(".gaia-statistics-stage > details > summary")].map((element) => element.childNodes[0]?.textContent?.trim() || ""),
  }));
  assert.equal(analysisDesign.title, "観測データを読む");
  assert.match(analysisDesign.context, /^燃える惑星 \/ NASA FIRMS　\/　火災・熱異常/u);
  assert.equal(analysisDesign.method, "値の分布を見る");
  assert.equal(analysisDesign.status, "解析済み");
  assert.match(analysisDesign.recordCount, /件$/u);
  assert.equal(analysisDesign.kpiDisplay, "none");
  assert.equal(analysisDesign.evidenceRadius, "0px");
  assert.equal(analysisDesign.shellRadius, "3px");
  assert.deepEqual(analysisDesign.details, ["計算の内訳", "観測データ", "読み方と限界"]);
  await desktop.screenshot({ path: path.join(outputDir, "desktop-26-analysis-report.png"), fullPage: true });
  await desktop.locator("#gaia-statistics-close").click();
  await desktop.locator("[data-firms-step='1']").click();
  await desktop.waitForFunction(() => !globalThis.GaiaFirmsExhibit.getState().active && document.querySelector("#japan-mode-number")?.textContent === "27");
  assert.equal(await desktop.locator("#japan-mode-number").textContent(), "27");
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage();
  monitor(mobile);
  await openMap(mobile);
  await selectFirms(mobile);
  assert.equal(await mobile.locator("[data-firms-return], .gaia-firms-return").count(), 0);
  await mobile.locator("[data-firms-progress]").evaluate((input) => {
    input.value = "700";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await mobile.waitForTimeout(400);
  const mobileLayout = await mobile.evaluate(() => ({
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    titleFont: parseFloat(getComputedStyle(document.querySelector(".gaia-firms-chapter strong")).fontSize),
    valueFont: parseFloat(getComputedStyle(document.querySelector(".gaia-firms-primary > strong")).fontSize),
    legendVisible: document.querySelector(".gaia-firms-legend")?.getBoundingClientRect().width > 0,
  }));
  assert(mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1, "mobile FIRMS exhibit overflows horizontally");
  assert(mobileLayout.titleFont >= 16);
  assert(mobileLayout.valueFont >= 26);
  assert.equal(mobileLayout.legendVisible, true);
  await mobile.screenshot({ path: path.join(outputDir, "mobile-26-active-fire.png"), fullPage: true });
  await mobile.waitForFunction(() => Boolean(globalThis.GaiaStatisticsLab?.open && globalThis.GaiaFirmsExhibit?.getStatisticsDataset));
  await mobile.evaluate(() => {
    const dataset = globalThis.GaiaFirmsExhibit.getStatisticsDataset();
    void globalThis.GaiaStatisticsLab.open({ modeId: dataset.modeId, datasetId: dataset.id, dataset });
  });
  await mobile.waitForFunction(() => document.querySelector("#gaia-statistics-status")?.textContent === "解析済み");
  assert.equal(await mobile.locator(".gaia-statistics-shell").evaluate((element) => Math.ceil(element.scrollWidth) <= Math.ceil(element.clientWidth) + 1), true, "mobile analysis report overflows horizontally");
  await mobile.screenshot({ path: path.join(outputDir, "mobile-26-analysis-report.png"), fullPage: true });
  await mobile.locator("#gaia-statistics-close").click();
  await mobileContext.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(responses404, []);
  console.log(JSON.stringify({ status: "passed", baseUrl, initial, advancing, scrubbed, mobileLayout, errors, responses404 }, null, 2));
} finally {
  await browser.close();
}
