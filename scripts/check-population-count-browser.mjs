import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
fs.mkdirSync('artifacts/population-count',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/?exhibit=14#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
 await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaMapObservationAdapter.setTimelinePosition?.(40);});
 const values=await page.evaluate(async()=>{
  const range=[...document.querySelectorAll('#japan-layer input[type=range]')].find(e=>e.checkVisibility());
  range.value='30';range.dispatchEvent(new Event('input',{bubbles:true}));
  const result=[];
  for(let i=0;i<12;i++){result.push(document.querySelector('.signal-console-map .signal-value-primary > span')?.textContent);await new Promise(r=>setTimeout(r,100));}
  return result;
 });
 assert(new Set(values).size>3,JSON.stringify(values));
 assert(values.every(v=>/^[\d,]+$/.test(v)),JSON.stringify(values));assert.deepEqual(errors,[]);
 await page.screenshot({path:`artifacts/population-count/${width}.png`});
 fs.writeFileSync(`artifacts/population-count/${width}.json`,JSON.stringify(values));
 console.log('PASS',width);await page.close();
}}finally{await browser.close();}
