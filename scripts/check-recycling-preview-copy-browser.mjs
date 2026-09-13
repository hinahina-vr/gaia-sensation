import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
fs.mkdirSync('artifacts/recycling-preview-copy',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=9#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
 await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaMapObservationAdapter.focusEarthLocation({lon:134,lat:-25,zoom:3.5,targetX:.5,targetY:.38,durationMs:0});});
 await page.waitForTimeout(1000);
 const point=await page.evaluate(()=>{
  const r=document.querySelector('#japan-map').getBoundingClientRect(),d=document.querySelector('#japan-overlay').dataset;
  const scale=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom);
  return {x:r.left+r.width/2+Number(d.earthOffsetX)+(((134-Number(d.earthCenterLongitude)+540)%360)-180)*scale,y:r.top+r.height/2+Number(d.earthOffsetY)+25*scale};
 });
 await page.mouse.move(point.x,point.y);const tip=page.locator('#japan-poi-preview');await tip.waitFor({state:'visible'});
 const text=await tip.textContent();assert(text.includes('再資源化率'));assert(!/国連|推計|制度|廃棄物/.test(text));
 await tip.screenshot({path:`artifacts/recycling-preview-copy/${width}.png`});
 await page.mouse.click(point.x,point.y);await page.locator('#japan-poi-card').waitFor({state:'visible'});
 assert.match(await page.locator('#japan-poi-meta').textContent(),/国連|世界銀行/);
 console.log('PASS',width);await page.close();
}}finally{await browser.close();}
