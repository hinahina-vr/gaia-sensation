import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { FOOD_EXHIBITS, selfSufficiency, foodValue, foodAppearance, foodRowSource, buildFoodStatisticsDataset } from '../src/exploration/food-catalog.js';
import { discoverData } from '../statistics-discovery.js';

assert.equal(selfSufficiency(['x', 20, 80, 0]), 20);
assert.equal(selfSufficiency(['x', 120, 0, 20]), 120);
assert.equal(selfSufficiency(['x', 0, 10, 0]), 0);
for (const row of [undefined, ['x', null, 10, 0], ['x', 10, null, 0], ['x', 10, 0, null], ['x', 0, 0, 0], ['x', 5, 0, 10], ['x', 5, 2, -1]]) assert.equal(selfSufficiency(row), null);
assert.equal(foodValue('food-security', ['x', -35]), -35);
assert.equal(foodValue('food-security', ['x', null]), null);
assert.equal(foodAppearance('food-security', '21035', -1000).fraction, 0);
assert.equal(foodAppearance('food-balances', '2905', 1000).fraction, 1);
assert.equal(foodAppearance('food-balances', '2905', null).color, '#9eaeb6');
const totals = [];
for (const def of FOOD_EXHIBITS) {
  const data = JSON.parse(fs.readFileSync(`data/${def.dataFile}`));
  assert.equal(data.schemaVersion, 1); assert(data.source.sha256 && data.source.catalogUrl === def.source);
  assert(data.citation.includes('Licence: CC-BY-4.0.') && data.attribution.includes(data.citation));
  const codes = new Set(data.countries.map(c => c.id)); assert.equal(codes.size, data.countries.length);
  assert(codes.has('392')); assert(data.countries.find(c => c.id === '392').nameJa === '日本');
  const sourceFile = `artifacts/fao-food-sources-2026-09-09/${data.source.file}`;
  if (fs.existsSync(sourceFile)) assert.equal(createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'), data.source.sha256);
  let numeric = 0, missing = 0, negative = 0, high = 0;
  for (const series of data.series) {
    const sample = data.countries.find(c => series.periods.filter(p => Number.isFinite(foodValue(def.id, p.rows.find(r => r[0] === c.id)))).length > 5);
    const dataset = buildFoodStatisticsDataset(data, def, series.id, sample.id);
    assert(dataset.rows.length > 5);
    assert.equal(dataset.derivedFromSourceOnly, data.domain === 'FBS');
    assert(dataset.rows.every(r => r.sourceFlags));
    const insight = discoverData({ dataset, rows: dataset.rows });
    assert.equal(insight.primaryId, 'food-period-records');
    assert(!JSON.stringify(insight).includes('人の集まり方'));
    assert.equal(series.periods[0].key, data.domain === 'FBS' ? '1960' : series.id === '21035' ? '1960-1962' : '2000-2002');
    if (data.domain === 'FBS') assert.deepEqual(series.periods.map(p => p.year), Array.from({ length: 64 }, (_, i) => 1960 + i));
    const keys = new Set();
    for (const p of series.periods) {
      assert(!keys.has(p.key)); keys.add(p.key);
      if (data.domain === 'FS') {
        const [start, end] = p.key.split('-').map(Number); assert.equal(end - start, 2); assert.equal(p.year, start + 1);
      }
      const countries = new Set();
      for (const row of p.rows) {
        assert(codes.has(row[0])); assert(!countries.has(row[0])); countries.add(row[0]);
        if (data.domain === 'FBS') for (const flag of row.slice(4, 7)) assert(!flag || (foodRowSource(def.id, row).id === 'FBSH' ? data.historicFlags[flag] : data.flags[flag]));
        else assert(!row[2] || data.flags[row[2]]);
        const value = foodValue(def.id, row);
        if (value === null) missing++; else { numeric++; if (value < 0) negative++; if (value > 100) high++; }
      }
    }
  }
  assert(numeric > 1000); assert(high > 0);
  if (data.domain === 'FS') assert(negative > 0);
  // Japan additions must have independent provenance, not pretend to be FBS.
  if (data.domain === 'FBS') assert(data.series.every(s => s.periods.every(p => p.rows.filter(r => r[0] === '392').every(r => ['FBSH','MAFF'].includes(r[7].source?.id)))));
  totals.push({ id: def.id, series: data.series.length, numeric, missing, negative, high });
}
const sandbox = { globalThis: {}, document: { querySelector: () => null, addEventListener() {} }, matchMedia: () => ({ matches: true, addEventListener() {} }) };
vm.runInNewContext(fs.readFileSync('map-exhibit-categories.js', 'utf8'), sandbox);
assert.equal(sandbox.globalThis.GaiaMapCategories.exhibitCount, 71);
for (const number of [70, 71]) { assert.equal(sandbox.globalThis.GaiaMapCategories.get(number).id, 'food'); assert.equal(sandbox.globalThis.GaiaMapCategories.getProfile(number).scope, 'world'); }
console.log(JSON.stringify({ status: 'passed', totals }));
