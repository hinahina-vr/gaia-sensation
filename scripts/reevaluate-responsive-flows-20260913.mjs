// 再評価の実操作経路。保存は使い捨てのブラウザプロファイル内だけで行う。
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out='artifacts/responsive-reevaluation-20260913';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[],errors=[];let p,c;
async function start(w,h,lang='ja',mobile=false){
 await c?.close();c=await browser.newContext({viewport:{width:w,height:h},hasTouch:mobile||w<=1024,isMobile:mobile,deviceScaleFactor:mobile?3:1,reducedMotion:'no-preference'});
 await c.route('https://**',r=>r.abort());await c.addInitScript(lang=>{if(location.protocol==='http:')localStorage.setItem('gaia:language:v1',lang);},lang);
 p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
}
async function map(n){await p.goto('http://127.0.0.1:4492/#world-'+n);await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForFunction(n=>globalThis.GaiaMapPlayback?.getState().ready&&Number(document.querySelector('#japan-mode-number')?.textContent)===n,n);await p.waitForTimeout(6500);await p.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));}
async function shot(id){await p.screenshot({path:`${out}/${id}.png`,scale:'css'});}
async function hit(sel){return p.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect(),a=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!a&&e.contains(a),cover:a&&!e.contains(a)?a.id||a.className:null};});}
async function test(id,fn){try{const data=await fn();results.push({id,pass:true,data});console.log('PASS',id);}catch(e){results.push({id,pass:false,error:e.message});await shot(`${id}-failure`).catch(()=>{});console.log('FAIL',id,e.message.slice(0,300));}fs.writeFileSync(`${out}/flows.json`,JSON.stringify({results,errors},null,2));}
async function analysis(){if(p.viewportSize().width<=900){await p.locator('[data-mobile-sheet="tools"]').click();await p.locator('.map-mobile-action-card').filter({hasText:/Statistical analysis|統計分析|统计分析/}).first().click();}else await p.locator('[data-estat-analysis]').click();await p.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);await p.waitForTimeout(600);}
try{
 await start(1024,768);await map(26);await shot('steady-tablet-map26');
 await test('tablet-credit-scroll',async()=>{
  const credit=p.locator('.japan-credits');const before=await credit.evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight,text:e.textContent}));
  await credit.hover();await p.mouse.wheel(0,250);await p.waitForTimeout(350);await shot('tablet-credit-scrolled');
  const link=credit.locator('a:visible').last();const state=await link.evaluate(e=>{const r=e.getBoundingClientRect();return{rect:r.toJSON(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});assert(state.hit);return {before,after:state};
 });
 await test('desktop-menu-keyboard',async()=>{
  await p.locator('[data-map-menu-toggle]').focus();await p.locator('#map-dock-bank-popover').waitFor({state:'visible'});await p.waitForTimeout(1400);await shot('keyboard-menu-world');
  await p.keyboard.press('ArrowDown');const focus1=await p.evaluate(()=>document.activeElement.outerHTML.slice(0,220));
  await p.locator('#map-dock-bank-popover [role="tab"][data-map-scope="japan"]').click();await p.waitForTimeout(1400);await shot('keyboard-menu-japan');
  await p.keyboard.press('Escape');await p.waitForTimeout(500);await shot('keyboard-menu-escape');const closed=!(await p.locator('#map-dock-bank-popover').isVisible());assert(closed,'Escape closes menu without focus immediately reopening it');return{focus1,closed};
 });
 await start(375,667,'en',true);await map(40);
 await test('drawer-rotate-change-year',async()=>{
  await p.locator('#map-responsive-data > summary').click();await shot('drawer-portrait-open');
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(700);await shot('drawer-landscape-open');
  const slider=p.locator('#map-responsive-data input[type="range"]:visible').first();await slider.scrollIntoViewIfNeeded();const old=await slider.inputValue();await slider.focus();await slider.press('ArrowLeft');const value=await slider.inputValue();assert.notEqual(old,value);await shot('drawer-landscape-slider');
  await p.locator('#map-responsive-data > summary').click();await p.setViewportSize({width:901,height:700});await p.waitForTimeout(600);assert.equal(await p.locator('#map-responsive-data').isVisible(),false);await shot('rotate-to-desktop');
  await p.setViewportSize({width:375,height:667});await p.waitForTimeout(600);assert(await p.locator('#map-responsive-data').isVisible());assert((await hit('#gaia-map-zoom-in')).hit);return{old,value};
 });
 await test('mobile-menu-select',async()=>{
  await p.locator('[data-map-menu-toggle]').click();await p.locator('#map-mobile-sheet [role="tab"][data-map-scope="japan"]').click();
  const tile=p.locator('[data-mobile-exhibit="69"]');const before=await hit('[data-mobile-exhibit="69"]');await tile.scrollIntoViewIfNeeded();await shot('mobile-menu-last-exhibit');await tile.click();await p.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===69);await p.waitForTimeout(6500);await shot('mobile-exhibit69');return{before,number:69};
 });
 await start(320,568,'en',true);await map(26);await analysis();
 await test('analysis-visible-chart-and-tabs',async()=>{
  const chart=await hit('#gaia-statistics-visual');await shot('analysis-small-en-chart');
  const tabs=[];for(const id of ['findings','values','records','insights','chart']){await p.locator(`[data-stat-view="${id}"]`).click();assert.equal(await p.locator(`[data-stat-view="${id}"]`).getAttribute('aria-selected'),'true');tabs.push(id);}
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(700);await shot('analysis-rotated-en');const close=await hit('#gaia-statistics-close');assert(close.inside&&close.hit);return{chart,tabs,close};
 });
 await test('analysis-route-cleanup',async()=>{
  await p.evaluate(()=>location.hash='#character');await p.locator('#character-book-layer').waitFor({state:'visible'});await p.waitForTimeout(1000);assert.equal(await p.locator('#gaia-statistics-lab').isVisible(),false);await p.locator('[data-character-select="sakuya"]').click();await shot('route-analysis-to-character');
  await map(26);await analysis();await p.evaluate(()=>location.hash='#sound');await p.locator('#sound-layer').waitFor({state:'visible'});assert.equal(await p.locator('#gaia-statistics-lab').isVisible(),false);await p.locator('[data-sound-track="story"]').click();await shot('route-analysis-to-sound');return{characterSelected:true,soundSelected:true};
 });
 await start(390,844,'en',true);await p.goto('http://127.0.0.1:4492/#story');await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForFunction(()=>!!globalThis.GaiaNovel);await p.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));await p.waitForFunction(()=>document.querySelector('#novel-text')?.dataset.revealState==='complete',null,{timeout:40000});
 await test('story-save-reload-load',async()=>{
  await shot('story-mobile-en');const original=await p.evaluate(()=>GaiaNovel.getState());await p.locator('#novel-save-button').click();await p.locator('[data-slot-index="0"]').click();
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('gaiaSensewareNovel:manual-saves'))[0]);assert(saved.savedAt);assert.equal(saved.progress.stepId,original.stepId);await shot('story-saved');
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(700);await shot('story-save-landscape');const close=await hit('#novel-save-close');assert(close.inside&&close.hit);await p.locator('#novel-save-close').click();
  await p.reload();await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForFunction(()=>!!globalThis.GaiaNovel);await p.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));await p.waitForTimeout(2000);await p.locator('#novel-load-button').click();await p.locator('[data-slot-index="0"]').click();await p.locator('#novel-save-panel').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>GaiaNovel.getState().stepId),saved.progress.stepId);await shot('story-loaded-landscape');return{stepId:saved.progress.stepId,close};
 });
 for(const [w,h,lang]of [[320,568,'zh-CN'],[844,390,'en']]){
  await start(w,h,lang,true);await p.goto('http://127.0.0.1:4492/');await p.locator('#gaia-opening-sound-modal').waitFor({state:'visible'});await p.waitForTimeout(600);
  await test(`entry-${w}`,async()=>{await shot(`entry-${w}-sound`);const initial=await hit('#gaia-opening-sound-off');await p.locator('#gaia-opening-sound-off').click();await p.locator('#gaia-opening-sound-modal').waitFor({state:'hidden'});return{initial,accepted:true};});
  await p.goto('http://127.0.0.1:4492/concept/');await p.waitForFunction(()=>document.body.dataset.enhanced==='true');await p.locator('.learning-courses > li').nth(2).scrollIntoViewIfNeeded();await shot(`concept-${w}-courses`);
  await p.goto('http://127.0.0.1:4528/sensors/#map');await p.waitForFunction(()=>document.documentElement.dataset.sensorView==='map');await p.waitForTimeout(1500);await p.evaluate(()=>globalThis.GaiaModeEntryGuide?.close?.('sensor',{restoreFocus:false}));await shot(`sensor-fixture-${w}`);
 }
}finally{fs.writeFileSync(`${out}/flows.json`,JSON.stringify({results,errors},null,2));await browser.close();}
