import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
const extraArguments = process.argv.slice(6);
const pcOnly = extraArguments.includes("--pc-only");
const mobileOnly = extraArguments.includes("--mobile-only");
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/ending-staff-roll-browser");
fs.mkdirSync(outputDir, { recursive: true });

const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v4";
const viewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "pc-1440", width: 1440, height: 900 },
].filter(({ name }) => (!pcOnly || name === "pc-1440") && (!mobileOnly || name === "mobile-390"));
const report = {
  status: "running",
  baseUrl,
  scans: [],
  reducedMotion: null,
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
  audioResponses: [],
};

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
    if (/\/assets\/audio\/.*\.(?:mp3|wav)(?:\?|$)/u.test(response.url())) {
      report.audioResponses.push({ label, status: response.status(), url: response.url() });
    }
  });
};

const bootAtEnding = async (page, reducedMotion = false) => {
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaModeLoader), null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.GaiaModeLoader.load("story"));
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY), null, { timeout: 90_000 });
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.evaluate(({ storageKey, configKey, reduced }) => {
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
      sessionId: `ending-staff-roll-${reduced ? "reduced" : "motion"}`,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: state,
      savedAt: Date.now(),
      meta: { title: "Ending QA", excerpt: state.stepId },
    }]));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: reduced }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, { storageKey: STORAGE_KEY, configKey: CONFIG_KEY, reduced: reducedMotion });
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-staff-roll"), null, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
  await page.evaluate(() => document.fonts.ready);
};

const scanEnding = (page) => page.evaluate(() => {
  const layer = document.querySelector("#novel-layer");
  const shell = document.querySelector(".novel-staff-roll");
  const whiteout = document.querySelector(".novel-staff-roll-whiteout");
  const stage = document.querySelector(".novel-staff-roll-stage");
  const track = document.querySelector(".novel-staff-roll-track");
  const titleHeading = document.querySelector(".novel-staff-roll-title-accessible");
  const titleLogo = document.querySelector(".novel-staff-roll-title-logo");
  const titleKicker = document.querySelector(".novel-staff-roll-title > span");
  const creditsHeading = document.querySelector(".novel-staff-roll-credits-heading");
  const firstCredit = document.querySelector(".novel-staff-roll-credit");
  const button = document.querySelector(".novel-staff-roll-finale button");
  const closingAction = document.querySelector(".novel-staff-roll-closing-action");
  const closingMark = document.querySelector(".novel-staff-roll-closing-mark");
  const toolbar = document.querySelector(".novel-topbar");
  const temporalCaption = document.querySelector(".novel-signal-caption");
  const dataSkip = document.querySelector(".novel-staff-roll-data-skip");
  const audioDock = document.querySelector(".gaia-audio-dock");
  const audioToggle = document.querySelector("#gaia-audio-toggle");
  const closing = document.querySelector(".novel-staff-roll-closing");
  const closingLine = document.querySelector(".novel-staff-roll-closing > strong");
  const closingCopyright = document.querySelector(".novel-staff-roll-closing-action > small");
  const lastCredit = document.querySelector(".novel-staff-roll-credit:last-child");
  const trackStyle = getComputedStyle(track);
  const whiteoutStyle = getComputedStyle(whiteout);
  const stageStyle = getComputedStyle(stage);
  const toolbarStyle = getComputedStyle(toolbar);
  const temporalCaptionStyle = temporalCaption ? getComputedStyle(temporalCaption) : null;
  const audioDockStyle = audioDock ? getComputedStyle(audioDock) : null;
  const audioToggleStyle = audioToggle ? getComputedStyle(audioToggle) : null;
  const buttonRect = button?.getBoundingClientRect();
  const closingMarkRect = closingMark?.getBoundingClientRect();
  const trackRect = track?.getBoundingClientRect();
  const titleLogoRect = titleLogo?.getBoundingClientRect();
  const creditsHeadingRect = creditsHeading?.getBoundingClientRect();
  const firstCreditRect = firstCredit?.getBoundingClientRect();
  const closingRect = closing?.getBoundingClientRect();
  const closingLineRect = closingLine?.getBoundingClientRect();
  const closingCopyrightRect = closingCopyright?.getBoundingClientRect();
  const lastCreditRect = lastCredit?.getBoundingClientRect();
  const dataSkipRect = dataSkip?.getBoundingClientRect();
  const audioDockRect = audioDock?.getBoundingClientRect();
  const buttonStyle = button ? getComputedStyle(button) : null;
  const trackCenterX = trackRect ? trackRect.left + (trackRect.width / 2) : 0;
  const creditRows = [...document.querySelectorAll(".novel-staff-roll-credit")].map((row) => {
    const term = row.querySelector("dt");
    const description = row.querySelector("dd");
    const rowRect = row.getBoundingClientRect();
    const termRect = term?.getBoundingClientRect();
    const descriptionRect = description?.getBoundingClientRect();
    const nameElements = [...row.querySelectorAll(".novel-staff-roll-credit-name")];
    const dividerTopOffset = row.querySelector(".novel-staff-roll-credit-divider")?.offsetTop || 0;
    const namesBottomOffset = description ? description.offsetTop + description.offsetHeight : 0;
    return {
      role: row.dataset.creditRole || "",
      textAlign: getComputedStyle(row).textAlign,
      rowCenterDelta: Math.abs((rowRect.left + (rowRect.width / 2)) - trackCenterX),
      termCenterDelta: termRect ? Math.abs((termRect.left + (termRect.width / 2)) - trackCenterX) : null,
      descriptionCenterDelta: descriptionRect ? Math.abs((descriptionRect.left + (descriptionRect.width / 2)) - trackCenterX) : null,
      dividerClearance: dividerTopOffset - namesBottomOffset,
      rowHeight: row.offsetHeight,
      dividerTopOffset,
      namesBottomOffset,
      names: nameElements.map((name) => name.textContent.trim()),
      nameLines: nameElements.map((name) => {
        const range = document.createRange();
        range.selectNodeContents(name);
        return new Set([...range.getClientRects()].map(({ top }) => Math.round(top * 2) / 2)).size;
      }),
      nameOverflow: nameElements.some((name) => name.scrollWidth > name.clientWidth + 1),
      musicTracks: [...row.querySelectorAll(".novel-staff-roll-credit-name.is-music-track")].map((track) => {
        const label = track.querySelector(".novel-staff-roll-music-label");
        const title = track.querySelector(".novel-staff-roll-music-title");
        const titleRange = document.createRange();
        if (title) titleRange.selectNodeContents(title);
        return {
          label: label?.textContent?.trim() || "",
          title: title?.textContent?.trim() || "",
          titleLines: new Set([...titleRange.getClientRects()].map(({ top }) => Math.round(top * 2) / 2)).size,
          titleOverflow: title ? title.scrollWidth > title.clientWidth + 1 : true,
        };
      }),
    };
  });
  return {
    stepId: layer?.dataset.stepId,
    phase: shell?.dataset.phase,
    text: track?.innerText || "",
    titleHeading: titleHeading?.textContent?.trim() || "",
    titleLogoCount: document.querySelectorAll(".novel-staff-roll-title-logo").length,
    titleLogoSrc: titleLogo?.getAttribute("src") || "",
    titleLogoLoaded: Boolean(titleLogo?.complete && titleLogo.naturalWidth === 2172 && titleLogo.naturalHeight === 724),
    titleKickerDisplay: titleKicker ? getComputedStyle(titleKicker).display : "",
    creditsHeadingText: creditsHeading?.textContent?.trim() || "",
    creditsHeadingDisplay: creditsHeading ? getComputedStyle(creditsHeading).display : "",
    creditsHeadingBeforeFirstCredit: Boolean(creditsHeadingRect && firstCreditRect && creditsHeadingRect.bottom <= firstCreditRect.top),
    titleLogoRect: titleLogoRect ? {
      left: titleLogoRect.left,
      right: titleLogoRect.right,
      width: titleLogoRect.width,
      height: titleLogoRect.height,
    } : null,
    trackY: track?.getBoundingClientRect().y || 0,
    trackAnimation: trackStyle.animationName,
    trackDuration: trackStyle.animationDuration,
    trackDelay: trackStyle.animationDelay,
    closingGap: closingRect && lastCreditRect ? closingRect.top - lastCreditRect.bottom : 0,
    copyrightGap: closingMarkRect && closingCopyrightRect ? closingCopyrightRect.top - closingMarkRect.bottom : null,
    copyrightParentClass: closingCopyright?.parentElement?.className || "",
    whiteoutAnimation: whiteoutStyle.animationName,
    stageBackground: stageStyle.backgroundImage,
    toolbarHidden: toolbarStyle.visibility === "hidden" && Number(toolbarStyle.opacity) === 0,
    temporalCaptionHidden: !temporalCaption?.getClientRects().length
      || temporalCaptionStyle?.visibility === "hidden"
      || Number(temporalCaptionStyle?.opacity) === 0,
    dataSkipRect: dataSkipRect ? {
      left: dataSkipRect.left,
      top: dataSkipRect.top,
      right: dataSkipRect.right,
      bottom: dataSkipRect.bottom,
      width: dataSkipRect.width,
      height: dataSkipRect.height,
    } : null,
    dataSkipText: dataSkip?.textContent?.trim() || "",
    audioDockRect: audioDockRect ? {
      left: audioDockRect.left,
      top: audioDockRect.top,
      right: audioDockRect.right,
      bottom: audioDockRect.bottom,
      width: audioDockRect.width,
      height: audioDockRect.height,
    } : null,
    topControlsOverlap: Boolean(dataSkipRect && audioDockRect
      && dataSkipRect.left < audioDockRect.right
      && dataSkipRect.right > audioDockRect.left
      && dataSkipRect.top < audioDockRect.bottom
      && dataSkipRect.bottom > audioDockRect.top),
    audioDockBackground: audioDockStyle?.backgroundColor || "",
    audioDockExpanded: audioDock?.classList.contains("is-expanded") || false,
    audioToggleColor: audioToggleStyle?.color || "",
    fastForwarding: layer?.classList.contains("is-fast-forwarding") ?? false,
    skipHintCount: document.querySelectorAll(".novel-staff-roll-skip-hint").length,
    buttonHidden: button?.closest(".novel-staff-roll-finale")?.hidden ?? true,
    buttonText: button?.textContent?.trim() || "",
    buttonAriaLabel: button?.getAttribute("aria-label") || "",
    buttonHeight: buttonRect?.height || 0,
    buttonBackground: buttonStyle?.background || "",
    buttonBorderColor: buttonStyle?.borderColor || "",
    buttonColor: buttonStyle?.color || "",
    buttonDisabled: button?.disabled ?? false,
    buttonMarkCenterDelta: buttonRect && closingMarkRect
      ? Math.hypot(
        (buttonRect.left + (buttonRect.width / 2)) - (closingMarkRect.left + (closingMarkRect.width / 2)),
        (buttonRect.top + (buttonRect.height / 2)) - (closingMarkRect.top + (closingMarkRect.height / 2)),
      )
      : null,
    closingMarkText: closingMark?.textContent?.trim() || "",
    closingMarkAnimation: closingMark ? getComputedStyle(closingMark).animationName : "",
    closingWords: [...document.querySelectorAll(".novel-staff-roll-closing-word")].map((word) => ({
      text: word.textContent,
      animation: getComputedStyle(word).animationName,
      delay: getComputedStyle(word).animationDelay,
      opacity: Number(getComputedStyle(word).opacity),
    })),
    closingActionFlashAnimation: closingAction ? getComputedStyle(closingAction, "::before").animationName : "",
    closingActionFlashDuration: closingAction ? getComputedStyle(closingAction, "::before").animationDuration : "",
    transitionPhase: layer?.dataset.trueEndTransitionPhase || "",
    transitionVeilCount: document.querySelectorAll(".novel-staff-roll-transition-veil").length,
    audioTrack: globalThis.GaiaOpeningAudio?.getState?.().track || "",
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    bodyOverflowX: Math.max(0, document.body.scrollWidth - innerWidth),
    creditRows,
  };
});

const scanDataDestination = (page) => page.evaluate((storageKey) => {
  const layer = document.querySelector("#novel-layer");
  const intro = document.querySelector("#intro-layer");
  const stage = document.querySelector("#intro-path-stage");
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  return {
    introVisible: Boolean(intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false"),
    stageVisible: Boolean(stage && !stage.hidden),
    heading: stage?.querySelector(".intro-exploration-heading h3")?.textContent?.trim() || "",
    pathCount: stage?.querySelectorAll(".intro-path-card").length || 0,
    novelHidden: layer?.getAttribute("aria-hidden") === "true",
    staffRollCount: document.querySelectorAll(".novel-staff-roll").length,
    obsoleteEndCount: document.querySelectorAll(".novel-end-v6").length,
    clear: globalThis.GaiaNovel?.getState?.().clear,
    archivesUnlocked: globalThis.GaiaNovel?.getState?.().archivesUnlocked,
    savedClear: saved.clear,
    savedArchivesUnlocked: saved.archivesUnlocked,
    audioTrack: globalThis.GaiaOpeningAudio?.getState?.().track || "",
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
}, STORAGE_KEY);

const scanTrueEndDestination = (page) => page.evaluate((storageKey) => {
  const layer = document.querySelector("#novel-layer");
  const shell = document.querySelector(".true-end-shell");
  const dialogue = document.querySelector(".true-end-dialogue");
  const dialogueStyle = dialogue ? getComputedStyle(dialogue) : null;
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  return {
    trueEndVisible: Boolean(shell),
    layerActive: layer?.classList.contains("is-true-end") ?? false,
    scene: shell?.dataset.scene || "",
    entryPhase: shell?.dataset.entryPhase || "",
    sectionTransitionPhase: shell?.dataset.sectionTransitionPhase || "",
    heading: document.querySelector(".true-end-scene-heading strong")?.textContent?.trim() || "",
    message: document.querySelector(".true-end-message")?.textContent || "",
    dialogueHeight: dialogue?.getBoundingClientRect().height || 0,
    dialogueVisibility: dialogueStyle?.visibility || "",
    dialogueOpacity: dialogueStyle?.opacity || "",
    clear: globalThis.GaiaNovel?.getState?.().clear,
    archivesUnlocked: globalThis.GaiaNovel?.getState?.().archivesUnlocked,
    savedClear: saved.clear,
    savedArchivesUnlocked: saved.archivesUnlocked,
    audioTrack: globalThis.GaiaOpeningAudio?.getState?.().track || "",
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
}, STORAGE_KEY);

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "no-preference",
      deviceScaleFactor: viewport.width <= 720 ? 3 : 1,
    });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    const audioRuntimeResponse = await page.request.get(new URL("/opening-audio.js", baseUrl).href);
    assert.equal(audioRuntimeResponse.ok(), true, `${viewport.name}: opening-audio.js was not available`);
    assert.match(await audioRuntimeResponse.text(), /ending:\s*"\.\/assets\/audio\/after-school-afterglow\.mp3"/u, `${viewport.name}: ending is not mapped to AfterSchool,AfterGlow`);
    assert.match(await audioRuntimeResponse.text(), /trueend:\s*"\.\/assets\/audio\/sensory-horizon\.wav"/u, `${viewport.name}: true end is not mapped to its dedicated score`);
    await bootAtEnding(page, false);

    const initial = await scanEnding(page);
    assert.equal(initial.stepId, "welcome_chat_095");
    assert.equal(initial.phase, "whiteout", `${viewport.name}: ending did not begin with whiteout`);
    assert.equal(initial.whiteoutAnimation, "novel-staff-roll-whiteout");
    assert.equal(initial.trackAnimation, "novel-staff-roll-rise");
    assert.equal(initial.trackDuration, viewport.name === "mobile-390" ? "54s" : "60s");
    assert.equal(initial.trackDelay, "17.6s", `${viewport.name}: credits did not wait for the centered title`);
    assert(initial.closingGap >= viewport.height * 0.5, `${viewport.name}: closing poem gap is too short (${initial.closingGap}px)`);
    assert(initial.copyrightGap >= 0 && initial.copyrightGap <= 20, `${viewport.name}: copyright group geometry is invalid (${initial.copyrightGap}px)`);
    assert.equal(initial.copyrightParentClass, "novel-staff-roll-closing-action", `${viewport.name}: copyright is outside the thank-you group`);
    assert.equal(initial.buttonHidden, true, `${viewport.name}: END action was shown before the roll`);
    assert.equal(initial.closingMarkText, "Thank you for playing");
    assert.equal(initial.text.includes("\nEND"), false, `${viewport.name}: obsolete END mark remains`);
    assert.equal(initial.skipHintCount, 0, `${viewport.name}: obsolete staff-roll skip hint remains`);
    assert.equal(initial.toolbarHidden, true, `${viewport.name}: normal VN toolbar remained over the ending`);
    assert.equal(initial.temporalCaptionHidden, true, `${viewport.name}: story date remained over the staff roll`);
    assert.equal(initial.dataSkipText, "スキップ▶", `${viewport.name}: staff-roll skip label is wrong`);
    assert(initial.dataSkipRect && initial.dataSkipRect.height >= 44, `${viewport.name}: staff-roll skip hit area is under 44px`);
    assert(initial.audioDockRect && initial.audioDockRect.height >= 44, `${viewport.name}: staff-roll audio hit area is under 44px`);
    assert.equal(initial.topControlsOverlap, false, `${viewport.name}: staff-roll skip and audio controls overlap`);
    assert(initial.dataSkipRect.left <= (viewport.width <= 720 ? 16 : 22), `${viewport.name}: staff-roll skip is not anchored on the left`);
    assert(initial.audioDockRect.right >= viewport.width - (viewport.width <= 720 ? 16 : 22), `${viewport.name}: staff-roll audio is not anchored on the right`);
    if (viewport.width <= 720) {
      assert(Math.abs(initial.dataSkipRect.width - initial.audioDockRect.width) <= 0.5, `${viewport.name}: staff-roll skip width differs from audio control (${initial.dataSkipRect.width}px vs ${initial.audioDockRect.width}px)`);
      assert(Math.abs(initial.dataSkipRect.height - initial.audioDockRect.height) <= 0.5, `${viewport.name}: staff-roll skip height differs from audio control (${initial.dataSkipRect.height}px vs ${initial.audioDockRect.height}px)`);
      assert.equal(initial.titleKickerDisplay, "", `${viewport.name}: staff heading remains before the logo`);
      assert.equal(initial.creditsHeadingDisplay, "block", `${viewport.name}: staff heading is missing before the credits`);
      assert.equal(initial.creditsHeadingText, "STAFF & CREDITS", `${viewport.name}: staff heading copy changed`);
      assert.equal(initial.creditsHeadingBeforeFirstCredit, true, `${viewport.name}: staff heading is not before the first credit`);
    } else {
      assert.equal(initial.titleKickerDisplay, "", `${viewport.name}: staff heading remains before the desktop logo`);
      assert.equal(initial.creditsHeadingDisplay, "block", `${viewport.name}: staff heading is missing before the desktop credits`);
      assert.equal(initial.creditsHeadingText, "STAFF & CREDITS", `${viewport.name}: desktop staff heading copy changed`);
      assert.equal(initial.creditsHeadingBeforeFirstCredit, true, `${viewport.name}: desktop staff heading is not before the first credit`);
    }
    assert.match(initial.audioDockBackground, /rgba?\(255, 255, 252(?:, 0\.94)?\)/u, `${viewport.name}: staff-roll audio control is not white (${initial.audioDockBackground})`);
    assert.match(initial.audioToggleColor, /rgba?\(19, 67, 76(?:, 0\.92)?\)/u, `${viewport.name}: staff-roll audio icon is not dark on white (${initial.audioToggleColor})`);
    assert.match(initial.stageBackground, /01-turning-in-the-sunset\.webp/u);
    assert.equal(initial.titleHeading, "惑星の放課後 — GAIA SENSATION", `${viewport.name}: staff-roll logo has no accessible title`);
    assert.equal(initial.titleLogoCount, 1, `${viewport.name}: staff-roll title logo count is incorrect`);
    assert.equal(initial.titleLogoSrc, "./assets/brand/brand-logo-light-surface.png", `${viewport.name}: staff-roll title does not use the light-surface logo`);
    await page.waitForFunction(() => {
      const logo = document.querySelector(".novel-staff-roll-title-logo");
      return Boolean(logo?.complete && logo.naturalWidth === 2172 && logo.naturalHeight === 724);
    }, null, { timeout: 30_000 });
    const loadedTitle = await scanEnding(page);
    assert.equal(loadedTitle.titleLogoLoaded, true, `${viewport.name}: staff-roll title logo failed to load`);
    assert(loadedTitle.titleLogoRect?.width > 0 && loadedTitle.titleLogoRect?.height > 0, `${viewport.name}: staff-roll title logo has no visible size`);
    assert(loadedTitle.titleLogoRect.left >= 0 && loadedTitle.titleLogoRect.right <= viewport.width, `${viewport.name}: staff-roll title logo overflows the viewport`);
    const titleToCreditTiming = await page.locator(".novel-staff-roll-track").evaluate((node) => {
      const title = node.closest(".novel-staff-roll-stage").querySelector(".novel-staff-roll-title");
      const titleAnimation = title.getAnimations()[0];
      const firstCredit = node.querySelector(".novel-staff-roll-credit");
      if (!titleAnimation || !firstCredit) throw new Error("staff-roll timing targets were not found");
      // Linear roll: distance to the first credit divided by total track height.
      // Do not seek backwards across the intro delay: CSS emits reverse events.
      const style = getComputedStyle(node);
      const duration = Number.parseFloat(style.animationDuration) * 1_000;
      const delay = Number.parseFloat(style.animationDelay) * 1_000;
      const trackRect = node.getBoundingClientRect();
      const creditOffset = firstCredit.getBoundingClientRect().top - trackRect.top;
      return { time: delay + duration * creditOffset / trackRect.height, logoEndTime: titleAnimation.effect.getComputedTiming().endTime };
    });
    assert(titleToCreditTiming, `${viewport.name}: first staff name never entered the viewport`);
    assert(titleToCreditTiming.time >= titleToCreditTiming.logoEndTime, `${viewport.name}: staff names began before the logo faded out`);
    assert(titleToCreditTiming.time >= 17_600 && titleToCreditTiming.time < 21_400, `${viewport.name}: unexpected title-to-credit gap`);
    initial.titleToCreditTiming = titleToCreditTiming;
    [
      "企画・原案",
      "ORIGINAL CONCEPT & PLANNING",
      "総合調整",
      "THE ARCHITECT",
      "脚本",
      "SCENARIO",
      "アートディレクター",
      "ART DIRECTOR",
      "テクニカルディレクター",
      "TECHNICAL DIRECTOR",
      "キャラクター原案",
      "CHARACTER CONCEPT",
      "アシスタント",
      "ASSISTANT",
      "OpenAI Codex (Code Implementation)",
      "OpenAI ImageGen (Visual Assets)",
      "Suno AI (Music Composition)",
      "音楽",
      "オープニングテーマ",
      "『Planet Forecast - Hope』",
      "エンディングテーマ",
      "『AfterSchool, AfterGlow』",
      "学術的着想",
      "ACADEMIC INSPIRATION",
      "ZEN大学『共創地球論』",
      "ZEN大学『人新世の人類学』",
      "ZEN大学『統計学入門』",
      "ZEN大学『リテラシーと応用のための物語理論』",
      "観測データ",
      "DATA SOURCES",
      "JAXA / NASA / NOAA",
      "気象庁 / 総務省 ほか",
      "物語は、ここからも続いていく。",
      "© 2026 惑星の放課後 / GAIA SENSATION",
    ].forEach((text) => {
      assert(initial.text.includes(text), `${viewport.name}: missing credit ${text}`);
    });
    assert.equal(initial.text.includes("AI開発支援"), false, `${viewport.name}: obsolete AI開発支援 credit remains`);
    assert.equal(initial.text.includes("AI DEVELOPMENT SUPPORT"), false, `${viewport.name}: obsolete AI DEVELOPMENT SUPPORT credit remains`);
    assert.equal(initial.text.includes("開発支援"), false, `${viewport.name}: obsolete 開発支援 credit remains`);
    assert.equal(initial.text.includes("DEVELOPMENT SUPPORT"), false, `${viewport.name}: obsolete DEVELOPMENT SUPPORT credit remains`);
    assert.equal(initial.text.includes("データ提供"), false, `${viewport.name}: obsolete データ提供 credit remains`);
    assert.equal(initial.text.includes("HTML / CSS / JavaScript"), false, `${viewport.name}: implementation note remains in staff credits`);
    assert.equal(initial.creditRows.length, 10, `${viewport.name}: unexpected staff credit row count`);
    initial.creditRows.slice(0, 6).forEach(row => assert.deepEqual(row.names, ["ひなひな"]));
    initial.creditRows.forEach((row) => {
      assert.equal(row.textAlign, "center", `${viewport.name}: ${row.role} is not center aligned`);
      assert(row.rowCenterDelta <= 1, `${viewport.name}: ${row.role} row is off center by ${row.rowCenterDelta}px`);
      assert(row.termCenterDelta <= 1, `${viewport.name}: ${row.role} label is off center by ${row.termCenterDelta}px`);
      assert(row.descriptionCenterDelta <= 1, `${viewport.name}: ${row.role} name is off center by ${row.descriptionCenterDelta}px`);
      assert(row.dividerClearance >= 8, `${viewport.name}: ${row.role} divider overlaps its names (${row.dividerClearance}px clearance)`);
    });
    const originalCharacterCredit = initial.creditRows.find((row) => row.role === "CHARACTER CONCEPT");
    assert.deepEqual(originalCharacterCredit?.names, ["ひなひな"], `${viewport.name}: original character concept credit is incorrect`);
    const aiCredit = initial.creditRows.find((row) => row.role === "ASSISTANT");
    assert.deepEqual(aiCredit?.names, [
      "OpenAI Codex (Code Implementation)",
      "OpenAI ImageGen (Visual Assets)",
      "Suno AI (Music Composition)",
    ], `${viewport.name}: AI assistance credit is incorrect`);
    assert.deepEqual(aiCredit?.nameLines, [1, 1, 1], `${viewport.name}: an AI assistance credit wrapped onto multiple lines`);
    assert.equal(aiCredit?.nameOverflow, false, `${viewport.name}: AI assistance text overflows the credit width`);
    const musicCredit = initial.creditRows.find((row) => row.role === "MUSIC");
    assert.deepEqual(musicCredit?.names, [
      "オープニングテーマ『Planet Forecast - Hope』",
      "エンディングテーマ『AfterSchool, AfterGlow』",
    ], `${viewport.name}: music credit wording or order is incorrect`);
    assert.equal(musicCredit?.nameOverflow, false, `${viewport.name}: music credit overflows horizontally`);
    assert.deepEqual(musicCredit?.musicTracks.map(({ label, title }) => ({ label, title })), [
      { label: "オープニングテーマ", title: "『Planet Forecast - Hope』" },
      { label: "エンディングテーマ", title: "『AfterSchool, AfterGlow』" },
    ], `${viewport.name}: music theme labels and titles are not split into separate lines`);
    musicCredit?.musicTracks.forEach((track) => {
      assert.equal(track.titleLines, 1, `${viewport.name}: ${track.title} wrapped inside its title line`);
      assert.equal(track.titleOverflow, false, `${viewport.name}: ${track.title} does not fit the credit width`);
    });
    const academicCredit = initial.creditRows.find((row) => row.role === "ACADEMIC INSPIRATION");
    assert.deepEqual(academicCredit?.names, [
      "ZEN大学『共創地球論』",
      "ZEN大学『人新世の人類学』",
      "ZEN大学『リテラシーと応用のための物語理論』",
      "ZEN大学『統計学入門』",
      "ZEN大学『ビッグデータ分析概論』",
    ], `${viewport.name}: academic credits differ from the owner's list`);
    assert.deepEqual(academicCredit?.nameLines, [1, 1, 1, 1, 1], `${viewport.name}: a reference lecture wrapped onto multiple lines`);
    assert.equal(academicCredit?.nameOverflow, false, `${viewport.name}: reference lecture text overflows the credit width`);
    assert.equal(initial.overflowX, 0);
    assert.equal(initial.overflowY, 0);
    assert.equal(initial.bodyOverflowX, 0);

    const whiteoutOpacity = await page.locator(".novel-staff-roll-whiteout").evaluate((node) => {
      const animation = node.getAnimations().find((candidate) => candidate.animationName === "novel-staff-roll-whiteout");
      if (animation) {
        animation.pause();
        animation.currentTime = 3_800;
      }
      return Number(getComputedStyle(node).opacity);
    });
    assert(whiteoutOpacity >= 0.8, `${viewport.name}: whiteout never covered the finale (${whiteoutOpacity})`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-whiteout.png`) });
    await page.locator(".novel-staff-roll-whiteout").evaluate((node) => {
      node.getAnimations().find((candidate) => candidate.animationName === "novel-staff-roll-whiteout")?.play();
    });

    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "ending", null, { timeout: 6_500 });
    const playbackBeforeToggle = await page.evaluate(() => globalThis.GaiaOpeningAudio?.getPlaybackState?.());
    if (!playbackBeforeToggle?.playing || playbackBeforeToggle.muted) {
      await page.evaluate(() => globalThis.GaiaOpeningAudio?.setVolume?.(0.1, 0));
      await page.locator("#gaia-audio-toggle").click();
      await page.waitForTimeout(120);
      const playbackAfterExpand = await page.evaluate(() => globalThis.GaiaOpeningAudio?.getPlaybackState?.());
      if (!playbackAfterExpand?.playing || playbackAfterExpand.muted) {
        await page.locator("#gaia-audio-toggle").click();
      }
    }
    await page.waitForFunction(() => {
      const playback = globalThis.GaiaOpeningAudio?.getPlaybackState?.();
      return playback?.track === "ending" && playback.playing && !playback.muted && playback.duration > 0;
    }, null, { timeout: 10_000 });
    const endingPlayback = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    const endingTrack = await page.evaluate(() => globalThis.GaiaOpeningAudio.getState().track);
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "rolling", null, { timeout: 22_000 });
    const beforeY = await page.locator(".novel-staff-roll-track").evaluate((node) => node.getBoundingClientRect().y);
    await page.waitForTimeout(650);
    const afterY = await page.locator(".novel-staff-roll-track").evaluate((node) => node.getBoundingClientRect().y);
    assert(afterY < beforeY - 2, `${viewport.name}: credits did not move upward (${beforeY} -> ${afterY})`);
    assert(report.audioResponses.some((response) => response.label === viewport.name && response.url.endsWith("/assets/audio/after-school-afterglow.mp3") && [200, 206].includes(response.status)), `${viewport.name}: AfterSchool,AfterGlow was not requested`);
    assert(!report.audioResponses.some((response) => response.label === viewport.name && response.url.endsWith("/assets/audio/planet-forecast-first-light.mp3")), `${viewport.name}: previous ending track is still requested`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-rolling.png`) });

    const stepBeforeBackgroundClick = await page.locator("#novel-layer").getAttribute("data-step-id");
    await page.locator(".novel-staff-roll-stage").click({
      position: { x: viewport.width / 2, y: viewport.height / 2 },
    });
    await page.waitForTimeout(180);
    const afterBackgroundClick = await scanEnding(page);
    assert.equal(afterBackgroundClick.phase, "rolling", `${viewport.name}: background click skipped the staff roll`);
    assert.equal(afterBackgroundClick.buttonHidden, true, `${viewport.name}: background click revealed the final action`);
    assert.equal(await page.locator("#novel-layer").getAttribute("data-step-id"), stepBeforeBackgroundClick, `${viewport.name}: background click advanced the story`);

    await page.locator(".novel-staff-roll").focus();
    await page.keyboard.down("Control");
    await page.waitForTimeout(900);
    const controlHoldOnly = await scanEnding(page);
    assert.equal(controlHoldOnly.phase, "rolling", `${viewport.name}: Control hold skipped the staff roll`);
    assert.equal(controlHoldOnly.stepId, stepBeforeBackgroundClick, `${viewport.name}: Control hold advanced the hidden story step`);
    assert.equal(controlHoldOnly.fastForwarding, false, `${viewport.name}: Control hold activated normal-story fast-forward during the staff roll`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    const controlAttempt = await scanEnding(page);
    assert.equal(controlAttempt.phase, "rolling", `${viewport.name}: Control skipped the staff roll`);
    assert.equal(controlAttempt.buttonHidden, true, `${viewport.name}: Control revealed the final action`);
    assert.equal(controlAttempt.fastForwarding, false, `${viewport.name}: normal-story Control fast-forward leaked into the staff roll`);
    await page.keyboard.up("Control");

    await page.locator(".novel-staff-roll-track").evaluate((node) => {
      const animation = node.getAnimations().find((candidate) => candidate.animationName === "novel-staff-roll-rise") || node.getAnimations()[0];
      if (!animation) throw new Error("staff roll animation was not found");
      animation.pause();
      animation.currentTime = 34_000;
    });
    await page.waitForTimeout(80);
    const creditsFrame = await scanEnding(page);
    creditsFrame.creditRows.forEach((row) => {
      assert(row.rowCenterDelta <= 1, `${viewport.name}: ${row.role} shifted off center during the roll`);
      assert(row.dividerClearance >= 8, `${viewport.name}: ${row.role} divider overlaps its names during the roll (${JSON.stringify(row)})`);
    });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-credits.png`) });
    await page.locator(".novel-staff-roll-track").evaluate((node) => {
      const animation = node.getAnimations().find((candidate) => candidate.animationName === "novel-staff-roll-rise") || node.getAnimations()[0];
      animation.currentTime = 50_000;
    });
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-credits-late.png`) });

    await page.locator(".novel-staff-roll-track").evaluate((node) => {
      const animation = node.getAnimations().find((candidate) => candidate.animationName === "novel-staff-roll-rise") || node.getAnimations()[0];
      if (!animation) throw new Error("staff roll animation was not found at completion");
      animation.pause();
      animation.currentTime = (Number.parseFloat(getComputedStyle(node).animationDuration) + Number.parseFloat(getComputedStyle(node).animationDelay)) * 1_000;
      node.dispatchEvent(new AnimationEvent("animationend", { animationName: "novel-staff-roll-rise" }));
    });
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "end-hold");
    const holdObservedAt = Date.now();
    const endHold = await scanEnding(page);
    assert.equal(endHold.buttonHidden, true, `${viewport.name}: final action appeared before the thank-you hold`);
    assert.equal(endHold.closingMarkAnimation, "none", `${viewport.name}: thank-you appeared before the pause`);
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "thank-you");
    await page.waitForTimeout(1800);
    const thankYou = await scanEnding(page);
    assert.equal(thankYou.buttonHidden, true, `${viewport.name}: final action appeared with the thank-you reveal`);
    assert.deepEqual(thankYou.closingWords.map((word) => word.text), ["Thank", "you", "for", "playing"]);
    assert(thankYou.closingWords.every((word) => word.animation === "novel-staff-roll-thank-you-word" && word.opacity === 1));
    assert(thankYou.copyrightGap >= 8 && thankYou.copyrightGap <= 20, `${viewport.name}: copyright is not directly below the revealed Thank you for playing (${thankYou.copyrightGap}px)`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-thank-you.png`) });
    await page.waitForTimeout(Math.max(0, 4_650 - (Date.now() - holdObservedAt)));
    const beforeFinale = await scanEnding(page);
    assert.equal(beforeFinale.phase, "thank-you", `${viewport.name}: thank-you hold was shorter than intended`);
    assert.equal(beforeFinale.buttonHidden, true, `${viewport.name}: final action appeared during the thank-you hold`);
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "finalizing", null, { timeout: 750 });
    const finalizing = await scanEnding(page);
    assert.equal(finalizing.buttonHidden, true, `${viewport.name}: final action appeared before the dissolve finished`);
    assert.equal(finalizing.closingMarkAnimation, "novel-staff-roll-mark-dissolve");
    assert.equal(finalizing.closingActionFlashAnimation, "novel-staff-roll-thank-you-line-out");
    assert.equal(finalizing.closingActionFlashDuration, "0.64s");
    await page.waitForTimeout(110);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-dissolve.png`) });
    await page.waitForFunction(() => document.querySelector(".novel-staff-roll")?.dataset.phase === "complete", null, { timeout: 1_000 });
    await page.waitForTimeout(480);
    const completed = await scanEnding(page);
    assert.equal(completed.buttonHidden, false);
    assert.equal(completed.buttonText, "世界の続きを紡ぐ");
    assert.match(completed.buttonAriaLabel, /APEIRONCENE/u);
    assert(completed.buttonHeight >= 44, `${viewport.name}: END action hit area is under 44px`);
    assert(completed.buttonMarkCenterDelta <= 3, `${viewport.name}: final action did not replace the thank-you mark in place (${completed.buttonMarkCenterDelta}px)`);
    assert.match(completed.buttonBackground, /rgba\(2, 10, 16, 0\.92\)/u, `${viewport.name}: final action is not dark (${completed.buttonBackground})`);
    assert.equal(completed.overflowX, 0);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-complete.png`), animations: "disabled" });

    await page.evaluate(() => {
      const layer = document.querySelector("#novel-layer");
      const trace = { phases: [], noise: [] };
      globalThis.__endingTransitionTrace = trace;
      const nativeSetTimeout = window.setTimeout;
      window.setTimeout = function (callback, delay, ...args) {
        if (typeof callback === "function" && callback.name === "switchToTrueEnd") {
          return nativeSetTimeout.call(this, function (...parameters) {
            // MutationObserver runs after synchronous scene construction. Capture
            // the actual timer callback entry to separate readiness work from FX.
            trace.switchStartedAt = performance.now();
            return callback.apply(this, parameters);
          }, delay, ...args);
        }
        return nativeSetTimeout.call(this, callback, delay, ...args);
      };
      const observer = new MutationObserver(() => {
        const phase = layer.dataset.trueEndTransitionPhase;
        if (phase && trace.phases.at(-1)?.phase !== phase) trace.phases.push({ phase, time: performance.now() });
        if (phase === "complete") {
          observer.disconnect();
          window.setTimeout = nativeSetTimeout;
        }
      });
      observer.observe(layer, { attributes: true, attributeFilter: ["data-true-end-transition-phase"] });
      const sample = () => {
        const veil = layer.querySelector(".novel-staff-roll-transition-veil");
        const noise = veil?.querySelector(".novel-staff-roll-transition-noise");
        if (noise) trace.noise.push({
          phase: layer.dataset.trueEndTransitionPhase,
          opacity: Number(getComputedStyle(noise).opacity),
          transform: getComputedStyle(noise).transform,
          bandTransform: getComputedStyle(veil, "::before").transform,
          dropoutTransform: getComputedStyle(veil, "::after").transform,
          signature: getComputedStyle(veil).getPropertyValue("--glitch-noise-x1") + getComputedStyle(veil).getPropertyValue("--glitch-bands-x2"),
          bandOpacity: Number(getComputedStyle(veil, "::before").opacity),
          veilOpacity: Number(getComputedStyle(veil).opacity),
        });
        if (layer.dataset.trueEndTransitionPhase !== "complete") requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.locator(".novel-staff-roll-finale button").click();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.trueEndTransitionPhase === "covering");
    const transitionStartedAt = Date.now();
    const departure = await scanEnding(page);
    assert.equal(departure.phase, "departing", `${viewport.name}: transition did not enter departing state`);
    assert.equal(departure.buttonDisabled, true, `${viewport.name}: final action remained enabled during transition`);
    assert.equal(departure.transitionVeilCount, 1, `${viewport.name}: transition veil was not mounted exactly once`);
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.trueEndTransitionPhase === "holding", null, { timeout: 2_000 });
    const transitionHoldObservedAt = Date.now();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.trueEndTransitionPhase === "switching");
    const switchObservedAt = Date.now();
    await page.waitForFunction(() => Boolean(document.querySelector(".true-end-shell")));
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.trueEndTransitionPhase === "revealing", null, { timeout: 8_000 });
    const revealObservedAt = Date.now();
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.trueEndTransitionPhase === "background", null, { timeout: 6_000 });
    const backgroundFullyVisibleAt = Date.now();
    const backgroundOnly = await scanTrueEndDestination(page);
    assert.equal(backgroundOnly.entryPhase, "background", `${viewport.name}: message interface appeared before the background reveal completed`);
    assert.equal(backgroundOnly.sectionTransitionPhase, "idle", `${viewport.name}: hidden APEIRONCENE scene card delayed the background reveal`);
    assert.equal(backgroundOnly.message, "", `${viewport.name}: first message started behind the black veil`);
    assert.equal(backgroundOnly.dialogueVisibility, "hidden", `${viewport.name}: message window was visible after the background finished revealing`);
    // The 120ms background-only beat is verified above. Encoding a full-device
    // PNG during that beat can stall the renderer and delay the timer under test.
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.trueEndTransitionPhase === "complete", null, { timeout: 2_000 });
    const transitionCompletedAt = Date.now();
    assert(transitionHoldObservedAt - transitionStartedAt >= 150, `${viewport.name}: APEIRONCENE cover was too short (${transitionHoldObservedAt - transitionStartedAt}ms)`);
    assert(switchObservedAt - transitionHoldObservedAt >= 180, `${viewport.name}: full-black APEIRONCENE hold was too short (${switchObservedAt - transitionHoldObservedAt}ms)`);
    assert(switchObservedAt - transitionStartedAt >= 365, `${viewport.name}: APEIRONCENE entry was shorter than its double-speed target`);
    assert(backgroundFullyVisibleAt - revealObservedAt >= 825, `${viewport.name}: APEIRONCENE background reveal was too short (${backgroundFullyVisibleAt - revealObservedAt}ms)`);
    assert(transitionCompletedAt - backgroundFullyVisibleAt >= 65, `${viewport.name}: completed background did not hold before the message (${transitionCompletedAt - backgroundFullyVisibleAt}ms)`);
    const transitionTrace = await page.evaluate(() => globalThis.__endingTransitionTrace);
    const phaseTime = (phase) => transitionTrace.phases.find((entry) => entry.phase === phase)?.time;
    assert(Number.isFinite(transitionTrace.switchStartedAt), "Scene-switch timer entry was not observed");
    const choreographyMs = (transitionTrace.switchStartedAt - phaseTime("covering")) + (phaseTime("complete") - phaseTime("revealing"));
    (report.transitionTraces ||= []).push({ viewport: viewport.name, ...transitionTrace, choreographyMs });
    // Owner extended the reveal from 900 to 2700 ms on 2026-09-10.
    assert(choreographyMs >= 3230 && choreographyMs < 3650, `${viewport.name}: transition differs from the extended reveal (${choreographyMs}ms excluding asset readiness)`);
    for (const phase of ["covering", "revealing"]) {
      const noisyFrames = transitionTrace.noise.filter((frame) => frame.phase === phase && frame.opacity > 0.1);
      assert(noisyFrames.length >= 2, `${viewport.name}: missing noise burst during ${phase}`);
      assert(new Set(noisyFrames.map((frame) => frame.transform)).size >= 2, `${viewport.name}: noise tile did not move during ${phase}`);
      assert(noisyFrames.some((frame) => frame.bandOpacity > 0.2), `${viewport.name}: missing colored tear bands`);
      for (const frame of noisyFrames) for (const transform of [frame.transform, frame.bandTransform, frame.dropoutTransform]) {
        if (transform === "none") continue;
        const components = transform.match(/matrix\(([^)]+)\)/u)?.[1].split(",").map(Number);
        assert(components && Math.abs(components[5]) < .001, `${viewport.name}: glitch moved vertically: ${transform}`);
      }
    }
    assert.notEqual(transitionTrace.noise.find(frame => frame.phase === "covering")?.signature,
      transitionTrace.noise.find(frame => frame.phase === "revealing")?.signature, "Entry and reveal reuse the same noise burst");
    assert(transitionTrace.noise.filter((frame) => frame.phase === "holding").every((frame) => frame.opacity === 0 && frame.bandOpacity === 0), `${viewport.name}: the black hold did not settle`);
    initial.transitionTrace = { ...transitionTrace, choreographyMs };
    assert.equal(await page.locator(".novel-staff-roll-transition-veil").count(), 0, `${viewport.name}: transition veil remained after completion`);
    await page.waitForFunction(() => {
      const shell = document.querySelector(".true-end-shell");
      return shell?.dataset.entryPhase === "ready" && Boolean(document.querySelector(".true-end-message")?.textContent);
    }, null, { timeout: 2_000 });
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().clear === true && globalThis.GaiaNovel.getState().archivesUnlocked === true);
    await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "trueend", null, { timeout: 6_500 });
    await page.waitForFunction(() => {
      const playback = globalThis.GaiaOpeningAudio?.getPlaybackState?.();
      return playback?.track === "trueend" && playback.playing && !playback.muted && playback.duration === 72;
    }, null, { timeout: 10_000 });
    const trueEndPlayback = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    const trueEndDestination = await scanTrueEndDestination(page);
    assert.equal(trueEndDestination.trueEndVisible, true, `${viewport.name}: credits did not open the true ending`);
    assert.equal(trueEndDestination.layerActive, true);
    assert.equal(trueEndDestination.scene, "after-ending");
    assert.equal(trueEndDestination.heading, "こどもと魔法");
    assert(trueEndDestination.dialogueHeight >= 44, `${viewport.name}: true-end dialogue hit area is under 44px`);
    assert.equal(trueEndDestination.clear, true);
    assert.equal(trueEndDestination.archivesUnlocked, true);
    assert.equal(trueEndDestination.savedClear, true);
    assert.equal(trueEndDestination.savedArchivesUnlocked, true);
    assert.equal(trueEndDestination.audioTrack, "trueend");
    assert.equal(trueEndDestination.overflowX, 0);
    assert.equal(trueEndDestination.overflowY, 0);
    assert(report.audioResponses.some((response) => response.label === viewport.name && response.url.endsWith("/assets/audio/sensory-horizon.wav") && [200, 206].includes(response.status)), `${viewport.name}: dedicated true-end score was not requested`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-true-end.png`), animations: "disabled" });
    let trueEndExit = null;
    if (viewport.name === "mobile-390") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (let scene = 0; scene < 3; scene += 1) {
        const priorScene = await page.locator(".true-end-shell").getAttribute("data-scene");
        await page.locator(".true-end-skip-button").click();
        if (scene < 2) {
          await page.waitForFunction((previous) => document.querySelector(".true-end-shell")?.dataset.scene !== previous, priorScene);
        }
      }
      await page.locator(".true-end-finale:not([hidden])").waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => Boolean(localStorage.getItem("gaiaSensewareTrueEnd:complete:v1"))), true, `${viewport.name}: APEIRONCENE completion was not persisted`);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.locator(".true-end-finale button").click();
      await page.waitForFunction(() => document.querySelector(".true-end-exit-veil")?.dataset.phase === "covering");
      await page.waitForFunction(() => document.querySelector(".true-end-exit-veil")?.dataset.phase === "white", null, { timeout: 4_000 });
      const revealObserved = page.waitForFunction(() => {
        const intro = document.querySelector("#intro-layer");
        return document.querySelector(".true-end-exit-veil")?.dataset.phase === "revealing"
          && intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false";
      }, null, { timeout: 6_000 }).then(() => ({ observed: true })).catch(async () => ({
        observed: false,
        state: await page.evaluate(() => {
          const intro = document.querySelector("#intro-layer");
          return {
            phase: document.querySelector(".true-end-exit-veil")?.dataset.phase || "missing",
            introHidden: intro?.hidden,
            introAriaHidden: intro?.getAttribute("aria-hidden"),
            novelAriaHidden: document.querySelector("#novel-layer")?.getAttribute("aria-hidden"),
            bodyClass: document.body.className,
          };
        }),
      }));
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-true-end-exit-white.png`) });
      const revealResult = await revealObserved;
      assert.equal(revealResult.observed, true, `${viewport.name}: true-end reveal was not observed (${JSON.stringify(revealResult.state)})`);
      trueEndExit = await page.evaluate(() => {
        const storyReturn = document.querySelector(".intro-story-return[data-primary-action='true']");
        return {
          phase: document.querySelector(".true-end-exit-veil")?.dataset.phase || "complete",
          label: storyReturn?.querySelector("strong")?.textContent?.trim() || "",
          destination: storyReturn?.dataset.storyDestination || "",
          novelHidden: document.querySelector("#novel-layer")?.getAttribute("aria-hidden") === "true",
        };
      });
      assert(["revealing", "complete"].includes(trueEndExit.phase), `${viewport.name}: GAIA page appeared without the white-to-clear fade`);
      assert.equal(trueEndExit.label, "物語をはじめる", `${viewport.name}: GAIA story button did not reset after APEIRONCENE`);
      assert.equal(trueEndExit.destination, "story", `${viewport.name}: completed APEIRONCENE remained the story destination`);
      assert.equal(trueEndExit.novelHidden, true, `${viewport.name}: APEIRONCENE layer remained active after exit`);
    }
    report.scans.push({ viewport: viewport.name, initial, whiteoutOpacity, endingTrack, endingPlayback, beforeY, afterY, afterBackgroundClick, controlAttempt, endHold, beforeFinale, completed, transition: { transitionStartedAt, holdObservedAt: transitionHoldObservedAt, switchObservedAt, revealObservedAt, backgroundFullyVisibleAt, transitionCompletedAt, backgroundOnly }, trueEndPlayback, trueEndDestination, trueEndExit, passed: true });
    await context.close();
  }

  const reducedContext = await browser.newContext({
    viewport: viewports[1],
    reducedMotion: "reduce",
    deviceScaleFactor: 3,
  });
  const reducedPage = await reducedContext.newPage();
  attachDiagnostics(reducedPage, "mobile-390-reduced");
  await bootAtEnding(reducedPage, true);
  const reduced = await scanEnding(reducedPage);
  assert.equal(reduced.phase, "complete");
  assert.equal(reduced.trackAnimation, "none");
  assert.equal(reduced.buttonHidden, false);
  assert.equal(reduced.skipHintCount, 0);
  assert.equal(reduced.buttonText, "世界の続きを紡ぐ");
  assert.match(reduced.buttonAriaLabel, /APEIRONCENE/u);
  assert(reduced.buttonHeight >= 44);
  assert.equal(reduced.overflowX, 0);
  await reducedPage.screenshot({ path: path.join(outputDir, "mobile-390-reduced.png"), animations: "disabled" });
  await reducedPage.locator(".novel-staff-roll-finale button").click();
  await reducedPage.waitForFunction(() => Boolean(document.querySelector(".true-end-shell")));
  await reducedPage.waitForFunction(() => {
    const shell = document.querySelector(".true-end-shell");
    return shell?.dataset.entryPhase === "ready" && Boolean(document.querySelector(".true-end-message")?.textContent);
  });
  const reducedTrueEndDestination = await scanTrueEndDestination(reducedPage);
  assert.equal(reducedTrueEndDestination.trueEndVisible, true);
  assert.equal(reducedTrueEndDestination.layerActive, true);
  assert.equal(reducedTrueEndDestination.scene, "after-ending");
  assert.equal(reducedTrueEndDestination.clear, true);
  assert.equal(reducedTrueEndDestination.savedClear, true);
  assert.equal(reducedTrueEndDestination.overflowX, 0);
  assert.equal(reducedTrueEndDestination.overflowY, 0);
  report.reducedMotion = { ...reduced, trueEndDestination: reducedTrueEndDestination, passed: true };
  await reducedContext.close();

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

console.log(`Ending staff roll browser check passed: ${report.scans.length} animated viewports + reduced motion`);
