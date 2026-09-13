import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(`artifacts/map-title-no-underline-2026-09-10/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,checks:[],errors:[],sha256:{},environment:'Installed Chrome, real local data, saved NOAA/FIRMS and empty USGS responses, production CSP; emulated viewports, not physical devices.'};
for(const f of ['map-chapter-navigation.css','gaia-mode-loader.js','index.html'])report.sha256[f]=createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try{
  for(const [width,height] of before?[[1440,900]]:[[1440,900],[3840,2160],[390,844],[320,568]]){
    const mobile=width<=900;
    const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://services.swpc.noaa.gov/**',r=>r.fulfill({path:'data/ovation-aurora-snapshot.json',contentType:'application/json'}));
    await context.route('https://earthquake.usgs.gov/**',r=>r.fulfill({json:{type:'FeatureCollection',features:[]}}));
    await context.route('**/api/live/v1/firms',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(base+'/?exhibit=64#world',{waitUntil:'domcontentloaded'});
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    await page.locator('[data-feature-start]').click();
    await page.evaluate(()=>GaiaMapDemo.stop());
    await page.waitForFunction(()=>GaiaMapCategories.buttons().length===71);
    const numbers=before?[64]:mobile?[64,66,71]:width===1440?[64,31,38,44,55,65,66,69,70,71,1,2,3,4,5]:[64,66,71];
    for(const number of numbers){
      await page.evaluate(n=>GaiaMapCategories.buttons().find(b=>Number(b.textContent)===n).click(),number);
      await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),number);
      if(mobile){
        assert.equal(await page.locator('#japan-title').evaluate(e=>getComputedStyle(e).textDecorationLine),'none');
        await page.locator('[data-mobile-sheet="exhibits"]').tap();
        const scope=number>=70?'world':'japan';
        assert.equal(await page.locator(`#map-mobile-sheet [role="tab"][data-map-scope="${scope}"]`).getAttribute('aria-selected'),'true');
        const card=page.locator(`[data-mobile-exhibit="${number}"]`);
        assert.equal(await card.locator('.map-mobile-card-caption > b').evaluate(e=>getComputedStyle(e).textDecorationLine),'none');
        await card.tap();
        await page.locator('#map-mobile-sheet').waitFor({state:'hidden'});
        report.checks.push({width,number,check:'Mobile title and native exhibit menu remain usable without underlines'});
        if(number===64)await page.screenshot({path:path.join(output,`${width}-64.png`)});
        continue;
      }
      const toggle=page.locator('.gaia-featured-selector-toggle:visible').first();
      const title=toggle.locator('strong');
      await toggle.hover();
      const hover=await title.evaluate(e=>getComputedStyle(e).textDecorationLine);
      assert.equal(hover,before?'underline':'none');
      if(number===64)await toggle.screenshot({path:path.join(output,`${width}-64-hover.png`)});
      await page.mouse.move(width-1,1);
      await page.keyboard.press('Tab');await toggle.focus();
      const focus=await toggle.evaluate(e=>({visible:e.matches(':focus-visible'),outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth,decoration:getComputedStyle(e.querySelector('strong')).textDecorationLine}));
      assert(focus.visible&&focus.outline!=='none'&&parseFloat(focus.width)>=1,'Keep a real keyboard focus outline');
      if(!before)assert.equal(focus.decoration,'none');
      if(number===64)await toggle.screenshot({path:path.join(output,`${width}-64-focus.png`)});
      await toggle.press('Enter');
      await page.locator('.map-dock-bank-popover').waitFor({state:'visible'});
      await page.waitForFunction(()=>[...document.querySelectorAll('.gaia-featured-selector-toggle')].some(b=>b.getAttribute('aria-expanded')==='true'));
      const expanded=await title.evaluate(e=>getComputedStyle(e).textDecorationLine);
      assert.equal(expanded,before?'underline':'none');
      await page.keyboard.press('Escape');
      await page.locator('.map-dock-bank-popover').waitFor({state:'hidden'});
      report.checks.push({width,number,hover,focus,expanded,check:'Hover/open title decoration and native Enter/Escape picker operation'});
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();console.log(`PASS ${width}: title decoration and interaction`);
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
