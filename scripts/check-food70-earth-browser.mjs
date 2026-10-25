import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.env.GAIA_FOOD70_INSIGHT_BEFORE==='1',out=path.resolve('artifacts/food70-earth-20261025/'+(before?'before':'after'));fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={scope:'Installed Chrome; actual local 70/71 data and UI; touch emulation, not physical phone or production',checks:[],errors:[]};let page;
try{
 for(const [width,height] of before?[[1440,1000]]:JSON.parse(process.env.GAIA_FOOD70_INSIGHT_SIZES||'[[1440,1000],[390,844]]')){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<901,isMobile:width<901,reducedMotion:'reduce'});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  const mapReady=()=>page.waitForFunction(()=>globalThis.GaiaFoodExhibits?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
  const analysisReady=()=>page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&document.querySelector('#gaia-statistics-status').textContent!=='計算中');
  const openAnalysis=async()=>{if(width<901){await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet').getByRole('button',{name:/統計分析/}).click();}else await page.locator('[data-food-analysis]').click();await analysisReady();await page.locator('[data-stat-view="chart"]').click();};
  const closeAnalysis=async()=>{await page.locator('#gaia-statistics-close').click();await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});};
  const drawer=page.locator('#map-responsive-data');
  const choose=async(country,series)=>{if(await drawer.isVisible()&&await drawer.getAttribute('open')===null)await drawer.locator(':scope > summary').click();await page.locator('[data-food-country]').selectOption(country);if(series)await page.locator('[data-food-series]').selectOption(series);if(await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();};
  await page.goto(process.env.GAIA_BASE_URL+'/world.html#world-70');await page.waitForFunction(()=>globalThis.GaiaFoodExhibits?.getState().dataState==='ready');await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});await mapReady();await openAnalysis();
  await page.locator('#gaia-statistics-takeaway').scrollIntoViewIfNeeded();
  const initial=await page.locator('#gaia-statistics-takeaway').innerText();await page.screenshot({path:path.join(out,width+'-70-summary.png')});
  if(before){report.checks.push({width,initial});await context.close();continue;}
  const meaning=page.locator('#gaia-statistics-takeaway-body section').nth(1);
  await meaning.scrollIntoViewIfNeeded();const meaningBounds=await meaning.boundingBox();
  assert(meaningBounds.y>=0&&meaningBounds.y+meaningBounds.height<=height,'Earth-focused explanation can be scrolled fully into the viewport');
  await page.screenshot({path:path.join(out,width+'-70-meaning.png')});
  assert.match(initial,/日本.*穀物/);assert(!/\d/.test(initial),'Summary focuses on interpretation rather than fine numbers');assert.match(initial,/地球を考える視点/);assert.match(initial,/産地をたどり/);assert.match(initial,/農地や水/);assert.equal(await page.locator('#gaia-statistics-takeaway-evidence').isVisible(),false);
  assert(!initial.includes('1960年〜2015年'));assert(!initial.includes('直近3記録中'));assert(!initial.includes('範囲も分離'));assert(!initial.includes('（36.77%減）'));
  const r=await page.evaluate(()=>GaiaStatisticsLab.run('discovery').dataInsight);
  assert.equal(r.computedInsight.audience,'earth-context');assert.deepEqual(r.computedInsight.details.comparableYears,[2014,2015,2016,2017,2018,2019,2020,2021,2022,2023]);
  assert(Math.abs(r.computedInsight.details.latestValue-28.84148995709222)<1e-10);
  const summary=await page.locator('#gaia-statistics-takeaway').evaluate(e=>{const r=e.getBoundingClientRect();return{width:r.width,overflow:e.scrollWidth-e.clientWidth,documentOverflow:document.documentElement.scrollWidth-innerWidth};});assert(summary.overflow<=1&&summary.documentOverflow<=1);
  await page.locator('[data-stat-view="findings"]').click();const findings=await page.locator('#gaia-statistics-findings').innerText();assert.match(findings,/地球を考える視点|海外調達/);assert.match(findings,/食卓|生産/);
  await page.locator('[data-stat-view="records"]').click();assert((await page.locator('#gaia-statistics-records-body tr').count())>0);
  await closeAnalysis();
  await choose('036','2905');await openAnalysis();const surplus=await page.locator('#gaia-statistics-takeaway').innerText();assert.match(surplus,/オーストラリア/);assert.match(surplus,/純輸出|輸出/);assert(!surplus.includes('純輸入が'));await page.screenshot({path:path.join(out,width+'-70-export.png')});await closeAnalysis();
  await choose('392','2555');await openAnalysis();const soy=await page.locator('#gaia-statistics-takeaway').innerText();assert.match(soy,/大豆/);assert(!soy.includes('穀物（ビールを除く）'));await closeAnalysis();
  if(width===1440){
   await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaFoodExhibits.getState().id==='food-security');await mapReady();await openAnalysis();const other=await page.evaluate(()=>GaiaStatisticsLab.run('discovery').dataInsight);assert.notEqual(other.computedInsight?.audience,'earth-context');assert(await page.locator('#gaia-statistics-takeaway-evidence').isVisible(),'71 keeps its numerical evidence');await closeAnalysis();
   await page.locator('[data-map-stable-step="-1"]').click();await mapReady();await choose('392','2905');await openAnalysis();assert.match(await page.locator('#gaia-statistics-takeaway').innerText(),/海外からの供給/);
  }
  report.checks.push({width,height,initial,layout:summary,verified:['real 70 entry to analysis','Earth context and invitation to explore','same-source contiguous comparison','original values/records','surplus country','commodity change','71 retains its current summary and numerical evidence']});
  assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();console.log('PASS food70 earth '+width);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png')});report.dom=await page.locator('#gaia-statistics-lab').innerText().catch(()=>null);}throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure}));}
