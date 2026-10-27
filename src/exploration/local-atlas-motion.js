import {COUNTRY_MOTION_PREFIX,createCountryThemeMotion} from './country-theme-motion.js?v=release100-c363-20261027';

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
 vec2 screen=screenPoint();vec4 data=texture(countries,screen);if(data.a<.02)discard;
 vec2 p=worldPoint(screen)*vec2(70.,35.);vec2 cell=floor(p);
 float nearest=9.,second=9.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));
  vec2 center=id+.5+(vec2(hash(id+3.),hash(id+17.))-.5)*.78;
  float d=length(p-center);if(d<nearest){second=nearest;nearest=d;}else second=min(second,d);
 }
 float stress=data.r,scar=second-nearest;
 float aa=max(fwidth(scar),.012),width=mix(.12,.016,stress);
 float vein=1.-smoothstep(width,width+aa*2.,scar);
 float current=.5+.5*sin(p.x*.73+p.y*.47-time*.65);
 float pooling=exp(-nearest*nearest*9.)*(1.-stress);
 float pulse=pow(current,7.);
 vec3 ink=mix(vec3(.34,.82,.88),vec3(.99,.66,.37),stress);
 float alpha=(vein*(.045+pulse*.25)+pooling*(.05+current*.10))*(.45+.55*max(stress,data.g))*data.a;
 emit(ink,alpha);
}`;
const cropland=common+`
void main(){
 vec2 screen=screenPoint();vec4 data=texture(countries,screen);if(data.a<.02)discard;
 vec2 p=worldPoint(screen)*vec2(110.,55.);
 float bend=.21*sin(p.x*.28)+.11*sin(p.x*.83);
 float course=p.y+bend,phase=fract(course)-.5;
 float ridge=exp(-phase*phase*720.);
 float field=step(hash(vec2(floor(p.x/3.),floor(course))),sqrt(data.r));
 float wind=.5+.5*sin(p.x*.6+p.y*.16-time*.75);
 float glint=pow(.5+.5*cos(p.x*.42-time*.32+floor(course)*.7),18.);
 float alpha=(ridge*(.06+wind*.11+glint*.28)+exp(-phase*phase*35.)*.025)*field*data.a;
 vec3 ink=mix(vec3(.72,.67,.39),vec3(1.,.88,.58),wind);
 if(changeMode>.5)ink=mix(vec3(.45,.78,.86),vec3(.97,.8,.43),smoothstep(.3,.7,data.g));
 emit(ink,alpha);
}`;
const grain=common+`
void main(){
 vec2 screen=screenPoint();vec4 data=texture(countries,screen);if(data.a<.02)discard;
 vec2 p=worldPoint(screen)*vec2(105.,52.5);vec2 cell=floor(p);float stems=0.,ears=0.;
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
 float light=.5+.5*sin(p.x*.12+p.y*.17-time*.34);
 emit(mix(vec3(.65,.77,.47),vec3(1.,.89,.54),light),(stems*.12+ears*(.16+.12*data.r))*sqrt(data.r)*data.a);
}`;
const nutrients=common+`
void main(){
 vec2 screen=screenPoint();vec4 data=texture(countries,screen);if(data.a<.02)discard;
 vec2 p=worldPoint(screen)*vec2(120.,60.);vec2 cell=floor(p);float beads=0.,halos=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));float seed=hash(id);
  float enabled=step(seed,.9*data.r);
  float cycle=fract(time*.105+seed),envelope=sin(cycle*3.14159265);
  vec2 center=id+vec2(.5+.17*sin(cycle*4.+seed*TAU),.12+cycle*.76);
  vec2 d=p-center;float radius=.018+.035*data.r;
  beads+=exp(-dot(d,d)/(radius*radius))*enabled*envelope;
  halos+=exp(-dot(d,d)*95.)*enabled*envelope;
 }
 float strata=exp(-pow(sin((p.y+.10*sin(p.x*.6))*3.14159265)*18.,2.));
 vec3 ink=mix(vec3(.55,.89,.77),vec3(.99,.83,.49),data.r);
 emit(ink,(beads*.56+halos*.055+strata*.035*data.r)*data.a);
}`;
const timeWaves=common+`
void main(){
 vec2 screen=screenPoint();vec4 data=texture(countries,screen);if(data.a<.02)discard;
 vec2 p=worldPoint(screen)*vec2(65.,32.5);vec2 cell=floor(p/2.5);
 vec2 center=(cell+.5)*2.5;vec2 d=p-center;
 float radius=length(d),angle=atan(d.y,d.x);
 float phase=radius*2.-time*.12;
 float band=abs(fract(phase)-.5);
 float wave=1.-smoothstep(.025,.025+max(fwidth(phase)*1.5,.018),band);
 float arc=.25+.75*smoothstep(-.4,.8,cos(angle-time*.14-hash(cell)*TAU));
 float lengthening=smoothstep(.0,.12,data.r-(angle+3.14159265)/TAU);
 float spark=pow(.5+.5*cos(angle-time*.38+hash(cell)*TAU),60.);
 vec3 ink=mix(vec3(.22,.51,.70),vec3(.92,.97,1.),spark);
 float envelope=1.-smoothstep(.9,1.24,radius);
 float alpha=wave*(arc*(.22+data.r*.25)+spark*.45)*lengthening*envelope*data.a;
 emit(ink,alpha);
}`;
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
