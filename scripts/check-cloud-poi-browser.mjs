import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", outputArgument = "artifacts/cloud-poi"] = process.argv.slice(2);
const output = path.resolve(outputArgument);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", scans: [], errors: [] };
const live = process.argv.includes("--live");
const missingImage = process.argv.includes("--missing-image");
const ovation = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const [width, overcast] of live || missingImage ? [[1440, false]] : [[1440, false], [3840, false], [390, true]]) {
    const mobile = width < 720;
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : mobile ? 844 : 900 },
      hasTouch: mobile, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: ovation }));
    if (missingImage) await context.route("**/nasa-blue-marble-clouds-2048.jpg", route => route.abort());
    if (!live) await context.route("https://api.open-meteo.com/**", route => {
      const params = new URL(route.request().url()).searchParams;
      const latitudes = params.get("latitude").split(",").map(Number);
      const longitudes = params.get("longitude").split(",").map(Number);
      return route.fulfill({ json: latitudes.map((lat, i) => ({ current: {
        time: "2026-09-05T05:30", wind_speed_10m: 6, wind_direction_10m: 240, surface_pressure: 1014,
        cloud_cover: overcast ? 100 : Math.round(Math.max(0, Math.min(100,
          52 + 34 * Math.sin(lat * .055) + 22 * Math.cos(longitudes[i] * .047)))),
        shortwave_radiation: 512,
      } })) });
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=cloud-poi#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !!globalThis.GaiaPlanetSignals);
    await page.waitForFunction(() => document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
      document.querySelector('.map-mode-button[data-planet-exhibit="global-cloud-radiance"]').click();
    });
    await page.waitForFunction(() => document.querySelector(".gaia-planet-signals-readout").dataset.loading !== "true");
    if (mobile) await page.evaluate(() => globalThis.GaiaMapObservationAdapter.focusEarthLocation({ lon: 138, lat: 0, zoom: 1, durationMs: 0 }));
    await page.waitForFunction(missing => document.querySelector("#gaia-planet-atmosphere-canvas").dataset.fieldState === "ready"
      && document.querySelector("#gaia-planet-atmosphere-canvas").dataset.cloudTextureState === (missing ? "unavailable" : "ready")
      && Number(document.querySelector("#gaia-planet-signals-canvas").dataset.planetAnchorCount) > 0, missingImage);
    await page.waitForTimeout(950);
    const scan = await page.evaluate(() => {
      const canvas = document.querySelector("#gaia-planet-signals-canvas");
      const clouds = document.querySelector("#gaia-planet-atmosphere-canvas");
      const map = document.querySelector("#japan-map").getBoundingClientRect();
      const data = document.querySelector("#japan-overlay").dataset;
      const scale = (map.width >= 901 ? map.width / 360 : Math.max(map.width / 360, map.height / 180)) * (Number(data.earthZoom) || 1);
      const points = Array.from({ length: 240 }, (_, index) => ({
        lat: Math.asin(-1 + 2 * (index + .5) / 240) * 180 / Math.PI,
        lon: ((index * 137.50776405003785 + 180) % 360) - 180,
      }));
      const point = points.map(p => ({ ...p,
        x: (map.width - 360 * scale) / 2 + (Number(data.earthOffsetX) || 0) + ((p.lon - Number(data.earthCenterLongitude) + 540) % 360) * scale,
        y: (map.height - 180 * scale) / 2 + (Number(data.earthOffsetY) || 0) + (90 - p.lat) * scale,
      })).find(p => p.x > map.width * .3 && p.x < map.width * .7 && p.y > map.height * .4 && p.y < map.height * .6);
      const ratio = canvas.width / map.width;
      const r = Number(canvas.dataset.planetAnchorRadius);
      const bounds = Number(canvas.dataset.planetAnchorOuterRadius) + 2;
      const pixels = canvas.getContext("2d").getImageData(Math.floor((point.x - bounds) * ratio),
        Math.floor((point.y - bounds) * ratio), Math.ceil(bounds * 2 * ratio), Math.ceil(bounds * 2 * ratio)).data;
      let dark = 0, light = 0, soft = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const brightness = pixels[i] + pixels[i + 1] + pixels[i + 2];
        if (pixels[i + 3] > 190 && brightness < 160) dark++;
        if (pixels[i + 3] > 50 && brightness > 580) light++;
        if (pixels[i + 3] > 2 && pixels[i + 3] < 100) soft++;
      }
      return { width: innerWidth, point: { ...point, x: point.x + map.left, y: point.y + map.top },
        count: Number(canvas.dataset.planetAnchorCount), radius: r, dark, light, soft, anchorStyle: canvas.dataset.planetAnchorStyle,
        blend: getComputedStyle(canvas).mixBlendMode, opacity: getComputedStyle(canvas).opacity,
        cloudStyle: clouds.dataset.cloudStyle, cloudPixels: clouds.width * clouds.height, source: canvas.dataset.planetSourceState,
        aboveClouds: Number(getComputedStyle(canvas).zIndex) > Number(getComputedStyle(clouds).zIndex) };
    });
    assert.equal(scan.blend, "normal");
    assert.equal(scan.opacity, "1");
    assert.equal(scan.anchorStyle, "soft-pearl-light");
    assert(scan.aboveClouds && scan.dark === 0 && scan.light >= 3 && scan.soft > scan.light,
      `POIs need pearl cores and soft falloff, without dark target rings: ${JSON.stringify(scan)}`);
    assert(scan.cloudPixels <= (mobile ? 301000 : 762000), "Keep the existing GPU pixel budget");
    assert.equal(scan.cloudStyle, "satellite-reference-clouds");
    const credit = page.locator("[data-cloud-image-credit]");
    assert.equal(await credit.isVisible(), true);
    assert.match(await credit.textContent(), missingImage ? /参考画像を読み込めません.*地点の数値は確認できます/ : /NASA Blue Marble.*2002年公開.*現在の雲分布ではありません/);
    assert.match(await page.locator("[data-planet-caption]").textContent(), /現在の衛星画像ではありません/);
    assert.equal(await page.locator("[data-planet-time-label]").textContent(), "数値の時刻");
    assert.match(await page.locator("[data-planet-data-time]").textContent(), /JST/);
    await page.screenshot({ path: path.join(output, `${width}-clouds.jpg`), type: "jpeg", quality: 85 });
    if (mobile) await page.touchscreen.tap(scan.point.x, scan.point.y);
    else await page.mouse.click(scan.point.x, scan.point.y);
    await page.locator("#japan-poi-card").waitFor({ state: "visible" });
    const meta = await page.locator("#japan-poi-meta").textContent();
    assert.match(meta, live ? /雲量 .*%.*短波放射 .* W\/m²/ : /雲量 .*%.*短波放射 512 W\/m²/);
    if (overcast) assert.match(meta, /雲量 100%/);
    assert.match(meta, /Open-Meteo/);
    assert.doesNotMatch(meta, /NASA/);
    await page.screenshot({ path: path.join(output, `${width}-poi.jpg`), type: "jpeg", quality: 85 });
    await page.locator("#japan-poi-close").click();
    assert.equal(await page.locator("#japan-poi-card").isVisible(), false);
    report.scans.push({ ...scan, overcast, meta });
    console.log(`PASS ${width}: soft light markers without dark rings, cloud budget, click/tap and source values`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.message; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
