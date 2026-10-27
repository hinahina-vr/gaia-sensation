import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {lateExpansionInsightFixtures} from './lib/late-expansion-insight-fixtures.mjs';
import {discoverData} from '../statistics-discovery.js';
import {livingEarthInsight} from '../statistics-living-earth-context.js';
const fixtures=lateExpansionInsightFixtures(),baseline=JSON.parse(fs.readFileSync('scripts/fixtures/insights86-90-numerical-20261027.json'));
const result=f=>discoverData({dataset:f.dataset,rows:f.dataset.rows}).computedInsight;
for(const f of fixtures)test(`${f.number} ${f.variant}: grounded reading, unchanged numerical analysis`,()=>{
 const before=JSON.stringify(f.dataset),r=result(f),old=baseline.find(b=>b.id===f.dataset.id).result;
 for(const key of ['metrics','recordIds','calculation','details','status'])assert.deepEqual(r[key],old[key],key);
 assert.equal(JSON.stringify(f.dataset),before);assert.equal(r.audience,'earth-context');assert.equal(r.futurePerspective.focus,'human-earth-co-creation-and-future');
 assert.equal(r.logic.inference,r.fact);assert.equal(r.logic.implication,r.summary);
 assert(!/収録|輪郭|必要があります|ではありません|選んだ地点の/.test(r.headline+r.fact+r.summary));assert(!/\d/.test(r.summary));assert(r.summary.length<230);
 if(f.number>=89){assert(r.fact.includes(f.dataset.title.match(/\d+月/)[0]));assert(!/氷の厚さが|降雪量が|積雪量が/.test(r.fact));}
});
test('five topics, both poles and every month in all three snow regions',()=>{
 assert.deepEqual([...new Set(fixtures.map(f=>f.number))],[86,87,88,89,90]);
 assert.equal(fixtures.filter(f=>f.number===89).length,24);assert.equal(fixtures.filter(f=>f.number===90).length,36);
});
test('opposite, stable and unavailable comparisons remain distinct for each topic',()=>{
 for(const modeId of ['urban','ageing','childsurvival','seaice','snowcover']){
  const ds={id:modeId,modeId,unit:'%',title:'試験 · 9月'},base={recordIds:['a','b'],metrics:[['early',40],['late',30]],details:{window:3,change:-10,beyond:3,range:20}};
  const down=livingEarthInsight(ds,[],base),up=livingEarthInsight(ds,[],{...base,metrics:[['early',30],['late',40]],details:{...base.details,change:10}}),flat=livingEarthInsight(ds,[],{...base,metrics:[['early',30],['late',30]],details:{...base.details,change:0}});
  assert.notEqual(down.headline,up.headline);assert.notEqual(down.summary,up.summary);assert.notEqual(flat.summary,up.summary);assert.notEqual(flat.summary,down.summary);
  assert.equal(livingEarthInsight(ds,[],{...base,details:null}).factEvidence.values.supportedComparison,false);
 }
});
test('urban majority crossing is supported by the existing averages',()=>{const r=result(fixtures.find(f=>f.number===86&&f.variant==='CHN'));assert(r.metrics[0][1]<50&&r.metrics[1][1]>50);assert.match(r.fact,/半数未満.*過半/);});
test('child survival reads mortality risk, not births or the count of deaths',()=>{const r=result(fixtures.find(f=>f.number===88&&f.variant==='IND'));assert(r.details.change<0);assert.match(r.headline,/リスク.*下が/);assert.match(r.fact,/確率の推計値/);assert(!/出生数|死亡者数|寿命が/.test(r.fact));});
