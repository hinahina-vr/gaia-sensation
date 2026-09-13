import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before'),base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/map-theme-background-20260912/compact-food-${before?'before':'final'}`);fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,checks:[],errors:[],scope:'Local Chrome and original repository food data, production CSP; emulated viewports, not physical devices or production.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const measure=()=>page.evaluate(()=>{
 const legend=document.querySelector('.gaia-food-legend'),readout=document.querySelector('.gaia-food-readout'),a=legend.getBoundingClientRect(),b=readout.getBoundingClientRect();
 const layer=document.querySelector('#japan-layer');
 return {legend:a.toJSON(),readout:b.toJSON(),overlap:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)),legendClientHeight:legend.clientHeight,legendScrollHeight:legend.scrollHeight,overflowY:getComputedStyle(legend).overflowY,poiBottom:getComputedStyle(layer).getPropertyValue('--mobile-poi-bottom'),headingBottom:getComputedStyle(layer).getPropertyValue('--mobile-heading-bottom')};
});
try{
 for(const [width,height] of (before?[[320,568]]:[[320,568],[390,568],[390,844],[844,390],[1440,900]])){
  const mobile=width<=900,ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?exhibit=70#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.evaluate(()=>GaiaMapDemo.stop());
  for(const number of before?[71]:[70,71]){
   await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),number);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&GaiaFoodExhibits.getState().dataState==='ready'&&document.querySelector('#gaia-food-canvas').dataset.foodArrivalState==='complete'&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),number);await page.waitForTimeout(200);
   const current=await measure();
   if(before){
    assert(current.overlap>0);await page.screenshot({path:path.join(output,'with-background.png')});
    await page.evaluate(()=>{GaiaMapThemeBackground.dispose();document.querySelectorAll('.gaia-theme-background-note').forEach(e=>e.remove());});await page.waitForTimeout(150);
    const without=await measure();assert.equal(current.overlap,without.overlap);assert.deepEqual(current.legend,without.legend);assert.deepEqual(current.readout,without.readout);
    await page.screenshot({path:path.join(output,'without-background.png')});report.checks.push({width,height,number,current,without});
   }else{
    assert.equal(current.overlap,0,`${width}x${height}/${number}: legend/readout collision`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
    if(current.legendScrollHeight>current.legendClientHeight+1){
     assert(['auto','scroll'].includes(current.overflowY));
     const cdp=await ctx.newCDPSession(page),x=current.legend.x+current.legend.width/2,y=current.legend.bottom-14;
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
     for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*7}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await page.waitForFunction(()=>document.querySelector('.gaia-food-legend').scrollTop>0);
     await page.locator('.gaia-food-legend').evaluate(e=>{e.scrollTop=0;});
    }
    if(mobile){await page.locator('[data-mobile-sheet="reading"]').click();assert((await page.locator('#map-mobile-sheet').innerText()).includes('背景の流れ・模様'));await page.locator('[data-mobile-sheet-close]').click();}
    await page.selectOption('[data-food-country]','392');assert.equal(await page.evaluate(()=>GaiaFoodExhibits.getState().selectedId),'392');
    await page.screenshot({path:path.join(output,`${width}x${height}-${number}.png`)});report.checks.push({width,height,number,...current});
   }
   console.log('PASS',width,height,number,before?'existing overlap unchanged without background':'no overlap and full reading access');
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{report.hashes=Object.fromEntries(['food-exhibits.css','map-theme-background.css','src/exploration/map-theme-background.js','gaia-mode-loader.js','index.html'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
