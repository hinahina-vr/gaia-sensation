import assert from "node:assert/strict";
import fs from "node:fs";
import "../dialogue-typography.js";
import "../true-end-data.js";
import {applyReadingBreaks, readingBreakRevisions, readingBreakRevisionId} from "../story/reading-breaks-20260911.js";
import {readApprovedStoryScript} from "./approved-story-script.mjs";

const story = GAIA_TRUE_END_STORY;
const typography = GaiaDialogueTypography;
assert.equal(story.readingBreakRevisionId, readingBreakRevisionId);
assert.equal(readingBreakRevisions.length, 9);
assert.equal(new Set(readingBreakRevisions.map(r => r.id)).size, 9);
const restored = applyReadingBreaks(story.scenes, {reverse:true});
assert.deepEqual(applyReadingBreaks(restored), story.scenes);
assert.throws(() => applyReadingBreaks(story.scenes), /differs from source/);
const approved = readApprovedStoryScript();
const source = new Map(approved.trueEndScenes.flatMap(s => s.entries.map(e => [e.metadata.runtimeStepId, e])));
const edited = new Set(readingBreakRevisions.map(r => r.id));
for (const step of story.scenes.flatMap(s => s.steps)) {
  const original = source.get(step.id);
  assert.equal(step.text, original.text);
  const priorPages = original.metadata.pages;
  if (step.pages) {
    assert.equal(step.pages.join(""), step.text);
    step.pages.slice(0, -1).forEach(page => assert(/[。！？!?…]\s*$|[、。！？!?…][」』）]*\s*$/u.test(page), step.id + ": fixed boundary must be punctuation-safe"));
  }
  if (!edited.has(step.id)) assert.deepEqual(step.pages, priorPages);
  const tokens = typography.segment(step.text);
  assert.equal(tokens.join(""), step.text);
  assert.equal(typography.segment(step.text, {forceFallback:true}).join(""), step.text);
}
for (const phrase of ["氷殻", "千年単位", "営み", "知覚し", "流れていく", "単位", "GAIA SENSEWARE"]) {
  assert(typography.segment("その" + phrase + "を確かめる。").some(token => token.includes(phrase)), phrase + ": split compound");
}
assert.deepEqual(typography.chooseLineBreaks([{text:"前半",width:456.3},{text:"後半",width:456.1}], 912), [1], "Fractional overflow must not add an unplanned orphan line");
const loader = fs.readFileSync(new URL("../gaia-mode-loader.js", import.meta.url), "utf8");
const storyGroup = loader.slice(loader.indexOf("    story: {"), loader.indexOf("    gx: {"));
assert(storyGroup.indexOf("./dialogue-typography.js") >= 0);
assert(storyGroup.indexOf("./dialogue-typography.js") < storyGroup.indexOf("./true-end-mode.js"));
assert(storyGroup.indexOf("./dialogue-typography.js") < storyGroup.indexOf("./novel-mode.js"));
console.log("Reading breaks PASS: 9 exact reversible page edits; all 164 texts, other authored pauses, IDs and approved source preserved; shared typography loads before both readers.");
