import fs from 'node:fs';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {SELECTABLE_COUNTRIES} from '../src/exploration/country-selection-catalog.js';
const directory=process.argv[2]||'artifacts/drinking-basic-20261026';
const countries=JSON.parse(gunzipSync(fs.readFileSync('data/sources/map-exhibit-snapshots/atlas-history-sources-20261022/countries.json.gz')))[1].filter(c=>c.region.id!=='NA');
const read=name=>JSON.parse(fs.readFileSync(`${directory}/${name}.json`));
const raw=read('basic'),urban=read('urban'),rural=read('rural'),metadata=read('metadata')[1][0];
for(const data of [raw,urban,rural]){if(data[0].pages!==1||data[0].lastupdated!==raw[0].lastupdated)throw Error('Incomplete or mismatched WDI releases')}
const index=data=>new Map(data[1].map(r=>[r.countryiso3code+'/'+r.date,r.value]));
const tables={basic:index(raw),urban:index(urban),rural:index(rural)};
const value=(table,id,year)=>{const v=table.get(id+'/'+year);if(v===null||v===undefined)return null;if(!Number.isFinite(v)||v<0||v>100)throw Error('Invalid percentage');return Math.round(v*10000)/10000};
const names=new Intl.DisplayNames(['ja'],{type:'region'}),geography=new Map(SELECTABLE_COUNTRIES.map(c=>[c.id,c]));
const regions=countries.map(country=>{
 const g=geography.get(country.id),code=country.iso2Code;
 return {id:country.id,iso3:country.id,name:g?.name||(/^[A-Z]{2}$/.test(code)?names.of(code):country.name),lon:g?.lon??Number(country.longitude),lat:g?.lat??Number(country.latitude),years:Array.from({length:25},(_,i)=>({year:2000+i,value:value(tables.basic,country.id,2000+i)}))};
}).filter(r=>r.years.some(y=>y.value!==null));
const comparison=countries.map(country=>({id:country.id,years:Array.from({length:25},(_,i)=>({year:2000+i,urban:value(tables.urban,country.id,2000+i),rural:value(tables.rural,country.id,2000+i)}))}));
const snapshot='data/sources/map-exhibit-snapshots/drinking-basic-20261026';fs.mkdirSync(snapshot,{recursive:true});
const codes={basic:'SH.H2O.BASW.ZS',urban:'SH.H2O.BASW.UR.ZS',rural:'SH.H2O.BASW.RU.ZS'};
const sources=['basic','urban','rural','metadata'].map(name=>{const bytes=fs.readFileSync(`${directory}/${name}.json`);fs.writeFileSync(`${snapshot}/${name}.json.gz`,gzipSync(bytes,{level:9}));return {file:`${snapshot}/${name}.json.gz`,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,url:name==='metadata'?'https://api.worldbank.org/v2/indicator/SH.H2O.BASW.ZS?format=json':`https://api.worldbank.org/v2/country/all/indicator/${codes[name]}?format=json&date=2000:2024&per_page=20000`}});
const common={schemaVersion:1,period:[2000,2024],retrievedAt:'2026-10-26',sourceUpdated:raw[0].lastupdated,license:'CC BY 4.0',citation:'WHO/UNICEF JMP / World Bank WDI',rawManifest:'data/atlas-history/drinking-basic-sources.json'};
fs.writeFileSync('data/atlas-history/drinking-basic.json',JSON.stringify({...common,id:'drinking-basic',unit:'%',indicator:codes.basic,metadata,regions,method:'少なくとも基本的な飲料水サービスを利用する人口の割合。安全に管理されたサービスも含む。地域集計を除く国・地域の年次値を小数点以下4桁で保存。独自の補間・欠測のゼロ置換は行わない。'})+'\n');
fs.writeFileSync('data/atlas-history/drinking-basic-comparison.json',JSON.stringify({...common,id:'drinking-basic-comparison',indicators:[{key:'urban',indicator:codes.urban},{key:'rural',indicator:codes.rural}],regions:comparison,method:'同じWDI公開版の基本的な飲料水サービス利用率を都市・農村別に保存。割合の母数はそれぞれ都市人口・農村人口。差は都市−農村のポイント差。公表値のない年はnullのまま残す。'})+'\n');
fs.writeFileSync('data/atlas-history/drinking-basic-sources.json',JSON.stringify({...common,sources},null,2)+'\n');
console.log(JSON.stringify({sourceUpdated:common.sourceUpdated,regions:regions.length,coverage:[2016,2024].map(year=>({year,national:regions.filter(r=>Number.isFinite(r.years.find(y=>y.year===year).value)).length,paired:comparison.filter(r=>{const row=r.years.find(y=>y.year===year);return Number.isFinite(row.urban)&&Number.isFinite(row.rural)}).length}))}));
