import {buildCoralOceanTexture,buildCoralOceanStreams} from './coral-ocean-model.js?v=coral-ocean-20261023';
import {coralOceanMotionGLSL,paintCoralOceanMotion,buildCoralOceanMotionField,CORAL_FLOW_SPEED} from './coral-ocean-motion.js?v=coral-current-20261023';

const vertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;
 gl_Position=vec4(p*2.-1.,0,1);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D ocean;
uniform vec2 resolution;
uniform vec4 map;
uniform float time;
out vec4 result;
${coralOceanMotionGLSL}
void main(){vec2 p=(vec2(uv.x,1.-uv.y)*resolution-map.xy)/map.zw;
 if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)discard;
 vec4 ink=movingSurface(p,time);result=vec4(ink.rgb*ink.a,ink.a);}`;
const streamVertex=`#version 300 es
precision highp float;
layout(location=0) in vec4 placement;
uniform vec2 resolution;
uniform vec4 map;
out vec4 flow;
void main(){flow=placement;vec2 pixel=map.xy+placement.xy/vec2(360.,180.)*map.zw;
 gl_Position=vec4(pixel/resolution*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);}`;
const streamFragment=`#version 300 es
precision highp float;
in vec4 flow;
uniform sampler2D ocean;
uniform float time;
out vec4 result;
void main(){if(flow.x<0.||flow.x>360.||flow.y<0.||flow.y>180.)discard;
 float cycle=fract((flow.z-time*${CORAL_FLOW_SPEED})/16.+flow.w);
 float head=smoothstep(.63,.92,cycle)*(1.-smoothstep(.92,1.,cycle));
 float ends=smoothstep(0.,5.,flow.z)*(1.-smoothstep(54.,60.,flow.z));
 float alpha=(.018+head*.24)*ends;
 vec3 rgb=mix(texture(ocean,flow.xy/vec2(360.,180.)).rgb,vec3(.77,.95,.97),.62);
 result=vec4(rgb*alpha,alpha);}`;

function program(gl,vs,fs){
  const shaders=[],p=gl.createProgram();
  try{
    for(const [type,source]of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
      const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
  }catch(e){gl.deleteProgram(p);throw e;}finally{for(const s of shaders)gl.deleteShader(s);}
}

export function createCoralHeatField(){
  let image,context,mask,maskContext,source,sourceContext,textureYear=null,maskKey='',engine='idle',error='';
  let fill,streams,texture,buffer,vao,vertices=0,gpuYear=null,gpuFailed=false,paths,flowLines;
  let field,moving,movingContext,movingPixels,circulation,flowTexture;
  let builds=0,maskBuilds=0,draws=0,samples=0,landMasked=false,flowTime=0;
  function reset(gl){
    if(gl&&!gl.isContextLost()){
      if(fill)gl.deleteProgram(fill);if(streams)gl.deleteProgram(streams);if(texture)gl.deleteTexture(texture);
      if(flowTexture)gl.deleteTexture(flowTexture);
      if(buffer)gl.deleteBuffer(buffer);if(vao)gl.deleteVertexArray(vao);
    }
    fill=streams=texture=flowTexture=buffer=vao=null;gpuYear=textureYear=null;gpuFailed=false;maskKey='';engine='idle';
    for(const c of [image,mask,source,moving])if(c)c.width=c.height=1;
    paths=flowLines=field=movingPixels=circulation=null;
  }
  function initialize(gl){
    if(gpuFailed)return false;if(fill)return true;
    try{
      fill=program(gl,vertex,fragment);streams=program(gl,streamVertex,streamFragment);
      texture=gl.createTexture();buffer=gl.createBuffer();vao=gl.createVertexArray();
      flowTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,flowTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,circulation.width,circulation.height,0,gl.RGBA,gl.UNSIGNED_BYTE,circulation.pixels);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const values=[];
      for(const line of flowLines)for(let i=1;i<line.length;i++)for(const p of [line[i-1],line[i]])values.push(p.x,p.y,p.distance,p.phase);
      vertices=values.length/4;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,16,0);return true;
    }catch(e){error=e.message;
      if(fill)gl.deleteProgram(fill);if(streams)gl.deleteProgram(streams);if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(vao)gl.deleteVertexArray(vao);
      if(flowTexture)gl.deleteTexture(flowTexture);
      fill=streams=texture=flowTexture=buffer=vao=null;gpuFailed=true;return false;
    }
  }
  function gpu(gl,width,height,origin,scale,time){
    if(!initialize(gl))return false;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    if(gpuYear!==textureYear){
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gpuYear=textureYear;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindVertexArray(null);gl.useProgram(fill);
    const uniforms=p=>{gl.uniform1i(gl.getUniformLocation(p,'ocean'),0);gl.uniform2f(gl.getUniformLocation(p,'resolution'),width,height);gl.uniform4f(gl.getUniformLocation(p,'map'),origin.x,origin.y,360*scale,180*scale);};
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,flowTexture);gl.activeTexture(gl.TEXTURE0);
    uniforms(fill);gl.uniform1i(gl.getUniformLocation(fill,'circulation'),1);gl.uniform1f(gl.getUniformLocation(fill,'time'),time);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.useProgram(streams);uniforms(streams);gl.uniform1f(gl.getUniformLocation(streams,'time'),time);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(vao);gl.lineWidth(1);gl.drawArrays(gl.LINES,0,vertices);
    context.drawImage(gl.canvas,0,0,image.width,image.height);engine='webgl2';return true;
  }
  function cpu(width,height,origin,scale,time,ratio){
    moving??=document.createElement('canvas');movingContext??=moving.getContext('2d');
    if(moving.width!==field.width||moving.height!==field.height){moving.width=field.width;moving.height=field.height;movingPixels=new ImageData(field.width,field.height);}
    paintCoralOceanMotion(field,time,movingPixels.data,circulation);movingContext.putImageData(movingPixels,0,0);
    context.save();context.setTransform(ratio,0,0,ratio,0,0);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(moving,origin.x,origin.y,360*scale,180*scale);
    if(!paths){paths=new Path2D();for(const line of flowLines){line.forEach((p,i)=>i?paths.lineTo(p.x,p.y):paths.moveTo(p.x,p.y));}}
    context.translate(origin.x,origin.y);context.scale(scale,scale);context.strokeStyle='rgba(178,235,240,.16)';context.lineWidth=.7/scale;context.lineCap='round';
    context.setLineDash([2.8,13.2]);context.lineDashOffset=-time*CORAL_FLOW_SPEED;context.stroke(paths);context.restore();engine='canvas2d';
  }
  function paint(ctx,{gl,regions,year,xy,scale,width,height,ratio,alpha,elapsed=0,reduced=false}){
    if(alpha<=0)return;
    image??=document.createElement('canvas');context??=image.getContext('2d');source??=document.createElement('canvas');sourceContext??=source.getContext('2d');
    mask??=document.createElement('canvas');maskContext??=mask.getContext('2d');flowLines??=buildCoralOceanStreams();circulation??=buildCoralOceanMotionField();
    if(textureYear!==year){
      field=buildCoralOceanTexture(regions);source.width=field.width;source.height=field.height;
      sourceContext.putImageData(new ImageData(field.pixels,field.width,field.height),0,0);textureYear=year;builds++;samples=field.width*field.height;
    }
    const adapter=globalThis.GaiaMapObservationAdapter,geometry=adapter?.getCountryGeometry?.(),origin=xy(-30,90),span=360*scale;
    const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    if(image.width!==w)image.width=w;if(image.height!==h)image.height=h;
    const next=[width,height,ratio,scale,origin.x,origin.y,geometry?.state].join('/');
    if(maskKey!==next){
      if(mask.width!==w)mask.width=w;if(mask.height!==h)mask.height=h;
      maskContext.setTransform(ratio,0,0,ratio,0,0);maskContext.clearRect(0,0,width,height);maskContext.globalCompositeOperation='source-over';
      const poles=maskContext.createLinearGradient(0,origin.y,0,origin.y+180*scale);
      poles.addColorStop(0,'#fff0');poles.addColorStop(.045,'#ffff');poles.addColorStop(.955,'#ffff');poles.addColorStop(1,'#fff0');
      maskContext.fillStyle=poles;maskContext.fillRect(origin.x,origin.y,span,180*scale);
      landMasked=geometry?.state==='ready';
      if(landMasked){maskContext.save();maskContext.globalCompositeOperation='destination-out';maskContext.fillStyle='#fff';
        for(const repeat of [0,360]){maskContext.setTransform(ratio*scale,0,0,ratio*scale,ratio*(origin.x+(repeat-150)*scale),ratio*origin.y);
          for(const s of geometry.countries){const path=adapter.getCountryPath(s.iso3);if(path)maskContext.fill(path,'evenodd');}
        }maskContext.restore();
      }
      maskKey=next;maskBuilds++;
    }
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,w,h);
    flowTime=reduced?0:Math.max(0,elapsed)/1000;
    if(!gl||!gpu(gl,width,height,origin,scale,flowTime))cpu(width,height,origin,scale,flowTime,ratio);
    context.save();context.globalCompositeOperation='destination-in';context.drawImage(mask,0,0);context.restore();
    ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(image,0,0,width,height);ctx.restore();draws++;
  }
  return {paint,reset,getState:()=>({engine,error,builds,maskBuilds,draws,samples,landMasked,flowTime,streams:flowLines?.length||0,width:image?.width||0,height:image?.height||0})};
}
