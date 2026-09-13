import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(outputArgument || "artifacts/user-script-browser");
const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?user-script=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const steps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(steps.map((step) => [step.id, step]));
const routeUrl = new URL("/story", baseUrl).href;
const STORAGE_KEY = "gaiaSensewareNovel:progress";
const CONFIG_KEY = "gaiaSensewareNovel:config:v4";
const report = { status: "running", baseUrl: routeUrl, viewports: [], consoleErrors: [], pageErrors: [], responses404: [] };
fs.mkdirSync(outputDir, { recursive: true });

const progressAtStart = () => ({
  storyVersion: story.storyVersion,
  stepId: steps[0].id,
  reachedSceneIds: [],
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: "user-script-browser",
});

const currentStepId = (page) => page.locator("#novel-layer").getAttribute("data-step-id");

const advanceLinear = async (page, previous) => {
  for (let guard = 0; guard < 96; guard += 1) {
    if (await page.locator("#novel-layer").evaluate((layer) => layer.classList.contains("is-background-transitioning") || layer.hasAttribute("aria-busy"))) {
      await page.waitForFunction(() => {
        const layer = document.querySelector("#novel-layer");
        return layer && !layer.classList.contains("is-background-transitioning") && !layer.hasAttribute("aria-busy");
      }, null, { timeout: 15_000 });
    }
    await page.locator("#novel-layer").dispatchEvent("click");
    await page.waitForTimeout(25);
    if (await currentStepId(page) !== previous) return;
    if (await page.locator(".novel-staff-roll").count()) return;
    if (await page.locator("body").evaluate((body) => body.classList.contains("scene-transitioning"))) {
      await page.waitForFunction(() => !document.body.classList.contains("scene-transitioning"), null, { timeout: 8_000 });
      if (await currentStepId(page) !== previous) return;
    }
  }
  const diagnostics = await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    const text = document.querySelector("#novel-text");
    return {
      layerClasses: layer?.className,
      layerBusy: layer?.getAttribute("aria-busy"),
      backgroundPhase: layer?.dataset.backgroundTransitionPhase,
      textState: text?.dataset.revealState,
      pageIndex: text?.dataset.pageIndex,
      pageCount: text?.dataset.pageCount,
      chapterHidden: document.querySelector("#novel-chapter-card")?.hidden,
      runtimeHidden: document.querySelector("#novel-runtime")?.hidden,
    };
  });
  throw new Error(`step did not advance after all dialogue pages: ${previous} ${JSON.stringify(diagnostics)}`);
};

const completeInteraction = async (page, step) => {
  if (!["map01", "gx"].includes(step.interaction.kind)) await page.locator(".novel-interaction-open").click();
  if (step.interaction.kind === "map01") {
    await page.locator("#story-map-modal-skip").waitFor({ state: "visible", timeout: 15_000 });
    await page.evaluate(({ requiredViews }) => {
      requiredViews.forEach((view) => {
        window.dispatchEvent(new CustomEvent("gaia:story-map-interaction", { detail: { view } }));
      });
      window.dispatchEvent(new CustomEvent("gaia:story-mode-return-to-novel", { detail: { kind: "map01" } }));
    }, { requiredViews: step.interaction.requiredViews || [] });
  } else if (step.interaction.kind === "gx") {
    await page.locator("#gx-layer").waitFor({ state: "visible", timeout: 15_000 });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("gaia:gx-story-progress", { detail: { count: 3, phase: 8, complete: true } }));
      window.dispatchEvent(new CustomEvent("gaia:gx-return-to-novel"));
    });
  } else {
    throw new Error(`unsupported required interaction: ${step.interaction.kind}`);
  }
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, step.id, { timeout: 15_000 });
};

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of [
    { name: "pc-1440", width: 1440, height: 900 },
    { name: "mobile-390", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    await page.addInitScript(({ storageKey, configKey, progress }) => {
      localStorage.setItem(storageKey, JSON.stringify(progress));
      localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    }, { storageKey: STORAGE_KEY, configKey: CONFIG_KEY, progress: progressAtStart() });
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
    if (!await page.evaluate(() => document.body.classList.contains("novel-open"))) {
      await page.evaluate(() => globalThis.GaiaNovel.open());
    }
    await page.locator("#novel-runtime").waitFor({ state: "visible", timeout: 20_000 });
    if (await page.locator("#novel-resume-button").isVisible()) await page.locator("#novel-resume-button").click();
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, steps[0].id, { timeout: 15_000 });

    const visited = [];
    const sceneCaptures = new Set();
    for (let guard = 0; guard < steps.length + 8; guard += 1) {
      const id = await currentStepId(page);
      const step = stepMap.get(id);
      assert(step, `${viewport.name}: unknown runtime step ${id}`);
      if (await page.locator("#novel-chapter-card").isVisible()) {
        await page.locator("#novel-layer").dispatchEvent("click");
        await page.locator("#novel-chapter-card").waitFor({ state: "hidden" });
        if (["narration", "dialogue"].includes(step.type)) {
          await page.waitForFunction(({ stepId }) => {
            const layer = document.querySelector("#novel-layer");
            const dialogue = document.querySelector("#novel-dialogue");
            const copy = document.querySelector("#novel-text");
            return layer?.dataset.stepId === stepId
              && dialogue
              && !dialogue.hidden
              && Boolean(copy?.getAttribute("aria-label"));
          }, { stepId: step.id }, { timeout: 20_000 });
        }
      }
      const cue = await page.evaluate((stepId) => globalThis.GaiaNovel.getBackgroundCue(stepId), id);
      assert(cue?.assetPath, `${viewport.name}: ${id} has no rendered background cue`);
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - innerWidth,
        body: document.body.scrollWidth - innerWidth,
      }));
      assert(overflow.document <= 1 && overflow.body <= 1, `${viewport.name}: horizontal overflow at ${id}: ${JSON.stringify(overflow)}`);
      visited.push(id);
      if (!sceneCaptures.has(step.sceneId)) {
        sceneCaptures.add(step.sceneId);
        await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${step.sceneId}.png`), animations: "disabled" });
      }
      if (id === "welcome_chat_095") {
        await page.locator(".novel-staff-roll").waitFor({ state: "visible", timeout: 15_000 });
        break;
      }
      if (step.type === "interaction") await completeInteraction(page, step);
      else await advanceLinear(page, id);
    }
    assert.deepEqual(visited, steps.map((step) => step.id), `${viewport.name}: full script order/count changed`);
    const state = await page.evaluate(() => globalThis.GaiaNovel.getState());
    assert.equal(state.storyVersion, 13, `${viewport.name}: story version was not persisted`);
    report.viewports.push({ viewport: viewport.name, visitedSteps: visited.length, scenes: [...sceneCaptures], passed: true });
    await context.close();
  }
  assert.deepEqual(report.consoleErrors, [], `console errors: ${report.consoleErrors.join(" | ")}`);
  assert.deepEqual(report.pageErrors, [], `page errors: ${report.pageErrors.join(" | ")}`);
  assert.deepEqual(report.responses404, [], `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(`user script browser check passed: ${steps.length} steps across ${report.viewports.length} viewports`);
