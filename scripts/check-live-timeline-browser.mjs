import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {createHash} from 'node:crypto';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/map-unified-dock-20260912/interactions');fs.mkdirSync(output,{recursive:true});
const saved=JSON.parse(fs.readFileSync('data/live-prefecture-fallback-v1.json','utf8'));
const report={checks:[],errors:[],scope:'Installed Chrome. Real saved provider data; explicitly mocked missing, empty-history, failed-refresh conditions. Local app, not production.'};
report.hashes=Object.fromEntries(['app.js','map-unified-dock.css','src/exploration/live-data.js','src/exploration/live-exhibits.js','src/exploration/live-timeline.js','data/live-prefecture-fallback-v1.json'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try{
 for(const mode of ['desktop','touch','missing','no-history','offline']){
  const mobile=mode==='touch';
  const ctx=await browser.newContext({viewport:{width:mobile?390:1440,height:mobile?844:900},hasTouch:mobile,isMobile:mobile});
  await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());
  let refreshed=false;
  await ctx.route('**/data/live-prefecture-fallback-v1.json',route=>{
   if(mode==='offline')return route.abort();
   const payload=structuredClone(saved);
   if(mode==='no-history'){delete payload.weather.history;delete payload.air.history;}
   if(mode==='missing')payload.weather.history[0].points.find(p=>p.id==='sapporo').measurements.weatherWindSpeed=null;
   if(refreshed){payload.weather.history.shift();payload.air.history.shift();}
   return route.fulfill({json:payload});
  });
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?exhibit=15#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();
  await page.evaluate(()=>GaiaMapDemo.stop());
  await page.waitForFunction(()=>GaiaLiveData.getPrefectureField().requestState!=='loading');
  const slider=page.locator('#gaia-live-time');
  if(mode==='no-history'||mode==='offline'){
   assert.equal(await slider.isDisabled(),true);assert.match(await page.locator('[data-live-period-note]').textContent(),/時間別データなし/);
   if(mode==='offline')assert.equal(await page.locator('.gaia-live-exhibit-readout').getAttribute('data-missing'),'true');
  }else{
   await slider.focus();await slider.press('Home');
   const start=await page.evaluate(()=>GaiaLiveData.getSelectedTime());assert(start);
   if(mode==='missing'){
    assert.equal(await page.locator('[data-live-exhibit-value]').textContent(),'—');
    assert.equal(await page.locator('.gaia-live-exhibit-readout').getAttribute('data-missing'),'true');
    await slider.press('ArrowRight');assert.equal(await page.locator('.gaia-live-exhibit-readout').getAttribute('data-missing'),'false');
   }else{
    // Freezes the data window, not only the thumb, across a periodic refresh.
    refreshed=true;await page.evaluate(()=>GaiaLiveData.refreshPrefectureField());
    assert.equal(await page.evaluate(()=>GaiaLiveData.getSelectedTime()),start);
    assert.equal(await page.evaluate(()=>GaiaLiveData.getState().measurements.weatherWindSpeed.observedAt),start);
    assert.equal(await page.evaluate(()=>GaiaLiveData.getPeriods('weatherWindSpeed').length),24);
    await page.locator('[data-live-poi-step="1"]:visible').click();
    await page.waitForFunction(()=>GaiaLiveData.getCity()==='aomori');
    const state=await page.evaluate(()=>GaiaLiveData.getState().measurements.weatherWindSpeed);
    assert.equal(state.observedAt,start);
    assert.equal(state.value,saved.weather.history[0].points.find(p=>p.id==='aomori').measurements.weatherWindSpeed);
    if(!mobile){
     await page.locator('[data-live-deck-source]').click();await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
     assert.match(await page.locator('#japan-data-panel').textContent(),/Open-Meteo|OPEN-METEO/);
     await page.screenshot({path:path.join(output,'historical-source.png')});await page.locator('#japan-data-close').click();
     await page.waitForFunction(()=>document.querySelector('#japan-data-panel').getAttribute('aria-hidden')==='true');
     await page.waitForTimeout(600);
    }
    const box=await slider.boundingBox(),y=box.y+box.height/2;
    await page.evaluate(()=>{window.__dragEvents=[];for(const type of ['pointerdown','pointermove','input'])addEventListener(type,e=>window.__dragEvents.push({type,target:e.target.id,x:e.clientX,y:e.clientY,value:e.target.value}),{capture:true});});
    if(mobile){
     const cdp=await ctx.newCDPSession(page);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+10,y}]});
     for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+10+box.width*.08*i,y}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }else{
     await page.mouse.move(box.x+10,y);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,y,{steps:6});await page.mouse.up();
    }
    const chosen=await page.evaluate(()=>GaiaLiveData.getSelectedTime());
    report.checks.push({mode,drag:{box,start,chosen,events:await page.evaluate(()=>__dragEvents)}});
    assert(chosen&&chosen!==start,`${mode} actual drag`);
    await page.screenshot({path:path.join(output,`${mode}-drag.png`)});
    await slider.focus();await slider.press('End');assert.equal(await page.evaluate(()=>GaiaLiveData.getSelectedTime()),null);
    assert.equal(await page.evaluate(()=>GaiaLiveData.getPeriods('weatherWindSpeed').length),23,'Latest rejoins refreshed history');
    if(!mobile){
     await page.locator('.gaia-live-place-selector').click();await page.locator('[data-place-city="tokyo"]').click();
     await page.waitForFunction(()=>GaiaLiveData.getCity()==='tokyo'&&GaiaLiveData.getState().requestState!=='loading');
     const tokyo=await page.evaluate(()=>GaiaLiveData.getState());
     const expected=saved.weather.points.find(p=>p.id==='tokyo');
     assert.equal(tokyo.measurements.weatherWindSpeed.observedAt,expected.observedAt);
     assert.equal(tokyo.events.find(e=>e.measurements.some(m=>m.key==='weatherWindSpeed')).observedAt,expected.observedAt,'Source ledger and latest value use the same event');
    }
    await slider.press('Home');
    await page.evaluate(()=>GaiaMapCategories.buttons()[20].click());
    await page.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent==='21');
    assert.equal(await page.evaluate(()=>GaiaLiveData.getSelectedTime()),null,'Exit clears historical selection');
    await page.evaluate(()=>GaiaMapCategories.buttons()[14].click());
    await page.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent==='15');
    assert.equal(await page.locator('[data-live-period]').textContent(),'最新');
   }
  }
  await page.screenshot({path:path.join(output,`${mode}.png`)});
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
  report.checks.push(mode);await ctx.close();console.log(`PASS ${mode}`);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
