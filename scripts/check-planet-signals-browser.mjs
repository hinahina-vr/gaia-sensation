import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const browserPath = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = (process.argv[3] || "http://127.0.0.1:4198").replace(/\/$/u, "");
const outputDir = path.resolve(process.argv[4] || "artifacts/planet-signals");
fs.mkdirSync(outputDir, { recursive: true });

const atmosphereRows = Array.from({ length: 240 }, (_, index) => ({
  current: {
    time: "2026-09-04T00:00",
    wind_speed_10m: 2.5 + (index * 7 % 110) / 10,
    wind_direction_10m: (20 + index * 31) % 360,
    surface_pressure: 993 + index * 11 % 29,
    cloud_cover: 8 + index * 17 % 91,
    shortwave_radiation: 40 + index * 37 % 820,
    pm2_5: 4 + (index * 18 % 360) / 10,
    aerosol_optical_depth: 0.05 + (index * 7 % 31) / 100,
  },
}));
const quakeFeatures = Array.from({ length: 360 }, (_, index) => ({
  type: "Feature",
  id: `test-quake-${index}`,
  geometry: {
    type: "Point",
    coordinates: [-175 + (index % 36) * 10, -67.5 + (Math.floor(index / 36) % 10) * 15, 12 + index],
  },
  properties: { mag: 0.4 + (index * 13 % 72) / 10, place: `TEST REGION ${index + 1}`, time: Date.now() - index * 220_000 },
}));

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

const mockLiveSources = async (page) => {
  const fulfillPointBatch = (route) => {
    const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(atmosphereRows.slice(0, count)),
    });
  };
  await page.route("https://api.open-meteo.com/**", fulfillPointBatch);
  await page.route("https://air-quality-api.open-meteo.com/**", fulfillPointBatch);
  await page.route("https://earthquake.usgs.gov/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/geo+json",
    body: JSON.stringify({ type: "FeatureCollection", metadata: { generated: Date.now(), count: quakeFeatures.length }, features: quakeFeatures }),
  }));
};

const openMap = async (page) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
  });
  await mockLiveSources(page);
  await page.goto(`${baseUrl}/#earth`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter && globalThis.GaiaPlanetSignals), null, { timeout: 30_000 });
  await page.evaluate(() => { location.hash = "#japan"; });
  await page.waitForFunction(() => document.querySelectorAll("#japan-firms-mode-list [data-planet-exhibit]").length === 4, null, { timeout: 20_000 });
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
};

const selectAndRead = async (page, index) => {
  const button = page.locator("#japan-firms-mode-list [data-planet-exhibit]").nth(index);
  const id = await button.getAttribute("data-planet-exhibit");
  await button.evaluate((element) => element.click());
  try {
    await page.waitForFunction((expected) => {
      const canvas = document.querySelector("#gaia-planet-signals-canvas");
      return canvas?.dataset.planetExhibit === expected && /^LIVE/u.test(canvas.dataset.planetSourceState || "") && Number(canvas.dataset.planetFrame) > 0;
    }, id, { timeout: 15_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      canvas: { ...document.querySelector("#gaia-planet-signals-canvas")?.dataset },
      layer: { ...document.querySelector("#japan-layer")?.dataset },
      readout: { ...document.querySelector(".gaia-planet-signals-readout")?.dataset },
    }));
    throw new Error(`${error.message}\n${JSON.stringify(state, null, 2)}`);
  }
  if (index !== 2) {
    await page.waitForFunction(index => {
      const canvas = document.querySelector("#gaia-planet-atmosphere-canvas");
      return canvas && !canvas.hidden && canvas.dataset.fieldState === "ready"
        && (index !== 0 || canvas.dataset.windStyle === "luminous-drifting-veil");
    }, index, { timeout: 30000 });
  }
  await page.waitForTimeout(1100); // Field fade-in and camera arrival.
  return page.locator("#gaia-planet-signals-canvas").evaluate((canvas) => ({
    id: canvas.dataset.planetExhibit,
    engine: canvas.dataset.planetEngine,
    source: canvas.dataset.planetSourceState,
    points: Number(canvas.dataset.planetPointCount),
    frames: Number(canvas.dataset.planetFrame),
    width: canvas.width,
    height: canvas.height,
  }));
};

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const desktop = await desktopContext.newPage();
  monitor(desktop);
  await openMap(desktop);
  assert.equal(await desktop.locator("#japan-firms-mode-list .map-mode-button").count(), 5);
  assert.match(await desktop.locator("#map-mode-firms-label").textContent(), /LIVE OPEN DATA[\s\S]*5つの観測信号/u);
  await desktop.evaluate(() => {
    const card = document.querySelector("#japan-poi-card");
    card.hidden = false;
    card.setAttribute("aria-hidden", "false");
    document.querySelector("#japan-layer")?.classList.add("japan-poi-open");
  });
  const desktopEvidence = [];
  for (let index = 0; index < 4; index += 1) {
    desktopEvidence.push(await selectAndRead(desktop, index));
    await desktop.screenshot({ path: path.join(outputDir, `desktop-${27 + index}-atmosphere.png`), fullPage: true });
    if (index === 0) {
      assert.equal(await desktop.locator("#japan-poi-card").isVisible(), false, "base exhibit POI remained open over a live exhibit");
      await desktop.mouse.click(720, 430);
      if (await desktop.locator("#japan-poi-card").isVisible()) {
        assert.match(await desktop.locator("#japan-poi-type").textContent(), /^27 \//u, "map tap opened an unrelated base exhibit POI");
      }
    }
  }
  assert.equal(await desktop.locator("[data-planet-return]").count(), 0, "legacy return card should not be rendered");
  assert.equal(await desktop.locator("[data-planet-data-time]").textContent(), "2026/09/04 09:00 JST");
  assert.match(await desktop.locator("[data-planet-data-age]").textContent(), /^データ時点から/u);
  assert.deepEqual(desktopEvidence.map(({ id }) => id), [
    "global-wind-pressure",
    "global-aerosol-light",
    "usgs-earthquake-ripples",
    "global-cloud-radiance",
  ]);
  assert(desktopEvidence.every(({ engine, source, width, height }, index) => (
    engine === (index === 2 ? "canvas2d-particle-field" : "webgl2-continuous-atmosphere")
      && /^LIVE/u.test(source) && width > 500 && height > 300
  )));
  assert.deepEqual(desktopEvidence.map(({ points }) => points), [240, 240, 360, 240]);
  await desktop.screenshot({ path: path.join(outputDir, "desktop-30-cloud-radiance.png"), fullPage: true });
  const performanceEvidence = await desktop.evaluate(async () => {
    const canvas = document.querySelector("#gaia-planet-atmosphere-canvas");
    const base = document.querySelector("#gaia-canvas");
    const gl = canvas.getContext("webgl2"), baseGl = base.getContext("webgl2");
    const render = gl.drawArrays, baseRender = baseGl.drawArrays;
    const times = [], longTasks = [];
    let baseDraws = 0;
    const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(e => e.duration)));
    observer.observe({ type: "longtask" });
    gl.drawArrays = function(...args) { times.push(performance.now()); return render.apply(this, args); };
    baseGl.drawArrays = function(...args) { baseDraws++; return baseRender.apply(this, args); };
    const beforeBuilds = canvas.dataset.fieldBuilds;
    try { await new Promise(resolve => setTimeout(resolve, 3000)); }
    finally { gl.drawArrays = render; baseGl.drawArrays = baseRender; observer.disconnect(); }
    const intervals = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
    return { fps: (times.length - 1) * 1000 / (times.at(-1) - times[0]), draws: times.length,
      p95FrameMs: intervals[Math.floor(intervals.length * .95)], longTasks, baseDraws,
      pixelCount: canvas.width * canvas.height, extraBuilds: +canvas.dataset.fieldBuilds - +beforeBuilds,
      glError: gl.getError(), baseSuppressed: base.dataset.renderSuppressed };
  });
  assert.equal(performanceEvidence.baseDraws, 0, "Hidden underlying shader must not consume GPU time");
  assert.equal(performanceEvidence.extraBuilds, 0);
  assert.equal(performanceEvidence.glError, 0);
  assert.ok(performanceEvidence.pixelCount <= 762000);
  await desktop.setViewportSize({ width: 3840, height: 2088 });
  await desktop.waitForTimeout(700);
  await desktop.screenshot({ path: path.join(outputDir, "4k-30-cloud-radiance.png"), fullPage: true });
  assert.ok(await desktop.locator("#gaia-planet-atmosphere-canvas").evaluate(c => c.width * c.height <= 762000));
  await desktop.locator("#japan-close").evaluate(el => el.click());
  await desktop.waitForFunction(() => document.querySelector("#japan-layer").getAttribute("aria-hidden") === "true");
  const closedDraws = await desktop.locator("#gaia-planet-atmosphere-canvas").getAttribute("data-draws");
  await desktop.waitForTimeout(300);
  assert.equal(await desktop.locator("#gaia-planet-atmosphere-canvas").getAttribute("data-draws"), closedDraws, "Closing the map must stop its GPU work");
  await desktop.evaluate(() => { location.hash = "#world"; });
  await desktop.waitForFunction(previous => +document.querySelector("#gaia-planet-atmosphere-canvas").dataset.draws > +previous, closedDraws);
  // The previous map must resume and the atmospheric renderer must stop.
  await desktop.evaluate(() => GaiaPlanetSignals.deactivate());
  const stopped = await desktop.locator("#gaia-planet-atmosphere-canvas").getAttribute("data-draws");
  await desktop.waitForTimeout(300);
  assert.equal(await desktop.locator("#gaia-planet-atmosphere-canvas").getAttribute("data-draws"), stopped);
  assert.equal(await desktop.locator("#gaia-canvas").getAttribute("data-render-suppressed"), null);
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage();
  monitor(mobile);
  await openMap(mobile);
  const mobileEvidence = await selectAndRead(mobile, 1);
  const mobileLayout = await mobile.evaluate(() => ({
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    readoutVisible: document.querySelector(".gaia-planet-signals-readout")?.getBoundingClientRect().height > 0,
    legendVisible: document.querySelector(".gaia-planet-signals-legend")?.getBoundingClientRect().width > 0,
  }));
  assert.equal(mobileEvidence.points, 240);
  assert(mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1, "mobile planet-signal exhibit overflows horizontally");
  assert.equal(mobileLayout.readoutVisible, true);
  assert.equal(mobileLayout.legendVisible, true);
  await mobile.screenshot({ path: path.join(outputDir, "mobile-28-aerosol-light.png"), fullPage: true });
  await selectAndRead(mobile, 3);
  await mobile.screenshot({ path: path.join(outputDir, "mobile-30-cloud-radiance.png"), fullPage: true });
  assert.ok(await mobile.locator("#gaia-planet-atmosphere-canvas").evaluate(c => c.width * c.height <= 302000));
  await selectAndRead(mobile, 0);
  await mobile.screenshot({ path: path.join(outputDir, "mobile-27-wind.png"), fullPage: true });
  await mobileContext.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(responses404, []);
  const report = { status: "passed", desktopEvidence, mobileEvidence, mobileLayout, performanceEvidence };
  fs.writeFileSync(path.join(outputDir, "browser-check.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
