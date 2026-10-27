const ease=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
export const SEA_ARRIVAL_MS=950;
export const seaArrival=(elapsed,lon,reduced)=>reduced?1:ease((elapsed-((lon+180)/360)*260)/600);
export const seaSigned=value=>Number.isFinite(value)?`${value.toLocaleString('ja-JP',{maximumFractionDigits:1,signDisplay:'exceptZero'})} mm`:'欠測';
export const seaStem=value=>Number.isFinite(value)?Math.max(-20,Math.min(20,value/15)):0;

// Check neighbouring bins too: opposite sides of a bin edge are not separate
// screen locations. IDs, not annual values, decide which mark stays visible.
export function spacedSeaStations(candidates,selectedId,gap){
  const bins=new Map(),shown=[],ordered=[...candidates].sort((a,b)=>Number(b.r.id===selectedId)-Number(a.r.id===selectedId)||a.r.stationId-b.r.stationId);
  for(const p of ordered){
    const bx=Math.floor(p.x/gap),by=Math.floor(p.y/gap);let crowded=false;
    for(let y=by-1;y<=by+1&&!crowded;y++)for(let x=bx-1;x<=bx+1&&!crowded;x++)crowded=(bins.get(`${x}/${y}`)||[]).some(q=>Math.hypot(q.x-p.x,q.y-p.y)<gap);
    if(crowded)continue;const key=`${bx}/${by}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);shown.push(p);
  }
  return shown.sort((a,b)=>Number(a.r.id===selectedId)-Number(b.r.id===selectedId));
}

// A fixed geographic anchor keeps the annotation from jumping as years change.
export function seaCallout(x,y,width){
  const right=width-x-16,left=x-16,dir=right>=174||right>=left?1:-1;
  const available=Math.max(40,Math.min(170,(dir>0?right:left)-30));
  const tx=x+dir*30;
  return{tx,nameY:y-29,valueY:y-7,endX:tx+dir*available,dir,maxWidth:available,align:dir>0?'left':'right',left:dir>0?tx:tx-available,right:dir>0?tx+available:tx,top:y-44,bottom:y+2};
}
