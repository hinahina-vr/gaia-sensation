import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const out='artifacts/map-overview-controls';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try {
 for(const width of [1440,390]) for(const n of [13,17,21,41,69,70]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('https://**',r=>r.abort());
  await page.goto(`http://127.0.0.1:4492/?exhibit=${n}#world`);
  await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().playing,n);
  await page.waitForTimeout(1800);
  await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
  await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaMapObservationAdapter.focusEarthLocation({lon:137.4,lat:36.2,zoom:9,durationMs:0});});
  const reset=page.locator('#gaia-map-zoom-reset');await reset.waitFor({state:'visible'});
  const kind=n>=15&&n<=69?'japan':'world';assert.equal(await reset.getAttribute('data-overview'),kind);
  await reset.focus();
  assert.equal(await reset.evaluate(el=>getComputedStyle(el,'::after').display),'block');
  assert.equal(await page.locator(`#gaia-map-zoom-reset [data-overview-icon="${kind}"]`).isVisible(),true);
  await page.screenshot({path:`${out}/${width}-${n}.png`});
  await reset.click();await reset.waitFor({state:'hidden'});
  const zoom=Number(await page.locator('#japan-overlay').getAttribute('data-earth-zoom'));
  assert.ok(Math.abs(zoom-(kind==='world'?1:width<=720?4.25:6))<.01);
  assert.equal(await page.locator('[data-cod-overview]:visible, [data-food-overview]:visible').count(),0);
  await page.locator('#gaia-map-zoom-in').click();await reset.waitFor({state:'visible'});
  results.push({width,n,kind,resetZoom:zoom,focusTooltip:true});console.log(results.at(-1));await page.close();
 }
 fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
} finally {await browser.close();}
