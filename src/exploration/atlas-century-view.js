import {poiArrival} from './annual-poi-arrival.js?v=20260909';
import {atlasRow,atlasFormat} from './atlas-history-model.js?v=whole-trends20-20261025';
import {ATLAS_GLYPH_TYPES} from './atlas-data-webgl.js?v=atlas-100-20261022';

// Physical measurements get full-size, purpose-specific diagrams. Event marks
// retain actual coordinates. All share one GPU context and the map's clock.
export function paintCentury(ctx,{definition:d,data,year,selectedId,view,elapsed,reduced},gpu,xy){
  const {width,height}=view.rect,compact=width<=900,points=[],instances=[],bounds=[];
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left-view.rect.left,right:r.right-view.rect.left,top:r.top-view.rect.top,bottom:r.bottom-view.rect.top};};
  const visible=selector=>[...document.querySelectorAll(selector)].filter(e=>e.checkVisibility({visibilityProperty:true})).map(rect);
  const blockers=visible('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,#map-scope-note');
  const top=Math.max(128,...visible('#map-stable-navigation,.japan-heading').map(r=>r.bottom),...(compact||d.id==='oceanheat'?visible('.gaia-climate-legend').map(r=>r.bottom):[]),...(!compact&&d.id==='oceanheat'?visible('#map-scope-note').map(r=>r.bottom):[]))+(compact?8:22);
  const bottom=Math.min(height-12,...visible('.gaia-climate-readout,#map-mobile-bottom,#map-responsive-data').map(r=>r.top))-(compact?8:20);
  const right=compact?width-24:Math.min(width-50,...visible('.gaia-climate-legend').map(r=>r.left-40));
  const left=compact?24:Math.max(80,width*.08),chartWidth=Math.max(120,right-left),chartHeight=Math.max(60,bottom-top);
  const center=(left+right)/2,kind=ATLAS_GLYPH_TYPES[d.id];
  const text=(str,x,y,size=14,color='#d9eee9',align='center')=>{ctx.font=`${size}px serif`;ctx.textAlign=align;ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle='#061720';ctx.strokeText(str,x,y);ctx.fillStyle=color;ctx.fillText(str,x,y);};
  const stroke=(color,points,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();for(const [i,p]of points.entries())i?ctx.lineTo(...p):ctx.moveTo(...p);ctx.stroke();};
  const draw=()=>gpu.paint(ctx,instances,{width,height,ratio:ctx.canvas.width/width,kind});
  if(d.view==='events'){
    const events=data.events.filter(e=>e.year===year&&Number.isFinite(e.lon)&&Number.isFinite(e.lat));
    for(const [i,e]of events.entries()){
      const a=poiArrival(i,events.length,elapsed,reduced),p=xy(e.lon,e.lat),chosen=selectedId==='ALL'||e.region===selectedId;
      const size=compact?18:25,b={left:p.x-size,right:p.x+size,top:p.y-size,bottom:p.y+size};
      if(b.left<0||b.right>width||b.top<0||b.bottom>bottom||blockers.some(r=>b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top))continue;
      const alpha=a.alpha*(chosen?1:.3);if(!alpha)continue;
      instances.push([p.x,p.y,size,size,e.magnitude??-1,0,chosen?1:0,alpha,.53,.83,.87]);
      if(a.alpha>=.9)points.push({...p,size,id:e.region,lon:e.lon,lat:e.lat,event:e,box:{x:p.x-size,y:p.y-size,w:size*2,h:size*2}});
    }
    const rendered=draw();
    if(!rendered)for(const p of points){ctx.strokeStyle='#acdcd6';ctx.lineWidth=1.5;ctx.beginPath();if(d.id==='volcanoes'){ctx.moveTo(p.x-8,p.y+6);ctx.lineTo(p.x,p.y-7);ctx.lineTo(p.x+8,p.y+6);}else for(let i=0;i<3;i++){ctx.moveTo(p.x-8,p.y+i*3-3);ctx.quadraticCurveTo(p.x,p.y+i*3-8,p.x+8,p.y+i*3-3);}ctx.stroke();}
    const labels=[];
    for(const p of points){
      if(selectedId!=='ALL'&&p.id!==selectedId)continue;
      const name=p.event.name,font=compact?11:14;ctx.font=`${font}px serif`;
      const half=Math.min(compact?88:130,ctx.measureText(name).width/2+6);
      const candidates=[{x:p.x,y:p.y+p.size+15},{x:p.x,y:p.y-p.size-25}];
      const label=candidates.find(c=>{const b={left:c.x-half,right:c.x+half,top:c.y-font,bottom:c.y+16};return b.left>8&&b.right<width-8&&b.top>top-10&&b.bottom<bottom&&!blockers.concat(labels).some(r=>b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top);});
      if(!label)continue;
      const b={left:label.x-half,right:label.x+half,top:label.y-font,bottom:label.y+16};labels.push(b);
      ctx.save();ctx.globalAlpha=poiArrival(0,1,elapsed,reduced).alpha;text(name,label.x,label.y,font,'#f4dcb5');
      text(`${p.event.month??'—'}/${p.event.day??'—'}${d.id==='volcanoes'?` · VEI ${p.event.magnitude??'未記録'}`:''}`,label.x,label.y+15,compact?9:11,'#a5c8d2');ctx.restore();
    }
    // A sparse year remains explicit, without filling the map with fake points.
    if(!events.length)text(`${year}年 · 位置を表示できる対象の記録なし`,center,(top+bottom)/2,compact?12:19);
    else if(!instances.length&&elapsed>1500)text('この表示範囲に記録位置なし',center,(top+bottom)/2,compact?11:17);
    return {points,glyphs:instances.length,bounds,engine:gpu.state().engine};
  }
  const regions=compact?data.regions.filter(r=>r.id===selectedId):data.regions,panels=[];
  const a=poiArrival(0,1,elapsed,reduced);if(!a.alpha)return {points,glyphs:0,bounds};
  if(bottom-top<88)return {points,glyphs:0,bounds};
  const h=Math.min(d.id==='ozone'?145:155,Math.max(10,(bottom-top-68)*.5),chartWidth*.32);
  const y=compact?top+24+h:(top+bottom-16)/2;
  for(const r of regions){
    const row=atlasRow(r,year),v=row?.value;
    const w=d.id==='oceanheat'?Math.min(compact?65:85,chartWidth*.22):d.id==='glaciers'?Math.min(255,chartWidth*.39):h;
    // Basin labels follow real longitude rather than arbitrary array order.
    const x=!compact&&d.id==='oceanheat'?Math.max(w+50,Math.min(width-w-50,xy(r.lon,r.lat).x)):center;
    panels.push({r,row,x,y,w,h});
    bounds.push({id:r.id,left:x-w-30,right:x+w+30,top:y-h-24,bottom:y+h+40});
    points.push({id:r.id,x,y,lon:r.lon,lat:r.lat,box:{x:x-w,y:y-h,w:w*2,h:h*2}});
    if(d.id==='glaciers'){
      const span=w*1.68,step=span/(d.end-d.start);
      for(const p of r.years.filter(p=>p.year<=year&&Number.isFinite(p.value)))instances.push([x-w*.84+(p.year-d.start)*step,y,step*.49,h,-p.value/30,0,0,a.alpha,.62,.81,.86]);
    }else instances.push([x,y,w,h,d.id==='ozone'?(Number.isFinite(v)?v/30:-1):(v??0)/15,0,r.id===selectedId?1:0,a.alpha,.62,.81,.86,(row?.upper??0)/10,(row?.deep??0)/10,0,0]);
  }
  // Soften map detail behind aggregate diagrams, without an opaque card/frame.
  ctx.save();ctx.globalAlpha=a.alpha;
  for(const {x,y,w,h}of panels){ctx.save();ctx.translate(x,y);ctx.scale(w+55,h+50);const veil=ctx.createRadialGradient(0,0,.1,0,0,1.2);veil.addColorStop(0,'#061822ed');veil.addColorStop(.65,'#061822b5');veil.addColorStop(1,'#06182200');ctx.fillStyle=veil;ctx.fillRect(-1.2,-1.2,2.4,2.4);ctx.restore();}
  ctx.restore();const rendered=draw();ctx.save();ctx.globalAlpha=a.alpha;
  for(const {r,row,x,y,w,h}of panels){
    const v=row?.value;
    text(d.id==='ozone'?'南極 · 春のオゾンホール':r.name,x,y-h-12,compact?12:19);
    if(d.id==='oceanheat'){
      const split=y-h+h*2*.35;
      if(!rendered){ctx.fillStyle='#bcb29b66';ctx.fillRect(x-w*.84,y-h,w*1.68,h*2*.35);ctx.fillStyle='#638eae66';ctx.fillRect(x-w*.84,split,w*1.68,h*2*.65);}
      for(const [depth,yy]of[[0,y-h],[700,split],[2000,y+h]]){stroke('#c8e8e45a',[[x-w*.9,yy],[x+w*.9,yy]]);text(`${depth}`,x-w*.94,yy+4,compact?9:11,'#a5c8d2','right');}
      text('m',x-w*.95,y+h+17,10,'#a5c8d2','right');
      text(atlasFormat(row?.upper),x,y-h+h*.35+5,compact?16:24,'#ffe1ba');
      text(atlasFormat(row?.deep),x,split+h*.65+5,compact?16:24,'#ffe1ba');
      text(`${atlasFormat(v)} ×10²² J`,x,y+h+27,compact?12:17);
    }else if(d.id==='ozone'){
      if(!rendered){ctx.strokeStyle='#b7b5d5';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,h*.84,0,Math.PI*2);ctx.stroke();if(Number.isFinite(v)){ctx.fillStyle='#a3b8d94d';ctx.beginPath();ctx.arc(x,y,h*.84*Math.sqrt(v/30),0,Math.PI*2);ctx.fill();}}
      text(Number.isFinite(v)?atlasFormat(v):'欠測',x,y+5,compact?27:47,'#f2e6ed');
      text('百万km²',x,y+(compact?24:36),compact?10:14,'#bcb9d2');
      text('面積比較 · 外周30百万km²',x,y+h+27,compact?10:13,'#afc4cf');
    }else{
      const zero=y-h,level=zero+h*2*Math.max(0,Math.min(1,-(v??0)/30));
      for(const amount of [0,10,20,30]){const yy=zero+h*2*amount/30;stroke('#a3c9dd44',[[x-w*.9,yy],[x+w*.9,yy]]);text(amount===0?'0':`−${amount}`,x-w*.96,yy+4,compact?9:12,'#a5c8d2','right');}
      text(`${atlasFormat(v)} m水当量`,x,y+h+37,compact?13:21);
      text('1970',x-w*.84,y+h+15,compact?9:11,'#a5c8d2');text('2024',x+w*.84,y+h+15,compact?9:11,'#a5c8d2');
      const history=r.years.filter(r=>r.year<=year&&Number.isFinite(r.value));
      const path=history.map(p=>[x-w*.84+(p.year-d.start)/(d.end-d.start)*w*1.68,zero+h*2*(-p.value/30)]);
      if(!rendered&&path.length){ctx.fillStyle='#9bdde044';ctx.beginPath();ctx.moveTo(path[0][0],zero);for(const p of path)ctx.lineTo(...p);ctx.lineTo(path.at(-1)[0],zero);ctx.closePath();ctx.fill();}
      stroke('#e0f5efa8',path,1.4);
      if(path.length)stroke('#f6dfaaa0',[[path.at(-1)[0],zero],[path.at(-1)[0],level]],1);
    }
  }
  ctx.restore();return {points,glyphs:instances.length,bounds,engine:gpu.state().engine};
}
