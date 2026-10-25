import {countrySourceId} from './country-source-ids.js?v=stress-polish-20261023';
export const LONGEVITY_ARRIVAL_MS=1100;
export const longevityValid=v=>Number.isFinite(v)&&v>=0?v:null;
export const longevityFormat=v=>longevityValid(v)===null?'欠測':v.toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1});
export const longevitySigned=v=>v===null?'比較する記録なし':(v>0?'＋':v<0?'−':'')+longevityFormat(Math.abs(v));
export const longevitySourceId=id=>({KOS:'XKX',JEY:'CHI',GGY:'CHI'}[id]||countrySourceId(id));
export const longevityName=r=>r?.id==='CHI'?'チャネル諸島':r?.name||'国を選択';
const displays=new WeakMap();
export function longevityData(data){
 if(!data)return data;if(!displays.has(data))displays.set(data,{...data,regions:data.regions.map(r=>r.id==='CHI'?{...r,name:longevityName(r)}:r)});
 return displays.get(data);
}
export function longevityReading(region,year){
 const value=longevityValid(region?.years.find(r=>r.year===year)?.value),base=longevityValid(region?.years.find(r=>r.year===2000)?.value);
 return {value,base,change:value===null||base===null?null:Math.round((value-base)*10000)/10000};
}
export function longevityHistory(region){
 const points=[],segments=[];let previous=null;
 for(const row of region?.years||[]){const value=longevityValid(row.value);if(value===null){previous=null;continue;}const p={year:row.year,value};points.push(p);if(previous&&p.year===previous.year+1)segments.push([previous,p]);previous=p;}
 return {points,segments};
}
// Fixed while moving through years, shared by both comparison countries.
export function longevityDomain(...regions){
 const values=regions.flatMap(r=>(r?.years||[]).map(y=>longevityValid(y.value)).filter(v=>v!==null));
 if(!values.length)return [0,100];
 const min=Math.min(...values),max=Math.max(...values);return [Math.max(0,Math.floor((min-2)/5)*5),Math.ceil((max+2)/5)*5];
}
export const longevityChartYear=f=>Math.max(2000,Math.min(2024,2000+Math.round((f*600-54)/526*24)));
export function longevityArrival(index,count,elapsed,reduced=false){
 if(elapsed<0)return 0;if(reduced)return 1;const t=Math.max(0,Math.min(1,(elapsed-(count>1?index/(count-1)*240:0))/860));return t*t*(3-2*t);
}
export function createLongevityPanel(legend,{setYear,setComparison}){
 const panel=document.createElement('div');panel.dataset.longevityPanel='';panel.hidden=true;
 panel.innerHTML=`<header class="longevity-heading"><h3 data-longevity-country></h3><span data-longevity-year></span></header>
 <p class="longevity-measure">出生時平均余命</p>
 <div class="longevity-reading"><strong data-longevity-value></strong><span data-longevity-unit>年</span></div>
 <p class="longevity-change"><span>2000年から</span><b data-longevity-change></b></p>
 <div class="longevity-comparison"><label>比べる国<select data-longevity-compare aria-label="平均余命を比較するもう一つの国"></select></label><strong data-longevity-compare-value></strong></div>
 <p class="longevity-gap"><span>選択国 − 比較国</span><b data-longevity-gap></b></p>
 <div class="longevity-chart-heading"><span><i></i><span data-longevity-line-name></span></span><small>年をタップ</small></div>
 <canvas data-longevity-chart width="600" height="230" tabindex="0" role="slider" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas>
 <div class="longevity-scale" aria-label="国の色は出生時平均余命40–90年。灰色は欠測"><span>40以下</span><span>65</span><span>90以上 年</span></div>
 <p class="longevity-map-note" data-longevity-map-note hidden>この地域の境界データはデータなしです。</p>`;
 legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('canvas'),select=q('select');let current=null,choicesData=null;
 select.addEventListener('change',()=>setComparison(select.value));
 for(const type of ['pointerdown','dblclick']){chart.addEventListener(type,e=>e.stopPropagation());select.addEventListener(type,e=>e.stopPropagation());}
 chart.addEventListener('click',e=>{const b=chart.getBoundingClientRect();setYear(longevityChartYear((e.clientX-b.left)/b.width));});
 chart.addEventListener('keydown',e=>{const y=current?.year??2016,next={ArrowLeft:y-1,ArrowDown:y-1,ArrowRight:y+1,ArrowUp:y+1,Home:2000,End:2024}[e.key];if(next===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,next)));});
 const sync=({region,comparison,year,data})=>{
  current={region,comparison,year,data};
  if(choicesData!==data){select.replaceChildren();for(const r of data.regions){const o=document.createElement('option');o.value=r.id;o.textContent=longevityName(r);select.append(o);}choicesData=data;}
  for(const o of select.options)o.disabled=o.value===region?.id;
  select.value=comparison?.id||'';
  const a=longevityReading(region,year),b=longevityReading(comparison,year),domain=longevityDomain(region,comparison),gap=a.value===null||b.value===null?null:Math.round((a.value-b.value)*10000)/10000;
  panel.dataset.comparison=comparison?.id||'';panel.dataset.domain=domain.join(',');
  q('[data-longevity-country]').textContent=longevityName(region);q('[data-longevity-year]').textContent=year+'年';
  q('[data-longevity-value]').textContent=longevityFormat(a.value);q('[data-longevity-unit]').hidden=a.value===null;
  q('[data-longevity-change]').textContent=longevitySigned(a.change)+(a.change===null?'':' 年');
  q('[data-longevity-compare-value]').textContent=longevityFormat(b.value)+(b.value===null?'':' 年');
  q('[data-longevity-gap]').textContent=longevitySigned(gap)+(gap===null?'':' 年');
  q('[data-longevity-line-name]').textContent=longevityName(region);q('[data-longevity-map-note]').hidden=region?.id!=='GIB';
  const height=Math.round(parseFloat(getComputedStyle(chart).height)*2);if(height>0)chart.height=height;
  const h=chart.height,short=h<130,left=54,right=580,top=short?10:20,bottom=h-27,c=chart.getContext('2d'),x=y=>left+(y-2000)/24*(right-left),y=v=>bottom-(v-domain[0])/(domain[1]-domain[0])*(bottom-top);
  c.clearRect(0,0,600,h);c.font='18px serif';c.fillStyle='#adbacb';c.textAlign='right';
  for(const v of short?domain:[domain[0],(domain[0]+domain[1])/2,domain[1]]){c.fillText(String(v),left-8,y(v)+5);c.strokeStyle='#b6c8df29';c.lineWidth=1;c.beginPath();c.moveTo(left,y(v));c.lineTo(right,y(v));c.stroke();}
  for(const [r,color] of [[comparison,'#e1be97'],[region,'#b8dff4']]){
   const history=longevityHistory(r);c.strokeStyle=color;c.lineWidth=r===region?3:2;c.lineCap='round';
   for(const [a,b] of history.segments){c.globalAlpha=b.year<=year?1:.3;c.beginPath();c.moveTo(x(a.year),y(a.value));c.lineTo(x(b.year),y(b.value));c.stroke();}
   const p=history.points.find(p=>p.year===year);c.globalAlpha=1;
   if(p){c.fillStyle=color;c.beginPath();c.arc(x(p.year),y(p.value),5,0,Math.PI*2);c.fill();}
  }
  c.strokeStyle='#d7e3ec70';c.lineWidth=1;c.setLineDash([4,5]);c.beginPath();c.moveTo(x(year),top);c.lineTo(x(year),bottom);c.stroke();c.setLineDash([]);
  c.fillStyle='#adbacb';c.textAlign='left';c.fillText('2000',left,h-5);c.textAlign='right';c.fillText('2024',right,h-5);
  chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-valuetext',year+'年、'+longevityName(region)+' '+longevityFormat(a.value)+'年、'+longevityName(comparison)+' '+longevityFormat(b.value)+'年');
  chart.setAttribute('aria-label','出生時平均余命の比較。縦軸 '+domain[0]+'–'+domain[1]+' 年。青が選択国、橙が比較国。2国の全期間を含む固定目盛り。矢印キーで年を選択。');
 };
 new ResizeObserver(()=>{if(current&&!panel.hidden&&chart.clientWidth)sync(current);}).observe(chart);
 return {panel,sync};
}
