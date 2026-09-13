import { animateMetricText } from '../shared/animated-metric.js';
import { formatJapaneseNumber } from "../shared/number-format.js";
import { STATUS_LABELS } from "./transforms.js?v=gaia-live-loading-1";
import { earthBaseScale, earthLongitudeToMapX } from "./world-projection.js?v=gaia-japan-center-1";
import { japanPrefectureView } from "./japan-prefecture-view.js?v=gaia-prefecture-gis-view-1";
import { decorateMapActions } from "./map-exhibit-actions.js?v=gaia-map-polish-1";
import { LIVE_EXHIBITS as EXHIBITS } from "./live-exhibit-catalog.js?v=gaia-prefecture-fill-20260912";
import { createLivePrefectureMap } from "./live-prefecture-map.js?v=gaia-prefecture-fill-20260912";
import { OBSERVATION_CITIES, findObservationCity, adjacentObservationCity } from "./observation-cities.js?v=gaia-exhibit-catalog-1";
import { createMetricLegend, updateMetricLegend } from "./metric-legend.js?v=gaia-observation-mincho-1-i18n-20260913";
import { createObservationPlacePicker } from "./observation-place-picker.js?v=gaia-place-inline-1-i18n-20260913";
import { formatPrefecturePlace } from "./observation-place-label.js?v=gaia-place-inline-1";
import { createBroadcastBadge, updateBroadcastBadge } from "./realtime-exhibit-status.js?v=gaia-map-polish-1-live-red-1-footer-credit-1";

// Preserve the existing module export for callers outside the map runtime.
export { OBSERVATION_CITIES };

const LIVE_POI_DWELL_MS = 6800;
const LIVE_POI_DEPART_MS = 280;
const LIVE_POI_ARRIVE_MS = 1320;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let activeIndex = -1;
let layer = null;
let map = null;
let prefectureMap = null;
let readout = null;
let mobileReadoutToggle = null;
let chapterSelectorToggle = null;
let cityPicker = null;
let placePicker = null;
let resumePoiAfterPicker = false;
let metricLegend = null;
let weatherCredit = null;
let buttons = [];
let frame = 0;
let savedHeading = null;
let selectedCityId = globalThis.GaiaLiveData?.getCity?.() || OBSERVATION_CITIES[0].id;
let poiAutoplayEnabled = !reducedMotion;
let poiAutoplayTimer = 0;
let poiTransitionTimer = 0;
let poiTransitionGeneration = 0;
let hourlyPlayback = false, hourlyTimer = 0;
let hourlyStartedExhibit = -1;
const playbackPeriods = () => (globalThis.GaiaLiveData?.getPeriods?.(EXHIBITS[activeIndex]?.key) || [])
  .filter(time => Date.parse(time) <= Date.now()).slice().sort((a,b) => Date.parse(a)-Date.parse(b));
const setPlayback = enabled => {
  clearTimeout(hourlyTimer); hourlyTimer = 0;
  setPoiAutoplayEnabled(false);
  hourlyPlayback = Boolean(enabled && activeIndex >= 0);
  if (!hourlyPlayback) {
    // Stop a pending automatic city transition as well as its next timer.
    clearPoiTransitionTimer(); poiTransitionGeneration += 1; clearPoiTransitionPresentation();
    return;
  }
  // Enter each exhibit at the oldest available hour, not at the latest value.
  // A temporary pause keeps its place; only a new exhibit resets the sequence.
  if (hourlyStartedExhibit !== activeIndex) {
    hourlyStartedExhibit = activeIndex;
    const periods = playbackPeriods();
    if (periods.length) globalThis.GaiaLiveData.selectTime(periods[0]);
  }
  const tick = () => {
    if (!hourlyPlayback || activeIndex < 0) return;
    if (!document.hidden) {
      const periods = playbackPeriods();
      if (periods.length > 1) {
        const index = periods.indexOf(globalThis.GaiaLiveData.getSelectedTime());
        // The final stop is the actual latest slot. Then replay past → present.
        globalThis.GaiaLiveData.selectTime(index === periods.length - 1 ? null : periods[index + 1]);
      }
    }
    hourlyTimer = setTimeout(tick, 4000);
  };
  hourlyTimer = setTimeout(tick, 4000);
};

const setMobileReadoutExpanded = (expanded) => {
  const shouldExpand = Boolean(expanded && (innerWidth <= 720 || (innerHeight <= 520 && matchMedia("(pointer: coarse)").matches)));
  readout?.classList.toggle("is-mobile-expanded", shouldExpand);
  mobileReadoutToggle?.setAttribute("aria-expanded", String(shouldExpand));
  mobileReadoutToggle?.querySelector("strong")?.replaceChildren(shouldExpand ? "閉じる" : "詳細");
};

const formatValue = (measurement) => {
  if (measurement?.value == null || !Number.isFinite(Number(measurement.value))) return "—";
  const digits = measurement.key === "weatherPrecipitation" ? 2 : 1;
  const unit = measurement.unit || "";
  return `${formatJapaneseNumber(Number(measurement.value), digits)} ${unit}`.trim();
};

const formatJstDateTime = (value) => {
  if (!value) return "観測時刻なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "観測時刻なし";
  return `${new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date)} JST`;
};

const currentState = () => globalThis.GaiaLiveData?.getState?.() || { measurements: {}, source: "loading", requestState: "loading", connected: false };
const currentMeasurement = (exhibit) => currentState().measurements?.[exhibit.key] || null;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const WIND_FIELD_REFERENCE_MS = 15;
// Match the existing visual reference ranges, including the wind field's
// 15 m/s colour ceiling (which differs from the audio normalization range).
const LIVE_METRIC_SCALES = Object.freeze({
  weatherWindSpeed: [0, WIND_FIELD_REFERENCE_MS, "m/s", "#3470ff, #26d1ec 22%, #3ee291 42%, #f4de46 62%, #ff8124 80%, #ff2b43"],
  forecastCo2: [280, 650, "ppm", "#423d72, #ba8753, #ffd06f"],
  weatherPrecipitation: [0, 30, "mm", "#163950, #417fc4, #a4e5ff"],
  weatherTemperature: [-20, 45, "℃", "#567cc9, #bde3ef, #ff9b69, #fff1bb"],
  cloudCover: [0, 100, "%", "#163950, #779cb7, #e5f4fa"],
  pm25: [0, 150, "µg/m³", "#353052, #895ea7, #d49bff"],
});

const updateLiveCreditPosition = () => {
  if (activeIndex < 0 || !readout || readout.hidden) return;
  const bounds = readout.getBoundingClientRect();
  const style = getComputedStyle(readout);
  // The entrance uses translate without resizing the dock. ResizeObserver
  // therefore cannot correct a top measured while that animation is running.
  // Reserve the settled, bottom-anchored box, including its rendered CSS zoom.
  const scale = readout.offsetHeight ? bounds.height / readout.offsetHeight : 1;
  const anchorBottom = readout.offsetParent?.getBoundingClientRect().bottom ?? innerHeight;
  const settledTop = anchorBottom - (parseFloat(style.bottom) || 0) * scale - bounds.height;
  const top = Math.min(bounds.top, settledTop);
  layer.style.setProperty("--live-credit-bottom", `${Math.ceil(Math.max(0, innerHeight - top + 12))}px`);
};
const selectedCity = () => findObservationCity(selectedCityId) || OBSERVATION_CITIES[0];
const cityForLocation = (location) => OBSERVATION_CITIES.find((city) => (
  Math.abs(city.lat - Number(location?.lat)) < 0.08 && Math.abs(city.lon - Number(location?.lon)) < 0.08
)) || selectedCity();

const observationLocation = (exhibit, measurement) => {
  const location = measurement?.location;
  const lon = Number(location?.lon);
  const lat = Number(location?.lat);
  const fallbackCity = selectedCity();
  // Provider attribution belongs in the edge credit and source ledger, not place names.
  // Normalize display text only; keep the API/snapshot provenance unchanged.
  const city = cityForLocation(location);
  return {
    lon: Number.isFinite(lon) ? lon : fallbackCity.lon,
    lat: Number.isFinite(lat) ? lat : fallbackCity.lat,
    label: formatPrefecturePlace(city.prefecture, city.city),
  };
};

const getLiveMapProjection = () => {
  const rect = map?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return null;
  const overlay = document.querySelector("#japan-overlay");
  const zoom = Math.max(1, Number(overlay?.dataset.earthZoom) || 1);
  const offsetX = Number(overlay?.dataset.earthOffsetX) || 0;
  const offsetY = Number(overlay?.dataset.earthOffsetY) || 0;
  const scale = earthBaseScale(rect) * zoom;
  const worldWidth = 360 * scale;
  const worldHeight = 180 * scale;
  const originX = (rect.width - worldWidth) / 2 + offsetX;
  const originY = (rect.height - worldHeight) / 2 + offsetY;
  return { rect, scale, originX, originY };
};

const draw = () => {
  cancelAnimationFrame(frame);
  frame = 0;
  if (activeIndex < 0 || !prefectureMap || layer.hidden) return;
  const exhibit = EXHIBITS[activeIndex];
  const measurement = currentMeasurement(exhibit);
  const projection = getLiveMapProjection();
  prefectureMap.update({ projection, exhibit, measurement, selectedCity: selectedCityId,
    field: globalThis.GaiaLiveData?.getPrefectureField?.(), scale: LIVE_METRIC_SCALES[exhibit.key] });
};

const renderReadout = () => {
  if (activeIndex < 0 || !readout) return;
  const exhibit = EXHIBITS[activeIndex];
  const state = currentState();
  const measurement = currentMeasurement(exhibit);
  const missing = !measurement || measurement.value == null || !Number.isFinite(Number(measurement.value));
  const pending = state.requestState === "loading" || state.source === "loading";
  const retained = !missing && state.requestState === "unavailable";
  const strength = missing ? exhibit.fallback : clamp01(measurement.normalized);
  const location = observationLocation(exhibit, measurement);
  const locationCity = cityForLocation(location);
  const savedMeasurement = measurement?.status === "snapshot";
  const modelMeasurement = measurement?.sourceKind === "MODEL";
  const feedState = state.selectedTime ? "選択時刻のモデル値" : pending ? missing ? "データを取得中" : "前回値を表示して更新中"
    : retained ? "前回取得値を表示中"
    : missing ? state.source === "snapshot" ? "この地点の保存値は未収録" : "データを取得できませんでした"
    : state.connected && !savedMeasurement
    ? modelMeasurement ? "最新モデル値 / 5分ごとに再確認" : "公開観測値 / 5分ごとに再確認"
    : state.source === "live"
      ? "前回取得値 / 再接続中"
      : "保存データを再現中";
  const placeHeading = readout.querySelector(".gaia-live-place-heading");
  let broadcast = placeHeading.querySelector(".gaia-broadcast-badge");
  if (!broadcast) { broadcast = createBroadcastBadge(); placeHeading.append(broadcast); }
  updateBroadcastBadge(broadcast, { sourceState: pending ? "FETCHING" : missing ? "ERROR"
    : retained || savedMeasurement || !state.connected ? "SAVED SNAPSHOT" : "LIVE", observedAt: measurement?.observedAt });
  const observedAt = formatJstDateTime(measurement?.observedAt);
  readout.dataset.missing = String(missing);
  readout.dataset.requestState = state.requestState || "ready";
  readout.dataset.exhibit = exhibit.id;
  readout.dataset.selectedTime = state.selectedTime || "latest";
  readout.style.setProperty("--live-signal-level", String(strength));
  readout.querySelector("[data-live-exhibit-kicker]").textContent = exhibit.signalLabel;
  const [titleJa, titleEn = ""] = exhibit.title.split(" — ");
  const exhibitTitle = readout.querySelector("[data-live-exhibit-title]");
  exhibitTitle.setAttribute("aria-label", exhibit.title);
  exhibitTitle.querySelector("[data-live-exhibit-title-ja]").textContent = titleJa;
  exhibitTitle.querySelector("[data-live-exhibit-title-en]").textContent = titleEn;
  const valueNode = readout.querySelector("[data-live-exhibit-value]");
  if (missing) animateMetricText(valueNode, pending ? "取得中" : "—", exhibit.id);
  else {
    let numberNode = valueNode.querySelector('[data-live-count-value]');
    if (!numberNode) {
      numberNode = document.createElement('span'); numberNode.dataset.liveCountValue = '';
      valueNode.replaceChildren(numberNode, document.createElement('small'));
    }
    valueNode.querySelector('small').textContent = ` ${measurement.unit || ''}`;
    animateMetricText(numberNode, formatJapaneseNumber(Number(measurement.value), measurement.key === 'weatherPrecipitation' ? 2 : 1), exhibit.id);
  }
  readout.querySelector("[data-live-exhibit-caption]").textContent = exhibit.caption.replaceAll("東京", locationCity.city);
  readout.querySelector("[data-live-deck-question]").textContent = exhibit.question;
  weatherCredit.querySelector("[data-live-exhibit-feed-state]").textContent = feedState;
  weatherCredit.querySelector("[data-live-exhibit-feed-time]").textContent = missing ? "データ時刻 —" : `データ時刻 ${observedAt}`;
  const [minimum, maximum, defaultUnit, colors] = LIVE_METRIC_SCALES[exhibit.key];
  const unit = measurement?.unit || defaultUnit;
  const metricDate = measurement?.observedAt ? new Date(measurement.observedAt) : null;
  updateMetricLegend(metricLegend, {
    title: exhibit.signalLabel,
    scope: location.label,
    period: missing || !metricDate || !Number.isFinite(metricDate.getTime()) ? "" : new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(metricDate) + " JST",
    current: missing ? pending ? "取得中" : "未取得" : formatValue(measurement),
    value: missing ? null : Number(measurement.value), minimum, maximum,
    minimumLabel: `${minimum} ${unit}`,
    maximumLabel: `${maximum}${exhibit.key === "weatherWindSpeed" ? "+" : ""} ${unit}`,
    gradient: `linear-gradient(90deg, ${colors})`,
    description: `${feedState}。${observedAt}。県の色は代表都市のモデル値で、都道府県平均ではありません。灰色はデータなし。針は選択地域の値を示し、範囲外では端で止まります。`,
  });
  readout.querySelector("[data-live-exhibit-feed-copy]").textContent = pending
    ? missing ? "選択した地点のデータを取得しています。別の地点の値で補わず、到着した値から表示します。"
      : "同じ地点の前回取得値を表示しながら更新しています。データ時刻は前回取得値のものです。"
    : retained ? "再取得できなかったため、同じ地点の前回取得値とそのデータ時刻を表示しています。"
    : missing ? state.source === "snapshot" ? "この地点の値は保存データに収録されていません。保存値のある地点を選ぶか、ライブ接続で確認してください。"
      : "選択した地点のデータを取得できませんでした。別の地点の値で置き換えず、次の更新を待ちます。"
    : state.connected && !savedMeasurement
    ? exhibit.refreshCopy
    : state.source === "live"
      ? `この項目は保存済み${modelMeasurement ? "モデル" : "観測"}値です。ライブ取得できた項目だけを5分ごとに更新し、混在状態を明示します。`
      : `現在は保存済み${modelMeasurement ? "モデル" : "観測"}データの再現です。準リアルタイム接続時も、取得できない項目はこの状態を明示します。`;
  readout.querySelector("[data-live-exhibit-scale]").textContent = exhibit.scaleLabel;
  readout.querySelector("[data-live-stage-signal]").textContent = missing ? pending ? "LOADING" : "STANDBY" : formatValue(measurement);
  readout.querySelector("[data-live-stage-location]").textContent = location.label;
  readout.querySelector("[data-live-stage-coordinates]").textContent = `${Math.abs(location.lat).toFixed(1)}°${location.lat >= 0 ? "N" : "S"}`;
  readout.querySelector("[data-live-stage-visual]").textContent = exhibit.visualCue;
  readout.querySelector("[data-live-exhibit-input]").textContent = missing
    ? pending ? `${exhibit.signalLabel}を取得中です。値がない都道府県は灰色で表示します。` : `${exhibit.signalLabel}は未取得です。値がない都道府県は灰色で表示します。`
    : `${exhibit.signalLabel} ${formatValue(measurement)}を変換の起点にします。`;
  readout.querySelector("[data-live-exhibit-location]").textContent = `${location.label}（${location.lat.toFixed(3)}°, ${location.lon.toFixed(3)}°）のモデル値を、対応する都道府県の色で表示します。都道府県平均ではありません。`;
  readout.querySelector("[data-live-exhibit-visual-map]").textContent = exhibit.visualMap;
  readout.querySelector("[data-live-exhibit-source]").textContent = measurement
    ? `${measurement.provider?.toUpperCase() || "SOURCE"} · ${measurement.datasetId || "PUBLIC DATA"}`
    : pending ? "SOURCE DATA LOADING · VISUAL SCAN STANDBY" : "SOURCE DATA UNAVAILABLE · VISUAL SCAN STANDBY";
  readout.querySelector("[data-live-exhibit-time]").textContent = observedAt;
  readout.querySelector("[data-live-deck-number]").textContent = exhibit.number;
  readout.querySelector("[data-live-deck-title]").textContent = exhibit.shortTitle;
  readout.querySelector("[data-live-deck-location]").textContent = location.label;
  readout.querySelector(".gaia-live-place-selector").title = `${location.label} · ${Math.abs(location.lat).toFixed(4)}°${location.lat >= 0 ? "N" : "S"} / ${Math.abs(location.lon).toFixed(4)}°${location.lon >= 0 ? "E" : "W"}`;
  readout.querySelectorAll("[data-live-poi-step]").forEach((button) => {
    const direction = Number(button.dataset.livePoiStep) || 0;
    const target = adjacentObservationCity(selectedCityId, direction);
    button.setAttribute("aria-label", `${direction < 0 ? "前" : "次"}の観測地点、${target.code} ${formatPrefecturePlace(target.prefecture, target.city)}へ送る`);
  });
  if (cityPicker) {
    cityPicker.dataset.city = selectedCityId;
    weatherCredit.querySelector("[data-live-cams-credit]").hidden = !["forecastCo2", "pm25"].includes(exhibit.key);
    placePicker?.sync(selectedCityId);
  }
  updateLiveCreditPosition();
  renderTimeline(exhibit);
};

const renderTimeline = exhibit => {
  const timeline = readout.querySelector('.gaia-live-timeline');
  if (!timeline) return;
  const periods = globalThis.GaiaLiveData?.getPeriods?.(exhibit.key) || [];
  const selected = globalThis.GaiaLiveData?.getSelectedTime?.();
  const input = timeline.querySelector('input');
  const index = selected ? periods.indexOf(selected) : periods.length;
  const short = value => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
  input.max = String(periods.length); input.value = String(Math.max(0, index)); input.disabled = !periods.length;
  const latestAt = globalThis.GaiaLiveData?.getLatestState?.().measurements?.[exhibit.key]?.observedAt;
  const latestLabel = Number.isFinite(Date.parse(latestAt)) ? `${short(latestAt)}（最新）` : '時刻不明（最新）';
  const label = selected ? short(selected) : latestLabel;
  input.setAttribute('aria-valuetext', `${label} JST・モデル値`);
  timeline.querySelector('[data-live-period]').textContent = label;
  timeline.querySelector('[data-live-period-note]').textContent = periods.length ? 'JST · 1時間ごと' : '時間別データなし';
  const ticks = timeline.querySelector('[data-live-period-ticks]');
  const signature = periods.join('|') + latestLabel;
  if (ticks.dataset.signature !== signature) {
    ticks.dataset.signature = signature;
    ticks.replaceChildren(...[...periods, null].map((time, i) => {
      const tick = document.createElement('i');
      if (i === 0 || i === Math.floor(periods.length / 2) || i === periods.length) {
        const text = document.createElement('span'); text.textContent = time ? short(time) : latestLabel; tick.append(text);
      }
      return tick;
    }));
  }
  ticks.style.setProperty('--live-period-count', String(periods.length + 1));
  [...ticks.children].forEach((tick, i) => tick.classList.toggle('is-current', i === index));
};

const applyHeading = () => {
  if (activeIndex < 0) return;
  const exhibit = EXHIBITS[activeIndex];
  layer.style.setProperty("--map-accent", exhibit.accent);
  layer.style.setProperty("--map-accent-rgb", exhibit.rgb);
  document.querySelector("#japan-mode-number").textContent = exhibit.number;
  document.querySelector("#japan-mode-title").textContent = exhibit.shortTitle;
  const mapTitle = document.querySelector("#japan-title");
  mapTitle.dataset.exhibitNumber = exhibit.number;
  mapTitle.textContent = exhibit.shortTitle;
  mapTitle.setAttribute("aria-label", `${exhibit.number} ${exhibit.shortTitle}`);
  chapterSelectorToggle?.setAttribute("aria-label", `${exhibit.number} ${exhibit.shortTitle}。展示一覧を開く`);
  buttons.forEach((button, index) => button.setAttribute("aria-current", String(index === activeIndex)));
  globalThis.GaiaMapCategories.buttons().filter((button) => !button.dataset.liveExhibit).forEach((button) => button.setAttribute("aria-current", "false"));
  const modeButtons = globalThis.GaiaMapCategories.buttons();
  const activeButtonIndex = modeButtons.findIndex((button) => button.getAttribute("aria-current") === "true");
  readout?.querySelectorAll("[data-live-deck-step]").forEach((button) => {
    if (activeButtonIndex < 0 || modeButtons.length < 2) return;
    const direction = Number(button.dataset.liveDeckStep) || 0;
    const target = modeButtons[(activeButtonIndex + direction + modeButtons.length) % modeButtons.length];
    button.setAttribute("aria-label", `${direction < 0 ? "前" : "次"}の展示、${target.getAttribute("aria-label") || target.textContent?.trim() || "地図展示"}`);
  });
  const legend = document.querySelector("[data-signal-encoding-legend]");
  const legendTitle = document.querySelector("[data-signal-encoding-legend-title]");
  const mobileLegendToggle = document.querySelector("#map-mobile-legend-toggle");
  if (legend) {
    const labels = [
      `県の色 / ${exhibit.signalLabel}`,
      "灰色 / データなし",
      "値 / 代表都市のモデル値",
      "都道府県平均ではありません",
    ];
    ["heatmap", "nodata", "estimate", "resolution"].forEach((key, index) => {
      const item = legend.querySelector(`[data-encoding-label="${key}"]`);
      if (item?.lastChild) item.lastChild.textContent = labels[index];
    });
    legend.dataset.mode = `live-${exhibit.id}`;
    legend.hidden = false;
    if (legendTitle) legendTitle.hidden = false;
    if (mobileLegendToggle) mobileLegendToggle.hidden = false;
  }
};

const clearPoiAutoplayTimer = () => {
  clearTimeout(poiAutoplayTimer);
  poiAutoplayTimer = 0;
};

const clearPoiTransitionTimer = () => {
  clearTimeout(poiTransitionTimer);
  poiTransitionTimer = 0;
};

const clearPoiTransitionPresentation = () => {
  if (layer) {
    layer.dataset.livePoiTransition = "settled";
    delete layer.dataset.livePoiFrom;
    delete layer.dataset.livePoiTo;
  }
  if (cityPicker) delete cityPicker.dataset.transition;
};

const schedulePoiAutoplay = (delay = LIVE_POI_DWELL_MS) => {
  clearPoiAutoplayTimer();
  if (!layer) return;
  const canRun = poiAutoplayEnabled && activeIndex >= 0 && !document.hidden;
  layer.dataset.livePoiAutoplay = canRun ? "running" : "paused";
  if (!canRun) return;
  const safeDelay = Math.max(1200, Number(delay) || LIVE_POI_DWELL_MS);
  layer.style.setProperty("--live-poi-dwell", `${safeDelay}ms`);
  poiAutoplayTimer = window.setTimeout(() => {
    poiAutoplayTimer = 0;
    if (activeIndex < 0 || document.hidden || !poiAutoplayEnabled) return;
    const nextCity = adjacentObservationCity(selectedCityId, 1);
    selectObservationCity(nextCity.id, { source: "auto" });
  }, safeDelay);
};

const setPoiAutoplayEnabled = (enabled) => {
  poiAutoplayEnabled = Boolean(enabled && !reducedMotion);
  if (poiAutoplayEnabled) schedulePoiAutoplay();
  else {
    clearPoiAutoplayTimer();
    if (layer) layer.dataset.livePoiAutoplay = "paused";
  }
  return poiAutoplayEnabled;
};

const selectObservationCity = (cityId, {
  source = "manual",
  animate = true,
  force = false,
} = {}) => {
  const nextCity = findObservationCity(cityId);
  if (!nextCity) return false;
  if (source === "manual") {
    resumePoiAfterPicker = false;
    setPoiAutoplayEnabled(false);
    globalThis.GaiaMapDemo?.stop?.("interaction");
  }
  const previousCity = selectedCity();
  if (!force && previousCity.id === nextCity.id) {
    if (["departing", "arriving"].includes(layer?.dataset.livePoiTransition)) {
      poiTransitionGeneration += 1;
      clearPoiTransitionTimer();
      clearPoiTransitionPresentation();
      if (cityPicker) {
        cityPicker.dataset.state = "ready";
        placePicker?.sync(nextCity.id);
      }
      renderReadout();
      draw(performance.now(), true);
    }
    schedulePoiAutoplay();
    return true;
  }

  const generation = ++poiTransitionGeneration;
  clearPoiAutoplayTimer();
  clearPoiTransitionTimer();
  clearPoiTransitionPresentation();
  layer.dataset.livePoiTransition = animate && !reducedMotion ? "departing" : "arriving";
  layer.dataset.livePoiFrom = previousCity.code;
  layer.dataset.livePoiTo = nextCity.code;
  layer.dataset.livePoiSource = source;
  cityPicker.dataset.transition = "departing";
  if (cityPicker) {
    cityPicker.dataset.state = "loading";
    placePicker?.sync(nextCity.id);
    cityPicker.querySelector(".gaia-live-place-selector").title = `${formatPrefecturePlace(nextCity.prefecture, nextCity.city)}へ移動中`;
  }

  dispatchEvent(new CustomEvent("gaia:live-poi-change", {
    detail: { from: previousCity.id, to: nextCity.id, code: nextCity.code, source, phase: "departing" },
  }));

  const commit = () => {
    if (generation !== poiTransitionGeneration || activeIndex < 0) return;
    selectedCityId = nextCity.id;
    layer.dataset.livePoiTransition = "arriving";
    cityPicker.dataset.transition = "arriving";
    void globalThis.GaiaLiveData?.selectCity?.(nextCity.id);
    renderReadout();
    draw(performance.now(), true);
    dispatchEvent(new CustomEvent("gaia:live-poi-change", {
      detail: { from: previousCity.id, to: nextCity.id, code: nextCity.code, source, phase: "arriving" },
    }));
    poiTransitionTimer = window.setTimeout(() => {
      if (generation !== poiTransitionGeneration || activeIndex < 0) return;
      clearPoiTransitionPresentation();
      dispatchEvent(new CustomEvent("gaia:live-poi-change", {
        detail: { from: previousCity.id, to: nextCity.id, code: nextCity.code, source, phase: "settled" },
      }));
      schedulePoiAutoplay();
    }, reducedMotion ? 0 : LIVE_POI_ARRIVE_MS);
  };

  if (animate && !reducedMotion) poiTransitionTimer = window.setTimeout(commit, LIVE_POI_DEPART_MS);
  else commit();
  return true;
};

const select = (index) => {
  globalThis.GaiaMarineCod?.deactivate?.();
  globalThis.GaiaFoodExhibits?.deactivate?.();
  if (!EXHIBITS[index]) return;
  placePicker?.close({ restoreFocus: false });
  globalThis.GaiaFirmsExhibit?.deactivate?.();
  const enteringLiveDeck = activeIndex < 0;
  if (enteringLiveDeck) {
    savedHeading = {
      number: document.querySelector("#japan-mode-number")?.textContent || "06",
      title: document.querySelector("#japan-mode-title")?.textContent || "積み重なるCO₂",
    };
    selectedCityId = globalThis.GaiaLiveData?.getCity?.() || selectedCityId;
    poiAutoplayEnabled = !reducedMotion;
    globalThis.GaiaLiveData?.selectTime?.(null);
  }
  activeIndex = index;
  const exhibit = EXHIBITS[index];
  const time = globalThis.GaiaLiveData?.getSelectedTime?.();
  if (time && !globalThis.GaiaLiveData?.getPeriods?.(exhibit.key).includes(time)) globalThis.GaiaLiveData?.selectTime?.(null);
  layer.classList.add("is-live-exhibit");
  layer.dataset.liveExhibit = exhibit.id;
  prefectureMap.setActive(true);
  layer.dataset.liveMapDisplay = "prefecture-choropleth";
  readout.hidden = false;
  cityPicker.hidden = false;
  metricLegend.hidden = false;
  weatherCredit.hidden = false;
  setMobileReadoutExpanded(false);
  applyHeading();
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.(japanPrefectureView(innerWidth));
  if (enteringLiveDeck) {
    selectObservationCity(selectedCityId, {
      source: "entry",
      animate: false,
      force: true,
    });
  } else {
    renderReadout();
    draw(performance.now(), true);
    schedulePoiAutoplay();
  }
  dispatchEvent(new CustomEvent("gaia:live-exhibit-change", { detail: { index, id: exhibit.id } }));
  queueMicrotask(applyHeading);
};

const deactivate = ({ number, title } = {}) => {
  if (activeIndex < 0) return;
  setPlayback(false);
  clearPoiAutoplayTimer();
  clearPoiTransitionTimer();
  poiTransitionGeneration += 1;
  clearPoiTransitionPresentation();
  activeIndex = -1;
  hourlyStartedExhibit = -1;
  globalThis.GaiaLiveData?.selectTime?.(null);
  placePicker?.close({ restoreFocus: false });
  cancelAnimationFrame(frame);
  frame = 0;
  layer.classList.remove("is-live-exhibit");
  delete layer.dataset.liveExhibit;
  delete layer.dataset.liveMapDisplay;
  prefectureMap.setActive(false);
  readout.hidden = true;
  if (cityPicker) cityPicker.hidden = true;
  if (metricLegend) metricLegend.hidden = true;
  if (weatherCredit) weatherCredit.hidden = true;
  if (layer) {
    delete layer.dataset.livePoiAutoplay;
    delete layer.dataset.livePoiSource;
    layer.style.removeProperty("--live-poi-dwell");
  }
  setMobileReadoutExpanded(false);
  buttons.forEach((button) => button.setAttribute("aria-current", "false"));
  layer.style.removeProperty("--map-accent");
  layer.style.removeProperty("--map-accent-rgb");
  const restored = number && title ? { number, title } : savedHeading;
  if (restored) {
    document.querySelector("#japan-mode-number").textContent = restored.number;
    document.querySelector("#japan-mode-title").textContent = restored.title;
    const mapTitle = document.querySelector("#japan-title");
    mapTitle.dataset.exhibitNumber = restored.number;
    mapTitle.textContent = restored.title;
    mapTitle.setAttribute("aria-label", `${restored.number} ${restored.title}`);
  }
  savedHeading = null;
  dispatchEvent(new CustomEvent("gaia:live-exhibit-change", { detail: { index: -1, id: null } }));
};

const mount = () => {
  if (prefectureMap) return;
  layer = document.querySelector("#japan-layer");
  map = document.querySelector("#japan-map");
  const list = document.querySelector("#japan-mode-list");
  if (!(layer instanceof HTMLElement) || !(map instanceof HTMLElement) || !(list instanceof HTMLElement)) return;
  prefectureMap = createLivePrefectureMap({ map,
    onSelect: city => selectObservationCity(city, { source: "manual", animate: false }),
    onPause: () => { setPoiAutoplayEnabled(false); globalThis.GaiaMapDemo?.stop?.("interaction"); },
  });
  // Camera changes are interactive even with reduced motion enabled. Redraw
  // only when projection/data changes; filled regions need no animation loop.
  const projectionObserver = new MutationObserver(() => {
    if (activeIndex >= 0 && !document.hidden && !frame) frame = requestAnimationFrame(draw);
  });
  projectionObserver.observe(document.querySelector("#japan-overlay"), {
    attributes: true, attributeFilter: ["data-earth-zoom", "data-earth-offset-x", "data-earth-offset-y"],
  });

  metricLegend = createMetricLegend({ className: "gaia-live-metric-legend", label: "選択した都道府県のモデル値と目盛り" });
  metricLegend.hidden = true;
  layer.append(metricLegend);
  weatherCredit = document.createElement("div");
  weatherCredit.className = "gaia-live-weather-credit";
  weatherCredit.hidden = true;
  weatherCredit.innerHTML = `
    <div class="gaia-live-data-credit" aria-label="気象データのクレジット">
      <a data-live-cams-credit href="https://ads.atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer" aria-label="Copernicus Atmosphere Monitoring Service (CAMS)" hidden>CAMS</a>
      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
      <span aria-hidden="true">·</span>
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
      <span>／加工表示</span>
    </div>
    <div class="gaia-live-data-freshness" aria-label="データの取得状態と時刻" aria-live="polite">
      <strong data-live-exhibit-feed-state></strong>
      <time data-live-exhibit-feed-time></time>
    </div>
  `;
  layer.querySelector(".japan-credits").append(weatherCredit);

  readout = document.createElement("section");
  readout.className = "gaia-live-exhibit-readout";
  readout.hidden = true;
  readout.setAttribute("aria-live", "polite");
  readout.innerHTML = `
    <div class="gaia-live-deck-chapter">
      <p>リアルタイム展示</p>
      <div>
        <button type="button" data-live-deck-step="-1" aria-label="一つ前のライブ展示へ">‹</button>
        <button class="gaia-live-deck-selector-toggle" data-map-bank-toggle type="button" aria-expanded="false" aria-controls="map-dock-bank-popover" aria-label="15 街を通る風。展示一覧を開く">
          <span data-live-deck-number>15</span>
          <strong data-live-deck-title>街を通る風</strong>
        </button>
        <button type="button" data-live-deck-step="1" aria-label="一つ次のライブ展示へ">›</button>
      </div>
    </div>
    <div class="gaia-live-deck-location gaia-live-prefecture-picker">
      <p class="gaia-live-place-heading"><span>代表都市のモデル値</span></p>
      <div class="gaia-live-deck-location-control">
        <button type="button" data-live-poi-step="-1" aria-label="前の観測地点へ">‹</button>
        <button type="button" class="gaia-live-place-selector" aria-label="都道府県を選ぶ">
          <strong data-live-deck-location aria-hidden="true">北海道（札幌市）</strong>
        </button>
        <button type="button" data-live-poi-step="1" aria-label="次の観測地点へ">›</button>
      </div>
    </div>
    <div class="gaia-live-exhibit-primary">
      <div>
        <p data-live-exhibit-kicker></p>
        <h3 data-live-exhibit-title>
          <span data-live-exhibit-title-ja></span>
          <small data-live-exhibit-title-en></small>
        </h3>
      </div>
      <strong data-live-exhibit-value></strong>
    </div>
    <section class="gaia-live-timeline" aria-label="時間別モデル値">
      <header><label for="gaia-live-time">表示時刻 / <b data-live-period>時刻を確認中</b></label><span data-live-period-note>JST</span></header>
      <input id="gaia-live-time" type="range" min="0" max="0" step="1" value="0" aria-label="表示時刻を選ぶ" disabled>
      <div data-live-period-ticks aria-hidden="true"></div>
    </section>
    <section class="gaia-live-deck-question" aria-labelledby="gaia-live-deck-question-label">
      <span id="gaia-live-deck-question-label">この地図で確かめること</span>
      <strong data-live-deck-question></strong>
    </section>
    <div class="gaia-live-deck-actions gaia-live-exhibit-actions">
      <button type="button" data-live-deck-source aria-label="データの出典を表示する"></button>
      <button type="button" data-live-deck-analysis></button>
    </div>
    <button class="gaia-live-mobile-toggle" id="gaia-live-mobile-toggle" type="button" aria-expanded="false" aria-controls="gaia-live-exhibit-details">
      <span>表示内容</span><strong>詳細</strong><i aria-hidden="true"></i>
    </button>
    <div class="gaia-live-exhibit-signal" aria-label="観測値の変換強度">
      <span><i></i></span>
      <small data-live-exhibit-scale></small>
    </div>
    <div class="gaia-live-exhibit-details" id="gaia-live-exhibit-details">
    <section class="gaia-live-exhibit-explanation" aria-label="展示の説明と観測状態">
      <p class="gaia-live-exhibit-summary" data-live-exhibit-caption></p>
      <p data-live-exhibit-feed-copy></p>
    </section>
    <ol class="gaia-live-exhibit-path" aria-label="モデル値から都道府県の色への変換経路">
      <li data-live-stage="observe">
        <span>01</span>
        <i class="gaia-live-stage-symbol" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="5"/><circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="27"/></svg></i>
        <b>観測</b><em data-live-stage-signal>—</em>
        <p class="gaia-live-exhibit-a11y" data-live-exhibit-input></p>
      </li>
      <li data-live-stage="locate">
        <span>02</span>
        <i class="gaia-live-stage-symbol" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="27" r="9"/><path d="M32 5c-13 0-23 10-23 23 0 17 23 31 23 31s23-14 23-31C55 15 45 5 32 5Z"/></svg></i>
        <b>地図</b><em data-live-stage-location>TOKYO</em><small data-live-stage-coordinates>35.7°N</small>
        <p class="gaia-live-exhibit-a11y" data-live-exhibit-location></p>
      </li>
      <li data-live-stage="visualize">
        <span>03</span>
        <i class="gaia-live-stage-symbol" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M4 21c10-12 18 12 28 0s18 12 28 0M4 33c10-12 18 12 28 0s18 12 28 0M4 45c10-12 18 12 28 0s18 12 28 0"/></svg></i>
        <b>光</b><em data-live-stage-visual>流線</em>
        <p class="gaia-live-exhibit-a11y" data-live-exhibit-visual-map></p>
      </li>
    </ol>
    <footer><span data-live-exhibit-source></span><time data-live-exhibit-time></time></footer>
    </div>
  `;
  decorateMapActions(readout.querySelector(".gaia-live-deck-actions"), readout.querySelector("[data-live-deck-source]"), readout.querySelector("[data-live-deck-analysis]"));
  cityPicker = readout.querySelector(".gaia-live-prefecture-picker");
  layer.append(readout);
  placePicker = createObservationPlacePicker({
    container: layer,
    trigger: cityPicker.querySelector(".gaia-live-place-selector"),
    getSelected: () => selectedCityId,
    onSelect: cityId => selectObservationCity(cityId, { source: "manual" }),
    onOpen: () => {
      resumePoiAfterPicker = poiAutoplayEnabled;
      setPoiAutoplayEnabled(false);
    },
    onClose: () => {
      if (resumePoiAfterPicker && activeIndex >= 0 && !layer.hidden && layer.getAttribute("aria-hidden") !== "true") setPoiAutoplayEnabled(true);
      resumePoiAfterPicker = false;
    },
  });
  new ResizeObserver(updateLiveCreditPosition).observe(readout);
  addEventListener("resize", updateLiveCreditPosition, { passive: true });
  chapterSelectorToggle = readout.querySelector(".gaia-live-deck-selector-toggle");
  readout.querySelector('#gaia-live-time').addEventListener('input', event => {
    setPoiAutoplayEnabled(false);
    const periods = globalThis.GaiaLiveData?.getPeriods?.(EXHIBITS[activeIndex]?.key) || [];
    globalThis.GaiaLiveData?.selectTime?.(periods[Number(event.target.value)] || null);
  });
  addEventListener('gaia:live-time-change', () => { renderReadout(); draw(performance.now(), true); });
  // The title delegates to the same category picker as all other providers.
  readout.querySelectorAll("[data-live-deck-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const modeButtons = globalThis.GaiaMapCategories.buttons();
      const activeButtonIndex = modeButtons.findIndex((candidate) => candidate.getAttribute("aria-current") === "true");
      if (activeButtonIndex < 0 || !modeButtons.length) return;
      modeButtons[(activeButtonIndex + Number(button.dataset.liveDeckStep) + modeButtons.length) % modeButtons.length]?.click();
    });
  });
  mobileReadoutToggle = readout.querySelector("#gaia-live-mobile-toggle");
  mobileReadoutToggle?.addEventListener("click", () => {
    setMobileReadoutExpanded(mobileReadoutToggle.getAttribute("aria-expanded") !== "true");
  });
  dispatchEvent(new CustomEvent("gaia:live-exhibit-mounted"));

  [readout].forEach((container) => {
    container?.querySelectorAll("[data-live-poi-step]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const direction = Number(button.dataset.livePoiStep) || 0;
        const target = adjacentObservationCity(selectedCityId, direction);
        selectObservationCity(target.id, { source: "manual" });
      });
    });
  });

  buttons = EXHIBITS.map((exhibit, index) => {
    const button = document.createElement("button");
    button.className = "map-mode-button";
    button.type = "button";
    button.textContent = exhibit.number;
    button.dataset.liveExhibit = exhibit.id;
    button.dataset.mapPreviewSurface = "map";
    button.setAttribute("aria-label", `${exhibit.number} ${exhibit.shortTitle}のライブ観測演出へ切り替える`);
    button.setAttribute("aria-describedby", "map-mode-preview");
    button.setAttribute("aria-current", "false");
    button.addEventListener("click", () => select(index));
    list.append(button);
    return button;
  });

  document.querySelector(".map-mode-bank").addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest(".map-mode-button[data-map-standard-index]") : null;
    if (!(button instanceof HTMLButtonElement) || activeIndex < 0) return;
    const standards = globalThis.GaiaMapCategories.standardButtons();
    const index = standards.indexOf(button);
    const mode = globalThis.GaiaAppContent?.modes?.[index];
    deactivate({ number: button.textContent.trim(), title: mode?.titleJa || button.getAttribute("aria-label") || "展示" });
  }, { capture: true });

  addEventListener("gaia:live-update", () => {
    renderReadout();
    if (activeIndex >= 0 && !frame) draw();
  });
  addEventListener("gaia:live-prefecture-field", () => { renderReadout(); draw(); });
  addEventListener("gaia:live-city-change", (event) => {
    if (findObservationCity(event.detail?.city)) selectedCityId = event.detail.city;
    if (cityPicker) cityPicker.dataset.state = event.detail?.state || "ready";
    if (activeIndex >= 0) {
      renderReadout();
      draw(performance.now(), true);
    }
  });
  addEventListener("gaia:japan-mode-change", () => {
    if (activeIndex < 0) return;
    savedHeading = {
      number: document.querySelector("#japan-mode-number")?.textContent || savedHeading?.number,
      title: document.querySelector("#japan-mode-title")?.textContent || savedHeading?.title,
    };
    queueMicrotask(applyHeading);
  });
  addEventListener("gaia:lodchange", () => { if (activeIndex >= 0) draw(performance.now(), true); });
  addEventListener("resize", () => {
    if (activeIndex >= 0) draw(performance.now(), true);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearPoiAutoplayTimer();
      if (layer && activeIndex >= 0) layer.dataset.livePoiAutoplay = "paused";
      return;
    }
    if (activeIndex >= 0) {
      draw(performance.now(), true);
      schedulePoiAutoplay();
    }
  });
  addEventListener("gaia:map-playback-resume", () => { if (activeIndex >= 0) setPoiAutoplayEnabled(true); });
};

if (globalThis.GaiaMapObservationAdapter) mount();
else addEventListener("gaia:map-adapter-ready", mount, { once: true });

globalThis.GaiaLiveExhibits = Object.freeze({
  mount,
  select,
  deactivate,
  redraw: () => draw(performance.now(), true),
  reflowObservationLabel: () => prefectureMap?.reflow(),
  selectObservationPoint: (cityId) => selectObservationCity(cityId, { source: "manual" }),
  pausePoiAutoplay: () => setPoiAutoplayEnabled(false),
  resumePoiAutoplay: () => setPoiAutoplayEnabled(true),
  setPlayback,
  getPlaybackState: () => {
    const periods = activeIndex >= 0 ? globalThis.GaiaLiveData?.getPeriods?.(EXHIBITS[activeIndex].key) || [] : [];
    return { ready: activeIndex >= 0 && currentState().requestState !== 'loading', supported: periods.length > 1,
      playing: activeIndex >= 0 && (hourlyPlayback || poiAutoplayEnabled), detail: '選択地域を保ったまま、1時間ごとの保存モデル値を順に表示します。',
      reason: periods.length > 1 ? '' : '時間別データがないため、この展示は再生できません。' };
  },
  observationPoints: OBSERVATION_CITIES,
  definitions: EXHIBITS,
});

export { mount };
