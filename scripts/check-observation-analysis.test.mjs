import test from 'node:test';import assert from 'node:assert/strict';
import {snapshotObservationDataset,restoreObservationSnapshot} from '../statistics-observation-snapshot.js';
import {buildPlanetStatistics} from '../src/exploration/planet-statistics.js';
import {openObservationAnalysis} from '../src/exploration/observation-analysis.js';
const definition={id:'global-wind-pressure',number:'01',renderer:'wind',shortTitle:'風がつなぐ世界'};
const observation={sourceState:'LIVE',observedAt:'2026-10-25T03:00Z',points:[{id:'a',label:'地点A',windSpeed:2,windDirection:90,pressure:1000,lat:35,lon:138},{id:'b',label:'地点B',windSpeed:8,windDirection:180,pressure:1000,lat:36,lon:139}]};
test('only actual observations become analysis rows; generated reference values stay excluded',()=>{
 assert.equal(buildPlanetStatistics(definition,{...observation,sourceState:'SAVED VALUES'}),null);
 assert.equal(buildPlanetStatistics(definition,{...observation,points:[]}),null);
 const ds=buildPlanetStatistics(definition,observation);assert.deepEqual(ds.rows.map(r=>r.value),[2,8]);assert(ds.rows.every(r=>r.provenance==='SOURCE'));assert.equal(ds.insightContext.snapshotAnalysis,true);
});
test('saved realtime observations are independent of future responses and retain source metadata',()=>{
 const ds=buildPlanetStatistics(definition,observation),saved=snapshotObservationDataset(ds);assert(saved);
 ds.rows[0].value=99;assert.equal(saved.dataset.rows[0].value,2);
 const restored=restoreObservationSnapshot(saved,ds.id);assert.equal(restored.rows[0].value,2);assert.equal(restored.periodStart,observation.observedAt);
 restored.rows[0].value=7;assert.equal(saved.dataset.rows[0].value,2);
});
test('foreign IDs, bad versions, missing values and large snapshots are rejected',()=>{
 const ds=buildPlanetStatistics(definition,observation),saved=snapshotObservationDataset(ds);
 assert.equal(restoreObservationSnapshot(saved,'co2-trend'),null);assert.equal(restoreObservationSnapshot({...saved,schemaVersion:2},ds.id),null);
 for(const value of [null,NaN,Infinity])assert.equal(snapshotObservationDataset({...ds,rows:[{...ds.rows[0],value}]}),null);
 assert.equal(snapshotObservationDataset({...ds,modeId:'another-mode'}),null);
 assert.equal(snapshotObservationDataset({...ds,rows:[{...ds.rows[0],provenance:'IMPUTED'}]}),null);
 assert.equal(snapshotObservationDataset({...ds,notes:'x'.repeat(1_000_001)}),null);
});
test('a delayed lab load cannot reopen the previous exhibit',async()=>{
 const old={loader:globalThis.GaiaModeLoader,lab:globalThis.GaiaStatisticsLab,playback:globalThis.GaiaMapPlayback};
 let current=true,release,opened=0;
 try{
  globalThis.GaiaStatisticsLab=undefined;globalThis.GaiaModeLoader={load:()=>new Promise(resolve=>{release=resolve;})};globalThis.GaiaMapPlayback={stop:()=>{}};
  const pending=openObservationAnalysis(buildPlanetStatistics(definition,observation),()=>current);current=false;
  globalThis.GaiaStatisticsLab={open:async()=>{opened++;}};release();assert.equal(await pending,false);assert.equal(opened,0);
  current=true;assert.equal(await openObservationAnalysis(buildPlanetStatistics(definition,observation),()=>current),true);assert.equal(opened,1);
  assert.equal(await openObservationAnalysis(null,()=>true),false);
 }finally{globalThis.GaiaModeLoader=old.loader;globalThis.GaiaStatisticsLab=old.lab;globalThis.GaiaMapPlayback=old.playback;}
});
