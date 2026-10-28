import {buildSeaCoastStencil,buildSeaSurfaceTexture,paintSeaSurfaceCPU,seaSwellGLSL} from './sea-surface-model.js?v=surface-release-2e596f2-20261028';
const vertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D ocean;
uniform vec2 resolution;
uniform vec4 map;
uniform float time;
out vec4 result;
${seaSwellGLSL}
void main(){vec2 p=(vec2(uv.x,1.-uv.y)*resolution-map.xy)/map.zw;
 if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)discard;
 vec4 color=texture(ocean,p);vec2 light=swell(p,time);
 result=vec4((color.rgb*light.x+vec3(178.,225.,225.)/255.*light.y)*color.a,color.a);
}`;

export function createSeaSurfaceView(){
  let gpu,gl,program,texture,uniforms,failed=false,lost=false,engine='idle',error='';
  let image,ctx,mask,maskCtx,cpu,cpuCtx,cpuPixels,field,yearKey='',gpuYear='',maskKey='';
  let draws=0,builds=0,maskBuilds=0,time=0,landMasked=false,stencil=null,stencilBuilds=0;
  const changed=()=>globalThis.dispatchEvent(new Event('gaia:sea-renderer-change'));
  function release(){
    if(gl&&!gl.isContextLost()){if(program)gl.deleteProgram(program);if(texture)gl.deleteTexture(texture);}
    program=texture=uniforms=null;gpuYear='';
  }
  function initialize(){
    if(failed||lost)return false;if(program)return true;
    if(!gpu){
      gpu=document.createElement('canvas');gpu.dataset.seaSurface='true';
      gl=gpu.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
      gpu.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;release();changed();});
      gpu.addEventListener('webglcontextrestored',()=>{lost=false;failed=false;changed();});
    }
    if(!gl){failed=true;return false;}
    const shaders=[];
    try{
      program=gl.createProgram();
      for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);
      }
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      uniforms=Object.fromEntries(['ocean','resolution','map','time'].map(k=>[k,gl.getUniformLocation(program,k)]));
      texture=gl.createTexture();return true;
    }catch(e){error=e.message;release();failed=true;return false;}
    finally{for(const s of shaders)gl.deleteShader(s);}
  }
  function paint(target,{basins,stations=[],year,view,ratio=1,elapsed,reduced,alpha}){
    if(alpha<=0)return;
    const adapter=globalThis.GaiaMapObservationAdapter,geometry=adapter?.getCountryGeometry?.();
    // Never flash the ocean over land while geography is loading.
    landMasked=geometry?.state==='ready';if(!landMasked){engine=geometry?.state==='error'?'geometry-unavailable':'waiting';return;}
    const {width,height}=view.rect,scale=view.scale,origin={x:view.x,y:view.y};
    image??=document.createElement('canvas');ctx??=image.getContext('2d');mask??=document.createElement('canvas');maskCtx??=mask.getContext('2d');
    const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    if(image.width!==w)image.width=w;if(image.height!==h)image.height=h;
    const key=[w,h,scale,origin.x,origin.y].join('/');
    if(maskKey!==key){
      mask.width=w;mask.height=h;maskCtx.setTransform(ratio,0,0,ratio,0,0);
      const poles=maskCtx.createLinearGradient(0,origin.y,0,origin.y+180*scale);
      // Altimetry covers the non-polar oceans. Fade the display at ~66°.
      for(const [p,a]of [[0,0],[.105,0],[.15,1],[.85,1],[.895,0],[1,0]])poles.addColorStop(p,`rgba(255,255,255,${a})`);
      maskCtx.fillStyle=poles;maskCtx.fillRect(origin.x,origin.y,360*scale,180*scale);
      maskCtx.globalCompositeOperation='destination-out';maskCtx.fillStyle='#fff';
      for(const repeat of [0,360]){
        maskCtx.setTransform(ratio*scale,0,0,ratio*scale,ratio*(origin.x+(repeat-150)*scale),ratio*origin.y);
        for(const id of new Set([...geometry.countries.map(country=>country.iso3),'ATA'])){const path=adapter.getCountryPath(id);if(path)maskCtx.fill(path,'evenodd');}
      }
      maskCtx.globalCompositeOperation='source-over';maskKey=key;maskBuilds++;
    }
    if(yearKey!==year){
      if(!stencil){stencil=buildSeaCoastStencil(stations);stencilBuilds++;}
      field=buildSeaSurfaceTexture(basins,year,stencil.width,stencil.height,stations,stencil);yearKey=year;builds++;
    }
    time=reduced?0:Math.max(0,elapsed)/1000;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
    if(initialize()){
      // Bound fragment work independently of desktop DPR/4K window size.
      const r=Math.min(ratio,1440/width),gw=Math.max(1,Math.round(width*r)),gh=Math.max(1,Math.round(height*r));
      if(gpu.width!==gw)gpu.width=gw;if(gpu.height!==gh)gpu.height=gh;
      gl.viewport(0,0,gw,gh);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program);gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      if(gpuYear!==year){
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.width,field.height,0,gl.RGBA,gl.UNSIGNED_BYTE,field.pixels);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gpuYear=year;
      }
      gl.uniform1i(uniforms.ocean,0);gl.uniform2f(uniforms.resolution,width,height);gl.uniform4f(uniforms.map,origin.x,origin.y,360*scale,180*scale);gl.uniform1f(uniforms.time,time);
      gl.drawArrays(gl.TRIANGLES,0,3);ctx.drawImage(gpu,0,0,w,h);engine='webgl2';
    }else{
      cpu??=document.createElement('canvas');cpuCtx??=cpu.getContext('2d');
      if(cpu.width!==field.width||cpu.height!==field.height){cpu.width=field.width;cpu.height=field.height;cpuPixels=new ImageData(field.width,field.height);}
      paintSeaSurfaceCPU(field,time,cpuPixels.data);cpuCtx.putImageData(cpuPixels,0,0);
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.drawImage(cpu,origin.x,origin.y,360*scale,180*scale);ctx.setTransform(1,0,0,1,0,0);engine='canvas2d';
    }
    ctx.save();ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.restore();
    target.save();target.globalAlpha=alpha*.82;target.drawImage(image,0,0,width,height);target.restore();draws++;
  }
  function reset(){release();for(const c of [image,mask,cpu,gpu])if(c)c.width=c.height=1;field=cpuPixels=stencil=null;yearKey=gpuYear=maskKey='';engine='idle';time=0;landMasked=false;}
  return {paint,reset,getState:()=>({engine,error,draws,builds,maskBuilds,stencilBuilds,time,landMasked,width:image?.width||0,height:image?.height||0,values:field?.values||[],coastalSamples:field?.coastalSamples||0})};
}
