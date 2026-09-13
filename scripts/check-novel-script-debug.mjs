import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4310";
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/novel-script-debug");
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required.");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?script-debug=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const allSteps = story.scenes.flatMap((scene) => scene.steps);
const stepIds = allSteps.map((step) => step.id);
const stepMap = new Map(allSteps.map((step) => [step.id, step]));
const scriptIndexMap = new Map(allSteps.map((step, index) => [step.id, index + 1]));

assert.equal(allSteps.length, 1053, "SCRIPT index must cover all 1053 approved story steps");
assert.equal(new Set(stepIds).size, stepIds.length, "duplicate story step ID");
assert.equal(stepMap.size, allSteps.length, "step Map size differs from the flattened story length");
assert.equal(scriptIndexMap.size, allSteps.length, "SCRIPT index Map size differs from the flattened story length");
allSteps.forEach((step, index) => {
  assert.equal(scriptIndexMap.get(step.id), index + 1, `${step.id}: SCRIPT index is not continuous`);
});
assert.equal(scriptIndexMap.get("__unknown_story_step__"), undefined, "unknown step acquired a fallback SCRIPT index");

const firstStep = allSteps[0];
const middleStep = allSteps[Math.floor(allSteps.length / 2)];
const lastStep = allSteps.at(-1);
const choiceStep = allSteps.find((step) => step.type === "choice");
const chatStep = allSteps.find((step) => step.type === "chat");
const transitionStep = allSteps.find((step) => step.type === "transition");
const dialogueStep = allSteps.find((step) => step.type === "dialogue");
const gxStep = allSteps.find((step) => step.type === "interaction" && step.interaction?.kind === "gx");
const reflectionStep = allSteps.find((step) => step.type === "reflectionChoice");
const resultStep = allSteps.find((step) => step.type === "result");
const sceneBoundaryFrom = stepMap.get("opening_empty_seat_018");
const sceneBoundaryTo = stepMap.get("prologue_online_circle_001");
for (const [label, step] of Object.entries({
  firstStep, middleStep, lastStep, choiceStep, chatStep, transitionStep, dialogueStep,
  gxStep, reflectionStep, resultStep, sceneBoundaryFrom, sceneBoundaryTo,
})) assert.ok(step, `${label} fixture is missing`);
assert.equal(lastStep.type, "end", "last SCRIPT entry must remain the unique END step");

const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const manualStorageKey = "gaiaSensewareNovel:manual-saves";
const configKey = "gaiaSensewareNovel:config:v2";
const debugMarkup = `<aside id="novel-script-debug" hidden aria-label="stale"><span id="novel-script-debug-number">STALE</span><span id="novel-script-debug-step-id">STALE</span></aside>`;

const baseState = (stepId, overrides = {}) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "script-debug-check",
  ...overrides,
});

const report = {
  baseUrl: routeUrl,
  totalSteps: allSteps.length,
  staticChecks: {
    mapSize: scriptIndexMap.size,
    first: { id: firstStep.id, index: scriptIndexMap.get(firstStep.id) },
    middle: { id: middleStep.id, index: scriptIndexMap.get(middleStep.id) },
    last: { id: lastStep.id, index: scriptIndexMap.get(lastStep.id) },
  },
  renderChecks: [],
  flowChecks: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const expectedPosition = (stepId) => {
  const index = scriptIndexMap.get(stepId);
  assert.ok(Number.isInteger(index), `${stepId}: missing SCRIPT index`);
  return {
    index,
    number: String(index).padStart(4, "0"),
    stepId,
    ariaLabel: `スクリプト位置 ${index}、${stepId}`,
  };
};

const readDebug = (page) => page.evaluate(() => {
  const root = document.querySelector("#novel-script-debug");
  return {
    hidden: root?.hidden ?? null,
    ariaHidden: root?.getAttribute("aria-hidden") || "",
    number: document.querySelector("#novel-script-debug-number")?.textContent || "",
    stepId: document.querySelector("#novel-script-debug-step-id")?.textContent || "",
    ariaLabel: root?.getAttribute("aria-label") || "",
    layerStepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
  };
});

const assertVisiblePosition = async (page, stepId, label, target = report.renderChecks) => {
  const expected = expectedPosition(stepId);
  await page.waitForFunction((value) => {
    const root = document.querySelector("#novel-script-debug");
    return root && !root.hidden
      && document.querySelector("#novel-script-debug-step-id")?.textContent === value;
  }, stepId);
  const actual = await readDebug(page);
  assert.equal(actual.hidden, false, `${label}: SCRIPT display is hidden`);
  assert.equal(actual.ariaHidden, "false", `${label}: visible SCRIPT display remains aria-hidden`);
  assert.equal(actual.number, expected.number, `${label}: wrong zero-padded SCRIPT number`);
  assert.equal(actual.stepId, expected.stepId, `${label}: wrong raw step ID`);
  assert.equal(actual.ariaLabel, expected.ariaLabel, `${label}: wrong SCRIPT aria-label`);
  assert.equal(actual.layerStepId, stepId, `${label}: SCRIPT and runtime step differ`);
  target.push({ label, ...actual, index: expected.index });
  return actual;
};

const assertCleared = async (page, label) => {
  await page.waitForFunction(() => document.querySelector("#novel-script-debug")?.hidden === true);
  const actual = await readDebug(page);
  assert.equal(actual.number, "", `${label}: hidden SCRIPT number was not cleared`);
  assert.equal(actual.stepId, "", `${label}: hidden raw step ID was not cleared`);
  assert.equal(actual.ariaLabel, "", `${label}: hidden SCRIPT aria-label was not cleared`);
  assert.equal(actual.ariaHidden, "true", `${label}: hidden SCRIPT display is exposed to assistive technology`);
  report.flowChecks.push({ label, ...actual });
};

const ensureNovelOpen = async (page) => {
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.locator("#novel-title-screen").waitFor({ state: "visible", timeout: 15_000 });
};

const bootAt = async (page, stepId, overrides = {}) => {
  await page.evaluate(({ key, config, progress }) => {
    localStorage.setItem(key, JSON.stringify(progress));
    localStorage.setItem(config, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { key: storageKey, config: configKey, progress: baseState(stepId, overrides) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await assertCleared(page, `title-before-resume-${stepId}`);
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  return assertVisiblePosition(page, stepId, `resume-${stepId}`);
};

const advanceFromSimpleStep = async (page, fromId, toId) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator("#novel-dialogue").dispatchEvent("click");
    if (await page.locator("#novel-layer").getAttribute("data-step-id") !== fromId) break;
  }
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, toId);
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(response.url()); });
  await page.route("**/story*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.includes('id="novel-script-debug"')
      ? source
      : source.replace("</body>", `${debugMarkup}</body>`);
    await route.fulfill({ response, body });
  });
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.evaluate(({ progress, manual, config }) => {
    localStorage.removeItem(progress);
    localStorage.removeItem(manual);
    localStorage.setItem(config, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { progress: storageKey, manual: manualStorageKey, config: configKey });
  await assertCleared(page, "initial-title");

  await page.locator("#novel-start-button").click();
  await assertVisiblePosition(page, firstStep.id, "new-game-first-step");

  for (const [label, step] of [
    ["first", firstStep],
    ["middle", middleStep],
    ["last", lastStep],
    ["dialogue", dialogueStep],
    ["chat", chatStep],
    ["transition", transitionStep],
  ]) {
    await bootAt(page, step.id);
    report.flowChecks.push({ label: `representative-${label}`, ...(await readDebug(page)) });
  }

  await bootAt(page, sceneBoundaryFrom.id);
  await page.evaluate(() => { globalThis.__gaiaScriptDebugRoot = document.querySelector("#novel-script-debug"); });
  await advanceFromSimpleStep(page, sceneBoundaryFrom.id, sceneBoundaryTo.id);
  await assertVisiblePosition(page, sceneBoundaryTo.id, "scene-boundary-section-card", report.flowChecks);
  assert.equal(await page.evaluate(() => globalThis.__gaiaScriptDebugRoot === document.querySelector("#novel-script-debug")), true, "scene transition replaced the SCRIPT root node");

  await bootAt(page, choiceStep.id);
  await page.locator("#novel-choices button").first().click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, choiceStep.id);
  const choiceTarget = await page.locator("#novel-layer").getAttribute("data-step-id");
  await assertVisiblePosition(page, choiceTarget, "choice-progress", report.flowChecks);

  const savedStepId = chatStep.id;
  await bootAt(page, savedStepId);
  await page.locator("#novel-save-button").click();
  await page.locator("#novel-save-slots .novel-save-primary").first().click();
  await assertVisiblePosition(page, savedStepId, "manual-save-keeps-position", report.flowChecks);
  await page.locator("#novel-save-close").click();
  await bootAt(page, dialogueStep.id);
  await page.locator("#novel-load-button").click();
  await page.locator("#novel-save-slots .novel-save-primary").first().click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, savedStepId);
  await assertVisiblePosition(page, savedStepId, "manual-load-restores-position", report.flowChecks);

  await bootAt(page, resultStep.id, {
    editorialChoice: "SOURCE_RECORD",
    reflectionIds: ["R01"],
    resultTone: "NEUTRAL",
    evesRoute: [
      { decisionId: "editorial_choice", value: "SOURCE_RECORD", label: "本人記録で構成する", stepId: choiceStep.id },
      { decisionId: "reflection_choice", value: "SELECTED", label: "観測姿勢を選ぶ", stepId: reflectionStep.id },
    ],
  });
  await page.locator("#novel-eves-button").click();
  await page.locator("#novel-eves-rewind").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, reflectionStep.id);
  await assertVisiblePosition(page, reflectionStep.id, "eves-rewind", report.flowChecks);

  await bootAt(page, gxStep.id);
  await page.locator(".novel-interaction-open").click();
  await assertVisiblePosition(page, gxStep.id, "gx-modal-open", report.flowChecks);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("gaia:gx-story-progress", { detail: { count: 3, complete: true } }));
    window.dispatchEvent(new CustomEvent("gaia:gx-return-to-novel"));
  });
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, gxStep.id);
  const gxReturnStepId = await page.locator("#novel-layer").getAttribute("data-step-id");
  await assertVisiblePosition(page, gxReturnStepId, "gx-modal-return", report.flowChecks);

  await page.evaluate(() => globalThis.GaiaNovel.close());
  await assertCleared(page, "story-closed");

  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: storageKey,
    value: baseState("__unknown_story_step__"),
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await assertCleared(page, "unknown-step-title");
  assert.equal(await page.locator("#novel-resume-button").isHidden(), true, "unknown saved step was offered for RESUME");

  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join(" | ")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
  await context.close();
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`SCRIPT debug check passed: ${allSteps.length} indexed steps, ${report.renderChecks.length} render checks, ${report.flowChecks.length} flow checks`);
