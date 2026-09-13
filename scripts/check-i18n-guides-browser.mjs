import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/guides';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Real local UI in Chrome; desktop/touch emulation. Sensor API is an unauthenticated empty read-only fixture, not production or hardware.',checks:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try {
 for(const width of [1440,390])for(const language of ['en','zh-CN']) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  await context.route('**/api/web/v1/session',r=>r.fulfill({status:401,json:{error:{code:'UNAUTHENTICATED'}}}));
  for(const [path,json]of [['measurement-types',{categories:[],measurements:[]}],['sensors',{sensors:[]}]])await context.route(`**/api/public/v1/${path}`,r=>r.fulfill({json}));
  await context.route('**/api/web/v1/countries',r=>r.fulfill({json:{countries:[]}}));
  page=await context.newPage();
  for(const mode of ['map','sensor']) {
   await page.goto(`http://127.0.0.1:4492/${mode==='map'?'#world-26':'sensors/#map'}`);
   if(mode==='map') {
    await page.waitForFunction(()=>window.GaiaMapPlayback?.getState().ready);
    await page.evaluate(()=>GaiaMapPlayback.stop());
    if(width===390) {
     await page.locator('[data-mobile-sheet="tools"]').click();
     await page.locator('[data-mobile-guide]').click();
    } else await page.locator('[data-gaia-mode-guide-replay="map"]').click();
   }
   await page.locator('#gaia-mode-entry-guide[data-phase="features"].is-feature-ready').waitFor({timeout:30000});
   await page.waitForTimeout(400);
   const scan=await page.locator('.gaia-feature-intro').evaluate(el=>({text:el.textContent,images:[...el.querySelectorAll('img')].map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0})),width:el.clientWidth,scrollWidth:el.scrollWidth}));
   assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(scan.text),`${mode}/${language}: Japanese remains: ${scan.text}`);
   assert(scan.images.every(i=>i.loaded),'Guide artwork must load unchanged');
   assert(scan.scrollWidth<=scan.width+1,'Guide overflows horizontally');
   await page.screenshot({path:`${out}/${width}-${language}-${mode}.png`});
   await page.locator('[data-feature-start]').click();
   await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
   report.checks.push({viewportWidth:width,language,mode,...scan});
  }
  await context.close();
 }
 report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
