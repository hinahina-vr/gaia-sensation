import assert from 'node:assert/strict';
import { quakeMarkerStyle } from '../src/exploration/quake-reading.js';
const now = Date.parse('2026-10-20T03:00:00Z');
let previous = null;
for (const magnitude of [0,.5,1,2,2.5,3,4,5,6,7,8,9]) {
  const style = quakeMarkerStyle({ magnitude, time: now },now);
  assert(style.core > 0 && style.radius > style.core && style.period > 0);
  if (previous) assert(style.core > previous.core && style.radius > previous.radius);
  previous = style;
}
assert.equal(quakeMarkerStyle({magnitude:2,time:now},now).rings,0);
assert.equal(quakeMarkerStyle({magnitude:3,time:now},now).rings,1);
assert.equal(quakeMarkerStyle({magnitude:6,time:now},now).rings,2);
const current=quakeMarkerStyle({magnitude:4,time:now},now);
const older=quakeMarkerStyle({magnitude:4,time:now-23*3600000},now);
assert(current.opacity > older.opacity && older.opacity > 0);
assert.equal(current.radius,older.radius,'Recency must not change magnitude encoding');
assert.equal(quakeMarkerStyle({magnitude:4,time:now+3600000},now).opacity,1);
for (const point of [null,{}, {magnitude:NaN,time:Infinity}, {magnitude:100,time:-Infinity}]) {
  assert(Object.values(quakeMarkerStyle(point,NaN)).every(Number.isFinite));
}
assert.equal(quakeMarkerStyle({magnitude:10},now).core,quakeMarkerStyle({magnitude:9},now).core);
console.log('quake-reading: magnitude ordering, recency, ring budgets and invalid inputs passed');
