import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/sensor-brand-align-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1920,1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.goto('http://127.0.0.1:4492/sensors/#map');
 await page.waitForTimeout(800);
 const close=page.locator('[data-feature-close]');await close.waitFor({state:'visible'});await close.click();await close.waitFor({state:'hidden'});
 const scan=await page.evaluate(()=>{
  const brand=document.querySelector('.sensor-map-brand'),back=document.querySelector('.sensor-home-back');
  const b=brand.getBoundingClientRect(),r=back.getBoundingClientRect();
  const range=document.createRange();range.selectNodeContents(brand);const t=range.getBoundingClientRect();
  return {visible:b.width>0,delta:Math.abs((b.top+b.bottom-r.top-r.bottom)/2),textDelta:Math.abs((t.top+t.bottom-r.top-r.bottom)/2)};
 });
 if(width>1400){assert(scan.visible);assert(scan.delta<1,JSON.stringify(scan));assert(scan.textDelta<5,JSON.stringify(scan));}
 else assert(!scan.visible);
 await page.screenshot({path:`${out}/${width}.png`});console.log(width,scan);await page.close();
}}finally{await browser.close();}
