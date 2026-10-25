import test from 'node:test';
import assert from 'node:assert/strict';
import {createLakeCameraFlight} from '../src/exploration/lake-camera-flight.js';
const rect={width:1440,height:900},base=4;
const camera=(x,y,zoom)=>({zoom,offsetX:(180-x)*base*zoom,offsetY:(90-y)*base*zoom});
test('wide-to-lake flight uses proportional magnification and lands exactly',()=>{
 const a=camera(78,50,1),b=camera(79,51,93),f=createLakeCameraFlight(a,b,rect,base);
 assert.equal(f.distant,false);assert.deepEqual(f.at(0),a);assert.deepEqual(f.at(1),b);
 assert(f.at(.1).zoom<1.2,'No leap to several times zoom at the start');
 assert(Math.abs(f.at(.5).zoom-Math.sqrt(93))<1e-10);
 let previous=1;for(let i=1;i<=100;i++){const c=f.at(i/100);assert(c.zoom>=previous);previous=c.zoom;assert(Object.values(c).every(Number.isFinite));}
});
test('cross-continent travel pulls back before panning and approaches the correct lake',()=>{
 const a=camera(75,52,93),b=camera(324,108,180),f=createLakeCameraFlight(a,b,rect,base);
 assert.equal(f.distant,true);assert.equal(f.durationFactor,1.35);assert.equal(f.at(.5).zoom,1);
 assert(f.minimumDurationMs>5000,'A short drawer reframe cannot accelerate a cross-continent zoom');
 assert.deepEqual(f.at(0),a);assert.deepEqual(f.at(1),b);
 for(let i=0;i<=100;i++){const c=f.at(i/100);assert(c.zoom>=1&&c.zoom<=180+1e-9);assert(Object.values(c).every(Number.isFinite));}
});
test('zooming out delays the pan until the wider view is available',()=>{
 const a=camera(80,50,93),b=camera(180,90,1),f=createLakeCameraFlight(a,b,rect,base),early=f.at(.3);
 assert.equal(f.distant,false);assert(Math.abs(180-early.offsetX/(base*early.zoom)-80)<1e-10);
 assert(early.zoom<93);assert.deepEqual(f.at(1),b);
});
test('reframing the same lake stays finite without an unnecessary continental pullback',()=>{
 const a=camera(80,50,93),b=camera(80.02,50.03,84),f=createLakeCameraFlight(a,b,rect,base);
 assert.equal(f.distant,false);for(let i=0;i<=100;i++)assert(f.at(i/100).zoom>=84-1e-9);
 assert.deepEqual(f.at(-1),a);assert.deepEqual(f.at(2),b);
});
