import {countrySourceId} from './country-source-ids.js?v=stress-polish-20261023';

export const URBAN_ARRIVAL_MS = 1100;
export const urbanValid = value => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
export const urbanFormat = value => value === null || !Number.isFinite(value) ? '欠測' : value.toLocaleString('ja-JP', {minimumFractionDigits:1,maximumFractionDigits:1});
export const urbanSourceId = id => ({KOS:'XKX',JEY:'CHI',GGY:'CHI'}[id] || countrySourceId(id));
export const urbanName = region => region?.id === 'CHI' ? 'チャネル諸島' : region?.name || '国を選択';
const displayCache = new WeakMap();
export function urbanData(data) {
  if (!data) return data;
  if (!displayCache.has(data)) displayCache.set(data, {...data,regions:data.regions.map(r => r.id === 'CHI' ? {...r,name:urbanName(r)} : r)});
  return displayCache.get(data);
}
export function urbanReading(region, year) {
  const urban = urbanValid(region?.years.find(r => r.year === year)?.value);
  const baseline = urbanValid(region?.years.find(r => r.year === 2000)?.value);
  return {urban,rural:urban === null ? null : 100-urban,baseline,change:urban === null || baseline === null ? null : Math.round((urban-baseline)*10000)/10000};
}
export function urbanMilestone(region) {
  const rows = region?.years || [], first = rows.find(r => urbanValid(r.value) !== null);
  if (!first) return '記録なし';
  if (first.value >= 50) return first.year+'年時点で都市人口が半数以上';
  for (let i=1;i<rows.length;i++) {
    const a=rows[i-1],b=rows[i];
    if (urbanValid(a.value)!==null && urbanValid(b.value)!==null && b.year===a.year+1 && a.value<50 && b.value>=50) return b.year+'年に都市人口が半数以上';
  }
  return '対象期間では都市人口は半数未満';
}
export const urbanSigned = value => value === null ? '比較する記録なし' : (value>0?'＋':value<0?'−':'')+urbanFormat(Math.abs(value));
export function urbanArrival(index,count,elapsed,reduced=false) {
  if (elapsed<0) return 0;
  if (reduced) return 1;
  const t=Math.max(0,Math.min(1,(elapsed-(count>1?index/(count-1)*240:0))/860));
  return t*t*(3-2*t);
}
export const urbanChartYear = fraction => Math.max(2000,Math.min(2024,2000+Math.round((fraction*600-46)/532*24)));

export function paintUrbanHistory(ctx, region, year, width, height) {
  const left=46,right=width-22,top=16,bottom=height-28;
  const x=y=>left+(y-2000)/24*(right-left), y=v=>bottom-v/100*(bottom-top);
  ctx.clearRect(0,0,width,height);
  const runs=[];let run=[];
  for(const row of region?.years || []){
    if(urbanValid(row.value)===null){run=[];continue;}
    if(!run.length || row.year!==run.at(-1).year+1){run=[];runs.push(run);}
    run.push(row);
  }
  const gradient=ctx.createLinearGradient(0,top,0,bottom);
  gradient.addColorStop(0,'#e8c38a');gradient.addColorStop(1,'#95764d');
  // Fill each continuous run once per side of the year cursor. Separate
  // translucent year quads leave visible antialiased seams between years.
  for(const [from,to,alpha] of [[left,x(year),.84],[x(year),right,.30]]){
    ctx.save();ctx.beginPath();ctx.rect(from,top,to-from,bottom-top);ctx.clip();
    for(const rows of runs){
      if(rows.length<2)continue;
      ctx.globalAlpha=alpha;
      for(const [edge,color] of [[bottom,gradient],[top,'#486b7b']]){
        ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x(rows[0].year),edge);
        for(const r of rows)ctx.lineTo(x(r.year),y(r.value));
        ctx.lineTo(x(rows.at(-1).year),edge);ctx.closePath();ctx.fill();
      }
      ctx.globalAlpha=alpha/.84;ctx.strokeStyle='#f5d7a5';ctx.lineWidth=2;ctx.beginPath();
      rows.forEach((r,i)=>{if(i)ctx.lineTo(x(r.year),y(r.value));else ctx.moveTo(x(r.year),y(r.value));});ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha=1;ctx.font='17px serif';ctx.fillStyle='#a9bec8';ctx.textAlign='right';
  for(const value of [0,50,100]){
    ctx.fillText(String(value),left-8,y(value)+5);ctx.strokeStyle=value===50?'#d9e4e763':'#c3d6df29';ctx.lineWidth=1;
    ctx.setLineDash(value===50?[5,5]:[]);ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(right,y(value));ctx.stroke();
  }
  ctx.setLineDash([]);const value=urbanReading(region,year).urban;
  ctx.strokeStyle='#f5e2c5ab';ctx.beginPath();ctx.moveTo(x(year),top);ctx.lineTo(x(year),bottom);ctx.stroke();
  if(value!==null){ctx.fillStyle='#ffe2ad';ctx.shadowColor='#efc68d';ctx.shadowBlur=9;ctx.beginPath();ctx.arc(x(year),y(value),3.8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  ctx.fillStyle='#b8c9cd';ctx.textAlign='left';ctx.fillText('2000',left,height-7);ctx.textAlign='right';ctx.fillText('2024',right,height-7);
}
export function createUrbanPanel(legend,{setYear}) {
  const panel=document.createElement('div');panel.dataset.urbanPanel='';panel.hidden=true;
  panel.innerHTML='<header class="urban-heading"><h3 data-urban-country></h3><span data-urban-year></span></header>'+
    '<div class="urban-population"><div><span>都市に暮らす人</span><p><strong data-urban-value></strong><small data-urban-unit>％</small></p></div><div><span>それ以外</span><p><b data-urban-rural></b><small data-urban-rural-unit>％</small></p></div></div>'+
    '<div class="urban-share" role="img" data-urban-share><span></span></div>'+
    '<p class="urban-change"><span>2000年から</span><b data-urban-change></b></p>'+
    '<div class="urban-chart-caption"><span><i></i>都市 <i></i>それ以外</span><small>年をタップ</small></div>'+
    '<canvas data-urban-chart width="600" height="260" tabindex="0" role="slider" aria-label="都市人口の年次構成、0–100％" aria-valuemin="2000" aria-valuemax="2024" aria-valuenow="2016"></canvas>'+
    '<p class="urban-milestone" data-urban-milestone></p>'+
    '<div class="urban-color-scale" aria-label="国の色は都市人口率。灰色は欠測"><span>0</span><span>50</span><span>100％</span></div>'+
    '<p class="urban-map-note" data-urban-map-note hidden>この地域の境界データはデータなしです。</p>';
  legend.prepend(panel);
  const q=s=>panel.querySelector(s),chart=q('canvas');let current;
  chart.addEventListener('pointerdown',e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const b=chart.getBoundingClientRect();setYear(urbanChartYear((e.clientX-b.left)/b.width));});
  chart.addEventListener('keydown',e=>{
    const y=current?.year ?? 2016,next={ArrowLeft:y-1,ArrowDown:y-1,ArrowRight:y+1,ArrowUp:y+1,Home:2000,End:2024}[e.key];
    if(next===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2024,next)));
  });
  const sync=({region,year})=>{
    current={region,year};const r=urbanReading(region,year);
    q('[data-urban-country]').textContent=urbanName(region);q('[data-urban-year]').textContent=year+'年';
    q('[data-urban-value]').textContent=urbanFormat(r.urban);q('[data-urban-rural]').textContent=urbanFormat(r.rural);
    q('[data-urban-unit]').hidden=q('[data-urban-rural-unit]').hidden=r.urban===null;
    q('[data-urban-change]').textContent=urbanSigned(r.change)+(r.change===null?'':' pt');
    q('[data-urban-milestone]').textContent=urbanMilestone(region);
    const share=q('[data-urban-share]');share.dataset.missing=String(r.urban===null);share.firstElementChild.style.width=(r.urban??0)+'%';share.setAttribute('aria-label','人口100％のうち都市 '+urbanFormat(r.urban)+'％、それ以外 '+urbanFormat(r.rural)+'％');
    q('[data-urban-map-note]').hidden=region?.id!=='GIB';
    chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-valuetext',year+'年、都市 '+urbanFormat(r.urban)+'％');
    const height=Math.round(parseFloat(getComputedStyle(chart).height)*2);if(height>0)chart.height=height;
    paintUrbanHistory(chart.getContext('2d'),region,year,600,chart.height);
    panel.dataset.urban=String(r.urban);panel.dataset.rural=String(r.rural);panel.dataset.change=String(r.change);
  };
  new ResizeObserver(()=>{if(current&&!panel.hidden&&chart.clientWidth)sync(current);}).observe(chart);
  return {panel,sync};
}
