import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const definition=source.match(/  const FOREST_RAIN_REFERENCE_MAX_MM_DAY = [\s\S]*?(?=  const getForestRainSiteName)/)?.[0];
assert(definition);
const radius=vm.runInNewContext(`${definition}\ngetForestRainRadius`,{clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),japanView:{earthZoom:1}});
test('Rain comparison keeps the same square-root ordering, zero and 6.5 mm/day cap',()=>{
  for(const width of [320,390,768,1920])for(const zoom of [0.75,1,1.8,4,16]){
    const values=[0,0.1,0.5,1,3.25,6.5].map(n=>radius(n,{width},zoom));
    assert(values.every((v,i)=>v>0&&v<=28&&(!i||v>values[i-1])));
    assert.equal(radius(10,{width},zoom),values.at(-1));
    assert(Math.abs((values[4]-values[0])/(values[5]-values[0])-Math.sqrt(0.5))<1e-12);
  }
});
test('Every site shares one zoom/viewport scale; selected sites cannot inflate data circles',()=>{
  for(const value of [0,1,5.33,6.5]){
    assert.equal(radius(value,{width:390},1),radius(value,{width:1920},1)*0.65);
    assert.equal(radius(value,{width:1920},4),radius(value,{width:1920},1)*2);
    assert.equal(radius(value,{width:1920},16),radius(value,{width:1920},4));
  }
  assert.doesNotMatch(definition,/selected|Math\.sin|performance\.now/);
});
