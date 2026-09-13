import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { japanPrefectureView } from "../src/exploration/japan-prefecture-view.js";
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { createHash } from 'node:crypto';

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/prefecture-gis-view");
const widths = (process.argv[4] || "1440,390,768").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
report.hashes=Object.fromEntries(['app.js','src/exploration/live-exhibits.js','src/exploration/live-prefecture-map.js','src/exploration/estat-exhibits.js','realtime-exhibits.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const close = (actual, expected, label, tolerance = .08) => assert(Math.abs(actual - expected) < tolerance,
  `${label}: expected ${expected}, got ${actual}`);
const equalView = (actual, expected, label) => {
  for (const key of ["zoom", "x", "y"]) close(actual[key], expected[key], `${label}/${key}`);
};
const state = () => page.evaluate(() => {
  const data = document.querySelector("#japan-overlay").dataset;
  return { zoom: Number(data.earthZoom), x: Number(data.earthOffsetX), y: Number(data.earthOffsetY) };
});
const settled = () => page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
const redraw = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const zoomControl = async (action) => {
  const desktop = page.locator(`#gaia-map-zoom-${action}`);
  if (await desktop.isVisible()) await desktop.click();
  else {
    await page.locator('[data-mobile-sheet="tools"]').click();
    await page.locator("#map-mobile-sheet").getByRole("button", {
      name: { in: "＋ 拡大", out: "− 縮小", reset: "全体に戻す" }[action], exact: true,
    }).click();
  }
};
const select = async (number) => {
  await page.evaluate(number => {
    GaiaMapDemo.stop();
    GaiaMapCategories.buttons()[number - 1].click();
    GaiaLiveExhibits.pausePoiAutoplay();
  }, number);
  await page.waitForFunction(number => document.querySelector("#japan-mode-number").textContent.trim() === String(number)
    && document.querySelector("#japan-layer").classList.contains(number <= 20 ? "is-live-exhibit" : "is-estat-exhibit"), number);
  await settled();
  await page.waitForFunction(() => Math.abs(Number(document.querySelector("#japan-overlay").dataset.earthZoom) - (innerWidth <= 720 ? 4.25 : 6)) < .001);
  await redraw();
};
const controls = async () => {
  const result = { initial: await state() };
  await zoomControl("out");
  await redraw(); result.out = await state();
  assert(result.out.zoom < result.initial.zoom, "Zoom-out must shrink the map");
  await zoomControl("in");
  await redraw(); result.in = await state();
  equalView(result.in, result.initial, "Zoom buttons round-trip");
  const point = await page.locator("#japan-map").evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width * .22, y: rect.top + rect.height * .29 };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(150);
  await redraw(); result.wheel = await state();
  assert(result.wheel.zoom < result.in.zoom, "Wheel must shrink the map");
  await page.mouse.down();
  await page.mouse.move(point.x + 48, point.y + 26, { steps: 6 });
  await page.mouse.up();
  await redraw(); result.drag = await state();
  close(result.drag.x - result.wheel.x, 48, "Drag x");
  close(result.drag.y - result.wheel.y, 26, "Drag y");
  const cdp = await page.context().newCDPSession(page);
  const touches = radius => [
    { x: point.x - radius, y: point.y, id: 1 },
    { x: point.x + radius, y: point.y, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches(20) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touches(26) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await redraw(); result.pinch = await state();
  close(result.pinch.zoom / result.drag.zoom, 1.3, "Pinch zoom factor", .002);
  return result;
};
const regionProjection = () => page.evaluate(() => {
  const rect = document.querySelector("#japan-map").getBoundingClientRect();
  const data = document.querySelector("#japan-overlay").dataset;
  const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(data.earthZoom);
  const matrix = document.querySelector(".gaia-live-prefecture-regions > g").transform.baseVal.consolidate().matrix;
  const errors = GaiaLiveExhibits.observationPoints.map(city => {
    const point = new DOMPoint(((city.lon - 150 + 540) % 360), 90 - city.lat).matrixTransform(matrix);
    const x = rect.width / 2 + Number(data.earthOffsetX) + (((city.lon - 150 + 540) % 360) - 180) * scale;
    const y = rect.height / 2 + Number(data.earthOffsetY) - city.lat * scale;
    return Math.hypot(point.x - x, point.y - y);
  });
  return { regionCount: document.querySelectorAll(".gaia-live-prefecture-region").length, maxError: Math.max(...errors) };
});
const makePage = async (width, reducedMotion) => {
  const context = await browser.newContext({ viewport: { width, height: width >= 2400 ? 2088 : width <= 720 ? 844 : 900 }, hasTouch: true, reducedMotion });
  await enforceBrowserSecurity(context,base);await context.route('https://**',route=>route.abort());
  await context.addInitScript(() => {
    sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
  });
  await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
  page = await context.newPage();
  page.on("pageerror", error => report.errors.push(`${width}/${reducedMotion}: ${error.message}`));
  await page.goto(`${base}/?exhibit=21&preview=prefecture-gis-view#world`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-feature-start]').click();
  await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 71 && globalThis.GaiaMapDemo);
  await page.evaluate(async () => {
    await GaiaMapObservationAdapter.waitSignalsReady();
    GaiaModeEntryGuide.close("map", { restoreFocus: false });
    GaiaMapDemo.stop();
  });
  return context;
};
try {
  for (const width of [390, 720, 721, 768, 1440, 3840]) {
    assert.deepEqual(japanPrefectureView(width), {
      lon: 137.4, lat: 36.2, zoom: width <= 720 ? 4.25 : 6,
      targetX: .51, targetY: width <= 720 ? .42 : .44, label: "japan-47-prefectures",
    });
  }
  for (const width of widths) {
    const context = await makePage(width, "reduce");
    let reference;
    for (const number of [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 15, 16, 17, 18, 19, 20]) {
      if(process.env.QA_NUMBERS&&!process.env.QA_NUMBERS.split(',').map(Number).includes(number))continue;
      await select(number);
      const initial = await state();
      close(initial.zoom, width <= 720 ? 4.25 : 6, `${width}/${number} initial zoom`, .001);
      const center = await page.locator("#japan-map").evaluate((element, view) => {
        const rect = element.getBoundingClientRect();
        const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * view.zoom;
        return { x: (rect.width / 2 + view.x + (137.4 - 150) * scale) / rect.width,
          y: (rect.height / 2 + view.y - 36.2 * scale) / rect.height };
      }, initial);
      close(center.x, .51, "Japan center x", .001);
      close(center.y, width <= 720 ? .42 : .44, "Japan center y", .001);
      if (number === 21 || number <= 20) {
        await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
        await page.screenshot({ path: path.join(output, `${width}-${number}.jpg`), type: "jpeg", quality: 85 });
      }
      const views = await controls();
      if (!reference) reference = views;
      else for (const phase of Object.keys(views)) equalView(views[phase], reference[phase], `${width}/${number}/${phase}`);
      if (number <= 20) {
        for (const city of ["tokyo", "naha", "sapporo", "sapporo"]) {
          await page.evaluate(city => GaiaLiveExhibits.selectObservationPoint(city), city);
          await page.waitForFunction(city => document.querySelector('.gaia-live-prefecture-region[aria-current="true"]')?.dataset.city === city
            && document.querySelector("#japan-layer").dataset.livePoiTransition === "settled", city);
          await redraw(); equalView(await state(), views.pinch, `${width}/${number}/${city} preserves camera`);
          const error = await regionProjection();
          assert(error.regionCount===47 && error.maxError < .1, `GIS alignment: ${JSON.stringify(error)}`);
        }
      } else {
        await page.evaluate(() => GaiaEstatExhibits.selectPrefecture(46));
        await redraw(); equalView(await state(), views.pinch, `${number} reference selection preserves camera`);
      }
      await zoomControl("reset");
      await page.waitForFunction(() => Number(document.querySelector("#japan-overlay").dataset.earthZoom) === 1);
      await redraw(); close((await state()).zoom, 1, `${number} shared reset`, .001);
      report.checks.push({ width, number, views });
      console.log(`PASS ${width}/${number}: Japan center, zoom, wheel, drag, pinch, reset and selection`);
    }
    // A modified camera in mode 20 must reset when returning to either deck.
    await select(21); equalView(await state(), reference.initial, "Live to statistics");
    await select(15); equalView(await state(), reference.initial, "Statistics to live");
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();
  }
  for (const width of widths.filter(width => width === 1440 || width === 390)) {
    const context = await makePage(width, "no-preference");
    await select(15);
    const views = await controls();
    const before = await page.evaluate(()=>GaiaLiveData.getCity());
    await page.evaluate(() => GaiaLiveExhibits.resumePoiAutoplay());
    await page.waitForFunction(before => document.querySelector('.gaia-live-prefecture-region[aria-current="true"]')?.dataset.city !== before
      && document.querySelector("#japan-layer").dataset.livePoiTransition === "settled", before, { timeout: 18000 });
    equalView(await state(), views.pinch, `${width} automatic city tour preserves camera`);
    await select(21);
    await page.waitForTimeout(1800);
    equalView(await state(), views.initial, `${width} no late live camera after leaving`);
    report.checks.push({ width, normalMotionAutoplay: true });
    console.log(`PASS ${width}: animated city autoplay and deck exit preserve GIS view`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
