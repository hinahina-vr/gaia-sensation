import {SELECTABLE_COUNTRIES} from './country-selection-catalog.js?v=release100-c363-20261027';

const identities=new Map(SELECTABLE_COUNTRIES.map(country=>[country.iso3,country.id]));
const expanded=new WeakMap();
export const selectionCountryId=geometryId=>identities.get(geometryId)||geometryId;

// Selection availability follows map geometry, independently of whether the
// measurement has observations. Placeholder rows remain null, never zero.
export function selectableCountryData(data){
 if(!data)return data;
 if(!expanded.has(data)){
  const existing=new Set(data.regions.map(region=>region.id));
  const [start,end]=data.period;
  const missing=SELECTABLE_COUNTRIES.filter(country=>!existing.has(country.id)).map(country=>({
   ...country,missingSource:true,
   years:Array.from({length:end-start+1},(_,i)=>({year:start+i,value:null}))
  }));
  expanded.set(data,{...data,regions:[...data.regions,...missing]});
 }
 return expanded.get(data);
}

export {SELECTABLE_COUNTRIES};
