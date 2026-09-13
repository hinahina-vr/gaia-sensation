import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", output = "artifacts/inline-data-sources", widthsArgument = "1920,1440,390,320"] = process.argv.slice(2);
const report = { status: "running", checks: [], errors: [], network: "External responses stubbed for UI QA; no source website is contacted." };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of widthsArgument.split(",").map(Number)) {
    const height = width === 320 ? 568 : width <= 900 ? 844 : 1080;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: width <= 900 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      globalThis.EventSource = class { addEventListener() {} close() {} };
      for (const loader of ["atmosphere", "air"]) sessionStorage.setItem(`gaia-planet-signals-v3:${loader}`, JSON.stringify({ cachedAt: Date.now(), data: {
        observedAt: "2026-09-03T23:37:00Z", points: [{ lat: 35, lon: 139, label: "Tokyo", windSpeed: 7.2, windDirection: 124, pressure: 1014, cloud: 36, radiation: 512, pm25: 13.4, aerosol: .27 }],
      } }));
    });
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (request.isNavigationRequest()) return route.fulfill({ body: "External source link QA", contentType: "text/plain" });
      if (url.hostname === "services.swpc.noaa.gov") return route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" });
      if (url.hostname === "earthquake.usgs.gov") return route.fulfill({ json: { type: "FeatureCollection", metadata: { generated: Date.now() }, features: [{
        type: "Feature", id: "qa-quake", geometry: { type: "Point", coordinates: [139, 35, 10] },
        properties: { mag: 5.1, time: Date.now(), place: "Japan", url: "https://earthquake.usgs.gov/" },
      }] } });
      return route.abort();
    });
    await context.route("**/api/live/v1/firms", route => route.fulfill({ path: "data/firms-active-fire-snapshot.json", contentType: "application/json" }));
    await context.route("**/api/live/v1/snapshot?*", route => route.fulfill({ json: { source: "live", events: [{
      eventId: "qa-weather", provider: "open-meteo", datasetId: "QA Open-Meteo model values", status: "latest-published",
      observedAt: "2026-09-03T23:37:00Z", retrievedAt: "2026-09-03T23:38:00Z", location: { label: "Tokyo", lat: 35, lon: 139 },
      provenance: { sourceUrl: "https://open-meteo.com/en/docs", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" },
      measurements: [["weatherWindSpeed", 4.8, "m/s"], ["forecastCo2", 423.1, "ppm"], ["weatherPrecipitation", 0, "mm"], ["weatherTemperature", -5, "℃"], ["cloudCover", 40, "%"], ["pm25", 11.2, "µg/m³"]]
        .map(([key, value, unit]) => ({ key, value, unit, sourceKind: "MODEL", quality: "estimated" })),
    }] } }));
    await context.route("**/api/live/v1/wind-field", route => route.fulfill({ json: { points: [] } }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    let popups = 0;
    page.on("popup", () => popups++);
    await page.goto(`${base}/?exhibit=30#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady();
      GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapDemo.stop();
    });
    const initialUrl = page.url();
    for (let number = 1; number <= 30; number++) {
      await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent) === number).click(), number);
      await page.waitForFunction(number => Number(document.querySelector("#japan-mode-number").textContent) === number
        && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), number);
      await page.waitForFunction(() => !document.querySelector('.gaia-planet-signals-readout:not([hidden])[data-loading="true"]'));
      if (number >= 21) {
        await page.waitForFunction(() => globalThis.GaiaEstatExhibits?.getStatisticsDataset?.()?.rows.length);
        await page.evaluate(() => GaiaEstatExhibits.selectPrefecture(12));
      }
      const expected = await page.evaluate(() => GaiaEstatExhibits.getSourceInfo() || GaiaFirmsExhibit.getSourceInfo() || GaiaPlanetSignals.getSourceInfo());
      let opener;
      if (width <= 900) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        opener = page.locator('.map-mobile-tool-grid').getByRole("button", { name: "データの出典", exact: true });
      } else {
        opener = page.locator('.gaia-map-action--source:visible, .map-dock-action--source:visible');
        assert.equal(await opener.count(), 1, `${width}/${number}: exactly one source action`);
        assert.equal(await opener.evaluate(node => node.tagName), "BUTTON");
        assert.equal(await opener.getAttribute("href"), null);
      }
      const beforePopups = popups;
      await opener.click();
      await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
      const panel = page.locator("#japan-data-panel");
      await page.locator("#japan-data-close").waitFor({ state: "visible" });
      await page.waitForTimeout(200);
      await page.waitForFunction(() => {
        const box = document.querySelector("#japan-data-panel").getBoundingClientRect();
        return box.right <= innerWidth + 0.1 && box.bottom <= innerHeight + 0.1;
      });
      const title = await page.locator("#data-ledger-mode-title").textContent();
      assert.match(title, new RegExp(`^${String(number).padStart(2, "0")} `), `${width}/${number}: wrong exhibit sources`);
      assert.equal(popups, beforePopups, `${width}/${number}: source button opened an external tab`);
      assert.equal(page.url(), initialUrl, `${width}/${number}: source button navigated away`);
      assert.equal(await panel.getAttribute("role"), "dialog");
      assert.equal(await page.locator("#japan-data-button").getAttribute("aria-expanded"), "true");
      const cards = await page.locator(".data-ledger-card").evaluateAll(nodes => nodes.map(node => ({
        title: node.querySelector("h3").textContent,
        organisation: node.querySelector(".data-ledger-organisation").textContent,
        href: node.querySelector("a").href,
        note: node.querySelector(".data-ledger-attribution")?.textContent,
      })));
      assert(cards.length > 0 && cards.every(card => card.title && card.organisation && card.href));
      if (expected) {
        assert.equal(title, `${expected.number} ${expected.shortTitle}`);
        assert.deepEqual(cards, expected.datasets.map(dataset => ({ title: dataset.title, organisation: dataset.organisation, href: dataset.url, note: dataset.attributionNote })));
      }
      const geometry = await panel.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { x: box.x, right: box.right, y: box.y, bottom: box.bottom,
          overflow: node.querySelector(".japan-data-scroll").scrollWidth - node.querySelector(".japan-data-scroll").clientWidth,
          notes: [...node.querySelectorAll(".data-ledger-attribution")].map(note => ({
            top: note.getBoundingClientRect().top,
            previousBottom: Math.max(...[...note.parentElement.querySelectorAll("h3, .data-ledger-organisation, .data-source-links")].map(sibling => sibling.getBoundingClientRect().bottom)),
          })) };
      });
      assert(geometry.x >= -1 && geometry.right <= width + 1 && geometry.y >= -1 && geometry.bottom <= height + 1 && geometry.overflow <= 1, `${width}/${number}: panel clipped ${JSON.stringify(geometry)}`);
      assert(geometry.notes.every(note => note.top >= note.previousBottom), `${width}/${number}: attribution overlaps provider/links`);
      // High-z-index mobile observation cards/toolbar must not cover the drawer.
      assert(await panel.evaluate(node => {
        const box = node.getBoundingClientRect();
        return [0.2, 0.5, 0.8].every(x => [0.25, 0.6, 0.9].every(y => node.contains(document.elementFromPoint(box.x + box.width * x, box.y + box.height * y))));
      }), `${width}/${number}: map controls cover the source panel`);
      for (const link of await panel.locator("a").all()) {
        await link.scrollIntoViewIfNeeded();
        assert(await link.evaluate(node => {
          const rect = node.getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44 && node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }), `${width}/${number}: source link is obstructed`);
      }
      await page.locator(".japan-data-scroll").evaluate(node => { node.scrollTop = 0; });
      if ([1, 3, 12, 21, 24, 30].includes(number)) await page.screenshot({ path: path.join(output, `${width}-${number}-sources.png`) });
      // Keyboard focus stays inside the panel, and Escape restores the real entry.
      await page.locator("#japan-data-close").focus();
      await page.keyboard.press("Shift+Tab");
      assert(await panel.locator("a").last().evaluate(node => document.activeElement === node));
      await page.keyboard.press("Tab");
      assert(await page.locator("#japan-data-close").evaluate(node => document.activeElement === node));
      if ([1, 2, 3, 4, 5, 6, 12, 21, 24, 28, 30].includes(number)) {
        const external = panel.locator("a").first();
        assert.equal(await external.getAttribute("target"), "_blank");
        assert.match(await external.getAttribute("rel"), /noopener/);
        assert.match(await external.getAttribute("aria-label"), /新しいタブ/u);
        const popupPromise = page.waitForEvent("popup");
        await external.click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        assert.equal(popup.url(), cards[0].href);
        await popup.close();
      }
      // Leaving a deeply scrolled ledger must not carry its scroll into the next exhibit.
      await page.locator(".japan-data-scroll").evaluate(node => { node.scrollTop = node.scrollHeight; });
      if (number % 2) await page.keyboard.press("Escape");
      else await page.locator("#japan-data-close").click();
      await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "true");
      const returnTarget = width <= 900 ? page.locator('[data-mobile-sheet="tools"]') : opener;
      assert(await returnTarget.evaluate(node => document.activeElement === node), `${width}/${number}: focus not restored`);
      assert.equal(await page.locator("#japan-data-button").getAttribute("aria-expanded"), "false");
      assert.deepEqual(await page.locator("#japan-layer").evaluate(node => ({ x: node.scrollLeft, y: node.scrollTop })), { x: 0, y: 0 });
      report.checks.push({ width, number, title, cards, inPageFirst: true, keyboard: true, geometry });
    }
    // The weather link must follow a changed selected station, not the previous entry.
    await page.evaluate(() => GaiaEstatExhibits.selectPrefecture(0));
    if (width <= 900) {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.locator('.map-mobile-tool-grid').getByRole("button", { name: "データの出典", exact: true }).click();
    } else await page.locator(".gaia-map-action--source:visible").click();
    await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
    assert.match(await page.locator(".data-ledger-attribution").textContent(), /北海道/u);
    const stationUrl = await page.evaluate(() => GaiaEstatExhibits.getSourceInfo().datasets[0].url);
    assert.equal(await page.locator(".data-ledger-card a").getAttribute("href"), stationUrl);
    assert.equal(await page.locator(".japan-data-scroll").evaluate(node => node.scrollTop), 0);
    console.log(`PASS ${width}px: all 30 source actions open in-page first; selected source links, focus, wrapping, and station refresh`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
