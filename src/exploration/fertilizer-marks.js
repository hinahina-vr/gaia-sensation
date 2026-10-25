import {fertilizerReading,fertilizerFormat,fertilizerDistribution} from './fertilizer-use.js?v=fertilizer-20261025';
import {layoutCroplandComparisons} from './cropland-comparison.js?v=whole-trends20-20261025';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function paintFertilizerMarks(ctx,candidates,options){
 const {compact,year,alpha,data}=options,distribution=fertilizerDistribution(data,year);
 ctx.font='11px serif';const marks=layoutCroplandComparisons(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
 for(const p of marks){
  const b=p.bounds,w=b.right-b.left,h=b.bottom-b.top,value=fertilizerReading(p.region,year).value,color=value===null?'#a8b9bc':'#e9d4a7',x=b.left+10;
  ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='alphabetic';ctx.shadowColor='#031820';ctx.shadowBlur=5;
  const ink=(s,tx,ty,size,c)=>{ctx.font=size+'px serif';ctx.fillStyle=c;ctx.fillText(s,tx,ty);};
  if(p.selected){
   ctx.strokeStyle='#d3ddb46b';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
   ctx.save();ctx.translate((b.left+b.right)/2,(b.top+b.bottom)/2);ctx.scale(w/2,h/2);const wash=ctx.createRadialGradient(0,0,.1,0,0,1);wash.addColorStop(0,'#071c22ed');wash.addColorStop(.65,'#071c22c2');wash.addColorStop(1,'#071c2200');ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
   ctx.textAlign='left';let name=p.name;ctx.font=(compact?11:15)+'px serif';while(ctx.measureText(name).width>w-75)name=name.slice(0,-1);if(name!==p.name)name+='…';
   ink(name,x,b.top+(compact?12:18),compact?11:15,'#e2e9d5');ctx.textAlign='right';ink(year+'年',b.right-8,b.top+(compact?12:18),9,'#9fb5b3');ctx.textAlign='left';
   ink(fertilizerFormat(value)+(compact&&value!==null?' kg/ha':''),x,b.top+(compact?33:55),compact?19:31,color);
   if(!compact){ink('肥料成分 kg / 耕地 1 ha',x,b.top+74,10,'#b2c6b7');}
  }else{
   ctx.textAlign='center';let name=p.name;ctx.font='11px serif';while(ctx.measureText(name).width>w-10)name=name.slice(0,-1);
   ink(name,(b.left+b.right)/2,b.top+13,11,'#dce7d4');ink(fertilizerFormat(value)+' kg/ha',(b.left+b.right)/2,b.top+34,15,color);
  }
  if(!compact){
   const y=b.top+(p.selected?99:49),span=w-20,px=v=>x+clamp(v/500,0,1)*span;
   ctx.shadowBlur=0;const gradient=ctx.createLinearGradient(x,0,x+span,0);gradient.addColorStop(0,'#356b70');gradient.addColorStop(.5,'#aed4af');gradient.addColorStop(1,'#e4bc81');
   ctx.fillStyle=gradient;ctx.globalAlpha=alpha*.6;ctx.fillRect(x,y-2,span,3);ctx.globalAlpha=alpha;
   if(distribution.median!==null){ctx.strokeStyle='#e5eadd90';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px(distribution.median),y-6);ctx.lineTo(px(distribution.median),y+6);ctx.stroke();}
   if(value!==null){ctx.fillStyle='#fff0c1';ctx.beginPath();ctx.moveTo(px(value),y-4);ctx.lineTo(px(value)-4,y-11);ctx.lineTo(px(value)+4,y-11);ctx.closePath();ctx.fill();}
   if(p.selected){ctx.fillStyle='#b1c4b9';ctx.font='9px serif';ctx.textAlign='left';ctx.fillText('0',x,y+16);ctx.textAlign='right';ctx.fillText('500+ kg/ha',x+span,y+16);ctx.textAlign='center';ctx.fillText('縦線：同年の中央値 '+fertilizerFormat(distribution.median),x+span/2,b.top+133);}
  }
  ctx.restore();
 }
 return marks.map(p=>({id:p.id,selected:p.selected,bounds:p.bounds,anchor:{x:p.x,y:p.y},...fertilizerReading(p.region,year),median:distribution.median,alpha}));
}
