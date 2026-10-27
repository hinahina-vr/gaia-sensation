import {COUNTRY_MOTION_PREFIX,createCountryThemeMotion} from './country-theme-motion.js?v=release100-c363-20261027';
// National textures express the selected measurement, not the locations of
// farms, cables, fishing grounds, displaced people or migration routes.
const base=COUNTRY_MOTION_PREFIX+`
const float TAU=6.2831853;
vec2 screenPoint(){return vec2(uv.x,1.-uv.y);}
vec2 worldPoint(vec2 s){return (s*resolution-map.xy)/map.zw;}
void emit(vec3 ink,float a){result=vec4(ink*a,a);}
`;
const wateruse=base+`
void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(46.,23.),cell=floor(p),q=fract(p)-.5;
 float fork=smoothstep(-.40,.35,q.y),light=0.;vec3 ink=vec3(0.);
 for(int i=0;i<3;i++){
  float share=i==0?d.r:i==1?d.g:d.b,side=float(i)-1.;
  float curve=side*.30*fork+sin(q.y*4.+hash(cell)*TAU)*.018;
  float dist=abs(q.x-curve),aa=max(fwidth(dist),.008);
  float ribbon=1.-smoothstep(.008+share*.055,.008+share*.055+aa,dist);
  float packet=pow(.5+.5*cos(p.y*TAU*1.7-time*.95+side*1.8),12.);
  float a=ribbon*(.06+packet*.37)*sqrt(share)*step(.0001,share);
  ink+=(i==0?vec3(.62,.88,.64):i==1?vec3(.51,.73,.97):vec3(.96,.83,.57))*a;light+=a;
 }
 emit(ink/max(light,.001),min(.52,light)*d.a);
}`;
const hunger=base+`
void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(63.,31.5),id=floor(p),q=fract(p)-.5;
 float seed=hash(id),r=length(q),angle=fract(atan(q.y,q.x)/TAU+.25);
 float aa=max(fwidth(r),.012),rim=1.-smoothstep(.012,.012+aa,abs(r-.32));
 float arc=step(d.r,angle),glint=.5+.5*cos(angle*TAU*2.-time*.45+seed*TAU);
 float grain=exp(-pow(q.x*7.,2.)-pow((q.y+.08*sin(time*.22+seed*TAU))*4.,2.));
 float hatch=step(.62,fract((p.x+p.y)*4.))*smoothstep(.12,.35,r)*(.035+.045*glint);
 float alpha=d.g>.5?hatch:rim*arc*(.055+pow(glint,7.)*.22)+grain*.025;
 emit(mix(vec3(.69,.77,.57),vec3(.98,.84,.58),glint*.65),alpha*d.a);
}`;
const fisheries=base+`
void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(66.,33.),id=floor(p);
 float seed=hash(id),farm=step(d.r,seed),direction=mix(1.,-1.,farm);
 vec2 q=vec2(fract(p.x-time*.19*direction+seed)-.5,fract(p.y)-.5);
 q.y+=sin(p.x*.9+seed*TAU-time*.23)*.10;
 vec2 body=q/vec2(.22,.055);float fish=exp(-dot(body,body)*1.9);
 float tail=exp(-pow((q.x+.23*direction)*19.,2.)-pow((abs(q.y)-.055)*28.,2.));
 float current=pow(.5+.5*sin(p.y*TAU+sin(p.x*.45)-time*.35),22.);
 float sheen=.65+.25*sin(time*.25+seed*TAU);
 vec3 ink=mix(vec3(.42,.79,.94),vec3(.64,.92,.71),farm);
 emit(ink,((fish*.58+tail*.24)*sheen+current*.045)*(.18+.82*sqrt(d.b))*d.a);
}`;
const internet=base+`
void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02||d.r<.0001)discard;
 vec2 p=worldPoint(s)*vec2(61.,30.5),id=floor(p),q=fract(p)-.5;
 float connected=step(hash(id),d.r),aa=max(fwidth(q.x),.012);
 float horizontal=1.-smoothstep(.013,.013+aa,abs(q.y));
 float vertical=1.-smoothstep(.013,.013+aa,abs(q.x));
 float diagonal=1.-smoothstep(.010,.010+aa,abs(q.x-q.y));
 float packet=pow(.5+.5*cos((p.x+p.y)*2.8-time*.9),16.);
 float node=exp(-dot(q,q)*950.)*(.55+.25*sin(time*.35+hash(id)*TAU));
 float wire=(horizontal+vertical+diagonal*.45)*(.018+packet*.27);
 emit(mix(vec3(.57,.69,.96),vec3(.87,.97,1.),packet),(wire+node*.23)*connected*d.a);
}`;
const refugees=base+`
void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02||d.r<=0.)discard;
 vec2 p=worldPoint(s)*vec2(47.,23.5),id=floor(p),q=fract(p)-.5;
 float seed=hash(id),width=.11+.18*sqrt(d.r),height=.29;
 float side=exp(-pow((abs(q.x)-width)*40.,2.))*(1.-smoothstep(height-.05,height+.05,abs(q.y)));
 float lintel=exp(-pow((q.y+height)*45.,2.))*(1.-smoothstep(width,width+.04,abs(q.x)));
 float light=.5+.5*sin(time*.28+seed*TAU+q.y*1.7);
 float inside=exp(-pow(q.x/max(width,.01),2.)*2.-pow(q.y/height,2.)*1.6);
 float alpha=(side+lintel)*(.045+pow(light,4.)*.20)+inside*(.015+light*.025);
 emit(mix(vec3(.70,.66,.74),vec3(1.,.85,.65),light),alpha*(.25+.75*sqrt(d.r))*d.a);
}`;
export const ATLAS100_SHADERS=Object.freeze({wateruse,hunger,fisheries,internet,refugees});
const clamp=v=>Math.max(0,Math.min(1,v));
export function atlas100Signal({definition,row,fishMax=1}){
 if(!Number.isFinite(row?.value)||row.invalidComposition)return null;
 if(definition.id==='wateruse'){
  const components=[row.agriculture,row.industry,row.domestic];
  if(components.some(v=>!Number.isFinite(v)||v<0||v>100)||Math.abs(components.reduce((a,b)=>a+b,0)-100)>1)return null;
  return components.map(v=>v/100);
 }
 if(definition.id==='hunger')return [clamp(row.value/100),row.censored?1:0,0];
 if(definition.id==='fisheries'){
  if(!Number.isFinite(row.capture)||!Number.isFinite(row.aquaculture)||row.capture<0||row.aquaculture<0||row.value<=0)return null;
  return [clamp(row.capture/row.value),clamp(row.aquaculture/row.value),clamp(row.value/Math.max(1,fishMax))];
 }
 if(definition.id==='internet')return [clamp(row.value/100),0,0];
 if(definition.id==='refugees')return row.value>0?[clamp(row.value/7000000),0,0]:null;
 return null;
}
export const createAtlas100Motion=()=>createCountryThemeMotion({fragmentSources:ATLAS100_SHADERS});
