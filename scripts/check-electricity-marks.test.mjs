import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ELECTRICITY_ARRIVAL_MS,electricityArrival,electricityReading,electricityGauge,layoutElectricityLabels,electricityOverlap,fitElectricityName} from '../src/exploration/electricity-country-marks.js';
test('national fills and labels arrive continuously and settle within 900ms',()=>{
  for(const i of [0,90,180]){
    let previous=0;
    for(let t=-1;t<=900;t++){const a=electricityArrival(i,181,t);assert(a>=previous&&a<=1);assert(a-previous<.003);previous=a;}
    assert.equal(previous,1);
  }
  assert.equal(electricityArrival(180,181,-1,true),0);
  assert.equal(electricityArrival(180,181,0,true),1);
  assert.equal(electricityArrival(0,1,ELECTRICITY_ARRIVAL_MS-220),1);
});
test('readings preserve missingness, signs and exact rounded units',()=>{
  assert.equal(electricityReading(53.1),'53.1%');assert.equal(electricityReading(0),'0%');
  assert.equal(electricityReading(37.9,true),'＋37.9 pt');assert.equal(electricityReading(-10,true),'−10 pt');
  assert.equal(electricityReading(null),'欠測');assert.equal(electricityReading(undefined,true),'欠測');
  assert.deepEqual(electricityGauge(null,15.2),{value:null,baseline:.152,origin:0});
  assert.deepEqual(electricityGauge(53.1,null),{value:.531,baseline:null,origin:0});
  assert.deepEqual(electricityGauge(0,0),{value:0,baseline:0,origin:0});
  assert.equal(electricityGauge(61.8,0,true).value,1);assert.equal(electricityReading(61.8,true),'＋61.8 pt');
  assert.equal(electricityGauge(-10,0,true).value,.4);
});
test('compact country reading fits between legend and drawer, without moving its geographic anchor',()=>{
  const obstacles=[{left:68,right:308,top:185,bottom:359},{left:12,right:308,top:446,bottom:568}];
  const candidates=[{id:'KEN',name:'ケニア',x:160,y:400,value:53.1,labelWidth:33}];
  const marks=layoutElectricityLabels(candidates,{width:320,height:568,compact:true,selectedId:'KEN',obstacles});
  assert.equal(marks.length,1);assert.equal(marks[0].x,160);assert.equal(marks[0].y,400);
  assert(marks[0].bounds.left>=8&&marks[0].bounds.right<=312);
  assert(obstacles.every(o=>!electricityOverlap(marks[0].bounds,o)));
  assert.equal(layoutElectricityLabels([{...candidates[0],x:-40}],{width:320,height:568,compact:true,selectedId:'KEN',obstacles}).length,0);
});
test('labels do not overlap or shuffle when values change, and missing countries stay represented',()=>{
  const candidates=Array.from({length:50},(_,i)=>({id:String(i),name:'国',labelWidth:11,x:100+i%10*120,y:200+Math.floor(i/10)*95,value:i}));
  const options={width:1440,height:900,compact:false,selectedId:'15',obstacles:[{left:1100,right:1440,top:100,bottom:700}]};
  const first=layoutElectricityLabels(candidates,options),next=layoutElectricityLabels(candidates.map(p=>({...p,value:null})),options);
  assert(first.length>4&&first.length<=11);assert.equal(first[0].id,'15');
  assert.deepEqual(first.map(p=>({id:p.id,bounds:p.bounds})),next.map(p=>({id:p.id,bounds:p.bounds})));
  for(const [i,p]of first.entries())for(const other of first.slice(i+1))assert(!electricityOverlap(p.bounds,other.bounds));
});
test('long country names shorten safely without tiny type or splitting unicode characters',()=>{
  const measure=s=>Array.from(s).length*11;
  assert.equal(fitElectricityName('ケニア',100,measure),'ケニア');
  assert.equal(fitElectricityName('コンゴ民主共和国(キンシャサ)',110,measure),'コンゴ民主共和国(…');
  assert.equal(fitElectricityName('🌎🌎🌎🌎',33,measure),'🌎🌎…');
});
