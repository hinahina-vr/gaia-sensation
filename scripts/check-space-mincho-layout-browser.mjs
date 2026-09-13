import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before'),base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(`artifacts/mincho-ui-20260912/space-layout-${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,checks:[],errors:[],scope:'Local Chrome, scene API initialization then native mode selection, scroll and source buttons. Before removes only the new layout rule; final Mincho fonts are retained in both runs.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const [width,height] of before?[[1440,900]]:[[1440,900],[1024,768],[1920,1080],[1440,480]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
  if(before)await context.route('**/space-mode.css?*',r=>r.fulfill({contentType:'text/css',body:fs.readFileSync('space-mode.css','utf8').replace(/\/\* Keep the title and readable Mincho copy[\s\S]*?(?=\.space-canvas,)/,'')}));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/#top',{waitUntil:'domcontentloaded'});await page.locator('#gaia-boot').waitFor({state:'hidden'});
  await page.evaluate(async()=>{await GaiaModeLoader.load('space');document.querySelector('#gaia-opening').hidden=true;document.body.classList.remove('gaia-opening-active');await GaiaSpace.open(0);});
  await page.locator('#space-layer:not([hidden])').waitFor();
  for(let n=0;n<(before?1:10);n++){
    await page.locator('.space-mode-option').nth(n).click();await page.waitForTimeout(140);
    const scan=await page.evaluate(()=>{const h=document.querySelector('.space-header'),r=document.querySelector('.space-readout');return {heading:h.getBoundingClientRect().toJSON(),reading:r.getBoundingClientRect().toJSON(),scrollHeight:r.scrollHeight,clientHeight:r.clientHeight,overflowX:r.scrollWidth-r.clientWidth,bodyOverflow:document.documentElement.scrollWidth-innerWidth};});
    report.checks.push({width,height,n,...scan});
    if(before)assert(scan.reading.top<scan.heading.bottom,'Reproduce the overlapping reading/title rows');
    else {assert(scan.reading.top>=scan.heading.bottom+20,`${width}/${n}: header overlap`);assert(scan.reading.bottom<=height&&scan.reading.height>=80);assert.equal(scan.overflowX,0);assert.equal(scan.bodyOverflow,0);}
    if(n===0)await page.screenshot({path:path.join(output,`${width}x${height}-top.png`)});
    if(!before&&scan.scrollHeight>scan.clientHeight){await page.locator('.space-readout').hover();await page.mouse.wheel(0,10000);await page.waitForTimeout(200);assert(await page.locator('.space-readout').evaluate(e=>e.scrollTop+e.clientHeight>=e.scrollHeight-2));}
    if(!before&&n===0)await page.screenshot({path:path.join(output,`${width}x${height}-bottom.png`)});
  }
  if(!before){await page.locator('#space-data-button').click();await page.locator('#space-data-panel').waitFor();await page.locator('#space-data-close').click();await page.locator('#space-data-panel').waitFor({state:'hidden'});}
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await context.close();console.log(`${before?'BASELINE':'PASS'} ${width}x${height}`);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;throw e;}
finally{report.hashes=Object.fromEntries(['space-mode.css','typography.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
