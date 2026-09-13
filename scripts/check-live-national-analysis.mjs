import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { OBSERVATION_CITIES as cities } from "../src/exploration/observation-cities.js";
import { LIVE_EXHIBITS } from "../src/exploration/live-exhibit-catalog.js";
import { buildLiveStatistics } from "../src/exploration/live-statistics.js";
import { statisticsAiSnapshot } from "../statistics-ai.js";

const saved = JSON.parse(await fs.readFile(new URL("../data/live-prefecture-fallback-v1.json", import.meta.url), "utf8"));
assert.equal(cities.length, 47);
for (const exhibit of LIVE_EXHIBITS) {
  const result = buildLiveStatistics(exhibit, {}, {}, saved);
  assert.equal(result.rows.length, 47, exhibit.id);
  assert.deepEqual(result.rows.map(row => row.id), cities.map(city => city.id));
  assert.match(result.title, /47\/47都道府県/);
  assert.equal(result.coverage.missingCount, 0);
  assert.equal(result.insightContext.axis, "locations");
  const ai = statisticsAiSnapshot({ dataset: result, rows: result.rows, method: { group: { name: "summary" }, label: "summary" }, result: {} });
  assert.equal(ai.selection.sentRows, 47);
  assert.equal(ai.dataset.measurementKind, "MODEL");
  assert.equal(ai.dataset.coverage.targetCount, 47);
  assert(ai.samples.every(row => row.observedAt));
  assert.equal(buildLiveStatistics(exhibit, { measurements: { [exhibit.key]: { value: 42 } } }), null, "Never fall back to one selected point");
  const provider = ["forecastCo2", "pm25"].includes(exhibit.key) ? "air" : "weather";
  for (const value of [null, undefined, NaN, Infinity, false, true, "", " ", "0"]) {
    const partial = structuredClone(saved);
    partial[provider].points[0].measurements[exhibit.key] = value;
    const dataset = buildLiveStatistics(exhibit, {}, {}, partial);
    assert.equal(dataset.rows.length, 46);
    assert.equal(dataset.coverage.missingCount, 1);
  }
  const zero = structuredClone(saved);
  zero[provider].points[0].measurements[exhibit.key] = 0;
  assert.equal(buildLiveStatistics(exhibit, {}, {}, zero).rows[0].value, 0);
  zero[provider].points.reverse();
  assert.equal(buildLiveStatistics(exhibit, {}, {}, zero).rows[0].id, cities[0].id, "Identity, not response order");
  zero[provider].source = "stale-cache";
  assert.match(buildLiveStatistics(exhibit, {}, {}, zero).sourceName, /更新失敗/);
}

console.log("National analysis passed: 15–20, 47 IDs, finite/zero/missing, AI 47 rows and model provenance.");
