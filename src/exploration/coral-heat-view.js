import {colorFor,daysInYear} from './climate-history-model.js?v=whole-trends20-20261025';
import {createCoralHeatField} from './coral-heat-field.js?v=coral-current-20261023';

export const CORAL_ARRIVAL_MS=1500;
const clamp=v=>Math.max(0,Math.min(1,v));
// Screen-space symbols, not inferred water-temperature footprints. Keep zero
// and missing records selectable; cap the glyph without capping the source value.
export function coralGlyph(row,year){
  const missing=!Number.isFinite(row?.max),heat=missing?0:clamp(row.max/16);
  const color=colorFor('coral',row?.max);
  return {missing,heat,radius:missing?9:11+18*Math.sqrt(heat),color,
    rgb:[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255),
    duration:Number.isFinite(row?.days8)?clamp(row.days8/daysInYear(year)):0};
}
export function coralArrival(index,count,elapsed,reduced=false){
  if(elapsed<0)return 0;
  if(reduced)return 1;
  const p=clamp((elapsed-(count>1?index/(count-1):0)*650)/850);
  return p*p*(3-2*p);
}
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec4 placement;
layout(location=1) in vec4 appearance;
layout(location=2) in vec2 flags;
uniform vec2 resolution;
out vec2 local;
flat out vec4 ink;
flat out vec2 state;
flat out float opacity;
const vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
void main(){local=corners[gl_VertexID];ink=appearance;state=flags;opacity=placement.w;
 vec2 pixel=placement.xy+local*placement.z;
 gl_Position=vec4(pixel/resolution*vec2(2,-2)+vec2(-1,1),0,1);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 local;
flat in vec4 ink;
flat in vec2 state;
flat in float opacity;
out vec4 result;
void main(){
 float r=length(local),edge=fwidth(r);
 float halo=exp(-r*r*5.5)*.38*(1.-smoothstep(.7,1.,r));
 float core=1.-smoothstep(.105,.19,r);
 float a=fract(atan(local.y,local.x)/6.2831853+.25);
 float duration=(1.-smoothstep(.012,.012+edge,abs(r-.68)))*step(a,ink.w)*.65;
 float selected=(1.-smoothstep(.012,.012+edge,abs(r-.4)))*state.x;
 if(state.y>.5){halo=0.;core=(1.-smoothstep(.025,.025+edge,abs(r-.24)))*.65;duration=0.;}
 float alpha=clamp(halo+core*.95+duration+selected*.9,0.,1.)*opacity;
 vec3 rgb=mix(ink.rgb,vec3(1.,.92,.7),selected);
 rgb=mix(rgb,vec3(1.,.96,.86),core*.4*(1.-state.y));
 result=vec4(rgb*alpha,alpha);
}`;

export function createCoralHeatView(){
  let canvas,gl,program,vao,buffer,resolution,engine='idle',error='',draws=0,contexts=0;
  let points=[],paintCount=0;
  const sprites=new Map();
  const field=createCoralHeatField();
  const changed=()=>globalThis.dispatchEvent?.(new Event('gaia:coral-renderer-change'));
  function release(){
    field.reset(gl);
    if(gl&&!gl.isContextLost()){if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);if(vao)gl.deleteVertexArray(vao);}
    program=buffer=vao=null;
  }
  function initialize(){
    if(program)return true;if(['lost','unavailable','error'].includes(engine))return false;
    canvas??=document.createElement('canvas');
    canvas.dataset.coralHeat='true';
    if(!gl){
      gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
      if(!gl){engine='unavailable';return false;}contexts++;
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();engine='lost';release();changed();});
      canvas.addEventListener('webglcontextrestored',()=>{engine='idle';changed();});
    }
    const shaders=[];
    try{
      for(const [type,source]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));}
      program=gl.createProgram();for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      vao=gl.createVertexArray();gl.bindVertexArray(vao);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [index,size,offset]of[[0,4,0],[1,4,4],[2,2,8]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,40,offset*4);gl.vertexAttribDivisor(index,1);}
      resolution=gl.getUniformLocation(program,'resolution');engine='webgl2';return true;
    }catch(e){error=e.message;release();engine='error';return false;}
    finally{for(const shader of shaders)gl.deleteShader(shader);}
  }
  function fallback(ctx,p){
    const {x,y,radius:r,color,missing,duration,chosen,alpha}=p;
    ctx.globalAlpha=alpha;
    if(!missing){
      if(!sprites.has(color)){const s=document.createElement('canvas');s.width=s.height=96;const c=s.getContext('2d'),g=c.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,color+'8c');g.addColorStop(.4,color+'3d');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,96,96);sprites.set(color,s);}
      ctx.drawImage(sprites.get(color),x-r,y-r,r*2,r*2);
    }
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,r*(missing?.24:.15),0,Math.PI*2);missing?ctx.stroke():ctx.fill();
    if(duration>0){ctx.beginPath();ctx.arc(x,y,r*.68,-Math.PI/2,-Math.PI/2+duration*Math.PI*2);ctx.stroke();}
    if(chosen){ctx.strokeStyle='#ffebba';ctx.beginPath();ctx.arc(x,y,r*.4,0,Math.PI*2);ctx.stroke();}
  }
  function paint(ctx,{regions,year,selectedId,xy,scale,width,height,ratio,elapsed,reduced}){
    points=[];const instances=[];
    // Geographic ordering makes the single reveal travel through the reefs,
    // independent of data-file ordering. It does not imply heat propagation.
    const ordered=[...regions].sort((a,b)=>((a.lon+390)%360)-((b.lon+390)%360)||b.lat-a.lat);
    const fieldRegions=ordered.map(region=>({lon:region.lon,lat:region.lat,...coralGlyph(region.years.find(r=>r.year===year),year)}));
    for(const [i,region]of ordered.entries()){
      const p=xy(region.lon,region.lat),glyph=coralGlyph(region.years.find(r=>r.year===year),year);
      if(p.x< -35||p.y< -35||p.x>width+35||p.y>height+35)continue;
      const progress=coralArrival(i,regions.length,elapsed,reduced);if(!progress)continue;
      const chosen=region.id===selectedId,radius=glyph.radius*(.4+.6*progress),alpha=progress;
      const point={...p,...glyph,radius,alpha,chosen,id:region.id,lon:region.lon,lat:region.lat};points.push(point);
      instances.push(p.x,p.y,radius,alpha,...glyph.rgb,glyph.duration,Number(chosen),Number(glyph.missing));
    }
    const gpu=initialize();
    if(gpu){const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;}
    field.paint(ctx,{gl:gpu?gl:null,regions:fieldRegions,year,xy,scale,width,height,ratio,alpha:coralArrival(0,1,elapsed,reduced),elapsed,reduced});
    if(gpu){
      const w=canvas.width,h=canvas.height;
      gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(instances),gl.DYNAMIC_DRAW);gl.uniform2f(resolution,width,height);gl.drawArraysInstanced(gl.TRIANGLES,0,6,points.length);ctx.drawImage(canvas,0,0,width,height);draws++;
    }else for(const p of points)fallback(ctx,p);
    ctx.globalAlpha=1;paintCount++;
    return points.filter(p=>p.alpha>=.9);
  }
  return {paint,reset(){points=[];sprites.clear();release();if(canvas){canvas.width=canvas.height=1;}if(engine==='webgl2')engine='idle';},
    getState:()=>({engine,error,draws,contexts,paintCount,glyphs:points.length,width:canvas?.width||0,height:canvas?.height||0,field:field.getState()})};
}
