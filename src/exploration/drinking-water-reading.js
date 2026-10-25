// Country-level comparison. These readings stay attached to Natural Earth
// country anchors; they do not imply urban/rural boundaries within a country.
export const DRINKING_ARRIVAL_MS=1000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function drinkingArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;
  if(reduced)return 1;
  const t=clamp((elapsed-(count>1?index/(count-1)*240:0))/760,0,1);
  return t*t*(3-2*t);
}
export const drinkingValue=(value,gap=true)=>Number.isFinite(value)?`${gap&&value>0?'＋':value<0?'−':''}${Math.abs(value).toLocaleString('ja-JP',{maximumFractionDigits:1})}${gap?' pt':'%'}`:'欠測';
export const drinkingRateY=value=>Number.isFinite(value)?122-clamp(value,0,100)/100*110:null;
export const drinkingOverlap=(a,b,gap=3)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export function layoutDrinkingReadings(candidates,{width,height,compact,selectedId,obstacles=[]}){
  const chosen=candidates.find(p=>p.id===selectedId),placed=[];
  const clear=b=>b.left>=8&&b.right<=width-8&&b.top>=8&&b.bottom<=height-8&&!obstacles.some(o=>drinkingOverlap(b,o,2))&&!placed.some(p=>drinkingOverlap(b,p.bounds,12));
  if(chosen&&chosen.x>=0&&chosen.x<=width&&chosen.y>=0&&chosen.y<=height){
    const w=compact?148:224,h=compact?34:132;
    const xs=[chosen.x+25,chosen.x-w-25,clamp(chosen.x-w/2,8,width-w-8)];
    const ys=[chosen.y-h/2,...obstacles.flatMap(o=>[o.bottom+3,o.top-h-3])];
    const fits=xs.flatMap((x,i)=>ys.map(y=>({left:x,right:x+w,top:y,bottom:y+h,score:Math.abs(y+h/2-chosen.y)+i*12}))).filter(clear).sort((a,b)=>a.score-b.score);
    if(fits.length)placed.push({...chosen,selected:true,bounds:fits[0]});
  }
  if(compact)return placed;
  const origin=chosen||{x:width/2,y:height/2};
  for(const p of candidates.filter(p=>p.id!==selectedId).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y)||a.id.localeCompare(b.id))){
    if(placed.length>=8)break;
    const w=clamp(p.labelWidth+12,80,148),b={left:p.x-w/2,right:p.x+w/2,top:p.y-23,bottom:p.y+17};
    if(clear(b))placed.push({...p,selected:false,bounds:b});
  }
  return placed;
}
const fitName=(ctx,name,width)=>{const chars=Array.from(name);while(chars.length&&ctx.measureText(chars.join('')+(chars.length<name.length?'…':'')).width>width)chars.pop();return chars.join('')+(chars.length<name.length?'…':'');};
export function paintDrinkingReadings(ctx,candidates,options){
  const {compact,year,gap,alpha}=options;ctx.font='11px serif';
  const labels=layoutDrinkingReadings(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of labels){
    const b=p.bounds,w=b.right-b.left,h=b.bottom-b.top,color=!Number.isFinite(p.value)?'#9ab1b9':gap&&p.value>0?'#f4d3a3':'#a2ebe3';
    ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='alphabetic';ctx.textAlign='left';
    const ink=(s,x,y,size,c)=>{ctx.font=`${size}px serif`;ctx.fillStyle=c;ctx.fillText(s,x,y);};
    if(p.selected){
      ctx.strokeStyle='#bce7e872';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
      const wash=ctx.createLinearGradient(b.left,0,b.right,0);wash.addColorStop(0,'#061923ec');wash.addColorStop(.8,'#061923d9');wash.addColorStop(1,'#06192300');ctx.fillStyle=wash;ctx.fillRect(b.left,b.top,w,h);
      const x=b.left+10,t=b.top;
      ctx.font=`${compact?11:15}px serif`;ink(fitName(ctx,p.name,w-20),x,t+(compact?12:20),compact?11:15,'#deefee');
      ink(drinkingValue(p.value,gap),x,t+(compact?31:57),compact?20:34,color);
      if(!compact){
        const gx=v=>x+31+clamp(v,0,100)/100*(w-102),ys=[t+83,t+109];
        // Both rows use exactly the same 0–100% scale. The translucent bridge
        // joins observed endpoints, never an invented geographic subdivision.
        if(Number.isFinite(p.urban)&&Number.isFinite(p.rural)){
          const shade=ctx.createLinearGradient(0,ys[0],0,ys[1]);shade.addColorStop(0,'#f0cc9238');shade.addColorStop(1,'#82ddd638');ctx.fillStyle=shade;
          ctx.beginPath();ctx.moveTo(gx(p.urban),ys[0]);ctx.lineTo(gx(p.rural),ys[0]);ctx.lineTo(gx(p.rural),ys[1]);ctx.lineTo(gx(p.urban),ys[1]);ctx.closePath();ctx.fill();
        }
        for(const [i,key]of ['urban','rural'].entries()){
          const value=p[key],y=ys[i],c=i?'#82ddd6':'#f0cc92';
          ink(i?'農村':'都市',x,y+3,10,c);ctx.strokeStyle='#9cc8cf35';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(gx(0),y);ctx.lineTo(gx(100),y);ctx.stroke();
          if(Number.isFinite(value)){ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(gx(0),y);ctx.lineTo(gx(value),y);ctx.stroke();ctx.fillStyle=c;ctx.beginPath();ctx.arc(gx(value),y,3,0,Math.PI*2);ctx.fill();}
          ink(drinkingValue(value,false),gx(100)+9,y+4,12,c);
        }
        ink(`${year}年`,x,t+127,9,'#91b0ba');
      }
    }else{
      ctx.textAlign='center';ctx.shadowColor='#03151e';ctx.shadowBlur=6;
      ctx.font='11px serif';ink(fitName(ctx,p.name,w-10),(b.left+b.right)/2,b.top+12,11,'#d2e6e5');
      ink(drinkingValue(p.value,gap),(b.left+b.right)/2,b.bottom-5,15,color);
    }
    ctx.restore();
  }
  return labels.map(p=>({id:p.id,selected:p.selected,value:p.value,urban:p.urban,rural:p.rural,bounds:p.bounds,anchor:{x:p.x,y:p.y},alpha}));
}
