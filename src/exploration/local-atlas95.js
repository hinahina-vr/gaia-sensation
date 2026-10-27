import {createGeographicAtlasView} from './geographic-atlas-view.js?v=release100-c363-20261027';
import {paintCentury} from './atlas-century-view.js?v=release100-c363-20261027';
import {createAtlasDataWebgl} from './atlas-data-webgl.js?v=release100-c363-20261027';
import {createMapTextLayer} from './map-text-layer.js?v=country-text-halo-20261027';
import {earthLongitudeToMapX} from './world-projection.js?v=gaia-japan-center-1';
import {createAtlas95Motion} from './atlas95-motion.js?v=release100-c363-20261027';
import {paintCenturyMotionMask} from './century-motion-mask.js?v=release100-c363-20261027';
import {poiArrivalDuration} from './annual-poi-arrival.js';
import {foodCountryCopies} from './food-country-fill.js?v=whole-trends20-20261025';

const supported=new Set(['oceanheat','ozone','glaciers','volcanoes','tsunamis']);
export function createLocalAtlas95(){
 const geographic=createGeographicAtlasView();
 const gpu=createAtlasDataWebgl(),motion=createAtlas95Motion(),text=createMapTextLayer('local95');
 let result={points:[],glyphs:0,bounds:[]},baseCanvas,baseContext,mask,maskContext,cacheKey='',builds=0,paintCount=0,time=0,maskShapes=0;
 const invalidate=()=>{cacheKey=''};
 addEventListener('gaia:atlas-renderer-change',invalidate);
 return {
  has:id=>supported.has(id),
  paint(ctx,options){
   if(geographic.has(options.definition.id))return geographic.paint(ctx,options);if(geographic.active())geographic.reset();
   const {view,ratio,labelHost,definition,year,selectedId,elapsed,reduced,data}=options;
   const {width,height}=view.rect;
   const xy=(lon,lat)=>({x:view.x+earthLongitudeToMapX(lon)*view.scale,y:view.y+(90-lat)*view.scale});
   time=reduced?0:Math.max(0,elapsed)/1000;
   const adapter=globalThis.GaiaMapObservationAdapter,geometry=definition.id==='tsunamis'?adapter?.getCountryGeometry?.():null;
   const obstacles=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,#map-scope-note,.gaia-climate-readout,#map-mobile-toolbar,#map-mobile-bottom,#map-responsive-data')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]});
   const arrival=!reduced&&elapsed<poiArrivalDuration(data.events?.filter(e=>e.year===year).length||data.regions.length)?Math.floor(elapsed/42):'complete';
   const nextKey=JSON.stringify([definition.id,year,selectedId,width,height,ratio,view.x,view.y,view.scale,geometry?.state,obstacles,arrival]);
   if(cacheKey!==nextKey){
    baseCanvas??=document.createElement('canvas');baseContext??=baseCanvas.getContext('2d');mask??=document.createElement('canvas');mask.dataset.atlas95MotionMask='true';maskContext??=mask.getContext('2d');
    for(const c of [baseCanvas,mask]){c.width=Math.max(1,Math.round(width*ratio));c.height=Math.max(1,Math.round(height*ratio));}
    baseContext.setTransform(ratio,0,0,ratio,0,0);maskContext.setTransform(ratio,0,0,ratio,0,0);
    const surfaces=[];
    result=text.record(baseContext,c=>paintCentury(c,{...options,onSurface:s=>surfaces.push(s)},gpu,xy),{host:labelHost,width,height,view,ratio,key:[definition.id,year,selectedId].join('/')});
    maskShapes=paintCenturyMotionMask(maskContext,surfaces,{oceanOnly:geometry?.state==='ready'?c=>{
     c.save();c.globalCompositeOperation='destination-out';c.fillStyle='#000';
     for(const copy of foodCountryCopies({...view,originX:view.x,originY:view.y})){c.save();c.translate(copy.x,copy.y);c.scale(view.scale,view.scale);for(const country of geometry.countries){const path=adapter.getCountryPath(country.iso3);if(path)c.fill(path,'evenodd')}c.restore()}
     c.restore();
    }:null});cacheKey=nextKey;builds++;
   }
   ctx.drawImage(baseCanvas,0,0,width,height);motion.paint(ctx,mask,{view,sourceKey:cacheKey,time,definition,mode:'century'});paintCount++;
   return {state:'ready',points:result.points};
  },
  presentLabels:fade=>geographic.active()?geographic.presentLabels(fade):text.present(1,fade),
  reset(){geographic.reset();gpu.reset();motion.reset();text.reset();for(const c of [baseCanvas,mask])if(c)c.width=c.height=1;cacheKey='';time=maskShapes=0;result={points:[],glyphs:0,bounds:[]}},
  getState:()=>geographic.active()?geographic.getState():({...motion.getState(),glyphEngine:gpu.state().engine,glyphDraws:gpu.state().draws,glyphContexts:gpu.state().contexts,points:result.points.length,hitTargets:result.points.map(p=>({id:p.id,x:p.x,y:p.y,box:p.box})),glyphs:result.glyphs,diagramBounds:result.bounds,textLayer:text.getState(),builds,paintCount,time,maskShapes})
 };
}
