import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapEarthInsight} from '../statistics-earth-context.js';
import {discoverData} from '../statistics-discovery.js';
const rows=values=>values.map((value,i)=>({id:String(i),label:'対象'+i,x:i,y:value,value,provenance:'SOURCE'}));
const measured=Object.freeze({headline:'measured',summary:'measured',status:'computed',metrics:Object.freeze([Object.freeze(['元の値',12.345,'unit'])]),recordIds:Object.freeze(['0','1']),calculation:'original calculation'});
const context=(id,candidate={},sample=rows([2,8,3]),result=measured)=>mapEarthInsight({id},candidate,sample,result);

test('all 01–05 data adapters receive distinct Earth readings without changing measured evidence',()=>{
 const ids=['planet-global-wind-pressure','planet-usgs-earthquake-ripples','planet-global-aerosol-light','nasa-firms-active-fire-24h','planet-global-cloud-radiance'];
 const summaries=new Set();
 for(const id of ids){
  const r=context(id);assert.equal(r.audience,'earth-context');assert.equal(r.metrics,measured.metrics);assert.equal(r.recordIds,measured.recordIds);assert.equal(r.calculation,measured.calculation);assert.equal(r.status,measured.status);
  assert(r.takeawayLabel&&r.takeawayCaveat&&r.fact);assert(!/[0-9]|ではありません|輪郭|経営判断|指標です/.test(r.headline+r.fact+r.summary));
  assert(r.summary.length>40);summaries.add(r.summary);
 }
 assert.equal(summaries.size,5);
});

test('matched wind/cloud and aerosol comparisons explain the observed difference',()=>{
 const peer={id:'near-peers'};
 assert.match(context('planet-global-wind-pressure',peer).fact,/強い風.*穏やかな風/); // A peer ID without its measured comparison cannot establish matched pressure.
 assert.match(context('planet-global-cloud-radiance',peer).fact,/雲.*近い.*光の強さ/);
 assert.match(context('planet-global-aerosol-light',{id:'haze-ground-mismatch'}).fact,/霞.*地表.*ずれ/);
 assert.match(context('planet-usgs-earthquake-ripples',{id:'same-magnitude-depth'}).fact,/規模.*近い.*深さ/);
});

test('equal values and small/empty selections never inherit an unequal or rising claim',()=>{
 for(const id of ['planet-global-wind-pressure','planet-usgs-earthquake-ripples','planet-global-aerosol-light','nasa-firms-active-fire-24h','planet-global-cloud-radiance']){
  assert.match(context(id,{},rows([4,4,4])).fact,/同じ/);
  const none=context(id,{},[],{...measured,status:'insufficient'});assert.match(none.fact,/記録がありません/);assert.equal(none.status,'insufficient');assert(!none.fact.includes('差がある'));
  assert.match(context(id,{},rows([4]),{...measured,status:'insufficient'}).fact,/ひとつ/);
 }
});

test('unrelated displays and 70 keep their existing handling',()=>{
 for(const id of ['food-balances-392-2905','wind-climate','unknown-display'])assert.equal(context(id),measured);
});

test('interpretation changes when the discovered relationship changes',()=>{
 const matched=context('planet-global-wind-pressure',{id:'near-peers'}),ordinary=context('planet-global-wind-pressure',{id:'isolated-tail'});assert.equal(matched.summary,ordinary.summary); // Missing comparison evidence must not invent matched pressure.
 const cloud=(correlation,rSquared)=>context('planet-global-cloud-radiance',{id:'near-peers'},rows([100,500,900]),{...measured,details:{correlation,rSquared}});
 const weak=cloud(.01,.0001),strong=cloud(-.8,.64);assert.notEqual(weak.summary,strong.summary);assert.match(weak.summary,/雲量.*光/);assert(!weak.summary.includes("昼夜"),"Unmeasured daylight is not presented as the explanation");assert.match(strong.summary,/雲の多い場所ほど/);
});

test('actual FIRMS intensity concentration supports the selected interpretation',()=>{
 const raw=JSON.parse(fs.readFileSync('data/firms-active-fire-snapshot.json','utf8'));const sample=raw.points.map(p=>({id:p.id,value:p.frp,provenance:'SOURCE'}));
 const result=context('nasa-firms-active-fire-24h',{id:'concentration'},sample);assert(result.interpretationBasis.share>.6);assert(result.interpretationBasis.share<.61);assert.match(result.fact,/一割.*過半/);assert.match(result.summary,/少数.*検知点.*暮らし.*生きもの.*守る/);
 assert(result.interpretationBasis.recordIds.every(id=>sample.some(r=>r.id===id)));assert.equal(result.metrics,measured.metrics);
 const flatter=context('nasa-firms-active-fire-24h',{},rows(Array.from({length:100},(_,i)=>10+i/100)));assert.notEqual(result.summary,flatter.summary);assert(flatter.interpretationBasis.share<.5);
});

test('changed records change both the discovered feature and its interpretation',()=>{
 const wind=rows([.27,19.94,4,8,2,6]).map((r,i)=>({...r,pressure:[987.5,987.5,1003,1018,1020,1040][i]}));
 const dataset={id:'planet-global-wind-pressure',unit:'m/s',valueLabel:'風速'};
 const peer=discoverData({dataset,rows:wind}),unmatched=discoverData({dataset,rows:wind.map((r,i)=>({...r,pressure:1000+i*500}))});
 assert.equal(peer.primaryId,'near-peers');assert.notEqual(unmatched.primaryId,'near-peers');assert.notEqual(peer.summary,unmatched.summary);
 const cloud=rows(Array.from({length:18},(_,i)=>100+(i*53%9)*100)).map((r,i)=>({...r,cloudCover:30+i%3*20}));
 const clouds={id:'planet-global-cloud-radiance',unit:'W/m²',valueLabel:'短波放射'};
 const weak=discoverData({dataset:clouds,rows:cloud}),strong=discoverData({dataset:clouds,rows:cloud.map((r,i)=>({...r,value:1000-r.cloudCover*8+(Math.floor(i/3)%2?100:-100)}))});
 assert.equal(weak.primaryId,'near-peers');assert.equal(strong.primaryId,'near-peers');
 assert(weak.computedInsight.details.rSquared<.1);assert(strong.computedInsight.details.rSquared>=.1);assert(strong.computedInsight.details.correlation<0);
 assert.notEqual(weak.summary,strong.summary);
});
