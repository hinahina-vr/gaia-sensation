import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {atlasDefinition,atlasStatistics} from '../src/exploration/atlas-history-model.js';
import {electricityCountryNames,electricityData,electricityComparison,electricityStatistics} from '../src/exploration/electricity-access.js';
const read=p=>JSON.parse(fs.readFileSync(p)),data=read('data/atlas-history/electricity.json'),comparison=read('data/atlas-history/electricity-comparison.json'),d=atlasDefinition('electricity');
test('official regional rates match every original WDI row and source hash',()=>{
  for(const s of comparison.sources)assert.equal(createHash('sha256').update(fs.readFileSync(`artifacts/atlas-history-sources-20261022/${s.file}`)).digest('hex'),s.sha256);
  const raw=read('artifacts/atlas-history-sources-20261022/electricity.json');assert.equal(data.sourceUpdated,comparison.sourceUpdated);assert.equal(comparison.sourceUpdated,raw[0].lastupdated);
  const rows=new Map(raw[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
  for(const region of comparison.regions)for(const r of region.years){const original=rows.get(`${region.id}/${r.year}`);assert.equal(r.value,Number.isFinite(original)?Math.round(original*1e4)/1e4:null);}
  assert(fs.statSync('data/atlas-history/electricity-comparison.json').size<16000);
});
test('all countries use the source region classification, never a geographic guess',()=>{
  const catalog=read('artifacts/atlas-history-sources-20261022/countries.json')[1];
  for(const r of data.regions){assert.equal(comparison.countryRegions[r.id],catalog.find(c=>c.id===r.id).region.id);assert(electricityComparison(comparison,r,2016).group);}
});
test('change is exact percentage points, leaves original intact and preserves missing data',()=>{
  const before=JSON.stringify(data),change=electricityData(data,'change');assert.equal(change,electricityData(data,'change'));assert.equal(electricityData(data,'access'),data);
  for(const [i,r]of data.regions.entries())for(const [j,row]of r.years.entries()){
    const b=r.years.find(y=>y.year===2000)?.value,expected=Number.isFinite(b)&&Number.isFinite(row.value)?Math.round((row.value-b)*1e4)/1e4:null;assert.equal(change.regions[i].years[j].value,expected);
  }assert.equal(JSON.stringify(data),before);
  const sample={regions:[{id:'X',years:[{year:2000,value:null},{year:2001,value:50}]},{id:'Y',years:[{year:2000,value:90},{year:2001,value:80},{year:2002,value:null}]}]};
  assert.deepEqual(electricityData(sample,'change').regions.map(r=>r.years.map(y=>y.value)),[[null,null],[0,-10,null]]);
});
test('Kenya comparison uses official Sub-Saharan aggregate, not national mean',()=>{
  const kenya=data.regions.find(r=>r.id==='KEN'),result=electricityComparison(comparison,kenya,2016);
  assert.equal(result.value,53.1);assert.equal(result.base,15.2);assert.equal(result.regional,43.8283);assert.equal(result.group.id,'SSF');
});
test('statistics preserve old IDs and mark change datasets as derived',()=>{
  const r=data.regions.find(r=>r.id==='KEN');assert.deepEqual(electricityStatistics(d,data,r,'access'),atlasStatistics(d,data,r));
  const stats=electricityStatistics(d,data,r,'change');assert.equal(stats.id,'climate-electricity-KEN-change');assert.equal(stats.unit,'ポイント');assert(stats.rows.every(r=>r.provenance==='DERIVED'));assert.equal(stats.rows.find(r=>r.year===2016).value,37.9);assert.equal(electricityStatistics(d,data,null,'change'),null);
});
test('Channel Islands is readable without changing its identity or observations',()=>{
  const original=data.regions.find(r=>r.id==='CHI'),named=electricityCountryNames(data).regions.find(r=>r.id==='CHI');assert.equal(named.name,'チャネル諸島');assert.equal(named.years,original.years);assert.equal(original.name,'JG');
});
