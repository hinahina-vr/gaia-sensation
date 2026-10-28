import {COUNTRY_MOTION_PREFIX,createCountryThemeMotion} from './country-theme-motion.js?v=surface-release-2e596f2-20261028';
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
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(128.,64.);float district=surfaceField(p*.17);
 vec2 block=floor(p),q=fract(p)-.5;float seed=hash(block);
 float built=step(seed,d.r*(.35+district));
 vec2 size=vec2(.15+.17*hash(block+37.),.15+.25*seed);
 float facade=softLine(max(abs(q.x)-size.x,abs(q.y)-size.y),0.);
 vec2 w=fract((q+vec2(.03,.02))*9.)-.5;float window=exp(-dot(w,w)*42.);
 float evening=.68+.20*sin(time*.23+district*6.+seed*3.);
 float pulse=pow(.5+.5*cos(p.x*.27+p.y*.15-time*.42),15.);
 float avenue=softLine(abs(q.x),.012)*(.02+pulse*.13)*d.r;
 float glow=exp(-dot(q,q)*6.)*built*.06;
 vec3 ink=mix(vec3(.34,.68,.86),vec3(1.,.85,.52),window*.85);
 emit(ink,(facade*(.06+window*.55*evening)*built+avenue+glow)*d.a);
}
`;
const generations=base+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(40.,20.);float fold=surfaceField(p*.22)*2.;
 float warp=p.y+sin(p.x*.28+fold)*1.1,weft=p.x*.55-sin(p.y*.34)*.8;
 float a=softLine(abs(fract(warp*2.)-.5),.028),b=softLine(abs(fract(weft)-.5),.022);
 float light=.5+.5*sin(p.x*.4+p.y*.28-time*.26+fold);
 float older=smoothstep(.2,.8,light),younger=1.-older;
 vec3 c=mix(vec3(.43,.66,.82),vec3(.84,.74,.93),older);
 emit(c,(a*(.07+older*.20*(.35+d.r))+b*(.06+younger*.20)+a*b*.13)*d.a);
}
`;
const cradle=base+`

void main(){
 vec2 s=screenPoint();vec4 d=texture(countries,s);if(d.a<.02)discard;
 vec2 p=worldPoint(s)*vec2(50.,25.),id=floor(p);
 vec2 q=fract(p)-.5-(vec2(hash(id+5.),hash(id+11.))-.5)*.34;
 float r=length(q/vec2(.40,.28)),phase=hash(id)*TAU;
 float breath=.65+.22*sin(time*.40+phase);
 float arc=softLine(abs(r-.84),.06)*smoothstep(-.13,.13,q.y);
 float seed=exp(-dot(q/vec2(.09,.12),q/vec2(.09,.12))*2.);
 float aura=exp(-r*r*2.5),protect=.5+.5*cos(atan(q.y,q.x)-time*.25+phase);
 vec3 c=mix(vec3(.47,.85,.80),vec3(.76,.68,.91),d.r);
 emit(mix(c,vec3(.94,1.,.95),seed),(arc*(.12+protect*.19)+seed*.36+aura*.07)*breath*d.a);
}
`;
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
