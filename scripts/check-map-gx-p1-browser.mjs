import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4423", scope = "all"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/map-gx-p1-browser");
fs.mkdirSync(outputDir, { recursive: true });

const pcViewports = [
  { name: "pc-2048", width: 2048, height: 1030 },
  { name: "pc-1920", width: 1920, height: 1000 },
  { name: "pc-1440", width: 1440, height: 900 },
];
const mobileViewport = { name: "mobile-390", width: 390, height: 844 };
const routeModes = ["normal", "resume", "auto", "fast"];
const viewportFilter = process.env.GAIA_VIEWPORT_FILTER || "";
const routeFilter = process.env.GAIA_ROUTE_FILTER || "";
const selectedRouteModes = routeModes.filter((mode) => !routeFilter || mode === routeFilter);
const mapTraceDurationMs = Number(process.env.GAIA_MAP_TRACE_MS || 30000);
const report = {
  status: "running",
  baseUrl,
  scope,
  mapTraceDurationMs,
  scans: [],
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
  demoInterest: "気候の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  audio: { muted: true, volume: 0.37 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `map-gx-p1-${stepId}`,
  ...extra,
});

const createPage = async (viewport, label) => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
  await page.addInitScript(() => {
    globalThis.__p1Visible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    globalThis.__p1Events = {
      mapOpen: 0,
      mapClose: 0,
      mapInteraction: 0,
      gxOpen: 0,
      gxReturn: 0,
      gxProgress: 0,
    };
    addEventListener("gaia:story-mode-open", (event) => {
      if (event.detail?.kind === "map01") globalThis.__p1Events.mapOpen += 1;
    });
    addEventListener("gaia:story-mode-return-to-novel", (event) => {
      if (event.detail?.kind === "map01") globalThis.__p1Events.mapClose += 1;
    });
    addEventListener("gaia:story-map-interaction", (event) => {
      if (event.detail?.kind === "map01") globalThis.__p1Events.mapInteraction += 1;
    });
    addEventListener("gaia:gx-open", () => { globalThis.__p1Events.gxOpen += 1; });
    addEventListener("gaia:gx-return-to-novel", () => { globalThis.__p1Events.gxReturn += 1; });
    addEventListener("gaia:gx-story-progress", (event) => {
      globalThis.__p1Events.gxProgress = Math.max(
        globalThis.__p1Events.gxProgress,
        Number(event.detail?.count) || 0,
      );
    });
    globalThis.__p1LauncherTrace = { added: 0, domMax: 0, visibleFrames: 0, focusFrames: 0 };
    const inspectLauncherNode = (node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(".novel-interaction-open") || node.querySelector(".novel-interaction-open")) {
        globalThis.__p1LauncherTrace.added += 1;
      }
    };
    const startLauncherTrace = () => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => mutation.addedNodes.forEach(inspectLauncherNode));
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      globalThis.__p1LauncherTrace.observer = observer;
      const sample = () => {
        const launchers = [...document.querySelectorAll(".novel-interaction-open")];
        globalThis.__p1LauncherTrace.domMax = Math.max(globalThis.__p1LauncherTrace.domMax, launchers.length);
        if (launchers.some((launcher) => globalThis.__p1Visible(launcher))) globalThis.__p1LauncherTrace.visibleFrames += 1;
        if (document.activeElement?.matches?.(".novel-interaction-open")) globalThis.__p1LauncherTrace.focusFrames += 1;
        globalThis.__p1LauncherTrace.raf = requestAnimationFrame(sample);
      };
      globalThis.__p1LauncherTrace.raf = requestAnimationFrame(sample);
    };
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", startLauncherTrace, { once: true });
    else startLauncherTrace();
  });
  return { context, page };
};

const bootAt = async (page, stepId, extra = {}) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "MAP/GX P1 QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", String(candidate.audio.volume));
  }, stateFor(stepId, extra));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.evaluate(() => {
    globalThis.__p1Steps = [document.querySelector("#novel-layer")?.dataset.stepId || ""];
    const layer = document.querySelector("#novel-layer");
    globalThis.__p1StepObserver = new MutationObserver(() => {
      const id = layer?.dataset.stepId || "";
      if (id && globalThis.__p1Steps.at(-1) !== id) globalThis.__p1Steps.push(id);
    });
    globalThis.__p1StepObserver.observe(layer, { attributes: true, attributeFilter: ["data-step-id"] });
  });
};

const reachInteraction = async (page, routeMode, previousStepId, interactionStepId) => {
  await bootAt(page, routeMode === "resume" ? interactionStepId : previousStepId, {
    readStepIds: routeMode === "resume" ? [previousStepId] : [],
  });
  if (routeMode === "resume") return;
  if (routeMode === "auto") {
    await page.locator("#novel-auto-button").click();
  } else if (routeMode === "fast") {
    await page.locator("#novel-fast-forward-button").click();
  } else {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await page.evaluate((id) => globalThis.GaiaNovel.getState().stepId === id, interactionStepId)) break;
      await page.locator("#novel-dialogue").click({ position: { x: 30, y: 30 } });
      await page.waitForTimeout(80);
    }
  }
  await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, interactionStepId, { timeout: 15000 });
};

const installMapTrace = async (page) => page.evaluate(() => {
  const globalPanel = document.querySelector(".experience .signal-console-main");
  const mapPanel = document.querySelector("#japan-layer .signal-console-map");
  const layer = document.querySelector("#japan-layer");
  const guide = document.querySelector(".story-map-guide");
  const trace = {
    frames: 0,
    visualTransitions: [],
    lastVisual: "",
    globalMutations: 0,
    mapMutations: 0,
    mountMutations: 0,
    guideStages: [guide?.dataset.stage || ""],
    initialStepId: globalThis.GaiaNovel.getState().stepId,
    initialGlobalPanel: globalPanel,
    initialMapPanel: mapPanel,
    initialGuide: guide,
  };
  const visibleState = (element) => {
    if (!element) return "missing";
    const style = getComputedStyle(element);
    return [element.hidden, style.display, style.visibility, style.opacity, element.inert].join("|");
  };
  const frame = () => {
    trace.frames += 1;
    if (
      document.querySelector(".experience .signal-console-main") !== trace.initialGlobalPanel
      || document.querySelector("#japan-layer .signal-console-map") !== trace.initialMapPanel
      || document.querySelector(".story-map-guide") !== trace.initialGuide
      || !trace.initialGlobalPanel.isConnected
      || !trace.initialMapPanel.isConnected
      || !trace.initialGuide.isConnected
    ) trace.mountMutations += 1;
    const visual = `${visibleState(globalPanel)}::${visibleState(mapPanel)}::${visibleState(layer)}`;
    if (trace.lastVisual !== visual) {
      trace.lastVisual = visual;
      trace.visualTransitions.push({ frame: trace.frames, visual });
    }
    trace.raf = requestAnimationFrame(frame);
  };
  trace.globalObserver = new MutationObserver((items) => { trace.globalMutations += items.length; });
  trace.mapObserver = new MutationObserver((items) => { trace.mapMutations += items.length; });
  trace.guideObserver = new MutationObserver(() => {
    const stage = guide?.dataset.stage || "";
    if (trace.guideStages.at(-1) !== stage) trace.guideStages.push(stage);
  });
  trace.globalObserver.observe(globalPanel, { attributes: true, childList: true, subtree: true, characterData: true });
  trace.mapObserver.observe(mapPanel, { attributes: true, childList: true, subtree: true, characterData: true });
  trace.guideObserver.observe(guide, { attributes: true, attributeFilter: ["data-stage"] });
  globalThis.__p1MapTrace = trace;
  trace.raf = requestAnimationFrame(frame);
});

const stopMapTrace = async (page) => page.evaluate(() => {
  const trace = globalThis.__p1MapTrace;
  cancelAnimationFrame(trace.raf);
  trace.globalObserver.disconnect();
  trace.mapObserver.disconnect();
  trace.guideObserver.disconnect();
  return {
    frames: trace.frames,
    visualTransitions: trace.visualTransitions,
    globalMutations: trace.globalMutations,
    mapMutations: trace.mapMutations,
    mountMutations: trace.mountMutations,
    guideStages: trace.guideStages,
    initialStepId: trace.initialStepId,
    finalStepId: globalThis.GaiaNovel.getState().stepId,
  };
});

const installMapPolishTrace = async (page) => page.evaluate(() => {
  const expectedPanel = document.querySelector("#japan-layer > .signal-console-map");
  const trace = {
    expectedPanel,
    frames: 0,
    identityChanges: 0,
    rectClassChanges: 0,
    markerMutations: 0,
    styleMutations: 0,
    lastSignature: "",
  };
  const signature = () => {
    const panel = document.querySelector("#japan-layer [data-map-grid-role='data']");
    if (!panel) return "missing";
    const rect = panel.getBoundingClientRect();
    return [panel.className, rect.x, rect.y, rect.width, rect.height].join("|");
  };
  trace.lastSignature = signature();
  trace.observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-map-grid-role" || mutation.attributeName === "class") trace.markerMutations += 1;
      if (mutation.attributeName === "style") trace.styleMutations += 1;
    });
  });
  trace.observer.observe(document.querySelector("#japan-layer"), {
    attributes: true,
    subtree: true,
    attributeFilter: ["class", "style", "data-map-grid-role"],
  });
  const sample = () => {
    trace.frames += 1;
    const panel = document.querySelector("#japan-layer [data-map-grid-role='data']");
    if (panel !== expectedPanel) trace.identityChanges += 1;
    const nextSignature = signature();
    if (nextSignature !== trace.lastSignature) {
      trace.rectClassChanges += 1;
      trace.lastSignature = nextSignature;
    }
    trace.raf = requestAnimationFrame(sample);
  };
  trace.raf = requestAnimationFrame(sample);
  globalThis.__p1MapPolishTrace = trace;
});

const stopMapPolishTrace = async (page) => page.evaluate(() => {
  const trace = globalThis.__p1MapPolishTrace;
  cancelAnimationFrame(trace.raf);
  trace.observer.disconnect();
  const panel = document.querySelector("#japan-layer [data-map-grid-role='data']");
  return {
    frames: trace.frames,
    identityChanges: trace.identityChanges,
    rectClassChanges: trace.rectClassChanges,
    markerMutations: trace.markerMutations,
    styleMutations: trace.styleMutations,
    exactPanel: panel === trace.expectedPanel && panel?.matches("#japan-layer > .signal-console-map"),
    role: panel?.dataset.mapGridRole || "",
    className: panel?.className || "",
    rect: panel?.getBoundingClientRect().toJSON(),
  };
});

const mapOpenState = async (page) => page.evaluate(() => {
  const globalPanel = document.querySelector(".experience .signal-console-main");
  const mapPanel = document.querySelector("#japan-layer .signal-console-map");
  const guide = document.querySelector(".story-map-guide");
  const returnButton = document.querySelector("#story-detour-return");
  const timeline = document.querySelector("#japan-layer [data-signal-time]");
  const timelineRect = timeline?.getBoundingClientRect();
  const globalStyle = getComputedStyle(globalPanel);
  const mapStyle = getComputedStyle(mapPanel);
  return {
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState,
    globalHidden: globalPanel.hidden,
    globalInert: globalPanel.inert,
    globalDisplay: globalStyle.display,
    globalBackdrop: globalStyle.backdropFilter,
    mapVisible: globalThis.__p1Visible(mapPanel),
    mapDisplay: mapStyle.display,
    guideVisible: globalThis.__p1Visible(guide),
    guideStage: guide?.dataset.stage,
    guideText: guide?.innerText.replace(/\s+/gu, " ").trim(),
    returnEnabled: !returnButton?.disabled,
    timelinePointerEvents: getComputedStyle(timeline).pointerEvents,
    timelineHitSamples: [0.08, 0.25, 0.5, 0.75, 0.92].map((ratio) => {
      const x = timelineRect.left + timelineRect.width * ratio;
      const y = timelineRect.top + timelineRect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        ratio,
        x,
        y,
        tag: hit?.tagName || "",
        hitTimeline: hit === timeline || Boolean(hit?.closest?.("[data-signal-time]")),
        hitClass: hit?.className || "",
      };
    }),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    overflowY: document.documentElement.scrollHeight > innerHeight + 1,
  };
});

const performMapInputs = async (page, screenshotPrefix = "") => {
  if (screenshotPrefix) await page.screenshot({ path: path.join(outputDir, `${screenshotPrefix}-step1.png`) });
  const timeInput = page.locator("#japan-layer [data-signal-time]").first();
  const before = Number(await timeInput.inputValue());
  const box = await timeInput.boundingBox();
  assert(box && box.width >= 40 && box.height >= 10, "MAP timeline pointer target is unavailable");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.78, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const pointerValue = Number(await timeInput.inputValue());
  assert.notEqual(pointerValue, before, "MAP timeline did not change after real pointer drag");
  await page.waitForFunction(() => document.querySelector(".story-map-guide")?.dataset.stage === "2");
  await timeInput.focus();
  await timeInput.press("ArrowRight");
  const keyboardValue = Number(await timeInput.inputValue());
  assert.notEqual(keyboardValue, pointerValue, "MAP timeline did not change after keyboard input");
  if (screenshotPrefix) await page.screenshot({ path: path.join(outputDir, `${screenshotPrefix}-step2.png`) });
  const map = page.locator("#japan-map");
  const mapBox = await map.boundingBox();
  assert(mapBox && mapBox.width > 100 && mapBox.height > 100, "MAP pointer surface is unavailable");
  const point = { x: mapBox.x + mapBox.width * 0.52, y: mapBox.y + mapBox.height * 0.5 };
  const hit = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest?.("#japan-map")), point);
  assert.equal(hit, true, "MAP pointer surface is covered by another element");
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => document.querySelector(".story-map-guide")?.dataset.stage === "3");
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  if (screenshotPrefix) await page.screenshot({ path: path.join(outputDir, `${screenshotPrefix}-step3.png`) });
  await page.locator("#story-detour-return").click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "map_mode01_005");
  return { before, pointerValue, keyboardValue, hit };
};

const scanMap = async (viewport, routeMode, traceDurationMs) => {
  const label = `${viewport.name}-map-${routeMode}`;
  const { context, page } = await createPage(viewport, label);
  await reachInteraction(page, routeMode, "map_mode01_003", "map_mode01_004");
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && globalThis.__p1Visible(document.querySelector("#japan-layer")));
  await page.waitForTimeout(80);
  const launcherTrace = await page.evaluate(() => ({
    added: globalThis.__p1LauncherTrace.added,
    domMax: globalThis.__p1LauncherTrace.domMax,
    visibleFrames: globalThis.__p1LauncherTrace.visibleFrames,
    focusFrames: globalThis.__p1LauncherTrace.focusFrames,
    currentCount: document.querySelectorAll(".novel-interaction-open").length,
    focused: document.activeElement?.matches?.(".novel-interaction-open") || false,
  }));
  assert.deepEqual(launcherTrace, { added: 0, domMax: 0, visibleFrames: 0, focusFrames: 0, currentCount: 0, focused: false });
  const open = await mapOpenState(page);
  assert.equal(open.stepId, "map_mode01_004");
  assert.equal(open.lifecycle, "open");
  assert.equal(open.globalHidden, true);
  assert.equal(open.globalInert, true);
  assert.equal(open.globalDisplay, "none");
  assert.equal(open.globalBackdrop, "none");
  assert.equal(open.mapVisible, true);
  assert.equal(open.guideVisible, true);
  assert.equal(open.guideStage, "1");
  assert.match(open.guideText, /年代を動かす/u);
  assert.equal(open.returnEnabled, false);
  assert.equal(open.timelinePointerEvents, "auto");
  assert(open.timelineHitSamples.every((sample) => sample.hitTimeline), `${label}: MAP slider track is pointer-obscured: ${JSON.stringify(open.timelineHitSamples)}`);
  assert.equal(open.overflowX, false);
  await installMapTrace(page);
  await installMapPolishTrace(page);
  await page.waitForTimeout(traceDurationMs);
  const trace = await stopMapTrace(page);
  const polishTrace = await stopMapPolishTrace(page);
  assert(trace.frames > traceDurationMs / 100, `${label}: insufficient RAF samples`);
  assert.equal(trace.visualTransitions.length, 1, `${label}: MAP/ACT1 compositor state changed during trace`);
  assert.equal(trace.globalMutations, 0, `${label}: hidden global ACT1 panel was mutated`);
  assert.equal(trace.mapMutations, 0, `${label}: idle MAP panel mutated without user input`);
  assert.equal(trace.mountMutations, 0, `${label}: MAP panel/guide remounted during trace`);
  assert.equal(trace.initialStepId, "map_mode01_004");
  assert.equal(trace.finalStepId, "map_mode01_004");
  assert(polishTrace.frames >= 1200, `${label}: insufficient map polish samples`);
  assert.equal(polishTrace.exactPanel, true, `${label}: data marker is not on the exact signal console`);
  assert.equal(polishTrace.role, "data");
  assert.equal(polishTrace.identityChanges, 0, `${label}: data panel identity changed`);
  assert(polishTrace.rectClassChanges <= 1, `${label}: data panel rect/class oscillated`);
  assert.equal(polishTrace.markerMutations, 0, `${label}: data marker/class was removed or re-added`);
  assert.equal(polishTrace.styleMutations, 0, `${label}: stable data panel inline style was rewritten`);
  const screenshotPrefix = routeMode === "normal" ? `${viewport.name}-map` : "";
  await installMapTrace(page);
  const inputs = await performMapInputs(page, screenshotPrefix);
  const interactionTrace = await stopMapTrace(page);
  assert.deepEqual(interactionTrace.guideStages, ["1", "2", "3"]);
  const closed = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState || "idle",
    mapVisible: globalThis.__p1Visible(document.querySelector("#japan-layer")),
    guideCount: document.querySelectorAll(".story-map-guide").length,
    globalHidden: document.querySelector(".experience .signal-console-main")?.hidden,
    events: { ...globalThis.__p1Events },
    steps: [...globalThis.__p1Steps],
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.equal(closed.stepId, "map_mode01_005");
  assert.equal(closed.lifecycle, "idle");
  assert.equal(closed.mapVisible, false);
  assert.equal(closed.guideCount, 0);
  assert.equal(closed.globalHidden, true);
  assert.equal(closed.events.mapOpen, 1);
  assert.equal(closed.events.mapClose, 1);
  assert.equal(closed.steps.filter((id) => id === "map_mode01_005").length, 1);
  assert.equal(closed.overflowX, false);
  report.scans.push({ case: "map-auto-open-real-input", viewport, routeMode, launcherTrace, open, trace, polishTrace, interactionTrace, inputs, closed, passed: true });
  await context.close();
  console.log(`PASS ${label}`);
};

const performGxGesture = async (page) => {
  const target = await page.evaluate(() => {
    const canvas = document.querySelector("#gx-canvas");
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return null;
    const candidates = [
      [0.68, 0.52], [0.58, 0.5], [0.76, 0.48], [0.5, 0.58], [0.82, 0.58],
      [0.85, 0.32], [0.8, 0.34], [0.9, 0.38], [0.92, 0.46], [0.47, 0.36],
    ];
    const hits = [];
    for (const [nx, ny] of candidates) {
      const x = rect.left + rect.width * nx;
      const y = rect.top + rect.height * ny;
      const hit = document.elementFromPoint(x, y);
      if (hit === canvas) return { x, y };
      hits.push({ nx, ny, tag: hit?.tagName || "", id: hit?.id || "", className: String(hit?.className || "") });
    }
    return { blocked: true, rect: rect.toJSON(), hits };
  });
  assert(target && !target.blocked, `GX canvas is blocked: ${JSON.stringify(target)}`);
  const canvasWidth = await page.locator("#gx-canvas").evaluate((canvas) => canvas.getBoundingClientRect().width);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + canvasWidth * 0.2, target.y + 6, { steps: 10 });
  await page.mouse.up();
};

const gxOpenState = async (page, viewport) => page.evaluate(({ width, height }) => {
  const gx = document.querySelector("#gx-layer");
  const rect = gx?.getBoundingClientRect();
  const story = document.querySelector("#novel-layer");
  const backdrop = document.querySelector("#gx-story-backdrop");
  const card = document.querySelector("#gx-layer .gx-story-card");
  const dock = document.querySelector("#gx-layer .story-detour-dock");
  const gxControls = document.querySelector("#gx-layer .gx-controls");
  const cardRect = card?.getBoundingClientRect();
  const dockRect = dock?.getBoundingClientRect();
  const gxControlsRect = gxControls?.getBoundingClientRect();
  return {
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState,
    role: gx?.getAttribute("role"),
    ariaModal: gx?.getAttribute("aria-modal"),
    ariaLabel: gx?.getAttribute("aria-label"),
    ariaLabelledBy: gx?.getAttribute("aria-labelledby"),
    labelledText: document.getElementById(gx?.getAttribute("aria-labelledby") || "")?.textContent?.trim() || "",
    launcherCount: document.querySelectorAll(".novel-interaction-open, .novel-interaction-skip").length,
    storyHidden: story?.hidden,
    storyAriaHidden: story?.getAttribute("aria-hidden"),
    storyInert: story?.inert,
    storyBackground: getComputedStyle(story).backgroundImage,
    backgroundCue: story?.dataset.backgroundCue || "",
    backdropVisible: globalThis.__p1Visible(backdrop),
    rect: rect?.toJSON(),
    widthRatio: rect.width / width,
    heightRatio: rect.height / height,
    margins: { left: rect.left, right: width - rect.right, top: rect.top, bottom: height - rect.bottom },
    centeredX: Math.abs(rect.left + rect.width / 2 - width / 2),
    centeredY: Math.abs(rect.top + rect.height / 2 - height / 2),
    returnEnabled: !document.querySelector("#story-detour-return")?.disabled,
    innerCloseDisabled: document.querySelector("#gx-close")?.disabled,
    cardScrollable: card.scrollHeight > card.clientHeight + 1,
    cardScrollHeight: card.scrollHeight,
    cardClientHeight: card.clientHeight,
    cardOverflowY: getComputedStyle(card).overflowY,
    cardPointerEvents: getComputedStyle(card).pointerEvents,
    cardTabIndex: card.tabIndex,
    cardVisibleOverflow: card.scrollHeight - card.clientHeight,
    cardRect: cardRect?.toJSON(),
    dockRect: dockRect?.toJSON(),
    gxControlsRect: gxControlsRect?.toJSON(),
    cardClearOfDock: cardRect.bottom <= dockRect.top + 1,
    controlsClearOfDock: gxControlsRect.bottom <= dockRect.top + 1,
    dockScrollable: dock.scrollHeight > dock.clientHeight + 1,
    dockOverflowY: getComputedStyle(dock).overflowY,
    dockDuplicateCopyVisible: [...dock.querySelectorAll("header, :scope > p")]
      .some((element) => getComputedStyle(element).display !== "none"),
    dockButtonHeights: [...dock.querySelectorAll("button")]
      .map((button) => button.getBoundingClientRect().height),
    castDisplay: getComputedStyle(document.querySelector("#novel-cast")).display,
    visibleCharacterCount: [...document.querySelectorAll("#novel-cast .novel-character")]
      .filter((character) => globalThis.__p1Visible(character)).length,
    documentScrollTop: document.scrollingElement.scrollTop,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    overflowY: document.documentElement.scrollHeight > innerHeight + 1,
  };
}, viewport);

const scanGx = async (viewport, routeMode) => {
  const label = `${viewport.name}-gx-${routeMode}`;
  const { context, page } = await createPage(viewport, label);
  await reachInteraction(page, routeMode, "gx_experience_016", "gx_experience_017");
  await page.waitForFunction(() => document.body.dataset.novelInteractionState === "open" && globalThis.__p1Visible(document.querySelector("#gx-layer")));
  await page.waitForTimeout(80);
  const open = await gxOpenState(page, viewport);
  assert.equal(open.stepId, "gx_experience_017");
  assert.equal(open.lifecycle, "open");
  assert.equal(open.role, "dialog");
  assert.equal(open.ariaModal, "true");
  assert(open.ariaLabel || (open.ariaLabelledBy && open.labelledText), `${label}: GX dialog has no accessible name`);
  assert.equal(open.launcherCount, 0);
  assert.equal(open.storyHidden, false);
  assert.equal(open.storyAriaHidden, "true");
  assert.equal(open.storyInert, true);
  assert.match(open.storyBackground, /novel-bg-exhibition-autumn-morning-close-v4\.png/u);
  assert.equal(open.backgroundCue, "gx-native-deep-time");
  assert.equal(open.castDisplay, "none");
  assert.equal(open.visibleCharacterCount, 0);
  assert.equal(open.backdropVisible, true);
  assert.equal(open.centeredX <= 1.5, true);
  assert.equal(open.centeredY <= 1.5, true);
  if (viewport.width <= 560) {
    assert(open.widthRatio <= 0.96 + 0.002);
    assert(open.heightRatio <= 0.96 + 0.002);
    assert(open.margins.left > 0 && open.margins.right > 0 && open.margins.top > 0 && open.margins.bottom > 0);
  } else {
    assert(open.widthRatio <= 0.78 + 0.002 && open.rect.width <= 1281);
    assert(open.heightRatio <= 0.78 + 0.002 && open.rect.height <= 861);
    assert(open.margins.left >= viewport.width * 0.1 - 1);
    assert(open.margins.right >= viewport.width * 0.1 - 1);
    assert(open.margins.top >= viewport.height * 0.08 - 1);
    assert(open.margins.bottom >= viewport.height * 0.08 - 1);
  }
  assert.equal(open.returnEnabled, false);
  assert.equal(open.innerCloseDisabled, true);
  assert.equal(open.cardScrollable, false, `${label}: phase card content is clipped: ${JSON.stringify(open)}`);
  assert(open.cardVisibleOverflow <= 1, `${label}: phase card exceeds its no-scroll viewport: ${JSON.stringify(open)}`);
  assert.equal(open.cardOverflowY, "hidden");
  assert.equal(open.cardClearOfDock, true, `${label}: phase card is covered by the story controls: ${JSON.stringify(open)}`);
  assert.equal(open.controlsClearOfDock, true, `${label}: GX phase controls are covered by the story controls: ${JSON.stringify(open)}`);
  assert.equal(open.dockScrollable, false);
  assert.equal(open.dockOverflowY, "hidden");
  assert.equal(open.dockDuplicateCopyVisible, false);
  assert.equal(open.dockButtonHeights.length, 2);
  assert(open.dockButtonHeights.every((height) => height >= 44));
  assert.equal(open.overflowX, false);
  assert.equal(open.overflowY, false);
  const phaseLayouts = [];
  for (let phase = 0; phase < 8; phase += 1) {
    await page.evaluate((index) => globalThis.GaiaGX.setPhase(index), phase);
    await page.waitForFunction((index) => document.querySelector("#gx-phase-index")?.textContent?.trim() === `${String(index + 1).padStart(2, "0")} / 08`, phase);
    const phaseLayout = await page.evaluate(() => {
      const gx = document.querySelector("#gx-layer");
      const card = gx.querySelector(".gx-story-card");
      const dock = gx.querySelector(".story-detour-dock");
      const header = gx.querySelector(".gx-header");
      const cardRect = card.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      return {
        index: document.querySelector("#gx-phase-index")?.textContent?.trim(),
        title: document.querySelector("#gx-title")?.textContent?.trim(),
        cardScrollHeight: card.scrollHeight,
        cardClientHeight: card.clientHeight,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        headerBottom: headerRect.bottom,
        dockTop: dockRect.top,
      };
    });
    assert(phaseLayout.cardScrollHeight <= phaseLayout.cardClientHeight + 1, `${label}: ${phaseLayout.index} needs a scrollbar: ${JSON.stringify(phaseLayout)}`);
    assert(phaseLayout.cardTop >= phaseLayout.headerBottom - 1, `${label}: ${phaseLayout.index} overlaps the GX heading: ${JSON.stringify(phaseLayout)}`);
    assert(phaseLayout.cardBottom <= phaseLayout.dockTop + 1, `${label}: ${phaseLayout.index} is covered by the story controls: ${JSON.stringify(phaseLayout)}`);
    phaseLayouts.push(phaseLayout);
  }
  await page.evaluate(() => globalThis.GaiaGX.setPhase(0));
  await page.waitForFunction(() => document.querySelector("#gx-phase-index")?.textContent?.trim() === "01 / 08");
  if (routeMode === "normal") await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-open.png`) });
  const card = page.locator("#gx-layer .gx-story-card");
  const cardBox = await card.boundingBox();
  let scroll = { scrollable: open.cardScrollable, before: 0, after: 0, documentBefore: 0, documentAfter: 0 };
  if (cardBox && open.cardScrollable) {
    scroll = await page.evaluate(() => ({
      scrollable: true,
      before: document.querySelector("#gx-layer .gx-story-card").scrollTop,
      documentBefore: document.scrollingElement.scrollTop,
    }));
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.wheel(0, 480);
    await page.waitForTimeout(80);
    Object.assign(scroll, await page.evaluate(() => ({
      after: document.querySelector("#gx-layer .gx-story-card").scrollTop,
      documentAfter: document.scrollingElement.scrollTop,
    })));
    assert(scroll.after > scroll.before, `${label}: GX internal wheel scroll did not move: ${JSON.stringify({ open, scroll })}`);
    assert.equal(scroll.documentAfter, scroll.documentBefore);
  }
  for (let index = 0; index < 3; index += 1) {
    await performGxGesture(page);
    if (index === 0 && routeMode === "normal") {
      await page.waitForFunction(() => (
        document.querySelector("#gx-title")?.textContent?.trim() === "THE SECOND GX"
        && !document.querySelector("#gx-layer")?.classList.contains("is-era-transitioning")
        && document.querySelector(".story-detour-controls button")?.textContent?.trim() === "段階表示を進める"
      ));
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-second.png`) });
    }
  }
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  const completed = await page.evaluate(() => {
    const dockReturn = document.querySelector("#story-detour-return");
    const innerClose = document.querySelector("#gx-close");
    const rect = dockReturn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      dockReturnDisabled: dockReturn.disabled,
      innerCloseDisabled: innerClose.disabled,
      hitDockReturn: hit === dockReturn || Boolean(hit?.closest?.("#story-detour-return")),
      hitTag: hit?.tagName || "",
      hitId: hit?.id || "",
    };
  });
  assert.equal(completed.dockReturnDisabled, false);
  assert.equal(completed.innerCloseDisabled, false);
  assert.equal(completed.hitDockReturn, true, `${label}: GX return target is covered: ${JSON.stringify(completed)}`);
  if (routeMode === "normal") await page.screenshot({ path: path.join(outputDir, `${viewport.name}-gx-ready.png`) });
  await page.locator("#story-detour-return").click();
  await page.waitForFunction(() => globalThis.GaiaNovel.getState().stepId === "gx_experience_018");
  const closed = await page.evaluate(() => ({
    stepId: globalThis.GaiaNovel.getState().stepId,
    lifecycle: document.body.dataset.novelInteractionState || "idle",
    gxVisible: globalThis.__p1Visible(document.querySelector("#gx-layer")),
    events: { ...globalThis.__p1Events },
    steps: [...globalThis.__p1Steps],
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.equal(closed.stepId, "gx_experience_018");
  assert.equal(closed.lifecycle, "idle");
  assert.equal(closed.gxVisible, false);
  assert.equal(closed.events.gxOpen, 1);
  assert.equal(closed.events.gxReturn, 1);
  assert(closed.events.gxProgress >= 3);
  assert.equal(closed.steps.filter((id) => id === "gx_experience_018").length, 1);
  assert.equal(closed.overflowX, false);
  report.scans.push({ case: "gx-real-gesture", viewport, routeMode, open, phaseLayouts, scroll, completed, closed, passed: true });
  await context.close();
  console.log(`PASS ${label}`);
};

const scanStandaloneGx = async () => {
  const viewport = pcViewports[2];
  const { context, page } = await createPage(viewport, "standalone-gx");
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaGX));
  await page.evaluate(() => globalThis.GaiaGX.open({ returnTo: "intro" }));
  await page.waitForFunction(() => globalThis.__p1Visible(document.querySelector("#gx-layer")));
  const standalone = await page.evaluate(() => ({
    returnTo: document.querySelector("#gx-layer")?.dataset.returnTo,
    rect: document.querySelector("#gx-layer")?.getBoundingClientRect().toJSON(),
  }));
  assert.equal(standalone.returnTo, "intro");
  assert.deepEqual([standalone.rect.left, standalone.rect.top, standalone.rect.right, standalone.rect.bottom], [0, 0, viewport.width, viewport.height]);
  report.scans.push({ case: "gx-standalone", viewport, standalone, passed: true });
  await context.close();
  console.log("PASS standalone-gx");
};

try {
  if (scope === "gx-layout") {
    for (const viewport of [pcViewports[2], mobileViewport].filter((candidate) => !viewportFilter || candidate.name === viewportFilter)) {
      await scanGx(viewport, "normal");
    }
  } else if (scope === "map-stability") {
    const targets = [...pcViewports, mobileViewport].filter((candidate) => !viewportFilter || candidate.name === viewportFilter);
    for (const viewport of targets) {
      const modes = viewport === mobileViewport ? ["normal"] : selectedRouteModes;
      for (const routeMode of modes) await scanMap(viewport, routeMode, mapTraceDurationMs);
    }
  } else if (scope === "auto-open") {
    for (const viewport of [pcViewports[0], pcViewports[2], mobileViewport].filter((candidate) => !viewportFilter || candidate.name === viewportFilter)) {
      for (const routeMode of selectedRouteModes) await scanMap(viewport, routeMode, mapTraceDurationMs);
    }
    await scanGx(pcViewports[2], "normal");
  } else {
  if (scope !== "mobile") {
    for (const viewport of pcViewports.filter((candidate) => !viewportFilter || candidate.name === viewportFilter)) {
      for (const routeMode of selectedRouteModes) await scanMap(viewport, routeMode, mapTraceDurationMs);
      for (const routeMode of selectedRouteModes) await scanGx(viewport, routeMode);
    }
  }
  if (scope !== "pc") {
    if (!viewportFilter || viewportFilter === mobileViewport.name) {
      await scanMap(mobileViewport, "normal", mapTraceDurationMs);
      await scanGx(mobileViewport, "normal");
    }
  }
  if (scope === "all") await scanStandaloneGx();
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

console.log(`map/gx P1 browser check passed (${report.scans.length} scans)`);
