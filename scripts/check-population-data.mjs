import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPopulationData } from "./population-data.mjs";

const snapshot = JSON.parse(await readFile(new URL("../data/gaia-signals.json", import.meta.url), "utf8"));
const geography = JSON.parse(await readFile(new URL("../data/natural-earth-50m-countries.geojson", import.meta.url), "utf8"));
const { population: rows, populationCoverage: coverage } = snapshot.modes.find(mode => mode.id === "population-tide").signals;
const countries = rows.filter(row => row.year === 2025).map(row => ({ id: row.iso3, iso2Code: row.iso2, name: row.country, region: { id: "test-non-aggregate" } }));
const observations = rows.map(row => ({ countryiso3code: row.iso3, date: String(row.year), value: row.population }));
const fixture = [
  ...observations,
  { countryiso3code: "PSE", date: "1967", value: null },
  { countryiso3code: "WLD", date: "1967", value: 3440000000 },
  { countryiso3code: "EUU", date: "1967", value: 380000000 },
];
const rebuilt = buildPopulationData([...countries,
  { id: "WLD", region: { id: "NA" } }, { id: "EUU", region: { id: "NA" } },
], fixture, geography, coverage.sourceLastUpdated);
assert.deepEqual(rebuilt.rows, rows, "global import should preserve values and country label positions exactly");
assert.deepEqual(rebuilt.coverage, coverage);
assert.equal(rebuilt.coverage.missingCountryYears, 30);
assert.equal(new Set(rows.map(row => `${row.iso3}:${row.year}`)).size, rows.length);
assert.throws(() => buildPopulationData(countries, [...fixture, observations[0]], geography), /Duplicate population/);
assert.throws(() => buildPopulationData(countries, [{ ...observations[0], value: "" }], geography), /Invalid population observation/);
assert.throws(() => buildPopulationData(countries, [{ ...observations[0], value: -1 }], geography), /Invalid population observation/);
assert.throws(() => buildPopulationData(countries.slice(0, 31), observations, geography), /coverage unexpectedly incomplete/);
console.log(`PASS population import: ${rows.length} original values; 217 countries/economies; aggregates excluded; nulls omitted; duplicate/invalid/truncated data rejected`);
