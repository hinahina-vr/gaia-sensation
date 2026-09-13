import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/food-dock-match';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,1100,2560,390]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=69#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 let reference;
 for(const n of [69,70,71]){
  if(n!==69)await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
  await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
  const dock=page.locator(n===69?'.gaia-marine-cod-readout':'.gaia-food-readout');
  const box=await dock.boundingBox();const style=await dock.evaluate(e=>({background:getComputedStyle(e).backgroundImage,overflow:e.scrollWidth>e.clientWidth}));
  if(n===69)reference={box,style};else{
   assert(Math.abs(box.x-reference.box.x)<1);assert(Math.abs(box.width-reference.box.width)<1);
   if(width>900)assert(Math.abs(box.height-reference.box.height)<2,JSON.stringify({width,n,box,reference}));
   assert.equal(style.background,reference.style.background);assert(!style.overflow);
   assert.equal(await dock.locator('select').count(),2);
  }
  await page.screenshot({path:`${out}/${width}-${n}.png`});console.log('PASS',width,n,box);
 }await page.close();
}}finally{await browser.close();}
