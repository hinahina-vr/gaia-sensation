import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ATLAS_EXHIBITS,atlasStatistics} from '../src/exploration/atlas-history-model.js';
import {centuryValue} from '../src/exploration/atlas-century-model.js';
import {heatRows,ozoneRows,composition} from './lib/atlas-century-source.mjs';
const defs=ATLAS_EXHIBITS.filter(d=>+d.number>=91),read=f=>JSON.parse(fs.readFileSync(f)),data=id=>read(`data/atlas-history/${id}.json`),raw='artifacts/atlas-century-sources-20261022';
const sourceTest=(name,fn)=>test(name,{skip:fs.existsSync(`${raw}/countries.json`)?false:'Raw build cache absent: run with the retained source archive for source-value verification'},fn);
test('91–100: complete identities, periods, lazy payloads and unique real measurements',()=>{
  assert.deepEqual(defs.map(d=>+d.number),Array.from({length:10},(_,i)=>91+i));
  for(const d of defs){const a=data(d.id);assert.equal(a.id,d.id);assert.equal(a.unit,d.unit);assert(a.regions.length);assert(fs.statSync(`data/atlas-history/${d.id}.json`).size<700000);assert(!/輪郭/.test(JSON.stringify(d)));
    assert.equal(new Set(a.regions.map(r=>r.id)).size,a.regions.length);
    for(const r of a.regions){assert.deepEqual(r.years.map(y=>y.year),Array.from({length:d.end-d.start+1},(_,i)=>d.start+i));for(const row of r.years)assert(row.value===null||Number.isFinite(row.value));const s=atlasStatistics(d,a,r);assert(s.rows.every(row=>Number.isFinite(row.value)));assert.equal(s.rows.length+s.missingCount,r.years.length);}
  }
});
sourceTest('source manifest hashes reproduce retained raw and extracted evidence',()=>{
  for(const s of data('century-sources').sources){const body=fs.readFileSync(`${raw}/${s.file}`);assert.equal(createHash('sha256').update(body).digest('hex'),s.sha256);assert.equal(body.length,s.bytes);assert(s.url.startsWith('https://'));if(s.file.startsWith('web-'))assert(s.retrieval.includes('Not a byte hash'));}
});
sourceTest('heat: all basin years, two depths, uncertainty and signed differences match NOAA',()=>{
  for(const [id,c]of[['pacific','p'],['atlantic','a'],['indian','i']]){
    const upper=heatRows(fs.readFileSync(`${raw}/web-h22-${c}0-700m.dat`,'utf8')),total=heatRows(fs.readFileSync(`${raw}/web-h22-${c}0-2000m.dat`,'utf8'));
    for(const row of data('oceanheat').regions.find(r=>r.id===id).years){const u=upper.find(r=>r.year===row.year),t=total.find(r=>r.year===row.year);assert.equal(row.value,t.value);assert.equal(row.se,t.se);assert.equal(row.upper,u.value);assert(Math.abs(row.deep-(t.value-u.value))<.0001);}
  }
  assert.throws(()=>heatRows('YEAR\n2016.5 0 0'));
});
sourceTest('ozone is seasonal mean, not daily maximum; 1995 remains missing',()=>{
  const a=data('ozone').regions[0];assert.equal(a.years.find(r=>r.year===2016).value,20.7);assert.equal(a.years.find(r=>r.year===1995).value,null);
  const values=ozoneRows(fs.readFileSync(`${raw}/ozone-annual.html`,'utf8'));for(const r of a.years)assert.equal(r.value,values.find(y=>y.year===r.year)?.value??null);
});
test('WGMS water-equivalent units and reference baseline are preserved',()=>{
  const a=data('glaciers').regions[0];assert.equal(a.years[0].value,0);assert.deepEqual(a.years.find(r=>r.year===2016),{year:2016,value:-19.592,annual:-.987,count:60});assert(a.aggregate);
});
sourceTest('catalogues retain incomplete measurements and count unlocated confirmed events',()=>{
  for(const [id,expected]of[['volcanoes',225],['tsunamis',482]]){const a=data(id);assert.equal(a.events.length,expected);assert.equal(a.regions[0].years.reduce((n,r)=>n+r.value,0),expected);assert(a.events.some(e=>e.magnitude===null));
    const original=[...read(`${raw}/${id==='volcanoes'?'volcano':'tsunami'}-1.json`).items,...read(`${raw}/${id==='volcanoes'?'volcano':'tsunami'}-2.json`).items,...(id==='tsunamis'?read(`${raw}/tsunami-3.json`).items:[])];
    for(const e of a.events){const r=original.find(r=>String(r.id)===e.id);assert(r);assert.equal(e.lon,r.longitude??null);assert.equal(e.lat,r.latitude??null);assert.equal(e.magnitude,(id==='volcanoes'?r.vei:r.maxWaterHeight)??null);assert(id==='volcanoes'?r.eruption===true:r.eventValidity===4);}
  }
  const tsunami=data('tsunamis');assert.equal(tsunami.events.find(e=>e.id==='5413').magnitude,39.26);assert.equal(tsunami.events.filter(e=>e.lon===null||e.lat===null).length,28);
});
test('water shares never normalize invalid source values; censoring never becomes exact statistics',()=>{
  assert.deepEqual(composition(50,20,30),{agriculture:50,industry:20,domestic:30,value:50});assert.equal(composition(500,20,30).invalidComposition,true);assert.equal(composition(null,20,30).value,null);
  const def=defs.find(d=>d.id==='hunger'),a=data('hunger'),jp=a.regions.find(r=>r.id==='JPN'),row=jp.years.find(r=>r.year===2016);assert(row.censored);assert.equal(centuryValue(def,row,String),'2.5%以下');assert(!atlasStatistics(def,a,jp).rows.some(r=>r.year===2016));
});
sourceTest('all national values match source rows and exclude regional aggregates',()=>{
  const get=(file)=>new Map(read(`${raw}/${file}.json`)[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
  const round=v=>Number.isFinite(v)?Math.round(v*1e4)/1e4:null;
  const maps=Object.fromEntries(['hunger','internet','refugees-unhcr','capture','aquaculture','withdraw-agriculture','withdraw-industry','withdraw-domestic'].map(k=>[k,get(k)]));
  for(const d of defs.filter(d=>d.view==='countries'))for(const r of data(d.id).regions)for(const row of r.years){const key=`${r.id}/${row.year}`,v=name=>round(maps[name].get(key));
    if(d.id==='wateruse')assert.deepEqual(row,{year:row.year,...composition(v('withdraw-agriculture'),v('withdraw-industry'),v('withdraw-domestic'))});
    else if(d.id==='fisheries'){const a=v('capture'),b=v('aquaculture');assert.equal(row.value,a===null||b===null?null:round((a+b)/1e4));}
    else assert.equal(row.value,v(d.id==='refugees'?'refugees-unhcr':d.id));
  }
});
