import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4401"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(path.resolve(playwrightEntry)).href);
const outputDir = path.resolve(outputArgument || "artifacts/sensor-network-experience");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 568 },
];
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of viewports) {
    await fetch(new URL("/__qa/reset", baseUrl), { method: "POST" });
    const context = await browser.newContext({
      viewport,
      reducedMotion: "no-preference",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__gaiaLayoutShiftScore = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__gaiaLayoutShiftScore += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (!/server responded with a status of 401\b/u.test(text)) report.consoleErrors.push(`${viewport.name}: ${text}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/sensors/#map", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='map']").waitFor({ state: "visible" });
    await page.locator(".sensor-map-marker").first().waitFor({ state: "visible" });
    await page.locator(".sensor-sense-field").waitFor({ state: "visible" });
    assert.equal(await page.locator(".sensor-belonging, .sensor-presence-node").count(), 0);
    await page.waitForTimeout(900);
    const layoutShiftScore = await page.evaluate(() => window.__gaiaLayoutShiftScore);
    assert(layoutShiftScore <= .1, `initial map layout shift is too high: ${layoutShiftScore}`);
    const totalMarkerCount = await page.locator(".sensor-map-marker").count();
    const visibleMarkerCount = await page.locator(".sensor-map-marker:visible").count();
    const senseNodeCount = Number(await page.locator(".sensor-sense-field").getAttribute("data-node-count"));
    assert.equal(totalMarkerCount, 5);
    assert(senseNodeCount >= visibleMarkerCount && senseNodeCount <= totalMarkerCount, `sense field node count is inconsistent: ${JSON.stringify({ senseNodeCount, visibleMarkerCount, totalMarkerCount })}`);
    assert.match(await page.locator(".sensor-sense-field").getAttribute("data-renderer"), /^(webgl|2d)$/u);
    assert(Number(await page.locator(".sensor-sense-field").getAttribute("data-render-pixels")) <= 905_000);
    assert.equal(await page.locator(".sensor-public-card").count(), 5);
    assert.equal(await page.locator("#public-sensor-results").textContent(), "5 / 5件");
    await page.waitForFunction(() => [...document.querySelectorAll(".sensor-owner-avatar img")]
      .every((image) => image.complete && image.naturalWidth > 0));
    const avatarPresentation = await page.evaluate(() => {
      const inspect = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return element ? {
          borderRadius: getComputedStyle(element).borderRadius,
          width: rect.width,
          height: rect.height,
        } : null;
      };
      return {
        marker: inspect(".sensor-map-marker .sensor-owner-avatar"),
        directory: inspect(".sensor-public-card > .sensor-owner-avatar"),
        detail: inspect(".sensor-owner-profile-trigger"),
        brokenImages: [...document.querySelectorAll(".sensor-owner-avatar img")]
          .filter((image) => !image.complete || image.naturalWidth === 0).length,
      };
    });
    assert.equal(avatarPresentation.brokenImages, 0, `owner images are broken: ${JSON.stringify(avatarPresentation)}`);
    for (const [surface, presentation] of Object.entries(avatarPresentation).filter(([key]) => key !== "brokenImages")) {
      assert.equal(presentation?.borderRadius, "50%", `${surface} avatar is not circular: ${JSON.stringify(presentation)}`);
      assert(Math.abs(presentation.width - presentation.height) < .5, `${surface} avatar is not square: ${JSON.stringify(presentation)}`);
    }
    const avatarFailureRecovery = await page.locator(".sensor-public-card > .sensor-owner-avatar").first().evaluate((avatar) => {
      const image = avatar.querySelector("img");
      image.dispatchEvent(new Event("error"));
      const retrySource = image.src;
      const retryState = avatar.dataset.avatarState;
      image.dispatchEvent(new Event("error"));
      return {
        retrySource,
        retryState,
        fallbackState: avatar.dataset.avatarState,
        fallbackText: avatar.textContent,
        imageCount: avatar.querySelectorAll("img").length,
      };
    });
    assert.match(avatarFailureRecovery.retrySource, /[?&]gaiaAvatarRetry=/u, `avatar retry did not bypass cache: ${JSON.stringify(avatarFailureRecovery)}`);
    assert.equal(avatarFailureRecovery.retryState, "retrying", `avatar did not enter retry state: ${JSON.stringify(avatarFailureRecovery)}`);
    assert.equal(avatarFailureRecovery.fallbackState, "fallback", `avatar did not recover with a fallback: ${JSON.stringify(avatarFailureRecovery)}`);
    assert.equal(avatarFailureRecovery.imageCount, 0, `broken avatar image remains visible: ${JSON.stringify(avatarFailureRecovery)}`);
    assert.equal(avatarFailureRecovery.fallbackText.length, 1, `avatar fallback initial is invalid: ${JSON.stringify(avatarFailureRecovery)}`);
    const resonanceLinkCount = await page.locator(".sensor-resonance-link").count();
    if (viewport.width > 760) assert(resonanceLinkCount >= 2);
    assert.match(await page.locator("#public-sync-rate").textContent(), /^\d{2}\.\d%$/u);
    assert.notEqual(await page.locator("#public-sync-rate").textContent(), "00.0%");
    const syncExplanations = page.locator(".sensor-sync-metric[data-description]");
    assert.equal(await syncExplanations.count(), 4);
    if (viewport.width > 960) {
      await syncExplanations.nth(2).focus();
      assert.equal(await syncExplanations.nth(2).evaluate((element) => getComputedStyle(element, "::after").visibility), "visible");
    }
    assert.match(await syncExplanations.nth(2).getAttribute("data-description"), /累計件数/u);
    assert.equal(await page.locator(".sensor-metric-hud-grid article").count(), 3);
    assert.equal(await page.locator(".sensor-sparkline polyline").count(), 3);
    const readability = await page.evaluate(() => {
      const fontSize = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const sync = rect(".sensor-global-sync");
      const guide = rect(".gaia-mode-entry-guide-replay");
      const audio = rect(".gaia-audio-dock");
      return {
        syncLabel: fontSize(".sensor-global-sync header span"),
        syncStatLabel: fontSize(".sensor-sync-stats span"),
        syncStatValue: fontSize(".sensor-sync-stats b"),
        relationship: fontSize(".sensor-relationship-bar button"),
        metricLabel: fontSize(".sensor-metric-hud-grid small"),
        metricValue: fontSize(".sensor-metric-hud-grid strong"),
        metricLabelsComplete: Array.from(document.querySelectorAll(".sensor-metric-hud-grid small")).every((label) => label.textContent.trim() && label.dataset.console && !label.textContent.includes("…")),
        state: fontSize(".sensor-state"),
        guideWidth: guide.width,
        toolbarHeight: rect(".sensor-map-card-expand").height,
        topbarOverlap: Math.max(0, Math.min(sync.right, guide.right) - Math.max(sync.left, guide.left)) * Math.max(0, Math.min(sync.bottom, guide.bottom) - Math.max(sync.top, guide.top)),
        utilityOverlap: Math.max(0, Math.min(audio.right, guide.right) - Math.max(audio.left, guide.left)) * Math.max(0, Math.min(audio.bottom, guide.bottom) - Math.max(audio.top, guide.top)),
      };
    });
    if (viewport.width > 760) {
      assert(readability.syncLabel >= 9 && readability.syncStatLabel >= 8 && readability.syncStatValue >= 13, `topbar type is too small: ${JSON.stringify(readability)}`);
      assert(readability.relationship >= 11 && readability.metricLabel >= 9 && readability.metricValue >= 16 && readability.state >= 10, `sensor card type is too small: ${JSON.stringify(readability)}`);
      assert.equal(readability.metricLabelsComplete, true, `sensor metric labels are incomplete: ${JSON.stringify(readability)}`);
      assert(readability.guideWidth >= 44 && readability.toolbarHeight >= 36, `map controls are too small: ${JSON.stringify(readability)}`);
      assert.equal(readability.topbarOverlap, 0, `guide control overlaps network stats: ${JSON.stringify(readability)}`);
      assert.equal(readability.utilityOverlap, 0, `guide and audio controls overlap: ${JSON.stringify(readability)}`);
    }
    const markerSizes = await page.locator(".sensor-map-marker:visible").evaluateAll((markers) => markers.map((marker) => {
      const hit = marker.getBoundingClientRect();
      const avatar = marker.querySelector(".sensor-owner-avatar").getBoundingClientRect();
      return { hitWidth: hit.width, hitHeight: hit.height, avatarWidth: avatar.width, avatarHeight: avatar.height };
    }));
    assert(markerSizes.every(({ hitWidth, hitHeight }) => hitWidth >= 44 && hitHeight >= 44), `map marker hit target is too small: ${JSON.stringify(markerSizes)}`);
    assert(markerSizes.every(({ avatarWidth, avatarHeight }) => avatarWidth <= 36.5 && avatarHeight <= 36.5), `map marker avatar is too large: ${JSON.stringify(markerSizes)}`);

    if (viewport.width > 760) {
      const cardClose = page.locator(".sensor-map-card-close");
      if (await cardClose.isVisible()) await cardClose.click();
      const cluster = page.locator(".sensor-map-marker[data-cluster-size]").first();
      await cluster.waitFor({ state: "visible" });
      const clusterSize = Number(await cluster.getAttribute("data-cluster-size"));
      assert(clusterSize >= 2);
      assert.equal(await cluster.locator(".sensor-map-marker-cluster-count").textContent(), clusterSize === 2 ? "②" : String(clusterSize));
      assert((await page.locator(".sensor-map-marker[data-cluster-member][hidden]").count()) >= 1);
      assert.equal(await page.locator("#public-sensor-tethers,.sensor-marker-tether").count(), 0);
      const clusterSensorId = await cluster.getAttribute("data-sensor-id");
      const clusterAnchorBeforeHover = await cluster.evaluate((marker) => ({
        left: marker.style.left,
        top: marker.style.top,
        transform: getComputedStyle(marker).transform,
      }));
      await cluster.hover();
      const clusterAnchorAfterHover = await cluster.evaluate((marker) => ({
        left: marker.style.left,
        top: marker.style.top,
        transform: getComputedStyle(marker).transform,
      }));
      assert.deepEqual(clusterAnchorAfterHover, clusterAnchorBeforeHover);
      const clusterCentre = await cluster.evaluate((marker) => {
        const rect = marker.getBoundingClientRect();
        const mapRect = marker.closest(".sensor-world-map")?.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2 - (mapRect?.left || 0),
          y: rect.top + rect.height / 2 - (mapRect?.top || 0),
        };
      });
      const zoomBeforeCluster = await page.locator("#public-map-zoom").evaluate((output) => Number.parseFloat(output.value));
      await cluster.click();
      await page.waitForTimeout(120);
      const zoomAfterCluster = await page.locator("#public-map-zoom").evaluate((output) => Number.parseFloat(output.value));
      assert(zoomAfterCluster > zoomBeforeCluster, `cluster click did not zoom: ${zoomBeforeCluster} -> ${zoomAfterCluster}`);
      const anchoredMarker = page.locator(`.sensor-map-marker[data-sensor-id="${clusterSensorId}"]`);
      await anchoredMarker.waitFor({ state: "visible" });
      const anchoredCentre = await anchoredMarker.evaluate((marker) => {
        const rect = marker.getBoundingClientRect();
        const mapRect = marker.closest(".sensor-world-map")?.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2 - (mapRect?.left || 0),
          y: rect.top + rect.height / 2 - (mapRect?.top || 0),
        };
      });
      assert(Math.hypot(anchoredCentre.x - clusterCentre.x, anchoredCentre.y - clusterCentre.y) < 2, `cluster anchor moved during zoom: ${JSON.stringify({ clusterCentre, anchoredCentre })}`);
      assert.equal(await anchoredMarker.evaluate((marker) => marker.style.getPropertyValue("--sensor-marker-offset-x")), "");
      if (!await page.locator("#public-sensor-directory").isVisible()) await page.locator("#public-map-directory-toggle").click();
      await page.locator("#public-sensor-directory").waitFor({ state: "visible" });
      await page.waitForTimeout(520);
      const directoryGeometry = await page.evaluate(() => {
        const drawer = document.querySelector("#public-sensor-directory").getBoundingClientRect();
        const toggle = document.querySelector("#public-map-directory-toggle").getBoundingClientRect();
        return {
          drawer: { left: drawer.left, right: drawer.right, width: drawer.width },
          toggle: { left: toggle.left, right: toggle.right, width: toggle.width },
          viewportWidth: innerWidth,
          focusedId: document.activeElement?.id,
        };
      });
      assert(directoryGeometry.drawer.width >= 360, `desktop directory is too narrow: ${JSON.stringify(directoryGeometry)}`);
      assert(Math.abs(directoryGeometry.drawer.right - directoryGeometry.viewportWidth) < 2, `desktop directory is not edge-aligned: ${JSON.stringify(directoryGeometry)}`);
      assert(Math.abs(directoryGeometry.toggle.right - directoryGeometry.drawer.left) < 2, `directory toggle is not attached to the drawer: ${JSON.stringify(directoryGeometry)}`);
      assert.equal(directoryGeometry.focusedId, "public-sensor-query");
      await page.locator("#public-sensor-query").fill("大阪");
      assert.equal(await page.locator(".sensor-public-card:visible").count(), 1);
      assert.equal(await page.locator(".sensor-map-marker:visible").count(), 1);
      assert.equal(await page.locator("#public-sensor-results").textContent(), "1 / 5件");
      await page.locator("#public-sensor-query").fill("");
      await page.locator("[data-public-filter='DEMO']").click();
      assert.equal(await page.locator(".sensor-public-card:visible").count(), 4);
      assert.equal(await page.locator("#public-sensor-results").textContent(), "4 / 5件");
      await page.locator("[data-public-filter='ALL']").click();
      await page.locator("#public-sensor-directory-close").click();
      await page.locator("#public-sensor-directory").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#public-map-directory-toggle").getAttribute("aria-expanded"), "false");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "public-map-directory-toggle");
      await page.locator("#public-map-directory-toggle").click();
      await page.locator("#public-sensor-directory").waitFor({ state: "visible" });
    } else {
      const topbarHeight = await page.locator(".sensor-topbar").evaluate((element) => element.getBoundingClientRect().height);
      assert(topbarHeight <= 110, `mobile map topbar is too tall: ${topbarHeight}`);
      const refreshBounds = await page.locator("#refresh-map").evaluate((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      });
      assert(refreshBounds.left >= 0 && refreshBounds.right <= viewport.width, `mobile refresh action is clipped: ${JSON.stringify(refreshBounds)}`);
      assert.equal(await page.locator("#public-sensor-detail").getAttribute("data-expanded"), "false");
      const compactCardHeight = await page.locator("#public-sensor-detail").evaluate((element) => element.getBoundingClientRect().height);
      assert(compactCardHeight <= 260, `mobile readings and actions exceed their compact sheet budget: ${compactCardHeight}`);
      assert.equal(await page.locator(".sensor-map-card-expand").isVisible(), true);
      assert.equal(await page.locator(".sensor-observation-hud").isVisible(), true);
      const detailActionSizes = await page.locator(".sensor-map-card-actions button:visible").evaluateAll((buttons) => buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }));
      assert(detailActionSizes.every(({ width, height }) => width >= 44 && height >= 44), `mobile detail action is too small: ${JSON.stringify(detailActionSizes)}`);
      const mapActionSizes = await page.locator("#public-map-zoom-in,#public-map-zoom-out,#public-map-reset,#public-map-directory-toggle").evaluateAll((buttons) => buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { id: button.id, width: rect.width, height: rect.height };
      }));
      assert(mapActionSizes.every(({ width, height }) => width >= 44 && height >= 44), `mobile map action is too small: ${JSON.stringify(mapActionSizes)}`);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-summary.png`), fullPage: false });
      const map = page.locator("#public-sensor-map");
      const mapBox = await map.boundingBox();
      const centreX = mapBox.x + mapBox.width / 2;
      const centreY = mapBox.y + mapBox.height / 2;
      const zoomBeforePinch = await page.locator("#public-map-zoom").evaluate((output) => Number.parseFloat(output.value));
      await map.dispatchEvent("pointerdown", { pointerId: 41, pointerType: "touch", button: 0, buttons: 1, clientX: centreX - 42, clientY: centreY });
      await map.dispatchEvent("pointerdown", { pointerId: 42, pointerType: "touch", button: 0, buttons: 1, clientX: centreX + 42, clientY: centreY });
      await map.dispatchEvent("pointermove", { pointerId: 41, pointerType: "touch", button: -1, buttons: 1, clientX: centreX - 86, clientY: centreY });
      await map.dispatchEvent("pointermove", { pointerId: 42, pointerType: "touch", button: -1, buttons: 1, clientX: centreX + 86, clientY: centreY });
      await page.waitForTimeout(80);
      const zoomAfterPinch = await page.locator("#public-map-zoom").evaluate((output) => Number.parseFloat(output.value));
      assert(zoomAfterPinch > zoomBeforePinch * 1.45, `pinch did not zoom enough: ${zoomBeforePinch} -> ${zoomAfterPinch}`);
      assert.equal(await map.getAttribute("data-gesture"), "pinch");
      await map.dispatchEvent("pointerup", { pointerId: 41, pointerType: "touch", button: 0, buttons: 0, clientX: centreX - 86, clientY: centreY });
      await map.dispatchEvent("pointerup", { pointerId: 42, pointerType: "touch", button: 0, buttons: 0, clientX: centreX + 86, clientY: centreY });
      await page.locator("#public-map-directory-toggle").click();
      await page.locator("#public-sensor-directory").waitFor({ state: "visible" });
      assert.equal(await page.locator("#public-map-directory-toggle").getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Escape");
      await page.locator("#public-sensor-directory").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#public-sensor-directory").isVisible(), false);
      assert.equal(await page.locator("#public-sensor-detail").isVisible(), true);
      assert.equal(await page.locator("#public-sensor-detail").getAttribute("data-expanded"), "false");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "public-map-directory-toggle");
      await page.locator("#public-map-directory-toggle").click();
      await page.locator("#public-sensor-directory").waitFor({ state: "visible" });
      const firstDirectoryCard = page.locator(".sensor-public-card").first();
      await firstDirectoryCard.focus();
      await page.keyboard.press("Enter");
      await page.locator("#public-sensor-directory").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#public-sensor-directory").isVisible(), false);
      assert.equal(await page.locator(".sensor-map-card-expand").evaluate((button) => document.activeElement === button), true);
    }

    if (viewport.width > 760) {
      const sakuCard = page.locator(".sensor-public-card", { hasText: "sakuセンサー" });
      await sakuCard.click();
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-motion"), "ease-out");
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-easing"), "ease-out-quint");
      await page.waitForTimeout(100);
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-motion"), "ease-out");
      await page.waitForTimeout(650);
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-motion"), "idle");
      const sakuId = await sakuCard.getAttribute("data-sensor-id");
      assert.equal(new URL(page.url()).hash, `#map/sensor=${encodeURIComponent(sakuId)}`);
      await page.goBack();
      await page.waitForFunction(() => location.hash === "#map");
      assert.equal(await page.locator("#public-sensor-detail").getAttribute("data-closing"), "true");
      await page.locator("#public-sensor-detail").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-ui-return"), "fade-in");
      await page.goForward();
      await page.waitForFunction((sensorId) => location.hash === `#map/sensor=${encodeURIComponent(sensorId)}`, sakuId);
      await page.locator("#public-sensor-detail").waitFor({ state: "visible" });
      assert.equal(await page.locator(".sensor-map-marker[aria-current='true']").getAttribute("data-sensor-id"), sakuId);
      await page.waitForTimeout(650);
      const focusDelta = await page.evaluate(() => {
        const map = document.querySelector("#public-sensor-map").getBoundingClientRect();
        const marker = document.querySelector(".sensor-map-marker[aria-current='true']").getBoundingClientRect();
        return {
          x: Math.abs(marker.left + marker.width / 2 - (map.left + map.width / 2)),
          y: Math.abs(marker.top + marker.height / 2 - (map.top + map.height / 2)),
        };
      });
      assert(focusDelta.x < 5 && focusDelta.y < 5);
      assert.match(await page.locator("#public-sensor-detail").textContent(), /識理層シンクロ率/u);
      assert.equal(await page.locator(".sensor-map-card-expand").isVisible(), true);
      assert.equal(await page.locator(".sensor-map-card-share").isVisible(), false);
      assert.equal(await page.locator(".sensor-map-card-close").isVisible(), true);
      const deepLinkPage = await context.newPage();
      await deepLinkPage.goto(new URL(`/sensors/#map/sensor=${encodeURIComponent(sakuId)}`, baseUrl).href, { waitUntil: "domcontentloaded" });
      await deepLinkPage.locator(`.sensor-map-marker[data-sensor-id="${sakuId}"][aria-current="true"]`).waitFor({ state: "visible" });
      assert.equal(await deepLinkPage.locator("#public-sensor-detail h2").textContent(), "sakuセンサー");
      await deepLinkPage.close();
      await page.locator(".sensor-map-card-close").click();
      assert.equal(await page.locator("#public-sensor-detail").getAttribute("data-closing"), "true");
      await page.locator("#public-sensor-detail").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-ui-return"), "fade-in");
      await page.locator("#refresh-map").click();
      await page.waitForTimeout(250);
      assert.equal(await page.locator("#public-sensor-detail").isVisible(), false);
      assert.equal(await page.locator("#refresh-map").textContent(), "更新しました");
      assert.equal(await page.locator("#sensor-status").isVisible(), false);
    }

    if (viewport.width > 760) {
      if (!await page.locator("#public-sensor-directory").isVisible()) await page.locator("#public-map-directory-toggle").click();
      await page.locator(".sensor-public-card", { hasText: "あめセンサー" }).click();
      await page.waitForTimeout(650);
    } else {
      const ameMarker = page.locator(".sensor-map-marker", { hasText: "DEMO LIVE" }).filter({ has: page.locator("img[src*='amane']") });
      await ameMarker.click();
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-motion"), "ease-out");
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-easing"), "ease-out-quint");
      await page.waitForTimeout(100);
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-motion"), "ease-out");
      await page.waitForTimeout(650);
      assert.equal(await page.locator("#public-sensor-map").getAttribute("data-camera-motion"), "idle");
      const markerFocusDelta = await page.evaluate(() => {
        const map = document.querySelector("#public-sensor-map").getBoundingClientRect();
        const node = document.querySelector(".sensor-map-marker[aria-current='true']");
        const marker = node.getBoundingClientRect();
        const card = document.querySelector("#public-sensor-detail").getBoundingClientRect();
        return {
          x: Math.abs(marker.left + marker.width / 2 - (map.left + map.width / 2)),
          aboveCard: marker.bottom < card.top,
          hittable: node.contains(document.elementFromPoint(marker.left + marker.width / 2, marker.top + marker.height / 2)),
        };
      });
      assert(markerFocusDelta.x < 5 && markerFocusDelta.aboveCard && markerFocusDelta.hittable, `selected POI must be centred in the unobscured mobile map: ${JSON.stringify(markerFocusDelta)}`);
      assert.equal(await page.locator("#public-sensor-detail").getAttribute("data-expanded"), "false");
      assert.equal(await page.locator(".sensor-observation-hud").isVisible(), true);
      await page.locator(".sensor-map-card-expand").click();
      assert.equal(await page.locator(".sensor-map-card-expand").getAttribute("aria-expanded"), "true");
      assert.equal(await page.locator(".sensor-observation-hud").isVisible(), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#public-sensor-detail").getAttribute("data-expanded"), "false");
      assert.equal(await page.locator(".sensor-observation-hud").isVisible(), true);
      await page.locator(".sensor-map-card-expand").click();
    }
    assert.match(await page.locator("#public-sensor-detail").textContent(), /ダミーセンサー/u);
    const profileTrigger = page.locator(".sensor-owner-profile-trigger");
    assert.equal(await profileTrigger.getAttribute("aria-haspopup"), "dialog");
    const profileTriggerBox = await profileTrigger.boundingBox();
    assert(profileTriggerBox.width >= 44 && profileTriggerBox.height >= 44, `profile trigger is too small: ${JSON.stringify(profileTriggerBox)}`);
    await profileTrigger.click();
    await page.locator("#public-owner-profile").waitFor({ state: "visible" });
    await page.waitForTimeout(260);
    assert.match(await page.locator("#public-owner-profile-name").textContent(), /あめ/u);
    assert.match(await page.locator("#public-owner-profile-note").textContent(), /展示用ダミーセンサー/u);
    assert.match(await page.locator("#public-owner-profile-links").textContent(), /SNSリンクは登録されていません/u);
    assert.equal(await page.locator("#public-owner-profile-avatar").evaluate((avatar) => getComputedStyle(avatar).borderRadius), "50%");
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-profile.png`), fullPage: false });
    if (viewport.width > 760) await page.locator("#public-owner-profile .sensor-dialog-close").click();
    else if (viewport.width > 350) await page.locator("#public-owner-profile .sensor-public-profile-back").click();
    else await page.keyboard.press("Escape");
    assert.equal(await page.locator("#public-owner-profile").getAttribute("data-closing"), "true");
    await page.locator("#public-owner-profile").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#public-sensor-map").getAttribute("data-ui-return"), "fade-in");
    assert.equal(await profileTrigger.evaluate((button) => button === document.activeElement), true);
    assert.equal(await page.locator(".sensor-belonging, .sensor-presence-node").count(), 0);
    assert.match(await page.locator("#public-sensor-detail").textContent(), /電界変動/u);
    const depthBefore = await page.locator("#public-depth-value").textContent();
    if (!await page.locator(".sensor-oracle-trigger").isVisible()) await page.locator(".sensor-map-card-expand").click();
    await page.locator(".sensor-oracle-trigger").click();
    await page.locator(".sensor-oracle-receipt.is-received").waitFor({ state: "visible" });
    assert.match(await page.locator(".sensor-oracle-receipt").textContent(), /SIMULATION LOG/u);
    assert.equal(await page.locator(".sensor-belonging, .sensor-presence-node").count(), 0);
    assert(Number(await page.locator(".sensor-sense-field").getAttribute("data-pulse-count")) >= 3);
    assert.notEqual(await page.locator("#public-depth-value").textContent(), depthBefore);

    const scan = await page.evaluate(() => ({
      syncRate: document.querySelector("#public-sync-rate")?.textContent,
      activeNodes: document.querySelector("#public-active-nodes")?.textContent,
      packets: document.querySelector("#public-packet-count")?.textContent,
      resonanceLinks: document.querySelectorAll(".sensor-resonance-link").length,
      selected: document.querySelector("#public-sensor-detail h2")?.textContent,
      senseRenderer: document.querySelector(".sensor-sense-field")?.dataset.renderer,
      sensePixels: Number(document.querySelector(".sensor-sense-field")?.dataset.renderPixels),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      cardWithinViewport: (() => {
        const rect = document.querySelector("#public-sensor-detail").getBoundingClientRect();
        return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
      })(),
    }));
    scan.layoutShiftScore = layoutShiftScore;
    assert.equal(scan.overflowX, false);
    assert.equal(scan.cardWithinViewport, true);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-network.png`), fullPage: false });
    report.scans.push({ viewport: viewport.name, ...scan, passed: true });
    await context.close();
  }

  await fetch(new URL("/__qa/reset", baseUrl), { method: "POST" });
  const wideContext = await browser.newContext({ viewport: { width: 3840, height: 2160 }, reducedMotion: "reduce" });
  const widePage = await wideContext.newPage();
  await widePage.goto(new URL("/sensors/#map", baseUrl).href, { waitUntil: "domcontentloaded" });
  await widePage.locator(".sensor-map-canvas--overscan").waitFor({ state: "visible" });
  await widePage.locator(".sensor-sense-field").waitFor({ state: "visible" });
  const canvasBudget = await widePage.locator(".sensor-map-canvas--overscan").evaluate((canvas) => ({
    pixels: canvas.width * canvas.height,
    declaredPixels: Number(canvas.dataset.renderPixels),
    renderScale: Number(canvas.dataset.renderScale),
  }));
  assert(canvasBudget.pixels <= 12_100_000, `4K map canvas exceeds its pixel budget: ${canvasBudget.pixels}`);
  assert.equal(canvasBudget.pixels, canvasBudget.declaredPixels);
  assert(canvasBudget.renderScale > 0 && canvasBudget.renderScale <= 1);
  const senseBudget = await widePage.locator(".sensor-sense-field").evaluate((canvas) => ({
    pixels: canvas.width * canvas.height,
    declaredPixels: Number(canvas.dataset.renderPixels),
    motion: canvas.dataset.motion,
    renderer: canvas.dataset.renderer,
  }));
  assert(senseBudget.pixels <= 905_000, `4K sense field exceeds its pixel budget: ${senseBudget.pixels}`);
  assert.equal(senseBudget.pixels, senseBudget.declaredPixels);
  assert.equal(senseBudget.motion, "static");
  assert.match(senseBudget.renderer, /^(webgl|2d)$/u);
  report.scans.push({ viewport: "pc-3840", ...canvasBudget, senseBudget, passed: true });
  await wideContext.close();
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log("sensor network experience browser check passed");
