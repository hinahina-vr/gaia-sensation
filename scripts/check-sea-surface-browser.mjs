import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {recordCoralMotion as recordBrowserMotion} from './lib/record-coral-motion.mjs';
const out=path.resolve(process.env.GAIA_SEA_SURFACE_OUT||'artifacts/sea-surface-20261023/surface');fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local installed Chrome, real bundled data, GPU rendering and explicit context-loss/unavailable fault injection; not physical mobile or production.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const cpuOnly of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**/*',r=>r.abort());
  await context.addInitScript(cpuOnly=>{
    sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
    window.__seaContexts=0;window.__seaLongTasks=[];
    new PerformanceObserver(list=>{for(const e of list.getEntries())__seaLongTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'&&this.dataset.seaSurface){__seaContexts++;if(cpuOnly)return null;const gl=get.call(this,type,...args);window.__seaGl=gl;return gl;}return get.call(this,type,...args);};
  },cpuOnly);
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='sealevel'&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&GaiaClimateHistory.getSeaState().surface.draws>0);
  const settled=()=>page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&Number(document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear)===GaiaClimateHistory.getState().year);
  const pixels=()=>page.evaluate(async()=>{
    const {earthBaseScale,earthLongitudeToMapX}=await import('./src/exploration/world-projection.js?v=gaia-japan-center-1');
    const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=earthBaseScale(r)*Number(d.earthZoom),c=document.querySelector('#gaia-climate-canvas'),ctx=c.getContext('2d'),box=c.getBoundingClientRect();
    const sample=([lon,lat])=>{const x=(r.width-360*s)/2+Number(d.earthOffsetX)+earthLongitudeToMapX(lon)*s,y=(r.height-180*s)/2+Number(d.earthOffsetY)+(90-lat)*s;return{lon,lat,rgba:[...ctx.getImageData(Math.round(x*c.width/box.width),Math.round(y*c.height/box.height),1,1).data]};};
    return{ocean:[[-145,-45],[-145,0],[-25,0],[80,-45],[160,45]].map(sample),land:[[100,45],[25,0],[-65,-10],[135,-25]].map(sample)};
  });
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-76`);await ready();await page.evaluate(()=>GaiaMapPlayback.stop());await settled();
  const initial=await page.evaluate(()=>GaiaClimateHistory.getSeaState());assert.equal(initial.engine,cpuOnly?'canvas2d':'webgl2');assert.equal(initial.surface.error,'');assert(initial.surface.landMasked);assert.equal(initial.stationsLoaded,492);
  const coverage=await pixels();assert(coverage.ocean.every(p=>p.rgba[3]>190),'Open sea across all oceans is filled');assert(coverage.land.every(p=>p.rgba[3]<6),'Land interiors are not painted');
  await page.screenshot({path:path.join(out,cpuOnly?'1440-76-cpu.png':'1440-76-ocean.png')});
  await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas');window.__seaPixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;window.__seaStart=performance.now();});
  await page.waitForTimeout(2000);
  const motion=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let changed=0,area=0;for(let i=0;i<p.length;i+=4)if(p[i+3]===209&&__seaPixels[i+3]===209){area++;if(Math.abs(p[i]-__seaPixels[i])+Math.abs(p[i+1]-__seaPixels[i+1])+Math.abs(p[i+2]-__seaPixels[i+2])>3)changed++;}delete window.__seaPixels;return{changed,area,share:changed/area,elapsed:performance.now()-__seaStart,state:GaiaClimateHistory.getSeaState(),longTasks:__seaLongTasks.filter(t=>t.start>=__seaStart)};});
  assert(motion.share>.2,'The colour surface itself moves over a large area');assert.equal(motion.state.marksPaintCount,initial.marksPaintCount,'Static marks are cached');assert.equal(motion.state.surface.builds,initial.surface.builds);assert.equal(motion.state.surface.maskBuilds,initial.surface.maskBuilds);
  report.checks.push({cpuOnly,coverage,motion});
  if(!cpuOnly&&process.env.GAIA_FFMPEG)report.motionVideo=await recordBrowserMotion(page,path.join(out,'76-ocean-motion.mp4'),8);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  const stationary=await page.evaluate(()=>GaiaClimateHistory.getSeaState());await page.waitForTimeout(500);assert.equal((await page.evaluate(()=>GaiaClimateHistory.getSeaState())).paintCount,stationary.paintCount);
  assert.equal(stationary.surface.time,0);
  const annual=[];
  for(const year of [1993,2016,2024]){await page.locator('[data-climate-year]').fill(String(year));await settled();annual.push({year,pixels:await pixels(),values:await page.evaluate(()=>GaiaClimateHistory.getSeaState().surface.values)});if(!cpuOnly)await page.screenshot({path:path.join(out,`1440-76-${year}.png`)});}
  assert.notDeepEqual(annual[0].pixels.ocean,annual[2].pixels.ocean);report.checks.push({cpuOnly,reducedMotionIdle:true,annual});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('[data-climate-year]').fill('2016');await settled();
  if(!cpuOnly){
    assert.equal(await page.evaluate(()=>__seaGl.getError()),0);
    await page.evaluate(()=>{window.__seaLoss=__seaGl.getExtension('WEBGL_lose_context');__seaLoss.loseContext();});
    await page.waitForFunction(()=>GaiaClimateHistory.getSeaState().engine==='canvas2d');assert((await pixels()).ocean.every(p=>p.rgba[3]>190));await page.screenshot({path:path.join(out,'1440-76-context-loss.png')});
    await page.evaluate(()=>__seaLoss.restoreContext());await page.waitForFunction(()=>GaiaClimateHistory.getSeaState().engine==='webgl2');assert.equal(await page.evaluate(()=>__seaGl.getError()),0);report.checks.push('GPU loss falls back to moving CPU sea; context restoration resumes WebGL without losing POIs');
  }
  await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='electricity'&&GaiaClimateHistory.getState().dataState==='ready');
  const exited=await page.evaluate(()=>GaiaClimateHistory.getSeaState());assert.equal(exited.surface.width,1);assert.equal(exited.stationsLoaded,0);assert.equal(exited.visible,0);assert.equal(exited.surface.engine,'idle');await page.waitForTimeout(400);assert.equal((await page.evaluate(()=>GaiaClimateHistory.getSeaState())).paintCount,exited.paintCount);
  await page.locator('[data-map-stable-step="-1"]').click();await ready();await page.evaluate(()=>GaiaMapPlayback.stop());assert.equal(await page.evaluate(()=>__seaContexts),1,'Re-entry reuses one GPU context');assert((await pixels()).ocean.every(p=>p.rgba[3]>190));assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
  report.checks.push({cpuOnly,exitStopped:true,reentrySingleContext:true});await context.close();
 }
 // A failed ocean/land mask must not hide the usable coastal observations.
 const failureContext=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(failureContext,process.env.GAIA_BASE_URL);await failureContext.route('https://**/*',r=>r.abort());
 await failureContext.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
 await failureContext.route('**/natural-earth-50m-countries.geojson?*',r=>r.abort());page=await failureContext.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-76`);
 await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');await page.evaluate(()=>GaiaMapPlayback.stop());
 const unavailable=await page.evaluate(()=>GaiaClimateHistory.getSeaState());assert.equal(unavailable.surface.engine,'geometry-unavailable');assert(unavailable.stations>0);assert.equal(unavailable.surface.draws,0);assert.equal(await page.locator('[data-climate-value]').textContent(),'184 mm');
 await page.locator('[data-climate-year]').fill('2024');await page.waitForFunction(()=>document.querySelector('[data-climate-value]').textContent==='204 mm');
 await failureContext.unroute('**/natural-earth-50m-countries.geojson?*');await page.evaluate(()=>GaiaMapObservationAdapter.retryCountryGeometry());await page.waitForFunction(()=>GaiaClimateHistory.getSeaState().surface.landMasked&&GaiaClimateHistory.getSeaState().surface.draws>0);
 report.checks.push('Geography download failure leaves coastal POIs and year controls usable; geography retry restores the masked ocean');assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await failureContext.close();
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
