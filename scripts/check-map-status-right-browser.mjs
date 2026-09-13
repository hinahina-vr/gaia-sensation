import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out='artifacts/map-status-right-20260913';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={checks:[],errors:[]};
try {
 for(const width of [1440,1024,390]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:4492/#world-40');
  for(const n of [40,31,56,69]) {
   await page.evaluate(n=>location.hash='#world-'+n,n);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaMapPlayback?.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n,{timeout:45000});
   const state=await page.evaluate(()=>{
    const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
    return {status:rect('.gaia-cod-status'),count:rect('.gaia-cod-count'),dock:rect('.gaia-marine-cod-readout'),nav:rect('#map-stable-navigation'),text:document.querySelector('.gaia-cod-status').textContent,overflow:document.documentElement.scrollWidth-innerWidth};
   });
   assert.equal(state.overflow,0);assert(state.text.trim());
   if(width>900){
    assert(Math.abs(state.status.right-state.count.right)<1,'Both annotations right aligned');
    assert(state.status.bottom<=state.count.top,'Annotation rows never overlap');
    assert(state.count.bottom<state.dock.top,'Annotations clear dock');
    assert(state.status.top>state.nav.bottom,'Annotations clear navigation');
    assert(state.status.left>=0&&state.status.right<=width);
   }
   report.checks.push({width,n,...state});
   if(n===40)await page.screenshot({path:`${out}/${width}-40.png`});
  }
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
