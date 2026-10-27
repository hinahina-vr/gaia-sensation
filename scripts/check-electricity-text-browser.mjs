import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {chromium} from 'playwright-core';
const out='artifacts/electricity-text-20261026',base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';fs.mkdirSync(out,{recursive:true});
const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Installed Chrome: reproduce the old 4K raster text, then verify native vector text at 4K, high DPI and mobile. No release.',checks:[],errors:[]};
const originals=new Map(['gaia-mode-loader.js','src/exploration/index.js','src/exploration/climate-history-exhibits.js','src/exploration/electricity-map-view.js','src/exploration/electricity-country-marks.js','climate-history-exhibits.css'].map(file=>[file,execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'})]));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const [width,height,dpr,before] of [[3840,2160,1,true],[3840,2160,1,false],[1920,1080,2,false],[390,844,3,false]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:width<901,isMobile:width<901,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  if(before)await context.route(base+'/**',r=>{const file=new URL(r.request().url()).pathname.slice(1);return originals.has(file)?r.fulfill({status:200,contentType:file.endsWith('.css')?'text/css':'text/javascript',body:originals.get(file)}):r.continue()});
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});
  page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/world.html#world-77');await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');
  await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaClimateHistory.selectPoint('IND',{focus:false})});
  await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&GaiaClimateHistory.getRenderState().electricityLabels.some(p=>p.id==='IND'&&p.selected));
  const state=await page.evaluate(()=>({render:GaiaClimateHistory.getRenderState(),canvas:{width:document.querySelector('#gaia-climate-canvas').width,cssWidth:document.querySelector('#gaia-climate-canvas').getBoundingClientRect().width},texts:[...document.querySelectorAll('.gaia-electricity-labels [data-electricity-label-generation=current] text')].map(e=>e.textContent),svg:document.querySelector('.gaia-electricity-labels')?.getBoundingClientRect().toJSON()}));
  const selected=state.render.electricityLabels.find(p=>p.selected);assert.equal(selected.id,'IND');assert.equal(selected.text,'89.6%');
  if(before){assert.equal(state.texts.length,0);assert(state.canvas.width/state.canvas.cssWidth<.5,'Reproduce the old low-resolution map buffer')}
  else{
   assert.equal(state.render.labelLayer.engine,'svg');assert.equal(state.render.labelLayer.bitmapPixels,0);assert(state.texts.includes('89.6%'));assert.equal(state.svg.width,width);assert.equal(state.render.labelLayer.previousLabels,0);
   assert.equal(await page.locator('.gaia-electricity-labels').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
   const rect=await page.locator('#gaia-climate-canvas').boundingBox(),p={x:rect.x+(selected.bounds.left+selected.bounds.right)/2,y:rect.y+(selected.bounds.top+selected.bounds.bottom)/2};
   assert.equal(await page.evaluate(p=>GaiaClimateHistory.findPoiAt(p.x,p.y,'mouse')?.record.id,p),'IND');
  }
  const tag=`${before?'before':'after'}-${width}-dpr${dpr}`;await page.screenshot({path:`${out}/${tag}.png`});
  if(width===3840){const rect=await page.locator('#gaia-climate-canvas').boundingBox();await page.screenshot({path:`${out}/${tag}-india.png`,clip:{x:rect.x+selected.bounds.left-15,y:rect.y+selected.bounds.top-15,width:selected.bounds.right-selected.bounds.left+30,height:selected.bounds.bottom-selected.bounds.top+30}})}
  if(!before){
   await page.evaluate(()=>GaiaClimateHistory.select('sealevel'));await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sealevel'&&GaiaClimateHistory.getState().dataState==='ready');assert.equal(await page.locator('.gaia-electricity-labels').count(),0);
   await page.evaluate(()=>GaiaClimateHistory.select('electricity'));await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('.gaia-electricity-labels [data-electricity-label-generation=current] text'));assert.equal(await page.locator('.gaia-electricity-labels').count(),1);
  }
  report.checks.push({width,height,dpr,before,selected,canvas:state.canvas,texts:state.texts,labelLayer:state.render.labelLayer,cleanup:!before});console.log('PASS electricity text',tag);await context.close();
 }assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
