import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, candidateBase = "http://127.0.0.1:4423", baselineBase = "https://gaia-senseware.pages.dev"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const entry = fs.existsSync(path.join(moduleRoot, "index.mjs")) ? path.join(moduleRoot, "index.mjs") : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(entry).href);
const outputDir = path.resolve(outputArgument || "artifacts/mobile-responsive-mq");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900, mobile: false },
  { name: "mobile-360", width: 360, height: 800, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-430", width: 430, height: 932, mobile: true },
];
const report = { status: "running", scope: "mobile-responsive-mq", baselineBase, candidateBase, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });
const visibleSource = `(element) => {
  if (!element || element.hidden) return false;
  const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
}`;
const rect = (box) => box ? ({ x: box.x, y: box.y, width: box.width, height: box.height, top: box.top, right: box.right, bottom: box.bottom, left: box.left }) : null;
const stateFor = (stepId, storyVersion) => ({
  storyVersion, stepId, reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null,
  editorialChoice: null, reflectionIds: [], resultTone: null, demoInterest: "気候の長期変化",
  metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0.3 },
  readStepIds: [], clear: false, archivesUnlocked: false, sessionId: `mobile-mq-${stepId}`,
});

const makePage = async (viewport, label) => {
  const context = await browser.newContext({ viewport, hasTouch: viewport.mobile, isMobile: viewport.mobile, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
  await page.addInitScript((source) => { globalThis.__mqVisible = eval(source); }, visibleSource);
  return { context, page };
};

const openTitle = async (page, baseUrl) => {
  await page.addInitScript(() => {
    localStorage.removeItem("gaiaSensewareNovel:progress");
    localStorage.setItem("gaiaSensewareTrueEnd:reached:v1", new Date().toISOString());
  });
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-title"));
};

const bootStory = async (page, baseUrl, stepId = "festival_concept_011") => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  await page.evaluate((state) => {
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(state));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([
      { progress: state, savedAt: Date.now(), meta: { title: "Mobile responsive QA", excerpt: state.stepId } },
    ]));
    localStorage.setItem("gaiaSensewareNovel:config:v2", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaiaSensewareNovel:config:v3", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, stateFor(stepId, storyVersion));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
};

const titleScan = async (viewport, baseUrl, phase) => {
  const { context, page } = await makePage(viewport, `${phase}-${viewport.name}-title`);
  await openTitle(page, baseUrl);
  const data = await page.evaluate(() => {
    const get = (selector) => document.querySelector(selector);
    const gallery = get("#novel-title-gallery-button"); const start = get("#novel-start-button");
    const navButtons = [...document.querySelectorAll(".novel-topbar nav > button")].filter((button) => __mqVisible(button) && button.querySelector(".novel-nav-label"));
    const navRect = navButtons.reduce((out, button) => {
      const box = button.getBoundingClientRect();
      return { top: Math.min(out.top, box.top), bottom: Math.max(out.bottom, box.bottom), left: Math.min(out.left, box.left), right: Math.max(out.right, box.right) };
    }, { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity });
    const galleryRect = gallery.getBoundingClientRect(); const startRect = start.getBoundingClientRect();
    return {
      gallery: { rect: galleryRect.toJSON(), font: getComputedStyle(gallery).fontSize },
      start: { rect: startRect.toJSON(), font: getComputedStyle(start).fontSize, text: start.textContent.trim() },
      navRect, gap: navRect.top - galleryRect.bottom,
      overlap: Math.max(0, Math.min(galleryRect.bottom, navRect.bottom) - Math.max(galleryRect.top, navRect.top)),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  await page.screenshot({ path: path.join(outputDir, `${phase}-${viewport.name}-title.png`) });
  await page.locator("#novel-title-gallery-button").click();
  const galleryClose = await page.locator("#novel-gallery-close").evaluate((button) => ({ rect: button.getBoundingClientRect().toJSON(), hit: document.elementFromPoint(button.getBoundingClientRect().left + 2, button.getBoundingClientRect().top + 2) === button }));
  data.galleryClose = galleryClose;
  if (phase === "candidate" && viewport.mobile) {
    assert.equal(data.overlap, 0); assert(data.gap >= 8); assert.equal(data.start.font, "12px");
    assert(data.start.rect.height >= 44); assert(data.galleryClose.rect.width >= 44 && data.galleryClose.rect.height >= 44);
    assert.equal(data.overflowX, false); assert.equal(data.overflowY, false);
  }
  report.scans.push({ phase, viewport: viewport.name, surface: "title", ...data, passed: true });
  await context.close();
  return data;
};

const storyScan = async (viewport, baseUrl, phase) => {
  const { context, page } = await makePage(viewport, `${phase}-${viewport.name}-story`);
  await bootStory(page, baseUrl);
  const data = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".novel-topbar nav > button")].filter((button) => __mqVisible(button) && button.querySelector(".novel-nav-label"));
    const labels = buttons.map((button) => { const label = button.querySelector(".novel-nav-label"); return { text: label.textContent.trim(), font: getComputedStyle(label).fontSize, rect: button.getBoundingClientRect().toJSON() }; });
    return { labels, overflowX: document.documentElement.scrollWidth > innerWidth + 1, overflowY: document.documentElement.scrollHeight > innerHeight + 1 };
  });
  await page.locator("#novel-save-button").click();
  data.save = await page.evaluate(() => { const close = document.querySelector("#novel-save-close"); const slots = document.querySelector("#novel-save-slots"); return { close: close.getBoundingClientRect().toJSON(), scrollHeight: slots.scrollHeight, clientHeight: slots.clientHeight, overflowY: getComputedStyle(slots).overflowY }; });
  await page.locator("#novel-save-close").click(); await page.locator("#novel-config-button").click();
  data.configClose = await page.locator("#novel-config-close").evaluate((button) => button.getBoundingClientRect().toJSON());
  await page.screenshot({ path: path.join(outputDir, `${phase}-${viewport.name}-config.png`) });
  if (phase === "candidate" && viewport.mobile) {
    assert(data.labels.length >= 6); assert(data.labels.every((item) => parseFloat(item.font) >= 6.5 && item.rect.width >= 44 && item.rect.height >= 44));
    assert(data.save.close.width >= 44 && data.save.close.height >= 44); assert(data.save.scrollHeight > data.save.clientHeight);
    assert(data.configClose.width >= 44 && data.configClose.height >= 44); assert.equal(data.overflowX, false); assert.equal(data.overflowY, false);
  }
  report.scans.push({ phase, viewport: viewport.name, surface: "story-modals", ...data, passed: true });
  await context.close();
  return data;
};

const chatScan = async (viewport, baseUrl, phase) => {
  const { context, page } = await makePage(viewport, `${phase}-${viewport.name}-chat`);
  await bootStory(page, baseUrl, "welcome_chat_024");
  await page.waitForSelector(".novel-slack-workspace");
  const data = await page.evaluate(() => {
    const workspace = document.querySelector(".novel-slack-workspace"); const thread = document.querySelector(".novel-slack-thread");
    const current = document.querySelector(".novel-slack-post.is-new"); const aside = workspace.querySelector(":scope > aside");
    return {
      workspace: workspace.getBoundingClientRect().toJSON(), transform: getComputedStyle(workspace).transform,
      messageFont: getComputedStyle(current.querySelector(".novel-slack-message")).fontSize,
      sidebarWidth: aside.getBoundingClientRect().width, overscroll: getComputedStyle(thread).overscrollBehavior,
      scrollHeight: thread.scrollHeight, clientHeight: thread.clientHeight, activeVisible: __mqVisible(current),
      humanAvatarCount: document.querySelectorAll(".novel-slack-avatar[data-human-avatar], .novel-slack-avatar img[src*='/characters/']").length,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1, overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  await page.screenshot({ path: path.join(outputDir, `${phase}-${viewport.name}-chat.png`) });
  report.scans.push({ phase, viewport: viewport.name, surface: "chat-nonregression", ...data, passed: true });
  await context.close();
  return data;
};

const observationScan = async (viewport, baseUrl, phase) => {
  const { context, page } = await makePage(viewport, `${phase}-${viewport.name}-observation`);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#gaia-opening-sound-off").click();
  await page.locator("#gaia-opening-route-other").waitFor({ state: "visible" });
  await page.locator("#gaia-opening-route-other").click();
  await page.waitForFunction(() => document.querySelector("#gaia-opening")?.hidden === true);
  await page.waitForFunction(() => document.querySelectorAll("#mode-list .mode-button").length >= 9);
  await page.evaluate(() => {
    const intro = document.querySelector("#intro-layer"); if (intro) { intro.hidden = true; intro.inert = true; intro.setAttribute("aria-hidden", "true"); }
    document.body.classList.remove("intro-open");
  });
  const data = await page.evaluate(() => {
    const ids = ["space-button", "story-button", "japan-button", "auto-button", "source-button", "reset-button"];
    const actions = ids.map((id) => { const button = document.getElementById(id); return { id, rect: button.getBoundingClientRect().toJSON(), hit: document.elementFromPoint(button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2, button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2)?.closest("button")?.id === id }; });
    const modes = [...document.querySelectorAll("#mode-list .mode-button")].map((button) => ({ text: button.textContent.trim(), rect: button.getBoundingClientRect().toJSON(), hit: document.elementFromPoint(button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2, button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2) === button }));
    const concept = document.querySelector("#concept-open"); const intro = document.querySelector("#intro-button");
    return { actions, modes, concept: concept.getBoundingClientRect().toJSON(), intro: intro.getBoundingClientRect().toJSON(), modeList: document.querySelector("#mode-list").getBoundingClientRect().toJSON(), overflowX: document.documentElement.scrollWidth > innerWidth + 1, overflowY: document.documentElement.scrollHeight > innerHeight + 1 };
  });
  await page.screenshot({ path: path.join(outputDir, `${phase}-${viewport.name}-observation.png`) });
  await page.locator("#mode-list .mode-button").nth(1).focus(); await page.locator("#mode-list .mode-button").nth(1).press("Enter");
  data.keyboardMode = await page.locator("#mode-list .mode-button").nth(1).getAttribute("aria-current");
  await page.locator("#concept-open").click(); data.conceptOpened = await page.locator("#concept-panel").getAttribute("aria-hidden");
  await page.locator("#concept-close").click(); await page.locator("#intro-button").click();
  await page.waitForFunction(() => document.querySelector("#intro-layer")?.getAttribute("aria-hidden") === "false");
  data.introCards = await page.evaluate(() => [...document.querySelectorAll(".intro-path-card")].slice(0, 4).map((card) => ({ title: getComputedStyle(card.querySelector("strong")).fontSize, body: getComputedStyle(card.querySelector("p")).fontSize, rect: card.getBoundingClientRect().toJSON() })));
  await page.screenshot({ path: path.join(outputDir, `${phase}-${viewport.name}-intro.png`) });
  if (phase === "candidate" && viewport.mobile) {
    assert(data.actions.every((item) => item.rect.width >= 44 && item.rect.height >= 44 && item.hit));
    assert.equal(data.modes.length, 9); assert(data.modes.every((item) => item.rect.width >= 44 && item.rect.height >= 44 && item.hit));
    assert(data.modeList.width <= viewport.width - 24 + 1); assert.equal(data.keyboardMode, "true");
    assert(data.concept.height >= 44); assert(data.intro.height >= 44); assert.equal(data.conceptOpened, "false");
    assert(data.introCards.length === 4 && data.introCards.every((item) => parseFloat(item.title) >= 15 && parseFloat(item.body) >= 11));
    assert.equal(data.overflowX, false); assert.equal(data.overflowY, false);
  }
  report.scans.push({ phase, viewport: viewport.name, surface: "observation-intro", ...data, passed: true });
  await context.close();
  return data;
};

try {
  for (const viewport of viewports) {
    const before = { title: await titleScan(viewport, baselineBase, "before"), story: await storyScan(viewport, baselineBase, "before"), observation: await observationScan(viewport, baselineBase, "before") };
    if (viewport.name === "mobile-390") before.chat = await chatScan(viewport, baselineBase, "before");
    const after = { title: await titleScan(viewport, candidateBase, "candidate"), story: await storyScan(viewport, candidateBase, "candidate"), observation: await observationScan(viewport, candidateBase, "candidate") };
    if (viewport.name === "mobile-390") after.chat = await chatScan(viewport, candidateBase, "candidate");
    if (before.chat) {
      assert.deepEqual(after.chat.workspace, before.chat.workspace); assert.equal(after.chat.messageFont, before.chat.messageFont);
      assert.equal(after.chat.sidebarWidth, before.chat.sidebarWidth); assert.equal(after.chat.overscroll, "contain");
      assert.equal(after.chat.activeVisible, true); assert.equal(after.chat.humanAvatarCount, 0); assert.equal(after.chat.overflowX, false); assert.equal(after.chat.overflowY, false);
    }
    if (!viewport.mobile) {
      assert.equal(after.title.start.font, before.title.start.font);
      assert.deepEqual(after.story.labels.map((item) => [item.font, item.rect.width, item.rect.height]), before.story.labels.map((item) => [item.font, item.rect.width, item.rect.height]));
      assert.deepEqual(after.observation.actions.map((item) => [item.rect.width, item.rect.height]), before.observation.actions.map((item) => [item.rect.width, item.rect.height]));
      assert.deepEqual(
        after.observation.modes.map((item) => [item.rect.width, item.rect.height]),
        before.observation.modes.slice(0, after.observation.modes.length).map((item) => [item.rect.width, item.rect.height]),
      );
    }
  }
  assert.equal(report.consoleErrors.length, 0); assert.equal(report.pageErrors.length, 0); assert.equal(report.responses404.length, 0);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = error.stack || String(error); throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
console.log(`mobile responsive MQ browser check passed: ${report.scans.length} scans`);
