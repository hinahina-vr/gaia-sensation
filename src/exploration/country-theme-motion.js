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
`;
const sanitation=COUNTRY_MOTION_PREFIX+`
void main(){
 vec2 screen=vec2(uv.x,1.-uv.y);vec4 data=texture(countries,screen);
 if(data.a<.02)discard;
 vec2 world=(screen*resolution-map.xy)/map.zw;
 vec2 p=world*vec2(66.,33.);
 // Braided, circulating threads with softly travelling packets. These are
 // illustrative treatment/circulation motifs, not mapped sewer networks.
 float bend=sin(p.x*.63+sin(p.x*.19)*1.5+time*.08)*.66;
 float course=p.y+bend+.16*sin(p.x*1.32-time*.10);
 float strand=fract(course)-.5;
 float aa=max(fwidth(course),.018);
 float line=1.-smoothstep(.015,.055+aa,abs(strand));
 float companion=1.-smoothstep(.015,.045+aa,abs(strand-.15));
 float row=floor(course);
 float packet=pow(.5+.5*cos((p.x*.43-time*.24+hash(vec2(row,7.)))*6.2831853),22.);
 float returning=pow(.5+.5*cos((p.x*.36+time*.17+hash(vec2(row,19.)))*6.2831853),26.);
 float halo=exp(-strand*strand*65.);
 float strength=.15+.85*sqrt(data.r);
 float alpha=(line*(.035+packet*.39)+companion*(.018+returning*.22)+halo*.012)*strength*data.a;
 vec3 ink=mix(tint,vec3(.87,.99,.95),packet*.52);
 result=vec4(ink*alpha,alpha);
}`;
const forest=COUNTRY_MOTION_PREFIX+`
void main(){
 vec2 screen=vec2(uv.x,1.-uv.y);vec4 data=texture(countries,screen);
 if(data.a<.02)discard;
 vec2 world=(screen*resolution-map.xy)/map.zw;
 vec2 p=world*vec2(164.,82.);
 vec2 cell=floor(p);
 float canopy=0.,veins=0.;
 // Overlapping, irregular leaf clusters sway together. Their national density
 // follows forest share; they do not locate individual trees or forest edges.
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));float seed=hash(id);
  float present=step(seed,data.r*.98);
  vec2 center=id+.5+(vec2(hash(id+17.),hash(id+39.))-.5)*.84;
  float gust=sin(center.x*.17+center.y*.23-time*.40);
  center+=vec2(.14*gust,.065*sin(time*.32+seed*6.));
  float angle=seed*6.2831853+gust*.26;
  vec2 d=p-center;vec2 q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;
  float leaf=exp(-dot(q/vec2(.48,.27),q/vec2(.48,.27))*2.4);
  float vein=exp(-q.y*q.y*4300.)*exp(-q.x*q.x*15.);
  canopy+=leaf*present*(.65+gust*.12);
  veins+=vein*present*.4;
 }
 float wind=.5+.5*sin(p.x*.14+p.y*.19-time*.23);
 float alpha=(canopy*(.30+wind*.14)+veins*.14)*data.a;
 vec3 ink=mix(vec3(.11,.46,.28),vec3(.44,.80,.39),wind);
 if(changeMode>.5){float delta=(data.g-.5)*2.;vec3 direction=delta<0.?vec3(.33,.52,.40):vec3(.30,.86,.46);ink=mix(vec3(.14,.40,.25),direction,min(1.,abs(delta)*1.8+.18));}
 result=vec4(ink*alpha,alpha);
}`;

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
