import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";

const browserPath = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = (process.argv[3] || "http://127.0.0.1:4198").replace(/\/$/u, "");
const outputDir = path.resolve(process.argv[4] || "artifacts/estat-exhibits");
const ovationSnapshot = fs.readFileSync(path.resolve("data/ovation-aurora-snapshot.json"), "utf8");
const prefectureSeries = JSON.parse(fs.readFileSync(path.resolve("data/estat-prefecture-series.json"), "utf8"));
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
    if (message.type() === "error") errors.push(`${message.text()} @ ${message.location().url || "inline"}`);
  });
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("response", (response) => { if (response.status() === 404) responses404.push(response.url()); });
};

const openMap = async (page) => {
  await page.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: ovationSnapshot,
  }));
  await page.goto(`${baseUrl}/#earth`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter && globalThis.GaiaEstatExhibits), null, { timeout: 30_000 });
  await page.evaluate(() => { location.hash = "#japan"; });
  await page.waitForFunction(() => document.querySelectorAll(".map-mode-bank [data-estat-exhibit]").length === 10, null, { timeout: 20_000 });
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  assert.equal(await page.locator("[data-estat-return]").count(), 0, "Removed return tile must not be mounted");
};

const canvasEvidence = (page) => page.locator("#gaia-estat-canvas").evaluate((canvas) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let visible = 0;
  let energy = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  const histogram = Array(96).fill(0);
  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha > 6) {
      visible += 1;
      for (let channel = 0; channel < 3; channel += 1) histogram[channel * 32 + (pixels[index + channel] >> 3)] += 1;
    }
    energy += pixels[index] + pixels[index + 1] + pixels[index + 2] + alpha;
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
  }
  return {
    width: canvas.width,
    height: canvas.height,
    visible,
    energy,
    red,
    green,
    blue,
    colorDistribution: histogram.map(count => count / Math.max(1, visible)),
    heatmap: canvas.dataset.estatHeatmap,
    shapeCount: Number(canvas.dataset.estatHeatmapShapeCount || 0),
    valueCount: Number(canvas.dataset.estatHeatmapValueCount || 0),
    missingCount: Number(canvas.dataset.estatHeatmapMissingCount || 0),
  };
});

// Regional increases and decreases can cancel in a whole-canvas RGB average.
// Compare the visible land's color distribution instead of its average color.
const colorDistance = (left, right) => left.colorDistribution.reduce(
  (distance, count, index) => distance + Math.abs(count - right.colorDistribution[index]), 0,
) / 6;

const snapshots = [];
const atmosphereWebglEvidence = [];
let lodgingWebglEvidence = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  monitor(page);
  await openMap(page);

  assert.equal(await page.locator(".map-mode-bank").getAttribute("aria-label"), "地図の30展示を選ぶ");
  assert.equal(await page.locator("#map-mode-bank-kicker").textContent(), "INSTALLATION BANK / MAP 01—30");
  assert.equal(await page.locator(".map-dock-bank-trigger > i").count(), 0, "obsolete downward bank chevron was still present");
  assert.equal(await page.locator(".map-mode-bank [data-estat-exhibit]").count(), 10);
  assert.equal(await page.locator(".gaia-estat-marker").count(), 47);
  await page.waitForTimeout(700);
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  await page.waitForTimeout(240);
  await page.locator(".map-dock-bank-trigger").evaluate((button) => button.click());
  await page.waitForFunction(() => document.querySelector(".map-mode-bank")?.classList.contains("is-dock-bank-expanded"));
  await page.waitForTimeout(360);
  await page.screenshot({ path: path.join(outputDir, "pc-bank-grouped.png"), fullPage: true });
  await page.locator(".map-dock-bank-trigger").evaluate((button) => button.click());

  const contracts = [
    { number: "16", title: "人の潮目", key: "migration", visual: "tidal-migration-currents" },
    { number: "17", title: "旅の灯", key: "lodging", visual: "continuous-travel-filaments" },
    { number: "18", title: "住まいの芽吹き", key: "housing", visual: "rising-blueprint-seeds" },
    { number: "19", title: "空の体温", key: "averageTemperature", visual: "thermal-convection-veils", regions: true },
    { number: "20", title: "日最高気温の年平均", key: "summerHigh", visual: "summer-heat-shimmer", regions: true },
    { number: "21", title: "日最低気温の年平均", key: "winterLow", visual: "drifting-frost-crystals", regions: true },
    { number: "22", title: "湿りの膜", key: "relativeHumidity", visual: "low-cloud-vapor", regions: true },
    { number: "23", title: "光の貯金", key: "sunshineHours", visual: "sunbeam-dust-field", regions: true },
    { number: "24", title: "雨の器", key: "precipitation", visual: "continuous-rain-streaks", regions: true },
    { number: "25", title: "雨の足跡", key: "rainyDays", visual: "asynchronous-rain-ripples", regions: true },
  ];
  for (let index = 0; index < contracts.length; index += 1) {
    const contract = contracts[index];
    await page.locator(`.map-mode-bank [data-estat-exhibit="${ESTAT_EXHIBITS[index].id}"]`).evaluate((button) => button.click());
    await page.waitForFunction(({ number, key }) => (
      document.querySelector("#japan-layer")?.classList.contains("is-estat-exhibit")
      && document.querySelector("#japan-mode-number")?.textContent === number
      && document.querySelector(".gaia-estat-readout")?.dataset.estatExhibit === key
    ), contract);
    await page.waitForTimeout(1100);
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) >= 5.95, null, { timeout: 8_000 });
    assert.equal(await page.locator("#japan-mode-title").textContent(), contract.title);
    assert.equal(await page.locator("#japan-layer").getAttribute("data-estat-poi-display"), contract.regions ? "prefecture-regions" : "point-markers");
    if (contract.regions) {
      assert.notEqual(await page.locator(".gaia-estat-markers").getAttribute("hidden"), null, `${contract.key} still exposed point POIs`);
      assert.equal(await page.locator(".gaia-estat-prefecture-regions").getAttribute("hidden"), null, `${contract.key} prefecture regions were hidden`);
      assert.equal(await page.locator(".gaia-estat-prefecture-region").count(), 47, `${contract.key} did not expose all prefecture regions`);
    } else {
      assert.equal(await page.locator(".gaia-estat-markers").getAttribute("hidden"), null, `${contract.key} hid its point POIs`);
      assert.equal(await page.locator(".gaia-estat-marker:not([hidden])").count() > 30, true);
      assert.notEqual(await page.locator(".gaia-estat-prefecture-regions").getAttribute("hidden"), null, `${contract.key} exposed prefecture regions outside 19-25`);
    }
    assert.ok(Number(await page.locator("#japan-overlay").getAttribute("data-earth-zoom")) >= 5.95, `${contract.key} did not open at the requested Japan-focused size`);
    const evidence = await canvasEvidence(page);
    assert.ok(evidence.visible > 500, `${contract.key} canvas did not draw enough visible pixels`);
    assert.equal(evidence.heatmap, "prefecture-choropleth", `${contract.key} did not use the prefecture choropleth`);
    assert.equal(evidence.shapeCount, 47, `${contract.key} did not load all 47 prefecture shapes`);
    assert.ok(evidence.valueCount >= 45, `${contract.key} colored too few prefectures`);
    assert.equal(evidence.valueCount + evidence.missingCount, 47, `${contract.key} did not account for all prefectures`);
    await page.waitForFunction(({ key, visual }) => {
      const webglCanvas = document.querySelector("#gaia-estat-atmosphere-webgl");
      return webglCanvas?.dataset.estatWebglState === "active"
        && webglCanvas.dataset.estatWebglTheme === key
        && webglCanvas.dataset.estatWebglVisual === visual;
    }, contract, { timeout: 8_000 });
    const ambientEvidence = await page.locator("#gaia-estat-atmosphere-webgl").evaluate((webglCanvas) => ({
      hidden: webglCanvas.hidden,
      state: webglCanvas.dataset.estatWebglState,
      theme: webglCanvas.dataset.estatWebglTheme,
      visual: webglCanvas.dataset.estatWebglVisual,
      motion: webglCanvas.dataset.estatWebglMotion,
      flashCadence: webglCanvas.dataset.estatWebglFlashCadence,
      hubCount: Number(webglCanvas.dataset.estatWebglHubCount),
      fieldStrength: Number(webglCanvas.dataset.estatWebglFieldStrength),
      width: webglCanvas.width,
      height: webglCanvas.height,
      resolutionScale: Number(webglCanvas.dataset.estatWebglResolutionScale),
      targetFps: Number(webglCanvas.dataset.estatWebglTargetFps),
      blendMode: getComputedStyle(webglCanvas).mixBlendMode,
      layerVisual: document.querySelector("#japan-layer")?.dataset.estatAmbientVisual,
      layerMotion: document.querySelector("#japan-layer")?.dataset.estatAmbientMotion,
      layerFlashCadence: document.querySelector("#japan-layer")?.dataset.estatAmbientFlashCadence,
      hasWebgl2: Boolean(webglCanvas.getContext("webgl2")),
    }));
    assert.equal(ambientEvidence.hidden, false);
    assert.equal(ambientEvidence.state, "active");
    assert.equal(ambientEvidence.theme, contract.key);
    assert.equal(ambientEvidence.visual, contract.visual);
    assert.equal(ambientEvidence.layerVisual, contract.visual);
    assert.equal(ambientEvidence.motion, "spatial-continuous-non-pulsing");
    assert.equal(ambientEvidence.layerMotion, "spatial-continuous-non-pulsing");
    assert.equal(ambientEvidence.flashCadence, "none");
    assert.equal(ambientEvidence.layerFlashCadence, "none");
    assert.equal(ambientEvidence.hubCount, 8);
    assert.equal(ambientEvidence.hasWebgl2, true);
    assert.equal(ambientEvidence.blendMode, "screen");
    assert.ok(ambientEvidence.fieldStrength > 0 && ambientEvidence.fieldStrength <= 1);
    assert.ok(ambientEvidence.resolutionScale > 0 && ambientEvidence.resolutionScale <= 1);
    assert.equal(ambientEvidence.targetFps, 30);
    atmosphereWebglEvidence.push({ number: contract.number, ...ambientEvidence });
    if (contract.key === "lodging") {
      lodgingWebglEvidence = await page.locator("#gaia-estat-atmosphere-webgl").evaluate((webglCanvas) => ({
        layerVisual: document.querySelector("#japan-layer")?.dataset.estatLodgingVisual,
        layerFlashCadence: document.querySelector("#japan-layer")?.dataset.estatLodgingFlashCadence,
      }));
      assert.equal(lodgingWebglEvidence.layerVisual, "webgl-continuous-route-field");
      assert.equal(lodgingWebglEvidence.layerFlashCadence, "none");
      assert.equal(
        await page.locator("#japan-overlay").getAttribute("data-live-backdrop"),
        "estat-reference-map-only",
        "the previous MAP 01-09 effect was still rendering underneath the e-Stat exhibit",
      );
      await page.evaluate(() => globalThis.GaiaEstatExhibits.selectPrefecture(1));
      await page.waitForFunction(() => {
        const progress = Number(document.querySelector("#gaia-estat-atmosphere-webgl")?.dataset.estatWebglAnchorProgress);
        return progress > 0.01 && progress < 0.99;
      });
      const arrivalAnimation = await page.locator(".gaia-estat-marker[data-estat-prefecture='02']").evaluate((marker) => getComputedStyle(marker).animationName);
      assert.equal(arrivalAnimation, "estat-lodging-poi-arrive", "lodging retained the bright generic POI flash");
      await page.waitForTimeout(1500);
      assert.equal(Number(await page.locator("#gaia-estat-atmosphere-webgl").getAttribute("data-estat-webgl-anchor-progress")), 1);
      await page.evaluate(() => globalThis.GaiaEstatExhibits.setPeriod(1));
      await page.waitForTimeout(80);
      const canvasAnimationName = await page.locator("#gaia-estat-canvas").evaluate((estatCanvas) => getComputedStyle(estatCanvas).animationName);
      assert.equal(canvasAnimationName, "none", "the full-map period shimmer still flashed the dark background");
      lodgingWebglEvidence.canvasAnimationName = canvasAnimationName;
    }
    if (contract.regions) {
      const regionCode = "02";
      const regionPoint = await page.locator(`.gaia-estat-prefecture-region[data-estat-prefecture='${regionCode}']`).evaluate((region) => {
        const bounds = region.getBBox();
        const matrix = region.getScreenCTM();
        const point = new DOMPoint();
        for (let row = 1; row < 10; row += 1) {
          for (let column = 1; column < 10; column += 1) {
            point.x = bounds.x + bounds.width * column / 10;
            point.y = bounds.y + bounds.height * row / 10;
            if (region.isPointInFill(point)) return point.matrixTransform(matrix);
          }
        }
        return null;
      });
      assert.ok(regionPoint, `${contract.key} prefecture region ${regionCode} had no interactive interior point`);
      await page.mouse.click(regionPoint.x, regionPoint.y);
      assert.equal(await page.locator(".gaia-estat-readout").getAttribute("data-estat-selected-code"), regionCode);
      assert.equal(await page.locator(`.gaia-estat-prefecture-region[data-estat-prefecture='${regionCode}']`).getAttribute("aria-current"), "true");
      await page.waitForTimeout(340);
    }
    snapshots.push({ ...contract, ...evidence });
    await page.screenshot({ path: path.join(outputDir, `pc-${contract.number}.png`), fullPage: true });
  }

  assert.equal(await page.locator("[data-estat-step='1']").getAttribute("aria-label"), "次の展示、26へ");
  await page.locator("[data-estat-step='1']").evaluate((button) => button.click());
  await page.waitForFunction(() => (
    !document.querySelector("#japan-layer")?.classList.contains("is-estat-exhibit")
    && document.querySelector("#japan-layer")?.classList.contains("is-firms-exhibit")
    && document.querySelector("#japan-mode-number")?.textContent === "26"
  ));
  assert.equal(await page.locator("#japan-mode-title").textContent(), "燃える惑星");

  await page.evaluate(async () => {
    await globalThis.GaiaEstatExhibits.select(0);
    globalThis.GaiaEstatExhibits.selectPrefecture(0);
  });
  await page.waitForTimeout(1100);
  const autoplayInitial = await page.evaluate(() => globalThis.GaiaEstatExhibits.getState());
  assert.equal(autoplayInitial.monthIndex, 0);
  assert.equal(autoplayInitial.selectedIndex, 0);
  await page.evaluate(() => {
    globalThis.__estatPoiCodes = [];
    addEventListener("gaia:estat-poi-change", (event) => {
      if (event.detail?.auto) globalThis.__estatPoiCodes.push(event.detail.to);
    });
  });
  await page.waitForTimeout(6500);
  const autoplayState = await page.evaluate(() => globalThis.GaiaEstatExhibits.getState());
  const autoplayPoiCodes = await page.evaluate(() => globalThis.__estatPoiCodes);
  assert.equal(autoplayState.monthIndex, 1, "monthly series did not advance automatically");
  assert.deepEqual(autoplayPoiCodes.slice(0, 2), ["02", "03"].slice(0, autoplayPoiCodes.length));
  assert.ok(autoplayPoiCodes.length >= 1, "prefecture relay did not advance automatically");
  await page.evaluate(() => globalThis.GaiaEstatExhibits.setMonth(0));
  await page.waitForTimeout(1050);
  const february = await canvasEvidence(page);
  await page.screenshot({ path: path.join(outputDir, "pc-16-2026-02.png"), fullPage: true });
  await page.evaluate(() => globalThis.GaiaEstatExhibits.setMonth(1));
  await page.waitForTimeout(1050);
  const march = await canvasEvidence(page);
  await page.screenshot({ path: path.join(outputDir, "pc-16-2026-03.png"), fullPage: true });
  assert.ok(colorDistance(february, march) > 0.002, "high-variation month did not materially alter the choropleth colors");
  assert.equal(await page.locator(".gaia-estat-readout").getAttribute("data-estat-period"), "2026-03");

  await page.evaluate(() => globalThis.GaiaEstatExhibits.select(8));
  await page.waitForFunction(() => document.querySelector(".gaia-estat-readout")?.dataset.estatExhibit === "precipitation");
  await page.waitForTimeout(1050);
  const annualInitial = await page.evaluate(() => globalThis.GaiaEstatExhibits.getState());
  assert.equal(annualInitial.period, "2020");
  assert.equal(await page.locator("strong[data-estat-frequency]").textContent(), "e-Stat · 年次");
  assert.match(await page.locator("[data-estat-delta-label]").textContent(), /前年差/u);
  const rainfall2020 = await canvasEvidence(page);
  await page.screenshot({ path: path.join(outputDir, "pc-24-2020.png"), fullPage: true });
  await page.evaluate(() => globalThis.GaiaEstatExhibits.setPeriod(4));
  await page.waitForTimeout(1050);
  const rainfall2024 = await canvasEvidence(page);
  await page.screenshot({ path: path.join(outputDir, "pc-24-2024.png"), fullPage: true });
  assert.equal(await page.locator(".gaia-estat-readout").getAttribute("data-estat-period"), "2024");
  assert.ok(colorDistance(rainfall2020, rainfall2024) > 0.002, "annual climate data did not materially alter the choropleth colors");

  await page.evaluate(() => globalThis.GaiaEstatExhibits.setPeriod(0, { auto: true }));
  await page.waitForTimeout(6400);
  const annualAutoplay = await page.evaluate(() => globalThis.GaiaEstatExhibits.getState());
  assert.equal(annualAutoplay.period, "2021", "annual series did not advance automatically");

  await page.evaluate(() => globalThis.GaiaEstatExhibits.selectPrefecture(46));
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".gaia-estat-readout").getAttribute("data-estat-selected-code"), "47");
  assert.equal(await page.locator(".gaia-estat-prefecture-region[aria-current='true']").getAttribute("data-estat-prefecture"), "47");
  assert.notEqual(await page.locator(".gaia-estat-markers").getAttribute("hidden"), null, "rainfall still exposed point POIs");

  await page.evaluate(async () => {
    await globalThis.GaiaEstatExhibits.select(5);
    globalThis.GaiaEstatExhibits.setPeriod(70);
    globalThis.GaiaEstatExhibits.selectPrefecture(0);
  });
  await page.waitForFunction(() => {
    const readout = document.querySelector(".gaia-estat-readout");
    return readout?.dataset.estatExhibit === "winterLow"
      && readout.dataset.estatSelectedCode === "01"
      && readout.dataset.estatValueCountState === "settled";
  });
  const collectCountTransition = async (toIndex, expectedDirection, screenshotName) => {
    await page.evaluate((index) => {
      globalThis.__estatValueCountObserver?.disconnect();
      globalThis.__estatValueCountSamples = [];
      const readout = document.querySelector(".gaia-estat-readout");
      const value = readout?.querySelector("[data-estat-value]");
      globalThis.__estatValueCountObserver = new MutationObserver(() => {
        globalThis.__estatValueCountSamples.push({
          current: Number(readout?.dataset.estatValueCountCurrent),
          direction: readout?.dataset.estatValueCountDirection,
          progress: Number(readout?.dataset.estatValueCountProgress),
          state: readout?.dataset.estatValueCountState,
          text: value?.textContent || "",
        });
      });
      globalThis.__estatValueCountObserver.observe(value, { childList: true, characterData: true, subtree: true });
      globalThis.GaiaEstatExhibits.selectPrefecture(index);
    }, toIndex);
    await page.waitForFunction((direction) => {
      const readout = document.querySelector(".gaia-estat-readout");
      return readout?.dataset.estatValueCountState === "counting"
        && readout.dataset.estatValueCountDirection === direction;
    }, expectedDirection);
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: true });
    await page.waitForFunction(() => document.querySelector(".gaia-estat-readout")?.dataset.estatValueCountState === "settled");
    const { samples, settled } = await page.locator(".gaia-estat-readout").evaluate((element) => {
      globalThis.__estatValueCountObserver?.disconnect();
      return {
        samples: globalThis.__estatValueCountSamples || [],
        settled: {
          current: Number(element.dataset.estatValueCountCurrent),
          text: element.querySelector("[data-estat-value]")?.textContent || "",
        },
      };
    });
    samples.push({ ...settled, direction: "none", progress: 1, state: "settled" });
    return samples;
  };
  const pinCounterYear = async () => {
    await page.evaluate(() => globalThis.GaiaEstatExhibits.setPeriod(70));
    await page.waitForFunction(() => document.querySelector(".gaia-estat-readout")?.dataset.estatValueCountState === "settled");
  };
  await pinCounterYear();
  const countUpSamples = await collectCountTransition(46, "up", "pc-21-value-count-up.png");
  await pinCounterYear();
  const countDownSamples = await collectCountTransition(0, "down", "pc-21-value-count-down.png");
  const assertCountDirection = (samples, direction) => {
    const values = samples.map(({ current }) => current).filter(Number.isFinite);
    const deltas = values.slice(1).map((value, index) => value - values[index]);
    assert.ok(
      new Set(values.map((value) => value.toFixed(3))).size >= 8,
      `${direction}: too few visible count steps: ${JSON.stringify(values)}`,
    );
    assert.ok(
      deltas.every((delta) => direction === "up" ? delta >= -0.0001 : delta <= 0.0001),
      `${direction}: counter moved in the wrong direction: ${JSON.stringify(values)}`,
    );
  };
  assertCountDirection(countUpSamples, "up");
  assertCountDirection(countDownSamples, "down");
  assert.equal(countUpSamples.at(-1).text, prefectureSeries.winterLow["2025"][46].toFixed(1));
  assert.equal(countDownSamples.at(-1).text, prefectureSeries.winterLow["2025"][0].toFixed(1));
  const valueCountEvidence = { countUpSamples, countDownSamples };

  const zoomBefore = Number(await page.locator("#japan-overlay").getAttribute("data-earth-zoom"));
  await page.locator("#gaia-map-zoom-in").evaluate((button) => button.click());
  await page.waitForFunction((before) => Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) > before + 0.05, zoomBefore);
  assert.equal(await page.locator("#gaia-map-zoom-controls").isVisible(), true);
  await context.close();

  const wideContext = await browser.newContext({ viewport: { width: 2048, height: 1114 }, deviceScaleFactor: 1 });
  const widePage = await wideContext.newPage();
  monitor(widePage);
  await openMap(widePage);
  await widePage.locator('[data-estat-exhibit="estat-average-temperature"].map-mode-button').evaluate((button) => button.click());
  await widePage.waitForFunction(() => document.querySelector(".gaia-estat-readout")?.dataset.estatExhibit === "averageTemperature");
  await widePage.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle", null, { timeout: 8_000 });
  await widePage.evaluate(() => {
    globalThis.GaiaEstatExhibits.selectPrefecture(0);
    globalThis.GaiaEstatExhibits.setPeriod(0);
  });
  await widePage.waitForTimeout(1050);
  assert.equal(Number(await widePage.locator("#japan-overlay").getAttribute("data-earth-zoom")), 6, "desktop e-Stat exhibit did not start at zoom 6");
  const temperature1955 = await canvasEvidence(widePage);
  await widePage.screenshot({ path: path.join(outputDir, "wide-19-1955.png"), fullPage: true });
  await widePage.evaluate(() => globalThis.GaiaEstatExhibits.setPeriod(70));
  await widePage.waitForTimeout(1050);
  const temperature2025 = await canvasEvidence(widePage);
  const climateReadout = await widePage.locator(".gaia-estat-readout").evaluate((readout) => ({
    period: readout.dataset.estatPeriod,
    coverageStart: readout.dataset.estatCoverageStart,
    coverageEnd: readout.dataset.estatCoverageEnd,
    periodCount: Number(readout.dataset.estatPeriodCount),
    trendPerDecade: Number(readout.dataset.estatTrendPerDecade),
    station: readout.dataset.estatObservationStation,
  }));
  assert.deepEqual(climateReadout, {
    period: "2025",
    coverageStart: "1955",
    coverageEnd: "2025",
    periodCount: 71,
    trendPerDecade: climateReadout.trendPerDecade,
    station: "札幌",
  });
  assert.ok(climateReadout.trendPerDecade > 0, `Sapporo trend did not show long-term warming: ${JSON.stringify(climateReadout)}`);
  assert.ok(colorDistance(temperature1955, temperature2025) > 0.002, "1955 and 2025 temperature choropleths were visually indistinguishable");
  assert.equal(await widePage.locator("[data-estat-month]").getAttribute("max"), "70");
  assert.equal(await widePage.locator("strong[data-estat-frequency]").textContent(), "気象庁 · 年次");
  assert.match(await widePage.locator("[data-estat-delta-label]").textContent(), /1955年差/u);
  const wideBox = await widePage.locator(".gaia-estat-readout").boundingBox();
  assert.ok(wideBox && wideBox.height < 190, `wide readout wrapped into an extra row: ${JSON.stringify(wideBox)}`);
  const wideReadoutType = await widePage.locator(".gaia-estat-readout").evaluate((readout) => {
    const measure = (selector) => {
      const element = readout.querySelector(selector);
      const style = getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        clipped: element.scrollWidth > element.clientWidth + 1,
      };
    };
    return {
      chapterKicker: measure(".gaia-estat-chapter [data-map-category-label]"),
      chapterNumber: measure(".gaia-estat-chapter b"),
      chapterTitle: measure(".gaia-estat-chapter strong"),
      placeName: measure(".gaia-estat-place strong"),
      locality: measure(".gaia-estat-place small"),
      unit: measure(".gaia-estat-primary > span"),
      comparisonLabel: measure(".gaia-estat-comparison span"),
      comparisonValue: measure(".gaia-estat-comparison strong"),
    };
  });
  assert.ok(wideReadoutType.chapterKicker.fontSize >= 10, `category label remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.ok(wideReadoutType.chapterNumber.fontSize >= 26, `chapter number remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.ok(wideReadoutType.chapterTitle.fontSize >= 21, `chapter title remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.equal(await widePage.locator(".gaia-estat-place > p").count(), 0, "Removed duplicate place label returned");
  assert.ok(wideReadoutType.placeName.fontSize >= 20, `prefecture name remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.ok(wideReadoutType.locality.fontSize >= 10, `compact locality remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.ok(wideReadoutType.unit.fontSize >= 15, `measurement unit remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.ok(wideReadoutType.comparisonLabel.fontSize >= 12, `comparison label remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.ok(wideReadoutType.comparisonValue.fontSize >= 18, `comparison value remained too small: ${JSON.stringify(wideReadoutType)}`);
  assert.equal(Object.values(wideReadoutType).some(({ clipped }) => clipped), false, `enlarged readout text was clipped: ${JSON.stringify(wideReadoutType)}`);
  const sourceAction = widePage.locator("[data-estat-source-action]");
  const analysisAction = widePage.locator("[data-estat-analysis]");
  assert.equal(await sourceAction.isVisible(), true, "e-Stat source action was hidden on desktop");
  assert.equal(await analysisAction.isVisible(), true, "e-Stat analysis action was hidden on desktop");
  assert.equal(await sourceAction.getAttribute("href"), null);
  assert.match(await widePage.evaluate(() => GaiaEstatExhibits.getSourceInfo().datasets[0].url), /^https:\/\/www\.data\.jma\.go\.jp\//u);
  assert.equal(await sourceAction.getAttribute("download"), null, "source action unexpectedly restored a download");
  await widePage.screenshot({ path: path.join(outputDir, "wide-19-source-analysis.png"), fullPage: true });
  await widePage.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  await analysisAction.evaluate((button) => button.click());
  await widePage.waitForFunction(() => (
    globalThis.GaiaStatisticsLab?.getState?.().open
    && globalThis.GaiaStatisticsLab.getState().modeId === "estat-prefecture"
    && globalThis.GaiaStatisticsLab.getState().datasetId === "estat-prefecture-averageTemperature"
    && globalThis.GaiaStatisticsLab.getState().analysisReady
  ), null, { timeout: 30_000 });
  const analysisEvidence = await widePage.evaluate(() => ({
    state: globalThis.GaiaStatisticsLab.getState(),
    context: document.querySelector("#gaia-statistics-context")?.textContent || "",
    recordCount: document.querySelectorAll("#gaia-statistics-records-body tr").length,
    status: document.querySelector("#gaia-statistics-status")?.textContent || "",
  }));
  assert.match(analysisEvidence.context, /公的統計 \/ 47都道府県/u);
  assert.match(analysisEvidence.context, /19 空の体温/u);
  assert.match(analysisEvidence.context, /1955〜2025/u);
  assert.equal(analysisEvidence.recordCount, 71, "statistics lab did not receive the full 71-year temperature series");
  assert.equal(analysisEvidence.state.analysisReady, true, "long-term temperature analysis was not ready");
  assert.equal(analysisEvidence.state.methodId, "regression", "long-term temperature analysis did not open on regression");
  await widePage.waitForTimeout(900);
  const analysisChart = await widePage.locator("#gaia-statistics-canvas").evaluate((canvas) => {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonTransparent = 0;
    for (let index = 3; index < pixels.length; index += 64) if (pixels[index] > 0) nonTransparent += 1;
    return { width: canvas.width, height: canvas.height, nonTransparent };
  });
  assert.ok(analysisChart.nonTransparent > 500, `statistics chart remained blank: ${JSON.stringify(analysisChart)}`);
  await widePage.screenshot({ path: path.join(outputDir, "wide-19-statistics.png"), fullPage: true });
  await widePage.evaluate(() => globalThis.GaiaStatisticsLab.close());
  await widePage.evaluate(async () => {
    await globalThis.GaiaEstatExhibits.select(5);
    globalThis.GaiaEstatExhibits.selectPrefecture(17);
  });
  await widePage.waitForFunction(() => (
    document.querySelector(".gaia-estat-readout")?.dataset.estatExhibit === "winterLow"
    && document.querySelector(".gaia-estat-readout")?.dataset.estatSelectedCode === "18"
  ));
  await widePage.waitForTimeout(1100);
  await widePage.screenshot({ path: path.join(outputDir, "wide-21-readable-readout.png"), fullPage: true });
  await wideContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobilePage = await mobileContext.newPage();
  monitor(mobilePage);
  await openMap(mobilePage);
  await mobilePage.locator('[data-estat-exhibit="estat-lodging"].map-mode-button').evaluate((button) => button.click());
  await mobilePage.waitForFunction(() => document.querySelector(".gaia-estat-readout")?.dataset.estatExhibit === "lodging");
  await mobilePage.waitForTimeout(700);
  await mobilePage.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  await mobilePage.waitForTimeout(1100);
  await mobilePage.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle", null, { timeout: 8_000 });
  await mobilePage.waitForFunction(() => document.querySelector("#gaia-estat-atmosphere-webgl")?.dataset.estatWebglState === "active");
  assert.equal(await mobilePage.locator("#gaia-estat-atmosphere-webgl").getAttribute("data-estat-webgl-theme"), "lodging");
  assert.equal(await mobilePage.locator("#gaia-estat-atmosphere-webgl").getAttribute("data-estat-webgl-flash-cadence"), "none");
  assert.equal(await mobilePage.locator("#gaia-estat-atmosphere-webgl").getAttribute("hidden"), null);
  assert.equal(Number(await mobilePage.locator("#japan-overlay").getAttribute("data-earth-zoom")), 4.25, "mobile e-Stat exhibit start zoom regressed");
  const mobileBox = await mobilePage.locator(".gaia-estat-readout").boundingBox();
  assert.ok(mobileBox && mobileBox.x >= 0 && mobileBox.y >= 0 && mobileBox.x + mobileBox.width <= 390.5 && mobileBox.y + mobileBox.height <= 844.5);
  assert.equal(await mobilePage.locator("#gaia-map-zoom-controls").isVisible(), true);
  assert.equal(await mobilePage.locator("[data-estat-source-action]").isVisible(), true, "e-Stat source action was hidden on mobile");
  assert.equal(await mobilePage.locator("[data-estat-analysis]").isVisible(), true, "e-Stat analysis action was hidden on mobile");
  const mobileChapterType = await mobilePage.locator(".gaia-estat-chapter").evaluate((chapter) => ({
    number: Number.parseFloat(getComputedStyle(chapter.querySelector("b")).fontSize),
    title: Number.parseFloat(getComputedStyle(chapter.querySelector("strong")).fontSize),
    clipped: chapter.scrollWidth > chapter.clientWidth + 1,
  }));
  const mobileUnitSize = await mobilePage.locator(".gaia-estat-primary > span").evaluate((unit) => Number.parseFloat(getComputedStyle(unit).fontSize));
  assert.ok(mobileChapterType.number >= 23, `mobile chapter number remained too small: ${JSON.stringify(mobileChapterType)}`);
  assert.ok(mobileChapterType.title >= 16, `mobile chapter title remained too small: ${JSON.stringify(mobileChapterType)}`);
  assert.equal(mobileChapterType.clipped, false, `mobile chapter column overflowed: ${JSON.stringify(mobileChapterType)}`);
  assert.ok(mobileUnitSize >= 15, `mobile measurement unit remained too small: ${mobileUnitSize}`);
  await mobilePage.screenshot({ path: path.join(outputDir, "mobile-17-source-analysis.png"), fullPage: true });
  await mobileContext.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(responses404, []);
  const report = { status: "passed", baseUrl, snapshots, atmosphereWebglEvidence, lodgingWebglEvidence, autoplayState, autoplayPoiCodes, annualAutoplay, monthEvidence: { february, march }, annualEvidence: { rainfall2020, rainfall2024 }, climateEvidence: { temperature1955, temperature2025, climateReadout }, valueCountEvidence, analysisEvidence, wideReadoutType, mobileChapterType, mobileUnitSize, errors, responses404 };
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
