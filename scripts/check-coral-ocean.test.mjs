import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {coralOceanColour,buildCoralOceanTexture,coralOceanVelocity,buildCoralOceanStreams} from '../src/exploration/coral-ocean-model.js';
import {coralGlyph} from '../src/exploration/coral-heat-view.js';
import {coralOceanPhase,paintCoralOceanMotion,buildCoralOceanMotionField,CORAL_FLOW_PERIOD,CORAL_FLOW_SPEED} from '../src/exploration/coral-ocean-motion.js';

const data=JSON.parse(fs.readFileSync('data/climate-history/coral.json'));
const points=data.regions.map(p=>({lon:p.lon,lat:p.lat,...coralGlyph(p.years.find(r=>r.year===2016),2016)}));

test('The complete ocean colour texture is finite, translucent and does not change observations',()=>{
  const before=JSON.stringify(points),source=JSON.stringify(data),field=buildCoralOceanTexture(points);
  assert.equal(field.pixels.length,256*128*4);
  for(let i=0;i<field.pixels.length;i+=4){assert.equal(field.pixels[i+3],107);assert(field.pixels[i+2]>0);}
  assert.equal(JSON.stringify(points),before);assert.equal(JSON.stringify(data),source);
});

test('Colour interpolation wraps longitude smoothly, preserves zero and excludes missing points',()=>{
  for(const lat of [-80,-30,0,25,80]){
    const a=coralOceanColour(points,-30,lat),b=coralOceanColour(points,330,lat);
    assert(a.every((v,i)=>Math.abs(v-b[i])<1e-12));
  }
  const zero={lon:0,lat:0,rgb:[0,1,1],missing:false};
  assert.deepEqual(coralOceanColour([zero],0,0),[0,1,1,.42]);
  assert.deepEqual(coralOceanColour([{...zero,missing:true}],0,0),coralOceanColour([],0,0));
  for(const p of points.slice(0,20)){
    const a=coralOceanColour(points,p.lon,p.lat),b=coralOceanColour(points,p.lon+.001,p.lat+.001);
    assert(a.every((v,i)=>Math.abs(v-b[i])<.005),'No colour boundary around a POI');
  }
});

test('Synthetic circulation paths are deterministic, curved and bounded, with no projection-cut jumps',()=>{
  const lines=buildCoralOceanStreams();assert.equal(lines.length,390);assert.deepEqual(lines,buildCoralOceanStreams());
  for(const line of lines){
    assert(line.length<=76);
    for(let i=1;i<line.length;i++){
      const p=line[i],a=line[i-1];assert(Object.values(p).every(Number.isFinite));
      assert(Math.abs(p.x-a.x)<=.81&&Math.abs(p.y-a.y)<=.81);assert(p.distance>a.distance);
    }
  }
  const a=coralOceanVelocity(-140,25),b=coralOceanVelocity(-160,45);
  assert(Math.hypot(a.u-b.u,a.v-b.v)>.2,'Flow bends through the sea rather than running in parallel lines');
  const west=coralOceanVelocity(-30,0),east=coralOceanVelocity(330,0);
  assert(Math.abs(west.u-east.u)<1e-12&&Math.abs(west.v-east.v)<1e-12);
});

test('Colour movement uses the streamline direction and bounded two-phase transport',()=>{
  const flow=buildCoralOceanMotionField(),a=new Float64Array(3);
  for(let y=0;y<flow.height;y+=7)for(let x=0;x<flow.width;x+=11){
    const i=(y*flow.width+x)*4,v=coralOceanVelocity(-30+(x+.5)*360/flow.width,90-(y+.5)*180/flow.height);
    assert(Math.abs((flow.pixels[i]/127.5-1)-v.u)<.004);
    assert(Math.abs((flow.pixels[i+1]/127.5-1)+v.v)<.004,'Latitude and screen Y run in opposite directions');
  }
  for(const t of [0,1,5.999,6,11.999,12,19,5000]){
    coralOceanPhase(t,a);assert(a[0]>=0&&a[0]<CORAL_FLOW_PERIOD&&a[1]>=0&&a[1]<CORAL_FLOW_PERIOD);
    assert(a[2]>=0&&a[2]<=1);assert(Math.max(a[0],a[1])*CORAL_FLOW_SPEED<6.72);
  }
  const field=buildCoralOceanTexture(points),original=field.pixels.slice();
  const first=new Uint8ClampedArray(original.length),later=new Uint8ClampedArray(original.length);
  paintCoralOceanMotion(field,0,first,flow);paintCoralOceanMotion(field,1,later,flow);
  let changes=0;
  for(let i=0;i<first.length;i+=4){assert.equal(later[i+3],107);if(Math.abs(first[i]-later[i])+Math.abs(first[i+1]-later[i+1])+Math.abs(first[i+2]-later[i+2])>3)changes++;}
  assert(changes>field.width*field.height*.15,'Colour surface moves across a broad area, not only the flow lines');
  paintCoralOceanMotion(field,0,later,flow);assert.deepEqual(later,first,'Fixed time is deterministic for reduced motion');
  paintCoralOceanMotion(field,12,later,flow);assert.deepEqual(later,first,'A full cycle returns to the same image');
  assert.deepEqual(field.pixels,original,'The stored year texture remains unchanged');
  for(const seam of [6,12]){
    paintCoralOceanMotion(field,seam-.001,first,flow);paintCoralOceanMotion(field,seam+.001,later,flow);
    assert(first.every((n,i)=>Math.abs(n-later[i])<=1),'Phase reset has no visible jump');
  }
});
