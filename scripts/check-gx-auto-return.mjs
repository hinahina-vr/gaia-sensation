import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const gx = read("gx-mode.js");
const gxStyles = read("gx-mode.css");
const readingStyles = read("gx-reading-layout.css");
const novel = read("novel-mode.js");
const loader = read("gaia-mode-loader.js");
const phases = JSON.parse(read("data/gx-deep-time.json")).phases;

for (const phase of phases) {
  assert(Array.from(phase.title).length <= 11, `${phase.id}: keep the title concise for one-line mobile display`);
  assert(gx.includes(`title: ${JSON.stringify(phase.title)}`), `${phase.id}: fallback title differs from the data`);
}
assert(html.includes(`<h3 id="gx-phase-title">${phases[0].title}</h3>`), "Initial GX title differs from the data");

assert.match(novel, /if \(!\["map01", "gx"\]\.includes\(step\.interaction\.kind\)\) \{/u);
assert.doesNotMatch(novel, /水面の操作[^\n]*\/ 3/u);
assert.doesNotMatch(novel, /kind === "gx" && motionReduced\(\)/u);
assert.doesNotMatch(novel, /event\.detail\?\.complete \|\| detourState\.gestureCount >= 3/u);
assert.match(novel, /if \(event\.detail\?\.complete === true\) state\.viewed\.gxDeepTime = true;/u);

assert.match(gx, /let storySequenceComplete = false;/u);
assert.match(gx, /if \(storyDetourActive && !storySequenceComplete\) return;/u);
assert.match(gx, /if \(isFinalPhase && storyDetourActive\) \{\s*storySequenceComplete = true;\s*emitStoryProgress\(true\);/u);
assert.match(gx, /if \(completedPhase === exhibit\.phases\.length - 1\) closeGX\(\);/u);
assert.match(gx, /const skipGXModal = \(\) => \{[\s\S]*?storySequenceComplete = true;[\s\S]*?emitStoryProgress\(true\);[\s\S]*?closeGX\(\);/u);
assert.match(gx, /elements\.modalSkip\.addEventListener\("click", \(event\) => \{\s*event\.stopPropagation\(\);\s*skipGXModal\(\);/u);
assert.match(gx, /await loadExhibit\(\);\s*if \(!isOpen\) return;/u);
assert.doesNotMatch(gx, /eraTransitionSkip/u);
assert.doesNotMatch(gx, /storyGestureCount < 3/u);
assert.doesNotMatch(gx, /storyGestureCount >= 3/u);
assert.match(gx, /event\.key === "Enter" \|\| event\.key === " "/u);

assert.match(html, /id="gx-modal-skip"[\s\S]{0,240}aria-label="GXモーダルをスキップして戻る"[\s\S]{0,240}<span>スキップ<\/span><b aria-hidden="true">▶<\/b>/u);
assert.match(gx, /elements\.modalSkip\.setAttribute\([\s\S]*?GXモーダルをスキップして\$\{returnTo === "novel" \? "ストーリー" : "入口"\}へ戻る/u);
assert.doesNotMatch(html, /id="gx-era-transition-skip"/u);
assert.match(loader, /gx-mode\.js\?v=gaia-gx-single-line-titles-1/u);
assert.match(loader, /novel-mode\.js\?v=/u);
assert.match(loader, /gx-mode\.css\?v=gaia-gx-reading-1/u);
assert.match(loader, /gx-reading-layout\.css\?v=gaia-gx-reading-1/u);
assert.match(gx, /const CLOSE_TRANSITION_MS = reducedMotion \? 0 : 340;/u);
assert.match(gx, /if \(isOpen \|\| isClosing\) return;/u);
assert.match(gx, /closeTransitionTimer = window\.setTimeout\(\(\) => \{[\s\S]*?document\.body\.classList\.remove\("gx-story-open"\);/u);
assert.match(gxStyles, /\.gx-era-transition strong \{[\s\S]*?font-size: clamp\(12px, 2vw, 38px\);[\s\S]*?white-space: nowrap;/u);
assert.match(readingStyles, /#gx-layer #gx-modal-skip \{[\s\S]*?right: var\(--gx-reading-pad\);\s*left: auto;/u);
assert.match(readingStyles, /#gx-layer #gx-reading #gx-story-card \{[\s\S]*?pointer-events: none;/u);
assert.match(readingStyles, /#gx-layer #gx-mobile-info-toggle \{[\s\S]*?min-height: 44px;[\s\S]*?pointer-events: auto;/u);
assert.match(readingStyles, /#gx-layer #gx-mobile-info\[hidden\] \{ display: none !important; \}/u);

console.log(JSON.stringify({ status: "passed", behavior: "gx-modal-skip-and-return" }, null, 2));
