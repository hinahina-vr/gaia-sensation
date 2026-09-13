import {chromium} from 'playwright-core';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {METHOD_GROUPS} from '../statistics-methods.js';
const dir='artifacts/statistical-charts-20260913';fs.mkdirSync(dir,{recursive:true});
const datasets=JSON.parse(fs.readFileSync('artifacts/bi-insights-20260913/datasets.json'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[];
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/#world-28');
 await page.waitForFunction(()=>globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});await page.locator('#gaia-boot').waitFor({state:'hidden'});
 await page.evaluate(()=>GaiaModeLoader.load('statistics'));await page.waitForFunction(()=>globalThis.GaiaStatisticsLab);
 await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
 for(const id of ['co2-trend','renewables','culture','earthquakes','jma-co2']){
  await page.evaluate(d=>GaiaStatisticsLab.open({dataset:d}),datasets.find(d=>d.id===id));
  for(const [method] of METHOD_GROUPS.flatMap(g=>g.methods)){
   const result=await page.evaluate(method=>GaiaStatisticsLab.run(method),method);
   const group=METHOD_GROUPS.find(g=>g.methods.some(m=>m[0]===method)).id;
   await page.evaluate(({group,method})=>{document.querySelector(`[data-analysis-group="${group}"]`).click();document.querySelector(`[data-method="${method}"]`).click();},{group,method});
   await page.waitForFunction(()=>document.querySelector('#gaia-statistics-status')?.textContent!=='計算中');
   await page.locator('[data-stat-view="chart"]').click();await page.waitForTimeout(60);
   const chart=await page.locator('#gaia-statistics-canvas').evaluate(n=>({annotations:n.dataset.statisticalAnnotations,top:+n.dataset.plotTop,bottom:+n.dataset.plotBottom}));
   const selected=await page.evaluate(()=>GaiaStatisticsLab.getState().methodId);
   checks.push({id,method,selected,kind:result.kind,chart:result.chart?.type,...chart});
   if(id==='renewables'&&['multiple','logistic','anova','bayes'].includes(method)&&result.kind!=='not-applicable')await page.locator('#gaia-statistics-canvas').screenshot({path:`${dir}/${method}.png`});
   assert(!/NaN|undefined/.test(chart.annotations||''));
   if(result.kind!=='not-applicable'){assert(chart.bottom>chart.top,`${id}/${method}: plot height`);}
   if(result.kind!=='not-applicable'&&id==='co2-trend'&&['regression','diagnostics','prediction','interval','summary'].includes(method)){
    if(method==='regression')assert(chart.annotations.includes('R²')&&result.chart.band?.length===61);
    if(method==='diagnostics')assert(result.chart.residual&&!result.chart.line);
    if(method==='prediction')assert(chart.annotations.includes('予測区間'));
    await page.locator('#gaia-statistics-canvas').screenshot({path:`${dir}/${method}.png`});
   }
  }
 }
 await page.evaluate(d=>GaiaStatisticsLab.open({dataset:d}),datasets.find(d=>d.id==='co2-trend'));
 await page.evaluate(()=>GaiaStatisticsLab.run('regression'));await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 await page.evaluate(()=>{document.querySelector('[data-analysis-group="regression"]').click();document.querySelector('[data-method="regression"]').click();});await page.waitForTimeout(300);
 await page.locator('#gaia-statistics-canvas').screenshot({path:`${dir}/mobile-regression.png`});
 await page.setViewportSize({width:1920,height:1080});
 await page.locator('#gaia-statistics-menu-toggle').click();await page.locator('.gaia-statistics-data-options > summary').click();await page.locator('#gaia-statistics-view-save').click();
 const savedId=await page.locator('#gaia-statistics-saved-view').inputValue();assert(savedId);
 await page.reload();await page.waitForFunction(()=>globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});await page.locator('#gaia-boot').waitFor({state:'hidden'});await page.evaluate(()=>GaiaModeLoader.load('statistics'));await page.waitForFunction(()=>globalThis.GaiaStatisticsLab);
 await page.evaluate(()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});return GaiaStatisticsLab.open({dataset:GaiaEstatExhibits.getStatisticsDataset()});});
 await page.locator('#gaia-statistics-menu-toggle').click();await page.locator('.gaia-statistics-data-options > summary').click();await page.locator('#gaia-statistics-saved-view').selectOption(savedId);await page.locator('#gaia-statistics-view-apply').click();
 await page.waitForFunction(()=>GaiaStatisticsLab.getState().methodId==='regression'&&GaiaStatisticsLab.getState().analysisReady);
 assert((await page.locator('#gaia-statistics-canvas').getAttribute('data-statistical-annotations')).includes('R²'));
 fs.writeFileSync(`${dir}/audit.json`,JSON.stringify(checks,null,2));console.log(`PASS ${checks.length} dataset/method paths`);
}finally{await browser.close();}
