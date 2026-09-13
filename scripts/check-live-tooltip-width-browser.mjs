import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/live-tooltip-width';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,2560,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=18#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
 await page.evaluate(()=>GaiaMapPlayback.stop());
 await page.locator('[data-live-prefecture="01"]').focus();
 const tip=page.locator('.gaia-live-region-tooltip');await tip.waitFor({state:'visible'});
 const scan=await tip.evaluate(e=>{
  const rect=e.getBoundingClientRect();
  const b=e.querySelector('b'),range=document.createRange();range.selectNodeContents(b);
  return {width:rect.width,left:rect.left,right:rect.right,overflow:e.scrollWidth>e.clientWidth,lines:range.getClientRects().length,text:b.textContent};
 });
 assert(!scan.overflow);assert(scan.left>=0&&scan.right<=width);assert.equal(scan.lines,1,JSON.stringify(scan));
 await tip.screenshot({path:`${out}/${width}.png`});console.log('PASS',width,scan);await page.close();
}}finally{await browser.close();}
