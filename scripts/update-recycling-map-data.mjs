import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const applyRecyclingMapMetadata = mode => {
  const dataset = mode.datasets.find(row => row.id === "un-sdg");
  if (!dataset) throw new Error("Missing UN recycling dataset");
  dataset.transformation = "国連SDG APIの全ページから自治体ごみ再資源化率の最新公表値を国・地域別に採用。世界・地域合計は除外。国土を0〜100%の青の共通尺度で塗り分け、選択国の報告年と割合を表示。";
  dataset.caveat = "報告年・制度・廃棄物定義は国で異なります。公表値がない国は無着色とし、近隣国からの推定値や0%では埋めません。SOURCEにも国連側の推計値が含まれ、Nature属性・注記を保存しています。最新値が0〜100%外の国は塗り分けから除外し、元値と理由をcountryCoverage.excludedSourceValuesに保持します。";
  const scenario = mode.datasets.find(row => row.id === "waste-route-scenario");
  if (scenario) scenario.transformation = "旧形式の仮想シナリオの参考資料で、現在の地図では使用しません。スライダーは国・地域の選択に使い、再資源化率の公表値を変更しません。";
  for (const row of mode.signals.countryCoverage?.excludedSourceValues || []) {
    if (row.exclusionCode) continue;
    row.reason = "Latest source percentage outside 0–100; cannot represent on the percentage map. Not clamped or replaced with an older year.";
  }
  return mode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Regenerate display metadata only; observations and retrieval dates stay intact.
  const url = new URL("../data/gaia-signals.json", import.meta.url);
  const snapshot = JSON.parse(await readFile(url, "utf8"));
  applyRecyclingMapMetadata(snapshot.modes.find(mode => mode.id === "nothing-is-waste"));
  await writeFile(url, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log("Updated recycling map descriptions; all country values and reporting years preserved.");
}
