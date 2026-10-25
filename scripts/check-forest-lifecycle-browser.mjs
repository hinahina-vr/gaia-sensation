import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const out=path.resolve(process.env.GAIA_FOREST_LIFECYCLE_OUT||'artifacts/forest-20261023/lifecycle');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),report={scope:'Local actual snapshots, deliberately delayed response; real wrapped-country click and saved-view restore after document reload',checks:[],errors:[]};let page;
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  const ready=async()=>{await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');await page.evaluate(()=>GaiaMapPlayback.stop());};
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-80`);await ready();
  assert.equal((await page.locator('#japan-overlay').getAttribute('data-vector-world-copies')).split(',').length,4);
  const wrapped=await page.evaluate(()=>{
    const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=r.width/360*Number(d.earthZoom),world=360*s,ox=(r.width-world)/2+Number(d.earthOffsetX),oy=(r.height-180*s)/2+Number(d.earthOffsetY);
    for(const p of GaiaMapObservationAdapter.getCountryGeometry().countries){let x=ox+((p.lon+390)%360)*s;x+=Math.round((r.width/2-x)/world)*world;const y=oy+(90-p.lat)*s;if(x<=ox+world+5||x>r.width-12||y<160||y>740)continue;const hit=GaiaClimateHistory.findPoiAt(x+r.left,y+r.top,'mouse');if(hit?.record.id===p.iso3&&!document.elementFromPoint(x+r.left,y+r.top)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout'))return {id:p.iso3,x:x+r.left,y:y+r.top};}return null;
  });assert(wrapped,'A real country is selectable across the former seam');await page.mouse.click(wrapped.x,wrapped.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,wrapped.id);await ready();report.checks.push({wrappedCountryClick:wrapped});
  await page.locator('[data-forest-place="BRA"]').click();await ready();await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
  const original=await page.evaluate(()=>({id:GaiaStatisticsLab.getState().datasetId,summary:GaiaStatisticsLab.run('summary')}));
  const menu=async()=>{await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();};
  await menu();await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
  await page.reload();await ready();await page.locator('[data-forest-mode="share"]').click();await ready();await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId==='climate-foresthistory-BRA');
  await menu();await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,original.id);
  const restored=await page.evaluate(()=>GaiaStatisticsLab.run('summary'));assert.equal(restored.stats.n,original.summary.stats.n);assert.equal(restored.stats.mean,original.summary.stats.mean);report.checks.push({savedViewAfterReload:original.id,rows:restored.stats.n});
  await page.locator('#gaia-statistics-menu-close').click();await page.locator('#gaia-statistics-close').click();
  for(const step of ['1','-1','-1']){await page.locator(`[data-map-stable-step="${step}"]`).click();await ready();const state=await page.evaluate(()=>GaiaClimateHistory.getState());assert.equal((await page.locator('#japan-overlay').getAttribute('data-vector-world-copies')).split(',').length,state.id==='foresthistory'?4:2);report.checks.push({cameraCopiesReset:state.id});}
  let release;const gate=new Promise(resolve=>{release=resolve;});await context.route('**/foresthistory.json?*',async r=>{await gate;await r.continue();});
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-80`);await page.reload();await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='foresthistory'&&GaiaClimateHistory.getState().dataState==='loading');
  await page.evaluate(()=>GaiaModeEntryGuide.close('map',{restoreFocus:false}));await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='waterstress'&&GaiaClimateHistory.getState().dataState==='ready');release();await ready();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().id),'waterstress');assert(!await page.locator('[data-forest-panel]').isVisible());report.checks.push('late forest response cannot overwrite 81');
  await page.locator('[data-map-stable-step="-1"]').click();await ready();assert(await page.locator('[data-forest-panel]').isVisible());assert.equal(await page.evaluate(()=>GaiaClimateHistory.getForestState().mode),'change');
  await page.evaluate(()=>{for(const y of [2023,2005,2020,2016])void GaiaClimateHistory.setYear(y);});await ready();assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-rendered-year'),'2016');report.checks.push('return and rapid year changes recover');
  await page.locator('#japan-close').click();await page.waitForURL(url=>url.pathname==='/'&&url.hash==='#top');await page.locator('#intro-path-stage').waitFor({state:'visible'});report.checks.push('return to title completes');
  assert.equal(await page.locator('#gaia-statistics-export-csv,#gaia-statistics-export-json,#gaia-statistics-export-png').count(),0);assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
