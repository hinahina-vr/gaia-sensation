import {createUrbanPanel,URBAN_ARRIVAL_MS,urbanFormat,urbanSourceId,urbanData} from './urban-population.js?v=whole-trends20-20261025';
import {createLongevityPanel,LONGEVITY_ARRIVAL_MS,longevityFormat,longevitySourceId,longevityData} from './longevity-comparison.js?v=whole-trends20-20261025';
import {createFertilizerPanel,FERTILIZER_ARRIVAL_MS,fertilizerFormat} from './fertilizer-use.js?v=fertilizer-20261025';
import { earthBaseScale, earthLongitudeToMapX } from './world-projection.js?v=gaia-japan-center-1';
import { decorateMapActions } from './map-exhibit-actions.js?v=action-icons-ready-20260926';
import { CLIMATE_EXHIBITS, BASINS, windMS, format, stormPeak, stormLabel, colorFor, coralInsight, cycloneInsight, statisticsFor, daysInYear } from './climate-history-model.js?v=whole-trends20-20261025';
import {atlasDefinition,atlasInsight,atlasStatistics,atlasRow} from './atlas-history-model.js?v=whole-trends20-20261025';
import {centuryValue,centuryDetail} from './atlas-century-model.js?v=whole-trends20-20261025';
import {createAtlasView} from './atlas-history-view.js?v=whole-trends20-20261025';
import {createPoiYearCrossfade} from './poi-year-crossfade.js?v=20260926';
import { lakeInsight, lakeStatistics } from './surface-water-model.js?v=lakes-20261022';
import { createLakeView } from './surface-water-view.js?v=lake-blend-20261023';
import { lakeFitCamera } from './surface-water-spatial.js?v=lake-gis-20261022';
import { poiArrival, poiArrivalDuration } from './annual-poi-arrival.js?v=20260909';
import {decodeWaterGrid,waterCellById,waterCellRegion,waterCellStatistics,waterCoordinates,waterRgba} from './water-storage-grid.js?v=water-gis-20261022';
import {createWaterStorageView} from './water-storage-view.js?v=water-poi-20261023';
import {WATER_ARRIVAL_MS} from './water-storage-poi.js?v=water-poi-20261023';
import {decodeTides,TIDE_GUIDE,tideColor,tideReason,tideSource,tideStatistics} from './sea-level-stations.js?v=tide-gis-20261022';
import {createSeaLevelView} from './sea-level-view.js?v=sea-surface-20261023';
import {SEA_ARRIVAL_MS} from './sea-level-marks.js?v=sea-poi-20261023';
import {createCoralHeatView,CORAL_ARRIVAL_MS} from './coral-heat-view.js?v=whole-trends20-20261025';
import {createElectricityPanel,electricityCountryNames,electricityData,electricityDefinition,electricityStatistics,ELECTRICITY_MODES} from './electricity-access.js?v=whole-trends20-20261025';
import {ELECTRICITY_ARRIVAL_MS} from './electricity-country-marks.js?v=electricity-polish-20261023';
import {createDrinkingPanel,drinkingData,drinkingDefinition,drinkingStatistics,DRINKING_MODES} from './drinking-water.js?v=whole-trends20-20261025';
import {DRINKING_ARRIVAL_MS} from './drinking-water-reading.js?v=drinking-polish-20261023';

import {createSanitationPanel,sanitationData,sanitationDefinition,sanitationStatistics,SANITATION_MODES} from './sanitation-services.js?v=whole-trends20-20261025';
import {SANITATION_ARRIVAL_MS} from './sanitation-composition.js?v=sanitation-polish-20261023';
import {createForestPanel,forestCountryNames,forestData,forestDefinition,forestStatistics,forestSigned,FOREST_MODES} from './forest-history.js?v=whole-trends20-20261025';
import {FOREST_ARRIVAL_MS} from './forest-map-trends.js?v=whole-trends20-20261025';
import {countrySourceId} from './country-source-ids.js?v=stress-polish-20261023';
import {createWaterStressPanel} from './water-stress.js?v=stress-polish-20261023';
import {STRESS_ARRIVAL_MS} from './water-stress-marks.js?v=stress-polish-20261023';

import {createCroplandPanel,croplandData,croplandDefinition,croplandStatistics,croplandSigned,CROPLAND_MODES} from './cropland-history.js?v=whole-trends20-20261025';
import {CROPLAND_ARRIVAL_MS} from './cropland-comparison.js?v=whole-trends20-20261025';

import {createYieldPanel,YIELD_ARRIVAL_MS} from './cereal-yield.js?v=yield-20261023';

const cache = new Map(), pending = new Map(), buttons = new Map();
let regionalPanel, lakeView;
const atlasView=createAtlasView(),atlasFade=createPoiYearCrossfade();
let atlasArrival=null,atlasViewKey='';
let lakeArrival = null, lakeDetail = false, lakeAutoDetail = false;
const waterView=createWaterStorageView();
let waterGrid=null,waterSelection=null,waterEntryFocus=false;
const seaView=createSeaLevelView();
const coralView=createCoralHeatView();
let coralArrival=null;
let tideData=null;
let electricityPanel,electricityComparison=null,electricityMode='access',electricityEntryFocus=false;
let drinkingPanel,drinkingComparison=null,drinkingMode='gap',drinkingEntryFocus=false;
let sanitationPanel,sanitationServices=null,sanitationMode='safe',sanitationEntryFocus=false;
let forestPanel,forestMode='change',forestEntryFocus=false;
let stressPanel,stressEntryFocus=false;
let croplandPanel,croplandMode='change',croplandEntryFocus=false;
let yieldPanel,yieldEntryFocus=false;
let fertilizerPanel,fertilizerEntryFocus=false;
let urbanPanel,urbanEntryFocus=false;
let longevityPanel,longevityEntryFocus=false,longevityComparisonId='USA';
let countryEntryLayout=null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let definition = CLIMATE_EXHIBITS[0], active = false, dataState = 'idle', generation = 0;
let data, season, year = 2016, month = 9, basin = 'ALL', selectedId = '', playing = false, frame = 0, lastStep = 0, lastDraw = 0;
let layer, map, canvas, context, buffer, bufferContext, readout, legend, geometryKey = '', hitPoints = [];
const q = selector => readout.querySelector(selector) || legend.querySelector(selector);
const isCoral = () => definition.id === 'coral';
const isLake = () => definition.id === 'lakes';
const isWater = () => definition.id === 'waterstore';
const isSea = () => definition.id === 'sealevel';
const isElectricity = () => definition.id === 'electricity';
const isDrinking = () => definition.id === 'drinking';
const isSanitation = () => definition.id === 'sanitation';
const isForest = () => definition.id === 'foresthistory';
const isStress = () => definition.id === 'waterstress';
const isYield = () => definition.id === 'yield';
const isFertilizer = () => definition.id === 'fertilizer';
const isUrban = () => definition.id === 'urban';
const isLongevity = () => definition.id === 'longevity';
const isCropland = () => definition.id === 'cropland';
const isCountryComparison = () => isElectricity()||isDrinking()||isSanitation()||isForest()||isStress()||isCropland()||isYield()||isFertilizer()||isLongevity()||isUrban();
const isAtlas = () => Boolean(definition.atlas);
const atlasFallback = () => definition.visualReading&&['unavailable','lost','error'].includes(atlasView.getState().engine);
const isRegion = () => isCoral() || isLake() || isAtlas();
const years = () => isRegion() ? [...new Set(data.regions.flatMap(r => r.years.map(y => y.year)))].sort((a,b)=>a-b) : data.years.map(y=>y.year);
const storms = () => (season?.storms || []).filter(s => basin === 'ALL' || s.basin === basin);
const items = () => isSea() ? [...(tideData?.regions||[]),...(data?.regions||[])] : isRegion() ? (isUrban()?urbanData(data):isLongevity()?longevityData(data):data)?.regions || [] : storms();
const selected = () => isWater()&&waterSelection?waterCellRegion(waterGrid,waterSelection):items().find(p=>p.id === selectedId);
const displayDefinition = () => isCropland()?croplandDefinition(definition,croplandMode):isForest()?forestDefinition(definition,forestMode):isSanitation()?sanitationDefinition(definition,sanitationMode):isDrinking()?drinkingDefinition(definition,drinkingMode):isElectricity()?electricityDefinition(definition,electricityMode):definition;
const displayData = () => isUrban()?urbanData(data):isLongevity()?longevityData(data):isCropland()?croplandData(data,croplandMode):isForest()?forestData(data,forestMode):isSanitation()?sanitationData(data,sanitationServices,sanitationMode):isDrinking()?drinkingData(data,drinkingComparison,drinkingMode):isElectricity()?electricityData(data,electricityMode):data;
const selectedRow = () => isCountryComparison()?atlasRow(displayData().regions.find(r=>r.id===selectedId),year):isAtlas()?atlasRow(selected(),year,month):selected()?.years?.find(r=>r.year === year);
const emit = type => dispatchEvent(new CustomEvent(`gaia:climate-${type}`, {detail:{active,id:definition.id,year,dataState}}));
async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const url = file==='sanitation-services' ? '../../data/atlas-history/sanitation-services.json?v=sanitation-gis-20261023' : file==='drinking-comparison' ? '../../data/atlas-history/drinking-comparison.json?v=drinking-gis-20261023' : file==='electricity-comparison' ? '../../data/atlas-history/electricity-comparison.json?v=electricity-gis-20261023' : file==='sealevel-stations' ? '../../data/atlas-history/sealevel-stations.json?v=whole-trends20-20261025' : file==='waterstore-grid' ? '../../data/atlas-history/waterstore-grid.json?v=water-gis-20261022' : atlasDefinition(file) ? `../../data/atlas-history/${file}.json?v=atlas-100-20261022` : file === 'lakes' ? '../../data/surface-water/lakes.json?v=20261022' : `../../data/climate-history/${file}.json?v=20261013`;
  if (!pending.has(file)) pending.set(file, fetch(new URL(url, import.meta.url), {signal:AbortSignal.timeout(30000)})
    .then(async response => {
      if (!response.ok) throw new Error(`Climate snapshot HTTP ${response.status}`);
      let payload = file==='sealevel-stations'?decodeTides(await response.json()):file==='waterstore-grid'?decodeWaterGrid(await response.json()):await response.json();
      if (payload.schemaVersion !== 1 || !(payload.regions?.length || payload.years?.length || (Array.isArray(payload.storms) && Number.isInteger(payload.year)))) throw new Error('Invalid climate snapshot');
      if(file==='electricity')payload=electricityCountryNames(payload);
      if(file==='foresthistory'||file==='cropland')payload=forestCountryNames(payload);
      cache.set(file,payload);
      // Keep only three detailed seasons; the compact manifests remain cached.
      const detailKeys = [...cache.keys()].filter(key=>key.startsWith('cyclones/'));
      while (detailKeys.length > 3) cache.delete(detailKeys.shift());
      return payload;
    }).finally(()=>pending.delete(file)));
  return pending.get(file);
}
function sanitationVersionMatches(payload,services){
  if(payload.sourceUpdated===services.sourceUpdated)return true;
  // A partial/stale update must be refetched by Retry, not retained in cache.
  cache.delete('sanitation');cache.delete('sanitation-services');return false;
}
const setPlayback = value => { playing = Boolean(value) && active && dataState === 'ready'; lastStep = performance.now(); };
const stopForInteraction = () => { setPlayback(false); globalThis.GaiaMapPlayback?.stop('interaction'); };
const setBusy = value => { readout.setAttribute('aria-busy', String(value)); legend.setAttribute('aria-busy', String(value)); };
const focusAll = () => {
  if (isLake()) { lakeDetail = false; lakeAutoDetail = false; layer.classList.remove('is-lake-detail'); lakeView.setDetail(false); geometryKey = ''; q('[data-climate-overview]').textContent = '湖に戻る'; }
  if(isAtlas()&&innerWidth<=900&&!isWater()){focusPoint(selected());return;}
  if(isCountryComparison()){globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:55,lat:10,zoom:1.15,targetX:.45,targetY:.45,durationMs:reduced.matches?0:650,label:'national-comparison-world'});return;}
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:150,lat:8,zoom:1,targetX:.5,targetY:.46,durationMs:isLake()?4200:450,easing:isLake()?'lake-flight':'smoothstep',label:'climate-world'});
};
function openLakeDetail({durationMs=4200}={}) {
  lakeDetail = true; lakeAutoDetail = false; layer.classList.add('is-lake-detail'); lakeView.setDetail(true); geometryKey = ''; hitPoints = [];
  q('[data-climate-overview]').textContent = '3湖の位置';
  const rect=map.getBoundingClientRect(),compact=innerWidth<=900;
  const shown=e=>e?.checkVisibility({visibilityProperty:true});
  const bottom=Math.min(rect.bottom-30,...[readout,document.querySelector('#map-responsive-data'),document.querySelector('#map-mobile-bottom')].filter(shown).map(e=>e.getBoundingClientRect().top-(compact?34:42)))-rect.top;
  const top=(compact?legend.getBoundingClientRect().bottom:parseFloat(getComputedStyle(layer).getPropertyValue('--responsive-legend-top'))||150)-rect.top+(compact?18:28);
  const left=compact?28:90,right=compact?rect.width-28:Math.min(rect.width-70,legend.getBoundingClientRect().left-rect.left-45);
  const area={x:left,y:top,width:Math.max(100,right-left),height:Math.max(100,bottom-top)};
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({...lakeFitCamera(selected().bounds,rect,area),durationMs:reduced.matches?0:durationMs,easing:'lake-flight',label:'lake-geographic-window'});
}
let lakeLocatorKey='',lakePanelKey='';
function syncLakePanel() {
  if(!isLake()||!selected()||!lakeView)return;
  const point=selected(),row=selectedRow(),state=lakeView.getState();
  const adapter=globalThis.GaiaMapObservationAdapter,g=adapter?.getCountryGeometry?.();
  const panelKey=JSON.stringify([point.id,row?.year,state.compare,state.referenceReady,state.sample,g?.state]);
  if(panelKey===lakePanelKey)return;lakePanelKey=panelKey;
  q('[data-lake-name]').textContent=point.name;q('[data-lake-country]').textContent=point.country;
  q('[data-lake-compare]').setAttribute('aria-pressed',String(state.compare));
  q('[data-lake-compare]').disabled=!state.referenceReady;
  q('[data-lake-change]').textContent=Number.isFinite(row?.changePercent)?`2000年比 ${row.changePercent>0?'+':''}${format(row.changePercent)}% · 共通観測部分`:'共通観測が揃う年を比較';
  const s=state.sample;
  q('[data-lake-panel]').dataset.hasSample=String(!!s);
  q('[data-lake-sample]').textContent=s?`${s.year}年 ${s.label} / 2000年 ${s.referenceLabel||'読込中'}`:'水域をタップして、その場所の変化を見る';
  q('[data-lake-coordinates]').textContent=s?`表示セル · ${Math.abs(s.lat).toFixed(3)}°${s.lat<0?'S':'N'} ${Math.abs(s.lon).toFixed(3)}°${s.lon<0?'W':'E'}`:'年を動かすと、同じ場所で比較できます';
  const key=`${point.id}/${g?.state}`;
  if(key===lakeLocatorKey)return;lakeLocatorKey=key;
  const mini=q('[data-lake-locator]'),c=mini.getContext('2d');c.clearRect(0,0,mini.width,mini.height);
  // Cached country paths are longitude+180, unlike the main map's 150°E centre.
  const scale=mini.width/60,x=mini.width/2-(point.lon+180)*scale,y=mini.height/2-(90-point.lat)*scale;
  c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle='#25434e';c.strokeStyle='#7ca4ad';c.lineWidth=.45/scale;
  for(const country of g?.countries||[]){const path=adapter.getCountryPath(country.iso3);if(path){c.fill(path,'evenodd');c.stroke(path);}}c.restore();
  c.fillStyle='#ffdf9b';c.beginPath();c.arc(mini.width/2,mini.height/2,3,0,Math.PI*2);c.fill();
  mini.setAttribute('aria-label',`${point.country}、${point.name}の位置`);
}
const focusPoint = point => {
  let p = isRegion() ? point : point?.points?.[Math.floor(point.points.length/2)];
  if(isCountryComparison()&&p){
    const shape=globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.countries?.find(s=>((isForest()||isStress()||isCropland()||isYield()||isFertilizer()||isLongevity()||isUrban())?(isUrban()?urbanSourceId(s.iso3):isLongevity()?longevitySourceId(s.iso3):countrySourceId(s.iso3)):s.iso3)===p.id);
    if((isLongevity()||isUrban())&&!shape&&(!Number.isFinite(p.lon)||!Number.isFinite(p.lat)))return;
    const compact=innerWidth<=900,rect=map.getBoundingClientRect(),drawer=document.querySelector('#map-responsive-data'),dock=document.querySelector('#map-mobile-bottom'),visible=e=>e?.checkVisibility({visibilityProperty:true});
    const bottom=visible(drawer)?drawer.getBoundingClientRect().bottom-drawer.querySelector(':scope > summary').getBoundingClientRect().height:visible(readout)?readout.getBoundingClientRect().top:rect.bottom;
    const top=legend.getBoundingClientRect().bottom,limit=Math.min(bottom,visible(dock)?dock.getBoundingClientRect().top:rect.bottom);
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:shape?.lon??p.lon,lat:shape?.lat??p.lat,zoom:compact?2.5:2,targetX:compact?.5:.42,targetY:compact?Math.max(.4,Math.min((isFertilizer()||isLongevity()||isUrban())?.94:.75,((top+limit)/2-rect.top)/rect.height)):.5,durationMs:reduced.matches?0:850,label:'electricity-country'});return;
  }
  if(isSea()&&p){
    const compact=innerWidth<=900,rect=map.getBoundingClientRect(),drawer=document.querySelector('#map-responsive-data'),mobileDock=document.querySelector('#map-mobile-bottom');
    const visible=e=>e?.checkVisibility({visibilityProperty:true});
    // Selecting inside the expanded short-screen drawer must frame the map for
    // its collapsed height, not push the chosen port behind the upper legend.
    const controlTop=visible(drawer)?drawer.getBoundingClientRect().bottom-drawer.querySelector(':scope > summary').getBoundingClientRect().height:visible(readout)?readout.getBoundingClientRect().top:rect.bottom;
    const top=compact?legend.getBoundingClientRect().bottom:160,bottom=compact?Math.min(controlTop,visible(mobileDock)?mobileDock.getBoundingClientRect().top:rect.bottom):rect.bottom-140;
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:p.lon,lat:p.lat,zoom:p.stationId?(compact?2.5:2.8):(compact?1.25:1),targetX:compact?.5:.42,targetY:compact?Math.max(.4,Math.min(.75,((top+bottom)/2-rect.top)/rect.height)):.5,durationMs:reduced.matches?0:850,label:p.stationId?'sea-level-station':'sea-level-basin'});return;
  }
  if(isCoral()&&p){
    const compact=innerWidth<=900,rect=map.getBoundingClientRect(),drawer=document.querySelector('#map-responsive-data'),dock=document.querySelector('#map-mobile-bottom');
    const visible=e=>e?.checkVisibility({visibilityProperty:true});
    const bottom=visible(drawer)?drawer.getBoundingClientRect().bottom-drawer.querySelector(':scope > summary').getBoundingClientRect().height:visible(readout)?readout.getBoundingClientRect().top:rect.bottom;
    const top=legend.getBoundingClientRect().bottom,limit=Math.min(bottom,visible(dock)?dock.getBoundingClientRect().top:rect.bottom);
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:p.lon,lat:p.lat,zoom:compact?2:2.4,targetX:compact?.5:.43,targetY:compact?Math.max(.4,Math.min(.75,((top+limit)/2-rect.top)/rect.height)):.5,durationMs:reduced.matches?0:850,label:'coral-monitoring-region'});return;
  }
  if(isWater()&&p){
    const compact=innerWidth<=900,rect=map.getBoundingClientRect(),drawer=document.querySelector('#map-responsive-data'),dock=document.querySelector('#map-mobile-bottom');
    const visible=e=>e?.checkVisibility({visibilityProperty:true});
    // Use the collapsed drawer boundary even when a region is chosen inside it.
    const controls=visible(drawer)?drawer.getBoundingClientRect().bottom-drawer.querySelector(':scope > summary').getBoundingClientRect().height:visible(readout)?readout.getBoundingClientRect().top:rect.bottom;
    const top=legend.getBoundingClientRect().bottom,bottom=Math.min(controls,visible(dock)?dock.getBoundingClientRect().top:rect.bottom);
    const targetY=compact?Math.max(.4,Math.min(.8,((top+bottom)/2-rect.top)/rect.height)):.5;
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:p.lon,lat:p.lat,zoom:compact?2:2.4,targetX:compact?.5:.42,targetY,durationMs:reduced.matches?0:900,label:'water-storage-region'});return;
  }
  if(definition.view==='events'){
    const events=data.events.filter(e=>e.year===year&&(point.id==='ALL'||e.region===point.id)&&Number.isFinite(e.lon)&&Number.isFinite(e.lat));
    const event=events.find(e=>e.region==='JPN')||events[0];
    if(event)p=event;
    if(innerWidth<=900&&event){
      const rect=map.getBoundingClientRect(),top=legend.getBoundingClientRect().bottom,bottom=Math.min(...[readout,document.querySelector('#map-responsive-data'),document.querySelector('#map-mobile-bottom')].filter(e=>e?.checkVisibility({visibilityProperty:true})).map(e=>e.getBoundingClientRect().top));
      const targetY=Math.max(.4,Math.min(.75,((top+bottom)/2-rect.top)/rect.height));
      // Enough scale to place a northern event below the legend without hitting
      // the world's north-edge pan clamp. Preserve the actual event coordinate.
      const requiredScale=Math.max(rect.height*targetY/Math.max(1,90-p.lat),rect.height*(1-targetY)/Math.max(1,90+p.lat));
      const zoom=Math.min(4,Math.max(1.25,requiredScale/earthBaseScale(rect)+.05));
      globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:p.lon,lat:p.lat,zoom,targetX:.5,targetY,durationMs:500,label:'climate-event'});return;
    }
  }
  if(definition.century&&p?.aggregate){globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:150,lat:8,zoom:1,targetX:.5,targetY:.46,durationMs:450,label:'climate-global-aggregate'});return;}
  if (p && (!isRegion() || (Number.isFinite(p.lon)&&Number.isFinite(p.lat)))) globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:isRegion()?p.lon:p[2],lat:isRegion()?p.lat:p[1],zoom:innerWidth<=900?1.25:1,targetX:isLake()?.5:.48,targetY:.45,durationMs:500,label:'climate-observation'});
};
// ResizeObserver-driven mobile headings and the compact drawer can settle
// after the intro class clears. Do not frame against their intermediate boxes.
const countryLayoutReady = now => {
  const boxes=[map,legend,document.querySelector('#map-responsive-data'),document.querySelector('#map-mobile-bottom')];
  const key=boxes.map(e=>{const r=e?.getBoundingClientRect();return r?[r.top,r.bottom,r.width,r.height,e.checkVisibility({visibilityProperty:true})].join(','):'';}).join('/');
  if(!countryEntryLayout||countryEntryLayout.key!==key){countryEntryLayout={key,since:now};return false;}
  return now-countryEntryLayout.since>=100&&atlasView.geometry()!=='loading';
};
const sync = () => {
  const coral = isCoral(), point = selected(), row = selectedRow(), peak = stormPeak(point);
  q('[data-climate-point]').value = selectedId;
  q('[data-climate-year]').value = String(year);
  q('[data-climate-period]').textContent = `${year}${isRegion()?'年':'シーズン'}${definition.monthly?`${month}月`:''}`;
  q('[data-climate-metric]').textContent = coral ? '年内最大DHW' : '経路内の最大1分平均風速';
  q('[data-climate-value]').textContent = coral ? `${format(row?.max)}${row?' ℃・週':''}` : `${format(windMS(peak))}${peak!=null?' m/s':''}`;
  q('[data-climate-detail]').textContent = isLake() || isAtlas() ? '' : coral ? row ? `DHW ≥ 8：${row.days8}日 / 有効 ${row.validDays}/${daysInYear(year)}日` : 'この年の記録なし'
    : point ? `${point.points.length}時刻 / ${new Date(point.points[0][0]*3600000).toISOString().slice(0,10)}から` : 'この海域の経路なし';
  q('[data-climate-selected]').textContent = point ? isRegion()?point.name:stormLabel(point) : '記録なし';
  q('[data-climate-insight]').textContent = coral ? coralInsight(point,row) : cycloneInsight(storms(),year);
  q('[data-climate-analysis]').disabled = !point && isRegion();
  q('[data-climate-status]').textContent = coral ? `NOAA Coral Reef Watch / ${data.regions.length}監視海域 / 1986–2025年` : `NOAA IBTrACS v4r01 / ${storms().length}主要経路 / 1980–2024シーズン`;
  if (isLake()) {
    q('[data-climate-metric]').textContent = '湖周辺の水面積';
    q('[data-climate-value]').textContent = row?.coverage>0 ? `${format(row.water)} km²` : '欠測';
    q('[data-climate-detail]').textContent = row ? `水域内の観測カバー率 ${format(row.coverage)}%` : 'この年の記録なし';
    q('[data-climate-insight]').textContent = lakeInsight(point,row);
    q('[data-climate-status]').textContent = 'Source: EC JRC/Google · GSW v1.0 · 1984–2015年 · 3湖周辺の固定範囲';
    if (point && row) void lakeView.show(point,row);
  }
  if(isAtlas()){
    q('[data-climate-metric]').textContent=definition.metric;
    q('[data-climate-value]').textContent=definition.century?centuryValue(definition,row,format):Number.isFinite(row?.value)?`${format(row.value)} ${definition.unit}`:'欠測';
    if(definition.century&&Number.isFinite(row?.value)&&!row.censored&&!row.invalidComposition){
      const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=` ${definition.unit}`;
      q('[data-climate-value]').replaceChildren(document.createTextNode(format(row.value)),unit);
    }
    q('[data-climate-detail]').textContent=definition.century?centuryDetail(definition,row,format):atlasFallback()?'互換表示 · 国の色で比較':definition.id==='snowcover'?'扇の面積 = 各月の積雪面積':definition.monthly?'円の面積 = 集計面積':definition.id==='waterstore'?`有効 ${row?.months||0}/12か月`:definition.id==='sealevel'?`${row?.mission||''} / ${row?.samples||0}観測`:'国・地域の公表・推計値';
    q('[data-climate-insight]').textContent=`${definition.century?'':atlasInsight(definition,point,year,month)}${definition.visualReading?` ${atlasFallback()?(definition.view==='countries'?'互換表示：国の色で値を比較できます。':'互換表示：集計図と数値で比較できます。'):definition.visualReading}`:''}`;
    q('[data-climate-status]').textContent=`${definition.organisation} / ${data.period.join('–')}年 / ${data.regions.length}${definition.view==='countries'?'国・地域':'対象範囲'}`;
    q('[data-climate-guide]').textContent=`${definition.guide} ${data.method||''}`;
    q('[data-climate-analysis]').disabled=!point||!atlasStatistics(definition,data,point,month)?.rows.length;
  }
  if(isWater())syncWaterPanel();
  if(isSea())syncSeaPanel();
  if(isCoral())syncCoralPanel();
  if(isElectricity())syncElectricityPanel();
  if(isDrinking())syncDrinkingPanel();
  if(isSanitation())syncSanitationPanel();
  if(isForest())syncForestPanel();
  if(isCropland())syncCroplandPanel();
  if(isUrban()){
    urbanPanel.sync({region:point,year});
    q('[data-climate-key-title]').textContent='都市人口の割合 · % · 灰色は欠測';
    q('[data-climate-detail]').textContent='総人口に占める割合';
    if(Number.isFinite(row?.value)){const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=' %';q('[data-climate-value]').replaceChildren(document.createTextNode(urbanFormat(row.value)),unit);}
  }
  if(isLongevity()){
    if(longevityComparisonId===selectedId||!data.regions.some(r=>r.id===longevityComparisonId))longevityComparisonId=selectedId==='USA'?'JPN':'USA';
    longevityPanel.sync({region:point,comparison:items().find(r=>r.id===longevityComparisonId),year,data:displayData()});
    q('[data-climate-key-title]').textContent='出生時平均余命 · 年 · 灰色は欠測';
    q('[data-climate-detail]').textContent='選択年の死亡率から計算';
    if(Number.isFinite(row?.value)){const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=' 年';q('[data-climate-value]').replaceChildren(document.createTextNode(longevityFormat(row.value)),unit);}
  }
  if(isFertilizer()){
    fertilizerPanel.sync({region:point,year,data});
    q('[data-climate-key-title]').textContent='肥料成分 · kg/ha · 灰色は欠測';
    q('[data-climate-detail]').textContent='肥料成分消費量 ÷ 耕地面積';
    if(Number.isFinite(row?.value)){const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=' kg/ha';q('[data-climate-value]').replaceChildren(document.createTextNode(fertilizerFormat(row.value)),unit);}
  }
  if(isYield()){
    yieldPanel.sync({region:point,year});
    q('[data-climate-key-title]').textContent='穀物収量 · kg/ha · 灰色は欠測';
    q('[data-climate-detail]').textContent='穀物の収穫面積 1 ha あたり';
    if(Number.isFinite(row?.value)){const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=' kg/ha';q('[data-climate-value]').replaceChildren(document.createTextNode(format(row.value)),unit);}
  }
  if(isStress()){
    stressPanel.sync({region:point,year});
    q('[data-climate-detail]').textContent='淡水資源に対する取水の割合';
    q('[data-climate-guide]').textContent=`${definition.guide} 地図の斜線は100%超の国。選択国の2本の帯は、利用可能な淡水を100とした資源と取水の比を表します。年次グラフは隣り合う観測年を結び、欠測年では線を分けます。`;
    if(Number.isFinite(row?.value)){const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=' %';q('[data-climate-value]').replaceChildren(document.createTextNode(format(row.value)),unit);}
  }
  geometryKey = ''; emit('update');
};
function setCroplandMode(mode){
  if(!isCropland()||dataState!=='ready'||!CROPLAND_MODES.includes(mode)||mode===croplandMode)return;
  stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  croplandMode=mode;sync();resume();
}
function syncCroplandPanel(){
  croplandPanel.sync({region:selected(),year,mode:croplandMode});
  const d=displayDefinition(),row=selectedRow(),change=croplandMode==='change';
  q('[data-climate-metric]').textContent=d.metric;q('[data-climate-value]').textContent='欠測';
  if(Number.isFinite(row?.value)){
    const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=change?' pt':' %';unit.title=d.unit;
    q('[data-climate-value]').replaceChildren(document.createTextNode(change?croplandSigned(row.value):format(row.value)),unit);
  }
  q('[data-climate-detail]').textContent=change?'同じ国の耕地面積率を比較':'陸地に占める耕地の割合';
  q('[data-climate-key-title]').textContent=change?'耕地面積率の増減 · 2000年基準':'耕地面積率 · 灰色は欠測';
  q('.gaia-climate-scale').style.background=`linear-gradient(90deg,${d.colors.join(',')})`;
  q('[data-climate-labels]').replaceChildren(...d.labels.map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('[data-climate-guide]').textContent=`${definition.guide} 地図は各国の陸地面積に対する耕地面積の割合。増減は同じ国の2000年との差（ポイント）で、青は低下、金は上昇。±5ポイントで色の上限とし、値はそのまま表示。基準年か比較年の欠測は灰色。地図上の比較線は全ての国で0–100%の共通目盛。白抜きの点は2000年、色の点は選択年で、その間が割合の変化です。年次グラフは公表年ごとの点と線。増減は国ごとに全期間共通の上下対称な目盛り、割合は0–100%。欠測年は斜線で示します。`;
  q('[data-climate-analysis]').disabled=!croplandStatistics(definition,data,selected(),croplandMode)?.rows.length;
}
function setForestMode(mode){
  if(!isForest()||dataState!=='ready'||!FOREST_MODES.includes(mode)||mode===forestMode)return;
  stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  forestMode=mode;sync();resume();
}
function syncForestPanel(){
  forestPanel.sync({region:selected(),year,mode:forestMode});
  const d=displayDefinition(),row=selectedRow(),change=forestMode==='change';
  q('[data-climate-metric]').textContent=d.metric;q('[data-climate-value]').textContent='欠測';
  if(Number.isFinite(row?.value)){
    const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=change?' pt':' %';unit.title=d.unit;
    q('[data-climate-value]').replaceChildren(document.createTextNode(change?forestSigned(row.value):format(row.value)),unit);
  }
  q('[data-climate-detail]').textContent=change?'同じ国の森林面積率を比較':'陸地に占める森林の割合';
  q('[data-climate-key-title]').textContent=change?'森林面積率の増減 · 2000年基準':'森林面積率 · 灰色は欠測';
  q('.gaia-climate-scale').style.background=`linear-gradient(90deg,${d.colors.join(',')})`;
  q('[data-climate-labels]').replaceChildren(...d.labels.map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('[data-climate-guide]').textContent=`${definition.guide} 地図は各国の陸地面積に対する森林面積の割合。増減は同じ国の2000年との差（ポイント）で、橙は低下、緑は上昇。±10ポイントで地図色の上限とし、値はそのまま表示。基準年か比較年の欠測は灰色。国名に添えた推移線は全ての国で共通の目盛を使い、濃い線は選択年まで、薄い線はその後。破線は2000年、帯は基準年との差です。右の詳細グラフの縦軸は国ごとに調整。どちらも欠測では線を切ります。`;
  q('[data-climate-analysis]').disabled=!forestStatistics(definition,data,selected(),forestMode)?.rows.length;
}
function setElectricityMode(mode){
  if(!isElectricity()||dataState!=='ready'||!Object.hasOwn(ELECTRICITY_MODES,mode)||mode===electricityMode)return;
  stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  electricityMode=mode;sync();resume();
}
function syncElectricityPanel(){
  electricityPanel.sync({data,comparison:electricityComparison,region:selected(),year,mode:electricityMode});
  const d=electricityDefinition(definition,electricityMode),row=selectedRow();
  q('[data-climate-metric]').textContent=d.metric;
  q('[data-climate-value]').textContent=Number.isFinite(row?.value)?`${electricityMode==='change'&&row.value>0?'＋':''}${format(row.value)} ${d.unit}`:'欠測';
  if(Number.isFinite(row?.value)){
    const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=electricityMode==='change'?' pt':` ${d.unit}`;unit.title=d.unit;
    q('[data-climate-value]').replaceChildren(document.createTextNode(`${electricityMode==='change'&&row.value>0?'＋':''}${format(row.value)}`),unit);
  }
  q('[data-climate-detail]').textContent=electricityMode==='change'?'同じ国の2000年との差':'電気を利用できる人口の割合';
  q('[data-climate-key-title]').textContent=`${d.metric} · 灰色は欠測`;
  q('.gaia-climate-scale').style.background=`linear-gradient(90deg,${d.colors.join(',')})`;
  q('[data-climate-labels]').replaceChildren(...d.labels.map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('[data-climate-guide]').textContent=`${definition.guide} ${electricityComparison?.method||''} 地図は国全体の値、実線は選択国、破線は世界銀行の地域集計。国名の横の棒はアクセス率（0〜100%）、細い目盛は2000年。変化表示では中央が0、左右の端は−50・＋50ポイントです。`;
  q('[data-climate-analysis]').disabled=!electricityStatistics(definition,data,selected(),electricityMode)?.rows.length;
}
function setDrinkingMode(mode){
  if(!isDrinking()||dataState!=='ready'||!Object.hasOwn(DRINKING_MODES,mode)||mode===drinkingMode)return;
  stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  drinkingMode=mode;sync();resume();
}
function setSanitationMode(mode){
  if(!isSanitation()||dataState!=='ready'||!Object.hasOwn(SANITATION_MODES,mode)||mode===sanitationMode)return;
  stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  sanitationMode=mode;sync();resume();
}
function syncSanitationPanel(){
  sanitationPanel.sync({services:sanitationServices,region:selected(),year,mode:sanitationMode});
  const d=displayDefinition(),row=selectedRow();
  q('[data-climate-metric]').textContent=d.metric;
  q('[data-climate-value]').textContent=Number.isFinite(row?.value)?`${format(row.value)} %`:'欠測';
  q('[data-climate-detail]').textContent='国の人口に占める割合';
  q('[data-climate-key-title]').textContent=`${d.metric} · 灰色は欠測`;
  q('.gaia-climate-scale').style.background=`linear-gradient(90deg,${d.colors.join(',')})`;
  q('[data-climate-labels]').replaceChildren(...d.labels.map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('[data-climate-guide]').textContent=`${definition.guide} ${sanitationServices.method} 地図上の円環と小さな帯は、その国の人口を100%とする4区分の内訳。円環の中央は選んだ区分の割合です。年別グラフは各年の内訳を帯で結びます。斜線の年は内訳に必要な値が欠測、または整合しない年で、その前後はつなぎません。`;
  q('[data-climate-analysis]').disabled=!sanitationStatistics(definition,data,sanitationServices,selected(),sanitationMode)?.rows.length;
}
function syncDrinkingPanel(){
  drinkingPanel.sync({data,comparison:drinkingComparison,region:selected(),year,mode:drinkingMode});
  const d=displayDefinition(),row=selectedRow(),gap=drinkingMode==='gap';
  q('[data-climate-metric]').textContent=d.metric;q('[data-climate-value]').textContent='欠測';
  if(Number.isFinite(row?.value)){const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=gap?' pt':' %';unit.title=d.unit;q('[data-climate-value]').replaceChildren(document.createTextNode(`${gap&&row.value>0?'＋':''}${format(row.value)}`),unit);}
  q('[data-climate-detail]').textContent=gap?'同年の利用率の差（ポイント）':'全国人口に占める利用率';
  q('[data-climate-key-title]').textContent=gap?'都市と農村の差 · ±50 ptで色の上限':'全国の利用率 · 灰色は欠測';
  q('.gaia-climate-scale').style.background=`linear-gradient(90deg,${d.colors.join(',')})`;
  q('[data-climate-labels]').replaceChildren(...d.labels.map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('[data-climate-guide]').textContent=`${definition.guide} ${drinkingComparison.method} 差の地図では金色は都市、青緑は農村の利用率が高い国。灰色は比較に必要な値の欠測。グラフは都市が金色、農村が青緑で、縦軸は利用率0–100%。2本の線の間が、その年の差。欠測の区間は線をつなぎません。`;
  q('[data-climate-analysis]').disabled=!drinkingStatistics(definition,data,drinkingComparison,selected(),drinkingMode)?.rows.length;
}
function syncCoralPanel(){
  const point=selected(),row=selectedRow();
  q('[data-coral-name]').textContent=point?.name||'監視海域を選択';
  q('[data-coral-period]').textContent=`${year}年 · 熱ストレスが高かった日数`;
  for(const threshold of [4,8]){
    const value=row?.[`days${threshold}`],valid=Number.isFinite(value),bar=q(`[data-coral-days="${threshold}"]`);
    bar.textContent=valid?`${value}日`:'欠測';
    q(`[data-coral-bar="${threshold}"]`).style.width=`${valid?Math.max(0,Math.min(100,value/daysInYear(year)*100)):0}%`;
  }
  q('[data-coral-coverage]').textContent=`有効 ${row?.validDays??0}/${daysInYear(year)}日 · 円弧：DHW ≥ 8 の日数`;
}
function syncWaterPanel(){
  const point=selected(),row=selectedRow();
  q('[data-water-title]').textContent=waterSelection?'選択した陸域':point.name;
  q('[data-water-place]').textContent=waterSelection?waterCoordinates(waterSelection):'固定範囲の平均';
  q('[data-water-value]').textContent=Number.isFinite(row?.value)?`${row.value>0?'+':''}${format(row.value)} cm`:'欠測';
  q('[data-water-period]').textContent=`${year}年 · 有効 ${row?.months||0}/12か月`;
  q('[data-water-chart]').setAttribute('aria-label',`${point.name}、2003年から2024年の陸水量偏差。${year}年 ${Number.isFinite(row?.value)?format(row.value)+'cm':'欠測'}。基準は2004–2009年。`);
  const c=q('[data-water-chart]').getContext('2d'),w=c.canvas.width,h=c.canvas.height;c.clearRect(0,0,w,h);
  const max=Math.max(10,...point.years.filter(r=>Number.isFinite(r.value)).map(r=>Math.abs(r.value))),zero=h/2;
  c.strokeStyle='#aac8ce40';c.lineWidth=1;c.beginPath();c.moveTo(0,zero);c.lineTo(w,zero);c.stroke();
  for(const [i,r]of point.years.entries()){
    const x=5+i*(w-10)/22,bw=(w-10)/22-3;
    if(Number.isFinite(r.value)){const y=zero-r.value/max*(h/2-8),[red,g,b]=waterRgba(r.value);c.fillStyle=`rgb(${red},${g},${b})`;c.globalAlpha=r.year===year?1:.65;c.fillRect(x,Math.min(y,zero),bw,Math.max(1,Math.abs(y-zero)));}
    else{c.strokeStyle='#8c9da780';c.beginPath();c.moveTo(x,zero+4);c.lineTo(x+bw,zero-4);c.stroke();}
    if(r.year===year){c.globalAlpha=1;c.strokeStyle='#ffdf9b';c.strokeRect(x-1,1,bw+2,h-2);}
  }c.globalAlpha=1;
  q('[data-climate-metric]').textContent=waterSelection?'選択セル · 陸水量偏差':'広域平均 · 陸水量偏差';
  q('[data-climate-detail]').textContent=`${waterSelection?'配布0.5° / 推定約3° · ':''}有効 ${row?.months||0}/12か月`;
  q('[data-climate-status]').textContent='NASA JPL / GRACE・GRACE-FO · 2003–2024年 · 2004–2009年基準';
}
function syncSeaPanel(){
  const p=selected(),row=selectedRow(),station=!!p?.stationId;if(!p)return;
  const metric=station?'沿岸の相対海面 · 1993年比':'衛星の海域平均 · 1993年比';
  q('[data-sea-name]').textContent=p.name;
  q('.sea-eyebrow').textContent=station?'COASTAL RECORDS / 沿岸の記録':'SATELLITE / 大洋の平均';
  q('[data-sea-place]').textContent=station?`検潮所 ${p.stationId} · ${Math.abs(p.lat).toFixed(2)}°${p.lat<0?'S':'N'} / ${Math.abs(p.lon).toFixed(2)}°${p.lon<0?'W':'E'}`:'NOAA · 衛星高度計による海域平均';
  q('[data-sea-value]').textContent=Number.isFinite(row?.value)?`${row.value>0?'+':''}${format(row.value)} mm`:'欠測';
  q('[data-sea-year]').textContent=`${year}年`;
  q('[data-sea-note]').textContent=station?(Number.isFinite(row?.value)?'海面と地盤の上下運動を含む相対的な変化':tideReason(row)):`${row?.mission||''} · ${row?.samples||0}観測`;
  q('[data-sea-link]').hidden=!station;q('[data-sea-link]').href=station?tideSource(p.stationId):definition.source;
  q('[data-climate-metric]').textContent=metric;q('[data-climate-detail]').textContent=station?`PSMSL ${p.stationId} · ${Number.isFinite(row?.value)?'RLR年平均':tideReason(row)}`:`${row?.mission||''} / ${row?.samples||0}観測`;
  q('[data-climate-key-title]').textContent='海の色 · 衛星3海域平均 · 1993年比';
  q('[data-climate-labels]').replaceChildren(...['−30','+20','+70','+120 mm'].map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('.gaia-climate-scale').style.background='linear-gradient(90deg,#10335b,#196d91,#5bbab5,#e7c782)';
  q('[data-climate-guide]').textContent=`海の色は太平洋・大西洋・インド洋の年平均を海域間で滑らかにつないだ表示です。値を読むときは各海域の平均と沿岸の実測点を選びます。うねりと反射は海面の質感を表す演出です。 ${TIDE_GUIDE} ${tideData.method} ${definition.guide} ${data.method}`;
  q('[data-climate-status]').textContent=`PSMSL · ${tideData.regions.length}検潮所 / NOAA · 3海域平均 · 1993–2024年`;
  q('[data-climate-analysis]').disabled=station?!tideStatistics(tideData,p)?.rows.length:!atlasStatistics(definition,data,p)?.rows.length;
  const chart=q('[data-sea-chart]'),c=chart.getContext('2d'),w=chart.width,h=chart.height,left=54,right=w-12,top=13,bottom=h-30;
  const values=p.years.filter(r=>Number.isFinite(r.value)).map(r=>r.value),lo=Math.min(-30,...values),hi=Math.max(60,...values),span=hi-lo,y=v=>bottom-(v-lo)/span*(bottom-top),x=year=>left+(year-1993)/31*(right-left);
  c.clearRect(0,0,w,h);c.font='16px serif';c.textAlign='right';c.fillStyle='#aac6ce';
  for(const v of [lo,0,hi]){c.fillText(`${Math.round(v)}`,left-8,y(v)+5);c.beginPath();c.strokeStyle=v===0?'#ffdf9b80':'#b1ced526';c.setLineDash(v===0?[5,5]:[]);c.moveTo(left,y(v));c.lineTo(right,y(v));c.stroke();}c.setLineDash([]);
  c.lineWidth=2.5;c.strokeStyle='#a6dee6';let previous=false;c.beginPath();
  for(const r of p.years){if(!Number.isFinite(r.value)){previous=false;continue;}previous?c.lineTo(x(r.year),y(r.value)):c.moveTo(x(r.year),y(r.value));previous=true;}c.stroke();
  for(const r of p.years){if(Number.isFinite(r.value)){c.fillStyle=r.year===year?'#ffdf9b':'#c8e9ec';c.beginPath();c.arc(x(r.year),y(r.value),r.year===year?5:2,0,Math.PI*2);c.fill();}else{c.strokeStyle='#93aab3';c.beginPath();c.moveTo(x(r.year)-2,bottom+9);c.lineTo(x(r.year)+2,bottom+5);c.stroke();}}
  c.strokeStyle='#ffdf9b66';c.lineWidth=1;c.beginPath();c.moveTo(x(year),top);c.lineTo(x(year),bottom);c.stroke();c.fillStyle='#a9c5ce';c.textAlign='left';c.fillText('1993',left,h-4);c.textAlign='right';c.fillText('2024',right,h-4);
  chart.setAttribute('aria-label',`${p.name}、${metric}。1993年から2024年。${year}年 ${Number.isFinite(row?.value)?format(row.value)+'mm':tideReason(row)}。欠測年は線を結ばず表示。`);
}
function fillPoints() {
  const list = items();
  if(isSea()){
    if(!list.some(p=>p.id===selectedId))selectedId=list.find(p=>p.id==='tide-134')?.id||list[0]?.id||'';
    const groups=[['沿岸の検潮所（相対海面）',tideData?.regions||[]],['衛星による海域平均',data.regions]].map(([label,rows])=>{const g=document.createElement('optgroup');g.label=label;g.append(...rows.map(p=>new Option(p.name,p.id)));return g;});
    q('[data-climate-point]').replaceChildren(...groups);return;
  }
  if(isWater()&&waterSelection){q('[data-climate-point]').replaceChildren(...list.map(p=>new Option(p.name,p.id)),new Option(`選択セル ${waterCoordinates(waterSelection)}`,selectedId));return;}
  if (!list.some(p=>p.id === selectedId)) selectedId = isRegion() ? list.find(p=>p.id === (isUrban()?'CHN':isLongevity()?'JPN':isFertilizer()?'IND':isYield()?'IND':isCropland()?'ETH':isStress()?'EGY':isForest()?'BRA':isSanitation()?'IND':isDrinking()?'IND':isElectricity()?'KEN':isAtlas()&&definition.view==='countries'?'JPN':'southern_ryukyu_islands'))?.id || list[0]?.id || ''
    : list.reduce((best,p)=>!best || (stormPeak(p)??-1)>(stormPeak(best)??-1)?p:best,null)?.id || '';
  q('[data-climate-point]').replaceChildren(...list.map(p=>new Option(isRegion()?p.name:stormLabel(p),p.id)));
}
async function setYear(next) {
  if (!active || !data || !years().includes(Number(next))) return;
  if((isAtlas()||isCoral())&&dataState==='ready'&&Number(next)!==year&&!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  const ticket = ++generation; year = Number(next); dataState = 'loading'; season = null; geometryKey = ''; hitPoints = [];
  setBusy(true);
  if(!isAtlas()&&!isCoral())context.clearRect(0,0,canvas.width,canvas.height); q('[data-climate-controls]').disabled = true; q('[data-climate-analysis]').disabled = true;
  q('[data-climate-value]').textContent = '—'; q('[data-climate-period]').textContent = `${year}${isRegion()?'年':'シーズン'}`;
  q('[data-climate-detail]').textContent = ''; q('[data-climate-selected]').textContent = `${year}の記録`;
  q('[data-climate-insight]').textContent = `${year}の記録を読み込んでいます。`; q('[data-climate-status]').textContent = isAtlas()?'保存データを読込中…':isLake()?'JRC保存データを読込中…':'NOAA保存データを読込中…';
  q('[data-climate-retry]').hidden = true;
  try {
    const payload = isRegion() ? null : await load(`cyclones/${year}`);
    if (!active || ticket !== generation) return;
    season = payload; dataState = 'ready'; fillPoints(); sync(); setBusy(false); q('[data-climate-controls]').disabled = false; legend.hidden = false; lastStep = performance.now(); emit('ready'); resume();
  } catch (error) {
    if (active && ticket === generation) fail(error);
  }
}
function fail(error) {
  lakeView?.clear();
  setBusy(false);
  dataState = 'error'; playing = false; q('[data-climate-status]').textContent = '保存データの読込に失敗しました。再試行できます。';
  q('[data-climate-retry]').hidden = false; emit('error'); console.warn('Climate snapshot unavailable',error);
}
function selectPoint(id, {focus=true,sample=null} = {}) {
  if((isSea()||isCoral()||isCountryComparison())&&!focus)stopForInteraction();
  if(isWater()&&dataState==='ready'){
    if(!focus)stopForInteraction();
    const cell=waterCellById(waterGrid,id);
    if(cell){stopForInteraction();waterSelection=cell;selectedId=cell.id;fillPoints();sync();if(focus)focusPoint(selected());return;}
    if(!items().some(p=>p.id===id))return;
    waterSelection=null;
  }
  if (dataState !== 'ready' || !items().some(p=>p.id === id)) return;
  if(isLake()&&sample){stopForInteraction();lakeView.selectSample(sample);return;}
  selectedId = id; sync(); if (isLake()) openLakeDetail(); else if (focus||isWater()) focusPoint(selected());
}
const projection = () => {
  const rect = globalThis.GaiaMapObservationAdapter?.getViewportRect?.() || map.getBoundingClientRect();
  const d = document.querySelector('#japan-overlay').dataset, scale = earthBaseScale(rect)*Math.max(1,Number(d.earthZoom)||1);
  return {rect,scale,x:(rect.width-360*scale)/2+(Number(d.earthOffsetX)||0),y:(rect.height-180*scale)/2+(Number(d.earthOffsetY)||0)};
};
function paint(view, ratio, now) {
  const ctx = bufferContext, {rect,scale} = view;
  if (buffer.width !== canvas.width) buffer.width = canvas.width;
  if (buffer.height !== canvas.height) buffer.height = canvas.height;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,buffer.width,buffer.height);
  ctx.setTransform(ratio,0,0,ratio,0,0); hitPoints = [];
  const xy = (lon,lat) => ({x:view.x+earthLongitudeToMapX(lon)*scale,y:view.y+(90-lat)*scale});
  const visible = p => p.x>=-12 && p.y>=-12 && p.x<=rect.width+12 && p.y<=rect.height+12;
  if (isCoral()) {
    hitPoints=coralView.paint(ctx,{regions:data.regions,year,selectedId,xy,scale,width:rect.width,height:rect.height,ratio,elapsed:coralArrival===null?-1:now-coralArrival,reduced:reduced.matches});
    canvas.dataset.coralEngine=coralView.getState().engine;
  } else if (isSea()) {
    const result=seaView.paint(ctx,{stations:tideData.regions,basins:data.regions,year,selectedId,view,ratio,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});hitPoints=result.points;canvas.dataset.atlasGeometryState=result.state;canvas.dataset.atlasEngine=seaView.getState().engine;
  } else if (isWater()) {
    const result=waterView.paint(ctx,{data:waterGrid,regions:data.regions,year,view,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches,cell:waterSelection,region:selected()});
    hitPoints=result.points;canvas.dataset.atlasGeometryState=result.state;canvas.dataset.atlasEngine=waterView.getState().engine;
  } else if (isAtlas()) {
    const result=atlasView.paint(ctx,{definition:displayDefinition(),data:displayData(),comparison:isDrinking()?drinkingComparison:null,sanitation:isSanitation()?{data,services:sanitationServices,mode:sanitationMode}:null,forest:isForest()?{data,mode:forestMode}:null,cropland:isCropland()?{data,mode:croplandMode}:null,longevity:isLongevity()?{comparison:items().find(r=>r.id===longevityComparisonId)}:null,year,month,selectedId,view,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;canvas.dataset.atlasGeometryState=result.state;
    const engine=atlasView.getState().engine;
    if(definition.visualReading&&canvas.dataset.atlasEngine!==engine){
      canvas.dataset.atlasEngine=engine;
      const fallback=engine!=='webgl2';
      q('[data-climate-detail]').textContent=definition.century?centuryDetail(definition,selectedRow(),format):fallback?'互換表示 · 国の色で比較':'国・地域の公表・推計値';
      q('[data-climate-insight]').textContent=`${definition.century?'':atlasInsight(definition,selected(),year,month)} ${fallback?(definition.view==='countries'?'互換表示：国の色で値を比較できます。':'互換表示：集計図と数値で比較できます。'):definition.visualReading}`;
    }
    if(result.state!=='ready')geometryKey='';
    if(result.state==='error'){q('[data-climate-status]').textContent='国境図形を読み込めません。再試行できます。';q('[data-climate-retry]').hidden=false;}
  } else if (isRegion()) {
    for (const [index, region] of data.regions.entries()) {
      const point = xy(region.lon,region.lat), row = region.years.find(y=>y.year===year); if (!visible(point)) continue;
      if (isLake() && lakeDetail && scale>30) continue;
      const arrival = isLake() ? poiArrival(index,data.regions.length,lakeArrival===null?-1:now-lakeArrival,reduced.matches) : {alpha:1,scale:1};
      if (!arrival.alpha) continue;
      const color = isLake() ? '#8ad9ca' : colorFor('coral',row?.max), chosen = region.id===selectedId, radius = chosen?7:4;
      ctx.beginPath(); ctx.arc(point.x,point.y,radius*arrival.scale,0,Math.PI*2); ctx.fillStyle=color; ctx.globalAlpha=arrival.alpha*(chosen?1:.7); ctx.fill();
      if (chosen) { ctx.strokeStyle='#fff1ba'; ctx.lineWidth=1.5; ctx.beginPath();ctx.arc(point.x,point.y,11*arrival.scale,0,Math.PI*2);ctx.stroke(); }
      if (isLake()) { ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.lineWidth=4;ctx.strokeStyle='#081923';ctx.strokeText(region.name,point.x,point.y-20);ctx.fillStyle='#d9f5ef';ctx.fillText(region.name,point.x,point.y-20); }
      if (arrival.alpha >= .9) hitPoints.push({...point,id:region.id,lon:region.lon,lat:region.lat});
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
  canvas.hidden=layer.matches('.is-map-title-transitioning, .is-map-data-intro');
  if (canvas.hidden) { countryEntryLayout=null;lastStep=now; if(isLake()){lakeArrival=null;lakeView.setVisible(false);} if(isAtlas()||isCoral()){atlasArrival=coralArrival=null;atlasFade.reset();} return; }
  const fps=(isCoral()&&coralView.getState().field.engine==='canvas2d')||(isSea()&&seaView.getState().engine==='canvas2d')?12:24;
  if (dataState !== 'ready' || now-lastDraw<1000/fps) return; lastDraw=now;
  // The short-screen drawer and heading are mounted during the intro. Frame
  // the selected country only after their final layout, before revealing data.
  if((isWater()&&waterEntryFocus)||(isElectricity()&&electricityEntryFocus)||(isDrinking()&&drinkingEntryFocus)||(isSanitation()&&sanitationEntryFocus)||(isForest()&&forestEntryFocus)||(isStress()&&stressEntryFocus)||(isCropland()&&croplandEntryFocus)||(isYield()&&yieldEntryFocus)||(isFertilizer()&&fertilizerEntryFocus)||(isLongevity()&&longevityEntryFocus)||(isUrban()&&urbanEntryFocus)){
    lastStep=now;if(!countryLayoutReady(now))return;
    waterEntryFocus=electricityEntryFocus=drinkingEntryFocus=sanitationEntryFocus=forestEntryFocus=stressEntryFocus=croplandEntryFocus=yieldEntryFocus=false;fertilizerEntryFocus=longevityEntryFocus=urbanEntryFocus=false;countryEntryLayout=null;focusPoint(selected());return;
  }
  let arriving = false;
  if(isCoral()){
    if(document.querySelector('#japan-overlay').dataset.viewAnimation==='running'&&coralArrival===null){lastStep=now;return;}
    coralArrival??=now;arriving=!reduced.matches&&now-coralArrival<CORAL_ARRIVAL_MS;
    canvas.dataset.climateArrival=arriving?'running':'complete';if(arriving)lastStep=now;
  }
  if(isAtlas()){
    if(document.querySelector('#japan-overlay').dataset.viewAnimation==='running'&&atlasArrival===null){lastStep=now;return;}
    const seaGeography=isSea()?globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.state:null;
    if((definition.view==='countries'&&atlasView.geometry()!=='ready')||(isSea()&&seaGeography!=='ready'&&seaGeography!=='error')){geometryKey='';}else atlasArrival??=now;
    arriving=atlasArrival===null||now-atlasArrival<(isWater()?WATER_ARRIVAL_MS:isSea()?SEA_ARRIVAL_MS:isUrban()?URBAN_ARRIVAL_MS:isLongevity()?LONGEVITY_ARRIVAL_MS:isFertilizer()?FERTILIZER_ARRIVAL_MS:isYield()?YIELD_ARRIVAL_MS:isCropland()?CROPLAND_ARRIVAL_MS:isStress()?STRESS_ARRIVAL_MS:isForest()?FOREST_ARRIVAL_MS:isSanitation()?SANITATION_ARRIVAL_MS:isDrinking()?DRINKING_ARRIVAL_MS:isElectricity()?ELECTRICITY_ARRIVAL_MS:poiArrivalDuration(definition.view==='countries'?240:data.regions.length));
    canvas.dataset.climateArrival=arriving?'running':'complete';if(arriving)lastStep=now;
  }
  if (isLake()) {
    const moving=document.querySelector('#japan-overlay').dataset.viewAnimation==='running';
    if(moving)lastStep=now;
    if(moving&&lakeArrival===null)return;
    lakeArrival ??= now;
    arriving = now-lakeArrival < poiArrivalDuration(data.regions.length);
    canvas.dataset.climateArrival = arriving?'running':'complete';
    if (arriving) lastStep=now;
    if (!arriving && lakeAutoDetail && now-lakeArrival>=poiArrivalDuration(data.regions.length)+700) openLakeDetail();
    lakeView.setVisible(true);lakeView.paint(projection(),now);syncLakePanel();
  }
  if (playing && now-lastStep>=6500) { const list=years(); lastStep=now; void setYear(list[(list.indexOf(year)+1)%list.length]); return; }
  const view=projection(), {rect}=view;
  const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1800000/Math.max(1,rect.width*rect.height)));
  const key=[definition.id,year,month,basin,selectedId,isLongevity()?longevityComparisonId:'',isForest()?forestMode:isSanitation()?sanitationMode:isElectricity()?electricityMode:isDrinking()?drinkingMode:'',rect.width,rect.height,view.scale,view.x,view.y,ratio,(isCoral()||isSea())?globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.state:''].join('/');
  const flowing=(isCoral()||(isSea()&&globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.state==='ready'))&&!reduced.matches;
  if (key===geometryKey && !arriving && !atlasFade.getState().active && !flowing) return; geometryKey=arriving?'':key;
  const width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
  // Reuse backing stores when panning or selecting a record. Assigning even an
  // unchanged canvas dimension clears/reallocates it and resets all drawing state.
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  paint(view,ratio,now);context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);context.drawImage(buffer,0,0);
  atlasViewKey=[rect.width,rect.height,view.scale,view.x,view.y,ratio].join('/');
  if(isAtlas()||isCoral())atlasFade.paint(context,atlasViewKey,now,reduced.matches);
  canvas.dataset.yearFade=atlasFade.getState().active?'running':'complete';
}
function resume() { if (active && !frame && !document.hidden && !layer.hidden) frame=requestAnimationFrame(draw); }
function findPoiAt(clientX,clientY,pointerType) {
  if (!active || dataState!=='ready' || layer.matches('.is-map-title-transitioning, .is-map-data-intro')) return null;
  if(isSea()){
    const hit=seaView.pick(clientX,clientY,projection()),p=hit&&items().find(r=>r.id===hit.id);if(!p)return null;const row=p.years.find(r=>r.year===year);
    return {type:'exhibit',index:items().indexOf(p),record:{id:p.id,exhibitId:definition.id,lon:p.lon,lat:p.lat,title:p.name,kicker:p.stationId?`76 / PSMSL ${p.stationId} · 沿岸の相対海面`:'76 / NOAA · 衛星の海域平均',preview:`${year}年 · ${Number.isFinite(row?.value)?`${row.value>0?'+':''}${format(row.value)} mm / 1993年比`:tideReason(row)}`,url:p.stationId?tideSource(p.stationId):definition.source}};
  }
  if(isWater()){
    if(canvas.dataset.climateArrival!=='complete')return null;
    const hit=waterView.pick(clientX,clientY,projection(),data.regions),p=hit?.region||(hit?.cell?waterCellRegion(waterGrid,hit.cell):null);if(!p)return null;
    return {type:'exhibit',index:Math.max(0,items().findIndex(r=>r.id===p.id)),record:{id:p.id,exhibitId:'waterstore',lon:p.lon,lat:p.lat,title:p.name,kicker:hit.cell?'75 / 配布0.5° · 推定約3°':'75 / 広域平均',preview:`${year}年 ${format(atlasRow(p,year)?.value)} cm`,url:definition.source}};
  }
  if(isLake()&&lakeDetail&&projection().scale>30){
    const sample=lakeView.pick(clientX,clientY);if(!sample)return null;
    return {type:'exhibit',index:items().indexOf(selected()),record:{id:selectedId,exhibitId:'lakes',lon:sample.lon,lat:sample.lat,title:selected().name,lakeSample:sample,
      kicker:'74 / 表示セルの年次分類',preview:`${sample.year}年 ${sample.label}`,url:definition.source}};
  }
  const {rect}=projection(), x=clientX-rect.left,y=clientY-rect.top; let best=null, distance=pointerType==='touch'?22:12;
  if(isAtlas())best=atlasView.pick(context,clientX,clientY);
  else {
    // The camera can settle between 24 Hz paint ticks. Lake locations are real
    // coordinates, so pick against the current camera, not the preceding frame.
    const view=projection(),points=(isLake()||isCoral())&&canvas.dataset.climateArrival==='complete'
      ? data.regions.map(p=>({id:p.id,lon:p.lon,lat:p.lat,x:view.x+earthLongitudeToMapX(p.lon)*view.scale,y:view.y+(90-p.lat)*view.scale})) : hitPoints;
    for (const p of points) { const d=Math.hypot(p.x-x,p.y-y); if(d<distance){best=p;distance=d;} }
  }
  if(!best)return null;
  const item=items().find(p=>p.id===best.id),title=best.event?.name||(isRegion()?item.name:stormLabel(item));
  const lakeRow=isLake()?item.years.find(r=>r.year===year):null;
  if(isCountryComparison()){
    const d=displayDefinition(),row=atlasRow(displayData().regions.find(r=>r.id===item.id),year);
    return {type:'exhibit',index:items().indexOf(item),record:{id:item.id,exhibitId:definition.id,lon:best.lon,lat:best.lat,title,kicker:`${d.number} / ${d.metric}`,preview:`${year}年 / ${format(row?.value)} ${d.unit}`,url:definition.source}};
  }
  if(isAtlas())return {type:'exhibit',index:items().indexOf(item),record:{id:item.id,exhibitId:definition.id,lon:best.lon,lat:best.lat,title,
    kicker:`${definition.number} / ${definition.metric}`,preview:best.event?`${year}/${best.event.month??'—'}/${best.event.day??'—'} · ${definition.id==='volcanoes'?'VEI':'沿岸最大観測高'} ${format(best.event.magnitude)}${definition.id==='tsunamis'?' m':''}`:definition.century?centuryValue(definition,atlasRow(item,year,month),format):`${year}年${definition.monthly?`${month}月`:''} / ${format(atlasRow(item,year,month)?.value)} ${definition.unit}`,url:definition.source}};
  return {type:'exhibit',index:items().indexOf(item),record:{id:item.id,exhibitId:definition.id,lon:best.lon,lat:best.lat,title,
    kicker:`${definition.number} / ${isLake()?'EC JRC/Google':'NOAA'}`,preview:`${year} / ${isLake()?(lakeRow?.coverage>0?format(lakeRow.water)+' km²':'欠測'):isCoral()?format(item.years.find(r=>r.year===year)?.max)+' ℃・週':format(windMS(stormPeak(item)))+' m/s'}`,url:definition.source}};
}
function deactivate() {
  if(!active)return;active=false;generation++;playing=false;dataState='idle';cancelAnimationFrame(frame);frame=0;hitPoints=[];
  regionalPanel?.closeRegionalAnalysis();
  lakeView?.clear();
  lakeArrival=null;lakeDetail=false;lakeAutoDetail=false;
  atlasArrival=null;atlasView.reset();atlasFade.reset();
  waterView.reset();waterGrid=null;waterSelection=null;waterEntryFocus=false;
  seaView.reset();tideData=null;
  coralView.reset();coralArrival=null;
  electricityComparison=null;electricityMode='access';electricityEntryFocus=false;
  drinkingComparison=null;drinkingMode='gap';drinkingEntryFocus=false;
  sanitationServices=null;sanitationMode='safe';sanitationEntryFocus=false;
  forestMode='change';forestEntryFocus=false;
  stressEntryFocus=false;croplandMode='change';croplandEntryFocus=false;yieldEntryFocus=false;fertilizerEntryFocus=false;longevityEntryFocus=urbanEntryFocus=false;longevityComparisonId='USA';
  layer.classList.remove('is-climate-history-exhibit','is-lake-detail');delete layer.dataset.climateExhibit;
  canvas.hidden=readout.hidden=legend.hidden=true;buttons.get(definition.id)?.setAttribute('aria-current','false');emit('change');
  setBusy(false);
}
async function select(id) {
  const target=CLIMATE_EXHIBITS.find(d=>d.id===id);if(!target)return;
  electricityComparison=null;electricityMode='access';electricityEntryFocus=false;
  drinkingComparison=null;drinkingMode='gap';drinkingEntryFocus=false;
  sanitationServices=null;sanitationMode='safe';sanitationEntryFocus=false;
  forestMode='change';forestEntryFocus=false;
  stressEntryFocus=false;croplandMode='change';croplandEntryFocus=false;yieldEntryFocus=false;fertilizerEntryFocus=false;longevityEntryFocus=urbanEntryFocus=false;longevityComparisonId='USA';
  regionalPanel?.closeRegionalAnalysis();
  lakeView?.clear();
  layer.classList.remove('is-lake-detail');lakeLocatorKey=lakePanelKey='';
  lakeArrival=null;lakeDetail=false;lakeAutoDetail=false;
  atlasArrival=null;atlasView.reset();atlasFade.reset();
  waterView.reset();waterGrid=null;waterSelection=null;waterEntryFocus=false;
  seaView.reset();tideData=null;
  coralView.reset();coralArrival=null;
  for(const provider of [globalThis.GaiaLiveExhibits,globalThis.GaiaEstatExhibits,globalThis.GaiaFirmsExhibit,globalThis.GaiaPlanetSignals,globalThis.GaiaMarineCod,globalThis.GaiaFoodExhibits])provider?.deactivate?.();
  const ticket=++generation;definition=target;active=true;dataState='loading';data=null;season=null;year=2016;month=definition.defaultMonth||9;basin='ALL';selectedId='';playing=false;
  geometryKey='';hitPoints=[];layer.classList.add('is-climate-history-exhibit');layer.dataset.climateExhibit=id;
  canvas.dataset.climateArrival='waiting';canvas.dataset.climateRenderedYear='';canvas.dataset.yearFade='complete';canvas.dataset.atlasEngine='idle';
  globalThis.GaiaMapObservationAdapter?.closePoi?.();canvas.hidden=readout.hidden=false;legend.hidden=true;context.clearRect(0,0,canvas.width,canvas.height);
  for(const b of globalThis.GaiaMapCategories.buttons())b.setAttribute('aria-current',String(b===buttons.get(id)));
  for(const selector of ['#japan-mode-title','#japan-title'])document.querySelector(selector).textContent=target.shortTitle;
  document.querySelector('#japan-mode-number').textContent=target.number;
  const title=document.querySelector('#japan-title');title.dataset.exhibitNumber=target.number;title.setAttribute('aria-label',`${target.number} ${target.shortTitle}`);
  q('[data-climate-number]').textContent=target.number;q('[data-climate-title]').textContent=target.shortTitle;
  q('[data-climate-category]').textContent=definition.category||(isRegion()?'世界 · 水と森':'世界 · 空と天気');
  q('.gaia-climate-scale').style.background=isAtlas()?`linear-gradient(90deg,${definition.colors.join(',')})`:'';
  q('.gaia-climate-scale').hidden=!!definition.qualitativeLegend;
  q('[data-climate-guide]').closest('details').open=false;
  q('[data-lake-panel]').hidden=!isLake();
  q('[data-water-panel]').hidden=!isWater();
  q('[data-sea-panel]').hidden=!isSea();
  q('[data-coral-panel]').hidden=!isCoral();
  electricityPanel.panel.hidden=!isElectricity();
  drinkingPanel.panel.hidden=!isDrinking();
  sanitationPanel.panel.hidden=!isSanitation();
  forestPanel.panel.hidden=!isForest();
  stressPanel.panel.hidden=!isStress();
  croplandPanel.panel.hidden=!isCropland();
  yieldPanel.panel.hidden=!isYield();
  fertilizerPanel.panel.hidden=!isFertilizer();
  urbanPanel.panel.hidden=!isUrban();
  longevityPanel.panel.hidden=!isLongevity();
  q('[data-climate-point]').setAttribute('aria-label',isUrban()?'都市人口の割合を調べる国・地域':isLongevity()?'出生時平均余命を調べる国・地域':isFertilizer()?'肥料消費量を比較する国・地域':isYield()?'穀物の収量を比較する国・地域':isCropland()?'耕地の変化を比較する国・地域':isStress()?'水への負荷を比較する国・地域':isForest()?'森林の変化を比較する国・地域':isSanitation()?'衛生サービスを比較する国・地域':isDrinking()?'飲料水を比較する国・地域':isElectricity()?'電力アクセスを比較する国・地域':isSea()?'検潮所・衛星の海域平均を選択':isWater()?'比較する地域・選択した陸域':'監視海域・台風を選択');
  q('[data-climate-controls]').disabled=q('[data-climate-analysis]').disabled=true;
  setBusy(true);
  q('[data-climate-basin-label]').hidden=isRegion()&&!definition.monthly;
  q('[data-climate-basin-caption]').textContent=definition.monthly?'月':'海域';
  q('[data-climate-basin]').setAttribute('aria-label',definition.monthly?'比較する月':'台風の海域');
  q('[data-climate-basin]').replaceChildren(...(definition.monthly?Array.from({length:12},(_,m)=>new Option(`${m+1}月`,String(m+1))):Object.entries(BASINS).map(([id,label])=>new Option(label,id))));
  q('[data-climate-basin]').value=definition.monthly?String(month):'ALL';q('[data-climate-point]').replaceChildren();
  q('[data-climate-regional]').hidden=isRegion();
  q('[data-climate-overview]').textContent=isAtlas()&&innerWidth<=900?'選択へ戻る':'全体を見る';
  q('[data-climate-value]').textContent='—';q('[data-climate-detail]').textContent='';q('[data-climate-retry]').hidden=true;
  q('[data-climate-status]').textContent='NOAA保存データを読込中…';
  q('[data-climate-key-title]').textContent=isCoral()?'年内最大DHW（℃・週）':'1分平均風速（m/s）';
  q('[data-climate-labels]').replaceChildren(...(isCoral()?['0','2','4','8','16+']:['0','17','33','50','65+']).map(label=>{const span=document.createElement('span');span.textContent=label;return span;}));
  q('[data-climate-guide]').textContent=isCoral()
    ? '衛星による水温観測から、監視海域の高温域（HotSpotの90パーセンタイル）を取り出し、直近84日間の熱ストレスをDHWとして積算。点は監視海域の代表位置。色と描画上の大きさは年内最大DHW（大きさは16で上限）、円弧は一年のうちDHWが8以上だった日数。海全体の色面は点の色を滑らかにつないだ演出、流線は海の循環をイメージした動きです。観測値は点を選んで確認できます。4・8℃・週はNOAAが白化リスクの目安に用いる水準です。灰色の輪は欠測。'
    : 'NOAA IBTrACS v4r01の主要経路（MAIN）を表示。線の色はUSA_WIND（1分平均風速）をm/sに換算し、灰色は風速欠測。輪は選択経路の最大風速地点です。位置記録には補間時刻を含みます。南半球のシーズンは暦年をまたぎます。海域は各経路の最初の記録で分類し、別経路（spur）は除外しています。';
  if (isLake()) {
    q('[data-climate-key-title]').textContent='水域の記録';
    q('[data-climate-labels]').replaceChildren(...['● 通年','● 季節的','● 観測なし'].map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
    q('[data-climate-status]').textContent='JRC保存データを読込中…';
    q('[data-climate-guide]').textContent='Landsatの年次水域分類（GSW v1.0、1984–2015年）を、3湖周辺の固定矩形範囲で集計しています。通年と季節的な水域の合計です。原画素のWGS84楕円体面積を足し、図だけを縮小。湖周辺の別の水域も含みます。観測カバー率は通期に一度でも水域と分類された範囲が分母。2000年比は両年で観測できた画素だけで計算し、共通カバー率95%以上で表示します。年次分類は一年の観測をまとめた記録で、単日の湖岸線や年平均面積とは区別します。欠測は補間せず、分類・観測時期・湖岸の画素誤差を含みます。新版の位置補正を混在させず、2015年までの原版に限定しています。';
  }
  if(isAtlas()){
    q('[data-climate-key-title]').textContent=isWater()?'陸水量偏差 · 2004–09年比':definition.legendMetric||(definition.view==='countries'?`${definition.metric} · 灰色は欠測`:definition.metric);
    q('[data-climate-labels]').replaceChildren(...definition.labels.map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
    q('[data-climate-guide]').textContent=definition.guide;q('[data-climate-status]').textContent='保存データを読込中…';
  }
  emit('change');
  try { const [payload,grid,tides,comparison,drinking,sanitation]=await Promise.all([load(id),isWater()?load('waterstore-grid'):null,isSea()?load('sealevel-stations'):null,isElectricity()?load('electricity-comparison'):null,isDrinking()?load('drinking-comparison'):null,isSanitation()?load('sanitation-services'):null]);if(!active||generation!==ticket)return;
    if(isElectricity()&&payload.sourceUpdated!==comparison.sourceUpdated)throw Error('Electricity comparison snapshot mismatch');
    if(isDrinking()&&payload.sourceUpdated!==drinking.sourceUpdated)throw Error('Drinking comparison snapshot mismatch');
    if(isSanitation()&&!sanitationVersionMatches(payload,sanitation))throw Error('Sanitation snapshot mismatch');
    data=payload;waterGrid=grid;tideData=tides;electricityComparison=comparison;drinkingComparison=drinking;sanitationServices=sanitation;
    const list=years(),slider=q('[data-climate-year]');slider.min=String(list[0]);slider.max=String(list.at(-1));slider.step='1';slider.value='2016';
    await setYear(isLake()?2010:2016);if(!active||definition.id!==id)return;
    if(isLake()){focusPoint(selected());lakeAutoDetail=true;}else if(isWater()&&innerWidth<=900){selectedId='india';sync();waterEntryFocus=true;}else if(isUrban()){urbanEntryFocus=true;}else if(isLongevity()){longevityEntryFocus=true;}else if(isFertilizer()){fertilizerEntryFocus=true;}else if(isYield()){yieldEntryFocus=true;}else if(isCropland()){croplandEntryFocus=true;}else if(isStress()){stressEntryFocus=true;}else if(isForest()){forestEntryFocus=true;}else if(isSanitation()){sanitationEntryFocus=true;}else if(isDrinking()){drinkingEntryFocus=true;}else if(isElectricity()){electricityEntryFocus=true;}else if(isCoral()&&innerWidth<=900){focusPoint(selected());}else focusAll();resume();
  } catch(error){if(active&&generation===ticket)fail(error);}
}
const statisticsDataset=()=>active&&dataState==='ready'?(isCropland()?croplandStatistics(definition,data,selected(),croplandMode):isForest()?forestStatistics(definition,data,selected(),forestMode):isSanitation()?sanitationStatistics(definition,data,sanitationServices,selected(),sanitationMode):isDrinking()?drinkingStatistics(definition,data,drinkingComparison,selected(),drinkingMode):isElectricity()?electricityStatistics(definition,data,selected(),electricityMode):isSea()&&selected()?.stationId?tideStatistics(tideData,selected()):isWater()&&waterSelection?waterCellStatistics(definition,waterGrid,waterSelection):isAtlas()?atlasStatistics(definition,data,selected(),month):isLake()?lakeStatistics(selected()):statisticsFor({kind:definition.id,data,region:selected(),basin})):null;
async function restoreStatisticsDataset(id) {
  const match=/^climate-([a-z]+)-([a-zA-Z0-9_-]+)$/.exec(id);if(!match||!CLIMATE_EXHIBITS.some(d=>d.id===match[1]))return null;
  const [,kind,key]=match,payload=await load(kind),d=atlasDefinition(kind),period=d?.monthly?/^(.*)-m(\d{2})$/.exec(key):null;
  if(kind==='waterstore'&&key.startsWith('cell-')){const grid=await load('waterstore-grid'),cell=waterCellById(grid,key);return cell?waterCellStatistics(d,grid,cell):null;}
  if(kind==='sealevel'&&key.startsWith('tide-')){const tides=await load('sealevel-stations');return tideStatistics(tides,tides.regions.find(r=>r.id===key));}
  if(kind==='electricity'&&key.endsWith('-change'))return electricityStatistics(d,payload,payload.regions.find(r=>r.id===key.slice(0,-7)),'change');
  if(kind==='cropland'&&key.endsWith('-change'))return croplandStatistics(d,payload,payload.regions.find(r=>r.id===key.slice(0,-7)),'change');
  if(kind==='foresthistory'&&key.endsWith('-change'))return forestStatistics(d,payload,payload.regions.find(r=>r.id===key.slice(0,-7)),'change');
  if(kind==='sanitation'){const match=/^([A-Z]{3})-(basic|limited|open)$/.exec(key);if(match){const services=await load('sanitation-services');return sanitationVersionMatches(payload,services)?sanitationStatistics(d,payload,services,payload.regions.find(r=>r.id===match[1]),match[2]):null;}}
  if(kind==='drinking'&&key.endsWith('-gap'))return drinkingStatistics(d,payload,await load('drinking-comparison'),payload.regions.find(r=>r.id===key.slice(0,-4)),'gap');
  if(d?.monthly&&(!period||+period[2]<1||+period[2]>12))return null;
  const region=payload.regions?.find(r=>r.id===(period?period[1]:key));
  if(kind!=='cyclones'?!region:!Object.hasOwn(BASINS,key))return null;
  return d?atlasStatistics(d,payload,region,period?+period[2]:undefined):kind==='lakes'?lakeStatistics(region):statisticsFor({kind,data:payload,region,basin:key});
}
function mount() {
  if(readout)return;layer=document.querySelector('#japan-layer');map=document.querySelector('#japan-map');if(!map)return;
  canvas=document.createElement('canvas');canvas.id='gaia-climate-canvas';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');map.append(canvas);context=canvas.getContext('2d');buffer=document.createElement('canvas');bufferContext=buffer.getContext('2d');
  readout=document.createElement('section');readout.className='gaia-climate-readout';readout.hidden=true;readout.setAttribute('aria-label','気候記録の海域・対象・年');
  readout.innerHTML=`<div class="gaia-climate-chapter"><p data-climate-category></p><button type="button" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover"><b data-climate-number></b><strong data-climate-title></strong></button></div>
    <p class="gaia-climate-status" data-climate-status role="status"></p><button type="button" data-climate-retry hidden>再試行</button>
    <fieldset data-climate-controls disabled><legend class="gaia-climate-sr">観測記録を選ぶ</legend><div class="gaia-climate-pickers"><label data-climate-basin-label><span data-climate-basin-caption>海域</span><select data-climate-basin aria-label="台風の海域"></select></label><label>記録<select data-climate-point aria-label="監視海域・台風を選択"></select></label></div>
    <div class="gaia-climate-primary"><span data-climate-metric></span><strong data-climate-value>—</strong><small data-climate-detail></small></div>
    <div class="gaia-climate-timeline"><label><b data-climate-period></b><input type="range" data-climate-year min="1980" max="2024" value="2016" step="1" aria-label="気候記録の年" /></label><button type="button" data-climate-overview>全体を見る</button><button type="button" data-climate-regional aria-haspopup="dialog">地域別の接近を分析</button></div></fieldset>
    <div class="gaia-climate-actions"><button type="button" data-climate-source></button><button type="button" data-climate-analysis disabled></button></div>`;
  legend=document.createElement('section');legend.className='gaia-climate-legend';legend.hidden=true;
  legend.innerHTML=`<div class="gaia-climate-key"><h3 data-climate-key-title></h3><div class="gaia-climate-scale"></div><p data-climate-labels></p></div><div class="gaia-climate-insight"><h3 data-climate-selected></h3><p data-climate-insight></p></div><details><summary>指標と出典の読み方</summary><p class="gaia-climate-guide" data-climate-guide></p></details>`;
  const lakePanel=document.createElement('div');lakePanel.dataset.lakePanel='';lakePanel.hidden=true;
  lakePanel.innerHTML='<header><h3 data-lake-name></h3><small data-lake-country></small></header><canvas data-lake-locator width="240" height="110" role="img"></canvas><button type="button" data-lake-compare aria-pressed="true">2000年の水域を重ねる</button><p data-lake-change></p><p data-lake-sample role="status"></p><small data-lake-coordinates></small>';
  legend.prepend(lakePanel);layer.append(readout,legend);lakeView=createLakeView(map,syncLakePanel);decorateMapActions(q('.gaia-climate-actions'),q('[data-climate-source]'),q('[data-climate-analysis]'));
  const waterPanel=document.createElement('div');waterPanel.dataset.waterPanel='';waterPanel.hidden=true;
  waterPanel.innerHTML='<h3 data-water-title></h3><small data-water-place></small><div class="water-reading"><strong data-water-value></strong><span data-water-period></span></div><canvas data-water-chart width="480" height="144" role="img"></canvas><div class="water-chart-years"><span>2003</span><span>2024</span></div><p class="water-instruction">陸地をタップして、同じ場所の変化を追う</p><small class="water-scale-note">配布格子 0.5° · 推定の広さ 約3°</small>';
  legend.prepend(waterPanel);
  const seaPanel=document.createElement('div');seaPanel.dataset.seaPanel='';seaPanel.hidden=true;
  seaPanel.innerHTML='<small class="sea-eyebrow">COASTAL RECORDS / 沿岸の記録</small><h3 data-sea-name></h3><small data-sea-place></small><div class="sea-reading"><strong data-sea-value></strong><span data-sea-year></span></div><canvas data-sea-chart width="600" height="200" role="img"></canvas><p data-sea-note></p><p class="sea-instruction">沿岸の点を選び、同じ港の変化をたどる</p><a data-sea-link target="_blank" rel="noopener noreferrer">観測所の記録と注記 ↗</a>';
  legend.prepend(seaPanel);
  const coralPanel=document.createElement('div');coralPanel.dataset.coralPanel='';coralPanel.hidden=true;
  coralPanel.innerHTML='<h3 data-coral-name></h3><small data-coral-period></small><div class="coral-duration"><span>DHW ≥ 4</span><div><i data-coral-bar="4"></i></div><b data-coral-days="4"></b></div><div class="coral-duration"><span>DHW ≥ 8</span><div><i data-coral-bar="8"></i></div><b data-coral-days="8"></b></div><small data-coral-coverage></small>';
  legend.prepend(coralPanel);
  sanitationPanel=createSanitationPanel(legend,{setMode:setSanitationMode,setYear:y=>{stopForInteraction();void setYear(y);}});
  forestPanel=createForestPanel(legend,{setMode:setForestMode,setYear:y=>{stopForInteraction();void setYear(y);},selectCountry:id=>{stopForInteraction();selectPoint(id);}});
  urbanPanel=createUrbanPanel(legend,{setYear:y=>{stopForInteraction();void setYear(y);}});
  longevityPanel=createLongevityPanel(legend,{setYear:y=>{stopForInteraction();void setYear(y);},setComparison:id=>{
    if(!isLongevity()||dataState!=='ready'||id===selectedId||!items().some(r=>r.id===id))return;
    stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
    longevityComparisonId=id;sync();resume();
  }});
  fertilizerPanel=createFertilizerPanel(legend,{setYear:y=>{stopForInteraction();void setYear(y);},selectCountry:id=>{stopForInteraction();selectPoint(id);}});
  yieldPanel=createYieldPanel(legend,{setYear:y=>{stopForInteraction();void setYear(y);},selectCountry:id=>{stopForInteraction();selectPoint(id);}});
  croplandPanel=createCroplandPanel(legend,{setMode:setCroplandMode,setYear:y=>{stopForInteraction();void setYear(y);},selectCountry:id=>{stopForInteraction();selectPoint(id);}});
  stressPanel=createWaterStressPanel(legend,{setYear:y=>{stopForInteraction();void setYear(y);},selectCountry:id=>{stopForInteraction();selectPoint(id);}});
  electricityPanel=createElectricityPanel(legend,{setMode:setElectricityMode,setYear:y=>{stopForInteraction();void setYear(y);},selectCountry:id=>{stopForInteraction();selectPoint(id);}});
  drinkingPanel=createDrinkingPanel(legend,{setMode:setDrinkingMode,setYear:y=>{stopForInteraction();void setYear(y);},selectCountry:id=>{stopForInteraction();selectPoint(id);}});
  q('[data-lake-compare]').addEventListener('click',()=>{stopForInteraction();lakeView.setCompare(!lakeView.getState().compare);});
  const layoutObserver=new ResizeObserver(()=>{geometryKey='';});layoutObserver.observe(readout);layoutObserver.observe(legend);
  // Moving the legend changes label clearance without resizing the canvas.
  new MutationObserver(()=>{if(active&&(isElectricity()||isDrinking()||isSanitation()||isForest()||isStress()||isCropland()||isYield()||isFertilizer()||isLongevity()||isUrban()))geometryKey='';}).observe(legend,{attributes:true,attributeFilter:['style']});
  const refitLake=()=>requestAnimationFrame(()=>{if(active&&isLake()&&lakeDetail&&selected())openLakeDetail({durationMs:1400});});
  // The compact drawer is mounted lazily after this module on direct links.
  document.addEventListener('toggle',event=>{if(event.target.id==='map-responsive-data'){if(active&&(isElectricity()||isDrinking()||isSanitation()||isForest()||isStress()||isCropland()||isYield()||isFertilizer()||isLongevity()||isUrban()))geometryKey='';if(!event.target.open)refitLake();}},true);
  addEventListener('resize',refitLake);
  q('[data-climate-basin]').replaceChildren(...Object.entries(BASINS).map(([id,label])=>new Option(label,id)));
  for(const d of CLIMATE_EXHIBITS){const b=document.createElement('button');b.type='button';b.className='map-mode-button';b.textContent=d.number;b.dataset.climateExhibit=d.id;b.dataset.mapPreviewSurface='map';b.setAttribute('aria-current','false');b.setAttribute('aria-label',`${d.number} ${d.shortTitle}`);b.setAttribute('aria-describedby','map-mode-preview');b.addEventListener('click',()=>void select(d.id));layer.querySelector('.map-mode-list').append(b);buttons.set(d.id,b);}
  layer.querySelector('.map-mode-bank').addEventListener('click',event=>{const b=event.target.closest?.('.map-mode-button');if(b&&!b.dataset.climateExhibit)deactivate();},{capture:true});
  for(const node of [readout,legend])for(const type of ['pointerdown','wheel','keydown','keyup'])node.addEventListener(type,event=>event.stopPropagation());
  q('[data-climate-year]').addEventListener('input',event=>{if(event.isTrusted)stopForInteraction();void setYear(Number(event.target.value));});
  q('[data-climate-basin]').addEventListener('change',event=>{
    stopForInteraction();
    if(definition.monthly){if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);month=Number(event.target.value);}
    else basin=event.target.value;
    fillPoints();sync();
  });
  q('[data-climate-point]').addEventListener('change',event=>{stopForInteraction();selectPoint(event.target.value);});
  q('[data-climate-overview]').addEventListener('click',()=>{stopForInteraction();if(isLake()&&!lakeDetail)openLakeDetail();else focusAll();});
  q('[data-climate-regional]').addEventListener('click',async event=>{
    stopForInteraction();const button=event.currentTarget,ticket=generation;button.disabled=true;
    try {
      regionalPanel=await import('./cyclone-regional-panel.js?v=whole-trends20-20261025');
      if(active&&!isRegion()&&generation===ticket)regionalPanel.openRegionalAnalysis({year,trigger:button});
      button.textContent='地域別の接近を分析';
    } catch { button.textContent='地域別分析を再試行'; }
    finally { button.disabled=false; }
  });
  q('[data-climate-retry]').addEventListener('click',()=>{if(isAtlas()&&canvas.dataset.atlasGeometryState==='error')globalThis.GaiaMapObservationAdapter?.retryCountryGeometry?.();if(data)void setYear(year);else void select(definition.id);});
  q('[data-climate-analysis]').addEventListener('click',()=>{const dataset=statisticsDataset();if(!dataset)return;setPlayback(false);const open=()=>globalThis.GaiaStatisticsLab?.open?.({modeId:dataset.modeId,datasetId:dataset.id,dataset});if(globalThis.GaiaStatisticsLab?.open)open();else addEventListener('gaia:statistics-lab-ready',open,{once:true});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();});
  addEventListener('gaia:japan-close',()=>{cancelAnimationFrame(frame);frame=0;playing=false;lakeView.setVisible(false);regionalPanel?.closeRegionalAnalysis();});addEventListener('gaia:japan-open',resume);
  // Direct selections by other providers also relinquish this canvas.
  for(const name of ['live-exhibit','estat-exhibit','firms-exhibit','planet-signals','marine-cod','food'])addEventListener(`gaia:${name}-change`,event=>{if(event.detail?.active && active)deactivate();});
  reduced.addEventListener('change',()=>{geometryKey='';});emit('mounted');
  addEventListener('gaia:atlas-renderer-change',()=>{geometryKey='';resume();});
  addEventListener('gaia:coral-renderer-change',()=>{geometryKey='';resume();});
  addEventListener('gaia:sea-renderer-change',()=>{geometryKey='';resume();});
}
globalThis.GaiaClimateHistory=Object.freeze({definitions:CLIMATE_EXHIBITS,select,deactivate,setYear,selectPoint,findPoiAt,focusAll,setPlayback,
  getState:()=>({active,id:definition.id,year,month:definition.monthly?month:null,basin,selectedId,playing,dataState}),getPlaybackState:()=>({ready:active&&dataState==='ready',supported:true,playing:active&&playing,detail:'データ年を順番に表示します。'}),
  getStatisticsDataset:statisticsDataset,restoreStatisticsDataset,getRenderState:()=>isCoral()?coralView.getState():isSea()?seaView.getState():isWater()?waterView.getState():atlasView.getState(),getCruisePoints:()=>items(),selectCruisePoi:index=>{const p=items()[index];if(p)selectPoint(p.id);},
  getCoralState:()=>coralView.getState(),
  getElectricityState:()=>({mode:electricityMode,comparisonReady:!!electricityComparison}),
  getSanitationState:()=>({mode:sanitationMode,servicesReady:!!sanitationServices}),
  getCroplandState:()=>({mode:croplandMode}),
  getForestState:()=>({mode:forestMode}),
  getDrinkingState:()=>({mode:drinkingMode,comparisonReady:!!drinkingComparison}),
  getLakeState:()=>lakeView?.getState(),
  getWaterState:()=>({...waterView.getState(),cell:waterSelection?{...waterSelection}:null,gridReady:!!waterGrid}),
  getSeaState:()=>({...seaView.getState(),stationsLoaded:tideData?.regions.length||0}),
  getSourceInfo:()=>active?{number:definition.number,shortTitle:definition.shortTitle,datasets:[{id:definition.id,title:definition.signalLabel,organisation:definition.organisation||(isLake()?'Source: EC JRC/Google':isCoral()?'NOAA Coral Reef Watch':'NOAA NCEI / IBTrACS v4r01'),url:definition.source,
    attributionNote:`${isSea()?`${definition.guide} ${data?.method||''}`:q('[data-climate-guide]').textContent} 取得 ${data?.retrievedAt?.slice(0,10)||data?.builtAt||'読込後表示'}。${isCoral()?data?.attribution||'':data?.citation||''} ${data?.license||''}`},...(isSea()&&tideData?[{id:'sealevel-stations',title:'沿岸の相対海面・検潮所の年平均',organisation:'PSMSL / 各国の原観測機関',url:selected()?.stationId?tideSource(selected().stationId):'https://psmsl.org/data/obtaining/',attributionNote:`${TIDE_GUIDE} ${tideData.method} ${tideData.interpretation} ${tideData.citation}`}]:[]),...(isSanitation()&&sanitationServices?sanitationServices.indicators.map(s=>({id:`sanitation-${s.key}`,title:s.key==='basic'?'基本的な衛生サービス（安全管理を含む）':'野外排泄',organisation:definition.organisation,url:`https://data.worldbank.org/indicator/${s.indicator}`,attributionNote:`${sanitationServices.method} 取得 ${sanitationServices.retrievedAt}。${sanitationServices.license}`})):[]),...(isDrinking()&&drinkingComparison?drinkingComparison.indicators.map(s=>({id:`drinking-${s.key}`,title:`安全管理された飲料水 · ${s.key==='urban'?'都市':'農村'}`,organisation:definition.organisation,url:`https://data.worldbank.org/indicator/${s.indicator}`,attributionNote:`${drinkingComparison.method} 取得 ${drinkingComparison.retrievedAt}。${drinkingComparison.license}`})):[])]}:null});
if(globalThis.GaiaMapObservationAdapter)mount();else addEventListener('gaia:map-adapter-ready',mount,{once:true});
