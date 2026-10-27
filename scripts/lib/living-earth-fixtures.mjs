import fs from 'node:fs';
import {atlasDefinition,atlasStatistics} from '../../src/exploration/atlas-history-model.js';
import {tideStatistics,decodeTides} from '../../src/exploration/sea-level-stations.js';
import {electricityStatistics} from '../../src/exploration/electricity-access.js';
import {drinkingStatistics} from '../../src/exploration/drinking-water.js';
import {sanitationStatistics} from '../../src/exploration/sanitation-services.js';
import {forestStatistics} from '../../src/exploration/forest-history.js';
const read=id=>JSON.parse(fs.readFileSync(`data/atlas-history/${id}.json`));
export function livingEarthFixtures(){
 const out=[],add=(number,variant,dataset)=>out.push({number,variant,dataset});
 for(const id of ['waterstore','sealevel']){const data=read(id);for(const region of data.regions)add(id==='waterstore'?75:76,region.id,atlasStatistics(atlasDefinition(id),data,region));}
 const tides=decodeTides(read('sealevel-stations'));for(const point of [tides.regions.find(r=>r.name==='KUSHIMOTO'),...tides.regions.filter(r=>r.years.filter(y=>Number.isFinite(y.value)).length>=20).slice(0,2)].filter(Boolean))add(76,point.id,tideStatistics(tides,point));
 for(const [id,number]of [['electricity',77],['foresthistory',80]]){const data=read(id);for(const country of ['IND','JPN','BRA','CHN']){const region=data.regions.find(r=>r.id===country);for(const mode of id==='electricity'?['access','change']:['share','change'])add(number,country+'-'+mode,id==='electricity'?electricityStatistics(atlasDefinition(id),data,region,mode):forestStatistics(atlasDefinition(id),data,region,mode));}}
 for(const [id,modes,comparison]of [['drinking-basic',['basic','basic-gap'],'drinking-basic-comparison'],['drinking',['national','gap'],'drinking-comparison']]){const data=read(id),pairs=read(comparison);for(const country of ['IND','JPN'])for(const mode of modes)add(78,country+'-'+mode,drinkingStatistics(atlasDefinition('drinking'),data,pairs,data.regions.find(r=>r.id===country),mode));}
 const sanitation=read('sanitation'),services=read('sanitation-services');for(const country of ['IND','BGD','JPN'])for(const mode of ['safe','basic','limited','open'])add(79,country+'-'+mode,sanitationStatistics(atlasDefinition('sanitation'),sanitation,services,sanitation.regions.find(r=>r.id===country),mode));
 return out.filter(f=>f.dataset?.rows.length>=2);
}
