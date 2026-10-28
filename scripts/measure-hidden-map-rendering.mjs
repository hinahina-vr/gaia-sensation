import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const label=process.env.GAIA_PERF_LABEL||'current',out=path.resolve('artifacts/performance-20261028',label);fs.mkdirSync(out,{recursive:true});
const report={label,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),conditions:'Installed Chrome headless, 1440x900 DPR1, local HTTP, external requests blocked; LOD pinned high after entry for identical rendering budgets. CDP CPU task duration and JS draw-call counts, not GPU completion or physical-device FPS.',rows:[],errors:[]};
report.sourceHashes=Object.fromEntries(['app.js','src/exploration/climate-history-exhibits.js'].map(file=>{const old=process.env.GAIA_PREVIEW_BASELINE&&path.resolve(process.env.GAIA_PREVIEW_BASELINE,file);return[file,createHash('sha256').update(fs.readFileSync(old&&fs.existsSync(old)?old:file)).digest('hex')]}));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
 report.browser=browser.version();const system=await browser.newBrowserCDPSession();report.gpu=(await system.send('SystemInfo.getInfo')).gpu.devices;await system.detach();
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'no-preference'});await context.route('https://**',r=>r.abort());
 await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__draws={};for(const Type of [WebGLRenderingContext,WebGL2RenderingContext]){const original=Type.prototype.drawArrays;Type.prototype.drawArrays=function(...args){const key=this.canvas.id||Object.keys(this.canvas.dataset).join(',')||'offscreen';__draws[key]=(__draws[key]||0)+1;return original.apply(this,args)}}});
 const page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 await page.goto(process.env.GAIA_BASE_URL+'/world.html#world-80',{waitUntil:'domcontentloaded'});
 for(const mode of (process.env.GAIA_PERF_MODES||"80,92,100").split(",").map(Number)){
  await page.evaluate(n=>location.hash='#world-'+n,mode);
  await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',mode);
  await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaClimateHistory.setPlayback(false);GaiaFrameBudgetGovernor.stop();GaiaFrameBudgetGovernor.setLevel("high")});await page.waitForTimeout(700);
  const state=await page.evaluate(()=>({opacity:getComputedStyle(document.querySelector('#gaia-canvas')).opacity,render:GaiaClimateHistory.getRenderState(),state:GaiaClimateHistory.getState()}));assert.equal(state.opacity,'0');
  for(let sample=0;sample<Number(process.env.GAIA_PERF_SAMPLES||3);sample++){
   const start=await page.evaluate(()=>{__draws={};window.__mutations={};window.__mo=new MutationObserver(records=>{for(const r of records){const key=(r.target.id||r.target.className)+' / '+r.attributeName;__mutations[key]=(__mutations[key]||0)+1}});__mo.observe(document.body,{attributes:true,subtree:true});return performance.now()});const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));await page.waitForTimeout(3000);const after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));const measured=await page.evaluate(start=>(__mo.disconnect(),{elapsed:performance.now()-start,draws:__draws,mutations:Object.entries(__mutations).sort((a,b)=>b[1]-a[1]).slice(0,20),render:GaiaClimateHistory.getRenderState()}),start);
   if(!process.env.GAIA_PREVIEW_BASELINE)assert.equal(measured.draws['gaia-canvas']||0,0,'Hidden renderer submitted a draw');
   const metrics=Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,after[k]-before[k]]));report.rows.push({mode,sample,...measured,metrics});console.log(JSON.stringify({label,mode,sample,elapsed:measured.elapsed,draws:measured.draws,metrics}));
  }
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await page.waitForTimeout(1200);const profile=(await cdp.send('Profiler.stop')).profile;await cdp.send('Profiler.disable');fs.writeFileSync(path.join(out,mode+'.cpuprofile'),JSON.stringify(profile));
  report.rows.at(-1).hotspots=profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,12).map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,hits:n.hitCount}));await page.screenshot({path:path.join(out,mode+'.png')});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;throw e}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}
