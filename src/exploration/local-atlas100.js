import {createAtlas100Motion,atlas100Signal} from './atlas100-motion.js?v=release100-c363-20261027';
import {createDrinkingMapView} from './drinking-map-view.js?v=release100-c363-20261027';
import {layoutDrinkingReadings} from './drinking-water-reading.js';
import {createAtlasDataWebgl,ATLAS_GLYPH_TYPES} from './atlas-data-webgl.js?v=release100-c363-20261027';
import {atlasRow,atlasFormat} from './atlas-history-model.js?v=release100-c363-20261027';
import {centuryValue} from './atlas-century-model.js?v=release100-c363-20261027';
import {countrySourceId} from './country-source-ids.js';

const supported=new Set(['wateruse','hunger','fisheries','internet','refugees']);
const clamp=v=>Math.max(0,Math.min(1,v));
export function centuryCountryGlyph(definition,row,fishMax=1){
 if(!Number.isFinite(row?.value)||row.invalidComposition)return null;
 const id=definition.id,value=row.value;
 const fraction=id==='hunger'?value/100:(value-definition.range[0])/(definition.range[1]-definition.range[0]);
 const extras=id==='wateruse'?[row.agriculture/100,row.industry/100,row.domestic/100,0]:id==='hunger'?[row.censored?1:0,0,0,0]:id==='fisheries'?[row.capture/fishMax,row.aquaculture/fishMax,0,0]:[0,0,0,0];
 if(extras.some(v=>!Number.isFinite(v)))return null;
 return {kind:ATLAS_GLYPH_TYPES[id],fraction:Math.max(0,fraction),extras};
}
function fallback(ctx,id,row,x,y,size,fishMax){
 ctx.save();ctx.translate(x,y);ctx.strokeStyle='#b8e4df';ctx.lineWidth=1.5;
 if(id==='wateruse'){
  for(const [i,value] of [row.agriculture,row.industry,row.domestic].entries()){ctx.strokeStyle=['#a9d99c','#92b8e3','#d9c79d'][i];ctx.lineWidth=Math.max(.7,value/100*size*.30);ctx.beginPath();ctx.moveTo(0,size*.8);ctx.bezierCurveTo(0,0,(i-1)*size*.6,0,(i-1)*size*.6,-size*.8);ctx.stroke();}
 }else if(id==='hunger'){
  ctx.beginPath();ctx.arc(0,0,size*.78,-Math.PI/2+clamp(row.value/100)*Math.PI*2,Math.PI*1.5);ctx.stroke();
  if(row.censored){ctx.save();ctx.beginPath();ctx.arc(0,0,size*.78,0,Math.PI*2);ctx.clip();ctx.globalAlpha=.45;for(let i=-2;i<3;i++){ctx.beginPath();ctx.moveTo(-size,i*size*.3);ctx.lineTo(size,i*size*.3+size);ctx.stroke()}ctx.restore();}
 }else if(id==='fisheries'){
  for(const [i,value] of [row.capture,row.aquaculture].entries()){const radius=size*.85*Math.sqrt(Math.max(0,value/fishMax)),xx=(i-.5)*size;ctx.fillStyle=i?'#a5e3b5':'#6ec5e8';ctx.beginPath();ctx.moveTo(xx,-radius);ctx.lineTo(xx+radius,0);ctx.lineTo(xx,radius);ctx.lineTo(xx-radius,0);ctx.closePath();ctx.fill();}
 }else if(id==='internet'){
  const value=clamp(row.value/100)*5;
  for(let i=0;i<5;i++){const yy=-size*.72+i*size*.36,part=clamp(value-i);ctx.strokeStyle='#516a7f';ctx.beginPath();ctx.moveTo(-size*.8,yy);ctx.lineTo(size*.8,yy);ctx.stroke();ctx.strokeStyle='#d1ceee';ctx.beginPath();ctx.moveTo(i%2?size*.8:-size*.8,yy);ctx.lineTo((i%2?1:-1)*size*.8*(1-2*part),yy);ctx.stroke();}
 }else{const r=size*.8*Math.sqrt(Math.max(0,row.value/7000000));ctx.strokeStyle='#8b7f8e';ctx.strokeRect(-size*.95,-size*.92,size*.22,size*1.84);ctx.fillStyle='#d4c5be';ctx.globalAlpha=.5;ctx.fillRect(-r,-r,r*2,r*2);}
 ctx.restore();
}
export function createLocalAtlas100(){
 const gpu=createAtlasDataWebgl(),motion=createAtlas100Motion();let kind='',dataRef,fishMax=1,glyphs=0;
 const countries=createDrinkingMapView({motionFactory:()=>motion,encodeMotionValue:args=>atlas100Signal({...args,fishMax}),sourceId:countrySourceId,uniquePoints:true,paintReadings(ctx,candidates,options){
  const {definition,year,compact,selectedId,width,height,obstacles}=options;
  const labels=layoutDrinkingReadings(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),{width,height,compact,selectedId,obstacles,gap:false});
  const instances=[],marks=[];
  for(const p of labels){
   const row=atlasRow(p.region,year),signal=centuryCountryGlyph(definition,row,fishMax),b=p.bounds,size=p.selected?(compact?18:28):14,x=b.left+size+8,y=p.selected?b.top+(compact?22:46):b.top+20;
   marks.push({p,row,signal,x,y,size});
   if(signal)instances.push([x,y,kind==='fisheries'?size*1.45:size,size,signal.fraction,0,p.selected?1:0,1,.75,.85,.86,...signal.extras]);
  }
  glyphs=instances.length;const drawn=gpu.paint(ctx,instances,{width,height,ratio:Math.min(1,Math.sqrt(1e6/(width*height))),kind:ATLAS_GLYPH_TYPES[kind]});
  for(const {p,row,signal,x,y,size} of marks){
   if(!drawn&&signal)fallback(ctx,kind,row,x,y,size,fishMax);
   ctx.save();ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.shadowColor='#051720';ctx.shadowBlur=5;ctx.fillStyle=Number.isFinite(row?.value)?'#dfeeee':'#93a4ab';
   const left=x+size*(kind==='fisheries'?1.45:1)+9,max=Math.max(24,p.bounds.right-left-7);
   ctx.font=`${compact?10:12}px serif`;ctx.fillText(p.name,left,y-5,max);ctx.font=`${p.selected?(compact?14:20):13}px serif`;ctx.fillText(centuryValue(definition,row,atlasFormat),left,y+17,max);ctx.restore();
  }
  return labels.map(p=>({id:p.id,selected:p.selected,value:p.value,bounds:p.bounds,anchor:{x:p.x,y:p.y}}));
 }});
 addEventListener('gaia:atlas-renderer-change',()=>countries.reset());
 return {
  has:id=>supported.has(id),geometry:()=>countries.geometry(),
  paint(ctx,options){kind=options.definition.id;if(dataRef!==options.data){dataRef=options.data;if(kind==='fisheries')fishMax=Math.max(1,...dataRef.regions.flatMap(r=>r.years.flatMap(y=>[y.capture,y.aquaculture]).filter(Number.isFinite)))}return countries.paint(ctx,options)},
  pick:(ctx,x,y)=>countries.pick(ctx,x,y),presentLabels:fade=>countries.presentLabels(fade),
  reset(){countries.reset();gpu.reset();glyphs=0;dataRef=null},
  getState:()=>({...countries.getState(),glyphEngine:gpu.state().engine,glyphDraws:gpu.state().draws,glyphContexts:gpu.state().contexts,theme:kind,glyphs,fishMax})
 };
}
