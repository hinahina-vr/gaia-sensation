import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4391"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/mobile-campus-chat-scale");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-360", width: 360, height: 800, mobile: true },
  { name: "pc-1440", width: 1440, height: 900, mobile: false },
];
const chatCases = [
  { stepId: "welcome_chat_004", nextStepId: "welcome_chat_new_002", speakerId: "system" },
  { stepId: "welcome_chat_024", nextStepId: "welcome_chat_025", speakerId: "sakuya", typingSpeakerId: "sakuya", typingSymbol: "flower" },
  { stepId: "welcome_chat_083", nextStepId: "welcome_chat_084", speakerId: "sakuya" },
];
const report = { status: "running", viewports, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const stateFor = (stepId) => ({
  storyVersion: 13,
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
  sessionId: `mobile-chat-${stepId}`,
});

const createPage = async (viewport, label) => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  await page.addInitScript(() => {
    globalThis.__chatVisible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
  });
  return { context, page };
};

const bootAt = async (page, stepId) => {
  await page.addInitScript((candidate) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
      { progress: candidate, savedAt: Date.now(), meta: { title: "Mobile chat QA", excerpt: candidate.stepId } },
    ]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", String(candidate.audio.volume));
  }, stateFor(stepId));
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.waitForFunction(() => document.querySelector("#gaia-boot")?.hidden === true);
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  await page.waitForSelector(".novel-slack-workspace");
  await page.waitForTimeout(180);
};

const rectInViewport = (rect, viewport, edge = 0) => Boolean(
  rect && rect.width > 0 && rect.height > 0
  && rect.left >= edge && rect.top >= edge
  && rect.right <= viewport.width - edge && rect.bottom <= viewport.height - edge
);

const scanChatLayout = async (viewport, testCase) => {
  const label = `${viewport.name}-${testCase.stepId}`;
  const { context, page } = await createPage(viewport, label);
  await bootAt(page, testCase.stepId);
  const scan = await page.evaluate(() => {
    const workspace = document.querySelector(".novel-slack-workspace");
    const surface = document.querySelector("#novel-slack-surface");
    const thread = document.querySelector(".novel-slack-thread");
    const current = document.querySelector(".novel-slack-post.is-new");
    const dialogue = document.querySelector("#novel-dialogue");
    const text = document.querySelector("#novel-text");
    const speaker = document.querySelector("#novel-speaker");
    const continueMark = document.querySelector("#novel-continue");
    const topbar = document.querySelector("#novel-layer .novel-topbar nav");
    const humanAvatars = [...document.querySelectorAll([
      ".novel-slack-post[data-speaker='mizuha'] .novel-slack-avatar",
      ".novel-slack-post[data-speaker='amane'] .novel-slack-avatar",
      ".novel-slack-post[data-speaker='sakuya'] .novel-slack-avatar",
      ".novel-slack-post[data-speaker='visitor'] .novel-slack-avatar",
      ".novel-slack-typing[data-speaker='mizuha'] .novel-slack-avatar",
      ".novel-slack-typing[data-speaker='amane'] .novel-slack-avatar",
      ".novel-slack-typing[data-speaker='sakuya'] .novel-slack-avatar",
      ".novel-slack-typing[data-speaker='visitor'] .novel-slack-avatar",
    ].join(", "))];
    const workspaceRect = workspace?.getBoundingClientRect();
    const surfaceRect = surface?.getBoundingClientRect();
    const dialogueRect = dialogue?.getBoundingClientRect();
    const textStyle = getComputedStyle(text);
    const messageStyle = getComputedStyle(current?.querySelector(".novel-slack-message"));
    const sidebarStyle = getComputedStyle(workspace?.querySelector(":scope > aside"));
    const headerStyle = getComputedStyle(workspace?.querySelector(":scope > header"));
    const currentRect = current?.getBoundingClientRect();
    const threadRect = thread?.getBoundingClientRect();
    const topbarRect = topbar?.getBoundingClientRect();
    const activeInThread = Boolean(currentRect && threadRect && currentRect.top >= threadRect.top - 1 && currentRect.bottom <= threadRect.bottom + 1);
    const backgrounds = getComputedStyle(document.querySelector("#novel-layer")).backgroundImage;
    return {
      device: workspace?.dataset.device || "",
      workspaceRect: workspaceRect?.toJSON(),
      surfaceRect: surfaceRect?.toJSON(),
      workspaceWidthRatio: workspaceRect ? workspaceRect.width / innerWidth : 0,
      workspaceHeightRatio: workspaceRect ? workspaceRect.height / innerHeight : 0,
      leftGap: workspaceRect?.left ?? -1,
      rightGap: workspaceRect ? innerWidth - workspaceRect.right : -1,
      centerDelta: workspaceRect ? Math.abs((workspaceRect.left + workspaceRect.right) / 2 - innerWidth / 2) : -1,
      topGap: workspaceRect?.top ?? -1,
      backgroundImage: backgrounds,
      sidebarVisible: __chatVisible(workspace?.querySelector(":scope > aside")),
      sidebarWidth: Number.parseFloat(sidebarStyle.width) || 0,
      headerHeight: Number.parseFloat(headerStyle.height) || 0,
      messageFontSize: Number.parseFloat(messageStyle.fontSize) || 0,
      dialogueVisible: __chatVisible(dialogue),
      speaker: speaker?.textContent || "",
      vnText: text?.textContent || "",
      slackText: current?.querySelector(".novel-slack-message")?.textContent || "",
      currentPostSpeaker: current?.dataset.speaker || "",
      currentPostVisible: __chatVisible(current),
      currentPostInThread: activeInThread,
      continueVisible: __chatVisible(continueMark),
      topbarVisible: __chatVisible(topbar),
      topbarRect: topbarRect?.toJSON(),
      dialogueRect: dialogueRect?.toJSON(),
      workspaceDialogueGap: dialogueRect && workspaceRect ? dialogueRect.top - workspaceRect.bottom : -1,
      workspaceTransform: getComputedStyle(workspace).transform,
      textFits: text.scrollHeight <= text.clientHeight + 1,
      estimatedLines: Math.max(1, Math.round(text.scrollHeight / (Number.parseFloat(textStyle.lineHeight) || 1))),
      threadScrollable: (thread?.scrollHeight || 0) > (thread?.clientHeight || 0),
      threadScrollTop: thread?.scrollTop || 0,
      threadScrollMax: Math.max(0, (thread?.scrollHeight || 0) - (thread?.clientHeight || 0)),
      threadOverscroll: getComputedStyle(thread).overscrollBehavior,
      documentScrollHeight: document.documentElement.scrollHeight,
      symbolicAvatarDomCount: humanAvatars.length,
      symbolicAvatarVisibleCount: humanAvatars.filter(__chatVisible).length,
      humanSlackAvatarDomCount: document.querySelectorAll(".novel-slack-avatar[data-human-avatar], .novel-slack-avatar img[src*='/characters/']").length,
      typingSpeaker: document.querySelector(".novel-slack-typing")?.dataset.speaker || "",
      typingSymbol: document.querySelector(".novel-slack-typing .novel-slack-avatar")?.dataset.symbol || "",
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });

  assert.equal(scan.dialogueVisible, false);
  assert.equal(scan.speaker, "");
  assert.equal(scan.vnText, "");
  assert.equal(scan.currentPostSpeaker, testCase.speakerId);
  assert(scan.slackText.trim().length > 0, `${label}: current chat post is empty`);
  assert.equal(scan.currentPostVisible, true);
  assert.equal(scan.currentPostInThread, true);
  assert.equal(scan.continueVisible, false);
  assert.equal(scan.topbarVisible, true);
  assert.equal(rectInViewport(scan.workspaceRect, viewport), true);
  assert.equal(rectInViewport(scan.surfaceRect, viewport), true);
  assert.equal(rectInViewport(scan.topbarRect, viewport), true);
  assert.equal(scan.humanSlackAvatarDomCount, 0);
  if (testCase.speakerId === "system") assert.equal(scan.symbolicAvatarDomCount, 0);
  else assert(scan.symbolicAvatarDomCount > 0);
  assert.equal(scan.symbolicAvatarVisibleCount, scan.symbolicAvatarDomCount);
  assert.equal(scan.typingSpeaker, testCase.typingSpeakerId || "");
  assert.equal(scan.typingSymbol, testCase.typingSymbol || "");
  assert.equal(scan.overflowX, false);
  assert.equal(scan.overflowY, false);
  assert.notEqual(scan.backgroundImage, "none");
  if (viewport.mobile) {
    assert(scan.workspaceWidthRatio >= 0.93 && scan.workspaceWidthRatio <= 0.96, `${label}: mobile workspace width ratio ${scan.workspaceWidthRatio}`);
    assert(scan.workspaceHeightRatio >= 0.82 && scan.workspaceHeightRatio <= 0.88, `${label}: mobile workspace height ratio regressed (${scan.workspaceHeightRatio})`);
    assert(scan.leftGap >= 9 && scan.rightGap >= 9 && scan.topGap >= 46 && scan.topGap <= 56, `${label}: mobile chat does not reach the story header`);
    assert(scan.centerDelta <= 1, `${label}: mobile chat is not centered (${scan.centerDelta}px)`);
    assert.equal(scan.sidebarVisible, false);
    assert.equal(scan.sidebarWidth, 0);
    assert(scan.headerHeight >= 32, `${label}: header is too short`);
    assert(scan.messageFontSize >= 12, `${label}: message font is too small`);
    assert.equal(scan.threadOverscroll, "contain");
    assert.equal(scan.workspaceTransform, "none", `${label}: workspace must not be transform-scaled`);
  } else {
    const expectedWidth = scan.device === "mobile" ? 830 : 1180;
    assert(Math.abs(scan.workspaceRect.width - expectedWidth) <= 1, `${label}: PC workspace width regressed`);
    assert(Math.abs(scan.workspaceRect.height - 612) <= 1, `${label}: PC workspace height regressed`);
    assert(scan.messageFontSize >= 13, `${label}: PC message font regressed`);
  }

  if (scan.threadScrollable) {
    await page.locator(".novel-slack-thread").evaluate((thread) => { thread.scrollTop = 0; });
    const movedToTop = await page.locator(".novel-slack-thread").evaluate((thread) => thread.scrollTop === 0);
    assert.equal(movedToTop, true);
    await page.locator(".novel-slack-thread").evaluate((thread) => { thread.scrollTop = thread.scrollHeight; });
    const activeRestored = await page.evaluate(() => {
      const thread = document.querySelector(".novel-slack-thread")?.getBoundingClientRect();
      const current = document.querySelector(".novel-slack-post.is-new")?.getBoundingClientRect();
      return Boolean(thread && current && current.top >= thread.top - 1 && current.bottom <= thread.bottom + 1);
    });
    assert.equal(activeRestored, true);
  }

  await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
  await page.keyboard.press("Enter");
  await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, testCase.nextStepId);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => globalThis.GaiaNovel.getState().stepId), testCase.nextStepId);
  report.scans.push({ viewport: viewport.name, case: `chat-layout-${testCase.stepId}`, ...scan, nextStepId: testCase.nextStepId, passed: true });
  await context.close();
};

const scanInput = async (viewport, input) => {
  const label = `${viewport.name}-input-${input.name}`;
  const { context, page } = await createPage(viewport, label);
  await bootAt(page, input.stepId);
  await input.run(page);
  await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId !== id, input.stepId);
  await page.waitForTimeout(input.name === "auto" ? 140 : 60);
  const actual = await page.evaluate(() => globalThis.GaiaNovel.getState().stepId);
  if (input.name !== "fast-forward") assert.equal(actual, input.nextStepId);
  else assert.notEqual(actual, input.stepId);
  if (input.name === "auto") await page.locator("#novel-auto-button").click();
  report.scans.push({ viewport: viewport.name, case: `chat-input-${input.name}`, from: input.stepId, to: actual, passed: true });
  await context.close();
};

const inputs = [
  { name: "click", stepId: "welcome_chat_024", nextStepId: "welcome_chat_025", run: async (page) => {
    await page.waitForTimeout(260);
    await page.locator("#novel-layer").click({ position: { x: 2, y: 400 } });
  } },
  { name: "auto", stepId: "welcome_chat_025", nextStepId: "welcome_chat_026", run: (page) => page.locator("#novel-auto-button").click() },
  { name: "fast-forward", stepId: "welcome_chat_026", nextStepId: "welcome_chat_027", run: async (page) => {
    await page.locator("#novel-fast-forward-button").click();
    await page.waitForFunction((id) => globalThis.GaiaNovel.getState().stepId === id, "welcome_chat_027");
    await page.locator("#novel-fast-forward-button").click();
  } },
];

try {
  for (const viewport of viewports) {
    const layoutCases = viewport.mobile ? chatCases : [chatCases[0]];
    for (const testCase of layoutCases) await scanChatLayout(viewport, testCase);
    if (viewport.mobile) {
      for (const input of inputs) await scanInput(viewport, input);
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

console.log("mobile campus chat scale browser check passed");
