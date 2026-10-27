import {createPoiYearCrossfade} from './poi-year-crossfade.js?v=20260926';
import {earthLongitudeToMapX} from './world-projection.js?v=gaia-japan-center-1';
import {LAKE_CLASSES,lakeClass,lakeRasterRect,lakeCellAt} from './surface-water-spatial.js?v=lake-gis-20261022';
import {createMapTextLayer} from './map-text-layer.js?v=country-text-halo-20261027';

// One georeferenced raster, not a second map or a floating enlarged image.
// The shared map camera owns panning, zooming and all pointer events.
export function createLakeView(parent, onChange=()=>{}) {
  const textLayer=createMapTextLayer('lake-detail');
  const figure=document.createElement('figure');figure.className='gaia-lake-view';figure.hidden=true;
  figure.innerHTML='<div class="gaia-lake-images"><canvas role="img"></canvas></div><p data-lake-image-status role="status"></p>';
  parent.append(figure);
  const canvas=figure.querySelector('canvas'),ctx=canvas.getContext('2d'),status=figure.querySelector('p');
  const texture=document.createElement('canvas'),tc=texture.getContext('2d'),fade=createPoiYearCrossfade();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),cache=new Map();
  let generation=0,cacheEpoch=0,current=null,reference=null,region=null,row=null,key='',visible=false,detail=false,compare=true;
  let view=null,renderKey='',sample=null,paintCount=0;
  const invalidate=()=>{renderKey='';onChange();};
  async function decode(record) {
    if(cache.has(record.image)){const entry=cache.get(record.image);cache.delete(record.image);cache.set(record.image,entry);return entry;}
    const epoch=cacheEpoch,image=new Image();image.src=new URL(`../../data/surface-water/${record.image}?v=20261022`,import.meta.url).href;
    await image.decode();
    const surface=document.createElement('canvas');surface.width=image.naturalWidth;surface.height=image.naturalHeight;
    const c=surface.getContext('2d'),width=surface.width,height=surface.height;c.drawImage(image,0,0);
    const pixels=c.getImageData(0,0,width,height),classes=new Uint8Array(width*height);
    for(let i=0;i<classes.length;i++){
      const kind=classes[i]=lakeClass(pixels.data[i*4]);
      // Only paint observed water. Missing coverage remains a distinct class
      // for picking, but must not tint the rectangular raster footprint.
      if(kind<2)pixels.data[i*4+3]=0;
    }
    c.putImageData(pixels,0,0);
    const entry={surface,classes,width,height};if(epoch===cacheEpoch)cache.set(record.image,entry);
    while(cache.size>8)cache.delete(cache.keys().next().value);
    return entry;
  }
  function referenceSurface(source) {
    const surface=document.createElement('canvas');surface.width=source.width;surface.height=source.height;
    const c=surface.getContext('2d'),pixels=c.createImageData(source.width,source.height),{classes,width,height}=source;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x;if(classes[i]<2)continue;
      const edge=!x||!y||x===width-1||y===height-1||classes[i-1]<2||classes[i+1]<2||classes[i-width]<2||classes[i+width]<2;
      pixels.data.set([237,195,130,edge?210:48],i*4);
    }
    c.putImageData(pixels,0,0);return surface;
  }
  function sampleAt(lon,lat) {
    if(!current||!region||key!==`${region.id}/${row.year}`)return null;
    const cell=lakeCellAt(region.bounds,current.width,current.height,lon,lat);if(!cell)return null;
    const refCell=reference&&lakeCellAt(region.bounds,reference.width,reference.height,lon,lat);
    return {lon,lat,year:row.year,label:LAKE_CLASSES[current.classes[cell.y*current.width+cell.x]],
      referenceLabel:refCell?LAKE_CLASSES[reference.classes[refCell.y*reference.width+refCell.x]]:null};
  }
  function pick(clientX,clientY) {
    if(!visible||!detail||!view||!region)return null;
    const rect=lakeRasterRect(region.bounds,view),x=clientX-view.rect.left,y=clientY-view.rect.top;
    if(x<rect.x||x>rect.x+rect.width||y<rect.y||y>rect.y+rect.height)return null;
    const [west,south,east,north]=region.bounds;
    return sampleAt(west+(x-rect.x)/rect.width*(east-west),north-(y-rect.y)/rect.height*(north-south));
  }
  async function show(nextRegion,nextRow) {
    const nextKey=`${nextRegion.id}/${nextRow.year}`;
    const ticket=++generation,changed=region?.id!==nextRegion.id;
    region=nextRegion;row=nextRow;
    if(changed){current=reference=sample=null;key='';fade.reset();delete figure.dataset.renderedYear;}
    status.textContent=`${row.year}年の水域を読込中…`;status.dataset.state='loading';
    figure.dataset.region=region.id;invalidate();
    try{
      const next=await decode(nextRow);if(ticket!==generation)return;
      if(current&&key!==nextKey&&texture.width===next.width&&texture.height===next.height)fade.capture(texture,nextKey);
      else if(!current||texture.width!==next.width||texture.height!==next.height){fade.reset();texture.width=next.width;texture.height=next.height;}
      current=next;key=nextKey;figure.dataset.renderedYear=String(row.year);
      status.textContent=row.coverage>0?'':`${row.year}年：この範囲の観測なし`;status.dataset.state='ready';
      canvas.setAttribute('aria-label',`${region.name}周辺、${row.year}年の水域。青は通年、緑は季節的。金色は2000年の水域。`);
      invalidate();
      if(!reference){
        const source=await decode(region.years.find(r=>r.year===2000));if(ticket!==generation)return;
        reference={...source,outline:referenceSurface(source)};invalidate();
      }
    }catch{
      if(ticket!==generation)return;
      if(!current||key!==nextKey){current=null;key='';fade.reset();delete figure.dataset.renderedYear;}
      status.textContent=current?'2000年の比較画像を読み込めませんでした。年を選び直すと再試行します。':'水域を読み込めませんでした。年を選び直すと再試行します。';status.dataset.state='error';invalidate();
    }
  }
  function paint(nextView,now) {
    view=nextView;if(!visible)return;
    const {rect,scale,x,y}=view,ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1800000/Math.max(1,rect.width*rect.height)));
    const signature=[key,reference?'ref':'',compare,detail,x,y,scale,rect.width,rect.height,ratio,sample?.lon,sample?.lat].join('/');
    if(signature===renderKey&&!fade.getState().active)return;
    renderKey=signature;
    const w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);
    if(!current)return;
    const r=lakeRasterRect(region.bounds,view);
    // Blend at raster resolution, then project once: no swimming during camera
    // motion, and no dark seam or bright double exposure during a year change.
    tc.clearRect(0,0,texture.width,texture.height);tc.drawImage(current.surface,0,0);
    fade.paint(tc,key,now,reduced.matches);figure.dataset.fade=fade.getState().active?'running':'complete';
    ctx.imageSmoothingEnabled=false;
    if(compare&&reference)ctx.drawImage(reference.outline,r.x,r.y,r.width,r.height);
    ctx.drawImage(texture,r.x,r.y,r.width,r.height);
    if(detail&&scale>30){textLayer.record(ctx,ctx=>{
      const [west,south,east,north]=region.bounds;
      ctx.save();ctx.fillStyle='#a9c5cf';ctx.lineWidth=.7;ctx.font='10px sans-serif';
      // Let the coordinate guides dissolve into the map, rather than framing
      // the source image as a separate rectangular panel.
      const vertical=ctx.createLinearGradient(0,r.y,0,r.y+r.height);
      const horizontal=ctx.createLinearGradient(r.x,0,r.x+r.width,0);
      for(const gradient of [vertical,horizontal]){
        gradient.addColorStop(0,'#aecbd300');gradient.addColorStop(.12,'#aecbd31a');
        gradient.addColorStop(.88,'#aecbd31a');gradient.addColorStop(1,'#aecbd300');
      }
      const step=scale>650?.1:.25;
      ctx.strokeStyle=vertical;
      for(let lon=Math.ceil(west/step)*step;lon<east;lon+=step){const px=x+earthLongitudeToMapX(lon)*scale;
        ctx.beginPath();ctx.moveTo(px,r.y);ctx.lineTo(px,r.y+r.height);ctx.stroke();}
      ctx.strokeStyle=horizontal;
      for(let lat=Math.ceil(south/step)*step;lat<north;lat+=step){const py=y+(90-lat)*scale;
        ctx.beginPath();ctx.moveTo(r.x,py);ctx.lineTo(r.x+r.width,py);ctx.stroke();}
      const legendBottom=rect.width<=900?(document.querySelector('.gaia-climate-legend')?.getBoundingClientRect().bottom||0)-rect.top:0;
      const labelX=Math.max(15,Math.min(rect.width-135,r.x)),labelY=Math.max(160,legendBottom+14,Math.min(rect.height-130,r.y-14));
      ctx.fillText(`${Math.abs(north).toFixed(2)}°${north<0?'S':'N'} / 北 ↑`,labelX,labelY);
      const kmPerPixel=111.32*Math.cos(region.lat*Math.PI/180)/scale;
      const km=[1,2,5,10,20,50,100].filter(n=>n/kmPerPixel<=100).at(-1)||1;
      const barY=Math.min(rect.height-125,r.y+r.height+22),length=km/kmPerPixel;
      if(barY>labelY+30){ctx.strokeStyle='#b8d2d9';ctx.beginPath();ctx.moveTo(labelX,barY-3);ctx.lineTo(labelX,barY);ctx.lineTo(labelX+length,barY);ctx.lineTo(labelX+length,barY-3);ctx.stroke();ctx.fillText(`約 ${km} km`,labelX,barY+15);}
      if(sample){const px=x+earthLongitudeToMapX(sample.lon)*scale,py=y+(90-sample.lat)*scale;
        ctx.strokeStyle='#fff1c7';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.moveTo(px-12,py);ctx.lineTo(px-9,py);ctx.moveTo(px+9,py);ctx.lineTo(px+12,py);ctx.stroke();}
      ctx.restore();
    },{host:canvas,width:rect.width,height:rect.height,view,ratio,key});textLayer.present();
    }else textLayer.reset();
    figure.dataset.paintCount=String(++paintCount);
  }
  function clear(){textLayer.reset();generation++;cacheEpoch++;current=reference=region=row=sample=view=null;key=renderKey='';fade.reset();cache.clear();texture.width=texture.height=canvas.width=canvas.height=1;visible=detail=false;figure.hidden=true;delete figure.dataset.renderedYear;delete figure.dataset.region;status.textContent='';}
  return {show,paint,clear,pick,
    setVisible(value){visible=Boolean(value);figure.hidden=!visible;if(!visible)fade.reset();},
    setDetail(value){detail=Boolean(value);invalidate();},
    setCompare(value){compare=Boolean(value);invalidate();},
    selectSample(value){sample=value?{lon:value.lon,lat:value.lat}:null;invalidate();},
    getState:()=>({region:region?.id,year:current?Number(figure.dataset.renderedYear):null,compare,referenceReady:!!reference,sample:sample?sampleAt(sample.lon,sample.lat):null,
      raster:region&&view?lakeRasterRect(region.bounds,view):null,cacheSize:cache.size,paintCount,textLayer:textLayer.getState()})};
}
