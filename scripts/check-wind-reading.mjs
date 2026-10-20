import assert from 'node:assert/strict';
import { windReading, windReadingTranslations } from '../src/exploration/wind-reading.js';
for (const [from, dx, dy, label] of [
  [0, 0, 1, '北から'], [90, -1, 0, '東から'],
  [180, 0, -1, '南から'], [270, 1, 0, '西から'],
  [360, 0, 1, '北から'], [-90, 1, 0, '西から'],
]) {
  const reading = windReading({ windDirection: from, windSpeed: 5 });
  assert(Math.abs(reading.dx - dx) < 1e-9);
  assert(Math.abs(reading.dy - dy) < 1e-9);
  assert(reading.label.endsWith(label));
}
assert.equal(windReading({ windDirection: 0, windSpeed: 0 }), null, 'Calm has no invented direction');
assert.equal(windReading({ windDirection: NaN, windSpeed: 5 }), null);
assert.equal(windReading({ windDirection: 90, windSpeed: NaN }), null);
assert.equal(windReadingTranslations.length, 16);
console.log('Wind bearing, 16-point labels, calm and unavailable values: passed');
