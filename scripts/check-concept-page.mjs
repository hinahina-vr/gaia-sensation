import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conceptEditorialCopy } from "./lib/concept-editorial-copy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "concept/index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "concept/concept.js"), "utf8");
assert.match(html, /noindex, nofollow/u);
assert.match(html, /<a class="site-signature" href="\.\.\/" aria-label="サイトのトップページへ">/u, "The concept logo returns to the site home, not the concept-page anchor");
assert.match(html, /卒業プロジェクト/u);
assert.doesNotMatch(html, /お前|大奥|自分にとっての実感|意味を持つ体験|対話や選択|物語の中で選んだり/u, "Do not retain the rejected language or invent story choices");
for (const copy of ["完全自己情報", "深層知性群", "多元我（別人格群）", "世界・因果報告書群", "神格アーキテクチャ", "神託", "私（原型）", "自己決定権を留保します", "神託の根拠は見せない", "因果的介入はしない", "最後の意味づけは本人に委ねる"]) assert(html.includes(copy), `Preserve the owner's revised system descriptions: ${copy}`);
const plainCopy = html.replace(/<[^>]+>/gu, '').replace(/\s/gu, '');
for (const copy of [conceptEditorialCopy.title, ...conceptEditorialCopy.overview, ...conceptEditorialCopy.question, ...conceptEditorialCopy.depth, ...conceptEditorialCopy.manifesto, ...conceptEditorialCopy.components.flat(), ...conceptEditorialCopy.closing.flat(), conceptEditorialCopy.disclaimer]) assert(plainCopy.includes(copy.replace(/\s/gu, '')), `Owner-supplied copy missing: ${copy}`);
assert.doesNotMatch(html, /id="question"|class="oracle-evidence-note"|class="depth-overline"|THE SEEDS OF A MYTH|AN ORIGINAL CONCEPT|ローカル実装の画面|図で仕組みを見る|<span>05<\/span>/u, 'Requested removals must leave the DOM, not merely be hidden');
for (const [letter, mode] of [['A', 'GIS MODE'], ['B', 'GIS MODE'], ['C', 'STORY MODE']]) assert(html.includes(`<p class="experience-label"><span>${letter}</span> ${mode}</p>`), 'Restore experience labels with letters, not chapter numbers');
assert.doesNotMatch(html, /class="overview-facts|class="experience-footnote|class="illustration-note|class="mechanism-lead|class="origin-note|大学がひらく可能性を、物語として描く。|データを調べる。変化を読む。|LifeLogから着想した本作独自の応答/u, "Do not restore the ten blocks removed by the author");
assert.equal([...html.matchAll(/class="vision-step reveal"/gu)].length, 6, "Six distinct system components accompany the diagram, with the original person in its conclusion");
assert.doesNotMatch(html, /ひとつの正解にはまとめない|選択肢にない道|神託は、命令じゃない。|myth-agency-loop-v2\.png/u, "Do not restore the rejected reinterpretation or simplified four-stage image");
assert(html.includes("myth-machine-circulation-v4.png"), "Use the owner-selected v4 system diagram");
assert.doesNotMatch(html, /overview-topics|vision-agent|world-possibilities|world-caption|world-closing-title|return-to-world|myth-possible-worlds-v1/u, "Keep the author-selected labels and closing section deleted");
assert.doesNotMatch(html, /安田均|神話製作機械論|1987年|A HOMAGE|同書の引用/u, "Do not attribute the author's own interpretation to an unread book");
assert.doesNotMatch(html, /class="myth-node|class="process-tabs|data-process-panel/u, "The dense diagram and six-tab essay are replaced, not hidden");
assert.doesNotMatch(html, /myth-machine-(?:hero|diagram)-v2/u, "Do not restore the obsolete raster diagram");
assert.doesNotMatch(html.replace(/<[^>]+>/gu, ""), /初めて神話になる|最後まで人間である|基底として|表層へ|基底にある設計構想/u, "Do not restore the opaque explanatory prose reported by the author");
for (const copy of ["提示されるのは選択肢。", "決めるのは、私自身。", "従う必要はない。選ぶのは本人です。"]) assert(html.includes(copy), `Preserve the revised explanation: ${copy}`);
assert.doesNotMatch(html, /class="footer-note|class="concept-limit|現在の作品では、地球の公開データを調べ|「神話製作機械」そのものが動くゲームではありません/u, "Keep the requested closing explanations and footer note removed");
assert.doesNotMatch(html, /公開予定|近日登場|COMING SOON/u, "Do not retain the removed release announcements");
assert.match(html, /<h1 id="page-title">『惑星の放課後』<span>とは<\/span><\/h1>/u, "The page must identify itself as a work overview, not a second title screen");
const overview = html.slice(html.indexOf('id="top"'), html.indexOf('id="first-world"'));
assert.match(overview, /地球環境のオープンデータ/u, "Use the author's supplied introduction");
assert.doesNotMatch(html, /地球の感覚器をつくる、私たちの放課後。|class="overview-summary"/u, "Keep the requested overview slogan removed from the page and metadata");
assert.doesNotMatch(html, /opening-keyvisual|hero-art|hero-actions|SCROLL TO DISCOVER/u, "Do not replay the opening visual or title-screen presentation");
assert.doesNotMatch(overview, /<(?:button|video|audio)\b|この作品について\s*<span/u, "The overview must be immediately readable without a start action");
assert.match(overview, /class="brochure-scene"/u, "Work introduction needs a captioned brochure illustration beside its copy");
assert.equal([...html.matchAll(/class="experience-figure"/gu)].length, 3, "Each of the three experiences needs an illustrated editorial panel");
assert.doesNotMatch(html, /brochure-coast-|brochure-sound-|open-data-archive-bg|A SCENE FROM THE STORY/u, "Unverified scenes and decorative game art must not represent the actual modes");
for (const name of ["co2", "energy", "currents"]) assert(html.includes(`brochure-map-${name}-v1.webp`), `Use an actual captured map mode for ${name}`);
for (const name of ["earth", "ribbon", "learning", "archive"]) assert(html.includes(`brochure-ornament-${name}-v1.webp`), `Preserve the distinct ImageGen editorial asset: ${name}`);
assert.equal([...html.matchAll(/class="editorial-art(?:\s[^"]*)?"/gu)].length, 4);
const storyRuntime = fs.readFileSync(path.join(root, "novel-mode.js"), "utf8");
const courseTitles = [...storyRuntime.matchAll(/ZEN大学『([^』]+)』/gu)].map(match => match[1]);
assert.equal(courseTitles.length, 5, "Staff credits include the owner's added big-data lecture");
const learning = html.slice(html.indexOf('id="learning"'), html.indexOf('id="surface"'));
// The September 13 request groups all five courses into three layers.
for (const title of courseTitles) assert(learning.includes(`<h4>${title}</h4>`), `Course must match the live staff-roll implementation: ${title}`);
assert.match(learning, /卒業プロジェクトを見据えて制作するコンセプトモデル/u);
assert.doesNotMatch(overview, /卒業プロジェクト/u, "Introduce the university before its graduation project");
assert.doesNotMatch(html, /class="learning-copy|class="learning-lead|高等教育の機会を開く|一人ひとりの生活に合った学び|教育理念・教育目的|education_mission/u, "Keep the requested university introduction and source link removed");
assert.doesNotMatch(learning, /university-pillars|university-pillar\b|展軸祭|プロジェクト実践|6分野を横断|制作・監修・公認|物語はフィクション/u, "Remove institutional promotion and move the disclaimer to the final footer");
for (const copy of ['ZEN大学の卒業プロジェクト', conceptEditorialCopy.learning.title, conceptEditorialCopy.learning.kicker, conceptEditorialCopy.learning.heading, conceptEditorialCopy.learning.introduction, '世界観・ナラティブ', 'ストーリーテリング', 'データサイエンス', 'Sphere']) assert(plainCopy.includes(copy.replace(/\s/gu, '')), `Preserve the revised learning copy: ${copy}`);
for (const copy of conceptEditorialCopy.learning.removed) assert(!plainCopy.includes(copy.replace(/\s/gu, '')), `Requested removal must not survive in markup: ${copy}`);
assert.doesNotMatch(html.slice(html.indexOf('<main'), html.indexOf('</main>')), /作者/u, 'Omit redundant author references throughout the main reading copy');
assert.doesNotMatch(learning, /author-profile|ABOUT THE AUTHOR/u, 'The long author profile moves to a compact footer colophon');
for (const copy of ["主体性を取り戻すための試み", "神託が守る3つの原則", "新たな知の循環"]) assert(plainCopy.includes(copy), `Preserve the revised thesis: ${copy}`);
assert.doesNotMatch(plainCopy, /未来を先回りしていく時代に。|世界をあらかじめ決められた結末へ閉じ込めない|「あなたならこうするはず」ではなく、「こんな未来もありうる」と返すこと。/u, 'Do not restore the superseded depth introduction');
assert.doesNotMatch(plainCopy, /選んだ記憶は記録へと戻り、新たな問いの素材になる。|だが、過去の選択を、未来の義務にはしない。/u, 'Keep the requested closing paragraph deleted');
assert.doesNotMatch(plainCopy, /自己情報を複数のAIが解釈し、神託を本人の選択へ返す、構想上の循環。|記録は次の応答の素材となり、本人の選択を拘束する規則にはしない。/u, 'Delete the explanation beneath the diagram but keep its color legend');
assert.doesNotMatch(plainCopy, /ただし、これは過去を振り返るための材料にすぎず、|あなたの限界や可能性/u, 'Keep the removed qualification out of the complete-self-information description');
const footer = html.slice(html.indexOf('<footer class="site-footer'), html.indexOf('</footer>'));
for (const copy of ["work-disclaimer", "個人による", "ZEN大学", "制作・監修・公認", "フィクション"]) assert(footer.includes(copy), `Keep the final disclaimer complete: ${copy}`);
for (const copy of ['author-colophon', '作者：ひなひな', 'ZEN大学 知能情報社会学部1期生。', '映像制作と', 'https://note.com/hinahina_vr/n/nd03dec22e46a', conceptEditorialCopy.footerBrand]) assert(footer.includes(copy), `Keep the concise author colophon and footer brand: ${copy}`);
assert.doesNotMatch(footer, /法学部|SIer|社内AI導入|BMS|GAIA SENSEWARE/u, 'Remove the specified career sentence and BMS; use the requested footer brand');
assert(plainCopy.includes(conceptEditorialCopy.mechanismTitle), 'Use the requested initial-notes heading');
assert(plainCopy.includes(conceptEditorialCopy.storyExperienceDetail), 'Use the shortened story-experience sentence');
assert(html.includes(`<a href="#mechanism">${conceptEditorialCopy.mechanismNav}</a>`), 'Rename the navigation while preserving its destination');
assert.match(html, /選択肢のない一本道のビジュアルノベル/u);
await import("../novel-story-data.js");
const storySteps = globalThis.GAIA_NOVEL_STORY.scenes.flatMap(scene => scene.steps);
assert.equal(storySteps.length, 380);
assert.equal(storySteps.filter(step => step.type === "choice" || step.choices || step.options).length, 0, "Description follows the current linear scenario");
assert.match(fs.readFileSync(path.join(root, "novel-background-cues.js"), "utf8"), /event-cg-circle-welcome-v2\.png/u, "The retained game illustration must be used by the current story");
const narrativeOrder = ["top", "first-world", "learning", "surface", "depth", "mechanism"];
for (let i = 0; i < narrativeOrder.length; i++) {
  const at = html.indexOf(`id="${narrativeOrder[i]}"`);
  assert(at >= 0, `Missing narrative section: ${narrativeOrder[i]}`);
  if (i) assert(at > html.indexOf(`id="${narrativeOrder[i - 1]}"`), "Reading order must descend from the work into its underlying concept");
}
assert.doesNotMatch(html.slice(html.indexOf('<main id="main">'), html.indexOf('id="surface"')), /神話製作機械/u, "Explain the work before naming the deeper system");
assert.doesNotMatch(js, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/u, "Concept reader must not collect or send personal records");
assert.doesNotMatch(html, /<(?:form|iframe)\b/iu);
const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, "Element IDs must be unique");
const allowedReferences = new Set([
  "https://sphere.blue/",
  "https://syllabus.zen.ac.jp/subjects/2026/INF-2-C1-1030-014",
  "https://note.com/hinahina_vr/n/nd03dec22e46a",
  ...["SOC-1-C1-0204-004", "HUM-2-C1-1030-003", "HUM-1-C1-1030-002", "INF-1-C1-1030-007"].map(code => `https://syllabus.zen.ac.jp/subjects/2026/${code}`),
]);
for (const [attribute, reference] of html.matchAll(/\b(?:src|href)="([^"]+)"/gu)) {
  if (reference.startsWith("data:")) continue;
  if (/^https?:/u.test(reference)) {
    assert(attribute.startsWith("href=") && allowedReferences.has(reference), `Only verified primary sources may link outside: ${reference}`);
    continue;
  }
  if (reference.startsWith("#")) assert(ids.includes(reference.slice(1)), `Missing anchor: ${reference}`);
  else assert(fs.existsSync(path.resolve(root, "concept", reference.split("?")[0])), `Missing asset: ${reference}`);
}
const entryHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(entryHtml, /<nav class="gaia-opening-about"[^>]*>\s*<a id="gaia-opening-concept" href="\.\/concept\/" target="_blank" rel="noopener noreferrer">このサイトについて<\/a>/u, "The title's about link opens the concept reader safely in a new tab");
assert.equal([...entryHtml.matchAll(/href="\.\/concept\/"/gu)].length, 2, "Keep the title entry and the requested end-of-character-page introduction");
assert.match(entryHtml, /id="character-book-concept-link" href="\.\/concept\/"/u);
assert.doesNotMatch(entryHtml, /myth-machine-|concept\.css|concept\.js/u, "The title and character entry must not preload concept assets");
assert.doesNotMatch(fs.readFileSync(path.join(root, "gaia-mode-loader.js"), "utf8"), /(?:["'/])concept\/|myth-machine-|concept\.css|concept\.js/u, "Mode loading must not preload concept assets");
console.log(JSON.stringify({ status: "passed", courseTitles, checks: ["actual mode screenshots", "game art only in 03", "staff-roll course names", "work/learning/underlying concept order", "illustrated brochure overview", "three captioned experience panels", "editorial work overview", "no repeated opening", "local ImageGen diagrams", "ten requested blocks removed", "anchors", "six component definitions and the original person", "author's original non-deterministic oracle/choice cycle", "no release announcements or unread-book attribution", "concept versus implemented story", "no personal-data APIs", "title and character-page links without concept asset preloading"] }));
