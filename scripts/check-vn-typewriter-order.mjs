import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./check-dialogue-flow.mjs";
import "./check-ending-logo.mjs";
import "./check-ending-thanks.mjs";
import "./check-true-end-transition.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtime = read("novel-mode.js");
const typography = read("dialogue-typography.js");
const css = read("novel-mode.css");
const html = read("index.html");
const modeLoader = read("gaia-mode-loader.js");
const checks = [];
const check = (name, condition) => {
  assert(condition, name);
  checks.push(name);
};

check("phrase token reveal animation removed", !runtime.includes("--novel-token-delay") && !css.includes("novel-token-reveal"));
check("phrase token layout remains canonical", typography.includes('span.className = /^\\s+$/u.test(token) ? "novel-space-token" : "novel-phrase-token"') && runtime.includes("GaiaDialogueTypography.createLayout"));
check("source offsets remain on phrase tokens", typography.includes('span.dataset.sourceStart = String(offset)') && typography.includes('span.dataset.sourceEnd = String(offset + token.length)'));
check("glyphs are nested after pagination measurement", runtime.indexOf("const measuredLines = measureNativeLines(text, layout)") < runtime.indexOf('span.className = "novel-reveal-glyph"'));
check("glyphs preserve source order", runtime.includes('span.dataset.revealIndex = String(glyphs.length)') && runtime.includes("glyphs.push(span)"));
check("one glyph is revealed per timer tick", runtime.includes('glyph.classList.add("is-visible")') && runtime.includes("nextGlyphIndex += 1") && runtime.includes("window.setTimeout(revealNextGlyph, revealDelayForGlyph())"));
check("reveal cadence is independent of display refresh rate", runtime.includes('elements.text.dataset.revealCadence = "timer-steady"') && !runtime.includes("previousRevealFrameTime"));
check("live speed is sampled per glyph", runtime.includes("const revealDelayForGlyph") && runtime.includes("100 / config.messageSpeedPercent"));
check("fastest cadence is clamped to a visible interval", runtime.includes("const REVEAL_MIN_GLYPH_MS = 20") && /Math\.max\(\r?\n\s*REVEAL_MIN_GLYPH_MS/u.test(runtime));
check("every glyph uses the same cadence", runtime.includes("REVEAL_BASE_MS * (100 / config.messageSpeedPercent)") && !runtime.includes("REVEAL_PUNCTUATION_MS"));
check("default speed is two thirds of the former four times", runtime.includes("const DEFAULT_MESSAGE_SPEED_PERCENT = 270") && runtime.includes("const REVEAL_BASE_MS = 64") && runtime.includes('const CONFIG_KEY = "gaiaSensewareNovel:config:v4"'));
check("legacy speed is reduced once", runtime.includes("const LEGACY_MESSAGE_SPEED_SCALE = 2 / 3") && runtime.includes("legacySpeed * LEGACY_MESSAGE_SPEED_SCALE"));
check("actual reveal progress is observable", runtime.includes('elements.text.dataset.revealCount = String(nextGlyphIndex)') && runtime.includes('elements.text.dataset.revealState = "complete"'));
check("preparing state cannot inherit a completed frame", runtime.includes('elements.text.dataset.revealState = "preparing"') && runtime.includes('elements.text.dataset.revealCount = "0"'));
check("resize and font reflow wait for the active reveal", runtime.includes("dialogueReflowPending = true") && runtime.includes("window.requestAnimationFrame(repaginateVisibleDialogue)") && runtime.includes('elements.text.dataset.revealState === "preparing"') && runtime.includes('elements.text.classList.contains("is-preparing")'));
check("CSS hides only unrevealed glyphs", css.includes(".novel-text.is-revealing .novel-reveal-glyph") && css.includes(".novel-reveal-glyph.is-visible"));
check("scramble fade is disabled during reveal", /\.novel-text\.is-revealing\s*\{\s*animation:\s*none;/u.test(css));
check("block cursor is removed", !html.includes(">▌</span>") && /\.novel-cursor\s*\{\s*display:\s*none !important;/u.test(css));
check("SCRIPT debug overlay is removed", /\.novel-script-debug\s*\{[\s\S]*?display:\s*none !important;/u.test(css));
check("runtime cache key is current", modeLoader.includes("novel-mode.js?v=gaia-separator-plus-two-1"));

console.log(JSON.stringify({ status: "passed", checks: checks.length, names: checks }, null, 2));
