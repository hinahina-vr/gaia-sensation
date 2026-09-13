import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='artifacts/close-controls-20260913';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await p.route('https://**',r=>r.abort());
 await p.goto('http://127.0.0.1:4492/#world-21');await p.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready);await p.locator('#gaia-boot').waitFor({state:'hidden'});
 await p.evaluate(()=>GaiaModeEntryGuide.open('map',{force:true}));
 const x=p.locator('[data-feature-close]');await x.waitFor({state:'visible'});
 const check=async locator=>{const s=await locator.evaluate(n=>{const s=getComputedStyle(n);return [s.width,s.height,s.borderRadius]});assert.deepEqual(s,['48px','48px','12px']);};
 await check(x);await p.screenshot({path:`${out}/map-guide.png`});await x.click();
 await p.waitForTimeout(500);assert.equal(await p.locator('#map-responsive-sources-button').isVisible(),false);
 const credit=await p.locator('.japan-credits').boundingBox();assert(credit.width<1200);await p.screenshot({path:`${out}/map.png`});
 await p.goto('http://127.0.0.1:4492/sensors/');await p.waitForTimeout(2000);
 await p.evaluate(()=>{globalThis.GaiaModeEntryGuide?.close();const btn=document.querySelector('.sensor-dialog-close');btn.closest('dialog').showModal();});
 const sx=p.locator('dialog[open] .sensor-dialog-close').first();await check(sx);await p.screenshot({path:`${out}/sensor.png`});await sx.click();assert.equal(await p.locator('dialog[open]').count(),0);
 console.log('PASS map guide and sensor close geometry/actions; source button hidden and attribution shrunk');
}finally{await b.close();}
