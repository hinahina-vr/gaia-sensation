import {COUNTRY_MOTION_PREFIX,createCountryThemeMotion} from './country-theme-motion.js?v=surface-release-2e596f2-20261028';

// National values control these illustrative textures. They do not locate
// aquifers, fields, applications of fertilizer, or individual people's lives.
const common=COUNTRY_MOTION_PREFIX+`
const float TAU=6.2831853;
vec2 screenPoint(){return vec2(uv.x,1.-uv.y);}
vec2 worldPoint(vec2 screen){return (screen*resolution-map.xy)/map.zw;}
void emit(vec3 ink,float alpha){result=vec4(ink*alpha,alpha);}
`;
const waterstress=common+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(48.,24.);
 float terrain=surfaceField(p*.45),course=p.y+terrain*3.+sin(p.x*.27)*.8;
 float dist=abs(fract(course)-.5),width=mix(.13,.018,d.r);
 float channels=softLine(dist,width),bank=exp(-dist*dist*32.);
 float current=pow(.5+.5*cos(p.x*1.8-time*.63+terrain*5.),10.);
 float dry=smoothstep(.48,.75,terrain)*d.r;
 vec3 ink=mix(vec3(.21,.77,.85),vec3(.96,.66,.34),d.r);
 emit(ink,(channels*(.08+current*.40)+bank*.07*(1.-d.r)+dry*.045)*(.45+.55*max(d.r,d.g))*d.a);
}
`;
const cropland=common+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(90.,45.),parcel=floor(p/3.);
 float seed=hash(parcel),a=(seed-.5)*1.1;vec2 q=mat2(cos(a),-sin(a),sin(a),cos(a))*p;
 float course=q.y*2.+sin(q.x*.4)*.25,dist=abs(fract(course)-.5);
 float rows=softLine(dist,.035),field=step(seed,d.r);
 vec2 edge=abs(fract(p/3.)-.5);float margin=1.-smoothstep(.43,.5,max(edge.x,edge.y));
 float wind=.5+.5*sin(p.x*.35+p.y*.18-time*.65+surfaceField(p*.1)*3.);
 vec3 ink=mix(vec3(.35,.52,.22),vec3(.94,.84,.43),wind);
 if(changeMode>.5)ink=mix(vec3(.45,.78,.86),vec3(.97,.8,.43),smoothstep(.3,.7,d.g));
 emit(ink,(.09+rows*(.10+wind*.27))*field*margin*d.a);
}
`;
const grain=common+`
void main(){
 vec2 screen=screenPoint();vec4 data=texture(countries,screen);if(data.a<.02)discard;
 vec2 p=worldPoint(screen)*vec2(84.,42.);vec2 cell=floor(p);float stems=0.,ears=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));float seed=hash(id);
  vec2 root=id+vec2(.16+hash(id+13.)*.68,.55+hash(id+29.)*.4);
  float height=.18+data.r*.68;vec2 q=p-root;
  float t=clamp(-q.y/height,0.,1.);
  float sway=sin(id.x*.19+id.y*.27-time*.85+seed*.8)*.17;
  float stalk=exp(-pow((q.x-sway*t*t)*110.,2.))*step(-height,q.y)*step(q.y,0.);
  vec2 top=root+vec2(sway,-height);vec2 d=p-top;
  float head=exp(-pow(d.x/.07,2.)-pow(d.y/.15,2.));
  float seeds=.5+.5*cos((d.y/.15+seed)*18.);
  stems+=stalk;ears+=head*(.6+seeds*.4);
 }
 float light=.5+.5*sin(p.x*.22+p.y*.17-time*.56+surfaceField(p*.14)*2.);
 emit(mix(vec3(.65,.77,.47),vec3(1.,.89,.54),light),(stems*.18+ears*(.25+.22*data.r))*sqrt(data.r)*data.a);
}`;
const nutrients=common+`
void main(){
 vec2 screen=screenPoint();vec4 data=texture(countries,screen);if(data.a<.02)discard;
 vec2 p=worldPoint(screen)*vec2(96.,48.);vec2 cell=floor(p);float beads=0.,halos=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));float seed=hash(id);
  float enabled=step(seed,.9*data.r);
  float cycle=fract(time*.105+seed),envelope=sin(cycle*3.14159265);
  vec2 center=id+vec2(.5+.17*sin(cycle*4.+seed*TAU),.12+cycle*.76);
  vec2 d=p-center;float radius=.018+.035*data.r;
  beads+=exp(-dot(d,d)/(radius*radius))*enabled*envelope;
  halos+=exp(-dot(d,d)*95.)*enabled*envelope;
 }
 float strata=exp(-pow(sin((p.y+surfaceField(p*.16)*1.3)*3.14159265)*12.,2.));
 vec3 ink=mix(vec3(.55,.89,.77),vec3(.99,.83,.49),data.r);
 emit(ink,(beads*.68+halos*.095+strata*.07*data.r)*data.a);
}`;
const timeWaves=common+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(32.,16.);float field=surfaceField(p*.36);
 float course=p.y+sin(p.x*.35+field*2.)*1.6;
 float age=floor(course*2.),thread=abs(fract(course*2.)-.5);
 float line=softLine(thread,.024),span=pow(.5+.5*cos(p.x*.55-time*.26+hash(vec2(age,9.))*6.28),6.);
 float depth=.4+.6*surfaceNoise(vec2(age*.7,p.x*.05));
 float aura=exp(-thread*thread*22.);
 emit(mix(vec3(.32,.59,.75),vec3(.86,.96,1.),span),(line*(.06+span*.34)+aura*.05)*depth*(.22+.78*d.r)*d.a);
}
`;
export const LOCAL_ATLAS_SHADERS=Object.freeze({waterstress,cropland,yield:grain,fertilizer:nutrients,longevity:timeWaves});
const clamp=v=>Math.max(0,Math.min(1,v));
export function localAtlasSignal({definition,value,access,mode}){
 if(!Number.isFinite(value)||!Object.hasOwn(LOCAL_ATLAS_SHADERS,definition.id))return null;
 switch(definition.id){
  case 'waterstress':return [clamp(value/100),clamp(Math.log1p(Math.max(0,value))/Math.log(401)),0];
  case 'cropland':return Number.isFinite(access)?[clamp(access/100),mode==='change'?clamp((value+5)/10):clamp(value/100),0]:null;
  case 'yield':return [clamp(value/10000),0,0];
  case 'fertilizer':return [clamp(Math.log1p(Math.max(0,value))/Math.log(501)),0,0];
  case 'longevity':return [clamp((value-40)/50),0,0];
 }
}
export const createLocalAtlasMotion=()=>createCountryThemeMotion({fragmentSources:LOCAL_ATLAS_SHADERS});
