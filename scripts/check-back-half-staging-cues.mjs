import assert from "node:assert/strict";

await import(new URL("../novel-story-data.js", import.meta.url));
await import(new URL("../novel-background-cues.js", import.meta.url));
await import(new URL("../novel-back-half-cues.js", import.meta.url));

const story = globalThis.GAIA_NOVEL_STORY;
const backgrounds = globalThis.GAIA_NOVEL_BACKGROUND_CUES;
const staging = globalThis.GAIA_NOVEL_BACK_HALF_CUES;
const expectedSceneIds = ["festival_concept", "map_mode01", "gx_experience", "esp32_pitch", "circle_invitation", "welcome_chat"];
const expectedCounts = [72, 43, 47, 52, 80, 86];
const allSteps = story.scenes.flatMap((scene) => scene.steps);
const stepMap = new Map(allSteps.map((step) => [step.id, step]));

assert.equal(story.storyVersion, 13);
assert.deepEqual(story.scenes.map((scene) => scene.id), expectedSceneIds);
assert.deepEqual(story.scenes.map((scene) => scene.steps.length), expectedCounts);
assert.equal(allSteps.length, 380);
assert.deepEqual(staging.sceneIds, expectedSceneIds);
assert.deepEqual(staging.expectedSceneCounts, Object.fromEntries(expectedSceneIds.map((id, index) => [id, expectedCounts[index]])));

const resolved = allSteps.map((step) => ({ step, background: backgrounds.forStep(step), staging: staging.forStep(step) }));
assert(resolved.every(({ background }) => background?.assetPath), "全stepに背景が必要です");
assert(resolved.every(({ staging: cue }) => cue?.temporal?.context === "CURRENT"), "全stepはCURRENT時系列です");
assert(resolved.every(({ staging: cue }) => cue.temporal.precision === "MINUTE"), "時刻精度が変わりました");
assert(resolved.every(({ staging: cue }) => cue.temporal.date === "10月3日（土）"), "開催日が変わりました");
assert(resolved.every(({ staging: cue }) => cue.audio === "none"), "本編へ音声cueを追加してはいけません");

assert.deepEqual(staging.interactions.map((entry) => entry.stepId), ["map_mode01_004", "map_mode01_023", "gx_experience_017"]);
assert.deepEqual(allSteps.filter((step) => step.type === "interaction").map((step) => step.id), staging.interactions.map((entry) => entry.stepId));
for (const interaction of staging.interactions) {
  const step = stepMap.get(interaction.stepId);
  assert.equal(step?.interaction?.kind, interaction.kind, `${interaction.stepId}: interaction kindが不正です`);
  assert(stepMap.has(interaction.returnStepId), `${interaction.stepId}: return stepがありません`);
}
assert.equal(stepMap.get("map_mode01_023").interaction.phase, "temperature-anomaly");
assert.deepEqual(staging.choices, []);

const cue = (stepId) => {
  const step = stepMap.get(stepId);
  assert(step, `${stepId}: approved stepがありません`);
  return staging.forStep(step);
};
assert.equal(cue("map_mode01_004").device, "native-mode-overlay");
assert.equal(cue("map_mode01_004").castMode, "interaction-no-cast");
assert.equal(cue("map_mode01_023").devicePhase, "temperature-anomaly");
assert.equal(cue("gx_experience_017").device, "native-mode-overlay");
assert.equal(cue("gx_experience_017").castMode, "interaction-no-cast");
assert.equal(cue("esp32_pitch_016a").temporal.time, "15:00–15:30", "挿入シーケンスの時系列が途切れています");
assert.equal(cue("welcome_chat_001").device, "wide-campus-chat");
assert.equal(cue("welcome_chat_001").character.cast, "none");
assert.equal(cue("welcome_chat_055").devicePhase, "physical");
assert.equal(cue("welcome_chat_055").character.cast, "mizuha-amane");
assert.equal(cue("welcome_chat_078").device, "mobile-campus-chat");
assert.equal(cue("welcome_chat_078").character.avatar, "none");
assert.equal(cue("welcome_chat_095").castMode, "chat-text-only-no-cast");
assert.equal(cue("welcome_chat_073").temporal.time, "15:40–17:10");
assert.equal(cue("welcome_chat_075").temporal.time, "17:10–17:45");
assert.equal(cue("welcome_chat_094").temporal.location, "海沿いの帰り道／夕暮れの遊歩道");

const sakuyaSteps = allSteps.filter((step) => step.speaker === "sakuya");
assert(sakuyaSteps.length > 0, "sakuのchatがありません");
assert(sakuyaSteps.every((step) => step.sceneId === "welcome_chat" && step.type === "chat"), "sakuは文字chat以外へ登場できません");
assert.equal(staging.audio.length, 0);
assert(staging.characters.every((entry) => entry.voice === "none"));
assert.throws(() => staging.forStep({ sceneId: "welcome_chat", id: "welcome_chat_999" }), /Missing contest-v10 temporal cue/);
assert.throws(() => staging.forStep({ sceneId: "unknown", id: "unknown_001" }), /Unknown contest-v10 staging scene/);

console.log(JSON.stringify({
  status: "passed",
  storyVersion: story.storyVersion,
  scenes: story.scenes.length,
  steps: allSteps.length,
  interactions: staging.interactions.map((entry) => entry.stepId),
  deviceCues: staging.devices.length,
  characterCues: staging.characters.length,
}, null, 2));
