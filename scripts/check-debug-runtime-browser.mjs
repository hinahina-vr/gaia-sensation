import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/debug-runtime");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4311";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?debug-runtime=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const steps = story.scenes.flatMap((scene) => scene.steps);
const stepIndex = new Map(steps.map((step, index) => [step.id, index + 1]));
assert.equal(new Set(steps.map((step) => step.id)).size, steps.length, "duplicate step IDs");
assert.equal(new Set(story.scenes.map((scene) => scene.id)).size, story.scenes.length, "duplicate scene IDs");
const sceneEntries = story.scenes.map((scene, index) => ({
  id: scene.id,
  order: index + 1,
  firstStepId: scene.steps[0]?.id,
  scriptIndex: stepIndex.get(scene.steps[0]?.id),
}));
assert(sceneEntries.every((entry) => entry.firstStepId && entry.scriptIndex), "scene first step missing");
const jumpEntryIds = [...sceneEntries.map((entry) => entry.id), "ending"];

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v2";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const diagnostics = { consoleErrors: [], pageErrors: [], responses404: [] };
const report = { status: "running", storySteps: steps.length, sceneCount: sceneEntries.length, scans: [], ...diagnostics };
fs.mkdirSync(outputDir, { recursive: true });

const progressAt = (stepId) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "debug-runtime-browser",
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) diagnostics.responses404.push(`${label}: ${response.url()}`); });
};

const bootAt = async (page, stepId) => {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(({ progressKey, settingsKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    globalThis.GaiaNovel.open();
  }, { progressKey: storageKey, settingsKey: configKey, progress: progressAt(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector("#novel-script-debug")?.hidden, null, { timeout: 15_000 });
};

const scriptSnapshot = (page) => page.evaluate(() => ({
  stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
  number: document.querySelector("#novel-script-debug-number")?.textContent || "",
  debugStepId: document.querySelector("#novel-script-debug-step-id")?.textContent || "",
  aria: document.querySelector("#novel-script-debug")?.getAttribute("aria-label") || "",
  hidden: document.querySelector("#novel-script-debug")?.hidden,
}));

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    const startStep = story.scenes[0].steps[Math.min(5, story.scenes[0].steps.length - 1)].id;
    await bootAt(page, startStep);

    const initialStored = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    await page.locator("#novel-jump-button").click();
    const jumpItems = await page.locator("button.novel-jump-item[data-scene-id]").evaluateAll((items) => items.map((item) => ({
      id: item.dataset.sceneId,
      text: item.textContent,
      current: item.getAttribute("aria-current"),
    })));
    assert.equal(jumpItems.length, jumpEntryIds.length, `${viewport.name}: jump entry count`);
    assert.deepEqual(jumpItems.map((item) => item.id), jumpEntryIds, `${viewport.name}: jump entry order`);
    assert.equal(jumpItems.filter((item) => item.text.includes(item.id)).length, 0, `${viewport.name}: scene IDs became visible`);

    const jumpList = page.locator("#novel-jump-list");
    await jumpList.evaluate((list) => { list.scrollTop = Math.min(240, list.scrollHeight - list.clientHeight); });
    const wheelBefore = await jumpList.evaluate((list) => list.scrollTop);
    assert(wheelBefore > 0, `${viewport.name}: JUMP list did not become scrollable`);
    await jumpList.hover();
    await page.mouse.wheel(0, -160);
    await page.waitForTimeout(120);
    const wheelResult = await page.evaluate(() => ({
      scrollTop: document.querySelector("#novel-jump-list")?.scrollTop || 0,
      jumpHidden: document.querySelector("#novel-jump-panel")?.hidden,
      logHidden: document.querySelector("#novel-log-panel")?.hidden,
    }));
    assert(wheelResult.scrollTop < wheelBefore, `${viewport.name}: upward wheel did not scroll the JUMP list`);
    assert.equal(wheelResult.jumpHidden, false, `${viewport.name}: wheel closed JUMP`);
    assert.equal(wheelResult.logHidden, true, `${viewport.name}: wheel leaked through JUMP and opened LOG`);
    await page.locator("#novel-jump-close").click();
    await page.locator("#novel-dialogue").hover();
    await page.mouse.wheel(0, -160);
    await page.waitForTimeout(120);
    assert.equal(await page.locator("#novel-log-panel").isHidden(), false, `${viewport.name}: LOG wheel gesture did not recover after closing JUMP`);
    await page.locator("#novel-log-close").click();

    const targets = [sceneEntries[0], sceneEntries[Math.floor(sceneEntries.length / 2)], sceneEntries.at(-1)];
    const jumps = [];
    for (const target of targets) {
      if (await page.locator("#novel-jump-panel").isHidden()) await page.locator("#novel-jump-button").click();
      await page.locator(`button.novel-jump-item[data-scene-id="${target.id}"]`).click();
      await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, target.firstStepId, { timeout: 15_000 });
      const snapshot = await scriptSnapshot(page);
      assert.equal(snapshot.number, String(target.scriptIndex).padStart(4, "0"), `${viewport.name}: SCRIPT index after JUMP`);
      assert.equal(snapshot.debugStepId, target.firstStepId, `${viewport.name}: step ID after JUMP`);
      assert.match(snapshot.aria, new RegExp(`スクリプト位置 ${target.scriptIndex}、${target.firstStepId}$`, "u"), `${viewport.name}: SCRIPT aria`);
      jumps.push(snapshot);
    }
    const storedAfterJumps = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    assert.equal(storedAfterJumps, initialStored, `${viewport.name}: JUMP mutated autosave`);

    await page.locator("#novel-jump-button").click();
    const beforeEscape = (await scriptSnapshot(page)).stepId;
    await page.keyboard.press("Escape");
    assert.equal((await scriptSnapshot(page)).stepId, beforeEscape, `${viewport.name}: Escape advanced story`);
    assert.equal(await page.locator("#novel-jump-panel").isHidden(), true, `${viewport.name}: Escape did not close JUMP`);
    await page.locator("#novel-jump-button").click();
    await page.mouse.click(3, Math.floor(viewport.height / 2));
    assert.equal((await scriptSnapshot(page)).stepId, beforeEscape, `${viewport.name}: outside close advanced story`);

    const longStep = steps.find((step) => step.id === "prologue_basil_017") || steps.find((step) => String(step.text || "").length > 100 && ["narration", "dialogue"].includes(step.type));
    await bootAt(page, longStep.id);
    const sourceText = String(longStep.text || longStep.prompt || "");
    const copyOnce = async () => {
      const before = await scriptSnapshot(page);
      await page.locator("#novel-script-debug-copy-button").click();
      await page.waitForFunction(() => document.querySelector("#novel-script-debug-copy-status")?.textContent === "コピー済み", null, { timeout: 5_000 });
      const payload = await page.evaluate(() => navigator.clipboard.readText());
      const after = await scriptSnapshot(page);
      assert.deepEqual(after, before, `${viewport.name}: COPY changed current step`);
      return payload;
    };
    const expectedHeader = `SCRIPT #${String(stepIndex.get(longStep.id)).padStart(4, "0")}｜${longStep.id}`;
    const firstCopy = await copyOnce();
    assert.equal(firstCopy.replaceAll("\r\n", "\n"), `${expectedHeader}\n${sourceText}`.replaceAll("\r\n", "\n"), `${viewport.name}: COPY payload is not canonical full text`);
    const pageCount = await page.evaluate((text) => globalThis.GaiaNovel.inspectDialoguePagination(text).pages.length, sourceText);
    if (pageCount > 1) {
      await page.locator("#novel-dialogue").click({ position: { x: 20, y: 20 } });
      const secondCopy = await copyOnce();
      assert.equal(secondCopy.replaceAll("\r\n", "\n"), firstCopy.replaceAll("\r\n", "\n"), `${viewport.name}: COPY changed across pagination pages`);
    }

    const noTextStep = steps.find((step) => !String(step.text || step.prompt || "") && !["end"].includes(step.type));
    if (noTextStep) {
      await bootAt(page, noTextStep.id);
      const payload = await copyOnce();
      const header = `SCRIPT #${String(stepIndex.get(noTextStep.id)).padStart(4, "0")}｜${noTextStep.id}`;
      assert.equal(payload, header, `${viewport.name}: no-text COPY must be header only`);
    }

    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-jump-copy.png`), animations: "disabled" });
    report.scans.push({ viewport, jumps, wheel: { before: wheelBefore, after: wheelResult }, copy: { longStepId: longStep.id, pageCount }, passed: true });
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

console.log(`debug runtime browser check passed: ${report.scans.length} viewports, ${report.sceneCount} scenes`);
