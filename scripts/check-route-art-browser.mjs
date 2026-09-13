import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/route-art-20260912'; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const [width,mode] of [[1440,'normal'],[390,'normal'],[390,'reduce'],[390,'fallback']]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:mode==='reduce'?'reduce':'no-preference'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(mode==='fallback') await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});
  await page.goto('http://127.0.0.1:4492/');
  await page.locator('#gaia-opening-sound-off').click();
  if(mode!=='reduce') await page.locator('#gaia-opening-skip').click();
  await page.locator('#gaia-opening-route-story').waitFor({state:'visible'});
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.gaia-route-art').count(),mode==='fallback'?0:2);
  assert(await page.locator('.gaia-route-art').evaluateAll(nodes=>nodes.every(n=>n.width>0 && n.getContext('webgl'))));
  await page.screenshot({path:`${out}/${width}-${mode}.png`});
  await page.locator('#gaia-opening-route-story').hover();await page.waitForTimeout(350);
  await page.screenshot({path:`${out}/${width}-${mode}-hover.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();}
console.log('PASS route-art: PC/mobile WebGL and no runtime errors');
