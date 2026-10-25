import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {ATLAS_EXHIBITS,atlasRow,atlasStatistics,atlasInsight} from '../src/exploration/atlas-history-model.js';
import {iceRecords,snowRecords,monthlyYears} from './lib/atlas-expansion-source.mjs';
const definitions=ATLAS_EXHIBITS.filter(d=>+d.number>=81&&+d.number<=90),read=p=>JSON.parse(fs.readFileSync(p)),raw='artifacts/atlas-expansion-sources-20261022';
test('81–90 have distinct measurements, complete periods and bounded lazy snapshots',()=>{
  assert.deepEqual(definitions.map(d=>+d.number),Array.from({length:10},(_,i)=>81+i));
  for(const d of definitions){
    const file=`data/atlas-history/${d.id}.json`,data=read(file);assert(fs.statSync(file).size<250000);assert.equal(data.id,d.id);assert.equal(data.unit,d.unit);assert(!/輪郭/.test(JSON.stringify(d)));
    assert.equal(new Set(data.regions.map(r=>r.id)).size,data.regions.length);
    for(const r of data.regions){
      assert.equal(r.years.length,d.end-d.start+1);assert.deepEqual(r.years.map(y=>y.year),Array.from({length:r.years.length},(_,i)=>i+d.start));
      for(const y of r.years){const values=d.monthly?y.monthValues:[y.value];if(d.monthly)assert.equal(values.length,12);for(const v of values)assert(v===null||Number.isFinite(v)&&v>=0);}
      for(const m of d.monthly?[1,3,9,12]:[undefined]){
        const stats=atlasStatistics(d,data,r,m);assert.equal(stats.rows.length,r.years.filter(y=>Number.isFinite(atlasRow(r,y.year,m)?.value)).length);assert.equal(stats.missingCount,r.years.length-stats.rows.length);
        assert(!/NaN|undefined/.test(atlasInsight(d,r,2016,m)));if(d.monthly){assert(stats.id.endsWith(`-m${String(m).padStart(2,'0')}`));assert(stats.comparisonNote.includes(`${m}月`));}
      }
    }
  }
});
test('NSIDC quoted comma, negative sentinel, missing months and zero are distinct',()=>{
  const rows=iceRecords('year, mo, source_dataset, region, extent, area\n2024,05,"NSIDC-0051,NSIDC-0081",S,9.36,7.15\n1987,12,x,N,-9999,-9999\n2000,01,x,N,0,0');
  assert.equal(rows[0].value,9.36);assert.equal(rows[1].value,null);assert.equal(rows[2].value,0);
  assert.equal(monthlyYears(rows,2024,2024)[0].monthValues[4],9.36);assert.equal(monthlyYears(rows,2024,2024)[0].monthValues[0],null);
  assert.throws(()=>monthlyYears([...rows,rows[0]],2024,2024),/Duplicate/);
  const data=read('data/atlas-history/seaice.json');
  assert.equal(atlasRow(data.regions[0],2016,9).value,4.53);assert.equal(atlasRow(data.regions[1],2016,9).value,18.15);
  assert.equal(atlasRow(data.regions[1],2024,5).value,9.36);
  for(const r of data.regions){assert.equal(atlasRow(r,1987,12).value,null);assert.equal(atlasRow(r,1988,1).value,null);}
  const d=definitions.find(d=>d.id==='seaice');assert.equal(atlasStatistics(d,data,data.regions[0],13),null);
});
test('Rutgers conversion and overlapping region definitions stay explicit',()=>{
  assert.equal(snowRecords('2016 03 37164511')[0].value,37.164511);
  const data=read('data/atlas-history/snowcover.json');assert.equal(atlasRow(data.regions.find(r=>r.id==='nhland'),2016,3).value,37.164511);assert(data.regions.find(r=>r.id==='nam').name.includes('除外'));assert(data.method.includes('合算しない'));
});
test('all final national values equal actual raw source, with aggregates excluded',{skip:!fs.existsSync(`${raw}/countries.json`)},()=>{
  const countries=read(`${raw}/countries.json`)[1];
  for(const d of definitions.filter(d=>d.code)){
    const values=new Map(read(`${raw}/${d.id}.json`)[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
    for(const r of read(`data/atlas-history/${d.id}.json`).regions){assert.notEqual(countries.find(c=>c.id===r.id)?.region.id,'NA');for(const y of r.years){const v=values.get(`${r.id}/${y.year}`);assert.equal(y.value,Number.isFinite(v)?Math.round(v*10000)/10000:null);}}
  }
});
test('every monthly value matches official raw series, with source hashes',{skip:!fs.existsSync(`${raw}/countries.json`)},()=>{
  for(const s of read('data/atlas-history/expansion-sources.json').sources){const b=fs.readFileSync(`${raw}/${s.file}`);assert.equal(createHash('sha256').update(b).digest('hex'),s.sha256);}
  for(const r of read('data/atlas-history/seaice.json').regions)for(let month=1;month<=12;month++){
    const values=iceRecords(fs.readFileSync(`${raw}/${r.id==='north'?'N':'S'}_${String(month).padStart(2,'0')}_extent_v4.0.csv`,'utf8'));
    for(const y of r.years)assert.equal(y.monthValues[month-1],values.find(v=>v.year===y.year&&v.month===month)?.value??null);
  }
  for(const r of read('data/atlas-history/snowcover.json').regions){const values=snowRecords(fs.readFileSync(`${raw}/moncov.${r.id}.txt`,'utf8'));for(const y of r.years)for(let m=1;m<=12;m++)assert.equal(y.monthValues[m-1],values.find(v=>v.year===y.year&&v.month===m)?.value??null);}
});
