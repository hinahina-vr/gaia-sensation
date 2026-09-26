import { animateMetricText } from '../shared/animated-metric.js';
import { earthBaseScale, earthLongitudeToMapX } from './world-projection.js?v=gaia-japan-center-1';
import { japanPrefectureView } from './japan-prefecture-view.js?v=gaia-prefecture-gis-view-1';
import { pickProjectedPoi } from './poi-hit-test.js?v=gaia-japan-center-1';
import { decorateMapActions } from './map-exhibit-actions.js?v=action-icons-ready-20260926';
import { FOOD_EXHIBITS, foodValue, foodFormat, foodAppearance, foodGuide, foodRowSource, foodFlagText, buildFoodStatisticsDataset } from './food-catalog.js?v=food-history-20260912';
import { drawFoodMark } from './food-drawing.js?v=fao-food-1';
import { drawFoodCountryFill, pickFoodCountry } from './food-country-fill.js?v=fao-food-country-fill-1';
import { poiArrival, poiArrivalDuration } from './annual-poi-arrival.js?v=gaia-annual-pop-20260909';
import { initialObservationIndex } from './initial-observation-year.js?v=2016-20260926';

const cache = new Map(), requests = new Map(), buttons = new Map(), saved = new Map();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let definition = FOOD_EXHIBITS[0], data, layer, map, canvas, context, readout, legend;
let active = false, generation = 0, dataState = 'idle', seriesId = '', periodKey = '', selectedId = '392';
let playing = false, frame = 0, lastFrame = 0, lastPeriod = 0, motionTime = 0, arrivalStart = null;
let points = [], selectedRows = new Map(), visible = new Set();
let geometrySource, countryShapes = [], countryLocations = new Map(), fillCanvas, fillContext, fillKey = '';
const q = selector => readout.querySelector(selector) || legend.querySelector(selector);
const balance = () => definition.id === 'food-balances';
const series = () => data?.series.find(item => item.id === seriesId);
const period = () => series()?.periods.find(item => item.key === periodKey);
const country = () => data?.countries.find(item => item.id === selectedId);
const row = () => selectedRows.get(selectedId);
const metric = () => balance() ? '品目別自給率（重量）' : series()?.label || 'FAO公表指標';
const textValue = value => Number.isFinite(value) ? `${foodFormat(value)} %` : '算出・数値なし';
const emit = (name, detail = {}) => dispatchEvent(new CustomEvent(`gaia:food-${name}`, { detail: { active, id: definition.id, ...detail } }));
const load = target => {
  if (cache.has(target.id)) return Promise.resolve(cache.get(target.id));
  if (!requests.has(target.id)) requests.set(target.id, fetch(new URL(`../../data/${target.dataFile}?v=food-history-20260912`, import.meta.url), { signal: AbortSignal.timeout(20000) })
    .then(async response => {
      if (!response.ok) throw new Error(`FAO snapshot HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.schemaVersion !== 1 || !payload.countries?.length || !payload.series?.length || !payload.series.every(s => s.periods?.length)) throw new Error('Invalid FAO snapshot');
      cache.set(target.id, payload); return payload;
    }).finally(() => requests.delete(target.id)));
  return requests.get(target.id);
};
const projection = () => {
  const rect = globalThis.GaiaMapObservationAdapter?.getViewportRect?.() || map.getBoundingClientRect();
  const d = document.querySelector('#japan-overlay').dataset, scale = earthBaseScale(rect) * Math.max(1, Number(d.earthZoom) || 1);
  return { rect, scale, originX: (rect.width - 360 * scale) / 2 + (Number(d.earthOffsetX) || 0), originY: (rect.height - 180 * scale) / 2 + (Number(d.earthOffsetY) || 0) };
};
const focusAll = () => globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: 150, lat: 12, zoom: 1, targetX: .5, targetY: .43, durationMs: 500, label: 'food-world' });
const stopDemo = () => globalThis.GaiaMapDemo?.stop?.('interaction');
const setPlaying = value => {
  playing = Boolean(value) && dataState === 'ready' && series()?.periods.length > 1; lastPeriod = performance.now();
  q('[data-food-play]').textContent = playing ? '自動表示をやめる' : '自動表示する';
  q('[data-food-play]').setAttribute('aria-pressed', String(playing));
};
const save = () => { if (dataState === 'ready') saved.set(definition.id, { seriesId, periodKey, selectedId }); };
const snapshotStatus = () => `保存統計 / ${series()?.periods[0].key}–${series()?.periods.at(-1).key} / ${foodRowSource(definition.id, row()).label}`;
const countryOptionLabel = c => `${c.nameJa}${countryLocations.has(c.id) || (!geometrySource && Number.isFinite(c.lon)) ? '' : '（地図形状なし）'}`;
const refreshPoints = () => {
  points = data.countries.map(c => ({ ...c, lon: c.lon ?? countryLocations.get(c.id)?.lon, lat: c.lat ?? countryLocations.get(c.id)?.lat, row: selectedRows.get(c.id) }))
    .filter(c => Number.isFinite(c.lon) && Number.isFinite(c.lat));
};
const syncCountryGeometry = () => {
  const adapter = globalThis.GaiaMapObservationAdapter, geometry = adapter?.getCountryGeometry?.();
  const state = geometry?.state || 'loading';
  canvas.dataset.foodGeometryState = state;
  const status = state === 'ready' ? snapshotStatus() : `${snapshotStatus()} / ${state === 'error' ? '国境図形を読み込めません。再試行できます。' : '国境図形を読込中…'}`;
  if (q('[data-food-status]').textContent !== status) q('[data-food-status]').textContent = status;
  q('[data-food-retry]').hidden = state !== 'error';
  if (state !== 'ready') return false;
  if (geometrySource !== geometry.countries) {
    geometrySource = geometry.countries;
    countryLocations = new Map(geometry.countries.map(c => [c.id,c]));
    countryShapes = geometry.countries.map(c => ({ ...c, path: adapter.getCountryPath(c.iso3) })).filter(c => c.path);
    fillKey = ''; refreshPoints();
    for (const option of q('[data-food-country]').options) {
      const c = data.countries.find(c => c.id === option.value);
      if (c) option.textContent = countryOptionLabel(c);
    }
  }
  return true;
};
const renderGuide = () => {
  q('[data-food-metric]').textContent = metric();
  q('[data-food-guide]').textContent = `${foodGuide(definition.id, seriesId)} ${data.historyNote || ''}`;
  q('[data-food-position]').textContent = '国境は展示13と共通のNatural Earth 50m。各国・地域自身のM49コードで数値を対応づけます。境界形状のない地域・旧国家の値を他国へ付け替えません。選択国の記号は代表位置で、農地・港・貿易経路ではありません。';
  q('[data-food-attribution]').textContent = `${data.attribution} 取得 ${data.retrievedAt.slice(0, 10)}。推計・補完値を含みます。`;
  q('[data-food-motion]').textContent = balance()
    ? '国土の色＝品目別自給率。選択国だけに芽と、水色の輸入・橙の輸出の粒を添えます。粒数は数量の対数目安で、実際の航路や移動速度ではありません。'
    : seriesId === '21035' ? '国土の色＝穀物輸入依存度。選択国の輪は正の値で内向き、負の値（純輸出）で外向き。指標をもとにした模式演出で、実際の航路ではありません。'
      : '国土の色＝平均食事エネルギー供給充足率。選択国の呼吸するような輪は供給水準の模式演出で、食料の移動や分配ではありません。';
  const stops = balance() ? [0, 100, 200] : seriesId === '21035' ? [-100, 0, 100] : [70, 120, 170];
  q('[data-food-scale]').style.background = `linear-gradient(90deg, ${stops.map(value => foodAppearance(definition.id, seriesId, value).color).join(',')})`;
  q('[data-food-scale-labels]').textContent = `${stops[0]}%以下　　${stops[1]}%　　${stops[2]}%以上`;
  q('[data-food-legend-title]').textContent = metric();
  q('[data-food-period-kind]').textContent = balance() ? '年次 · 9品目群（全食料の合算ではありません）' : 'FAO公表 · 3年平均（隣り合う期間は重複）';
};
const render = () => {
  const current = period(); if (!current) return;
  selectedRows = new Map(current.rows.map(r => [r[0], r]));
  refreshPoints();
  // Source/provenance must change with the value, not on a later animation frame.
  syncCountryGeometry();
  const r = row(), value = foodValue(definition.id, r);
  q('[data-food-country]').value = selectedId;
  q('[data-food-series]').value = seriesId;
  q('[data-food-year]').value = String(series().periods.indexOf(current));
  const source = foodRowSource(definition.id, r);
  q('[data-food-period]').textContent = balance() ? `${periodKey}${source.periodUnit}` : `${periodKey}${source.periodUnit}${source.id === 'MAFF' ? '参照' : '平均'}`;
  animateMetricText(q('[data-food-value]'), textValue(value), `${definition.id}/${seriesId}`);
  q('[data-food-value]').style.color = foodAppearance(definition.id, seriesId, value).color;
  q('[data-food-amounts]').textContent = balance()
    ? `生産 ${foodFormat(r?.[1])} / 輸入 ${foodFormat(r?.[2])} / 輸出 ${foodFormat(r?.[3])} 千t`
    : `${country()?.nameJa || '国を選択'} · ${r ? data.flags[r[2]] || r[2] : 'この期間は記録なし'}`;
  const measured = current.rows.filter(r => Number.isFinite(foodValue(definition.id, r))).length;
  q('[data-food-count]').textContent = `${measured}国・地域に数値 / ${data.countries.length - measured}は算出・数値なし。空白は0ではありません。`;
  q('[data-food-quality]').textContent = balance() ? `${source.label} / ` + ['生産', '輸入', '輸出'].map((label, i) => `${label}: ${foodFlagText(data, definition.id, r, r?.[i + 4])}`).join(' / ')
    : `${r ? data.flags[r[2]] || r[2] : '記録なし'}${r?.[4] ? ` / ${r[4]}` : ''}`;
  q('[data-food-analysis]').disabled = !series().periods.some(p => Number.isFinite(foodValue(definition.id, p.rows.find(r => r[0] === selectedId))));
  readout.dataset.foodSelectedCountry = selectedId; readout.dataset.foodPeriodKey = periodKey;
  canvas.dataset.foodRecordCount = String(measured); canvas.dataset.foodPeriodKey = periodKey;
  save();
};
const setPeriod = key => {
  if (!active || dataState !== 'ready' || !series().periods.some(p => p.key === String(key))) return false;
  periodKey = String(key); globalThis.GaiaMapObservationAdapter?.closePoi?.(); render(); return true;
};
const selectCountry = (id, { focus = true } = {}) => {
  const c = points.find(c => c.id === id) || data?.countries.find(c => c.id === id); if (!c || dataState !== 'ready') return false;
  selectedId = id; render();
  if (focus && Number.isFinite(c.lon) && Number.isFinite(c.lat)) {
    const rect = map.getBoundingClientRect();
    const headingBottom = layer.querySelector('.japan-heading').getBoundingClientRect().bottom;
    const top = (innerWidth <= 900 && innerHeight > innerWidth && !legend.hidden ? Math.max(headingBottom, legend.getBoundingClientRect().bottom + 6) : headingBottom) - rect.top;
    const bottom = readout.getBoundingClientRect().top - rect.top;
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: c.lon, lat: c.lat, zoom: Math.max(3, Number(document.querySelector('#japan-overlay').dataset.earthZoom) || 1),
      targetX: .5, targetY: Math.max(.2, Math.min(.6, (top + bottom) / 2 / rect.height)), durationMs: 500, label: `food-${id}` });
  }
  return true;
};
const setSeries = id => {
  if (!data?.series.some(s => s.id === id) || dataState !== 'ready') return false;
  seriesId = id;
  if (!series().periods.some(p => p.key === periodKey)) {
    // Three-year averages use their source midpoint (2015–2017 => 2016).
    periodKey = series().periods[initialObservationIndex(series().periods, p => p.year)].key;
  }
  q('[data-food-year]').max = String(series().periods.length - 1);
  setPlaying(false); globalThis.GaiaMapObservationAdapter?.closePoi?.(); renderGuide(); render(); return true;
};
const statisticsDataset = () => active && dataState === 'ready' ? buildFoodStatisticsDataset(data, definition, seriesId, selectedId) : null;
const restoreStatisticsDataset = async id => {
  const match = /^(food-(?:balances|security))-(\d+)-(\d{3})$/.exec(id);
  if (!match) return null;
  const target = FOOD_EXHIBITS.find(d => d.id === match[1]);
  return buildFoodStatisticsDataset(await load(target), target, match[2], match[3]);
};
const draw = time => {
  frame = 0;
  if (!active || !data || dataState !== 'ready' || document.hidden || layer.getAttribute('aria-hidden') === 'true') return;
  frame = requestAnimationFrame(draw);
  if (time - lastFrame < 1000 / 24) return;
  const elapsed = Math.min(100, time - lastFrame); lastFrame = time;
  const paused = globalThis.GaiaModeEntryGuide?.getState?.()?.active || globalThis.GaiaStatisticsLab?.getState?.()?.open || layer.classList.contains('is-map-title-transitioning');
  if (!paused && !reduced.matches) motionTime += elapsed;
  if (paused) lastPeriod = time;
  if (playing && !paused && time - lastPeriod > 4000) { const ps = series().periods; setPeriod(ps[(ps.indexOf(period()) + 1) % ps.length].key); lastPeriod = time; }
  const view = projection(), { rect } = view, ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1800000 / (rect.width * rect.height)));
  const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, rect.width, rect.height); visible.clear();
  if (layer.classList.contains('is-map-title-transitioning')) { arrivalStart = null; canvas.dataset.foodArrivalState = 'waiting'; return; }
  if (!syncCountryGeometry()) { fillKey = ''; canvas.dataset.foodFilledCountryCount = '0'; canvas.dataset.foodArrivalState = 'waiting'; return; }
  if (arrivalStart === null && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running') arrivalStart = time;
  const arrivalTime = arrivalStart === null ? -1 : time - arrivalStart;
  const arrived = arrivalTime >= 0 && (reduced.matches || arrivalTime >= poiArrivalDuration(Math.max(points.length,countryShapes.length)));
  canvas.dataset.foodArrivalState = arrivalTime < 0 ? 'waiting' : arrived ? 'complete' : 'running';
  const key = [width,height,view.originX,view.originY,view.scale,definition.id,seriesId,periodKey,selectedId,arrived].join('|');
  if (key !== fillKey || !arrived) {
    fillKey = key;
    if (fillCanvas.width !== width || fillCanvas.height !== height) { fillCanvas.width = width; fillCanvas.height = height; }
    fillContext.setTransform(ratio,0,0,ratio,0,0); fillContext.clearRect(0,0,rect.width,rect.height);
    const painted = drawFoodCountryFill(fillContext, { view, shapes:countryShapes, rows:selectedRows, kind:definition.id, seriesId, selectedId, arrivalTime, reduced:reduced.matches });
    canvas.dataset.foodFilledCountryCount = String(painted.filledCount);
    canvas.dataset.foodMeasuredCountryCount = String(painted.measuredCount);
    canvas.dataset.foodFillSeriesId = seriesId; canvas.dataset.foodFillPeriodKey = periodKey; canvas.dataset.foodFillSelectedId = selectedId;
    canvas.dataset.foodFillPaintCount = String(Number(canvas.dataset.foodFillPaintCount || 0)+1);
  }
  context.drawImage(fillCanvas,0,0,rect.width,rect.height);
  canvas.dataset.foodEncoding = 'country-choropleth';
  for (const shape of countryShapes) visible.add(shape.id);
  for (const [index, point] of points.entries()) {
    // Country fills carry the comparison. Retain the two different motifs
    // only at the selected country's representative point, without map clutter.
    if (point.id !== selectedId) continue;
    const x = view.originX + earthLongitudeToMapX(point.lon) * view.scale, y = view.originY + (90 - point.lat) * view.scale;
    if (x < -40 || y < -40 || x > rect.width + 40 || y > rect.height + 40) continue;
    const arrival = poiArrival(index, points.length, arrivalTime, reduced.matches);
    if (!arrival.alpha) continue;
    visible.add(point.id);
    const value = foodValue(definition.id, point.row), style = foodAppearance(definition.id, seriesId, value);
    context.globalAlpha = arrival.alpha * .85;
    drawFoodMark(context, { x, y, ...style, radius: style.radius * arrival.scale, kind: definition.animation, row: point.row, value,
      time: motionTime, selected: point.id === selectedId, reduced: reduced.matches, index, scale: view.scale });
  }
  context.globalAlpha = 1; canvas.dataset.foodVisibleCount = String(visible.size); canvas.dataset.foodAnimation = definition.animation;
};
const findPoiAt = (x, y, pointerType) => {
  if (!active || dataState !== 'ready' || canvas.dataset.foodGeometryState !== 'ready' || layer.classList.contains('is-map-title-transitioning')) return null;
  const view = projection();
  const countryId = pickFoodCountry(context, countryShapes, view, x, y);
  const index = points.findIndex(p => p.id === countryId);
  const hit = index >= 0 ? { point: points[index], index } : pickProjectedPoi(points, view, x, y, pointerType, p => p.id === selectedId && visible.has(p.id));
  if (!hit) return null;
  const p = hit.point, reading = textValue(foodValue(definition.id, p.row));
  return { type: 'exhibit', index: hit.index, record: { id: p.id, exhibitId: definition.id, lon: p.lon, lat: p.lat,
    kicker: `${definition.number} / ${foodRowSource(definition.id, p.row).label}`, title: p.nameJa, preview: `${periodKey} ${metric()} ${reading}`,
    previewReadings: { context: `${periodKey}${foodRowSource(definition.id, p.row).periodUnit}`, readings: [{ label: metric(), value: foodFormat(foodValue(definition.id, p.row)), unit: '%' }] },
    meta: `${periodKey} / ${metric()} ${reading} / ${foodRowSource(definition.id, p.row).label}`, url: foodRowSource(definition.id, p.row).url || definition.source } };
};
const deactivate = () => {
  if (!active) return;
  save(); active = false; generation++; setPlaying(false); dataState = 'idle'; cancelAnimationFrame(frame); frame = 0;
  layer.classList.remove('is-food-exhibit'); delete layer.dataset.foodExhibit;
  canvas.hidden = readout.hidden = legend.hidden = true; buttons.get(definition.id).setAttribute('aria-current', 'false'); emit('change');
};
const select = async id => {
  const target = FOOD_EXHIBITS.find(d => d.id === id); if (!target) return;
  save(); const ticket = ++generation; cancelAnimationFrame(frame); frame = 0;
  for (const provider of [globalThis.GaiaLiveExhibits, globalThis.GaiaEstatExhibits, globalThis.GaiaFirmsExhibit, globalThis.GaiaPlanetSignals, globalThis.GaiaMarineCod]) provider?.deactivate?.();
  definition = target; active = true; data = null; dataState = 'loading'; arrivalStart = null; visible.clear();
  canvas.dataset.foodArrivalState = 'waiting';
  layer.classList.add('is-food-exhibit'); layer.dataset.foodExhibit = id;
  globalThis.GaiaMapObservationAdapter?.closePoi?.();
  canvas.hidden = readout.hidden = false; legend.hidden = true;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const button of globalThis.GaiaMapCategories.buttons()) button.setAttribute('aria-current', String(button === buttons.get(id)));
  for (const selector of ['#japan-mode-title', '#japan-title', '[data-food-title]']) document.querySelector(selector).textContent = target.shortTitle;
  document.querySelector('#japan-mode-number').textContent = target.number;
  const title = document.querySelector('#japan-title'); title.dataset.exhibitNumber = target.number; title.setAttribute('aria-label', `${target.number} ${target.shortTitle}`);
  q('[data-food-number]').textContent = target.number;
  q('[data-food-controls]').disabled = q('[data-food-analysis]').disabled = true;
  q('[data-food-status]').textContent = 'FAO公式データの保存値を読込中…';
  animateMetricText(q('[data-food-value]'), '—', `${definition.id}/${seriesId}`); q('[data-food-amounts]').textContent = ''; q('[data-food-count]').textContent = '';
  q('[data-food-period]').textContent = ''; q('[data-food-metric]').textContent = target.signalLabel;
  q('[data-food-retry]').hidden = true; setPlaying(false); emit('change');
  let payload;
  try { payload = await load(target); }
  catch (error) {
    if (active && generation === ticket) { dataState = 'error'; q('[data-food-status]').textContent = '読込に失敗しました。再試行できます。'; q('[data-food-retry]').hidden = false; emit('error'); }
    console.warn('FAO snapshot unavailable', error); return;
  }
  if (!active || generation !== ticket) return;
  data = payload;
  dataState = 'ready'; ({ seriesId = data.series[0].id, periodKey = '', selectedId = '392' } = saved.get(id) || {});
  q('[data-food-series-label]').textContent = balance() ? '品目' : '指標';
  q('[data-food-series]').replaceChildren(...data.series.map(s => new Option(s.label, s.id)));
  q('[data-food-country]').replaceChildren(...data.countries.map(c => new Option(countryOptionLabel(c), c.id)));
  q('[data-food-controls]').disabled = false; setSeries(seriesId);
  legend.hidden = false;
  q('[data-food-status]').textContent = `FAO / 保存統計・${balance() ? '2010–2023年' : '3年平均'}（リアルタイムではありません）`;
  emit('ready');
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (!active || generation !== ticket) return;
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.(japanPrefectureView(innerWidth));
  lastFrame = performance.now(); frame = requestAnimationFrame(draw);
};
const mount = () => {
  if (readout) return;
  layer = document.querySelector('#japan-layer'); map = document.querySelector('#japan-map');
  if (!map || !layer?.querySelector('.map-mode-list')) return;
  canvas = document.createElement('canvas'); canvas.id = 'gaia-food-canvas'; canvas.hidden = true; canvas.setAttribute('aria-hidden', 'true'); map.append(canvas); context = canvas.getContext('2d');
  fillCanvas = document.createElement('canvas'); fillContext = fillCanvas.getContext('2d');
  readout = document.createElement('section'); readout.className = 'gaia-food-readout'; readout.hidden = true; readout.setAttribute('aria-label', '食料データの国・品目・期間');
  readout.innerHTML = `<div class="gaia-food-chapter"><p>FOOD / 食卓と世界</p><div><button type="button" data-food-step="-1" aria-label="前の展示へ">‹</button><button type="button" class="gaia-featured-selector-toggle" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover"><b data-food-number>70</b><strong data-food-title></strong></button><button type="button" data-food-step="1" aria-label="次の展示へ">›</button></div></div>
    <p class="gaia-food-status" data-food-status role="status"></p><button type="button" data-food-retry hidden>再試行</button>
    <fieldset data-food-controls disabled><legend class="gaia-food-sr">国・品目・期間を選ぶ</legend><div class="gaia-food-pickers"><label><span data-food-series-label>品目</span><select data-food-series aria-label="食料の品目・指標"></select></label><label>国・地域<select data-food-country aria-label="食料データの国・地域"></select></label></div>
    <div class="gaia-food-primary" aria-live="polite"><span data-food-metric></span><strong data-food-value>—</strong><small data-food-amounts></small></div>
    <div class="gaia-food-timeline"><label><b data-food-period></b><input data-food-year type="range" min="0" max="13" step="1" aria-label="食料データの期間" /></label><button type="button" data-food-play aria-pressed="false">期間を自動送り</button><button type="button" data-food-overview>世界の全体へ</button></div></fieldset>
    <p class="gaia-food-count" data-food-count></p><div class="gaia-food-actions"><button type="button" data-food-source></button><button type="button" data-food-analysis disabled></button></div>`;
  layer.append(readout);
  legend = document.createElement('section'); legend.className = 'gaia-food-legend'; legend.hidden = true;
  legend.innerHTML = `<div class="gaia-food-key"><h3 data-food-legend-title></h3><p data-food-period-kind></p><div class="gaia-food-scale" data-food-scale></div><p data-food-scale-labels></p><small>国土の色＝指標値。灰色＝算出・数値なし（0ではありません）。黄色の国境＝選択国。範囲外は端の色、数値は丸め込まず表示。色は安全性の判定ではありません。</small></div><details class="gaia-food-details"><summary>指標・演出・元データの説明</summary><div class="gaia-food-guide"><p data-food-guide></p><p data-food-motion></p><p data-food-quality></p><p data-food-position></p><p data-food-attribution></p><a href="https://www.fao.org/contact-us/terms/db-terms-of-use/en/" target="_blank" rel="noopener noreferrer">FAOデータ利用条件</a></div></details>`;
  layer.append(legend); decorateMapActions(q('.gaia-food-actions'), q('[data-food-source]'), q('[data-food-analysis]'));
  for (const d of FOOD_EXHIBITS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'map-mode-button'; b.textContent = d.number; b.dataset.foodExhibit = d.id;
    b.dataset.mapPreviewSurface = 'map'; b.setAttribute('aria-label', `${d.number} ${d.shortTitle}、${d.signalLabel}の展示`); b.setAttribute('aria-current', 'false'); b.setAttribute('aria-describedby', 'map-mode-preview');
    b.addEventListener('click', () => void select(d.id)); layer.querySelector('.map-mode-list').append(b); buttons.set(d.id, b);
  }
  layer.querySelector('.map-mode-bank').addEventListener('click', event => {
    const b = event.target.closest?.('.map-mode-button'); if (b && !b.dataset.foodExhibit) deactivate();
  }, { capture: true });
  for (const node of [readout, legend]) for (const type of ['pointerdown', 'wheel', 'keydown', 'keyup']) node.addEventListener(type, event => event.stopPropagation());
  q('[data-food-series]').addEventListener('change', event => { stopDemo(); setSeries(event.target.value); });
  q('[data-food-country]').addEventListener('change', event => { stopDemo(); selectCountry(event.target.value); });
  q('[data-food-year]').addEventListener('input', event => { stopDemo(); setPlaying(false); setPeriod(series().periods[Number(event.target.value)]?.key); });
  q('[data-food-play]').addEventListener('click', () => { if (globalThis.GaiaMapPlayback) globalThis.GaiaMapPlayback.toggle(); else setPlaying(!playing); });
  q('[data-food-overview]').addEventListener('click', () => { stopDemo(); focusAll(); });
  q('[data-food-retry]').addEventListener('click', () => {
    if (dataState === 'ready' && canvas.dataset.foodGeometryState === 'error') globalThis.GaiaMapObservationAdapter?.retryCountryGeometry?.();
    else void select(definition.id);
  });
  for (const button of readout.querySelectorAll('[data-food-step]')) button.addEventListener('click', () => {
    const all = globalThis.GaiaMapCategories.buttons(), index = all.indexOf(buttons.get(definition.id)); all[(index + Number(button.dataset.foodStep) + all.length) % all.length].click();
  });
  q('[data-food-analysis]').addEventListener('click', () => {
    stopDemo(); setPlaying(false); const dataset = statisticsDataset(); if (!dataset) return;
    const open = () => globalThis.GaiaStatisticsLab?.open?.({ modeId: dataset.modeId, datasetId: dataset.id, dataset });
    if (globalThis.GaiaStatisticsLab?.open) open(); else addEventListener('gaia:statistics-lab-ready', open, { once: true });
  });
  const resume = () => { if (active && dataState === 'ready' && !frame && !document.hidden) { lastFrame = lastPeriod = performance.now(); frame = requestAnimationFrame(draw); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else resume(); });
  addEventListener('gaia:japan-open', resume); emit('mounted');
};
globalThis.GaiaFoodExhibits = Object.freeze({ definitions: FOOD_EXHIBITS, select, deactivate, setSeries, setPeriod, selectCountry, findPoiAt, focusAll, getStatisticsDataset: statisticsDataset, restoreStatisticsDataset,
  getCruisePoints: () => data?.countries || [],
  selectCruisePoi: index => { const point = data?.countries[index]; if (point) selectCountry(point.id); },
  getState: () => ({ active, id: definition.id, seriesId, periodKey, selectedId, playing, dataState }),
  setPlayback: setPlaying,
  getPlaybackState: () => ({ ready: active && dataState === 'ready', supported: Boolean(series()?.periods.length > 1), playing: active && playing,
    detail: '選択した国・指標の収録期間を順に表示します。' }),
  getSourceInfo: () => active ? { number: definition.number, shortTitle: definition.shortTitle, datasets: [{ id: definition.id, title: definition.signalLabel, organisation: foodRowSource(definition.id, row()).label, url: foodRowSource(definition.id, row()).url || definition.source,
    attributionNote: `${definition.caption} ${data?.attribution || 'FAO公式一括配布を抽出・加工。'} 取得 ${data?.retrievedAt?.slice(0, 10) || '読込後表示'}。${foodGuide(definition.id, seriesId)} ${data?.historyNote || ''} 利用条件: https://www.fao.org/contact-us/terms/db-terms-of-use/en/` }] } : null });
if (globalThis.GaiaMapObservationAdapter) mount(); else addEventListener('gaia:map-adapter-ready', mount, { once: true });
