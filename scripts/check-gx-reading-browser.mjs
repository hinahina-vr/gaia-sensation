import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot = "node_modules/playwright-core", executablePath = "C:/Program Files/Google/Chrome/Application/chrome.exe", outputArgument = "artifacts/gx-reading", baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
const moduleEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs") : path.join(moduleRoot, "playwright/index.mjs");
const { chromium } = await import(pathToFileURL(path.resolve(moduleEntry)).href);
const phases = JSON.parse(fs.readFileSync(new URL("../data/gx-deep-time.json", import.meta.url))).phases;
const output = path.resolve(outputArgument);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const report = { status: "running", scans: [], errors: [] };
const viewports = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-mobile", width: 320, height: 568 },
  { name: "landscape", width: 844, height: 390 },
];

const inspect = (page) => page.evaluate(() => {
  const get = (id) => document.getElementById(id);
  const rect = (id) => get(id).getBoundingClientRect();
  const layer = rect("gx-layer");
  const skip = rect("gx-modal-skip");
  const title = rect("gx-title");
  const time = rect("gx-time");
  const summary = rect("gx-phase-summary");
  const card = rect("gx-story-card");
  const controls = rect("gx-controls");
  const phaseTitle = get("gx-phase-title");
  const titleRange = document.createRange();
  titleRange.selectNodeContents(phaseTitle);
  const titleRects = [...titleRange.getClientRects()];
  const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const inside = (a) => a.left >= layer.left - 1 && a.right <= layer.right + 1 && a.top >= layer.top - 1 && a.bottom <= layer.bottom + 1;
  const portrait = layer.width <= 620;
  const story = get("gx-layer").dataset.returnTo === "novel";
  const planetX = layer.left + layer.width * (portrait ? 0.5 : story ? 0.69 : 0.76);
  const planetY = layer.top + layer.height * (portrait ? layer.height <= 650 ? 0.3 : 0.36 : story ? 0.5 : 0.48);
  return {
    phase: get("gx-phase-index").textContent.trim(),
    phaseTitle: phaseTitle.textContent,
    phaseTitleLines: new Set(titleRects.map((box) => Math.round(box.top))).size,
    summary: get("gx-phase-summary").textContent,
    detailsHidden: get("gx-mobile-info").hidden,
    toggleExpanded: get("gx-mobile-info-toggle").getAttribute("aria-expanded"),
    skip: get("gx-modal-skip").textContent.replace(/\s/g, ""),
    skipRight: layer.right - skip.right,
    skipTop: skip.top - layer.top,
    skipHeight: skip.height,
    skipInside: inside(skip),
    skipOverlaps: overlap(skip, title) || overlap(skip, time),
    titleOverflow: get("gx-title").scrollWidth > get("gx-title").clientWidth + 1,
    phaseTitleOverflow: get("gx-phase-title").scrollWidth > get("gx-phase-title").clientWidth + 1,
    summaryInside: inside(summary),
    summaryClipped: summary.top < layer.top || summary.bottom > (portrait ? card.bottom : rect("gx-reading").bottom) + 1,
    controlsInside: inside(controls),
    cardOverlapsControls: overlap(card, controls),
    planetHitCanvas: document.elementFromPoint(planetX, planetY)?.id === "gx-canvas",
    planetPoint: { x: planetX, y: planetY },
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    guide: get("gx-phase-guide").textContent.trim(),
    progressAria: get("gx-era-progress-bar").parentElement.getAttribute("aria-valuenow"),
    cardHeight: card.height,
    layerHeight: layer.height,
    layerInsideViewport: layer.left >= -1 && layer.top >= -1 && layer.right <= innerWidth + 1 && layer.bottom <= innerHeight + 1,
  };
});

try {
  for (const viewport of viewports.filter((item) => !process.env.GX_QA_VIEWPORTS || process.env.GX_QA_VIEWPORTS.split(",").includes(item.name))) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push({ viewport: viewport.name, error: error.message }));
    page.on("response", (response) => {
      if (response.status() === 404) report.errors.push({ viewport: viewport.name, status: 404, url: response.url() });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaModeLoader));
    await page.evaluate(async () => {
      await globalThis.GaiaModeLoader.load("gx");
      const opening = document.getElementById("gaia-opening");
      opening.hidden = true;
      opening.classList.remove("is-active");
      document.body.classList.remove("gaia-opening-active");
      const intro = document.getElementById("intro-layer");
      if (intro) intro.hidden = true;
    });
    for (const returnTo of ["novel", "intro"]) {
      await page.evaluate((returnTo) => {
        // Match the story engine's embedded-interaction state, which owns its dialogue.
        document.body.dataset.novelInteractionState = returnTo === "novel" ? "open" : "";
        return globalThis.GaiaGX.open({ returnTo, storyMode: "reading-qa", phase: 0 });
      }, returnTo);
      await page.waitForFunction(() => document.getElementById("gx-layer").classList.contains("is-open") && document.getElementById("gx-loading").hidden);
      await page.evaluate(() => document.fonts.ready);
      for (let index = 0; index < phases.length; index++) {
        await page.evaluate((index) => globalThis.GaiaGX.setPhase(index), index);
        const state = await inspect(page);
        const label = `${viewport.name}/${returnTo}/phase-${index + 1}`;
        report.scans.push({ label, ...state });
        if (["desktop", "mobile"].includes(viewport.name) && returnTo === "novel" || index === 5) {
          await page.screenshot({ path: path.join(output, `${viewport.name}-${returnTo}-${index + 1}.png`) });
        }
        assert.equal(state.summary, phases[index].summary, `${label}: wrong summary`);
        assert.equal(state.phase, phases[index].index, `${label}: wrong phase`);
        assert.equal(state.phaseTitle, phases[index].title, `${label}: wrong title`);
        assert.equal(state.phaseTitleLines, 1, `${label}: phase title wraps`);
        assert.equal(state.detailsHidden, true, `${label}: details did not reset`);
        assert.equal(state.toggleExpanded, "false");
        assert.equal(state.skip, "スキップ▶");
        assert(state.skipRight >= 0 && state.skipRight <= 62 && state.skipTop >= 0 && state.skipTop <= 28, `${label}: skip is not top-right`);
        assert(state.skipInside && state.skipHeight >= 44 && !state.skipOverlaps, `${label}: skip overlap or hit area`);
        for (const key of ["titleOverflow", "phaseTitleOverflow", "summaryClipped", "cardOverlapsControls", "horizontalOverflow"]) {
          assert.equal(state[key], false, `${label}: ${key}`);
        }
        assert(state.summaryInside && state.controlsInside && state.planetHitCanvas && state.layerInsideViewport, `${label}: text, controls or planet are obstructed`);
        assert(state.guide.length > 0 && state.progressAria !== null, `${label}: missing gesture/progress`);
        await page.locator("#gx-mobile-info-toggle").click();
        assert.equal(await page.locator("#gx-mobile-info").getAttribute("hidden"), null);
        const expanded = await inspect(page);
        assert.equal(expanded.phaseTitleLines, 1, `${label}: expanded title wraps`);
        assert.equal(expanded.phaseTitleOverflow, false, `${label}: expanded title overflow`);
        assert.equal(await page.locator("#gx-phase-copy").textContent(), phases[index].copy);
        await page.locator("#gx-data").scrollIntoViewIfNeeded();
        assert(await page.locator("#gx-data").isVisible(), `${label}: source button inaccessible`);
        if (index === 5) await page.screenshot({ path: path.join(output, `${viewport.name}-${returnTo}-details.png`) });
        await page.locator("#gx-mobile-info-toggle").click();
        assert.equal(await page.locator("#gx-mobile-info-toggle").getAttribute("aria-expanded"), "false");
        assert.deepEqual(await page.evaluate(() => [document.getElementById("gx-story-card").scrollTop, document.getElementById("gx-reading").scrollTop]), [0, 0]);
      }
      await page.locator("#gx-mobile-info-toggle").click();
      await page.locator("#gx-data").click();
      await page.waitForFunction(() => document.getElementById("gx-data-panel").getAttribute("aria-hidden") === "false");
      assert(await page.locator("#gx-source-list a").count() >= 7);
      await page.locator("#gx-data-close").click();
      assert.equal(await page.evaluate(() => document.activeElement.id), "gx-data");
      await page.locator("#gx-restart").click();
      await page.waitForFunction(() => document.getElementById("gx-phase-index").textContent.trim() === "01 / 08");
      const target = (await inspect(page)).planetPoint;
      await page.mouse.click(target.x, target.y);
      assert(Number(await page.locator(".gx-era-progress__track").getAttribute("aria-valuenow")) > 0, `${viewport.name}/${returnTo}: globe pointer input blocked`);
      // All eight targets must remain reachable after the globe's repositioning.
      if (returnTo === "novel") {
        await page.locator("#gx-canvas").focus();
        for (let index = 0; index < phases.length; index++) {
          await page.keyboard.press("Enter");
          await page.waitForFunction((nextPhase) => nextPhase
            ? document.getElementById("gx-phase-index").textContent.trim() === nextPhase
            : document.getElementById("gx-layer").hidden, phases[index + 1]?.index || null, { timeout: 5000 });
        }
      } else {
        await page.locator("#gx-modal-skip").click();
      }
      await page.waitForFunction(() => document.getElementById("gx-layer").hidden);
    }
    await context.close();
    console.log(`${viewport.name}: all 8 eras, both entry modes, details, sources, restart, gestures and skip passed`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
