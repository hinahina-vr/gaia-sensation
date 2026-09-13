import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

// Keep this legacy command name compatible; expressions now switch directly.
const [moduleRoot = "node_modules/playwright-core", executablePath = "C:/Program Files/Google/Chrome/Application/chrome.exe", outputArgument, baseUrl = "http://127.0.0.1:4492"] = process.argv.slice(2);
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/character-expression-direct-2026-09-10/expressions");
fs.mkdirSync(outputDir, { recursive: true });

const cases = [
  { name: "amane-calm", stepId: "festival_concept_032", figureId: "novel-character-sora", expression: "calm", asset: "amane-calm-07-v3.png" },
  { name: "amane-startled", stepId: "esp32_pitch_011", figureId: "novel-character-sora", expression: "startled", asset: "amane-startled-07-v3.png" },
  { name: "amane-map-handoff", stepId: "map_mode01_016", figureId: "novel-character-sora", expression: "calm", asset: "amane-calm-07-v3.png" },
  { name: "amane-exasperated", stepId: "map_mode01_018", figureId: "novel-character-sora", expression: "exasperated", asset: "amane-exasperated-07-v3.png" },
  { name: "amane-soft", stepId: "festival_concept_057", figureId: "novel-character-sora", expression: "soft", asset: "amane-soft-07-v3.png" },
  { name: "mizuha-calm", stepId: "festival_concept_036", figureId: "novel-character-minamo", expression: "calm", asset: "mizuha-calm-07-v2.png" },
  { name: "mizuha-teasing", stepId: "map_mode01_017", figureId: "novel-character-minamo", expression: "teasing", asset: "mizuha-teasing-07-v2.png" },
  { name: "mizuha-worried", stepId: "festival_concept_064", figureId: "novel-character-minamo", expression: "worried", asset: "mizuha-worried-07-v2.png" },
  { name: "mizuha-sad", stepId: "circle_invitation_008", figureId: "novel-character-minamo", expression: "sad", asset: "mizuha-sad-07-v2.png" },
];
const report = { status: "running", baseUrl, cases: [], directEntries: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const progressFor = (stepId, storyVersion) => ({
  storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気温偏差の地図",
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  audio: { muted: true, volume: 0 },
  readStepIds: [stepId],
  clear: false,
  archivesUnlocked: false,
  sessionId: `character-expression-${stepId}`,
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const bootAt = async (page, stepId, reducedMotion) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY) && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const progress = progressFor(stepId, storyVersion);
  await page.evaluate(({ candidate, reduce }) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
      { progress: candidate, savedAt: Date.now(), meta: { title: "Expression QA", excerpt: candidate.stepId } },
    ]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: reduce }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, { candidate: progress, reduce: reducedMotion });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForFunction(() => {
    const layer = document.querySelector('#novel-layer');
    return layer?.dataset.entryTransition === 'visible' && layer.dataset.runtimeReveal === 'revealed'
      && layer.getAttribute('aria-busy') !== 'true' && document.querySelector('#novel-text')?.dataset.revealState === 'complete';
  });
  await page.locator('#gaia-boot').waitFor({state: 'hidden'});
};

const inspectFigure = (page, figureId) => page.evaluate((id) => {
  const figure = document.getElementById(id);
  const current = figure?.querySelector(".novel-character-portrait:not(.novel-character-portrait--previous)");
  const previous = figure?.querySelector(".novel-character-portrait--previous");
  const currentStyle = current ? getComputedStyle(current) : null;
  const previousStyle = previous ? getComputedStyle(previous) : null;
  return {
    expression: figure?.dataset.expression || "",
    previousExpression: figure?.dataset.previousExpression || "",
    changing: figure?.classList.contains("is-changing") || false,
    currentImage: currentStyle?.backgroundImage || "none",
    previousImage: previousStyle?.backgroundImage || "none",
    currentOpacity: Number(currentStyle?.opacity || 0),
    previousOpacity: Number(previousStyle?.opacity || 0),
    currentAnimation: currentStyle?.animationName || "none",
    previousAnimation: previousStyle?.animationName || "none",
  };
}, figureId);

try {
  const matrixContext = await browser.newContext({ viewport: { width: 412, height: 924 }, deviceScaleFactor: 2.625, reducedMotion: "reduce" });
  await enforceBrowserSecurity(matrixContext, baseUrl);
  const matrixPage = await matrixContext.newPage();
  attachDiagnostics(matrixPage, "pixel-11-matrix");
  for (const testCase of cases) {
    await bootAt(matrixPage, testCase.stepId, true);
    await matrixPage.waitForFunction(({ id, asset }) => {
      const portrait = document.getElementById(id)?.querySelector(".novel-character-portrait:not(.novel-character-portrait--previous)");
      return getComputedStyle(portrait).backgroundImage.includes(asset);
    }, { id: testCase.figureId, asset: testCase.asset });
    const scan = await inspectFigure(matrixPage, testCase.figureId);
    assert.equal(scan.expression, testCase.expression, `${testCase.name}: expression`);
    assert(scan.currentImage.includes(testCase.asset), `${testCase.name}: portrait asset`);
    assert.equal(scan.changing, false);
    assert.equal(scan.currentOpacity, 1);
    assert.equal(scan.previousOpacity, 0);
    assert.equal(scan.currentAnimation, "none");
    const screenshotPath = path.join(outputDir, `pixel-11-${testCase.name}.png`);
    await matrixPage.screenshot({ path: screenshotPath, animations: "disabled" });
    report.cases.push({ ...testCase, ...scan, screenshotPath });
    assert.deepEqual(await matrixPage.evaluate(() => __securityViolations), []);
  }
  await matrixContext.close();

  for (const testCase of cases.filter((entry) => entry.expression !== "calm").slice(0, 1).concat(cases.filter((entry) => entry.name === "mizuha-worried"))) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
    await enforceBrowserSecurity(context, baseUrl);
    const page = await context.newPage();
    attachDiagnostics(page, `crossfade-${testCase.name}`);
    await bootAt(page, testCase.stepId, false);
    await page.waitForFunction(({id, expression}) => document.getElementById(id)?.dataset.expression === expression, {id: testCase.figureId, expression: testCase.expression});
    const during = await inspectFigure(page, testCase.figureId);
    assert(during.currentImage.includes(testCase.asset), `${testCase.name}: incoming asset`);
    assert.equal(during.previousImage, "none");
    assert.equal(during.currentAnimation, "none");
    assert.equal(during.previousAnimation, "none");
    assert.equal(during.currentOpacity, 1);
    assert.equal(during.previousOpacity, 0);
    await page.waitForTimeout(460);
    const settled = await inspectFigure(page, testCase.figureId);
    assert(settled.currentOpacity > 0.99, `${testCase.name}: incoming portrait did not settle`);
    assert(settled.previousOpacity < 0.01, `${testCase.name}: outgoing portrait did not fade out`);
    report.directEntries.push({ name: testCase.name, during, settled });
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  console.log(`character expression browser check passed: ${report.cases.length} expressions, ${report.directEntries.length} direct entries`);
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
