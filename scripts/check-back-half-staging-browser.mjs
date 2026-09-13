import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4298";
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/back-half-staging-browser");
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required.");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
delete globalThis.GAIA_NOVEL_STORY;
delete globalThis.GAIA_NOVEL_BACKGROUND_CUES;
delete globalThis.GAIA_NOVEL_BACK_HALF_CUES;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?browser=${Date.now()}`);
await import(`${pathToFileURL(path.join(projectRoot, "novel-background-cues.js")).href}?browser=${Date.now()}`);
await import(`${pathToFileURL(path.join(projectRoot, "novel-back-half-cues.js")).href}?browser=${Date.now()}`);

const story = globalThis.GAIA_NOVEL_STORY;
const backgrounds = globalThis.GAIA_NOVEL_BACKGROUND_CUES;
const staging = globalThis.GAIA_NOVEL_BACK_HALF_CUES;
const steps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(steps.map((step) => [step.id, step]));
const routeUrl = new URL("/story", baseUrl).href;
const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v2";
const assert = (condition, message) => { if (!condition) throw new Error(message); };

await mkdir(outputDir, { recursive: true });
const report = {
  status: "running",
  baseUrl: routeUrl,
  viewports: [],
  evidence: [],
  boundaries: [],
  stableBoundaries: [],
  distanceContinuity: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });

const baseState = (stepId) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "back-half-staging-browser",
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const ensureNovelOpen = async (page) => {
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer?.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.locator("#novel-title-screen").waitFor({ state: "visible", timeout: 15000 });
};

const bootAt = async (page, stepId) => {
  await page.evaluate(({ progressKey, configKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
  }, { progressKey: STORAGE_KEY, configKey: CONFIG_KEY, progress: baseState(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15000 });
};

const presentation = (page) => page.locator("#novel-layer").evaluate((node) => {
  const style = getComputedStyle(node);
  const cast = node.querySelector("#novel-cast");
  const castStyle = cast ? getComputedStyle(cast) : null;
  const phoneSurface = node.querySelector("#novel-operations-phone-surface");
  const phoneFrame = phoneSurface?.querySelector(".novel-operations-phone");
  const visiblePhoneViews = [...(phoneSurface?.querySelectorAll(".novel-operations-phone-view") || [])]
    .filter((view) => getComputedStyle(view).visibility === "visible");
  const layerRect = node.getBoundingClientRect();
  const overflowingElements = [...node.querySelectorAll("*")].flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || (rect.left >= layerRect.left - 1 && rect.right <= layerRect.right + 1)) return [];
    return [{
      id: element.id,
      className: typeof element.className === "string" ? element.className : "",
      left: Math.round(rect.left * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
    }];
  }).slice(0, 12);
  const characterState = (id) => {
    const figure = node.querySelector(id);
    if (!figure) return null;
    const figureStyle = getComputedStyle(figure);
    const portrait = figure.querySelector(".novel-character-portrait");
    const portraitStyle = portrait ? getComputedStyle(portrait) : null;
    const rect = figure.getBoundingClientRect();
    return {
      display: figureStyle.display,
      visibility: figureStyle.visibility,
      opacity: Number(figureStyle.opacity),
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      backgroundImage: portraitStyle?.backgroundImage || "",
      backgroundPosition: portraitStyle?.backgroundPosition || "",
      backgroundRepeat: portraitStyle?.backgroundRepeat || "",
      backgroundSize: portraitStyle?.backgroundSize || "",
      animationName: portraitStyle?.animationName || "none",
    };
  };
  return {
    stepId: node.dataset.stepId,
    backgroundImage: style.backgroundImage,
    backgroundCue: node.dataset.backgroundCue,
    context: node.dataset.storyContext,
    time: node.dataset.storyTime,
    location: node.dataset.storyLocation,
    device: node.dataset.storyDevice,
    devicePhase: node.dataset.storyDevicePhase,
    viewpoint: node.dataset.storyViewpoint,
    castMode: node.dataset.storyCastMode,
    audioCue: node.dataset.storyAudioCue,
    castSuppressed: node.classList.contains("is-cast-suppressed"),
    castVisibility: castStyle?.visibility,
    castOpacity: castStyle?.opacity,
    characters: {
      mizuha: characterState("#novel-character-minamo"),
      amane: characterState("#novel-character-sora"),
      sakuya: characterState("#novel-character-sakuya"),
    },
    phone: {
      hidden: Boolean(phoneSurface?.hidden),
      visible: Boolean(phoneSurface && !phoneSurface.hidden && getComputedStyle(phoneSurface).display !== "none"),
      frameCount: phoneSurface?.querySelectorAll(".novel-operations-phone").length || 0,
      visibleViews: visiblePhoneViews.map((view) => [...view.classList].find((name) => name.startsWith("is-")) || ""),
      clock: phoneSurface?.querySelector("#novel-operations-phone-clock")?.textContent?.trim() || "",
      noticeTime: phoneSurface?.querySelector("#novel-operations-phone-notice-time")?.textContent?.trim() || "",
      noticeSender: phoneSurface?.querySelector("#novel-operations-phone-notice-sender")?.textContent?.trim() || "",
      noticeBody: phoneSurface?.querySelector("#novel-operations-phone-notice-body")?.textContent?.trim() || "",
      audioSpeaker: phoneSurface?.querySelector("#novel-operations-phone-audio-speaker")?.textContent?.trim() || "",
      audioStatus: phoneSurface?.querySelector("#novel-operations-phone-audio-status")?.textContent?.trim() || "",
      frameWidth: phoneFrame?.getBoundingClientRect().width || 0,
      frameHeight: phoneFrame?.getBoundingClientRect().height || 0,
    },
    bodyOverflow: document.documentElement.scrollWidth - innerWidth,
    layerOverflow: node.scrollWidth - node.clientWidth,
    overflowingElements,
  };
});

const capture = async (page, viewportName, stepId) => {
  await bootAt(page, stepId);
  const step = stepMap.get(stepId);
  const expectedBackground = path.basename(backgrounds.forStep(step).assetPath);
  const expectedStaging = staging.forStep(step);
  if (expectedStaging.castMode === "central-entrance-distance") {
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#novel-character-sakuya")).opacity) > 0, null, { timeout: 3000 });
  }
  const current = await presentation(page);
  assert(current.backgroundImage.includes(expectedBackground), `${viewportName}/${stepId}: wrong background ${current.backgroundImage}`);
  assert(current.context === expectedStaging.temporal.context, `${viewportName}/${stepId}: wrong context`);
  assert(current.time === expectedStaging.temporal.time, `${viewportName}/${stepId}: wrong time`);
  assert(current.location === expectedStaging.temporal.location, `${viewportName}/${stepId}: wrong location`);
  assert(current.device === expectedStaging.device, `${viewportName}/${stepId}: wrong device`);
  assert(current.viewpoint === expectedStaging.viewpoint, `${viewportName}/${stepId}: wrong viewpoint`);
  assert(current.castMode === expectedStaging.castMode, `${viewportName}/${stepId}: wrong cast mode`);
  assert(current.bodyOverflow <= 1 && current.layerOverflow <= 1, `${viewportName}/${stepId}: horizontal overflow ${current.bodyOverflow}/${current.layerOverflow} ${JSON.stringify(current.overflowingElements)}`);
  if (expectedStaging.device === "portrait-operations-phone") {
    const expectedView = {
      prepare: "is-prepare",
      "official-notice": "is-notice",
      "incoming-audio": "is-audio",
    }[expectedStaging.devicePhase];
    assert(current.phone.visible && current.phone.frameCount === 1, `${viewportName}/${stepId}: operations phone is not a single visible surface`);
    assert(current.phone.visibleViews.length === 1 && current.phone.visibleViews[0] === expectedView, `${viewportName}/${stepId}: wrong phone phase ${current.phone.visibleViews}`);
    assert(current.phone.clock === expectedStaging.phone.clock, `${viewportName}/${stepId}: wrong phone clock`);
    assert(current.phone.noticeTime === expectedStaging.phone.noticeTime, `${viewportName}/${stepId}: wrong notice time`);
    assert(current.phone.noticeSender === expectedStaging.phone.noticeSender, `${viewportName}/${stepId}: wrong notice sender`);
    assert(current.phone.noticeBody === expectedStaging.phone.noticeBody, `${viewportName}/${stepId}: wrong notice body`);
    assert(current.phone.audioSpeaker === expectedStaging.phone.audioSpeaker, `${viewportName}/${stepId}: wrong audio speaker`);
    assert(current.phone.audioStatus === expectedStaging.phone.audioStatus, `${viewportName}/${stepId}: wrong audio status`);
  } else {
    assert(!current.phone.visible, `${viewportName}/${stepId}: operations phone leaked outside its cue`);
  }
  if (["archived-voice-no-cast", "remote-sakuya-no-cast", "sakuya-unseen"].includes(expectedStaging.castMode)) {
    assert(current.castSuppressed && current.castVisibility === "hidden", `${viewportName}/${stepId}: remote/recorded cast is visible`);
  }
  if (expectedStaging.castMode === "central-entrance-distance") {
    assert(!current.castSuppressed, `${viewportName}/${stepId}: physical Sakuya gate remained suppressed`);
    assert(current.characters.sakuya?.display !== "none" && current.characters.sakuya?.visibility === "visible" && current.characters.sakuya?.opacity > 0, `${viewportName}/${stepId}: physical Sakuya is not visible (${JSON.stringify({ castVisibility: current.castVisibility, castOpacity: current.castOpacity, characters: current.characters })})`);
    assert(current.characters.sakuya?.width > 0 && current.characters.sakuya?.height > 0, `${viewportName}/${stepId}: physical Sakuya has no rendered bounds`);
    assert(current.characters.mizuha?.visibility === "hidden" && current.characters.amane?.visibility === "hidden", `${viewportName}/${stepId}: another character leaked into Sakuya distance framing`);
  }
  const screenshotPath = path.join(outputDir, `${viewportName}-${stepId}.png`);
  await page.screenshot({ path: screenshotPath, animations: "disabled", timeout: 90000 });
  report.evidence.push({ viewport: viewportName, stepId, expectedBackground, ...current, screenshotPath });
};

const checkBoundary = async (page, viewportName, fromId, toId, expectedFile) => {
  await bootAt(page, fromId);
  await page.evaluate(() => {
    globalThis.__gaiaBackHalfTransitionSeen = false;
    globalThis.__gaiaBackHalfTransitionObserver?.disconnect();
    globalThis.__gaiaBackHalfTransitionObserver = new MutationObserver(() => {
      if (document.body.classList.contains("scene-transitioning")) globalThis.__gaiaBackHalfTransitionSeen = true;
    });
    globalThis.__gaiaBackHalfTransitionObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  });
  await page.locator("#novel-layer").dispatchEvent("click");
  await page.locator("#novel-layer").dispatchEvent("click");
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, toId, { timeout: 15000 });
  await page.waitForFunction((file) => getComputedStyle(document.querySelector("#novel-layer")).backgroundImage.includes(file), expectedFile, { timeout: 3000 });
  const current = await presentation(page);
  const transitionSeen = await page.evaluate(() => globalThis.__gaiaBackHalfTransitionSeen);
  assert(current.backgroundImage.includes(expectedFile), `${viewportName}/${fromId}→${toId}: background did not switch`);
  assert(transitionSeen, `${viewportName}/${fromId}→${toId}: approved transition did not run`);
  report.boundaries.push({ viewport: viewportName, fromId, toId, expectedFile, transitionSeen, passed: true });
};

const checkStableBoundary = async (page, viewportName, fromId, toId) => {
  await bootAt(page, fromId);
  if (fromId === "final_record_017") {
    await page.evaluate(() => {
      globalThis.__gaiaOperationsPhoneSurface = document.querySelector("#novel-operations-phone-surface");
      globalThis.__gaiaOperationsPhoneFrame = document.querySelector(".novel-operations-phone");
    });
  }
  await page.evaluate(() => {
    globalThis.__gaiaBackHalfTransitionSeen = false;
    globalThis.__gaiaBackHalfTransitionObserver?.disconnect();
    globalThis.__gaiaBackHalfTransitionObserver = new MutationObserver(() => {
      if (document.body.classList.contains("scene-transitioning")) globalThis.__gaiaBackHalfTransitionSeen = true;
    });
    globalThis.__gaiaBackHalfTransitionObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  });
  await page.locator("#novel-layer").dispatchEvent("click");
  await page.locator("#novel-layer").dispatchEvent("click");
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, toId, { timeout: 15000 });
  if (toId === "return_to_start_021") {
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#novel-character-sakuya")).opacity) > 0, null, { timeout: 3000 });
  }
  const transitionSeen = await page.evaluate(() => globalThis.__gaiaBackHalfTransitionSeen);
  const current = await presentation(page);
  let phoneIdentity = null;
  if (fromId === "final_record_017") {
    phoneIdentity = await page.evaluate(() => globalThis.__gaiaOperationsPhoneSurface === document.querySelector("#novel-operations-phone-surface")
      && globalThis.__gaiaOperationsPhoneFrame === document.querySelector(".novel-operations-phone"));
    assert(phoneIdentity, `${viewportName}/${fromId}->${toId}: phone DOM/frame was replaced`);
    assert(current.phone.visible && current.phone.visibleViews[0] === "is-audio", `${viewportName}/${toId}: incoming audio phase is not visible`);
  }
  if (fromId === "return_to_start_020") {
    assert(current.castMode === "central-entrance-distance", `${viewportName}/${toId}: physical Sakuya gate did not open`);
    assert(current.characters.sakuya?.visibility === "visible" && current.characters.sakuya?.opacity > 0, `${viewportName}/${toId}: Sakuya is not visible after the physical gate`);
  }
  assert(!transitionSeen, `${viewportName}/${fromId}→${toId}: same-surface step replayed the scene transition`);
  report.stableBoundaries.push({ viewport: viewportName, fromId, toId, transitionSeen, passed: true });
  Object.assign(report.stableBoundaries.at(-1), { phoneIdentity });
};

const advanceStep = async (page) => {
  const previous = await page.locator("#novel-layer").getAttribute("data-step-id");
  for (let guard = 0; guard < 64; guard += 1) {
    await page.locator("#novel-layer").dispatchEvent("click");
    if (await page.locator("#novel-layer").getAttribute("data-step-id") !== previous) break;
  }
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, previous, { timeout: 15000 });
};

const checkDistanceContinuity = async (page, viewportName) => {
  const targetIds = ["return_to_start_021", "return_to_start_029", "return_to_start_032", "return_to_start_035"];
  await bootAt(page, "return_to_start_020");
  await page.waitForTimeout(850);
  const hidden = await presentation(page);
  assert(hidden.castSuppressed && hidden.characters.sakuya?.visibility !== "visible", `${viewportName}/return_to_start_020: Sakuya leaked before the physical gate`);
  await advanceStep(page);
  assert(await page.locator("#novel-layer").getAttribute("data-step-id") === targetIds[0], `${viewportName}: physical gate did not advance to _021`);
  await page.waitForTimeout(850);
  await page.evaluate(() => {
    const figure = document.querySelector("#novel-character-sakuya");
    const portrait = figure?.querySelector(".novel-character-portrait");
    globalThis.__gaiaDistanceReentryEvents = [];
    const record = (event) => globalThis.__gaiaDistanceReentryEvents.push({ type: event.type, propertyName: event.propertyName || "", animationName: event.animationName || "" });
    figure?.addEventListener("transitionrun", record);
    figure?.addEventListener("animationstart", record);
    portrait?.addEventListener("transitionrun", record);
    portrait?.addEventListener("animationstart", record);
  });

  const snapshots = [];
  for (const targetId of targetIds) {
    while (await page.locator("#novel-layer").getAttribute("data-step-id") !== targetId) await advanceStep(page);
    await page.waitForTimeout(850);
    const current = await presentation(page);
    const sakuya = current.characters.sakuya;
    assert(current.castMode === "central-entrance-distance" && !current.castSuppressed, `${viewportName}/${targetId}: distance cast mode was lost`);
    assert(sakuya?.backgroundImage.includes("sakuya-calm-07-v1.png") && !sakuya.backgroundImage.includes("-bust-"), `${viewportName}/${targetId}: normal-dialogue bust leaked into distance framing: ${sakuya?.backgroundImage}`);
    assert(sakuya.backgroundPosition === "50% 100%" && sakuya.backgroundSize === "contain" && sakuya.backgroundRepeat === "no-repeat", `${viewportName}/${targetId}: distance portrait crop changed: ${JSON.stringify(sakuya)}`);
    assert(sakuya.animationName === "none", `${viewportName}/${targetId}: distance portrait retained a re-entry animation: ${sakuya.animationName}`);
    assert(current.characters.mizuha?.visibility === "hidden" && current.characters.amane?.visibility === "hidden", `${viewportName}/${targetId}: another character leaked into distance framing`);
    assert(current.bodyOverflow <= 1, `${viewportName}/${targetId}: distance framing introduced document overflow: ${JSON.stringify({ bodyOverflow: current.bodyOverflow, layerOverflow: current.layerOverflow, overflowingElements: current.overflowingElements })}`);
    const screenshotPath = path.join(outputDir, `distance-continuity-${viewportName}-${targetId}.png`);
    await page.screenshot({ path: screenshotPath, animations: "disabled", timeout: 90000 });
    snapshots.push({ stepId: targetId, sakuya, screenshotPath });
  }

  const reference = snapshots[0].sakuya;
  for (const snapshot of snapshots.slice(1)) {
    const current = snapshot.sakuya;
    for (const key of ["left", "top", "right", "bottom", "width", "height", "opacity"]) {
      assert(Math.abs(current[key] - reference[key]) <= 1, `${viewportName}/${snapshot.stepId}: distance ${key} changed from ${reference[key]} to ${current[key]}`);
    }
    for (const key of ["backgroundImage", "backgroundPosition", "backgroundRepeat", "backgroundSize"]) {
      assert(current[key] === reference[key], `${viewportName}/${snapshot.stepId}: distance ${key} changed`);
    }
  }
  const reentryEvents = await page.evaluate(() => globalThis.__gaiaDistanceReentryEvents || []);
  assert(reentryEvents.length === 0, `${viewportName}: Sakuya distance preset replayed an animation/transition after _021: ${JSON.stringify(reentryEvents)}`);
  report.distanceContinuity.push({ viewport: viewportName, hiddenStep: "return_to_start_020", snapshots, reentryEvents, passed: true });
};

try {
  const scope = process.env.GAIA_STAGING_SCOPE || "full";
  const viewports = [
    { name: "pc-1440", width: 1440, height: 900 },
    { name: "mobile-390", width: 390, height: 844 },
  ];
  const evidenceSteps = [
    "mode07_abstract_009",
    "interlude_sea_008",
    "interlude_sea_046",
    "mode08_map_layers_001",
    "gx_deep_time_017",
    "mode10_space_009",
    "final_record_009",
    "final_record_018",
    "return_to_start_017",
    "return_to_start_018",
    "return_to_start_020",
    "return_to_start_021",
    "return_to_start_029",
    "return_to_start_032",
  ];
  const interactionEvidenceSteps = [
    "mode03_map_002",
    "mode03_map_003",
    "mode03_map_004",
    "gx_deep_time_016",
    "gx_deep_time_017",
    "gx_deep_time_018",
    "gx_deep_time_019",
  ];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "no-preference" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    if (scope === "interaction") {
      for (const stepId of interactionEvidenceSteps) await capture(page, viewport.name, stepId);
    } else {
      await checkDistanceContinuity(page, viewport.name);
    }
    if (scope === "full") {
      for (const stepId of evidenceSteps) await capture(page, viewport.name, stepId);
      await checkBoundary(page, viewport.name, "mode07_abstract_008", "mode07_abstract_009", "novel-bg-production-shared-meeting-v3.png");
      await checkBoundary(page, viewport.name, "interlude_sea_007", "interlude_sea_008", "novel-bg-zushi-coast-night-v2.png");
      await checkBoundary(page, viewport.name, "interlude_sea_045", "interlude_sea_046", "novel-bg-production-shared-meeting-v3.png");
      await checkBoundary(page, viewport.name, "interlude_sea_067", "mode08_map_layers_001", "novel-bg-exhibition-v3.png");
      await checkBoundary(page, viewport.name, "return_to_start_017", "return_to_start_018", "novel-bg-coastal-venue-v2.png");
      await checkStableBoundary(page, viewport.name, "mode07_abstract_009", "mode07_abstract_010");
      await checkStableBoundary(page, viewport.name, "final_record_017", "final_record_018");
      await checkStableBoundary(page, viewport.name, "return_to_start_020", "return_to_start_021");
    }
    report.viewports.push({ ...viewport, passed: true });
    await context.close();
  }
  assert(report.consoleErrors.length === 0, `console errors: ${report.consoleErrors.join("\n")}`);
  assert(report.pageErrors.length === 0, `page errors: ${report.pageErrors.join("\n")}`);
  assert(report.responses404.length === 0, `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} finally {
  await browser.close();
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  status: report.status,
  viewports: report.viewports,
  evidence: report.evidence.length,
  boundaries: report.boundaries.length,
  stableBoundaries: report.stableBoundaries.length,
  distanceContinuity: report.distanceContinuity.length,
  consoleErrors: report.consoleErrors.length,
  pageErrors: report.pageErrors.length,
  responses404: report.responses404.length,
  outputDir,
}, null, 2));
