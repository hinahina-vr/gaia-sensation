import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ATLAS_EXPANSION_EXHIBITS as definitions} from '../src/exploration/atlas-expansion-model.js';
import {iceRecords,snowRecords,monthlyYears} from './lib/atlas-expansion-source.mjs';
const raw=path.resolve('artifacts/atlas-expansion-sources-20261022'),out=path.resolve('data/atlas-history'),sources=[];
await fs.mkdir(raw,{recursive:true});await fs.mkdir(out,{recursive:true});
async function source(name,url,json=true){
  const file=path.join(raw,name);let body;
  try{body=await fs.readFile(file,'utf8');}catch{
    for(let i=0;i<3;i++)try{const r=await fetch(url,{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error(`${r.status} ${url}`);body=await r.text();if(json)JSON.parse(body);await fs.writeFile(file,body);break;}catch(e){if(i===2)throw e;}
  }
  sources.push({file:name,url,sha256:createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)});return json?JSON.parse(body):body;
}
async function save(d,regions,extra){
  if(!regions.length)throw Error(`Empty ${d.id}`);
  const data={schemaVersion:1,id:d.id,unit:d.unit,period:[d.start,d.end],retrievedAt:'2026-10-22',regions,...extra};
  await fs.writeFile(path.join(out,`${d.id}.json`),JSON.stringify(data)+'\n');console.log(d.number,d.id,regions.length,'regions');
}
const countries=await source('countries.json','https://api.worldbank.org/v2/country/all?format=json&per_page=400');
if(countries[0].pages!==1)throw Error('Country pagination changed');
const names=new Intl.DisplayNames(['ja'],{type:'region'});
for(const d of definitions.filter(d=>d.code)){
  const meta=await source(`${d.id}-metadata.json`,`https://api.worldbank.org/v2/indicator/${d.code}?format=json`);
  const data=await source(`${d.id}.json`,`https://api.worldbank.org/v2/country/all/indicator/${d.code}?format=json&date=2000:2024&per_page=20000`);
  if(data[0].pages!==1||!Array.isArray(data[1])||meta[1][0].id!==d.code)throw Error(`Schema ${d.id}`);
  const values=new Map(data[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
  const regions=countries[1].filter(c=>c.region.id!=='NA'&&/^[A-Z]{3}$/.test(c.id)).map(c=>{
    let name=c.name;try{name=names.of(c.iso2Code)||name;}catch{}
    return {id:c.id,iso3:c.id,name,lon:c.longitude===''?null:Number(c.longitude),lat:c.latitude===''?null:Number(c.latitude),years:Array.from({length:d.end-d.start+1},(_,i)=>{
      const year=d.start+i,v=values.get(`${c.id}/${year}`);return {year,value:Number.isFinite(v)?Math.round(v*10000)/10000:null};
    })};
  }).filter(c=>c.years.some(r=>r.value!==null)).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  await save(d,regions,{indicator:d.code,sourceUpdated:data[0].lastupdated,metadata:meta[1][0],license:'World Bank WDI: CC BY 4.0 with dataset terms and source attribution. https://data.worldbank.org/summary-terms-of-use',method:'地域合計を除いた国・地域の公表・推計値。小数点以下4桁に丸め、欠測を補間せず保持。'});
}
const ice=definitions.find(d=>d.id==='seaice'),iceRegions=[];
for(const [id,name,lon,lat,prefix]of[['north','北極',35,68,'N'],['south','南極',145,-55,'S']]){
  const records=[];
  for(let m=1;m<=12;m++){
    const file=`${prefix}_${String(m).padStart(2,'0')}_extent_v4.0.csv`;
    records.push(...iceRecords(await source(file,`https://noaadata.apps.nsidc.org/NOAA/G02135/${id}/monthly/data/${file}`,false)));
  }
  iceRegions.push({id,name,lon,lat,years:monthlyYears(records,ice.start,ice.end)});
}
await save(ice,iceRegions,{citation:'Fetterer et al. (2025), Sea Ice Index, Version 4, NSIDC. DOI:10.7265/a98x-0f50. North/south monthly extent, 1979–2024, all months.',license:'Publicly provided NSIDC data; citation required. https://nsidc.org/data/data-policies',method:'公式CSVのextent列（百万km²）を保持。-9999は欠測。日次extentの月平均を、月を固定した年次系列で表示。独自の補間なし。'});
const snow=definitions.find(d=>d.id==='snowcover'),snowRegions=[];
for(const [id,name,lon,lat]of[['eurasia','ユーラシア',75,54],['nam','北米（グリーンランド除外）',-105,50],['nhland','北半球全体',-10,58]]){
  const text=await source(`moncov.${id}.txt`,`http://climate.rutgers.edu/snowcover/files/moncov.${id}.txt`,false);
  snowRegions.push({id,name,lon,lat,years:monthlyYears(snowRecords(text),snow.start,snow.end)});
}
await save(snow,snowRegions,{citation:'Robinson, Estilow and NOAA CDR Program (2012), Northern Hemisphere Snow Cover Extent, Version 1. DOI:10.7289/V5N014G9. Rutgers Global Snow Lab monthly aggregation, 1972–2024.',license:'NOAA public non-proprietary CDR data; attribution retained. Rutgers numerical records only; no site images reused.',method:'公式月次集計km²を1,000,000で割り百万km²に換算。北半球・ユーラシア・北米（グリーンランド除外）は重複集計のため合算しない。公式HTTP原本を取得時ハッシュ付きで記録し、ブラウザにはローカルデータのみ配信。'});
await fs.writeFile(path.join(out,'expansion-sources.json'),JSON.stringify({retrievedAt:'2026-10-22',sources},null,2)+'\n');
