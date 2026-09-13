import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/concept-new-resolution-20260913';fs.mkdirSync(dir,{recursive:true});
const expected=['人生さえも最適解で舗装され、','疑うことすら忘れた意志が、静かに消費されていく時代で。','人知が真に目指すべきは、人間を予測し、飼い慣らす檻の完成ではない。','計算された予定調和の地平を越え、','人が自らの意志をふたたび獲得するための、新たな知の循環だ。'];
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const results=[];
 for(const width of [1440,768,390,320]) {
  const p=await b.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:4492/concept/');await p.waitForFunction(()=>document.body.dataset.enhanced==='true');
  const closing=p.locator('.agency-closing');await closing.scrollIntoViewIfNeeded();
  assert.deepEqual(await closing.locator('.agency-line').allTextContents(),expected);
  assert(await closing.locator('.agency-line').evaluateAll(lines=>lines.every(n=>getComputedStyle(n).textAlign==='center')),'All five lines must be centered');
  assert(await closing.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await closing.screenshot({path:`${dir}/${width}.png`,style:'.site-header,.skip-link {visibility:hidden !important}'});
  for(const lang of ['en','zh-CN','ja']) {
   await p.evaluate(l=>GaiaI18n.set(l),lang);
   assert.match(await closing.innerText(),lang==='en'?/reclaim their own will/:lang==='zh-CN'?/自身意志/:/新たな知の循環/);
   assert(await closing.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  }
  assert.deepEqual(await closing.locator('.agency-line').allTextContents(),expected);
  assert.equal(await closing.locator('strong').innerText(),'新たな知の循環だ。');
  assert.deepEqual(errors,[]);results.push({width,status:'PASS'});await p.close();
 }
 fs.writeFileSync(`${dir}/verification.json`,JSON.stringify({localOnly:true,checks:['exact five lines','responsive layout','language round-trip preserves emphasis'],results},null,2));console.log(results);
}finally{await b.close();}
