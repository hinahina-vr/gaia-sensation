import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { historicalApproved, historicalMainScenes, historicalBeyondScenes } from "./check-story-log-followup.mjs";
import { parseLogComments, planLogComment } from "./story-log-comments.mjs";
import "./check-beyond-log-comments.mjs";
await import("../novel-story-data.js");
await import("../true-end-data.js");
await import("../novel-background-cues.js");
await import("../novel-back-half-cues.js");
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n?/gu, "\n");
const manifest = JSON.parse(read("story/LOG_REVISION_2026-09-06.json"));
const latest = JSON.parse(read("story/LOG_REVISION_2026-09-06_BEYOND.json"));
const latestComments = parseLogComments(read("story/LOG_COMMENTS_2026-09-06_BEYOND.md"), 59);
const superseded = new Map(latest.comments.filter(row => row.action !== "append").map(row => [row.sourceId, latestComments.find(comment => comment.id === row.logId).original]));
const attachment = read("story/LOG_COMMENTS_2026-09-06.md");
assert.equal(crypto.createHash("sha256").update(attachment).digest("hex"), manifest.sourceSha256);
const comments = parseLogComments(attachment);
const approved = historicalApproved;
const sourceSteps = new Map([...approved.mainScenes, ...approved.trueEndScenes].flatMap(scene => scene.entries.map(entry => [entry.id, entry])));
const main = historicalMainScenes.flatMap(scene => scene.steps);
const beyond = historicalBeyondScenes.flatMap(scene => scene.steps);
const runtime = new Map([...main, ...beyond].map(step => [step.id, step]));
assert.equal(runtime.size, main.length + beyond.length, "Runtime LOG IDs collide");
assert.deepEqual(globalThis.GAIA_NOVEL_STORY.scenes.map(scene => scene.steps.length), latest.counts.main);
assert.deepEqual(globalThis.GAIA_TRUE_END_STORY.scenes.map(scene => scene.steps.length), latest.counts.beyond);
assert.equal(manifest.comments.length, comments.length);
for (const comment of comments) {
  const mapping = manifest.comments.find(row => row.logId === comment.id);
  assert(mapping, `${comment.id}: no mapping`);
  const plan = planLogComment(comment);
  const actual = mapping.outputIds.map(id => {
    const entry = sourceSteps.get(id);
    const step = runtime.get(manifest.runtimeIds[id]);
    assert(entry && step, `${id}: missing source or runtime`);
    assert.equal(step.text, entry.text);
    return entry;
  });
  if (plan.action === "delete") {
    assert(!sourceSteps.has(mapping.sourceId));
    assert(!runtime.has(comment.id));
    assert(![...runtime.values()].some(step => step.text === comment.original));
    continue;
  }
  let expected = plan.parts;
  if (comment.id === "welcome_chat_094") expected = expected.filter((part,index) => expected.findIndex(other => other.text === part.text) === index);
  if (comment.id === "welcome_chat_095") expected = expected.slice(-1);
  // Explicit later revisions validate against their archived input; other edits stay exact.
  assert.deepEqual(actual.map(entry => superseded.get(entry.id) ?? entry.text), expected.map(part => part.text), `${comment.id}: incomplete revision`);
  expected.forEach((part,index) => {
    if (part.speaker) assert.equal(actual[index].speakerLabel, part.speaker === "地の文" && actual[index].kind === "APEIRONCENE" ? "—" : part.speaker, `${comment.id}: speaker mismatch`);
  });
  if (plan.action === "append") assert.equal(runtime.get(comment.id)?.text, comment.original, `${comment.id}: append replaced its anchor`);
}
for (const adjustment of manifest.adjustments) {
  if (adjustment.deleted) assert(!sourceSteps.has(adjustment.sourceId));
  else assert.equal(sourceSteps.get(adjustment.sourceId)?.text, adjustment.text);
}
const ending = main.slice(-7);
assert.deepEqual(ending.map(step=>step.id), ["welcome_chat_new_022", "welcome_chat_new_024", "welcome_chat_094", "welcome_chat_new_025", "welcome_chat_new_026", "welcome_chat_new_027", "welcome_chat_095"]);
assert.equal(ending[1].type, "chat");
assert.equal(ending[1].speakerLabel, "青猫");
assert.equal(ending[1].text, "まず一台つなぎます。");
assert.equal(ending.at(-2).text, "波の音を聞きながら、その続きを話した。");
assert.equal(ending.at(-1).type, "transition");
assert.equal(ending.at(-1).text, "STAFF & CREDITS");
assert.equal(new Set(ending.map(step=>step.text)).size, ending.length, "Duplicate ending paragraph");
assert.equal(runtime.get("festival_concept_019").speaker, "amane");
assert.equal(runtime.get("esp32_pitch_016i").speaker, "narrator");
assert.equal(runtime.get("esp32_pitch_016i").type, "narration");
assert.equal(runtime.get("circle_invitation_new_030").speaker, "visitor");
for (const [id, entry] of sourceSteps) {
  const step = runtime.get(latest.runtimeIds[id]);
  assert(step, `${id}: stable runtime ID missing`);
  assert.equal(step.text, entry.kind === "操作" ? "" : entry.text);
  if (step.pages) assert.equal(step.pages.join(""), step.text, `${id}: pagination dropped text`);
}
for (const step of main) {
  assert(globalThis.GAIA_NOVEL_BACKGROUND_CUES.forStep(step)?.assetPath, `${step.id}: lost background`);
  assert(globalThis.GAIA_NOVEL_BACK_HALF_CUES.forStep(step)?.temporal, `${step.id}: lost timeline`);
}
assert.deepEqual(main.filter(step=>step.type === "interaction").map(step=>step.id), ["map_mode01_004", "map_mode01_023", "gx_experience_017"]);
const novel = read("novel-mode.js");
assert(novel.includes('if (migratedStepId === "welcome_chat_092") return "welcome_chat_094";'));
assert(novel.includes("message.cueFromStepId || message.id"), "Inserted chat must use its anchor's channel");
console.log(`LOG revisions passed: ${comments.length} comments, ${main.length} main + ${beyond.length} beyond steps, stable IDs and all cues.`);
