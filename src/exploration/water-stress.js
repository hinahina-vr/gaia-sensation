// SDG 6.4.2 national ratios. The open-ended last band preserves values >100.
// At overlapping published boundaries we use [25,50), [50,75), [75,100].
export const WATER_STRESS_LEVELS=Object.freeze([
  {label:'25未満',name:'低い負荷',color:'#397b8c'},
  {label:'25–50',name:'軽度',color:'#79aaa4'},
  {label:'50–75',name:'中程度',color:'#cfca9a'},
  {label:'75–100',name:'高い',color:'#d3a071'},
  {label:'100超',name:'非常に高い',color:'#d78167'},
].map(Object.freeze));
export const waterStressValid=v=>Number.isFinite(v)&&v>=0?v:null;
export function waterStressBand(value){
  const v=waterStressValid(value);
  return v===null?null:v>100?4:v>=75?3:v>=50?2:v>=25?1:0;
}
export const waterStressColor=value=>WATER_STRESS_LEVELS[waterStressBand(value)]?.color||'#566772';
const format=v=>waterStressValid(v)===null?'欠測':v.toLocaleString('ja-JP',{maximumFractionDigits:1});
export function waterStressReading(region,year){
  const value=waterStressValid(region?.years.find(r=>r.year===year)?.value);
  const base=waterStressValid(region?.years.find(r=>r.year===2000)?.value);
  return {value,base,band:waterStressBand(value),change:value===null||base===null?null:Math.round((value-base)*10000)/10000};
}
// Keep one linear scale for a country's entire period, including 100%. Neither
// year changes nor a value >100 rescale/clip the reference or the withdrawals.
export function waterStressScale(region){
  const max=Math.max(100,...(region?.years||[]).map(r=>waterStressValid(r.value)??0))*1.12;
  const power=10**Math.floor(Math.log10(max)),fraction=max/power;
  return ([1.25,1.5,2,2.5,5,10].find(n=>n>=fraction)||10)*power;
}
export const WATER_STRESS_CHART=Object.freeze({width:600,height:190,left:52,right:586,top:18,bottom:158,start:2000,end:2022});
export function waterStressChartYear(fraction){
  const g=WATER_STRESS_CHART;
  return Math.max(g.start,Math.min(g.end,g.start+Math.floor((fraction*g.width-g.left)/(g.right-g.left)*23)));
}
export function waterStressHistory(region){
  const points=[],segments=[];let previous=null;
  for(const row of region?.years||[]){
    const value=waterStressValid(row.value);if(value===null){previous=null;continue;}
    const point={year:row.year,value};points.push(point);
    if(previous&&point.year===previous.year+1)segments.push([previous,point]);previous=point;
  }
  return {points,segments};
}
function paintWaterStressHistory(c,region,year,g,max){
  const trace=waterStressHistory(region),x=yr=>g.left+((yr-2000)+.5)*(g.right-g.left)/23,y=v=>g.bottom-v/max*(g.bottom-g.top);
  c.clearRect(0,0,g.width,g.height);c.textAlign='right';c.font='18px serif';c.fillStyle='#a7bec4';
  c.fillText(`${format(max)}%`,g.left-8,g.top+5,g.left-12);c.fillText('0',g.left-8,g.bottom+4);
  // The warm zone begins at the real 100% reference, even for 3,850% records.
  const wash=c.createLinearGradient(0,g.top,0,y(100));wash.addColorStop(0,'#d7816703');wash.addColorStop(1,'#d7816725');c.fillStyle=wash;c.fillRect(g.left,g.top,g.right-g.left,y(100)-g.top);
  c.strokeStyle='#a4c4cb35';c.lineWidth=1;c.beginPath();c.moveTo(g.left,g.bottom);c.lineTo(g.right,g.bottom);c.stroke();
  for(const [a,b] of trace.segments){
    // Split at 100 so each side keeps its own meaning. No spline overshoot or
    // interpolation across a missing year is used in this display of annual data.
    const parts=[a];if((a.value-100)*(b.value-100)<0)parts.push({year:a.year+(100-a.value)/(b.value-a.value),value:100});parts.push(b);
    for(let i=1;i<parts.length;i++){
      const p=parts[i-1],q=parts[i],above=(p.value+q.value)/2>100,color=above?'#e7ad91':'#aadbd9';
      c.fillStyle=color+(above?'40':'20');c.beginPath();c.moveTo(x(p.year),y(100));c.lineTo(x(p.year),y(p.value));c.lineTo(x(q.year),y(q.value));c.lineTo(x(q.year),y(100));c.closePath();c.fill();
      c.strokeStyle=color;c.lineWidth=2.1;c.beginPath();c.moveTo(x(p.year),y(p.value));c.lineTo(x(q.year),y(q.value));c.stroke();
    }
  }
  c.setLineDash([6,5]);c.strokeStyle='#f3e6b8aa';c.lineWidth=1;c.beginPath();c.moveTo(g.left,y(100));c.lineTo(g.right,y(100));c.stroke();c.setLineDash([]);
  for(const r of region?.years||[]){
    if(waterStressValid(r.value)===null){c.strokeStyle='#a6b4ba';c.beginPath();c.moveTo(x(r.year)-4,g.bottom-3);c.lineTo(x(r.year)+4,g.bottom-9);c.stroke();}
    else if(!trace.segments.some(([a,b])=>a.year===r.year||b.year===r.year)){c.fillStyle='#b7d9dc';c.beginPath();c.arc(x(r.year),y(r.value),2,0,Math.PI*2);c.fill();}
  }
  c.strokeStyle='#e1eee477';c.beginPath();c.moveTo(x(year),g.top);c.lineTo(x(year),g.bottom);c.stroke();
  const current=trace.points.find(p=>p.year===year);
  if(current){c.fillStyle=current.value>100?'#ffd0b4':'#d8f1eb';c.beginPath();c.arc(x(year),y(current.value),4,0,Math.PI*2);c.fill();}
  c.fillStyle='#a7bec4';c.textAlign='left';c.fillText('2000',g.left,g.height-4);c.textAlign='right';c.fillText('2022',g.right,g.height-4);
}
export function createWaterStressPanel(legend,{setYear,selectCountry}){
  const panel=document.createElement('div');panel.dataset.stressPanel='';panel.hidden=true;
  panel.innerHTML=`<header class="stress-heading"><h3 data-stress-country></h3><span data-stress-year></span></header>
    <div class="stress-reading"><strong data-stress-value></strong><span data-stress-level></span></div>
    <div class="stress-balance"><p>利用可能な淡水資源を100とすると</p>
      <div class="stress-meter"><i class="stress-reference" aria-hidden="true"></i>
        <div><span>利用可能量</span><div class="stress-track"><i data-stress-resource></i></div><b>100</b></div>
        <div><span>取水量</span><div class="stress-track"><i data-stress-withdrawal></i></div><b data-stress-ratio></b></div>
      </div><small>生態系に必要な水量を差し引いた資源量が基準</small>
    </div>
    <div class="stress-history-heading"><span>取水の負荷をたどる</span><b data-stress-change></b></div>
    <canvas data-stress-chart width="600" height="190" tabindex="0" role="slider" aria-valuemin="2000" aria-valuemax="2022" aria-valuenow="2016"></canvas>
    <div class="stress-chart-key"><span>破線：100%</span><span>年をタップして比較</span></div>
    <div class="stress-places" role="group" aria-label="水への負荷を比較する国"><button type="button" data-stress-place="EGY">エジプト</button><button type="button" data-stress-place="IND">インド</button><button type="button" data-stress-place="JPN">日本</button></div>
    <div class="stress-levels" aria-label="水ストレス率の色分け（%）">${WATER_STRESS_LEVELS.map(l=>`<span style="--stress-band:${l.color}"><i aria-hidden="true"></i>${l.label}</span>`).join('')}</div>
    <small class="stress-map-note">水ストレス率（%） · 斜線は100%超 · 灰色は欠測</small>`;
  legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('canvas');let currentYear=2016,currentRegion=null;
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-stress-place]');if(b)selectCountry(b.dataset.stressPlace);});
  chart.addEventListener('pointerdown',e=>e.stopPropagation());chart.addEventListener('dblclick',e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const r=chart.getBoundingClientRect();setYear(waterStressChartYear((e.clientX-r.left)/r.width));});
  chart.addEventListener('keydown',e=>{const next={ArrowLeft:currentYear-1,ArrowDown:currentYear-1,ArrowRight:currentYear+1,ArrowUp:currentYear+1,Home:2000,End:2022}[e.key];if(next===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2022,next)));});
  const sync=({region,year})=>{
    currentYear=year;currentRegion=region;const r=waterStressReading(region,year),max=waterStressScale(region),color=waterStressColor(r.value);
    panel.style.setProperty('--stress-color',color);panel.dataset.scale=String(max);
    q('[data-stress-country]').textContent=region?.name||'国を選択';q('[data-stress-year]').textContent=`${year}年`;
    q('[data-stress-value]').textContent=`${format(r.value)}${r.value===null?'':'%'}`;
    q('[data-stress-level]').textContent=r.band===null?'この年の記録なし':`水への負荷：${WATER_STRESS_LEVELS[r.band].name}`;
    q('.stress-meter').style.setProperty('--stress-reference',`${100/max*100}%`);
    q('[data-stress-resource]').style.width=`${100/max*100}%`;
    q('[data-stress-withdrawal]').style.width=`${(r.value??0)/max*100}%`;
    q('[data-stress-withdrawal]').parentElement.dataset.missing=String(r.value===null);
    q('[data-stress-ratio]').textContent=format(r.value);
    q('[data-stress-change]').textContent=r.change===null?'2000年と比較できる記録なし':`2000年から ${r.change>0?'＋':r.change<0?'−':''}${format(Math.abs(r.change))} pt`;
    for(const b of panel.querySelectorAll('[data-stress-place]'))b.setAttribute('aria-pressed',String(b.dataset.stressPlace===region?.id));
    // Match the backing aspect ratio to the compact chart; shrinking its CSS
    // height alone would squash the axis type into a few unreadable pixels.
    const height=Math.round(parseFloat(getComputedStyle(chart).height)/92*WATER_STRESS_CHART.height);
    if(Number.isFinite(height)&&height>0&&chart.height!==height)chart.height=height;
    const g={...WATER_STRESS_CHART,height:chart.height,bottom:chart.height-32};paintWaterStressHistory(chart.getContext('2d'),region,year,g,max);
    chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-valuetext',`${year}年、水ストレス率 ${format(r.value)}${r.value===null?'':'%'}`);
    chart.setAttribute('aria-label',`${region?.name||''}の水ストレス率。2000–2022年、縦軸0–${format(max)}%。破線は100%。矢印キーで年を選択。`);
  };
  // The panel is mounted once and reused across exhibits. Repaint its own
  // chart when CSS switches density, without restarting the geographic layer.
  new ResizeObserver(()=>{if(currentRegion&&!panel.hidden&&chart.clientWidth)sync({region:currentRegion,year:currentYear});}).observe(chart);
  return {panel,sync};
}
