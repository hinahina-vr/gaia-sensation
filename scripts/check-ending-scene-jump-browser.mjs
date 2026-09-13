import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/ending-scene-jump");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4173";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?ending-jump=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const steps = story.scenes.flatMap((scene) => scene.steps);
const stepIndex = new Map(steps.map((step, index) => [step.id, index + 1]));
const endingStepId = "welcome_chat_095";
const endingScriptIndex = stepIndex.get(endingStepId);
const normalStep = steps.find((step) => step.id === "festival_concept_009");
assert(normalStep, "normal story step is unavailable");
assert.equal(endingScriptIndex, steps.length, "ending must remain the final canonical script step");

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v3";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const diagnostics = { consoleErrors: [], pageErrors: [], responses404: [] };
const report = { status: "running", baseUrl, storySteps: steps.length, canonicalScenes: story.scenes.length, scans: [], ...diagnostics };
fs.mkdirSync(outputDir, { recursive: true });

const progressAt = (stepId) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [story.scenes[0].id],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "太古の海",
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "ending-scene-jump-browser",
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) diagnostics.responses404.push(`${label}: ${response.url()}`); });
};

const bootAt = async (page, stepId) => {
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY), null, { timeout: 15_000 });
  await page.evaluate(({ progressKey, settingsKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress,
      savedAt: Date.now(),
      meta: { title: "Ending Jump QA", excerpt: progress.stepId },
    }]));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, { progressKey: storageKey, settingsKey: configKey, progress: progressAt(stepId) });
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.locator("#novel-resume-button").click();
  await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15_000 });
  await page.locator("#novel-jump-button").waitFor({ state: "visible", timeout: 15_000 });
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await bootAt(page, normalStep.id);
    const storedBeforeJump = await page.evaluate((key) => localStorage.getItem(key), storageKey);

    await page.locator("#novel-jump-button").click();
    const jumpItems = await page.locator("button.novel-jump-item[data-scene-id]").evaluateAll((items) => items.map((item) => ({
      id: item.dataset.sceneId,
      text: item.innerText,
      current: item.getAttribute("aria-current"),
    })));
    assert.equal(jumpItems.length, story.scenes.length + 2, `${viewport.name}: ending entry count`);
    assert.deepEqual(jumpItems.slice(0, story.scenes.length).map((item) => item.id), story.scenes.map((scene) => scene.id), `${viewport.name}: canonical scene order changed`);
    assert.equal(jumpItems.at(-2).id, "ending", `${viewport.name}: ending entry is not penultimate`);
    assert.match(jumpItems.at(-2).text, /07\s*\/\s*ENDING/u, `${viewport.name}: ending chapter label`);
    assert.match(jumpItems.at(-2).text, /エンディング/u, `${viewport.name}: ending title`);
    assert.match(jumpItems.at(-2).text, /SCRIPT #0372/u, `${viewport.name}: ending script label`);
    assert.equal(jumpItems.at(-1).id, "true-end", `${viewport.name}: true-end entry is not last`);
    assert.match(jumpItems.at(-1).text, /08\s*\/\s*Beyond/u, `${viewport.name}: Beyond chapter label`);
    assert.match(jumpItems.at(-1).text, /Beyond/u, `${viewport.name}: Beyond title`);
    assert.match(jumpItems.at(-1).text, /Beyond #001/u, `${viewport.name}: Beyond script label`);
    assert.equal(jumpItems.filter((item) => item.current === "true").length, 1, `${viewport.name}: current scene marker count`);

    const endingButton = page.locator('button.novel-jump-item[data-scene-id="ending"]');
    const trueEndButton = page.locator('button.novel-jump-item[data-scene-id="true-end"]');
    await trueEndButton.scrollIntoViewIfNeeded();
    const menuScan = await page.evaluate(() => {
      const panel = document.querySelector("#novel-jump-panel");
      const list = document.querySelector("#novel-jump-list");
      const trueEnd = document.querySelector('button.novel-jump-item[data-scene-id="true-end"]');
      const panelRect = panel?.getBoundingClientRect();
      const listRect = list?.getBoundingClientRect();
      const trueEndRect = trueEnd?.getBoundingClientRect();
      return {
        panelHidden: panel?.hidden,
        panelInsideViewport: panelRect ? panelRect.left >= -1 && panelRect.right <= innerWidth + 1 && panelRect.top >= -1 && panelRect.bottom <= innerHeight + 1 : false,
        trueEndInsideList: listRect && trueEndRect ? trueEndRect.top >= listRect.top - 1 && trueEndRect.bottom <= listRect.bottom + 1 : false,
        trueEndHeight: trueEndRect?.height || 0,
        listScrollable: list ? list.scrollHeight > list.clientHeight : false,
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      };
    });
    assert.equal(menuScan.panelHidden, false, `${viewport.name}: jump panel closed unexpectedly`);
    assert.equal(menuScan.panelInsideViewport, true, `${viewport.name}: jump panel left viewport`);
    assert.equal(menuScan.trueEndInsideList, true, `${viewport.name}: true-end entry is clipped`);
    assert(menuScan.trueEndHeight >= 44, `${viewport.name}: true-end hit area is under 44px`);
    assert.equal(menuScan.overflowX, 0, `${viewport.name}: horizontal page overflow`);
    assert.equal(menuScan.overflowY, 0, `${viewport.name}: vertical page overflow`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-menu.png`), animations: "disabled" });

    await endingButton.click();
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.classList.contains("is-staff-roll")
      && document.querySelector("#novel-layer")?.dataset.stepId === id, endingStepId, { timeout: 15_000 });
    const endingScan = await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const toolbarStyle = getComputedStyle(document.querySelector(".novel-topbar"));
      const finaleButton = document.querySelector(".novel-staff-roll-finale button");
      const finaleRect = finaleButton?.getBoundingClientRect();
      return {
        stepId: layer?.dataset.stepId,
        stepType: layer?.dataset.stepType,
        sceneId: layer?.dataset.sceneId,
        staffRoll: layer?.classList.contains("is-staff-roll"),
        staffRollPhase: document.querySelector(".novel-staff-roll")?.dataset.phase,
        jumpHidden: document.querySelector("#novel-jump-panel")?.hidden,
        separatorVisible: Boolean(document.querySelector('.novel-chapter-card:not([hidden])')),
        toolbarHidden: toolbarStyle.visibility === "hidden" && Number(toolbarStyle.opacity) === 0,
        currentScript: document.querySelector("#novel-script-debug-number")?.textContent,
        finaleHeight: finaleRect?.height || 0,
        reachedSceneIds: globalThis.GaiaNovel?.getState?.().reachedSceneIds || [],
        clear: globalThis.GaiaNovel?.getState?.().clear,
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      };
    });
    assert.equal(endingScan.stepId, endingStepId, `${viewport.name}: ending target step`);
    assert.notEqual(endingScan.stepType, "section-separator", `${viewport.name}: scene separator interrupted ending`);
    assert.equal(endingScan.staffRoll, true, `${viewport.name}: staff roll did not render`);
    assert.equal(endingScan.staffRollPhase, "complete", `${viewport.name}: reduced-motion ending did not complete`);
    assert.equal(endingScan.jumpHidden, true, `${viewport.name}: jump panel remained over ending`);
    assert.equal(endingScan.separatorVisible, false, `${viewport.name}: chapter card remained over ending`);
    assert.equal(endingScan.toolbarHidden, true, `${viewport.name}: normal toolbar remained over ending`);
    assert.equal(endingScan.currentScript, String(endingScriptIndex).padStart(4, "0"), `${viewport.name}: ending script number`);
    assert(endingScan.finaleHeight >= 44, `${viewport.name}: ending action hit area is under 44px`);
    assert.equal(endingScan.reachedSceneIds.includes("ending"), false, `${viewport.name}: pseudo ending polluted canonical scene state`);
    assert.equal(endingScan.clear, false, `${viewport.name}: jump marked story clear before ending action`);
    assert.equal(endingScan.overflowX, 0, `${viewport.name}: ending horizontal overflow`);
    assert.equal(endingScan.overflowY, 0, `${viewport.name}: ending vertical overflow`);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), storedBeforeJump, `${viewport.name}: ending jump mutated autosave`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-ending.png`), animations: "disabled" });

    await bootAt(page, normalStep.id);
    const storedBeforeTrueEnd = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    await page.locator("#novel-jump-button").click();
    await page.locator('button.novel-jump-item[data-scene-id="true-end"]').scrollIntoViewIfNeeded();
    await page.locator('button.novel-jump-item[data-scene-id="true-end"]').click();
    await page.waitForFunction(() => Boolean(document.querySelector(".true-end-shell")), null, { timeout: 15_000 });
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "trueend", null, { timeout: 6_500 });
    const trueEndScan = await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const shell = document.querySelector(".true-end-shell");
      const dialogue = document.querySelector(".true-end-dialogue");
      const toolbarStyle = getComputedStyle(document.querySelector(".novel-topbar"));
      return {
        trueEndVisible: Boolean(shell),
        layerActive: layer?.classList.contains("is-true-end") ?? false,
        sceneId: layer?.dataset.sceneId,
        stepType: layer?.dataset.stepType,
        storyAudioCue: layer?.dataset.storyAudioCue,
        scene: shell?.dataset.scene || "",
        heading: document.querySelector(".true-end-scene-heading strong")?.textContent?.trim() || "",
        dialogueHeight: dialogue?.getBoundingClientRect().height || 0,
        jumpHidden: document.querySelector("#novel-jump-panel")?.hidden,
        toolbarHidden: toolbarStyle.visibility === "hidden" && Number(toolbarStyle.opacity) === 0,
        clear: globalThis.GaiaNovel?.getState?.().clear,
        archivesUnlocked: globalThis.GaiaNovel?.getState?.().archivesUnlocked,
        audioTrack: globalThis.GaiaOpeningAudio?.getState?.().track || "",
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      };
    });
    assert.equal(trueEndScan.trueEndVisible, true, `${viewport.name}: true-end jump did not open its runtime`);
    assert.equal(trueEndScan.layerActive, true, `${viewport.name}: true-end layer state`);
    assert.equal(trueEndScan.sceneId, "true-end", `${viewport.name}: true-end scene id`);
    assert.equal(trueEndScan.stepType, "true-end", `${viewport.name}: true-end step type`);
    assert.equal(trueEndScan.storyAudioCue, "true-end-sensory-horizon", `${viewport.name}: true-end audio cue`);
    assert.equal(trueEndScan.scene, "after-ending", `${viewport.name}: true-end opening scene`);
    assert.equal(trueEndScan.heading, "こどもと魔法", `${viewport.name}: true-end opening heading`);
    assert(trueEndScan.dialogueHeight >= 44, `${viewport.name}: true-end dialogue hit area is under 44px`);
    assert.equal(trueEndScan.jumpHidden, true, `${viewport.name}: jump panel remained over true end`);
    assert.equal(trueEndScan.toolbarHidden, true, `${viewport.name}: normal toolbar remained over true end`);
    assert.equal(trueEndScan.clear, true, `${viewport.name}: true-end runtime did not receive clear state`);
    assert.equal(trueEndScan.archivesUnlocked, true, `${viewport.name}: true-end runtime did not receive archive state`);
    assert.equal(trueEndScan.audioTrack, "trueend", `${viewport.name}: true-end score did not start`);
    assert.equal(trueEndScan.overflowX, 0, `${viewport.name}: true-end horizontal overflow`);
    assert.equal(trueEndScan.overflowY, 0, `${viewport.name}: true-end vertical overflow`);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), storedBeforeTrueEnd, `${viewport.name}: true-end jump mutated autosave`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-true-end.png`), animations: "disabled" });

    report.scans.push({ viewport, menu: menuScan, ending: endingScan, trueEnd: trueEndScan, passed: true });
    await context.close();
  }
  assert.equal(diagnostics.consoleErrors.length, 0, `console errors: ${diagnostics.consoleErrors.join("\n")}`);
  assert.equal(diagnostics.pageErrors.length, 0, `page errors: ${diagnostics.pageErrors.join("\n")}`);
  assert.equal(diagnostics.responses404.length, 0, `404 responses: ${diagnostics.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`ending scene jump browser check passed: ${report.scans.length} viewports, ${report.storySteps} canonical steps`);
