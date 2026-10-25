import {waterRgba} from './water-storage-grid.js?v=water-gis-20261022';

export const WATER_ARRIVAL_MS=950;
const ease=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
export const waterFieldArrival=(elapsed,reduced)=>reduced?1:ease(elapsed/650);

// Colour and labels come from the unchanged regional averages. Marker size is
// constant: these four averages must not look like water volumes or flow rates.
export function waterPoiState(value,elapsed,index,reduced){
  const valid=Number.isFinite(value),rgb=waterRgba(value).slice(0,3);
  const rounded=valid?Math.round(value*10)/10:0;
  const text=valid?`${rounded>0?'+':''}${Object.is(rounded,-0)?'0':rounded.toLocaleString('ja-JP',{maximumFractionDigits:1})} cm`:'欠測';
  const alpha=reduced?1:ease((elapsed-280-index*70)/400);
  return{valid,rgb,text,alpha,radius:6,scale:.78+.22*alpha};
}
