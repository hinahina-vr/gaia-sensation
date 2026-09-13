import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv.slice(2).find(arg => /^https?:\/\//.test(arg)) || "http://127.0.0.1:4447";
const before = process.argv.includes("--before");
const widths = (process.argv.find(arg => arg.startsWith("--widths="))?.split("=")[1] || "1920,1440,1024,3840,390,320,844").split(",").map(Number);
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/live-credit-clearance/${before ? "before" : "after"}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", before, checks: [], errors: [], scope: "Local Chrome, synthetic live-feed responses and bundled offline fallback; no live-provider or production claim",
  sha256: Object.fromEntries(["src/exploration/live-exhibits.js", "live-observation-ui.css", "map-ui-grid-polish.css", "src/exploration/index.js", "gaia-mode-loader.js", "index.html"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const scan = () => page.evaluate(() => {
  const visible = node => !node.closest("[hidden]") && node.checkVisibility() && getComputedStyle(node).visibility !== "hidden" && Number(getComputedStyle(node).opacity) > 0;
  const footer = document.querySelector(".japan-credits"), readout = document.querySelector(".gaia-live-exhibit-readout");
  const rect = node => node.getBoundingClientRect().toJSON();
  const controls = [...document.querySelectorAll('.gaia-live-exhibit-readout, .gaia-live-deck-actions button, .gaia-live-place-selector, .map-command-dock, #map-mobile-toolbar, .japan-heading, #gaia-map-zoom-controls')].filter(visible);
  const fragments = [...footer.querySelectorAll("a, .gaia-live-data-credit > span, .gaia-live-data-freshness > strong, .gaia-live-data-freshness > time")].filter(visible).map(node => {
    const bounds = rect(node);
    const overlaps = controls.filter(control => {
      const box = rect(control);
      return Math.max(0, Math.min(bounds.right, box.right) - Math.max(bounds.left, box.left)) * Math.max(0, Math.min(bounds.bottom, box.bottom) - Math.max(bounds.top, box.top)) > 1;
    }).map(node => node.className || node.id);
    const at = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return { text: node.textContent.trim(), href: node.href, rect: bounds, overlaps, hit: node === at || node.contains(at) };
  });
  return { footer: rect(footer), readout: rect(readout), footerStyle: { bottom: getComputedStyle(footer).bottom, display: getComputedStyle(footer).display, position: getComputedStyle(footer).position },
    variable: document.querySelector("#japan-layer").style.getPropertyValue("--live-credit-bottom"),
    weather: rect(document.querySelector(".gaia-live-weather-credit")), fragments,
    state: document.querySelector("[data-live-exhibit-feed-state]").textContent,
    time: document.querySelector("[data-live-exhibit-feed-time]").textContent,
    actions: [...document.querySelectorAll(".gaia-live-deck-actions > button")].filter(visible).map(node => ({ text: node.textContent, rect: rect(node), hit: node.contains(document.elementFromPoint(node.getBoundingClientRect().x + node.clientWidth / 2, node.getBoundingClientRect().y + node.clientHeight / 2)) })),
    overflow: document.documentElement.scrollWidth - innerWidth };
});
const settle = () => page.evaluate(async () => {
  const dock = document.querySelector(".gaia-live-exhibit-readout");
  await Promise.all(dock.getAnimations({ subtree: false }).map(animation => animation.finished.catch(() => {})));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
const assertClear = (result, width, height, phase) => {
  assert.equal(result.overflow, 0);
  assert(result.fragments.length >= 3, "Source and time must remain visible");
  for (const item of result.fragments) {
    assert.deepEqual(item.overlaps, [], `${width}/${phase}: ${item.text} overlaps controls`);
    assert(item.rect.left >= 0 && item.rect.right <= width + 1 && item.rect.top >= 0 && item.rect.bottom <= height + 1, "All credit text must fit the viewport");
    if (item.href) assert(item.hit, `${width}: ${item.text} link must be reachable`);
  }
  assert(result.actions.every(action => action.hit), "Action buttons must not be covered by credit links");
};
try {
  for (const width of widths) {
    const height = width === 844 ? 390 : width === 320 ? 568 : width === 390 ? 844 : width >= 2400 ? 2160 : width === 1024 ? 768 : width === 1920 ? 1080 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, reducedMotion: "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
    });
    let readyFeed = false;
    await context.route("**/api/live/v1/snapshot*", route => {
      if (!readyFeed) return route.fulfill({ status: 503, json: {} });
      const date = new Date().toISOString();
      return route.fulfill({ json: { source: "live", events: [{ eventId: "credit-layout", provider: "open-meteo", datasetId: "Layout QA model response", status: "latest-published", observedAt: date, retrievedAt: date,
        location: { label: "東京", lat: 35.6762, lon: 139.6503 }, provenance: { sourceUrl: "https://open-meteo.com/en/docs" },
        measurements: [["weatherWindSpeed", 7.2, "m/s"], ["forecastCo2", 423, "ppm"], ["pm25", 12.3, "µg/m³"]].map(([key, value, unit]) => ({ key, value, unit, quality: "estimated", sourceKind: "MODEL" })) }] } });
    });
    await context.route("**/api/live/v1/wind-field*", route => route.fulfill({ json: { source: "qa", points: [] } }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage(); page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?live=1&preview=credit-clearance#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaLiveExhibits && globalThis.GaiaMapDemo && globalThis.GaiaLiveData && document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(() => { GaiaModeEntryGuide.close("map", { restoreFocus: false }); GaiaMapDemo.stop(); });
    for (const number of before ? [15] : [15, 16, 17, 18, 19, 20]) {
      await page.evaluate(number => {
        [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find(button => Number(button.textContent) === number).click();
        GaiaLiveExhibits.pausePoiAutoplay();
      }, number);
      await page.waitForFunction(() => document.querySelector("#japan-layer").classList.contains("is-live-exhibit") && !document.querySelector(".gaia-live-weather-credit").hidden && !/取得中|更新中/.test(document.querySelector("[data-live-exhibit-feed-state]").textContent));
      await settle();
      const result = await scan(); report.checks.push({ width, height, number, phase: "fallback", result });
      await page.screenshot({ path: path.join(output, `${width}-${number}-map.png`) });
      const top = Math.max(0, Math.floor(Math.min(result.footer.top, result.readout.top) - 16));
      await page.screenshot({ path: path.join(output, `${width}-${number}-footer.png`), clip: { x: 0, y: top, width, height: height - top } });
      if (!before) assertClear(result, width, height, number);
    }
    if (!before) {
      readyFeed = true;
      await page.evaluate(async () => { GaiaLiveExhibits.selectObservationPoint("tokyo"); GaiaLiveExhibits.pausePoiAutoplay(); await GaiaLiveData.refresh(); });
      await page.waitForFunction(() => !/取得中|更新中|未収録|できません/.test(document.querySelector("[data-live-exhibit-feed-state]").textContent));
      await settle();
      const result = await scan();
      assert(result.time.includes("JST") && !result.time.endsWith("—"));
      assertClear(result, width, height, "timestamp-updated");
      report.checks.push({ width, height, number: 20, phase: "timestamp-updated", result });
      if (width === 1920) {
        for (const [resizedWidth, resizedHeight] of [[901, 768], [390, 844], [844, 390], [width, height]]) {
          await page.setViewportSize({ width: resizedWidth, height: resizedHeight });
          await settle();
          const resized = await scan(); assertClear(resized, resizedWidth, resizedHeight, "resize");
          report.checks.push({ width: resizedWidth, height: resizedHeight, number: 20, phase: "resize", result: resized });
        }
      }
      const link = page.locator('.gaia-live-data-credit a[href="https://open-meteo.com/"]');
      await context.route("https://open-meteo.com/", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Source link QA</title>" }));
      const opened = page.waitForEvent("popup"); await link.click(); const popup = await opened;
      await popup.waitForLoadState("domcontentloaded"); assert.equal(popup.url(), "https://open-meteo.com/"); await popup.close();
      if (width <= 900) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.locator(".map-mobile-tool-grid button").filter({ hasText: "データの出典" }).click();
      } else await page.locator("[data-live-deck-source]").click();
      await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
      assert.match(await page.locator("#data-ledger-mode-title").textContent(), /^20 /);
      assert(await page.locator(".data-ledger-card").count() > 0);
      await page.locator("#japan-data-close").click();
      await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "true");
      report.checks.push({ width, height, phase: "source-controls", providerLink: "https://open-meteo.com/", ledgerOpenedAndClosed: true });
      await page.evaluate(() => GaiaMapObservationAdapter.selectMode(8));
      await page.waitForFunction(() => document.querySelector(".gaia-live-weather-credit").hidden && !document.querySelector("#japan-layer").classList.contains("is-live-exhibit"));
    }
    console.log(`${before ? "BEFORE" : "PASS"} ${width}: credits, controls, source links and dynamic state`);
    await context.close();
  }
  if (before) assert(report.checks.some(check => check.result.fragments.some(item => item.overlaps.length)), "Reproduce the reported source/UI overlap");
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
