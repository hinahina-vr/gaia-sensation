export const TIDE_GUIDE='PSMSLの検潮所が記録した年平均の相対海面を、同じ地点の1993年からの差で表示します。海面と地盤の上下運動の両方を含みます。青緑は低下、金色は上昇。縦線の長さと色は±300mmで頭打ちになり、それを超える変化は数値で読めます。密集した地点は拡大すると選びやすくなります。地点QC、欠日、注意・MTLフラグを確認し、比較に使える年だけを採用。欠測年は灰色で残し、年の間を補間しません。';
export const tideSource=id=>`https://psmsl.org/data/obtaining/stations/${id}.php`;
export function decodeTides(payload){
  if(payload.schemaVersion!==1||!Array.isArray(payload.regions)||payload.regions.length>3000)throw Error('Invalid tide snapshot');
  return {...payload,regions:payload.regions.map(r=>{
    if(!/^tide-\d+$/.test(r.id)||!Number.isFinite(r.lat)||!Number.isFinite(r.lon)||Math.abs(r.lat)>90||Math.abs(r.lon)>180||r.values?.length!==32||r.values.some(v=>v!==null&&!Number.isFinite(v)))throw Error('Invalid tide station');
    return {...r,years:r.values.map((value,i)=>({year:1993+i,value,reason:r.missing[1993+i]||null}))};
  })};
}
export function tideColor(value){
  if(!Number.isFinite(value))return '#778c98';
  const t=Math.min(1,Math.abs(value)/300),a=[90,141,159],b=value>=0?[248,198,130]:[125,228,223];
  return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
}
export function tideReason(row){return row?.reason==='flagged'?'品質フラグにより比較対象外':row?.reason==='incomplete'?'年間の欠日が多いため比較対象外':'この年の記録なし';}
export function tideStatistics(data,point){
  if(!point?.stationId)return null;
  const id=`climate-sealevel-${point.id}`,rows=point.years.filter(r=>Number.isFinite(r.value)).map(r=>({id:`${id}-${r.year}`,label:String(r.year),period:String(r.year),year:r.year,x:r.year,y:r.value,value:r.value,provenance:'DERIVED'}));
  return {id,modeId:'sealevel',title:`${point.name} / 沿岸の相対海面・1993年比`,rows,unit:'mm',xKind:'year',xLabel:'年',yLabel:'相対海面・1993年比',valueLabel:'相対海面・1993年比',defaultMethod:'discovery',periodStart:1993,periodEnd:2024,periodLabel:'1993–2024',missingCount:32-rows.length,derivedFromSourceOnly:true,provenance:['DERIVED'],insightContext:{domain:'climate',axis:'time-series',measurementKind:'DERIVED'},sourceName:'PSMSL / 原観測機関',sourceUrl:tideSource(point.stationId),comparisonNote:`${TIDE_GUIDE} ${data.method} ${data.citation}`};
}
