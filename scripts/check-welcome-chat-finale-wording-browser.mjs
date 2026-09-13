import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/welcome-chat-finale-wording");
fs.mkdirSync(outputDir, { recursive: true });

const cases = [
  { stepId: "welcome_chat_068", text: "黒い画面の中で、私たち三人の視線が交わった。" },
  { stepId: "welcome_chat_084", text: "その二行が、今日の展示で見てきたものと、これから始める観測をつないだ。" },
  { stepId: "welcome_chat_092", text: "スマートフォンをポケットへ戻す。顔を上げると、隣を歩く二人と目が合った。" },
];
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const stateFor = (stepId) => ({
  storyVersion: 10,
  stepId,
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
  sessionId: `welcome-finale-${stepId}`,
});

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    for (const testCase of cases) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      const label = `${viewport.name}/${testCase.stepId}`;
      page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
      page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
      page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });

      await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
      const progress = stateFor(testCase.stepId);
      await page.evaluate((candidate) => {
        localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
        localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
          progress: candidate,
          savedAt: Date.now(),
          meta: { title: "Finale wording QA", excerpt: candidate.stepId },
        }]));
        localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
        localStorage.setItem("gaia-senseware-bgm-volume", "0");
      }, progress);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.evaluate(() => globalThis.GaiaNovel.open());
      await page.locator("#novel-resume-button").click();
      await page.locator("#novel-save-panel").waitFor({ state: "visible" });
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
      await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, testCase.stepId);
      await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");

      const actual = await page.evaluate(() => {
        const layer = document.querySelector("#novel-layer");
        const text = document.querySelector("#novel-text");
        const sourceStep = globalThis.GAIA_NOVEL_STORY.scenes.flatMap((scene) => scene.steps).find((step) => step.id === layer?.dataset.stepId);
        return {
          stepId: layer?.dataset.stepId || "",
          sourceText: sourceStep?.text || "",
          visibleText: text?.textContent.trim() || "",
          pageCount: Number(text?.dataset.pageCount || 0),
          overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          layerOverflowX: Math.max(0, (layer?.scrollWidth || 0) - (layer?.clientWidth || 0)),
        };
      });
      assert.equal(actual.stepId, testCase.stepId, `${label}: step differs`);
      assert.equal(actual.sourceText, testCase.text, `${label}: generated text differs`);
      assert.equal(actual.visibleText, testCase.text, `${label}: visible text differs`);
      assert.equal(actual.pageCount, 1, `${label}: unexpected pagination`);
      assert.equal(actual.overflowX, 0, `${label}: page horizontal overflow`);
      assert.equal(actual.layerOverflowX, 0, `${label}: layer horizontal overflow`);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${testCase.stepId}.png`), animations: "disabled" });
      report.scans.push({ viewport: viewport.name, ...actual, passed: true });
      await context.close();
    }
  }
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Welcome chat finale wording check passed: ${report.scans.length} scans`);
