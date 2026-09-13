export const FOOD_EXHIBITS = Object.freeze([
  { id: 'food-balances', number: '70', shortTitle: '食料を育て、分かち合う',
    subtitle: '国ごとの収穫と、食料の出入り', signalLabel: 'FAOSTAT / 食料需給表', dataFile: 'fao-food-balances.json',
    caption: '世界は1961〜2023年、日本の参照値は1960年度から。9品目群の生産／輸入／輸出と重量ベースの品目別自給率。旧・新FAOと農水省の違いを明記。',
    picker: '国土の色で品目別自給率を比較。選択国の芽と出入りする粒で、国の需給をたどる。', animation: 'harvest-exchange',
    source: 'https://data.fao.org/catalog/iso/2f264bb6-1238-459a-bf8b-0e2d0a16804a' },
  { id: 'food-security', number: '71', shortTitle: '食卓を支えるつながり',
    subtitle: '穀物の輸入依存と、供給の充足', signalLabel: 'FAO / 食料安全保障', dataFile: 'fao-food-security.json',
    caption: 'FAO公表の3年平均（2000年開始以降）。日本の穀物依存には1960年度以降の農水省数量から算出した別系列の参照値を追加。',
    picker: '国土の色で輸入依存・供給充足を比較。選択国の光の輪で、食卓を支える構造を見る。', animation: 'dependency-tides',
    source: 'https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539' },
].map(Object.freeze));

export function selfSufficiency(row) {
  const amounts = row?.slice(1, 4);
  if (!amounts || amounts.some(value => !Number.isFinite(value) || value < 0)) return null;
  const [production, imports, exports] = amounts, denominator = production + imports - exports;
  return denominator > 0 ? production / denominator * 100 : null;
}
export const foodValue = (kind, row) => kind === 'food-balances' ? selfSufficiency(row) : Number.isFinite(row?.[1]) ? row[1] : null;
export const foodRowSource = (kind, row) => kind === 'food-balances'
  ? row?.[7]?.source || { id: 'FBS', label: 'FAO新方式', periodUnit: '年' }
  : row?.[2] === 'MAFF_DERIVED' ? { id: 'MAFF', label: '農水省・3年度数量からの独自算出（参照値）', periodUnit: '年度', url: row[5].sourceUrl }
    : { id: 'FS', label: 'FAO公表の3年平均', periodUnit: '年' };
export const foodFlagText = (data, kind, row, flag) => (foodRowSource(kind, row).id === 'FBSH' ? data.historicFlags?.[flag] : data.flags[flag]) || flag || '記録なし';
export const foodFormat = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('ja-JP', { maximumFractionDigits: digits }) : '算出・数値なし';
export function foodAppearance(kind, seriesId, value) {
  if (!Number.isFinite(value)) return { color: '#9eaeb6', fraction: 0, radius: 3 };
  const ratio = kind === 'food-balances' ? value / 200 : seriesId === '21035' ? (value + 100) / 200 : (value - 70) / 100;
  const fraction = Math.min(1, Math.max(0, ratio));
  const stops = kind === 'food-balances' ? [[112, 174, 231], [142, 221, 166], [255, 217, 117]]
    : [[109, 207, 185], [183, 199, 221], [205, 160, 248]];
  const index = fraction < .5 ? 0 : 1, blend = fraction * 2 - index;
  return { fraction, color: `rgb(${stops[index].map((v, i) => Math.round(v + (stops[index + 1][i] - v) * blend)).join(', ')})`, radius: 4 + 6 * fraction };
}
export const foodGuide = (kind, seriesId) => kind === 'food-balances'
  ? '品目別自給率＝生産÷（生産＋輸入−輸出）×100。重量ベースで、カロリーベースの総合自給率ではありません。在庫変動はこの式に含めず、FAOの国内供給量そのものとも区別します。100%超もそのまま表示。欠測、負の数量、分母0以下は算出しません。'
  : seriesId === '21035'
    ? '穀物輸入依存度＝（輸入−輸出）÷（生産＋輸入−輸出）×100。FAO公表の3年平均値をそのまま収録。負の値は純輸出を示します。単年の自給率の裏返しとして比較しません。この指標だけで飢餓・危険度・安全性は判断できません。'
    : '平均食事エネルギー供給充足率は、人口平均の食事エネルギー供給量÷平均必要量×100。FAO公表の3年平均です。輸入依存度・自給率とは別の指標で、100%超でも全ての人に食料が行き渡ることは保証しません。';

export function buildFoodStatisticsDataset(data, definition, seriesId, selectedId) {
  const series = data.series.find(s => s.id === seriesId), country = data.countries.find(c => c.id === selectedId);
  if (!series || !country) return null;
  const balance = definition.id === 'food-balances', metric = balance ? '品目別自給率（重量）' : series.label;
  const observations = series.periods.map(p => {
    const sourceRow = p.rows.find(r => r[0] === selectedId);
    return { ...p, sourceRow, value: foodValue(definition.id, sourceRow) };
  });
  return { id: `${definition.id}-${seriesId}-${selectedId}`, modeId: definition.id, title: `${country.nameJa} / ${balance ? series.label + '・' : ''}${metric}`,
    rows: observations.filter(p => Number.isFinite(p.value)).map(p => ({ id: p.key, label: balance ? `${p.key}年` : `${p.key}年平均`, period: p.key,
      x: p.year, y: p.value, value: p.value, year: p.year, provenance: balance || p.sourceRow[2] === 'MAFF_DERIVED' ? 'DERIVED' : 'SOURCE',
      sourceSeries: foodRowSource(definition.id, p.sourceRow).id, sourceName: foodRowSource(definition.id, p.sourceRow).label,
      periodUnit: foodRowSource(definition.id, p.sourceRow).periodUnit,
      sourceFlags: balance ? p.sourceRow.slice(4, 7).map(f => foodFlagText(data, definition.id, p.sourceRow, f)).join(' / ') : foodFlagText(data, definition.id, p.sourceRow, p.sourceRow[2]) })),
    unit: '%', xKind: 'year', xLabel: balance ? '年' : '3年平均の中央年（期間は重複）', yLabel: metric, valueLabel: metric, defaultMethod: 'discovery',
    periodStart: observations[0].year, periodEnd: observations.at(-1).year, periodLabel: `${observations[0].key}〜${observations.at(-1).key}${balance ? '年' : '年平均'}`,
    missingPeriods: observations.filter(p => !Number.isFinite(p.value)).map(p => p.key), missingCount: observations.filter(p => !Number.isFinite(p.value)).length,
    // These are deterministic source ratios, not invented observations. Opening
    // this explicit metric may enable its derived rows; it never enables imputations.
    derivedFromSourceOnly: balance || observations.some(p => p.sourceRow?.[2] === 'MAFF_DERIVED'), provenance: balance ? ['DERIVED'] : observations.some(p => p.sourceRow?.[2] === 'MAFF_DERIVED') ? ['SOURCE', 'DERIVED'] : ['SOURCE'],
    insightContext: { domain: 'food', axis: 'time-series', measurementKind: balance ? 'DERIVED' : 'SOURCE', seriesId },
    sourceName: 'FAO / FAOSTAT・農水省参照値（出典は各行に保持）', sourceUrl: definition.source,
    comparisonNote: `${foodGuide(definition.id, seriesId)} ${data.historyNote || ''} 推計・補完値を含む公表統計です。出典の境目を同一方式の連続系列とみなさないでください。欠測は分析から除外。原因・飢餓・個人への分配は推定しません。` };
}
