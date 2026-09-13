import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readApprovedStoryScript } from "./approved-story-script.mjs";
import { applyReadingBreaks, readingBreakRevisionId } from "../story/reading-breaks-20260911.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "true-end-data.js");
const checkOnly = process.argv.includes("--check");
const speakerForLabel = Object.freeze({
  AIVA: "system",
  "???": "lou",
  ルウ: "lou",
  あめ: "amane",
  みず: "mizuha",
  saku: "sakuya",
  プレイヤー: "visitor",
  "—": null,
});

const approved = readApprovedStoryScript();
const runtimeIds = new Set();
const scenes = approved.trueEndScenes.map((scene) => ({
  id: scene.id,
  number: scene.number,
  title: scene.title,
  backdrop: scene.backdrop,
  steps: scene.entries.map((entry) => {
    const runtimeId = entry.metadata?.runtimeStepId;
    if (typeof runtimeId !== "string" || !runtimeId.startsWith(`beyond_${scene.number}_`) || runtimeIds.has(runtimeId)) {
      throw new Error(`${entry.id}: シーンに対応する一意のruntimeStepIdを指定してください`);
    }
    runtimeIds.add(runtimeId);
    const speaker = speakerForLabel[entry.speakerLabel];
    if (speaker === undefined) throw new Error(`${entry.id}: 未対応のAPEIRONCENE話者です（${entry.speakerLabel}）`);
    const pages = entry.metadata?.pages;
    if (pages !== undefined && (
      !Array.isArray(pages)
      || pages.length < 2
      || pages.some((page) => typeof page !== "string" || !page)
      || pages.join("") !== entry.text
    )) {
      throw new Error(`${entry.id}: pagesは本文を欠落なく分けた2ページ以上の文字列配列にしてください`);
    }
    return {
      id: runtimeId,
      ...(speaker ? { speaker } : {}),
      ...(entry.speakerLabel === "???" ? { speakerLabel: entry.speakerLabel } : {}),
      text: entry.text,
      ...(entry.readout ? { readout: entry.readout } : {}),
      ...Object.fromEntries(Object.entries(entry.metadata || {}).filter(([key]) => key !== "runtimeStepId")),
    };
  }),
}));

const story = {
  storyVersion: "true-end-beyond-log-20260909",
  approvedSourceSha256: approved.sha256,
  title: "APEIRONCENE",
  subtitle: "惑星の放課後 / GAIA SENSATION — APEIRONCENE",
  language: {
    id: "saeliva",
    name: "SÆLIVA",
    nativeName: "SÆL·IVA",
    japaneseName: "セイリヴァ",
    htmlLang: "art-x-saeliva",
  },
  elapsed: "2,704,118 HARA",
  scenes: applyReadingBreaks(scenes),
  readingBreakRevisionId,
  finale: {
    label: "星々の放課後",
    title: "APEIRONCENE",
    readout: [
      "DÆM UL: ESHA·GEMA",
      "IVARA KERA: K 2.700",
      "SÆL·ORAI: 2,641,903 NETH",
      "ESHA SÆL·TIR: KAR·EN",
      "NÆI MIR: REA·AI",
    ],
  },
};

const serialized = JSON.stringify(story, null, 2);
const output = `// Generated from story/APPROVED_SCRIPT_2026-08-24.md by scripts/build-true-end-story.mjs. Do not edit by hand.\n(() => {\n  "use strict";\n\n  const freezeScene = (scene) => Object.freeze({\n    ...scene,\n    steps: Object.freeze(scene.steps.map((step, index) => Object.freeze({\n      ...step,\n      id: step.id || \`beyond_\${scene.number}_\${String(index + 1).padStart(3, "0")}\`,\n      sceneId: scene.id,\n      sceneTitle: scene.title,\n      type: "beyond",\n      recordType: "BEYOND",\n      ...(step.speaker === "system" ? { speakerLabel: "AIVA" } : {}),\n    }))),\n  });\n\n  const source = ${serialized};\n  globalThis.GAIA_TRUE_END_STORY = Object.freeze({\n    ...source,\n    language: Object.freeze(source.language),\n    scenes: Object.freeze(source.scenes.map(freezeScene)),\n    finale: Object.freeze({\n      ...source.finale,\n      readout: Object.freeze(source.finale.readout),\n    }),\n  });\n})();\n`;

if (checkOnly) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8").replace(/\r\n?/gu, "\n") !== output) {
    throw new Error("true-end-data.jsが承認済み台本と一致しません。npm run data:novelを実行してください");
  }
  console.log(`approved true-end story ok: ${scenes.length} scenes / ${scenes.flatMap((scene) => scene.steps).length} messages`);
} else {
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`wrote ${path.relative(projectRoot, outputPath)} (${scenes.length} scenes, ${scenes.flatMap((scene) => scene.steps).length} messages)`);
}
