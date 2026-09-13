import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/script-debug-ui-browser");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4308";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const cssSource = fs.readFileSync(path.join(projectRoot, "novel-mode.css"), "utf8");
const runtimeSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");

assert.match(indexSource, /id="novel-script-debug"[\s\S]*?aria-hidden="true"[\s\S]*?hidden/u);
assert.match(indexSource, /id="novel-script-debug-number"><\/b>/u);
assert.match(indexSource, /id="novel-script-debug-step-id"><\/code>/u);
assert.match(indexSource, /id="novel-script-debug-copy-button"[\s\S]*?id="novel-script-debug-copy-status"/u);
assert.match(cssSource, /\.novel-script-debug\s*\{[\s\S]*?pointer-events:\s*none;/u);
assert.match(cssSource, /\.novel-script-debug-copy\s*\{[\s\S]*?user-select:\s*text;/u);
for (const selector of ["#novel-script-debug", "#novel-script-debug-number", "#novel-script-debug-step-id"]) {
  assert.match(runtimeSource, new RegExp(selector), `integrated runtime is missing ${selector}`);
}
assert.match(runtimeSource, /スクリプト位置 \$\{index\}、\$\{step\.id\}/u, "integrated runtime is missing the SCRIPT aria-label binding");
assert.match(cssSource, /\.novel-script-debug-copy-button\s*\{[\s\S]*?pointer-events:\s*auto;/u);

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?script-debug=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const allSteps = story.scenes.flatMap((scene) => scene.steps);
assert.equal(allSteps.length, 1053, "canonical flattened step count changed");
const stepPosition = new Map(allSteps.map((step, index) => [step.id, index + 1]));
const longestStep = allSteps.reduce((longest, step) => step.id.length > longest.id.length ? step : longest, allSteps[0]);

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
  baseCommit: "3a7410e1a8179e68e07c4e0f7cf2f550adc86d06",
  storySteps: allSteps.length,
  longestStepId: longestStep.id,
  selectors: {
    root: "#novel-script-debug",
    number: "#novel-script-debug-number",
    stepId: "#novel-script-debug-step-id",
    copyButton: "#novel-script-debug-copy-button",
    copyStatus: "#novel-script-debug-copy-status",
  },
  viewports,
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
  sessionId: "script-debug-ui-browser",
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
  assert(stepPosition.has(stepId), `missing test step ${stepId}`);
  await page.evaluate(({ progressKey, settingsKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { progressKey: storageKey, settingsKey: configKey, progress: baseState(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15_000 });
};

const bindDebug = async (page, stepId, rememberNode = false) => {
  const index = stepPosition.get(stepId);
  const number = String(index).padStart(4, "0");
  await page.evaluate(({ index, number, stepId, rememberNode }) => {
    const root = document.querySelector("#novel-script-debug");
    const numberNode = document.querySelector("#novel-script-debug-number");
    const stepNode = document.querySelector("#novel-script-debug-step-id");
    if (rememberNode) globalThis.__novelScriptDebugNode = root;
    numberNode.textContent = number;
    stepNode.textContent = stepId;
    document.querySelector("#novel-script-debug-copy-status").textContent = "COPY";
    document.querySelector("#novel-script-debug-copy-button").dataset.copyState = "idle";
    root.setAttribute("aria-label", `スクリプト位置 ${index}、${stepId}`);
    root.setAttribute("aria-hidden", "false");
    root.hidden = false;
  }, { index, number, stepId, rememberNode });
  return { index, number };
};

const hideDebug = (page) => page.evaluate(() => {
  const root = document.querySelector("#novel-script-debug");
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.removeAttribute("aria-label");
  document.querySelector("#novel-script-debug-number").textContent = "";
  document.querySelector("#novel-script-debug-step-id").textContent = "";
  document.querySelector("#novel-script-debug-copy-status").textContent = "COPY";
  document.querySelector("#novel-script-debug-copy-button").dataset.copyState = "idle";
});

const readLayout = (page) => page.evaluate(() => {
  const root = document.querySelector("#novel-script-debug");
  const copy = root.querySelector(".novel-script-debug-copy");
  const copyButton = document.querySelector("#novel-script-debug-copy-button");
  const copyStatus = document.querySelector("#novel-script-debug-copy-status");
  const debugRect = root.getBoundingClientRect();
  const selectors = [
    "#novel-source-label:not([hidden])",
    "#novel-dialogue:not([hidden])",
    ".novel-choices button",
    ".novel-topbar nav button:not([hidden])",
    ".novel-footer:not([hidden])",
    ".novel-slack-workspace",
    ".novel-reflection-shell",
    ".novel-evidence-card",
    ".novel-result-card",
    ".novel-operations-phone",
    ".novel-save-shell",
    ".novel-config-shell",
    ".novel-eves-shell",
    ".novel-log-panel header > div",
    ".novel-log-panel header > button",
    "#novel-log-content article",
  ];
  const isVisible = (node) => {
    const style = getComputedStyle(node);
    return node.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
  };
  const intersects = (left, right) => left.left < right.right - 0.5 && left.right > right.left + 0.5
    && left.top < right.bottom - 0.5 && left.bottom > right.top + 0.5;
  const targets = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
    .filter(isVisible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const centerStack = document.elementsFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
      return {
        selector: node.id ? `#${node.id}` : `.${node.classList[0] || node.tagName.toLowerCase()}`,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        intersectsDebug: intersects(debugRect, rect),
        debugAtCenter: centerStack.includes(root) || centerStack.includes(copy),
      };
    });
  const style = getComputedStyle(root);
  const copyStyle = getComputedStyle(copy);
  const copyButtonStyle = getComputedStyle(copyButton);
  const copyButtonRect = copyButton.getBoundingClientRect();
  const copyButtonCenter = document.elementsFromPoint((copyButtonRect.left + copyButtonRect.right) / 2, (copyButtonRect.top + copyButtonRect.bottom) / 2)[0];
  return {
    text: root.textContent.trim(),
    copyText: copy.textContent.trim(),
    copyStatus: copyStatus.textContent,
    ariaLabel: root.getAttribute("aria-label"),
    ariaHidden: root.getAttribute("aria-hidden"),
    hidden: root.hidden,
    rootPointerEvents: style.pointerEvents,
    copyPointerEvents: copyStyle.pointerEvents,
    copyUserSelect: copyStyle.userSelect,
    copyButtonDisplay: copyButtonStyle.display,
    copyButtonPointerEvents: copyButtonStyle.pointerEvents,
    copyButtonFront: copyButtonCenter === copyButton || copyButton.contains(copyButtonCenter),
    copyButtonRect: { width: copyButtonRect.width, height: copyButtonRect.height },
    rect: { left: debugRect.left, top: debugRect.top, right: debugRect.right, bottom: debugRect.bottom, width: debugRect.width, height: debugRect.height },
    rectCount: root.getClientRects().length,
    lineCount: copy.getClientRects().length,
    clipped: debugRect.left < -0.5 || debugRect.right > innerWidth + 0.5 || debugRect.top < -0.5 || debugRect.bottom > innerHeight + 0.5,
    bodyOverflow: document.documentElement.scrollWidth - innerWidth,
    layerOverflow: document.querySelector("#novel-layer").scrollWidth - document.querySelector("#novel-layer").clientWidth,
    intersections: targets.filter((target) => target.intersectsDebug),
    debugBlockedCenters: targets.filter((target) => target.debugAtCenter),
    targets,
  };
});

const verifyBoundLayout = async (page, viewport, state, stepId, extra = {}) => {
  const { index, number } = await bindDebug(page, stepId);
  const layout = await readLayout(page);
  assert.equal(layout.copyText, `SCRIPT #${number}｜${stepId}`, `${viewport}/${state}: visible format changed`);
  assert.equal(layout.copyStatus, "COPY", `${viewport}/${state}: idle COPY label changed`);
  assert.equal(layout.ariaLabel, `スクリプト位置 ${index}、${stepId}`, `${viewport}/${state}: accessible name changed`);
  assert.equal(layout.ariaHidden, "false", `${viewport}/${state}: bound UI remains aria-hidden`);
  assert.equal(layout.rootPointerEvents, "none", `${viewport}/${state}: root must remain click-through`);
  assert.equal(layout.copyPointerEvents, "none", `${viewport}/${state}: text must not intercept story input`);
  assert.equal(layout.copyUserSelect, "text", `${viewport}/${state}: visible text is not selectable`);
  const copySuppressed = ["save-modal", "config-modal", "eves-modal"].includes(state);
  if (copySuppressed) {
    assert.equal(layout.copyButtonDisplay, "none", `${viewport}/${state}: COPY must clear the modal shell`);
    assert.deepEqual(layout.copyButtonRect, { width: 0, height: 0 }, `${viewport}/${state}: hidden COPY retained a hit box`);
  } else {
    assert.equal(layout.copyButtonPointerEvents, "auto", `${viewport}/${state}: COPY button is not hittable`);
    assert.equal(layout.copyButtonFront, true, `${viewport}/${state}: COPY button is covered`);
  }
  assert.equal(layout.rectCount, 1, `${viewport}/${state}: debug UI is not a single box`);
  assert.equal(layout.lineCount, 1, `${viewport}/${state}: debug copy wrapped`);
  assert.equal(layout.clipped, false, `${viewport}/${state}: debug UI clipped ${JSON.stringify(layout.rect)}`);
  assert(layout.bodyOverflow <= 1 && layout.layerOverflow <= 1, `${viewport}/${state}: horizontal overflow ${layout.bodyOverflow}/${layout.layerOverflow}`);
  assert.equal(layout.intersections.length, 0, `${viewport}/${state}: visual intersection ${JSON.stringify(layout.intersections)}`);
  assert.equal(layout.debugBlockedCenters.length, 0, `${viewport}/${state}: debug UI blocks another control's hit-test center`);
  report.scans.push({ viewport, state, stepId, index, ...extra, layout, passed: true });
  return layout;
};

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);

    const titleState = await page.locator("#novel-script-debug").evaluate((node) => ({
      hidden: node.hidden,
      ariaHidden: node.getAttribute("aria-hidden"),
      text: node.textContent.replace(/\s/gu, ""),
    }));
    assert.deepEqual(titleState, { hidden: true, ariaHidden: "true", text: "SCRIPT#｜COPY" }, `${viewport.name}: title placeholder state changed`);

    await bootAt(page, "current_exhibition_014");
    await bindDebug(page, "current_exhibition_014", true);
    await verifyBoundLayout(page, viewport.name, "dialogue-short", "current_exhibition_014");
    await bindDebug(page, longestStep.id);
    assert(await page.evaluate(() => globalThis.__novelScriptDebugNode === document.querySelector("#novel-script-debug")), `${viewport.name}: node identity changed during bind`);
    await verifyBoundLayout(page, viewport.name, "dialogue-longest-id", longestStep.id, { nodeIdentityPreserved: true });
    const dialogueShot = path.join(outputDir, `${viewport.name}-dialogue-longest.png`);
    await page.screenshot({ path: dialogueShot, animations: "disabled", timeout: 90_000 });
    report.evidence.push({ viewport: viewport.name, state: "dialogue-longest-id", path: dialogueShot });

    const modeCases = [
      { state: "choice", stepId: "choice_observation_order_005" },
      { state: "chat", stepId: "opening_empty_seat_006" },
      { state: "reflection", stepId: "choice_reflection_002" },
    ];
    for (const item of modeCases) {
      await bootAt(page, item.stepId);
      await verifyBoundLayout(page, viewport.name, item.state, item.stepId);
      const shot = path.join(outputDir, `${viewport.name}-${item.state}.png`);
      await page.screenshot({ path: shot, animations: "disabled", timeout: 90_000 });
      report.evidence.push({ viewport: viewport.name, state: item.state, path: shot });
    }

    await bootAt(page, "current_exhibition_014");
    await bindDebug(page, "current_exhibition_014");
    const modalCases = [
      { state: "log-modal", open: "novel-log-button", panel: "novel-log-panel", close: "novel-log-close" },
      { state: "save-modal", open: "novel-save-button", panel: "novel-save-panel", close: "novel-save-close" },
      { state: "config-modal", open: "novel-config-button", panel: "novel-config-panel", close: "novel-config-close" },
      { state: "eves-modal", open: "novel-eves-button", panel: "novel-eves-panel", close: "novel-eves-close" },
    ];
    for (const item of modalCases) {
      await page.evaluate((id) => document.getElementById(id).click(), item.open);
      await page.locator(`#${item.panel}`).waitFor({ state: "visible", timeout: 5_000 });
      await verifyBoundLayout(page, viewport.name, item.state, "current_exhibition_014");
      if (item.state === "save-modal") {
        const shot = path.join(outputDir, `${viewport.name}-${item.state}.png`);
        await page.screenshot({ path: shot, animations: "disabled", timeout: 90_000 });
        report.evidence.push({ viewport: viewport.name, state: item.state, path: shot });
      }
      await page.evaluate((id) => document.getElementById(id).click(), item.close);
      await page.locator(`#${item.panel}`).waitFor({ state: "hidden", timeout: 5_000 });
    }

    await hideDebug(page);
    const hiddenState = await page.locator("#novel-script-debug").evaluate((node) => ({
      hidden: node.hidden,
      ariaHidden: node.getAttribute("aria-hidden"),
      ariaLabel: node.getAttribute("aria-label"),
      text: node.textContent.replace(/\s/gu, ""),
    }));
    assert.deepEqual(hiddenState, { hidden: true, ariaHidden: "true", ariaLabel: null, text: "SCRIPT#｜COPY" }, `${viewport.name}: hide-and-clear contract changed`);
    await context.close();
  }

  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join(" | ")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
  console.log(`SCRIPT debug UI browser check passed: ${report.scans.length} layouts, 2 viewports, 1053 canonical steps`);
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}
