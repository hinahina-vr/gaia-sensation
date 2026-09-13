import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='artifacts/ai-result-header-20260913';fs.mkdirSync(out,{recursive:true});
const before=process.argv.includes('--before'),results=[];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/#world-28');
 await page.waitForFunction(()=>globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});
 await page.locator('#gaia-boot').waitFor({state:'hidden'});
 await page.evaluate(()=>GaiaModeLoader.load('statistics'));
 await page.waitForFunction(()=>globalThis.GaiaStatisticsLab);
 await page.evaluate(async()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});await GaiaStatisticsLab.open({dataset:GaiaEstatExhibits.getStatisticsDataset()});});
 await page.locator('[data-stat-view="ai"]').click();
 for(const width of [1920,1400,390]){
  await page.setViewportSize({width,height:1080});
  const header=page.locator('.gaia-statistics-ai-result-head');
  await header.scrollIntoViewIfNeeded();
  const r=await header.evaluate(el=>{const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};return {header:rect(el),output:rect(el.querySelector('output')),minus:rect(el.querySelector('button')),plus:rect(el.querySelector('button:last-of-type'))};});
  results.push({width,...r});
  if(!before){assert(r.header.height<=60,JSON.stringify(r));assert(Math.abs(r.output.cy-r.minus.cy)<1);assert(Math.abs(r.output.cx-(r.minus.cx+r.plus.cx)/2)<1);}
  await header.screenshot({path:`${out}/${before?'before':'after'}-${width}.png`});
 }
 if(!before){const value=page.locator('[data-ai-font-size]');const initial=Number(await value.textContent());await page.locator('[data-ai-font-plus]').click();assert(Number(await value.textContent())>initial);await page.locator('[data-ai-font-minus]').click();assert.equal(Number(await value.textContent()),initial);}
 fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
