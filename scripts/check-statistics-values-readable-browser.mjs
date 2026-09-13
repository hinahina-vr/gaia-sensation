import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/statistics-values-readable';fs.mkdirSync(out,{recursive:true});
const before=process.argv.includes('--before');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try {for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/?exhibit=7#world');
 await page.locator('[data-feature-start]').click();
 await page.evaluate(()=>GaiaModeLoader.load('statistics'));
 await page.waitForFunction(()=>typeof window.GaiaStatisticsLab?.open==='function');
 await page.evaluate(async()=>{await GaiaStatisticsLab.open({datasetId:'wind-climate'});const s=document.querySelector('#gaia-statistics-lectures');s.value='01';s.dispatchEvent(new Event('change'));});
 await page.waitForFunction(()=>document.querySelector('#gaia-statistics-status').textContent==='解析済み');
 await page.locator('[data-stat-view="values"]').click();
 const cell=page.locator('#gaia-statistics-metrics th').first();await cell.waitFor({state:'visible'});
 const metrics=await cell.evaluate(el=>{const s=getComputedStyle(el);const panel=document.querySelector('.gaia-statistics-values-scroll');return {color:s.color,fontSize:s.fontSize,padding:s.padding,lineHeight:s.lineHeight,overflow:panel.scrollWidth>panel.clientWidth+1};});
 report.push({width,...metrics});
 if(!before){assert.equal(metrics.color,'rgb(35, 65, 82)');assert(parseFloat(metrics.fontSize)>=14);assert(!metrics.overflow);}
 await page.screenshot({path:`${out}/${before?'before':'after'}-${width}.png`});
 await page.locator('#gaia-statistics-metrics button').first().click();
 assert(await page.locator('#gaia-statistics-formula').isVisible());
 await page.locator('#stat-panel-values .gaia-statistics-panel-back').click();
 assert.equal(await page.locator('[data-stat-view="chart"]').getAttribute('aria-selected'),'true');
 await page.close();
}console.log(report);fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));}finally{await browser.close();}
