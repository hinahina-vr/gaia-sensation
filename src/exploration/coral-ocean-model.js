// Display-only interpolation of the monitoring-point colours. No values or
// measurements are assigned to the open ocean; picking always uses real POIs.
export function coralOceanColour(points,lon,lat){
  let total=0,r=0,g=0,b=0,nearest=Infinity;
  const stretch=Math.max(.2,Math.cos(lat*Math.PI/180));
  for(const p of points){
    if(p.missing)continue;
    const dx=(((lon-p.lon+540)%360)-180)*stretch,dy=lat-p.lat,d2=dx*dx+dy*dy;
    const weight=1/((d2+12)*(d2+12));
    total+=weight;r+=p.rgb[0]*weight;g+=p.rgb[1]*weight;b+=p.rgb[2]*weight;
    nearest=Math.min(nearest,d2);
  }
  const influence=total?Math.exp(-nearest/900):0,deep=[.045,.22,.36];
  return [...deep.map((v,i)=>v+(total?[r,g,b][i]/total-v:0)*influence),.42];
}

export function buildCoralOceanTexture(points,width=256,height=128){
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const rgba=coralOceanColour(points,-30+(x+.5)*360/width,90-(y+.5)*180/height);
    for(let k=0;k<4;k++)pixels[(y*width+x)*4+k]=Math.round(rgba[k]*255);
  }
  return {pixels,width,height};
}

// A quiet, synthetic circulation pattern. These gyres provide the visual
// motion only; they are deliberately separate from NOAA's DHW observations.
const gyres=[[-165,29,35,20,1],[-115,-27,38,24,-1],[-42,28,27,21,1],[-22,-30,28,24,-1],[78,-27,32,23,-1],[65,12,22,12,1]];
export function coralOceanVelocity(lon,lat){
  let u=-.3*Math.exp(-lat*lat/120)+.22*Math.sin(lat*Math.PI/48),v=.06*Math.sin(lon*Math.PI/60);
  for(const [cx,cy,rx,ry,sign]of gyres){
    const x=(((lon-cx+540)%360)-180)/rx,y=(lat-cy)/ry,f=1.8*sign/((1+x*x+y*y)**2);
    u+=y*f;v-=x*f;
  }
  const length=Math.hypot(u,v)||1;
  return {u:u/length,v:v/length};
}

export function buildCoralOceanStreams(){
  const lines=[];
  // Fixed seeds: selecting a point or changing a year never randomises the sea.
  for(let row=0;row<13;row++)for(let col=0;col<30;col++){
    let lon=-30+(col+.5)*12+Math.sin(row*7+col*3)*3,lat=-74+row*12;
    const points=[],phase=((row*17+col*31)%47)/47;
    for(let i=0;i<76;i++){
      points.push({x:lon+30,y:90-lat,distance:i*.8,phase});
      const a=coralOceanVelocity(lon,lat),b=coralOceanVelocity(lon+a.u*.4,lat+a.v*.4);
      lon+=b.u*.8;lat+=b.v*.8;
      if(lat< -86||lat>86)break;
    }
    lines.push(points);
  }
  return lines;
}
