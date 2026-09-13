import assert from 'node:assert/strict';
import fs from 'node:fs';
import {livePeriods, liveFieldAt, liveStateAt} from '../src/exploration/live-timeline.js';
import {LIVE_EXHIBITS} from '../src/exploration/live-exhibit-catalog.js';
const data=JSON.parse(fs.readFileSync('data/live-prefecture-fallback-v1.json','utf8'));
const base={measurements:{},source:'snapshot',requestState:'unavailable',events:[],connected:false};
for(const e of LIVE_EXHIBITS){
 const provider=['forecastCo2','pm25'].includes(e.key)?'air':'weather';
 const times=livePeriods(data,e.key);
 assert.equal(times.length,24,`${e.key}: real saved hourly samples`);
 assert.equal(Date.parse(times.at(-1))-Date.parse(times[0]),23*3600000);
 for(const time of [times[0],times[12],times.at(-1)]){
  const field=liveFieldAt(data,time);assert.equal(field[provider].points.length,47);
  for(const p of field[provider].points){
   const state=liveStateAt(base,data,p.id,time);
   assert.equal(state.measurements[e.key]?.value,p.measurements[e.key]??undefined);
   assert.equal(state.measurements[e.key]?.observedAt,time);
   assert.equal(state.measurements[e.key]?.location.lat,p.lat);
   assert.equal(state.selectedTime,time);assert.equal(state.connected,false);
  }
 }
 assert.equal(liveStateAt(base,data,'sapporo',null).measurements[e.key]?.value,data[provider].points.find(p=>p.id==='sapporo').measurements[e.key]);
 const copy=structuredClone(data);copy[provider].history[0].points[0].measurements[e.key]=null;
 assert.equal(liveStateAt(base,copy,copy[provider].points[0].id,times[0]).measurements[e.key],undefined);
 copy[provider].history[0].points[0].measurements[e.key]=0;
 assert.equal(liveStateAt(base,copy,copy[provider].points[0].id,times[0]).measurements[e.key].value,0);
 assert.equal(liveFieldAt(data,'2000-01-01T00:00:00Z')[provider].points.length,0);
 assert.equal(livePeriods({},e.key).length,0);
}
assert.equal(liveFieldAt(data,null),data);
const previous={...base,measurements:{weatherWindSpeed:{value:4,observedAt:'2020-01-01T00:00:00Z'}}};
assert.notEqual(liveStateAt(previous,data,'sapporo',null).measurements.weatherWindSpeed.value,4,'Older emergency snapshot must not replace newer national value');
previous.measurements.weatherWindSpeed.observedAt='2099-01-01T00:00:00Z';
assert.equal(liveStateAt(previous,data,'sapporo',null).measurements.weatherWindSpeed.value,4,'Newer city provider value wins');
console.log('PASS: six metrics × 47 cities × oldest/middle/newest; real provider timestamps, missing/zero, latest return, no cross-city or cross-time substitution.');
