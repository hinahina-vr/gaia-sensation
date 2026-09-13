import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('artifacts/guide-glint-focus',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){for(const route of ['sensors/#map','#earth']){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.goto('http://127.0.0.1:4492/'+route);
 if(route==='#earth')await page.locator('[data-entry-title-skip]').click();
 const start=page.locator('[data-feature-start]');await start.waitFor({state:'visible'});
 for(const selector of ['[data-feature-guide]','[data-feature-start]']){
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.locator(selector).evaluate(b=>{b.blur();b.focus();});
  const scan=await page.locator(selector).evaluate(b=>({name:getComputedStyle(b,'::after').animationName,duration:getComputedStyle(b,'::after').animationDuration}));
  assert.equal(scan.name,'gaia-feature-focus-glint');assert.equal(scan.duration,'0.5s');
  await page.waitForTimeout(550);
  assert.equal(await page.locator(selector).evaluate(b=>getComputedStyle(b,'::after').opacity),'0');
  await page.locator(selector).hover();
  await page.locator(selector).evaluate(b=>{b.blur();b.focus();});
  const middle=await page.locator(selector).evaluate(b=>{
   const a=b.getAnimations({subtree:true}).find(a=>a.animationName==='gaia-feature-focus-glint');
   a.pause();a.currentTime=250;
   return {opacity:Number(getComputedStyle(b,'::after').opacity),duration:a.effect.getTiming().duration};
  });
  assert(middle.opacity>.8);assert.equal(middle.duration,500);
  if(selector==='[data-feature-start]')await page.locator(selector).screenshot({path:`artifacts/guide-glint-focus/${width}-${route==='#earth'?'map':'sensor'}.png`,animations:'allow'});
 }
 console.log(`PASS ${width}: both guide buttons focus glint 500ms and finish`);await page.close();
}}}finally{await browser.close();}
