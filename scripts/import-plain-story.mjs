import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readApprovedStoryScript } from "./approved-story-script.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(projectRoot, "story", "APPROVED_SCRIPT_2026-08-24.md");
const rawCopyPath = path.join(projectRoot, "story", "USER_SCRIPT_2026-08-24.txt");
const checkOnly = process.argv.includes("--check");

if (!inputPath || !fs.existsSync(inputPath)) {
  throw new Error("usage: node scripts/import-plain-story.mjs <plain-script.txt> [output.md]");
}

let source = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n").trim();
const numberedScriptMarker = "# 『惑星の放課後 ～GAIA SENSATION～』改訂台本";
const numberedScriptStart = source.indexOf(numberedScriptMarker);
if (numberedScriptStart >= 0) source = source.slice(numberedScriptStart).trim();
const approved = readApprovedStoryScript();
const lines = source.split("\n");

const MAIN_HEADINGS = Object.freeze([
  Object.freeze({ marker: "01 / CONCEPT", id: "festival_concept" }),
  Object.freeze({ marker: "02 / MAP 01", id: "map_mode01" }),
  Object.freeze({ marker: "03 / DEEP TIME", id: "gx_experience" }),
  Object.freeze({ marker: "04 / PROPOSAL", id: "esp32_pitch" }),
  Object.freeze({ marker: "05 / AFTER SCHOOL", id: "circle_invitation" }),
  Object.freeze({ marker: "06 / WELCOME", id: "welcome_chat" }),
]);
const MAIN_SPEAKERS = new Set(["女の子", "もう一人の女の子", "あめ", "みず", "プレイヤー", "SYSTEM", "青猫", "saku"]);
const TRUE_END_SPEAKERS = new Set(["AIVA", "???", "ルウ", "あめ", "みず", "saku", "プレイヤー"]);

const indexOfLine = (value, from = 0) => {
  const index = lines.indexOf(value, from);
  if (index < 0) throw new Error(`台本の見出しまたは境界がありません: ${value}`);
  return index;
};

const trimBlankEdges = (values) => {
  let start = 0;
  let end = values.length;
  while (start < end && !values[start].trim()) start += 1;
  while (end > start && !values[end - 1].trim()) end -= 1;
  return values.slice(start, end);
};

const readRetainedStaffCredits = () => {
  if (fs.existsSync(rawCopyPath)) {
    const retainedLines = fs.readFileSync(rawCopyPath, "utf8").replace(/\r\n?/gu, "\n").split("\n");
    const start = retainedLines.indexOf("STAFF & CREDITS / 惑星の放課後 / GAIA SENSATION");
    const end = retainedLines.indexOf("APEIRONCENE", start + 1);
    if (start >= 0 && end >= 0) return retainedLines.slice(start, end).join("\n").trim();
  }
  if (!fs.existsSync(outputPath)) throw new Error("既存のスタッフロール入力がありません");
  const approvedLines = fs.readFileSync(outputPath, "utf8").replace(/\r\n?/gu, "\n").split("\n");
  const start = approvedLines.indexOf("## 提供台本の表示文");
  const end = approvedLines.indexOf("# PART III｜APEIRONCENE", start + 1);
  if (start < 0 || end < 0) throw new Error("既存のスタッフロール範囲を確認できません");
  return approvedLines
    .slice(start + 1, end)
    .filter((line) => line.startsWith(">"))
    .map((line) => line.replace(/^> ?/u, ""))
    .join("\n")
    .trim();
};

const numberedSpeakerMap = new Map([
  ["短髪の女性", "女の子"],
  ["長髪の女性", "もう一人の女の子"],
  ["あなた", "プレイヤー"],
]);
const numberedKindMap = new Map([
  ["narration", "地の文"],
  ["dialogue", "会話"],
  ["chat", "学内チャット"],
  ["chatSurface", "チャット画面"],
  ["interaction", "操作"],
  ["transition", "転換"],
  ["BEYOND", "APEIRONCENE"],
]);

const paginateWithoutDroppingText = (text, pageCount) => {
  const breakpoints = [];
  for (let index = 1; index < text.length; index += 1) {
    if (!/[。！？!?」』…\n]/u.test(text[index - 1])) continue;
    if (text[index - 1] === "…" && text[index] === "…") continue;
    const breakpoint = text[index] === "\n" ? index + 1 : index;
    if (breakpoints.at(-1) !== breakpoint) breakpoints.push(breakpoint);
  }
  const cuts = [0];
  for (let page = 1; page < pageCount; page += 1) {
    const minimum = cuts.at(-1) + 1;
    const maximum = text.length - (pageCount - page);
    const target = Math.round((text.length * page) / pageCount);
    const candidates = breakpoints.filter((index) => (
      index >= minimum
      && index <= maximum
      && text.slice(cuts.at(-1), index).trim()
      && text.slice(index).trim()
    ));
    const cut = candidates.length > 0
      ? candidates.reduce((best, index) => Math.abs(index - target) < Math.abs(best - target) ? index : best)
      : Math.max(minimum, Math.min(maximum, target));
    cuts.push(cut);
  }
  cuts.push(text.length);
  return cuts.slice(0, -1).map((start, index) => text.slice(start, cuts[index + 1]));
};

const parseNumberedEntries = (body, scene) => {
  const headings = [...body.matchAll(/^### (\d{3})\s*$/gmu)];
  const explicitIds = [...body.matchAll(/^\* ID:\s*([\w-]+)\s*$/gmu)].map((match) => match[1]);
  const hasExplicitIds = explicitIds.length > 0;
  if (hasExplicitIds && (explicitIds.length !== headings.length || new Set(explicitIds).size !== explicitIds.length)) {
    throw new Error(`${scene.id}: 安定IDは全項目に重複なく指定してください`);
  }
  if (!hasExplicitIds && headings.length !== scene.entries.length) {
    throw new Error(`${scene.id}: 番号付き台本の件数が一致しません（${headings.length} / ${scene.entries.length}）`);
  }
  return headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    const block = body.slice(start, end);
    const expectedNumber = String(index + 1).padStart(3, "0");
    if (heading[1] !== expectedNumber) throw new Error(`${scene.id}: 項目番号 ${heading[1]} が連番ではありません`);
    const speaker = block.match(/^\* 話者:\s*(.+?)\s*$/mu)?.[1];
    const sourceKind = block.match(/^\* 種別:\s*(.+?)\s*$/mu)?.[1];
    const text = block
      .split("\n")
      .filter((line) => line.startsWith(">"))
      .map((line) => line.replace(/^> ?/u, ""))
      .join("\n");
    if (!speaker || !sourceKind || !text) throw new Error(`${scene.id}:${heading[1]} の話者・種別・本文が不足しています`);
    const explicitId = block.match(/^\* ID:\s*([\w-]+)\s*$/mu)?.[1];
    const reference = hasExplicitIds
      ? scene.entries.find((entry) => entry.id === explicitId) || {}
      : scene.entries[index];
    const kind = numberedKindMap.get(sourceKind);
    if (!kind || (!hasExplicitIds && kind !== reference.kind)) {
      throw new Error(`${scene.id}:${heading[1]} の種別が現行構造と一致しません（${sourceKind} / ${reference.kind}）`);
    }
    const speakerLabel = ["操作", "チャット画面", "転換"].includes(kind) || (kind === "APEIRONCENE" && speaker === "地の文")
      ? "—"
      : numberedSpeakerMap.get(speaker) || speaker;
    if (!hasExplicitIds && kind !== "地の文" && speakerLabel !== reference.speakerLabel) {
      throw new Error(`${scene.id}:${heading[1]} の話者が現行構造と一致しません（${speakerLabel} / ${reference.speakerLabel}）`);
    }
    const authoredMetadata = block.match(/^\* 演出メタ:\s*(.+)$/mu)?.[1];
    const sourceMetadata = authoredMetadata ? JSON.parse(authoredMetadata) : reference.metadata;
    const existingPageCount = reference.text === text && Array.isArray(sourceMetadata?.pages) ? sourceMetadata.pages.length : 1;
    const automaticPageCount = kind === "APEIRONCENE"
      ? Math.max(1, Math.ceil(Array.from(text.replace(/\s/gu, "")).length / 52))
      : 1;
    const pageCount = Math.max(existingPageCount, automaticPageCount);
    const metadata = sourceMetadata || pageCount > 1
      ? {
        ...(sourceMetadata || {}),
        ...(pageCount > 1 ? { pages: paginateWithoutDroppingText(text, pageCount) } : {}),
      }
      : null;
    if (metadata && pageCount <= 1) delete metadata.pages;
    const time = block.match(/^\* 時刻:\s*(.+)$/mu)?.[1] || reference.time;
    const readoutJson = block.match(/^\* データ表示:\s*(.+)$/mu)?.[1];
    const readout = readoutJson ? JSON.parse(readoutJson) : reference.readout;
    if (kind === "操作" && (!reference.id || text !== reference.text)) {
      throw new Error(`${scene.id}:${explicitId}: 既存の操作は変更できません`);
    }
    return {
      kind,
      speakerLabel: kind === "地の文" ? "地の文" : speakerLabel,
      text: kind === "操作" ? reference.text : text,
      ...(time ? { time } : {}),
      ...(readout?.length ? { readout } : {}),
      ...(metadata ? { metadata } : {}),
      _lockedId: explicitId || reference.id,
    };
  });
};

const parseNumberedStory = () => {
  const headingPattern = /^## ((?:0[1-6] \/ [^｜\n]+)|(?:APEIRONCENE \d{2}))｜(.+)$/gmu;
  const headings = [...source.matchAll(headingPattern)];
  if (headings.length !== MAIN_HEADINGS.length + approved.trueEndScenes.length) {
    throw new Error(`番号付き台本には9sceneが必要です（${headings.length}件）`);
  }
  const byMarker = new Map(headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    return [heading[1], source.slice(start, end)];
  }));
  const main = MAIN_HEADINGS.map((heading) => {
    const scene = approved.mainScenes.find((candidate) => candidate.id === heading.id);
    const body = byMarker.get(heading.marker);
    if (!scene || body === undefined) throw new Error(`番号付き台本のsceneがありません: ${heading.marker}`);
    return { ...scene, entries: parseNumberedEntries(body, scene) };
  });
  const trueEnd = approved.trueEndScenes.map((scene, index) => {
    const marker = `APEIRONCENE ${String(index + 1).padStart(2, "0")}`;
    const body = byMarker.get(marker);
    if (body === undefined) throw new Error(`番号付き台本のsceneがありません: ${marker}`);
    return { ...scene, entries: parseNumberedEntries(body, scene) };
  });
  return { main, trueEnd };
};

const parseMainLines = (sceneLines, sceneId) => {
  const entries = [];
  let index = 0;
  let campusChatOpen = sceneId === "welcome_chat";
  while (index < sceneLines.length) {
    const line = sceneLines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (sceneId === "welcome_chat" && entries.length === 0 && line === "惑星の放課後_雑談") {
      entries.push({ kind: "チャット画面", speakerLabel: "—", text: line });
      index += 1;
      continue;
    }
    if (!MAIN_SPEAKERS.has(line)) {
      entries.push({ kind: "地の文", speakerLabel: "地の文", text: line });
      if (line.startsWith("新しくできた # 惑星の放課後_センサー を開く。")) campusChatOpen = false;
      index += 1;
      continue;
    }

    let blockEnd = index + 1;
    while (blockEnd < sceneLines.length && sceneLines[blockEnd].trim()) blockEnd += 1;
    const block = sceneLines.slice(index + 1, blockEnd).map((value) => value.trim()).filter(Boolean);
    if (block.length === 0) throw new Error(`${sceneId}: ${line} の本文がありません`);
    const finalIsTime = /^\d{2}:\d{2}$/u.test(block.at(-1));
    const isQuotedDialogue = /^[「『]/u.test(block[0]);
    const isChat = sceneId === "welcome_chat" && (campusChatOpen || finalIsTime || !isQuotedDialogue);
    if (!isChat && isQuotedDialogue) {
      entries.push({ kind: "会話", speakerLabel: line, text: block[0] });
      index += 2;
      continue;
    }
    const textLines = finalIsTime ? block.slice(0, -1) : block;
    entries.push({
      kind: isChat ? "学内チャット" : "会話",
      speakerLabel: line,
      text: textLines.join("\n"),
      ...(finalIsTime ? { time: block.at(-1) } : {}),
    });
    index = blockEnd;
  }
  return entries;
};

const isReadoutLine = (line) => /^[A-ZÆ][A-ZÆ·\- :/0-9.,]+$/u.test(line) || line.includes("→");

const parseTrueEndLines = (sceneLines) => {
  const entries = [];
  let index = 0;
  while (index < sceneLines.length) {
    const line = sceneLines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (TRUE_END_SPEAKERS.has(line)) {
      let blockEnd = index + 1;
      while (blockEnd < sceneLines.length && sceneLines[blockEnd].trim()) blockEnd += 1;
      const block = sceneLines.slice(index + 1, blockEnd).map((value) => value.trim()).filter(Boolean);
      if (block.length === 0) throw new Error(`APEIRONCENE: ${line} の本文がありません`);
      entries.push({ kind: "APEIRONCENE", speakerLabel: line, text: block[0] });
      for (const extra of block.slice(1)) {
        if (isReadoutLine(extra)) entries.at(-1).readout = [...(entries.at(-1).readout || []), extra];
        else entries.push({ kind: "APEIRONCENE", speakerLabel: "—", text: extra });
      }
      index = blockEnd;
      continue;
    }
    if (isReadoutLine(line) && entries.length > 0) {
      entries.at(-1).readout = [...(entries.at(-1).readout || []), line];
    } else {
      entries.push({ kind: "APEIRONCENE", speakerLabel: "—", text: line });
    }
    index += 1;
  }
  return entries;
};

const isNumberedStory = source.startsWith(numberedScriptMarker);
let mainScenes;
let trueEndScenes;
let staffCreditsText;
if (isNumberedStory) {
  const numbered = parseNumberedStory();
  mainScenes = numbered.main;
  trueEndScenes = numbered.trueEnd;
  staffCreditsText = readRetainedStaffCredits();
} else {
  mainScenes = MAIN_HEADINGS.map((heading, index) => {
    const start = indexOfLine(heading.marker) + 1;
    const endMarker = MAIN_HEADINGS[index + 1]?.marker || "STAFF & CREDITS / 惑星の放課後 / GAIA SENSATION";
    const end = indexOfLine(endMarker, start);
    const metadata = approved.mainScenes.find((scene) => scene.id === heading.id);
    if (!metadata) throw new Error(`現行台本にscene metadataがありません: ${heading.id}`);
    return {
      ...metadata,
      entries: parseMainLines(trimBlankEdges(lines.slice(start, end)), heading.id),
    };
  });

  const novaceneHeading = indexOfLine("APEIRONCENE");
  const novaceneStart = novaceneHeading + 2;
  const novaceneLines = trimBlankEdges(lines.slice(novaceneStart));
  const scene2Start = novaceneLines.findIndex((line, index) => line.trim() === "AIVA" && novaceneLines[index + 1]?.trim() === "DÆM MIR");
  const scene3Start = novaceneLines.findIndex((line) => line.trim() === "数百万の恒星系へ、異なる色と速さの光が広がる。一本の巨大な神経網ではない。");
  if (scene2Start < 0 || scene3Start < 0 || scene2Start >= scene3Start) {
    throw new Error("APEIRONCENEの3scene境界を確認できません");
  }
  const trueEndRanges = [
    novaceneLines.slice(0, scene2Start),
    novaceneLines.slice(scene2Start, scene3Start),
    novaceneLines.slice(scene3Start),
  ];
  trueEndScenes = approved.trueEndScenes.map((scene, index) => ({
    ...scene,
    entries: parseTrueEndLines(trimBlankEdges(trueEndRanges[index])),
  }));
  staffCreditsText = lines.slice(indexOfLine("STAFF & CREDITS / 惑星の放課後 / GAIA SENSATION"), novaceneHeading).join("\n");
}

const interactionTemplates = Object.freeze([
  Object.freeze({ sceneId: "map_mode01", id: "map_mode01_004", anchor: "「こちらがMODE 01です。1958年から2050年まで、地球の変化を続けて見てください」" }),
  Object.freeze({ sceneId: "map_mode01", id: "map_mode01_023", anchor: "「次は、気温偏差を地図の変化として確かめてみてください」" }),
  Object.freeze({ sceneId: "gx_experience", id: "gx_experience_017", anchor: "「ええ。いまの海や大気とは、まったく違う地球まで戻りますの」" }),
]);

if (!isNumberedStory) {
  for (const template of interactionTemplates) {
    const scene = mainScenes.find((candidate) => candidate.id === template.sceneId);
    const currentScene = approved.mainScenes.find((candidate) => candidate.id === template.sceneId);
    const currentEntry = currentScene.entries.find((entry) => entry.id === template.id);
    const anchorIndex = scene.entries.findIndex((entry) => entry.text === template.anchor);
    if (!currentEntry || anchorIndex < 0) throw new Error(`操作挿入点がありません: ${template.id}`);
    scene.entries.splice(anchorIndex + 1, 0, { ...currentEntry, _lockedId: template.id });
  }
}

const normalizeText = (value) => value
  .normalize("NFKC")
  .replace(/[\s「」『』…。、！？!?：:,.・（）()#—―ｰ\-]/gu, "")
  .toLowerCase();

const bigramDice = (left, right) => {
  if (left === right) return 1;
  if (!left || !right) return 0;
  if (left.length === 1 || right.length === 1) return left === right ? 1 : 0;
  const counts = new Map();
  for (let index = 0; index < left.length - 1; index += 1) {
    const key = left.slice(index, index + 2);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const key = right.slice(index, index + 2);
    const count = counts.get(key) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(key, count - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
};

const entryScore = (current, incoming) => {
  if (incoming._lockedId) return current.id === incoming._lockedId ? 1_000 : -1_000;
  const left = normalizeText(current.text);
  const right = normalizeText(incoming.text);
  let similarity = bigramDice(left, right);
  if (left.includes(right) || right.includes(left)) {
    similarity = Math.max(similarity, Math.min(left.length, right.length) / Math.max(left.length, right.length));
  }
  const sameKind = current.kind === incoming.kind;
  const bothSpeech = ["会話", "学内チャット"].includes(current.kind) && ["会話", "学内チャット"].includes(incoming.kind);
  const sameSpeaker = current.speakerLabel === incoming.speakerLabel;
  if (bothSpeech && !sameSpeaker) return -1_000;
  if (similarity < 0.16) return -1_000;
  return similarity * 100 + (sameKind ? 15 : 0) + (sameSpeaker ? 10 : 0);
};

const alignIds = (currentEntries, incomingEntries, sceneId, { inheritCues = false } = {}) => {
  if (incomingEntries.every((entry) => entry._lockedId)) {
    const entries = incomingEntries.map(({ _lockedId, ...entry }) => ({ ...entry, id: _lockedId }));
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error(`${sceneId}: IDが重複しました`);
    const currentIds = new Set(currentEntries.map((entry) => entry.id));
    const added = entries.filter((entry) => !currentIds.has(entry.id)).length;
    return { entries, reused: entries.length - added, added };
  }
  const rows = currentEntries.length + 1;
  const columns = incomingEntries.length + 1;
  const gap = -5;
  const scores = Array.from({ length: rows }, () => new Float64Array(columns));
  const moves = Array.from({ length: rows }, () => new Uint8Array(columns));
  for (let row = 1; row < rows; row += 1) {
    scores[row][0] = row * gap;
    moves[row][0] = 1;
  }
  for (let column = 1; column < columns; column += 1) {
    scores[0][column] = column * gap;
    moves[0][column] = 2;
  }
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const matchScore = entryScore(currentEntries[row - 1], incomingEntries[column - 1]);
      const diagonal = scores[row - 1][column - 1] + matchScore;
      const up = scores[row - 1][column] + gap;
      const left = scores[row][column - 1] + gap;
      if (matchScore > -1_000 && diagonal >= up && diagonal >= left) {
        scores[row][column] = diagonal;
        moves[row][column] = 3;
      } else if (up >= left) {
        scores[row][column] = up;
        moves[row][column] = 1;
      } else {
        scores[row][column] = left;
        moves[row][column] = 2;
      }
    }
  }

  const matches = [];
  let row = currentEntries.length;
  let column = incomingEntries.length;
  while (row > 0 || column > 0) {
    const move = moves[row][column];
    if (move === 3) {
      matches.push([row - 1, column - 1]);
      row -= 1;
      column -= 1;
    } else if (move === 1) {
      row -= 1;
    } else {
      column -= 1;
    }
  }
  matches.reverse();
  const anchoredMatches = [[-1, -1], ...matches, [currentEntries.length, incomingEntries.length]];
  for (let index = 1; index < anchoredMatches.length; index += 1) {
    const [previousCurrent, previousIncoming] = anchoredMatches[index - 1];
    const [nextCurrent, nextIncoming] = anchoredMatches[index];
    const currentGap = nextCurrent - previousCurrent - 1;
    const incomingGap = nextIncoming - previousIncoming - 1;
    if (currentGap === 0 || currentGap !== incomingGap) continue;
    for (let offset = 1; offset <= currentGap; offset += 1) {
      matches.push([previousCurrent + offset, previousIncoming + offset]);
    }
  }
  matches.sort((left, right) => left[1] - right[1]);
  const matchedByIncoming = new Map(matches.map(([currentIndex, incomingIndex]) => [incomingIndex, currentEntries[currentIndex]]));
  const cueSourceByIncoming = new Map();
  let previousCueSource = null;
  for (let incomingIndex = 0; incomingIndex < incomingEntries.length; incomingIndex += 1) {
    const current = matchedByIncoming.get(incomingIndex);
    if (current && !/_new_\d{3}$/u.test(current.id)) previousCueSource = current.id;
    if (previousCueSource) cueSourceByIncoming.set(incomingIndex, previousCueSource);
  }
  let nextCueSource = null;
  for (let incomingIndex = incomingEntries.length - 1; incomingIndex >= 0; incomingIndex -= 1) {
    const current = matchedByIncoming.get(incomingIndex);
    if (current && !/_new_\d{3}$/u.test(current.id)) nextCueSource = current.id;
    if (!cueSourceByIncoming.has(incomingIndex) && nextCueSource) cueSourceByIncoming.set(incomingIndex, nextCueSource);
  }
  let newIndex = 0;
  const entries = incomingEntries.map((entry, incomingIndex) => {
    const current = matchedByIncoming.get(incomingIndex);
    const id = entry._lockedId || current?.id || `${sceneId}_new_${String(++newIndex).padStart(3, "0")}`;
    const { _lockedId, ...cleanEntry } = entry;
    const inheritedMetadata = entry.metadata || current?.metadata || null;
    const cueFromStepId = inheritCues && /_new_\d{3}$/u.test(id) ? cueSourceByIncoming.get(incomingIndex) : null;
    return {
      ...cleanEntry,
      id,
      ...((inheritedMetadata || cueFromStepId) ? {
        metadata: {
          ...(inheritedMetadata || {}),
          ...(cueFromStepId ? { cueFromStepId } : {}),
        },
      } : {}),
    };
  });
  const unique = new Set(entries.map((entry) => entry.id));
  if (unique.size !== entries.length) throw new Error(`${sceneId}: IDが重複しました`);
  return { entries, reused: entries.length - newIndex, added: newIndex };
};

const alignmentReport = [];
for (const scene of mainScenes) {
  const current = approved.mainScenes.find((candidate) => candidate.id === scene.id);
  const aligned = alignIds(current.entries, scene.entries, scene.id, { inheritCues: true });
  scene.entries = aligned.entries;
  alignmentReport.push(`${scene.id}: ${scene.entries.length} entries (${aligned.reused} IDs reused, ${aligned.added} new)`);
}
for (const scene of trueEndScenes) {
  const current = approved.trueEndScenes.find((candidate) => candidate.id === scene.id);
  const aligned = alignIds(current.entries, scene.entries, scene.id);
  scene.entries = aligned.entries;
  alignmentReport.push(`${scene.id}: ${scene.entries.length} entries (${aligned.reused} IDs reused, ${aligned.added} new)`);
}

// Keep the original submitted text intact; replay the owner's later LOG revision
// only for that exact archived input, never for an unrelated new manuscript.
const logRevision = JSON.parse(fs.readFileSync(path.join(projectRoot, "story", "LOG_REVISION_2026-09-09.json"), "utf8"));
const inputDigest = crypto.createHash("sha256").update(fs.readFileSync(inputPath, "utf8").replace(/\r\n?/gu, "\n")).digest("hex");
if (inputDigest === logRevision.historySha256["story/USER_SCRIPT_2026-08-24.txt"]) {
  const edits = new Map(logRevision.edits.map(edit => [edit.sourceId, edit]));
  let applied = 0;
  for (const scene of [...mainScenes, ...trueEndScenes]) {
    scene.entries = scene.entries.map(entry => {
      const edit = edits.get(entry.id);
      if (!edit) return entry;
      assert.equal(entry.text, edit.beforeSource.text, `${entry.id}: LOG revision input mismatch`);
      assert.equal(entry.speakerLabel, edit.beforeSource.speakerLabel);
      applied += 1;
      return { ...entry, ...edit.sourcePatch };
    });
  }
  assert.equal(applied, logRevision.edits.length);
  alignmentReport.push(`2026-09-09: ${applied} later LOG/place-name edits replayed; submitted text preserved`);
}

const quoteLines = (text) => text.split("\n").map((line) => line ? `> ${line}` : ">").join("\n");
const renderEntry = (entry) => {
  const output = [`#### ${entry.id}｜${entry.kind}｜${entry.speakerLabel}`, quoteLines(entry.text)];
  if (entry.time) output.push(`- 時刻: ${entry.time}`);
  if (entry.readout?.length) output.push(`- データ表示: ${entry.readout.map((value) => `\`${value.replaceAll("`", "\\`")}\``).join("、")}`);
  if (entry.metadata) output.push(`- 演出メタ: \`${JSON.stringify(entry.metadata).replaceAll("`", "\\`")}\``);
  return output.join("\n\n");
};

const output = [];
output.push("# 『惑星の放課後 ～GAIA SENSATION～』承認済み全編台本（2026-08-24）");
output.push("> 2026年8月24日に提供された全編改稿を、実装用の安定IDと操作メタデータへ変換した正本です。");
output.push("# PART I｜本編");
for (const scene of mainScenes) {
  output.push(`## SCENE ${String(scene.number).padStart(2, "0")}｜${scene.title}`);
  output.push(`- シーンID: \`${scene.id}\`\n- 章表示: ${scene.chapter}\n- 日時: ${scene.date} ${scene.time}\n- 場所: ${scene.location}`);
  output.push(scene.entries.map(renderEntry).join("\n\n"));
}
output.push("# PART II｜スタッフロールと分岐");
output.push("## 提供台本の表示文\n\n" + quoteLines(staffCreditsText));
output.push("# PART III｜APEIRONCENE");
output.push("- タイトル: APEIRONCENE\n- サブタイトル: 惑星の放課後 / GAIA SENSATION — APEIRONCENE\n- 経過時間: 2,704,118 HARA\n- 統一言語: SÆLIVA（セイリヴァ）");
for (const scene of trueEndScenes) {
  output.push(`## APEIRONCENE ${String(scene.number).padStart(2, "0")}｜${scene.title}`);
  output.push(`- シーンID: \`${scene.id}\`\n- 背景シグネチャ: \`${scene.backdrop}\``);
  output.push(scene.entries.map(renderEntry).join("\n\n"));
}
output.push("## 今回の反映チェックリスト\n\n- 提供された本編・スタッフロール・APEIRONCENE全文を実装正本へ変換。\n- 既存の地図/GX操作、安定ID、演出メタデータを可能な限り継承。");

const rendered = `${output.join("\n\n---\n\n")}\n`;
const rawCopy = `${source}\n`;
const normalizeLineEndings = (value) => value.replace(/\r\n?/gu, "\n");
if (checkOnly) {
  if (!fs.existsSync(outputPath) || normalizeLineEndings(fs.readFileSync(outputPath, "utf8")) !== rendered) {
    throw new Error(`${path.relative(projectRoot, outputPath)} が提供台本からの変換結果と一致しません`);
  }
  if (!fs.existsSync(rawCopyPath) || normalizeLineEndings(fs.readFileSync(rawCopyPath, "utf8")) !== rawCopy) {
    throw new Error(`${path.relative(projectRoot, rawCopyPath)} が提供台本と一致しません`);
  }
  console.log(`approved user script ok: ${mainScenes.reduce((count, scene) => count + scene.entries.length, 0)} main / ${trueEndScenes.reduce((count, scene) => count + scene.entries.length, 0)} APEIRONCENE entries`);
} else {
  fs.writeFileSync(outputPath, rendered, "utf8");
  fs.writeFileSync(rawCopyPath, rawCopy, "utf8");
  console.log(`wrote ${path.relative(projectRoot, outputPath)}`);
  console.log(`wrote ${path.relative(projectRoot, rawCopyPath)}`);
}
alignmentReport.forEach((line) => console.log(line));
