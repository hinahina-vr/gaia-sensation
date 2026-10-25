import { ANNUAL_OBSERVATION_YEARS } from './annual-observation-years.js?v=history-20260912';
import { observationReadings } from './observation-reading-catalog.js?v=station-reading-20261022';
export const MARINE_COD_EXHIBIT = Object.freeze({
  id: "japan-marine-cod",
  number: "31",
  years: Object.freeze(ANNUAL_OBSERVATION_YEARS['japan-marine-cod.json']),
  shortTitle: "沿岸に残る、水の記録",
  title: "沿岸に残る、水の記録 — COASTAL COD",
  signalLabel: "海域のCOD / 年度平均",
  ...observationReadings[31],
  sourceName: "環境省 公共用水域水質測定データ",
  source: "https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp",
});
