const vertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
export const COUNTRY_MOTION_PREFIX=`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D countries;
uniform vec2 resolution;
uniform vec4 map;
uniform float time;
uniform float changeMode;
uniform vec3 tint;
out vec4 result;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
// Stable geographic detail, with only the illumination moving. Two scales
// keep large surfaces coherent without a repeating wallpaper or extra buffers.
float surfaceNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float surfaceField(vec2 p){return .67*surfaceNoise(p)+.33*surfaceNoise(mat2(.8,-.6,.6,.8)*p*2.03+17.);}
float softLine(float distance,float width){return 1.-smoothstep(width,width+max(fwidth(distance),.012),distance);}
`;
const sanitation=COUNTRY_MOTION_PREFIX+`

void main(){
 vec2 s=vec2(uv.x,1.-uv.y);vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=(s*resolution-map.xy)/map.zw*vec2(54.,27.);
 float broad=surfaceField(p*.14),bend=sin(p.x*.33+broad*3.)*.85;
 float course=p.y+bend+.13*sin(p.x*1.2-time*.13),row=floor(course);
 float strand=abs(fract(course)-.5),width=.024+.045*d.r;
 float line=softLine(strand,width),returnLine=softLine(abs(fract(course+.22)-.5),.018);
 float packet=pow(.5+.5*cos(p.x*1.55-time*.72+hash(vec2(row,7.))*6.28),12.);
 float returning=pow(.5+.5*cos(p.x*1.18+time*.46+row),15.);
 float seam=exp(-strand*strand*32.);
 float alpha=(line*(.06+packet*.43)+returnLine*(.025+returning*.22)+seam*.055)*(.18+.82*sqrt(d.r))*d.a;
 vec3 ink=mix(tint,vec3(.76,.97,.94),packet*.65+returning*.2);
 result=vec4(ink*alpha,alpha);
}
`;
const forest=COUNTRY_MOTION_PREFIX+`

void main(){
 vec2 s=vec2(uv.x,1.-uv.y);vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=(s*resolution-map.xy)/map.zw*vec2(230.,115.);
 float crowns=surfaceField(p*.46),gust=sin(p.x*.065+p.y*.095-time*.44+crowns*2.);
 vec2 q=p+vec2(.14,.09)*gust,cell=floor(q);float leaves=0.,veins=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(x,y);float seed=hash(id),present=step(seed,d.r);
  vec2 center=id+.5+(vec2(hash(id+17.),hash(id+39.))-.5)*.8;
  float a=seed*6.28+gust*.23;vec2 v=mat2(cos(a),-sin(a),sin(a),cos(a))*(q-center);
  float leaf=1.-smoothstep(.82,1.04,pow(abs(v.x)/.58,1.4)+pow(abs(v.y)/.27,1.3));
  leaves+=leaf*present*(.78+.22*sin(a+gust));veins+=softLine(abs(v.y),.008)*exp(-v.x*v.x*14.)*present*leaf;
 }
 float patches=smoothstep(1.-d.r,1.-d.r+.22,crowns);
 vec2 slope=vec2(dFdx(crowns)/max(fwidth(p.x),.001),dFdy(crowns)/max(fwidth(p.y),.001));
 float sun=clamp(.5+dot(slope,vec2(-1.8,-1.2)),0.,1.);
 float light=smoothstep(-.7,.9,gust)*(.35+.65*sun);
 vec3 ink=mix(vec3(.045,.18,.13),vec3(.43,.73,.31),clamp(sun*.48+light*.35+leaves*.17,0.,1.));
 if(changeMode>.5)ink=mix(ink,mix(vec3(.30,.45,.37),vec3(.32,.78,.45),smoothstep(.35,.65,d.g)),.45);
 float alpha=min(.72,patches*(.24+light*.14)+leaves*(.14+light*.15)+veins*.07)*d.a;
 result=vec4(ink*alpha,alpha);
}
`;

const clamp=value=>Math.max(0,Math.min(1,value));
export function countryThemeSignal({definition,value,access,mode}){
 if(!Number.isFinite(value))return null;
 if(definition.id==='sanitation')return [clamp(value/100),0,0];
 if(definition.id==='foresthistory'&&Number.isFinite(access))return [clamp(access/100),mode==='change'?clamp((value+10)/20):clamp(value/100),0];
 return null;
}

export function createCountryThemeMotion({fragmentSources={sanitation,foresthistory:forest}}={}){
 let canvas,gl,program,texture,locations,engine='idle',error='',key='',theme='',draws=0,uploads=0,contexts=0,lost=false;
 const changed=()=>globalThis.dispatchEvent(new Event('gaia:country-theme-renderer-change'));
 function release(){if(gl&&!gl.isContextLost()){if(program)gl.deleteProgram(program);if(texture)gl.deleteTexture(texture)}program=texture=locations=null;key=''}
 function initialize(kind){
  if(program&&theme===kind)return true;
  if(program)release();theme=kind;
  if(lost||engine==='unavailable'||engine==='error')return false;
  canvas??=document.createElement('canvas');canvas.dataset.countryThemeMotion='true';
  if(!gl){
   gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
   if(!gl){engine='unavailable';return false}contexts++;
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;release();engine='lost';changed()});
   canvas.addEventListener('webglcontextrestored',()=>{lost=false;engine='idle';changed()});
  }
  const shaders=[];
  try{
   program=gl.createProgram();
   if(!fragmentSources[kind])throw Error('Unknown country motion theme: '+kind);
   for(const [type,source]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragmentSources[kind]]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
   }
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   texture=gl.createTexture();locations=Object.fromEntries(['countries','resolution','map','time','changeMode','tint'].map(name=>[name,gl.getUniformLocation(program,name)]));engine='webgl2';return true;
  }catch(e){error=e.message;release();engine='error';return false}finally{for(const shader of shaders)gl.deleteShader(shader)}
 }
 function paint(ctx,source,{view,sourceKey,time,definition,mode}){
  if(!initialize(definition.id))return false;
  const scale=Math.min(1,1280/source.width,Math.sqrt(1e6/(source.width*source.height))),width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(null);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  if(key!==sourceKey){
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);key=sourceKey;uploads++;
  }
  const color=definition.colors.at(-1),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
  gl.uniform1i(locations.countries,0);gl.uniform2f(locations.resolution,view.rect.width,view.rect.height);gl.uniform4f(locations.map,view.x,view.y,360*view.scale,180*view.scale);gl.uniform1f(locations.time,time);gl.uniform1f(locations.changeMode,mode==='change'?1:0);gl.uniform3f(locations.tint,...rgb);
  gl.drawArrays(gl.TRIANGLES,0,3);ctx.drawImage(canvas,0,0,view.rect.width,view.rect.height);draws++;return true;
 }
 return {paint,reset(){release();if(canvas)canvas.width=canvas.height=1;if(engine==='webgl2')engine='idle';theme=''},getState:()=>({engine,error,theme,draws,uploads,contexts,width:canvas?.width||0,height:canvas?.height||0})};
}
