import assert from "node:assert/strict";

await import(`${new URL("../novel-story-data.js", import.meta.url).href}?story=${Date.now()}`);
await import(`${new URL("../novel-temporal.js", import.meta.url).href}?temporal=${Date.now()}`);

const story = globalThis.GAIA_NOVEL_STORY;
const runtime = globalThis.GaiaNovelTemporal.create(story);
for (const scene of story.scenes) {
  for (const step of [scene.steps[0], scene.steps.at(-1)]) {
    const presentation = runtime.presentationForStep(step);
    assert.equal(presentation.displayTitle, `${scene.date} ${scene.time}｜${scene.location}`, `${scene.id}: scene-meta display title changed`);
    assert.equal(presentation.temporalContext, "CURRENT", `${scene.id}: short contest route must stay CURRENT`);
    assert.equal(presentation.timePrecision, "MINUTE", `${scene.id}: authored festival clock lost minute precision`);
    assert.equal(presentation.source, "SCENE");
    assert.equal(runtime.contextTransitionForStep(step), null);
  }
}
assert.throws(() => runtime.presentationForStep({ id: "unknown", sceneId: "unknown" }), /has no scene temporal metadata/u);
console.log("temporal runtime check passed: 6 autumn Saturday afternoon scene-meta presentations");
