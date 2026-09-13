import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('artifacts/smooth-slider',{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=7#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
 const values=await page.evaluate(async()=>{
  const input=[...document.querySelectorAll('[data-signal-time]')].find(e=>e.checkVisibility());
  const samples=[];for(let i=0;i<25;i++){samples.push(Number(input.value));await new Promise(r=>setTimeout(r,40));}return samples;
 });
 assert(new Set(values).size>=18,JSON.stringify(values));
 assert(values.some(v=>!Number.isInteger(v)));
 for(let i=1;i<values.length;i++)assert(values[i]>=values[i-1]&&values[i]-values[i-1]<1);
 await page.evaluate(()=>GaiaMapPlayback.stop());
 const held=await page.locator('[data-signal-time]').first().inputValue();await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-signal-time]').first().inputValue(),held);
 fs.writeFileSync(`artifacts/smooth-slider/${width}.json`,JSON.stringify(values));
 await page.screenshot({path:`artifacts/smooth-slider/${width}.png`});console.log('PASS',width);await page.close();
}}finally{await browser.close();}
