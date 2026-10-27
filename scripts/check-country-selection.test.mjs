import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SELECTABLE_COUNTRIES,selectionCountryId,selectableCountryData} from '../src/exploration/country-selection.js';
import {atlasDefinition,atlasStatistics} from '../src/exploration/atlas-history-model.js';
import {drinkingData,drinkingStatistics} from '../src/exploration/drinking-water.js';
import {sanitationData,sanitationStatistics} from '../src/exploration/sanitation-services.js';
const read=name=>JSON.parse(fs.readFileSync('data/atlas-history/'+name+'.json'));
test('all bundled country geometries retain their own selectable identity and name',()=>{
 const features=JSON.parse(fs.readFileSync('data/natural-earth-50m-countries.geojson')).features;
 const byGeometry=new Map(SELECTABLE_COUNTRIES.map(c=>[c.iso3,c]));assert.equal(SELECTABLE_COUNTRIES.length,242);
 for(const {properties:p}of features){const iso3=[p.ADM0_A3,p.ISO_A3,p.SOV_A3,p.BRK_A3,p.WB_A3].find(v=>typeof v==='string'&&/^[A-Z]{3}$/.test(v));assert(byGeometry.has(iso3));const c=byGeometry.get(iso3);assert.equal(c.id,selectionCountryId(iso3));assert(c.name.length>0);assert(Number.isFinite(c.lon)&&Number.isFinite(c.lat))}
 assert.equal(selectionCountryId('PSX'),'PSE');assert.equal(selectionCountryId('SDS'),'SSD');assert.equal(selectionCountryId('KOS'),'XKX');assert.equal(selectionCountryId('SOL'),'SOL');
});
test('missing countries become selectable without changing source observations',()=>{
 for(const kind of ['drinking','sanitation']){
  const data=read(kind),serialized=JSON.stringify(data),expanded=selectableCountryData(data);assert.equal(selectableCountryData(data),expanded);
  for(const source of data.regions)assert.equal(expanded.regions.find(r=>r.id===source.id),source);
  const missing=expanded.regions.filter(r=>r.missingSource);assert(missing.length>0);
  for(const region of missing){assert.equal(region.years.length,25);assert(region.years.every(r=>r.value===null));assert(!data.regions.some(r=>r.id===region.id))}
  assert.equal(JSON.stringify(data),serialized);
 }
});
test('missing primary data produces empty source analysis, not zero-valued observations',()=>{
 for(const [kind,id]of[['drinking','CHN'],['sanitation','IRN']]){const data=selectableCountryData(read(kind)),region=data.regions.find(r=>r.id===id),result=atlasStatistics(atlasDefinition(kind),data,region);assert.equal(region.missingSource,true);assert.equal(result.rows.length,0);assert.equal(result.missingCount,25)}
});
test('valid zero and secondary measurements are retained for countries without primary data',()=>{
 const source={period:[2000,2001],regions:[]},expanded=selectableCountryData(source),region=expanded.regions.find(r=>r.id==='CHN');
 const comparison={regions:[{id:'CHN',years:[{year:2000,urban:0,rural:0},{year:2001,urban:70,rural:50}]}]};
 const gap=drinkingData(expanded,comparison,'gap').regions.find(r=>r.id==='CHN');assert.deepEqual(gap.years.map(r=>r.value),[0,20]);assert.equal(drinkingStatistics(atlasDefinition('drinking'),expanded,comparison,region,'gap').rows.length,2);
 const services={method:'fixture',regions:[{id:'CHN',years:[{year:2000,basic:90,open:0},{year:2001,basic:80,open:5}]}]};
 const open=sanitationData(expanded,services,'open').regions.find(r=>r.id==='CHN');assert.deepEqual(open.years.map(r=>r.value),[0,5]);assert.equal(sanitationStatistics(atlasDefinition('sanitation'),expanded,services,region,'open').rows.length,2);assert.equal(region.years[0].value,null);
});
