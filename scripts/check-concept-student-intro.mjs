import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/concept-student-intro-20260913';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const results=[];
 for(const width of [1440,390,320]) {
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/concept/');
  await page.waitForFunction(()=>document.body.dataset.enhanced==='true');
  assert.match(await page.locator('#overview-story').innerText(),/オンライン大学.*サークル「惑星の放課後」/);
  assert.equal(await page.locator('#overview-system strong').innerText(),'展示参加型ビジュアルノベル');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#overview-story').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/${width}.png`});
  for(const lang of ['en','zh-CN','ja']) {
   await page.evaluate(lang=>GaiaI18n.set(lang),lang);
   assert.match(await page.locator('#overview-story').innerText(),lang==='en'?/online university students/:lang==='zh-CN'?/在线大学/:/オンライン大学/);
  }
  assert.equal(await page.locator('#overview-system strong').innerText(),'展示参加型ビジュアルノベル');
  assert.deepEqual(errors,[]);results.push({width,status:'PASS',languages:['ja','en','zh']});await page.close();
 }
 fs.writeFileSync(`${dir}/verification.json`,JSON.stringify({localOnly:true,results},null,2));console.log(results);
}finally{await browser.close();}
