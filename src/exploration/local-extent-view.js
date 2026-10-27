import {earthLongitudeToMapX} from './world-projection.js';
import {poiArrival} from './annual-poi-arrival.js';
import {atlasColor,atlasFormat,atlasRow} from './atlas-history-model.js?v=release100-c363-20261027';
export function placeAtlasGauge(point,{above,below,halfWidth},obstacles,bottom) {
  let y=point.y;
  for(const r of [...obstacles].sort((a,b)=>a.top-b.top)) {
    if(point.x+halfWidth<=r.left||point.x-halfWidth>=r.right||y+below<=r.top||y-above>=r.bottom)continue;
    const next=r.bottom+12+above;
    if(next+below<=bottom-12)y=next;
  }
  return {...point,y};
}

// Data-backed marks only: broad GRACE boxes, basin gauges, national polygons.
// No interpolated global texture, decorative station clouds, or point-as-area data.
export function paintExtent(ctx,{definition:d,data,year,month,selectedId,view,elapsed,reduced,onSurface}){
const points=[],compact=view.rect.width<=900;const xy=(lon,lat)=>({x:view.x+earthLongitudeToMapX(lon)*view.scale,y:view.y+(90-lat)*view.scale});
const localRect=e=>{const r=e.getBoundingClientRect();return {left:r.left-view.rect.left,right:r.right-view.rect.left,top:r.top-view.rect.top,bottom:r.bottom-view.rect.top}};
const obstacles=[...document.querySelectorAll('.gaia-climate-legend,#map-scope-note')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(localRect);const dock=document.querySelector('.gaia-climate-readout'),bottom=!compact&&dock?.checkVisibility({visibilityProperty:true})?localRect(dock).top:view.rect.height;
const text=(s,x,y,size=13,color='#deefec')=>{ctx.font=size+'px serif';ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#061720';ctx.strokeText(s,x,y);ctx.fillStyle=color;ctx.fillText(s,x,y)};
      // A fixed area scale, not invented ice/snow boundaries. Compare one region
      // on compact screens; desktop keeps regions separate, including the total.
      const regions=compact?data.regions.filter(r=>r.id===selectedId):data.regions;
      const max=Math.max(...data.regions.flatMap(r=>r.years.flatMap(y=>y.monthValues).filter(Number.isFinite)));
      const compactTop=compact?Math.max(0,...[...document.querySelectorAll('.gaia-climate-legend,#map-stable-navigation,.japan-heading')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>localRect(e).bottom))+12:0;
      const compactBottom=compact?Math.min(view.rect.height,...[...document.querySelectorAll('.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom,#map-mobile-toolbar')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>localRect(e).top))-12:bottom;
      const radius=compact?Math.max(18,Math.min(75,view.rect.width*.19,(compactBottom-compactTop-92)/2)):Math.min(108,view.rect.width*.065);
      for(const [index,r]of regions.entries()){
        const a=poiArrival(index,regions.length,elapsed,reduced);if(!a.alpha)continue;
        const geographic=xy(r.lon,r.lat),v=atlasRow(r,year,month)?.value,base=atlasRow(r,2000,month)?.value;
        // Keep aggregate symbols readable; the fine leader points to the region.
        const aggregate=r.id==='nhland';
        const halfWidth=Math.max(radius+10,compact?100:r.name.length*8+12);
        const p=compact?{x:view.rect.width*.5,y:(compactTop+compactBottom-12)*.5}:{
          x:Math.max(halfWidth+18,Math.min(view.rect.width-halfWidth-18,aggregate?view.rect.width*.5:geographic.x)),
          y:aggregate?view.rect.height*.61:geographic.y,
        };
        if(!compact){
          p.y=Math.max(radius+180,Math.min(bottom-radius-58,p.y));
          p.y=placeAtlasGauge(p,{halfWidth,above:radius+44,below:radius+48},obstacles,bottom).y;
          for(const b of obstacles)if(p.x+halfWidth>b.left&&p.x-halfWidth<b.right&&p.y+radius+48>b.top&&p.y-radius-44<b.bottom)p.x=Math.max(halfWidth+18,b.left-halfWidth-16);
        }
        const color=atlasColor(d,v),size=Number.isFinite(v)?radius*Math.sqrt(v/max):0;
        onSurface?.({id:r.id,x:p.x,y:p.y,radius,size,value:v,max,alpha:a.alpha,values:r.years.find(y=>y.year===year)?.monthValues||[]});
        ctx.save();ctx.globalAlpha=a.alpha;
        if(!compact&&!aggregate&&Math.hypot(p.x-geographic.x,p.y-geographic.y)>12){ctx.strokeStyle='#bce3ef25';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(geographic.x,geographic.y);ctx.lineTo(p.x,p.y);ctx.stroke();}
        ctx.strokeStyle='#bce3ef35';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.stroke();
        if(d.id==='snowcover'){
          // Twelve equal-angle sectors: area, not radius, is proportional to
          // that month's snow extent. This is a seasonal diagram, not a snow map.
          const values=r.years.find(y=>y.year===year)?.monthValues||[];
          const baseline=r.years.find(y=>y.year===2000)?.monthValues||[];
          for(let m=0;m<12;m++){
            const start=-Math.PI/2+m*Math.PI/6+.018,end=start+Math.PI/6-.036,mid=(start+end)/2;
            const extent=values[m],rad=Number.isFinite(extent)?radius*Math.sqrt(extent/max):0;
            if(rad>0){const fill=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rad);fill.addColorStop(0,'#2f637e22');fill.addColorStop(1,m+1===month?'#eaf9f1cc':'#91c7da77');ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,rad,start,end);ctx.closePath();ctx.fill();ctx.strokeStyle=m+1===month?'#f8e0ae':'#b4dcea55';ctx.lineWidth=m+1===month?1.5:.7;ctx.stroke();}
            if(Number.isFinite(baseline[m])){ctx.setLineDash([2,3]);ctx.strokeStyle='#f2dfb580';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(p.x,p.y,radius*Math.sqrt(baseline[m]/max),start,end);ctx.stroke();ctx.setLineDash([]);}
            text(String(m+1),p.x+Math.cos(mid)*(radius+11),p.y+Math.sin(mid)*(radius+11)+3,compact?8:10,m+1===month?'#ffe4ac':'#96b8c8');
          }
        }else if(Number.isFinite(v)&&size>0){
          const fill=ctx.createRadialGradient(p.x-size*.25,p.y-size*.35,0,p.x,p.y,size);fill.addColorStop(0,'#e4ffffcc');fill.addColorStop(.65,color);fill.addColorStop(1,'#356a8566');
          ctx.fillStyle=fill;ctx.globalAlpha=a.alpha*.68;ctx.beginPath();ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=a.alpha;
          ctx.strokeStyle=r.id===selectedId?'#e9fff8':color;ctx.lineWidth=r.id===selectedId?1.8:1;ctx.stroke();
        }
        if(d.id!=='snowcover'&&Number.isFinite(base)){ctx.setLineDash([3,5]);ctx.strokeStyle='#f2dfb580';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,radius*Math.sqrt(base/max),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
        text(r.name,p.x,p.y-radius-(d.id==='snowcover'?29:17),compact?12:16);
        text(`${atlasFormat(v)}${Number.isFinite(v)?' 百万km²':''}`,p.x,p.y+radius+25,compact?15:21);
        text(`${month}月 · 破線は2000年`,p.x,p.y+radius+44,compact?10:12,'#aac5d0');
        points.push({...p,id:r.id,lon:r.lon,lat:r.lat,box:{x:p.x-halfWidth,y:p.y-radius-48,w:halfWidth*2,h:radius*2+100}});ctx.restore();
      }
return {state:'ready',points};
}
