import fs from 'node:fs';
import {ATLAS_CENTURY_EXHIBITS} from '../../src/exploration/atlas-century-model.js';
import {atlasStatistics} from '../../src/exploration/atlas-history-model.js';
export function centuryInsightFixtures(){
 const fixtures=[];
 for(const definition of ATLAS_CENTURY_EXHIBITS.filter(d=>Number(d.number)<=95)){
  const data=JSON.parse(fs.readFileSync(`data/atlas-history/${definition.id}.json`));
  for(const region of data.regions){
   const dataset=atlasStatistics(definition,data,region);
   if(dataset?.rows.length>=2)fixtures.push({number:Number(definition.number),variant:region.id,dataset});
  }
 }
 return fixtures;
}
