import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/log-full-script");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4317";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const runtimeSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(projectRoot, "gaia-mode-loader.js"), "utf8");
for (const id of ["novel-log-title", "novel-log-view-heard", "novel-log-view-script", "novel-log-script-export"]) {
  assert.equal((htmlSource.match(new RegExp(`id=["']${id}["']`, "gu")) || []).length, 1, `${id} must exist exactly once`);
}
assert.match(runtimeSource, /buildFullScriptMarkdown/u);
assert.match(runtimeSource, /scriptArchiveStepCount/u);
assert.match(runtimeSource, /GAIA_TRUE_END_STORY/u);
assert.match(loaderSource, /novel-mode\.js\?v=gaia-dialogue-fallback-1/u);
assert.match(loaderSource, /novel-mode\.css\?v=gaia-dialogue-fallback-1/u);
assert.match(htmlSource, /gaia-mode-loader\.js\?v=gaia-mode-entry-guide-1/u);

delete globalThis.GAIA_NOVEL_STORY;
delete globalThis.GAIA_TRUE_END_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?full-log=${Date.now()}`);
await import(`${pathToFileURL(path.join(projectRoot, "true-end-data.js")).href}?full-log=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const trueEnd = globalThis.GAIA_TRUE_END_STORY;
const mainSteps = story.scenes.flatMap((scene) => scene.steps);
const trueEndSteps = trueEnd.scenes.flatMap((scene) => scene.steps);
const expectedSteps = [...mainSteps, ...trueEndSteps];
const expectedSectionCount = story.scenes.length + trueEnd.scenes.length;
assert.equal(mainSteps.length, 372);
assert.equal(trueEndSteps.length, 133);
assert.equal(expectedSteps.length, 505);

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const routeUrl = new URL("/story", baseUrl).href;
const progressKey = "gaiaSensewareNovel:progress";
const manualSaveKey = "gaiaSensewareNovel:manual-saves";
const configKey = "gaiaSensewareNovel:config:v4";
const readStepIds = mainSteps.slice(0, 3).map((step) => step.id);
const currentStepId = mainSteps[3].id;
const expectedReadCount = readStepIds.length + 1;
const viewports = [
  { name: "pc-1440", width: 1440, height: 900, hasTouch: false },
  { name: "mobile-390", width: 390, height: 844, hasTouch: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
fs.mkdirSync(outputDir, { recursive: true });

const baseState = () => ({
  storyVersion: story.storyVersion,
  stepId: currentStepId,
  reachedSceneIds: [story.startSceneId],
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds,
  clear: false,
  archivesUnlocked: false,
  sessionId: "log-full-script-browser",
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
  await page.waitForFunction(() => {
    const layer = document.querySelector("#novel-layer");
    return Boolean(layer && !layer.hidden && layer.classList.contains("is-open"));
  }, null, { timeout: 15_000 });
};

const bootAtLogState = async (page) => {
  const storedProgress = baseState();
  await page.evaluate(({ progress, storageKey, manualKey, settingsKey }) => {
    localStorage.setItem(storageKey, JSON.stringify(progress));
    localStorage.setItem(manualKey, JSON.stringify([{
      progress,
      savedAt: Date.now(),
      meta: { title: "FULL SCRIPT QA", excerpt: progress.stepId },
    }]));
    localStorage.setItem(settingsKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { progress: storedProgress, storageKey: progressKey, manualKey: manualSaveKey, settingsKey: configKey });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  if (await page.locator("#novel-title-screen").isVisible()) {
    await page.locator("#novel-resume-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction((id) => globalThis.GaiaNovel?.getState?.().stepId === id, currentStepId, { timeout: 30_000 });
  await page.locator("#novel-log-button").click();
  await page.locator("#novel-log-panel").waitFor({ state: "visible" });
};

const readDownload = async (page) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#novel-log-script-export").click(),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  return { download, buffer, markdown: buffer.subarray(3).toString("utf8") };
};

const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.hasTouch,
      isMobile: viewport.hasTouch,
      acceptDownloads: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (value) => { globalThis.__logClipboard = String(value); } },
      });
    });
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    await bootAtLogState(page);

    assert.equal(await page.locator("#novel-log-content article").count(), expectedReadCount,
      `${viewport.name}: heard LOG count changed`);
    await page.locator("#novel-log-view-script").click();
    await page.waitForFunction((count) => document.querySelectorAll("#novel-log-content .novel-script-entry").length === count,
      expectedSteps.length, { timeout: 15_000 });
    const scan = await page.evaluate(() => {
      const content = document.querySelector("#novel-log-content");
      const sections = [...content.querySelectorAll(".novel-script-section")];
      const entries = [...content.querySelectorAll(".novel-script-entry")];
      return {
        title: document.querySelector("#novel-log-title")?.textContent,
        panelView: document.querySelector("#novel-log-panel")?.dataset.logView,
        contentView: content?.dataset.view,
        selectedScript: document.querySelector("#novel-log-view-script")?.getAttribute("aria-selected"),
        sectionCount: sections.length,
        entryCount: entries.length,
        trueEndCount: content.querySelectorAll('.novel-script-section[data-source="apeironcene"] .novel-script-entry').length,
        unreadCount: content.querySelectorAll('.novel-script-entry[data-read-state="unread"]').length,
        firstId: entries[0]?.dataset.stepId,
        lastId: entries.at(-1)?.dataset.stepId,
        interactionBodies: [...content.querySelectorAll('.novel-script-entry[data-kind="interaction"] .novel-log-entry-text')]
          .map((node) => node.textContent),
        commentsHidden: document.querySelector("#novel-log-comment-count")?.hidden,
        commentExportHidden: document.querySelector("#novel-log-export")?.hidden,
        scriptExportVisible: Boolean(document.querySelector("#novel-log-script-export")?.offsetParent),
        overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        contentOverflowX: Math.max(0, content.scrollWidth - content.clientWidth),
      };
    });
    assert.equal(scan.title, `全台本 ${expectedSteps.length} STEP`);
    assert.equal(scan.panelView, "script");
    assert.equal(scan.contentView, "script");
    assert.equal(scan.selectedScript, "true");
    assert.equal(scan.sectionCount, expectedSectionCount);
    assert.equal(scan.entryCount, expectedSteps.length);
    assert.equal(scan.trueEndCount, trueEndSteps.length);
    assert.equal(scan.unreadCount, expectedSteps.length - expectedReadCount);
    assert.equal(scan.firstId, expectedSteps[0].id);
    assert.equal(scan.lastId, expectedSteps.at(-1).id);
    assert.equal(scan.interactionBodies.length, 3);
    assert(scan.interactionBodies.every((text) => text.startsWith("[展示操作")));
    assert.equal(scan.commentsHidden, true);
    assert.equal(scan.commentExportHidden, true);
    assert.equal(scan.scriptExportVisible, true);
    assert.equal(scan.overflowX, 0);
    assert.equal(scan.contentOverflowX, 0);

    const exported = await readDownload(page);
    assert(exported.buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));
    assert.match(exported.download.suggestedFilename(), /^gaia-senseware-complete-script-\d{8}T\d{6}Z\.md$/u);
    assert.match(exported.markdown, /- 本編: 372 step/u);
    assert.match(exported.markdown, /- APEIRONCENE: 133 step/u);
    assert.match(exported.markdown, /- 合計: 505 step/u);
    assert(exported.markdown.includes(`\`${expectedSteps[0].id}\``));
    assert(exported.markdown.includes(expectedSteps[0].text));
    assert(exported.markdown.includes(`\`${expectedSteps.at(-1).id}\``));
    assert(exported.markdown.includes(expectedSteps.at(-1).text));
    assert(exported.markdown.includes('"requiredViews"'));
    assert.equal(await page.locator("#novel-log-status").textContent(), "全台本 505stepを書き出しました");
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-full-script.png`), animations: "disabled" });

    await page.locator("#novel-log-view-heard").click();
    assert.equal(await page.locator("#novel-log-content article").count(), expectedReadCount);
    assert.equal(await page.locator("#novel-log-comment-count").isVisible(), true);
    assert.equal(await page.locator("#novel-log-export").isVisible(), true);
    report.scans.push({ viewport, scan, download: exported.download.suggestedFilename(), passed: true });
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

console.log(`LOG full-script browser check passed: ${report.scans.length} viewports / ${expectedSteps.length} steps`);
