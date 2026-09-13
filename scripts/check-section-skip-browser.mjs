import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/section-skip-browser");
fs.mkdirSync(outputDir, { recursive: true });

const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v4";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 568 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const baseState = (storyVersion, stepId, reachedSceneIds = []) => ({
  storyVersion,
  stepId,
  reachedSceneIds,
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "section-skip-browser",
});

const layoutScan = (page) => page.evaluate(() => {
  const closeButton = document.querySelector("#novel-close-button");
  const homeButton = document.querySelector("#novel-home-button");
  const close = closeButton.getBoundingClientRect();
  const home = homeButton.getBoundingClientRect();
  const audio = document.querySelector(".gaia-audio-dock")?.getBoundingClientRect();
  const audioButton = document.querySelector("#gaia-audio-toggle")?.getBoundingClientRect();
  const overlaps = (first, second) => !(
    first.right <= second.left
    || first.left >= second.right
    || first.bottom <= second.top
    || first.top >= second.bottom
  );
  return {
    label: closeButton.textContent.trim(),
    ariaLabel: closeButton.getAttribute("aria-label"),
    closeArrow: getComputedStyle(closeButton, "::before").content,
    closeClipPath: getComputedStyle(closeButton).clipPath,
    closeBorderRadius: getComputedStyle(closeButton).borderRadius,
    closeArrowBorderWidth: getComputedStyle(closeButton, "::before").borderWidth,
    closePosition: getComputedStyle(closeButton).position,
    closeRect: close.toJSON(),
    homeLabel: homeButton.textContent.trim(),
    homeAriaLabel: homeButton.getAttribute("aria-label"),
    homeHidden: homeButton.hidden,
    homeRect: home.toJSON(),
    audioRect: audio?.toJSON() || null,
    audioButtonRect: audioButton?.toJSON() || null,
    audioExpanded: document.querySelector(".gaia-audio-dock")?.classList.contains("is-expanded") || false,
    audioPosition: document.querySelector(".gaia-audio-dock") ? getComputedStyle(document.querySelector(".gaia-audio-dock")).position : null,
    layerOpen: document.querySelector("#novel-layer")?.classList.contains("is-open"),
    titleVisible: !document.querySelector("#novel-title-screen")?.hidden,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    closeHomeOverlap: !homeButton.hidden && overlaps(close, home),
    closeAudioOverlap: audio ? overlaps(close, audio) : false,
    homeAudioOverlap: !homeButton.hidden && audio ? overlaps(home, audio) : false,
  };
});

const storeProgress = async (page, stepId, reachedSceneIds = []) => {
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const progress = baseState(storyVersion, stepId, reachedSceneIds);
  await page.evaluate(({ storageKey, configKey, candidate }) => {
    localStorage.setItem(storageKey, JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "Section skip QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, { storageKey: STORAGE_KEY, configKey: CONFIG_KEY, candidate: progress });
};

const openStoredProgress = async (page) => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  if (await page.locator("#novel-resume-button").isVisible()) {
    await page.locator("#novel-resume-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible" });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction(() => !document.querySelector("#novel-runtime")?.hidden);
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => globalThis.GaiaModeLoader.load("story"));
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", "section-skip-browser");
      const opening = document.querySelector("#gaia-opening");
      if (opening) {
        opening.hidden = true;
        opening.inert = true;
        opening.setAttribute("aria-hidden", "true");
      }
      document.body.classList.remove("gaia-opening-active", "opening-active");
      globalThis.GaiaNovel.open();
    });
    await page.locator("#gaia-audio-dock").waitFor({ state: "visible" });
    const openedAtTitle = await page.locator("#novel-title-screen").isVisible();
    let titleLayout = null;
    let expandedTitleLayout = null;
    if (openedAtTitle) {
    assert.equal((await page.locator("#novel-close-button").textContent()).trim(), "戻る");
    assert.equal(await page.locator("#novel-close-button").getAttribute("aria-label"), "ストーリーメニューを閉じる");
    assert.equal(await page.locator("#novel-home-button").isHidden(), true, `${viewport.name}: duplicate top return is visible on title`);
    titleLayout = await layoutScan(page);
    assert(titleLayout.closeRect.left <= 40, `${viewport.name}: title return is not pinned left: ${JSON.stringify(titleLayout.closeRect)}`);
    assert(titleLayout.closeRect.top <= 40, `${viewport.name}: title return is not pinned top: ${JSON.stringify(titleLayout.closeRect)}`);
    assert(titleLayout.audioRect && viewport.width - titleLayout.audioRect.right <= 40, `${viewport.name}: title audio is not pinned right: ${JSON.stringify(titleLayout.audioRect)}`);
    assert(titleLayout.audioRect.top <= 40, `${viewport.name}: title audio is not pinned top: ${JSON.stringify(titleLayout.audioRect)}`);
    assert.equal(titleLayout.closeAudioOverlap, false, `${viewport.name}: title return overlaps audio`);
    await page.locator("#gaia-audio-toggle").click();
    await page.waitForFunction(() => document.querySelector("#gaia-audio-dock")?.classList.contains("is-expanded"));
    expandedTitleLayout = await layoutScan(page);
    assert.equal(expandedTitleLayout.closeAudioOverlap, false, `${viewport.name}: expanded title audio overlaps return`);
    assert(viewport.width - expandedTitleLayout.audioRect.right <= 40, `${viewport.name}: expanded title audio moved away from right edge`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#gaia-audio-dock")?.classList.contains("is-expanded"));

    await page.locator("#novel-start-button").click();
    }
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "narration");
    const before = await layoutScan(page);
    assert.equal(before.label, "スキップ▶");
    assert(["none", "normal"].includes(before.closeArrow), `${viewport.name}: obsolete section-skip arrow remains`);
    assert.match(before.ariaLabel || "", /地球温暖化を地図で見る/u);
    assert.equal(before.homeLabel, "戻る");
    assert.equal(before.homeAriaLabel, "物語を閉じてトップページへ戻る");
    assert.equal(before.homeHidden, false, `${viewport.name}: real top return is hidden in runtime`);
    assert.equal(before.closeClipPath, "none", `${viewport.name}: story skip retained the angular mode silhouette`);
    assert(parseFloat(before.closeBorderRadius) >= 10, `${viewport.name}: story skip is not using the compact glass radius`);
    assert.equal(before.closeArrowBorderWidth, "0px", `${viewport.name}: story skip retained the boxed arrow`);
    assert(before.closeRect.height >= 44, `${viewport.name}: section skip hit area is under 44px`);
    assert(before.homeRect.height >= 44, `${viewport.name}: top return hit area is under 44px`);
    assert.equal(before.closeHomeOverlap, false, `${viewport.name}: section skip overlaps top return`);
    assert.equal(before.closeAudioOverlap, false, `${viewport.name}: audio control overlaps section skip`);
    assert.equal(before.homeAudioOverlap, false, `${viewport.name}: audio control overlaps top return`);
    assert(before.audioRect && viewport.width - before.audioRect.right <= 40, `${viewport.name}: runtime audio is not pinned right: ${JSON.stringify(before.audioRect)}`);
    assert(before.audioRect.top <= 40, `${viewport.name}: runtime audio is not pinned top: ${JSON.stringify(before.audioRect)}`);
    if (viewport.width <= 720) {
      assert(before.audioButtonRect, `${viewport.name}: speaker button geometry is unavailable`);
      assert(Math.abs(before.closeRect.height - before.audioButtonRect.height) <= 0.25, `${viewport.name}: section skip height differs from the speaker button`);
      assert(Math.abs(before.homeRect.height - before.audioButtonRect.height) <= 0.25, `${viewport.name}: top return height differs from the speaker button`);
      assert(Math.abs(before.closeRect.top - before.audioButtonRect.top) <= 0.25, `${viewport.name}: section skip is not aligned with the speaker button`);
      assert(Math.abs(before.homeRect.top - before.audioButtonRect.top) <= 0.25, `${viewport.name}: top return is not aligned with the speaker button`);
      assert(before.homeRect.left <= 40, `${viewport.name}: top return is not pinned left: ${JSON.stringify(before.homeRect)}`);
      assert(before.closeRect.top <= 40, `${viewport.name}: section skip is not pinned top: ${JSON.stringify(before.closeRect)}`);
      assert(Math.abs(before.closeRect.top - before.homeRect.top) <= 1, `${viewport.name}: mobile header controls are not on one row`);
      assert(before.closeRect.left >= before.homeRect.right + 4, `${viewport.name}: section skip is not placed after the top return`);
      assert.equal(before.closePosition, "fixed", `${viewport.name}: section skip is not viewport-fixed`);
      assert.equal(before.audioPosition, "fixed", `${viewport.name}: audio control is not viewport-fixed`);
    } else {
      assert(before.homeRect.left <= 40, `${viewport.name}: runtime return is not pinned left: ${JSON.stringify(before.homeRect)}`);
      assert(before.closeRect.left >= before.homeRect.right + 6, `${viewport.name}: section skip is not placed after the top return`);
    }
    assert.equal(before.overflowX, 0, `${viewport.name}: runtime overflows horizontally`);
    await page.locator("#gaia-audio-toggle").click();
    await page.waitForFunction(() => document.querySelector("#gaia-audio-dock")?.classList.contains("is-expanded"));
    const expandedRuntime = await layoutScan(page);
    assert.equal(expandedRuntime.closeAudioOverlap, false, `${viewport.name}: expanded runtime audio overlaps section skip`);
    assert.equal(expandedRuntime.homeAudioOverlap, false, `${viewport.name}: expanded runtime audio overlaps top return`);
    assert(viewport.width - expandedRuntime.audioRect.right <= 40, `${viewport.name}: expanded runtime audio moved away from right edge`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#gaia-audio-dock")?.classList.contains("is-expanded"));
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-section-skip.png`), animations: "disabled" });

    const homeHitTarget = await page.evaluate(() => {
      const button = document.querySelector("#novel-home-button");
      const rect = button.getBoundingClientRect();
      const target = document.elementFromPoint(
        rect.left + (rect.width / 2),
        rect.top + (rect.height / 2),
      );
      return target?.closest?.("#novel-home-button")?.id || "";
    });
    assert.equal(
      homeHitTarget,
      "novel-home-button",
      `${viewport.name}: top return is outside the pointer hit layer`,
    );
    await page.locator("#novel-home-button").click();
    await page.waitForFunction(() => (
      document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "true"
      && !document.querySelector("#intro-layer")?.hidden
    ));
    assert.notEqual(new URL(page.url()).hash, "#story", `${viewport.name}: top return kept the story route`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-top-return.png`), animations: "disabled" });

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => globalThis.GaiaModeLoader.load("story"));
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", "section-skip-browser");
      const opening = document.querySelector("#gaia-opening");
      if (opening) {
        opening.hidden = true;
        opening.inert = true;
        opening.setAttribute("aria-hidden", "true");
      }
      document.body.classList.remove("gaia-opening-active", "opening-active");
      globalThis.GaiaNovel.open();
    });
    if (await page.locator("#novel-start-button").isVisible()) await page.locator("#novel-start-button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepType === "narration");
    await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
    await page.waitForFunction(() => (
      document.querySelector("#novel-close-button")?.dataset.controlMode === "skip"
      && !document.querySelector("#novel-close-button")?.disabled
      && !window.GaiaSceneTransition?.running
    ));

    await page.locator("#novel-close-button").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_001");
    const skipped = await layoutScan(page);
    const skippedState = await page.evaluate(() => globalThis.GaiaNovel.getState());
    const skippedGallery = await page.evaluate(() => globalThis.GaiaNovel.getGalleryState());
    assert.equal(skipped.layerOpen, true, `${viewport.name}: section skip closed the story`);
    assert.equal(skipped.titleVisible, false, `${viewport.name}: section skip returned to title`);
    assert(skippedState.reachedSceneIds.includes("festival_concept"), `${viewport.name}: skipped section was not recorded as reached`);
    assert.equal(skippedState.readStepIds.includes("festival_concept_076"), false, `${viewport.name}: unseen final step was marked read`);
    assert.equal(skippedGallery.count, 0, `${viewport.name}: skipped event CG was unlocked`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    assert.equal(await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)).stepId, STORAGE_KEY), "map_mode01_001", `${viewport.name}: section skip was not persisted`);

    await storeProgress(page, "map_mode01_001", ["festival_concept"]);
    await openStoredProgress(page);
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_001");
    await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
    const skippedTargets = ["map_mode01_001"];
    for (const targetStepId of ["gx_experience_001", "esp32_pitch_001", "circle_invitation_001", "welcome_chat_001"]) {
      await page.locator("#novel-close-button").waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.querySelector("#novel-close-button")?.disabled);
      await page.locator("#novel-close-button").click();
      await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, targetStepId);
      skippedTargets.push(targetStepId);
      assert.equal(await page.locator("#novel-layer").getAttribute("aria-hidden"), "false", `${viewport.name}: ${targetStepId} closed the story`);
    }
    await page.waitForFunction(() => !document.querySelector("#novel-close-button")?.disabled);
    await page.locator("#novel-close-button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-staff-roll"));
    assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), "welcome_chat_095");
    assert.equal(await page.locator("#novel-close-button").isHidden(), true, `${viewport.name}: duplicate section control remained on credits`);
    await page.locator('.novel-staff-roll-data-skip[aria-label="エンディングをスキップして「データを見てみる」へ進む"]').click();
    await page.waitForFunction(() => {
      const intro = document.querySelector("#intro-layer");
      return globalThis.GaiaNovel.getState().clear === true && Boolean(intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false");
    });
    assert.equal((await page.locator("#intro-path-stage .intro-exploration-heading h3").textContent()).trim(), "観測モードを選ぶ", `${viewport.name}: credits did not open free exploration`);
    assert.equal(await page.locator(".novel-end-v6").count(), 0, `${viewport.name}: obsolete END panel remained`);
    assert.equal(await page.locator("#novel-close-button").isHidden(), true, `${viewport.name}: hidden story controls remained visible over free exploration`);
    assert.equal(await page.locator("#novel-layer").getAttribute("aria-hidden"), "true", `${viewport.name}: story remained visible over free exploration`);

    const finalScan = await layoutScan(page);
    assert.equal(finalScan.overflowX, 0, `${viewport.name}: ending overflows horizontally`);
    report.scans.push({ viewport: viewport.name, titleLayout, expandedTitleLayout, before, expandedRuntime, skipped, skippedTargets, finalScan, passed: true });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-ending.png`), animations: "disabled" });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join("\n")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join("\n")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Section skip browser check passed: ${report.scans.length} viewports`);
