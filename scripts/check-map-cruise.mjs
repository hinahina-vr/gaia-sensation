import assert from 'node:assert/strict';
import {createCruiseController} from '../src/exploration/map-cruise.js';
let time=0, number=4, pause=false, ready=true, available=true;
const isPlanet=number=>number<=5&&number!==4;
const points=[], ends=[], visited=[];
const cruise=createCruiseController({now:()=>time,available:()=>available,paused:()=>pause,
 inspect:()=>({number,ready,kind:isPlanet(number)?'poi':'slider',duration:10000,poiCount:8,
  seek:p=>{if(p===1)ends.push(number);},selectPoi:i=>points.push([number,i])}),
 advance:()=>{visited.push(number);number=number%71+1;}});
const tick=ms=>{time+=ms;cruise.tick();};
assert(cruise.start());tick(0);tick(5000);pause=true;tick(50000);pause=false;assert.equal(cruise.getState().elapsed,5000);
ready=false;tick(50000);ready=true;assert.equal(cruise.getState().elapsed,5000);
tick(5000);assert.equal(cruise.getState().phase,'hold');tick(2999);assert.equal(number,4);tick(1);assert.equal(number,5);
cruise.stop();number=1;visited.length=0;points.length=0;ends.length=0;assert(cruise.start());
for(let n=1;n<=71;n++) {tick(0);if(isPlanet(n)){for(let i=0;i<5;i++)tick(5000);}else{tick(10000);tick(3000);}}
assert.equal(number,1);assert.deepEqual(visited,Array.from({length:71},(_,i)=>i+1));assert.equal(points.length,20);assert.deepEqual(points.slice(0,5),[[1,0],[1,1],[1,2],[1,3],[1,4]]);
available=false;tick(1);assert.equal(cruise.getState().active,false);
console.log('PASS: 71-exhibit loop, endpoints + 3s, 5 POIs × 5s, loading/visibility pause, exit');
