import {earthLongitudeToMapX} from './world-projection.js?v=gaia-japan-center-1';
import {waterCell,waterRgba} from './water-storage-grid.js?v=water-gis-20261022';
import {waterDisplayField,WATER_FIELD_SIGMA} from './water-storage-field.js?v=water-smooth-20261023';
import {waterFieldArrival,waterPoiState} from './water-storage-poi.js?v=water-poi-20261023';
import {createMapTextLayer} from './map-text-layer.js?v=country-text-halo-20261027';

// Rasterise once per year, then reproject the small texture with the shared
// camera. No particle motion pretending to be subsurface water transport.
export function createWaterStorageView() {
  const textLayer=createMapTextLayer('water-storage');
  let grid,texture,textureYear,textureCount=0,engine='idle',gl,program,uniform,vertices,valuesTexture,lost=false,markers=[];
  const gpu=document.createElement('canvas');gpu.width=720;gpu.height=360;
  gpu.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;textureYear=null;dispatchEvent(new Event('gaia:atlas-renderer-change'));});
  gpu.addEventListener('webglcontextrestored',()=>{gl=null;program=null;lost=false;textureYear=null;dispatchEvent(new Event('gaia:atlas-renderer-change'));});
  function initGpu(){
    if(lost)return false;
    try{
      gl ||= gpu.getContext('webgl2',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false});if(!gl)return false;
      if(program)return true;
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('GRACE shader');return s;};
      const v=shader(gl.VERTEX_SHADER,'#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}');
      const f=shader(gl.FRAGMENT_SHADER,`#version 300 es
        precision highp float;uniform sampler2D field;out vec4 color;
        void main(){float v=texelFetch(field,ivec2(int(gl_FragCoord.x),359-int(gl_FragCoord.y)),0).r;
          if(v>90000.0){color=vec4(0);return;}
          if(v>80000.0){color=vec4(vec3(83.,101.,109.)/255.,70./255.);return;}
          float t=min(1.,abs(v)/30.);vec3 b=v<0.?vec3(217,157,100):vec3(111,225,213);
          color=vec4(mix(vec3(39,67,76),b,t)/255.,(55.+150.*t)/255.);}`);
      program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('GRACE shader link');
      gl.useProgram(program);vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
      valuesTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,valuesTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      uniform=gl.getUniformLocation(program,'field');return true;
    }catch{gl=null;program=null;return false;}
  }
  function raster(year){
    if(textureYear===year)return texture;
    const values=waterDisplayField(grid,year);
    texture ||= document.createElement('canvas');texture.width=720;texture.height=360;const ctx=texture.getContext('2d');
    if(initGpu()){
      gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,valuesTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,720,360,0,gl.RED,gl.FLOAT,values);gl.uniform1i(uniform,0);gl.viewport(0,0,720,360);gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(gpu,0,0);engine='webgl2';
    }else{
      const image=ctx.createImageData(720,360);
      for(let i=0;i<values.length;i++){if(values[i]>90000)continue;image.data.set(waterRgba(values[i]>80000?null:values[i]),i*4);}
      ctx.putImageData(image,0,0);engine='canvas2d';
    }
    textureCount++;textureYear=year;return texture;
  }
  function paint(ctx,options){
    const {view,year,cell,region,labelHost,ratio=1}=options;
    return textLayer.record(ctx,textCtx=>paintContent(textCtx,options),{host:labelHost,width:view.rect.width,height:view.rect.height,view,ratio,key:[year,cell?.id,region?.id].join('/')});
  }
  function paintContent(ctx,{data,year,view,elapsed,reduced,cell,region,regions}){
    if(grid!==data){grid=data;textureYear=null;}
    const image=raster(year),alpha=waterFieldArrival(elapsed,reduced),world=360*view.scale;
    ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    // 30°W is the main map's cut. Keep the source rows north-up and wrap twice.
    for(let copy=-1;copy<=1;copy++){
      const x=view.x+copy*world;
      ctx.drawImage(image,300,0,420,360,x,view.y,210*view.scale,180*view.scale);
      ctx.drawImage(image,0,0,300,360,x+210*view.scale,view.y,150*view.scale,180*view.scale);
    }
    ctx.lineWidth=1;ctx.font=`${view.rect.width<901?11:14}px serif`;ctx.textAlign='center';
    if(region&&!cell){
      const [w,s,e,n]=region.bounds,x=view.x+earthLongitudeToMapX(w)*view.scale,y=view.y+(90-n)*view.scale;
      ctx.strokeStyle='#f8e5b99a';ctx.setLineDash([4,5]);ctx.strokeRect(x,y,(e-w)*view.scale,(n-s)*view.scale);ctx.setLineDash([]);
    }
    const points=[];markers=[];
    for(const [index,r]of regions.entries()){
      const x=view.x+earthLongitudeToMapX(r.lon)*view.scale,y=view.y+(90-r.lat)*view.scale;
      if(x<0||x>view.rect.width||y<0||y>view.rect.height)continue;
      const value=r.years.find(row=>row.year===year)?.value,glyph=waterPoiState(value,elapsed,index,reduced);
      const chosen=!cell&&r.id===region?.id,color=`rgb(${glyph.rgb.join(',')})`,radius=glyph.radius*glyph.scale;
      markers.push({id:r.id,value,...glyph,x,y});ctx.save();ctx.globalAlpha=glyph.alpha;
      if(glyph.valid){
        const halo=ctx.createRadialGradient(x,y,2,x,y,23*glyph.scale);
        halo.addColorStop(0,`rgba(${glyph.rgb.join(',')},.4)`);halo.addColorStop(1,`rgba(${glyph.rgb.join(',')},0)`);
        ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,23*glyph.scale,0,Math.PI*2);ctx.fill();
      }
      ctx.strokeStyle=glyph.valid?color:'#a2b1b6';ctx.fillStyle=glyph.valid?color:'#0a2029';ctx.lineWidth=1.2;
      ctx.setLineDash(glyph.valid?[]:[2,2]);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
      if(chosen){ctx.strokeStyle='#ffe4aa';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y,10*glyph.scale,0,Math.PI*2);ctx.stroke();}
      ctx.lineWidth=4;ctx.strokeStyle='#071721';
      if(view.rect.width>900||chosen){ctx.font=`${view.rect.width<901?11:14}px serif`;ctx.strokeText(r.name,x,y-20);ctx.fillStyle=chosen?'#ffe4aa':'#d3e7e6';ctx.fillText(r.name,x,y-20);}
      ctx.font=`${view.rect.width<901?11:12}px sans-serif`;ctx.strokeText(glyph.text,x,y+25);ctx.fillStyle=glyph.valid?(value<0?'#efbc89':value>0?'#a5ece3':'#bdd2d7'):'#a2b1b6';ctx.fillText(glyph.text,x,y+25);ctx.restore();
      points.push({...r,x,y});
    }
    if(cell){
      const x=view.x+earthLongitudeToMapX(cell.lon)*view.scale,y=view.y+(90-cell.lat)*view.scale;
      ctx.strokeStyle='#ffebaf';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();ctx.beginPath();
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){ctx.moveTo(x+dx*11,y+dy*11);ctx.lineTo(x+dx*16,y+dy*16);}ctx.stroke();
      if(view.scale>15){ctx.lineWidth=.7;ctx.strokeStyle='#ffebaf88';ctx.strokeRect(x-view.scale*.25,y-view.scale*.25,view.scale*.5,view.scale*.5);}
    }
    ctx.restore();return {state:'ready',points};
  }
  function pick(clientX,clientY,view,regions){
    if(!grid)return null;
    const x=clientX-view.rect.left,y=clientY-view.rect.top;
    for(const r of regions){const px=view.x+earthLongitudeToMapX(r.lon)*view.scale,py=view.y+(90-r.lat)*view.scale;if(Math.hypot(x-px,y-py)<13)return{region:r};}
    const lon=(x-view.x)/view.scale-30,lat=90-(y-view.y)/view.scale;
    return {cell:waterCell(grid,lon,lat)};
  }
  const reset=()=>{textLayer.reset();grid=texture=null;textureYear=null;engine='idle';markers=[];if(gl&&program){gl.deleteTexture(valuesTexture);gl.deleteBuffer(vertices);gl.deleteProgram(program);program=null;}};
  return {paint,pick,reset,presentLabels:fade=>textLayer.present(1,fade),getState:()=>({engine,textureYear,textureCount,texturePixels:texture?720*360:0,style:'smooth',smoothingSigmaDegrees:WATER_FIELD_SIGMA*.5,markers,textLayer:textLayer.getState()})};
}
