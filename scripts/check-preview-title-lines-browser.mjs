import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='artifacts/preview-title-lines';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=33#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForTimeout(6000);
 await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
 for(const title of ['若狭湾東部海域 / 立石岬地先','北海道 / 札幌','北緯35.5° / 東経135.5°']) {
  await page.evaluate(async title=>{
   GaiaMapPlayback.stop();
   const {renderPoiPreviewTitle,renderPoiPreviewReadings}=await import('/src/exploration/poi-preview-readings.js');
   const p=document.querySelector('#japan-poi-preview');p.hidden=false;p.classList.add('is-visible');
   p.style.cssText='position:fixed;left:18px;top:300px;visibility:visible!important;opacity:1!important;filter:none!important;transform:none!important;transition:none!important;z-index:9999';
   renderPoiPreviewTitle(document.querySelector('#japan-poi-preview-title'),title);
   document.querySelector('#japan-poi-preview-kicker').textContent='33 / DO 年度平均値';
   renderPoiPreviewReadings(document.querySelector('#japan-poi-preview-meta'),{context:'2024年度',readings:[{value:7.5,unit:'mg/L',label:'DO 年度平均値'}]},'');
  },title);
  const result=await page.locator('#japan-poi-preview').evaluate(p=>({width:p.getBoundingClientRect().width,lines:[...p.querySelectorAll('.poi-preview-title-line')].map(el=>({text:el.textContent,nowrap:getComputedStyle(el).whiteSpace,overflow:el.scrollWidth>el.clientWidth}))}));
  assert.equal(result.lines.length,2);assert.ok(result.lines.every(l=>l.nowrap==='nowrap'&&!l.overflow));assert.ok(result.width<=width-30);
  console.log(width,title,result);if(title.startsWith('若狭'))await page.screenshot({path:`${out}/${width}.png`});
 }
 await page.close();
}}finally{await browser.close();}
