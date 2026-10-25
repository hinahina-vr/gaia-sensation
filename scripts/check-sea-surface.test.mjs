import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {seaSurfaceColor,seaSurfaceWeights,buildSeaSurfaceTexture,seaSwellLight,paintSeaSurfaceCPU} from '../src/exploration/sea-surface-model.js';
const source=JSON.parse(fs.readFileSync(new URL('../data/atlas-history/sealevel.json',import.meta.url)));
test('Ocean weights are finite, normalized, and continuous around the longitude seam',()=>{
  for(let lon=-180;lon<=180;lon+=5)for(let lat=-60;lat<=60;lat+=20){const w=seaSurfaceWeights(lon,lat);assert(w.every(v=>v>=0&&v<=1));assert(Math.abs(w.reduce((a,b)=>a+b)-1)<1e-12);}
  assert.deepEqual(seaSurfaceWeights(-180,0),seaSurfaceWeights(180,0));
});
test('Annual colours use exactly the three source means, never coast-station values',()=>{
  const field=buildSeaSurfaceTexture(source.regions,2016,36,18);
  assert.deepEqual(field.values,['pac','atl','ind'].map(id=>source.regions.find(r=>r.id===id).years.find(r=>r.year===2016).value));
  assert.notDeepEqual(field.pixels,buildSeaSurfaceTexture(source.regions,1993,36,18).pixels);
  assert.notDeepEqual(field.pixels,buildSeaSurfaceTexture(source.regions,2024,36,18).pixels);
  assert.equal(seaSurfaceColor(null),null);assert.deepEqual(seaSurfaceColor(1000),seaSurfaceColor(120));
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
