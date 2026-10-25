import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeWaterGrid,waterCell,waterCellById,waterCellRegion,waterCellStatistics,waterRgba} from '../src/exploration/water-storage-grid.js';
import {atlasDefinition} from '../src/exploration/atlas-history-model.js';
const file='data/atlas-history/waterstore-grid.json',payload=JSON.parse(fs.readFileSync(file)),grid=decodeWaterGrid(payload);
test('global real grid has bounded size, stable cell IDs and explicit missing years',()=>{
  assert(fs.statSync(file).size<500000);assert.equal(grid.indices.length,720*360);assert.equal(grid.sources.length,132);
  assert.equal(grid.indices.filter(i=>i>=0).length,85912);
  for(const [lon,lat]of [[75,27],[-65,-5],[25,-25],[142.5,-33],[-100,42],[33,0]]){
    const c=waterCell(grid,lon,lat);assert(c);assert.deepEqual(waterCellById(grid,c.id),c);
    const r=waterCellRegion(grid,c);assert.equal(r.years.length,22);
    for(const year of [2015,2017,2018])assert.equal(r.years.find(r=>r.year===year).value,null);
    const d=waterCellStatistics(atlasDefinition('waterstore'),grid,c);assert.equal(d.rows.length,19);assert.equal(d.missingCount,3);assert(d.id.endsWith(c.id));
  }
  assert.equal(waterCell(grid,-140,0),null);assert.equal(waterCell(grid,0,91),null);assert.equal(waterCellById(grid,'cell-720-100'),null);
  assert.deepEqual(waterCell(grid,180,0),waterCell(grid,-180,0));assert.notDeepEqual(waterRgba(null),waterRgba(0));
});
test('every retained cell/year exactly matches rounded NASA annual grid; archived source hashes',{skip:!fs.existsSync('artifacts/water-storage-sources-20261022/2003--180.json.gz')},()=>{
  let checked=0;
  for(const s of payload.sources){
    const west=new URL(s.url).searchParams.get('minLon'),body=gunzipSync(fs.readFileSync(`artifacts/water-storage-sources-20261022/${s.year}-${west}.json.gz`));
    assert.equal(createHash('sha256').update(body).digest('hex'),s.sha256);
    const yi=grid.years.indexOf(s.year);
    for(const p of JSON.parse(body).data.flat()){
      if(!Number.isFinite(p.mean)||p.cnt<1)continue;
      const c=waterCell(grid,p.lon,p.lat);assert(c);
      assert.equal(grid.series[c.series][yi],s.observedMonths>=9&&p.cnt>=9?(Math.round(p.mean*1000)||0):null);checked++;
    }
  }
  assert.equal(checked,85912*22);
});
test('malformed encoding cannot expand past the bounded raster',()=>{
  assert.throws(()=>decodeWaterGrid({...payload,runs:[[0,720*360+1]]}));
  assert.throws(()=>decodeWaterGrid({...payload,runs:[[9000,1]]}));
  assert.throws(()=>decodeWaterGrid({...payload,runs:[]}));
});
