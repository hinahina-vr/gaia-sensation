import { animateMetricText } from '../shared/animated-metric.js';
import { createMetricLegend, updateMetricLegend } from './metric-legend.js?v=gaia-lodging-color-1-i18n-20260913';
import { earthBaseScale, earthLongitudeToMapX } from "./world-projection.js?v=gaia-japan-center-1";
import { japanPrefectureView } from './japan-prefecture-view.js?v=gaia-prefecture-gis-view-1';
import { pickProjectedPoi } from "./poi-hit-test.js?v=gaia-japan-center-1";
import { decorateMapActions } from "./map-exhibit-actions.js?v=action-icons-ready-20260926";
import { MARINE_COD_EXHIBIT } from "./marine-cod-catalog.js?v=gaia-marine-cod-1";
import { JAPAN_SENSOR_OPEN_EXHIBITS, sensorObservationAppearance } from "./japan-sensor-open-catalog.js?v=gaia-japan-sensor-open-1";
import { JAPAN_POLLUTION_EXHIBITS } from "./japan-pollution-catalog.js?v=gaia-pollution-1";
import { PRTR_BIOLOGY_EXHIBITS, recordAppearance, displayFraction } from "./prtr-biology-catalog.js?v=prtr-biology-1-i18n-20260913";
import { drawRecordMarker } from "./prtr-biology-drawing.js?v=prtr-biology-1";
import { poiArrival, poiArrivalDuration } from "./annual-poi-arrival.js?v=gaia-annual-pop-20260909";
import { validateAnnualManifest, loadAnnualPeriod, loadAnnualHistory } from "./annual-observation-store.js?v=history-20260912";
import { buildAnnualStatisticsDataset } from "./annual-statistics.js?v=history-20260912-i18n-20260913";
import { INITIAL_OBSERVATION_YEAR, initialObservationIndex } from './initial-observation-year.js?v=2016-20260926';

const definitions = Object.freeze([Object.freeze({ ...MARINE_COD_EXHIBIT, dataFile: "japan-marine-cod.json", unit: "mg/L",
  metricLabel: "COD 年度平均値", secondaryLabel: "COD75（75%値）", periodUnit: "年度", organisation: "環境省", category: "water" }), ...JAPAN_SENSOR_OPEN_EXHIBITS, ...JAPAN_POLLUTION_EXHIBITS, ...PRTR_BIOLOGY_EXHIBITS]);
let definition = definitions[0], SOURCE_URL = definition.source, selectionGeneration = 0;
const buttonsById = new Map(), cache = new Map(), requests = new Map();
const isCod = () => definition.id === MARINE_COD_EXHIBIT.id;
const reading = point => isCod() ? point?.cod : point?.metrics?.[definition.measurementKey] || point?.measurement;
const periodLabel = value => `${value}${definition.periodUnit}`;
const yearsFor = target => cache.get(target.dataFile)?.periods.map(p => p.year) || target.years || [2020, 2021, 2022, 2023, 2024];
const yearRange = (separator = "〜") => `${yearsFor(definition)[0]}${yearsFor(definition).length > 1 ? `${separator}${yearsFor(definition).at(-1)}` : ""}${definition.periodUnit}`;
const retrievalDates = () => [...new Set([...(data?.sourceRetrievalDates || [data?.retrievedOn]), data?.historyRetrievedOn].filter(Boolean))].join('・') || '取得日はデータ読込後に表示';
let layer, map, canvas, context, readout, legend, button, data, selectionHelp;
let active = false, frame = 0, lastDraw = 0, year = INITIAL_OBSERVATION_YEAR, selectedId = "", prefecture = "all";
let currentPeriod = null, selectedHistory = {}, historyState = 'idle', yearGeneration = 0;
let dataState = "idle";
let playing = false, lastYearAt = 0, motionTime = 0;
let arrivalStartedAt = null, arrivalElapsed = -1;
const renderedPoiIds = new Set();
const media = matchMedia("(prefers-reduced-motion: reduce)");
const prefectures = "北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split(" ");
const prefName = code => definition.regionNames?.[code] || prefectures[Number(code) - 1] || code;
const period = () => currentPeriod;
const station = () => period()?.stations.find(item => item.id === selectedId);
const stationName = point => point?.name || '地点名未記載';
const sourcePlace = point => [point.water, point.name].filter(Boolean).join(' / ');
const showSourcePlace = (node, point) => {
  const name = document.createElement('span');
  name.textContent = sourcePlace(point); name.translate = false; name.lang = 'ja';
  name.dataset.sourceName = name.textContent;
  node.replaceChildren(name); node.title = '原資料に記載された地点名';
};
const localized = text => globalThis.GaiaI18n?.t(text) || text;
const sourceOption = (item, missing = false) => {
  const node = new Option('', item.id);
  const source = missing ? '{name} [{id}]（この期間は記録なし）' : '{region} · {name} · {value} [{id}]';
  const values = { name: sourcePlace(item), id: item.id,
    get region() { return localized(prefName(item.prefCode)); },
    get value() { return localized(valueText(reading(item))); } };
  node.dataset.sourceName = values.name; node.dataset.sourceId = item.id;
  if (globalThis.GaiaI18n) GaiaI18n.bind(node, source, values);
  else node.textContent = source.replace(/\{(\w+)\}/g, (_, key) => values[key]);
  return node;
};
const q = selector => readout.querySelector(selector) || legend?.querySelector(selector);
const valueText = item => item ? `${item.text}${item.value !== null || item.quality === "qualified" ? ` ${definition.unit}` : ""}` : "この期間は記録なし";
const taxonName = (point, code) => point.taxonNames[code].join(" / ");
// Shared numerical stops drive BOTH point colors and the visible legend.
// They are display intervals, not environmental standards or safety classes.
export const COD_COLOR_STOPS = [[0, [74, 157, 255]], [1, [69, 206, 235]], [2, [129, 221, 167]],
  [3, [247, 221, 104]], [5, [255, 145, 81]], [9, [247, 79, 103]]];
export const codAppearance = value => {
  if (!Number.isFinite(value)) return { color: "#abb5be", radius: 2.2 };
  const bounded = Math.max(0, Math.min(9, value));
  const index = COD_COLOR_STOPS.findIndex(([limit]) => limit >= bounded);
  const [high, rgb] = COD_COLOR_STOPS[index], [low, previous] = COD_COLOR_STOPS[Math.max(0, index - 1)];
  const blend = high === low ? 0 : (bounded - low) / (high - low);
  return { color: `rgb(${rgb.map((channel, i) => Math.round(previous[i] + (channel - previous[i]) * blend)).join(", ")})`,
    radius: 2.5 + Math.sqrt(bounded / 9) * 4.5 };
};
const colorStops = () => isCod() ? COD_COLOR_STOPS.map(([value]) => value) : definition.stops;
const appearance = value => {
  return isCod() ? codAppearance(value) : definition.colors ? recordAppearance(definition, value) : sensorObservationAppearance(definition, value);
};
let renderedPointStyles = new WeakMap();
const renderPointStyle = point => {
  if (!renderedPointStyles.has(point)) renderedPointStyles.set(point, {
    ...appearance(reading(point).value), mapX: earthLongitudeToMapX(point.lon), mapY: 90 - point.lat,
  });
  return renderedPointStyles.get(point);
};
const projection = () => {
  const rect = globalThis.GaiaMapObservationAdapter?.getViewportRect?.() || map.getBoundingClientRect();
  const overlay = document.querySelector("#japan-overlay");
  const scale = earthBaseScale(rect) * Math.max(1, Number(overlay.dataset.earthZoom) || 1);
  return { rect, scale, originX: (rect.width - 360 * scale) / 2 + (Number(overlay.dataset.earthOffsetX) || 0),
    originY: (rect.height - 180 * scale) / 2 + (Number(overlay.dataset.earthOffsetY) || 0) };
};
const pointAt = (point, view) => ({ x: view.originX + earthLongitudeToMapX(point.lon) * view.scale,
  y: view.originY + (90 - point.lat) * view.scale });
const focusAll = () => {
  const rect = map.getBoundingClientRect();
  const mobile = innerWidth <= 900;
  // Fit Japan including Okinawa. No substitution of administrative centroids.
  const portrait = mobile && innerHeight > innerWidth;
  const top = mobile ? (portrait ? legend : layer.querySelector(".japan-heading")).getBoundingClientRect().bottom - rect.top + 6 : rect.height * .08;
  const bottom = Math.min(readout.getBoundingClientRect().top - rect.top - 6, rect.height * .84);
  const scale = Math.min(rect.width * (mobile ? .88 : .65) / 25, Math.max(60, bottom - top) / 23);
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: 135, lat: 34, zoom: Math.max(1, scale / earthBaseScale(rect)),
    targetX: (!portrait && innerWidth <= 1200) ? .42 : .5, targetY: (top + bottom) / 2 / rect.height, durationMs: 600, label: `${definition.id}-overview` });
};
const load = target => {
  if (cache.has(target.dataFile)) return Promise.resolve(cache.get(target.dataFile));
  if (!requests.has(target.dataFile)) requests.set(target.dataFile, fetch(new URL(`../../data/${target.dataFile}?v=annual-history-20260912`, import.meta.url), { signal: AbortSignal.timeout(15000) }).then(async response => {
    if (!response.ok) throw new Error(`Annual observations HTTP ${response.status}`);
    const payload = await response.json();
    validateAnnualManifest(payload);
    // Limit retained decoded station records during a full exhibition demo.
    if (cache.size >= 3) cache.delete(cache.keys().next().value);
    cache.set(target.dataFile, payload);
    return payload;
  }).finally(() => requests.delete(target.dataFile)));
  return requests.get(target.dataFile);
};
const setPlaying = next => {
  playing = Boolean(next) && dataState === 'ready' && yearsFor(definition).length > 1;
  lastYearAt = performance.now();
  q("[data-cod-play]").textContent = playing ? '自動表示をやめる' : '自動表示する';
  q("[data-cod-play]").setAttribute("aria-pressed", String(playing));
};
let prefectureOptionsKey = "", stationOptionsKey = "";
const renderOptions = () => {
  const rows = period().stations;
  const filter = q("[data-cod-prefecture]");
  const codes = [...new Set(rows.map(item => item.prefCode))].sort();
  const filterKey = codes.join(",");
  if (prefectureOptionsKey !== filterKey) {
    filter.replaceChildren(new Option(`全国の${definition.stationLabel || "測定地点"}`, "all"), ...codes.map(code => new Option(prefName(code), code)));
    prefectureOptionsKey = filterKey;
  }
  if (prefecture !== "all" && !rows.some(item => item.prefCode === prefecture)) prefecture = "all";
  filter.value = prefecture;
  // Keep every observation on the map. Large native selects are populated
  // after choosing a region, rather than putting thousands of invisible DOM
  // options through style/layout on every map frame and year input.
  const needsRegion = prefecture === "all" && rows.length > 250;
  const candidates = needsRegion ? [] : rows.filter(item => prefecture === "all" || item.prefCode === prefecture);
  const selector = q("[data-cod-station]");
  const selected = station();
  // An explicit source-ID list also covers co-located stations which no
  // amount of zoom can separate. Never displace the source coordinates.
  const nearby = selected ? rows.filter(item => Math.hypot(item.lon - selected.lon, item.lat - selected.lat) <= .1)
    .sort((a, b) => Math.hypot(a.lon - selected.lon, a.lat - selected.lat) - Math.hypot(b.lon - selected.lon, b.lat - selected.lat)) : [];
  const nearbyIds = new Set(nearby.map(item => item.id));
  const option = item => sourceOption(item);
  const key = [definition.id, prefecture, selectedId, needsRegion, candidates.map(item => item.id).join(","), nearby.map(item => item.id).join(",")].join("|");
  if (stationOptionsKey !== key) {
    selector.replaceChildren(new Option(needsRegion ? "先に地域を選択 / 地図から選択" : "地点を選ぶ / 地図の光点をタッチ", ""));
    if (nearby.length) {
      const group = document.createElement("optgroup");
      group.label = `選択地点の近く（${nearby.length}地点・地点コードで区別）`;
      group.append(...nearby.map(option)); selector.append(group);
    }
    const rest = document.createElement("optgroup"); rest.label = `地域内の${definition.stationLabel || "測定地点"}`;
    rest.append(...candidates.filter(item => !nearbyIds.has(item.id)).map(option)); selector.append(rest);
    stationOptionsKey = key;
  } else {
    // Stable source IDs retain their option elements across years. Update
    // only changed readings; don't rebuild the region menu or reorder nodes.
    const byId = new Map([...candidates, ...nearby].map(item => [item.id, item]));
    for (const node of selector.options) {
      const item = byId.get(node.value);
      if (item) {
        // Rebind the existing option: stable IDs and native selection survive year changes.
        if (globalThis.GaiaI18n) GaiaI18n.bind(node, '{region} · {name} · {value} [{id}]', {
          name: sourcePlace(item), id: item.id,
          get region() { return localized(prefName(item.prefCode)); },
          get value() { return localized(valueText(reading(item))); },
        });
        else node.text = sourceOption(item).text;
        node.dataset.sourceName = sourcePlace(item); node.dataset.sourceId = item.id;
      }
    }
  }
  // Keep the selected stable ID across years, even if absent in that year.
  if (selectedId && ![...selector.options].some(item => item.value === selectedId)) {
    const historical = Object.values(selectedHistory).find(Boolean);
    if (historical) selector.add(sourceOption(historical, true));
  }
  selector.value = selectedId;
  selector.dataset.optionsScope = needsRegion ? "choose-region" : prefecture === "all" ? "all" : "region";
};
const renderLegend = () => {
  const selected = station(), measurement = reading(selected), stops = colorStops();
  const minimum = stops[0], maximum = stops.at(-1);
  const gradient = definition.colors ? `linear-gradient(90deg, ${definition.colors.join(', ')})`
    : `linear-gradient(90deg, ${stops.map(value => `${appearance(value).color} ${(value-minimum)/(maximum-minimum)*100}%`).join(', ')})`;
  const note = `${yearRange()} · ${definition.category === 'chemicals' ? '届出量 ≠ 環境濃度・危険度' : definition.category === 'biology' ? '確認分類群数 ≠ 個体数・水質等級' : '灰色＝欠測・注記。安全性は判定しません。'}`;
  updateMetricLegend(legend, {
    title: definition.metricLabel, scope: selected ? [selected.water, selected.name].filter(Boolean).join(' / ') : '観測地点を選択',
    period: periodLabel(year), current: selected ? valueText(measurement) : '—', value: measurement?.value,
    minimum, maximum, minimumLabel: `${minimum} ${definition.unit}`, maximumLabel: `${maximum}以上 ${definition.unit}`,
    gradient, scale: definition.logScale ? 'log' : 'linear', description: note,
  });
  legend.querySelector('[data-annual-legend-note]').textContent = note;
};
const render = () => {
  const current = period(), selected = station();
  readout.dataset.codPeriodYear = String(year);
  readout.dataset.codSelectedStation = selectedId;
  canvas.dataset.codPeriodYear = String(year);
  canvas.dataset.codPointCount = String(current.stations.length);
  q("[data-cod-year]").value = String(year);
  q("[data-cod-period]").textContent = periodLabel(year);
  q("[data-cod-count]").textContent = definition.countLabel ? `${current.stations.length.toLocaleString("ja-JP")}${definition.countLabel} · 空白はゼロではありません`
    : `${current.counts.measured.toLocaleString("ja-JP")}地点に実測値 / 欠測 ${current.counts.missing}地点${current.counts.qualified ? ` / 注記付き ${current.counts.qualified}地点` : ""}`;
  if (selected) showSourcePlace(q('[data-cod-place]'), selected);
  else { q('[data-cod-place]').removeAttribute('title'); q('[data-cod-place]').textContent = selectedId ? 'この期間は地点の記録なし' : '地図の光点を選んでみよう'; }
  animateMetricText(q("[data-cod-value]"), selected ? valueText(reading(selected)) : "—", definition.id);
  q("[data-cod-value]").style.color = selected ? appearance(reading(selected).value).color : "";
  q("[data-cod-secondary]").textContent = selected && definition.secondaryLabel ? `${definition.secondaryLabel}: ${valueText(isCod() ? selected.cod75 : selected.secondary)}`
    : reading(selected)?.sourceText ? `原資料: ${reading(selected).sourceText} MJ/m²（日積算量の年平均）`
      : reading(selected)?.coverageText || `色・光の大きさは${definition.metricLabel}`;
  if (definition.category === "chemicals") q("[data-cod-secondary]").textContent = selected ? `${selected.substances.length}届出物質（kg単位） / ${selected.industry}` : "届出量です。周辺の濃度・危険度ではありません。";
  if (definition.category === "biology" && selected) {
    const label = document.createElement("span"), names = document.createElement("span"), suffix = document.createElement("span");
    label.textContent = "原表の名前：";
    names.textContent = selected.taxa.slice(0, 3).map(code => taxonName(selected, code)).join("・");
    // These are source taxon names, including ambiguous identifications and
    // variants. Do not silently replace them with different common names.
    names.translate = false; names.lang = "ja";
    suffix.textContent = selected.taxa.length > 3 ? " ほか" : "";
    q("[data-cod-secondary]").replaceChildren(label, names, suffix);
  }
  q("[data-cod-records]").hidden = !definition.animation;
  q("[data-cod-records]").disabled = !selected;
  q("[data-cod-records]").textContent = definition.category === "biology" ? "確認された名前を見る" : "物質別の内訳を見る";
  const hasMeasurements = selectedId && (definition.category === 'chemicals' ? selected && reading(selected).value !== null : historyState === 'ready' && Object.values(selectedHistory).some(point => Number.isFinite(reading(point)?.value)));
  const analysis = q('[data-cod-analysis]');
  const needsSelection = !selectedId;
  analysis.disabled = !needsSelection && !hasMeasurements;
  analysis.toggleAttribute('data-analysis-needs-selection', needsSelection);
  analysis.querySelector('small').textContent = needsSelection ? '地点を選択' : '分析';
  analysis.title = hasMeasurements ? definition.category === 'chemicals' ? '選択事業所の物質別届出量を表示' : `選択地点の${yearsFor(definition).length}${definition.periodUnit}の記録を分析`
    : needsSelection ? '地図の点、または地域・測定地点を選ぶと分析できます。押すと選択欄へ移動します。'
      : historyState === 'loading' ? '地点の過去の記録を読込中です。' : 'この地点には数値分析できる記録がありません。';
  analysis.setAttribute('aria-label', needsSelection ? '統計分析のための地点を選ぶ' : '選択地点のデータを統計分析する');
  analysis.setAttribute('aria-controls', needsSelection ? 'gaia-cod-selection-help' : 'gaia-statistics-lab');
  if (needsSelection) analysis.removeAttribute('aria-haspopup'); else analysis.setAttribute('aria-haspopup', 'dialog');
  analysis.dataset.actionDescription = needsSelection ? '先に地点を選ぶ・選択欄へ移動' : '選択地点の記録を分析';
  analysis.dataset.disabledReason = analysis.disabled ? analysis.title : '';
  if (selectedId) selectionHelp.hidden = true;
  renderLegend();
};
const setYear = async value => {
  if (!active || !data || !Number.isFinite(Number(value))) return false;
  const requested = Number(value), available = data.periods.map(p => p.year);
  const targetYear = available.includes(requested) ? requested : requested > year ? available.find(y => y >= requested) || available.at(-1) : available.findLast(y => y <= requested) || available[0];
  const request = ++yearGeneration, generation = selectionGeneration, targetData = data;
  dataState = 'loading-year';
  q('[data-cod-status]').textContent = `${periodLabel(targetYear)}の観測記録を読込中…`;
  let loaded;
  try { loaded = await loadAnnualPeriod(targetData, targetYear); }
  catch (error) {
    if (active && generation === selectionGeneration && request === yearGeneration) {
      dataState = 'ready';
      q('[data-cod-year]').value = String(year);
      q('[data-cod-status]').textContent = `${periodLabel(targetYear)}の読込に失敗しました。${periodLabel(year)}を表示中。年度を選び直して再試行できます。`;
      setPlaying(false);
    }
    return false;
  }
  if (!active || generation !== selectionGeneration || request !== yearGeneration) return false;
  currentPeriod = loaded; year = targetYear; dataState = 'ready'; lastYearAt = performance.now();
  q('[data-cod-status]').textContent = `${definition.organisation} / ${yearRange('–')}の保存値（リアルタイムではありません）`;
  renderedPoiIds.clear();
  globalThis.GaiaMapObservationAdapter?.closePoi?.();
  renderOptions();
  render();
  return true;
};
const selectStation = (id, { focus = true } = {}) => {
  if (!active || !period()?.stations.some(item => item.id === id)) return false;
  selectedId = id;
  const selected = station();
  selectedHistory = { [year]: selected }; historyState = 'loading';
  const generation = selectionGeneration, targetData = data;
  void loadAnnualHistory(targetData, id).then(history => {
    if (!active || generation !== selectionGeneration || selectedId !== id) return;
    selectedHistory = history; historyState = 'ready'; renderOptions(); render();
  }).catch(() => {
    if (!active || generation !== selectionGeneration || selectedId !== id) return;
    historyState = 'error'; render();
  });
  prefecture = selected.prefCode;
  renderOptions();
  render();
  // A compact portrait screen needs a clear target between the legend and
  // instrument strip; a fixed 40% target can sit behind the enlarged legend.
  let targetY = .4;
  if (!isCod() && innerWidth <= 900) {
    const rect = map.getBoundingClientRect();
    const top = legend.getBoundingClientRect().bottom - rect.top + 12;
    const bottom = readout.getBoundingClientRect().top - rect.top - 12;
    targetY = Math.max(.1, Math.min(.8, (top + bottom) / 2 / rect.height));
  }
  if (focus) globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: selected.lon, lat: selected.lat,
    zoom: Math.max(64, Number(document.querySelector("#japan-overlay").dataset.earthZoom) || 1),
    targetX: .5, targetY, durationMs: 550, label: `cod-station-${id}` });
  return true;
};
const draw = time => {
  frame = 0;
  if (!active || document.hidden || layer.getAttribute("aria-hidden") === "true") return;
  if (time - lastDraw < 1000 / 24) { frame = requestAnimationFrame(draw); return; }
  const drawStarted = performance.now();
  const elapsed = Math.min(100, time - lastDraw);
  lastDraw = time;
  if (!media.matches) motionTime += elapsed;
  if (playing && dataState === 'ready' && time - lastYearAt >= 4000) {
    const years = data.periods.map(item => item.year);
    setYear(years[(years.indexOf(year) + 1) % years.length]);
    lastYearAt = time;
  }
  const view = projection(), { rect } = view;
  const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1600000 / (rect.width * rect.height)));
  const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  renderedPoiIds.clear();
  const overlay = document.querySelector("#japan-overlay");
  const separatorVisible = layer.classList.contains("is-map-title-transitioning");
  // Start on the first drawable frame, not on a timer set when fetch began.
  // This also gives a late dataset its full arrival after the camera settles.
  if (separatorVisible) arrivalStartedAt = null;
  if (!separatorVisible && arrivalStartedAt === null && overlay.dataset.viewAnimation !== "running") arrivalStartedAt = time;
  arrivalElapsed = arrivalStartedAt === null ? -1 : time - arrivalStartedAt;
  const rows = period().stations;
  canvas.dataset.codArrivalState = arrivalElapsed < 0 ? "waiting" : media.matches || arrivalElapsed >= poiArrivalDuration(rows.length) ? "complete" : "running";
  canvas.dataset.codArrivalStartedAt = arrivalStartedAt === null ? "" : arrivalStartedAt.toFixed(1);
  let visible = 0, detailedMarks = 0;
  for (const [index, point] of rows.entries()) {
    const { color, radius, mapX, mapY } = renderPointStyle(point);
    const x = view.originX + mapX * view.scale, y = view.originY + mapY * view.scale;
    if (x < -30 || y < -30 || x > rect.width + 30 || y > rect.height + 30) continue;
    const arrival = poiArrival(index, rows.length, arrivalElapsed, media.matches);
    if (arrival.alpha === 0) continue;
    visible++;
    renderedPoiIds.add(point.id);
    const value = reading(point).value;
    const highlighted = point.id === selectedId;
    context.globalAlpha = (prefecture === "all" || point.prefCode === prefecture ? .85 : .25) * arrival.alpha;
    if (definition.animation) {
      const detailed = highlighted || (detailedMarks < 140 && (view.scale > 80 || index % Math.max(1, Math.ceil(rows.length / 140)) === 0));
      drawRecordMarker(context, { x, y, radius, color, animation: definition.animation, time: motionTime, index,
        selected: highlighted, arrival, reduced: media.matches, value, detailed });
      if (detailed && value > 0 && arrival.progress === 1) detailedMarks++;
      continue;
    }
    context.fillStyle = color;
    context.beginPath(); context.arc(x, y, radius * arrival.scale, 0, Math.PI * 2);
    if (value === null) { context.strokeStyle = color; context.lineWidth = arrival.scale; context.stroke(); }
    else context.fill();
    // Sparse rings only at measured stations; never a filled/interpolated sea.
    if (arrival.progress === 1 && value !== null && (highlighted || index % 13 === 0)) {
      const phase = media.matches ? .3 : (motionTime / 3800 + index * .618) % 1;
      context.globalAlpha *= (1 - phase) * .42;
      context.strokeStyle = color; context.lineWidth = 1;
      context.beginPath(); context.arc(x, y, radius + 3 + phase * 13, 0, Math.PI * 2); context.stroke();
    }
  }
  const selected = station();
  if (selected && renderedPoiIds.has(selected.id)) {
    const { x, y } = pointAt(selected, view);
    context.globalAlpha = 1; context.strokeStyle = "#fff9dc"; context.lineWidth = 1.8;
    context.beginPath(); context.arc(x, y, 12, 0, Math.PI * 2); context.stroke();
  }
  context.globalAlpha = 1;
  canvas.dataset.codVisibleCount = String(visible);
  canvas.dataset.recordAnimation = definition.animation || "observation-rings";
  canvas.dataset.recordDetailCount = String(detailedMarks);
  canvas.dataset.codArrivalVisibleCount = String(visible);
  canvas.dataset.codFrame = String((Number(canvas.dataset.codFrame) || 0) + 1);
  if (definition.animation) canvas.dataset.recordDrawMs = (performance.now() - drawStarted).toFixed(2);
  frame = requestAnimationFrame(draw);
};
const findPoiAt = (clientX, clientY, pointerType) => {
  if (!active || !data || arrivalElapsed < 0 || layer.classList.contains("is-map-title-transitioning")) return null;
  const hit = pickProjectedPoi(period().stations, projection(), clientX, clientY, pointerType, point => renderedPoiIds.has(point.id));
  if (!hit) return null;
  const point = hit.point;
  return { type: "exhibit", index: hit.index, record: { id: point.id, exhibitId: definition.id, lon: point.lon, lat: point.lat,
    kicker: `${definition.number} / ${definition.metricLabel}`, title: sourcePlace(point), originalSourceName: true, preview: `${periodLabel(year)} ${definition.metricLabel} ${valueText(reading(point))}`,
    previewReadings: { context: periodLabel(year), readings: [{ label: definition.metricLabel, value: reading(point)?.text || '記録なし', unit: definition.unit }] },
    meta: `${periodLabel(year)} / ${prefName(point.prefCode)} / ${valueText(reading(point))} / ${definition.organisation}`, url: point.sourceUrl || SOURCE_URL } };
};
const showRecordDetail = () => {
  const point = station();
  if (!point || !definition.animation) return;
  setPlaying(false);
  let dialog = document.querySelector("#gaia-record-detail");
  if (!dialog) {
    dialog = document.createElement("dialog"); dialog.id = "gaia-record-detail";
    dialog.setAttribute("aria-labelledby", "gaia-record-detail-title");
    dialog.innerHTML = `<header><div><small data-record-kicker></small><h2 id="gaia-record-detail-title"></h2></div><button type="button" data-record-close aria-label="記録の内訳を閉じる">閉じる ×</button></header><p data-record-note></p><label class="gaia-record-search">名前・コードで絞り込む<input type="search" data-record-search autocomplete="off"></label><p data-record-count role="status"></p><ol data-record-list></ol><footer><p data-record-limit></p><a data-record-source target="_blank" rel="noopener noreferrer">公的な原資料を開く</a></footer>`;
    document.body.append(dialog);
    dialog.querySelector("[data-record-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  }
  const query = selector => dialog.querySelector(selector), biological = definition.category === "biology";
  query("[data-record-kicker]").textContent = `${definition.number} / ${periodLabel(year)} / ${definition.organisation}`;
  showSourcePlace(query('h2'), point);
  const noteSource = biological ? '{count}分類群（種コード数）。調査管理番号：{ids}。同じ種コードの複数採集を1つにまとめ、原表の名前を保持。同一コードに複数表記がある場合は / で併記します。分類名の訂正・同義語への統一はしていません。'
    : '{metric}：{value}。整理番号：{id}。ダイオキシン類（mg-TEQ）を除いたkg単位の届出物質です。';
  const noteValues = {count:point.taxa?.length,ids:point.surveyIds?.join('・'),id:point.id,
    get metric(){return localized(definition.metricLabel);},get value(){return localized(valueText(reading(point)));}};
  if(globalThis.GaiaI18n)GaiaI18n.bind(query('[data-record-note]'),noteSource,noteValues);
  else query('[data-record-note]').textContent=noteSource.replace(/\{(\w+)\}/g,(_,key)=>noteValues[key]);
  query('[data-record-limit]').replaceChildren(...[definition.comparisonNote, data.coordinateNote, '地点名・物質名・生物名・地点コードは、照合できるよう原資料の表記を保持しています。'].map(text=>{
    const span=document.createElement('span');span.textContent=text+' ';return span;
  }));
  query("[data-record-source]").href = point.sourceUrl || SOURCE_URL;
  const records = biological ? point.taxa.map(code => ({ code, name: taxonName(point, code) }))
    : point.substances.map(row => ({ code: row[0], name: (period().substanceNames || data.substanceNames)[row[0]], row }));
  const renderRecords = () => {
    const filter = query("[data-record-search]").value.trim().toLocaleLowerCase();
    const matches = records.filter(row => `${row.code} ${row.name}`.toLocaleLowerCase().includes(filter));
    query("[data-record-count]").textContent = `${matches.length} / ${records.length}${biological ? "分類群" : "物質"}`;
    query("[data-record-list]").replaceChildren(...matches.map(record => {
      const item = document.createElement("li"), name = document.createElement("strong"), code = document.createElement("small");
      name.textContent = record.name; code.textContent = `${biological ? "種コード" : "物質番号"} ${record.code}`;
      name.translate = false; name.lang = "ja"; name.dataset.sourceName = record.name;
      item.append(name, code);
      if (!biological) {
        const fields = definition.measurementKey === "transfer" ? [["下水道への移動", 5], ["事業所外の廃棄物等への移動", 6]]
          : [[definition.metricLabel, definition.measurementKey === "air" ? 1 : 2]];
        for (const [label, index] of fields) {
          const value = document.createElement("p");
          const number=record.row[index]===null?'記録なし':`${record.row[index].toLocaleString('ja-JP',{maximumSignificantDigits:12})} kg/年度`;
          if(globalThis.GaiaI18n)GaiaI18n.bind(value,'{description}',{get description(){return `${localized(label)}: ${localized(number)}`;}});
          else value.textContent=`${label}：${number}`;
          item.append(value);
        }
      }
      return item;
    }));
  };
  query("[data-record-search]").value = "";
  query("[data-record-search]").oninput = renderRecords;
  renderRecords(); dialog.showModal();
};
const statisticsDataset = () => {
  if (!active || !data || !selectedId) return null;
  if (definition.category !== 'chemicals' && historyState !== 'ready') return null;
  return buildAnnualStatisticsDataset({ data, definition, selectedId, history: selectedHistory, year, period: period() });
};
const requestStatisticsSelection = () => {
  if (!active || dataState !== 'ready') return false;
  globalThis.GaiaMapDemo?.stop?.('interaction');
  const help = selectionHelp;
  help.textContent = '地図の点、または「地域」→「測定地点」を選ぶと分析できます。';
  help.hidden = false;
  const box = q('.gaia-cod-pickers').getBoundingClientRect();
  help.style.left = `${Math.max(12, Math.min(innerWidth - help.offsetWidth - 12, box.left))}px`;
  help.style.top = `${Math.max(12, box.top - help.offsetHeight - 12)}px`;
  const target = q('[data-cod-station]').dataset.optionsScope === 'choose-region' ? q('[data-cod-prefecture]') : q('[data-cod-station]');
  target.setAttribute('aria-describedby', help.id);
  target.focus({ preventScroll: true });
  return true;
};
const restoreStatisticsDataset = async id => {
  const target = definitions.find(item => id.startsWith(`${item.id}-`));
  if (!target) return null;
  const payload = await load(target), suffix = id.slice(target.id.length + 1);
  if (target.category === 'chemicals') {
    const match = /^(\d{4})-(.+)$/.exec(suffix);
    // The original single-year saved IDs had no year segment and mean 2022.
    const targetYear = match ? Number(match[1]) : 2022;
    if (!payload.periods.some(p => p.year === targetYear)) return null;
    return buildAnnualStatisticsDataset({ data: payload, definition: target, selectedId: match ? match[2] : suffix,
      year: targetYear, period: await loadAnnualPeriod(payload, targetYear), datasetId: id });
  }
  return buildAnnualStatisticsDataset({ data: payload, definition: target, selectedId: suffix, history: await loadAnnualHistory(payload, suffix) });
};
const deactivate = () => {
  if (selectionHelp) selectionHelp.hidden = true;
  if (!active) return;
  dataState = "idle";
  active = false; selectionGeneration++; setPlaying(false); cancelAnimationFrame(frame); frame = 0;
  document.querySelector("#gaia-record-detail")?.close();
  layer.classList.remove("is-marine-cod-exhibit"); delete layer.dataset.marineCodExhibit;
  canvas.hidden = readout.hidden = legend.hidden = true;
  button.setAttribute("aria-current", "false");
  dispatchEvent(new CustomEvent("gaia:marine-cod-change", { detail: { active: false } }));
};
const configureDefinition = () => {
  renderedPointStyles = new WeakMap();
  prefectureOptionsKey = stationOptionsKey = "";
  document.querySelector("#gaia-record-detail")?.close();
  readout.classList.toggle("is-record-exhibit", Boolean(definition.animation));
  readout.classList.toggle("is-single-period", yearsFor(definition).length === 1);
  legend.classList.toggle("is-sensor-open-legend", !isCod());
  legend.classList.toggle("is-pollution-legend", definition.sensorRegistrationKey === null);
  readout.setAttribute("aria-label", `${definition.metricLabel}の地点と${definition.periodUnit}`);
  readout.dataset.annualExhibit = definition.id;
  q(".gaia-marine-cod-chapter > p").textContent = definition.category === "weather" ? "JAPAN WEATHER / 空と天気"
    : definition.category === "air" ? "JAPAN AIR / 大気と汚染" : definition.category === "chemicals" ? "PRTR / 化学物質の行方" : definition.category === "biology" ? "RIVER LIFE / 生きものの記録" : "JAPAN WATER / 水と森";
  q(".gaia-featured-selector-toggle b").textContent = definition.number;
  q(".gaia-featured-selector-toggle strong").textContent = definition.shortTitle;
  q(".gaia-cod-value-label").textContent = isCod() ? "COD 年度平均 / 有機物による汚れの目安" : definition.metricLabel;
  q("[data-cod-prefecture]").setAttribute("aria-label", `${definition.metricLabel}の都道府県`);
  q("[data-cod-station]").setAttribute("aria-label", `${definition.metricLabel}の測定地点`);
  q("[data-cod-year]").setAttribute("aria-label", `${definition.metricLabel}の${definition.periodUnit}`);
  q("[data-cod-year]").min = String(yearsFor(definition)[0]);
  q("[data-cod-year]").max = String(yearsFor(definition).at(-1));
  q("[data-cod-year]").disabled = yearsFor(definition).length === 1;
  q("[data-cod-play]").disabled = yearsFor(definition).length === 1;
  q("[data-cod-station-label]").textContent = definition.stationLabel || "測定地点";
  q("[data-cod-region-label]").textContent = definition.regionLabel || "地域";
  q("[data-cod-station]").setAttribute("aria-label", `${definition.metricLabel}の${definition.stationLabel || "測定地点"}`);
  q("[data-cod-prefecture]").setAttribute("aria-label", `${definition.metricLabel}の${definition.regionLabel || "都道府県"}`);
  q("[data-cod-period]").textContent = periodLabel(year);
  q("[data-cod-overview]").textContent = isCod() ? "日本沿岸の全体へ" : "日本の全体へ";
  q('[data-cod-step="-1"]').setAttribute("aria-label", `前の展示、${Number(definition.number) - 1}へ`);
  q('[data-cod-step="1"]').setAttribute("aria-label", `次の展示、${Number(definition.number) === globalThis.GaiaMapCategories.exhibitCount ? "01" : Number(definition.number) + 1}へ`);
  renderLegend();
};
const select = async (id = MARINE_COD_EXHIBIT.id) => {
  const target = definitions.find(item => item.id === id);
  if (!target) return;
  const generation = ++selectionGeneration;
  dataState = "loading";
  cancelAnimationFrame(frame); frame = 0;
  arrivalStartedAt = null; arrivalElapsed = -1; renderedPoiIds.clear();
  canvas.dataset.codArrivalState = "waiting";
  canvas.dataset.codArrivalStartedAt = "";
  canvas.dataset.codArrivalVisibleCount = "0";
  canvas.dataset.codArrivalGeneration = String(generation);
  if (definition.id !== id) { selectedId = ""; prefecture = "all"; year = INITIAL_OBSERVATION_YEAR; }
  definition = target; SOURCE_URL = target.source; button = buttonsById.get(id); data = cache.get(target.dataFile); currentPeriod = null;
  for (const provider of [globalThis.GaiaLiveExhibits, globalThis.GaiaEstatExhibits, globalThis.GaiaFirmsExhibit, globalThis.GaiaPlanetSignals, globalThis.GaiaFoodExhibits]) provider?.deactivate?.();
  active = true;
  globalThis.GaiaMapObservationAdapter?.closePoi?.();
  layer.classList.add("is-marine-cod-exhibit"); layer.dataset.marineCodExhibit = definition.id;
  canvas.hidden = readout.hidden = legend.hidden = false;
  for (const item of globalThis.GaiaMapCategories.buttons()) item.setAttribute("aria-current", String(item === button));
  document.querySelector("#japan-mode-number").textContent = definition.number;
  document.querySelector("#japan-mode-title").textContent = definition.shortTitle;
  const title = document.querySelector("#japan-title");
  title.textContent = definition.shortTitle; title.dataset.exhibitNumber = definition.number;
  title.setAttribute("aria-label", `${definition.number} ${definition.shortTitle}`);
  configureDefinition();
  q("[data-cod-controls]").disabled = true;
  selectionHelp.hidden = true;
  q("[data-cod-analysis]").disabled = true;
  q("[data-cod-place]").textContent = "データを読込中…";
  animateMetricText(q("[data-cod-value]"), "—", definition.id);
  q("[data-cod-secondary]").textContent = "";
  q("[data-cod-count]").textContent = "";
  context.clearRect(0, 0, canvas.width, canvas.height);
  q("[data-cod-status]").textContent = `${definition.organisation}の保存された観測統計を読込中…`;
  setPlaying(false);
  dispatchEvent(new CustomEvent("gaia:marine-cod-change", { detail: { active: true } }));
  let payload, initialPeriod;
  try {
    payload = await load(target);
    const initialYear = payload.periods.some(p => p.year === year) ? year
      : payload.periods[initialObservationIndex(payload.periods, p => p.year)].year;
    initialPeriod = await loadAnnualPeriod(payload, initialYear);
  }
  catch (error) {
    if (active && generation === selectionGeneration) {
      dataState = "error";
      q("[data-cod-status]").textContent = `読込に失敗しました。展示${definition.number}を選び直して再試行してください。`; q("[data-cod-controls]").disabled = true;
      dispatchEvent(new CustomEvent("gaia:marine-cod-error", { detail: { id } }));
    }
    console.warn("Annual observations unavailable", error);
    return;
  }
  if (!active || generation !== selectionGeneration) return;
  data = payload; currentPeriod = initialPeriod; year = initialPeriod.year;
  configureDefinition();
  dataState = "ready";
  q("[data-cod-controls]").disabled = false;
  q("[data-cod-status]").textContent = `${definition.organisation} / ${yearRange("–")}の保存値（リアルタイムではありません）`;
  q("[data-cod-retrieved]")?.replaceChildren(document.createTextNode(`${data.attribution || "環境省データをGAIA SENSEWAREが抽出・加工"}。原資料取得日 ${retrievalDates()}。${data.coordinateNote || ""} ${data.historyNote || ""}`));
  renderOptions(); render();
  dispatchEvent(new CustomEvent("gaia:marine-cod-ready", { detail: { id } }));
  // Let the shared mobile shell measure its final heading/dock before fitting.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (!active || generation !== selectionGeneration) return;
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.(japanPrefectureView(innerWidth));
  cancelAnimationFrame(frame); lastDraw = performance.now(); frame = requestAnimationFrame(draw);
};
const mount = () => {
  if (readout) return;
  layer = document.querySelector("#japan-layer"); map = document.querySelector("#japan-map");
  const list = layer?.querySelector(".map-mode-list"), bank = layer?.querySelector(".map-mode-bank");
  if (!map || !list || !bank) return;
  canvas = document.createElement("canvas"); canvas.id = "gaia-marine-cod-canvas"; canvas.hidden = true;
  canvas.setAttribute("aria-hidden", "true"); map.append(canvas); context = canvas.getContext("2d");
  readout = document.createElement("section"); readout.className = "gaia-marine-cod-readout"; readout.hidden = true;
  readout.setAttribute("aria-label", "沿岸CODの地点と年度");
  readout.innerHTML = `<div class="gaia-marine-cod-chapter"><p>COASTAL WATER / 水と森</p><div><button type="button" data-cod-step="-1" aria-label="前の展示、30へ">‹</button><button type="button" class="gaia-featured-selector-toggle" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover"><b>31</b><strong>${definition.shortTitle}</strong></button><button type="button" data-cod-step="1" aria-label="次の展示、01へ">›</button></div></div>
    <div class="gaia-cod-annotations"><p class="gaia-cod-status" data-cod-status role="status"></p><p class="gaia-cod-count" data-cod-count></p></div>
    <fieldset data-cod-controls disabled><legend class="gaia-cod-sr">地点・年度の選択</legend>
    <div class="gaia-cod-pickers"><p id="gaia-cod-selection-help" data-cod-selection-help role="status" hidden></p><label><span data-cod-region-label>地域</span><select data-cod-prefecture aria-label="COD測定地点の都道府県"></select></label><label><span data-cod-station-label>測定地点</span><select data-cod-station aria-label="CODの測定地点"></select></label></div>
    <div class="gaia-cod-primary" aria-live="polite"><span class="gaia-cod-value-label">COD 年度平均 / 有機物による汚れの目安</span><p data-cod-place></p><strong data-cod-value>—</strong><small data-cod-secondary></small><button type="button" data-cod-records hidden disabled>内訳を見る</button></div>
    <div class="gaia-cod-timeline"><label><b data-cod-period>2024年度</b><input data-cod-year type="range" min="2020" max="2024" step="1" value="2024" aria-label="CODの年度" /></label><button type="button" data-cod-play aria-pressed="false">年度を自動送り</button><button type="button" data-cod-overview>日本沿岸の全体へ</button></div>
    </fieldset>
    <div class="gaia-cod-actions"><button type="button" data-cod-source></button><button type="button" data-cod-analysis disabled></button></div>`;
  layer.append(readout);
  selectionHelp = q('[data-cod-selection-help]');
  // A dock may clip overflowing children, particularly on phones. Keep the
  // instruction in a viewport layer and position it next to the real picker.
  document.body.append(selectionHelp);
  addEventListener('gaia:japan-close', () => { selectionHelp.hidden = true; });
  addEventListener('resize', () => { selectionHelp.hidden = true; });
  addEventListener('pointerdown', event => {
    if (!selectionHelp.hidden && event.target instanceof Element && !event.target.closest('.gaia-cod-pickers, [data-cod-analysis]')) selectionHelp.hidden = true;
  }, { capture: true, passive: true });
  decorateMapActions(q(".gaia-cod-actions"), q("[data-cod-source]"), q("[data-cod-analysis]"));
  legend = createMetricLegend({ className: 'gaia-marine-cod-legend gaia-annual-metric-legend', label: '観測地点の値と色の目盛り' });
  legend.hidden = true;
  const legendNote = document.createElement('small'); legendNote.className = 'gaia-estat-history-note'; legendNote.dataset.annualLegendNote = '';
  legend.append(legendNote); layer.append(legend);
  for (const item of definitions) {
    const control = document.createElement("button"); control.type = "button"; control.className = "map-mode-button"; control.textContent = item.number;
    control.dataset.marineCodExhibit = item.id; control.dataset.mapPreviewSurface = "map";
    control.setAttribute("aria-label", `${item.number} ${item.shortTitle}、${item.signalLabel}の展示へ切り替える`);
    control.setAttribute("aria-current", "false"); control.setAttribute("aria-describedby", "map-mode-preview");
    control.addEventListener("click", () => void select(item.id)); list.append(control); buttonsById.set(item.id, control);
  }
  button = buttonsById.get(definition.id);
  bank.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest(".map-mode-button") : null;
    if (target && target !== button) deactivate();
  }, { capture: true });
  for (const node of [readout, legend]) for (const type of ["pointerdown", "wheel", "keydown", "keyup"]) node.addEventListener(type, event => event.stopPropagation());
  q("[data-cod-prefecture]").addEventListener("change", event => { globalThis.GaiaMapDemo?.stop?.("interaction"); globalThis.GaiaMapObservationAdapter?.closePoi?.(); prefecture = event.target.value; selectedId = ""; renderOptions(); render(); });
  q("[data-cod-station]").addEventListener("change", event => {
    globalThis.GaiaMapDemo?.stop?.("interaction");
    if (event.target.value) selectStation(event.target.value);
    else { selectedId = ""; globalThis.GaiaMapObservationAdapter?.closePoi?.(); renderOptions(); render(); }
  });
  q("[data-cod-year]").addEventListener("input", event => { globalThis.GaiaMapDemo?.stop?.("interaction"); setPlaying(false); setYear(event.target.value); });
  q("[data-cod-play]").addEventListener("click", () => { if (globalThis.GaiaMapPlayback) globalThis.GaiaMapPlayback.toggle(); else setPlaying(!playing); });
  q("[data-cod-overview]").addEventListener("click", focusAll);
  q("[data-cod-records]").addEventListener("click", showRecordDetail);
  for (const item of readout.querySelectorAll("[data-cod-step]")) item.addEventListener("click", () => {
    const buttons = globalThis.GaiaMapCategories.buttons(), index = buttons.indexOf(button);
    buttons[(index + Number(item.dataset.codStep) + buttons.length) % buttons.length]?.click();
  });
  q("[data-cod-analysis]").addEventListener("click", () => {
    if (!selectedId) { requestStatisticsSelection(); return; }
    const dataset = statisticsDataset(); if (!dataset) return;
    setPlaying(false);
    const open = () => globalThis.GaiaStatisticsLab?.open?.({ modeId: dataset.modeId, datasetId: dataset.id, dataset });
    if (globalThis.GaiaStatisticsLab?.open) open(); else addEventListener("gaia:statistics-lab-ready", open, { once: true });
  });
  const resume = () => { if (active && currentPeriod && !frame && !document.hidden) { lastDraw = performance.now(); lastYearAt = lastDraw; frame = requestAnimationFrame(draw); } };
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else resume(); });
  addEventListener("gaia:japan-open", resume);
  dispatchEvent(new CustomEvent("gaia:marine-cod-mounted"));
};
globalThis.GaiaMarineCod = Object.freeze({ get definition() { return definition; }, definitions, select, deactivate, selectStation, setYear, focusAll, findPoiAt,
  getCruisePoints: () => period()?.stations || [],
  selectCruisePoi: index => { const point = period()?.stations[index]; if (point) selectStation(point.id); },
  setPlayback: setPlaying,
  getPlaybackState: () => ({ ready: active && dataState === 'ready', supported: yearsFor(definition).length > 1, playing: active && playing,
    detail: '収録年度を順に表示します。', reason: yearsFor(definition).length > 1 ? '' : '収録データは1年分のみです。時間再生の対象外です。' }),
  getStatisticsDataset: statisticsDataset, restoreStatisticsDataset,
  requestStatisticsSelection,
  getState: () => ({ active, id: definition.id, year, selectedId, playing, dataState, count: period()?.stations.length || 0 }),
  getSourceInfo: () => active ? { number: definition.number, shortTitle: definition.shortTitle,
    datasets: [{ id: definition.id, title: `${isCod() ? "海域のCOD 年度平均値" : definition.metricLabel} / ${yearRange()}`, organisation: definition.organisation, url: station()?.sourceUrl || SOURCE_URL,
      attributionNote: [...new Set(`${definition.caption} ${definition.explanation || ''} ${definition.animationNote || ''} ${data?.attribution || `${definition.organisation}データをGAIA SENSEWAREが抽出・加工`}。原資料取得日 ${retrievalDates()}。${definition.comparisonNote || ""} ${data?.historyNote || ''}`.split(/(?<=。)/u).map(text=>text.trim()).filter(text=>text&&!text.includes('ESP32')))].join('') }] } : null });
// An explicit annual deep link can fetch its selected data while the shared
// map runtime starts. The same request/parsed payload is reused by select().
const entryNumber = globalThis.GaiaMapRoute.numberFromHash(location.hash) ?? Number(new URLSearchParams(location.search).get("exhibit"));
const entryDefinition = globalThis.GaiaMapRoute.isMapHash(location.hash)
  && definitions.find(item => Number(item.number) === entryNumber);
if (entryDefinition) void load(entryDefinition).catch(() => {});
if (globalThis.GaiaMapObservationAdapter) mount();
else addEventListener("gaia:map-adapter-ready", mount, { once: true });
