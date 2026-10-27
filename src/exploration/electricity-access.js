import {atlasRow,atlasFormat,atlasStatistics} from './atlas-history-model.js?v=release100-c363-20261027';

export const ELECTRICITY_MODES=Object.freeze({
  access:{metric:'電力アクセス率',unit:'%',range:[0,100],colors:['#102738','#437f88','#e8c981'],labels:['0','50','100%']},
  change:{metric:'2000年からの変化',unit:'ポイント',range:[-50,50],colors:['#b39cde','#203946','#e8c981'],labels:['−50以下','0','＋50以上 pt']}
});
export const electricityDefinition=(definition,mode)=>({...definition,...ELECTRICITY_MODES[mode]});
// WDI uses the non-ISO code JG for Channel Islands; Intl.DisplayNames returns it verbatim.
export const electricityCountryNames=data=>({...data,regions:data.regions.map(r=>r.id==='CHI'?{...r,name:'チャネル諸島'}:r)});
const changeCache=new WeakMap();
export function electricityData(data,mode){
  if(mode!=='change')return data;
  if(!changeCache.has(data))changeCache.set(data,{...data,regions:data.regions.map(r=>{
    const base=atlasRow(r,2000)?.value;
    return {...r,years:r.years.map(row=>({...row,value:Number.isFinite(base)&&Number.isFinite(row.value)?Math.round((row.value-base)*10000)/10000:null}))};
  })});
  return changeCache.get(data);
}
export function electricityComparison(comparison,region,year){
  const group=comparison?.regions.find(g=>g.id===comparison.countryRegions[region?.id]);
  return {group,value:atlasRow(region,year)?.value??null,base:atlasRow(region,2000)?.value??null,regional:atlasRow(group,year)?.value??null};
}
export function electricityStatistics(definition,data,region,mode){
  if(!region)return null;
  if(mode!=='change')return atlasStatistics(definition,data,region);
  const d={...electricityDefinition(definition,mode),provenance:'DERIVED',guide:'2000年からの電力アクセス率の変化（ポイント）。同じWDI系列の差。基準年・対象年のどちらかが欠測なら除外。'};
  const result=atlasStatistics(d,data,electricityData(data,mode).regions.find(r=>r.id===region.id));
  return {...result,id:`${result.id}-change`,rows:result.rows.map(r=>({...r,id:`${r.id}-change`}))};
}
const signed=n=>Number.isFinite(n)?`${n>0?'＋':n<0?'−':''}${atlasFormat(Math.abs(n))}`:'欠測';
export function createElectricityPanel(legend,{setMode,setYear,selectCountry}){
  const panel=document.createElement('div');panel.dataset.electricityPanel='';panel.hidden=true;
  panel.innerHTML=`<div class="electricity-heading"><h3 data-electricity-country></h3><span><b data-electricity-value></b><small data-electricity-year></small></span></div>
    <p class="electricity-change"><span>2000年から</span><strong data-electricity-change></strong></p>
    <canvas data-electricity-chart width="600" height="220" role="slider" tabindex="0" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas>
    <div class="electricity-comparison"><span><i></i>選んだ国</span><span><i></i><b data-electricity-region></b> <em data-electricity-region-value></em></span></div>
    <div class="electricity-modes" role="group" aria-label="地図の色で比較する指標"><button type="button" data-electricity-mode="access" aria-pressed="true">アクセス率</button><button type="button" data-electricity-mode="change" aria-pressed="false">2000年からの変化</button></div>
    <div class="electricity-places" role="group" aria-label="各地の電力アクセスを見る"><button type="button" data-electricity-country-id="KEN">ケニア</button><button type="button" data-electricity-country-id="IND">インド</button><button type="button" data-electricity-country-id="NGA">ナイジェリア</button></div>`;
  legend.prepend(panel);
  panel.addEventListener('click',e=>{const mode=e.target.closest('[data-electricity-mode]'),country=e.target.closest('[data-electricity-country-id]');if(mode)setMode(mode.dataset.electricityMode);if(country)selectCountry(country.dataset.electricityCountryId);});
  let currentYear=2016;
  const chart=panel.querySelector('canvas');
  // The surrounding legend is draggable. Keep its pointer capture off the chart.
  chart.addEventListener('pointerdown',e=>e.stopPropagation());
  chart.addEventListener('dblclick',e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const r=chart.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*600;setYear(Math.max(2000,Math.min(2024,Math.round(2000+(x-40)/548*24))));});
  chart.addEventListener('keydown',e=>{
    const next={ArrowLeft:currentYear-1,ArrowDown:currentYear-1,ArrowRight:currentYear+1,ArrowUp:currentYear+1,Home:2000,End:2024}[e.key];
    if(next===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,next)));
  });
  const q=s=>panel.querySelector(s);
  return {panel,sync({data,comparison,region,year,mode}){
    currentYear=year;chart.setAttribute('aria-valuenow',String(year));
    const {group,value,base,regional}=electricityComparison(comparison,region,year);
    q('[data-electricity-country]').textContent=region?.name||'国を選択';
    q('[data-electricity-value]').textContent=Number.isFinite(value)?`${atlasFormat(value)}%`:'欠測';
    q('[data-electricity-year]').textContent=`${year}年`;
    q('[data-electricity-change]').textContent=Number.isFinite(value)&&Number.isFinite(base)?`${signed(value-base)} pt`:'欠測';
    q('[data-electricity-region]').textContent=group?.name||'地域集計なし';
    q('[data-electricity-region-value]').textContent=Number.isFinite(regional)?`${atlasFormat(regional)}%`:'欠測';
    for(const b of panel.querySelectorAll('[data-electricity-mode]'))b.setAttribute('aria-pressed',String(b.dataset.electricityMode===mode));
    for(const b of panel.querySelectorAll('[data-electricity-country-id]'))b.setAttribute('aria-pressed',String(b.dataset.electricityCountryId===region?.id));
    const c=chart.getContext('2d'),w=600,h=220,left=40,right=588,top=12,bottom=187,x=y=>left+(y-2000)/24*(right-left),y=v=>bottom-v/100*(bottom-top);
    c.clearRect(0,0,w,h);c.font='17px serif';c.lineWidth=1;c.textAlign='right';c.fillStyle='#a8c4ca';
    for(const v of [0,50,100]){c.fillText(String(v),left-8,y(v)+5);c.strokeStyle='#c5d9de20';c.beginPath();c.moveTo(left,y(v));c.lineTo(right,y(v));c.stroke();}
    for(const [r,color,dashed] of [[group,'#83b6c4',true],[region,'#ffe4a3',false]]){
      c.beginPath();c.lineWidth=dashed?2:3;c.strokeStyle=color;c.setLineDash(dashed?[6,6]:[]);let previous=null;
      for(const row of r?.years||[]){if(!Number.isFinite(row.value)){previous=null;continue;}if(previous?.year===row.year-1)c.lineTo(x(row.year),y(row.value));else c.moveTo(x(row.year),y(row.value));previous=row;}c.stroke();
      c.setLineDash([]);c.fillStyle=color;
      for(const row of r?.years||[])if(Number.isFinite(row.value)){c.beginPath();c.arc(x(row.year),y(row.value),row.year===year?5:dashed?0:2,0,Math.PI*2);c.fill();}
    }
    c.strokeStyle='#ffe4a366';c.lineWidth=1;c.beginPath();c.moveTo(x(year),top);c.lineTo(x(year),bottom);c.stroke();
    c.fillStyle='#a8c4ca';c.textAlign='left';c.fillText('2000',left,h-5);c.textAlign='right';c.fillText('2024',right,h-5);
    chart.setAttribute('aria-label',`${region?.name}と${group?.name||'地域集計なし'}の電力アクセス率、2000–2024年。${year}年：${atlasFormat(value)}%、地域 ${atlasFormat(regional)}%。欠測の前後は線を結ばず表示。`);
  }};
}
