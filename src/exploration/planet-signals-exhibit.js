import { animateMetricText } from '../shared/animated-metric.js';
import { formatJapaneseNumber } from "../shared/number-format.js";
import { formatCoordinatesJa } from "../shared/coordinates.js";
import { pickProjectedPoi } from "./poi-hit-test.js?v=gaia-japan-center-1";
import { earthBaseScale, earthLongitudeToMapX as mapLongitude } from "./world-projection.js?v=gaia-japan-center-1";
import { decorateMapActions } from "./map-exhibit-actions.js?v=gaia-map-polish-1";
import { createAtmosphereRenderer } from "./atmosphere-webgl.js?v=wind-strength-color-20260913";
import { createPoiArrival, drawPoiArrivals } from "./poi-arrival.js?v=gaia-luminous-veil-1";
import { createMetricLegend, updateMetricLegend } from "./metric-legend.js?v=gaia-observation-mincho-1-i18n-20260913";
import { createRealtimeStatus, updateRealtimeStatus, sourceStateJa } from "./realtime-exhibit-status.js?v=gaia-map-polish-1-live-red-1-footer-credit-1";

const GLOBAL_SAMPLE_COUNT = 240;
const formatCoordinates = (point, digits = 1, separator = " ") =>
  formatCoordinatesJa(point.lat, point.lon, digits, separator);
const GLOBAL_OBSERVATION_POINTS = Object.freeze(Array.from({ length: GLOBAL_SAMPLE_COUNT }, (_, index) => {
  const latitudeRadians = Math.asin(-1 + (2 * (index + 0.5)) / GLOBAL_SAMPLE_COUNT);
  const lat = latitudeRadians * 180 / Math.PI;
  const lon = ((index * 137.50776405003785 + 180) % 360) - 180;
  return Object.freeze({ label: formatCoordinates({ lat, lon }), lat, lon });
}));

const DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "global-wind-pressure",
    number: "01",
    shortTitle: "風がつなぐ世界",
    title: "風がつなぐ世界 — WIND / PRESSURE",
    signalLabel: "風速・風向・気圧",
    accent: "#63f3ff",
    rgb: "99, 243, 255",
    caption: "Open-Meteoの風速・風向・気圧のモデル値を、全球の代表地点で比較します。光の筋は風を表す演出で、空気や水蒸気の実際の移動経路ではありません。",
    sourceName: "Open-Meteo Forecast API / DWD・ECMWFほか",
    sourcePage: "https://open-meteo.com/en/docs",
    sourceLabel: "Open-Meteoの仕様を見る",
    primaryLabel: "平均風速",
    visualLabel: "WIND FIELD / 風向と速さ",
    loader: "atmosphere",
    renderer: "wind",
  }),
  Object.freeze({
    id: "global-aerosol-light",
    number: "03",
    shortTitle: "見えない空気の行方",
    title: "見えない空気の行方 — AEROSOL LIGHT",
    signalLabel: "PM2.5・光学的厚さ",
    accent: "#f3a3ff",
    rgb: "243, 163, 255",
    caption: "Open-Meteo経由のCAMSモデルによるPM2.5とエアロゾル光学的厚さを表示します。地点間を補間した霞で、汚染源、個人の曝露量、健康被害は分かりません。",
    sourceName: "Open-Meteo Air Quality API / CAMS",
    sourcePage: "https://open-meteo.com/en/docs/air-quality-api",
    sourceLabel: "Air Quality APIの仕様を見る",
    primaryLabel: "平均 PM2.5",
    visualLabel: "ATMOSPHERIC HAZE / PM2.5・AOD",
    loader: "air",
    renderer: "air",
  }),
  Object.freeze({
    id: "usgs-earthquake-ripples",
    number: "02",
    shortTitle: "揺れる星に暮らす",
    title: "揺れる星に暮らす — EARTHQUAKES",
    signalLabel: "全規模・直近24時間",
    accent: "#ffbd68",
    rgb: "255, 189, 104",
    caption: "USGSが公開する直近24時間の地震を、発生時刻とマグニチュードでたどります。波紋は演出であり、実際の震度、被害範囲、次の地震の予測ではありません。",
    sourceName: "USGS Earthquake Hazards Program",
    sourcePage: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
    sourceLabel: "USGS GeoJSON Feedを見る",
    primaryLabel: "最大マグニチュード",
    visualLabel: "EPICENTER RIPPLES / TIME + MAGNITUDE",
    loader: "earthquake",
    renderer: "quake",
  }),
  Object.freeze({
    id: "global-cloud-radiance",
    number: "05",
    shortTitle: "雲と光の分け前",
    title: "雲と光の分け前 — CLOUD / RADIATION",
    signalLabel: "雲量・短波放射",
    accent: "#ffd879",
    rgb: "255, 216, 121",
    caption: "Open-Meteoの雲量・短波放射のモデル値で、地上に届く光の違いを見ます。雲の形にはNASAの参考画像を使い、現在の衛星画像や地点ごとの発電量は示しません。",
    sourceName: "Open-Meteo Forecast API / DWD・ECMWFほか",
    sourcePage: "https://open-meteo.com/en/docs",
    sourceLabel: "Open-Meteoの仕様を見る",
    primaryLabel: "平均日射",
    visualLabel: "CLOUD LAYER / 雲量と日射",
    loader: "atmosphere",
    renderer: "cloud",
  }),
]);

const OPEN_METEO_WEATHER = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const USGS_DAY = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const CACHE_PREFIX = "gaia-planet-signals-v3:";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_CANVAS_PIXELS = 1_500_000;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fract = (value) => value - Math.floor(value);
const hash = (value) => fract(Math.sin(value * 12.9898 + 78.233) * 43758.5453);

const FALLBACKS = Object.freeze({
  atmosphere: Object.freeze({
    observedAt: "2026-09-03T09:00:00Z",
    points: GLOBAL_OBSERVATION_POINTS.map((point, index) => ({
      ...point,
      windSpeed: 2.4 + hash(index * 1.73 + 4.1) * 7.6,
      windDirection: Math.round(hash(index * 2.17 + 8.3) * 359),
      pressure: 997 + Math.round(hash(index * 3.11 + 2.7) * 22),
      cloud: Math.round(12 + hash(index * 4.37 + 6.2) * 82),
      radiation: Math.round(70 + hash(index * 5.23 + 9.8) * 720),
    })),
  }),
  air: Object.freeze({
    observedAt: "2026-09-03T09:00:00Z",
    points: GLOBAL_OBSERVATION_POINTS.map((point, index) => ({
      ...point,
      pm25: 3.5 + hash(index * 2.83 + 1.9) * 24,
      aerosol: 0.04 + hash(index * 3.71 + 7.4) * 0.24,
    })),
  }),
  earthquake: Object.freeze({
    observedAt: "2026-09-03T09:00:00Z",
    points: [
      [143.2, 39.1, 4.7, 28, "三陸沖"], [-176.4, -22.1, 5.3, 71, "トンガ南方"],
      [-71.7, -30.2, 4.4, 42, "チリ中部"], [126.9, 1.6, 4.9, 54, "モルッカ海"],
      [-149.8, 61.3, 3.1, 36, "アラスカ南部"], [96.1, 3.2, 4.6, 67, "スマトラ北部"],
    ].map(([lon, lat, magnitude, depth, label], index) => ({
      id: `fallback-${index}`,
      lon,
      lat,
      magnitude,
      depth,
      label,
      time: Date.parse("2026-09-03T09:00:00Z") - index * 73 * 60 * 1000,
    })),
  }),
});

let layer;
let map;
let canvas;
let context;
let atmosphereCanvas;
let atmosphereRenderer;
let initializeAtmosphere;
let readout;
let legend;
let metricLegend;
let realtimeStatus;
let buttons = [];
let activeIndex = -1;
let selectionRevision = 0;
let currentData = null;
let frame = 0;
let lastRenderedAt = 0;
let savedHeading = null;
let anchorFocusKey = "";
let anchorFocusChangedAt = 0;
let poiArrival = null;
let poiRenderedAt = 0;
let focusedEpicenterIndex = -1;
const poiOpacity = index => index === focusedEpicenterIndex ? 1 : poiArrival?.opacity(index, poiRenderedAt) ?? 1;

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const clamp01 = (value) => clamp(value, 0, 1);
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const asFinite = (value, fallback = 0) => value !== null && value !== undefined && value !== ""
  && Number.isFinite(Number(value)) ? Number(value) : fallback;
const formatNumber = (value, decimals = 1) => formatJapaneseNumber(Number(value), decimals, decimals);
const formatJst = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "時刻不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(date) + " JST";
};

const formatAge = (value) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "更新間隔不明";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 2) return "データ時点から1分以内";
  if (minutes < 60) return `データ時点から${minutes}分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `データ時点から${hours}時間`;
  return `データ時点から${Math.floor(hours / 24)}日`;
};

const coordinateParams = (points) => ({
  latitude: points.map(({ lat }) => lat).join(","),
  longitude: points.map(({ lon }) => lon).join(","),
});

const apiUrl = (base, params) => {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
};

const fetchJson = async (url, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeMulti = (payload) => Array.isArray(payload) ? payload : [payload];
const fetchPointRows = async (base, points, params) => {
  const batchSize = 48;
  const batches = [];
  for (let index = 0; index < points.length; index += batchSize) {
    batches.push(points.slice(index, index + batchSize));
  }
  const payloads = await Promise.all(batches.map((batch) => fetchJson(apiUrl(base, {
    ...coordinateParams(batch),
    ...params,
  }))));
  const rows = payloads.flatMap(normalizeMulti);
  if (rows.length !== points.length) throw new Error(`Expected ${points.length} grid points, received ${rows.length}`);
  return rows;
};

const loadAtmosphere = async () => {
  const rows = await fetchPointRows(OPEN_METEO_WEATHER, GLOBAL_OBSERVATION_POINTS, {
    current: "wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover,shortwave_radiation",
    wind_speed_unit: "ms",
    timezone: "GMT",
    cell_selection: "nearest",
  });
  const points = GLOBAL_OBSERVATION_POINTS.map((point, index) => {
    const current = rows[index]?.current || {};
    return {
      ...point,
      windSpeed: asFinite(current.wind_speed_10m, NaN),
      windDirection: asFinite(current.wind_direction_10m, NaN),
      pressure: asFinite(current.surface_pressure, NaN),
      cloud: asFinite(current.cloud_cover, NaN),
      radiation: asFinite(current.shortwave_radiation, NaN),
    };
  }).filter(p => [p.windSpeed, p.windDirection, p.pressure, p.cloud, p.radiation].every(Number.isFinite));
  if (!points.length) throw new Error("Open-Meteo atmosphere values are unavailable");
  return { observedAt: rows.find(({ current }) => current?.time)?.current.time + "Z", points };
};

const loadAir = async () => {
  const rows = await fetchPointRows(OPEN_METEO_AIR, GLOBAL_OBSERVATION_POINTS, {
    current: "pm2_5,aerosol_optical_depth",
    timezone: "GMT",
    domains: "cams_global",
    cell_selection: "nearest",
  });
  const points = GLOBAL_OBSERVATION_POINTS.map((point, index) => {
    const current = rows[index]?.current || {};
    return {
      ...point,
      pm25: asFinite(current.pm2_5, NaN),
      aerosol: asFinite(current.aerosol_optical_depth, NaN),
    };
  }).filter(p => [p.pm25, p.aerosol].every(Number.isFinite));
  if (!points.length) throw new Error("Open-Meteo air-quality values are unavailable");
  return { observedAt: rows.find(({ current }) => current?.time)?.current.time + "Z", points };
};

const loadEarthquake = async () => {
  const payload = await fetchJson(USGS_DAY);
  const points = (payload.features || []).map((feature) => ({
    id: String(feature.id || ""),
    lon: asFinite(feature.geometry?.coordinates?.[0]),
    lat: asFinite(feature.geometry?.coordinates?.[1]),
    depth: Math.max(0, asFinite(feature.geometry?.coordinates?.[2])),
    magnitude: Math.max(0, asFinite(feature.properties?.mag)),
    label: String(feature.properties?.place || "震源地不明"),
    time: asFinite(feature.properties?.time),
  })).filter(({ id, lon, lat, time }) => id && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90 && time > 0)
    .sort((left, right) => left.time - right.time)
    .slice(-1_000);
  if (!points.length) throw new Error("USGS earthquake feed contains no events");
  return { observedAt: new Date(asFinite(payload.metadata?.generated, Date.now())).toISOString(), points };
};

const LOADERS = Object.freeze({
  atmosphere: loadAtmosphere,
  air: loadAir,
  earthquake: loadEarthquake,
});

const updateRealtimeIdentity = (definition, data) => updateRealtimeStatus(realtimeStatus, {
  sourceState: data?.sourceState || "FETCHING",
  observedAt: data?.observedAt,
  source: definition.loader === "earthquake" ? "USGS · 直近24時間の地震" : definition.loader === "air" ? "Open-Meteo / CAMS" : "Open-Meteo / DWD・ECMWFほか",
  sourceUrl: definition.sourcePage,
  kind: definition.loader === "earthquake" ? "地震観測" : definition.loader === "air" ? "大気質モデル" : "気象モデル",
  timeLabel: definition.loader === "earthquake" ? "配信時刻" : "データ時刻",
});

const readCache = (key) => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(`${CACHE_PREFIX}${key}`) || "null");
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.data;
  } catch {}
  return null;
};

const writeCache = (key, data) => {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {}
};

const loadData = async (definition) => {
  const cached = readCache(definition.loader);
  if (cached) return { ...cached, sourceState: "LIVE CACHE" };
  try {
    const data = await LOADERS[definition.loader]();
    writeCache(definition.loader, data);
    return { ...data, sourceState: "LIVE" };
  } catch (error) {
    console.warn(`${definition.sourceName} unavailable; using the saved exhibit values.`, error);
    return { ...FALLBACKS[definition.loader], sourceState: "SAVED VALUES" };
  }
};

const strongestEarthquake = data => data?.points?.reduce((best, point) => !best || point.magnitude > best.magnitude ? point : best, null);

const focusStrongestEarthquake = () => {
  if (activeIndex < 0 || DEFINITIONS[activeIndex].renderer !== "quake" || readout.dataset.loading === "true") return;
  const point = strongestEarthquake(currentData);
  if (!point) return;
  focusedEpicenterIndex = currentData.points.indexOf(point);
  // An explicit selection must be visible even during the staggered arrival.
  canvas.dataset.planetFocusedEpicenter = point.id;
  globalThis.GaiaMapObservationAdapter?.closePoi?.();
  const rect = map.getBoundingClientRect();
  const baseScale = earthBaseScale(rect);
  const mapX = mapLongitude(point.lon), mapY = 90 - point.lat;
  const requiredScale = Math.max(rect.width * .5 / Math.max(1, mapX), rect.width * .5 / Math.max(1, 360 - mapX),
    rect.height * .4 / Math.max(1, mapY), rect.height * .6 / Math.max(1, 180 - mapY));
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({
    lon: point.lon, lat: point.lat,
    zoom: clamp(Math.max(3, requiredScale / baseScale + .04), 1, 8),
    targetX: .5, targetY: .4, durationMs: reducedMotion ? 0 : 750,
    label: `planet-epicenter:${point.id}`,
  });
};

const summarize = (definition, data) => {
  if (definition.renderer === "cloud") {
    return {
      primary: formatNumber(average(data.points.map(({ radiation }) => radiation)), 0),
      unit: "W/m²",
      secondary: [
        ["平均雲量", `${formatNumber(average(data.points.map(({ cloud }) => cloud)), 0)}%`],
        ["最大日射", `${formatNumber(Math.max(...data.points.map(({ radiation }) => radiation)), 0)} W/m²`],
      ],
      count: `${data.points.length}格子点`,
    };
  }
  if (definition.loader === "atmosphere") {
    return {
      primary: formatNumber(average(data.points.map(({ windSpeed }) => windSpeed))),
      unit: "m/s",
      secondary: [
        ["平均気圧", `${formatNumber(average(data.points.map(({ pressure }) => pressure)), 0)} hPa`],
        ["平均雲量", `${formatNumber(average(data.points.map(({ cloud }) => cloud)), 0)}%`],
      ],
      count: `${data.points.length}格子点`,
    };
  }
  if (definition.loader === "air") {
    return {
      primary: formatNumber(average(data.points.map(({ pm25 }) => pm25))),
      unit: "µg/m³",
      secondary: [
        ["平均AOD", formatNumber(average(data.points.map(({ aerosol }) => aerosol)), 2)],
        ["最大PM2.5", `${formatNumber(Math.max(...data.points.map(({ pm25 }) => pm25)))} µg/m³`],
      ],
      count: `${data.points.length}格子点`,
    };
  }
  if (definition.loader === "earthquake") {
    const strongest = strongestEarthquake(data);
    return {
      primary: formatNumber(strongest.magnitude),
      unit: "M",
      secondary: [
        ["検知数", `${data.points.length}回`],
        ["最大震源", strongest.label],
      ],
      count: `${data.points.length}地震`,
    };
  }
  throw new Error(`Unknown planet signal: ${definition.id}`);
};

const projection = () => {
  const rect = map?.getBoundingClientRect();
  const overlay = document.querySelector("#japan-overlay");
  if (!rect?.width || !rect?.height || !(overlay instanceof HTMLElement)) return null;
  const zoom = Math.max(1, Number(overlay.dataset.earthZoom) || 1);
  const scale = earthBaseScale(rect) * zoom;
  return {
    rect,
    scale,
    originX: (rect.width - 360 * scale) / 2 + (Number(overlay.dataset.earthOffsetX) || 0),
    originY: (rect.height - 180 * scale) / 2 + (Number(overlay.dataset.earthOffsetY) || 0),
  };
};

const screenPoint = (point, view) => ({
  x: view.originX + mapLongitude(point.lon) * view.scale,
  y: view.originY + (90 - point.lat) * view.scale,
});

const findPoiAt = (clientX, clientY, pointerType) => {
  if (activeIndex < 0 || !currentData || !context) return null;
  const hit = pickProjectedPoi(currentData.points, projection(), clientX, clientY, pointerType, (_, index) => poiOpacity(index) > .02);
  if (!hit) return null;
  const { point, index } = hit;
  return poiForPoint(point, index);
};
const poiForPoint = (point, index) => {
  const definition = DEFINITIONS[activeIndex];
  const metrics = definition.renderer === "wind"
    ? [["風速", `${formatNumber(point.windSpeed)} m/s`], ["風向", `${formatNumber(point.windDirection, 0)}°`],
      ["気圧", `${formatNumber(point.pressure)} hPa`], ["雲量", `${formatNumber(point.cloud, 0)}%`]]
    : definition.renderer === "air"
      ? [["PM2.5", `${formatNumber(point.pm25)} µg/m³`], ["光学的厚さ", formatNumber(point.aerosol, 2)]]
      : definition.renderer === "cloud"
        ? [["雲量", `${formatNumber(point.cloud, 0)}%`], ["短波放射", `${formatNumber(point.radiation, 0)} W/m²`]]
        : [["規模", `M${formatNumber(point.magnitude)}`], ["深さ", `${formatNumber(point.depth)} km`]];
  const values = metrics.map(([label, value]) => `${label} ${value}`).join(" / ");
  const coordinates = formatCoordinates(point, 2, " / ");
  // Build display text from coordinates so cached English labels also localize.
  const title = definition.renderer === "quake" ? point.label : formatCoordinates(point);
  const saved = currentData.sourceState === "SAVED VALUES";
  const sourceState = saved ? "演出用サンプル値（ライブ観測ではありません）" : sourceStateJa(currentData.sourceState);
  return {
    type: "exhibit", index,
    record: {
      id: point.id || String(index), exhibitId: definition.id, lon: point.lon, lat: point.lat,
      kicker: `${definition.number} / ${definition.shortTitle}`,
      title,
      preview: values,
      previewReadings: { readings: (definition.renderer === 'wind'
        ? [['風速', point.windSpeed, 'm/s', 1], ['風向', point.windDirection, '°', 0], ['気圧', point.pressure, 'hPa', 1], ['雲量', point.cloud, '%', 0]]
        : definition.renderer === 'air' ? [['PM2.5', point.pm25, 'µg/m³', 1], ['光学的厚さ', point.aerosol, '', 2]]
          : definition.renderer === 'cloud' ? [['雲量', point.cloud, '%', 0], ['短波放射', point.radiation, 'W/m²', 0]]
            : [['規模', point.magnitude, 'M', 1], ['深さ', point.depth, 'km', 1]])
        .map(([label, value, unit, digits]) => ({ label, value: formatNumber(value, digits), unit, prefix: unit === 'M' })) },
      meta: `${title} / ${values} / ${coordinates} / ${formatJst(point.time || currentData.observedAt)} / ${sourceState} / ${definition.sourceName}${definition.loader !== "earthquake" && !saved ? " / モデル値" : ""}`,
      cardDetails: {
        location: definition.renderer === "quake" ? point.label : "",
        coordinates, metrics,
        time: formatJst(point.time || currentData.observedAt),
        state: sourceState,
        source: definition.sourceName,
        model: definition.loader !== "earthquake" && !saved ? "モデル値" : "",
      },
      url: definition.loader === "earthquake" && !saved
        ? `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(point.id)}`
        : definition.sourcePage,
    },
  };
};

const resizeCanvas = (rect) => {
  const density = Math.min(devicePixelRatio || 1, 1.4);
  const targetWidth = rect.width * density;
  const targetHeight = rect.height * density;
  const budgetScale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, targetWidth * targetHeight)));
  const ratio = density * budgetScale;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvas.dataset.planetResolutionScale = ratio.toFixed(3);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

const drawWind = (time, view, data, definition) => {
  const light = getAnchorLight(definition);
  data.points.forEach((point, index) => {
    if (!poiOpacity(index)) return;
    context.save();
    context.globalAlpha = poiOpacity(index);
    const center = screenPoint(point, view);
    const radians = (point.windDirection + 180) * Math.PI / 180;
    const dx = Math.sin(radians);
    const dy = -Math.cos(radians);
    const speed = clamp(point.windSpeed, 0.4, 18);
    // The fallback uses the same detached light language, not line bundles.
    for (let mote = 0; mote < 2; mote += 1) {
      const phase = fract(time * (.035 + speed * .003) + hash(index * 43 + mote * 11));
      const distance = (phase - .5) * (24 + speed * 3);
      const x = center.x + dx * distance, y = center.y + dy * distance;
      const size = 16 + speed;
      context.globalAlpha = poiOpacity(index) * Math.sin(phase * Math.PI) ** 2 * .35;
      context.drawImage(light, x - size / 2, y - size / 2, size, size);
    }
    context.globalAlpha = poiOpacity(index) * .82;
    context.drawImage(light, center.x - 10, center.y - 10, 20, 20);
    context.restore();
  });
};

const drawAir = (time, view, data, definition) => {
  data.points.forEach((point, index) => {
    if (!poiOpacity(index)) return;
    context.save();
    context.globalAlpha = poiOpacity(index);
    const center = screenPoint(point, view);
    const density = clamp01(point.pm25 / 45);
    const haze = clamp01(point.aerosol / 0.6);
    const radius = 7 + density * 18 + haze * 12;
    const breath = reducedMotion ? 0.8 : 0.72 + Math.sin(time * (0.22 + hash(index) * 0.18) + index) * 0.12;
    context.beginPath();
    context.arc(center.x, center.y, radius * breath, 0, Math.PI * 2);
    context.fillStyle = `rgba(${definition.rgb}, ${0.025 + density * 0.055})`;
    context.fill();
    for (let dust = 0; dust < 4; dust += 1) {
      const seed = hash(index * 101 + dust * 7);
      const angle = seed * Math.PI * 2 + time * (0.05 + haze * 0.08);
      const distance = (8 + hash(index * 53 + dust * 13) * radius) * (0.65 + 0.35 * Math.sin(time * 0.3 + seed * 8));
      context.beginPath();
      context.arc(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance * 0.55, 0.5 + density * 1.5, 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 220, 247, ${0.08 + density * 0.34})`;
      context.fill();
    }
    context.beginPath();
    context.arc(center.x, center.y, 1.3 + density * 2.2, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 232, 250, ${0.36 + haze * 0.5})`;
    context.fill();
    context.restore();
  });
};

const drawQuakes = (time, view, data, definition) => {
  const now = Date.now();
  const ringCount = data.points.length > 240 ? 1 : data.points.length > 100 ? 2 : 3;
  data.points.forEach((point, index) => {
    if (!poiOpacity(index)) return;
    context.save();
    context.globalAlpha = poiOpacity(index);
    const center = screenPoint(point, view);
    const magnitude = clamp(point.magnitude, 2.5, 8);
    const age = clamp01((now - point.time) / 86_400_000);
    for (let ring = 0; ring < ringCount; ring += 1) {
      const phase = reducedMotion ? 0.72 : fract(time * (0.06 + magnitude * 0.01) + ring / ringCount + hash(index * 23));
      const radius = (3 + phase * (13 + magnitude * 7)) * Math.min(1.35, view.scale / 4);
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${definition.rgb}, ${(1 - phase) * (0.1 + magnitude * 0.06) * (1 - age * 0.45)})`;
      context.lineWidth = 0.55 + magnitude * 0.13;
      context.stroke();
    }
    context.beginPath();
    context.arc(center.x, center.y, 1.2 + magnitude * 0.45, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 241, 202, ${0.38 + magnitude * 0.055})`;
    context.fill();
    if (index === focusedEpicenterIndex) {
      context.beginPath();
      context.arc(center.x, center.y, 12, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${definition.rgb}, .95)`;
      context.lineWidth = 1.5;
      context.stroke();
    }
    context.restore();
  });
};

const drawCloud = (time, view, data, definition) => {
  data.points.forEach((point, index) => {
    if (!poiOpacity(index)) return;
    context.save();
    context.globalAlpha = poiOpacity(index);
    const center = screenPoint(point, view);
    const cloud = clamp01(point.cloud / 100);
    const radiance = clamp01(point.radiation / 900);
    const openness = 1 - cloud * 0.72;
    const twinkle = reducedMotion ? 0.78 : 0.58 + Math.sin(time * (0.55 + hash(index + 12) * 0.8) + index * 0.7) * 0.24;
    const radius = 3 + radiance * 8 + openness * 4;
    context.beginPath();
    context.arc(center.x, center.y, radius * (0.82 + twinkle * 0.18), 0, Math.PI * 2);
    context.fillStyle = `rgba(${definition.rgb}, ${0.035 + radiance * openness * 0.12})`;
    context.fill();
    context.beginPath();
    context.arc(center.x, center.y, 1.2 + radiance * 2.4, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 249, 214, ${0.3 + radiance * openness * twinkle * 0.65})`;
    context.fill();
    const ray = 3 + radiance * 8;
    context.beginPath();
    context.moveTo(center.x - ray, center.y);
    context.lineTo(center.x + ray, center.y);
    context.moveTo(center.x, center.y - ray * 0.7);
    context.lineTo(center.x, center.y + ray * 0.7);
    context.strokeStyle = `rgba(255, 231, 154, ${0.08 + openness * radiance * 0.32})`;
    context.lineWidth = 0.55 + radiance * 0.7;
    context.stroke();
    context.restore();
  });
};

const RENDERERS = Object.freeze({ wind: drawWind, air: drawAir, quake: drawQuakes, cloud: drawCloud });

// Reuse one small light texture per palette. No outlines, dark centres, or
// per-frame blur: opacity falls continuously from a pearl core into the map.
const anchorLights = new Map();
const getAnchorLight = (definition) => {
  if (anchorLights.has(definition.id)) return anchorLights.get(definition.id);
  const light = document.createElement("canvas");
  light.width = light.height = 96;
  const brush = light.getContext("2d");
  const pearl = definition.rgb.split(",").map(value => Math.round(Number(value) * .35 + 255 * .65)).join(", ");
  const gradient = brush.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, "rgba(255, 255, 248, .96)");
  gradient.addColorStop(.07, `rgba(${pearl}, .86)`);
  gradient.addColorStop(.17, `rgba(${pearl}, .55)`);
  gradient.addColorStop(.34, `rgba(${definition.rgb}, .18)`);
  gradient.addColorStop(.6, `rgba(${definition.rgb}, .045)`);
  gradient.addColorStop(1, `rgba(${definition.rgb}, 0)`);
  brush.fillStyle = gradient;
  brush.fillRect(0, 0, 96, 96);
  anchorLights.set(definition.id, light);
  return light;
};

const drawDataAnchors = (view, data, definition, timestamp) => {
  const size = view.rect.width >= 2400 ? 1.6 : 1;
  const radius = 10 * size;
  const light = getAnchorLight(definition);
  const centers = data.points.map((point, index) => ({ ...screenPoint(point, view), alpha: poiOpacity(index) }))
    .filter(p => p.alpha > 0 && p.x >= 0 && p.y >= 0 && p.x <= view.rect.width && p.y <= view.rect.height);
  context.save();
  centers.forEach(p => {
    context.globalAlpha = .82 * p.alpha;
    context.drawImage(light, p.x - radius, p.y - radius, radius * 2, radius * 2);
  });
  context.restore();
  canvas.dataset.planetAnchorStyle = "soft-pearl-light";
  canvas.dataset.planetAnchorCount = String(centers.length);
  canvas.dataset.planetAnchorRadius = radius.toFixed(2);
  canvas.dataset.planetAnchorOuterRadius = radius.toFixed(2);

  // Use the map's actual hover/selection, not another competing hit-test.
  const interaction = globalThis.GaiaMapObservationAdapter?.getPoiInteraction?.();
  const selected = interaction?.selected?.exhibitId === definition.id ? interaction.selected : null;
  const hovered = interaction?.hovered?.exhibitId === definition.id ? interaction.hovered : null;
  const focused = selected || hovered;
  const state = selected ? "selected" : hovered ? "hovered" : "none";
  const key = focused ? `${definition.id}:${state}:${focused.index}` : "";
  if (key !== anchorFocusKey) { anchorFocusKey = key; anchorFocusChangedAt = timestamp; }
  canvas.dataset.planetPoiFocusState = state;
  canvas.dataset.planetFocusedPoiIndex = String(focused?.index ?? -1);
  canvas.dataset.planetPoiConnector = "false";
  canvas.dataset.planetPoiFocusRadius = "0";
  const record = focused && data.points[focused.index];
  if (!record) return;
  const p = screenPoint(record, view);
  if (p.x < 0 || p.y < 0 || p.x > view.rect.width || p.y > view.rect.height) return;
  const progress = reducedMotion ? 1 : 1 - (1 - clamp01((timestamp - anchorFocusChangedAt) / 160)) ** 3;
  const focusRadius = (selected ? 19 : 16) * size * (.85 + .15 * progress);
  canvas.dataset.planetPoiFocusRadius = focusRadius.toFixed(2);
  context.save();
  context.globalAlpha = .4 + .6 * progress;
  context.lineCap = "round";

  const panel = document.querySelector(selected ? "#japan-poi-card" : ".japan-poi-preview");
  if (panel && !panel.hidden && panel.getAttribute("aria-hidden") !== "true") {
    const bounds = panel.getBoundingClientRect();
    const end = { x: clamp(p.x, bounds.left - view.rect.left, bounds.right - view.rect.left),
      y: clamp(p.y, bounds.top - view.rect.top, bounds.bottom - view.rect.top) };
    const distance = Math.hypot(end.x - p.x, end.y - p.y);
    if (distance > focusRadius) {
      const start = focusRadius * .65 / distance;
      context.beginPath();
      context.moveTo(p.x + (end.x - p.x) * start, p.y + (end.y - p.y) * start);
      context.lineTo(end.x, end.y);
      context.strokeStyle = `rgba(${definition.rgb}, .45)`;
      context.lineWidth = .8 * size;
      context.stroke();
      canvas.dataset.planetPoiConnector = "true";
    }
  }

  context.drawImage(light, p.x - focusRadius, p.y - focusRadius, focusRadius * 2, focusRadius * 2);
  context.restore();
};

const draw = (timestamp = performance.now()) => {
  if (activeIndex < 0 || document.hidden || layer?.getAttribute("aria-hidden") === "true" || !currentData || !context) {
    frame = 0;
    return;
  }
  const interval = reducedMotion ? 1000 / 15 : FRAME_INTERVAL_MS;
  if (timestamp + 0.5 < lastRenderedAt + interval) {
    frame = requestAnimationFrame(draw);
    return;
  }
  // Accumulate a deadline instead of rounding 33.3ms up to three vsyncs.
  lastRenderedAt += Math.max(1, Math.floor((timestamp - lastRenderedAt) / interval)) * interval;
  const view = projection();
  if (!view) {
    frame = requestAnimationFrame(draw);
    return;
  }
  resizeCanvas(view.rect);
  poiRenderedAt = timestamp;
  context.clearRect(0, 0, view.rect.width, view.rect.height);
  context.globalCompositeOperation = "lighter";
  const definition = DEFINITIONS[activeIndex];
  const volumetric = definition.renderer !== "quake" && atmosphereRenderer
    && atmosphereCanvas.dataset.fieldState !== "unavailable"
    && atmosphereRenderer.render(timestamp, view, reducedMotion);
  atmosphereCanvas.hidden = !volumetric;
  if (volumetric) {
    context.globalCompositeOperation = "source-over";
    drawDataAnchors(view, currentData, definition, timestamp);
  } else RENDERERS[definition.renderer](reducedMotion ? 0 : timestamp / 1000, view, currentData, definition);
  const arrival = drawPoiArrivals(context, poiArrival, { now: timestamp, view, project: screenPoint,
    kind: definition.renderer, rgb: definition.rgb, sprite: getAnchorLight(definition) });
  canvas.dataset.planetArrivalPhase = poiArrival?.phase(timestamp) || "idle";
  canvas.dataset.planetArrivalEffect = definition.renderer;
  canvas.dataset.planetArrivalStyle = definition.renderer === "quake" ? "seismic-ripples" : "scattered-light-bloom";
  canvas.dataset.planetArrivalActive = String(arrival.count);
  canvas.dataset.planetArrivalLimit = String(arrival.limit);
  canvas.dataset.planetArrivalIndices = arrival.indices.join(",");
  canvas.dataset.planetArrivalVisible = String(currentData.points.reduce((total, _, index) => total + (poiOpacity(index) > .02 ? 1 : 0), 0));
  canvas.dataset.planetEngine = volumetric ? "webgl2-continuous-atmosphere" : "canvas2d-particle-field";
  context.globalCompositeOperation = "source-over";
  canvas.dataset.planetFrame = String((Number(canvas.dataset.planetFrame) || 0) + 1);
  frame = requestAnimationFrame(draw);
};

const pauseDrawing = () => {
  cancelAnimationFrame(frame);
  frame = 0;
  atmosphereRenderer?.suspend();
};

const resumeDrawing = () => {
  if (activeIndex < 0 || !currentData || document.hidden || layer?.getAttribute("aria-hidden") === "true") return;
  const kind = DEFINITIONS[activeIndex].renderer;
  if (kind !== "quake") {
    if (!atmosphereRenderer) initializeAtmosphere();
    atmosphereRenderer?.setData(kind, currentData);
  }
  cancelAnimationFrame(frame);
  lastRenderedAt = 0;
  frame = requestAnimationFrame(draw);
};

const applyHeading = (definition) => {
  readout.querySelector("[data-planet-number]").textContent = definition.number;
  readout.querySelector("[data-planet-title]").textContent = definition.shortTitle;
  const number = document.querySelector("#japan-mode-number");
  const bankTitle = document.querySelector("#japan-mode-title");
  const mapTitle = document.querySelector("#japan-title");
  if (number) number.textContent = definition.number;
  if (bankTitle) bankTitle.textContent = definition.shortTitle;
  if (mapTitle) {
    mapTitle.dataset.exhibitNumber = definition.number;
    mapTitle.textContent = definition.shortTitle;
    mapTitle.setAttribute("aria-label", `${definition.number} ${definition.shortTitle}`);
  }
};

const updatePlanetLegend = (definition, data = null) => {
  const metric = {
    wind: { key: "windSpeed", title: "風速", unit: "m/s", decimals: 1 },
    air: { key: "pm25", title: "PM2.5", unit: "µg/m³", decimals: 1 },
    quake: { key: "magnitude", title: "マグニチュード", unit: "M", decimals: 1 },
    cloud: { key: "cloud", title: "雲量", unit: "%", decimals: 1 },
  }[definition.renderer];
  const values = (data?.points || []).map(point => point[metric.key]).filter(Number.isFinite);
  const isQuake = definition.renderer === "quake";
  const sample = data?.sourceState === "SAVED VALUES";
  const value = values.length ? isQuake ? Math.max(...values) : average(values) : null;
  const minimum = definition.renderer === "cloud" ? 0 : values.length ? Math.min(...values) : null;
  const maximum = definition.renderer === "cloud" ? 100 : values.length ? Math.max(...values) : null;
  const formatted = number => !Number.isFinite(number) ? "—" : isQuake ? `M${formatNumber(number, 1)}` : `${formatNumber(number, metric.decimals)} ${metric.unit}`;
  const stamp = data ? formatJst(data.observedAt) : "";
  updateMetricLegend(metricLegend, {
    title: metric.title,
    scope: !data ? "読込中" : sample ? "演出用サンプル" : isQuake ? "直近24時間の最大" : `${values.length}格子平均`,
    period: stamp.replace(/^\d{4}\//u, ""),
    current: formatted(value), value, minimum, maximum,
    minimumLabel: definition.renderer === "cloud" ? "0%" : formatted(minimum),
    maximumLabel: definition.renderer === "cloud" ? "100%" : formatted(maximum),
    gradient: `linear-gradient(90deg, rgba(${definition.rgb}, .04), rgba(${definition.rgb}, .44), rgb(${definition.rgb}))`,
    description: !data ? "データを読み込んでいます" : `${stamp}。${isQuake ? "公開された地震の規模" : "取得できた格子のモデル値の単純平均（全球の面積加重平均ではありません）"}。${sample ? "参考用に生成した値であり、ライブ観測ではありません。" : ""}`,
  });
  legend.querySelector("[data-planet-detail-summary]").textContent = sample ? "参考値の凡例・詳細" : "凡例・データの詳細";
  const notice = legend.querySelector("[data-planet-reference-notice]");
  notice.hidden = definition.renderer !== "cloud";
  notice.textContent = "雲の形は過去の参考画像";
  legend.querySelector("[data-planet-scope-note]").textContent = sample
    ? "参考用に生成した値です。ライブ観測・現在値ではありません。"
    : isQuake ? "USGSが公開する直近24時間の地震。針は最大規模。"
      : "取得できた格子のモデル値の単純平均です。全球の面積加重平均ではありません。";
};

const renderReadout = (definition, data) => {
  const summary = summarize(definition, data);
  updateRealtimeIdentity(definition, data);
  readout.style.setProperty("--planet-accent", definition.accent);
  readout.style.setProperty("--planet-rgb", definition.rgb);
  legend.style.setProperty("--planet-accent", definition.accent);
  legend.style.setProperty("--planet-rgb", definition.rgb);
  readout.querySelector("[data-planet-kicker]").textContent = `${definition.number} / ${definition.signalLabel}`;
  readout.querySelector("[data-planet-primary-label]").textContent = definition.primaryLabel;
  animateMetricText(readout.querySelector("[data-planet-primary]"), summary.primary, definition.id);
  readout.querySelector("[data-planet-unit]").textContent = summary.unit;
  readout.querySelector("[data-planet-secondary-a-label]").textContent = summary.secondary[0][0];
  readout.querySelector("[data-planet-secondary-a]").textContent = summary.secondary[0][1];
  readout.querySelector("[data-planet-secondary-b-label]").textContent = summary.secondary[1][0];
  readout.querySelector("[data-planet-secondary-b]").textContent = summary.secondary[1][1];
  const epicenter = readout.querySelector("[data-planet-epicenter]");
  if (definition.renderer === "quake") {
    const name = summary.secondary[1][1];
    readout.querySelector("[data-planet-epicenter-name]").textContent = name;
    epicenter.setAttribute("aria-label", `最大震源 ${name}へ移動`);
    epicenter.title = `${name}の震源へ移動`;
    epicenter.disabled = false;
  }
  readout.querySelector("[data-planet-caption]").textContent = definition.caption;
  legend.querySelector("[data-planet-detail-caption]").textContent = definition.caption;
  readout.querySelector("[data-planet-state]").textContent = sourceStateJa(data.sourceState);
  readout.querySelector("[data-planet-time]").textContent = formatJst(data.observedAt);
  updatePlanetLegend(definition, data);
  legend.querySelector("[data-planet-legend-count]").textContent = summary.count;
  legend.querySelector("[data-planet-legend-state]").textContent = sourceStateJa(data.sourceState);
  legend.querySelector("[data-planet-data-time]").textContent = formatJst(data.observedAt);
  legend.querySelector("[data-planet-data-age]").textContent = formatAge(data.observedAt);
  legend.querySelector("[data-planet-time-label]").textContent = definition.renderer === "cloud" ? "数値の時刻" : "DATA TIME";
  canvas.dataset.planetExhibit = definition.id;
  canvas.dataset.planetSourceState = data.sourceState;
  canvas.dataset.planetPointCount = String(data.points.length);
  canvas.dataset.planetEncoding = definition.visualLabel.toLowerCase().replaceAll(" ", "-");
};


const select = async (index) => {
  globalThis.GaiaMarineCod?.deactivate?.();
  globalThis.GaiaFoodExhibits?.deactivate?.();
  const definition = DEFINITIONS[index];
  if (!definition || !layer) return;
  const revision = ++selectionRevision;
  globalThis.GaiaLiveExhibits?.deactivate?.();
  globalThis.GaiaEstatExhibits?.deactivate?.();
  globalThis.GaiaFirmsExhibit?.deactivate?.();
  if (activeIndex < 0) {
    savedHeading = {
      number: document.querySelector("#japan-mode-number")?.textContent || "06",
      title: document.querySelector("#japan-mode-title")?.textContent || "積み重なるCO₂",
    };
  }
  activeIndex = index;
  currentData = null;
  focusedEpicenterIndex = -1;
  delete canvas.dataset.planetFocusedEpicenter;
  poiArrival = null;
  canvas.dataset.planetArrivalPhase = "loading";
  canvas.dataset.planetArrivalActive = "0";
  canvas.dataset.planetArrivalVisible = "0";
  canvas.dataset.planetArrivalIndices = "";
  cancelAnimationFrame(frame);
  anchorFocusKey = "";
  canvas.dataset.planetPoiFocusState = "none";
  canvas.dataset.planetFocusedPoiIndex = "-1";
  canvas.dataset.planetPoiConnector = "false";
  atmosphereCanvas.hidden = true;
  globalThis.GaiaMapObservationAdapter?.closePoi?.();
  if (context) context.clearRect(0, 0, canvas.width, canvas.height);
  layer.classList.add("is-firms-exhibit", "is-planet-signals-exhibit");
  layer.dataset.planetExhibit = definition.id;
  canvas.hidden = false;
  legend.hidden = false;
  readout.hidden = false;
  buttons.forEach((item, buttonIndex) => item.setAttribute("aria-current", String(buttonIndex === index)));
  document.querySelectorAll(".map-mode-button:not([data-planet-exhibit])").forEach((item) => item.setAttribute("aria-current", "false"));
  applyHeading(definition);
  // The explanation belongs to the new exhibit even while its data is loading.
  readout.querySelector("[data-planet-caption]").textContent = definition.caption;
  legend.querySelector("[data-planet-detail-caption]").textContent = definition.caption;
  updateRealtimeIdentity(definition);
  readout.querySelector("[data-planet-state]").textContent = "取得中";
  readout.querySelector("[data-planet-time]").textContent = "—";
  readout.dataset.loading = "true";
  readout.dataset.planetRenderer = definition.renderer;
  const epicenter = readout.querySelector("[data-planet-epicenter]");
  epicenter.hidden = definition.renderer !== "quake";
  epicenter.disabled = true;
  epicenter.removeAttribute("title");
  epicenter.setAttribute("aria-label", "最大震源を読み込み中");
  readout.querySelector("[data-planet-epicenter-name]").textContent = "読み込み中";
  readout.querySelector("[data-planet-secondary-b-item]").hidden = definition.renderer === "quake";
  readout.querySelector("[data-planet-secondary-b-label]").textContent = definition.renderer === "quake" ? "最大震源" : "—";
  readout.querySelector("[data-planet-kicker]").textContent = `${definition.number} / CONNECTING`;
  animateMetricText(readout.querySelector("[data-planet-primary]"), "—", definition.id);
  readout.querySelector("[data-planet-unit]").textContent = "";
  updatePlanetLegend(definition);
  legend.querySelector("details").open = false;
  legend.querySelector("[data-planet-legend-state]").textContent = "取得中";
  legend.querySelector("[data-planet-legend-count]").textContent = "—";
  legend.querySelector("[data-planet-data-time]").textContent = "読込中";
  legend.querySelector("[data-planet-data-age]").textContent = "—";
  legend.querySelector("[data-cloud-image-credit]").hidden = definition.renderer !== "cloud";
  const data = await loadData(definition);
  if (activeIndex !== index || revision !== selectionRevision) return;
  currentData = data;
  poiRenderedAt = performance.now();
  poiArrival = createPoiArrival(data.points, poiRenderedAt, reducedMotion);
  delete readout.dataset.loading;
  renderReadout(definition, data);
  if (definition.renderer === "quake") atmosphereRenderer?.suspend();
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({
    lon: 138,
    lat: 0,
    zoom: 1,
    targetX: 0.5,
    targetY: 0.47,
    durationMs: 900,
    label: definition.id,
  });
  resumeDrawing();
  dispatchEvent(new CustomEvent("gaia:planet-signals-change", { detail: { active: true, id: definition.id, sourceState: data.sourceState } }));
};

const deactivate = () => {
  if (activeIndex < 0) return;
  const previous = DEFINITIONS[activeIndex];
  activeIndex = -1;
  selectionRevision++;
  currentData = null;
  focusedEpicenterIndex = -1;
  delete canvas.dataset.planetFocusedEpicenter;
  poiArrival = null;
  canvas.dataset.planetArrivalPhase = "idle";
  canvas.dataset.planetArrivalActive = "0";
  canvas.dataset.planetArrivalVisible = "0";
  canvas.dataset.planetArrivalIndices = "";
  cancelAnimationFrame(frame);
  frame = 0;
  anchorFocusKey = "";
  canvas.dataset.planetPoiFocusState = "none";
  canvas.dataset.planetFocusedPoiIndex = "-1";
  canvas.dataset.planetPoiConnector = "false";
  layer.classList.remove("is-firms-exhibit", "is-planet-signals-exhibit");
  delete layer.dataset.planetExhibit;
  canvas.hidden = true;
  atmosphereCanvas.hidden = true;
  atmosphereRenderer?.suspend();
  legend.hidden = true;
  readout.hidden = true;
  buttons.forEach((item) => item.setAttribute("aria-current", "false"));
  if (savedHeading) {
    const number = document.querySelector("#japan-mode-number");
    const title = document.querySelector("#japan-mode-title");
    if (number) number.textContent = savedHeading.number;
    if (title) title.textContent = savedHeading.title;
  }
  savedHeading = null;
  dispatchEvent(new CustomEvent("gaia:planet-signals-change", { detail: { active: false, id: previous.id } }));
};

const step = (direction) => {
  const next = activeIndex + Number(direction);
  if (next < 0) document.querySelector(".map-mode-bank [data-firms-exhibit]")?.click();
  else if (next >= DEFINITIONS.length) globalThis.GaiaMapCategories.standardButtons()[0]?.click();
  else void select(next);
};

const mount = () => {
  if (document.querySelector("#gaia-planet-signals-canvas")) return;
  layer = document.querySelector("#japan-layer");
  map = document.querySelector("#japan-map");
  const list = document.querySelector("#japan-firms-mode-list");
  const bank = document.querySelector(".map-mode-bank");
  if (!(layer instanceof HTMLElement) || !(map instanceof HTMLElement) || !(list instanceof HTMLElement) || !(bank instanceof HTMLElement)) return;

  canvas = document.createElement("canvas");
  canvas.id = "gaia-planet-signals-canvas";
  canvas.className = "gaia-planet-signals-canvas";
  canvas.hidden = true;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.planetEngine = "canvas2d-particle-field";
  canvas.dataset.planetTargetFps = "30";
  context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) canvas.dataset.planetEngine = "unavailable";
  map.append(canvas);

  atmosphereCanvas = document.createElement("canvas");
  atmosphereCanvas.id = "gaia-planet-atmosphere-canvas";
  atmosphereCanvas.className = "gaia-planet-atmosphere-canvas";
  atmosphereCanvas.hidden = true;
  atmosphereCanvas.setAttribute("aria-hidden", "true");
  map.insertBefore(atmosphereCanvas, canvas);
  initializeAtmosphere = () => {
    try {
      atmosphereRenderer = createAtmosphereRenderer(atmosphereCanvas);
      if (activeIndex >= 0 && currentData && DEFINITIONS[activeIndex].renderer !== "quake") {
        atmosphereRenderer?.setData(DEFINITIONS[activeIndex].renderer, currentData);
      }
    } catch (error) {
      atmosphereRenderer = null;
      atmosphereCanvas.dataset.fieldState = "unavailable";
      console.warn("WebGL atmosphere unavailable; retaining data-point rendering.", error);
    }
  };
  atmosphereCanvas.addEventListener("webglcontextrestored", initializeAtmosphere);

  legend = document.createElement("section");
  legend.className = "gaia-planet-signals-legend";
  legend.hidden = true;
  legend.setAttribute("aria-label", "地球ライブデータの描画凡例");
  legend.innerHTML = `
    <details class="gaia-metric-legend-details"><summary><span data-planet-detail-summary>凡例・データの詳細</span><span data-planet-reference-notice hidden>雲の形は過去の参考画像</span></summary>
      <div class="gaia-metric-legend-details-body">
        <div class="gaia-planet-data-time"><span data-planet-time-label>数値の時刻</span><time data-planet-data-time>読込中</time><small data-planet-data-age>—</small></div>
        <p><span data-planet-legend-state>取得中</span> · <span data-planet-legend-count>—</span></p>
        <p data-planet-scope-note></p>
        <p data-planet-detail-caption></p>
        <a class="gaia-planet-cloud-credit" data-cloud-image-credit href="https://visibleearth.nasa.gov/images/57747/blue-marble-clouds" target="_blank" rel="noopener noreferrer" hidden><span>雲の参考画像 · NASA Blue Marble ↗</span><small>2002年公開 · 現在の雲分布ではありません</small></a>
        <p class="gaia-planet-poi-key"><span>観測点 · クリック／タップで詳細</span></p>
      </div>
    </details>
  `;
  metricLegend = createMetricLegend({ label: "地球の観測値と色の目盛り" });
  metricLegend.querySelector("[data-metric-title]").setAttribute("data-planet-legend-title", "");
  legend.querySelector(".gaia-metric-legend-details-body").prepend(metricLegend);
  // Keep the map's drag capture and zoom shortcuts off the source disclosure.
  for (const type of ["pointerdown", "wheel", "keydown", "keyup"]) {
    legend.addEventListener(type, event => {
      if (event.target instanceof Element && event.target.closest("details")) event.stopPropagation();
    });
  }
  layer.append(legend);
  atmosphereCanvas.addEventListener("gaia:cloud-reference-state", () => {
    legend.querySelector("[data-cloud-image-credit] small").textContent = atmosphereCanvas.dataset.cloudTextureState === "unavailable"
      ? "参考画像を読み込めません · 地点の数値は確認できます" : "2002年公開 · 現在の雲分布ではありません";
  });

  readout = document.createElement("section");
  readout.className = "gaia-planet-signals-readout";
  readout.hidden = true;
  readout.setAttribute("aria-live", "polite");
  readout.innerHTML = `
    <div class="gaia-planet-chapter">
      <p data-planet-kicker></p>
      <div><button type="button" data-planet-step="-1" aria-label="前の展示">‹</button><button type="button" class="gaia-featured-selector-toggle" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover" aria-label="展示一覧を開く"><span class="gaia-planet-chapter-title"><b data-planet-number></b><strong data-planet-title></strong></span></button><button type="button" data-planet-step="1" aria-label="次の展示">›</button></div>
    </div>
    <div class="gaia-planet-primary"><p data-planet-primary-label></p><strong data-planet-primary>—</strong><span data-planet-unit></span></div>
    <div class="gaia-planet-metrics">
      <span><small data-planet-secondary-a-label>—</small><strong data-planet-secondary-a>—</strong></span>
      <span data-planet-secondary-b-item><small data-planet-secondary-b-label>—</small><strong data-planet-secondary-b>—</strong></span>
      <button type="button" data-planet-epicenter hidden disabled><small>最大震源</small><strong data-planet-epicenter-name></strong><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5"/><path d="M10 1v5m0 8v5M1 10h5m8 0h5"/></svg></button>
    </div>
    <div class="gaia-planet-copy"><p data-planet-caption></p><small><b data-planet-state>取得中</b> · <time data-planet-time>—</time></small></div>
    <div class="gaia-planet-source"><button type="button" data-planet-source-link></button><button type="button" data-planet-analysis disabled></button></div>
  `;
  decorateMapActions(readout.querySelector(".gaia-planet-source"), readout.querySelector("[data-planet-source-link]"), readout.querySelector("[data-planet-analysis]"));
  realtimeStatus = createRealtimeStatus();
  readout.querySelector(".gaia-planet-chapter").after(realtimeStatus);
  layer.append(readout);

  buttons = DEFINITIONS.map((definition, index) => {
    const item = document.createElement("button");
    item.className = "map-mode-button";
    item.type = "button";
    item.textContent = definition.number;
    item.dataset.planetExhibit = definition.id;
    item.dataset.mapPreviewSurface = "map";
    item.style.setProperty("--planet-rgb", definition.rgb);
    item.setAttribute("aria-label", `${definition.number} ${definition.shortTitle}、${definition.sourceName}の観測展示へ切り替える`);
    item.setAttribute("aria-describedby", "map-mode-preview");
    item.setAttribute("aria-current", "false");
    item.addEventListener("click", () => { void select(index); });
    list.append(item);
    return item;
  });

  bank.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".map-mode-button") : null;
    if (!(target instanceof HTMLButtonElement) || target.dataset.planetExhibit || activeIndex < 0) return;
    deactivate();
  }, { capture: true });
  readout.querySelectorAll("[data-planet-step]").forEach((item) => item.addEventListener("click", () => step(item.dataset.planetStep)));
  readout.querySelector("[data-planet-epicenter]").addEventListener("click", focusStrongestEarthquake);
  addEventListener("resize", () => { if (activeIndex >= 0) lastRenderedAt = 0; }, { passive: true });
  addEventListener("gaia:japan-close", pauseDrawing);
  addEventListener("gaia:japan-open", resumeDrawing);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseDrawing();
    else resumeDrawing();
  });
  dispatchEvent(new CustomEvent("gaia:planet-signals-mounted"));
};

if (globalThis.GaiaMapObservationAdapter) mount();
else addEventListener("gaia:map-adapter-ready", mount, { once: true });

globalThis.GaiaPlanetSignals = Object.freeze({
  getCruisePoints: () => currentData?.points || [],
  selectCruisePoi: index => {
    const point = currentData?.points[index];
    if (!point) return;
    focusedEpicenterIndex = index;
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation({lon:point.lon,lat:point.lat,zoom:3.5,targetX:.5,targetY:.38,durationMs:750});
    globalThis.GaiaMapObservationAdapter?.previewCruisePoi(poiForPoint(point,index));
  },
  definitions: DEFINITIONS,
  select,
  deactivate,
  findPoiAt,
  getSourceInfo: () => {
    if (activeIndex < 0) return null;
    const definition = DEFINITIONS[activeIndex];
    return {
      number: definition.number,
      shortTitle: definition.shortTitle,
      datasets: [{
        id: definition.id,
        title: definition.sourceName,
        organisation: definition.loader === "earthquake" ? "USGS" : definition.loader === "air" ? "Open-Meteo / CAMS" : "Open-Meteo / DWD・ECMWFほか",
        url: definition.sourcePage,
        attributionNote: definition.caption,
      }],
    };
  },
  getState: () => ({
    active: activeIndex >= 0,
    id: activeIndex >= 0 ? DEFINITIONS[activeIndex].id : null,
    sourceState: currentData?.sourceState || null,
    pointCount: currentData?.points?.length || 0,
  }),
});

export { mount };
