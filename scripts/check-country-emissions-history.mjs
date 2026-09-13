import assert from "node:assert/strict";
import fs from "node:fs";
import { getCountryEmissionsSeries, getCountryEmissionsPlot } from "../src/exploration/country-emissions-history.js";

const rows = JSON.parse(fs.readFileSync(new URL("../data/gaia-signals.json", import.meta.url), "utf8"))
  .modes.find(mode => mode.id === "anthropocene-scar").signals.emissions;
for (const iso3 of new Set(rows.map(row => row.iso3))) {
  const series = getCountryEmissionsSeries(rows, iso3);
  assert.equal(series.length, rows.filter(row => row.iso3 === iso3).length);
  const plot = getCountryEmissionsPlot(series);
  assert(plot.ceiling >= Math.max(...series.map(row => row.value)));
  assert.equal(plot.y(0), plot.bottom);
  for (const point of plot.points) {
    const source = rows.find(row => row.iso3 === iso3 && row.year === point.year);
    assert.equal(point.value, source.emissionsMtCo2);
    assert(point.x >= plot.left && point.x <= plot.right && point.y >= plot.top && point.y <= plot.bottom);
  }
}
const australia = getCountryEmissionsSeries(rows, "AUS");
assert.equal(australia.length, 79);
assert.deepEqual(australia.find(row => row.year === 2013), { year: 2013, value: 399.067511 });
const sample = getCountryEmissionsSeries([
  { iso3: "AAA", year: 2002, emissionsMtCo2: 2 },
  { iso3: "AAA", year: 2000, emissionsMtCo2: 0 },
  { iso3: "AAA", year: 2001, emissionsMtCo2: null },
  { iso3: "AAA", year: null, emissionsMtCo2: 9 },
  { iso3: "AAA", year: 2003, emissionsMtCo2: NaN },
  { iso3: "AAA", year: 2004, emissionsMtCo2: -1 },
  { iso3: "BBB", year: 2001, emissionsMtCo2: 99 },
], "AAA");
assert.deepEqual(sample, [{ year: 2000, value: 0 }, { year: 2002, value: 2 }]);
assert.equal((getCountryEmissionsPlot(sample).path.match(/M/gu) || []).length, 2, "Missing years must not be interpolated");
assert.deepEqual(getCountryEmissionsSeries(rows, "UNKNOWN"), []);
assert.deepEqual(getCountryEmissionsSeries(null, "AUS"), []);
assert(Number.isFinite(getCountryEmissionsPlot([{ year: 2000, value: 0 }]).points[0].x));
console.log(`PASS country emissions: all ${new Set(rows.map(row => row.iso3)).size} country histories match source; linear axes, selected year, missing/zero/one-point values`);
