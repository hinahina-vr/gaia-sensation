import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/quake-playback-spacing-20260913';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/#world-11');
 await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
 await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
 await page.waitForFunction(()=>GaiaMapPlayback?.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
 await page.evaluate(()=>GaiaMapPlayback.start());
 await page.locator('[data-map-menu-toggle]:visible').hover();
 await page.waitForTimeout(120);
 const afterHover=await page.evaluate(()=>GaiaMapPlayback.getState());
 if(process.argv.includes('--reproduce')) {
  assert.equal(afterHover.requested,false);fs.writeFileSync(`${dir}/before.json`,JSON.stringify(afterHover,null,2));console.log('REPRODUCED: passive menu hover stopped automatic display');
 } else {
  assert.equal(afterHover.requested,true,'Hover must retain automatic playback');
  await page.mouse.move(600,600);await page.waitForTimeout(250);
  await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.selectionLabelVisible==='true'&&document.querySelector('#japan-overlay').dataset.earthquakeMagnitudeBoxes,null,{timeout:60000});
  const placement=await page.locator('#japan-overlay').evaluate(n=>({x:+n.dataset.selectionLabelLeftPx,y:+n.dataset.selectionLabelTopPx,w:+n.dataset.selectionLabelWidthPx,h:+n.dataset.selectionLabelHeightPx,boxes:JSON.parse(n.dataset.earthquakeMagnitudeBoxes)}));
  for(const b of placement.boxes)assert(placement.x+placement.w<=b.x-b.gap+.2||placement.x>=b.x+b.width+b.gap-.2||placement.y+placement.h<=b.y-b.gap+.2||placement.y>=b.y+b.height+b.gap-.2,'Callout clears magnitude by one character');
  await page.screenshot({path:`${dir}/spacing.png`});
  const position=await page.evaluate(()=>GaiaMapObservationAdapter.getState().signalTimePosition);
  await page.waitForFunction(p=>GaiaMapObservationAdapter.getState().signalTimePosition!==p,position,{timeout:60000});
  assert.equal(await page.evaluate(()=>GaiaMapPlayback.getState().requested),true);
  await page.locator('#gaia-map-playback-toggle').click();
  assert.equal(await page.evaluate(()=>GaiaMapPlayback.getState().requested),false);
  fs.writeFileSync(`${dir}/verification.json`,JSON.stringify({status:'PASS',afterHover,placement,checks:['passive hover retains ON','one-character magnitude clearance','advances to next year','explicit stop works']},null,2));
  console.log('PASS hover retains playback, next year advances, callout clearance and explicit stop');
 }
}finally{await browser.close();}
