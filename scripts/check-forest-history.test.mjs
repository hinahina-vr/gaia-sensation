import {readSourceSnapshot} from './lib/read-source-snapshot.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {forestCountryNames,forestReading,forestData,forestStatistics,forestDefinition,forestChartDomain,forestChartYear,FOREST_CHART} from '../src/exploration/forest-history.js';
import {atlasDefinition,atlasStatistics,atlasColor} from '../src/exploration/atlas-history-model.js';
import {foodCountryCopies,pickFoodCountry} from '../src/exploration/food-country-fill.js';
import {forestDataId,forestTrend,forestTrendDomain,forestArrival,FOREST_ARRIVAL_MS,layoutForestTrends} from '../src/exploration/forest-map-trends.js';
const data=JSON.parse(readSourceSnapshot('data/atlas-history/foresthistory.json')),d=atlasDefinition('foresthistory');
test('forest identity aliases match the same Natural Earth feature, never a parent',()=>{
  const geography=JSON.parse(readSourceSnapshot('data/natural-earth-50m-countries.geojson'));
  for(const f of geography.features){const p=f.properties;if(/^[A-Z]{3}$/.test(p.ISO_A3))assert.equal(forestDataId(p.ADM0_A3),p.ISO_A3);}
  assert.equal(forestDataId('SDS'),'SSD');assert.equal(forestDataId('PSX'),'PSE');assert.equal(forestDataId('BRA'),'BRA');
});
test('all 214 countries retain official source values and missing years',()=>{
  const raw=JSON.parse(readSourceSnapshot('artifacts/atlas-history-sources-20261022/foresthistory.json'));
  assert.equal(raw[0].lastupdated,data.sourceUpdated);assert.equal(data.regions.length,214);
  const rows=new Map(raw[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
  for(const r of data.regions)for(const y of r.years){const v=rows.get(`${r.id}/${y.year}`);assert.equal(y.value,Number.isFinite(v)?Math.round(v*10000)/10000:null);}
});
test('baseline changes are percentage points, signed, cached and do not mutate source',()=>{
  const before=JSON.stringify(data),derived=forestData(data,'change');assert.equal(derived,forestData(data,'change'));assert.equal(forestData(data,'share'),data);
  assert.deepEqual(forestReading(data.regions.find(r=>r.id==='BRA'),2016),{base:67.0867,value:61.363,change:-5.7237});
  assert.equal(forestReading(data.regions.find(r=>r.id==='CHN'),2016).change,3.7339);
  for(const [i,r] of data.regions.entries())for(const [j,y] of r.years.entries())assert.equal(derived.regions[i].years[j].value,forestReading(r,y.year).change);
  assert.equal(JSON.stringify(data),before);
});
test('missing baseline is never replaced; missing current and invalid values stay absent',()=>{
  const original=data.regions.find(r=>r.id==='CHI'),named=forestCountryNames(data).regions.find(r=>r.id==='CHI');assert.equal(named.name,'チャネル諸島');assert.equal(named.years,original.years);
  const region=data.regions.find(r=>r.id==='SSD');assert.equal(forestReading(region,2016).change,null);assert.equal(forestReading(region,2016).value,11.3242);
  assert.equal(forestReading(data.regions.find(r=>r.id==='CHI'),2023).value,null);
  for(const value of [null,undefined,NaN,101,-1])assert.equal(forestReading({years:[{year:2000,value:50},{year:2016,value}]},2016).change,null);
  assert.equal(forestReading({years:[{year:2000,value:0},{year:2016,value:0}]},2016).change,0);
});
test('statistics retain source IDs and use separate restorable derived IDs',()=>{
  const r=data.regions.find(r=>r.id==='BRA');assert.deepEqual(forestStatistics(d,data,r,'share'),atlasStatistics(d,data,r));
  const stats=forestStatistics(d,data,r,'change');assert.equal(stats.id,'climate-foresthistory-BRA-change');assert.equal(stats.unit,'ポイント');assert.deepEqual(stats.provenance,['DERIVED']);assert.equal(stats.rows.length,24);assert.equal(stats.rows.find(r=>r.year===2016).y,-5.7237);
  assert.equal(forestStatistics(d,data,data.regions.find(r=>r.id==='SSD'),'change').rows.length,0);assert.equal(forestStatistics(d,data,null,'change'),null);
});
test('zero-centered map scale clips colors only, not data; chart bounds and hit tests agree',()=>{
  const def=forestDefinition(d,'change');assert.deepEqual(def.range,[-10,10]);assert.equal(atlasColor(def,-20),atlasColor(def,-10));assert.equal(atlasColor(def,20),atlasColor(def,10));assert.equal(atlasColor(def,null),'#566772');
  for(const region of data.regions){const [low,high]=forestChartDomain(region);assert(high>low);for(const r of region.years)if(Number.isFinite(r.value))assert(r.value>=low&&r.value<=high);}
  for(let year=2000;year<=2023;year++){const c=FOREST_CHART,x=c.left+(year-2000)/23*(c.right-c.left);assert.equal(forestChartYear(x/c.width),year);}
  assert.equal(forestChartYear(-1),2000);assert.equal(forestChartYear(2),2023);
});
test('forest wrapping is opt-in and picks the geographic copy outside the old frame',()=>{
  const view={originX:-300,originY:0,scale:1,rect:{left:0,top:0,width:360,height:180}};
  assert.equal(foodCountryCopies(view).length,2);assert.equal(foodCountryCopies({...view,wrapX:true}).length,4);
  const shape={id:'X',path:{},bounds:{left:170,right:190,top:80,bottom:100}},ctx={save(){},restore(){},setTransform(){},isPointInPath:(_p,x,y)=>x>=170&&x<=190&&y>=80&&y<=100};
  assert.equal(pickFoodCountry(ctx,[shape],view,90,90),null);
  assert.equal(pickFoodCountry(ctx,[shape],{...view,wrapX:true},90,90),'X');
});
test('country traces use a fixed common domain that includes even changes outside map colors',()=>{
  const domain=forestTrendDomain(data,'change');assert.deepEqual(domain,[-25,10]);assert.equal(forestTrendDomain(data,'change'),domain);assert.deepEqual(forestTrendDomain(data,'share'),[0,100]);
  for(const r of data.regions)for(const mode of ['change','share']){
    const d=forestTrendDomain(data,mode),trace=forestTrend(r,mode);
    for(const p of trace.points){assert(p.value>=d[0]&&p.value<=d[1]);assert.equal(p.value,mode==='change'?forestReading(r,p.year).change:forestReading(r,p.year).value);}
    for(const [a,b] of trace.segments)assert.equal(b.year-a.year,1);
  }
});
test('map traces never bridge missing years or replace a missing baseline with zero',()=>{
  const r={years:[{year:2000,value:40},{year:2001,value:42},{year:2002,value:null},{year:2003,value:38},{year:2005,value:39}]};
  const trace=forestTrend(r,'change');assert.equal(trace.baseline,0);assert.equal(trace.segments.length,1);assert.deepEqual(trace.segments[0],[{year:2000,value:0},{year:2001,value:2}]);
  const missing={years:[{year:2000,value:null},{year:2016,value:11.3242}]};assert.deepEqual(forestTrend(missing,'change'),{points:[],segments:[],baseline:null});assert.equal(forestTrend(missing,'share').points[0].value,11.3242);
});
test('forest reveal has no jumps, completes at 1100ms and respects reduced motion',()=>{
  for(let i=0;i<240;i++){let previous=0;for(let ms=0;ms<=1100;ms+=20){const a=forestArrival(i,240,ms);assert(a>=previous&&a<=1);previous=a;}assert.equal(forestArrival(i,240,FOREST_ARRIVAL_MS),1);}
  assert.equal(forestArrival(239,240,0,true),1);assert.equal(forestArrival(0,1,-1,true),0);
});
test('forest map readings avoid fixed UI and keep geographical anchors and year-stable placement',()=>{
  const point={id:'BRA',name:'ブラジル',x:160,y:420,labelWidth:40},obstacles=[{left:68,right:308,top:186,bottom:396},{left:0,right:320,top:446,bottom:568}];
  const marks=layoutForestTrends([point],{width:320,height:568,compact:true,selectedId:'BRA',obstacles});assert.equal(marks.length,1);assert.equal(marks[0].x,160);assert.equal(marks[0].y,420);
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  assert(!obstacles.some(b=>intersects(marks[0].bounds,b)));
  const candidates=Array.from({length:10},(_,i)=>({...point,id:String(i),x:180+i*110,y:400+i%2*170})),options={width:1440,height:900,compact:false,selectedId:'3',obstacles:[]};
  const a=layoutForestTrends(candidates,options),b=layoutForestTrends(candidates.map(p=>({...p,value:8})),options);assert(a.length>3);assert.deepEqual(a.map(p=>[p.id,p.bounds]),b.map(p=>[p.id,p.bounds]));a.forEach((p,i)=>a.slice(i+1).forEach(q=>assert(!intersects(p.bounds,q.bounds))));
});
