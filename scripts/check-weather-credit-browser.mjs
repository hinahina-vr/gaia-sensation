import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/weather-credit");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [3840, 1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width > 900 ? 900 : 844 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
    });
    await context.route("**/api/live/v1/snapshot?*", route => {
      const city = new URL(route.request().url()).searchParams.get("city");
      if (city === "naha") return route.fulfill({ json: { events: [] } });
      const aomori = city === "aomori";
      const weatherEvent = {
        eventId: aomori ? "qa-aomori" : "qa-sapporo", provider: "open-meteo", datasetId: "QA weather", status: "latest-published",
        observedAt: "2026-09-06T00:00:00Z", retrievedAt: "2026-09-06T00:01:00Z",
        location: aomori ? { label: "Open-Meteo / 青森県・青森", lat: 40.8244, lon: 140.74 }
          : { label: "Open-Meteo / 北海道・札幌", lat: 43.0618, lon: 141.3545 },
        provenance: { sourceUrl: "https://open-meteo.com/en/docs", licenseUrl: "https://open-meteo.com/en/pricing" },
        measurements: [["weatherWindSpeed", 4.8, "m/s"], ["weatherPrecipitation", .5, "mm"], ["weatherTemperature", 23, "℃"], ["cloudCover", 40, "%"]]
          .map(([key, value, unit]) => ({ key, value, unit, quality: "estimated", sourceKind: "MODEL" })),
      };
      const airEvent = {
        ...weatherEvent, eventId: `${weatherEvent.eventId}-cams`, datasetId: "QA CAMS global forecast",
        location: { ...weatherEvent.location, label: `${weatherEvent.location.label.replace("Open-Meteo", "CAMSモデル")}格子` },
        provenance: { sourceUrl: "https://open-meteo.com/en/docs/air-quality-api" },
        measurements: [["forecastCo2", 423.1, "ppm"], ["pm25", 11.2, "µg/m³"]]
          .map(([key, value, unit]) => ({ key, value, unit, quality: "estimated", sourceKind: "MODEL" })),
      };
      return route.fulfill({ json: { events: [weatherEvent, airEvent] } });
    });
    await context.route("**/api/live/v1/wind-field", route => route.fulfill({ json: { source: "qa", points: [] } }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?live=1&preview=weather-credit#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && Boolean(globalThis.GaiaLiveExhibits));
    await page.evaluate(() => {
      document.querySelector('[data-live-exhibit="wind-field"]').click();
      GaiaLiveExhibits.selectObservationPoint("aomori");
      GaiaLiveExhibits.pausePoiAutoplay();
    });
    await page.waitForFunction(() => GaiaLiveData.getState().city === "aomori" && GaiaLiveData.getState().requestState === "ready");
    for (const mode of ["wind-field", "rain-chorus", "temperature-field", "cloud-drift", "carbon-pulse", "pm25-haze"]) {
      await page.evaluate(mode => document.querySelector(`[data-live-exhibit="${mode}"]`).click(), mode);
      await page.waitForFunction(() => document.querySelector("[data-live-anchor-label]").textContent === "青森県・青森");
      assert.equal(await page.locator("[data-live-deck-location]").textContent(), "青森県（青森市）");
      assert.equal(await page.locator("[data-live-city-caption]").count(), 0);
      assert.match(await page.evaluate(() => GaiaLiveData.getState().measurements.weatherWindSpeed.location.label), /^Open-Meteo/);
      const air = ["carbon-pulse", "pm25-haze"].includes(mode);
      assert.equal(await page.locator("[data-live-cams-credit]").isVisible(), air);
      if (air) {
        await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
        assert.match(await page.evaluate(() => GaiaLiveData.getState().measurements.forecastCo2.location.label), /^CAMSモデル.*格子$/);
        assert.equal(await page.locator("[data-live-anchor-source]").textContent(), "MODEL GRID");
        const geometry = await page.locator("[data-live-cams-credit]").evaluate(node => {
          const r = node.getBoundingClientRect();
          const credit = node.closest(".gaia-live-data-credit");
          return { x: r.x, right: r.right, hit: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), overflow: credit.scrollWidth > credit.clientWidth + 1 };
        });
        assert(geometry.x >= 0 && geometry.right <= width && geometry.hit && !geometry.overflow, JSON.stringify(geometry));
        await page.screenshot({ path: path.join(output, `${width}-${mode}.jpg`), type: "jpeg", quality: 90 });
        await page.locator("[data-live-deck-source]").click();
        await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
        assert.match(await page.locator("#data-ledger-sources").innerText(), /Copernicus Atmosphere Monitoring Service.*モデル予測.*Open-Meteo.*加工して表示.*実測地点の観測値ではありません/is);
        await page.keyboard.press("Escape");
      }
    }
    await page.evaluate(() => document.querySelector('[data-live-exhibit="wind-field"]').click());
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const credit = page.locator(".gaia-live-data-credit");
    assert(await credit.isVisible());
    const links = await credit.locator("a:visible").evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { href: node.href, x: r.x, y: r.y, right: r.right, bottom: r.bottom, hit: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), fontSize: parseFloat(getComputedStyle(node).fontSize) };
    }));
    assert.equal(links[0].href, "https://open-meteo.com/");
    assert.equal(links[1].href, "https://creativecommons.org/licenses/by/4.0/");
    for (const link of links) assert(link.x >= 0 && link.right <= width && link.y >= 0 && link.hit && link.fontSize >= 10, JSON.stringify(link));
    assert.equal(await credit.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.screenshot({ path: path.join(output, `${width}-wind.jpg`), type: "jpeg", quality: 90 });
    await page.locator("[data-live-deck-source]").click();
    await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
    assert.match(await page.locator("#data-ledger-sources").innerText(), /Open-Meteo.*加工して表示/is);
    assert.equal(await page.locator('#data-ledger-sources a[href="https://creativecommons.org/licenses/by/4.0/"]').count(), 1);
    await page.keyboard.press("Escape");
    await page.evaluate(() => GaiaLiveExhibits.selectObservationPoint("naha"));
    await page.waitForFunction(() => GaiaLiveData.getState().city === "naha" && GaiaLiveData.getState().requestState === "unavailable");
    assert.equal(await page.locator("[data-live-deck-location]").textContent(), "沖縄県（那覇市）");
    assert.equal(await page.locator("[data-live-exhibit-value]").textContent(), "—");
    assert(await credit.isVisible(), "Attribution vanished when the selected city had no data");
    for (const mode of ["carbon-pulse", "pm25-haze"]) {
      await page.evaluate(mode => document.querySelector(`[data-live-exhibit="${mode}"]`).click(), mode);
      assert.equal(await page.locator("[data-live-deck-location]").textContent(), "沖縄県（那覇市）");
      assert.equal(await page.locator("[data-live-exhibit-value]").textContent(), "—");
      assert(await page.locator("[data-live-cams-credit]").isVisible());
    }
    await page.evaluate(() => document.querySelector('[data-map-standard-index="0"]').click());
    assert.equal(await credit.isVisible(), false, "Weather credit leaked into an unrelated exhibit");
    report.checks.push({ width, links, modes: 6, provenancePreserved: true, sourceCredit: true, camsMissingLabels: true, cleanExit: true });
    console.log(`PASS ${width}: clean place labels, visible linked credit, source details, unchanged provenance, clean exit`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.errors.push(error.stack || String(error));
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
