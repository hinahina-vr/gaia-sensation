import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {croplandReading,croplandData,croplandStatistics,croplandDefinition,croplandChartLimit,croplandChartYear,croplandSigned,CROPLAND_CHART} from '../src/exploration/cropland-history.js';
import {atlasDefinition,atlasStatistics,atlasColor} from '../src/exploration/atlas-history-model.js';
import {croplandComparison,croplandArrival,layoutCroplandComparisons,CROPLAND_ARRIVAL_MS} from '../src/exploration/cropland-comparison.js';
import {countrySourceId} from '../src/exploration/country-source-ids.js';
const data=JSON.parse(fs.readFileSync('data/atlas-history/cropland.json')),d=atlasDefinition('cropland');
test('206 countries retain every published value and missing year',()=>{
  const raw=JSON.parse(fs.readFileSync('artifacts/atlas-expansion-sources-20261022/cropland.json'));
  assert.equal(raw[0].lastupdated,data.sourceUpdated);assert.equal(data.regions.length,206);
  const rows=new Map(raw[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));let missing=0,count=0;
  for(const r of data.regions)for(const y of r.years){const v=rows.get(`${r.id}/${y.year}`);assert.equal(y.value,Number.isFinite(v)?Math.round(v*10000)/10000:null);if(y.value===null)missing++;count++;}
  assert.equal(count,5150);assert.equal(missing,38);
});
test('percentage-point changes are cached, signed, and never mutate original data',()=>{
  const before=JSON.stringify(data),derived=croplandData(data,'change');assert.equal(derived,croplandData(data,'change'));assert.equal(croplandData(data,'share'),data);
  assert.deepEqual(croplandReading(data.regions.find(r=>r.id==='ETH'),2016),{base:9.8295,value:14.1093,change:4.2798});
  assert.equal(croplandReading(data.regions.find(r=>r.id==='JPN'),2016).change,-.7956);
  for(const [i,r] of data.regions.entries())for(const [j,y] of r.years.entries())assert.equal(derived.regions[i].years[j].value,croplandReading(r,y.year).change);
  assert.equal(JSON.stringify(data),before);
  assert.equal(croplandSigned(-.001),'0');assert.equal(croplandSigned(.001),'0');assert.equal(croplandSigned(-.1),'−0.1');
});
test('missing baseline/current stays missing and zero remains a valid observation',()=>{
  assert.equal(croplandReading(data.regions.find(r=>r.id==='SSD'),2016).change,null);
  assert.equal(croplandReading(data.regions.find(r=>r.id==='NIC'),2024).value,null);
  for(const value of [null,undefined,NaN,101,-1])assert.equal(croplandReading({years:[{year:2000,value:50},{year:2016,value}]},2016).change,null);
  assert.deepEqual(croplandReading({years:[{year:2000,value:0},{year:2016,value:0}]},2016),{base:0,value:0,change:0});
});
test('source and derived statistics have separate restorable identities',()=>{
  const r=data.regions.find(r=>r.id==='ETH');assert.deepEqual(croplandStatistics(d,data,r,'share'),atlasStatistics(d,data,r));
  const stats=croplandStatistics(d,data,r,'change');assert.equal(stats.id,'climate-cropland-ETH-change');assert.equal(stats.unit,'ポイント');assert.deepEqual(stats.provenance,['DERIVED']);assert.equal(stats.rows.length,25);assert.equal(stats.rows.find(r=>r.year===2016).y,4.2798);
  assert.equal(croplandStatistics(d,data,data.regions.find(r=>r.id==='SSD'),'change').rows.length,0);assert.equal(croplandStatistics(d,data,null,'change'),null);
});
test('100% composition and fixed per-country time scales preserve large values',()=>{
  assert.equal(d.countryGlyphs,false);assert.deepEqual(d.range,[0,100]);const def=croplandDefinition(d,'change');assert.deepEqual(def.range,[-5,5]);assert.equal(atlasColor(def,-20),atlasColor(def,-5));assert.equal(atlasColor(def,20),atlasColor(def,5));assert.equal(atlasColor(def,null),'#566772');
  for(const r of data.regions){const max=croplandChartLimit(r);for(const y of r.years){const v=croplandReading(r,y.year).change;if(v!==null)assert(Math.abs(v)<=max);}}
  for(let year=2000;year<=2024;year++){const c=CROPLAND_CHART,x=c.left+(year-2000+.5)/25*(c.right-c.left);assert.equal(croplandChartYear(x/c.width),year);}
  assert.equal(croplandChartYear(-1),2000);assert.equal(croplandChartYear(2),2024);
});

test('comparison endpoints use one exact 0–100% scale for all 5150 national observations',()=>{
  const before=JSON.stringify(data);
  for(const region of data.regions)for(const row of region.years){const p=croplandComparison(region,row.year),r=croplandReading(region,row.year);assert.equal(p.basePosition,r.base===null?null:r.base/100);assert.equal(p.currentPosition,r.value===null?null:r.value/100);assert.equal(p.change,r.change);}
  assert(Math.abs(croplandComparison(data.regions.find(r=>r.id==='BGD'),2016).currentPosition-.604594)<1e-12);
  const missing=croplandComparison(data.regions.find(r=>r.id==='SSD'),2016);assert.equal(missing.basePosition,null);assert(missing.currentPosition>0);assert.equal(missing.change,null);
  assert.equal(croplandComparison(data.regions.find(r=>r.id==='NIC'),2024).currentPosition,null);
  const zero=croplandComparison({years:[{year:2000,value:0},{year:2016,value:0}]},2016);assert.equal(zero.currentPosition,0);assert.equal(zero.change,0);assert.equal(JSON.stringify(data),before);
});

test('country comparison identity remains the same bundled Natural Earth feature',()=>{
  assert.equal(countrySourceId('SDS'),'SSD');assert.equal(countrySourceId('PSX'),'PSE');assert.equal(countrySourceId('ETH'),'ETH');
  assert(data.regions.some(r=>r.id==='SSD'));assert(data.regions.some(r=>r.id==='PSE'));
});

test('comparison arrival is monotone, complete at 1100ms, and respects reduced motion',()=>{
  for(const index of [0,127,239]){let last=0;for(let t=0;t<=CROPLAND_ARRIVAL_MS;t+=10){const a=croplandArrival(index,240,t);assert(a>=last&&a<=1);last=a;}assert.equal(last,1);}
  assert.equal(croplandArrival(0,1,-1,true),0);assert.equal(croplandArrival(239,240,0,true),1);
});

test('map comparisons avoid controls and one another without changing geographic anchors',()=>{
  const candidates=[{id:'ETH',x:320,y:400,labelWidth:70},...Array.from({length:12},(_,i)=>({id:`C${i}`,x:140+(i%4)*150,y:250+Math.floor(i/4)*140,labelWidth:65}))];
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  for(const [width,height,compact]of [[1440,900,false],[320,568,true]]){
    const list=compact?[{...candidates[0],x:160,y:413}]:candidates;
    const obstacles=compact?[{left:0,right:width,top:0,bottom:379},{left:0,right:width,top:446,bottom:height}]:[{left:1100,right:1440,top:150,bottom:720},{left:0,right:1440,top:800,bottom:900}];
    const options={width,height,compact,selectedId:'ETH',obstacles},marks=layoutCroplandComparisons(list,options);assert(marks.some(p=>p.selected));if(compact)assert.equal(marks.length,1);
    for(const [i,p]of marks.entries()){assert.equal(p.x,list.find(c=>c.id===p.id).x);assert.equal(p.y,list.find(c=>c.id===p.id).y);assert(!obstacles.some(o=>overlaps(o,p.bounds)));assert(!marks.slice(0,i).some(o=>overlaps(o.bounds,p.bounds)));}
    assert.deepEqual(marks,layoutCroplandComparisons(list.map(p=>({...p})),options));
  }
});
