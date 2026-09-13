import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before'),base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/map-stable-next-20260912/${before?'before':'after'}`);fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,checks:[],errors:[],scope:'Local installed Chrome, original repository observations and FIRMS snapshot fixture, production CSP. Emulated viewport/touch, not production or physical devices.'};
report.sha256=Object.fromEntries(['map-stable-navigation.js','map-stable-navigation.css','realtime-exhibits.css','gaia-mode-loader.js','index.html'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const arrowSelector='[data-map-dock-mode-step="1"],[data-live-deck-step="1"],[data-estat-step="1"],[data-firms-step="1"],[data-planet-step="1"],[data-cod-step="1"],[data-food-step="1"]';
const numbers=process.env.QA_NUMBERS?.split(',').map(Number)||(before?[1,2,6,15,20,21,22,24,30,31,38,65,68,69,70,71]:Array.from({length:71},(_,i)=>i+1));
try{
 for(const [width,height] of (process.env.QA_VIEWPORTS||'1440x900,3840x2160,901x900').split(',').map(v=>v.split('x').map(Number))){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:width<=900,hasTouch:width<=900,reducedMotion:'reduce'});await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());await ctx.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?exhibit=21#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.evaluate(()=>GaiaMapDemo.stop());
  for(const number of numbers){
   await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),number);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),number);
   await page.evaluate(()=>document.fonts.ready);
   const scan=await page.evaluate(selector=>{
    const visible=e=>e.checkVisibility({visibilityProperty:true})&&e.getBoundingClientRect().width>0;
    const arrows=[...document.querySelectorAll(selector)].filter(visible);
    return {overflow:document.documentElement.scrollWidth-innerWidth,arrows:arrows.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),chapter=e.closest('.gaia-estat-chapter,.gaia-firms-chapter,.gaia-planet-chapter,.gaia-marine-cod-chapter,.gaia-live-deck-chapter,.gaia-food-chapter,.map-mode-bank');return {rect:r.toJSON(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),position:s.position,left:s.left,top:s.top,transform:s.transform,chapter:chapter?.getBoundingClientRect().toJSON(),chapterText:chapter?.textContent.trim().slice(0,120),parentClass:e.parentElement.className};})};
   },before?arrowSelector:'[data-map-stable-step="1"]');
   assert.equal(scan.arrows.length,1,`${width}/${number}: one visible next button`);assert.equal(scan.overflow,0);
   report.checks.push({width,height,number,...scan});
   if([21,22,65,70].includes(number))await page.screenshot({path:path.join(output,`${width}-${number}.png`)});
  }
  const entries=report.checks.filter(c=>c.width===width),xs=entries.map(c=>c.arrows[0].rect.x),ys=entries.map(c=>c.arrows[0].rect.y);
  const spread={x:Math.max(...xs)-Math.min(...xs),y:Math.max(...ys)-Math.min(...ys)};console.log('POSITIONS',width,JSON.stringify(spread));
  // The navigation now sits above the actual observation dock, so its resting
  // height follows that dock. Continuous taps still hold their native target;
  // that stricter interaction invariant is covered by the companion test.
  if(!before){assert(spread.x<1,`Next button must stay left-aligned ${JSON.stringify(spread)}`);assert(entries.every(c=>c.arrows[0].hit),'Native next button is not covered');assert(entries.every(c=>c.arrows[0].rect.top>=0&&c.arrows[0].rect.bottom<=height),'Navigation stays inside the viewport');}
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.status=before?'recorded':'passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
