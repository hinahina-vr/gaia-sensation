import assert from "node:assert/strict";
import fs from "node:fs";
import { analyzeDiscovery } from "../statistics-discovery.js";
const source = JSON.parse(fs.readFileSync(new URL("../data/japan-marine-cod.json", import.meta.url), "utf8"));
const rows = source.periods.map(period => {
  const value = period.stations.find(point => point.id === "1360101").cod.value;
  return { id: String(period.year), label: `${period.year}年度`, x: period.year, y: value, value, provenance: "SOURCE" };
});
const dataset = { id: "japan-marine-cod-1360101", title: "東京湾のCOD年度平均値", unit: "mg/L", xKind: "year", xLabel: "年度", provenance: ["SOURCE"], insightContext: { domain: "marine-cod" } };
for (const subset of [rows, rows.slice(1, 4), rows.slice(0, 1)]) {
  const result = analyzeDiscovery({ dataset, rows: subset });
  assert.equal(result.dataInsight.primaryId, "coastal-cod-records");
  assert.equal(result.chart.type, "scatter");
  assert.equal(result.chart.yLabel, "COD 年度平均値");
  assert.equal(result.chart.yUnit, "mg/L");
  assert.deepEqual(result.chart.pairs, subset.map(row => ({ x: row.x, y: row.value })));
  assert.deepEqual(result.chart.xTicks, subset.map(row => row.x));
  assert.equal(result.chart.line, undefined, "No inferred trend from five annual records");
  assert.match(result.dataInsight.caveat, /CODはDOではなく/);
}
console.log("PASS coastal COD analysis: real year/value chart points, units, subset/one-year views and no invented trend");
