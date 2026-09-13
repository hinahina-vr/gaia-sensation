import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import { OBSERVATION_CITIES as cities } from "../../src/exploration/observation-cities.js";

// Backend-only dependencies belong to the sensor CI job, not the static web checks.
const source = await fs.readFile(new URL("../src/prefecture-field.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const originalFetch = globalThis.fetch;
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
let requests = 0, failure = false, truncated = false;
globalThis.fetch = async url => {
  requests++;
  if (failure && url.hostname.startsWith("air-quality")) return new Response("offline", { status: 503 });
  assert.equal(url.searchParams.get("latitude").split(",").length, 47);
  assert.equal(url.searchParams.get("longitude").split(",").length, 47);
  const vars = url.searchParams.get("current").split(",");
  assert.equal(url.searchParams.get('hourly'),vars.join(','));
  assert.equal(url.searchParams.get('past_days'),'1');
  const hour = Math.floor(Date.now()/3_600_000)*3_600_000;
  const times = [hour-3_600_000,hour,hour+3_600_000].map(t=>new Date(t).toISOString().slice(0,16));
  const values = cities.map((_, index) => ({ current: { time: "2026-09-06T21:00", ...Object.fromEntries(vars.map(key => [key, index])) },
    hourly: {time:times,...Object.fromEntries(vars.map(key=>[key,[index,index+1,999]]))} }));
  values[1].current[vars[0]] = false;
  values[1].hourly[vars[0]][0] = null;
  values[2].hourly.time = [times[1],times[0],times[2]];
  if (truncated) values.pop();
  return Response.json(values);
};
const memory = new Map();
globalThis.caches = { default: { match: async key => memory.get(key.url)?.clone(), put: async (key, response) => { memory.set(key.url, response); } } };
const pending = [], ctx = { waitUntil: promise => pending.push(promise) };
try {
  const fields = await Promise.all(["weather", "air"].map(provider => api.cachedPrefectureField(provider, cities, true, ctx)));
  await Promise.all(pending);
  assert.equal(requests, 2);
  assert.equal(fields[0].points[0].measurements.weatherWindSpeed, 0);
  assert.equal(fields[0].points[1].measurements.weatherWindSpeed, null);
  assert.equal(fields[0].history.length,2,'Future hours are not historical observations');
  assert.equal(fields[0].history[0].points[0].measurements.weatherWindSpeed,0);
  assert.equal(fields[0].history[0].points[1].measurements.weatherWindSpeed,null);
  assert.equal(fields[0].history[0].points[2].measurements.weatherWindSpeed,3,'Match each city by timestamp, not array position');
  assert.equal(fields[0].history[1].points[2].measurements.weatherWindSpeed,2);
  await api.cachedPrefectureField("weather", cities, true, ctx);
  assert.equal(requests, 2, "Fresh cache reused");
  for (const [key, response] of memory) {
    const data = await response.clone().json(); data.generatedAt = "2020-01-01T00:00:00Z";
    memory.set(key, Response.json(data));
  }
  failure = true;
  const [weather, air] = await Promise.all(["weather", "air"].map(provider => api.cachedPrefectureField(provider, cities, true, ctx)));
  assert.equal(weather.source, "open-meteo");
  assert.equal(air.source, "stale-cache");
  assert.equal(air.points.length, 47);
  memory.clear();
  const unavailable = await api.cachedPrefectureField("air", cities, false, ctx);
  assert.equal(unavailable.source, "unavailable");
  assert(unavailable.points.every(point => Object.values(point.measurements).every(value => value === null)));
  truncated = true;
  await assert.rejects(api.fetchPrefectureField("weather", cities), /count mismatch/);
} finally {
  await Promise.all(pending);
  globalThis.fetch = originalFetch;
  if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
  else delete globalThis.caches;
}
console.log("National provider cache passed: 47 identities, zero/missing, independent caches, disabled providers and failures.");
