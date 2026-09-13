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
const outputDir = path.resolve(outputArgument || "artifacts/enter-dialogue-advance");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const currentStepId = "festival_concept_048";
const nextStepId = "festival_concept_049";
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const stateFor = (storyVersion) => ({
  storyVersion,
  stepId: currentStepId,
  reachedSceneIds: ["festival_concept"],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気温偏差の地図",
  audio: { muted: true, volume: 0 },
  readStepIds: ["festival_concept_047"],
  clear: false,
  archivesUnlocked: false,
  sessionId: "enter-dialogue-advance-browser",
});

const bootAtDialogue = async (page) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const progress = stateFor(storyVersion);
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "Enter key QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, progress);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, currentStepId);
  await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await bootAtDialogue(page);
    const dialogueLabel = await page.locator("#novel-dialogue").getAttribute("aria-label");
    assert.match(dialogueLabel || "", /Enterキー/u);
    await page.evaluate(() => document.activeElement?.blur());
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true);
    await page.keyboard.press("Enter");
    await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, nextStepId);

    await bootAtDialogue(page);
    await page.locator("#novel-log-button").focus();
    await page.keyboard.press("Enter");
    await page.locator("#novel-log-panel").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), currentStepId);
    const comment = page.locator(`textarea[data-step-id="${currentStepId}"]`);
    await comment.fill("入力欄では改行する");
    await comment.press("Enter");
    assert.match(await comment.inputValue(), /\n/u);
    assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), currentStepId);
    await page.keyboard.press("Escape");
    await page.locator("#novel-log-panel").waitFor({ state: "hidden" });

    await page.locator("#novel-dialogue").focus();
    await page.locator("#novel-dialogue").evaluate((dialogue) => {
      dialogue.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }));
    });
    assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), currentStepId);
    await page.keyboard.press("Enter");
    await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, nextStepId);

    const scan = await page.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      activeElement: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName,
    }));
    assert.equal(scan.stepId, nextStepId);
    assert.equal(scan.overflowX, 0);
    report.scans.push({ viewport: viewport.name, ...scan, passed: true });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`), animations: "disabled" });
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

console.log(`Enter dialogue advance browser check passed: ${report.scans.length} viewports`);
