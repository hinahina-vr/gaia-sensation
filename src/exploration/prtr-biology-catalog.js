// Reporting, occurrence and ambient concentration are deliberately separate.
import { ANNUAL_OBSERVATION_YEARS } from './annual-observation-years.js?v=history-20260912';
const prtrSource = 'https://www.env.go.jp/chemi/prtr/kaiji/index.html';
const riverSource = 'https://www.nilim.go.jp/lab/fbg/ksnkankyo/';
const prtr = [
  ['air', 'PRTR・空へ出た化学物質', '大気への届出排出量', '事業所から大気への排出を、光の上昇で読む。', 'air-flow'],
  ['water', 'PRTR・水域への化学物質', '公共用水域への届出排出量', '川・湖・海へ届け出られた量を、水色の流れで読む。', 'water-flow'],
  ['transfer', 'PRTR・事業所の外へ', '届出移動量（下水道＋廃棄物）', '排出とは別の、下水道と廃棄物への移動をたどる。', 'transfer-flow'],
].map(([key, shortTitle, metricLabel, subtitle, animation], index) => ({
  id: `japan-prtr-${key}`, number: String(65 + index), shortTitle, metricLabel, subtitle, animation,
  measurementKey: key, category: 'chemicals', years: ANNUAL_OBSERVATION_YEARS['japan-prtr-2022.json'], unit: 'kg/年度', dataFile: 'japan-prtr-2022.json',
  organisation: '環境省・経済産業省 / NITE', sourceName: 'PRTR個別事業所データ・事業所GIS', source: prtrSource,
  termsUrl: 'https://www.env.go.jp/mail.html', stops: [0, 10, 1000, 100000, 10000000], logScale: true,
  stationLabel: '事業所', countLabel: '事業所の届出', periodNote: '2018〜2022年度の座標付き保存値',
  explanation: '事業所の各年度の届出量を、同年度のNITE座標と整理番号で照合しました。kg単位の届出物質を合計し、mg-TEQ単位のダイオキシン類を除外しています。物質ごとの有害性で重み付けした値ではありません。',
  comparisonNote: 'PRTRは測定・物質収支・排出係数などに基づく届出で、周辺環境の濃度や危険度ではありません。届出対象外の発生源は含めず、地図の空白も排出ゼロを意味しません。座標を同年度で照合できる2018〜2022年度を収録。年度をまたぐ事業所IDの同一性は推定せず、分析は選択年度の物質別です。',
  animationNote: '点は事業所。選択・拡大時などに六角形と光の流れを表示します。排出先・移動区分を区別する演出で、拡散範囲・風向・実際の移動経路ではありません。量の桁差を対数目盛で表示します。',
  colors: key === 'air' ? ['#8eafff', '#9faff5', '#bcb1f7', '#e6b6ed', '#ffd4a1']
    : key === 'water' ? ['#7baffe', '#7ecce9', '#8cdeea', '#aedfed', '#d0efff'] : ['#a39beb', '#c2a4e4', '#d9b5df', '#efd4c8', '#ffe7aa'],
}));
const biology = [
  ['benthos', '川底の小さな生きもの', '底生生物の確認分類群数', '川底の貝・昆虫など、調査で出会った分類群をひらく。', 'benthos'],
  ['fish', '川を泳ぐ生きもの', '魚類の確認分類群数', '魚のシルエットから、河川で確認された名前へ。', 'fish'],
].map(([key, shortTitle, metricLabel, subtitle, animation], index) => ({
  id: `japan-river-${key}`, number: String(68 + index), shortTitle, metricLabel, subtitle, animation,
  measurementKey: key, category: 'biology', years: ANNUAL_OBSERVATION_YEARS[`japan-river-${key}.json`], unit: '分類群', dataFile: `japan-river-${key}.json`,
  organisation: '国土交通省 / 国総研', sourceName: '河川水辺の国勢調査 確認リスト・GIS', source: riverSource,
  termsUrl: 'https://www.nilim.go.jp/aboutlink.htm', stops: key === 'fish' ? [0, 10, 30, 50, 90] : [0, 30, 90, 180, 300],
  stationLabel: '調査地区', countLabel: '地区の確認記録', regionLabel: '地方',
  regionNames: { 81: '北海道', 82: '東北', 83: '関東', 84: '北陸', 85: '中部', 86: '近畿', 87: '中国地方', 88: '四国', 89: '九州' },
  explanation: '河川水辺の国勢調査の確認リストを、調査管理番号・地区番号で公開GISと照合。同じ地区・年度の種コードを重複除去した確認分類群数です。属・科などの同定も含むため、厳密な種数ではありません。地区・年度ごとの原表の名前を保持し、同一コードの異なる表記も併記します。分類名の訂正や同義語への統一はしていません。',
  comparisonNote: '北海道〜九州の9地方の河川調査（ダム調査・沖縄を含みません）。年度ごとに調査地区・方法・季節・同定精度が異なります。記録なしは不在や絶滅を意味せず、分類群数を生息密度・生物多様性の順位・水質等級・腐水性階級へ変換しません。地区代表点は個体の採集位置ではありません。',
  animationNote: '魚・小さな脚のシルエットは調査区分の象徴で、確認種そのものの外見や個体数ではありません。動きは地点の周りだけの演出。生息範囲や泳ぐ方向を推定していません。',
  colors: key === 'fish' ? ['#83c9df', '#82d6df', '#a3e8dd', '#c5eed8', '#e5f5b3'] : ['#9ab9cf', '#9bcac7', '#b6ded0', '#d5eac0', '#f2e5b0'],
}));
export const PRTR_BIOLOGY_EXHIBITS = Object.freeze([...prtr, ...biology].map(item => Object.freeze({
  ...item, years: Object.freeze(item.years), stops: Object.freeze(item.stops), colors: Object.freeze(item.colors),
  title: item.shortTitle, signalLabel: item.metricLabel, periodUnit: '年度', sensorRegistrationKey: null,
  caption: `${item.explanation} ${item.comparisonNote}`, picker: `${item.years[0]}${item.years.length > 1 ? `〜${item.years.at(-1)}` : ''}年度。${item.subtitle}`,
  sensorNote: '公的な届出・生物確認記録です。ESP32の測定値ではなく、簡易センサーの値へ換算していません。',
})));

export const displayFraction = (definition, value) => {
  const transform = n => definition.logScale ? Math.log10(1 + n) : n;
  const low = transform(definition.stops[0]), high = transform(definition.stops.at(-1));
  return (transform(Math.max(definition.stops[0], Math.min(definition.stops.at(-1), value))) - low) / (high - low);
};
export const recordAppearance = (definition, value) => {
  if (!Number.isFinite(value)) return { color: '#abb5be', radius: 2.2 };
  const amount = displayFraction(definition, value), scaled = amount * (definition.colors.length - 1);
  const low = Math.floor(scaled), high = Math.min(low + 1, definition.colors.length - 1), blend = scaled - low;
  const rgb = hex => hex.match(/[a-f0-9]{2}/gi).map(n => parseInt(n, 16));
  const a = rgb(definition.colors[low]), b = rgb(definition.colors[high]);
  return { color: `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * blend)).join(', ')})`, radius: 2.5 + Math.sqrt(amount) * 4.5 };
};
