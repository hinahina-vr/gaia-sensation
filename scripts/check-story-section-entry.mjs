import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const main=read('novel-mode.js'),ending=read('true-end-mode.js'),surf=read('story-prologue.js');
assert.match(main,/const SECTION_ENTRY_FADE_MS = 1100;/);
assert.match(read('novel-mode.css'),/novel-section-content-in 1100ms ease-in-out both/);
for(const name of ['finishSectionSeparator','finishTemporalTransitionCard']){
  const block=main.slice(main.indexOf('function '+name),main.indexOf('\n  function ',main.indexOf('function '+name)+1));
  assert.match(block,/renderStepAfterSection/);
  assert.doesNotMatch(block,/\brenderCurrentStep\b/,'Every post-card route must reveal through the fade');
}
const timers=main.slice(main.indexOf('const clearTimers ='),main.indexOf('const resetDialoguePagination ='));
assert.doesNotMatch(timers,/sectionEntryTimer/,'Typewriter timers must not cancel the containing UI fade');
assert.match(main,/function renderCurrentStep\(\) \{\s*clearSectionEntry\(\)/);
assert.match(main,/function closeNovelNow\(\) \{\s*clearSectionEntry\(\)/);
assert.match(main,/function advance\(\) \{[^\n]*\n[^\n]*sectionEntryTimer/);
assert.match(ending,/const SCENE_INTERFACE_FADE_MS = 1100;/);
assert.match(read('true-end.css'),/true-end-section-content-in 1100ms ease-in-out both/);
assert.match(ending,/setSceneTransitionPhase\("interface"\);\s*await waitForSceneCard\(layer.classList.contains\("is-motion-reduced"\) \? 0 : SCENE_INTERFACE_FADE_MS\);\s*if \(!shell.isConnected \|\| complete\) return;\s*transitioning = false;\s*setSceneTransitionPhase\("idle"\)/);
assert.match(surf,/const SURF_MIX_GAIN = 0\.25;/);
assert.match(surf,/surf.gain.value = SURF_MIX_GAIN; surf.connect\(master\)/);
assert.match(surf,/highpass.connect\(surf\)/);
assert.match(surf,/voices.gain.value = 0; voices.connect\(master\)/,'Distant voices keep their existing mix');
assert.match(surf,/state.volume \* state.mixGain \* .85/,'User volume and ambience master must remain unchanged');
console.log('PASS section entry: 1.1-second choreography, cleanup, progression guards and isolated 25% surf branch');
