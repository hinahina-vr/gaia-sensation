import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {lastCenturyInsightFixtures} from './lib/last-century-insight-fixtures.mjs';
import {discoverData} from '../statistics-discovery.js';import {livingEarthInsight} from '../statistics-living-earth-context.js';
const fixtures=lastCenturyInsightFixtures(),baseline=JSON.parse(fs.readFileSync('scripts/fixtures/insights96-100-numerical-20261027.json'));
const result=f=>discoverData({dataset:f.dataset,rows:f.dataset.rows}).computedInsight;
for(const number of [96,97,98,99,100])test(`${number}: every comparable region uses existing analysis and meaningful reading`,()=>{
 const group=fixtures.filter(f=>f.number===number);assert(group.length>0);
 for(const f of group){const before=JSON.stringify(f.dataset),r=result(f),old=baseline.find(b=>b.id===f.dataset.id).result;
  for(const key of ['metrics','recordIds','calculation','details','status'])assert.deepEqual(r[key],old[key],f.dataset.id+' '+key);
  assert.equal(JSON.stringify(f.dataset),before);assert.equal(r.audience,'earth-context');assert.equal(r.futurePerspective.focus,'human-earth-co-creation-and-future');assert.equal(r.logic.inference,r.fact);assert.equal(r.logic.implication,r.summary);
  assert(!/収録|輪郭|必要があります|ではありません|選んだ地点の/.test(r.headline+r.fact+r.summary),f.dataset.id);assert(!/\d/.test(r.summary));assert(r.summary.length<230);
 }
});
test('agricultural dominance comes from the compared means, not assumed total water savings',()=>{const r=result(fixtures.find(f=>f.number===96&&f.variant==='IND'));assert(r.metrics[0][1]>80&&r.metrics[1][1]>80);assert.match(r.headline,/大半/);assert.match(r.fact,/割合|過半/);assert(!/取水量が減|消費量が減|節水を達成/.test(r.fact));});
test('hunger compares available point estimates without extending them to censored later years',()=>{const f=fixtures.find(f=>f.number===97&&f.variant==='CHN'),r=result(f);assert(f.dataset.periodEnd<2024);assert.match(r.headline,/比較した期間/);assert.match(r.fact,/点推計/);assert(!/現在|直近|2024/.test(r.fact));});
test('combined fisheries production does not become fish stocks or an invented aquaculture trend',()=>{const r=result(fixtures.find(f=>f.number===98&&f.variant==='CHN'));assert.match(r.fact,/漁獲と養殖を合わせた/);assert(!/魚が増|資源が回復|養殖が増/.test(r.fact));});
test('internet is utilization and refugee numbers are a year-end stock',()=>{const net=result(fixtures.find(f=>f.number===99&&f.variant==='JPN')),ref=result(fixtures.find(f=>f.number===100&&f.variant==='SYR'));assert.match(net.fact,/利用者.*人口に占める/);assert(!/回線|速度|通信量/.test(net.fact));assert.match(ref.fact,/出身国別.*年末人数/);assert(!/流出数|受入人数|気候変動が原因|紛争が原因/.test(ref.fact));});
test('zero source stock and production do not become safety or food access claims',()=>{for(const modeId of ['fisheries','refugees']){const r=livingEarthInsight({id:modeId,modeId,unit:'test'},[],{metrics:[['early',0],['late',0]],recordIds:[],details:{window:3,change:0,range:0,beyond:0}});assert.match(r.fact,/公表値.*ゼロ/);assert(!/安全|飢餓がない|避難がない/.test(r.fact));}});
test('opposite, stable and unavailable comparisons stay distinct for all five topics',()=>{
 for(const modeId of ['wateruse','hunger','fisheries','internet','refugees']){
  const ds={id:modeId,modeId,unit:'test'},base={recordIds:['a','b'],metrics:[['early',40],['late',30]],details:{window:3,change:-10,beyond:3,range:20}};
  const down=livingEarthInsight(ds,[],base),up=livingEarthInsight(ds,[],{...base,metrics:[['early',30],['late',40]],details:{...base.details,change:10}}),flat=livingEarthInsight(ds,[],{...base,metrics:[['early',30],['late',30]],details:{...base.details,change:0}});
  assert.notEqual(down.headline,up.headline);assert.notEqual(down.summary,up.summary);assert.notEqual(flat.summary,up.summary);assert.notEqual(flat.summary,down.summary);assert.equal(livingEarthInsight(ds,[],{...base,details:null}).factEvidence.values.supportedComparison,false);
 }
});
