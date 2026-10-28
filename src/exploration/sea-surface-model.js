import {tideRgb} from './sea-level-stations.js?v=release100-c363-20261027';

// Display interpolation only: nearshore colours follow the coastal POIs,
// while distant open water retains the published satellite basin means.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const longitudeDelta=(a,b)=>((a-b+540)%360)-180;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export const seaSurfaceColor=value=>Number.isFinite(value)?tideRgb(value):null;
export function seaSurfaceWeights(lon,lat){
  const centers=[[-160,0],[-50,5],[80,-15]];
  const weights=centers.map(([x,y])=>Math.exp(5*(Math.cos((lon-x)*Math.PI/180)-1)-((lat-y)/100)**2));
  const sum=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/sum);
}

const NEIGHBOURS=8,RADIUS=22,TILE=15;
// Smooth display values before colour mapping, rather than blurring coastlines
// or moving POIs. Longitude wraps; missing pixels stay transparent.
function smoothSurface(values,width,height){
  const kernel=[1,4,6,4,1],horizontal=new Float32Array(values.length).fill(NaN),result=horizontal.slice();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const cell=y*width+x;if(!Number.isFinite(values[cell]))continue;let sum=0,weight=0;
    for(let d=-2;d<=2;d++){const v=values[y*width+(x+d+width)%width];if(Number.isFinite(v)){sum+=v*kernel[d+2];weight+=kernel[d+2];}}
    horizontal[cell]=sum/weight;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const cell=y*width+x;if(!Number.isFinite(values[cell]))continue;let sum=0,weight=0;
    for(let d=-2;d<=2;d++){const v=horizontal[Math.max(0,Math.min(height-1,y+d))*width+x];if(Number.isFinite(v)){sum+=v*kernel[d+2];weight+=kernel[d+2];}}
    result[cell]=sum/weight;
  }
  return result;
}
export function buildSeaCoastStencil(stations,width=360,height=180){
  const indices=new Int16Array(width*height*NEIGHBOURS).fill(-1),weights=new Float32Array(indices.length),influence=new Float32Array(width*height),basinWeights=new Float32Array(width*height*3);
  const buckets=Array.from({length:24*12},()=>[]);
  // Conservative geographic tiles bound the candidate work. This plan is
  // built once per station geometry, never in the animation or year loop.
  for(let ty=0;ty<12;ty++)for(let tx=0;tx<24;tx++){
    const lon=-30+(tx+.5)*TILE,lat=90-(ty+.5)*TILE,cos=Math.max(.13,Math.cos(Math.min(89,Math.abs(lat)+TILE/2)*Math.PI/180));
    const bucket=buckets[ty*24+tx];
    stations.forEach((p,i)=>{
      if(!Number.isFinite(p.lon)||!Number.isFinite(p.lat))return;
      const dx=Math.max(0,Math.abs(longitudeDelta(lon,p.lon))-TILE/2)*cos,dy=Math.max(0,Math.abs(lat-p.lat)-TILE/2);
      if(dx*dx+dy*dy<=RADIUS*RADIUS)bucket.push(i);
    });
  }
  const distances=new Float64Array(NEIGHBOURS);
  for(let y=0;y<height;y++){
    const lat=90-(y+.5)/height*180,cos=Math.max(.13,Math.cos(lat*Math.PI/180)),ty=Math.min(11,Math.floor(y/height*12));
    for(let x=0;x<width;x++){
      const lon=-30+(x+.5)/width*360,cell=y*width+x,offset=cell*NEIGHBOURS,tx=Math.min(23,Math.floor(x/width*24));distances.fill(Infinity);
      for(const index of buckets[ty*24+tx]){
        const p=stations[index],dx=longitudeDelta(lon,p.lon)*cos,dy=lat-p.lat,d=dx*dx+dy*dy;
        if(d>RADIUS*RADIUS||d>=distances[NEIGHBOURS-1])continue;
        let k=NEIGHBOURS-1;while(k>0&&d<distances[k-1]){distances[k]=distances[k-1];indices[offset+k]=indices[offset+k-1];k--;}
        distances[k]=d;indices[offset+k]=index;
      }
      basinWeights.set(seaSurfaceWeights(lon,lat),cell*3);
      influence[cell]=1-smooth(3,RADIUS,Math.sqrt(distances[0]));
      for(let k=0;k<NEIGHBOURS;k++)if(indices[offset+k]>=0)weights[offset+k]=1/(.04+distances[k])**2;
    }
  }
  return {width,height,indices,weights,influence,basinWeights,stationCount:stations.length,neighbours:NEIGHBOURS};
}

export function buildSeaSurfaceTexture(basins,year,width=360,height=180,stations=[],stencil=null){
  const values=['pac','atl','ind'].map(id=>basins.find(r=>r.id===id)?.years.find(r=>r.year===year)?.value);
  const coastalValues=stations.map(r=>r.years.find(row=>row.year===year)?.value);
  const pixels=new Uint8ClampedArray(width*height*4),surfaceValues=new Float32Array(width*height).fill(NaN);
  if(stations.length&&!stencil)stencil=buildSeaCoastStencil(stations,width,height);
  if(stencil&&(stencil.width!==width||stencil.height!==height||stencil.stationCount!==stations.length))throw Error('Sea surface stencil does not match station geometry');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const cell=y*width+x,weights=stencil?null:seaSurfaceWeights(-30+(x+.5)/width*360,90-(y+.5)/height*180);
    let total=0,value=0;for(let i=0;i<3;i++){const w=stencil?stencil.basinWeights[cell*3+i]:weights[i];if(Number.isFinite(values[i])){total+=w;value+=values[i]*w;}}
    const basinValue=total>.001?value/total:null;
    let coastalWeight=0,coastalSum=0;
    if(stencil)for(let k=0;k<NEIGHBOURS;k++){
      const i=cell*NEIGHBOURS+k,index=stencil.indices[i],v=coastalValues[index];
      if(index>=0&&Number.isFinite(v)){coastalWeight+=stencil.weights[i];coastalSum+=v*stencil.weights[i];}
    }
    const hasCoast=coastalWeight>0,blend=hasCoast?stencil.influence[cell]:0;
    if(!Number.isFinite(basinValue)&&(!hasCoast||blend<=0))continue;
    const displayed=hasCoast?(Number.isFinite(basinValue)?basinValue*(1-blend)+(coastalSum/coastalWeight)*blend:coastalSum/coastalWeight):basinValue;
    surfaceValues[cell]=displayed;pixels[cell*4+3]=Number.isFinite(basinValue)?255:Math.round(blend*255);
  }
  surfaceValues.set(smoothSurface(surfaceValues,width,height));
  for(let i=0;i<surfaceValues.length;i++)if(pixels[i*4+3])pixels.set(seaSurfaceColor(surfaceValues[i]),i*4);
  return {width,height,pixels,values,surfaceValues,coastalSamples:coastalValues.filter(Number.isFinite).length};
}

// World-anchored lighting, without source-value or position jitter.
export function seaSwellLight(x,y,time){
  const a=y*29+Math.sin(x*Math.PI*6+y*8)*2.4-time*.21;
  const b=x*Math.PI*16-y*21+Math.sin(y*17+x*Math.PI*2)*2+time*.14;
  const c=x*Math.PI*30+y*57+Math.sin(a)*2-time*.27;
  const wave=Math.sin(a)*.5+Math.sin(b)*.3+Math.sin(c)*.2;
  const fold=a+Math.sin(b)*.65+Math.sin(c)*.18;
  const broad=Math.pow(clamp(.5+.5*Math.sin(fold)),8);
  const fine=Math.pow(clamp(.5+.5*Math.sin(fold*4+Math.sin(b))),24);
  return [.80+wave*.16,broad*.20+fine*.12*(.5+.5*Math.sin(b))];
}
export function paintSeaSurfaceCPU(field,time,target){
  for(let y=0;y<field.height;y++)for(let x=0;x<field.width;x++){
    const i=(y*field.width+x)*4,[shade,glint]=seaSwellLight((x+.5)/field.width,(y+.5)/field.height,time);
    for(let k=0;k<3;k++)target[i+k]=field.pixels[i+k]*shade+[178,225,225][k]*glint;
    target[i+3]=field.pixels[i+3];
  }
}
export const seaSwellGLSL=[
 'vec2 swell(vec2 p,float t){',
 'float a=p.y*29.+sin(p.x*18.84955592+p.y*8.)*2.4-t*.21;',
 'float b=p.x*50.26548246-p.y*21.+sin(p.y*17.+p.x*6.28318531)*2.+t*.14;',
 'float c=p.x*94.24777961+p.y*57.+sin(a)*2.-t*.27;',
 'float wave=sin(a)*.5+sin(b)*.3+sin(c)*.2;',
 'float fold=a+sin(b)*.65+sin(c)*.18;',
 'float broad=pow(clamp(.5+.5*sin(fold),0.,1.),8.);',
 'float fine=pow(clamp(.5+.5*sin(fold*4.+sin(b)),0.,1.),24.);',
 'return vec2(.80+wave*.16,broad*.20+fine*.12*(.5+.5*sin(b)));',
 '}'
].join('\n');
