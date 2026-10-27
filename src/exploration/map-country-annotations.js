// Map annotations are geographic labels. Comparisons and charts stay in the lab.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const overlaps=(a,b,gap=4)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
const number=v=>v.toLocaleString('ja-JP',{maximumFractionDigits:1});
export function paintCountryAnnotations(ctx,candidates,{definition,year,mode,compact,selectedId,width,height,obstacles=[]}){
 const placed=[],selected=candidates.find(p=>p.id===selectedId),center=selected||{x:width/2,y:height/2};
 const sorted=[...(selected?[selected]:[]),...candidates.filter(p=>p!==selected).sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y))];
 for(const p of sorted){
  if(p.x<8||p.x>width-8||p.y<8||p.y>height-8)continue;
  const chosen=p.id===selectedId,w=chosen?(compact?158:184):144,h=chosen?44:36;
  if(placed.length>=(compact?3:7))break;
  const boxes=[{left:p.x+12,top:p.y-h/2},{left:p.x-w-12,top:p.y-h/2},{left:clamp(p.x-w/2,8,width-w-8),top:p.y+13}].map(b=>({...b,right:b.left+w,bottom:b.top+h}));
  if(chosen)for(const o of obstacles)for(const top of [o.bottom+6,o.top-h-6])boxes.push({left:clamp(p.x-w/2,8,width-w-8),right:clamp(p.x-w/2,8,width-w-8)+w,top,bottom:top+h});
  const b=boxes.find(b=>b.left>=8&&b.right<=width-8&&b.top>=8&&b.bottom<=height-8&&!obstacles.some(o=>overlaps(b,o))&&!placed.some(o=>overlaps(b,o.bounds,10)));
  if(!b)continue;
  let value=p.value,label=Number.isFinite(value)?number(value):'欠測';
  const row=p.region?.years?.find(r=>r.year===year);
  if(row?.invalidComposition)label='内訳を確認中';else if(row?.censored)label='2.5%以下';
  else if(Number.isFinite(value)){const delta=(definition.id==='cropland'||definition.id==='foresthistory')&&mode==='change';label=(delta&&value>0?'+':'')+number(value)+(delta?' pt':definition.unit==='%'?'%':' '+definition.unit);}
  ctx.save();ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.shadowColor='#04151e';ctx.shadowBlur=4;
  ctx.strokeStyle=chosen?'#dcf6ed':'#91c6c3';ctx.lineWidth=1;ctx.fillStyle=definition.id==='foresthistory'?(chosen?'#a5e6b7':'#7ebf94'):(chosen?'#f2dfb2':'#96d0cc');ctx.beginPath();ctx.arc(p.x,p.y,chosen?3:2,0,Math.PI*2);ctx.fill();
  ctx.font=(chosen?12:11)+'px serif';ctx.fillStyle=chosen?'#f1f6ee':'#cbdedb';let name=p.name;while(ctx.measureText(name).width>w-6)name=name.slice(0,-1);ctx.fillText(name,b.left+3,b.top+13);
  ctx.font=(chosen?20:14)+'px serif';ctx.fillStyle=definition.id==='foresthistory'?(chosen?'#d7f6dc':'#bee2c6'):(chosen?'#f4e4c7':'#d5eae6');ctx.fillText(label,b.left+3,b.top+(chosen?37:31));ctx.restore();
  placed.push({id:p.id,selected:chosen,value,bounds:b,anchor:{x:p.x,y:p.y},alpha:1});
 }
 return placed;
}
