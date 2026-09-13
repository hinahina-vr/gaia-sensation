import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4393"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/festival-entrance-opening");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = {
  status: "running",
  base: "49edfc3f58d9944d8be231e5ce086db64a29e74c",
  viewports,
  scans: [],
  oldCampusAudit: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
const browser = await chromium.launch({ headless: true, executablePath });

const stateFor = (stepId, extra = {}) => ({
  storyVersion: 10,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気候・長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  audio: { muted: true, volume: 0.37 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `festival-entrance-${stepId}`,
  ...extra,
});

const createPage = async (viewport, label) => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  await page.addInitScript(() => {
    globalThis.__festivalVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
  });
  return { context, page };
};

const bootAt = async (page, stepId, extra = {}) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, stateFor(stepId, extra));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForTimeout(180);
};

const inViewport = (rect, viewport, edge = 0) => Boolean(
  rect && rect.width > 0 && rect.height > 0
  && rect.left >= edge && rect.top >= edge
  && rect.right <= viewport.width - edge && rect.bottom <= viewport.height - edge,
);

const openingCases = [
  ["festival_concept_001", "festival-main-entrance-reception", "novel-bg-coastal-venue-v3.png", "scenic"],
  ["festival_concept_007", "festival-main-entrance-reception", "novel-bg-coastal-venue-v3.png", "scenic"],
  ["festival_concept_008", "festival-b-hall-overview", "novel-bg-festival-b-hall-overview-v1.png", "scenic"],
  ["festival_concept_014", "festival-gaia-booth-approach", "novel-bg-exhibition-v3.png", "scenic"],
  ["festival_concept_015", "festival-first-encounter-cg", "event-cg-first-encounter-v1.png", "event-cg"],
];

const inspectStoryStep = async (page) => page.evaluate(() => {
  const layer = document.querySelector("#novel-layer");
  const dialogue = document.querySelector("#novel-dialogue");
  const speaker = document.querySelector("#novel-speaker");
  const text = document.querySelector("#novel-text");
  const continueMark = document.querySelector("#novel-continue");
  const topbar = document.querySelector("#novel-layer .novel-topbar");
  const textStyle = getComputedStyle(text);
  const lineHeight = Number.parseFloat(textStyle.lineHeight) || 1;
  const portraits = [
    document.querySelector("#novel-character-sora"),
    document.querySelector("#novel-character-minamo"),
    document.querySelector("#novel-character-sakuya"),
  ];
  const bgStyle = getComputedStyle(layer);
  return {
    stepId: layer?.dataset.stepId,
    cueId: layer?.dataset.backgroundCue,
    presentation: layer?.dataset.backgroundPresentation || "scenic",
    assetUrl: bgStyle.backgroundImage,
    backgroundSize: bgStyle.backgroundSize,
    backgroundPosition: bgStyle.backgroundPosition,
    layerRect: layer?.getBoundingClientRect().toJSON(),
    dialogueVisible: __festivalVisible(dialogue),
    dialogueRect: dialogue?.getBoundingClientRect().toJSON(),
    speaker: speaker?.textContent || "",
    speakerVisible: __festivalVisible(speaker),
    speakerRect: speaker?.getBoundingClientRect().toJSON(),
    text: text?.textContent || "",
    textRect: text?.getBoundingClientRect().toJSON(),
    textFits: text.scrollHeight <= text.clientHeight + 1,
    estimatedLines: Math.max(1, Math.round(text.scrollHeight / lineHeight)),
    continueVisible: __festivalVisible(continueMark),
    continueRect: continueMark?.getBoundingClientRect().toJSON(),
    topbarVisible: __festivalVisible(topbar),
    topbarRect: topbar?.getBoundingClientRect().toJSON(),
    characterVisibleCount: portraits.filter(__festivalVisible).length,
    campusDomCount: document.querySelectorAll('[style*="zushi-campus-story-bg"], [src*="zushi-campus-story-bg"]').length,
    campusResourceCount: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("zushi-campus-story-bg")).length,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    overflowY: document.documentElement.scrollHeight > innerHeight + 1,
  };
});

const assertSafeStoryStep = (scan, viewport, expected) => {
  const [stepId, cueId, asset, presentation] = expected;
  assert.equal(scan.stepId, stepId);
  assert.equal(scan.cueId, cueId);
  assert.equal(scan.presentation, presentation);
  assert.match(scan.assetUrl, new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[^\"]*\"?\\)$`, "u"));
  assert.equal(scan.dialogueVisible, true);
  assert.equal(scan.continueVisible, true);
  assert.equal(scan.topbarVisible, true);
  assert.equal(scan.textFits, true);
  assert(scan.estimatedLines <= 3, `${viewport.name}/${stepId}: dialogue exceeds three lines`);
  assert.equal(inViewport(scan.dialogueRect, viewport), true);
  assert.equal(inViewport(scan.textRect, viewport), true);
  assert.equal(inViewport(scan.continueRect, viewport), true);
  assert.equal(inViewport(scan.topbarRect, viewport), true);
  if (scan.speakerVisible) assert.equal(inViewport(scan.speakerRect, viewport), true);
  assert.equal(scan.characterVisibleCount, 0);
  assert.equal(scan.overflowX, false);
  assert.equal(scan.overflowY, false);
};

const scanOpening = async (viewport) => {
  for (const expected of openingCases) {
    const [stepId] = expected;
    const label = `${viewport.name}-${stepId}`;
    const { context, page } = await createPage(viewport, label);
    await bootAt(page, stepId);
    const scan = await inspectStoryStep(page);
    assertSafeStoryStep(scan, viewport, expected);
    if (stepId === "festival_concept_008") {
      assert(scan.backgroundSize.split(",").every((value) => value.trim() === "cover"));
      assert.match(scan.backgroundPosition, /50%/u);
    }
    await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
    report.scans.push({ viewport: viewport.name, case: `opening-${stepId}`, ...scan, passed: true });
    await context.close();
  }
};

const scanOldCampusRemoval = async (viewport) => {
  for (let index = 1; index <= 7; index += 1) {
    const stepId = `festival_concept_${String(index).padStart(3, "0")}`;
    const label = `${viewport.name}-campus-audit-${stepId}`;
    const { context, page } = await createPage(viewport, label);
    await bootAt(page, stepId);
    const scan = await inspectStoryStep(page);
    assert.equal(scan.cueId, "festival-main-entrance-reception");
    assert.match(scan.assetUrl, /novel-bg-coastal-venue-v3\.png/u);
    assert.equal(scan.campusDomCount, 0);
    assert.equal(scan.campusResourceCount, 0);
    report.oldCampusAudit.push({ viewport: viewport.name, stepId, cueId: scan.cueId, assetUrl: scan.assetUrl, campusDomCount: scan.campusDomCount, campusResourceCount: scan.campusResourceCount, passed: true });
    await context.close();
  }
};

const boundaryCases = [
  ["festival_concept_020", "festival-first-encounter-cg", "event-cg-first-encounter-v1.png", "event-cg", ""],
  ["festival_concept_021", "festival-amane-closeup-cg", "event-cg-amane-closeup-v1.png", "event-cg", "短髪の女性"],
  ["festival_concept_023", "festival-mizuha-closeup-cg", "event-cg-mizuha-closeup-v1.png", "event-cg", "長髪の女性"],
  ["festival_concept_026", "festival-mizuha-closeup-cg", "event-cg-mizuha-closeup-v1.png", "event-cg", ""],
  ["festival_concept_027", "festival-gaia-booth-conversation", "novel-bg-exhibition-v2.png", "scenic", "あなた"],
  ["festival_concept_031", "festival-gaia-booth-conversation", "novel-bg-exhibition-v2.png", "scenic", ""],
  ["festival_concept_032", "festival-amane-response-closeup-cg", "event-cg-amane-closeup-v1.png", "event-cg", "あめ"],
  ["festival_concept_035", "festival-amane-response-closeup-cg", "event-cg-amane-closeup-v1.png", "event-cg", ""],
  ["festival_concept_036", "festival-mizuha-response-closeup-cg", "event-cg-mizuha-closeup-v1.png", "event-cg", "みず"],
];

const scanCloseupBoundaries = async (viewport) => {
  for (const expected of boundaryCases) {
    const [stepId, cueId, asset, presentation, speaker] = expected;
    const { context, page } = await createPage(viewport, `${viewport.name}-boundary-${stepId}`);
    await bootAt(page, stepId);
    const scan = await inspectStoryStep(page);
    assertSafeStoryStep(scan, viewport, [stepId, cueId, asset, presentation]);
    assert.equal(scan.speaker, speaker);
    if (stepId === "festival_concept_027") assert.match(scan.text, /はい。同じ大学の学生です。/u);
    report.scans.push({ viewport: viewport.name, case: `closeup-boundary-${stepId}`, ...scan, passed: true });
    await context.close();
  }
};

const scanRepresentativeNonRegressions = async (viewport) => {
  const { context, page } = await createPage(viewport, `${viewport.name}-representative-nonregression`);
  await bootAt(page, "welcome_chat_024");
  const chat = await page.evaluate(() => {
    const dialogue = document.querySelector("#novel-dialogue");
    const current = document.querySelector(".novel-slack-post.is-new");
    const symbolicAvatars = [...document.querySelectorAll([
      ".novel-slack-post[data-speaker='mizuha'] .novel-slack-avatar",
      ".novel-slack-post[data-speaker='amane'] .novel-slack-avatar",
      ".novel-slack-post[data-speaker='sakuya'] .novel-slack-avatar",
      ".novel-slack-post[data-speaker='visitor'] .novel-slack-avatar",
    ].join(", "))];
    return {
      vnVisible: __festivalVisible(dialogue),
      activePostVisible: __festivalVisible(current),
      symbolicAvatarDomCount: symbolicAvatars.length,
      symbolicAvatarVisibleCount: symbolicAvatars.filter(__festivalVisible).length,
      humanAvatarDomCount: document.querySelectorAll(".novel-slack-avatar[data-human-avatar], .novel-slack-avatar img[src*='/characters/']").length,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(chat.vnVisible, true);
  assert.equal(chat.activePostVisible, true);
  assert.equal(chat.humanAvatarDomCount, 0);
  assert(chat.symbolicAvatarDomCount > 0);
  assert.equal(chat.symbolicAvatarVisibleCount, chat.symbolicAvatarDomCount);
  assert.equal(chat.overflowX, false);

  await bootAt(page, "map_mode01_004", { readStepIds: ["map_mode01_001", "map_mode01_002", "map_mode01_003"] });
  const map = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    cueId: document.querySelector("#novel-layer")?.dataset.backgroundCue,
    launcherVisible: __festivalVisible(document.querySelector(".novel-interaction-open")),
    mapModalVisible: __festivalVisible(document.querySelector("#japan-layer")),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.deepEqual(map, { stepId: "map_mode01_004", cueId: "map01-co2-observation", launcherVisible: true, mapModalVisible: false, overflowX: false });

  await bootAt(page, "gx_experience_017", { readStepIds: ["gx_experience_016"] });
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && globalThis.__festivalVisible(document.querySelector("#gx-layer")));
  const gx = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    cueId: document.querySelector("#novel-layer")?.dataset.backgroundCue,
    gxVisible: __festivalVisible(document.querySelector("#gx-layer")),
    storyInert: document.querySelector("#novel-layer")?.inert,
    launcherDomCount: document.querySelectorAll(".novel-interaction-open, .novel-interaction-skip").length,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.deepEqual(gx, { stepId: "gx_experience_017", cueId: "gx-ancient-ocean", gxVisible: true, storyInert: true, launcherDomCount: 0, overflowX: false });

  await page.evaluate(() => {
    localStorage.removeItem("gaiaSensewareNovel:progress");
    localStorage.removeItem("gaiaSensewareNovel:cg-gallery:v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  const gallery = await page.evaluate(() => ({
    titleRouteVisible: __festivalVisible(document.querySelector("#novel-title-gallery-button")),
    progress: document.querySelector("#novel-title-gallery-progress")?.textContent,
    entries: globalThis.GAIA_NOVEL_BACKGROUND_CUES.gallery.map(({ id, unlockStepId }) => ({ id, unlockStepId })),
  }));
  assert.equal(gallery.titleRouteVisible, true);
  assert.match(gallery.progress, /^0 \/ 6/u);
  assert.equal(gallery.entries.length, 6);
  assert.deepEqual(gallery.entries.slice(0, 3), [
    { id: "first-encounter", unlockStepId: "festival_concept_015" },
    { id: "amane-closeup", unlockStepId: "festival_concept_021" },
    { id: "mizuha-closeup", unlockStepId: "festival_concept_023" },
  ]);
  report.scans.push({ viewport: viewport.name, case: "representative-map-gx-chat-name-album", map, gx, chat, gallery, passed: true });
  await context.close();
};

try {
  for (const viewport of viewports) {
    await scanOpening(viewport);
    await scanOldCampusRemoval(viewport);
    await scanCloseupBoundaries(viewport);
    await scanRepresentativeNonRegressions(viewport);
  }
  assert.equal(report.consoleErrors.length, 0);
  assert.equal(report.pageErrors.length, 0);
  assert.equal(report.responses404.length, 0);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`festival entrance opening browser check passed: ${report.scans.length} scans, ${report.oldCampusAudit.length} campus audits`);
