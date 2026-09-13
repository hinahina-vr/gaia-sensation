import assert from "node:assert/strict";
import "./check-statistics-methods.mjs";
import {
  analyzeAnova, analyzeBayes, analyzeCategorical, analyzeCorrelation,
  analyzeDistribution, analyzeInterval, analyzeLogistic, analyzeSampling,
  analyzeSummary, analyzeWelch, descriptive, simpleRegression,
} from "../statistics-lab-core.js";

// Synthetic immutable fixtures: an external snapshot update must not rewrite
// the expected mathematical answers. Current-data contracts are tested separately.
const values = Object.freeze([1, 2, 2, 4, 6]);
const closeTo = (actual, expected, label) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-12,
  `${label}: expected ${expected}, got ${actual}`,
);
const assertInsight = (result, label) => {
  assert.ok(result?.insight, `${label}: insight missing`);
  assert.ok(result.insight.meaning?.trim(), `${label}: meaning missing`);
  assert.ok(result.insight.interpretation?.trim(), `${label}: interpretation missing`);
  assert.ok(Array.isArray(result.insight.limitations) && result.insight.limitations.join("").trim(), `${label}: limitations missing`);
  const prose = [result.insight.headline, result.insight.meaning, result.insight.interpretation].join(" ");
  assert.doesNotMatch(prose, /原因である|因果関係を証明した|差がない(?:。|$)/, `${label}: unsupported causal or null assertion`);
};

const stats = descriptive(values);
assert.equal(stats.n, 5);
assert.equal(stats.mean, 3);
assert.equal(stats.median, 2);
assert.equal(stats.populationVariance, 3.2);
assert.equal(stats.sampleVariance, 4);
assert.equal(stats.q1, 2);
assert.equal(stats.q3, 4);
assert.deepEqual(stats.modes, [2]);
closeTo(stats.populationSd, Math.sqrt(3.2), "population SD");
assert.equal(descriptive([]), null);
assert.equal(descriptive([7, 7, 7]).populationSd, 0);

const x = [0, 1, 2, 3, 4, 5];
const y = [1, 3, 5, 7, 9, 11];
const model = simpleRegression(x, y);
closeTo(model.coefficients[0], 1, "regression intercept");
closeTo(model.coefficients[1], 2, "regression slope");
closeTo(model.rSquared, 1, "regression R2");
const correlation = analyzeCorrelation({ x, y, xLabel: "説明変数", yLabel: "応答変数" });
assertInsight(correlation, "regression");
closeTo(correlation.metrics.find(([name]) => name === "回帰傾き")[1], 2, "insight consistency");

const left = [1, 2, 3, 4, 5, 6], right = [3, 4, 5, 6, 7, 8];
[
  analyzeSummary({ values, label: "固定標本", unit: "単位" }),
  analyzeDistribution({ values, label: "固定標本", unit: "単位" }),
  analyzeSampling({ values, label: "固定標本", unit: "単位" }),
  analyzeInterval({ values, label: "固定標本", unit: "単位" }),
  analyzeWelch({ left, right, leftLabel: "A", rightLabel: "B", unit: "単位", diagnosticOnly: true }),
  analyzeAnova({ groups: [left, right, [5, 6, 7, 8, 9, 10]], labels: ["A", "B", "C"], diagnosticOnly: true }),
  analyzeLogistic({ x: [...x, ...x], y: [0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1], xLabel: "説明変数", outcomeLabel: "結果" }),
  analyzeBayes({ successes: 14, trials: 31, successLabel: "成功" }),
].forEach((result, index) => assertInsight(result, `method ${index + 1}`));
const sparse = analyzeCategorical({ categories: ["A", "B", "C", "A"], groups: ["X", "Y", "X", "Y"], categoryLabel: "カテゴリ", groupLabel: "地域" });
assertInsight(sparse, "sparse table");
assert.match(sparse.insight.headline, /期待度数が不足/);
const inapplicable = analyzeCategorical({ categories: ["A", "A", "A"], groups: ["X", "X", "X"], categoryLabel: "種類", groupLabel: "群" });
assertInsight(inapplicable, "single category");
assert.equal(inapplicable.kind, "not-applicable");
console.log("Statistics math PASS: synthetic moments, regression, all insight fields, sparse/inapplicable cases; no live-snapshot expected values.");
