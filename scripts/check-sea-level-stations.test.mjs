import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readZipMembers,parseAnnual,buildTideStations} from './lib/psmsl-source.mjs';
import {decodeTides,tideStatistics,tideReason,tideColor} from '../src/exploration/sea-level-stations.js';
const payload=JSON.parse(fs.readFileSync('data/atlas-history/sealevel-stations.json'));
const data=decodeTides(payload);
test('Delivered coastal snapshot is bounded and has stable IDs, coordinates and baseline',()=>{
  assert.equal(data.regions.length,492);assert.equal(new Set(data.regions.map(r=>r.id)).size,492);
  for(const station of data.regions){assert.equal(station.id,`tide-${station.stationId}`);assert.equal(station.years[0].value,0);assert.equal(station.years.length,32);}
  assert(fs.statSync('data/atlas-history/sealevel-stations.json').size<200000);
});
test('All delivered coastal records match the archived PSMSL source',{skip:!fs.existsSync('artifacts/sea-level-sources-20261022/rlr_annual.zip')},()=>{
  const zip=fs.readFileSync('artifacts/sea-level-sources-20261022/rlr_annual.zip');
  assert.equal(createHash('sha256').update(zip).digest('hex'),payload.source.sha256);
  const original=buildTideStations(readZipMembers(zip));
  assert.equal(data.regions.length,492);
  for(const station of data.regions){
    const source=original.find(r=>r.id===station.id);
    for(const key of ['stationId','name','lat','lon','baseline1993'])assert.equal(station[key],source[key]);
    assert.deepEqual(station.years,source.years);assert.equal(station.years[0].value,0);
  }
  assert(fs.statSync('data/atlas-history/sealevel-stations.json').size<200000);
});
test('Missing, incomplete and flagged annual observations stay out of comparisons',()=>{
  const rows=parseAnnual('1993;7000;N;000\n1994;-99999;N;000\n1995;7200;Y;000\n1996;7300;N;001\n1997;7100;N;010');
  assert.deepEqual(rows.map(r=>r.usable),[true,false,false,false,false]);
  const station=data.regions.find(r=>r.id==='tide-134');
  assert.equal(station.years.find(r=>r.year===2016).value,184);
  assert.equal(station.years.find(r=>r.year===2024).value,204);
  assert.equal(station.years.find(r=>r.year===2023).value,null);
  assert.match(tideReason(station.years.find(r=>r.year===2023)),/欠日/);
});
test('Statistics preserve station identity, source and genuine missing years',()=>{
  const station=data.regions.find(r=>r.id==='tide-134'),stats=tideStatistics(data,station);
  assert.equal(stats.id,'climate-sealevel-tide-134');
  assert(stats.sourceUrl.endsWith('/134.php'));
  assert.equal(stats.rows.length+stats.missingCount,32);
  assert(!stats.rows.some(r=>r.year===2023));
  assert.match(stats.comparisonNote,/地盤/);
  assert.equal(tideStatistics(data,null),null);
});
test('Signed colors clamp visually, not numerically; invalid data is rejected',()=>{
  assert.notEqual(tideColor(200),tideColor(-200));
  assert.equal(tideColor(300),tideColor(500));
  assert.equal(tideColor(null),'#778c98');
  assert.throws(()=>decodeTides({...payload,regions:[{...payload.regions[0],lat:100}]}));
  assert.throws(()=>decodeTides({...payload,regions:[{...payload.regions[0],values:[0]}]}));
  assert.throws(()=>readZipMembers(Buffer.alloc(70000)),/Missing ZIP directory/);
  assert.throws(()=>readZipMembers(Buffer.alloc(10)),/Missing ZIP directory/);
});
