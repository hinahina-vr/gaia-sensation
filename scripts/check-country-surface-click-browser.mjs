import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const before=process.argv.includes('--before'),out='artifacts/country-surface-click';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try{for(const width of [1440,390])for(const n of before?[13]:[9,10,13,70,71]){
 const page=await browser.newPage({viewport:{width,height:900}});
 if(before)await page.route('**/app.js?*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('app.js','utf8').replace('["anthropocene-scar", "nothing-is-waste", "earth-organ"].includes(signalModeId)','["anthropocene-scar", "nothing-is-waste"].includes(signalModeId)')}));
 await page.route('https://**',r=>r.abort());await page.goto(`http://127.0.0.1:4492/?exhibit=${n}#world`);
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().playing,n);
 await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaMapObservationAdapter.focusEarthLocation({lon:122,lat:-25,zoom:3.5,targetX:.5,targetY:.4,durationMs:0});});
 await page.waitForTimeout(1800);
 await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
 await page.waitForTimeout(1000);
 const point=await page.evaluate(()=>{
  const r=document.querySelector('#japan-map').getBoundingClientRect(),d=document.querySelector('#japan-overlay').dataset;
  const scale=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom);
  return {x:r.left+r.width/2+Number(d.earthOffsetX)+(((122-Number(d.earthCenterLongitude)+540)%360)-180)*scale,y:r.top+r.height/2+Number(d.earthOffsetY)+25*scale};
 });
 await page.mouse.move(point.x,point.y);await page.waitForTimeout(200);
 console.log('point',width,n,point);
 await page.screenshot({path:`${out}/probe-${width}-${n}.png`});
 const preview=page.locator('#japan-poi-preview');
 if(before){report.push({width,n,preview:await preview.isVisible()});}
 else {
  await preview.waitFor({state:'visible'});assert.match(await preview.textContent(),/オーストラリア/);
  await page.mouse.click(point.x,point.y);await page.locator('#japan-poi-card').waitFor({state:'visible'});
  if(n===13)await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.renewableSelectedIso3==='AUS');
  else if(n>=70)assert.match(await page.locator('[data-food-country] option:checked').textContent(),/オーストラリア/);
  else assert.match(await page.locator('#japan-poi-card').textContent(),/オーストラリア/);
  report.push({width,n,selected:'AUS, western inland (not POI centre)'});
 }
 await page.screenshot({path:`${out}/${before?'before':'after'}-${width}-${n}.png`});console.log(report.at(-1));await page.close();
}fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));}finally{await browser.close();}
