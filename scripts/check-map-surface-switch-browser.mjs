import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
const tooltipOnly = process.argv.slice(6).includes("--tooltip-only");
const integrationOnly = process.argv.slice(6).includes("--integration-only");
const captureIntegratedModes = process.argv.slice(6).includes("--capture-integrated-modes");
const requestedViewport = process.argv.slice(6).find((argument) => argument.startsWith("--viewport="))?.slice("--viewport=".length) || "";
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/unified-world-bank");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const report = { consoleErrors: [], pageErrors: [], responses404: [], scans: [] };
const contentContext = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../app-content.js", import.meta.url), "utf8"), contentContext);
const mapContent = contentContext.window.GaiaAppContent;
const expectedCopies = Array.from(mapContent.modes.slice(0, 8), ({ id }) => mapContent.MAP_MODE_DESCRIPTIONS[id]);
const expectedCodes = ["AIR", "OCEAN", "FOREST", "RECYCLING", "CITY", "QUAKE", "ECOLOGIES", "ENERGY"];
const expectedLiveCopies = [
  "wind-field", "carbon-pulse", "rain-chorus", "temperature-field", "cloud-drift", "pm25-haze",
].map((id) => mapContent.MAP_MODE_DESCRIPTIONS[id]);

const focusModeButton = async (page, locator, expectedCopy = null) => {
  await page.keyboard.press("Tab");
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  await page.waitForFunction(() => document.activeElement?.matches?.(".map-mode-button:focus-visible"));
  await page.waitForFunction(() => document.querySelector("#map-mode-preview")?.classList.contains("is-open"));
  if (expectedCopy) {
    await page.waitForFunction((copy) => document.querySelector("#map-mode-preview-copy")?.textContent === copy, expectedCopy);
  }
};

try {
  for (const viewport of [
    { name: "pc", width: 1440, height: 900 },
    { name: "4k", width: 3840, height: 2088 },
    { name: "tablet", width: 768, height: 900 },
    { name: "mobile", width: 390, height: 844, isMobile: true },
    { name: "mobile-320", width: 320, height: 568, isMobile: true },
  ].filter(({ name }) => !requestedViewport || name === requestedViewport)) {
    const context = await browser.newContext({
      viewport,
      colorScheme: "dark",
      hasTouch: Boolean(viewport.isMobile),
      isMobile: Boolean(viewport.isMobile),
    });
    await context.addInitScript(() => {
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
      localStorage.setItem("gaiaSensewareTourSeen:v1", "true");
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("status of 401")) {
        report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    await page.goto(new URL("/?preview=gaia-unified-world-bank-1#japan", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.GaiaModeLoader?.load === "function");
    await page.evaluate(() => window.GaiaModeLoader.load("exploration"));
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
    await page.waitForFunction(() => document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => window.GaiaMapObservationAdapter.openMap());
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");

    assert.equal(await page.locator(".map-surface-switch").count(), 0, `${viewport.name}: obsolete MAP/LIGHT toggle remains`);
    assert.equal(await page.locator(".map-mode-bank .map-mode-button").count(), 30, `${viewport.name}: MAP button count`);
    assert.equal(await page.locator("#abstract-mode-list").count(), 0, `${viewport.name}: duplicate LIGHT bank remains`);
    assert.equal(await page.locator("#map-light-overlay").count(), 0, `${viewport.name}: independent light overlay remains`);

    if (viewport.name === "pc" && !integrationOnly) {
      const chapterSteps = page.locator(".map-dock-bank-step");
      assert.equal(await chapterSteps.count(), 2, "pc: standard chapter needs previous and next controls");
      assert.equal(await chapterSteps.first().isVisible(), true, "pc: previous chapter control is hidden");
      assert.equal(await chapterSteps.last().isVisible(), true, "pc: next chapter control is hidden");
      await chapterSteps.last().click();
      await page.waitForFunction(() => document.querySelector("#japan-mode-number")?.textContent?.trim() === "02");
      await chapterSteps.first().click();
      await page.waitForFunction(() => document.querySelector("#japan-mode-number")?.textContent?.trim() === "01");
    }

    if (!integrationOnly) {
      const dockBankTrigger = page.locator(".map-dock-bank-trigger");
      const mobileBankTrigger = page.locator("#map-mobile-bank-toggle");
      if (await mobileBankTrigger.isVisible()) await mobileBankTrigger.evaluate((button) => button.click());
      else if (await dockBankTrigger.isVisible()) await dockBankTrigger.evaluate((button) => button.click());
      await page.waitForFunction(() => [...document.querySelectorAll(".map-mode-bank .map-mode-button")]
        .every((button) => button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })));
    }
    await page.locator("#japan-close").focus();
    await page.waitForFunction(() => !document.querySelector("#map-mode-preview")?.classList.contains("is-open"));
    assert.equal(await page.locator("#map-mode-preview").getAttribute("aria-hidden"), "true", `${viewport.name}: preview is sticky without button intent`);

    const scan = await page.evaluate(() => {
      const bank = document.querySelector(".map-mode-bank");
      const bankRect = bank.getBoundingClientRect();
      const buttons = GaiaMapCategories.buttons();
      const buttonRects = buttons.map((button) => button.getBoundingClientRect());
      return {
        bank: bankRect.toJSON(),
        groupLabels: [...document.querySelectorAll(".map-category-group .map-mode-group-label strong")].map((label) => label.textContent.trim()),
        visibleButtons: buttons.filter((button) => button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).length,
        buttonHeights: buttonRects.map((rect) => rect.height),
        horizontalOverflow: Math.max(
          0,
          ...buttonRects.map((rect) => Math.max(-rect.left, rect.right - window.innerWidth)),
        ),
      };
    });
    const modeLabelTypography = [];
    assert.deepEqual(scan.groupLabels, ["気候と炭素", "空と天気", "水と森", "人口と暮らし", "資源とエネルギー", "大地の活動"], `${viewport.name}: the main bank uses one subject taxonomy`);
    if (!integrationOnly) {
      assert.equal(scan.visibleButtons, 30, `${viewport.name}: all map buttons must remain in the scrollable picker`);
      assert.ok(scan.buttonHeights.every((height) => height >= (viewport.isMobile ? 44 : 30)), `${viewport.name}: button target is too short`);
      assert.ok(scan.horizontalOverflow <= 1, `${viewport.name}: bank overflows horizontally by ${scan.horizontalOverflow}px`);
    }
    const headingScan = await page.locator("#japan-layer .japan-heading").evaluate((heading) => {
      const title = heading.querySelector("#japan-title");
      const titleRect = title.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      return {
        kickerDisplay: getComputedStyle(heading.querySelector(".japan-kicker")).display,
        descriptionWidth: heading.querySelector("#japan-description").getBoundingClientRect().width,
        titleCenterDelta: Math.abs((titleRect.left + titleRect.right) / 2 - (headingRect.left + headingRect.right) / 2),
      };
    });
    assert.equal(headingScan.kickerDisplay, "none", `${viewport.name}: the redundant heading kicker is still visible`);
    assert.ok(headingScan.descriptionWidth <= 1, `${viewport.name}: the redundant heading description is still visible`);
    if (viewport.name === "pc") {
      assert.ok(headingScan.titleCenterDelta <= 1, `${viewport.name}: the exhibit title is not centered (${headingScan.titleCenterDelta}px)`);
    }

    if (!integrationOnly) {
    for (const index of expectedCopies.keys()) {
      await focusModeButton(page, page.locator(`.map-mode-bank [data-map-standard-index="${index}"]`), expectedCopies[index]);
      assert.equal(await page.locator("#map-mode-preview-copy").textContent(), expectedCopies[index], `${viewport.name}: MAP ${index + 1} copy`);
      assert.equal(await page.locator("#map-mode-preview-number").textContent(), `${String(index + 1).padStart(2, "0")} / ${expectedCodes[index]}`);
    }
    await page.waitForTimeout(320);

    const previewScan = await page.locator("#map-mode-preview").evaluate((node) => ({
      rect: node.getBoundingClientRect().toJSON(),
      anchorRect: GaiaMapCategories.buttons()
        .find((button) => button.textContent?.trim() === node.querySelector("span")?.textContent?.trim().slice(0, 2))
        ?.getBoundingClientRect().toJSON() || null,
      numberSize: parseFloat(getComputedStyle(node.querySelector("span")).fontSize),
      titleSize: parseFloat(getComputedStyle(node.querySelector("b")).fontSize),
      copySize: parseFloat(getComputedStyle(node.querySelector("p")).fontSize),
    }));
    assert.equal(await page.locator("#map-mode-preview").isVisible(), true, `${viewport.name}: focus preview is hidden: ${JSON.stringify(previewScan)}`);
    assert.ok(previewScan.rect.top >= -1 && previewScan.rect.bottom <= viewport.height + 1, `${viewport.name}: preview leaves the viewport: ${JSON.stringify(previewScan.rect)}`);
    assert.ok(previewScan.numberSize >= 10 && previewScan.titleSize >= 15 && previewScan.copySize >= 13, `${viewport.name}: preview type is too small: ${JSON.stringify(previewScan)}`);
    if (viewport.name === "pc") {
      const horizontalGap = previewScan.rect.left >= previewScan.anchorRect.right
        ? previewScan.rect.left - previewScan.anchorRect.right
        : previewScan.anchorRect.left - previewScan.rect.right;
      assert.ok(horizontalGap >= 0 && horizontalGap <= 12, `${viewport.name}: preview is too far from its button: ${JSON.stringify(previewScan)}`);
    }

    if (tooltipOnly) {
      const screenshot = path.join(outputDir, `${viewport.name}-tooltip.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      report.scans.push({ viewport, screenshot, preview: previewScan, ...scan });
      await context.close();
      continue;
    }

    const mouseSelection = page.locator('.map-mode-bank [data-map-standard-index="1"]');
    if (viewport.isMobile) await mouseSelection.tap();
    else await mouseSelection.click();
    await page.waitForFunction(() => document.querySelector('.map-mode-bank [data-map-standard-index="1"]')?.getAttribute("aria-current") === "true");
    const buttonTransition = await mouseSelection.evaluate((button) => ({
      animationName: getComputedStyle(button).animationName,
      transitionDuration: getComputedStyle(button).transitionDuration,
    }));
    assert(buttonTransition.animationName.includes("map-mode-button-selected"), `${viewport.name}: selected button has no transition animation`);
    assert.notEqual(buttonTransition.transitionDuration, "0s", `${viewport.name}: button transitions are disabled`);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    if (!viewport.isMobile) await page.mouse.move(viewport.width - 4, viewport.height - 4);
    await page.waitForFunction(() => !document.querySelector("#map-mode-preview")?.classList.contains("is-open"));
    await page.waitForFunction(() => {
      const preview = document.querySelector("#map-mode-preview");
      if (!(preview instanceof HTMLElement)) return false;
      const style = getComputedStyle(preview);
      return Number(style.opacity) <= 0.01 && style.visibility === "hidden";
    });
    const dismissedPreview = await page.locator("#map-mode-preview").evaluate((preview) => ({
      ariaHidden: preview.getAttribute("aria-hidden"),
      opacity: Number(getComputedStyle(preview).opacity),
      visibility: getComputedStyle(preview).visibility,
      transitionDuration: getComputedStyle(preview).transitionDuration,
    }));
    assert.equal(dismissedPreview.ariaHidden, "true", `${viewport.name}: preview remains exposed after intent leaves`);
    assert(dismissedPreview.opacity <= 0.01, `${viewport.name}: preview did not fade out`);
    assert.equal(dismissedPreview.visibility, "hidden", `${viewport.name}: preview remains visible`);
    assert.notEqual(dismissedPreview.transitionDuration, "0s", `${viewport.name}: preview has no transition`);

    if (await page.locator("#map-mobile-bank-toggle").isVisible()) {
      if (await page.locator("#map-mobile-bank-toggle").getAttribute("aria-expanded") !== "true") {
        await page.locator("#map-mobile-bank-toggle").click();
      }
    } else if (viewport.width > 900 && await page.locator(".map-dock-bank-trigger").getAttribute("aria-expanded") !== "true") {
      await page.locator(".map-dock-bank-trigger").click();
      await page.waitForFunction(() => document.querySelector(".map-dock-bank-trigger")?.getAttribute("aria-expanded") === "true");
      await page.waitForTimeout(80);
    }

    for (const [index, copy] of expectedLiveCopies.entries()) {
      try {
        await focusModeButton(page, page.locator(".map-mode-bank .map-mode-button[data-live-exhibit]").filter({ hasText: new RegExp(`^${index + 10}$`) }), copy);
      } catch (error) {
        const state = await page.evaluate(() => ({
          expanded: document.querySelector("#japan-layer")?.classList.contains("is-mobile-bank-expanded"),
          toggleExpanded: document.querySelector("#map-mobile-bank-toggle")?.getAttribute("aria-expanded"),
          activeText: document.activeElement?.textContent?.trim() || "",
          liveRects: [...document.querySelectorAll(".map-mode-bank .map-mode-button[data-live-exhibit]")].map((button) => button.getBoundingClientRect().toJSON()),
          previewOpen: document.querySelector("#map-mode-preview")?.classList.contains("is-open"),
        }));
        throw new Error(`${viewport.name}: LIVE ${index + 9} focus failed: ${JSON.stringify(state)}`, { cause: error });
      }
      assert.equal(await page.locator("#map-mode-preview-copy").textContent(), copy, `${viewport.name}: LIVE ${index + 9} copy`);
    }
    }

    await page.locator('.map-mode-bank [data-live-exhibit="wind-field"]').evaluate((button) => button.click());
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit")
      && !document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light")
      && document.querySelector("#gaia-canvas")?.parentElement?.id !== "japan-map");

    if (viewport.name === "pc") {
      const liveSelectorToggle = page.locator(".gaia-live-deck-selector-toggle");
      assert.equal(await liveSelectorToggle.isVisible(), true, "pc: live chapter center control is hidden");
      assert.equal(await liveSelectorToggle.locator("i").count(), 0, "pc: chapter title must not show a dropdown chevron");
      assert.equal(await liveSelectorToggle.getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator(".map-dock-bank-popover").isVisible(), false, "pc: shared selector should start collapsed");
      await liveSelectorToggle.click();
      await page.waitForFunction(() => document.querySelector(".map-mode-bank")?.classList.contains("is-dock-bank-expanded"));
      assert.equal(await page.locator(".map-dock-bank-popover").isVisible(), true, "pc: shared selector did not open");
      assert.equal(await page.locator(".map-mode-bank .map-mode-button").count(), 30, "pc: selector must expose every map chapter");
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(outputDir, "pc-live-chapter-selector-open.png"), fullPage: false });
      await page.locator('.map-mode-bank [data-live-exhibit="cloud-drift"]').click();
      await page.waitForFunction(() => document.querySelector("#japan-mode-number")?.textContent?.trim() === "19"
        && document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit")
        && !document.querySelector(".map-mode-bank")?.classList.contains("is-dock-bank-expanded"));
      await liveSelectorToggle.click();
      await page.locator('.map-mode-bank [data-map-standard-index="1"]').click();
      await page.waitForFunction(() => document.querySelector("#japan-mode-number")?.textContent?.trim() === "07"
        && !document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit")
        && !document.querySelector(".map-mode-bank")?.classList.contains("is-dock-bank-expanded"));
      await page.locator('.map-mode-bank [data-live-exhibit="wind-field"]').evaluate((button) => button.click());
      const liveChapterSteps = page.locator(".gaia-live-deck-chapter [data-live-deck-step]");
      await liveChapterSteps.first().click();
      await page.waitForFunction(() => document.querySelector("#japan-mode-number")?.textContent?.trim() === "09"
        && !document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit"));
      await page.locator(".map-dock-bank-step--next").click();
      await page.waitForFunction(() => document.querySelector("#japan-mode-number")?.textContent?.trim() === "10"
        && document.querySelector("#japan-layer")?.classList.contains("is-live-exhibit"));
    }

    for (const index of expectedCopies.keys()) {
      if (viewport.isMobile && await page.locator("#map-mobile-bank-toggle").getAttribute("aria-expanded") !== "true") {
        await page.locator("#map-mobile-bank-toggle").click();
      }
      const expected = String(index + 1).padStart(2, "0");
      await page.locator(`.map-mode-bank [data-map-standard-index="${index}"]`).evaluate((button) => button.click());
      await page.waitForFunction((number) => document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light")
        && document.querySelector("#gaia-canvas")?.parentElement?.id === "japan-map"
        && document.querySelector("#gaia-canvas")?.dataset.integratedMapMode === number
        && document.querySelector("#japan-mode-number")?.textContent?.trim() === number, expected);
      if (captureIntegratedModes) {
        // The title separator runs first, then POIs reveal across 1.61 seconds.
        // Capture only after the complete entrance so late-order selected POIs
        // (notably Japan in MAP 05) cannot disappear from visual evidence.
        await page.waitForTimeout(3300);
        // MAP 03–08 share this country/event label. The active selection can be
        // outside a narrow viewport, so validate it whenever it is actually drawn.
        if (index >= 2) {
          const labelTypography = await page.locator("#japan-overlay").evaluate((element) => ({
            shape: element.dataset.selectionLabelShape,
            width: Number(element.dataset.selectionLabelWidthPx),
            height: Number(element.dataset.selectionLabelHeightPx),
            primaryFont: Number(element.dataset.selectionLabelPrimaryFontPx),
            secondaryFont: Number(element.dataset.selectionLabelSecondaryFontPx),
          }));
          if (labelTypography.primaryFont > 0) {
            const compact = viewport.width < 600;
            const expansive = viewport.width >= 2400;
            const short = viewport.height < 500 || (compact && viewport.height < 650);
            const landscape = viewport.width < 900 && viewport.height < 420;
            assert.equal(labelTypography.shape, "observation-card");
            assert.ok(labelTypography.width <= viewport.width - 32);
            assert.ok(labelTypography.height > 70 && labelTypography.height < viewport.height - 32);
            assert.equal(labelTypography.primaryFont, landscape ? 14 : short ? 16 : compact ? 19 : expansive ? 30 : 23);
            assert.equal(labelTypography.secondaryFont, landscape ? 12 : short ? 13 : compact ? 14 : expansive ? 22 : 17);
            modeLabelTypography.push({ mode: expected, ...labelTypography });
          }
        }
        await page.screenshot({ path: path.join(outputDir, `${viewport.name}-map-${expected}-integrated-light.png`), fullPage: false });
      }
    }

    const integrationScan = await page.evaluate(() => ({
      surface: document.querySelector(".map-mode-bank")?.dataset.mapSurface,
      lightIntegration: document.querySelector(".map-mode-bank")?.dataset.lightIntegration,
      overlayActive: document.querySelector("#japan-layer")?.classList.contains("has-integrated-map-light"),
      currentMap: document.querySelector(".map-mode-bank .map-mode-button[aria-current='true']")?.textContent.trim(),
      integratedMode: document.querySelector("#gaia-canvas")?.dataset.integratedMapMode,
      mapVisible: document.querySelector("#japan-map")?.getClientRects().length > 0,
      canvasParent: document.querySelector("#gaia-canvas")?.parentElement?.id,
      canvasOpacity: Number(getComputedStyle(document.querySelector("#gaia-canvas")).opacity),
      canvasPointerEvents: getComputedStyle(document.querySelector("#gaia-canvas")).pointerEvents,
    }));
    assert.deepEqual(integrationScan, {
      surface: "map",
      lightIntegration: "mode-matched",
      overlayActive: true,
      currentMap: "08",
      integratedMode: "08",
      mapVisible: true,
      canvasParent: "japan-map",
      canvasOpacity: 0.17,
      canvasPointerEvents: "none",
    }, `${viewport.name}: MAP 01—09 did not receive their matching integrated light`);

    const screenshot = path.join(outputDir, `${viewport.name}-unified-world-bank.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.scans.push({ viewport, screenshot, modeLabelTypography, ...scan });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join("\n")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join("\n")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`GAIA integrated map-light browser checks passed: ${report.scans.length} viewports, 30 controls in 6 subject categories, restored focus copy.`);
} finally {
  await browser.close();
}
