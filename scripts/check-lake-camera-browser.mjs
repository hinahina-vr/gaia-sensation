import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {recordCoralMotion as recordMotion} from './lib/record-coral-motion.mjs';
const before=process.env.GAIA_LAKE_CAMERA_BEFORE==='1',out=path.resolve('artifacts/commit75-verification/lake74/'+(before?'before':'after'));fs.mkdirSync(out,{recursive:true});
const report={scope:'Real installed Chrome and local lake rasters; actual camera frames; touch/reduced-motion emulation, not physical device or production',checks:[],errors:[]};let page;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const [width,height,motion] of before?[[1440,900,'no-preference']]:[[1440,900,'no-preference'],[390,844,'no-preference'],[320,568,'reduce']]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901,reducedMotion:motion});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__lakeCamera=[];const tick=()=>{const d=document.querySelector('#japan-overlay')?.dataset,l=document.querySelector('#japan-layer');if(d&&l?.dataset.climateExhibit==='lakes'){__lakeCamera.push({t:performance.now(),zoom:+d.earthZoom,x:+d.earthOffsetX,y:+d.earthOffsetY,target:d.viewTarget,easing:d.viewEasing,progress:+d.viewAnimationProgress,running:d.viewAnimation==='running',intro:l.matches('.is-map-title-transitioning,.is-map-data-intro'),detail:l.classList.contains('is-lake-detail')});if(__lakeCamera.length>3000)__lakeCamera.shift();}requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  const ready=async()=>{await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#japan-layer').classList.contains('is-lake-detail')&&GaiaClimateHistory.getLakeState().referenceReady);await page.waitForTimeout(120);};
  const controls=async()=>{if(!await page.locator('[data-climate-point]').isVisible())await page.locator('#map-responsive-data > summary').click();};
  const closeControls=async()=>{const d=page.locator('#map-responsive-data');if(await d.isVisible()&&await d.getAttribute('open')!==null)await d.locator(':scope > summary').click();};
  await page.goto(process.env.GAIA_BASE_URL+'/world.html#world-74');await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
  let capture=null;
  if(!before&&width===1440&&process.env.GAIA_FFMPEG){
    await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewTarget==='lake-geographic-window'&&document.querySelector('#japan-overlay').dataset.viewAnimation==='running');
    capture=recordMotion(page,path.join(out,'74-gentle-zoom.mp4'),8);
  }
  await ready();if(capture)report.video=await capture;
  const initial=await page.evaluate(()=>__lakeCamera);await page.screenshot({path:path.join(out,width+'-74-detail.png')});
  const frames=initial.filter(f=>f.target==='lake-geographic-window'&&f.running);
  // Map attributes refresh at 24 fps while this trace samples every rAF.
  // Measure over >=120ms rather than attributing a whole paint step to the
  // last 16ms sample, which exaggerates the actual magnification speed.
  const measure=fs=>{let peak=0;for(let i=0;i<fs.length;i++){const a=fs[i],b=fs.slice(i+1).find(f=>f.t-a.t>=120);if(b&&a.zoom>0&&b.zoom>0)peak=Math.max(peak,Math.abs(Math.log(b.zoom/a.zoom))/((b.t-a.t)/1000));}return {peakLogZoomPerSecond:peak,spanMs:fs.at(-1)?.t-fs[0]?.t,firstZoom:fs[0]?.zoom,lastZoom:fs.at(-1)?.zoom,frames:fs.length};};
  const entry=measure(frames);
  report.latestEntry={width,entry,frames};
  if(before){report.checks.push({width,entry,frames});await context.close();continue;}
  if(motion!=='reduce'){assert(frames.length>30);assert(frames.every(f=>f.easing==='lake-flight'));assert(entry.spanMs>3000,'Entry zoom takes time to follow');assert(entry.peakLogZoomPerSecond<3.2,'Magnification does not leap at the beginning');}
  assert(!initial.some(f=>f.intro&&f.detail),'Lake detail starts after intro');
  await controls();await page.evaluate(()=>{window.__lakeCamera=[];});await page.locator('[data-climate-point]').selectOption('poopo');await closeControls();await ready();
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),'poopo');
  const fly=await page.evaluate(()=>__lakeCamera.filter(f=>f.target==='lake-geographic-window'&&f.running).slice(-300));await page.screenshot({path:path.join(out,width+'-74-poopo.png')});
  if(motion!=='reduce'){
    assert(Math.min(...fly.map(f=>f.zoom))<10,'Travel between continents pulls back before moving in');
    assert(measure(fly).peakLogZoomPerSecond<3.5,'Closing mobile controls cannot accelerate the remaining flight');
  }
  await controls();await page.locator('[data-climate-year]').fill('2015');await closeControls();await page.waitForFunction(()=>document.querySelector('.gaia-lake-view').dataset.renderedYear==='2015');
  const sample=await page.evaluate(()=>{const r=GaiaClimateHistory.getLakeState().raster,m=GaiaMapObservationAdapter.getViewportRect();return{x:m.left+r.x+r.width*.5,y:m.top+r.y+r.height*.3};});
  if(width<901)await page.touchscreen.tap(sample.x,sample.y);else await page.mouse.click(sample.x,sample.y);await page.waitForFunction(()=>!!GaiaClimateHistory.getLakeState().sample);
  await controls();await page.locator('[data-climate-overview]').click();await closeControls();await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-lake-detail')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');assert.equal(Number(await page.locator('#japan-overlay').getAttribute('data-earth-zoom')),1);
  await controls();await page.locator('[data-climate-overview]').click();await closeControls();await ready();
  if(width===1440){
   await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='coral'&&GaiaClimateHistory.getState().dataState==='ready');assert(!await page.locator('.gaia-lake-view').isVisible());
   await page.locator('[data-map-stable-step="1"]').click();await ready();
   await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='waterstore'&&GaiaClimateHistory.getState().dataState==='ready');assert(!await page.locator('.gaia-lake-view').isVisible());
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
  report.checks.push({width,height,motion,entry,frames,intercontinental:measure(fly),verified:['intro then detail','gentle entry','intercontinental pullback','drawer reframe speed','year change and actual raster pick','world return and reopen','73/75 transition']});
  await context.close();console.log('PASS lake camera '+width);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure}));}
