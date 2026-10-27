import test from 'node:test';import assert from 'node:assert/strict';
import {ATLAS100_SHADERS,atlas100Signal} from '../src/exploration/atlas100-motion.js';
const signal=(id,row,fishMax)=>atlas100Signal({definition:{id},row,fishMax});
test('five themes have separate fragments and preserve missing values',()=>{
 assert.equal(new Set(Object.values(ATLAS100_SHADERS)).size,5);
 for(const id of Object.keys(ATLAS100_SHADERS)){assert.match(ATLAS100_SHADERS[id],/time/);for(const value of [null,NaN,Infinity,undefined])assert.equal(signal(id,{value}),null);}
});
test('water components remain the source shares without normalization or fabricated composition',()=>{
 const row={value:70,agriculture:70,industry:20,domestic:10},before=JSON.stringify(row);assert.deepEqual(signal('wateruse',row),[.7,.2,.1]);assert.equal(JSON.stringify(row),before);
 for(const bad of [{...row,invalidComposition:true},{...row,industry:null},{...row,domestic:30},{...row,industry:-5}])assert.equal(signal('wateruse',bad),null);
});
test('hunger preserves the public-bound flag, including genuine zero',()=>{
 assert.deepEqual(signal('hunger',{value:2.5,censored:true}),[.025,1,0]);assert.deepEqual(signal('hunger',{value:2.5}),[.025,0,0]);assert.deepEqual(signal('hunger',{value:0}),[0,0,0]);
});
test('fisheries separates catch and aquaculture and never fills a missing component',()=>{
 const row={value:50,capture:20,aquaculture:30};assert.deepEqual(signal('fisheries',row,100),[.4,.6,.5]);assert.equal(signal('fisheries',{...row,aquaculture:null},100),null);assert.equal(signal('fisheries',{value:0,capture:0,aquaculture:0},100),null);
});
test('internet is a population share and refugee light is bounded by source counts',()=>{
 assert.deepEqual(signal('internet',{value:75}),[.75,0,0]);assert.deepEqual(signal('refugees',{value:3500000}),[.5,0,0]);assert.equal(signal('refugees',{value:0}),null);assert.deepEqual(signal('refugees',{value:14000000}),[1,0,0]);
});
