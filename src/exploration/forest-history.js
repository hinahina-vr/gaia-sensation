import {atlasRow,atlasFormat,atlasStatistics} from './atlas-history-model.js?v=release100-c363-20261027';

export const FOREST_MODES=Object.freeze(['change','share']);
// WDI's Channel Islands code JG is not an Intl.DisplayNames ISO region.
export const forestCountryNames=data=>({...data,regions:data.regions.map(r=>r.id==='CHI'?{...r,name:'チャネル諸島'}:r)});
const valid=v=>Number.isFinite(v)&&v>=0&&v<=100?v:null;
const round=v=>Math.round(v*10000)/10000;
export function forestReading(region,year){
  const base=valid(atlasRow(region,2000)?.value),value=valid(atlasRow(region,year)?.value);
  return {base,value,change:base===null||value===null?null:round(value-base)};
}
export const forestSigned=v=>Number.isFinite(v)?`${v>0?'＋':v<0?'−':''}${atlasFormat(Math.abs(v))}`:'欠測';
export function forestDefinition(d,mode){
  return mode==='share'?d:{...d,metric:'森林面積率 · 2000年との差',unit:'ポイント',range:[-10,10],colors:['#668b7b','#173f2d','#60d985'],labels:['減少 −10以下','2000年と同じ','増加 ＋10以上 pt']};
}
const derived=new WeakMap();
export function forestData(data,mode){
  if(mode==='share')return data;
  if(!derived.has(data))derived.set(data,{...data,regions:data.regions.map(r=>({...r,years:r.years.map(y=>({year:y.year,value:forestReading(r,y.year).change}))}))});
  return derived.get(data);
}
export function forestStatistics(d,data,region,mode){
  if(!region)return null;
  if(mode==='share')return atlasStatistics(d,data,region);
  const definition={...forestDefinition(d,mode),provenance:'DERIVED',guide:`${d.guide} 同じ国の各年の森林面積率から2000年の値を引いた差（ポイント）。基準年か比較年の欠測は除外。`};
  const result=atlasStatistics(definition,data,forestData(data,mode).regions.find(r=>r.id===region.id));
  return {...result,id:`${result.id}-change`,rows:result.rows.map(r=>({...r,id:`${r.id}-change`}))};
}
// Coordinates are shared by drawing and pointer hit-testing. Missing years break
// the line; annual source estimates are not turned into invented observations.
export const FOREST_CHART=Object.freeze({width:600,height:220,left:52,right:584,top:16,bottom:185,start:2000,end:2023});
export function forestChartYear(fraction){
  const c=FOREST_CHART,x=fraction*c.width;
  return Math.max(c.start,Math.min(c.end,Math.round(c.start+(x-c.left)/(c.right-c.left)*(c.end-c.start))));
}
export function forestChartDomain(region){
  const values=(region?.years||[]).map(r=>valid(r.value)).filter(v=>v!==null);
  if(!values.length)return [0,100];
  const lo=Math.min(...values),hi=Math.max(...values),padding=Math.max(1,(hi-lo)*.15);
  return [Math.max(0,Math.floor((lo-padding)/5)*5),Math.min(100,Math.ceil((hi+padding)/5)*5)];
}
export function createForestPanel(legend,{setMode,setYear,selectCountry}){
  const panel=document.createElement('div');panel.dataset.forestPanel='';panel.hidden=true;
  panel.innerHTML=`<header class="forest-heading"><h3 data-forest-country></h3><span data-forest-year></span></header>
    <div class="forest-comparison"><span>2000年から</span><strong data-forest-change></strong><small>ポイント</small></div>
    <div class="forest-rates"><div><span>2000</span><b data-forest-base></b></div><i aria-hidden="true">―</i><div><span data-forest-current-year></span><b data-forest-current></b></div></div>
    <p class="forest-chart-title">陸地に占める森林の割合</p>
    <canvas data-forest-chart width="600" height="220" tabindex="0" role="slider" aria-valuemin="2000" aria-valuemax="2023" aria-valuenow="2016"></canvas>
    <div class="forest-chart-key"><span>破線：2000年</span><span>年をタップして比較</span></div>
    <div class="forest-modes" role="group" aria-label="地図で見る森林の指標"><button type="button" data-forest-mode="change" aria-pressed="true">2000年からの増減</button><button type="button" data-forest-mode="share" aria-pressed="false">森林の割合</button></div>
    <div class="forest-places" role="group" aria-label="森林の変化を見る国"><button type="button" data-forest-place="BRA">ブラジル</button><button type="button" data-forest-place="CHN">中国</button><button type="button" data-forest-place="JPN">日本</button></div>`;
  legend.prepend(panel);const q=s=>panel.querySelector(s),chart=q('canvas');let currentYear=2016;
  panel.addEventListener('click',e=>{const mode=e.target.closest('[data-forest-mode]'),place=e.target.closest('[data-forest-place]');if(mode)setMode(mode.dataset.forestMode);if(place)selectCountry(place.dataset.forestPlace);});
  chart.addEventListener('pointerdown',e=>e.stopPropagation());chart.addEventListener('dblclick',e=>e.stopPropagation());
  chart.addEventListener('click',e=>{const r=chart.getBoundingClientRect();setYear(forestChartYear((e.clientX-r.left)/r.width));});
  chart.addEventListener('keydown',e=>{const y={ArrowLeft:currentYear-1,ArrowDown:currentYear-1,ArrowRight:currentYear+1,ArrowUp:currentYear+1,Home:2000,End:2023}[e.key];if(y===undefined)return;e.preventDefault();e.stopPropagation();setYear(Math.max(2000,Math.min(2023,y)));});
  return {panel,sync({region,year,mode}){
    currentYear=year;const r=forestReading(region,year),percent=v=>v===null?'欠測':`${atlasFormat(v)}%`,color=r.change===null?'#a2b1b8':r.change<0?'#b4cebf':'#82e5a6';
    panel.style.setProperty('--forest-change-color',color);
    q('[data-forest-country]').textContent=region?.name||'国を選択';q('[data-forest-year]').textContent=`${year}年`;
    q('[data-forest-change]').textContent=forestSigned(r.change);q('.forest-comparison small').hidden=r.change===null;
    q('[data-forest-base]').textContent=percent(r.base);q('[data-forest-current]').textContent=percent(r.value);q('[data-forest-current-year]').textContent=String(year);
    for(const key of FOREST_MODES)q(`[data-forest-mode="${key}"]`).setAttribute('aria-pressed',String(key===mode));
    for(const b of panel.querySelectorAll('[data-forest-place]'))b.setAttribute('aria-pressed',String(b.dataset.forestPlace===region?.id));
    const c=chart.getContext('2d'),g=FOREST_CHART,[low,high]=forestChartDomain(region),span=high-low;
    const x=y=>g.left+(y-g.start)/(g.end-g.start)*(g.right-g.left),y=v=>g.bottom-(v-low)/span*(g.bottom-g.top);
    c.clearRect(0,0,g.width,g.height);c.font='18px serif';c.textAlign='right';c.lineWidth=1;
    for(const v of [low,high]){c.fillStyle='#9eb9b5';c.fillText(`${v}%`,g.left-9,y(v)+5);c.strokeStyle='#9bc9bd28';c.beginPath();c.moveTo(g.left,y(v));c.lineTo(g.right,y(v));c.stroke();}
    // The shaded band is the difference from the baseline, within this chart.
    // The geographic map continues to represent a national aggregate.
    if(r.base!==null){
      for(let i=1;i<(region?.years.length||0);i++){
        const a=region.years[i-1],b=region.years[i];if(valid(a.value)===null||valid(b.value)===null||b.year-a.year!==1)continue;
        const vertices=[[x(a.year),y(a.value)]];
        if((a.value-r.base)*(b.value-r.base)<0){const t=(r.base-a.value)/(b.value-a.value),mid=x(a.year)+t*(x(b.year)-x(a.year));vertices.push([mid,y(r.base)]);}
        vertices.push([x(b.year),y(b.value)]);
        for(let j=1;j<vertices.length;j++){const p=vertices[j-1],n=vertices[j];c.fillStyle=(p[1]+n[1])/2>y(r.base)?'#7b9b8835':'#58cd8330';c.beginPath();c.moveTo(p[0],y(r.base));c.lineTo(...p);c.lineTo(...n);c.lineTo(n[0],y(r.base));c.closePath();c.fill();}
      }
      c.setLineDash([6,6]);c.strokeStyle='#d8dbc28a';c.beginPath();c.moveTo(g.left,y(r.base));c.lineTo(g.right,y(r.base));c.stroke();c.setLineDash([]);
    }
    c.lineWidth=2.6;c.strokeStyle='#d1e7d9';c.beginPath();let previous=null;
    for(const a of region?.years||[]){if(valid(a.value)===null){previous=null;continue;}if(previous!==null&&a.year-previous===1)c.lineTo(x(a.year),y(a.value));else c.moveTo(x(a.year),y(a.value));previous=a.year;}c.stroke();
    for(const a of region?.years||[]){if(valid(a.value)===null){c.strokeStyle='#81969d';c.beginPath();c.moveTo(x(a.year)-2,g.bottom-4);c.lineTo(x(a.year)+2,g.bottom-8);c.stroke();}else{c.fillStyle=a.year===year?color:'#c9dfd2';c.beginPath();c.arc(x(a.year),y(a.value),a.year===year?5:1.7,0,Math.PI*2);c.fill();}}
    c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x(year),g.top);c.lineTo(x(year),g.bottom);c.stroke();
    c.fillStyle='#9eb9b5';c.textAlign='left';c.fillText('2000',g.left,213);c.textAlign='right';c.fillText('2023',g.right,213);
    chart.setAttribute('aria-valuenow',String(year));chart.setAttribute('aria-valuetext',`${year}年、森林面積率 ${percent(r.value)}、2000年との差 ${forestSigned(r.change)}${r.change===null?'':'ポイント'}`);
    chart.setAttribute('aria-label',`${region?.name}の森林面積率の推移。2000–2023年。縦軸 ${low}–${high}%。欠測年は線を結ばず表示。矢印キーで年を選択。`);
  }};
}
