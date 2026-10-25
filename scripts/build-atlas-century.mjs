import fs from 'node:fs/promises';
import path from 'node:path';
import {source,sources,heatRows,ozoneRows,composition} from './lib/atlas-century-source.mjs';
import {csvRows} from './lib/atlas-expansion-source.mjs';
import {ATLAS_CENTURY_EXHIBITS as defs} from '../src/exploration/atlas-century-model.js';
const out=path.resolve('data/atlas-history');await fs.mkdir(out,{recursive:true});
const d=id=>defs.find(x=>x.id===id),round=v=>Number.isFinite(v)?Math.round(v*1e4)/1e4:null;
const years=(definition,fn)=>Array.from({length:definition.end-definition.start+1},(_,i)=>({year:definition.start+i,...fn(definition.start+i)}));
async function save(id,regions,extra){const def=d(id);if(!regions.length)throw Error(`No ${id} regions`);await fs.writeFile(path.join(out,`${id}.json`),JSON.stringify({schemaVersion:1,id,unit:def.unit,period:[def.start,def.end],retrievedAt:'2026-10-22',regions,...extra})+'\n');console.log(def.number,id,regions.length,'regions');}
const countries=await source('countries.json','https://api.worldbank.org/v2/country/all?format=json&per_page=400');
if(countries[0].pages!==1)throw Error('Country pages changed');
const names=new Intl.DisplayNames(['ja'],{type:'region'});
const nationList=countries[1].filter(c=>c.region.id!=='NA'&&/^[A-Z]{3}$/.test(c.id));
const nation=c=>({id:c.id,iso3:c.id,name:(()=>{try{return names.of(c.iso2Code)||c.name;}catch{return c.name;}})(),lon:c.longitude===''?null:Number(c.longitude),lat:c.latitude===''?null:Number(c.latitude)});
async function wdi(name,code){
  const meta=await source(`${name}-metadata.json`,`https://api.worldbank.org/v2/indicator/${code}?format=json`);
  const data=await source(`${name}.json`,`https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&date=2000:2024&per_page=20000`);
  if(meta[1]?.[0]?.id!==code||data[0]?.pages!==1||!Array.isArray(data[1]))throw Error(`WDI schema ${name}`);
  const values=new Map(data[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));return {meta:meta[1][0],updated:data[0].lastupdated,get:(id,y)=>round(values.get(`${id}/${y}`))};
}
const wdiLicense='World Bank WDI / original producers: CC BY 4.0. https://data.worldbank.org/summary-terms-of-use';
const national=(def,fn)=>nationList.map(c=>({...nation(c),years:years(def,y=>fn(c.id,y))})).filter(c=>c.years.some(r=>r.value!==null||r.invalidComposition));
for(const [id,name,code]of[['hunger','hunger','SN.ITK.DEFC.ZS'],['internet','internet','IT.NET.USER.ZS'],['refugees','refugees-unhcr','SM.POP.RHCR.EO']]){
  const a=await wdi(name,code);await save(id,national(d(id),(c,y)=>{const value=a.get(c,y);return {value,...(id==='hunger'&&value===2.5?{censored:true}:{})};}),{
    metadata:a.meta,sourceUpdated:a.updated,license:wdiLicense,citation:id==='refugees'?'UNHCR Refugee Population Statistics Database. National year-end series distributed by World Bank; selection and visualization by GAIA SENSEWARE.':'',
    method:id==='hunger'?'3年移動平均を年ラベルのまま保持。2.5は下限値フラグ付きで保持し、統計分析の点推計から除外。':'地域集計を除いた国・地域別系列。欠測を補間せず、小数点以下4桁に丸めて保持。'});
}
const [ag,ind,dom]=await Promise.all([wdi('withdraw-agriculture','ER.H2O.FWAG.ZS'),wdi('withdraw-industry','ER.H2O.FWIN.ZS'),wdi('withdraw-domestic','ER.H2O.FWDM.ZS')]);
await save('wateruse',national(d('wateruse'),(c,y)=>composition(ag.get(c,y),ind.get(c,y),dom.get(c,y))),{metadata:[ag.meta,ind.meta,dom.meta],license:wdiLicense,method:'3部門がそろい、各0–100%かつ合計100±1ポイントで内訳を表示。整合しない値は原値とフラグを残し、構成図・分析から除外。再正規化なし。'});
const [capture,aquaculture]=await Promise.all([wdi('capture','ER.FSH.CAPT.MT'),wdi('aquaculture','ER.FSH.AQUA.MT')]);
await save('fisheries',national(d('fisheries'),(c,y)=>{const a=capture.get(c,y),b=aquaculture.get(c,y);return {capture:a===null?null:round(a/1e4),aquaculture:b===null?null:round(b/1e4),value:a!==null&&b!==null?round((a+b)/1e4):null};}),{metadata:[capture.meta,aquaculture.meta],license:wdiLicense,method:'海洋・内水面の漁獲＋養殖。両系列を合算しtから万tへ換算。片方が欠測の年は総量も欠測。'});
const heat=[];
for(const [code,id,name,lon,lat]of[['p','pacific','太平洋',-150,0],['a','atlantic','大西洋・北極海',-35,0],['i','indian','インド洋',75,-15]]){
  const series=[];
  for(const depth of [700,2000]){
    const file=`h22-${code}0-${depth}m.dat`,url=`https://www.ncei.noaa.gov/data/oceans/woa/DATA_ANALYSIS/3M_HEAT_CONTENT/DATA/basin/yearly/${file}`;
    // The direct endpoint returned HTTP 503 during this build. The complete
    // official text was retrieved through the web reader's cached response;
    // only its line-number prefixes were removed, with no numeric edits.
    const text=await source(`web-${file}`,url,false);sources.at(-1).retrieval='Official web-reader text extraction; line markers removed. Not a byte hash of the origin HTTP response.';
    series.push(new Map(heatRows(text).map(r=>[r.year,r])));
  }
  heat.push({id,name,lon,lat,years:years(d('oceanheat'),y=>{const a=series[0].get(y),b=series[1].get(y);if(!a||!b)throw Error(`Missing depth ${id} ${y}`);return {value:b.value,se:b.se,upper:a.value,upperSE:a.se,deep:round(b.value-a.value)};})});
}
await save('oceanheat',heat,{license:'NOAA public data, attribution retained. https://www.noaa.gov/disclaimer',citation:'NOAA NCEI Ocean Heat Content CDR, DOI:10.7289/V53F4MVP. Annual basin series, 2005–2024.',method:'原本の海域全体列と標準誤差列を保持。深層700–2,000mのみ二つの深度積分の差から算出。原本への直接取得が503のため、公式テキストのWeb取得結果から行番号だけ除去して保存。'});
const ozone=ozoneRows(await source('ozone-annual.html','https://ozonewatch.gsfc.nasa.gov/statistics/annual_data.html',false));
if(ozone.find(r=>r.year===2016)?.value!==20.7||ozone.some(r=>r.year===1995))throw Error('NASA table contract');
await save('ozone',[{id:'antarctic',name:'南極の春',lon:0,lat:-75,years:years(d('ozone'),y=>ozone.find(r=>r.year===y)||{value:null,ozone:null})}],{license:'NASA publicly available numerical data; attribution to NASA Ozone Watch. No NASA logo or imagery reused.',method:'NASA Annual Recordsの季節平均表。面積は9/7–10/13、平均最低オゾン全量は9/21–10/16。1995年欠測を保持。'});
const [header,...glacier]=csvRows(await source('mb_ref.csv','https://wgms.ch/data/faq/mb_ref.csv?db=2026-02-10',false));
if(header.join(',')!=='Year,MB_REF_count,REF_regionAVG,REF_regionAVG_cum-rel-1970')throw Error('WGMS header changed');
await save('glaciers',[{id:'reference',name:'世界の参照氷河',lon:0,lat:45,aggregate:true,years:glacier.filter(r=>+r[0]>=1970&&+r[0]<=2024).map(r=>({year:+r[0],value:+r[3]/1000,annual:+r[2]/1000,count:+r[1]}))}],{citation:'World Glacier Monitoring Service (WGMS), reference glacier mass-balance series, database 2026-02-10; original observing investigators via WGMS. Numerical series converted from mm to m water equivalent.',license:'CC BY 4.0 / WGMS data policy: https://wgms.ch/data_policy/',method:'地域平均を等重みで平均した参照氷河指数。1970年相対の累積値を使用し、年次収支と対象数も保持。'});
for(const [id,prefix,endpoint,filter]of[['volcanoes','volcano','volcanoes',''],['tsunamis','tsunami','tsunamis/events','&minEventValidity=4&maxEventValidity=4']]){
  const records=[];let count=0,pages=1;
  for(let page=1;page<=pages;page++){
    const a=await source(`${prefix}-${page}.json`,`https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/${endpoint}?minYear=1980&maxYear=2024&itemsPerPage=200${filter}&page=${page}`);
    if(a.page!==page||!Array.isArray(a.items))throw Error('HazEL pagination changed');pages=a.totalPages;count=a.totalItems;records.push(...a.items);
  }
  if(records.length!==count||new Set(records.map(r=>r.id)).size!==count)throw Error('Incomplete HazEL records');
  const accepted=records.filter(r=>id==='volcanoes'?r.eruption===true:r.eventValidity===4);
  const groups=new Map();
  const events=accepted.map(r=>{
    const country=r.country||'UNKNOWN';let group=groups.get(country);
    if(!group){const c=nationList.find(c=>c.name.toUpperCase()===country.toUpperCase());group=c?nation(c):{id:country.toLowerCase().replace(/[^a-z]+/g,'_'),name:country,lon:r.longitude??null,lat:r.latitude??null};groups.set(country,group);}
    return {id:String(r.id),year:r.year,month:r.month??null,day:r.day??null,region:group.id,name:r.name||r.locationName||country,lon:r.longitude??null,lat:r.latitude??null,magnitude:(id==='volcanoes'?r.vei:r.maxWaterHeight)??null,...(id==='tsunamis'?{validity:r.eventValidity,runups:r.numRunups??0}:{})};
  }).sort((a,b)=>a.year-b.year||(a.month||0)-(b.month||0)||(a.day||0)-(b.day||0)||a.id.localeCompare(b.id));
  const regions=[{id:'ALL',name:'全対象記録',lon:150,lat:8},...groups.values()].map(r=>({...r,years:years(d(id),y=>{const rows=events.filter(e=>e.year===y&&(r.id==='ALL'||e.region===r.id));return {value:rows.length,located:rows.filter(e=>Number.isFinite(e.lon)&&Number.isFinite(e.lat)).length,missingMagnitude:rows.filter(e=>e.magnitude===null).length};})}));
  await save(id,regions,{events,citation:`NOAA National Centers for Environmental Information. ${id==='volcanoes'?'Significant Volcanic Eruptions, DOI:10.7289/V5JW8BSH':'Global Historical Tsunami Database, DOI:10.7289/V5PN93H7'}.`,license:'NOAA publicly available hazard records, attribution retained. https://www.noaa.gov/disclaimer',rawCount:count,acceptedCount:events.length,method:id==='volcanoes'?'1980–2024年、eruption=trueを抽出。VEI欠測はnull。年別・国別件数を集計。':'1980–2024年、eventValidity=4のみ。座標欠測も件数に保持し、地図からのみ除外。最大観測高は沿岸観測値として保持。'});
}
await fs.writeFile(path.join(out,'century-sources.json'),JSON.stringify({retrievedAt:'2026-10-22',sources},null,2)+'\n');
