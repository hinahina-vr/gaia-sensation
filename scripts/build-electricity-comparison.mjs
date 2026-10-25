// Reuse the exact WDI snapshot behind exhibit 77; never average country rates.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const raw='artifacts/atlas-history-sources-20261022/';
const manifest=JSON.parse(await fs.readFile('data/atlas-history/sources.json','utf8'));
async function verified(name){
  const body=await fs.readFile(raw+name),source=manifest.sources.find(s=>s.file===name);
  if(createHash('sha256').update(body).digest('hex')!==source.sha256)throw Error(`Changed source: ${name}`);
  return {source,payload:JSON.parse(body)};
}
const countries=await verified('countries.json'),rates=await verified('electricity.json');
const names={WLD:'世界',EAS:'東アジア・太平洋',ECS:'ヨーロッパ・中央アジア',LCN:'ラテンアメリカ・カリブ海',MEA:'中東・北アフリカ・アフガニスタン・パキスタン',NAC:'北米',SAS:'南アジア',SSF:'サブサハラ・アフリカ'};
const rows=new Map(rates.payload[1].map(r=>[`${r.countryiso3code}/${r.date}`,r.value]));
const countryRegions=Object.fromEntries(countries.payload[1].filter(c=>c.region.id!=='NA').map(c=>[c.id,c.region.id]));
if(Object.values(countryRegions).some(id=>!names[id]))throw Error('Unknown WDI region');
const result={schemaVersion:1,id:'electricity-comparison',period:[2000,2024],sourceUpdated:rates.payload[0].lastupdated,retrievedAt:manifest.retrievedAt,
  indicator:'EG.ELC.ACCS.ZS',countryRegions,regions:Object.entries(names).map(([id,name])=>({id,name,years:Array.from({length:25},(_,i)=>{
    const year=2000+i,value=rows.get(`${id}/${year}`);return {year,value:Number.isFinite(value)?Math.round(value*10000)/10000:null};
  })})),sources:[countries.source,rates.source],license:'World Bank / SDG 7.1.1 · CC BY 4.0',
  method:'同じWDI保存版の世界・地域集計を使用。国の単純平均は使わない。2000年からの変化は各国の同系列の差（ポイント）。両年の値が揃う場合だけ計算。地域分類は取得時点の世界銀行分類。'};
await fs.writeFile('data/atlas-history/electricity-comparison.json',JSON.stringify(result)+'\n');
console.log(`${result.regions.length} official aggregates, ${Object.keys(countryRegions).length} country memberships`);
