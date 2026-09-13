import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { countryCatalog, buildEmissions, buildLatest, buildWaste, coverage } from "./country-coverage-data.mjs";
import { enrichSnapshotWithStatistics } from "./statistics.mjs";

const snapshot = JSON.parse(await readFile(new URL("../data/gaia-signals.json", import.meta.url), "utf8"));
const mode = id => snapshot.modes.find(row => row.id === id);
const climate = mode("blue-circulation").signals.climate;
const rain = mode("forest-cloud-engine").signals.precipitation;
const waste = mode("nothing-is-waste").signals.countryWaste;
const emissions = mode("anthropocene-scar").signals.emissions;
const ecology = mode("three-ecologies").signals;
const codes = rows => [...new Set(rows.map(row => row.iso3))].sort();
assert(climate.length >= 230); assert(rain.length >= 230);
assert(waste.length >= 90); assert(codes(emissions).length >= 210); assert(ecology.pairedCountries.length >= 210);
for (const rows of [climate, rain, waste, ecology.pairedCountries]) assert.equal(codes(rows).length, rows.length);
assert.equal(new Set(emissions.map(row => `${row.iso3}:${row.year}`)).size, emissions.length);
for (const rows of [climate, rain, waste, emissions, ecology.pairedCountries]) {
  assert(rows.every(row => row.countryJa && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90 && Number.isFinite(row.lon) && Math.abs(row.lon) <= 180));
  assert(rows.every(row => !["WLD", "AFE", "AFW", "EUU", "SUN", "XIA", "XIS"].includes(row.iso3)));
}
for (const code of ["DEU", "FRA", "RUS", "PAK", "ETH", "KAZ", "COL", "KOR", "XKX"]) {
  assert(climate.some(row => row.iso3 === code)); assert(rain.some(row => row.iso3 === code));
  assert(emissions.some(row => row.iso3 === code && row.year === 2023));
  if (code !== "XKX") assert(ecology.pairedCountries.some(row => row.iso3 === code));
}
assert(!ecology.pairedCountries.some(row => row.iso3 === "XKX"), "Missing Kosovo forest indicator must remain missing");
assert(waste.some(row => row.iso3 === "DEU")); assert(waste.some(row => row.iso3 === "FRA"));
assert(waste.every(row => row.valueStatus === "SOURCE" && Number.isInteger(row.year) && row.recyclePercent >= 0 && row.recyclePercent <= 100 && Array.isArray(row.footnotes)));
assert(waste.some(row => row.recyclePercent === 0), "Actual zero values must remain");
assert(!waste.some(row => row.iso3 === "MYS" && (!row.datasetId || row.datasetId === "un-sdg")), "Out-of-range UN value must remain excluded; another source may supplement it");
assert.equal(mode("nothing-is-waste").signals.countryCoverage.excludedSourceValues.find(row => row.iso3 === "MYS").recyclePercent, 177.65764);
assert.equal(emissions.find(row => row.iso3 === "XKX").mapIso3, "KOS");
assert.equal(emissions.find(row => row.iso3 === "XKX").sourceIso3, "KSV");
for (const iso3 of ["AUS", "SOM", "CYP", "FRA", "NOR"]) {
  assert.equal(emissions.find(row => row.iso3 === iso3).mapIso3, iso3, `${iso3} must not inherit a dependency/disputed subregion polygon`);
}
assert.equal(ecology.social.find(row => row.iso3 === "CHI").countryJa, "チャネル諸島");
assert.equal(ecology.social.find(row => row.iso3 === "CHI").mapIso3, null);
assert(!climate.some(row => row.iso3 === "CHI"), "Combined economy must not duplicate the Jersey climate point");
assert(emissions.filter(row => row.year === 1955).length >= 180);
assert(emissions.filter(row => row.year === 1945).length < emissions.filter(row => row.year === 2023).length);
assert(rain.every(row => row.precipitationMmDay >= 0 && /2001.*2020/.test(row.period)));
assert(climate.every(row => row.windSpeedMs >= 0 && row.windDirectionDeg >= 0 && row.windDirectionDeg <= 360));
for (const row of ecology.pairedCountries) {
  const f = ecology.ecological.find(r => r.iso3 === row.iso3), u = ecology.social.find(r => r.iso3 === row.iso3);
  assert.equal(row.forestPercent, f.forestPercent); assert.equal(row.forestYear, f.year);
  assert.equal(row.urbanPercent, u.urbanPercent); assert.equal(row.urbanYear, u.year);
}
// Regression: running the separate statistics builder must not reduce global coverage to 31 points.
const isolated = { generatedAt: snapshot.generatedAt, modes: [structuredClone(mode("nothing-is-waste")), structuredClone(mode("earth-organ"))] };
enrichSnapshotWithStatistics(isolated);
assert.deepEqual(isolated.modes[0].signals.countryWaste, waste);

const site = { iso3: "AAA", m49: "001", worldBankEconomy: true };
assert.deepEqual(buildLatest([{ countryiso3code: "AAA", date: "2024", value: null }], [site], "forestPercent"), []);
assert.equal(buildLatest([{ countryiso3code: "AAA", date: "2024", value: 0 }], [site], "forestPercent")[0].forestPercent, 0);
assert.deepEqual(buildEmissions('Country,ISO 3166-1 alpha-3,Year,Total\nA,AAA,2000,0\nA,AAA,2001,\nWorld,WLD,2000,123', [site]).map(row => [row.year, row.emissionsMtCo2]), [[2000, 0]]);
assert.equal(coverage([{ iso3: "AAA", year: 2000 }], [site, { iso3: "BBB" }]).missingCountries[0], "BBB");

// Optional reproducible all-row comparison with downloaded public source responses.
if (process.argv[2]) {
  const cache = resolve(process.argv[2]);
  const read = async name => JSON.parse(await readFile(resolve(cache, `${name}.json`), "utf8")).text;
  const geography = JSON.parse(await readFile(new URL("../data/natural-earth-50m-countries.geojson", import.meta.url), "utf8"));
  const catalog = countryCatalog(geography, JSON.parse(await read("countries-1"))[1], mode("earth-organ").signals.potential);
  assert.deepEqual(emissions, buildEmissions(await read("emissions"), catalog));
  assert.deepEqual(ecology.ecological, buildLatest(JSON.parse(await read("forest-1"))[1], catalog, "forestPercent"));
  assert.deepEqual(ecology.social, buildLatest(JSON.parse(await read("urban-1"))[1], catalog, "urbanPercent"));
  assert.deepEqual(waste.filter(row => !row.datasetId || row.datasetId === "un-sdg"), buildWaste(JSON.parse(await read("waste-1")).data, catalog));
  for (const row of climate) {
    const raw = JSON.parse(await read(`power-${row.iso3}`)).properties.parameter;
    assert.equal(row.windSpeedMs, raw.WS10M.ANN); assert.equal(row.windDirectionDeg, raw.WD10M.ANN);
    assert.equal(rain.find(r => r.iso3 === row.iso3).precipitationMmDay, raw.PRECTOTCORR.ANN);
  }
  const prior = JSON.parse(execFileSync("git", ["show", "HEAD:data/gaia-signals.json"], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 }));
  const affected = new Set(["blue-circulation", "forest-cloud-engine", "nothing-is-waste", "anthropocene-scar", "three-ecologies"]);
  for (const m of prior.modes.filter(m => !affected.has(m.id))) assert.deepEqual(mode(m.id), m, `Unrelated mode changed: ${m.id}`);
  assert.deepEqual(mode("blue-circulation").signals.currents, prior.modes.find(m => m.id === "blue-circulation").signals.currents);
  console.log("PASS all source rows/units, exact existing CO2 version, unchanged unrelated modes and ocean currents");
}
console.log(`PASS coverage: wind ${climate.length}, rain ${rain.length}, recycling ${waste.length}, CO2 ${codes(emissions).length}, forest/urban ${ecology.pairedCountries.length}; null/zero, historical gaps, Kosovo, Channel Islands, no re-imputation`);
