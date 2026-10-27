import fs from 'node:fs';
import {ATLAS_EXPANSION_EXHIBITS} from '../../src/exploration/atlas-expansion-model.js';
import {atlasStatistics} from '../../src/exploration/atlas-history-model.js';
import {croplandStatistics} from '../../src/exploration/cropland-history.js';
export function expansionInsightFixtures(){
 const fixtures=[];
 for(const definition of ATLAS_EXPANSION_EXHIBITS.filter(d=>Number(d.number)<=85)){
  const data=JSON.parse(fs.readFileSync(`data/atlas-history/${definition.id}.json`));
  const countries=({waterstress:['EGY','IND','JPN'],cropland:['ETH','JPN','USA'],yield:['IND','JPN','USA'],fertilizer:['IND','JPN','NLD'],longevity:['JPN','IND','USA']})[definition.id];
  for(const id of countries)for(const mode of definition.id==='cropland'?['change','share']:['default']){
   const region=data.regions.find(r=>r.id===id),dataset=definition.id==='cropland'?croplandStatistics(definition,data,region,mode):atlasStatistics(definition,data,region);
   if(dataset?.rows.length>=2)fixtures.push({number:Number(definition.number),variant:id+'-'+mode,dataset});
  }
 }
 return fixtures;
}
