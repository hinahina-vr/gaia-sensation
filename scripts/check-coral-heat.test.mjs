import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {coralGlyph,coralArrival,CORAL_ARRIVAL_MS} from '../src/exploration/coral-heat-view.js';
import {daysInYear,colorFor} from '../src/exploration/climate-history-model.js';
const data=JSON.parse(fs.readFileSync('data/climate-history/coral.json'));
test('214 source locations retain their DHW colours and exact calendar-day duration',()=>{
  for(const p of data.regions)for(const row of p.years){
    const copy=JSON.stringify(row),g=coralGlyph(row,row.year);
    assert.equal(g.color,colorFor('coral',row.max));assert.equal(g.duration,row.days8/daysInYear(row.year));
    assert(g.radius>=9&&g.radius<=29);assert.equal(JSON.stringify(row),copy);
  }
});
test('Heat strength is monotonic and bounded; zero differs from missing',()=>{
  const radii=[0,2,4,8,16,32].map(max=>coralGlyph({max},2016).radius);
  assert(radii.every((r,i)=>!i||r>=radii[i-1]));assert.equal(radii[4],radii[5]);
  assert.equal(coralGlyph({max:0},2016).missing,false);assert.equal(coralGlyph({max:null},2016).missing,true);
  assert.equal(coralGlyph(undefined,2016).missing,true);assert.equal(coralGlyph({max:8,days8:64},2016).duration,64/366);
});
test('A single monotonic arrival settles; reduced motion skips the animation',()=>{
  for(let i=0;i<214;i++){
    let previous=0;
    for(let t=0;t<=CORAL_ARRIVAL_MS;t+=50){const a=coralArrival(i,214,t);assert(a>=previous&&a<=1);previous=a;}
    assert.equal(coralArrival(i,214,CORAL_ARRIVAL_MS),1);assert.equal(coralArrival(i,214,86400000),1);
    assert.equal(coralArrival(i,214,-1,true),0);assert.equal(coralArrival(i,214,0,true),1);
  }
});
