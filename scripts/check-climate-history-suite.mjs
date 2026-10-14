import {spawnSync,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const output=path.resolve('artifacts/climate-history-20261013');fs.mkdirSync(output,{recursive:true});
const commands=[['climate','--test','scripts/check-climate-history.test.mjs'],['intro','scripts/check-map-data-intro-catalog.mjs'],['routes','scripts/check-map-exhibit-links.mjs'],['themes','scripts/check-map-theme-background.mjs'],['budget','scripts/check-contest-entry-budget.mjs'],['source-ledger','scripts/build-media-rights-ledger.mjs','--check'],['third-party','scripts/build-third-party-inventory.mjs','--check'],['rights-gate','scripts/check-release-rights.mjs','--validate']];
const checks=[];
for(const [name,...args]of commands){const r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:32*1024*1024});fs.writeFileSync(path.join(output,`${name}.log`),r.stdout+r.stderr);checks.push({name,status:r.status===0?'passed':'failed',exitCode:r.status});console.log(`${name}: ${checks.at(-1).status}`);}
// Run the repository's full existing check as a separate result, retaining its
// original release-rights gate. No approval file is rewritten to make it pass.
const npmCli=process.env.npm_execpath || 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js';
const full=spawnSync(process.execPath,[npmCli,'run','check'],{encoding:'utf8',maxBuffer:32*1024*1024});fs.writeFileSync(path.join(output,'full-check.log'),full.stdout+full.stderr);checks.push({name:'npm run check',status:full.status===0?'passed':'failed',exitCode:full.status});console.log(`full-check: ${checks.at(-1).status}`);
const files=['app.js','climate-history-exhibits.css','src/exploration/climate-history-exhibits.js','src/exploration/climate-history-model.js','src/exploration/map-data-intro-catalog.js','map-exhibit-categories.js','map-exhibit-route.js','map-mobile-shell.js','statistics-lab.js','gaia-mode-loader.js','index.html','data/climate-history/cyclones.json','data/climate-history/coral.json'];
const browser=JSON.parse(fs.readFileSync(path.join(output,'browser-report.json'))),lifecycle=JSON.parse(fs.readFileSync(path.join(output,'lifecycle-report.json')));
const report={sha:execFileSync('git',['--no-optional-locks','rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:'SHA + uncommitted changes',date:new Date().toISOString(),
  request:'地図モードへの提案データの追加 / できたらスクショで見せて',scope:'Local exhibits 72 (NOAA IBTrACS) and 73 (NOAA Coral Reef Watch), shared map navigation/source/statistics/mobile integration.',
  data:{cycloneSeasons:45,cycloneTracks:4740,coralRegions:214,coralRegionYears:8537,initialYear:2016,initialBudgetBytes:2000000},
  checks,browser:{status:browser.status,cases:browser.checks.length,engine:browser.browser},lifecycle,
  fileHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),
  limitations:['Chrome mobile emulation, not a physical phone; external HTTPS blocked during browser QA.','Readiness/error/transition tests use real snapshots; latency and HTTP failures are injected tests.','Release rights scope changed; existing owner approval is not updated or asserted to cover this change.','No commit, push, deployment, or version bump.'],
  screenshots:['1440-72.png','1440-73.png','390-72.png','390-73.png','320-73-compact.png'].map(f=>path.join(output,f))};
fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({checks,browser:report.browser,lifecycle:lifecycle.status},null,2));
