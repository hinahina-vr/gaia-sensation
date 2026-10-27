const originalHashes=JSON.parse(fs.readFileSync(new URL('./fixtures/atlas91-100-preserved-hashes.json',import.meta.url))).files;
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {ATLAS_CENTURY_EXHIBITS as ALL_CENTURY_EXHIBITS,centuryDetail} from '../src/exploration/atlas-century-model.js';
import {atlasStatistics,atlasRow} from '../src/exploration/atlas-history-model.js';
const ATLAS_CENTURY_EXHIBITS=ALL_CENTURY_EXHIBITS.filter(d=>Number(d.number)<=95);
const ids=['oceanheat','ozone','glaciers','volcanoes','tsunamis'];
test('preserve 91–95, with an independent measurement for each',()=>{assert.deepEqual(ATLAS_CENTURY_EXHIBITS.map(d=>d.id),ids);assert.deepEqual(ATLAS_CENTURY_EXHIBITS.map(d=>Number(d.number)),[91,92,93,94,95]);assert.equal(new Set(ATLAS_CENTURY_EXHIBITS.map(d=>d.view)).size,4);});
for(const definition of ATLAS_CENTURY_EXHIBITS)test(`${definition.number}: preserved source values and statistics across every region`,()=>{
 const file=`data/atlas-history/${definition.id}.json`,bytes=fs.readFileSync(file),original=originalHashes[file];assert.equal(createHash('sha256').update(bytes).digest('hex'),original);
 const data=JSON.parse(bytes);for(const region of data.regions){const ds=atlasStatistics(definition,data,region);assert.deepEqual(ds.rows.map(r=>r.value),region.years.filter(r=>Number.isFinite(r.value)).map(r=>r.value));}
 if(definition.view==='events')assert(data.events.every(e=>e.year>=1980&&e.year<=2024));
});
test('ozone missing year remains missing; basin layers and glacier units retain their meaning',()=>{
 const ozone=JSON.parse(fs.readFileSync('data/atlas-history/ozone.json'));assert.equal(atlasRow(ozone.regions[0],1995).value,null);
 const heat=JSON.parse(fs.readFileSync('data/atlas-history/oceanheat.json'));for(const r of heat.regions)for(const y of r.years)assert(Math.abs(y.value-y.upper-y.deep)<1e-8);
 assert.match(centuryDetail(ATLAS_CENTURY_EXHIBITS[2],{annual:-1,count:35},String),/m水当量/);
});
test('local introductions include correct source credits and exclude 101',()=>{
 const c=vm.createContext({location:{hostname:'localhost'},GaiaI18n:{register(){}},document:{}});vm.runInContext(fs.readFileSync('src/exploration/map-data-intro-catalog.js','utf8'),c);
 for(const d of ATLAS_CENTURY_EXHIBITS){const entry=c.GaiaMapDataIntro.entries[d.number];assert(entry.subject&&entry.reading);assert.match(entry.source,/NOAA|NASA|WGMS/);}
 assert.equal(c.GaiaMapDataIntro.entries['101'],undefined);
});
