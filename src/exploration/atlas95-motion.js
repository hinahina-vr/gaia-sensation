import {COUNTRY_MOTION_PREFIX,createCountryThemeMotion} from './country-theme-motion.js?v=surface-release-2e596f2-20261028';
// Motion is an illustrative texture on the measured diagrams or event markers.
// It is not a reconstruction of ocean velocity, eruption dynamics or tsunami travel.
const base=COUNTRY_MOTION_PREFIX+`
const float TAU=6.2831853;
void emit(vec3 ink,float a){result=vec4(ink*a,a);}
vec4 sampleMask(){return texture(countries,vec2(uv.x,1.-uv.y));}
`;
const oceanheat=base+`
void main(){
 vec4 d=sampleMask();if(d.a<.02)discard;
 vec2 p=d.gb*vec2(5.,9.);float heat=d.r*2.-1.;
 float slow=time*.24*mix(.55,1.,abs(heat));
 float bend=sin(p.y*.9+sin(p.x*.8)*1.3+slow)*.38;
 float flow=pow(.5+.5*cos((p.x+bend)*9.+sin(p.y-slow)*2.),14.);
 float eddy=.5+.5*sin(p.y*2.+sin(p.x*1.8)-slow*1.8);
 float glint=pow(eddy,9.);
 vec3 ink=mix(vec3(.18,.67,.88),vec3(1.,.67,.32),smoothstep(.40,.60,d.r));
 emit(mix(ink,vec3(1.,.94,.79),glint*.38),(flow*(.10+.30*glint)+eddy*.028)*d.a);
}`;
const ozone=base+`
void main(){
 vec4 d=sampleMask();if(d.a<.02)discard;
 vec2 q=d.gb*2.-1.;float angle=atan(q.y,q.x),r=length(q);
 float curtain=.5+.5*sin(angle*11.+sin(angle*3.+time*.19)*1.3-time*.48);
 float sheen=.5+.5*cos(angle*2.-time*.33+r*5.);
 vec3 ink=mix(vec3(.47,.59,.90),vec3(.87,.74,1.),sheen);
 emit(mix(ink,vec3(.83,.98,1.),curtain*.35),(.10+pow(curtain,5.)*.38+sheen*.06)*d.a);
}`;
const glaciers=base+`
void main(){
 vec4 d=sampleMask();if(d.a<.02)discard;
 vec2 p=d.gb*vec2(18.,12.);float bend=sin(p.y*.6+p.x*.22)*.38;
 float crack=abs(fract(p.x+bend+sin(p.y*.21)*.4)-.5);
 float aa=max(fwidth(crack),.025);
 float seam=1.-smoothstep(.018,.018+aa,crack);
 float light=.5+.5*sin(p.y*.8-p.x*.19-time*.35);
 float dust=pow(.5+.5*cos(p.y*5.-time*.6+sin(p.x*4.)),14.);
 vec3 ink=mix(vec3(.25,.66,.86),vec3(.87,.99,1.),light);
 emit(ink,(seam*(.07+pow(light,5.)*.35)+dust*.035)*d.a);
}`;
const volcanoes=base+`
void main(){
 vec4 d=sampleMask();if(d.a<.02)discard;
 vec2 q=d.gb*2.-1.;float t=time*.30;
 float plumeWidth=.12+.20*(1.-d.b);
 float drift=sin(q.y*3.-t)*(.04+.09*(1.-d.b));
 float smoke=exp(-pow((q.x-drift)/plumeWidth,2.))*smoothstep(-.98,-.55,q.y)*(1.-smoothstep(.18,.40,q.y));
 float breath=.72+.14*sin(t+q.y*2.);
 smoke*=.55+.65*surfaceField(vec2(q.x*7.,q.y*5.+time*.18));
 float mouth=exp(-pow(q.x*6.,2.)-pow((q.y-.32)*13.,2.));
 float lava=exp(-pow((abs(q.x)-(.34+q.y)*.26)*25.,2.))*smoothstep(.23,.38,q.y)*(1.-smoothstep(.78,.95,q.y));
 float sparks=0.;
 for(int i=0;i<4;i++){float k=float(i),phase=fract(time*.12+k*.27),yy=.26-phase*1.1,xx=sin(k*2.4+phase*3.)*.13;vec2 v=q-vec2(xx,yy);sparks+=exp(-dot(v,v)*1800.)*sin(phase*3.14159265);}
 vec3 ink=mix(vec3(.60,.55,.51),vec3(1.,.57,.19),clamp(mouth+lava+sparks,0.,1.));
 emit(ink,(smoke*.24*breath+mouth*.62+lava*.48+sparks*.7)*d.a);
}`;
const tsunamis=base+`
void main(){
 vec4 d=sampleMask();if(d.a<.02)discard;
 vec2 q=d.gb*2.-1.;float r=length(q),angle=atan(q.y,q.x);
 float phase=r*5.5-time*.44+.055*sin(angle*5.+time*.14)*r;
 float ridge=pow(.5+.5*cos(phase*TAU),19.);
 float shoulder=pow(.5+.5*cos(phase*TAU-.65),8.);
 float spread=smoothstep(.06,.18,r)*(1.-smoothstep(.66,.98,r));
 float arcs=.72+.28*sin(angle*3.+r*2.);
 vec3 ink=mix(vec3(.22,.65,.82),vec3(.77,.98,.94),ridge);
 emit(ink,(ridge*.43+shoulder*.12)*spread*arcs*d.a);
}`;
export const ATLAS95_SHADERS=Object.freeze({oceanheat,ozone,glaciers,volcanoes,tsunamis});
export const createAtlas95Motion=()=>createCountryThemeMotion({fragmentSources:ATLAS95_SHADERS});
