import {longevityReading,longevityFormat,longevitySigned,longevityName,longevityHistory,longevityDomain} from './longevity-comparison.js?v=whole-trends20-20261025';
import {layoutCroplandComparisons} from './cropland-comparison.js?v=whole-trends20-20261025';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function paintLongevityMarks(ctx,candidates,options){
 const {compact,year,alpha,comparison}=options;
 ctx.font='11px serif';const marks=layoutCroplandComparisons(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
 for(const p of marks){
  const b=p.bounds,w=b.right-b.left,h=b.bottom-b.top,r=longevityReading(p.region,year),domain=longevityDomain(p.region,comparison);
  ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='alphabetic';ctx.shadowColor='#07121e';ctx.shadowBlur=5;
  const ink=(s,x,y,size,color)=>{ctx.font=size+'px serif';ctx.fillStyle=color;ctx.fillText(s,x,y);};
  if(p.selected){
   ctx.strokeStyle='#b6dcf27a';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
   ctx.save();ctx.translate((b.left+b.right)/2,(b.top+b.bottom)/2);ctx.scale(w/2,h/2);const wash=ctx.createRadialGradient(0,0,.1,0,0,1);wash.addColorStop(0,'#091825ed');wash.addColorStop(.65,'#091825c2');wash.addColorStop(1,'#09182500');ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
   ctx.textAlign='left';let name=p.name;ctx.font=(compact?11:15)+'px serif';while(ctx.measureText(name).width>w-75)name=name.slice(0,-1);if(name!==p.name)name+='…';
   ink(name,b.left+8,b.top+(compact?12:18),compact?11:15,'#d8eaf6');ctx.textAlign='right';ink(year+'年',b.right-8,b.top+(compact?12:18),9,'#9fb3c8');ctx.textAlign='left';
   ink(longevityFormat(r.value)+(r.value===null?'':' 年'),b.left+8,b.top+(compact?33:55),compact?20:31,'#c7eafa');
   if(!compact){
    ctx.textAlign='right';ink('2000年比',b.right-10,b.top+35,9,'#a9bdd0');ink(longevitySigned(r.change)+(r.change===null?'':' 年'),b.right-10,b.top+54,14,r.change<0?'#e2b998':'#bddce9');
    const left=b.left+29,right=b.right-9,top=b.top+76,bottom=b.top+117,x=yr=>left+(yr-2000)/24*(right-left),y=v=>bottom-(v-domain[0])/(domain[1]-domain[0])*(bottom-top);
    ctx.shadowBlur=0;ctx.strokeStyle='#b6cde62c';ctx.lineWidth=.8;
    for(const v of domain){ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();ctx.textAlign='right';ink(String(v),left-4,y(v)+3,8,'#a2b9c8');}
    for(const [region,color] of [[comparison,'#e1be97'],[p.region,'#b8dff4']]){
     const trace=longevityHistory(region);ctx.strokeStyle=color;ctx.lineWidth=1.5;
     for(const [a,z] of trace.segments){ctx.globalAlpha=alpha*(z.year<=year?1:.3);ctx.beginPath();ctx.moveTo(x(a.year),y(a.value));ctx.lineTo(x(z.year),y(z.value));ctx.stroke();}
     const selected=trace.points.find(q=>q.year===year);ctx.globalAlpha=alpha;if(selected){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(year),y(selected.value),2.4,0,Math.PI*2);ctx.fill();}
    }
    ctx.textAlign='left';ink('2000',left,bottom+13,8,'#a2b9c8');ctx.textAlign='right';ink('2024',right,bottom+13,8,'#a2b9c8');ctx.textAlign='center';ink('比較：'+longevityName(comparison),(left+right)/2,b.top+70,8,'#e1be97');
   }
  }else{
   const x=(b.left+b.right)/2;ctx.textAlign='center';let name=p.name;ctx.font='11px serif';while(ctx.measureText(name).width>w-8)name=name.slice(0,-1);
   ink(name,x,b.top+13,11,'#cedfe9');ink(longevityFormat(r.value)+' 年',x,b.top+37,22,'#ceeafb');ink('2000比 '+longevitySigned(r.change),x,b.top+56,10,r.change<0?'#dfb899':'#a4c6d6');
  }
  ctx.restore();
 }
 return marks.map(p=>({id:p.id,selected:p.selected,bounds:p.bounds,anchor:{x:p.x,y:p.y},...longevityReading(p.region,year),comparisonId:comparison?.id,domain:longevityDomain(p.region,comparison),alpha}));
}
