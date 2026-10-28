import{createDrinkingMapView}from'./drinking-map-view.js?v=surface-release-2e596f2-20261028';
import{paintForestTrends,forestTrendDomain}from'./forest-map-trends.js?v=release100-c363-20261027';
import{paintSanitationMarks}from'./sanitation-composition.js?v=release100-c363-20261027';
import{sanitationRow,SANITATION_MODES}from'./sanitation-services.js?v=release100-c363-20261027';
import{countrySourceId}from'./country-source-ids.js?v=release100-c363-20261027';
import{selectionCountryId}from'./country-selection.js?v=release100-c363-20261027';
import{createCountryThemeMotion,countryThemeSignal}from'./country-theme-motion.js?v=surface-release-2e596f2-20261028';
// Shared geometry/cache/picking, with each exhibit's original data-specific
// readings: forest history traces, and sanitation population compositions.
export function createCountryHistoryView(){
 let kind=null;
 const view=createDrinkingMapView({sourceId:id=>kind==='sanitation'?selectionCountryId(id):countrySourceId(id),selectable:()=>kind==='sanitation',motionFactory:createCountryThemeMotion,encodeMotionValue:countryThemeSignal,paintReadings(ctx,candidates,options){
  kind=options.definition.id;
  return kind==='foresthistory'
   ?paintForestTrends(ctx,candidates,{...options,domain:forestTrendDomain(options.original,options.mode)})
   :paintSanitationMarks(ctx,candidates.map(p=>({...p,parts:sanitationRow(p.region,options.services,options.year)})),{...options,modes:SANITATION_MODES});
 }});
 return{...view,paint(ctx,options){kind=options.definition.id;return view.paint(ctx,options)},reset(){kind=null;view.reset()},getState(){const s=view.getState();return{...s,forestTrends:kind==='foresthistory'?s.drinkingReadings:[],sanitationMarks:kind==='sanitation'?s.drinkingReadings:[]}}};
}
