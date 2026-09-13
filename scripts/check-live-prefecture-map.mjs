import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prefecturePaths,prefectureReading,prefectureColor} from '../src/exploration/live-prefecture-map.js';
import {LIVE_EXHIBITS} from '../src/exploration/live-exhibit-catalog.js';
import {OBSERVATION_CITIES} from '../src/exploration/observation-cities.js';
const data=JSON.parse(fs.readFileSync('data/live-prefecture-fallback-v1.json','utf8'));
const topology=JSON.parse(fs.readFileSync('data/japan-prefectures.topojson','utf8'));
const shapes=prefecturePaths(topology);
assert.deepEqual(shapes.map(s=>s.code),OBSERVATION_CITIES.map(c=>c.code));
for(const shape of shapes){assert.match(shape.d,/^M/);assert.match(shape.d,/ Z$/);assert(!/NaN|undefined/.test(shape.d));}
assert.throws(()=>prefecturePaths({...topology,objects:{japan:{geometries:[]}}}));
for(const exhibit of LIVE_EXHIBITS){
 const provider=['forecastCo2','pm25'].includes(exhibit.key)?'air':'weather';
 for(const city of OBSERVATION_CITIES){const value=prefectureReading(data,exhibit.key,city.id),point=data[provider].points.find(p=>p.id===city.id);assert.equal(value.value,point.measurements[exhibit.key]);assert.equal(value.observedAt,point.observedAt);assert.equal(value.source,'snapshot');}
 const sample=structuredClone(data),point=sample[provider].points[0];
 for(const missing of [null,undefined,NaN,'0']){point.measurements[exhibit.key]=missing;assert.equal(prefectureReading(sample,exhibit.key,point.id).value,null);}
 point.measurements[exhibit.key]=0;assert.equal(prefectureReading(sample,exhibit.key,point.id).value,0);
 assert.equal(prefectureReading({},exhibit.key,'tokyo').value,null);
}
const scale=[0,100,'%', '#000000, #00ff00 20%, #ffffff'];
assert.equal(prefectureColor(0,scale),'#000000');assert.equal(prefectureColor(20,scale),'#00ff00');assert.equal(prefectureColor(60,scale),'#80ff80');assert.equal(prefectureColor(100,scale),'#ffffff');
assert.equal(prefectureColor(-500,scale),prefectureColor(0,scale));assert.equal(prefectureColor(500,scale),prefectureColor(100,scale));
for(const missing of [null,undefined,NaN,'0'])assert.equal(prefectureColor(missing,scale),'#344354');
assert.notEqual(prefectureColor(null,scale),prefectureColor(0,scale));
console.log('PASS: exact 47 JIS codes, closed geographic polygons, six metrics × 47 representative values/times/source, missing vs zero, clamped gradient and wind-style percentage stops.');
