import test from 'node:test';import assert from 'node:assert/strict';
import {ATLAS95_SHADERS} from '../src/exploration/atlas95-motion.js';
import {centuryMotionShapes} from '../src/exploration/century-motion-mask.js';
test('five different fragments use the shared renderer clock',()=>{assert.equal(new Set(Object.values(ATLAS95_SHADERS)).size,5);for(const source of Object.values(ATLAS95_SHADERS))assert.match(source,/time/);});
test('heat texture respects the two measured layers, including missing and negative values',()=>{
 const s={id:'oceanheat',x:100,y:200,w:50,h:100,row:{upper:2,deep:-3},alpha:1},before=JSON.stringify(s),a=centuryMotionShapes(s);
 assert.equal(a.length,2);assert.equal(a[0].h,70);assert.equal(a[1].h,130);assert.equal(a[0].signal,.6);assert.equal(a[1].signal,.35);assert.equal(a[1].y,a[0].y+a[0].h);assert.equal(JSON.stringify(s),before);
 assert.equal(centuryMotionShapes({...s,row:{upper:null,deep:0}}).length,1);
});
test('ozone light follows measured hole radius and never fills a missing year',()=>{
 const s={id:'ozone',x:0,y:0,w:100,h:100,alpha:1};assert.deepEqual(centuryMotionShapes({...s,row:{value:null}}),[]);assert.deepEqual(centuryMotionShapes({...s,row:{value:0}}),[]);
 const a=centuryMotionShapes({...s,row:{value:7.5}})[0],b=centuryMotionShapes({...s,row:{value:30}})[0];assert.equal(a.radius,b.radius/2);assert.equal(a.type,'ring');
});
test('glacier texture stays inside the existing cumulative balance polygon',()=>{
 const s={id:'glaciers',x:100,y:100,w:80,h:80,alpha:1,row:{value:-5},path:[[40,20],[100,45],[150,60]]},before=JSON.stringify(s),a=centuryMotionShapes(s)[0];assert.deepEqual(a.path,[[40,20],...s.path,[150,20]]);assert.equal(JSON.stringify(s),before);assert.deepEqual(centuryMotionShapes({...s,row:{value:0}}),[]);assert.deepEqual(centuryMotionShapes({...s,row:{value:null}}),[]);
});
test('event effects remain centered on actual coordinates with fixed marker bounds',()=>{
 for(const id of ['volcanoes','tsunamis']){const s={id,x:200,y:300,size:20,value:null,alpha:.3},a=centuryMotionShapes(s)[0],b=centuryMotionShapes({...s,value:8})[0];assert(Number.isFinite(a.signal));assert.equal(a.x+a.w/2,200);assert.deepEqual([a.x,a.y,a.w,a.h],[b.x,b.y,b.w,b.h]);assert.equal(a.alpha,.3);assert.deepEqual(centuryMotionShapes({...s,alpha:0}),[]);}
});
