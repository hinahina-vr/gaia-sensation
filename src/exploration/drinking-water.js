import {atlasRow,atlasFormat,atlasStatistics} from './atlas-history-model.js?v=whole-trends20-20261025';
import {drinkingRateY} from './drinking-water-reading.js?v=drinking-polish-20261023';

export const DRINKING_MODES=Object.freeze({
  national:{metric:'安全管理された飲料水',unit:'%',range:[0,100],colors:['#133444','#438a9c','#a8ebe4'],labels:['0','50','100%']},
  gap:{metric:'都市 − 農村',unit:'ポイント',range:[-50,50],colors:['#82ddd6','#233947','#efc791'],labels:['農村が高い','差 0','都市が高い']}
});
export const drinkingDefinition=(d,mode)=>({...d,...DRINKING_MODES[mode]});
export function drinkingRow(comparison,id,year){
  const row=atlasRow(comparison?.regions.find(r=>r.id===id),year);
  return {urban:row?.urban??null,rural:row?.rural??null,gap:Number.isFinite(row?.urban)&&Number.isFinite(row?.rural)?Math.round((row.urban-row.rural)*10000)/10000:null};
}
const derived=new WeakMap();
export function drinkingData(data,comparison,mode){
  if(mode==='national')return data;
  if(!derived.has(comparison))derived.set(comparison,{...data,regions:data.regions.map(r=>({...r,years:r.years.map(y=>({year:y.year,value:drinkingRow(comparison,r.id,y.year).gap}))}))});
  return derived.get(comparison);
}
export function drinkingStatistics(d,data,comparison,region,mode){
  if(!region)return null;
  if(mode==='national')return atlasStatistics(d,data,region);
  const definition={...drinkingDefinition(d,mode),provenance:'DERIVED',guide:comparison.method};
  const result=atlasStatistics(definition,data,drinkingData(data,comparison,mode).regions.find(r=>r.id===region.id));
  return {...result,id:`${result.id}-gap`,sourceUrl:'https://washdata.org/topics/drinking-water',sourceName:'WHO / UNICEF JMP · WDI 都市・農村系列',rows:result.rows.map(r=>({...r,id:`${r.id}-gap`}))};
}
const percent=v=>Number.isFinite(v)?`${atlasFormat(v)}%`:'欠測';
export const drinkingGapLabel=value=>!Number.isFinite(value)?'比較できる記録がありません':value===0?'都市と農村は同じ割合':`${value>0?'都市':'農村'}が ${atlasFormat(Math.abs(value))} pt 高い`;
export function createDrinkingPanel(legend,{setMode,setYear,selectCountry}){
  const panel=document.createElement('div');panel.dataset.drinkingPanel='';panel.hidden=true;
  panel.innerHTML=`<header class="drinking-heading"><h3 data-drinking-country></h3><span data-drinking-year></span></header>
    <div class="drinking-pair" aria-label="安全管理された飲料水の利用率">
      <div><span>都市</span><div class="drinking-track"><i data-drinking-bar="urban"></i></div><b data-drinking-rate="urban"></b></div>
      <div><span>農村</span><div class="drinking-track"><i data-drinking-bar="rural"></i></div><b data-drinking-rate="rural"></b></div>
    </div><p class="drinking-gap" data-drinking-gap></p>
    <p class="drinking-chart-title">都市と農村、それぞれの25年</p>
    <div class="drinking-chart"><canvas data-drinking-chart width="600" height="150" role="slider" tabindex="0" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas><div class="drinking-chart-labels" aria-hidden="true"><span class="drinking-axis-high">100%</span><span class="drinking-axis-zero">50</span><span class="drinking-axis-low">0</span><span class="drinking-year-first">2000</span><span class="drinking-year-last">2024</span></div></div>
    <div class="drinking-modes" role="group" aria-label="地図で比較する飲料水の指標"><button type="button" data-drinking-mode="national" aria-pressed="false">全国の利用率</button><button type="button" data-drinking-mode="gap" aria-pressed="true">都市と農村の差</button></div>
    <p class="drinking-national">全国 <strong data-drinking-national></strong><span>各区分の人口に占める割合</span></p>
    <div class="drinking-places"><button type="button" data-drinking-place="IND">インド</button><button type="button" data-drinking-place="BGD">バングラデシュ</button><button type="button" data-drinking-place="PER">ペルー</button></div>`;
  legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('canvas');let currentYear=2016;
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-drinking-mode]'),p=e.target.closest('[data-drinking-place]');if(b)setMode(b.dataset.drinkingMode);if(p)selectCountry(p.dataset.drinkingPlace);});
  chart.addEventListener('pointerdown',e=>e.stopPropagation());chart.addEventListener('dblclick',e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const r=chart.getBoundingClientRect();setYear(Math.max(2000,Math.min(2024,Math.round(2000+((e.clientX-r.left)/r.width*600-42)/22))));});
  chart.addEventListener('keydown',e=>{const y={ArrowLeft:currentYear-1,ArrowDown:currentYear-1,ArrowRight:currentYear+1,ArrowUp:currentYear+1,Home:2000,End:2024}[e.key];if(y===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,y)));});
  return {panel,sync({data,comparison,region,year,mode}){
    currentYear=year;const row=drinkingRow(comparison,region?.id,year),national=atlasRow(region,year)?.value;
    q('[data-drinking-country]').textContent=region?.name||'国を選択';q('[data-drinking-year]').textContent=`${year}年`;
    for(const key of ['urban','rural']){
      q(`[data-drinking-rate="${key}"]`).textContent=percent(row[key]);const bar=q(`[data-drinking-bar="${key}"]`);bar.style.width=`${Number.isFinite(row[key])?row[key]:0}%`;bar.parentElement.dataset.missing=String(!Number.isFinite(row[key]));
    }
    q('[data-drinking-gap]').textContent=drinkingGapLabel(row.gap);q('[data-drinking-national]').textContent=percent(national);
    for(const b of panel.querySelectorAll('[data-drinking-mode]'))b.setAttribute('aria-pressed',String(b.dataset.drinkingMode===mode));
    for(const b of panel.querySelectorAll('[data-drinking-place]'))b.setAttribute('aria-pressed',String(b.dataset.drinkingPlace===region?.id));
    const c=chart.getContext('2d'),x=y=>42+(y-2000)*22;
    c.clearRect(0,0,600,150);
    for(const v of [0,50,100]){c.strokeStyle='#a9cbd225';c.lineWidth=1;c.beginPath();c.moveTo(42,drinkingRateY(v));c.lineTo(570,drinkingRateY(v));c.stroke();}
    const rows=Array.from({length:data.period[1]-data.period[0]+1},(_,i)=>({year:data.period[0]+i,...drinkingRow(comparison,region?.id,data.period[0]+i)}));
    const shade=c.createLinearGradient(0,12,0,122);shade.addColorStop(0,'#efc79138');shade.addColorStop(1,'#82ddd638');c.fillStyle=shade;
    for(let i=1;i<rows.length;i++){
      const a=rows[i-1],b=rows[i];if(![a.urban,a.rural,b.urban,b.rural].every(Number.isFinite))continue;
      c.beginPath();c.moveTo(x(a.year),drinkingRateY(a.urban));c.lineTo(x(b.year),drinkingRateY(b.urban));c.lineTo(x(b.year),drinkingRateY(b.rural));c.lineTo(x(a.year),drinkingRateY(a.rural));c.closePath();c.fill();
    }
    c.strokeStyle='#d5eeec65';c.lineWidth=1;c.beginPath();c.moveTo(x(year),8);c.lineTo(x(year),126);c.stroke();
    for(const [key,color]of [['urban','#efc791'],['rural','#82ddd6']]){
      c.strokeStyle=color;c.lineWidth=3;c.lineJoin='round';c.beginPath();let connected=false;
      for(const r of rows){const y=drinkingRateY(r[key]);if(y===null){connected=false;continue;}if(connected)c.lineTo(x(r.year),y);else c.moveTo(x(r.year),y);connected=true;}c.stroke();
      c.fillStyle=color;for(const r of rows)if(Number.isFinite(r[key])){c.beginPath();c.arc(x(r.year),drinkingRateY(r[key]),r.year===year?5:1.8,0,Math.PI*2);c.fill();}
    }
    chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-label',`${region?.name}、都市と農村の利用率。縦軸0–100%。2000–2024年。${year}年：都市${percent(row.urban)}、農村${percent(row.rural)}。${drinkingGapLabel(row.gap)}。金色は都市、青緑は農村。欠測の区間は線をつなぎません。`);
  }};
}
