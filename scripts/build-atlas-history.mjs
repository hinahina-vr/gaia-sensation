// Reproducible, bounded snapshots. Raw responses are local artifacts, not shipped.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ATLAS_EXHIBITS} from '../src/exploration/atlas-history-model.js';
const raw=path.resolve('artifacts/atlas-history-sources-20261022'),out=path.resolve('data/atlas-history');
await fs.mkdir(raw,{recursive:true});await fs.mkdir(out,{recursive:true});
const manifest=[];
async function source(name,url,json=true){
  const file=path.join(raw,name);let body;
  try{body=await fs.readFile(file,'utf8');}catch{
    let last;
    for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);const candidate=await r.text();if(json)JSON.parse(candidate);body=candidate;break;}catch(e){last=e;}}
    if(!body)throw last;await fs.writeFile(file,body);
  }
  manifest.push({file:name,url,sha256:createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)});
  return json?JSON.parse(body):body;
}
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const round=v=>Number.isFinite(v)?Math.round(v*10000)/10000:null;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const save=async(d,regions,extra={})=>{
  if(!regions.length||!regions.some(r=>r.years.some(y=>Number.isFinite(y.value))))throw Error(`Empty ${d.id}`);
  const result={schemaVersion:1,id:d.id,unit:d.unit,retrievedAt:'2026-10-22',period:[d.start,d.end],regions,...extra};
  await fs.writeFile(path.join(out,`${d.id}.json`),JSON.stringify(result)+'\n');console.log(d.id,regions.length,'regions',regions.reduce((n,r)=>n+r.years.filter(y=>y.value!==null).length,0),'values');
};
const catalog=await source('countries.json','https://api.worldbank.org/v2/country/all?format=json&per_page=400');
if(catalog[0].pages!==1)throw Error('Country pagination changed');
const names=new Intl.DisplayNames(['ja'],{type:'region'});
for(const d of ATLAS_EXHIBITS.filter(d=>d.code&&Number(d.number)<=80)){
  const meta=await source(`${d.id}-metadata.json`,`https://api.worldbank.org/v2/indicator/${d.code}?format=json`);
  const result=await source(`${d.id}.json`,`https://api.worldbank.org/v2/country/all/indicator/${d.code}?format=json&date=${d.start}:${d.end}&per_page=20000`);
  if(result[0].pages!==1||!Array.isArray(result[1]))throw Error(`Pagination/schema ${d.id}`);
  const rows=new Map(result[1].map(r=>[`${r.countryiso3code}/${r.date}`,r]));
  const regions=catalog[1].filter(c=>c.region.id!=='NA'&&/^[A-Z]{3}$/.test(c.id)).map(c=>{
    let name=c.name;try{name=names.of(c.iso2Code)||name;}catch{}
    return {id:c.id,iso3:c.id,name,lon:c.longitude===''?null:Number(c.longitude),lat:c.latitude===''?null:Number(c.latitude),
      years:range(d.start,d.end).map(year=>({year,value:round(rows.get(`${c.id}/${year}`)?.value)}))};
  }).filter(c=>c.years.some(r=>r.value!==null)).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  await save(d,regions,{indicator:d.code,sourceUpdated:result[0].lastupdated,metadata:meta[1][0],license:'World Bank dataset: CC BY 4.0; original source credited in metadata',method:'国・地域のみ（地域合計を除外）。提供元の年次値を小数点以下4桁まで保存。独自の補間なし。'});
}
const d=ATLAS_EXHIBITS.find(d=>d.id==='waterstore');
const boxes=[{id:'amazon',name:'アマゾン中央部',bounds:[-70,-10,-60,0]},{id:'india',name:'インド北部周辺',bounds:[70,22,85,32]},{id:'africa',name:'アフリカ南部内陸',bounds:[20,-30,30,-20]},{id:'australia',name:'オーストラリア南東部',bounds:[135,-38,150,-28]}];
const graceRegions=[];
await source('grace-metadata.xml','https://grace-onearth.jpl.nasa.gov/edge/ws/metadata/dataset?nexusShortName=TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4_LAND',false);
for(const box of boxes){
  const [west,south,east,north]=box.bounds,params=new URLSearchParams({ds:'TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4_LAND',minLat:south,maxLat:north,minLon:west,maxLon:east,startTime:Date.UTC(d.start,0,1)/1000,endTime:Date.UTC(d.end+1,0,1)/1000-1,mask:3,lowPassFilter:'False',seasonalFilter:'false'});
  const records=await source(`grace-${box.id}.json`,`https://grace-onearth.jpl.nasa.gov/nexus/timeSeriesSpark?${params}`);
  const observations=records.data.flat().filter(r=>Number.isFinite(r.mean)&&r.cnt>0);
  const years=range(d.start,d.end).map(year=>{
    const monthly=new Map();for(const r of observations){const date=new Date(r.time*1000);if(date.getUTCFullYear()===year){const m=date.getUTCMonth();monthly.set(m,[...(monthly.get(m)||[]),r.mean]);}}
    return {year,value:monthly.size>=9?round(mean([...monthly.values()].map(mean))):null,months:monthly.size,samples:[...monthly.values()].reduce((n,a)=>n+a.length,0)};
  });
  graceRegions.push({...box,lon:(west+east)/2,lat:(south+north)/2,years});
}
await save(d,graceRegions,{citation:'NASA JPL Tellus GRACE/GRACE-FO RL06.3 Mascon CRI v4; JPL GRACE Data Analysis Tool',method:'JPL DATが返す固定矩形内のmeanを使用。観測の中心時刻を暦月に分類し、同月複数記録は平均。月ごとの空間平均を等重みで平均し、9か月未満は欠測。2004–2009年の製品基準値を維持。矩形の全面積に水深を掛けた体積や流域全体の総量には換算しない。'});
const sea=ATLAS_EXHIBITS.find(d=>d.id==='sealevel'),seaRegions=[];
for(const [id,name,lon,lat]of[['pac','太平洋',-160,0],['atl','大西洋',-50,5],['ind','インド洋',80,-15]]){
  const text=await source(`sealevel-${id}.csv`,`https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/slr/slr_sla_${id}_keep_ref_90.csv`,false);
  const lines=text.split(/\r?\n/).filter(s=>s&&!s.startsWith('#')),heads=lines.shift().split(',');
  if(heads[0]!=='year'||heads.length!==6)throw Error('Unexpected NOAA columns');
  const records=lines.map(s=>s.split(','));
  const years=range(sea.start,sea.end).map(year=>{
    const byMission=heads.slice(1).map((mission,index)=>{
      const rows=records.filter(r=>Math.floor(Number(r[0]))===year&&r[index+1]?.trim()!==''&&Number.isFinite(Number(r[index+1])));
      const months=new Set(rows.map(r=>new Date(Date.UTC(year,0,1)+(Number(r[0])-year)*(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))).getUTCMonth())).size;
      return {mission,months,samples:rows.length,value:round(mean(rows.map(r=>Number(r[index+1]))))};
    }).sort((a,b)=>b.months-a.months||b.samples-a.samples);
    const best=byMission[0];return {year,...best,value:best.months===12?best.value:null};
  });
  const baseline=years[0].value;if(!Number.isFinite(baseline))throw Error('No 1993 baseline');
  for(const row of years)if(row.value!==null)row.value=round(row.value-baseline);
  seaRegions.push({id,name,lon,lat,baseline1993:baseline,years});
}
await save(sea,seaRegions,{citation:'Altimetry data are provided by the NOAA Laboratory for Satellite Altimetry.',method:'季節変動を残したNOAA原系列（mm）。各年は有効月数→観測数の順で1衛星系列を選び、12か月揃う場合だけ算術平均。同海域1993年平均を差し引く。衛星交代の影響を含む実験的記録。'});
await fs.writeFile(path.join(out,'sources.json'),JSON.stringify({retrievedAt:'2026-10-22',sources:manifest},null,2)+'\n');
