import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/dialogue-pagination");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4311";
const viewportFilter = process.env.GAIA_VIEWPORT_FILTER || "";
const stepFilter = process.env.GAIA_STEP_FILTER || "";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?dialogue-pagination=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const allSteps = story.scenes.flatMap((scene) => scene.steps);
const textSteps = allSteps
  .filter((step) => ["narration", "dialogue"].includes(step.type))
  .filter((step) => !stepFilter || step.id === stepFilter)
  .map(({ id, sceneId, type, text }) => ({ id, sceneId, type, text: String(text || "") }));
assert(textSteps.length > 0, `no text steps matched ${stepFilter || "the story"}`);

const viewports = [
  { name: "pc-1920", width: 1920, height: 1080 },
  { name: "pc-3840", width: 3840, height: 2160 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "pc-low-1366", width: 1366, height: 600 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-320", width: 320, height: 568, mobile: true },
  { name: "mobile-landscape-568", width: 568, height: 320, mobile: true },
].filter((viewport) => !viewportFilter || viewport.name === viewportFilter);
assert(viewports.length > 0, `unknown viewport filter: ${viewportFilter}`);

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const manualSaveKey = "gaiaSensewareNovel:manual-saves";
const configKey = "gaiaSensewareNovel:config:v4";
const report = {
  status: "running",
  storyVersion: story.storyVersion,
  totalSteps: allSteps.length,
  auditedTextSteps: textSteps.length,
  viewports: {},
  consoleErrors: [],
  pageErrors: [],
  responses404: [],
};
fs.mkdirSync(outputDir, { recursive: true });

const baseState = {
  storyVersion: story.storyVersion,
  stepId: textSteps[0].id,
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
  sessionId: "dialogue-pagination-check",
};

const sentenceEnd = /[\u3002\uff01\uff1f!?][\u300d\u300f\u3011\u3015\uff3d\uff09\)\u3009\u300b\u201d\u2019"']*$/u;
const safeBoundary = /[\u3002\uff01\uff1f!?\u3001\uff0c,\u30fb\uff1a:；;\s\u300d\u300f\u3011\uff09\)]$/u;
const asciiToken = /[A-Za-z0-9_]/u;
const forbiddenLineStart = /^[、。，．？！…」』）】］〉》〕ぁぃぅぇぉっゃゅょァィゥェォッャュョヮヵヶー]/u;
const forbiddenLineEnd = /[「『（【［〈《〔]$/u;
const protectedPhrases = ["そのもの", "ものづくり", "リアルタイム", "GAIA SENSEWARE"];

const analyzeStep = (step, pagination) => {
  const errors = [];
  const pageTexts = pagination.pages.map((page) => page.text);
  if (pageTexts.join("") !== step.text) errors.push("source text mismatch");
  pagination.pages.forEach((page, index) => {
    if (!page.fits) errors.push(`page ${index + 1} does not fit`);
    if (page.lines > 3 || page.lines > page.maxLines) errors.push(`page ${index + 1} exceeds rendered line limit`);
    if (page.indicatorClearance < 12) errors.push(`page ${index + 1} indicator clearance ${page.indicatorClearance}`);
    if (page.horizontalOverflow > 1) errors.push(`page ${index + 1} horizontal overflow ${page.horizontalOverflow}`);
    if (page.tokenSource !== page.text) errors.push(`page ${index + 1} token source mismatch`);
    page.tokenLines.forEach((line, lineIndex) => {
      const text = line.text.trim();
      if (forbiddenLineStart.test(text)) errors.push(`page ${index + 1} line ${lineIndex + 1} starts with forbidden punctuation`);
      if (forbiddenLineEnd.test(text)) errors.push(`page ${index + 1} line ${lineIndex + 1} ends with an opening bracket`);
    });
  });

  protectedPhrases.forEach((phrase) => {
    if (!step.text.includes(phrase)) return;
    if (!pagination.tokens.some((token) => token.includes(phrase))) errors.push(`protected phrase is not atomic: ${phrase}`);
  });

  const sourceGlyphs = Array.from(step.text);
  const tokenBoundaries = new Set();
  let tokenOffset = 0;
  pagination.tokens.forEach((token) => {
    tokenOffset += Array.from(token).length;
    tokenBoundaries.add(tokenOffset);
  });
  let offset = 0;
  for (let index = 0; index < pagination.pages.length - 1; index += 1) {
    offset += Array.from(pagination.pages[index].text).length;
    const left = sourceGlyphs[offset - 1] || "";
    const right = sourceGlyphs[offset] || "";
    if (asciiToken.test(left) && asciiToken.test(right)) errors.push(`boundary ${index + 1} splits an ASCII token`);
    const sentenceBoundary = sentenceEnd.test(pagination.pages[index].text.trimEnd());
    const punctuationBoundary = safeBoundary.test(left);
    if (!sentenceBoundary && !punctuationBoundary && !tokenBoundaries.has(offset)) {
      errors.push(`boundary ${index + 1} is not a safe punctuation or token boundary`);
    }
  }
  return errors;
};

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
    });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel?.inspectDialoguePagination), null, { timeout: 15_000 });
    await page.evaluate(() => GaiaNovel.open());
    await page.evaluate(({ progressKey, saveKey, settingsKey, progress }) => {
      localStorage.setItem(progressKey, JSON.stringify(progress));
      localStorage.setItem(saveKey, JSON.stringify([{
        progress,
        savedAt: Date.now(),
        meta: { title: "Dialogue pagination check", excerpt: progress.stepId },
      }]));
      localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    }, { progressKey: storageKey, saveKey: manualSaveKey, settingsKey: configKey, progress: baseState });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel?.inspectDialoguePagination), null, { timeout: 15_000 });
    const resumed = await page.waitForFunction(
      (expectedStepId) => document.querySelector("#novel-layer")?.dataset.stepId === expectedStepId,
      baseState.stepId,
      { timeout: 5_000 },
    ).then(() => true, () => false);
    if (!resumed) {
      await page.evaluate(() => globalThis.GaiaNovel.open());
      await page.locator("#novel-resume-button").waitFor({ state: "visible", timeout: 15_000 });
      await page.locator("#novel-resume-button").click();
      await page.waitForTimeout(80);
      if (await page.locator("#novel-save-panel").isVisible()) {
        await page.locator('.novel-save-slot[data-slot-index="0"]').click();
      }
    }
    await page.waitForFunction((expectedStepId) => {
      const layer = document.querySelector("#novel-layer");
      const runtime = document.querySelector("#novel-runtime");
      const text = document.querySelector("#novel-text");
      if (layer?.dataset.stepId !== expectedStepId || !runtime || !text) return false;
      if (runtime.hidden || runtime.getAttribute("aria-hidden") === "true") return false;
      const runtimeRect = runtime.getBoundingClientRect();
      const textRect = text.getBoundingClientRect();
      return runtimeRect.width > 0 && runtimeRect.height > 0 && textRect.width > 0;
    }, baseState.stepId, { timeout: 15_000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const results = await page.evaluate((steps) => steps.map((step) => ({
      id: step.id,
      pagination: globalThis.GaiaNovel.inspectDialoguePagination(step.text),
    })), textSteps);
    if (viewport.width >= 1920 && !stepFilter) {
      const regression = results.find((entry) => entry.id === "festival_concept_new_028").pagination;
      assert.equal(regression.pages.length, 1, "The three-line CO2 paragraph must not become a 1+2-line page split");
      assert.deepEqual(regression.pages[0].tokenLines.map((line) => line.text), [
        "画面の端にはCO2濃度だけでなく、",
        "風向や都市の電力消費のパラメータも並んでいた。",
        "気象シミュレーションという枠をはるかに超えている。",
      ]);
    }
    const phraseRegression = await page.evaluate(() => GaiaNovel.inspectDialoguePagination("わたくしたちのハンドルネームと、四十数億年のGAIA Transformationを確かめる。"));
    for (const phrase of ["わたくしたち", "ハンドルネーム", "四十数億年", "GAIA Transformation"]) {
      assert(phraseRegression.tokens.some((token) => token.includes(phrase)), `Split phrase: ${phrase}`);
    }
    for (const source of ["「GAIA SENSEWARE」は、リアルタイムの観測を重ねる。\nものづくりの、そのものを考える。", `${"ながいことば".repeat(25)}。`]) {
      const fallback = await page.evaluate((text) => GaiaNovel.inspectDialoguePagination(text, { forceFallback: true }), source);
      assert.equal(fallback.pages.map((part) => part.text).join(""), source);
      assert(fallback.pages.every((part) => part.fits && part.horizontalOverflow <= 1 && part.lines <= 3));
    }
    let mobileBoundaryRegression = null;
    if (viewport.name === "mobile-390" && !stepFilter) {
      // Keep the ICU fragmentation regression independent of script revisions.
      const regressionText = "秋の光が差し込むと、キャンパスの表情がゆっくり変わる。画面越しに見ていた景色が、目の前の空気と重なっていく。";
      await page.setViewportSize({ width: 280, height: 700 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      mobileBoundaryRegression = await page.evaluate((text) => {
        const NativeSegmenter = Intl.Segmenter;
        class FragmentingSegmenter {
          constructor(...args) {
            this.native = new NativeSegmenter(...args);
          }

          segment(source) {
            const parts = [];
            for (const part of this.native.segment(source)) {
              if (part.segment === "変わる") {
                parts.push({ ...part, segment: "変" });
                parts.push({ ...part, segment: "わる", index: Number(part.index || 0) + 1 });
              } else {
                parts.push(part);
              }
            }
            return parts;
          }
        }

        Intl.Segmenter = FragmentingSegmenter;
        try {
          return globalThis.GaiaNovel.inspectDialoguePagination(text);
        } finally {
          Intl.Segmenter = NativeSegmenter;
        }
      }, regressionText);
      assert(mobileBoundaryRegression.tokens.some((token) => token.includes("変わる")), "ICU fragmentation split 変わる into separate page tokens");
      mobileBoundaryRegression.pages.slice(0, -1).forEach((pageResult, pageIndex) => {
        assert(safeBoundary.test(pageResult.text.trimEnd()), `mobile regression boundary ${pageIndex + 1} is not punctuation-safe: ${pageResult.text}`);
      });
      assert(!mobileBoundaryRegression.pages.some((pageResult, pageIndex) => (
        pageIndex < mobileBoundaryRegression.pages.length - 1
        && pageResult.text.endsWith("変")
        && mobileBoundaryRegression.pages[pageIndex + 1].text.startsWith("わる")
      )), "mobile regression split 変わる across pages");
    }
    const byId = new Map(results.map((result) => [result.id, result.pagination]));
    const failures = textSteps.flatMap((step) => {
      const pagination = byId.get(step.id);
      return analyzeStep(step, pagination).map((error) => ({ id: step.id, error, pagination }));
    });
    let runtimeFlow = null;
    if (textSteps.length === 1) {
      const step = textSteps[0];
      const pagination = byId.get(step.id);
      const storyIndex = allSteps.findIndex((candidate) => candidate.id === step.id);
      const nextStep = allSteps[storyIndex + 1];
      assert(nextStep, `${step.id}: no next step is available for the runtime progression check`);
      const visiblePages = [];
      for (let pageIndex = 1; pageIndex <= pagination.pages.length; pageIndex += 1) {
        await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 15_000 });
        const state = await page.evaluate(() => {
          const text = document.querySelector("#novel-text");
          return {
            stepId: document.querySelector("#novel-layer")?.dataset.stepId,
            pageIndex: Number(text?.dataset.pageIndex),
            pageCount: Number(text?.dataset.pageCount),
            text: text?.getAttribute("aria-label") || text?.textContent || "",
          };
        });
        assert.equal(state.stepId, step.id, `${step.id}: runtime advanced before its final page`);
        assert.equal(state.pageIndex, pageIndex, `${step.id}: expected runtime page ${pageIndex}, got ${state.pageIndex}`);
        assert.equal(state.pageCount, pagination.pages.length, `${step.id}: inspection and runtime page counts differ`);
        visiblePages.push(state.text);
        const box = await page.locator("#novel-dialogue").boundingBox();
        assert(box, `${step.id}: dialogue hit target is unavailable`);
        const point = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        if (viewport.mobile) await page.touchscreen.tap(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
        if (pageIndex < pagination.pages.length) {
          await page.waitForFunction((expected) => Number(document.querySelector("#novel-text")?.dataset.pageIndex) === expected, pageIndex + 1);
        }
      }
      await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId !== id, step.id, { timeout: 15_000 });
      const reachedStepId = await page.locator("#novel-layer").getAttribute("data-step-id");
      assert.equal(reachedStepId, nextStep.id, `${step.id}: runtime did not advance to the next story step`);
      assert.equal(visiblePages.join(""), step.text, `${step.id}: runtime pages did not preserve the full source text`);
      runtimeFlow = { input: viewport.mobile ? "touch" : "mouse", pageCount: visiblePages.length, reachedStepId };
    }
    report.viewports[viewport.name] = {
      viewport,
      audited: results.length,
      multiPage: results.filter((result) => result.pagination.pages.length > 1).length,
      failures,
      mobileBoundaryRegression,
      runtimeFlow,
    };
    await context.close();
  }
  const failures = Object.values(report.viewports).flatMap((viewport) => viewport.failures);
  assert.equal(failures.length, 0, `${failures.length} pagination failures; first: ${JSON.stringify(failures[0])}`);
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

console.log(`dialogue pagination check passed: ${textSteps.length} steps x ${viewports.length} viewports`);
