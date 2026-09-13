import assert from "node:assert/strict";
import { collectMeasurements } from "../src/exploration/transforms.js";

// Exercise the actual data module without a network, browser, or fake city values in production.
const names = ["window", "document", "location", "fetch", "EventSource", "dispatchEvent", "GaiaLiveData"];
const descriptors = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const requests = [];
const updates = [];
const streams = [];
const listeners = {};
const payload = (city, value, observedAt = "2026-09-05T01:00:00Z") => ({ source: "live", events: [{
  provider: "open-meteo", datasetId: "weather", status: "latest-published", observedAt,
  location: { label: city, lat: city === "tokyo" ? 35.68 : 43.06, lon: 141.35 },
  measurements: [{ key: "weatherWindSpeed", value, unit: "m/s", quality: "estimated", sourceKind: "MODEL" }],
}] });
const respond = (city, body, status = 200) => {
  const index = requests.findIndex(request => city === "fallback" ? request.url.includes("fallback") : new URL(request.url).searchParams.get("city") === city);
  assert(index >= 0, `No pending request for ${city}`);
  requests.splice(index, 1)[0].resolve({ ok: status === 200, status, json: async () => body });
};
const tick = () => new Promise(resolve => setImmediate(resolve));
let api;
try {
  Object.assign(globalThis, {
    window: globalThis,
    document: { hidden: false, addEventListener: (name, callback) => { listeners[name] = callback; } },
    location: new URL("https://live-loading.test/"),
    dispatchEvent: event => { if (event.type === "gaia:live-update") updates.push(event.detail); },
    fetch: url => new Promise(resolve => requests.push({ url: String(url), resolve })),
    EventSource: class {
      constructor(url) { this.url = String(url); this.listeners = {}; streams.push(this); }
      addEventListener(type, callback) { this.listeners[type] = callback; }
      close() { this.closed = true; }
      emit(type, data) { this.listeners[type]?.({ data: JSON.stringify(data), lastEventId: "qa" }); }
    },
  });
  await import("../src/exploration/live-data.js?v=loading-test");
  api = globalThis.GaiaLiveData;
  assert.equal(api.getState().requestState, "loading");
  const first = api.refresh();
  assert.deepEqual(api.getState().measurements, {});
  respond("sapporo", payload("sapporo", 7.2));
  await first;
  assert.equal(api.getState().measurements.weatherWindSpeed.value, 7.2);
  await api.reconnect();
  const oldStream = streams.at(-1);

  const tokyo = api.selectCity("tokyo");
  assert.deepEqual(api.getState().measurements, {}, "Uncached city must not inherit Sapporo");
  assert.equal(api.getState().requestState, "loading");
  respond("tokyo", payload("tokyo", 3.2));
  await tokyo;
  const beforeStale = api.getState();
  oldStream.emit("provider", payload("sapporo", 999).events[0]);
  oldStream.emit("snapshot", payload("sapporo", 998));
  oldStream.emit("open");
  oldStream.emit("status", { state: "complete" });
  oldStream.onerror();
  assert.equal(api.getState(), beforeStale, "Closed stream callbacks mutated another city");

  const cachedStart = updates.length;
  const sapporo = api.selectCity("sapporo");
  assert.equal(api.getState().measurements.weatherWindSpeed.value, 7.2, "Cached return flashed empty");
  assert.equal(api.getState().requestState, "loading");
  respond("sapporo", payload("sapporo", 8.4, "2026-09-05T02:00:00Z"));
  await sapporo;
  assert(updates.slice(cachedStart).every(state => state.measurements.weatherWindSpeed), "Intermediate cached state lost value");
  const priorTime = api.getState().measurements.weatherWindSpeed.observedAt;
  const failedRefresh = api.refresh();
  respond("sapporo", {}, 503);
  await failedRefresh;
  assert.equal(api.getState().requestState, "unavailable");
  assert.equal(api.getState().measurements.weatherWindSpeed.value, 8.4);
  assert.equal(api.getState().measurements.weatherWindSpeed.observedAt, priorTime);
  streams.at(-1).emit("snapshot", { source: "snapshot", events: payload("tokyo", 55).events });
  assert.equal(api.getState().measurements.weatherWindSpeed.value, 8.4, "Emergency Tokyo snapshot replaced Sapporo cache");

  // A -> B -> A race: the late B response must not publish into A.
  const slowTokyo = api.selectCity("tokyo");
  const fastSapporo = api.selectCity("sapporo");
  respond("sapporo", payload("sapporo", 9.1));
  await fastSapporo;
  respond("tokyo", payload("tokyo", 99));
  assert.equal(await slowTokyo, false);
  assert.equal(api.getState().city, "sapporo");
  assert.equal(api.getState().measurements.weatherWindSpeed.value, 9.1);
  assert.equal(new URL(streams.at(-1).url).searchParams.get("city"), "sapporo");

  const uncached = api.selectCity("sendai");
  assert.equal(api.getState().requestState, "loading");
  assert.deepEqual(api.getState().measurements, {});
  respond("sendai", {}, 503);
  await tick();
  respond("fallback", { ...payload("tokyo", 3.2), source: "snapshot" });
  await uncached;
  assert.deepEqual(api.getState().measurements, {}, "Tokyo fallback was relabeled as Sendai");
  assert.equal(api.getState().requestState, "unavailable");

  const bothFail = api.selectCity("naha");
  respond("naha", {}, 503);
  await tick();
  respond("fallback", {}, 503);
  await bothFail;
  assert.equal(api.getState().requestState, "unavailable", "Failed requests remained loading forever");
  assert.deepEqual(api.getState().measurements, {});
  const emptyRefresh = api.refresh();
  respond("naha", payload("naha", null));
  await emptyRefresh;
  assert.equal(api.getState().requestState, "unavailable");
  assert.deepEqual(api.getState().measurements, {}, "Null was converted into real zero");
  assert.equal(collectMeasurements(payload("naha", 0).events).weatherWindSpeed.value, 0, "Real zero was dropped");
  assert.equal(requests.length, 0);
  console.log("PASS live loading: cold/retained states, city cache isolation, HTTP races, closed SSE, failed refresh, fallback provenance, null/zero");
} finally {
  api?.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
