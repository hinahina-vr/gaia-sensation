import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/statistics-selection-guide-20260912');fs.mkdirSync(output,{recursive:true});
const report={status:'running',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try {
 for(const width of (process.env.QA_WIDTHS||'1440,901,390').split(',').map(Number)) {
  const mobile=width<=900,ctx=await browser.newContext({viewport:{width,height:mobile?844:900},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
  await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());await ctx.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${base}/?exhibit=35#world`,{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  await page.waitForFunction(()=>globalThis.GaiaMarineCod?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapDemo.stop());
  const open=async()=>{if(mobile){await page.locator('[data-mobile-sheet="tools"]').tap();await page.locator('#map-mobile-sheet').getByRole('button',{name:'統計分析',exact:true}).tap();}else{await page.locator('[data-cod-analysis]').focus();await page.locator('[data-cod-analysis]').press('Enter');}};
  await open();assert.equal(await page.locator('#gaia-statistics-lab').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('[data-cod-prefecture]')),true);
  const hint=page.locator('#gaia-cod-selection-help');await hint.waitFor({state:'visible'});const rect=await hint.boundingBox();
  assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width&&rect.height>=30);
  assert(await hint.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'The selection hint must be actually visible, not clipped by the dock');
  await page.screenshot({path:path.join(output,`${width}-unselected-guide.png`)});
  await page.locator('[data-cod-prefecture]').selectOption('13');await page.locator('[data-cod-station]').selectOption('1300101');
  await page.waitForFunction(()=>!document.querySelector('[data-cod-analysis]').disabled&&!document.querySelector('[data-cod-analysis]').hasAttribute('data-analysis-needs-selection'));
  assert.equal(await hint.isVisible(),false);
  await open();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&Number(document.querySelector('#gaia-statistics-canvas').dataset.pointCount)>0);
  const state=await page.evaluate(()=>GaiaStatisticsLab.getState());assert.equal(state.datasetId,'japan-river-do-1300101');
  await page.screenshot({path:path.join(output,`${width}-correct-do-analysis.png`)});await page.locator('#gaia-statistics-close').click();await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});
  // A legacy/direct generic call must also use the active station, never CO2.
  await page.evaluate(()=>GaiaStatisticsLab.open());await page.waitForFunction(()=>GaiaStatisticsLab.getState().analysisReady);assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().datasetId),'japan-river-do-1300101');
  await page.locator('#gaia-statistics-close').click();await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});
  await page.locator('[data-cod-station]').selectOption('');await page.evaluate(()=>GaiaStatisticsLab.open());assert.equal(await page.locator('#gaia-statistics-lab').isVisible(),false);assert(await hint.isVisible());
  if(width!==901) {
    const selectStation=async()=>{await page.locator('[data-cod-prefecture]').selectOption('13');await page.locator('[data-cod-station]').selectOption('1300101');await page.waitForFunction(()=>!document.querySelector('[data-cod-analysis]').disabled);};
    const ready=()=>page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
    const options=async()=>{await page.locator('#gaia-statistics-menu-toggle').click();await page.locator('.gaia-statistics-data-options > summary').click();};
    await selectStation();await open();await ready();await options();
    await page.locator('#gaia-statistics-record-filter').fill('202');await page.waitForFunction(()=>GaiaStatisticsLab.getState().recordQuery==='202');await ready();
    await page.locator('#gaia-statistics-view-save').click();assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().savedViewCount),1);
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');await page.evaluate(()=>GaiaMapDemo.stop());
    await selectStation();await open();await ready();await options();await page.locator('#gaia-statistics-saved-view').selectOption({index:1});await page.locator('#gaia-statistics-view-apply').click();await ready();
    assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().datasetId),'japan-river-do-1300101');assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().recordQuery),'202');
    await page.locator('#gaia-statistics-view-delete').click();assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().savedViewCount),0);
    await page.locator('#gaia-statistics-menu-close').click();await page.screenshot({path:path.join(output,`${width}-saved-view-reloaded.png`)});
    await page.locator('#gaia-statistics-close').click();await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});
  }
  assert.equal(await page.locator('#gaia-statistics-button-mobile').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
  report.checks.push({width,guide:rect,correctDataset:state.datasetId,legacyEntry:'correct dataset or selection guide, never CO2',savedViewReload:width!==901});await ctx.close();console.log('PASS selection guide',width);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
