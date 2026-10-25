import fs from 'node:fs';import {createHash} from 'node:crypto';
const source='artifacts/country-coverage-source-2026-09-06/waste-1.json';
const capture=JSON.parse(fs.readFileSync(source)),payload=JSON.parse(capture.text),snapshot=JSON.parse(fs.readFileSync('data/gaia-signals.json'));
const sites=snapshot.modes.find(m=>m.id==='blue-circulation').signals.climate;
const known=new Map(sites.map(p=>[String(p.m49).padStart(3,'0'),p]));const years=Array.from({length:12},(_,i)=>2010+i),countries=new Map();
for(const r of payload.data){const code=String(r.geoAreaCode).padStart(3,'0');if(!known.has(code)||r.series!=='EN_MWT_RCYR'||r.attributes?.Units!=='PERCENT')continue;const year=Number(r.timePeriodStart);if(!years.includes(year))continue;if(!countries.has(code))countries.set(code,new Map());const byYear=countries.get(code);if(byYear.has(year))throw new Error('Duplicate country-year '+code+' '+year);byYear.set(year,r);}
const panel=[];
for(const[code,byYear]of countries){if(!years.every(y=>byYear.has(y)))continue;const rs=years.map(y=>byYear.get(y));if(new Set(rs.map(r=>r.source)).size!==1||new Set(rs.map(r=>r.attributes.Nature)).size!==1)continue;if(rs.some(r=>!['A','E'].includes(r.attributes['Observation Status'])))continue;const values=rs.map(r=>Number(r.value));if(rs.some(r=>r.value===null||String(r.value).trim()==='')||values.some(v=>!Number.isFinite(v)||v<0||v>100))continue;const p=known.get(code);panel.push({id:p.iso3,name:p.countryJa,m49:code,source:rs[0].source,nature:rs[0].attributes.Nature,values});}
panel.sort((a,b)=>a.id.localeCompare(b.id));
const data={schemaVersion:1,title:'同じ国を継続して比較した都市ごみの再資源化率',sourceUrl:capture.url,sourceRetrievedAt:capture.retrievedAt,sourceSha256:createHash('sha256').update(capture.text).digest('hex'),series:'EN_MWT_RCYR',unit:'%',years,countries:panel,method:'2010–2021年の全ての年に有効値があり、国ごとに出典とNatureが一定の国を固定。系列切替Bと暫定Pを除外。国別比率の等重み平均で、ごみ量による世界平均ではない。'};
const body=JSON.stringify(data);if(process.argv.includes('--check')){if(fs.readFileSync('data/recycling-trends.json','utf8')!==body)throw new Error('Recycling trend asset stale');}else fs.writeFileSync('data/recycling-trends.json',body);
console.log(JSON.stringify({countries:panel.length,years:years.length,bytes:Buffer.byteLength(body)}));
