import { createGaiaStore } from "./state.js";
import { collectMeasurements } from "./transforms.js?v=gaia-live-loading-1";
import { livePeriods, liveFieldAt, liveStateAt } from "./live-timeline.js?v=hourly-20260912";

const FALLBACK_URL = "./data/live-observation-fallback-v1.json";
const PREFECTURE_FALLBACK_URL = "./data/live-prefecture-fallback-v1.json";
const RETRY_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000];
const WIND_FIELD_REFRESH_MS = 5 * 60 * 1_000;
const store = createGaiaStore({ events: [], measurements: {}, connected: false, source: "loading", requestState: "loading", lastEventId: "" });
// Last successful values belong to a city, never to the currently visible label.
const citySnapshots = new Map();
let eventSource = null;
let retryIndex = 0;
let retryTimer = 0;
let activeCity = "sapporo";
let loadGeneration = 0;
let windFieldRefreshTimer = 0;
let windField = Object.freeze({ schemaVersion: 1, source: "unavailable", generatedAt: "", points: [] });
let prefectureField = Object.freeze({ requestState: "loading" });
let prefectureRequest = null;
let selectedTime = null;
let selectedField = null;
let displayCache = null;
const displayView = () => {
  const base = store.getState(), field = selectedField || prefectureField;
  if (displayCache?.base === base && displayCache.field === field && displayCache.city === activeCity && displayCache.time === selectedTime) return displayCache;
  const viewField = liveFieldAt(field, selectedTime);
  displayCache = { base, field, city: activeCity, time: selectedTime, viewField,
    state: liveStateAt(base, field, activeCity, selectedTime),
    wind: selectedTime ? { ...viewField.weather, points: (viewField.weather?.points || []).map(point => ({ ...point,
      windSpeed: point.measurements?.weatherWindSpeed ?? null })) } : windField };
  return displayCache;
};

const permitsLiveEndpoint = () => location.protocol === "https:" || new URLSearchParams(location.search).get("live") === "1";
const publish = (events, source, connected = store.getState().connected, requestState = "ready") => {
  const measurements = collectMeasurements(events);
  const next = store.setState({ events, measurements, source, connected, requestState, city: activeCity });
  if (requestState === "ready" && Object.keys(measurements).length) {
    citySnapshots.set(activeCity, { events, source });
    if (citySnapshots.size > 64) citySnapshots.delete(citySnapshots.keys().next().value);
  }
  globalThis.dispatchEvent(new CustomEvent("gaia:live-update", { detail: next }));
};

const readJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Live snapshot ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const liveEndpoint = (pathname) => {
  const endpoint = new URL(pathname, location.origin);
  endpoint.searchParams.set("city", activeCity);
  return endpoint;
};

const publishWindField = (payload) => {
  const points = Array.isArray(payload?.points) ? payload.points : [];
  windField = Object.freeze({ ...payload, points: Object.freeze(points.map((point) => Object.freeze({ ...point }))) });
  globalThis.dispatchEvent(new CustomEvent("gaia:live-wind-field", { detail: windField }));
  return windField;
};

const publishPrefectureField = payload => {
  prefectureField = Object.freeze(payload);
  const weather = payload.weather;
  publishWindField({ ...weather, points: (weather?.points || []).map(point => ({ ...point,
    windSpeed: point.measurements?.weatherWindSpeed ?? null,
    quality: point.measurements?.weatherWindSpeed == null ? "missing" : "estimated",
  })) });
  globalThis.dispatchEvent(new CustomEvent("gaia:live-prefecture-field", { detail: prefectureField }));
  return prefectureField;
};

const loadPrefectureField = () => {
  if (prefectureRequest) return prefectureRequest;
  publishPrefectureField({ ...prefectureField, requestState: "loading" });
  prefectureRequest = (async () => {
    let payload;
    try {
      payload = await readJson(permitsLiveEndpoint() ? new URL("/api/live/v1/prefecture-field", location.origin) : PREFECTURE_FALLBACK_URL);
      if (payload?.scope !== "japan-prefectures" || !Array.isArray(payload.weather?.points) || !Array.isArray(payload.air?.points)) throw new Error("National field malformed");
    } catch {
      payload = { ...prefectureField };
      for (const provider of ["weather", "air"]) {
        if (payload[provider]?.points?.length) payload[provider] = { ...payload[provider], source: payload[provider].source === "snapshot" ? "snapshot" : "stale-cache" };
      }
      if (!payload.weather?.points?.length && !payload.air?.points?.length) {
        try { payload = await readJson(PREFECTURE_FALLBACK_URL); } catch { payload = {}; }
      }
    }
    const available = [payload.weather, payload.air].some(field => field?.points?.some(point => Object.values(point.measurements || {}).some(Number.isFinite)));
    return publishPrefectureField({ ...payload, requestState: available ? "ready" : "unavailable" });
  })().finally(() => { prefectureRequest = null; });
  return prefectureRequest;
};

const loadWindField = loadPrefectureField;

const scheduleWindFieldRefresh = () => {
  clearInterval(windFieldRefreshTimer);
  windFieldRefreshTimer = 0;
  if (!permitsLiveEndpoint()) return;
  windFieldRefreshTimer = window.setInterval(() => {
    if (!document.hidden) void loadWindField();
  }, WIND_FIELD_REFRESH_MS);
};

const fallbackEventsForCity = (payload, city) => (
  // The bundled emergency snapshot is explicitly a Tokyo snapshot. Reusing
  // those measurements after another city is selected would falsely relabel
  // Tokyo data as local data, so other cities stay in the honest missing-data
  // state until their live model response arrives.
  city === "tokyo" ? (payload.events || []) : []
);

const publishSnapshot = (payload, city) => {
  const source = payload.source || (permitsLiveEndpoint() ? "live" : "snapshot");
  const events = source === "snapshot" || !permitsLiveEndpoint()
    ? fallbackEventsForCity(payload, city) : (payload.events || []);
  const cached = citySnapshots.get(city);
  if (!Object.keys(collectMeasurements(events)).length && cached) {
    publish(cached.events, cached.source, false, "unavailable");
  } else {
    publish(events, source, false, Object.keys(collectMeasurements(events)).length ? "ready" : "unavailable");
  }
};

const loadSnapshot = async () => {
  const generation = ++loadGeneration;
  const city = activeCity;
  const previous = store.getState();
  publish(previous.events, previous.source, previous.connected, "loading");
  try {
    const payload = await readJson(permitsLiveEndpoint() ? liveEndpoint("/api/live/v1/snapshot") : FALLBACK_URL);
    if (generation !== loadGeneration || city !== activeCity) return null;
    publishSnapshot(payload, city);
    return payload;
  } catch (error) {
    if (generation !== loadGeneration || city !== activeCity) return null;
    console.warn("Live snapshot unavailable; using the versioned snapshot.", error);
    const cached = citySnapshots.get(city);
    if (cached) {
      publish(cached.events, cached.source, false, "unavailable");
      return cached;
    }
    try {
      const payload = await readJson(FALLBACK_URL);
      if (generation !== loadGeneration || city !== activeCity) return null;
      publishSnapshot({ ...payload, source: "snapshot" }, city);
      return payload;
    } catch {
      if (generation !== loadGeneration || city !== activeCity) return null;
      publish([], "unavailable", false, "unavailable");
      return { source: "unavailable", events: [] };
    }
  }
};

const closeStream = () => {
  eventSource?.close();
  eventSource = null;
  clearTimeout(retryTimer);
  retryTimer = 0;
  if (store.getState().connected) store.setState({ connected: false });
};

const scheduleReconnect = () => {
  closeStream();
  if (document.hidden || !permitsLiveEndpoint()) return;
  const delay = RETRY_DELAYS[Math.min(retryIndex, RETRY_DELAYS.length - 1)];
  retryIndex += 1;
  retryTimer = window.setTimeout(() => void connectStream(), delay);
};

const mergeProvider = (providerEvent) => {
  // NOAA publishes independent NDBC and GML events. Replace only the same
  // dataset so a wind update cannot erase the CO₂ value (or vice versa).
  const events = store.getState().events.filter((event) => !(
    event.provider === providerEvent.provider
    && event.datasetId === providerEvent.datasetId
  ));
  events.push(providerEvent);
  const current = store.getState();
  publish(events, current.source === "snapshot" ? "snapshot" : "live", current.connected);
};

const connectStream = async () => {
  if (eventSource || document.hidden || !permitsLiveEndpoint()) return;
  const lastEventId = store.getState().lastEventId;
  const endpoint = liveEndpoint("/api/live/v1/stream");
  if (lastEventId) endpoint.searchParams.set("lastEventId", lastEventId);
  const city = activeCity;
  const stream = new EventSource(endpoint);
  eventSource = stream;
  const isCurrent = () => eventSource === stream && activeCity === city;
  stream.addEventListener("open", () => {
    if (!isCurrent()) return;
    retryIndex = 0;
    store.setState({ connected: true });
  });
  stream.addEventListener("snapshot", (message) => {
    if (!isCurrent()) return;
    const payload = JSON.parse(message.data);
    store.setState({ lastEventId: message.lastEventId || store.getState().lastEventId });
    const source = payload.source || "live";
    const events = source === "snapshot" ? fallbackEventsForCity(payload, city) : (payload.events || []);
    const cached = citySnapshots.get(city);
    const hasValues = Object.keys(collectMeasurements(events)).length > 0;
    publish(hasValues ? events : cached?.events || events, hasValues ? source : cached?.source || source,
      source !== "snapshot", hasValues ? "ready" : "unavailable");
    if (source === "snapshot") scheduleReconnect();
  });
  stream.addEventListener("provider", (message) => {
    if (!isCurrent()) return;
    store.setState({ lastEventId: message.lastEventId || store.getState().lastEventId });
    mergeProvider(JSON.parse(message.data));
  });
  stream.addEventListener("status", (message) => {
    if (!isCurrent()) return;
    const payload = JSON.parse(message.data);
    if (payload.state === "complete") scheduleReconnect();
  });
  stream.onerror = () => { if (isCurrent()) scheduleReconnect(); };
};

const selectCity = async (city) => {
  const requested = String(city || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,32}$/u.test(requested)) return false;
  if (requested === activeCity) return true;
  closeStream();
  activeCity = requested;
  store.setState({ lastEventId: "", connected: false });
  const cached = citySnapshots.get(requested);
  publish(cached?.events || [], cached?.source || "loading", false, "loading");
  globalThis.dispatchEvent(new CustomEvent("gaia:live-city-change", { detail: { city: activeCity, state: "loading" } }));
  const snapshot = await loadSnapshot();
  if (!snapshot || requested !== activeCity) return false;
  if (snapshot.source !== "snapshot") await connectStream();
  globalThis.dispatchEvent(new CustomEvent("gaia:live-city-change", { detail: { city: requested, state: store.getState().requestState } }));
  return true;
};

const mount = async () => {
  const [snapshot] = await Promise.all([loadSnapshot(), loadWindField()]);
  if (snapshot && snapshot.source !== "snapshot") await connectStream();
  scheduleWindFieldRefresh();
};

document.addEventListener("visibilitychange", async () => {
  if (document.hidden) closeStream();
  else {
    const [snapshot] = await Promise.all([loadSnapshot(), loadWindField()]);
    if (snapshot && snapshot.source !== "snapshot") await connectStream();
  }
});
globalThis.GaiaLiveData = Object.freeze({
  mount,
  refresh: loadSnapshot,
  refreshWindField: loadWindField,
  refreshPrefectureField: loadPrefectureField,
  reconnect: connectStream,
  close: closeStream,
  selectCity,
  getCity: () => activeCity,
  getState: () => displayView().state,
  getLatestState: () => liveStateAt(store.getState(), prefectureField, activeCity, null),
  getWindField: () => selectedTime ? displayView().wind : windField,
  getPrefectureField: () => displayView().viewField,
  getPeriods: key => livePeriods(selectedField || prefectureField, key),
  getSelectedTime: () => selectedTime,
  selectTime: time => {
    selectedTime = time || null;
    // Keep a dragged history window stable across the next periodic refresh.
    selectedField = selectedTime ? selectedField || prefectureField : null;
    displayCache = null;
    dispatchEvent(new CustomEvent('gaia:live-time-change', { detail: { time: selectedTime } }));
  },
});

export { mount };
