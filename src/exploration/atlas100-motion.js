import {COUNTRY_MOTION_PREFIX,createCountryThemeMotion} from './country-theme-motion.js?v=surface-release-2e596f2-20261028';
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
 vec2 p=worldPoint(s)*vec2(42.,21.);float bend=surfaceField(p*.24)*2.+sin(p.x*.27)*.7;
 float light=0.;vec3 ink=vec3(0.);
 for(int i=0;i<3;i++){
  float share=i==0?d.r:i==1?d.g:d.b,side=float(i);
  float course=p.y+bend+side*.31,dist=abs(fract(course)-.5);
  float ribbon=softLine(dist,.012+share*.11),bed=exp(-dist*dist*42.);
  float packet=pow(.5+.5*cos(p.x*1.6-time*.56+side*2.1),10.);
  float a=(ribbon*(.06+packet*.36)+bed*.04)*sqrt(share)*step(.0001,share);
  ink+=(i==0?vec3(.51,.84,.62):i==1?vec3(.44,.72,.97):vec3(.96,.82,.52))*a;light+=a;
 }
 emit(ink/max(light,.001),min(.6,light)*d.a);
}
`;
const hunger=base+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(70.,35.),id=floor(p);
 vec2 q=fract(p)-.5-(vec2(hash(id+4.),hash(id+13.))-.5)*.22;
 float seed=hash(id),r=length(q),angle=fract(atan(q.y,q.x)/TAU+.25);
 float rim=softLine(abs(r-.30),.015),arc=step(d.r,angle);
 float passing=.5+.5*sin(p.x*.25+p.y*.17-time*.30);
 vec2 grain=q/vec2(.11,.20);float kernel=exp(-dot(grain,grain)*2.5);
 float hatch=softLine(abs(fract((p.x+p.y)*3.)-.5),.04)*smoothstep(.10,.34,r)*.08;
 float alpha=d.g>.5?hatch:rim*arc*(.06+passing*.19)+kernel*(.10+passing*.20)*(1.-d.r);
 emit(mix(vec3(.55,.69,.37),vec3(.98,.84,.52),passing),alpha*d.a);
}
`;
const fisheries=base+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(84.,42.);float school=surfaceField(p*.16);
 float farm=step(d.r,hash(floor(p/3.))),dir=mix(1.,-1.,farm);
 vec2 q=vec2(fract(p.x-time*.22*dir+school)-.5,fract(p.y+school*.7)-.5);
 q.y+=sin(p.x*.65+school*6.-time*.35)*.08;
 vec2 body=q/vec2(.25,.065);float fish=exp(-dot(body,body)*1.8);
 float tail=exp(-pow((q.x+.24*dir)*18.,2.)-pow((abs(q.y)-.06)*26.,2.));
 float sheen=.5+.5*sin(p.x*.17+p.y*.25-time*.36);
 float grouped=smoothstep(.18,.65,school),strength=.18+.82*sqrt(d.b);
 emit(mix(vec3(.39,.77,.94),vec3(.57,.91,.69),farm),((fish*.60+tail*.22)*(.55+sheen*.45)*(.3+.7*grouped))*strength*d.a);
}
`;
const internet=base+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02||d.r<.0001)discard;
 vec2 p=worldPoint(s)*vec2(78.,39.),cell=floor(p);float wires=0.,nodes=0.;
 // Jittered local connections avoid a repeated square lattice. They remain
 // national-value textures, not the positions of users or cables.
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(x,y),a=id+.5+(vec2(hash(id+3.),hash(id+11.))-.5)*.65;
  vec2 other=id+vec2(1.,0.),b=other+.5+(vec2(hash(other+3.),hash(other+11.))-.5)*.65;
  float on=step(hash(id+31.),d.r),next=step(hash(other+31.),d.r);
  vec2 ab=b-a;float t=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.);
  float dist=length(p-a-t*ab),pulse=pow(.5+.5*cos(t*4.-time*.95+hash(id)*TAU),14.);
  wires+=softLine(dist,.009)*(.035+pulse*.35)*on*next;
  nodes+=exp(-dot(p-a,p-a)*850.)*(.36+.13*sin(time*.33+hash(id)*TAU))*on;
 }
 float glow=surfaceField(p*.16)*.025*d.r;
 emit(vec3(.65,.83,1.),min(.7,wires+nodes+glow)*d.a);
}
`;
const refugees=base+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02||d.r<=0.)discard;
 vec2 p=worldPoint(s)*vec2(62.,31.),id=floor(p);
 vec2 q=fract(p)-.5-(vec2(hash(id+5.),hash(id+19.))-.5)*.30;
 float seed=hash(id),width=.12+.10*sqrt(d.r),height=.23+.09*seed;
 float sides=softLine(abs(abs(q.x)-width),.012)*(1.-smoothstep(height-.03,height+.03,abs(q.y)));
 float top=softLine(abs(q.y+height),.012)*(1.-smoothstep(width,width+.03,abs(q.x)));
 float light=.65+.20*sin(time*.22+seed*TAU),inside=exp(-pow(q.x/width,2.)*2.-pow(q.y/height,2.));
 float clustered=.4+.6*surfaceField(p*.24);
 float alpha=((sides+top)*.17+inside*.14)*light*clustered*(.25+.75*sqrt(d.r))*d.a;
 emit(mix(vec3(.63,.64,.75),vec3(1.,.84,.56),inside*.7),alpha);
}
`;
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
