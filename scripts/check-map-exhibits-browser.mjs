import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4198"] = process.argv.slice(2);
const recyclingOnly = process.argv.slice(6).includes("--recycling-only");
const panOnly = process.argv.slice(6).includes("--pan-only");
const legendOnly = process.argv.slice(6).includes("--legend-only");
const glintOnly = process.argv.slice(6).includes("--glint-only");
const countryReadoutOnly = process.argv.slice(6).includes("--country-readout-only");
const populationOnly = process.argv.slice(6).includes("--population-only");
const highResolutionOnly = process.argv.slice(6).includes("--high-resolution-only");
const map06CrossModeOnly = process.argv.slice(6).includes("--map06-cross-mode-only");
const earthquakeOnly = process.argv.slice(6).includes("--earthquake-only");
const guideOrderOnly = process.argv.slice(6).includes("--guide-order-only");
const circulationOnly = process.argv.slice(6).includes("--circulation-only");
const bubbleOnly = process.argv.slice(6).includes("--bubble-only");
const anthropoceneOnly = process.argv.slice(6).includes("--anthropocene-only");
const renewableRevealOnly = process.argv.slice(6).includes("--renewable-reveal-only");
const quantitativeLegendsOnly = process.argv.slice(6).includes("--quantitative-legends-only");
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/map-exhibits-10");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = guideOrderOnly
  ? [{ name: "pc-guide", width: 1440, height: 900 }]
  : highResolutionOnly || map06CrossModeOnly
  ? [{ name: "high-resolution", width: 3840, height: 2088 }]
  : [
      { name: "pc", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ];
const report = { status: "running", baseUrl, consoleErrors: [], pageErrors: [], responses404: [], scans: [] };
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
});

const readMapState = (page) => page.evaluate(() => {
  const overlay = document.querySelector("#japan-overlay");
  const rect = document.querySelector("#japan-map")?.getBoundingClientRect();
  return {
    zoom: Number(overlay?.dataset.earthZoom),
    offsetX: Number(overlay?.dataset.earthOffsetX),
    offsetY: Number(overlay?.dataset.earthOffsetY),
    japanX: Number(overlay?.dataset.japanScreenX),
    japanY: Number(overlay?.dataset.japanScreenY),
    tokyoX: Number(overlay?.dataset.tokyoScreenX),
    tokyoY: Number(overlay?.dataset.tokyoScreenY),
    animation: overlay?.dataset.viewAnimation || "",
    target: overlay?.dataset.viewTarget || "",
    vectorCopies: overlay?.dataset.vectorWorldCopies || "",
    rasterCopies: overlay?.dataset.rasterWorldCopies || "",
    gosatAnchorX: Number(overlay?.dataset.gosatAnchorScreenX),
    gosatAnchorY: Number(overlay?.dataset.gosatAnchorScreenY),
    gosatProjectionKey: overlay?.dataset.gosatProjectionKey || "",
    forestMask: overlay?.dataset.forestMask || "",
    rect: rect?.toJSON(),
  };
});

const sampleZoom = async (page, count = 9, interval = 150) => {
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    samples.push(await readMapState(page));
    await page.waitForTimeout(interval);
  }
  return samples;
};

const waitForMapGuide = (page) => page.waitForFunction(() => (
  document.querySelector("#map-reading-guide .map-reading-guide-body")?.getAttribute("aria-busy") === "false"
));

const selectMode = async (page, index, expectedTitle) => {
  const mobileBankToggle = page.locator("#map-mobile-bank-toggle");
  if (await mobileBankToggle.count()
    && await mobileBankToggle.isVisible()
    && await mobileBankToggle.getAttribute("aria-expanded") !== "true") {
    await mobileBankToggle.evaluate((button) => button.click());
  }
  const previousGuideTitle = await page.locator("#map-guide-title").textContent();
  const previousModeIndex = await page.evaluate(() => GaiaMapCategories.buttons()
    .findIndex((button) => button.getAttribute("aria-current") === "true"));
  await page.locator(`.map-mode-bank [data-map-standard-index="${index}"]`).evaluate((button) => button.click());
  await page.waitForFunction(
    ({ number, title, previousGuideTitle: previousGuide, requireGuideChange }) => document.querySelector("#japan-mode-number")?.textContent === number
      && document.querySelector("#japan-mode-title")?.textContent === title
      && document.querySelector("#japan-title")?.textContent === title
      && Boolean(document.querySelector("#map-guide-title")?.textContent)
      && (!requireGuideChange || document.querySelector("#map-guide-title")?.textContent !== previousGuide),
    {
      number: String(index + 1).padStart(2, "0"),
      title: expectedTitle,
      previousGuideTitle,
      requireGuideChange: previousModeIndex !== index,
    },
  );
  const observed = await page.evaluate(() => ({
    number: document.querySelector("#japan-mode-number")?.textContent || "",
    title: document.querySelector("#japan-mode-title")?.textContent || "",
    current: GaiaMapCategories.buttons()
      .findIndex((button) => button.getAttribute("aria-current") === "true"),
  }));
  assert.deepEqual(
    observed,
    { number: String(index + 1).padStart(2, "0"), title: expectedTitle, current: index },
    `mode ${index + 1} did not respond to a real button click`,
  );
};

const selectLiveMode = async (page, index, expectedTitle) => {
  const liveIndex = index - 9;
  const button = page.locator(".map-mode-bank .map-mode-button[data-live-exhibit]").filter({ hasText: new RegExp(`^${String(index + 1).padStart(2, "0")}$`) });
  await button.evaluate((element) => element.click());
  await page.waitForFunction(
    ({ number, title, expectedLiveIndex }) => {
      const liveButtons = GaiaMapCategories.buttons().filter(button => button.dataset.liveExhibit);
      return document.querySelector("#japan-mode-number")?.textContent === number
        && document.querySelector("#japan-mode-title")?.textContent === title
        && document.querySelector("#japan-title")?.textContent === title
        && document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit")
        && liveButtons.findIndex((candidate) => candidate.getAttribute("aria-current") === "true") === expectedLiveIndex;
    },
    {
      number: String(index + 1).padStart(2, "0"),
      title: expectedTitle,
      expectedLiveIndex: liveIndex,
    },
  );
};

const readAnthropoceneSnapshot = async (page) => page.locator("#japan-overlay").evaluate((element) => {
  const pixels = element.getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, element.width, element.height)
    .data;
  let redPixelCount = 0;
  let redPixelEnergy = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    if (red > 70 && red > green * 1.25 && red > blue * 1.15) {
      redPixelCount += 1;
      redPixelEnergy += red - Math.max(green, blue);
    }
  }
  return {
    year: Number(element.dataset.emissionsSelectedYear),
    countryCount: Number(element.dataset.emissionsCountryFillCount),
    visibleCountryCount: Number(element.dataset.emissionsVisibleCountryFillCount),
    heatSum: Number(element.dataset.emissionsHeatSum),
    maximumHeat: Number(element.dataset.emissionsMaximumHeat),
    totalMtCo2: Number(element.dataset.emissionsTotalMtCo2),
    selectedCountryMtCo2: Number(element.dataset.emissionsSelectedCountryMtCo2),
    scaleMtCo2: Number(element.dataset.emissionsScaleMtCo2),
    encoding: element.dataset.emissionsEncoding,
    geometry: element.dataset.emissionsGeometry,
    hitSurface: element.dataset.emissionsHitSurface,
    redPixelCount,
    redPixelEnergy,
  };
});

const findClickableDataPoint = async (page, modeId) => page.evaluate(async (requestedModeId) => {
  const snapshot = await fetch("./data/gaia-signals.json").then((response) => response.json());
  const mode = snapshot.modes.find((entry) => entry.id === requestedModeId);
  const rows = requestedModeId === "blue-circulation"
    ? mode?.signals?.currents
    : requestedModeId === "forest-cloud-engine"
      ? mode?.signals?.precipitation
      : requestedModeId === "anthropocene-scar"
        ? mode?.signals?.emissions?.filter((row) => Number(row.year) === Number(
          document.querySelector("#japan-overlay")?.dataset.emissionsSelectedYear,
        ))
        : mode?.signals?.countryWaste;
  const map = document.querySelector("#japan-map");
  const overlay = document.querySelector("#japan-overlay");
  const rect = map.getBoundingClientRect();
  const zoom = Number(overlay.dataset.earthZoom);
  const offsetX = Number(overlay.dataset.earthOffsetX);
  const offsetY = Number(overlay.dataset.earthOffsetY);
  const baseScale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180));
  const scale = baseScale * zoom;
  const width = 360 * scale;
  const height = 180 * scale;
  const originX = (rect.width - width) / 2 + offsetX;
  const originY = (rect.height - height) / 2 + offsetY;
  const wrap = (longitude) => ((longitude - Number(overlay.dataset.earthCenterLongitude) + 540) % 360) - 180;
  for (const [index, row] of (rows || []).entries()) {
    const x = originX + (wrap(row.lon) + 180) * scale;
    const y = originY + (90 - row.lat) * scale;
    const clientX = rect.left + x;
    const clientY = rect.top + y;
    if (x < 28 || x > rect.width - 28 || y < 28 || y > rect.height - 28) continue;
    const hit = document.elementFromPoint(clientX, clientY);
    if (hit?.closest?.("#japan-map")) return { index, clientX, clientY, row };
  }
  return null;
}, modeId);

const clickDataPoint = async (page, modeId) => {
  await page.waitForFunction(() => {
    const overlay = document.querySelector("#japan-overlay");
    return overlay?.dataset.plotRevealWaitsForSeparator === "false"
      && performance.now() >= Number(overlay.dataset.plotRevealFirstVisibleAt || 0);
  });
  const point = await findClickableDataPoint(page, modeId);
  assert(point, `${modeId}: no uncovered data point is clickable`);
  await page.mouse.click(point.clientX, point.clientY);
  await page.waitForFunction(() => document.querySelector("#japan-poi-card")?.getAttribute("aria-hidden") === "false");
  const card = await page.evaluate(() => ({
    type: document.querySelector("#japan-poi-type")?.textContent || "",
    meta: document.querySelector("#japan-poi-meta")?.textContent || "",
    sourceLabel: document.querySelector("#japan-poi-source")?.textContent?.replace(/\s+/gu, " ").trim() || "",
    sourceHref: document.querySelector("#japan-poi-source")?.href || "",
    sourceTarget: document.querySelector("#japan-poi-source")?.target || "",
    retiredCopyCount: document.querySelectorAll("#japan-poi-title, #japan-poi-description, #japan-poi-relation").length,
  }));
  assert.equal(card.sourceLabel, "元データを確認する ↗", `${modeId}: source action label changed`);
  assert.match(card.sourceHref, /^https?:\/\//u, `${modeId}: source action is not an external original-data URL`);
  assert.equal(card.sourceTarget, "_blank", `${modeId}: source action must open a new window`);
  assert.equal(card.retiredCopyCount, 0, `${modeId}: retired explanatory copy remains`);
  return {
    point,
    card,
  };
};

const closeDataCard = async (page) => {
  await page.locator("#japan-poi-close").click();
  await page.waitForFunction(() => document.querySelector("#japan-poi-card")?.getAttribute("aria-hidden") === "true");
};

const readMapRenderHealth = (page) => page.locator("#japan-overlay").evaluate((overlay) => {
  const sample = document.createElement("canvas");
  sample.width = 192;
  sample.height = 108;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(overlay, 0, 0, sample.width, sample.height);
  const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
  let nonTransparent = 0;
  let visibleColor = 0;
  let cyanLinePixels = 0;
  for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 4) {
    const red = pixels[pixelIndex];
    const green = pixels[pixelIndex + 1];
    const blue = pixels[pixelIndex + 2];
    if (pixels[pixelIndex + 3] > 2) nonTransparent += 1;
    if (red + green + blue > 36) visibleColor += 1;
    if (
      green >= 78
      && blue >= 72
      && green - red >= 20
      && blue - red >= 20
      && Math.abs(green - blue) <= 55
    ) {
      cyanLinePixels += 1;
    }
  }
  const style = getComputedStyle(overlay);
  return {
    canvasHeight: overlay.height,
    canvasWidth: overlay.width,
    cssHeight: overlay.getBoundingClientRect().height,
    cssWidth: overlay.getBoundingClientRect().width,
    cyanLinePixels,
    devicePixelRatio: overlay.dataset.devicePixelRatio,
    nonTransparent,
    opacity: style.opacity,
    renderPixelRatio: overlay.dataset.renderPixelRatio,
    renderQuality: overlay.dataset.renderQuality,
    renderLoopMode: overlay.dataset.renderLoopMode,
    referenceWorldCache: overlay.dataset.referenceWorldCache,
    visibleColor,
    visibility: style.visibility,
    worldBoundaryLayer: overlay.dataset.worldBoundaryLayer,
    worldBoundaryRingCount: Number(overlay.dataset.worldBoundaryRingCount),
    activeNumber: document.querySelector("#japan-mode-number")?.textContent || "",
    activeTitle: document.querySelector("#japan-mode-title")?.textContent || "",
    liveBackdrop: overlay.dataset.liveBackdrop || "",
    liveExhibit: document.querySelector("#japan-layer")?.dataset.liveExhibit || "",
    liveMode: document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit") || false,
  };
});

const waitForReferenceMap = (page) => page.waitForFunction(() => {
  const overlay = document.querySelector("#japan-overlay");
  return overlay?.dataset.referenceWorldCache === "ready"
    && overlay.dataset.worldBoundaryLayer === "country"
    && Number(overlay.dataset.worldBoundaryRingCount) >= 400;
});

const assertReferenceMapVisible = (renderState, label, { minimumCyanLinePixels = 650 } = {}) => {
  assert.equal(renderState.referenceWorldCache, "ready", `${label}: reference map cache is not ready`);
  assert.equal(renderState.worldBoundaryLayer, "country", `${label}: country boundaries are unavailable`);
  assert.ok(renderState.worldBoundaryRingCount >= 400, `${label}: boundary geometry is incomplete`);
  assert.ok(
    renderState.cyanLinePixels >= minimumCyanLinePixels,
    `${label}: coastline/country line signature disappeared ${JSON.stringify(renderState)}`,
  );
};

const boot = async (viewport, { startStatic = false, boundaryDelayMs = 0 } = {}) => {
  const context = await browser.newContext({ viewport, colorScheme: "dark", reducedMotion: "no-preference" });
  const page = await context.newPage();
  if (boundaryDelayMs > 0) {
    await page.route("**/data/natural-earth-50m-*.geojson*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, boundaryDelayMs));
      await route.continue();
    });
  }
  await page.addInitScript(({ shouldStartStatic }) => {
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
    sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    if (shouldStartStatic) {
      window.addEventListener("gaia:app-ready", () => {
        globalThis.GaiaFrameBudgetGovernor?.setLevel?.("static", "browser-test-early-static");
        document.documentElement.dataset.earlyStaticTest = "armed";
      }, { once: true });
    }
  }, { shouldStartStatic: startStatic });
  const label = viewport.name;
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
  await page.goto(new URL("/?mode=1", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.GaiaModeLoader?.load === "function");
  await page.evaluate(() => window.GaiaModeLoader.load("exploration"));
  await page.waitForFunction(() => window.GaiaAppContent?.modes?.length === 9);
  await page.waitForFunction(() => document.querySelectorAll("#mode-list .mode-button").length === 9);
  await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
  assert.equal(await page.locator("#intro-mode-list .intro-mode-choice").count(), 9);
  assert.equal(await page.locator("#intro-mode-list .intro-mode-choice").last().locator("span").nth(1).innerText(), "09");
  await page.evaluate(() => {
    document.body.classList.remove("gaia-opening-active");
    for (const selector of ["#gaia-opening", "#intro-layer", "#novel-layer", "#true-end-layer"]) {
      const layer = document.querySelector(selector);
      if (!layer) continue;
      layer.hidden = true;
      layer.inert = true;
      layer.setAttribute("aria-hidden", "true");
    }
    document.querySelector(".experience")?.classList.remove("intro-open");
  });
  await page.locator("#japan-button").evaluate((button) => button.click());
  try {
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      appReady: document.documentElement.dataset.gaiaAppReady || "",
      lod: document.documentElement.dataset.gaiaLod || "",
      mapState: globalThis.GaiaMapObservationAdapter?.getState?.() || null,
      japanHidden: document.querySelector("#japan-layer")?.hidden,
      japanAriaHidden: document.querySelector("#japan-layer")?.getAttribute("aria-hidden"),
      sceneHidden: document.querySelector("#scene-transition")?.hidden,
      sceneTransitioning: document.body.classList.contains("scene-transitioning"),
      activeElement: document.activeElement?.id || document.activeElement?.className || "",
    }));
    throw new Error(`${label}: map did not open: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  await page.waitForFunction(() => document.querySelector("#scene-transition")?.hidden
    && !document.body.classList.contains("scene-transitioning"));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("gaia:opening-complete")));
  await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) >= 1);
  assert.equal(await page.locator(".map-mode-bank .map-mode-button[data-map-standard-index]").count(), 9);
  assert.equal(await page.locator("#concept-mode-list .concept-mode-button").count(), 9);
  assert.equal(await page.locator("#error-panel").isHidden(), true);
  return { context, page };
};

try {
  for (const viewport of viewports) {
    const { context, page } = await boot(viewport);
    const scan = { viewport, clicks: {}, screenshots: [], zoom: {} };

    if (quantitativeLegendsOnly) {
      const expectations = [
        { index: 0, title: "地球の一呼吸", id: "co2-concentration" },
        { index: 1, title: "海流が14日続いたら", id: "ocean-current-speed" },
        { index: 2, title: "森林と降水量を重ねる", id: "precipitation" },
        { index: 3, title: "再資源化率を比べる", id: "recycling-rate" },
        { index: 4, title: "人類世の傷跡", id: "fossil-co2" },
        { index: 5, title: "地球からのメッセージ", id: "earthquake-magnitude" },
        { index: 7, title: "人工物の共生化", id: "renewable-electricity" },
        { index: 8, title: "人口のうねり", id: "population" },
      ];
      scan.quantitativeLegends = [];
      for (const expectation of expectations) {
        await selectMode(page, expectation.index, expectation.title);
        await page.waitForFunction(({ id }) => {
          const overlay = document.querySelector("#japan-overlay");
          const progress = Number(overlay?.dataset.quantitativeLegendProgress);
          return !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning")
            && overlay?.dataset.quantitativeLegendId === id
            && overlay.dataset.auxiliaryPanelId === `quantitative-${id}`
            && Number.isFinite(progress)
            && progress >= 0
            && progress <= 1;
        }, { id: expectation.id }, { timeout: 12_000 });
        const observed = await page.locator("#japan-overlay").evaluate((overlay) => ({
          id: overlay.dataset.quantitativeLegendId || "",
          title: overlay.dataset.quantitativeLegendTitle || "",
          current: overlay.dataset.quantitativeLegendCurrent || "",
          minimum: overlay.dataset.quantitativeLegendMinimum || "",
          maximum: overlay.dataset.quantitativeLegendMaximum || "",
          progress: Number(overlay.dataset.quantitativeLegendProgress),
          panelId: overlay.dataset.auxiliaryPanelId || "",
          left: Number(overlay.dataset.auxiliaryPanelScreenLeft),
          top: Number(overlay.dataset.auxiliaryPanelScreenTop),
          right: Number(overlay.dataset.auxiliaryPanelScreenRight),
          bottom: Number(overlay.dataset.auxiliaryPanelScreenBottom),
          legendClearance: overlay.dataset.auxiliaryPanelLegendClearance || "",
          map: document.querySelector("#japan-map")?.getBoundingClientRect().toJSON(),
        }));
        assert.equal(observed.id, expectation.id);
        assert(observed.title.length >= 4, `${viewport.name}/${expectation.id}: legend title is empty`);
        assert(observed.current.length >= 3, `${viewport.name}/${expectation.id}: current value is empty`);
        assert(observed.minimum.length >= 2 && observed.maximum.length >= 2, `${viewport.name}/${expectation.id}: range labels are empty`);
        assert(observed.left >= observed.map.left - 1 && observed.right <= observed.map.right + 1, `${viewport.name}/${expectation.id}: panel left the map horizontally`);
        assert(observed.top >= observed.map.top - 1 && observed.bottom <= observed.map.bottom + 1, `${viewport.name}/${expectation.id}: panel left the map vertically`);
        if (viewport.width < 680) {
          assert(observed.top >= observed.map.top + 220, `${viewport.name}/${expectation.id}: panel is hidden behind the mobile title/timeline controls`);
        }
        if (observed.legendClearance !== "legend-hidden") {
          assert(Number(observed.legendClearance) >= 8, `${viewport.name}/${expectation.id}: panel overlaps the map encoding legend`);
        }
        const screenshot = path.join(outputDir, `${viewport.name}-${String(expectation.index + 1).padStart(2, "0")}-${expectation.id}-legend.png`);
        await page.screenshot({ path: screenshot });
        scan.screenshots.push(screenshot);
        scan.quantitativeLegends.push(observed);
      }
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (guideOrderOnly) {
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.open?.("map", { force: true }));
      await page.waitForFunction(() => globalThis.GaiaModeEntryGuide?.getState?.().active === true);
      scan.guideSteps = [];
      for (let index = 0; index < 5; index += 1) {
        await page.waitForFunction((stepIndex) => globalThis.GaiaModeEntryGuide?.getState?.().index === stepIndex, index);
        await page.waitForFunction((stepNumber) => (
          Number(document.querySelector("[data-mode-guide-step]")?.textContent || 0) === stepNumber
          && Boolean(document.querySelector("[data-mode-guide-title]")?.textContent?.trim())
        ), index + 1);
        await page.waitForTimeout(420);
        const step = await page.evaluate(() => {
          const target = document.querySelector(".is-gaia-mode-guide-target");
          const rect = target?.getBoundingClientRect();
          return {
            title: document.querySelector("[data-mode-guide-title]")?.textContent?.trim() || "",
            current: Number(document.querySelector("[data-mode-guide-step]")?.textContent || 0),
            total: Number(document.querySelector("[data-mode-guide-total]")?.textContent || 0),
            centerX: rect ? rect.left + rect.width / 2 : -1,
            targetClass: target?.className || target?.id || "",
          };
        });
        scan.guideSteps.push(step);
        if (index === 0 || index === 4) {
          const screenshot = path.join(outputDir, `pc-guide-${String(index + 1).padStart(2, "0")}.png`);
          await page.screenshot({ path: screenshot });
          scan.screenshots.push(screenshot);
        }
        if (index < 4) await page.locator("#gaia-mode-entry-guide").click({ position: { x: 8, y: 8 } });
      }
      assert.deepEqual(scan.guideSteps.map((step) => step.title), [
        "展示を選ぶ",
        "年代をたどる",
        "問いを読む",
        "データの出典を確認する",
        "データを詳しく分析する",
      ]);
      assert(scan.guideSteps.every((step) => step.total === 5), `guide does not expose all five left-to-right steps: ${JSON.stringify(scan.guideSteps)}`);
      for (let index = 1; index < scan.guideSteps.length; index += 1) {
        assert(scan.guideSteps[index].centerX >= scan.guideSteps[index - 1].centerX - 2, `guide moved back to the left: ${JSON.stringify(scan.guideSteps)}`);
      }
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (bubbleOnly) {
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      if (viewport.width < 600) {
        await selectMode(page, 4, "人類世の傷跡");
      } else {
        await selectMode(page, 2, "森林と降水量を重ねる");
      }
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.selectionLabelShape === "observation-card"
          && overlay.dataset.selectionLabelTypography === "mincho";
      });
      await page.waitForTimeout(500);
      scan.selectionBubble = await page.locator("#japan-overlay").evaluate((element) => ({
        shape: element.dataset.selectionLabelShape,
        typography: element.dataset.selectionLabelTypography,
        lines: JSON.parse(element.dataset.selectionLabelLines),
        shadowBlur: Number(element.dataset.selectionLabelShadowBlur),
        width: Number(element.dataset.selectionLabelWidthPx),
        height: Number(element.dataset.selectionLabelHeightPx),
      }));
      assert.equal(scan.selectionBubble.shape, "observation-card");
      assert.equal(scan.selectionBubble.typography, "mincho");
      assert.equal(scan.selectionBubble.shadowBlur, 0);
      assert.deepEqual([...new Set(scan.selectionBubble.lines.map(line => line.index))], [0, 1, 2]);
      assert.ok(scan.selectionBubble.width > 0 && scan.selectionBubble.height > 0);
      const screenshot = path.join(outputDir, `${viewport.name}-03-selection-observation-card.png`);
      await page.locator("#japan-map").screenshot({ path: screenshot });
      scan.screenshots.push(screenshot);
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (circulationOnly) {
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      await selectMode(page, 1, "海流が14日続いたら");
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle");
      await page.waitForFunction(() => {
        const canvas = document.querySelector("#gaia-canvas");
        const overlay = document.querySelector("#japan-overlay");
        return canvas?.dataset.currentAllVisiblePoiPainted === "true"
          && canvas.dataset.currentDirectionTransform === "noaa-east-north-to-gl-local-positive-rotation"
          && Number(canvas.dataset.currentVisiblePoiCount) > 0
          && Number(overlay?.dataset.currentPoiMarkerCount) === Number(canvas.dataset.currentVisiblePoiCount);
      });
      await page.waitForFunction(() => document.querySelector("#gaia-canvas")?.dataset.currentWeaveState === "ready");
      await page.waitForTimeout(1000);
      scan.circulationDirection = await page.evaluate(() => ({
        transform: document.querySelector("#gaia-canvas")?.dataset.currentDirectionTransform,
        coverageMode: document.querySelector("#gaia-canvas")?.dataset.currentCoverageMode,
        interpolationSource: document.querySelector("#gaia-canvas")?.dataset.currentInterpolationSource,
        renderedSamples: Number(document.querySelector("#gaia-canvas")?.dataset.currentRenderedSampleCount),
        markerCount: Number(document.querySelector("#japan-overlay")?.dataset.currentPoiMarkerCount),
        title: document.querySelector("#japan-title")?.textContent || "",
        weave: { ...document.querySelector("#gaia-canvas").dataset },
      }));
      assert.equal(scan.circulationDirection.transform, "noaa-east-north-to-gl-local-positive-rotation");
      assert.equal(scan.circulationDirection.coverageMode, "gapless-idw-vector-field");
      assert.equal(scan.circulationDirection.interpolationSource, "inverse-distance-weighted-noaa-vectors");
      assert(scan.circulationDirection.renderedSamples > 0);
      assert.equal(scan.circulationDirection.markerCount, scan.circulationDirection.renderedSamples);
      assert.equal(scan.circulationDirection.title, "海流が14日続いたら");
      const weave = scan.circulationDirection.weave;
      assert.equal(weave.currentWeaveSourceCount, weave.currentVectorCount);
      assert.equal(weave.currentWeaveMethod, "cached-rk2-streamline-convolution");
      assert.equal(weave.currentWeaveSize, "1024x512");
      assert.equal(weave.currentWeaveGeneration, "1");
      assert.match(await page.locator("[data-signal-encoding-legend]").textContent(), /観測点間の補間/u);
      const screenshot = path.join(outputDir, `${viewport.name}-02-current-direction-aligned.png`);
      await page.screenshot({ path: screenshot });
      scan.screenshots.push(screenshot);
      scan.clicks.circulation = await clickDataPoint(page, "blue-circulation");
      assert.match(scan.clicks.circulation.card.meta, /m\/s/u);
      await closeDataCard(page);
      await page.evaluate(() => {
        GaiaMapObservationAdapter.setSignalTime(100);
        GaiaMapObservationAdapter.zoomEarthBy(1.1);
      });
      await page.waitForTimeout(1000);
      const after = await page.locator("#gaia-canvas").evaluate((canvas) => ({ ...canvas.dataset }));
      assert.equal(after.currentWeaveGeneration, weave.currentWeaveGeneration, "Zoom/date changes must reuse the geographic field");
      assert.equal(after.currentWeaveSourceCount, weave.currentWeaveSourceCount);
      assert.equal(after.currentMeanSpeedMs, weave.currentMeanSpeedMs, "Interpolation must not change source statistics");
      assert.ok(Number(after.currentAmbientPhase) > Number(weave.currentAmbientPhase), "Pigment keeps moving independently of the timeline");
      const zoomScreenshot = path.join(outputDir, `${viewport.name}-02-current-weave-zoom.png`);
      await page.screenshot({ path: zoomScreenshot });
      scan.screenshots.push(zoomScreenshot);
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (anthropoceneOnly) {
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      await selectMode(page, 4, "人類世の傷跡");
      const timeline = page.locator("#japan-layer [data-signal-time]").first();
      await timeline.evaluate((input) => {
        input.value = input.min;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.emissionsSelectedYear === "1945"
          && overlay.dataset.emissionsGeometry === "natural-earth-country-choropleth"
          && overlay.dataset.emissionsHitSurface === "country-regions"
          && Number(overlay.dataset.emissionsVisibleCountryFillCount) >= 20;
      });
      await page.waitForTimeout(700);
      const historical = await readAnthropoceneSnapshot(page);
      assert.equal(historical.year, 1945);
      assert.equal(historical.encoding, "country-fixed-log-color");
      assert.equal(historical.geometry, "natural-earth-country-choropleth");
      assert.equal(historical.hitSurface, "country-regions");
      assert.equal(historical.scaleMtCo2, 12000);
      assert.ok(historical.countryCount >= 20 && historical.countryCount < 31);
      const historicalScreenshot = path.join(outputDir, `${viewport.name}-05-emissions-1945-heatmap.png`);
      await page.screenshot({ path: historicalScreenshot });
      scan.screenshots.push(historicalScreenshot);

      await timeline.evaluate((input) => {
        input.value = input.max;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.emissionsSelectedYear === "2023"
          && Number(overlay.dataset.emissionsVisibleCountryFillCount) >= 30;
      });
      await page.waitForTimeout(700);
      const modern = await readAnthropoceneSnapshot(page);
      assert.equal(modern.year, 2023);
      assert.equal(modern.countryCount, 31);
      assert.equal(modern.encoding, "country-fixed-log-color");
      assert.equal(modern.geometry, "natural-earth-country-choropleth");
      assert.equal(modern.hitSurface, "country-regions");
      assert.ok(modern.visibleCountryCount > historical.visibleCountryCount);
      assert.ok(modern.heatSum > historical.heatSum * 1.3);
      assert.ok(modern.totalMtCo2 > historical.totalMtCo2 * 7);
      assert.ok(modern.maximumHeat > historical.maximumHeat);
      await waitForMapGuide(page);
      assert.match(
        await page.locator("#map-guide-reading").textContent(),
        /国土の色.*固定対数尺度.*濃紺.*淡黄.*2016/u,
      );
      const modernScreenshot = path.join(outputDir, `${viewport.name}-05-emissions-2023-heatmap.png`);
      await page.screenshot({ path: modernScreenshot });
      scan.screenshots.push(modernScreenshot);
      scan.clicks.anthropocene = await clickDataPoint(page, "anthropocene-scar");
      assert.match(scan.clicks.anthropocene.card.type, /人類世の傷跡 · 観測データ/u);
      assert.match(scan.clicks.anthropocene.card.meta, /2023年.*Mt CO₂.*化石燃料・セメント由来/u);
      scan.anthropoceneTimelineComparison = { historical, modern };
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (earthquakeOnly) {
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      await selectMode(page, 5, "地球からのメッセージ");
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.earthquakeYear === "2000");
      await page.waitForFunction(
        () => {
          const overlay = document.querySelector("#japan-overlay");
          return Number(overlay?.dataset.earthquakeVisibleEventCount) === 1
            && Number(overlay?.dataset.earthquakeActiveEventProgress) >= 0.25;
        },
      );
      scan.earthquakeInitialFirst = await page.locator("#japan-overlay").evaluate((element) => ({
        year: element.dataset.earthquakeYear,
        total: Number(element.dataset.earthquakeYearEventCount),
        visible: Number(element.dataset.earthquakeVisibleEventCount),
        activeIndex: Number(element.dataset.earthquakeActiveEventIndex),
        activeOccurredAt: element.dataset.earthquakeActiveEventOccurredAt,
        orderedTimes: (element.dataset.earthquakeOrderedEventTimes || "").split(",").filter(Boolean),
        order: element.dataset.earthquakeRevealOrder,
        mode: element.dataset.earthquakeYearTransitionMode,
        phase: element.dataset.earthquakeYearTransitionPhase,
        staggerMs: Number(element.dataset.earthquakeEventStaggerMs),
        appearMs: Number(element.dataset.earthquakeEventAppearMs),
        cameraMode: element.dataset.earthquakeCameraMode,
        cameraState: element.dataset.earthquakeCameraState,
        cameraEventIndex: Number(element.dataset.earthquakeCameraEventIndex),
        cameraOccurredAt: element.dataset.earthquakeCameraEventOccurredAt,
        cameraFlyMs: Number(element.dataset.earthquakeCameraFlyMs),
        cameraHoldMs: Number(element.dataset.earthquakeCameraHoldMs),
        eventHoldMs: Number(element.dataset.earthquakeEventHoldMs),
        cameraReturnDelayMs: Number(element.dataset.earthquakeCameraReturnDelayMs),
        cameraReturnMs: Number(element.dataset.earthquakeCameraReturnMs),
        viewTarget: element.dataset.viewTarget,
        zoom: Number(element.dataset.earthZoom),
      }));
      assert.equal(scan.earthquakeInitialFirst.year, "2000");
      assert.equal(scan.earthquakeInitialFirst.total, 7);
      assert.equal(scan.earthquakeInitialFirst.visible, 1);
      assert.equal(scan.earthquakeInitialFirst.activeIndex, 0);
      assert.equal(scan.earthquakeInitialFirst.activeOccurredAt, scan.earthquakeInitialFirst.orderedTimes[0]);
      assert.deepEqual(
        scan.earthquakeInitialFirst.orderedTimes,
        [...scan.earthquakeInitialFirst.orderedTimes].sort(),
        "initial earthquake sequence is not chronological",
      );
      assert.equal(scan.earthquakeInitialFirst.order, "occurred-at-ascending");
      assert.equal(scan.earthquakeInitialFirst.mode, "chronological-in-simultaneous-fade-out");
      assert.equal(scan.earthquakeInitialFirst.phase, "enter");
      assert.equal(scan.earthquakeInitialFirst.staggerMs, 4180);
      assert.equal(scan.earthquakeInitialFirst.appearMs, 460);
      assert.equal(scan.earthquakeInitialFirst.cameraMode, "chronological-epicenter-flyover");
      assert.equal(scan.earthquakeInitialFirst.cameraState, "following-epicenter");
      assert.equal(scan.earthquakeInitialFirst.cameraEventIndex, 0);
      assert.equal(scan.earthquakeInitialFirst.cameraOccurredAt, scan.earthquakeInitialFirst.orderedTimes[0]);
      assert.equal(scan.earthquakeInitialFirst.cameraFlyMs, 780);
      assert.equal(scan.earthquakeInitialFirst.cameraHoldMs, 2000);
      assert.equal(scan.earthquakeInitialFirst.eventHoldMs, 2000);
      assert.equal(scan.earthquakeInitialFirst.cameraReturnDelayMs, 2440);
      assert.equal(scan.earthquakeInitialFirst.cameraReturnMs, 620);
      assert.equal(scan.earthquakeInitialFirst.viewTarget, "earthquake-2000-1");
      assert.ok(scan.earthquakeInitialFirst.zoom > 1.01, `earthquake camera did not start zooming: ${scan.earthquakeInitialFirst.zoom}`);
      await page.waitForFunction(
        () => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle"
          && Number(document.querySelector("#japan-overlay")?.dataset.earthquakeCameraEventIndex) === 0,
      );
      await page.waitForTimeout(1650);
      scan.earthquakeInitialHold = await page.locator("#japan-overlay").evaluate((element) => ({
        eventIndex: Number(element.dataset.earthquakeCameraEventIndex),
        viewTarget: element.dataset.viewTarget,
        viewAnimation: element.dataset.viewAnimation,
      }));
      assert.equal(scan.earthquakeInitialHold.eventIndex, 0, "first epicenter did not stay after camera arrival");
      assert.equal(scan.earthquakeInitialHold.viewTarget, "earthquake-2000-1");
      assert.equal(scan.earthquakeInitialHold.viewAnimation, "idle");
      const initialFirstScreenshot = path.join(outputDir, `${viewport.name}-06-initial-2000-first-event.png`);
      await page.screenshot({ path: initialFirstScreenshot });
      scan.screenshots.push(initialFirstScreenshot);
      await page.waitForFunction(
        () => Number(document.querySelector("#japan-overlay")?.dataset.earthquakeVisibleEventCount) >= 4,
      );
      await page.waitForFunction(
        () => Number(document.querySelector("#japan-overlay")?.dataset.earthquakeCameraEventIndex) >= 3
          && Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) > 2,
      );
      const initialSequenceScreenshot = path.join(outputDir, `${viewport.name}-06-initial-2000-sequence.png`);
      await page.screenshot({ path: initialSequenceScreenshot });
      scan.screenshots.push(initialSequenceScreenshot);
      await page.waitForFunction(
        () => Number(document.querySelector("#japan-overlay")?.dataset.earthquakeVisibleEventCount) === 7
          && Number(document.querySelector("#japan-overlay")?.dataset.earthquakeYearTransitionProgress) >= 0.999
          && Number(document.querySelector("#japan-overlay")?.dataset.earthquakeCameraEventIndex) === 6
          && document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle",
      );
      scan.earthquakeFinalEpicenter = await page.locator("#japan-overlay").evaluate((element) => ({
        state: element.dataset.earthquakeCameraState,
        eventIndex: Number(element.dataset.earthquakeCameraEventIndex),
        screenX: Number(element.dataset.earthquakeCameraEventScreenX),
        screenY: Number(element.dataset.earthquakeCameraEventScreenY),
        targetX: Number(element.dataset.earthquakeCameraTargetX),
        targetY: Number(element.dataset.earthquakeCameraTargetY),
        zoom: Number(element.dataset.earthZoom),
      }));
      assert.equal(scan.earthquakeFinalEpicenter.state, "following-epicenter");
      assert.equal(scan.earthquakeFinalEpicenter.eventIndex, 6);
      assert.ok(scan.earthquakeFinalEpicenter.zoom > 2.2);
      assert.ok(
        Math.hypot(
          scan.earthquakeFinalEpicenter.screenX - scan.earthquakeFinalEpicenter.targetX,
          scan.earthquakeFinalEpicenter.screenY - scan.earthquakeFinalEpicenter.targetY,
        ) < 3,
        `final epicenter is not centered: ${JSON.stringify(scan.earthquakeFinalEpicenter)}`,
      );
      const initialSettledScreenshot = path.join(outputDir, `${viewport.name}-06-initial-2000-settled.png`);
      await page.screenshot({ path: initialSettledScreenshot });
      scan.screenshots.push(initialSettledScreenshot);
      await page.waitForFunction(
        () => document.querySelector("#japan-overlay")?.dataset.earthquakeCameraState === "global-overview"
          && Number(document.querySelector("#japan-overlay")?.dataset.earthZoom) <= 1.01,
      );
      scan.earthquakeInitialOverview = await page.locator("#japan-overlay").evaluate((element) => ({
        state: element.dataset.earthquakeCameraState,
        zoom: Number(element.dataset.earthZoom),
        viewTarget: element.dataset.viewTarget,
      }));
      assert.equal(scan.earthquakeInitialOverview.state, "global-overview");
      assert.ok(scan.earthquakeInitialOverview.zoom <= 1.01);
      assert.equal(scan.earthquakeInitialOverview.viewTarget, "global");
      const initialOverviewScreenshot = path.join(outputDir, `${viewport.name}-06-initial-2000-global-overview.png`);
      await page.screenshot({ path: initialOverviewScreenshot });
      scan.screenshots.push(initialOverviewScreenshot);
      const automaticStartedAt = Date.now();
      await page.waitForFunction(
        () => document.querySelector("#japan-overlay")?.dataset.earthquakeYear === "2001",
        null,
        { timeout: 9000 },
      );
      scan.earthquakeAutomaticAdvanceMs = Date.now() - automaticStartedAt;
      assert.ok(
        scan.earthquakeAutomaticAdvanceMs < 9000,
        `earthquake year did not auto-advance promptly: ${scan.earthquakeAutomaticAdvanceMs}ms`,
      );
      await page.waitForFunction(
        () => {
          const overlay = document.querySelector("#japan-overlay");
          return Number(overlay?.dataset.earthquakeVisibleEventCount) === 1
            && Number(overlay?.dataset.earthquakeActiveEventProgress) >= 0.25;
        },
      );
      scan.earthquakeAutoTransition = await page.locator("#japan-overlay").evaluate((element) => ({
        playback: element.dataset.earthquakeTimelinePlayback,
        dwellMs: Number(element.dataset.earthquakeYearDwellMs),
        transitionMs: Number(element.dataset.earthquakeYearTransitionMs),
        progress: Number(element.dataset.earthquakeYearTransitionProgress),
        to: element.dataset.earthquakeYearTransitionTo,
        visible: Number(element.dataset.earthquakeVisibleEventCount),
        activeIndex: Number(element.dataset.earthquakeActiveEventIndex),
        activeOccurredAt: element.dataset.earthquakeActiveEventOccurredAt,
        orderedTimes: (element.dataset.earthquakeOrderedEventTimes || "").split(",").filter(Boolean),
        displayKey: document.querySelector("#co2-timeline-display")?.dataset.timeTransitionKey,
      }));
      assert.equal(scan.earthquakeAutoTransition.playback, "auto-loop");
      assert.equal(scan.earthquakeAutoTransition.dwellMs, 30400);
      assert.equal(scan.earthquakeAutoTransition.transitionMs, 26820);
      assert.equal(scan.earthquakeAutoTransition.to, "2001");
      assert.equal(scan.earthquakeAutoTransition.visible, 1);
      assert.equal(scan.earthquakeAutoTransition.activeIndex, 0);
      assert.equal(scan.earthquakeAutoTransition.activeOccurredAt, scan.earthquakeAutoTransition.orderedTimes[0]);
      assert.ok(scan.earthquakeAutoTransition.progress > 0 && scan.earthquakeAutoTransition.progress < 1);
      assert.equal(scan.earthquakeAutoTransition.displayKey, "rhythm-of-disaster:2001");
      const autoTransitionScreenshot = path.join(outputDir, `${viewport.name}-06-auto-2001-first-event.png`);
      await page.screenshot({ path: autoTransitionScreenshot });
      scan.screenshots.push(autoTransitionScreenshot);
      await page.waitForFunction(
        () => Number(document.querySelector("#japan-overlay")?.dataset.earthquakeVisibleEventCount) >= 4,
      );
      const autoSequenceScreenshot = path.join(outputDir, `${viewport.name}-06-auto-2001-sequence.png`);
      await page.screenshot({ path: autoSequenceScreenshot });
      scan.screenshots.push(autoSequenceScreenshot);
      const earthquakeSlider = page.locator("#japan-layer [data-signal-time]").first();
      await earthquakeSlider.evaluate((element) => {
        element.value = String(((4 + 0.1) / 27) * 100);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.earthquakeYearTransitionPhase === "exit"
          && overlay.dataset.earthquakeYearTransitionTo === "2004"
          && Number(overlay.dataset.earthquakeActiveEventProgress) > 0.18;
      });
      scan.earthquakeSequentialExit = await page.locator("#japan-overlay").evaluate((element) => ({
        displayedYear: element.dataset.earthquakeYear,
        targetYear: element.dataset.earthquakeYearTransitionTo,
        phase: element.dataset.earthquakeYearTransitionPhase,
        order: element.dataset.earthquakeExitOrder,
        staggerMs: Number(element.dataset.earthquakeEventExitStaggerMs),
        disappearMs: Number(element.dataset.earthquakeEventDisappearMs),
        visible: Number(element.dataset.earthquakeVisibleEventCount),
        orderedTimes: (element.dataset.earthquakeExitOrderedEventTimes || "").split(",").filter(Boolean),
      }));
      assert.equal(scan.earthquakeSequentialExit.displayedYear, "2001");
      assert.equal(scan.earthquakeSequentialExit.targetYear, "2004");
      assert.equal(scan.earthquakeSequentialExit.phase, "exit");
      assert.equal(scan.earthquakeSequentialExit.order, "simultaneous");
      assert.equal(scan.earthquakeSequentialExit.staggerMs, 0);
      assert.equal(scan.earthquakeSequentialExit.disappearMs, 320);
      assert.deepEqual(
        scan.earthquakeSequentialExit.orderedTimes,
        [...scan.earthquakeSequentialExit.orderedTimes].sort(),
        "outgoing events retain their source order while fading together",
      );
      const sequentialExitScreenshot = path.join(outputDir, `${viewport.name}-06-sequential-pop-out.png`);
      await page.screenshot({ path: sequentialExitScreenshot });
      scan.screenshots.push(sequentialExitScreenshot);
      const exitVisibleCounts = [];
      for (let sampleIndex = 0; sampleIndex < 12; sampleIndex += 1) {
        const exitSample = await page.locator("#japan-overlay").evaluate((element) => ({
          phase: element.dataset.earthquakeYearTransitionPhase,
          visible: Number(element.dataset.earthquakeVisibleEventCount),
        }));
        if (exitSample.phase !== "exit") break;
        exitVisibleCounts.push(exitSample.visible);
        await page.waitForTimeout(70);
      }
      const exitCountDeltas = exitVisibleCounts.slice(1).map((count, index) => count - exitVisibleCounts[index]);
      assert(scan.earthquakeSequentialExit.visible > 0, "capture the simultaneous fade before the screenshot completes");
      assert(exitCountDeltas.every((delta) => delta <= 0), `earthquake POIs reappeared during fade-out: ${JSON.stringify(exitVisibleCounts)}`);
      scan.earthquakeSequentialExit.visibleCountSamples = exitVisibleCounts;
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.earthquakeYear === "2004");
      await page.waitForFunction(
        () => {
          const overlay = document.querySelector("#japan-overlay");
          return Number(overlay?.dataset.earthquakeVisibleEventCount) === 1
            && Number(overlay?.dataset.earthquakeActiveEventProgress) >= 0.25;
        },
      );
      await page.waitForFunction(() => /^2004年\d{1,2}月\d{1,2}日（[日月火水木金土]）午[前後]\d{1,2}時\d{2}分$/u.test(
        document.querySelector("#japan-overlay")?.dataset.earthquakeActiveLabelPrimary || "",
      ));
      scan.earthquakeManualFirst = await page.locator("#japan-overlay").evaluate((element) => ({
        visible: Number(element.dataset.earthquakeVisibleEventCount),
        activeIndex: Number(element.dataset.earthquakeActiveEventIndex),
        activeOccurredAt: element.dataset.earthquakeActiveEventOccurredAt,
        activeLabelPrimary: element.dataset.earthquakeActiveLabelPrimary,
        projection: element.dataset.earthquakeWaveProjection,
        markerStyle: element.dataset.earthquakeMarkerStyle,
        markerColor: element.dataset.earthquakeMarkerColor,
        markerLineWidth: Number(element.dataset.earthquakeMarkerMaxLineWidthPx),
        activeMagnitudeLabel: element.dataset.earthquakeActiveMagnitudeLabel,
        orderedTimes: (element.dataset.earthquakeOrderedEventTimes || "").split(",").filter(Boolean),
      }));
      assert.equal(scan.earthquakeManualFirst.visible, 1);
      assert.equal(scan.earthquakeManualFirst.activeIndex, 0);
      assert.equal(scan.earthquakeManualFirst.activeOccurredAt, scan.earthquakeManualFirst.orderedTimes[0]);
      assert.match(scan.earthquakeManualFirst.activeLabelPrimary, /^2004年\d{1,2}月\d{1,2}日（[日月火水木金土]）午[前後]\d{1,2}時\d{2}分$/u);
      assert.doesNotMatch(scan.earthquakeManualFirst.activeLabelPrimary, /^\d{2} \/ \d{2}/u);
      assert.equal(scan.earthquakeManualFirst.projection, "equirectangular-geodesic-distance");
      assert.equal(scan.earthquakeManualFirst.markerStyle, "red-heavy-cross");
      assert.equal(scan.earthquakeManualFirst.markerColor, "rgb(255,43,51)");
      assert.ok(scan.earthquakeManualFirst.markerLineWidth >= (viewport.width >= 2400 ? 7 : 4));
      assert.equal(scan.earthquakeManualFirst.activeMagnitudeLabel, "below-marker");
      const manualFirstScreenshot = path.join(outputDir, `${viewport.name}-06-manual-2004-first-event.png`);
      await page.screenshot({ path: manualFirstScreenshot });
      scan.screenshots.push(manualFirstScreenshot);
      await page.waitForFunction(
        () => {
          const overlay = document.querySelector("#japan-overlay");
          return overlay?.dataset.earthquakeYear === "2004"
            && Number(overlay.dataset.earthquakeVisibleEventCount) >= 2;
        },
      );
      const manualSequenceScreenshot = path.join(outputDir, `${viewport.name}-06-manual-2004-sequence.png`);
      await page.screenshot({ path: manualSequenceScreenshot });
      scan.screenshots.push(manualSequenceScreenshot);
      await page.waitForFunction(
        () => {
          const overlay = document.querySelector("#japan-overlay");
          return overlay?.dataset.earthquakeYear === "2004"
            && Number(overlay.dataset.earthquakeVisibleEventCount) === 3
            && overlay.dataset.earthquakeYearSummary === "hidden";
        },
      );
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await waitForReferenceMap(page);
      await page.waitForTimeout(500);
      scan.earthquakeYearSummary = await page.locator("#japan-overlay").evaluate((element) => ({
        status: element.dataset.earthquakeYearSummary,
        width: Number(element.dataset.earthquakeSelectionLabelWidthPx),
        height: Number(element.dataset.earthquakeSelectionLabelHeightPx),
        primaryFont: Number(element.dataset.earthquakeSelectionPrimaryFontPx),
        profile: element.dataset.earthquakeSelectionLabelProfile,
        eventCount: Number(element.dataset.earthquakeYearEventCount),
      }));
      assert.equal(scan.earthquakeYearSummary.eventCount, 3);
      assert.equal(scan.earthquakeYearSummary.status, "hidden");
      assert.equal(scan.earthquakeYearSummary.profile, undefined);
      assert.equal(scan.earthquakeYearSummary.width, 0);
      assert.equal(scan.earthquakeYearSummary.height, 0);
      assert.equal(scan.earthquakeYearSummary.primaryFont, 0);
      const screenshot = path.join(outputDir, `${viewport.name}-06-no-earthquake-year-summary.png`);
      await page.screenshot({ path: screenshot });
      scan.screenshots.push(screenshot);
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (map06CrossModeOnly) {
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      scan.loader = await page.locator('script[src*="gaia-mode-loader.js"]').getAttribute("src");
      assert.match(
        scan.loader || "",
        /gaia-mode-loader\.js\?v=gaia-statistics-workspace-1/u,
        `${viewport.name}: stale exploration loader cache key`,
      );

      const standardModes = [
        "地球の一呼吸",
        "海流が14日続いたら",
        "森林と降水量を重ねる",
        "再資源化率を比べる",
        "人類世の傷跡",
        "地球からのメッセージ",
        "三つの生態系",
        "人工物の共生化",
        "人口のうねり",
      ];
      const liveModes = ["風脈", "炭素の呼吸", "雨の記憶", "熱の輪郭", "雲の層"];
      const modeTitles = [...standardModes, ...liveModes];

      // The original failure accumulated an unbalanced canvas state in 05, then
      // first appeared on 06 and persisted on 07. Soak 05 before entering 06.
      await selectMode(page, 4, standardModes[4]);
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.plotRevealState === "complete");
      await page.waitForTimeout(1200);
      await selectMode(page, 5, standardModes[5]);
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await waitForReferenceMap(page);
      await page.waitForTimeout(500);
      scan.entry06 = await readMapRenderHealth(page);
      assert.equal(scan.entry06.activeNumber, "06");
      assert.equal(scan.entry06.liveMode, false);
      assert.equal(scan.entry06.liveBackdrop, "standard-mode");
      assert.ok(scan.entry06.nonTransparent > 1000, `05 → 06: map canvas is blank ${JSON.stringify(scan.entry06)}`);
      assertReferenceMapVisible(scan.entry06, "05 → 06 entry");
      const entryScreenshot = path.join(outputDir, `${viewport.name}-05-to-06-entry.png`);
      await page.screenshot({ path: entryScreenshot });
      scan.screenshots.push(entryScreenshot);

      scan.crossMode = [];
      for (const [index, title] of modeTitles.entries()) {
        if (index < standardModes.length) await selectMode(page, index, title);
        else await selectLiveMode(page, index, title);
        await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
        await waitForReferenceMap(page);
        await page.waitForTimeout(320);
        const renderState = await readMapRenderHealth(page);
        const number = String(index + 1).padStart(2, "0");
        assert.equal(renderState.activeNumber, number, `${number}: active chapter number drifted`);
        assert.equal(renderState.activeTitle, title, `${number}: active chapter title drifted`);
        assert.equal(renderState.liveMode, index >= standardModes.length, `${number}: live/standard layer state leaked`);
        assert.equal(
          renderState.liveBackdrop,
          index >= standardModes.length ? "reference-map-only" : "standard-mode",
          `${number}: reference map backdrop state is wrong`,
        );
        assert.ok(renderState.nonTransparent > 1000, `${number}: map canvas is blank ${JSON.stringify(renderState)}`);
        assertReferenceMapVisible(renderState, `06 → ${number}`, {
          minimumCyanLinePixels: index === 1 || index >= standardModes.length ? 180 : 650,
        });
        const screenshot = path.join(outputDir, `${viewport.name}-from-06-to-${number}.png`);
        await page.screenshot({ path: screenshot });
        scan.screenshots.push(screenshot);
        scan.crossMode.push({ number, title, renderState, screenshot });
      }

      // A live exhibit must not leave the standard map in the live-only state.
      await selectMode(page, 6, standardModes[6]);
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await waitForReferenceMap(page);
      await page.waitForTimeout(320);
      scan.returnTo07 = await readMapRenderHealth(page);
      assert.equal(scan.returnTo07.liveMode, false, "14 → 07: live exhibit class leaked");
      assert.equal(scan.returnTo07.liveBackdrop, "standard-mode", "14 → 07: live backdrop leaked");
      assertReferenceMapVisible(scan.returnTo07, "14 → 07 return");
      const returnScreenshot = path.join(outputDir, `${viewport.name}-14-to-07-return.png`);
      await page.screenshot({ path: returnScreenshot });
      scan.screenshots.push(returnScreenshot);

      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (highResolutionOnly) {
      await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      const renderCases = [
        { index: 5, title: "地球からのメッセージ" },
        { index: 6, title: "三つの生態系" },
        { index: 7, title: "人工物の共生化" },
        { index: 8, title: "人口のうねり" },
        { index: 5, title: "地球からのメッセージ", staticFallback: true },
        { index: 6, title: "三つの生態系", staticFallback: true },
        { index: 7, title: "人工物の共生化", staticFallback: true },
      ];
      for (const { index, title, staticFallback = false } of renderCases) {
        if (staticFallback) {
          await page.evaluate(() => globalThis.GaiaFrameBudgetGovernor?.setLevel?.("static", "browser-test"));
        }
        await selectMode(page, index, title);
        await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
        if (staticFallback) {
          await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.renderLoopMode === "static-fallback");
        }
        await waitForReferenceMap(page);
        await page.waitForTimeout(700);
        const renderState = await readMapRenderHealth(page);
        assert(renderState.nonTransparent > 1000, `${title}: map canvas is blank ${JSON.stringify(renderState)}`);
        assertReferenceMapVisible(renderState, `${title}${staticFallback ? " / static" : ""}`);
        const stateKey = `${staticFallback ? "staticMode" : "mode"}${String(index + 1).padStart(2, "0")}`;
        scan[stateKey] = renderState;
        const screenshot = path.join(
          outputDir,
          `high-resolution-${staticFallback ? "static-" : ""}${String(index + 1).padStart(2, "0")}.png`,
        );
        await page.screenshot({ path: screenshot });
        scan.screenshots.push(screenshot);
      }
      await context.close();

      const earlyStaticViewport = { ...viewport, name: `${viewport.name}-early-static` };
      const earlyStatic = await boot(earlyStaticViewport, {
        startStatic: true,
        boundaryDelayMs: 2200,
      });
      await earlyStatic.page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
      await earlyStatic.page.waitForFunction(() => (
        document.documentElement.dataset.earlyStaticTest === "armed"
        && document.querySelector("#japan-overlay")?.dataset.renderLoopMode === "static-fallback"
      ));
      await selectMode(earlyStatic.page, 6, "三つの生態系");
      await waitForReferenceMap(earlyStatic.page);
      await earlyStatic.page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await earlyStatic.page.waitForTimeout(700);
      scan.earlyStaticLoaded = await readMapRenderHealth(earlyStatic.page);
      assertReferenceMapVisible(scan.earlyStaticLoaded, "early static / delayed boundary load");

      scan.afterCanvasClear = await earlyStatic.page.locator("#japan-overlay").evaluate((overlay) => {
        overlay.width = overlay.width;
        const sample = document.createElement("canvas");
        sample.width = 24;
        sample.height = 14;
        const context2d = sample.getContext("2d", { willReadFrequently: true });
        context2d.drawImage(overlay, 0, 0, sample.width, sample.height);
        return context2d.getImageData(0, 0, sample.width, sample.height).data
          .some((channel, index) => index % 4 !== 3 && channel > 0);
      });
      assert.equal(scan.afterCanvasClear, false, "canvas clear simulation did not clear the rendered map");
      await earlyStatic.page.waitForTimeout(800);
      scan.afterCanvasRecovery = await readMapRenderHealth(earlyStatic.page);
      assertReferenceMapVisible(scan.afterCanvasRecovery, "early static / canvas recovery");

      for (const { index, title } of [
        { index: 5, title: "地球からのメッセージ" },
        { index: 7, title: "人工物の共生化" },
        { index: 6, title: "三つの生態系" },
      ]) {
        await selectMode(earlyStatic.page, index, title);
        await earlyStatic.page.waitForTimeout(90);
      }
      await earlyStatic.page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await earlyStatic.page.waitForTimeout(800);
      scan.afterRapidSwitch = await readMapRenderHealth(earlyStatic.page);
      assertReferenceMapVisible(scan.afterRapidSwitch, "early static / rapid exhibit switching");

      await earlyStatic.page.setViewportSize({ width: 2560, height: 1440 });
      await earlyStatic.page.waitForTimeout(700);
      await earlyStatic.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await earlyStatic.page.waitForTimeout(800);
      scan.afterResize = await readMapRenderHealth(earlyStatic.page);
      assertReferenceMapVisible(scan.afterResize, "early static / 4K resize recovery");
      const recoveryScreenshot = path.join(outputDir, "high-resolution-early-static-recovery.png");
      await earlyStatic.page.screenshot({ path: recoveryScreenshot });
      scan.screenshots.push(recoveryScreenshot);
      await earlyStatic.context.close();

      report.scans.push(scan);
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (populationOnly) {
      await selectMode(page, 8, "人口のうねり");
      const populationSlider = page.locator("#japan-layer [data-signal-time]").first();
      await populationSlider.press("End");
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.populationSelectedYear === "2025");
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.plotRevealState === "complete");
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await page.waitForTimeout(400);
      scan.population = await page.locator("#japan-overlay").evaluate((element) => ({
        count: Number(element.dataset.populationCircleCount),
        selectedScreenX: Number(element.dataset.populationSelectedScreenX),
        selectedScreenY: Number(element.dataset.populationSelectedScreenY),
        visibleCount: Number(element.dataset.populationVisibleCircleCount),
        year: element.dataset.populationSelectedYear,
      }));
      const screenshot = path.join(outputDir, `${viewport.name}-09-population-direct.png`);
      await page.screenshot({ path: screenshot });
      scan.screenshots.push(screenshot);
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (viewport.name === "pc") {
      const chapterGlintBounds = await page.evaluate(() => {
        const bank = document.querySelector(".map-command-dock > .map-mode-bank")?.getBoundingClientRect();
        const trigger = document.querySelector(".map-dock-bank-trigger")?.getBoundingClientRect();
        if (!bank || !trigger) return null;
        return {
          bank: { left: bank.left, top: bank.top, right: bank.right, bottom: bank.bottom },
          trigger: { left: trigger.left, top: trigger.top, right: trigger.right, bottom: trigger.bottom },
        };
      });
      assert(chapterGlintBounds, "pc: map chapter trigger is unavailable");
      for (const edge of ["left", "top", "right", "bottom"]) {
        assert(
          Math.abs(chapterGlintBounds.bank[edge] - chapterGlintBounds.trigger[edge]) < 1,
          `pc: map chapter glint ${edge} edge is inset from its panel: ${JSON.stringify(chapterGlintBounds)}`,
        );
      }
      await page.locator(".map-dock-bank-trigger").focus();
      await page.waitForFunction(() => document.querySelector(".gaia-global-button-glint")?.classList.contains("is-active"));
      const renderedGlintBounds = await page.locator(".gaia-global-button-glint").evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
      });
      for (const edge of ["left", "top", "right", "bottom"]) {
        assert(
          Math.abs(chapterGlintBounds.bank[edge] - renderedGlintBounds[edge]) < 1,
          `pc: rendered chapter glint ${edge} edge is misaligned: ${JSON.stringify({ chapterGlintBounds, renderedGlintBounds })}`,
        );
      }
      scan.chapterGlintBounds = { ...chapterGlintBounds, rendered: renderedGlintBounds };

      const guideHeadingSpacing = await page.locator(".map-command-dock .map-reading-guide > summary").evaluate((summary) => {
        const label = summary.querySelector(":scope > span")?.getBoundingClientRect();
        const bounds = summary.getBoundingClientRect();
        return {
          topInset: label ? label.top - bounds.top : -1,
          summaryTop: bounds.top,
          labelTop: label?.top ?? -1,
        };
      });
      assert(
        guideHeadingSpacing.topInset >= 6,
        `pc: map guide heading has no top breathing room: ${JSON.stringify(guideHeadingSpacing)}`,
      );
      scan.guideHeadingSpacing = guideHeadingSpacing;

      const guide = page.locator(".map-command-dock .map-reading-guide");
      const guideSummary = guide.locator(":scope > summary");
      const guideBody = guide.locator(".map-reading-guide-body");
      assert.equal(await guideBody.isVisible(), false, "pc: map guide explanation is visible without focus intent");
      await guideSummary.focus();
      await page.waitForFunction(() => document.querySelector(".map-command-dock .map-reading-guide")?.classList.contains("is-dock-guide-visible"));
      await page.waitForTimeout(380);
      const guideReadability = await guideBody.evaluate((body) => ({
        visible: body.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        width: body.getBoundingClientRect().width,
        copyFontSize: Number.parseFloat(getComputedStyle(body.querySelector("p")).fontSize),
        copyLineHeight: Number.parseFloat(getComputedStyle(body.querySelector("p")).lineHeight),
      }));
      assert.equal(guideReadability.visible, true, `pc: focused map guide is hidden: ${JSON.stringify(guideReadability)}`);
      assert.ok(guideReadability.width >= 900, `pc: focused map guide is too narrow: ${JSON.stringify(guideReadability)}`);
      assert.ok(guideReadability.copyFontSize >= 15, `pc: focused map guide copy remains too small: ${JSON.stringify(guideReadability)}`);
      assert.ok(guideReadability.copyLineHeight >= guideReadability.copyFontSize * 1.7, `pc: focused map guide lines are cramped: ${JSON.stringify(guideReadability)}`);
      const guideScreenshot = path.join(outputDir, "pc-map-guide-focus.png");
      await page.screenshot({ path: guideScreenshot, animations: "disabled" });
      scan.screenshots.push(guideScreenshot);
      await page.locator("#japan-close").focus();
      await page.waitForFunction(() => !document.querySelector(".map-command-dock .map-reading-guide")?.classList.contains("is-dock-guide-visible"));
      await page.waitForTimeout(340);
      assert.equal(await guideBody.isVisible(), false, "pc: map guide explanation remains after focus leaves");
      scan.guideReadability = guideReadability;

      await selectMode(page, 3, "再資源化率を比べる");
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.recyclingEncoding === "fixed-diameter-pie");
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.plotRevealState === "running"
          && Number(overlay.dataset.plotRevealProgress) > 0.08;
      });
      const poiHoverPoint = await findClickableDataPoint(page, "nothing-is-waste");
      assert(poiHoverPoint, "pc: no recycling POI was available for hover verification");
      await page.mouse.move(poiHoverPoint.clientX, poiHoverPoint.clientY);
      await page.waitForFunction(() => (
        document.querySelector("#japan-map")?.classList.contains("has-poi-hover")
        && document.querySelector("#japan-poi-preview")?.getAttribute("aria-hidden") === "false"
        && Number(document.querySelector("#japan-overlay")?.dataset.hoveredPoiProgress) >= 0.999
      ));
      const poiHover = await page.evaluate(() => {
        const map = document.querySelector("#japan-map");
        const preview = document.querySelector("#japan-poi-preview");
        const overlay = document.querySelector("#japan-overlay");
        const rect = preview.getBoundingClientRect();
        return {
          cursor: getComputedStyle(map).cursor,
          title: document.querySelector("#japan-poi-preview-title")?.textContent || "",
          meta: document.querySelector("#japan-poi-preview-meta")?.textContent || "",
          action: preview.querySelector(".japan-poi-preview-action")?.textContent?.replace(/\s+/gu, " ").trim() || "",
          pointerEvents: getComputedStyle(preview).pointerEvents,
          scale: Number(overlay.dataset.hoveredPoiScale),
          progress: Number(overlay.dataset.hoveredPoiProgress),
          rect: rect.toJSON(),
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      const poiCountryCode = String(poiHoverPoint.row.iso2 || poiHoverPoint.row.countryCode || "").toUpperCase();
      const expectedPoiTitle = poiHoverPoint.row.nameJa
        || poiHoverPoint.row.countryJa
        || (/^[A-Z]{2}$/u.test(poiCountryCode) ? new Intl.DisplayNames(["ja"], { type: "region" }).of(poiCountryCode) : "")
        || poiHoverPoint.row.name
        || poiHoverPoint.row.country
        || poiHoverPoint.row.iso3;
      assert.equal(poiHover.cursor, "pointer", `pc: POI cursor is not clickable: ${JSON.stringify(poiHover)}`);
      assert.equal(poiHover.pointerEvents, "none", "pc: preview intercepts the map pointer");
      assert.equal(poiHover.title, expectedPoiTitle, `pc: POI preview title is unclear: ${JSON.stringify(poiHover)}`);
      assert.match(poiHover.meta, new RegExp(`${poiHoverPoint.row.recyclePercent.toFixed(1).replace(".", "\\.")}%`, "u"));
      assert.match(poiHover.action, /クリックで詳しく見る/u);
      assert.ok(poiHover.scale >= 1.15 && poiHover.progress >= 0.999, `pc: POI did not animate to its enlarged focus state: ${JSON.stringify(poiHover)}`);
      assert.ok(
        poiHover.rect.left >= 0
          && poiHover.rect.top >= 0
          && poiHover.rect.right <= poiHover.viewport.width
          && poiHover.rect.bottom <= poiHover.viewport.height,
        `pc: POI preview is clipped: ${JSON.stringify(poiHover)}`,
      );
      const poiHoverScreenshot = path.join(outputDir, "pc-poi-hover-preview.png");
      await page.screenshot({ path: poiHoverScreenshot });
      scan.screenshots.push(poiHoverScreenshot);
      scan.poiHover = poiHover;

      await page.mouse.click(poiHoverPoint.clientX, poiHoverPoint.clientY);
      await page.waitForFunction(() => document.querySelector("#japan-poi-card")?.getAttribute("aria-hidden") === "false");
      assert.match(await page.locator("#japan-poi-meta").textContent(), /%/u, "pc: clicking a focused POI did not open its detail card");
      assert.equal(await page.locator("#japan-poi-preview").getAttribute("aria-hidden"), "true", "pc: hover preview remained over the detail card");
      await closeDataCard(page);
      await page.locator("#japan-close").hover();
      await page.waitForFunction(() => !document.querySelector("#japan-map")?.classList.contains("has-poi-hover"));
      assert.equal(await page.locator("#japan-overlay").getAttribute("data-hovered-poi-key"), null, "pc: POI focus state remained after pointer exit");
      await selectMode(page, 0, "地球の一呼吸");
    }

    if (glintOnly) {
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (countryReadoutOnly) {
      await selectMode(page, 6, "三つの生態系");
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.ecologiesPlot === "paired-country-scatter");
      await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.ecologiesSelectionTransitionProgress) >= 0.999);
      const initialAnimationState = await page.locator("#japan-overlay").evaluate((element) => ({
        country: element.dataset.ecologiesSelectedCountry,
        countryDisplayMs: Number(element.dataset.ecologiesCountryDisplayMs),
        transitionMs: Number(element.dataset.ecologiesSelectionTransitionMs),
      }));
      assert.ok(
        initialAnimationState.countryDisplayMs >= 3000 && initialAnimationState.countryDisplayMs <= 3200,
        `${viewport.name}: country display is not approximately doubled: ${JSON.stringify(initialAnimationState)}`,
      );
      assert.equal(initialAnimationState.transitionMs, 920, `${viewport.name}: country transition duration`);
      await page.evaluate(() => globalThis.GaiaMapObservationAdapter.setSignalTime(8));
      await page.waitForFunction((country) => {
        const overlay = document.querySelector("#japan-overlay");
        const progress = Number(overlay?.dataset.ecologiesSelectionTransitionProgress);
        return overlay?.dataset.ecologiesSelectedCountry !== country && progress >= 0 && progress < 0.5;
      }, initialAnimationState.country);
      await page.waitForTimeout(260);
      const midTransition = await page.locator("#japan-overlay").evaluate((element) => ({
        country: element.dataset.ecologiesSelectedCountry,
        progress: Number(element.dataset.ecologiesSelectionTransitionProgress),
      }));
      assert.notEqual(midTransition.country, initialAnimationState.country, `${viewport.name}: country did not advance`);
      assert.ok(
        midTransition.progress > 0 && midTransition.progress < 1,
        `${viewport.name}: label did not animate between countries: ${JSON.stringify(midTransition)}`,
      );
      const transitionScreenshot = path.join(outputDir, `${viewport.name}-07-country-readout-transition.png`);
      await page.screenshot({ path: transitionScreenshot, fullPage: false });
      await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.ecologiesSelectionTransitionProgress) >= 0.999);
      const countryReadout = await page.locator("#japan-layer [data-signal-value]").first().evaluate((element) => ({
        lines: element.innerText.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
        hasLocation: element.classList.contains("has-location"),
        whiteSpace: getComputedStyle(element).whiteSpace,
      }));
      assert.equal(countryReadout.hasLocation, true, `${viewport.name}: country readout is not marked as a location`);
      assert.equal(countryReadout.whiteSpace, "pre-line", `${viewport.name}: country readout does not preserve its line break`);
      assert.equal(countryReadout.lines.length, 2, `${viewport.name}: country and metrics are not split into two lines: ${JSON.stringify(countryReadout)}`);
      assert.equal(countryReadout.lines[0], await page.locator("#japan-overlay").getAttribute("data-ecologies-selected-country"));
      assert.match(countryReadout.lines[1], /^森林率 \d+\.\d% \/ 都市人口率 \d+\.\d%$/u);
      scan.countryReadout = { ...countryReadout, initialAnimationState, midTransition, transitionScreenshot };
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (recyclingOnly) {
      await selectMode(page, 3, "再資源化率を比べる");
      await waitForMapGuide(page);
      const slider = page.locator("#japan-layer [data-signal-time]").first();
      const initial = await page.locator("#japan-overlay").evaluate((element) => ({
        current: Number(element.dataset.recyclingSelectedRate),
        index: Number(element.dataset.recyclingSelectedIndex),
        status: element.dataset.recyclingSelectedStatus,
        hasScenarioRate: Object.hasOwn(element.dataset, "recyclingScenarioRate"),
      }));
      assert.equal(initial.index, 0, `${viewport.name}: initial country index`);
      assert.equal(initial.status, "official", `${viewport.name}: initial country status`);
      assert.equal(initial.hasScenarioRate, false, `${viewport.name}: visitor scenario dataset remains`);
      assert.match(await page.locator("#map-guide-action").textContent(), /左右ボタンかスライダーで31の国・地域/u);
      assert.doesNotMatch(await page.locator("#japan-layer").innerText(), /自分の目標|改善目標|黄色い外周|もしも/u);
      assert.match(await page.locator("#japan-layer [data-signal-time-label]").first().textContent(), /国・地域.*01→31/u);
      assert.equal(await slider.getAttribute("min"), "0");
      assert.equal(await slider.getAttribute("max"), "30");
      assert.equal(await slider.getAttribute("step"), "1");
      await slider.press("End");
      await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.recyclingSelectedIndex) === 30);
      const selectedText = await page.locator("#japan-layer [data-signal-value]").first().innerText();
      assert.match(selectedText, /再資源化率 \d+\.\d% \/ (?:国連公式値|補完値)/u);
      assert.match(await slider.getAttribute("aria-valuetext"), /31番目.*再資源化率.*(?:国連公式値|補完値)/u);
      if (viewport.name === "pc") {
        await page.locator('[data-map-dock-year-step="-1"]').click();
        await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.recyclingSelectedIndex) === 29);
        await page.waitForFunction(() => document.querySelector("[data-map-dock-year]")?.textContent === "30");
      }
      const settledPosition = Number(await slider.inputValue());
      await page.waitForTimeout(2_000);
      assert.equal(Number(await slider.inputValue()), settledPosition, `${viewport.name}: country selection resumed automatic motion`);
      const screenshot = path.join(outputDir, `${viewport.name}-04-recycling-country-selector.png`);
      await page.screenshot({ path: screenshot });
      scan.screenshots.push(screenshot);
      scan.recyclingCountrySelector = { initial, selectedIndex: settledPosition, manual: true };
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (renewableRevealOnly) {
      await selectMode(page, 0, "地球の一呼吸");
      await page.waitForFunction(() => (
        !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning")
        && document.querySelector("#japan-overlay")?.dataset.plotRevealState === "complete"
      ));
      await page.locator('.map-mode-bank [data-map-standard-index="7"]').evaluate((button) => button.click());
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning")
          && overlay?.dataset.titleSeparatorState === "running"
          && overlay?.dataset.plotRevealState === "waiting-for-separator"
          && overlay?.dataset.countryGeometryState === "ready"
          && Number(overlay.dataset.renewableCountryFillCount) === 0
          && overlay.dataset.renewableSelectedPoiVisible === "false"
          && overlay.dataset.renewableSelectionLabelVisible === "false";
      });
      await page.waitForTimeout(360);
      const separator = await page.locator("#japan-overlay").evaluate((overlay) => ({
        titleVisible: document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"),
        titleState: overlay.dataset.titleSeparatorState,
        plotState: overlay.dataset.plotRevealState,
        fills: Number(overlay.dataset.renewableCountryFillCount),
        visibleFills: Number(overlay.dataset.renewableVisibleCountryFillCount),
        selectedPoiVisible: overlay.dataset.renewableSelectedPoiVisible,
        labelVisible: overlay.dataset.renewableSelectionLabelVisible,
        titleEndsAt: Number(overlay.dataset.titleSeparatorEndsAt),
        firstPoiAt: Number(overlay.dataset.plotRevealFirstVisibleAt),
        allPoisAt: Number(overlay.dataset.plotRevealCompletedAt),
      }));
      assert.equal(separator.titleVisible, true, `${viewport.name}: title separator ended before the hold-frame assertion`);
      assert.equal(separator.fills, 0, `${viewport.name}: renewable countries appeared during title transition`);
      assert.equal(separator.visibleFills, 0, `${viewport.name}: renewable countries became visible during title transition`);
      assert.equal(separator.selectedPoiVisible, "false", `${viewport.name}: selected renewable POI appeared during title transition`);
      assert.equal(separator.labelVisible, "false", `${viewport.name}: renewable bubble appeared during title transition`);
      assert(separator.firstPoiAt > separator.titleEndsAt, `${viewport.name}: first renewable POI is not scheduled after the title`);
      assert(separator.allPoisAt > separator.firstPoiAt, `${viewport.name}: renewable bubble has no all-POI completion gate`);
      const separatorScreenshot = path.join(outputDir, `${viewport.name}-08-title-before-pois.png`);
      await page.screenshot({ path: separatorScreenshot });
      scan.screenshots.push(separatorScreenshot);

      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        const fills = Number(overlay?.dataset.renewableVisibleCountryFillCount);
        return overlay?.dataset.titleSeparatorState === "complete"
          && overlay?.dataset.plotRevealState === "running"
          && fills > 0
          && fills < 208;
      });
      const midReveal = await page.locator("#japan-overlay").evaluate((overlay) => ({
        state: overlay.dataset.plotRevealState,
        fills: Number(overlay.dataset.renewableCountryFillCount),
        visibleFills: Number(overlay.dataset.renewableVisibleCountryFillCount),
        selectedPoiVisible: overlay.dataset.renewableSelectedPoiVisible,
        labelVisible: overlay.dataset.renewableSelectionLabelVisible,
      }));
      assert.equal(midReveal.labelVisible, "false", `${viewport.name}: renewable bubble appeared before every country POI`);
      const midScreenshot = path.join(outputDir, `${viewport.name}-08-pois-revealing-before-bubble.png`);
      await page.screenshot({ path: midScreenshot });
      scan.screenshots.push(midScreenshot);

      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.plotRevealState === "complete"
          && Number(overlay.dataset.renewableCountryFillCount) === 208
          && Number(overlay.dataset.renewableVisibleCountryFillCount) === 208
          && overlay.dataset.renewableSelectedPoiVisible === "true"
          && overlay.dataset.renewableSelectionLabelVisible === "true";
      }, null, { timeout: 5_000 });
      const complete = await page.locator("#japan-overlay").evaluate((overlay) => ({
        state: overlay.dataset.plotRevealState,
        fills: Number(overlay.dataset.renewableCountryFillCount),
        visibleFills: Number(overlay.dataset.renewableVisibleCountryFillCount),
        selectedPoiVisible: overlay.dataset.renewableSelectedPoiVisible,
        labelVisible: overlay.dataset.renewableSelectionLabelVisible,
        labelPrimary: overlay.dataset.renewableSelectionLabelPrimary,
        labelSecondary: overlay.dataset.renewableSelectionLabelSecondary,
      }));
      assert.match(complete.labelPrimary || "", /再生可能エネルギー発電割合 \d+\.\d%/u);
      assert.doesNotMatch(complete.labelPrimary || "", /RENEWABLE/u);
      assert.match(complete.labelSecondary || "", /^日射 .* kWh\/㎡\/日 · 風速 .* m\/s$/u);
      const localizedReadout = await page.locator("#japan-layer [data-signal-value]").innerText();
      assert.doesNotMatch(localizedReadout, /^(?:Bangladesh|Saudi Arabia|Argentina|Australia)\b/u);
      assert.match(localizedReadout, /再生可能エネルギー発電割合 \d+\.\d%/u);
      const completeScreenshot = path.join(outputDir, `${viewport.name}-08-all-pois-then-bubble.png`);
      await page.screenshot({ path: completeScreenshot });
      scan.screenshots.push(completeScreenshot);
      scan.renewableReveal = { separator, midReveal, complete };
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (legendOnly) {
      await selectMode(page, 0, "地球の一呼吸");
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await page.locator('.map-mode-bank [data-map-standard-index="2"]').evaluate((button) => button.click());
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning")
          && overlay?.dataset.plotRevealState === "waiting-for-separator"
          && overlay?.dataset.plotRevealWaitsForSeparator === "true"
          && Number(overlay.dataset.plotRevealCount) >= 6;
      });
      const separatorStart = await page.locator("#japan-overlay").evaluate((overlay) => ({
        separatorVisible: document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"),
        separatorState: overlay.dataset.titleSeparatorState || "",
        separatorEndsAt: Number(overlay.dataset.titleSeparatorEndsAt),
        revealState: overlay.dataset.plotRevealState || "",
        revealProgress: Number(overlay.dataset.plotRevealProgress),
        revealScheduledAt: Number(overlay.dataset.plotRevealScheduledAt),
        firstPoiVisibleAt: Number(overlay.dataset.plotRevealFirstVisibleAt),
        count: Number(overlay.dataset.plotRevealCount),
      }));
      assert.equal(separatorStart.separatorVisible, true);
      assert.equal(separatorStart.separatorState, "running");
      assert.equal(separatorStart.revealState, "waiting-for-separator");
      assert.equal(separatorStart.revealProgress, 0);
      assert(separatorStart.revealScheduledAt >= separatorStart.separatorEndsAt - 1);
      assert(separatorStart.firstPoiVisibleAt > separatorStart.separatorEndsAt);
      await page.waitForTimeout(520);
      const separatorMiddle = await page.locator("#japan-overlay").evaluate((overlay) => ({
        separatorVisible: document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"),
        revealState: overlay.dataset.plotRevealState || "",
        revealProgress: Number(overlay.dataset.plotRevealProgress),
      }));
      assert.deepEqual(separatorMiddle, {
        separatorVisible: true,
        revealState: "waiting-for-separator",
        revealProgress: 0,
      }, `${viewport.name}: POIs started while the title separator was still visible`);
      const separatorScreenshot = path.join(outputDir, `${viewport.name}-forest-separator-before-poi.png`);
      await page.screenshot({ path: separatorScreenshot });
      scan.screenshots.push(separatorScreenshot);
      await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.titleSeparatorState === "complete"
          && overlay?.dataset.plotRevealState === "running"
          && overlay?.dataset.plotRevealWaitsForSeparator === "false";
      });
      const revealStart = await page.locator("#japan-overlay").evaluate((overlay) => ({
        state: overlay.dataset.plotRevealState || "",
        reason: overlay.dataset.plotRevealReason || "",
        generation: Number(overlay.dataset.plotRevealGeneration),
        progress: Number(overlay.dataset.plotRevealProgress),
        count: Number(overlay.dataset.plotRevealCount),
        separatorCompletedAt: Number(overlay.dataset.titleSeparatorCompletedAt),
        firstPoiVisibleAt: Number(overlay.dataset.plotRevealFirstVisibleAt),
      }));
      assert(revealStart.firstPoiVisibleAt >= revealStart.separatorCompletedAt, `${viewport.name}: first POI precedes separator completion`);
      assert(revealStart.progress < 0.25, `${viewport.name}: POI reveal skipped its entrance after separator`);

      await page.waitForTimeout(420);
      const revealMiddle = await page.locator("#japan-overlay").evaluate((overlay) => ({
        state: overlay.dataset.plotRevealState || "",
        progress: Number(overlay.dataset.plotRevealProgress),
        count: Number(overlay.dataset.plotRevealCount),
      }));
      assert.equal(revealMiddle.state, "running");
      assert(revealStart.generation > 0 && revealStart.progress < revealMiddle.progress && revealMiddle.progress < 1, `plots did not reveal progressively: ${JSON.stringify({ revealStart, revealMiddle })}`);
      assert(revealMiddle.count >= 6, `not enough plotted objects participate in the reveal: ${JSON.stringify(revealMiddle)}`);
      const revealScreenshot = path.join(outputDir, `${viewport.name}-forest-map-reveal-mid.png`);
      await page.screenshot({ path: revealScreenshot });
      scan.screenshots.push(revealScreenshot);
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.plotRevealState === "complete", null, { timeout: 4_000 });
      const mobileLegendToggle = page.locator("#map-mobile-legend-toggle");
      if (await mobileLegendToggle.isVisible()) {
        await mobileLegendToggle.click();
        await page.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("is-mobile-legend-expanded"));
      }
      await page.waitForFunction(() => {
        const title = document.querySelector("[data-signal-encoding-legend-title]");
        const legend = document.querySelector("[data-signal-encoding-legend]");
        const overlay = document.querySelector("#japan-overlay");
        return title?.getClientRects().length > 0
          && legend?.getClientRects().length > 0
          && overlay?.dataset.forestMask === "ready";
      });
      const legend = await page.evaluate(() => ({
        title: document.querySelector("[data-signal-encoding-legend-title]")?.textContent.trim() || "",
        body: document.querySelector("[data-signal-encoding-legend]")?.textContent.replace(/\s+/gu, " ").trim() || "",
        supplementCount: document.querySelectorAll("[data-signal-encoding-legend] dd, [data-encoding-value]").length,
      }));
      assert.match(legend.title, /凡例\s*MAP LEGEND/u);
      assert.match(legend.body, /大きな水色円\s*\/\s*降水量/u);
      assert.match(legend.body, /緑の面\s*\/\s*森林域/u);
      assert.equal(legend.supplementCount, 0);
      const screenshot = path.join(outputDir, `${viewport.name}-forest-map-legend.png`);
      await page.screenshot({ path: screenshot, animations: "disabled" });
      scan.screenshots.push(screenshot);
      scan.legend = { ...legend, separatorStart, separatorMiddle, revealStart };
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }

    if (panOnly) {
      await page.evaluate(() => globalThis.GaiaModeLoader.load("tour"));
      await page.waitForFunction(() => typeof globalThis.GaiaGuidedTour?.start === "function");
      await page.evaluate(() => globalThis.GaiaGuidedTour.start({ source: "map-pan-regression" }));
      await page.waitForFunction(() => globalThis.GaiaGuidedTour.getState().active
        && globalThis.GaiaGuidedTour.getState().stepId === "map"
        && document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
      if (await page.evaluate(() => globalThis.GaiaGuidedTour.getState().running)) {
        await page.locator("#gaia-guided-tour [data-tour-action='toggle']").click({ force: true });
      }
      await page.waitForFunction(() => globalThis.GaiaGuidedTour.getState().running === false);
    }

    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));

    await page.waitForFunction(() => {
      const overlay = document.querySelector("#japan-overlay");
      return overlay?.dataset.viewAnimation === "idle"
        && Number.isFinite(Number(overlay.dataset.gosatAnchorScreenX))
        && Number.isFinite(Number(overlay.dataset.gosatAnchorScreenY));
    });
    const panBefore = await readMapState(page);
    const dragTarget = await page.evaluate(() => {
      const map = document.querySelector("#japan-map");
      const rect = map?.getBoundingClientRect();
      if (!map || !rect) return null;
      for (let yOffset = 8; yOffset <= rect.height - 8; yOffset += 16) {
        for (let xOffset = 8; xOffset <= rect.width - 112; xOffset += 16) {
          const x = rect.left + xOffset;
          const y = rect.top + yOffset;
          if (document.elementFromPoint(x, y)?.closest?.("#japan-map")) return { x, y };
        }
      }
      return null;
    });
    assert(dragTarget, `${viewport.name}: no real map drag target was available`);
    await page.mouse.move(dragTarget.x, dragTarget.y);
    await page.mouse.down();
    await page.mouse.move(dragTarget.x + 96, dragTarget.y + 34, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(
      (previousKey) => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.gosatProjectionKey !== previousKey
          && Math.abs(Number(overlay.dataset.gosatAnchorScreenX) - Number(overlay.dataset.japanScreenX)) <= 0.1
          && Math.abs(Number(overlay.dataset.gosatAnchorScreenY) - Number(overlay.dataset.japanScreenY)) <= 0.1;
      },
      panBefore.gosatProjectionKey,
    );
    const panAfter = await readMapState(page);
    const coastlineDelta = {
      x: panAfter.japanX - panBefore.japanX,
      y: panAfter.japanY - panBefore.japanY,
    };
    const gosatDelta = {
      x: panAfter.gosatAnchorX - panBefore.gosatAnchorX,
      y: panAfter.gosatAnchorY - panBefore.gosatAnchorY,
    };
    assert(Math.abs(coastlineDelta.x) >= 40, `${viewport.name}: map did not move far enough to verify alignment`);
    assert(Math.abs(gosatDelta.x - coastlineDelta.x) <= 0.75, `${viewport.name}: GOSAT data did not follow horizontal map movement`);
    assert(Math.abs(gosatDelta.y - coastlineDelta.y) <= 0.75, `${viewport.name}: GOSAT data did not follow vertical map movement`);
    const panScreenshot = path.join(outputDir, `${viewport.name}-01-gosat-pan-aligned.png`);
    await page.screenshot({ path: panScreenshot });
    scan.screenshots.push(panScreenshot);
    scan.gosatPan = { before: panBefore, after: panAfter, coastlineDelta, gosatDelta };
    if (panOnly) {
      const zoomBefore = await readMapState(page);
      const wheelTarget = await page.evaluate(() => {
        for (const selector of ["#map-signal-encoding-legend-dock", "#map-reading-guide"]) {
          const element = document.querySelector(selector);
          const rect = element?.getBoundingClientRect();
          if (!rect?.width || !rect.height) continue;
          for (let row = 1; row <= 4; row += 1) {
            for (let column = 1; column <= 4; column += 1) {
              const x = rect.left + rect.width * column / 5;
              const y = rect.top + rect.height * row / 5;
              const hit = document.elementFromPoint(x, y);
              if (hit?.closest?.(selector)) {
                return { x, y, hit: hit.id || hit.className || hit.tagName || "", selector };
              }
            }
          }
        }
        const map = document.querySelector("#japan-map");
        const mapRect = map?.getBoundingClientRect();
        if (!mapRect?.width) return null;
        for (let row = 1; row <= 8; row += 1) {
          for (let column = 1; column <= 8; column += 1) {
            const x = mapRect.left + mapRect.width * column / 9;
            const y = mapRect.top + mapRect.height * row / 9;
            if (document.elementFromPoint(x, y)?.closest?.("#japan-map")) {
              return { x, y, hit: "#japan-map", selector: "#japan-map" };
            }
          }
        }
        return null;
      });
      assert(wheelTarget, `${viewport.name}: no wheel regression target was available`);
      if (viewport.name === "pc") {
        assert.notEqual(wheelTarget.selector, "#japan-map", `${viewport.name}: non-map overlay was not covered by wheel regression`);
      }
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.mouse.move(wheelTarget.x, wheelTarget.y);
      await page.mouse.wheel(0, -180);
      await page.waitForFunction((previousKey) => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.gosatProjectionKey !== previousKey
          && Math.abs(Number(overlay.dataset.gosatAnchorScreenX) - Number(overlay.dataset.japanScreenX)) <= 0.1
          && Math.abs(Number(overlay.dataset.gosatAnchorScreenY) - Number(overlay.dataset.japanScreenY)) <= 0.1;
      }, zoomBefore.gosatProjectionKey);
      const zoomAfter = await readMapState(page);
      assert(zoomAfter.zoom > zoomBefore.zoom + 0.1, `${viewport.name}: wheel did not zoom the map`);
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, `${viewport.name}: wheel scrolled the page instead of the map`);
      assert(Math.abs(zoomAfter.gosatAnchorX - zoomAfter.japanX) <= 0.1, `${viewport.name}: GOSAT data separated from the coastline after zoom`);
      assert(Math.abs(zoomAfter.gosatAnchorY - zoomAfter.japanY) <= 0.1, `${viewport.name}: GOSAT data separated vertically after zoom`);
      const zoomScreenshot = path.join(outputDir, `${viewport.name}-01-gosat-zoom-aligned.png`);
      await page.screenshot({ path: zoomScreenshot });
      scan.screenshots.push(zoomScreenshot);
      scan.gosatZoom = { before: zoomBefore, after: zoomAfter, wheelTarget };

      const resizeBefore = await readMapState(page);
      await page.setViewportSize({ width: viewport.width + 16, height: viewport.height + 12 });
      await page.waitForFunction((previousKey) => {
        const overlay = document.querySelector("#japan-overlay");
        return overlay?.dataset.gosatProjectionKey !== previousKey
          && Math.abs(Number(overlay.dataset.gosatAnchorScreenX) - Number(overlay.dataset.japanScreenX)) <= 0.1
          && Math.abs(Number(overlay.dataset.gosatAnchorScreenY) - Number(overlay.dataset.japanScreenY)) <= 0.1;
      }, resizeBefore.gosatProjectionKey);
      const resizeAfter = await readMapState(page);
      scan.gosatResize = { before: resizeBefore, after: resizeAfter };
      report.scans.push(scan);
      await context.close();
      console.log(`PASS ${viewport.name}`);
      continue;
    }
    await page.locator("#japan-map").focus();
    await page.locator("#japan-map").press("0");
    await page.waitForFunction(() => {
      const overlay = document.querySelector("#japan-overlay");
      return Math.abs(Number(overlay?.dataset.earthOffsetX)) < 0.01
        && Math.abs(Number(overlay?.dataset.earthOffsetY)) < 0.01;
    });

    await selectMode(page, 1, "海流が14日続いたら");
    const zoomIn = await sampleZoom(page);
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle");
    const finalJapan = await readMapState(page);
    assert(zoomIn.filter((sample) => Number.isFinite(sample.zoom)).length === zoomIn.length);
    assert(
      new Set(zoomIn.map((sample) => sample.zoom.toFixed(3))).size >= 4,
      `${viewport.name}: zoom did not animate smoothly (${JSON.stringify(zoomIn.map(({ zoom, animation, target }) => ({ zoom, animation, target })))})`,
    );
    assert(zoomIn.every((sample, index) => index === 0 || sample.zoom + 0.01 >= zoomIn[index - 1].zoom), `${viewport.name}: zoom-in is not monotonic`);
    assert.equal(finalJapan.target, "tokyo");
    assert(finalJapan.zoom >= (viewport.name === "mobile" ? 3.3 : 4.1));
    assert(Math.abs(finalJapan.tokyoX - finalJapan.rect.width * 0.5) <= 24);
    assert(Math.abs(finalJapan.tokyoY - finalJapan.rect.height * 0.46) <= 24);
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#gaia-canvas");
      const overlay = document.querySelector("#japan-overlay");
      return canvas?.dataset.currentAllVisiblePoiPainted === "true"
        && Number(canvas?.dataset.currentVisiblePoiCount) > 0
        && Number(overlay?.dataset.currentPoiMarkerCount)
          === Number(canvas?.dataset.currentVisiblePoiCount);
    });
    const circulationVisual = await page.locator("#japan-overlay").evaluate((overlay) => ({
      language: overlay.dataset.currentVisualLanguage,
      arrowStride: Number(overlay.dataset.currentArrowStride),
      layerOrder: overlay.dataset.layerOrder,
      referenceMapCopies: overlay.dataset.vectorWorldCopies || "",
      integratedMode: document.querySelector("#gaia-canvas")?.dataset.integratedMapMode,
      canvasParent: document.querySelector("#gaia-canvas")?.parentElement?.id,
      canvasLayer: document.querySelector("#gaia-canvas")?.dataset.mapLayer,
      canvasZIndex: Number(getComputedStyle(document.querySelector("#gaia-canvas")).zIndex),
      overlayZIndex: Number(getComputedStyle(overlay).zIndex),
      meanSpeedMs: Number(document.querySelector("#gaia-canvas")?.dataset.currentMeanSpeedMs),
      maximumSpeedMs: Number(document.querySelector("#gaia-canvas")?.dataset.currentMaximumSpeedMs),
      strength: Number(document.querySelector("#gaia-canvas")?.dataset.currentStrength),
      vectorCount: Number(document.querySelector("#gaia-canvas")?.dataset.currentVectorCount),
      visiblePoiCount: Number(document.querySelector("#gaia-canvas")?.dataset.currentVisiblePoiCount),
      revealedPoiCount: Number(document.querySelector("#gaia-canvas")?.dataset.currentRevealedPoiCount),
      renderedSampleCount: Number(document.querySelector("#gaia-canvas")?.dataset.currentRenderedSampleCount),
      brushStrokeCount: Number(document.querySelector("#gaia-canvas")?.dataset.currentBrushStrokeCount),
      oneStrokePerPoi: document.querySelector("#gaia-canvas")?.dataset.currentOneStrokePerPoi,
      allVisiblePoiPainted: document.querySelector("#gaia-canvas")?.dataset.currentAllVisiblePoiPainted,
      sampleSelection: document.querySelector("#gaia-canvas")?.dataset.currentSampleSelection,
      directionTransform: document.querySelector("#gaia-canvas")?.dataset.currentDirectionTransform,
      brushLanguage: document.querySelector("#gaia-canvas")?.dataset.currentBrushLanguage,
      coverageMode: document.querySelector("#gaia-canvas")?.dataset.currentCoverageMode,
      interpolationSource: document.querySelector("#gaia-canvas")?.dataset.currentInterpolationSource,
      ambientMotion: document.querySelector("#gaia-canvas")?.dataset.currentAmbientMotion,
      ambientPhase: Number(document.querySelector("#gaia-canvas")?.dataset.currentAmbientPhase),
      overlayVisiblePoiCount: Number(overlay.dataset.currentVisiblePoiCount),
      poiMarkerCount: Number(overlay.dataset.currentPoiMarkerCount),
      poiMarkerStyle: overlay.dataset.currentPoiMarkerStyle,
      integratedOpacity: getComputedStyle(document.querySelector("#japan-layer"))
        .getPropertyValue("--map-light-opacity")
        .trim(),
    }));
    assert.equal(circulationVisual.language, "continuous-interpolated-current-brush");
    assert(circulationVisual.arrowStride >= 3);
    assert.equal(circulationVisual.integratedMode, "02");
    assert.equal(circulationVisual.integratedOpacity, "0.72");
    assert.equal(circulationVisual.brushLanguage, "continuous-interpolated-field-with-poi-anchors");
    assert.equal(circulationVisual.coverageMode, "gapless-idw-vector-field");
    assert.equal(circulationVisual.interpolationSource, "inverse-distance-weighted-noaa-vectors");
    assert.equal(circulationVisual.ambientMotion, "continuous-timeline-independent-gradient");
    assert(Number.isFinite(circulationVisual.ambientPhase));
    assert.equal(circulationVisual.canvasParent, "japan-map");
    assert.equal(circulationVisual.canvasLayer, "below-reference-map-and-poi");
    assert.equal(circulationVisual.layerOrder, "reference-map-and-poi-above-webgl");
    assert(circulationVisual.referenceMapCopies.length > 0, `${viewport.name}: reference map did not render above WebGL`);
    assert(circulationVisual.overlayZIndex > circulationVisual.canvasZIndex, `${viewport.name}: WebGL covers the map/POI canvas`);
    assert(circulationVisual.meanSpeedMs > 0, `${viewport.name}: mean current speed was not uploaded`);
    assert(circulationVisual.maximumSpeedMs > circulationVisual.meanSpeedMs, `${viewport.name}: maximum current speed was not uploaded`);
    assert(Math.abs(circulationVisual.strength - Math.min(1, circulationVisual.meanSpeedMs)) < 0.001);
    assert(circulationVisual.vectorCount >= circulationVisual.visiblePoiCount);
    assert(circulationVisual.visiblePoiCount > 0 && circulationVisual.visiblePoiCount <= 96);
    assert.equal(circulationVisual.revealedPoiCount, circulationVisual.visiblePoiCount);
    assert.equal(circulationVisual.renderedSampleCount, circulationVisual.visiblePoiCount);
    assert.equal(circulationVisual.brushStrokeCount, circulationVisual.visiblePoiCount);
    assert.equal(circulationVisual.overlayVisiblePoiCount, circulationVisual.visiblePoiCount);
    assert.equal(circulationVisual.poiMarkerCount, circulationVisual.visiblePoiCount);
    assert.equal(circulationVisual.oneStrokePerPoi, "true");
    assert.equal(circulationVisual.allVisiblePoiPainted, "true");
    assert.equal(circulationVisual.sampleSelection, "all-visible-poi-stable-order");
    assert.equal(circulationVisual.directionTransform, "noaa-east-north-to-gl-local-positive-rotation");
    assert.equal(circulationVisual.poiMarkerStyle, "luminous-ring-above-data-brush");
    scan.circulationVisual = circulationVisual;
    const zoomScreenshot = path.join(outputDir, `${viewport.name}-02-japan-zoom.png`);
    await page.screenshot({ path: zoomScreenshot });
    scan.screenshots.push(zoomScreenshot);

    const circulationTimeline = page.locator("#japan-layer [data-signal-time]").first();
    await circulationTimeline.focus();
    await circulationTimeline.press("Home");
    const heldTimelineValue = await circulationTimeline.inputValue();
    const brushBeforePath = path.join(outputDir, `${viewport.name}-02-brush-ambient-before.png`);
    const brushAfterPath = path.join(outputDir, `${viewport.name}-02-brush-ambient-after.png`);
    const brushBefore = await page.locator("#gaia-canvas").screenshot({ path: brushBeforePath });
    const ambientPhaseSamples = [];
    for (let sampleIndex = 0; sampleIndex < 14; sampleIndex += 1) {
      ambientPhaseSamples.push(await page.locator("#gaia-canvas").evaluate((element) => (
        Number(element.dataset.currentAmbientPhase)
      )));
      await page.waitForTimeout(55);
    }
    await page.waitForTimeout(500);
    const brushAfter = await page.locator("#gaia-canvas").screenshot({ path: brushAfterPath });
    const settledTimelineValue = await circulationTimeline.inputValue();
    const ambientPhaseDeltas = ambientPhaseSamples.slice(1).map((value, index) => (
      value - ambientPhaseSamples[index]
    ));
    assert.equal(settledTimelineValue, heldTimelineValue, `${viewport.name}: brush animation advanced the observation timeline`);
    assert(new Set(ambientPhaseSamples.map((value) => value.toFixed(3))).size >= 8, `${viewport.name}: ambient pigment phase is stepping or stalled`);
    assert(ambientPhaseDeltas.every((delta) => delta >= 0 && delta < 0.14), `${viewport.name}: ambient pigment phase jumped: ${JSON.stringify(ambientPhaseDeltas)}`);
    assert.equal(brushBefore.equals(brushAfter), false, `${viewport.name}: fixed-timeline brush pixels did not animate`);
    scan.circulationAmbientBrush = {
      heldTimelineValue,
      phaseStart: ambientPhaseSamples[0],
      phaseEnd: ambientPhaseSamples.at(-1),
      uniquePhaseSamples: new Set(ambientPhaseSamples.map((value) => value.toFixed(3))).size,
      pixelFrameChanged: true,
    };
    scan.screenshots.push(brushBeforePath, brushAfterPath);

    await page.waitForFunction(() => !document.querySelector("#japan-layer [data-signal-value]")?.textContent?.includes("LOADING"));
    await waitForMapGuide(page);
    const circulationUi = await page.evaluate(() => ({
      title: document.querySelector("#japan-mode-title")?.textContent || "",
      guideTitle: document.querySelector("#map-guide-title")?.textContent || "",
      guideSubject: document.querySelector("#map-guide-subject")?.textContent || "",
      guideReading: document.querySelector("#map-guide-reading")?.textContent || "",
      guideAction: document.querySelector("#map-guide-action")?.textContent || "",
      signalValue: document.querySelector("#japan-layer [data-signal-value]")?.textContent || "",
      signalNoteCount: document.querySelectorAll("#japan-layer [data-signal-note]").length,
      sliderLabel: document.querySelector("#japan-layer [data-signal-time-label]")?.textContent || "",
      legend: document.querySelector("#japan-layer [data-signal-encoding-legend]")?.textContent || "",
      legendSupplementCount: document.querySelectorAll("#japan-layer [data-signal-encoding-legend] dd, #japan-layer [data-encoding-value]").length,
    }));
    assert.equal(circulationUi.title, "海流が14日続いたら");
    assert.equal(circulationUi.guideTitle, "この海流は、14日でどこまで進む？");
    assert.match(circulationUi.guideSubject, /色付きの矢印が海流/u);
    assert.match(circulationUi.guideReading, /白い矢印.*計算には使いません/u);
    assert.match(circulationUi.guideAction, /スライダー/u);
    assert.match(circulationUi.signalValue, /海流.*地点/u);
    assert.equal(circulationUi.signalNoteCount, 0);
    assert.match(circulationUi.sliderLabel, /経過日数/u);
    assert.match(circulationUi.legend, /色付き矢印\s*\/\s*海流/u);
    assert.match(circulationUi.legend, /白い矢印\s*\/\s*風（比較用）/u);
    assert.equal(circulationUi.legendSupplementCount, 0);
    await page.locator("#map-reading-guide").evaluate((element) => { element.open = false; });
    scan.clicks.circulation = await clickDataPoint(page, "blue-circulation");
    assert.match(scan.clicks.circulation.card.type, /海流が14日続いたら \/ 観測データ/u);
    assert.match(scan.clicks.circulation.card.meta, /海流 \d+\.\d+ m\/s \/ (北|北東|東|南東|南|南西|西|北西)方向/u);
    assert.equal(scan.clicks.circulation.card.sourceLabel, "元データを確認する ↗");
    assert.match(scan.clicks.circulation.card.sourceHref, /^https:\/\/coastwatch\.noaa\.gov\//u);
    assert.equal(scan.clicks.circulation.card.sourceTarget, "_blank");
    assert.equal(scan.clicks.circulation.card.retiredCopyCount, 0);
    const circulationScreenshot = path.join(outputDir, `${viewport.name}-02-current-distance.png`);
    await page.screenshot({ path: circulationScreenshot });
    scan.screenshots.push(circulationScreenshot);
    await closeDataCard(page);

    await selectMode(page, 0, "地球の一呼吸");
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle");
    await selectMode(page, 1, "海流が14日続いたら");
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "running");
    const mapBox = await page.locator("#japan-map").boundingBox();
    await page.locator("#japan-map").dispatchEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: mapBox.x + mapBox.width * 0.86,
      clientY: mapBox.y + mapBox.height * 0.34,
      deltaY: -120,
    });
    const cancelled = await readMapState(page);
    await page.waitForTimeout(900);
    const afterCancel = await readMapState(page);
    assert.equal(cancelled.animation, "user-wheel");
    assert(Math.abs(afterCancel.zoom - cancelled.zoom) < 0.08, `${viewport.name}: cancelled zoom kept running`);
    scan.zoom = { zoomIn, cancelled, afterCancel };

    await selectMode(page, 1, "海流が14日続いたら");
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle");
    await selectMode(page, 2, "森林と降水量を重ねる");
    const zoomOut = await sampleZoom(page);
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.viewAnimation === "idle");
    const worldView = await readMapState(page);
    assert(
      new Set(zoomOut.map((sample) => sample.zoom.toFixed(3))).size >= 3,
      `${viewport.name}: world return did not animate (${JSON.stringify(zoomOut.map(({ zoom, animation, target }) => ({ zoom, animation, target })))})`,
    );
    assert(zoomOut.every((sample, index) => index === 0 || sample.zoom <= zoomOut[index - 1].zoom + 0.01), `${viewport.name}: world return is not monotonic`);
    assert(worldView.zoom <= 1.03, `${viewport.name}: world view did not return (${worldView.zoom})`);
    try {
      await page.waitForFunction(() => {
        const overlay = document.querySelector("#japan-overlay");
        const vectorCopies = (overlay?.dataset.vectorWorldCopies || "").split(",").map(Number);
        const rasterCopies = (overlay?.dataset.rasterWorldCopies || "").split(",").map(Number);
        return overlay?.dataset.forestMask === "ready"
          && vectorCopies.length === rasterCopies.length
          && vectorCopies.length > 0
          && vectorCopies.every((value, index) => Number.isFinite(value)
            && Number.isFinite(rasterCopies[index])
            && Math.abs(value - rasterCopies[index]) <= 0.25);
      });
    } catch (error) {
      const stalledAlignment = await readMapState(page);
      throw new Error(`${viewport.name}: forest/vector/raster alignment timed out (${JSON.stringify(stalledAlignment)})`, { cause: error });
    }
    const alignment = await readMapState(page);
    const vectorCopies = alignment.vectorCopies.split(",").map(Number);
    const rasterCopies = alignment.rasterCopies.split(",").map(Number);
    assert.equal(vectorCopies.length, rasterCopies.length);
    assert(vectorCopies.every((value, index) => Math.abs(value - rasterCopies[index]) <= 0.25));
    const mobileLegendToggle = page.locator("#map-mobile-legend-toggle");
    const openedMobileLegend = await mobileLegendToggle.count()
      && await mobileLegendToggle.isVisible()
      && await mobileLegendToggle.getAttribute("aria-expanded") !== "true";
    if (openedMobileLegend) await mobileLegendToggle.click();
    await waitForMapGuide(page);
    const forestUi = await page.evaluate(() => ({
      guideTitle: document.querySelector("#map-guide-title")?.textContent || "",
      guideSubject: document.querySelector("#map-guide-subject")?.textContent || "",
      guideReading: document.querySelector("#map-guide-reading")?.textContent || "",
      guideAction: document.querySelector("#map-guide-action")?.textContent || "",
      signalValue: document.querySelector("#japan-layer [data-signal-value]")?.textContent || "",
      legendTitle: document.querySelector("#japan-layer [data-signal-encoding-legend-title]")?.textContent || "",
      legendTitleVisible: document.querySelector("#japan-layer [data-signal-encoding-legend-title]")?.getClientRects().length > 0,
      legend: document.querySelector("#japan-layer [data-signal-encoding-legend]")?.textContent || "",
      legendSupplementCount: document.querySelectorAll("#japan-layer [data-signal-encoding-legend] dd, #japan-layer [data-encoding-value]").length,
      circleRange: document.querySelector("#japan-overlay")?.dataset.forestRainCircleRange || "",
      brazilRain: document.querySelector("#japan-overlay")?.dataset.forestRainBrazil || "",
    }));
    assert.equal(forestUi.guideTitle, "森林と、雨の多い場所はどこで重なる？");
    assert.match(forestUi.guideSubject, /世界の国・地域.*参照地点.*国平均.*因果関係/u);
    assert.match(forestUi.guideReading, /大きな水色円.*ブラジルのアマゾン付近は5\.33 mm\/day/u);
    assert.match(forestUi.guideAction, /円のない場所.*雨がない.*ではなく/u);
    assert.match(forestUi.signalValue, /降水量.*mm\/day/u);
    assert.equal(forestUi.legendTitleVisible, true);
    assert.match(forestUi.legendTitle, /凡例\s*MAP LEGEND/u);
    assert.match(forestUi.legend, /大きな水色円\s*\/\s*降水量/u);
    assert.equal(forestUi.legendSupplementCount, 0);
    assert.equal(forestUi.circleRange, "10-54px radius");
    assert.equal(forestUi.brazilRain, "5.33 mm/日");
    if (openedMobileLegend) await mobileLegendToggle.click();
    await page.locator("#map-reading-guide").evaluate((element) => { element.open = false; });
    scan.clicks.forest = await clickDataPoint(page, "forest-cloud-engine");
    assert.match(scan.clicks.forest.card.type, /森林と降水量を重ねる \/ 観測データ/u);
    assert.match(scan.clicks.forest.card.meta, /mm\/day/u);
    assert.match(scan.clicks.forest.card.sourceHref, /^https:\/\/power\.larc\.nasa\.gov\//u);
    const forestScreenshot = path.join(outputDir, `${viewport.name}-03-forest-rain.png`);
    await page.screenshot({ path: forestScreenshot });
    scan.screenshots.push(forestScreenshot);
    await closeDataCard(page);

    await selectMode(page, 3, "再資源化率を比べる");
    await waitForMapGuide(page);
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.recyclingEncoding === "fixed-diameter-pie");
    const recyclingEncoding = await page.locator("#japan-overlay").evaluate((element) => ({
      encoding: element.dataset.recyclingEncoding,
      pieCount: Number(element.dataset.recyclingPieCount),
      officialCount: Number(element.dataset.recyclingOfficialCount),
      imputedCount: Number(element.dataset.recyclingImputedCount),
      selectedRate: Number(element.dataset.recyclingSelectedRate),
      selectedIndex: Number(element.dataset.recyclingSelectedIndex),
      selectedStatus: element.dataset.recyclingSelectedStatus,
    }));
    assert.deepEqual(recyclingEncoding, {
      encoding: "fixed-diameter-pie",
      pieCount: 31,
      officialCount: 17,
      imputedCount: 14,
      selectedRate: 19.6,
      selectedIndex: 0,
      selectedStatus: "official",
    });
    await page.waitForFunction(() => /緑の扇形.*橙/u.test(document.querySelector("#map-guide-reading")?.textContent || ""));
    const recyclingGuide = await page.locator("#map-guide-reading").textContent();
    assert.match(recyclingGuide, /緑の扇形.*橙/u);
    scan.clicks.waste = await clickDataPoint(page, "nothing-is-waste");
    assert.match(scan.clicks.waste.card.type, /再資源化率を比べる \/ 観測データ/u);
    assert.match(scan.clicks.waste.card.meta, /%/u);
    assert.match(scan.clicks.waste.card.sourceHref, /^https:\/\/unstats\.un\.org\//u);
    const selectedCurrentRate = Number(scan.clicks.waste.point.row.recyclePercent.toFixed(1));
    await page.waitForFunction(
      (expectedRate) => Number(document.querySelector("#japan-overlay")?.dataset.recyclingSelectedRate) === expectedRate,
      selectedCurrentRate,
    );
    await closeDataCard(page);
    const beforeCountryChange = await page.locator("#japan-layer [data-signal-value]").first().innerText();
    const slider = page.locator("#japan-layer [data-signal-time]").first();
    await slider.focus();
    await slider.press("End");
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay")?.dataset.recyclingSelectedIndex) === 30);
    const afterCountryChange = await page.locator("#japan-layer [data-signal-value]").first().innerText();
    assert.notEqual(afterCountryChange, beforeCountryChange);
    assert.match(afterCountryChange, /再資源化率 \d+\.\d% \/ (?:国連公式値|補完値)/u);
    assert.equal(await slider.getAttribute("max"), "30");
    assert.match(await slider.getAttribute("aria-valuetext"), /31番目.*再資源化率.*(?:国連公式値|補完値)/u);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-recycling-scenario-rate"), null);
    assert.doesNotMatch(await page.locator("#japan-layer").innerText(), /自分の目標|改善目標|黄色い外周/u);
    const wasteScreenshot = path.join(outputDir, `${viewport.name}-04-recycling-country-selector.png`);
    await page.screenshot({ path: wasteScreenshot });
    scan.screenshots.push(wasteScreenshot);

    await selectMode(page, 4, "人類世の傷跡");
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.nightLightsLayer === "visible");
    await slider.evaluate((input) => {
      input.value = input.min;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.emissionsSelectedYear === "1945");
    await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
    await page.waitForTimeout(1800);
    const historicalEmissions = await readAnthropoceneSnapshot(page);
    assert.ok(historicalEmissions.countryCount >= 20 && historicalEmissions.countryCount < 31);
    assert.equal(historicalEmissions.encoding, "country-fixed-log-color");
    assert.equal(historicalEmissions.geometry, "natural-earth-country-choropleth");
    assert.equal(historicalEmissions.hitSurface, "country-regions");
    assert.equal(historicalEmissions.scaleMtCo2, 12000);
    const historicalEmissionReadout = await page.locator("#japan-layer [data-signal-value]").evaluateAll((elements) => (
      elements.find((element) => element.offsetParent !== null)?.textContent || ""
    ));
    assert.match(historicalEmissionReadout, /1945.*Mt CO₂/u);
    const historicalEmissionsScreenshot = path.join(outputDir, `${viewport.name}-05-emissions-1945.png`);
    await page.screenshot({ path: historicalEmissionsScreenshot });
    scan.screenshots.push(historicalEmissionsScreenshot);
    await slider.evaluate((input) => {
      input.value = input.max;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.emissionsSelectedYear === "2023");
    await page.waitForTimeout(1800);
    const modernEmissions = await readAnthropoceneSnapshot(page);
    const modernEmissionsScreenshot = path.join(outputDir, `${viewport.name}-05-emissions-2023.png`);
    await page.screenshot({ path: modernEmissionsScreenshot });
    scan.screenshots.push(modernEmissionsScreenshot);
    const anthropoceneEncoding = await page.locator("#japan-overlay").evaluate((element) => ({
      lightLayer: element.dataset.nightLightsLayer,
      source: element.dataset.nightLightsSource,
      projection: element.dataset.nightLightsProjection,
      display: element.dataset.nightLightsDisplay,
      emissionCount: Number(element.dataset.emissionsCountryFillCount),
      emissionEncoding: element.dataset.emissionsEncoding,
      emissionGeometry: element.dataset.emissionsGeometry,
      emissionHitSurface: element.dataset.emissionsHitSurface,
      selectedYear: element.dataset.emissionsSelectedYear,
      nightLightsReferenceYear: element.dataset.nightLightsReferenceYear,
    }));
    assert.deepEqual(anthropoceneEncoding, {
      lightLayer: "visible",
      source: "NASA-VIIRS-2016",
      projection: "web-mercator-to-geographic",
      display: "glow-plus-radiance-core",
      emissionCount: 31,
      emissionEncoding: "country-fixed-log-color",
      emissionGeometry: "natural-earth-country-choropleth",
      emissionHitSurface: "country-regions",
      selectedYear: "2023",
      nightLightsReferenceYear: "2016",
    });
    assert.equal(modernEmissions.year, 2023);
    assert.equal(modernEmissions.countryCount, 31);
    assert.equal(modernEmissions.encoding, "country-fixed-log-color");
    assert.equal(modernEmissions.geometry, "natural-earth-country-choropleth");
    assert.equal(modernEmissions.hitSurface, "country-regions");
    assert.equal(modernEmissions.scaleMtCo2, 12000);
    assert.ok(modernEmissions.visibleCountryCount > historicalEmissions.visibleCountryCount);
    assert.ok(modernEmissions.heatSum > historicalEmissions.heatSum * 1.3);
    assert.ok(modernEmissions.totalMtCo2 > historicalEmissions.totalMtCo2 * 7);
    assert.ok(modernEmissions.maximumHeat > historicalEmissions.maximumHeat);
    scan.anthropoceneTimelineComparison = {
      historical: historicalEmissions,
      modern: modernEmissions,
    };
    await waitForMapGuide(page);
    const anthropoceneGuide = await page.locator("#map-guide-reading").textContent();
    assert.match(anthropoceneGuide, /国土の色.*固定対数尺度.*濃紺.*淡黄.*白い発光.*2016.*固定/u);
    const nightLightsScreenshot = path.join(outputDir, `${viewport.name}-05-night-lights-visible.png`);
    await page.screenshot({ path: nightLightsScreenshot });
    scan.screenshots.push(nightLightsScreenshot);

    if (viewport.name === "pc") {
      const mapBox = await page.locator("#japan-map").boundingBox();
      assert.ok(mapBox);
      await page.mouse.move(mapBox.x + mapBox.width * 0.77, mapBox.y + mapBox.height * 0.37);
      await page.mouse.down();
      await page.waitForTimeout(720);
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.nightLightsLayer === "dimmed");
      const dimmedScreenshot = path.join(outputDir, `${viewport.name}-05-night-lights-dimmed.png`);
      await page.screenshot({ path: dimmedScreenshot });
      scan.screenshots.push(dimmedScreenshot);
    }

    await selectMode(page, 5, "地球からのメッセージ");
    await page.waitForFunction(() => {
      const overlay = document.querySelector("#japan-overlay");
      return overlay?.dataset.earthquakeLayer === "world-year" && overlay.dataset.earthquakeYear === "2000";
    });
    const earthquakeInitial = await page.locator("#japan-overlay").evaluate((element) => ({
      layer: element.dataset.earthquakeLayer,
      year: element.dataset.earthquakeYear,
      eventCount: Number(element.dataset.earthquakeYearEventCount),
      totalCount: Number(element.dataset.earthquakeTotalEventCount),
      sync: element.dataset.earthquakeWaveSync,
      model: element.dataset.earthquakeWaveModel,
      target: element.dataset.viewTarget,
      zoom: Number(element.dataset.earthZoom),
    }));
    assert.deepEqual({
      ...earthquakeInitial,
      totalCount: undefined,
    }, {
      layer: "world-year",
      year: "2000",
      eventCount: 7,
      totalCount: undefined,
      sync: "chronological-sequential-distance-limited",
      model: "usgs-estimated-felt-radius",
      target: "earthquake-2000-1",
      zoom: 1,
    });
    assert.ok(earthquakeInitial.totalCount >= 142);
    const earthquakeSlider = page.locator("#japan-layer [data-signal-time]").first();
    await earthquakeSlider.evaluate((element) => {
      element.value = String(((4 + 0.1) / 27) * 100);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.earthquakeYear === "2004");
    const waveStart = Number(await page.locator("#japan-overlay").getAttribute("data-earthquake-wave-progress"));
    await page.waitForTimeout(360);
    const earthquakeWave = await page.locator("#japan-overlay").evaluate((element) => ({
      year: element.dataset.earthquakeYear,
      eventCount: Number(element.dataset.earthquakeYearEventCount),
      progress: Number(element.dataset.earthquakeWaveProgress),
      model: element.dataset.earthquakeWaveModel,
      maxRadiusKm: Number(element.dataset.earthquakeWaveRadiusMaxKm),
      maxRadius: Number(element.dataset.earthquakeWaveRadiusMaxPx),
      maxRadiusX: Number(element.dataset.earthquakeWaveRadiusMaxXPx),
      durationMs: Number(element.dataset.earthquakeWaveDurationMaxMs),
      cameraMode: element.dataset.earthquakeCameraMode,
      cameraState: element.dataset.earthquakeCameraState,
      cameraZoom: Number(element.dataset.earthZoom),
    }));
    assert.equal(earthquakeWave.year, "2004");
    assert.equal(earthquakeWave.eventCount, 3);
    assert.ok(earthquakeWave.progress > waveStart);
    assert.ok(earthquakeWave.progress < 0.2, `earthquake wave expanded too quickly: ${earthquakeWave.progress}`);
    assert.equal(earthquakeWave.model, "usgs-estimated-felt-radius");
    assert.equal(earthquakeWave.maxRadiusKm, 2000);
    assert.equal(earthquakeWave.durationMs, 3600);
    assert.ok(earthquakeWave.maxRadius > 40);
    assert.equal(earthquakeWave.cameraMode, "chronological-epicenter-flyover");
    assert.equal(earthquakeWave.cameraState, "following-epicenter");
    assert.ok(earthquakeWave.cameraZoom > 1);
    assert.ok(earthquakeWave.maxRadius < viewport.width * 0.65);
    assert.ok(earthquakeWave.maxRadiusX >= earthquakeWave.maxRadius);
    const earthquakeReadout = await page.locator("#japan-layer [data-signal-value]").first().innerText();
    assert.match(earthquakeReadout, /2004年.*3件.*最大 M9\.1/u);
    await page.waitForFunction(() => {
      const overlay = document.querySelector("#japan-overlay");
      return overlay?.dataset.earthquakeYear === "2004"
        && Number(overlay.dataset.earthquakeVisibleEventCount) === 3
        && overlay.dataset.earthquakeYearSummary === "hidden";
    });
    const earthquakeYearSummary = await page.locator("#japan-overlay").evaluate((element) => ({
      status: element.dataset.earthquakeYearSummary,
      width: Number(element.dataset.earthquakeSelectionLabelWidthPx),
      height: Number(element.dataset.earthquakeSelectionLabelHeightPx),
      primaryFont: Number(element.dataset.earthquakeSelectionPrimaryFontPx),
      profile: element.dataset.earthquakeSelectionLabelProfile,
    }));
    assert.equal(earthquakeYearSummary.status, "hidden");
    assert.equal(earthquakeYearSummary.profile, undefined);
    assert.equal(earthquakeYearSummary.width, 0);
    assert.equal(earthquakeYearSummary.height, 0);
    assert.equal(earthquakeYearSummary.primaryFont, 0);
    const earthquakeScreenshot = path.join(outputDir, `${viewport.name}-06-yearly-synchronized-waves.png`);
    await page.screenshot({ path: earthquakeScreenshot });
    scan.screenshots.push(earthquakeScreenshot);
    await page.waitForFunction(
      () => Number(document.querySelector("#japan-overlay")?.dataset.earthquakeWaveProgress) >= 0.999,
      null,
      { timeout: 5000 },
    );
    const earthquakeSettledScreenshot = path.join(outputDir, `${viewport.name}-06-estimated-felt-radius-settled.png`);
    await page.screenshot({ path: earthquakeSettledScreenshot });
    scan.screenshots.push(earthquakeSettledScreenshot);

    await selectMode(page, 6, "三つの生態系");
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.ecologiesPlot === "paired-bars-with-linked-scatter");
    const ecologySlider = page.locator("#japan-layer [data-signal-time]").first();
    await ecologySlider.evaluate((element) => {
      element.value = "50";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(120);
    const ecologyState = await page.locator("#japan-overlay").evaluate((element) => ({
      plot: element.dataset.ecologiesPlot,
      pairCount: Number(element.dataset.ecologiesPairCount),
      correlation: Number(element.dataset.ecologiesCorrelation),
      selectedCountry: element.dataset.ecologiesSelectedCountry,
      cultureCount: Number(element.dataset.ecologiesCultureCount),
    }));
    assert.equal(ecologyState.plot, "paired-bars-with-linked-scatter");
    assert.equal(ecologyState.pairCount, 31);
    assert.ok(ecologyState.correlation > 0.2 && ecologyState.correlation < 0.3);
    assert.ok(ecologyState.selectedCountry);
    assert.equal(ecologyState.cultureCount, 0);
    await waitForMapGuide(page);
    const ecologyGuide = await page.locator("#map-guide-reading").textContent();
    assert.match(ecologyGuide, /散布図.*回帰線.*相関係数r/u);
    const ecologyReadout = await page.locator("#japan-layer [data-signal-value]").first().innerText();
    assert.match(ecologyReadout, /森林率.*都市人口率/u);
    const ecologyScreenshot = path.join(outputDir, `${viewport.name}-07-forest-urban-correlation.png`);
    await page.screenshot({ path: ecologyScreenshot });
    scan.screenshots.push(ecologyScreenshot);

    await selectMode(page, 7, "人工物の共生化");
    await page.waitForFunction(() => {
      const overlay = document.querySelector("#japan-overlay");
      return overlay?.dataset.countryGeometryState === "ready"
        && Number(overlay.dataset.renewableCountryFillCount) === 208;
    });
    await slider.evaluate((element) => {
      element.value = "50";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(120);
    const renewableState = await page.locator("#japan-overlay").evaluate((element) => ({
      fillCount: Number(element.dataset.renewableCountryFillCount),
      scale: element.dataset.renewableFillScale,
      selectedCountry: element.dataset.renewableSelectedCountry,
      selectedPercent: Number(element.dataset.renewableSelectedPercent),
      connectionRemoved: element.dataset.energyConnectionRemoved,
      geometryState: element.dataset.countryGeometryState,
    }));
    assert.equal(renewableState.fillCount, 208);
    assert.equal(renewableState.scale, "country-blue-0-100");
    assert.ok(renewableState.selectedCountry);
    assert.ok(Number.isFinite(renewableState.selectedPercent));
    assert.equal(renewableState.connectionRemoved, "true");
    assert.equal(renewableState.geometryState, "ready");
    await waitForMapGuide(page);
    const renewableGuide = await page.locator("#map-guide-reading").textContent();
    assert.match(renewableGuide, /暗い青.*明るい水色/u);
    const renewableReadout = await page.locator("#japan-layer [data-signal-value]").first().innerText();
    assert.match(renewableReadout, /再生可能エネルギー発電割合.*%/u);
    const renewableScreenshot = path.join(outputDir, `${viewport.name}-08-renewable-country-choropleth.png`);
    await page.screenshot({ path: renewableScreenshot });
    scan.screenshots.push(renewableScreenshot);

    await selectMode(page, 8, "人口のうねり");
    await slider.press("Home");
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.populationSelectedYear === "1960");
    const populationStart = await page.locator("#japan-overlay").evaluate((element) => ({
      year: element.dataset.populationSelectedYear,
      count: Number(element.dataset.populationCircleCount),
      visibleCount: Number(element.dataset.populationVisibleCircleCount),
      encoding: element.dataset.populationEncoding,
    }));
    assert.equal(populationStart.year, "1960");
    assert.equal(populationStart.count, 216);
    assert(
      populationStart.visibleCount >= (viewport.name === "pc" ? 26 : 8),
      `population circles left the global viewport: ${JSON.stringify(populationStart)}`,
    );
    assert.equal(populationStart.encoding, "circle-area-proportional-to-population");
    await slider.press("End");
    await page.waitForFunction(() => document.querySelector("#japan-overlay")?.dataset.populationSelectedYear === "2025");
    const populationReadout = await page.locator("#japan-layer [data-signal-value]").first().innerText();
    assert.match(populationReadout, /2025.*人/u);
    await waitForMapGuide(page);
    const populationGuide = await page.locator("#map-guide-reading").textContent();
    assert.match(populationGuide, /円の面積.*人口に比例.*人口密度ではありません/u);
    await page.waitForFunction(() => !document.querySelector("#japan-layer")?.classList.contains("is-map-title-transitioning"));
    await page.waitForTimeout(400);
    const populationScreenshot = path.join(outputDir, `${viewport.name}-09-population-timeline.png`);
    await page.screenshot({ path: populationScreenshot });
    scan.screenshots.push(populationScreenshot);

    scan.final = await readMapState(page);
    report.scans.push(scan);
    await context.close();
    console.log(`PASS ${viewport.name}`);
  }
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

console.log(JSON.stringify({ status: report.status, scans: report.scans.length }, null, 2));
