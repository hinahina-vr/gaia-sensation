import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4484';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/performance-2026-09-09');
fs.mkdirSync(output, {recursive:true});
const profiles = [
  {name:'pc',width:1440,height:900,dpr:1,cpu:1,mobile:false},
  {name:'mobile',width:390,height:844,dpr:2,cpu:4,mobile:true,cores:4,memory:4,network:{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'}},
].filter(p=>!process.env.PERF_PROFILE || p.name===process.env.PERF_PROFILE);
if(process.env.PERF_NO_NETWORK==='true') for(const p of profiles)delete p.network;
const samples = Number(process.env.PERF_SAMPLES || 3);
const report = {startedAt:new Date().toISOString(),base,profiles,samples,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  conditions:`Local ${process.env.PERF_TRANSPORT || 'uncompressed'} HTTP/1.1 no-store preview, cold browser cache. Mobile is CPU x4; actualNetwork records throttling or its absence; DPR2, 4 cores/4 GB capability hint, desktop GPU. External URLs blocked via CDP; bundled source data used, no mocked responses. Not production, physical phone or field INP. rAF cadence is not presented/composited FPS. Blocked-time sums use explicit observation windows, not Lighthouse TBT.`,
  actualNetwork:profiles.map(p=>({profile:p.name,settings:p.network||'unthrottled'})),
  sha256:Object.fromEntries(['index.html','gaia-mode-loader.js','opening.js','opening.css','app.js','src/exploration/marine-cod-exhibit.js','marine-cod-exhibit.css','src/exploration/index.js','statistics-lab.js','map-legend-drag.js','src/data/snapshot-store.js','src/exploration/estat-exhibits.js','src/exploration/firms-exhibit.js','src/exploration/map-demo.js','src/exploration/map-demo-controller.js','scripts/serve-novel-preview.mjs'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),home:[],map:[],errors:[]};
const persist = () => fs.writeFileSync(path.join(output,`device-report${process.env.PERF_PROFILE ? '-'+process.env.PERF_PROFILE : ''}.json`),JSON.stringify(report,null,2));
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-precise-memory-info']});
report.browser = browser.version();
const system = await browser.newBrowserCDPSession();
report.gpu = (await system.send('SystemInfo.getInfo')).gpu;
await system.detach();

async function create(profile,kind) {
  const context = await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr,isMobile:profile.mobile,hasTouch:profile.mobile,locale:'ja-JP',reducedMotion:'no-preference',serviceWorkers:'block'});
  await context.addInitScript(({profile,kind})=>{
    if(profile.mobile) {
      Object.defineProperty(Navigator.prototype,'hardwareConcurrency',{configurable:true,get:()=>profile.cores});
      Object.defineProperty(Navigator.prototype,'deviceMemory',{configurable:true,get:()=>profile.memory});
    }
    if(kind!=='home') {sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');}
    const p=window.__perf={longtasks:[],events:[],shifts:[],lcp:null,errors:[],frames:[],recordFrames:false};
    const observe=(type,fn,opts={})=>{try {new PerformanceObserver(list=>list.getEntries().forEach(fn)).observe({type,buffered:true,...opts});}catch(e){p.errors.push(e.message);}};
    observe('longtask',e=>p.longtasks.push({start:e.startTime,duration:e.duration}));
    observe('event',e=>p.events.push({name:e.name,start:e.startTime,duration:e.duration,processing:e.processingEnd-e.processingStart,id:e.interactionId}),{durationThreshold:16});
    observe('layout-shift',e=>{if(!e.hadRecentInput)p.shifts.push({start:e.startTime,value:e.value});});
    observe('largest-contentful-paint',e=>p.lcp={ms:e.startTime,element:e.element?.id||e.element?.className||e.element?.nodeName,url:e.url});
    let previous=0;function frame(t){if(p.recordFrames&&previous)p.frames.push(t-previous);previous=p.recordFrames?t:0;requestAnimationFrame(frame);}requestAnimationFrame(frame);
    performance.setResourceTimingBufferSize(3000);
  },{profile,kind});
  const page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
  const cdp=await context.newCDPSession(page);
  const failures=[];
  page.on('pageerror',e=>report.errors.push({profile:profile.name,kind,message:e.message}));
  page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.setBlockedURLs',{urls:['https://*']});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
  if(profile.network)await cdp.send('Network.emulateNetworkConditions',profile.network);
  await cdp.send('Performance.enable');
  return {context,page,cdp,failures};
}
async function snapshot(page) {
  return page.evaluate(()=>{
    const p=window.__perf;let best=0,sum=0,start=0,last=0;
    for(const s of p.shifts){if(!start||s.start-last>1000||s.start-start>5000){start=s.start;sum=0;}sum+=s.value;last=s.start;best=Math.max(best,sum);}
    const nav=performance.getEntriesByType('navigation')[0]?.toJSON();
    const resources=performance.getEntriesByType('resource').map(e=>({url:e.name,type:e.initiatorType,start:e.startTime,duration:e.duration,transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize}));
    const end=performance.now();
    return {atMs:end,lcp:p.lcp,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,cls:best,longtasks:p.longtasks,events:p.events,blockedTimeObservedMs:p.longtasks.reduce((s,t)=>s+Math.max(0,t.duration-50),0),
      navigation:nav,resourceCount:resources.length+1,bodyBytes:resources.reduce((s,r)=>s+r.encoded,nav?.encodedBodySize||0),resources:resources.sort((a,b)=>b.encoded-a.encoded),
      elements:document.querySelectorAll('*').length,lod:document.documentElement.dataset.gaiaLod,heapUsed:performance.memory?.usedJSHeapSize,observerErrors:p.errors};
  });
}
async function windowMeasure(page,cdp,ms=5000) {
  await page.evaluate(()=>{__perf.frames=[];__perf.recordFrames=true;__perf.windowStart=performance.now();__perf.canvasStart=Number(document.querySelector('#gaia-marine-cod-canvas')?.dataset.codFrame||0);});
  const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  await page.waitForTimeout(ms);
  const after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  const observed=await page.evaluate(()=>{const p=__perf;p.recordFrames=false;const frames=p.frames.slice().sort((a,b)=>a-b),elapsed=performance.now()-p.windowStart;return {elapsedMs:elapsed,frames:frames.length,rafHz:frames.length?1000/(frames.reduce((s,v)=>s+v,0)/frames.length):0,p95FrameMs:frames[Math.floor(frames.length*.95)]||0,maxFrameMs:frames.at(-1)||0,longtasks:p.longtasks.filter(t=>t.start>=p.windowStart),lod:document.documentElement.dataset.gaiaLod,annualDrawHz:(Number(document.querySelector('#gaia-marine-cod-canvas')?.dataset.codFrame||0)-p.canvasStart)/elapsed*1000};});
  const deltas=Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,after[k]-before[k]]));
  return {...observed,deltas,mainThreadBusyPct:deltas.TaskDuration*1000/observed.elapsedMs*100,heapUsed:after.JSHeapUsedSize};
}
async function interaction(page,label,action,ready) {
  const start=await page.evaluate(()=>performance.now());const wall=performance.now();
  await action();if(ready)await ready();await page.waitForTimeout(300);
  const data=await page.evaluate(start=>{const events=__perf.events.filter(e=>e.start>=start&&e.id);return {events,maxObservedEventMs:events.length?Math.max(...events.map(e=>e.duration)):null};},start);
  return {label,wallToReadyPlus300Ms:performance.now()-wall,...data};
}
try {
 profileLoop: for(const profile of profiles) {
  for(let run=1;run<=(process.env.PERF_ONLY_MAP==='true'?0:samples);run++) {
   const {context,page,cdp}=await create(profile,'home');
   await page.goto(base+'/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#gaia-boot')?.hidden&&document.querySelector('#gaia-opening-sound-off')?.checkVisibility({visibilityProperty:true}));
   const readyMs=await page.evaluate(()=>performance.now());await page.waitForTimeout(1000);
   const row={profile:profile.name,run,soundChoiceReadyMs:readyMs,...await snapshot(page)};
   if(run===1) {
    row.soundOff=await interaction(page,'start without sound',()=>page.locator('#gaia-opening-sound-off').click());
    row.openingMotion=await windowMeasure(page,cdp);
    await page.screenshot({path:path.join(output,`${profile.name}-opening.png`)});
   }
   report.home.push(row);persist();console.log(JSON.stringify({phase:'home',profile:profile.name,run,readyMs,lcp:row.lcp,bodyBytes:row.bodyBytes}));await context.close();
  }
  {
   const {context,page,cdp,failures}=await create(profile,'map');
   const row={profile:profile.name,runtime:[],interactions:[]};report.map.push(row);
   await page.goto(base+'/?exhibit=31#world',{waitUntil:'domcontentloaded'});
   if(process.env.PERF_STOP_DEMO_EARLY==='true') {await page.waitForFunction(()=>globalThis.GaiaMapDemo);await page.evaluate(()=>GaiaMapDemo.stop());row.demoStoppedEarly=true;}
   try {
    await page.waitForFunction(()=>globalThis.GaiaMapDemo&&globalThis.GaiaMarineCod?.getState().count>0&&document.querySelector('#gaia-boot')?.hidden);
   } catch(error) {
    row.failure=error.message;row.load=await snapshot(page);row.requestFailures=failures;
    row.screen=await page.evaluate(()=>({text:document.body.innerText.slice(0,8000),status:document.querySelector('[data-cod-status]')?.textContent,state:globalThis.GaiaMarineCod?.getState(),appReady:document.documentElement.dataset.gaiaAppReady}));
    await page.screenshot({path:path.join(output,`${profile.name}-map-load-failed.png`)});
    persist();console.log(JSON.stringify({phase:'map-load-failed',profile:profile.name,screen:row.screen,requests:failures}));await context.close();continue profileLoop;
   }
   row.dataReadyMs=await page.evaluate(()=>performance.now());
   await page.evaluate(()=>GaiaMapDemo.stop());
   await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation==='idle');
   row.mapSettledMs=await page.evaluate(()=>performance.now());row.load=await snapshot(page);persist();
   console.log(JSON.stringify({phase:'map-ready',profile:profile.name,ready:row.dataReadyMs,settled:row.mapSettledMs,bytes:row.load.bodyBytes}));
   for(const exhibit of [31,44,63,1]) {
    const start=await page.evaluate(()=>performance.now());
    await page.evaluate(n=>GaiaMapCategories.buttons().find(b=>Number(b.textContent)===n).click(),exhibit);
    if(exhibit>=31)await page.waitForFunction(n=>Number(GaiaMarineCod.definition.number)===n&&GaiaMarineCod.getState().count>0&&!document.querySelector('[data-cod-controls]').disabled,exhibit);
    await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation==='idle'&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    const ready=await page.evaluate(()=>performance.now());await page.waitForTimeout(1000);
    const measured={exhibit,switchToReadyMs:ready-start,...await windowMeasure(page,cdp)};
    if(exhibit>=31) {
     measured.stations=await page.evaluate(()=>GaiaMarineCod.getState().count);
     await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
     row.interactions.push(await interaction(page,`${exhibit} previous year`,async()=>{await page.locator('[data-cod-year]').focus();await page.keyboard.press('ArrowLeft');}));
     const cpuProfile=(await cdp.send('Profiler.stop')).profile;await cdp.send('Profiler.disable');
     fs.writeFileSync(path.join(output,`${profile.name}-year-${exhibit}.cpuprofile`),JSON.stringify(cpuProfile));
     row.interactions.at(-1).hotspots=cpuProfile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,12).map(n=>({function:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,hits:n.hitCount}));
     await page.locator('[data-cod-year]').press('ArrowRight');
     if(profile.mobile) {
      const slider=await page.locator('[data-cod-year]').boundingBox();
      row.interactions.push(await interaction(page,`${exhibit} touch year midpoint`,()=>page.touchscreen.tap(slider.x+slider.width*.5,slider.y+slider.height*.5)));
     }
     if(exhibit===63) {
      measured.optionsAll=await page.locator('[data-cod-station] option').count();
      await page.locator('[data-cod-prefecture]').selectOption('13');
      measured.optionsTokyo=await page.locator('[data-cod-station] option').count();
      row.interactions.push(await interaction(page,'63 Tokyo-filtered previous year',async()=>{await page.locator('[data-cod-year]').focus();await page.keyboard.press('ArrowLeft');}));
      await page.locator('[data-cod-prefecture]').selectOption('all');
     }
    }
    await page.screenshot({path:path.join(output,`${profile.name}-map-${exhibit}.png`)});
    row.runtime.push(measured);persist();console.log(JSON.stringify({phase:'runtime',profile:profile.name,...measured}));
   }
   row.final=await snapshot(page);row.requestFailures=failures;
   await context.close();persist();
  }
 }
 report.status='complete';
} catch(error) {report.status='failed';report.failure=error.stack;throw error;}
finally {report.finishedAt=new Date().toISOString();persist();await browser.close();}
