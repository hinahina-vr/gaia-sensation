// Record exactly which local files the retained successful evidence concerns.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out='artifacts/map-history-20260912';
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=new Set([
 'package.json', '.gitignore', '.gitattributes', 'statistics-lab.js', 'statistics-discovery.js', 'marine-cod-exhibit.css', 'food-exhibits.css',
 'src/exploration/marine-cod-exhibit.js', 'src/exploration/marine-cod-catalog.js',
 'src/exploration/japan-sensor-open-catalog.js', 'src/exploration/japan-pollution-catalog.js', 'src/exploration/prtr-biology-catalog.js',
 'src/exploration/food-exhibits.js', 'src/exploration/food-catalog.js', 'src/exploration/food-drawing.js',
 'src/exploration/annual-statistics.js', 'src/exploration/annual-observation-store.js', 'src/exploration/annual-observation-years.js',
 'scripts/annual_snapshot.py', 'scripts/build-japan-history-data.py', 'scripts/build-food-history-data.py', 'scripts/build-annual-observation-index.py',
 'scripts/build-japan-marine-cod.py', 'scripts/build-japan-sensor-open-data.py', 'scripts/build-japan-pollution-data.py', 'scripts/build-prtr-biology-data.py',
 'scripts/fetch-japan-history.py', 'scripts/lib/annual-snapshot.mjs', 'scripts/check-map-history-version.mjs',
 'scripts/check-map-history-data.py', 'scripts/check-map-history-browser.mjs', 'scripts/check-map-history-analysis-browser.mjs',
 'scripts/check-map-history-edge-browser.mjs', 'scripts/check-fao-food-browser.mjs', 'scripts/check-annual-snapshot.py',
 'docs/QA_MAP_HISTORY_2026-09-12.md', 'data/sources/japan-history/README.md', 'data/fao-food-balances.json', 'data/fao-food-security.json',
]);
for(const name of fs.readdirSync('.').filter(n=>/\.(css|js|html)$/.test(n)))files.add(name);
let annualParts=0,annualBytes=0;
for(const name of fs.readdirSync('data').filter(n=>/^japan-.+\.json$/.test(n))){
 const data=JSON.parse(fs.readFileSync(`data/${name}`));if(data.schemaVersion!==2)continue;
 files.add(`data/${name}`);
 for(const part of [...data.periods,...data.historyShards]){
  const file=`data/${part.file}`;assert.equal(digest(file),part.sha256,file);files.add(file);annualParts++;annualBytes+=fs.statSync(file).size;
 }
}
for(const name of fs.readdirSync('data/sources/japan-history').filter(n=>/\.(json|csv)$/.test(n)))files.add(`data/sources/japan-history/${name}`);
const reports={};
for(const name of ['data-report.json','browser/report.json','browser/food-final.json','analysis/before.json','analysis/after.json','edge/report.json','food/report.json']){
 const file=path.join(out,name),report=JSON.parse(fs.readFileSync(file));assert.equal(report.status,'passed',name);
 if(name==='food/report.json')for(const [input,hash]of Object.entries(report.sha256))assert.equal(digest(input),hash,`Retest changed input: ${input}`);
 reports[name]={sha256:digest(file),modifiedAt:fs.statSync(file).mtime.toISOString(),checks:report.checks?.length};
}
const version={createdAt:new Date().toISOString(),scope:'Local uncommitted candidate; no production verification',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),annualParts,annualBytes,reports,
 sha256:Object.fromEntries([...files].sort().map(file=>[file,digest(file)]))};
fs.writeFileSync(path.join(out,'version.json'),JSON.stringify(version,null,2));
console.log(JSON.stringify({status:'passed',files:files.size,annualParts,annualBytes,reports:Object.keys(reports)}));
