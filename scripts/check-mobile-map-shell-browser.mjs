import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { OBSERVATION_CITIES } from "../src/exploration/observation-cities.js";
const base = process.argv[2] || "http://127.0.0.1:4397";
const widths = (process.argv[3] || "390,320,768,844,1440").split(",").map(Number);
const numbers = process.argv[4] === "all" ? Array.from({ length: 30 }, (_, index) => index + 1)
  : (process.argv[4] || "14,6,8,12,13,1,2,4,15,21").split(",").map(Number);
const output = path.resolve(process.argv[5] || "artifacts/mobile-map-shell");
fs.mkdirSync(output, { recursive: true });
const files = ["map-mobile-shell.js", "map-mobile-shell.css", "gaia-mode-loader.js", "index.html"];
const report = { status: "running", liveData: "Local Chrome with touch emulation and synthetic API fixtures; not physical-device or live-provider QA",
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widths) {
    const height = width === 844 ? 390 : width === 320 ? 568 : width === 768 ? 1024 : width > 900 ? 900 : 844;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      for (const version of [3, 4, 5]) sessionStorage.setItem(`gaia:mode-entry-guide:map:v${version}`, "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
      for (const loader of ["atmosphere", "air"]) sessionStorage.setItem(`gaia-planet-signals-v3:${loader}`, JSON.stringify({ cachedAt: Date.now(), data: {
        observedAt: "2026-09-03T23:37:00Z", points: [{ lat: 35, lon: 139, label: "Tokyo", windSpeed: 7.2, windDirection: 124, pressure: 1014, cloud: 36, radiation: 512, pm25: 13.4, aerosol: .27 }],
      } }));
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/firms", route => route.fulfill({ path: "data/firms-active-fire-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/snapshot?*", route => {
      const city = OBSERVATION_CITIES.find(city => city.id === new URL(route.request().url()).searchParams.get("city")) || OBSERVATION_CITIES[0];
      return route.fulfill({ json: { events: [{ eventId: `qa-${city.id}`, provider: "open-meteo", datasetId: "QA model values", status: "latest-published",
        observedAt: "2026-09-03T23:37:00Z", retrievedAt: "2026-09-03T23:38:00Z", location: { label: `Open-Meteo / ${city.prefecture}・${city.city}`, lat: city.lat, lon: city.lon },
        measurements: [["weatherWindSpeed", 4.8, "m/s"], ["forecastCo2", 423.1, "ppm"], ["weatherPrecipitation", 0, "mm"], ["weatherTemperature", -5, "℃"], ["cloudCover", 40, "%"], ["pm25", 11.2, "µg/m³"]]
          .map(([key, value, unit]) => ({ key, value, unit, sourceKind: "MODEL", quality: "estimated" })),
      }] } });
    });
    await context.route("**/api/live/v1/wind-field", route => route.fulfill({ json: { points: [] } }));
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: { type: "FeatureCollection", metadata: { generated: Date.parse("2026-09-03T23:37:00Z") }, features: [{
      type: "Feature", id: "qa-quake", geometry: { type: "Point", coordinates: [139, 35, 10] },
      properties: { mag: 5.1, time: Date.parse("2026-09-03T23:37:00Z"), place: "Japan", url: "https://earthquake.usgs.gov/" },
    }] } }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, error: error.message }));
    await page.goto(`${base}/?mode=8&live=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMobileMap && globalThis.GaiaMapCategories?.buttons().length === 30);
    await page.evaluate(async () => { GaiaMapDemo.stop(); await GaiaMapObservationAdapter.waitSignalsReady(); await document.fonts.ready; });
    if (width > 900) {
      assert.equal(await page.locator("#map-mobile-toolbar").isVisible(), false);
      assert.equal(await page.locator("#japan-layer").evaluate(e => e.classList.contains("is-mobile-map-shell")), false);
      await page.screenshot({ path: path.join(output, `${width}-desktop.png`) });
      report.checks.push({ width, desktopUnchanged: true });
      await context.close();
      continue;
    }
    // Regression for the reported text-only mobile panels: all catalog cards
    // now have distinct themed artwork without changing the provider controls.
    await page.locator('[data-mobile-sheet="exhibits"]').click();
    const collection = await page.locator("#map-mobile-sheet").evaluate(sheet => ({
      count: sheet.querySelectorAll("[data-mobile-exhibit]").length,
      art: sheet.querySelectorAll("[data-mobile-exhibit] .map-mobile-card-art svg[aria-hidden=true]").length,
      themes: new Set([...sheet.querySelectorAll("[data-mobile-exhibit]")].map(e => e.style.getPropertyValue("--card-accent"))).size,
      selected: sheet.querySelectorAll('[data-mobile-exhibit][aria-current="true"]').length,
      columns: getComputedStyle(sheet.querySelector(".map-mobile-category")).gridTemplateColumns.split(" ").length,
      overflow: sheet.querySelector(".map-mobile-sheet-body").scrollWidth - sheet.querySelector(".map-mobile-sheet-body").clientWidth,
      background: getComputedStyle(sheet).backgroundImage, opacity: getComputedStyle(sheet).opacity,
      animation: getComputedStyle(sheet).animationName,
    }));
    assert.equal(collection.count, 30); assert.equal(collection.art, 30);
    assert(collection.themes >= 8); assert.equal(collection.selected, 1);
    assert.equal(collection.columns, width >= 600 ? 3 : 2);
    assert.equal(collection.overflow, 0); assert.equal(collection.opacity, "1");
    assert(collection.background.includes("0.8")); assert.equal(collection.animation, "none");
    assert.equal(await page.locator("#map-mobile-toolbar > button > svg").count(), 5);
    await page.screenshot({ path: path.join(output, `${width}-collection.png`) });
    await page.locator(".map-mobile-category-nav").getByRole("button", { name: "大地の活動", exact: true }).click();
    assert(await page.locator('[data-mobile-exhibit="11"]').isVisible());
    assert.equal(await page.locator(".map-mobile-category h3").last().evaluate(e => e === document.activeElement), true);
    const categoryBox = await page.locator('[data-mobile-exhibit="11"]').boundingBox();
    assert(categoryBox.y >= 0 && categoryBox.y < height);
    await page.screenshot({ path: path.join(output, `${width}-collection-last.png`) });
    await page.keyboard.press("Escape");
    await page.locator('[data-mobile-sheet="tools"]').click();
    assert(await page.locator(".map-mobile-action-card > svg").count() >= 4);
    await page.screenshot({ path: path.join(output, `${width}-tools.png`) });
    await page.keyboard.press("Escape");
    report.checks.push({ width, collection });
    for (const number of numbers) {
      await page.locator('[data-mobile-sheet="exhibits"]').click();
      assert.equal(await page.locator("#map-mobile-sheet [data-mobile-exhibit]").count(), 30);
      await page.locator(`[data-mobile-exhibit="${number}"]`).click();
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      await page.waitForTimeout(650);
      const scan = await page.evaluate(() => {
        const visible = e => e.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true });
        return { title: document.querySelector("#japan-title").textContent,
          overflow: document.documentElement.scrollWidth - innerWidth,
          shell: document.querySelector("#japan-layer").className,
          metric: document.querySelector("#japan-overlay").dataset.auxiliaryPanelId,
          panels: [...document.querySelectorAll(".signal-console-map, .gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout, .map-mobile-ecology-summary, #map-mobile-toolbar, .japan-heading")].filter(visible).map(e => ({ name: e.className || e.id, text: e.innerText, ...e.getBoundingClientRect().toJSON() })),
          targets: [...document.querySelectorAll("#map-mobile-toolbar button, #japan-layer input[type=range]")].filter(visible).map(e => ({ name: e.getAttribute("aria-label") || e.textContent, ...e.getBoundingClientRect().toJSON() })) };
      });
      report.checks.push({ width, height, number, ...scan });
      assert.equal(scan.overflow, 0);
      assert.equal(scan.panels.length, 3, `${width}/${number}: one heading, observation and toolbar`);
      for (const box of scan.panels) {
        assert(box.x >= -1 && box.right <= width + 1 && box.y >= 0 && box.bottom <= height + 1, `${width}/${number}: ${box.name} outside viewport`);
      }
      const observation = scan.panels.find(p => /console|readout|ecology-summary/.test(p.name));
      const back = await page.locator("#japan-close").boundingBox();
      const title = scan.panels.find(p => p.name.includes("japan-heading"));
      const backOverlap = Math.max(0, Math.min(back.x + back.width, title.right) - Math.max(back.x, title.x))
        * Math.max(0, Math.min(back.y + back.height, title.bottom) - Math.max(back.y, title.y));
      assert(backOverlap <= 1, `${width}/${number}: Back overlaps exhibit title`);
      // Short phones need room for truthful timestamps and 44px timeline controls.
      // Keep >= 2/3 of their map area free rather than clipping the metric values.
      const areaBudget = height < 650 ? 1 / 3 : .25;
      assert(observation.height * observation.width < height * width * areaBudget, `${width}/${number}: observation takes too much map space`);
      for (const box of scan.targets) assert(box.height >= 44 && box.width >= 44, `${width}/${number}: small touch target ${box.name}`);
      await page.screenshot({ path: path.join(output, `${width}-${number}.png`) });
      await page.locator('[data-mobile-sheet="reading"]').click();
      assert(await page.locator(".map-mobile-sheet-body").innerText());
      assert.equal(await page.locator("#map-mobile-sheet [id]").count(), 1, "copied content must not duplicate IDs");
      await page.screenshot({ path: path.join(output, `${width}-${number}-reading.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator('[data-mobile-sheet="reading"]').evaluate(e => e === document.activeElement), true);
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.locator("[data-mobile-sheet-close]").click();
      console.log(`PASS ${width}/${number}: compact observation and three accessible menus`);
    }
    // Exercise real entry points, not just element visibility.
    const select = async number => {
      await page.locator('[data-mobile-sheet="exhibits"]').click();
      await page.locator(`[data-mobile-exhibit="${number}"]`).click();
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    };
    await select(6);
    const slider = page.locator(".signal-console-map [data-signal-time]");
    await slider.fill("50"); await slider.dispatchEvent("input");
    const year = await page.locator("#co2-timeline-year").textContent();
    await slider.press("ArrowRight");
    assert.equal(Number(await slider.inputValue()), 51);
    await slider.press("ArrowRight");
    assert.notEqual(await page.locator("#co2-timeline-year").textContent(), year);
    for (const [label, panel, closeButton] of [["データの出典", "#japan-data-panel", "#japan-data-close"], ["統計分析", "#gaia-statistics-lab", "#gaia-statistics-close"]]) {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.locator("#map-mobile-sheet").getByRole("button", { name: label, exact: true }).click();
      await page.locator(panel).waitFor({ state: "visible" });
      await page.locator(closeButton).click();
      assert(await page.locator("#map-mobile-toolbar").isVisible());
    }
    await page.locator('[data-mobile-sheet="tools"]').click();
    await page.locator("#map-mobile-sheet").getByRole("button", { name: "地図ガイド", exact: true }).click();
    await page.locator("#gaia-mode-entry-guide").waitFor({ state: "visible" });
    await page.locator("[data-feature-guide]").click();
    await page.waitForFunction(() => document.querySelector('[data-mobile-sheet="exhibits"]').classList.contains("is-gaia-mode-guide-target"));
    await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    await page.locator('[data-mobile-sheet="tools"]').click();
    await page.locator("#map-mobile-sheet").getByRole("button", { name: "全展示のデモ再生", exact: true }).click();
    assert.equal(await page.evaluate(() => GaiaMapDemo.getState().active), true);
    await page.locator('[data-mobile-sheet="reading"]').click();
    assert.equal(await page.evaluate(() => GaiaMapDemo.getState().active), false);
    // Native dialog traps focus, including reverse Tab, and blocks map shortcuts.
    await page.keyboard.press("Shift+Tab");
    assert(await page.locator("#map-mobile-sheet").evaluate(e => e.contains(document.activeElement)));
    await page.keyboard.press("j");
    assert(await page.locator("#map-mobile-sheet").evaluate(e => e.open));
    await page.keyboard.press("Escape");
    await select(12);
    await page.locator(".map-mobile-ecology-summary button").click();
    await page.locator("#map-mobile-sheet .eco-country").selectOption("BRA");
    await page.locator('#map-mobile-sheet [data-eco-view="pattern"]').click();
    assert(await page.locator("#map-mobile-sheet .eco-chart svg").isVisible());
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#japan-layer > .ecologies-exhibit").count(), 1);
    // A breakpoint change must close the mobile modal and restore desktop UI.
    await page.locator('[data-mobile-sheet="reading"]').click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => !document.querySelector("#map-mobile-sheet").open);
    assert.equal(await page.locator("#map-mobile-sheet").evaluate(e => e.open), false);
    assert.equal(await page.locator("#map-mobile-toolbar").isVisible(), false);
    await page.setViewportSize({ width, height });
    await select(6);
    // Story detour owns its layout; do not apply the free-map shell there.
    await page.evaluate(() => document.querySelector("#japan-layer").dataset.storyMode = "map01");
    assert.equal(await page.locator("#map-mobile-toolbar").isVisible(), false);
    await page.evaluate(() => delete document.querySelector("#japan-layer").dataset.storyMode);
    assert.equal(await page.locator("#map-mobile-toolbar").isVisible(), true);
    report.checks.push({ width, interactions: "slider, source, statistics, guide, demo, focus trap, ecology, resize, story exclusion" });
    console.log(`PASS ${width}: real controls, modal lifecycle and desktop/story isolation`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
