import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const index = read("index.html");
const css = read("novel-mode.css");
const runtime = read("novel-mode.js");
const app = read("app.js");
const gxRuntime = read("gx-mode.js");
const gxCss = read("gx-mode.css");
const mapPolishCss = read("map-ui-grid-polish.css");
const canon = read("story/物語台本.md");
const retained = read("contest-limited/story/limited-feature-script.md");
const generated = read("novel-story-data.js");
const builder = read("scripts/build-novel-story.mjs");

assert.match(index, /novel-mode\.css\?v=gaia-log-round3-1/u);
assert.match(index, /novel-mode\.js\?v=gaia-log-round3-1/u);
assert.match(index, /app\.js\?v=gaia-map-compositor-fix-1/u);
assert.match(index, /gx-mode\.css\?v=gaia-story-modal-1/u);
assert.match(index, /gx-mode\.js\?v=gaia-story-detour-fix-1/u);
assert.match(index, /map-ui-grid-polish\.css\?v=4/u);
assert.match(css, /--novel-scene-background:\s*none;/u);
assert.doesNotMatch(css.slice(0, 400), /novel-bg-exhibition-v3/u);

const revealStart = runtime.indexOf("const revealRuntimeForStep");
const preload = runtime.indexOf("await preloadBackground(presentation.image)", revealStart);
const applyCue = runtime.indexOf("applyBackgroundCueForStep(target)", revealStart);
const paint = runtime.indexOf("await nextPaint()", revealStart);
const reveal = runtime.indexOf("reveal();", revealStart);
assert(revealStart >= 0 && preload > revealStart && applyCue > preload && paint > applyCue && reveal > paint);
assert.match(runtime.slice(revealStart, reveal), /backgroundCues\?\.forStep\?\.\(target\)/u);
assert.match(runtime, /const startNewSession = async/u);
assert.match(runtime, /elements\.resume\.addEventListener\("click", \(\) => openManualArchive\("load"\)\)/u);
assert.match(runtime, /async function loadManualSlot/u);
assert.match(runtime, /elements\.location\.classList\.add\("is-signal-reveal"\)/u);

assert.match(app, /globalSignalConsole\.hidden = true;\s*\n\s*globalSignalConsole\.inert = true;\s*\n\s*globalSignalConsole\.setAttribute\("aria-hidden", "true"\);/u);
assert.match(app, /const activeSignalConsoles = storyModeDetour && japanIsOpen[\s\S]{0,240}classList\.contains\("signal-console-map"\)/u);
assert.match(app, /activeSignalConsoles\.forEach\(\(consoleElement\) =>/u);
assert.doesNotMatch(app.slice(app.indexOf("const activeSignalConsoles"), app.indexOf("const DATA_TRANSFORMS")), /signalConsoles\.forEach/u);
assert.match(css, /body\.novel-open\.novel-mode-detour \.experience \.signal-console-main\[hidden\][\s\S]{0,180}display:\s*none !important;/u);
assert.match(mapPolishCss, /\.signal-console-heading\.map-grid-data\s*\{\s*pointer-events:\s*none !important;/u);
assert.match(app, /className = "story-map-guide"/u);
assert.match(app, /storyMapGuideProgress = \{ timeline: false, map: false \}/u);

assert.match(gxRuntime, /let storyDetourActive = false;/u);
assert.match(gxRuntime, /storyDetourActive = returnTo === "novel";/u);
assert.match(gxRuntime, /if \(storyDetourActive && storyGestureCount < 3\) return;/u);
assert.doesNotMatch(gxRuntime, /storyMode\s*[!=]==?\s*["']v6["']/u);
assert.match(gxCss, /width:\s*min\(78vw, 1280px\);/u);
assert.match(gxCss, /height:\s*min\(78dvh, 860px\);/u);
assert.match(gxCss, /width:\s*92vw !important;/u);
assert.match(gxCss, /height:\s*78dvh !important;/u);

assert.match(css, /background:\s*radial-gradient\(ellipse 62% 115% at 50% 50%, rgba\(5, 31, 64, 0\.2\), transparent 72%\);/u);
assert.match(css, /\.novel-signal-caption::before[\s\S]*border-top:\s*1px solid rgba\(164, 230, 246, 0\.34\);/u);
assert.match(css, /mask-image:\s*linear-gradient\(90deg, transparent, #000 12%, #000 88%, transparent\);/u);
assert.match(css, /\.novel-signal-caption::after[\s\S]*display:\s*block;/u);
assert.match(css, /0 1px 2px rgba\(0, 5, 18, 0\.86\),\s*\n\s*1px 0 1px rgba\(0, 5, 18, 0\.54\),\s*\n\s*-1px 0 1px rgba\(0, 5, 18, 0\.54\)/u);

assert.equal(canon, retained);
const expectedHash = sha256(canon);
assert.equal(expectedHash, "8bb9b30ecfb423f5f6f8c6f9b42207aff71fe30b988c952adb5facd4e414fc03");
assert(builder.includes(expectedHash));
assert.match(canon, /［会場案内｜海側広場　学生作品・体験展示］/u);
assert.doesNotMatch(canon, /Bホール/u);
assert.match(generated, /"id": "festival_concept_009"[\s\S]{0,240}"text": "会場案内｜海側広場　学生作品・体験展示"/u);
assert.doesNotMatch(generated, /会場案内板｜Bホール/u);
assert.doesNotMatch(generated, /Bホール/u);
assert.match(generated, new RegExp(`"sourceSha256": "${expectedHash}"`, "u"));

console.log(JSON.stringify({ status: "passed", checks: 38, sourceSha256: expectedHash }, null, 2));
