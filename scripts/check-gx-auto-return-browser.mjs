import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4430"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/gx-auto-return-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1080p", width: 1920, height: 1080 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const stateFor = (storyVersion) => ({
  storyVersion,
  stepId: "gx_experience_017",
  reachedSceneIds: ["festival_concept", "map_mode01", "gx_experience"],
  viewed: {},
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "太古の海",
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  audio: { muted: true, volume: 0 },
  readStepIds: ["gx_experience_016"],
  clear: false,
  archivesUnlocked: false,
  sessionId: "gx-auto-return-check",
});

const bootAtGX = async (page) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const progress = stateFor(storyVersion);
  await page.evaluate((savedProgress) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(savedProgress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: savedProgress,
      savedAt: Date.now(),
      meta: { title: "GX auto-return QA", excerpt: savedProgress.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  if (await page.locator("#novel-resume-button").isVisible()) {
    await page.locator("#novel-resume-button").click();
  }
  if (await page.locator("#novel-save-panel").isVisible()) {
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction(() => (
    document.querySelector("#novel-layer")?.dataset.stepId === "gx_experience_017"
    && document.body.classList.contains("gx-story-open")
    && document.querySelector("#gx-layer")?.hidden === false
  ));
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.addInitScript(() => {
      globalThis.__gxAutoReturnEvents = { progress: [], returns: 0 };
      addEventListener("gaia:gx-story-progress", (event) => {
        globalThis.__gxAutoReturnEvents.progress.push({ ...event.detail });
      });
      addEventListener("gaia:gx-return-to-novel", () => {
        globalThis.__gxAutoReturnEvents.returns += 1;
      });
    });
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push({ viewport: viewport.name, text: message.text() });
    });
    page.on("pageerror", (error) => report.pageErrors.push({ viewport: viewport.name, text: error.message }));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push({ viewport: viewport.name, url: response.url() });
    });

    await bootAtGX(page);
    const open = await page.evaluate(() => ({
      phase: document.querySelector("#gx-phase-index")?.textContent?.trim(),
      returnButtonCount: document.querySelectorAll("#story-detour-return").length,
      dockCount: document.querySelectorAll("#gx-layer .story-detour-dock").length,
      closeDisabled: document.querySelector("#gx-close")?.disabled,
      skipVisible: !document.querySelector("#gx-modal-skip")?.hidden,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.deepEqual(open, {
      phase: "01 / 08",
      returnButtonCount: 0,
      dockCount: 0,
      closeDisabled: true,
      skipVisible: true,
      horizontalOverflow: false,
    }, `${viewport.name}: GX did not open as a dockless, guarded story modal`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-dockless.png`), fullPage: false });

    const transitionTitle = await page.evaluate(() => {
      const transition = document.querySelector("#gx-era-transition");
      const title = document.querySelector("#gx-era-transition-title");
      title.textContent = "埋められた炭素の上に、新しい生命圏が広がる。";
      transition.classList.add("is-visible");
      const range = document.createRange();
      range.selectNodeContents(title);
      const titleRect = title.getBoundingClientRect();
      const transitionRect = transition.getBoundingClientRect();
      const lineTops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
      return {
        lineCount: lineTops.size,
        whiteSpace: getComputedStyle(title).whiteSpace,
        insideLeft: titleRect.left >= transitionRect.left - 1,
        insideRight: titleRect.right <= transitionRect.right + 1,
      };
    });
    assert.deepEqual(transitionTitle, {
      lineCount: 1,
      whiteSpace: "nowrap",
      insideLeft: true,
      insideRight: true,
    }, `${viewport.name}: the long era-transition title did not stay on one line`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-transition-nowrap.png`), fullPage: false });
    await page.evaluate(() => document.querySelector("#gx-era-transition")?.classList.remove("is-visible"));

    await page.locator("#gx-modal-skip").waitFor({ state: "visible", timeout: 3000 });
    const readSkipControl = () => page.evaluate(() => {
      const layer = document.querySelector("#gx-layer");
      const transition = document.querySelector("#gx-era-transition");
      const skip = document.querySelector("#gx-modal-skip");
      const header = document.querySelector("#gx-layer .gx-header");
      const timePanel = document.querySelector("#gx-layer .gx-time");
      const audioDock = document.querySelector("#gaia-audio-dock");
      const layerRect = layer.getBoundingClientRect();
      const skipRect = skip.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const timeRect = timePanel.getBoundingClientRect();
      const audioRect = audioDock?.getBoundingClientRect();
      const audioStyle = audioDock && getComputedStyle(audioDock);
      const overlaps = (first, second) => !(
        first.right <= second.left
        || first.left >= second.right
        || first.bottom <= second.top
        || first.top >= second.bottom
      );
      const overlapsHeader = overlaps(skipRect, headerRect);
      const overlapsTime = overlaps(skipRect, timeRect);
      const audioInFront = audioRect && audioDock.contains(document.elementFromPoint(
        Math.min(skipRect.right - 2, audioRect.right - 2),
        Math.max(skipRect.top + 2, audioRect.top + 2),
      ));
      const overlapsAudio = audioRect && audioRect.width > 0 && audioRect.height > 0 && audioInFront
        && audioStyle.visibility !== "hidden" && audioStyle.display !== "none" && Number(audioStyle.opacity) > 0
        ? overlaps(skipRect, audioRect)
        : false;
      return {
        text: skip.querySelector("span")?.textContent?.trim(),
        ariaLabel: skip.getAttribute("aria-label"),
        width: Math.round(skipRect.width),
        height: Math.round(skipRect.height),
        topGap: Math.round(skipRect.top - layerRect.top),
        rightGap: Math.round(layerRect.right - skipRect.right),
        inside: skipRect.top >= layerRect.top - 1
          && skipRect.right <= layerRect.right + 1
          && skipRect.bottom <= layerRect.bottom + 1
          && skipRect.left >= layerRect.left - 1,
        overlapsHeader,
        overlapsTime,
        overlapsAudio,
        phase: document.querySelector("#gx-phase-index")?.textContent?.trim(),
        visible: !skip.hidden && getComputedStyle(skip).display !== "none" && skipRect.width > 0 && skipRect.height > 0,
        transitionVisible: transition.classList.contains("is-visible")
          && transition.getAttribute("aria-hidden") === "false",
      };
    });
    const initialSkip = await readSkipControl();
    assert.equal(initialSkip.text, "スキップ", `${viewport.name}: GX modal skip label changed`);
    assert.equal(initialSkip.ariaLabel, "GXモーダルをスキップしてストーリーへ戻る", `${viewport.name}: GX modal skip accessible label changed`);
    assert(initialSkip.width >= 106 && initialSkip.height >= 44, `${viewport.name}: GX modal skip hit area is too small`);
    assert(initialSkip.topGap >= 0 && initialSkip.rightGap >= 0 && initialSkip.rightGap <= 60 && initialSkip.inside, `${viewport.name}: GX modal skip is not inside the upper-right corner`);
    assert.equal(initialSkip.overlapsHeader, false, `${viewport.name}: GX modal skip overlaps the GX heading`);
    assert.equal(initialSkip.overlapsTime, false, `${viewport.name}: GX modal skip overlaps the era counter`);
    assert.equal(initialSkip.overlapsAudio, false, `${viewport.name}: GX modal skip overlaps the audio control`);
    assert.equal(initialSkip.visible, true, `${viewport.name}: GX modal skip is hidden before an era transition`);
    assert.equal(initialSkip.transitionVisible, false, `${viewport.name}: GX opened in an unexpected transition state`);
    assert.equal(initialSkip.phase, "01 / 08", `${viewport.name}: GX did not start at the first era`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-modal-skip-always-visible.png`), fullPage: false });

    await page.keyboard.press("Enter");
    await page.waitForFunction(() => (
      document.querySelector("#gx-era-transition")?.classList.contains("is-visible")
      && document.querySelector("#gx-modal-skip")?.hidden === false
    ), null, { timeout: 3000 });
    const transitionSkip = await readSkipControl();
    assert.equal(transitionSkip.visible, true, `${viewport.name}: GX modal skip disappeared during an era transition`);
    assert.equal(transitionSkip.transitionVisible, true, `${viewport.name}: era transition did not start`);
    assert.equal(transitionSkip.phase, "01 / 08", `${viewport.name}: era advanced before the modal skip was clicked`);

    const readLayerGeometry = () => page.evaluate(() => {
      const layer = document.querySelector("#gx-layer");
      const rect = layer.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        opacity: Number.parseFloat(getComputedStyle(layer).opacity),
        transform: getComputedStyle(layer).transform,
        hidden: layer.hidden,
        open: layer.classList.contains("is-open"),
        storyGeometryActive: document.body.classList.contains("gx-story-open"),
      };
    });
    const beforeClose = await readLayerGeometry();
    const skipStartedAt = Date.now();
    await page.locator("#gx-modal-skip").click();
    await page.waitForTimeout(120);
    const duringClose = await readLayerGeometry();
    for (const property of ["top", "left", "width", "height"]) {
      assert(
        Math.abs(duringClose[property] - beforeClose[property]) <= 1,
        `${viewport.name}: GX moved during its closing fade (${property}: ${beforeClose[property]} -> ${duringClose[property]})`,
      );
    }
    assert.equal(duringClose.transform, beforeClose.transform, `${viewport.name}: GX transform changed during its closing fade`);
    assert.equal(duringClose.hidden, false, `${viewport.name}: GX was hidden before its fade completed`);
    assert.equal(duringClose.open, false, `${viewport.name}: GX retained its open state while closing`);
    assert.equal(duringClose.storyGeometryActive, true, `${viewport.name}: story modal geometry was released before the fade completed`);
    assert(duringClose.opacity > 0 && duringClose.opacity < beforeClose.opacity, `${viewport.name}: GX did not fade in place`);
    await page.waitForFunction(() => (
      globalThis.GaiaNovel.getState().stepId === "gx_experience_018"
      && !document.body.classList.contains("gx-story-open")
      && document.querySelector("#gx-layer")?.hidden === true
    ), null, { timeout: 5000 });
    const skipElapsedMs = Date.now() - skipStartedAt;
    assert(skipElapsedMs < 1800, `${viewport.name}: GX modal skip took ${skipElapsedMs}ms`);

    const closed = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      completed: globalThis.GaiaNovel.getState().viewed.gxDeepTime === true,
      returnButtonCount: document.querySelectorAll("#story-detour-return").length,
      returns: globalThis.__gxAutoReturnEvents.returns,
      finalCompleteEvents: globalThis.__gxAutoReturnEvents.progress.filter((event) => event.complete === true).length,
      highestReportedPhase: Math.max(...globalThis.__gxAutoReturnEvents.progress.map((event) => Number(event.phase) || 0)),
      skipHidden: document.querySelector("#gx-modal-skip")?.hidden,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(closed.stepId, "gx_experience_018");
    assert.equal(closed.completed, true);
    assert.equal(closed.returnButtonCount, 0);
    assert.equal(closed.returns, 1);
    assert(closed.finalCompleteEvents >= 1, `${viewport.name}: modal skip completion was not announced`);
    assert.equal(closed.highestReportedPhase, 1, `${viewport.name}: modal skip advanced a generation instead of closing GX`);
    assert.equal(closed.skipHidden, true, `${viewport.name}: modal skip remained visible after GX closed`);
    assert.equal(closed.horizontalOverflow, false);

    await page.evaluate(() => globalThis.GaiaGX.open({ returnTo: "intro", phase: 3 }));
    await page.locator("#gx-modal-skip").waitFor({ state: "visible", timeout: 3000 });
    const introSkip = await page.evaluate(() => ({
      ariaLabel: document.querySelector("#gx-modal-skip")?.getAttribute("aria-label"),
      phase: document.querySelector("#gx-phase-index")?.textContent?.trim(),
      visible: !document.querySelector("#gx-modal-skip")?.hidden,
    }));
    assert.deepEqual(introSkip, {
      ariaLabel: "GXモーダルをスキップして入口へ戻る",
      phase: "04 / 08",
      visible: true,
    }, `${viewport.name}: standalone GX modal skip is not persistently available`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-modal-skip-intro.png`), fullPage: false });
    await page.locator("#gx-modal-skip").click();
    await page.waitForFunction(() => document.querySelector("#gx-layer")?.hidden === true, null, { timeout: 3000 });
    const introClosed = await page.evaluate(() => ({
      storyStep: globalThis.GaiaNovel.getState().stepId,
      returns: globalThis.__gxAutoReturnEvents.returns,
      gxOpen: document.body.classList.contains("gx-open"),
    }));
    assert.deepEqual(introClosed, { storyStep: "gx_experience_018", returns: 1, gxOpen: false });
    report.scans.push({ viewport: viewport.name, open, initialSkip, transitionSkip, beforeClose, duringClose, skipElapsedMs, closed, introSkip, introClosed, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${JSON.stringify(report.consoleErrors)}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${JSON.stringify(report.pageErrors)}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${JSON.stringify(report.responses404)}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`GX auto-return browser check passed: ${report.scans.length} viewports`);
