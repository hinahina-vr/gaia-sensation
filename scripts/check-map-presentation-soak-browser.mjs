import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,duration=Number(process.env.GAIA_SOAK_SECONDS||600)*1000;
const output=path.resolve('artifacts/data-explore-crash-20261014/soak');fs.mkdirSync(output,{recursive:true});
const report={scope:'Installed Chrome at 3840×2088, saved data; external requests blocked; not an actual live broadcast',errors:[],crashes:[],samples:[],switches:0,rounds:0};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:3840,height:2088},locale:'ja-JP',timezoneId:'Asia/Tokyo'});await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
page.on('pageerror',e=>{report.errors.push(e.stack);save();});page.on('crash',()=>{report.crashes.push('Renderer crashed');save();});
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
const enter=async()=>{await page.goto(`${base}/world/#world-01`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true'&&globalThis.GaiaMapCategories?.buttons().length===GaiaMapCategories.exhibitCount);await page.evaluate(()=>GaiaMapPlayback.stop());};
const sample=async()=>{
  const metrics=(await cdp.send('Performance.getMetrics')).metrics;
  const start=Date.now();const state=await page.evaluate(()=>{const c=document.querySelector('#gaia-canvas'),gl=c.getContext('webgl2');return {hash:location.hash,cacheSize:Number(c.dataset.baseShaderCacheSize),glError:gl.getError(),lost:gl.isContextLost(),ready:document.documentElement.dataset.gaiaAppReady};});
  assert.equal(state.glError,0);assert.equal(state.lost,false);assert(state.cacheSize<=3);assert.equal(state.ready,'true');
  report.samples.push({elapsedMs:Date.now()-report.startedAt,respondedMs:Date.now()-start,heapBytes:metrics.find(m=>m.name==='JSHeapUsedSize')?.value,documents:metrics.find(m=>m.name==='Documents')?.value,...state});save();
};
try{
  await enter();report.startedAt=Date.now();const deadline=report.startedAt+duration;
  while(Date.now()<deadline){
    for(const number of [1,6,7,31,49,70,72,73]){
      await page.evaluate(number=>{const b=GaiaMapCategories.buttons().find(b=>Number(b.textContent.trim())===number);if(!b)throw new Error(`Missing ${number}`);b.click();GaiaMapPlayback.stop();},number);
      await page.waitForFunction(number=>GaiaMapRoute.numberFromHash(location.hash)===number,number);
      if(number===72||number===73){await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready');await page.locator('[data-climate-year]').fill(report.rounds%2?'2015':'2018');await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready');}
      if(number===31||number===49){await page.waitForFunction(()=>document.querySelector('[data-cod-year]')?.disabled===false);await page.locator('[data-cod-year]').fill(report.rounds%2?'2015':'2018');}
      await page.waitForTimeout(2200);report.switches++;await sample();
      assert.deepEqual(report.errors,[]);assert.deepEqual(report.crashes,[]);
      if(Date.now()>=deadline)break;
    }
    report.rounds++;
    if(Date.now()>=deadline)break;
    if(report.rounds%2===0){
      await page.locator('[data-climate-source]').click();await page.locator('#japan-data-panel').waitFor({state:'visible'});await page.locator('#japan-data-close').click();
      await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);await page.locator('#gaia-statistics-close').click();
      await page.locator('#japan-close').click();await page.waitForURL(url=>url.hash==='#top');await page.locator('#intro-path-stage').waitFor({state:'visible'});await enter();
    }
    console.log(JSON.stringify({rounds:report.rounds,switches:report.switches,seconds:Math.round((Date.now()-report.startedAt)/1000),heap:report.samples.at(-1).heapBytes}));
  }
  report.durationMs=Date.now()-report.startedAt;report.status='passed';await page.screenshot({path:path.join(output,'after.png')});
}catch(error){report.status='failed';report.failure=error.stack;await page.screenshot({path:path.join(output,'failure.png'),timeout:8000}).catch(()=>{});throw error;}
finally{save();await browser.close();console.log(JSON.stringify({status:report.status,rounds:report.rounds,switches:report.switches,durationMs:report.durationMs,errors:report.errors,crashes:report.crashes}));}
