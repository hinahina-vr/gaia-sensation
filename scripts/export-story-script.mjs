import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(process.argv[2] || ".");
const novelPath = path.join(repoRoot, "novel-mode.js");
const gxPath = path.join(repoRoot, "gx-mode.js");
const outputPath = path.join(repoRoot, "docs", "GAIA_SENSEWARE_STORY_SCRIPT.txt");

const extractArrayLiteral = (source, declaration) => {
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex < 0) throw new Error(`Missing declaration: ${declaration}`);

  const arrayStart = source.indexOf("[", declarationIndex + declaration.length);
  if (arrayStart < 0) throw new Error(`Missing array for: ${declaration}`);

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = arrayStart; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(arrayStart, index + 1);
    }
  }

  throw new Error(`Unclosed array for: ${declaration}`);
};

const evaluateArray = (source, declaration) => vm.runInNewContext(
  `(${extractArrayLiteral(source, declaration)})`,
  Object.create(null),
  { timeout: 1000 },
);

const speakerNames = {
  narrator: "観測記録",
  minamo: "ミズハ",
  sora: "アマネ",
  sakuya: "サクヤの記録",
  earth: "地球",
};

const gxChapterTitles = [
  "THE FIRST GX｜水の記憶",
  "THE SECOND GX｜最初の生命",
  "THE THIRD GX｜酸素と鉄",
  "THE FOURTH GX｜炭素の時間",
  "THE FIFTH GX｜境界の日",
  "THE SIXTH GX｜気候の記録",
  "THE SEVENTH GX｜人間の地層",
  "THE UNWRITTEN GX｜未完の未来",
];

const branchTitles = {
  gap_source: "分岐A｜空白を残す",
  gap_derived: "分岐B｜推定だと表示して補う",
  after_gap: "分岐合流｜4.8秒のあと",
  END_SOURCE: "ENDING A｜空白を守り、観測を続ける",
  END_DERIVED: "ENDING B｜想像に印をつけ、語り継ぐ",
  END_SCENARIO: "ENDING C｜2050年の誰かへ約束を残す",
};

const divider = "────────────────────────────────────────";
const section = (title) => ["", divider, `【${title}】`, divider, ""];

const novelSource = await readFile(novelPath, "utf8");
const gxSource = await readFile(gxPath, "utf8");
const story = evaluateArray(novelSource, "const STORY =");
const gxConversations = evaluateArray(gxSource, "const STORY_CONVERSATIONS =");

const output = [
  "GAIA SENSEWARE GX",
  "文字だけのストーリー台本",
  "",
  "『空白のところで、地球は待っている』",
  "",
  "登場人物",
  "ミズハ：生態・身体・感覚を担当。知識多めで、観測の能書きを上品に語る。",
  "アマネ：社会・技術・システムを担当。少し気だるく、長い説明を短い問いへ畳む。",
  "サクヤ：文化・記憶を担当。不在のまま、記録と4.8秒の空白を残す。",
  "あなた：観客。物語の途中から観測と選択へ参加する。",
  "",
  "表記",
  "SOURCE＝観測・記録されたもの",
  "DERIVED＝計算・補完・解釈によるもの",
  "SCENARIO＝選択によって作る仮想状態",
];

for (const step of story) {
  if (step.type === "chapter") {
    output.push(...section(`${step.chapter}｜${step.title}`));
    if (step.location) output.push(`（${step.location}）`, "");
    continue;
  }

  if (step.type === "line") {
    const speaker = speakerNames[step.speaker] || step.speaker || "観測記録";
    const metadata = [step.kind, step.signal].filter(Boolean).join("｜");
    if (metadata) output.push(`［${metadata}］`);
    output.push(`${speaker}：`, step.text, "");
    continue;
  }

  if (step.type === "gx") {
    output.push(...section("THE FIRST GX｜インタラクティブ展示中の会話"));
    gxConversations.forEach((conversation, index) => {
      output.push(`＜${gxChapterTitles[index] || `GX ${index + 1}`}＞`, "");
      conversation.forEach((line) => {
        output.push(`${speakerNames[line.speaker] || line.name || line.speaker}：`, line.text, "");
      });
    });
    continue;
  }

  if (step.type === "choice") {
    output.push(...section("観客の選択"));
    output.push(step.prompt, "");
    step.choices.forEach((choice, index) => {
      output.push(`${index + 1}. ${choice.text}`);
    });
    output.push("");
    continue;
  }

  if (step.type === "label") {
    output.push(...section(branchTitles[step.label] || step.label));
    continue;
  }

  if (step.type === "jump") {
    output.push(`→ ${branchTitles[step.target] || step.target}へ`, "");
    continue;
  }

  if (step.type === "end") {
    output.push(...section(`${step.kind} END｜${step.title}`));
    output.push(step.subtitle, "");
  }
}

output.push(divider, "— END OF SCRIPT —", divider, "");

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output.join("\n"), "utf8");
console.log(`Wrote ${path.relative(repoRoot, outputPath)} (${story.length} story steps, ${gxConversations.length} GX scenes)`);
