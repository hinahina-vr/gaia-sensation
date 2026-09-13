import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {readAnnualPart} from './lib/annual-snapshot.mjs';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/map-theme-background-20260912/lifecycle');fs.mkdirSync(output,{recursive:true});
const report={status:'running',checks:[],errors:[],scope:'Local installed Chrome with production CSP; original repository data, FIRMS repository snapshot fixture. Touch viewport emulation, WebGL2 denial and land-mask fetch failure are injected tests. Not production or physical devices.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const state=()=>page.evaluate(()=>GaiaMapThemeBackground.getState());
const idle=()=>page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
const select=async n=>{await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,n);await idle();};
const capture=()=>page.evaluate(()=>{window.__themeCapture=true;GaiaMapThemeBackground.redraw();return window.__themePixelHash;});
const ready=()=>page.waitForFunction(()=>GaiaMapThemeBackground.getState().engine==='webgl2'&&GaiaMapThemeBackground.getState().mask==='ready');
const check=(mode,name,evidence={})=>{report.checks.push({mode,name,...evidence});console.log('PASS',mode,name);};
try{
 for(const mode of (process.env.QA_CASES||'desktop,touch,unavailable,mask-failure').split(',')){
  const mobile=mode==='touch',ctx=await browser.newContext({viewport:{width:mobile?390:1440,height:mobile?844:900},hasTouch:mobile,isMobile:mobile,reducedMotion:'no-preference'});
  await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());
  await ctx.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  if(mode==='mask-failure')await ctx.route('**/data/natural-earth-50m-land.geojson*',r=>r.abort());
  await ctx.addInitScript(({deny})=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){
    if(this.id==='gaia-map-theme-background'&&type==='webgl2'&&deny)return null;
    const gl=original.call(this,type,...args);
    if(gl&&this.id==='gaia-map-theme-background'&&type==='webgl2'&&!gl.__themeTest){
     gl.__themeTest=true;const draw=gl.drawArrays.bind(gl);gl.drawArrays=(...values)=>{draw(...values);if(!window.__themeCapture)return;window.__themeCapture=false;
      const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let hash=2166136261;
      for(let i=0;i<pixels.length;i+=16)for(let c=0;c<3;c++)hash=Math.imul(hash^pixels[i+c],16777619);window.__themePixelHash=hash>>>0;
     };
    }return gl;
   };
  },{deny:mode==='unavailable'});
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(`${mode}: ${e.message}`));
  await page.goto(base+'/?exhibit=31#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  await page.evaluate(()=>{GaiaMapDemo.stop();GaiaFrameBudgetGovernor.stop();GaiaFrameBudgetGovernor.setLevel('high','explicit-lifecycle-test');});await idle();
  if(mode==='unavailable'||mode==='mask-failure'){
   await page.waitForFunction(()=>document.querySelector('#japan-map').classList.contains('has-theme-background-fallback'));
   assert.notEqual(await page.locator('#japan-map').evaluate(e=>getComputedStyle(e,'::before').backgroundImage),'none');
   const first=await state();assert.equal(first.engine,mode==='unavailable'?'unavailable':'webgl2');
   await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');
   const option=await page.locator('[data-cod-prefecture] option').evaluateAll(os=>os.find(o=>o.value!=='all'&&!o.disabled)?.value);await page.selectOption('[data-cod-prefecture]',option);
   const station=await page.locator('[data-cod-station] option').evaluateAll(os=>os.find(o=>o.value&&!o.disabled)?.value);await page.selectOption('[data-cod-station]',station);
   await page.waitForFunction(()=>!document.querySelector('[data-cod-analysis]').disabled);assert.equal(await page.evaluate(()=>GaiaMarineCod.getState().selectedId),station);
   await select(21);assert.equal(await page.locator('#japan-map').evaluate(e=>e.classList.contains('has-theme-background-fallback')),false);
   await select(71);await page.waitForFunction(()=>document.querySelector('#japan-map').classList.contains('has-theme-background-fallback'));
   await page.waitForFunction(()=>GaiaFoodExhibits.getState().dataState==='ready'&&document.querySelector('#gaia-food-canvas').dataset.foodArrivalState==='complete');
   assert(Number(await page.locator('#gaia-food-canvas').getAttribute('data-food-filled-country-count'))>100,'The original country fills also render with the fallback background');
   await page.screenshot({path:path.join(output,`${mode}.png`)});check(mode,'Static fallback, live data controls, leaving and reentering supported themes',{first});
   assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();continue;
  }
  await ready();
  for(const n of [1,31,71,21,15,1,31]){
   await select(n);
   assert.equal(await page.locator('#gaia-map-theme-background').count(),1);
   if(n===21||n===15){const held=await state();await page.waitForTimeout(300);assert.equal((await state()).frame,held.frame);assert.equal(held.pendingFrame,false);assert.equal(await page.locator('#gaia-map-theme-background').isVisible(),false);}
   else{await ready();assert.equal((await state()).number,n);}
  }
  assert.equal((await state()).contextCount,1);check(mode,'Repeated 01→31→71→21→15 switching reuses one context and hides/stops out-of-scope background');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(250);
  const still1=await capture();await page.waitForTimeout(400);const still2=await capture();assert.equal(still1,still2);assert.equal((await state()).pendingFrame,false);
  const projection=()=>page.locator('#japan-overlay').evaluate(e=>[e.dataset.earthZoom,e.dataset.earthOffsetX,e.dataset.earthOffsetY].join(','));
  const beforeZoom=await projection();
  if(mobile){await page.locator('[data-mobile-sheet="tools"]').click();await page.getByRole('button',{name:'＋ 拡大',exact:true}).click();if(await page.locator('[data-mobile-sheet-close]').isVisible())await page.locator('[data-mobile-sheet-close]').click();}
  else await page.locator('#gaia-map-zoom-in').click();
  await page.waitForFunction(prev=>{const e=document.querySelector('#japan-overlay');return [e.dataset.earthZoom,e.dataset.earthOffsetX,e.dataset.earthOffsetY].join(',')!==prev;},beforeZoom);await idle();
  assert.notEqual(await capture(),still2,'Reduced motion still redraws for real map zoom');
  const beforePan=await projection(),x=mobile?180:620,y=mobile?310:400;
  if(mobile){const cdp=await ctx.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*6,y:y+i*3}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-60,y+30,{steps:8});await page.mouse.up();}
  assert.notEqual(await projection(),beforePan);check(mode,'Reduced motion has stable pixels; native zoom and mouse/touch drag update map/background');
  for(const level of ['low','static']){
   await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(level=>GaiaFrameBudgetGovernor.setLevel(level,'explicit-lifecycle-test'),level);await page.waitForTimeout(250);
   const low=await state();assert(low.width*low.height<=280000);assert.equal(await page.locator('#gaia-map-theme-background').getAttribute('data-theme-target-fps'),level==='static'?'0':'12');
   if(level==='static'){const hash=await capture();await page.waitForTimeout(300);assert.equal(await capture(),hash);assert.equal((await state()).pendingFrame,false);}
   check(mode,`${level} quality profile bounds`,{state:low});
  }
  await page.evaluate(()=>GaiaFrameBudgetGovernor.setLevel('high','explicit-lifecycle-test'));
  await page.evaluate(()=>{window.__themeLoss=document.querySelector('#gaia-map-theme-background').getContext('webgl2').getExtension('WEBGL_lose_context');window.__themeLoss.loseContext();});
  await page.waitForFunction(()=>GaiaMapThemeBackground.getState().engine==='context-lost');assert.equal((await state()).pendingFrame,false);
  assert.equal(await page.locator('#japan-map').evaluate(e=>e.classList.contains('has-theme-background-fallback')),true);
  await page.evaluate(()=>window.__themeLoss.restoreContext());await ready();
  assert.equal((await state()).contextCount,2);assert.equal(await page.locator('#gaia-map-theme-background').count(),1);check(mode,'Actual WEBGL_lose_context loss and restore recovers one canvas');
  // Browser visibility is explicitly injected, not claimed as a physical-tab test.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const hidden=await state();await page.waitForTimeout(350);assert.equal((await state()).frame,hidden.frame);assert.equal(hidden.pendingFrame,false);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(n=>GaiaMapThemeBackground.getState().frame>n,hidden.frame);check(mode,'Injected visibilitychange stops and resumes background rendering');
  for(const n of [1,38,65,70,71]){
   await select(n);const kind=n===1?'firms':n>=70?'food':'cod';
   if(kind==='cod'){
    await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');
    const current=await page.evaluate(()=>({def:GaiaMarineCod.definition,year:GaiaMarineCod.getState().year}));
    const manifest=JSON.parse(fs.readFileSync(`data/${current.def.dataFile}`)),meta=manifest.periods.find(p=>p.year===current.year),period=manifest.schemaVersion===2?readAnnualPart(meta.file):meta;
    const measured=period.stations.find(p=>Number.isFinite((p.cod||p.metrics?.[current.def.measurementKey]||p.measurement)?.value));assert(measured,'Real measured station from current source period');
    await page.selectOption('[data-cod-prefecture]',measured.prefCode);await page.selectOption('[data-cod-station]',measured.id);
    await page.waitForFunction(()=>!document.querySelector('[data-cod-analysis]').disabled);
   }else if(kind==='food'){await page.waitForFunction(()=>GaiaFoodExhibits.getState().dataState==='ready');await page.selectOption('[data-food-country]','392');}
   else{
    await page.waitForFunction(()=>Number(document.querySelector('#gaia-firms-canvas').dataset.firmsPointCount)>0);
    const playing=await page.evaluate(()=>GaiaFirmsExhibit.getState().playbackEnabled);await page.locator('[data-firms-play]').click();assert.equal(await page.evaluate(()=>GaiaFirmsExhibit.getState().playbackEnabled),!playing);
    if(!playing)await page.locator('[data-firms-play]').click();
    await page.locator('[data-firms-progress]').fill('450');await page.locator('[data-firms-progress]').dispatchEvent('input');
    assert.equal(await page.locator('[data-firms-progress]').inputValue(),'450');
   }
   const guide=page.locator(kind==='firms'?'.gaia-firms-copy':kind==='cod'?'.gaia-cod-guide':'.gaia-food-guide');
   assert.equal(await guide.locator('.gaia-theme-background-note').count(),1);
   const openAction=async label=>{if(mobile){await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet').getByRole('button',{name:label,exact:true}).click();}else await page.locator(`button[data-${kind}-${label==='データの出典'?'source':'analysis'}]`).click();};
   await openAction('データの出典');await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();assert((await page.locator('#japan-data-panel').innerText()).length>80);await page.locator('#japan-data-close').click();await page.locator('#japan-data-panel').waitFor({state:'hidden'});
   if(n!==1){await openAction('統計分析');await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);assert(Number(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count'))>0);await page.screenshot({path:path.join(output,`${mode}-${n}-analysis.png`)});await page.locator('#gaia-statistics-close').click();await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});}
   check(mode,`${n}: real source/analysis actions and selected data, decorative note exactly once`);
  }
  await page.locator('#japan-close').click();await page.waitForFunction(()=>document.querySelector('#japan-layer').getAttribute('aria-hidden')==='true');
  const exited=await state();await page.waitForTimeout(400);assert.equal((await state()).frame,exited.frame);assert.equal(exited.pendingFrame,false);check(mode,'Real MAP exit stops background');
  await page.evaluate(()=>{GaiaMapThemeBackground.dispose();GaiaMapThemeBackground.dispose();});assert.equal(await page.locator('#gaia-map-theme-background').count(),0);
  await page.evaluate(async()=>{const {mountMapThemeBackground}=await import('./src/exploration/map-theme-background.js?v=theme-background-20260912');mountMapThemeBackground();mountMapThemeBackground();});assert.equal(await page.locator('#gaia-map-theme-background').count(),1);assert.equal((await state()).contextCount,0);check(mode,'Idempotent dispose/remount creates no GL context while MAP is closed');
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{report.hashes=Object.fromEntries(['src/exploration/map-theme-background.js','src/exploration/map-theme-shaders.js','map-theme-background.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
