import fs from 'node:fs';
import {ATLAS_EXPANSION_EXHIBITS} from '../../src/exploration/atlas-expansion-model.js';
import {atlasStatistics} from '../../src/exploration/atlas-history-model.js';
export function lateExpansionInsightFixtures(){
 const fixtures=[];
 for(const definition of ATLAS_EXPANSION_EXHIBITS.filter(d=>Number(d.number)>=86&&Number(d.number)<=90)){
  const data=JSON.parse(fs.readFileSync(`data/atlas-history/${definition.id}.json`));
  const regions=definition.monthly?data.regions:data.regions.filter(r=>['CHN','JPN','IND','USA'].includes(r.id));
  for(const region of regions)for(const month of definition.monthly?Array.from({length:12},(_,i)=>i+1):[undefined]){
   const dataset=atlasStatistics(definition,data,region,month);
   if(dataset?.rows.length>=2)fixtures.push({number:Number(definition.number),variant:region.id+(month?`-m${month}`:''),dataset});
  }
 }
 return fixtures;
}
