import {ATLAS_EXHIBITS} from './atlas-history-model.js?v=insights75-scope-20261026';
export const CLIMATE_EXHIBITS = Object.freeze([
  { id: 'cyclones', number: '72', shortTitle: '嵐が残した道', signalLabel: '熱帯低気圧の経路・最大風速', subtitle: '海を渡った嵐の記録から、年ごとの違いをたどる',
    picker: 'NOAA IBTrACSの1980–2024シーズンの主要経路。線の色で1分平均風速を比べます。', source: 'https://www.ncei.noaa.gov/products/international-best-track-archive' },
  { id: 'coral', number: '73', shortTitle: '熱を抱えた海', signalLabel: 'サンゴ礁監視海域の熱ストレス', subtitle: '海に蓄積した熱を、サンゴ礁のそばで見つめる',
    picker: 'NOAA Coral Reef Watchの1986–2025年の監視海域別記録。年内最大DHWと高い状態が続いた日数を比べます。', source: 'https://coralreefwatch.noaa.gov/product/vs/data.php' },
  { id: 'lakes', number: '74', shortTitle: '水があった場所', signalLabel: '固定範囲の年次水面積', subtitle: '湖の広さは、年とともに変わっていく',
    picker: 'JRCの1984–2015年の衛星水域分類。3つの湖周辺で、水面の広がりと観測できた範囲を年ごとに比べます。', source: 'https://global-surface-water.appspot.com/download' },
  ...ATLAS_EXHIBITS,
]);
export const BASINS = { ALL: 'すべての海域', WP: '北西太平洋', EP: '東太平洋', NA: '北大西洋', NI: '北インド洋', SI: '南インド洋', SP: '南太平洋', SA: '南大西洋' };
export const windMS = knots => Number.isFinite(knots) ? knots * 1852 / 3600 : null;
export const format = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('ja-JP', { maximumFractionDigits: digits }) : '欠測';
export const daysInYear = year => (Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
export const stormPeak = storm => storm?.points?.reduce((peak,p) => Number.isFinite(p[3]) && (peak == null || p[3]>peak) ? p[3] : peak, null) ?? null;
export const stormLabel = storm => `${storm.name === 'NOT_NAMED' || !storm.name ? '名称なし' : storm.name} · ${storm.id}`;
export function colorFor(kind, value) {
  if (!Number.isFinite(value)) return '#81979e';
  const stops = kind === 'cyclones' ? [17,33,50,65] : [2,4,8,16];
  return ['#76d7ed','#88e4c5','#ffe08c','#ffa16f','#ff6486'][stops.filter(limit => value >= limit).length];
}
export function coralInsight(region, row) {
  if (!row) return 'この年の有効な日別記録がありません。';
  const complete = row.validDays === daysInYear(row.year);
  const previous = region.years.find(r => r.year === row.year-1 && r.validDays === daysInYear(r.year));
  const comparison = previous && complete ? `前年の最大値${format(previous.max)}から${format(Math.abs(row.max-previous.max))}℃・週${row.max>=previous.max?'上昇':'低下'}。` : '';
  return `${row.year}年の最大DHWは${format(row.max)}℃・週（${row.peakDate}）。4以上は${row.days4}日、8以上は${row.days8}日。${comparison}${complete ? '' : `有効記録${row.validDays}/${daysInYear(row.year)}日。欠測日の分は集計外です。`}`;
}
export function cycloneInsight(storms, year) {
  const measured = storms.filter(s => stormPeak(s) != null);
  const strongest = measured.reduce((best,s) => !best || stormPeak(s)>stormPeak(best) ? s : best, null);
  return `${year}シーズンに主要経路${storms.length}件を対象。1分平均風速を確認できる${measured.length}件のうち、最大は${strongest ? `${stormLabel(strongest)}の${format(windMS(stormPeak(strongest)))}m/s` : '該当なし'}。${storms.length-measured.length ? `風速なしの${storms.length-measured.length}件は強さの比較から除外。` : ''}`;
}
export function statisticsFor({ kind, data, region, basin = 'ALL' }) {
  const coral = kind === 'coral', label = coral ? `${region?.name} / 年内最大DHW` : `${BASINS[basin]} / 主要経路の対象数`;
  const observations = coral ? (region?.years || []).filter(r => r.validDays === daysInYear(r.year)).map(r => ({year:r.year,value:r.max}))
    : data.years.map(r => ({year:r.year,value:(basin === 'ALL' ? r : r.basins[basin])?.count ?? 0}));
  const unit = coral ? '℃・週' : '件', id = `climate-${kind}-${coral ? region?.id : basin}`;
  const rows = observations.map(r => ({ id:`${id}-${r.year}`,label:String(r.year),period:String(r.year),year:r.year,x:r.year,y:r.value,value:r.value,provenance:'DERIVED' }));
  return { id, modeId:kind, title:label, rows, unit, xKind:'year', xLabel:coral?'年':'シーズン', yLabel:label, valueLabel:label, defaultMethod:'discovery',
    periodStart:rows[0]?.year,periodEnd:rows.at(-1)?.year,periodLabel:`${rows[0]?.year}–${rows.at(-1)?.year}`,missingCount:coral?(region?.years.length||0)-rows.length:0,
    derivedFromSourceOnly:true,provenance:['DERIVED'],insightContext:{domain:'climate',axis:'time-series',measurementKind:'DERIVED'},
    sourceName:coral?'NOAA Coral Reef Watch':'NOAA NCEI / IBTrACS v4r01',sourceUrl:CLIMATE_EXHIBITS[coral?1:0].source,
    comparisonNote:coral?'日別DHWから算出した年内最大値。有効日数が暦年の日数に満たない年は統計対象から除外。監視海域の90パーセンタイルHotSpotから積算。'
      :'MAIN経路の対象数。海域は各経路の最初の記録で分類。観測・対象体制の変化を含むため、件数の増減だけから発生頻度の長期変化を断定できません。' };
}
