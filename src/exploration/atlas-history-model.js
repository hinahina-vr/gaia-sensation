import {ATLAS_CENTURY_EXHIBITS} from './atlas-century-model.js?v=release100-c363-20261027';
import {ATLAS_EXPANSION_EXHIBITS} from './atlas-expansion-model.js?v=release100-c363-20261027';
import {waterStressColor} from './water-stress.js';
export const ATLAS_EXHIBITS = Object.freeze([
  {id:'waterstore',number:'75',shortTitle:'大地に残る水',signalLabel:'陸水量の変化',subtitle:'土の中にも、川のほかにも、水は蓄えられている',
    picker:'GRACE / GRACE-FOの重力観測から、陸に蓄えられた水の増減を地図へ。陸地を選び、同じ場所の年変化をたどります。',
    source:'https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/',organisation:'NASA JPL / GRACE・GRACE-FO',category:'世界 · 水と森',unit:'cm',metric:'陸水量偏差 · 観測月平均',range:[-30,30],colors:['#cf9666','#263f49','#86ded7'],labels:['−30','0','+30 cm'],view:'boxes',start:2003,end:2024,
    guide:'NASA JPL RL06.3 v4の陸域格子。2004–2009年平均からの水量の差を水の厚さ（cm）で表します。地下水・土壌水・地表水・雪氷などを含みます。配布0.5度、推定は約3度の広域単位です。地図と選択セルは年内の観測解平均、有効9暦月以上・9観測以上を採用。4つの地域の点は固定矩形の平均を開き、こちらは観測月の等重み平均です。基準より多いと青緑、少ないと橙。色面は近隣の有効格子をぼかして滑らかにつないでいます。地点選択・数値・統計は元の格子値を使用。灰色は有効月不足。衛星交代期などの欠測はそのまま残します。色の範囲を超えた値は数値で確認できます。'},
  {id:'sealevel',number:'76',shortTitle:'少しずつ、高くなる海',signalLabel:'海域平均の海面高度',subtitle:'小さな高さの違いに、長い時間の変化が積もる',
    picker:'沿岸の検潮所を選び、同じ港の海面の変化をたどります。衛星が測った3つの大洋の平均も開けます。',
    source:'https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/',organisation:'NOAA Laboratory for Satellite Altimetry',category:'世界 · 水と森',unit:'mm',metric:'海域平均海面高度 · 1993年比',range:[-120,120],colors:['#789ab7','#4a8caa','#a2e6e2'],labels:['−120','0','+120 mm'],view:'levels',start:1993,end:2024,
    guide:'NOAAの実験的な衛星海面高度プロダクト。太平洋・大西洋・インド洋の記録を暦年で平均し、同じ海域の1993年平均からの差を表示。全12か月に観測がある年を採用し、各年の衛星系列を1つに絞って集計。地図の四角は海域全体の平均を開きます。対象は概ね北緯66度〜南緯66度。逆気圧補正あり、GIA補正なし。'},
  {id:'electricity',number:'77',shortTitle:'電気が届くまで',signalLabel:'電気を利用できる人口の割合',subtitle:'日々の暮らしを支える電気は、どこまで届いているだろう',
    picker:'世界銀行の国・地域別電力アクセス率。国の色と年の切り替えで、普及の違いを比べます。',
    source:'https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS',code:'EG.ELC.ACCS.ZS',organisation:'World Bank / SDG 7.1.1',category:'世界 · 資源とエネルギー',unit:'%',metric:'電力アクセス率',range:[0,100],colors:['#222f43','#6a769a','#e2d7a4'],labels:['0','50','100%'],view:'countries',start:2000,end:2024,
    guide:'電気を利用できる人口の割合。世界銀行WDI対象の公表・推計値を国・地域単位で表示しています。明るい色ほど割合が高く、灰色は選択年の欠測。普及率には供給の安定性・料金・夜間光の明るさの情報は含まれません。独自の補間や欠測のゼロ置換は行いません。'},
  {id:'drinking',number:'78',shortTitle:'毎日の水を、家で',signalLabel:'基本的な飲料水サービス',subtitle:'日々の飲み水へのアクセスを、国ごとにたどる',
    picker:'WHO・UNICEF JMPの飲料水サービス統計。基本サービス以上を利用する人口の割合を比べ、安全に管理された飲料水にも切り替えられます。',
    source:'https://data.worldbank.org/indicator/SH.H2O.BASW.ZS',code:'SH.H2O.BASW.ZS',organisation:'WHO / UNICEF JMP · World Bank WDI',category:'世界 · 人口と暮らし',unit:'%',metric:'基本的な飲料水サービス',range:[0,100],colors:['#183d4c','#378caa','#a2e6ed'],labels:['0','50','100%'],view:'countries',start:2000,end:2024,
    guide:'改善された水源を使い、水汲みの往復時間が待ち時間込みで30分以内の人口の割合。安全に管理されたサービスも含みます。WHO・UNICEF JMPの推計を世界銀行WDIから取得。欠測は灰色で残し、独自の補間は行いません。'},
  {id:'sanitation',number:'79',shortTitle:'トイレの先まで、安全に',signalLabel:'安全に管理された衛生設備',subtitle:'トイレを使ったあとも、排泄物を安全に処理する',
    picker:'WHO・UNICEF JMPの衛生統計。安全に管理された衛生設備を使う人口の割合を比べます。',
    source:'https://data.worldbank.org/indicator/SH.STA.SMSS.ZS',code:'SH.STA.SMSS.ZS',organisation:'WHO / UNICEF JMP · World Bank WDI',category:'世界 · 人口と暮らし',unit:'%',metric:'安全に管理された衛生設備の利用率',range:[0,100],colors:['#263747','#608d9b','#bde3d1'],labels:['0','50','100%'],view:'countries',start:2000,end:2024,
    guide:'他世帯と共用しない改善された衛生設備を利用し、排泄物が現場で安全に処理されるか、搬送先で処理される人口の割合。WHO・UNICEF JMPの推計を世界銀行WDIから取得。公表系列には提供元による補間・推計を含みます。国内の下水道普及率だけに限らない指標です。欠測は灰色とし、独自の補間は行いません。'},
  {id:'foresthistory',number:'80',shortTitle:'森が増えた国、減った国',signalLabel:'森林面積の割合',subtitle:'長い年月をかけて、森と土地の関係は変わっていく',
    picker:'FAO・世界銀行の年次森林統計。各国の森林面積率と2000年からの変化をたどります。',
    source:'https://data.worldbank.org/indicator/AG.LND.FRST.ZS',code:'AG.LND.FRST.ZS',organisation:'FAO / World Bank WDI',category:'世界 · 水と森',unit:'%',metric:'森林面積率',range:[0,100],colors:['#102f27','#227a4c','#8ad489'],labels:['0','50','100%'],view:'countries',start:2000,end:2023,
    guide:'陸地面積に占める森林面積の割合。自然林と人工林を含み、果樹園・農業林・都市公園などは除きます。FAOの国別報告・推計を世界銀行WDIから取得。年次系列には提供元の補間・推計を含むため、年ごとの伐採場所や自然林の質を直接示すものとは区別します。2000年との差はパーセントポイント。欠測を補わず、08の森林分布画像や12の複数層表示とは分けて時系列を比較します。'},
 ...ATLAS_EXPANSION_EXHIBITS, ...ATLAS_CENTURY_EXHIBITS,
 ].map(d=>Object.freeze({...d,atlas:true})));
export const atlasDefinition = id => ATLAS_EXHIBITS.find(d=>d.id===id);
export function atlasRow(region,year,month) {
  const row=region?.years.find(r=>r.year===year);
  return row&&Array.isArray(row.monthValues)?{year,value:row.monthValues[(month||9)-1]??null}:row;
}
export const atlasFormat = value => Number.isFinite(value)?value.toLocaleString('ja-JP',{maximumFractionDigits:1}):'欠測';
export function atlasColor(d,value) {
  if(d.id==='waterstress')return waterStressColor(value);
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
