import { animateMetricText } from '../shared/animated-metric.js';
import { formatJapaneseNumber } from "../shared/number-format.js";
import { formatCoordinatesJa } from "../shared/coordinates.js";
import { pickProjectedPoi } from "./poi-hit-test.js?v=gaia-japan-center-1";
import { earthBaseScale, earthLongitudeToMapX } from "./world-projection.js?v=gaia-japan-center-1";
import { decorateMapActions } from "./map-exhibit-actions.js?v=gaia-map-polish-1";
import { createRealtimeStatus, updateRealtimeStatus } from "./realtime-exhibit-status.js?v=gaia-map-polish-1-live-red-1-footer-credit-1";
import { FIRE_REVEAL_EDGE, FIRE_COLUMN_LIFETIME, FIRE_COLUMN_LIMIT, FIRE_COLUMN_MOBILE_LIMIT,
  fireSequence, inverseFireEase, FIRE_COLUMN_VERTEX, FIRE_COLUMN_FRAGMENT } from "./fire-ignition.js?v=gaia-fire-columns-1";

const SNAPSHOT_URL = new URL("../../data/firms-active-fire-snapshot.json", import.meta.url);
const LIVE_URL = "/api/live/v1/firms";
const SOURCE_PAGE = "https://firms.modaps.eosdis.nasa.gov/active_fire/";
const REVEAL_DELAY_MS = 900;
const REVEAL_MS = 24_000;
const HOLD_MS = 4_000;
const EXTINGUISH_MS = 8_000;
const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_CANVAS_PIXELS = 1_600_000;

const DEFINITION = Object.freeze({
  id: "nasa-firms-active-fire",
  number: "01",
  shortTitle: "火と暮らしの境界",
  title: "火と暮らしの境界 — ACTIVE FIRE",
  signalLabel: "火災・熱異常",
  caption: "NASA FIRMSが公開する、衛星による直近24時間の火災・熱異常を、観測時刻順に表示します。検知点と放射熱の強さ（FRP）の記録であり、焼失面積、被害、出火原因は分かりません。",
  sourceName: "NASA LANCE FIRMS / MODIS Collection 6.1 NRT",
  source: SOURCE_PAGE,
});

let layer;
let map;
let canvas;
let gl;
let fireProgram;
let columnProgram;
let columnBuffer;
let columnPoints;
let ignitionTimes;
const columnValues = new Float32Array(FIRE_COLUMN_LIMIT * 7);
let backgroundProgram;
let fireBuffer;
let backgroundBuffer;
let pointCount = 0;
let snapshot;
let snapshotPromise;
let readout;
let legend;
let realtimeStatus;
let button;
let active = false;
let frame = 0;
let cycleStartedAt = 0;
let lastRenderedAt = 0;
let playbackEnabled = true;
let explicitPlayback = false;
let manualProgress = 0;
let heldPlayback = null;
let pausedCycleElapsedMs = 0;
let savedHeading;
let renderedPlayback = null;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const ease = (value) => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};
const formatNumber = (value, decimals = 0) => formatJapaneseNumber(Number(value), decimals, decimals);
const formatJst = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(date);
};

const formatAge = (value) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "更新間隔不明";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 2) return "観測から1分以内";
  if (minutes < 60) return `観測から${minutes}分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `観測から${hours}時間`;
  return `観測から${Math.floor(hours / 24)}日`;
};

const validSnapshot = (payload) => payload?.schemaVersion === 1
  && Array.isArray(payload.points)
  && payload.points.length > 0
  && payload.points.every((point) => Number.isFinite(point.lat)
    && Number.isFinite(point.lon)
    && Number.isFinite(point.frp)
    && Number.isFinite(point.confidence)
    && Number.isFinite(Date.parse(point.acquiredAt)));

const fetchJson = async (url, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`${url} ${response.status}`);
    const payload = await response.json();
    if (!validSnapshot(payload)) throw new Error(`${url} returned an invalid FIRMS snapshot`);
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
};

const loadSnapshot = async () => {
  if (snapshot) return snapshot;
  if (snapshotPromise) return snapshotPromise;
  snapshotPromise = (async () => {
    const allowLive = location.protocol === "https:" || new URLSearchParams(location.search).get("live") === "1";
    if (allowLive) {
      try {
        snapshot = await fetchJson(LIVE_URL);
        return snapshot;
      } catch (error) {
        console.warn("NASA FIRMS live endpoint unavailable; using the versioned snapshot.", error);
      }
    }
    snapshot = await fetchJson(SNAPSHOT_URL.href);
    return snapshot;
  })().finally(() => { snapshotPromise = null; });
  return snapshotPromise;
};

const compileShader = (type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (vertexSource, fragmentSource) => {
  const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

const initializeWebgl = () => {
  if (gl && fireProgram && columnProgram && backgroundProgram) return true;
  gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, premultipliedAlpha: true });
  if (!gl) {
    canvas.dataset.firmsEngine = "unavailable";
    return false;
  }
  try {
    backgroundProgram = createProgram(`
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `, `
      precision mediump float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 456.21));
        point += dot(point, point + 45.32);
        return fract(point.x * point.y);
      }

      float softNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
          mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), local.x), local.y);
      }

      void main() {
        vec2 uv = v_uv;
        vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
        vec2 drift = uv * aspect * 3.1 + vec2(u_time * 0.012, -u_time * 0.005);
        float smoke = softNoise(drift) * 0.62 + softNoise(drift * 2.07 + 8.1) * 0.38;
        smoke = smoothstep(0.55, 0.92, smoke) * (0.45 + 0.55 * smoothstep(0.05, 0.75, uv.y));
        vec2 sparkGrid = uv * aspect * vec2(44.0, 25.0);
        vec2 sparkCell = floor(sparkGrid);
        float seed = hash21(sparkCell);
        vec2 sparkLocal = fract(sparkGrid);
        float sparkY = fract(seed * 3.7 + u_time * (0.014 + seed * 0.009));
        float spark = exp(-length((sparkLocal - vec2(seed, sparkY)) * vec2(1.0, 1.8)) * 92.0)
          * step(0.965, seed);
        vec3 color = vec3(0.018, 0.055, 0.07) * smoke + vec3(1.0, 0.24, 0.035) * spark * 0.28;
        float alpha = smoke * 0.036 + spark * 0.11;
        gl_FragColor = vec4(color, alpha);
      }
    `);
    fireProgram = createProgram(`
      attribute vec4 a_positionData;
      attribute vec3 a_meta;
      uniform vec2 u_cssSize;
      uniform vec2 u_origin;
      uniform float u_scale;
      uniform float u_progress;
      uniform float u_extinguish;
      uniform float u_renderScale;
      uniform float u_markerScale;
      varying float v_alpha;
      varying float v_heat;
      varying float v_night;
      varying float v_seed;

      void main() {
        float x = u_origin.x + a_positionData.x * u_scale;
        float y = u_origin.y + (90.0 - a_positionData.y) * u_scale;
        vec2 clip = vec2(x / u_cssSize.x * 2.0 - 1.0, 1.0 - y / u_cssSize.y * 2.0);
        float appeared = smoothstep(a_positionData.w, a_positionData.w + 0.018, u_progress);
        float expired = u_extinguish < 0.0 ? 0.0 : smoothstep(a_positionData.w, a_positionData.w + 0.045, u_extinguish);
        v_alpha = appeared * (1.0 - expired) * (0.55 + a_meta.x * 0.45);
        v_heat = a_positionData.z;
        v_night = a_meta.y;
        v_seed = a_meta.z;
        gl_Position = v_alpha > 0.002 ? vec4(clip, 0.0, 1.0) : vec4(2.0, 2.0, 0.0, 1.0);
        gl_PointSize = (7.0 + a_positionData.z * 20.0) * u_renderScale * u_markerScale;
      }
    `, `
      precision mediump float;
      uniform float u_time;
      varying float v_alpha;
      varying float v_heat;
      varying float v_night;
      varying float v_seed;

      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        point.x *= 1.0 + max(point.y, 0.0) * 0.34;
        point.y += 0.12 + sin(u_time * (2.1 + v_seed) + v_seed * 31.0) * 0.055 * (1.0 - abs(point.y));
        float distanceToCore = length(point * vec2(1.08, 0.88));
        if (distanceToCore > 1.0) discard;
        float core = exp(-distanceToCore * 5.8);
        float body = smoothstep(1.0, 0.1, distanceToCore);
        float flicker = 0.86 + 0.14 * sin(u_time * (3.0 + v_seed * 2.0) + v_seed * 47.0 + point.y * 5.0);
        vec3 dayOuter = vec3(0.95, 0.12, 0.025);
        vec3 nightOuter = vec3(0.72, 0.025, 0.02);
        vec3 outer = mix(dayOuter, nightOuter, v_night);
        vec3 middle = mix(vec3(1.0, 0.28, 0.025), vec3(1.0, 0.11, 0.035), v_night);
        vec3 color = mix(outer, middle, smoothstep(0.15, 0.82, body));
        color = mix(color, vec3(1.0, 0.88, 0.48), core * (0.48 + v_heat * 0.42));
        float alpha = body * v_alpha * flicker * (0.48 + v_heat * 0.52);
        gl_FragColor = vec4(color * (0.88 + core * 0.65), alpha);
      }
    `);
    columnProgram = createProgram(FIRE_COLUMN_VERTEX, FIRE_COLUMN_FRAGMENT);
    columnBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, columnBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, columnValues.byteLength, gl.DYNAMIC_DRAW);
    fireBuffer = gl.createBuffer();
    backgroundBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    canvas.dataset.firmsEngine = "webgl-fire-particles";
    canvas.dataset.firmsFlashCadence = "none";
    canvas.dataset.firmsMotion = "spatial-continuous-non-pulsing";
    canvas.dataset.firmsIgnition = "one-shot-fire-column";
    canvas.dataset.firmsColumnLifetime = String(FIRE_COLUMN_LIFETIME);
    return true;
  } catch (error) {
    console.warn(error);
    canvas.dataset.firmsEngine = "shader-error";
    return false;
  }
};

const uploadPoints = () => {
  if (!snapshot || !initializeWebgl()) return;
  const maxFrp = Math.max(1, snapshot.summary.maxFrp || 1);
  const values = new Float32Array(snapshot.points.length * 7);
  columnPoints = new Float32Array(values.length);
  ignitionTimes = new Float32Array(snapshot.points.length);
  snapshot.points.forEach((point, index) => {
    const offset = index * 7;
    values[offset] = earthLongitudeToMapX(point.lon);
    values[offset + 1] = point.lat;
    values[offset + 2] = clamp01(Math.log1p(point.frp) / Math.log1p(maxFrp));
    values[offset + 3] = fireSequence(index, snapshot.points.length);
    values[offset + 4] = clamp01((point.confidence - 60) / 40);
    values[offset + 5] = point.daynight === "N" ? 1 : 0;
    values[offset + 6] = ((Math.sin((point.lat + 91) * 12.9898 + (point.lon + 181) * 78.233) * 43758.5453) % 1 + 1) % 1;
    // Start a short flare when the matching base marker first becomes visible.
    ignitionTimes[index] = inverseFireEase(values[offset + 3] + FIRE_REVEAL_EDGE * .08) * REVEAL_MS / 1000;
    columnPoints.set(values.subarray(offset, offset + 7), offset);
    columnPoints[offset + 3] = ignitionTimes[index];
  });
  gl.bindBuffer(gl.ARRAY_BUFFER, fireBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
  pointCount = snapshot.points.length;
  canvas.dataset.firmsPointCount = String(pointCount);
  canvas.dataset.firmsAttributeEncoding = "frp-size-confidence-alpha-daynight-color";
  canvas.dataset.firmsSequence = "acquisition-time";
  canvas.dataset.firmsProjection = "japan-pacific-equirectangular-150";
};

const currentProjection = () => {
  const rect = map?.getBoundingClientRect();
  const overlay = document.querySelector("#japan-overlay");
  if (!rect?.width || !rect?.height || !(overlay instanceof HTMLElement)) return null;
  const zoom = Math.max(1, Number(overlay.dataset.earthZoom) || 1);
  const scale = earthBaseScale(rect) * zoom;
  const offsetX = Number(overlay.dataset.earthOffsetX) || 0;
  const offsetY = Number(overlay.dataset.earthOffsetY) || 0;
  return {
    rect,
    scale,
    originX: (rect.width - 360 * scale) / 2 + offsetX,
    originY: (rect.height - 180 * scale) / 2 + offsetY,
  };
};

const resizeCanvas = (rect) => {
  const targetWidth = Math.max(1, rect.width * Math.min(devicePixelRatio || 1, 1.3));
  const targetHeight = Math.max(1, rect.height * Math.min(devicePixelRatio || 1, 1.3));
  const resolutionScale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (targetWidth * targetHeight)));
  const width = Math.max(1, Math.round(targetWidth * resolutionScale));
  const height = Math.max(1, Math.round(targetHeight * resolutionScale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvas.dataset.firmsResolutionScale = resolutionScale.toFixed(3);
  canvas.dataset.firmsTargetFps = "30";
  return width / rect.width;
};

const findPoiAt = (clientX, clientY, pointerType) => {
  if (!active || !snapshot || !renderedPlayback) return null;
  const state = renderedPlayback;
  const hit = pickProjectedPoi(snapshot.points, currentProjection(), clientX, clientY, pointerType, (point, index) => {
    // Match the shader's reveal/expiry envelope, not every point in the feed.
    const sequence = fireSequence(index, pointCount);
    const appeared = ease((state.progress - sequence) / FIRE_REVEAL_EDGE);
    const expired = state.extinguish < 0 ? 0 : ease((state.extinguish - sequence) / 0.045);
    return appeared * (1 - expired) * (0.55 + clamp01((point.confidence - 60) / 40) * 0.45) > 0.002;
  });
  if (!hit) return null;
  const { point, index } = hit;
  const title = formatCoordinatesJa(point.lat, point.lon);
  const values = `火災放射パワー ${formatNumber(point.frp, 1)} MW / 信頼度 ${formatNumber(point.confidence)} / ${point.daynight === "N" ? "夜間" : "昼間"}検知`;
  return {
    type: "exhibit", index,
    record: {
      id: point.id || String(index), exhibitId: DEFINITION.id, lon: point.lon, lat: point.lat,
      kicker: `${DEFINITION.number} / ${DEFINITION.shortTitle}`, title, preview: values,
      previewReadings: { context: `${point.daynight === 'N' ? '夜間' : '昼間'}検知`, readings: [
        { label: '火災放射パワー', value: formatNumber(point.frp, 1), unit: 'MW' },
        { label: '信頼度', value: formatNumber(point.confidence), unit: '' },
      ] },
      meta: `${title} / ${values} / ${formatJst(point.acquiredAt)}（日本時間） / ${snapshot.source === "nasa-firms-modis" ? "取得済みデータ" : "保存データ"} / ${DEFINITION.sourceName}`,
      url: SOURCE_PAGE,
    },
  };
};

const playbackState = (timestamp) => {
  if (!playbackEnabled && heldPlayback) return heldPlayback;
  if (!playbackEnabled || (matchMedia?.("(prefers-reduced-motion: reduce)")?.matches && !explicitPlayback)) {
    return { progress: playbackEnabled ? 1 : manualProgress, extinguish: -1, phase: playbackEnabled ? "complete" : "scrub" };
  }
  const elapsed = Math.max(0, timestamp - cycleStartedAt);
  const state = playbackAtElapsed(elapsed);
  if (elapsed >= REVEAL_DELAY_MS + REVEAL_MS + HOLD_MS + EXTINGUISH_MS) cycleStartedAt = timestamp;
  return state;
};

// Both automatic playback and cruising use the same animation, not manual scrubbing.
const playbackAtElapsed = (elapsed) => {
  if (elapsed < REVEAL_DELAY_MS) return { progress: 0, extinguish: -1, phase: "waiting" };
  const afterDelay = elapsed - REVEAL_DELAY_MS;
  if (afterDelay < REVEAL_MS) return { progress: ease(afterDelay / REVEAL_MS), extinguish: -1, phase: "igniting" };
  if (afterDelay < REVEAL_MS + HOLD_MS) return { progress: 1, extinguish: -1, phase: "holding" };
  if (afterDelay < REVEAL_MS + HOLD_MS + EXTINGUISH_MS) {
    return { progress: 1, extinguish: ease((afterDelay - REVEAL_MS - HOLD_MS) / EXTINGUISH_MS), phase: "extinguishing" };
  }
  return { progress: 0, extinguish: -1, phase: "waiting" };
};

const drawBackground = (timestamp, width, height) => {
  gl.disable(gl.BLEND);
  gl.useProgram(backgroundProgram);
  const position = gl.getAttribLocation(backgroundProgram, "a_position");
  gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(gl.getUniformLocation(backgroundProgram, "u_time"), timestamp / 1000);
  gl.uniform2f(gl.getUniformLocation(backgroundProgram, "u_resolution"), width, height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
};

const drawFires = (timestamp, projection, state, renderScale) => {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(fireProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, fireBuffer);
  const positionData = gl.getAttribLocation(fireProgram, "a_positionData");
  const meta = gl.getAttribLocation(fireProgram, "a_meta");
  gl.enableVertexAttribArray(positionData);
  gl.vertexAttribPointer(positionData, 4, gl.FLOAT, false, 7 * 4, 0);
  gl.enableVertexAttribArray(meta);
  gl.vertexAttribPointer(meta, 3, gl.FLOAT, false, 7 * 4, 4 * 4);
  gl.uniform2f(gl.getUniformLocation(fireProgram, "u_cssSize"), projection.rect.width, projection.rect.height);
  gl.uniform2f(gl.getUniformLocation(fireProgram, "u_origin"), projection.originX, projection.originY);
  gl.uniform1f(gl.getUniformLocation(fireProgram, "u_scale"), projection.scale);
  gl.uniform1f(gl.getUniformLocation(fireProgram, "u_progress"), state.progress);
  gl.uniform1f(gl.getUniformLocation(fireProgram, "u_extinguish"), state.extinguish);
  gl.uniform1f(gl.getUniformLocation(fireProgram, "u_renderScale"), renderScale);
  gl.uniform1f(gl.getUniformLocation(fireProgram, "u_markerScale"), markerScale(projection));
  gl.uniform1f(gl.getUniformLocation(fireProgram, "u_time"), timestamp / 1000);
  gl.drawArrays(gl.POINTS, 0, pointCount);
};

const markerScale = (projection) => projection.rect.width >= 2400 ? 1.6 : projection.rect.width < 720 ? .85 : 1;

const drawFireColumns = (timestamp, projection, state, renderScale) => {
  const limit = projection.rect.width < 720 ? FIRE_COLUMN_MOBILE_LIMIT : FIRE_COLUMN_LIMIT;
  canvas.dataset.firmsColumnLimit = String(limit);
  canvas.dataset.firmsActiveColumns = "0";
  if ((!playbackEnabled && !Number.isFinite(state.animationElapsed)) || matchMedia("(prefers-reduced-motion: reduce)").matches
    || !["igniting", "holding"].includes(state.phase)) return;
  const clock = Math.max(0, ((state.animationElapsed ?? (timestamp - cycleStartedAt)) - REVEAL_DELAY_MS) / 1000);
  const scale = markerScale(projection);
  const cellSize = 54 * scale;
  const occupied = new Set();
  let count = 0;
  // Newest first. Only one large flame per screen-space cell; every underlying
  // observation stays visible and pickable, including dense fire clusters.
  for (let index = pointCount - 1; index >= 0 && count < limit; index--) {
    const age = clock - ignitionTimes[index];
    if (age < 0 || age > FIRE_COLUMN_LIFETIME) continue;
    const offset = index * 7;
    const x = projection.originX + columnPoints[offset] * projection.scale;
    const y = projection.originY + (90 - columnPoints[offset + 1]) * projection.scale;
    if (x < 0 || x > projection.rect.width || y < 0 || y > projection.rect.height) continue;
    const cell = `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    columnValues.set(columnPoints.subarray(offset, offset + 7), count * 7);
    count++;
  }
  canvas.dataset.firmsActiveColumns = String(count);
  if (!count) return;
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(columnProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, columnBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, columnValues.subarray(0, count * 7));
  const position = gl.getAttribLocation(columnProgram, "a_positionData");
  const meta = gl.getAttribLocation(columnProgram, "a_meta");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 7 * 4, 0);
  gl.enableVertexAttribArray(meta);
  gl.vertexAttribPointer(meta, 3, gl.FLOAT, false, 7 * 4, 4 * 4);
  gl.uniform2f(gl.getUniformLocation(columnProgram, "u_cssSize"), projection.rect.width, projection.rect.height);
  gl.uniform2f(gl.getUniformLocation(columnProgram, "u_origin"), projection.originX, projection.originY);
  gl.uniform1f(gl.getUniformLocation(columnProgram, "u_scale"), projection.scale);
  gl.uniform1f(gl.getUniformLocation(columnProgram, "u_renderScale"), renderScale);
  gl.uniform1f(gl.getUniformLocation(columnProgram, "u_markerScale"), scale);
  gl.uniform1f(gl.getUniformLocation(columnProgram, "u_clock"), clock);
  gl.drawArrays(gl.POINTS, 0, count);
};

const updateTimeline = (state) => {
  if (!snapshot || !readout) return;
  const countAt = (progress) => Math.max(0, Math.min(pointCount, Math.ceil(progress * pointCount)));
  const revealed = countAt(state.progress);
  const expired = state.extinguish < 0 ? 0 : countAt(state.extinguish);
  const visible = Math.max(0, revealed - expired);
  const point = snapshot.points[Math.max(0, Math.min(pointCount - 1, revealed - 1))];
  canvas.dataset.firmsPlaybackProgress = state.progress.toFixed(3);
  canvas.dataset.firmsExtinguishProgress = state.extinguish.toFixed(3);
  canvas.dataset.firmsVisibleCount = String(visible);
  canvas.dataset.firmsPlaybackPhase = state.phase;
  readout.dataset.firmsPlaybackPhase = state.phase;
  animateMetricText(readout.querySelector("[data-firms-visible]"), formatNumber(visible), 'firms');
  readout.querySelector("[data-firms-time]").textContent = state.phase === "waiting" ? "観測待機" : `${formatJst(point?.acquiredAt)}（日本時間）`;
  const range = readout.querySelector("[data-firms-progress]");
  if (range && playbackEnabled) range.value = String(Math.round(state.progress * 1000));
  const play = readout.querySelector("[data-firms-play]");
  if (play) {
    play.textContent = playbackEnabled ? "自動表示をやめる" : "自動表示する";
    play.setAttribute("aria-pressed", String(playbackEnabled));
  }
};

const pausePlayback = ({ transport = false } = {}) => {
  if (!active || !playbackEnabled) return;
  heldPlayback = { ...(renderedPlayback ?? playbackState(performance.now())), phase: "paused" };
  pausedCycleElapsedMs = performance.now() - cycleStartedAt;
  manualProgress = heldPlayback.progress;
  playbackEnabled = false;
  updateTimeline(heldPlayback);
  if (!transport) globalThis.GaiaMapDemo?.stop?.("interaction");
};

const resumePlayback = () => {
  if (!active || playbackEnabled) return;
  playbackEnabled = true;
  cycleStartedAt = performance.now() - (heldPlayback ? pausedCycleElapsedMs : REVEAL_DELAY_MS + inverseFireEase(manualProgress) * REVEAL_MS);
  heldPlayback = null;
};

const draw = (timestamp = performance.now()) => {
  if (!active || document.hidden || !snapshot || !initializeWebgl()) {
    frame = 0;
    return;
  }
  if (timestamp - lastRenderedAt < FRAME_INTERVAL_MS) {
    frame = requestAnimationFrame(draw);
    return;
  }
  lastRenderedAt = timestamp;
  const projection = currentProjection();
  if (!projection) {
    frame = requestAnimationFrame(draw);
    return;
  }
  const renderScale = resizeCanvas(projection.rect);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const state = playbackState(timestamp);
  const motionTime = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0
    : state.animationElapsed ?? (playbackEnabled ? timestamp - cycleStartedAt : heldPlayback ? pausedCycleElapsedMs : 0);
  drawBackground(motionTime, canvas.width, canvas.height);
  drawFires(motionTime, projection, state, renderScale);
  drawFireColumns(timestamp, projection, state, renderScale);
  canvas.dataset.firmsFrame = String((Number(canvas.dataset.firmsFrame) || 0) + 1);
  renderedPlayback = state;
  updateTimeline(state);
  frame = requestAnimationFrame(draw);
};

const applyHeading = () => {
  const number = document.querySelector("#japan-mode-number");
  const bankTitle = document.querySelector("#japan-mode-title");
  const mapTitle = document.querySelector("#japan-title");
  if (number) number.textContent = DEFINITION.number;
  if (bankTitle) bankTitle.textContent = DEFINITION.shortTitle;
  if (mapTitle) {
    mapTitle.dataset.exhibitNumber = DEFINITION.number;
    mapTitle.textContent = DEFINITION.shortTitle;
    mapTitle.setAttribute("aria-label", `${DEFINITION.number} ${DEFINITION.shortTitle}`);
  }
};

const statisticsDataset = () => snapshot ? {
  id: "nasa-firms-active-fire-24h",
  modeId: "nasa-firms",
  title: `火災・熱異常 ${formatNumber(snapshot.points.length)}地点`,
  rows: snapshot.points.map((point) => ({
    id: point.id,
    label: `${formatJst(point.acquiredAt)}（日本時間） / ${formatCoordinatesJa(point.lat, point.lon)}`,
    x: Date.parse(point.acquiredAt),
    y: point.frp,
    value: point.frp,
    brightness: point.brightness,
    confidence: point.confidence,
    daynight: point.daynight,
    lat: point.lat,
    lon: point.lon,
    provenance: "SOURCE",
  })),
  unit: "MW",
  xLabel: "観測時刻（JST）",
  yLabel: "火災放射パワー（FRP）",
  provenance: ["SOURCE"],
  periodStart: snapshot.summary.start,
  periodEnd: snapshot.summary.end,
  sourceUrl: SOURCE_PAGE,
  sourceName: DEFINITION.sourceName,
} : null;


const renderSnapshot = () => {
  if (!snapshot || !readout || !legend) return;
  updateRealtimeStatus(realtimeStatus, {
    sourceState: snapshot.source === "nasa-firms-modis" ? "LIVE CACHE" : "SAVED SNAPSHOT",
    observedAt: snapshot.summary.end,
    source: "NASA FIRMS / MODIS · 公開には時間差があります",
    sourceUrl: SOURCE_PAGE,
    kind: "衛星観測（準リアルタイム）",
    timeLabel: "最新観測",
  });
  uploadPoints();
  readout.dataset.firmsSource = snapshot.source;
  readout.dataset.firmsGeneratedAt = snapshot.generatedAt;
  readout.querySelector("[data-firms-total]").textContent = formatNumber(snapshot.summary.displayed);
  readout.querySelector("[data-firms-max-frp]").textContent = formatNumber(snapshot.summary.maxFrp, 1);
  readout.querySelector("[data-firms-night-share]").textContent = `${formatNumber(snapshot.summary.nightShare * 100, 1)}%`;
  readout.querySelector("[data-firms-confidence-share]").textContent = `${formatNumber(snapshot.summary.highConfidenceShare * 100, 1)}%`;
  readout.querySelector("[data-firms-coverage]").textContent = `${formatJst(snapshot.summary.start)} — ${formatJst(snapshot.summary.end)}（日本時間）`;
  readout.querySelector("[data-firms-status]").textContent = snapshot.source === "nasa-firms-modis" ? "取得済みデータ" : "保存データ";
  legend.querySelector("[data-firms-legend-source]").textContent = snapshot.source === "nasa-firms-modis" ? "NASA更新" : "保存データ";
  legend.querySelector("[data-firms-legend-count]").textContent = `${formatNumber(snapshot.summary.detected)} 検知`;
  legend.querySelector("[data-firms-latest]").textContent = `${formatJst(snapshot.summary.end)}（日本時間）`;
  legend.querySelector("[data-firms-age]").textContent = formatAge(snapshot.summary.end);
  readout.dataset.firmsLatestAt = snapshot.summary.end;
};

const select = async () => {
  globalThis.GaiaMarineCod?.deactivate?.();
  globalThis.GaiaFoodExhibits?.deactivate?.();
  globalThis.GaiaLiveExhibits?.deactivate?.();
  globalThis.GaiaEstatExhibits?.deactivate?.();
  globalThis.GaiaPlanetSignals?.deactivate?.();
  if (!active) {
    savedHeading = {
      number: document.querySelector("#japan-mode-number")?.textContent || "06",
      title: document.querySelector("#japan-mode-title")?.textContent || "積み重なるCO₂",
    };
  }
  active = true;
  renderedPlayback = null;
  globalThis.GaiaMapObservationAdapter?.closePoi?.();
  layer.classList.add("is-firms-exhibit");
  layer.dataset.firmsExhibit = DEFINITION.id;
  canvas.hidden = false;
  legend.hidden = false;
  readout.hidden = false;
  updateRealtimeStatus(realtimeStatus, { source: "NASA FIRMS / MODIS", sourceUrl: SOURCE_PAGE, kind: "衛星観測（準リアルタイム）", timeLabel: "最新観測" });
  legend.querySelector("details").open = false;
  button.setAttribute("aria-current", "true");
  document.querySelectorAll(".map-mode-button:not([data-firms-exhibit])").forEach((item) => item.setAttribute("aria-current", "false"));
  applyHeading();
  let payload;
  try { payload = await loadSnapshot(); }
  catch (error) {
    if (active) updateRealtimeStatus(realtimeStatus, { sourceState: "ERROR", source: "NASA FIRMS / MODIS", sourceUrl: SOURCE_PAGE, kind: "衛星観測" });
    console.warn("FIRMS observation data is unavailable.", error);
    return;
  }
  if (!active) return;
  renderSnapshot(payload);
  playbackEnabled = true;
  heldPlayback = null;
  cycleStartedAt = performance.now();
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({
    lon: 138,
    lat: 0,
    zoom: 1,
    targetX: 0.5,
    targetY: 0.47,
    durationMs: 820,
    label: "nasa-firms-global-24h",
  });
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
  dispatchEvent(new CustomEvent("gaia:firms-exhibit-change", { detail: { active: true, id: DEFINITION.id } }));
};

const deactivate = () => {
  if (!active) return;
  active = false;
  renderedPlayback = null;
  cancelAnimationFrame(frame);
  frame = 0;
  layer.classList.remove("is-firms-exhibit");
  delete layer.dataset.firmsExhibit;
  canvas.hidden = true;
  canvas.dataset.firmsActiveColumns = "0";
  legend.hidden = true;
  readout.hidden = true;
  button.setAttribute("aria-current", "false");
  if (savedHeading) {
    const number = document.querySelector("#japan-mode-number");
    const bankTitle = document.querySelector("#japan-mode-title");
    if (number) number.textContent = savedHeading.number;
    if (bankTitle) bankTitle.textContent = savedHeading.title;
  }
  savedHeading = null;
  dispatchEvent(new CustomEvent("gaia:firms-exhibit-change", { detail: { active: false, id: null } }));
};

const stepOutsideExhibit = (direction) => {
  const step = Math.sign(Number(direction) || 0);
  const exhibits = globalThis.GaiaMapCategories.buttons();
  const index = exhibits.indexOf(button);
  if (!step || index < 0) return;
  exhibits[(index + step + exhibits.length) % exhibits.length]?.click();
};

const mount = () => {
  if (document.querySelector("#gaia-firms-canvas")) return;
  layer = document.querySelector("#japan-layer");
  map = document.querySelector("#japan-map");
  const list = document.querySelector("#japan-firms-mode-list");
  const bank = document.querySelector(".map-mode-bank");
  if (!(layer instanceof HTMLElement) || !(map instanceof HTMLElement) || !(list instanceof HTMLElement) || !(bank instanceof HTMLElement)) return;

  canvas = document.createElement("canvas");
  canvas.id = "gaia-firms-canvas";
  canvas.className = "gaia-firms-canvas";
  canvas.hidden = true;
  canvas.setAttribute("aria-hidden", "true");
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    canvas.dataset.firmsEngine = "context-lost";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    gl = null;
    fireProgram = null;
    backgroundProgram = null;
    fireBuffer = null;
    backgroundBuffer = null;
    initializeWebgl();
    uploadPoints();
  });
  map.append(canvas);

  legend = document.createElement("section");
  legend.className = "gaia-firms-legend";
  legend.hidden = true;
  legend.setAttribute("aria-label", "NASA FIRMS 火災・熱異常の凡例");
  legend.innerHTML = `
    <details class="gaia-metric-legend-details"><summary>凡例・データの詳細</summary>
    <div class="gaia-metric-legend-details-body gaia-firms-legend-body">
    <header><strong>火災放射パワー / FRP</strong><span data-firms-legend-source>読込中</span></header>
    <i aria-hidden="true"></i>
    <div><small>弱い</small><small>50 MW</small><small>200+ MW</small></div>
    <p><span><b class="is-day"></b>昼 / 金橙</span><span><b class="is-night"></b>夜 / 深紅</span><em data-firms-legend-count>—</em></p>
    <div class="gaia-firms-data-time"><span>最新のデータ時刻</span><time data-firms-latest>読込中</time><small data-firms-age>—</small></div>
    <p class="gaia-firms-legend-caption">${DEFINITION.caption} 光点や火柱は演出で、実際の炎の高さではありません。</p>
    </div></details>
  `;
  for (const type of ["pointerdown", "wheel", "keydown", "keyup"]) legend.addEventListener(type, event => {
    if (event.target instanceof Element && event.target.closest("details")) event.stopPropagation();
  });
  layer.append(legend);

  readout = document.createElement("section");
  readout.className = "gaia-firms-readout";
  readout.hidden = true;
  readout.setAttribute("aria-live", "polite");
  readout.innerHTML = `
    <div class="gaia-firms-chapter">
      <p>世界の火災 / NASA FIRMS · 24時間</p>
      <div><button type="button" data-firms-step="-1" aria-label="前の展示、31 沿岸に残る、水の記録へ">‹</button><button type="button" class="gaia-featured-selector-toggle" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover" aria-label="${DEFINITION.number} ${DEFINITION.shortTitle}。展示一覧を開く"><span><b>${DEFINITION.number}</b><strong>${DEFINITION.shortTitle}</strong></span></button><button type="button" data-firms-step="1" aria-label="次の展示、02 風がつなぐ世界へ">›</button></div>
    </div>
    <div class="gaia-firms-count"><p>衛星観測 / 取得時刻の順に表示</p><strong><b data-firms-visible>0</b><span> / <i data-firms-total>—</i> 表示点</span></strong><small data-firms-time>観測待機</small></div>
    <div class="gaia-firms-primary"><p>最大 火災放射パワー</p><strong data-firms-max-frp>—</strong><span>MW</span></div>
    <div class="gaia-firms-timeline">
      <header><span data-firms-coverage>24時間 / 日本時間</span><strong data-firms-status>保存データ</strong></header>
      <input data-firms-progress type="range" min="0" max="1000" step="1" value="0" aria-label="観測時刻を送る" />
      <button type="button" data-firms-play aria-pressed="true">一時停止</button>
    </div>
    <div class="gaia-firms-quality"><span>夜間検知<strong data-firms-night-share>—</strong></span><span>信頼度80以上<strong data-firms-confidence-share>—</strong></span></div>
    <div class="gaia-firms-copy"><p>${DEFINITION.caption}</p><small>光点は火災の範囲ではなく、衛星が検知した熱異常の代表点です。火柱・火の粉は出現時の演出で、実際の炎の高さではありません。信頼度60未満は除外し、FRPを粒径へ変換しています。</small></div>
    <div class="gaia-firms-actions" aria-label="元データと統計分析">
      <button type="button" data-firms-source></button>
      <button type="button" data-firms-analysis></button>
    </div>
  `;
  decorateMapActions(readout.querySelector(".gaia-firms-actions"), readout.querySelector("[data-firms-source]"), readout.querySelector("[data-firms-analysis]"));
  realtimeStatus = createRealtimeStatus();
  readout.querySelector(".gaia-firms-chapter").after(realtimeStatus);
  layer.append(readout);

  button = document.createElement("button");
  button.className = "map-mode-button";
  button.type = "button";
  button.textContent = DEFINITION.number;
  button.dataset.firmsExhibit = DEFINITION.id;
  button.dataset.mapPreviewSurface = "map";
  button.setAttribute("aria-label", `${DEFINITION.number} ${DEFINITION.shortTitle}、NASA FIRMSの全球火災展示へ切り替える`);
  button.setAttribute("aria-describedby", "map-mode-preview");
  button.setAttribute("aria-current", "false");
  button.addEventListener("click", () => { void select(); });
  list.append(button);

  bank.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".map-mode-button") : null;
    if (!(target instanceof HTMLButtonElement) || target.dataset.firmsExhibit || !active) return;
    deactivate();
  }, { capture: true });
  readout.querySelectorAll("[data-firms-step]").forEach((item) => item.addEventListener("click", () => stepOutsideExhibit(item.dataset.firmsStep)));
  readout.querySelector("[data-firms-progress]")?.addEventListener("pointerdown", pausePlayback);
  readout.querySelector("[data-firms-progress]")?.addEventListener("input", (event) => {
    globalThis.GaiaMapDemo?.stop?.("interaction");
    playbackEnabled = false;
    heldPlayback = null;
    manualProgress = clamp01(Number(event.currentTarget.value) / 1000);
    updateTimeline({ progress: manualProgress, extinguish: -1, phase: "scrub" });
  });
  readout.querySelector("[data-firms-play]")?.addEventListener("click", () => {
    if (globalThis.GaiaMapPlayback) globalThis.GaiaMapPlayback.toggle();
    else if (playbackEnabled) pausePlayback(); else resumePlayback();
  });
  addEventListener("gaia:map-playback-resume", resumePlayback);
  addEventListener("resize", () => { if (active) lastRenderedAt = 0; }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(frame);
    else if (active) frame = requestAnimationFrame(draw);
  });
  dispatchEvent(new CustomEvent("gaia:firms-exhibit-mounted"));
};

if (globalThis.GaiaMapObservationAdapter) mount();
else addEventListener("gaia:map-adapter-ready", mount, { once: true });

globalThis.GaiaFirmsExhibit = Object.freeze({
  definition: DEFINITION,
  select,
  deactivate,
  getStatisticsDataset: statisticsDataset,
  getSourceInfo: () => active ? {
    number: DEFINITION.number,
    shortTitle: DEFINITION.shortTitle,
    datasets: [{ id: DEFINITION.id, title: DEFINITION.sourceName, organisation: "NASA LANCE FIRMS", url: SOURCE_PAGE, attributionNote: DEFINITION.caption }],
  } : null,
  findPoiAt,
  pausePlayback,
  getCruiseDuration: () => REVEAL_DELAY_MS + REVEAL_MS + HOLD_MS + EXTINGUISH_MS,
  seekCruise: progress => {
    playbackEnabled = false;
    pausedCycleElapsedMs = clamp01(progress) * (REVEAL_DELAY_MS + REVEAL_MS + HOLD_MS + EXTINGUISH_MS);
    heldPlayback = { ...playbackAtElapsed(pausedCycleElapsedMs), animationElapsed: pausedCycleElapsedMs };
    manualProgress = heldPlayback.progress;
    updateTimeline(heldPlayback);
    const range = readout?.querySelector('[data-firms-progress]');
    if (range) range.value = String(Math.round(manualProgress * 1000));
  },
  setPlayback: value => { explicitPlayback = Boolean(value); if (value) resumePlayback(); else pausePlayback({ transport: true }); },
  getPlaybackState: () => ({ ready: active && Boolean(snapshot), supported: pointCount > 1, playing: active && playbackEnabled,
    detail: '保存された火災検知の時刻を順に表示します。' }),
  getState: () => ({ active, source: snapshot?.source || null, pointCount, playbackEnabled }),
});

export { mount };
