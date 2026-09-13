import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/live-latest-time';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=15#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 for(let n=15;n<=20;n++){
  await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
  await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().playing,n);
  await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaLiveData.selectTime(null);});
  await page.waitForFunction(()=>/\d{2}:\d{2}（最新）/.test(document.querySelector('[data-live-period]').textContent));
  const label=await page.locator('[data-live-period]').textContent();
  assert.match(label,/\d{2}\/\d{2}.*\d{2}:\d{2}（最新）$/);
  assert((await page.locator('#gaia-live-time').getAttribute('aria-valuetext')).includes(label));
  assert((await page.locator('[data-live-period-ticks]').textContent()).includes(label));
  await page.locator('.gaia-live-timeline').screenshot({path:`${out}/${width}-${n}.png`});
  console.log('PASS',width,n,label);
 }await page.close();
}}finally{await browser.close();}
