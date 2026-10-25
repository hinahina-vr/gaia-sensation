import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {WATER_STRESS_LEVELS,waterStressBand,waterStressColor,waterStressReading,waterStressScale,waterStressChartYear,WATER_STRESS_CHART,waterStressHistory} from '../src/exploration/water-stress.js';
import {stressBalance,stressArrival,STRESS_ARRIVAL_MS,layoutStressMarks} from '../src/exploration/water-stress-marks.js';
import {countrySourceId} from '../src/exploration/country-source-ids.js';
import {atlasDefinition,atlasColor,atlasStatistics} from '../src/exploration/atlas-history-model.js';
const data=JSON.parse(fs.readFileSync('data/atlas-history/waterstress.json')),d=atlasDefinition('waterstress'),region=id=>data.regions.find(r=>r.id===id);
test('178 national histories match the archived official values; missing values remain missing',()=>{
  assert.equal(data.regions.length,178);assert.deepEqual(data.period,[2000,2022]);
  const raw=JSON.parse(fs.readFileSync('artifacts/atlas-expansion-sources-20261022/waterstress.json'))[1],values=new Map(raw.map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));let missing=0;
  for(const r of data.regions)for(const y of r.years){const v=values.get(`${r.id}/${y.year}`);assert.equal(y.value,Number.isFinite(v)?Math.round(v*10000)/10000:null);if(y.value===null)missing++;}
  assert.equal(missing,141);
});
test('five FAO classes use explicit boundaries, retain zero and distinguish unknown from high stress',()=>{
  for(const [v,band]of [[0,0],[24.999,0],[25,1],[49.999,1],[50,2],[75,3],[100,3],[100.0001,4],[3850.5,4],[null,null],[undefined,null],[NaN,null],[-1,null]]){
    assert.equal(waterStressBand(v),band);assert.equal(atlasColor(d,v),band===null?'#566772':WATER_STRESS_LEVELS[band].color);
  }
  assert.notEqual(waterStressColor(0),waterStressColor(null));assert.equal(d.countryGlyphs,false);assert(!d.visualReading);
});
test('source ratios and 2000 point differences are unrounded until displayed',()=>{
  assert.deepEqual(waterStressReading(region('EGY'),2016),{value:110.4736,base:103.8798,band:4,change:6.5938});
  assert.equal(waterStressReading(region('JPN'),2016).value,36.6437);
  assert.equal(waterStressReading(region('KWT'),2022).value,3850.5);
  assert.equal(waterStressReading(region('SSD'),2016).change,null);
  assert.equal(waterStressReading(region('ISR'),2022).value,null);
});
test('full-history linear scales include every value and the 100 reference without a year-dependent jump',()=>{
  for(const r of data.regions){const max=waterStressScale(r);assert(max>=125);for(const y of r.years)if(Number.isFinite(y.value))assert(y.value<max);assert.equal(waterStressScale(r),waterStressScale({...r,years:r.years.slice().reverse()}));}
  assert.equal(waterStressScale(region('EGY')),200);assert.equal(waterStressScale(region('KWT')),5000);assert.equal(waterStressScale({years:[]}),125);
});
test('bar hit positions and keyboard limits cover each year, including chart margins',()=>{
  const g=WATER_STRESS_CHART;assert.equal(waterStressChartYear(-1),2000);assert.equal(waterStressChartYear(2),2022);
  for(let i=0;i<23;i++)assert.equal(waterStressChartYear((g.left+(i+.5)*(g.right-g.left)/23)/g.width),2000+i);
});
test('existing SOURCE analysis IDs keep high values and exclude missing years',()=>{
  const stats=atlasStatistics(d,data,region('KWT'));assert.equal(stats.id,'climate-waterstress-KWT');assert.deepEqual(stats.provenance,['SOURCE']);assert.equal(stats.rows.find(r=>r.year===2022).y,3850.5);
  const missing=atlasStatistics(d,data,region('ISR'));assert(!missing.rows.some(r=>r.year===2022));assert.equal(missing.missingCount,1);
});

test('map resource and withdrawal lengths retain exact ratios, including extremes, zero and missing',()=>{
  const before=JSON.stringify(data);
  for(const r of data.regions)for(const y of r.years){
    const p=stressBalance(r,y.year);assert.equal(p.max,waterStressScale(r));assert.equal(p.resource,100/p.max);assert.equal(p.value,y.value);
    if(y.value===null){assert.equal(p.withdrawal,null);assert.equal(p.multiple,null);}else{assert(p.withdrawal>=0&&p.withdrawal<1);assert(Math.abs(p.withdrawal/p.resource-y.value/100)<1e-12);}
  }
  assert.equal(stressBalance(region('KWT'),2022).multiple,38.505);assert.equal(stressBalance({years:[{year:2016,value:0}]},2016).withdrawal,0);assert.equal(JSON.stringify(data),before);
});
test('water stress history only joins adjacent recorded years and keeps isolated observations',()=>{
  const trace=waterStressHistory({years:[{year:2000,value:90},{year:2001,value:110},{year:2002,value:null},{year:2003,value:130},{year:2005,value:40}]});
  assert.equal(trace.points.length,4);assert.equal(trace.segments.length,1);assert.deepEqual(trace.segments[0],[{year:2000,value:90},{year:2001,value:110}]);
  for(const r of data.regions)for(const [a,b] of waterStressHistory(r).segments){assert.equal(b.year-a.year,1);assert.equal(a.value,r.years.find(y=>y.year===a.year).value);}
});
test('water stress entrance fades continuously and completes without size or value animation',()=>{
  for(let i=0;i<240;i++){let previous=0;for(let ms=0;ms<=STRESS_ARRIVAL_MS;ms+=20){const a=stressArrival(i,240,ms);assert(a>=previous&&a<=1);previous=a;}assert.equal(previous,1);}
  assert.equal(stressArrival(0,1,-1,true),0);assert.equal(stressArrival(239,240,0,true),1);
});
test('country source IDs preserve the same feature identity for South Sudan and Palestine',()=>{
  const geography=JSON.parse(fs.readFileSync('data/natural-earth-50m-countries.geojson'));
  for(const f of geography.features){const p=f.properties;if(/^[A-Z]{3}$/.test(p.ISO_A3))assert.equal(countrySourceId(p.ADM0_A3),p.ISO_A3);}
  assert.equal(countrySourceId('SDS'),region('SSD').id);assert.equal(countrySourceId('PSX'),region('PSE').id);
});
test('water comparisons avoid controls and keep real geographic anchors stable across years',()=>{
  const point={id:'EGY',name:'エジプト',x:160,y:421,labelWidth:40},obstacles=[{left:68,right:308,top:186,bottom:398},{left:0,right:320,top:446,bottom:568}];
  const marks=layoutStressMarks([point],{width:320,height:568,compact:true,selectedId:'EGY',obstacles});assert.equal(marks.length,1);assert.equal(marks[0].x,160);assert.equal(marks[0].y,421);
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;assert(!obstacles.some(b=>intersects(marks[0].bounds,b)));
  const candidates=Array.from({length:12},(_,i)=>({...point,id:String(i),x:150+i*100,y:400+i%2*190})),options={width:1440,height:900,compact:false,selectedId:'4',obstacles:[]};
  const a=layoutStressMarks(candidates,options),b=layoutStressMarks(candidates.map(p=>({...p,value:3850.5})),options);assert(a.length>3);assert.deepEqual(a.map(p=>[p.id,p.bounds]),b.map(p=>[p.id,p.bounds]));a.forEach((p,i)=>a.slice(i+1).forEach(q=>assert(!intersects(p.bounds,q.bounds))));
});
