import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/map-status-contrast-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:4492/?exhibit=38#world');
  await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  await page.evaluate(()=>GaiaMapDemo.stop());
  await page.waitForFunction(()=>window.GaiaMarineCod?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
  const notice=page.locator('[data-cod-status]');
  assert(await notice.isVisible());
  assert.match(await notice.textContent(),/気象庁/);
  const style=await notice.evaluate(e=>({shadow:getComputedStyle(e).textShadow,background:getComputedStyle(e).backgroundColor,overflow:e.scrollWidth>e.clientWidth}));
  assert(style.shadow.includes('10px'));assert(style.background.includes('0.88'));assert(!style.overflow);
  await page.screenshot({path:`${out}/${width}.png`});
  fs.writeFileSync(`${out}/${width}.json`,JSON.stringify(style));
  await page.close();
 }
 console.log('PASS: PC/mobile saved-data notice contrast and layout');
}finally{await browser.close();}
