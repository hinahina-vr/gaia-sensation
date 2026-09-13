import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/scene-jump-ui");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4310";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const cssSource = fs.readFileSync(path.join(projectRoot, "novel-mode.css"), "utf8");
const runtimeSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");

const navOrder = [
  "novel-eves-button",
  "novel-log-button",
  "novel-save-button",
  "novel-load-button",
  "novel-config-button",
  "novel-auto-button",
  "novel-fast-forward-button",
  "novel-jump-button",
];
for (const id of [...navOrder, "novel-restart-button", "novel-jump-panel", "novel-jump-list", "novel-jump-current", "novel-jump-close"]) {
  assert.equal((htmlSource.match(new RegExp(`id=["']${id}["']`, "gu")) || []).length, 1, `${id} must exist exactly once`);
}
const navSource = htmlSource.match(/<nav aria-label="ストーリーモードの操作">([\s\S]*?)<\/nav>/u)?.[1] || "";
const sourceOrder = [...navSource.matchAll(/id="([^"]+)"/gu)].map((match) => match[1]).filter((id) => navOrder.includes(id));
assert.deepEqual(sourceOrder, navOrder, "authoritative nav order changed");
assert.match(navSource, /id="novel-restart-button"[^>]*aria-hidden="true"[^>]*tabindex="-1"[^>]*hidden/u, "RESTART is not hidden from users");
assert.match(cssSource, /#novel-restart-button\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/u);
assert.match(runtimeSource, /novel-jump-(?:button|panel|list|current|close)/u, "JUMP UI is not bound to the integrated runtime");

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?scene-jump=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const steps = story.scenes.flatMap((scene) => scene.steps);
assert.equal(story.scenes.length, 6, "canonical scene count changed");
const sceneItems = story.scenes.map((scene, index) => ({
  id: scene.id,
  index: index + 1,
  chapter: scene.chapter,
  title: scene.title,
  script: steps.findIndex((step) => step.id === scene.steps[0].id) + 1,
}));
assert(sceneItems.every((item) => item.script > 0), "a scene has no first SCRIPT number");

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
  parent: "d267d2159456f61732a2bd9e735fb6783ed652f5",
  storySteps: steps.length,
  sceneCount: sceneItems.length,
  navOrder,
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
  sessionId: "scene-jump-ui-browser",
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
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.classList.contains("is-open"), null, { timeout: 15_000 });
};

const bootAt = async (page, stepId) => {
  await page.evaluate(({ progressKey, settingsKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { progressKey: storageKey, settingsKey: configKey, progress: baseState(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  await page.waitForFunction((id) => {
    const layer = document.querySelector("#novel-layer");
    const resume = document.querySelector("#novel-resume-button");
    return layer?.dataset.stepId === id || (resume && !resume.hidden && !resume.disabled);
  }, stepId, { timeout: 60_000 });
  const alreadyAtStep = await page.evaluate((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
  if (!alreadyAtStep) await page.locator("#novel-resume-button:not([hidden]):not([disabled])").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 60_000 });
};

const installMockBinding = (page, currentSceneId) => page.evaluate(({ items, currentId }) => {
  const button = document.querySelector("#novel-jump-button");
  const panel = document.querySelector("#novel-jump-panel");
  const list = document.querySelector("#novel-jump-list");
  const current = document.querySelector("#novel-jump-current");
  const closeButton = document.querySelector("#novel-jump-close");
  const debug = document.querySelector("#novel-script-debug");
  const debugNumber = document.querySelector("#novel-script-debug-number");
  const debugStep = document.querySelector("#novel-script-debug-step-id");
  button.hidden = false;
  button.disabled = false;
  panel.hidden = true;
  list.replaceChildren(...items.map((item) => {
    const row = document.createElement("li");
    const itemButton = document.createElement("button");
    itemButton.type = "button";
    itemButton.className = "novel-jump-item";
    itemButton.dataset.sceneId = item.id;
    itemButton.innerHTML = `<span class="novel-jump-index">${String(item.index).padStart(2, "0")}</span><span class="novel-jump-label"><small></small><strong></strong></span><span class="novel-jump-script">SCRIPT #${String(item.script).padStart(4, "0")}</span>`;
    itemButton.querySelector("small").textContent = item.chapter;
    itemButton.querySelector("strong").textContent = item.title;
    itemButton.setAttribute("aria-label", `${String(item.index).padStart(2, "0")} ${item.chapter} ${item.title} SCRIPT ${item.script}`);
    if (item.id === currentId) {
      itemButton.classList.add("is-current");
      itemButton.setAttribute("aria-current", "true");
    }
    row.append(itemButton);
    return row;
  }));
  const selected = items.find((item) => item.id === currentId);
  current.textContent = selected ? `現在 ${String(selected.index).padStart(2, "0")} / ${items.length}` : "";
  if (debug && debugNumber && debugStep) {
    debugNumber.textContent = String(selected?.script || 1).padStart(4, "0");
    debugStep.textContent = document.querySelector("#novel-layer").dataset.stepId;
    debug.hidden = false;
    debug.setAttribute("aria-hidden", "false");
  }

  const close = ({ restoreFocus = true } = {}) => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button.focus({ preventScroll: true });
  };
  const open = () => {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const currentItem = list.querySelector('[aria-current="true"]') || list.querySelector("button");
    currentItem?.scrollIntoView({ block: "nearest" });
    currentItem?.focus({ preventScroll: true });
  };
  button.addEventListener("click", () => (panel.hidden ? open() : close()));
  closeButton.addEventListener("click", () => close());
  list.addEventListener("click", (event) => {
    if (event.target.closest("[data-scene-id]")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }, true);
  let suppressOutsideClick = false;
  document.addEventListener("pointerdown", (event) => {
    if (panel.hidden || panel.contains(event.target) || button.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    suppressOutsideClick = true;
    close();
  }, true);
  document.addEventListener("click", (event) => {
    if (!suppressOutsideClick) return;
    suppressOutsideClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  globalThis.__gaiaJumpMock = { open, close };
}, { items: sceneItems, currentId: currentSceneId });

const inspectClosed = (page) => page.evaluate(({ expectedOrder }) => {
  const nav = document.querySelector(".novel-topbar nav");
  const restart = document.querySelector("#novel-restart-button");
  const visibleNav = [...nav.children]
    .filter((node) => node.matches("button") && node.id !== "novel-close-button" && getComputedStyle(node).display !== "none")
    .map((node) => node.id);
  const buttonRects = expectedOrder.map((id) => ({ id, rect: (() => { const box = document.querySelector(`#${id}`).getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; })() }));
  const collisions = [];
  for (let left = 0; left < buttonRects.length; left += 1) {
    for (let right = left + 1; right < buttonRects.length; right += 1) {
      const a = buttonRects[left].rect;
      const b = buttonRects[right].rect;
      if (a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5) collisions.push([buttonRects[left].id, buttonRects[right].id]);
    }
  }
  const restartRect = restart.getBoundingClientRect();
  return {
    visibleNav,
    buttonRects,
    collisions,
    restart: {
      hidden: restart.hidden,
      ariaHidden: restart.getAttribute("aria-hidden"),
      tabIndex: restart.tabIndex,
      display: getComputedStyle(restart).display,
      pointerEvents: getComputedStyle(restart).pointerEvents,
      width: restartRect.width,
      height: restartRect.height,
    },
    panelHidden: document.querySelector("#novel-jump-panel").hidden,
    jumpExpanded: document.querySelector("#novel-jump-button").getAttribute("aria-expanded"),
    bodyOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    navContained: buttonRects.every(({ rect: box }) => box.left >= -0.5 && box.right <= innerWidth + 0.5 && box.top >= -0.5 && box.bottom <= innerHeight + 0.5),
  };
}, { expectedOrder: navOrder });

const inspectOpen = (page) => page.evaluate(() => {
  const bounds = (node) => {
    const box = node.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  };
  const overlaps = (left, right) => left.left < right.right - 0.5 && left.right > right.left + 0.5 && left.top < right.bottom - 0.5 && left.bottom > right.top + 0.5;
  const panel = document.querySelector("#novel-jump-panel");
  const list = document.querySelector("#novel-jump-list");
  const nav = document.querySelector(".novel-topbar nav");
  const debug = document.querySelector("#novel-script-debug");
  const dialogueText = document.querySelector("#novel-text");
  const panelBox = panel.getBoundingClientRect();
  const listBox = list.getBoundingClientRect();
  const navBox = nav.getBoundingClientRect();
  const debugBox = debug.getBoundingClientRect();
  const textBox = dialogueText.getBoundingClientRect();
  const items = [...list.querySelectorAll("[data-scene-id]")];
  const current = items.filter((item) => item.matches(".is-current[aria-current='true']"));
  const center = [panelBox.left + panelBox.width / 2, panelBox.top + panelBox.height / 2];
  const top = document.elementsFromPoint(...center)[0];
  const boxes = { panel: bounds(panel), list: bounds(list), nav: bounds(nav), debug: bounds(debug), text: bounds(dialogueText) };
  return {
    boxes,
    count: items.length,
    sceneIds: items.map((item) => item.dataset.sceneId),
    visibleInternalIds: items.filter((item) => item.textContent.includes(item.dataset.sceneId)).length,
    currentCount: current.length,
    currentId: current[0]?.dataset.sceneId || "",
    panelContained: panelBox.left >= -0.5 && panelBox.right <= innerWidth + 0.5 && panelBox.top >= -0.5 && panelBox.bottom <= innerHeight + 0.5,
    listScrolls: list.scrollHeight > list.clientHeight,
    panelOwnScroll: panel.scrollHeight > panel.clientHeight + 1,
    navIntersection: overlaps(panelBox, navBox),
    debugIntersection: overlaps(panelBox, debugBox),
    textIntersection: overlaps(panelBox, textBox),
    frontAtCenter: Boolean(top && (top === panel || panel.contains(top))),
    bodyOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    focusedSceneId: document.activeElement?.dataset?.sceneId || "",
    ariaExpanded: document.querySelector("#novel-jump-button").getAttribute("aria-expanded"),
    currentText: document.querySelector("#novel-jump-current").textContent,
  };
});

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);

    const firstScene = sceneItems[0];
    await bootAt(page, firstScene.id === "current_exhibition" ? "current_exhibition_006" : story.scenes[0].steps[0].id);
    const closed = await inspectClosed(page);
    assert.deepEqual(closed.visibleNav, navOrder.filter((id) => id !== "novel-eves-button"), `${viewport.name}: visible nav order changed`);
    assert.equal(closed.collisions.length, 0, `${viewport.name}: nav buttons overlap: ${JSON.stringify(closed.collisions)}`);
    assert(closed.navContained && closed.bodyOverflow === 0, `${viewport.name}: closed nav overflow: ${JSON.stringify(closed)}`);
    assert(closed.restart.ariaHidden === "true" && closed.restart.tabIndex === -1 && closed.restart.display === "none" && closed.restart.pointerEvents === "none" && closed.restart.width === 0 && closed.restart.height === 0, `${viewport.name}: RESTART remains visible or hittable: ${JSON.stringify(closed.restart)}`);

    await page.locator("#novel-jump-button").click();
    await page.locator("#novel-jump-panel").waitFor({ state: "visible" });
    const open = await inspectOpen(page);
    assert.equal(open.count, sceneItems.length + 1, `${viewport.name}: JUMP list is incomplete`);
    assert.deepEqual(open.sceneIds, [...sceneItems.map((item) => item.id), "ending"], `${viewport.name}: scene data order changed`);
    assert.equal(open.visibleInternalIds, 0, `${viewport.name}: internal scene IDs became visible`);
    assert(open.currentCount === 1 && open.currentId === firstScene.id && open.focusedSceneId === firstScene.id, `${viewport.name}: current scene highlight/focus failed: ${JSON.stringify(open)}`);
    assert(open.panelContained && !open.panelOwnScroll && !open.navIntersection && !open.debugIntersection && !open.textIntersection && open.frontAtCenter && open.bodyOverflow === 0, `${viewport.name}: JUMP panel geometry failed: ${JSON.stringify(open)}`);
    assert.equal(open.ariaExpanded, "true", `${viewport.name}: aria-expanded did not open`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-jump-open.png`), animations: "disabled" });

    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#novel-jump-panel").isHidden(), true, `${viewport.name}: Escape did not close JUMP`);
    assert.equal(await page.locator("#novel-jump-button").getAttribute("aria-expanded"), "false", `${viewport.name}: Escape did not reset aria-expanded`);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "novel-jump-button", `${viewport.name}: Escape did not restore focus`);

    await page.locator("#novel-jump-button").click();
    await page.locator("#novel-jump-close").click();
    assert.equal(await page.locator("#novel-jump-panel").isHidden(), true, `${viewport.name}: close button failed`);
    await page.locator("#novel-jump-button").click();
    await page.locator("#novel-jump-button").evaluate((button) => button.click());
    assert.equal(await page.locator("#novel-jump-panel").isHidden(), true, `${viewport.name}: re-toggle failed`);

    await page.locator("#novel-jump-button").click();
    const stepBeforeOutside = await page.locator("#novel-layer").getAttribute("data-step-id");
    await page.mouse.click(4, Math.round(viewport.height / 2));
    assert.equal(await page.locator("#novel-jump-panel").isHidden(), true, `${viewport.name}: outside pointer did not close`);
    assert.equal(await page.locator("#novel-layer").getAttribute("data-step-id"), stepBeforeOutside, `${viewport.name}: outside pointer advanced the story behind JUMP`);

    await page.evaluate(() => {
      const transition = window.GaiaSceneTransition;
      const originalRun = transition.run.bind(transition);
      window.__gaiaJumpTransitionCalls = 0;
      window.__gaiaJumpTransitionTone = "";
      transition.run = (swapScene, options = {}) => {
        window.__gaiaJumpTransitionCalls += 1;
        window.__gaiaJumpTransitionTone = options.tone || "";
        return originalRun(swapScene, options);
      };
    });
    await page.locator("#novel-jump-button").click();
    await page.locator(".novel-jump-item").nth(1).click();
    await page.waitForFunction(() => window.__gaiaJumpTransitionCalls > 0);
    await page.waitForFunction((sceneId) => document.querySelector("#novel-layer")?.dataset.sceneId === sceneId, sceneItems[1].id);
    assert.equal(await page.locator("#novel-jump-panel").isHidden(), true, `${viewport.name}: scene item did not close JUMP`);
    const jumpTransition = await page.evaluate(() => ({
      calls: window.__gaiaJumpTransitionCalls,
      tone: window.__gaiaJumpTransitionTone,
      sceneId: document.querySelector("#novel-layer")?.dataset.sceneId || "",
      stepType: document.querySelector("#novel-layer")?.dataset.stepType || "",
    }));
    assert.equal(jumpTransition.calls, 1, `${viewport.name}: scene jump did not use exactly one transition`);
    assert.equal(jumpTransition.tone, "novel", `${viewport.name}: scene jump used the wrong transition tone`);
    assert.equal(jumpTransition.sceneId, sceneItems[1].id, `${viewport.name}: scene jump did not reach the selected scene`);
    assert.equal(jumpTransition.stepType, "section-separator", `${viewport.name}: selected scene appeared without its separator`);
    open.jumpTransition = jumpTransition;

    report.scans.push({ viewport, closed, open, passed: true });
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

console.log(`scene JUMP UI browser check passed: ${report.scans.length} viewports, ${report.sceneCount} scenes`);
