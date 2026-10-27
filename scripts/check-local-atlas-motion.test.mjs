import test from 'node:test';import assert from 'node:assert/strict';
import {localAtlasSignal,LOCAL_ATLAS_SHADERS} from '../src/exploration/local-atlas-motion.js';
test('five separate thematic shaders; all missing observations stay transparent',()=>{
 assert.equal(new Set(Object.values(LOCAL_ATLAS_SHADERS)).size,5);
 for(const id of Object.keys(LOCAL_ATLAS_SHADERS))for(const value of [null,undefined,NaN,Infinity])assert.equal(localAtlasSignal({definition:{id},value,access:40}),null);
});
test('cropland density uses actual source share while signed color follows selected mode',()=>{
 assert.deepEqual(localAtlasSignal({definition:{id:'cropland'},value:-2,access:30,mode:'change'}),[.3,.3,0]);
 assert.deepEqual(localAtlasSignal({definition:{id:'cropland'},value:30,access:30,mode:'share'}),[.3,.3,0]);
 assert.equal(localAtlasSignal({definition:{id:'cropland'},value:0,access:null,mode:'change'}),null);
});
test('valid zero is retained and only display encoding clips extremes',()=>{
 for(const id of ['waterstress','yield','fertilizer'])assert.deepEqual(localAtlasSignal({definition:{id},value:0}),[0,0,0]);
 const input={definition:{id:'waterstress'},value:450};assert.deepEqual(localAtlasSignal(input),[1,1,0]);assert.equal(input.value,450);
 assert.deepEqual(localAtlasSignal({definition:{id:'yield'},value:20000}),[1,0,0]);
 assert.deepEqual(localAtlasSignal({definition:{id:'longevity'},value:65}),[.5,0,0]);
 assert.equal(localAtlasSignal({definition:{id:'urban'},value:50}),null);
});
