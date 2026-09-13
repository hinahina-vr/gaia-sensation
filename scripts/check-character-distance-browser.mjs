import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4430"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/character-distance-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1080p", width: 1920, height: 1080 },
  { name: "pc-4k", width: 3840, height: 2160 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
];
const cases = [
  { context: "dialogue", guide: "mizuha", stepId: "map_mode01_025", castId: "novel-character-minamo" },
  { context: "dialogue", guide: "amane", stepId: "map_mode01_040", castId: "novel-character-sora" },
];
const paintedTopByAsset = new Map([
  ["mizuha-calm-07-v2.png", 64],
  ["amane-calm-07-v3.png", 10],
]);
const report = { status: "running", baseUrl, inventory: null, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });

const stateFor = (stepId) => ({
  storyVersion: 10,
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
  readStepIds: [stepId, "first_meeting_hall_032"],
  clear: false,
  archivesUnlocked: false,
  sessionId: `character-distance-${stepId}`,
});

const bootAt = async (page, stepId) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const candidate = { ...stateFor(stepId), storyVersion };
  await page.evaluate((progress) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress,
      savedAt: Date.now(),
      meta: { title: "Character distance QA", excerpt: progress.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, candidate);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  const savePanel = page.locator("#novel-save-panel");
  if (await savePanel.isVisible()) await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForTimeout(100);
};

const scanPresentation = async (page, testCase) => page.evaluate(async ({ castId, expectedContext, topEntries }) => {
  const figure = document.getElementById(castId);
  const portrait = figure?.querySelector(".novel-character-portrait");
  const figureStyle = figure ? getComputedStyle(figure) : null;
  const portraitStyle = portrait ? getComputedStyle(portrait) : null;
  const imageUrl = /url\(["']?([^"')]+)/u.exec(portraitStyle?.backgroundImage || "")?.[1] || "";
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  const asset = new URL(imageUrl, location.href).pathname.split("/").at(-1);
  const layoutWidth = portrait.clientWidth;
  const layoutHeight = portrait.clientHeight;
  const size = portraitStyle.backgroundSize;
  let renderedHeight;
  if (size === "contain") {
    renderedHeight = image.naturalHeight * Math.min(layoutWidth / image.naturalWidth, layoutHeight / image.naturalHeight);
  } else {
    renderedHeight = Number(/auto\s+([\d.]+)px/u.exec(size)?.[1]);
  }
  const yToken = portraitStyle.backgroundPosition.split(/\s+/u).at(-1);
  let imageTop;
  if (yToken === "100%") imageTop = layoutHeight - renderedHeight;
  else if (yToken === "0%") imageTop = 0;
  else imageTop = Number.parseFloat(yToken);
  const paintedTop = new Map(topEntries).get(asset);
  const rect = figure.getBoundingClientRect();
  return {
    stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
    context: document.querySelector("#novel-layer")?.classList.contains("is-slack") ? "slack" : "dialogue",
    castId: figure.id,
    castSpeaker: document.querySelector("#novel-cast")?.dataset.speaker || "",
    slackCast: document.querySelector("#novel-cast")?.dataset.slackCast || "",
    figureDisplay: figureStyle.display,
    figureVisibility: figureStyle.visibility,
    figureOpacity: figureStyle.opacity,
    visible: figureStyle.visibility !== "hidden" && Number(figureStyle.opacity) > 0.5 && rect.width > 0 && rect.height > 0,
    asset,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    layoutWidth,
    layoutHeight,
    backgroundSize: size,
    backgroundPosition: portraitStyle.backgroundPosition,
    renderedHeight,
    renderedCanvasWidth: renderedHeight * image.naturalWidth / image.naturalHeight,
    paintedTop: imageTop + paintedTop * renderedHeight / image.naturalHeight,
    expectedContext,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    overflowY: document.documentElement.scrollHeight > innerHeight + 1,
  };
}, { castId: testCase.castId, expectedContext: testCase.context, topEntries: [...paintedTopByAsset] });

const inventoryStory = async (page) => page.evaluate(() => {
  const steps = globalThis.GAIA_NOVEL_STORY.scenes.flatMap((scene) => scene.steps);
  const guides = steps.filter((step) => step.speaker === "mizuha" || step.speaker === "amane");
  return {
    storyVersion: globalThis.GAIA_NOVEL_STORY.storyVersion,
    sceneCount: globalThis.GAIA_NOVEL_STORY.scenes.length,
    stepCount: steps.length,
    guideStepCount: guides.length,
    bySpeaker: Object.fromEntries(["mizuha", "amane"].map((speaker) => [speaker, guides.filter((step) => step.speaker === speaker).length])),
    byType: Object.fromEntries([...new Set(guides.map((step) => step.type))].sort().map((type) => [type, guides.filter((step) => step.type === type).length])),
    sceneIds: [...new Set(guides.map((step) => step.sceneId))],
    nonCalmExpressions: guides.filter((step) => step.expression && step.expression !== "calm").map((step) => step.id),
  };
});

const assertMatchedPair = (viewportName, context) => {
  const entries = report.scans.filter((scan) => scan.viewport === viewportName && scan.context === context);
  const mizuha = entries.find((scan) => scan.guide === "mizuha");
  const amane = entries.find((scan) => scan.guide === "amane");
  assert(mizuha && amane, `${viewportName}/${context}: guide pair was not scanned`);
  const widthDelta = Math.abs(mizuha.renderedCanvasWidth - amane.renderedCanvasWidth);
  const topDelta = Math.abs(mizuha.paintedTop - amane.paintedTop);
  assert(widthDelta <= 5, `${viewportName}/${context}: source-canvas width differs by ${widthDelta}px`);
  assert(topDelta <= 5, `${viewportName}/${context}: painted head line differs by ${topDelta}px`);
};

try {
  for (const viewport of viewports) {
    for (const testCase of cases) {
      const label = `${viewport.name}-${testCase.context}-${testCase.guide}`;
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
      page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
      page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
      await bootAt(page, testCase.stepId);
      if (!report.inventory) report.inventory = await inventoryStory(page);
      const scan = await scanPresentation(page, testCase);
      const screenshotPath = path.join(outputDir, `${label}.png`);
      await page.screenshot({ path: screenshotPath, animations: "disabled" });
      report.scans.push({ viewport: viewport.name, ...testCase, ...scan, screenshotPath, passed: true });
      assert.equal(scan.stepId, testCase.stepId);
      assert.equal(scan.context, testCase.context);
      assert.equal(scan.castId, testCase.castId);
      assert.equal(scan.visible, true, `${label}: active guide is hidden: ${JSON.stringify(scan)}`);
      assert.equal(scan.overflowX, false);
      assert.equal(scan.overflowY, false);
      await context.close();
    }
    assertMatchedPair(viewport.name, "dialogue");
  }
  assert.equal(report.inventory.sceneCount, 6);
  assert.equal(report.inventory.stepCount, 372);
  assert(report.inventory.guideStepCount > 100);
  assert.equal(report.inventory.byType.dialogue, 103);
  assert.equal(report.inventory.byType.chat, 13);
  assert.deepEqual(report.inventory.nonCalmExpressions, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
  console.log(`character distance browser check passed: ${report.scans.length} scans / ${report.inventory.guideStepCount} guide steps inventoried`);
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
