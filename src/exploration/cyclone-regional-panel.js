import { format } from './climate-history-model.js?v=insights75-scope-20261026';
import { regionalSummary } from './cyclone-regional-model.js?v=whole-trends20-20261025';

let payload, pending, dialog, opener, wantedYear = 2016;
const q = selector => dialog.querySelector(selector);
async function load() {
  if (payload) return payload;
  if (!pending) pending = fetch(new URL('../../data/climate-history/cyclone-regions.json?v=regions-20261018', import.meta.url), {signal:AbortSignal.timeout(15000)})
    .then(async response => {
      if (!response.ok) throw new Error(`Regional data HTTP ${response.status}`);
      const result = await response.json();
      if (result.schemaVersion !== 1 || result.radiusKm !== 300 || !result.regions?.length
          || result.regions.some(region => region.years?.length !== 45)) throw new Error('Invalid regional summary');
      payload = result; return result;
    }).finally(() => { pending = null; });
  return pending;
}
function tableRows(values) {
  return values.map(cells => {
    const tr = document.createElement('tr');
    for (const [index, value] of cells.entries()) {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value; tr.append(cell);
    }
    return tr;
  });
}
function render() {
  const region = payload.regions.find(item => item.id === q('[data-region-place]').value);
  const year = Number(q('[data-region-year]').value), summary = regionalSummary(region, year);
  const {row, speed, wind} = summary;
  q('[data-region-location]').textContent = `${region.name}（${region.lat}°, ${region.lon}°）を中心に半径300 km · 全海域の経路を集計`;
  q('[data-region-insight]').textContent = summary.insight;
  q('[data-region-count]').textContent = `${row.count}件`;
  q('[data-region-speed]').textContent = speed === null ? '記録不足' : `${format(speed)} km/h`;
  q('[data-region-speed-note]').textContent = `${row.speedTracks}/${row.count}経路・合計${format(row.hours)}時間の有効区間`;
  q('[data-region-wind]').textContent = wind === null ? '記録なし' : `${format(wind)} m/s`;
  const name = row.peak?.name && row.peak.name !== 'NOT_NAMED' ? row.peak.name : row.peak?.id;
  q('[data-region-wind-note]').textContent = `${name ? `${name} · ` : ''}風速あり ${row.measured}/${row.count}経路`;
  q('[data-region-month-heading]').textContent = `${year} / 全45シーズン`;
  q('[data-region-months]').replaceChildren(...tableRows(summary.months.map((count,i) => [`${i+1}月`,`${row.months[i]} / ${count}件`])));
  q('[data-region-decades]').replaceChildren(...tableRows(summary.decades.map(item => [`${item.start}–${item.end}`,`${format(item.average)}件`,`${item.count}件 / ${item.seasons}期`])));
  q('[data-region-source]').textContent = `NOAA IBTrACS v4r01 / MAIN経路 / 取得 ${payload.sourceRetrievedAt.slice(0,10)}`;
  dialog.dataset.region = region.id; dialog.dataset.year = String(year);
}
async function populate() {
  q('[data-region-status]').textContent = '地域別の集計を読み込んでいます…';
  q('[data-region-retry]').hidden = true; q('[data-region-content]').hidden = true;
  dialog.setAttribute('aria-busy','true');
  try {
    await load();
    q('[data-region-place]').replaceChildren(...payload.regions.map(region => new Option(region.name,region.id)));
    q('[data-region-year]').replaceChildren(...payload.regions[0].years.map(row => new Option(`${row.year}シーズン`,String(row.year))));
    q('[data-region-year]').value = String(wantedYear);
    render(); q('[data-region-content]').hidden = false; q('[data-region-status]').textContent = '';
  } catch {
    q('[data-region-status]').textContent = '地域別の集計を読み込めませんでした。'; q('[data-region-retry]').hidden = false;
  } finally { dialog.setAttribute('aria-busy','false'); }
}
function mount() {
  dialog = document.createElement('dialog'); dialog.className = 'gaia-cyclone-regions';
  dialog.setAttribute('aria-labelledby','cyclone-region-title');
  dialog.innerHTML = `<header><div><small>72 嵐が残した道</small><h2 id="cyclone-region-title">地域への接近を調べる</h2></div><button type="button" data-region-close aria-label="地域別分析を閉じる" autofocus>×</button></header>
    <div class="gaia-cyclone-region-body"><p data-region-status role="status"></p><button type="button" data-region-retry hidden>再試行</button>
    <div data-region-content hidden><div class="gaia-cyclone-region-controls"><label>地域<select data-region-place></select></label><label>期間<select data-region-year></select></label></div>
    <p data-region-location class="gaia-cyclone-region-note"></p><p data-region-insight class="gaia-cyclone-region-insight" aria-live="polite"></p>
    <dl class="gaia-cyclone-region-kpis"><div><dt>接近した経路</dt><dd data-region-count></dd><small>同じ嵐は1シーズンに1件</small></div><div><dt>圏内の平均移動速度</dt><dd data-region-speed></dd><small data-region-speed-note></small></div><div><dt>圏内の最大1分平均風速</dt><dd data-region-wind></dd><small data-region-wind-note></small></div></dl>
    <div class="gaia-cyclone-region-tables"><table><caption>接近が集中する月（UTC）</caption><thead><tr><th scope="col">最接近月</th><th scope="col" data-region-month-heading></th></tr></thead><tbody data-region-months></tbody></table>
    <div><table><caption>年代別の接近数</caption><thead><tr><th scope="col">シーズン</th><th scope="col">1期平均</th><th scope="col">合計 / 期数</th></tr></thead><tbody data-region-decades></tbody></table>
    <p class="gaia-cyclone-region-note">2020–2024は5シーズン分。比較には1期あたりの平均を使います。</p></div></div>
    <details><summary>集計方法と出典</summary><p>都市の代表座標から300 km以内に中心の位置記録があるMAIN経路を、シーズンごとに1件として数えます。低気圧の各段階を含み、強さによる絞り込みはしていません。月は最も近かった記録時刻（UTC）で決めます。南半球のシーズンは暦年をまたぎます。</p><p>移動速度は、両端が圏内にある6時間以内の隣接記録の大円距離を合計し、合計時間で割った値です。風速は圏内のUSA_WINDの最大値をm/sに換算。欠測は各指標から除外し、有効な経路数を併記しています。</p><p>記録には補間時刻を含みます。記録点の間だけを通った接近は集計外です。観測・対象体制の変化も件数に影響します。</p><a href="https://www.ncei.noaa.gov/products/international-best-track-archive" target="_blank" rel="noopener noreferrer" data-region-source></a></details></div></div>`;
  document.body.append(dialog);
  q('[data-region-close]').addEventListener('click',()=>dialog.close());
  q('[data-region-retry]').addEventListener('click',()=>void populate());
  for (const selector of ['[data-region-place]','[data-region-year]']) q(selector).addEventListener('change',render);
  for (const type of ['keydown','keyup','pointerdown','wheel']) dialog.addEventListener(type,event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});});
}
export function closeRegionalAnalysis() { if (dialog?.open) dialog.close(); }
export function openRegionalAnalysis({year=2016, trigger} = {}) {
  if (!dialog) mount();
  if (dialog.open) return;
  wantedYear = year; opener = trigger || document.activeElement;
  dialog.showModal(); void populate();
}
