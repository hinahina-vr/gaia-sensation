import { earthBaseScale, earthLongitudeToMapX } from './world-projection.js?v=gaia-japan-center-1';
import { decorateMapActions } from './map-exhibit-actions.js?v=action-icons-ready-20260926';
import { CLIMATE_EXHIBITS, BASINS, windMS, format, stormPeak, stormLabel, colorFor, coralInsight, cycloneInsight, statisticsFor, daysInYear } from './climate-history-model.js?v=climate-20261013';

const cache = new Map(), pending = new Map(), buttons = new Map();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let definition = CLIMATE_EXHIBITS[0], active = false, dataState = 'idle', generation = 0;
let data, season, year = 2016, basin = 'ALL', selectedId = '', playing = false, frame = 0, lastStep = 0, lastDraw = 0;
let layer, map, canvas, context, buffer, bufferContext, readout, legend, geometryKey = '', hitPoints = [];
const q = selector => readout.querySelector(selector) || legend.querySelector(selector);
const isCoral = () => definition.id === 'coral';
const years = () => isCoral() ? [...new Set(data.regions.flatMap(r => r.years.map(y => y.year)))].sort((a,b)=>a-b) : data.years.map(y=>y.year);
const storms = () => (season?.storms || []).filter(s => basin === 'ALL' || s.basin === basin);
const items = () => isCoral() ? data?.regions || [] : storms();
const selected = () => items().find(p=>p.id === selectedId);
const selectedRow = () => selected()?.years?.find(r=>r.year === year);
const emit = type => dispatchEvent(new CustomEvent(`gaia:climate-${type}`, {detail:{active,id:definition.id,year,dataState}}));
async function load(file) {
  if (cache.has(file)) return cache.get(file);
  if (!pending.has(file)) pending.set(file, fetch(new URL(`../../data/climate-history/${file}.json?v=20261013`, import.meta.url), {signal:AbortSignal.timeout(30000)})
    .then(async response => {
      if (!response.ok) throw new Error(`Climate snapshot HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.schemaVersion !== 1 || !(payload.regions?.length || payload.years?.length || (Array.isArray(payload.storms) && Number.isInteger(payload.year)))) throw new Error('Invalid climate snapshot');
      cache.set(file,payload);
      // Keep only three detailed seasons; the compact manifests remain cached.
      const detailKeys = [...cache.keys()].filter(key=>key.startsWith('cyclones/'));
      while (detailKeys.length > 3) cache.delete(detailKeys.shift());
      return payload;
    }).finally(()=>pending.delete(file)));
  return pending.get(file);
}
const setPlayback = value => { playing = Boolean(value) && active && dataState === 'ready'; lastStep = performance.now(); };
const stopForInteraction = () => { setPlayback(false); globalThis.GaiaMapPlayback?.stop('interaction'); };
const setBusy = value => { readout.setAttribute('aria-busy', String(value)); legend.setAttribute('aria-busy', String(value)); };
const focusAll = () => globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:150,lat:8,zoom:1,targetX:.5,targetY:.46,durationMs:450,label:'climate-world'});
const focusPoint = point => {
  const p = isCoral() ? point : point?.points?.[Math.floor(point.points.length/2)];
  if (p) globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:isCoral()?p.lon:p[2],lat:isCoral()?p.lat:p[1],zoom:innerWidth<=900?1.25:1,targetX:.48,targetY:.45,durationMs:500,label:'climate-observation'});
};
const sync = () => {
  const coral = isCoral(), point = selected(), row = selectedRow(), peak = stormPeak(point);
  q('[data-climate-point]').value = selectedId;
  q('[data-climate-year]').value = String(year);
  q('[data-climate-period]').textContent = `${year}${coral?'年':'シーズン'}`;
  q('[data-climate-metric]').textContent = coral ? '年内最大DHW' : '経路内の最大1分平均風速';
  q('[data-climate-value]').textContent = coral ? `${format(row?.max)}${row?' ℃・週':''}` : `${format(windMS(peak))}${peak!=null?' m/s':''}`;
  q('[data-climate-detail]').textContent = coral ? row ? `DHW ≥ 8：${row.days8}日 / 有効 ${row.validDays}/${daysInYear(year)}日` : 'この年の記録なし'
    : point ? `${point.points.length}時刻 / ${new Date(point.points[0][0]*3600000).toISOString().slice(0,10)}から` : 'この海域の経路なし';
  q('[data-climate-selected]').textContent = point ? coral?point.name:stormLabel(point) : '記録なし';
  q('[data-climate-insight]').textContent = coral ? coralInsight(point,row) : cycloneInsight(storms(),year);
  q('[data-climate-analysis]').disabled = !point && coral;
  q('[data-climate-status]').textContent = coral ? `NOAA Coral Reef Watch / ${data.regions.length}監視海域 / 1986–2025年` : `NOAA IBTrACS v4r01 / ${storms().length}主要経路 / 1980–2024シーズン`;
  geometryKey = ''; emit('update');
};
function fillPoints() {
  const list = items();
  if (!list.some(p=>p.id === selectedId)) selectedId = isCoral() ? list.find(p=>p.id === 'southern_ryukyu_islands')?.id || list[0]?.id || ''
    : list.reduce((best,p)=>!best || (stormPeak(p)??-1)>(stormPeak(best)??-1)?p:best,null)?.id || '';
  q('[data-climate-point]').replaceChildren(...list.map(p=>new Option(isCoral()?p.name:stormLabel(p),p.id)));
}
async function setYear(next) {
  if (!active || !data || !years().includes(Number(next))) return;
  const ticket = ++generation; year = Number(next); dataState = 'loading'; season = null; geometryKey = ''; hitPoints = [];
  setBusy(true);
  context.clearRect(0,0,canvas.width,canvas.height); q('[data-climate-controls]').disabled = true; q('[data-climate-analysis]').disabled = true;
  q('[data-climate-value]').textContent = '—'; q('[data-climate-period]').textContent = `${year}${isCoral()?'年':'シーズン'}`;
  q('[data-climate-detail]').textContent = ''; q('[data-climate-selected]').textContent = `${year}の記録`;
  q('[data-climate-insight]').textContent = `${year}の記録を読み込んでいます。`; q('[data-climate-status]').textContent = 'NOAA保存データを読込中…';
  q('[data-climate-retry]').hidden = true;
  try {
    const payload = isCoral() ? null : await load(`cyclones/${year}`);
    if (!active || ticket !== generation) return;
    season = payload; dataState = 'ready'; fillPoints(); sync(); setBusy(false); q('[data-climate-controls]').disabled = false; legend.hidden = false; lastStep = performance.now(); emit('ready'); resume();
  } catch (error) {
    if (active && ticket === generation) fail(error);
  }
}
function fail(error) {
  setBusy(false);
  dataState = 'error'; playing = false; q('[data-climate-status]').textContent = '保存データの読込に失敗しました。再試行できます。';
  q('[data-climate-retry]').hidden = false; emit('error'); console.warn('Climate snapshot unavailable',error);
}
function selectPoint(id, {focus=true} = {}) {
  if (dataState !== 'ready' || !items().some(p=>p.id === id)) return;
  selectedId = id; sync(); if (focus) focusPoint(selected());
}
const projection = () => {
  const rect = globalThis.GaiaMapObservationAdapter?.getViewportRect?.() || map.getBoundingClientRect();
  const d = document.querySelector('#japan-overlay').dataset, scale = earthBaseScale(rect)*Math.max(1,Number(d.earthZoom)||1);
  return {rect,scale,x:(rect.width-360*scale)/2+(Number(d.earthOffsetX)||0),y:(rect.height-180*scale)/2+(Number(d.earthOffsetY)||0)};
};
function paint(view, ratio) {
  const ctx = bufferContext, {rect,scale} = view;
  if (buffer.width !== canvas.width) buffer.width = canvas.width;
  if (buffer.height !== canvas.height) buffer.height = canvas.height;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,buffer.width,buffer.height);
  ctx.setTransform(ratio,0,0,ratio,0,0); hitPoints = [];
  const xy = (lon,lat) => ({x:view.x+earthLongitudeToMapX(lon)*scale,y:view.y+(90-lat)*scale});
  const visible = p => p.x>=-12 && p.y>=-12 && p.x<=rect.width+12 && p.y<=rect.height+12;
  if (isCoral()) {
    for (const region of data.regions) {
      const point = xy(region.lon,region.lat), row = region.years.find(y=>y.year===year); if (!visible(point)) continue;
      const color = colorFor('coral',row?.max), chosen = region.id===selectedId, radius = chosen?7:4;
      ctx.beginPath(); ctx.arc(point.x,point.y,radius,0,Math.PI*2); ctx.fillStyle=color; ctx.globalAlpha=chosen?1:.85; ctx.fill();
      if (chosen) { ctx.strokeStyle='#fff1ba'; ctx.lineWidth=2; ctx.beginPath();ctx.arc(point.x,point.y,11,0,Math.PI*2);ctx.stroke(); }
      hitPoints.push({...point,id:region.id,lon:region.lon,lat:region.lat});
    }
  } else {
    const ordered = [...storms()].sort((a,b)=>Number(a.id===selectedId)-Number(b.id===selectedId));
    for (const storm of ordered) {
      const chosen = storm.id===selectedId; ctx.lineWidth=chosen?3:1.2; ctx.globalAlpha=chosen?1:.58;
      for (let i=1;i<storm.points.length;i++) {
        const a=storm.points[i-1],b=storm.points[i],p=xy(a[2],a[1]),n=xy(b[2],b[1]);
        // Never draw a false segment across the projection's cut (30°W).
        if (Math.abs(p.x-n.x)>180*scale) continue;
        ctx.strokeStyle=colorFor('cyclones',windMS(b[3]));ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(n.x,n.y);ctx.stroke();
        if (visible(n)) hitPoints.push({...n,id:storm.id,lon:b[2],lat:b[1]});
      }
      if (chosen) {
        const peakIndex=storm.points.findIndex(p=>p[3]===stormPeak(storm)),p=storm.points[Math.max(0,peakIndex)],n=xy(p[2],p[1]);
        ctx.strokeStyle='#fff1ba';ctx.lineWidth=2;ctx.beginPath();ctx.arc(n.x,n.y,8,0,Math.PI*2);ctx.stroke();
      }
    }
  }
  ctx.globalAlpha=1; canvas.dataset.climateVisibleCount=String(new Set(hitPoints.map(p=>p.id)).size);
  canvas.dataset.climateRenderedYear=String(year); canvas.dataset.climatePaintCount=String(Number(canvas.dataset.climatePaintCount||0)+1);
}
function draw(now) {
  frame=0; if (!active || document.hidden || layer.hidden) return;
  frame=requestAnimationFrame(draw);
  if (dataState !== 'ready' || now-lastDraw<1000/24) return; lastDraw=now;
  if (playing && now-lastStep>=6500) { const list=years(); lastStep=now; void setYear(list[(list.indexOf(year)+1)%list.length]); return; }
  const view=projection(), {rect}=view;
  const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1800000/Math.max(1,rect.width*rect.height)));
  const key=[definition.id,year,basin,selectedId,rect.width,rect.height,view.scale,view.x,view.y,ratio].join('/');
  if (key===geometryKey) return; geometryKey=key;
  const width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
  // Reuse backing stores when panning or selecting a record. Assigning even an
  // unchanged canvas dimension clears/reallocates it and resets all drawing state.
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  paint(view,ratio);context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);context.drawImage(buffer,0,0);
}
function resume() { if (active && !frame && !document.hidden && !layer.hidden) frame=requestAnimationFrame(draw); }
function findPoiAt(clientX,clientY,pointerType) {
  if (!active || dataState!=='ready' || layer.classList.contains('is-map-title-transitioning')) return null;
  const {rect}=projection(), x=clientX-rect.left,y=clientY-rect.top; let best=null, distance=pointerType==='touch'?22:12;
  for (const p of hitPoints) { const d=Math.hypot(p.x-x,p.y-y); if(d<distance){best=p;distance=d;} }
  if(!best)return null;
  const item=items().find(p=>p.id===best.id),title=isCoral()?item.name:stormLabel(item);
  return {type:'exhibit',index:items().indexOf(item),record:{id:item.id,exhibitId:definition.id,lon:best.lon,lat:best.lat,title,
    kicker:`${definition.number} / NOAA`,preview:`${year} / ${isCoral()?format(item.years.find(r=>r.year===year)?.max)+' ℃・週':format(windMS(stormPeak(item)))+' m/s'}`,url:definition.source}};
}
function deactivate() {
  if(!active)return;active=false;generation++;playing=false;dataState='idle';cancelAnimationFrame(frame);frame=0;hitPoints=[];
  layer.classList.remove('is-climate-history-exhibit');delete layer.dataset.climateExhibit;
  canvas.hidden=readout.hidden=legend.hidden=true;buttons.get(definition.id)?.setAttribute('aria-current','false');emit('change');
  setBusy(false);
}
async function select(id) {
  const target=CLIMATE_EXHIBITS.find(d=>d.id===id);if(!target)return;
  for(const provider of [globalThis.GaiaLiveExhibits,globalThis.GaiaEstatExhibits,globalThis.GaiaFirmsExhibit,globalThis.GaiaPlanetSignals,globalThis.GaiaMarineCod,globalThis.GaiaFoodExhibits])provider?.deactivate?.();
  const ticket=++generation;definition=target;active=true;dataState='loading';data=null;season=null;year=2016;basin='ALL';selectedId='';playing=false;
  geometryKey='';hitPoints=[];layer.classList.add('is-climate-history-exhibit');layer.dataset.climateExhibit=id;
  globalThis.GaiaMapObservationAdapter?.closePoi?.();canvas.hidden=readout.hidden=false;legend.hidden=true;context.clearRect(0,0,canvas.width,canvas.height);
  for(const b of globalThis.GaiaMapCategories.buttons())b.setAttribute('aria-current',String(b===buttons.get(id)));
  for(const selector of ['#japan-mode-title','#japan-title'])document.querySelector(selector).textContent=target.shortTitle;
  document.querySelector('#japan-mode-number').textContent=target.number;
  const title=document.querySelector('#japan-title');title.dataset.exhibitNumber=target.number;title.setAttribute('aria-label',`${target.number} ${target.shortTitle}`);
  q('[data-climate-number]').textContent=target.number;q('[data-climate-title]').textContent=target.shortTitle;
  q('[data-climate-category]').textContent=isCoral()?'世界 · 水と森':'世界 · 空と天気';
  q('[data-climate-controls]').disabled=q('[data-climate-analysis]').disabled=true;
  setBusy(true);
  q('[data-climate-basin-label]').hidden=isCoral();q('[data-climate-basin]').value='ALL';q('[data-climate-point]').replaceChildren();
  q('[data-climate-value]').textContent='—';q('[data-climate-detail]').textContent='';q('[data-climate-retry]').hidden=true;
  q('[data-climate-status]').textContent='NOAA保存データを読込中…';
  q('[data-climate-key-title]').textContent=isCoral()?'年内最大DHW（℃・週）':'1分平均風速（m/s）';
  q('[data-climate-labels]').replaceChildren(...(isCoral()?['0','2','4','8','16+']:['0','17','33','50','65+']).map(label=>{const span=document.createElement('span');span.textContent=label;return span;}));
  q('[data-climate-guide]').textContent=isCoral()
    ? '衛星による水温観測から、監視海域の高温域（HotSpotの90パーセンタイル）を取り出し、直近84日間の熱ストレスをDHWとして積算。点は監視海域の代表位置、色は年内最大値です。4・8℃・週はNOAAが白化リスクの目安に用いる熱ストレス水準。白化の実測量や海域面積の割合とは区別して読みます。灰色は欠測。'
    : 'NOAA IBTrACS v4r01の主要経路（MAIN）を表示。線の色はUSA_WIND（1分平均風速）をm/sに換算し、灰色は風速欠測。輪は選択経路の最大風速地点です。位置記録には補間時刻を含みます。南半球のシーズンは暦年をまたぎます。海域は各経路の最初の記録で分類し、別経路（spur）は除外しています。';
  emit('change');
  try { const payload=await load(id);if(!active||generation!==ticket)return;data=payload;
    const list=years(),slider=q('[data-climate-year]');slider.min=String(list[0]);slider.max=String(list.at(-1));slider.step='1';slider.value='2016';
    await setYear(2016);if(!active||definition.id!==id)return;
    focusAll();resume();
  } catch(error){if(active&&generation===ticket)fail(error);}
}
const statisticsDataset=()=>active&&dataState==='ready'?statisticsFor({kind:definition.id,data,region:selected(),basin}):null;
async function restoreStatisticsDataset(id) {
  const match=/^climate-(cyclones|coral)-([a-zA-Z0-9_]+)$/.exec(id);if(!match)return null;
  const [,kind,key]=match,payload=await load(kind),region=payload.regions?.find(r=>r.id===key);
  if(kind==='coral'?!region:!Object.hasOwn(BASINS,key))return null;
  return statisticsFor({kind,data:payload,region,basin:key});
}
function mount() {
  if(readout)return;layer=document.querySelector('#japan-layer');map=document.querySelector('#japan-map');if(!map)return;
  canvas=document.createElement('canvas');canvas.id='gaia-climate-canvas';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');map.append(canvas);context=canvas.getContext('2d');buffer=document.createElement('canvas');bufferContext=buffer.getContext('2d');
  readout=document.createElement('section');readout.className='gaia-climate-readout';readout.hidden=true;readout.setAttribute('aria-label','気候記録の海域・対象・年');
  readout.innerHTML=`<div class="gaia-climate-chapter"><p data-climate-category></p><button type="button" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover"><b data-climate-number></b><strong data-climate-title></strong></button></div>
    <p class="gaia-climate-status" data-climate-status role="status"></p><button type="button" data-climate-retry hidden>再試行</button>
    <fieldset data-climate-controls disabled><legend class="gaia-climate-sr">観測記録を選ぶ</legend><div class="gaia-climate-pickers"><label data-climate-basin-label>海域<select data-climate-basin aria-label="台風の海域"></select></label><label>記録<select data-climate-point aria-label="監視海域・台風を選択"></select></label></div>
    <div class="gaia-climate-primary"><span data-climate-metric></span><strong data-climate-value>—</strong><small data-climate-detail></small></div>
    <div class="gaia-climate-timeline"><label><b data-climate-period></b><input type="range" data-climate-year min="1980" max="2024" value="2016" step="1" aria-label="気候記録の年" /></label><button type="button" data-climate-overview>全体を見る</button></div></fieldset>
    <div class="gaia-climate-actions"><button type="button" data-climate-source></button><button type="button" data-climate-analysis disabled></button></div>`;
  legend=document.createElement('section');legend.className='gaia-climate-legend';legend.hidden=true;
  legend.innerHTML=`<div class="gaia-climate-key"><h3 data-climate-key-title></h3><div class="gaia-climate-scale"></div><p data-climate-labels></p></div><div class="gaia-climate-insight"><h3 data-climate-selected></h3><p data-climate-insight></p></div><details><summary>指標と出典の読み方</summary><p class="gaia-climate-guide" data-climate-guide></p></details>`;
  layer.append(readout,legend);decorateMapActions(q('.gaia-climate-actions'),q('[data-climate-source]'),q('[data-climate-analysis]'));
  q('[data-climate-basin]').replaceChildren(...Object.entries(BASINS).map(([id,label])=>new Option(label,id)));
  for(const d of CLIMATE_EXHIBITS){const b=document.createElement('button');b.type='button';b.className='map-mode-button';b.textContent=d.number;b.dataset.climateExhibit=d.id;b.dataset.mapPreviewSurface='map';b.setAttribute('aria-current','false');b.setAttribute('aria-label',`${d.number} ${d.shortTitle}`);b.setAttribute('aria-describedby','map-mode-preview');b.addEventListener('click',()=>void select(d.id));layer.querySelector('.map-mode-list').append(b);buttons.set(d.id,b);}
  layer.querySelector('.map-mode-bank').addEventListener('click',event=>{const b=event.target.closest?.('.map-mode-button');if(b&&!b.dataset.climateExhibit)deactivate();},{capture:true});
  for(const node of [readout,legend])for(const type of ['pointerdown','wheel','keydown','keyup'])node.addEventListener(type,event=>event.stopPropagation());
  q('[data-climate-year]').addEventListener('input',event=>{if(event.isTrusted)stopForInteraction();void setYear(Number(event.target.value));});
  q('[data-climate-basin]').addEventListener('change',event=>{stopForInteraction();basin=event.target.value;fillPoints();sync();});
  q('[data-climate-point]').addEventListener('change',event=>{stopForInteraction();selectPoint(event.target.value);});
  q('[data-climate-overview]').addEventListener('click',()=>{stopForInteraction();focusAll();});
  q('[data-climate-retry]').addEventListener('click',()=>{if(data)void setYear(year);else void select(definition.id);});
  q('[data-climate-analysis]').addEventListener('click',()=>{const dataset=statisticsDataset();if(!dataset)return;setPlayback(false);const open=()=>globalThis.GaiaStatisticsLab?.open?.({modeId:dataset.modeId,datasetId:dataset.id,dataset});if(globalThis.GaiaStatisticsLab?.open)open();else addEventListener('gaia:statistics-lab-ready',open,{once:true});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();});
  addEventListener('gaia:japan-close',()=>{cancelAnimationFrame(frame);frame=0;playing=false;});addEventListener('gaia:japan-open',resume);
  // Direct selections by other providers also relinquish this canvas.
  for(const name of ['live-exhibit','estat-exhibit','firms-exhibit','planet-signals','marine-cod','food'])addEventListener(`gaia:${name}-change`,event=>{if(event.detail?.active && active)deactivate();});
  reduced.addEventListener('change',()=>{geometryKey='';});emit('mounted');
}
globalThis.GaiaClimateHistory=Object.freeze({definitions:CLIMATE_EXHIBITS,select,deactivate,setYear,selectPoint,findPoiAt,focusAll,setPlayback,
  getState:()=>({active,id:definition.id,year,basin,selectedId,playing,dataState}),getPlaybackState:()=>({ready:active&&dataState==='ready',supported:true,playing:active&&playing,detail:'収録年を順番に表示します。'}),
  getStatisticsDataset:statisticsDataset,restoreStatisticsDataset,getCruisePoints:()=>items(),selectCruisePoi:index=>{const p=items()[index];if(p)selectPoint(p.id);},
  getSourceInfo:()=>active?{number:definition.number,shortTitle:definition.shortTitle,datasets:[{id:definition.id,title:definition.signalLabel,organisation:isCoral()?'NOAA Coral Reef Watch':'NOAA NCEI / IBTrACS v4r01',url:definition.source,
    attributionNote:`${q('[data-climate-guide]').textContent} 取得 ${data?.retrievedAt?.slice(0,10)||'読込後表示'}。${isCoral()?data?.attribution||'':data?.citation||''}`}]}:null});
if(globalThis.GaiaMapObservationAdapter)mount();else addEventListener('gaia:map-adapter-ready',mount,{once:true});
