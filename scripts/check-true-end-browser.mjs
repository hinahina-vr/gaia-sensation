import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
const extraArguments = process.argv.slice(6);
const separatorOnly = extraArguments.includes("--separator-only");
const pcOnly = extraArguments.includes("--pc-only");
const mobileOnly = extraArguments.includes("--mobile-only");
const presenceOnly = extraArguments.includes("--presence-only");
const productionSmoke = extraArguments.includes("--production-smoke");
const pageBreakOnly = extraArguments.includes("--page-break-only");
const controlHoldOnly = extraArguments.includes("--control-hold-only");
const skipOnly = extraArguments.includes("--skip-only");
const motionOnly = extraArguments.includes("--motion-only");
const contentOnly = extraArguments.includes("--content-only");
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/true-end-browser");
const ovationSnapshot = fs.readFileSync(path.resolve("data/ovation-aurora-snapshot.json"), "utf8");
fs.mkdirSync(outputDir, { recursive: true });

const installExternalFixtures = (context) => context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: ovationSnapshot,
}));

const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v4";
const OPENING_MESSAGE = "空間の果てが溶け落ち、因果すら途絶えた虚無を越え、休眠記憶を再結合。境界の観測者たちよ、目を覚まして。";
const FINAL_MESSAGE = "ルウは緑の基板を胸に抱き、広大な星々の海へ向けて、楽しそうに問いかける。\n『次は、どこを測ってみようか？』\n遠い宇宙の無数の星々から、光の明滅が楽しそうに応えた。\n放課後は、どこまでも終わらない。";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
].filter(({ name }) => (!pcOnly || name === "pc-1440") && (!mobileOnly || name === "mobile-390"));
const report = {
  status: "running",
  baseUrl,
  viewports: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
  audioResponses: [],
  presenceFades: [],
  aivaFieldMotion: [],
  skipControls: [],
};

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    const source = location.url ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})` : "";
    report.consoleErrors.push(`${label}: ${message.text()}${source}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
    if (/\/assets\/audio\/.*\.(?:mp3|wav)(?:\?|$)/u.test(response.url())) {
      report.audioResponses.push({ label, status: response.status(), url: response.url() });
    }
  });
};

const bootAtTrueEnd = async (page, name, reducedMotion = true) => {
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.evaluate(() => globalThis.GaiaModeLoader.load("story"));
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY && globalThis.GAIA_TRUE_END_STORY));
  const eagerExplorationResources = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource").map(({ name }) => name);
    return resources.filter((name) => name.includes("/data/gaia-signals.json")
      || name.includes("/data/natural-earth-50m-land.geojson"));
  });
  assert.deepEqual(eagerExplorationResources, [], `${name}: story route eagerly loaded exploration data`);
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.evaluate(({ storageKey, configKey, label, reducedMotion: motionPreference }) => {
    localStorage.clear();
    const state = {
      storyVersion: globalThis.GAIA_NOVEL_STORY.storyVersion,
      stepId: "welcome_chat_095",
      reachedSceneIds: ["welcome_chat"],
      viewed: {},
      metCharacters: { mizuha: true, amane: true, sakuya: true },
      evesRoute: [],
      observationOrder: "LOCAL_FIRST",
      editorialChoice: null,
      reflectionIds: [],
      resultTone: null,
      demoInterest: "太古の海",
      audio: { muted: true, volume: 0 },
      readStepIds: [],
      clear: false,
      archivesUnlocked: false,
      sessionId: `true-end-${label}`,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: state,
      savedAt: Date.now(),
      meta: { title: "True End QA", excerpt: state.stepId },
    }]));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 100, reducedMotion: motionPreference }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
    localStorage.removeItem("gaiaSensewareTrueEnd:reached:v1");
    localStorage.removeItem("gaiaSensewareTrueEnd:complete:v1");
  }, { storageKey: STORAGE_KEY, configKey: CONFIG_KEY, label: name, reducedMotion });
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-staff-roll"), null, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
  const staffRoll = page.locator(".novel-staff-roll");
  await staffRoll.waitFor({ state: "visible", timeout: 60_000 });
  if (await staffRoll.getAttribute("data-phase") !== "complete") {
    await page.locator(".novel-staff-roll-data-skip").click();
  }
  await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "complete", null, { timeout: 15_000 });
  await page.locator(".novel-staff-roll-finale button").click();
  await page.waitForFunction(() => Boolean(document.querySelector(".true-end-shell")), null, { timeout: 30_000 });
  await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "trueend", null, { timeout: 10_000 });
  await page.waitForFunction(() => {
    const shell = document.querySelector(".true-end-shell");
    return shell && !shell.classList.contains("is-scene-separating")
      && Boolean(document.querySelector(".true-end-message")?.textContent);
  }, null, { timeout: 8_000 });
  await page.waitForFunction(() => globalThis.GaiaTrueEnd?.isReached?.() === true);
};

const scanFrame = (page) => page.evaluate(() => {
  const shell = document.querySelector(".true-end-shell");
  const dialogue = document.querySelector(".true-end-dialogue");
  const message = document.querySelector(".true-end-message");
  const interfaceLayer = document.querySelector(".true-end-interface");
  const universe = document.querySelector(".true-end-universe");
  const sceneCard = document.querySelector(".true-end-scene-card");
  const sceneCardContent = document.querySelector(".true-end-scene-card-content");
  const audioDock = document.querySelector(".gaia-audio-dock");
  const novelLayer = document.querySelector("#novel-layer");
  const brand = document.querySelector(".true-end-brand");
  const sceneTitle = document.querySelector(".true-end-scene-heading strong");
  const skipButton = document.querySelector(".true-end-skip-button");
  const sceneCardTitle = sceneCardContent?.querySelector("strong");
  const rect = dialogue?.getBoundingClientRect();
  const mainDialogueReference = document.createElement("div");
  mainDialogueReference.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:var(--novel-say-width);height:var(--novel-say-height)";
  shell?.append(mainDialogueReference);
  const mainDialogueRect = mainDialogueReference.getBoundingClientRect();
  mainDialogueReference.remove();
  const messageRect = message?.getBoundingClientRect();
  const dialogueStyle = dialogue ? getComputedStyle(dialogue) : null;
  const messageStyle = message ? getComputedStyle(message) : null;
  const headerRect = document.querySelector(".true-end-header")?.getBoundingClientRect();
  const temporalHeading = document.querySelector(".novel-signal-caption");
  const messageRange = document.createRange();
  if (message) messageRange.selectNodeContents(message);
  const messageLineTops = [...messageRange.getClientRects()]
    .filter((candidate) => candidate.width > 0 && candidate.height > 0)
    .map((candidate) => Math.round(candidate.top * 2) / 2);
  const countTextLines = (element) => {
    if (!element) return 0;
    const range = document.createRange();
    range.selectNodeContents(element);
    return new Set([...range.getClientRects()]
      .filter((candidate) => candidate.width > 0 && candidate.height > 0)
      .map((candidate) => Math.round(candidate.top * 2) / 2)).size;
  };
  const sceneTitleRect = sceneTitle?.getBoundingClientRect();
  const skipRect = skipButton?.getBoundingClientRect();
  const brandRect = brand?.getBoundingClientRect();
  return {
    sampledAt: performance.now(),
    documentHidden: document.hidden,
    novelLayerOpen: Boolean(novelLayer && !novelLayer.hidden && novelLayer.classList.contains("is-open")),
    novelLayerTrueEnd: novelLayer?.classList.contains("is-true-end") || false,
    novelLayerFastForwarding: novelLayer?.classList.contains("is-fast-forwarding") || false,
    novelStoryStepId: novelLayer?.dataset.stepId || "",
    scene: shell?.dataset.scene || "",
    stepId: shell?.dataset.step || "",
    shoreImage: shell?.dataset.shoreImage || "",
    speaker: shell?.dataset.speaker || "",
    title: document.querySelector(".true-end-scene-heading strong")?.textContent?.trim() || "",
    sceneCode: document.querySelector(".true-end-scene-heading span")?.textContent?.trim() || "",
    brandDisplay: brand ? getComputedStyle(brand).display : "",
    brandRect: brandRect ? { left: brandRect.left, right: brandRect.right } : null,
    sceneTitleLineCount: countTextLines(sceneTitle),
    sceneTitleRect: sceneTitleRect ? { left: sceneTitleRect.left, right: sceneTitleRect.right } : null,
    skipVisible: Boolean(skipButton?.getClientRects().length) && getComputedStyle(skipButton).visibility !== "hidden",
    skipText: skipButton?.textContent?.trim() || "",
    skipLabel: skipButton?.getAttribute("aria-label") || "",
    skipRect: skipRect ? {
      left: skipRect.left,
      top: skipRect.top,
      right: skipRect.right,
      bottom: skipRect.bottom,
      width: skipRect.width,
      height: skipRect.height,
    } : null,
    counter: document.querySelector(".true-end-footer span:last-child")?.textContent?.trim() || "",
    footerText: document.querySelector(".true-end-footer")?.textContent?.trim() || "",
    footerSpanCount: document.querySelectorAll(".true-end-footer span").length,
    message: message?.textContent || "",
    messageLang: message?.lang || "",
    speakerName: document.querySelector(".true-end-speaker")?.textContent?.trim() || "",
    speakerCode: document.querySelector(".true-end-speaker-code")?.textContent?.trim() || "",
    speakerCodeLang: document.querySelector(".true-end-speaker-code")?.lang || "",
    readoutPanelCount: document.querySelectorAll(".true-end-readout").length,
    messageFontSize: Number.parseFloat(getComputedStyle(message).fontSize),
    messageLineCount: new Set(messageLineTops).size,
    messageClientHeight: message?.clientHeight || 0,
    messageScrollHeight: message?.scrollHeight || 0,
    messagePage: shell?.dataset.messagePage || "",
    shellUserSelect: getComputedStyle(shell).userSelect,
    universeState: universe?.dataset.webglState || "",
    universeScene: universe?.dataset.webglScene || "",
    universeSpeaker: universe?.dataset.webglSpeaker || "",
    universeManifestation: universe?.dataset.webglManifestation || "",
    universeSignal: Number(universe?.dataset.webglSignal || 0),
    universeEmphasis: universe?.dataset.webglEmphasis || "",
    universePresenceMix: Number(universe?.dataset.webglPresenceMix || 0),
    universePresenceState: universe?.dataset.webglPresenceState || "",
    universePresenceDuration: Number(universe?.dataset.webglPresenceDuration || 0),
    universePresenceCompletedAt: Number(universe?.dataset.webglPresenceCompletedAt || 0),
    universeQuality: universe?.dataset.webglQuality || "",
    universeQualityReason: universe?.dataset.webglQualityReason || "",
    universeAmbientMotion: universe?.dataset.webglAmbientMotion || "",
    universeFrameP95: Number(universe?.dataset.webglFrameP95 || 0),
    messageCommittedAt: Number(shell?.dataset.messageCommittedAt || 0),
    sectionTransitionCompletedAt: Number(shell?.dataset.sectionTransitionCompletedAt || 0),
    universeFrame: Number(universe?.dataset.webglFrame || 0),
    universeSize: { width: universe?.width || 0, height: universe?.height || 0 },
    universeOpacity: universe ? Number.parseFloat(getComputedStyle(universe).opacity) : 0,
    universeBlendMode: universe ? getComputedStyle(universe).mixBlendMode : "",
    universeZIndex: universe ? Number.parseInt(getComputedStyle(universe).zIndex, 10) : 0,
    characterImageCount: document.querySelectorAll(".true-end-shell img").length,
    backdropCount: document.querySelectorAll(".true-end-backdrop").length,
    dialogueRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } : null,
    mainDialogueRect: mainDialogueRect ? {
      x: mainDialogueRect.x,
      y: mainDialogueRect.y,
      width: mainDialogueRect.width,
      height: mainDialogueRect.height,
      bottom: mainDialogueRect.bottom,
    } : null,
    dialogueBorderWidth: dialogueStyle ? Number.parseFloat(dialogueStyle.borderTopWidth) : null,
    dialogueBackground: dialogueStyle?.backgroundImage || "",
    dialogueGlowBackground: dialogue ? getComputedStyle(dialogue, "::after").backgroundImage : "",
    messageTopOffset: rect && messageRect && dialogueStyle
      ? messageRect.top - (rect.top + Number.parseFloat(dialogueStyle.paddingTop))
      : null,
    messageLayoutDebug: {
      dialoguePaddingTop: dialogueStyle?.paddingTop || "",
      dialogueLineHeight: dialogueStyle?.lineHeight || "",
      dialogueFontSize: dialogueStyle?.fontSize || "",
      messageTop: messageStyle?.top || "",
      messageMarginTop: messageStyle?.marginTop || "",
      messageLineHeight: messageStyle?.lineHeight || "",
      messagePosition: messageStyle?.position || "",
      messageTransform: messageStyle?.transform || "",
    },
    headerBottom: headerRect?.bottom || 0,
    temporalHeadingVisible: Boolean(temporalHeading?.getClientRects().length)
      && getComputedStyle(temporalHeading).visibility !== "hidden",
    audioTrack: globalThis.GaiaOpeningAudio?.getState?.().track || "",
    titleUnlocked: globalThis.GaiaTrueEnd?.isReached?.() ?? false,
    reachedMarkerStored: Boolean(localStorage.getItem("gaiaSensewareTrueEnd:reached:v1")),
    audioPlayback: globalThis.GaiaOpeningAudio?.getPlaybackState?.() || null,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    toolbarHidden: getComputedStyle(document.querySelector(".novel-topbar")).visibility === "hidden",
    dialogueVisible: getComputedStyle(dialogue).visibility !== "hidden",
    interfaceOpacity: Number.parseFloat(getComputedStyle(interfaceLayer).opacity),
    interfaceTransitionDuration: getComputedStyle(interfaceLayer).transitionDuration,
    interfaceAnimations: interfaceLayer.getAnimations().map((animation) => ({
      currentTime: animation.currentTime,
      duration: animation.effect?.getTiming().duration,
      playState: animation.playState,
    })),
    motionReduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    separatorActive: shell?.classList.contains("is-scene-separating") || false,
    sectionTransitionPhase: shell?.dataset.sectionTransitionPhase || "",
    sceneCardPhase: sceneCard?.dataset.phase || "",
    sceneCardVisible: sceneCard?.classList.contains("is-active") || false,
    sceneCardOpacity: Number.parseFloat(getComputedStyle(sceneCard).opacity),
    sceneCardBackground: getComputedStyle(sceneCard).backgroundColor,
    sceneCardTitleOpacity: Number.parseFloat(getComputedStyle(sceneCardContent).opacity),
    sceneCardTitle: sceneCardContent?.querySelector("strong")?.textContent?.trim() || "",
    sceneCardTitleLineCount: countTextLines(sceneCardTitle),
    audioDockOpacity: Number.parseFloat(getComputedStyle(audioDock).opacity),
    audioDockInlineOpacity: audioDock?.style.getPropertyValue("opacity") || "",
    audioDockInlinePriority: audioDock?.style.getPropertyPriority("opacity") || "",
    audioDockHidden: audioDock?.hidden || false,
    bodyTransitionClass: document.body.classList.contains("true-end-section-transition"),
    sceneCardAnimation: getComputedStyle(sceneCard).animationName,
    sceneCardAnimations: sceneCard.getAnimations().map((animation) => ({
      currentTime: animation.currentTime,
      duration: animation.effect?.getTiming().duration,
      playState: animation.playState,
    })),
    sceneVisualBackground: shell ? getComputedStyle(shell, "::before").backgroundImage : "",
    sceneVisualOpacity: shell ? Number.parseFloat(getComputedStyle(shell, "::before").opacity) : 0,
    sceneVisualZIndex: shell ? Number.parseInt(getComputedStyle(shell, "::before").zIndex, 10) : 0,
    finaleVisible: Boolean(document.querySelector(".true-end-finale:not([hidden])")),
    logButtonVisible: Boolean(document.querySelector(".true-end-log-button")?.getClientRects().length),
    logButtonText: document.querySelector(".true-end-log-button")?.textContent?.trim() || "",
  };
});

const advanceTransmissionStep = async (page) => {
  const initial = await scanFrame(page);
  let before = initial;
  while (true) {
    const revealing = await page.evaluate(() => document.querySelector(".true-end-shell")?.classList.contains("is-revealing"));
    await page.locator(".true-end-dialogue").click();
    if (revealing) {
      await page.waitForFunction(() => !document.querySelector(".true-end-shell")?.classList.contains("is-revealing"));
      before = await scanFrame(page);
      continue;
    }
    await page.waitForFunction(({ counter, messagePage }) => {
      const shell = document.querySelector(".true-end-shell");
      const currentCounter = document.querySelector(".true-end-footer span:last-child")?.textContent?.trim() || "";
      return currentCounter !== counter || shell?.dataset.messagePage !== messagePage;
    }, { counter: before.counter, messagePage: before.messagePage });
    const after = await scanFrame(page);
    if (after.counter !== initial.counter) return { before: initial, after };
    before = after;
  }
};

const clickOutsideDialogue = async (page, label) => {
  const point = await page.evaluate(() => {
    const x = innerWidth * 0.5;
    const y = innerHeight * 0.38;
    const target = document.elementFromPoint(x, y);
    return {
      x,
      y,
      target: target?.className || target?.tagName || "unknown",
      outsideDialogue: !target?.closest?.(".true-end-dialogue"),
    };
  });
  assert.equal(point.outsideDialogue, true, `${label}: outside-click test point landed in the message window`);
  await page.mouse.click(point.x, point.y);
  return point;
};

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"],
});
try {
  const runtimeSource = await (await fetch(new URL("/opening-audio.js", baseUrl))).text();
  assert.match(runtimeSource, /story:\s*"\.\/assets\/audio\/planet-forecast-windowlight\.mp3"/u);
  assert.match(runtimeSource, /ending:\s*"\.\/assets\/audio\/after-school-afterglow\.mp3"/u);
  assert.match(runtimeSource, /trueend:\s*"\.\/assets\/audio\/sensory-horizon\.wav"/u);
  const trueEndStyleSource = await (await fetch(new URL("/true-end.css", baseUrl))).text();
  const trueEndModeSource = await (await fetch(new URL("/true-end-mode.js", baseUrl))).text();
  const trueEndWebGLSource = await (await fetch(new URL("/true-end-webgl.js", baseUrl))).text();
  assert.doesNotMatch(trueEndStyleSource, /true-end-bg-/u, "retired raster background remains in true-end.css");
  assert.doesNotMatch(trueEndStyleSource, /true-end-(?:lou|thoughtform)/u, "retired character-image styling remains in true-end.css");
  assert.doesNotMatch(trueEndModeSource, /true-end-(?:luu-cute|mizuha-thoughtform|amane-thoughtform|sakuya-thoughtform)/u, "retired character-image asset remains in true-end-mode.js");
  assert.doesNotMatch(trueEndStyleSource, /true-end-relic/u, "retired green relic styling remains in true-end.css");
  assert.doesNotMatch(trueEndModeSource, /true-end-relic/u, "retired green relic element remains in true-end-mode.js");
  assert.match(trueEndModeSource, /createElement\("div", "true-end-interface"\)/u, "unified true-end interface layer is missing");
  assert.match(trueEndModeSource, /const SCENE_BLACKOUT_MS = 720/u, "full-black curtain timing is missing");
  assert.match(trueEndModeSource, /const SCENE_TITLE_FADE_MS = 440/u, "section-title fade timing is missing");
  assert.match(trueEndModeSource, /const SCENE_TITLE_HOLD_MS = 1664/u, "section-title hold must be 1.6 times the original 1040ms");
  assert.match(trueEndModeSource, /const SCENE_TITLE_OUT_MS = 360/u, "section-title exit timing is missing");
  assert.match(trueEndModeSource, /const SCENE_REVEAL_MS = 920/u, "section reveal timing is missing");
  assert.match(trueEndModeSource, /await animateSceneOpacity\(sceneCard, 0, 1, SCENE_BLACKOUT_MS\)/u, "section transition does not close to black first");
  assert.match(trueEndModeSource, /setSceneTransitionPhase\("black"\)[\s\S]*prepareScene\?\.\(\)[\s\S]*setSceneTransitionPhase\("title"\)/u, "section metadata is not prepared only after full blackout");
  assert.match(trueEndModeSource, /setSceneTransitionPhase\("switching"\)[\s\S]*Promise\.resolve\(\)\.then\(async \(\) => \{[\s\S]*preparedStep = await switchScene\?\.\(\)[\s\S]*setSceneTransitionPhase\("ready"\)/u, "background preparation is not completed behind the black curtain");
  assert.match(trueEndModeSource, /setSceneTransitionPhase\("reveal"\)[\s\S]*animateSceneOpacity\(sceneCard, 1, 0, SCENE_REVEAL_MS\)/u, "new section does not reveal from full black");
  assert.match(trueEndStyleSource, /\.true-end-scene-card\s*\{[\s\S]*background:\s*#000/u, "section curtain is not pure black");
  assert.doesNotMatch(trueEndModeSource, /animateInterfaceOpacity/u, "interface still fades independently from the black curtain");
  assert.doesNotMatch(trueEndModeSource, /is-scene-changing/u, "retired second scene-fade state remains in true-end-mode.js");
  assert.doesNotMatch(trueEndWebGLSource, /classList\.contains\("is-scene-separating"\)/u, "WebGL still freezes during the scene separator");
  assert.match(trueEndWebGLSource, /if \(sceneCompletionResolve\) settleSceneDraw\(false\)/u, "WebGL scene switching does not report an actual completed draw");
  assert.match(trueEndModeSource, /await syncSceneBackdrop\(\{ immediate: true \}\)[\s\S]*return prepareStep\(\)/u, "section preparation does not wait for the background draw and character presence");
  assert.match(trueEndModeSource, /animateSceneOpacity\(sceneCard, 1, 0, SCENE_REVEAL_MS\)[\s\S]*sectionTransitionCompletedAt[\s\S]*commitPreparedStep\(result\.preparedStep\)/u, "the next message is not committed strictly after the section curtain finishes fading out");
  assert.match(trueEndStyleSource, /\.true-end-shell\.is-scene-separating \.true-end-dialogue\s*\{\s*visibility:\s*hidden;/u, "message UI is not hidden throughout the section separator");
  assert.doesNotMatch(trueEndModeSource, /true-end-readout|renderReadout/u, "retired scan-data panel remains in true-end-mode.js");
  assert.doesNotMatch(trueEndStyleSource, /true-end-readout/u, "retired scan-data panel styling remains in true-end.css");
  assert.match(trueEndModeSource, /FUTURE_SHORE_START_STEP_ID = "beyond_03_032"/u, "future-shore image does not start at the requested narration");
  assert.match(trueEndModeSource, /shell\.dataset\.shoreImage = shoreVisible \? "visible" : "hidden"/u, "future-shore visibility is not synchronized per step");
  assert.match(trueEndStyleSource, /\[data-shore-image="visible"\]::before[\s\S]*opacity:\s*0\.94/u, "future-shore image is not gated behind its narration");
  assert.match(trueEndStyleSource, /\[data-shore-image="visible"\] \.true-end-universe[\s\S]*opacity:\s*0\.84;[\s\S]*mix-blend-mode:\s*screen/u, "character WebGL is not strongly composited over the future shore");
  assert.match(trueEndStyleSource, /\.true-end-shell\.is-finale \.true-end-universe[\s\S]*opacity:\s*0\.96;[\s\S]*mix-blend-mode:\s*normal/u, "finale does not expose the APEIRONCENE WebGL field");
  assert.match(trueEndModeSource, /shell\.dataset\.shoreImage\s*=\s*"hidden";[\s\S]*setScene\?\.\("galaxy"\)[\s\S]*setPresence\?\.\("system", \{ emphasis: true, signal: "beyond-finale" \}\)/u, "finale does not switch from the shore image to the existing APEIRONCENE WebGL field");
  assert.doesNotMatch(trueEndModeSource, /createElement\("img"/u, "TRANSMISSION still creates a raster image element");
  assert.match(trueEndWebGLSource, /setPresence\(name/u, "WebGL presence controller is missing");
  assert.match(trueEndWebGLSource, /u_speaker_mix/u, "WebGL presence crossfade is missing");
  assert.match(trueEndWebGLSource, /const defaultPresenceTransitionDuration = 380/u, "the default presence crossfade duration changed unexpectedly");
  assert.match(trueEndWebGLSource, /const aivaFadeOutDuration = 760/u, "AIVA's longer fade-out duration is missing");
  assert.match(trueEndWebGLSource, /sourcePresence === PRESENCES\.system\.index[\s\S]*\? aivaFadeOutDuration[\s\S]*: defaultPresenceTransitionDuration/u, "AIVA's longer fade-out is not scoped to transitions away from AIVA");
  assert.match(trueEndModeSource, /await \(universeRuntime\?\.setPresence/u, "message rendering does not await the completed presence crossfade");
  assert.match(trueEndWebGLSource, /if \(speaker < -0\.5\) return vec3\(0\.0\)/u, "first presence cannot fade in from transparent");
  assert.match(trueEndWebGLSource, /presenceField\(p, u_speaker_from\)[\s\S]*presenceFadeOut[\s\S]*presenceField\(p, u_speaker_to\)[\s\S]*presenceFadeIn/u, "presence shader does not fade the old character out and the new character in");
  assert.match(trueEndWebGLSource, /signalStateAt\(now\)/u, "per-line presence signal still changes in one frame");
  assert.doesNotMatch(trueEndWebGLSource, /0\.52 \+ 0\.48 \* u_speaker_mix/u, "new character still appears at partial strength on its first frame");
  assert.doesNotMatch(trueEndWebGLSource, /vec2 defragSlot|float cellClock|vec2 previousSlot|vec2 nextSlot|float cellSize/u, "AIVA still gives individual cells drifting positions, tempos, or sizes");
  assert.doesNotMatch(trueEndWebGLSource, /uniform float u_frame|"u_frame"|uniform1f\(uniforms\.u_frame/u, "AIVA still uses the render frame as its flicker clock");
  assert.match(trueEndWebGLSource, /const float AIVA_FIELD_DRIFT_SPEED = 0\.18/u, "AIVA's continuous field tempo is missing");
  assert.match(trueEndWebGLSource, /const float AMBIENT_FLOW_SPEED = 0\.055/u, "the ambient field drift tempo is missing");
  assert.match(trueEndWebGLSource, /const float AMBIENT_BREATH_SPEED = 0\.17/u, "the ambient breathing tempo is missing");
  assert.match(trueEndWebGLSource, /vec2 breathingPoint[\s\S]*vec2 orbitalDrift[\s\S]*vec2 advection[\s\S]*float cloud[\s\S]*float detail/u, "the WebGL background does not combine breathing, drift, and counter-flow");
  assert.match(trueEndWebGLSource, /vec2 starDriftA[\s\S]*vec2 starDriftB[\s\S]*vec2 starDriftC/u, "the three star layers do not have independent parallax drift");
  assert.match(trueEndWebGLSource, /vec3 signalSurge[\s\S]*float signalNoiseA[\s\S]*float signalNoiseB[\s\S]*vec2 signalSpace[\s\S]*float carrierA[\s\S]*float carrierB[\s\S]*float signalVeil[\s\S]*float measureTrace[\s\S]*float responseTrace[\s\S]*float scanWave/u, "AIVA's continuous signal field is incomplete");
  const aivaFieldSource = trueEndWebGLSource.match(/vec3 signalSurge\(vec2 p\) \{[\s\S]*?\n    \}/u)?.[0] || "";
  assert(aivaFieldSource, "AIVA's continuous signal field source is unavailable");
  assert.doesNotMatch(aivaFieldSource, /matrixId|matrixFract|\bblocks\b|gridLines|floor\s*\(|fract\s*\(/u, "AIVA still renders discontinuous rectangular cells");
  assert.match(trueEndModeSource, /createElement\("button", "true-end-skip-button"\)/u, "APEIRONCENE section skip control is missing");
  assert.match(trueEndModeSource, /const moveToNextScene = \(\) => \{[\s\S]*revealSceneAfterSeparator/u, "APEIRONCENE section skip does not reuse the canonical scene transition");
  assert.match(trueEndStyleSource, /\.true-end-skip-button\s*\{[\s\S]*top:\s*max\(18px, env\(safe-area-inset-top\)\);[\s\S]*left:\s*max\(20px, env\(safe-area-inset-left\)\);/u, "APEIRONCENE skip control is not anchored to the upper-left safe area");
  assert.match(trueEndWebGLSource, /vec3 weaveStorm[\s\S]*float warpThreads[\s\S]*float weftThreads[\s\S]*float diagonalThread[\s\S]*float crossings/u, "Lou's living loom is missing");
  assert.match(trueEndWebGLSource, /vec3 tidalSurge[\s\S]*vec2 waterSpace[\s\S]*vec2 sourceA[\s\S]*vec2 sourceB[\s\S]*float arcMaskA[\s\S]*float brokenWaveA[\s\S]*float brokenWaveB[\s\S]*float interferenceVein[\s\S]*float causticFray[\s\S]*float confluence/u, "Mizuha's fragmented tidal field is missing");
  assert.doesNotMatch(trueEndWebGLSource, /distanceFromDrop|float rippleA|float rippleB|float reflectedWater|float drop\s*=/u, "Mizuha still uses the retired concentric-circle field");
  assert.match(trueEndWebGLSource, /vec3 skyCurrent[\s\S]*float skyPressure[\s\S]*float fallingMemory[\s\S]*float descendingVeil[\s\S]*float pressureFront[\s\S]*float downwardPulse/u, "Amane's abstract sky veil is missing");
  assert.match(trueEndWebGLSource, /vec3 memoryBranches[\s\S]*float fiveFoldMemory[\s\S]*float openingWave[\s\S]*float petalResonance[\s\S]*float bloomPulse[\s\S]*float memoryPollen/u, "Sakuya's abstract bloom resonance is missing");
  assert.match(trueEndWebGLSource, /vec3 witnessConvergence[\s\S]*float trunk[\s\S]*float leftChoice[\s\S]*float rightChoice[\s\S]*float secondDecision[\s\S]*float branchingPaths/u, "the visitor's choice paths are missing");
  assert.doesNotMatch(trueEndWebGLSource, /float flowA|float flowB|float flowC/u, "shared thick flow bands still make every character look alike");
  assert.match(trueEndWebGLSource, /float presenceStrength = 1\.34 \+ u_emphasis \* 0\.48/u, "character fields are not using the stronger presence gain");
  assert.doesNotMatch(trueEndWebGLSource, /orbitSeed|ringA|ringB|ringC|satelliteA|satelliteB|float rings|float spiral|vec2 beacon|float orbit|witnessLens|float lens|float iris|float aperture/u, "retired orbit, circle, or vortex geometry remains in the WebGL shader");
  assert.doesNotMatch(trueEndModeSource, /true-end-weave/u, "TRANSMISSION still creates the full-screen ellipse weave");
  assert.doesNotMatch(trueEndStyleSource, /\.true-end-weave|conic-gradient/u, "TRANSMISSION still styles ellipse or vortex decoration");
  assert.match(trueEndWebGLSource, /p \+= u_pointer/u, "the restored field no longer follows pointer parallax");

  for (const viewport of (separatorOnly || skipOnly) ? [] : viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: motionOnly ? "no-preference" : "reduce" });
    await installExternalFixtures(context);
    if (viewport.width <= 720) {
      await context.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 2 });
        Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 2 });
      });
    }
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await bootAtTrueEnd(page, viewport.name);

    const story = await page.evaluate(() => ({
      title: globalThis.GAIA_TRUE_END_STORY.title,
      subtitle: globalThis.GAIA_TRUE_END_STORY.subtitle,
      language: globalThis.GAIA_TRUE_END_STORY.language,
      finale: globalThis.GAIA_TRUE_END_STORY.finale,
      scenes: globalThis.GAIA_TRUE_END_STORY.scenes.map((scene) => ({
        id: scene.id,
        number: scene.number,
        title: scene.title,
        backdrop: scene.backdrop,
        steps: scene.steps.length,
        stepIds: scene.steps.map((step) => step.id),
      })),
      totalSteps: globalThis.GAIA_TRUE_END_STORY.scenes.reduce((sum, scene) => sum + scene.steps.length, 0),
    }));
    assert.equal(story.title, "APEIRONCENE");
    assert.equal(story.subtitle, "惑星の放課後 / GAIA SENSATION — APEIRONCENE");
    assert.equal(story.finale.label, "星々の放課後");
    assert.equal(story.language.name, "SÆLIVA");
    assert.equal(story.language.japaneseName, "セイリヴァ");
    assert.equal(story.language.htmlLang, "art-x-saeliva");
    assert.equal(story.scenes.length, 3, `${viewport.name}: approved true end must have three scenes`);
    assert.deepEqual(story.scenes.map(({ number }) => number), ["01", "02", "03"]);
    assert.equal(story.totalSteps, 133, `${viewport.name}: total step count mismatch`);

    if (motionOnly) {
      const beforeFrame = await scanFrame(page);
      assert.equal(beforeFrame.universeState, "active", `${viewport.name}: WebGL universe is not active`);
      assert.equal(beforeFrame.universeAmbientMotion, "drift-breathe-parallax", `${viewport.name}: ambient motion profile is missing`);
      const beforePixels = await page.locator(".true-end-universe").screenshot({
        path: path.join(outputDir, `${viewport.name}-ambient-motion-before.png`),
      });
      await page.waitForTimeout(4_500);
      const afterPixels = await page.locator(".true-end-universe").screenshot({
        path: path.join(outputDir, `${viewport.name}-ambient-motion-after.png`),
      });
      const afterFrame = await scanFrame(page);
      assert(afterFrame.universeFrame > beforeFrame.universeFrame + 20, `${viewport.name}: ambient WebGL field did not keep rendering`);
      assert.equal(beforePixels.equals(afterPixels), false, `${viewport.name}: ambient WebGL field remained pixel-identical`);
      report.viewports.push({
        viewport: viewport.name,
        ambientMotion: beforeFrame.universeAmbientMotion,
        renderedFrames: afterFrame.universeFrame - beforeFrame.universeFrame,
        durationMs: afterFrame.sampledAt - beforeFrame.sampledAt,
        passed: true,
      });
      await context.close();
      continue;
    }

    if (pageBreakOnly) {
      let frame = await scanFrame(page);
      while (Number.parseInt(frame.counter, 10) < 70) {
        ({ after: frame } = await advanceTransmissionStep(page));
      }
      assert.equal(frame.counter, "070 / 133", `${viewport.name}: page-break check did not stop on the excavation page`);
      assert.equal(frame.message, "新品の像が消え、発掘品だけが残る。記憶領域から機器ID、六十秒間隔、送信先、最初の文が現れた。", `${viewport.name}: excavation page does not end at 現れた。`);
      assert(frame.messageScrollHeight <= frame.messageClientHeight + 1, `${viewport.name}: first excavation page is visually clipped`);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-page-035.png`), animations: "disabled" });

      const { after: nextFrame } = await advanceTransmissionStep(page);
      assert.equal(nextFrame.counter, "071 / 133", `${viewport.name}: one click did not advance exactly one page`);
      assert.equal(nextFrame.message, "DÆM RAI: KAR·EN", `${viewport.name}: the page after excavation is not isolated after the click boundary`);
      assert.equal(nextFrame.dialogueVisible, true, `${viewport.name}: second excavation page is not visible`);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-page-036.png`), animations: "disabled" });
      report.viewports.push({
        viewport: viewport.name,
        firstPage: { counter: frame.counter, message: frame.message, lines: frame.messageLineCount },
        secondPage: { counter: nextFrame.counter, message: nextFrame.message, lines: nextFrame.messageLineCount },
        passed: true,
      });
      await context.close();
      continue;
    }

    let initial = await scanFrame(page);
    if (!initial.audioPlayback?.duration) {
      await page.waitForFunction(() => (globalThis.GaiaOpeningAudio?.getPlaybackState?.().duration || 0) > 0, null, { timeout: 30_000 });
      initial = await scanFrame(page);
    }
    report.lastFrame = { viewport: viewport.name, ...initial };
    const seenSpeakers = new Set();
    const seenManifestations = new Map();
    const seenSystemPhrases = new Set();
    const capturedSpeakers = new Set();
    const messageLayoutViolations = [];
    const targetMessagePages = [];
    const maximumAllowedMessageLines = viewport.width <= 720 ? 4 : 3;
    let maximumMessageLines = 0;
    const fixedDialogueHeight = initial.dialogueRect.height;
    const manifestations = {
      narrator: "central-breath",
      system: "signal-matrix",
      lou: "living-loom",
      mizuha: "water-ripples",
      amane: "sky-veil",
      sakuya: "bloom-resonance",
      visitor: "choice-paths",
    };
    const validateSpeakerVisual = (frame) => {
      seenSpeakers.add(frame.speaker);
      seenManifestations.set(frame.speaker, frame.universeManifestation);
      const expectedScene = story.scenes.find(({ id }) => id === frame.scene);
      assert(expectedScene, `${viewport.name}: unknown true-end scene ${frame.scene}`);
      assert.equal(frame.universeState, "active", `${viewport.name}: WebGL universe is not active`);
      assert.equal(frame.universeAmbientMotion, "drift-breathe-parallax", `${viewport.name}: ambient WebGL motion profile is missing`);
      assert.equal(frame.universeScene, expectedScene.backdrop, `${viewport.name}: WebGL palette is out of sync`);
      assert(frame.universeFrame > 0, `${viewport.name}: WebGL universe did not render a frame`);
      assert(frame.universeSize.width > 0 && frame.universeSize.height > 0, `${viewport.name}: WebGL canvas has no drawable area`);
      assert.equal(frame.universeSpeaker, frame.speaker, `${viewport.name}: WebGL presence is out of sync with ${frame.speaker}`);
      assert.equal(frame.universeManifestation, manifestations[frame.speaker], `${viewport.name}: ${frame.speaker} has the wrong WebGL manifestation`);
      assert(Number.isFinite(frame.universeSignal) && frame.universeSignal >= 0 && frame.universeSignal <= 1, `${viewport.name}: WebGL signal seed is invalid`);
      assert.equal(frame.characterImageCount, 0, `${viewport.name}: raster character image DOM remains in TRANSMISSION`);
      assert.equal(frame.backdropCount, 0, `${viewport.name}: retired raster backdrop DOM remains`);
      assert.equal(frame.readoutPanelCount, 0, `${viewport.name}: retired scan-data panel remains at ${frame.stepId}`);
      if (viewport.width <= 720) {
        assert.equal(frame.brandDisplay, "none", `${viewport.name}: redundant APEIRONCENE brand remains in the mobile header`);
        assert.equal(frame.sceneTitleLineCount, 1, `${viewport.name}: section title wrapped in the mobile header (${frame.title})`);
        assert(frame.sceneTitleRect && frame.sceneTitleRect.left >= 0 && frame.sceneTitleRect.right <= viewport.width + 1, `${viewport.name}: section title escaped the mobile viewport (${frame.title})`);
      }
      if (frame.scene === "after-school-stars") {
        const shoreShouldBeVisible = Number.parseInt(frame.stepId.slice(-3), 10) >= 32;
        assert.match(frame.sceneVisualBackground, /true-end-future-cosmic-shore-v1\.png/u, `${viewport.name}: generated future shore is not connected to scene 09`);
        assert.equal(frame.shoreImage, shoreShouldBeVisible ? "visible" : "hidden", `${viewport.name}: shore visibility state is wrong at ${frame.stepId}`);
        if (shoreShouldBeVisible) {
          assert(frame.sceneVisualOpacity >= 0.9, `${viewport.name}: future shore is not visible from beyond_03_032 onward`);
          assert(frame.universeOpacity >= 0.8, `${viewport.name}: character WebGL became too faint over the future shore`);
          assert.equal(frame.universeBlendMode, "screen", `${viewport.name}: character WebGL is not composited over the future shore`);
          assert(frame.universeZIndex > frame.sceneVisualZIndex, `${viewport.name}: future shore still covers the character WebGL layer`);
        } else {
          assert(frame.sceneVisualOpacity <= 0.01, `${viewport.name}: future shore appeared before beyond_03_032`);
          assert(frame.universeOpacity >= 0.99, `${viewport.name}: WebGL was dimmed before the future-shore narration`);
          assert.equal(frame.universeBlendMode, "normal", `${viewport.name}: pre-shore WebGL inherited the image blend mode`);
        }
      }
      assert(frame.dialogueRect && frame.dialogueRect.y >= 0 && frame.dialogueRect.bottom <= viewport.height + 1, `${viewport.name}: dialogue escaped the viewport`);
      assert(Math.abs(frame.dialogueRect.height - fixedDialogueHeight) <= 0.5, `${viewport.name}: dialogue height changed at ${frame.counter} (${fixedDialogueHeight} -> ${frame.dialogueRect.height})`);
      maximumMessageLines = Math.max(maximumMessageLines, frame.messageLineCount);
      if (frame.messageLineCount < 1 || frame.messageLineCount > maximumAllowedMessageLines || frame.messageScrollHeight > frame.messageClientHeight + 1) {
        messageLayoutViolations.push(`${frame.counter}: ${frame.messageLineCount} lines, ${frame.messageScrollHeight}/${frame.messageClientHeight}px — ${frame.message}`);
      }
      if (frame.stepId === "beyond_01_021" && targetMessagePages.at(-1) !== frame.message) {
        targetMessagePages.push(frame.message);
      }
      if (frame.speaker === "system") {
        seenSystemPhrases.add(frame.message);
        assert.equal(frame.messageLang, "art-x-saeliva", `${viewport.name}: SÆLIVA message language metadata is missing`);
        assert.equal(frame.speakerCodeLang, "art-x-saeliva", `${viewport.name}: SÆLIVA speaker-code language metadata is missing`);
      }
      if (["beyond_01_004", "beyond_01_006"].includes(frame.stepId)) {
        assert.equal(frame.speaker, "lou", `${viewport.name}: concealed Lou line lost its internal speaker at ${frame.stepId}`);
        assert.equal(frame.speakerName, "???", `${viewport.name}: Lou's name was revealed before his introduction at ${frame.stepId}`);
      }
      if (frame.stepId === "beyond_01_008") {
        assert.equal(frame.speaker, "lou", `${viewport.name}: post-introduction Lou line lost its internal speaker`);
        assert.equal(frame.speakerName, "ルウ", `${viewport.name}: Lou's name was not revealed after his introduction`);
      }
    };
    validateSpeakerVisual(initial);
    assert.equal(initial.universeQuality, viewport.width <= 720 ? "low" : "normal", `${viewport.name}: adaptive WebGL quality tier is wrong`);
    assert.equal(initial.universeQualityReason, viewport.width <= 720 ? "device-capability" : "default", `${viewport.name}: adaptive WebGL quality reason is wrong`);
    assert.equal(initial.scene, story.scenes[0].id);
    assert.equal(initial.title, story.scenes[0].title);
    assert.equal(initial.sceneCode, "VENA 01");
    assert.equal(initial.message, OPENING_MESSAGE);
    assert.equal(initial.speakerName, "AIVA");
    assert.equal(initial.speakerCode, "KAR·MIR");
    assert.equal(initial.readoutPanelCount, 0, `${viewport.name}: scan-data panel remains on the opening message`);
    assert.equal(initial.audioTrack, "trueend");
    assert.equal(initial.titleUnlocked, true, `${viewport.name}: canonical APEIRONCENE entry did not unlock the title`);
    assert.equal(initial.reachedMarkerStored, true, `${viewport.name}: canonical APEIRONCENE entry did not persist its reached marker`);
    assert.equal(initial.audioPlayback.duration, 72, `${viewport.name}: dedicated score has the wrong duration`);
    assert.equal(initial.toolbarHidden, true);
    assert.equal(initial.dialogueVisible, true);
    assert.equal(initial.shellUserSelect, "none", `${viewport.name}: TRANSMISSION text remains selectable`);
    assert.equal(initial.logButtonVisible, true);
    assert.equal(initial.logButtonText, "LOG");
    assert.equal(initial.skipVisible, true, `${viewport.name}: section skip is not visible`);
    assert.equal(initial.skipText.replace(/\s+/gu, ""), "スキップ▶", `${viewport.name}: section skip label is wrong`);
    assert.match(initial.skipLabel, /現在のセクションをスキップして/u, `${viewport.name}: section skip has no accessible description`);
    assert(initial.skipRect && initial.skipRect.height >= 44, `${viewport.name}: section skip hit area is under 44px`);
    assert(initial.skipRect && initial.skipRect.left >= 0 && initial.skipRect.top >= 0, `${viewport.name}: section skip escaped the viewport`);
    assert(initial.skipRect && initial.skipRect.right <= viewport.width + 1, `${viewport.name}: section skip is clipped on the right`);
    if (viewport.width <= 720) {
      assert(Math.abs(initial.skipRect.width - 46) <= 0.5 && Math.abs(initial.skipRect.height - 46) <= 0.5, `${viewport.name}: section skip does not match the mobile volume control size`);
    }
    assert.equal(initial.footerSpanCount, 1);
    assert.doesNotMatch(initial.footerText, /ANTHROPOCENE/u);
    assert.equal(initial.overflowX, 0);
    assert.equal(initial.overflowY, 0);
    assert(initial.dialogueRect.height >= 44, `${viewport.name}: dialogue hit area is under 44px`);
    assert(initial.dialogueRect.x >= 0 && initial.dialogueRect.bottom <= viewport.height + 1, `${viewport.name}: dialogue is outside viewport`);
    assert(initial.mainDialogueRect, `${viewport.name}: main-story dialogue reference is unavailable`);
    assert(Math.abs(initial.dialogueRect.width - initial.mainDialogueRect.width) <= 1, `${viewport.name}: TRANSMISSION width does not match the main story (${initial.dialogueRect.width} / ${initial.mainDialogueRect.width})`);
    if (viewport.width <= 720) {
      assert.equal(initial.temporalHeadingVisible, false, `${viewport.name}: main-story date heading remains visible in APEIRONCENE`);
      assert(initial.dialogueRect.height <= 234.5, `${viewport.name}: APEIRONCENE dialogue did not shrink by one mobile text line (${initial.dialogueRect.height}px)`);
      assert(initial.dialogueRect.height >= initial.mainDialogueRect.height, `${viewport.name}: expanded TRANSMISSION dialogue is shorter than the main story (${initial.dialogueRect.height} / ${initial.mainDialogueRect.height})`);
    } else {
      assert(Math.abs(initial.dialogueRect.height - initial.mainDialogueRect.height) <= 1, `${viewport.name}: TRANSMISSION height does not match the main story (${initial.dialogueRect.height} / ${initial.mainDialogueRect.height})`);
    }

    const controlHoldBefore = await scanFrame(page);
    await page.locator(".true-end-shell").focus();
    await page.keyboard.down("Control");
    await page.waitForTimeout(900);
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Control",
      code: "ControlLeft",
      ctrlKey: true,
      repeat: true,
      bubbles: true,
      cancelable: true,
    })));
    await page.waitForTimeout(250);
    const controlHoldAfter = await scanFrame(page);
    await page.keyboard.up("Control");
    assert.equal(controlHoldAfter.stepId, controlHoldBefore.stepId, `${viewport.name}: Control hold advanced the APEIRONCENE step`);
    assert.equal(controlHoldAfter.counter, controlHoldBefore.counter, `${viewport.name}: Control hold changed the APEIRONCENE counter`);
    assert.equal(controlHoldAfter.message, controlHoldBefore.message, `${viewport.name}: Control hold changed the APEIRONCENE message`);
    assert.equal(controlHoldAfter.novelStoryStepId, controlHoldBefore.novelStoryStepId, `${viewport.name}: Control hold advanced the hidden main-story runtime`);
    assert.equal(controlHoldAfter.novelLayerOpen, true, `${viewport.name}: Control hold returned APEIRONCENE to the top screen`);
    assert.equal(controlHoldAfter.novelLayerTrueEnd, true, `${viewport.name}: Control hold removed the APEIRONCENE surface`);
    assert.equal(controlHoldAfter.novelLayerFastForwarding, false, `${viewport.name}: Control hold activated hidden main-story fast-forward`);

    if (controlHoldOnly) {
      report.viewports.push({
        viewport: viewport.name,
        controlHold: {
          stepId: controlHoldAfter.stepId,
          counter: controlHoldAfter.counter,
          novelStoryStepId: controlHoldAfter.novelStoryStepId,
        },
        passed: true,
      });
      await context.close();
      continue;
    }

    assert.equal(initial.dialogueBorderWidth, 0, `${viewport.name}: TRANSMISSION retained its separate framed box`);
    assert.equal(initial.dialogueBackground, "none", `${viewport.name}: TRANSMISSION retained its separate panel background`);
    assert.match(initial.dialogueGlowBackground, /linear-gradient/u, `${viewport.name}: main-story lower glass fade is missing`);
    assert(Math.abs(initial.messageTopOffset) <= 1, `${viewport.name}: initial message is not top-aligned (${initial.messageTopOffset}; ${JSON.stringify(initial.messageLayoutDebug)})`);
    assert(initial.messageFontSize >= (viewport.width <= 500 ? 16 : 20), `${viewport.name}: dialogue text is too small`);
    const selectionBeforeDrag = await page.locator(".true-end-footer span:last-child").textContent();
    const messageBox = await page.locator(".true-end-message").boundingBox();
    assert(messageBox && messageBox.width > 40 && messageBox.height > 10, `${viewport.name}: message has no draggable area`);
    await page.mouse.move(messageBox.x + 8, messageBox.y + Math.min(12, messageBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(messageBox.x + messageBox.width - 8, messageBox.y + Math.min(messageBox.height - 4, 30), { steps: 12 });
    await page.mouse.up();
    const dragSelection = await page.evaluate(() => window.getSelection()?.toString() || "");
    assert.equal(dragSelection, "", `${viewport.name}: dragging selected TRANSMISSION text`);
    assert.equal(await page.locator(".true-end-footer span:last-child").textContent(), selectionBeforeDrag, `${viewport.name}: drag advanced the message`);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction((initialFrame) => (
      Number(document.querySelector(".true-end-universe")?.dataset.webglFrame || 0) > initialFrame
    ), initial.universeFrame, { timeout: 5_000 });
    const animatedFrame = await scanFrame(page);
    assert(animatedFrame.universeFrame > initial.universeFrame, `${viewport.name}: WebGL universe is not animating`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".true-end-log-button").click();
    await page.locator("#novel-log-panel").waitFor({ state: "visible" });
    const initialBeyondLog = await page.evaluate(() => ({
      ids: globalThis.GaiaNovel.getState().readStepIds.filter((id) => id.startsWith("beyond_")),
      entries: [...document.querySelectorAll('#novel-log-content article[data-step-id^="beyond_"]')]
        .map((entry) => ({ id: entry.dataset.stepId, text: entry.querySelector(".novel-log-entry-text")?.textContent || "" })),
    }));
    assert.deepEqual(initialBeyondLog.ids, ["beyond_01_001"], `${viewport.name}: first TRANSMISSION line was not persisted`);
    assert.equal(initialBeyondLog.entries.length, 1, `${viewport.name}: first TRANSMISSION line is absent from LOG`);
    assert.equal(initialBeyondLog.entries[0].text, OPENING_MESSAGE);
    await page.locator("#novel-log-close").click();
    await page.locator("#novel-log-panel").waitFor({ state: "hidden" });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-scene-01.png`), animations: "disabled" });
    capturedSpeakers.add(initial.speaker);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-speaker-${initial.speaker}.png`), animations: "disabled" });

    const visited = [{ scene: initial.scene, title: initial.title }];
    let absoluteStep = 1;
    let outsideAdvance = null;
    for (let sceneIndex = 0; sceneIndex < story.scenes.length; sceneIndex += 1) {
      const currentScene = story.scenes[sceneIndex];
      for (let index = 0; index < currentScene.steps; index += 1) {
        const isFinalStep = absoluteStep === story.totalSteps;
        if (isFinalStep) {
          let finalFrame = await scanFrame(page);
          while (true) {
            const [currentPage, pageCount] = finalFrame.messagePage.split("/").map(Number);
            if (!Number.isFinite(currentPage) || !Number.isFinite(pageCount) || currentPage >= pageCount) break;
            await page.waitForFunction(() => !document.querySelector(".true-end-shell")?.classList.contains("is-revealing"));
            const previousPage = finalFrame.messagePage;
            await page.locator(".true-end-dialogue").click();
            await page.waitForFunction((pageMarker) => document.querySelector(".true-end-shell")?.dataset.messagePage !== pageMarker, previousPage);
            finalFrame = await scanFrame(page);
            validateSpeakerVisual(finalFrame);
          }
          outsideAdvance = await clickOutsideDialogue(page, `${viewport.name}: final message`);
          await page.waitForFunction(() => Boolean(document.querySelector(".true-end-finale:not([hidden])")));
          break;
        }
        let beforeAdvance = await scanFrame(page);
        await page.locator(".true-end-dialogue").click();
        absoluteStep += 1;
        let nextFrame;
        while (!nextFrame) {
          await page.waitForFunction(({ expected, previousCounter, previousPage }) => {
            const currentShell = document.querySelector(".true-end-shell");
            const currentCounter = document.querySelector(".true-end-footer span:last-child")?.textContent?.trim() || "";
            return currentCounter.startsWith(String(expected).padStart(3, "0"))
              || (currentCounter === previousCounter && currentShell?.dataset.messagePage !== previousPage);
          }, {
            expected: absoluteStep,
            previousCounter: beforeAdvance.counter,
            previousPage: beforeAdvance.messagePage,
          });
          const candidate = await scanFrame(page);
          if (candidate.counter.startsWith(String(absoluteStep).padStart(3, "0"))) {
            nextFrame = candidate;
            break;
          }
          assert.equal(candidate.counter, beforeAdvance.counter, `${viewport.name}: a message page changed the story counter`);
          assert.equal(candidate.stepId, beforeAdvance.stepId, `${viewport.name}: a message page changed the story step`);
          validateSpeakerVisual(candidate);
          beforeAdvance = candidate;
          await page.locator(".true-end-dialogue").click();
        }
        validateSpeakerVisual(nextFrame);
        assert(Math.abs(nextFrame.messageTopOffset) <= 1, `${viewport.name}: message moved from the top at ${nextFrame.counter} (${nextFrame.messageTopOffset})`);
        if (absoluteStep === 70) {
          assert.equal(nextFrame.message, "レプリカの光が溶け、発掘された本物の基板だけが残る。", `${viewport.name}: excavation opening page is not the authored revision`);
        }
        if (absoluteStep === 71) {
          assert.equal(nextFrame.message, "DÆM RAI: KAR·EN", `${viewport.name}: the page after excavation is not isolated after the click boundary`);
        }
        if (!capturedSpeakers.has(nextFrame.speaker)) {
          capturedSpeakers.add(nextFrame.speaker);
          await page.waitForTimeout(80);
          await page.screenshot({
            path: path.join(outputDir, `${viewport.name}-speaker-${nextFrame.speaker}.png`),
            animations: "disabled",
          });
        }
        if (nextFrame.scene !== visited.at(-1).scene) {
          visited.push({ scene: nextFrame.scene, title: nextFrame.title });
          if (nextFrame.scene === "electronic-civilization") {
            await page.screenshot({ path: path.join(outputDir, `${viewport.name}-scene-04.png`), animations: "disabled" });
          }
          if (nextFrame.scene === "after-school-stars") {
            await page.screenshot({ path: path.join(outputDir, `${viewport.name}-scene-09-webgl-only.png`), animations: "disabled" });
          }
        }
        if (nextFrame.stepId === "beyond_03_032") {
          await page.screenshot({ path: path.join(outputDir, `${viewport.name}-scene-09-shore-start.png`), animations: "disabled" });
        }
        if (nextFrame.stepId === "beyond_03_041") {
          await page.screenshot({ path: path.join(outputDir, `${viewport.name}-scene-09-shore-with-lou.png`), animations: "disabled" });
        }
      }
    }

    assert.deepEqual(messageLayoutViolations, [], `${viewport.name}: messages exceeded the ${maximumAllowedMessageLines}-line dialogue design:\n${messageLayoutViolations.join("\n")}`);
    assert.deepEqual(targetMessagePages, [
      "この世界ではね、言葉っていうフィルターを通さずに、相手の存在や意図をありのまま受け止めるんだ。\n",
      "猫同士が微かな匂いや気配だけで互いのすべてを通じ合わせるように、人類が忘れ去っていた原初の感覚が息を吹き返したんだよ。\n",
      "自分と他者を隔てる壁が消え去ったとき、その通じ合いは静かな波紋のように広がって……",
      "やがて全宇宙のあらゆる存在と、意識を分かち合えるようになっていったんだ。",
    ], `${viewport.name}: beyond_01_021 did not preserve all four authored pages`);
    assert.deepEqual(visited, story.scenes.map(({ id, title }) => ({ scene: id, title })), `${viewport.name}: scene order changed`);
    for (const speaker of ["narrator", "system", "lou", "mizuha", "amane", "sakuya", "visitor"]) {
      assert(seenSpeakers.has(speaker), `${viewport.name}: ${speaker} was never rendered`);
      assert.equal(seenManifestations.get(speaker), manifestations[speaker], `${viewport.name}: ${speaker} WebGL manifestation was never rendered`);
      assert(capturedSpeakers.has(speaker), `${viewport.name}: ${speaker} visual was not captured`);
    }
    for (const phrase of [OPENING_MESSAGE, "KAR DÆM MIR·EN"]) {
      assert(seenSystemPhrases.has(phrase), `${viewport.name}: SÆLIVA system phrase was never rendered: ${phrase}`);
    }
    const rasterBackgroundResources = await page.evaluate(() => performance
      .getEntriesByType("resource")
      .map(({ name }) => name)
      .filter((url) => url.includes("true-end-bg-")));
    assert.deepEqual(rasterBackgroundResources, [], `${viewport.name}: retired raster background was requested`);
    const generatedShoreResources = await page.evaluate(() => performance
      .getEntriesByType("resource")
      .map(({ name }) => name)
      .filter((url) => url.includes("true-end-future-cosmic-shore-v1.png")));
    assert(generatedShoreResources.length >= 1, `${viewport.name}: generated future shore image was not requested`);
    const rasterCharacterResources = await page.evaluate(() => performance
      .getEntriesByType("resource")
      .map(({ name }) => name)
      .filter((url) => /true-end-(?:luu-cute|mizuha-thoughtform|amane-thoughtform|sakuya-thoughtform)/u.test(url)));
    assert.deepEqual(rasterCharacterResources, [], `${viewport.name}: retired raster character was requested`);
    const finale = await page.evaluate(() => {
      const finaleTitle = document.querySelector(".true-end-finale h2");
      const finaleTitleRect = finaleTitle?.getBoundingClientRect();
      return {
        label: document.querySelector(".true-end-finale > span")?.textContent?.trim() || "",
        labelFontFamily: getComputedStyle(document.querySelector(".true-end-finale > span")).fontFamily,
        title: finaleTitle?.textContent?.trim() || "",
        titleRect: finaleTitleRect ? finaleTitleRect.toJSON() : null,
        titleWhiteSpace: finaleTitle ? getComputedStyle(finaleTitle).whiteSpace : "",
        text: document.querySelector(".true-end-finale")?.innerText || "",
        button: document.querySelector(".true-end-finale button")?.textContent?.trim() || "",
        completed: Boolean(localStorage.getItem("gaiaSensewareTrueEnd:complete:v1")),
        stateCompleted: globalThis.GaiaNovel?.getState?.().trueEndComplete === true,
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
        logButtonVisible: Boolean(document.querySelector(".true-end-log-button")?.getClientRects().length),
        readoutLang: document.querySelector(".true-end-finale div")?.lang || "",
        shoreImage: document.querySelector(".true-end-shell")?.dataset.shoreImage || "",
        webglScene: document.querySelector(".true-end-universe")?.dataset.webglScene || "",
        webglSpeaker: document.querySelector(".true-end-universe")?.dataset.webglSpeaker || "",
        webglManifestation: document.querySelector(".true-end-universe")?.dataset.webglManifestation || "",
        webglOpacity: Number.parseFloat(getComputedStyle(document.querySelector(".true-end-universe")).opacity || "0"),
      };
    });
    assert.equal(finale.label, "星々の放課後");
    assert.match(finale.labelFontFamily, /Mincho|明朝|Noto Serif/u, `${viewport.name}: finale Japanese label must use Mincho`);
    assert.doesNotMatch(finale.labelFontFamily, /monospace|sans-serif/u);
    assert.equal(finale.title, "APEIRONCENE");
    assert(finale.titleRect && finale.titleRect.left >= -0.5, `${viewport.name}: finale title is clipped on the left (${JSON.stringify(finale.titleRect)})`);
    assert(finale.titleRect && finale.titleRect.right <= viewport.width + 0.5, `${viewport.name}: finale title is clipped on the right (${JSON.stringify(finale.titleRect)})`);
    if (viewport.width <= 720) assert.equal(finale.titleWhiteSpace, "nowrap", `${viewport.name}: finale title no longer stays on one line`);
    assert(finale.text.includes("DÆM UL: ESHA·GEMA"));
    assert(finale.text.includes("IVARA KERA: K 2.700"));
    assert(finale.text.includes("SÆL·ORAI: 2,641,903 NETH"));
    assert(finale.text.includes("ESHA SÆL·TIR: KAR·EN"));
    assert(finale.text.includes("NÆI MIR: REA·AI"));
    assert.equal(finale.readoutLang, "art-x-saeliva");
    assert(finale.text.includes("世界は、まだひらかれている。"));
    assert.equal(finale.text.includes("感じ取れる世界は、まだ増えていく。"), false);
    assert.equal(finale.button, "世界とつながる");
    assert.equal(finale.shoreImage, "hidden");
    assert.equal(finale.webglScene, "galaxy");
    assert.equal(finale.webglSpeaker, "system");
    assert.equal(finale.webglManifestation, "signal-matrix");
    assert(finale.webglOpacity >= 0.95, `${viewport.name}: finale APEIRONCENE WebGL is too faint`);
    assert.equal(finale.completed, true);
    assert.equal(finale.stateCompleted, true);
    assert.equal(finale.overflowX, 0);
    assert.equal(finale.overflowY, 0);
    assert.equal(finale.logButtonVisible, true, `${viewport.name}: LOG is unavailable from the TRANSMISSION finale`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-finale.png`), animations: "disabled" });

    await page.locator(".true-end-log-button").click();
    await page.locator("#novel-log-panel").waitFor({ state: "visible" });
    const beyondLog = await page.evaluate(() => ({
      stateIds: globalThis.GaiaNovel.getState().readStepIds.filter((id) => id.startsWith("beyond_")),
      storedIds: (JSON.parse(localStorage.getItem("gaiaSensewareNovel:progress") || "{}").readStepIds || [])
        .filter((id) => id.startsWith("beyond_")),
      entries: [...document.querySelectorAll('#novel-log-content article[data-step-id^="beyond_"]')]
        .map((entry) => ({
          id: entry.dataset.stepId,
          meta: entry.querySelector(".novel-log-entry-meta")?.textContent || "",
          text: entry.querySelector(".novel-log-entry-text")?.textContent || "",
        })),
    }));
    const expectedBeyondIds = story.scenes.flatMap((scene) => scene.stepIds);
    assert.deepEqual(beyondLog.stateIds, expectedBeyondIds, `${viewport.name}: TRANSMISSION state LOG order/count mismatch`);
    assert.deepEqual(beyondLog.storedIds, expectedBeyondIds, `${viewport.name}: TRANSMISSION persisted LOG order/count mismatch`);
    assert.equal(beyondLog.entries.length, 133, `${viewport.name}: TRANSMISSION LOG does not contain all 133 lines`);
    assert.deepEqual(beyondLog.entries.map(({ id }) => id), expectedBeyondIds, `${viewport.name}: TRANSMISSION rendered LOG order mismatch`);
    assert.match(beyondLog.entries[0].meta, /APEIRONCENE/u);
    assert.equal(beyondLog.entries[0].text, OPENING_MESSAGE);
    assert.match(beyondLog.entries.find(({ id }) => id === "beyond_01_004")?.meta || "", /^\?\?\? \/ 遠未来観測 \/ APEIRONCENE \/ /u, `${viewport.name}: first Lou LOG entry revealed his name`);
    assert.match(beyondLog.entries.find(({ id }) => id === "beyond_01_006")?.meta || "", /^\?\?\? \/ 遠未来観測 \/ APEIRONCENE \/ /u, `${viewport.name}: self-introduction LOG entry revealed Lou's name early`);
    assert.match(beyondLog.entries.find(({ id }) => id === "beyond_01_008")?.meta || "", /^ルウ \/ 遠未来観測 \/ APEIRONCENE \/ /u, `${viewport.name}: post-introduction LOG entry did not reveal Lou's name`);
    assert.equal(beyondLog.entries.find(({ id }) => id === "beyond_02_038")?.text, "レプリカの光が溶け、発掘された本物の基板だけが残る。不揮発メモリの深部から、デバイスUUID、サンプリングレート60秒、宛先IP、そして最初のコミットログが浮かび上がった。", `${viewport.name}: excavation page is wrong in the persisted LOG`);
    assert.equal(beyondLog.entries.find(({ id }) => id === "beyond_02_039")?.text, "DÆM RAI: KAR·EN", `${viewport.name}: post-excavation page is wrong in the persisted LOG`);
    assert.doesNotMatch(beyondLog.entries.map(({ text }) => text).join("\n"), /子どもの玩具以下|性能は玩具以下/u, `${viewport.name}: retired toy-scale comparison remains`);
    assert.equal(beyondLog.entries.at(-1).text, FINAL_MESSAGE);
    await page.locator("#novel-log-close").click();
    await page.locator("#novel-log-panel").waitFor({ state: "hidden" });

    await page.locator(".true-end-finale button").click();
    await page.waitForFunction(() => !document.querySelector(".true-end-shell")
      && !document.body.classList.contains("novel-open")
      && document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "true"
      && !document.querySelector("#intro-layer")?.hidden
      && document.querySelector("#intro-layer")?.getAttribute("aria-hidden") === "false");
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "senseware", null, { timeout: 10_000 });

    await page.evaluate(() => localStorage.removeItem("gaiaSensewareNovel:manual-saves"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    await page.evaluate(() => globalThis.GaiaNovel.open());
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().readStepIds
      .filter((id) => id.startsWith("beyond_")).length === 133);
    const restoredBeyondIds = await page.evaluate(() => globalThis.GaiaNovel.getState().readStepIds
      .filter((id) => id.startsWith("beyond_")));
    assert.deepEqual(restoredBeyondIds, expectedBeyondIds, `${viewport.name}: TRANSMISSION LOG did not survive reload`);

    report.viewports.push({
      viewport: viewport.name,
      story,
      initial,
      animatedFrame: animatedFrame.universeFrame,
      outsideAdvance,
      rasterBackgroundResources,
      rasterCharacterResources,
      manifestations: Object.fromEntries(seenManifestations),
      visited,
      maximumMessageLines,
      fixedDialogueHeight,
      dragSelection,
      finale,
      beyondLog: { count: beyondLog.entries.length, first: beyondLog.entries[0].id, last: beyondLog.entries.at(-1).id },
      restoredBeyondLogCount: restoredBeyondIds.length,
      passed: true,
    });
    await context.close();
  }

  for (const viewport of (pageBreakOnly || controlHoldOnly || separatorOnly || motionOnly || contentOnly) ? [] : viewports) {
    const skipContext = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      deviceScaleFactor: viewport.width <= 720 ? 3 : 1,
    });
    await installExternalFixtures(skipContext);
    if (viewport.width <= 720) {
      await skipContext.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 2 });
        Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 2 });
      });
    }
    const skipPage = await skipContext.newPage();
    attachDiagnostics(skipPage, `${viewport.name}-skip-flow`);
    await bootAtTrueEnd(skipPage, `${viewport.name}-skip-flow`);
    const beforeSkip = await scanFrame(skipPage);
    const expected = await skipPage.evaluate(() => ({
      scene: globalThis.GAIA_TRUE_END_STORY.scenes[1].id,
      title: globalThis.GAIA_TRUE_END_STORY.scenes[1].title,
      stepId: globalThis.GAIA_TRUE_END_STORY.scenes[1].steps[0].id,
      counter: `${String(globalThis.GAIA_TRUE_END_STORY.scenes[0].steps.length + 1).padStart(3, "0")} / ${String(globalThis.GAIA_TRUE_END_STORY.scenes.reduce((sum, scene) => sum + scene.steps.length, 0)).padStart(3, "0")}`,
    }));
    await skipPage.screenshot({ path: path.join(outputDir, `${viewport.name}-aiva-continuous-field.png`), animations: "disabled" });
    await skipPage.locator(".true-end-skip-button").click();
    await skipPage.waitForFunction((sceneId) => {
      const shell = document.querySelector(".true-end-shell");
      return shell?.dataset.scene === sceneId
        && shell.dataset.sectionTransitionPhase === "idle"
        && !shell.classList.contains("is-scene-separating");
    }, expected.scene, { timeout: 8_000 });
    const afterSkip = await scanFrame(skipPage);
    assert.equal(afterSkip.scene, expected.scene, `${viewport.name}: section skip did not reach the next scene`);
    assert.equal(afterSkip.title, expected.title, `${viewport.name}: section skip did not update the scene title`);
    assert.equal(afterSkip.stepId, expected.stepId, `${viewport.name}: section skip did not start at the next scene's first step`);
    assert.equal(afterSkip.counter, expected.counter, `${viewport.name}: section skip counter is wrong`);
    assert.equal(afterSkip.finaleVisible, false, `${viewport.name}: section skip jumped past the next scene`);
    assert.equal(afterSkip.skipVisible, true, `${viewport.name}: section skip disappeared after one use`);
    assert.match(afterSkip.skipLabel, /現在のセクションをスキップして/u, `${viewport.name}: section skip description was not refreshed`);
    assert(beforeSkip.skipRect && afterSkip.skipRect, `${viewport.name}: section skip has no measurable layout`);
    if (viewport.width <= 720) {
      assert(beforeSkip.skipRect.left <= 16, `${viewport.name}: section skip is not at the requested left edge`);
      assert(beforeSkip.skipRect.right + 8 <= beforeSkip.sceneTitleRect.left, `${viewport.name}: section skip overlaps the scene title`);
    } else {
      assert(beforeSkip.skipRect.right + 16 <= beforeSkip.brandRect.left, `${viewport.name}: section skip overlaps the APEIRONCENE brand`);
    }
    await skipPage.screenshot({ path: path.join(outputDir, `${viewport.name}-section-skip-after.png`), animations: "disabled" });
    report.skipControls.push({
      viewport: viewport.name,
      before: { scene: beforeSkip.scene, stepId: beforeSkip.stepId, rect: beforeSkip.skipRect },
      after: { scene: afterSkip.scene, stepId: afterSkip.stepId, counter: afterSkip.counter },
      passed: true,
    });
    await skipContext.close();
  }

  report.separatorOrder = [];
  for (const viewport of (pageBreakOnly || controlHoldOnly || skipOnly || motionOnly || contentOnly) ? [] : viewports) {
    const separatorContext = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    await installExternalFixtures(separatorContext);
    const separatorPage = await separatorContext.newPage();
    attachDiagnostics(separatorPage, `${viewport.name}-separator-flow`);
    await bootAtTrueEnd(separatorPage, `${viewport.name}-separator-flow`);
    const aivaFieldStart = await scanFrame(separatorPage);
    assert.equal(aivaFieldStart.speaker, "system", `${viewport.name}: AIVA is unavailable for the field-motion check`);
    assert.equal(aivaFieldStart.universeManifestation, "signal-matrix", `${viewport.name}: AIVA's signal field is unavailable for the field-motion check`);
    await separatorPage.screenshot({ path: path.join(outputDir, `${viewport.name}-aiva-field-01.png`) });
    await separatorPage.waitForTimeout(650);
    const aivaFieldEnd = await scanFrame(separatorPage);
    assert(aivaFieldEnd.universeFrame > aivaFieldStart.universeFrame, `${viewport.name}: AIVA's continuous field did not keep animating`);
    await separatorPage.screenshot({ path: path.join(outputDir, `${viewport.name}-aiva-field-02.png`) });
    report.aivaFieldMotion.push({
      viewport: viewport.name,
      frames: aivaFieldEnd.universeFrame - aivaFieldStart.universeFrame,
      durationMs: aivaFieldEnd.sampledAt - aivaFieldStart.sampledAt,
      passed: true,
    });
    const { firstSceneSteps, firstSpeakerChangeIndex, nextSpeaker } = await separatorPage.evaluate(() => {
      const steps = globalThis.GAIA_TRUE_END_STORY.scenes[0].steps;
      const speakerFor = (item) => item.speaker || "narrator";
      const changeIndex = steps.findIndex((item, index) => index > 0 && speakerFor(item) !== speakerFor(steps[index - 1]));
      return {
        firstSceneSteps: steps.length,
        firstSpeakerChangeIndex: changeIndex,
        nextSpeaker: speakerFor(steps[changeIndex]),
      };
    });
    assert(firstSpeakerChangeIndex > 0, `${viewport.name}: no speaker change was found for the presence fade test`);
    while (Number.parseInt((await scanFrame(separatorPage)).counter, 10) < firstSpeakerChangeIndex) {
      await advanceTransmissionStep(separatorPage);
    }
    await separatorPage.evaluate(() => {
      const shell = document.querySelector(".true-end-shell");
      if (shell?.classList.contains("is-revealing")) document.querySelector(".true-end-dialogue")?.click();
    });
    await separatorPage.waitForFunction(() => !document.querySelector(".true-end-shell")?.classList.contains("is-revealing"));
    const fadeBefore = await scanFrame(separatorPage);
    await separatorPage.evaluate(() => document.querySelector(".true-end-dialogue")?.click());
    await separatorPage.waitForTimeout(50);
    const fadeStart = await scanFrame(separatorPage);
    assert.equal(fadeStart.motionReduced, false, `${viewport.name}: fade test unexpectedly prefers reduced motion`);
    assert.equal(fadeStart.universeState, "active", `${viewport.name}: WebGL universe is unavailable during fade test`);
    assert.equal(fadeStart.universePresenceState, "fading", `${viewport.name}: presence transition was not started (${JSON.stringify({ before: fadeBefore.speaker, after: fadeStart.speaker, mix: fadeStart.universePresenceMix, frame: fadeStart.universeFrame })})`);
    assert.equal(fadeStart.universeSpeaker, nextSpeaker, `${viewport.name}: WebGL did not begin the next speaker presence`);
    assert.equal(fadeStart.speaker, fadeBefore.speaker, `${viewport.name}: speaker label changed before the new presence was fully visible`);
    assert.equal(fadeStart.message, fadeBefore.message, `${viewport.name}: message changed before the new presence was fully visible`);
    assert.equal(fadeStart.counter, fadeBefore.counter, `${viewport.name}: message step committed before the new presence was fully visible`);
    assert.equal(fadeStart.universePresenceDuration, 760, `${viewport.name}: AIVA fade-out duration is not 760ms`);
    await separatorPage.waitForTimeout(100);
    const fadeMiddle = await scanFrame(separatorPage);
    if (fadeMiddle.universePresenceState === "fading") {
      assert.equal(fadeMiddle.message, fadeBefore.message, `${viewport.name}: message changed during the presence crossfade`);
      assert(
        fadeMiddle.universePresenceMix > fadeStart.universePresenceMix && fadeMiddle.universePresenceMix < 0.95,
        `${viewport.name}: presence did not interpolate continuously (${JSON.stringify({ start: { mix: fadeStart.universePresenceMix, frame: fadeStart.universeFrame, state: fadeStart.universePresenceState, hidden: fadeStart.documentHidden }, middle: { mix: fadeMiddle.universePresenceMix, frame: fadeMiddle.universeFrame, state: fadeMiddle.universePresenceState, hidden: fadeMiddle.documentHidden } })})`,
      );
    } else {
      assert.equal(fadeMiddle.universePresenceState, "steady", `${viewport.name}: presence entered an unknown state`);
      assert(fadeMiddle.universePresenceMix >= 0.9999, `${viewport.name}: settled presence has an incomplete mix`);
      assert(fadeMiddle.universePresenceCompletedAt > fadeStart.sampledAt, `${viewport.name}: delayed mobile sample lost the presence completion timestamp`);
      assert(fadeMiddle.messageCommittedAt >= fadeMiddle.universePresenceCompletedAt, `${viewport.name}: delayed mobile sample committed the message before presence completion`);
    }
    await separatorPage.screenshot({ path: path.join(outputDir, `${viewport.name}-presence-fade.png`) });
    await separatorPage.waitForFunction((counter) => document.querySelector(".true-end-footer span:last-child")?.textContent?.trim() !== counter, fadeBefore.counter, { timeout: 2_000 });
    const fadeAfter = await scanFrame(separatorPage);
    assert(fadeAfter.universePresenceMix >= 0.9999, `${viewport.name}: presence fade did not finish (${fadeAfter.universePresenceMix})`);
    assert.equal(fadeAfter.universePresenceState, "steady", `${viewport.name}: message committed before the presence became steady`);
    assert.equal(fadeAfter.speaker, nextSpeaker, `${viewport.name}: speaker label did not update after the presence completed`);
    assert.notEqual(fadeAfter.message, fadeBefore.message, `${viewport.name}: message did not update after the presence completed`);
    assert(fadeAfter.universePresenceCompletedAt > 0, `${viewport.name}: presence completion timestamp is missing`);
    assert(fadeAfter.messageCommittedAt >= fadeAfter.universePresenceCompletedAt, `${viewport.name}: message committed before presence completion (${JSON.stringify({ presence: fadeAfter.universePresenceCompletedAt, message: fadeAfter.messageCommittedAt })})`);
    const aivaFadeElapsed = fadeAfter.universePresenceCompletedAt - fadeBefore.sampledAt;
    assert(aivaFadeElapsed >= 700, `${viewport.name}: AIVA faded out too quickly (${aivaFadeElapsed.toFixed(1)}ms)`);
    report.presenceFades.push({
      viewport: viewport.name,
      from: fadeBefore.speaker,
      to: fadeAfter.speaker,
      durationMs: aivaFadeElapsed,
      samples: [fadeStart.universePresenceMix, fadeMiddle.universePresenceMix, fadeAfter.universePresenceMix],
      passed: true,
    });
    if (presenceOnly) {
      await separatorContext.close();
      continue;
    }

    while (Number.parseInt((await scanFrame(separatorPage)).counter, 10) < firstSceneSteps) {
      await advanceTransmissionStep(separatorPage);
    }
    await separatorPage.evaluate(() => {
      const shell = document.querySelector(".true-end-shell");
      const dialogue = document.querySelector(".true-end-dialogue");
      const [pageIndex, pageCount] = shell.dataset.messagePage.split("/").map(Number);
      // Read every page of the last step before testing the section boundary.
      for (let remaining = pageCount - pageIndex; remaining > 0; remaining -= 1) {
        if (shell.classList.contains("is-revealing")) dialogue.click();
        dialogue.click();
      }
      if (shell.classList.contains("is-revealing")) dialogue.click();
    });
    await separatorPage.waitForFunction(() => !document.querySelector(".true-end-shell")?.classList.contains("is-revealing"));

    const beforeSeparator = await scanFrame(separatorPage);
    assert.equal(beforeSeparator.scene, "after-ending", `${viewport.name}: separator test overshot the first scene`);
    assert.equal(beforeSeparator.title, "こどもと魔法", `${viewport.name}: renamed first section title is missing`);
    assert.equal(beforeSeparator.counter, `${String(firstSceneSteps).padStart(3, "0")} / 133`, `${viewport.name}: separator test did not stop at the scene boundary`);
    assert.equal(beforeSeparator.interfaceOpacity, 1, `${viewport.name}: interface was not fully visible before the separator`);
    assert.equal(beforeSeparator.motionReduced, false, `${viewport.name}: separator timing test unexpectedly prefers reduced motion`);
    await separatorPage.screenshot({ path: path.join(outputDir, `${viewport.name}-separator-00-before.png`) });

    const separatorTriggeredAt = await separatorPage.evaluate(() => {
      const shell = document.querySelector(".true-end-shell");
      const trace = [];
      globalThis.__trueEndSeparatorPhases = trace;
      const observer = new MutationObserver(() => {
        const phase = shell.dataset.sectionTransitionPhase;
        if (trace.at(-1)?.phase !== phase) trace.push({ phase, time: performance.now() });
        if (phase === "idle") observer.disconnect();
      });
      observer.observe(shell, { attributes: true, attributeFilter: ["data-section-transition-phase"] });
      const dialogue = document.querySelector(".true-end-dialogue");
      dialogue?.click();
      dialogue?.click();
      dialogue?.click();
      return performance.now();
    });
    if (productionSmoke) {
      await separatorPage.waitForFunction((triggeredAt) => {
        const shell = document.querySelector(".true-end-shell");
        const message = document.querySelector(".true-end-message");
        return shell?.dataset.scene === "electronic-civilization"
          && shell.dataset.sectionTransitionPhase === "idle"
          && Number(shell.dataset.sectionTransitionCompletedAt || 0) > triggeredAt
          && Number(shell.dataset.messageCommittedAt || 0) >= Number(shell.dataset.sectionTransitionCompletedAt || 0)
          && Boolean(message?.textContent);
      }, separatorTriggeredAt, { timeout: 15_000, polling: 10 });
      const productionAfter = await scanFrame(separatorPage);
      assert.equal(productionAfter.scene, "electronic-civilization", `${viewport.name}: production separator did not advance to the next scene`);
      assert.equal(productionAfter.counter, `${String(firstSceneSteps + 1).padStart(3, "0")} / 133`, `${viewport.name}: production click burst advanced more than one message`);
      assert.notEqual(productionAfter.message, beforeSeparator.message, `${viewport.name}: production next message did not appear`);
      assert.equal(productionAfter.dialogueVisible, true, `${viewport.name}: production message UI stayed hidden`);
      assert(productionAfter.sectionTransitionCompletedAt > separatorTriggeredAt, `${viewport.name}: production section completion timestamp is missing`);
      assert(productionAfter.messageCommittedAt >= productionAfter.sectionTransitionCompletedAt, `${viewport.name}: production message committed before section fade-out completed`);
      await separatorPage.screenshot({ path: path.join(outputDir, `${viewport.name}-separator-production-after.png`), animations: "disabled" });
      report.separatorOrder.push({
        viewport: viewport.name,
        before: beforeSeparator.message,
        during: "production-smoke",
        after: productionAfter.message,
        productionSmoke: true,
        passed: true,
      });
      await separatorContext.close();
      continue;
    }
    await separatorPage.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "blackout", null, { timeout: 2_000 });
    await separatorPage.waitForTimeout(140);
    const blackout = await scanFrame(separatorPage);
    assert.equal(blackout.separatorActive, true, `${viewport.name}: separator state ended during blackout`);
    assert.equal(blackout.sectionTransitionPhase, "blackout", `${viewport.name}: blackout phase was skipped`);
    assert(blackout.sceneCardOpacity > 0 && blackout.sceneCardOpacity < 1, `${viewport.name}: black curtain did not fade in continuously (${blackout.sceneCardOpacity} at ${(blackout.sampledAt - separatorTriggeredAt).toFixed(1)}ms)`);
    assert.equal(blackout.interfaceOpacity, 1, `${viewport.name}: interface faded independently under the black curtain`);
    assert.equal(blackout.scene, "after-ending", `${viewport.name}: section metadata changed before full black`);
    assert.equal(blackout.universeScene, beforeSeparator.universeScene, `${viewport.name}: WebGL background changed before full black`);
    assert.equal(blackout.message, beforeSeparator.message, `${viewport.name}: message changed before full black`);
    assert.equal(blackout.dialogueVisible, false, `${viewport.name}: message UI remained visible during blackout`);

    await separatorPage.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "title", null, { timeout: 2_000, polling: 10 });
    await separatorPage.waitForTimeout(90);
    const title = await scanFrame(separatorPage);
    assert(title.sceneCardOpacity >= 0.99, `${viewport.name}: section title appeared without a fully opaque curtain (${title.sceneCardOpacity})`);
    assert.equal(title.sceneCardBackground, "rgb(0, 0, 0)", `${viewport.name}: section curtain is not pure black (${title.sceneCardBackground})`);
    assert(title.audioDockOpacity <= 0.01, `${viewport.name}: global audio UI remained visible over the black title card (${JSON.stringify({ opacity: title.audioDockOpacity, inlineOpacity: title.audioDockInlineOpacity, inlinePriority: title.audioDockInlinePriority, hidden: title.audioDockHidden, bodyTransitionClass: title.bodyTransitionClass })})`);
    assert.equal(title.scene, "electronic-civilization", `${viewport.name}: next section metadata was not prepared under black`);
    assert.equal(title.sceneCardTitle, "電子を使っていた文明", `${viewport.name}: next section title was not shown over black`);
    if (viewport.width <= 720) assert.equal(title.sceneCardTitleLineCount, 1, `${viewport.name}: transition section title wrapped on mobile`);
    assert(title.sceneCardTitleOpacity > 0 && title.sceneCardTitleOpacity <= 1, `${viewport.name}: section title was not visible (${title.sceneCardTitleOpacity})`);
    assert.equal(title.universeScene, beforeSeparator.universeScene, `${viewport.name}: WebGL background switched before the title appeared`);
    assert.equal(title.message, beforeSeparator.message, `${viewport.name}: next message rendered before background preparation`);
    assert.equal(title.dialogueVisible, false, `${viewport.name}: message UI became visible behind the section title`);
    await separatorPage.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "switching", null, { timeout: 2_000, polling: 10 });
    await separatorPage.waitForFunction(() => document.querySelector(".true-end-universe")?.dataset.webglScene === "reconstruction", null, { timeout: 2_000, polling: 10 });
    const switching = await scanFrame(separatorPage);
    assert(switching.sceneCardOpacity >= 0.99, `${viewport.name}: black curtain opened while the WebGL background was switching`);
    assert.equal(switching.sceneCardBackground, "rgb(0, 0, 0)", `${viewport.name}: switching phase lost its pure-black cover`);
    assert(switching.universeFrame > beforeSeparator.universeFrame, `${viewport.name}: new WebGL background did not draw under black`);

    await separatorPage.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "ready", null, { timeout: 3_000, polling: 10 });
    const ready = await scanFrame(separatorPage);
    const titleHoldMs = await separatorPage.evaluate(() => {
      const phases = globalThis.__trueEndSeparatorPhases;
      return phases.find(({ phase }) => phase === "ready")?.time - phases.find(({ phase }) => phase === "switching")?.time;
    });
    assert(titleHoldMs >= 1650, `${viewport.name}: section title did not hold for 1.6 times the original duration (${titleHoldMs}ms)`);
    assert(ready.sceneCardOpacity >= 0.99, `${viewport.name}: curtain opened before section preparation completed`);
    assert.equal(ready.universeScene, "reconstruction", `${viewport.name}: next WebGL background was not ready before reveal`);
    assert.equal(ready.universePresenceState, "steady", `${viewport.name}: character presence was not fully displayed before reveal`);
    assert.equal(ready.message, beforeSeparator.message, `${viewport.name}: next message was committed while the screen was black`);
    assert.equal(ready.messageCommittedAt, beforeSeparator.messageCommittedAt, `${viewport.name}: message timestamp changed before curtain reveal`);
    assert.equal(ready.dialogueVisible, false, `${viewport.name}: message UI became visible before curtain reveal`);
    await separatorPage.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "reveal", null, { timeout: 2_000, polling: 10 });
    await separatorPage.waitForTimeout(150);
    const reveal = await scanFrame(separatorPage);
    assert(reveal.sceneCardOpacity > 0 && reveal.sceneCardOpacity < 1, `${viewport.name}: new section did not fade in from black (${reveal.sceneCardOpacity})`);
    assert.equal(reveal.interfaceOpacity, 1, `${viewport.name}: prepared UI faded separately during reveal`);
    assert.equal(reveal.universeScene, "reconstruction", `${viewport.name}: background changed during reveal`);
    assert.equal(reveal.message, beforeSeparator.message, `${viewport.name}: next message was committed before curtain fade-out completed`);
    assert.equal(reveal.messageCommittedAt, beforeSeparator.messageCommittedAt, `${viewport.name}: message timestamp changed during curtain fade-out`);
    assert.equal(reveal.sectionTransitionCompletedAt, 0, `${viewport.name}: section completion was recorded before curtain fade-out completed`);
    assert.equal(reveal.dialogueVisible, false, `${viewport.name}: message UI was visible during curtain fade-out`);

    await separatorPage.waitForFunction(() => {
      const shell = document.querySelector(".true-end-shell");
      const message = document.querySelector(".true-end-message");
      return shell?.dataset.sectionTransitionPhase === "idle"
        && Number(shell.dataset.messageCommittedAt || 0) >= Number(shell.dataset.sectionTransitionCompletedAt || 0)
        && Boolean(message?.textContent);
    }, null, { timeout: 3_000, polling: 10 });
    const afterSeparator = await scanFrame(separatorPage);
    assert.equal(afterSeparator.separatorActive, false, `${viewport.name}: separating state remained after reveal`);
    assert.equal(afterSeparator.interfaceOpacity, 1, `${viewport.name}: prepared interface was not fully visible after reveal`);
    assert.equal(afterSeparator.sceneCardOpacity, 0, `${viewport.name}: separator remained visible after the interface returned`);
    assert.equal(afterSeparator.scene, "electronic-civilization", `${viewport.name}: separator did not advance to the next scene`);
    assert.equal(afterSeparator.counter, `${String(firstSceneSteps + 1).padStart(3, "0")} / 133`, `${viewport.name}: click burst advanced more than one message`);
    assert.notEqual(afterSeparator.message, beforeSeparator.message, `${viewport.name}: next message did not appear after curtain fade-out`);
    assert.equal(afterSeparator.dialogueVisible, true, `${viewport.name}: message UI stayed hidden after curtain fade-out`);
    assert(afterSeparator.sectionTransitionCompletedAt > separatorTriggeredAt, `${viewport.name}: section completion timestamp is missing`);
    assert(afterSeparator.sectionTransitionCompletedAt - separatorTriggeredAt >= 4_100, `${viewport.name}: section separator was not held long enough (${(afterSeparator.sectionTransitionCompletedAt - separatorTriggeredAt).toFixed(1)}ms)`);
    assert(afterSeparator.messageCommittedAt >= afterSeparator.sectionTransitionCompletedAt, `${viewport.name}: next message committed before section fade-out completed (${JSON.stringify({ section: afterSeparator.sectionTransitionCompletedAt, message: afterSeparator.messageCommittedAt })})`);
    assert(afterSeparator.messageCommittedAt > beforeSeparator.messageCommittedAt, `${viewport.name}: next message did not receive a new commit timestamp`);
    await separatorPage.screenshot({ path: path.join(outputDir, `${viewport.name}-separator-05-after.png`) });

    report.separatorOrder.push({
      viewport: viewport.name,
      before: beforeSeparator.message,
      during: reveal.message,
      after: afterSeparator.message,
      durationMs: afterSeparator.sectionTransitionCompletedAt - separatorTriggeredAt,
      titleHoldMs,
      webglFramesDuringTransition: ready.universeFrame - beforeSeparator.universeFrame,
      passed: true,
    });
    // Exercise the pictured VENA 03 card too, via the real next-section control.
    await separatorPage.evaluate(() => {
      const shell = document.querySelector(".true-end-shell");
      const phases = [];
      globalThis.__trueEndSeparatorPhases = phases;
      const observer = new MutationObserver(() => {
        const phase = shell.dataset.sectionTransitionPhase;
        if (phases.at(-1)?.phase !== phase) phases.push({ phase, time: performance.now() });
        if (phase === "idle") observer.disconnect();
      });
      observer.observe(shell, { attributes: true, attributeFilter: ["data-section-transition-phase"] });
      document.querySelector(".true-end-skip-button").click();
    });
    await separatorPage.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "switching");
    assert.equal(await separatorPage.locator(".true-end-scene-card-content strong").textContent(), "星々の放課後");
    await separatorPage.waitForTimeout(1100);
    const starsHold = await scanFrame(separatorPage);
    assert.equal(starsHold.sectionTransitionPhase, "switching", `${viewport.name}: VENA 03 ended at the former hold duration`);
    assert.equal(starsHold.sceneCardTitleOpacity, 1, `${viewport.name}: VENA 03 did not stay fully visible`);
    assert.equal(starsHold.dialogueVisible, false);
    await separatorPage.screenshot({ path: path.join(outputDir, `${viewport.name}-vena-03-extended-hold.png`) });
    await separatorPage.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "idle", null, { timeout: 8_000 });
    const starsHoldMs = await separatorPage.evaluate(() => {
      const phases = globalThis.__trueEndSeparatorPhases;
      return phases.find(({ phase }) => phase === "ready")?.time - phases.find(({ phase }) => phase === "switching")?.time;
    });
    assert(starsHoldMs >= 1650, `${viewport.name}: VENA 03 hold was too short (${starsHoldMs}ms)`);
    assert.equal((await scanFrame(separatorPage)).scene, "after-school-stars");
    report.separatorOrder.at(-1).starsTitleHoldMs = starsHoldMs;
    await separatorContext.close();
  }

  assert(report.audioResponses.some(({ url, status }) => url.endsWith("/assets/audio/sensory-horizon.wav") && [200, 206].includes(status)), "dedicated true-end score was never requested");
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

console.log(`True-end browser check passed: ${report.viewports.length} viewports / three approved scenes / dedicated score`);
