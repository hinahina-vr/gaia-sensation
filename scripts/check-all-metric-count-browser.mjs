import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out=process.env.QA_OUTPUT || 'artifacts/all-metric-count'; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try {
 const unit=await browser.newPage(); await unit.goto('http://127.0.0.1:4492/');
 const result=await unit.evaluate(async()=>{
  const {animateMetricText:animate}=await import('/src/shared/animated-metric.js');
  const el=document.createElement('strong');document.body.append(el);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  animate(el,'1,000.0 %','test'); await wait(180); const up=el.textContent;
  animate(el,'1,000.0 %','test'); await wait(650); const end=el.textContent;
  animate(el,'-200.0 %','test');await wait(180);const down=el.textContent;
  animate(el,'記録なし','test'); await wait(850);const missing=el.textContent;
  el.replaceChildren(document.createTextNode('123'));
  animate(el,'記録なし','test');const missingAgain=el.textContent;
  animate(el,'0.1 未満','test'); const qualified=el.textContent;
  animate(el,'2024年 / 25.0 %','year');await wait(150);const year=el.textContent;
  return {up,end,down,missing,missingAgain,qualified,year};
 });
 assert.notEqual(result.up,result.end);assert.equal(result.end,'1,000.0 %');
 assert(Number(result.down.replace(/[, %]/g,''))<1000);assert.equal(result.missing,'記録なし');assert.equal(result.qualified,'0.1 未満');assert(result.year.startsWith('2024年'));
 assert.equal(result.missingAgain,'記録なし');
 await unit.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await unit.evaluate(async()=>{const {animateMetricText:a}=await import('/src/shared/animated-metric.js');const e=document.createElement('b');document.body.append(e);a(e,'500');return e.textContent;}),'500');
 await unit.close();report.push({unit:result});
 for(const width of (process.env.QA_WIDTHS||'1440,390').split(',').map(Number)){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__metricSamples={};
   new MutationObserver(()=>{
    const n=document.querySelector('#japan-mode-number')?.textContent;
    if(!n)return;
    const elements=document.querySelectorAll('#japan-layer [data-metric-counting="true"]');
    const values=window.__metricSamples[Number(n)] ||= [];
    for(const el of elements)if(values.length<120 && !values.includes(el.textContent))values.push(el.textContent);
   }).observe(document,{subtree:true,childList:true,characterData:true});
  });
  await page.route('https://**',r=>r.abort());
  await page.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  await page.goto('http://127.0.0.1:4492/?exhibit=22#world');
  await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  for(const n of (process.env.QA_NUMBERS||Array.from({length:71},(_,i)=>i+1).join(',')).split(',').map(Number)){
   await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,n);
   if(n>=2&&n<=5)await page.waitForFunction(()=>GaiaPlanetSignals.getState().pointCount>0);
   if(n>=31&&n<=69){
    await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');
    await page.evaluate(()=>{
     const region=document.querySelector('[data-cod-prefecture]');
     if(region.options.length>1){region.value=[...region.options].find(o=>o.value&&o.value!=='all').value;region.dispatchEvent(new Event('change',{bubbles:true}));}
     const station=document.querySelector('[data-cod-station]');
     for(const option of [...station.options].filter(o=>o.value&&!o.disabled)){
      station.value=option.value;station.dispatchEvent(new Event('change',{bubbles:true}));
      if(/\d/.test(document.querySelector('[data-cod-value]').dataset.metricTarget||''))break;
     }
    });
   }
   const selector=n===1?'[data-firms-visible]':n<=5?'[data-planet-primary]':n<=14?'.signal-console-map [data-signal-value]':n<=20?'[data-live-exhibit-value]':n<=30?'[data-estat-value]':n<=69?'[data-cod-value]':'[data-food-value]';
   await page.waitForFunction(s=>document.querySelector(s)?.textContent?.trim(),selector);
   await page.waitForTimeout(1100);
   const state=await page.locator(selector).evaluate(el=>({text:el.textContent,target:el.dataset.metricTarget||el.querySelector('[data-metric-target]')?.dataset.metricTarget,html:el.innerHTML}));
   const samples=await page.evaluate(n=>window.__metricSamples[n]||[],n);
   if(state.target && Math.abs(parseFloat(state.target.replaceAll(',','')))>0 && !/[<>≤≥＜＞]|未満|以下|以上/.test(state.target))assert(samples.length>1,`Exhibit ${n}: intermediate numeric frames`);
   report.push({width,n,...state,samples});console.log('PASS render',width,n,state.text.slice(0,55),'samples',samples.length);
   if([2,6,12,13,15,22,31,41,69,70,71].includes(n))await page.screenshot({path:`${out}/${width}-${n}.png`});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
} finally {fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
