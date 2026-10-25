import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {windLatitudeFinding} from '../statistics-wind-context.js';
import {buildPlanetStatistics} from '../src/exploration/planet-statistics.js';
import {discoverData} from '../statistics-discovery.js';
const observation=JSON.parse(fs.readFileSync('scripts/fixtures/wind01-model-field-20261025.json','utf8'));
const dataset=buildPlanetStatistics({renderer:'wind',id:'global-wind-pressure',number:'01',shortTitle:'風がつなぐ世界'},observation);
test('captured real model field supports the displayed finding and original record IDs',()=>{
 const r=discoverData({dataset,rows:dataset.rows});assert.equal(r.primaryId,'wind-latitude-pattern');const w=r.computedInsight,b=w.interpretationBasis;
 assert.equal(b.tropical.count,120);assert.equal(b.tropical.westCount,84);assert.equal(b.southMidlatitude.count,44);assert.equal(b.southMidlatitude.eastCount,34);
 assert(Math.abs(b.tropical.meanSpeed-5.3205)<1e-10);assert(Math.abs(b.southMidlatitude.meanSpeed-8.267272727272728)<1e-10);
 assert(w.recordIds.every(id=>dataset.rows.some(r=>r.id===id)));assert.equal(r.candidates[0].chart.xLabel,'緯度（南緯−／北緯＋）');assert.equal(r.candidates[0].chart.pairs.length,240);
 assert.match(w.logic.evidence,/緯度帯.*風向/);for(const term of ['風上','排出','協力','暮ら'])assert(w.summary.includes(term));assert(!/気圧差|原因|熱を運|経路/.test(w.summary));assert(!/\d/.test(w.fact+w.summary));
});
test('direction reversal removes the claim rather than retaining a canned explanation',()=>{
 const changed=dataset.rows.map(r=>({...r,windDirection:90}));assert.equal(windLatitudeFinding(changed),null);
 const r=discoverData({dataset,rows:changed});assert.notEqual(r.primaryId,'wind-latitude-pattern');assert(!r.summary.includes('南の中緯度をより強く東へ'));
});
test('equal speed keeps the directional finding but removes the stronger-wind interpretation',()=>{
 const changed=dataset.rows.map(r=>({...r,value:8,y:8}));const r=windLatitudeFinding(changed);assert(r);assert.equal(r.interpretationBasis.stronger,false);assert(!r.fact.includes('平均も'));assert(r.logic.implication);
});
test('local, sparse, missing-direction and calm selections cannot establish a global belt',()=>{
 for(const rows of [dataset.rows.slice(0,10),dataset.rows.filter(r=>r.lon>=0&&r.lon<=30),dataset.rows.map(r=>({...r,windDirection:null})),dataset.rows.map(r=>({...r,value:0}))])assert.equal(windLatitudeFinding(rows),null);
});
