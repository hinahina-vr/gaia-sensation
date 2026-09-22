import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const runtime = read("novel-mode.js");
const css = read("novel-mode.css");
const focusFrames = css.match(/@keyframes novel-staff-roll-title-focus\s*\{([\s\S]*?)\r?\n\}/u)?.[1];
assert(focusFrames, "Ending title focus keyframes are missing");
assert.match(focusFrames, /0%\s*\{\s*opacity: 0; filter: blur\(18px\)/u);
assert.match(focusFrames, /57\.1429%, 85\.7143%\s*\{\s*opacity: 1; filter: blur\(0\)/u);
assert.match(focusFrames, /100%\s*\{\s*opacity: 0; filter: blur\(0\)/u);
assert.doesNotMatch(focusFrames, /transform|translate|scale|rotate/u);
assert.match(css, /--novel-staff-roll-start-offset: 17\.6s/u);
assert.match(css, /novel-staff-roll-title-focus 11\.2s 6\.4s ease-in-out both/u);
assert.match(css, /novel-staff-roll-whiteout 6\.4s/u);
assert.match(css, /novel-staff-roll-stage-reveal 6\.4s/u);
assert.match(runtime, /if \(!motionReduced\(\)\) stage\.append\(heading\)/u);
assert.match(runtime, /if \(motionReduced\(\)\) track\.append\(heading\)/u);
assert.doesNotMatch(runtime, /track\.append\(heading, creditsHeading/u);
assert.match(css, /\.novel-staff-roll\.is-reduced-motion \.novel-staff-roll-title\s*\{\s*position: relative;\s*inset: auto;\s*opacity: 1;\s*filter: none;\s*animation: none;/u);
assert(read("gaia-mode-loader.js").includes("novel-mode.css?v=gaia-separator-plus-two-1"));
assert(read("gaia-mode-loader.js").includes("novel-mode.js?v=gaia-separator-plus-two-1"));
assert(read("index.html").includes("gaia-mode-loader.js?v=20260922-entry-ready-1"));
const finaleRuntime = read("true-end-mode.js");
const finaleCss = read("true-end.css");
assert.match(finaleRuntime, /const FINALE_EXIT_COVER_MS = 2_400;/u);
assert.match(finaleRuntime, /const FINALE_EXIT_WHITE_HOLD_MS = 600;/u);
assert.match(finaleRuntime, /exitVeil\.addEventListener\("animationend"/u);
assert.doesNotMatch(finaleRuntime, /exitVeil\.dataset\.phase = "(?:flash|black)"/u);
assert.doesNotMatch(finaleCss, /true-end-exit-(?:noise|strobe)/u);
assert.match(finaleCss, /@keyframes true-end-exit-cover\s*\{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}/u);
// The stylesheet also carries later local copy/layout work. Its contents are
// checked above; require a versioned load without pinning an unrelated revision.
assert.match(read("gaia-mode-loader.js"), /true-end\.css\?v=[\w-]+/u);
assert(read("gaia-mode-loader.js").includes("true-end-mode.js?v=gaia-ending-whiteout-1"));
console.log("Ending logo passed: stationary blur/fade, separate credits, reduced-motion document and cache keys.");
