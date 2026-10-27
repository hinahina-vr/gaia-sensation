import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {centuryInsightFixtures} from './lib/century-insight-fixtures.mjs';
import {discoverData} from '../statistics-discovery.js';import {livingEarthInsight} from '../statistics-living-earth-context.js';
const fixtures=centuryInsightFixtures(),baseline=JSON.parse(fs.readFileSync('scripts/fixtures/insights91-95-numerical-20261027.json'));
const result=f=>discoverData({dataset:f.dataset,rows:f.dataset.rows}).computedInsight;
for(const f of fixtures)test(`${f.number} ${f.variant}: source-backed reading, unchanged analysis`,()=>{
 const before=JSON.stringify(f.dataset),r=result(f),old=baseline.find(b=>b.id===f.dataset.id).result;
 for(const key of ['metrics','recordIds','calculation','details','status'])assert.deepEqual(r[key],old[key],key);
 assert.equal(JSON.stringify(f.dataset),before);assert.equal(r.audience,'earth-context');assert.equal(r.futurePerspective.focus,'human-earth-co-creation-and-future');assert.equal(r.logic.inference,r.fact);assert.equal(r.logic.implication,r.summary);
 assert(!/収録|輪郭|必要があります|ではありません|選んだ地点の/.test(r.headline+r.fact+r.summary));assert(!/\d/.test(r.summary));assert(r.summary.length<230);
 if(f.number>=94){assert.match(r.fact,/記録件数/);assert(!/危険度.*高ま|活動が活発|発生頻度が増|安全にな/.test(r.fact+r.headline));}
});
test('five topics and every source region have real examples',()=>{assert.deepEqual([...new Set(fixtures.map(f=>f.number))],[91,92,93,94,95]);assert.equal(fixtures.filter(f=>f.number===91).length,3);});
test('ozone does not replace the measured comparison with a recovery success story',()=>{const r=result(fixtures.find(f=>f.number===92));assert(r.details.change>0);assert.match(r.headline,/平均面積が大きい/);assert(!/回復した|縮小している/.test(r.fact));});
test('glacier loss is the sampled cumulative index, not a global volume or local river estimate',()=>{const r=result(fixtures.find(f=>f.number===93));assert(r.metrics[0][1]<0&&r.metrics[1][1]<r.metrics[0][1]);assert.match(r.fact,/参照氷河.*損失/);assert(!/総質量|川の水量が減|全ての氷河/.test(r.fact));});
test('zero early and late event windows do not become a safety claim or erase intervening years',()=>{
 for(const f of fixtures.filter(f=>f.number>=94)){const r=result(f);if(r.metrics[0][1]===0&&r.metrics[1][1]===0){assert.match(r.fact,/初期・後期の両期間/);assert.match(r.fact,/ゼロ/);assert(!/全期間.*ゼロ|危険がない|安全な地域/.test(r.fact+r.summary));}}
});
test('each topic responds to opposite directions, stable values and insufficient comparisons',()=>{
 for(const modeId of ['oceanheat','ozone','glaciers','volcanoes','tsunamis']){
  const ds={id:modeId,modeId,unit:'test'},base={recordIds:['a','b'],metrics:[['early',4],['late',3]],details:{window:3,change:-1,beyond:3,range:2}};
  const down=livingEarthInsight(ds,[],base),up=livingEarthInsight(ds,[],{...base,metrics:[['early',3],['late',4]],details:{...base.details,change:1}}),flat=livingEarthInsight(ds,[],{...base,metrics:[['early',3],['late',3]],details:{...base.details,change:0}});
  assert.notEqual(down.headline,up.headline);assert.notEqual(down.summary,up.summary);assert.notEqual(flat.summary,up.summary);assert.notEqual(flat.summary,down.summary);assert.equal(livingEarthInsight(ds,[],{...base,details:null}).factEvidence.values.supportedComparison,false);
 }
});
