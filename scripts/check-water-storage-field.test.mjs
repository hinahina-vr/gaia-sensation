import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {smoothWaterField,waterDisplayField} from '../src/exploration/water-storage-field.js';
import {decodeWaterGrid,waterCell} from '../src/exploration/water-storage-grid.js';

test('softening preserves constant fields, valid zero, missing cells and ocean',()=>{
  const values=new Float32Array(40*20).fill(12);values[0]=99999;values[1]=88888;
  const before=values.slice(),field=smoothWaterField(values,40,20);assert.deepEqual(values,before);
  assert.equal(field[0],99999);assert.equal(field[1],88888);for(let i=2;i<field.length;i++)assert(Math.abs(field[i]-12)<1e-5);
  assert(smoothWaterField(new Float32Array(40*20),40,20).every(v=>v===0));
});
test('a hard colour boundary becomes a monotonic transition and wraps at the meridian',()=>{
  const values=Float32Array.from({length:40*20},(_,i)=>i%40<20?-30:30),field=smoothWaterField(values,40,20);
  const row=Array.from(field.slice(10*40,11*40));for(let x=13;x<26;x++)assert(row[x]<row[x+1]);
  assert(row[19]<0&&row[20]>0);assert(row.every(v=>v>=-30&&v<=30));
  for(let x=0;x<20;x++)assert(Math.abs(row[x]+row[39-x])<1e-5,'The 180° boundary must stay periodic');
});
test('real NASA grid keeps the exact sampling mask and leaves selected source values intact',()=>{
  const payload=JSON.parse(fs.readFileSync('data/atlas-history/waterstore-grid.json')),before=JSON.stringify(payload),grid=decodeWaterGrid(payload),field=waterDisplayField(grid,2016),missing=waterDisplayField(grid,2018);
  let changed=0;for(let i=0;i<field.length;i++){
    const id=grid.indices[i];if(id<0){assert.equal(field[i],99999);assert.equal(missing[i],99999);}else{assert(Number.isFinite(field[i])&&Math.abs(field[i])<80000);assert.equal(missing[i],88888);if(Math.abs(field[i]-grid.series[id][13]*grid.scale)>.1)changed++;}
  }
  assert(changed>10000);const c=waterCell(grid,82.25,22.25);assert.equal(grid.series[c.series][13],payload.series[c.series][13]);assert.equal(JSON.stringify(payload),before);
});
