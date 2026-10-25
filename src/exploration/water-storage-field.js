// The stored NASA delivery grid stays intact for picking, readouts and analysis.
// Only the colour field is softened, at a width comparable to the ~3° inference
// scale. Ocean and missing cells never become observations through this filter.
export const WATER_FIELD_SIGMA=2.4; // 0.5° delivery cells: sigma = 1.2°
export function smoothWaterField(values,width,height){
  const radius=Math.ceil(WATER_FIELD_SIGMA*3),weights=Array.from({length:radius*2+1},(_,i)=>Math.exp(-.5*((i-radius)/WATER_FIELD_SIGMA)**2));
  const horizontal=new Float64Array(values.length),coverage=new Float64Array(values.length),result=new Float32Array(values.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;
    for(let d=-radius;d<=radius;d++){
      const value=values[y*width+((x+d)%width+width)%width];if(!Number.isFinite(value)||value>80000)continue;
      const weight=weights[d+radius];horizontal[i]+=value*weight;coverage[i]+=weight;
    }
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,value=values[i];if(!Number.isFinite(value)||value>80000){result[i]=value;continue;}
    let sum=0,weight=0;
    for(let d=-radius;d<=radius;d++){
      const yy=y+d;if(yy<0||yy>=height)continue;const j=yy*width+x,k=weights[d+radius];
      sum+=horizontal[j]*k;weight+=coverage[j]*k;
    }
    result[i]=weight?sum/weight:value;
  }
  return result;
}
export function waterDisplayField(grid,year){
  const yi=grid.years.indexOf(year),values=new Float32Array(grid.width*grid.height);
  for(let i=0;i<values.length;i++){
    const id=grid.indices[i],v=id<0?null:grid.series[id][yi];
    values[i]=id<0?99999:v==null?88888:v*grid.scale;
  }
  return smoothWaterField(values,grid.width,grid.height);
}
