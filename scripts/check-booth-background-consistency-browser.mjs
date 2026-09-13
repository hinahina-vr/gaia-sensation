import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/booth-background-consistency");
fs.mkdirSync(outputDir, { recursive: true });

const canonicalAsset = "assets/visuals-07/novel-bg-festival-five-plane-projection-v1.png";
const canonicalFile = "novel-bg-festival-five-plane-projection-v1.png";
const sunsetAsset = "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp";
const sunsetDesktopFile = "01-turning-in-the-sunset.webp";
const sunsetMobileFile = "01-turning-in-the-sunset.webp";
const forbiddenFiles = [
  "novel-bg-exhibition-v3.png",
  "novel-bg-exhibition-v2.png",
  "novel-bg-festival-projection-conversation-v1.png",
  "novel-bg-online-night-v2.png",
  "novel-bg-production-night-v2.png",
  "concept-04-co-created-future.png",
  "concept-01-earth-as-partner.png",
];
const viewports = [
  { name: "pc-1440", width: 1440, height: 900, baseline: { width: 980, height: 459 }, mobileBaseline: { width: 430, height: 738 } },
  { name: "mobile-390", width: 390, height: 844, baseline: { width: 358.8, height: 303.84 }, mobileBaseline: { width: 358.8, height: 303.84 } },
];
const backgroundCases = [
  { stepId: "festival_concept_012", kind: "reference" },
  { stepId: "festival_concept_013", kind: "booth" },
  { stepId: "festival_concept_014", kind: "booth" },
  { stepId: "festival_concept_015", kind: "event" },
  { stepId: "festival_concept_026", kind: "event" },
  { stepId: "festival_concept_027", kind: "booth" },
  { stepId: "festival_concept_075", kind: "booth" },
  { stepId: "festival_concept_076", kind: "event" },
  { stepId: "map_mode01_040", kind: "other" },
  { stepId: "map_mode01_041", kind: "booth" },
  { stepId: "map_mode01_043", kind: "booth", cast: "sora" },
  { stepId: "welcome_chat_002", kind: "booth" },
  { stepId: "welcome_chat_041", kind: "booth" },
  { stepId: "welcome_chat_073", kind: "booth" },
  { stepId: "welcome_chat_074", kind: "sunset" },
  { stepId: "welcome_chat_083", kind: "sunset-chat" },
  { stepId: "welcome_chat_084", kind: "sunset" },
  { stepId: "welcome_chat_091", kind: "sunset" },
  { stepId: "welcome_chat_092", kind: "sunset" },
];
const chatCases = [
  { stepId: "welcome_chat_004", label: "start", nextStepId: "welcome_chat_005" },
  { stepId: "welcome_chat_006", label: "typing", nextStepId: "welcome_chat_007", typing: true },
  { stepId: "welcome_chat_016", label: "mid", nextStepId: "welcome_chat_017", typing: true },
  { stepId: "welcome_chat_038", label: "green-apple", nextStepId: "welcome_chat_039", greenApple: true, typing: true },
  { stepId: "welcome_chat_082", label: "mobile-typing", nextStepId: "welcome_chat_083", typing: true, exit: true },
];
const report = {
  status: "running",
  canonicalAsset,
  forbiddenFiles,
  locationAudit: {
    boothRanges: ["festival_concept 013-014", "festival_concept 027-075", "map_mode01 041-043", "welcome_chat 001-073"],
    explicitLocationException: "welcome_chat_074 explicitly says the three leave the exhibition hall; 074-095 remains the sunset promenade range",
    preservedEventCg: ["festival_concept 015-026/076", "welcome_chat 074-095"],
  },
  backgroundScans: [],
  chatScans: [],
  interactions: [],
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const stateFor = (stepId) => ({
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
  audio: { muted: true, volume: 0.1 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `booth-consistency-${stepId}`,
});

const attachDiagnostics = (page, label, requests) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  page.on("request", (request) => requests.push(request.url()));
};

const bootAt = async (page, stepId) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "Focused QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, stateFor(stepId));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction(() => document.querySelector("#novel-save-panel")?.hidden === false);
  await page.locator(".novel-save-slot[data-slot-index='0']").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForTimeout(300);
};

const makePage = async (browser, viewport, label) => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const requests = [];
  attachDiagnostics(page, `${viewport.name}-${label}`, requests);
  return { context, page, requests };
};

const scanBackground = async (browser, viewport, testCase) => {
  const { context, page, requests } = await makePage(browser, viewport, testCase.stepId);
  await bootAt(page, testCase.stepId);
  const actual = await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    const style = getComputedStyle(layer);
    const rect = layer.getBoundingClientRect();
    const visibleCharacters = [...document.querySelectorAll(".novel-character")]
      .filter((element) => {
        const characterStyle = getComputedStyle(element);
        const characterRect = element.getBoundingClientRect();
        return characterStyle.display !== "none" && Number(characterStyle.opacity) > 0.1 && characterRect.width > 0 && characterRect.height > 0;
      })
      .map((element) => element.className);
    return {
      stepId: layer.dataset.stepId,
      cue: globalThis.GaiaNovel.getBackgroundCue(layer.dataset.stepId),
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      backgroundRepeat: style.backgroundRepeat,
      layerRect: rect.toJSON(),
      visibleCharacters,
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
      documentOverflowY: document.documentElement.scrollHeight - innerHeight,
      layerOverflowX: layer.scrollWidth - layer.clientWidth,
      layerOverflowY: layer.scrollHeight - layer.clientHeight,
    };
  });
  assert.equal(actual.stepId, testCase.stepId);
  assert(actual.layerRect.left === 0 && actual.layerRect.top === 0 && Math.abs(actual.layerRect.width - viewport.width) <= 1 && Math.abs(actual.layerRect.height - viewport.height) <= 1, `${viewport.name}/${testCase.stepId}: layer does not cover viewport`);
  if (testCase.kind.startsWith("sunset") && viewport.width <= 720) assert.match(actual.backgroundSize, /^cover, auto [\d.]+px$/u);
  else assert(actual.backgroundSize.split(",").every((value) => value.trim() === "cover"), `${viewport.name}/${testCase.stepId}: background is not cover`);
  assert(actual.backgroundRepeat.split(",").every((value) => value.trim() === "no-repeat"), `${viewport.name}/${testCase.stepId}: background repeats`);
  assert(actual.documentOverflowX <= 1 && actual.documentOverflowY <= 1 && actual.layerOverflowX <= 1, `${viewport.name}/${testCase.stepId}: viewport overflow ${JSON.stringify(actual)}`);
  if (testCase.kind !== "sunset-chat") assert(actual.layerOverflowY <= 1, `${viewport.name}/${testCase.stepId}: non-chat layer overflow ${JSON.stringify(actual)}`);
  if (["booth", "reference"].includes(testCase.kind)) {
    assert.equal(actual.cue.assetPath, canonicalAsset, `${viewport.name}/${testCase.stepId}: wrong booth cue`);
    assert(actual.backgroundImage.includes(canonicalFile), `${viewport.name}/${testCase.stepId}: canonical booth is not visible`);
  }
  if (testCase.kind === "booth") {
    const forbiddenRequests = requests.filter((url) => forbiddenFiles.some((file) => url.includes(file)));
    assert.equal(forbiddenRequests.length, 0, `${viewport.name}/${testCase.stepId}: forbidden asset requested: ${forbiddenRequests}`);
  }
  if (testCase.kind.startsWith("sunset")) {
    const expectedFile = viewport.name.startsWith("mobile") ? sunsetMobileFile : sunsetDesktopFile;
    assert.equal(actual.cue.assetPath, sunsetAsset, `${viewport.name}/${testCase.stepId}: sunset promenade cue mismatch`);
    assert(actual.backgroundImage.includes(expectedFile), `${viewport.name}/${testCase.stepId}: sunset promenade is not visible`);
    assert.deepEqual(actual.visibleCharacters, [], `${viewport.name}/${testCase.stepId}: standalone cast overlaps the sunset event CG`);
  }
  if (testCase.cast) assert(actual.visibleCharacters.some((className) => className.includes(`novel-character--${testCase.cast}`)), `${viewport.name}/${testCase.stepId}: character CG disappeared`);
  const screenshot = path.join(outputDir, `${viewport.name}-${testCase.stepId}.png`);
  await page.screenshot({ path: screenshot, animations: "disabled" });
  report.backgroundScans.push({ viewport: viewport.name, ...testCase, actual, requests: requests.filter((url) => /\.(?:png|webp|svg)(?:\?|$)/u.test(url)), passed: true });
  report.screenshots.push(screenshot);
  await context.close();
};

const scanChat = async (browser, viewport, testCase) => {
  const { context, page, requests } = await makePage(browser, viewport, `chat-${testCase.stepId}`);
  await bootAt(page, testCase.stepId);
  const actual = await page.evaluate(() => {
    const workspace = document.querySelector(".novel-slack-workspace");
    const surface = document.querySelector("#novel-slack-surface");
    const thread = document.querySelector(".novel-slack-thread");
    const dialogue = document.querySelector("#novel-dialogue");
    const vnText = document.querySelector("#novel-text");
    const vnSpeaker = document.querySelector("#novel-speaker");
    const workspaceRect = workspace.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const current = document.querySelector(".novel-slack-post.is-new");
    const greenApples = [...document.querySelectorAll('.novel-slack-avatar[data-symbol="green-apple"]')];
    const appleBody = greenApples[0]?.querySelector(".novel-slack-apple-body");
    const currentRect = current?.getBoundingClientRect();
    const threadRect = thread.getBoundingClientRect();
    return {
      cue: globalThis.GaiaNovel.getBackgroundCue(document.querySelector("#novel-layer").dataset.stepId),
      device: workspace.dataset.device,
      workspaceRect: workspaceRect.toJSON(),
      surfaceRect: surfaceRect.toJSON(),
      centerDeviationX: workspaceRect.left + workspaceRect.width / 2 - innerWidth / 2,
      centerDeviationY: workspaceRect.top + workspaceRect.height / 2 - innerHeight / 2,
      dialogueHidden: dialogue.hidden,
      dialogueVisible: getComputedStyle(dialogue).display !== "none" && dialogue.getBoundingClientRect().height > 0,
      vnText: vnText.textContent,
      vnSpeaker: vnSpeaker.textContent,
      currentMessage: current?.querySelector(".novel-slack-message")?.textContent || "",
      currentVisible: Boolean(currentRect && threadRect && currentRect.top >= threadRect.top - 1 && currentRect.bottom <= threadRect.bottom + 1),
      typingVisible: Boolean(document.querySelector(".novel-slack-typing")?.getBoundingClientRect().height),
      greenAppleCount: greenApples.length,
      greenAppleBodyColor: appleBody ? getComputedStyle(appleBody).fill : "",
      greenAppleImageCount: greenApples.reduce((count, avatar) => count + avatar.querySelectorAll("img").length, 0),
      humanAvatarCount: document.querySelectorAll(".novel-slack-avatar[data-human-avatar], .novel-slack-avatar img[src*='/characters/']").length,
      threadScrollable: thread.scrollHeight > thread.clientHeight,
      threadScrollMax: thread.scrollHeight - thread.clientHeight,
      threadOverscroll: getComputedStyle(thread).overscrollBehavior,
      workspaceOverflowX: workspace.scrollWidth - workspace.clientWidth,
      workspaceOverflowY: workspace.scrollHeight - workspace.clientHeight,
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
      documentOverflowY: document.documentElement.scrollHeight - innerHeight,
      autoVisible: Boolean(document.querySelector("#novel-auto-button")?.getBoundingClientRect().height),
      fastForwardVisible: Boolean(document.querySelector("#novel-fast-forward-button")?.getBoundingClientRect().height),
    };
  });
  const baselineRect = actual.device === "mobile" ? viewport.mobileBaseline : viewport.baseline;
  const baselineArea = baselineRect.width * baselineRect.height;
  const currentArea = actual.workspaceRect.width * actual.workspaceRect.height;
  actual.baselineRect = baselineRect;
  actual.areaRatio = currentArea / baselineArea;
  assert(actual.workspaceRect.left >= 0 && actual.workspaceRect.top >= 0 && actual.workspaceRect.right <= viewport.width + 1 && actual.workspaceRect.bottom <= viewport.height + 1, `${viewport.name}/${testCase.stepId}: workspace outside viewport`);
  assert(Math.abs(actual.centerDeviationX) <= 1 && Math.abs(actual.centerDeviationY) <= 1, `${viewport.name}/${testCase.stepId}: workspace not centered ${actual.centerDeviationX}/${actual.centerDeviationY}`);
  assert(actual.areaRatio >= 1.5 && actual.areaRatio <= 1.75, `${viewport.name}/${testCase.stepId}: area ratio ${actual.areaRatio}`);
  assert.equal(actual.dialogueHidden, true, `${viewport.name}/${testCase.stepId}: duplicate VN dialogue remains`);
  assert.equal(actual.dialogueVisible, false, `${viewport.name}/${testCase.stepId}: empty VN frame remains visible`);
  assert.equal(actual.vnText, "", `${viewport.name}/${testCase.stepId}: duplicate VN text DOM remains`);
  assert.equal(actual.vnSpeaker, "", `${viewport.name}/${testCase.stepId}: duplicate VN speaker remains`);
  assert(actual.currentMessage.length > 0 && actual.currentVisible, `${viewport.name}/${testCase.stepId}: active chat message is unavailable`);
  assert.equal(actual.typingVisible, Boolean(testCase.typing), `${viewport.name}/${testCase.stepId}: typing state changed`);
  assert.equal(actual.humanAvatarCount, 0, `${viewport.name}/${testCase.stepId}: human image avatar found`);
  assert(actual.workspaceOverflowX <= 1 && actual.workspaceOverflowY <= 1 && actual.documentOverflowX <= 1 && actual.documentOverflowY <= 1, `${viewport.name}/${testCase.stepId}: overflow`);
  assert(actual.autoVisible && actual.fastForwardVisible, `${viewport.name}/${testCase.stepId}: progression controls missing`);
  const mascotAvatars = await page.locator([
    ".novel-slack-post[data-speaker='amane'] .novel-slack-avatar img",
    ".novel-slack-post[data-speaker='mizuha'] .novel-slack-avatar img",
    ".novel-slack-typing[data-speaker='amane'] .novel-slack-avatar img",
    ".novel-slack-typing[data-speaker='mizuha'] .novel-slack-avatar img",
  ].join(", ")).evaluateAll((images) => images.map((image) => {
    const rect = image.closest(".novel-slack-avatar").getBoundingClientRect();
    return {
      speaker: image.closest("[data-speaker]")?.dataset.speaker || "",
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      displayWidth: rect.width,
      displayHeight: rect.height,
      visible: rect.width > 0 && rect.height > 0 && getComputedStyle(image).display !== "none",
    };
  }));
  actual.mascotAvatars = mascotAvatars;
  for (const speaker of ["amane", "mizuha"]) {
    const matching = mascotAvatars.filter((avatar) => avatar.speaker === speaker);
    if (matching.length === 0) continue;
    assert(matching.every((avatar) => avatar.src.includes(`slack-avatar-${speaker}-v2.webp`)), `${viewport.name}/${testCase.stepId}: ${speaker} is not v2`);
    assert(matching.every((avatar) => avatar.complete && avatar.naturalWidth === 512 && avatar.naturalHeight === 512), `${viewport.name}/${testCase.stepId}: ${speaker} v2 did not decode at 512x512`);
    assert(matching.every((avatar) => avatar.visible && avatar.displayWidth >= 24 && avatar.displayHeight >= 24), `${viewport.name}/${testCase.stepId}: ${speaker} v2 is not readable at its rendered chat size`);
    const fullSizePosts = matching.filter((avatar) => avatar.displayWidth >= 37 && avatar.displayHeight >= 37);
    if (matching.some((avatar) => avatar.displayWidth >= 34)) assert(fullSizePosts.length > 0, `${viewport.name}/${testCase.stepId}: ${speaker} v2 full-size post is below 38px`);
  }
  const v1Requests = requests.filter((url) => /slack-avatar-(?:amane|mizuha)-v1\.webp(?:\?|$)/u.test(url));
  assert.equal(v1Requests.length, 0, `${viewport.name}/${testCase.stepId}: legacy v1 mascot requested: ${v1Requests}`);
  const v2Requests = requests.filter((url) => /slack-avatar-(?:amane|mizuha)-v2\.webp(?:\?|$)/u.test(url));
  for (const avatar of mascotAvatars) assert(v2Requests.some((url) => url === avatar.src), `${viewport.name}/${testCase.stepId}: visible v2 mascot was not requested`);
  if (testCase.greenApple) {
    assert(actual.greenAppleCount > 0, `${viewport.name}/${testCase.stepId}: green apple missing`);
    assert.equal(actual.greenAppleBodyColor, "rgb(88, 168, 76)", `${viewport.name}/${testCase.stepId}: apple is not green`);
    assert.equal(actual.greenAppleImageCount, 0, `${viewport.name}/${testCase.stepId}: apple is not code-native`);
  }
  const forbiddenRequests = requests.filter((url) => forbiddenFiles.some((file) => url.includes(file)));
  if (!testCase.exit) {
    assert.equal(actual.cue.assetPath, canonicalAsset, `${viewport.name}/${testCase.stepId}: chat booth cue mismatch`);
    assert.equal(forbiddenRequests.length, 0, `${viewport.name}/${testCase.stepId}: forbidden background requested`);
  }
  if (actual.threadScrollable) {
    await page.locator(".novel-slack-thread").evaluate((thread) => { thread.scrollTop = 0; });
    assert.equal(await page.locator(".novel-slack-thread").evaluate((thread) => thread.scrollTop), 0);
    await page.locator(".novel-slack-thread").evaluate((thread) => { thread.scrollTop = thread.scrollHeight; });
    assert(await page.locator(".novel-slack-thread").evaluate((thread) => thread.scrollTop > 0));
  }
  const screenshot = path.join(outputDir, `${viewport.name}-chat-${testCase.label}-${testCase.stepId}.png`);
  await page.screenshot({ path: screenshot, animations: "disabled" });
  report.chatScans.push({ viewport: viewport.name, ...testCase, actual, forbiddenRequests, passed: true });
  report.screenshots.push(screenshot);
  await context.close();
};

const checkInteraction = async (browser, viewport, mode, stepId, nextStepId) => {
  const { context, page } = await makePage(browser, viewport, `${mode}-${stepId}`);
  await bootAt(page, stepId);
  if (mode === "hit-area") {
    await page.locator(".novel-slack-workspace > header").click();
  } else if (mode === "auto") {
    await page.locator("#novel-auto-button").click();
  } else {
    await page.locator("#novel-fast-forward-button").click();
  }
  await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, nextStepId, { timeout: 15000 });
  if (mode === "auto") await page.locator("#novel-auto-button").click();
  if (mode === "fast-forward") await page.locator("#novel-fast-forward-button").click();
  report.interactions.push({ viewport: viewport.name, mode, from: stepId, to: nextStepId, passed: true });
  await context.close();
};

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of viewports) {
    for (const testCase of backgroundCases) await scanBackground(browser, viewport, testCase);
    for (const testCase of chatCases) await scanChat(browser, viewport, testCase);
    await checkInteraction(browser, viewport, "hit-area", "welcome_chat_006", "welcome_chat_007");
    await checkInteraction(browser, viewport, "auto", "welcome_chat_016", "welcome_chat_017");
    await checkInteraction(browser, viewport, "fast-forward", "welcome_chat_038", "welcome_chat_039");
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
  console.log(`booth background consistency browser check passed: ${report.backgroundScans.length} backgrounds, ${report.chatScans.length} chat layouts, ${report.interactions.length} interactions`);
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}
