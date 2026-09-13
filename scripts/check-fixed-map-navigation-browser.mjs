import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out=process.env.GAIA_OUTPUT_DIR||'artifacts/fixed-nav-ui-20260913';fs.mkdirSync(out,{recursive:true});
const report={status:'running',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of (process.env.QA_WIDTHS||'1440,390,1024,2560').split(',').map(Number)){
  const height=width===390?844:width===2560?1440:900;
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<=900});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:4492/#world-15');
  await page.waitForFunction(()=>globalThis.GaiaMapCategories?.buttons().length===71&&globalThis.GaiaMapPlayback?.getState().ready);
  const nav=page.locator('#map-stable-navigation'),menu=page.locator('[data-map-menu-toggle]');
  const origin=await nav.boundingBox();assert(origin.y<150);
  const numbers=process.env.QA_ALL==='1'&&width===1440?Array.from({length:71},(_,i)=>i+1):[15,1,2,8,12,21,27,31,56,70];
  for(const n of numbers){
   await page.evaluate(n=>location.hash='#world-'+String(n).padStart(2,'0'),n);
   for(let i=0;i<4;i++){await page.waitForTimeout(70);const box=await nav.boundingBox();assert(box&&Math.abs(box.y-origin.y)<.1&&Math.abs(box.x-origin.x)<.1,'No jump during transition');}
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&GaiaMapPlayback.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n,{timeout:45000});
   await page.mouse.move(width-2,height/2);
   const selector=n===1?'.gaia-firms-readout':n<=5?'.gaia-planet-signals-readout':n<=14?'.map-command-dock':n<=20?'.gaia-live-exhibit-readout':n<=30?'.gaia-estat-readout':n<=69?'.gaia-marine-cod-readout':'.gaia-food-readout';
   const state=await page.evaluate(selector=>{
    const el=document.querySelector(selector),r=el.getBoundingClientRect();
    return {dock:r.toJSON(),visible:el.checkVisibility({visibilityProperty:true}),overflow:document.documentElement.scrollWidth-innerWidth,
     actions:[...document.querySelectorAll('#map-stable-navigation button')].map(b=>{const r=b.getBoundingClientRect();return {rect:r.toJSON(),hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}),
     dockActions:[...el.querySelectorAll('.gaia-map-action,.map-dock-action')].filter(b=>b.checkVisibility({visibilityProperty:true})).map(b=>{const r=b.getBoundingClientRect();return {rect:r.toJSON(),hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})};
   },selector);
   assert.equal(state.overflow,0,`${width}/${n} horizontal overflow`);assert(state.actions.every(a=>a.hit),`${width}/${n} navigation clickable`);
   if(width<=900){const heading=await page.locator('.japan-heading').boundingBox();if(heading?.height)assert(heading.y>=origin.y+origin.height,`${width}/${n} title clears fixed buttons`);}
   assert(state.dockActions.every(a=>a.hit&&a.rect.top>=0&&a.rect.bottom<=height),`${width}/${n} source and analysis stay usable`);
   if(width>900&&state.visible){assert(Math.abs(state.dock.left-origin.x)<.1,`${width}/${n} navigation left edge matches dock`);assert.equal(state.dock.height,width<=1200?161:width>=2400?124:100,`${width}/${n} matches 15 height`);assert.equal(state.dock.bottom,height);}
   report.checks.push({width,n,...state});
   if([15,1,8,21,31,56,70].includes(n))await page.screenshot({path:`${out}/${width}-${n}.png`});
  }
  if(width>900)await menu.hover();else await menu.tap();
  const picker=page.locator(width>900?'#map-dock-bank-popover':'#map-mobile-sheet');await picker.waitFor({state:'visible'});
  await picker.locator('[role="tab"][data-map-scope="japan"]').click();await page.waitForTimeout(1400);
  const rect=await picker.boundingBox();assert(rect.y>=0&&rect.y+rect.height<=height);await picker.screenshot({path:`${out}/${width}-menu.png`});
  const tile=width>900?picker.locator('.map-mode-button').filter({hasText:/^27$/}):picker.locator('[data-mobile-exhibit="27"]');await tile.click();await picker.waitFor({state:'hidden'});
  await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===27);
  if(width>900){await page.locator('.map-dock-context > summary').click();await page.locator('.map-dock-context[open] .gaia-estat-copy').waitFor({state:'visible'});await page.screenshot({path:`${out}/${width}-explanation.png`});}
  await context.close();console.log('PASS',width,numbers.length);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,failure:report.failure}));}
