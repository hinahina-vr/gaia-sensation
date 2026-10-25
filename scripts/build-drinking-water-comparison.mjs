import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='artifacts/drinking-water-sources-20261023';
await fs.mkdir(root,{recursive:true});
const base=JSON.parse(await fs.readFile('data/atlas-history/drinking.json','utf8'));
const sources=[];
async function source(file,url){
  let body;try{body=await fs.readFile(`${root}/${file}`);}catch(e){
    if(e.code!=='ENOENT')throw e;
    const response=await fetch(url,{signal:AbortSignal.timeout(55000)});if(!response.ok)throw Error(`${response.status}: ${url}`);
    body=Buffer.from(await response.arrayBuffer());JSON.parse(body);await fs.writeFile(`${root}/${file}`,body);
  }
  sources.push({file,url,sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length});return JSON.parse(body);
}
const series=await Promise.all(['urban','rural'].map(async key=>{
  const indicator=`SH.H2O.SMDW.${key==='urban'?'UR':'RU'}.ZS`;
  const metadata=await source(`${key}-metadata.json`,`https://api.worldbank.org/v2/indicator/${indicator}?format=json`);
  const rows=await source(`${key}.json`,`https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&date=2000:2024&per_page=20000`);
  if(rows[0].pages!==1||rows[0].lastupdated!==base.sourceUpdated)throw Error('Water comparison source version mismatch');
  if(!metadata[1][0].sourceOrganization.includes('2025-08-25'))throw Error('Unexpected JMP release');
  return {key,indicator,metadata:metadata[1][0],rows:new Map(rows[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]))};
}));
const round=v=>Number.isFinite(v)?Math.round(v*10000)/10000:null;
const result={schemaVersion:1,id:'drinking-comparison',period:base.period,sourceUpdated:base.sourceUpdated,retrievedAt:'2026-10-23',
  regions:base.regions.map(r=>({id:r.id,years:r.years.map(y=>({year:y.year,...Object.fromEntries(series.map(s=>[s.key,round(s.rows.get(`${r.id}/${y.year}`))]))}))})),
  indicators:series.map(({key,indicator,metadata})=>({key,indicator,metadata})),sources:sources.sort((a,b)=>a.file.localeCompare(b.file)),license:'WHO / UNICEF JMP via World Bank WDI · CC BY 4.0',
  method:'都市人口・農村人口をそれぞれ分母とする安全管理飲料水の利用率。全国系列と同じWDI更新日・JMP公表版。都市−農村の差は同じ年の両方が有効な場合のみ算出（ポイント）。欠測を補間・ゼロ置換せず、全国率を都市・農村率の単純平均から作らない。'};
await fs.writeFile('data/atlas-history/drinking-comparison.json',JSON.stringify(result)+'\n');
console.log(JSON.stringify({countries:result.regions.length,bytes:Buffer.byteLength(JSON.stringify(result)+'\n'),sourceUpdated:result.sourceUpdated,samples:result.regions.filter(r=>['IND','PER','BGD'].includes(r.id)).map(r=>({id:r.id,rows:r.years.filter(y=>[2000,2016,2024].includes(y.year))}))}));
