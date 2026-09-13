import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4186"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/pc-play-canvas-browser");
fs.mkdirSync(outputDir, { recursive: true });

const STORAGE_KEY = "gaiaSensewareNovel:progress";
const MANUAL_SAVE_KEY = "gaiaSensewareNovel:manual-saves";
const CONFIG_KEY = "gaiaSensewareNovel:config:v3";
const desktopViewports = [
  { name: "pc-1080p", width: 1920, height: 1080, expectedScale: 1, expectedFrame: "1920x1080" },
  { name: "pc-4k", width: 3840, height: 2160, expectedScale: 2, expectedFrame: "1920x1080" },
  { name: "pc-4k-browser-chrome", width: 3840, height: 1920, expectedScale: 1920 / 1080, expectedFrame: "2160x1080" },
];
const mobileViewport = { name: "mobile-390", width: 390, height: 844 };
const targets = [
  { name: "dialogue", stepId: "festival_concept_016", ready: "#novel-dialogue" },
  { name: "campus-chat", stepId: "welcome_chat_022", ready: ".novel-slack-workspace" },
];
const report = {
  status: "running",
  baseUrl,
  scans: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};

const progressFor = (storyVersion, target, viewport) => ({
  storyVersion,
  stepId: target.stepId,
  reachedSceneIds: [target.stepId.split(/_(?=\d{3}$)/u)[0]],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds: [target.stepId],
  clear: false,
  archivesUnlocked: false,
  sessionId: `pc-play-canvas-${target.name}-${viewport.name}`,
});

const rect = (node) => {
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    right: box.right,
    bottom: box.bottom,
  };
};

const scanPage = async (page, target) => page.evaluate((kind) => {
  const layer = document.querySelector("#novel-layer");
  const experience = document.querySelector(".experience");
  const dialogue = document.querySelector("#novel-dialogue");
  const text = document.querySelector("#novel-text");
  const signal = document.querySelector("#novel-source-label");
  const nav = document.querySelector(".novel-topbar nav");
  const audio = document.querySelector("#gaia-audio-dock");
  const workspace = document.querySelector(".novel-slack-workspace");
  const activeCharacter = [...document.querySelectorAll(".novel-character")].find((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return Number(style.opacity) > 0.5 && box.width > 0 && box.height > 0;
  });
  const nodeRect = (node) => {
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
  };
  const navButtons = [...document.querySelectorAll(".novel-topbar nav > button:not([hidden])")].map(nodeRect);
  return {
    kind,
    stepId: layer?.dataset.stepId || "",
    pcCanvas: layer?.dataset.pcCanvas || "",
    pcCanvasFrame: layer?.dataset.pcCanvasFrame || "",
    bodyPcCanvas: document.body.classList.contains("novel-pc-canvas"),
    scale: Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--novel-pc-scale")) || 1,
    experience: nodeRect(experience),
    dialogue: nodeRect(dialogue),
    text: nodeRect(text),
    textFontSize: text ? getComputedStyle(text).fontSize : "",
    textLineHeight: text ? getComputedStyle(text).lineHeight : "",
    signal: nodeRect(signal),
    nav: nodeRect(nav),
    navButtons,
    audio: nodeRect(audio),
    audioVisible: Boolean(audio && !audio.hidden && getComputedStyle(audio).visibility !== "hidden"),
    character: nodeRect(activeCharacter),
    workspace: nodeRect(workspace),
    workspaceFontFamily: workspace ? getComputedStyle(workspace).fontFamily : "",
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    overflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  };
}, target.name);

const bootTarget = async (page, target, viewport) => {
  await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  const storyVersion = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.storyVersion);
  const progress = progressFor(storyVersion, target, viewport);
  await page.evaluate(({ progress: candidate, storageKey, manualSaveKey, configKey }) => {
    localStorage.setItem(storageKey, JSON.stringify(candidate));
    localStorage.setItem(manualSaveKey, JSON.stringify([{
      progress: candidate,
      savedAt: Date.now(),
      meta: { title: "PC canvas QA", excerpt: candidate.stepId },
    }]));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-volume", "0");
  }, { progress, storageKey: STORAGE_KEY, manualSaveKey: MANUAL_SAVE_KEY, configKey: CONFIG_KEY });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
  const resumedDirectly = await page.waitForFunction(
    (id) => document.querySelector("#novel-layer")?.dataset.stepId === id,
    target.stepId,
    { timeout: 20_000 },
  ).then(() => true, () => false);
  if (!resumedDirectly) {
    const resume = page.locator("#novel-resume-button");
    if (!(await resume.isVisible())) {
      throw new Error(`${target.name}/${viewport.name}: saved step did not resume`);
    }
    await resume.click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible" });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, target.stepId);
  await page.locator(target.ready).waitFor({ state: "visible" });
  await page.waitForTimeout(80);
};

const near = (actual, expected, label, tolerance = 1.25) => {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
};

const compareScaledRect = (fullHd, fourK, key) => {
  const source = fullHd[key];
  const candidate = fourK[key];
  if (!source && !candidate) return;
  assert(source && candidate, `${key}: missing in one desktop viewport`);
  for (const property of ["x", "y", "width", "height", "right", "bottom"]) {
    near(candidate[property], source[property] * 2, `${key}.${property}`);
  }
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const target of targets) {
    const targetScans = [];
    for (const viewport of desktopViewports) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}/${target.name}: ${message.text()}`); });
      page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}/${target.name}: ${error.message}`));
      page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}/${target.name}: ${response.url()}`); });
      await bootTarget(page, target, viewport);
      const scan = await scanPage(page, target);
      assert.equal(scan.stepId, target.stepId);
      assert.equal(scan.pcCanvas, "1920x1080");
      assert.equal(scan.pcCanvasFrame, viewport.expectedFrame);
      assert.equal(scan.bodyPcCanvas, true);
      near(scan.scale, viewport.expectedScale, `${viewport.name}: scale`, 0.001);
      assert.equal(scan.overflowX, 0, `${viewport.name}/${target.name}: horizontal overflow`);
      assert.equal(scan.overflowY, 0, `${viewport.name}/${target.name}: vertical overflow`);
      assert(scan.navButtons.every((button) => button.width >= 44 * viewport.expectedScale && button.height >= 44 * viewport.expectedScale), `${viewport.name}/${target.name}: toolbar hit area did not scale`);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${target.name}.png`), animations: "disabled" });
      report.scans.push({ viewport: viewport.name, ...scan, passed: true });
      targetScans.push(scan);
      await context.close();
    }

    const [fullHd, fourK, browserChrome] = targetScans;
    compareScaledRect(fullHd, fourK, "experience");
    compareScaledRect(fullHd, fourK, "nav");
    compareScaledRect(fullHd, fourK, "audio");
    assert.equal(fourK.textFontSize, fullHd.textFontSize, `${target.name}: source font size changed before canvas scaling`);
    assert.equal(fourK.textLineHeight, fullHd.textLineHeight, `${target.name}: source line height changed before canvas scaling`);
    if (target.name === "dialogue") {
      for (const key of ["dialogue", "text", "signal", "character"]) compareScaledRect(fullHd, fourK, key);
    } else {
      compareScaledRect(fullHd, fourK, "workspace");
      assert.equal(fourK.workspaceFontFamily, fullHd.workspaceFontFamily, "campus chat typography changed at 4K");
    }
    near(browserChrome.experience.x, 0, `${target.name}: browser-chrome stage x`);
    near(browserChrome.experience.y, 0, `${target.name}: browser-chrome stage y`);
    near(browserChrome.experience.width, desktopViewports[2].width, `${target.name}: browser-chrome stage width`);
    near(browserChrome.experience.height, desktopViewports[2].height, `${target.name}: browser-chrome stage height`);
    for (const key of target.name === "dialogue"
      ? ["nav", "audio", "dialogue", "text", "signal", "character"]
      : ["nav", "audio", "workspace"]) {
      const box = browserChrome[key];
      if (!box) continue;
      const edgeTolerance = key === "character" ? 2.25 : 1.25;
      assert(box.x >= -edgeTolerance && box.y >= -edgeTolerance, `${target.name}/${key}: browser-chrome frame starts outside the viewport`);
      assert(box.right <= desktopViewports[2].width + edgeTolerance && box.bottom <= desktopViewports[2].height + edgeTolerance, `${target.name}/${key}: browser-chrome frame ends outside the viewport`);
    }
  }

  const mobileContext = await browser.newContext({ viewport: mobileViewport, reducedMotion: "reduce" });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${mobileViewport.name}: ${message.text()}`); });
  mobilePage.on("pageerror", (error) => report.pageErrors.push(`${mobileViewport.name}: ${error.message}`));
  mobilePage.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${mobileViewport.name}: ${response.url()}`); });
  await bootTarget(mobilePage, targets[0], mobileViewport);
  const mobileScan = await scanPage(mobilePage, targets[0]);
  assert.equal(mobileScan.pcCanvas, "fluid");
  assert.equal(mobileScan.pcCanvasFrame, "fluid");
  assert.equal(mobileScan.bodyPcCanvas, false);
  assert.equal(mobileScan.scale, 1);
  assert.equal(mobileScan.overflowX, 0, "mobile: horizontal overflow");
  assert.equal(mobileScan.overflowY, 0, "mobile: vertical overflow");
  assert(mobileScan.navButtons.every((button) => button.width >= 44 && button.height >= 44), "mobile: toolbar hit area regressed");
  await mobilePage.screenshot({ path: path.join(outputDir, `${mobileViewport.name}-dialogue.png`), animations: "disabled" });
  report.scans.push({ viewport: mobileViewport.name, ...mobileScan, passed: true });
  await mobileContext.close();

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`PC play canvas browser check passed: ${report.scans.length} scans`);
