import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDatasets, buildAnnualDataset, finiteNumber } from "../statistics-datasets.js";
const snapshot = JSON.parse(fs.readFileSync(new URL("../data/gaia-signals.json", import.meta.url), "utf8"));
const before = structuredClone(snapshot);
const datasets = buildDatasets(snapshot);
assert.deepEqual(snapshot, before, "adapters must not mutate their snapshot");
assert.equal(new Set(datasets.map(dataset => dataset.id)).size, datasets.length);
const rainfall = snapshot.modes.find(mode => mode.id === "forest-cloud-engine").signals.precipitation;
assert.equal(datasets.find(dataset => dataset.id === "rainfall").rows.length, rainfall.length);
assert.deepEqual(datasets.find(dataset => dataset.id === "rainfall").rows.map(row => row.value), rainfall.map(row => row.precipitationMmDay));
for (const id of ["wind-climate", "rainfall", "waste", "forest-urban"]) {
  const dataset = datasets.find(candidate => candidate.id === id);
  assert(dataset.title.startsWith(String(dataset.rows.length)), `${id}: stale hard-coded row count in title`);
}
const changed = structuredClone(snapshot);
changed.modes.find(mode => mode.id === "forest-cloud-engine").signals.precipitation = rainfall.slice(0, 2);
assert.equal(buildDatasets(changed).find(dataset => dataset.id === "rainfall").title, "2地点の平均降水量");
for (const missing of [null, undefined, "", false, true, "missing", NaN, Infinity]) assert.equal(finiteNumber(missing), null);
assert.equal(finiteNumber(0), 0);
assert.equal(finiteNumber("0"), 0);
const sparse = { modes: [{ id: "population-tide", signals: { population: [
  { iso3: "AAA", country: "A", year: 2000, population: 0 },
  { iso3: "BBB", country: "B", year: 2000, population: 100 },
  { iso3: "AAA", country: "A", year: 2001, population: 10 },
  { iso3: "BBB", country: "B", year: 2001, population: null },
] } }] };
const first = buildAnnualDataset(sparse, "population-tide", 0);
const last = buildAnnualDataset(sparse, "population-tide", 100);
assert.deepEqual(first.rows.map(row => row.value), [0, 100]);
assert.deepEqual(last.rows.map(row => row.value), [10], "missing country-year is not replaced by zero or an older value");
assert.equal(first.periodStart, "2000");
assert.equal(last.periodStart, "2001");
console.log(JSON.stringify({ status: "passed", datasets: datasets.length, checks: ["pure adapters", "identical rainfall values", "finite/missing distinction", "annual boundaries", "no stale-year filling"] }));
