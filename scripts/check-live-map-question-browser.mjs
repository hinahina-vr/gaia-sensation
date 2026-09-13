import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-map-question");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const exhibits = [
  ["wind-field", "風の強さは、場所によってどう違う？"],
  ["carbon-pulse", "CO₂濃度の予測値は、場所でどう違う？"],
  ["rain-chorus", "雨の量は、場所によってどう違う？"],
  ["temperature-field", "気温は、場所によってどう違う？"],
  ["cloud-drift", "雲の多さは、場所によってどう違う？"],
  ["pm25-haze", "PM2.5の予測値は、場所でどう違う？"],
];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of process.argv.includes("--mobile-only") ? [390, 320] : [3840, 1920, 1440, 1100, 768, 390, 320]) {
    const height = width === 3840 ? 2088 : width <= 900 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
    });
    await context.route("**/api/live/v1/snapshot?*", route => route.fulfill({ json: { events: [{
      eventId: "qa-weather", provider: "open-meteo", datasetId: "QA weather", status: "latest-published",
      observedAt: "2026-09-06T00:00:00Z", retrievedAt: "2026-09-06T00:01:00Z",
      location: { label: "Open-Meteo / 北海道・札幌", lat: 43.0618, lon: 141.3545 },
      provenance: { sourceUrl: "https://open-meteo.com/", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" },
      measurements: [["weatherWindSpeed", 4.8, "m/s"], ["forecastCo2", 423.1, "ppm"], ["weatherPrecipitation", 0, "mm"],
        ["weatherTemperature", 23, "℃"], ["cloudCover", 40, "%"], ["pm25", 11.2, "µg/m³"]]
        .map(([key, value, unit]) => ({ key, value, unit, sourceKind: "MODEL", quality: "estimated" })),
    }] } }));
    await context.route("**/api/live/v1/wind-field", route => route.fulfill({ json: { points: [] } }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?live=1&preview=live-map-question#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && Boolean(globalThis.GaiaLiveExhibits));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.querySelector('[data-map-standard-index="8"]').click());
    const reference = await page.locator("#map-guide-title").evaluate(node => ({ font: getComputedStyle(node).font, color: getComputedStyle(node).color }));
    const modes = [];
    for (const [id, question] of exhibits) {
      await page.evaluate(id => {
        document.querySelector(`[data-live-exhibit="${id}"]`).click();
        GaiaLiveExhibits.pausePoiAutoplay();
      }, id);
      await page.waitForFunction(id => document.querySelector(".gaia-live-exhibit-readout").dataset.exhibit === id
        && GaiaLiveData.getState().requestState === "ready"
        && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), id);
      assert.equal(await page.locator(".gaia-live-deck-question").count(), 1, "Duplicate live controller");
      assert.equal(await page.locator("[data-live-deck-question]").textContent(), question);
      assert.equal(await page.locator("#gaia-live-deck-question-label").textContent(), "この地図で確かめること");
      assert.equal(await page.locator(".gaia-live-deck-wave, [data-live-wave-bar]").count(), 0);
      assert(await page.locator(".gaia-live-deck-question").isVisible());
      assert(await page.locator("[data-live-exhibit-feed-state]").isVisible());
      assert(await page.locator("[data-live-exhibit-feed-time]").isVisible());
      assert.match(await page.locator("[data-live-exhibit-feed-time]").textContent(), /2026\/09\/06 09:00:00 JST/);
      assert.equal(await page.locator(".gaia-live-deck-question [data-live-exhibit-feed-state]").count(), 0);
      const geometry = await page.evaluate(() => {
        const root = document.querySelector(".gaia-live-exhibit-readout");
        const question = root.querySelector(".gaia-live-deck-question");
        const r = question.getBoundingClientRect();
        const measure = node => {
          const range = document.createRange(); range.selectNodeContents(node);
          const t = range.getBoundingClientRect();
          return { fits: t.x >= r.x - 1 && t.right <= r.right + 1 && t.y >= r.y - 1 && t.bottom <= r.bottom + 1,
            font: getComputedStyle(node).font, color: getComputedStyle(node).color };
        };
        const label = measure(question.querySelector("span"));
        const title = measure(question.querySelector("strong"));
        const actions = root.querySelector(".gaia-map-actions").getBoundingClientRect();
        const bounds = root.getBoundingClientRect();
        const freshness = document.querySelector(".gaia-live-data-freshness");
        const freshBox = freshness.getBoundingClientRect();
        return { label, title, x: r.x, y: r.y, width: r.width, height: r.height,
          onScreen: r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight,
          hit: question.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
          // Off-screen, hidden chapter-menu descendants participate in scrollWidth.
          // Check the visible replacement and its actual dock bounds instead.
          rootFits: r.x >= bounds.x - 1 && r.right <= bounds.right + 1
            && r.y >= bounds.y - 1 && r.bottom <= bounds.bottom + 1,
          actionsFit: actions.bottom <= bounds.bottom + 1,
          freshnessFits: freshness.scrollWidth <= freshness.clientWidth + 1 && freshBox.right <= innerWidth
            && freshBox.bottom < r.y,
        };
      });
      assert(geometry.label.fits && geometry.title.fits && geometry.onScreen && geometry.hit
        && geometry.rootFits && geometry.actionsFit && geometry.freshnessFits, `${width} ${id}: ${JSON.stringify(geometry)}`);
      if (width > 900) {
        assert.equal(geometry.title.font, reference.font, `${width}: question font differs from reference`);
        assert.equal(geometry.title.color, reference.color);
      }
      if (id === "rain-chorus") assert.equal(await page.locator("[data-live-exhibit-value]").textContent(), "0 mm");
      await page.screenshot({ path: path.join(output, `${width}-${id}.jpg`), type: "jpeg", quality: 88 });
      if (id === "wind-field") await page.locator(".gaia-live-deck-question").screenshot({ path: path.join(output, `${width}-question.png`) });
      modes.push({ id, question, ...geometry });
    }
    await page.evaluate(() => document.querySelector('[data-map-standard-index="8"]').click());
    assert.equal(await page.locator(".gaia-live-deck-question").isVisible(), false);
    assert.equal(await page.locator(".gaia-live-data-freshness").isVisible(), false);
    assert.equal(await page.locator("#map-guide-title").textContent(), "人口の重心は、1960年からどこへ動いたのか？");
    report.checks.push({ width, modes });
    console.log(`PASS ${width}px: six questions, reference typography, no wave, state/time, zero value, clean exit`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
