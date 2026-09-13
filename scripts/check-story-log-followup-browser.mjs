import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import "../novel-story-data.js";
import "../true-end-data.js";

const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve(process.argv[3] || "artifacts/story-log-2026-09-09/main");
const widths = (process.argv[4] || "1440,390").split(",").map(Number);
const revision = JSON.parse(fs.readFileSync(new URL("../story/LOG_REVISION_2026-09-09.json", import.meta.url), "utf8"));
const main = GAIA_NOVEL_STORY.scenes.flatMap(scene => scene.steps);
const allSteps = [...main, ...GAIA_TRUE_END_STORY.scenes.flatMap(scene => scene.steps)];
const mainMap = new Map(main.map(step => [step.id, step]));
const edits = revision.edits.filter(edit => mainMap.has(edit.runtimeId));
const report = { status: "running", checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
async function boot(context, stepId) {
  if (page && !page.isClosed()) await page.close();
  page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.addInitScript(({ stepId, oldText }) => {
    globalThis.GAIA_BUILD_PROFILE = "debug";
    if (sessionStorage.getItem("story-followup-qa-seeded")) return;
    sessionStorage.setItem("story-followup-qa-seeded", "true");
    const progress = { storyVersion: 13, stepId, reachedSceneIds: ["esp32_pitch"], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null, metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "story-followup-20260909-qa" };
    localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
    localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([null, { progress, savedAt: Date.now() - 86400000, meta: { title: "Previous revision save", excerpt: oldText } }]));
    localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    localStorage.setItem("gaia-senseware-bgm-muted", "true");
  }, { stepId, oldText: revision.edits.find(edit => edit.runtimeId === stepId)?.beforeRuntime.text });
  await page.goto(base + "/?preview=story-log-20260909#story", { waitUntil: "domcontentloaded" });
  await ready(stepId);
}
async function ready(id) {
  await page.waitForFunction(({ id, expected }) => {
    const node = document.querySelector("#novel-text");
    const layer = document.querySelector("#novel-layer");
    const visibleText = node?.getAttribute("aria-label") || node?.textContent;
    return layer?.dataset.stepId === id && layer.dataset.entryTransition === "visible" && !document.body.classList.contains("scene-transitioning") && Number(getComputedStyle(layer).opacity) >= 0.99 && node?.dataset.revealState === "complete" && node.dataset.pageIndex === "1" && visibleText && expected.startsWith(visibleText);
  }, { id, expected: mainMap.get(id).text });
}
async function readPages(id, width, suffix = "") {
  await ready(id);
  const played = [];
  for (let count = 0; count < 15; count++) {
    const scan = await page.evaluate(() => {
      const node = document.querySelector("#novel-text"), box = node.getBoundingClientRect();
      return { page: Number(node.dataset.pageIndex), count: Number(node.dataset.pageCount), text: node.getAttribute("aria-label") || node.textContent, speaker: document.querySelector("#novel-speaker").textContent, excessX: node.scrollWidth - node.clientWidth, excessY: node.scrollHeight - node.clientHeight, outside: box.left < 0 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert(scan.overflow <= 1 && scan.excessX <= 1 && scan.excessY <= 1 && !scan.outside, width + "/" + id + ": clipping");
    played.push(scan);
    if (!suffix) await page.screenshot({ path: path.join(output, width + "-" + id + "-" + scan.page + ".png") });
    if (scan.page >= scan.count) break;
    await page.locator("#novel-layer").evaluate(node => node.click());
    await page.waitForFunction(old => Number(document.querySelector("#novel-text")?.dataset.pageIndex) !== old && document.querySelector("#novel-text")?.dataset.revealState === "complete", scan.page);
  }
  assert.equal(played.map(scan => scan.text).join(""), mainMap.get(id).text, id + ": page text mismatch");
  const expectedSpeaker = { amane: "あめ", visitor: "あなた" }[mainMap.get(id).speaker];
  assert(played.every(scan => scan.speaker === expectedSpeaker), id + ": speaker changed");
  return { id, pages: played };
}
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: "reduce", acceptDownloads: true });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const played = [];
    for (const edit of edits) {
      await boot(context, edit.runtimeId);
      played.push(await readPages(edit.runtimeId, width));
    }
    const lastId = edits.at(-1).runtimeId;
    const layout = await page.evaluate(ids => ids.map(id => {
      const step = GAIA_NOVEL_STORY.scenes.flatMap(scene => scene.steps).find(step => step.id === id);
      return { id, ...GaiaNovel.inspectDialoguePagination(step.text) };
    }), edits.map(edit => edit.runtimeId));
    for (const result of layout) {
      assert.equal(result.pages.map(page => page.text).join(""), result.source);
      assert(result.pages.every(page => page.fits && page.horizontalOverflow <= 1));
    }
    await page.locator("#novel-save-button").click();
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gaiaSensewareNovel:manual-saves"))[0]);
    assert.equal(saved.progress.stepId, lastId);
    assert.equal(saved.meta.excerpt, mainMap.get(lastId).text.slice(0, 120));
    await page.locator("#novel-save-close").click();
    const nextId = main[main.findIndex(step => step.id === lastId) + 1].id;
    await page.locator("#novel-layer").evaluate(node => node.click());
    await ready(nextId);
    await page.locator("#novel-load-button").click();
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    await readPages(lastId, width, "loaded");
    // Load a fixture saved against the previous text revision, using the real LOAD UI.
    await page.locator("#novel-load-button").click();
    await page.locator('.novel-save-slot[data-slot-index="1"]').click();
    await readPages(lastId, width, "old-save");
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(lastId);
    await page.locator("#novel-log-button").click();
    await page.locator("#novel-log-view-script").click();
    await page.waitForFunction(() => document.querySelectorAll(".novel-script-entry").length === 544);
    for (const edit of revision.edits) {
      const text = await page.locator('.novel-script-entry[data-step-id="' + edit.runtimeId + '"] .novel-log-entry-text').textContent();
      assert.equal(text, edit.runtimePatch.text, edit.runtimeId + ": LOG still shows old text");
    }
    assert(!(await page.locator("#novel-log-content").textContent()).includes("逗子"));
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#novel-log-script-export").click()]);
    const exportedPath = path.join(output, width + "-complete-script.md");
    await download.saveAs(exportedPath);
    const markdown = fs.readFileSync(exportedPath, "utf8").replace(/^\uFEFF/u, "");
    const unquoted = markdown.replace(/^> ?/gmu, "");
    for (const edit of revision.edits) assert(markdown.includes(edit.runtimePatch.text), edit.runtimeId + ": export missing correction");
    for (const step of allSteps) {
      assert(markdown.includes("\u0060" + step.id + "\u0060"), step.id + ": export missing ID");
      if (step.text) assert(unquoted.includes(step.text), step.id + ": export missing text");
    }
    assert(!markdown.includes("逗子"));
    await page.screenshot({ path: path.join(output, width + "-full-script-export.png") });
    report.checks.push({ width, played, layout, save: saved.progress.stepId, oldSaveLoad: true, reload: true, fullLogEntries: 544, exportedPath, exportedCorrectionCount: revision.edits.length });
    await context.close();
    console.log("PASS " + width + "px: all 4 revised main dialogues, SAVE/LOAD, previous-revision save, reload, 544-entry LOG and Markdown download");
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
