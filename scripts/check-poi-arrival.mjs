import assert from 'node:assert/strict';
import { poiArrival, poiArrivalDuration } from '../src/exploration/annual-poi-arrival.js';

for (const count of [1, 2, 38, 916, 2042, 8336]) {
  assert(poiArrivalDuration(count) <= 2430, 'Bounded duration for large datasets');
  for (const i of [0, Math.floor((count - 1) / 2), count - 1]) {
    assert.equal(poiArrival(i, count, -1).alpha, 0);
    assert.equal(poiArrival(i, count, -1, true).alpha, 0);
    assert.deepEqual(poiArrival(i, count, 0, true), {progress:1,alpha:1,scale:1});
    assert.deepEqual(poiArrival(i, count, poiArrivalDuration(count)), {progress:1,alpha:1,scale:1});
    let lastAlpha=0, popped=false;
    for(let t=0;t<=poiArrivalDuration(count);t+=10) {
      const p=poiArrival(i,count,t);assert(p.alpha>=lastAlpha&&p.alpha<=1&&p.scale>=0&&p.scale<1.2);lastAlpha=p.alpha;popped ||= p.scale>1;
    }
    assert(popped,'Each point has a small overshoot');
  }
}
const starts=Array.from({length:38},(_,i)=>{
  for(let t=0;t<=poiArrivalDuration(38);t++)if(poiArrival(i,38,t).alpha>0)return t;
});
assert.equal(new Set(starts).size,38,'Individual staggered start times');
assert(starts.every((v,i)=>i===0||v>starts[i-1]));
console.log('PASS POI arrival: independent starts, bounded duration, small pop, reduced-motion and hidden gate');
