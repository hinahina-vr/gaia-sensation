import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {urbanReading,urbanMilestone,urbanSourceId,urbanData,urbanChartYear,urbanArrival,urbanValid,paintUrbanHistory} from '../src/exploration/urban-population.js';
const data=JSON.parse(fs.readFileSync('data/atlas-history/urban.json','utf8')),region=id=>data.regions.find(r=>r.id===id);
test('actual source composition preserves total and changes in percentage points',()=>{
 for(const r of data.regions)for(const row of r.years){const p=urbanReading(r,row.year);assert.equal(p.urban,row.value);assert(Math.abs(p.urban+p.rural-100)<1e-10);}
 assert.deepEqual(urbanReading(region('CHN'),2016),{urban:58.8399,rural:100-58.8399,baseline:36.432,change:22.4079});
 assert(urbanReading(region('ATG'),2024).change<0);
 assert.equal(urbanReading(region('SGP'),2024).rural,0);
});
test('half-population milestone describes recorded crossing without assuming constant growth',()=>{
 assert.equal(urbanMilestone(region('CHN')),'2011年に都市人口が半数以上');
 assert.equal(urbanMilestone(region('IND')),'対象期間では都市人口は半数未満');
 assert.equal(urbanMilestone(region('JPN')),'2000年時点で都市人口が半数以上');
});
test('missing values and out of range values are not converted to zero',()=>{
 for(const v of [null,undefined,NaN,-1,101])assert.equal(urbanValid(v),null);
 assert.equal(urbanValid(0),0);assert.equal(urbanValid(100),100);
 assert.deepEqual(urbanReading({years:[{year:2016,value:null}]},2016),{urban:null,rural:null,baseline:null,change:null});
});
test('geographic source aliases and display names leave original data intact',()=>{
 assert.equal(urbanSourceId('KOS'),'XKX');assert.equal(urbanSourceId('JEY'),'CHI');assert.equal(urbanSourceId('GGY'),'CHI');
 assert.equal(urbanSourceId('SDS'),'SSD');assert.equal(urbanSourceId('PSX'),'PSE');
 const d=urbanData(data);assert.equal(d.regions.length,217);assert.equal(d.regions.find(r=>r.id==='CHI').name,'チャネル諸島');assert.equal(region('CHI').name,'JG');
 assert.equal(d,urbanData(data));
});
test('arrival completes without blinking and chart clamps keyboard endpoints',()=>{
 assert.equal(urbanArrival(1,10,-1),0);assert.equal(urbanArrival(9,10,1100),1);assert.equal(urbanArrival(9,10,0,true),1);
 let previous=0;for(let t=0;t<=1100;t+=5){const n=urbanArrival(9,10,t);assert(n>=previous);previous=n;}
 assert.equal(urbanChartYear(0),2000);assert.equal(urbanChartYear(1),2024);assert.equal(urbanChartYear((46+16/24*532)/600),2016);
});
test('area chart leaves missing-year gaps and accepts zero/100 endpoint compositions',()=>{
 const calls=[];const c=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||((...a)=>calls.push([k,...a])),set:(o,k,v)=>(o[k]=v,true)});
 paintUrbanHistory(c,{years:[{year:2000,value:0},{year:2001,value:100},{year:2002,value:null},{year:2003,value:50}]},2001,600,260);
 assert.equal(calls.filter(c=>c[0]==='closePath').length,4,'Only contiguous 2000–2001 is filled, clipped on each side of the year cursor');
 assert(calls.flat().filter(v=>typeof v==='number').every(Number.isFinite));
});
