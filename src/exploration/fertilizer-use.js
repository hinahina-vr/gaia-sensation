// Fertilizer nutrients consumed nationally / arable hectares, not a nutrient
// breakdown or a measurement at a farm. Source rows remain untouched.
export const FERTILIZER_ARRIVAL_MS=1100;
export const fertilizerValid=v=>Number.isFinite(v)&&v>=0?v:null;
export const fertilizerFormat=v=>fertilizerValid(v)===null?'欠測':v.toLocaleString('ja-JP',{maximumFractionDigits:v>0&&v<1?4:1});
export function fertilizerReading(region,year){
 const value=fertilizerValid(region?.years.find(r=>r.year===year)?.value),base=fertilizerValid(region?.years.find(r=>r.year===2000)?.value);
 return {value,base,change:value===null||base===null?null:Math.round((value-base)*10000)/10000};
}
export function fertilizerDistribution(data,year){
 const records=(data?.regions||[]).map(r=>({id:r.id,value:fertilizerReading(r,year).value})).filter(r=>r.value!==null).sort((a,b)=>a.value-b.value||a.id.localeCompare(b.id));
 const n=records.length,median=n?(records[Math.floor((n-1)/2)].value+records[Math.floor(n/2)].value)/2:null;
 return {records,median,count:n,missing:(data?.regions.length||0)-n,overflow:records.filter(r=>r.value>500).length};
}
export function fertilizerScale(region){
 const max=Math.max(1,...(region?.years||[]).map(r=>fertilizerValid(r.value)??0))*1.08,power=10**Math.floor(Math.log10(max));
 return ([1,2,2.5,5,10].find(n=>n>=max/power)||10)*power;
}
export function fertilizerArrival(index,count,elapsed,reduced=false){
 if(elapsed<0)return 0;if(reduced)return 1;const t=Math.max(0,Math.min(1,(elapsed-(count>1?index/(count-1)*240:0))/860));return t*t*(3-2*t);
}
export const fertilizerChartYear=f=>Math.max(2000,Math.min(2024,2000+Math.floor((f*600-64)/520*25)));
export function createFertilizerPanel(legend,{setYear,selectCountry}){
 const panel=document.createElement('div');panel.dataset.fertilizerPanel='';panel.hidden=true;
 panel.innerHTML=`<header class="fertilizer-heading"><h3 data-fertilizer-country></h3><span data-fertilizer-year></span></header>
 <p class="fertilizer-measure">耕地 1 ha あたりの肥料成分</p>
 <div class="fertilizer-reading"><strong data-fertilizer-value></strong><span data-fertilizer-unit>kg</span></div>
 <p class="fertilizer-reference"><span>同年の国・地域の中央値</span><b data-fertilizer-median></b></p>
 <p class="fertilizer-key-note">国・地域の分布 · 金色は選択国 · 灰色は欠測</p>
 <canvas data-fertilizer-distribution width="600" height="86" role="img"></canvas>
 <div class="fertilizer-chart-heading"><span>年ごとの消費量</span><small>年をタップ</small></div>
 <canvas data-fertilizer-chart width="600" height="182" tabindex="0" role="slider" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas>
 <div class="fertilizer-places" role="group" aria-label="肥料消費量を比較する国"><button type="button" data-fertilizer-place="CHN">中国</button><button type="button" data-fertilizer-place="IND">インド</button><button type="button" data-fertilizer-place="JPN">日本</button></div>`;
 legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('[data-fertilizer-chart]'),rug=q('[data-fertilizer-distribution]');let current=null;
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-fertilizer-place]');if(b)selectCountry(b.dataset.fertilizerPlace);});
 for(const type of ['pointerdown','dblclick'])chart.addEventListener(type,e=>e.stopPropagation());
 chart.addEventListener('click',e=>{const b=chart.getBoundingClientRect();setYear(fertilizerChartYear((e.clientX-b.left)/b.width));});
 chart.addEventListener('keydown',e=>{const y=current?.year??2016,next={ArrowLeft:y-1,ArrowDown:y-1,ArrowRight:y+1,ArrowUp:y+1,Home:2000,End:2024}[e.key];if(next===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,next)));});
 const sync=({region,year,data})=>{
  current={region,year,data};const r=fertilizerReading(region,year),dist=fertilizerDistribution(data,year),limit=fertilizerScale(region);
  panel.dataset.scale=String(limit);panel.dataset.median=String(dist.median);panel.dataset.count=String(dist.count);
  q('[data-fertilizer-country]').textContent=region?.name||'国を選択';q('[data-fertilizer-year]').textContent=year+'年';
  q('[data-fertilizer-value]').textContent=fertilizerFormat(r.value);q('[data-fertilizer-unit]').hidden=r.value===null;
  q('[data-fertilizer-median]').textContent=fertilizerFormat(dist.median)+' kg/ha';
  for(const b of panel.querySelectorAll('[data-fertilizer-place]'))b.setAttribute('aria-pressed',String(b.dataset.fertilizerPlace===region?.id));
  // A rug: one vertical mark per available country, not an area-weighted average.
  const c=rug.getContext('2d'),x=v=>20+Math.min(500,v)/500*560;
  c.clearRect(0,0,600,86);c.strokeStyle='#abd6bd55';c.lineWidth=1;
  for(const p of dist.records){c.beginPath();c.moveTo(x(p.value),20);c.lineTo(x(p.value),43);c.stroke();}
  if(dist.median!==null){c.strokeStyle='#dbe4d7';c.setLineDash([3,3]);c.beginPath();c.moveTo(x(dist.median),10);c.lineTo(x(dist.median),52);c.stroke();c.setLineDash([]);}
  if(r.value!==null){c.fillStyle='#f4d39a';c.beginPath();c.moveTo(x(r.value),10);c.lineTo(x(r.value)-6,1);c.lineTo(x(r.value)+6,1);c.closePath();c.fill();c.strokeStyle='#f4d39a';c.lineWidth=2;c.beginPath();c.moveTo(x(r.value),13);c.lineTo(x(r.value),46);c.stroke();}
  const gradient=c.createLinearGradient(20,0,580,0);gradient.addColorStop(0,'#17434b');gradient.addColorStop(.5,'#9ac5ab');gradient.addColorStop(1,'#ebc185');c.fillStyle=gradient;c.fillRect(20,48,560,4);
  c.font='18px serif';c.fillStyle='#adbec0';c.textAlign='left';c.fillText('0',20,77);c.textAlign='center';c.fillText('250',300,77);c.textAlign='right';c.fillText('500+ kg/ha',580,77);
  rug.setAttribute('aria-label',year+'年、'+dist.count+'国・地域の分布。中央値 '+fertilizerFormat(dist.median)+' kg/ha。各国を1件として計算。欠測'+dist.missing+'、500超は右端に集約 '+dist.overflow+'件。金色が選択国。');
  const height=Math.round(parseFloat(getComputedStyle(chart).height)*2);if(height>0)chart.height=height;
  const h=chart.height,short=h<110,left=64,right=584,top=short?10:20,bottom=h-26,bar=(right-left)/25,ctx=chart.getContext('2d'),y=v=>bottom-v/limit*(bottom-top);
  ctx.clearRect(0,0,600,h);ctx.font='17px serif';ctx.textAlign='right';ctx.fillStyle='#aebfba';
  for(const v of short?[0,limit]:[0,limit/2,limit]){ctx.fillText(fertilizerFormat(v),left-8,y(v)+5);ctx.strokeStyle='#9bbeb12b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();}
  for(let yr=2000;yr<=2024;yr++){
   const value=fertilizerReading(region,yr).value,bx=left+(yr-2000)*bar+3,selected=yr===year;
   if(selected){ctx.fillStyle='#f5dc9917';ctx.fillRect(bx-3,top,bar,bottom-top);}
   if(value===null){ctx.strokeStyle='#a5b5b9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx,bottom-6);ctx.lineTo(bx+bar-6,bottom);ctx.moveTo(bx,bottom);ctx.lineTo(bx+bar-6,bottom-6);ctx.stroke();continue;}
   const wash=ctx.createLinearGradient(0,top,0,bottom);wash.addColorStop(0,selected?'#f3d59b':'#a3ceb9');wash.addColorStop(1,selected?'#b39b5b66':'#639e8d48');
   ctx.fillStyle=wash;ctx.fillRect(bx,y(value),bar-6,Math.max(value>0?1:0,bottom-y(value)));ctx.strokeStyle=selected?'#ffe6af':'#b5d4ba';ctx.beginPath();ctx.moveTo(bx,y(value));ctx.lineTo(bx+bar-6,y(value));ctx.stroke();
  }
  ctx.fillStyle='#adbec0';ctx.textAlign='left';ctx.fillText('2000',left,h-5);ctx.textAlign='right';ctx.fillText('2024',right,h-5);
  chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-valuetext',year+'年、'+fertilizerFormat(r.value)+(r.value===null?'':' kg/ha'));
  chart.setAttribute('aria-label',(region?.name||'')+'の肥料消費量。2000–2024年。縦軸0–'+fertilizerFormat(limit)+' kg/ha、国ごとに全期間で固定。×は欠測。矢印キーで年を選択。');
 };
 new ResizeObserver(()=>{if(current&&!panel.hidden&&chart.clientWidth)sync(current);}).observe(chart);
 return {panel,sync};
}
