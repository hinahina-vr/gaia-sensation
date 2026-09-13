import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4319"] = process.argv.slice(2);
const welcomeAvatarOnly = process.argv.includes("--welcome-avatar-only");
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const outputDir = path.resolve(outputArgument || "artifacts/contest-v10-candidate");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const interactions = [
  { name: "map01", stepId: "map_mode01_004", nextStepId: "map_mode01_005", modal: "#japan-layer" },
  { name: "map01-temperature", stepId: "map_mode01_023", nextStepId: "map_mode01_024", modal: "#japan-layer" },
  { name: "gx", stepId: "gx_experience_017", nextStepId: "gx_experience_018", modal: "#gx-layer" },
];
const welcomeCases = [
  { name: "wide", stepId: "welcome_chat_006", device: "wide", slack: true },
  { name: "physical-mizuha", stepId: "welcome_chat_055", device: "wide", slack: false, cast: "novel-character-minamo" },
  { name: "physical-amane", stepId: "welcome_chat_060", device: "wide", slack: false, cast: "novel-character-sora" },
  { name: "mobile", stepId: "welcome_chat_081", device: "mobile", slack: true },
];
const cinematicCases = [
  { name: "festival-start", stepId: "festival_concept_001", cue: "festival-convention-hall-entrance", asset: "novel-bg-convention-hall-entrance-autumn-morning-v2.png", motion: "push-in", mobile: true },
  { name: "festival-convention-hall", stepId: "festival_concept_002", cue: "festival-convention-hall-entrance", asset: "novel-bg-convention-hall-entrance-autumn-morning-v2.png", motion: "push-in", mobile: true },
  { name: "b-hall-overview", stepId: "festival_concept_008", cue: "festival-b-hall-overview", asset: "novel-bg-festival-b-hall-autumn-morning-v1.png", motion: "push-in" },
  { name: "first-encounter-cg", stepId: "festival_concept_015", cue: "festival-first-encounter-cg", asset: "event-cg-first-encounter-five-plane-v3.png", mobileAsset: "event-cg-first-encounter-five-plane-mobile-v2.png", motion: "event-focus", eventCg: true, mobile: true },
  { name: "amane-closeup-cg", stepId: "festival_concept_021", cue: "festival-amane-closeup-cg", asset: "event-cg-amane-closeup-five-plane-v4.png", motion: "event-focus", eventCg: true, mobile: true },
  { name: "mizuha-closeup-cg", stepId: "festival_concept_023", cue: "festival-mizuha-closeup-cg", asset: "event-cg-mizuha-closeup-five-plane-v3.png", motion: "event-focus", eventCg: true, mobile: true },
  { name: "mizuha-reply-cg", stepId: "festival_concept_027", cue: "festival-mizuha-closeup-cg", asset: "event-cg-mizuha-closeup-five-plane-v3.png", motion: "event-focus", eventCg: true },
  { name: "gx-booth", stepId: "gx_experience_001", cue: "gx-ocean-entry", asset: "novel-bg-gx-ancient-ocean-autumn-morning-v3.png", motion: "push-in" },
  { name: "esp32-collaboration-cg", stepId: "esp32_pitch_008", cue: "esp32-exhibition-proposal", asset: "event-cg-esp32-collaboration-v2.png", mobileAsset: "event-cg-esp32-collaboration-mobile-v1.png", motion: "event-focus", eventCg: true, mobile: true },
  { name: "circle-welcome-cg", stepId: "circle_invitation_048", cue: "circle-welcome-cg", asset: "event-cg-circle-welcome-v2.png", mobileAsset: "event-cg-circle-welcome-mobile-v1.png", motion: "event-focus", eventCg: true, mobile: true },
  { name: "wide-chat", stepId: "welcome_chat_006", cue: "welcome-online-arrival", asset: "novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
  { name: "physical-venue", stepId: "welcome_chat_055", cue: "welcome-physical-booth", asset: "novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
  { name: "closing-exhibition", stepId: "welcome_chat_078", cue: "welcome-night-exit-mobile", asset: "01-turning-in-the-sunset.webp", mobileAsset: "01-turning-in-the-sunset.webp", motion: "drift-left", eventCg: true, mobile: true },
  { name: "earth-partner-reflection", stepId: "welcome_chat_084", cue: "welcome-earth-partner-reflection", asset: "01-turning-in-the-sunset.webp", mobileAsset: "01-turning-in-the-sunset.webp", motion: "push-in", eventCg: true, mobile: true },
  { name: "exhibition-finale-cg", stepId: "welcome_chat_092", cue: "welcome-exhibition-finale-cg", asset: "01-turning-in-the-sunset.webp", mobileAsset: "01-turning-in-the-sunset.webp", motion: "event-focus", eventCg: true, mobile: true },
];
const report = { status: "running", scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const stateFor = (storyVersion, stepId, extra = {}) => ({
  storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "気候の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: false },
  audio: { muted: true, volume: 0.37 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `contest-v10-${stepId}`,
  ...extra,
});

const createPage = async (viewport, label, reducedMotion = "reduce") => {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  await page.addInitScript(() => {
    globalThis.__contestVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
  });
  return { context, page };
};

const bootAt = async (page, stepId, extra = {}, storyVersion = 10, expectedStepId = stepId, reducedMotion = true) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate(({ candidate, config }) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify(config));
    localStorage.setItem("gaia-senseware-bgm-volume", String(candidate.audio.volume));
  }, {
    candidate: stateFor(storyVersion, stepId, extra),
    config: { messageSpeedPercent: 400, reducedMotion },
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, expectedStepId);
};

const layoutSnapshot = (page) => page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth + 1,
  visibleCast: [...document.querySelectorAll("#novel-cast .novel-character")]
    .filter((node) => globalThis.__contestVisible(node)).map((node) => node.id),
  visibleSakuImages: [...document.querySelectorAll("img[src*='saku' i], #novel-character-sakuya")]
    .filter((node) => globalThis.__contestVisible(node)).length,
  audioCue: document.querySelector("#novel-layer")?.dataset.storyAudioCue || "",
}));

try {
  if (!welcomeAvatarOnly) {
    const staticContext = await browser.newContext({ viewport: viewports[0], reducedMotion: "reduce" });
    const staticPage = await staticContext.newPage();
    await staticPage.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await staticPage.waitForFunction(() => Boolean(globalThis.GAIA_NOVEL_STORY));
    const canonical = await staticPage.evaluate(() => {
      const story = globalThis.GAIA_NOVEL_STORY;
      const steps = story.scenes.flatMap((scene) => scene.steps);
      return {
        storyVersion: story.storyVersion,
        sceneIds: story.scenes.map((scene) => scene.id),
        stepCount: steps.length,
        interactions: steps.filter((step) => step.type === "interaction").map((step) => [step.id, step.interaction.kind]),
        requiredInteractions: story.requiredInteractions,
      };
    });
    assert.deepEqual(canonical, {
      storyVersion: 10,
      sceneIds: ["festival_concept", "map_mode01", "gx_experience", "esp32_pitch", "circle_invitation", "welcome_chat"],
      stepCount: 372,
      interactions: [["map_mode01_004", "map01"], ["map_mode01_023", "map01"], ["gx_experience_017", "gx"]],
      requiredInteractions: ["map01", "gx"],
    });
    await staticContext.close();

    const motionLabel = "pc-1440-cinematic-motion";
    const { context: motionContext, page: motionPage } = await createPage(viewports[0], motionLabel, "no-preference");
    await bootAt(motionPage, "festival_concept_001", {}, 10, "festival_concept_001", false);
    const motionScan = await motionPage.evaluate(() => {
      const novelLayer = document.querySelector("#novel-layer");
      const style = getComputedStyle(novelLayer);
      return {
        cue: novelLayer?.dataset.backgroundCue || "",
        motion: novelLayer?.dataset.backgroundMotion || "",
        reduced: novelLayer?.classList.contains("is-motion-reduced") || false,
        animationName: style.animationName,
        animationDuration: style.animationDuration,
      };
    });
    assert.deepEqual(motionScan, {
      cue: "festival-convention-hall-entrance",
      motion: "push-in",
      reduced: false,
      animationName: "none",
      animationDuration: "0s",
    });
    report.scans.push({ viewport: viewports[0], case: "cinematic-motion", ...motionScan, passed: true });
    await motionContext.close();
  }

  for (const viewport of viewports) {
    if (!welcomeAvatarOnly) {
    const startLabel = `${viewport.name}-festival-start`;
    const { context: startContext, page: startPage } = await createPage(viewport, startLabel);
    await startPage.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await startPage.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await startPage.evaluate(() => {
      localStorage.removeItem("gaiaSensewareNovel:progress");
          localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      globalThis.GaiaNovel.open();
    });
    await startPage.locator("#novel-start-button").click();
    await startPage.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "festival_concept_001");
    const startScan = { stepId: await startPage.evaluate(() => globalThis.GaiaNovel.getState().stepId), ...(await layoutSnapshot(startPage)) };
    assert.equal(startScan.overflow, false);
    report.scans.push({ viewport, case: "festival-start", ...startScan, passed: true });
    await startPage.screenshot({ path: path.join(outputDir, `${startLabel}.png`) });
    await startContext.close();

    const migrationLabel = `${viewport.name}-v9-save`;
    const { context: migrationContext, page: migrationPage } = await createPage(viewport, migrationLabel);
    await bootAt(migrationPage, "current_exhibition_001", {
      unknownFuturePayload: { nested: "keep", count: 7 },
      unknownScalar: "keep",
    }, 9, "festival_concept_001");
    const migrated = await migrationPage.evaluate(() => globalThis.GaiaNovel.getState());
    assert.equal(migrated.stepId, "festival_concept_001");
    assert.deepEqual(migrated.audio, { muted: true, volume: 0.37 });
    assert.deepEqual(migrated.unknownFuturePayload, { nested: "keep", count: 7 });
    assert.equal(migrated.unknownScalar, "keep");
    report.scans.push({ viewport, case: "v9-save", stepId: migrated.stepId, audio: migrated.audio, unknownPreserved: true, passed: true });
    await migrationContext.close();

    const galleryLabel = `${viewport.name}-cg-album`;
    const { context: galleryContext, page: galleryPage } = await createPage(viewport, galleryLabel);
    await galleryPage.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await galleryPage.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await galleryPage.evaluate(() => {
      localStorage.removeItem("gaiaSensewareNovel:progress");
      localStorage.removeItem("gaiaSensewareNovel:cg-gallery:v1");
      globalThis.GaiaNovel.open();
    });
    await galleryPage.locator("#novel-title-gallery-button").click();
    const lockedGallery = await galleryPage.evaluate(() => ({
      visible: globalThis.__contestVisible(document.querySelector("#novel-gallery-panel")),
      state: globalThis.GaiaNovel.getGalleryState(),
      cards: document.querySelectorAll(".novel-gallery-card").length,
      lockedCards: document.querySelectorAll(".novel-gallery-card[data-unlocked='false']").length,
      leakedImages: document.querySelectorAll(".novel-gallery-card[data-unlocked='false'] img[src]").length,
      progress: document.querySelector("#novel-gallery-progress-value")?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(lockedGallery.visible, true);
    assert.deepEqual(lockedGallery.state, { unlocked: [], total: 6, count: 0, percentage: 0 });
    assert.equal(lockedGallery.cards, 6);
    assert.equal(lockedGallery.lockedCards, 6);
    assert.equal(lockedGallery.leakedImages, 0);
    assert.equal(lockedGallery.progress, "0%");
    assert.equal(lockedGallery.overflow, false);
    await galleryPage.screenshot({ path: path.join(outputDir, `${galleryLabel}-locked.png`) });
    await galleryPage.locator("#novel-gallery-close").click();

    const galleryUnlockSteps = [
      "festival_concept_015",
      "festival_concept_021",
      "festival_concept_023",
      "esp32_pitch_008",
      "circle_invitation_048",
      "welcome_chat_092",
    ];
    for (let index = 0; index < galleryUnlockSteps.length; index += 1) {
      await bootAt(galleryPage, galleryUnlockSteps[index]);
      assert.equal((await galleryPage.evaluate(() => globalThis.GaiaNovel.getGalleryState().count)), index + 1);
    }
    await galleryPage.evaluate(() => globalThis.GaiaNovel.open());
    await galleryPage.locator("#novel-title-gallery-button").click();
    const completeGallery = await galleryPage.evaluate(() => ({
      visible: globalThis.__contestVisible(document.querySelector("#novel-gallery-panel")),
      state: globalThis.GaiaNovel.getGalleryState(),
      unlockedCards: document.querySelectorAll(".novel-gallery-card[data-unlocked='true']").length,
      progress: document.querySelector("#novel-gallery-progress-value")?.textContent,
      titleProgress: document.querySelector("#novel-title-gallery-progress")?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(completeGallery.visible, true);
    assert.equal(completeGallery.state.total, 6);
    assert.equal(completeGallery.state.count, 6);
    assert.equal(completeGallery.state.percentage, 100);
    assert.equal(completeGallery.unlockedCards, 6);
    assert.equal(completeGallery.progress, "100%");
    assert.equal(completeGallery.titleProgress, "6 / 6｜100%");
    assert.equal(completeGallery.overflow, false);
    await galleryPage.locator(".novel-gallery-card[data-gallery-id='exhibition-finale']").click();
    const viewerGallery = await galleryPage.evaluate(() => ({
      visible: globalThis.__contestVisible(document.querySelector("#novel-gallery-viewer")),
      image: document.querySelector("#novel-gallery-viewer-image")?.getAttribute("src") || "",
      title: document.querySelector("#novel-gallery-viewer-title")?.textContent || "",
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(viewerGallery.visible, true);
    const expectedGalleryImage = viewport.name === "mobile-390"
      ? "01-turning-in-the-sunset.webp"
      : "01-turning-in-the-sunset.webp";
    assert(viewerGallery.image.includes(expectedGalleryImage));
    assert.equal(viewerGallery.title, "夕暮れの帰り道");
    assert.equal(viewerGallery.overflow, false);
    report.scans.push({ viewport, case: "cg-album", lockedGallery, completeGallery, viewerGallery, passed: true });
    await galleryPage.screenshot({ path: path.join(outputDir, `${galleryLabel}-viewer.png`) });
    await galleryContext.close();

    const welcomeEntryLabel = `${viewport.name}-welcome-entry`;
    const { context: welcomeEntryContext, page: welcomeEntryPage } = await createPage(viewport, welcomeEntryLabel);
    await bootAt(welcomeEntryPage, "welcome_chat_001", {}, 10, "welcome_chat_002");
    const welcomeEntryScan = await welcomeEntryPage.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      stepType: document.querySelector("#novel-layer")?.dataset.stepType || "",
      internalMessageVisible: document.body.innerText.includes("# はじめまして／人物画像は表示しない"),
      dialogueText: document.querySelector("#novel-text")?.textContent || "",
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(welcomeEntryScan.stepId, "welcome_chat_002");
    assert.equal(welcomeEntryScan.stepType, "narration");
    assert.equal(welcomeEntryScan.internalMessageVisible, false);
    assert.match(welcomeEntryScan.dialogueText, /学生ポータル/);
    assert.equal(welcomeEntryScan.overflow, false);
    for (let attempt = 0; attempt < 3 && await welcomeEntryPage.evaluate(() => globalThis.GaiaNovel.getState().stepId !== "welcome_chat_003"); attempt += 1) {
      await welcomeEntryPage.locator("#novel-dialogue").click({ position: { x: 20, y: 20 } });
      await welcomeEntryPage.waitForTimeout(80);
    }
    await welcomeEntryPage.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "welcome_chat_003");
    const welcomeAdvanced = await welcomeEntryPage.evaluate(() => ({
      stepId: globalThis.GaiaNovel.getState().stepId,
      internalMessageVisible: document.body.innerText.includes("# はじめまして／人物画像は表示しない"),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.deepEqual(welcomeAdvanced, {
      stepId: "welcome_chat_003",
      internalMessageVisible: false,
      overflow: false,
    });
    report.scans.push({ viewport, case: "welcome-entry", ...welcomeEntryScan, advancedTo: welcomeAdvanced.stepId, passed: true });
    await welcomeEntryPage.screenshot({ path: path.join(outputDir, `${welcomeEntryLabel}.png`) });
    await welcomeEntryContext.close();

    for (const testCase of cinematicCases) {
      if (viewport.name === "mobile-390" && !testCase.mobile) continue;
      const label = `${viewport.name}-cinematic-${testCase.name}`;
      const { context, page } = await createPage(viewport, label);
      await bootAt(page, testCase.stepId);
      const scan = await page.evaluate(() => {
        const novelLayer = document.querySelector("#novel-layer");
        return {
          stepId: globalThis.GaiaNovel.getState().stepId,
          cue: novelLayer?.dataset.backgroundCue || "",
          motion: novelLayer?.dataset.backgroundMotion || "",
          presentation: novelLayer?.dataset.backgroundPresentation || "scenic",
          backgroundImage: getComputedStyle(novelLayer).backgroundImage,
          castSuppressed: novelLayer?.classList.contains("is-cast-suppressed") || false,
          visibleCast: [...document.querySelectorAll("#novel-cast .novel-character")]
            .filter((node) => globalThis.__contestVisible(node)).map((node) => node.id),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.equal(scan.stepId, testCase.stepId);
      assert.equal(scan.cue, testCase.cue);
      assert.equal(scan.motion, testCase.motion);
      assert.equal(scan.presentation, testCase.eventCg ? "event-cg" : "scenic");
      const expectedAsset = viewport.name === "mobile-390" && testCase.mobileAsset ? testCase.mobileAsset : testCase.asset;
      assert(scan.backgroundImage.includes(expectedAsset), `${label}: expected ${expectedAsset} in ${scan.backgroundImage}`);
      assert.equal(scan.castSuppressed, Boolean(testCase.eventCg));
      if (testCase.eventCg) assert.equal(scan.visibleCast.length, 0);
      assert.equal(scan.overflow, false);
      report.scans.push({ viewport, case: `cinematic-${testCase.name}`, ...scan, passed: true });
      await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
      await context.close();
    }

    for (const testCase of interactions) {
      const label = `${viewport.name}-${testCase.name}`;
      const { context, page } = await createPage(viewport, label);
      await bootAt(page, testCase.stepId);
      const prep = await page.evaluate((modal) => ({
        lifecycle: document.body.dataset.novelInteractionState,
        promptVisible: globalThis.__contestVisible(document.querySelector(".novel-interaction-open")),
        modalVisible: globalThis.__contestVisible(document.querySelector(modal)),
      }), testCase.modal);
      assert(["prep", "open"].includes(prep.lifecycle));
      if (prep.lifecycle === "prep") {
        assert.deepEqual(prep, { lifecycle: "prep", promptVisible: true, modalVisible: false });
        await page.locator(".novel-interaction-open").click();
      } else {
        assert.equal(prep.promptVisible, false);
      }
      await page.waitForFunction((modal) => document.body.dataset.novelInteractionState === "open" && globalThis.__contestVisible(document.querySelector(modal)), testCase.modal);
      const open = await page.evaluate((modal) => ({
        storyHidden: document.querySelector("#novel-layer")?.hidden,
        storyInert: document.querySelector("#novel-layer")?.inert,
        modalVisible: globalThis.__contestVisible(document.querySelector(modal)),
        castVisible: globalThis.__contestVisible(document.querySelector("#novel-cast")),
        dialogueVisible: globalThis.__contestVisible(document.querySelector("#novel-dialogue")),
        navVisible: globalThis.__contestVisible(document.querySelector("#novel-topbar-actions")),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }), testCase.modal);
      assert.equal(open.storyHidden, testCase.name !== "gx");
      assert.equal(open.storyInert, true);
      assert.equal(open.modalVisible, true);
      assert.equal(open.castVisible, false);
      assert.equal(open.dialogueVisible, testCase.name === "gx");
      assert.equal(open.navVisible, false);
      assert.equal(open.overflow, false);
      await page.screenshot({ path: path.join(outputDir, `${label}-open.png`) });

      if (testCase.name === "map01") {
        const timeInput = page.locator("#japan-layer [data-signal-time]").first();
        await timeInput.fill("73");
        await timeInput.dispatchEvent("input");
        await page.locator("#japan-map").press("Enter");
      } else {
        for (let index = 0; index < 3; index += 1) {
          await page.getByRole("button", { name: "段階表示を進める", exact: true }).click();
        }
      }
      const returnButton = page.locator("#story-detour-return");
      assert.equal(await returnButton.isEnabled(), true);
      await returnButton.click();
      await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, testCase.nextStepId);
      await page.waitForFunction((modal) => !globalThis.__contestVisible(document.querySelector(modal)), testCase.modal);
      const closed = await page.evaluate((modal) => ({
        lifecycle: document.body.dataset.novelInteractionState || "idle",
        stepId: globalThis.GaiaNovel.getState().stepId,
        modalVisible: globalThis.__contestVisible(document.querySelector(modal)),
        promptVisible: globalThis.__contestVisible(document.querySelector(".novel-interaction-open")),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }), testCase.modal);
      assert.equal(closed.lifecycle, "idle");
      assert.equal(closed.stepId, testCase.nextStepId);
      assert.equal(closed.modalVisible, false);
      assert.equal(closed.promptVisible, false);
      assert.equal(closed.overflow, false);
      report.scans.push({ viewport, case: testCase.name, prep, open, closed, passed: true });
      await page.screenshot({ path: path.join(outputDir, `${label}-closed.png`) });
      await context.close();
    }
    }

    for (const testCase of welcomeCases) {
      if (welcomeAvatarOnly) {
        const focusedCase = (viewport.name === "pc-1440" && testCase.name === "wide")
          || (viewport.name === "mobile-390" && testCase.name === "mobile");
        if (!focusedCase) continue;
      }
      const label = `${viewport.name}-welcome-${testCase.name}`;
      const { context, page } = await createPage(viewport, label);
      await bootAt(page, testCase.stepId);
      const scan = await page.evaluate(() => {
        const humanSlackAvatars = [...document.querySelectorAll([
          ".novel-slack-post[data-speaker='mizuha'] .novel-slack-avatar",
          ".novel-slack-post[data-speaker='amane'] .novel-slack-avatar",
          ".novel-slack-post[data-speaker='sakuya'] .novel-slack-avatar",
          ".novel-slack-typing[data-speaker='mizuha'] .novel-slack-avatar",
          ".novel-slack-typing[data-speaker='amane'] .novel-slack-avatar",
          ".novel-slack-typing[data-speaker='sakuya'] .novel-slack-avatar",
        ].join(", "))];
        return {
          stepId: globalThis.GaiaNovel.getState().stepId,
          slack: document.querySelector("#novel-layer")?.classList.contains("is-slack"),
          slackDevice: document.querySelector(".novel-slack-workspace")?.dataset.device || "",
          visibleCast: [...document.querySelectorAll("#novel-cast .novel-character")]
            .filter((node) => globalThis.__contestVisible(node)).map((node) => node.id),
          visibleSakuPortraits: [...document.querySelectorAll("#novel-cast img[src*='saku' i], #novel-character-sakuya")]
            .filter((node) => globalThis.__contestVisible(node)).length,
          humanSlackAvatarDomCount: humanSlackAvatars.length,
          humanSlackAvatarVisibleCount: humanSlackAvatars.filter((node) => globalThis.__contestVisible(node)).length,
          sakuTypingAvatarVisible: globalThis.__contestVisible(document.querySelector(".novel-slack-typing[data-speaker='sakuya'] .novel-slack-avatar")),
          audioCue: document.querySelector("#novel-layer")?.dataset.storyAudioCue || "",
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.equal(scan.slack, testCase.slack);
      if (testCase.slack) {
        assert.equal(scan.slackDevice, testCase.device);
        assert(scan.humanSlackAvatarDomCount > 0);
        assert(scan.humanSlackAvatarVisibleCount > 0);
      }
      if (testCase.cast) {
        assert.deepEqual(scan.visibleCast, [testCase.cast]);
      } else {
        assert.equal(scan.visibleCast.length, 0);
      }
      assert.equal(scan.visibleSakuPortraits, 0);
      assert(!scan.audioCue || scan.audioCue === "none");
      assert.equal(scan.overflow, false);
      report.scans.push({ viewport, case: `welcome-${testCase.name}`, ...scan, passed: true });
      await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
      await context.close();
    }

    if (!welcomeAvatarOnly) {
    const endLabel = `${viewport.name}-end`;
    const { context: endContext, page: endPage } = await createPage(viewport, endLabel);
    await bootAt(endPage, "welcome_chat_095");
    assert.equal((await endPage.locator(".novel-staff-roll-finale button").textContent()).trim(), "世界の続きを紡ぐ");
    await endPage.locator(".novel-staff-roll-finale button").click();
    await endPage.waitForFunction(() => {
      const intro = document.querySelector("#intro-layer");
      return Boolean(intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false");
    });
    assert.equal((await endPage.locator("#intro-path-stage .intro-exploration-heading h3").textContent()).trim(), "観測モードを選ぶ", `${endLabel}: free exploration was not opened`);
    assert.equal(await endPage.locator(".novel-end-v6").count(), 0, `${endLabel}: obsolete END panel remained`);
    const endScan = { ...(await layoutSnapshot(endPage)), clear: await endPage.evaluate(() => globalThis.GaiaNovel.getState().clear) };
    assert.equal(endScan.clear, true);
    assert.equal(endScan.overflow, false);
    report.scans.push({ viewport, case: "end", ...endScan, passed: true });
    await endPage.screenshot({ path: path.join(outputDir, `${endLabel}.png`) });
    await endContext.close();
    }
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

console.log("contest v10 candidate browser check passed");
