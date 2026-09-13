import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "story", "現行統合台本.md");
const checkOnly = process.argv.includes("--check");

await import("../novel-story-data.js");
await import("../true-end-data.js");
const { default: observationLogRevisions } = await import("../story/observation-log-revisions-20260822.js");

const story = globalThis.GAIA_NOVEL_STORY;
const trueEnd = globalThis.GAIA_TRUE_END_STORY;
if (!story || !trueEnd) throw new Error("現行本編またはAPEIRONCENE台本を読み込めませんでした");

const staffRoll = Object.freeze({
  triggerStepId: "welcome_chat_095",
  kicker: "STAFF & CREDITS",
  title: "惑星の放課後",
  subtitle: "GAIA SENSATION",
  credits: Object.freeze([
    Object.freeze({ role: "企画・原案", department: "ORIGINAL CONCEPT & PLANNING", names: ["ひなひな"] }),
    Object.freeze({ role: "総合調整", department: "THE ARCHITECT", names: ["ひなひな"] }),
    Object.freeze({ role: "脚本", department: "SCENARIO", names: ["ひなひな"] }),
    Object.freeze({ role: "キャラクター原案", department: "CHARACTER CONCEPT", names: ["ひなひな"] }),
    Object.freeze({ role: "アートディレクター", department: "ART DIRECTOR", names: ["ひなひな"] }),
    Object.freeze({ role: "テクニカルディレクター", department: "TECHNICAL DIRECTOR", names: ["ひなひな"] }),
    Object.freeze({
      role: "アシスタント",
      department: "ASSISTANT",
      names: [
        "OpenAI Codex (Code Implementation)",
        "OpenAI ImageGen (Visual Assets)",
        "Suno AI (Music Composition)",
      ],
    }),
    Object.freeze({
      role: "音楽",
      department: "MUSIC",
      names: [
        "オープニングテーマ『Planet Forecast - Hope』",
        "エンディングテーマ『AfterSchool, AfterGlow』",
      ],
    }),
    Object.freeze({
      role: "学術的着想",
      department: "ACADEMIC INSPIRATION",
      names: [
        "ZEN大学『共創地球論』",
        "ZEN大学『人新世の人類学』",
        "ZEN大学『リテラシーと応用のための物語理論』",
        "ZEN大学『統計学入門』",
        "ZEN大学『ビッグデータ分析概論』",
      ],
    }),
    Object.freeze({ role: "観測データ", department: "DATA SOURCES", names: ["NASA / NOAA / JAXA", "FAO / World Bank / Open-Meteo", "気象庁 / 環境省 / 総務省  ほか"] }),
  ]),
  closingLead: "その選択の中に、今日から私たちもいる。",
  closingLine: "物語は、ここからも続いていく。",
  copyright: "© 2026 惑星の放課後 / GAIA SENSATION",
  thanks: "Thank you for playing",
  continueLabel: "世界の続きを紡ぐ",
  skipLabel: "スキップ▶",
});

const novelModeSource = fs.readFileSync(path.join(projectRoot, "novel-mode.js"), "utf8");
const staffRollCreditSourceLiterals = staffRoll.credits.flatMap(({ role, department, names }) => [
  role,
  department,
  ...names.flatMap((name) => {
    const theme = name.match(/^(.+?テーマ)(『.+』)$/u);
    return theme ? [theme[1], theme[2]] : [name];
  }),
]);
const requiredStaffRollLiterals = [
  staffRoll.triggerStepId,
  staffRoll.kicker,
  staffRoll.title,
  staffRoll.subtitle,
  staffRoll.closingLead,
  staffRoll.closingLine,
  staffRoll.copyright,
  staffRoll.thanks,
  staffRoll.continueLabel,
  ...staffRollCreditSourceLiterals,
];
for (const literal of requiredStaffRollLiterals) {
  if (!novelModeSource.includes(literal)) throw new Error(`スタッフロールの現行実装から「${literal}」を確認できません`);
}
if (!/step\.id === "welcome_chat_095"\) return renderStaffRoll\(step\)/u.test(novelModeSource)) {
  throw new Error("本編最終行からスタッフロールへの接続を確認できません");
}

const typeLabels = Object.freeze({
  narration: "地の文",
  dialogue: "会話",
  chat: "学内チャット",
  chatSurface: "チャット画面",
  ui: "画面演出",
  interaction: "操作",
  record: "記録",
  transition: "転換",
  beyond: "APEIRONCENE",
});
const speakerNames = Object.freeze({
  narrator: "地の文",
  mizuha: "みず",
  amane: "あめ",
  sakuya: "saku",
  visitor: "プレイヤー",
  lou: "ルウ",
  system: "AIVA",
});
const blockquote = (text) => String(text || "（本文なし）")
  .split("\n")
  .map((line) => `> ${line || " "}`)
  .join("\n");
const inlineJson = (value) => JSON.stringify(value).replaceAll("`", "\\`");
const describeStep = (step, { trueEndStep = false } = {}) => {
  const label = typeLabels[step.type] || step.type;
  const speaker = step.speakerLabel || speakerNames[step.speaker] || step.speaker || "—";
  const lines = [`#### ${step.id}｜${label}｜${speaker}`, "", blockquote(step.text), ""];
  if (step.time) lines.push(`- 時刻: ${step.time}`, "");
  if (step.readout?.length) lines.push(`- データ表示: ${step.readout.map((entry) => `\`${entry}\``).join(" / ")}`, "");
  const ignoredKeys = new Set(["id", "sceneId", "sceneTitle", "type", "speaker", "speakerLabel", "text", "time", "readout", "recordType"]);
  const metadata = Object.fromEntries(Object.entries(step).filter(([key]) => !ignoredKeys.has(key)));
  if (Object.keys(metadata).length) lines.push(`- 演出メタ: \`${inlineJson(metadata)}\``, "");
  if (trueEndStep && step.recordType !== "BEYOND") throw new Error(`${step.id}: APEIRONCENEのrecordTypeが不正です`);
  return lines.join("\n").trimEnd();
};

const mainStepCount = story.scenes.reduce((count, scene) => count + scene.steps.length, 0);
const trueEndStepCount = trueEnd.scenes.reduce((count, scene) => count + scene.steps.length, 0);
const revisionCount = Object.keys(observationLogRevisions).length;
const lines = [
  "# 『惑星の放課後 ～GAIA SENSATION～』現行統合台本",
  "",
  "> ブラッシュアップ確認用の正本です。現在の実行データから自動生成しているため、旧MDだけでは見えなかった差し替え後の本編、スタッフロール、APEIRONCENEを一冊で確認できます。",
  "",
  "## この台本の使い方",
  "",
  "- 修正指示では、各見出しの安定ID（例: `festival_concept_021`、`beyond_01_001`）を指定してください。",
  "- 本ファイルへ直接書いた案は、実行ソースへ反映して再生成するまで製品表示には入りません。未反映のままなら `npm run check` が差分を検出します。",
  "- 旧 `story/物語台本.md` と `contest-limited/story/limited-feature-script.md` は本編の凍結入力であり、単独では現行表示を表しません。",
  "- 管理構造の詳細は `story/README.md` を参照してください。",
  "",
  "## 現行スナップショット",
  "",
  `- 本編: ${story.scenes.length}シーン / ${mainStepCount}ステップ`,
  `- OBSERVATION LOG差し替え: ${revisionCount}件（すべて適用後の本文を掲載）`,
  `- スタッフロール: ${staffRoll.credits.length}クレジット区分`,
  `- APEIRONCENE: ${trueEnd.scenes.length}シーン / ${trueEndStepCount}メッセージ`,
  `- 本編 storyVersion: \`${story.storyVersion}\``,
  `- APEIRONCENE storyVersion: \`${trueEnd.storyVersion}\``,
  "",
  "---",
  "",
  "# PART I｜本編",
  "",
];

for (const scene of story.scenes) {
  lines.push(
    `## SCENE ${String(scene.number).padStart(2, "0")}｜${scene.title}`,
    "",
    `- シーンID: \`${scene.id}\``,
    `- 章表示: ${scene.chapter}`,
    `- 日時: ${scene.date} ${scene.time}`,
    `- 場所: ${scene.location}`,
    `- 想定尺: ${scene.duration}`,
    `- ステップ数: ${scene.steps.length}`,
    "",
  );
  for (const step of scene.steps) lines.push(describeStep(step), "");
  lines.push("---", "");
}

lines.push(
  "# PART II｜スタッフロールと分岐",
  "",
  `- 発火条件: \`${staffRoll.triggerStepId}\`を表示すると、通常メッセージではなくスタッフロールへ接続`,
  `- 見出し: ${staffRoll.kicker} / ${staffRoll.title} / ${staffRoll.subtitle}`,
  `- 明示的な短絡操作: ${staffRoll.skipLabel} → データ画面`,
  `- 正規操作: ${staffRoll.continueLabel} → APEIRONCENE`,
  "",
  "## クレジット",
  "",
);
for (const credit of staffRoll.credits) {
  lines.push(`- **${credit.role}** / ${credit.department}: ${credit.names.join("、")}`);
}
lines.push(
  "",
  "## クロージング",
  "",
  blockquote(staffRoll.closingLead),
  "",
  blockquote(staffRoll.closingLine),
  "",
  `- ${staffRoll.copyright}`,
  `- ${staffRoll.thanks}`,
  `- 約6秒後に「${staffRoll.continueLabel}」へ切り替え`,
  "",
  "---",
  "",
  "# PART III｜APEIRONCENE",
  "",
  `- タイトル: ${trueEnd.title}`,
  `- サブタイトル: ${trueEnd.subtitle}`,
  `- 経過時間: ${trueEnd.elapsed}`,
  `- 統一言語: ${trueEnd.language.name}（${trueEnd.language.japaneseName}）`,
  "",
);

for (const scene of trueEnd.scenes) {
  lines.push(
    `## APEIRONCENE ${scene.number}｜${scene.title}`,
    "",
    `- シーンID: \`${scene.id}\``,
    `- 背景シグネチャ: \`${scene.backdrop}\``,
    `- メッセージ数: ${scene.steps.length}`,
    "",
  );
  for (const step of scene.steps) lines.push(describeStep(step, { trueEndStep: true }), "");
  lines.push("---", "");
}

const output = `${lines.join("\n").trimEnd()}\n`;
if (checkOnly) {
  if (!fs.existsSync(outputPath)) throw new Error("story/現行統合台本.mdがありません。npm run story:exportを実行してください");
  const current = fs.readFileSync(outputPath, "utf8").replace(/\r\n?/gu, "\n");
  if (current !== output) throw new Error("story/現行統合台本.mdが現行実行データと一致しません。実行ソースへ修正を反映後、npm run story:exportで再生成してください");
  console.log(`current story script ok: ${mainStepCount} main + ${trueEndStepCount} APEIRONCENE steps`);
} else {
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`wrote ${path.relative(projectRoot, outputPath)} (${mainStepCount} main + ${trueEndStepCount} APEIRONCENE steps)`);
}
