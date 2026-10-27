import {paintCountryAnnotations} from './map-country-annotations.js?v=release100-c363-20261027';
import{earthLongitudeToMapX}from'./world-projection.js?v=gaia-japan-center-1';
import{foodCountryCopies,pickFoodCountry}from'./food-country-fill.js?v=whole-trends20-20261025';
import{atlasColor,atlasRow}from'./atlas-history-model.js?v=release100-c363-20261027';
import{drinkingArrival,paintDrinkingReadings}from'./drinking-water-reading.js?v=release100-c363-20261027';
import{createMapTextLayer}from'./map-text-layer.js?v=country-text-halo-20261027';
import{createDrinkingMotion}from'./drinking-motion-webgl.js?v=release100-c363-20261027';
import{SELECTABLE_COUNTRIES}from'./country-selection.js?v=release100-c363-20261027';

export function createDrinkingMapView({sourceId=id=>id,sourceKey=()=>'',countryOverlay,uniquePoints=false,paintReadings=paintDrinkingReadings,waterMotion=false,selectable=false,motionFactory,encodeMotionValue}={}){
 const textLayer=createMapTextLayer('country-history');let textAlpha=0;
 const motion=motionFactory?motionFactory():waterMotion?createDrinkingMotion():null;let mask,maskCtx,time=0;
 let mappingKey='',source,shapes=[],view,regions,points=[],readings=[],surface,c,key='',labelsKey='',labelsCanvas,labelsCtx,paintCount=0,builds=0,state='idle',renderedMode=null;
 function geometry(){const a=globalThis.GaiaMapObservationAdapter,g=a?.getCountryGeometry?.(),records=(typeof selectable==='function'?selectable():selectable)?SELECTABLE_COUNTRIES:g?.countries;if(g?.state==='ready'&&(source!==records||mappingKey!==sourceKey())){source=records;mappingKey=sourceKey();shapes=records.map(s=>({...s,id:sourceId(s.iso3),path:a.getCountryPath(s.iso3)})).filter(s=>s.path);key=labelsKey=''}return g?.state||'loading'}
 function paint(ctx,{definition,data,comparison,original=data,services,year,mode,selectedId,view:next,ratio,elapsed,reduced,labelHost,readingKey=''}){
  view={...next,originX:next.x,originY:next.y,wrapX:definition.id==='foresthistory'};regions=new Map(data.regions.map(r=>[r.id,r]));state=geometry();if(state!=='ready')return{state,points:[]};
  const width=view.rect.width,height=view.rect.height,w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio)),nextKey=[definition.id,year,mode,w,h,view.x,view.y,view.scale].join('/');
  surface??=document.createElement('canvas');c??=surface.getContext('2d');
  if(key!==nextKey){
   surface.width=w;surface.height=h;c.setTransform(ratio,0,0,ratio,0,0);
   if(motion){mask??=document.createElement('canvas');maskCtx??=mask.getContext('2d');mask.width=w;mask.height=h;maskCtx.setTransform(ratio,0,0,ratio,0,0)}
   for(const target of motion?[c,maskCtx]:[c]){target.save();target.beginPath();target.rect(view.wrapX?0:view.x,view.y,view.wrapX?width:360*view.scale,180*view.scale);target.clip()}
   const originals=new Map(original.regions.map(r=>[r.id,r]));
   for(const s of shapes){
    const value=atlasRow(regions.get(s.id),year)?.value,access=atlasRow(originals.get(s.id),year)?.value;
    for(const copy of foodCountryCopies(view)){
     c.save();c.translate(copy.x,copy.y);c.scale(view.scale,view.scale);c.globalAlpha=Number.isFinite(value)?.82:.14;c.fillStyle=atlasColor(definition,value);c.fill(s.path,'evenodd');countryOverlay?.(c,{shape:s,value,definition,view});c.globalAlpha=.48;c.strokeStyle='#a1d7d5';c.lineWidth=.65/view.scale;c.stroke(s.path);c.restore();
     const signal=motion?(encodeMotionValue?encodeMotionValue({definition,value,access,mode,row:atlasRow(regions.get(s.id),year)}):Number.isFinite(value)&&Number.isFinite(access)?[Math.max(0,Math.min(100,access))/100,Math.max(0,Math.min(1,(mode==='gap'||mode==='basic-gap')?(value+50)/100:value/100)),0]:null):null;
     if(signal){
      maskCtx.save();maskCtx.translate(copy.x,copy.y);maskCtx.scale(view.scale,view.scale);
      maskCtx.fillStyle=`rgb(${signal.map(value=>Math.round(value*255)).join(',')})`;
      maskCtx.fill(s.path,'evenodd');maskCtx.restore();
     }
    }
   }
   c.restore();maskCtx?.restore();key=nextKey;builds++;
  }
  const obstacles=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>{const r=e.getBoundingClientRect();return{left:r.left-view.rect.left,right:r.right-view.rect.left,top:r.top-view.rect.top,bottom:r.bottom-view.rect.top}}),nextLabels=JSON.stringify([key,selectedId,obstacles,readingKey]);
  if(labelsKey!==nextLabels){labelsCanvas??=document.createElement('canvas');labelsCtx??=labelsCanvas.getContext('2d');labelsCanvas.width=w;labelsCanvas.height=h;labelsCtx.setTransform(ratio,0,0,ratio,0,0);
   points=shapes.filter(s=>regions.has(s.id)).map(s=>({id:s.id,lon:s.lon,lat:s.lat,x:view.x+earthLongitudeToMapX(s.lon)*view.scale,y:view.y+(90-s.lat)*view.scale}));if(uniquePoints)points=points.filter((p,i,list)=>list.findIndex(other=>other.id===p.id)===i);const pairs=new Map((comparison?.regions||[]).map(r=>[r.id,atlasRow(r,year)])),originals=new Map(original.regions.map(r=>[r.id,r]));
   // Keep the existing translucent wash above the selected border as well as
   // the base map. Otherwise the bright outline cuts through the SVG text.
   const selected=shapes.find(s=>s.id===selectedId);if(selected){labelsCtx.save();labelsCtx.beginPath();labelsCtx.rect(view.x,view.y,360*view.scale,180*view.scale);labelsCtx.clip();for(const copy of foodCountryCopies(view)){labelsCtx.save();labelsCtx.translate(copy.x,copy.y);labelsCtx.scale(view.scale,view.scale);labelsCtx.strokeStyle='#c7faf4';labelsCtx.lineWidth=1.6/view.scale;labelsCtx.shadowColor='#8acfd7';labelsCtx.shadowBlur=12;labelsCtx.stroke(selected.path);labelsCtx.restore()}labelsCtx.restore()}
   readings=textLayer.record(labelsCtx,textCtx=>(Number(definition.number)>=80?paintCountryAnnotations:paintReadings)(textCtx,points.map(p=>({...p,name:regions.get(p.id).name,region:originals.get(p.id),value:atlasRow(regions.get(p.id),year)?.value,urban:pairs.get(p.id)?.urban??null,rural:pairs.get(p.id)?.rural??null})),{width,height,compact:width<=900,selectedId,obstacles,year,gap:(mode==='gap'||mode==='basic-gap'),alpha:1,mode,original,services,definition}),{host:labelHost,width,height,view,ratio,key:[definition.id,year,mode,selectedId].join('/')});labelsKey=nextLabels;
  }
  textAlpha=drinkingArrival(0,1,elapsed,reduced);time=reduced?0:Math.max(0,elapsed)/1000;
  ctx.save();ctx.globalAlpha=textAlpha;ctx.drawImage(surface,0,0,width,height);
  if(motion)motion.paint(ctx,mask,{view,sourceKey:key,time,gap:(mode==='gap'||mode==='basic-gap'),definition,mode});
  ctx.drawImage(labelsCanvas,0,0,width,height);ctx.restore();paintCount++;renderedMode=mode;return{state,points};
 }
 return{geometry,paint,presentLabels:fade=>textLayer.present(textAlpha,fade),pick(ctx,x,y){if(!view)return null;const label=readings.find(p=>x-view.rect.left>=p.bounds.left&&x-view.rect.left<=p.bounds.right&&y-view.rect.top>=p.bounds.top&&y-view.rect.top<=p.bounds.bottom),id=label?.id||pickFoodCountry(ctx,shapes,view,x,y);return regions?.has(id)?id:null},reset(){motion?.reset();textLayer.reset();for(const canvas of[surface,labelsCanvas,mask])if(canvas)canvas.width=canvas.height=1;key=labelsKey='';view=regions=null;points=readings=[];time=0;renderedMode=null;state='idle'},getState:()=>({engine:'canvas2d',...motion?.getState(),geometry:state,paintCount,builds,time,renderedMode,drinkingReadings:readings,points:points.length,textLayer:textLayer.getState()})};
}
