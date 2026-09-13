import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const approvedStoryPath = path.join(projectRoot, "story", "APPROVED_SCRIPT_2026-08-24.md");
const EXPECTED_SHA256 = "f021e23ef7b94d0c32ab0c4b2bea0a916028746b100cdc943f8bc9bdb6ff1de5";
const EXPECTED_MAIN_SCENES = Object.freeze([
  "festival_concept",
  "map_mode01",
  "gx_experience",
  "esp32_pitch",
  "circle_invitation",
  "welcome_chat",
]);
const EXPECTED_TRUE_END_SCENES = Object.freeze([
  "after-ending",
  "electronic-civilization",
  "after-school-stars",
]);

const unquoteCode = (value) => {
  const trimmed = value.trim();
  return trimmed.startsWith("`") && trimmed.endsWith("`")
    ? trimmed.slice(1, -1)
    : trimmed;
};

const parseEntry = (lines, start) => {
  const heading = lines[start].match(/^#### ([^｜]+)｜([^｜]+)｜(.+)$/u);
  if (!heading) throw new Error(`台本見出しを解析できません: ${lines[start]}`);
  let end = start + 1;
  while (end < lines.length && !/^(?:#### |## |# )/u.test(lines[end])) end += 1;
  const body = lines.slice(start + 1, end);
  const text = body
    .filter((line) => line.startsWith(">"))
    .map((line) => line.replace(/^> ?/u, ""))
    .join("\n");
  if (!text) throw new Error(`${heading[1]}: 本文がありません`);
  const timeLine = body.find((line) => line.startsWith("- 時刻: "));
  const readoutLine = body.find((line) => line.startsWith("- データ表示: "));
  const metadataLine = body.find((line) => line.startsWith("- 演出メタ: "));
  let metadata = null;
  if (metadataLine) {
    const raw = unquoteCode(metadataLine.slice("- 演出メタ: ".length)).replaceAll("\\`", "`");
    metadata = JSON.parse(raw);
  }
  return {
    end,
    entry: Object.freeze({
      id: heading[1],
      kind: heading[2],
      speakerLabel: heading[3],
      text,
      ...(timeLine ? { time: timeLine.slice("- 時刻: ".length).trim() } : {}),
      ...(readoutLine ? { readout: Object.freeze([...readoutLine.matchAll(/`([^`]+)`/gu)].map((match) => match[1])) } : {}),
      ...(metadata ? { metadata: Object.freeze(metadata) } : {}),
    }),
  };
};

const parseScenes = (source, { startMarker, endMarker, trueEnd = false }) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`台本区間を確認できません: ${startMarker}`);
  const lines = source.slice(start, end).split("\n");
  const scenes = [];
  let index = 0;
  while (index < lines.length) {
    const headingPattern = trueEnd
      ? /^## APEIRONCENE (\d+)｜(.+)$/u
      : /^## SCENE (\d+)｜(.+)$/u;
    const heading = lines[index].match(headingPattern);
    if (!heading) {
      index += 1;
      continue;
    }
    let sceneEnd = index + 1;
    while (sceneEnd < lines.length && !headingPattern.test(lines[sceneEnd])) sceneEnd += 1;
    const sceneLines = lines.slice(index, sceneEnd);
    const sceneIdLine = sceneLines.find((line) => line.startsWith("- シーンID: "));
    if (!sceneIdLine) throw new Error(`${lines[index]}: シーンIDがありません`);
    const sceneId = unquoteCode(sceneIdLine.slice("- シーンID: ".length));
    const entries = [];
    let entryIndex = 0;
    while (entryIndex < sceneLines.length) {
      if (!sceneLines[entryIndex].startsWith("#### ")) {
        entryIndex += 1;
        continue;
      }
      const parsed = parseEntry(sceneLines, entryIndex);
      entries.push(parsed.entry);
      entryIndex = parsed.end;
    }
    const scene = {
      id: sceneId,
      number: heading[1],
      title: heading[2],
      entries: Object.freeze(entries),
    };
    if (trueEnd) {
      const backdropLine = sceneLines.find((line) => line.startsWith("- 背景シグネチャ: "));
      if (!backdropLine) throw new Error(`${sceneId}: 背景シグネチャがありません`);
      scene.backdrop = unquoteCode(backdropLine.slice("- 背景シグネチャ: ".length));
    } else {
      const chapterLine = sceneLines.find((line) => line.startsWith("- 章表示: "));
      const dateTimeLine = sceneLines.find((line) => line.startsWith("- 日時: "));
      const locationLine = sceneLines.find((line) => line.startsWith("- 場所: "));
      const dateTime = dateTimeLine?.slice("- 日時: ".length).match(/^(.+?) ((?:AM|PM) .+)$/u);
      if (!chapterLine || !dateTime || !locationLine) throw new Error(`${sceneId}: 本編シーン情報が不足しています`);
      scene.chapter = chapterLine.slice("- 章表示: ".length);
      scene.date = dateTime[1];
      scene.time = dateTime[2];
      scene.location = locationLine.slice("- 場所: ".length);
    }
    scenes.push(Object.freeze(scene));
    index = sceneEnd;
  }
  return Object.freeze(scenes);
};

const assertUniqueIds = (scenes, label) => {
  const ids = scenes.flatMap((scene) => scene.entries.map((entry) => entry.id));
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error(`${label}: ステップIDが重複しています`);
};

export const readApprovedStoryScript = () => {
  const bytes = fs.readFileSync(approvedStoryPath);
  const source = bytes.toString("utf8").replace(/\r\n?/gu, "\n");
  const digest = crypto.createHash("sha256").update(source, "utf8").digest("hex");
  if (digest !== EXPECTED_SHA256) throw new Error("story/APPROVED_SCRIPT_2026-08-24.mdが承認済み入力と一致しません");
  const mainScenes = parseScenes(source, {
    startMarker: "# PART I｜本編",
    endMarker: "# PART II｜スタッフロールと分岐",
  });
  const trueEndScenes = parseScenes(source, {
    startMarker: "# PART III｜APEIRONCENE",
    endMarker: "## 今回の反映チェックリスト",
    trueEnd: true,
  });
  if (mainScenes.map((scene) => scene.id).join("|") !== EXPECTED_MAIN_SCENES.join("|")) {
    throw new Error("承認済み本編のシーン順が不正です");
  }
  if (trueEndScenes.map((scene) => scene.id).join("|") !== EXPECTED_TRUE_END_SCENES.join("|")) {
    throw new Error("承認済みAPEIRONCENEのシーン順が不正です");
  }
  assertUniqueIds(mainScenes, "本編");
  assertUniqueIds(trueEndScenes, "APEIRONCENE");
  const mainCount = mainScenes.reduce((count, scene) => count + scene.entries.length, 0);
  const trueEndCount = trueEndScenes.reduce((count, scene) => count + scene.entries.length, 0);
  if (mainCount !== 380 || trueEndCount !== 164) {
    throw new Error(`承認済み台本の件数が不正です: ${mainCount} main / ${trueEndCount} APEIRONCENE`);
  }
  return Object.freeze({ mainScenes, trueEndScenes, sha256: digest });
};
