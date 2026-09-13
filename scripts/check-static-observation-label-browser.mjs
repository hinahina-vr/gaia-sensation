import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4417"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/static-observation-label");
fs.mkdirSync(outputDir, { recursive: true });

await import('../novel-story-data.js');
await import('../novel-back-half-cues.js');
const sceneCases = ['festival_concept_001','map_mode01_001','gx_experience_001','esp32_pitch_001','circle_invitation_001','welcome_chat_002'].map(id => {
  const step = GAIA_NOVEL_STORY.scenes.flatMap(scene => scene.steps).find(step => step.id === id);
  const cue = GAIA_NOVEL_BACK_HALF_CUES.forStep(step).temporal;
  return {stepId:id,sceneId:step.sceneId,time:step.displayTime,title:`${cue.date} ${step.displayTime}｜${cue.location}`};
});
const viewports = [
  { name: "pc-1440", width: 1440, height: 900, mobile: false },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const progressFor = (storyVersion, viewport, sceneCase) => ({
  storyVersion,
  stepId: sceneCase.stepId,
  reachedSceneIds: [sceneCase.sceneId],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気温偏差の地図",
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `static-observation-label-${viewport}-${sceneCase.sceneId}`,
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.mobile,
      isMobile: viewport.mobile,
      reducedMotion: "reduce",
    });
    for (const sceneCase of sceneCases) {
      const page = await context.newPage();
      const scanLabel = `${viewport.name}/${sceneCase.stepId}`;
      page.on("console", (message) => {
        if (message.type() === "error") report.consoleErrors.push(`${scanLabel}: ${message.text()}`);
      });
      page.on("pageerror", (error) => report.pageErrors.push(`${scanLabel}: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() === 404) report.responses404.push(`${scanLabel}: ${response.url()}`);
      });

      await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY), null, { timeout: 15_000 });
      const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
      await page.evaluate((progress) => {
        localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
        localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
          progress,
          savedAt: Date.now(),
          meta: { title: "Static observation label QA", excerpt: progress.stepId },
        }]));
        localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
        localStorage.setItem("gaia-senseware-bgm-volume", "0");
      }, progressFor(storyVersion, viewport.name, sceneCase));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
      await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
      await page.locator("#gaia-boot").waitFor({ state: "hidden" });
      await page.locator("#novel-load-button").click();
      await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
      await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, sceneCase.stepId);
      await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");

      const scan = await page.evaluate(() => {
        const layer = document.querySelector("#novel-layer");
        const label = document.querySelector("#novel-source-label");
        const heading = document.querySelector("#novel-location");
        const rect = label.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const focusable = [...document.querySelectorAll("button, a[href], input, select, textarea, [tabindex]")]
          .filter((element) => !element.hidden && element.tabIndex >= 0);
        return {
          stepId: layer?.dataset.stepId,
          storyDate: layer?.dataset.storyDate,
          storyTime: layer?.dataset.storyTime,
          precision: layer?.dataset.timePrecision,
          headingText: heading?.textContent?.trim() || "",
          headingAriaLabel: heading?.getAttribute("aria-label") || "",
          headingInViewport: headingRect.left >= -1 && headingRect.right <= innerWidth + 1,
          headingClipped: heading.scrollWidth > heading.clientWidth + 1,
          tagName: label.tagName,
          role: label.getAttribute("role"),
          tabIndex: label.tabIndex,
          pointerEvents: getComputedStyle(label).pointerEvents,
          labelVisible: !label.hidden && rect.width > 0 && rect.height > 0,
          hitTargetId: document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.id || "",
          labelInTabOrder: focusable.includes(label),
          sourceButtonCount: document.querySelectorAll("#novel-source-button").length,
          sourcePanelCount: document.querySelectorAll("#novel-source-panel, .novel-source-panel").length,
          overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        };
      });

      assert.equal(scan.stepId, sceneCase.stepId);
      assert.equal(scan.storyDate, "10月3日（土）");
      assert.equal(scan.storyTime, sceneCase.time);
      assert.equal(scan.precision, "MINUTE");
      assert.equal(scan.headingText, sceneCase.time.split("–")[0] + "｜" + sceneCase.title.split("｜").slice(1).join("｜"));
      assert.equal(scan.headingAriaLabel, sceneCase.title);
      assert.equal(scan.headingInViewport, true);
      assert.equal(scan.headingClipped, false);
      assert.equal(scan.tagName, "DIV");
      assert.equal(scan.role, null);
      assert.equal(scan.tabIndex, -1);
      assert.equal(scan.pointerEvents, "none");
      assert.equal(scan.labelVisible, true);
      assert.notEqual(scan.hitTargetId, "novel-source-label");
      assert.equal(scan.labelInTabOrder, false);
      assert.equal(scan.sourceButtonCount, 0);
      assert.equal(scan.sourcePanelCount, 0);
      assert.equal(scan.overflowX, 0);
      report.scans.push({ viewport: viewport.name, ...scan, passed: true });
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${sceneCase.sceneId}.png`), animations: "disabled" });
      await page.close();
    }
    await context.close();
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

console.log(JSON.stringify(report, null, 2));
