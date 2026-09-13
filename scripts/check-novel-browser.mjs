import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4173";
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/novel-browser");
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required.");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = path.dirname(moduleRoot);
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const sharp = (await import(pathToFileURL(path.join(nodeModules, "sharp", "lib", "index.js")))).default;
const pixelmatch = (await import(pathToFileURL(path.join(nodeModules, "pixelmatch", "index.js")))).default;
delete globalThis.GAIA_NOVEL_STORY;
delete globalThis.GAIA_NOVEL_BACKGROUND_CUES;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?browser=${Date.now()}`);
await import(`${pathToFileURL(path.join(projectRoot, "novel-background-cues.js")).href}?browser=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const backgroundCueData = globalThis.GAIA_NOVEL_BACKGROUND_CUES;
const steps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(steps.map((step) => [step.id, step]));
const attachmentSteps = steps.filter((step) => Array.isArray(step.attachments) && step.attachments.length > 0);
const attachmentAssets = Object.freeze({
  BASIL: "slack-attachment-basil-v1.webp",
  FLOWERBED: "slack-attachment-flowerbed-v1.webp",
  MEETING_MAP: "slack-attachment-venue-map-v1.svg",
  VENUE: "slack-attachment-venue-v1.webp",
});
const routeUrl = new URL("/story", baseUrl).href;
const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v2";

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
const report = { baseUrl: routeUrl, screenshots: [], visualDiffs: [], sceneBackgrounds: [], productionBackgrounds: [], backgroundPreloads: [], slackAttachments: [], interactions: [], modeModalChecks: [], chatCastGateChecks: [], reflectionLayouts: [], currentContactLayouts: [], fullWalkthrough: null, viewports: [], sakuyaBust: { dialogues: [], references: [], fullBodyCues: [] }, consoleErrors: [], pageErrors: [], responses404: [] };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const screenshot = async (page, name) => {
  const destination = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: destination, fullPage: false, animations: "disabled", timeout: 90000 });
  report.screenshots.push(destination);
  return destination;
};

const compareBaseline = async (actualPath, baselineName) => {
  const baselinePath = path.join(projectRoot, "tests", "visual-baselines", `${baselineName}.png`);
  const actual = await sharp(actualPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const expected = await sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert(actual.info.width === expected.info.width && actual.info.height === expected.info.height, `${baselineName}: screenshot dimensions differ from baseline`);
  const diffData = Buffer.alloc(actual.data.length);
  const mismatch = pixelmatch(actual.data, expected.data, diffData, actual.info.width, actual.info.height, { threshold: 0.15, includeAA: false });
  const ratio = mismatch / (actual.info.width * actual.info.height);
  const diffPath = path.join(outputDir, `${baselineName}-diff.png`);
  await sharp(diffData, { raw: actual.info }).png().toFile(diffPath);
  report.visualDiffs.push({ name: baselineName, mismatchRatio: ratio, baselinePath, actualPath, diffPath });
  assert(ratio < 0.68, `${baselineName}: visual mismatch ${ratio.toFixed(3)} exceeds recovery threshold`);
};

const baseState = (stepId, overrides = {}) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  audio: { muted: false, volume: 0.1 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "browser-validation",
  ...overrides,
});

const ensureNovelOpen = async (page) => {
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer?.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.waitForTimeout(150);
  await page.locator("#novel-title-screen").waitFor({ state: "visible", timeout: 15000 });
};

const bootTitle = async (page, { clear = false } = {}) => {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  if (clear) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
  }
};

const bootAt = async (page, stepId, overrides = {}, { reducedMotion = false } = {}) => {
  await page.evaluate(({ key, stateValue, configKey, reduced }) => {
    localStorage.setItem(key, JSON.stringify(stateValue));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: reduced }));
  }, { key: STORAGE_KEY, stateValue: baseState(stepId, overrides), configKey: CONFIG_KEY, reduced: reducedMotion });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
};

const currentStepId = (page) => page.locator("#novel-layer").getAttribute("data-step-id");
const assertSlackAttachment = async (page, step, viewportLabel) => {
  const attachment = step.attachments[0];
  const expectedAsset = attachmentAssets[attachment.id];
  assert(expectedAsset, `attachment asset mapping is missing: ${attachment.id}`);
  await bootAt(page, step.id, {}, { reducedMotion: true });
  const figure = page.locator(`.novel-slack-attachment[data-attachment="${attachment.id}"]`).last();
  const image = figure.locator("img");
  await image.waitFor({ state: "visible", timeout: 5000 });
  await image.evaluate((node) => node.decode().catch(() => {}));
  const presentation = await figure.evaluate((node) => {
    const imageNode = node.querySelector("img");
    const imageRect = imageNode.getBoundingClientRect();
    const figureRect = node.getBoundingClientRect();
    const workspaceRect = node.closest(".novel-slack-workspace").getBoundingClientRect();
    return {
      source: imageNode.getAttribute("src"),
      alt: imageNode.getAttribute("alt"),
      loaded: imageNode.complete && imageNode.naturalWidth > 0 && imageNode.naturalHeight > 0,
      aspectRatioDelta: Math.abs((imageRect.width / imageRect.height) - (imageNode.naturalWidth / imageNode.naturalHeight)),
      figureContained: figureRect.left >= workspaceRect.left - 1 && figureRect.right <= workspaceRect.right + 1,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      errorVisible: !node.querySelector(".novel-slack-attachment-error").hidden,
      rawTokenCount: [...document.querySelectorAll(".novel-slack-message")].filter((message) => /[［[](?:画像添付|添付画像)｜/u.test(message.textContent)).length,
    };
  });
  assert(presentation.source.includes(expectedAsset) && presentation.alt === attachment.description, `${attachment.id} used the wrong source or alt: ${JSON.stringify(presentation)}`);
  assert(presentation.loaded && presentation.aspectRatioDelta < 0.02 && presentation.figureContained && !presentation.horizontalOverflow && !presentation.errorVisible, `${attachment.id} attachment layout or loading failed at ${viewportLabel}: ${JSON.stringify(presentation)}`);
  assert(presentation.rawTokenCount === 0, `raw attachment token remained visible at ${viewportLabel}: ${attachment.id}`);
  const fallback = await figure.evaluate((node) => {
    const imageNode = node.querySelector("img");
    const status = node.querySelector(".novel-slack-attachment-error");
    imageNode.dispatchEvent(new Event("error"));
    const result = {
      markedAsError: node.classList.contains("is-error"),
      statusVisible: !status.hidden,
      statusText: status.textContent,
    };
    node.classList.remove("is-error");
    status.hidden = true;
    return result;
  });
  assert(fallback.markedAsError && fallback.statusVisible && fallback.statusText === "画像を読み込めませんでした。", `${attachment.id} attachment fallback failed at ${viewportLabel}: ${JSON.stringify(fallback)}`);
  await figure.scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  const stacking = await figure.evaluate((node) => {
    const cast = document.querySelector(".novel-layer.is-slack .novel-cast");
    const surface = document.querySelector(".novel-slack-surface");
    const contentNodes = [node.closest(".novel-slack-post")?.querySelector(".novel-slack-message"), node.querySelector("img")].filter(Boolean);
    const samples = contentNodes.flatMap((content) => {
      const rect = content.getBoundingClientRect();
      const visibleLeft = Math.max(0, rect.left);
      const visibleTop = Math.max(0, rect.top);
      const visibleRight = Math.min(innerWidth, rect.right);
      const visibleBottom = Math.min(innerHeight, rect.bottom);
      if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return [];
      return [[
        visibleLeft + ((visibleRight - visibleLeft) / 2),
        visibleTop + ((visibleBottom - visibleTop) / 2),
        content,
      ]];
    });
    const occludedSamples = samples.filter(([x, y, content]) => {
      const stack = document.elementsFromPoint(x, y);
      const castIndex = stack.findIndex((element) => element === cast || cast?.contains(element));
      const contentIndex = stack.findIndex((element) => element === content || content.contains(element));
      return castIndex >= 0 && (contentIndex < 0 || castIndex < contentIndex);
    }).length;
    return {
      castZIndex: Number.parseInt(getComputedStyle(cast).zIndex, 10),
      surfaceZIndex: Number.parseInt(getComputedStyle(surface).zIndex, 10),
      sampleCount: samples.length,
      occludedSamples,
    };
  });
  assert(stacking.castZIndex < stacking.surfaceZIndex && stacking.sampleCount > 0 && stacking.occludedSamples === 0, `${attachment.id} Slack cast obscured message content at ${viewportLabel}: ${JSON.stringify(stacking)}`);
  report.slackAttachments.push({ id: attachment.id, stepId: step.id, viewport: viewportLabel, source: expectedAsset, stacking, passed: true });
  await screenshot(page, `slack-attachment-${attachment.id.toLowerCase()}-${viewportLabel}`);
};

const sakuyaBustAssetForExpression = (expression) => ({
  teasing: "sakuya-teasing-bust-07-v2.png",
  startled: "sakuya-teasing-bust-07-v2.png",
  worried: "sakuya-worried-bust-07-v2.png",
  exasperated: "sakuya-worried-bust-07-v2.png",
  sad: "sakuya-sad-bust-07-v2.png",
  soft: "sakuya-sad-bust-07-v2.png",
})[expression] || "sakuya-calm-bust-07-v2.png";

const inspectSakuyaDialogueBust = async (page, step, viewport) => {
  await bootAt(page, step.id, {}, { reducedMotion: true });
  const presentation = await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    const figure = document.querySelector("#novel-character-sakuya");
    const portrait = figure.querySelector(".novel-character-portrait");
    const dialogue = document.querySelector("#novel-dialogue");
    const figureRect = figure.getBoundingClientRect();
    const dialogueRect = dialogue.getBoundingClientRect();
    const style = getComputedStyle(portrait);
    return {
      stepType: layer.dataset.stepType,
      slack: layer.classList.contains("is-slack"),
      castSpeaker: document.querySelector("#novel-cast").dataset.speaker,
      expression: figure.dataset.expression,
      backgroundImage: style.backgroundImage,
      backgroundPosition: style.backgroundPosition,
      backgroundRepeat: style.backgroundRepeat,
      backgroundSize: style.backgroundSize,
      figureOpacity: Number.parseFloat(getComputedStyle(figure).opacity),
      figureTop: figureRect.top,
      figureBottom: figureRect.bottom,
      dialogueTop: dialogueRect.top,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  const expectedAsset = sakuyaBustAssetForExpression(presentation.expression);
  assert(presentation.stepType === "dialogue" && !presentation.slack && presentation.castSpeaker === "sakuya", `Sakuya bust escaped normal dialogue scope at ${step.id}: ${JSON.stringify(presentation)}`);
  assert(presentation.backgroundImage.includes(expectedAsset) && !presentation.backgroundImage.includes("sakuya-calm-07-v1.png"), `Sakuya dialogue used the wrong portrait at ${step.id}: ${JSON.stringify(presentation)}`);
  assert(presentation.backgroundPosition.startsWith("50% 0") && presentation.backgroundRepeat === "no-repeat", `Sakuya bust anchor/repeat regressed at ${step.id}: ${JSON.stringify(presentation)}`);
  const renderedHeight = Number.parseFloat(presentation.backgroundSize.split(" ").at(-1));
  const expectedRange = viewport === "390" ? [839, 1181] : [959, 1501];
  assert(Number.isFinite(renderedHeight) && renderedHeight >= expectedRange[0] && renderedHeight <= expectedRange[1], `Sakuya bust scale is outside the ${viewport} preset at ${step.id}: ${presentation.backgroundSize}`);
  assert(presentation.figureOpacity > 0.98 && presentation.figureTop >= 0 && presentation.figureBottom > presentation.dialogueTop && !presentation.horizontalOverflow, `Sakuya bust/dialogue geometry failed at ${step.id}: ${JSON.stringify(presentation)}`);
  return { stepId: step.id, sceneId: step.sceneId, viewport, expectedAsset, ...presentation };
};

const slackCastSnapshot = (page) => page.evaluate(() => {
  const cast = document.querySelector("#novel-cast");
  const workspace = document.querySelector(".novel-slack-workspace");
  const character = cast.querySelector(`.novel-character--${cast.dataset.speaker}`);
  const workspaceRect = workspace.getBoundingClientRect();
  const characterRect = character?.getBoundingClientRect();
  return {
    stepId: document.querySelector("#novel-layer")?.dataset.stepId,
    device: document.querySelector("#novel-layer")?.dataset.slackDevice || "wide",
    state: globalThis.GaiaNovel.getState().metCharacters,
    gate: cast.dataset.slackCast || "",
    speaker: cast.dataset.speaker,
    castDisplay: getComputedStyle(cast).display,
    castRectCount: cast.getClientRects().length,
    characterRectCount: character?.getClientRects().length || 0,
    characterOpacity: character ? Number.parseFloat(getComputedStyle(character).opacity) : 0,
    characterInset: character ? Number.parseFloat(getComputedStyle(character).right) : 0,
    characterWidthRatio: characterRect ? characterRect.width / workspaceRect.width : 0,
    characterRightBias: characterRect ? (characterRect.left + characterRect.width / 2 - workspaceRect.left) / workspaceRect.width : 0,
    characterBottomGap: characterRect ? Math.abs(characterRect.bottom - workspaceRect.bottom) : 0,
    characterClip: getComputedStyle(cast).clipPath,
    visiblePostAvatars: [...document.querySelectorAll(".novel-slack-avatar")]
      .filter((avatar) => avatar.getClientRects().length > 0).length,
  };
});
const assertSlackCastGate = async (page, { visible, speaker, label }) => {
  if (visible) {
    await page.waitForFunction(() => {
      const cast = document.querySelector("#novel-cast");
      const character = cast?.querySelector(`.novel-character--${cast.dataset.speaker}`);
      return cast?.dataset.slackCast === "visible"
        && character?.getClientRects().length > 0
        && Number.parseFloat(getComputedStyle(character).opacity) > 0.65;
    });
  }
  const state = await slackCastSnapshot(page);
  assert(state.speaker === speaker, `${label}: unexpected large-cast speaker: ${JSON.stringify(state)}`);
  if (visible) {
    assert(state.gate === "visible" && state.castDisplay !== "none" && state.castRectCount > 0 && state.characterRectCount > 0, `${label}: unlocked large cast is not visible: ${JSON.stringify(state)}`);
  } else {
    assert(state.gate === "hidden" && state.castDisplay === "none" && state.castRectCount === 0 && state.characterRectCount === 0, `${label}: locked large cast leaks a frame, silhouette, name, or portrait: ${JSON.stringify(state)}`);
  }
  assert(state.visiblePostAvatars > 0, `${label}: post/typing avatars were hidden with the large cast: ${JSON.stringify(state)}`);
  report.chatCastGateChecks.push({ label, visible, ...state });
  return state;
};
const dialoguePageGeometry = (page) => page.evaluate(() => {
  const dialogue = document.querySelector("#novel-dialogue");
  const text = document.querySelector("#novel-text");
  const dialogueRect = dialogue.getBoundingClientRect();
  const textRect = text.getBoundingClientRect();
  const dialogueStyle = getComputedStyle(dialogue);
  const contentTop = dialogueRect.top + (Number.parseFloat(dialogueStyle.paddingTop) || 0);
  const contentBottom = dialogueRect.bottom - (Number.parseFloat(dialogueStyle.paddingBottom) || 0);
  const renderedLineTops = new Set();
  const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (let offset = 0; offset < node.data.length; offset += 1) {
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + 1);
      const rect = [...range.getClientRects()].find((candidate) => candidate.width > 0 && candidate.height > 0);
      if (rect) renderedLineTops.add(Math.round(rect.top * 2) / 2);
    }
  }
  return {
    characterCount: Number(text.dataset.characterCount),
    explicitLineCount: Number(text.dataset.explicitLineCount),
    measuredLineCount: Number(text.dataset.measuredLineCount),
    maxLineCount: Number(text.dataset.maxLineCount),
    pageCount: Number(text.dataset.pageCount),
    pageIndex: Number(text.dataset.pageIndex),
    renderedLineCount: renderedLineTops.size,
    visibleText: text.getAttribute("aria-label") || text.textContent,
    fontSize: getComputedStyle(text).fontSize,
    inlineFontSize: text.style.fontSize,
    bounds: { textTop: textRect.top, textBottom: textRect.bottom, contentTop, contentBottom },
    fits: textRect.top >= contentTop - 1 && textRect.bottom <= contentBottom + 1,
  };
});
const assertDialoguePageFits = async (page, step) => {
  await page.waitForFunction(() => Boolean(document.querySelector("#novel-text")?.dataset.pageCount));
  const geometry = await dialoguePageGeometry(page);
  assert(geometry.characterCount === Array.from(step.text.replace(/\s/gu, "")).length, `${step.id}: character count was not applied to pagination`);
  assert(geometry.explicitLineCount === step.text.split("\n").length, `${step.id}: explicit line count was not applied to pagination`);
  assert(geometry.measuredLineCount >= 1, `${step.id}: measured line count is invalid`);
  assert(geometry.maxLineCount >= geometry.measuredLineCount, `${step.id}: page exceeded its available line count`);
  assert(geometry.renderedLineCount <= 3, `${step.id}: a fourth rendered line is visible: ${JSON.stringify(geometry)}`);
  assert(!geometry.inlineFontSize, `${step.id}: pagination changed the inline font size`);
  assert(geometry.fits, `${step.id}: dialogue page overflowed: ${JSON.stringify(geometry)}`);
  return geometry;
};
const normalizedDialogueText = (value) => String(value || "").replace(/\s/gu, "");
const assertSentenceAwarePages = (pages, step) => {
  pages.slice(0, -1).forEach((pageText, index) => {
    if (!/[。！？]/u.test(pageText)) return;
    assert(/[。！？][」』】）》〉］〕）”’"']*$/u.test(pageText), `${step.id}: page ${index + 1} includes a fragment of the next sentence: ${JSON.stringify(pages)}`);
  });
};
const collectDialoguePages = async (page, step, { advancePastFinal = false } = {}) => {
  const visiblePages = [];
  let geometry = await assertDialoguePageFits(page, step);
  const expectedPageCount = geometry.pageCount;
  for (let expectedPage = 1; expectedPage <= expectedPageCount; expectedPage += 1) {
    await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 10000 });
    geometry = await assertDialoguePageFits(page, step);
    assert(geometry.pageIndex === expectedPage, `${step.id}: expected page ${expectedPage}, got ${geometry.pageIndex}`);
    assert(await currentStepId(page) === step.id, `${step.id}: story advanced before its final text page`);
    visiblePages.push(geometry.visibleText);
    if (expectedPage < expectedPageCount) {
      await page.locator("#novel-dialogue").click();
      await page.waitForFunction((index) => Number(document.querySelector("#novel-text")?.dataset.pageIndex) === index, expectedPage + 1);
    }
  }
  assert(normalizedDialogueText(visiblePages.join("")) === normalizedDialogueText(step.text), `${step.id}: paginated text did not preserve the full source text`);
  assertSentenceAwarePages(visiblePages, step);
  if (advancePastFinal) {
    await page.locator("#novel-dialogue").click();
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, step.id);
  }
  return { geometry, visiblePages };
};
const startPaginationTrace = (page) => page.evaluate(() => {
  globalThis.__novelPaginationObserver?.disconnect();
  const events = [];
  const record = () => {
    const event = {
      stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
      pageIndex: Number(document.querySelector("#novel-text")?.dataset.pageIndex) || 0,
    };
    const previous = events.at(-1);
    if (!previous || previous.stepId !== event.stepId || previous.pageIndex !== event.pageIndex) events.push(event);
  };
  globalThis.__novelPaginationObserver = new MutationObserver(record);
  globalThis.__novelPaginationObserver.observe(document.querySelector("#novel-layer"), {
    attributes: true,
    subtree: true,
    attributeFilter: ["data-step-id", "data-page-index"],
  });
  globalThis.__novelPaginationTrace = events;
  record();
});
const finishPaginationTrace = (page) => page.evaluate(() => {
  globalThis.__novelPaginationObserver?.disconnect();
  return globalThis.__novelPaginationTrace || [];
});
const assertPaginationTrace = (trace, step, expectedPageCount, mode) => {
  const visitedPages = trace
    .filter((event) => event.stepId === step.id && event.pageIndex > 0)
    .map((event) => event.pageIndex)
    .filter((pageIndex, index, values) => index === 0 || values[index - 1] !== pageIndex);
  const expectedPages = Array.from({ length: expectedPageCount }, (_, index) => index + 1);
  assert(JSON.stringify(visitedPages) === JSON.stringify(expectedPages), `${mode} changed pagination order: ${JSON.stringify(trace)}`);
  assert(trace.some((event) => event.stepId !== step.id), `${mode} did not advance after the final page: ${JSON.stringify(trace)}`);
};
const advanceLinear = async (page) => {
  const previous = await currentStepId(page);
  for (let guard = 0; guard < 64; guard += 1) {
    await page.locator("#novel-layer").dispatchEvent("click");
    if (await currentStepId(page) !== previous) break;
    if (await page.locator("body").evaluate((body) => body.classList.contains("scene-transitioning"))) break;
  }
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, previous);
};

const checkTitleGeometry = async (page) => {
  const geometry = await page.evaluate(() => {
    const screen = document.querySelector("#novel-title-screen");
    const actions = document.querySelector(".novel-title-actions");
    const rect = actions.getBoundingClientRect();
    return {
      internalScroll: ["auto", "scroll"].includes(getComputedStyle(screen).overflowY) && screen.scrollHeight > screen.clientHeight + 1,
      actionBounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewport: { width: innerWidth, height: innerHeight },
      forbiddenCount: document.querySelectorAll(".novel-title-privacy, .novel-legacy-notice, .novel-inline-card, #novel-mode-bridge").length,
    };
  });
  assert(!geometry.internalScroll, "START contains an internal scrollbar");
  assert(geometry.actionBounds.left >= 0 && geometry.actionBounds.right <= geometry.viewport.width, "START actions overflow horizontally");
  assert(geometry.actionBounds.top >= 0 && geometry.actionBounds.bottom <= geometry.viewport.height, "START actions overflow vertically");
  assert(geometry.forbiddenCount === 0, "removed START or nested-card UI remains");
};

const assertNovelDetourModal = async (page, kind) => {
  await page.waitForTimeout(kind === "gx" ? 1200 : 120);
  const state = await page.evaluate((interactionKind) => {
    const novel = document.querySelector("#novel-layer");
    const modeSelector = interactionKind === "gx"
      ? "#gx-layer"
      : interactionKind === "space10"
        ? "#space-layer"
        : interactionKind === "abstract07"
          ? "#gaia-canvas"
          : "#japan-layer";
    const mode = document.querySelector(modeSelector);
    const backdrop = document.querySelector("#gx-story-backdrop");
    const novelStyle = getComputedStyle(novel);
    const modeStyle = getComputedStyle(mode);
    const backdropStyle = getComputedStyle(backdrop);
    const modeRect = mode.getBoundingClientRect();
    const hitTarget = interactionKind === "gx"
      ? document.elementFromPoint(modeRect.left + modeRect.width / 2, modeRect.top + modeRect.height / 2)
      : null;
    return {
      kind: interactionKind,
      viewport: { width: innerWidth, height: innerHeight },
      bodyClasses: document.body.className,
      stepId: novel.dataset.stepId,
      novel: {
        display: novelStyle.display,
        opacity: Number.parseFloat(novelStyle.opacity),
        pointerEvents: novelStyle.pointerEvents,
        backgroundImage: novelStyle.backgroundImage,
      },
      mode: {
        selector: modeSelector,
        display: modeStyle.display,
        visibility: modeStyle.visibility,
        opacity: Number.parseFloat(modeStyle.opacity),
        pointerEvents: modeStyle.pointerEvents,
        returnTo: mode.dataset.returnTo || "",
        bounds: { top: modeRect.top, right: modeRect.right, bottom: modeRect.bottom, left: modeRect.left },
      },
      backdrop: {
        display: backdropStyle.display,
        opacity: Number.parseFloat(backdropStyle.opacity),
      },
      hitTargetInsideMode: interactionKind !== "gx" || Boolean(hitTarget?.closest("#gx-layer")),
    };
  }, kind);
  assert(state.bodyClasses.includes("novel-mode-detour"), `${kind} did not enter the novel modal state: ${JSON.stringify(state)}`);
  assert(state.novel.display !== "none" && state.novel.opacity > 0 && state.novel.backgroundImage !== "none", `${kind} removed the novel scene context: ${JSON.stringify(state)}`);
  assert(state.novel.pointerEvents === "none", `${kind} left the novel layer interactive: ${JSON.stringify(state)}`);
  assert(state.mode.display !== "none" && state.mode.visibility !== "hidden" && state.mode.opacity > 0 && state.mode.pointerEvents !== "none", `${kind} is not the active interaction target: ${JSON.stringify(state)}`);
  if (kind === "gx") {
    assert(state.bodyClasses.includes("gx-open") && state.mode.returnTo === "novel", `GX modal classes are incomplete: ${JSON.stringify(state)}`);
    assert(state.mode.bounds.top > 0 && state.mode.bounds.left > 0 && state.mode.bounds.right < state.viewport.width && state.mode.bounds.bottom < state.viewport.height, `GX did not open as an inset modal: ${JSON.stringify(state)}`);
    assert(state.backdrop.display !== "none" && state.backdrop.opacity > 0 && state.hitTargetInsideMode, `GX modal backdrop or pointer isolation failed: ${JSON.stringify(state)}`);
  }
  report.modeModalChecks.push(state);
};

const checkReflectionControlGeometry = async (page, label) => {
  const geometry = await page.evaluate(() => {
    const proceed = document.querySelector(".novel-reflection-proceed");
    const navButtons = [...document.querySelectorAll(".novel-topbar nav button")].filter((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    });
    const toBounds = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
    const overlaps = (first, second) => Math.min(first.right, second.right) > Math.max(first.left, second.left)
      && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top);
    const centerStack = (rect) => document.elementsFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
    const proceedRect = proceed.getBoundingClientRect();
    const proceedStack = centerStack(proceedRect);
    return {
      proceed: toBounds(proceedRect),
      proceedCenterHit: proceedStack.some((node, index) => index === 0 && (node === proceed || proceed.contains(node))),
      proceedCenterObscuredByNav: proceedStack.some((node) => node.closest?.(".novel-topbar nav")),
      nav: navButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        const stack = centerStack(rect);
        return {
          id: button.id,
          bounds: toBounds(rect),
          intersectsProceed: overlaps(proceedRect, rect),
          centerHit: stack.some((node, index) => index === 0 && (node === button || button.contains(node))),
          centerObscuredByProceed: stack.some((node) => node === proceed || proceed.contains(node)),
        };
      }),
    };
  });
  assert(!geometry.proceedCenterObscuredByNav && geometry.proceedCenterHit, `${label}: reflection proceed is obscured: ${JSON.stringify(geometry)}`);
  assert(geometry.nav.length > 0, `${label}: no visible story controls were available for overlap validation`);
  assert(geometry.nav.every((button) => !button.intersectsProceed && button.centerHit && !button.centerObscuredByProceed), `${label}: reflection proceed overlaps or obscures story controls: ${JSON.stringify(geometry)}`);
  report.reflectionLayouts.push({ label, ...geometry });
};

const checkCurrentContactNonImpact = async (page, label) => {
  const geometry = await page.evaluate(() => ({
    mode: document.querySelector("#novel-mode-readout")?.textContent?.trim() || "",
    location: document.querySelector("#novel-location")?.textContent?.trim() || "",
    reflectionActive: document.querySelector("#novel-layer")?.classList.contains("is-reflection"),
    reflectionVisible: !document.querySelector("#novel-reflection-surface")?.hidden,
    proceedCount: document.querySelectorAll(".novel-reflection-proceed").length,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert(geometry.mode.includes("CURRENT CONTACT"), `${label}: CURRENT CONTACT heading changed: ${JSON.stringify(geometry)}`);
  assert(geometry.location.length > 0 && !geometry.reflectionActive && !geometry.reflectionVisible && geometry.proceedCount === 0 && !geometry.horizontalOverflow, `${label}: reflection layout leaked into CURRENT CONTACT: ${JSON.stringify(geometry)}`);
  report.currentContactLayouts.push({ label, ...geometry });
};

const operateInteraction = async (page, step, { record = false } = {}) => {
  await page.locator(".novel-interaction-open").click();
  await page.locator(".story-detour-dock").waitFor({ state: "visible", timeout: 15000 });
  await assertNovelDetourModal(page, step.interaction.kind);
  if (record) await screenshot(page, `mode-${step.interaction.kind}-open`);
  if (step.interaction.kind === "gx") {
    for (let index = 0; index < 3; index += 1) await page.locator(".story-detour-controls button").first().click();
  } else if (step.interaction.kind === "map03" || step.interaction.kind === "map08") {
    await page.locator("#japan-layer").waitFor({ state: "visible" });
    const count = await page.locator(".story-detour-controls button").count();
    for (let index = 0; index < count; index += 1) {
      await page.locator(".story-detour-controls button").nth(index).click();
      if (record) await screenshot(page, `mode-${step.interaction.kind}-layer-${index + 1}`);
    }
  } else if (step.interaction.kind === "abstract07") {
    await page.locator("#gaia-canvas").click({ position: { x: 320, y: 260 }, force: true });
    await page.waitForFunction(() => globalThis.GaiaNovel.getState().viewed.mode07AbstractPoint);
    const count = await page.locator(".story-detour-controls button").count();
    for (let index = 0; index < count; index += 1) await page.locator(".story-detour-controls button").nth(index).click();
  } else if (step.interaction.kind === "space10") {
    await page.locator("#space-layer").waitFor({ state: "visible" });
    await page.locator("#space-canvas").click({ position: { x: 300, y: 240 }, force: true });
  }
  await page.waitForFunction(() => !document.querySelector("#story-detour-return")?.disabled);
  await page.locator("#story-detour-return").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, step.id, { timeout: 15000 });
  const persisted = await page.evaluate(() => globalThis.GaiaNovel.getState().viewed);
  if (record) report.interactions.push({ kind: step.interaction.kind, returnedToStory: true, persisted });
};

const completeInteraction = async (page, step) => {
  await bootAt(page, step.id, {}, { reducedMotion: true });
  await operateInteraction(page, step, { record: true });
};

const runFullWalkthrough = async (page) => {
  await bootTitle(page, { clear: true });
  await page.locator("#novel-start-button").click();
  await page.waitForFunction(() => Boolean(document.querySelector("#novel-layer")?.dataset.stepId));
  assert(Object.values(await page.evaluate(() => globalThis.GaiaNovel.getState().metCharacters)).every((value) => value === false), "NEW GAME began with a large chat cast already unlocked");
  const visited = [];
  const interactionKinds = new Set();
  for (let guard = 0; guard < steps.length + 20; guard += 1) {
    const id = await currentStepId(page);
    const step = stepMap.get(id);
    assert(step, `full walkthrough reached unknown step: ${id}`);
    if (await page.locator("#novel-chapter-card").isVisible()) {
      await page.locator("#novel-layer").dispatchEvent("click");
      await page.locator("#novel-chapter-card").waitFor({ state: "hidden" });
    }
    visited.push(id);
    if (step.type === "end") {
      const state = await page.evaluate(() => globalThis.GaiaNovel.getState());
      assert(state.clear === true, "full walkthrough reached END without clear state");
      assert(Object.values(state.metCharacters).every((value) => value === true), `full walkthrough did not unlock all three meeting flags: ${JSON.stringify(state.metCharacters)}`);
      assert(interactionKinds.size === 5, `full walkthrough used ${interactionKinds.size} / 5 display-mode interactions`);
      report.fullWalkthrough = { reachedEnd: true, visitedSteps: visited.length, interactionKinds: [...interactionKinds] };
      return;
    }
    if (step.type === "choice") {
      const selector = step.choiceId === "editorial_choice" ? "#novel-evidence-surface nav button" : "#novel-choices button";
      await page.locator(selector).first().click();
      await page.waitForFunction((previous) => document.querySelector("#novel-layer")?.dataset.stepId !== previous, id);
    } else if (step.type === "reflectionChoice") {
      await page.locator(".novel-reflection-proceed").click();
      await page.waitForFunction((previous) => document.querySelector("#novel-layer")?.dataset.stepId !== previous, id);
    } else if (step.type === "interaction") {
      interactionKinds.add(step.interaction.kind);
      await operateInteraction(page, step);
    } else if (step.type === "result") {
      await page.locator(".novel-result-shell button").click();
      await page.waitForFunction((previous) => document.querySelector("#novel-layer")?.dataset.stepId !== previous, id);
    } else {
      await advanceLinear(page);
    }
  }
  throw new Error(`full walkthrough did not reach END within ${steps.length + 20} transitions`);
};

if (process.env.GAIA_BROWSER_SCOPE === "walkthrough") {
  const walkthroughContext = await browser.newContext({ viewport: { width: 2048, height: 1114 }, reducedMotion: "reduce" });
  const walkthroughPage = await walkthroughContext.newPage();
  attachDiagnostics(walkthroughPage, "walkthrough-only");
  await runFullWalkthrough(walkthroughPage);
  assert(report.consoleErrors.length === 0, `walkthrough console errors: ${JSON.stringify(report.consoleErrors)}`);
  assert(report.pageErrors.length === 0, `walkthrough page errors: ${JSON.stringify(report.pageErrors)}`);
  assert(report.responses404.length === 0, `walkthrough 404 responses: ${JSON.stringify(report.responses404)}`);
  const scopedReportPath = path.join(outputDir, "walkthrough-report.json");
  await writeFile(scopedReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await walkthroughContext.close();
  await browser.close();
  console.log(`Novel walkthrough passed: ${scopedReportPath}`);
  process.exit(0);
}

let context;
try {
  context = await browser.newContext({ viewport: { width: 2048, height: 1114 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  attachDiagnostics(page, "desktop-2048");
  await bootTitle(page, { clear: true });
  await checkTitleGeometry(page);
  assert(await page.locator("#novel-title-privacy").count() === 0, "START notice remains");
  const titlePath = await screenshot(page, "start");
  await compareBaseline(titlePath, "start");

  const backgroundCases = [
    ["current_exhibition", "novel-bg-exhibition-v3.png", "scene-exhibition"],
    ["opening_empty_seat", "novel-bg-workroom-v2.png", "scene-workroom"],
    ["first_meeting_promise", "novel-bg-online-night-v2.png", "scene-online"],
    ["prologue_basil", "novel-bg-garden-center-v2.png", "scene-garden-center"],
    ["first_meeting_hall", "novel-bg-coastal-venue-v3.png", "scene-coastal-venue"],
    ["festival_walk", "novel-bg-coastal-venue-v2.png", "scene-festival-walk"],
    ["interlude_sea", "novel-bg-production-shared-meeting-v3.png", "scene-interlude-departure"],
  ];
  for (const [sceneId, expectedFile, screenshotName] of backgroundCases) {
    const sceneStep = steps.find((candidate) => candidate.sceneId === sceneId && ["dialogue", "chat"].includes(candidate.type))
      || steps.find((candidate) => candidate.sceneId === sceneId);
    await bootAt(page, sceneStep.id);
    const backgroundImage = await page.locator("#novel-layer").evaluate((node) => getComputedStyle(node).backgroundImage);
    assert(backgroundImage.includes(expectedFile), `${sceneId} uses the wrong background: ${backgroundImage}`);
    assert(!backgroundImage.includes("novel-background-v1") && !backgroundImage.includes("assets/characters"), `${sceneId} still uses character-composited background art`);
    report.sceneBackgrounds.push({ sceneId, expectedFile, passed: true });
    await screenshot(page, screenshotName);
  }

  // production_year has step-level background cues and is audited separately.
  const productionSteps = steps.filter((step) => step.sceneId === "production_year");
  const productionRuntimeCues = await page.evaluate((stepIds) => stepIds.map((stepId) => globalThis.GaiaNovel.getBackgroundCue(stepId)), productionSteps.map((step) => step.id));
  assert(productionRuntimeCues.length === 261 && productionRuntimeCues.every((cue) => cue?.assetPath), "production_year has an unresolved background cue");
  assert(productionRuntimeCues.every((cue) => !cue.assetPath.includes("novel-bg-production-night-v2.png")), "production_year still references the old production-night background");
  assert(productionRuntimeCues.every((cue) => !/novel-bg-(?:amane|mizuha|sakuya)-room-v1\.png$/.test(cue.assetPath)), "production_year uses an unqualified room-v1 fallback");

  const productionEvidenceSteps = [
    "production_year_001", "production_year_007", "production_year_060", "production_year_080", "production_year_083",
    "production_year_086", "production_year_089", "production_year_090", "production_year_103", "production_year_122",
    "production_year_150", "production_year_156", "production_year_168", "production_year_169", "production_year_170", "production_year_175", "production_year_195",
    "production_year_200", "production_year_215", "production_year_233", "production_year_239", "production_year_248",
    "production_year_254", "production_year_257", "production_year_259",
  ];
  const preloadTargets = new Map([
    ["production_year_083", "novel-bg-sakuya-room-day-v1.png"],
    ["production_year_168", "novel-bg-production-station-meeting-v1.png"],
  ]);
  for (const stepId of productionEvidenceSteps) {
    const step = stepMap.get(stepId);
    const cue = backgroundCueData.forStep(step);
    const expectedFile = path.basename(cue.assetPath);
    await bootAt(page, stepId);
    const presentation = await page.locator("#novel-layer").evaluate((node) => ({
      backgroundImage: getComputedStyle(node).backgroundImage,
      cueId: node.dataset.backgroundCue,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert(presentation.backgroundImage.includes(expectedFile), `${stepId} uses the wrong production background: ${presentation.backgroundImage}`);
    assert(presentation.cueId === cue.id && !presentation.horizontalOverflow, `${stepId} cue presentation failed: ${JSON.stringify(presentation)}`);
    const preloadTarget = preloadTargets.get(stepId);
    if (preloadTarget) {
      await page.waitForFunction((filename) => performance.getEntriesByType("resource").some((entry) => entry.name.includes(filename)), preloadTarget, { timeout: 5000 });
      report.backgroundPreloads.push({ stepId, nextAsset: preloadTarget, requestedBeforeBoundary: true });
    }
    report.productionBackgrounds.push({ viewport: "2048x1114", stepId, cueId: cue.id, assetPath: cue.assetPath, passed: true });
    await screenshot(page, `production-${stepId.slice(-3)}-desktop`);
  }

  const productionTransitionCases = productionSteps.slice(0, -1)
    .map((step, index) => [step, productionSteps[index + 1]])
    .filter(([fromStep, toStep]) => backgroundCueData.forStep(fromStep).assetPath !== backgroundCueData.forStep(toStep).assetPath)
    .map(([fromStep, toStep]) => [fromStep.id, toStep.id]);
  for (const [fromStepId, toStepId] of productionTransitionCases) {
    const fromCue = backgroundCueData.forStep(stepMap.get(fromStepId));
    const toCue = backgroundCueData.forStep(stepMap.get(toStepId));
    const fromFile = path.basename(fromCue.assetPath);
    const toFile = path.basename(toCue.assetPath);
    await bootAt(page, fromStepId);
    for (let guard = 0; guard < 64; guard += 1) {
      await page.locator("#novel-layer").dispatchEvent("click");
      await page.waitForTimeout(24);
      if (await page.locator("body").evaluate((body) => body.classList.contains("scene-transitioning"))) break;
    }
    await page.waitForFunction(() => document.body.classList.contains("scene-transitioning"), null, { timeout: 8000 });
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, toStepId, { timeout: 8000 });
    const frame = await page.locator("#novel-layer").evaluate((layer) => ({
      currentBackground: getComputedStyle(layer).backgroundImage,
      bufferedBackground: getComputedStyle(layer, "::before").backgroundImage,
      buffered: layer.classList.contains("is-background-buffered"),
      releasing: layer.classList.contains("is-background-releasing"),
    }));
    assert(frame.currentBackground.includes(toFile) && frame.bufferedBackground.includes(fromFile) && frame.buffered && frame.releasing, `${fromStepId}->${toStepId} did not preserve the old background beneath the new cue: ${JSON.stringify(frame)}`);
    report.productionBackgrounds.push({ viewport: "2048x1114", transition: `${fromStepId}->${toStepId}`, from: fromCue.id, to: toCue.id, layered: true, passed: true });
    await screenshot(page, `production-transition-${fromStepId.slice(-3)}-${toStepId.slice(-3)}`, { animations: "allow" });
    await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning"), null, { timeout: 8000 });
  }
  await bootAt(page, "production_year_087");
  await advanceLinear(page);
  assert(await currentStepId(page) === "production_year_088", "same-cue production step did not advance normally");
  assert(!await page.locator("body").evaluate((body) => body.classList.contains("scene-transitioning")), "same production background reanimated on every step");
  report.productionBackgrounds.push({ viewport: "2048x1114", transition: "production_year_087->production_year_088", sameCueDidNotReanimate: true, passed: true });

  const inlineRecord = stepMap.get("mode07_abstract_026");
  await bootAt(page, inlineRecord.id);
  await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 5000 });
  const inlineRecordPresentation = await page.evaluate(() => {
    const location = document.querySelector("#novel-location");
    return {
      dialogueVisible: !document.querySelector("#novel-dialogue").hidden,
      evidenceHidden: document.querySelector("#novel-evidence-surface").hidden,
      speaker: document.querySelector("#novel-speaker").textContent,
      text: document.querySelector("#novel-text").textContent,
      paginationApplied: Boolean(document.querySelector("#novel-text").dataset.pageCount),
      sceneLabelVisible: !document.querySelector("#novel-source-label").hidden,
      sourcePanelAbsent: !document.querySelector("#novel-source-panel"),
      sceneLabelStatic: document.querySelector("#novel-source-label").tagName === "DIV"
        && !document.querySelector("#novel-source-label").hasAttribute("tabindex")
        && getComputedStyle(document.querySelector("#novel-source-label")).pointerEvents === "none",
      castSpeaker: document.querySelector("#novel-cast").dataset.speaker,
      avatarHidden: document.querySelector("#novel-avatar").hidden,
      locationText: location.textContent,
      locationParent: location.parentElement?.id,
      locationShadow: getComputedStyle(location).textShadow,
      obsoleteFooterLocation: document.querySelectorAll(".novel-footer #novel-location").length,
      signalTitleHidden: Boolean(document.querySelector("#novel-signal-title")?.hidden),
    };
  });
  assert(inlineRecordPresentation.dialogueVisible && inlineRecordPresentation.evidenceHidden && inlineRecordPresentation.speaker === "観測メモ" && inlineRecordPresentation.sceneLabelVisible, `record did not use the normal novel presentation: ${JSON.stringify(inlineRecordPresentation)}`);
  assert(inlineRecordPresentation.sourcePanelAbsent && inlineRecordPresentation.sceneLabelStatic, `obsolete clickable observation details remain: ${JSON.stringify(inlineRecordPresentation)}`);
  assert(!inlineRecordPresentation.paginationApplied, `special record UI incorrectly used normal-text pagination: ${JSON.stringify(inlineRecordPresentation)}`);
  assert(inlineRecordPresentation.castSpeaker === "narrator" && inlineRecordPresentation.avatarHidden, `source record unexpectedly displayed a character portrait: ${JSON.stringify(inlineRecordPresentation)}`);
  assert(inlineRecordPresentation.text.includes("サクヤ本人から届いた文章") && inlineRecordPresentation.text.includes("すぐに意味を決めるんじゃなくて") && !/LOCAL SOURCE|SOURCE|観測記録\s*\//.test(inlineRecordPresentation.text), `record exposed internal labels or lost canonical copy: ${JSON.stringify(inlineRecordPresentation)}`);
  assert(inlineRecordPresentation.locationText === "10月31日（土） 23:00｜最終画面の確認" && inlineRecordPresentation.locationParent === "novel-source-label" && inlineRecordPresentation.obsoleteFooterLocation === 0 && inlineRecordPresentation.signalTitleHidden && inlineRecordPresentation.locationShadow !== "none", `dated scene location was not moved into the readable upper caption: ${JSON.stringify(inlineRecordPresentation)}`);
  assert(await page.locator(".novel-evidence-card").count() === 0, "obsolete full-screen record card remains");
  await screenshot(page, "record-note");

  const backgroundTransitionScene = story.scenes.find((scene) => scene.id === "opening_empty_seat");
  const backgroundTransitionStep = backgroundTransitionScene.steps.at(-1);
  await bootAt(page, backgroundTransitionStep.id);
  await page.waitForTimeout(200);
  const backgroundBeforeTransition = await page.locator("#novel-layer").evaluate((node) => getComputedStyle(node).backgroundImage);
  await advanceLinear(page);
  await page.waitForFunction(() => document.body.classList.contains("scene-transitioning"));
  assert(await page.locator("#scene-transition").isVisible(), "novel background change did not use the shared scene transition canvas");
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, "prologue_online_circle_001", { timeout: 5000 });
  const backgroundAfterTransition = await page.locator("#novel-layer").evaluate((node) => getComputedStyle(node).backgroundImage);
  assert(backgroundBeforeTransition.includes("novel-bg-workroom-v2.png") && backgroundAfterTransition.includes("novel-bg-online-night-v2.png"), "novel background transition did not swap the expected scenes");
  await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning"), null, { timeout: 5000 });

  const stableRevealStep = steps.find((step) => step.id === "current_exhibition_006");
  await bootAt(page, stableRevealStep.id);
  await page.locator("#novel-text.is-revealing .novel-line").first().waitFor({ state: "attached", timeout: 5000 });
  const revealGeometry = () => page.locator("#novel-text").evaluate((text) => ({
    box: (() => { const rect = text.getBoundingClientRect(); return [rect.left, rect.top, rect.width, rect.height]; })(),
    lines: [...text.querySelectorAll(".novel-line")].map((line) => {
      const rect = line.getBoundingClientRect();
      return [rect.left, rect.top, rect.width, rect.height];
    }),
  }));
  const revealStartGeometry = await revealGeometry();
  await page.waitForTimeout(220);
  const revealMidGeometry = await revealGeometry();
  await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 5000 });
  const revealEndGeometry = await revealGeometry();
  assert(revealStartGeometry.lines.length >= 3, `long narration was not measured into stable lines: ${JSON.stringify(revealStartGeometry)}`);
  assert(JSON.stringify(revealStartGeometry) === JSON.stringify(revealMidGeometry) && JSON.stringify(revealMidGeometry) === JSON.stringify(revealEndGeometry), `narration geometry moved during or after text reveal: ${JSON.stringify({ revealStartGeometry, revealMidGeometry, revealEndGeometry })}`);
  assert(await page.locator("#novel-cursor").isHidden(), "text cursor remained visible after reveal completed");

  const nativeFontStep = steps.find((step) => step.id === "current_exhibition_001");
  const overflowRegressionStep = steps.find((step) => step.id === "current_exhibition_006");
  const sentenceBoundaryRegressionStep = steps.find((step) => step.id === "current_exhibition_010");
  const dialogueSentenceRegressionStep = steps
    .filter((step) => step.type === "dialogue" && (step.text.match(/[。！？]/gu) || []).length >= 2)
    .sort((left, right) => right.text.length - left.text.length)[0];
  await bootAt(page, nativeFontStep.id);
  const nativeFontGeometry = await assertDialoguePageFits(page, nativeFontStep);
  await bootAt(page, overflowRegressionStep.id);
  const overflowRegressionGeometry = await assertDialoguePageFits(page, overflowRegressionStep);
  assert(overflowRegressionGeometry.pageCount > 1, "long narration was not split across pages");
  assert(overflowRegressionGeometry.maxLineCount === 3, "desktop dialogue did not reserve three lines per page");
  assert(overflowRegressionGeometry.measuredLineCount === overflowRegressionGeometry.maxLineCount, "long narration turned the page before using its final available line");
  assert(overflowRegressionGeometry.fontSize === nativeFontGeometry.fontSize, "long narration changed the dialogue font size");
  const firstPageFontSize = overflowRegressionGeometry.fontSize;
  await page.locator("#novel-dialogue").click();
  await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 10000 });
  assert(await currentStepId(page) === overflowRegressionStep.id, "completing the reveal advanced the story step");
  assert((await dialoguePageGeometry(page)).pageIndex === 1, "completing the reveal skipped the first text page");
  const collectedDesktopPages = await collectDialoguePages(page, overflowRegressionStep);
  assert(collectedDesktopPages.geometry.fontSize === firstPageFontSize, "page turn changed the dialogue font size");
  await screenshot(page, "dialogue-pagination");
  await page.locator("#novel-dialogue").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, overflowRegressionStep.id);

  const explicitMultilineStep = steps
    .filter((step) => ["narration", "dialogue"].includes(step.type) && step.text.includes("\n"))
    .sort((left, right) => right.text.split("\n").length - left.text.split("\n").length)[0];
  if (explicitMultilineStep) {
    await bootAt(page, explicitMultilineStep.id);
    await assertDialoguePageFits(page, explicitMultilineStep);
  }

  const sharedBackgroundScene = story.scenes.find((scene) => scene.id === "absence");
  const sharedBackgroundStep = sharedBackgroundScene.steps.at(-1);
  await bootAt(page, sharedBackgroundStep.id);
  await page.locator("#novel-dialogue").click();
  if (await currentStepId(page) === sharedBackgroundStep.id) await page.locator("#novel-dialogue").click();
  assert(!await page.locator("body").evaluate((node) => node.classList.contains("scene-transitioning")), "unchanged story background incorrectly triggered a scene transition");
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.sceneId === "search");

  const chat = steps.find((step) => step.id === "opening_empty_seat_005");
  await bootAt(page, chat.id);
  assert(await page.locator("#novel-dialogue").isVisible(), "Slack must float above the normal dialogue window");
  assert(await page.locator(".novel-slack-workspace").count() === 1, "Slack must be one surface");
  assert(await page.locator(".novel-slack-post").count() === 1, "Slack thread must begin with one root post");
  assert(await page.locator(".novel-slack-typing").isVisible(), "continued Slack conversation must show a typing indicator");
  const firstSlackAvatars = await page.evaluate(() => ({
    amane: getComputedStyle(document.querySelector('.novel-slack-post[data-speaker="amane"] .novel-slack-avatar')).backgroundImage,
    mizuhaTyping: getComputedStyle(document.querySelector('.novel-slack-typing[data-speaker="mizuha"] .novel-slack-avatar')).backgroundImage,
  }));
  assert(firstSlackAvatars.amane.includes("slack-avatar-amane-v1.webp") && firstSlackAvatars.mizuhaTyping.includes("slack-avatar-mizuha-v1.webp"), `character mascot avatars are missing from Slack: ${JSON.stringify(firstSlackAvatars)}`);
  await page.waitForFunction(() => !document.querySelector("#novel-layer")?.classList.contains("is-slack-entering"));
  await assertSlackCastGate(page, { visible: false, speaker: "sora", label: "desktop pre-meeting Amane" });
  const slackGeometry = await page.evaluate(() => {
    const workspace = document.querySelector(".novel-slack-workspace");
    const dialogue = document.querySelector("#novel-dialogue");
    const rect = workspace.getBoundingClientRect();
    const dialogueRect = dialogue.getBoundingClientRect();
    return {
      widthRatio: rect.width / innerWidth,
      heightRatio: rect.height / innerHeight,
      sitsAboveDialogue: rect.top < dialogueRect.top && rect.bottom <= dialogueRect.bottom,
      background: getComputedStyle(workspace).backgroundColor,
      mainBackground: getComputedStyle(workspace.querySelector("main")).backgroundColor,
      backdropFilter: getComputedStyle(workspace).backdropFilter,
    };
  });
  const slackAlpha = (color) => Number(color.match(/[\d.]+(?=\))/u)?.[0] || 1);
  assert(slackGeometry.widthRatio < 0.64 && slackGeometry.heightRatio < 0.62, `Slack overlay is still too large: ${JSON.stringify(slackGeometry)}`);
  assert(slackGeometry.sitsAboveDialogue && slackAlpha(slackGeometry.background) <= 0.3 && slackAlpha(slackGeometry.mainBackground) <= 0.5 && !slackGeometry.backdropFilter.includes("blur"), `Slack overlay placement/translucency failed: ${JSON.stringify(slackGeometry)}`);
  await advanceLinear(page);
  assert(await page.locator(".novel-slack-post").count() === 2, "second Slack message did not append to the thread");
  assert((await page.locator(".novel-slack-post").first().innerText()).includes("先に入ってる"), "earlier Slack post disappeared");
  assert(await page.locator(".novel-slack-typing").isVisible(), "typing indicator did not continue before the next reply");
  assert((await page.locator(".novel-slack-post.is-new").evaluate((post) => getComputedStyle(post).animationName)) === "novel-slack-reply-in", "new Slack reply has no append animation");
  assert((await page.locator(".novel-slack-typing i b").first().evaluate((dot) => getComputedStyle(dot).animationName)) === "novel-slack-typing", "Slack typing indicator is not animated");
  const slackPath = await screenshot(page, "slack");
  await compareBaseline(slackPath, "slack");
  await advanceLinear(page);
  assert(await page.locator(".novel-slack-post").count() === 3, "third Slack message did not append to the thread");
  assert(await page.locator(".novel-slack-post.is-reply").count() === 2, "Slack replies are not connected as a thread");
  const speakerText = await page.locator(".novel-slack-post p strong").allTextContents();
  assert(speakerText.length === 3, "Slack speaker labels do not match the visible posts");
  assert(Object.values(await page.evaluate(() => globalThis.GaiaNovel.getState().metCharacters)).every((value) => value === false), "chat open/receive/read unlocked a large cast before an offline meeting");
  const finalSlackStepId = await currentStepId(page);
  await page.locator(".novel-slack-thread").click();
  await page.waitForFunction((previous) => document.querySelector("#novel-layer")?.dataset.stepId !== previous, finalSlackStepId);
  await page.waitForTimeout(40);
  const slackExitFrame = await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    const character = layer.querySelector(".novel-character--sora");
    const style = getComputedStyle(character);
    const dialogue = document.querySelector("#novel-dialogue");
    const dialogueStyle = getComputedStyle(dialogue);
    const workspace = document.querySelector(".novel-slack-workspace");
    return {
      exiting: layer.classList.contains("is-slack-exiting"),
      slackHidden: document.querySelector("#novel-slack-surface").hidden,
      slackAnimationName: getComputedStyle(workspace).animationName,
      opacity: Number.parseFloat(style.opacity),
      transitionDuration: style.transitionDuration,
      dialogueHiddenAttribute: dialogue.hidden,
      dialogueOpacity: Number.parseFloat(dialogueStyle.opacity),
      dialogueTransitionDuration: dialogueStyle.transitionDuration,
    };
  });
  assert(slackExitFrame.exiting && !slackExitFrame.slackHidden && slackExitFrame.slackAnimationName === "novel-slack-window-out", `Slack workspace disappeared without an exit transition: ${JSON.stringify(slackExitFrame)}`);
  assert(slackExitFrame.opacity === 0 && slackExitFrame.transitionDuration === "0s", `Slack character resized while leaving the workspace: ${JSON.stringify(slackExitFrame)}`);
  assert(!slackExitFrame.dialogueHiddenAttribute && slackExitFrame.dialogueOpacity < 1 && slackExitFrame.dialogueTransitionDuration.includes("0.32s"), `normal message window appeared in a single frame after Slack: ${JSON.stringify(slackExitFrame)}`);
  await page.waitForFunction(() => !document.querySelector("#novel-layer")?.classList.contains("is-slack-exiting"));
  const slackExitSettled = await page.evaluate(() => ({
    slackHidden: document.querySelector("#novel-slack-surface").hidden,
    dialogueHiddenAttribute: document.querySelector("#novel-dialogue").hidden,
    dialogueOpacity: Number.parseFloat(getComputedStyle(document.querySelector("#novel-dialogue")).opacity),
  }));
  assert(slackExitSettled.slackHidden && !slackExitSettled.dialogueHiddenAttribute && slackExitSettled.dialogueOpacity > 0.98, `Slack exit did not settle cleanly: ${JSON.stringify(slackExitSettled)}`);

  const objectiveOpeningSteps = steps.filter((step) => step.sceneId === "opening_empty_seat");
  for (const objectiveStep of objectiveOpeningSteps) {
    await bootAt(page, objectiveStep.id, { metCharacters: { mizuha: false, amane: false, sakuya: false } });
    const objectivePresentation = await page.evaluate(() => ({
      castSpeaker: document.querySelector("#novel-cast")?.dataset.speaker,
      castRendered: (() => {
        const style = getComputedStyle(document.querySelector("#novel-cast"));
        return style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity) > 0.01;
      })(),
      avatarHidden: document.querySelector("#novel-avatar")?.hidden,
      openingPresentation: document.querySelector("#novel-layer")?.dataset.openingPresentation,
      obsoletePresentation: document.querySelector("#novel-layer")?.dataset.recordPresentation || "",
      visibleCharacters: [...document.querySelectorAll(".novel-character")]
        .filter((character) => Number.parseFloat(getComputedStyle(character).opacity) > 0.01)
        .length,
    }));
    assert((!objectivePresentation.castRendered || objectivePresentation.visibleCharacters === 0) && objectivePresentation.avatarHidden
      && objectivePresentation.openingPresentation === "objective-record" && objectivePresentation.obsoletePresentation === ""
      && !["mizuha", "amane", "sakuya"].includes(objectivePresentation.castSpeaker),
      `opening objective RECORD rendered a person at ${objectiveStep.id}: ${JSON.stringify(objectivePresentation)}`);
  }

  const sakuyaChats = steps.filter((step) => step.sceneId === "prologue_basil" && step.type === "chat" && step.speaker === "sakuya");
  const sakuyaChat = sakuyaChats.at(-1);
  await bootAt(page, sakuyaChat.id);
  assert(await page.locator("#novel-slack-surface").getAttribute("aria-label") === "制作チームの学内チャット記録", "campus chat accessibility label regressed to a legacy service name");
  const sakuyaAvatars = await page.locator('.novel-slack-post[data-speaker="sakuya"] .novel-slack-avatar').evaluateAll((avatars) => avatars.map((avatar) => getComputedStyle(avatar).backgroundImage));
  assert(sakuyaAvatars.length === sakuyaChats.length && sakuyaAvatars.every((avatar) => avatar.includes("slack-avatar-sakuya-flower-v3.webp")), `Sakuya flower avatar is missing from one or more posts: ${JSON.stringify(sakuyaAvatars)}`);
  await screenshot(page, "slack-sakuya-flower-avatar");

  for (const attachmentStep of attachmentSteps) await assertSlackAttachment(page, attachmentStep, "desktop");
  const sakuyaSlackStandee = await page.locator("#novel-character-sakuya .novel-character-portrait").evaluate((portrait) => getComputedStyle(portrait).backgroundImage);
  assert(/sakuya-(?:calm|sad|teasing|worried)-07-v1\.png/u.test(sakuyaSlackStandee) && !sakuyaSlackStandee.includes("-bust-"), `normal-dialogue bust crop leaked into Slack standee: ${sakuyaSlackStandee}`);
  report.sakuyaBust.fullBodyCues.push({ stepId: sakuyaChat.id, type: "chat", viewport: "2048", backgroundImage: sakuyaSlackStandee, passed: true });

  const isCentralEntranceDistanceStep = (step) => (
    step.sceneId === "return_to_start"
    && Number.parseInt(step.id.match(/_(\d+)$/u)?.[1] || "0", 10) >= 21
  );
  const sakuyaDialogueSteps = steps.filter((step) => (
    step.type === "dialogue"
    && step.speaker === "sakuya"
    && !isCentralEntranceDistanceStep(step)
  ));
  assert(sakuyaDialogueSteps.length > 0, "canonical data contains no Sakuya dialogue steps");
  const sakuyaDialogueScenes = [...new Set(sakuyaDialogueSteps.map((step) => step.sceneId))];
  for (const step of sakuyaDialogueSteps) report.sakuyaBust.dialogues.push(await inspectSakuyaDialogueBust(page, step, "2048"));
  assert(["first_meeting_hall", "festival_walk", "production_year"].every((sceneId) => sakuyaDialogueScenes.includes(sceneId)), `Sakuya dialogue scene audit is incomplete: ${JSON.stringify(sakuyaDialogueScenes)}`);

  const sakuyaBustReferenceStep = sakuyaDialogueSteps.find((step) => step.id === "festival_walk_006") || sakuyaDialogueSteps[0];
  const expressionAssets = {
    calm: "sakuya-calm-bust-07-v2.png",
    teasing: "sakuya-teasing-bust-07-v2.png",
    worried: "sakuya-worried-bust-07-v2.png",
    sad: "sakuya-sad-bust-07-v2.png",
  };
  await bootAt(page, sakuyaBustReferenceStep.id, {}, { reducedMotion: true });
  for (const [expression, expectedAsset] of Object.entries(expressionAssets)) {
    const expressionImage = await page.locator("#novel-character-sakuya").evaluate((figure, value) => {
      figure.dataset.expression = value;
      return getComputedStyle(figure.querySelector(".novel-character-portrait")).backgroundImage;
    }, expression);
    assert(expressionImage.includes(expectedAsset), `Sakuya ${expression} did not use ${expectedAsset}: ${expressionImage}`);
    await screenshot(page, `sakuya-bust-${expression}-desktop`);
  }

  for (const speaker of ["amane", "mizuha"]) {
    const referenceStep = steps.find((step) => step.type === "dialogue" && step.speaker === speaker);
    await bootAt(page, referenceStep.id, {}, { reducedMotion: true });
    report.sakuyaBust.references.push({ speaker, stepId: referenceStep.id, sceneId: referenceStep.sceneId, viewport: "2048" });
    await screenshot(page, `sakuya-bust-reference-${speaker}-desktop`);
  }
  await bootAt(page, sakuyaChat.id, { metCharacters: { mizuha: false, amane: false, sakuya: false } });
  await assertSlackCastGate(page, { visible: false, speaker: "sakuya", label: "desktop pre-meeting Sakuya" });

  const lockedMeetingFlags = { mizuha: false, amane: false, sakuya: false };
  const pairMeetingFlags = { mizuha: true, amane: true, sakuya: false };
  const completeMeetingFlags = { mizuha: true, amane: true, sakuya: true };
  const pairMeetingCompletion = stepMap.get("first_meeting_hall_032");
  await bootAt(page, pairMeetingCompletion.id, { metCharacters: lockedMeetingFlags });
  assert(JSON.stringify((await page.evaluate(() => globalThis.GaiaNovel.getState())).metCharacters) === JSON.stringify(lockedMeetingFlags), "Mizuha/Amane unlocked while _032 was still visible");
  await advanceLinear(page);
  assert(await currentStepId(page) === "first_meeting_hall_033", "Mizuha/Amane boundary did not advance to _033");
  const pairUnlockedState = await page.evaluate(({ key }) => ({ runtime: globalThis.GaiaNovel.getState().metCharacters, stored: JSON.parse(localStorage.getItem(key)).metCharacters }), { key: STORAGE_KEY });
  assert(JSON.stringify(pairUnlockedState.runtime) === JSON.stringify(pairMeetingFlags) && JSON.stringify(pairUnlockedState.stored) === JSON.stringify(pairMeetingFlags), `Mizuha/Amane flags were not persisted at _033: ${JSON.stringify(pairUnlockedState)}`);

  const amaneChatAfterMeeting = stepMap.get("first_meeting_hall_043");
  await bootAt(page, amaneChatAfterMeeting.id, { metCharacters: pairMeetingFlags });
  const visibleAmaneCast = await assertSlackCastGate(page, { visible: true, speaker: "sora", label: "desktop post-meeting Amane" });
  assert(visibleAmaneCast.device === "mobile" && Math.abs(visibleAmaneCast.characterOpacity - 0.66) < 0.01 && visibleAmaneCast.characterWidthRatio < 0.9 && visibleAmaneCast.characterRightBias > 1 && visibleAmaneCast.characterBottomGap < 24 && visibleAmaneCast.characterClip === "none", `unlocked mobile-device chat cast lost its adjacent lower-right presentation: ${JSON.stringify(visibleAmaneCast)}`);

  const wideAmaneChatAfterMeeting = stepMap.get("production_year_009");
  await bootAt(page, wideAmaneChatAfterMeeting.id, { metCharacters: completeMeetingFlags });
  const visibleWideAmaneCast = await assertSlackCastGate(page, { visible: true, speaker: "sora", label: "desktop wide-device Amane" });
  assert(visibleWideAmaneCast.device === "wide" && visibleWideAmaneCast.characterInset >= 96 && Math.abs(visibleWideAmaneCast.characterOpacity - 0.66) < 0.01 && visibleWideAmaneCast.characterWidthRatio < 0.38 && visibleWideAmaneCast.characterRightBias > 0.7 && visibleWideAmaneCast.characterBottomGap < 24 && visibleWideAmaneCast.characterClip !== "none", `unlocked wide-device chat cast lost its lower-right clipped presentation: ${JSON.stringify(visibleWideAmaneCast)}`);

  const sakuyaChatBeforeMeeting = stepMap.get("first_meeting_hall_042");
  await bootAt(page, sakuyaChatBeforeMeeting.id, { metCharacters: pairMeetingFlags });
  await assertSlackCastGate(page, { visible: false, speaker: "sakuya", label: "desktop Sakuya before _067" });

  await bootAt(page, chat.id, { metCharacters: completeMeetingFlags });
  await assertSlackCastGate(page, { visible: false, speaker: "sora", label: "desktop replay of pre-meeting scene" });

  const sakuyaMeetingCompletion = stepMap.get("first_meeting_hall_066");
  await bootAt(page, sakuyaMeetingCompletion.id, { metCharacters: pairMeetingFlags });
  assert((await page.evaluate(() => globalThis.GaiaNovel.getState().metCharacters.sakuya)) === false, "Sakuya unlocked while _066 was still visible");
  await advanceLinear(page);
  assert(await currentStepId(page) === "first_meeting_hall_067", "Sakuya boundary did not advance to _067");
  const sakuyaUnlockedState = await page.evaluate(({ key }) => ({ runtime: globalThis.GaiaNovel.getState().metCharacters, stored: JSON.parse(localStorage.getItem(key)).metCharacters }), { key: STORAGE_KEY });
  assert(JSON.stringify(sakuyaUnlockedState.runtime) === JSON.stringify(completeMeetingFlags) && JSON.stringify(sakuyaUnlockedState.stored) === JSON.stringify(completeMeetingFlags), `Sakuya flag was not persisted at _067: ${JSON.stringify(sakuyaUnlockedState)}`);

  const sakuyaChatAfterMeeting = stepMap.get("production_year_012");
  await bootAt(page, sakuyaChatAfterMeeting.id, { metCharacters: lockedMeetingFlags, readStepIds: ["first_meeting_hall_032", "first_meeting_hall_066"] });
  await assertSlackCastGate(page, { visible: false, speaker: "sakuya", label: "desktop read-only state after meeting boundary" });
  await bootAt(page, sakuyaChatAfterMeeting.id, { metCharacters: completeMeetingFlags });
  await assertSlackCastGate(page, { visible: true, speaker: "sakuya", label: "desktop post-meeting Sakuya" });
  await page.locator("#novel-save-button").click();
  await page.locator("#novel-save-slots .novel-save-primary").last().click();
  await page.locator("#novel-save-close").click();
  await bootAt(page, chat.id, { metCharacters: lockedMeetingFlags });
  await page.locator("#novel-load-button").click();
  await page.locator("#novel-save-slots .novel-save-primary").last().click();
  assert(await currentStepId(page) === sakuyaChatAfterMeeting.id, "manual LOAD did not restore the post-meeting chat step");
  assert(JSON.stringify((await page.evaluate(() => globalThis.GaiaNovel.getState())).metCharacters) === JSON.stringify(completeMeetingFlags), "manual SAVE / LOAD did not restore the three meeting flags");
  await assertSlackCastGate(page, { visible: true, speaker: "sakuya", label: "desktop Sakuya after SAVE/LOAD" });

  const observationSequence = story.scenes.find((scene) => scene.id === "choice_observation_order");
  assert(observationSequence.title === "現在の展示｜売り場と観測所", "the observation sequence must use the approved Japanese title");
  await bootAt(page, observationSequence.steps[0].id);
  assert(await page.locator("#novel-choices button").count() === 0, "the canonical observation sequence must not render a choice");
  const observationBackground = await page.locator("#novel-layer").evaluate((node) => getComputedStyle(node).backgroundImage);
  assert(observationBackground.includes("novel-bg-exhibition-v3.png") && !observationBackground.includes("novel-bg-garden-center-v2.png"), `CURRENT observation return used the wrong background: ${observationBackground}`);
  await screenshot(page, "observation-sequence");

  const editorial = steps.find((step) => step.choiceId === "editorial_choice");
  await bootAt(page, editorial.id);
  assert(await page.locator(".novel-evidence-compare > article").count() === 2, "SOURCE and DERIVED are not separated");
  assert((await page.locator(".novel-evidence-compare .is-derived").innerText()).includes("サクヤ本人の確認"), "DERIVED responsibility is missing");
  const evidencePath = await screenshot(page, "evidence");
  await compareBaseline(evidencePath, "evidence");

  const reflection = steps.find((step) => step.type === "reflectionChoice");
  await bootAt(page, reflection.id, { editorialChoice: "SOURCE_RECORD", evesRoute: [{ decisionId: "editorial_choice", value: "SOURCE_RECORD", label: "本人記録で構成する / SOURCE RECORD", stepId: editorial.id }] });
  assert(await page.locator(".novel-reflection-grid button").count() === 36, "reflection grid must contain 36 statements");
  assert(await page.locator(".novel-reflection-group").count() === 0, "reflection grid must not expose theme groups");
  assert(await page.locator(".novel-reflection-grid h3").count() === 0, "reflection grid must not expose theme headings");
  const expectedReflectionIds = Array.from({ length: 36 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`);
  const reflectionIds = await page.locator(".novel-reflection-grid > button").evaluateAll((buttons) => buttons.map((button) => button.dataset.choiceId));
  const reflectionAriaLabels = await page.locator(".novel-reflection-grid > button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") || ""));
  assert(JSON.stringify(reflectionIds) === JSON.stringify(expectedReflectionIds), `reflection DOM order is not R01-R36: ${JSON.stringify(reflectionIds)}`);
  assert(await page.locator(".novel-reflection-choice-id").count() === 0, "internal reflection IDs must not be visible");
  assert(reflectionAriaLabels.every((label) => !/\bR\d{2}\b/u.test(label)), `internal reflection IDs leaked into aria-labels: ${JSON.stringify(reflectionAriaLabels)}`);
  const gridGeometry = await page.evaluate(() => {
    const surface = document.querySelector("#novel-reflection-surface");
    const rects = [...document.querySelectorAll(".novel-reflection-grid button")].map((button) => button.getBoundingClientRect());
    return { scrolls: surface.scrollHeight > surface.clientHeight + 1, allVisible: rects.every((rect) => rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth) };
  });
  assert(!gridGeometry.scrolls && gridGeometry.allVisible, "36 statements must fit in one desktop viewport");
  await checkReflectionControlGeometry(page, "desktop-2048");
  const choicePath = await screenshot(page, "choice");
  await compareBaseline(choicePath, "choice");
  for (let index = 0; index < 3; index += 1) await page.locator(".novel-reflection-grid button").nth(index).click();
  await page.locator(".novel-reflection-grid button").nth(3).click();
  assert(await page.locator('.novel-reflection-grid button[aria-pressed="true"]').count() === 3, "fourth reflection statement was incorrectly selected");
  assert((await page.locator(".novel-reflection-status").innerText()).includes("最大3つ"), "selection limit was not announced");
  await page.locator(".novel-reflection-grid button").nth(1).click();
  assert(await page.locator('.novel-reflection-grid button[aria-pressed="true"]').count() === 2, "reflection deselection failed");
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.locator("#novel-resume-button").click();
  assert(await page.locator('.novel-reflection-grid button[aria-pressed="true"]').count() === 2, "reflection selection did not survive reload");
  const scoring = await page.evaluate(() => ({
    none: GaiaNovel.scoreReflection([]), law: GaiaNovel.scoreReflection(["R03"]), neutral: GaiaNovel.scoreReflection(["R01"]), chaos: GaiaNovel.scoreReflection(["R02"]),
    allTie: GaiaNovel.scoreReflection(["R01", "R03", "R21"]), twoWayTie: GaiaNovel.scoreReflection(["R01", "R02"]),
  }));
  assert(JSON.stringify(scoring) === JSON.stringify({ none: "UNANSWERED", law: "LAW", neutral: "NEUTRAL", chaos: "CHAOS", allTie: "NEUTRAL", twoWayTie: "NEUTRAL" }), `unexpected reflection scoring: ${JSON.stringify(scoring)}`);

  const result = steps.find((step) => step.type === "result");
  await bootAt(page, result.id, { editorialChoice: "SOURCE_RECORD", reflectionIds: ["R01"], resultTone: "NEUTRAL", evesRoute: [{ decisionId: "editorial_choice", value: "SOURCE_RECORD", label: "本人記録で構成する / SOURCE RECORD", stepId: editorial.id }, { decisionId: "reflection_choice", value: "SELECTED", label: "観測姿勢を選ぶ", stepId: reflection.id }] });
  const resultText = await page.locator("#novel-result-surface").innerText();
  assert(!/LAW|NEUTRAL|CHAOS|R01/u.test(resultText), "result exposes hidden attributes or selected statement IDs");
  const resultPath = await screenshot(page, "result");
  await compareBaseline(resultPath, "result");
  await page.locator("#novel-eves-button").click();
  await page.locator("#novel-eves-rewind").click();
  assert(await currentStepId(page) === reflection.id, "E.V.E.S. rewind did not return to the reflection choice");
  assert(Object.values(await page.evaluate(() => globalThis.GaiaNovel.getState().metCharacters)).every((value) => value === false), "rewind incorrectly unlocked a chat cast");
  await bootAt(page, result.id, { editorialChoice: "SOURCE_RECORD", reflectionIds: ["R01"], resultTone: "NEUTRAL", metCharacters: completeMeetingFlags, evesRoute: [{ decisionId: "editorial_choice", value: "SOURCE_RECORD", label: "本人記録で構成する / SOURCE RECORD", stepId: editorial.id }, { decisionId: "reflection_choice", value: "SELECTED", label: "観測姿勢を選ぶ", stepId: reflection.id }] });
  await page.locator("#novel-eves-button").click();
  await page.locator("#novel-eves-rewind").click();
  assert(Object.values(await page.evaluate(() => globalThis.GaiaNovel.getState().metCharacters)).every((value) => value === true), "rewind discarded legitimately completed meeting flags");

  const interactions = steps.filter((step) => step.type === "interaction");
  const optionalMode08 = interactions.find((step) => step.interaction.kind === "map08");
  await bootAt(page, optionalMode08.id, { observationOrder: "STATION_FIRST" });
  const optionalControls = await page.locator("#novel-choices > button").evaluateAll((buttons) => buttons.map((button) => ({
    className: button.className,
    text: button.textContent,
    type: button.type,
  })));
  assert(JSON.stringify(optionalControls) === JSON.stringify([
    { className: "novel-interaction-open", text: "表示モードを見る", type: "button" },
    { className: "novel-interaction-skip", text: "選ばずに進む", type: "button" },
  ]), `MODE 08 optional controls changed: ${JSON.stringify(optionalControls)}`);
  assert(await page.locator("#novel-choices").getAttribute("data-interaction-kind") === "map08", "MODE 08 optional kind dataset is missing");
  assert(await page.locator("#novel-choices").getAttribute("data-interaction-optional") === "true", "MODE 08 optional dataset is missing");
  assert(await page.locator("#novel-choices").evaluate((node) => node.classList.contains("is-mode08-optional")), "MODE 08 optional class is missing");
  const optionalStateBefore = await page.evaluate(() => globalThis.GaiaNovel.getState());
  await page.locator(".novel-interaction-skip").click();
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.stepId === "mode08_map_layers_004");
  const optionalStateAfter = await page.evaluate(() => globalThis.GaiaNovel.getState());
  assert(JSON.stringify(optionalStateAfter.viewed) === JSON.stringify(optionalStateBefore.viewed), "MODE 08 skip changed viewed flags");
  assert(optionalStateAfter.observationOrder === "STATION_FIRST", "MODE 08 skip overwrote an existing legacy observation value");
  assert(optionalStateAfter.evesRoute.length === optionalStateBefore.evesRoute.length, "MODE 08 skip created an E.V.E.S. decision");
  assert(await page.locator(".story-detour-dock").count() === 0, "MODE 08 skip opened the detour");
  assert(await page.locator("#novel-choices > button").count() === 0, "MODE 08 optional controls remained after leaving the interaction");
  const transitionInteraction = interactions.find((step) => step.interaction.kind === "map03") || interactions[0];
  await bootAt(page, transitionInteraction.id);
  await screenshot(page, "interaction-open");
  const interactionOpen = page.locator(".novel-interaction-open");
  await interactionOpen.hover();
  assert(!await page.locator(".gaia-global-button-glint").evaluate((node) => node.classList.contains("is-active")), "full-width interaction button activates the fixed glint");
  const interactionBounds = await interactionOpen.boundingBox();
  await interactionOpen.click();
  await page.locator(".story-detour-dock").waitFor({ state: "visible", timeout: 15000 });
  const glintAfterTransition = await page.locator(".gaia-global-button-glint").evaluate((node) => ({
    active: node.classList.contains("is-active"),
    width: Number.parseFloat(node.style.width) || 0,
    height: Number.parseFloat(node.style.height) || 0,
  }));
  const sourceSizedGlint = glintAfterTransition.active
    && glintAfterTransition.width >= interactionBounds.width * 0.8
    && glintAfterTransition.height >= interactionBounds.height * 0.8;
  assert(!sourceSizedGlint, `button glint leaked into the interaction view: ${JSON.stringify(glintAfterTransition)}`);
  await screenshot(page, "interaction-transition-clean");
  const glintLifecycle = await page.evaluate(async () => {
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const makeButton = () => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "test";
      Object.assign(button.style, {
        position: "fixed",
        zIndex: "2147482000",
        top: "24px",
        left: "24px",
        width: "180px",
        height: "52px",
      });
      document.body.append(button);
      return button;
    };
    const hover = (button) => button.dispatchEvent(new PointerEvent("pointerover", {
      bubbles: true,
      clientX: 40,
      clientY: 40,
    }));
    const glint = document.querySelector(".gaia-global-button-glint");
    const detachedButton = makeButton();
    hover(detachedButton);
    await nextFrame();
    const activated = glint.classList.contains("is-active");
    detachedButton.remove();
    await nextFrame();
    await nextFrame();
    const detachedCleared = !glint.classList.contains("is-active");

    const coveredButton = makeButton();
    const cover = document.createElement("div");
    Object.assign(cover.style, {
      position: "fixed",
      zIndex: "2147482500",
      inset: "20px auto auto 20px",
      width: "190px",
      height: "62px",
    });
    document.body.append(cover);
    hover(coveredButton);
    await nextFrame();
    await nextFrame();
    const coveredCleared = !glint.classList.contains("is-active");
    cover.remove();
    coveredButton.remove();
    return { activated, detachedCleared, coveredCleared };
  });
  assert(glintLifecycle.activated && glintLifecycle.detachedCleared && glintLifecycle.coveredCleared, `button glint lifecycle failed: ${JSON.stringify(glintLifecycle)}`);
  for (const interaction of interactions) await completeInteraction(page, interaction);

  const narration = steps.find((step) => step.type === "narration");
  const logHistoryIds = [...new Set([
    ...steps.filter((step) => step.text).slice(0, 72).map((step) => step.id),
    overflowRegressionStep.id,
  ])];
  await bootAt(page, narration.id, { readStepIds: logHistoryIds });
  const keyboardStep = await currentStepId(page);
  await page.locator("#novel-dialogue").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await page.waitForFunction((previous) => document.querySelector("#novel-layer")?.dataset.stepId !== previous, keyboardStep);
  await bootAt(page, narration.id, { readStepIds: logHistoryIds });
  await page.locator("#novel-log-button").click();
  assert(await page.locator("#novel-log-panel").isVisible(), "LOG did not open");
  await page.waitForTimeout(300);
  const logGeometry = await page.evaluate(() => {
    const panel = document.querySelector("#novel-log-panel");
    const content = document.querySelector("#novel-log-content");
    const rect = panel.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewport: { width: innerWidth, height: innerHeight },
      contentScrollable: content.scrollHeight > content.clientHeight,
      articleCount: content.querySelectorAll("article").length,
      firstStepId: content.querySelector("article:first-child")?.dataset.stepId,
      lastStepId: content.querySelector("article:last-child")?.dataset.stepId,
      distanceFromBottom: content.scrollHeight - content.clientHeight - content.scrollTop,
    };
  });
  assert(Math.abs(logGeometry.left) < 1 && Math.abs(logGeometry.top) < 1 && Math.abs(logGeometry.right - logGeometry.viewport.width) < 1 && Math.abs(logGeometry.bottom - logGeometry.viewport.height) < 1, `LOG is not full-screen: ${JSON.stringify(logGeometry)}`);
  assert(logGeometry.contentScrollable && logGeometry.articleCount >= 60, `LOG history is not scrollable: ${JSON.stringify(logGeometry)}`);
  assert(logGeometry.firstStepId === logHistoryIds[0] && logGeometry.lastStepId === logHistoryIds.at(-1), `LOG is not ordered from oldest to newest: ${JSON.stringify(logGeometry)}`);
  assert(logGeometry.distanceFromBottom <= 1, `LOG did not open at the latest entry: ${JSON.stringify(logGeometry)}`);
  const overflowLogContainsFullText = await page.locator("#novel-log-content article").evaluateAll((articles, fullText) => {
    const normalize = (value) => String(value || "").replace(/\s/gu, "");
    return articles.some((article) => normalize(article.textContent).includes(normalize(fullText)));
  }, overflowRegressionStep.text);
  assert(overflowLogContainsFullText, "LOG did not retain the full unpaginated narration text");
  await screenshot(page, "log-fullscreen");
  await page.locator("#novel-log-content").hover();
  await page.mouse.wheel(0, -520);
  await page.waitForFunction(() => {
    const content = document.querySelector("#novel-log-content");
    return content.scrollTop < content.scrollHeight - content.clientHeight - 72;
  });
  assert(await page.locator("#novel-log-panel").isVisible(), "scrolling inside LOG unexpectedly closed it");
  const retainedScrollTop = await page.locator("#novel-log-content").evaluate((content) => {
    const article = document.createElement("article");
    article.dataset.stepId = "test-newer-while-reading";
    article.innerHTML = "<p>TEST</p><p>新しい記録</p>";
    content.append(article);
    return content.scrollTop;
  });
  await page.waitForTimeout(100);
  assert(Math.abs(await page.locator("#novel-log-content").evaluate((content) => content.scrollTop) - retainedScrollTop) <= 1, "LOG stole the scroll position while older entries were being read");
  await page.locator("#novel-log-content").evaluate((content) => {
    content.scrollTop = content.scrollHeight;
    content.dispatchEvent(new Event("scroll"));
    const article = document.createElement("article");
    article.dataset.stepId = "test-newest-follow";
    article.innerHTML = "<p>TEST</p><p>最新の記録</p>";
    content.append(article);
  });
  await page.waitForFunction(() => {
    const content = document.querySelector("#novel-log-content");
    return content.scrollHeight - content.clientHeight - content.scrollTop <= 1;
  });
  await page.locator("#novel-log-close").click();
  await page.locator("#novel-layer").dispatchEvent("wheel", { deltaY: 120 });
  assert(await page.locator("#novel-log-panel").isHidden(), "downward wheel unexpectedly opened LOG");
  await page.locator("#novel-layer").dispatchEvent("wheel", { deltaY: -120 });
  await page.locator("#novel-log-panel").waitFor({ state: "visible" });
  assert(await page.locator("#novel-log-button").getAttribute("aria-expanded") === "true", "upward wheel did not immediately open LOG");
  await page.locator("#novel-log-close").click();
  await page.locator("#novel-dialogue").focus();
  await page.keyboard.press("l");
  await page.locator("#novel-log-panel").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const content = document.querySelector("#novel-log-content");
    return content.scrollHeight - content.clientHeight - content.scrollTop <= 1;
  });
  await page.keyboard.press("Escape");
  await page.locator("#novel-log-panel").waitFor({ state: "hidden" });
  await page.locator("#novel-config-button").click();
  await page.locator("#novel-reduced-motion").check();
  await page.locator("#novel-config-close").click();
  await page.locator("#novel-auto-button").click();
  assert(await page.locator("#novel-auto-button").getAttribute("aria-pressed") === "true", "AUTO did not enable");
  await page.locator("#novel-auto-button").click();
  const savedStep = await currentStepId(page);
  await page.locator("#novel-save-button").click();
  await page.locator("#novel-save-slots .novel-save-primary").first().click();
  await page.locator("#novel-save-close").click();
  await advanceLinear(page);
  await page.locator("#novel-load-button").click();
  await page.locator("#novel-save-slots .novel-save-primary").first().click();
  assert(await currentStepId(page) === savedStep, "manual SAVE / LOAD did not restore the step");
  await page.locator("#novel-eves-button").click();
  assert(await page.locator("#novel-eves-panel").isVisible(), "E.V.E.S. did not open");
  await page.locator("#novel-eves-close").click();
  await page.locator("#novel-config-button").click();
  await page.locator("#novel-restart-button").evaluate((button) => button.click());
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, story.scenes[0].steps[0].id);
  assert(await page.locator("#novel-config-panel").isHidden(), "CONFIG remained open after restarting the story");
  assert(Object.values(await page.evaluate(() => globalThis.GaiaNovel.getState().metCharacters)).every((value) => value === false), "restart did not reset the three meeting flags");
  if (await page.locator("#gaia-audio-toggle").count()) {
    await page.locator("#gaia-audio-toggle").click();
    await page.locator("#gaia-audio-toggle").click();
  }

  await page.evaluate((key) => localStorage.setItem(key, "{broken"), STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  assert(await page.locator("#novel-resume-button").isHidden(), "broken save must be ignored");
  await page.evaluate(({ stable, legacy, id }) => { localStorage.removeItem(stable); localStorage.setItem(legacy, JSON.stringify({ storyVersion: 6, stepId: id })); }, { stable: STORAGE_KEY, legacy: "gaia_novel_save_v6", id: narration.id });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  assert(await page.locator("#novel-resume-button").isVisible(), "v6 save was not migrated");
  assert(await page.evaluate((key) => Boolean(localStorage.getItem(key)), STORAGE_KEY), "v6 migration did not write stable storage");
  await page.evaluate(({ stable, v6, v5 }) => { localStorage.removeItem(stable); localStorage.removeItem(v6); localStorage.setItem(v5, JSON.stringify({ stepIndex: 3, flags: [], routeHistory: [] })); }, { stable: STORAGE_KEY, v6: "gaia_novel_save_v6", v5: "gaiaSensewareNovel:v5" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  assert(await page.locator("#novel-resume-button").isVisible(), "v5 save was not migrated");
  const walkthroughContext = await browser.newContext({ viewport: { width: 2048, height: 1114 }, reducedMotion: "reduce" });
  const walkthroughPage = await walkthroughContext.newPage();
  attachDiagnostics(walkthroughPage, "full-walkthrough");
  await runFullWalkthrough(walkthroughPage);
  await walkthroughContext.close();
  report.viewports.push({ width: 2048, height: 1114, passed: true });
  await context.close();

  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const medium = await context.newPage();
  attachDiagnostics(medium, "desktop-1440");
  await bootTitle(medium, { clear: true });
  await checkTitleGeometry(medium);
  await screenshot(medium, "start-1440");
  await bootAt(medium, reflection.id);
  assert(await medium.locator(".novel-reflection-grid button").count() === 36, "1440 reflection grid is incomplete");
  await checkReflectionControlGeometry(medium, "desktop-1440");
  await screenshot(medium, "choice-1440");
  const mediumGxInteraction = steps.find((step) => step.type === "interaction" && step.interaction.kind === "gx");
  await bootAt(medium, mediumGxInteraction.id);
  await medium.locator(".novel-interaction-open").click();
  await medium.locator(".story-detour-dock").waitFor({ state: "visible", timeout: 15000 });
  await assertNovelDetourModal(medium, mediumGxInteraction.interaction.kind);
  const currentContactScene = story.scenes.find((scene) => scene.chapter === "CURRENT CONTACT" || scene.title?.includes("CURRENT CONTACT"));
  const currentContact = steps.find((step) => step.id === "return_to_start_005")
    || currentContactScene?.steps.find((step) => step.type !== "end");
  if (currentContact) {
    await bootAt(medium, currentContact.id);
    await checkCurrentContactNonImpact(medium, "desktop-1440");
  } else {
    report.currentContactLayouts.push({ label: "desktop-1440", skipped: "CURRENT CONTACT is absent from this generated story version" });
  }
  report.viewports.push({ width: 1440, height: 900, passed: true });
  await context.close();

  context = await browser.newContext({ viewport: { width: 1612, height: 454 }, reducedMotion: "reduce" });
  const shortDesktop = await context.newPage();
  attachDiagnostics(shortDesktop, "short-desktop-1612x454");
  await bootTitle(shortDesktop, { clear: true });
  await bootAt(shortDesktop, nativeFontStep.id, {}, { reducedMotion: true });
  const shortDesktopNativeFont = (await assertDialoguePageFits(shortDesktop, nativeFontStep)).fontSize;
  await bootAt(shortDesktop, overflowRegressionStep.id, {}, { reducedMotion: true });
  const shortDesktopGeometry = await assertDialoguePageFits(shortDesktop, overflowRegressionStep);
  assert(shortDesktopGeometry.pageCount > 1, "short desktop did not paginate the long narration");
  assert(shortDesktopGeometry.maxLineCount === 3, "short desktop dialogue did not reserve three lines per page");
  assert(shortDesktopGeometry.measuredLineCount === shortDesktopGeometry.maxLineCount, "short desktop turned the page before using its third line");
  assert(shortDesktopGeometry.fontSize === shortDesktopNativeFont, "short desktop changed the dialogue font size");
  await collectDialoguePages(shortDesktop, overflowRegressionStep);
  await screenshot(shortDesktop, "dialogue-pagination-1612x454");

  await bootAt(shortDesktop, sentenceBoundaryRegressionStep.id, {}, { reducedMotion: true });
  const shortDesktopSentencePages = (await collectDialoguePages(shortDesktop, sentenceBoundaryRegressionStep)).visiblePages;
  assert(shortDesktopSentencePages[0].endsWith("風向きと発電量について話している。"), `short desktop did not end the first page at the requested sentence boundary: ${JSON.stringify(shortDesktopSentencePages)}`);
  assert(shortDesktopSentencePages[1]?.startsWith("奥のステージから"), `short desktop left a fragment of the next sentence on page one: ${JSON.stringify(shortDesktopSentencePages)}`);
  await screenshot(shortDesktop, "dialogue-sentence-boundary-1612x454");

  await bootAt(shortDesktop, overflowRegressionStep.id, {}, { reducedMotion: true });
  const autoPageCount = (await assertDialoguePageFits(shortDesktop, overflowRegressionStep)).pageCount;
  await startPaginationTrace(shortDesktop);
  await shortDesktop.locator("#novel-auto-button").click();
  await shortDesktop.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, overflowRegressionStep.id, { timeout: 15000 });
  if (await shortDesktop.locator("#novel-auto-button").getAttribute("aria-pressed") === "true") await shortDesktop.locator("#novel-auto-button").click();
  assertPaginationTrace(await finishPaginationTrace(shortDesktop), overflowRegressionStep, autoPageCount, "AUTO");

  await bootAt(shortDesktop, overflowRegressionStep.id, {}, { reducedMotion: true });
  const fastForwardPageCount = (await assertDialoguePageFits(shortDesktop, overflowRegressionStep)).pageCount;
  await startPaginationTrace(shortDesktop);
  await shortDesktop.locator("#novel-fast-forward-button").click();
  await shortDesktop.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, overflowRegressionStep.id, { timeout: 5000 });
  if (await shortDesktop.locator("#novel-fast-forward-button").getAttribute("aria-pressed") === "true") await shortDesktop.locator("#novel-fast-forward-button").click();
  assertPaginationTrace(await finishPaginationTrace(shortDesktop), overflowRegressionStep, fastForwardPageCount, "fast-forward");
  report.viewports.push({ width: 1612, height: 454, passed: true });
  await context.close();

  context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const mobile = await context.newPage();
  attachDiagnostics(mobile, "mobile-390");
  await bootTitle(mobile, { clear: true });
  await checkTitleGeometry(mobile);
  await screenshot(mobile, "start-mobile");
  await bootAt(mobile, nativeFontStep.id, {}, { reducedMotion: true });
  const mobileNativeFont = (await assertDialoguePageFits(mobile, nativeFontStep)).fontSize;
  await bootAt(mobile, overflowRegressionStep.id, {}, { reducedMotion: true });
  const mobilePaginationGeometry = await assertDialoguePageFits(mobile, overflowRegressionStep);
  assert(mobilePaginationGeometry.pageCount > 1 && mobilePaginationGeometry.maxLineCount === 3, `mobile did not paginate narration at three rendered lines: ${JSON.stringify(mobilePaginationGeometry)}`);
  assert(mobilePaginationGeometry.fontSize === mobileNativeFont, "mobile pagination changed the dialogue font size");
  await collectDialoguePages(mobile, overflowRegressionStep);
  await screenshot(mobile, "dialogue-pagination-mobile");
  await bootAt(mobile, sentenceBoundaryRegressionStep.id, {}, { reducedMotion: true });
  const mobileSentencePages = (await collectDialoguePages(mobile, sentenceBoundaryRegressionStep)).visiblePages;
  const mobileStagePage = mobileSentencePages.findIndex((pageText) => pageText.startsWith("奥のステージから"));
  assert(mobileStagePage > 0 && mobileSentencePages[mobileStagePage - 1].endsWith("風向きと発電量について話している。"), `mobile left a fragment of the next sentence on the previous page: ${JSON.stringify(mobileSentencePages)}`);
  await bootAt(mobile, dialogueSentenceRegressionStep.id, {}, { reducedMotion: true });
  const mobileDialogueSentencePages = (await collectDialoguePages(mobile, dialogueSentenceRegressionStep)).visiblePages;
  assert(mobileDialogueSentencePages.length > 1, `${dialogueSentenceRegressionStep.id}: mobile dialogue did not exercise sentence-aware pagination`);
  await bootAt(mobile, reflection.id, {}, { reducedMotion: true });
  const mobileGeometry = await mobile.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    surfaceScroll: document.querySelector("#novel-reflection-surface").scrollHeight > document.querySelector("#novel-reflection-surface").clientHeight,
    count: document.querySelectorAll(".novel-reflection-grid button").length,
  }));
  assert(!mobileGeometry.horizontalOverflow && mobileGeometry.surfaceScroll && mobileGeometry.count === 36, `mobile reflection layout failed: ${JSON.stringify(mobileGeometry)}`);
  await screenshot(mobile, "choice-mobile");
  for (const stepId of productionEvidenceSteps) {
    const step = stepMap.get(stepId);
    const cue = backgroundCueData.forStep(step);
    const expectedFile = path.basename(cue.assetPath);
    await bootAt(mobile, stepId, {}, { reducedMotion: true });
    const presentation = await mobile.locator("#novel-layer").evaluate((node) => ({
      backgroundImage: getComputedStyle(node).backgroundImage,
      backgroundSize: getComputedStyle(node).backgroundSize,
      cueId: node.dataset.backgroundCue,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert(presentation.backgroundImage.includes(expectedFile), `${stepId} uses the wrong 390px production background: ${presentation.backgroundImage}`);
    assert(presentation.backgroundSize.split(",").every((value) => value.trim() === "cover") && presentation.cueId === cue.id && !presentation.horizontalOverflow, `${stepId} 390px cue presentation failed: ${JSON.stringify(presentation)}`);
    report.productionBackgrounds.push({ viewport: "390x844", stepId, cueId: cue.id, assetPath: cue.assetPath, passed: true });
    await screenshot(mobile, `production-${stepId.slice(-3)}-mobile`);
  }
  const mobileEndGeometry = await mobile.evaluate(() => {
    const surface = document.querySelector("#novel-reflection-surface");
    surface.scrollTop = surface.scrollHeight;
    const lastChoice = document.querySelector('.novel-reflection-grid > button[data-choice-id="R36"]');
    const footer = document.querySelector(".novel-reflection-shell > footer");
    const proceed = document.querySelector(".novel-reflection-proceed");
    const lastRect = lastChoice.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const proceedRect = proceed.getBoundingClientRect();
    const intersects = Math.min(lastRect.right, footerRect.right) > Math.max(lastRect.left, footerRect.left)
      && Math.min(lastRect.bottom, footerRect.bottom) > Math.max(lastRect.top, footerRect.top);
    return {
      scrollTop: surface.scrollTop,
      scrollMax: surface.scrollHeight - surface.clientHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      lastChoice: { left: lastRect.left, top: lastRect.top, right: lastRect.right, bottom: lastRect.bottom },
      footer: { left: footerRect.left, top: footerRect.top, right: footerRect.right, bottom: footerRect.bottom },
      proceed: { left: proceedRect.left, top: proceedRect.top, right: proceedRect.right, bottom: proceedRect.bottom },
      lastChoiceVisible: lastRect.top >= 0 && lastRect.bottom <= innerHeight,
      proceedVisible: proceedRect.top >= 0 && proceedRect.bottom <= innerHeight,
      lastChoiceIntersectsFooter: intersects,
    };
  });
  assert(mobileEndGeometry.scrollTop === mobileEndGeometry.scrollMax && !mobileEndGeometry.horizontalOverflow && mobileEndGeometry.lastChoiceVisible && mobileEndGeometry.proceedVisible && !mobileEndGeometry.lastChoiceIntersectsFooter, `mobile R36/footer reachability failed: ${JSON.stringify(mobileEndGeometry)}`);
  report.reflectionLayouts.push({ label: "mobile-390-end", ...mobileEndGeometry });
  await screenshot(mobile, "choice-mobile-end");
  if (currentContact) {
    await bootAt(mobile, currentContact.id, {}, { reducedMotion: true });
    await checkCurrentContactNonImpact(mobile, "mobile-390");
  }
  await bootAt(mobile, chat.id, {}, { reducedMotion: true });
  await advanceLinear(mobile);
  await assertSlackCastGate(mobile, { visible: false, speaker: "minamo", label: "mobile pre-meeting Mizuha" });
  const mobileSlackGeometry = await mobile.evaluate(() => {
    const workspaceRect = document.querySelector(".novel-slack-workspace").getBoundingClientRect();
    const dialogueRect = document.querySelector("#novel-dialogue").getBoundingClientRect();
    return {
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      workspace: { top: workspaceRect.top, right: workspaceRect.right, bottom: workspaceRect.bottom, left: workspaceRect.left },
      dialogue: { top: dialogueRect.top, right: dialogueRect.right, bottom: dialogueRect.bottom, left: dialogueRect.left },
      posts: document.querySelectorAll(".novel-slack-post").length,
    };
  });
  assert(!mobileSlackGeometry.horizontalOverflow && mobileSlackGeometry.posts === 2 && mobileSlackGeometry.workspace.bottom <= mobileSlackGeometry.dialogue.bottom, `mobile Slack overlay failed: ${JSON.stringify(mobileSlackGeometry)}`);
  await screenshot(mobile, "slack-mobile");
  await bootAt(mobile, sakuyaChatAfterMeeting.id, { metCharacters: completeMeetingFlags }, { reducedMotion: true });
  await assertSlackCastGate(mobile, { visible: true, speaker: "sakuya", label: "mobile post-meeting Sakuya" });
  assert(!await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), "mobile unlocked chat cast introduced horizontal overflow");
  const mobileGxInteraction = steps.find((step) => step.type === "interaction" && step.interaction.kind === "gx");
  await bootAt(mobile, mobileGxInteraction.id, {}, { reducedMotion: true });
  await operateInteraction(mobile, mobileGxInteraction);
  await bootAt(mobile, narration.id, { readStepIds: logHistoryIds }, { reducedMotion: true });
  await mobile.locator("#novel-dialogue").focus();
  await mobile.keyboard.press("l");
  await mobile.locator("#novel-log-panel").waitFor({ state: "visible" });
  await mobile.waitForFunction(() => {
    const content = document.querySelector("#novel-log-content");
    return content.scrollHeight - content.clientHeight - content.scrollTop <= 1;
  });
  const mobileLogState = await mobile.locator("#novel-log-content").evaluate((content) => ({
    firstStepId: content.querySelector("article:first-child")?.dataset.stepId,
    lastStepId: content.querySelector("article:last-child")?.dataset.stepId,
    distanceFromBottom: content.scrollHeight - content.clientHeight - content.scrollTop,
  }));
  assert(mobileLogState.firstStepId === logHistoryIds[0] && mobileLogState.lastStepId === logHistoryIds.at(-1) && mobileLogState.distanceFromBottom <= 1, `mobile LOG order or initial position failed: ${JSON.stringify(mobileLogState)}`);
  await mobile.keyboard.press("Escape");
  await mobile.locator("#novel-log-panel").waitFor({ state: "hidden" });
  for (const attachmentStep of attachmentSteps) await assertSlackAttachment(mobile, attachmentStep, "390px");
  await bootAt(mobile, sakuyaChat.id, {}, { reducedMotion: true });
  const mobileSakuyaAvatars = await mobile.locator('.novel-slack-post[data-speaker="sakuya"] .novel-slack-avatar').evaluateAll((avatars) => avatars.map((avatar) => getComputedStyle(avatar).backgroundImage));
  assert(mobileSakuyaAvatars.length === sakuyaChats.length && mobileSakuyaAvatars.every((avatar) => avatar.includes("slack-avatar-sakuya-flower-v3.webp")), `mobile Sakuya flower avatar is missing from one or more posts: ${JSON.stringify(mobileSakuyaAvatars)}`);
  await screenshot(mobile, "slack-sakuya-flower-avatar-390px");

  const mobileSakuyaSlackStandee = await mobile.locator("#novel-character-sakuya .novel-character-portrait").evaluate((portrait) => getComputedStyle(portrait).backgroundImage);
  assert(/sakuya-(?:calm|sad|teasing|worried)-07-v1\.png/u.test(mobileSakuyaSlackStandee) && !mobileSakuyaSlackStandee.includes("-bust-"), `mobile normal-dialogue bust crop leaked into Slack standee: ${mobileSakuyaSlackStandee}`);
  report.sakuyaBust.fullBodyCues.push({ stepId: sakuyaChat.id, type: "chat", viewport: "390", backgroundImage: mobileSakuyaSlackStandee, passed: true });

  for (const step of sakuyaDialogueSteps) report.sakuyaBust.dialogues.push(await inspectSakuyaDialogueBust(mobile, step, "390"));
  await bootAt(mobile, sakuyaBustReferenceStep.id, {}, { reducedMotion: true });
  for (const [expression, expectedAsset] of Object.entries(expressionAssets)) {
    const expressionImage = await mobile.locator("#novel-character-sakuya").evaluate((figure, value) => {
      figure.dataset.expression = value;
      return getComputedStyle(figure.querySelector(".novel-character-portrait")).backgroundImage;
    }, expression);
    assert(expressionImage.includes(expectedAsset), `mobile Sakuya ${expression} did not use ${expectedAsset}: ${expressionImage}`);
    await screenshot(mobile, `sakuya-bust-${expression}-390px`);
  }

  for (const speaker of ["amane", "mizuha"]) {
    const referenceStep = steps.find((step) => step.type === "dialogue" && step.speaker === speaker);
    await bootAt(mobile, referenceStep.id, {}, { reducedMotion: true });
    report.sakuyaBust.references.push({ speaker, stepId: referenceStep.id, sceneId: referenceStep.sceneId, viewport: "390" });
    await screenshot(mobile, `sakuya-bust-reference-${speaker}-390px`);
  }
  report.viewports.push({ width: 390, height: 844, passed: true });
  await context.close();

  assert(report.pageErrors.length === 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert(report.consoleErrors.length === 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert(report.responses404.length === 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await context?.close().catch(() => {});
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`novel browser check passed: ${report.viewports.length} viewports, ${report.interactions.length} mode interactions, ${report.visualDiffs.length} visual diffs`);
