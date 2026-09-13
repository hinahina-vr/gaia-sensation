// The owner's 2026-09-06 LOG export is prose, not an executable instruction stream.
// Only the reviewed editorial forms below are accepted; unknown forms fail closed.
import assert from "node:assert/strict";

export const parseLogComments = (source, expectedCount = 109) => {
  const blocks = source.replace(/\r\n?/gu, "\n").split(/(?=^## \d+\. )/mu).slice(1);
  const comments = blocks.map((block) => {
    const id = block.match(/^- LOG ID: `([^`]+)`$/mu)?.[1];
    const original = block.split("### 現在の本文\n")[1]?.split("### 修正指示\n")[0]
      .split("\n").filter((line) => line.startsWith(">")).map((line) => line.replace(/^> ?/u, "")).join("\n");
    const instruction = block.split("### 修正指示\n")[1]?.replace(/\n---\s*$/u, "").trim();
    assert(id && original && instruction, "Incomplete LOG comment");
    return { id, original, instruction };
  });
  assert.equal(comments.length, expectedCount);
  assert.equal(new Set(comments.map(({ id }) => id)).size, comments.length);
  return comments;
};

const normalizeSpeaker = (speaker) => ({
  あなた: "プレイヤー", "青猫：チャットに投稿": "青猫",
})[speaker] || speaker;

export const planLogComment = ({ id, original, instruction }) => {
  if (instruction === "削除") return { action: "delete", parts: [] };
  if (instruction === "オジキ→伯父") {
    assert(original.includes("オジキ"));
    return { action: "replace", parts: [{ text: original.replaceAll("オジキ", "伯父") }] };
  }
  if (instruction === "46億年") {
    assert(/四十(?:数|六)億年/u.test(original));
    return { action: "replace", parts: [{ text: original.replace(/四十(?:数|六)億年/gu, "46億年") }] };
  }
  if (id === "gx_experience_041") {
    const [dialogue, narration] = instruction.split("\nの後に追加：");
    assert(dialogue && narration);
    return { action: "replace-and-add", parts: [{ text: dialogue }, { text: narration, speaker: "地の文" }] };
  }
  const append = /^(?:追加：|追記\n)/u.test(instruction);
  let body = instruction
    .replace(/^(?:【元の文差し替え】|元の文差し替え\n|差し替え[：\n]|追加：|追記\n)/u, "")
    .replace(/\n\n追記\n/gu, "\n")
    .trim();
  const labels = [...body.matchAll(/【([^】]+)】\n?/gu)];
  const parts = [];
  const lead = body.slice(0, labels[0]?.index ?? body.length).trim();
  if (lead) parts.push({ text: lead, ...(append ? { speaker: "地の文" } : {}) });
  for (let index = 0; index < labels.length; index += 1) {
    const marker = labels[index];
    const text = body.slice(marker.index + marker[0].length, labels[index + 1]?.index ?? body.length).trim();
    assert(text, `${id}: empty dialogue`);
    const speaker = normalizeSpeaker(marker[1]);
    assert(["地の文", "あめ", "みず", "ルウ", "saku", "プレイヤー", "青猫"].includes(speaker), `${id}: unexpected speaker`);
    parts.push({ text, speaker, ...(marker[1] === "青猫：チャットに投稿" ? { kind: "学内チャット" } : {}) });
  }
  if (id === "festival_concept_019") parts[0].speaker = "女の子";
  if (id === "esp32_pitch_016i") parts[0].speaker = "地の文";
  assert(parts.length && parts.every(({ text }) => !/【|】|差し替え|の後に追加：|^追記/u.test(text)), `${id}: unresolved editorial notation`);
  return { action: append ? "append" : "replace", parts };
};
