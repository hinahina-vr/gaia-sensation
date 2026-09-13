import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const before=process.argv.includes('--before'),out='artifacts/findings-spacing';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try{for(const width of [1440,2560,390]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/?exhibit=7#world');await page.locator('[data-feature-start]').click();
 await page.evaluate(()=>GaiaModeLoader.load('statistics'));
 await page.evaluate(()=>GaiaStatisticsLab.open({datasetId:'ocean-currents'}));
 await page.waitForFunction(()=>document.querySelector('#gaia-statistics-status').textContent==='解析済み');
 await page.locator('[data-stat-view="findings"]').click();
 const card=page.locator('#gaia-statistics-findings > .gaia-statistics-finding').first();await card.waitFor({state:'visible'});
 const state=await card.evaluate(el=>{const s=getComputedStyle(el),p=getComputedStyle(el.querySelector('p')),wrap=document.querySelector('#gaia-statistics-findings'),shell=document.querySelector('.gaia-statistics-shell');return {padding:parseFloat(s.paddingLeft),gap:parseFloat(getComputedStyle(wrap).gap),lineRatio:parseFloat(p.lineHeight)/parseFloat(p.fontSize),overflow:wrap.scrollWidth>wrap.clientWidth+1,scrollHeight:shell.scrollHeight,clientHeight:shell.clientHeight};});
 if(!before){assert(state.padding>=24);assert(state.gap>=24);assert(state.lineRatio>=1.95);assert(!state.overflow);if(width>=1200)assert(state.scrollHeight<=state.clientHeight+1,'Default findings fit without a scrollbar');}
 report.push({width,...state});await page.screenshot({path:`${out}/${before?'before':'after'}-${width}.png`});
 const extra=page.locator('#gaia-statistics-findings > details').first();await extra.locator('summary').click();assert(await extra.evaluate(el=>el.open));
 await page.locator('#gaia-statistics-findings > button').scrollIntoViewIfNeeded();assert(await page.locator('#gaia-statistics-findings > button').isVisible());
 await page.locator('#stat-panel-findings .gaia-statistics-panel-back').click();assert.equal(await page.locator('[data-stat-view="chart"]').getAttribute('aria-selected'),'true');await page.close();
}console.log(report);fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));}finally{await browser.close();}
