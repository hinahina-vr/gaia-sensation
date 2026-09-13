import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const runtime = read("novel-mode.js");
const css = read("novel-mode.css");
assert(runtime.includes('"Thank you for playing".split(" ")'));
assert(runtime.includes('if (index) closingMark.append(" ")'));
assert(runtime.includes("150 + index * 110"));
assert.match(runtime, /STAFF_ROLL_THANK_YOU_HOLD_MS = 4_200/u);
assert.match(runtime, /STAFF_ROLL_FINALIZE_MS = 640/u);
for (const name of ["word", "caption", "line", "glint", "line-out"]) {
  const frames = css.match(new RegExp(`@keyframes novel-staff-roll-thank-you-${name}\\s*\\{([\\s\\S]*?)\\r?\\n\\}`, "u"))?.[1];
  assert(frames, `Missing thank-you ${name} keyframes`);
  assert.doesNotMatch(frames, /brightness|skew|steps\(/u);
}
assert.doesNotMatch(css, /novel-staff-roll-(?:thank-you-(?:shards|flare|arrival)|mark-flicker|action-(?:flash|scan))/u);
assert.match(css, /novel-staff-roll-thank-you-word 1200ms var\(--thank-you-word-delay\) cubic-bezier/u);
assert.match(css, /\.novel-staff-roll\.is-reduced-motion \.novel-staff-roll-closing-action > small\s*\{\s*opacity: 1;/u);
console.log("Ending thanks passed: staggered words, one soft light sweep, readable hold and quiet dissolve.");
