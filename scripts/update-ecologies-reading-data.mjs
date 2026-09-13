import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const descriptions = {
  "nasa-modis-ecological-layer": "背景参照として保存した資料です。比較の読みやすさを優先して地図には表示せず、相関計算にも使いません。",
  "worldbank-forest": "陸地に占める森林の割合を、緑の0〜100%棒と散布図の縦軸へ変換。都市人口率が最も近い国と並べて比較します。",
  "worldbank-urban": "人口に占める都市居住者の割合を、青の0〜100%棒と散布図の横軸へ変換。森林率とは分母が異なります。",
  "forest-urban-correlation": "選んだ国と都市人口率の差が最小の国を比較。「関係を見る」で両指標のある国・地域のPearson相関と単回帰線を表示。国別の時間変化ではありません。",
  "unesco-whc": "各大地域の世界遺産24例を、文化・記憶の独立した表示へ配置。森林率・都市人口率の比較や相関計算には混ぜません。",
};
export const applyEcologiesReadingMetadata = mode => {
  mode.question = "都市人口率が高い国ほど、森林率は低いのでしょうか。";
  for (const [id, transformation] of Object.entries(descriptions)) {
    const dataset = mode.datasets.find(dataset => dataset.id === id);
    if (!dataset) throw new Error(`Missing ecology dataset: ${id}`);
    dataset.transformation = transformation;
    if (id === "nasa-modis-ecological-layer") dataset.preview.forEach(row => { row.displayed = false; });
  }
  return mode;
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Refresh only display-method metadata, never observations or retrieval dates.
  const url = new URL("../data/gaia-signals.json", import.meta.url);
  const snapshot = JSON.parse(await readFile(url, "utf8"));
  applyEcologiesReadingMetadata(snapshot.modes.find(mode => mode.id === "three-ecologies"));
  await writeFile(url, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log("Updated 5 ecology display-method descriptions; all source observations preserved.");
}
