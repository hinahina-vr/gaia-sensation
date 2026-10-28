import {createLocalAtlas100} from './local-atlas100.js?v=surface-release-2e596f2-20261028';
import {centuryValue} from './atlas-century-model.js?v=release100-c363-20261027';
import {createLocalAtlas95} from './local-atlas95.js?v=surface-release-2e596f2-20261028';
import {centuryDetail} from './atlas-century-model.js?v=release100-c363-20261027';
import {selectableCountryData,selectionCountryId} from './country-selection.js?v=release100-c363-20261027';
import {createLocalAtlas85} from './local-atlas85.js?v=surface-release-2e596f2-20261028';
import {createLocalAtlas90} from './local-atlas90.js?v=surface-release-2e596f2-20261028';
import { earthBaseScale, earthLongitudeToMapX } from "./world-projection.js?v=gaia-japan-center-1";
import { decorateMapActions } from "./map-exhibit-actions.js?v=action-icons-ready-20260926";
import { CLIMATE_EXHIBITS, BASINS, windMS, format, stormPeak, stormLabel, colorFor, coralInsight, cycloneInsight, statisticsFor, daysInYear } from "./climate-history-model.js?v=release100-c363-20261027";
import { atlasDefinition, atlasInsight, atlasStatistics, atlasRow } from "./atlas-history-model.js?v=release100-c363-20261027";
import { createPoiYearCrossfade } from "./poi-year-crossfade.js?v=20260926";
import { lakeInsight, lakeStatistics } from "./surface-water-model.js?v=lakes-20261022";
import { createLakeView } from "./surface-water-view.js?v=sharp-map-text-20261026";
import { lakeFitCamera } from "./surface-water-spatial.js?v=lake-gis-20261022";
import { poiArrival, poiArrivalDuration } from "./annual-poi-arrival.js?v=20260909";
import { decodeWaterGrid, waterCellById, waterCellRegion, waterCellStatistics, waterCoordinates, waterRgba } from "./water-storage-grid.js?v=water-gis-20261022";
import { createWaterStorageView } from "./water-storage-view.js?v=surface-release-2e596f2-20261028";
import { WATER_ARRIVAL_MS } from "./water-storage-poi.js?v=water-poi-20261023";
import { createCoralHeatView, CORAL_ARRIVAL_MS } from "./coral-heat-view.js?v=coral-current-20261023";
import {decodeTides,TIDE_GUIDE,tideReason,tideSource,tideStatistics} from './sea-level-stations.js?v=release100-c363-20261027';
import {createSeaLevelView} from './sea-level-view.js?v=surface-release-2e596f2-20261028';
import {SEA_ARRIVAL_MS} from './sea-level-marks.js?v=release100-c363-20261027';
import {ELECTRICITY_MODES,electricityDefinition,electricityCountryNames,electricityData,electricityStatistics,createElectricityPanel} from './electricity-access.js?v=release100-c363-20261027';
import {createElectricityMapView} from './electricity-map-view.js?v=surface-release-2e596f2-20261028';
import {ELECTRICITY_ARRIVAL_MS} from './electricity-country-marks.js?v=release100-c363-20261027';
import {DRINKING_MODES,DRINKING_DEFAULT_MODE,drinkingIsBasic,drinkingIsGap,drinkingAvailableMode,drinkingDefinition,drinkingRow,drinkingData,drinkingStatistics,createDrinkingPanel} from './drinking-water.js?v=release100-c363-20261027';
import {createDrinkingMapView} from './drinking-map-view.js?v=surface-release-2e596f2-20261028';
import {DRINKING_ARRIVAL_MS} from './drinking-water-reading.js?v=release100-c363-20261027';
import {createForestPanel,forestCountryNames,forestData,forestDefinition,forestStatistics,forestSigned,FOREST_MODES} from './forest-history.js?v=release100-c363-20261027';
import {createSanitationPanel,sanitationData,sanitationDefinition,sanitationStatistics,SANITATION_MODES} from './sanitation-services.js?v=release100-c363-20261027';
import {createCountryHistoryView} from './country-history-view.js?v=surface-release-2e596f2-20261028';
import {createMapTextLayer} from './map-text-layer.js?v=country-text-halo-20261027';
import {climatePlaybackInterval} from './climate-playback-timing.js?v=release100-c363-20261027';
const local85=createLocalAtlas85({setYear:y=>{stopForInteraction();void setYear(y)},selectCountry:id=>{stopForInteraction();selectPoint(id)},refresh:()=>{stopForInteraction();sync();resume()}});
const local90=createLocalAtlas90();
const local95=createLocalAtlas95();
const local100=createLocalAtlas100();
const isLocal100=()=>local100.has(definition.id);
const isLocal95=()=>local95.has(definition.id);
const isLocal90=()=>local90.has(definition.id);
const isLocal85=()=>local85.has(definition.id);
const countryHistoryView=createCountryHistoryView();
const lakeTextLayer=createMapTextLayer('lakes');
let forestPanel,forestMode='change',sanitationPanel,sanitationServices=null,sanitationMode='safe';
const isForest=()=>definition.id==='foresthistory',isSanitation=()=>definition.id==='sanitation';
const drinkingView=createDrinkingMapView({waterMotion:true,selectable:true,sourceId:selectionCountryId});
let drinkingPanel,drinkingComparison=null,drinkingBasic=null,drinkingBasicComparison=null,drinkingMode=DRINKING_DEFAULT_MODE;
const isDrinking=()=>definition.id==='drinking';
const isCountryComparison=()=>isLocal100()||isElectricity()||isDrinking()||isForest()||isSanitation()||isLocal85()||(isLocal90()&&definition.view==='countries');
const electricityView=createElectricityMapView();
let electricityPanel,electricityComparison=null,electricityMode='access',electricityEntryFocus=false;
const isElectricity=()=>definition.id==='electricity';
const displayDefinition=()=>isLocal85()?local85.definition(definition):isForest()?forestDefinition(definition,forestMode):isSanitation()?sanitationDefinition(definition,sanitationMode):isDrinking()?drinkingDefinition(definition,drinkingMode):isElectricity()?electricityDefinition(definition,electricityMode):definition;
const drinkingComparisonFor=(mode=drinkingMode)=>drinkingIsBasic(mode)?drinkingBasicComparison:drinkingComparison;
const selectionData=()=>(isDrinking()||isSanitation())?selectableCountryData(isDrinking()&&drinkingIsBasic(drinkingMode)?drinkingBasic:data):data;
const displayData=()=>isLocal85()?local85.data(definition,data):isForest()?forestData(data,forestMode):isSanitation()?sanitationData(selectionData(),sanitationServices,sanitationMode):isDrinking()?drinkingData(selectionData(),drinkingComparisonFor(),drinkingMode):isElectricity()?electricityData(data,electricityMode):data;
const seaView=createSeaLevelView();
let tideData=null;
const isSea=()=>definition.id==='sealevel';
const cache = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Map(), buttons = /* @__PURE__ */ new Map();
let regionalPanel, lakeView;
const atlasFade = createPoiYearCrossfade();
let atlasArrival = null, atlasViewKey = "", lakeArrival = null, lakeDetail = !1, lakeAutoDetail = !1;
const waterView = createWaterStorageView();
let waterGrid = null, waterSelection = null, waterEntryFocus = !1;
const coralView = createCoralHeatView();
let coralArrival = null, countryEntryLayout = null, ozoneEntryFocus = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let definition = CLIMATE_EXHIBITS[0], active = !1, dataState = "idle", generation = 0, data, season, year = 2016, month = 9, basin = "ALL", selectedId = "", playing = !1, frame = 0, lastStep = 0, lastDraw = 0, layer, map, canvas, context, buffer, bufferContext, readout, legend, geometryKey = "", hitPoints = [];
const q = (selector) => readout.querySelector(selector) || legend.querySelector(selector), isCoral = () => definition.id === "coral", isLake = () => definition.id === "lakes", isWater = () => definition.id === "waterstore", isAtlas = () => !!definition.atlas, isRegion = () => isCoral() || isLake() || isAtlas(), years = () => isRegion() ? [...new Set(data.regions.flatMap((r) => r.years.map((y) => y.year)))].sort((a, b) => a - b) : data.years.map((y) => y.year), storms = () => (season?.storms || []).filter((s) => basin === "ALL" || s.basin === basin), items = () => isSea() ? [...(tideData?.regions || []), ...(data?.regions || [])] : isRegion() ? selectionData()?.regions || [] : storms(), selected = () => isWater() && waterSelection ? waterCellRegion(waterGrid, waterSelection) : items().find((p) => p.id === selectedId);
const selectedRow = () => isCountryComparison() ? atlasRow(displayData()?.regions.find(r=>r.id===selectedId),year) : isAtlas() ? atlasRow(selected(), year, month) : selected()?.years?.find((r) => r.year === year), emit = (type) => dispatchEvent(new CustomEvent(`gaia:climate-${type}`, { detail: { active, id: definition.id, year, dataState } }));
async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const url = ['drinking-basic','drinking-basic-comparison'].includes(file) ? `../../data/atlas-history/${file}.json?v=basic-water-20261026` : file === "sanitation-services" ? "../../data/atlas-history/sanitation-services.json?v=forest-playback-20261026" : file === "drinking-comparison" ? "../../data/atlas-history/drinking-comparison.json?v=forest-playback-20261026" : file === "electricity-comparison" ? "../../data/atlas-history/electricity-comparison.json?v=forest-playback-20261026" : file === "sealevel-stations" ? "../../data/atlas-history/sealevel-stations.json?v=forest-playback-20261026" : file === "waterstore-grid" ? "../../data/atlas-history/waterstore-grid.json?v=water-gis-20261022" : atlasDefinition(file) ? `../../data/atlas-history/${file}.json?v=waterstore-20261025` : file === "lakes" ? "../../data/surface-water/lakes.json?v=20261022" : `../../data/climate-history/${file}.json?v=20261013`;
  return pending.has(file) || pending.set(file, fetch(new URL(url, import.meta.url), { signal: AbortSignal.timeout(3e4) }).then(async (response) => {
    if (!response.ok) throw new Error(`Climate snapshot HTTP ${response.status}`);
    let payload = file === "sealevel-stations" ? decodeTides(await response.json()) : file === "waterstore-grid" ? decodeWaterGrid(await response.json()) : await response.json();
    if (payload.schemaVersion !== 1 || !(payload.regions?.length || payload.years?.length || Array.isArray(payload.storms) && Number.isInteger(payload.year))) throw new Error("Invalid climate snapshot");
    cache.set(file, payload);
    const detailKeys = [...cache.keys()].filter((key) => key.startsWith("cyclones/"));
    for (; detailKeys.length > 3; ) cache.delete(detailKeys.shift());
    return payload;
  }).finally(() => pending.delete(file))), pending.get(file);
}
const setPlayback = (value) => {
  playing = !!value && active && dataState === "ready", lastStep = performance.now();
}, stopForInteraction = () => {
  setPlayback(!1), globalThis.GaiaMapPlayback?.stop("interaction");
}, setBusy = (value) => {
  readout.setAttribute("aria-busy", String(value)), legend.setAttribute("aria-busy", String(value));
}, focusAll = () => {
  if(['seaice','snowcover','ozone','glaciers'].includes(definition?.id)){focusPoint(selected());return;}
  if (isLake() && (lakeDetail = !1, lakeAutoDetail = !1, layer.classList.remove("is-lake-detail"), lakeView.setDetail(!1), geometryKey = "", q("[data-climate-overview]").textContent = "湖に戻る"), isAtlas() && innerWidth <= 900 && !isWater()) {
    focusPoint(selected());
    return;
  }
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: 150, lat: 8, zoom: 1, targetX: 0.5, targetY: 0.46, durationMs: isLake() ? 4200 : 450, easing: isLake() ? "lake-flight" : "smoothstep", label: "climate-world" });
};
function openLakeDetail({ durationMs = 4200 } = {}) {
  lakeDetail = !0, lakeAutoDetail = !1, layer.classList.add("is-lake-detail"), lakeView.setDetail(!0), geometryKey = "", hitPoints = [], q("[data-climate-overview]").textContent = "3湖の位置";
  const rect = map.getBoundingClientRect(), compact = innerWidth <= 900, shown = (e) => e?.checkVisibility({ visibilityProperty: !0 }), bottom = Math.min(rect.bottom - 30, ...[readout, document.querySelector("#map-responsive-data"), document.querySelector("#map-mobile-bottom")].filter(shown).map((e) => e.getBoundingClientRect().top - (compact ? 34 : 42))) - rect.top, top = (compact ? legend.getBoundingClientRect().bottom : parseFloat(getComputedStyle(layer).getPropertyValue("--responsive-legend-top")) || 150) - rect.top + (compact ? 18 : 28), left = compact ? 28 : 90, right = compact ? rect.width - 28 : Math.min(rect.width - 70, legend.getBoundingClientRect().left - rect.left - 45), area = { x: left, y: top, width: Math.max(100, right - left), height: Math.max(100, bottom - top) };
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ ...lakeFitCamera(selected().bounds, rect, area), durationMs: reduced.matches ? 0 : durationMs, easing: "lake-flight", label: "lake-geographic-window" });
}
let lakeLocatorKey = "", lakePanelKey = "";
function syncLakePanel() {
  if (!isLake() || !selected() || !lakeView) return;
  const point = selected(), row = selectedRow(), state = lakeView.getState(), adapter = globalThis.GaiaMapObservationAdapter, g = adapter?.getCountryGeometry?.(), panelKey = JSON.stringify([point.id, row?.year, state.compare, state.referenceReady, state.sample, g?.state]);
  if (panelKey === lakePanelKey) return;
  lakePanelKey = panelKey, q("[data-lake-name]").textContent = point.name, q("[data-lake-country]").textContent = point.country, q("[data-lake-compare]").setAttribute("aria-pressed", String(state.compare)), q("[data-lake-compare]").disabled = !state.referenceReady, q("[data-lake-change]").textContent = Number.isFinite(row?.changePercent) ? `2000年比 ${row.changePercent > 0 ? "+" : ""}${format(row.changePercent)}% · 共通観測部分` : "共通観測が揃う年を比較";
  const s = state.sample;
  q("[data-lake-panel]").dataset.hasSample = String(!!s), q("[data-lake-sample]").textContent = s ? `${s.year}年 ${s.label} / 2000年 ${s.referenceLabel || "読込中"}` : "水域をタップして、その場所の変化を見る", q("[data-lake-coordinates]").textContent = s ? `表示セル · ${Math.abs(s.lat).toFixed(3)}°${s.lat < 0 ? "S" : "N"} ${Math.abs(s.lon).toFixed(3)}°${s.lon < 0 ? "W" : "E"}` : "年を動かすと、同じ場所で比較できます";
  const key = `${point.id}/${g?.state}`;
  if (key === lakeLocatorKey) return;
  lakeLocatorKey = key;
  const mini = q("[data-lake-locator]"), c = mini.getContext("2d");
  c.clearRect(0, 0, mini.width, mini.height);
  const scale = mini.width / 60, x = mini.width / 2 - (point.lon + 180) * scale, y = mini.height / 2 - (90 - point.lat) * scale;
  c.save(), c.translate(x, y), c.scale(scale, scale), c.fillStyle = "#25434e", c.strokeStyle = "#7ca4ad", c.lineWidth = 0.45 / scale;
  for (const country of g?.countries || []) {
    const path = adapter.getCountryPath(country.iso3);
    path && (c.fill(path, "evenodd"), c.stroke(path));
  }
  c.restore(), c.fillStyle = "#ffdf9b", c.beginPath(), c.arc(mini.width / 2, mini.height / 2, 3, 0, Math.PI * 2), c.fill(), mini.setAttribute("aria-label", `${point.country}、${point.name}の位置`);
}
const focusPoint = (point) => {
  let p = isRegion() ? point : point?.points?.[Math.floor(point.points.length / 2)];
  if(isLocal95()&&definition.view==='events'&&innerWidth<=900){
    const events=data.events.filter(e=>e.year===year&&Number.isFinite(e.lon)&&Number.isFinite(e.lat)&&(point?.id==='ALL'||e.region===point?.id));
    const event=events.reduce((best,e)=>!best||(e.magnitude??-1)>(best.magnitude??-1)?e:best,null);
    if(event){const rect=map.getBoundingClientRect(),top=Math.max(legend.getBoundingClientRect().bottom,document.querySelector('#map-stable-navigation')?.getBoundingClientRect().bottom||0)-rect.top,bottom=readout.getBoundingClientRect().top-rect.top;
      globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:event.lon,lat:event.lat,zoom:1,targetX:.5,targetY:Math.max(.3,Math.min(.7,(top+bottom)/2/rect.height)),durationMs:reduced.matches?0:900,label:'climate-event-record'});return;}
  }
  if(['seaice','snowcover','ozone','glaciers'].includes(definition.id)){
    const compact=innerWidth<=900,ozone=definition.id==='ozone';
    const location=definition.id==='glaciers'?{lon:85,lat:34}:ozone?{lon:0,lat:-65}:p;
    const zoom=definition.id==='glaciers'?1.7:ozone&&!compact?1.6:1.2;
    let targetY=compact?.65:.54;
    if(ozone){
      const rect=map.getBoundingClientRect();
      const controls=[readout,document.querySelector('#map-responsive-data'),document.querySelector('#map-mobile-bottom')].filter(e=>e?.checkVisibility({visibilityProperty:true}));
      const bottom=Math.min(rect.bottom,...controls.map(e=>e.getBoundingClientRect().top));
      // Tuck the south edge behind the dock, keeping Antarctica and its label
      // above the controls without exposing a rectangular edge of the map.
      targetY=(bottom-rect.top+12-25*earthBaseScale(rect)*zoom)/rect.height;
    }
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({...location,zoom,targetX:compact?.5:.42,targetY,durationMs:reduced.matches?0:1100,label:'geographic-climate-region'});return;
  }
  if(isLocal95()&&(definition.view!=='events'||point?.id==='ALL')){globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:150,lat:8,zoom:1,targetX:.5,targetY:.46,durationMs:reduced.matches?0:850,label:'climate-aggregate'});return;}
  if(isCountryComparison()&&p){
    const shape=globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.countries?.find(s=>s.iso3===p.id);
    const compact=innerWidth<=900,rect=map.getBoundingClientRect(),drawer=document.querySelector('#map-responsive-data'),dock=document.querySelector('#map-mobile-bottom'),visible=e=>e?.checkVisibility({visibilityProperty:true});
    const bottom=visible(drawer)?drawer.getBoundingClientRect().bottom-drawer.querySelector(':scope > summary').getBoundingClientRect().height:visible(readout)?readout.getBoundingClientRect().top:rect.bottom;
    const top=legend.getBoundingClientRect().bottom,limit=Math.min(bottom,visible(dock)?dock.getBoundingClientRect().top:rect.bottom);
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({lon:shape?.lon??p.lon,lat:shape?.lat??p.lat,zoom:compact?2.5:2,targetX:compact?.5:.42,targetY:compact?Math.max(.4,Math.min(.75,((top+limit)/2-rect.top)/rect.height)):.5,durationMs:reduced.matches?0:850,label:'electricity-country'});return;
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
  if (isCoral() && p) {
    const compact = innerWidth <= 900, rect = map.getBoundingClientRect(), drawer = document.querySelector("#map-responsive-data"), dock = document.querySelector("#map-mobile-bottom"), visible = (e) => e?.checkVisibility({ visibilityProperty: !0 }), bottom = visible(drawer) ? drawer.getBoundingClientRect().bottom - drawer.querySelector(":scope > summary").getBoundingClientRect().height : visible(readout) ? readout.getBoundingClientRect().top : rect.bottom, top = legend.getBoundingClientRect().bottom, limit = Math.min(bottom, visible(dock) ? dock.getBoundingClientRect().top : rect.bottom);
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: p.lon, lat: p.lat, zoom: compact ? 2 : 2.4, targetX: compact ? 0.5 : 0.43, targetY: compact ? Math.max(0.4, Math.min(0.75, ((top + limit) / 2 - rect.top) / rect.height)) : 0.5, durationMs: reduced.matches ? 0 : 850, label: "coral-monitoring-region" });
    return;
  }
  if (isWater() && p) {
    const compact = innerWidth <= 900, rect = map.getBoundingClientRect(), drawer = document.querySelector("#map-responsive-data"), dock = document.querySelector("#map-mobile-bottom"), visible = (e) => e?.checkVisibility({ visibilityProperty: !0 }), controls = visible(drawer) ? drawer.getBoundingClientRect().bottom - drawer.querySelector(":scope > summary").getBoundingClientRect().height : visible(readout) ? readout.getBoundingClientRect().top : rect.bottom, top = legend.getBoundingClientRect().bottom, bottom = Math.min(controls, visible(dock) ? dock.getBoundingClientRect().top : rect.bottom), targetY = compact ? Math.max(0.4, Math.min(0.8, ((top + bottom) / 2 - rect.top) / rect.height)) : 0.5;
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: p.lon, lat: p.lat, zoom: compact ? 2 : 2.4, targetX: compact ? 0.5 : 0.42, targetY, durationMs: reduced.matches ? 0 : 900, label: "water-storage-region" });
    return;
  }
  p && (!isRegion() || Number.isFinite(p.lon) && Number.isFinite(p.lat)) && globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: isRegion() ? p.lon : p[2], lat: isRegion() ? p.lat : p[1], zoom: innerWidth <= 900 ? 1.25 : 1, targetX: isLake() ? 0.5 : 0.48, targetY: 0.45, durationMs: 500, label: "climate-observation" });
}, countryLayoutReady = (now) => {
  const key = [map, legend, document.querySelector("#map-responsive-data"), document.querySelector("#map-mobile-bottom")].map((e) => {
    const r = e?.getBoundingClientRect();
    return r ? [r.top, r.bottom, r.width, r.height, e.checkVisibility({ visibilityProperty: !0 })].join(",") : "";
  }).join("/");
  return !countryEntryLayout || countryEntryLayout.key !== key ? (countryEntryLayout = { key, since: now }, !1) : now - countryEntryLayout.since >= 100 && !0;
}, sync = () => {
  if(isDrinking())drinkingMode=drinkingAvailableMode(drinkingComparisonFor(),selectedId,year,drinkingMode);
  const coral = isCoral(), point = selected(), row = selectedRow(), peak = stormPeak(point);
  q(".gaia-climate-scale").hidden=false;
  q("[data-climate-point]").value = selectedId, q("[data-climate-year]").value = String(year), q("[data-climate-period]").textContent = `${year}${isRegion() ? "年" : "シーズン"}`, q("[data-climate-metric]").textContent = coral ? "年内最大DHW" : "経路内の最大1分平均風速", q("[data-climate-value]").textContent = coral ? `${format(row?.max)}${row ? " ℃・週" : ""}` : `${format(windMS(peak))}${peak != null ? " m/s" : ""}`, q("[data-climate-detail]").textContent = isLake() || isAtlas() ? "" : coral ? row ? `DHW ≥ 8：${row.days8}日 / 有効 ${row.validDays}/${daysInYear(year)}日` : "この年の記録なし" : point ? `${point.points.length}時刻 / ${new Date(point.points[0][0] * 36e5).toISOString().slice(0, 10)}から` : "この海域の経路なし", q("[data-climate-selected]").textContent = point ? isRegion() ? point.name : stormLabel(point) : "記録なし", q("[data-climate-insight]").textContent = coral ? coralInsight(point, row) : cycloneInsight(storms(), year), q("[data-climate-analysis]").disabled = !point && isRegion(), q("[data-climate-status]").textContent = coral ? `NOAA Coral Reef Watch / ${data.regions.length}監視海域 / 1986–2025年` : `NOAA IBTrACS v4r01 / ${storms().length}主要経路 / 1980–2024シーズン`, isLake() && (q("[data-climate-metric]").textContent = "湖周辺の水面積", q("[data-climate-value]").textContent = row?.coverage > 0 ? `${format(row.water)} km²` : "欠測", q("[data-climate-detail]").textContent = row ? `水域内の観測カバー率 ${format(row.coverage)}%` : "この年の記録なし", q("[data-climate-insight]").textContent = lakeInsight(point, row), q("[data-climate-status]").textContent = "Source: EC JRC/Google · GSW v1.0 · 1984–2015年 · 3湖周辺の固定範囲", point && row && lakeView.show(point, row)), isAtlas() && (q("[data-climate-metric]").textContent = definition.metric, q("[data-climate-value]").textContent = Number.isFinite(row?.value) ? `${format(row.value)} ${definition.unit}` : "欠測", q("[data-climate-detail]").textContent = definition.id === "snowcover" ? "扇の面積 = 各月の積雪面積" : definition.id === "waterstore" ? `有効 ${row?.months || 0}/12か月` : definition.id === "sealevel" ? `${row?.mission || ""} / ${row?.samples || 0}観測` : "国・地域の公表・推計値", q("[data-climate-insight]").textContent = `${atlasInsight(definition, point, year, month)}${definition.visualReading ? ` ${definition.visualReading}` : ""}`, q("[data-climate-status]").textContent = `${definition.organisation} / ${data.period.join("–")}年 / ${data.regions.length}対象範囲`, q("[data-climate-guide]").textContent = `${definition.guide} ${data.method || ""}`, q("[data-climate-analysis]").disabled = !point || !atlasStatistics(definition, data, point, month)?.rows.length), isWater() && syncWaterPanel(), isCoral() && syncCoralPanel(), isSea() && syncSeaPanel(), isElectricity() && syncElectricityPanel(), isDrinking() && syncDrinkingPanel(), isForest() && syncForestPanel(), isSanitation() && syncSanitationPanel(), isLocal100() && syncLocal100(point), isLocal95() && syncLocal95(point), isLocal85() && syncLocal85(point), geometryKey = "", emit("update");  formatPrimaryValue();
};
// Keep full values and units visible inside the existing dock columns.
function formatPrimaryValue(){
  const node=q('[data-climate-value]'),unit=definition.unit;
  if(!node)return;
  node.style.removeProperty('font-size');
  if(!unit)return;
  const suffix=' '+unit,text=node.textContent;
  if(!node.querySelector('.gaia-climate-unit')&&text.endsWith(suffix)){
    const label=document.createElement('span');label.className='gaia-climate-unit';label.textContent=unit;
    node.replaceChildren(document.createTextNode(text.slice(0,-suffix.length)+' '),label);
  }
  if(innerWidth<=900){node.style.removeProperty('font-size');return;}
  node.style.removeProperty('font-size');
  const primary=node.closest('.gaia-climate-primary');if(!primary||!node.checkVisibility())return;
  const style=getComputedStyle(primary),available=primary.getBoundingClientRect().right-parseFloat(style.paddingRight)-node.getBoundingClientRect().left;
  const range=document.createRange();range.selectNodeContents(node);const width=range.getBoundingClientRect().width;
  if(available>0&&width>available)node.style.fontSize=Math.max(16,Math.floor(parseFloat(getComputedStyle(node).fontSize)*(available-2)/width))+'px';
}
function syncLocal100(point){
  q('[data-climate-value]').textContent=centuryValue(definition,selectedRow(),format);
  q('[data-climate-detail]').textContent=centuryDetail(definition,selectedRow(),format);
  q('[data-climate-insight]').textContent=definition.visualReading;
  q('[data-climate-key-title]').textContent=definition.metric;
}
function syncLocal95(point){
  q('[data-climate-detail]').textContent=centuryDetail(definition,selectedRow(),format);
  q('[data-climate-insight]').textContent=definition.visualReading;
  q('[data-climate-key-title]').textContent=definition.legendMetric||definition.metric;
  q('.gaia-climate-scale').hidden=!!definition.qualitativeLegend;
}
function syncCoralPanel() {
  const point = selected(), row = selectedRow();
  q("[data-coral-name]").textContent = point?.name || "監視海域を選択", q("[data-coral-period]").textContent = `${year}年 · 熱ストレスが高かった日数`;
  for (const threshold of [4, 8]) {
    const value = row?.[`days${threshold}`], valid = Number.isFinite(value), bar = q(`[data-coral-days="${threshold}"]`);
    bar.textContent = valid ? `${value}日` : "欠測", q(`[data-coral-bar="${threshold}"]`).style.width = `${valid ? Math.max(0, Math.min(100, value / daysInYear(year) * 100)) : 0}%`;
  }
  q("[data-coral-coverage]").textContent = `有効 ${row?.validDays ?? 0}/${daysInYear(year)}日 · 円弧：DHW ≥ 8 の日数`;
}
function syncWaterPanel() {
  const point = selected(), row = selectedRow();
  q("[data-water-title]").textContent = waterSelection ? "選択した陸域" : point.name, q("[data-water-place]").textContent = waterSelection ? waterCoordinates(waterSelection) : "固定範囲の平均", q("[data-water-value]").textContent = Number.isFinite(row?.value) ? `${row.value > 0 ? "+" : ""}${format(row.value)} cm` : "欠測", q("[data-water-period]").textContent = `${year}年 · 有効 ${row?.months || 0}/12か月`, q("[data-water-chart]").setAttribute("aria-label", `${point.name}、2003年から2024年の陸水量偏差。${year}年 ${Number.isFinite(row?.value) ? format(row.value) + "cm" : "欠測"}。基準は2004–2009年。`);
  const c = q("[data-water-chart]").getContext("2d"), w = c.canvas.width, h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  const max = Math.max(10, ...point.years.filter((r) => Number.isFinite(r.value)).map((r) => Math.abs(r.value))), zero = h / 2;
  c.strokeStyle = "#aac8ce40", c.lineWidth = 1, c.beginPath(), c.moveTo(0, zero), c.lineTo(w, zero), c.stroke();
  for (const [i, r] of point.years.entries()) {
    const x = 5 + i * (w - 10) / 22, bw = (w - 10) / 22 - 3;
    if (Number.isFinite(r.value)) {
      const y = zero - r.value / max * (h / 2 - 8), [red, g, b] = waterRgba(r.value);
      c.fillStyle = `rgb(${red},${g},${b})`, c.globalAlpha = r.year === year ? 1 : 0.65, c.fillRect(x, Math.min(y, zero), bw, Math.max(1, Math.abs(y - zero)));
    } else
      c.strokeStyle = "#8c9da780", c.beginPath(), c.moveTo(x, zero + 4), c.lineTo(x + bw, zero - 4), c.stroke();
    r.year === year && (c.globalAlpha = 1, c.strokeStyle = "#ffdf9b", c.strokeRect(x - 1, 1, bw + 2, h - 2));
  }
  c.globalAlpha = 1, q("[data-climate-metric]").textContent = waterSelection ? "選択セル · 陸水量偏差" : "広域平均 · 陸水量偏差", q("[data-climate-detail]").textContent = `${waterSelection ? "配布0.5° / 推定約3° · " : ""}有効 ${row?.months || 0}/12か月`, q("[data-climate-status]").textContent = "NASA JPL / GRACE・GRACE-FO · 2003–2024年 · 2004–2009年基準";
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
  q('[data-climate-key-title]').textContent='POIと海の色 · 1993年比（mm）';
  q('[data-climate-labels]').replaceChildren(...['−300以下','0','+300以上 mm'].map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('.gaia-climate-scale').style.background='linear-gradient(90deg,#5deeda 0%,#39adbf 30%,#143a52 50%,#297493 60%,#c1b06b 70%,#ffcf89 100%)';
  q('[data-climate-guide]').textContent=`海面はPOIと同じ配色で、沿岸付近は検潮所の値、沖合は3大洋の衛星平均を滑らかにつないでいます。色面の補間は描画に使い、地点の数値と分析には元の観測値を使います。沿岸の相対海面には地盤の動きも含まれます。うねりと反射は海面の質感を表す演出です。 ${TIDE_GUIDE} ${tideData.method} ${definition.guide} ${data.method}`;
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
  q('[data-climate-guide]').textContent=`${definition.guide} ${electricityComparison?.method||''} 国の面を走る光は、アクセス率に応じて明るさと密度を変えた演出です。地図は国全体の値、実線は選択国、破線は世界銀行の地域集計。国名の横の棒はアクセス率（0〜100%）、細い目盛は2000年。変化表示では中央が0、左右の端は−50・＋50ポイントです。`;
  q('[data-climate-analysis]').disabled=!electricityStatistics(definition,data,selected(),electricityMode)?.rows.length;
}

function setDrinkingMode(mode){
  if(!isDrinking()||dataState!=='ready'||!Object.hasOwn(DRINKING_MODES,mode))return;
  mode=drinkingAvailableMode(drinkingComparisonFor(mode),selectedId,year,mode);if(mode===drinkingMode)return;
  stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  drinkingMode=mode;sync();resume();
}

function syncDrinkingPanel(){
  drinkingPanel.sync({data:selectionData(),comparison:drinkingComparisonFor(),region:selected(),year,mode:drinkingMode});
  const d=displayDefinition(),row=selectedRow(),gap=drinkingIsGap(drinkingMode);
  q('[data-climate-metric]').textContent=d.metric;q('[data-climate-value]').textContent='欠測';
  if(Number.isFinite(row?.value)){const unit=document.createElement('span');unit.className='gaia-climate-unit';unit.textContent=gap?' pt':' %';unit.title=d.unit;q('[data-climate-value]').replaceChildren(document.createTextNode(`${gap&&row.value>0?'＋':''}${format(row.value)}`),unit);}
  q('[data-climate-detail]').textContent=gap?'同年の利用率の差（ポイント）':'全国人口に占める利用率';
  q('[data-climate-key-title]').textContent=gap?'都市と農村の差 · ±50 ptで色の上限':'全国の利用率 · 灰色は欠測';
  q('.gaia-climate-scale').style.background=`linear-gradient(90deg,${d.colors.join(',')})`;
  q('[data-climate-labels]').replaceChildren(...d.labels.map(text=>{const s=document.createElement('span');s.textContent=text;return s;}));
  q('[data-climate-guide]').textContent=`${d.guide} ${drinkingComparisonFor().method} 国の面に揺れる光は、水面の屈折をイメージした演出です。差の地図では金色は都市、青緑は農村の利用率が高い国。灰色は比較に必要な値の欠測。グラフは都市が金色、農村が青緑で、縦軸は利用率0–100%。2本の線の間が、その年の差。欠測の区間は線をつなぎません。`;
  q('[data-climate-analysis]').disabled=!drinkingStatistics(definition,selectionData(),drinkingComparisonFor(),selected(),drinkingMode)?.rows.length;
  const count=displayData().regions.filter(region=>Number.isFinite(atlasRow(region,year)?.value)).length;
  q('[data-climate-status]').textContent=`WHO / UNICEF JMP · World Bank WDI / ${year}年 / ${count}か国・地域に公表値`;
}

function drinkingSourceInfo(){
  const d=displayDefinition(),basic=drinkingIsBasic(drinkingMode),gap=drinkingIsGap(drinkingMode),code=basic?'BASW':'SMDW';
  const sources=gap?[[`SH.H2O.${code}.UR.ZS`,'都市'],[`SH.H2O.${code}.RU.ZS`,'農村']]:[[`SH.H2O.${code}.ZS`,'全国']];
  return {number:definition.number,shortTitle:definition.shortTitle,datasets:sources.map(([indicator,label])=>({
    id:indicator,title:`${d.signalLabel} · ${label}`,organisation:d.organisation,url:`https://data.worldbank.org/indicator/${indicator}`,
    attributionNote:`${q('[data-climate-guide]').textContent} 取得 ${selectionData().retrievedAt}。WHO / UNICEF JMP · World Bank WDI / CC BY 4.0`
  }))};
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
  q('[data-climate-guide]').textContent=`${definition.guide} 地図は各国の陸地面積に対する森林面積の割合。増減は同じ国の2000年との差（ポイント）で、灰緑は低下、鮮やかな緑は上昇。±10ポイントで地図色の上限とし、値はそのまま表示。基準年か比較年の欠測は灰色。地図には国名と選択年の値を表示します。年ごとの推移は右の詳細と分析画面で確認できます。グラフは欠測で線を切ります。`;
  q('[data-climate-guide]').textContent+=' 葉陰の揺れは、国別の森林面積率と増減を重ねた演出です。';
  q('[data-climate-analysis]').disabled=!forestStatistics(definition,data,selected(),forestMode)?.rows.length;
}

function setForestMode(mode){
  if(!isForest()||dataState!=='ready'||!FOREST_MODES.includes(mode)||mode===forestMode)return;
  stopForInteraction();if(!reduced.matches&&!canvas.hidden)atlasFade.capture(canvas,atlasViewKey);
  forestMode=mode;sync();resume();
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
  q('[data-climate-guide]').textContent+=' 光の循環は、選んだ衛生サービスの利用率に重ねた演出です。';
  q('[data-climate-analysis]').disabled=!sanitationStatistics(definition,selectionData(),sanitationServices,selected(),sanitationMode)?.rows.length;
}

function syncLocal85(point){
  local85.sync({id:definition.id,region:point,year,data:displayData()});
  const d=displayDefinition(),row=selectedRow();
  q('[data-climate-metric]').textContent=d.metric;
  q('[data-climate-value]').textContent=Number.isFinite(row?.value)?format(row.value)+' '+d.unit:'欠測';
  q('.gaia-climate-scale').style.background='linear-gradient(90deg,'+d.colors.join(',')+')';
  q('[data-climate-labels]').replaceChildren(...d.labels.map(label=>{const span=document.createElement('span');span.textContent=label;return span}));
  q('[data-climate-analysis]').disabled=!(local85.statistics(definition,data,point)||atlasStatistics(definition,data,point))?.rows.length;
}
function fillPoints() {
  const list = items();
  if(isCountryComparison()){
    if(!list.some(p=>p.id===selectedId))selectedId=list.find(p=>p.id===(isLocal100()?({wateruse:'IND',hunger:'IND',fisheries:'CHN',internet:'JPN',refugees:'SYR'}[definition.id]):isLocal85()?local85.defaultId(definition.id):isLocal90()?(definition.id==='ageing'?'JPN':'IND'):isForest()?'BRA':isSanitation()?'IND':isDrinking()?'IND':'KEN'))?.id||list[0]?.id||'';
    q('[data-climate-point]').replaceChildren(...list.map(p=>new Option(p.name,p.id)));return;
  }
  if(isSea()){
    if(!list.some(p=>p.id===selectedId))selectedId=list.find(p=>p.id==='tide-134')?.id||list[0]?.id||'';
    const groups=[['沿岸の検潮所（相対海面）',tideData?.regions||[]],['衛星による海域平均',data.regions]].map(([label,rows])=>{const g=document.createElement('optgroup');g.label=label;g.append(...rows.map(p=>new Option(p.name,p.id)));return g;});
    q('[data-climate-point]').replaceChildren(...groups);return;
  }
  if (isWater() && waterSelection) {
    q("[data-climate-point]").replaceChildren(...list.map((p) => new Option(p.name, p.id)), new Option(`選択セル ${waterCoordinates(waterSelection)}`, selectedId));
    return;
  }
  list.some((p) => p.id === selectedId) || (selectedId = isRegion() ? list.find((p) => p.id === (isAtlas(), "southern_ryukyu_islands"))?.id || list[0]?.id || "" : list.reduce((best, p) => !best || (stormPeak(p) ?? -1) > (stormPeak(best) ?? -1) ? p : best, null)?.id || ""), q("[data-climate-point]").replaceChildren(...list.map((p) => new Option(isRegion() ? p.name : stormLabel(p), p.id)));
}
async function setYear(next) {
  if (!active || !data || !years().includes(Number(next))) return;
  (isAtlas() || isCoral()) && dataState === "ready" && Number(next) !== year && !reduced.matches && !canvas.hidden && atlasFade.capture(canvas, atlasViewKey);
  const ticket = ++generation;
  // Disabling the range's fieldset, even synchronously, cancels its native drag.
  // Keep the year input enabled; generation tickets already reject stale loads.
  year = Number(next), dataState = "loading", season = null, geometryKey = "", hitPoints = [], setBusy(!0), !isAtlas() && !isCoral() && context.clearRect(0, 0, canvas.width, canvas.height), q("[data-climate-analysis]").disabled = !0, q("[data-climate-value]").textContent = "—", q("[data-climate-period]").textContent = `${year}${isRegion() ? "年" : "シーズン"}`, q("[data-climate-detail]").textContent = "", q("[data-climate-selected]").textContent = `${year}の記録`, q("[data-climate-insight]").textContent = `${year}の記録を読み込んでいます。`, q("[data-climate-status]").textContent = isAtlas() ? "保存データを読込中…" : isLake() ? "JRC保存データを読込中…" : "NOAA保存データを読込中…", q("[data-climate-retry]").hidden = !0;
  try {
    const payload = isRegion() ? null : await load(`cyclones/${year}`);
    if (!active || ticket !== generation) return;
    season = payload, dataState = "ready", fillPoints(), sync(), setBusy(!1), q("[data-climate-controls]").disabled = !1, legend.hidden = !1, lastStep = performance.now(), emit("ready"), resume();
  } catch (error) {
    active && ticket === generation && fail(error);
  }
}
function fail(error) {
  lakeView?.clear(), setBusy(!1), dataState = "error", playing = !1, q("[data-climate-status]").textContent = "保存データの読込に失敗しました。再試行できます。", q("[data-climate-retry]").hidden = !1, emit("error"), console.warn("Climate snapshot unavailable", error);
}
function selectPoint(id, { focus = !0, sample = null } = {}) {
  if ((isCoral() || isSea()) && !focus && stopForInteraction(), isWater() && dataState === "ready") {
    focus || stopForInteraction();
    const cell = waterCellById(waterGrid, id);
    if (cell) {
      stopForInteraction(), waterSelection = cell, selectedId = cell.id, fillPoints(), sync(), focus && focusPoint(selected());
      return;
    }
    if (!items().some((p) => p.id === id)) return;
    waterSelection = null;
  }
  if (!(dataState !== "ready" || !items().some((p) => p.id === id))) {
    if (isLake() && sample) {
      stopForInteraction(), lakeView.selectSample(sample);
      return;
    }
    selectedId = id, sync(), isLake() ? openLakeDetail() : (focus || isWater()) && focusPoint(selected());
  }
}
const projection = () => {
  const rect = globalThis.GaiaMapObservationAdapter?.getViewportRect?.() || map.getBoundingClientRect(), d = document.querySelector("#japan-overlay").dataset, scale = earthBaseScale(rect) * Math.max(1, Number(d.earthZoom) || 1);
  return { rect, scale, x: (rect.width - 360 * scale) / 2 + (Number(d.earthOffsetX) || 0), y: (rect.height - 180 * scale) / 2 + (Number(d.earthOffsetY) || 0) };
};
function paint(view, ratio, now) {
  if(isLake())return lakeTextLayer.record(bufferContext,ctx=>paintScene(view,ratio,now,ctx),{host:canvas,width:view.rect.width,height:view.rect.height,view,ratio,key:[year,selectedId].join('/')});
  return paintScene(view,ratio,now,bufferContext);
}
function paintScene(view, ratio, now,ctx) {
  const { rect, scale } = view;
  buffer.width !== canvas.width && (buffer.width = canvas.width), buffer.height !== canvas.height && (buffer.height = canvas.height), ctx.setTransform(1, 0, 0, 1, 0, 0), ctx.clearRect(0, 0, buffer.width, buffer.height), ctx.setTransform(ratio, 0, 0, ratio, 0, 0), hitPoints = [];
  const xy = (lon, lat) => ({ x: view.x + earthLongitudeToMapX(lon) * scale, y: view.y + (90 - lat) * scale }), visible = (p) => p.x >= -12 && p.y >= -12 && p.x <= rect.width + 12 && p.y <= rect.height + 12;
  if (isCoral())
    hitPoints = coralView.paint(ctx, { regions: data.regions, year, selectedId, xy, scale, width: rect.width, height: rect.height, ratio, elapsed: coralArrival === null ? -1 : now - coralArrival, reduced: reduced.matches }), canvas.dataset.coralEngine = coralView.getState().engine;
  else if (isSea()) {
    const result=seaView.paint(ctx,{stations:tideData.regions,basins:data.regions,year,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", seaView.getState().engine);
  } else if(isLocal100()){
    const result=local100.paint(ctx,{definition,data,year,month,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", local100.getState().engine);
  } else if(isLocal95()){
    const result=local95.paint(ctx,{definition,data,year,month,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", local95.getState().engine);
  } else if(isLocal90()){
    const result=local90.paint(ctx,{definition,data,year,month,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", local90.getState().engine);
  } else if(isLocal85()){
    const result=local85.paint(ctx,{definition:displayDefinition(),data:displayData(),original:data,year,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", local85.getState().engine);
  } else if(isForest()||isSanitation()){
    const result=countryHistoryView.paint(ctx,{definition:displayDefinition(),data:displayData(),original:selectionData(),services:sanitationServices,year,mode:isForest()?forestMode:sanitationMode,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", countryHistoryView.getState().engine);
  } else if(isDrinking()){
    const result=drinkingView.paint(ctx,{definition:displayDefinition(),data:displayData(),original:selectionData(),comparison:drinkingComparisonFor(),year,mode:drinkingMode,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", drinkingView.getState().engine);
  } else if(isElectricity()){
    const result=electricityView.paint(ctx,{definition:displayDefinition(),data:displayData(),original:data,year,mode:electricityMode,selectedId,view,ratio,labelHost:canvas,elapsed:atlasArrival===null?-1:now-atlasArrival,reduced:reduced.matches});
    hitPoints=result.points;publishCanvasState("atlasGeometryState", result.state);publishCanvasState("atlasEngine", electricityView.getState().engine);
  } else if (isWater()) {
    const result = waterView.paint(ctx, { data: waterGrid, regions: data.regions, year, view,ratio,labelHost:canvas, elapsed: atlasArrival === null ? -1 : now - atlasArrival, reduced: reduced.matches, cell: waterSelection, region: selected() });
    hitPoints = result.points, publishCanvasState("atlasGeometryState", result.state), publishCanvasState("atlasEngine", waterView.getState().engine);
  } else if (isRegion())
    for (const [index, region] of data.regions.entries()) {
      const point = xy(region.lon, region.lat), row = region.years.find((y) => y.year === year);
      if (!visible(point) || isLake() && lakeDetail && scale > 30) continue;
      const arrival = isLake() ? poiArrival(index, data.regions.length, lakeArrival === null ? -1 : now - lakeArrival, reduced.matches) : { alpha: 1, scale: 1 };
      if (!arrival.alpha) continue;
      const color = isLake() ? "#8ad9ca" : colorFor("coral", row?.max), chosen = region.id === selectedId, radius = chosen ? 7 : 4;
      ctx.beginPath(), ctx.arc(point.x, point.y, radius * arrival.scale, 0, Math.PI * 2), ctx.fillStyle = color, ctx.globalAlpha = arrival.alpha * (chosen ? 1 : 0.7), ctx.fill(), chosen && (ctx.strokeStyle = "#fff1ba", ctx.lineWidth = 1.5, ctx.beginPath(), ctx.arc(point.x, point.y, 11 * arrival.scale, 0, Math.PI * 2), ctx.stroke()), isLake() && (ctx.font = "14px sans-serif", ctx.textAlign = "center", ctx.lineWidth = 4, ctx.strokeStyle = "#081923", ctx.strokeText(region.name, point.x, point.y - 20), ctx.fillStyle = "#d9f5ef", ctx.fillText(region.name, point.x, point.y - 20)), arrival.alpha >= 0.9 && hitPoints.push({ ...point, id: region.id, lon: region.lon, lat: region.lat });
    }
  else {
    const ordered = [...storms()].sort((a, b) => +(a.id === selectedId) - +(b.id === selectedId));
    for (const storm of ordered) {
      const chosen = storm.id === selectedId;
      ctx.lineWidth = chosen ? 3 : 1.2, ctx.globalAlpha = chosen ? 1 : 0.58;
      for (let i = 1; i < storm.points.length; i++) {
        const a = storm.points[i - 1], b = storm.points[i], p = xy(a[2], a[1]), n = xy(b[2], b[1]);
        Math.abs(p.x - n.x) > 180 * scale || (ctx.strokeStyle = colorFor("cyclones", windMS(b[3])), ctx.beginPath(), ctx.moveTo(p.x, p.y), ctx.lineTo(n.x, n.y), ctx.stroke(), visible(n) && hitPoints.push({ ...n, id: storm.id, lon: b[2], lat: b[1] }));
      }
      if (chosen) {
        const peakIndex = storm.points.findIndex((p2) => p2[3] === stormPeak(storm)), p = storm.points[Math.max(0, peakIndex)], n = xy(p[2], p[1]);
        ctx.strokeStyle = "#fff1ba", ctx.lineWidth = 2, ctx.beginPath(), ctx.arc(n.x, n.y, 8, 0, Math.PI * 2), ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1, publishCanvasState("climateVisibleCount", String(new Set(hitPoints.map((p) => p.id)).size)), publishCanvasState("climateRenderedYear", String(year)), canvas.dataset.climatePaintCount = String(Number(canvas.dataset.climatePaintCount || 0) + 1);
}
// Canvas state is also observed by controls; unchanged attributes do not
// need to trigger those observers or style invalidation on every frame.
function publishCanvasState(name, value) {
  if (canvas.dataset[name] !== value) canvas.dataset[name] = value;
}
function draw(now) {
  if (frame = 0, !active || document.hidden || layer.hidden) return;
  frame = requestAnimationFrame(draw);
  const introVisible = layer.matches(".is-map-title-transitioning, .is-map-data-intro");
  if (canvas.hidden !== introVisible) canvas.hidden = introVisible;
  if (introVisible) {
    countryEntryLayout = null, lastStep = now, isLake() && (lakeArrival = null, lakeView.setVisible(!1)), (isAtlas() || isCoral()) && (atlasArrival = coralArrival = null, atlasFade.reset());
    return;
  }
  const fps = (isCoral() && coralView.getState().field.engine === "canvas2d") || (isSea() && seaView.getState().engine === "canvas2d") ? 12 : 24;
  if (dataState !== "ready" || now - lastDraw < 1e3 / fps) return;
  if (lastDraw = now, isWater() && waterEntryFocus) {
    if (lastStep = now, !countryLayoutReady(now)) return;
    waterEntryFocus = !1, countryEntryLayout = null, focusPoint(selected());
    return;
  }
  if(isCountryComparison()&&electricityEntryFocus){
    lastStep=now;const geography=isLocal100()?local100.geometry():isLocal90()?local90.geometry():isLocal85()?local85.geometry():isForest()||isSanitation()?countryHistoryView.geometry():isDrinking()?drinkingView.geometry():electricityView.geometry();
    if(!countryLayoutReady(now)||(geography!=='ready'&&geography!=='error'))return;
    electricityEntryFocus=false;countryEntryLayout=null;focusPoint(selected());return;
  }
  if(definition.id==='ozone'&&ozoneEntryFocus){
    lastStep=now;if(!countryLayoutReady(now))return;
    ozoneEntryFocus=false;countryEntryLayout=null;focusPoint(selected());return;
  }
  let arriving = !1;
  if (isCoral()) {
    if (document.querySelector("#japan-overlay").dataset.viewAnimation === "running" && coralArrival === null) {
      lastStep = now;
      return;
    }
    coralArrival ??= now, arriving = !reduced.matches && now - coralArrival < CORAL_ARRIVAL_MS, publishCanvasState("climateArrival", arriving ? "running" : "complete"), arriving && (lastStep = now);
  }
  if (isAtlas()) {
    if (document.querySelector("#japan-overlay").dataset.viewAnimation === "running" && atlasArrival === null) {
      lastStep = now;
      return;
    }
    const seaGeography = (isSea() || isCountryComparison()) ? globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.state : null;
    if((isSea() || isCountryComparison()) && seaGeography!=='ready' && seaGeography!=='error') geometryKey='';
    else atlasArrival ??= now;
     arriving = atlasArrival === null || now - atlasArrival < (isWater() ? WATER_ARRIVAL_MS : isSea() ? SEA_ARRIVAL_MS : isForest()||isSanitation()||isLocal85() ? 1100 : isDrinking() ? DRINKING_ARRIVAL_MS : isElectricity() ? ELECTRICITY_ARRIVAL_MS : poiArrivalDuration(data.regions.length)), publishCanvasState("climateArrival", arriving ? "running" : "complete"), arriving && (lastStep = now);
  }
  if (isLake()) {
    const moving = document.querySelector("#japan-overlay").dataset.viewAnimation === "running";
    if (moving && (lastStep = now), moving && lakeArrival === null) return;
    lakeArrival ??= now, arriving = now - lakeArrival < poiArrivalDuration(data.regions.length), publishCanvasState("climateArrival", arriving ? "running" : "complete"), arriving && (lastStep = now), !arriving && lakeAutoDetail && now - lakeArrival >= poiArrivalDuration(data.regions.length) + 700 && openLakeDetail(), lakeView.setVisible(!0), lakeView.paint(projection(), now), syncLakePanel();
  }
  if (playing && now - lastStep >= climatePlaybackInterval(definition.id)) {
    const list = years();
    lastStep = now, setYear(list[(list.indexOf(year) + 1) % list.length]);
    return;
  }
  const view = projection(), { rect } = view, ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(18e5 / Math.max(1, rect.width * rect.height))), key = [definition.id, year, month, basin, selectedId, electricityMode, drinkingMode, forestMode, sanitationMode, isLocal85()?JSON.stringify(local85.getState().mode)+local85.getState().comparisonId:"", rect.width, rect.height, view.scale, view.x, view.y, ratio, (isCoral() || isSea() || isCountryComparison() || isLocal90() || isLocal95()) ? globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.state : ""].join("/"), flowing = ((isWater()&&waterView.getState().engine==='webgl2') || (isLocal100()&&local100.getState().engine==='webgl2') || (isLocal95()&&local95.getState().engine==='webgl2'&&local95.getState().maskShapes>0) || (isLocal90()&&local90.getState().engine==='webgl2') || (isLocal85()&&local85.getState().engine==='webgl2') || ((isForest()||isSanitation())&&countryHistoryView.getState().engine==='webgl2') || (isDrinking() && drinkingView.getState().engine==='webgl2') || (isElectricity() && electricityView.getState().engine==='webgl2') || isCoral() || (isSea() && globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.state === "ready")) && !reduced.matches;
  if (key === geometryKey && !arriving && !atlasFade.getState().active && !flowing) return;
  geometryKey = arriving ? "" : key;
  const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
  canvas.width !== width && (canvas.width = width), canvas.height !== height && (canvas.height = height), paint(view, ratio, now), context.setTransform(1, 0, 0, 1, 0, 0), context.clearRect(0, 0, width, height), context.drawImage(buffer, 0, 0), atlasViewKey = [rect.width, rect.height, view.scale, view.x, view.y, ratio].join("/"), (isAtlas() || isCoral()) && atlasFade.paint(context, atlasViewKey, now, reduced.matches), publishCanvasState("yearFade", atlasFade.getState().active ? "running" : "complete");
  if(isElectricity())electricityView.presentLabels(atlasFade.getState());
  else if(isDrinking())drinkingView.presentLabels(atlasFade.getState());
  else if(isLocal100())local100.presentLabels(atlasFade.getState());
  else if(isLocal95())local95.presentLabels(atlasFade.getState());
  else if(isLocal90())local90.presentLabels(atlasFade.getState());
  else if(isLocal85())local85.presentLabels(atlasFade.getState());
  else if(isForest()||isSanitation())countryHistoryView.presentLabels(atlasFade.getState());
  else if(isSea())seaView.presentLabels(atlasFade.getState());
  else if(isWater())waterView.presentLabels(atlasFade.getState());
  else if(isLake())lakeTextLayer.present();
}
function resume() {
  active && !frame && !document.hidden && !layer.hidden && (frame = requestAnimationFrame(draw));
}
function findPoiAt(clientX, clientY, pointerType) {
  if (!active || dataState !== "ready" || layer.matches(".is-map-title-transitioning, .is-map-data-intro")) return null;
  if(isCountryComparison()||isLocal90()){
    const id=(isLocal100()?local100:isLocal90()?local90:isLocal85()?local85:isForest()||isSanitation()?countryHistoryView:isDrinking()?drinkingView:electricityView).pick(context,clientX,clientY),item=items().find(p=>p.id===id);if(!item)return null;
    const d=displayDefinition(),row=atlasRow(displayData().regions.find(r=>r.id===id),year,month);
    return{type:'exhibit',index:items().indexOf(item),record:{id,exhibitId:definition.id,lon:item.lon,lat:item.lat,title:item.name,kicker:`${definition.number} / ${d.metric}`,preview:`${year}年 / ${Number.isFinite(row?.value)?format(row.value)+' '+d.unit:'公表値なし'}`,url:isDrinking()?d.source:definition.source}};
  }
  if (isSea()) {
    const hit=seaView.pick(clientX,clientY,projection()),p=hit&&items().find(r=>r.id===hit.id);if(!p)return null;const row=p.years.find(r=>r.year===year);
    return {type:'exhibit',index:items().indexOf(p),record:{id:p.id,exhibitId:'sealevel',lon:p.lon,lat:p.lat,title:p.name,kicker:p.stationId?'76 / PSMSL 沿岸の相対海面':'76 / NOAA 衛星海域平均',preview:String(year)+'年 / '+format(row?.value)+' mm',url:p.stationId?tideSource(p.stationId):definition.source}};
  }
  if (isWater()) {
    if (canvas.dataset.climateArrival !== "complete") return null;
    const hit = waterView.pick(clientX, clientY, projection(), data.regions), p = hit?.region || (hit?.cell ? waterCellRegion(waterGrid, hit.cell) : null);
    return p ? { type: "exhibit", index: Math.max(0, items().findIndex((r) => r.id === p.id)), record: { id: p.id, exhibitId: "waterstore", lon: p.lon, lat: p.lat, title: p.name, kicker: hit.cell ? "75 / 配布0.5° · 推定約3°" : "75 / 広域平均", preview: `${year}年 ${format(atlasRow(p, year)?.value)} cm`, url: definition.source } } : null;
  }
  if (isLake() && lakeDetail && projection().scale > 30) {
    const sample = lakeView.pick(clientX, clientY);
    return sample ? { type: "exhibit", index: items().indexOf(selected()), record: {
      id: selectedId,
      exhibitId: "lakes",
      lon: sample.lon,
      lat: sample.lat,
      title: selected().name,
      lakeSample: sample,
      kicker: "74 / 表示セルの年次分類",
      preview: `${sample.year}年 ${sample.label}`,
      url: definition.source
    } } : null;
  }
  const { rect } = projection(), x = clientX - rect.left, y = clientY - rect.top;
  let best = null, distance = pointerType === "touch" ? 22 : 12;
  {
    const view = projection(), points = (isLake() || isCoral()) && canvas.dataset.climateArrival === "complete" ? data.regions.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, x: view.x + earthLongitudeToMapX(p.lon) * view.scale, y: view.y + (90 - p.lat) * view.scale })) : hitPoints;
    for (const p of points) {
      const d = isLocal95()&&p.box&&x>=p.box.x&&x<=p.box.x+p.box.w&&y>=p.box.y&&y<=p.box.y+p.box.h?0:Math.hypot(p.x - x, p.y - y);
      d < distance && (best = p, distance = d);
    }
  }
  if (!best) return null;
  const item = items().find((p) => p.id === best.id), title = best.event?.name || (isRegion() ? item.name : stormLabel(item)), lakeRow = isLake() ? item.years.find((r) => r.year === year) : null;
  return isAtlas() ? { type: "exhibit", index: items().indexOf(item), record: {
    id: item.id,
    exhibitId: definition.id,
    lon: best.lon,
    lat: best.lat,
    title,
    kicker: `${definition.number} / ${definition.metric}`,
    preview: best.event ? `${year}/${best.event.month ?? "—"}/${best.event.day ?? "—"} · ${definition.id === "volcanoes" ? "VEI" : "沿岸最大観測高"} ${format(best.event.magnitude)}${definition.id === "tsunamis" ? " m" : ""}` : `${year}年 / ${format(atlasRow(item, year, month)?.value)} ${definition.unit}`,
    url: definition.source
  } } : { type: "exhibit", index: items().indexOf(item), record: {
    id: item.id,
    exhibitId: definition.id,
    lon: best.lon,
    lat: best.lat,
    title,
    kicker: `${definition.number} / ${isLake() ? "EC JRC/Google" : "NOAA"}`,
    preview: `${year} / ${isLake() ? lakeRow?.coverage > 0 ? format(lakeRow.water) + " km²" : "欠測" : isCoral() ? format(item.years.find((r) => r.year === year)?.max) + " ℃・週" : format(windMS(stormPeak(item))) + " m/s"}`,
    url: definition.source
  } };
}
function deactivate() {
  ozoneEntryFocus=false;
  lakeTextLayer.reset();
  active && (active = !1, generation++, playing = !1, dataState = "idle", cancelAnimationFrame(frame), frame = 0, hitPoints = [], regionalPanel?.closeRegionalAnalysis(), lakeView?.clear(), lakeArrival = null, lakeDetail = !1, lakeAutoDetail = !1, atlasArrival = null, atlasFade.reset(), waterView.reset(), waterGrid = null, waterSelection = null, waterEntryFocus = !1, coralView.reset(), coralArrival = null, seaView.reset(), tideData = null, electricityView.reset(), electricityComparison=null, electricityMode='access', electricityEntryFocus=false, drinkingView.reset(), drinkingComparison=null,drinkingBasic=drinkingBasicComparison=null, drinkingMode=DRINKING_DEFAULT_MODE, local85.reset(),local90.reset(),local95.reset(),local100.reset(), countryHistoryView.reset(),forestMode='change',sanitationMode='safe',sanitationServices=null, layer.classList.remove("is-climate-history-exhibit", "is-lake-detail"), delete layer.dataset.climateExhibit, canvas.hidden = readout.hidden = legend.hidden = !0, buttons.get(definition.id)?.setAttribute("aria-current", "false"), emit("change"), setBusy(!1));
}
async function select(id) {
  ozoneEntryFocus=false;
  const target = CLIMATE_EXHIBITS.find((d) => d.id === id);
  if (!target) return;
  lakeTextLayer.reset();
  regionalPanel?.closeRegionalAnalysis(), lakeView?.clear(), layer.classList.remove("is-lake-detail"), lakeLocatorKey = lakePanelKey = "", lakeArrival = null, lakeDetail = !1, lakeAutoDetail = !1, atlasArrival = null, atlasFade.reset(), waterView.reset(), waterGrid = null, waterSelection = null, waterEntryFocus = !1, coralView.reset(), coralArrival = null, seaView.reset(), tideData = null, electricityView.reset(), electricityComparison=null, electricityMode='access', electricityEntryFocus=false, drinkingView.reset(), drinkingComparison=null,drinkingBasic=drinkingBasicComparison=null, drinkingMode=DRINKING_DEFAULT_MODE,local85.reset(),local90.reset(),local95.reset(),local100.reset(), countryHistoryView.reset(),forestMode='change',sanitationMode='safe',sanitationServices=null;
  for (const provider of [globalThis.GaiaLiveExhibits, globalThis.GaiaEstatExhibits, globalThis.GaiaFirmsExhibit, globalThis.GaiaPlanetSignals, globalThis.GaiaMarineCod, globalThis.GaiaFoodExhibits]) provider?.deactivate?.();
  const ticket = ++generation;
  local85.select(id);
  definition = target, active = !0, dataState = "loading", data = null, season = null, year = 2016, month = definition.defaultMonth || 9, basin = "ALL", selectedId = "", playing = !1, geometryKey = "", hitPoints = [], layer.classList.add("is-climate-history-exhibit"), layer.dataset.climateExhibit = id, canvas.dataset.climateArrival = "waiting", canvas.dataset.climateRenderedYear = "", canvas.dataset.yearFade = "complete", canvas.dataset.atlasEngine = "idle", globalThis.GaiaMapObservationAdapter?.closePoi?.(), canvas.hidden = readout.hidden = !1, legend.hidden = !0, context.clearRect(0, 0, canvas.width, canvas.height);
  for (const b of globalThis.GaiaMapCategories.buttons()) b.setAttribute("aria-current", String(b === buttons.get(id)));
  for (const selector of ["#japan-mode-title", "#japan-title"]) document.querySelector(selector).textContent = target.shortTitle;
  document.querySelector("#japan-mode-number").textContent = target.number;
  const title = document.querySelector("#japan-title");
  title.dataset.exhibitNumber = target.number, title.setAttribute("aria-label", `${target.number} ${target.shortTitle}`), q("[data-climate-number]").textContent = target.number, q("[data-climate-title]").textContent = target.shortTitle, q("[data-climate-category]").textContent = definition.category || (isRegion() ? "世界 · 水と森" : "世界 · 空と天気"), q(".gaia-climate-scale").style.background = isAtlas() ? `linear-gradient(90deg,${definition.colors.join(",")})` : "", q(".gaia-climate-scale").hidden = !!definition.qualitativeLegend, q("[data-climate-guide]").closest("details").open = !1, q("[data-lake-panel]").hidden = !isLake(), q("[data-water-panel]").hidden = !isWater(), q("[data-coral-panel]").hidden = !isCoral(), q("[data-sea-panel]").hidden = !isSea(), electricityPanel.panel.hidden=!isElectricity(), drinkingPanel.panel.hidden=!isDrinking(), forestPanel.panel.hidden=!isForest(),sanitationPanel.panel.hidden=!isSanitation(), q("[data-climate-point]").setAttribute("aria-label", isCountryComparison() ? "国・地域を選択" : isSea() ? "検潮所・衛星の海域平均を選択" : isWater() ? "比較する地域・選択した陸域" : "監視海域・台風を選択"), q("[data-climate-controls]").disabled = q("[data-climate-analysis]").disabled = !0, setBusy(!0), q("[data-climate-basin-label]").hidden = isRegion() && !definition.monthly, q("[data-climate-basin-caption]").textContent = definition.monthly?"月":"海域", q("[data-climate-basin]").setAttribute("aria-label", definition.monthly?"比較する月":"台風の海域"), q("[data-climate-basin]").replaceChildren(...(definition.monthly?Array.from({length:12},(_,i)=>new Option(`${i+1}月`,String(i+1))):Object.entries(BASINS).map(([id2, label]) => new Option(label, id2)))), q("[data-climate-basin]").value = definition.monthly?String(month):"ALL", q("[data-climate-point]").replaceChildren(), q("[data-climate-regional]").hidden = isRegion(), q("[data-climate-overview]").textContent = isAtlas() && innerWidth <= 900 ? "選択へ戻る" : "全体を見る", q("[data-climate-value]").textContent = "—", q("[data-climate-detail]").textContent = "", q("[data-climate-retry]").hidden = !0, q("[data-climate-status]").textContent = "NOAA保存データを読込中…", q("[data-climate-key-title]").textContent = isCoral() ? "年内最大DHW（℃・週）" : "1分平均風速（m/s）", q("[data-climate-labels]").replaceChildren(...(isCoral() ? ["0", "2", "4", "8", "16+"] : ["0", "17", "33", "50", "65+"]).map((label) => {
    const span = document.createElement("span");
    return span.textContent = label, span;
  })), q("[data-climate-guide]").textContent = isCoral() ? "衛星による水温観測から、監視海域の高温域（HotSpotの90パーセンタイル）を取り出し、直近84日間の熱ストレスをDHWとして積算。点は監視海域の代表位置。色と描画上の大きさは年内最大DHW（大きさは16で上限）、円弧は一年のうちDHWが8以上だった日数。海全体の色面は点の色を滑らかにつないだ演出、流線は海の循環をイメージした動きです。観測値は点を選んで確認できます。4・8℃・週はNOAAが白化リスクの目安に用いる水準です。灰色の輪は欠測。" : "NOAA IBTrACS v4r01の主要経路（MAIN）を表示。線の色はUSA_WIND（1分平均風速）をm/sに換算し、灰色は風速欠測。輪は選択経路の最大風速地点です。位置記録には補間時刻を含みます。南半球のシーズンは暦年をまたぎます。海域は各経路の最初の記録で分類し、別経路（spur）は除外しています。", isLake() && (q("[data-climate-key-title]").textContent = "水域の記録", q("[data-climate-labels]").replaceChildren(...["● 通年", "● 季節的", "● 観測なし"].map((text) => {
    const span = document.createElement("span");
    return span.textContent = text, span;
  })), q("[data-climate-status]").textContent = "JRC保存データを読込中…", q("[data-climate-guide]").textContent = "Landsatの年次水域分類（GSW v1.0、1984–2015年）を、3湖周辺の固定矩形範囲で集計しています。通年と季節的な水域の合計です。原画素のWGS84楕円体面積を足し、図だけを縮小。湖周辺の別の水域も含みます。観測カバー率は通期に一度でも水域と分類された範囲が分母。2000年比は両年で観測できた画素だけで計算し、共通カバー率95%以上で表示します。年次分類は一年の観測をまとめた記録で、単日の湖岸線や年平均面積とは区別します。欠測は補間せず、分類・観測時期・湖岸の画素誤差を含みます。新版の位置補正を混在させず、2015年までの原版に限定しています。"), isAtlas() && (q("[data-climate-key-title]").textContent = isWater() ? "陸水量偏差 · 2004–09年比" : definition.legendMetric || definition.metric, q("[data-climate-labels]").replaceChildren(...definition.labels.map((text) => {
    const span = document.createElement("span");
    return span.textContent = text, span;
  })), q("[data-climate-guide]").textContent = definition.guide, q("[data-climate-status]").textContent = "保存データを読込中…"), emit("change");
  try {
    const [payload, grid, tides, comparison, services, basic, basicComparison] = await Promise.all([load(id), isWater() ? load("waterstore-grid") : null, isSea() ? load("sealevel-stations") : null, isDrinking()?load("drinking-comparison"):isElectricity()?load("electricity-comparison"):null,isSanitation()?load("sanitation-services"):null,isDrinking()?load("drinking-basic"):null,isDrinking()?load("drinking-basic-comparison"):null]);
    if (!active || generation !== ticket) return;
    if((isElectricity()||isDrinking())&&payload.sourceUpdated!==comparison.sourceUpdated)throw Error('Electricity comparison source date mismatch');
    if(isDrinking()&&[basic,basicComparison].some(source=>source.sourceUpdated!==payload.sourceUpdated))throw Error('Drinking service release mismatch');
    drinkingBasic=basic;drinkingBasicComparison=basicComparison;
    data = isForest()?forestCountryNames(payload):isElectricity()?electricityCountryNames(payload):payload, waterGrid = grid, tideData = tides, electricityComparison=isElectricity()?comparison:null, drinkingComparison=isDrinking()?comparison:null,sanitationServices=services;
    const list = years(), slider = q("[data-climate-year]");
    if (slider.min = String(list[0]), slider.max = String(list.at(-1)), slider.step = "1", slider.value = "2016", await setYear(isLake() ? 2010 : 2016), !active || definition.id !== id) return;
    definition.id==='ozone' ? (ozoneEntryFocus=true) : isCountryComparison() ? (electricityEntryFocus=true) : isLake() ? (focusPoint(selected()), lakeAutoDetail = !0) : isWater() && innerWidth <= 900 ? (selectedId = "india", sync(), waterEntryFocus = !0) : isCoral() && innerWidth <= 900 ? focusPoint(selected()) : focusAll(), resume();
  } catch (error) {
    active && generation === ticket && fail(error);
  }
}
const statisticsDataset = () => active && dataState === "ready" ? isLocal85() && local85.statistics(definition,data,selected()) ? local85.statistics(definition,data,selected()) : isForest() ? forestStatistics(definition,data,selected(),forestMode) : isSanitation() ? sanitationStatistics(definition,selectionData(),sanitationServices,selected(),sanitationMode) : isDrinking() ? drinkingStatistics(definition,selectionData(),drinkingComparisonFor(),selected(),drinkingMode) : isElectricity() ? electricityStatistics(definition,data,selected(),electricityMode) : isSea() && selected()?.stationId ? tideStatistics(tideData, selected()) : isWater() && waterSelection ? waterCellStatistics(definition, waterGrid, waterSelection) : isAtlas() ? atlasStatistics(definition, data, selected(), month) : isLake() ? lakeStatistics(selected()) : statisticsFor({ kind: definition.id, data, region: selected(), basin }) : null;
async function restoreStatisticsDataset(id) {
  const match = /^climate-([a-z]+)-([a-zA-Z0-9_-]+)$/.exec(id);
  if (!match || !CLIMATE_EXHIBITS.some((d2) => d2.id === match[1])) return null;
  const [, kind, key] = match, payload = (kind==='drinking'||kind==='sanitation')?selectableCountryData(await load(kind)):await load(kind), d = atlasDefinition(kind), period = d?.monthly ? /^(.*)-m(\d{2})$/.exec(key) : null;
  if(kind==='foresthistory'){const change=key.endsWith('-change'),code=change?key.slice(0,-7):key;return forestStatistics(d,payload,payload.regions.find(r=>r.id===code),change?'change':'share');}
  if(kind==='sanitation'){const match=/^(.*)-(basic|limited|open)$/.exec(key),code=match?match[1]:key;return sanitationStatistics(d,payload,await load('sanitation-services'),payload.regions.find(r=>r.id===code),match?match[2]:'safe');}
  if(kind === 'drinking'){const basic=/-basic(?:-gap)?$/.test(key),gap=key.endsWith('-gap'),code=key.replace(/-(?:basic-gap|basic|gap)$/,''),source=basic?selectableCountryData(await load('drinking-basic')):payload,comparison=await load(basic?'drinking-basic-comparison':'drinking-comparison');return drinkingStatistics(d,source,comparison,source.regions.find(r=>r.id===code),basic?gap?'basic-gap':'basic':gap?'gap':'national');}
  if(kind === 'electricity'){const change=key.endsWith('-change'),code=change?key.slice(0,-7):key;return electricityStatistics(d,payload,payload.regions.find(r=>r.id===code),change?'change':'access');}
  if(kind === 'sealevel' && key.startsWith('tide-')){
    const tides=await load('sealevel-stations');return tideStatistics(tides,tides.regions.find(r=>r.id===key));
  }
  if (kind === "waterstore" && key.startsWith("cell-")) {
    const grid = await load("waterstore-grid"), cell = waterCellById(grid, key);
    return cell ? waterCellStatistics(d, grid, cell) : null;
  }
  if (d?.monthly && (!period || +period[2] < 1 || +period[2] > 12)) return null;
  const restored85=local85.restore(d,payload,key);if(restored85)return restored85;
  const region = payload.regions?.find((r) => r.id === (period ? period[1] : key));
  return (kind !== "cyclones" ? !region : !Object.hasOwn(BASINS, key)) ? null : d ? atlasStatistics(d, payload, region, period ? +period[2] : void 0) : kind === "lakes" ? lakeStatistics(region) : statisticsFor({ kind, data: payload, region, basin: key });
}
function mount() {
  if (readout || (layer = document.querySelector("#japan-layer"), map = document.querySelector("#japan-map"), !map)) return;
  canvas = document.createElement("canvas"), canvas.id = "gaia-climate-canvas", canvas.hidden = !0, canvas.setAttribute("aria-hidden", "true"), map.append(canvas), context = canvas.getContext("2d"), buffer = document.createElement("canvas"), bufferContext = buffer.getContext("2d"), readout = document.createElement("section"), readout.className = "gaia-climate-readout", readout.hidden = !0, readout.setAttribute("aria-label", "気候記録の海域・対象・年"), readout.innerHTML = `<div class="gaia-climate-chapter"><p data-climate-category></p><button type="button" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover"><b data-climate-number></b><strong data-climate-title></strong></button></div>
    <p class="gaia-climate-status" data-climate-status role="status"></p><button type="button" data-climate-retry hidden>再試行</button>
    <fieldset data-climate-controls disabled><legend class="gaia-climate-sr">観測記録を選ぶ</legend><div class="gaia-climate-pickers"><label data-climate-basin-label><span data-climate-basin-caption>海域</span><select data-climate-basin aria-label="台風の海域"></select></label><label>記録<select data-climate-point aria-label="監視海域・台風を選択"></select></label></div>
    <div class="gaia-climate-primary"><span data-climate-metric></span><strong data-climate-value>—</strong><small data-climate-detail></small></div>
    <div class="gaia-climate-timeline"><label><b data-climate-period></b><input type="range" data-climate-year min="1980" max="2024" value="2016" step="1" aria-label="気候記録の年" /></label><button type="button" data-climate-overview>全体を見る</button><button type="button" data-climate-regional aria-haspopup="dialog">地域別の接近を分析</button></div></fieldset>
    <div class="gaia-climate-actions"><button type="button" data-climate-source></button><button type="button" data-climate-analysis disabled></button></div>`, legend = document.createElement("section"), legend.className = "gaia-climate-legend", legend.hidden = !0, legend.innerHTML = '<div class="gaia-climate-key"><h3 data-climate-key-title></h3><div class="gaia-climate-scale"></div><p data-climate-labels></p></div><div class="gaia-climate-insight"><h3 data-climate-selected></h3><p data-climate-insight></p></div><details><summary>指標と出典の読み方</summary><p class="gaia-climate-guide" data-climate-guide></p></details>';
  const lakePanel = document.createElement("div");
  lakePanel.dataset.lakePanel = "", lakePanel.hidden = !0, lakePanel.innerHTML = '<header><h3 data-lake-name></h3><small data-lake-country></small></header><canvas data-lake-locator width="240" height="110" role="img"></canvas><button type="button" data-lake-compare aria-pressed="true">2000年の水域を重ねる</button><p data-lake-change></p><p data-lake-sample role="status"></p><small data-lake-coordinates></small>', legend.prepend(lakePanel), layer.append(readout, legend), lakeView = createLakeView(map, syncLakePanel), decorateMapActions(q(".gaia-climate-actions"), q("[data-climate-source]"), q("[data-climate-analysis]"));
  local85.mount(legend);
  forestPanel=createForestPanel(legend,{setMode:setForestMode,setYear:y=>{stopForInteraction();void setYear(y)},selectCountry:id=>{stopForInteraction();selectPoint(id)}});
  sanitationPanel=createSanitationPanel(legend,{setMode:setSanitationMode,setYear:y=>{stopForInteraction();void setYear(y)}});
  drinkingPanel=createDrinkingPanel(legend,{setMode:setDrinkingMode,setYear:y=>{stopForInteraction();void setYear(y)},selectCountry:id=>{stopForInteraction();selectPoint(id)}});
  electricityPanel=createElectricityPanel(legend,{setMode:setElectricityMode,setYear:y=>{stopForInteraction();void setYear(y)},selectCountry:id=>{stopForInteraction();selectPoint(id)}});
  const seaPanel=document.createElement('div');seaPanel.dataset.seaPanel='';seaPanel.hidden=true;
  seaPanel.innerHTML='<small class="sea-eyebrow">COASTAL RECORDS / 沿岸の記録</small><h3 data-sea-name></h3><small data-sea-place></small><div class="sea-reading"><strong data-sea-value></strong><span data-sea-year></span></div><canvas data-sea-chart width="600" height="200" role="img"></canvas><p data-sea-note></p><p class="sea-instruction">沿岸の点を選び、同じ港の変化をたどる</p><a data-sea-link target="_blank" rel="noopener noreferrer">観測所の記録と注記 ↗</a>';
  legend.prepend(seaPanel);
  const waterPanel = document.createElement("div");
  waterPanel.dataset.waterPanel = "", waterPanel.hidden = !0, waterPanel.innerHTML = '<h3 data-water-title></h3><small data-water-place></small><div class="water-reading"><strong data-water-value></strong><span data-water-period></span></div><canvas data-water-chart width="480" height="144" role="img"></canvas><div class="water-chart-years"><span>2003</span><span>2024</span></div><p class="water-instruction">陸地をタップして、同じ場所の変化を追う</p><small class="water-scale-note">配布格子 0.5° · 推定の広さ 約3°</small>', legend.prepend(waterPanel);
  const coralPanel = document.createElement("div");
  coralPanel.dataset.coralPanel = "", coralPanel.hidden = !0, coralPanel.innerHTML = '<h3 data-coral-name></h3><small data-coral-period></small><div class="coral-duration"><span>DHW ≥ 4</span><div><i data-coral-bar="4"></i></div><b data-coral-days="4"></b></div><div class="coral-duration"><span>DHW ≥ 8</span><div><i data-coral-bar="8"></i></div><b data-coral-days="8"></b></div><small data-coral-coverage></small>', legend.prepend(coralPanel), q("[data-lake-compare]").addEventListener("click", () => {
    stopForInteraction(), lakeView.setCompare(!lakeView.getState().compare);
  });
  const layoutObserver = new ResizeObserver(() => {
    formatPrimaryValue();
    geometryKey = "";
  });
  layoutObserver.observe(readout), layoutObserver.observe(legend), new MutationObserver(() => {
  }).observe(legend, { attributes: !0, attributeFilter: ["style"] });
  const refitLake = () => requestAnimationFrame(() => {
    active && isLake() && lakeDetail && selected() && openLakeDetail({ durationMs: 1400 });
  });
  document.addEventListener("toggle", (event) => {
    event.target.id === "map-responsive-data" && (event.target.open || refitLake());
  }, !0), addEventListener("resize", refitLake), q("[data-climate-basin]").replaceChildren(...Object.entries(BASINS).map(([id, label]) => new Option(label, id)));
  for (const d of CLIMATE_EXHIBITS) {
    const b = document.createElement("button");
    b.type = "button", b.className = "map-mode-button", b.textContent = d.number, b.dataset.climateExhibit = d.id, b.dataset.mapPreviewSurface = "map", b.setAttribute("aria-current", "false"), b.setAttribute("aria-label", `${d.number} ${d.shortTitle}`), b.setAttribute("aria-describedby", "map-mode-preview"), b.addEventListener("click", () => {
      select(d.id);
    }), layer.querySelector(".map-mode-list").append(b), buttons.set(d.id, b);
  }
  layer.querySelector(".map-mode-bank").addEventListener("click", (event) => {
    const b = event.target.closest?.(".map-mode-button");
    b && !b.dataset.climateExhibit && deactivate();
  }, { capture: !0 });
  for (const node of [readout, legend]) for (const type of ["pointerdown", "wheel", "keydown", "keyup"]) node.addEventListener(type, (event) => event.stopPropagation());
  q("[data-climate-year]").addEventListener("input", (event) => {
    event.isTrusted && stopForInteraction(), setYear(Number(event.target.value));
  }), q("[data-climate-basin]").addEventListener("change", (event) => {
    if(definition.monthly){stopForInteraction();month=Number(event.target.value);geometryKey="";sync();resume();return;}
    stopForInteraction(), basin = event.target.value, fillPoints(), sync();
  }), q("[data-climate-point]").addEventListener("change", (event) => {
    stopForInteraction(), selectPoint(event.target.value);
  }), q("[data-climate-overview]").addEventListener("click", () => {
    stopForInteraction(), isLake() && !lakeDetail ? openLakeDetail() : focusAll();
  }), q("[data-climate-regional]").addEventListener("click", async (event) => {
    stopForInteraction();
    const button = event.currentTarget, ticket = generation;
    button.disabled = !0;
    try {
      regionalPanel = await import("./cyclone-regional-panel.js?v=regions-20261018"), active && !isRegion() && generation === ticket && regionalPanel.openRegionalAnalysis({ year, trigger: button }), button.textContent = "地域別の接近を分析";
    } catch {
      button.textContent = "地域別分析を再試行";
    } finally {
      button.disabled = !1;
    }
  }), q("[data-climate-retry]").addEventListener("click", () => {
    isAtlas() && canvas.dataset.atlasGeometryState === "error" && globalThis.GaiaMapObservationAdapter?.retryCountryGeometry?.(), data ? setYear(year) : select(definition.id);
  }), q("[data-climate-analysis]").addEventListener("click", () => {
    const dataset = statisticsDataset();
    if (!dataset) return;
    setPlayback(!1);
    const open = () => globalThis.GaiaStatisticsLab?.open?.({ modeId: dataset.modeId, datasetId: dataset.id, dataset });
    globalThis.GaiaStatisticsLab?.open ? open() : addEventListener("gaia:statistics-lab-ready", open, { once: !0 });
  }), document.addEventListener("visibilitychange", () => {
    document.hidden ? (cancelAnimationFrame(frame), frame = 0) : resume();
  }), addEventListener("gaia:japan-close", () => {
    cancelAnimationFrame(frame), frame = 0, playing = !1, lakeView.setVisible(!1), regionalPanel?.closeRegionalAnalysis();
  }), addEventListener("gaia:japan-open", resume);
  for (const name of ["live-exhibit", "estat-exhibit", "firms-exhibit", "planet-signals", "marine-cod", "food"]) addEventListener(`gaia:${name}-change`, (event) => {
    event.detail?.active && active && deactivate();
  });
  reduced.addEventListener("change", () => {
    geometryKey = "";
  }), emit("mounted"), addEventListener("gaia:atlas-renderer-change", () => {
    geometryKey = "", resume();
  }), addEventListener("gaia:coral-renderer-change", () => {
    geometryKey = "", resume();
  }), addEventListener("gaia:sea-renderer-change", () => {
    geometryKey = "", resume();
  });
}
globalThis.GaiaClimateHistory = Object.freeze({
  definitions: CLIMATE_EXHIBITS,
  select,
  deactivate,
  setYear,
  selectPoint,
  findPoiAt,
  focusAll,
  setPlayback,
  getState: () => ({ active, id: definition.id, year, month: definition.monthly?month:null, basin, selectedId, playing, dataState }),
  getPlaybackState: () => ({ ready: active && dataState === "ready", supported: !0, playing: active && playing, detail: "対象年を順番に表示します。", intervalMs:climatePlaybackInterval(definition.id) }),
  getStatisticsDataset: statisticsDataset,
  restoreStatisticsDataset,
  getRenderState: () => isLocal100()?local100.getState():isLocal95()?local95.getState():isLocal90()?local90.getState():isLocal85()?local85.getState():isForest()||isSanitation() ? countryHistoryView.getState() : isDrinking() ? drinkingView.getState() : isElectricity() ? electricityView.getState() : isCoral() ? coralView.getState() : isSea() ? seaView.getState() : isWater() ? waterView.getState() : { engine: "idle" },
  getCruisePoints: () => items(),
  selectCruisePoi: (index) => {
    const p = items()[index];
    p && selectPoint(p.id);
  },
  getCoralState: () => coralView.getState(),
  getForestState:()=>({mode:forestMode,intervalMs:climatePlaybackInterval('foresthistory'),...countryHistoryView.getState()}),
  getDrinkingState:()=>({mode:drinkingMode,service:drinkingIsBasic(drinkingMode)?'basic':'safe',comparisonReady:!!drinkingComparisonFor(),...drinkingView.getState()}),
  getElectricityState:()=>({mode:electricityMode,comparisonReady:!!electricityComparison,...electricityView.getState()}),
  getSeaState: () => ({...seaView.getState(),stationsLoaded:tideData?.regions.length || 0}),
  getLakeState: () => lakeView?.getState(),
  getWaterState: () => ({ ...waterView.getState(), cell: waterSelection ? { ...waterSelection } : null, gridReady: !!waterGrid }),
  getSourceInfo: () => active&&isDrinking()?drinkingSourceInfo():active ? { number: definition.number, shortTitle: definition.shortTitle, datasets: [{
    id: definition.id,
    title: isDrinking()?displayDefinition().signalLabel:definition.signalLabel,
    organisation: definition.organisation || (isLake() ? "Source: EC JRC/Google" : isCoral() ? "NOAA Coral Reef Watch" : "NOAA NCEI / IBTrACS v4r01"),
    url: isDrinking()?displayDefinition().source:definition.source,
    attributionNote: `${q("[data-climate-guide]").textContent} 取得 ${(isDrinking()?selectionData():data)?.retrievedAt?.slice(0, 10) || data?.builtAt || "読込後表示"}。${isCoral() ? data?.attribution || "" : data?.citation || ""} ${data?.license || ""}`
  }, ...(isSea() && tideData ? [{id:'sealevel-stations',title:'沿岸の相対海面・検潮所の年平均',organisation:'PSMSL / 各国の原観測機関',url:selected()?.stationId?tideSource(selected().stationId):'https://psmsl.org/data/obtaining/',attributionNote:[TIDE_GUIDE,tideData.method,tideData.interpretation,tideData.citation].join(' ')}] : [])] } : null
});
addEventListener('gaia:country-theme-renderer-change',()=>{geometryKey='';resume();});
addEventListener('gaia:drinking-renderer-change',()=>{geometryKey='';resume();});
addEventListener('gaia:electricity-renderer-change',()=>{geometryKey='';resume();});
globalThis.GaiaMapObservationAdapter ? mount() : addEventListener("gaia:map-adapter-ready", mount, { once: !0 });

addEventListener('gaia:atlas-renderer-change',()=>{geometryKey='';resume();});
