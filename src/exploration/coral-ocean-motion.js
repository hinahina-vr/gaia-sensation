import {coralOceanVelocity} from './coral-ocean-model.js?v=coral-ocean-20261023';

// Display-only advection, shared with the streamlines; never moves the real POIs.
export const CORAL_FLOW_SPEED=.56,CORAL_FLOW_PERIOD=12;

export function buildCoralOceanMotionField(width=256,height=128){
 const pixels=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const flow=coralOceanVelocity(-30+(x+.5)*360/width,90-(y+.5)*180/height),i=(y*width+x)*4;
  pixels[i]=Math.round((flow.u+1)*127.5);pixels[i+1]=Math.round((1-flow.v)*127.5);pixels[i+3]=255;
 }
 return{pixels,width,height};
}

// The just-reset layer has zero weight and zero weight derivative. Two phases
// bound displacement without an abrupt reset or reversing the current.
export function coralOceanPhase(time,out){
 const phase=((time/CORAL_FLOW_PERIOD)%1+1)%1;
 out[0]=phase*CORAL_FLOW_PERIOD;out[1]=((phase+.5)%1)*CORAL_FLOW_PERIOD;
 out[2]=.5-.5*Math.cos(phase*Math.PI*2);return out;
}

export const coralOceanMotionGLSL=`
uniform sampler2D circulation;
float surfaceLight(vec2 p){
 vec2 q=p*6.28318530718;
 float ribbon=q.x*18.+q.y*14.+sin(q.x*4.-q.y*3.)*2.5;
 return 1.+sin(ribbon)*.10+sin(q.x*7.-q.y*9.)*.04;
}
vec4 surfaceInk(vec2 p){vec4 ink=texture(ocean,p);return vec4(ink.rgb*surfaceLight(p),ink.a);}
vec4 movingSurface(vec2 p,float time){
 vec2 velocity=(texture(circulation,p).rg*2.-1.)*${CORAL_FLOW_SPEED}/vec2(360.,180.);
 float phase=fract(time/${CORAL_FLOW_PERIOD.toFixed(1)}),blend=.5-.5*cos(phase*6.28318530718);
 vec2 a=p-velocity*(phase*${CORAL_FLOW_PERIOD.toFixed(1)}),b=p-velocity*(fract(phase+.5)*${CORAL_FLOW_PERIOD.toFixed(1)});
 return mix(surfaceInk(b),surfaceInk(a),blend);
}`;

function sampleSurface(field,u,v,out){
 const {width:w,height:h,pixels:source}=field;
 const sx=(((u*w-.5)%w)+w)%w,sy=Math.max(0,Math.min(h-1,v*h-.5));
 const x0=Math.floor(sx),y0=Math.floor(sy),x1=(x0+1)%w,y1=Math.min(h-1,y0+1),fx=sx-x0,fy=sy-y0;
 const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
 const x=u*Math.PI*2,y=v*Math.PI*2,ribbon=x*18+y*14+Math.sin(x*4-y*3)*2.5;
 const light=1+Math.sin(ribbon)*.10+Math.sin(x*7-y*9)*.04;
 for(let k=0;k<3;k++)out[k]=((source[a+k]*(1-fx)+source[b+k]*fx)*(1-fy)+(source[c+k]*(1-fx)+source[d+k]*fx)*fy)*light;
}

// Reuse low-resolution buffers; CPU fallback follows the same field and phases.
export function paintCoralOceanMotion(field,time,pixels,circulation){
 const {width:w,height:h,pixels:source}=field,flow=circulation.pixels;
 const phase=coralOceanPhase(time,new Float64Array(3)),a=new Float64Array(3),b=new Float64Array(3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,u=(x+.5)/w,v=(y+.5)/h;
  const vx=(flow[i]/127.5-1)*CORAL_FLOW_SPEED/360,vy=(flow[i+1]/127.5-1)*CORAL_FLOW_SPEED/180;
  sampleSurface(field,u-vx*phase[0],v-vy*phase[0],a);sampleSurface(field,u-vx*phase[1],v-vy*phase[1],b);
  for(let k=0;k<3;k++)pixels[i+k]=a[k]*phase[2]+b[k]*(1-phase[2]);
  pixels[i+3]=source[i+3];
 }
}
