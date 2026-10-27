import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const out='artifacts/local95-20261027',report={checks:[],errors:[]},browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});
 const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
 const ready=id=>page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'),id);
 await page.goto('http://127.0.0.1:4492/world.html#world-94',{waitUntil:'domcontentloaded'});
 for(const [n,id] of [[94,'volcanoes'],[95,'tsunamis']]){
  await page.evaluate(n=>location.hash='#world-'+n,n);await ready(id);await page.evaluate(()=>GaiaMapPlayback.stop());
  const hit=await page.evaluate(()=>{const r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect();return GaiaClimateHistory.getRenderState().hitTargets.map(p=>GaiaClimateHistory.findPoiAt(r.left+p.x,r.top+p.y,'touch')).find(Boolean)});
  assert(hit,`${n} has a visible, selectable real event at entry on ${width}`);assert.equal(hit.record.exhibitId,id);
  const source=await page.evaluate(n=>GaiaMapDataIntro.entries[n].source,String(n));assert.match(source,/NOAA/);
  await page.screenshot({path:`${out}/${n}-${width}-entry.png`});report.checks.push({n,width,visiblePoi:true,hitId:hit.record.id,source});
 }
 if(width===1440){await page.locator('[data-map-menu-toggle]').click();const tile=page.locator('.map-mode-bank .map-mode-button').filter({hasText:/^91$/});await tile.click();await ready('oceanheat');assert.equal(new URL(page.url()).hash,'#world-91');report.checks.push({menu91:true,width});}
 await page.evaluate(()=>location.hash='#world-95');await ready('tsunamis');await page.locator('[data-map-stable-step="1"]').click();await ready('wateruse');report.checks.push({next95to96:true,width});await context.close();
}assert.deepEqual(report.errors,[]);report.status='passed';}catch(e){report.status='failed';report.failure=e.stack;throw e}finally{fs.writeFileSync(out+'/navigation-report.json',JSON.stringify(report,null,2));await browser.close()}
