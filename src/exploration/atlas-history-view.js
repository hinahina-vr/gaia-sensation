import {urbanArrival,urbanSourceId,urbanName} from './urban-population.js?v=whole-trends20-20261025';
import {paintUrbanMarks} from './urban-marks.js?v=whole-trends20-20261025';
import {longevityArrival,longevitySourceId,longevityName} from './longevity-comparison.js?v=whole-trends20-20261025';
import {paintLongevityMarks} from './longevity-marks.js?v=whole-trends20-20261025';
import {fertilizerArrival} from './fertilizer-use.js?v=fertilizer-20261025';
import {paintFertilizerMarks} from './fertilizer-marks.js?v=whole-trends20-20261025';
import {earthLongitudeToMapX} from './world-projection.js?v=gaia-japan-center-1';
import {foodCountryCopies,pickFoodCountry} from './food-country-fill.js?v=whole-trends20-20261025';
import {poiArrival} from './annual-poi-arrival.js?v=20260909';
import {atlasColor,atlasFormat,atlasRow} from './atlas-history-model.js?v=whole-trends20-20261025';
import {ATLAS_GLYPH_TYPES,createAtlasDataWebgl} from './atlas-data-webgl.js?v=atlas-100-20261022';
import {paintCentury} from './atlas-century-view.js?v=whole-trends20-20261025';
import {electricityArrival,paintElectricityLabels} from './electricity-country-marks.js?v=electricity-polish-20261023';
import {drinkingArrival,paintDrinkingReadings} from './drinking-water-reading.js?v=drinking-polish-20261023';
import {sanitationArrival,paintSanitationMarks} from './sanitation-composition.js?v=sanitation-polish-20261023';
import {sanitationRow,SANITATION_MODES} from './sanitation-services.js?v=whole-trends20-20261025';
import {forestArrival,forestTrendDomain,paintForestTrends} from './forest-map-trends.js?v=whole-trends20-20261025';
import {countrySourceId} from './country-source-ids.js?v=stress-polish-20261023';
import {stressArrival,stressHatch,paintStressMarks} from './water-stress-marks.js?v=stress-polish-20261023';
import {croplandArrival,paintCroplandComparisons} from './cropland-comparison.js?v=whole-trends20-20261025';

import {yieldArrival} from './cereal-yield.js?v=yield-20261023';
import {paintYieldMarks} from './cereal-yield-marks.js?v=whole-trends20-20261025';

export function placeAtlasGauge(point,{above,below,halfWidth},obstacles,bottom) {
  let y=point.y;
  for(const r of [...obstacles].sort((a,b)=>a.top-b.top)) {
    if(point.x+halfWidth<=r.left||point.x-halfWidth>=r.right||y+below<=r.top||y-above>=r.bottom)continue;
    const next=r.bottom+12+above;
    if(next+below<=bottom-12)y=next;
  }
  return {...point,y};
}

// Data-backed marks only: broad GRACE boxes, basin gauges, national polygons.
// No interpolated global texture, decorative station clouds, or point-as-area data.
export function createAtlasView() {
  let geometrySource,shapes=[],sourceShapes=[],currentShapes=[],currentView,currentData,currentDefinition,points=[];
  const gpu=createAtlasDataWebgl();let glyphCount=0,diagramBounds=[],electricityLabels=[],drinkingReadings=[],sanitationMarks=[],forestTrends=[],stressMarks=[],stressHatched=[],urbanMarks=[],longevityMarks=[],fertilizerMarks=[],yieldMarks=[],croplandComparisons=[];
  const reset=()=>{currentView=currentData=currentDefinition=null;currentShapes=[];points=[];glyphCount=0;electricityLabels=[];drinkingReadings=[];sanitationMarks=[];forestTrends=[];stressMarks=[];stressHatched=[];urbanMarks=[],longevityMarks=[],fertilizerMarks=[],yieldMarks=[],croplandComparisons=[];gpu.reset();};
  function geometry(){
    const adapter=globalThis.GaiaMapObservationAdapter,g=adapter?.getCountryGeometry?.();
    if(g?.state==='ready'&&geometrySource!==g.countries){geometrySource=g.countries;shapes=g.countries.map(s=>({...s,id:s.iso3,path:adapter.getCountryPath(s.iso3)})).filter(s=>s.path);sourceShapes=shapes.map(s=>({...s,id:countrySourceId(s.id)}));}
    return g?.state||'loading';
  }
  function paint(ctx,{definition:d,data,comparison,sanitation,forest,cropland,longevity,year,month,selectedId,view,elapsed,reduced}){
    currentView={...view,originX:view.x,originY:view.y,wrapX:d.id==='foresthistory'};currentData=data;currentDefinition=d;points=[];diagramBounds=[];electricityLabels=[];drinkingReadings=[];sanitationMarks=[];forestTrends=[];stressMarks=[];stressHatched=[];urbanMarks=[],longevityMarks=[],fertilizerMarks=[],yieldMarks=[],croplandComparisons=[];
    const xy=(lon,lat)=>{let x=view.x+earthLongitudeToMapX(lon)*view.scale;const width=360*view.scale;if(currentView.wrapX)x+=Math.round((view.rect.width/2-x)/width)*width;return {x,y:view.y+(90-lat)*view.scale};};
    if(d.century&&d.view!=='countries'){
      const result=paintCentury(ctx,{definition:d,data,year,selectedId,view,elapsed,reduced},gpu,xy);
      points=result.points;glyphCount=result.glyphs;diagramBounds=result.bounds;return {state:'ready',points};
    }
    const compact=view.rect.width<=900;
    const localRect=e=>{const r=e.getBoundingClientRect();return {left:r.left-view.rect.left,right:r.right-view.rect.left,top:r.top-view.rect.top,bottom:r.bottom-view.rect.top};};
    const obstacles=['levels','extent'].includes(d.view)?[...document.querySelectorAll('.gaia-climate-legend,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect):[];
    const dock=document.querySelector('.gaia-climate-readout');
    const bottom=!compact&&dock?.checkVisibility({visibilityProperty:true})?localRect(dock).top:view.rect.height;
    const text=(s,x,y,size=13,color='#deefec')=>{ctx.font=`${size}px serif`;ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#061720';ctx.strokeText(s,x,y);ctx.fillStyle=color;ctx.fillText(s,x,y);};
    if(d.view==='countries'){
      const state=geometry();if(state!=='ready')return {state,points};
      const renderShapes=d.id==='urban'?sourceShapes.map(s=>({...s,id:urbanSourceId(s.id)})):d.id==='longevity'?sourceShapes.map(s=>({...s,id:longevitySourceId(s.id)})):['foresthistory','waterstress','cropland','yield','fertilizer','longevity','urban'].includes(d.id)?sourceShapes:shapes;currentShapes=renderShapes;
      const byId=new Map(data.regions.map(r=>[r.id,r]));
      const hatch=d.id==='waterstress'?stressHatch(ctx,view.scale):null;
      const kind=d.countryGlyphs===false?null:ATLAS_GLYPH_TYPES[d.id],useGpu=kind&&gpu.available();
      ctx.save();ctx.beginPath();ctx.rect(currentView.wrapX?0:view.x,view.y,currentView.wrapX?view.rect.width:360*view.scale,180*view.scale);ctx.clip();
      for(const [index,s]of renderShapes.entries()){
        const arrival=d.id==='urban'?{alpha:urbanArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='longevity'?{alpha:longevityArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='fertilizer'?{alpha:fertilizerArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='yield'?{alpha:yieldArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='cropland'?{alpha:croplandArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='waterstress'?{alpha:stressArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='foresthistory'?{alpha:forestArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='sanitation'?{alpha:sanitationArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='drinking'?{alpha:drinkingArrival(index,renderShapes.length,elapsed,reduced)}:d.id==='electricity'?{alpha:electricityArrival(index,renderShapes.length,elapsed,reduced)}:poiArrival(index,renderShapes.length,elapsed,reduced);if(!arrival.alpha)continue;
        const region=byId.get(s.id),v=atlasRow(region,year)?.value,measured=Number.isFinite(v),chosen=s.id===selectedId,color=atlasColor(d,v);
        if(hatch&&measured&&v>100)stressHatched.push(s.id);
        for(const copy of foodCountryCopies(currentView)){
          ctx.save();ctx.translate(copy.x,copy.y);ctx.scale(view.scale,view.scale);
          ctx.fillStyle=color;ctx.globalAlpha=arrival.alpha*(measured?(d.id==='drinking'?.82:['electricity','sanitation','foresthistory'].includes(d.id)?.76:useGpu?.17:d.id==='waterstress'?.72:d.id==='cropland'?.76:.72):.14);ctx.fill(s.path,'evenodd');
          if(hatch&&measured&&v>100){ctx.fillStyle=hatch;ctx.globalAlpha=arrival.alpha*.3;ctx.fill(s.path,'evenodd');}
          ctx.strokeStyle=chosen?(d.id==='cropland'?(measured?d.unit==='ポイント'&&v<0?'#9edcf1':'#f5d393':'#99afb7'):d.id==='waterstress'?(measured?v>100?'#ffc5a4':'#b4e4e1':'#99afb7'):d.id==='foresthistory'?(Number.isFinite(v)?d.unit==='ポイント'&&v<0?'#e9ae7b':'#b5e4bb':'#99afb7'):'#fff0c0'):d.id==='electricity'?'#8ab6b5':color;ctx.lineWidth=(chosen?2:.45)/view.scale;ctx.globalAlpha=arrival.alpha*(chosen?1:d.id==='electricity'?.32:.5);ctx.stroke(s.path);ctx.restore();
        }
        if(region&&arrival.alpha>=.9&&(!['longevity','urban'].includes(d.id)||!points.some(p=>p.id===s.id)))points.push({id:s.id,...xy(s.lon,s.lat),lon:s.lon,lat:s.lat});
      }
      if(['electricity','drinking','sanitation','foresthistory','waterstress','cropland','yield','fertilizer','longevity','urban'].includes(d.id)){
        const chosen=renderShapes.find(s=>s.id===selectedId);
        if(chosen)for(const copy of foodCountryCopies(currentView)){
          ctx.save();ctx.translate(copy.x,copy.y);ctx.scale(view.scale,view.scale);
          ctx.globalAlpha=d.id==='urban'?urbanArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='longevity'?longevityArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='fertilizer'?fertilizerArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='yield'?yieldArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='cropland'?croplandArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='waterstress'?stressArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='foresthistory'?forestArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='sanitation'?sanitationArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='drinking'?drinkingArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):d.id==='electricity'?electricityArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced):poiArrival(renderShapes.indexOf(chosen),renderShapes.length,elapsed,reduced).alpha;
          const v=atlasRow(byId.get(chosen.id),year)?.value;
          const highlight=d.id==='cropland'?(Number.isFinite(v)?d.unit==='ポイント'&&v<0?'#9edcf1':'#f5d393':'#99afb7'):d.id==='waterstress'?(Number.isFinite(v)?v>100?'#ffc5a4':'#b4e4e1':'#99afb7'):d.id==='foresthistory'?(Number.isFinite(v)?d.unit==='ポイント'&&v<0?'#e9ae7b':'#b5e4bb':'#99afb7'):d.id==='sanitation'?d.colors.at(-1):d.id==='drinking'?'#c7faf4':'#ffe4a3';
          ctx.lineWidth=1.6/view.scale;ctx.strokeStyle=highlight;ctx.shadowColor=['foresthistory','waterstress','cropland','yield','fertilizer','longevity','urban'].includes(d.id)?highlight:d.id==='sanitation'?d.colors.at(-1):d.id==='drinking'?'#8acfd7':'#ffd491';ctx.shadowBlur=12;ctx.stroke(chosen.path);ctx.restore();
        }
      }
      ctx.restore();
      glyphCount=0;
      if(useGpu){
        const baseSize=compact?16:21,instances=[],placed=[];
        const fraction=value=>!Number.isFinite(value)?-1:Math.max(0,kind===8?value/1000:kind===2||kind===7||kind===15?value/100:(value-d.range[0])/(d.range[1]-d.range[0]));
        const fishMax=d.id==='fisheries'?Math.max(...data.regions.flatMap(r=>r.years.flatMap(y=>[y.capture,y.aquaculture]).filter(Number.isFinite))):1;
        const ordered=shapes.map((s,index)=>({s,index})).sort((a,b)=>Number(b.s.id===selectedId)-Number(a.s.id===selectedId)||a.s.id.localeCompare(b.s.id));
        const blocked=[...document.querySelectorAll('.gaia-climate-legend,#map-stable-navigation,.japan-heading,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        for(const {s,index}of ordered){
          const r=byId.get(s.id),row=atlasRow(r,year),v=row?.value;if(!Number.isFinite(v))continue;
          const p=xy(s.lon,s.lat),w=kind===3?baseSize*.5:kind===5||kind===16?baseSize*1.45:baseSize,h=kind===3?baseSize*1.3:kind===5?baseSize*.5:baseSize;
          const box={left:p.x-w-6,right:p.x+w+6,top:p.y-h-6,bottom:p.y+h+6};
          const overlaps=b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top;
          if(box.left<0||box.right>view.rect.width||box.top<0||box.bottom>bottom||placed.some(overlaps)||blocked.some(overlaps))continue;
          placed.push(box);
          const a=poiArrival(index,shapes.length,elapsed,reduced);if(!a.alpha)continue;
          const color=atlasColor(d,v).match(/\d+/g).map(Number).map(x=>x/255),baseline=atlasRow(r,2000)?.value;
          const extras=kind===14?[row.agriculture/100,row.industry/100,row.domestic/100,0]:kind===15?[row.censored?1:0,0,0,0]:kind===16?[row.capture/fishMax,row.aquaculture/fishMax,0,0]:[0,0,0,0];
          instances.push([p.x,p.y,w,h,fraction(v)*Math.min(1,a.scale),fraction(baseline),s.id===selectedId?1:0,a.alpha,...color,...extras]);
        }
        const ratio=ctx.canvas.width/view.rect.width;
        gpu.paint(ctx,instances,{width:view.rect.width,height:view.rect.height,ratio,kind});glyphCount=instances.length;
      }
      const selected=points.find(p=>p.id===selectedId),region=byId.get(selectedId);
      if(d.id==='electricity'){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        const candidates=shapes.filter(s=>byId.has(s.id)).map(s=>{const r=byId.get(s.id);return {id:s.id,name:r.name,...xy(s.lon,s.lat),value:atlasRow(r,year)?.value,baseline:atlasRow(r,2000)?.value};});
        electricityLabels=paintElectricityLabels(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,change:d.unit==='ポイント',alpha:electricityArrival(0,1,reduced?elapsed:elapsed-220,reduced)});
      }
      if(d.id==='drinking'){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        const pairs=new Map((comparison?.regions||[]).map(r=>[r.id,atlasRow(r,year)]));
        const candidates=shapes.filter(s=>byId.has(s.id)).map(s=>({id:s.id,name:byId.get(s.id).name,...xy(s.lon,s.lat),value:atlasRow(byId.get(s.id),year)?.value,urban:pairs.get(s.id)?.urban??null,rural:pairs.get(s.id)?.rural??null}));
        drinkingReadings=paintDrinkingReadings(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,gap:d.unit==='ポイント',alpha:drinkingArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='sanitation'&&sanitation){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        const originals=new Map(sanitation.data.regions.map(r=>[r.id,r]));
        const candidates=shapes.filter(s=>byId.has(s.id)).map(s=>({id:s.id,name:byId.get(s.id).name,...xy(s.lon,s.lat),parts:sanitationRow(originals.get(s.id),sanitation.services,year)}));
        sanitationMarks=paintSanitationMarks(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,mode:sanitation.mode,modes:SANITATION_MODES,alpha:sanitationArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='foresthistory'&&forest){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        const originals=new Map(forest.data.regions.map(r=>[r.id,r]));
        const candidates=renderShapes.filter(s=>originals.has(s.id)).map(s=>({id:s.id,name:originals.get(s.id).name,region:originals.get(s.id),...xy(s.lon,s.lat)}));
        forestTrends=paintForestTrends(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,mode:forest.mode,domain:forestTrendDomain(forest.data,forest.mode),alpha:forestArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='waterstress'){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        const candidates=renderShapes.filter(s=>byId.has(s.id)).map(s=>({id:s.id,name:byId.get(s.id).name,region:byId.get(s.id),...xy(s.lon,s.lat)}));
        stressMarks=paintStressMarks(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,alpha:stressArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='urban'){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        // Keep tiny real territories visible and clickable. A nearby country's
        // large text label must not cover an island's entire geographic area.
        if(!compact)for(const s of renderShapes){
          const b=s.bounds;if(!byId.has(s.id)||!b||(b.right-b.left)*view.scale>24||(b.bottom-b.top)*view.scale>24)continue;
          for(const copy of foodCountryCopies(currentView)){
            const box={left:copy.x+b.left*view.scale-3,right:copy.x+b.right*view.scale+3,top:copy.y+b.top*view.scale-3,bottom:copy.y+b.bottom*view.scale+3};
            if(box.right>=0&&box.left<=view.rect.width&&box.bottom>=0&&box.top<=view.rect.height)blockers.push(box);
          }
        }
        if(compact){const header=[...document.querySelectorAll('.japan-heading *,#map-stable-navigation *,#japan-close')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);blockers.push({left:0,right:view.rect.width,top:0,bottom:Math.max(0,...header.map(r=>r.bottom))});}
        const unique=[...new Map(renderShapes.filter(s=>byId.has(s.id)).map(s=>[s.id,s])).values()];
        const candidates=unique.map(s=>({id:s.id,name:urbanName(byId.get(s.id)),region:byId.get(s.id),...xy(s.lon,s.lat)}));
        urbanMarks=paintUrbanMarks(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,alpha:urbanArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='longevity'){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        // Keep tiny real territories visible and clickable. A nearby country's
        // large text label must not cover an island's entire geographic area.
        if(!compact)for(const s of renderShapes){
          const b=s.bounds;if(!byId.has(s.id)||!b||(b.right-b.left)*view.scale>24||(b.bottom-b.top)*view.scale>24)continue;
          for(const copy of foodCountryCopies(currentView)){
            const box={left:copy.x+b.left*view.scale-3,right:copy.x+b.right*view.scale+3,top:copy.y+b.top*view.scale-3,bottom:copy.y+b.bottom*view.scale+3};
            if(box.right>=0&&box.left<=view.rect.width&&box.bottom>=0&&box.top<=view.rect.height)blockers.push(box);
          }
        }
        if(compact){const header=[...document.querySelectorAll('.japan-heading *,#map-stable-navigation *,#japan-close')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);blockers.push({left:0,right:view.rect.width,top:0,bottom:Math.max(0,...header.map(r=>r.bottom))});}
        const unique=[...new Map(renderShapes.filter(s=>byId.has(s.id)).map(s=>[s.id,s])).values()];
        const candidates=unique.map(s=>({id:s.id,name:longevityName(byId.get(s.id)),region:byId.get(s.id),...xy(s.lon,s.lat)}));
        longevityMarks=paintLongevityMarks(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,comparison:longevity?.comparison,alpha:longevityArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='fertilizer'){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        if(compact){const header=[...document.querySelectorAll('.japan-heading * ,#map-stable-navigation *,#japan-close')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);blockers.push({left:0,right:view.rect.width,top:0,bottom:Math.max(0,...header.map(r=>r.bottom))});}
        const candidates=renderShapes.filter(s=>byId.has(s.id)).map(s=>({id:s.id,name:byId.get(s.id).name,region:byId.get(s.id),...xy(s.lon,s.lat)}));
        fertilizerMarks=paintFertilizerMarks(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,data,alpha:fertilizerArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='yield'){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        const candidates=renderShapes.filter(s=>byId.has(s.id)).map(s=>({id:s.id,name:byId.get(s.id).name,region:byId.get(s.id),...xy(s.lon,s.lat)}));
        yieldMarks=paintYieldMarks(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,alpha:yieldArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(d.id==='cropland'&&cropland){
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
        const originals=new Map(cropland.data.regions.map(r=>[r.id,r]));
        const candidates=renderShapes.filter(s=>originals.has(s.id)).map(s=>({id:s.id,name:originals.get(s.id).name,region:originals.get(s.id),...xy(s.lon,s.lat)}));
        croplandComparisons=paintCroplandComparisons(ctx,candidates,{width:view.rect.width,height:view.rect.height,compact,selectedId,obstacles:blockers,year,mode:cropland.mode,alpha:croplandArrival(0,1,reduced?elapsed:elapsed-240,reduced)});
      }
      if(!['electricity','drinking','sanitation','foresthistory','waterstress','cropland','yield','fertilizer','longevity','urban'].includes(d.id)&&selected&&region){
        ctx.save();ctx.globalAlpha=poiArrival(0,1,elapsed,reduced).alpha;
        const size=compact?11:16,half=region.name.length*size*.55;
        let x=Math.max(half+8,Math.min(view.rect.width-half-8,selected.x));
        let y=selected.y-(useGpu?(compact?37:44):14);
        const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect).sort((a,b)=>a.top-b.top);
        for(const b of blockers)if(x+half>b.left&&x-half<b.right&&y-size<b.bottom&&y>b.top)y=b.bottom+size+10;
        y=Math.max(size+8,Math.min(bottom-12,y));
        const zoom=document.querySelector('#gaia-map-zoom-controls');
        if(zoom?.checkVisibility({visibilityProperty:true})){const b=localRect(zoom);if(x-half<b.right&&y-size<b.bottom&&y>b.top)x=Math.min(view.rect.width-half-8,b.right+half+8);}
        if(Math.hypot(x-selected.x,y-selected.y)>65){ctx.strokeStyle='#dceee630';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(selected.x,selected.y);ctx.lineTo(x,y-size);ctx.stroke();}
        text(region.name,x,y,size);
        if(['electricity','drinking','sanitation','foresthistory','waterstress','cropland','yield','fertilizer','longevity','urban'].includes(d.id)){
          const value=atlasRow(region,year)?.value;
          text(`${d.unit==='ポイント'&&value>0?'＋':''}${atlasFormat(value)}${Number.isFinite(value)?` ${d.unit==='ポイント'?'pt':d.unit}`:''}`,x,y+size+6,size-1,d.id==='drinking'?'#c7faf4':'#ffe4a3');
        }
        ctx.restore();
      }
    }else if(d.view==='extent'){
      // A fixed area scale, not invented ice/snow boundaries. Compare one region
      // on compact screens; desktop keeps regions separate, including the total.
      const regions=compact?data.regions.filter(r=>r.id===selectedId):data.regions;
      const max=Math.max(...data.regions.flatMap(r=>r.years.flatMap(y=>y.monthValues).filter(Number.isFinite)));
      const compactTop=compact?Math.max(0,...[...document.querySelectorAll('.gaia-climate-legend,#map-stable-navigation,.japan-heading')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>localRect(e).bottom))+12:0;
      const compactBottom=compact?Math.min(view.rect.height,...[...document.querySelectorAll('#map-responsive-data,#map-mobile-bottom')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>localRect(e).top))-12:bottom;
      const radius=compact?Math.max(18,Math.min(75,view.rect.width*.19,(compactBottom-compactTop-92)/2)):Math.min(108,view.rect.width*.065);
      for(const [index,r]of regions.entries()){
        const a=poiArrival(index,regions.length,elapsed,reduced);if(!a.alpha)continue;
        const geographic=xy(r.lon,r.lat),v=atlasRow(r,year,month)?.value,base=atlasRow(r,2000,month)?.value;
        // Keep aggregate symbols readable; the fine leader points to the region.
        const aggregate=r.id==='nhland';
        const halfWidth=Math.max(radius+10,compact?100:r.name.length*8+12);
        const p=compact?{x:view.rect.width*.5,y:(compactTop+compactBottom-12)*.5}:{
          x:Math.max(halfWidth+18,Math.min(view.rect.width-halfWidth-18,aggregate?view.rect.width*.5:geographic.x)),
          y:aggregate?view.rect.height*.61:geographic.y,
        };
        if(!compact){
          p.y=Math.max(radius+180,Math.min(bottom-radius-58,p.y));
          p.y=placeAtlasGauge(p,{halfWidth,above:radius+44,below:radius+48},obstacles,bottom).y;
          for(const b of obstacles)if(p.x+halfWidth>b.left&&p.x-halfWidth<b.right&&p.y+radius+48>b.top&&p.y-radius-44<b.bottom)p.x=Math.max(halfWidth+18,b.left-halfWidth-16);
        }
        const color=atlasColor(d,v),size=Number.isFinite(v)?radius*Math.sqrt(v/max):0;
        ctx.save();ctx.globalAlpha=a.alpha;
        if(!compact&&!aggregate&&Math.hypot(p.x-geographic.x,p.y-geographic.y)>12){ctx.strokeStyle='#bce3ef25';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(geographic.x,geographic.y);ctx.lineTo(p.x,p.y);ctx.stroke();}
        ctx.strokeStyle='#bce3ef35';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.stroke();
        if(d.id==='snowcover'){
          // Twelve equal-angle sectors: area, not radius, is proportional to
          // that month's snow extent. This is a seasonal diagram, not a snow map.
          const values=r.years.find(y=>y.year===year)?.monthValues||[];
          const baseline=r.years.find(y=>y.year===2000)?.monthValues||[];
          for(let m=0;m<12;m++){
            const start=-Math.PI/2+m*Math.PI/6+.018,end=start+Math.PI/6-.036,mid=(start+end)/2;
            const extent=values[m],rad=Number.isFinite(extent)?radius*Math.sqrt(extent/max):0;
            if(rad>0){const fill=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rad);fill.addColorStop(0,'#2f637e22');fill.addColorStop(1,m+1===month?'#eaf9f1cc':'#91c7da77');ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,rad,start,end);ctx.closePath();ctx.fill();ctx.strokeStyle=m+1===month?'#f8e0ae':'#b4dcea55';ctx.lineWidth=m+1===month?1.5:.7;ctx.stroke();}
            if(Number.isFinite(baseline[m])){ctx.setLineDash([2,3]);ctx.strokeStyle='#f2dfb580';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(p.x,p.y,radius*Math.sqrt(baseline[m]/max),start,end);ctx.stroke();ctx.setLineDash([]);}
            text(String(m+1),p.x+Math.cos(mid)*(radius+11),p.y+Math.sin(mid)*(radius+11)+3,compact?8:10,m+1===month?'#ffe4ac':'#96b8c8');
          }
        }else if(Number.isFinite(v)&&size>0){
          const fill=ctx.createRadialGradient(p.x-size*.25,p.y-size*.35,0,p.x,p.y,size);fill.addColorStop(0,'#e4ffffcc');fill.addColorStop(.65,color);fill.addColorStop(1,'#356a8566');
          ctx.fillStyle=fill;ctx.globalAlpha=a.alpha*.68;ctx.beginPath();ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=a.alpha;
          ctx.strokeStyle=r.id===selectedId?'#e9fff8':color;ctx.lineWidth=r.id===selectedId?1.8:1;ctx.stroke();
        }
        if(d.id!=='snowcover'&&Number.isFinite(base)){ctx.setLineDash([3,5]);ctx.strokeStyle='#f2dfb580';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,radius*Math.sqrt(base/max),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
        text(r.name,p.x,p.y-radius-(d.id==='snowcover'?29:17),compact?12:16);
        text(`${atlasFormat(v)}${Number.isFinite(v)?' 百万km²':''}`,p.x,p.y+radius+25,compact?15:21);
        text(`${month}月 · 破線は2000年`,p.x,p.y+radius+44,compact?10:12,'#aac5d0');
        points.push({...p,id:r.id,lon:r.lon,lat:r.lat,box:{x:p.x-halfWidth,y:p.y-radius-48,w:halfWidth*2,h:radius*2+100}});ctx.restore();
      }
    }else{
      for(const [index,r]of data.regions.entries()){
        const a=poiArrival(index,data.regions.length,elapsed,reduced);if(!a.alpha)continue;
        const p=xy(r.lon,r.lat),row=atlasRow(r,year),v=row?.value,chosen=r.id===selectedId,color=atlasColor(d,v);
        ctx.save();ctx.globalAlpha=a.alpha;
        if(d.view==='boxes'){
          const [west,south,east,north]=r.bounds,lt=xy(west,north),rb=xy(east,south),w=rb.x-lt.x,h=rb.y-lt.y;
          // Color covers the actual fixed averaging box, not a fictitious basin.
          ctx.fillStyle=color;ctx.globalAlpha=a.alpha*.55;ctx.fillRect(lt.x,lt.y,w,h);
          ctx.globalAlpha=a.alpha*(chosen?.95:.6);ctx.strokeStyle=chosen?'#fff0c0':color;ctx.lineWidth=chosen?1.7:1;
          ctx.strokeRect(lt.x,lt.y,w,h);
          ctx.globalAlpha=a.alpha;text(r.name,p.x,lt.y-9,compact?11:14);
          if(!compact||chosen)text(`${atlasFormat(v)}${Number.isFinite(v)?' cm':''}`,p.x,rb.y+18,compact?12:17);
          points.push({...p,id:r.id,lon:r.lon,lat:r.lat,box:{x:lt.x,y:lt.y,w,h}});
        }else{
          const width=compact?44:96,unitScale=compact?.32:.65;
          // These are basin-average symbols, not point observations. Reserve a
          // stable full-series envelope so neither year changes nor the legend
          // hide a gauge. Geographic boxes and country fills stay unshifted.
          const values=r.years.map(y=>y.value).filter(Number.isFinite);
          const envelope={halfWidth:width*.6,above:Math.max(0,...values)*unitScale+(compact?41:56),below:-Math.min(0,...values)*unitScale+22};
          p.y=placeAtlasGauge(p,envelope,obstacles,bottom).y;
          const level=p.y-(Number.isFinite(v)?v:0)*unitScale;
          ctx.strokeStyle='#b3d7db45';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-width*.5,p.y);ctx.lineTo(p.x+width*.5,p.y);ctx.stroke();
          if(Number.isFinite(v)){
            const fill=ctx.createLinearGradient(0,Math.min(level,p.y),0,Math.max(level,p.y)+1);fill.addColorStop(0,color+'');fill.addColorStop(1,'#193c4d00');
            ctx.globalAlpha=a.alpha*.32;ctx.fillStyle=fill;ctx.fillRect(p.x-width*.5,Math.min(level,p.y),width,Math.abs(level-p.y));
            ctx.globalAlpha=a.alpha;ctx.strokeStyle=color;ctx.lineWidth=chosen?2.5:1.5;ctx.beginPath();ctx.moveTo(p.x-width*.5,level);ctx.lineTo(p.x+width*.5,level);ctx.stroke();
          }
          text(r.name,p.x,Math.min(p.y,level)-(compact?27:36),compact?12:18);
          text(`${v>0?'+':''}${atlasFormat(v)}${Number.isFinite(v)?' mm':''}`,p.x,Math.min(p.y,level)-9,compact?13:20);
          text('1993',p.x,p.y+16,compact?9:11,'#a6c6cd');
          points.push({...p,id:r.id,lon:r.lon,lat:r.lat,box:{x:p.x-width*.6,y:Math.min(p.y,level)-48,w:width*1.2,h:Math.abs(level-p.y)+70}});
        }
        ctx.restore();
      }
    }
    return {state:'ready',points};
  }
  function pick(ctx,clientX,clientY){
    if(!currentView||!currentData)return null;
    if(currentDefinition.view==='countries'){
      if(['electricity','drinking','sanitation','foresthistory','waterstress','cropland','yield','fertilizer','longevity','urban'].includes(currentDefinition.id)){
        const x=clientX-currentView.rect.left,y=clientY-currentView.rect.top;
        const labels=currentDefinition.id==='urban'?urbanMarks.filter(p=>!p.selected):currentDefinition.id==='longevity'?longevityMarks.filter(p=>!p.selected):currentDefinition.id==='fertilizer'?fertilizerMarks.filter(p=>!p.selected):currentDefinition.id==='yield'?yieldMarks.filter(p=>!p.selected):currentDefinition.id==='cropland'?croplandComparisons.filter(p=>!p.selected):currentDefinition.id==='waterstress'?stressMarks.filter(p=>!p.selected):currentDefinition.id==='foresthistory'?forestTrends.filter(p=>!p.selected):currentDefinition.id==='sanitation'?sanitationMarks.filter(p=>!p.selected):currentDefinition.id==='drinking'?drinkingReadings.filter(p=>!p.selected):electricityLabels;
        const label=labels.find(p=>p.alpha>=.9&&x>=p.bounds.left&&x<=p.bounds.right&&y>=p.bounds.top&&y<=p.bounds.bottom);
        if(label)return points.find(p=>p.id===label.id)||null;
      }
      const id=pickFoodCountry(ctx,currentShapes,currentView,clientX,clientY);return points.find(p=>p.id===id)||null;
    }
    const x=clientX-currentView.rect.left,y=clientY-currentView.rect.top;
    return points.find(p=>p.box&&x>=p.box.x&&x<=p.box.x+p.box.w&&y>=p.box.y&&y<=p.box.y+p.box.h)||points.find(p=>Math.hypot(x-p.x,y-p.y)<22)||null;
  }
  return {paint,pick,reset,geometry,getState:()=>({...gpu.state(),glyphs:glyphCount,diagramBounds,electricityLabels,drinkingReadings,sanitationMarks,forestTrends,stressMarks,stressHatched,croplandComparisons,yieldMarks,fertilizerMarks,longevityMarks,urbanMarks,style:currentDefinition?(currentDefinition.countryGlyphs===false?currentDefinition.view:ATLAS_GLYPH_TYPES[currentDefinition.id]||currentDefinition.view):null})};
}
