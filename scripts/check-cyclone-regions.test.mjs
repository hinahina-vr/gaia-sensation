import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { distanceKm, summarizeRegion } from './lib/cyclone-regional-data.mjs';
import { regionalSummary } from '../src/exploration/cyclone-regional-model.js';

const at = date => Date.parse(date)/3600000;
const origin = {lat:0,lon:0};
const storm = (id,points) => ({id,name:id,points});
test('Distance handles the date line and coincident points',()=>{
  assert.equal(distanceKm(0,0,0,0),0);
  assert(Math.abs(distanceKm(0,0,0,1)-111.19508)<0.0001);
  assert(Math.abs(distanceKm(0,179,0,-179)-222.39016)<0.0001);
});
test('Unique tracks, closest-approach UTC month and only wind inside the circle',()=>{
  const h=at('2016-01-31T21:00:00Z');
  const row=summarizeRegion([
    storm('cross',[[h,0,2,40],[h+3,0,1,50],[h+6,0,0,60],[h+9,0,4,200]]),
    storm('missing',[[h,0,0,null]]),storm('outside',[[h,0,10,100]])
  ],origin,2016);
  assert.equal(row.count,2);assert.deepEqual(row.months,[1,1,...Array(10).fill(0)]);
  assert.equal(row.peak.windKnots,60);assert.equal(row.measured,1);
  assert.equal(row.speedTracks,1);assert.equal(row.hours,6);
  assert(Math.abs(row.distanceKm/row.hours-37.065)<0.001);
});
test('Missing speed, zero speed, >6h gaps and no approaches remain distinct',()=>{
  const gap=summarizeRegion([storm('gap',[[0,0,0,null],[12,0,1,null]])],origin,2016);
  assert.equal(gap.hours,0);assert.equal(gap.peak,null);assert.equal(gap.count,1);
  const zero=summarizeRegion([storm('zero',[[0,0,0,0],[3,0,0,0]])],origin,2016);
  assert.equal(zero.hours,3);assert.equal(zero.distanceKm,0);assert.equal(zero.peak.windKnots,0);
  assert.equal(regionalSummary({name:'Test',years:[gap]},2016).speed,null);
  assert.equal(regionalSummary({name:'Test',years:[zero]},2016).speed,0);
  const empty=summarizeRegion([],origin,2016);assert.equal(empty.count,0);assert.equal(empty.peak,null);
  assert.throws(()=>summarizeRegion([storm('x',[[3,0,0,1],[0,0,0,1]])],origin,2016),/Unordered/);
  assert.throws(()=>summarizeRegion([storm('x',[]),storm('x',[])],origin,2016),/Duplicate/);
});
test('Partial decades use their actual season count and months sum to unique tracks',()=>{
  const data=JSON.parse(fs.readFileSync('data/climate-history/cyclone-regions.json'));
  assert.equal(data.regions.length,8);
  for(const region of data.regions){
    for(const row of region.years){assert.equal(row.months.reduce((a,b)=>a+b,0),row.count);assert(row.measured<=row.count);assert(row.speedTracks<=row.count);}
    const result=regionalSummary(region,2016),last=result.decades.at(-1);
    assert.equal(last.seasons,5);assert.equal(last.average,last.count/5);
    assert.equal(result.total,region.years.reduce((n,r)=>n+r.count,0));
    assert(!result.insight.includes('NaN'));assert(!result.insight.includes('Infinity'));
  }
  // Independent geometry oracle on real 2016 data uses vector dot products,
  // not the implementation's haversine formula, and deduplicates by SID.
  const region=data.regions.find(r=>r.id==='naha'),season=JSON.parse(fs.readFileSync('data/climate-history/cyclones/2016.json'));
  const vector=(lat,lon)=>{lat*=Math.PI/180;lon*=Math.PI/180;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
  const city=vector(region.lat,region.lon),inside=season.storms.filter(s=>s.points.some(p=>{const v=vector(p[1],p[2]);return Math.acos(Math.max(-1,Math.min(1,city.reduce((n,a,i)=>n+a*v[i],0))))*6371.0088<=300;}));
  assert.equal(region.years.find(r=>r.year===2016).count,new Set(inside.map(s=>s.id)).size);
});
