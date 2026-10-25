import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {lakeInsight,lakeStatistics} from '../src/exploration/surface-water-model.js';
import {CLIMATE_EXHIBITS} from '../src/exploration/climate-history-model.js';
import {lakeRasterRect,lakeCellAt,lakeFitCamera,lakeClass} from '../src/exploration/surface-water-spatial.js';
import {earthLongitudeToMapX,earthBaseScale} from '../src/exploration/world-projection.js';
const data=JSON.parse(fs.readFileSync('data/surface-water/lakes.json','utf8'));

test('Lake raster bounds and sampled cells share the map camera, including negative coordinates',()=>{
  assert.deepEqual([27,12,138,63].map(lakeClass),[0,1,2,3]);
  for(const r of data.regions){
    const [west,south,east,north]=r.bounds,view={x:-900,y:-500,scale:400};
    const rect=lakeRasterRect(r.bounds,view);
    assert.equal(rect.x,view.x+earthLongitudeToMapX(west)*view.scale);
    assert.equal(rect.y,view.y+(90-north)*view.scale);
    assert(Math.abs(rect.width/rect.height-(east-west)/(north-south))<1e-10);
    assert.deepEqual(lakeCellAt(r.bounds,480,800,west,north),{x:0,y:0});
    assert.deepEqual(lakeCellAt(r.bounds,480,800,east,south),{x:479,y:799});
    assert.equal(lakeCellAt(r.bounds,480,800,east+.01,south),null);
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
      const area={x:30,y:310,width:viewport.width-70,height:210},camera=lakeFitCamera(r.bounds,viewport,area),scale=camera.zoom*earthBaseScale(viewport);
      assert(camera.zoom>8&&camera.zoom<=512);
      assert((east-west)*scale<=area.width&&(north-south)*scale<=area.height);
      assert.equal(camera.targetY,(area.y+area.height/2)/viewport.height);
    }
  }
});
test('74 is a distinct, source-backed surface-water exhibit',()=>{
  assert.equal(CLIMATE_EXHIBITS.find(d=>d.id==='lakes').number,'74');
  assert.equal(CLIMATE_EXHIBITS.find(d=>d.number==='74').id,'lakes');
  assert.deepEqual(data.period,[1984,2015]);assert.equal(data.regions.length,3);
  assert.equal(data.attribution,'Source: EC JRC/Google');
  assert.match(data.method,/original 0\.00025/);assert.match(data.limits,/not the latest/);
  const sandbox={document:{querySelector:()=>null,addEventListener(){}},matchMedia:()=>({matches:true,addEventListener(){}})};
  vm.runInNewContext(fs.readFileSync('map-exhibit-categories.js','utf8'),sandbox);
  const categories=JSON.parse(JSON.stringify(sandbox.GaiaMapCategories.definitions));
  assert.deepEqual(categories.flatMap(c=>c.numbers).sort((a,b)=>a-b),Array.from({length:sandbox.GaiaMapCategories.exhibitCount},(_,i)=>i+1));
  assert.equal(sandbox.GaiaMapCategories.get(74).id,'water');
});
test('Every annual raster has its hash, period, finite areas and explicit missing coverage',()=>{
  for(const region of data.regions){
    assert.equal(region.years.length,32);assert.equal(region.referenceYear,2000);
    assert(region.footprintArea>0);
    for(const [i,row] of region.years.entries()){
      assert.equal(row.year,1984+i);
      assert(row.permanent>=0&&row.seasonal>=0&&row.water>=0);
      assert(Math.abs(row.permanent+row.seasonal-row.water)<1e-7);
      assert(row.coverage>=0&&row.coverage<=100.000001);
      assert(row.commonCoverage<=row.coverage+1e-6);
      if(row.commonCoverage<95||row.referenceCommonWater<=0)assert.equal(row.changePercent,null);
      else assert(Math.abs(row.changePercent-(row.commonWater/row.referenceCommonWater-1)*100)<1e-8);
      assert.match(row.sourceUrl,/YearlyClassification\/VER1-0\//);
      const png=fs.readFileSync(`data/surface-water/${row.image}`);
      assert.equal(createHash('sha256').update(png).digest('hex'),row.imageSha256);
      assert.equal(png.length,row.imageBytes);assert(png.length<200000);
      assert.match(row.windowSha256,/^[a-f0-9]{64}$/);
    }
  }
});
test('Incomplete years are retained visually but excluded from statistical trends',()=>{
  for(const region of data.regions){
    const d=lakeStatistics(region),complete=region.years.filter(r=>r.coverage>=95);
    assert.equal(d.rows.length,complete.length);assert.equal(d.missingCount,32-complete.length);
    assert(d.rows.length>=10);assert.deepEqual(d.rows.map(r=>r.value),complete.map(r=>r.water));
    assert.equal(d.unit,'km²');assert.match(d.comparisonNote,/95%/);
    for(const row of region.years)assert(lakeInsight(region,row).includes(`${row.year}年`));
  }
  const missing={year:2001,water:0,permanent:0,seasonal:0,coverage:0,changePercent:null};
  assert(!lakeInsight({},missing).includes('100%減少'));
});
