import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(new URL("../novel-story-data.js", import.meta.url));
await import(new URL("../novel-background-cues.js", import.meta.url));

const story = globalThis.GAIA_NOVEL_STORY;
const cues = globalThis.GAIA_NOVEL_BACKGROUND_CUES;
const expectedSceneIds = ["festival_concept", "map_mode01", "gx_experience", "esp32_pitch", "circle_invitation", "welcome_chat"];
const expectedCounts = [72, 43, 47, 52, 80, 86];
assert.equal(story.storyVersion, 13);
assert.deepEqual(story.scenes.map((scene) => scene.id), expectedSceneIds);
assert.deepEqual(story.scenes.map((scene) => scene.steps.length), expectedCounts);
assert.deepEqual(cues.sceneIds, expectedSceneIds);
assert.deepEqual(cues.expectedSceneCounts, Object.fromEntries(expectedSceneIds.map((id, index) => [id, expectedCounts[index]])));

const allSteps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(allSteps.map((step) => [step.id, step]));
const resolved = allSteps.map((step) => ({ step, cue: cues.forStep(step) }));
assert.equal(resolved.length, 380);
assert(resolved.every(({ cue }) => cue?.assetPath && cue?.motion), "全runtime stepに背景とmotionが必要です");
assert(resolved.every(({ cue }) => cue.assetPath.startsWith("assets/")), "背景がassets配下から外れています");
assert(
  cues.limitedStory.filter((cue) => /(?:^|\/)event-cg-/u.test(cue.assetPath)).every((cue) => cue.presentation === "event-cg"),
  "event CGは単体キャストを抑制するpresentationが必要です",
);

for (const assetPath of new Set(resolved.map(({ cue }) => cue.assetPath))) {
  await access(path.join(projectRoot, assetPath));
}
for (const mobileAssetPath of new Set(resolved.map(({ cue }) => cue.mobileAssetPath).filter(Boolean))) {
  await access(path.join(projectRoot, mobileAssetPath));
}
for (const entry of cues.gallery) {
  const step = stepMap.get(entry.unlockStepId);
  assert(step, `${entry.id}: unlock stepがありません`);
  assert.equal(cues.forStep(step).galleryId, entry.id, `${entry.id}: gallery cueが一致しません`);
  await access(path.join(projectRoot, entry.assetPath));
}

const cue = (stepId) => {
  const step = stepMap.get(stepId);
  assert(step, `${stepId}: approved stepがありません`);
  return cues.forStep(step);
};
assert.equal(cue("festival_concept_001").id, "festival-convention-hall-entrance");
assert.equal(cue("festival_concept_008").id, "festival-b-hall-overview");
assert.equal(cue("festival_concept_015").presentation, "event-cg");
assert.equal(cue("festival_concept_021").galleryId, "amane-closeup");
assert.equal(cue("festival_concept_023").galleryId, "mizuha-closeup");
assert.equal(cue("festival_concept_076").presentation, "event-cg");
assert.equal(cue("map_mode01_001").id, "map01-co2-observation");
assert.equal(cue("map_mode01_015").id, "map01-temperature-observation");
assert.equal(cue("map_mode01_030").id, "map01-data-provenance");
assert.equal(cue("map_mode01_043").id, "map01-exhibition-return");
assert.equal(cue("gx_experience_001").transition, "crossfade");
assert.equal(cue("gx_experience_017").id, "gx-native-deep-time");
assert.equal(cue("gx_experience_030").id, "gx-coevolution");
assert.equal(cue("gx_experience_055").id, "gx-ten-mode-gateway");
assert.equal(cue("esp32_pitch_008").galleryId, "esp32-collaboration");
assert.equal(cue("esp32_pitch_016a").id, cue("esp32_pitch_016").id, "挿入した反論シーケンスの背景が途切れています");
assert.equal(cue("esp32_pitch_019").id, "esp32-system-design");
assert.equal(cue("circle_invitation_029").id, "circle-invitation-card-cg");
assert.equal(cue("circle_invitation_048").galleryId, "circle-welcome");
assert.equal(cue("welcome_chat_001").id, "welcome-online-arrival");
assert.equal(cue("welcome_chat_021").id, "welcome-online-esp32-thread");
assert.equal(cue("welcome_chat_055").id, "welcome-physical-booth");
assert.equal(cue("welcome_chat_078").id, "welcome-night-exit-mobile");
assert.equal(cue("welcome_chat_094").galleryId, "exhibition-finale");
assert.equal(cue("welcome_chat_095").id, "welcome-exhibition-finale-cg");

assert.throws(() => cues.forStep({ sceneId: "welcome_chat", id: "welcome_chat_999" }), /Missing contest-v10 background cue/);
assert.throws(() => cues.forStep({ sceneId: "unknown", id: "unknown_001" }), /Unknown contest-v10 background scene/);

console.log(JSON.stringify({
  status: "passed",
  storyVersion: story.storyVersion,
  scenes: story.scenes.length,
  steps: resolved.length,
  cueDefinitions: cues.limitedStory.length,
  resolvedAssets: [...new Set(resolved.map(({ cue: item }) => item.assetPath))].length,
  eventCgSteps: resolved.filter(({ cue: item }) => item.presentation === "event-cg").length,
}, null, 2));
