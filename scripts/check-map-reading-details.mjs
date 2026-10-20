import assert from 'node:assert/strict';
import { currentReading, mapReadingDetails } from '../src/exploration/map-reading-details.js';
for (const [uMs, vMs, bearing, direction] of [[0,1,0,'北へ'],[1,0,90,'東へ'],[0,-1,180,'南へ'],[-1,0,270,'西へ']]) {
  assert.deepEqual(currentReading({ uMs, vMs }), { speed: 1, bearing, direction });
}
assert.equal(currentReading({uMs:0,vMs:0}).bearing,null);
assert.equal(currentReading({uMs:NaN,vMs:1}),null);
const ocean = mapReadingDetails('blue-circulation', {uMs:1,vMs:0,time:'2026-07-30T00:00:00Z'}, {horizonHours:24*14});
assert.equal(ocean.metrics[2][1], '1209.6 km');
assert.equal(ocean.currentTo,90); // TO is not the meteorological FROM direction.
for (const [id, valueKey, unit] of [['forest-cloud-engine','precipitationMmDay','mm/日'],['nothing-is-waste','recyclePercent','%'],['anthropocene-scar','emissionsMtCo2','Mt CO₂']]) {
  assert(mapReadingDetails(id,{[valueKey]:0}).metrics[0][1].includes('0.0'));
  assert(mapReadingDetails(id,{[valueKey]:null}).metrics[0][1].includes('—'));
  assert(mapReadingDetails(id,{[valueKey]:1}).metrics[0][1].includes(unit));
}
for (const provenance of ['SOURCE / 衛星地図から読み取った値','DERIVED / 昔の記録から再現','SCENARIO / これまでの傾向が続いた場合']) {
  assert.equal(mapReadingDetails('breathing-earth',{provenance,valuePpm:400}).state,provenance);
}
assert.equal(mapReadingDetails('breathing-earth',{valuePpm:null}).metrics[0][1],'NO DATA');
assert.equal(mapReadingDetails('forest-cloud-engine',{period:'January 2001 - December 2020'}).time,'2001–2020');
assert.equal(mapReadingDetails('anthropocene-scar',{year:1945}).model,mapReadingDetails('anthropocene-scar',{year:2023}).model);
assert.equal(mapReadingDetails('unrelated',{}),null);
assert.equal(mapReadingDetails('nothing-is-waste',{datasetId:'worldbank-waw3-recycling',recyclePercent:12}).metrics[0][0],'再資源化向け回収率');
assert.equal(mapReadingDetails('earth-organ',{renewablePercent:0,year:2021}).metrics[0][1],'0.0%');
assert.equal(mapReadingDetails('earth-organ',{renewablePercent:null}).metrics[0][1],'—%');
assert.equal(mapReadingDetails('population-tide',{population:0,year:1960}).metrics[0][1],'0 人');
assert.equal(mapReadingDetails('population-tide',{population:null}).metrics[0][1],'—');
assert.equal(mapReadingDetails('population-tide',{population:127076000,year:2016}).metrics[0][1],'127,076,000 人');
assert.equal(mapReadingDetails('rhythm-of-disaster',{magnitude:7.8,depthKm:0},{eventTime:'2016/01/01 00:00 JST'}).metrics[1][1],'0.0 km');
assert.equal(mapReadingDetails('rhythm-of-disaster',{depthKm:null}).metrics[1][1],'— km');
console.log('PASS map reading: missing/zero, current TO bearing, fixed-vector travel estimate, CO2 provenance, climatology period, fixed night-light year');
