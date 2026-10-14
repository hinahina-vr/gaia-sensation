import assert from 'node:assert/strict';
import test from 'node:test';
import { PRTR_BIOLOGY_EXHIBITS, recordAppearance, displayFraction } from '../src/exploration/prtr-biology-catalog.js';

const oldFraction = (definition, value) => {
  const transform = n => definition.logScale ? Math.log10(1 + n) : n;
  const low = transform(definition.stops[0]), high = transform(definition.stops.at(-1));
  return (transform(Math.max(definition.stops[0], Math.min(definition.stops.at(-1), value))) - low) / (high - low);
};
const oldAppearance = (definition, value) => {
  if (!Number.isFinite(value)) return { color: '#abb5be', radius: 2.2 };
  const amount = oldFraction(definition, value), scaled = amount * (definition.colors.length - 1);
  const low = Math.floor(scaled), high = Math.min(low + 1, definition.colors.length - 1), blend = scaled - low;
  const rgb = hex => hex.match(/[a-f0-9]{2}/gi).map(n => parseInt(n, 16));
  const a = rgb(definition.colors[low]), b = rgb(definition.colors[high]);
  return { color: `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * blend)).join(', ')})`, radius: 2.5 + Math.sqrt(amount) * 4.5 };
};
for (const definition of PRTR_BIOLOGY_EXHIBITS) test(`${definition.number}: palette optimization preserves exact colors, radii and legend fractions`, () => {
  const values = [null, undefined, NaN, Infinity, -Infinity, -1, -0, ...definition.stops, 1e12];
  for (let i = 0; i <= 10000; i++) values.push((10 ** (i / 1250)) - 1);
  for (const value of values) {
    assert.deepEqual(recordAppearance(definition, value), oldAppearance(definition, value));
    assert.equal(displayFraction(definition, value), oldFraction(definition, value));
  }
});
test('mutable custom definitions and replaced palettes do not reuse stale scales', () => {
  const definition = { stops: [0, 100], colors: ['#000000', '#ffffff'] };
  for (const apply of [() => {}, () => { definition.stops[1] = 20; }, () => { definition.colors[1] = '#00ff00'; }, () => { definition.logScale = true; },
    () => { definition.stops = Object.freeze([0, 60]); definition.colors = Object.freeze(['#123456', '#abcdef']); },
    () => { definition.logScale = false; }, () => { definition.colors = Object.freeze(['#000000', '#ffffff']); }]) {
    apply(); assert.deepEqual(recordAppearance(definition, 10), oldAppearance(definition, 10));
  }
});
