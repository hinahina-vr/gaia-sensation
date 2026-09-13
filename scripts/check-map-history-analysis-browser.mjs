import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492', out=path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/map-history-20260912/analysis');
fs.mkdirSync(out,{recursive:true});
const report={before,checks:[],errors:[],scope:'Actual Chrome, local files and storage, external services blocked. Not production.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
 for(const width of before?[1440]:[1440,390]) {
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<901,hasTouch:width<901,reducedMotion:'reduce'});
  await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{
   const original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,...args){
    if(this.canvas.id==='gaia-statistics-canvas'&&/^(19|20)[0-9]{2}$/.test(String(text))){
     const years=new Set((this.canvas.dataset.qaYearLabels||'').split(',').filter(Boolean));years.add(String(text));this.canvas.dataset.qaYearLabels=[...years].sort().join(',');
    }
    return original.call(this,text,...args);
   };
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const entry=async()=>{await page.goto(base+'/?exhibit=38#world',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.GaiaMarineCod&&globalThis.GaiaMapDemo);await page.locator('[data-feature-start]').click({timeout:12000}).catch(async error=>{if(await page.locator('#gaia-mode-entry-guide').getAttribute('aria-hidden')!=='true')throw error;});await page.evaluate(()=>GaiaMapDemo.stop());await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');};
  const analysis=async kind=>{
   if(width<901){await page.locator('[data-mobile-sheet="tools"]').click();await page.getByRole('button',{name:'統計分析',exact:true}).last().click();}
   else await page.locator(`[data-${kind}-analysis]`).click();
   await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
  };
  const menu=async()=>{await page.locator('#gaia-statistics-menu-toggle').click();const options=page.locator('.gaia-statistics-data-options');if(await options.getAttribute('open')===null)await options.locator('summary').click();};
  await entry();await page.selectOption('[data-cod-prefecture]','13');await page.selectOption('[data-cod-station]','47662');
  await page.waitForFunction(()=>!document.querySelector('[data-cod-analysis]').disabled);
  const dataset=await page.evaluate(()=>GaiaMarineCod.getStatisticsDataset());assert.equal(dataset.rows.length,70);
  await analysis('cod');
  assert.equal(await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count'),'70');
  const labels=(await page.locator('#gaia-statistics-canvas').getAttribute('data-qa-year-labels')).split(',');
  assert(labels.includes('1955')&&labels.includes('2024')&&labels.length<=8);
  await page.locator('#gaia-statistics-canvas').focus();await page.keyboard.press('Home');
  const tooltip=page.locator('.gaia-statistics-chart-tooltip');await tooltip.waitFor({state:'visible'});assert((await tooltip.innerText()).includes('1955'));
  await page.keyboard.press('End');assert((await tooltip.innerText()).includes('2024'));
  await page.screenshot({path:path.join(out,`${width}-${before?'before':'after'}-70-year-chart.png`)});
  await menu();await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
  await page.locator('#gaia-statistics-record-filter').fill('no-match-history-test');await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();
  assert.equal(await page.locator('#gaia-statistics-record-filter').inputValue(),'');
  await page.close();page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await entry();
  await page.evaluate(()=>GaiaMapCategories.buttons()[69].click());await page.waitForFunction(()=>GaiaFoodExhibits.getState().dataState==='ready');
  await page.selectOption('[data-food-country]','392');await analysis('food');await menu();
  await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();
  await page.waitForTimeout(1200);
  const restored=await page.evaluate(id=>GaiaStatisticsLab.getState().datasetId===id,dataset.id);
  if(before)assert.equal(restored,false,'Reproduce annual saved analysis missing after fresh page');
  else {await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,dataset.id);assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),70);}
  report.checks.push({width,dataset:dataset.id,rows:70,axisYears:labels,stored:saved,restored});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(out,before?'before.json':'after.json'),JSON.stringify(report,null,2));await browser.close();}
