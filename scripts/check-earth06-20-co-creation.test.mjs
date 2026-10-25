import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {discoverData,analyzeDiscovery} from '../statistics-discovery.js';
import {mapCoCreationInsight} from '../statistics-map-co-creation.js';
import {buildDatasets,buildAnnualDataset} from '../statistics-datasets.js';
import {buildLiveStatistics} from '../src/exploration/live-statistics.js';import {LIVE_EXHIBITS} from '../src/exploration/live-exhibit-catalog.js';
import {snapshotObservationDataset,restoreObservationSnapshot} from '../statistics-observation-snapshot.js';
const snapshot=JSON.parse(fs.readFileSync('data/gaia-signals.json')),field=JSON.parse(fs.readFileSync('data/live-prefecture-fallback-v1.json'));
const ds=[...buildDatasets(snapshot,{recyclingTrend:JSON.parse(fs.readFileSync('data/recycling-trends.json'))}),...LIVE_EXHIBITS.map(e=>buildLiveStatistics(e,null,null,field))];
const rows=xs=>xs.map((value,i)=>({id:String(i),label:'土地'+i,value,x:2000+i,y:value,provenance:'SOURCE'}));
const measured={headline:'original',summary:'original',metrics:[['Original',3,'unit']],recordIds:['a','b'],status:'computed',calculation:'original'};
for(const d of ds.filter(d=>!['wind-climate','pollination'].includes(d.id)))test(d.id+' retains numerical analysis and links its actual finding to co-creation',()=>{
 const r=discoverData({dataset:d,rows:d.rows}),c=r.computedInsight;assert.equal(c.audience,'earth-context');assert.equal(c.futurePerspective.focus,'human-earth-co-creation-and-future');assert(c.logic.evidence&&c.logic.inference&&c.logic.implication&&c.logic.limits);assert(!/必要があります|輪郭|ではありません/.test(c.summary));
 assert(c.recordIds.every(id=>d.rows.some(row=>String(row.id)===id)));assert(c.fact&&c.summary&&c.headline);assert(!/[0-9]/.test(c.fact+c.summary));
});
test('CO2 copy reverses with the measured temporal change rather than reciting permanent warming',()=>{
 const dataset={id:'co2-trend',xKind:'year',unit:'ppm'};
 const up=discoverData({dataset,rows:rows([300,310,320,330,340,350])}).computedInsight,down=discoverData({dataset,rows:rows([350,340,330,320,310,300])}).computedInsight;
 assert.match(up.headline,/高い|越えている/);assert.match(down.headline,/下が/);assert.notEqual(up.summary,down.summary);assert(up.details.change>0&&down.details.change<0);
});
test('a flat or missing selection cannot keep a difference/concentration headline',()=>{
 for(const id of ['rainfall','waste','emissions-urban','forest-urban','renewables','population',...LIVE_EXHIBITS.filter(e=>e.key!=='weatherPrecipitation').map(e=>'live-'+e.id)]){
  const c=mapCoCreationInsight({id},{},rows([2,2,2]),measured);if(['emissions-urban','forest-urban','renewables','population'].includes(id))assert.match(c.headline,/違いが表れていない/);else assert.equal(c.status,'insufficient');
  const missing=mapCoCreationInsight({id},{},[],{...measured,status:'insufficient'});assert.equal(missing.status,'insufficient');assert.match(missing.fact,/記録がありません/);
 }
});
test('matched forest and power readings require a real selected comparison',()=>{
 for(const id of ['forest-urban','renewables']){
  const d=ds.find(d=>d.id===id),actual=discoverData({dataset:d,rows:d.rows});assert.equal(actual.primaryId,'near-peers');assert.match(actual.computedInsight.fact,/近くても/);
  const unpaired=mapCoCreationInsight(d,{id:'different-contexts'},d.rows,measured);assert(!unpaired.fact.includes('近くても'));
 }
});
test('point-only rain data is not dressed up as a temporal trend',()=>{const c=mapCoCreationInsight({id:'live-rain-chorus'},{},rows([0,.4,0]),measured);assert.equal(c.status,'insufficient');assert(!c.fact.includes('降水のある'));});

test('live comparisons snapshot actual model values independently of later provider updates',()=>{
 for(const e of LIVE_EXHIBITS){const d=buildLiveStatistics(e,null,null,field),saved=snapshotObservationDataset(d);assert(saved);const value=d.rows[0].value;d.rows[0].value+=500;const restored=restoreObservationSnapshot(saved,d.id);assert.equal(restored.rows[0].value,value);assert.equal(restored.periodStart,d.periodStart);assert.equal(restored.insightContext.snapshotAnalysis,true);assert.equal(restoreObservationSnapshot(saved,'live-some-other-mode'),null);}
 const f=structuredClone(field);for(const frame of f.weather.history)delete frame.points[0].measurements.weatherWindSpeed;const partial=buildLiveStatistics(LIVE_EXHIBITS[0],null,null,f);assert.equal(partial.trendContext.siteIds.length,46);assert.equal(partial.rows.length,24);assert.equal(partial.coverage.missingCount,1);assert.equal(buildLiveStatistics(LIVE_EXHIBITS[0],null,null,{}),null);
});
test('original measured fields are passed through by identity, including scenario and limits',()=>{
 const d=ds.find(d=>d.id==='forest-urban'),m={...measured,details:{upperTailCount:1},scenario:{test:true}};const c=mapCoCreationInsight(d,{},d.rows,m);for(const k of ['metrics','recordIds','calculation','details','scenario','status'])assert.equal(c[k],m[k]);
});
test('population and emission year filters keep the requested year and original totals',()=>{
 for(const mode of ['population-tide','anthropocene-scar'])for(const position of [0,30,100]){const d=buildAnnualDataset(snapshot,mode,position),r=analyzeDiscovery({dataset:d,rows:d.rows});assert(d.rows.every(row=>String(row.year)===d.periodStart));assert(Math.abs(r.stats.mean*d.rows.length-d.rows.reduce((sum,row)=>sum+row.value,0))<Math.max(1,Math.abs(r.stats.mean*d.rows.length))*1e-12);}
});
