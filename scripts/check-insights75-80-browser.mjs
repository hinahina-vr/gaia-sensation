import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {discoverData} from '../statistics-discovery.js';
const out=process.env.GAIA_INSIGHT_OUT||'artifacts/insights75-80-20261027',base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492',targets=JSON.parse(process.env.GAIA_INSIGHT_TARGETS||'[[75,"waterstore"],[76,"sealevel"],[77,"electricity"],[78,"drinking"],[79,"sanitation"],[80,"foresthistory"]]');fs.mkdirSync(out,{recursive:true});
const report={scope:'Local installed Chrome, real map selection and analysis datasets; mobile viewport emulation, not physical devices or production.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});
 page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/world.html#world-'+targets[0][0],{waitUntil:'domcontentloaded'});
 for(const [number,id] of targets){
  await page.evaluate(number=>location.hash='#world-'+number,number);await page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete',id);await page.evaluate(()=>GaiaMapPlayback.stop());
  await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));
  const dataset=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert(dataset.rows.length>=2);const expected=discoverData({dataset,rows:dataset.rows}).computedInsight;
  if(width===1440)await page.locator('[data-climate-analysis]').click();else{await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet').getByRole('button',{name:/統計分析/}).click();}
  await page.waitForFunction(id=>globalThis.GaiaStatisticsLab?.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,dataset.id);
  const actual=await page.evaluate(()=>GaiaStatisticsLab.run('discovery').dataInsight.computedInsight);for(const key of ['headline','fact','summary','metrics','recordIds'])assert.deepEqual(actual[key],expected[key]);
  const card=page.locator('#gaia-statistics-takeaway');await card.scrollIntoViewIfNeeded();assert((await card.innerText()).includes(expected.fact));assert((await card.innerText()).includes(expected.summary));assert(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await card.screenshot({path:`${out}/summary-${number}-${width}.png`});await page.locator('[data-stat-view="records"]').click();assert(await page.locator('#gaia-statistics-records-body tr').count()>0);
  report.checks.push({number,width,dataset:dataset.id,headline:actual.headline,fact:actual.fact,summary:actual.summary,metrics:actual.metrics});console.log('PASS',number,width);await page.locator('#gaia-statistics-close').click();
 }await context.close();
}assert.deepEqual(report.errors,[]);report.status='passed';}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
