import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=path.resolve('artifacts/atlas-expansion-20261022/lifecycle');fs.mkdirSync(out,{recursive:true});
const report={scope:'Installed Chrome headless; real local snapshots, user controls, saved-view document reload; external network blocked; controlled failure injection',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
const ready=async(id)=>{if(id)await page.waitForFunction(id=>GaiaClimateHistory?.getState().id===id,id);await page.waitForFunction(()=>GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&(GaiaClimateHistory.getState().id==='cyclones'||document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'));await page.evaluate(()=>GaiaMapPlayback.stop());};
try{
  await context.route('**/atlas-history/seaice.json?*',r=>r.abort());await page.goto(`${base}/world.html#world-89`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='error');
  await context.unroute('**/atlas-history/seaice.json?*');await page.locator('[data-climate-retry]').click();await ready();report.checks.push('New snapshot failure/retry recovers');
  await page.locator('[data-climate-basin]').selectOption('1');await page.locator('[data-climate-year]').fill('1988');assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');
  const missingStats=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert.equal(missingStats.missingCount,1);assert(!missingStats.rows.some(r=>r.year===1988));
  await page.locator('[data-climate-year]').fill('2016');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
  await page.locator('#gaia-map-playback-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017);await page.locator('#gaia-map-playback-toggle').click();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().month),1);report.checks.push('Autoplay holds selected month; missing month omitted from analysis');
  // Find a symbol through the public hit test, then issue a real pointer click.
  const hit=await page.evaluate(()=>{const selected=GaiaClimateHistory.getState().selectedId;for(let y=280;y<650;y+=10)for(let x=180;x<1100;x+=10){const p=GaiaClimateHistory.findPoiAt(x,y,'mouse');if(p&&p.record.id!==selected&&!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout'))return{x,y,id:p.record.id};}return null;});
  assert(hit);await page.mouse.click(hit.x,hit.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,hit.id);report.checks.push('Actual area-symbol click selects the other hemisphere');
  await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
  const original=await page.evaluate(()=>({dataset:GaiaClimateHistory.getStatisticsDataset(),summary:GaiaStatisticsLab.run('summary')}));assert(original.dataset.id.endsWith('-m01'));
  await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();
  await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
  await page.goto(`${base}/world.html#world-90`);await ready();await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
  await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();
  await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,original.dataset.id);
  const restored=await page.evaluate(()=>GaiaStatisticsLab.run('summary'));assert.equal(restored.stats.n,original.summary.stats.n);assert.equal(restored.stats.mean,original.summary.stats.mean);report.checks.push({savedMonthAfterReload:original.dataset.id,rows:restored.stats.n,mean:restored.stats.mean});
  await page.locator('#gaia-statistics-menu-close').click();await page.locator('#gaia-statistics-close').click();
  // Switching from a month picker back to the pre-existing cyclone basin picker.
  await page.evaluate(()=>{location.hash='#world-72';});await ready('cyclones');assert.equal(await page.locator('[data-climate-basin]').getAttribute('aria-label'),'台風の海域');await page.locator('[data-climate-basin]').selectOption('WP');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().basin),'WP');report.checks.push('Monthly → cyclone restores basin options and meaning');
  await page.evaluate(()=>{location.hash='#world-81';});await ready('waterstress');assert.equal(await page.locator('[data-climate-basin-label]').isVisible(),false);report.checks.push('Country exhibit hides the unused monthly control');
  await context.route('**/atlas-history/fertilizer.json?*',async r=>{await new Promise(resolve=>setTimeout(resolve,900));await r.continue();});
  await page.evaluate(()=>{void GaiaClimateHistory.select('fertilizer');GaiaMapCategories.buttons().find(b=>b.textContent.trim()==='01').click();});await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().active),false);assert.equal(await page.locator('#gaia-climate-canvas').isVisible(),false);report.checks.push('Late new-data response cannot reactivate a departed exhibit');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{location.hash='#world-90';});await ready('snowcover');await page.locator('[data-climate-basin]').selectOption('12');await page.locator('[data-climate-year]').fill('2005');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2005');assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-year-fade'),'complete');report.checks.push('Reduced motion works for both month and year');
  await page.locator('#japan-close').click();await page.waitForURL(url=>url.pathname==='/'&&url.hash==='#top');await page.locator('#intro-path-stage').waitFor({state:'visible'});report.checks.push('Map return reaches the interactive title');
  assert.deepEqual(report.errors,[]);assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
