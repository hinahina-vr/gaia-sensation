import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/map-initial-view-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=30#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 const settle=async n=>{
  await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
  await page.waitForTimeout(900);
  return page.locator('#japan-overlay').evaluate(e=>[e.dataset.earthZoom,e.dataset.earthOffsetX,e.dataset.earthOffsetY].map(Number));
 };
 const reference=await settle(30);
 for(const n of [31,38,44,55,65,69,70,71]){
  await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
  const camera=await settle(n);
  camera.forEach((v,i)=>assert(Math.abs(v-reference[i])<.02,`${width}/${n}: ${camera} != ${reference}`));
  report.push({width,n,reference,camera});
  if([31,70].includes(n))await page.screenshot({path:`${out}/${width}-${n}.png`});
  console.log('PASS',width,n);
 }await page.close();
}fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}finally{await browser.close();}
