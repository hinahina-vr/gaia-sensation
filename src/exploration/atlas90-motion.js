import {COUNTRY_MOTION_PREFIX,createCountryThemeMotion} from './country-theme-motion.js?v=release100-c363-20261027';
// National textures are illustrative; they do not locate cities or people.
// The polar textures are clipped to the measured-area diagrams, not coastlines.
const base=COUNTRY_MOTION_PREFIX+`
const float TAU=6.2831853;
vec2 screenPoint(){return vec2(uv.x,1.-uv.y);}
vec2 worldPoint(vec2 s){return (s*resolution-map.xy)/map.zw;}
void emit(vec3 ink,float a){result=vec4(ink*a,a);}
`;
const urban=base+`
void main(){
 vec2 s=screenPoint();vec4 data=texture(countries,s);if(data.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(105.,52.5),id=floor(p),q=fract(p)-.5;
 float seed=hash(id),district=.5+.5*sin(id.x*.39+sin(id.y*.21)*2.);
 float built=step(seed,sqrt(data.r)*(.35+.65*district));
 vec2 offset=(vec2(hash(id+7.),hash(id+23.))-.5)*.25;
 vec2 d=abs(q-offset)-vec2(.16+.12*hash(id+37.),.19+.10*seed);
 float edge=max(d.x,d.y),aa=max(fwidth(edge),.008);
 float facade=1.-smoothstep(0.,aa,edge);
 vec2 windows=fract((q-offset)*8.)-.5;
 float pane=exp(-dot(windows,windows)*65.);
 float glow=.65+.22*sin(time*.23+seed*TAU);
 float sweep=pow(.5+.5*cos(p.y*.19+p.x*.61-time*.5),12.);
 float street=exp(-pow((abs(q.x)-.47)*50.,2.))*(.025+sweep*.12)*data.r;
 emit(mix(vec3(.86,.68,.39),vec3(1.,.91,.66),sweep),(facade*(.03+pane*.29*glow+sweep*.08)*built+street)*data.a);
}`;
const generations=base+`
void main(){
 vec2 s=screenPoint();vec4 data=texture(countries,s);if(data.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(52.,26.);
 float bend=sin(p.x*.55+sin(p.x*.19))* .55;
 float course=p.y+bend,thread=abs(fract(course)-.5);
 float woven=abs(fract(p.y-bend+.31)-.5);
 float aa=max(fwidth(course),.012);
 float a=1.-smoothstep(.018,.018+aa*1.5,thread);
 float b=1.-smoothstep(.016,.016+aa*1.5,woven);
 float packet=pow(.5+.5*cos(p.x*.65-time*.42+floor(course)*.9),14.);
 float returnLight=pow(.5+.5*cos(p.x*.47+time*.27),18.);
 float strength=.2+.8*sqrt(data.r);
 vec3 ink=mix(vec3(.65,.64,.88),vec3(.98,.85,.73),packet);
 emit(ink,(a*(.035+packet*.34)+b*(.025+returnLight*.17))*strength*data.a);
}`;
const cradle=base+`
void main(){
 vec2 s=screenPoint();vec4 data=texture(countries,s);if(data.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(72.,36.),id=floor(p);
 vec2 q=fract(p)-.5-(vec2(hash(id+5.),hash(id+11.))-.5)*.18;
 float sway=sin(time*.22+hash(id)*TAU)*.08;
 q.x+=sway;
 vec2 oval=q/vec2(.45,.23);float distanceToBowl=abs(length(oval)-1.);
 float aa=max(fwidth(distanceToBowl),.035);
 float shell=(1.-smoothstep(.025,.025+aa,distanceToBowl))*smoothstep(-.08,.03,q.y);
 float angle=atan(oval.y,oval.x);
 float travelling=pow(.5+.5*cos(angle-time*.52+hash(id+17.)*TAU),14.);
 float halo=exp(-dot(oval,oval)*2.8)*.035;
 vec3 ink=mix(vec3(.60,.92,.86),vec3(.74,.64,.91),data.r);
 emit(mix(ink,vec3(.96,1.,.96),travelling*.5),(shell*(.11+travelling*.31)+halo)*data.a);
}`;
const ice=base+`
void main(){
 vec2 s=screenPoint();vec4 data=texture(countries,s);if(data.a<.02)discard;
 vec2 p=s*resolution/23.;
 float axis=min(abs(fract(p.x*.866+p.y*.5)-.5),min(abs(fract(p.x*.866-p.y*.5)-.5),abs(fract(p.y)-.5)));
 float aa=max(fwidth(axis),.018);
 float crystal=1.-smoothstep(.015,.015+aa,axis);
 float facets=.5+.5*sin(p.x*.7+sin(p.y*.9));
 float sheen=.5+.5*sin(p.x*.85+p.y*.63-time*.8);
 float drift=.5+.5*cos(p.x*1.27-p.y*.79+time*.51);
 vec3 ink=mix(vec3(.22,.58,.75),vec3(.86,.99,1.),sheen);
 emit(ink,(crystal*(.12+sheen*.22)+facets*(.015+drift*.035))*(.6+.4*data.r)*data.a);
}`;
const snow=base+`
void main(){
 vec2 s=screenPoint();vec4 data=texture(countries,s);if(data.a<.02)discard;
 vec2 p=s*resolution/25.,cell=floor(p);float flakes=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));float seed=hash(id),phase=fract(seed+time*(.12+seed*.07));
  vec2 center=id+vec2(.5+.24*sin(seed*TAU+time*.18),phase);
  vec2 q=p-center;float angle=seed*TAU+time*.10;
  q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
  float radius=length(q),arms=min(abs(q.x),min(abs(q.x*.5+q.y*.866),abs(q.x*.5-q.y*.866)));
  float crystal=(1.-smoothstep(.012,.012+max(fwidth(arms)*.9,.008),arms))*(1.-smoothstep(.10,.18,radius));
  flakes+=crystal*sin(phase*3.14159265);
 }
 float sheen=.5+.5*sin(p.x*.13+p.y*.17-time*.21);
 emit(mix(vec3(.66,.85,.96),vec3(1.,.98,.86),data.g),flakes*(.27+.18*sheen)*(.7+.3*data.g)*data.a);
}`;
export const ATLAS90_SHADERS=Object.freeze({urban,ageing:generations,childsurvival:cradle,seaice:ice,snowcover:snow});
const clamp=v=>Math.max(0,Math.min(1,v));
export function atlas90Signal({definition,value}){
 if(!Number.isFinite(value))return null;
 if(definition.id==='urban'||definition.id==='ageing')return [clamp(value/100),0,0];
 if(definition.id==='childsurvival')return [clamp(value/150),0,0];
 return null;
}
let shared;
// Urban, demography and seasonal diagrams reuse one context across navigation.
export const sharedAtlas90Motion=()=>shared??=createCountryThemeMotion({fragmentSources:ATLAS90_SHADERS});
