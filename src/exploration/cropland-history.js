import {atlasRow,atlasFormat,atlasStatistics} from './atlas-history-model.js?v=release100-c363-20261027';

export const CROPLAND_MODES=Object.freeze(['change','share']);
const valid=v=>Number.isFinite(v)&&v>=0&&v<=100?v:null;
export const croplandSigned=v=>{if(!Number.isFinite(v))return '欠測';const value=atlasFormat(Math.abs(v));return `${Number(value.replaceAll(',',''))===0?'':v>0?'＋':v<0?'−':''}${value}`;};
export function croplandReading(region,year){
  const base=valid(atlasRow(region,2000)?.value),value=valid(atlasRow(region,year)?.value);
  return {base,value,change:base===null||value===null?null:Math.round((value-base)*10000)/10000};
}
export function croplandDefinition(d,mode){
  return mode==='share'?d:{...d,metric:'耕地面積率 · 2000年との差',unit:'ポイント',range:[-5,5],colors:['#76b9d5','#34474d','#eac47b'],labels:['−5以下','0','＋5以上 pt']};
}
const derived=new WeakMap();
export function croplandData(data,mode){
  if(mode==='share')return data;
  if(!derived.has(data))derived.set(data,{...data,regions:data.regions.map(r=>({...r,years:r.years.map(y=>({year:y.year,value:croplandReading(r,y.year).change}))}))});
  return derived.get(data);
}
export function croplandStatistics(d,data,region,mode){
  if(!region)return null;
  if(mode==='share')return atlasStatistics(d,data,region);
  const definition={...croplandDefinition(d,mode),provenance:'DERIVED',guide:`${d.guide} 同じ国の各年の耕地面積率から2000年の値を引いた差（ポイント）。基準年か比較年の欠測は除外。`};
  const result=atlasStatistics(definition,data,croplandData(data,mode).regions.find(r=>r.id===region.id));
  return {...result,id:`${result.id}-change`,rows:result.rows.map(r=>({...r,id:`${r.id}-change`}))};
}
export const CROPLAND_CHART=Object.freeze({width:600,height:180,left:56,right:586,top:18,bottom:148,start:2000,end:2024});
export function croplandChartYear(fraction){
  const g=CROPLAND_CHART;
  return Math.max(g.start,Math.min(g.end,g.start+Math.floor((fraction*g.width-g.left)/(g.right-g.left)*25)));
}
export function croplandChartLimit(region){
  return Math.max(1,Math.ceil(Math.max(0,...(region?.years||[]).map(r=>Math.abs(croplandReading(region,r.year).change??0)))));
}
export function createCroplandPanel(legend,{setMode,setYear,selectCountry}){
  const panel=document.createElement('div');panel.dataset.croplandPanel='';panel.hidden=true;
  panel.innerHTML=`<header class="cropland-heading"><h3 data-cropland-country></h3><span data-cropland-year></span></header>
    <div class="cropland-reading"><span>2000年から</span><strong data-cropland-change></strong><small>pt</small></div>
    <div class="cropland-composition"><p>陸地100に占める耕地</p>
      <div><span>2000</span><div class="cropland-track" data-cropland-track="base"><i data-cropland-bar="base"></i></div><b data-cropland-base></b></div>
      <div><span data-cropland-current-year></span><div class="cropland-track" data-cropland-track="current"><i data-cropland-bar="current"></i></div><b data-cropland-current></b></div>
      <small><i></i>耕地<span>それ以外の陸地</span></small>
    </div>
    <div class="cropland-history-heading"><span data-cropland-history-title></span><small>年をタップして比較</small></div>
    <canvas data-cropland-chart width="600" height="180" tabindex="0" role="slider" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas>
    <div class="cropland-modes" role="group" aria-label="地図で見る耕地の指標"><button type="button" data-cropland-mode="change">2000年からの増減</button><button type="button" data-cropland-mode="share">耕地の割合</button></div>
    <div class="cropland-places" role="group" aria-label="耕地の変化を比較する国"><button type="button" data-cropland-place="ETH">エチオピア</button><button type="button" data-cropland-place="IND">インド</button><button type="button" data-cropland-place="JPN">日本</button></div>`;
  legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('canvas');let currentYear=2016,currentRegion=null,currentMode='change';
  panel.addEventListener('click',e=>{const mode=e.target.closest('[data-cropland-mode]'),place=e.target.closest('[data-cropland-place]');if(mode)setMode(mode.dataset.croplandMode);if(place)selectCountry(place.dataset.croplandPlace);});
  chart.addEventListener('pointerdown',e=>e.stopPropagation());chart.addEventListener('dblclick',e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const r=chart.getBoundingClientRect();setYear(croplandChartYear((e.clientX-r.left)/r.width));});
  chart.addEventListener('keydown',e=>{const next={ArrowLeft:currentYear-1,ArrowDown:currentYear-1,ArrowRight:currentYear+1,ArrowUp:currentYear+1,Home:2000,End:2024}[e.key];if(next===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,next)));});
  const sync=({region,year,mode})=>{
    currentYear=year;currentRegion=region;currentMode=mode;const r=croplandReading(region,year),change=mode==='change',color=r.change===null?'#a5b4ba':r.change<0?'#90c8df':'#edcf90';
    panel.style.setProperty('--cropland-change',color);
    q('[data-cropland-country]').textContent=region?.name||'国を選択';q('[data-cropland-year]').textContent=`${year}年`;
    q('[data-cropland-change]').textContent=croplandSigned(r.change);q('.cropland-reading small').hidden=r.change===null;
    q('[data-cropland-current-year]').textContent=String(year);
    for(const [key,value] of [['base',r.base],['current',r.value]]){
      q(`[data-cropland-${key}]`).textContent=value===null?'欠測':`${atlasFormat(value)}%`;
      q(`[data-cropland-track="${key}"]`).dataset.missing=String(value===null);
      q(`[data-cropland-bar="${key}"]`).style.width=`${value??0}%`;
    }
    for(const key of CROPLAND_MODES)q(`[data-cropland-mode="${key}"]`).setAttribute('aria-pressed',String(key===mode));
    for(const b of panel.querySelectorAll('[data-cropland-place]'))b.setAttribute('aria-pressed',String(b.dataset.croplandPlace===region?.id));
    q('[data-cropland-history-title]').textContent=change?'耕地率の増減 · 2000年基準':'耕地の割合 · %';
    const height=Math.round(parseFloat(getComputedStyle(chart).height)/90*180);
    if(Number.isFinite(height)&&height>0&&chart.height!==height)chart.height=height;
    const g={...CROPLAND_CHART,height:chart.height,bottom:chart.height-32},c=chart.getContext('2d'),limit=change?croplandChartLimit(region):100,low=change?-limit:0,step=(g.right-g.left)/25,y=v=>g.bottom-(v-low)/(limit-low)*(g.bottom-g.top),zero=y(0);
    c.clearRect(0,0,g.width,g.height);c.font='18px serif';c.textAlign='right';c.fillStyle='#a9bdbd';
    for(const v of [limit,0,...(change?[-limit]:[])]){c.fillText(String(v),g.left-9,y(v)+5);c.strokeStyle=v===0?'#cfdbcd77':'#abc4c21b';c.beginPath();c.moveTo(g.left,y(v));c.lineTo(g.right,y(v));c.stroke();}
    // One stem and endpoint per published year. No interpolated years or fields.
    for(let yr=2000;yr<=2024;yr++){
      const reading=croplandReading(region,yr),v=change?reading.change:reading.value,x=g.left+(yr-2000)*step+2,bw=step-4;
      c.globalAlpha=yr===year?1:.76;
      if(yr===year){c.fillStyle='#d5e5cf12';c.fillRect(x-1,g.top,bw+2,g.bottom-g.top);c.strokeStyle='#dce8d63d';c.lineWidth=1;c.beginPath();c.moveTo(x+bw/2,g.top);c.lineTo(x+bw/2,g.bottom);c.stroke();}
      if(v!==null){c.strokeStyle=c.fillStyle=v<0?'#90c8df':'#edcf90';c.lineWidth=yr===year?3:1.5;c.beginPath();c.moveTo(x+bw/2,zero);c.lineTo(x+bw/2,y(v));c.stroke();c.beginPath();c.arc(x+bw/2,y(v),yr===year?4:2.6,0,Math.PI*2);c.fill();}
      else{c.strokeStyle='#a5b4ba';c.beginPath();c.moveTo(x,zero-4);c.lineTo(x+bw,zero+4);c.stroke();}
    }
    c.globalAlpha=1;c.fillStyle='#a9bdbd';c.textAlign='left';c.fillText('2000',g.left,g.height-4);c.textAlign='right';c.fillText('2024',g.right,g.height-4);
    chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-valuetext',`${year}年、耕地面積率 ${r.value===null?'欠測':`${atlasFormat(r.value)}%`}、2000年との差 ${croplandSigned(r.change)}${r.change===null?'':'ポイント'}`);
    chart.setAttribute('aria-label',`${region?.name||''}の${change?'耕地面積率の増減':'耕地面積率'}。2000–2024年、縦軸${low}–${limit}${change?'ポイント':'%' }。欠測は斜線。矢印キーで年を選択。`);
  };
  new ResizeObserver(()=>{if(currentRegion&&!panel.hidden&&chart.clientWidth)sync({region:currentRegion,year:currentYear,mode:currentMode});}).observe(chart);
  return {panel,sync};
}
