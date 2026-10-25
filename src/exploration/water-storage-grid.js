// The distribution is a real 0.5° delivery grid. Neighbouring cells are not
// independent observations: the GRACE inference scale is about 3°.
export function decodeWaterGrid(payload) {
  if(payload.schemaVersion!==1||payload.width!==720||payload.height!==360||payload.step!==.5||payload.scale!==.001||payload.years?.length!==22||!payload.series?.length)throw Error('Invalid GRACE grid');
  const indices=new Int16Array(payload.width*payload.height);let offset=0;
  for(const [id,length] of payload.runs){
    if(!Number.isInteger(id)||id< -1||id>=payload.series.length||!Number.isInteger(length)||length<1||offset+length>indices.length)throw Error('Invalid GRACE run');
    indices.fill(id,offset,offset+length);offset+=length;
  }
  if(offset!==indices.length||payload.series.some(s=>s.length!==22||s.some(v=>v!==null&&!Number.isInteger(v))))throw Error('Incomplete GRACE grid');
  return {...payload,indices};
}
export function waterCell(grid,lon,lat) {
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat< -90||lat>90)return null;
  const longitude=((lon+180)%360+360)%360-180;
  const x=Math.min(719,Math.floor((longitude+180)*2)),y=Math.min(359,Math.floor((90-lat)*2));
  const series=grid.indices[y*720+x];if(series<0)return null;
  return {id:`cell-${x}-${y}`,x,y,series,lon:-179.75+x*.5,lat:89.75-y*.5};
}
export function waterCellById(grid,id) {
  const match=/^cell-(\d+)-(\d+)$/.exec(id);if(!match)return null;
  const x=+match[1],y=+match[2];if(x>=720||y>=360)return null;
  return waterCell(grid,-179.75+x*.5,89.75-y*.5);
}
export const waterCoordinates = cell => `${Math.abs(cell.lat).toFixed(2)}°${cell.lat<0?'S':'N'} · ${Math.abs(cell.lon).toFixed(2)}°${cell.lon<0?'W':'E'}`;
export function waterCellRegion(grid,cell) {
  return {...cell,name:`選択した陸域 ${waterCoordinates(cell)}`,years:grid.years.map((year,i)=>({year,value:grid.series[cell.series][i]===null?null:grid.series[cell.series][i]*grid.scale,months:grid.months[i]}))};
}
export function waterCellStatistics(definition,grid,cell) {
  const region=waterCellRegion(grid,cell),id=`climate-waterstore-${cell.id}`;
  const rows=region.years.filter(r=>Number.isFinite(r.value)).map(r=>({id:`${id}-${r.year}`,label:String(r.year),period:String(r.year),year:r.year,x:r.year,y:r.value,value:r.value,provenance:'DERIVED'}));
  return {id,modeId:'waterstore',title:region.name,rows,unit:'cm',xKind:'year',xLabel:'年',yLabel:'陸水量偏差',valueLabel:'陸水量偏差',defaultMethod:'discovery',periodStart:2003,periodEnd:2024,periodLabel:'2003–2024',missingCount:22-rows.length,derivedFromSourceOnly:true,provenance:['DERIVED'],insightContext:{domain:'climate',axis:'time-series',measurementKind:'DERIVED'},sourceName:definition.organisation,sourceUrl:definition.source,comparisonNote:`${grid.method} 基準は2004–2009年。配布0.5度・推定約3度。${waterCoordinates(cell)}`};
}
export function waterRgba(value) {
  if(!Number.isFinite(value))return [83,101,109,70];
  const t=Math.min(1,Math.abs(value)/30),a=[39,67,76],b=value<0?[217,157,100]:[111,225,213];
  return [...a.map((v,i)=>Math.round(v+(b[i]-v)*t)),Math.round(55+150*t)];
}
