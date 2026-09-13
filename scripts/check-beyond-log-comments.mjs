import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { historicalApproved, historicalMainScenes, historicalBeyondScenes } from "./check-story-log-followup.mjs";
import { parseLogComments } from "./story-log-comments.mjs";
import { planBeyondLogComment } from "./beyond-log-comments.mjs";
import { followup, priorSource } from "./check-beyond-followup.mjs";
import "../novel-story-data.js";
import "../true-end-data.js";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n?/gu, "\n");
const hash = value => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const manifest = JSON.parse(read("story/LOG_REVISION_2026-09-06_BEYOND.json"));
const attachment = read("story/LOG_COMMENTS_2026-09-06_BEYOND.md");
assert.equal(hash(attachment), manifest.sourceSha256);
const comments = parseLogComments(attachment, 59);
const approved = historicalApproved;
const source = new Map(approved.trueEndScenes.flatMap(scene => scene.entries.map(entry => [entry.id, entry])));
const steps = historicalBeyondScenes.flatMap(scene => scene.steps);
const runtime = new Map(steps.map(step => [step.id, step]));
assert.equal(runtime.size, steps.length, "Duplicate LOG ID");
assert.equal(hash(historicalMainScenes), manifest.unchangedMainSha256, "Unrelated main story changed");
assert.deepEqual(globalThis.GAIA_TRUE_END_STORY.scenes.map(scene => scene.steps.length), [47, 56, 61]);
assert.deepEqual(manifest.counts.beyond, [47, 56, 61]);
const originalIds = new Set(manifest.previousBeyondIds);
assert.deepEqual(steps.filter(step => originalIds.has(step.id)).map(step => step.id), manifest.previousBeyondIds, "Existing IDs moved/disappeared");
const changedIds = new Set(comments.filter(c => planBeyondLogComment(c).action !== "append").map(c => c.id));
assert.equal(hash(steps.filter(step => originalIds.has(step.id) && !changedIds.has(step.id))), manifest.unchangedBeyondSha256, "An unrequested message changed");
assert.equal(manifest.comments.length, comments.length);
for (const comment of comments) {
  const mapping = manifest.comments.find(row => row.logId === comment.id);
  assert(mapping, `${comment.id}: missing mapping`);
  const plan = planBeyondLogComment(comment);
  assert.equal(mapping.action, plan.action);
  const entries = mapping.outputIds.map(id => source.get(id));
  assert(entries.every(Boolean));
  // Later corrections are checked separately; retain the original 59-comment contract.
  assert.deepEqual(entries.map(entry => (priorSource.get(entry.id) ?? entry).text), plan.parts.map(part => part.text), `${comment.id}: missing edit`);
  entries.forEach((entry, index) => {
    const step = runtime.get(manifest.runtimeIds[entry.id]);
    assert(step, `${entry.id}: missing runtime`);
    assert.equal(step.text, entry.text);
    if (step.pages) assert.equal(step.pages.join(""), step.text);
    const part = plan.parts[index];
    if (part.speaker) assert.equal((priorSource.get(entry.id) ?? entry).speakerLabel, part.speaker === "地の文" ? "—" : part.speaker);
  });
  const anchor = source.get(mapping.sourceId);
  assert.equal(anchor.metadata.runtimeStepId, comment.id);
  const metadata = { ...anchor.metadata };
  delete metadata.pages;
  assert.deepEqual(metadata, mapping.priorMetadata, `${comment.id}: lost staging metadata`);
  const at = steps.findIndex(step => step.id === comment.id);
  assert.deepEqual(steps.slice(at + (plan.action === "append" ? 1 : 0), at + (plan.action === "append" ? 1 : 0) + entries.length).map(step => step.id), mapping.outputIds.map(id => manifest.runtimeIds[id]), `${comment.id}: wrong insertion order`);
  if (plan.action === "append") assert.equal(runtime.get(comment.id).text, comment.original);
}
const deduplicatedNarration = manifest.comments.find(row => row.logId === "beyond_02_024").outputIds.at(-1);
for (const id of ["beyond_02_023", "beyond_02_024", manifest.runtimeIds[deduplicatedNarration]]) {
  const text = runtime.get(id)?.text;
  assert(text, `${id}: missing deduplicated line`);
  assert.equal(steps.filter(step => step.text === text).length, 1, `${id}: duplicated passage`);
}
assert.equal(runtime.get("beyond_02_042").speaker, undefined);
assert.equal(followup.edits.find(edit => edit.runtimeId === "beyond_03_043").beforeRuntime.speaker, "mizuha");
assert.equal(steps.at(-2).id, "beyond_03_053");
assert.equal(steps.at(-1).speaker, undefined);
assert(steps.at(-1).text.endsWith("放課後は、どこまでも終わらない。"));
assert.equal(steps.filter(step => step.text.includes("放課後は、どこまでも終わらない。")).length, 1);
console.log(`BEYOND LOG revisions passed: ${comments.length} comments, ${steps.length} messages, 18 additions, original IDs and unrequested text preserved.`);
