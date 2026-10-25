import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {drinkingRow,drinkingData,drinkingStatistics,drinkingGapLabel} from '../src/exploration/drinking-water.js';
import {atlasDefinition,atlasStatistics} from '../src/exploration/atlas-history-model.js';
import {drinkingRateY,drinkingArrival,DRINKING_ARRIVAL_MS,drinkingValue,layoutDrinkingReadings,drinkingOverlap} from '../src/exploration/drinking-water-reading.js';
const data=JSON.parse(fs.readFileSync('data/atlas-history/drinking.json')),comparison=JSON.parse(fs.readFileSync('data/atlas-history/drinking-comparison.json')),d=atlasDefinition('drinking');
test('same-release urban/rural values preserve every official row and missing value',()=>{
  assert.equal(comparison.sourceUpdated,data.sourceUpdated);assert.equal(comparison.regions.length,151);
  for(const source of comparison.sources)assert.equal(createHash('sha256').update(fs.readFileSync(`artifacts/drinking-water-sources-20261023/${source.file}`)).digest('hex'),source.sha256);
  for(const key of ['urban','rural']){
    const raw=JSON.parse(fs.readFileSync(`artifacts/drinking-water-sources-20261023/${key}.json`));assert.equal(raw[0].lastupdated,data.sourceUpdated);
    const rows=new Map(raw[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
    for(const r of comparison.regions)for(const y of r.years){const v=rows.get(`${r.id}/${y.year}`);assert.equal(y[key],Number.isFinite(v)?Math.round(v*10000)/10000:null);}
  }
});
test('signed differences preserve direction, missing pairs and original national data',()=>{
  const original=JSON.stringify(data),gap=drinkingData(data,comparison,'gap');
  assert.equal(drinkingData(data,comparison,'national'),data);assert.equal(drinkingData(data,comparison,'gap'),gap);
  for(const r of gap.regions)for(const y of r.years){const pair=drinkingRow(comparison,r.id,y.year);assert.equal(y.value,pair.gap);if(pair.urban===null||pair.rural===null)assert.equal(y.value,null);}
  assert.equal(drinkingRow(comparison,'IND',2016).gap,22.1213);assert.equal(drinkingRow(comparison,'BGD',2016).gap,-13.184);
  assert.equal(drinkingGapLabel(-13.184),'農村が 13.2 pt 高い');assert.equal(JSON.stringify(data),original);
});
test('source statistics retain IDs, while urban-rural differences are derived',()=>{
  const r=data.regions.find(r=>r.id==='IND');assert.deepEqual(drinkingStatistics(d,data,comparison,r,'national'),atlasStatistics(d,data,r));
  const stats=drinkingStatistics(d,data,comparison,r,'gap');assert.equal(stats.id,'climate-drinking-IND-gap');assert.equal(stats.unit,'ポイント');assert.equal(stats.rows.length,25);assert.equal(stats.rows.find(r=>r.year===2016).y,22.1213);assert.deepEqual(stats.provenance,['DERIVED']);
});
test('unknown and missing rows are neither zero nor invented national totals',()=>{
  assert.deepEqual(drinkingRow(comparison,'UNKNOWN',2016),{urban:null,rural:null,gap:null});
  const missing=comparison.regions.flatMap(r=>r.years).filter(y=>y.urban===null||y.rural===null);assert(missing.length>0);
  const national=data.regions.find(r=>r.id==='IND').years.find(y=>y.year===2016).value,pair=drinkingRow(comparison,'IND',2016);assert.notEqual(national,(pair.urban+pair.rural)/2);
});
test('rate plot uses the same 0–100% scale and preserves missing values',()=>{
  assert.equal(drinkingRateY(100),12);assert.equal(drinkingRateY(0),122);assert.equal(drinkingRateY(50),67);assert.equal(drinkingRateY(null),null);
  const r=drinkingRow(comparison,'IND',2016);assert(Math.abs((drinkingRateY(r.rural)-drinkingRateY(r.urban))/1.1-r.gap)<1e-8);
  assert.equal(drinkingValue(-13.184),'−13.2 pt');assert.equal(drinkingValue(null),'欠測');assert.equal(drinkingValue(77.6777,false),'77.7%');
});
test('arrival is monotonic, complete at 1 second, and reduced motion is immediate',()=>{
  for(let index=0;index<240;index++){let previous=0;for(let elapsed=0;elapsed<=1000;elapsed+=25){const a=drinkingArrival(index,240,elapsed);assert(a>=previous&&a<=1);previous=a;}assert.equal(drinkingArrival(index,240,DRINKING_ARRIVAL_MS),1);}
  assert.equal(drinkingArrival(0,1,-1,true),0);assert.equal(drinkingArrival(239,240,0,true),1);
});
test('compact reading fits between the legend and drawer without moving the geographic anchor',()=>{
  const candidate={id:'IND',name:'インド',x:164,y:425,value:22.1213,urban:77.6777,rural:55.5564};
  const obstacles=[{left:68,right:310,top:186,bottom:403},{left:0,right:320,top:447,bottom:568}];
  const marks=layoutDrinkingReadings([candidate],{width:320,height:568,compact:true,selectedId:'IND',obstacles});
  assert.equal(marks.length,1);assert.equal(marks[0].x,candidate.x);assert.equal(marks[0].y,candidate.y);
  for(const b of obstacles)assert(!drinkingOverlap(marks[0].bounds,b,2));assert.equal(marks[0].bounds.bottom-marks[0].bounds.top,34);
});
test('desktop layout does not reorder countries when values change or overlap UI',()=>{
  const candidates=Array.from({length:10},(_,i)=>({id:String(i),name:'国',x:160+i*100,y:400+(i%2)*160,value:i*2,labelWidth:20}));
  const options={width:1440,height:900,compact:false,selectedId:'3',obstacles:[{left:1094,right:1430,top:152,bottom:700}]};
  const a=layoutDrinkingReadings(candidates,options),b=layoutDrinkingReadings(candidates.map(p=>({...p,value:100-p.value})),options);
  assert(a.find(p=>p.selected));assert(a.length>2);assert.deepEqual(a.map(p=>[p.id,p.bounds]),b.map(p=>[p.id,p.bounds]));
  a.forEach((p,i)=>{for(const o of options.obstacles)assert(!drinkingOverlap(p.bounds,o,2));for(const q of a.slice(i+1))assert(!drinkingOverlap(p.bounds,q.bounds));});
});
