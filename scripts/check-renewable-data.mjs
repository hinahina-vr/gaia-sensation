import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRenewableData, renewableDataset } from "./renewable-data.mjs";

const countries = [["JPN", "JP"], ["FRA", "FR"], ["DEU", "DE"], ["GBR", "GB"], ["WLD", "1W"]].map(([id, iso2Code]) => ({
  id, iso2Code, name: id, region: { id: id === "WLD" ? "NA" : "TEST" }, latitude: "10", longitude: "20",
}));
const observation = (countryiso3code, date, value) => ({ countryiso3code, date: String(date), value });
const observations = [observation("JPN", 2021, null), observation("JPN", 2019, 10), observation("JPN", 2020, 20),
  observation("FRA", 2021, 0), observation("DEU", 2021, 55), observation("GBR", 2021, null), observation("WLD", 2021, 80)];
const geography = { features: [{ properties: { ADM0_A3: "DEU", WB_A3: "DEU", LABEL_X: 11, LABEL_Y: 51 } }] };
const reference = [{ id: "japan", iso3: "JPN", lat: 36, lon: 138 }];
const before = JSON.stringify([countries, observations, geography, reference]);
const result = buildRenewableData(countries, observations, geography, reference, "2026-07-13");
assert.deepEqual(result.rows.map(row => [row.iso3, row.year, row.renewablePercent]), [["DEU", 2021, 55], ["FRA", 2021, 0], ["JPN", 2020, 20]]);
assert.equal(result.rows.find(row => row.iso3 === "JPN").id, "japan");
assert.equal(result.rows.find(row => row.iso3 === "JPN").lat, 36, "Climate reference point moved");
assert.equal(result.rows.find(row => row.iso3 === "DEU").lon, 11);
assert.deepEqual(result.coverage.missingCountries, ["GBR"]);
assert.equal(result.coverage.aggregatesExcluded, true);
assert.equal(JSON.stringify([countries, observations, geography, reference]), before, "Builder mutated inputs");
assert.throws(() => buildRenewableData(countries, [...observations, observation("JPN", 2020, 15)], geography), /Duplicate/);
for (const value of [-1, 101, "50", NaN, Infinity]) assert.throws(() => buildRenewableData(countries, [observation("JPN", 2021, value)], geography), /Invalid/);
const metadata = renewableDataset(result, "2026-09-06T12:00:00Z");
assert.match(metadata.caveat, /同一年の順位ではありません.*未収録を0%で埋めません/);

const snapshot = JSON.parse(fs.readFileSync(new URL("../data/gaia-signals.json", import.meta.url), "utf8"));
const mode = snapshot.modes.find(mode => mode.id === "earth-organ");
const rows = mode.signals.current, coverage = mode.signals.renewableCoverage;
const dataset = mode.datasets.find(dataset => dataset.id === "worldbank-renewable");
assert(rows.length >= 200, "The 31-country sample was not expanded");
assert.equal(new Set(rows.map(row => row.iso3)).size, rows.length);
assert.equal(rows.length, coverage.countryCount);
assert.equal(coverage.countryCount + coverage.missingCountries.length, coverage.economyCount);
assert.equal(coverage.aggregatesExcluded, true);
assert.equal(mode.signals.potential.length, 31, "Missing climate data was filled or substituted");
for (const code of ["DEU", "FRA", "NOR", "BTN", "CRI", "PRY", "GIB", "XKX", "PSE"]) assert(rows.some(row => row.iso3 === code), `New country missing: ${code}`);
for (const code of coverage.missingCountries) assert(!rows.some(row => row.iso3 === code));
assert.equal(rows.find(row => row.iso3 === "CAN").renewablePercent, 67.0163805768966);
assert.equal(rows.find(row => row.iso3 === "GIB").renewablePercent, 0);
assert.equal(rows.find(row => row.iso3 === "BTN").renewablePercent, 100);
assert(rows.every(row => row.countryJa && Number.isFinite(row.lat) && Number.isFinite(row.lon) && row.renewablePercent >= 0 && row.renewablePercent <= 100));
assert.deepEqual(dataset.preview, rows.slice(0, 10));
assert.equal(dataset.license, "CC BY 4.0");
assert.match(dataset.resolution, new RegExp(String(rows.length)));
const mapped = rows.filter(row => row.mapIso3);
assert.equal(new Set(mapped.map(row => row.mapIso3)).size, mapped.length, "Two economies were assigned the same shape");
console.log(`PASS renewable data: ${rows.length} countries/economies, ${mapped.length} mapped + ${coverage.pointOnlyCountries.length} point-only; latest years, true zero, no aggregates/fill, 31 climate points preserved`);
