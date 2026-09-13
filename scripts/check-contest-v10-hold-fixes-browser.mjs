import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4387"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/contest-v10-hold-fixes");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-2048-equivalent", width: 1920, height: 1000 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", viewports, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
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
  demoInterest: "気候の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  audio: { muted: true, volume: 0.37 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `contest-v10-hold-${stepId}`,
  ...extra,
});

const createPage = async (viewport, label, reducedMotion = "reduce") => {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  await page.addInitScript(() => {
    globalThis.__holdVisible = (element) => {
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
    localStorage.setItem("gaia-senseware-bgm-volume", String(candidate.audio.volume));
  }, stateFor(stepId, extra));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
};

const rectInViewport = (rect, width, height, edge = 0) => (
  rect.width > 0 && rect.height > 0
  && rect.left >= edge && rect.top >= edge
  && rect.right <= width - edge && rect.bottom <= height - edge
);

const scanMap = async (viewport) => {
  const label = `${viewport.name}-map01`;
  const { context, page } = await createPage(viewport, label);
  await bootAt(page, "map_mode01_004", { readStepIds: ["map_mode01_001", "map_mode01_002", "map_mode01_003"] });
  const prep = await page.evaluate(() => ({
    lifecycle: document.body.dataset.novelInteractionState,
    launcherDomCount: document.querySelectorAll(".novel-interaction-open").length,
    launcherVisible: __holdVisible(document.querySelector(".novel-interaction-open")),
    modalVisible: __holdVisible(document.querySelector("#japan-layer")),
  }));
  assert.deepEqual(prep, { lifecycle: "prep", launcherDomCount: 1, launcherVisible: true, modalVisible: false });
  await page.locator(".novel-interaction-open").click();
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && __holdVisible(document.querySelector("#japan-layer")));
  const open = await page.evaluate(() => {
    const input = document.querySelector("#japan-layer [data-signal-time]");
    const consoleElement = document.querySelector("#japan-layer .signal-console-map");
    const dock = document.querySelector("#japan-layer .story-detour-dock");
    const returnButton = document.querySelector("#story-detour-return");
    return {
      storyHidden: document.querySelector("#novel-layer")?.hidden,
      storyInert: document.querySelector("#novel-layer")?.inert,
      inputVisible: __holdVisible(input),
      inputDisabled: input?.disabled,
      inputRect: input?.getBoundingClientRect().toJSON(),
      consoleRect: consoleElement?.getBoundingClientRect().toJSON(),
      dockRect: dock?.getBoundingClientRect().toJSON(),
      returnVisible: __holdVisible(returnButton),
      returnEnabled: !returnButton?.disabled,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(open.storyHidden, true);
  assert.equal(open.storyInert, true);
  assert.equal(open.inputVisible, true);
  assert.equal(open.inputDisabled, false);
  assert.equal(rectInViewport(open.inputRect, viewport.width, viewport.height), true);
  assert.equal(open.returnVisible, true);
  assert.equal(rectInViewport(open.dockRect, viewport.width, viewport.height), true);
  assert.equal(open.returnEnabled, false);
  assert.equal(open.overflow, false);
  const timeInput = page.locator("#japan-layer [data-signal-time]").first();
  const priorValue = Number(await timeInput.inputValue());
  const inputRange = await timeInput.evaluate((input) => ({ min: Number(input.min), max: Number(input.max) }));
  const inputBox = await timeInput.boundingBox();
  assert(inputBox, "MAP01 year input has no pointer target");
  const pointerRatio = priorValue <= (inputRange.min + inputRange.max) / 2 ? 0.88 : 0.12;
  await page.mouse.click(inputBox.x + inputBox.width * pointerRatio, inputBox.y + inputBox.height / 2);
  const pointerChangedValue = Number(await timeInput.inputValue());
  assert.notEqual(pointerChangedValue, priorValue);
  await timeInput.focus();
  await timeInput.press("Home");
  await timeInput.press("ArrowRight");
  const keyboardChangedValue = Number(await timeInput.inputValue());
  assert.notEqual(keyboardChangedValue, pointerChangedValue);
  await page.locator("#japan-map").click({ position: { x: 32, y: 32 } });
  const returnButton = page.locator("#story-detour-return");
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  await returnButton.click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_005");
  const closed = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState || "idle",
    modalVisible: __holdVisible(document.querySelector("#japan-layer")),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.deepEqual(closed, { stepId: "map_mode01_005", lifecycle: "idle", modalVisible: false, overflow: false });
  await page.screenshot({ path: path.join(outputDir, `${label}-closed.png`) });
  report.scans.push({ viewport: viewport.name, case: "map01-normal-resume", prep, open, priorValue, pointerChangedValue, keyboardChangedValue, closed, passed: true });
  await context.close();
};

const performGxGesture = async (page) => {
  const target = await page.evaluate(() => {
    const canvas = document.querySelector("#gx-canvas");
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return null;
    const candidates = [
      [0.69, 0.5], [0.62, 0.5], [0.76, 0.5], [0.69, 0.4], [0.69, 0.6],
      [0.58, 0.42], [0.58, 0.58], [0.8, 0.42], [0.8, 0.58],
    ];
    for (const [nx, ny] of candidates) {
      const x = rect.left + rect.width * nx;
      const y = rect.top + rect.height * ny;
      if (document.elementFromPoint(x, y) === canvas) return { x, y, nx, ny };
    }
    return { x: rect.left + rect.width * 0.69, y: rect.top + rect.height * 0.5, blocked: true };
  });
  assert(target && !target.blocked, `GX water surface is blocked at required gesture points: ${JSON.stringify(target)}`);
  const { x, y } = target;
  await page.mouse.move(x - 18, y);
  await page.mouse.down();
  await page.mouse.move(x + 18, y + 8, { steps: 8 });
  await page.mouse.up();
};

const scanGx = async (viewport) => {
  const label = `${viewport.name}-gx`;
  const { context, page } = await createPage(viewport, label, "no-preference");
  await bootAt(page, "gx_experience_017", { readStepIds: ["gx_experience_016"] });
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && __holdVisible(document.querySelector("#gx-layer")));
  await page.waitForTimeout(520);
  const open = await page.evaluate(() => {
    const gx = document.querySelector("#gx-layer");
    const story = document.querySelector("#novel-layer");
    return {
      launcherDomCount: document.querySelectorAll(".novel-interaction-open, .novel-interaction-skip").length,
      launcherVisibleCount: [...document.querySelectorAll(".novel-interaction-open, .novel-interaction-skip")].filter(__holdVisible).length,
      storyHidden: story?.hidden,
      storyAriaHidden: story?.getAttribute("aria-hidden"),
      storyInert: story?.inert,
      storyBackground: getComputedStyle(story).backgroundImage,
      backdropVisible: __holdVisible(document.querySelector("#gx-story-backdrop")),
      gxRect: gx?.getBoundingClientRect().toJSON(),
      returnEnabled: !document.querySelector("#story-detour-return")?.disabled,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(open.launcherDomCount, 0);
  assert.equal(open.launcherVisibleCount, 0);
  assert.equal(open.storyHidden, false);
  assert.equal(open.storyAriaHidden, "true");
  assert.equal(open.storyInert, true);
  assert.notEqual(open.storyBackground, "none");
  assert.equal(open.backdropVisible, true);
  assert.equal(open.gxRect.left > 0 && open.gxRect.top > 0 && open.gxRect.right < viewport.width && open.gxRect.bottom < viewport.height, true);
  assert.equal(open.returnEnabled, false);
  assert.equal(open.overflow, false);
  for (let index = 0; index < 3; index += 1) await performGxGesture(page);
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  await page.locator("#story-detour-return").click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "gx_experience_018");
  await page.waitForTimeout(700);
  const closed = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState || "idle",
    gxVisible: __holdVisible(document.querySelector("#gx-layer")),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.deepEqual(closed, { stepId: "gx_experience_018", lifecycle: "idle", gxVisible: false, overflow: false });
  await page.screenshot({ path: path.join(outputDir, `${label}-closed.png`) });
  report.scans.push({ viewport: viewport.name, case: "gx-auto-overlay-resume", open, closed, passed: true });
  await context.close();
};

const chatCases = [
  { stepId: "welcome_chat_004", nextStepId: "welcome_chat_005", speaker: "SYSTEM" },
  { stepId: "welcome_chat_024", nextStepId: "welcome_chat_025", speaker: "saku" },
  { stepId: "welcome_chat_083", nextStepId: "welcome_chat_084", speaker: "saku" },
];

const scanChat = async (viewport) => {
  for (const testCase of chatCases) {
    const label = `${viewport.name}-chat-${testCase.stepId}`;
    const { context, page } = await createPage(viewport, label);
    await bootAt(page, testCase.stepId);
    await page.waitForTimeout(180);
    const scan = await page.evaluate(() => {
      const dialogue = document.querySelector("#novel-dialogue");
      const current = document.querySelector(".novel-slack-post.is-new");
      const text = document.querySelector("#novel-text");
      const speaker = document.querySelector("#novel-speaker");
      const continueMark = document.querySelector("#novel-continue");
      const symbolicAvatars = [...document.querySelectorAll([
        ".novel-slack-post[data-speaker='mizuha'] .novel-slack-avatar",
        ".novel-slack-post[data-speaker='amane'] .novel-slack-avatar",
        ".novel-slack-post[data-speaker='sakuya'] .novel-slack-avatar",
        ".novel-slack-post[data-speaker='visitor'] .novel-slack-avatar",
        ".novel-slack-typing[data-speaker='mizuha'] .novel-slack-avatar",
        ".novel-slack-typing[data-speaker='amane'] .novel-slack-avatar",
        ".novel-slack-typing[data-speaker='sakuya'] .novel-slack-avatar",
        ".novel-slack-typing[data-speaker='visitor'] .novel-slack-avatar",
      ].join(", "))];
      return {
        dialogueVisible: __holdVisible(dialogue),
        speaker: speaker?.textContent || "",
        vnText: text?.textContent || "",
        slackText: current?.querySelector(".novel-slack-message")?.textContent || "",
        currentPostVisible: __holdVisible(current),
        continueVisible: __holdVisible(continueMark),
        dialogueRect: dialogue?.getBoundingClientRect().toJSON(),
        speakerRect: speaker?.getBoundingClientRect().toJSON(),
        continueRect: continueMark?.getBoundingClientRect().toJSON(),
        textFits: text.scrollHeight <= text.clientHeight + 1,
        symbolicAvatarDomCount: symbolicAvatars.length,
        symbolicAvatarVisibleCount: symbolicAvatars.filter(__holdVisible).length,
        humanSlackAvatarDomCount: document.querySelectorAll(".novel-slack-avatar[data-human-avatar], .novel-slack-avatar img[src*='/characters/']").length,
        sakuTypingSymbolVisible: __holdVisible(document.querySelector(".novel-slack-typing[data-speaker='sakuya'] .novel-slack-avatar[data-symbol='flower']")),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.equal(scan.dialogueVisible, true);
    assert.equal(scan.speaker, testCase.speaker);
    assert.equal(scan.vnText.replace(/\s+/gu, ""), scan.slackText.replace(/\s+/gu, ""));
    assert.equal(scan.currentPostVisible, true);
    assert.equal(scan.continueVisible, true);
    assert.equal(rectInViewport(scan.dialogueRect, viewport.width, viewport.height), true);
    assert.equal(rectInViewport(scan.speakerRect, viewport.width, viewport.height), true);
    assert.equal(rectInViewport(scan.continueRect, viewport.width, viewport.height), true);
    assert.equal(scan.textFits, true);
    assert.equal(scan.humanSlackAvatarDomCount, 0);
    assert(scan.symbolicAvatarDomCount > 0);
    assert.equal(scan.symbolicAvatarVisibleCount, scan.symbolicAvatarDomCount);
    if (testCase.stepId === "welcome_chat_083") assert.equal(scan.sakuTypingSymbolVisible, true);
    assert.equal(scan.overflow, false);
    await page.locator("#novel-dialogue").click({ position: { x: 24, y: 24 } });
    await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, testCase.nextStepId);
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), testCase.nextStepId);
    report.scans.push({ viewport: viewport.name, case: `chat-${testCase.stepId}`, ...scan, nextStepId: testCase.nextStepId, passed: true });
    if (testCase.stepId === "welcome_chat_024") await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
    await context.close();
  }
};

const scanChatProgressionInputs = async (viewport) => {
  const inputs = [
    { name: "space", stepId: "welcome_chat_024", nextStepId: "welcome_chat_025", run: (page) => page.locator("#novel-dialogue").press("Space") },
    { name: "auto", stepId: "welcome_chat_025", nextStepId: "welcome_chat_026", run: (page) => page.locator("#novel-auto-button").click() },
    { name: "fast-forward", stepId: "welcome_chat_026", nextStepId: "welcome_chat_027", run: async (page) => {
      await page.locator("#novel-fast-forward-button").click();
      await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, "welcome_chat_027");
      await page.locator("#novel-fast-forward-button").click();
    } },
  ];
  for (const input of inputs) {
    const { context, page } = await createPage(viewport, `${viewport.name}-chat-${input.name}`);
    await bootAt(page, input.stepId);
    await page.waitForTimeout(180);
    await input.run(page);
    await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, input.nextStepId);
    await page.waitForTimeout(input.name === "auto" ? 140 : 40);
    const actual = await page.evaluate(() => globalThis.GaiaNovel.getState().stepId);
    assert.equal(actual, input.nextStepId);
    if (input.name === "auto") await page.locator("#novel-auto-button").click();
    report.scans.push({ viewport: viewport.name, case: `chat-input-${input.name}`, from: input.stepId, to: actual, passed: true });
    await context.close();
  }
};

const nameCases = [
  ["festival_concept_016", "短髪の女性"],
  ["festival_concept_021", "短髪の女性"],
  ["festival_concept_023", "長髪の女性"],
  ["festival_concept_032", "あめ"],
  ["festival_concept_036", "みず"],
  ["map_mode01_011", "あなた"],
];

const scanNamesAndBackgrounds = async (viewport) => {
  for (const [stepId, expected] of nameCases) {
    const { context, page } = await createPage(viewport, `${viewport.name}-name-${stepId}`);
    await bootAt(page, stepId);
    const actual = await page.locator("#novel-speaker").textContent();
    assert.equal(actual, expected);
    await page.locator("#novel-log-button").click();
    const logHeader = await page.locator(`#novel-log-content article[data-step-id="${stepId}"] p`).first().textContent();
    assert.equal(logHeader?.startsWith(`${expected} /`), true);
    report.scans.push({ viewport: viewport.name, case: `name-${stepId}`, actual, logHeader, passed: true });
    await context.close();
  }
  const backgroundSteps = [
    ["festival_concept_014", "festival-gaia-booth-approach"],
    ["festival_concept_015", "festival-first-encounter-cg"],
    ["festival_concept_027", "festival-mizuha-closeup-cg"],
    ["gx_experience_016", "gx-ocean-entry"],
    ["gx_experience_018", "gx-ancient-ocean"],
    ["welcome_chat_073", "welcome-booth-packdown"],
    ["welcome_chat_074", "welcome-night-exit-mobile"],
    ["welcome_chat_092", "welcome-exhibition-finale-cg"],
  ];
  for (const [stepId, cue] of backgroundSteps) {
    const { context, page } = await createPage(viewport, `${viewport.name}-background-${stepId}`);
    await bootAt(page, stepId);
    const scan = await page.evaluate(() => ({
      cue: document.querySelector("#novel-layer")?.dataset.backgroundCue,
      backgroundImage: getComputedStyle(document.querySelector("#novel-layer")).backgroundImage,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(scan.cue, cue);
    assert.notEqual(scan.backgroundImage, "none");
    assert.equal(scan.overflow, false);
    report.scans.push({ viewport: viewport.name, case: `background-${stepId}`, ...scan, passed: true });
    await context.close();
  }
};

const galleryUnlockSteps = [
  "festival_concept_015",
  "festival_concept_021",
  "festival_concept_023",
  "esp32_pitch_008",
  "circle_invitation_048",
  "welcome_chat_092",
];

const scanGallery = async (viewport) => {
  const label = `${viewport.name}-cg-album`;
  const { context, page } = await createPage(viewport, label);
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => {
    localStorage.removeItem("gaiaSensewareNovel:progress");
    localStorage.removeItem("gaiaSensewareNovel:cg-gallery:v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  const titleFresh = await page.evaluate(() => {
    const button = document.querySelector("#novel-title-gallery-button");
    return {
      buttonVisible: __holdVisible(button),
      buttonRect: button?.getBoundingClientRect().toJSON(),
      progress: document.querySelector("#novel-title-gallery-progress")?.textContent,
    };
  });
  assert.equal(titleFresh.buttonVisible, true);
  assert.equal(rectInViewport(titleFresh.buttonRect, viewport.width, viewport.height), true);
  assert.equal(titleFresh.progress, "0 / 6｜0%");
  await page.locator("#novel-title-gallery-button").click();
  await page.waitForFunction(() => __holdVisible(document.querySelector("#novel-gallery-panel")));
  const fresh = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#novel-gallery-grid .novel-gallery-card")];
    const locked = cards.filter((card) => card.dataset.unlocked === "false");
    return {
      cardCount: cards.length,
      lockedCount: locked.length,
      lockedImageSrcCount: locked.filter((card) => card.querySelector("img[src]")).length,
      percentage: document.querySelector("#novel-gallery-progress-value")?.textContent,
      count: document.querySelector("#novel-gallery-progress-copy")?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.deepEqual(fresh, {
    cardCount: 6,
    lockedCount: 6,
    lockedImageSrcCount: 0,
    percentage: "0%",
    count: "0 / 6 UNLOCKED",
    overflow: false,
  });
  await page.locator("#novel-gallery-close").click();

  const sequentialUnlocks = [];
  for (let index = 0; index < galleryUnlockSteps.length; index += 1) {
    const stepId = galleryUnlockSteps[index];
    await bootAt(page, stepId);
    await page.waitForFunction((expected) => {
      const stored = JSON.parse(localStorage.getItem("gaiaSensewareNovel:cg-gallery:v1") || "{}");
      return stored.unlocked?.length === expected;
    }, index + 1);
    const unlocked = await page.evaluate(() => JSON.parse(localStorage.getItem("gaiaSensewareNovel:cg-gallery:v1") || "{}").unlocked || []);
    assert.equal(unlocked.length, index + 1);
    sequentialUnlocks.push({ stepId, count: unlocked.length, ids: unlocked });
  }

  const runtimeRoute = await page.evaluate(() => {
    const button = document.querySelector("#novel-gallery-button");
    return {
      buttonVisible: __holdVisible(button),
      buttonRect: button?.getBoundingClientRect().toJSON(),
      count: document.querySelector("#novel-gallery-count")?.textContent,
    };
  });
  assert.equal(runtimeRoute.buttonVisible, true);
  assert.equal(rectInViewport(runtimeRoute.buttonRect, viewport.width, viewport.height), true);
  assert.equal(runtimeRoute.count, "6 / 6");
  await page.locator("#novel-gallery-button").click();
  await page.waitForFunction(() => __holdVisible(document.querySelector("#novel-gallery-panel")));
  const complete = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#novel-gallery-grid .novel-gallery-card")];
    return {
      cardCount: cards.length,
      unlockedCount: cards.filter((card) => card.dataset.unlocked === "true").length,
      imageSrcCount: cards.filter((card) => card.querySelector("img[src]")).length,
      percentage: document.querySelector("#novel-gallery-progress-value")?.textContent,
      count: document.querySelector("#novel-gallery-progress-copy")?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.deepEqual(complete, {
    cardCount: 6,
    unlockedCount: 6,
    imageSrcCount: 6,
    percentage: "100%",
    count: "6 / 6 UNLOCKED",
    overflow: false,
  });
  await page.locator("#novel-gallery-grid .novel-gallery-card").first().click();
  await page.waitForFunction(() => __holdVisible(document.querySelector("#novel-gallery-viewer")));
  const viewer = await page.evaluate(() => {
    const root = document.querySelector("#novel-gallery-viewer");
    const image = document.querySelector("#novel-gallery-viewer-image");
    return {
      visible: __holdVisible(root),
      rect: root?.getBoundingClientRect().toJSON(),
      imageSrc: image?.getAttribute("src") || "",
      imageVisible: __holdVisible(image),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(viewer.visible, true);
  assert.equal(rectInViewport(viewer.rect, viewport.width, viewport.height), true);
  assert.equal(viewer.imageVisible, true);
  assert.match(viewer.imageSrc, /event-cg-first-encounter-v1\.png$/u);
  assert.equal(viewer.overflow, false);
  await page.screenshot({ path: path.join(outputDir, `${label}-viewer.png`) });
  await page.locator("#novel-gallery-viewer-close").click();
  await page.locator("#novel-gallery-close").click();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  const titleComplete = await page.evaluate(() => ({
    buttonVisible: __holdVisible(document.querySelector("#novel-title-gallery-button")),
    progress: document.querySelector("#novel-title-gallery-progress")?.textContent,
  }));
  assert.deepEqual(titleComplete, { buttonVisible: true, progress: "6 / 6｜100%" });
  await page.locator("#novel-title-gallery-button").click();
  await page.waitForFunction(() => __holdVisible(document.querySelector("#novel-gallery-panel")));
  report.scans.push({ viewport: viewport.name, case: "cg-album-focused", titleFresh, fresh, sequentialUnlocks, runtimeRoute, complete, viewer, titleComplete, passed: true });
  await context.close();
};

const eventCgSafetyCases = [
  ["festival_concept_021", "festival-amane-closeup-cg", "短髪の女性"],
  ["festival_concept_023", "festival-mizuha-closeup-cg", "長髪の女性"],
  ["esp32_pitch_008", "esp32-collaboration-cg", ""],
];

const scanEventCgSafety = async (viewport) => {
  for (const [stepId, cue, expectedSpeaker] of eventCgSafetyCases) {
    const label = `${viewport.name}-event-cg-${stepId}`;
    const { context, page } = await createPage(viewport, label);
    await bootAt(page, stepId);
    await page.waitForTimeout(240);
    const scan = await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const dialogue = document.querySelector("#novel-dialogue");
      const speaker = document.querySelector("#novel-speaker");
      const text = document.querySelector("#novel-text");
      const continueMark = document.querySelector("#novel-continue");
      const nav = document.querySelector("#novel-layer .novel-topbar nav");
      const style = getComputedStyle(text);
      const lineHeight = Number.parseFloat(style.lineHeight) || 1;
      return {
        cue: layer?.dataset.backgroundCue,
        presentation: layer?.dataset.backgroundPresentation,
        backgroundImage: getComputedStyle(layer).backgroundImage,
        dialogueVisible: __holdVisible(dialogue),
        dialogueRect: dialogue?.getBoundingClientRect().toJSON(),
        speakerText: speaker?.textContent || "",
        speakerVisible: __holdVisible(speaker),
        speakerRect: speaker?.getBoundingClientRect().toJSON(),
        textRect: text?.getBoundingClientRect().toJSON(),
        textFits: text.scrollHeight <= text.clientHeight + 1,
        estimatedLines: Math.max(1, Math.round(text.scrollHeight / lineHeight)),
        continueVisible: __holdVisible(continueMark),
        continueRect: continueMark?.getBoundingClientRect().toJSON(),
        topbarVisible: __holdVisible(nav),
        topbarRect: nav?.getBoundingClientRect().toJSON(),
        dialogueTopbarOverlap: (() => {
          const a = dialogue?.getBoundingClientRect();
          const b = nav?.getBoundingClientRect();
          return Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
        })(),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.equal(scan.cue, cue);
    assert.equal(scan.presentation, "event-cg");
    assert.notEqual(scan.backgroundImage, "none");
    assert.equal(scan.dialogueVisible, true);
    assert.equal(scan.speakerText, expectedSpeaker);
    assert.equal(scan.speakerVisible, Boolean(expectedSpeaker));
    assert.equal(scan.continueVisible, true);
    assert.equal(scan.topbarVisible, true);
    assert.equal(rectInViewport(scan.dialogueRect, viewport.width, viewport.height), true);
    if (expectedSpeaker) assert.equal(rectInViewport(scan.speakerRect, viewport.width, viewport.height), true);
    assert.equal(rectInViewport(scan.textRect, viewport.width, viewport.height), true);
    assert.equal(rectInViewport(scan.continueRect, viewport.width, viewport.height), true);
    assert.equal(rectInViewport(scan.topbarRect, viewport.width, viewport.height), true);
    assert.equal(scan.textFits, true);
    assert(scan.estimatedLines <= 3, `${label}: dialogue exceeds three lines (${scan.estimatedLines})`);
    assert.equal(scan.dialogueTopbarOverlap, false);
    assert.equal(scan.overflow, false);
    await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
    report.scans.push({ viewport: viewport.name, case: `event-cg-safety-${stepId}`, ...scan, passed: true });
    await context.close();
  }
};

try {
  for (const viewport of viewports) {
    await scanMap(viewport);
    await scanGx(viewport);
    await scanChat(viewport);
    await scanChatProgressionInputs(viewport);
    if (viewport.name !== "pc-2048-equivalent") await scanNamesAndBackgrounds(viewport);
  }
  await scanGallery(viewports[1]);
  await scanGallery(viewports[2]);
  await scanEventCgSafety(viewports[1]);
  await scanEventCgSafety(viewports[2]);
  const { context, page } = await createPage(viewports[1], "standalone-gx", "no-preference");
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaGX));
  await page.evaluate(() => globalThis.GaiaGX.open({ returnTo: "intro" }));
  await page.waitForFunction(() => __holdVisible(document.querySelector("#gx-layer")));
  const standalone = await page.evaluate(() => ({
    returnTo: document.querySelector("#gx-layer")?.dataset.returnTo,
    rect: document.querySelector("#gx-layer")?.getBoundingClientRect().toJSON(),
    closeEnabled: !document.querySelector("#gx-close")?.disabled,
  }));
  assert.equal(standalone.returnTo, "intro");
  assert.deepEqual([standalone.rect.left, standalone.rect.top, standalone.rect.right, standalone.rect.bottom], [0, 0, 1440, 900]);
  assert.equal(standalone.closeEnabled, true);
  report.scans.push({ viewport: "pc-1440", case: "gx-standalone", ...standalone, passed: true });
  await context.close();
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

console.log("contest v10 HOLD fixes browser check passed");
