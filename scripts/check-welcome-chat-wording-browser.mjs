import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4184"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/welcome-chat-wording-browser");
fs.mkdirSync(outputDir, { recursive: true });

const startStepId = "welcome_chat_037";
const expectedAtStart = [
  "そこは賛成。",
  "それでは、まず一台で試しましょう。何を確かめたいか決めてから、使うセンサーと測定間隔を選びますの。",
  "じゃあ、一分おきで。センサーの場所はあとで考えよう。",
  "データが届かなかったときの表示も、あとで決めましょう。",
  "了解。青猫さん、その設定でつなげそう？",
];
const expectedFollowing = [
  ["welcome_chat_038", "いけます。"],
  ["welcome_chat_039", "お願い。動いたら、照度も足してみよう。"],
  ["welcome_chat_040", "続きは、# 惑星の放課後_センサー で。"],
];
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const stateFor = (storyVersion, viewport) => ({
  storyVersion,
  stepId: startStepId,
  reachedSceneIds: ["welcome_chat"],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
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
  sessionId: `welcome-chat-wording-${viewport}`,
});

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
    const progress = stateFor(storyVersion, viewport.name);
    await page.evaluate((candidate) => {
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
      localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
        progress: candidate,
        savedAt: Date.now(),
        meta: { title: "Welcome chat wording QA", excerpt: candidate.stepId },
      }]));
      localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    }, progress);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      if (layer?.hidden || !layer.classList.contains("is-open")) globalThis.GaiaNovel.open();
    });
    await page.waitForFunction((id) => {
      const layer = document.querySelector("#novel-layer");
      const resume = document.querySelector("#novel-resume-button");
      return layer?.dataset.stepId === id || (resume && !resume.hidden && !resume.disabled);
    }, startStepId, { timeout: 60_000 });
    const alreadyAtStart = await page.evaluate((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, startStepId);
    if (!alreadyAtStart) {
      await page.locator("#novel-resume-button").click();
      await page.locator("#novel-save-panel").waitFor({ state: "visible" });
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    }
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, startStepId, { timeout: 60_000 });
    await page.locator(".novel-slack-workspace").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll(".novel-slack-avatar img")];
      return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
    });

    const initial = await page.evaluate(() => ({
      stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
      messages: [...document.querySelectorAll(".novel-slack-message")].slice(-5).map((node) => node.textContent || ""),
      currentText: document.querySelector(".novel-slack-post.is-new .novel-slack-message")?.textContent || "",
      overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      workspaceOverflowX: Math.max(0, document.querySelector(".novel-slack-workspace")?.scrollWidth - document.querySelector(".novel-slack-workspace")?.clientWidth),
    }));
    assert.equal(initial.stepId, startStepId, `${viewport.name}: start step differs`);
    assert.deepEqual(initial.messages, expectedAtStart, `${viewport.name}: revised conversation differs`);
    assert.equal(initial.currentText, expectedAtStart.at(-1), `${viewport.name}: current revised message differs`);
    assert.equal(initial.overflowX, 0, `${viewport.name}: page horizontal overflow`);
    assert.equal(initial.workspaceOverflowX, 0, `${viewport.name}: workspace horizontal overflow`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-start.png`), animations: "disabled" });

    const following = [];
    for (const [stepId, expectedText] of expectedFollowing) {
      await page.keyboard.press("Enter");
      await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
      const current = await page.locator(".novel-slack-post.is-new .novel-slack-message").textContent();
      const currentSpeaker = await page.locator(".novel-slack-post.is-new .novel-slack-post-body > p > strong").textContent();
      assert.equal(current, expectedText, `${viewport.name}: ${stepId} copy differs`);
      if (stepId === "welcome_chat_038") assert.equal(currentSpeaker, "青猫", `${viewport.name}: campus chat still labels the player as あなた`);
      following.push({ stepId, speaker: currentSpeaker, text: current });
    }
    const finalOverflow = await page.evaluate(() => ({
      page: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      workspace: Math.max(0, document.querySelector(".novel-slack-workspace")?.scrollWidth - document.querySelector(".novel-slack-workspace")?.clientWidth),
    }));
    assert.deepEqual(finalOverflow, { page: 0, workspace: 0 }, `${viewport.name}: final overflow`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-final.png`), animations: "disabled" });
    report.scans.push({ viewport: viewport.name, initial, following, finalOverflow, passed: true });
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

console.log(`Welcome chat wording browser check passed: ${report.scans.length} viewports`);
