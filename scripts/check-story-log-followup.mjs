import { applyChapterNames } from "../story/chapter-names-20260912.js";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { readApprovedStoryScript } from "./approved-story-script.mjs";
import { applyAfternoonClock } from "../story/afternoon-clock-20260911.js";
import { applyReadingBreaks } from "../story/reading-breaks-20260911.js";
import { applyLogWording } from "../story/log-wording-20260912.js";
import { parseLogComments } from "./story-log-comments.mjs";
import "../novel-story-data.js";
import "../true-end-data.js";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n?/gu, "\n");
const hash = value => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
export const revision = JSON.parse(read("story/LOG_REVISION_2026-09-09.json"));
const attachment = read("story/LOG_COMMENTS_2026-09-09.md");
assert.equal(hash(attachment), revision.sourceSha256);
const comments = parseLogComments(attachment, 11);
const approved = readApprovedStoryScript();
assert.equal(approved.sha256, revision.approvedSha256);
const sourceScenes = [...approved.mainScenes, ...approved.trueEndScenes];
// Validate the earlier LOG revision against its original clock, without editing
// archived comments or ignoring any non-clock field in the exact hash contracts.
const priorClockMainScenes = applyChapterNames(applyLogWording(applyAfternoonClock(globalThis.GAIA_NOVEL_STORY.scenes, {reverse:true}), {reverse:true}), {reverse:true});
const priorReadingBeyondScenes = applyReadingBreaks(globalThis.GAIA_TRUE_END_STORY.scenes, {reverse:true});
const runtimeScenes = [...priorClockMainScenes, ...priorReadingBeyondScenes];
const source = new Map(sourceScenes.flatMap(scene => scene.entries.map(entry => [entry.id, entry])));
const runtime = new Map(runtimeScenes.flatMap(scene => scene.steps.map(step => [step.id, step])));
assert.equal(revision.edits.length, 12);
assert.equal(new Set(revision.edits.map(edit => edit.runtimeId)).size, 12);
for (const [file, sha256] of Object.entries(revision.historySha256)) {
  assert.equal(hash(read(file)), sha256, `${file}: archived input/history changed`);
}
for (const edit of revision.edits) {
  const comment = comments.find(comment => comment.id === edit.runtimeId);
  const expectedText = comment
    ? comment.instruction === "逗子の→海辺の" ? comment.original.replaceAll("逗子の", "海辺の") : comment.instruction
    : edit.beforeSource.text.replaceAll("逗子", "海辺");
  if (comment) assert.equal(edit.beforeRuntime.text, comment.original);
  else assert.equal(edit.runtimeId, "beyond_03_047", "Unexpected additional correction");
  assert.equal(edit.sourcePatch.text, expectedText);
  assert.equal(edit.runtimePatch.text, expectedText);
  const entry = source.get(edit.sourceId), step = runtime.get(edit.runtimeId);
  assert.deepEqual(entry, { ...edit.beforeSource, ...edit.sourcePatch }, `${edit.runtimeId}: source mismatch`);
  assert.deepEqual(step, { ...edit.beforeRuntime, ...edit.runtimePatch }, `${edit.runtimeId}: runtime mismatch`);
  assert.equal(entry.text, step.text);
  assert.equal(entry.metadata?.runtimeStepId || entry.id, step.id);
  assert.equal(entry.speakerLabel, edit.beforeSource.speakerLabel);
  assert.equal(step.speaker, edit.beforeRuntime.speaker);
  if (step.pages) {
    assert.deepEqual(entry.metadata.pages, step.pages);
    assert.equal(step.pages.join(""), step.text, `${step.id}: pagination dropped text`);
  }
}
assert.equal(source.size, 544);
assert.equal(runtime.size, 544);
assert(!JSON.stringify(sourceScenes).includes("逗子"), "Place name remains in active source");
assert(!JSON.stringify(runtimeScenes).includes("逗子"), "Place name remains in runtime");

// Historical contracts inspect their own baseline without rewriting archived comments.
const priorSource = new Map(revision.edits.map(edit => [edit.sourceId, edit.beforeSource]));
const priorRuntime = new Map(revision.edits.map(edit => [edit.runtimeId, edit.beforeRuntime]));
const restoreSource = scenes => scenes.map(scene => ({ ...scene, entries: scene.entries.map(entry => priorSource.get(entry.id) ?? entry) }));
const restoreRuntime = scenes => scenes.map(scene => ({ ...scene, steps: scene.steps.map(step => priorRuntime.get(step.id) ?? step) }));
export const historicalApproved = { ...approved, mainScenes: restoreSource(approved.mainScenes), trueEndScenes: restoreSource(approved.trueEndScenes) };
export const historicalMainScenes = restoreRuntime(priorClockMainScenes);
export const historicalBeyondScenes = restoreRuntime(priorReadingBeyondScenes);
assert.equal(hash([...historicalApproved.mainScenes, ...historicalApproved.trueEndScenes]), revision.sourceScenesSha256, "Unrequested source text, staging, IDs or scene order changed");
assert.equal(hash([...historicalMainScenes, ...historicalBeyondScenes]), revision.runtimeScenesSha256, "Unrequested runtime text, staging, IDs or scene order changed");
console.log("2026-09-09 LOG follow-up passed: 11 exact comments + 1 global place-name correction; other 532 entries and historical inputs preserved.");
