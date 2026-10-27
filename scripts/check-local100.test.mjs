const originalHashes=JSON.parse(fs.readFileSync(new URL('./fixtures/atlas91-100-preserved-hashes.json',import.meta.url))).files;
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {ATLAS_CENTURY_EXHIBITS,centuryValue} from '../src/exploration/atlas-century-model.js';
import {atlasStatistics} from '../src/exploration/atlas-history-model.js';
import {centuryCountryGlyph} from '../src/exploration/local-atlas100.js';
const definitions=ATLAS_CENTURY_EXHIBITS.filter(d=>Number(d.number)>=96);
test('96–100 are five distinct measurements with unchanged preserved data',()=>{
 assert.deepEqual(definitions.map(d=>Number(d.number)),[96,97,98,99,100]);
 for(const d of definitions){const file=`data/atlas-history/${d.id}.json`;assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),originalHashes[file]);}
});
for(const d of definitions)test(`${d.number}: all regions retain original finite, uncensored statistics`,()=>{
 const data=JSON.parse(fs.readFileSync(`data/atlas-history/${d.id}.json`));for(const r of data.regions){const ds=atlasStatistics(d,data,r);assert.deepEqual(ds.rows.map(r=>r.value),r.years.filter(y=>Number.isFinite(y.value)&&!y.censored&&!y.invalidComposition).map(y=>y.value));}
});
test('censored hunger and invalid water composition keep their meaning',()=>{
 const hunger=definitions.find(d=>d.id==='hunger'),water=definitions.find(d=>d.id==='wateruse');assert.equal(centuryValue(hunger,{value:2.5,censored:true},String),'2.5%以下');assert.equal(centuryCountryGlyph(hunger,{value:2.5,censored:true}).extras[0],1);
 assert.equal(centuryCountryGlyph(water,{value:70,agriculture:70,industry:50,domestic:10,invalidComposition:true}),null);assert.equal(centuryValue(water,{value:70,invalidComposition:true},String),'内訳の整合未確認');
});
test('glyphs use original components and one common fisheries scale without inventing missing values',()=>{
 const water=definitions[0],fish=definitions[2];assert.deepEqual(centuryCountryGlyph(water,{value:70,agriculture:70,industry:20,domestic:10}).extras,[.7,.2,.1,0]);assert.deepEqual(centuryCountryGlyph(fish,{value:50,capture:20,aquaculture:30},100).extras,[.2,.3,0,0]);
 for(const d of definitions)for(const value of [null,undefined,NaN])assert.equal(centuryCountryGlyph(d,{value}),null);
});
