import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,output=path.resolve('artifacts/data-explore-crash-20261014/stalled-compile');
fs.mkdirSync(output,{recursive:true});
const report={scope:'Actual installed Chrome, deliberately stalled initial shader completion; not a physical GPU failure',errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
await context.addInitScript(()=>{
  const stall=sessionStorage.getItem('gaiaQA:stalled-once')!=='1';
  const original=WebGL2RenderingContext.prototype.getProgramParameter;
  WebGL2RenderingContext.prototype.getProgramParameter=function(program,parameter){
    if(stall&&this.canvas.id==='gaia-canvas'&&parameter===0x91B1){sessionStorage.setItem('gaiaQA:stalled-once','1');return false;}
    return original.call(this,program,parameter);
  };
});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
try{
  await page.goto(`${base}/world`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.gaiaEntryReady==='true');
  await page.waitForTimeout(13000);
  assert(await page.locator('#gaia-boot').isVisible(),'The title timeout must not uncover an unready map');
  await page.locator('.gaia-map-entry-recovery button').waitFor({state:'visible',timeout:15000});
  await page.screenshot({path:path.join(output,'retry.png')});
  await page.locator('.gaia-map-entry-recovery button').click();
  await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true'&&document.querySelector('#japan-layer').getAttribute('aria-hidden')==='false',null,{timeout:45000});
  await page.locator('#gaia-boot').waitFor({state:'hidden'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true');
  await page.locator('#japan-close').click();await page.waitForURL(url=>url.pathname==='/'&&url.hash==='#top');
  await page.locator('#intro-path-stage').waitFor({state:'visible'});
  if(await page.locator('#intro-entry-guide').isVisible())await page.keyboard.press('Escape');
  await page.locator('#intro-character-jump').click();
  await page.locator('#character-book-layer').waitFor({state:'visible'});
  assert.deepEqual(report.errors,[]);report.status='passed';report.retry=true;report.menuCharacter=true;
}catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
