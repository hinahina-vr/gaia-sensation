import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/concept-learning-layers-20260913';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const results=[];
 for(const width of [1440,768,390,320]) {
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:4492/concept/');await p.waitForFunction(()=>document.body.dataset.enhanced==='true');
  const section=p.locator('.learning-references');await section.scrollIntoViewIfNeeded();
  assert.deepEqual(await p.locator('.learning-layer').evaluateAll(ns=>ns.map(n=>n.querySelectorAll('.learning-courses li').length)),[2,1,2]);
  assert.equal(await section.locator('a[href^="https://syllabus.zen.ac.jp/"]').count(),5);
  assert.equal(await section.locator('a[href="https://sphere.blue/"]').count(),1);
  assert.match(await section.innerText(),/完全版.*没入感/);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const card of await section.locator('.learning-courses li').all())assert(await card.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await section.screenshot({path:`${dir}/${width}.png`,style:'.site-header,.skip-link { visibility:hidden !important; }'});
  for(const lang of ['en','zh-CN','ja']) {
   await p.evaluate(lang=>GaiaI18n.set(lang),lang);
   const text=await section.innerText();
   assert.match(text,lang==='en'?/Three layers/:lang==='zh-CN'?/三个层次/:/3つのレイヤー/);
   assert.match(text,lang==='en'?/full version/:lang==='zh-CN'?/完全版/:/完全版/);
   assert.equal(await section.locator('a[href="https://sphere.blue/"]').count(),1);
  }
  assert.deepEqual(errors,[]);results.push({width,status:'PASS',courseCounts:[2,1,2],languages:['ja','en','zh-CN']});await p.close();
 }
 fs.writeFileSync(`${dir}/verification.json`,JSON.stringify({localOnly:true,results},null,2));console.log(results);
}finally{await browser.close();}
