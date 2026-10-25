import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.env.GAIA_FOOD71_BEFORE==='1';
const out=path.resolve('artifacts/commit75-verification/food71/'+(before?'before':'after'));
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',before,scope:'Installed Chrome, local real data, desktop and emulated touch; no production or physical phone claim',checks:[],errors:[]};let page;
try{
 for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901});
  await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  const stable=async()=>{await page.waitForFunction(()=>globalThis.GaiaFoodExhibits?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-food-canvas').dataset.foodArrivalState==='complete');await page.waitForTimeout(120);};
  const camera=()=>page.evaluate(()=>{const d=document.querySelector('#japan-overlay').dataset;return {zoom:+d.earthZoom,x:+d.earthOffsetX,y:+d.earthOffsetY};});
  const drawer=page.locator('#map-responsive-data');
  const open=async()=>{if(await drawer.isVisible()&&await drawer.getAttribute('open')===null)await drawer.locator(':scope > summary').click();};
  const close=async()=>{if(await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();};
  await page.goto(process.env.GAIA_BASE_URL+'/world.html#world-71');
  await page.waitForFunction(()=>globalThis.GaiaFoodExhibits?.getState().dataState==='ready');
  await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});await stable();
  const initial=await camera();assert.equal(await page.evaluate(()=>GaiaFoodExhibits.getState().id),'food-security');
  await page.screenshot({path:path.join(out,width+'-71-world.png')});
  if(before){assert(initial.zoom>4,'Reported Japan overview reproduced');report.checks.push({width,initial,reproduced:true});await context.close();continue;}
  assert.equal(initial.zoom,1,'71 opens at the world overview');
  assert(Number(await page.locator('#gaia-food-canvas').getAttribute('data-food-filled-country-count'))>150,'Real countries remain painted');
  await open();await page.locator('[data-food-country]').selectOption('036');await close();await stable();
  assert.equal(await page.locator('[data-food-country]').inputValue(),'036');assert((await camera()).zoom>=3,'User country selection still zooms in');
  const selected=await camera();await open();await page.locator('[data-food-series]').selectOption('21010');await page.locator('[data-food-year]').press('Home');await close();await stable();
  assert.deepEqual(await camera(),selected,'Changing period/indicator preserves the user view');
  await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>GaiaFoodExhibits.getState().id==='food-balances');await stable();
  assert.equal((await camera()).zoom,width<=720?4.25:6,'70 keeps its Japan entry view');
  await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaFoodExhibits.getState().id==='food-security');await stable();
  assert.equal((await camera()).zoom,1,'Returning from 70 to 71 restores world');
  assert.equal(await page.locator('[data-food-country]').inputValue(),'036','Saved country remains selected without controlling entry camera');
  await page.reload();await page.waitForFunction(()=>globalThis.GaiaFoodExhibits?.getState().dataState==='ready');await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});await stable();
  assert.equal((await camera()).zoom,1,'Direct reload of 71 stays at world');
  await page.screenshot({path:path.join(out,width+'-71-reload.png')});
  assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
  report.checks.push({width,height,initial,verified:['direct entry','real country fills','country selection zoom','period/indicator preserves camera','70 entry unchanged','70→71 world with saved country','71 reload']});
  await context.close();console.log('PASS food71 world '+width);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
