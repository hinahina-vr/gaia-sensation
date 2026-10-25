import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {yieldReading,yieldScale,yieldHistory,yieldChartYear,yieldArrival,yieldFormat} from '../src/exploration/cereal-yield.js';
import {atlasDefinition,atlasStatistics} from '../src/exploration/atlas-history-model.js';
const bytes=fs.readFileSync('data/atlas-history/yield.json'),data=JSON.parse(bytes),country=id=>data.regions.find(r=>r.id===id);
test('83 preserves all 4500 source records, including missing and >10000 values',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'f4445f0531fe3445716ea13de739c3929ae57ee6f825e36c1ea7290e72c234da');
  assert.equal(data.regions.length,180);let rows=0,missing=0,over=0;
  for(const r of data.regions){const limit=yieldScale(r);for(const y of r.years){rows++;const reading=yieldReading(r,y.year);assert.equal(reading.value,y.value);if(y.value===null)missing++;else assert(limit>y.value);if(y.value>10000)over++;assert.equal(reading.change,reading.value===null||reading.base===null?null:Math.round((reading.value-reading.base)*10000)/10000);}}
  assert.equal(rows,4500);assert.equal(missing,50);assert.equal(over,83);
});
test('source metric is kg per cereal harvested hectare, not arable fraction',()=>{
  const d=atlasDefinition('yield');assert.equal(d.countryGlyphs,false);assert.match(d.guide,/収穫面積/);assert.equal(d.unit,'kg/ha');assert.equal(d.code,'AG.YLD.CREL.KG');
  const stats=atlasStatistics(d,data,country('IND'));assert.deepEqual(stats.provenance,['SOURCE']);assert.equal(stats.rows.find(r=>r.year===2016).y,3012.9);assert.equal(stats.rows.length,25);
});
test('missing baseline and year stay null; tiny values stay visible; outliers fit',()=>{
  assert.equal(yieldReading(country('SSD'),2016).change,null);assert(yieldReading(country('SSD'),2016).value>0);
  assert.equal(yieldReading(country('NIC'),2024).value,null);assert.equal(yieldFormat(.1),'0.1');assert.equal(yieldFormat(null),'欠測');
  assert.equal(yieldReading(country('ARE'),2013).value,36761.9);assert.equal(yieldScale(country('ARE')),40000);
});
test('history only joins adjacent published years, and keeps isolated points',()=>{
  const h=yieldHistory(country('HKG'));assert(!h.segments.some(([a,b])=>a.year===2005||b.year===2007));assert(h.points.some(p=>p.year===2005));assert(!h.points.some(p=>p.year===2006));
  assert.equal(yieldHistory(country('IND')).segments.length,24);
});
test('chart input and arrival respect full bounds and reduced motion',()=>{
  for(let year=2000;year<=2024;year++)assert.equal(yieldChartYear((72+(year-2000)/24*510)/600),year);
  assert.equal(yieldChartYear(-1),2000);assert.equal(yieldChartYear(3),2024);
  assert.equal(yieldArrival(0,180,-1,true),0);assert.equal(yieldArrival(179,180,0,true),1);assert.equal(yieldArrival(179,180,1100),1);
  const frames=Array.from({length:111},(_,i)=>yieldArrival(5,180,i*10));for(let i=1;i<frames.length;i++)assert(frames[i]>=frames[i-1]);
});
