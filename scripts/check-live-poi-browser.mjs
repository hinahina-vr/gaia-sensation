import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { pickProjectedPoi } from "../src/exploration/poi-hit-test.js";

const base = process.argv[2] || "http://127.0.0.1:4173";
const output = path.resolve(process.argv[3] || "artifacts/live-poi");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const timestamp = Date.now();
const sample = JSON.parse(fs.readFileSync("data/firms-active-fire-snapshot.json", "utf8"));
const ovation = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
// Separate points around the visible centre make nearest-neighbour errors obvious.
const firePoints = [
  { ...sample.points[0], id: "poi-fire-a", lon: 138, lat: 6, frp: 42.5, confidence: 96 },
  { ...sample.points[1], id: "poi-fire-b", lon: 156, lat: -10, frp: 18.3, confidence: 81 },
  { ...sample.points[2], id: "poi-fire-future", lon: 148, lat: 24, frp: 83.1, confidence: 88 },
];
const fire = { ...sample, points: firePoints, summary: { ...sample.summary, displayed: 3, detected: 3, maxFrp: 83.1 } };
const quakePoints = [
  { id: "poi-quake-a", lon: 138, lat: 6, magnitude: 5.3, depth: 12, label: "TEST EPICENTRE ALPHA" },
  { id: "poi-quake-b", lon: 156, lat: -10, magnitude: 3.1, depth: 47, label: "TEST EPICENTRE BETA" },
];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

const project = (page, point) => page.evaluate(({ lon, lat }) => {
  const rect = document.querySelector("#japan-map").getBoundingClientRect();
  const data = document.querySelector("#japan-overlay").dataset;
  const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * (Number(data.earthZoom) || 1);
  return {
    x: rect.left + (rect.width - 360 * scale) / 2 + (Number(data.earthOffsetX) || 0) + ((lon - Number(data.earthCenterLongitude) + 540) % 360) * scale,
    y: rect.top + (rect.height - 180 * scale) / 2 + (Number(data.earthOffsetY) || 0) + (90 - lat) * scale,
  };
}, point);

try {
  // CSS-pixel radius, visible-only, nearest-only, and no world-copy/empty-area fallback.
  const view = { rect: { left: 10, top: 20, width: 720, height: 360 }, originX: 0, originY: 0, scale: 2 };
  const points = [{ lon: 150, lat: 0 }, { lon: 155, lat: 0 }];
  assert.equal(pickProjectedPoi(points, view, 380, 200).index, 1);
  assert.equal(pickProjectedPoi(points, view, 370, 200, "mouse", () => false), null);
  assert.equal(pickProjectedPoi(points, view, 345, 200, "mouse"), null);
  assert.equal(pickProjectedPoi(points, view, 345, 200, "touch").index, 0);
  assert.equal(pickProjectedPoi(points, view, -1, 200), null);

  for (const viewport of [{ width: 3840, height: 2088 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const mobile = viewport.width < 900;
    const context = await browser.newContext({ viewport, hasTouch: mobile, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("**/firms-active-fire-snapshot.json", route => route.fulfill({ json: fire }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: ovation }));
    const modelResponse = (route) => {
      const params = new URL(route.request().url()).searchParams;
      const count = params.get("latitude").split(",").length;
      return route.fulfill({ json: Array.from({ length: count }, () => ({ current: {
        time: new Date(timestamp).toISOString().slice(0, 16), wind_speed_10m: 7.2, wind_direction_10m: 124,
        surface_pressure: 1014, cloud_cover: 36, shortwave_radiation: 512, pm2_5: 13.4, aerosol_optical_depth: .27,
      } })) });
    };
    await context.route("https://api.open-meteo.com/**", modelResponse);
    await context.route("https://air-quality-api.open-meteo.com/**", modelResponse);
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      metadata: { generated: timestamp }, features: quakePoints.map((point, index) => ({
        id: point.id, geometry: { coordinates: [point.lon, point.lat, point.depth] },
        properties: { mag: point.magnitude, place: point.label, time: timestamp - (index + 1) * 60000 },
      })),
    } }));
    const page = await context.newPage();
    const touchSession = mobile ? await context.newCDPSession(page) : null;
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(base + "/?preview=live-poi#world", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaPlanetSignals && globalThis.GaiaFirmsExhibit);
    await page.evaluate(() => globalThis.GaiaMapObservationAdapter.waitSignalsReady());
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    const card = page.locator("#japan-poi-card");
    const checkFocus = async (state) => {
      await page.waitForFunction(expected => {
        const data = document.querySelector("#gaia-planet-signals-canvas").dataset;
        const actual = globalThis.GaiaMapObservationAdapter.getPoiInteraction();
        const focused = actual.selected || actual.hovered;
        return data.planetPoiFocusState === expected && Number(data.planetFocusedPoiIndex) === (focused?.index ?? -1);
      }, state);
      if (state !== "none") {
        const visual = await page.locator("#gaia-planet-signals-canvas").evaluate(el => ({ ...el.dataset,
          events: getComputedStyle(el).pointerEvents }));
        assert.equal(visual.planetAnchorStyle, "soft-pearl-light");
        assert(Number(visual.planetPoiFocusRadius) > Number(visual.planetAnchorRadius));
        assert.equal(visual.events, "none");
      }
    };
    const activate = async (number) => {
      await page.locator(number === 26 ? "[data-firms-exhibit]" : `[data-planet-exhibit='${[
        "global-wind-pressure", "global-aerosol-light", "usgs-earthquake-ripples", "global-cloud-radiance",
      ][number - 27]}']`).evaluate(el => el.click());
      await page.waitForFunction(n => n === 26
        ? document.querySelector("#gaia-firms-canvas").dataset.firmsPlaybackPhase === "complete"
        : document.querySelector(".gaia-planet-signals-readout").dataset.loading !== "true", number);
      await page.waitForTimeout(180);
      if (mobile) {
        await page.evaluate(() => globalThis.GaiaMapObservationAdapter.focusEarthLocation({ lon: 138, lat: 0, zoom: 1, durationMs: 0 }));
        await page.waitForTimeout(100);
      }
      assert.equal(await card.isVisible(), false, "Switching mode must close the old POI");
    };
    const tap = async (point) => {
      const at = await project(page, point);
      report.lastTap = await page.evaluate(({ at, point }) => ({ at, point,
        element: document.elementFromPoint(at.x, at.y)?.outerHTML.slice(0, 400),
        planet: globalThis.GaiaPlanetSignals.findPoiAt(at.x, at.y, "touch"),
        firms: globalThis.GaiaFirmsExhibit.findPoiAt(at.x, at.y, "touch"),
        map: document.querySelector("#japan-map").getBoundingClientRect().toJSON(),
      }), { at, point });
      if (mobile) await page.touchscreen.tap(at.x, at.y);
      else await page.mouse.click(at.x, at.y);
    };
    const checkCard = async (number, pattern) => {
      try { await card.waitFor({ state: "visible", timeout: 3000 }); }
      catch (error) { await page.screenshot({ path: path.join(output, `${viewport.width}-${number}-failure.png`) }); throw error; }
      const title = await page.locator("#japan-poi-type").textContent();
      const text = await page.locator("#japan-poi-meta").textContent();
      assert.match(title, new RegExp(`^${number} /`));
      assert.match(text, pattern);
      if (number >= 27) {
        assert.match(text, /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} JST/u);
        assert.doesNotMatch(text, / UTC\b/u);
      }
      if ([27, 28, 30].includes(number)) {
        assert.match(text, /[北南]緯\d+\.\d{2}° \/ [東西]経\d+\.\d{2}°/u);
        assert.doesNotMatch(text, /°\s*[NSEW]\b|\bAOD\b/u);
        if (number === 28) assert.match(text, /光学的厚さ 0\.27/u);
      }
      assert.doesNotMatch(text, /CO₂|氷の記録/);
      const geometry = await card.evaluate(el => {
        const r = el.getBoundingClientRect();
        const close = el.querySelector("button").getBoundingClientRect();
        const source = el.querySelector(".japan-poi-source").getBoundingClientRect();
        return { fits: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
          scrollX: el.scrollWidth - el.clientWidth, scrollY: el.scrollHeight - el.clientHeight,
          sourceFits: source.top >= r.top && source.bottom <= r.bottom,
          clickable: el.contains(document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2)) };
      });
      assert(geometry.fits && geometry.clickable, `POI card must stay visible and above canvas: ${JSON.stringify(geometry)}`);
      assert(geometry.scrollX <= 1 && geometry.scrollY <= 1 && geometry.sourceFits,
        `POI contents and source must fit without internal scrolling: ${JSON.stringify(geometry)}`);
      report.checks.push({ width: viewport.width, number, title, text, geometry });
    };
    for (const number of [26, 27, 28, 29, 30]) {
      await activate(number);
      let point;
      if (number === 26) point = firePoints[0];
      else if (number === 29) point = quakePoints[0];
      else {
        // Choose a known model-grid coordinate near the unobscured map centre.
        point = Array.from({ length: 240 }, (_, index) => ({
          lat: Math.asin(-1 + 2 * (index + .5) / 240) * 180 / Math.PI,
          lon: ((index * 137.50776405003785 + 180) % 360) - 180,
        })).find(p => p.lon > 126 && p.lon < 156 && p.lat > -10 && p.lat < 12);
      }
      if (!mobile) {
        const at = await project(page, point);
        await page.mouse.move(at.x, at.y);
        await page.waitForFunction(() => document.querySelector(".japan-poi-preview").getAttribute("aria-hidden") === "false");
        assert.match(await page.locator(".japan-poi-preview-kicker").textContent(), new RegExp(`^${number} /`));
        if ([27, 28, 30].includes(number)) {
          const expected = `${point.lat >= 0 ? "北緯" : "南緯"}${Math.abs(point.lat).toFixed(1)}° ${point.lon >= 0 ? "東経" : "西経"}${Math.abs(point.lon).toFixed(1)}°`;
          assert.equal(await page.locator(".japan-poi-preview-title").textContent(), expected);
          const preview = await page.locator(".japan-poi-preview").evaluate(el => {
            const rect = el.getBoundingClientRect();
            return { overflow: el.scrollWidth - el.clientWidth, fits: rect.left >= 0 && rect.right <= innerWidth + 1 };
          });
          assert(preview.overflow <= 1 && preview.fits, JSON.stringify(preview));
          if (number === 28) assert.match(await page.locator(".japan-poi-preview-meta").textContent(), /光学的厚さ 0\.27/u);
          await checkFocus("hovered");
          await page.locator(".japan-poi-preview").screenshot({ path: path.join(output, `${viewport.width}-${number}-hover.png`) });
        }
      }
      await tap(point);
      await checkCard(number, { 26: /42\.5 MW/, 27: /7\.2 m\/s.*124°.*1,014.*hPa/, 28: /13\.4 µg\/m³.*0\.27/, 29: /TEST EPICENTRE ALPHA.*M5\.3.*12\.0 km/, 30: /36%.*512 W\/m²/ }[number]);
      if ([27, 28, 30].includes(number)) {
        if (!mobile) await page.mouse.move(20, 20);
        await checkFocus("selected");
      }
      await page.screenshot({ path: path.join(output, `${viewport.width}-${number}-poi.png`) });
      await page.locator("#japan-poi-close").click();
      assert.equal(await card.isVisible(), false);
      if ([27, 28, 30].includes(number)) await checkFocus("none");
      if (number === 29) {
        await tap(quakePoints[1]);
        await checkCard(number, /TEST EPICENTRE BETA.*M3\.1.*47\.0 km/);
        assert.match(await page.locator("#japan-poi-source").getAttribute("href"), /eventpage\/poi-quake-b$/);
        await page.keyboard.press("Escape");
        assert.equal(await card.isVisible(), false);
        // Pan starting on a POI must not also open it on release.
        const at = await project(page, point);
        if (mobile) {
          await touchSession.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y }] });
          await touchSession.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: at.x + 60, y: at.y + 25 }] });
          await touchSession.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await page.mouse.move(at.x, at.y);
          await page.mouse.down();
          await page.mouse.move(at.x + 60, at.y + 25, { steps: 6 });
          await page.mouse.up();
        }
        assert.equal(await card.isVisible(), false);
        await page.waitForTimeout(100);
        await tap(point);
        await checkCard(number, /TEST EPICENTRE ALPHA/);
        await page.locator("#japan-poi-close").click();
        // Keep the test POI inside the zoom anchor; the world overview no
        // longer places East Asia in the centre of a desktop viewport.
        await page.evaluate(point => globalThis.GaiaMapObservationAdapter.focusEarthLocation({ ...point, zoom: 1.35, durationMs: 0 }), point);
        await page.waitForTimeout(300);
        await tap(point);
        await checkCard(number, /TEST EPICENTRE ALPHA/);
      }
      if (number !== 29) await tap(point); // Leave card open to check mode-change cleanup.
    }
    await activate(26);
    // Scrub to zero: unrevealed fire observations must not be interactive.
    await page.locator("[data-firms-progress]").evaluate(el => { el.value = "0"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.waitForTimeout(120);
    await tap(firePoints[0]);
    assert.equal(await card.isVisible(), false);
    await activate(29);
    await tap({ lon: 138, lat: 36 }); // Empty map: never show a base-mode POI.
    assert.equal(await card.isVisible(), false);
    await page.locator('.map-mode-bank [data-map-standard-index="0"]').evaluate(el => el.click());
    assert.equal(await card.isVisible(), false);
    assert.equal(await page.evaluate(() => globalThis.GaiaPlanetSignals.getState().active), false);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, output }));
}
