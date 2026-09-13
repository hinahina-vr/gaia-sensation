import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/annual-analysis',inventory=process.argv.includes('--inventory');fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Local Chrome, actual bundled annual observations and statistics UI. Original location/taxon/substance source fields remain verbatim; no external AI.',checks:[],pending:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of (process.env.QA_WIDTHS?process.env.QA_WIDTHS.split(',').map(Number):inventory?[1440]:[1440,390]))for(const language of (process.env.QA_LANGUAGES?process.env.QA_LANGUAGES.split(','):inventory?['en']:['en','zh-CN'])){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#world-31');
  for(const number of [31,65,68]){
   await page.evaluate(n=>{location.hash='#world-'+n;},number);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaMapPlayback?.getState().ready,number);
   await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaModeEntryGuide?.close('map',{restoreFocus:false});const points=GaiaMarineCod.getCruisePoints();GaiaMarineCod.selectStation(points[Math.floor(points.length/2)].id,{focus:false});});
   await page.waitForFunction(()=>!!GaiaMarineCod.getStatisticsDataset());
   const original=await page.evaluate(()=>GaiaMarineCod.getStatisticsDataset());
   await page.evaluate(async()=>{await GaiaModeLoader.load('statistics');await GaiaStatisticsLab.open({dataset:GaiaMarineCod.getStatisticsDataset()});});
   await page.waitForFunction(()=>GaiaStatisticsLab.getState().analysisReady);
   for(const view of ['chart','findings','values','records','insights']){
    await page.locator('[data-stat-view="'+view+'"]').click();await page.waitForTimeout(200);
    let text=await page.locator('#gaia-statistics-lab').innerText();
    const originals=[original.titlePresentation.name,...(number===65?original.rows.map(r=>r.label):[])];
    for(const name of originals)text=text.replaceAll(name,'[source name]');
    const pending=text.split('\n').map(t=>t.trim()).filter(t=>(language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(t));
    report.pending.push(...pending.map(text=>({number,view,language,text})));if(!inventory)assert.deepEqual(pending,[],number+' '+view);
    if(view==='chart')await page.screenshot({path:out+'/'+width+'-'+language+'-'+number+'.png'});
   }
   const state=await page.evaluate(()=>GaiaStatisticsLab.getState());
   await page.evaluate(()=>GaiaI18n.set('ja'));
   assert.deepEqual(await page.evaluate(()=>GaiaMarineCod.getStatisticsDataset()),original,'Source dataset unchanged by language');
   assert.equal((await page.evaluate(()=>GaiaStatisticsLab.getState())).datasetId,state.datasetId);
   await page.evaluate(lang=>GaiaI18n.set(lang),language);
   if(!inventory){
    await page.locator('#gaia-statistics-menu-toggle').click();
    await page.locator('.gaia-statistics-data-options > summary').click();
    await page.locator('#gaia-statistics-view-save').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gaia-statistics-saved-views:v1'))[0]);
    assert.equal(saved.datasetId,original.id);
    assert.equal(saved.methodId,state.methodId);
    // Reload clears in-memory datasets. Apply must load the original annual
    // records by the saved stable ID, in the other language, without map navigation.
    await page.reload();await page.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready);
    await page.evaluate(async lang=>{GaiaI18n.set(lang);GaiaMapPlayback.stop();await GaiaModeLoader.load('statistics');await GaiaStatisticsLab.open({datasetId:'co2-trend'});},language==='en'?'zh-CN':'en');
    await page.waitForFunction(()=>GaiaStatisticsLab.getState().analysisReady);
    await page.locator('#gaia-statistics-menu-toggle').click();
    await page.locator('.gaia-statistics-data-options > summary').click();
    await page.locator('#gaia-statistics-saved-view').selectOption(saved.id);
    await page.locator('#gaia-statistics-view-apply').click();
    await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,original.id);
    assert.equal(Number(await page.locator('#japan-mode-number').textContent()),number,'Restore does not navigate the exhibit');
    assert.equal((await page.evaluate(()=>GaiaStatisticsLab.getState())).methodId,state.methodId);
    await page.locator('#gaia-statistics-view-delete').click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gaia-statistics-saved-views:v1')).length),0);
    await page.evaluate(lang=>GaiaI18n.set(lang),language);
   }
   await page.evaluate(()=>GaiaStatisticsLab.close());
   report.checks.push({width,language,number,id:original.id,rows:original.rows.length,views:5,reloadedSavedView:!inventory});console.log(width,language,number,'pending',report.pending.length);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status=inventory?'inventory-complete':'passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/'+(inventory?'inventory':'report')+'.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,pending:report.pending,failure:report.failure}));}
