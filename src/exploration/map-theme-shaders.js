export const MAP_THEME_VERTEX = `#version 300 es
in vec2 a_position;
void main(){ gl_Position=vec4(a_position,0.0,1.0); }
`;

// Broad, continuously advecting light inspired by exhibit 21's ocean silk.
// No observation values, thresholds, point coordinates or counts enter this
// shader. The land mask keeps the measurement layer visually dominant.
export const MAP_THEME_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec4 u_geo_view;
uniform sampler2D u_land;
uniform float u_mask_ready;
uniform float u_ocean_only;
uniform float u_time;
uniform float u_seed;
uniform int u_pattern;
uniform vec3 u_accent;
uniform vec3 u_secondary;
out vec4 out_color;
const float TAU=6.2831853;

float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y); }
float mist(vec2 p){ return noise(p)*.58+noise(p*2.03+4.1)*.28+noise(p*4.09-3.2)*.14; }
float ridge(float phase,float width){ return exp(-pow(sin(phase)*width,2.0)); }
mat2 rotate(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}

vec3 water(vec2 p,float t){
  vec2 q=p+vec2(sin(p.y*1.5-t*.14),cos(p.x*1.3+t*.09))*.38;
  q+=.18*vec2(sin(q.y*2.8+q.x),sin(q.x*2.3-q.y));
  float phase=q.y*4.5+q.x*1.6+sin(q.x*1.7)*.6-t*.23;
  float broad=pow(.5+.5*cos(phase),3.0);
  float travel=pow(.5+.5*cos(q.x*6.0+q.y*2.0-t*1.05),10.0);
  return u_secondary*broad*.12+u_accent*ridge(phase*.5,8.0)*(.18+travel*.32)
    +mix(u_accent,u_secondary,.45)*ridge(phase*1.5+q.x*.3,18.0)*broad*.15;
}
vec3 air(vec2 p,float t){
  vec2 q=rotate(.12+u_seed*.015)*p;
  float bend=mist(q*.72+vec2(-t*.09,t*.02));
  float phase=q.y*3.4+bend*3.0+sin(q.x*.65-t*.18)*1.3;
  float travel=pow(.5+.5*cos(q.x*4.0+phase-t*.65),7.0);
  return u_accent*ridge(phase,8.0)*(.13+travel*.20)+u_secondary*pow(.5+.5*cos(phase*.56),4.0)*(.055+bend*.11);
}
vec3 droplets(vec2 p,float t,bool rising){
  vec2 q=p*2.5+vec2(sin(p.y*.7)*.3,rising?-t*.17:t*.35);
  vec2 cell=floor(q),local=fract(q)-.5;float seed=hash(cell);
  local.x+=sin(t*.5+seed*TAU)*.035;
  float radius=.05+seed*.11;
  float ring=exp(-abs(length(local)-radius)*70.0);
  float center=exp(-length(local)*25.0);
  float select=smoothstep(.58,.85,seed);
  return mix(u_accent,u_secondary,seed)*(ring*.22+center*.07)*select;
}
vec3 fish(vec2 p,float t){
  vec3 c=vec3(0);
  // Sparse swimming ribbons, not representations of species or abundance.
  for(int i=0;i<5;i++){
    float n=float(i),y=n*.54+sin(p.x*.65+n+u_seed)*.23;
    float band=p.y-y+1.15;
    float phase=p.x*2.4-t*(.65+n*.05)+n*1.9;
    float body=exp(-pow(band*38.0,2.0))*pow(.5+.5*cos(phase),16.0);
    float wake=exp(-pow((band+sin(phase*1.5)*.025)*62.0,2.0))*pow(.5+.5*cos(phase-.55),5.0);
    c+=mix(u_accent,u_secondary,n*.16)*(body*.5+wake*.13);
  }
  return c;
}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  vec2 geo=vec2(u_geo_view.x+uv.x*u_geo_view.z,u_geo_view.y-(1.0-uv.y)*u_geo_view.w);
  float land=texture(u_land,vec2(fract((geo.x+180.0)/360.0),clamp((90.0-geo.y)/180.0,0.0,1.0))).r;
  // Match exhibit 21: land is fully excluded, not merely dimmed.
  float mask=mix(1.0,mix(.18,0.0,u_ocean_only),smoothstep(.05,.45,land))*u_mask_ready;
  float frequency=clamp(6.0/u_geo_view.z,.055,.6);
  vec2 p=(geo-vec2(135.0,34.0))*vec2(.82,1.0)*frequency+vec2(u_seed*.13,u_seed*.09);
  float t=u_time;
  vec3 color=vec3(0);
  if(u_pattern==0){
    vec2 q=vec2(p.x*.8,p.y*.7-t*.13);float n=mist(q);
    float flame=p.x*3.3+sin(p.y*1.5-t*.25)*.6+n*2.6;
    color=u_accent*ridge(flame,5.0)*pow(n,2.0)*.42+u_secondary*pow(n,4.0)*.24;
  }else if(u_pattern==1){ color=water(p,t); }
  else if(u_pattern==2){
    float phase=p.y*4.3+sin(p.x*1.35-t*.16)*1.2;
    color=u_accent*ridge(phase,8.0)*.32+u_secondary*ridge(phase+1.5+sin(p.x-t*.25)*.24,8.0)*.32;
    color+=water(p*.72,t)*.45;
  }else if(u_pattern==3){color=water(p,t)*.72+droplets(p,t,true);}
  else if(u_pattern==4){
    vec2 q=p+vec2(sin(p.y*1.4+t*.11),cos(p.x*1.7-t*.14))*.45;
    float phase=q.y*4.2+sin(q.x*1.8)*1.1;
    color=mix(u_accent,u_secondary,.5+.5*sin(q.x*.8+q.y))*ridge(phase,8.0)*.38;
    color+=mix(u_secondary,u_accent,mist(q*.6))*pow(.5+.5*cos(phase*.43),3.0)*.14;
  }else if(u_pattern==5){
    float n=mist(p*.8+vec2(t*.075,t*.028));
    color=mix(u_accent,u_secondary,n)*smoothstep(.30,.88,n)*.34+air(p,t)*.40;
  }else if(u_pattern==6){
    vec2 q=p-vec2(.5,-.25);float r=length(q*vec2(.85,1.1));
    float phase=r*5.7+sin(atan(q.y,q.x)*3.0+t*.10)*.6-t*.18;
    color=mix(u_accent,u_secondary,.5+.5*sin(r))*ridge(phase,9.0)*.33+water(p,t)*.24;
  }else if(u_pattern==7){
    // Latitude grows upward: advance texture coordinates upward so rain falls down.
    vec2 q=p*vec2(12.0,4.0)+vec2(0,t*2.0);vec2 cell=floor(q),local=fract(q)-.5;
    float drops=exp(-pow(local.x*42.0,2.0))*pow(.5+.5*cos(local.y*TAU),2.0)*step(.65,hash(cell));
    // No upward-moving water ribbons behind the rain: every moving mark falls.
    color=u_accent*drops*.65;
  }else if(u_pattern==8){
    float bend=sin(p.x*.65-t*.2)*.72+sin(p.x*1.1+p.y*.6)*.28;
    float phase=p.y*8.0+bend*3.0;
    color=u_accent*ridge(phase,13.0)*(.16+.30*pow(.5+.5*cos(p.x*3.0-t*1.8),6.0))+air(p,t)*.65;
  }else if(u_pattern==9){
    vec2 q=rotate(.38)*p;float phase=q.x*5.0+sin(q.y*.7+t*.08)*.8;
    color=u_accent*pow(.5+.5*cos(phase),14.0)*(.12+.2*mist(q*.55+vec2(0,-t*.06)));
    color+=u_secondary*ridge(phase*1.7,18.0)*.20+water(p,t)*.18;
  }else if(u_pattern==10){color=air(p,t);}
  else if(u_pattern==11){
    vec2 q=p*6.0+vec2(t*.12,t*.025);vec2 cell=floor(q),local=fract(q)-.5;
    float dust=exp(-dot(local,local)*180.0)*step(.74,hash(cell));
    color=air(p,t)*.75+mix(u_accent,u_secondary,hash(cell))*dust*.29;
  }else if(u_pattern==12){
    color=water(p,t)*.72+droplets(p,t*.3,false)*.42;
    float phase=p.y*6.0+sin(p.x*2.1-t*.12)+cos(p.y+p.x);
    color+=u_secondary*ridge(phase,18.0)*.19;
  }else if(u_pattern==13){
    vec2 q=p+vec2(sin(p.y-t*.12),cos(p.x+t*.07))*.2;
    float film=sin(q.x*3.0+q.y*2.0)+sin(q.y*4.0-q.x)+cos(q.x*2.0-t*.18);
    color=mix(u_accent,u_secondary,.5+.5*sin(film))*ridge(film*2.5,9.0)*.30+water(p,t)*.40;
  }else if(u_pattern==14){
    vec2 q=p*2.4;float n=mist(q*.6+vec2(t*.025,0));
    float cells=sin(q.x+sin(q.y)*1.1)*sin(q.y+cos(q.x)*.9);
    color=mix(u_accent,u_secondary,n)*ridge(cells*4.5+n,9.0)*.27+water(p,t)*.40;
  }else if(u_pattern==15){color=water(p,t)*.60+fish(p,t);}
  else if(u_pattern==16){
    vec2 q=rotate(.30)*p;float bend=sin(q.x*.7+t*.05)*.8;
    float rows=q.y*9.0+bend*3.0;
    float travel=.5+.5*cos(q.x*1.5-t*.45);
    color=mix(u_accent,u_secondary,.5+.5*sin(q.y*.8))*ridge(rows,12.0)*(.17+travel*.24)+water(p*.7,t)*.35;
  }else{
    vec2 q=rotate(.35)*p;float a=q.y*5.0+sin(q.x*.75-t*.10),b=q.x*4.0+sin(q.y*.85+t*.08);
    color=u_accent*ridge(a,11.0)*(.12+.2*pow(.5+.5*cos(q.x*2.0-t*.8),5.0));
    color+=u_secondary*ridge(b,11.0)*(.12+.2*pow(.5+.5*cos(q.y*2.0+t*.6),5.0));
    color+=water(p,t)*.23;
  }
  float edge=smoothstep(0.0,.10,uv.y)*(1.0-smoothstep(.91,1.0,uv.y));
  color*=mask*edge;
  out_color=vec4(clamp(color,0.0,1.0),.88*mix(u_mask_ready,mask,u_ocean_only));
}
`;
