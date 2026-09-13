// Pure dataset construction shared by map selection and saved-view restoration.
// Restoring an analysis must not switch the exhibition or its selected year.
export const buildAnnualStatisticsDataset = ({ data, definition, selectedId, history = {}, year, period, datasetId }) => {
  const cod = definition.id === 'japan-marine-cod';
  const reading = point => cod ? point?.cod : point?.metrics?.[definition.measurementKey] || point?.measurement;
  const periodLabel = value => `${value}${definition.periodUnit}`;
  const sourceUrl = definition.source;
  if (definition.category === 'chemicals') {
    const point = period?.stations.find(p => p.id === selectedId);
    if (!point) return null;
    const names = period.substanceNames || data.substanceNames;
    return { id: datasetId || `${definition.id}-${year}-${selectedId}`, modeId: definition.id, title: `${definition.metricLabel} — ${point.name}（${year}年度・物質別）`,
      titlePresentation: { metric: definition.metricLabel, name: point.name, period: `${year}年度`, breakdown: true },
      rows: point.substances.flatMap(row => {
        const value = definition.measurementKey === 'transfer' ? row[5] === null || row[6] === null ? null : row[5] + row[6] : row[definition.measurementKey === 'air' ? 1 : 2];
        return Number.isFinite(value) ? [{ id: row[0], label: names[row[0]], value, y: value, x: Number(row[0]), category: names[row[0]], provenance: 'SOURCE', year }] : [];
      }), unit: definition.unit, xKind: 'category', xLabel: '届出物質（番号は識別用）', yLabel: definition.metricLabel, valueLabel: definition.metricLabel,
      defaultMethod: 'discovery', provenance: ['SOURCE'], insightContext: { domain: 'prtr', axis: 'comparison', measurementKind: 'SOURCE', pollution: true, sensorMetric: definition.measurementKey },
      periodStart: year, periodEnd: year, sourceName: definition.sourceName, sourceUrl, comparisonNote: definition.comparisonNote + '\n\n物質ごとに毒性が異なり、量の大小を有害性の比較へ使いません。' };
  }
  const observations = data.periods.map(entry => ({ year: entry.year, point: history[entry.year] }));
  const first = observations.find(item => item.point)?.point;
  if (!first) return null;
  const start = data.periods[0].year, end = data.periods.at(-1).year;
  const missingPeriods = observations.filter(item => !Number.isFinite(reading(item.point)?.value)).map(item => item.year);
  return { id: `${definition.id}-${selectedId}`, modeId: definition.id,
    title: `${cod ? '沿岸COD' : definition.metricLabel} — ${first.water || '水域名未記載'} / ${first.name || '地点名未記載'}（${start}${start === end ? '' : `〜${end}`}${definition.periodUnit}）`,
    titlePresentation: { metric: cod ? '沿岸COD' : definition.metricLabel, name: [first.water, first.name].filter(Boolean).join(' / '), period: `${start}${start === end ? '' : `〜${end}`}${definition.periodUnit}` },
    rows: observations.filter(item => Number.isFinite(reading(item.point)?.value)).map(({ year: fiscalYear, point }) => ({
      id: String(fiscalYear), label: periodLabel(fiscalYear), x: fiscalYear, y: reading(point).value, value: reading(point).value,
      year: fiscalYear, period: periodLabel(fiscalYear), stationId: point.id, lat: point.lat, lon: point.lon, provenance: 'SOURCE' })),
    unit: definition.unit, xKind: 'year', xLabel: definition.periodUnit, yLabel: definition.metricLabel, valueLabel: definition.metricLabel, defaultMethod: 'discovery',
    provenance: ['SOURCE'], insightContext: { domain: cod ? 'marine-cod' : definition.category === 'biology' ? 'river-biology' : 'japan-sensor-open', axis: 'time-series', measurementKind: 'SOURCE', sensorMetric: definition.measurementKey, pollution: definition.sensorRegistrationKey === null },
    periodStart: start, periodEnd: end, coverageStart: start, coverageEnd: end,
    missingPeriods, missingCount: missingPeriods.length, sourceName: definition.sourceName, sourceUrl: first.sourceUrl || sourceUrl,
    comparisonNote: `${definition.explanation || ''}\n\n${definition.comparisonNote || '測定地点コードで照合できる公表年度。欠測は除外。名称・座標・採水条件が年度で変わる場合があり、長期傾向や原因を断定できません。年度平均CODを環境基準の達成率として扱わないでください。'}\n\n${data.historyNote || ''}` };
};
