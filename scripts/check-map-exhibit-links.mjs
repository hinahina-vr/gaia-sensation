import assert from 'node:assert/strict';
import '../map-exhibit-route.js';

const route = globalThis.GaiaMapRoute;
for (let number = 1; number <= 71; number += 1) {
  const hash = `#world-${String(number).padStart(2, '0')}`;
  assert.equal(route.hashForNumber(number), hash);
  assert.equal(route.numberFromHash(hash), number);
  assert.equal(route.isMapHash(hash), true);
}
assert.equal(route.numberFromHash('#world-8'), 8);
assert.equal(route.numberFromHash('#WORLD-08'), 8);
for (const hash of ['#world-00', '#world-72', '#world-9999', '#world-eight', '#world-08/extra', '#story', '', '#world']) {
  assert.equal(route.numberFromHash(hash), null, hash);
}
for (const hash of ['#world', '#earth', '#japan', '#data', '#world-99']) assert.equal(route.isMapHash(hash), true);
for (const number of [0, 72, NaN, 1.5, 'garbage']) assert.equal(route.hashForNumber(number), null);
console.log('Exhibit links: all 71 numbers, aliases, normalization and invalid input passed.');
