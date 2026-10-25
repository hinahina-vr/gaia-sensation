import fs from 'node:fs';import{mapInsightFixtures}from'./map-insight-fixtures.mjs';
import{FOOD_EXHIBITS,buildFoodStatisticsDataset}from'../../src/exploration/food-catalog.js';
import{CLIMATE_EXHIBITS,statisticsFor}from'../../src/exploration/climate-history-model.js';
import{ATLAS_EXHIBITS,atlasStatistics}from'../../src/exploration/atlas-history-model.js';
import{lakeStatistics}from'../../src/exploration/surface-water-model.js';
const read=p=>JSON.parse(fs.readFileSync(p)),country=data=>data.regions.find(r=>r.id==='IND'&&r.years.filter(r=>Number.isFinite(r.value)&&!r.censored).length>=9)||data.regions.toSorted((a,b)=>b.years.filter(r=>Number.isFinite(r.value)&&!r.censored).length-a.years.filter(r=>Number.isFinite(r.value)&&!r.censored).length)[0];
export function finalInsightFixtures({variants=false}={}){
 const out=mapInsightFixtures(12,61,69,true);
 for(const d of FOOD_EXHIBITS){const a=read('data/'+d.dataFile),c=a.countries.find(c=>String(c.id)==='392')||a.countries[0];const series=variants?a.series:a.series.slice(0,1);for(const s of series){let dataset=buildFoodStatisticsDataset(a,d,s.id,c.id);if(dataset.rows.length<2)dataset=a.countries.map(c=>buildFoodStatisticsDataset(a,d,s.id,c.id)).sort((a,b)=>b.rows.length-a.rows.length)[0];out.push({number:Number(d.number),variant:s.id,dataset});};}
 const cyclones=read('data/climate-history/cyclones.json'),coral=read('data/climate-history/coral.json'),lakes=read('data/surface-water/lakes.json');out.push({number:72,dataset:statisticsFor({kind:'cyclones',data:cyclones,basin:'ALL'})},{number:73,dataset:statisticsFor({kind:'coral',data:coral,region:coral.regions[0]})},{number:74,dataset:lakeStatistics(lakes.regions[0])});
 for(const d of ATLAS_EXHIBITS){const data=read('data/atlas-history/'+d.id+'.json');out.push({number:Number(d.number),variant:'default',dataset:atlasStatistics(d,data,data.regions[0])});}
 return out;
}
