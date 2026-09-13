import { OBSERVATION_CITIES } from "./observation-cities.js?v=gaia-exhibit-catalog-1";
import { formatJapaneseNumber } from "../shared/number-format.js";
import { setAttributeIfChanged, setTextIfChanged, setStyleIfChanged } from "../shared/dom-updates.js";
import { formatPrefecturePlace } from "./observation-place-label.js?v=gaia-place-inline-1";
import { EARTH_CENTER_LONGITUDE, earthBaseScale, earthLongitudeToMapX } from "./world-projection.js?v=gaia-japan-center-1";
import { japanPrefectureView } from "./japan-prefecture-view.js?v=gaia-prefecture-gis-view-1";
import { ESTAT_EXHIBITS as EXHIBITS } from "./estat-exhibit-catalog.js?v=gaia-poi-manual-1";
import { decorateMapActions } from "./map-exhibit-actions.js?v=gaia-map-polish-1";
import { ESTAT_OCEAN_GLSL, createOceanMask } from "./estat-ocean.js?v=gaia-estat-ocean-1";
import { createMetricLegend, updateMetricLegend, metricLegendProgress } from "./metric-legend.js?v=gaia-lodging-color-1-i18n-20260913";

const SERIES_URL = new URL("../../data/estat-prefecture-series.json?v=gaia-annual-history-1", import.meta.url);
const PREFECTURE_TOPOLOGY_URL = new URL("../../data/japan-prefectures.topojson?v=gaia-estat-choropleth-1", import.meta.url);
const PERIOD_MS = 6200;
const POI_MS = 3600;
const TRANSITION_MS = 920;
const PRIMARY_VALUE_COUNT_MS = 760;
const PRIMARY_VALUE_COUNT_STEPS = 32;
const LONG_TERM_PERIOD_MS = 1050;
const ESTAT_WEBGL_HUB_COUNT = 8;
const ESTAT_WEBGL_ANCHOR_TRANSITION_MS = 1400;
const WEATHER_STATION_EXHIBITS = new Set(["averageTemperature", "summerHigh", "winterLow", "relativeHumidity", "sunshineHours", "precipitation", "rainyDays"]);
const LONG_TERM_TEMPERATURE_KEYS = new Set(["averageTemperature", "summerHigh", "winterLow"]);
const ESTAT_WEBGL_THEMES = Object.freeze({
  migration: Object.freeze({ index: 0, visual: "tidal-migration-currents" }),
  lodging: Object.freeze({ index: 1, visual: "continuous-travel-filaments" }),
  housing: Object.freeze({ index: 2, visual: "rising-blueprint-seeds" }),
  averageTemperature: Object.freeze({ index: 3, visual: "thermal-convection-veils" }),
  summerHigh: Object.freeze({ index: 4, visual: "summer-heat-shimmer" }),
  winterLow: Object.freeze({ index: 5, visual: "drifting-frost-crystals" }),
  relativeHumidity: Object.freeze({ index: 6, visual: "low-cloud-vapor" }),
  sunshineHours: Object.freeze({ index: 7, visual: "sunbeam-dust-field" }),
  precipitation: Object.freeze({ index: 8, visual: "continuous-rain-streaks" }),
  rainyDays: Object.freeze({ index: 9, visual: "asynchronous-rain-ripples" }),
});

let layer;
let map;
let canvas;
let context;
let atmosphereWebglCanvas;
let atmosphereGl;
let atmosphereWebglProgram;
let atmosphereWebglPositionBuffer;
let atmosphereWebglLocations;
let atmosphereAnchorPreviousIndex = 0;
let atmosphereAnchorChangedAt = 0;
let atmosphereWebglLastRenderAt = 0;
let atmosphereOceanMask;
let markerLayer;
let markerButtons = [];
let prefectureRegionLayer;
let prefectureRegionGroup;
let prefectureRegionPaths = [];
let prefectureRegionTooltip;
let heatLegend;
let readout;
let buttons = [];
let activeIndex = -1;
let selectedIndex = 0;
let periodIndex = 0;
let previousPeriodIndex = 0;
let transitionStartedAt = 0;
let frame = 0;
let nextMonthAt = 0;
let nextPoiAt = 0;
let playbackEnabled = true;
let hoveredPrefectureIndex = -1;
let prefectureTooltipPointer = null;
let series;
let seriesPromise;
let prefectureShapes = [];
let prefectureShapesPromise;
let savedHeading;
const scaleMaxima = new Map();
let primaryValueAnimationFrame = 0;
let primaryValueDisplayed = Number.NaN;
let primaryValueTarget = Number.NaN;
let primaryValueExhibitKey = "";

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => 1 - ((1 - clamp01(value)) ** 3);
const formatNumber = (value, signed = false, decimals = 0) => {
  if (!Number.isFinite(value)) return "欠測";
  const number = Number(value);
  const sign = signed && number > 0 ? "+" : "";
  return `${sign}${formatJapaneseNumber(number, decimals, decimals)}`;
};

const settlePrimaryValue = (element, value, exhibit, state = "settled") => {
  const signed = exhibit.key === "migration";
  const decimals = exhibit.decimals || 0;
  element.textContent = formatNumber(value, signed, decimals);
  element.classList.remove("is-counting", "is-counting-up", "is-counting-down");
  readout?.removeAttribute("aria-busy");
  readout.dataset.estatValueCountState = state;
  readout.dataset.estatValueCountDirection = "none";
  readout.dataset.estatValueCountProgress = "1.000";
  readout.dataset.estatValueCountCurrent = Number.isFinite(value) ? String(value) : "missing";
  primaryValueDisplayed = value;
  primaryValueTarget = value;
  primaryValueExhibitKey = exhibit.key;
};

const animatePrimaryValue = (value, exhibit) => {
  const element = readout?.querySelector("[data-estat-value]");
  if (!(element instanceof HTMLElement)) return;
  cancelAnimationFrame(primaryValueAnimationFrame);
  primaryValueAnimationFrame = 0;
  if (!Number.isFinite(value)) {
    settlePrimaryValue(element, Number.NaN, exhibit, "missing");
    return;
  }

  const target = Number(value);
  const sameExhibit = primaryValueExhibitKey === exhibit.key;
  const start = sameExhibit && Number.isFinite(primaryValueDisplayed)
    ? primaryValueDisplayed
    : 0;
  const precision = 10 ** -(exhibit.decimals || 0);
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reducedMotion || Math.abs(target - start) < precision * 0.5) {
    settlePrimaryValue(element, target, exhibit);
    return;
  }

  const direction = target > start ? "up" : "down";
  const startedAt = performance.now();
  primaryValueTarget = target;
  primaryValueExhibitKey = exhibit.key;
  element.classList.remove("is-counting-up", "is-counting-down");
  element.classList.add("is-counting", `is-counting-${direction}`);
  readout.setAttribute("aria-busy", "true");
  readout.dataset.estatValueCountState = "counting";
  readout.dataset.estatValueCountDirection = direction;
  readout.dataset.estatValueCountStart = String(start);
  readout.dataset.estatValueCountTarget = String(target);
  readout.dataset.estatValueCountSteps = String(PRIMARY_VALUE_COUNT_STEPS);

  const tick = (timestamp) => {
    if (!readout || activeIndex < 0 || primaryValueTarget !== target || primaryValueExhibitKey !== exhibit.key) return;
    const rawProgress = clamp01((timestamp - startedAt) / PRIMARY_VALUE_COUNT_MS);
    const steppedProgress = rawProgress >= 1
      ? 1
      : Math.floor(ease(rawProgress) * PRIMARY_VALUE_COUNT_STEPS) / PRIMARY_VALUE_COUNT_STEPS;
    const current = start + (target - start) * steppedProgress;
    primaryValueDisplayed = current;
    element.textContent = formatNumber(current, exhibit.key === "migration", exhibit.decimals || 0);
    readout.dataset.estatValueCountProgress = rawProgress.toFixed(3);
    readout.dataset.estatValueCountCurrent = String(current);
    if (rawProgress >= 1) {
      primaryValueAnimationFrame = 0;
      settlePrimaryValue(element, target, exhibit);
      return;
    }
    primaryValueAnimationFrame = requestAnimationFrame(tick);
  };
  primaryValueAnimationFrame = requestAnimationFrame(tick);
};

const stitchTopologyRing = (arcReferences, decodedArcs) => {
  const ring = [];
  arcReferences.forEach((reference, referenceIndex) => {
    const arcIndex = reference < 0 ? ~reference : reference;
    const source = decodedArcs[arcIndex] || [];
    const points = reference < 0 ? [...source].reverse() : source;
    ring.push(...(referenceIndex === 0 ? points : points.slice(1)));
  });
  return ring;
};

const topologyGeometryPolygons = (geometry, decodedArcs) => {
  const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
  return polygons.map((polygon) => polygon.map((ring) => stitchTopologyRing(ring, decodedArcs)));
};

const worldPoint = ([longitude, latitude]) => [
  earthLongitudeToMapX(longitude),
  90 - latitude,
];

const svgPathForPolygons = (polygons) => polygons.map((polygon) => polygon.map((ring) => (
  ring.map((point, pointIndex) => {
    const [x, y] = worldPoint(point);
    return `${pointIndex === 0 ? "M" : "L"}${x.toFixed(4)} ${y.toFixed(4)}`;
  }).join(" ") + " Z"
)).join(" ")).join(" ");

const loadPrefectureShapes = () => {
  if (prefectureShapes.length === 47) return Promise.resolve(prefectureShapes);
  if (prefectureShapesPromise) return prefectureShapesPromise;
  prefectureShapesPromise = fetch(PREFECTURE_TOPOLOGY_URL, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Japan prefecture topology HTTP ${response.status}`);
      return response.json();
    })
    .then((topology) => {
      const geometries = topology?.objects?.japan?.geometries || [];
      const topologyArcs = topology?.arcs || [];
      const scale = topology?.transform?.scale;
      const translate = topology?.transform?.translate;
      if (topology?.type !== "Topology" || geometries.length !== 47
        || !Array.isArray(scale) || !Array.isArray(translate)) {
        throw new Error("Japan prefecture topology is incomplete");
      }
      const decodedArcs = topologyArcs.map((rawArc) => {
        let x = 0;
        let y = 0;
        return rawArc.map(([deltaX, deltaY]) => {
          x += deltaX;
          y += deltaY;
          return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
        });
      });
      const shapes = geometries.map((geometry) => {
        const code = String(geometry.properties?.id || "").padStart(2, "0");
        const path = new Path2D();
        const polygons = topologyGeometryPolygons(geometry, decodedArcs);
        polygons.forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach(([longitude, latitude], pointIndex) => {
              const [x, y] = worldPoint([longitude, latitude]);
              if (pointIndex === 0) path.moveTo(x, y);
              else path.lineTo(x, y);
            });
            path.closePath();
          });
        });
        return {
          code,
          index: Number(code) - 1,
          name: geometry.properties?.nam_ja || code,
          path,
          svgPath: svgPathForPolygons(polygons),
        };
      }).sort((left, right) => left.index - right.index);
      if (shapes.length !== 47 || shapes.some(({ index }) => index < 0 || index >= 47)) {
        throw new Error("Japan prefecture topology could not be indexed by prefecture code");
      }
      prefectureShapes = shapes;
      syncPrefectureRegionPaths();
      return prefectureShapes;
    })
    .catch((error) => {
      console.error(error);
      prefectureShapes = [];
      return prefectureShapes;
    });
  return prefectureShapesPromise;
};

const fallbackSeries = () => {
  const fallback = { periodsBySeries: {}, unavailable: true };
  EXHIBITS.forEach(({ key }) => {
    fallback.periodsBySeries[key] = ["—"];
    fallback[key] = { "—": Array(OBSERVATION_CITIES.length).fill(null) };
  });
  return fallback;
};

const periodsFor = (exhibit = currentExhibit(), candidate = series) => (
  candidate?.periodsBySeries?.[exhibit.key]
  || []
);

const validateSeries = (candidate) => {
  if (!candidate?.periodsBySeries) return false;
  return EXHIBITS.every((exhibit) => Array.isArray(periodsFor(exhibit, candidate))
    && periodsFor(exhibit, candidate).length > 0
    && periodsFor(exhibit, candidate).every((period, index, periods) => (
    /^\d{4}$/u.test(period) && (index === 0 || Number(period) === Number(periods[index - 1]) + 1)
    &&
    Array.isArray(candidate[exhibit.key]?.[period])
    && candidate[exhibit.key][period].length === OBSERVATION_CITIES.length
    && candidate[exhibit.key][period].every((value) => value === null || Number.isFinite(value))
  )));
};

const loadSeries = () => {
  if (series) return Promise.resolve(series);
  if (seriesPromise) return seriesPromise;
  seriesPromise = fetch(SERIES_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`official statistics series HTTP ${response.status}`);
      return response.json();
    })
    .then((candidate) => {
      if (!validateSeries(candidate)) throw new Error("official statistics series failed validation");
      series = candidate;
      return series;
    })
    .catch((error) => {
      console.warn(error);
      series = fallbackSeries();
      return series;
    });
  return seriesPromise;
};

const projection = (rect = canvas?.getBoundingClientRect()) => {
  if (!rect?.width || !rect?.height) return null;
  const overlay = document.querySelector("#japan-overlay");
  const zoom = Math.max(1, Number(overlay?.dataset.earthZoom) || 1);
  const offsetX = Number(overlay?.dataset.earthOffsetX) || 0;
  const offsetY = Number(overlay?.dataset.earthOffsetY) || 0;
  const scale = earthBaseScale(rect) * zoom;
  return {
    rect,
    scale,
    originX: (rect.width - 360 * scale) / 2 + offsetX,
    originY: (rect.height - 180 * scale) / 2 + offsetY,
  };
};

const project = (location, currentProjection) => {
  const { rect, scale, originX, originY } = currentProjection;
  return [
    originX + earthLongitudeToMapX(location.lon) * scale,
    originY + (90 - location.lat) * scale,
    rect,
  ];
};

const currentExhibit = () => EXHIBITS[activeIndex] || EXHIBITS[0];
const usesWeatherStations = (exhibit = currentExhibit()) => WEATHER_STATION_EXHIBITS.has(exhibit.key);
const usesPrefectureRegions = (exhibit = currentExhibit()) => exhibit.key === "migration" || usesWeatherStations(exhibit);
const currentPeriod = () => periodsFor()[periodIndex] || "—";
const formatPeriodJa = value => /^\d{4}$/u.test(value) ? `${value}年` : String(value).replace(/^(\d{4})-(\d{2})$/u, "$1年$2月");
const valuesFor = (index = periodIndex) => {
  const exhibit = currentExhibit();
  const period = periodsFor(exhibit)[index] || currentPeriod();
  return series?.[exhibit.key]?.[period] || [];
};

const selectedValue = () => valuesFor()[selectedIndex];
const periodDurationFor = (exhibit = currentExhibit()) => (
  exhibit.longTerm ? LONG_TERM_PERIOD_MS : PERIOD_MS
);
const observationStationFor = (index = selectedIndex, exhibit = currentExhibit()) => {
  if (!usesWeatherStations(exhibit)) return null;
  const station = series?.weatherHistorySource?.stations?.[index] || series?.temperatureHistorySource?.stations?.[index];
  if (!station) return null;
  const view = exhibit.key === "sunshineHours" ? "a4" : ["precipitation", "rainyDays"].includes(exhibit.key) ? "a1" : "a2";
  return { ...station, url: station.urls?.[view] || station.url };
};
const sourceMetadataFor = (exhibit = currentExhibit()) => series?.annualHistorySources?.[exhibit.key]
  || (LONG_TERM_TEMPERATURE_KEYS.has(exhibit.key) ? series?.temperatureHistorySource : series?.weatherHistorySource)
  || {};
const comparisonNoteFor = (exhibit = currentExhibit()) => {
  const note = sourceMetadataFor(exhibit).comparisonNote || "";
  // The sunshine instrument warning is specific to sunshine, not rainfall/humidity.
  return exhibit.key === "sunshineHours" ? note : note.replace(/日照計は[^。]*。/u, "");
};
const qualityFlagFor = (year, index = selectedIndex, exhibit = currentExhibit()) => (
  series?.weatherHistorySource?.qualityFlags?.find(flag => flag.series === exhibit.key && flag.year === year && flag.code === OBSERVATION_CITIES[index].code) || null
);
const selectedTemperatureTrendPerDecade = (exhibit = currentExhibit()) => {
  if (!LONG_TERM_TEMPERATURE_KEYS.has(exhibit.key)) return null;
  const points = periodsFor(exhibit)
    .map((period, index) => ({ year: Number(period), value: valuesFor(index)[selectedIndex] }))
    .filter(({ year, value }) => Number.isFinite(year) && Number.isFinite(value));
  if (points.length < 2) return null;
  const meanYear = points.reduce((sum, point) => sum + point.year, 0) / points.length;
  const meanValue = points.reduce((sum, point) => sum + point.value, 0) / points.length;
  const numerator = points.reduce((sum, point) => sum + (point.year - meanYear) * (point.value - meanValue), 0);
  const denominator = points.reduce((sum, point) => sum + (point.year - meanYear) ** 2, 0);
  return denominator > 0 ? (numerator / denominator) * 10 : null;
};
const valueRangeFor = (exhibit) => {
  if (!scaleMaxima.has(exhibit.key)) {
    const allValues = periodsFor(exhibit)
      .flatMap((period) => series?.[exhibit.key]?.[period] || [])
      .filter(Number.isFinite);
    scaleMaxima.set(exhibit.key, {
      minimum: allValues.length ? Math.min(...allValues) : 0,
      maximum: allValues.length ? Math.max(...allValues) : 1,
      absolute: Math.max(1, ...allValues.map((entry) => Math.abs(entry))),
    });
  }
  return scaleMaxima.get(exhibit.key) || { minimum: 0, maximum: 1, absolute: 1 };
};

const normalizedValue = (value, exhibit) => {
  if (!Number.isFinite(value)) return 0;
  const range = valueRangeFor(exhibit);
  if (exhibit.key === "migration") return Math.sqrt(Math.abs(value) / range.absolute);
  if (exhibit.scaleMode === "cold") {
    return 0.12 + Math.sqrt(clamp01((range.maximum - value) / Math.max(0.001, range.maximum - range.minimum))) * 0.88;
  }
  if (exhibit.scaleMode === "range") {
    return 0.12 + Math.sqrt(clamp01((value - range.minimum) / Math.max(0.001, range.maximum - range.minimum))) * 0.88;
  }
  return Math.sqrt(Math.max(0, value) / Math.max(1, range.maximum));
};

const syncCanvas = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 1.75);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return rect;
};

const compileAtmosphereShader = (type, source) => {
  const shader = atmosphereGl.createShader(type);
  atmosphereGl.shaderSource(shader, source);
  atmosphereGl.compileShader(shader);
  if (!atmosphereGl.getShaderParameter(shader, atmosphereGl.COMPILE_STATUS)) {
    const message = atmosphereGl.getShaderInfoLog(shader) || "unknown shader error";
    atmosphereGl.deleteShader(shader);
    throw new Error(`e-Stat atmosphere WebGL shader: ${message}`);
  }
  return shader;
};

const initializeAtmosphereWebgl = () => {
  if (!atmosphereWebglCanvas || atmosphereWebglProgram) return Boolean(atmosphereWebglProgram);
  atmosphereGl = atmosphereWebglCanvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  if (!atmosphereGl) {
    atmosphereWebglCanvas.dataset.estatWebglState = "fallback-2d";
    return false;
  }

  const vertexSource = `#version 300 es
    in vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `#version 300 es
    precision highp float;
    #define HUB_COUNT ${ESTAT_WEBGL_HUB_COUNT}
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_anchor;
    uniform vec2 u_hubs[HUB_COUNT];
    uniform float u_strengths[HUB_COUNT];
    uniform int u_hub_count;
    uniform int u_theme;
    uniform vec3 u_accent;
    uniform vec3 u_secondary;
    uniform float u_field_strength;
    out vec4 out_color;

    float hash21(vec2 point) {
      point = fract(point * vec2(123.34, 345.45));
      point += dot(point, point + 34.345);
      return fract(point.x * point.y);
    }

    float value_noise(vec2 point) {
      vec2 cell = floor(point);
      vec2 local = fract(point);
      local = local * local * (3.0 - 2.0 * local);
      return mix(
        mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
        mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), local.x),
        local.y
      );
    }

    float mist_noise(vec2 point) {
      float sum = 0.0;
      float amplitude = 0.5;
      for (int octave = 0; octave < 4; octave += 1) {
        sum += value_noise(point) * amplitude;
        point = mat2(1.62, 1.18, -1.18, 1.62) * point + 0.17;
        amplitude *= 0.48;
      }
      return sum;
    }

    vec2 aspect_point(vec2 point) {
      return (point - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    }

    vec2 curved_route(vec2 start, vec2 end, float amount, float side) {
      vec2 delta = end - start;
      vec2 normal = normalize(vec2(-delta.y, delta.x) + vec2(0.00001));
      float brush_curve = sin(amount * 3.14159265)
        + sin(amount * 6.2831853) * 0.18;
      return mix(start, end, amount) + normal * brush_curve * side;
    }

    float grid_line(float value) {
      float edge = min(fract(value), 1.0 - fract(value));
      return exp(-edge * 105.0);
    }

    ${ESTAT_OCEAN_GLSL}

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      vec2 point = aspect_point(uv);
      vec2 anchor = aspect_point(u_anchor);
      float time = u_time;
      vec3 accumulated = vec3(0.0);
      float coverage = 0.0;

      // The base haze only translates through space. No global time multiplier means no full-screen flash.
      float haze = mist_noise(point * 3.15 + vec2(time * 0.006, -time * 0.003));
      float haze_mask = smoothstep(0.61, 0.94, haze) * 0.052;
      accumulated += mix(u_accent, u_secondary, clamp(uv.x * 0.72 + haze * 0.2, 0.0, 1.0)) * haze_mask * 0.36;
      coverage += haze_mask * 0.2;
      float field_strength = mix(0.72, 1.06, clamp(u_field_strength, 0.0, 1.0));

      if (u_theme == 0) {
        float drift = mist_noise(point * 2.15 + vec2(time * 0.011, -time * 0.004));
        float incoming = pow(0.5 + 0.5 * sin(point.y * 31.0 + point.x * 5.0 + drift * 4.2 - time * 0.12), 18.0);
        float outgoing = pow(0.5 + 0.5 * sin(point.y * 23.0 - point.x * 7.0 - drift * 3.4 + time * 0.085), 22.0);
        accumulated += (u_accent * incoming + u_secondary * outgoing * 0.62) * 0.12 * field_strength;
        coverage += (incoming + outgoing * 0.6) * 0.045;
      } else if (u_theme == 1) {
        for (int index = 0; index < HUB_COUNT; index += 1) {
          if (index >= u_hub_count) break;
          vec2 hub = aspect_point(u_hubs[index]);
          vec2 span = hub - anchor;
          float span_squared = max(dot(span, span), 0.00001);
          float route_position = clamp(dot(point - anchor, span) / span_squared, 0.0, 1.0);
          float side = (mod(float(index), 2.0) < 1.0 ? -1.0 : 1.0)
            * (0.023 + float(index % 3) * 0.007);
          vec2 nearest = curved_route(anchor, hub, route_position, side);
          float distance_to_route = length(point - nearest);
          float strength = 0.38 + u_strengths[index] * 0.62;
          float route_core = exp(-distance_to_route * 260.0) * strength;
          float route_halo = exp(-distance_to_route * 82.0) * strength;
          float filament = 0.76 + 0.24 * sin(route_position * 24.0 - time * 0.34 + float(index) * 2.17);
          vec3 route_color = mix(u_accent, u_secondary, u_strengths[index]);
          accumulated += route_color * (route_core * 0.62 + route_halo * 0.15) * filament;
          coverage += route_core * 0.26 + route_halo * 0.1;

          float traveller_position = fract(time * (0.022 + float(index % 3) * 0.003) + float(index) * 0.137);
          vec2 traveller = curved_route(anchor, hub, traveller_position, side);
          float traveller_distance = length(point - traveller);
          float traveller_glow = exp(-traveller_distance * 155.0) * strength;
          accumulated += mix(u_accent, u_secondary, float(index) / float(HUB_COUNT)) * traveller_glow * 0.54;
          coverage += traveller_glow * 0.32;

          float hub_distance = length(point - hub);
          float independent_breath = 0.88 + 0.12 * sin(time * 0.27 + float(index) * 2.399);
          float hub_glow = exp(-hub_distance * 92.0) * strength * independent_breath;
          accumulated += u_accent * hub_glow * 0.3;
          coverage += hub_glow * 0.18;
        }
        float anchor_distance = length(point - anchor);
        float anchor_glow = exp(-anchor_distance * 76.0);
        accumulated += mix(u_accent, vec3(1.0), 0.26) * anchor_glow * 0.24;
        coverage += anchor_glow * 0.16;
      } else if (u_theme == 2) {
        vec2 blueprint = point * vec2(17.0, 13.0) + vec2(time * 0.003, -time * 0.002);
        float grid = max(grid_line(blueprint.x), grid_line(blueprint.y));
        vec2 cell = floor(blueprint);
        vec2 local = fract(blueprint);
        float seed = hash21(cell);
        vec2 sprout = vec2(0.18 + seed * 0.64, fract(seed * 2.7 + time * (0.018 + seed * 0.008)));
        float spark = exp(-length((local - sprout) * vec2(1.0, 1.8)) * 64.0);
        accumulated += u_accent * grid * 0.035 + u_secondary * spark * 0.2 * field_strength;
        coverage += grid * 0.018 + spark * 0.08;
      } else if (u_theme == 3) {
        float convection = mist_noise(point * 2.35 + vec2(time * 0.009, time * 0.004));
        float veil = pow(0.5 + 0.5 * sin(point.x * 9.0 + point.y * 5.5 + convection * 5.2 - time * 0.055), 6.0);
        vec3 thermal = mix(u_secondary, u_accent, smoothstep(0.35, 0.78, convection));
        accumulated += thermal * veil * 0.105 * field_strength;
        coverage += veil * 0.04;
      } else if (u_theme == 4) {
        float distortion = mist_noise(point * 3.1 + vec2(-time * 0.006, time * 0.012));
        float shimmer = pow(0.5 + 0.5 * sin(point.x * 27.0 + point.y * 2.8 + distortion * 4.5 - time * 0.16), 19.0);
        float rising = smoothstep(-0.72, 0.56, point.y) * (0.55 + distortion * 0.45);
        accumulated += mix(u_accent, u_secondary, uv.y) * shimmer * rising * 0.115 * field_strength;
        coverage += shimmer * rising * 0.045;
      } else if (u_theme == 5) {
        vec2 frost_grid = point * vec2(17.0, 13.0);
        vec2 frost_cell = floor(frost_grid);
        vec2 frost_local = fract(frost_grid);
        float frost_seed = hash21(frost_cell);
        vec2 crystal = vec2(0.14 + frost_seed * 0.72, fract(frost_seed * 3.1 - time * (0.012 + frost_seed * 0.007)));
        vec2 crystal_delta = frost_local - crystal;
        float crystal_core = exp(-length(crystal_delta) * 72.0);
        float crystal_arms = exp(-min(abs(crystal_delta.x), abs(crystal_delta.y)) * 120.0)
          * exp(-length(crystal_delta) * 18.0);
        float cold_veil = pow(0.5 + 0.5 * sin(point.y * 18.0 - point.x * 3.0 + time * 0.045), 20.0);
        accumulated += u_accent * crystal_core * 0.24 + u_secondary * crystal_arms * 0.045 + u_accent * cold_veil * 0.04;
        coverage += crystal_core * 0.09 + crystal_arms * 0.02 + cold_veil * 0.015;
      } else if (u_theme == 6) {
        float vapor = mist_noise(point * 2.65 + vec2(time * 0.014, time * 0.002));
        float fog = smoothstep(0.5, 0.82, vapor + sin(point.y * 13.0 + time * 0.035) * 0.08);
        float ribbon = pow(0.5 + 0.5 * sin(point.y * 16.0 + point.x * 1.4 + vapor * 3.7 - time * 0.045), 10.0);
        accumulated += mix(u_secondary, u_accent, vapor) * (fog * 0.05 + ribbon * 0.045) * field_strength;
        coverage += fog * 0.025 + ribbon * 0.018;
      } else if (u_theme == 7) {
        vec2 sun = aspect_point(vec2(0.18, 1.06));
        vec2 ray_delta = point - sun;
        float ray_angle = atan(ray_delta.y, ray_delta.x);
        float ray_noise = mist_noise(point * 2.5 + vec2(time * 0.004, 0.0));
        float ray = pow(0.5 + 0.5 * sin(ray_angle * 46.0 + ray_noise * 2.2), 15.0);
        float ray_falloff = exp(-length(ray_delta) * 0.72);
        vec2 dust_grid = point * vec2(24.0, 17.0);
        vec2 dust_cell = floor(dust_grid);
        vec2 dust_local = fract(dust_grid);
        float dust_seed = hash21(dust_cell);
        vec2 dust_position = vec2(dust_seed, fract(dust_seed * 2.3 + time * (0.006 + dust_seed * 0.004)));
        float dust = exp(-length(dust_local - dust_position) * 86.0);
        accumulated += u_accent * ray * ray_falloff * 0.07 + u_secondary * dust * 0.18;
        coverage += ray * ray_falloff * 0.025 + dust * 0.055;
      } else if (u_theme == 8) {
        vec2 rain_grid = point * vec2(29.0, 12.0);
        vec2 rain_cell = floor(rain_grid);
        vec2 rain_local = fract(rain_grid);
        float rain_seed = hash21(rain_cell);
        float rain_y = fract(rain_seed * 2.7 - time * (0.08 + rain_seed * 0.035));
        float rain_dy = min(abs(rain_local.y - rain_y), 1.0 - abs(rain_local.y - rain_y));
        float rain_dx = abs(rain_local.x - (0.16 + rain_seed * 0.68) + rain_dy * 0.28);
        float streak = exp(-rain_dx * 95.0) * exp(-rain_dy * 17.0);
        float rain_bank = smoothstep(0.42, 0.82, mist_noise(point * 2.0 + vec2(time * 0.007, 0.0)));
        accumulated += mix(u_secondary, u_accent, rain_seed) * streak * rain_bank * 0.2 * field_strength;
        coverage += streak * rain_bank * 0.07;
      } else {
        vec2 ripple_grid = point * vec2(13.0, 10.0);
        vec2 ripple_cell = floor(ripple_grid);
        vec2 ripple_local = fract(ripple_grid) - 0.5;
        float ripple_seed = hash21(ripple_cell);
        float ripple_phase = fract(time * (0.028 + ripple_seed * 0.018) + ripple_seed * 3.7);
        float ripple_radius = ripple_phase * 0.62;
        float ripple = exp(-abs(length(ripple_local) - ripple_radius) * 92.0) * (1.0 - ripple_phase);
        float drop = exp(-length(ripple_local) * 82.0) * smoothstep(0.08, 0.0, ripple_phase);
        accumulated += mix(u_accent, u_secondary, ripple_seed) * (ripple * 0.13 + drop * 0.18) * field_strength;
        coverage += ripple * 0.05 + drop * 0.07;
      }

      float vignette = 1.0 - smoothstep(0.22, 1.04, length(point * vec2(0.84, 1.0)));
      vec3 sea = ocean_silk(uv, time);
      vec3 light = accumulated * vignette + sea;
      float output_alpha = clamp(0.72 + coverage * 0.16, 0.0, 0.9);
      out_color = vec4(light, output_alpha);
    }
  `;

  try {
    const vertex = compileAtmosphereShader(atmosphereGl.VERTEX_SHADER, vertexSource);
    const fragment = compileAtmosphereShader(atmosphereGl.FRAGMENT_SHADER, fragmentSource);
    const program = atmosphereGl.createProgram();
    atmosphereGl.attachShader(program, vertex);
    atmosphereGl.attachShader(program, fragment);
    atmosphereGl.linkProgram(program);
    atmosphereGl.deleteShader(vertex);
    atmosphereGl.deleteShader(fragment);
    if (!atmosphereGl.getProgramParameter(program, atmosphereGl.LINK_STATUS)) {
      throw new Error(atmosphereGl.getProgramInfoLog(program) || "unknown program error");
    }
    atmosphereWebglProgram = program;
    atmosphereWebglPositionBuffer = atmosphereGl.createBuffer();
    atmosphereGl.bindBuffer(atmosphereGl.ARRAY_BUFFER, atmosphereWebglPositionBuffer);
    atmosphereGl.bufferData(
      atmosphereGl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      atmosphereGl.STATIC_DRAW,
    );
    atmosphereWebglLocations = {
      position: atmosphereGl.getAttribLocation(program, "a_position"),
      resolution: atmosphereGl.getUniformLocation(program, "u_resolution"),
      time: atmosphereGl.getUniformLocation(program, "u_time"),
      anchor: atmosphereGl.getUniformLocation(program, "u_anchor"),
      hubs: atmosphereGl.getUniformLocation(program, "u_hubs[0]"),
      strengths: atmosphereGl.getUniformLocation(program, "u_strengths[0]"),
      hubCount: atmosphereGl.getUniformLocation(program, "u_hub_count"),
      theme: atmosphereGl.getUniformLocation(program, "u_theme"),
      accent: atmosphereGl.getUniformLocation(program, "u_accent"),
      secondary: atmosphereGl.getUniformLocation(program, "u_secondary"),
      fieldStrength: atmosphereGl.getUniformLocation(program, "u_field_strength"),
      oceanLand: atmosphereGl.getUniformLocation(program, "u_ocean_land"),
      oceanReady: atmosphereGl.getUniformLocation(program, "u_ocean_ready"),
      geoView: atmosphereGl.getUniformLocation(program, "u_geo_view"),
    };
    atmosphereOceanMask = createOceanMask(atmosphereGl);
    atmosphereWebglCanvas.dataset.estatWebglState = "active";
    atmosphereWebglCanvas.dataset.estatWebglFlashCadence = "none";
    return true;
  } catch (error) {
    console.warn(error);
    atmosphereWebglProgram = null;
    atmosphereWebglCanvas.dataset.estatWebglState = "fallback-2d";
    return false;
  }
};

const colorComponents = (hex) => {
  const match = String(hex || "").match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu);
  if (!match) return [0.5, 0.8, 1];
  return match.slice(1).map((component) => Number.parseInt(component, 16) / 255);
};

const renderAtmosphereWebgl = (timestamp, currentProjection, values) => {
  if (!atmosphereWebglCanvas) return;
  const exhibit = currentExhibit();
  const theme = ESTAT_WEBGL_THEMES[exhibit.key];
  if (!theme) {
    atmosphereWebglCanvas.hidden = true;
    return;
  }
  atmosphereWebglCanvas.hidden = false;
  if (!initializeAtmosphereWebgl()) return;
  if (atmosphereGl.isContextLost()) return;
  const rect = currentProjection.rect;
  const dpr = Math.min(devicePixelRatio || 1, 1.15);
  const targetWidth = Math.max(1, rect.width * dpr);
  const targetHeight = Math.max(1, rect.height * dpr);
  const maximumPixels = rect.width <= 720 ? 420_000 : 1_200_000;
  const resolutionScale = Math.min(1, Math.sqrt(maximumPixels / (targetWidth * targetHeight)));
  const width = Math.max(1, Math.round(targetWidth * resolutionScale));
  const height = Math.max(1, Math.round(targetHeight * resolutionScale));
  const resized = atmosphereWebglCanvas.width !== width || atmosphereWebglCanvas.height !== height;
  const selectedCode = String(selectedIndex + 1).padStart(2, "0");
  const selectionChanged = atmosphereWebglCanvas.dataset.estatWebglSelectedCode !== selectedCode;
  const themeChanged = atmosphereWebglCanvas.dataset.estatWebglTheme !== exhibit.key;
  if (!resized && !selectionChanged && !themeChanged && timestamp - atmosphereWebglLastRenderAt < 1000 / 30) return;
  atmosphereWebglLastRenderAt = timestamp;
  if (resized) {
    atmosphereWebglCanvas.width = width;
    atmosphereWebglCanvas.height = height;
  }

  const projectNormalized = (index) => {
    const [x, y] = project(OBSERVATION_CITIES[index], currentProjection);
    return [clamp01(x / rect.width), clamp01(1 - y / rect.height)];
  };
  const transition = ease((timestamp - atmosphereAnchorChangedAt) / ESTAT_WEBGL_ANCHOR_TRANSITION_MS);
  const from = projectNormalized(atmosphereAnchorPreviousIndex);
  const to = projectNormalized(selectedIndex);
  const anchor = [
    from[0] + (to[0] - from[0]) * transition,
    from[1] + (to[1] - from[1]) * transition,
  ];
  const hubs = values
    .map((value, index) => ({ value, index, strength: normalizedValue(value, exhibit) }))
    .filter(({ value, index }) => Number.isFinite(value) && index !== selectedIndex)
    .sort((left, right) => right.strength - left.strength)
    .slice(0, ESTAT_WEBGL_HUB_COUNT);
  const hubPoints = new Float32Array(ESTAT_WEBGL_HUB_COUNT * 2);
  const hubStrengths = new Float32Array(ESTAT_WEBGL_HUB_COUNT);
  hubs.forEach((hub, index) => {
    hubPoints.set(projectNormalized(hub.index), index * 2);
    hubStrengths[index] = hub.strength;
  });
  const normalizedValues = values
    .filter(Number.isFinite)
    .map((value) => normalizedValue(value, exhibit));
  const fieldStrength = normalizedValues.length
    ? normalizedValues.reduce((sum, value) => sum + value, 0) / normalizedValues.length
    : 0.5;
  const accent = colorComponents(exhibit.accent);
  const secondary = colorComponents(exhibit.secondary);

  atmosphereGl.viewport(0, 0, width, height);
  atmosphereGl.clearColor(0, 0, 0, 0);
  atmosphereGl.clear(atmosphereGl.COLOR_BUFFER_BIT);
  atmosphereGl.useProgram(atmosphereWebglProgram);
  atmosphereGl.bindBuffer(atmosphereGl.ARRAY_BUFFER, atmosphereWebglPositionBuffer);
  atmosphereGl.enableVertexAttribArray(atmosphereWebglLocations.position);
  atmosphereGl.vertexAttribPointer(atmosphereWebglLocations.position, 2, atmosphereGl.FLOAT, false, 0, 0);
  atmosphereGl.uniform2f(atmosphereWebglLocations.resolution, width, height);
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  atmosphereGl.uniform1f(atmosphereWebglLocations.time, reducedMotion ? 0 : timestamp / 1000);
  atmosphereGl.uniform2f(atmosphereWebglLocations.anchor, anchor[0], anchor[1]);
  atmosphereGl.uniform2fv(atmosphereWebglLocations.hubs, hubPoints);
  atmosphereGl.uniform1fv(atmosphereWebglLocations.strengths, hubStrengths);
  atmosphereGl.uniform1i(atmosphereWebglLocations.hubCount, hubs.length);
  atmosphereGl.uniform1i(atmosphereWebglLocations.theme, theme.index);
  atmosphereGl.uniform3fv(atmosphereWebglLocations.accent, accent);
  atmosphereGl.uniform3fv(atmosphereWebglLocations.secondary, secondary);
  atmosphereGl.uniform1f(atmosphereWebglLocations.fieldStrength, fieldStrength);
  atmosphereGl.activeTexture(atmosphereGl.TEXTURE0);
  atmosphereGl.bindTexture(atmosphereGl.TEXTURE_2D, atmosphereOceanMask.texture);
  atmosphereGl.uniform1i(atmosphereWebglLocations.oceanLand, 0);
  atmosphereGl.uniform1f(atmosphereWebglLocations.oceanReady, atmosphereOceanMask.ready ? 1 : 0);
  atmosphereGl.uniform4f(atmosphereWebglLocations.geoView,
    EARTH_CENTER_LONGITUDE - 180 - currentProjection.originX / currentProjection.scale,
    90 + currentProjection.originY / currentProjection.scale,
    rect.width / currentProjection.scale, rect.height / currentProjection.scale);
  atmosphereGl.drawArrays(atmosphereGl.TRIANGLES, 0, 6);
  atmosphereWebglCanvas.dataset.estatWebglHubCount = String(hubs.length);
  atmosphereWebglCanvas.dataset.estatWebglAnchorProgress = transition.toFixed(3);
  atmosphereWebglCanvas.dataset.estatWebglSelectedCode = selectedCode;
  atmosphereWebglCanvas.dataset.estatWebglResolutionScale = resolutionScale.toFixed(3);
  atmosphereWebglCanvas.dataset.estatWebglTargetFps = "30";
  atmosphereWebglCanvas.dataset.estatWebglTheme = exhibit.key;
  atmosphereWebglCanvas.dataset.estatWebglVisual = theme.visual;
  atmosphereWebglCanvas.dataset.estatWebglMotion = "spatial-continuous-non-pulsing";
  atmosphereWebglCanvas.dataset.estatWebglFieldStrength = fieldStrength.toFixed(3);
  atmosphereWebglCanvas.dataset.estatOceanStyle = "geographic-flowing-silk";
  atmosphereWebglCanvas.dataset.estatOceanMask = atmosphereOceanMask.state;
  atmosphereWebglCanvas.dataset.estatOceanTime = (reducedMotion ? 0 : timestamp / 1000).toFixed(3);
  atmosphereWebglCanvas.dataset.estatOceanFrame = String(Number(atmosphereWebglCanvas.dataset.estatOceanFrame || 0) + 1);
  layer.dataset.estatAmbientVisual = theme.visual;
  layer.dataset.estatAmbientMotion = "spatial-continuous-non-pulsing";
  layer.dataset.estatAmbientFlashCadence = "none";
  if (exhibit.key === "lodging") {
    layer.dataset.estatLodgingVisual = "webgl-continuous-route-field";
    layer.dataset.estatLodgingFlashCadence = "none";
  } else {
    delete layer.dataset.estatLodgingVisual;
    delete layer.dataset.estatLodgingFlashCadence;
  }
};

const drawMigration = (x, y, value, strength, selected, time) => {
  const positive = value >= 0;
  const color = positive ? "101,245,223" : "255,130,120";
  const direction = positive ? -1 : 1;
  const radius = 6 + strength * 19;
  context.save();
  context.translate(x, y);
  context.rotate(direction * (0.35 + Math.sin(time * 0.0005 + x) * 0.18));
  context.lineCap = "round";
  for (let ring = 0; ring < 3; ring += 1) {
    context.beginPath();
    context.arc(0, 0, radius + ring * 4, -2.55 + ring * 0.25, 0.65 + ring * 0.18);
    context.strokeStyle = `rgba(${color},${0.15 + strength * 0.34 + (selected ? 0.18 : 0)})`;
    context.lineWidth = Math.max(1, 1.2 + strength * 2.4 - ring * 0.45);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(direction * -radius * 0.8, 0);
  context.quadraticCurveTo(0, Math.sin(time * 0.001 + y) * 7, direction * radius * 0.78, 0);
  context.strokeStyle = `rgba(${color},${0.32 + strength * 0.56})`;
  context.lineWidth = 1.5 + strength * 3.5;
  context.stroke();
  context.restore();
};

const drawLodging = (x, y, strength, selected, time) => {
  const independentBreath = 0.96 + Math.sin(time * 0.00034 + x * 0.027 + y * 0.019) * 0.04;
  const radius = (4 + strength * 18 + (selected ? 1.5 : 0)) * independentBreath;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius * 2.2);
  gradient.addColorStop(0, `rgba(255,238,170,${0.65 + strength * 0.3})`);
  gradient.addColorStop(0.35, `rgba(255,184,102,${0.28 + strength * 0.25})`);
  gradient.addColorStop(1, "rgba(255,116,194,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius * 2.2, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = `rgba(255,215,125,${0.24 + strength * 0.6})`;
  context.lineWidth = 1 + strength * 2;
  for (let petal = 0; petal < 3; petal += 1) {
    const angle = time * 0.0001 + petal * Math.PI * 2 / 3 + x * 0.002;
    context.beginPath();
    context.arc(x + Math.cos(angle) * radius * 0.4, y + Math.sin(angle) * radius * 0.4, radius * (0.65 + petal * 0.08), angle, angle + 1.8);
    context.stroke();
  }
};

const drawHousing = (x, y, strength, selected, time) => {
  const height = 8 + strength * 38;
  const sway = Math.sin(time * 0.00055 + x * 0.03) * (1.5 + strength * 2);
  context.save();
  context.translate(x, y);
  context.lineCap = "round";
  const gradient = context.createLinearGradient(0, 0, 0, -height);
  gradient.addColorStop(0, `rgba(129,230,255,${0.3 + strength * 0.4})`);
  gradient.addColorStop(1, `rgba(196,255,145,${0.62 + strength * 0.34})`);
  context.strokeStyle = gradient;
  context.lineWidth = 1.2 + strength * 3.4 + (selected ? 1 : 0);
  context.beginPath();
  context.moveTo(0, 3);
  context.bezierCurveTo(-sway, -height * 0.32, sway, -height * 0.68, sway * 0.45, -height);
  context.stroke();
  context.lineWidth *= 0.55;
  context.beginPath();
  context.moveTo(0, -height * 0.48);
  context.quadraticCurveTo(-height * 0.22, -height * 0.58, -height * 0.27, -height * 0.72);
  context.moveTo(sway * 0.25, -height * 0.7);
  context.quadraticCurveTo(height * 0.2, -height * 0.78, height * 0.23, -height * 0.91);
  context.stroke();
  context.restore();
};

const rgb = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${value >> 16},${(value >> 8) & 255},${value & 255}`;
};

const HEATMAP_PALETTES = Object.freeze({
  migration: [[0, [225, 79, 94]], [0.48, [77, 48, 103]], [0.52, [25, 86, 112]], [1, [55, 239, 202]]],
  lodging: [[0, [76, 56, 153]], [0.25, [43, 119, 195]], [0.5, [39, 182, 184]], [0.75, [182, 217, 98]], [1, [255, 230, 136]]],
  housing: [[0, [36, 62, 116]], [0.42, [57, 164, 187]], [0.72, [118, 224, 183]], [1, [223, 244, 124]]],
  thermal: [[0, [42, 74, 178]], [0.3, [42, 175, 206]], [0.54, [101, 218, 173]], [0.74, [248, 213, 100]], [0.88, [246, 130, 78]], [1, [205, 54, 91]]],
  heat: [[0, [60, 69, 163]], [0.42, [223, 83, 123]], [0.72, [255, 142, 76]], [1, [255, 229, 113]]],
  frost: [[0, [35, 52, 131]], [0.36, [68, 120, 210]], [0.68, [117, 220, 236]], [1, [229, 246, 255]]],
  humidity: [[0, [45, 63, 135]], [0.38, [50, 135, 190]], [0.7, [70, 209, 192]], [1, [180, 247, 191]]],
  sunshine: [[0, [62, 64, 139]], [0.44, [219, 100, 120]], [0.74, [255, 167, 83]], [1, [255, 236, 141]]],
  rainfall: [[0, [48, 49, 135]], [0.42, [51, 102, 190]], [0.72, [54, 190, 221]], [1, [146, 245, 222]]],
  "rain-days": [[0, [62, 55, 139]], [0.42, [92, 105, 211]], [0.72, [92, 195, 220]], [1, [135, 241, 207]]],
});

const paletteFor = (exhibit) => HEATMAP_PALETTES[exhibit.key]
  || HEATMAP_PALETTES[exhibit.visual]
  || HEATMAP_PALETTES.thermal;

const heatmapRatio = (value, exhibit) => {
  if (!Number.isFinite(value)) return null;
  const range = valueRangeFor(exhibit);
  if (exhibit.key === "migration") return clamp01(0.5 + value / (range.absolute * 2));
  // Lodging counts are strongly skewed. Use one all-year log colour scale,
  // shared with the legend marker; never rescale each year's ranks separately.
  if (exhibit.key === "lodging") return metricLegendProgress(value, range.minimum, range.maximum, "log") ?? 0;
  if (exhibit.scaleMode === "cold") {
    return clamp01((range.maximum - value) / Math.max(0.001, range.maximum - range.minimum));
  }
  return clamp01((value - range.minimum) / Math.max(0.001, range.maximum - range.minimum));
};

const interpolatePalette = (palette, ratio) => {
  const clamped = clamp01(ratio);
  const upperIndex = palette.findIndex(([stop]) => stop >= clamped);
  if (upperIndex <= 0) return palette[0][1];
  const [upperStop, upperColor] = palette[upperIndex];
  const [lowerStop, lowerColor] = palette[upperIndex - 1];
  const mix = (clamped - lowerStop) / Math.max(0.0001, upperStop - lowerStop);
  return lowerColor.map((channel, index) => Math.round(channel + (upperColor[index] - channel) * mix));
};

const paletteCss = (palette) => `linear-gradient(90deg, ${palette
  .map(([stop, color]) => `rgb(${color.join(" ")}) ${Math.round(stop * 100)}%`)
  .join(", ")})`;

const legendPaletteFor = (exhibit, range) => {
  const palette = paletteFor(exhibit);
  const start = heatmapRatio(range.minimum, exhibit);
  const end = heatmapRatio(range.maximum, exhibit);
  // Show low → high values while keeping the exact map colors, including
  // the reversed cold scale and the asymmetric, zero-centred migration scale.
  if (start === end) return [[0, interpolatePalette(palette, start)], [1, interpolatePalette(palette, end)]];
  return [[0, interpolatePalette(palette, start)],
    ...palette.filter(([stop]) => stop > Math.min(start, end) && stop < Math.max(start, end))
      .map(([stop, color]) => [(stop - start) / (end - start), color]),
    [1, interpolatePalette(palette, end)]].sort((a, b) => a[0] - b[0]);
};

const drawPrefectureHeatmap = (currentProjection, values, exhibit, timestamp) => {
  if (prefectureShapes.length !== 47) {
    canvas.dataset.estatHeatmap = "loading";
    return;
  }
  const palette = paletteFor(exhibit);
  let valueCount = 0;
  let missingCount = 0;
  context.save();
  context.translate(currentProjection.originX, currentProjection.originY);
  context.scale(currentProjection.scale, currentProjection.scale);
  prefectureShapes.forEach((shape) => {
    const value = values[shape.index];
    const ratio = heatmapRatio(value, exhibit);
    if (ratio === null) {
      missingCount += 1;
      context.fillStyle = "rgba(46,61,78,0.72)";
    } else {
      valueCount += 1;
      const color = interpolatePalette(palette, ratio);
      const selected = shape.index === selectedIndex;
      const ordinaryAlpha = 0.64 + ratio * 0.2;
      const selectedAlpha = exhibit.key === "lodging"
        ? Math.min(0.86, ordinaryAlpha + 0.07)
        : 0.92;
      context.fillStyle = `rgba(${color.join(",")},${selected ? selectedAlpha : ordinaryAlpha})`;
    }
    context.fill(shape.path, "evenodd");
    context.strokeStyle = shape.index === selectedIndex
      ? "rgba(247,255,250,0.98)"
      : "rgba(220,255,246,0.5)";
    context.lineWidth = (shape.index === selectedIndex ? 2.25 : 0.72) / currentProjection.scale;
    context.stroke(shape.path);
  });

  const selectedShape = prefectureShapes[selectedIndex];
  if (selectedShape) {
    const lodging = exhibit.key === "lodging";
    const shimmer = lodging
      ? 0.68 + Math.sin(timestamp * 0.00038 + selectedIndex * 0.73) * 0.035
      : 0.72 + Math.sin(timestamp * 0.0022) * 0.16;
    context.save();
    context.shadowColor = `rgba(255,255,238,${shimmer})`;
    context.shadowBlur = lodging ? 3 : 8;
    context.strokeStyle = `rgba(255,255,245,${0.66 + shimmer * 0.16})`;
    context.lineWidth = (lodging ? 1.72 : 2.45) / currentProjection.scale;
    context.stroke(selectedShape.path);
    context.restore();
  }
  context.restore();
  canvas.dataset.estatHeatmap = "prefecture-choropleth";
  canvas.dataset.estatHeatmapShapeCount = String(prefectureShapes.length);
  canvas.dataset.estatHeatmapValueCount = String(valueCount);
  canvas.dataset.estatHeatmapMissingCount = String(missingCount);
  canvas.dataset.estatHeatmapSelectedCode = String(selectedIndex + 1).padStart(2, "0");
  canvas.dataset.estatHeatmapScale = exhibit.key === "lodging" ? "log" : "linear";
  const selectedRatio = heatmapRatio(values[selectedIndex], exhibit);
  canvas.dataset.estatHeatmapSelectedRatio = selectedRatio === null ? "" : String(selectedRatio);
  canvas.dataset.estatHeatmapSelectedColor = selectedRatio === null ? "missing" : interpolatePalette(palette, selectedRatio).join(",");
};

const drawNature = (x, y, strength, selected, time, exhibit, index) => {
  const phase = time * 0.00034 + index * 1.731;
  const breath = 0.82 + Math.sin(phase) * 0.08;
  const radius = (5 + strength * 19) * breath + (selected ? 3 : 0);
  const primary = rgb(exhibit.accent);
  const secondary = rgb(exhibit.secondary);
  const glow = context.createRadialGradient(x, y, 0, x, y, radius * 2.25);
  glow.addColorStop(0, `rgba(${primary},${0.34 + strength * 0.28})`);
  glow.addColorStop(0.32, `rgba(${secondary},${0.12 + strength * 0.16})`);
  glow.addColorStop(1, `rgba(${primary},0)`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius * 2.25, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(x, y);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = `rgba(${primary},${0.34 + strength * 0.48})`;
  context.fillStyle = `rgba(${secondary},${0.34 + strength * 0.44})`;

  if (exhibit.visual === "thermal") {
    for (let ring = 0; ring < 3; ring += 1) {
      const r = radius * (0.56 + ring * 0.28);
      context.lineWidth = 0.9 + strength * 1.8 - ring * 0.15;
      context.beginPath();
      context.ellipse(Math.sin(phase + ring) * 1.5, 0, r * (1.08 + ring * 0.04), r * 0.62, phase * 0.12 + ring * 0.36, 0.18, Math.PI * 1.82);
      context.stroke();
    }
    context.fillStyle = `rgba(${secondary},${0.55 + strength * 0.34})`;
    context.beginPath();
    context.arc(0, 0, 2.2 + strength * 3.1, 0, Math.PI * 2);
    context.fill();
  } else if (exhibit.visual === "heat" || exhibit.visual === "sunshine") {
    const rays = exhibit.visual === "sunshine" ? 12 : 8;
    context.rotate(phase * (exhibit.visual === "sunshine" ? 0.08 : 0.14));
    for (let ray = 0; ray < rays; ray += 1) {
      const angle = ray * Math.PI * 2 / rays;
      const inner = radius * (0.32 + (ray % 2) * 0.1);
      const outer = radius * (0.82 + strength * 0.38 + (ray % 3) * 0.1);
      context.lineWidth = 0.8 + strength * (exhibit.visual === "sunshine" ? 1.5 : 2.2);
      context.beginPath();
      context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      context.quadraticCurveTo(
        Math.cos(angle + 0.09) * outer * 0.72,
        Math.sin(angle + 0.09) * outer * 0.72,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer,
      );
      context.stroke();
    }
    context.fillStyle = `rgba(${secondary},${0.52 + strength * 0.42})`;
    context.beginPath();
    context.arc(0, 0, radius * (exhibit.visual === "sunshine" ? 0.32 : 0.4), 0, Math.PI * 2);
    context.fill();
  } else if (exhibit.visual === "frost") {
    context.rotate(phase * 0.08);
    for (let branch = 0; branch < 6; branch += 1) {
      context.save();
      context.rotate(branch * Math.PI / 3);
      context.lineWidth = 0.75 + strength * 1.45;
      context.beginPath();
      context.moveTo(radius * 0.12, 0);
      context.lineTo(radius, 0);
      const fork = radius * 0.57;
      context.moveTo(fork, 0);
      context.lineTo(fork + radius * 0.2, -radius * 0.16);
      context.moveTo(fork, 0);
      context.lineTo(fork + radius * 0.2, radius * 0.16);
      context.stroke();
      context.restore();
    }
  } else if (exhibit.visual === "humidity") {
    for (let layerIndex = 0; layerIndex < 3; layerIndex += 1) {
      const r = radius * (0.42 + layerIndex * 0.3);
      context.lineWidth = 1 + strength * 1.7;
      context.beginPath();
      context.ellipse(Math.sin(phase + layerIndex) * 2, Math.cos(phase * 0.7 + layerIndex) * 1.4, r * 1.15, r * 0.52, -0.25 + layerIndex * 0.2, 0.16, Math.PI * 1.84);
      context.stroke();
    }
    context.beginPath();
    context.arc(Math.cos(phase) * radius * 0.42, Math.sin(phase) * radius * 0.24, 1.8 + strength * 2.2, 0, Math.PI * 2);
    context.fill();
  } else if (exhibit.visual === "rainfall") {
    for (let drop = -2; drop <= 2; drop += 1) {
      const dx = drop * radius * 0.28;
      const shift = ((phase * 7 + drop * 0.37) % 1) * radius * 0.8;
      context.lineWidth = 0.9 + strength * 1.7;
      context.beginPath();
      context.moveTo(dx + radius * 0.16, -radius * 0.82 + shift);
      context.lineTo(dx - radius * 0.12, -radius * 0.2 + shift);
      context.stroke();
    }
    context.beginPath();
    context.ellipse(0, radius * 0.58, radius * 0.84, radius * 0.28, 0, 0.2, Math.PI * 1.8);
    context.stroke();
  } else {
    for (let ring = 0; ring < 4; ring += 1) {
      const r = radius * (0.3 + ring * 0.23);
      context.globalAlpha = 0.92 - ring * 0.15;
      context.lineWidth = 0.8 + strength * 1.35;
      context.beginPath();
      context.ellipse(0, ring * 0.8, r, r * 0.38, Math.sin(phase + ring) * 0.12, 0.12, Math.PI * 1.88);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.beginPath();
    context.moveTo(0, -radius * 0.82);
    context.quadraticCurveTo(radius * 0.3, -radius * 0.3, 0, radius * 0.02);
    context.quadraticCurveTo(-radius * 0.3, -radius * 0.3, 0, -radius * 0.82);
    context.fill();
  }
  context.restore();
};

const hidePrefectureRegionTooltip = () => {
  hoveredPrefectureIndex = -1;
  prefectureTooltipPointer = null;
  if (prefectureRegionTooltip) prefectureRegionTooltip.hidden = true;
};

const showPrefectureRegionTooltip = (index, event) => {
  if (!prefectureRegionTooltip || !usesPrefectureRegions()) return;
  const city = OBSERVATION_CITIES[index];
  const exhibit = currentExhibit();
  const value = valuesFor()[index];
  const mapRect = map.getBoundingClientRect();
  let x = Number(event?.clientX) - mapRect.left;
  let y = Number(event?.clientY) - mapRect.top;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const currentProjection = projection();
    [x, y] = currentProjection ? project(city, currentProjection) : [mapRect.width / 2, mapRect.height / 2];
  }
  setTextIfChanged(prefectureRegionTooltip.querySelector("small"), `${currentPeriod()} · ${exhibit.provider || "e-Stat"}`);
  setTextIfChanged(prefectureRegionTooltip.querySelector("strong"), formatPrefecturePlace(city.prefecture, observationStationFor(index)?.station));
  setTextIfChanged(prefectureRegionTooltip.querySelector("b"), `${exhibit.valueLabel}　${formatNumber(value, exhibit.key === "migration", exhibit.decimals || 0)} ${Number.isFinite(value) ? exhibit.unit : ""}`.trim());
  // Position using the displayed language, before reading the tooltip bounds.
  window.GaiaI18n?.translate(prefectureRegionTooltip);
  prefectureRegionTooltip.style.left = `${Math.max(84, Math.min(mapRect.width - 84, x))}px`;
  prefectureRegionTooltip.style.top = `${Math.max(78, Math.min(mapRect.height - 136, y))}px`;
  prefectureRegionTooltip.hidden = false;
  const labelBox = prefectureRegionTooltip.getBoundingClientRect();
  const shiftX = Math.max(mapRect.left + 12 - labelBox.left, Math.min(0, mapRect.right - 12 - labelBox.right));
  const shiftY = Math.max(mapRect.top + 12 - labelBox.top, Math.min(0, mapRect.bottom - 12 - labelBox.bottom));
  prefectureRegionTooltip.style.left = `${parseFloat(prefectureRegionTooltip.style.left) + shiftX}px`;
  prefectureRegionTooltip.style.top = `${parseFloat(prefectureRegionTooltip.style.top) + shiftY}px`;
};

const syncPrefectureRegionPaths = () => {
  if (!prefectureRegionGroup || prefectureShapes.length !== 47 || prefectureRegionPaths.length === 47) return;
  prefectureRegionGroup.replaceChildren();
  prefectureRegionPaths = prefectureShapes.map((shape) => {
    const region = document.createElementNS("http://www.w3.org/2000/svg", "path");
    region.classList.add("gaia-estat-prefecture-region");
    region.dataset.estatPrefecture = shape.code;
    region.setAttribute("d", shape.svgPath);
    region.setAttribute("fill-rule", "evenodd");
    region.setAttribute("clip-rule", "evenodd");
    region.setAttribute("role", "button");
    region.setAttribute("tabindex", "0");
    region.setAttribute("aria-current", "false");
    region.addEventListener("pointerdown", (event) => { event.stopPropagation(); pausePlayback(); });
    const preview = (event) => {
      hoveredPrefectureIndex = shape.index;
      prefectureTooltipPointer = event.type === "focus" ? null : { clientX: event.clientX, clientY: event.clientY };
      showPrefectureRegionTooltip(shape.index, prefectureTooltipPointer);
    };
    region.addEventListener("pointerenter", preview);
    region.addEventListener("pointermove", preview);
    region.addEventListener("pointerleave", hidePrefectureRegionTooltip);
    region.addEventListener("focus", preview);
    region.addEventListener("blur", hidePrefectureRegionTooltip);
    region.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectPrefecture(shape.index);
      showPrefectureRegionTooltip(shape.index, event);
    });
    region.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPrefecture(shape.index);
        showPrefectureRegionTooltip(shape.index, event);
      }
    });
    prefectureRegionGroup.append(region);
    return region;
  });
};

const updatePrefectureRegions = (currentProjection, interpolatedValues) => {
  syncPrefectureRegionPaths();
  if (!prefectureRegionLayer || !prefectureRegionGroup) return;
  const { rect, scale, originX, originY } = currentProjection;
  setAttributeIfChanged(prefectureRegionLayer, "viewBox", `0 0 ${rect.width} ${rect.height}`);
  setAttributeIfChanged(prefectureRegionGroup, "transform", `translate(${originX} ${originY}) scale(${scale})`);
  const exhibit = currentExhibit();
  prefectureRegionPaths.forEach((region, index) => {
    const value = interpolatedValues[index];
    const city = OBSERVATION_CITIES[index];
    setAttributeIfChanged(region, "aria-current", index === selectedIndex);
    setAttributeIfChanged(region, "aria-label", `${city.code} ${city.prefecture}、${exhibit.valueLabel} ${formatNumber(value, exhibit.key === "migration", exhibit.decimals || 0)} ${Number.isFinite(value) ? exhibit.unit : "欠測"}`);
  });
  // Keep the chosen prefecture's values visible while the visitor scrubs years.
  if (hoveredPrefectureIndex >= 0) showPrefectureRegionTooltip(hoveredPrefectureIndex, prefectureTooltipPointer);
  else if (exhibit.key === "migration" || !playbackEnabled) showPrefectureRegionTooltip(selectedIndex);
};

const updateMarkers = (currentProjection, interpolatedValues) => {
  const exhibit = currentExhibit();
  const periodLabel = `${formatPeriodJa(currentPeriod())} · ${exhibit.provider || "e-Stat"}`;
  markerButtons.forEach((button, index) => {
    const city = OBSERVATION_CITIES[index];
    const [x, y, rect] = project(city, currentProjection);
    const visible = x >= -20 && x <= rect.width + 20 && y >= -28 && y <= rect.height + 28;
    if (button.hidden !== !visible) button.hidden = !visible;
    setStyleIfChanged(button, "left", `${x}px`);
    setStyleIfChanged(button, "top", `${y}px`);
    const value = interpolatedValues[index];
    const missing = !Number.isFinite(value);
    const strength = normalizedValue(value, exhibit);
    button.classList.toggle("is-missing", missing);
    setStyleIfChanged(button, "--estat-strength", strength.toFixed(3));
    setStyleIfChanged(button, "--estat-marker-size", `${(14 + strength * 12).toFixed(2)}px`);
    setStyleIfChanged(button, "--estat-core-size", `${(5 + strength * 7).toFixed(2)}px`);
    setStyleIfChanged(button, "--estat-glow-size", `${(8 + strength * 18).toFixed(2)}px`);
    setAttributeIfChanged(button, "aria-current", index === selectedIndex);
    setTextIfChanged(button.querySelector("b"), `${exhibit.valueLabel}　${formatNumber(value, exhibit.key === "migration", exhibit.decimals || 0)} ${missing ? "" : exhibit.unit}`.trim());
    setTextIfChanged(button.querySelector("small"), periodLabel);
  });
};

const draw = (timestamp = performance.now()) => {
  if (activeIndex < 0 || !series || document.hidden) {
    frame = 0;
    return;
  }
  const rect = syncCanvas();
  const currentProjection = projection(rect);
  if (!currentProjection) {
    frame = requestAnimationFrame(draw);
    return;
  }
  context.clearRect(0, 0, rect.width, rect.height);
  const backdrop = context.createRadialGradient(
    rect.width * 0.55,
    rect.height * 0.46,
    Math.min(rect.width, rect.height) * 0.08,
    rect.width * 0.55,
    rect.height * 0.46,
    Math.max(rect.width, rect.height) * 0.74,
  );
  // A nearly opaque navy wash used to erase the surrounding continents.
  // Keep the base geography visible under a light, warm atmospheric tint.
  backdrop.addColorStop(0, "rgba(239,206,146,0.055)");
  backdrop.addColorStop(1, "rgba(19,44,43,0.14)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, rect.width, rect.height);
  const progress = ease((timestamp - transitionStartedAt) / TRANSITION_MS);
  const from = valuesFor(previousPeriodIndex);
  const to = valuesFor(periodIndex);
  const values = to.map((value, index) => {
    const previous = from[index];
    if (!Number.isFinite(value)) return null;
    if (!Number.isFinite(previous)) return value;
    return previous + (value - previous) * progress;
  });
  const exhibit = currentExhibit();
  drawPrefectureHeatmap(currentProjection, values, exhibit, timestamp);
  renderAtmosphereWebgl(timestamp, currentProjection, values);
  if (usesPrefectureRegions(exhibit)) {
    updatePrefectureRegions(currentProjection, values);
  } else {
    updateMarkers(currentProjection, values);
    values.forEach((value, index) => {
      const [x, y] = project(OBSERVATION_CITIES[index], currentProjection);
      if (x < -60 || x > rect.width + 60 || y < -60 || y > rect.height + 60) return;
      if (!Number.isFinite(value)) return;
      const strength = normalizedValue(value, exhibit);
      context.save();
      context.globalAlpha = exhibit.key === "lodging"
        ? (index === selectedIndex ? 0.78 : 0.26)
        : (index === selectedIndex ? 0.92 : 0.2);
      if (exhibit.key === "migration") drawMigration(x, y, value, strength, index === selectedIndex, timestamp);
      else if (exhibit.key === "lodging") drawLodging(x, y, strength, index === selectedIndex, timestamp);
      else if (exhibit.key === "housing") drawHousing(x, y, strength, index === selectedIndex, timestamp);
      else drawNature(x, y, strength, index === selectedIndex, timestamp, exhibit, index);
      context.restore();
    });
  }
  const periods = periodsFor();
  if (playbackEnabled && timestamp >= nextMonthAt && periods.length > 1) setPeriod((periodIndex + 1) % periods.length, { auto: true });
  if (playbackEnabled && timestamp >= nextPoiAt) selectPrefecture((selectedIndex + 1) % OBSERVATION_CITIES.length, { auto: true });
  frame = requestAnimationFrame(draw);
};

const renderReadout = () => {
  if (!readout || !series || activeIndex < 0) return;
  const exhibit = currentExhibit();
  const periods = periodsFor(exhibit);
  const values = valuesFor();
  const value = selectedValue();
  const previousValues = valuesFor(Math.max(0, periodIndex - 1));
  const previousValue = previousValues[selectedIndex];
  const longTermTemperature = LONG_TERM_TEMPERATURE_KEYS.has(exhibit.key);
  const baselineYear = periods[0];
  const baselineValue = valuesFor(0)[selectedIndex];
  const comparisonValue = exhibit.longTerm ? baselineValue : previousValue;
  const delta = periodIndex > 0 && Number.isFinite(value) && Number.isFinite(comparisonValue)
    ? value - comparisonValue
    : null;
  const trendPerDecade = selectedTemperatureTrendPerDecade(exhibit);
  const ordered = values.filter(Number.isFinite).sort((a, b) => b - a);
  const rank = Number.isFinite(value) ? ordered.indexOf(value) + 1 : null;
  const city = OBSERVATION_CITIES[selectedIndex];
  const station = observationStationFor(selectedIndex);
  const period = currentPeriod();
  layer.style.setProperty("--estat-accent", exhibit.accent);
  layer.style.setProperty("--estat-secondary", exhibit.secondary);
  readout.style.setProperty("--estat-accent", exhibit.accent);
  readout.style.setProperty("--estat-secondary", exhibit.secondary);
  readout.dataset.estatExhibit = exhibit.key;
  readout.dataset.estatPeriod = period;
  readout.dataset.estatSelectedCode = city.code;
  readout.querySelector("[data-estat-number]").textContent = exhibit.number;
  readout.querySelector("[data-estat-title]").textContent = exhibit.shortTitle;
  readout.querySelector("[data-map-bank-toggle]").setAttribute("aria-label", `${exhibit.number} ${exhibit.shortTitle}。展示一覧を開く`);
  readout.querySelector("[data-estat-place]").textContent = formatPrefecturePlace(city.prefecture, station?.station);
  readout.querySelector("[data-estat-value-label]").textContent = exhibit.valueLabel;
  readout.querySelector("[data-estat-unit]").textContent = exhibit.unit;
  animatePrimaryValue(value, exhibit);
  readout.querySelector("[data-estat-period]").textContent = formatPeriodJa(period);
  readout.querySelector("[data-estat-rank]").textContent = rank ? `${rank} / ${ordered.length}` : "欠測";
  readout.querySelector("[data-estat-delta]").textContent = delta === null ? (periodIndex === 0 ? "起点" : "比較不可") : `${formatNumber(delta, true, exhibit.decimals || 0)} ${exhibit.unit}`;
  readout.querySelector("[data-estat-frequency]").textContent = `${exhibit.provider || "e-Stat"} · ${exhibit.frequency.toUpperCase()}`;
  readout.querySelector(".gaia-estat-comparison span:first-child").childNodes[0].nodeValue = usesWeatherStations(exhibit) ? "観測地点順位" : "都道府県順位";
  readout.querySelector("[data-estat-delta-label]").childNodes[0].nodeValue = exhibit.longTerm
    ? `${baselineYear}年差`
    : exhibit.frequency === "年次" ? "前年差" : "前月差";
  readout.querySelector("[data-estat-caption]").textContent = `${exhibit.caption} 海の光と流れは抽象演出で、実測海流や人の移動経路ではありません。`;
  readout.querySelector("[data-estat-guide]").textContent = longTermTemperature && Number.isFinite(trendPerDecade)
    ? `${exhibit.guide} ${station?.station || city.city}の線形傾向は10年あたり${formatNumber(trendPerDecade, true, 2)}℃。`
    : exhibit.guide;
  const quality = qualityFlagFor(period);
  const qualityNote = series.unavailable ? "年次データを読み込めませんでした。月次値への置き換えは行いません。"
    : !Number.isFinite(value) ? quality?.flag === "insufficient" ? "この年は気象庁の資料不足値のため欠測扱いです。0や推定値には置き換えていません。" : "この年の値は未収録です。0や推定値には置き換えていません。"
    : quality?.flag === "quasi-normal" ? "この年は気象庁の準正常値です。品質情報を保持して表示しています。" : "";
  readout.querySelector("[data-estat-quality]").textContent = qualityNote;
  readout.querySelector("[data-estat-quality]").hidden = !qualityNote;
  readout.dataset.estatValueQuality = !Number.isFinite(value) ? "missing" : quality?.flag || "normal";
  readout.querySelector("[data-estat-analysis]").disabled = !periods.some((year, index) => Number.isFinite(valuesFor(index)[selectedIndex]));
  readout.dataset.estatCoverageStart = periods[0] || "";
  readout.dataset.estatCoverageEnd = periods.at(-1) || "";
  readout.dataset.estatPeriodCount = String(periods.length);
  readout.dataset.estatTrendPerDecade = Number.isFinite(trendPerDecade) ? trendPerDecade.toFixed(4) : "";
  readout.dataset.estatObservationStation = station?.station || "";
  const range = valueRangeFor(exhibit);
  const gradient = paletteCss(legendPaletteFor(exhibit, range));
  heatLegend.style.setProperty("--estat-heat-gradient", gradient);
  updateMetricLegend(heatLegend, {
    title: exhibit.valueLabel,
    scope: formatPrefecturePlace(city.prefecture, station?.station),
    period: formatPeriodJa(period),
    current: Number.isFinite(value) ? `${formatNumber(value, exhibit.key === "migration", exhibit.decimals || 0)} ${exhibit.unit}` : "欠測",
    value, minimum: range.minimum, maximum: range.maximum,
    minimumLabel: `${formatNumber(range.minimum, exhibit.key === "migration", exhibit.decimals || 0)} ${exhibit.unit}`,
    maximumLabel: `${formatNumber(range.maximum, exhibit.key === "migration", exhibit.decimals || 0)} ${exhibit.unit}`,
    gradient,
    scale: exhibit.key === "lodging" ? "log" : "linear",
    description: `${periods[0]}〜${periods.at(-1)}の47${usesWeatherStations(exhibit) ? "観測地点" : "都道府県"}に共通の色の範囲。針は選択中の値。`,
  });
  const scopeNote = exhibit.key === "migration" ? "日本人移動者のみ（外国人は含まない）"
    : exhibit.key === "lodging" ? "従業者10人以上の施設（小規模施設は含まない）"
    : usesWeatherStations(exhibit) ? "代表観測地点の値（県全域の平均ではない）" : "暦年の着工戸数（完成戸数ではない）";
  heatLegend.querySelector("[data-estat-history-note]").textContent = [
    series.unavailable ? "" : `${periods[0]}〜${periods.at(-1)}年 · ${scopeNote}`,
    exhibit.key === "lodging" ? "面の色は紫→青→青緑→黄の対数目盛。人数の値は変えていません。" : "",
    exhibit.key === "sunshineHours" ? "1986〜1990年に日照計変更。未補正の長期比較です。" : "",
    qualityNote,
  ].filter(Boolean).join(" ");
  readout.querySelector("[data-estat-mobile-history-note]").textContent = heatLegend.querySelector("[data-estat-history-note]").textContent;
  const slider = readout.querySelector("[data-estat-month]");
  slider.max = String(periods.length - 1);
  slider.value = String(periodIndex);
  slider.setAttribute("aria-valuetext", formatPeriodJa(period));
  slider.setAttribute("aria-label", exhibit.frequency === "年次" ? "表示年を選ぶ" : "表示月を選ぶ");
  const timelineTicks = readout.querySelector("[data-estat-months]");
  timelineTicks.classList.toggle("is-long-term", Boolean(exhibit.longTerm));
  timelineTicks.style.setProperty("--estat-period-count", String(periods.length));
  const labelGap = Math.ceil(28 * periods.length / Math.max(1, timelineTicks.clientWidth));
  timelineTicks.innerHTML = periods.map((entry, index) => {
    const showLongTermLabel = !exhibit.longTerm
      || index === 0
      || index === periods.length - 1
      || (Number(entry) % 10 === 0 && index >= labelGap && periods.length - 1 - index >= labelGap);
    const label = exhibit.frequency === "年次" ? (showLongTermLabel ? `${entry}年` : "") : `${entry.slice(5)}月`;
    return `<i class="${index === periodIndex ? "is-current" : ""}"><span>${label}</span></i>`;
  }).join("");
  readout.querySelector("[data-estat-step='-1']")?.setAttribute(
    "aria-label",
    `前の展示、${String(Number(exhibit.number) - 1).padStart(2, "0")}へ`,
  );
  readout.querySelector("[data-estat-step='1']")?.setAttribute(
    "aria-label",
    `次の展示、${String(Number(exhibit.number) % 31 + 1).padStart(2, "0")}へ`,
  );
  markerButtons.forEach((button, index) => {
    const markerValue = values[index];
    button.setAttribute("aria-label", `${OBSERVATION_CITIES[index].code} ${OBSERVATION_CITIES[index].prefecture}、${exhibit.valueLabel} ${formatNumber(markerValue, exhibit.key === "migration", exhibit.decimals || 0)} ${Number.isFinite(markerValue) ? exhibit.unit : ""}`.trim());
  });
};

// Read the selected station at activation time, without building analysis rows.
const getSourceInfo = () => {
  if (activeIndex < 0) return null;
  const exhibit = currentExhibit();
  const station = observationStationFor();
  const city = OBSERVATION_CITIES[selectedIndex];
  return {
    number: exhibit.number,
    shortTitle: exhibit.shortTitle,
    datasets: [{
      id: exhibit.id,
      title: exhibit.sourceName,
      organisation: exhibit.provider || "e-Stat",
      url: station?.url || sourceMetadataFor(exhibit).sourceUrl || exhibit.source,
      attributionNote: `対象：${formatPrefecturePlace(city.prefecture, station?.station)}。${exhibit.caption}`,
    }],
  };
};

const statisticsDataset = () => {
  if (!series || activeIndex < 0) return null;
  const exhibit = currentExhibit();
  const period = currentPeriod();
  const values = valuesFor();
  const station = observationStationFor(selectedIndex);
  if (exhibit.longTerm) {
    const periods = periodsFor(exhibit);
    const city = OBSERVATION_CITIES[selectedIndex];
    const missingPeriods = periods.filter((year, index) => !Number.isFinite(valuesFor(index)[selectedIndex]));
    const validPeriods = periods.filter(year => !missingPeriods.includes(year));
    const source = sourceMetadataFor(exhibit);
    return {
      id: `estat-prefecture-${exhibit.key}`,
      modeId: "estat-prefecture",
      title: `${exhibit.number} ${exhibit.shortTitle} — ${formatPrefecturePlace(city.prefecture, station?.station)}（${periods[0]}〜${periods.at(-1)}）`,
      rows: periods.map((year, index) => {
        const value = valuesFor(index)[selectedIndex];
        return {
          id: year,
          label: year,
          x: Number(year),
          y: Number.isFinite(value) ? value : Number.NaN,
          value: Number.isFinite(value) ? value : Number.NaN,
          prefecture: city.prefecture,
          city: station?.station || "",
          year: Number(year),
          qualityFlag: qualityFlagFor(year)?.flag || "normal",
          period: year,
          provenance: "SOURCE",
        };
      }).filter((row) => Number.isFinite(row.value)),
      unit: exhibit.unit,
      xLabel: "年",
      xKind: "year",
      valueLabel: exhibit.valueLabel,
      yLabel: exhibit.valueLabel,
      defaultMethod: "discovery",
      provenance: ["SOURCE"],
      periodStart: validPeriods[0] || "",
      periodEnd: validPeriods.at(-1) || "",
      coverageStart: periods[0],
      coverageEnd: periods.at(-1),
      missingPeriods,
      missingCount: missingPeriods.length,
      comparisonNote: comparisonNoteFor(exhibit),
      population: source.population || "",
      sourceUrl: station?.url || source.sourceUrl || exhibit.source,
      sourceName: exhibit.sourceName,
    };
  }
  return {
    id: `estat-prefecture-${exhibit.key}`,
    modeId: "estat-prefecture",
    title: `${exhibit.number} ${exhibit.shortTitle} — ${exhibit.valueLabel}（${period}）`,
    rows: OBSERVATION_CITIES.map((city, index) => {
      const value = values[index];
      return {
        id: city.code,
        label: `${city.code} ${city.prefecture}`,
        x: Number(city.code),
        y: Number.isFinite(value) ? value : Number.NaN,
        value: Number.isFinite(value) ? value : Number.NaN,
        prefecture: city.prefecture,
        city: city.city,
        period,
        ...(["precipitation", "rainyDays"].includes(exhibit.key) ? {
          precipitation: series.precipitation?.[period]?.[index],
          rainyDays: series.rainyDays?.[period]?.[index],
        } : {}),
        provenance: "SOURCE",
      };
    }).filter((row) => Number.isFinite(row.value)),
    unit: exhibit.unit,
    xLabel: "都道府県コード",
    yLabel: exhibit.valueLabel,
    provenance: ["SOURCE"],
    periodStart: period,
    periodEnd: period,
    sourceUrl: exhibit.source,
    sourceName: exhibit.sourceName,
  };
};

const openStatistics = () => {
  const dataset = statisticsDataset();
  if (!dataset) return;
  const open = () => void globalThis.GaiaStatisticsLab?.open?.({
    modeId: dataset.modeId,
    datasetId: dataset.id,
    dataset,
  });
  if (globalThis.GaiaStatisticsLab?.open) open();
  else addEventListener("gaia:statistics-lab-ready", open, { once: true });
};

const applyHeading = () => {
  const exhibit = currentExhibit();
  const number = document.querySelector("#japan-mode-number");
  const bankTitle = document.querySelector("#japan-mode-title");
  const mapTitle = document.querySelector("#japan-title");
  if (number) number.textContent = exhibit.number;
  if (bankTitle) bankTitle.textContent = exhibit.shortTitle;
  if (mapTitle) {
    mapTitle.dataset.exhibitNumber = exhibit.number;
    mapTitle.textContent = exhibit.shortTitle;
    mapTitle.setAttribute("aria-label", `${exhibit.number} ${exhibit.shortTitle}`);
  }
};

const pausePlayback = ({ transport = false } = {}) => {
  playbackEnabled = false;
  if (layer) layer.dataset.estatPlayback = "manual";
  if (!transport) globalThis.GaiaMapDemo?.stop?.("interaction");
};

const resumePlayback = () => {
  if (activeIndex < 0) return;
  playbackEnabled = true;
  layer.dataset.estatPlayback = "auto";
  nextMonthAt = performance.now() + periodDurationFor();
  nextPoiAt = performance.now() + POI_MS;
};

const selectPrefecture = (index, { auto = false } = {}) => {
  if (auto && !playbackEnabled) return;
  if (!auto) pausePlayback();
  const requested = Math.max(0, Math.min(OBSERVATION_CITIES.length - 1, Number(index) || 0));
  if (requested === selectedIndex && auto) {
    nextPoiAt = performance.now() + POI_MS;
    return;
  }
  const previous = markerButtons[selectedIndex];
  const previousIndex = selectedIndex;
  atmosphereAnchorPreviousIndex = selectedIndex;
  atmosphereAnchorChangedAt = performance.now();
  selectedIndex = requested;
  previous?.classList.add("is-departing");
  window.setTimeout(() => previous?.classList.remove("is-departing"), 520);
  const current = markerButtons[selectedIndex];
  current?.classList.remove("is-arriving");
  requestAnimationFrame(() => current?.classList.add("is-arriving"));
  window.setTimeout(() => current?.classList.remove("is-arriving"), 900);
  nextPoiAt = performance.now() + (auto ? POI_MS : POI_MS * 2);
  renderReadout();
  dispatchEvent(new CustomEvent("gaia:estat-poi-change", {
    detail: {
      from: OBSERVATION_CITIES[previousIndex]?.code,
      to: OBSERVATION_CITIES[selectedIndex]?.code,
      auto,
    },
  }));
};

const setPeriod = (index, { auto = false } = {}) => {
  if (auto && !playbackEnabled) return;
  if (!auto) pausePlayback();
  const periods = periodsFor();
  if (!periods.length) return;
  const length = periods.length;
  const requested = ((Number(index) || 0) % length + length) % length;
  if (requested === periodIndex && auto) {
    nextMonthAt = performance.now() + periodDurationFor();
    return;
  }
  previousPeriodIndex = periodIndex;
  periodIndex = requested;
  transitionStartedAt = performance.now();
  const duration = periodDurationFor();
  nextMonthAt = transitionStartedAt + (auto ? duration : duration * 2);
  layer.dataset.estatPeriodTransition = "active";
  window.setTimeout(() => {
    if (layer) layer.dataset.estatPeriodTransition = "settled";
  }, TRANSITION_MS);
  renderReadout();
};

const setMonth = setPeriod;

const stepExhibit = (direction) => {
  const step = Math.sign(Number(direction) || 0);
  if (!step || activeIndex < 0) return;
  const route = globalThis.GaiaMapCategories.buttons();
  const current = route.indexOf(buttons[activeIndex]);
  if (current >= 0) route[(current + step + route.length) % route.length]?.click();
};

const select = async (index) => {
  globalThis.GaiaMarineCod?.deactivate?.();
  globalThis.GaiaFoodExhibits?.deactivate?.();
  const requested = Math.max(0, Math.min(EXHIBITS.length - 1, Number(index) || 0));
  globalThis.GaiaLiveExhibits?.deactivate?.();
  globalThis.GaiaFirmsExhibit?.deactivate?.();
  if (activeIndex < 0) {
    savedHeading = {
      number: document.querySelector("#japan-mode-number")?.textContent || "06",
      title: document.querySelector("#japan-mode-title")?.textContent || "積み重なるCO₂",
    };
  }
  activeIndex = requested;
  await Promise.all([loadSeries(), loadPrefectureShapes()]);
  // A different exhibit may have been chosen while this first-use load ran.
  if (activeIndex !== requested) return;
  const regionMode = usesPrefectureRegions();
  periodIndex = 0;
  previousPeriodIndex = 0;
  transitionStartedAt = performance.now();
  layer.classList.add("is-estat-exhibit");
  layer.dataset.estatExhibit = currentExhibit().key;
  layer.dataset.estatFrequency = currentExhibit().frequency;
  layer.dataset.estatPoiDisplay = regionMode ? "prefecture-regions" : "point-markers";
  canvas.hidden = false;
  markerLayer.hidden = regionMode;
  prefectureRegionLayer.toggleAttribute("hidden", !regionMode);
  hidePrefectureRegionTooltip();
  heatLegend.hidden = false;
  if (atmosphereWebglCanvas) atmosphereWebglCanvas.hidden = false;
  readout.hidden = false;
  buttons.forEach((button, buttonIndex) => button.setAttribute("aria-current", String(buttonIndex === activeIndex)));
  document.querySelectorAll(".map-mode-button:not([data-estat-exhibit])").forEach((button) => button.setAttribute("aria-current", "false"));
  applyHeading();
  renderReadout();
  resumePlayback();
  atmosphereAnchorPreviousIndex = selectedIndex;
  atmosphereAnchorChangedAt = performance.now() - ESTAT_WEBGL_ANCHOR_TRANSITION_MS;
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.(japanPrefectureView(innerWidth));
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
  dispatchEvent(new CustomEvent("gaia:estat-exhibit-change", { detail: { index: activeIndex, id: currentExhibit().id } }));
};

const deactivate = () => {
  if (activeIndex < 0) return;
  activeIndex = -1;
  cancelAnimationFrame(frame);
  cancelAnimationFrame(primaryValueAnimationFrame);
  frame = 0;
  primaryValueAnimationFrame = 0;
  primaryValueDisplayed = Number.NaN;
  primaryValueTarget = Number.NaN;
  primaryValueExhibitKey = "";
  layer.classList.remove("is-estat-exhibit");
  delete layer.dataset.estatExhibit;
  delete layer.dataset.estatFrequency;
  delete layer.dataset.estatPoiDisplay;
  delete layer.dataset.estatPlayback;
  delete layer.dataset.estatPeriodTransition;
  delete layer.dataset.estatLodgingVisual;
  delete layer.dataset.estatLodgingFlashCadence;
  delete layer.dataset.estatAmbientVisual;
  delete layer.dataset.estatAmbientMotion;
  delete layer.dataset.estatAmbientFlashCadence;
  canvas.hidden = true;
  if (atmosphereWebglCanvas) atmosphereWebglCanvas.hidden = true;
  markerLayer.hidden = true;
  prefectureRegionLayer.setAttribute("hidden", "");
  hidePrefectureRegionTooltip();
  heatLegend.hidden = true;
  readout.hidden = true;
  buttons.forEach((button) => button.setAttribute("aria-current", "false"));
  if (savedHeading) {
    const number = document.querySelector("#japan-mode-number");
    const bankTitle = document.querySelector("#japan-mode-title");
    if (number) number.textContent = savedHeading.number;
    if (bankTitle) bankTitle.textContent = savedHeading.title;
  }
  savedHeading = null;
  dispatchEvent(new CustomEvent("gaia:estat-exhibit-change", { detail: { index: -1, id: null } }));
};

const mount = () => {
  if (document.querySelector("#gaia-estat-canvas")) return;
  layer = document.querySelector("#japan-layer");
  map = document.querySelector("#japan-map");
  const list = document.querySelector("#japan-estat-mode-list");
  const bank = document.querySelector(".map-mode-bank");
  if (!(layer instanceof HTMLElement) || !(map instanceof HTMLElement) || !(list instanceof HTMLElement) || !(bank instanceof HTMLElement)) return;

  canvas = document.createElement("canvas");
  canvas.id = "gaia-estat-canvas";
  canvas.className = "gaia-estat-canvas";
  canvas.hidden = true;
  canvas.setAttribute("aria-hidden", "true");
  context = canvas.getContext("2d", { alpha: true });
  map.append(canvas);

  atmosphereWebglCanvas = document.createElement("canvas");
  atmosphereWebglCanvas.id = "gaia-estat-atmosphere-webgl";
  atmosphereWebglCanvas.className = "gaia-estat-webgl";
  atmosphereWebglCanvas.hidden = true;
  atmosphereWebglCanvas.setAttribute("aria-hidden", "true");
  atmosphereWebglCanvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    atmosphereOceanMask?.dispose();
    atmosphereWebglCanvas.dataset.estatWebglState = "context-lost";
  });
  atmosphereWebglCanvas.addEventListener("webglcontextrestored", () => {
    atmosphereWebglProgram = null;
    atmosphereWebglPositionBuffer = null;
    atmosphereWebglLocations = null;
    initializeAtmosphereWebgl();
  });
  map.append(atmosphereWebglCanvas);

  markerLayer = document.createElement("div");
  markerLayer.className = "gaia-estat-markers";
  markerLayer.hidden = true;
  markerLayer.setAttribute("aria-label", "公的統計 47都道府県データ地点");
  markerButtons = OBSERVATION_CITIES.map((city, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gaia-estat-marker";
    button.dataset.estatPrefecture = city.code;
    button.innerHTML = `<i aria-hidden="true"></i><span><strong>${city.prefecture}</strong><b>—</b><small></small></span>`;
    button.addEventListener("pointerdown", (event) => { event.stopPropagation(); pausePlayback(); });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectPrefecture(index);
    });
    markerLayer.append(button);
    return button;
  });
  map.append(markerLayer);

  prefectureRegionLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  prefectureRegionLayer.classList.add("gaia-estat-prefecture-regions");
  prefectureRegionLayer.setAttribute("hidden", "");
  prefectureRegionLayer.setAttribute("aria-label", "公的統計 47都道府県データ領域");
  prefectureRegionGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  prefectureRegionLayer.append(prefectureRegionGroup);
  map.append(prefectureRegionLayer);

  prefectureRegionTooltip = document.createElement("div");
  prefectureRegionTooltip.className = "gaia-estat-prefecture-tooltip";
  prefectureRegionTooltip.hidden = true;
  prefectureRegionTooltip.innerHTML = "<span><small>01</small><strong>北海道</strong></span><b>—</b>";
  map.append(prefectureRegionTooltip);
  syncPrefectureRegionPaths();

  heatLegend = createMetricLegend({ className: "gaia-estat-heat-legend", label: "都道府県の観測値と色の目盛り" });
  heatLegend.hidden = true;
  heatLegend.querySelector("[data-metric-title]").setAttribute("data-estat-heat-title", "");
  heatLegend.querySelector("[data-metric-minimum]").setAttribute("data-estat-heat-min", "");
  heatLegend.querySelector("[data-metric-maximum]").setAttribute("data-estat-heat-max", "");
  const historyNote = document.createElement("small");
  historyNote.className = "gaia-estat-history-note";
  historyNote.setAttribute("data-estat-history-note", "");
  heatLegend.append(historyNote);
  layer.append(heatLegend);

  readout = document.createElement("section");
  readout.className = "gaia-estat-readout";
  readout.hidden = true;
  readout.setAttribute("aria-live", "polite");
  readout.innerHTML = `
    <div class="gaia-estat-chapter">
      <div><button type="button" data-estat-step="-1" aria-label="前の日本統計展示">‹</button><button type="button" class="gaia-estat-selector-toggle" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover" aria-label="21 人が動く、街が変わる。展示一覧を開く"><b data-estat-number>21</b><strong data-estat-title>人が動く、街が変わる</strong></button><button type="button" data-estat-step="1" aria-label="次の日本統計展示">›</button></div>
    </div>
    <div class="gaia-estat-place"><p>都道府県</p><strong data-estat-place>北海道（札幌市）</strong></div>
    <div class="gaia-estat-primary"><p data-estat-value-label>転入超過</p><strong data-estat-value>—</strong><span data-estat-unit>人</span></div>
    <div class="gaia-estat-timeline">
      <header><span>表示年 / <b data-estat-period>—</b></span><strong data-estat-frequency>e-Stat · 年次</strong></header>
      <input data-estat-month type="range" min="0" max="4" step="1" value="0" aria-label="表示月を選ぶ" />
      <div data-estat-months aria-hidden="true"></div>
    </div>
    <div class="gaia-estat-comparison"><span>都道府県順位<strong data-estat-rank>—</strong></span><span data-estat-delta-label>前月差<strong data-estat-delta>—</strong></span></div>
    <small data-estat-mobile-history-note></small>
    <div class="gaia-estat-copy"><p data-estat-caption></p><small data-estat-guide></small><small data-estat-quality hidden></small></div>
    <div class="gaia-estat-actions" aria-label="元データと統計分析">
      <button type="button" data-estat-source-action></button>
      <button type="button" data-estat-analysis></button>
    </div>
  `;
  decorateMapActions(readout.querySelector(".gaia-estat-actions"), readout.querySelector("[data-estat-source-action]"), readout.querySelector("[data-estat-analysis]"));
  layer.append(readout);

  // [data-map-bank-toggle] is handled by the shared exhibition picker.
  buttons = EXHIBITS.map((exhibit, index) => {
    const button = document.createElement("button");
    button.className = "map-mode-button";
    button.type = "button";
    button.textContent = exhibit.number;
    button.dataset.estatExhibit = exhibit.id;
    button.dataset.mapPreviewSurface = "map";
    button.setAttribute("aria-label", `${exhibit.number} ${exhibit.shortTitle}、日本の公的統計展示へ切り替える`);
    button.setAttribute("aria-describedby", "map-mode-preview");
    button.setAttribute("aria-current", "false");
    button.addEventListener("click", () => { void select(index); });
    list.append(button);
    return button;
  });

  bank.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".map-mode-button") : null;
    if (!(target instanceof HTMLButtonElement) || target.dataset.estatExhibit || activeIndex < 0) return;
    deactivate();
  }, { capture: true });
  readout.querySelectorAll("[data-estat-step]").forEach((button) => button.addEventListener("click", () => {
    stepExhibit(button.dataset.estatStep);
  }));
  readout.querySelector("[data-estat-month]")?.addEventListener("pointerdown", pausePlayback);
  readout.querySelector("[data-estat-month]")?.addEventListener("input", (event) => setMonth(Number(event.currentTarget.value)));
  addEventListener("gaia:map-playback-resume", resumePlayback);
  readout.querySelector("[data-estat-analysis]")?.addEventListener("click", openStatistics);
  addEventListener("resize", () => { if (activeIndex >= 0) draw(performance.now()); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(frame);
    else if (activeIndex >= 0) frame = requestAnimationFrame(draw);
  });
  dispatchEvent(new CustomEvent("gaia:estat-exhibit-mounted"));
};

if (globalThis.GaiaMapObservationAdapter) mount();
else addEventListener("gaia:map-adapter-ready", mount, { once: true });

globalThis.GaiaEstatExhibits = Object.freeze({
  getCruisePoints: () => OBSERVATION_CITIES,
  selectCruisePoi: index => selectPrefecture(index),
  definitions: EXHIBITS,
  select,
  deactivate,
  setMonth,
  setPeriod,
  selectPrefecture,
  pausePlayback,
  resumePlayback,
  setPlayback: value => value ? resumePlayback() : pausePlayback({ transport: true }),
  getPlaybackState: () => ({ ready: activeIndex >= 0 && Boolean(series), supported: activeIndex >= 0 && periodsFor().length > 1,
    playing: activeIndex >= 0 && playbackEnabled, detail: '年度と都道府県を順に表示します。' }),
  getStatisticsDataset: statisticsDataset,
  getSourceInfo,
  getState: () => ({ activeIndex, selectedIndex, monthIndex: periodIndex, periodIndex, period: currentPeriod(), playbackEnabled }),
});

export { mount };
