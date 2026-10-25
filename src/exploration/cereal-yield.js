// National cereal production / harvested cereal area, kg/ha. No field locations
// or crop composition are inferred from this aggregate.
export const YIELD_ARRIVAL_MS=1100;
export const yieldValid=v=>Number.isFinite(v)&&v>=0?v:null;
export const yieldFormat=v=>yieldValid(v)===null?'欠測':v.toLocaleString('ja-JP',{maximumFractionDigits:1});
export function yieldReading(region,year){
  const value=yieldValid(region?.years.find(r=>r.year===year)?.value),base=yieldValid(region?.years.find(r=>r.year===2000)?.value);
  return {value,base,change:value===null||base===null?null:Math.round((value-base)*10000)/10000};
}
export function yieldScale(region){
  const max=Math.max(1,...(region?.years||[]).map(r=>yieldValid(r.value)??0))*1.08,power=10**Math.floor(Math.log10(max));
  return ([1,1.5,2,2.5,4,5,8,10].find(n=>n>=max/power)||10)*power;
}
export function yieldHistory(region){
  const points=[],segments=[];let previous=null;
  for(const row of region?.years||[]){
    const value=yieldValid(row.value);if(value===null){previous=null;continue;}
    const p={year:row.year,value};points.push(p);if(previous&&p.year===previous.year+1)segments.push([previous,p]);previous=p;
  }
  return {points,segments};
}
export const YIELD_CHART=Object.freeze({width:600,height:210,left:72,right:582,top:22,bottom:177});
export const yieldChartYear=f=>Math.max(2000,Math.min(2024,2000+Math.round((f*600-72)/510*24)));
export function yieldArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;if(reduced)return 1;const t=Math.max(0,Math.min(1,(elapsed-(count>1?index/(count-1)*240:0))/860));return t*t*(3-2*t);
}
export function createYieldPanel(legend,{setYear,selectCountry}){
  const panel=document.createElement('div');panel.dataset.yieldPanel='';panel.hidden=true;
  panel.innerHTML=`<header class="yield-heading"><h3 data-yield-country></h3><span data-yield-year></span></header>
    <p class="yield-measure">穀物の収穫面積 1 ha あたり</p>
    <div class="yield-reading"><strong data-yield-value></strong><span data-yield-unit>kg</span></div>
    <p class="yield-comparison"><span data-yield-base></span><b data-yield-change></b></p>
    <div class="yield-chart-heading"><span>同じ国の収量をたどる</span><small>年をタップ</small></div>
    <canvas data-yield-chart width="600" height="210" tabindex="0" role="slider" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas>
    <div class="yield-places" role="group" aria-label="穀物の収量を比較する国"><button type="button" data-yield-place="IND">インド</button><button type="button" data-yield-place="USA">米国</button><button type="button" data-yield-place="JPN">日本</button></div>`;
  legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('canvas');let currentYear=2016,currentRegion=null;
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-yield-place]');if(b)selectCountry(b.dataset.yieldPlace);});
  for(const type of ['pointerdown','dblclick'])chart.addEventListener(type,e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const b=chart.getBoundingClientRect();setYear(yieldChartYear((e.clientX-b.left)/b.width));});
  chart.addEventListener('keydown',e=>{const next={ArrowLeft:currentYear-1,ArrowDown:currentYear-1,ArrowRight:currentYear+1,ArrowUp:currentYear+1,Home:2000,End:2024}[e.key];if(next===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,next)));});
  const sync=({region,year})=>{
    currentYear=year;currentRegion=region;const r=yieldReading(region,year),limit=yieldScale(region),trace=yieldHistory(region);
    panel.dataset.scale=String(limit);q('[data-yield-country]').textContent=region?.name||'国を選択';q('[data-yield-year]').textContent=`${year}年`;
    q('[data-yield-value]').textContent=yieldFormat(r.value);q('[data-yield-unit]').hidden=r.value===null;
    q('[data-yield-base]').textContent=`2000年  ${yieldFormat(r.base)}${r.base===null?'':' kg/ha'}`;
    q('[data-yield-change]').textContent=r.change===null?'比較できる記録なし':`${r.change>0?'＋':r.change<0?'−':''}${yieldFormat(Math.abs(r.change))} kg/ha`;
    q('[data-yield-change]').dataset.sign=r.change<0?'negative':'positive';
    for(const b of panel.querySelectorAll('[data-yield-place]'))b.setAttribute('aria-pressed',String(b.dataset.yieldPlace===region?.id));
    const height=Math.round(parseFloat(getComputedStyle(chart).height)*2);if(height>0&&chart.height!==height)chart.height=height;
    const short=chart.height<100,g={...YIELD_CHART,height:chart.height,top:short?12:22,bottom:chart.height-(short?24:32)},c=chart.getContext('2d'),x=yr=>g.left+(yr-2000)/24*(g.right-g.left),y=v=>g.bottom-v/limit*(g.bottom-g.top);
    c.clearRect(0,0,g.width,g.height);c.font='18px serif';c.textAlign='right';c.fillStyle='#a7bcb9';
    for(const v of short?[0,limit]:[0,limit/2,limit]){c.fillText(yieldFormat(v),g.left-8,y(v)+5);c.strokeStyle='#b3c7b52a';c.lineWidth=1;c.beginPath();c.moveTo(g.left,y(v));c.lineTo(g.right,y(v));c.stroke();}
    // A fixed full-period scale per country. Only adjacent published years join.
    const wash=c.createLinearGradient(0,g.top,0,g.bottom);wash.addColorStop(0,'#e8cd8745');wash.addColorStop(1,'#e8cd8700');
    for(const [a,b] of trace.segments){c.fillStyle=wash;c.beginPath();c.moveTo(x(a.year),g.bottom);c.lineTo(x(a.year),y(a.value));c.lineTo(x(b.year),y(b.value));c.lineTo(x(b.year),g.bottom);c.closePath();c.fill();c.strokeStyle='#e8d198';c.lineWidth=2.2;c.beginPath();c.moveTo(x(a.year),y(a.value));c.lineTo(x(b.year),y(b.value));c.stroke();}
    c.strokeStyle='#e9e9ce55';c.lineWidth=1;c.setLineDash([4,5]);c.beginPath();c.moveTo(x(year),g.top);c.lineTo(x(year),g.bottom);c.stroke();c.setLineDash([]);
    for(const p of trace.points){c.fillStyle=p.year===year?'#fff2bb':'#d6cc9e';c.beginPath();c.arc(x(p.year),y(p.value),p.year===year?5:2.2,0,Math.PI*2);c.fill();}
    if(r.value===null){c.fillStyle='#afbdc2';c.textAlign='center';c.fillText('欠測',x(year),g.top+18);}
    c.textAlign='left';c.fillStyle='#a7bcb9';c.fillText('2000',g.left,g.height-5);c.textAlign='right';c.fillText('2024',g.right,g.height-5);
    chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-valuetext',`${year}年、${yieldFormat(r.value)}${r.value===null?'':' kg/ha'}`);
    chart.setAttribute('aria-label',`${region?.name||''}の穀物収量。2000–2024年、縦軸0–${yieldFormat(limit)} kg/ha。欠測年は線をつなぎません。矢印キーで年を選択。`);
  };
  new ResizeObserver(()=>{if(currentRegion&&!panel.hidden&&chart.clientWidth)sync({region:currentRegion,year:currentYear});}).observe(chart);
  return {panel,sync};
}
