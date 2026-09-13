import assert from "node:assert/strict";
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../data/estat-prefecture-series.json", import.meta.url), "utf8"));
const prefectureCount = 47;
const socialKeys = ["migration", "lodging", "housing"];
const annualKeys = [
  "averageTemperature",
  "summerHigh",
  "winterLow",
  "relativeHumidity",
  "sunshineHours",
  "precipitation",
  "rainyDays",
];
const temperatureKeys = ["averageTemperature", "summerHigh", "winterLow"];
const longTermYears = Array.from({ length: 71 }, (_, index) => String(1955 + index));

assert.equal(data.months, undefined, "Annual exhibits must not use a monthly fallback");
const startBySeries = { migration: 1954, housing: 1951, lodging: 2007 };
const expectedMissing = { migration: 19, housing: 22, lodging: 0, averageTemperature: 0, summerHigh: 0, winterLow: 0, relativeHumidity: 6, sunshineHours: 11, precipitation: 2, rainyDays: 1 };

const missingBySeries = {};
const changedPrefecturesBySeries = {};
for (const key of [...socialKeys, ...annualKeys]) {
  const periods = data.periodsBySeries?.[key];
  const start = startBySeries[key] || 1955;
  const expectedPeriods = Array.from({ length: 2026 - start }, (_, index) => String(start + index));
  assert.deepEqual(periods, expectedPeriods, `${key} periods are incomplete`);
  const rows = periods.map((period) => {
    const values = data[key]?.[period];
    assert.equal(values?.length, prefectureCount, `${key}/${period} must contain 47 prefecture slots`);
    assert.ok(values.every((value) => value === null || Number.isFinite(value)), `${key}/${period} contains an invalid value`);
    return values;
  });
  missingBySeries[key] = rows.flat().filter((value) => value === null).length;
  assert.equal(missingBySeries[key], expectedMissing[key], `${key} missing observations changed`);
  changedPrefecturesBySeries[key] = Array.from({ length: prefectureCount }, (_, index) => (
    new Set(rows.map((values) => values[index]).filter(Number.isFinite)).size
  )).filter((distinct) => distinct > 1).length;
  assert.ok(changedPrefecturesBySeries[key] >= 40, `${key} does not vary across enough prefectures`);
}

assert.equal(data.temperatureHistorySource?.publisher, "気象庁");
assert.equal(data.temperatureHistorySource?.coverage, "1955-2025 / 47都道府県の代表気象台・測候所");
assert.equal(data.temperatureHistorySource?.stations?.length, prefectureCount);
assert.deepEqual(
  data.temperatureHistorySource.stations.map(({ code }) => code),
  Array.from({ length: prefectureCount }, (_, index) => String(index + 1).padStart(2, "0")),
);
assert.ok(data.temperatureHistorySource.stations.every(({ url }) => /^https:\/\/www\.data\.jma\.go\.jp\//u.test(url)));

const linearTrendPerDecade = (values) => {
  const meanYear = longTermYears.reduce((sum, year) => sum + Number(year), 0) / longTermYears.length;
  const meanValue = values.reduce((sum, value) => sum + value, 0) / values.length;
  const numerator = values.reduce((sum, value, index) => sum + (Number(longTermYears[index]) - meanYear) * (value - meanValue), 0);
  const denominator = longTermYears.reduce((sum, year) => sum + (Number(year) - meanYear) ** 2, 0);
  return (numerator / denominator) * 10;
};
const warmingTrendBySeries = Object.fromEntries(temperatureKeys.map((key) => {
  const trends = Array.from({ length: prefectureCount }, (_, prefectureIndex) => linearTrendPerDecade(
    longTermYears.map((year) => data[key][year][prefectureIndex]),
  ));
  assert.ok(trends.filter((trend) => trend > 0).length >= 44, `${key} does not show a widespread long-term warming trend`);
  return [key, {
    minimum: Math.min(...trends),
    maximum: Math.max(...trends),
    mean: trends.reduce((sum, trend) => sum + trend, 0) / trends.length,
  }];
}));

for (const key of socialKeys) {
  assert.equal(data.annualHistorySources[key].frequency, "年次");
  assert.equal(data.annualHistorySources[key].missingValuePolicy, "欠損補完なし");
  assert.match(data.annualHistorySources[key].sha256, /^[a-f0-9]{64}$/u);
  assert.match(data.annualHistorySources[key].sourceUrl, /^https:\/\/(www\.e-stat\.go\.jp|www\.mlit\.go\.jp)\//u);
}
assert.equal(data.annualHistorySources.migration.population, "日本人移動者・男女計");
assert.equal(data.annualHistorySources.lodging.population, "従業者数10人以上の宿泊施設");
for (const key of ["migration", "housing"]) {
  for (const year of data.periodsBySeries[key]) assert.equal(data[key][year][46] === null, Number(year) < 1973);
}
for (const values of Object.values(data.migration)) assert.equal(values.filter(Number.isFinite).reduce((a, b) => a + b, 0), 0, "Annual net migration reconciles nationally");
assert.equal(data.migration[1954][12], 242139);
assert.equal(data.weatherHistorySource.rainyDayThresholdMm, 1);
assert.equal(data.weatherHistorySource.stations.length, 47);
assert.match(data.weatherHistorySource.comparisonNote, /1986〜1990年/u);
assert.equal(data.weatherHistorySource.qualityFlags.length, 20);
for (const flag of data.weatherHistorySource.qualityFlags) {
  assert.equal(flag.flag, "insufficient");
  assert.equal(data[flag.series][flag.year][Number(flag.code) - 1], null);
}
// Independently checked Tokyo 1955 cells in JMA a1/a2/a4. Rainy days use >=1.0mm,
// not the adjacent >=0mm / >=0.5mm columns (188 and 122 days).
assert.equal(data.relativeHumidity[1955][12], 70);
assert.equal(data.sunshineHours[1955][12], 2018.1);
assert.equal(data.precipitation[1955][12], 1553.9);
assert.equal(data.rainyDays[1955][12], 110);
assert.equal(data.precipitation[2022][8], null);
assert.equal(data.rainyDays[2022][8], null);

console.log(JSON.stringify({
  status: "passed",
  exhibits: socialKeys.length + annualKeys.length,
  prefectures: prefectureCount,
  annualPeriods: Object.fromEntries(Object.entries(data.periodsBySeries).map(([key, years]) => [key, years.length])),
  missingBySeries,
  changedPrefecturesBySeries,
  warmingTrendBySeries,
}, null, 2));
