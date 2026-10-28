import {earthLongitudeToMapX} from './world-projection.js?v=gaia-japan-center-1';
import {foodCountryCopies,pickFoodCountry} from './food-country-fill.js?v=whole-trends20-20261025';
import {atlasColor,atlasRow} from './atlas-history-model.js?v=release100-c363-20261027';
import {electricityArrival,paintElectricityLabels} from './electricity-country-marks.js?v=release100-c363-20261027';
import {createElectricityLabelLayer} from './electricity-label-layer.js?v=release100-c363-20261027';
import {createElectricityMotion} from './electricity-motion-webgl.js?v=surface-release-2e596f2-20261028';

export function createElectricityMapView(){
 const motion=createElectricityMotion(),labelLayer=createElectricityLabelLayer();let labelAlpha=0;
 let geometrySource,shapes=[],view,regions,points=[],labels=[],base,baseCtx,signal,signalCtx,labelCanvas,labelCtx,sceneKey='',labelKey='',baseBuilds=0,labelBuilds=0,paintCount=0,time=0,state='idle';
 const countrySeed=id=>[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))%251,7);
 function geometry(){
  const adapter=globalThis.GaiaMapObservationAdapter,g=adapter?.getCountryGeometry?.();
  if(g?.state==='ready'&&geometrySource!==g.countries){geometrySource=g.countries;shapes=g.countries.map(s=>({...s,id:s.iso3,path:adapter.getCountryPath(s.iso3)})).filter(s=>s.path);sceneKey=labelKey='';}
  return g?.state||'loading';
 }
 function paint(ctx,{definition,data,original,year,mode,selectedId,view:next,ratio=1,elapsed,reduced,labelHost}){
  view={...next,originX:next.x,originY:next.y};regions=new Map(data.regions.map(r=>[r.id,r]));state=geometry();if(state!=='ready')return{state,points:[]};
  const width=view.rect.width,height=view.rect.height,r=Math.min(ratio,1440/width),w=Math.max(1,Math.round(width*r)),h=Math.max(1,Math.round(height*r)),key=[year,mode,w,h,view.x,view.y,view.scale].join('/');
  base??=document.createElement('canvas');baseCtx??=base.getContext('2d');signal??=document.createElement('canvas');signalCtx??=signal.getContext('2d');
  if(sceneKey!==key){
   base.width=signal.width=w;base.height=signal.height=h;baseCtx.setTransform(r,0,0,r,0,0);signalCtx.setTransform(r,0,0,r,0,0);
   for(const c of [baseCtx,signalCtx]){c.save();c.beginPath();c.rect(view.x,view.y,360*view.scale,180*view.scale);c.clip();}
   const originalById=new Map(original.regions.map(r=>[r.id,r]));
   for(const s of shapes){
    const region=regions.get(s.id),value=atlasRow(region,year)?.value,access=atlasRow(originalById.get(s.id),year)?.value,finite=Number.isFinite(value),f=mode==='change'?(value+50)/100:value/100;
    for(const copy of foodCountryCopies(view)){
     for(const c of [baseCtx,signalCtx]){c.save();c.translate(copy.x,copy.y);c.scale(view.scale,view.scale);}
     baseCtx.fillStyle=atlasColor(definition,value);baseCtx.globalAlpha=finite?.42:.14;baseCtx.fill(s.path,'evenodd');
     baseCtx.strokeStyle='#9bc9c366';baseCtx.lineWidth=.5/view.scale;baseCtx.globalAlpha=.45;baseCtx.stroke(s.path);
     if(finite&&Number.isFinite(access)){signalCtx.fillStyle='rgb('+Math.round(Math.max(0,Math.min(1,f))*255)+','+Math.round(Math.max(0,Math.min(100,access))*2.55)+','+countrySeed(s.id)+')';signalCtx.fill(s.path,'evenodd');}
     baseCtx.restore();signalCtx.restore();
    }
   }
   baseCtx.restore();signalCtx.restore();sceneKey=key;baseBuilds++;
  }
  const localRect=e=>{const b=e.getBoundingClientRect();return{left:b.left-view.rect.left,right:b.right-view.rect.left,top:b.top-view.rect.top,bottom:b.bottom-view.rect.top}};
  const obstacles=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);
  const nextLabelKey=JSON.stringify([key,selectedId,obstacles]);
  if(labelKey!==nextLabelKey){
   labelCanvas??=document.createElement('canvas');labelCtx??=labelCanvas.getContext('2d');labelCanvas.width=w;labelCanvas.height=h;labelCtx.setTransform(r,0,0,r,0,0);
   points=shapes.filter(s=>regions.has(s.id)).map(s=>({id:s.id,lon:s.lon,lat:s.lat,x:view.x+earthLongitudeToMapX(s.lon)*view.scale,y:view.y+(90-s.lat)*view.scale}));
   const candidates=points.filter(p=>p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height).map(p=>{const region=regions.get(p.id);return{...p,name:region.name,value:atlasRow(region,year)?.value,baseline:atlasRow(region,2000)?.value}});
   labels=paintElectricityLabels(labelCtx,candidates,{width,height,compact:width<=900,selectedId,obstacles,year,change:mode==='change',alpha:1,draw:false});
   labelLayer.update(labels,{host:labelHost,width,height,view,compact:width<=900,year,change:mode==='change',measure:(text,size)=>{labelCtx.font=`${size}px serif`;return labelCtx.measureText(text).width;}});
   const chosen=shapes.find(s=>s.id===selectedId);
   if(chosen)for(const copy of foodCountryCopies(view)){labelCtx.save();labelCtx.translate(copy.x,copy.y);labelCtx.scale(view.scale,view.scale);labelCtx.strokeStyle='#ffe9b4';labelCtx.lineWidth=1.5/view.scale;labelCtx.stroke(chosen.path,'evenodd');labelCtx.restore();}
   labelKey=nextLabelKey;labelBuilds++;
  }
  const alpha=electricityArrival(0,1,elapsed,reduced);labelAlpha=alpha;time=reduced?0:Math.max(0,elapsed)/1000;
  ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(base,0,0,width,height);motion.paint(ctx,signal,{view,sourceKey:sceneKey,time,change:mode==='change'});ctx.drawImage(labelCanvas,0,0,width,height);ctx.restore();paintCount++;
  return{state,points};
 }
 function pick(ctx,x,y){
  if(!view)return null;const lx=x-view.rect.left,ly=y-view.rect.top,label=labels.find(p=>lx>=p.bounds.left&&lx<=p.bounds.right&&ly>=p.bounds.top&&ly<=p.bounds.bottom);
  const id=label?.id||pickFoodCountry(ctx,shapes,view,x,y);return id&&regions?.has(id)?id:null;
 }
 return{paint,pick,geometry,presentLabels:fade=>labelLayer.present(labelAlpha,fade),reset(){motion.reset();labelLayer.reset();for(const c of [base,signal,labelCanvas])if(c)c.width=c.height=1;sceneKey=labelKey='';view=null;points=[];labels=[];regions=null;time=0;state='idle';},getState:()=>({...motion.getState(),geometry:state,paintCount,baseBuilds,labelBuilds,time,points:points.length,electricityLabels:labels,labelLayer:labelLayer.getState()})};
}
