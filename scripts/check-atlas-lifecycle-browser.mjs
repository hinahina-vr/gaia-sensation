import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=path.resolve(process.env.GAIA_ATLAS_OUT||'artifacts/atlas-history-20261022');fs.mkdirSync(out,{recursive:true});
const report={scope:'Local installed Chrome; actual controls and saved-view reload; intentional network failure/delay injection',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
try{
  await context.route('**/atlas-history/waterstore.json?*',r=>r.abort());
  await page.goto(`${base}/world.html#world-75`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='error');assert.equal(await page.locator('[data-climate-value]').textContent(),'—');
  await context.unroute('**/atlas-history/waterstore.json?*');await page.locator('[data-climate-retry]').click();await ready();await page.evaluate(()=>GaiaMapPlayback.stop());
  await page.locator('[data-climate-year]').fill('2018');assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');
  await page.locator('[data-climate-year]').fill('2016');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
  report.checks.push('Real manifest failure/retry; GRACE mission-gap year stays missing');
  await page.locator('#gaia-map-playback-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017);await page.locator('#gaia-map-playback-toggle').click();
  await page.locator('#gaia-map-cruise-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2003);await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2004);await page.locator('#gaia-map-cruise-toggle').click();
  report.checks.push('Actual autoplay and cruise controls advance the new provider');
  await page.evaluate(()=>{for(const y of [2020,2008,2024,2016])void GaiaClimateHistory.setYear(y);});await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2016'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().year),2016);report.checks.push('Rapid scrubbing finishes at last requested year');
  for(const id of ['waterstore','sealevel','electricity']){
    await page.evaluate(id=>GaiaClimateHistory.select(id),id);await ready();await page.evaluate(()=>GaiaMapPlayback.stop());
    // Probe rendered geometry, then send a real pointer click through the app.
    const hit=await page.evaluate(()=>{
      const selected=GaiaClimateHistory.getState().selectedId;
      const rect=GaiaMapObservationAdapter.getViewportRect(),v=document.querySelector('#japan-overlay').dataset,s=rect.width/360*Math.max(1,+v.earthZoom||1),ox=(rect.width-360*s)/2+(+v.earthOffsetX||0),oy=(rect.height-180*s)/2+(+v.earthOffsetY||0);
      const candidates=GaiaClimateHistory.getState().id==='electricity'?GaiaMapObservationAdapter.getCountryGeometry().countries:GaiaClimateHistory.getCruisePoints();
      for(const p of candidates){const x=rect.left+ox+((p.lon-150+540)%360)*s,y=rect.top+oy+(90-p.lat)*s;if(x<100||x>1100||y<260||y>700)continue;const hit=GaiaClimateHistory.findPoiAt(x,y,'mouse');if(hit&&hit.record.id!==selected&&!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout'))return{x,y,id:hit.record.id};}return null;
    });assert(hit,`No clickable geometry ${id}`);await page.mouse.click(hit.x,hit.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,hit.id);
    report.checks.push(`Actual map click selects ${id}: ${hit.id}`);
  }
  await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
  const original=await page.evaluate(()=>({dataset:GaiaClimateHistory.getStatisticsDataset(),summary:GaiaStatisticsLab.run('summary')}));
  await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();
  await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
  await page.goto(`${base}/world.html#world-76`);await ready();await page.evaluate(()=>GaiaMapPlayback.stop());await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
  await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();
  await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,original.dataset.id);
  const restored=await page.evaluate(()=>GaiaStatisticsLab.run('summary'));assert.equal(restored.stats.n,original.summary.stats.n);assert.equal(restored.stats.mean,original.summary.stats.mean);
  await page.locator('#gaia-statistics-menu-close').click();await page.locator('#gaia-statistics-close').click();report.checks.push({savedViewAfterDocumentReload:original.dataset.id,rows:restored.stats.n,mean:restored.stats.mean});
  await context.route('**/atlas-history/drinking.json?*',async r=>{await new Promise(resolve=>setTimeout(resolve,800));await r.continue();});
  await page.evaluate(()=>{void GaiaClimateHistory.select('drinking');GaiaMapCategories.buttons().find(b=>b.textContent.trim()==='01').click();});await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().active),false);assert.equal(await page.locator('#gaia-climate-canvas').isVisible(),false);report.checks.push('Late response cannot reactivate a departed exhibit');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>GaiaClimateHistory.select('foresthistory'));await ready();await page.evaluate(()=>GaiaMapPlayback.stop());
  await page.locator('[data-climate-year]').fill('2010');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2010');assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-year-fade'),'complete');report.checks.push('Reduced-motion disables interpolation');
  await page.locator('#japan-close').click();await page.waitForURL(url=>url.pathname==='/'&&url.hash==='#top');await page.locator('#intro-path-stage').waitFor({state:'visible'});report.checks.push('Return to the title completes');
  assert.deepEqual(report.errors,[]);assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page.screenshot({path:path.join(out,'lifecycle-failure.png')});throw e;}
finally{fs.writeFileSync(path.join(out,'lifecycle-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
