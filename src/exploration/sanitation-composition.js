// National population shares, not individual people, facilities or water flows.
export const SANITATION_KEYS=Object.freeze(['safe','basic','limited','open']);
export const SANITATION_ARRIVAL_MS=1100;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const sanitationPercent=v=>Number.isFinite(v)?`${v.toLocaleString('ja-JP',{maximumFractionDigits:1})}%`:'欠測';
export function sanitationArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;if(reduced)return 1;
  const t=clamp((elapsed-(count>1?index/(count-1)*240:0))/860,0,1);return t*t*(3-2*t);
}
export function sanitationSegments(row){
  if(!row?.complete||!SANITATION_KEYS.every(k=>Number.isFinite(row[k])&&row[k]>=0&&row[k]<=100))return [];
  if(Math.abs(SANITATION_KEYS.reduce((s,k)=>s+row[k],0)-100)>.0003)return [];
  let start=0;return SANITATION_KEYS.map(key=>{const end=start+row[key]/100,result={key,value:row[key],start,end};start=end;return result;});
}
export function sanitationBands(rows){
  const bands=[];
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];if(b.year!==a.year+1)continue;
    const sa=sanitationSegments(a),sb=sanitationSegments(b);if(!sa.length||!sb.length)continue;
    for(let k=0;k<sa.length;k++)bands.push({key:sa[k].key,from:a.year,to:b.year,points:[[a.year,sa[k].start],[b.year,sb[k].start],[b.year,sb[k].end],[a.year,sa[k].end]]});
  }
  return bands;
}
export function paintSanitationHistory(c,rows,{year,mode,modes}){
  const x=y=>(y-2000)*24+12,y=f=>150-f*140;
  c.clearRect(0,0,600,160);
  // Between adjacent observed years, straight boundaries retain the measured
  // endpoints. No smoothing spline overshoot or connection across missing years.
  const bands=sanitationBands(rows),connected=new Set(bands.flatMap(b=>[b.from,b.to]));
  for(const band of bands){
    c.fillStyle=modes[band.key].color;c.globalAlpha=band.key===mode?.88:.48;c.beginPath();
    band.points.forEach(([yr,f],i)=>i?c.lineTo(x(yr),y(f)):c.moveTo(x(yr),y(f)));c.closePath();c.fill();
  }
  for(const r of rows){
    const parts=sanitationSegments(r);
    if(!parts.length){c.globalAlpha=.8;c.strokeStyle='#90a9af';c.lineWidth=1;c.beginPath();c.moveTo(x(r.year)-5,150);c.lineTo(x(r.year)+5,10);c.stroke();continue;}
    // Isolated observations still appear, but never manufacture a full year.
    if(!connected.has(r.year))for(const s of parts){c.fillStyle=modes[s.key].color;c.globalAlpha=s.key===mode?.95:.58;c.fillRect(x(r.year)-1,y(s.end),2,(s.end-s.start)*140);}
  }
  c.globalAlpha=1;c.strokeStyle='#e7f8f077';c.lineWidth=1;c.beginPath();c.moveTo(x(year),6);c.lineTo(x(year),154);c.stroke();
  for(const s of sanitationSegments(rows.find(r=>r.year===year))){
    c.fillStyle=modes[s.key].color;c.fillRect(x(year)-3,y(s.end),6,(s.end-s.start)*140);
    c.fillStyle='#f1fff5';c.beginPath();c.arc(x(year),y(s.end),s.key===mode?3:1.6,0,Math.PI*2);c.fill();
  }
}
export const sanitationOverlap=(a,b,gap=3)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export function layoutSanitationMarks(candidates,{width,height,compact,selectedId,obstacles=[]}){
  const chosen=candidates.find(p=>p.id===selectedId),placed=[];
  const clear=b=>b.left>=8&&b.right<=width-8&&b.top>=8&&b.bottom<=height-8&&!obstacles.some(o=>sanitationOverlap(b,o,2))&&!placed.some(p=>sanitationOverlap(b,p.bounds,12));
  if(chosen&&chosen.x>=0&&chosen.x<=width&&chosen.y>=0&&chosen.y<=height){
    const w=compact?148:184,h=compact?34:178;
    const xs=[chosen.x+24,chosen.x-w-24,clamp(chosen.x-w/2,8,width-w-8)];
    const ys=[chosen.y-h/2,...obstacles.flatMap(o=>[o.bottom+3,o.top-h-3])];
    const options=xs.flatMap((x,i)=>ys.map(y=>({left:x,right:x+w,top:y,bottom:y+h,score:Math.abs(y+h/2-chosen.y)+i*12}))).filter(clear).sort((a,b)=>a.score-b.score);
    if(options.length)placed.push({...chosen,selected:true,bounds:options[0]});
  }
  if(compact)return placed;
  const origin=chosen||{x:width/2,y:height/2};
  const ordered=candidates.filter(p=>p.id!==selectedId).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y)||a.id.localeCompare(b.id));
  for(const p of ordered){
    if(placed.length>=8)break;
    const w=clamp(p.labelWidth+12,88,150),b={left:p.x-w/2,right:p.x+w/2,top:p.y-24,bottom:p.y+23};
    if(clear(b))placed.push({...p,selected:false,bounds:b});
  }
  return placed;
}
const fitName=(ctx,name,width)=>{let label=name;while(label.length&&ctx.measureText(label+(label!==name?'…':'')).width>width)label=label.slice(0,-1);return label+(label!==name?'…':'');};
export function paintSanitationMarks(ctx,candidates,options){
  const {compact,year,mode,modes,alpha}=options;ctx.font='11px serif';
  const marks=layoutSanitationMarks(candidates.map(p=>({...p,labelWidth:ctx.measureText(p.name).width})),options);
  for(const p of marks){
    const b=p.bounds,w=b.right-b.left,parts=sanitationSegments(p.parts),value=p.parts?.[mode]??null;
    ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='alphabetic';
    const ink=(s,x,y,size,color)=>{ctx.font=`${size}px serif`;ctx.save();if(p.selected){ctx.shadowColor='#04151e';ctx.shadowBlur=4;}ctx.fillStyle=color;ctx.fillText(s,x,y);ctx.restore();};
    const color=Number.isFinite(value)?modes[mode].color:'#a3b8be';
    if(p.selected){
      ctx.strokeStyle='#bcdcc77c';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(clamp(p.x,b.left,b.right),clamp(p.y,b.top+4,b.bottom-4));ctx.stroke();
      const cx=(b.left+b.right)/2,cy=b.top+91;
      if(compact){
        ctx.textAlign='left';ctx.font='11px serif';ink(fitName(ctx,p.name,w-20),b.left+9,b.top+12,11,'#e0eee7');ink(sanitationPercent(value),b.left+9,b.top+31,20,color);
        if(parts.length)for(const s of parts){ctx.fillStyle=modes[s.key].color;ctx.fillRect(b.right-60+s.start*52,b.top+26,(s.end-s.start)*52,4);}
      }else{
        ctx.font='15px serif';ink(fitName(ctx,p.name,w-12),cx,b.top+18,15,'#e0eee7');
        ctx.lineWidth=8;ctx.strokeStyle='#78939b3d';ctx.beginPath();ctx.arc(cx,cy,51,0,Math.PI*2);ctx.stroke();
        for(const s of parts){
          if(s.value<=0)continue;const start=-Math.PI/2+s.start*Math.PI*2,end=-Math.PI/2+s.end*Math.PI*2,gap=Math.min(.016,(end-start)*.12);
          ctx.strokeStyle=modes[s.key].color;ctx.lineWidth=s.key===mode?10:6;ctx.beginPath();ctx.arc(cx,cy,51,start+gap,end-gap);ctx.stroke();
          if(s.key===mode){ctx.lineWidth=1;ctx.strokeStyle=modes[s.key].color+'90';ctx.beginPath();ctx.arc(cx,cy,60,start,end);ctx.stroke();}
        }
        ink(sanitationPercent(value),cx,cy+5,29,color);ink(mode==='basic'?'基本のみ':modes[mode].metric,cx,cy+23,10,'#c3d8d5');
        ink(parts.length?'人口100%の内訳':'内訳に欠測',cx,b.top+162,11,'#a7c0c5');ink(`${year}年`,cx,b.top+176,9,'#8caab2');
      }
    }else{
      const cx=(b.left+b.right)/2;ctx.shadowColor='#04151e';ctx.shadowBlur=5;ctx.font='11px serif';ink(fitName(ctx,p.name,w-8),cx,b.top+11,11,'#c9dfdc');
      ink(sanitationPercent(value),cx,b.top+29,15,color);ctx.shadowBlur=0;
      if(parts.length)for(const s of parts){ctx.fillStyle=modes[s.key].color;ctx.fillRect(cx-34+s.start*68,b.bottom-6,(s.end-s.start)*68,3);}
    }
    ctx.restore();
  }
  return marks.map(p=>({id:p.id,selected:p.selected,value:p.parts?.[mode]??null,segments:sanitationSegments(p.parts),bounds:p.bounds,anchor:{x:p.x,y:p.y},alpha}));
}
