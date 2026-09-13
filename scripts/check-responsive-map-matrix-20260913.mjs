import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='artifacts/responsive-fixes-20260913/map-matrix';fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,reducedMotion:'reduce'});
await page.route('https://**',r=>r.abort());page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(20000);
try{
 await page.goto('http://127.0.0.1:4492/#world-15');await page.locator('#gaia-boot').waitFor({state:'hidden'});
 for(let n=1;n<=71;n++){
  await page.evaluate(n=>location.hash='#world-'+n,n);
  await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
  await page.waitForTimeout(120);
  const state=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom};};return {number:Number(document.querySelector('#japan-mode-number').textContent),playback:GaiaMapPlayback.getState(),drawer:rect(document.querySelector('#map-responsive-data')),overflow:document.documentElement.scrollWidth-innerWidth};});
  assert.equal(state.overflow,0);assert(state.drawer.y>160&&state.drawer.bottom<667);
  for(const selector of ['[data-map-menu-toggle]','[data-map-stable-step="1"]','[data-mobile-sheet="tools"]','#gaia-map-zoom-in'])assert(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),`${n} ${selector} covered`);
  results.push(state);
  if([1,2,6,9,15,26,40,70,71].includes(n)){await page.locator('#map-responsive-data > summary').click();await page.screenshot({path:`${out}/drawer-${n}.png`});await page.locator('#map-responsive-data > summary').click();}
  console.log('PASS',n);
 }
 for(const n of [1,6,15,26,40,70]){
  await page.evaluate(n=>location.hash='#world-'+n,n);await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
  await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('[data-mobile-cruise]').click();await page.locator('#map-mobile-sheet').waitFor({state:'hidden'});
  await page.waitForFunction(()=>GaiaMapCruise.getState().active&&GaiaMapCruise.getState().phase==='slider');const before=await page.evaluate(()=>GaiaMapCruise.getState().elapsed);await page.waitForTimeout(1200);assert(await page.evaluate(()=>GaiaMapCruise.getState().elapsed)>before);
  await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('[data-mobile-cruise]').click();await page.locator('#map-mobile-sheet').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>GaiaMapCruise.getState().active),false);
  await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(400);assert.equal(await page.locator('#map-responsive-data').isVisible(),false);assert.equal(await page.locator('#map-responsive-data > :not(summary)').count(),0);
  await page.setViewportSize({width:375,height:667});await page.waitForTimeout(400);assert(await page.locator('#map-responsive-data').isVisible());
  results.push({number:n,cruiseAndResize:true});console.log('PASS cruise/resize',n);
 }
 assert.deepEqual(errors,[]);
}catch(e){results.push({failure:e.stack});await page.screenshot({path:`${out}/failure.png`});process.exitCode=1;console.error(e);}
finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
