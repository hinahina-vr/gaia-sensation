import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const probe=process.argv.includes('--before');
const out='artifacts/mobile-zoom-centering-20260913';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage();await page.route('https://**',r=>r.abort());
 const results=[];
 for(const [width,height] of [[390,844],[320,568],[768,1024],[844,390]]) {
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4492/#world-01');
  await page.locator('#gaia-boot').waitFor({state:'hidden'});
  const nav=page.locator('#gaia-map-zoom-controls');await nav.waitFor({state:'visible'});await page.waitForTimeout(1000);
  const measure=()=>nav.evaluate(n=>{const p=n.getBoundingClientRect();return [...n.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect(),s=[...b.querySelectorAll('svg')].find(s=>s.getClientRects().length)?.getBoundingClientRect();return {id:b.id,width:r.width,height:r.height,buttonOffset:r.x+r.width/2-p.x-p.width/2,iconOffset:s?s.x+s.width/2-p.x-p.width/2:null};});});
  const values=await measure();results.push({width,height,values});
  await page.screenshot({path:`${out}/${probe?'before':'after'}-${width}.png`});
  if(!probe) {
   for(const v of values){assert(Math.abs(v.buttonOffset)<1);assert(Math.abs(v.iconOffset)<1);assert(v.width>=44&&v.height>=44);}
   await page.locator('#gaia-map-zoom-in').click();await page.locator('#gaia-map-zoom-out').click();
   const reset=page.locator('#gaia-map-zoom-reset');if(await reset.isVisible())await reset.click();
  }
 }
 fs.writeFileSync(`${out}/${probe?'before':'after'}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
} finally {await browser.close();}
