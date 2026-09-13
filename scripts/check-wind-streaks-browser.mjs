import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/wind-streaks-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/?exhibit=2#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 const canvas=page.locator('#gaia-planet-atmosphere-canvas');
 await page.waitForFunction(()=>document.querySelector('#gaia-planet-atmosphere-canvas')?.dataset.fieldState==='ready');
 await page.waitForTimeout(1800);
 assert.equal(await canvas.getAttribute('data-wind-style'),'directional-wind-streaks');
 const first=await canvas.screenshot();await page.waitForTimeout(1000);const second=await canvas.screenshot();
 assert(!first.equals(second),'Wind must move');assert(await canvas.isVisible());
 await page.screenshot({path:`${out}/${width}.png`});assert.deepEqual(errors,[]);
 await page.close();console.log(`PASS ${width}`);
}}finally{await browser.close();}
