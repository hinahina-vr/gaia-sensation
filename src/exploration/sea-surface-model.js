// Three published ocean means drive colour. These broad display blends are not
// a gridded altimetry product; the changing highlights are decorative swells.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const palette=[[16,51,91],[25,109,145],[91,186,181],[231,199,130]];
export function seaSurfaceColor(value){
  if(!Number.isFinite(value))return null;
  const n=clamp((value+30)/150)*3,i=Math.min(2,Math.floor(n)),f=n-i;
  return palette[i].map((v,k)=>Math.round(v+(palette[i+1][k]-v)*f));
}
export function seaSurfaceWeights(lon,lat){
  const centers=[[-160,0],[-50,5],[80,-15]];
  const weights=centers.map(([x,y])=>Math.exp(5*(Math.cos((lon-x)*Math.PI/180)-1)-((lat-y)/100)**2));
  const sum=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/sum);
}
export function buildSeaSurfaceTexture(basins,year,width=360,height=180){
  const values=['pac','atl','ind'].map(id=>basins.find(r=>r.id===id)?.years.find(r=>r.year===year)?.value);
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const weights=seaSurfaceWeights(-30+(x+.5)/width*360,90-(y+.5)/height*180);
    let total=0,value=0;weights.forEach((w,i)=>{if(Number.isFinite(values[i])){total+=w;value+=values[i]*w;}});
    if(total<.001)continue;
    const rgb=seaSurfaceColor(value/total),i=(y*width+x)*4;pixels.set(rgb,i);pixels[i+3]=255;
  }
  return {width,height,pixels,values};
}
// World-anchored lighting, with no value/position jitter and no particle births.
export function seaSwellLight(x,y,time){
  const a=y*29+Math.sin(x*Math.PI*6+y*8)*2.4-time*.21;
  const b=x*Math.PI*16-y*21+Math.sin(y*17+x*Math.PI*2)*2+time*.14;
  const c=x*Math.PI*30+y*57+Math.sin(a)*2-time*.27;
  const wave=Math.sin(a)*.5+Math.sin(b)*.3+Math.sin(c)*.2;
  const fold=a+Math.sin(b)*.65+Math.sin(c)*.18;
  const broad=Math.pow(clamp(.5+.5*Math.sin(fold)),8);
  const fine=Math.pow(clamp(.5+.5*Math.sin(fold*4+Math.sin(b))),24);
  return [.49+wave*.19,broad*.22+fine*.12*(.5+.5*Math.sin(b))];
}
export function paintSeaSurfaceCPU(field,time,target){
  for(let y=0;y<field.height;y++)for(let x=0;x<field.width;x++){
    const i=(y*field.width+x)*4,[shade,glint]=seaSwellLight((x+.5)/field.width,(y+.5)/field.height,time);
    for(let k=0;k<3;k++)target[i+k]=field.pixels[i+k]*shade+[178,225,225][k]*glint;
    target[i+3]=field.pixels[i+3];
  }
}
export const seaSwellGLSL=`
 vec2 swell(vec2 p,float t){
 float a=p.y*29.+sin(p.x*18.84955592+p.y*8.)*2.4-t*.21;
 float b=p.x*50.26548246-p.y*21.+sin(p.y*17.+p.x*6.28318531)*2.+t*.14;
 float c=p.x*94.24777961+p.y*57.+sin(a)*2.-t*.27;
 float wave=sin(a)*.5+sin(b)*.3+sin(c)*.2;
 float fold=a+sin(b)*.65+sin(c)*.18;
 float broad=pow(clamp(.5+.5*sin(fold),0.,1.),8.);
 float fine=pow(clamp(.5+.5*sin(fold*4.+sin(b)),0.,1.),24.);
 return vec2(.49+wave*.19,broad*.22+fine*.12*(.5+.5*sin(b)));
 }`;
