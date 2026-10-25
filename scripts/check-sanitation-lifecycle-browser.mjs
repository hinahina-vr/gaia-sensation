import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const out=path.resolve('artifacts/sanitation-20261023/lifecycle');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),report={scope:'Local real snapshots with explicitly injected stale metadata / delayed response',checks:[],errors:[]};
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  const stale=JSON.parse(fs.readFileSync('data/atlas-history/sanitation-services.json'));stale.sourceUpdated='2000-01-01';
  await context.route('**/sanitation-services.json?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(stale)}));
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-79`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='error');
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset()),null);
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.restoreStatisticsDataset('climate-sanitation-IND-basic')),null);report.checks.push('mismatched source releases refuse map and restored statistics');
  await context.unroute('**/sanitation-services.json?*');await page.locator('[data-climate-retry]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready');
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSanitationState().servicesReady),true);assert.equal((await page.evaluate(()=>GaiaClimateHistory.restoreStatisticsDataset('climate-sanitation-IND-basic'))).rows.find(r=>r.year===2016).y,15.2639);report.checks.push('retry refetches both snapshots and recovers');
  let release;const gate=new Promise(resolve=>{release=resolve;});await context.route('**/sanitation-services.json?*',async r=>{await gate;await r.continue();});
  await page.reload();await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='sanitation'&&GaiaClimateHistory.getState().dataState==='loading');
  await page.evaluate(()=>GaiaModeEntryGuide.close('map',{restoreFocus:false}));await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='foresthistory'&&GaiaClimateHistory.getState().dataState==='ready');release();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().id),'foresthistory');assert(!await page.locator('[data-sanitation-panel]').isVisible());report.checks.push('late response after navigation does not overwrite exhibit 80');
  await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sanitation'&&GaiaClimateHistory.getState().dataState==='ready');
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSanitationState().servicesReady),true);report.checks.push('return after late load recovers');
  assert.equal(await page.locator('#gaia-statistics-export-csv,#gaia-statistics-export-json,#gaia-statistics-export-png').count(),0);assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);assert.deepEqual(report.errors,[]);report.status='passed';await context.close();
}catch(e){report.status='failed';report.failure=e.stack;throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
