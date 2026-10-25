import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const out=path.resolve('artifacts/atlas-expansion-20261022/final-checks.json');
const commands=[
  ['node',['--test','scripts/check-atlas-expansion.test.mjs','scripts/check-atlas-history.test.mjs','scripts/check-surface-water.test.mjs','scripts/check-climate-history.test.mjs','scripts/check-poi-year-crossfade.test.mjs']],
  ...['atlas-data-webgl','atlas-expansion-model','atlas-history-model','atlas-history-view','climate-history-exhibits','climate-history-model'].map(n=>['node',['--check',`src/exploration/${n}.js`]]),
  ...['check-map-data-intro-catalog','check-map-exhibit-links','check-map-exhibits-10','check-contest-entry-budget','check-hardening-secrets','check-release-rights-gate'].map(n=>['node',[`scripts/${n}.mjs`]]),
  ...['build-map-page','build-third-party-inventory','build-media-rights-ledger'].map(n=>['node',[`scripts/${n}.mjs`,'--check']]),
  ['git',['diff','--check']],
  ['node',['scripts/check-release-rights.mjs','--validate']],
];
const results=[];
for(const [bin,args]of commands){
  let result;
  try{result={command:[bin,...args].join(' '),exit:0,output:execFileSync(bin,args,{encoding:'utf8',maxBuffer:8*1024*1024,windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']})};}
  catch(e){result={command:[bin,...args].join(' '),exit:e.status??1,output:String(e.stdout||'')+String(e.stderr||'')};}
  results.push(result);console.log(`${result.exit===0?'PASS':'FAIL'} ${result.command}`);
}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',results},null,2));
process.exitCode=results.some(r=>r.exit!==0)?1:0;
