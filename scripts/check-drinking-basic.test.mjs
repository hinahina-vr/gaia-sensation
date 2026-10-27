import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {drinkingDefinition,drinkingData,drinkingStatistics,drinkingAvailableMode,DRINKING_DEFAULT_MODE} from '../src/exploration/drinking-water.js';
import {atlasDefinition} from '../src/exploration/atlas-history-model.js';import {selectableCountryData} from '../src/exploration/country-selection.js';
const read=id=>JSON.parse(fs.readFileSync('data/atlas-history/'+id+'.json')),basic=read('drinking-basic'),comparison=read('drinking-basic-comparison'),safe=read('drinking'),d=atlasDefinition('drinking');
test('basic nationwide and paired histories match every archived official observation',()=>{
 const manifest=read('drinking-basic-sources'),raw={};for(const source of manifest.sources){const bytes=gunzipSync(fs.readFileSync(source.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);raw[source.file.split('/').at(-1).split('.')[0]]=JSON.parse(bytes)}
 for(const [key,data]of[['basic',basic],['urban',comparison],['rural',comparison]]){assert.equal(raw[key][0].lastupdated,data.sourceUpdated);const index=new Map(raw[key][1].map(r=>[r.countryiso3code+'/'+r.date,r.value]));for(const region of data.regions)for(const row of region.years){const value=index.get(region.id+'/'+row.year),expected=Number.isFinite(value)?Math.round(value*10000)/10000:null;assert.equal(key==='basic'?row.value:row[key],expected)}}
 assert.equal(basic.sourceUpdated,safe.sourceUpdated);
});
test('default basic indicator broadens coverage with a distinct meaning and source',()=>{
 assert.equal(DRINKING_DEFAULT_MODE,'basic');assert.equal(basic.regions.filter(r=>Number.isFinite(r.years.find(y=>y.year===2024).value)).length,202);
 assert.equal(safe.regions.filter(r=>Number.isFinite(r.years.find(y=>y.year===2024).value)).length,148);
 assert.match(drinkingDefinition(d,'basic').source,/BASW/);assert.match(drinkingDefinition(d,'national').source,/SMDW/);
 assert.match(drinkingDefinition(d,'basic').guide,/30分/);assert.match(drinkingDefinition(d,'basic').guide,/含みます/);
 assert.equal(basic.regions.find(r=>r.id==='CHN').years.find(y=>y.year===2024).value,96.1224);assert.equal(safe.regions.some(r=>r.id==='CHN'),false);
});
test('basic, safe and their gaps have distinct analysis IDs and never mix observations',()=>{
 const source=selectableCountryData(basic),region=source.regions.find(r=>r.id==='IND'),national=drinkingStatistics(d,source,comparison,region,'basic'),gap=drinkingStatistics(d,source,comparison,region,'basic-gap');
 assert.equal(national.id,'climate-drinking-IND-basic');assert.equal(gap.id,'climate-drinking-IND-basic-gap');assert.match(national.sourceUrl,/BASW/);assert.match(national.title,/基本/);
 assert.deepEqual(national.rows.map(r=>r.value),region.years.filter(r=>Number.isFinite(r.value)).map(r=>r.value));
 const expected=comparison.regions.find(r=>r.id==='IND').years.filter(r=>Number.isFinite(r.urban)&&Number.isFinite(r.rural)).map(r=>Math.round((r.urban-r.rural)*10000)/10000);assert.deepEqual(gap.rows.map(r=>r.value),expected);
 const safeComparison=read('drinking-comparison'),safeRegion=safe.regions.find(r=>r.id==='IND');assert.equal(drinkingStatistics(d,safe,safeComparison,safeRegion,'national').id,'climate-drinking-IND');assert.equal(drinkingStatistics(d,safe,safeComparison,safeRegion,'gap').id,'climate-drinking-IND-gap');
 assert.equal(drinkingData(source,comparison,'basic'),source);
});
test('unavailable paired data falls back within the selected service level',()=>{
 assert.equal(drinkingAvailableMode(comparison,'JPN',2024,'basic-gap'),'basic');assert.equal(drinkingAvailableMode(read('drinking-comparison'),'JPN',2024,'gap'),'national');
 const missing=selectableCountryData(safe).regions.find(r=>r.id==='CHN');assert(missing.years.every(r=>r.value===null));
});
