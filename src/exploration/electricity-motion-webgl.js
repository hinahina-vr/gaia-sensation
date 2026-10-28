const vertex='#version 300 es\nprecision highp float;\nout vec2 uv;\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0,1);}';
const fragment=String.raw`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D signals;
uniform vec2 resolution;
uniform vec4 map;
uniform float time;
uniform float changeMode;
out vec4 result;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 screen=vec2(uv.x,1.-uv.y);vec4 signal=texture(signals,screen);
 if(signal.a<.02)discard;
 vec2 world=(screen*resolution-map.xy)/map.zw;
 float access=signal.g;
 // An illustrative electric texture within national polygons, not mapped
 // infrastructure. Coordinates stay fixed as time moves the light packets.
 vec2 grid=world*vec2(88.,44.);
 grid+=vec2(.18*sin(grid.y*.35),.14*sin(grid.x*.27));
 vec2 cell=floor(grid),f=fract(grid);
 vec2 aa=max(fwidth(grid),vec2(.018));
 float horizontal=1.-smoothstep(.018,.018+aa.y,abs(f.y-.5));
 float vertical=1.-smoothstep(.014,.014+aa.x,abs(f.x-.5));
 float rowPhase=hash(vec2(cell.y,signal.b*255.));
 float columnPhase=hash(vec2(cell.x+39.,signal.b*255.));
 float packetX=pow(.5+.5*cos((grid.x*.31-time*.32+rowPhase)*6.2831853),28.);
 float packetY=pow(.5+.5*cos((grid.y*.27+time*.23+columnPhase)*6.2831853),32.);
 float connectedX=smoothstep(rowPhase,rowPhase+.12,access);
 float connectedY=smoothstep(columnPhase,columnPhase+.12,access);
 float trails=horizontal*(.12+packetX*2.1)*connectedX+vertical*(.06+packetY*1.3)*connectedY;
 float junction=exp(-dot((f-.5)/aa,(f-.5)/aa)*.55);
 float halo=exp(-dot((f-.5)*3.,(f-.5)*3.));
 float energy=smoothstep(0.,1.,access);
 float alpha=(trails*.58+junction*.28*connectedX*connectedY+halo*.035*energy)*(.20+energy*.80);
 vec3 gold=vec3(1.,.84,.48),cyan=vec3(.46,.85,.91),lavender=vec3(.78,.65,.96);
 vec3 ink=mix(cyan,gold,.25+energy*.75);
 if(changeMode>.5)ink=mix(lavender,gold,smoothstep(.42,.58,signal.r));
 result=vec4(ink*alpha*signal.a,alpha*signal.a);
}`;
export function createElectricityMotion(){
 let canvas,gl,program,texture,locations,engine='idle',error='',key='',draws=0,uploads=0,contexts=0,lost=false;
 const changed=()=>globalThis.dispatchEvent(new Event('gaia:electricity-renderer-change'));
 function release(){if(gl&&!gl.isContextLost()){if(program)gl.deleteProgram(program);if(texture)gl.deleteTexture(texture);}program=texture=locations=null;key='';}
 function initialize(){
  if(program)return true;if(lost||engine==='unavailable'||engine==='error')return false;
  canvas??=document.createElement('canvas');canvas.dataset.electricityMotion='true';
  if(!gl){
   gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
   if(!gl){engine='unavailable';return false;}contexts++;
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;release();engine='lost';changed()});
   canvas.addEventListener('webglcontextrestored',()=>{lost=false;engine='idle';changed()});
  }
  const shaders=[];
  try{
   program=gl.createProgram();
   for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
   }
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   texture=gl.createTexture();locations=Object.fromEntries(['signals','resolution','map','time','changeMode'].map(n=>[n,gl.getUniformLocation(program,n)]));engine='webgl2';return true;
  }catch(e){error=e.message;release();engine='error';return false}finally{for(const s of shaders)gl.deleteShader(s);}
 }
 function paint(ctx,source,{view,sourceKey,time,change}){
  if(!initialize())return false;
  if(canvas.width!==source.width)canvas.width=source.width;if(canvas.height!==source.height)canvas.height=source.height;
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(null);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  if(key!==sourceKey){
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);key=sourceKey;uploads++;
  }
  gl.uniform1i(locations.signals,0);gl.uniform2f(locations.resolution,view.rect.width,view.rect.height);gl.uniform4f(locations.map,view.x,view.y,360*view.scale,180*view.scale);gl.uniform1f(locations.time,time);gl.uniform1f(locations.changeMode,change?1:0);
  gl.drawArrays(gl.TRIANGLES,0,3);ctx.drawImage(canvas,0,0,view.rect.width,view.rect.height);draws++;return true;
 }
 return{paint,reset(){release();if(canvas)canvas.width=canvas.height=1;if(engine==='webgl2')engine='idle';},getState:()=>({engine,error,draws,uploads,contexts,width:canvas?.width||0,height:canvas?.height||0})};
}
