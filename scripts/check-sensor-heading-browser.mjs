import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/sensor-heading-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,582,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.goto('http://127.0.0.1:4492/sensors/#map');
 const close=page.locator('[data-feature-close]');await close.waitFor({state:'visible'});await close.click();await close.waitFor({state:'hidden'});
 const scan=await page.locator('#map .sensor-page-head h1').evaluate(h=>{
  const r=document.createRange();r.selectNodeContents(h);const rows=[...r.getClientRects()];
  return {rows:rows.length,right:Math.max(...rows.map(r=>r.right)),overflow:h.scrollWidth-h.clientWidth,border:getComputedStyle(h.parentElement).borderLeftWidth};
 });
 assert.equal(scan.rows,1);assert.equal(scan.border,'0px');assert(scan.right<=width);assert(scan.overflow<=1,JSON.stringify(scan));
 await page.screenshot({path:`${out}/${width}.png`});console.log(width,scan);await page.close();
}}finally{await browser.close();}
