import { applyChapterNames } from "../story/chapter-names-20260912.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readApprovedStoryScript } from "./approved-story-script.mjs";
import { applyLogWording } from "../story/log-wording-20260912.js";
import { applyAfternoonClock, afternoonClockRevisionId } from "../story/afternoon-clock-20260911.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonPath = path.join(projectRoot, "story", "物語台本.md");
const characterCanonPath = path.join(projectRoot, "story", "CHARACTER_SETTINGS.md");
const retainedPath = path.join(projectRoot, "contest-limited", "story", "limited-feature-script.md");
const outputPath = path.join(projectRoot, "novel-story-data.js");
const revisionsPath = path.join(projectRoot, "story", "observation-log-revisions-20260822.js");
const EXPECTED_SOURCE_SHA256 = "27db292fbcfd2fc5130c9dcef8f33532ee0956abb559729347aa055dc5cd6b0c";
const LEGACY_STEP_ID_GAPS = Object.freeze({
  gx_experience: Object.freeze({ after: 44, size: 10 }),
});

const sourceBytes = fs.readFileSync(canonPath);
const characterSourceBytes = fs.readFileSync(characterCanonPath);
const retainedBytes = fs.readFileSync(retainedPath);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const normalizeTextBytes = (bytes) => Buffer.from(bytes.toString("utf8").replace(/\r\n?/gu, "\n"), "utf8");
if (sha256(sourceBytes) !== EXPECTED_SOURCE_SHA256) throw new Error("story/物語台本.mdがfreeze入力と一致しません");
if (!normalizeTextBytes(sourceBytes).equals(normalizeTextBytes(retainedBytes))) throw new Error("repo保持版の機能限定版台本が正本と一致しません");
const characterSource = characterSourceBytes.toString("utf8");
const characters = Object.freeze({
  amane: Object.freeze({ formalName: "雨音", reading: "アマネ", campusName: "あめ" }),
  mizuha: Object.freeze({ formalName: "瑞葉", reading: "ミズハ", campusName: "みず" }),
  sakuya: Object.freeze({ formalName: "咲弥", reading: "サクヤ", campusName: "saku" }),
});
for (const profile of Object.values(characters)) {
  if (!characterSource.includes(`【${profile.formalName}（${profile.reading}）】`)) {
    throw new Error(`story/CHARACTER_SETTINGS.mdに正式名 ${profile.formalName}（${profile.reading}）がありません`);
  }
}
const source = sourceBytes.toString("utf8").replace(/\r\n?/gu, "\n");
if (Buffer.from(source, "utf8").length !== sourceBytes.length) throw new Error("正本はUTF-8/LFである必要があります");
const { default: observationLogRevisions } = await import(`${pathToFileURL(revisionsPath).href}?build=${Date.now()}`);
const appliedRevisionIds = new Set();

const EXPECTED_SCENE_IDS = Object.freeze([
  "festival_concept",
  "map_mode01",
  "gx_experience",
  "esp32_pitch",
  "circle_invitation",
  "welcome_chat",
]);

const INTERACTION_CONFIG = Object.freeze({
  map_mode01: Object.freeze({
    kind: "map01",
    modeIndex: 0,
    modeId: "breathing-earth",
    requiredViews: Object.freeze(["timeline_complete"]),
    afterText: "「こちらがMODE 01です。1958年から2050年まで、地球の変化を続けて見てください」",
  }),
  gx_experience: Object.freeze({
    kind: "gx",
    requiredGestures: 3,
    afterText: "「ええ。いまの海や大気とは、まったく違う地球まで戻りますの」",
  }),
});

const INLINE_INTERACTION_CONFIG = Object.freeze({
  "map_mode01:気温偏差を重ねる": Object.freeze({
    kind: "map01",
    modeIndex: 0,
    modeId: "breathing-earth",
    phase: "temperature-anomaly",
    requiredViews: Object.freeze(["long_term", "temperature_anomaly"]),
  }),
});

const speakerMap = new Map([
  ["ミズハ", "mizuha"],
  ["アマネ", "amane"],
  ["プレイヤー", "visitor"],
]);
const speakerLabelMap = new Map([
  ["ミズハ", "みず"],
  ["アマネ", "あめ"],
  ["プレイヤー", "プレイヤー"],
]);
const chatSpeakerMap = new Map([
  ["MIZUHA", "mizuha"],
  ["AMANE", "amane"],
  ["saku", "sakuya"],
  ["YOU", "visitor"],
  ["青猫", "visitor"],
  ["SYSTEM", "system"],
]);
const chatSpeakerLabelMap = new Map([
  ["MIZUHA", "みず"],
  ["AMANE", "あめ"],
  ["saku", "saku"],
  ["YOU", "YOU"],
  ["青猫", "青猫"],
  ["SYSTEM", "SYSTEM"],
]);

const parseBlock = (block, sceneId) => {
  const dialogue = block.match(/^(ミズハ|アマネ|プレイヤー)：\n([\s\S]+)$/u);
  if (dialogue) {
    const [rawSpeaker, text] = dialogue.slice(1);
    const speakerLabel = rawSpeaker === "アマネ" && /私は[『「]あめ[』」]|体験してみませんか/u.test(text)
      ? "女の子"
      : rawSpeaker === "ミズハ" && /「みず」と申します。/u.test(text)
        ? "もう一人の女の子"
        : speakerLabelMap.get(rawSpeaker);
    return { type: "dialogue", speaker: speakerMap.get(rawSpeaker), speakerLabel, text };
  }

  const chat = block.match(/^(\d{2}:\d{2})  (MIZUHA|AMANE|saku|YOU|青猫|SYSTEM)\n([\s\S]+)$/u);
  if (chat) {
    return {
      type: "chat",
      time: chat[1],
      speaker: chatSpeakerMap.get(chat[2]),
      speakerLabel: chatSpeakerLabelMap.get(chat[2]),
      text: chat[3],
    };
  }

  const cue = block.match(/^［([^｜\]]+)｜([^\]]+)］(?:\n([\s\S]+))?$/u);
  if (cue) {
    const [, marker, text, body = ""] = cue;
    if (marker === "選択") {
      throw new Error(`${sceneId}: 展開へ影響しない選択画面は短尺本編へ追加できません`);
    }
    if (marker === "操作") {
      const interaction = INLINE_INTERACTION_CONFIG[`${sceneId}:${text}`];
      if (!interaction || body.trim()) throw new Error(`${sceneId}: 未定義または本文付きの操作です（${text}）`);
      return { type: "interaction", text: "", interaction };
    }
    if (marker === "学内チャット") return { type: "chatSurface", text };
    return { type: "ui", text: `${marker}｜${text}` };
  }

  return { type: "narration", speaker: "narrator", text: block };
};

const sceneHeading = /^## SCENE (\d+)｜(.+)$/gmu;
const matches = [...source.matchAll(sceneHeading)];
if (matches.length !== EXPECTED_SCENE_IDS.length) throw new Error("freeze正本には6sceneが必要です");

let scenes = matches.map((match, index) => {
  const start = match.index + match[0].length;
  const end = matches[index + 1]?.index ?? source.length;
  let body = source.slice(start, end).trim();
  const metaMatch = body.match(/^<!-- scene-meta\n([\s\S]*?)\n-->\n*/u);
  if (!metaMatch) throw new Error(`${match[0]}: scene-metaがありません`);
  const meta = JSON.parse(metaMatch[1]);
  if (meta.id !== EXPECTED_SCENE_IDS[index]) throw new Error(`${match[0]}: scene idがfreeze順と一致しません`);
  if (typeof meta.date !== "string" || !meta.date.trim()) throw new Error(`${meta.id}: dateがありません`);
  if (!/^(?:AM|PM)\s/u.test(meta.time || "")) throw new Error(`${meta.id}: timeはAM/PM表記が必要です`);
  body = body.slice(metaMatch[0].length).replace(/\n---\s*$/u, "").trim();
  const blocks = body.split(/\n{2,}/u).map((block) => block.trim()).filter(Boolean);
  const steps = [];
  let stepNumber = 0;
  const pushStep = (step) => {
    stepNumber += 1;
    const legacyGap = LEGACY_STEP_ID_GAPS[meta.id];
    if (legacyGap && stepNumber === legacyGap.after + 1) stepNumber += legacyGap.size;
    const id = `${meta.id}_${String(stepNumber).padStart(3, "0")}`;
    const revision = observationLogRevisions[id];
    if (revision) appliedRevisionIds.add(id);
    steps.push({ id, sceneId: meta.id, ...step, ...(revision || {}) });
  };
  const interaction = INTERACTION_CONFIG[meta.id] || null;
  for (const block of blocks) {
    const step = parseBlock(block, meta.id);
    pushStep(step);
    if (interaction && step.text === interaction.afterText) {
      const { afterText, ...interactionMetadata } = interaction;
      pushStep({ type: "interaction", text: "", interaction: interactionMetadata });
    }
  }
  const inlineInteractionCount = blocks.filter((block) => /^［操作｜/u.test(block)).length;
  const expectedInteractionCount = (interaction ? 1 : 0) + inlineInteractionCount;
  if (steps.filter((step) => step.type === "interaction").length !== expectedInteractionCount) {
    throw new Error(`${meta.id}: interactionはexact${expectedInteractionCount}件必要です`);
  }
  return {
    id: meta.id,
    number: Number(match[1]),
    title: match[2],
    chapter: meta.chapter,
    duration: meta.duration,
    date: meta.date,
    time: meta.time,
    location: meta.location,
    modeIndex: 0,
    ...(interaction ? { interaction: Object.fromEntries(Object.entries(interaction).filter(([key]) => key !== "afterText")) } : {}),
    temporal: {
      temporalContext: "CURRENT",
      timePrecision: "MINUTE",
      displayTitle: `${meta.date} ${meta.time}｜${meta.location}`,
      date: meta.date,
      time: meta.time,
      duration: meta.duration,
      location: meta.location,
    },
    steps,
  };
});

const unusedRevisionIds = Object.keys(observationLogRevisions).filter((id) => !appliedRevisionIds.has(id));
if (unusedRevisionIds.length > 0) throw new Error(`未適用のOBSERVATION LOG修正があります: ${unusedRevisionIds.join(", ")}`);

const approvedScript = readApprovedStoryScript();
const approvedSceneMap = new Map(approvedScript.mainScenes.map((scene) => [scene.id, scene]));
const baseStepMap = new Map(scenes.flatMap((scene) => scene.steps).map((step) => [step.id, step]));
const endingStep = baseStepMap.get("welcome_chat_095");
const speakerForLabel = Object.freeze({
  "女の子": "amane",
  "もう一人の女の子": "mizuha",
  あめ: "amane",
  みず: "mizuha",
  プレイヤー: "visitor",
  青猫: "visitor",
  saku: "sakuya",
  SYSTEM: "system",
  "—": null,
  地の文: "narrator",
});
const typeForKind = Object.freeze({
  地の文: "narration",
  会話: "dialogue",
  学内チャット: "chat",
  チャット画面: "chatSurface",
  操作: "interaction",
  転換: "transition",
});
const approvedMissingBaseIds = [];
for (const scene of scenes) {
  const approvedScene = approvedSceneMap.get(scene.id);
  if (!approvedScene) throw new Error(`${scene.id}: 承認済み本編シーンがありません`);
  Object.assign(scene, {
    chapter: approvedScene.chapter,
    date: approvedScene.date,
    time: approvedScene.time,
    location: approvedScene.location,
    temporal: {
      ...scene.temporal,
      displayTitle: `${approvedScene.date} ${approvedScene.time}｜${approvedScene.location}`,
      date: approvedScene.date,
      time: approvedScene.time,
      location: approvedScene.location,
    },
  });
  scene.steps = approvedScene.entries.map((entry) => {
    const base = baseStepMap.get(entry.id);
    if (!base) approvedMissingBaseIds.push(entry.id);
    const type = typeForKind[entry.kind];
    if (!type) throw new Error(`${entry.id}: 未対応の本編種別です（${entry.kind}）`);
    const speaker = speakerForLabel[entry.speakerLabel];
    if (speaker === undefined) throw new Error(`${entry.id}: 未対応の話者です（${entry.speakerLabel}）`);
    const step = {
      ...(base || {}),
      id: entry.id,
      sceneId: scene.id,
      type,
      text: type === "interaction" ? "" : entry.text,
      ...(speaker ? { speaker } : {}),
      ...(type === "dialogue" || type === "chat" ? { speakerLabel: entry.speakerLabel } : {}),
      ...(entry.time ? { time: entry.time } : {}),
      ...(entry.metadata || {}),
    };
    if (type === "narration") {
      step.speaker = "narrator";
      delete step.speakerLabel;
    }
    return step;
  });
}
const expectedInjectedIds = new Set(Array.from({ length: 9 }, (_, index) => `esp32_pitch_016${String.fromCharCode(97 + index)}`));
const unexpectedApprovedIds = approvedMissingBaseIds.filter((id) => !expectedInjectedIds.has(id) && !/_new_\d{3}$/u.test(id));
if (unexpectedApprovedIds.length > 0) {
  throw new Error(`承認済み本編の新規IDが想定外です: ${unexpectedApprovedIds.join(", ")}`);
}
if (!endingStep) throw new Error("スタッフロール接続ステップ welcome_chat_095 がありません");
const welcomeScene = scenes.find((scene) => scene.id === "welcome_chat");
if (!welcomeScene.steps.some((step) => step.id === endingStep.id)) welcomeScene.steps.push(endingStep);

scenes = applyChapterNames(applyLogWording(applyAfternoonClock(scenes)));
scenes.forEach((scene, index) => { scene.nextSceneId = scenes[index + 1]?.id || null; });
const sceneOrder = scenes.map((scene) => scene.id);
const story = {
  storyVersion: 13,
  title: "惑星の放課後",
  systemTitle: "GAIA SENSEWARE",
  subtitle: "GAIA SENSATION",
  estimatedDuration: "10〜12分",
  sourceSha256: EXPECTED_SOURCE_SHA256,
  revisionId: "observation-log-20260909",
  clockRevisionId: afternoonClockRevisionId,
  approvedSourceSha256: approvedScript.sha256,
  characterSourceSha256: sha256(characterSourceBytes),
  characters,
  startSceneId: "festival_concept",
  temporal: {
    schemaVersion: 2,
    calendar: "GREGORIAN",
    timeZone: "Asia/Tokyo",
    clockPolicy: "AUTHOR_FIXED",
    missingMetadataPolicy: "ERROR",
    sceneOrder,
    archives: [],
  },
  saveFields: ["storyVersion", "stepId", "reachedSceneIds", "viewed", "evesRoute", "observationOrder", "editorialChoice", "reflectionIds", "resultTone", "demoInterest", "audio", "readStepIds", "clear", "archivesUnlocked", "sessionId"],
  requiredSceneIds: sceneOrder,
  requiredInteractions: ["map01", "gx"],
  finalResults: [],
  resultCopy: {},
  generationDetails: {},
  scenes,
};

const banner = "// Generated from story/APPROVED_SCRIPT_2026-08-24.md by scripts/build-novel-story.mjs. Do not edit by hand.\n";
const output = `${banner}globalThis.GAIA_NOVEL_STORY = Object.freeze(${JSON.stringify(story, null, 2)});\nglobalThis.GAIA_NOVEL_STORY_V6 = globalThis.GAIA_NOVEL_STORY;\n`;
fs.writeFileSync(outputPath, output, "utf8");
console.log(`wrote ${path.relative(projectRoot, outputPath)} (${scenes.length} scenes, ${scenes.flatMap((scene) => scene.steps).length} steps)`);
