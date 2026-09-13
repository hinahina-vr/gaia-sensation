import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const constant = name => Number(source.match(new RegExp(`const ${name} = (\\d+);`))?.[1]);
const start = source.indexOf("  const getActiveTimelineDuration =");
const end = source.indexOf("  const getTimelineElapsedForPosition =", start);
assert(start >= 0 && end > start);
const duration = (id, storyModeDetour = null) => vm.runInNewContext(`${source.slice(start,end)}; getActiveTimelineDuration();`, {
  CO2_TIMELINE_DURATION_MS: constant("CO2_TIMELINE_DURATION_MS"),
  CO2_EXPLORATION_TIMELINE_SPEED: constant("CO2_EXPLORATION_TIMELINE_SPEED"),
  STORY_MAP_TIMELINE_SPEED: constant("STORY_MAP_TIMELINE_SPEED"),
  CIRCULATION_TIMELINE_DURATION_MS: constant("CIRCULATION_TIMELINE_DURATION_MS"),
  MODE_SEQUENCE_DURATION_MS: constant("MODE_SEQUENCE_DURATION_MS"),
  ECOLOGIES_SEQUENCE_DURATION_MS: constant("MODE_SEQUENCE_DURATION_MS") * 2,
  RENEWABLE_COUNTRY_DISPLAY_MS: constant("RENEWABLE_COUNTRY_DISPLAY_MS"),
  storyModeDetour,
  getActiveSignalMode: () => ({ id, signals: { current: Array(209) } }),
  getGlobalEarthquakePlaybackSchedule: () => ({ durationMs: 123456 }),
});
assert.equal(duration("breathing-earth"), 20000, "Exploration should run three times faster: 60s -> 20s");
assert.equal(duration("breathing-earth", {kind:"map01"}), 20000, "Do not stack the existing story speed multiplier");
assert.equal(duration("breathing-earth", {kind:"map01",phase:"temperature-anomaly"}), 60000);
for (const [id, expected] of [["blue-circulation",45000],["three-ecologies",96000],["earth-organ",501600],["rhythm-of-disaster",123456],["other",48000]]) {
  assert.equal(duration(id), expected, `${id}: unrelated timeline speed changed`);
}
assert.equal(constant("CO2_TIMELINE_MANUAL_PAUSE_MS"), 8000);
assert.equal(constant("CO2_TIMELINE_STEPS_PER_YEAR"), 4);
console.log("CO2 timeline passed: 3x exploration playback (20-second loop); story, other exhibits, manual pause and sampling preserved.");
