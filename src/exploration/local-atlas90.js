import {createGeographicAtlasView} from './geographic-atlas-view.js?v=surface-release-2e596f2-20261028';
import {createDrinkingMapView} from './drinking-map-view.js?v=surface-release-2e596f2-20261028';
import {createMapTextLayer} from './map-text-layer.js?v=country-text-halo-20261027';
import {createAtlasDataWebgl} from './atlas-data-webgl.js?v=release100-c363-20261027';
import {layoutDrinkingReadings} from './drinking-water-reading.js';
import {countrySourceId} from './country-source-ids.js';
import {paintExtent} from './local-extent-view.js?v=release100-c363-20261027';
import {sharedAtlas90Motion,atlas90Signal} from './atlas90-motion.js?v=surface-release-2e596f2-20261028';
import {paintExtentMotionMask} from './extent-motion-mask.js?v=release100-c363-20261027';
import {poiArrivalDuration} from './annual-poi-arrival.js';

const supported=new Set(['ageing','childsurvival','seaice','snowcover']);
export function createLocalAtlas90(){
 const geographic=createGeographicAtlasView();
 const gpu=createAtlasDataWebgl(),motion=sharedAtlas90Motion(),text=createMapTextLayer('local-extent');let kind='',points=[],currentView,glyphs=0;
 let baseCanvas,baseContext,mask,maskContext,cacheKey='',builds=0,paintCount=0,time=0,maskShapes=0;
 const countries=createDrinkingMapView({motionFactory:sharedAtlas90Motion,encodeMotionValue:atlas90Signal,sourceId:countrySourceId,uniquePoints:true,paintReadings(ctx,candidates,options){
  const {definition,year,compact,selectedId,width,height,obstacles}=options;
  const labels=layoutDrinkingReadings(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),{width,height,compact,selectedId,obstacles,gap:false});
  const instances=[];glyphs=0;
  for(const p of labels){
   const b=p.bounds,size=p.selected?(compact?15:27):14,x=p.selected?b.left+size+9:b.left+size+3,y=p.selected?b.top+(compact?17:48):b.top+20;
   const value=p.value,base=p.region?.years.find(r=>r.year===2000)?.value;
   if(!Number.isFinite(value))continue;
   const fraction=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v/(kind==='ageing'?100:1000))):-1;
   instances.push([x,y,size,size,fraction(value),fraction(base),p.selected?1:0,1,.75,.88,.91]);glyphs++;
  }
  const gpuDrawn=gpu.paint(ctx,instances,{width,height,ratio:Math.min(1,Math.sqrt(1e6/(width*height))),kind:kind==='ageing'?7:8});
  for(const p of labels){
   const b=p.bounds,size=p.selected?(compact?15:27):14,x=p.selected?b.left+size+9:b.left+size+3,y=p.selected?b.top+(compact?17:48):b.top+20;
   ctx.save();
   if(!gpuDrawn&&Number.isFinite(p.value)){
    if(kind==='ageing'){for(let i=0;i<100;i++){ctx.fillStyle=i<p.value?'#e1d8f2':'#6d7b8e';ctx.globalAlpha=i<p.value?1:.32;ctx.beginPath();ctx.arc(x-size+(i%10+.5)*size/5,y-size+(Math.floor(i/10)+.5)*size/5,size*.055,0,Math.PI*2);ctx.fill();}}
    else{ctx.strokeStyle='#d4eae5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,size*.8,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-Math.min(1,p.value/1000)));ctx.stroke();const base=p.region?.years.find(r=>r.year===2000)?.value;if(Number.isFinite(base)){ctx.strokeStyle='#e4c9a5';ctx.lineWidth=1;ctx.setLineDash([2,2]);ctx.beginPath();ctx.arc(x,y,size,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-Math.min(1,base/1000)));ctx.stroke();}}
   }
   ctx.globalAlpha=1;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.shadowColor='#051720';ctx.shadowBlur=5;ctx.fillStyle='#dfeeee';ctx.font=`${compact?10:12}px serif`;ctx.fillText(p.name,x+size+8,y-4,Math.max(20,b.right-x-size-10));ctx.font=`${compact?14:19}px serif`;ctx.fillText(Number.isFinite(p.value)?p.value.toLocaleString('ja-JP',{maximumFractionDigits:1})+(kind==='ageing'?'%':'‰'):'欠測',x+size+8,y+17);ctx.restore();
  }
  return labels.map(p=>({id:p.id,selected:p.selected,value:p.value,bounds:p.bounds,anchor:{x:p.x,y:p.y}}));
 }});
 addEventListener('gaia:atlas-renderer-change',()=>{if(kind==='ageing'||kind==='childsurvival')countries.reset()});
 return {
  has:id=>supported.has(id),
  geometry:()=>countries.geometry(),
  paint(ctx,options){kind=options.definition.id;currentView=options.view;
   if(geographic.has(kind))return geographic.paint(ctx,options);if(geographic.active())geographic.reset();
   if(options.definition.view==='countries')return countries.paint(ctx,options);
   const {view,ratio,definition,year,month,selectedId,labelHost,elapsed,reduced,data}=options,{width,height}=view.rect;
   time=reduced?0:Math.max(0,elapsed)/1000;
   const obstacles=[...document.querySelectorAll('.gaia-climate-legend,.gaia-climate-readout,#map-stable-navigation,.japan-heading,#map-mobile-toolbar')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]});
   const arrival=!reduced&&elapsed<poiArrivalDuration(data.regions.length)?Math.floor(elapsed/42):'complete';
   const nextKey=JSON.stringify(['extent',definition.id,year,month,selectedId,width,height,ratio,view.x,view.y,view.scale,obstacles,arrival]);
   if(cacheKey!==nextKey){
    baseCanvas??=document.createElement('canvas');baseContext??=baseCanvas.getContext('2d');mask??=document.createElement('canvas');maskContext??=mask.getContext('2d');
    for(const c of [baseCanvas,mask]){c.width=Math.max(1,Math.round(width*ratio));c.height=Math.max(1,Math.round(height*ratio));}
    baseContext.setTransform(ratio,0,0,ratio,0,0);maskContext.setTransform(ratio,0,0,ratio,0,0);
    const surfaces=[];
    const result=text.record(baseContext,c=>paintExtent(c,{...options,onSurface:s=>surfaces.push(s)}),{host:labelHost,width,height,view,ratio,key:[definition.id,year,month,selectedId].join('/')});points=result.points;
    maskShapes=paintExtentMotionMask(maskContext,surfaces,{id:definition.id,month});cacheKey=nextKey;builds++;
   }
   ctx.drawImage(baseCanvas,0,0,width,height);motion.paint(ctx,mask,{view,sourceKey:cacheKey,time,definition,mode:'extent'});paintCount++;
   return {state:'ready',points};
  },
  pick(ctx,x,y){if(geographic.active())return geographic.pick(ctx,x,y);if(kind==='ageing'||kind==='childsurvival')return countries.pick(ctx,x,y);if(!currentView)return null;const dx=x-currentView.rect.left,dy=y-currentView.rect.top;return points.find(p=>dx>=p.box.x&&dx<=p.box.x+p.box.w&&dy>=p.box.y&&dy<=p.box.y+p.box.h)?.id||null},
  presentLabels(fade){if(geographic.active()){geographic.presentLabels(fade);return;}if(kind==='ageing'||kind==='childsurvival')countries.presentLabels(fade);else text.present(1,fade)},
  reset(){geographic.reset();countries.reset();text.reset();gpu.reset();motion.reset();for(const c of [baseCanvas,mask])if(c)c.width=c.height=1;cacheKey='';points=[];currentView=null;kind='';glyphs=0;time=0;maskShapes=0},
  getState:()=>geographic.active()?geographic.getState():kind==='ageing'||kind==='childsurvival'?{...countries.getState(),glyphEngine:gpu.state().engine,glyphContexts:gpu.state().contexts,glyphDraws:gpu.state().draws,glyphs}:{...motion.getState(),points:points.length,diagramBounds:points.map(p=>p.box),textLayer:text.getState(),builds,paintCount,time,maskShapes}
 };
}
