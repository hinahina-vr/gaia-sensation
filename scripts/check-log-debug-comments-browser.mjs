import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [moduleArgument, executableArgument, outputArgument, baseUrlArgument] = process.argv.slice(2);
const moduleRoot = process.env.GAIA_PLAYWRIGHT_PATH || moduleArgument;
const executablePath = process.env.GAIA_BROWSER_EXECUTABLE || executableArgument;
const outputDir = path.resolve(process.env.GAIA_BROWSER_ARTIFACTS || outputArgument || "artifacts/log-debug-comments");
const baseUrl = process.env.GAIA_BASE_URL || baseUrlArgument || "http://127.0.0.1:4312";
if (!moduleRoot || !executablePath) throw new Error("GAIA_PLAYWRIGHT_PATH and GAIA_BROWSER_EXECUTABLE are required");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const runtimeSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");
for (const id of ["novel-log-comment-count", "novel-log-delete-all", "novel-log-export", "novel-log-status"]) {
  assert.equal((htmlSource.match(new RegExp(`id=["']${id}["']`, "gu")) || []).length, 1, `${id} must exist exactly once`);
}
assert.match(runtimeSource, /sessionStorage/u, "LOG comments must use sessionStorage");
assert.match(runtimeSource, /gaiaSensewareNovel:log-comments:v1/u, "LOG comment storage key is missing");
assert.match(runtimeSource, /text\/markdown;charset=utf-8/u, "UTF-8 Markdown export is missing");
assert.match(runtimeSource, /gaia-log-open/u, "LOG open state class is missing");
assert.match(runtimeSource, /className = "novel-log-delete"/u, "LOG comment delete control is missing");
assert.match(runtimeSource, /window\.confirm\(/u, "LOG comment deletion confirmation is missing");
assert.match(runtimeSource, /deleteAllLogComments/u, "LOG comment delete-all action is missing");
assert.match(htmlSource, /gaia-script-natural-copy-1/gu, "LOG runtime cache key is missing");

delete globalThis.GAIA_NOVEL_STORY;
await import(`${pathToFileURL(path.join(projectRoot, "novel-story-data.js")).href}?log-comments=${Date.now()}`);
const story = globalThis.GAIA_NOVEL_STORY;
const steps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(steps.map((step) => [step.id, step]));
const readStepIds = steps.slice(0, 3).map((step) => step.id);
const currentStepId = steps[3].id;
const expectedLogIds = [...readStepIds, currentStepId];
const commentStorageKey = "gaiaSensewareNovel:log-comments:v1";
const progressKey = "gaiaSensewareNovel:progress";
const manualSaveKey = "gaiaSensewareNovel:manual-saves";
const settingsKey = "gaiaSensewareNovel:config:v2";

const { chromium } = await import(pathToFileURL(path.join(moduleRoot, "index.mjs")));
const routeUrl = new URL("/story", baseUrl).href;
const viewports = [
  { name: "pc-1440", width: 1440, height: 900, hasTouch: false },
  { name: "mobile-390", width: 390, height: 844, hasTouch: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
fs.mkdirSync(outputDir, { recursive: true });

const baseState = () => ({
  storyVersion: story.storyVersion,
  stepId: currentStepId,
  reachedSceneIds: ["festival_concept"],
  viewed: {},
  metCharacters: { mizuha: false, amane: false, sakuya: false },
  evesRoute: [],
  observationOrder: null,
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  audio: { muted: true, volume: 0 },
  readStepIds,
  clear: false,
  archivesUnlocked: false,
  sessionId: "log-debug-comments-browser",
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
  await page.evaluate(({ storedProgress, storageKey, manualKey, configKey }) => {
    localStorage.setItem(storageKey, JSON.stringify(storedProgress));
    localStorage.setItem(manualKey, JSON.stringify([{
      progress: storedProgress,
      savedAt: Date.now(),
      meta: { title: "LOG QA", excerpt: storedProgress.stepId },
    }]));
    localStorage.setItem(configKey, JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
  }, { storedProgress: baseState(), storageKey: progressKey, manualKey: manualSaveKey, configKey: settingsKey });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureNovelOpen(page);
  if (await page.locator("#novel-title-screen").isVisible()) {
    await page.locator("#novel-resume-button").click();
    await page.locator("#novel-save-panel").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
  }
  await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, currentStepId, { timeout: 15_000 });
  await page.locator("#novel-log-button").click();
  await page.locator("#novel-log-panel").waitFor({ state: "visible" });
};

const geometry = (page) => page.evaluate(() => {
  const panel = document.querySelector("#novel-log-panel").getBoundingClientRect();
  const content = document.querySelector("#novel-log-content");
  const exportButton = document.querySelector("#novel-log-export").getBoundingClientRect();
  const deleteAllButton = document.querySelector("#novel-log-delete-all");
  const deleteAllRect = deleteAllButton.getBoundingClientRect();
  const heading = document.querySelector("#novel-log-title")?.getBoundingClientRect();
  const audioDock = document.querySelector("#gaia-audio-dock");
  const audioRect = audioDock?.getBoundingClientRect();
  const audioStyle = audioDock ? getComputedStyle(audioDock) : null;
  const entries = [...content.querySelectorAll("article")];
  const intersects = (first, second) => first.left < second.right && first.right > second.left
    && first.top < second.bottom && first.bottom > second.top;
  return {
    panel: { left: panel.left, top: panel.top, right: panel.right, bottom: panel.bottom, width: panel.width, height: panel.height },
    exportButton: { width: exportButton.width, height: exportButton.height },
    deleteAllButton: {
      visible: Boolean(!deleteAllButton.hidden && deleteAllButton.offsetParent),
      width: deleteAllRect.width,
      height: deleteAllRect.height,
      overlapsExport: intersects(deleteAllRect, exportButton),
    },
    entryCount: entries.length,
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    contentOverflowX: Math.max(0, content.scrollWidth - content.clientWidth),
    headingAudioCollision: Boolean(heading && audioRect
      && heading.left < audioRect.right && heading.right > audioRect.left
      && heading.top < audioRect.bottom && heading.bottom > audioRect.top),
    audioVisible: Boolean(audioStyle && audioStyle.visibility !== "hidden" && audioStyle.display !== "none"),
    visibleIds: entries.map((entry) => entry.querySelector(".novel-log-entry-id")?.textContent),
    textareas: entries.map((entry) => ({
      id: entry.dataset.stepId,
      width: entry.querySelector("textarea")?.getBoundingClientRect().width || 0,
      visible: Boolean(entry.querySelector("textarea")?.offsetParent),
    })),
    deleteButtons: entries.map((entry) => {
      const button = entry.querySelector(".novel-log-delete");
      const rect = button?.getBoundingClientRect();
      const visible = Boolean(button && !button.hidden && button.offsetParent);
      const copyRects = [...entry.querySelectorAll(".novel-log-copy")].map((copy) => copy.getBoundingClientRect());
      return {
        id: entry.dataset.stepId,
        visible,
        width: rect?.width || 0,
        height: rect?.height || 0,
        overlapsCopy: Boolean(visible && copyRects.some((copyRect) => intersects(rect, copyRect))),
      };
    }),
  };
});

const readStoredComments = async (page) => JSON.parse(await page.evaluate(
  (key) => sessionStorage.getItem(key) || "{}",
  commentStorageKey,
));

const downloadMarkdown = async (page) => {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#novel-log-export").click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const buffer = fs.readFileSync(downloadPath);
  return { download, buffer, markdown: buffer.toString("utf8") };
};

const activateDelete = async (page, viewport, id, decision, method) => {
  const button = page.getByRole("button", { name: `${id}のコメントを削除` });
  const dialogPromise = page.waitForEvent("dialog");
  const actionPromise = method === "keyboard"
    ? button.focus().then(() => button.press("Enter"))
    : method === "tap"
      ? button.tap()
      : button.click();
  const dialog = await dialogPromise;
  assert.match(dialog.message(), new RegExp(id, "u"), `${viewport.name}: confirmation does not identify the step`);
  assert.match(dialog.message(), /本文・step ID・ほかのコメントは変更されません/u,
    `${viewport.name}: confirmation does not explain deletion scope`);
  if (decision === "accept") await dialog.accept();
  else await dialog.dismiss();
  await actionPromise;
};

const activateDeleteAll = async (page, viewport, ids, decision, method) => {
  const button = page.getByRole("button", { name: `コメント済み${ids.length}件をすべて削除` });
  const dialogPromise = page.waitForEvent("dialog");
  const actionPromise = method === "keyboard"
    ? button.focus().then(() => button.press("Enter"))
    : method === "tap"
      ? button.tap()
      : button.click();
  const dialog = await dialogPromise;
  assert.match(dialog.message(), new RegExp(`${ids.length}件のコメントをすべて削除`, "u"),
    `${viewport.name}: delete-all confirmation does not identify the count`);
  for (const id of ids) assert.match(dialog.message(), new RegExp(id, "u"),
    `${viewport.name}: delete-all confirmation does not identify ${id}`);
  assert.match(dialog.message(), /本文・step IDは変更されません/u,
    `${viewport.name}: delete-all confirmation does not explain preserved data`);
  if (decision === "accept") await dialog.accept();
  else await dialog.dismiss();
  await actionPromise;
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.hasTouch, reducedMotion: "reduce", acceptDownloads: true });
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (value) => { globalThis.__logClipboard = String(value); } },
      });
      globalThis.__logClipboard = "";
    });
    await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    await bootAtLogState(page);

    const initial = await geometry(page);
    assert.equal(initial.entryCount, expectedLogIds.length, `${viewport.name}: unexpected LOG entry count`);
    assert.deepEqual(initial.visibleIds, expectedLogIds, `${viewport.name}: visible LOG IDs are wrong`);
    assert.equal(initial.overflowX, 0, `${viewport.name}: document overflows horizontally`);
    assert.equal(initial.contentOverflowX, 0, `${viewport.name}: LOG content overflows horizontally`);
    assert.equal(initial.headingAudioCollision, false, `${viewport.name}: audio control overlaps the LOG heading`);
    assert.equal(initial.audioVisible, false, `${viewport.name}: persistent audio control remains visible over LOG`);
    assert(initial.textareas.every((item) => item.visible && item.width > 0), `${viewport.name}: a comment field is unavailable`);
    assert.equal(initial.deleteButtons.filter((item) => item.visible).length, 0,
      `${viewport.name}: delete buttons are visible without comments`);
    assert.equal(initial.deleteAllButton.visible, false,
      `${viewport.name}: delete-all button is visible without comments`);
    assert.equal(await page.locator("#novel-log-export").isEnabled(), true,
      `${viewport.name}: zero-comment export is unavailable`);

    const firstEntry = page.locator(`article[data-step-id="${readStepIds[0]}"]`);
    await firstEntry.getByRole("button", { name: `${readStepIds[0]}のLOG IDをコピー` }).click();
    assert.equal(await page.evaluate(() => globalThis.__logClipboard), readStepIds[0], `${viewport.name}: ID copy failed`);
    await firstEntry.getByRole("button", { name: `${readStepIds[0]}のLOG IDと本文をコピー` }).click();
    assert.equal(await page.evaluate(() => globalThis.__logClipboard), `${readStepIds[0]}\n${stepMap.get(readStepIds[0]).text}`, `${viewport.name}: ID + text copy failed`);

    const comments = {
      [readStepIds[0]]: "冒頭の風の音を、もう少し短くしてください。",
      [readStepIds[1]]: "匂いの描写と背景の整合を確認してください。",
    };
    for (const [id, value] of Object.entries(comments)) {
      await page.getByRole("textbox", { name: `${id}への修正コメント` }).fill(value);
    }
    assert.equal(await page.locator("#novel-log-comment-count").textContent(), "コメント 2件", `${viewport.name}: comment count failed`);
    const stored = await readStoredComments(page);
    assert.deepEqual(stored, comments, `${viewport.name}: sessionStorage comments differ`);
    const afterAdd = await geometry(page);
    const visibleDeleteButtons = afterAdd.deleteButtons.filter((item) => item.visible);
    assert.deepEqual(visibleDeleteButtons.map((item) => item.id), Object.keys(comments),
      `${viewport.name}: delete button visibility does not match commented entries`);
    assert(visibleDeleteButtons.every((item) => item.width >= 44 && item.height >= 44),
      `${viewport.name}: a delete button has less than a 44px hit area`);
    assert(visibleDeleteButtons.every((item) => !item.overlapsCopy),
      `${viewport.name}: a delete button overlaps another LOG action`);
    assert.equal(afterAdd.deleteAllButton.visible, true, `${viewport.name}: delete-all button is not visible with comments`);
    assert(afterAdd.deleteAllButton.width >= 44 && afterAdd.deleteAllButton.height >= 44,
      `${viewport.name}: delete-all button has less than a 44px hit area`);
    assert.equal(afterAdd.deleteAllButton.overlapsExport, false,
      `${viewport.name}: delete-all button overlaps export`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-log-comments-added.png`), animations: "disabled" });

    const deletedId = readStepIds[0];
    const retainedId = readStepIds[1];
    const deletedEntry = page.locator(`article[data-step-id="${deletedId}"]`);
    const deletedEntrySnapshot = await deletedEntry.evaluate((entry) => ({
      id: entry.querySelector(".novel-log-entry-id")?.textContent,
      text: entry.querySelector(".novel-log-entry-text")?.textContent,
    }));
    await activateDeleteAll(page, viewport, Object.keys(comments), "dismiss", viewport.hasTouch ? "tap" : "keyboard");
    assert.deepEqual(await readStoredComments(page), comments, `${viewport.name}: delete-all cancellation changed sessionStorage`);
    assert.equal(await page.locator("#novel-log-status").textContent(), "2件のコメント全削除をキャンセルしました");
    await activateDelete(page, viewport, deletedId, "dismiss", viewport.hasTouch ? "tap" : "keyboard");
    assert.deepEqual(await readStoredComments(page), comments, `${viewport.name}: cancellation changed sessionStorage`);
    assert.equal(await page.getByRole("textbox", { name: `${deletedId}への修正コメント` }).inputValue(), comments[deletedId],
      `${viewport.name}: cancellation cleared the comment`);
    assert.equal(await page.locator("#novel-log-status").textContent(), `${deletedId} のコメント削除をキャンセルしました`);

    await page.locator("#novel-log-close").click();
    assert.equal(await page.evaluate(() => document.body.classList.contains("gaia-log-open")), false,
      `${viewport.name}: LOG open state remained after close`);
    await page.locator("#novel-log-button").click();
    await page.locator("#novel-log-panel").waitFor({ state: "visible" });
    for (const [id, value] of Object.entries(comments)) {
      assert.equal(await page.getByRole("textbox", { name: `${id}への修正コメント` }).inputValue(), value, `${viewport.name}: comment did not survive reopen`);
    }

    await activateDelete(page, viewport, deletedId, "accept", viewport.hasTouch ? "tap" : "click");
    const remainingComments = { [retainedId]: comments[retainedId] };
    assert.deepEqual(await readStoredComments(page), remainingComments,
      `${viewport.name}: confirmed deletion changed the wrong sessionStorage comments`);
    assert.equal(await page.getByRole("textbox", { name: `${deletedId}への修正コメント` }).inputValue(), "",
      `${viewport.name}: confirmed deletion left the target comment`);
    assert.equal(await page.getByRole("textbox", { name: `${retainedId}への修正コメント` }).inputValue(), comments[retainedId],
      `${viewport.name}: confirmed deletion changed another comment`);
    assert.deepEqual(await deletedEntry.evaluate((entry) => ({
      id: entry.querySelector(".novel-log-entry-id")?.textContent,
      text: entry.querySelector(".novel-log-entry-text")?.textContent,
    })), deletedEntrySnapshot, `${viewport.name}: deletion changed the LOG ID or body text`);
    assert.equal(await deletedEntry.locator(".novel-log-delete").isHidden(), true,
      `${viewport.name}: target delete button remained visible after deletion`);
    assert.equal(await page.locator(`article[data-step-id="${retainedId}"] .novel-log-delete`).isVisible(), true,
      `${viewport.name}: another entry lost its delete button`);
    assert.equal(await page.locator("#novel-log-comment-count").textContent(), "コメント 1件");

    const oneCommentExport = await downloadMarkdown(page);
    assert(oneCommentExport.buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${viewport.name}: Markdown has no UTF-8 BOM`);
    assert.match(oneCommentExport.download.suggestedFilename(), /^gaia-codex-log-comments-\d{8}T\d{6}Z\.md$/u);
    assert(oneCommentExport.markdown.includes(`\`${retainedId}\``)
      && oneCommentExport.markdown.includes(stepMap.get(retainedId).text)
      && oneCommentExport.markdown.includes(comments[retainedId]), `${viewport.name}: retained comment is missing from export`);
    assert.equal(oneCommentExport.markdown.includes(`\`${deletedId}\``), false,
      `${viewport.name}: deleted comment remained in export`);
    assert.match(oneCommentExport.markdown, /- 対象件数: 1/u);
    assert.equal(await page.locator("#novel-log-status").textContent(), "1件を書き出しました");

    await page.reload({ waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    await bootAtLogState(page);
    assert.equal(await page.getByRole("textbox", { name: `${deletedId}への修正コメント` }).inputValue(), "",
      `${viewport.name}: deleted comment returned after reload`);
    assert.equal(await page.getByRole("textbox", { name: `${retainedId}への修正コメント` }).inputValue(), comments[retainedId],
      `${viewport.name}: retained comment did not survive reload`);
    assert.deepEqual(await readStoredComments(page), remainingComments, `${viewport.name}: reload changed remaining comments`);

    await page.getByRole("textbox", { name: `${deletedId}への修正コメント` }).fill(comments[deletedId]);
    assert.deepEqual(await readStoredComments(page), comments, `${viewport.name}: comments were not restored for delete-all QA`);
    assert.equal(await page.locator("#novel-log-comment-count").textContent(), "コメント 2件");
    const beforeDeleteAllEntries = await page.locator("#novel-log-content article").evaluateAll((entries) => entries.map((entry) => ({
      id: entry.querySelector(".novel-log-entry-id")?.textContent,
      text: entry.querySelector(".novel-log-entry-text")?.textContent,
    })));
    await activateDeleteAll(page, viewport, Object.keys(comments), "accept", viewport.hasTouch ? "tap" : "click");
    assert.deepEqual(await readStoredComments(page), {}, `${viewport.name}: all-delete did not leave an empty comment object`);
    assert.equal(await page.locator("#novel-log-comment-count").textContent(), "コメント 0件");
    for (const id of Object.keys(comments)) {
      assert.equal(await page.getByRole("textbox", { name: `${id}への修正コメント` }).inputValue(), "",
        `${viewport.name}: delete-all left ${id}'s comment`);
    }
    assert.deepEqual(await page.locator("#novel-log-content article").evaluateAll((entries) => entries.map((entry) => ({
      id: entry.querySelector(".novel-log-entry-id")?.textContent,
      text: entry.querySelector(".novel-log-entry-text")?.textContent,
    }))), beforeDeleteAllEntries, `${viewport.name}: delete-all changed LOG IDs or body text`);
    assert.equal(await page.locator("#novel-log-status").textContent(), "2件のコメントをすべて削除しました");
    assert.equal(await page.locator("#novel-log-delete-all").isHidden(), true,
      `${viewport.name}: delete-all button remained visible after deletion`);
    assert.equal(await page.locator("#novel-log-export").isEnabled(), true,
      `${viewport.name}: all-delete disabled the zero-count export`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await ensureNovelOpen(page);
    await bootAtLogState(page);
    assert.deepEqual(await readStoredComments(page), {}, `${viewport.name}: all-delete did not survive reload`);
    assert.equal(await page.locator("#novel-log-comment-count").textContent(), "コメント 0件");
    const zeroCommentExport = await downloadMarkdown(page);
    assert(zeroCommentExport.buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${viewport.name}: zero-count Markdown has no UTF-8 BOM`);
    assert.match(zeroCommentExport.markdown, /- 対象件数: 0/u, `${viewport.name}: zero-count export does not state 0 entries`);
    for (const [id, value] of Object.entries(comments)) {
      assert.equal(zeroCommentExport.markdown.includes(`\`${id}\``), false, `${viewport.name}: zero-count export includes ${id}`);
      assert.equal(zeroCommentExport.markdown.includes(value), false, `${viewport.name}: zero-count export includes a deleted comment`);
    }
    assert.equal(await page.locator("#novel-log-status").textContent(), "0件を書き出しました");
    const finalGeometry = await geometry(page);
    assert.equal(finalGeometry.overflowX, 0);
    assert.equal(finalGeometry.contentOverflowX, 0);
    assert.equal(finalGeometry.deleteButtons.filter((item) => item.visible).length, 0,
      `${viewport.name}: delete buttons remain visible after all comments are deleted`);
    assert.equal(finalGeometry.deleteAllButton.visible, false,
      `${viewport.name}: delete-all button remains visible after reload`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-log-comments-deleted.png`), animations: "disabled" });

    report.scans.push({
      viewport,
      initial,
      afterAdd,
      finalGeometry,
      stored,
      remainingComments,
      oneCommentDownload: oneCommentExport.download.suggestedFilename(),
      zeroCommentDownload: zeroCommentExport.download.suggestedFilename(),
      passed: true,
    });
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

console.log(`LOG debug comments browser check passed: ${report.scans.length} viewports`);
