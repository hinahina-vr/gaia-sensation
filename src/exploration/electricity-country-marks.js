// National labels, not cities or power infrastructure. Their anchors come from
// the same Natural Earth country geometry used for selection.
export const ELECTRICITY_ARRIVAL_MS=900;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>t*t*(3-2*t);
export function electricityArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;
  if(reduced)return 1;
  return ease(clamp((elapsed-(count>1?index/(count-1)*220:0))/680,0,1));
}
export function electricityReading(value,change=false){
  if(!Number.isFinite(value))return '欠測';
  return `${change&&value>0?'＋':value<0?'−':''}${Math.abs(value).toLocaleString('ja-JP',{maximumFractionDigits:1})}${change?' pt':'%'}`;
}
export function electricityGauge(value,baseline,change=false){
  const fraction=v=>Number.isFinite(v)?clamp(change?(v+50)/100:v/100,0,1):null;
  return {value:fraction(value),baseline:fraction(change?0:baseline),origin:change?.5:0};
}
export function fitElectricityName(name,width,measure){
  if(measure(name)<=width)return name;
  const chars=Array.from(name);
  while(chars.length&&measure(`${chars.join('')}…`)>width)chars.pop();
  return `${chars.join('')}…`;
}
export const electricityOverlap=(a,b,gap=7)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export function layoutElectricityLabels(candidates,{width,height,compact,selectedId,obstacles=[]}){
  const chosen=candidates.find(p=>p.id===selectedId),placed=[];
  const inside=b=>b.left>=8&&b.right<=width-8&&b.top>=8&&b.bottom<=height-8;
  const clear=b=>inside(b)&&!obstacles.some(o=>electricityOverlap(b,o))&&!placed.some(o=>electricityOverlap(b,o.bounds));
  if(chosen&&chosen.x>=0&&chosen.x<=width&&chosen.y>=0&&chosen.y<=height){
    const w=compact?122:166,h=compact?70:92,initialY=chosen.y-h/2;
    const ys=[initialY,...obstacles.flatMap(o=>[o.bottom+8,o.top-h-8])];
    const xs=[chosen.x+22,chosen.x-w-22,chosen.x-w/2];
    const options=xs.flatMap((x,i)=>ys.map(y=>({left:x,right:x+w,top:y,bottom:y+h,score:Math.abs(y-initialY)+(i===2?35:i*3)})))
      .filter(b=>clear(b)&&Math.abs((b.top+b.bottom)/2-chosen.y)<130).sort((a,b)=>a.score-b.score);
    if(options.length)placed.push({...chosen,selected:true,bounds:options[0]});
  }
  // Stable geographic order: a changing value never moves a label or gives a
  // country priority. Small-screen space is reserved for the selected country.
  if(compact)return placed;
  const reference=chosen||{x:width/2,y:height/2};
  const ordered=candidates.filter(p=>p.id!==selectedId).sort((a,b)=>Math.hypot(a.x-reference.x,a.y-reference.y)-Math.hypot(b.x-reference.x,b.y-reference.y)||a.id.localeCompare(b.id));
  for(const p of ordered){
    if(placed.length>=11)break;
    const w=Math.max(68,Math.min(132,p.labelWidth+16)),b={left:p.x-w/2,right:p.x+w/2,top:p.y-24,bottom:p.y+14};
    if(clear(b)&&(!chosen||Math.hypot(p.x-chosen.x,p.y-chosen.y)>75))placed.push({...p,selected:false,bounds:b});
  }
  return placed;
}
export function paintElectricityLabels(ctx,candidates,options){
  const {compact,year,change,alpha}=options;
  ctx.font='11px serif';
  const labels=layoutElectricityLabels(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of labels){
    const b=p.bounds,w=b.right-b.left;
    ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='left';ctx.textBaseline='alphabetic';
    const ink=(text,x,y,size,color)=>{ctx.font=`${size}px serif`;ctx.fillStyle=color;ctx.fillText(text,x,y);};
    if(p.selected){
      const edge=p.x<b.left?b.left:p.x>b.right?b.right:clamp(p.x,b.left+6,b.right-6),cy=clamp(p.y,b.top+8,b.bottom-8);
      ctx.strokeStyle='#ffe4a38c';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(edge,cy);ctx.stroke();
      const wash=ctx.createLinearGradient(b.left,0,b.right,0);wash.addColorStop(0,'#061721f2');wash.addColorStop(.82,'#061721df');wash.addColorStop(1,'#06172100');ctx.fillStyle=wash;ctx.fillRect(b.left,b.top,w,b.bottom-b.top);
      ctx.fillStyle='#ffe4a3';ctx.fillRect(b.left,b.top,2,b.bottom-b.top);
      const x=b.left+11,right=b.right-12,top=b.top;
      const nameSize=compact?11:14;ctx.font=`${nameSize}px serif`;
      ink(fitElectricityName(p.name,w-24,t=>ctx.measureText(t).width),x,top+(compact?14:20),nameSize,'#e3f0ec');
      ink(electricityReading(p.value,change),x,top+(compact?36:49),compact?21:28,Number.isFinite(p.value)?'#ffe4a3':'#a8b7bf');
      const gauge=electricityGauge(p.value,p.baseline,change),gy=top+(compact?46:63),gx=f=>x+(right-x)*f;
      ctx.lineWidth=2;ctx.strokeStyle='#59737a80';ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(right,gy);ctx.stroke();
      if(gauge.value!==null){ctx.strokeStyle=change&&p.value<0?'#c8b4ec':'#ffe4a3';ctx.beginPath();ctx.moveTo(gx(gauge.origin),gy);ctx.lineTo(gx(gauge.value),gy);ctx.stroke();}
      if(gauge.baseline!==null){ctx.strokeStyle='#c0e4e4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(gx(gauge.baseline),gy-4);ctx.lineTo(gx(gauge.baseline),gy+4);ctx.stroke();}
      ink(change?`${year}年 · 2000年比`:`2000年 ${electricityReading(p.baseline)}`,x,top+(compact?62:83),compact?9:11,'#a7c9ce');
    }else{
      const cx=(b.left+b.right)/2;ctx.textAlign='center';ctx.shadowColor='#021019';ctx.shadowBlur=5;
      ctx.font='11px serif';ink(fitElectricityName(p.name,w-12,t=>ctx.measureText(t).width),cx,b.top+12,11,'#c6dbd7');
      ink(electricityReading(p.value,change),cx,b.bottom-5,13,Number.isFinite(p.value)?'#f5e5bc':'#a8b7bf');
    }
    ctx.restore();
  }
  return labels.map(p=>({id:p.id,selected:p.selected,name:p.name,value:p.value,baseline:p.baseline,text:electricityReading(p.value,change),bounds:p.bounds,anchor:{x:p.x,y:p.y},alpha}));
}
