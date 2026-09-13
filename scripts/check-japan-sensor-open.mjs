import assert from "node:assert/strict";
import fs from "node:fs";
import { readAnnualSnapshot } from './lib/annual-snapshot.mjs';
import { JAPAN_SENSOR_OPEN_EXHIBITS as exhibits, sensorObservationAppearance } from "../src/exploration/japan-sensor-open-catalog.js";
import { analyzeDiscovery, annualAxisTicks } from "../statistics-discovery.js";
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const sensorCatalog = read("sensor-platform/src/measurements.ts");
assert.equal(exhibits.length, 12);
assert.deepEqual(exhibits.map(item => Number(item.number)), Array.from({ length: 12 }, (_, index) => index + 32));
assert.equal(new Set(exhibits.map(item => item.id)).size, 12);
let count = 0, measured = 0, missing = 0, qualified = 0;
for (const exhibit of exhibits) {
  assert(sensorCatalog.includes(`measurement("${exhibit.measurementKey}"`), `Actual ESP32 key: ${exhibit.measurementKey}`);
  assert(Object.isFrozen(exhibit.stops));
  assert(exhibit.subtitle.length >= 12 && exhibit.subtitle.length <= 32);
  assert(exhibit.picker.length <= 85);
  assert.equal(sensorObservationAppearance(exhibit, null).color, "#abb5be");
  assert.equal(sensorObservationAppearance(exhibit, exhibit.stops[0] - 1).color, "rgb(74, 157, 255)");
  assert.equal(sensorObservationAppearance(exhibit, exhibit.stops.at(-1) + 1).color, "rgb(247, 79, 103)");
  const data = readAnnualSnapshot(exhibit.dataFile);
  assert.equal(data.id, exhibit.id);
  assert.equal(data.unit, exhibit.unit);
  assert.equal(data.measurementKey, exhibit.measurementKey);
  assert.equal(data.periodUnit, exhibit.periodUnit);
  assert.equal(data.realtime, false);
  assert(data.attribution.includes("GAIA SENSEWARE"));
  assert.deepEqual(data.periods.map(item => item.year), exhibit.years);
  for (const period of data.periods) {
    assert.equal(new Set(period.stations.map(row => row.id)).size, period.stations.length);
    const qualities = { measured: 0, missing: 0, qualified: 0 };
    for (const row of period.stations) {
      count++;
      assert(row.lon >= 122 && row.lon <= 154 && row.lat >= 20 && row.lat <= 46);
      assert(typeof row.name === 'string' && typeof row.water === 'string' && /^\d{2}$/.test(row.prefCode));
      if (!row.name || !row.water) assert(row.sourceUrl, 'Unlabelled historical points still retain their source and ID');
      const value = row.measurement;
      assert(["measured", "missing", "qualified"].includes(value.quality));
      qualities[value.quality]++;
      if (value.quality === "measured") {
        measured++; assert(Number.isFinite(value.value));
        if (exhibit.measurementKey === "ph") {
          assert(value.value >= 0 && value.value <= 14);
          if (row.secondary.quality === "measured") assert(value.value <= row.secondary.value);
        }
        if (exhibit.measurementKey === "solar_irradiance") {
          assert(Math.abs(value.value - Number(value.sourceText) * 1_000_000 / 86400) < 1e-9);
          assert.equal(value.sourceUnit, "MJ/m²/day");
        }
      } else {
        assert.equal(value.value, null, "Missing and qualified records do not become zero");
        assert(value.text);
        if (value.quality === "missing") missing++; else qualified++;
      }
    }
    assert.deepEqual(qualities, period.counts);
  }
  const selected = data.periods.at(-1).stations.find(row => row.measurement.quality === "measured");
  const rows = data.periods.flatMap(period => {
    const row = period.stations.find(row => row.id === selected.id);
    return Number.isFinite(row?.measurement.value) ? [{ id: String(period.year), label: `${period.year}${exhibit.periodUnit}`,
      x: period.year, y: row.measurement.value, value: row.measurement.value, provenance: "SOURCE" }] : [];
  });
  const dataset = { id: exhibit.id, title: exhibit.shortTitle, unit: exhibit.unit, xKind: "year", xLabel: exhibit.periodUnit,
    yLabel: exhibit.metricLabel, valueLabel: exhibit.metricLabel, insightContext: { domain: "japan-sensor-open" }, provenance: ["SOURCE"] };
  for (const subset of [rows, rows.slice(1, 4), rows.slice(0, 1)]) {
    const analysis = analyzeDiscovery({ dataset, rows: subset });
    assert.equal(analysis.dataInsight.primaryId, "japan-station-records");
    assert.equal(analysis.chart.yLabel, exhibit.metricLabel);
    assert.equal(analysis.chart.yUnit, exhibit.unit);
    assert.deepEqual(analysis.chart.pairs, subset.map(row => ({ x: row.x, y: row.value })));
    assert.deepEqual(analysis.chart.xTicks, annualAxisTicks(subset));
    assert.equal(analysis.chart.line, undefined);
  }
  console.log(`PASS ${exhibit.number} ${exhibit.id}: ${exhibit.years.length} periods, source quantities/units/quality, same-station analysis and subset charts`);
}
// Independent spot checks against the official Tokyo 2024 annual table.
for (const [metric, expected] of [["temperature", 17.6], ["humidity", 70], ["pressure", 1011.1], ["rainfall", 1926], ["wind-speed", 2.7], ["solar-irradiance", 13.9 * 1_000_000 / 86400]]) {
  const data = readAnnualSnapshot(`japan-weather-${metric}.json`);
  assert(Math.abs(data.periods.at(-1).stations.find(row => row.id === "47662").measurement.value - expected) < 1e-9);
}
assert(missing > 0 && qualified > 0);
console.log(JSON.stringify({ status: "passed", exhibits: 12, periodStationRecords: count, measured, missing, qualified }));
