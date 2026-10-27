const clamp=v=>Math.max(0,Math.min(1,v));
export function centuryMotionShapes(s){
 if(!(s.alpha>0))return [];
 const shape=(type,x,y,w,h,value,extra={})=>({type,x,y,w,h,signal:clamp(value),alpha:s.alpha,...extra});
 if(s.id==='oceanheat')return [[s.row?.upper,s.y-s.h,s.h*.7],[s.row?.deep,s.y-s.h+s.h*.7,s.h*1.3]].filter(([v])=>Number.isFinite(v)).map(([v,y,h])=>shape('rect',s.x-s.w*.84,y,s.w*1.68,h,(v+10)/20));
 if(s.id==='ozone')return Number.isFinite(s.row?.value)&&s.row.value>0?[shape('ring',s.x-s.h,s.y-s.h,s.h*2,s.h*2,s.row.value/30,{radius:s.h*.84*Math.sqrt(Math.min(1,s.row.value/30)),band:Math.max(5,s.h*.065)})]:[];
 if(s.id==='glaciers'){
  if(!Number.isFinite(s.row?.value)||s.row.value>=0||!s.path?.length)return [];
  return [shape('polygon',s.x-s.w,s.y-s.h,s.w*2,s.h*2,-s.row.value/30,{path:[[s.path[0][0],s.y-s.h],...s.path,[s.path.at(-1)[0],s.y-s.h]]})];
 }
 if(s.id==='volcanoes')return [shape('ellipse',s.x-s.size*1.2,s.y-s.size*2.8,s.size*2.4,s.size*3.8,Number.isFinite(s.value)?s.value/8:.1)];
 if(s.id==='tsunamis')return [shape('ellipse',s.x-s.size*2.6,s.y-s.size*2.6,s.size*5.2,s.size*5.2,Number.isFinite(s.value)?s.value/20:0)];
 return [];
}
export function paintCenturyMotionMask(ctx,surfaces,{oceanOnly}={}){
 let count=0;
 for(const surface of surfaces)for(const s of centuryMotionShapes(surface)){
  ctx.save();ctx.globalAlpha=1;ctx.beginPath();
  if(s.type==='rect')ctx.rect(s.x,s.y,s.w,s.h);
  if(s.type==='ellipse')ctx.ellipse(s.x+s.w/2,s.y+s.h/2,s.w/2,s.h/2,0,0,Math.PI*2);
  if(s.type==='ring'){ctx.arc(s.x+s.w/2,s.y+s.h/2,s.radius+s.band,0,Math.PI*2);ctx.arc(s.x+s.w/2,s.y+s.h/2,Math.max(0,s.radius-s.band),0,Math.PI*2,true);}
  if(s.type==='polygon'){s.path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
  ctx.clip();ctx.fillStyle=`rgb(${Math.round(s.signal*255)},0,0)`;ctx.fillRect(s.x,s.y,s.w,s.h);
  ctx.globalCompositeOperation='lighter';
  for(const [axis,color] of [[0,'0,255,0'],[1,'0,0,255']]){const g=ctx.createLinearGradient(s.x,s.y,s.x+(axis?0:s.w),s.y+(axis?s.h:0));g.addColorStop(0,'rgb(0,0,0)');g.addColorStop(1,`rgb(${color})`);ctx.fillStyle=g;ctx.fillRect(s.x,s.y,s.w,s.h);}
  ctx.globalCompositeOperation='destination-in';ctx.fillStyle=`rgba(0,0,0,${s.alpha})`;ctx.fillRect(s.x,s.y,s.w,s.h);
  ctx.restore();count++;
 }
 if(oceanOnly)oceanOnly(ctx);
 return count;
}
