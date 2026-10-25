import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='artifacts/sanitation-sources-20261023';
await fs.mkdir(root,{recursive:true});
const base=JSON.parse(await fs.readFile('data/atlas-history/sanitation.json','utf8')),sources=[];
async function source(file,url){
  let body;try{body=await fs.readFile(`${root}/${file}`);}catch(e){
    if(e.code!=='ENOENT')throw e;
    const r=await fetch(url,{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error(`${r.status}: ${url}`);
    body=Buffer.from(await r.arrayBuffer());JSON.parse(body);await fs.writeFile(`${root}/${file}`,body);
  }
  sources.push({file,url,sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length});return JSON.parse(body);
}
const series=await Promise.all([['basic','SH.STA.BASS.ZS'],['open','SH.STA.ODFC.ZS']].map(async([key,indicator])=>{
  const meta=await source(`${key}-metadata.json`,`https://api.worldbank.org/v2/indicator/${indicator}?format=json`);
  const result=await source(`${key}.json`,`https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&date=2000:2024&per_page=20000`);
  if(result[0].pages!==1||result[0].lastupdated!==base.sourceUpdated)throw Error('Sanitation source version mismatch');
  if(!meta[1][0].sourceOrganization.includes('2025-08-25'))throw Error('Unexpected JMP release');
  return {key,indicator,metadata:meta[1][0],rows:new Map(result[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]))};
}));
const round=v=>Number.isFinite(v)?Math.round(v*10000)/10000:null;
const result={schemaVersion:1,id:'sanitation-services',period:base.period,sourceUpdated:base.sourceUpdated,retrievedAt:'2026-10-23',
  regions:base.regions.map(r=>({id:r.id,years:r.years.map(y=>({year:y.year,...Object.fromEntries(series.map(s=>[s.key,round(s.rows.get(`${r.id}/${y.year}`))]))}))})),
  indicators:series.map(({key,indicator,metadata})=>({key,indicator,metadata})),sources:sources.sort((a,b)=>a.file.localeCompare(b.file)),license:'WHO / UNICEF JMP via World Bank WDI · CC BY 4.0',
  method:'全国人口を分母に、同じWDI更新日・JMP公表版の系列を使用。安全管理＝SMSS、基本のみ＝BASS−SMSS、共用・未改善＝100−BASS−ODFC、野外排泄＝ODFC。BASSは安全管理を含む。3系列が有効で大小関係が整う年のみ4区分を表示。欠測は補間・ゼロ置換しない。共用と未改善の内訳は分割しない。'};
await fs.writeFile('data/atlas-history/sanitation-services.json',JSON.stringify(result)+'\n');
console.log(JSON.stringify({countries:result.regions.length,bytes:Buffer.byteLength(JSON.stringify(result)+'\n'),samples:result.regions.filter(r=>['BGD','IND','ETH','JPN'].includes(r.id)).map(r=>({id:r.id,years:r.years.filter(y=>[2000,2016,2024].includes(y.year))}))}));
