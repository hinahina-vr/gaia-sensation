import {atlasRow,atlasFormat,atlasStatistics} from './atlas-history-model.js?v=whole-trends20-20261025';
import {paintSanitationHistory} from './sanitation-composition.js?v=sanitation-polish-20261023';

export const SANITATION_MODES=Object.freeze({
  safe:{metric:'安全に管理',color:'#a7dfcf',code:'SH.STA.SMSS.ZS'},
  basic:{metric:'基本サービスのみ',color:'#83b8cf'},
  limited:{metric:'共用・未改善',color:'#d9bc89'},
  open:{metric:'野外排泄',color:'#cf8e80',code:'SH.STA.ODFC.ZS'}
});
const keys=Object.keys(SANITATION_MODES),round=v=>Math.round(v*10000)/10000;
const valid=v=>Number.isFinite(v)&&v>=0&&v<=100?v:null;
// The source snapshots round to four decimals; tolerate only their rounding error.
const difference=(a,b)=>a===null||b===null||a-b<-.0002?null:round(Math.max(0,a-b));
export function sanitationRow(region,services,year){
  const row=atlasRow(services?.regions.find(r=>r.id===region?.id),year),safe=valid(atlasRow(region,year)?.value),basic=valid(row?.basic),open=valid(row?.open);
  const result={safe,basic:difference(basic,safe),limited:difference(basic===null?null:100-basic,open),open};
  // Inconsistent component series may still provide usable direct observations.
  return {...result,complete:keys.every(k=>result[k]!==null)&&Math.abs(keys.reduce((sum,k)=>sum+result[k],0)-100)<=.0003};
}
export function sanitationDefinition(d,mode){
  const m=SANITATION_MODES[mode];
  return {...d,metric:m.metric,unit:'%',range:[0,100],colors:['#18313e','#557e87',m.color],labels:['0','50','100%']};
}
const derived=new WeakMap();
export function sanitationData(data,services,mode){
  if(mode==='safe')return data;
  let byData=derived.get(services);if(!byData){byData=new WeakMap();derived.set(services,byData);}
  let modes=byData.get(data);if(!modes){modes={};byData.set(data,modes);}
  return modes[mode]??=({...data,regions:data.regions.map(r=>({...r,years:r.years.map(y=>({year:y.year,value:sanitationRow(r,services,y.year)[mode]}))}))});
}
export function sanitationStatistics(d,data,services,region,mode){
  if(!region)return null;
  if(mode==='safe')return atlasStatistics(d,data,region);
  const m=SANITATION_MODES[mode],definition={...sanitationDefinition(d,mode),provenance:m.code?'SOURCE':'DERIVED',guide:services.method};
  const result=atlasStatistics(definition,data,sanitationData(data,services,mode).regions.find(r=>r.id===region.id));
  return {...result,id:`${result.id}-${mode}`,sourceUrl:m.code?`https://data.worldbank.org/indicator/${m.code}`:'https://washdata.org/topics/sanitation',rows:result.rows.map(r=>({...r,id:`${r.id}-${mode}`}))};
}
const percent=v=>Number.isFinite(v)?`${atlasFormat(v)}%`:'欠測';
export function createSanitationPanel(legend,{setMode,setYear}){
  const panel=document.createElement('div');panel.dataset.sanitationPanel='';panel.hidden=true;
  panel.innerHTML=`<header class="sanitation-heading"><h3 data-sanitation-country></h3><span data-sanitation-year></span></header>
    <div class="sanitation-stack" role="img">${keys.map(k=>`<i data-sanitation-stack="${k}" style="--service-color:${SANITATION_MODES[k].color}"></i>`).join('')}</div>
    <p class="sanitation-caption">人口に占める割合 · 区分を選んで地図で比較</p>
    <div class="sanitation-services" role="group" aria-label="地図で比較する衛生サービス">${keys.map(k=>`<button type="button" data-sanitation-mode="${k}" aria-pressed="${k==='safe'}" style="--service-color:${SANITATION_MODES[k].color}"><i></i><span>${k==='basic'?'基本のみ':SANITATION_MODES[k].metric}</span><b data-sanitation-rate="${k}"></b></button>`).join('')}</div>
    <div class="sanitation-history"><p>衛生サービスの内訳 · 人口100%</p><canvas width="600" height="160" data-sanitation-chart role="slider" tabindex="0" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas><div class="sanitation-chart-labels" aria-hidden="true"><span>2000</span><span>年を選択</span><span>2024</span></div></div>`;
  legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('canvas');let currentYear=2016;
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-sanitation-mode]');if(b)setMode(b.dataset.sanitationMode);});
  chart.addEventListener('pointerdown',e=>e.stopPropagation());chart.addEventListener('dblclick',e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const r=chart.getBoundingClientRect();setYear(Math.max(2000,Math.min(2024,Math.floor((e.clientX-r.left)/r.width*25)+2000)));});
  chart.addEventListener('keydown',e=>{const y={ArrowLeft:currentYear-1,ArrowDown:currentYear-1,ArrowRight:currentYear+1,ArrowUp:currentYear+1,Home:2000,End:2024}[e.key];if(y===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,y)));});
  return {panel,sync({services,region,year,mode}){
    currentYear=year;const row=sanitationRow(region,services,year);
    q('[data-sanitation-country]').textContent=region?.name||'国を選択';q('[data-sanitation-year]').textContent=`${year}年`;
    const stack=q('.sanitation-stack');stack.dataset.missing=String(!row.complete);stack.setAttribute('aria-label',row.complete?keys.map(k=>`${SANITATION_MODES[k].metric} ${percent(row[k])}`).join('、'):'内訳に必要な記録が揃っていません');
    for(const k of keys){q(`[data-sanitation-stack="${k}"]`).style.width=`${row.complete?row[k]:0}%`;q(`[data-sanitation-rate="${k}"]`).textContent=percent(row[k]);const button=q(`[data-sanitation-mode="${k}"]`);button.setAttribute('aria-pressed',String(k===mode));button.setAttribute('aria-label',`${SANITATION_MODES[k].metric} ${percent(row[k])}`);}
    paintSanitationHistory(chart.getContext('2d'),Array.from({length:25},(_,i)=>({year:2000+i,...sanitationRow(region,services,2000+i)})),{year,mode,modes:SANITATION_MODES});
    chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-label',`${region?.name}、衛生サービスの内訳。縦軸は人口の0–100%。2000–2024年。${year}年：${stack.getAttribute('aria-label')}。斜線は内訳の欠測。欠測の前後は帯をつなぎません。`);
  }};
}
