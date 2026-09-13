import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/character';fs.mkdirSync(out,{recursive:true});
const report={status:'running',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of [1440,390])for(const language of ['en','zh-CN']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#character');
  await page.locator('#character-book-layer').waitFor();
  for(const id of ['amane','mizuha','sakuya','aoneko']){
   await page.locator('[data-character-select="'+id+'"]').click();
   await page.waitForFunction(id=>document.querySelector('#character-book-layer')?.dataset.characterId===id,id);
   await page.waitForTimeout(400);
   const scan=await page.locator('#character-book-layer').evaluate(el=>({
    text:el.innerText,
    heading:el.querySelector('#character-book-tagline').getAttribute('aria-label'),
    profile:el.querySelector('#character-book-profile').getAttribute('aria-label'),
    name:el.querySelector('#character-book-native').getAttribute('aria-label'),
    quote:el.querySelector('#character-book-quote').getAttribute('aria-label'),
    image:el.querySelector('#character-book-image').getAttribute('src'),
    overflow:[...el.querySelectorAll('#character-book-profile,#character-book-tagline,#character-book-page-title')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({id:e.id,scroll:e.scrollWidth,width:e.clientWidth}))
   }));
   report.lastScan={width,language,id,...scan};
   const forbidden=language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u;
   assert(!forbidden.test(scan.text),'Untranslated character UI: '+scan.text);
   assert(!forbidden.test(scan.profile),'Profile aria-label untranslated');assert.deepEqual(scan.overflow,[]);
   await page.screenshot({path:out+'/'+width+'-'+language+'-'+id+'.png'});
   const expression=page.locator('[data-character-expression]').last();
   if(await expression.isVisible())await expression.click();
   const before=await page.locator('#character-book-layer').getAttribute('data-expression-id');
   await page.evaluate(()=>GaiaI18n.set('ja'));
   assert.equal(await page.locator('#character-book-layer').getAttribute('data-character-id'),id);
   assert.equal(await page.locator('#character-book-layer').getAttribute('data-expression-id'),before);
   await page.evaluate(lang=>GaiaI18n.set(lang),language);
   assert.equal(await page.locator('#character-book-profile').getAttribute('aria-label'),scan.profile);
   report.checks.push({width,language,id,scan});console.log(width,language,id,'passed');
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure}));}
