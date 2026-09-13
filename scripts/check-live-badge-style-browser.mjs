import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4492/realtime-exhibits.css');
 await page.evaluate(async()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='/realtime-exhibits.css';document.head.append(css);await new Promise(r=>css.onload=r);
  const m=await import('/src/exploration/realtime-exhibit-status.js');const el=m.createRealtimeStatus();document.body.replaceChildren(el);m.updateRealtimeStatus(el,{sourceState:'LIVE',observedAt:new Date().toISOString()});
 });
 const badge=page.locator('.gaia-broadcast-badge');assert.equal(await badge.textContent(),'LIVE');
 const scan=await badge.evaluate(b=>{for(const a of b.getAnimations()){a.pause();a.currentTime=900;}const s=getComputedStyle(b);return {border:s.borderWidth,font:s.fontFamily,opacity:s.opacity};});
 assert.equal(scan.border,'0px');assert.equal(scan.font,'sans-serif');assert.equal(scan.opacity,'0.4');console.log('PASS: actual status component, LIVE, sans-serif, no border, 40% pulse');
}finally{await browser.close();}
