import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/sensor-public-entry-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const [width,status] of [[1440,401],[390,503]]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('**/api/web/v1/session',r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{message:'QA session unavailable'}})}));
  await page.goto('http://127.0.0.1:4492/');
  await page.locator('#gaia-opening-sound-off').click();await page.locator('#gaia-opening-skip').click();
  await page.locator('#gaia-opening-route-other').click();
  const sessionResponse=page.waitForResponse(r=>r.url().endsWith('/api/web/v1/session'));
  await page.locator('[data-sensor-platform-link]').click();
  await page.waitForURL('**/sensors/#map');
  await sessionResponse;
  await page.waitForTimeout(500);
  assert(await page.locator('[data-view="map"]').isVisible());
  assert(!await page.locator('[data-view="login"]').isVisible());
  assert.equal(await page.locator('#map h1').textContent(),'みんなでつくる観測地図');
  await page.screenshot({path:`${out}/${width}-${status}.png`});
  console.log(`PASS ${width}: actual card click, simulated session ${status}, map retained`);
  await page.close();
 }
}finally{await browser.close();}
