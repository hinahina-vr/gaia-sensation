import {inflateRawSync} from 'node:zlib';

// Read only named text members in memory; never extract untrusted ZIP paths.
export function readZipMembers(zip) {
  let end=zip.length-22;const start=Math.max(0,zip.length-65557);
  while(end>=start&&zip.readUInt32LE(end)!==0x06054b50)end--;
  if(end<start)throw Error('Missing ZIP directory');
  const files=new Map();let offset=zip.readUInt32LE(end+16);
  for(let i=0;i<zip.readUInt16LE(end+10);i++){
    if(zip.readUInt32LE(offset)!==0x02014b50)throw Error('Invalid ZIP directory');
    const method=zip.readUInt16LE(offset+10),size=zip.readUInt32LE(offset+20),plainSize=zip.readUInt32LE(offset+24),n=zip.readUInt16LE(offset+28),extra=zip.readUInt16LE(offset+30),comment=zip.readUInt16LE(offset+32),local=zip.readUInt32LE(offset+42),name=zip.subarray(offset+46,offset+46+n).toString();
    offset+=46+n+extra+comment;
    if(!/(filelist\.txt|extracted_from_database|data\/\d+\.rlrdata)$/.test(name))continue;
    if(plainSize>2000000||zip.readUInt32LE(local)!==0x04034b50)throw Error('Invalid ZIP member');
    const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),raw=zip.subarray(start,start+size);
    const body=method===8?inflateRawSync(raw,{maxOutputLength:2000000}):method===0?raw:null;
    if(!body||body.length!==plainSize)throw Error('Unsupported ZIP member');
    files.set(name,body.toString('utf8'));
  }
  return files;
}
export function parseAnnual(text){
  return text.trim().split(/\r?\n/).filter(Boolean).map(line=>{
    const [year,value,incomplete,flag]=line.split(';').map(v=>v.trim());
    if(!/^\d{4}$/.test(year)||!Number.isInteger(+value)||!['N','Y'].includes(incomplete)||!/^\d{3}$/.test(flag))throw Error('Unexpected annual row');
    return {year:+year,raw:+value,incomplete,flag,usable:+value!==-99999&&incomplete==='N'&&flag==='000'};
  });
}
export function buildTideStations(files){
  const list=[...files].find(([n])=>n.endsWith('/filelist.txt'))?.[1];if(!list)throw Error('Missing station list');
  const regions=[];
  for(const line of list.trim().split(/\r?\n/)){
    const [id,lat,lon,name,coast,code,qc]=line.split(';').map(v=>v.trim());
    if(qc!=='N')continue;
    const body=[...files].find(([n])=>n.endsWith(`/data/${id}.rlrdata`))?.[1];if(body===undefined)throw Error(`Missing station ${id}`);
    if(!body.trim())continue;
    const records=parseAnnual(body),base=records.find(r=>r.year===1993);
    if(!base?.usable||!records.some(r=>r.year>=2010&&r.year<=2024&&r.usable))continue;
    const years=Array.from({length:32},(_,i)=>{
      const year=1993+i,r=records.find(r=>r.year===year);
      return {year,value:r?.usable?r.raw-base.raw:null,reason:!r||r.raw===-99999?'missing':r.flag!=='000'?'flagged':r.incomplete==='Y'?'incomplete':null};
    });
    regions.push({id:`tide-${id}`,stationId:+id,name,lat:+lat,lon:+lon,coastline:coast,stationCode:code,baseline1993:base.raw,years});
  }
  return regions.sort((a,b)=>a.stationId-b.stationId);
}
