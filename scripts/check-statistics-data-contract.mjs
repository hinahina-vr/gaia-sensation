import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { descriptive, analyzeSummary, analyzeCorrelation } from "../statistics-lab-core.js";

const snapshot = JSON.parse(await readFile(new URL("../data/gaia-signals.json", import.meta.url), "utf8"));
const ids = snapshot.modes.map(mode => mode.id);
assert.equal(new Set(ids).size, ids.length, "mode IDs must be unique");
const mode = id => {
  const result = snapshot.modes.find(candidate => candidate.id === id);
  assert.ok(result?.signals && Array.isArray(result.datasets), `missing mode contract: ${id}`);
  return result.signals;
};
const checkSummary = (rows, field, label) => {
  assert.ok(Array.isArray(rows) && rows.length > 0, `${label}: missing rows`);
  const values = rows.map(row => row[field]).filter(Number.isFinite);
  assert.ok(values.length > 1, `${label}: insufficient finite source values`);
  // Independent arithmetic oracle, not a hard-coded count/mean of old data.
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const actual = descriptive(values);
  assert.equal(actual.n, values.length, `${label}: every finite value counted`);
  assert.equal(actual.mean, mean, `${label}: mean`);
  assert.equal(actual.median, median, `${label}: median`);
  assert.equal(actual.populationVariance, variance, `${label}: variance`);
  assert.ok(analyzeSummary({ values, label }).insight?.meaning);
  return values.length;
};
const rainfallCount = checkSummary(mode("forest-cloud-engine").precipitation, "precipitationMmDay", "rainfall");
const waste = mode("nothing-is-waste").countryWaste;
assert.ok(waste.every(row => ["SOURCE", "IMPUTED", "DERIVED"].includes(row.valueStatus)), "waste provenance must remain explicit");
const wasteCount = checkSummary(waste, "recyclePercent", "waste");
checkSummary(mode("breathing-earth").co2, "deseasonalizedPpm", "CO2");
const paired = mode("three-ecologies").pairedCountries;
assert.ok(paired.length > 1 && paired.every(row => Number.isFinite(row.forestPercent) && Number.isFinite(row.urbanPercent)));
assert.ok(analyzeCorrelation({ x: paired.map(row => row.forestPercent), y: paired.map(row => row.urbanPercent), xLabel: "森林率", yLabel: "都市化率" }).insight);
const events = mode("rhythm-of-disaster").globalEvents;
assert.ok(events.length > 0 && events.every(row => Number.isFinite(Date.parse(row.occurredAt))), "event dates are parseable");
console.log(JSON.stringify({ status: "passed", kind: "current-snapshot-contract", modes: ids.length, rainfallCount, wasteCount, snapshotGeneratedAt: snapshot.generatedAt }));
