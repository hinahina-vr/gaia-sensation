import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INITIAL_OBSERVATION_YEAR, initialObservationIndex } from '../src/exploration/initial-observation-year.js';
import { ESTAT_EXHIBITS } from '../src/exploration/estat-exhibit-catalog.js';
import { FOOD_EXHIBITS } from '../src/exploration/food-catalog.js';
import { ANNUAL_OBSERVATION_YEARS } from '../src/exploration/annual-observation-years.js';

assert.equal(INITIAL_OBSERVATION_YEAR, 2016);
assert.equal(initialObservationIndex([]), -1);
assert.equal(initialObservationIndex(['unknown', NaN]), -1);
assert.equal(initialObservationIndex([2024, 2016, 1971]), 1);
assert.equal(initialObservationIndex([2018, 2022]), 0);
assert.equal(initialObservationIndex([2017, 2015]), 1, 'Ties prefer the earlier real year');
assert.equal(initialObservationIndex([{ year: 2015 }, { year: 2016 }], p => p.year), 1);
let checked = 0;
const read = file => JSON.parse(fs.readFileSync(`data/${file}`, 'utf8'));
for (const file of Object.keys(ANNUAL_OBSERVATION_YEARS)) {
  const data = read(file), index = initialObservationIndex(data.periods, p => p.year);
  assert.equal(data.periods[index].year, file === 'japan-prtr-2022.json' ? 2018 : 2016, file);
  assert(index < data.periods.length - 1, `${file}: first automatic step must not wrap`);
  checked++;
}
const estat = read('estat-prefecture-series.json');
for (const def of ESTAT_EXHIBITS) {
  const periods = estat.periodsBySeries[def.key], index = initialObservationIndex(periods);
  assert.equal(Number(periods[index]), 2016, def.id);
  assert(index < periods.length - 1);
  checked++;
}
for (const def of FOOD_EXHIBITS) {
  for (const series of read(def.dataFile).series) {
    const index = initialObservationIndex(series.periods, p => p.year);
    assert.equal(series.periods[index].year, 2016, `${def.id}/${series.id}`);
    assert.equal(series.periods[index].key, def.number === '71' ? '2015-2017' : '2016');
    assert(index < series.periods.length - 1);
    checked++;
  }
}
console.log(`PASS initial-year helper and ${checked} real annual datasets/series`);
