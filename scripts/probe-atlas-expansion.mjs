// Source discovery only: retain metadata and actual responses on E for provenance.
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('artifacts/atlas-expansion-sources-20261022');
await fs.mkdir(root,{recursive:true});
const candidates=[['longevity','SP.DYN.LE00.IN'],['childsurvival','SH.DYN.MORT']];
async function get(name,url){const p=path.join(root,name);try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{}for(let i=0;i<3;i++)try{const r=await fetch(url,{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error(r.status);const s=await r.text(),d=JSON.parse(s);await fs.writeFile(p,s);return d;}catch(e){if(i===2)throw e;}}
for(let i=0;i<candidates.length;i+=2)await Promise.all(candidates.slice(i,i+2).map(async([id,code])=>{
  const metadata=await get(`${id}-metadata.json`,`https://api.worldbank.org/v2/indicator/${code}?format=json`),data=await get(`${id}.json`,`https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&date=2000:2024&per_page=20000`);
  if(!Array.isArray(data[1])||data[0].pages!==1)throw Error(`${id}: unexpected data`);
  const valid=data[1].filter(r=>Number.isFinite(r.value));console.log(JSON.stringify({id,code,metadata:metadata[1]?.[0],countries:new Set(valid.map(r=>r.countryiso3code)).size,years:[...new Set(valid.map(r=>r.date))].sort(),min:Math.min(...valid.map(r=>r.value)),max:Math.max(...valid.map(r=>r.value)),samples:valid.filter(r=>['JPN','IND','USA'].includes(r.countryiso3code)&&r.date==='2016'),flags:[...new Set(valid.map(r=>r.obs_status))]},null,2));
}));
