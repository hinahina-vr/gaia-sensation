// Build the source index from the same catalogues and metadata as the exhibits.
// This is an inventory, not a new licence decision or a data download.
import fs from 'node:fs';
import path from 'node:path';
import { ESTAT_EXHIBITS } from '../src/exploration/estat-exhibit-catalog.js';
import { MARINE_COD_EXHIBIT } from '../src/exploration/marine-cod-catalog.js';
import { JAPAN_SENSOR_OPEN_EXHIBITS } from '../src/exploration/japan-sensor-open-catalog.js';
import { JAPAN_POLLUTION_EXHIBITS } from '../src/exploration/japan-pollution-catalog.js';
import { PRTR_BIOLOGY_EXHIBITS } from '../src/exploration/prtr-biology-catalog.js';
import { FOOD_EXHIBITS } from '../src/exploration/food-catalog.js';

export function mediaDataSources(root, providers) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const rows = [];
  const add = (section, id, provider, datasetId, sourceUrl, retrievalPolicy, evidence, extra = {}) => {
    rows.push({ section, id, provider, datasetId, sourceUrl, retrievalPolicy, evidence, termsUrl: null, ...extra });
  };
  const section = 'ライブ・モデル取得';
  add(section, 'firms-live', 'NASA LANCE FIRMS', 'MAP 01 / MODIS C6.1 NRT 火災・熱異常',
    'https://firms.modaps.eosdis.nasa.gov/active_fire/', 'サイトAPI経由・15分キャッシュ。直近24時間を抽出。失敗時は保存値。火災の境界ではない。', 'sensor-platform/src/live-senseware.ts');
  add(section, 'weather-live', 'Open-Meteo', 'MAP 02・05・15・17–19 / 風・気象・雲',
    'https://open-meteo.com/en/docs', '全球はブラウザ取得・5分タブ内キャッシュ。日本はサイトAPI経由。保存値・演出用サンプルを現在値と区別。', 'src/exploration/live-exhibits.js');
  add(section, 'air-live', 'Open-Meteo / CAMS', 'MAP 03・16・20 / 大気質・格子CO₂・PM2.5',
    'https://open-meteo.com/en/docs/air-quality-api', '予報モデルの格子値。全球はブラウザ取得、日本はサイトAPI経由。地上観測の実測とは区別。', 'sensor-platform/src/live-senseware.ts');
  add(section, 'usgs-live', 'USGS', 'MAP 04 / All Earthquakes Past Day',
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php', 'ブラウザ取得・5分タブ内キャッシュ。波紋は被害範囲や震度分布ではない。', 'src/exploration/live-exhibits.js');

  const gaia = read('data/gaia-signals.json');
  for (const mode of gaia.modes) for (const d of mode.datasets) {
    const auxiliary = d.id === 'oscar';
    const derived = d.kind !== 'SOURCE';
    add(auxiliary ? '補助・未使用の取得経路' : derived ? '独自加工・シナリオ' : '世界展示・基礎データ', d.id,
      d.organisation, d.title, d.url,
      auxiliary ? '取得候補。現行海流値はNOAA CoastWatchを使用。OSCAR取得済みとは扱わない。'
        : d.id === 'noaa-ovation-aurora' ? '5分更新の予報。失敗時は同梱スナップショット。'
        : derived ? `${d.kind}：原観測と区別した独自計算・仮定。` : '同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。',
      'data/gaia-signals.json', { modeId: mode.id, period: d.period, retrievedAt: d.retrievedAt || null,
        transformation: d.transformation || null, termsUrl: d.termsUrl || null });
  }

  const estat = read('data/estat-prefecture-series.json');
  for (const d of ESTAT_EXHIBITS) {
    const years = estat.periodsBySeries?.[d.key] || Object.keys(estat[d.key] || {}).sort();
    add('日本の公的統計・観測（MAP 21–69）', d.id, d.provider, `MAP ${d.number} / ${d.valueLabel}`, d.source,
      '取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。', 'data/estat-prefecture-series.json',
      { period: `${years[0]}–${years.at(-1)}`, sourceName: d.sourceName, generatedAt: estat.generatedAt });
  }
  const domestic = [ { ...MARINE_COD_EXHIBIT, dataFile: 'japan-marine-cod.json', organisation: '環境省' },
    ...JAPAN_SENSOR_OPEN_EXHIBITS, ...JAPAN_POLLUTION_EXHIBITS, ...PRTR_BIOLOGY_EXHIBITS ];
  for (const d of domestic) {
    const file = `data/${d.dataFile}`, data = read(file);
    const years = data.periods.map(p => p.year).sort((a, b) => a - b);
    add('日本の公的統計・観測（MAP 21–69）', d.id, d.organisation, `MAP ${d.number} / ${d.metricLabel || d.signalLabel}`, d.source,
      '年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。', file,
      { period: `${years[0]}–${years.at(-1)}${d.periodUnit || '年度'}`, sourceName: d.sourceName,
        retrievedAt: data.historyRetrievedOn || data.retrievedOn || null, termsUrl: d.termsUrl || data.licenseUrl || null,
        transformation: data.attribution || d.explanation || null });
  }
  for (const d of FOOD_EXHIBITS) {
    const file = `data/${d.dataFile}`, data = read(file);
    add('食料（MAP 70–71）', d.id, 'FAO', `MAP ${d.number} / ${data.source.name}`, data.source.catalogUrl,
      d.caption, file, { termsUrl: data.termsUrl, retrievedAt: data.retrievedAt, transformation: data.historyNote || null });
    for (const extra of data.additionalSources || []) {
      add('食料（MAP 70–71）', `${d.id}-${extra.id}`, extra.id === 'MAFF' ? '農林水産省 / e-Stat' : 'FAO',
        extra.sourceName || `FAOSTAT ${extra.id} / 旧方式の食料需給表`, extra.catalogUrl || extra.url,
        '同梱の追加系列。FAO旧・新方式と日本の年度系列を区別。独自算出は公式指標と同一視しない。', file,
        { retrievedAt: extra.retrievedAt || extra.sources?.[0]?.retrievedAt || null, sourceFiles: extra.sources || [] });
    }
  }
  for (const d of read('data/space-signals.json').sources) {
    add('ORBITAL・STORY・GX', d.id, d.organisation, d.title, d.url, 'ORBITALの保存スナップショット。閲覧中の外部API取得なし。',
      'data/space-signals.json', { period: d.period, retrievedAt: d.retrievedAt, transformation: d.transformation });
  }
  const temperature = read('data/story-temperature-annual.json');
  add('ORBITAL・STORY・GX', 'story-gistemp', temperature.provider, temperature.dataset, temperature.sourceUrl,
    'STORY用。1958–2025年の月次2°格子を年平均に加工し同梱。全球平均系列とは別。', 'data/story-temperature-annual.json',
    { retrievedAt: temperature.retrievedAt, transformation: temperature.method });
  for (const d of read('data/gx-deep-time.json').sources) {
    add('ORBITAL・STORY・GX', d.id, d.provider, d.title, d.url, `GXの解説参照：${d.usedFor || '地球史の背景説明'}。数値のライブ観測ではない。`, 'data/gx-deep-time.json');
  }
  for (const [id, provider, title, url, policy, file] of [
    ['natural-earth', 'Natural Earth', '世界の陸地・国境', 'https://www.naturalearthdata.com/about/terms-of-use/', '加工した地図形状を同梱。', 'data/natural-earth-50m-land.geojson'],
    ['gsi-boundaries', '国土地理院 / 地球地図日本', '47都道府県境界', 'https://www.gsi.go.jp/kankyochiri/gm_jpn.html', 'TopoJSONへ変換。個別の出典・加工記録を保持。', 'data/japan-prefectures-NOTICE.md'],
    ['osm', 'OpenStreetMap contributors', 'センサー登録画面の都市地図', 'https://operations.osmfoundation.org/policies/tiles/', '閲覧時のタイル取得。画面内帰属表示。一括保存しない。', 'docs/DATA_SOURCES.md'],
    ['cldr', 'Unicode CLDR', '国・行政区分コード', 'https://cldr.unicode.org/', 'コード・英語名を収録。許諾文は地域コード出典を参照。', 'docs/REGION-CODE-SOURCES.md'],
    ['jlis', 'J-LIS', '全国地方公共団体コード', 'https://www.j-lis.go.jp/spd/code-address/jititai-code.html', '自治体コードと名称を収録。', 'docs/REGION-CODE-SOURCES.md'],
    ['gsi-office', '国土地理院', '自治体庁舎の初期POI', 'https://maps.gsi.go.jp/', '登録画面の編集可能な初期座標。端末の実位置ではない。', 'docs/REGION-CODE-SOURCES.md'],
  ]) add('地図・地域コード', id, provider, title, url, policy, file);
  // Keep legacy providers visible without implying that all are active exhibits.
  for (const [i, d] of providers.entries()) rows.push({ ...d, id: `legacy-provider-${i}`, section: '補助・未使用の取得経路',
    evidence: 'sensor-platform/src/live-senseware.ts', retrievalPolicy: `補助provider（設定依存・現行展示での使用とは別）：${d.retrievalPolicy}` });
  return rows;
}

export function renderDataSources(sources) {
  const escape = text => String(text ?? '—').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
  return [...new Set(sources.map(s => s.section))].map(section => `### ${section}\n\n| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |\n|---|---|---|---|\n` +
    sources.filter(s => s.section === section).map(s => {
      const url = /^\.\//.test(s.sourceUrl) ? `../${s.sourceUrl.slice(2)}` : s.sourceUrl;
      const provider = url === 'about:local' ? escape(s.provider) : `[${escape(s.provider)}](${url})`;
      return `| ${provider} | ${escape(s.datasetId)}${s.period ? `<br>${escape(s.period)}` : ''} | ${escape(s.retrievalPolicy)} | [記録](../${s.evidence}) |`;
    }).join('\n')).join('\n\n');
}
