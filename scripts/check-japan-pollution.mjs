import assert from "node:assert/strict";
import fs from "node:fs";
import { readAnnualSnapshot } from './lib/annual-snapshot.mjs';
import vm from "node:vm";
import { JAPAN_POLLUTION_EXHIBITS as exhibits } from "../src/exploration/japan-pollution-catalog.js";
import { sensorObservationAppearance } from "../src/exploration/japan-sensor-open-catalog.js";
import { analyzeDiscovery, annualAxisTicks } from "../statistics-discovery.js";
import { formatObservationNumber, concentrationDomain } from "../src/shared/observation-numbers.js";
assert.equal(formatObservationNumber(.001, 2), "0.001");
assert.equal(formatObservationNumber(.00003, 2), "0.00003");
assert.equal(formatObservationNumber(0, 2), "0");
assert.equal(formatObservationNumber(null), "—");
for (const values of [[.001, .001], [.001, .002, .003], [.00003, .00009], [0], [15, 20]]) {
  const [lo, hi] = concentrationDomain(values);
  assert(lo >= 0 && lo <= Math.min(...values) && hi >= Math.max(...values) && hi > lo);
  if (Math.max(...values) > 0) assert(hi <= Math.max(...values) * 1.21, "No fixed +0.5 padding on trace values");
}
// The catalog also registers browser motion/visibility listeners at startup.
// Supply these APIs in the VM, as in the food-catalog regression fixture.
const context = {
  document: { querySelector: () => null, addEventListener() {} },
  matchMedia: () => ({ matches: true, addEventListener() {} }),
};
vm.runInNewContext(fs.readFileSync("map-exhibit-categories.js", "utf8"), context);
assert(context.GaiaMapCategories.exhibitCount >= 64);
assert.equal(exhibits.length, 21);
assert.deepEqual(exhibits.map(e => Number(e.number)), Array.from({ length: 21 }, (_, i) => 44 + i));
assert.equal(new Set(exhibits.map(e => e.id)).size, 21);
const totals = { measured: 0, qualified: 0, missing: 0 };
for (const exhibit of exhibits) {
  const data = readAnnualSnapshot(exhibit.dataFile);
  assert.equal(data.id, exhibit.id); assert.equal(data.unit, exhibit.unit); assert.equal(data.measurementKey, exhibit.measurementKey);
  assert.equal(data.realtime, false); assert.equal(data.periodUnit, "年度");
  assert.deepEqual(data.periods.map(p => p.year), exhibit.years);
  assert(Object.isFrozen(exhibit) && Object.isFrozen(exhibit.stops) && Object.isFrozen(exhibit.years));
  assert.equal(exhibit.sensorRegistrationKey, null, "No false new ESP32 registration claim");
  assert(exhibit.sensorNote && exhibit.comparisonNote && exhibit.source && exhibit.termsUrl);
  assert.equal(context.GaiaMapCategories.getProfile(exhibit.number).time, "series");
  assert.equal(context.GaiaMapCategories.getProfile(exhibit.number).scope, "japan");
  assert.equal(context.GaiaMapCategories.get(exhibit.number).id, exhibit.category === "air" ? "air" : "water-quality");
  assert.equal(sensorObservationAppearance(exhibit, null).color, "#abb5be");
  assert(exhibit.stops.every((v, i) => i === 0 || v > exhibit.stops[i - 1]));
  for (const period of data.periods) {
    const count = { measured: 0, qualified: 0, missing: 0 };
    assert.equal(new Set(period.stations.map(p => p.id)).size, period.stations.length);
    for (const row of period.stations) {
      assert(typeof row.name === 'string' && typeof row.water === 'string' && /^\d{2}$/.test(row.prefCode));
      if (!row.name || !row.water) assert(row.sourceUrl);
      assert(row.lon >= 122 && row.lon <= 154 && row.lat >= 20 && row.lat <= 46);
      const reading = row.measurement;
      count[reading.quality]++; totals[reading.quality]++;
      if (reading.quality === "measured") { assert(Number.isFinite(reading.value) && reading.value >= 0); assert.equal(Number(reading.text), reading.value); }
      else { assert.equal(reading.value, null); assert(reading.text); }
      if (exhibit.category === "air") assert(reading.coverageText && row.stationType);
    }
    assert.deepEqual(count, period.counts);
    assert(count.measured + count.qualified > 0, 'Years with only detection-limit observations remain selectable, never replaced with zero');
  }
  const selected = data.periods.at(-1).stations.find(p => p.measurement.quality === "measured");
  const rows = data.periods.flatMap(p => {
    const value = p.stations.find(s => s.id === selected.id)?.measurement.value;
    return Number.isFinite(value) ? [{ x: p.year, y: value, value, provenance: "SOURCE" }] : [];
  });
  const dataset = { id: exhibit.id, unit: exhibit.unit, yLabel: exhibit.metricLabel, valueLabel: exhibit.metricLabel, xKind: "year", xLabel: "年度", insightContext: { domain: "japan-sensor-open" }, provenance: ["SOURCE"] };
  for (const subset of [rows, rows.slice(0, 3), rows.slice(0, 1)]) {
    const analysis = analyzeDiscovery({ dataset, rows: subset });
    assert.equal(analysis.dataInsight.primaryId, "japan-station-records");
    assert.equal(analysis.chart.yUnit, exhibit.unit);
    assert.deepEqual(analysis.chart.pairs, subset.map(r => ({ x: r.x, y: r.value })));
  }
  console.log(`PASS ${exhibit.number}: ${exhibit.id}, source units, years, nulls, categories and statistics`);
}
assert(totals.measured > 0 && totals.qualified > 0 && totals.missing > 0);
console.log(JSON.stringify({ status: "passed", exhibits: 21, ...totals, periodStationRecords: Object.values(totals).reduce((a, b) => a + b, 0) }));
