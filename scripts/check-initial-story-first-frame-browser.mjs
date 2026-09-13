import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4423"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/initial-story-first-frame-hotfix");
fs.mkdirSync(outputDir, { recursive: true });

const START_BACKGROUND = "novel-bg-convention-hall-entrance-autumn-morning-v2.png";
const EXHIBITION = "novel-bg-exhibition-v3.png";
const progressFixture = (stepId) => ({
  storyVersion: 13,
  stepId,
  reachedSceneIds: ["festival_concept"],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  audio: { muted: true, volume: 0.3 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "initial-story-first-frame-qa",
  unknownLocalField: { preserved: true },
});
const viewports = [
  { name: "pc-2048", width: 2048, height: 1030 },
  { name: "pc-1920", width: 1920, height: 1000 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
];
const report = {
  status: "running",
  baseUrl,
  viewports,
  scans: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
const focus = process.env.GAIA_FOCUS || "";
const browser = await chromium.launch({ headless: true, executablePath });

const attachMonitoring = async (page, label) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
  await page.addInitScript(() => {
    globalThis.__qaVisible = (element) => {
      if (!element || element.hidden || element.closest("[hidden]")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0
        && rect.width > 0 && rect.height > 0;
    };
    globalThis.__qaFrames = [];
    globalThis.__qaTitleFrames = 0;
    globalThis.__qaRevealEvents = 0;
    window.addEventListener("gaia:novel-runtime-revealed", () => { globalThis.__qaRevealEvents += 1; }, true);
    const sample = (time) => {
      const layer = document.querySelector("#novel-layer");
      const runtime = document.querySelector("#novel-runtime");
      const title = document.querySelector("#novel-title-screen");
      if (layer && __qaVisible(title)) globalThis.__qaTitleFrames += 1;
      if (layer && __qaVisible(runtime)) {
        const style = getComputedStyle(layer);
        globalThis.__qaFrames.push({
          time,
          stepId: layer.dataset.stepId || "",
          cueId: layer.dataset.backgroundCue || "",
          backgroundImage: style.backgroundImage,
          reveal: layer.dataset.runtimeReveal || "",
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  return requests;
};

const createPage = async (viewport, label, cacheDisabled = false, reducedMotion = "reduce") => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: Boolean(viewport.mobile),
    isMobile: Boolean(viewport.mobile),
    reducedMotion,
  });
  const page = await context.newPage();
  const requests = await attachMonitoring(page, label);
  if (cacheDisabled) {
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  }
  return { context, page, requests };
};

const openRuntime = async (page, seed = null) => {
  if (seed) {
    await page.addInitScript(({ progress, manual, config, clear, trueEndReached }) => {
      if (clear) localStorage.clear();
      if (progress) localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
      if (manual) localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify(manual));
      if (config) localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify(config));
      if (trueEndReached) localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", "qa-reached");
    }, seed);
  }
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.runtimeReveal === "revealed");
};

const scanRuntime = async (page) => page.evaluate(async ({ startBackground, exhibition }) => {
  const layer = document.querySelector("#novel-layer");
  const runtime = document.querySelector("#novel-runtime");
  const source = getComputedStyle(layer).backgroundImage;
  const image = new Image();
  image.src = source.match(/url\(["']?([^"')]+)/u)?.[1] || "";
  await image.decode();
  return {
    stepId: layer.dataset.stepId,
    cueId: layer.dataset.backgroundCue,
    backgroundImage: source,
    backgroundHasStart: source.includes(startBackground),
    backgroundHasExhibition: source.includes(exhibition),
    decodedNaturalWidth: image.naturalWidth,
    frames: globalThis.__qaFrames.slice(),
    revealEvents: globalThis.__qaRevealEvents,
    titleFrames: globalThis.__qaTitleFrames,
    runtimeVisible: __qaVisible(runtime),
    runtimeVisibleCount: [...document.querySelectorAll("#novel-runtime")].filter(__qaVisible).length,
    titleVisible: __qaVisible(document.querySelector("#novel-title-screen")),
    openingVisible: __qaVisible(document.querySelector("#gaia-opening")),
    introVisible: __qaVisible(document.querySelector("#intro-layer")),
    focusedOpening: Boolean(document.activeElement?.closest("#gaia-opening,#intro-layer,#novel-title-screen")),
    bodyOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
    bodyOverflowY: document.documentElement.scrollHeight > innerHeight + 1,
    text: document.querySelector("#novel-text")?.textContent.trim(),
  };
}, { startBackground: START_BACKGROUND, exhibition: EXHIBITION });

const assertRuntime = (scan, expectedStep, expectedAsset) => {
  assert.equal(scan.stepId, expectedStep);
  assert(scan.backgroundImage.includes(expectedAsset), JSON.stringify({ expectedAsset, scan }, null, 2));
  assert.equal(scan.backgroundHasExhibition, false);
  assert(scan.decodedNaturalWidth > 0);
  assert(scan.runtimeVisible && scan.runtimeVisibleCount === 1);
  assert(!scan.titleVisible && !scan.openingVisible && !scan.introVisible && !scan.focusedOpening);
  assert(!scan.bodyOverflowX && !scan.bodyOverflowY);
  assert.equal(scan.revealEvents, 1);
  assert.equal(scan.titleFrames, 0);
  assert(scan.frames.length > 0);
  assert(scan.frames.every((frame) => frame.stepId === expectedStep && frame.backgroundImage.includes(expectedAsset)));
  assert(scan.frames.every((frame) => !frame.backgroundImage.includes(EXHIBITION)));
};

const scanFreshStart = async (viewport, cacheMode) => {
  const label = `${viewport.name}-fresh-${cacheMode}`;
  const { context, page, requests } = await createPage(viewport, label, cacheMode === "cold");
  await page.addInitScript(() => localStorage.clear());
  const requestOffset = requests.length;
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.runtimeReveal === "revealed");
  await page.waitForFunction(() => document.querySelector("#novel-text")?.textContent.trim().length > 0);
  await page.waitForTimeout(500);
  const scan = await scanRuntime(page);
  assertRuntime(scan, "festival_concept_001", START_BACKGROUND);
  assert.equal(scan.titleFrames, 0);
  assert(scan.text.includes("画面越しに眺めてきた大学へ"));
  const startRequests = requests.slice(requestOffset);
  assert.equal(
    startRequests.filter((url) => url.includes(EXHIBITION)).length,
    0,
    JSON.stringify(startRequests.filter((url) => url.includes(EXHIBITION)), null, 2),
  );
  assert(startRequests.some((url) => url.includes(START_BACKGROUND)));
  await page.screenshot({ path: path.join(outputDir, `${label}-revealed.png`) });
  report.scans.push({ viewport: viewport.name, case: `fresh-start-${cacheMode}`, requests: {
    startBackground: startRequests.filter((url) => url.includes(START_BACKGROUND)),
    exhibition: startRequests.filter((url) => url.includes(EXHIBITION)),
  }, ...scan, passed: true });
  await context.close();
};

const scanFreshOpeningEntry = async (viewport) => {
  const label = `${viewport.name}-fresh-opening-entry`;
  const { context, page, requests } = await createPage(viewport, label);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaModeLoader));
  const requestOffset = requests.length;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("gaia:novel-open-at-mode", {
    detail: { source: "opening" },
  })));
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.runtimeReveal === "revealed");
  await page.waitForFunction(() => document.querySelector("#novel-text")?.textContent.trim().length > 0);
  await page.waitForTimeout(160);
  const scan = await scanRuntime(page);
  assertRuntime(scan, "festival_concept_001", START_BACKGROUND);
  assert.equal(scan.titleFrames, 0);
  assert(scan.text.includes("画面越しに眺めてきた大学へ"));
  const entryRequests = requests.slice(requestOffset);
  assert.equal(entryRequests.filter((url) => url.includes(EXHIBITION)).length, 0);
  assert(entryRequests.some((url) => url.includes(START_BACKGROUND)));
  await page.screenshot({ path: path.join(outputDir, `${label}-revealed.png`) });
  report.scans.push({ viewport: viewport.name, case: "fresh-opening-entry", ...scan, passed: true });
  await context.close();
};

const scanStoredEntry = async (viewport, kind, stepId, expectedAsset, trueEndReached = false) => {
  const label = `${viewport.name}-${kind}-${stepId}`;
  const { context, page, requests } = await createPage(viewport, label);
  const storageKey = "gaiaSensewareNovel:progress";
  const requestOffset = requests.length;
  if (kind === "resume" || kind === "resume-reached") {
    await openRuntime(page, { clear: true, progress: progressFixture(stepId), trueEndReached });
  } else if (kind === "unknown-fallback") {
    await openRuntime(page, { clear: true, progress: progressFixture("unknown-step-from-old-save") });
  } else {
    const fixture = progressFixture(stepId);
    await openRuntime(page, {
      clear: true,
      manual: [{ progress: fixture, savedAt: Date.now(), meta: { title: "QA" } }],
    });
  }
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.runtimeReveal === "revealed");
  await page.waitForTimeout(120);
  const expectedStep = kind === "unknown-fallback" ? "festival_concept_001" : stepId;
  const scan = await scanRuntime(page);
  assertRuntime(scan, expectedStep, expectedAsset);
  const entryRequests = requests.slice(requestOffset);
  assert.equal(entryRequests.filter((url) => url.includes(EXHIBITION)).length, 0);
  report.scans.push({ viewport: viewport.name, case: `${kind}-${expectedStep}`, storageKey, requests: {
    exhibition: entryRequests.filter((url) => url.includes(EXHIBITION)),
  }, ...scan, passed: true });
  await context.close();
};

const scanDialogue = async (viewport, stepId, screenshot = false) => {
  const label = `${viewport.name}-dialogue-${stepId}`;
  const { context, page } = await createPage(viewport, label, false, "no-preference");
  await openRuntime(page, {
    clear: true,
    progress: progressFixture(stepId),
    config: { messageSpeedPercent: 400, reducedMotion: true },
  });
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForTimeout(160);
  const scan = await page.evaluate(() => {
    const dialogue = document.querySelector("#novel-dialogue");
    const text = document.querySelector("#novel-text");
    const speaker = document.querySelector("#novel-speaker");
    const continueMark = document.querySelector("#novel-continue");
    const toolbar = document.querySelector(".novel-topbar nav");
    const d = dialogue.getBoundingClientRect();
    const t = text.getBoundingClientRect();
    const c = continueMark.getBoundingClientRect();
    const n = toolbar.getBoundingClientRect();
    const pseudo = getComputedStyle(dialogue, "::after");
    const pseudoTop = d.top + Number.parseFloat(pseudo.top || "0");
    const pagination = GaiaNovel.inspectDialoguePagination(
      GAIA_NOVEL_STORY.scenes.flatMap((scene) => scene.steps).find((step) => step.id === document.querySelector("#novel-layer").dataset.stepId).text,
    );
    return {
      stepId: document.querySelector("#novel-layer").dataset.stepId,
      type: document.querySelector("#novel-layer").dataset.stepType,
      text: text.textContent.trim(),
      speakerVisible: __qaVisible(speaker),
      measuredLines: Number(text.dataset.measuredLineCount || 0),
      pages: pagination.pages.length,
      darkGap: t.top - pseudoTop,
      pseudoTop,
      dialogueTop: d.top,
      textRect: t.toJSON(),
      continueRect: c.toJSON(),
      toolbarRect: n.toJSON(),
      textContinueGap: c.top - t.bottom,
      textToolbarOverlap: Math.max(0, Math.min(t.right, n.right) - Math.max(t.left, n.left))
        * Math.max(0, Math.min(t.bottom, n.bottom) - Math.max(t.top, n.top)),
      gradient: pseudo.backgroundImage,
      textFontSize: getComputedStyle(text).fontSize,
      textLineHeight: getComputedStyle(text).lineHeight,
      textTransform: getComputedStyle(text).transform,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  assert.equal(scan.stepId, stepId);
  assert(scan.darkGap >= (viewport.mobile ? 20 : 32));
  assert(scan.measuredLines >= 1 && scan.measuredLines <= 3);
  assert(scan.gradient.includes("linear-gradient"));
  assert(scan.textRect.bottom <= viewport.height + 1);
  assert(scan.textToolbarOverlap === 0);
  assert(!scan.overflowX && !scan.overflowY);
  if (screenshot) await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
  report.scans.push({ viewport: viewport.name, case: `vn-safe-area-${stepId}`, ...scan, passed: true });
  await context.close();
};

const scanMetadata = async (viewport, stepId) => {
  const label = `${viewport.name}-metadata-${stepId}`;
  const { context, page } = await createPage(viewport, label, false, "no-preference");
  await openRuntime(page, { clear: true, progress: progressFixture(stepId) });
  await page.waitForFunction((id) => {
    const layer = document.querySelector("#novel-layer");
    const runtime = document.querySelector("#novel-runtime");
    return layer?.dataset.stepId === id && runtime?.hidden === false;
  }, stepId);
  await page.waitForTimeout(120);
  const scan = await page.evaluate(() => {
    const caption = document.querySelector(".novel-signal-caption");
    const style = getComputedStyle(caption);
    const before = getComputedStyle(caption, "::before");
    const after = getComputedStyle(caption, "::after");
    const strong = getComputedStyle(caption.querySelector("strong"));
    return {
      stepId: document.querySelector("#novel-layer").dataset.stepId,
      backgroundImage: style.backgroundImage,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter,
      beforeDisplay: before.display,
      beforeBorderTop: before.borderTopWidth,
      beforeBorderBottom: before.borderBottomWidth,
      beforeBackground: before.backgroundImage,
      beforeMask: before.maskImage || before.webkitMaskImage,
      afterDisplay: after.display,
      afterContent: after.content,
      afterAnimationName: after.animationName,
      revealClass: caption.classList.contains("is-signal-reveal"),
      textShadow: strong.textShadow,
      rect: caption.getBoundingClientRect().toJSON(),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  assert(scan.backgroundImage.includes("radial-gradient"));
  assert.equal(scan.borderRadius, "0px");
  assert.equal(scan.boxShadow, "none");
  assert(["none", ""].includes(scan.backdropFilter));
  assert.equal(scan.beforeDisplay, "block");
  assert.equal(scan.beforeBorderTop, "1px");
  assert.equal(scan.beforeBorderBottom, "1px");
  assert(scan.beforeBackground.includes("linear-gradient"));
  assert(scan.beforeMask.includes("linear-gradient"));
  assert.equal(scan.afterDisplay, "block");
  assert(scan.afterContent.includes("✦"));
  assert(["novel-signal-glint", "none"].includes(scan.afterAnimationName));
  assert(scan.textShadow.includes("rgba(0, 5, 18, 0.86)"));
  assert(!scan.overflowX && !scan.overflowY);
  await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
  report.scans.push({ viewport: viewport.name, case: `metadata-original-ornament-${stepId}`, ...scan, passed: true });
  await context.close();
};

const scan009to010 = async (viewport) => {
  const label = `${viewport.name}-festival-009-010`;
  const { context, page } = await createPage(viewport, label);
  const progress = progressFixture("festival_concept_009");
  await openRuntime(page, {
    clear: true,
    progress,
    manual: [{
      progress,
      savedAt: 1786982400000,
      meta: { title: "会場案内", excerpt: "操作列のフェード検証" },
    }],
    config: { messageSpeedPercent: 400, reducedMotion: true },
  });
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "festival_concept_009");
  await page.waitForFunction(() => document.querySelector("#novel-text")?.textContent.trim().length > 0);
  await page.waitForTimeout(140);
  const before = await page.evaluate(() => {
    const dialogue = document.querySelector("#novel-dialogue");
    const nav = document.querySelector(".novel-topbar nav");
    const text = document.querySelector("#novel-text");
    const dialogueRect = dialogue.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const pseudo = getComputedStyle(dialogue, "::after");
    const pseudoBottom = dialogueRect.bottom - Number.parseFloat(pseudo.bottom || "0");
    const visibleButtons = [...nav.querySelectorAll(":scope > button")].filter((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return !button.hidden && style.display !== "none" && rect.width > 0 && rect.height > 0;
    });
    return {
      id: document.querySelector("#novel-layer").dataset.stepId,
      text: text.textContent.trim(),
      cue: document.querySelector("#novel-layer").dataset.backgroundCue,
      lines: Math.max(1, Math.round(
        text.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(text).lineHeight),
      )),
      gradient: pseudo.backgroundImage,
      gradientBottom: pseudoBottom,
      navTop: navRect.top,
      navBottom: navRect.bottom,
      navTargetMinimum: Math.min(...visibleButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        return Math.min(rect.width, rect.height);
      })),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert.equal(before.id, "festival_concept_009");
  assert.equal(before.text, "会場案内｜海側広場　学生作品・体験展示");
  assert.equal(before.cue, "festival-b-hall-overview");
  assert(before.lines >= 1 && before.lines <= 3);
  assert(before.gradient.includes("linear-gradient"));
  assert(before.gradientBottom >= before.navBottom, `${label}: message fade ends before the controls`);
  assert(before.navTop < before.gradientBottom, `${label}: controls are outside the message fade`);
  assert(before.navTargetMinimum >= 44, `${label}: control target below 44px`);
  assert(before.overflowX <= 1, `${label}: horizontal overflow`);
  await page.screenshot({ path: path.join(outputDir, `${label}-009.png`) });
  await page.locator("#novel-save-button").click();
  await page.locator("#novel-save-panel").waitFor({ state: "visible" });
  await page.locator("#novel-save-close").click();
  await page.locator("#novel-save-panel").waitFor({ state: "hidden" });
  await page.locator("#novel-dialogue").click();
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "festival_concept_010");
  await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
  const after = await page.evaluate(() => ({
    id: document.querySelector("#novel-layer").dataset.stepId,
    text: document.querySelector("#novel-text")?.textContent.trim(),
    pageIndex: Number(document.querySelector("#novel-text")?.dataset.pageIndex || 1),
    pageCount: Number(document.querySelector("#novel-text")?.dataset.pageCount || 1),
    cue: document.querySelector("#novel-layer").dataset.backgroundCue,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    overflowY: document.documentElement.scrollHeight > innerHeight + 1,
  }));
  assert.equal(after.id, "festival_concept_010");
  assert(!after.overflowX && !after.overflowY);
  await page.screenshot({ path: path.join(outputDir, `${label}-010-outdoor-copy-1.png`) });
  const outdoorPages = [after];
  while (outdoorPages.at(-1).pageIndex < outdoorPages.at(-1).pageCount) {
    const previousIndex = outdoorPages.at(-1).pageIndex;
    await page.locator("#novel-dialogue").click();
    await page.waitForFunction((index) => document.querySelector("#novel-layer")?.dataset.stepId === "festival_concept_010"
      && Number(document.querySelector("#novel-text")?.dataset.pageIndex || 0) === index + 1
      && document.querySelector("#novel-text")?.dataset.revealState === "complete", previousIndex);
    const nextPage = await page.evaluate(() => ({
      id: document.querySelector("#novel-layer").dataset.stepId,
      text: document.querySelector("#novel-text")?.textContent.trim(),
      pageIndex: Number(document.querySelector("#novel-text")?.dataset.pageIndex || 1),
      pageCount: Number(document.querySelector("#novel-text")?.dataset.pageCount || 1),
      cue: document.querySelector("#novel-layer").dataset.backgroundCue,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    }));
    assert(!nextPage.overflowX && !nextPage.overflowY);
    outdoorPages.push(nextPage);
    await page.screenshot({ path: path.join(outputDir, `${label}-010-outdoor-copy-${nextPage.pageIndex}.png`) });
  }
  assert.equal(outdoorPages.map((entry) => entry.text).join(""), "歓声と呼び込みが海風に混じる。誰かと一緒なら、この景色を見て何と言っただろう。答える相手のいないまま展示の列を歩いていると、海に面したテントの下で、青緑の地球と海岸線を映すパネルが目に留まった。");
  report.scans.push({ viewport: viewport.name, case: "festival-009-to-010", before, primaryOperation: "SAVE open/close", outdoorPages, passed: true });
  await context.close();
};

const scanMapCompositorContract = async (viewport) => {
  const label = `${viewport.name}-map-compositor`;
  const { context, page } = await createPage(viewport, label, false, "no-preference");
  await openRuntime(page, { clear: true, progress: progressFixture("map_mode01_004") });
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "map_mode01_004");
  const eventCounts = await page.evaluate(() => {
    globalThis.__mapCompositorEvents = { open: 0, close: 0, returned: 0 };
    addEventListener("gaia:story-mode-open", () => { globalThis.__mapCompositorEvents.open += 1; });
    addEventListener("gaia:story-mode-close", () => { globalThis.__mapCompositorEvents.close += 1; });
    addEventListener("gaia:story-mode-return-to-novel", () => { globalThis.__mapCompositorEvents.returned += 1; });
    return globalThis.__mapCompositorEvents;
  });
  assert.deepEqual(eventCounts, { open: 0, close: 0, returned: 0 });
  const originalGlobalState = await page.evaluate(() => {
    const panel = document.querySelector(".experience .signal-console-main");
    return { hidden: panel.hidden, inert: panel.inert, ariaHidden: panel.getAttribute("aria-hidden") };
  });
  await page.locator(".novel-interaction-open").click();
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open");
  await page.waitForTimeout(3200);
  const open = await page.evaluate(() => {
    const globalPanel = document.querySelector(".experience .signal-console-main");
    const mapPanel = document.querySelector("#japan-layer .signal-console-map");
    const globalStyle = getComputedStyle(globalPanel);
    return {
      events: { ...globalThis.__mapCompositorEvents },
      globalHidden: globalPanel.hidden,
      globalInert: globalPanel.inert,
      globalAriaHidden: globalPanel.getAttribute("aria-hidden"),
      globalDisplay: globalStyle.display,
      globalBackdropFilter: globalStyle.backdropFilter || globalStyle.webkitBackdropFilter,
      globalVisible: __qaVisible(globalPanel),
      mapVisible: __qaVisible(mapPanel),
      mapPanelCount: document.querySelectorAll("#japan-layer .signal-console-map").length,
      globalPanelCount: document.querySelectorAll(".experience .signal-console-main").length,
      dockCount: document.querySelectorAll(".story-detour-dock").length,
      stepId: globalThis.GaiaNovel.getState().stepId,
      lifecycle: document.body.dataset.novelInteractionState,
      year: document.querySelector("#japan-layer [data-signal-time-output]")?.textContent || "",
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.deepEqual(open.events, { open: 1, close: 0, returned: 0 });
  assert.equal(open.globalHidden, true);
  assert.equal(open.globalInert, true);
  assert.equal(open.globalAriaHidden, "true");
  assert.equal(open.globalDisplay, "none");
  assert(["none", ""].includes(open.globalBackdropFilter));
  assert.equal(open.globalVisible, false);
  assert.equal(open.mapVisible, true);
  assert.equal(open.mapPanelCount, 1);
  assert.equal(open.globalPanelCount, 1);
  assert.equal(open.dockCount, 1);
  assert.equal(open.stepId, "map_mode01_004");
  assert.equal(open.lifecycle, "open");
  assert.equal(open.overflow, false);

  const input = page.locator("#japan-layer [data-signal-time]").first();
  await input.focus();
  await input.press("Home");
  await input.press("ArrowRight");
  await page.locator("#japan-map").press("Enter");
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  await page.locator("#story-detour-return").click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_005");
  const closed = await page.evaluate(() => {
    const globalPanel = document.querySelector(".experience .signal-console-main");
    return {
      events: { ...globalThis.__mapCompositorEvents },
      globalHidden: globalPanel.hidden,
      globalInert: globalPanel.inert,
      globalAriaHidden: globalPanel.getAttribute("aria-hidden"),
      stepId: globalThis.GaiaNovel.getState().stepId,
      lifecycle: document.body.dataset.novelInteractionState || "idle",
    };
  });
  assert.deepEqual(closed.events, { open: 1, close: 1, returned: 1 });
  assert.equal(closed.globalHidden, originalGlobalState.hidden);
  assert.equal(closed.globalInert, originalGlobalState.inert);
  assert.equal(closed.globalAriaHidden, originalGlobalState.ariaHidden);
  assert.equal(closed.stepId, "map_mode01_005");
  assert.equal(closed.lifecycle, "idle");
  await page.screenshot({ path: path.join(outputDir, `${label}-closed.png`) });
  report.scans.push({ viewport: viewport.name, case: "map-gpu-compositor-contract", originalGlobalState, open, closed, passed: true });
  await context.close();
};

if (focus === "fresh-auto-start") {
  try {
    for (const viewport of [viewports[2], viewports[3]]) {
      await scanFreshStart(viewport, "cold");
      await scanFreshStart(viewport, "warm");
      await scanFreshOpeningEntry(viewport);
    }
    await scanStoredEntry(viewports[2], "resume", "festival_concept_023", "event-cg-mizuha-closeup-five-plane-v3.png");
    await scanStoredEntry(viewports[2], "resume-reached", "festival_concept_023", "event-cg-mizuha-closeup-five-plane-v3.png", true);
    await scanStoredEntry(viewports[3], "manual-load", "festival_concept_021", "event-cg-amane-closeup-five-plane-v4.png");
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.responses404, []);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }
  console.log(JSON.stringify({ status: report.status, scans: report.scans.length, outputDir }, null, 2));
  process.exit(0);
}

if (focus === "festival-009-toolbar") {
  try {
    for (const viewport of [viewports[2], viewports[3]]) await scan009to010(viewport);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.responses404, []);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }
  console.log(JSON.stringify({ status: report.status, scans: report.scans.length, outputDir }, null, 2));
  process.exit(0);
}

try {
  for (const viewport of [viewports[0], viewports[2], viewports[3]]) {
    await scanFreshStart(viewport, "cold");
    await scanFreshStart(viewport, "warm");
  }
  await scanStoredEntry(viewports[2], "resume", "festival_concept_023", "event-cg-mizuha-closeup-five-plane-v3.png");
  await scanStoredEntry(viewports[3], "manual-load", "festival_concept_021", "event-cg-amane-closeup-five-plane-v4.png");
  await scanStoredEntry(viewports[2], "unknown-fallback", "unknown", START_BACKGROUND);

  for (const viewport of [viewports[2], viewports[3]]) {
    for (const stepId of ["festival_concept_011", "festival_concept_021", "festival_concept_022", "festival_concept_023", "festival_concept_024", "welcome_chat_024"]) {
      await scanDialogue(viewport, stepId, ["festival_concept_011", "festival_concept_024", "welcome_chat_024"].includes(stepId));
    }
    await scan009to010(viewport);
  }
  for (const viewport of [viewports[0], viewports[2], viewports[3]]) await scanMapCompositorContract(viewport);
  await scanMetadata(viewports[0], "festival_concept_001");
  await scanMetadata(viewports[1], "festival_concept_008");
  await scanMetadata(viewports[2], "festival_concept_015");
  await scanMetadata(viewports[3], "festival_concept_001");

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(JSON.stringify({ status: report.status, scans: report.scans.length, outputDir }, null, 2));
