import {OBSERVATION_CITIES} from './observation-cities.js?v=gaia-exhibit-catalog-1';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export const LIVE_REGIONS=Object.freeze([
 {id:'north',name:'北海道・東北',codes:[1,2,3,4,5,6,7]},
 {id:'east',name:'関東・甲信',codes:[8,9,10,11,12,13,14,19,20]},
 {id:'central',name:'北陸・東海',codes:[15,16,17,18,21,22,23,24]},
 {id:'kinki',name:'近畿',codes:[25,26,27,28,29,30]},
 {id:'west',name:'中国・四国',codes:[31,32,33,34,35,36,37,38,39]},
 {id:'south',name:'九州・沖縄',codes:[40,41,42,43,44,45,46,47]},
]);
const label=t=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
// Fixed sites across the entire hourly window: neither missing-as-zero nor a
// changing sample of cities may create a spurious nationwide change.
export function buildLiveTrend(exhibit,field,unit){
 if(!field||!['snapshot','stale-cache','open-meteo'].includes(field.source))return null;
 const cutoff=Date.parse(field.generatedAt);
 const frames=(field.history||[]).filter(f=>Number.isFinite(Date.parse(f.observedAt))&&(!Number.isFinite(cutoff)||Date.parse(f.observedAt)<=cutoff)).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).slice(-24);
 if(frames.length<12||new Set(frames.map(f=>f.observedAt)).size!==frames.length)return null;
 if(frames.some((f,i)=>i&&Date.parse(f.observedAt)-Date.parse(frames[i-1].observedAt)!==3600000))return null;
 const mapped=frames.map(f=>new Map(f.points.map(p=>[p.id,p])));
 const cities=OBSERVATION_CITIES.filter(city=>mapped.every(m=>finite(m.get(city.id)?.measurements?.[exhibit.key])));
 if(cities.length<24)return null;
 const regions=LIVE_REGIONS.map(r=>({...r,cities:cities.filter(c=>r.codes.includes(Number(c.code)))})).filter(r=>r.cities.length>=3);
 const t0=Date.parse(frames[0].observedAt);
 const rows=frames.map((f,i)=>{const m=mapped[i],values=cities.map(c=>m.get(c.id).measurements[exhibit.key]);return{id:f.observedAt,label:label(f.observedAt),x:(Date.parse(f.observedAt)-t0)/3600000,y:mean(values),value:mean(values),observedAt:f.observedAt,siteCount:cities.length,provenance:'SOURCE',measurementKind:'MODEL',aggregation:'fixed-site-mean',regional:regions.map(r=>({id:r.id,name:r.name,value:mean(r.cities.map(c=>m.get(c.id).measurements[exhibit.key])),count:r.cities.length}))};});
 return{id:'live-'+exhibit.id,modeId:exhibit.id,title:exhibit.number+' '+exhibit.shortTitle+' — 同じ代表地点の時間推移（'+label(frames[0].observedAt)+'〜'+label(frames.at(-1).observedAt)+' JST）',rows,unit,xKind:'hour',xLabel:'最初の時刻からの経過時間',yLabel:exhibit.signalLabel+'（代表地点平均）',valueLabel:exhibit.signalLabel,defaultMethod:'discovery',provenance:['SOURCE'],insightContext:{measurementKind:'MODEL',axis:'fixed-site-hourly',snapshotAnalysis:true},coverage:{targetCount:47,availableCount:cities.length,missingCount:47-cities.length},periodStart:frames[0].observedAt,periodEnd:frames.at(-1).observedAt,sourceState:field.source,sourceName:'Open-Meteo'+(exhibit.key==='pm25'||exhibit.key==='forecastCo2'?' / CAMS':'')+'・'+(field.source==='snapshot'?'保存済み':field.source==='stale-cache'?'前回取得':'取得済み')+'時間別モデル値',sourceUrl:field.provenance?.sourceUrl,retrievedAt:field.generatedAt,comparisonNote:'各時刻で同じ代表地点を等重みで平均。国土面積や人口で重み付けした全国平均ではありません。',trendContext:{kind:'fixed-site-hourly',metric:exhibit.key,siteIds:cities.map(c=>c.id),siteNames:cities.map(c=>c.name),regions:regions.map(r=>({id:r.id,name:r.name,siteIds:r.cities.map(c=>c.id)})),panel:cities.map(c=>({id:c.id,name:c.name,values:mapped.map(m=>m.get(c.id).measurements[exhibit.key])}))}};
}
