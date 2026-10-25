import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=path.resolve(process.env.GAIA_SEA_LIFECYCLE_OUT||'artifacts/sea-level-gis-20261022/lifecycle');fs.mkdirSync(out,{recursive:true});
const report={scope:'Installed Chrome, local source data, actual controls; explicit network failure and delayed-response injection',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const settled=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
 await context.addInitScript(()=>{
   sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
   window.__seaIntro=[];const sample=()=>{const i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden&&i.dataset.exhibitNumber==='76')window.__seaIntro.push({opacity:+getComputedStyle(i).opacity,visible:c?.checkVisibility({visibilityProperty:true}),playing:globalThis.GaiaMapPlayback?.getState().playing});requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
 const requests=[];page.on('request',r=>{if(r.url().includes('/data/atlas-history/sealevel-stations'))requests.push(r.url());});
 await page.goto(base);await page.waitForTimeout(700);assert.equal(requests.length,0);
 await context.route('**/sealevel-stations.json?*',r=>r.abort());await page.goto(`${base}/world.html#world-76`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='error');await context.unroute('**/sealevel-stations.json?*');
 await page.locator('[data-climate-retry]').click();await page.locator('#map-data-intro').waitFor({state:'visible'});await page.mouse.click(700,400);await settled();await page.evaluate(()=>GaiaMapPlayback.stop());
 const intro=await page.evaluate(()=>__seaIntro);assert(intro.some(s=>s.opacity>0&&s.opacity<1));assert(!intro.some(s=>s.opacity>.01&&(s.visible||s.playing)));assert(intro.at(-1).opacity<.01);
 report.checks.push('No coastal data on title; failed stations retry; tap completes fade before marks/playback');
 await page.locator('[data-climate-year]').fill('2024');await page.locator('[data-climate-year]').fill('2008');await page.locator('[data-climate-year]').fill('2016');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2016'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
 await page.locator('#gaia-map-playback-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017);await page.locator('#gaia-map-playback-toggle').click();
 await page.locator('#gaia-map-cruise-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===1993);await page.waitForFunction(()=>GaiaClimateHistory.getState().year===1994);await page.locator('#gaia-map-cruise-toggle').click();report.checks.push('Rapid scrub, autoplay and cruising advance with the same coastal series');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-climate-year]').fill('2024');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2024');assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-year-fade'),'complete');
 const count=await page.evaluate(()=>GaiaClimateHistory.getSeaState().paintCount);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().paintCount),count);
 await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='electricity'&&GaiaClimateHistory.getState().dataState==='ready');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().visible),0);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().stationsLoaded),0);report.checks.push('Reduced motion, idle cache and next-exhibit cleanup');
 await page.reload();await settled();await context.route('**/sealevel-stations.json?*',async r=>{await new Promise(resolve=>setTimeout(resolve,900));await r.continue();});
 await page.evaluate(()=>{void GaiaClimateHistory.select('sealevel');void GaiaClimateHistory.select('electricity');});await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().id),'electricity');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().stationsLoaded),0);
 report.checks.push('Late station response cannot resurrect 76 after leaving');assert.deepEqual(report.errors,[]);assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);report.status='passed';await context.close();
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
