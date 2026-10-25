import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {fertilizerReading,fertilizerScale,fertilizerDistribution,fertilizerChartYear,fertilizerArrival,fertilizerFormat} from '../src/exploration/fertilizer-use.js';
import {atlasDefinition,atlasStatistics} from '../src/exploration/atlas-history-model.js';
const bytes=fs.readFileSync('data/atlas-history/fertilizer.json'),data=JSON.parse(bytes),country=id=>data.regions.find(r=>r.id===id);
test('84 preserves every source value and a full-period linear chart scale',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'25a378540dfa8075c144ddb41bd5efb3056935bf201347e1132399bb48958585');
 assert.equal(data.regions.length,200);let count=0,missing=0,over=0,zero=0;
 for(const r of data.regions){const limit=fertilizerScale(r);for(const y of r.years){count++;const p=fertilizerReading(r,y.year);assert.equal(p.value,y.value);if(y.value===null)missing++;else assert(limit>y.value);if(y.value>500)over++;if(y.value===0)zero++;}}
 assert.deepEqual({count,missing,over,zero},{count:5000,missing:190,over:242,zero:49});
});
test('country distribution is unweighted and excludes missing but keeps zero',()=>{
 for(let year=2000;year<=2024;year++){const expected=data.regions.map(r=>r.years.find(y=>y.year===year).value).filter(v=>v!==null).sort((a,b)=>a-b),actual=fertilizerDistribution(data,year),n=expected.length;
 assert.equal(actual.count,n);assert.equal(actual.missing,200-n);assert.equal(actual.median,(expected[Math.floor((n-1)/2)]+expected[Math.floor(n/2)])/2);assert.equal(actual.overflow,expected.filter(v=>v>500).length);}
 assert.equal(fertilizerDistribution({regions:[]},2016).median,null);
});
test('84 nutrients per arable hectare stay separate from cereal harvest and source statistics',()=>{
 const d=atlasDefinition('fertilizer');assert.equal(d.countryGlyphs,false);assert.equal(d.code,'AG.CON.FERT.ZS');assert.equal(d.unit,'kg/ha');
 const stats=atlasStatistics(d,data,country('IND'));assert.deepEqual(stats.provenance,['SOURCE']);assert.equal(stats.rows.find(r=>r.year===2016).y,165.4368);assert.equal(stats.rows.length,25);
});
test('small positive values, true zero, extreme and missing remain distinguishable',()=>{
 assert.equal(fertilizerFormat(.0008),'0.0008');assert.equal(fertilizerFormat(.0336),'0.0336');assert.equal(fertilizerFormat(0),'0');assert.equal(fertilizerFormat(null),'欠測');
 assert.equal(fertilizerReading(country('FRO'),2017).value,16171.4286);assert.equal(fertilizerScale(country('FRO')),20000);
 assert.equal(fertilizerReading(country('MHL'),2016).value,null);assert.equal(fertilizerReading(country('SSD'),2016).base,null);
});
test('all year hit areas, edge clamp and monotonic arrival',()=>{
 for(let year=2000;year<=2024;year++)assert.equal(fertilizerChartYear((64+(year-2000+.5)/25*520)/600),year);
 assert.equal(fertilizerChartYear(-1),2000);assert.equal(fertilizerChartYear(3),2024);
 assert.equal(fertilizerArrival(0,200,-1,true),0);assert.equal(fertilizerArrival(199,200,0,true),1);assert.equal(fertilizerArrival(199,200,1100),1);
 const a=Array.from({length:111},(_,i)=>fertilizerArrival(5,200,i*10));for(let i=1;i<a.length;i++)assert(a[i]>=a[i-1]);
});
