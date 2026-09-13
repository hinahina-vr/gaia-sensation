import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/map-actions");
const widths = (process.argv[4] || "1440,3840,1024,800,390,320").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
let currentPage;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const height = width === 3840 ? 2088 : width < 901 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, (_, i) => ({ current: {
          time: "2026-09-05T05:30", wind_speed_10m: 7.2 + i / 10, wind_direction_10m: 124, surface_pressure: 1014,
          cloud_cover: 52, shortwave_radiation: 512 + i, pm2_5: 10 + i / 10, aerosol_optical_depth: .18,
        } }));
        return route.fulfill({ json: count === 1 ? rows[0] : rows });
      });
    }
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      type: "FeatureCollection", metadata: { generated: Date.now() }, features: [1, 2, 3].map(i => ({
        type: "Feature", id: `qa-quake-${i}`, geometry: { type: "Point", coordinates: [130 + i, 30 + i, 12] },
        properties: { mag: i + 2, place: `QA point ${i}`, time: Date.now() - i * 3600000 },
      })),
    } }));
    const page = await context.newPage();
    currentPage = page;
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=unified-map-actions#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    const select = async n => {
      await page.evaluate(n => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .find(button => button.textContent.trim() === String(n).padStart(2, "0")).click(), n);
      await page.waitForFunction(n => document.querySelector("#japan-mode-number").textContent === String(n).padStart(2, "0"), n);
      if (n >= 27) await page.waitForFunction(() => document.querySelector(".gaia-planet-signals-readout").dataset.loading !== "true");
      await page.waitForTimeout(450);
    };
    const checkScroll = async stage => {
      const scroll = await page.locator("#japan-layer").evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop }));
      assert.deepEqual(scroll, { left: 0, top: 0 }, `${width}/${stage}: map was scrolled by modal focus`);
    };
    for (let n = 10; n <= 30; n++) {
      await select(n);
      await checkScroll(`${n}/select`);
      if (n <= 15) {
        await page.evaluate(async () => {
          globalThis.GaiaLiveExhibits.pausePoiAutoplay();
          globalThis.GaiaLiveExhibits.selectObservationPoint("tokyo");
          await globalThis.GaiaLiveData.selectCity("tokyo");
        });
        await page.waitForFunction(() => !document.querySelector("[data-live-deck-analysis]").disabled);
      }
      const actions = page.locator(".gaia-map-actions:visible");
      assert.equal(await actions.count(), 1, `${width}/${n}: one active action pair`);
      const metrics = await actions.locator(".gaia-map-action").evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        const strong = node.querySelector("strong");
        return {
          text: strong.textContent, kicker: node.querySelector("small").textContent,
          icon: Boolean(node.querySelector("svg")), background: getComputedStyle(node).backgroundImage,
          width: rect.width, height: rect.height, x: rect.x, y: rect.y,
          overflow: strong.scrollWidth > strong.clientWidth + 1,
          hit: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
        };
      }));
      assert.deepEqual(metrics.map(m => m.text), ["データの出典", "統計分析"]);
      assert.deepEqual(metrics.map(m => m.kicker), ["SOURCE", "ANALYSIS"]);
      for (const metric of metrics) {
        assert(metric.icon && !metric.overflow, `${width}/${n}: icon or label clipped: ${JSON.stringify(metric)}`);
        assert(metric.width >= 44 && metric.height >= 44 && metric.hit, `${width}/${n}: hit area: ${JSON.stringify(metric)}`);
        assert(metric.x >= 0 && metric.x + metric.width <= width + 1 && metric.y + metric.height <= height + 1,
          `${width}/${n}: outside viewport: ${JSON.stringify(metric)}`);
      }
      assert(metrics[0].x + metrics[0].width <= metrics[1].x + 1, "Actions overlap");
      assert.match(metrics[0].background, /30, 167, 144/);
      assert.match(metrics[1].background, /163, 78, 207/);
      assert.equal(await page.locator("[data-live-light-touch]").count(), 0);
      assert.equal(await page.locator("[data-live-deck-standard], .gaia-live-deck-return").count(), 0);
      assert.equal(await page.locator("#japan-data-button:visible, #gaia-statistics-button:visible, .gaia-statistics-quick:visible").count(), 0, "Retired duplicate action entries remain");
      if ([10, 16, 26, 27, 30].includes(n)) {
        await page.screenshot({ path: path.join(output, `${width}-${n}.jpg`), type: "jpeg", quality: 85 });
      }
      const source = actions.locator(".gaia-map-action--source");
      assert.equal(await source.getAttribute("href"), null, "Source actions must open the in-page ledger first");
      await source.click();
      await checkScroll(`${n}/source-open`);
      await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
      assert.match(await page.locator("#data-ledger-mode-title").textContent(), new RegExp(`^${n} `));
      assert(await page.locator("#data-ledger-sources a").count() > 0);
      await page.locator("#japan-data-close").click();
      await checkScroll(`${n}/source-close`);
      assert(await source.evaluate(node => document.activeElement === node), "Source dialog restores focus to its real opener");
      await actions.locator(".gaia-map-action--analysis").click();
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab.getState().open && globalThis.GaiaStatisticsLab.getState().analysisReady);
      const state = await page.evaluate(() => globalThis.GaiaStatisticsLab.getState());
      await checkScroll(`${n}/analysis-open`);
      assert.match(state.datasetId, n <= 15 ? /^live-/ : n <= 25 ? /^(estat-|jma-)/ : n === 26 ? /firms/ : /^planet-/);
      assert.match(await page.locator("#gaia-statistics-context").textContent(), n === 26 ? /NASA FIRMS/ : new RegExp(`${n} `));
      await page.locator("#gaia-statistics-close").click();
      await checkScroll(`${n}/analysis-close`);
      report.checks.push({ width, number: n, metrics, dataset: state.datasetId, source: "clicked" });
    }
    // Missing local data must not open an unrelated dataset.
    await select(11);
    await page.evaluate(async () => {
      globalThis.GaiaLiveExhibits.pausePoiAutoplay();
      globalThis.GaiaLiveExhibits.selectObservationPoint("sapporo");
      await globalThis.GaiaLiveData.selectCity("sapporo");
    });
    await page.waitForFunction(() => document.querySelector("[data-live-deck-analysis]").disabled);
    console.log(`PASS ${width}px: MAP10–30 labels, icons, colors, hit areas, source links, dataset-specific analysis; missing-data guard`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" });
    report.layout = await currentPage.evaluate(() => ({ scrollX, scrollY, width: innerWidth, height: innerHeight,
      scrollers: [...document.querySelectorAll("*")].filter(node => node.scrollLeft).map(node => ({ tag: node.tagName, id: node.id, class: node.className, scrollLeft: node.scrollLeft })),
      panels: [...document.querySelectorAll(".gaia-map-actions")].map(node => ({
        class: node.className, rect: node.getBoundingClientRect().toJSON(), parent: node.parentElement.getBoundingClientRect().toJSON(),
      })),
    }));
  }
  report.status = "failed"; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
