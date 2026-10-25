import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const out=path.resolve('artifacts/atlas-century-20261022/final-checks.json');
const commands=[
  ['node',['--test',...['atlas-century','atlas-expansion','atlas-history','surface-water','climate-history','poi-year-crossfade'].map(n=>`scripts/check-${n}.test.mjs`)]],
  ...['atlas-century-model','atlas-century-view','atlas-data-webgl','atlas-history-model','atlas-history-view','climate-history-exhibits','climate-history-model'].map(n=>['node',['--check',`src/exploration/${n}.js`]]),
  ...['check-map-data-intro-catalog','check-map-exhibit-links','check-map-exhibits-10','check-contest-entry-budget','check-hardening-secrets','check-release-rights-gate'].map(n=>['node',[`scripts/${n}.mjs`]]),
  ...['build-map-page','build-third-party-inventory','build-media-rights-ledger'].map(n=>['node',[`scripts/${n}.mjs`,'--check']]),
  ['node',['scripts/check-release-rights.mjs','--validate']],
  ['git',['diff','--check']],
  ['npm.cmd',['run','check']],
];
const results=[];
for(const [bin,args]of commands){
  let result;const start=Date.now();
  const command=[bin,...args].join(' '),actual=bin==='npm.cmd'?['cmd.exe',['/d','/s','/c',command]]:[bin,args];
  try{result={command,exit:0,output:execFileSync(...actual,{encoding:'utf8',maxBuffer:12*1024*1024,windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']})};}
  catch(e){result={command,exit:e.status??1,output:String(e.stdout||'')+String(e.stderr||'')};}
  result.elapsedMs=Date.now()-start;results.push(result);console.log(`${result.exit===0?'PASS':'FAIL'} ${command}`);
}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',results},null,2));
process.exitCode=results.some(r=>r.exit!==0)?1:0;
