import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/planet-chapter-numbers");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const titles = ["大気をなぞる", "大気の散乱", "地殻の波紋", "雲を透る光"];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 3840, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width < 400 ? 844 : 900 }, reducedMotion: "reduce", hasTouch: width < 400 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const source of ["https://api.open-meteo.com/**", "https://air-quality-api.open-meteo.com/**"]) {
      await context.route(source, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        return route.fulfill({ json: Array.from({ length: count }, () => ({ current: {
          time: "2026-09-06T00:00", wind_speed_10m: 5, wind_direction_10m: 90,
          surface_pressure: 1012, cloud_cover: 35, shortwave_radiation: 120,
          pm2_5: 8, aerosol_optical_depth: .1,
        } })) });
      });
    }
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      type: "FeatureCollection", metadata: { generated: Date.now(), count: 1 },
      features: [{ type: "Feature", id: "chapter-number-test", geometry: { type: "Point", coordinates: [139, 35, 12] }, properties: { mag: 2.8, place: "TEST", time: Date.now() } }],
    } }));
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=chapter-numbers#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaPlanetSignals && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    for (const state of width === 390 ? ["live", "fallback"] : ["live"]) {
      if (state === "fallback") {
        await page.evaluate(() => sessionStorage.clear());
        for (const source of ["https://api.open-meteo.com/**", "https://air-quality-api.open-meteo.com/**", "https://earthquake.usgs.gov/**"]) {
          await context.route(source, route => route.fulfill({ status: 503, body: "Unavailable for fallback test" }));
        }
      }
      for (let index = 0; index < 4; index++) {
        const number = String(27 + index);
        const immediate = await page.evaluate(index => {
          const button = index === 0
            ? [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => button.textContent.trim() === "27")
            : document.querySelector('[data-planet-step="1"]');
          button.click();
          return { loading: document.querySelector(".gaia-planet-signals-readout").dataset.loading,
            number: document.querySelector("[data-planet-number]").textContent,
            title: document.querySelector("[data-planet-title]").textContent };
        }, index);
        assert.deepEqual(immediate, { loading: "true", number, title: titles[index] }, `${width}/${state}: heading must update before fetching`);
        await page.waitForFunction(() => !document.querySelector(".gaia-planet-signals-readout").dataset.loading
          && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
        const scan = await page.locator(".gaia-planet-chapter").evaluate(chapter => {
          const number = chapter.querySelector("[data-planet-number]"), title = chapter.querySelector("[data-planet-title]");
          const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
          const bounds = rect(number), range = document.createRange(); range.selectNodeContents(number);
          return { number: number.textContent, title: title.textContent, chapter: rect(chapter), wrapper: rect(number.parentElement), bounds, text: rect(range), titleBounds: rect(title),
            visible: number.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
            hit: document.elementFromPoint((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2) === number,
            source: document.querySelector("[data-planet-state]").textContent };
        });
        assert.equal(scan.number, number); assert.equal(scan.title, titles[index]);
        assert(scan.visible && scan.hit, `${width}/${number}: number is obscured`);
        assert(scan.bounds.left >= scan.chapter.left && scan.bounds.right <= scan.wrapper.right);
        assert(scan.text.width <= scan.bounds.width + 1, "Number text is clipped");
        assert(scan.titleBounds.left >= scan.bounds.right && scan.titleBounds.width > 0);
        assert(scan.chapter.left >= 0 && scan.chapter.right <= width + 1);
        assert.match(scan.source, state === "fallback" ? /^SAVED VALUES$/u : /^LIVE/u);
        report.checks.push({ width, state, number, immediate, scan });
        if (state === "live" && index === 0) {
          await page.screenshot({ path: path.join(output, `${width}-27.jpg`), type: "jpeg", quality: 88 });
          await page.locator(".gaia-planet-chapter").screenshot({ path: path.join(output, `${width}-chapter.png`) });
        }
      }
      await page.locator('[data-planet-step="-1"]').focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-planet-number]").textContent === "29"
        && document.querySelector("[data-planet-title]").textContent === "地殻の波紋");
    }
    console.log(`PASS ${width}: chapter numbers 27–30, immediate/loaded state, visible digits, next/previous navigation`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
