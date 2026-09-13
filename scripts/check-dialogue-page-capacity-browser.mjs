import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/dialogue-page-capacity");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4310";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?dialogue-capacity=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const allSteps = story.scenes.flatMap((scene) => scene.steps);
const target = allSteps.find((step) => step.id === "prologue_basil_017");
assert(target, "prologue_basil_017 is missing");
assert.equal(target.text.endsWith("入っている。"), true, "target ending changed");

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const routeUrl = new URL("/story", baseUrl).href;
const storageKey = "gaiaSensewareNovel:progress";
const configKey = "gaiaSensewareNovel:config:v2";
const viewports = [
  { name: "pc-2048", width: 2048, height: 1114 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "pc-1280", width: 1280, height: 800 },
  { name: "pc-1024", width: 1024, height: 768 },
  { name: "pc-1554-short", width: 1554, height: 465 },
  { name: "pc-1612-short", width: 1612, height: 454 },
  { name: "mobile-390", width: 390, height: 844 },
];
const viewportFilter = process.env.GAIA_VIEWPORT_FILTER || "";
const selectedViewports = viewportFilter
  ? viewports.filter((viewport) => viewport.name === viewportFilter)
  : viewports;
assert(selectedViewports.length > 0, `unknown viewport filter: ${viewportFilter}`);
const report = {
  status: "running",
  stepId: target.id,
  sourceText: target.text,
  sourceCharacters: Array.from(target.text.replace(/\s/gu, "")).length,
  viewports,
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
  sessionId: "dialogue-page-capacity-browser",
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`); });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });
};

const bootAt = async (page, stepId) => {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(({ progressKey, settingsKey, progress }) => {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer.classList.contains("is-open")) globalThis.GaiaNovel.open();
  }, { progressKey: storageKey, settingsKey: configKey, progress: baseState(stepId) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel), null, { timeout: 15_000 });
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    if (layer?.hidden || !layer.classList.contains("is-open")) globalThis.GaiaNovel.open();
  });
  await page.locator("#novel-resume-button").click();
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 15_000 });
  await page.waitForFunction(() => Boolean(document.querySelector("#novel-text")?.dataset.pageCount), null, { timeout: 15_000 });
  await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 15_000 });
};

const metrics = (page) => page.evaluate((sourceText) => {
  const dialogue = document.querySelector("#novel-dialogue");
  const text = document.querySelector("#novel-text");
  const indicator = document.querySelector("#novel-continue");
  const dialogueRect = dialogue.getBoundingClientRect();
  const textRect = text.getBoundingClientRect();
  const indicatorRect = indicator.getBoundingClientRect();
  const dialogueStyle = getComputedStyle(dialogue);
  const textStyle = getComputedStyle(text);
  const paddingTop = Number.parseFloat(dialogueStyle.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(dialogueStyle.paddingBottom) || 0;
  const lineHeight = Number.parseFloat(textStyle.lineHeight) || 0;
  const buffer = 4;
  const contentHeight = dialogue.clientHeight - paddingTop - paddingBottom - buffer;

  const measure = document.createElement("p");
  measure.setAttribute("aria-hidden", "true");
  Object.assign(measure.style, {
    position: "fixed",
    visibility: "hidden",
    inset: "0 auto auto 0",
    width: `${text.clientWidth}px`,
    margin: "0",
    padding: "0",
    font: textStyle.font,
    fontFamily: textStyle.fontFamily,
    fontSize: textStyle.fontSize,
    fontWeight: textStyle.fontWeight,
    fontFeatureSettings: textStyle.fontFeatureSettings,
    fontKerning: textStyle.fontKerning,
    letterSpacing: textStyle.letterSpacing,
    lineHeight: textStyle.lineHeight,
    lineBreak: textStyle.lineBreak,
    overflowWrap: textStyle.overflowWrap,
    wordBreak: textStyle.wordBreak,
    whiteSpace: textStyle.whiteSpace,
  });
  measure.textContent = sourceText;
  document.body.append(measure);
  const range = document.createRange();
  range.selectNodeContents(measure);
  const fullLineTops = [...range.getClientRects()]
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => Math.round(rect.top * 2) / 2);
  range.detach();
  const fullLineCount = new Set(fullLineTops).size;
  const fullHeight = measure.getBoundingClientRect().height;
  measure.remove();

  return {
    pageCount: Number(text.dataset.pageCount),
    pageIndex: Number(text.dataset.pageIndex),
    pageText: text.getAttribute("aria-label") || text.textContent,
    pageCharacters: Number(text.dataset.characterCount),
    pageLines: Number(text.dataset.measuredLineCount),
    maxLines: Number(text.dataset.maxLineCount),
    dialogue: { width: dialogueRect.width, height: dialogueRect.height },
    text: { width: textRect.width, height: textRect.height, fontSize: Number.parseFloat(textStyle.fontSize), lineHeight },
    padding: { top: paddingTop, bottom: paddingBottom },
    contentHeight,
    indicator: { top: indicatorRect.top, bottom: indicatorRect.bottom, height: indicatorRect.height },
    indicatorSafety: indicatorRect.top - textRect.bottom,
    fullText: { lines: fullLineCount, height: fullHeight, fitsThreeLines: fullLineCount <= 3 && fullHeight <= contentHeight },
    bodyOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  };
}, target.text);

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of selectedViewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await bootAt(page, target.id);
    const pages = [await metrics(page)];
    const expectedPages = pages[0].pageCount;
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-page-1.png`), animations: "disabled" });
    for (let index = 2; index <= expectedPages; index += 1) {
      await page.locator("#novel-dialogue").click();
      await page.waitForFunction((pageIndex) => Number(document.querySelector("#novel-text")?.dataset.pageIndex) === pageIndex, index);
      await page.locator("#novel-continue.is-visible").waitFor({ state: "visible", timeout: 15_000 });
      pages.push(await metrics(page));
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-page-${index}.png`), animations: "disabled" });
    }
    assert.equal(pages.map((item) => item.pageText).join("").replace(/\s/gu, ""), target.text.replace(/\s/gu, ""), `${viewport.name}: pagination lost text`);
    assert.equal(pages.at(-1).pageLines > 1 || expectedPages === 1, true, `${viewport.name}: final page is a single orphaned line`);
    assert.equal(pages.every((item) => item.pageLines <= 3), true, `${viewport.name}: a page exceeded three rendered lines`);
    assert.equal(pages.every((item) => item.indicatorSafety >= 12), true, `${viewport.name}: page text entered the indicator safety area`);
    if (viewport.name === "mobile-390") {
      assert.deepEqual(pages.map((item) => item.pageLines), [3, 2], "mobile-390: target must balance to 3+2 rendered lines");
    } else {
      assert.equal(expectedPages, 1, `${viewport.name}: fitting target was unnecessarily paginated: ${JSON.stringify(pages)}`);
    }
    assert.equal(pages[0].bodyOverflow, 0, `${viewport.name}: horizontal overflow`);
    report.scans.push({ viewport, pages, passed: true });
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

console.log(`dialogue page capacity check passed: ${report.scans.length} viewports`);
