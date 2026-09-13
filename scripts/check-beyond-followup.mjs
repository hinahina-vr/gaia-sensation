import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { historicalApproved, historicalMainScenes, historicalBeyondScenes } from "./check-story-log-followup.mjs";
import "../novel-story-data.js";
import "../true-end-data.js";

const read = file => fs.readFileSync(new URL(`../story/${file}`, import.meta.url), "utf8").replace(/\r\n?/gu, "\n");
const hash = value => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
export const followup = JSON.parse(read("LOG_REVISION_2026-09-06_BEYOND_FOLLOWUP.json"));
assert.deepEqual(followup.edits.map(edit => [edit.sourceId, edit.runtimeId]), [
  ["beyond_03_010", "beyond_03_043"],
  ["beyond_01_013", "beyond_01_028"],
]);
for (const [file, sha256] of Object.entries(followup.historySha256)) {
  assert.equal(hash(read(file)), sha256, `${file}: historical revision changed`);
}

const approved = historicalApproved;
const sourceScenes = [...approved.mainScenes, ...approved.trueEndScenes];
const runtimeScenes = [...historicalMainScenes, ...historicalBeyondScenes];
const source = new Map(sourceScenes.flatMap(scene => scene.entries.map(entry => [entry.id, entry])));
const runtime = new Map(runtimeScenes.flatMap(scene => scene.steps.map(step => [step.id, step])));
export const priorSource = new Map(followup.edits.map(edit => [edit.sourceId, edit.beforeSource]));
const priorRuntime = new Map(followup.edits.map(edit => [edit.runtimeId, edit.beforeRuntime]));

for (const edit of followup.edits) {
  const entry = source.get(edit.sourceId);
  const step = runtime.get(edit.runtimeId);
  assert.deepEqual(entry, { ...edit.beforeSource, ...edit.sourcePatch }, `${edit.runtimeId}: unexpected source change`);
  const expectedRuntime = { ...edit.beforeRuntime, ...edit.runtimePatch };
  for (const key of edit.runtimeOmit ?? []) delete expectedRuntime[key];
  assert.deepEqual(step, expectedRuntime, `${edit.runtimeId}: unexpected runtime change`);
  assert.equal(entry.metadata.runtimeStepId, step.id);
  assert.equal(entry.text, step.text);
  if (step.pages) {
    assert.deepEqual(entry.metadata.pages, step.pages);
    assert.equal(step.pages.join(""), step.text, `${step.id}: pagination dropped text`);
  }
}
assert.equal(source.get("beyond_03_010").speakerLabel, "ルウ");
assert.equal(runtime.get("beyond_03_043").speaker, "lou");
assert.equal(runtime.get("beyond_03_043").text, "うん。この頃のやり方で、一緒に作ってみたい。");
assert.equal(runtime.get("beyond_01_028").text, "ルウが応じると、鉱物化しかけた緑色のガラスエポキシ基板が、土壌のホログラムから静かに浮かび上がってきた。");
assert.equal(runtime.get("beyond_01_028").pages, undefined, "Use one page without splitting 基板");

// Restoring only the two allowed entries must reproduce the complete baseline:
// all other text, speakers, staging, scene order and stable IDs remain exact.
const restoredSource = sourceScenes.map(scene => ({
  ...scene, entries: scene.entries.map(entry => priorSource.get(entry.id) ?? entry),
}));
const restoredRuntime = runtimeScenes.map(scene => ({
  ...scene, steps: scene.steps.map(step => priorRuntime.get(step.id) ?? step),
}));
assert.equal(hash(restoredSource), followup.sourceScenesSha256, "Unrequested source text, speaker, staging, order or ID changed");
assert.equal(hash(restoredRuntime), followup.runtimeScenesSha256, "Unrequested runtime text, speaker, staging, order or ID changed");
console.log("BEYOND follow-up passed: 2 requested corrections; other 542 entries, scene order, stable IDs and historical logs preserved.");
