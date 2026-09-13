import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAnnualSnapshot } from './lib/annual-snapshot.mjs';
import vm from 'node:vm';
import { PRTR_BIOLOGY_EXHIBITS, recordAppearance, displayFraction } from '../src/exploration/prtr-biology-catalog.js';
import { discoverData } from '../statistics-discovery.js';

assert.equal(PRTR_BIOLOGY_EXHIBITS.length, 5);
const cache = new Map();
for (const def of PRTR_BIOLOGY_EXHIBITS) {
  if (!cache.has(def.dataFile)) cache.set(def.dataFile, readAnnualSnapshot(def.dataFile));
  const data = cache.get(def.dataFile);
  assert.deepEqual(data.periods.map(p => p.year), def.years);
  for (const p of data.periods) {
    assert.equal(new Set(p.stations.map(s => s.id)).size, p.stations.length);
    for (const s of p.stations) {
      assert(s.lon >= 122 && s.lon <= 154 && s.lat >= 20 && s.lat <= 46);
      const m = s.metrics?.[def.measurementKey] || s.measurement;
      assert(m.value === null || Number.isFinite(m.value) && m.value >= 0);
      if (def.category === 'biology') {
        assert.equal(m.value, new Set(s.taxa).size);
        assert(s.taxa.every(code => data.taxonNames[code]));
        assert(s.taxa.every(code => s.taxonNames[code]?.length > 0));
        // Management IDs can name a different year (e.g. the published 2009
        // survey rows carry R2010 IDs). Display the actual 調査年度 column.
        assert(s.surveyIds.every(id => /^R\d{4}_/.test(id)));
      } else {
        assert(s.substances.every(r => (p.substanceNames || data.substanceNames)[r[0]] && !/ダイオキシン/.test((p.substanceNames || data.substanceNames)[r[0]])));
        const values = s.substances.map(r => def.measurementKey === 'transfer' ? r[5] === null || r[6] === null ? null : r[5] + r[6] : r[def.measurementKey === 'air' ? 1 : 2]);
        const sum = values.reduce((s, v) => s + v, 0);
        if (!values.length || values.some(v => v === null)) assert.equal(m.value, null);
        else assert(Math.abs(m.value - sum) <= 1e-8 * Math.max(1, sum));
        assert(!Object.keys(s).some(k => /representative|telephone|email/.test(k)));
      }
    }
  }
  assert.equal(displayFraction(def, def.stops[0]), 0);
  assert.equal(displayFraction(def, def.stops.at(-1)), 1);
  assert.equal(recordAppearance(def, NaN).color, '#abb5be');
  assert.notEqual(recordAppearance(def, 10).color, recordAppearance(def, 100).color);
}
const sandbox = {
  document: { querySelector: () => null, addEventListener() {} },
  matchMedia: () => ({ matches: true, addEventListener() {} }),
};
vm.runInNewContext(fs.readFileSync('map-exhibit-categories.js', 'utf8'), sandbox);
assert.equal(sandbox.GaiaMapCategories.exhibitCount, 71);
assert.equal(sandbox.GaiaMapCategories.get(65).id, 'chemicals');
assert.equal(sandbox.GaiaMapCategories.get(69).id, 'biology');
assert.equal(sandbox.GaiaMapCategories.getProfile(65).time, 'comparison');
for (const domain of ['prtr', 'river-biology']) {
  const result = discoverData({ dataset: { id: 'fixture', title: 'QA', unit: '件', xKind: domain === 'prtr' ? 'category' : 'year', yLabel: '公表値',
    insightContext: { domain }, comparisonNote: 'QA source limit' }, rows: [1, 2, 3].map(n => ({ id: String(n), label: String(n), value: n * 3, x: 2020 + n, provenance: 'SOURCE' })) });
  assert.equal(result.primaryId, 'public-report-records');
  assert.equal(result.candidates.length, 1, 'No population/risk/trend narrative generated for these datasets');
  assert(!result.candidates[0].chart.line);
}
console.log('PASS: PRTR/biodiversity datasets, units, missingness, taxonomy, registry, logarithmic scale and descriptive analysis');
