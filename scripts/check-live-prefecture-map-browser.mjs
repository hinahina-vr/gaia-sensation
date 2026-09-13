import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before'),base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/live-prefecture-map-20260912/${before?'before':'after'}`);fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,checks:[],errors:[],scope:'Local Chrome under production CSP, repository national weather/air snapshots, emulated desktop/touch. Not live-provider validation or physical phones.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try{
 for(const [width,height] of (before?[[1440,900],[390,844]]:[[1440,900],[3840,2160],[1024,768],[390,844],[320,568]]).filter(([w])=>!process.env.QA_WIDTHS||process.env.QA_WIDTHS.split(',').map(Number).includes(w))){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:'reduce'});await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?exhibit=15#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  await page.waitForFunction(()=>GaiaLiveData.getPrefectureField().requestState!=='loading');await page.evaluate(()=>{GaiaMapDemo.stop();GaiaLiveExhibits.pausePoiAutoplay();});
  for(const n of [15,16,17,18,19,20,21]){
   await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);await page.waitForTimeout(180);
   if(!before&&n<21)await page.locator('.gaia-live-prefecture-region').last().waitFor({state:'attached'});
   const scan=await page.evaluate(()=>({number:document.querySelector('#japan-mode-number').textContent,overflow:document.documentElement.scrollWidth-innerWidth,points:[...document.querySelectorAll('.gaia-live-city-marker,.gaia-live-exhibit-anchor')].filter(e=>e.checkVisibility()).length,regions:[...document.querySelectorAll('.gaia-live-prefecture-region')].map(e=>({code:e.dataset.livePrefecture,value:e.dataset.value,fill:e.getAttribute('fill'),missing:e.dataset.missing,selected:e.getAttribute('aria-current')})),mode:document.querySelector('#japan-layer').dataset.liveMapDisplay}));
   report.checks.push({width,n,...scan});await page.screenshot({path:path.join(output,`${width}-${n}.png`)});
   assert.equal(scan.overflow,0);
   if(before&&n<21)assert(scan.points>0);
   if(!before&&n<21){assert.equal(scan.points,0);assert.equal(scan.regions.length,47);assert.equal(scan.mode,'prefecture-choropleth');assert(new Set(scan.regions.filter(r=>r.missing==='false').map(r=>r.fill)).size>1,`${n}: varied regional colors`);
    const region=page.locator('[data-live-prefecture="13"]');await region.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>GaiaLiveData.getCity()==='tokyo');
    assert.match(await page.locator('.gaia-live-region-tooltip').textContent(),/東京都.*東京/s);assert.equal(await region.getAttribute('aria-current'),'true');
    const slider=page.locator('#gaia-live-time');await slider.focus();await slider.press('Home');await page.waitForTimeout(180);
    const values=await page.evaluate(()=>({key:GaiaLiveExhibits.definitions[Number(document.querySelector('#japan-mode-number').textContent)-15].key,time:GaiaLiveData.getSelectedTime(),field:GaiaLiveData.getPrefectureField(),rows:[...document.querySelectorAll('.gaia-live-prefecture-region')].map(e=>({city:e.dataset.city,value:e.dataset.value}))}));
    assert(values.time);const provider=['forecastCo2','pm25'].includes(values.key)?'air':'weather';for(const row of values.rows){const value=values.field[provider].points.find(p=>p.id===row.city)?.measurements[values.key];assert.equal(row.value,Number.isFinite(value)?String(value):'missing');}
    await slider.press('End');await page.waitForTimeout(120);assert.equal(await page.locator('.gaia-live-region-tooltip').isVisible(),false,'No persistent duplicate tooltip covering the map after leaving a region');
   }
   if(!before&&n===21){assert.equal(await page.locator('.gaia-live-prefecture-regions').isVisible(),false);assert.equal(await page.locator('.gaia-estat-prefecture-region').count(),47);}
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();console.log(`PASS ${width}`);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{report.hashes=Object.fromEntries(['app.js','app-content.js','src/exploration/index.js','src/exploration/live-exhibits.js','src/exploration/live-prefecture-map.js','src/exploration/live-exhibit-catalog.js','realtime-exhibits.css','gaia-mode-loader.js','index.html'].filter(f=>fs.existsSync(f)).map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
