import {earthLongitudeToMapX} from './world-projection.js?v=gaia-japan-center-1';
import {tideColor} from './sea-level-stations.js?v=release100-c363-20261027';
import {seaArrival,seaSigned,seaStem,spacedSeaStations,seaCallout} from './sea-level-marks.js?v=release100-c363-20261027';
import {createSeaSurfaceView} from './sea-surface-view.js?v=surface-release-2e596f2-20261028';
import {createMapTextLayer} from './map-text-layer.js?v=country-text-halo-20261027';

// Coastline observations remain at the supplied coordinates. Stems encode a
// signed height difference. Nearshore colour follows these same source values;
// offshore colour blends the satellite means. Lighting is decorative.
export function createSeaLevelView(){
  const surface=createSeaSurfaceView(),textLayer=createMapTextLayer('sea-level');
  let points=[],paintCount=0,marksPaintCount=0,readings=[],marks,marksCtx,marksKey='';
  function paintMarks(ctx,{stations,basins,year,selectedId,view,elapsed,reduced}){
    points=[];readings=[];marksPaintCount++;
    const xy=r=>({x:view.x+earthLongitudeToMapX(r.lon)*view.scale,y:view.y+(90-r.lat)*view.scale});
    const candidates=stations.map(r=>({...xy(r),r,value:r.years.find(y=>y.year===year)?.value})).filter(p=>p.x>=-15&&p.x<=view.rect.width+15&&p.y>=-30&&p.y<=view.rect.height+30);
    // Stable station IDs, not current values, determine the sparse overview.
    // Zoom resolves close stations; the chosen station always stays visible.
    const shown=spacedSeaStations(candidates,selectedId,view.rect.width<901?12:10);
    for(const p of shown){
      const alpha=seaArrival(elapsed,p.r.lon,reduced);if(!alpha)continue;
      const chosen=p.r.id===selectedId,finite=Number.isFinite(p.value),stem=seaStem(p.value),top=p.y-stem,color=tideColor(p.value);
      ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=chosen?2:1.25;ctx.fillStyle=color;
      if(finite){
        const halo=ctx.createRadialGradient(p.x,top,0,p.x,top,chosen?15:7);halo.addColorStop(0,color);halo.addColorStop(1,'transparent');
        ctx.globalAlpha=alpha*(chosen?.28:.16);ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,top,chosen?15:7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=alpha;
        ctx.strokeStyle=color;if(Math.abs(stem)>1){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,top);ctx.stroke();}
        ctx.strokeStyle='#b6d7de70';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x-3,p.y);ctx.lineTo(p.x+3,p.y);ctx.stroke();
      }
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(p.x,top,chosen?4.5:2.7,0,Math.PI*2);
      if(finite){ctx.fill();ctx.strokeStyle='#c9f2f080';ctx.lineWidth=.6;ctx.stroke();}else ctx.stroke();
      if(chosen){
        ctx.strokeStyle='#ffdf9b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,top,9,0,Math.PI*2);ctx.stroke();
        const label=seaCallout(p.x,p.y,view.rect.width),text=seaSigned(p.value);
        ctx.strokeStyle='#b5ccd580';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(p.x+label.dir*10,top);ctx.lineTo(p.x+label.dir*23,p.y+1);ctx.lineTo(label.endX,p.y+1);ctx.stroke();
        ctx.textAlign=label.align;ctx.font='12px serif';let name=p.r.name;
        while(name.length>1&&ctx.measureText(name+'…').width>label.maxWidth)name=name.slice(0,-1);
        if(name!==p.r.name)name+='…';ctx.lineWidth=3;ctx.strokeStyle='#07172199';ctx.strokeText(name,label.tx,label.nameY);ctx.fillStyle='#d5e7e9';ctx.fillText(name,label.tx,label.nameY);
        ctx.font='20px serif';ctx.strokeText(text,label.tx,label.valueY,label.maxWidth);ctx.fillStyle=finite?color:'#a5b8c1';ctx.fillText(text,label.tx,label.valueY,label.maxWidth);
        readings.push({id:p.r.id,text,value:p.value,station:true,alpha,...label});
      }
      ctx.restore();if(alpha>.9)points.push({id:p.r.id,lon:p.r.lon,lat:p.r.lat,x:p.x,y:p.y,tipY:top,station:true});
    }
    // Satellite aggregates are explicitly labelled ocean means. Exact readings
    // remain tied to the three source series, separate from coastal stations.
    if(view.rect.width>900||!selectedId.startsWith('tide-'))for(const r of basins){
      const p=xy(r),alpha=seaArrival(elapsed,0,reduced);if(p.x<0||p.x>view.rect.width||p.y<0||p.y>view.rect.height||!alpha)continue;
      const value=r.years.find(row=>row.year===year)?.value,text=seaSigned(value),chosen=r.id===selectedId;
      ctx.save();ctx.globalAlpha=alpha;ctx.font='11px serif';ctx.textAlign='center';ctx.fillStyle=chosen?'#ffdf9b':'#d2e9eb';ctx.strokeStyle=chosen?'#ffdf9b':'#a6d4deaa';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+6,p.y);ctx.lineTo(p.x,p.y+6);ctx.lineTo(p.x-6,p.y);ctx.closePath();ctx.stroke();
      ctx.lineWidth=3;ctx.strokeStyle='#07172199';ctx.strokeText(`${r.name}・衛星平均`,p.x,p.y-16);ctx.fillText(`${r.name}・衛星平均`,p.x,p.y-16);
      ctx.font='18px serif';ctx.strokeText(text,p.x,p.y+28);ctx.fillText(text,p.x,p.y+28);ctx.restore();readings.push({id:r.id,value,text,station:false,alpha,tx:p.x,valueY:p.y+28});
      if(alpha>.9)points.push({...p,id:r.id,lon:r.lon,lat:r.lat,station:false});
    }
    return {state:'ready',points};
  }
  function paint(ctx,options){
    const {view,year,selectedId,elapsed,reduced,ratio=1}=options;paintCount++;
    surface.paint(ctx,{...options,alpha:seaArrival(elapsed,0,reduced)});
    marks??=document.createElement('canvas');marksCtx??=marks.getContext('2d');
    const w=Math.max(1,Math.round(view.rect.width*ratio)),h=Math.max(1,Math.round(view.rect.height*ratio));
    const key=[year,selectedId,view.x,view.y,view.scale,w,h,reduced,Math.min(950,elapsed)].join('/');
    if(key!==marksKey){
      if(marks.width!==w)marks.width=w;if(marks.height!==h)marks.height=h;
      marksCtx.setTransform(ratio,0,0,ratio,0,0);marksCtx.clearRect(0,0,view.rect.width,view.rect.height);
      textLayer.record(marksCtx,textCtx=>paintMarks(textCtx,options),{host:options.labelHost,width:view.rect.width,height:view.rect.height,view,ratio,key:[year,selectedId].join('/')});marksKey=key;
    }
    ctx.drawImage(marks,0,0,view.rect.width,view.rect.height);
    return {state:'ready',points};
  }
  function pick(x,y,view){
    x-=view.rect.left;y-=view.rect.top;
    return points.map(p=>({p,d:Math.hypot(x-p.x,y-Math.max(Math.min(p.y,p.tipY??p.y),Math.min(y,Math.max(p.y,p.tipY??p.y))))})).filter(o=>o.d<=14).sort((a,b)=>a.d-b.d)[0]?.p||null;
  }
  return {paint,pick,presentLabels:fade=>textLayer.present(1,fade),reset:()=>{surface.reset();textLayer.reset();points=[];readings=[];marksKey='';if(marks)marks.width=marks.height=1;},getState:()=>({engine:surface.getState().engine,surface:surface.getState(),paintCount,marksPaintCount,visible:points.length,stations:points.filter(p=>p.station).length,readings,textLayer:textLayer.getState()})};
}
