import assert from "node:assert/strict";
import { buildPlanetStatistics } from "../src/exploration/planet-statistics.js";
import "./check-live-national-analysis.mjs";

for (const [renderer, key, unit] of [["wind", "windSpeed", "m/s"], ["air", "pm25", "µg/m³"], ["quake", "magnitude", "M"], ["cloud", "radiation", "W/m²"]]) {
  const definition = { id: renderer, renderer, number: "27", shortTitle: "QA", sourceName: "provider", sourcePage: "https://example.org" };
  const data = { sourceState: "LIVE", observedAt: "2026-09-05", points: [0, 8, null, NaN].map((value, i) => ({ id: String(i), [key]: value, time: 123000 + i })) };
  const result = buildPlanetStatistics(definition, data);
  assert.deepEqual(result.rows.map(row => row.value), [0, 8]);
  assert.equal(result.unit, unit);
  assert(result.rows.every(row => row.provenance === "SOURCE"));
  assert.equal(result.sourceUrl, definition.sourcePage);
  assert.equal(buildPlanetStatistics(definition, { ...data, sourceState: "SAVED VALUES" }), null);
  assert.equal(buildPlanetStatistics(definition, { ...data, points: [] }), null);
}
console.log("MAP action statistics passed: actual planet metrics and national live scope.");
