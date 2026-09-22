import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const source = await readFile(path.join(rootDirectory, "app-content.js"), "utf8");
const indexHtml = await readFile(path.join(rootDirectory, "index.html"), "utf8");
const modeLoader = await readFile(path.join(rootDirectory, "gaia-mode-loader.js"), "utf8");
const openingRuntime = await readFile(path.join(rootDirectory, "opening.js"), "utf8");
const characterRuntime = await readFile(path.join(rootDirectory, "character-mode.js"), "utf8");
const characterStyles = await readFile(path.join(rootDirectory, "character-mode.css"), "utf8");
const indexText = indexHtml.replace(/<[^>]*>/gu, "");
const sandbox = { window: {} };

vm.createContext(sandbox);
new vm.Script(source, { filename: "app-content.js" }).runInContext(sandbox);

const content = sandbox.window.GaiaAppContent;
const requiredKeys = [
  "JAPAN_NODES",
  "JMA_CO2_SITES",
  "EARTH_NODES",
  "SIMPLE_WORLD_LANDMASSES",
  "SIMPLE_WORLD_ISLAND_LINES",
  "JMA_EVENT_TITLES",
  "INTRO_PATHS",
  "INTRO_MODE_CHOICES",
  "MAP_MODE_DESCRIPTIONS",
  "MAP_TITLE_SUBTITLES",
  "SPACE_MODE_CHOICES",
  "modes",
  "modeConcepts",
  "modeDataNarratives",
  "lectureResumeLinks",
];

assert.ok(content, "GaiaAppContent was not published on window");
assert.ok(Object.isFrozen(content), "GaiaAppContent must be frozen");
assert.deepEqual(Object.keys(content), requiredKeys);
assert.equal(content.modes.length, 9, "Earth mode catalog must contain 9 exhibits");
assert.deepEqual(Array.from(content.modes, mode => mode.mapNumber), Array.from({ length: 9 }, (_, index) => String(index + 6).padStart(2, "0")));
assert.equal(content.INTRO_MODE_CHOICES.length, 9, "Entrance catalog must contain 9 choices");
assert.ok(Object.isFrozen(content.MAP_MODE_DESCRIPTIONS), "Map picker copy must be frozen");
assert.equal(Object.keys(content.MAP_MODE_DESCRIPTIONS).length, 31, "Every map needs a short picker description");
assert.ok(Object.isFrozen(content.MAP_TITLE_SUBTITLES));
assert.deepEqual(Object.keys(content.MAP_TITLE_SUBTITLES).sort(), Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")));
for (const [number, subtitle] of Object.entries(content.MAP_TITLE_SUBTITLES)) {
  assert.equal(typeof subtitle, "string");
  assert(subtitle.length >= 12 && subtitle.length <= 32, `${number}: keep the separator subtitle short`);
  assert.doesNotMatch(subtitle, /[<>\n]/u);
}
for (const [id, copy] of Object.entries(content.MAP_MODE_DESCRIPTIONS)) {
  assert.equal(typeof copy, "string", `${id}: map description must be text`);
  assert.ok(copy.length >= 20 && copy.length <= 85, `${id}: keep picker descriptions concise`);
  assert.doesNotMatch(copy, /へ変換します|正規化|[<>]/u, `${id}: avoid implementation language or markup in picker copy`);
}
assert.match(content.MAP_MODE_DESCRIPTIONS["blue-circulation"], /速さと向きを固定/u);
assert.match(content.MAP_MODE_DESCRIPTIONS["estat-summer-high"], /最高気温を一年で平均/u);
assert.match(content.MAP_MODE_DESCRIPTIONS["estat-winter-low"], /最低気温を一年で平均/u);
assert.match(content.MAP_MODE_DESCRIPTIONS["global-cloud-radiance"], /衛星写真ではありません/u);
assert.equal(content.SPACE_MODE_CHOICES.length, 10, "Space catalog must contain 10 choices");
assert.deepEqual(Object.keys(content.INTRO_PATHS), ["abstract", "map", "novel", "space"], "Abstract exhibit must remain routable");
assert.equal(indexHtml.includes('data-intro-path="abstract"'), false, "Abstract exhibit must not remain a separate entrance card");
assert.equal(indexHtml.includes('class="map-surface-switch"'), false, "Obsolete MAP/LIGHT toggle remains in the world-reading bank");
assert.equal(indexHtml.includes('class="map-mode-groups"'), true, "MAP-only exhibit bank is missing");
assert.equal(indexHtml.includes('id="map-light-overlay"'), false, "Independent light overlay picker must remain retired");
assert.equal(indexHtml.includes('id="abstract-mode-list"'), false, "Duplicate light mode bank must remain retired");
assert.equal(indexHtml.includes('id="map-mode-preview"'), true, "Restored focus explanation preview is missing");
assert.equal(indexHtml.includes("下へ</b><small>公開データを見る"), true, "Japanese public-data scroll label is missing");
assert.equal(indexHtml.includes('id="intro-character-jump"'), true, "Character settings menu button is missing");
assert.equal(indexHtml.includes('data-character-gallery-open'), true, "Character settings menu is not connected to the standalone viewer");
assert.equal(indexHtml.includes('id="gaia-template-character"'), true, "Lazy character settings template is missing");
assert.equal(indexHtml.includes('id="character-book-layer"'), true, "Standalone character settings viewer is missing");
assert.equal(indexHtml.includes("VISUAL MEMORY ARCHIVE"), true, "Immersive character archive heading is missing");
assert.equal(indexHtml.includes('id="character-book-webgl"'), true, "Immersive character setting atmosphere is missing");
assert.equal((indexHtml.match(/data-character-select=/gu) || []).length, 4, "Character setting selector must expose all four characters");
assert.equal((indexHtml.match(/data-character-profile=/gu) || []).length, 0, "Duplicate lower character profiles must remain removed");
assert.equal(indexHtml.includes('class="character-book-hero-detail"'), true, "Switchable hero character detail is missing");
assert.equal(indexHtml.includes('id="character-book-profile"'), true, "Switchable hero character profile is missing");
assert.equal(indexHtml.includes('id="character-book-master"'), false, "Removed character reference panel must not return");
assert.equal(indexHtml.includes("01-three-ecologies-character-master.png"), false, "Removed reference image must not be requested by the page");
assert.equal(modeLoader.includes('interceptClick("[data-character-gallery-open]", "character")'), true, "Character viewer is not lazy-loaded");
assert.equal(modeLoader.includes('interceptClick("[data-sound-gallery-open]", "sound")'), true, "Sound archive is not lazy-loaded");
assert.equal(modeLoader.includes('warmOnIntent("[data-sound-gallery-open]", "sound")'), true, "Sound archive is not warmed on pointer or keyboard intent");
assert.equal(openingRuntime.includes('GaiaModeLoader?.load?.("sound")'), true, "Sound archive is not warmed during the menu handoff");
assert.equal((modeLoader.match(/\.\/styles\.css\?v=[\w-]+/gu) || []).length, 1, "Shared UI styles must use one cache URL across mode groups");
assert.match(modeLoader, /sound:\s*\{[\s\S]{0,120}parallel: true,/u, "Sound archive assets are not fetched in parallel");
assert.equal((indexHtml.match(/sound-archive-bg-v3\.png\?v=gaia-sound-selected-20260913/gu) || []).length, 2, "Sound archive background URLs must share one browser cache entry");
assert.match(characterRuntime, /const quoteRevealDelay = 620;/u, "Character quote letter animation starts too early");
assert.match(characterRuntime, /setLetterText\(quote, character\.quote, quoteRevealDelay\);/u, "Character quote does not use the delayed reveal");
assert.match(characterStyles, /\.character-book-layer\.is-open \.character-book-hero-quote\s*\{[\s\S]*?transition-delay: 520ms;/u, "Character quote panel does not enter one beat after the hero");
assert.equal((modeLoader.match(/character-mode\.(?:css|js)\?v=gaia-aoneko-natural-posture-1/gu) || []).length, 2, "Character page assets are not cache-busted together");
assert.match(characterRuntime, /aoneko-silhouette-imagegen-v4\.png/u, "Aoneko portrait must use the revised upright pose");
assert.match(indexHtml, /aoneko-silhouette-imagegen-v4\.png\?v=gaia-aoneko-natural-posture-1/u, "Aoneko selector must use the same revised sprite");
[
  "物語を彩った、六つの景色。絵をめくるたび、あの日の空気がよみがえります。",
  "人物紹介",
  "四つの瞳に映る、たったひとつの地球。",
  "海風の抜ける通りで、ふたりと出会った。",
  "柔らかな秋の光のなか、物語が静かに動き出す。",
  "展示を終えて、夕焼けに染まる海沿いを歩く。",
  "今日の終わりは、新しい始まり。",
  "放課後の窓辺から。",
  "放課後の静けさの向こうに広がる、地球の気配。『惑星の放課後～GAIA SENSATION～』が生まれた背景と思想を綴りました。",
  "手元のあかり",
  "澄んだまなざし",
  "小さな設計図",
  "輪のなかへ",
  "夕暮れの帰り道",
].forEach((copy) => {
  assert.equal(indexHtml.includes(copy) || characterRuntime.includes(copy), true, `Revised character-page copy is missing: ${copy}`);
});
["余韻がひらきます", "輪郭だけをそっと残す", "未来はやさしく配線される"].forEach((copy) => {
  assert.equal(indexHtml.includes(copy) || characterRuntime.includes(copy), false, `Superseded abstract copy remains: ${copy}`);
});
[
  "画面越しにコードやデータをやりとりしていた、あの時間。",
  "海も空も生き物も、ぜんぶ影響し合って今の地球になってるんだよ。",
  "数値で見ると、地球が呼吸してるリズムがちゃんとわかるね。",
  "手元の画面は、本物の地球とつながっている。",
  "観測する ── 描画する ── 体感する",
].forEach((copy) => {
  assert.equal(indexText.includes(copy), true, `Revised opening copy is missing: ${copy}`);
});
assert.doesNotMatch(indexHtml, /序章 \/ 逗子海岸|class="gaia-vn-project"/u, 'Removed prologue setting label returned');
[
  ["世界を観測する", "地球のデータを光と色で描く"],
  ["みんなのセンサー", "あなたの端末をひとつのセンサーに"],
  ["登場人物の記録", "4人の役割と設定スケッチ"],
  ["音楽を聴く", "放課後を彩る音楽のアーカイブ"],
].forEach(([title, description]) => {
  assert.equal(indexHtml.includes(`<strong>${title}</strong>`), true, `Navigation card title is missing: ${title}`);
  assert.equal(indexHtml.includes(`<p>${description}</p>`), true, `Navigation card description is missing: ${description}`);
});
assert.equal(indexHtml.includes("このデータの出典を表示する"), false, "Old open-data button copy remains");
assert.equal(indexHtml.includes("この展示を統計で読み解く"), false, "Old statistics button copy remains");

const modeIds = content.modes.map(({ id }) => id);
assert.equal(new Set(modeIds).size, modeIds.length, "Mode ids must be unique");
assert.equal(modeIds.includes("pollination-protocol"), false, "Retired pollination exhibit remains routable");

for (const id of modeIds) {
  assert.ok(content.MAP_MODE_DESCRIPTIONS[id], `Missing map picker copy for ${id}`);
  assert.ok(content.modeConcepts[id], `Missing concept copy for ${id}`);
  assert.ok(content.modeDataNarratives[id], `Missing data narrative for ${id}`);
  assert.ok(content.lectureResumeLinks[id], `Missing lecture reference for ${id}`);
}

assert.ok(content.JAPAN_NODES.length > 0, "Japan node catalog is empty");
assert.ok(content.EARTH_NODES.length > 0, "Earth node catalog is empty");
assert.ok(content.SIMPLE_WORLD_LANDMASSES.length > 0, "Fallback world geometry is empty");

assert.ok(indexHtml.includes('src="./gaia-mode-loader.js'), "index.html does not load gaia-mode-loader.js");
const contentScriptPosition = modeLoader.indexOf('"./app-content.js');
const appScriptPosition = modeLoader.indexOf('"./app.js');
assert.ok(contentScriptPosition >= 0, "mode loader does not load app-content.js");
assert.ok(appScriptPosition >= 0, "mode loader does not load app.js");
assert.ok(contentScriptPosition < appScriptPosition, "app-content.js must load before app.js");

console.log(`app-content.js: ${modeIds.length} modes and ${requiredKeys.length} catalogs verified`);
