import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/section-skip-crossfade-browser");
fs.mkdirSync(outputDir, { recursive: true });

const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v4";
const FROM_STEP_ID = "festival_concept_005";
const TO_STEP_ID = "map_mode01_001";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const createProgress = (storyVersion, sceneId) => ({
  storyVersion,
  stepId: FROM_STEP_ID,
  reachedSceneIds: [sceneId],
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds: [FROM_STEP_ID],
  clear: false,
  archivesUnlocked: false,
  sessionId: "section-skip-crossfade-browser",
});

const presentation = (page) => page.locator("#novel-layer").evaluate((layer) => {
  const outgoingStyle = getComputedStyle(layer, "::before");
  const dialogueStyle = getComputedStyle(document.querySelector("#novel-dialogue"));
  return {
    stepId: globalThis.GaiaNovel.getState().stepId,
    backgroundImage: getComputedStyle(layer).backgroundImage,
    outgoingImage: outgoingStyle.backgroundImage,
    outgoingOpacity: Number.parseFloat(outgoingStyle.opacity),
    dialogueVisibility: dialogueStyle.visibility,
    transitionPhase: layer.dataset.backgroundTransitionPhase || "",
    transitioning: layer.classList.contains("is-background-transitioning"),
    buffered: layer.classList.contains("is-background-buffered"),
    releasing: layer.classList.contains("is-background-releasing"),
    chapterVisible: !document.querySelector("#novel-chapter-card")?.hidden,
  };
});

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--no-first-run", "--disable-background-networking"],
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    const storyMeta = await page.evaluate((stepId) => {
      const step = globalThis.GAIA_NOVEL_STORY.scenes
        .flatMap((scene) => scene.steps)
        .find((candidate) => candidate.id === stepId);
      return step ? { storyVersion: globalThis.GAIA_NOVEL_STORY.storyVersion, sceneId: step.sceneId } : null;
    }, FROM_STEP_ID);
    assert(storyMeta, `unknown section skip source step: ${FROM_STEP_ID}`);
    await page.evaluate(({ storageKey, configKey, progress }) => {
      localStorage.clear();
      localStorage.setItem(storageKey, JSON.stringify(progress));
      localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    }, {
      storageKey: STORAGE_KEY,
      configKey: CONFIG_KEY,
      progress: createProgress(storyMeta.storyVersion, storyMeta.sceneId),
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction((stepId) => (
      document.querySelector("#novel-layer")?.dataset.stepId === stepId
      && document.querySelector("#novel-runtime")?.hidden === false
    ), FROM_STEP_ID, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete", null, { timeout: 10000 });
    await page.evaluate(() => {
      globalThis.__gaiaSectionSkipBackgroundEvents = [];
      window.addEventListener("gaia:novel-background-transition-complete", (event) => {
        globalThis.__gaiaSectionSkipBackgroundEvents.push(event.detail);
      });
    });

    const before = await presentation(page);
    assert.equal(before.stepId, FROM_STEP_ID, `${viewport.name}: incorrect section skip source`);
    assert.equal(before.outgoingImage, "none", `${viewport.name}: stale outgoing background exists before skip`);
    assert.equal((await page.locator("#novel-close-button").textContent()).trim(), "セクションスキップ");

    await page.locator("#novel-close-button").click();
    await page.waitForFunction((stepId) => globalThis.GaiaNovel.getState().stepId === stepId, TO_STEP_ID, { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector("#novel-chapter-card")?.hidden, null, { timeout: 10000 });
    const separator = await presentation(page);
    assert.equal(separator.backgroundImage, before.backgroundImage, `${viewport.name}: destination background flashed during the section separator`);

    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.backgroundTransitionPhase === "releasing", null, { timeout: 10000 });
    await page.waitForTimeout(320);
    const during = await presentation(page);
    assert.notEqual(during.backgroundImage, before.backgroundImage, `${viewport.name}: incoming background was not painted under the outgoing buffer`);
    assert.equal(during.outgoingImage, before.backgroundImage, `${viewport.name}: outgoing background was not retained during the crossfade`);
    assert(during.outgoingOpacity > 0 && during.outgoingOpacity < 1, `${viewport.name}: outgoing background was not partially blended during the crossfade`);
    assert(during.transitioning && during.buffered && during.releasing, `${viewport.name}: incomplete section skip crossfade state`);
    assert.equal(during.dialogueVisibility, "hidden", `${viewport.name}: destination message UI appeared during the crossfade`);
    assert.equal(during.chapterVisible, false, `${viewport.name}: chapter separator remained over the crossfade`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-during.png`), animations: "allow" });

    await page.waitForFunction(() => globalThis.__gaiaSectionSkipBackgroundEvents?.length === 1, null, { timeout: 10000 });
    await page.waitForFunction(() => (
      document.querySelector("#novel-layer")?.dataset.backgroundTransitionPhase === "complete"
      && document.querySelector("#novel-text")?.dataset.revealState === "complete"
    ), null, { timeout: 10000 });
    const completed = await page.evaluate(() => globalThis.__gaiaSectionSkipBackgroundEvents[0]);
    const after = await presentation(page);
    assert.equal(completed.fromStepId, FROM_STEP_ID, `${viewport.name}: wrong crossfade source step`);
    assert.equal(completed.toStepId, TO_STEP_ID, `${viewport.name}: wrong crossfade target step`);
    assert.equal(completed.crossfadeOnly, true, `${viewport.name}: section skip used a hard swap instead of a crossfade`);
    assert.equal(after.stepId, TO_STEP_ID, `${viewport.name}: section skip finished on the wrong step`);
    assert.equal(after.outgoingImage, "none", `${viewport.name}: outgoing background remained after the crossfade`);
    assert(!after.transitioning && !after.buffered && !after.releasing, `${viewport.name}: crossfade state remained after completion`);
    assert.notEqual(after.dialogueVisibility, "hidden", `${viewport.name}: destination message UI stayed hidden after the crossfade`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-after.png`), animations: "disabled" });

    report.scans.push({ viewport: viewport.name, before, separator, during, completed, after, passed: true });
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

console.log(`Section skip crossfade browser check passed: ${report.scans.length} PC/mobile scans`);
