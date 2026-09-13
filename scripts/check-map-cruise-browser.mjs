import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const language=process.env.QA_LANGUAGE||'ja';
const out='artifacts/map-cruise'+(language==='ja'?'':'-'+language);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try {for(const width of (process.env.QA_WIDTHS||'1440,390').split(',').map(Number)) {
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
 await page.route('https://**',r=>r.abort());
 // Only the cruise clock is accelerated; real data, camera, DOM and other timers remain unchanged.
 await page.route('**/map-cruise.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('src/exploration/map-cruise.js','utf8').replace('now = () => performance.now()', 'now = () => performance.now() + (globalThis.__cruiseTestAdvance || 0)')}));
 const numbers=(process.env.QA_NUMBERS||'1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,20,21,30,31,33,41,69,70,71').split(',').map(Number);
 await page.goto(`http://127.0.0.1:4492/?exhibit=${numbers[0]}#world`);await page.locator('[data-feature-start]').click();
 await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 for(const n of numbers) {
  await page.evaluate(n=>{GaiaMapCruise.stop();GaiaMapCategories.buttons().find(b=>Number(b.textContent.trim())===n).click();},n);
  await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,n);
  await page.waitForTimeout(1800);await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
  if(width===1440)await page.locator('#gaia-map-cruise-toggle').click();
  else {await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('[data-mobile-cruise]').click();}
  await page.waitForFunction(n=>GaiaMapCruise.getState().number===n&&['slider','poi'].includes(GaiaMapCruise.getState().phase),n);
  const start=await page.evaluate(()=>GaiaMapCruise.getState());
  await page.screenshot({path:`${out}/${width}-${n}.png`});
  const advance=async ms=>{await page.evaluate(ms=>{globalThis.__cruiseTestAdvance=(globalThis.__cruiseTestAdvance||0)+ms;},ms);await page.waitForTimeout(130);};
  if(start.phase==='slider') {
    await advance(start.duration/2);
    assert.equal(await page.evaluate(()=>GaiaMapCruise.getState().phase),'slider');
    await advance(start.duration/2+200);
    await page.waitForFunction(()=>GaiaMapCruise.getState().phase==='hold');
    assert.equal(await page.locator('#japan-mode-number').textContent(),String(n).padStart(2,'0'));
    await advance(3001);
  } else {
    for(let i=0;i<5;i++)await advance(5001);
  }
  await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===(n===71?1:n+1),n);
  assert.equal(await page.evaluate(()=>GaiaMapCruise.getState().active),true);
  results.push({width,n,kind:start.phase,next:n===71?1:n+1});console.log(results.at(-1));
 }
 await page.evaluate(()=>GaiaMapCruise.stop());assert.equal(await page.evaluate(()=>GaiaMapCruise.getState().active),false);
 assert.deepEqual(errors,[]);await page.close();
}fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));}finally{await browser.close();}
