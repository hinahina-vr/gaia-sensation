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
const outputDir = path.resolve(outputArgument || "artifacts/first-encounter-audio-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, mobile: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], failedResponses: [] };
const progressFor = (stepId) => ({
  storyVersion: 12,
  stepId,
  reachedSceneIds: ["festival_concept"],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気候の長期変化",
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  audio: { muted: true, volume: 0.1 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `first-encounter-audio-${stepId}`,
});

const bootAt = async (page, stepId) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "commit", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GaiaOpeningAudio));
  await page.evaluate((progress) => {
    progress.storyVersion = globalThis.GAIA_NOVEL_STORY.storyVersion;
    localStorage.clear();
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress,
      savedAt: Date.now(),
      meta: { title: "First encounter audio QA", excerpt: progress.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, progressFor(stepId));
  await page.reload({ waitUntil: "commit", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GaiaOpeningAudio));
  await page.waitForFunction((id) => (
    document.querySelector("#novel-layer")?.dataset.stepId === id
    && document.querySelector("#novel-runtime")?.hidden === false
  ), stepId, { timeout: 15_000 });
};

const waitForTrack = (page, track) => page.waitForFunction(
  (expected) => globalThis.GaiaOpeningAudio?.getState?.().track === expected,
  track,
  { timeout: 10_000 },
);

const advanceTo = async (page, nextStepId) => {
  for (let pageIndex = 0; pageIndex < 24; pageIndex += 1) {
    if (await page.evaluate((id) => globalThis.GaiaNovel.getState().stepId === id, nextStepId)) return;
    await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
    await page.locator("#novel-dialogue").click({ position: { x: 24, y: 24 } });
    await page.waitForTimeout(80);
  }
  await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, nextStepId, { timeout: 5_000 });
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
      reducedMotion: "reduce",
    });
    const audioResponses = [];
    const attachDiagnostics = (target) => {
      target.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
      target.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
      target.on("response", (response) => {
        if (/\/assets\/audio\//u.test(response.url())) audioResponses.push({ url: response.url(), status: response.status() });
        if (response.status() >= 400) report.failedResponses.push(`${viewport.name}: ${response.status()} ${response.url()}`);
      });
    };
    const page = await context.newPage();
    attachDiagnostics(page);

    await bootAt(page, "festival_concept_014");
    await waitForTrack(page, "story");
    const approach = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      track: globalThis.GaiaOpeningAudio.getState().track,
      backgroundCue: document.querySelector("#novel-layer")?.dataset.backgroundCue,
    }));
    assert.deepEqual(approach, {
      stepId: "festival_concept_014",
      track: "story",
      backgroundCue: "festival-gaia-booth-approach",
    });

    await advanceTo(page, "festival_concept_015");
    await waitForTrack(page, "windowlight");
    const debut = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      track: globalThis.GaiaOpeningAudio.getState().track,
      muted: globalThis.GaiaOpeningAudio.getState().muted,
      backgroundCue: document.querySelector("#novel-layer")?.dataset.backgroundCue,
    }));
    assert.equal(debut.track, "windowlight", `${viewport.name}: first encounter did not switch theme`);
    assert.equal(debut.muted, true, `${viewport.name}: track cue changed the visitor's mute choice`);
    assert.equal(debut.backgroundCue, "festival-first-encounter-cg");
    const screenshot = path.join(outputDir, `${viewport.name}-first-encounter.png`);
    await page.screenshot({ path: screenshot, animations: "disabled" });
    for (const stepNumber of [16, 19, 21, 23, 24, 27, 29]) {
      await advanceTo(page, `festival_concept_${String(stepNumber).padStart(3, "0")}`);
      if (stepNumber !== 29) assert.equal(
        await page.evaluate(() => globalThis.GaiaOpeningAudio.getState().track),
        "windowlight",
        `${viewport.name}: first-encounter theme ended before the introductions were complete`,
      );
    }
    await waitForTrack(page, "story");
    const returnToStory = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      track: globalThis.GaiaOpeningAudio.getState().track,
      backgroundCue: document.querySelector("#novel-layer")?.dataset.backgroundCue,
    }));
    assert.equal(returnToStory.track, "story", `${viewport.name}: normal story theme did not return after the introductions`);
    assert.equal(returnToStory.backgroundCue, "festival-gaia-booth-conversation");
    assert(audioResponses.some(({ url, status }) => url.includes("planet-forecast-windowlight.mp3") && [200, 206].includes(status)), `${viewport.name}: story theme was not fetched successfully`);
    assert(audioResponses.some(({ url, status }) => url.includes("satellite-forecast-calm.mp3") && [200, 206].includes(status)), `${viewport.name}: first-encounter theme was not fetched successfully`);

    report.scans.push({ viewport: viewport.name, approach, debut, returnToStory, audioResponses, screenshot, passed: true });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.failedResponses, []);
  report.status = "passed";
  console.log(`First encounter audio passed: ${report.scans.length} viewports`);
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}
