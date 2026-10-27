import {waterStressReading,waterStressScale,waterStressColor,WATER_STRESS_LEVELS} from './water-stress.js?v=release100-c363-20261027';

export const STRESS_ARRIVAL_MS=1100;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlap=(a,b,gap=3)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
const number=v=>v===null?'欠測':v.toLocaleString('ja-JP',{maximumFractionDigits:1});
export function stressArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;if(reduced)return 1;
  const t=clamp((elapsed-(count>1?index/(count-1)*240:0))/860,0,1);return t*t*(3-2*t);
}
export function stressBalance(region,year){
  const reading=waterStressReading(region,year),max=waterStressScale(region);
  return {...reading,max,resource:100/max,withdrawal:reading.value===null?null:reading.value/max,multiple:reading.value===null?null:reading.value/100};
}
export function layoutStressMarks(candidates,{width,height,compact,selectedId,obstacles=[]}){
  const placed=[],chosen=candidates.find(p=>p.id===selectedId);
  const clear=b=>b.left>=8&&b.right<=width-8&&b.top>=8&&b.bottom<=height-8&&!obstacles.some(o=>overlap(b,o,2))&&!placed.some(p=>overlap(b,p.bounds,12));
  if(chosen&&chosen.x>=0&&chosen.x<=width&&chosen.y>=0&&chosen.y<=height){
    const w=compact?174:244,h=compact?36:164;
    const xs=[chosen.x+25,chosen.x-w-25,clamp(chosen.x-w/2,8,width-w-8)],ys=[chosen.y-h/2,...obstacles.flatMap(b=>[b.bottom+3,b.top-h-3])];
    const boxes=xs.flatMap((x,i)=>ys.map(y=>({left:x,right:x+w,top:y,bottom:y+h,score:Math.abs(y+h/2-chosen.y)+i*12}))).filter(clear).sort((a,b)=>a.score-b.score);
    if(boxes.length)placed.push({...chosen,selected:true,bounds:boxes[0]});
  }
  if(compact)return placed;
  const center=chosen||{x:width/2,y:height/2};
  const neighbors=candidates.filter(p=>p.id!==selectedId).sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)||a.id.localeCompare(b.id));
  for(const p of neighbors){
    if(placed.length>=7)break;
    const w=clamp(p.labelWidth+12,88,152),b={left:p.x-w/2,right:p.x+w/2,top:p.y-23,bottom:p.y+25};
    if(clear(b))placed.push({...p,selected:false,bounds:b});
  }
  return placed;
}
const fit=(c,s,w)=>{let t=s;while(t.length&&c.measureText(t+(t===s?'':'…')).width>w)t=t.slice(0,-1);return t+(t===s?'':'…');};
const hatches=new WeakMap();
export function stressHatch(ctx,scale){
  if(!hatches.has(ctx)){
    const tile=document.createElement('canvas');tile.width=tile.height=18;const c=tile.getContext('2d');c.strokeStyle='#f6c7ae';c.lineWidth=.8;
    for(const x of [-18,0,18]){c.beginPath();c.moveTo(x,18);c.lineTo(x+18,0);c.stroke();}
    hatches.set(ctx,ctx.createPattern(tile,'repeat'));
  }
  const pattern=hatches.get(ctx);pattern?.setTransform(new DOMMatrix().scale(1/scale));return pattern;
}
export function paintStressMarks(ctx,candidates,options){
  const {compact,year,alpha}=options;ctx.font='11px serif';
  const marks=layoutStressMarks(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of marks){
    const b=p.bounds,w=b.right-b.left,r=stressBalance(p.region,year),color=r.value===null?'#a1b8bf':r.value>100?'#f2b299':'#b7dedc';
    ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='alphabetic';
    const ink=(s,x,y,size,c)=>{ctx.font=`${size}px serif`;ctx.fillStyle=c;ctx.fillText(s,x,y);};
    if(p.selected){
      ctx.strokeStyle='#b5d3d166';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
      ctx.shadowColor='#031821';ctx.shadowBlur=4;ctx.textAlign='left';ctx.font=`${compact?11:15}px serif`;
      ink(fit(ctx,p.name,w-72),b.left+8,b.top+(compact?12:18),compact?11:15,'#deeeea');ctx.textAlign='right';ink(`${year}年`,b.right-8,b.top+(compact?12:18),9,'#9fbcc2');ctx.textAlign='left';
      ink(`${number(r.value)}${r.value===null?'':'%'}`,b.left+8,b.top+(compact?33:53),compact?21:32,color);
      if(!compact){
        ink('利用可能な淡水を100とすると',b.left+8,b.top+73,11,'#bdd2d3');ctx.shadowBlur=0;
        const left=b.left+42,span=w-105,ref=left+span*r.resource;
        for(const [key,label,fraction,value,y] of [['resource','資源',r.resource,100,b.top+89],['withdrawal','取水',r.withdrawal,r.value,b.top+114]]){
          ctx.textAlign='left';ink(label,b.left+8,y+6,10,'#b6cfd3');ctx.fillStyle='#93bec615';ctx.fillRect(left,y-3,span,10);
          if(fraction!==null){
            const length=span*fraction,fill=ctx.createLinearGradient(left,y-3,left,y+7);fill.addColorStop(0,key==='resource'?'#c9ebeb':color);fill.addColorStop(1,key==='resource'?'#578e9b99':waterStressColor(r.value)+'99');ctx.fillStyle=fill;ctx.fillRect(left,y-3,length,10);
            ctx.strokeStyle=key==='resource'?'#c5ecec':color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y-3);ctx.lineTo(left+length,y-3);ctx.stroke();
            if(key==='withdrawal'&&r.value>100){ctx.fillStyle='#efb39260';ctx.fillRect(ref,y-3,length-span*r.resource,10);ctx.strokeStyle='#ffd3ad';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(left+length,y-6);ctx.lineTo(left+length,y+10);ctx.stroke();}
          }else{ctx.setLineDash([2,4]);ctx.strokeStyle='#a0b4bc';ctx.beginPath();ctx.moveTo(left,y+2);ctx.lineTo(left+span,y+2);ctx.stroke();ctx.setLineDash([]);}
          ctx.textAlign='right';ink(number(value),b.right-7,y+7,11,key==='resource'?'#bde1e1':color);
        }
        ctx.strokeStyle='#f7e6b89c';ctx.lineWidth=.8;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(ref,b.top+82);ctx.lineTo(ref,b.top+128);ctx.stroke();ctx.setLineDash([]);
        ctx.textAlign='left';ink(r.multiple===null?'この年の取水は欠測':`取水は資源の${r.multiple.toLocaleString('ja-JP',{maximumFractionDigits:2})}倍`,b.left+8,b.top+145,12,color);
        ink(`線形目盛 0–${number(r.max)} · 同じ国で比較`,b.left+8,b.top+161,9,'#8faeb9');
      }
    }else{
      ctx.textAlign='center';ctx.shadowColor='#031721';ctx.shadowBlur=5;ctx.font='11px serif';const x=(b.left+b.right)/2;
      ink(fit(ctx,p.name,w-8),x,b.top+11,11,'#d3e6e5');ink(`${number(r.value)}${r.value===null?'':'%'}`,x,b.top+30,16,color);ctx.shadowBlur=0;
      // Five fixed category swatches, not a rescaled bar or an invented station.
      for(let i=0;i<5;i++){ctx.fillStyle=i===r.band?WATER_STRESS_LEVELS[i].color:'#76949935';ctx.fillRect(x-18+i*8,b.bottom-5,5,2);}
    }
    ctx.restore();
  }
  return marks.map(p=>({id:p.id,selected:p.selected,bounds:p.bounds,anchor:{x:p.x,y:p.y},...stressBalance(p.region,year),alpha}));
}
