import assert from 'node:assert/strict';
import { manifestParts, referenceKind, dataTokens } from './audit-production-data.mjs';
assert.deepEqual(manifestParts('data/runtime/gaia-manifest.json', { chunks: [{ file: 'wind.0123456789abcdef.json' }] }), ['data/runtime/wind.0123456789abcdef.json']);
assert.deepEqual(manifestParts('data/japan-air-co.json', { schemaVersion: 2,
  periods: [{ file: 'annual/japan-air-co/2023.json.gz' }], historyShards: [{ file: 'annual/japan-air-co/history-0.json.gz' }] }),
  ['data/annual/japan-air-co/2023.json.gz', 'data/annual/japan-air-co/history-0.json.gz']);
assert.deepEqual(manifestParts('data/old.json', { schemaVersion: 1, periods: [{ year: 2020 }] }), []);
assert.throws(() => manifestParts('data/runtime/gaia-manifest.json', { chunks: [{ file: '../secret.json' }] }));
assert.throws(() => manifestParts('data/x.json', { schemaVersion: 2, periods: [{ file: 'annual/../secret.json' }], historyShards: [] }));
assert.equal(referenceKind('scripts/build.py'), 'build-test');
assert.equal(referenceKind('sensor-platform/test/api.ts'), 'build-test');
assert.equal(referenceKind('docs/DATA_SOURCES.md'), 'documentation');
assert.equal(referenceKind('src/data/store.js'), 'runtime-candidate');
assert.deepEqual(dataTokens("fetch('data/story-temperature-annual.bin'); fetch('data/annual/x/2025.json.gz')"),
  ['data/story-temperature-annual.bin', 'data/annual/x/2025.json.gz']);
assert.deepEqual(dataTokens("'jma-47407.html'"), ['jma-47407.html']);
console.log(JSON.stringify({ status: 'passed', assertions: 11, scope: 'manifest expansion and reference classification' }));
