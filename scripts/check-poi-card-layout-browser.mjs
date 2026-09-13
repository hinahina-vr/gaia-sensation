import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/poi-compact-card/edges");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const [width, height, saved] of [[320, 568, false], [844, 390, false], [1280, 720, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("https://api.open-meteo.com/**", route => saved ? route.abort() : route.fulfill({ json:
      new URL(route.request().url()).searchParams.get("latitude").split(",").map(() => ({ current: {
        time: "2026-09-05T05:30", wind_speed_10m: 9.3, wind_direction_10m: 89,
        surface_pressure: 1001.8, cloud_cover: 90, shortwave_radiation: 512,
      } })),
    }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=poi-compact-card#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && !!globalThis.GaiaPlanetSignals);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
      document.querySelector('[data-planet-exhibit="global-wind-pressure"]').click();
    });
    await page.waitForFunction(() => document.querySelector(".gaia-planet-signals-readout").dataset.loading !== "true");
    await page.evaluate(() => globalThis.GaiaMapObservationAdapter.focusEarthLocation({ lon: 138, lat: 0, zoom: 1, durationMs: 0 }));
    await page.waitForTimeout(250);
    const point = await page.evaluate(() => {
      for (let y = 160; y < innerHeight - 100; y += 12) {
        for (let x = 35; x < innerWidth - 60; x += 12) {
          const el = document.elementFromPoint(x, y);
          if (!(el?.tagName === "CANVAS" || el?.id === "japan-map")) continue;
          if (globalThis.GaiaPlanetSignals.findPoiAt(x, y, innerWidth < 900 ? "touch" : "mouse")) return { x, y };
        }
      }
    });
    assert(point, "A visible observation must be tappable");
    if (width < 900) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    const card = page.locator("#japan-poi-card");
    await card.waitFor({ state: "visible" });
    await page.waitForTimeout(100);
    const scan = await card.evaluate(el => {
      const r = el.getBoundingClientRect();
      const source = el.querySelector(".japan-poi-source").getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, rect: r.toJSON(),
        overflowX: el.scrollWidth - el.clientWidth, overflowY: el.scrollHeight - el.clientHeight,
        sourceFits: source.top >= r.top && source.bottom <= r.bottom,
        sourceClickable: el.querySelector(".japan-poi-source").contains(document.elementFromPoint(source.x + source.width / 2, source.y + source.height / 2)),
        values: [...el.querySelectorAll(".japan-poi-metrics strong")].map(v => v.textContent),
        text: el.textContent,
      };
    });
    await page.screenshot({ path: path.join(output, `${width}-${saved ? "saved" : "wind"}.png`) });
    assert(scan.overflowX <= 1 && scan.overflowY <= 1 && scan.sourceFits && scan.sourceClickable, JSON.stringify(scan));
    assert(scan.rect.top >= 0 && scan.rect.bottom <= height && scan.rect.left >= 0 && scan.rect.right <= width);
    assert.equal(scan.values.length, 4);
    if (!saved) assert.deepEqual(scan.values, ["9.3 m/s", "89°", "1,001.8 hPa", "90%"]);
    else assert.match(scan.text, /演出用サンプル値（ライブ観測ではありません）/);
    assert.match(scan.text, /JST/);
    await page.locator("#japan-poi-source").focus();
    assert.equal(await card.evaluate(el => el.scrollTop), 0, "Keyboard access must not need scrolling");
    await page.locator("#japan-poi-close").click();
    assert.equal(await card.isVisible(), false);
    report.checks.push({ ...scan, saved });
    console.log(`PASS ${width} × ${height}: all four metrics and source fit without scrolling`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
