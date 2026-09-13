import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
await import("../observation-notebook-core.js");
const core = globalThis.GaiaObservationCore;

const mapRecord = (value, overrides = {}) => ({
  source: "map",
  capturedAt: "2026-08-26T00:00:00.000Z",
  title: "地球の一呼吸",
  subtitle: "2026 / SOURCE",
  compareKey: "map:breathing-earth",
  metrics: [{ key: "co2_ppm", label: "CO₂濃度", value, unit: "ppm" }],
  context: [{ label: "内部表示", value: "共有しない" }],
  provenance: { classification: "SOURCE", datasetIds: ["NOAA-GML"] },
  deviceId: "must-not-survive",
  owner: { email: "must-not-survive@example.test" },
  ...overrides,
});

core.clear();
for (let index = 0; index < 25; index += 1) core.save(mapRecord(index, { title: `観測 ${index}` }));
assert.equal(core.list().length, 24, "保存上限は24件");
assert.equal(core.list()[0].title, "観測 24", "新しい観測を先頭へ保存");
assert.equal(core.list().at(-1).title, "観測 1", "最古の超過分を削除");

const first = core.normalizeRecord(mapRecord(410));
const second = core.normalizeRecord(mapRecord(415));
assert.equal(core.isComparable(first, second), true);
assert.deepEqual(core.compare(first, second).map(({ first: a, second: b, delta, unit }) => ({ a, b, delta, unit })), [
  { a: 410, b: 415, delta: 5, unit: "ppm" },
]);
assert.equal(core.isComparable(first, mapRecord(20, { compareKey: "map:blue-circulation" })), false, "異なる地図展示は比較しない");

const sensorA = core.normalizeRecord({
  source: "sensor", title: "教室", capturedAt: "2026-08-26T01:00:00Z", compareKey: "sensor:a",
  metrics: [{ key: "temperature", label: "温度", value: 24.2, unit: "℃" }, { key: "humidity", label: "湿度", value: 52, unit: "%" }],
  provenance: { classification: "SOURCE", datasetIds: ["ESP32 HTTPS telemetry"] },
});
const sensorB = core.normalizeRecord({
  source: "sensor", title: "屋外", capturedAt: "2026-08-26T02:00:00Z", compareKey: "sensor:b",
  metrics: [{ key: "temperature", label: "温度", value: 28.7, unit: "℃" }, { key: "pm25", label: "PM2.5", value: 8, unit: "µg/m³" }],
  provenance: { classification: "SOURCE", datasetIds: ["ESP32 HTTPS telemetry"] },
});
assert.equal(core.isComparable(sensorA, sensorB), true, "共通指標のあるセンサーは比較できる");
assert.equal(core.compare(sensorA, sensorB).length, 1);
assert.equal(core.isComparable(first, sensorA), false, "地図とセンサーは直接比較しない");

const payload = core.encodeShare([first, sensorA]);
const decoded = core.decodeShare(payload);
assert.equal(decoded.length, 2);
assert.equal(decoded[0].metrics[0].value, 410);
assert.deepEqual(decoded[0].context, [], "共有からローカル文脈を除外");
const publicRecord = core.shareRecord(mapRecord(410));
assert.deepEqual(Object.keys(publicRecord).sort(), ["capturedAt", "displayName", "sourceIds", "type", "values", "version"]);
assert.deepEqual(Object.keys(publicRecord.values[0]).sort(), ["displayName", "type", "unit", "value"]);
assert.equal(JSON.stringify(publicRecord).includes("must-not-survive"), false);
assert.equal(JSON.stringify(publicRecord).includes("共有しない"), false);

assert.throws(() => core.decodeShare("%%%"), /形式/u);
assert.throws(() => core.decodeShare("a".repeat(core.MAX_FRAGMENT_LENGTH + 1)), /長すぎ/u);
const unknownVersion = btoa(new TextEncoder().encode(JSON.stringify({ version: 99, records: [] })).reduce((value, byte) => value + String.fromCharCode(byte), ""))
  .replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
assert.throws(() => core.decodeShare(unknownVersion), /未対応/u);
assert.throws(() => core.encodeShare([first, second, sensorA]), /2件まで/u);

const originalSetItem = globalThis.localStorage.setItem;
globalThis.localStorage.setItem = () => { throw new Error("blocked"); };
const fallback = core.save(mapRecord(430, { title: "メモリ保存" }));
assert.equal(fallback.persistent, false, "localStorage拒否時はメモリへ退避");
assert.equal(core.list()[0].title, "メモリ保存");
globalThis.localStorage.setItem = originalSetItem;

console.log(JSON.stringify({ status: "passed", checks: 20, storageKey: core.STORAGE_KEY, maxRecords: core.MAX_RECORDS }, null, 2));
