import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const out=path.resolve(process.env.GAIA_MAP75_OUT||'artifacts/map75-boundary');
fs.mkdirSync(out,{recursive:true});
const report={scope:'Installed Chrome, real local map; mobile is touch emulation',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<901,isMobile:width<901,reducedMotion:'reduce'});
  await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  const settled=n=>page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&GaiaMapPlayback.getState().ready&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'),n);
  await page.goto(process.env.GAIA_BASE_URL+'/world.html#world-75');await settled(75);await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
  const scope=await page.evaluate(()=>({numbers:GaiaMapCategories.definitions?.flatMap(d=>d.numbers),count:GaiaMapCategories.exhibitCount,definitions:GaiaClimateHistory.definitions.map(d=>Number(d.number)),future:GaiaMapRoute.numberFromHash('#world-76')}));
  assert.equal(scope.count,75);assert.deepEqual(scope.definitions,[72,73,74,75]);assert.equal(scope.future,null);
  const heading=page.locator('.japan-heading').filter({has:page.locator('#japan-title')});
  assert.match(await heading.evaluate(e=>getComputedStyle(e).filter),/drop-shadow/);
  await page.locator('[data-map-stable-step="1"]').click();await settled(1);
  await page.locator('[data-map-stable-step="-1"]').click();await settled(75);
  await page.locator('[data-map-stable-step="-1"]').click();await settled(74);
  await page.locator('[data-map-stable-step="1"]').click();await settled(75);
  await page.screenshot({path:path.join(out,width+'-75.png')});
  report.checks.push({width,height,count:75,route:'75 -> 01 -> 75 -> 74 -> 75',headingShadow:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=e.stack;throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
