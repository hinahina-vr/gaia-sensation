import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const raw=path.resolve('artifacts/atlas-century-sources-20261022');
export const sources=[];
export async function source(name,url,json=true){
  await fs.mkdir(raw,{recursive:true});const file=path.join(raw,name);let body;
  try{body=await fs.readFile(file,'utf8');}catch{
    if(name.startsWith('web-'))throw Error(`Restore the retained official web-reader extraction before rebuilding: ${file}. ${url}`);
    for(let i=0;i<3;i++)try{const r=await fetch(url,{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error(`${r.status}: ${url}`);body=await r.text();if(json)JSON.parse(body);await fs.writeFile(file,body);break;}catch(e){if(i===2)throw e;}
  }
  sources.push({file:name,url,sha256:createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)});return json?JSON.parse(body):body;
}

export function heatRows(text){
  const lines=text.trim().split(/\r?\n/);if(!lines.shift().startsWith('YEAR'))throw Error('NOAA heat header changed');
  return lines.map(line=>{const v=line.trim().split(/\s+/).map(Number);if(v.length!==7||v.some(x=>!Number.isFinite(x))||v[0]%1!==.5)throw Error('NOAA heat row changed');return {year:Math.floor(v[0]),value:v[1],se:v[2]};});
}
export function ozoneRows(html){
  const table=html.match(/<table class="annual_table">([\s\S]*?)<\/table>/)?.[1];if(!table)throw Error('NASA annual table changed');
  return [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1].replace(/<[^>]*>/g,'').trim())).filter(v=>/^\d{4}$/.test(v[0])).map(v=>{
    if(v.length!==3||v.some(x=>!Number.isFinite(Number(x))))throw Error('NASA annual row changed');return {year:+v[0],value:+v[1],ozone:+v[2]};
  });
}
export function composition(agriculture,industry,domestic){
  const parts={agriculture,industry,domestic};
  const complete=Object.values(parts).every(Number.isFinite);
  const invalidComposition=complete&&(Object.values(parts).some(v=>v<0||v>100)||Math.abs(agriculture+industry+domestic-100)>1);
  return {...parts,value:complete&&!invalidComposition?agriculture:null,...(invalidComposition?{invalidComposition:true}:{})};
}
