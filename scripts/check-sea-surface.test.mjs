import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {seaSurfaceColor,seaSurfaceWeights,buildSeaCoastStencil,buildSeaSurfaceTexture,seaSwellLight,paintSeaSurfaceCPU} from '../src/exploration/sea-surface-model.js';
import {tideRgb,tideColor,decodeTides} from '../src/exploration/sea-level-stations.js';
const source=JSON.parse(fs.readFileSync(new URL('../data/atlas-history/sealevel.json',import.meta.url)));
test('Ocean weights are finite, normalized, and continuous around the longitude seam',()=>{
  for(let lon=-180;lon<=180;lon+=5)for(let lat=-60;lat<=60;lat+=20){const w=seaSurfaceWeights(lon,lat);assert(w.every(v=>v>=0&&v<=1));assert(Math.abs(w.reduce((a,b)=>a+b)-1)<1e-12);}
  assert.deepEqual(seaSurfaceWeights(-180,0),seaSurfaceWeights(180,0));
});
test('Without coastal samples the surface retains the three satellite source means',()=>{
  const field=buildSeaSurfaceTexture(source.regions,2016,36,18);
  assert.deepEqual(field.values,['pac','atl','ind'].map(id=>source.regions.find(r=>r.id===id).years.find(r=>r.year===2016).value));
  assert.notDeepEqual(field.pixels,buildSeaSurfaceTexture(source.regions,1993,36,18).pixels);
  assert.notDeepEqual(field.pixels,buildSeaSurfaceTexture(source.regions,2024,36,18).pixels);
  assert.equal(seaSurfaceColor(null),null);assert.deepEqual(seaSurfaceColor(1000),seaSurfaceColor(300));
});

test('Water and POIs share the same signed colour scale, including genuine zero',()=>{
  for(const value of [-900,-300,-100,0,100,300,900]){
    assert.deepEqual(seaSurfaceColor(value),tideRgb(value));
    assert.equal('rgb('+seaSurfaceColor(value).join(',')+')',tideColor(value));
  }
});

const basins=['pac','atl','ind'].map(id=>({id,years:[{year:2016,value:0},{year:2024,value:0}]}));
test('Coastal POI values drive the local water and year changes, with offshore satellite fallback',()=>{
  const stations=[{lon:.5,lat:-.5,years:[{year:2016,value:420},{year:2024,value:-360}]}];
  const plan=buildSeaCoastStencil(stations),a=buildSeaSurfaceTexture(basins,2016,360,180,stations,plan),b=buildSeaSurfaceTexture(basins,2024,360,180,stations,plan);
  const near=90*360+30,offshore=90*360+110;
  assert.equal(a.surfaceValues[near],420);assert.equal(b.surfaceValues[near],-360);
  assert.deepEqual([...a.pixels.slice(near*4,near*4+3)],tideRgb(420));
  assert.deepEqual([...b.pixels.slice(near*4,near*4+3)],tideRgb(-360));
  assert.equal(a.surfaceValues[offshore],0);assert.equal(b.surfaceValues[offshore],0);
  assert.equal(a.coastalSamples,1);assert.equal(stations[0].years[0].value,420);
});

test('Missing coastal records are excluded and a valid zero remains a coastal value',()=>{
  const stations=[{lon:.5,lat:-.5,years:[{year:2016,value:null},{year:2024,value:0}]}],plan=buildSeaCoastStencil(stations);
  const a=buildSeaSurfaceTexture(basins,2016,360,180,stations,plan),b=buildSeaSurfaceTexture(basins,2024,360,180,stations,plan);
  assert.equal(a.coastalSamples,0);assert.equal(b.coastalSamples,1);assert.equal(b.surfaceValues[90*360+30],0);
  assert(buildSeaSurfaceTexture([],1900,360,180,stations,plan).pixels.every(v=>v===0));
});

test('The coastal plan wraps across the texture seam and does not mutate observations',()=>{
  const stations=[{lon:-30,lat:0,years:[{year:2016,value:180}]}],before=structuredClone(stations),plan=buildSeaCoastStencil(stations),field=buildSeaSurfaceTexture(basins,2016,360,180,stations,plan);
  const a=89*360,b=a+359;assert(Math.abs(field.surfaceValues[a]-180)<.01);assert.equal(field.surfaceValues[a],field.surfaceValues[b]);assert.deepEqual(stations,before);
  assert.throws(()=>buildSeaSurfaceTexture(basins,2016,72,36,stations,plan),/does not match/);
});

test('Real coastal data add geographic colour variation without rebuilding the interpolation plan',()=>{
  const tides=decodeTides(JSON.parse(fs.readFileSync(new URL('../data/atlas-history/sealevel-stations.json',import.meta.url)))).regions;
  const plan=buildSeaCoastStencil(tides),weights=plan.weights.slice();
  const a=buildSeaSurfaceTexture(source.regions,2016,360,180,tides,plan),b=buildSeaSurfaceTexture(source.regions,2024,360,180,tides,plan);
  assert(a.coastalSamples>300);assert(b.coastalSamples>200);assert.notDeepEqual(a.pixels,b.pixels);assert.deepEqual(plan.weights,weights);
  const near=a.surfaceValues.filter(Number.isFinite);assert(Math.max(...near)-Math.min(...near)>300);
});
test('Missing means are excluded; an entirely missing year is transparent',()=>{
  assert(buildSeaSurfaceTexture(source.regions,1900,36,18).pixels.every(v=>v===0));
  const field=buildSeaSurfaceTexture([{id:'pac',years:[{year:2016,value:0}]}],2016,36,18);
  for(let i=0;i<field.pixels.length;i+=4)if(field.pixels[i+3])assert.deepEqual([...field.pixels.slice(i,i+3)],seaSurfaceColor(0));
});
test('Swells are continuous and periodic in world longitude without phase resets',()=>{
  for(let y=0;y<=1;y+=.1){const a=seaSwellLight(0,y,12),b=seaSwellLight(1,y,12);a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-10));}
  const a=seaSwellLight(.42,.5,11.999),b=seaSwellLight(.42,.5,12.001);assert(Math.abs(a[0]-b[0])<.005);assert(Math.abs(a[1]-b[1])<.005);
});
test('CPU fallback visibly moves without changing source pixels, alpha or geography',()=>{
  const field=buildSeaSurfaceTexture(source.regions,2016,72,36),original=field.pixels.slice(),a=new Uint8ClampedArray(original.length),b=a.slice();
  paintSeaSurfaceCPU(field,0,a);paintSeaSurfaceCPU(field,2,b);assert.notDeepEqual(a,b);assert.deepEqual(field.pixels,original);
  for(let i=3;i<a.length;i+=4)assert.equal(a[i],b[i]);
});
