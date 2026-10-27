import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {expansionInsightFixtures} from './lib/expansion-insight-fixtures.mjs';
import {discoverData} from '../statistics-discovery.js';
import {livingEarthInsight} from '../statistics-living-earth-context.js';
const fixtures=expansionInsightFixtures(),baseline=JSON.parse(fs.readFileSync('scripts/fixtures/insights81-85-numerical-20261027.json'));
for(const f of fixtures)test(`${f.number} ${f.variant}: source-backed fact and co-creation insight, unchanged analysis`,()=>{
 const before=JSON.stringify(f.dataset),r=discoverData({dataset:f.dataset,rows:f.dataset.rows}).computedInsight,old=baseline.find(b=>b.id===f.dataset.id).result;
 for(const key of ['metrics','recordIds','calculation','details','status'])assert.deepEqual(r[key],old[key],key);
 assert.equal(JSON.stringify(f.dataset),before);assert.equal(r.audience,'earth-context');assert.equal(r.futurePerspective.focus,'human-earth-co-creation-and-future');
 assert.equal(r.logic.inference,r.fact);assert.equal(r.logic.implication,r.summary);assert(!/収録|輪郭|必要があります|ではありません|選んだ地点の/.test(r.headline+r.fact+r.summary));assert(!/\d/.test(r.summary));assert(r.summary.length<230);
});
test('all five topics and both cropland modes are covered',()=>{assert.deepEqual([...new Set(fixtures.map(f=>f.number))],[81,82,83,84,85]);assert(fixtures.some(f=>f.number===82&&f.variant.endsWith('-change')));assert(fixtures.some(f=>f.number===82&&f.variant.endsWith('-share')));});
test('existing high stress comparison describes the excess, not an invented cause',()=>{const f=fixtures.find(f=>f.number===81&&f.variant==='EGY-default'),r=discoverData({dataset:f.dataset,rows:f.dataset.rows}).computedInsight;assert(r.metrics[0][1]>100&&r.metrics[1][1]>r.metrics[0][1]);assert.match(r.fact,/超過が大きく/);assert(!/地下水が枯れ|干ばつが原因|取水量.*増え/.test(r.fact));});
test('opposite changes and missing comparisons do not inherit an improvement claim',()=>{
 for(const modeId of ['waterstress','cropland','yield','fertilizer','longevity']){
  const ds={id:modeId,modeId,unit:'%',comparisonNote:''},base={recordIds:['a','b'],metrics:[['early',40],['late',30]],details:{window:3,change:-10,beyond:3,range:20}};
  const down=livingEarthInsight(ds,[],base),up=livingEarthInsight(ds,[],{...base,metrics:[['early',30],['late',40]],details:{...base.details,change:10}});
  assert.notEqual(down.headline,up.headline);assert.notEqual(down.summary,up.summary);assert.equal(livingEarthInsight(ds,[],{...base,details:null}).factEvidence.values.supportedComparison,false);
 }
});
