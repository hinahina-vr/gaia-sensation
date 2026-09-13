import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before-pointer');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/live-prefecture-map-20260912/${before?'pointer-before':'interactions'}`);fs.mkdirSync(output,{recursive:true});
const saved=JSON.parse(fs.readFileSync('data/live-prefecture-fallback-v1.json','utf8'));
const report={status:'running',checks:[],errors:[],scope:'Local installed Chrome under production CSP. Native mouse/touch and keyboard input; national repository snapshots, explicit missing/zero and boundary-failure fixtures. Not physical mobile or live-provider validation.'};
report.hashes=Object.fromEntries(['app.js','src/exploration/live-exhibits.js','src/exploration/live-prefecture-map.js','src/exploration/live-exhibit-catalog.js','realtime-exhibits.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const hit=async code=>page.evaluate(code=>{
 const region=document.querySelector(`[data-live-prefecture="${code}"]`),r=region.getBoundingClientRect();
 for(let y=Math.max(2,r.top+2);y<Math.min(innerHeight-2,r.bottom);y+=3)for(let x=Math.max(2,r.left+2);x<Math.min(innerWidth-2,r.right);x+=3)if(document.elementFromPoint(x,y)===region)return {x,y};
 return null;
},code);
const transform=()=>page.locator('.gaia-live-prefecture-regions > g').getAttribute('transform');
const pause=()=>page.evaluate(()=>{GaiaMapDemo.stop();GaiaLiveExhibits.pausePoiAutoplay();});
const selectMode=async n=>{await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);await page.waitForTimeout(250);};
try{
 for(const mode of (before?['desktop']:['desktop','touch','normal-motion','missing-zero','boundary-failure'])){
  const mobile=mode==='touch',ctx=await browser.newContext({viewport:{width:mobile?390:1440,height:mobile?844:900},hasTouch:mobile,isMobile:mobile,reducedMotion:mode==='normal-motion'?'no-preference':'reduce'});
  await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());
  if(mode==='missing-zero')await ctx.route('**/data/live-prefecture-fallback-v1.json',r=>{
   const payload=structuredClone(saved);for(const p of ['weather','air'])for(const [i,value] of [[0,null],[1,0]])for(const key of Object.keys(payload[p].history[0].points[i].measurements))payload[p].history[0].points[i].measurements[key]=value;
   return r.fulfill({json:payload});
  });
  if(mode==='boundary-failure')await ctx.route('**/data/japan-prefectures.topojson*',r=>r.abort());
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?exhibit=15#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  await page.waitForFunction(()=>GaiaLiveData.getPrefectureField().requestState!=='loading');await pause();
  if(mode==='boundary-failure'){
   await page.locator('.gaia-live-region-status').filter({hasText:'取得できません'}).waitFor();
   await page.locator('.gaia-live-place-selector').click();await page.locator('[data-place-city="tokyo"]').click();await page.waitForFunction(()=>GaiaLiveData.getCity()==='tokyo');
   assert.equal(await page.locator('.gaia-live-exhibit-readout').getAttribute('data-missing'),'false');report.checks.push({mode,regionCount:await page.locator('.gaia-live-prefecture-region').count()});
  }else if(mode==='missing-zero'){
   for(const n of [15,16,17,18,19,20]){
    await selectMode(n);const slider=page.locator('#gaia-live-time');await slider.focus();await slider.press('Home');
    await page.waitForFunction(()=>document.querySelector('[data-live-prefecture="01"]').dataset.missing==='true');
    assert.equal(await page.locator('[data-live-prefecture="01"]').getAttribute('fill'),'#344354');
    assert.equal(await page.locator('[data-live-prefecture="02"]').getAttribute('data-value'),'0');
    assert.notEqual(await page.locator('[data-live-prefecture="02"]').getAttribute('fill'),'#344354');
    await page.locator('[data-live-prefecture="02"]').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>GaiaLiveData.getCity()==='aomori');
    assert.match(await page.locator('[data-live-exhibit-value]').textContent(),/^0\s/);assert.match(await page.locator('.gaia-live-region-tooltip').textContent(),/0 /);
    await page.locator('[data-live-prefecture="01"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>GaiaLiveData.getCity()==='sapporo');
    assert.equal(await page.locator('[data-live-exhibit-value]').textContent(),'—');assert.match(await page.locator('.gaia-live-region-tooltip').textContent(),/データなし/);
    report.checks.push({mode,n});await page.screenshot({path:path.join(output,`${mode}-${n}.png`)});
   }
  }else{
   await page.locator('[data-live-prefecture="13"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>GaiaLiveData.getCity()==='tokyo');
   const point=await hit('01');assert(point,'A real visible pixel inside Hokkaido');
   if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
   await page.waitForTimeout(500);const clicked=await page.evaluate(()=>GaiaLiveData.getCity());
   if(before){assert.equal(clicked,'tokyo','Reproduces map pointer capture swallowing the region click');report.checks.push({mode,reproduced:true,point,clicked});}
   else{
    assert.equal(clicked,'sapporo',`${mode}: native region click/tap selects Hokkaido`);
    const beforePan=await transform(),panStart=await hit('04');assert(panStart,'Visible land drag starting point');
    if(mobile){const cdp=await ctx.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[panStart]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:panStart.x-5*i,y:panStart.y+4*i}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await page.mouse.move(panStart.x,panStart.y);await page.mouse.down();await page.mouse.move(panStart.x-50,panStart.y+35,{steps:10});await page.mouse.up();}
    await page.waitForFunction(t=>document.querySelector('.gaia-live-prefecture-regions > g').getAttribute('transform')!==t,beforePan);
    assert.equal(await page.evaluate(()=>GaiaLiveData.getCity()),'sapporo','Dragging land pans without selecting another prefecture');
    const beforeZoom=await transform();
    if(mobile){await page.getByRole('button',{name:'操作',exact:true}).click();await page.getByRole('button',{name:'＋ 拡大',exact:true}).click();}else await page.locator('#gaia-map-zoom-in').click();
    await page.waitForFunction(t=>document.querySelector('.gaia-live-prefecture-regions > g').getAttribute('transform')!==t,beforeZoom);
    const alignment=await page.evaluate(()=>{const map=document.querySelector('#japan-map').getBoundingClientRect(),d=document.querySelector('#japan-overlay').dataset,m=document.querySelector('.gaia-live-prefecture-regions > g').transform.baseVal.consolidate().matrix,scale=(map.width>=901?map.width/360:Math.max(map.width/360,map.height/180))*Number(d.earthZoom);return {actual:[m.a,m.e,m.f],expected:[scale,(map.width-360*scale)/2+Number(d.earthOffsetX),(map.height-180*scale)/2+Number(d.earthOffsetY)]};});
    alignment.actual.forEach((v,i)=>assert(Math.abs(v-alignment.expected[i])<.02,`${mode} projection ${i}: ${v} vs ${alignment.expected[i]}`));
    const livePaths=await page.locator('.gaia-live-prefecture-region').evaluateAll(es=>es.map(e=>e.getAttribute('d')));
    await selectMode(21);assert.equal(await page.locator('.gaia-live-prefecture-regions').isVisible(),false);
    assert.deepEqual(await page.locator('.gaia-estat-prefecture-region').evaluateAll(es=>es.map(e=>e.getAttribute('d'))),livePaths,'Exactly the same paths as exhibit 21');
    await selectMode(15);await pause();assert.equal(await page.locator('.gaia-live-prefecture-regions').isVisible(),true);assert.equal(await page.locator('.gaia-estat-prefecture-regions').isVisible(),false);
    if(mobile){await page.getByRole('button',{name:'操作',exact:true}).click();await page.getByRole('button',{name:'データの出典',exact:true}).click();}else await page.locator('[data-live-deck-source]').click();
    await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();assert.match(await page.locator('#japan-data-panel').textContent(),/Open-Meteo|OPEN-METEO/);await page.locator('#japan-data-close').click();
    if(mode==='normal-motion'){await page.evaluate(()=>GaiaLiveExhibits.resumePoiAutoplay());await page.waitForFunction(()=>GaiaLiveData.getCity()==='aomori');await pause();assert.equal(await page.locator('[data-live-prefecture="02"]').getAttribute('aria-current'),'true');}
    report.checks.push({mode,clicked,point,panStart,alignment,same47Boundaries:true,sourceOpened:true});
   }
  }
  await page.screenshot({path:path.join(output,`${mode}.png`)});assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();console.log(`PASS ${mode}`);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
