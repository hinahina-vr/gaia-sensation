import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out=process.env.RESPONSIVE_REGRESSION_OUTPUT||'artifacts/responsive-fixes-20260913/regression';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];let page;
const test=async(name,fn)=>{try{const evidence=await fn();results.push({name,passed:true,evidence});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.stack});await page?.screenshot({path:`${out}/FAIL-${name}.png`}).catch(()=>{});console.log('FAIL',name,e.message);}};
const shot=async(name)=>{await page.screenshot({path:`${out}/${name}.png`});};
const visibleControl=async(selector)=>{const e=page.locator(selector).first();assert(await e.isVisible(),selector+' visible');const box=await e.boundingBox();const vp=page.viewportSize();assert(box.x>=0&&box.y>=0&&box.x+box.width<=vp.width+1&&box.y+box.height<=vp.height+1,selector+' inside viewport');assert(await e.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),selector+' not covered');return box;};
async function context(width,height,lang='ja'){const c=await browser.newContext({viewport:{width,height},hasTouch:width<=1024,reducedMotion:'reduce'});await c.route('https://**',r=>r.abort());await c.addInitScript(lang=>{if(location.protocol==='http:'){localStorage.setItem('gaia:language:v1',lang);}},lang);page=await c.newPage();page.setDefaultTimeout(15000);return c;}
async function map(n){await page.goto('http://127.0.0.1:4492/#world-'+n);await page.waitForFunction(n=>globalThis.GaiaMapPlayback?.getState().ready&&Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);await page.locator('#gaia-boot').waitFor({state:'hidden'});await page.waitForTimeout(400);}
async function analysis(){if(page.viewportSize().width<=900){await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet .map-mobile-action-card').filter({hasText:'統計分析'}).first().click();}else await page.locator('[data-estat-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);}
try{
 for(const [w,h,n] of [[320,568,40],[375,667,70],[844,390,40],[1024,768,8],[1366,768,70]]){
  const c=await context(w,h,w===1366?'en':'ja');await map(n);
  await test(`R01-zoom-${w}-${n}`,async()=>{for(const id of ['#gaia-map-zoom-in','#gaia-map-zoom-out']){await visibleControl(id);await page.locator(id).click();}await shot(`R01-zoom-${w}-${n}`);});
  if(w<=900)await test(`R05-data-${w}-${n}`,async()=>{const d=page.locator('#map-responsive-data');assert(await d.isVisible());assert.equal(await d.getAttribute('open'),null);const r=await d.boundingBox();const head=await page.locator('.japan-heading').boundingBox();assert(r.y-head.y-head.height>=100,'map height');await d.locator(':scope > summary').click();const slider=d.locator('input[type=range]:visible').first();assert(await slider.count(),'native slider in drawer');await slider.scrollIntoViewIfNeeded();await slider.focus();await slider.press('ArrowLeft');await shot(`R05-data-open-${w}-${n}`);await d.locator(':scope > summary').click();await page.locator('[data-mobile-sheet="reading"]').click();assert(await page.locator('#map-mobile-sheet').isVisible());await shot(`R05-reading-${w}-${n}`);await page.locator('[data-mobile-sheet-close]').click();return {mapHeight:r.y-head.y-head.height};});
  if(w===1366)await test('R02-food-en',async()=>{for(const sel of ['[data-food-source]','[data-food-analysis]'])await visibleControl(sel);await shot('R02-food-en');});
  if(w===1024)await test('R03-heading-next',async()=>{await visibleControl('.japan-heading [data-map-heading-step="1"]');await page.locator('.japan-heading [data-map-heading-step="1"]').click();await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===9);});
  await c.close();
 }
 for(const [w,h] of [[320,568],[844,390],[1024,768],[1920,1080]]){
  const c=await context(w,h);await page.goto('http://127.0.0.1:4492/#character');await page.locator('#gaia-boot').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#character-book-image')?.complete);await page.waitForTimeout(500);
  await test(`R04-character-${w}`,async()=>{await page.locator('[data-character-select="sakuya"]').click();await page.waitForTimeout(500);await page.locator('#character-book-profile').scrollIntoViewIfNeeded();const a=await page.locator('.character-book-hero-detail').boundingBox(),b=await page.locator('.character-book-hero-figure').boundingBox();assert(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,'separate art and text cells');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);await shot(`R04-character-${w}`);return{detail:a,figure:b};});
  await c.close();
 }
 for(const [w,h]of [[320,568],[844,390]]){
  const c=await context(w,h);await map(26);await analysis();
  await test(`R06-chart-${w}`,async()=>{await page.locator('[data-stat-view="chart"]').click();const r=await page.locator('#gaia-statistics-visual').boundingBox();const visible=Math.min(h-15,r.y+r.height)-Math.max(0,r.y);assert(visible>=(w===320?250:150),`visible chart ${visible}`);await visibleControl('#gaia-statistics-close');await shot(`R06-chart-${w}`);await page.locator('[data-stat-view="records"]').click();await page.locator('#gaia-statistics-close').click();return{visibleChartHeight:visible};});await c.close();
 }
 const c=await context(390,844);
 for(const mode of ['character','sound','story'])await test(`R07-route-${mode}`,async()=>{await map(26);await analysis();await page.evaluate(mode=>location.hash='#'+mode,mode);await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.body.classList.contains('gaia-statistics-open')),false);await page.locator(mode==='character'?'#character-book-layer':mode==='sound'?'#sound-layer':'#novel-layer').waitFor({state:'visible'});await page.waitForTimeout(400);await shot(`R07-route-${mode}`);});await c.close();
 for(const [w,h]of [[768,1024],[820,1180],[900,700],[1280,800],[1366,768]]){
  const c=await context(w,h);await map(26);await test(`R08-credit-${w}`,async()=>{const credit=page.locator('.japan-credits');if(w===900){assert.equal(await credit.isVisible(),false);await page.locator('[data-mobile-sheet="reading"]').click();await shot(`R08-reading-${w}`);return 'compact view: source via reading sheet';}const links=credit.locator('a:visible');for(let i=0;i<await links.count();i++){await links.nth(i).scrollIntoViewIfNeeded();assert(await links.nth(i).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));}await shot(`R08-credit-${w}`);return{links:await links.count(),rect:await credit.boundingBox()};});await c.close();
 }
 const s=await context(844,390);await page.goto('http://127.0.0.1:4492/#sound');await page.locator('#gaia-boot').waitFor({state:'hidden'});await test('R09-sound',async()=>{await visibleControl('#sound-play');await page.locator('#sound-play').click();await shot('R09-sound');});await s.close();
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}
if(results.some(x=>!x.passed))process.exitCode=1;
