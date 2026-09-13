import assert from "node:assert/strict";
import { discoverData, analyzeDiscovery } from "../statistics-discovery.js";
import { buildDataInsight } from "../statistics-data-insights.js";
import { notApplicable } from "../statistics-lab-core.js";

const rows = values => values.map((value, i) => ({ id: String(i), label: `地点${i}`, x: i, y: value, value, provenance: "SOURCE" }));
const find = (id, sample, extra = {}) => discoverData({ dataset: { id, title: id, unit: "%", ...extra }, rows: sample });
const primary = result => result.candidates[0];
let uniform = rows(Array(20).fill(10));
assert.equal(find("population", uniform).primaryId, "flat-data");
const concentrated = rows([800, ...Array(19).fill(10)]);
let insight = find("population", concentrated, { unit: "人" });
assert.equal(insight.primaryId, "concentration");
assert(Math.abs(primary(insight).evidence[0][1] - 810 / 990 * 100) < 1e-10);
assert.equal(find("population", [...concentrated].reverse(), { unit: "人" }).headline, insight.headline);
assert.equal(find("waste", concentrated).candidates.some(candidate => candidate.id === "concentration"), false, "Never sum rates as contributions");
const imputed = [...uniform, { id: "invented", label: "補完国", value: 1e8, provenance: "IMPUTED" }];
assert.equal(find("waste", imputed).primaryId, "flat-data");
assert.match(find("waste", imputed).scope, /補完値1行.*除外/);
assert(!JSON.stringify(find("waste", imputed)).includes("補完国"));
assert.equal(find("population", rows([-5, 0, 100, 1, 1, 1])).candidates.some(candidate => candidate.id === "concentration"), false);

const peers = rows([5, 95, 25, 30, 35, 50]).map((row, i) => ({ ...row, year: 2021,
  solarKwhM2Day: [4, 4.1, 2, 3, 5.5, 7][i], windSpeedMs: [3, 3.1, 1, 2, 5, 8][i] }));
assert.equal(find("renewables", peers).primaryId, "near-peers");
assert.deepEqual(primary(find("renewables", peers)).recordIds.sort(), ["0", "1"]);
assert.notEqual(find("renewables", peers.map(row => ({ ...row, value: 30 }))).primaryId, "near-peers");
const differentYears = peers.map((row, i) => ({ ...row, year: 2000 + i }));
assert.notEqual(find("renewables", differentYears).primaryId, "near-peers", "Known different years are not a matched comparison");
const wind = rows([0.27, 19.94, 4, 8, 2, 6]).map((row, i) => ({ ...row, pressure: [987.5, 987.5, 1003, 1018, 1020, 1040][i] }));
const windReading = find("planet-global-wind-pressure", wind, { unit: "m/s", valueLabel: "風速", insightContext: { measurementKind: "MODEL" } });
assert.equal(windReading.primaryId, "near-peers");
assert.deepEqual(windReading.comparison.points.map(point => point.id), ["0", "1"]);
assert.deepEqual(windReading.comparison.metrics.map(metric => [metric.unit, ...metric.values]), [["hPa", 987.5, 987.5], ["m/s", 0.27, 19.94]]);
assert.deepEqual(windReading.findings.map(finding => finding.kind), ["observation", "meaning", "limit"]);
assert.match(windReading.headline, /19.67m\/s/);
assert.match(windReading.scopeLabel, /モデル値/);
assert.match(windReading.comparison.intro, /他の条件まで同じという意味ではありません/);
assert.deepEqual(find("planet-global-wind-pressure", [...wind].reverse(), { unit: "m/s", valueLabel: "風速" }).comparison, windReading.comparison);
assert.equal(find("planet-global-wind-pressure", [wind[0]], { unit: "m/s" }).comparison, null);
const rain = rows([1000, 1010, 500, 1400, 2000]).map((row, i) => ({ ...row, rainyDays: [80, 140, 40, 100, 150][i] }));
const rainAmount = rows([1000, 2500, 500, 1400, 2000]).map((row, i) => ({ ...row, rainyDays: [80, 81, 40, 100, 150][i] }));
assert.equal(find("estat-prefecture-precipitation", rainAmount, { unit: "mm" }).primaryId, "near-peers");
assert.equal(find("estat-prefecture-rainyDays", rain.map(row => ({ ...row, precipitation: row.value, value: row.rainyDays })), { unit: "日" }).primaryId, "near-peers");

const temporal = rows(Array.from({ length: 40 }, (_, i) => 300 + (i < 20 ? i : 20 + (i - 20) * 4))).map((row, i) => ({ ...row, x: 1980 + i, label: String(1980 + i) }));
insight = find("co2-trend", temporal, { unit: "ppm", xKind: "year" });
assert.equal(insight.primaryId, "pace-change");
assert(Math.abs(primary(insight).evidence[0][1] - 1) < 1e-6);
assert(Math.abs(primary(insight).evidence[1][1] - 4) < 1e-6);
assert.equal(find("co2-trend", [...temporal].reverse(), { unit: "ppm", xKind: "year" }).headline, insight.headline);
const baseline = insight.candidates.find(candidate => candidate.id === "baseline-shift");
assert(baseline.chart.line.every(Number.isFinite), "Trend graph receives the renderer's coefficient-array format");
assert(!find("population", temporal, { xLabel: "国番号" }).candidates.some(candidate => candidate.id === "pace-change"));
const paired = temporal.map(row => ({ ...row, x: row.value, y: row.value + .2, paired: row.value - .3 }));
assert.equal(find("jma-co2", paired, { unit: "ppm" }).primaryId, "shared-rise");
const opposing = rows([2, 2, 2, 2]).map((row, i) => ({ ...row, uMs: i % 2 ? 2 : -2, vMs: 0 }));
assert.equal(find("ocean-currents", opposing).primaryId, "opposing-currents");
assert.equal(primary(find("ocean-currents", opposing)).evidence[1][1], 0);
assert.notEqual(find("ocean-currents", opposing.map(row => ({ ...row, uMs: 2 }))).primaryId, "opposing-currents");

assert.equal(find("estat-prefecture-migration", rows([500, 10, 20, -100, -430]), { unit: "人" }).primaryId, "two-sided-migration");
for (const id of ["culture", "pollination"]) {
  const records = rows([99000, -1, 8, 2, 99]).map((row, i) => ({ ...row, category: i % 2 ? "記録A" : "記録B", group: `群${i % 3}` }));
  const result = analyzeDiscovery({ dataset: { id, title: id }, rows: records });
  assert.equal(result.dataInsight.primaryId, "recording-coverage");
  assert.equal(result.stats, undefined, "Row indices must not have measurement statistics");
  assert.deepEqual(result.chart.table, [[2, 3]]);
  assert.equal(result.dataInsight.headline, find(id, records.map(row => ({ ...row, value: 0 }))).headline);
}
for (const id of ["live-carbon-pulse", "live-rain-chorus", "live-temperature-field", "live-cloud-drift", "live-pm25-haze"]) {
  insight = find(id, rows([0]));
  assert.equal(insight.status, "needs-comparison");
  assert.match(primary(insight).signal, /1地点・1時点/);
  assert(!primary(insight).signal.includes("増加"));
  assert.equal(find(id, [{ id: "missing", value: null }]).evidence[0][1], 0);
}
assert.equal(find("earthquakes", rows([1, 6, 3, 2, 1, 8]), { xLabel: "年" }).primaryId, "uneven-event-years");
assert.equal(find("planet-usgs-earthquake-ripples", rows([4, 4.1, 3]).map((row, i) => ({ ...row, depth: [5, 100, 12][i] }))).primaryId, "same-magnitude-depth");
const blocked = buildDataInsight({ result: notApplicable("比較相手なし"), dataset: { id: "population", title: "人口" }, rows: concentrated, methodId: "paired" });
assert.match(blocked.headline, /答えは出せません/);
console.log("PASS discovery: data-dependent feature selection, changed-data counterexamples, actual slopes, paired-site change, vectors, matched years, category-index guard, single-point honesty, imputation exclusion, method guard.");
