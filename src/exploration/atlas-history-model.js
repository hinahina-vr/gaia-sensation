export const ATLAS_EXHIBITS = Object.freeze([
  {id:'waterstore',number:'75',shortTitle:'大地に残る水',signalLabel:'陸水量の変化',subtitle:'土の中にも、川のほかにも、水は蓄えられている',
    picker:'GRACE / GRACE-FOの重力観測から、陸に蓄えられた水の増減を地図へ。陸地を選び、同じ場所の年変化をたどります。',
    source:'https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/',organisation:'NASA JPL / GRACE・GRACE-FO',category:'世界 · 水と森',unit:'cm',metric:'陸水量偏差 · 観測月平均',range:[-30,30],colors:['#cf9666','#263f49','#86ded7'],labels:['−30','0','+30 cm'],view:'boxes',start:2003,end:2024,
    guide:'NASA JPL RL06.3 v4の陸域格子。2004–2009年平均からの水量の差を水の厚さ（cm）で表します。地下水・土壌水・地表水・雪氷などを含みます。配布0.5度、推定は約3度の広域単位です。地図と選択セルは年内の観測解平均、有効9暦月以上・9観測以上を採用。4つの地域の点は固定矩形の平均を開き、こちらは観測月の等重み平均です。基準より多いと青緑、少ないと橙。色面は近隣の有効格子をぼかして滑らかにつないでいます。地点選択・数値・統計は元の格子値を使用。灰色は有効月不足。衛星交代期などの欠測はそのまま残します。色の範囲を超えた値は数値で確認できます。'},
 ].map(d=>Object.freeze({...d,atlas:true})));
export const atlasDefinition = id => ATLAS_EXHIBITS.find(d=>d.id===id);
export function atlasRow(region,year,month) {
  const row=region?.years.find(r=>r.year===year);
  return row&&Array.isArray(row.monthValues)?{year,value:row.monthValues[(month||9)-1]??null}:row;
}
export const atlasFormat = value => Number.isFinite(value)?value.toLocaleString('ja-JP',{maximumFractionDigits:1}):'欠測';
export function atlasColor(d,value) {
  if(!Number.isFinite(value))return '#566772';
  const f=Math.max(0,Math.min(1,(value-d.range[0])/(d.range[1]-d.range[0]))), part=Math.min(1,Math.floor(f*2)), t=f*2-part;
  const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
  const a=rgb(d.colors[part]),b=rgb(d.colors[part+1]);
  return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
}
export function atlasInsight(d,region,year,month=d.defaultMonth) {
  const row=atlasRow(region,year,month);
  if(!Number.isFinite(row?.value))return `${year}年は比較に使える記録がありません。`;
  const baseYear=d.view==='countries'||d.monthly?2000:d.start, base=atlasRow(region,baseYear,month);
  const delta=Number.isFinite(base?.value)?row.value-base.value:null;
  const change=delta===null||year===baseYear?'':`${baseYear}年から${atlasFormat(Math.abs(delta))}${d.unit==='%'?'ポイント':d.unit}${delta<0?'低下':delta>0?'上昇':'の差'}。`;
  return `${region.name} · ${year}年${d.monthly?`${month}月`:''} ${atlasFormat(row.value)} ${d.unit}。${change}${d.monthly?'同じ月で比較。':''}${d.id==='waterstore'?`有効${row.months}/12か月。`:''}`;
}
export function atlasStatistics(d,data,region,month=d.defaultMonth) {
  if(!region)return null;
  if(d.monthly&&(!Number.isInteger(month)||month<1||month>12))return null;
  const id=`climate-${d.id}-${region.id}${d.monthly?`-m${String(month).padStart(2,'0')}`:''}`,provenance=d.provenance||(d.view==='countries'||d.id==='seaice'?'SOURCE':'DERIVED');
  const rows=region.years.map(r=>atlasRow(region,r.year,month)).filter(r=>Number.isFinite(r.value)&&!r.censored&&!r.invalidComposition).map(r=>({id:`${id}-${r.year}`,label:String(r.year),period:String(r.year),year:r.year,x:r.year,y:r.value,value:r.value,provenance}));
  return {id,modeId:d.id,title:`${region.name} / ${d.metric}${d.monthly?` · ${month}月`:''}`,rows,unit:d.unit,xKind:'year',xLabel:'年',yLabel:d.metric,valueLabel:d.metric,defaultMethod:'discovery',
    periodStart:rows[0]?.year,periodEnd:rows.at(-1)?.year,periodLabel:`${rows[0]?.year}–${rows.at(-1)?.year}`,missingCount:region.years.length-rows.length,
    derivedFromSourceOnly:provenance==='DERIVED',provenance:[provenance],insightContext:{domain:d.view==='countries'?'national':'climate',axis:'time-series',measurementKind:provenance},
    sourceName:d.organisation,sourceUrl:d.source,comparisonNote:`${d.monthly?`${month}月だけの年次比較。`:''}${d.guide} ${data.method||''}`};
}
