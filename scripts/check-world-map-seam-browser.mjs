import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { EARTH_CENTER_LONGITUDE, earthLongitudeToMapX } from "../src/exploration/world-projection.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/world-map-seam");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", geometry: [], checks: [], errors: [] };
const countries = JSON.parse(fs.readFileSync("data/natural-earth-50m-countries.geojson", "utf8"));
const regions = [
  { name: "south-america", matches: p => p.CONTINENT === "South America", lon: -60, lat: -15 },
  { name: "africa", matches: p => p.CONTINENT === "Africa", lon: 18, lat: 0 },
];
assert.equal(EARTH_CENTER_LONGITUDE, 150);
assert.match(fs.readFileSync("app.js", "utf8"), /const EARTH_INITIAL_CENTER_LONGITUDE = 150;/);
for (const region of regions) {
  const features = countries.features.filter(feature => region.matches(feature.properties));
  assert(features.length > 0, `${region.name}: missing test geometry`);
  region.bounds = { west: 360, east: 0, north: 90, south: -90 };
  let count = 0;
  for (const { geometry } of features) {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) {
      ring.forEach(([lon, lat], index) => {
        const x = earthLongitudeToMapX(lon);
        assert(x >= 0 && x < 360, `${region.name}: coast outside the single world`);
        if (index) assert(Math.abs(x - earthLongitudeToMapX(ring[index - 1][0])) < 180, `${region.name}: split coast`);
        region.bounds.west = Math.min(region.bounds.west, x);
        region.bounds.east = Math.max(region.bounds.east, x);
        region.bounds.north = Math.min(region.bounds.north, 90 - lat);
        region.bounds.south = Math.max(region.bounds.south, 90 - lat);
        count++;
      });
    }
  }
  assert(region.bounds.east - region.bounds.west < 90, `${region.name}: opposite-edge fragments`);
  report.geometry.push({ name: region.name, points: count, bounds: region.bounds });
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const viewport of [{ width: 3840, height: 2088 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 720, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      const locations = new WeakMap();
      const getLocation = WebGL2RenderingContext.prototype.getUniformLocation;
      WebGL2RenderingContext.prototype.getUniformLocation = function(program, name) {
        const location = getLocation.call(this, program, name);
        if (location) locations.set(location, name);
        return location;
      };
      const uniform4f = WebGL2RenderingContext.prototype.uniform4f;
      WebGL2RenderingContext.prototype.uniform4f = function(location, ...values) {
        if (this.canvas.id === "gaia-estat-atmosphere-webgl" && locations.get(location) === "u_geo_view") window.__seamOceanView = values;
        return uniform4f.call(this, location, ...values);
      };
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width: viewport.width, message: error.message }));
    await page.goto(`${base}/?preview=world-map-seam#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaFirmsExhibit);
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning") && document.querySelector("#scene-transition")?.hidden !== false);
    await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    const scan = () => page.evaluate(() => {
      const map = document.querySelector("#japan-map").getBoundingClientRect();
      const d = document.querySelector("#japan-overlay").dataset;
      const scale = (map.width >= 901 ? map.width / 360 : Math.max(map.width / 360, map.height / 180)) * Number(d.earthZoom);
      return { width: map.width, height: map.height, scale,
        originX: (map.width - 360 * scale) / 2 + Number(d.earthOffsetX),
        originY: (map.height - 180 * scale) / 2 + Number(d.earthOffsetY),
        center: Number(d.earthCenterLongitude), zoom: Number(d.earthZoom),
        japanX: Number(d.japanScreenX), japanY: Number(d.japanScreenY),
        copies: d.vectorWorldCopies, raster: d.rasterWorldCopies,
      };
    });
    const select = async number => {
      await page.evaluate(number => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => button.textContent.trim() === String(number).padStart(2, "0")).click(), number);
      await page.waitForFunction(number => document.querySelector("#japan-mode-number").textContent.trim() === String(number).padStart(2, "0")
        && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning")
        && document.querySelector("#japan-title").textContent === document.querySelector("#japan-mode-title").textContent, number);
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.worldBoundaryLayer === "country");
      await page.waitForTimeout(150);
    };
    const checkProjection = async label => {
      await page.waitForFunction(() => {
        const r = document.querySelector("#japan-map").getBoundingClientRect();
        const d = document.querySelector("#japan-overlay").dataset;
        const scale = (r.width >= 901 ? r.width / 360 : Math.max(r.width / 360, r.height / 180)) * Number(d.earthZoom);
        const originX = (r.width - 360 * scale) / 2 + Number(d.earthOffsetX);
        return d.vectorWorldCopies && Math.abs(Number(d.vectorWorldCopies.split(",")[0]) - (originX - Number(d.earthCenterLongitude) * scale)) < .02;
      });
      const state = await scan();
      assert.equal(state.center, EARTH_CENTER_LONGITUDE, label);
      const pieces = state.copies.split(",").map(Number);
      assert.equal(pieces.length, 2, `${label}: only the two adjacent pieces of one rotated world are needed`);
      assert(Math.abs(pieces[0] - (state.originX - EARTH_CENTER_LONGITUDE * state.scale)) < 0.02, `${label}: vector origin differs`);
      assert(Math.abs(pieces[1] - pieces[0] - 360 * state.scale) < .02, `${label}: texture pieces overlap`);
      assert(Math.abs(state.japanX - (state.originX + earthLongitudeToMapX(138) * state.scale)) < .04, `${label}: Japan marker shifted`);
      assert(state.originX <= .05 && state.originX + 360 * state.scale >= state.width - .05, `${label}: horizontal camera escaped world`);
      report.checks.push({ viewport, label, state });
      return state;
    };
    await select(26);
    await page.waitForFunction(() => Number(document.querySelector("#gaia-firms-canvas").dataset.firmsPointCount) > 100);
    await page.waitForFunction(() => document.querySelector("#gaia-firms-canvas").dataset.firmsPlaybackPhase === "complete");
    const overview = await checkProjection("fire-overview");
    assert.equal(await page.locator("#gaia-firms-canvas").getAttribute("data-firms-projection"), "japan-pacific-equirectangular-150");
    assert(overview.japanX / overview.width >= .4 && overview.japanX / overview.width <= .51, "Japan must remain central, not at the world edge");
    if (viewport.width >= 720) for (const region of regions) {
      const left = overview.originX + region.bounds.west * overview.scale;
      const right = overview.originX + region.bounds.east * overview.scale;
      assert(left > 0 && right < overview.width, `${region.name}: coastline clipped at viewport edge`);
    }
    await page.screenshot({ path: path.join(output, `${viewport.width}-fire-overview.jpg`), type: "jpeg", quality: 88 });
    // Portrait screens retain cover/pan behaviour: each landmass is available as
    // one continuous region, not as fragments wrapped onto opposite edges.
    for (const region of regions) {
      await page.evaluate(region => GaiaMapObservationAdapter.focusEarthLocation({ ...region, zoom: 1, durationMs: 0 }),
        { lon: ((region.bounds.west + region.bounds.east) / 2 + EARTH_CENTER_LONGITUDE) % 360 - 180, lat: region.lat });
      await page.waitForTimeout(100);
      const state = await checkProjection(region.name);
      const left = state.originX + region.bounds.west * state.scale;
      const right = state.originX + region.bounds.east * state.scale;
      assert(left > 0 && right < state.width, `${viewport.width}/${region.name}: split after focusing`);
      if (viewport.width < 720) await page.screenshot({ path: path.join(output, `${viewport.width}-${region.name}.jpg`), type: "jpeg", quality: 88 });
    }
    await select(3);
    await page.waitForFunction(() => {
      const d = document.querySelector("#japan-overlay").dataset;
      return d.rasterWorldCopies && d.rasterWorldCopies === d.vectorWorldCopies;
    });
    let state = await checkProjection("raster-vector-overview");
    assert.equal(state.raster.split(",").length, 2, "raster must use the same two non-overlapping texture pieces");
    await page.locator("#gaia-map-zoom-in").click();
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay").dataset.earthZoom) > 1.1);
    await checkProjection("zoom");
    await page.locator("#japan-map").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);
    await checkProjection("pan");
    await page.locator("#gaia-map-zoom-reset").click();
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay").dataset.earthZoom) === 1);
    state = await checkProjection("reset");
    assert.equal(state.raster, state.copies);
    await select(2);
    await page.waitForTimeout(100);
    state = await checkProjection("japan-current-focus");
    assert(state.japanX > 0 && state.japanX < state.width && state.japanY > 0 && state.japanY < state.height);
    await select(7);
    if (viewport.width < 720) {
      state = await checkProjection("ecologies-japan-focus");
      assert(Math.abs(state.japanX - state.width / 2) < .1, "Mobile ecology lost its Japan focus");
    }
    await select(16);
    await page.waitForFunction(() => window.__seamOceanView && document.querySelector("#gaia-estat-atmosphere-webgl").dataset.estatOceanMask === "ready");
    state = await checkProjection("prefecture-ocean-mask");
    const oceanView = await page.evaluate(() => window.__seamOceanView);
    assert(Math.abs(oceanView[0] - (EARTH_CENTER_LONGITUDE - 180 - state.originX / state.scale)) < .01, "Ocean land mask is shifted from the coastline");
    assert(Math.abs(oceanView[1] - (90 + state.originY / state.scale)) < .01);
    await page.screenshot({ path: path.join(output, `${viewport.width}-prefectures.jpg`), type: "jpeg", quality: 88 });
    await context.close();
    console.log(`PASS world seam ${viewport.width}: whole coastlines, single world, aligned layers and navigation`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
