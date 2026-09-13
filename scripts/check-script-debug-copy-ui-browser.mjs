import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/script-debug-copy-ui");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4311";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const cssSource = fs.readFileSync(path.join(projectRoot, "novel-mode.css"), "utf8");
const runtimeSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");
for (const id of ["novel-script-debug-copy-button", "novel-script-debug-copy-status"]) {
  assert.equal((htmlSource.match(new RegExp(`id=["']${id}["']`, "gu")) || []).length, 1, `${id} must exist exactly once`);
}
assert.match(htmlSource, /id="novel-script-debug-copy-button"[\s\S]*?aria-label="現在のスクリプト位置をコピー"/u);
assert.match(cssSource, /\.novel-script-debug-copy-button\s*\{[\s\S]*?width:\s*58px;[\s\S]*?pointer-events:\s*auto;/u);
assert.match(cssSource, /\.novel-script-debug-copy\s*\{[\s\S]*?pointer-events:\s*none;/u);
assert.match(runtimeSource, /novel-script-debug-copy-button|novel-script-debug-copy-status/u, "COPY UI is not bound to the integrated runtime");

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?script-copy=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const steps = story.scenes.flatMap((scene) => scene.steps);
const stepIndex = new Map(steps.map((step, index) => [step.id, index + 1]));

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v2";
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = {
  status: "running",
  parent: "b00a3104d0391cddbbf112cd020dcfc581972fd8",
  storySteps: steps.length,
  scans: [],
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
  sessionId: "script-debug-copy-ui-browser",
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
};

const installMockCopyBinding = (page, stepId) => page.evaluate(({ id, index }) => {
  const root = document.querySelector("#novel-script-debug");
  const number = document.querySelector("#novel-script-debug-number");
  const step = document.querySelector("#novel-script-debug-step-id");
  const button = document.querySelector("#novel-script-debug-copy-button");
  const status = document.querySelector("#novel-script-debug-copy-status");
  number.textContent = String(index).padStart(4, "0");
  step.textContent = id;
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  button.disabled = false;
  button.dataset.copyState = "idle";
  button.setAttribute("aria-label", "現在のスクリプト位置をコピー");
  status.textContent = "COPY";
  globalThis.__scriptCopyText = "";
  globalThis.__scriptCopyDocumentClicks = 0;
  globalThis.__scriptCopyDocumentKeys = 0;
  document.addEventListener("click", () => { globalThis.__scriptCopyDocumentClicks += 1; });
  document.addEventListener("keydown", () => { globalThis.__scriptCopyDocumentKeys += 1; });
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("keydown", (event) => event.stopPropagation());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    globalThis.__scriptCopyText = `SCRIPT #${String(index).padStart(4, "0")}｜${id}`;
    button.dataset.copyState = "copied";
    button.setAttribute("aria-label", "スクリプト位置をコピーしました");
    status.textContent = "コピー済み";
  });
  globalThis.__resetScriptCopyMock = () => {
    button.dataset.copyState = "idle";
    button.setAttribute("aria-label", "現在のスクリプト位置をコピー");
    status.textContent = "COPY";
    globalThis.__scriptCopyDocumentClicks = 0;
    globalThis.__scriptCopyDocumentKeys = 0;
  };
}, { id: stepId, index: stepIndex.get(stepId) });

const geometry = (page, mode) => page.evaluate((surfaceMode) => {
  const bounds = (node) => {
    const box = node.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  };
  const overlaps = (left, right) => left.left < right.right - 0.5 && left.right > right.left + 0.5 && left.top < right.bottom - 0.5 && left.bottom > right.top + 0.5;
  const root = document.querySelector("#novel-script-debug");
  const content = root.querySelector(".novel-script-debug-copy");
  const button = document.querySelector("#novel-script-debug-copy-button");
  const dialogue = document.querySelector("#novel-dialogue");
  const nav = document.querySelector(".novel-topbar nav");
  const chat = document.querySelector(".novel-slack-workspace");
  const jump = document.querySelector("#novel-jump-panel");
  const logClose = document.querySelector("#novel-log-close");
  const rootBox = bounds(root);
  const buttonBox = bounds(button);
  const centerTop = document.elementsFromPoint(buttonBox.left + buttonBox.width / 2, buttonBox.top + buttonBox.height / 2)[0];
  const compare = (node) => node && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden" ? overlaps(rootBox, bounds(node)) : false;
  return {
    mode: surfaceMode,
    root: rootBox,
    button: buttonBox,
    rootContained: rootBox.left >= -0.5 && rootBox.right <= innerWidth + 0.5 && rootBox.top >= -0.5 && rootBox.bottom <= innerHeight + 0.5,
    contentPointerEvents: getComputedStyle(content).pointerEvents,
    buttonPointerEvents: getComputedStyle(button).pointerEvents,
    buttonFront: Boolean(centerTop && (centerTop === button || button.contains(centerTop))),
    dialogueIntersection: compare(dialogue),
    navIntersection: compare(nav),
    chatIntersection: compare(chat),
    jumpIntersection: compare(jump),
    logCloseIntersection: compare(logClose),
    bodyOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    label: button.getAttribute("aria-label"),
    status: document.querySelector("#novel-script-debug-copy-status").textContent,
  };
}, mode);

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    assert.equal(await page.locator("#novel-script-debug-copy-button").isHidden(), true, `${viewport.name}: COPY visible on title`);

    const stepId = "current_exhibition_006";
    await bootAt(page, stepId);
    await installMockCopyBinding(page, stepId);
    const normal = await geometry(page, "normal");
    assert(normal.rootContained && normal.contentPointerEvents === "none" && normal.buttonPointerEvents === "auto" && normal.buttonFront && !normal.dialogueIntersection && !normal.navIntersection && normal.bodyOverflow === 0, `${viewport.name}: normal COPY geometry failed: ${JSON.stringify(normal)}`);
    assert.equal(normal.label, "現在のスクリプト位置をコピー");

    const before = await page.locator("#novel-script-debug-copy-button").boundingBox();
    const stepBefore = await page.locator("#novel-layer").getAttribute("data-step-id");
    const jumpBefore = await page.locator("#novel-jump-button").getAttribute("aria-expanded");
    await page.locator("#novel-script-debug-copy-button").click();
    const after = await page.locator("#novel-script-debug-copy-button").boundingBox();
    const clickState = await page.evaluate(() => ({
      text: globalThis.__scriptCopyText,
      status: document.querySelector("#novel-script-debug-copy-status").textContent,
      state: document.querySelector("#novel-script-debug-copy-button").dataset.copyState,
      label: document.querySelector("#novel-script-debug-copy-button").getAttribute("aria-label"),
      documentClicks: globalThis.__scriptCopyDocumentClicks,
    }));
    assert.deepEqual(after, before, `${viewport.name}: feedback changed COPY geometry`);
    assert.equal(clickState.text, `SCRIPT #0006｜${stepId}`);
    assert.deepEqual({ status: clickState.status, state: clickState.state, label: clickState.label, documentClicks: clickState.documentClicks }, { status: "コピー済み", state: "copied", label: "スクリプト位置をコピーしました", documentClicks: 0 });
    assert.equal(await page.locator("#novel-layer").getAttribute("data-step-id"), stepBefore, `${viewport.name}: COPY advanced story`);
    assert.equal(await page.locator("#novel-jump-button").getAttribute("aria-expanded"), jumpBefore, `${viewport.name}: COPY toggled JUMP`);

    await page.evaluate(() => globalThis.__resetScriptCopyMock());
    await page.locator("#novel-script-debug-copy-button").focus();
    await page.keyboard.press("Enter");
    const keyboardState = await page.evaluate(() => ({
      status: document.querySelector("#novel-script-debug-copy-status").textContent,
      keys: globalThis.__scriptCopyDocumentKeys,
      active: document.activeElement?.id,
    }));
    assert.deepEqual(keyboardState, { status: "コピー済み", keys: 0, active: "novel-script-debug-copy-button" }, `${viewport.name}: keyboard COPY leaked to shortcuts`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-normal-copied.png`), animations: "disabled" });

    await bootAt(page, "prologue_basil_004");
    await installMockCopyBinding(page, "prologue_basil_004");
    const chat = await geometry(page, "chat");
    assert(chat.rootContained && !chat.chatIntersection && chat.bodyOverflow === 0, `${viewport.name}: COPY intersects chat: ${JSON.stringify(chat)}`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-chat.png`), animations: "disabled" });

    await bootAt(page, stepId);
    await installMockCopyBinding(page, stepId);
    await page.locator("#novel-log-button").click();
    await page.locator("#novel-log-panel").waitFor({ state: "visible" });
    const modal = await geometry(page, "log");
    assert(modal.rootContained && !modal.logCloseIntersection && modal.bodyOverflow === 0, `${viewport.name}: COPY intersects LOG control: ${JSON.stringify(modal)}`);

    await page.locator("#novel-log-close").click();
    const jumpButton = page.locator("#novel-jump-button");
    await jumpButton.evaluate((node) => { node.hidden = false; node.setAttribute("aria-expanded", "true"); });
    await page.locator("#novel-jump-panel").evaluate((node) => { node.hidden = false; });
    const jump = await geometry(page, "jump");
    assert(jump.rootContained && !jump.jumpIntersection && jump.bodyOverflow === 0, `${viewport.name}: COPY intersects JUMP: ${JSON.stringify(jump)}`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-jump.png`), animations: "disabled" });

    await page.locator("#novel-script-debug").evaluate((node) => { node.hidden = true; node.setAttribute("aria-hidden", "true"); });
    assert.equal(await page.locator("#novel-script-debug-copy-button").isHidden(), true, `${viewport.name}: COPY remains visible for unknown/nonstory state`);

    report.scans.push({ viewport, normal, chat, modal, jump, clickState, keyboardState, passed: true });
    await context.close();
  }
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

console.log(`SCRIPT COPY UI browser check passed: ${report.scans.length} viewports`);
