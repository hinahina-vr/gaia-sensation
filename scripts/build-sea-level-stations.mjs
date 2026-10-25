import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readZipMembers,buildTideStations} from './lib/psmsl-source.mjs';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'artifacts/sea-level-sources-20261022');
const url='https://psmsl.org/data/obtaining/rlr.annual.data/rlr_annual.zip',raw=path.join(folder,'rlr_annual.zip');
await fs.mkdir(folder,{recursive:true});
let body;try{body=await fs.readFile(raw);}catch(e){if(e.code!=='ENOENT')throw e;const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`PSMSL HTTP ${response.status}`);body=Buffer.from(await response.arrayBuffer());await fs.writeFile(raw,body);}
const files=readZipMembers(body),regions=buildTideStations(files),extracted=[...files].find(([n])=>n.endsWith('extracted_from_database'))?.[1].trim();
if(regions.length<200||!extracted)throw Error('Incomplete station snapshot');
const result={schemaVersion:1,id:'sealevel-stations',period:[1993,2024],unit:'mm',retrievedAt:'2026-10-22',extractedFromDatabase:extracted,
 source:{url,sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length},
 method:'PSMSLのRLR年平均。地点QC=N、1993年の利用可能値があり、2010–2024年にも利用可能値がある地点を対象。年値は欠測=-99999、欠日フラグY、注意・MTLフラグが000以外の年を除外。同地点の1993年値との差をmmで表示。補間・地盤変動補正なし。',
 interpretation:'沿岸の相対海面。海面そのものと陸の上下運動の両方を含む。各地点の基準面が異なるため、RLR生値を地点間の絶対高度として比較しない。',
 citation:`PSMSL (2026), Tide Gauge Data, database extracted ${extracted}; Holgate et al. (2013), Journal of Coastal Research 29(3), 493–504, doi:10.2112/JCOASTRES-D-12-00175.1.`,
 termsUrl:'https://psmsl.org/about_us/support_us.php',referenceUrl:'https://psmsl.org/data/obtaining/reference.php',regions:regions.map(({years,...r})=>({...r,values:years.map(y=>y.value),missing:Object.fromEntries(years.filter(y=>y.reason).map(y=>[y.year,y.reason]))}))};
const output=path.join(root,'data/atlas-history/sealevel-stations.json');await fs.writeFile(output,JSON.stringify(result)+'\n');
console.log(JSON.stringify({stations:regions.length,bytes:(await fs.stat(output)).size,extracted,sourceSha:result.source.sha256,initial:regions.find(r=>r.stationId===134)}));
