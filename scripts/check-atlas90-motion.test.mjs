import test from 'node:test';import assert from 'node:assert/strict';
import {ATLAS90_SHADERS,atlas90Signal,sharedAtlas90Motion} from '../src/exploration/atlas90-motion.js';
import {extentMotionShapes} from '../src/exploration/extent-motion-mask.js';
test('five distinct themes share one lazy renderer without inventing missing values',()=>{
 assert.equal(new Set(Object.values(ATLAS90_SHADERS)).size,5);assert.equal(sharedAtlas90Motion(),sharedAtlas90Motion());
 for(const id of ['urban','ageing','childsurvival'])for(const value of [null,undefined,NaN,Infinity])assert.equal(atlas90Signal({definition:{id},value}),null);
 assert.deepEqual(atlas90Signal({definition:{id:'urban'},value:80}),[.8,0,0]);assert.deepEqual(atlas90Signal({definition:{id:'ageing'},value:30}),[.3,0,0]);assert.deepEqual(atlas90Signal({definition:{id:'childsurvival'},value:30}),[.2,0,0]);assert.deepEqual(atlas90Signal({definition:{id:'childsurvival'},value:0}),[0,0,0]);
});
test('sea ice texture stays inside the original area diagram',()=>{
 const surface={x:100,y:200,radius:50,size:25,value:5,max:20,alpha:1},before=JSON.stringify(surface),shape=extentMotionShapes(surface,{id:'seaice'})[0];assert.equal(shape.radius,25);assert.equal(shape.sector,false);assert.equal(shape.x,100);assert.equal(shape.y,200);assert.equal(JSON.stringify(surface),before);
 for(const value of [null,NaN,0])assert.deepEqual(extentMotionShapes({...surface,value},{id:'seaice'}),[]);
});
test('snow textures preserve monthly areas, missing sectors and selection geometry',()=>{
 const surface={x:0,y:0,radius:100,max:40,alpha:1,values:[10,20,null,0,...Array(8).fill(30)]},before=JSON.stringify(surface),a=extentMotionShapes(surface,{id:'snowcover',month:1}),b=extentMotionShapes(surface,{id:'snowcover',month:2});assert.equal(a.length,10);assert.equal(a[0].radius,50);assert(Math.abs(a[1].radius**2/a[0].radius**2-2)<1e-10);assert.deepEqual(a.map(({signal,...s})=>s),b.map(({signal,...s})=>s));assert.equal(a[0].signal[1],1);assert.equal(b[1].signal[1],1);assert.equal(JSON.stringify(surface),before);
 assert.deepEqual(extentMotionShapes({...surface,alpha:0},{id:'snowcover',month:1}),[]);
});
