import assert from "node:assert/strict";
import fs from "node:fs";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";
import { analyzeDiscovery } from "../statistics-discovery.js";
import { buildStatisticalReading } from "../statistics-data-insights.js";
import { analyzeSummary } from "../statistics-lab-core.js";

const data = JSON.parse(fs.readFileSync("data/estat-prefecture-series.json", "utf8"));
let checked = 0;
for (const exhibit of ESTAT_EXHIBITS) for (let pref = 0; pref < 47; pref++) {
  const periods = data.periodsBySeries[exhibit.key];
  // Keep missing records here to test that discovery never turns null into zero.
  const rows = periods.map(year => ({ id: year, label: year, x: Number(year), value: data[exhibit.key][year][pref], provenance: "SOURCE" }));
  const valid = rows.filter(row => Number.isFinite(row.value));
  const dataset = { id: `estat-prefecture-${exhibit.key}`, title: exhibit.shortTitle, unit: exhibit.unit, xKind: "year", xLabel: "年", yLabel: exhibit.valueLabel,
    missingCount: rows.length - valid.length, comparisonNote: data.annualHistorySources[exhibit.key]?.comparisonNote || data.weatherHistorySource.comparisonNote };
  const result = analyzeDiscovery({ dataset, rows });
  assert.equal(result.stats.n, valid.length);
  assert(Math.abs(result.stats.mean - valid.reduce((sum, row) => sum + row.value, 0) / valid.length) < 1e-8);
  assert(result.dataInsight.candidates.every(candidate => ["baseline-shift", "pace-change", "yearly-variability"].includes(candidate.id)), `${exhibit.key}/${pref + 1}: spatial claim in time series`);
  assert(result.dataInsight.candidates.every(candidate => candidate.recordIds.every(id => valid.some(row => row.id === id))));
  assert.doesNotMatch(JSON.stringify(result.dataInsight), /NaN|undefined|Infinity|都道府県のうち/u);
  if (dataset.missingCount) assert.match(result.dataInsight.caveat, new RegExp(`欠測${dataset.missingCount}年`));
  const summary = analyzeSummary({ values: valid.map(row => row.value), unit: exhibit.unit });
  const reading = buildStatisticalReading({ dataset, rows: valid, result: summary, methodId: "summary" });
  assert(reading.caveat.includes(dataset.comparisonNote));
  checked++;
}
console.log(`PASS ${checked} annual analyses: correct means/counts, missing exclusion, temporal-only questions, source/population caveats.`);
