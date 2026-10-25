// One bounded, reusable WebGL2 context for data glyphs. No independent RAF,
// random point clouds or fabricated spatial interpolation. Each instance is a
// country's published value; geometry is redrawn only by the shared map lifecycle.
export const ATLAS_GLYPH_TYPES=Object.freeze({waterstress:1,cropland:2,yield:3,fertilizer:4,longevity:5,urban:6,ageing:7,childsurvival:8,oceanheat:9,ozone:10,glaciers:11,volcanoes:12,tsunamis:13,wateruse:14,hunger:15,fisheries:16,internet:17,refugees:18});
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec4 box;
layout(location=1) in vec4 values;
layout(location=2) in vec3 color;
layout(location=3) in vec4 extras;
uniform vec2 resolution;
out vec2 uv;flat out vec4 data;flat out vec3 tint;flat out vec4 aux;
void main(){
  vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
  uv=corners[gl_VertexID];vec2 p=box.xy+uv*box.zw;
  gl_Position=vec4(p.x/resolution.x*2.-1.,1.-p.y/resolution.y*2.,0.,1.);data=values;tint=color;aux=extras;
}`;
const fragment=`#version 300 es
precision highp float;
in vec2 uv;flat in vec4 data;flat in vec3 tint;flat in vec4 aux;
uniform int kind;
out vec4 outputColor;
float inside(float d){return 1.-smoothstep(-fwidth(d),fwidth(d),d);}
float rect(vec2 p,vec2 b){vec2 q=abs(p)-b;return inside(max(q.x,q.y));}
float line(float d,float w){return inside(abs(d)-w);}
void main(){
  vec2 p=uv;float v=clamp(data.x,0.,1.),base=clamp(data.y,0.,1.);
  float ink=0.,quiet=0.,reference=0.;vec3 rgb=tint;
  if(kind==1){
    // A resource vessel: full height = 100% of available freshwater.
    float frame=rect(p,vec2(.48,.82));quiet=frame*.11+frame*(1.-rect(p,vec2(.38,.77)))*.25;
    ink=rect(p-vec2(0.,.77-v*.77),vec2(.36,v*.77));
    ink=max(ink*.65,line(p.y-(.77-v*1.54),.025)*rect(p,vec2(.48,.82)));
    if(data.x>1.)reference=rect(p-vec2(0.,-.94),vec2(.32,.025));
  }else if(kind==2){
    // A ten-by-ten land share, not an invented location of farmland.
    vec2 g=(p+1.)*.5*10.;vec2 cell=fract(g);float index=floor(g.y)*10.+floor(g.x);
    float tile=rect(cell-.5,vec2(.39,.35));quiet=tile*.1;
    ink=tile*clamp(v*100.-index,0.,1.);
  }else if(kind==3){
    // Harvest per hectare: column height on a shared 0..10,000 kg/ha scale.
    quiet=rect(p,vec2(.16,.84))*.14;
    ink=rect(p-vec2(0.,.84-v*.84),vec2(.16,v*.84));
    ink=max(ink*.7,rect(p-vec2(0.,.84-v*1.68),vec2(.45,.025)));
    if(data.y>=0.)reference=rect(p-vec2(0.,.84-base*1.68),vec2(.29,.014));
  }else if(kind==4){
    // Three consecutive turns encode input intensity up to 500 kg/ha.
    float r=length(p),a=fract(atan(p.y,p.x)/6.2831853+.25);
    for(int i=0;i<3;i++){float ring=line(r-(.32+float(i)*.24),.035);quiet+=ring*.18;ink+=ring*step(a,clamp(v*3.-float(i),0.,1.));}
    if(data.x>1.)reference=line(r-.94,.016);
  }else if(kind==5){
    // A length of time. The short gold notch is the same country's year 2000.
    quiet=rect(p,vec2(.92,.1))*.3;
    ink=rect(p-vec2(-.92+v*.92,0.),vec2(v*.92,.1));
    ink=max(ink*.7,rect(p-vec2(-.92+v*1.84,0.),vec2(.025,.4)));
    if(data.y>=0.)reference=rect(p-vec2(-.92+base*1.84,0.),vec2(.012,.27));
  }else if(kind==6){
    // Two parts of one population: bright urban and subdued rural share.
    quiet=rect(p,vec2(.5,.84))*.2;
    ink=rect(p-vec2(0.,.84-v*.84),vec2(.5,v*.84));
    ink*=.6+.25*rect(fract((p+1.)*vec2(3.,6.))-.5,vec2(.26,.3));
    reference=rect(p-vec2(0.,.84-v*1.68),vec2(.6,.018));
  }else if(kind==7){
    // 100 people symbols: one full dot = one percentage point aged 65+.
    vec2 g=(p+1.)*.5*10.;float index=floor(g.y)*10.+floor(g.x);
    float dot=inside(length(fract(g)-.5)-.3);quiet=dot*.14;ink=dot*clamp(data.x*100.-index,0.,1.);
  }else if(kind==8){
    // Survival probability around a full 1,000 births. Missing arc = under-5
    // mortality; outer ring is 2000. Both retain the same denominator.
    float r=length(p),a=fract(atan(p.y,p.x)/6.2831853+.25);
    float ring=line(r-.65,.07);quiet=ring*.12;ink=ring*step(a,1.-data.x);
    if(data.y>=0.)reference=line(r-.88,.018)*step(a,1.-data.y);
  }else if(kind==9){
    // A section through two integration depths. Signed heat, not temperature.
    float depth=(p.y+1.)*.5,heat=depth<.35?aux.x:aux.y;
    vec3 cold=vec3(.25,.57,.73),warm=vec3(.98,.65,.39);
    rgb=mix(cold,warm,step(0.,heat));
    float mask=inside(abs(p.x)-.84);
    float light=.8-.2*abs(p.x)+.12*(1.-depth);
    ink=mask*(.16+.64*min(1.,abs(heat)))*light;
    reference=mask*max(line(depth-.35,.003),line(depth,.003))*.7;
    quiet=line(abs(p.x)-.84,.006)*.35;
  }else if(kind==10){
    // Area-proportional opening inside a fixed 30 million km² comparison disk.
    float r=length(p),hole=sqrt(v)*.84;
    quiet=line(r-.84,.004)*.5;
    float atmosphere=inside(r-.84)*(1.-inside(r-hole));
    ink=atmosphere*(.25+.6*pow(max(0.,1.-abs(r-hole)/.16),2.));
    reference=line(r-hole,.006)*.8;
    rgb=mix(vec3(.31,.41,.64),vec3(.72,.79,.96),clamp((r-hole)*4.,0.,1.));
    if(data.x<0.){ink=0.;reference=0.;quiet=line(r-.84,.006)*.4;}
  }else if(kind==11){
    // One instance per observed year; depth is cumulative loss from 1970.
    float depth=(p.y+1.)*.5;
    float slab=inside(abs(p.x)-.92)*step(depth,v);
    ink=slab*(.24+.30*depth);reference=line(depth-v,.004)*inside(abs(p.x)-.94);
    quiet=line(p.y+1.,.008)*.4;
    rgb=mix(vec3(.68,.89,.95),vec3(.25,.49,.64),depth);
  }else if(kind==12){
    // Mountain mark with ordinal VEI steps, not a plume-height simulation.
    float mountain=line(p.y-(abs(p.x)*.95+.03),.045)*step(abs(p.x),.75);
    ink=mountain;quiet=inside(abs(p.x)-.75)*inside(abs(p.x)*.95+.03-p.y)*step(p.y,.78)*.12;
    if(data.x>=0.)for(int i=0;i<8;i++){
      float level=float(i),y=-.13-level*.1,w=.18+level*.037;
      ink=max(ink,rect(p-vec2(0.,y),vec2(w,.018))*step(level+.5,data.x));
    }
    quiet+=rect(p-vec2(0.,.78),vec2(.82,.013))*.45;
    rgb=mix(vec3(.65,.73,.74),vec3(1.,.72,.39),clamp(data.x/8.,0.,1.));
  }else if(kind==13){
    // Equal-sized source-location wave symbols: no invented travel time/height.
    for(int i=0;i<3;i++){float wave=sin((p.x+.15)*4.2)*.16+float(i)*.32-.32;ink=max(ink,line(p.y-wave,.025)*inside(abs(p.x)-.8));}
    quiet=line(length(p)-.92,.009)*.25;
  }else if(kind==14){
    // Three independent widths on one 0..100% scale. No normalization of input.
    for(int i=0;i<3;i++){
      float share=i==0?aux.x:i==1?aux.y:aux.z;
      float dest=(float(i)-1.)*.6,t=1.-smoothstep(-.7,.7,p.y),x=dest*t;
      float branch=line(p.x-x,.16*share)*step(abs(p.y),.84);
      ink=max(ink,branch);if(branch>.05)rgb=i==0?vec3(.67,.85,.61):i==1?vec3(.58,.72,.89):vec3(.85,.78,.61);
    }
  }else if(kind==15){
    // The missing wedge is the undernourished fraction, not an invented count.
    float r=length(p),a=fract(atan(p.y,p.x)/6.2831853+.25);
    float dish=inside(r-.79);quiet=dish*.12;
    ink=dish*step(v,a)*(.28+.35*line(r-.65,.04));
    reference=line(r-.84,.018)*step(v,a);
    if(aux.x>.5)ink=max(ink,dish*step(a,.16)*step(.6,fract((p.x+p.y)*8.))*.65);
  }else if(kind==16){
    // Two equal-scale diamonds; their separate areas encode tonnage.
    float left=inside(abs(p.x+.5)+abs(p.y)-sqrt(max(0.,aux.x))*.85);
    float right=inside(abs(p.x-.5)+abs(p.y)-sqrt(max(0.,aux.y))*.85);
    ink=max(left,right)*.8;rgb=left>right?vec3(.43,.77,.91):vec3(.65,.89,.71);
    quiet=rect(p,vec2(.93,.006))*.3;
  }else if(kind==17){
    // A single serpentine trace; illuminated length is the population share.
    for(int i=0;i<5;i++){
      float row=float(i),y=-.72+row*.36,progress=(mod(row,2.)<.5?p.x+1.:1.-p.x)*.5;
      float track=line(p.y-y,.024)*step(abs(p.x),.8);
      quiet+=track*.18;ink+=track*step(row+progress,v*5.);
      if(i<4){float side=mod(row,2.)<.5?.8:-.8;float turn=line(length(p-vec2(side,y+.18))-.18,.024)*step(0.,(p.x-side)*sign(side));quiet+=turn*.15;ink+=turn*step(row+1.,v*5.);}
    }
  }else if(kind==18){
    // Door-like count diagram. Square side follows sqrt(population).
    float side=sqrt(v)*.8;
    ink=rect(p,vec2(side))*.45;
    reference=line(max(abs(p.x),abs(p.y))-side,.016)*step(.001,v);
    quiet=(rect(p-vec2(-.94,0.),vec2(.012,.92))+rect(p-vec2(-.8,-.92),vec2(.15,.012))+rect(p-vec2(-.8,.92),vec2(.15,.012)))*.4;
  }
  float highlight=data.z*.13;vec3 c=mix(rgb,vec3(.91,.99,.97),highlight);
  float alpha=clamp(ink*.9+quiet+reference*.75,0.,1.)*data.w;
  c=mix(c,vec3(.96,.86,.64),reference*.85);
  outputColor=vec4(c*alpha,alpha);
}`;
export function createAtlasDataWebgl(){
  let canvas,gl,program,buffer,vao,uniforms,engine='idle',errorMessage='',draws=0,contexts=0;
  const notify=()=>globalThis.dispatchEvent?.(new Event('gaia:atlas-renderer-change'));
  const release=()=>{if(gl&&!gl.isContextLost()){if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);if(vao)gl.deleteVertexArray(vao);}program=buffer=vao=null;};
  function initialize(){
    if(program)return true;if(['unavailable','lost','error'].includes(engine))return false;
    canvas??=document.createElement('canvas');
    if(!gl){
      gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
      if(!gl){engine='unavailable';return false;}contexts++;
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();engine='lost';release();notify();});
      canvas.addEventListener('webglcontextrestored',()=>{engine='idle';notify();});
    }
    const shaders=[];
    try{
      for(const [type,source]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));}
      program=gl.createProgram();for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      vao=gl.createVertexArray();gl.bindVertexArray(vao);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [index,size,offset]of[[0,4,0],[1,4,4],[2,3,8],[3,4,11]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,60,offset*4);gl.vertexAttribDivisor(index,1);}
      uniforms={resolution:gl.getUniformLocation(program,'resolution'),kind:gl.getUniformLocation(program,'kind')};engine='webgl2';return true;
    }catch(error){release();engine='error';errorMessage=error.message;console.warn('Atlas data GPU unavailable:',error.message);return false;}
    finally{for(const shader of shaders)gl.deleteShader(shader);}
  }
  function paint(ctx,instances,{width,height,ratio,kind}){
    if(!initialize())return false;
    const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(instances.flatMap(row=>row.length===11?[...row,0,0,0,0]:row)),gl.DYNAMIC_DRAW);gl.uniform2f(uniforms.resolution,width,height);gl.uniform1i(uniforms.kind,kind);gl.drawArraysInstanced(gl.TRIANGLES,0,6,instances.length);draws++;
    ctx.drawImage(canvas,0,0,width,height);return true;
  }
  return {paint,available:initialize,reset(){if(canvas){canvas.width=1;canvas.height=1;}},state:()=>({engine,errorMessage,draws,contexts,width:canvas?.width||0,height:canvas?.height||0}),
    // Test context loss through the same browser extension exposed by WebGL.
    context:()=>gl};
}
