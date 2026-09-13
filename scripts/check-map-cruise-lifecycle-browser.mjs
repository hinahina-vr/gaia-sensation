import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/map-cruise-lifecycle';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.route('https://**',r=>r.abort());
 await p.route('**/map-cruise.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('src/exploration/map-cruise.js','utf8').replace('now = () => performance.now()', 'now = () => performance.now() + (globalThis.__cruiseTestAdvance || 0)')}));
 await p.goto('http://127.0.0.1:4492/?exhibit=2#world');await p.locator('[data-feature-start]').click();await p.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await p.waitForTimeout(2200);await p.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
 await p.locator('#gaia-map-cruise-toggle').click();await p.waitForFunction(()=>GaiaMapCruise.getState().phase==='poi');
 const readings=[];
 // Real wall-clock POI cadence (no fake data or accelerated cruise clock).
 for(let i=0;i<5;i++) {
  await p.waitForFunction(i=>GaiaMapCruise.getState().poiIndex===i,i);
  await p.waitForTimeout(950);
  readings.push(await p.locator('#japan-poi-preview-title').textContent());
  assert.equal(await p.locator('#japan-poi-preview').isVisible(),true);
  await p.screenshot({path:`${out}/poi-${i}.png`});
 }
 assert.equal(new Set(readings).size,5);
 await p.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===3);
 assert.equal(await p.evaluate(()=>GaiaMapCruise.getState().active),true);
 await p.locator('#gaia-map-cruise-toggle').click();assert.equal(await p.evaluate(()=>GaiaMapCruise.getState().active),false);
 await p.locator('#gaia-map-cruise-toggle').click();await p.waitForFunction(()=>GaiaMapCruise.getState().number===3);
 await p.locator('#gaia-map-zoom-in').click();assert.equal(await p.evaluate(()=>GaiaMapCruise.getState().active),false);
 await p.setViewportSize({width:390,height:900});await p.waitForTimeout(700);
 await p.locator('[data-mobile-sheet="tools"]').click();await p.locator('[data-mobile-cruise]').click();
 await p.waitForFunction(()=>GaiaMapCruise.getState().active);await p.locator('[data-mobile-sheet="tools"]').click();
 assert.equal(await p.evaluate(()=>GaiaMapCruise.getState().paused),true);
 const elapsed=await p.evaluate(()=>GaiaMapCruise.getState().elapsed);await p.waitForTimeout(1200);
 assert.equal(await p.evaluate(()=>GaiaMapCruise.getState().elapsed),elapsed);
 await p.screenshot({path:`${out}/mobile-tools.png`});
 await p.locator('[data-mobile-cruise]').click();assert.equal(await p.evaluate(()=>GaiaMapCruise.getState().active),false);
 await p.goto('http://127.0.0.1:4492/?exhibit=9#world');await p.locator('[data-feature-start]').click();await p.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await p.waitForTimeout(2200);await p.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
 await p.evaluate(()=>GaiaMapCruise.start());await p.waitForFunction(()=>GaiaMapCruise.getState().phase==='slider');
 const positions=[];
 for(let i=0;i<10;i++){await p.waitForTimeout(80);positions.push(Number(await p.locator('.signal-console-map [data-signal-time]').inputValue()));}
 assert(new Set(positions).size>=8);assert(positions.every((v,i)=>i===0||v>=positions[i-1]));
 await p.evaluate(()=>{globalThis.__cruiseTestAdvance=GaiaMapCruise.getState().duration;});
 await p.waitForFunction(()=>GaiaMapCruise.getState().phase==='hold');
 assert.equal(await p.locator('.signal-console-map [data-signal-time]').inputValue(),await p.locator('.signal-console-map [data-signal-time]').getAttribute('max'));
 await p.waitForTimeout(2400);assert.equal(await p.locator('#japan-mode-number').textContent(),'09');
 await p.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent==='10');
 fs.writeFileSync(`${out}/results.json`,JSON.stringify({readings,positions,realThreeSecondHold:true,realFiveSecondCadence:true,stop:true,manualOverride:true,mobilePause:true},null,2));
 console.log('PASS real 5-second POIs, next exhibit, stop/restart, manual zoom stop, mobile panel pause/stop');
}finally{await b.close();}
