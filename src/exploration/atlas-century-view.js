import {poiArrival} from './annual-poi-arrival.js?v=20260909';
import {ATLAS_GLYPH_TYPES} from './atlas-data-webgl.js?v=release100-c363-20261027';

// Physical measurements get full-size, purpose-specific diagrams. Event marks
// retain actual coordinates. All share one GPU context and the map's clock.
export function paintCentury(ctx,{definition:d,data,year,selectedId,view,elapsed,reduced,onSurface},gpu,xy){
  const {width,height}=view.rect,compact=width<=900,points=[],instances=[],bounds=[];
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left-view.rect.left,right:r.right-view.rect.left,top:r.top-view.rect.top,bottom:r.bottom-view.rect.top};};
  const visible=selector=>[...document.querySelectorAll(selector)].filter(e=>e.checkVisibility({visibilityProperty:true})).map(rect);
  const blockers=visible('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,#map-scope-note');
  const top=Math.max(128,...visible('#map-stable-navigation,.japan-heading').map(r=>r.bottom),...(compact||d.id==='oceanheat'?visible('.gaia-climate-legend').map(r=>r.bottom):[]),...(!compact&&d.id==='oceanheat'?visible('#map-scope-note').map(r=>r.bottom):[]))+(compact?8:22);
  const bottom=Math.min(height-12,...visible('.gaia-climate-readout,#map-mobile-toolbar,#map-mobile-bottom,#map-responsive-data').map(r=>r.top))-(compact?8:20);
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
      onSurface?.({id:d.id,x:p.x,y:p.y,size,value:e.magnitude,alpha});
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
  return {points,glyphs:0,bounds,engine:gpu.state().engine};
}
