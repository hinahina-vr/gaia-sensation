// Public NASA DAT gridded averages, not an interpolation of the four box means.
// Raw responses are compressed under artifacts; only the compact grid ships.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const raw=path.join(root,'artifacts/water-storage-sources-20261022');
const output=path.join(root,'data/atlas-history/waterstore-grid.json');
await fs.mkdir(raw,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const years=Array.from({length:22},(_,i)=>2003+i), grids=[],sources=[];
const timeSourceBody=await fs.readFile(path.join(root,'artifacts/atlas-history-sources-20261022/grace-amazon.json'));
const timeSource=JSON.parse(timeSourceBody);
const timeCoverageSource=JSON.parse(await fs.readFile(path.join(root,'data/atlas-history/sources.json'),'utf8')).sources.find(s=>s.file==='grace-amazon.json');
if(timeCoverageSource.sha256!==sha(timeSourceBody))throw Error('Time coverage source hash mismatch');
const times=[...new Set(timeSource.data.flat().filter(r=>r.cnt>0).map(r=>r.time))];
const months=years.map(y=>new Set(times.map(t=>new Date(t*1000)).filter(d=>d.getUTCFullYear()===y).map(d=>d.getUTCMonth())).size);
for(const [yi,year] of years.entries()){
  const grid=new Array(720*360).fill(null),counts=new Set();let valid=0,totalBytes=0;
  for(let west=-180;west<180;west+=60){
  const params=new URLSearchParams({ds:'TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4_LAND',minLat:-90,maxLat:90,minLon:west,maxLon:west+60,startTime:Date.UTC(year,0,1)/1000,endTime:Date.UTC(year+1,0,1)/1000-1,mask:3});
  const url=`https://grace-onearth.jpl.nasa.gov/nexus/timeAvgMapSpark?${params}`,file=path.join(raw,`${year}-${west}.json.gz`);
  let body;
  try{body=gunzipSync(await fs.readFile(file));}catch(e){
    if(e.code!=='ENOENT')throw e;
    for(let attempt=0;attempt<3;attempt++){
      const response=await fetch(url,{signal:AbortSignal.timeout(180000)});
      if(!response.ok){if(attempt===2)throw Error(`${year}/${west}: HTTP ${response.status}`);continue;}
      body=Buffer.from(await response.arrayBuffer());JSON.parse(body);break;
    }
    await fs.writeFile(file,gzipSync(body));
  }
  const payload=JSON.parse(body);totalBytes+=body.length;
  for(const p of payload.data.flat()){
    if(!Number.isFinite(p.mean)||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.cnt<1)continue;
    const x=Math.round((p.lon+179.75)*2),y=Math.round((89.75-p.lat)*2);
    if(x<0||x>=720||y<0||y>=360||Math.abs(-179.75+x*.5-p.lon)>1e-6||Math.abs(89.75-y*.5-p.lat)>1e-6)throw Error('Grid alignment changed');
    counts.add(p.cnt);
    // Same coverage policy as the regional series. Record-mean weighting is
    // explicitly distinct from the regional mean-of-calendar-months weighting.
    if(months[yi]>=9&&p.cnt>=9){grid[y*720+x]=Math.round(p.mean*1000);valid++;}
  }
  sources.push({year,url,sha256:sha(body),bytes:body.length,observedMonths:months[yi],recordCounts:[...counts]});
  }
  grids.push(grid);
  console.log(year,valid,'cells',totalBytes,'source bytes');
}
const lookup=new Map(),series=[],indices=[];
for(let cell=0;cell<720*360;cell++){
  const values=grids.map(g=>g[cell]);
  if(values.every(v=>v===null)){indices.push(-1);continue;}
  const key=JSON.stringify(values);if(!lookup.has(key)){lookup.set(key,series.length);series.push(values);}
  indices.push(lookup.get(key));
}
const runs=[];for(const id of indices){const last=runs.at(-1);if(last?.[0]===id)last[1]++;else runs.push([id,1]);}
const result={schemaVersion:1,id:'waterstore-grid',retrievedAt:'2026-10-22',width:720,height:360,step:.5,bounds:[-180,-90,180,90],unit:'cm',scale:.001,years,months,series,runs,
  baseline:'2004–2009',effectiveResolution:'約3度の等面積mascon',timeCoverageSource,
  method:'NASA JPL DAT timeAvgMapSpark の0.5度陸域格子。各暦年に中心時刻を持つ観測解の算術平均。有効9暦月以上かつ9観測以上のセルを採用。cmを0.001cm単位に丸めて保存。独自の空間補間・欠測補間・gain factor適用なし。領域系列の暦月等重み平均とは集計法が異なる。',sources};
await fs.writeFile(output,JSON.stringify(result)+'\n');
console.log(JSON.stringify({series:series.length,runs:runs.length,bytes:(await fs.stat(output)).size,sha256:sha(await fs.readFile(output))}));
