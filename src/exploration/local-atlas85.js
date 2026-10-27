import {createDrinkingMapView} from './drinking-map-view.js?v=release100-c363-20261027';
import {createWaterStressPanel} from './water-stress.js?v=release100-c363-20261027';
import {paintStressMarks,stressHatch} from './water-stress-marks.js?v=release100-c363-20261027';
import {createCroplandPanel,croplandData,croplandDefinition,croplandStatistics} from './cropland-history.js';
import {paintCroplandComparisons} from './cropland-comparison.js?v=release100-c363-20261027';
import {createYieldPanel} from './cereal-yield.js';
import {paintYieldMarks} from './cereal-yield-marks.js?v=release100-c363-20261027';
import {createFertilizerPanel} from './fertilizer-use.js';
import {paintFertilizerMarks} from './fertilizer-marks.js?v=release100-c363-20261027';
import {createLongevityPanel,longevityData,longevitySourceId} from './longevity-comparison.js';
import {paintLongevityMarks} from './longevity-marks.js?v=release100-c363-20261027';
import {countrySourceId} from './country-source-ids.js';
import {createLocalAtlasMotion,localAtlasSignal} from './local-atlas-motion.js?v=release100-c363-20261027';
import {createUrbanPanel,urbanData,urbanSourceId} from './urban-population.js?v=release100-c363-20261027';
import {paintUrbanMarks} from './urban-marks.js?v=release100-c363-20261027';
import {sharedAtlas90Motion,atlas90Signal} from './atlas90-motion.js?v=release100-c363-20261027';

const ids=['waterstress','cropland','yield','fertilizer','longevity','urban'];
export function createLocalAtlas85({setYear,selectCountry,refresh}){
 let kind='',mode='change',comparisonId='USA';
 const panels={};
 const urbanView=createDrinkingMapView({motionFactory:sharedAtlas90Motion,encodeMotionValue:atlas90Signal,uniquePoints:true,sourceId:urbanSourceId,paintReadings:paintUrbanMarks});
 const activeView=()=>kind==='urban'?urbanView:view;
 const view=createDrinkingMapView({motionFactory:createLocalAtlasMotion,encodeMotionValue:localAtlasSignal,sourceKey:()=>kind,uniquePoints:true,sourceId:id=>kind==='longevity'?longevitySourceId(id):countrySourceId(id),countryOverlay(ctx,{shape,value,view}){
  if(kind==='waterstress'&&Number.isFinite(value)&&value>100){ctx.save();ctx.fillStyle=stressHatch(ctx,view.scale);ctx.globalAlpha=.3;ctx.fill(shape.path,'evenodd');ctx.restore()}
 },paintReadings(ctx,candidates,options){
  const painters={waterstress:paintStressMarks,cropland:paintCroplandComparisons,yield:paintYieldMarks,fertilizer:paintFertilizerMarks,longevity:paintLongevityMarks};
  return painters[kind](ctx,candidates,{...options,data:options.original,comparison:options.original.regions.find(r=>r.id===comparisonId)});
 }});
 return {
  has:id=>ids.includes(id),
  defaultId:id=>({waterstress:'EGY',cropland:'ETH',yield:'IND',fertilizer:'IND',longevity:'JPN',urban:'CHN'})[id],
  definition:d=>d.id==='cropland'?croplandDefinition(d,mode):d,
  data:(d,data)=>d.id==='cropland'?croplandData(data,mode):d.id==='longevity'?longevityData(data):d.id==='urban'?urbanData(data):data,
  mount(legend){
   const actions={setYear,selectCountry};
   panels.waterstress=createWaterStressPanel(legend,actions);
   panels.cropland=createCroplandPanel(legend,{...actions,setMode:value=>{if(value!==mode){mode=value;refresh()}}});
   panels.yield=createYieldPanel(legend,actions);panels.fertilizer=createFertilizerPanel(legend,actions);
   panels.longevity=createLongevityPanel(legend,{setYear,setComparison:id=>{comparisonId=id;refresh()}});
   panels.urban=createUrbanPanel(legend,actions);
  },
  select(id){kind=id;mode='change';comparisonId='USA';view.reset();urbanView.reset();for(const [key,value] of Object.entries(panels))value.panel.hidden=key!==id},
  sync({id,region,year,data}){
   if(!ids.includes(id))return;
   if(comparisonId===region.id)comparisonId=region.id==='USA'?'JPN':'USA';
   panels[id].sync({region,year,data,mode,comparison:data.regions.find(r=>r.id===comparisonId)});
  },
  paint(ctx,options){return activeView().paint(ctx,{...options,mode,readingKey:comparisonId})},
  geometry:()=>activeView().geometry(),pick:(...args)=>activeView().pick(...args),presentLabels:fade=>activeView().presentLabels(fade),
  getState(){const state=activeView().getState();return {...state,[{waterstress:'stressMarks',cropland:'croplandComparisons',yield:'yieldMarks',fertilizer:'fertilizerMarks',longevity:'longevityMarks',urban:'urbanMarks'}[kind]]:state.drinkingReadings,mode,comparisonId}},
  statistics:(d,data,region)=>d.id==='cropland'?croplandStatistics(d,data,region,mode):null,
  restore:(d,data,key)=>d?.id==='cropland'&&key.endsWith('-change')?croplandStatistics(d,data,data.regions.find(r=>r.id===key.slice(0,-7)),'change'):null,
  reset(){view.reset();urbanView.reset()}
 };
}
