const clamp=v=>Math.max(0,Math.min(1,v));
export function extentMotionShapes(surface,{id,month}){
 const {x,y,radius,max,alpha}=surface;
 if(!Number.isFinite(max)||max<=0||!Number.isFinite(alpha)||alpha<=0)return [];
 if(id==='seaice')return Number.isFinite(surface.value)&&surface.value>0?[{x,y,radius:surface.size,start:0,end:Math.PI*2,sector:false,alpha,signal:[clamp(surface.value/max),1,0]}]:[];
 if(id!=='snowcover')return [];
 return surface.values.flatMap((value,index)=>{
  if(!Number.isFinite(value)||value<=0)return [];
  const start=-Math.PI/2+index*Math.PI/6+.018;
  return [{x,y,radius:radius*Math.sqrt(value/max),start,end:start+Math.PI/6-.036,sector:true,alpha,signal:[clamp(value/max),index+1===month?1:.3,0]}];
 });
}
export function paintExtentMotionMask(ctx,surfaces,options){
 let count=0;
 for(const surface of surfaces)for(const shape of extentMotionShapes(surface,options)){
  ctx.globalAlpha=shape.alpha;ctx.fillStyle=`rgb(${shape.signal.map(v=>Math.round(v*255)).join(',')})`;ctx.beginPath();if(shape.sector)ctx.moveTo(shape.x,shape.y);ctx.arc(shape.x,shape.y,shape.radius,shape.start,shape.end);ctx.closePath();ctx.fill();count++;
 }
 ctx.globalAlpha=1;return count;
}
