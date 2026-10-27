import {readSourceSnapshot} from './lib/read-source-snapshot.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sanitationRow,sanitationData,sanitationStatistics} from '../src/exploration/sanitation-services.js';
import {atlasDefinition,atlasStatistics} from '../src/exploration/atlas-history-model.js';
import {sanitationSegments,sanitationBands,sanitationArrival,SANITATION_ARRIVAL_MS,layoutSanitationMarks,sanitationOverlap} from '../src/exploration/sanitation-composition.js';
const data=JSON.parse(readSourceSnapshot('data/atlas-history/sanitation.json')),services=JSON.parse(readSourceSnapshot('data/atlas-history/sanitation-services.json')),d=atlasDefinition('sanitation');
test('same-release official rows and hashes, including missing observations',()=>{
  assert.equal(services.sourceUpdated,data.sourceUpdated);assert.equal(services.regions.length,146);
  for(const s of services.sources)assert.equal(createHash('sha256').update(readSourceSnapshot(`artifacts/sanitation-sources-20261023/${s.file}`)).digest('hex'),s.sha256);
  for(const key of ['basic','open']){
    const raw=JSON.parse(readSourceSnapshot(`artifacts/sanitation-sources-20261023/${key}.json`));assert.equal(raw[0].lastupdated,data.sourceUpdated);
    const rows=new Map(raw[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
    for(const r of services.regions)for(const y of r.years){const v=rows.get(`${r.id}/${y.year}`);assert.equal(y[key],Number.isFinite(v)?Math.round(v*10000)/10000:null);}
  }
});
test('exclusive components total 100%, with BASS inclusive of safely managed',()=>{
  const original=JSON.stringify(data),r=data.regions.find(r=>r.id==='IND');
  assert.deepEqual(sanitationRow(r,services,2016),{safe:44.8599,basic:15.2639,limited:12.0502,open:27.826,complete:true});
  for(const region of data.regions)for(const y of region.years){const row=sanitationRow(region,services,y.year);if(row.complete)assert(Math.abs(row.safe+row.basic+row.limited+row.open-100)<.0003);}
  assert.equal(sanitationData(data,services,'safe'),data);assert.equal(sanitationData(data,services,'basic'),sanitationData(data,services,'basic'));assert.equal(JSON.stringify(data),original);
});
test('incomplete and inconsistent components never become zero or a full stack',()=>{
  const check=(safe,basic,open)=>sanitationRow({id:'X',years:[{year:2016,value:safe}]},{regions:[{id:'X',years:[{year:2016,basic,open}]}]},2016);
  assert.deepEqual(check(null,60,10),{safe:null,basic:null,limited:30,open:10,complete:false});
  assert.deepEqual(check(40,null,0),{safe:40,basic:null,limited:null,open:0,complete:false});
  assert.equal(check(80,60,10).basic,null);assert.equal(check(40,60,50).limited,null);assert.equal(check(-1,60,10).safe,null);
  assert(check(60.0001,60,10).complete);assert(!sanitationRow(null,services,2016).complete);
});
test('source and derived statistics retain provenance and distinct restorable IDs',()=>{
  const region=data.regions.find(r=>r.id==='IND');assert.deepEqual(sanitationStatistics(d,data,services,region,'safe'),atlasStatistics(d,data,region));
  for(const [mode,value,provenance] of [['basic',15.2639,'DERIVED'],['limited',12.0502,'DERIVED'],['open',27.826,'SOURCE']]){const s=sanitationStatistics(d,data,services,region,mode);assert.equal(s.id,`climate-sanitation-IND-${mode}`);assert.equal(s.rows.length,25);assert.equal(s.rows.find(r=>r.year===2016).y,value);assert.deepEqual(s.provenance,[provenance]);}
});
test('composition angles preserve the four exclusive shares, including zeros and missingness',()=>{
  for(const region of data.regions)for(const y of region.years){
    const row=sanitationRow(region,services,y.year),segments=sanitationSegments(row);
    if(!row.complete){assert.deepEqual(segments,[]);continue;}
    assert.equal(segments.length,4);assert.equal(segments[0].start,0);assert(Math.abs(segments.at(-1).end-1)<.000003);
    for(const s of segments)assert(Math.abs((s.end-s.start)*100-row[s.key])<1e-10);
  }
  assert.deepEqual(sanitationSegments({complete:true,safe:100,basic:0,limited:0,open:2}),[]);
  const zero=sanitationSegments({complete:true,safe:100,basic:0,limited:0,open:0});assert.equal(zero[1].start,zero[1].end);
});
test('history bands connect adjacent complete observations only, with exact endpoints',()=>{
  const row={complete:true,safe:40,basic:30,limited:20,open:10};
  const rows=[{year:2000,...row},{year:2001,...row,safe:50,basic:20},{year:2002,...row,complete:false},{year:2003,...row},{year:2005,...row}];
  const bands=sanitationBands(rows);assert.equal(bands.length,4);assert(bands.every(b=>b.from===2000&&b.to===2001));
  assert.deepEqual(bands[0].points,[[2000,0],[2001,0],[2001,.5],[2000,.4]]);
});
test('country reveal finishes continuously within 1100ms and respects reduced motion',()=>{
  for(let i=0;i<240;i++){let prev=0;for(let ms=0;ms<=1100;ms+=25){const a=sanitationArrival(i,240,ms);assert(a>=prev&&a<=1);prev=a;}assert.equal(sanitationArrival(i,240,SANITATION_ARRIVAL_MS),1);}
  assert.equal(sanitationArrival(239,240,0,true),1);assert.equal(sanitationArrival(0,1,-1,true),0);
});
test('composition readings avoid UI and keep geographical anchors and year-stable positions',()=>{
  const candidate={id:'IND',name:'インド',x:164,y:425,parts:{complete:true,safe:45,basic:15,limited:12,open:28}};
  const obstacles=[{left:68,right:310,top:186,bottom:404.7},{left:0,right:320,top:446.7,bottom:492},{left:0,right:320,top:498,bottom:568}];
  const marks=layoutSanitationMarks([candidate],{width:320,height:568,compact:true,selectedId:'IND',obstacles});assert.equal(marks.length,1);assert.equal(marks[0].x,candidate.x);assert.equal(marks[0].y,candidate.y);for(const b of obstacles)assert(!sanitationOverlap(marks[0].bounds,b,2));
  const candidates=Array.from({length:10},(_,i)=>({...candidate,id:String(i),x:160+i*100,y:400+i%2*160,labelWidth:30})),options={width:1440,height:900,compact:false,selectedId:'3',obstacles:[{left:1094,right:1430,top:150,bottom:700}]};
  const a=layoutSanitationMarks(candidates,options),b=layoutSanitationMarks(candidates.map(p=>({...p,parts:{...p.parts,safe:50,open:23}})),options);assert(a.length>3);assert.deepEqual(a.map(p=>[p.id,p.bounds]),b.map(p=>[p.id,p.bounds]));
  a.forEach((p,i)=>{for(const o of options.obstacles)assert(!sanitationOverlap(p.bounds,o,2));for(const q of a.slice(i+1))assert(!sanitationOverlap(p.bounds,q.bounds));});
});
