import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {waterRgba} from '../src/exploration/water-storage-grid.js';
import {WATER_ARRIVAL_MS,waterFieldArrival,waterPoiState} from '../src/exploration/water-storage-poi.js';

test('Water POIs retain regional averages and the existing colour scale',()=>{
  const data=JSON.parse(fs.readFileSync('data/atlas-history/waterstore.json')),before=JSON.stringify(data);
  for(const region of data.regions)for(const row of region.years){
    const marker=waterPoiState(row.value,1000,0,false);
    assert.deepEqual(marker.rgb,waterRgba(row.value).slice(0,3));
    assert.equal(marker.valid,Number.isFinite(row.value));assert.equal(marker.radius,6);
    if(row.value===null)assert.equal(marker.text,'欠測');
    else assert(Math.abs(Number(marker.text.replace(' cm',''))-row.value)<=.050001);
  }
  assert.equal(JSON.stringify(data),before);
  assert.equal(waterPoiState(0,1000,0,false).text,'0 cm');
  assert.equal(waterPoiState(-.01,1000,0,false).text,'0 cm');
  assert.equal(waterPoiState(6.1491,1000,0,false).text,'+6.1 cm');
  assert.equal(waterPoiState(-16.2382,1000,0,false).text,'-16.2 cm');
});

test('The surface appears before the POIs; all four settle without pulsing',()=>{
  assert(waterFieldArrival(200,false)>0);assert.equal(waterPoiState(10,200,0,false).alpha,0);
  for(let index=0;index<4;index++){
    let previous=0;
    for(let time=0;time<=WATER_ARRIVAL_MS;time+=10){
      const state=waterPoiState(10,time,index,false);assert(state.alpha>=previous);previous=state.alpha;
    }
    assert.equal(waterPoiState(10,WATER_ARRIVAL_MS,index,false).alpha,1);
    assert.deepEqual(waterPoiState(10,WATER_ARRIVAL_MS,index,false),waterPoiState(10,60000,index,false));
    assert.equal(waterPoiState(null,0,index,true).alpha,1);
  }
  assert.equal(waterFieldArrival(0,true),1);
});
