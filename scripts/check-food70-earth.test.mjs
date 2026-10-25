import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FOOD_EXHIBITS,buildFoodStatisticsDataset} from '../src/exploration/food-catalog.js';
import {foodBalanceEarthInsight,foodBalanceComparison} from '../statistics-food-context.js';
import {discoverData} from '../statistics-discovery.js';
import {buildDataInsight} from '../statistics-data-insights.js';
import {notApplicable} from '../statistics-lab-core.js';
const raw=JSON.parse(fs.readFileSync('data/fao-food-balances.json','utf8'));
const dataset=(country='392',series='2905')=>buildFoodStatisticsDataset(raw,FOOD_EXHIBITS[0],series,country);
test('70 turns supply structure into an Earth-focused insight',()=>{
 const ds=dataset(),r=discoverData({dataset:ds,rows:ds.rows}),c=r.computedInsight;
 assert.equal(c.audience,'earth-context');assert.match(r.headline,/日本の穀物.*海外からの供給/);assert.match(r.summary,/農地や水.*産地をたどり/);
 assert.match(c.fact,/読み取れます/);assert.match(r.summary,/目を向けてみよう/);
 assert.doesNotMatch(r.headline+c.fact+r.summary,/経営|調達|契約|在庫|指標です/);
 assert(Math.abs(c.details.latestValue-28.84148995709222)<1e-10);assert(Math.abs(c.details.netImportShare-71.15851004290778)<1e-10);
 assert(!/\d/.test(r.headline+c.fact+r.summary),'The summary contains no fine numerical values');assert.equal(r.findings.find(f=>f.kind==='meaning').title,'地球を考える視点');
});
test('disjoint MAFF records are not presented as a continuous 1960–2015 comparison',()=>{
 const ds=dataset(),r=foodBalanceEarthInsight(ds,ds.rows);
 assert.deepEqual(r.details.comparableYears,Array.from({length:10},(_,i)=>2014+i));
 assert.equal(r.details.baseline,'2014–2016年度');assert.equal(r.details.recent,'2021–2023年度');
 const early=ds.rows.filter(r=>r.year>=2014&&r.year<=2016),late=ds.rows.filter(r=>r.year>=2021);
 assert(Math.abs(r.details.change-(late.reduce((n,r)=>n+r.value,0)-early.reduce((n,r)=>n+r.value,0))/3)<1e-10);
 assert(!r.fact.includes('1960'));assert(!r.recordIds.includes('1960'));
});
test('net-exporting countries connect food producers and recipients',()=>{
 const ds=dataset('036'),r=foodBalanceEarthInsight(ds,ds.rows);
 assert.match(r.headline,/オーストラリア.*国境.*供給/);assert.match(r.summary,/農地や水.*暮らし/);assert(!r.headline.includes('純輸入'));
 assert.equal(r.metrics[1][2],'倍');assert(r.details.latestValue>300);assert.equal(r.details.source,'FBS');assert.equal(r.details.baseline,'2010–2013年');
});
test('a single record supports supply composition but never a fabricated trend',()=>{
 const ds=dataset(),r=foodBalanceEarthInsight(ds,ds.rows.filter(r=>r.year===2016));
 assert.equal(r.details.latestYear,2016);assert.equal(r.details.change,null);assert(!r.fact.includes('平均'));assert(!r.fact.includes('上昇'));assert(!r.fact.includes('低下'));
 const balanced=foodBalanceEarthInsight(ds,[{id:'a',year:2020,value:100,sourceSeries:'FBS'}]);
 assert.match(balanced.headline,/つり合/);assert.equal(balanced.details.netImportShare,0);
 const zero=foodBalanceEarthInsight(ds,[{id:'a',year:2020,value:0,sourceSeries:'FBS'}]);assert.equal(zero.details.netImportShare,100);
});
test('gaps, duplicate years, source changes and imputations cannot create an overstated comparison',()=>{
 const rows=[{id:'old',year:2000,value:99,sourceSeries:'A'},{id:'a',year:2020,value:30,sourceSeries:'B'},{id:'b',year:2021,value:31,sourceSeries:'B'},{id:'fake',year:2022,value:999,sourceSeries:'B',provenance:'IMPUTED'},{id:'last',year:2023,value:28,sourceSeries:'B'}];
 assert.equal(foodBalanceComparison(rows).comparison,null);
 assert.deepEqual(foodBalanceComparison(rows).run.map(r=>r.year),[2023]);
 assert.equal(foodBalanceComparison([{year:2020,value:null}]),null);
 const duplicate=[{id:'a',year:2020,value:20,sourceSeries:'B'},{id:'b',year:2020,value:30,sourceSeries:'B'}];assert.equal(foodBalanceComparison(duplicate).comparison,null);
});
test('all nine commodities keep their actual names and latest values',()=>{
 for(const series of raw.series){const ds=dataset('392',series.id),r=foodBalanceEarthInsight(ds,ds.rows);assert(r.headline.includes(series.label));assert.equal(r.details.latestValue,ds.rows.at(-1).value);assert(!/NaN|undefined|Infinity/.test(JSON.stringify(r)));}
});
test('71 and unavailable statistical methods retain their existing treatment',()=>{
 const fsRaw=JSON.parse(fs.readFileSync('data/fao-food-security.json','utf8')),ds=buildFoodStatisticsDataset(fsRaw,FOOD_EXHIBITS[1],'21035','392'),r=discoverData({dataset:ds,rows:ds.rows});
 assert.notEqual(r.computedInsight.audience,'earth-context');assert.match(r.summary,/穀物輸入依存度/);
 const d=dataset();assert.match(buildDataInsight({dataset:d,rows:[],methodId:'paired',result:notApplicable('条件不足')}).headline,/答えは出せません/);
});
