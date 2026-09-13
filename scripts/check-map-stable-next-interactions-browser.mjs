import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492',before=process.argv.includes('--before');
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/map-stable-next-20260912/${before?'before-interactions':'interactions'}`);fs.mkdirSync(output,{recursive:true});
const report={status:'running',checks:[],errors:[],scope:'Installed local Chrome, normal motion, native fixed-coordinate mouse/touch and keyboard; bundled data with FIRMS snapshot fixture. Not production or physical devices.',sha256:Object.fromEntries(['map-stable-navigation.js','map-stable-navigation.css','gaia-mode-loader.js','index.html'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const readNumber=()=>page.locator('#japan-mode-number').textContent().then(Number);
const select=async n=>{await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);};
const wrap=n=>(n+70)%71+1;
try{
 for(const width of before?[1440]:(process.env.QA_WIDTHS||'1440,901,390,844').split(',').map(Number)){
  const mobile=width<=900,height=width===844?390:900;
  const ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,reducedMotion:'no-preference'});await enforceBrowserSecurity(ctx,base);
  await ctx.route('https://**',r=>r.abort());await ctx.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  if(before){await ctx.route('**/map-stable-navigation.js*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await ctx.route('**/map-stable-navigation.css*',r=>r.fulfill({body:'',contentType:'text/css'}));}
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?exhibit=21#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.evaluate(()=>GaiaMapDemo.stop());await select(21);
  const selector=direction=>before?`[data-estat-step="${direction}"]`:`[data-map-stable-step="${direction}"]`;
  const burst=async(start,direction,count)=>{
   await select(start);const sel=selector(direction),button=page.locator(sel);const r=await button.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
   await page.evaluate(sel=>{globalThis.__stableNode=document.querySelector(sel);globalThis.__stableSamples=[];globalThis.__sampleStable=true;const frame=()=>{if(!__sampleStable)return;const e=__stableNode,r=e.getBoundingClientRect();__stableSamples.push({x:r.x,y:r.y,connected:e.isConnected,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});requestAnimationFrame(frame);};document.addEventListener('pointerdown',()=>requestAnimationFrame(frame),{once:true,capture:true});},sel);
   const requests=[];
   for(let i=1;i<=count;i++){
    // Never relocate between clicks: this reproduces the owner's repeated tapping.
    if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
    if(!mobile&&!before){const state=await page.evaluate(()=>GaiaMapStableNavigation.getState());requests.push(state.requested);assert.equal(state.requested,wrap(start+direction*i),`native click ${i} at ${x},${y}`);}
    await page.waitForTimeout(65);
   }
   const expected=wrap(start+direction*count);
   if(!before)await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),expected);
   else await page.waitForTimeout(600);
   const samples=await page.evaluate(()=>{__sampleStable=false;return __stableSamples;});
   const actual=await readNumber(),spread={x:Math.max(...samples.map(s=>s.x))-Math.min(...samples.map(s=>s.x)),y:Math.max(...samples.map(s=>s.y))-Math.min(...samples.map(s=>s.y))};
   if(!before){assert.equal(actual,expected);assert(samples.length>0);assert(spread.x<.1&&spread.y<.1,JSON.stringify(spread));assert(samples.every(s=>s.connected&&s.hit),'The original native hit target remains attached and uncovered throughout transitions');assert.equal(await button.evaluate(e=>e===__stableNode),true);}
   report.checks.push({width,start,direction,count,x,y,expected,actual,requests,spread,samples:samples.length,allHits:samples.every(s=>s.hit)});console.log('BURST',JSON.stringify(report.checks.at(-1)));
  };
  await burst(21,1,12);if(before){const check=report.checks.at(-1);assert(check.spread.x>1||check.spread.y>1,'Baseline reproduces moving/replaced arrow during repeated clicks');await ctx.close();continue;}
  await burst(33,-1,13);await burst(69,1,5);await burst(5,1,3);await burst(14,1,3);await burst(63,1,4);
  if(!mobile){
   await select(30);const next=page.locator(selector(1));await next.focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===32);assert.equal(await next.evaluate(e=>e===document.activeElement),true);report.checks.push({width,keyboard:'Enter/Space advances 30→32 and retains focus across providers'});
   await select(21);const toggle=page.locator('.gaia-estat-chapter [data-map-bank-toggle]');await toggle.click();await page.locator('#map-dock-bank-popover').waitFor({state:'visible'});await toggle.click();await page.locator('#map-dock-bank-popover').waitFor({state:'hidden'});
   await page.locator('button[data-estat-source-action]').click();await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();assert.equal(await next.isVisible(),false);await page.locator('#japan-data-close').click();await next.waitFor({state:'visible'});
   await page.locator('button[data-estat-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);assert.equal(await next.isVisible(),false);assert(Number(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count'))>0);await page.locator('#gaia-statistics-close').click();await next.waitFor({state:'visible'});
   report.checks.push({width,panels:'Native chapter menu, source, real statistics result, close/return; arrows hidden during blocking panels'});
   await page.setViewportSize({width:900,height:900});await next.waitFor({state:'visible'});await page.locator('[data-mobile-exhibit-step="1"]').waitFor({state:'hidden'});await page.setViewportSize({width,height});await next.waitFor({state:'visible'});await page.locator('[data-mobile-exhibit-step="1"]').waitFor({state:'hidden'});
  }
  await page.screenshot({path:path.join(output,`${width}.png`)});
  await page.locator('#japan-close').click();await page.waitForFunction(()=>document.querySelector('#japan-layer').getAttribute('aria-hidden')==='true');assert.equal(await page.locator('#map-stable-navigation').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.status=before?'reproduced':'passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
