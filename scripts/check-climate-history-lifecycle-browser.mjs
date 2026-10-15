import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,output=path.resolve(process.env.GAIA_QA_OUTPUT_DIR || 'artifacts/climate-history-20261013');
fs.mkdirSync(output,{recursive:true});const report={scope:'Local installed Chrome; real snapshots, simulated network failures/delays; mobile emulation.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const state=()=>page.evaluate(()=>GaiaClimateHistory.getState());
const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')&&!document.querySelector('#japan-layer').classList.contains('is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',null,{timeout:60000});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());page=await context.newPage();page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${base}/#world-72`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await ready();
  await page.locator('[data-climate-basin]').selectOption('WP');assert.equal((await state()).basin,'WP');assert((await page.locator('[data-climate-insight]').textContent()).includes('31件'));
  await page.locator('[data-climate-basin]').selectOption('ALL');
  await page.locator('#gaia-map-playback-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017&&GaiaClimateHistory.getState().dataState==='ready',null,{timeout:15000});assert((await state()).playing);await page.locator('#gaia-map-playback-toggle').click();
  await page.locator('#gaia-map-cruise-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===1980&&GaiaClimateHistory.getState().dataState==='ready');await page.waitForFunction(()=>GaiaClimateHistory.getState().year===1981&&GaiaClimateHistory.getState().dataState==='ready',null,{timeout:12000});await page.locator('#gaia-map-cruise-toggle').click();
  report.checks.push('Basin filter, actual autoplay and cruise controls advance real seasons');
  await page.route('**/cyclones/2000.json?*',async r=>{await new Promise(resolve=>setTimeout(resolve,350));await r.continue();});
  await page.evaluate(()=>Promise.all([GaiaClimateHistory.setYear(2000),GaiaClimateHistory.setYear(2001),GaiaClimateHistory.setYear(2002)]));assert.equal((await state()).year,2002);
  await page.route('**/cyclones/2003.json?*',r=>r.abort());await page.evaluate(()=>GaiaClimateHistory.setYear(2003));assert.equal((await state()).dataState,'error');assert.equal(await page.locator('[data-climate-value]').textContent(),'—');
  await page.unroute('**/cyclones/2003.json?*');await page.locator('[data-climate-retry]').click();await ready();assert.equal((await state()).year,2003);
  report.checks.push('Latest request wins; failed year clears the old value; actual retry restores requested year');
  await page.route('**/cyclones/2004.json?*',async r=>{await new Promise(resolve=>setTimeout(resolve,350));await r.continue();});
  await page.evaluate(async()=>{const request=GaiaClimateHistory.setYear(2004);GaiaMapCategories.buttons().find(b=>Number(b.textContent)===6).click();await request;});assert.equal((await state()).active,false);assert(await page.locator('#gaia-climate-canvas').isHidden());
  for(const number of [70,73,31,72]){await page.evaluate(n=>GaiaMapCategories.buttons().find(b=>Number(b.textContent)===n).click(),number);await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,number);if(number>=72)await ready();else assert.equal((await state()).active,false);}
  report.checks.push('Pending request cannot reactivate old layer; standard, food, annual and new providers relinquish ownership correctly');
  await page.evaluate(()=>GaiaClimateHistory.select('coral'));await page.evaluate(()=>GaiaMapPlayback.stop());await ready();
  const target=await page.evaluate(async()=>{const data=await fetch('/data/climate-history/coral.json').then(r=>r.json());const rect=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset;const scale=rect.width/360*Math.max(1,Number(d.earthZoom)||1),ox=(rect.width-360*scale)/2+(Number(d.earthOffsetX)||0),oy=(rect.height-180*scale)/2+(Number(d.earthOffsetY)||0);for(const p of data.regions){const x=rect.left+ox+((p.lon-150+540)%360)*scale,y=rect.top+oy+(90-p.lat)*scale;if(x<100||x>900||y<280||y>650)continue;const hit=GaiaClimateHistory.findPoiAt(x,y,'mouse');if(hit&&hit.record.id!==GaiaClimateHistory.getState().selectedId)return {x,y,id:hit.record.id};}return null;});assert(target);await page.mouse.click(target.x,target.y);assert.equal((await state()).selectedId,target.id);
  report.checks.push('Clicking a rendered coral POI changes the actual selected region');
  await context.close();
  const mobile=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true,deviceScaleFactor:2});await enforceBrowserSecurity(mobile,base);await mobile.route('https://**',r=>r.abort());page=await mobile.newPage();page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${base}/#world-73`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await ready();
  await page.locator('#map-responsive-data > summary').tap();await page.locator('[data-climate-year]').fill('2017');await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017);
  const geometry=await page.locator('.gaia-climate-readout').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth,rect:el.getBoundingClientRect().toJSON()}));assert(geometry.scroll<=geometry.width+1,JSON.stringify(geometry));
  await page.screenshot({path:path.join(output,'320-73-compact.png')});report.checks.push({compact320:geometry});await mobile.close();
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'lifecycle-failure.png')});throw error;}
finally{fs.writeFileSync(path.join(output,'lifecycle-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
