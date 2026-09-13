import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/map-default-play-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());
 await page.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
 await page.goto('http://127.0.0.1:4492/?exhibit=21#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 for(const n of (process.env.QA_NUMBERS?.split(',').map(Number)||[21,9,15,31,38,70,71,6,1])){
  if(n!==21)await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
  await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().playing,n);
  assert.equal(await page.locator('#gaia-map-demo-toggle').count(),0);
  assert.equal(await page.evaluate(()=>GaiaMapDemo.getState().active),false);
  report.push({width,n,state:await page.evaluate(()=>GaiaMapPlayback.getState())});
  if(n>=15&&n<=20){
   const chronology=await page.evaluate(n=>{
    const periods=GaiaLiveData.getPeriods(GaiaLiveExhibits.definitions[n-15].key).filter(t=>Date.parse(t)<=Date.now()).sort();
    return {periods,selected:GaiaLiveData.getSelectedTime()};
   },n);
   assert.equal(chronology.selected,chronology.periods[0],'Playback starts at oldest hour');
   await page.waitForFunction(first=>GaiaLiveData.getSelectedTime()!==first,chronology.selected);
   assert(Date.parse(await page.evaluate(()=>GaiaLiveData.getSelectedTime()))>Date.parse(chronology.selected),'Playback moves forward');
   await page.evaluate(last=>GaiaLiveData.selectTime(last),chronology.periods.at(-1));
   await page.waitForFunction(()=>GaiaLiveData.getSelectedTime()===null);
   report.at(-1).chronology='oldest → newer → latest';
  }
  if(n===12){
   const first=await page.locator('#japan-overlay').getAttribute('data-ecologies-selected-iso3');
   const camera=await page.locator('#japan-overlay').getAttribute('data-earth-offset-x');
   await page.waitForFunction(first=>document.querySelector('#japan-overlay').dataset.ecologiesSelectedIso3!==first,first);
   await page.waitForFunction(camera=>document.querySelector('#japan-overlay').dataset.earthOffsetX!==camera,camera);
   report.at(-1).poi={first,next:await page.locator('#japan-overlay').getAttribute('data-ecologies-selected-iso3')};
  }
  const sliders=()=>page.locator('#japan-layer input[type="range"]').evaluateAll(es=>es.filter(e=>e.checkVisibility()&&!e.disabled).map(e=>({id:e.id, value:e.value, min:e.min,max:e.max})));
  const before=await sliders();
  if(before.length){
   await page.waitForFunction(previous=>{
    const next=[...document.querySelectorAll('#japan-layer input[type="range"]')].filter(e=>e.checkVisibility()&&!e.disabled).map(e=>({id:e.id,value:e.value,min:e.min,max:e.max}));
    return JSON.stringify(next)!==JSON.stringify(previous);
   },before,{timeout:15000});
   report.at(-1).sliders={before,after:await sliders()};
  }
  if(n===21){
   const first=await page.evaluate(()=>GaiaEstatExhibits.getState().periodIndex);
   await page.waitForFunction(first=>GaiaEstatExhibits.getState().periodIndex!==first,first);
  }
  if(width<900)await page.locator('[data-mobile-sheet="tools"]').click();
  assert.equal(await page.locator('[data-mobile-transport="gaia-map-demo-toggle"]').count(),0);
  const control=page.locator(width<900?'[data-mobile-transport="gaia-map-playback-toggle"]':'#gaia-map-playback-toggle');
  assert((await control.textContent()).includes('自動表示をやめる'));
  await control.click();
  await page.waitForFunction(()=>!GaiaMapPlayback.getState().requested&&!GaiaMapPlayback.getState().playing);
  assert((await page.locator('#gaia-map-playback-toggle').textContent()).includes('自動表示する'));
  if(n===9){const stopped=await sliders();await page.waitForTimeout(4500);assert.deepEqual(await sliders(),stopped,'09 slider must stay stopped');}
  console.log(`PASS ${width}/${n}: default on, manual stop`);
 }
 await page.screenshot({path:`${out}/${width}.png`});await page.close();
}fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}finally{await browser.close();}
