import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";


const argumentsList = process.argv.slice(2);
const option = (name) => {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : undefined;
};
const browserPath = option("--browser");
if (!browserPath) throw new Error("--browser is required");
const baseUrl = option("--base-url");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(option("--output") || "artifacts/live-open-meteo-browser");
fs.mkdirSync(output, { recursive: true });
const mime = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

const server = baseUrl ? null : http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = fs.readFileSync(file);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": body.length,
      "Content-Type": mime.get(path.extname(file).toLowerCase()) || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

if (server) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = baseUrl?.replace(/\/$/u, "") || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const errors = [];
const responses404 = [];

const contracts = [
  { id: "wind-field", key: "weatherWindSpeed", number: "10", title: "風脈" },
  { id: "carbon-pulse", key: "forecastCo2", number: "11", title: "炭素の呼吸" },
  { id: "rain-chorus", key: "weatherPrecipitation", number: "12", title: "雨の記憶" },
  { id: "temperature-field", key: "weatherTemperature", number: "13", title: "熱の輪郭" },
  { id: "cloud-drift", key: "cloudCover", number: "14", title: "雲の層" },
  { id: "pm25-haze", key: "pm25", number: "15", title: "微粒子の霞" },
];

const monitor = (page) => {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("response", (response) => {
    if (response.status() === 404) responses404.push(response.url());
  });
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  monitor(page);
  await page.goto(`${origin}/#earth`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter), null, { timeout: 30_000 });
  await page.evaluate(() => { location.hash = "#japan"; });
  await page.waitForFunction(() => document.querySelectorAll("#japan-mode-list [data-live-exhibit]").length === 6, null, { timeout: 20_000 });
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  assert.equal(await page.locator("#map-mode-bank-kicker").textContent(), "INSTALLATION BANK / MAP 01—30");
  assert.equal(await page.locator("#japan-mode-list .map-mode-button").count(), 15);
  assert.equal(await page.locator("#japan-estat-mode-list .map-mode-button").count(), 10);
  assert.equal(await page.locator(".gaia-live-prefecture-picker option").count(), 47);
  assert.equal(await page.locator(".gaia-live-city-marker").count(), 47);
  const prefectureOrder = await page.evaluate(() => globalThis.GaiaLiveExhibits.observationPoints.map(({ code, id }) => ({ code, id })));
  assert.deepEqual(prefectureOrder.map(({ code }) => code), Array.from({ length: 47 }, (_, index) => String(index + 1).padStart(2, "0")));
  assert.equal(prefectureOrder[0].id, "sapporo");
  assert.equal(prefectureOrder.at(-1).id, "naha");

  for (const button of await page.locator("#japan-mode-list .map-mode-button:not([data-live-exhibit])").all()) {
    await button.evaluate((element) => element.click());
    const controls = await page.locator("#gaia-map-zoom-controls").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        buttonCount: element.querySelectorAll("button").length,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden",
      };
    });
    assert.equal(controls.visible, true, "shared zoom controls disappeared in a standard map chapter");
    assert.equal(controls.buttonCount, 3, "standard map chapter did not use the shared zoom controls");
    await page.waitForTimeout(40);
    const zoomBeforeControl = Number(await page.locator("#japan-overlay").getAttribute("data-earth-zoom"));
    await page.locator("#gaia-map-zoom-in").evaluate((element) => element.click());
    await page.waitForFunction((zoom) => Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) > zoom + 0.05, zoomBeforeControl);
    if (!(await page.locator("#gaia-map-zoom-reset").isDisabled())) {
      await page.locator("#gaia-map-zoom-reset").evaluate((element) => element.click());
      await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) <= 1.01);
    }
  }
  const desktopZoomButtonSizes = await page.locator("#gaia-map-zoom-controls button").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  assert(desktopZoomButtonSizes.every(({ width, height }) => width >= 48 && height >= 48), `zoom controls are too small: ${JSON.stringify(desktopZoomButtonSizes)}`);

  const fallbackKeys = await page.evaluate(async () => {
    const payload = await fetch("./data/live-observation-fallback-v1.json").then((response) => response.json());
    return payload.events.flatMap((event) => event.measurements || []).map((measurement) => measurement.key);
  });
  for (const contract of contracts) assert(fallbackKeys.includes(contract.key), `${contract.key}: fallback value missing`);

  await page.locator('#japan-mode-list [data-live-exhibit="wind-field"]').evaluate((button) => button.click());
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  await page.waitForFunction(() => document.querySelector(".japan-layer")?.dataset.livePoiTransition === "settled");
  const hokkaidoState = await page.evaluate(() => ({
    city: document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity,
    code: document.querySelector('.gaia-live-city-marker[aria-current="true"]')?.dataset.prefectureCode,
    picker: document.querySelector(".gaia-live-place-selector")?.dataset.city,
    target: document.querySelector("#japan-overlay")?.dataset.viewTarget,
    zoom: Number(document.querySelector("#japan-overlay")?.dataset.earthZoom),
  }));
  assert.equal(hokkaidoState.city, "sapporo");
  assert.equal(hokkaidoState.code, "01");
  assert.equal(hokkaidoState.picker, "sapporo");
  assert.equal(hokkaidoState.target, "prefecture-01-sapporo");
  assert(Math.abs(hokkaidoState.zoom - 4.45) < 0.035, `MAP10 did not start at the requested Japan-focused size: ${JSON.stringify(hokkaidoState)}`);
  const hokkaidoScreenshot = path.join(output, "map-10-prefecture-01-hokkaido.png");
  await page.screenshot({ path: hokkaidoScreenshot });

  await page.evaluate(() => {
    globalThis.GaiaLiveExhibits.pausePoiAutoplay();
    const points = globalThis.GaiaLiveExhibits.observationPoints.map((city, index) => ({
      id: city.id,
      name: city.name,
      lat: city.lat,
      lon: city.lon,
      windSpeed: 0.5 + index * 0.4,
      observedAt: "2026-09-03T00:00:00.000Z",
      quality: "estimated",
    }));
    dispatchEvent(new CustomEvent("gaia:live-wind-field", { detail: {
      schemaVersion: 1,
      source: "browser-fixture",
      generatedAt: "2026-09-03T00:00:00.000Z",
      points,
    } }));
  });
  await page.waitForFunction(() => Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.windFieldCount || 0) >= 3);
  const windFieldState = await page.evaluate(() => ({
    count: Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.windFieldCount),
    min: Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.windFieldMin),
    max: Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.windFieldMax),
    source: document.querySelector("#gaia-live-exhibit-canvas")?.dataset.windFieldSource,
    arrowCount: document.querySelectorAll("[data-live-poi-step]").length,
    lowColor: getComputedStyle(document.querySelector('[data-live-city-marker="sapporo"] > i')).backgroundColor,
    highColor: getComputedStyle(document.querySelector('[data-live-city-marker="naha"] > i')).backgroundColor,
    nahaSpeed: document.querySelector('[data-live-city-marker="naha"]')?.dataset.windSpeed,
    legend: [...document.querySelectorAll("[data-signal-encoding-legend] dt")].map((item) => item.textContent.trim()),
  }));
  assert(windFieldState.count >= 3, `too few visible WebGL wind brushes: ${JSON.stringify(windFieldState)}`);
  assert(windFieldState.max > windFieldState.min, `wind strengths were flattened: ${JSON.stringify(windFieldState)}`);
  assert.equal(windFieldState.source, "browser-fixture");
  assert.equal(windFieldState.arrowCount, 4);
  assert.notEqual(windFieldState.lowColor, windFieldState.highColor);
  assert.equal(windFieldState.nahaSpeed, "18.9");
  assert.deepEqual(windFieldState.legend, [
    "色 / 10m風速（青→赤）",
    "暗い地点 / 取得値なし",
    "筆の太さ・明度 / 風速に比例",
    "筆の向き / 風向ではない",
  ]);
  const windFieldScreenshot = path.join(output, "map-10-prefecture-wind-brush-field.png");
  await page.waitForTimeout(360);
  await page.screenshot({ path: windFieldScreenshot });

  await page.locator('.gaia-live-prefecture-picker [data-live-poi-step="1"]').click();
  await page.waitForFunction(() => (
    document.querySelector(".japan-layer")?.dataset.livePoiTransition === "settled"
    && document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity === "aomori"
  ));
  await page.locator('.gaia-live-prefecture-picker [data-live-poi-step="-1"]').click();
  await page.waitForFunction(() => (
    document.querySelector(".japan-layer")?.dataset.livePoiTransition === "settled"
    && document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity === "sapporo"
  ));

  await page.evaluate(() => globalThis.GaiaLiveExhibits.resumePoiAutoplay());
  await page.waitForFunction(() => {
    const layer = document.querySelector(".japan-layer");
    return layer?.dataset.livePoiSource === "auto"
      && layer.dataset.livePoiTo === "02"
      && layer.dataset.livePoiTransition === "arriving";
  }, null, { timeout: 12_000 });
  const transitionScreenshot = path.join(output, "map-10-prefecture-01-to-02-transition.png");
  await page.screenshot({ path: transitionScreenshot });
  await page.waitForFunction(() => (
    document.querySelector(".japan-layer")?.dataset.livePoiTransition === "settled"
    && document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity === "aomori"
    && document.querySelector("#japan-overlay")?.dataset.viewAnimation !== "running"
  ), null, { timeout: 8_000 });
  const aomoriState = await page.evaluate(() => ({
    city: document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity,
    code: document.querySelector('.gaia-live-city-marker[aria-current="true"]')?.dataset.prefectureCode,
    picker: document.querySelector(".gaia-live-place-selector")?.dataset.city,
    target: document.querySelector("#japan-overlay")?.dataset.viewTarget,
    zoom: Number(document.querySelector("#japan-overlay")?.dataset.earthZoom),
  }));
  assert.equal(aomoriState.city, "aomori");
  assert.equal(aomoriState.code, "02");
  assert.equal(aomoriState.picker, "aomori");
  assert.equal(aomoriState.target, "prefecture-02-aomori");
  assert(Math.abs(aomoriState.zoom - hokkaidoState.zoom) < 0.01, `automatic POI relay changed the map scale: ${JSON.stringify({ hokkaidoState, aomoriState })}`);
  const aomoriScreenshot = path.join(output, "map-10-prefecture-02-aomori.png");
  await page.screenshot({ path: aomoriScreenshot });
  await page.evaluate(() => {
    globalThis.GaiaLiveExhibits.pausePoiAutoplay();
    globalThis.GaiaLiveExhibits.selectObservationPoint("sapporo");
  });
  await page.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity === "sapporo");
  await page.evaluate(() => globalThis.GaiaLiveExhibits.pausePoiAutoplay());

  const screenshots = [hokkaidoScreenshot, windFieldScreenshot, transitionScreenshot, aomoriScreenshot];
  for (let index = 0; index < contracts.length; index += 1) {
    const contract = contracts[index];
    await page.locator(`#japan-mode-list [data-live-exhibit="${contract.id}"]`).evaluate((button) => button.click());
    await page.waitForFunction((mode) => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === String(mode), index);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await page.waitForFunction(() => Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglFrame || 0) > 0);
    const state = await page.locator("#gaia-live-exhibit-canvas").evaluate((canvas) => ({
      anchorLatitude: Number(canvas.dataset.anchorLatitude),
      anchorLongitude: Number(canvas.dataset.anchorLongitude),
      deckModeCount: document.querySelectorAll('.map-mode-bank [data-live-exhibit]').length,
      deckRect: (() => {
        const rect = document.querySelector(".gaia-live-exhibit-readout")?.getBoundingClientRect();
        return rect ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width } : null;
      })(),
      guideRect: (() => {
        const element = document.querySelector("#gaia-mode-entry-guide .gaia-mode-entry-guide-card");
        const rect = element?.getBoundingClientRect();
        return rect && rect.width > 0 ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width } : null;
      })(),
      feedTimeFontSize: Number.parseFloat(getComputedStyle(document.querySelector("[data-live-exhibit-feed-time]")).fontSize),
      layerState: (() => {
        const element = document.querySelector(".japan-layer");
        return { className: element?.className || "", hidden: element?.hasAttribute("hidden") || false };
      })(),
      missing: document.querySelector(".gaia-live-exhibit-readout")?.dataset.missing,
      signalKey: canvas.dataset.signalKey,
      title: document.querySelector("#japan-title")?.textContent,
    }));
    assert.equal(state.signalKey, contract.key);
    assert.equal(state.title, contract.title);
    assert.equal(state.missing, "true");
    assert.equal(state.anchorLatitude, 43.0618);
    assert.equal(state.anchorLongitude, 141.3545);
    assert.equal(state.deckModeCount, 6);
    assert.equal(await page.locator("#gaia-map-zoom-controls").isVisible(), true, `${contract.id}: shared zoom controls disappeared`);
    assert(state.feedTimeFontSize >= 12, `${contract.id}: live timestamp is too small ${JSON.stringify(state)}`);
    assert.equal(await page.locator(".gaia-live-deck-location > p").textContent(), "都道府県");
    assert(state.deckRect && state.deckRect.left >= 0 && state.deckRect.right <= 1440, `${contract.id}: deck leaves the viewport`);
    assert.match(await page.locator("[data-live-anchor-source]").textContent(), /MODEL GRID/u);
    assert.match(await page.locator("[data-live-exhibit-source]").textContent(), /SOURCE DATA MISSING/u);
    assert.match(await page.locator("[data-live-exhibit-feed-copy]").textContent(), /保存|再現/u);
    await page.waitForTimeout(700);
    const overlap = await page.evaluate(() => {
      const deck = document.querySelector(".gaia-live-exhibit-readout")?.getBoundingClientRect();
      const guideElement = document.querySelector("#gaia-mode-entry-guide .gaia-mode-entry-guide-card");
      const guide = guideElement?.getBoundingClientRect();
      if (!deck || !guide || guide.width <= 0) return null;
      return { deckTop: deck.top, guideBottom: guide.bottom };
    });
    if (overlap) assert(overlap.guideBottom <= overlap.deckTop + 1, `${contract.id}: guide overlaps deck ${JSON.stringify(overlap)}`);
    const screenshot = path.join(output, `live-${contract.number}.png`);
    await page.screenshot({ path: screenshot, animations: "disabled" });
    screenshots.push(screenshot);
  }

  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
  await page.locator('#japan-mode-list [data-live-exhibit="wind-field"]').evaluate((button) => button.click());
  await page.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === "0");
  await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation !== "running");
  assert.equal(await page.locator("#gaia-map-zoom-controls").isVisible(), true, "shared zoom controls disappeared in MAP10");
  assert.equal(await page.locator(".gaia-live-city-marker").count(), 47);
  assert(Number(await page.locator(".gaia-live-city-markers").getAttribute("data-visible-count")) > 1, "MAP10 only exposed one observation city");
  const mapBox = await page.locator("#japan-map").boundingBox();
  assert(mapBox, "live map bounds were unavailable");
  const wheelPoint = { x: mapBox.x + mapBox.width * 0.62, y: mapBox.y + mapBox.height * 0.34 };
  const readWheelState = (point) => page.evaluate(({ x, y }) => {
    const map = document.querySelector("#japan-map");
    const canvas = document.querySelector("#gaia-live-exhibit-canvas");
    const overlay = document.querySelector("#japan-overlay");
    const rect = map?.getBoundingClientRect();
    const zoom = Number(overlay?.dataset.earthZoom);
    const offsetX = Number(overlay?.dataset.earthOffsetX);
    const offsetY = Number(overlay?.dataset.earthOffsetY);
    const baseScale = Math.max(rect.width / 360, rect.height / 180);
    const scale = baseScale * zoom;
    const worldWidth = 360 * scale;
    const worldHeight = 180 * scale;
    const originX = (rect.width - worldWidth) / 2 + offsetX;
    const originY = (rect.height - worldHeight) / 2 + offsetY;
    let mapPixelSignature = 2166136261;
    const context = overlay?.getContext("2d");
    if (context && overlay.width > 0 && overlay.height > 0) {
      const pixels = context.getImageData(0, 0, overlay.width, overlay.height).data;
      const stepX = Math.max(1, Math.floor(overlay.width / 40));
      const stepY = Math.max(1, Math.floor(overlay.height / 24));
      for (let sampleY = 0; sampleY < overlay.height; sampleY += stepY) {
        for (let sampleX = 0; sampleX < overlay.width; sampleX += stepX) {
          const index = (sampleY * overlay.width + sampleX) * 4;
          mapPixelSignature = Math.imul(mapPixelSignature ^ pixels[index], 16777619);
          mapPixelSignature = Math.imul(mapPixelSignature ^ pixels[index + 1], 16777619);
          mapPixelSignature = Math.imul(mapPixelSignature ^ pixels[index + 2], 16777619);
          mapPixelSignature = Math.imul(mapPixelSignature ^ pixels[index + 3], 16777619);
        }
      }
    }
    return {
      mapPixelSignature: mapPixelSignature >>> 0,
      poiX: Number(canvas?.dataset.anchorNormalizedX),
      poiY: Number(canvas?.dataset.anchorNormalizedY),
      mapX: (x - rect.left - originX) / scale,
      mapY: (y - rect.top - originY) / scale,
      scale,
      zoom,
      scrollY,
    };
  }, point);
  const beforeWheel = await readWheelState(wheelPoint);
  await page.mouse.move(wheelPoint.x, wheelPoint.y);
  const wheelTarget = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return { id: element?.id || "", className: element?.className || "", tagName: element?.tagName || "" };
  }, wheelPoint);
  await page.mouse.wheel(0, -180);
  await page.waitForTimeout(180);
  const afterWheel = await readWheelState(wheelPoint);
  const cursorDriftPx = Math.hypot(afterWheel.mapX - beforeWheel.mapX, afterWheel.mapY - beforeWheel.mapY) * afterWheel.scale;
  const poiMovement = Math.hypot(afterWheel.poiX - beforeWheel.poiX, afterWheel.poiY - beforeWheel.poiY);
  assert(afterWheel.zoom > beforeWheel.zoom, `wheel did not zoom the live map: ${JSON.stringify({ mapBox, wheelPoint, wheelTarget, beforeWheel, afterWheel })}`);
  assert.notEqual(afterWheel.mapPixelSignature, beforeWheel.mapPixelSignature, `wheel changed projection numbers but not the visible map pixels: ${JSON.stringify({ beforeWheel, afterWheel })}`);
  assert(cursorDriftPx <= 0.75, `wheel zoom drifted away from the cursor: ${JSON.stringify({ cursorDriftPx, beforeWheel, afterWheel })}`);
  assert(poiMovement >= 0.005, `wheel zoom remained pinned to the selected POI: ${JSON.stringify({ poiMovement, beforeWheel, afterWheel })}`);
  assert.equal(afterWheel.scrollY, beforeWheel.scrollY, `wheel scrolled the page: ${JSON.stringify({ beforeWheel, afterWheel })}`);

  await page.locator("[data-live-deck-source]").click();
  await page.waitForFunction(() => document.querySelector("#japan-data-panel")?.getAttribute("aria-hidden") === "false");
  await page.locator("#japan-data-close").click();
  await page.locator("[data-live-deck-analysis]").click();
  await page.waitForFunction(() => document.querySelector("#gaia-statistics-lab")?.getAttribute("aria-hidden") === "false");
  await page.locator("#gaia-statistics-close").click();

  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.locator('#japan-mode-list [data-live-exhibit="wind-field"]').evaluate((button) => button.click());
  await page.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === "0");
  await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation !== "running");
  const wideLayout = await page.evaluate(() => ({
    chapterVisible: document.querySelector(".gaia-live-deck-chapter")?.getBoundingClientRect().width > 0,
    deckWidth: document.querySelector(".gaia-live-exhibit-readout")?.getBoundingClientRect().width || 0,
    locationVisible: document.querySelector(".gaia-live-deck-location")?.getBoundingClientRect().width > 0,
    overflow: document.documentElement.scrollWidth - innerWidth,
  }));
  assert.equal(wideLayout.chapterVisible, true);
  assert.equal(wideLayout.locationVisible, true);
  assert(wideLayout.deckWidth >= 3700, `wide deck is too narrow: ${wideLayout.deckWidth}px`);
  assert(wideLayout.overflow <= 1, `wide horizontal overflow: ${wideLayout.overflow}px`);
  await page.locator("#gaia-map-zoom-reset").click();
  await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) <= 1.01);
  await page.waitForTimeout(180);
  const zoomBeforeScreenshot = path.join(output, "map-10-zoom-before-4k.png");
  await page.screenshot({ path: zoomBeforeScreenshot, animations: "disabled" });
  const wideMapBox = await page.locator("#japan-map").boundingBox();
  assert(wideMapBox, "4K live map bounds were unavailable");
  const wideAnchor = await page.locator("#gaia-live-exhibit-canvas").evaluate((canvas) => ({
    x: Number(canvas.dataset.anchorNormalizedX),
    y: Number(canvas.dataset.anchorNormalizedY),
  }));
  const wideWheelPoint = {
    x: wideMapBox.x + wideMapBox.width * wideAnchor.x,
    y: wideMapBox.y + wideMapBox.height * wideAnchor.y,
  };
  await page.mouse.move(wideWheelPoint.x, wideWheelPoint.y);
  await page.mouse.wheel(0, -240);
  await page.mouse.wheel(0, -240);
  await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) >= 3);
  await page.waitForTimeout(260);
  const zoomAfterScreenshot = path.join(output, "map-10-zoom-after-4k.png");
  await page.screenshot({ path: zoomAfterScreenshot, animations: "disabled" });
  screenshots.push(zoomBeforeScreenshot, zoomAfterScreenshot);

  await page.locator('[data-live-city-marker="osaka"]').evaluate((button) => button.click());
  await page.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.observationCity === "osaka");
  await page.waitForFunction(() => Math.abs(Number(document.querySelector("#gaia-live-exhibit-canvas")?.dataset.anchorLatitude) - 34.6937) < 0.01);
  assert.match(await page.locator(".gaia-live-place-selector").getAttribute("data-city"), /osaka/u);

  await page.locator('#japan-mode-list [data-live-exhibit="pm25-haze"]').evaluate((button) => button.click());
  await page.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === "5");
  const wideMetricLayout = await page.evaluate(() => {
    const title = document.querySelector("[data-live-exhibit-title-ja]")?.getBoundingClientRect();
    const value = document.querySelector("[data-live-exhibit-value]")?.getBoundingClientRect();
    const titleElement = document.querySelector("[data-live-exhibit-title-ja]");
    return {
      title: title ? { top: title.top, right: title.right, bottom: title.bottom, left: title.left, height: title.height } : null,
      value: value ? { top: value.top, right: value.right, bottom: value.bottom, left: value.left } : null,
      whiteSpace: titleElement ? getComputedStyle(titleElement).whiteSpace : "",
    };
  });
  assert.equal(wideMetricLayout.whiteSpace, "nowrap");
  assert(wideMetricLayout.title && wideMetricLayout.title.height < 45, `wide title wrapped: ${JSON.stringify(wideMetricLayout)}`);
  assert(wideMetricLayout.value && wideMetricLayout.title.right <= wideMetricLayout.value.left + 1, `wide title overlaps value: ${JSON.stringify(wideMetricLayout)}`);
  const wideMetricScreenshot = path.join(output, "live-14-wide.png");
  await page.screenshot({ path: wideMetricScreenshot, animations: "disabled" });
  screenshots.push(wideMetricScreenshot);
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  monitor(mobilePage);
  await mobilePage.goto(`${origin}/#earth`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await mobilePage.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter), null, { timeout: 30_000 });
  await mobilePage.evaluate(() => { location.hash = "#japan"; });
  await mobilePage.waitForFunction(() => document.querySelectorAll("#japan-mode-list [data-live-exhibit]").length === 6, null, { timeout: 20_000 });
  await mobilePage.locator('#japan-mode-list [data-live-exhibit="pm25-haze"]').evaluate((button) => button.click());
  await mobilePage.waitForFunction(() => document.querySelector("#gaia-live-exhibit-canvas")?.dataset.webglMode === "5");
  const mobileLayout = await mobilePage.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth - innerWidth,
    readoutVisible: document.querySelector(".gaia-live-exhibit-readout")?.getBoundingClientRect().width > 0,
    buttonCount: document.querySelectorAll("#japan-mode-list .map-mode-button").length,
  }));
  assert(mobileLayout.bodyOverflow <= 1, `mobile horizontal overflow: ${mobileLayout.bodyOverflow}px`);
  assert.equal(mobileLayout.readoutVisible, true);
  assert.equal(mobileLayout.buttonCount, 15);
  const mobileScreenshot = path.join(output, "live-14-mobile.png");
  await mobilePage.screenshot({ path: mobileScreenshot, animations: "disabled" });
  await mobileContext.close();

  assert.deepEqual(responses404, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "passed", exhibits: contracts.length, screenshots: [...screenshots, mobileScreenshot] }));
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
