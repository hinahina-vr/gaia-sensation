// Reviewed editorial forms from the owner's second 2026-09-06 LOG export.
import assert from "node:assert/strict";

export const planBeyondLogComment = ({ id, original, instruction }) => {
  assert(id.startsWith("beyond_"), `${id}: outside this revision`);
  const append = instruction.startsWith("追加\n");
  const body = instruction.replace(/^(?:差し替え|追加)\n/u, "").replace(/\n+追加\n/gu, "\n").trim();
  const markers = [...body.matchAll(/【([^】]+)】\n?/gu)];
  const parts = [];
  const lead = body.slice(0, markers[0]?.index ?? body.length).trim();
  if (lead) parts.push({ text: lead, ...(append ? { speaker: "地の文" } : {}) });
  markers.forEach((marker, index) => {
    const text = body.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? body.length).trim();
    const speaker = marker[1] === "あなた" ? "プレイヤー" : marker[1];
    assert(["地の文", "ルウ", "みず", "あめ", "saku", "プレイヤー"].includes(speaker));
    assert(text, `${id}: empty message`);
    parts.push({ text, speaker });
  });
  if (id === "beyond_01_028") {
    assert.equal(parts[0].text, "ルウが虚空を指で払うと、");
    assert(original.startsWith("ルウが虚空で指を払う。"));
    parts[0].text = original.replace("ルウが虚空で指を払う。", parts[0].text);
  }
  if (id === "beyond_01_031") {
    assert.equal(parts[0].text, "逗子のブース➡はじめてみんなに会ったときに、");
    assert(original.startsWith("逗子のブースで、"));
    parts[0].text = original.replace("逗子のブースで、", "はじめてみんなに会ったときに、");
  }
  if (id === "beyond_02_024") {
    // The export repeats the previous Ruu line, this Mizu line and the narration.
    assert.equal(parts.length, 5);
    assert.equal(parts[0].text, parts[3].text);
    assert.equal(parts[1].text, parts[4].text);
    assert.equal(parts[2].speaker, "ルウ");
    parts.splice(2);
  }
  assert(parts.length && parts.every(part => !/【|】|➡|差し替え|^追加/u.test(part.text)), `${id}: unresolved notation`);
  return { action: append ? "append" : "replace", parts };
};
