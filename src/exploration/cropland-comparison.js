import {croplandReading,croplandSigned} from './cropland-history.js?v=whole-trends20-20261025';

export const CROPLAND_ARRIVAL_MS=1100;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const overlaps=(a,b,gap=3)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
const percent=v=>v===null?'欠測':`${v.toLocaleString('ja-JP',{maximumFractionDigits:1})}%`;
export function croplandArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;if(reduced)return 1;
  const t=clamp((elapsed-(count>1?index/(count-1)*240:0))/860,0,1);return t*t*(3-2*t);
}
// Every country uses the same 0–100% land denominator. These positions are
// a comparison diagram attached to the country, never locations of fields.
export function croplandComparison(region,year){
  const reading=croplandReading(region,year);
  return {...reading,basePosition:reading.base===null?null:reading.base/100,currentPosition:reading.value===null?null:reading.value/100};
}
export function layoutCroplandComparisons(candidates,{width,height,compact,selectedId,obstacles=[]}){
  const placed=[],chosen=candidates.find(p=>p.id===selectedId);
  const clear=b=>b.left>=8&&b.right<=width-8&&b.top>=8&&b.bottom<=height-8&&!obstacles.some(o=>overlaps(b,o,3))&&!placed.some(p=>overlaps(b,p.bounds,12));
  if(chosen&&chosen.x>=0&&chosen.x<=width&&chosen.y>=0&&chosen.y<=height){
    const w=compact?174:248,h=compact?36:136;
    const xs=[chosen.x+25,chosen.x-w-25,clamp(chosen.x-w/2,8,width-w-8)],ys=[chosen.y-h/2,...obstacles.flatMap(b=>[b.bottom+4,b.top-h-4])];
    const boxes=xs.flatMap((x,i)=>ys.map(y=>({left:x,right:x+w,top:y,bottom:y+h,score:Math.abs(y+h/2-chosen.y)+i*12}))).filter(clear).sort((a,b)=>a.score-b.score);
    if(boxes.length)placed.push({...chosen,selected:true,bounds:boxes[0]});
  }
  if(compact)return placed;
  const center=chosen||{x:width/2,y:height/2};
  for(const p of candidates.filter(p=>p.id!==selectedId).sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)||a.id.localeCompare(b.id))){
    if(placed.length>=7)break;
    const w=clamp(p.labelWidth+12,104,148),b={left:p.x-w/2,right:p.x+w/2,top:p.y-27,bottom:p.y+37};
    if(clear(b))placed.push({...p,selected:false,bounds:b});
  }
  return placed;
}
const fit=(c,s,w)=>{let t=s;while(t.length&&c.measureText(t+(t===s?'':'…')).width>w)t=t.slice(0,-1);return t+(t===s?'':'…');};
export function paintCroplandComparisons(ctx,candidates,options){
  const {compact,year,mode,alpha}=options;ctx.font='11px serif';
  const marks=layoutCroplandComparisons(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of marks){
    const b=p.bounds,w=b.right-b.left,h=b.bottom-b.top,r=croplandComparison(p.region,year),value=mode==='change'?r.change:r.value;
    const color=value===null?'#acbcc3':mode==='change'&&value<0?'#9edcf1':'#f5d393';
    const label=mode==='change'?`${croplandSigned(value)}${value===null?'':' pt'}`:percent(value);
    ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='alphabetic';
    const ink=(s,x,y,size,c)=>{ctx.font=`${size}px serif`;ctx.fillStyle=c;ctx.fillText(s,x,y);};
    if(p.selected){
      ctx.strokeStyle='#d8dcbd55';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
      ctx.save();ctx.translate((b.left+b.right)/2,(b.top+b.bottom)/2);ctx.scale(w/2,h/2);const wash=ctx.createRadialGradient(0,0,.1,0,0,1);wash.addColorStop(0,'#071924f2');wash.addColorStop(.6,'#071924c2');wash.addColorStop(1,'#07192400');ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
      ctx.shadowColor='#041522';ctx.shadowBlur=5;ctx.textAlign='left';ctx.font=`${compact?11:15}px serif`;
      ink(fit(ctx,p.name,w-72),b.left+8,b.top+(compact?12:18),compact?11:15,'#e5e9df');ctx.textAlign='right';ink(`${year}年`,b.right-8,b.top+(compact?12:18),9,'#b3c4c6');ctx.textAlign='left';
      ink(label,b.left+8,b.top+(compact?33:53),compact?21:32,color);
      if(!compact){
        ink(`2000  ${percent(r.base)}`,b.left+8,b.top+76,11,'#c0ccca');ctx.textAlign='right';ink(`${year}  ${percent(r.value)}`,b.right-8,b.top+76,11,color);
      }
    }else{
      ctx.textAlign='center';ctx.shadowColor='#041522';ctx.shadowBlur=5;ctx.font='11px serif';const x=(b.left+b.right)/2;
      ink(fit(ctx,p.name,w-8),x,b.top+12,11,'#e0e8df');ink(label,x,b.top+32,17,color);
    }
    if(!compact){
      const left=b.left+(p.selected?12:10),span=w-(p.selected?24:20),y=b.top+(p.selected?94:49),a=r.basePosition===null?null:left+span*r.basePosition,z=r.currentPosition===null?null:left+span*r.currentPosition;
      ctx.shadowBlur=0;ctx.lineWidth=1;ctx.strokeStyle='#9db8bf50';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+span,y);ctx.stroke();
      for(const t of [0,.25,.5,.75,1]){ctx.beginPath();ctx.moveTo(left+span*t,y-2);ctx.lineTo(left+span*t,y+3);ctx.stroke();}
      if(a!==null&&z!==null){ctx.strokeStyle=color;ctx.lineWidth=p.selected?3:2;ctx.beginPath();ctx.moveTo(a,y);ctx.lineTo(z,y);ctx.stroke();}
      if(a!==null){ctx.fillStyle='#0b222c';ctx.strokeStyle='#d0d5c4';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(a,y,p.selected?3.5:2.5,0,Math.PI*2);ctx.fill();ctx.stroke();}
      if(z!==null){ctx.shadowBlur=p.selected?8:4;ctx.shadowColor=color;ctx.fillStyle=color;ctx.beginPath();ctx.arc(z,y,p.selected?3.1:2.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
      if(p.selected){
        ctx.textAlign='left';ink('0',left,b.top+111,9,'#a0b6bd');ctx.textAlign='center';ink('陸地に占める耕地',left+span/2,b.top+111,10,'#b6c6c5');ctx.textAlign='right';ink('100%',left+span,b.top+111,9,'#a0b6bd');
        ctx.textAlign='left';ink('○ 2000年   ● 選択年 · 全ての国で共通目盛',b.left+8,b.top+131,9,'#a4b9bf');
      }
    }
    ctx.restore();
  }
  return marks.map(p=>({id:p.id,selected:p.selected,bounds:p.bounds,anchor:{x:p.x,y:p.y},...croplandComparison(p.region,year),mode,alpha}));
}
