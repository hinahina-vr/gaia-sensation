// Fixed-AOI surface-water observations, not official whole-lake boundaries.
export const LAKE_SOURCE = 'https://global-surface-water.appspot.com/download';
export const lakeFormat = value => Number.isFinite(value) ? value.toLocaleString('ja-JP', {maximumFractionDigits:1}) : '欠測';
export function lakeInsight(region, row) {
  if (!row) return 'この年の記録がありません。';
  if (!(row.coverage > 0)) return `${row.year}年は水域内の観測カバー率0%。水面積は欠測として扱います。`;
  const change = Number.isFinite(row.changePercent)
    ? `2000年と共通して観測できた範囲で、水面は${lakeFormat(Math.abs(row.changePercent))}%${row.changePercent < 0 ? '減少' : '増加'}。`
    : '2000年との比較は、共通観測範囲が十分な年に表示します。';
  return `${row.year}年、固定範囲で確認できた水面は${lakeFormat(row.water)} km²。通年の水域${lakeFormat(row.permanent)}、季節的な水域${lakeFormat(row.seasonal)} km²。${change}通期の水域範囲に対する観測カバー率${lakeFormat(row.coverage)}%。`;
}
export function lakeStatistics(region) {
  if (!region) return null;
  const id = `climate-lakes-${region.id}`;
  // Preserve incomplete observations in the display; exclude them from trends.
  const observations = region.years.filter(row => row.coverage >= 95);
  const rows = observations.map(row => ({id:`${id}-${row.year}`, label:String(row.year), period:String(row.year), year:row.year,
    x:row.year, y:row.water, value:row.water, provenance:'DERIVED'}));
  return {id, modeId:'lakes', title:`${region.name}周辺 / 固定範囲の年次水面`, rows, unit:'km²', xKind:'year', xLabel:'年',
    yLabel:'固定範囲の水面積', valueLabel:'季節的＋通年の水域', defaultMethod:'discovery',
    periodStart:rows[0]?.year, periodEnd:rows.at(-1)?.year, periodLabel:`${rows[0]?.year}–${rows.at(-1)?.year}`,
    missingCount:region.years.length-rows.length, derivedFromSourceOnly:true, provenance:['DERIVED'],
    insightContext:{domain:'water',axis:'time-series',measurementKind:'DERIVED'},
    sourceName:'EC JRC / Google, Global Surface Water v1.0', sourceUrl:LAKE_SOURCE,
    comparisonNote:'1984–2015年の年次分類を固定矩形範囲で集計。季節的・通年水域の合計で、ある一日の湖岸線や年平均面積とは区別します。通期水域内の観測カバー率95%未満の年は統計から除外。湖周辺の別の水域を含み、細い湖岸・分類・観測時期の誤差が残ります。'};
}
