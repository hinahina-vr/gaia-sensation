const vertex = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;

const fragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D countries;
uniform vec2 resolution;
uniform vec4 map;
uniform float time;
uniform float gapMode;
out vec4 result;

float wave(vec2 p,float t){
 return sin(p.x*1.17+p.y*.63+t*.42)
      + .62*sin(p.x*-.72+p.y*1.39-t*.31)
      + .31*sin(p.x*1.92-p.y*1.04+t*.23);
}
void main(){
 vec2 screen=vec2(uv.x,1.-uv.y);
 vec4 country=texture(countries,screen);
 if(country.a<.02)discard;
 // Geographic, gently refracted light: water imagery within national data
 // polygons. These are not mapped pipes, rivers or local water measurements.
 vec2 world=(screen*resolution-map.xy)/map.zw;
 vec2 p=world*vec2(64.,32.);
 float t=time;
 vec2 drift=vec2(sin(p.y*.22+t*.13),cos(p.x*.18-t*.11));
 vec2 q=p+drift*.8;
 float a=wave(q,t),b=wave(q*1.31+vec2(7.6,-3.2),-t*.83);
 float aa=max(fwidth(a),.025),bb=max(fwidth(b),.025);
 float ribbon=1.-smoothstep(.025,.12+aa,abs(a));
 float crossed=1.-smoothstep(.02,.10+bb,abs(b));
 float pool=.5+.5*sin(a*.85+b*.65+t*.08);
 float glint=pow(max(0.,.5+.5*cos(a*1.7-b*1.3)),18.);
 float coverage=clamp(country.r,0.,1.);
 float continuity=smoothstep(0.,1.,coverage);
 float light=(ribbon*.27+crossed*.17+ribbon*crossed*.33+glint*.075);
 float alpha=(light+pool*.055)*(.32+continuity*.68)*country.a;
 vec3 ink=mix(vec3(.20,.65,.76),vec3(.64,.95,.91),.3+pool*.7);
 if(gapMode>.5)ink=mix(vec3(.40,.86,.83),vec3(.95,.78,.53),smoothstep(.48,.52,country.g));
 result=vec4(ink*alpha,alpha);
}`;

export function createDrinkingMotion(){
 let canvas,gl,program,texture,locations,engine='idle',error='',key='',draws=0,uploads=0,contexts=0,lost=false;
 const changed=()=>globalThis.dispatchEvent(new Event('gaia:drinking-renderer-change'));
 function release(){
  if(gl&&!gl.isContextLost()){if(program)gl.deleteProgram(program);if(texture)gl.deleteTexture(texture)}
  program=texture=locations=null;key='';
 }
 function initialize(){
  if(program)return true;
  if(lost||engine==='unavailable'||engine==='error')return false;
  canvas??=document.createElement('canvas');canvas.dataset.drinkingMotion='true';
  if(!gl){
   gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
   if(!gl){engine='unavailable';return false}contexts++;
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;release();engine='lost';changed()});
   canvas.addEventListener('webglcontextrestored',()=>{lost=false;engine='idle';changed()});
  }
  const shaders=[];
  try{
   program=gl.createProgram();
   for(const [type,source]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
   }
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   texture=gl.createTexture();locations=Object.fromEntries(['countries','resolution','map','time','gapMode'].map(name=>[name,gl.getUniformLocation(program,name)]));engine='webgl2';return true;
  }catch(e){error=e.message;release();engine='error';return false}
  finally{for(const shader of shaders)gl.deleteShader(shader)}
 }
 function paint(ctx,source,{view,sourceKey,time,gap}){
  if(!initialize())return false;
  const scale=Math.min(1,1280/source.width,Math.sqrt(1e6/(source.width*source.height)));
  const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(null);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  if(key!==sourceKey){
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);key=sourceKey;uploads++;
  }
  gl.uniform1i(locations.countries,0);gl.uniform2f(locations.resolution,view.rect.width,view.rect.height);
  gl.uniform4f(locations.map,view.x,view.y,360*view.scale,180*view.scale);gl.uniform1f(locations.time,time);gl.uniform1f(locations.gapMode,gap?1:0);
  gl.drawArrays(gl.TRIANGLES,0,3);ctx.drawImage(canvas,0,0,view.rect.width,view.rect.height);draws++;return true;
 }
 return {paint,reset(){release();if(canvas)canvas.width=canvas.height=1;if(engine==='webgl2')engine='idle'},getState:()=>({engine,error,draws,uploads,contexts,width:canvas?.width||0,height:canvas?.height||0})};
}
