import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtime = read("novel-mode.js");
const css = read("novel-mode.css");
const html = read("index.html");
const source = read(path.join("story", "物語台本.md"));
const mirror = read(path.join("contest-limited", "story", "limited-feature-script.md"));

const scans = [
  ["Intl.Segmenter Japanese word segmentation", /new Intl\.Segmenter\("ja", \{ granularity: "word" \}\)/u.test(runtime)],
  ["deterministic fallback segmenter", /fallbackDialogueSegments/u.test(runtime)],
  ["protected phrase set", ["そのもの", "ものづくり", "リアルタイム", "GAIA SENSEWARE"].every((value) => runtime.includes(value))],
  ["Japanese inflection suffixes remain atomic", /DIALOGUE_INFLECTION_SUFFIXES/u.test(runtime) && ["た", "て", "ば", "れ", "さ", "たり", "ます"].every((value) => runtime.includes(`\"${value}\"`))],
  ["kanji stems keep kana continuations atomic across ICU versions", /DIALOGUE_KANJI_END\.test\(previous\) && \/\^\[ぁ-んァ-ヶー\]\//u.test(runtime)],
  ["token-boundary pagination", /tokenBoundaries\.has/u.test(runtime) && /largestSafePrefix/u.test(runtime)],
  ["page pair enumerates existing token boundaries", /const combinedTokens = segmentDialoguePhrases\(combined\)/u.test(runtime) && /splitIndex < combinedTokens\.length/u.test(runtime)],
  ["page pair preserves source exactly", /`\$\{before\}\$\{after\}` !== combined/u.test(runtime)],
  ["page pair keeps both pages bounded", /beforeMetrics\.fits \|\| !afterMetrics\.fits/u.test(runtime)],
  ["semantic boundaries precede sparse-page balancing", runtime.indexOf("a.sentencePenalty - b.sentencePenalty") < runtime.indexOf("a.oneLinePageCount - b.oneLinePageCount")],
  ["safe punctuation precedes dense token fallback", runtime.indexOf("fittingOffset(tokenBoundaryOffsets(safeOffsets))") < runtime.indexOf("fittingOffset(tokenBoundarySet, preferredMinimumLines)")],
  ["unsafe or sparse page boundaries are rebalanced", runtime.includes("const sparseAdjacentPage = previousMetrics.measuredLines.length < 2 || currentMetrics.measuredLines.length < 2") && runtime.includes("!sparseAdjacentPage && !unsafeBoundary")],
  ["unbounded phrase-boundary rebalance absent", !/phraseOffsets/u.test(runtime) && !/safeCandidates\.length \? safeCandidates : candidates/u.test(runtime)],
  ["same token layout for measure and render", runtime.includes("measureNativeLines = (text, preparedLayout = null)") && runtime.includes("replaceChildren(layout)")],
  ["font loading reflow", /loadingdone/u.test(runtime)],
  ["width-only resize guard", /Math\.abs\(width - dialogueObservedWidth\) < 0\.5/u.test(runtime)],
  ["reflow generation guard", /generation !== dialoguePaginationGeneration/u.test(runtime) && /dialogueReflowActive/u.test(runtime)],
  ["phrase tokens allow native Japanese wrapping", /\.novel-phrase-token\s*\{[\s\S]*?display: inline;[\s\S]*?white-space: normal;/u.test(css)],
  ["native strict kinsoku remains active", /\.novel-text\s*\{[\s\S]*?line-break: strict;[\s\S]*?overflow-wrap: normal;[\s\S]*?text-wrap: wrap;[\s\S]*?word-break: normal;/u.test(css)],
  ["native auto-phrase progressively enhances wrapping", /@supports \(word-break: auto-phrase\)[\s\S]*?\.novel-text\s*\{[\s\S]*?word-break: auto-phrase;/u.test(css)],
  ["source mirrors match", source === mirror],
  ["no escape hard breaks in changed prose", !source.includes("<br") && !source.includes("\\n")],
  ["forbidden verb absent", !/(?:置く|置いた|置いて|置か|置き|置け|置こう)/u.test(source)],
  ["mobile UI cache keys", ["styles.css?v=gaia-cross-platform-fonts-1", "novel-mode.css?v=gaia-mobile-chat-panel-1", "novel-mode.js?v=gaia-dialogue-pagination-1", "mode-exit.css?v=gaia-mobile-corner-controls-1"].every((asset) => html.includes(asset))],
];

const failures = scans.filter(([, pass]) => !pass).map(([name]) => name);
assert.equal(failures.length, 0, `VN typography checks failed: ${failures.join(", ")}`);

const paginationSafeBoundary = /[。！？!?、，,・：:；;\s][」』）】］〉》〕]*$/u;
[
  {
    source: "「一般にはそうですわ。でも、この画面のGXは『GAIA Transformation』。生命が地球を変え、変わった海や大気がまた生命の条件を変えてきた、その相互作用を表す言葉ですの」",
    boundary: "「一般にはそうですわ。でも、この画面のGXは『GAIA Transformation』。",
    next: "生命が地球を変え、変わった海や大気がまた生命の条件を変えてきた、その相互作用を表す言葉ですの」",
  },
  {
    source: "「温度、湿度、明るさ、気圧、空気中の粒子、音、振動。センサーを替えれば、もっといろいろ測れます。いくつか組み合わせて、その場所の環境をまとめて記録することもできます」",
    boundary: "「温度、湿度、明るさ、気圧、空気中の粒子、音、振動。",
    next: "センサーを替えれば、もっといろいろ測れます。いくつか組み合わせて、その場所の環境をまとめて記録することもできます」",
  },
  {
    source: "知らない誰かの輪へ入るのが怖くて、それでも何かが変わるかもしれないと、海風の中で最初の一歩を踏み出した。",
    boundary: "知らない誰かの輪へ入るのが怖くて、",
    next: "それでも何かが変わるかもしれないと、海風の中で最初の一歩を踏み出した。",
  },
].forEach(({ source: text, boundary, next }) => {
  assert(paginationSafeBoundary.test(boundary), "expected target boundary must satisfy the pagination safe-boundary predicate");
  assert.equal(`${boundary}${next}`, text, "target boundary must preserve source exactly");
  assert(!/^いろいろ/u.test(next), "もっといろいろ測れます must remain on one page");
  assert(!boundary.endsWith("変") && !next.startsWith("わる"), "変わる must not be split across pages");
});

[
  ["pc-2048", "festival_concept_070", "NASAやJAXA、", "気象庁"],
  ["pc-2048", "esp32_pitch_015", "拾ったり、", "いくつか"],
  ["pc-1920", "festival_concept_029", "ソフトウェアも演出も、", "映像の迫力も"],
  ["pc-1920", "festival_concept_064", "聞いたり、", "触れたり"],
  ["pc-1920", "festival_concept_070", "NASAやJAXA、", "気象庁"],
  ["pc-1920", "esp32_pitch_015", "拾ったり、", "いくつか"],
  ["pc-1440", "esp32_pitch_015", "拾ったり、", "いくつか"],
  ["mobile-390", "festival_concept_016", "気候の変化まで、", "画面に触れながら"],
  ["mobile-390", "gx_experience_010", "『GAIA Transformation』。", "生命が地球を"],
  ["mobile-390", "esp32_pitch_015", "拾ったり、", "いくつか"],
].forEach(([viewport, id, left, right]) => {
  assert(paginationSafeBoundary.test(left), `${viewport} ${id} fixture left side must be a safe pagination boundary`);
  assert(left.length > 1 && right.length > 1, `${viewport} ${id} fixture must retain content on both pages`);
});
console.log(`VN Japanese typography static check passed: ${scans.length}/${scans.length}`);
