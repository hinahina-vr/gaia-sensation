import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/architecture-section-gap-20260913';fs.mkdirSync(dir,{recursive:true});
const before=process.argv.includes('--before');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const results=[];
 for(const width of [1920,390]) {
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:4492/#world-28');
  await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
  await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
  await page.locator('#japan-close').click();
  await page.locator('#intro-architecture-jump').click();
  await page.locator('.architecture-header').evaluate(n=>n.scrollIntoView({block:'center'}));
  const gap=await page.evaluate(()=>document.querySelector('.architecture-header').getBoundingClientRect().top-document.querySelector('.data-journey-epilogue').getBoundingClientRect().bottom);
  assert(before?gap<16:gap>=64,`${width}: gap ${gap}`);
  await page.screenshot({path:`${dir}/${before?'before':'after'}-${width}.png`});
  results.push({width,gap});await page.close();
 }
 fs.writeFileSync(`${dir}/${before?'before':'after'}.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
