import {forestReading,forestSigned} from './forest-history.js?v=whole-trends20-20261025';

export const FOREST_ARRIVAL_MS=1100;
export {countrySourceId as forestDataId} from './country-source-ids.js?v=stress-polish-20261023';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const valid=n=>Number.isFinite(n)&&n>=0&&n<=100;
const overlap=(a,b,gap=3)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
const colors={loss:'#e9ae7b',gain:'#b5e4bb',neutral:'#bdd9ca',missing:'#99afb7'};
export function forestArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;if(reduced)return 1;
  const t=clamp((elapsed-(count>1?index/(count-1)*240:0))/860,0,1);return t*t*(3-2*t);
}
// One shared vertical scale across countries and years. Source changes outside
// the map's +/-10pt color scale are still drawn in full in these time traces.
const domains=new WeakMap();
export function forestTrendDomain(data,mode){
  if(mode==='share')return [0,100];
  if(!domains.has(data)){
    let low=0,high=0;
    for(const r of data.regions)for(const y of r.years){const v=forestReading(r,y.year).change;if(v!==null){low=Math.min(low,v);high=Math.max(high,v);}}
    domains.set(data,[Math.min(-5,Math.floor(low/5)*5),Math.max(5,Math.ceil(high/5)*5)]);
  }
  return domains.get(data);
}
export function forestTrend(region,mode){
  const base=forestReading(region,2000).base,points=[],segments=[];
  let previous=null;
  for(const r of region?.years||[]){
    const value=mode==='share'?(valid(r.value)?r.value:null):forestReading(region,r.year).change;
    if(value===null){previous=null;continue;}
    const p={year:r.year,value};points.push(p);
    if(previous&&r.year===previous.year+1)segments.push([previous,p]);previous=p;
  }
  return {points,segments,baseline:mode==='share'?base:base===null?null:0};
}
export function layoutForestTrends(candidates,{width,height,compact,selectedId,obstacles=[]}){
  const placed=[],chosen=candidates.find(p=>p.id===selectedId);
  const clear=b=>b.left>=8&&b.right<=width-8&&b.top>=8&&b.bottom<=height-8&&!obstacles.some(o=>overlap(b,o,2))&&!placed.some(p=>overlap(b,p.bounds,10));
  if(chosen&&chosen.x>=0&&chosen.x<=width&&chosen.y>=0&&chosen.y<=height){
    const w=compact?156:220,h=compact?34:148;
    const xs=[chosen.x+25,chosen.x-w-25,clamp(chosen.x-w/2,8,width-w-8)];
    const ys=[chosen.y-h/2,...obstacles.flatMap(b=>[b.bottom+3,b.top-h-3])];
    const boxes=xs.flatMap((x,i)=>ys.map(y=>({left:x,right:x+w,top:y,bottom:y+h,score:Math.abs(y+h/2-chosen.y)+i*12}))).filter(clear).sort((a,b)=>a.score-b.score);
    if(boxes.length)placed.push({...chosen,selected:true,bounds:boxes[0]});
  }
  if(compact)return placed;
  const center=chosen||{x:width/2,y:height/2};
  const neighbors=candidates.filter(p=>p.id!==selectedId).sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)||a.id.localeCompare(b.id));
  for(const p of neighbors){
    if(placed.length>=7)break;
    const w=clamp(p.labelWidth+12,100,150),b={left:p.x-w/2,right:p.x+w/2,top:p.y-29,bottom:p.y+34};
    if(clear(b))placed.push({...p,selected:false,bounds:b});
  }
  return placed;
}
function paintTrace(c,trend,{left,top,width,height,domain,year,strong}){
  const x=yr=>left+(yr-2000)/23*width,y=v=>top+(domain[1]-v)/(domain[1]-domain[0])*height;
  const base=trend.baseline;
  c.save();
  if(base!==null){c.strokeStyle='#c6ded446';c.lineWidth=.7;c.setLineDash([2,4]);c.beginPath();c.moveTo(left,y(base));c.lineTo(left+width,y(base));c.stroke();c.setLineDash([]);}
  for(const [a,b] of trend.segments){
    const visible=b.year<=year,color=base===null?colors.neutral:(a.value+b.value)/2<base?colors.loss:colors.gain;
    // Fill separate triangles at a baseline crossing; never overstate the sign.
    if(visible&&base!==null){
      const vertices=[a];if((a.value-base)*(b.value-base)<0)vertices.push({year:a.year+(base-a.value)/(b.value-a.value),value:base});vertices.push(b);
      for(let i=1;i<vertices.length;i++){const p=vertices[i-1],q=vertices[i],ink=(p.value+q.value)/2<base?colors.loss:colors.gain;
        c.fillStyle=ink+(strong?'48':'30');c.beginPath();c.moveTo(x(p.year),y(base));c.lineTo(x(p.year),y(p.value));c.lineTo(x(q.year),y(q.value));c.lineTo(x(q.year),y(base));c.closePath();c.fill();}
    }
    c.lineWidth=visible?(strong?1.8:1.25):.7;c.strokeStyle=color+(visible?'ee':'35');c.beginPath();c.moveTo(x(a.year),y(a.value));c.lineTo(x(b.year),y(b.value));c.stroke();
  }
  const current=trend.points.find(p=>p.year===year);
  if(current){c.fillStyle=base===null?colors.neutral:current.value<base?colors.loss:colors.gain;c.beginPath();c.arc(x(year),y(current.value),strong?3:1.9,0,Math.PI*2);c.fill();}
  // Retain isolated source years, without bridging a gap to the next record.
  for(const p of trend.points)if(!trend.segments.some(([a,b])=>a===p||b===p)){c.fillStyle=colors.neutral;c.beginPath();c.arc(x(p.year),y(p.value),1.5,0,Math.PI*2);c.fill();}
  c.restore();
}
const percent=v=>v===null?'欠測':`${v.toLocaleString('ja-JP',{maximumFractionDigits:1})}%`;
const fitted=(c,s,w)=>{let t=s;while(t.length&&c.measureText(t+(t===s?'':'…')).width>w)t=t.slice(0,-1);return t+(t===s?'':'…');};
export function paintForestTrends(ctx,candidates,options){
  const {compact,selectedId,year,mode,domain,alpha}=options;ctx.font='11px serif';
  const marks=layoutForestTrends(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of marks){
    const b=p.bounds,w=b.right-b.left,reading=forestReading(p.region,year),value=mode==='change'?reading.change:reading.value;
    const color=value===null?colors.missing:reading.change===null?colors.neutral:reading.change<0?colors.loss:colors.gain;
    ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='left';ctx.textBaseline='alphabetic';
    const ink=(s,x,y,size,color)=>{ctx.font=`${size}px serif`;ctx.fillStyle=color;ctx.fillText(s,x,y);};
    if(p.selected){
      ctx.strokeStyle='#b5cfba55';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
      ctx.save();ctx.translate((b.left+b.right)/2,(b.top+b.bottom)/2);ctx.scale(w/2,(b.bottom-b.top)/2);
      const wash=ctx.createRadialGradient(0,0,.1,0,0,1);wash.addColorStop(0,'#081c24eb');wash.addColorStop(.6,'#081c24b0');wash.addColorStop(1,'#081c2400');ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
      ctx.shadowColor='#04161c';ctx.shadowBlur=4;ctx.font=`${compact?11:15}px serif`;ink(fitted(ctx,p.name,w-(compact?58:76)),b.left+8,b.top+(compact?12:18),compact?11:15,'#e0ecdc');
      ink(value===null?'欠測':mode==='change'?`${forestSigned(value)} pt`:percent(value),b.left+8,b.top+(compact?31:49),compact?20:28,color);
      if(compact){ctx.textAlign='right';ink(`${year}`,b.right-7,b.top+12,9,'#a5c0b7');}
      else{
        ctx.textAlign='right';ink(`${year}年`,b.right-22,b.top+18,10,'#abc6b8');ctx.textAlign='left';
        ink(`${percent(reading.base)} → ${percent(reading.value)}`,b.left+8,b.top+68,12,'#c0d1c3');ctx.shadowBlur=0;
        paintTrace(ctx,forestTrend(p.region,mode),{left:b.left+8,top:b.top+79,width:w-30,height:40,domain,year,strong:true});
        ink('2000',b.left+8,b.top+133,9,'#a0b7ad');ctx.textAlign='right';ink('2023',b.right-22,b.top+133,9,'#a0b7ad');
        ctx.textAlign='left';ink(`共通目盛 ${domain[0]}〜${domain[1]}${mode==='change'?' pt':'%'}`,b.left+8,b.top+146,10,'#91ada2');
      }
    }else{
      ctx.textAlign='center';ctx.shadowColor='#05171b';ctx.shadowBlur=5;ctx.font='11px serif';const cx=(b.left+b.right)/2;
      ink(fitted(ctx,p.name,w-8),cx,b.top+12,11,'#d1e0d4');ink(value===null?'欠測':mode==='change'?`${forestSigned(value)} pt`:percent(value),cx,b.top+29,15,color);ctx.shadowBlur=0;
      paintTrace(ctx,forestTrend(p.region,mode),{left:b.left+10,top:b.top+36,width:w-20,height:25,domain,year,strong:false});
    }
    ctx.restore();
  }
  return marks.map(p=>({id:p.id,selected:p.id===selectedId,bounds:p.bounds,anchor:{x:p.x,y:p.y},...forestReading(p.region,year),mode,domain,alpha}));
}
