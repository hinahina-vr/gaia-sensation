import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/chat-surface-density-browser");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4309";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssSource = fs.readFileSync(path.join(projectRoot, "novel-mode.css"), "utf8");
const runtimeSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");
assert.match(cssSource, /\.novel-slack-workspace\s*\{[\s\S]*?background:\s*rgba\(241,\s*246,\s*249,\s*0\.88\);/u);
assert.match(cssSource, /\.novel-slack-workspace\s*>\s*main\s*\{[\s\S]*?background:\s*rgba\(247,\s*249,\s*251,\s*0\.92\);/u);
assert.doesNotMatch(runtimeSource, /chat-surface-density/u, "density fix must not change runtime behavior");

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?chat-density=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const allSteps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(allSteps.map((step, index) => [step.id, { step, index: index + 1 }]));
assert.equal(allSteps.length, 1053, "canonical story step count changed");

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v2";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const cases = [
  { name: "light-wide-workroom", stepId: "opening_empty_seat_006", device: "wide", tone: "light", attachment: false },
  { name: "dark-wide-online", stepId: "first_meeting_promise_009", device: "wide", tone: "dark", attachment: false },
  { name: "light-portrait-attachment", stepId: "prologue_basil_004", device: "mobile", tone: "light", attachment: true },
  { name: "dark-portrait-thread", stepId: "production_year_125", device: "mobile", tone: "dark", attachment: false },
];
for (const item of cases) assert.equal(stepMap.get(item.stepId)?.step.type, "chat", `${item.stepId} is no longer a chat step`);

const report = {
  status: "running",
  parent: "08f1880e8f71bda91f881d1a9f1ba0e58841247d",
  storySteps: allSteps.length,
  baselineAlpha: { workspace: 0.24, topbar: 0.70, sidebar: 0.66, main: 0.42, mainHeader: 0.16, composer: 0.28 },
  expectedAlpha: { workspace: 0.88, topbar: 0.90, sidebar: 0.90, main: 0.92, mainHeader: 0.90, composer: 0.90 },
  expectedMobileAlpha: { workspace: 1, topbar: 0.90, sidebar: 0.90, main: 0.98, mainHeader: 0.98, thread: 0.98, composer: 0.98 },
  viewports,
  cases,
  scans: [],
  evidence: [],
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
fs.mkdirSync(outputDir, { recursive: true });

const baseState = (stepId) => ({
  storyVersion: story.storyVersion,
  stepId,
  reachedSceneIds: [],
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "chat-surface-density-browser",
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const ensureNovelOpen = async (page) => {
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.locator("#novel-title-screen").waitFor({ state: "visible", timeout: 15_000 });
};

const bootAt = async (page, stepId) => {
  await page.evaluate(({ progressKey, settingsKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { progressKey: storageKey, settingsKey: configKey, progress: baseState(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15_000 });
  await page.locator(".novel-slack-workspace").waitFor({ state: "visible", timeout: 10_000 });
};

const bindScriptDebug = (page, stepId) => page.evaluate(({ stepId, index }) => {
  const root = document.querySelector("#novel-script-debug");
  document.querySelector("#novel-script-debug-number").textContent = String(index).padStart(4, "0");
  document.querySelector("#novel-script-debug-step-id").textContent = stepId;
  root.setAttribute("aria-label", `スクリプト位置 ${index}、${stepId}`);
  root.setAttribute("aria-hidden", "false");
  root.hidden = false;
}, { stepId, index: stepMap.get(stepId).index });

const readState = (page) => page.evaluate(() => {
  const layer = document.querySelector("#novel-layer");
  const surface = document.querySelector("#novel-slack-surface");
  const workspace = document.querySelector(".novel-slack-workspace");
  const topbar = workspace.querySelector(":scope > header");
  const sidebar = workspace.querySelector(":scope > aside");
  const main = workspace.querySelector(":scope > main");
  const mainHeader = main.querySelector(":scope > header");
  const thread = main.querySelector(".novel-slack-thread");
  const composer = main.querySelector(":scope > footer");
  const debug = document.querySelector("#novel-script-debug");
  const cast = document.querySelector("#novel-cast");
  const threadRect = thread.getBoundingClientRect();
  const visibleInThread = (node) => {
    const value = node.getBoundingClientRect();
    const centerX = (value.left + value.right) / 2;
    const centerY = (value.top + value.bottom) / 2;
    return value.width > 0 && value.height > 0 && centerX >= threadRect.left && centerX <= threadRect.right && centerY >= threadRect.top && centerY <= threadRect.bottom;
  };
  const message = [...thread.querySelectorAll(".novel-slack-message")].find(visibleInThread) || null;
  const time = [...thread.querySelectorAll("time")].find(visibleInThread) || null;
  const typing = thread.querySelector(".novel-slack-typing");
  const attachment = thread.querySelector(".novel-slack-attachment img");
  const avatar = [...thread.querySelectorAll(".novel-slack-avatar")].find(visibleInThread) || null;
  const parseColor = (value) => {
    const parts = String(value).match(/[\d.]+/gu)?.map(Number) || [];
    return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1, raw: value };
  };
  const blend = (front, back) => front.rgb.map((channel, index) => channel * front.alpha + back[index] * (1 - front.alpha));
  const luminance = (rgb) => {
    const channels = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (left, right) => {
    const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const contrastRange = (foregroundNode, backgroundNode, parentBackgroundNode = null) => {
    if (!foregroundNode) return null;
    const foreground = parseColor(getComputedStyle(foregroundNode).color).rgb;
    const background = parseColor(getComputedStyle(backgroundNode).backgroundColor);
    return [
      [0, 0, 0],
      [255, 255, 255],
    ].map((base) => {
      const parent = parentBackgroundNode ? parseColor(getComputedStyle(parentBackgroundNode).backgroundColor) : null;
      const parentBlend = parent ? blend(parent, base) : base;
      return contrast(foreground, blend(background, parentBlend));
    });
  };
  const rect = (node) => {
    if (!node) return null;
    const value = node.getBoundingClientRect();
    return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  };
  const intersects = (left, right) => left && right && left.left < right.right - 0.5 && left.right > right.left + 0.5
    && left.top < right.bottom - 0.5 && left.bottom > right.top + 0.5;
  const frontAtCenter = (node) => {
    if (!node) return null;
    const box = node.getBoundingClientRect();
    const front = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    return { tag: front?.tagName || "", className: front?.className || "", belongsToTarget: front === node || node.contains(front), coveredByCast: Boolean(front?.closest("#novel-cast")) };
  };
  const colors = Object.fromEntries(Object.entries({ workspace, topbar, sidebar, main, mainHeader, thread, composer })
    .map(([name, node]) => [name, parseColor(getComputedStyle(node).backgroundColor)]));
  const workspaceRect = rect(workspace);
  const surfaceRect = rect(surface);
  const debugRect = rect(debug);
  return {
    stepId: layer.dataset.stepId,
    device: layer.dataset.slackDevice,
    mobileClass: workspace.classList.contains("is-mobile-device"),
    colors,
    threadBackgroundImage: getComputedStyle(thread).backgroundImage,
    sceneBackgroundImage: getComputedStyle(layer).backgroundImage,
    workspaceRect,
    surfaceRect,
    workspaceFits: workspaceRect.left >= -1 && workspaceRect.right <= innerWidth + 1 && workspaceRect.top >= -1 && workspaceRect.bottom <= innerHeight + 1,
    surfaceFits: surfaceRect.left >= -1 && surfaceRect.right <= innerWidth + 1 && surfaceRect.top >= -1 && surfaceRect.bottom <= innerHeight + 1,
    portrait: workspaceRect.height > workspaceRect.width,
    surfaceZ: Number(getComputedStyle(surface).zIndex),
    castZ: Number(getComputedStyle(cast).zIndex),
    debugRect,
    debugIntersection: intersects(debugRect, workspaceRect),
    debugText: debug.textContent.trim(),
    mainContrast: contrastRange(message, main),
    timeContrast: contrastRange(time, main),
    typingContrast: contrastRange(typing, main),
    composerContrast: contrastRange(composer, composer, main),
    messageFront: frontAtCenter(message),
    composerFront: frontAtCenter(composer),
    avatarFront: frontAtCenter(avatar),
    attachmentFront: frontAtCenter(attachment),
    attachmentSrc: attachment?.getAttribute("src") || "",
    attachmentNaturalWidth: attachment?.naturalWidth || 0,
    avatarBackground: avatar ? getComputedStyle(avatar).backgroundImage : "",
    bodyOverflow: document.documentElement.scrollWidth - innerWidth,
    layerOverflow: layer.scrollWidth - layer.clientWidth,
  };
});

const expectedAlpha = report.expectedAlpha;
const verifyState = (actual, viewport, item) => {
  assert.equal(actual.stepId, item.stepId, `${viewport}/${item.name}: step changed`);
  assert.equal(actual.device, item.device, `${viewport}/${item.name}: device cue changed`);
  assert.equal(actual.mobileClass, item.device === "mobile", `${viewport}/${item.name}: device class changed`);
  const targetAlpha = item.device === "mobile" ? report.expectedMobileAlpha : { ...expectedAlpha, thread: 0 };
  for (const [surface, alpha] of Object.entries(targetAlpha)) {
    assert(Math.abs(actual.colors[surface].alpha - alpha) < 0.001, `${viewport}/${item.name}: ${surface} alpha ${actual.colors[surface].alpha}`);
    if (surface !== "workspace") assert(actual.colors[surface].alpha < 1, `${viewport}/${item.name}: ${surface} became opaque`);
  }
  if (item.device === "mobile") assert(actual.colors.main.alpha >= 0.96, `${viewport}/${item.name}: portrait main is not visually white`);
  else assert(actual.colors.main.alpha >= 0.88 && actual.colors.main.alpha <= 0.94, `${viewport}/${item.name}: wide main alpha outside target`);
  if (item.device === "wide") assert(actual.threadBackgroundImage.includes("linear-gradient"), `${viewport}/${item.name}: wide thread glass treatment changed`);
  else assert(actual.colors.thread.alpha >= 0.96, `${viewport}/${item.name}: portrait thread is not visually white`);
  assert(actual.sceneBackgroundImage.includes("url("), `${viewport}/${item.name}: scene background disappeared`);
  assert(actual.workspaceFits && actual.surfaceFits, `${viewport}/${item.name}: workspace no longer fits viewport`);
  if (item.device === "mobile") assert(actual.portrait, `${viewport}/${item.name}: mobile cue is not portrait`);
  assert(actual.castZ < actual.surfaceZ, `${viewport}/${item.name}: cast is not below chat surface`);
  assert.equal(actual.debugIntersection, false, `${viewport}/${item.name}: SCRIPT UI intersects chat workspace`);
  assert.match(actual.debugText, /^SCRIPT #\d{4}｜[a-z0-9_]+$/u, `${viewport}/${item.name}: SCRIPT UI format changed`);
  assert(Math.min(...actual.mainContrast) >= 7, `${viewport}/${item.name}: body text contrast ${actual.mainContrast}`);
  if (actual.timeContrast) assert(Math.min(...actual.timeContrast) >= 3, `${viewport}/${item.name}: time contrast ${actual.timeContrast}`);
  if (actual.typingContrast) assert(Math.min(...actual.typingContrast) >= 3, `${viewport}/${item.name}: typing contrast ${actual.typingContrast}`);
  assert(Math.min(...actual.composerContrast) >= 4.5, `${viewport}/${item.name}: composer contrast ${actual.composerContrast}`);
  for (const [name, front] of Object.entries({ message: actual.messageFront, composer: actual.composerFront, avatar: actual.avatarFront })) {
    if (front) assert(front.belongsToTarget && !front.coveredByCast, `${viewport}/${item.name}: ${name} center is obscured ${JSON.stringify(front)}`);
  }
  if (item.attachment) {
    assert(actual.attachmentSrc, `${viewport}/${item.name}: attachment disappeared`);
    assert(actual.attachmentNaturalWidth > 0, `${viewport}/${item.name}: attachment image did not decode`);
    assert(actual.attachmentFront?.belongsToTarget && !actual.attachmentFront.coveredByCast, `${viewport}/${item.name}: attachment center is obscured`);
  }
  assert(actual.avatarBackground.includes("url("), `${viewport}/${item.name}: avatar art disappeared`);
  assert(actual.bodyOverflow <= 1 && actual.layerOverflow <= 1, `${viewport}/${item.name}: horizontal overflow ${actual.bodyOverflow}/${actual.layerOverflow}`);
};

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    for (const item of cases) {
      await bootAt(page, item.stepId);
      await bindScriptDebug(page, item.stepId);
      if (item.attachment) {
        await page.locator(".novel-slack-attachment img").waitFor({ state: "visible", timeout: 10_000 });
        await page.waitForFunction(() => {
          const image = document.querySelector(".novel-slack-attachment img");
          return Boolean(image?.complete && image.naturalWidth > 0);
        }, null, { timeout: 10_000 });
      }
      const actual = await readState(page);
      verifyState(actual, viewport.name, item);
      const screenshot = path.join(outputDir, `${viewport.name}-${item.name}.png`);
      await page.screenshot({ path: screenshot, animations: "disabled", timeout: 90_000 });
      report.scans.push({ viewport: viewport.name, ...item, actual, passed: true });
      report.evidence.push({ viewport: viewport.name, case: item.name, path: screenshot });
    }
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
  console.log(`chat surface density browser check passed: ${report.scans.length} layouts, alpha/contrast/stacking/SCRIPT/overflow`);
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}
