// Official annual statistics, mapped to ESP32 measurement keys without
// pretending that an annual statistic is an instantaneous sensor reading.
import { ANNUAL_OBSERVATION_YEARS } from './annual-observation-years.js?v=history-20260912';
const waterSource = "https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp";
const weatherSource = "https://www.data.jma.go.jp/stats/etrn/";
const water = [
  ["marine", "海", "海域"], ["river", "川", "河川"], ["lake", "湖", "湖沼"],
].flatMap(([kind, title, area], index) => [
  { id: `japan-${kind}-ph`, number: String(32 + index * 2), shortTitle: `${title}の酸とアルカリ`,
    subtitle: `${title}の酸性・アルカリ性の幅を、観測地点からたどる。`,
    signalLabel: `${area}のpH / 年度最小値`, metricLabel: "pH 年度最小値", secondaryLabel: "年度最大値", measurementKey: "ph", unit: "pH",
    stops: [0, 5, 7, 9, 14], caption: `${area}の測定地点で記録されたpHの年度最小値。地点を選ぶと年度最大値も表示します。平均値ではありません。`,
    explanation: "pHは酸性・アルカリ性の度合いです。7より小さいほど酸性側、大きいほどアルカリ性側です。地図は年度最小値、地点欄に年度最大値を表示します。最小・最大の中点を平均値として扱いません。値は対数尺度で、pHが1違うことは単純な1単位の濃度差ではありません。", kind },
  { id: `japan-${kind}-do`, number: String(33 + index * 2), shortTitle: `${title}に溶ける酸素`,
    subtitle: `${title}の生きものを支える酸素を、年ごとの記録で見る。`,
    signalLabel: `${area}のDO / 年度平均`, metricLabel: "DO 年度平均値", measurementKey: "dissolved_oxygen", unit: "mg/L",
    stops: [0, 2, 5, 10, 15], caption: `${area}のDO（溶存酸素量）の年度平均値。COD・BODや底層だけの酸素量とは別の指標です。`,
    explanation: "DOは水に溶けている酸素の量です。水温、流れ、光合成、呼吸や分解などの影響を受けます。年度平均なので、一時的な酸欠や底層の状態を表すものではありません。COD・BOD（有機物の酸化・分解で消費される酸素の目安）と混同しないでください。", kind },
].map(item => ({ ...item, category: "water", periodUnit: "年度", sourceName: "環境省 公共用水域水質測定データ", organisation: "環境省", source: waterSource,
  comparisonNote: "公開地点コードで照合できる年度の記録。欠測と限界値は数値分析から除外。古い記録に統一番号がない場合は年度別IDとし、推定で地点を連結しません。採水条件・観測網の変更に注意。" })));
const weather = [
  ["temperature", "temperature", "気温が刻む一年", "気温 年平均値", "°C", [-10, 0, 10, 20, 30], "気象官署で測った日平均気温の年平均。都市・標高・海からの距離などで異なり、ESP32の設置条件と同一ではありません。"],
  ["humidity", "humidity", "空気が含む湿り気", "相対湿度 年平均値", "%RH", [30, 50, 70, 90, 100], "相対湿度の年平均。空気中の水蒸気量そのもの（絶対湿度）ではなく、気温にも左右される割合です。"],
  ["pressure", "pressure", "空気の重さをたどる", "現地気圧 年平均値", "hPa", [850, 900, 950, 1000, 1050], "観測地点の標高で測った現地気圧の年平均。天気図で使う海面更正気圧ではありません。地点間の違いには標高差が含まれます。"],
  ["rainfall", "rainfall", "一年に降り積もる雨", "降水量 年合計", "mm", [0, 1000, 2000, 3000, 5000], "一年の降水量の合計。雨の瞬間的な強さ（mm/h）ではありません。雨量計との比較には、同じ積算期間と設置条件が必要です。"],
  ["wind-speed", "wind_speed", "風が通った一年", "風速 年平均値", "m/s", [0, 2, 4, 6, 8], "観測された風速の年平均。最大瞬間風速や風向を表すものではありません。風速計の設置高さ・周囲の建物・移設で値が変わります。"],
  ["solar-irradiance", "solar_irradiance", "地表に届いた日差し", "全天日射 年平均相当", "W/m²", [0, 100, 150, 200, 250], "元資料の全天日射量（日積算量の年平均、MJ/m²）を 1,000,000 ÷ 86,400 倍してW/m²に換算。夜間も含む24時間平均相当で、昼間の瞬時の日射強度や日照時間ではありません。元の値も地点欄に表示します。"],
].map(([id, measurementKey, shortTitle, metricLabel, unit, stops, explanation], index) => ({
  id: `japan-weather-${id}`, number: String(38 + index), shortTitle, metricLabel, signalLabel: metricLabel, unit, stops, measurementKey, explanation,
  subtitle: ["一年の気温から、暮らしを包む空気の違いを見る。", "空気の湿り方を、同じ地点の年ごとの記録で読む。", "標高の違いも含めて、観測地点の空気の重さを見る。", "雨と雪が届けた水を、一年ずつたどってみる。", "風の通り方を、観測地点の一年の平均から読む。", "地表に届く太陽のエネルギーを、観測記録で見る。"][index],
  picker: `気象庁の38官署から、${id === 'solar-irradiance' ? 1961 : 1955}〜2024年の${metricLabel}をたどります。${measurementKey === "solar_irradiance" ? "原資料から24時間平均相当へ単位換算。" : "瞬時値や全国平均ではありません。"}`,
  caption: `日本各地の気象官署の過去の保存された観測統計。${explanation}`, category: "weather", periodUnit: "年",
  sourceName: "気象庁 過去の気象データ検索", organisation: "気象庁", source: weatherSource,
  comparisonNote: "全国38気象官署の保存値で、全アメダスを網羅していません。欠測・準正常値・資料不足値は原注記を保持し、数値分析から除外。地図の位置は取得時点の地点表に基づき、過去の移転前の位置を復元したものではありません。観測方法・移設の影響に注意し、原因を断定しません。",
}));
export const JAPAN_SENSOR_OPEN_EXHIBITS = Object.freeze([...water, ...weather].map(item => Object.freeze({
  ...item, years: Object.freeze(ANNUAL_OBSERVATION_YEARS[`${item.id}.json`]), picker: item.picker || item.caption, stops: Object.freeze(item.stops), title: item.shortTitle, dataFile: `${item.id}.json`,
})));

// These exact same numerical stops drive both map pixels and the legend.
export function sensorObservationAppearance(definition, value) {
  if (!Number.isFinite(value)) return { color: "#abb5be", radius: 2.2 };
  const stops = definition.stops, colors = [[74, 157, 255], [69, 206, 235], [129, 221, 167], [255, 175, 89], [247, 79, 103]];
  const bounded = Math.max(stops[0], Math.min(stops.at(-1), value));
  const high = stops.findIndex(stop => stop >= bounded), low = Math.max(0, high - 1);
  const blend = high === low ? 0 : (bounded - stops[low]) / (stops[high] - stops[low]);
  return { color: `rgb(${colors[high].map((channel, index) => Math.round(colors[low][index] + (channel - colors[low][index]) * blend)).join(", ")})`,
    radius: 2.5 + Math.sqrt((bounded - stops[0]) / (stops.at(-1) - stops[0])) * 4.5 };
}
