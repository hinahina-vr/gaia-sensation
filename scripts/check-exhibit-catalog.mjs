import assert from "node:assert/strict";
import fs from "node:fs";
import { OBSERVATION_CITIES, findObservationCity, adjacentObservationCity } from "../src/exploration/observation-cities.js";
import { LIVE_EXHIBITS } from "../src/exploration/live-exhibit-catalog.js";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";

// These data modules must work in Node without browser globals or a mounted map.
assert.equal(globalThis.GaiaLiveExhibits, undefined);
assert.equal(globalThis.GaiaEstatExhibits, undefined);
for (const records of [OBSERVATION_CITIES, LIVE_EXHIBITS, ESTAT_EXHIBITS]) {
  assert(Object.isFrozen(records));
  assert(records.every(Object.isFrozen));
  assert.equal(new Set(records.map(record => record.id)).size, records.length);
}

assert.equal(OBSERVATION_CITIES.length, 47);
for (const [index, city] of OBSERVATION_CITIES.entries()) {
  assert.equal(city.code, String(index + 1).padStart(2, "0"));
  assert.equal(city.name, `${city.prefecture} / ${city.city}`);
  assert.equal(city.label, `${city.prefecture}・${city.city}`);
  assert(Number.isFinite(city.lat) && city.lat >= -90 && city.lat <= 90);
  assert(Number.isFinite(city.lon) && city.lon >= -180 && city.lon <= 180);
  assert.equal(findObservationCity(city.id), city);
  for (const direction of [-1, 0, 1]) {
    const expected = OBSERVATION_CITIES[(index + direction + 47) % 47];
    assert.equal(adjacentObservationCity(city.id, direction), expected);
  }
}
assert.equal(adjacentObservationCity("naha", 1).id, "sapporo");
assert.equal(adjacentObservationCity("sapporo", -1).id, "naha");
for (const unknown of ["unknown", "", null, undefined]) {
  assert.equal(findObservationCity(unknown), undefined);
  for (const direction of [-1, 0, 1]) {
    assert.equal(adjacentObservationCity(unknown, direction), adjacentObservationCity("sapporo", direction));
  }
}

assert.deepEqual(LIVE_EXHIBITS.map(exhibit => exhibit.number), ["15", "16", "17", "18", "19", "20"]);
assert.deepEqual(LIVE_EXHIBITS.map(exhibit => exhibit.key), ["weatherWindSpeed", "forecastCo2", "weatherPrecipitation", "weatherTemperature", "cloudCover", "pm25"]);
for (const exhibit of LIVE_EXHIBITS) {
  assert(exhibit.title && exhibit.shortTitle && exhibit.question && exhibit.caption);
  assert(exhibit.signalLabel && exhibit.scaleLabel && exhibit.visualMap && exhibit.refreshCopy);
  assert.match(exhibit.accent, /^#[a-f0-9]{6}$/iu);
  assert(Object.isFrozen(exhibit.location));
}
assert.deepEqual(ESTAT_EXHIBITS.map(exhibit => exhibit.number), Array.from({ length: 10 }, (_, index) => String(index + 21)));
assert.deepEqual(ESTAT_EXHIBITS.map(exhibit => exhibit.key), ["migration", "lodging", "housing", "averageTemperature", "summerHigh", "winterLow", "relativeHumidity", "sunshineHours", "precipitation", "rainyDays"]);
for (const exhibit of ESTAT_EXHIBITS) {
  assert(exhibit.title && exhibit.shortTitle && exhibit.valueLabel && exhibit.unit);
  assert(exhibit.caption && exhibit.guide && exhibit.sourceName);
  assert.equal(new URL(exhibit.source).protocol, "https:");
}
assert.equal(ESTAT_EXHIBITS.find(exhibit => exhibit.key === "lodging").unit, "人");
assert.equal(ESTAT_EXHIBITS.find(exhibit => exhibit.key === "summerHigh").shortTitle, "一日の熱を重ねる");
assert.equal(ESTAT_EXHIBITS.find(exhibit => exhibit.key === "winterLow").shortTitle, "一日の冷えを重ねる");
assert.equal(ESTAT_EXHIBITS.find(exhibit => exhibit.key === "summerHigh").valueLabel, "日最高気温の年平均");
assert.equal(ESTAT_EXHIBITS.find(exhibit => exhibit.key === "winterLow").valueLabel, "日最低気温の年平均");

const readRuntime = name => fs.readFileSync(new URL(`../src/exploration/${name}`, import.meta.url), "utf8");
const liveRuntime = readRuntime("live-exhibits.js");
const estatRuntime = readRuntime("estat-exhibits.js");
const cityImport = source => source.match(/from "(\.\/observation-cities\.js\?v=[^"]+)"/u)?.[1];
assert(cityImport(liveRuntime), "Live renderer must use the shared city module");
assert.equal(cityImport(estatRuntime), cityImport(liveRuntime), "Both renderers must share one city module and cache revision");
assert.doesNotMatch(estatRuntime, /from ["'][^"']*live-exhibits\.js/u, "Reading city data must not initialize the live renderer");
assert.match(liveRuntime, /export \{ OBSERVATION_CITIES \}/u, "Keep the existing city export compatible");
console.log("PASS exhibit catalogs: browser-free imports, 47 frozen cities, 16 definitions, shared dependencies and bidirectional city navigation");
