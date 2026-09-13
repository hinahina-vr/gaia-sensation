import assert from "node:assert/strict";
import fs from "node:fs";
import "../dialogue-typography.js";
import "./check-story-reading-breaks.mjs";

const root = new URL("../", import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), "utf8");
const runtime = read("novel-mode.js");
const typography = read("dialogue-typography.js");
const choose = globalThis.GaiaDialogueTypography.chooseLineBreaks;
const lines = (tokens, width) => {
  const breaks = [...choose(tokens, width), tokens.length];
  let start = 0;
  return breaks.map(end => {
    const line = tokens.slice(start, end);
    start = end;
    assert(line.reduce((sum, token) => sum + token.width, 0) <= width + .5);
    return line.map(token => token.text).join("");
  });
};
const tokens = [
  ["画面の", 3], ["端には", 3], ["CO2", 2], ["濃度", 2], ["だけでなく、", 6],
  ["風向や", 3], ["都市の", 3], ["電力", 2], ["消費の", 3], ["パラメータも", 6], ["並んで", 3], ["いた。", 3],
  ["気象シミュレーション", 10], ["という", 3], ["枠を", 2], ["はるかに", 4], ["超えて", 3], ["いる。", 3],
].map(([text, width]) => ({ text, width }));
assert.deepEqual(lines(tokens, 29), [
  "画面の端にはCO2濃度だけでなく、",
  "風向や都市の電力消費のパラメータも並んでいた。",
  "気象シミュレーションという枠をはるかに超えている。",
]);
assert.equal(lines(tokens, 70).length, 1);
assert.deepEqual([...choose([], 30)], []);
assert.deepEqual([...choose([{ text: "long-token", width: 200 }], 30)], [], "Oversized fallback must stay browser-wrappable");
for (const width of [12, 16, 20, 24, 29, 40]) {
  const wrapped = lines(tokens, width);
  assert.equal(wrapped.join(""), tokens.map(token => token.text).join(""));
  assert.deepEqual(lines(tokens, width), wrapped, "Line selection must be deterministic");
}
assert.match(runtime, /Math\.max\(indicatorSafety, indicatorRect\.left - textRect\.right\)/u);
assert.match(runtime, /indicatorClearance >= TEXT_PAGE_INDICATOR_SAFETY_PX/u);
assert.match(runtime, /horizontalOverflow <= 1/u);
assert.match(typography, /lineBreak\.dataset\.sourceBreak = token/u);
assert.match(typography, /lineBreak\.dataset\.dialogueWrap = ""/u);
assert.match(read("novel-mode.css"), /\.novel-phrase-token\s*\{[^}]*white-space: nowrap/u);
assert.match(read("novel-mode.css"), /\.novel-phrase-token\.is-breakable\s*\{[^}]*overflow-wrap: anywhere/u);
assert.doesNotMatch(read("novel-mode.css"), /word-break: auto-phrase/u);
assert.match(read("gaia-mode-loader.js"), /novel-mode\.css\?v=gaia-separator-plus-two-1/u);
console.log("Dialogue flow passed: punctuation-first lines, no orphan ending, width bounds, source preservation and marker clearance.");
