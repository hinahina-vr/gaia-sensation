import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const baseline=Boolean(process.env.GAIA_PREVIEW_BASELINE),out=path.resolve('artifacts/performance-20261028',baseline?'visual-baseline':'regression');fs.mkdirSync(out,{recursive:true});
const selectedWidth=Number(process.env.GAIA_CHECK_WIDTH)||0;
const previousChecks=selectedWidth&&!baseline&&fs.existsSync(path.join(out,'report.json'))?JSON.parse(fs.readFileSync(path.join(out,'report.json'))).checks.filter(c=>c.width!==selectedWidth):[];
const report={baseline,checks:previousChecks,errors:[]};const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{for(const [width,height] of [[1440,900],[390,844]].filter(v=>!selectedWidth||v[0]===selectedWidth)){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<900,hasTouch:width<900,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__baseDraws=0;for(const Type of [WebGLRenderingContext,WebGL2RenderingContext]){const original=Type.prototype.drawArrays;Type.prototype.drawArrays=function(...args){if(this.canvas.id==='gaia-canvas')__baseDraws++;return original.apply(this,args)}}});page=await context.newPage();page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));
 const ready=async n=>{await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',n);await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaClimateHistory.setPlayback(false)});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250)};
 const settled=()=>page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year)&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
 await page.goto(process.env.GAIA_BASE_URL+'/world.html#world-80',{waitUntil:'domcontentloaded'});
 for(const mode of [80,92,100]){
  if(mode!==80)await page.evaluate(n=>location.hash='#world-'+n,mode);await ready(mode);await settled();
  const snapshot=await page.evaluate(()=>{const hashes={};for(const id of ['japan-overlay','gaia-climate-canvas']){const c=document.getElementById(id),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619);hashes[id]={hash:hash>>>0,width:c.width,height:c.height}}return{hashes,camera:Object.fromEntries(['earthZoom','earthOffsetX','earthOffsetY'].map(k=>[k,document.querySelector('#japan-overlay').dataset[k]])),text:[...document.querySelectorAll('.gaia-map-text-layer text')].map(e=>e.textContent),state:GaiaClimateHistory.getState(),render:GaiaClimateHistory.getRenderState()}});
  fs.writeFileSync(path.join(out,`${width}-${mode}.json`),JSON.stringify(snapshot,null,2));await page.screenshot({path:path.join(out,`${width}-${mode}.png`)});
  // Run once with GAIA_PREVIEW_BASELINE to add exact visual comparisons.
  // A fresh checkout can still run the behavioral regression independently.
  const reference=path.resolve('artifacts/performance-20261028/visual-baseline',`${width}-${mode}.json`);
  const pixelParity=!baseline&&fs.existsSync(reference);
  if(pixelParity){const old=JSON.parse(fs.readFileSync(reference));assert.deepEqual(snapshot.hashes,old.hashes,'Canvas pixels changed');assert.deepEqual(snapshot.camera,old.camera);assert.deepEqual(snapshot.text,old.text);}
  const count=await page.evaluate(()=>__baseDraws);await page.waitForTimeout(350);const delta=await page.evaluate(n=>__baseDraws-n,count);assert(baseline?delta>0:delta===0,'Hidden base renderer must stop');
  report.checks.push({width,mode,pixelParity,hiddenDrawCalls:delta});console.log('PASS visual',width,mode);
  if(!baseline){
   const slider=page.locator('[data-climate-year]'),box=await slider.boundingBox();assert(box);
   if(width<900)await page.touchscreen.tap(box.x+box.width*.9,box.y+box.height/2);else{await page.mouse.move(box.x+box.width*.25,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.9,box.y+box.height/2,{steps:8});await page.mouse.up()}
   await settled();assert.notEqual(await page.evaluate(()=>GaiaClimateHistory.getState().year),snapshot.state.year,'Year slider must respond');
   const zoom=await page.evaluate(()=>Number(document.querySelector('#japan-overlay').dataset.earthZoom));await page.locator('#gaia-map-zoom-in').click();await page.waitForFunction(z=>Number(document.querySelector('#japan-overlay').dataset.earthZoom)>z,zoom);await settled();assert(await page.locator('#gaia-map-zoom-reset').isVisible());await page.locator('#gaia-map-zoom-reset').click();await settled();
   if(mode===80&&width<900){await page.locator('[data-climate-point]').selectOption('ARG');await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='ARG');await settled();}
   // Match the real mouse pointer and stay inside a stable country target.
   if(mode===80&&width>=900){const target=await page.evaluate(()=>{for(let y=180;y<innerHeight-150;y+=12)for(let x=60;x<innerWidth-20;x+=12){const e=document.elementFromPoint(x,y),p=GaiaClimateHistory.findPoiAt(x,y,'mouse');if(p&&p.record.id!==GaiaClimateHistory.getState().selectedId&&!e?.closest('button,select,input,summary,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom')&&[[8,0],[-8,0],[0,8],[0,-8]].every(([dx,dy])=>GaiaClimateHistory.findPoiAt(x+dx,y+dy,'mouse')?.record.id===p.record.id))return{x,y,id:p.record.id}}});assert(target,'A real country must be selectable');if(width<900)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,target.id);await settled();}
   report.checks.push({width,mode,yearSliderInteraction:width<900?"touch tap":"mouse drag",zoomReset:true,countryPicking:mode===80&&width>=900,countrySelector:mode===80&&width<900});
  }
 }
 if(!baseline){
  for(const [n,family,canvasId] of [[70,'food','gaia-food-canvas'],[65,'marine-cod','gaia-marine-cod-canvas']]){
   await page.evaluate(n=>location.hash='#world-'+n,n);await page.waitForFunction(({n,family})=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&document.querySelector('#japan-layer').classList.contains('is-'+family+'-exhibit')&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&(family==='food'?globalThis.GaiaFoodExhibits?.getState().dataState==='ready':globalThis.GaiaMarineCod?.getState().count>0),{n,family});await page.evaluate(()=>GaiaMapPlayback.stop());await page.waitForTimeout(1200);
   const count=await page.evaluate(()=>__baseDraws);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>__baseDraws),count);
   const visible=await page.evaluate(id=>{const c=document.getElementById(id),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i]>10)pixels++;return pixels},canvasId);assert(visible>100,'Exhibit overlay must remain visible');report.checks.push({width,mode:n,hiddenDrawCalls:0,visibleOverlayPixels:visible});
  }
  // The CO2 map must resume the base renderer after leaving an extension.
  await page.evaluate(()=>location.hash='#world-06');await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number')?.textContent)===6&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaFrameBudgetGovernor.stop();GaiaFrameBudgetGovernor.setLevel('high')});await page.waitForTimeout(250);const count=await page.evaluate(()=>__baseDraws);await page.waitForTimeout(500);assert(await page.evaluate(n=>__baseDraws>n,count));assert.notEqual(await page.locator('#gaia-canvas').getAttribute('data-render-suppressed'),'extension-map');
  await page.evaluate(()=>location.hash='#world-80');await ready(80);const next=await page.evaluate(()=>__baseDraws);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>__baseDraws),next);report.checks.push({width,returnToBaseShaderAndBack:true});
 }
 await context.close();}
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}
