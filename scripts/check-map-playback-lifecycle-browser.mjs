import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/map-playback-20260912/lifecycle');fs.mkdirSync(output,{recursive:true});
const report={status:'running',checks:[],errors:[],scope:'Local installed Chrome and repository snapshots. Native playback, guide and 25-second tour. Visibility fixture is explicitly synthetic; mobile is viewport/touch emulation.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try {
 for(const width of (process.env.QA_WIDTHS||'1440,390').split(',').map(Number)) {
  const mobile=width<=900,c=await browser.newContext({viewport:{width,height:mobile?844:900},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
  await enforceBrowserSecurity(c,base);await c.route('https://**',r=>r.abort());await c.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  page=await c.newPage();page.on('pageerror',e=>report.errors.push({width,message:e.message}));
  await page.goto(`${base}/?exhibit=70#world`,{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready);
  const press=async kind=>{if(mobile){await page.locator('[data-mobile-sheet="tools"]').tap();await page.locator(`[data-mobile-transport="gaia-map-${kind==='tour'?'demo':'playback'}-toggle"]`).tap();}else{const e=page.locator(kind==='tour'?'#gaia-map-demo-toggle':'#gaia-map-playback-toggle');await e.focus();await e.press('Enter');}};
  const stopped=()=>page.waitForFunction(()=>!GaiaMapDemo.getState().active&&!GaiaMapPlayback.getState().requested&&!GaiaFoodExhibits.getState().playing);
  await press('tour');await stopped();
  await press('current');await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);await page.keyboard.press('Escape');await stopped();
  assert.equal(await page.locator('#japan-layer').getAttribute('aria-hidden'),'false','Escape stops playback without leaving MAP');
  await press('current');await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
  await page.locator('[data-food-year]').focus();await page.keyboard.press('ArrowLeft');await stopped();
  // Real 25-second chapter transition, including the freshly loaded provider.
  await press('tour');const start=Date.now();await page.waitForFunction(()=>GaiaMapPlayback.getState().number===71&&GaiaFoodExhibits.getState().id==='food-security'&&GaiaMapPlayback.getState().playing,{},{timeout:40000});
  const elapsed=Date.now()-start;assert(elapsed>=24000&&elapsed<40000);assert.equal(await page.evaluate(()=>GaiaMapDemo.getState().active),true);
  await press('tour');await stopped();const period=await page.evaluate(()=>GaiaFoodExhibits.getState().periodKey);await page.waitForTimeout(4400);assert.equal(await page.evaluate(()=>GaiaFoodExhibits.getState().periodKey),period);
  await press('current');await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
  if(mobile){await page.locator('[data-mobile-sheet="tools"]').tap();await page.locator('#map-mobile-sheet').getByRole('button',{name:'地図ガイド',exact:true}).tap();}else await page.locator('[data-gaia-mode-guide-replay="map"]').click();
  await page.waitForFunction(()=>GaiaMapPlayback.getState().paused&&!GaiaFoodExhibits.getState().playing);
  const guidePeriod=await page.evaluate(()=>GaiaFoodExhibits.getState().periodKey);await page.waitForTimeout(4400);assert.equal(await page.evaluate(()=>GaiaFoodExhibits.getState().periodKey),guidePeriod);
  await page.locator('[data-feature-close]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
  // Synthetic visibility state supplements the real guide/leave lifecycle.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>GaiaMapPlayback.getState().paused&&!GaiaFoodExhibits.getState().playing);
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
  await press('current');await stopped();
  // Normal navigation stays stopped; starting again is an explicit choice.
  if(mobile)await page.locator('[data-mobile-exhibit-step="-1"]').tap();else await page.locator('[data-map-stable-step="-1"]').click();
  await page.waitForFunction(()=>GaiaMapPlayback.getState().number===70&&GaiaMapPlayback.getState().ready);assert.equal(await page.evaluate(()=>GaiaMapPlayback.getState().playing),false);
  await page.screenshot({path:path.join(output,`${width}-finished.png`)});
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);report.checks.push({width,realTourMilliseconds:elapsed,checks:'keyboard/Escape, manual seek, 70→71 automatic tour and stop, guide pause/resume, synthetic visibility, stopped navigation'});await c.close();console.log('PASS lifecycle',width,elapsed);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
