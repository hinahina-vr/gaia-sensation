import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { recordReadings, recordReadingTranslations, foodBalanceReading } from '../src/exploration/record-reading-catalog.js';

assert.deepEqual(Object.keys(recordReadings).map(Number), [61,62,63,64,65,66,67,68,69]);
const translations = new Map(recordReadingTranslations.map(row => [row[0], row.slice(1)]));
for (const [number, def] of Object.entries(recordReadings)) {
  for (const field of ['caption', 'explanation', 'readingBasis', 'visualMap', 'guide', 'qualityNote']) {
    assert(def[field]?.length > 0, `${number}/${field}`);
    assert(translations.get(def[field])?.every(Boolean), `${number}/${field} translations`);
  }
  assert.equal(def.sourceRecordKind, +number <= 64 ? 'water' : +number <= 67 ? 'prtr' : 'biology');
}
Object.values(foodBalanceReading).forEach(text => assert(translations.get(text)?.every(Boolean)));
// Compare catalog invariants with the pre-change Git tree; no network or copied fixtures.
const catalog = async (file, previous) => {
  const cache = new Map();
  const context = vm.createContext({});
  const load = relative => {
    relative = relative.replaceAll('\\', '/');
    if (!cache.has(relative)) {
      const source = previous ? execFileSync('git', ['show', `HEAD:${relative}`], { encoding: 'utf8' }) : fs.readFileSync(relative, 'utf8');
      cache.set(relative, new vm.SourceTextModule(source, { context, identifier: relative }));
    }
    return cache.get(relative);
  };
  const entry = load(file);
  await entry.link((specifier, parent) => load(path.posix.join(path.posix.dirname(parent.identifier), specifier.split('?')[0])));
  await entry.evaluate(); return entry.namespace;
};
let checked = 0;
for (const [file, exported] of [['japan-pollution-catalog.js','JAPAN_POLLUTION_EXHIBITS'],['prtr-biology-catalog.js','PRTR_BIOLOGY_EXHIBITS'],['food-catalog.js','FOOD_EXHIBITS']]) {
  const old = (await catalog(`src/exploration/${file}`, true))[exported];
  const current = (await catalog(`src/exploration/${file}`, false))[exported];
  for (const before of old) {
    const after = current.find(d => d.id === before.id);
    assert(after);
    for (const key of Object.keys(before).filter(k => !['caption','picker','explanation'].includes(k))) {
      assert.equal(JSON.stringify(after[key]), JSON.stringify(before[key]), `${before.number}/${key} unchanged`); checked++;
    }
  }
}
assert.equal(execFileSync('git', ['diff', '--name-only', '--', 'data'], { encoding: 'utf8' }).trim(), '');
console.log(`PASS: 61–70 guidance/translations; ${checked} existing catalog fields, source values, units, years, scales, colors and provenance unchanged`);
