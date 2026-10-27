import test from 'node:test';import assert from 'node:assert/strict';
import {livingEarthFixtures} from './lib/living-earth-fixtures.mjs';
import {discoverData} from '../statistics-discovery.js';
import {livingEarthInsight} from '../statistics-living-earth-context.js';
const fixtures=livingEarthFixtures();
for(const f of fixtures)test(`${f.number} ${f.variant}: real source, existing evidence and meaningful reading`,()=>{
 const r=discoverData({dataset:f.dataset,rows:f.dataset.rows}).computedInsight;
 assert.equal(r.audience,'earth-context');assert.equal(r.futurePerspective?.focus,'human-earth-co-creation-and-future');
 assert(r.fact&&r.summary);assert(!/収録|輪郭|必要があります|ではありません|選んだ地点の/.test(r.headline+r.fact+r.summary));
 assert(r.summary.length<230);assert(!/\d/.test(r.summary));
 assert.deepEqual(r.logic.inference,r.fact);assert.deepEqual(r.factEvidence.recordIds,r.recordIds);
 const rerender=livingEarthInsight(f.dataset,f.dataset.rows,r);for(const k of ['metrics','recordIds','calculation','details','status'])assert.deepEqual(rerender[k],r[k]);
});
test('all six exhibits and service variants are covered',()=>{assert.deepEqual([...new Set(fixtures.map(f=>f.number))],[75,76,77,80,78,79]);for(const mode of ['basic','basic-gap','national','gap'])assert(fixtures.some(f=>f.number===78&&f.variant.endsWith('-'+mode)));});
test('opposite trends, missing comparison and service definitions change the interpretation',()=>{
 const ds={id:'climate-foresthistory-test',modeId:'foresthistory',unit:'%',comparisonNote:''},base={metrics:[['a',40],['b',50]],details:{change:10,window:4,beyond:4,range:20},recordIds:['a','b'],calculation:'existing'};
 assert.match(livingEarthInsight(ds,[],base).summary,/増えた/);assert.match(livingEarthInsight(ds,[],{...base,details:{...base.details,change:-10}}).summary,/減少/);
 assert.equal(livingEarthInsight(ds,[],{...base,details:null}).factEvidence.values.supportedComparison,false);
 assert.equal(livingEarthInsight({...ds,modeId:'unknown'},[],base),null);
});
test('zero outdoor defecation is not described as a remaining access problem',()=>{
 const f=fixtures.find(f=>f.number===79&&f.variant==='JPN-open'),r=discoverData({dataset:f.dataset,rows:f.dataset.rows}).computedInsight;
 assert.match(r.headline,/ほぼゼロ/);assert(!r.summary.includes('屋外排泄が続く場所'));
});
