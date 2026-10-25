import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {ATLAS_EXHIBITS as ALL_ATLAS,atlasColor,atlasInsight,atlasStatistics} from '../src/exploration/atlas-history-model.js';
import {CLIMATE_EXHIBITS} from '../src/exploration/climate-history-model.js';
import {placeAtlasGauge} from '../src/exploration/atlas-history-view.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const ATLAS_EXHIBITS=ALL_ATLAS.filter(d=>Number(d.number)<=80);
test('basin gauges keep a stable year-independent clearance below legends',()=>{
  const envelope={halfWidth:58,above:125,below:22},obstacles=[{left:1034,right:1344,top:212,bottom:438},{left:1109,right:1350,top:450,bottom:486}];
  const placed=placeAtlasGauge({x:1290,y:363},envelope,obstacles,669);
  assert(placed.y-envelope.above>=498);assert(placed.y+envelope.below<=657);
  assert.equal(placed.x,1290);
  assert.deepEqual(placeAtlasGauge({x:600,y:400},envelope,obstacles,669),{x:600,y:400});
});
test('75–80 are unique, actual datasets and shared provider registrations',()=>{
  assert.deepEqual(ATLAS_EXHIBITS.map(d=>+d.number),[75,76,77,78,79,80]);
  assert.equal(new Set(CLIMATE_EXHIBITS.map(d=>d.id)).size,ALL_ATLAS.length+3);
  for(const d of ATLAS_EXHIBITS){
    assert(fs.statSync(`data/atlas-history/${d.id}.json`).size<220000);
    const data=read(`data/atlas-history/${d.id}.json`);
    assert.equal(data.id,d.id);assert.equal(data.unit,d.unit);assert(data.regions.length>=3);
    assert(!/輪郭/.test(JSON.stringify(d)));
    assert.equal(new Set(data.regions.map(r=>r.id)).size,data.regions.length);
    for(const r of data.regions){
      assert.equal(r.years.length,d.end-d.start+1);
      assert.deepEqual(r.years.map(y=>y.year),Array.from({length:r.years.length},(_,i)=>i+d.start));
      for(const y of r.years){assert(y.value===null||Number.isFinite(y.value));if(d.view==='countries'&&y.value!==null)assert(y.value>=0&&y.value<=100);}
      const stats=atlasStatistics(d,data,r);assert.equal(stats.rows.length,r.years.filter(y=>y.value!==null).length);
      assert.equal(stats.missingCount,r.years.filter(y=>y.value===null).length);
      assert(stats.rows.every(y=>Number.isFinite(y.value)));
    }
    assert(!/NaN|undefined/.test(atlasInsight(d,data.regions[0],2016)));
    for(const v of [null,0,...d.range,-200,200])assert(!/NaN|undefined/.test(atlasColor(d,v)));
    assert.notEqual(atlasColor(d,null),atlasColor(d,0));
  }
});
test('country records exclude aggregates and exactly preserve source values or null',{skip:!fs.existsSync('artifacts/atlas-history-sources-20261022/countries.json')},()=>{
  const countries=read('artifacts/atlas-history-sources-20261022/countries.json')[1];
  for(const d of ATLAS_EXHIBITS.filter(d=>d.code)){
    const raw=read(`artifacts/atlas-history-sources-20261022/${d.id}.json`)[1],source=new Map(raw.map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
    for(const r of read(`data/atlas-history/${d.id}.json`).regions){
      assert.notEqual(countries.find(c=>c.id===r.id)?.region.id,'NA');
      for(const y of r.years){const v=source.get(`${r.id}/${y.year}`);assert.equal(y.value,Number.isFinite(v)?Math.round(v*10000)/10000:null);}
    }
  }
});
test('GRACE observed-month coverage and mission gap are explicit, not zero',{skip:!fs.existsSync('artifacts/atlas-history-sources-20261022/grace-amazon.json')},()=>{
  for(const r of read('data/atlas-history/waterstore.json').regions){
    assert(r.bounds[2]-r.bounds[0]>=10);assert(r.bounds[3]-r.bounds[1]>=10);
    assert.equal(r.years.find(y=>y.year===2018).value,null);
    const raw=read(`artifacts/atlas-history-sources-20261022/grace-${r.id}.json`).data.flat();
    for(const y of r.years){
      const months=new Map();for(const o of raw){const d=new Date(o.time*1000);if(d.getUTCFullYear()===y.year&&o.cnt>0&&Number.isFinite(o.mean)){const k=d.getUTCMonth();months.set(k,[...(months.get(k)||[]),o.mean]);}}
      assert.equal(y.months,months.size);assert.equal(y.value===null,y.months<9);
      if(y.value!==null){const means=[...months.values()].map(a=>a.reduce((s,v)=>s+v,0)/a.length);assert(Math.abs(y.value-means.reduce((s,v)=>s+v,0)/means.length)<.000051);}
    }
  }
});
test('NOAA annual reference and single-mission provenance retained',{skip:!ALL_ATLAS.some(d=>d.id==='sealevel')},()=>{
  for(const r of read('data/atlas-history/sealevel.json').regions){
    assert.equal(r.years[0].value,0);assert(r.years.at(-1).value>0);
    for(const y of r.years){assert(y.mission);assert.equal(y.value===null,y.months!==12);assert(y.samples>0);}
  }
});
test('raw source hashes match archived responses',{skip:!fs.existsSync('artifacts/atlas-history-sources-20261022/countries.json')},()=>{
  for(const s of read('data/atlas-history/sources.json').sources){const b=fs.readFileSync(`artifacts/atlas-history-sources-20261022/${s.file}`);assert.equal(createHash('sha256').update(b).digest('hex'),s.sha256);}
});
